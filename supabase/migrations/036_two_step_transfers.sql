-- ============================================================
-- Migration 036: Two-Step Warehouse Transfers (Multi-Step)
-- ============================================================
-- 1. Alters warehouse_transfers to add 'dispatched' status and logging cols
-- 2. Creates dispatch_warehouse_transfer(uuid) -> deducts from source
-- 3. Creates receive_warehouse_transfer(uuid) -> adds to destination
-- ============================================================

BEGIN;

-- Drop previous single-step RPC (if it got generated we clean it up)
DROP FUNCTION IF EXISTS public.confirm_warehouse_transfer(uuid);

-- Let's dynamically drop the check constraint on 'status'
DO $$
DECLARE v_con text;
BEGIN
    -- This relies on the convention table_column_check or looking it up
    SELECT constraint_name INTO v_con 
    FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%warehouse_transfers_status_check%';
    
    IF v_con IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.warehouse_transfers DROP CONSTRAINT ' || v_con;
    END IF;
END $$;

-- Expand the statuses allowed to include 'dispatched'
ALTER TABLE public.warehouse_transfers
  ADD CONSTRAINT warehouse_transfers_status_check
  CHECK (status IN ('draft', 'dispatched', 'confirmed', 'cancelled'));

-- Add tracking columns
ALTER TABLE public.warehouse_transfers
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatched_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS received_by uuid REFERENCES public.users(id);


-- ============================================================
-- RPC: dispatch_warehouse_transfer (Sender Action)
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
  v_unit_cost  numeric(18,6);
  v_total_val  numeric(18,2);
  v_src_qty    numeric(18,4);
  v_src_val    numeric(18,2);
  v_src_avg    numeric(18,6);
BEGIN
  -- Lock the transfer row
  SELECT * INTO v_transfer FROM public.warehouse_transfers WHERE id = p_transfer_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'إذن التحويل غير موجود');
  END IF;

  IF v_transfer.status != 'draft' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'يجب أن يكون الإذن مسودة لتتمكن من صرفه');
  END IF;

  -- Deduct Stock from Source
  FOR v_line IN
    SELECT * FROM public.warehouse_transfer_lines WHERE warehouse_transfer_id = p_transfer_id
  LOOP
    SELECT * INTO v_src_bal
    FROM public.stock_balances
    WHERE warehouse_id = v_transfer.source_warehouse_id AND item_id = v_line.item_id
    FOR UPDATE;

    IF NOT FOUND OR v_src_bal.quantity_on_hand < v_line.quantity THEN
      RETURN jsonb_build_object('ok', false, 'error', 'الرصيد غير كافٍ لأحد الأصناف في المخزن المرسل. يرجى التحقق من توفر الكمية.');
    END IF;

    -- Use weighted average cost
    v_unit_cost := COALESCE(v_src_bal.weighted_avg_cost, 0);
    v_total_val := ROUND(v_line.quantity * v_unit_cost, 2);

    -- Store cost in the line for when it gets received
    UPDATE public.warehouse_transfer_lines
    SET unit_cost = v_unit_cost
    WHERE id = v_line.id;

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
  END LOOP;

  -- Change status to dispatched
  UPDATE public.warehouse_transfers
  SET
    status         = 'dispatched',
    dispatched_by  = auth.uid(),
    dispatched_at  = now(),
    updated_at     = now()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object('ok', true, 'message', 'تم صرف الكمية بنجاح وهي الآن في الطريق');
END;
$$;


-- ============================================================
-- RPC: receive_warehouse_transfer (Receiver Action)
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
  v_dst_bal    public.stock_balances%ROWTYPE;
  v_total_val  numeric(18,2);
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
    RETURN jsonb_build_object('ok', false, 'error', 'الإذن غير قابل للاستلام (إما لم يتم صرفه بعد أو تم استلامه مسبقاً)');
  END IF;

  -- Add Stock to Destination
  FOR v_line IN
    SELECT * FROM public.warehouse_transfer_lines WHERE warehouse_transfer_id = p_transfer_id
  LOOP
    v_total_val := ROUND(v_line.quantity * COALESCE(v_line.unit_cost, 0), 2);

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
      v_line.quantity, 0, COALESCE(v_line.unit_cost, 0), v_total_val,
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

  RETURN jsonb_build_object('ok', true, 'message', 'تم استلام الصنف بنجاح وإغلاق إذن التحويل');
END;
$$;


GRANT EXECUTE ON FUNCTION public.dispatch_warehouse_transfer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_warehouse_transfer(uuid) TO authenticated;

COMMIT;
