-- ============================================================
-- MAF System — Full Data Reset Script
-- Purpose  : Delete ALL business data, keep only a@a.com
-- Run in   : Supabase SQL Editor (as postgres / service role)
-- WARNING  : IRREVERSIBLE. Back up before running.
-- ============================================================

-- Step 0: capture the auth UID we want to KEEP
DO $$
DECLARE
  keep_uid uuid;
BEGIN
  SELECT id INTO keep_uid FROM auth.users WHERE email = 'a@a.com';
  IF keep_uid IS NULL THEN
    RAISE EXCEPTION 'User a@a.com not found in auth.users — aborting!';
  END IF;
END $$;

-- ============================================================
-- LAYER 1 — Deepest leaf tables (no children)
-- ============================================================

-- Payments & Settlement
TRUNCATE TABLE public.payment_allocations          CASCADE;
TRUNCATE TABLE public.payment_voucher_parties      CASCADE;

-- Subcontractor certs — deepest children
TRUNCATE TABLE public.subcontractor_retention_releases    CASCADE;
TRUNCATE TABLE public.subcontractor_certificate_deductions CASCADE;
TRUNCATE TABLE public.subcontractor_certificate_allowances CASCADE;
TRUNCATE TABLE public.subcontractor_certificate_lines     CASCADE;

-- Supplier procurement — deepest children
TRUNCATE TABLE public.supplier_return_invoice_lines       CASCADE;
TRUNCATE TABLE public.supplier_invoice_lines              CASCADE;
TRUNCATE TABLE public.purchase_order_lines                CASCADE;
TRUNCATE TABLE public.purchase_request_lines              CASCADE;
TRUNCATE TABLE public.invoice_receipt_confirmation_users  CASCADE;

-- Owner billing — deepest children
TRUNCATE TABLE public.owner_billing_source_links   CASCADE;
TRUNCATE TABLE public.owner_billing_lines          CASCADE;
TRUNCATE TABLE public.owner_collections            CASCADE;

-- Custody & petty expenses
TRUNCATE TABLE public.petty_expense_attachments    CASCADE;
TRUNCATE TABLE public.petty_expenses               CASCADE;
TRUNCATE TABLE public.employee_custody_transactions CASCADE;

-- Warehouse movement lines
TRUNCATE TABLE public.stock_adjustment_lines       CASCADE;
TRUNCATE TABLE public.warehouse_transfer_lines     CASCADE;
TRUNCATE TABLE public.store_return_lines           CASCADE;
TRUNCATE TABLE public.store_issue_lines            CASCADE;
TRUNCATE TABLE public.goods_receipt_lines          CASCADE;

-- Cutover / migration detail
TRUNCATE TABLE public.project_opening_operational_entries CASCADE;
TRUNCATE TABLE public.project_opening_balance_entries     CASCADE;

-- Workflow runtime detail
TRUNCATE TABLE public.workflow_actions             CASCADE;
TRUNCATE TABLE public.workflow_instance_steps      CASCADE;

-- Audit detail
TRUNCATE TABLE public.entity_change_logs           CASCADE;
TRUNCATE TABLE public.attachment_access_logs       CASCADE;
TRUNCATE TABLE public.attachment_links             CASCADE;
TRUNCATE TABLE public.attachments                  CASCADE;
TRUNCATE TABLE public.audit_logs                   CASCADE;

-- Number sequences counters
TRUNCATE TABLE public.number_sequence_counters     CASCADE;

-- ============================================================
-- LAYER 2 — Mid-level documents / parent records
-- ============================================================

TRUNCATE TABLE public.payment_vouchers             CASCADE;
TRUNCATE TABLE public.subcontractor_certificates   CASCADE;
TRUNCATE TABLE public.subcontract_agreement_lines  CASCADE;
TRUNCATE TABLE public.subcontract_agreements       CASCADE;
TRUNCATE TABLE public.supplier_return_invoices     CASCADE;
TRUNCATE TABLE public.supplier_invoices            CASCADE;
TRUNCATE TABLE public.invoice_receipt_confirmations CASCADE;
TRUNCATE TABLE public.purchase_orders              CASCADE;
TRUNCATE TABLE public.purchase_requests            CASCADE;
TRUNCATE TABLE public.owner_billing_documents      CASCADE;
TRUNCATE TABLE public.employee_custody_accounts    CASCADE;

