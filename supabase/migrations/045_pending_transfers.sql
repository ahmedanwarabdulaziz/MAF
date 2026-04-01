-- ============================================================
-- Migration 045: Pending Warehouse Transfers (Logical Delay)
-- ============================================================
-- 1. Alters dispatch_warehouse_transfer to ONLY mark as dispatched without stock reduction
-- 2. Alters receive_warehouse_transfer to perform both OUT and IN stock operations
-- ============================================================

BEGIN;

-- ============================================================
-- RPC: dispatch_warehouse_transfer (Sender Action - No Deduction)
-- ============================================================
CREATE OR REPLACE FUNCTION public.dispatch_warehouse_transfer(p_transfer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer   public.warehouse_transfers%ROWTYPE;
  v_line       record;
  v_src_bal    public.stock_balances%ROWTYPE;
BEGIN
  -- Lock the transfer row
  SELECT * INTO v_transfer FROM public.warehouse_transfers WHERE id = p_transfer_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'إذن التحويل غير موجود');
  END IF;

  IF v_transfer.status != 'draft' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'يجب أن يكون الإذن مسودة لتتمكن من جعله معلقاً');
  END IF;

  -- Verify Stock at Source (Only Verification, No Deduction happens here)
  FOR v_line IN
    SELECT * FROM public.warehouse_transfer_lines WHERE warehouse_transfer_id = p_transfer_id
  LOOP
    SELECT * INTO v_src_bal
    FROM public.stock_balances
    WHERE warehouse_id = v_transfer.source_warehouse_id AND item_id = v_line.item_id;

    IF NOT FOUND OR v_src_bal.quantity_on_hand < v_line.quantity THEN
      RETURN jsonb_build_object('ok', false, 'error', 'الرصيد المتاح غير كافٍ لأحد الأصناف في المخزن المُرسِل.');
    END IF;
  END LOOP;

  -- Change status to dispatched (Pending Flag)
  UPDATE public.warehouse_transfers
  SET
    status         = 'dispatched',
    dispatched_by  = auth.uid(),
    dispatched_at  = now(),
    updated_at     = now()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object('ok', true, 'message', 'تم اعتماد إذن التحويل ليصبح معلقاً، لن يخصم الرصيد إلا عند الاستلام.');
END;
$$;


