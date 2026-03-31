-- Migration: 030_company_purchases_supplier_optional.sql
-- Description: Makes the supplier_party_id field optional to support General Expenses without a supplier

BEGIN;

ALTER TABLE public.company_purchase_invoices
    ALTER COLUMN supplier_party_id DROP NOT NULL;

COMMIT;
