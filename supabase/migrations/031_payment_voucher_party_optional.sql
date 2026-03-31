-- Migration: 031_payment_voucher_party_optional.sql
-- Description: Allow payment voucher parties to have a null party_id for general expenses without a registered supplier.

BEGIN;

ALTER TABLE public.payment_voucher_parties ALTER COLUMN party_id DROP NOT NULL;

COMMIT;