-- Stock movement headers
TRUNCATE TABLE public.stock_adjustments            CASCADE;
TRUNCATE TABLE public.warehouse_transfers          CASCADE;
TRUNCATE TABLE public.store_returns                CASCADE;
TRUNCATE TABLE public.store_issues                 CASCADE;
TRUNCATE TABLE public.goods_receipts               CASCADE;

-- Stock state
TRUNCATE TABLE public.stock_balances               CASCADE;
TRUNCATE TABLE public.stock_ledger                 CASCADE;

-- Cutover migration batch
TRUNCATE TABLE public.project_migration_batches    CASCADE;

-- Workflow instances
TRUNCATE TABLE public.workflow_instances           CASCADE;

-- Financial transactions & accounts
TRUNCATE TABLE public.financial_transactions       CASCADE;
TRUNCATE TABLE public.financial_account_balances   CASCADE;
TRUNCATE TABLE public.financial_accounts           CASCADE;

-- Number sequences headers
TRUNCATE TABLE public.number_sequences             CASCADE;

-- ============================================================
-- LAYER 3 — Core project-level master data
-- ============================================================

TRUNCATE TABLE public.project_work_item_units      CASCADE;
TRUNCATE TABLE public.project_work_items           CASCADE;
TRUNCATE TABLE public.project_party_contacts       CASCADE;
TRUNCATE TABLE public.project_parties              CASCADE;
TRUNCATE TABLE public.project_budget_lines         CASCADE;
TRUNCATE TABLE public.project_budget_headers       CASCADE;
TRUNCATE TABLE public.project_funding_movements    CASCADE;
TRUNCATE TABLE public.project_allocations          CASCADE;

-- Item & warehouse master
TRUNCATE TABLE public.item_cost_profiles           CASCADE;
TRUNCATE TABLE public.item_units                   CASCADE;
TRUNCATE TABLE public.items                        CASCADE;
TRUNCATE TABLE public.item_groups                  CASCADE;
TRUNCATE TABLE public.warehouses                   CASCADE;

-- ============================================================
-- LAYER 4 — Company-level master data
-- ============================================================

TRUNCATE TABLE public.party_contacts               CASCADE;
TRUNCATE TABLE public.party_role_accounts          CASCADE;
TRUNCATE TABLE public.party_roles                  CASCADE;
TRUNCATE TABLE public.parties                      CASCADE;

TRUNCATE TABLE public.corporate_expense_payments   CASCADE;
TRUNCATE TABLE public.corporate_expense_claims     CASCADE;
TRUNCATE TABLE public.expense_items                CASCADE;
TRUNCATE TABLE public.expense_groups               CASCADE;

TRUNCATE TABLE public.asset_movements              CASCADE;
TRUNCATE TABLE public.assets                       CASCADE;
TRUNCATE TABLE public.asset_categories             CASCADE;

TRUNCATE TABLE public.workflow_definition_step_roles CASCADE;
TRUNCATE TABLE public.workflow_definition_steps    CASCADE;
TRUNCATE TABLE public.workflow_definitions         CASCADE;

TRUNCATE TABLE public.cost_centers                 CASCADE;
TRUNCATE TABLE public.projects                     CASCADE;

-- ============================================================
-- LAYER 5 — Access control tables
--           Keep the row for a@a.com, delete everything else
-- ============================================================

TRUNCATE TABLE public.approval_delegations            CASCADE;
TRUNCATE TABLE public.warehouse_user_assignments      CASCADE;
TRUNCATE TABLE public.project_user_assignments        CASCADE;
TRUNCATE TABLE public.user_access_scopes              CASCADE;
TRUNCATE TABLE public.user_permission_group_assignments CASCADE;
TRUNCATE TABLE public.user_role_assignments           CASCADE;
TRUNCATE TABLE public.permission_group_permissions    CASCADE;
TRUNCATE TABLE public.permissions                     CASCADE;
TRUNCATE TABLE public.permission_groups               CASCADE;
TRUNCATE TABLE public.roles                           CASCADE;

-- Delete all user rows EXCEPT the super admin
DELETE FROM public.users
WHERE auth_user_id != (SELECT id FROM auth.users WHERE email = 'a@a.com');

-- ============================================================
-- LAYER 6 — Company record (keep, just confirming it exists)
-- ============================================================
-- We deliberately do NOT truncate `companies` —
-- the single company row is config, not test data.
-- If you also want to clear it, uncomment the line below.
-- TRUNCATE TABLE public.companies CASCADE;

-- ============================================================
-- Done
-- ============================================================
SELECT 'Reset complete. Only a@a.com remains.' AS result;
