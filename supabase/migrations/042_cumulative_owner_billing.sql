-- Migration: 042_cumulative_owner_billing.sql
-- تحويل فواتير المالك إلى نظام تراكمي + نسبة الصرف

BEGIN;

-- 1. ربط كل فاتورة بالفاتورة السابقة المعتمدة
ALTER TABLE public.owner_billing_documents
  ADD COLUMN IF NOT EXISTS previous_doc_id UUID
    REFERENCES public.owner_billing_documents(id) ON DELETE SET NULL;

-- 1b. اهلاك الدفعة المقدمة في هذا المستخلص
ALTER TABLE public.owner_billing_documents
  ADD COLUMN IF NOT EXISTS advance_deduction NUMERIC(18,4) NOT NULL DEFAULT 0;

-- 2. start_date تصبح nullable
ALTER TABLE public.owner_billing_documents
  ALTER COLUMN start_date DROP NOT NULL;

-- 3. نسبة الصرف على مستوى البند (مثل مستخلصات المقاول)
ALTER TABLE public.owner_billing_lines
  ADD COLUMN IF NOT EXISTS disbursement_rate  NUMERIC(6,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS cumulative_amount  NUMERIC(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cumulative_entitled NUMERIC(18,4) NOT NULL DEFAULT 0;

-- 4. تحديث البيانات الموجودة: افتراض 100% (لا خصم)
UPDATE public.owner_billing_lines
SET
  disbursement_rate   = 100,
  cumulative_amount   = COALESCE(cumulative_quantity, quantity) * COALESCE(unit_price, 0),
  cumulative_entitled = COALESCE(cumulative_quantity, quantity) * COALESCE(unit_price, 0)
WHERE disbursement_rate = 100;

-- ===================================================================
-- 5. إضافة عمودي الخزينة ونوع التحصيل في owner_collections
-- ===================================================================

-- 5a. الحساب المالي (خزينة / بنك) الذي استُلم فيه المبلغ
ALTER TABLE public.owner_collections
  ADD COLUMN IF NOT EXISTS financial_account_id UUID
    REFERENCES public.financial_accounts(id) ON DELETE SET NULL;

-- 5b. نوع التحصيل: عادي أو دفعة مقدمة
--     'regular'  = تحصيل مقابل مستخلص معتمد
--     'advance'  = دفعة مقدمة تُهلَك على المستخلصات اللاحقة
ALTER TABLE public.owner_collections
  ADD COLUMN IF NOT EXISTS collection_type TEXT NOT NULL DEFAULT 'regular'
    CHECK (collection_type IN ('regular', 'advance'));

-- تعليقات
COMMENT ON COLUMN public.owner_collections.financial_account_id IS
  'v042: الحساب المالي (خزينة/بنك) التي استُلم فيه المبلغ';
COMMENT ON COLUMN public.owner_collections.collection_type IS
  'v042: regular = تحصيل عادي | advance = دفعة مقدمة';

-- تعليقات أعمدة الفواتير
COMMENT ON COLUMN public.owner_billing_documents.previous_doc_id IS
  'v042: الفاتورة المعتمدة السابقة — مرجع التراكم';
COMMENT ON COLUMN public.owner_billing_lines.disbursement_rate IS
  'v042: نسبة الصرف % — entitled = cumulative_amount × (rate/100)';
COMMENT ON COLUMN public.owner_billing_lines.cumulative_amount IS
  'v042: cumulative_quantity × unit_price';
COMMENT ON COLUMN public.owner_billing_lines.cumulative_entitled IS
  'v042: cumulative_amount × (disbursement_rate / 100)';

COMMIT;
