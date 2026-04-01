-- Migration: 041_cumulative_certificates.sql
-- Description: Transforms subcontractor certificates from independent invoices to
-- cumulative progress certificates (البيان التراكمي).
--
-- KEY CHANGES:
--   1. subcontractor_certificates: add previous_cert_id linkage, make period_from nullable
--   2. subcontractor_certificate_lines: add cumulative_amount & previous_disbursed columns
--      taaliya_value now means "disbursement rate %" (نسبة الصرف)
--      taaliya_type is locked to 'percentage' going forward
--   3. Field semantics change (backward compat):
--      gross_line_amount  → stores cumulative_amount  (cumulative_qty × rate)
--      taaliya_amount     → stores retention per line  (cumulative_amount × (1 - rate%))
--      net_line_amount    → stores cumulative_entitled (cumulative_amount × rate%)
--      gross_amount (hdr) → Σ cumulative_amount
--      taaliya_amount (hdr)→ Σ retention (cumulative_amount - cumulative_entitled)
--      net_amount (hdr)   → Σ cumulative_entitled

BEGIN;

-- =========================================================================
-- 1.  CERTIFICATE HEADER — add linkage & make period_from optional
-- =========================================================================

-- Link to the immediately previous approved certificate for the same agreement
ALTER TABLE public.subcontractor_certificates
  ADD COLUMN IF NOT EXISTS previous_cert_id UUID
    REFERENCES public.subcontractor_certificates(id) ON DELETE SET NULL;

-- period_from is now derived from agreement.start_date in the application layer;
-- make it nullable so existing rows are untouched, new rows may leave it blank.
ALTER TABLE public.subcontractor_certificates
  ALTER COLUMN period_from DROP NOT NULL;

-- =========================================================================
-- 2.  CERTIFICATE LINES — add cumulative finance columns
-- =========================================================================

-- cumulative_amount: cumulative_qty × agreed_rate
--   (previously gross_line_amount was current_qty × rate — now repurposed)
ALTER TABLE public.subcontractor_certificate_lines
  ADD COLUMN IF NOT EXISTS cumulative_amount DECIMAL(18,4) NOT NULL DEFAULT 0;

-- previous_disbursed: the cumulative_entitled from the previous approved
--   certificate for this same work_item under this agreement.
--   Used to calculate "what's new in this certificate" at display time.
ALTER TABLE public.subcontractor_certificate_lines
  ADD COLUMN IF NOT EXISTS previous_disbursed DECIMAL(18,4) NOT NULL DEFAULT 0;

-- =========================================================================
-- 3.  NORMALISE taaliya_type — disbursement rate is always a percentage
-- =========================================================================

-- Any existing 'fixed_amount' rows used an absolute deduction per unit.
-- Under the new model taaliya_value is ALWAYS a percentage (0-100).
-- We convert fixed_amount rows to a sensible default (5%) so they don't break.
-- Admins can review & adjust post-migration.
UPDATE public.subcontractor_certificate_lines
SET
  taaliya_type  = 'percentage',
  taaliya_value = 90          -- safe default: 90 % disbursement (10 % retention)
WHERE taaliya_type = 'fixed_amount';

-- Also normalise at the agreement level
UPDATE public.subcontract_agreements
SET
  default_taaliya_type  = 'percentage',
  default_taaliya_value = 90
WHERE default_taaliya_type = 'fixed_amount';

-- =========================================================================
-- 4.  COMMENT the repurposed columns for future maintainers
-- =========================================================================

COMMENT ON COLUMN public.subcontractor_certificate_lines.gross_line_amount IS
  'REPURPOSED (v041): now stores cumulative_amount = cumulative_qty × agreed_rate';

COMMENT ON COLUMN public.subcontractor_certificate_lines.taaliya_value IS
  'REPURPOSED (v041): now stores disbursement_rate % (نسبة الصرف). '
  'cumulative_entitled = cumulative_amount × (taaliya_value / 100)';

COMMENT ON COLUMN public.subcontractor_certificate_lines.taaliya_amount IS
  'REPURPOSED (v041): now stores retention per line = cumulative_amount - cumulative_entitled';

COMMENT ON COLUMN public.subcontractor_certificate_lines.net_line_amount IS
  'REPURPOSED (v041): now stores cumulative_entitled = cumulative_amount × (taaliya_value / 100)';

COMMENT ON COLUMN public.subcontractor_certificates.gross_amount IS
  'REPURPOSED (v041): Σ cumulative_amount across all lines';

COMMENT ON COLUMN public.subcontractor_certificates.taaliya_amount IS
  'REPURPOSED (v041): Σ retention = Σ (cumulative_amount - cumulative_entitled)';

COMMENT ON COLUMN public.subcontractor_certificates.net_amount IS
  'REPURPOSED (v041): Σ cumulative_entitled = total contractor entitlement to date';

COMMENT ON COLUMN public.subcontractor_certificates.period_from IS
  'REPURPOSED (v041): nullable; populated from agreement.start_date in app layer. '
  'period_to remains the mandatory "as-of" date for this certificate.';

COMMIT;
