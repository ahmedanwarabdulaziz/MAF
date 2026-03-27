-- Migration: 011_fix_cutover_rpc.sql
-- Description: Fix ambiguous parameter

DROP FUNCTION IF EXISTS public.lock_cutover_batch(UUID);

CREATE OR REPLACE FUNCTION public.lock_cutover_batch(p_batch_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_batch RECORD;
    v_stock RECORD;
BEGIN
    -- Get batch info
    SELECT * INTO v_batch FROM public.cutover_batches WHERE id = p_batch_id;
    
    IF v_batch IS NULL THEN
        RAISE EXCEPTION 'Cutover batch not found';
    END IF;

    IF v_batch.status = 'locked' THEN
        RAISE EXCEPTION 'Batch is already locked';
    END IF;

    IF v_batch.status != 'approved' THEN
        RAISE EXCEPTION 'Batch must be approved before locking. Currently: %', v_batch.status;
    END IF;

    -- For each cutover stock, inject into live stock ledgers
    -- Currently using the basic stock_balances mechanism (direct upsert for now)
    FOR v_stock IN 
        SELECT 
           cws.warehouse_id, cws.item_id, cws.opening_quantity, cws.opening_value, cws.unit_cost
        FROM public.cutover_warehouse_stock cws
        WHERE cws.batch_id = p_batch_id
    LOOP
        INSERT INTO public.stock_balances (
            warehouse_id, item_id, quantity_on_hand, total_value, weighted_avg_cost, last_movement_at
        ) VALUES (
            v_stock.warehouse_id, v_stock.item_id, 
            v_stock.opening_quantity, v_stock.opening_value, v_stock.unit_cost, v_batch.cutover_date
        )
        ON CONFLICT (warehouse_id, item_id) DO UPDATE SET
            quantity_on_hand = public.stock_balances.quantity_on_hand + EXCLUDED.quantity_on_hand,
            total_value = public.stock_balances.total_value + EXCLUDED.total_value,
            weighted_avg_cost = CASE 
                WHEN (public.stock_balances.quantity_on_hand + EXCLUDED.quantity_on_hand) > 0 
                THEN (public.stock_balances.total_value + EXCLUDED.total_value) / (public.stock_balances.quantity_on_hand + EXCLUDED.quantity_on_hand)
                ELSE 0 END,
            last_movement_at = EXCLUDED.last_movement_at,
            updated_at = timezone('utc', now());
    END LOOP;

    -- Lock it
    UPDATE public.cutover_batches
    SET status = 'locked',
        locked_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    WHERE id = p_batch_id;

    RETURN json_build_object('success', true, 'message', 'Batch locked and propagated successfully');
END;
$$;
