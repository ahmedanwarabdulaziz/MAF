-- Migration 040: Owner Billing Enhancements

BEGIN;

-- 1. Add fields to owner_billing_lines
ALTER TABLE public.owner_billing_lines
  ADD COLUMN IF NOT EXISTS previous_quantity NUMERIC(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cumulative_quantity NUMERIC(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_material_on_site BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_description TEXT;

-- 1.1 Add fields to owner_billing_documents
ALTER TABLE public.owner_billing_documents
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE;

-- 2. Update existing rows
UPDATE public.owner_billing_lines
SET cumulative_quantity = quantity
WHERE cumulative_quantity = 0 AND quantity > 0;

-- 3. Custom sequence generator for Owner Billing linking to Project Code
CREATE OR REPLACE FUNCTION public.assign_owner_billing_document_no()
RETURNS TRIGGER AS $$
DECLARE
    v_project_code TEXT;
    v_prefix TEXT;
    v_next_val BIGINT;
BEGIN
    IF NEW.document_no IS NULL OR NEW.document_no = '' OR NEW.document_no = 'تلقائي' OR NEW.document_no LIKE 'BILL-%' OR NEW.document_no LIKE 'INV-%' THEN
        
        -- Get project code
        SELECT project_code INTO v_project_code FROM public.projects WHERE id = NEW.project_id;
        IF v_project_code IS NULL OR v_project_code = '' THEN
            v_project_code := 'PRJ';
        END IF;

        v_prefix := 'INV-' || v_project_code;

        -- We insert into document_sequences using that prefix
        INSERT INTO public.document_sequences (company_id, document_type, prefix, current_value)
        VALUES (NEW.company_id, 'BILL', v_prefix, 1)
        ON CONFLICT (company_id, document_type, prefix)
        DO UPDATE SET 
            current_value = public.document_sequences.current_value + 1,
            updated_at = NOW()
        RETURNING current_value INTO v_next_val;

        -- Format INV-PROJCODE-0001
        NEW.document_no := v_prefix || '-' || LPAD(v_next_val::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the generic trigger and attach the custom one
DROP TRIGGER IF EXISTS tr_bill_seq ON public.owner_billing_documents;
DROP TRIGGER IF EXISTS tr_bill_seq_project ON public.owner_billing_documents;
CREATE TRIGGER tr_bill_seq_project 
  BEFORE INSERT ON public.owner_billing_documents 
  FOR EACH ROW EXECUTE PROCEDURE public.assign_owner_billing_document_no();

COMMIT;
