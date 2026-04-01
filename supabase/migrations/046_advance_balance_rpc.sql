-- Migration: 046_advance_balance_rpc.sql
-- Function to upsert advance payment balances securely

BEGIN;

CREATE OR REPLACE FUNCTION public.upsert_party_advance_balance(
  p_company_id uuid,
  p_project_id uuid,
  p_party_id uuid,
  p_party_type text,
  p_add_amount numeric
) RETURNS void AS $$
BEGIN
  -- Insert or update the advance balance tracker
  -- We assume (company_id, project_id, party_id, party_type) is unique.
  INSERT INTO public.party_advance_balances (
    company_id, 
    project_id, 
    party_id, 
    party_type, 
    total_advanced
  )
  VALUES (
    p_company_id, 
    p_project_id, 
    p_party_id, 
    p_party_type, 
    p_add_amount
  )
  ON CONFLICT (company_id, project_id, party_id, party_type) 
  DO UPDATE SET 
    total_advanced = public.party_advance_balances.total_advanced + EXCLUDED.total_advanced,
    updated_at = now();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.upsert_party_advance_balance IS
  'v046: Adds advance payment amounts to party advance tracking balances.';

COMMIT;
