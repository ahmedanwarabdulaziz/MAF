-- Migration: 043_advance_payments.sql
-- دفعات مقدمة للموردين والمقاولين (بدون ارتباط بفاتورة محددة)

BEGIN;

-- نضيف عمود payment_type للتمييز بين سند صرف عادي ودفعة مقدمة
ALTER TABLE public.payment_vouchers
  ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'regular'
    CHECK (payment_type IN ('regular', 'advance'));

COMMENT ON COLUMN public.payment_vouchers.payment_type IS
  'v043: regular = سند صرف مرتبط بمستحقات | advance = دفعة مقدمة لمورد/مقاول';

-- جدول تتبع أرصدة الدفعات المقدمة المتبقية لكل طرف/مشروع
-- يسهّل معرفة كم تبقى من الدفعة المقدمة لكل مورد أو مقاول
CREATE TABLE IF NOT EXISTS public.party_advance_balances (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id        uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  party_id          uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  party_type        text NOT NULL CHECK (party_type IN ('supplier', 'contractor')),
  total_advanced    numeric(18,2) NOT NULL DEFAULT 0,  -- إجمالي ما دُفع مقدماً
  total_deducted    numeric(18,2) NOT NULL DEFAULT 0,  -- ما تم خصمه حتى الآن
  balance_remaining numeric(18,2) GENERATED ALWAYS AS (total_advanced - total_deducted) STORED,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_advance_balance_party
  ON public.party_advance_balances(company_id, project_id, party_id, party_type);

COMMENT ON TABLE public.party_advance_balances IS
  'v043: رصيد الدفعات المقدمة لكل مورد/مقاول لكل مشروع';

-- RLS على جدول الأرصدة
ALTER TABLE public.party_advance_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advance_balances_company_isolation" ON public.party_advance_balances
  FOR ALL USING (company_id = (SELECT auth.jwt() ->> 'company_id')::uuid);

COMMIT;
