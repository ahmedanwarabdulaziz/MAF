-- Migration: 048_payment_method_offset.sql
-- Enables 'offset' as a valid payment method for advance settlements

BEGIN;

ALTER TABLE public.payment_vouchers DROP CONSTRAINT IF EXISTS payment_vouchers_payment_method_check;
ALTER TABLE public.payment_vouchers ADD CONSTRAINT payment_vouchers_payment_method_check 
  CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque', 'credit_card', 'offset'));

COMMENT ON COLUMN public.payment_vouchers.payment_method IS
  'cash, bank_transfer, cheque, credit_card, offset (for advance settlements vs invoices)';

COMMIT;
