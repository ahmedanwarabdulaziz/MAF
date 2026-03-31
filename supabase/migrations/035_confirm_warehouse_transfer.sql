-- ============================================================
-- Migration 035: Confirm Warehouse Transfer RPC
-- ============================================================
-- 1. Creates `confirm_warehouse_transfer(uuid)` RPC.
-- 2. Decreases stock from source warehouse, updates stock_ledger.
-- 3. Increases stock in destination warehouse, updates stock_ledger.
-- 4. Marks transfer as 'confirmed'.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.confirm_warehouse_transfer(p_transfer_id uuid)
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
  
  -- Variables for Source (OUT)
  v_unit_cost  numeric(18,6);
  v_total_val  numeric(18,2);
  v_src_qty    numeric(18,4);
  v_src_val    numeric(18,2);
  v_src_avg    numeric(18,6);
  
  -- Variables for Destination (IN)
  v_dst_qty    numeric(18,4);
  v_dst_val    numeric(18,2);
  v_dst_avg    numeric(18,6);
  
  -- running totals
  v_run_qty    numeric(18,4);
  v_run_val    numeric(18,2);
BEGIN
  -- Lock the transfer row
  SELECT * INTO v_transfer FROM public.warehouse_transfers WHERE id = p_transfer_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'إذن التحويل غير موجود');
  END IF;

  IF v_transfer.status != 'draft' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'لا يمكن اعتماد إذن تحويل معتمد أو ملغي');
  END IF;

  -- Process each line
  FOR v_line IN
    SELECT * FROM public.warehouse_transfer_lines WHERE warehouse_transfer_id = p_transfer_id
  LOOP
    -- ==========================================
    -- 1. SOURCE WAREHOUSE (Deduct Stock)
    -- ==========================================
    SELECT * INTO v_src_bal
    FROM public.stock_balances
    WHERE warehouse_id = v_transfer.source_warehouse_id AND item_id = v_line.item_id
    FOR UPDATE;

    IF NOT FOUND OR v_src_bal.quantity_on_hand < v_line.quantity THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'الرصيد غير كافٍ لأحد الأصناف في المخزن المرسل. تحقق من الكميات قبل الاعتماد.'
      );
    END IF;

    -- Use weighted average cost at time of issue from source
    v_unit_cost := COALESCE(v_src_bal.weighted_avg_cost, 0);
    v_total_val := ROUND(v_line.quantity * v_unit_cost, 2);

    -- Update the transfer line with the captured cost (unit_cost)
    UPDATE public.warehouse_transfer_lines
    SET unit_cost = v_unit_cost
    WHERE id = v_line.id;

    -- Calculate new source stock
    v_src_qty := v_src_bal.quantity_on_hand - v_line.quantity;
    v_src_val := GREATEST(v_src_bal.total_value - v_total_val, 0);
    v_src_avg := CASE
                   WHEN v_src_qty > 0 THEN ROUND(v_src_val / v_src_qty, 6)
                   ELSE 0
                 END;

    -- Update Source Balance
    UPDATE public.stock_balances
    SET
      quantity_on_hand  = v_src_qty,
      total_value       = v_src_val,
      weighted_avg_cost = v_src_avg,
      last_movement_at  = now(),
      updated_at        = now()
    WHERE warehouse_id = v_transfer.source_warehouse_id AND item_id = v_line.item_id;

    -- Append to stock_ledger (Source OUT)
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


    -- ==========================================
    -- 2. DESTINATION WAREHOUSE (Add Stock)
    -- ==========================================
    SELECT * INTO v_dst_bal
    FROM public.stock_balances
    WHERE warehouse_id = v_transfer.destination_warehouse_id AND item_id = v_line.item_id
    FOR UPDATE;

    IF NOT FOUND THEN
      -- Create initial balance record if destination never had this item
      INSERT INTO public.stock_balances (
        company_id, warehouse_id, item_id,
        quantity_on_hand,
        total_value, weighted_avg_cost,
        last_movement_at
      ) VALUES (
        v_transfer.company_id, v_transfer.destination_warehouse_id, v_line.item_id,
        0,
        0, 0,
        now()
      ) RETURNING * INTO v_dst_bal;
    END IF;

    -- Calculate new destination stock (cost transfers perfectly to destination)
    v_dst_qty := v_dst_bal.quantity_on_hand + v_line.quantity;
    v_dst_val := v_dst_bal.total_value + v_total_val;
    v_dst_avg := CASE
                   WHEN v_dst_qty > 0 THEN ROUND(v_dst_val / v_dst_qty, 6)
                   ELSE 0
                 END;

    -- Update Destination Balance
    UPDATE public.stock_balances
    SET
      quantity_on_hand  = v_dst_qty,
      total_value       = v_dst_val,
      weighted_avg_cost = v_dst_avg,
      last_movement_at  = now(),
      updated_at        = now()
    WHERE warehouse_id = v_transfer.destination_warehouse_id AND item_id = v_line.item_id;

    -- Append to stock_ledger (Destination IN)
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

  -- Mark the transfer as confirmed
  UPDATE public.warehouse_transfers
  SET
    status       = 'confirmed',
    updated_at   = now()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object('ok', true, 'message', 'تم اعتماد إذن التحويل ونقل الأرصدة بنجاح');
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_warehouse_transfer(uuid) TO authenticated;

COMMIT;
