-- Migration: 050_supplier_receipt_discrepancies.sql
-- Description: Adds received_quantity and discrepancy_status to handle short shipments in supplier invoices

BEGIN;

-- 1. Add received_quantity to supplier_invoice_lines
ALTER TABLE public.supplier_invoice_lines
ADD COLUMN IF NOT EXISTS received_quantity DECIMAL(18,4) NOT NULL DEFAULT 0;

-- 2. Add discrepancy tracking to supplier_invoices
ALTER TABLE public.supplier_invoices
ADD COLUMN IF NOT EXISTS has_discrepancy BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS discrepancy_status VARCHAR(50) NOT NULL DEFAULT 'none'; -- none, pending, resolved

-- 3. Update existing records to assume full receipt for previously posted invoices
UPDATE public.supplier_invoice_lines
SET received_quantity = invoiced_quantity
WHERE invoiced_quantity > 0;

COMMIT;
