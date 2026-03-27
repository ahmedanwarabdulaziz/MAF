-- ============================================================
-- P14 Migration 015: Owner Billing and Collections
-- ============================================================

-- 1. Owner Billing Documents
CREATE TABLE IF NOT EXISTS public.owner_billing_documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  owner_party_id      uuid NOT NULL REFERENCES public.parties(id),
  document_no         text NOT NULL,
  document_type       text NOT NULL DEFAULT 'invoice', -- 'invoice', 'credit_note'
  billing_date        date NOT NULL,
  status              text NOT NULL DEFAULT 'draft', -- 'draft', 'submitted', 'approved', 'paid', 'cancelled'
  gross_amount        numeric(18,2) NOT NULL DEFAULT 0,
  tax_amount          numeric(18,2) NOT NULL DEFAULT 0,
  net_amount          numeric(18,2) NOT NULL DEFAULT 0,
  notes               text,
  created_by          uuid REFERENCES public.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  archived_at         timestamptz,
  archived_by         uuid REFERENCES public.users(id)
);

-- 2. Owner Billing Lines
CREATE TABLE IF NOT EXISTS public.owner_billing_lines (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_billing_document_id   uuid NOT NULL REFERENCES public.owner_billing_documents(id) ON DELETE CASCADE,
  line_description            text NOT NULL,
  unit_id                     uuid REFERENCES public.item_units(id),
  quantity                    numeric(18,4) NOT NULL DEFAULT 1,
  unit_price                  numeric(18,2) NOT NULL DEFAULT 0,
  line_gross                  numeric(18,2) NOT NULL DEFAULT 0,
  line_net                    numeric(18,2) NOT NULL DEFAULT 0,
  notes                       text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- 3. Owner Billing Source Links
CREATE TABLE IF NOT EXISTS public.owner_billing_source_links (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_billing_line_id       uuid NOT NULL REFERENCES public.owner_billing_lines(id) ON DELETE CASCADE,
  source_type                 text NOT NULL, -- 'supplier_invoice_line', 'subcontractor_certificate_line', 'stock_issue_line'
  source_reference_id         uuid NOT NULL,
  allocated_quantity          numeric(18,4) NOT NULL,
  allocated_cost              numeric(18,2) NOT NULL,
  notes                       text,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

-- 4. Owner Collections
CREATE TABLE IF NOT EXISTS public.owner_collections (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_id                  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  owner_billing_document_id   uuid REFERENCES public.owner_billing_documents(id) ON DELETE SET NULL,
  owner_party_id              uuid NOT NULL REFERENCES public.parties(id),
  received_amount             numeric(18,2) NOT NULL,
  received_date               date NOT NULL,
  payment_method              text NOT NULL, -- 'cash', 'bank_transfer', 'cheque'
  reference_no                text,
  notes                       text,
  created_by                  uuid REFERENCES public.users(id),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  archived_at                 timestamptz
);

-- 5. Owner Receivables View
CREATE OR REPLACE VIEW public.owner_receivables_view AS
SELECT 
  p.id AS project_id,
  p.company_id,
  o.id AS owner_party_id,
  o.arabic_name AS owner_name,
  -- Sum up all approved net billing docs
  COALESCE((
    SELECT SUM(obd.net_amount)
    FROM public.owner_billing_documents obd
    WHERE obd.project_id = p.id
      AND obd.status IN ('approved')
      AND obd.archived_at IS NULL
  ), 0) AS total_billed,
  -- Sum up all collections
  COALESCE((
    SELECT SUM(oc.received_amount)
    FROM public.owner_collections oc
    WHERE oc.project_id = p.id
      AND oc.archived_at IS NULL
  ), 0) AS total_collected,
  -- Outstanding Balance
  (
    COALESCE((
      SELECT SUM(obd.net_amount)
      FROM public.owner_billing_documents obd
      WHERE obd.project_id = p.id
        AND obd.status IN ('approved')
        AND obd.archived_at IS NULL
    ), 0)
    -
    COALESCE((
      SELECT SUM(oc.received_amount)
      FROM public.owner_collections oc
      WHERE oc.project_id = p.id
        AND oc.archived_at IS NULL
    ), 0)
  ) AS total_outstanding
FROM public.projects p
JOIN public.parties o ON p.owner_party_id = o.id
WHERE p.archived_at IS NULL;

-- 6. Row Level Security Setup
ALTER TABLE public.owner_billing_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_billing_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_billing_source_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_billing_documents_tenant_isolation" ON public.owner_billing_documents
  FOR ALL USING (company_id = (SELECT auth.jwt() ->> 'company_id')::uuid);

CREATE POLICY "owner_billing_lines_tenant_isolation" ON public.owner_billing_lines
  FOR ALL USING (
    owner_billing_document_id IN (
      SELECT id FROM public.owner_billing_documents 
      WHERE company_id = (SELECT auth.jwt() ->> 'company_id')::uuid
    )
  );

CREATE POLICY "owner_billing_source_links_tenant_isolation" ON public.owner_billing_source_links
  FOR ALL USING (
    owner_billing_line_id IN (
      SELECT id FROM public.owner_billing_lines 
      WHERE owner_billing_document_id IN (
        SELECT id FROM public.owner_billing_documents 
        WHERE company_id = (SELECT auth.jwt() ->> 'company_id')::uuid
      )
    )
  );

CREATE POLICY "owner_collections_tenant_isolation" ON public.owner_collections
  FOR ALL USING (company_id = (SELECT auth.jwt() ->> 'company_id')::uuid);
