-- Migration 062: Backfill missing project_id for financial transactions

-- 1. Owner Collections & Advances
UPDATE public.financial_transactions ft
SET project_id = oc.project_id
FROM public.owner_collections oc
WHERE ft.reference_type IN ('owner_collection', 'owner_advance')
  AND ft.reference_id = oc.id
  AND ft.project_id IS NULL;

-- 2. Payment Vouchers
UPDATE public.financial_transactions ft
SET project_id = pv.project_id
FROM public.payment_vouchers pv
WHERE ft.reference_type = 'payment_voucher'
  AND ft.reference_id = pv.id
  AND ft.project_id IS NULL
  AND pv.project_id IS NOT NULL;
