-- Migration: 023_subcontractor_workflow_redesign.sql
-- Description: Adds pricing to BOQ items and removes explicit lines from Subcontract Agreements

BEGIN;

-- 1. Add Pricing to Project Work Items (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'project_work_items' AND column_name = 'owner_price') THEN
        ALTER TABLE public.project_work_items ADD COLUMN owner_price DECIMAL(18,4) NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'project_work_items' AND column_name = 'subcontractor_price') THEN
        ALTER TABLE public.project_work_items ADD COLUMN subcontractor_price DECIMAL(18,4) NOT NULL DEFAULT 0;
    END IF;
END $$;

-- 2. Drop Subcontract Agreement Lines 
-- (Agreements will now use BOQ items directly via cumulative certificates)
DROP TABLE IF EXISTS public.subcontract_agreement_lines CASCADE;

COMMIT;
