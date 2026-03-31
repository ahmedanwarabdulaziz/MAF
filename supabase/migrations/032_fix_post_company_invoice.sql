-- Fix post_company_purchase_invoice to avoid accessing non-existent v_line.unit_id

CREATE OR REPLACE FUNCTION public.post_company_purchase_invoice(
      p_invoice_id UUID,
      p_user_id    UUID
  )
  RETURNS VOID AS $$
  DECLARE
      v_invoice RECORD;
      v_line    RECORD;
      v_movement_id UUID;
  BEGIN
      -- 1. Lock and fetch invoice
      SELECT * INTO v_invoice
      FROM public.company_purchase_invoices
      WHERE id = p_invoice_id FOR UPDATE;

      IF v_invoice IS NULL THEN
          RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
      END IF;

      IF v_invoice.status != 'draft' THEN
          RAISE EXCEPTION 'Invoice is already posted or cancelled (status: %)', v_invoice.status;
      END IF;

      -- 2. If stock_purchase: create a stock ledger entry for each line
      IF v_invoice.invoice_type = 'stock_purchase' THEN
          IF v_invoice.warehouse_id IS NULL THEN
              RAISE EXCEPTION 'Stock purchase invoice must have a warehouse assigned';
          END IF;

          FOR v_line IN
              SELECT cpil.*, i.primary_unit_id
              FROM public.company_purchase_invoice_lines cpil
              JOIN public.items i ON i.id = cpil.item_id
              WHERE cpil.invoice_id = p_invoice_id AND cpil.item_id IS NOT NULL
          LOOP
              DECLARE
                  v_running_qty NUMERIC;
                  v_running_val NUMERIC;
                  v_warehouse_project_id UUID;
              BEGIN
                  -- Get warehouse project_id if any
                  SELECT project_id INTO v_warehouse_project_id FROM public.warehouses WHERE id = v_invoice.warehouse_id;

                  -- Get current running totals
                  SELECT quantity_on_hand, total_value INTO v_running_qty, v_running_val
                  FROM public.stock_balances
                  WHERE warehouse_id = v_invoice.warehouse_id AND item_id = v_line.item_id;

                  v_running_qty := COALESCE(v_running_qty, 0) + v_line.quantity;
                  v_running_val := COALESCE(v_running_val, 0) + v_line.line_net;

                  -- Insert into stock_ledger
                  INSERT INTO public.stock_ledger (
                      warehouse_id,
                      item_id,
                      unit_id,
                      project_id,
                      movement_type,
                      document_type,
                      document_id,
                      document_line_id,
                      document_no,
                      qty_in,
                      qty_out,
                      unit_cost,
                      total_value,
                      running_qty,
                      running_value,
                      movement_date,
                      notes,
                      created_by
                  ) VALUES (
                      v_invoice.warehouse_id,
                      v_line.item_id,
                      v_line.primary_unit_id,
                      v_warehouse_project_id,
                      'in',
                      'goods_receipt',
                      v_invoice.id,
                      v_line.id,
                      v_invoice.invoice_no,
                      v_line.quantity,
                      0,
                      v_line.unit_price,
                      v_line.line_net,
                      v_running_qty,
                      v_running_val,
                      v_invoice.invoice_date,
                      'فاتورة مشتريات شركة رقم ' || v_invoice.invoice_no,
                      p_user_id
                  );

                  -- Update stock_balances
                  INSERT INTO public.stock_balances (warehouse_id, item_id, quantity_on_hand, total_value, weighted_avg_cost, last_movement_at)
                  VALUES (
                      v_invoice.warehouse_id, 
                      v_line.item_id, 
                      v_line.quantity, 
                      v_line.line_net, 
                      v_line.unit_price, 
                      now()
                  )
                  ON CONFLICT (warehouse_id, item_id)
                  DO UPDATE SET
                      quantity_on_hand = EXCLUDED.quantity_on_hand + stock_balances.quantity_on_hand,
                      total_value = EXCLUDED.total_value + stock_balances.total_value,
                      weighted_avg_cost = (EXCLUDED.total_value + stock_balances.total_value) / NULLIF(EXCLUDED.quantity_on_hand + stock_balances.quantity_on_hand, 0),
                      last_movement_at = now(),
                      updated_at = now();
              END;
          END LOOP;
      END IF;

      -- 3. Set outstanding amount and post
      UPDATE public.company_purchase_invoices
      SET
          outstanding_amount = net_amount - paid_to_date,
          status = 'posted',
          updated_at = now()
      WHERE id = p_invoice_id;

  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