-- ============================================================
-- RPC: receive_warehouse_transfer (Receiver Action - OUT & IN)
-- ============================================================
CREATE OR REPLACE FUNCTION public.receive_warehouse_transfer(p_transfer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer   public.warehouse_transfers%ROWTYPE;
  v_line       record;
  v_src_bal    public.stock_balances%ROWTYPE;
  v_dst_bal    public.stock_balances%ROWTYPE;
  v_unit_cost  numeric(18,6);
  v_total_val  numeric(18,2);
  v_src_qty    numeric(18,4);
  v_src_val    numeric(18,2);
  v_src_avg    numeric(18,6);
  v_dst_qty    numeric(18,4);
  v_dst_val    numeric(18,2);
  v_dst_avg    numeric(18,6);
BEGIN
  -- Lock row
  SELECT * INTO v_transfer FROM public.warehouse_transfers WHERE id = p_transfer_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'إذن التحويل غير موجود');
  END IF;

  IF v_transfer.status != 'dispatched' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'الإذن غير قابل للاستلام (إما لم يتم تعليقه بعد أو تم استلامه مسبقاً)');
  END IF;

  -- Process Both OUT (Source) and IN (Destination) simultaneously
  FOR v_line IN
    SELECT * FROM public.warehouse_transfer_lines WHERE warehouse_transfer_id = p_transfer_id
  LOOP
    -------------
    -- 1. Deduct from Source
    -------------
    SELECT * INTO v_src_bal
    FROM public.stock_balances
    WHERE warehouse_id = v_transfer.source_warehouse_id AND item_id = v_line.item_id
    FOR UPDATE;

    IF NOT FOUND OR v_src_bal.quantity_on_hand < v_line.quantity THEN
      RETURN jsonb_build_object('ok', false, 'error', 'لا يوجد رصيد كافٍ في المخزن المُرسِل أثناء الاستلام. يبدو أنه تم تخصيص أو صرف الكمية لعملية أخرى قبيل استلامك.');
    END IF;

    -- Use weighted average cost dynamically AT TIME OF RECEIPT
    v_unit_cost := COALESCE(v_src_bal.weighted_avg_cost, 0);
    v_total_val := ROUND(v_line.quantity * v_unit_cost, 2);

    -- Calculate new source stock
    v_src_qty := v_src_bal.quantity_on_hand - v_line.quantity;
    v_src_val := GREATEST(v_src_bal.total_value - v_total_val, 0);
    v_src_avg := CASE WHEN v_src_qty > 0 THEN ROUND(v_src_val / v_src_qty, 6) ELSE 0 END;

    -- Update Source Balance
    UPDATE public.stock_balances
    SET
      quantity_on_hand  = v_src_qty,
      total_value       = v_src_val,
      weighted_avg_cost = v_src_avg,
      last_movement_at  = now()
    WHERE warehouse_id = v_transfer.source_warehouse_id AND item_id = v_line.item_id;

    -- Append Ledger (OUT)
    INSERT INTO public.stock_ledger (
      warehouse_id, item_id, unit_id, project_id,
      movement_type, document_type, document_id, document_no,
      qty_in, qty_out, unit_cost, total_value,
      running_qty, running_value, movement_date, created_by
    ) VALUES (
      v_transfer.source_warehouse_id, v_line.item_id, v_line.unit_id, NULL,
      'out', 'warehouse_transfer', p_transfer_id, v_transfer.document_no,
      0, v_line.quantity, v_unit_cost, v_total_val,
      v_src_qty, v_src_val, v_transfer.transfer_date, auth.uid()
    );

    -- Store actual dispatched cost in the transfer line
    UPDATE public.warehouse_transfer_lines
    SET unit_cost = v_unit_cost
    WHERE id = v_line.id;

    -------------
    -- 2. Add to Destination
    -------------
    SELECT * INTO v_dst_bal
    FROM public.stock_balances
    WHERE warehouse_id = v_transfer.destination_warehouse_id AND item_id = v_line.item_id
    FOR UPDATE;

    IF NOT FOUND THEN
      -- Create initial record if it doesn't exist
      INSERT INTO public.stock_balances (
        warehouse_id, item_id,
        quantity_on_hand,
        total_value, weighted_avg_cost,
        last_movement_at
      ) VALUES (
        v_transfer.destination_warehouse_id, v_line.item_id,
        0, 0, 0, now()
      ) RETURNING * INTO v_dst_bal;
    END IF;

    v_dst_qty := v_dst_bal.quantity_on_hand + v_line.quantity;
    v_dst_val := v_dst_bal.total_value + v_total_val;
    v_dst_avg := CASE WHEN v_dst_qty > 0 THEN ROUND(v_dst_val / v_dst_qty, 6) ELSE 0 END;

    -- Update Dest Balance
    UPDATE public.stock_balances
    SET
      quantity_on_hand  = v_dst_qty,
      total_value       = v_dst_val,
      weighted_avg_cost = v_dst_avg,
      last_movement_at  = now()
    WHERE warehouse_id = v_transfer.destination_warehouse_id AND item_id = v_line.item_id;

    -- Append Ledger (IN)
    INSERT INTO public.stock_ledger (
      warehouse_id, item_id, unit_id, project_id,
      movement_type, document_type, document_id, document_no,
      qty_in, qty_out, unit_cost, total_value,
      running_qty, running_value, movement_date, created_by
    ) VALUES (
      v_transfer.destination_warehouse_id, v_line.item_id, v_line.unit_id, NULL,
      'in', 'warehouse_transfer', p_transfer_id, v_transfer.document_no,
      v_line.quantity, 0, v_unit_cost, v_total_val,
      v_dst_qty, v_dst_val, v_transfer.transfer_date, auth.uid()
    );
  END LOOP;

  -- Change status to confirmed (received)
  UPDATE public.warehouse_transfers
  SET
    status       = 'confirmed',
    received_by  = auth.uid(),
    received_at  = now(),
    confirmed_at = now(),
    confirmed_by = auth.uid(),
    updated_at   = now()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object('ok', true, 'message', 'تم الاقطاع من المخزن المنصرف، وإضافتها للمخزن المستلم بنجاح.');
END;
$$;

COMMIT;
