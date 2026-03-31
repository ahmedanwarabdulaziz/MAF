-- ============================================================
-- Migration 021: Store Issue Dual-Approval & Stock Confirmation
-- ============================================================
-- Adds pm_status / wm_status dual-approval columns to store_issues,
-- creates an approvals audit-log table, and a SECURITY DEFINER RPC
-- that confirms the issue: reads weighted_avg_cost, deducts stock_balances,
-- and appends an 'out' entry to stock_ledger.
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 0. Relax NOT NULL on store_issues.project_id so that the main
--    company warehouse can issue goods without a project context.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.store_issues ALTER COLUMN project_id DROP NOT NULL;


-- ─────────────────────────────────────────────────────────────
-- 1. Add dual-approval columns to store_issues
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.store_issues
  ADD COLUMN IF NOT EXISTS pm_status        text NOT NULL DEFAULT 'pending'
    CHECK (pm_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS wm_status        text NOT NULL DEFAULT 'pending'
    CHECK (wm_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS approved_by_pm   uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS approved_by_wm   uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS pm_approved_at   timestamptz,
  ADD COLUMN IF NOT EXISTS wm_approved_at   timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Change the status domain to include pending_approval
-- Existing CHECK: ('draft','confirmed','cancelled') – extend it:
ALTER TABLE public.store_issues
  DROP CONSTRAINT IF EXISTS store_issues_status_check;

ALTER TABLE public.store_issues
  ADD CONSTRAINT store_issues_status_check
    CHECK (status IN ('draft','pending_approval','confirmed','cancelled','rejected'));

-- ─────────────────────────────────────────────────────────────
-- 2. Approval audit log
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.store_issue_approvals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_issue_id   uuid NOT NULL REFERENCES public.store_issues(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES public.users(id),
  role_type        text NOT NULL CHECK (role_type IN ('pm','warehouse_manager')),
  action_taken     text NOT NULL CHECK (action_taken IN ('approved','rejected')),
  notes            text,
  action_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_issue_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_issue_approvals_read"    ON public.store_issue_approvals;
DROP POLICY IF EXISTS "store_issue_approvals_service"  ON public.store_issue_approvals;

CREATE POLICY "store_issue_approvals_read" ON public.store_issue_approvals
  FOR SELECT USING (auth.role() = 'authenticated');

-- Write is handled exclusively by the SECURITY DEFINER RPCs below
CREATE POLICY "store_issue_approvals_service" ON public.store_issue_approvals
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────
-- 3. Update RLS on store_issues so project-scoped users can
--    insert drafts and update approvals on their own projects
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "store_issues_read"    ON public.store_issues;
DROP POLICY IF EXISTS "store_issues_write"   ON public.store_issues;
DROP POLICY IF EXISTS "store_issues_insert"  ON public.store_issues;
DROP POLICY IF EXISTS "store_issues_update"  ON public.store_issues;
DROP POLICY IF EXISTS "store_issues_delete"  ON public.store_issues;

CREATE POLICY "store_issues_read" ON public.store_issues
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND archived_at IS NULL
    AND (
      EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
      OR EXISTS (
        SELECT 1 FROM public.user_access_scopes s
        WHERE s.user_id = auth.uid() AND s.is_active = true
        AND (
          s.scope_type IN ('all_projects','main_company')
          OR (s.scope_type = 'selected_project' AND s.project_id = store_issues.project_id)
        )
      )
    )
  );

CREATE POLICY "store_issues_insert" ON public.store_issues
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND (
      EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
      OR EXISTS (
        SELECT 1 FROM public.user_access_scopes s
        WHERE s.user_id = auth.uid() AND s.is_active = true
        AND (
          s.scope_type IN ('all_projects','main_company')
          OR (s.scope_type = 'selected_project' AND s.project_id = store_issues.project_id)
        )
      )
    )
  );

CREATE POLICY "store_issues_update" ON public.store_issues
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
    OR auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.user_access_scopes s
      WHERE s.user_id = auth.uid() AND s.is_active = true
      AND (
        s.scope_type IN ('all_projects','main_company')
        OR (s.scope_type = 'selected_project' AND s.project_id = store_issues.project_id)
      )
    )
  );

-- Allow service_role to delete (cancel) as well
CREATE POLICY "store_issues_delete" ON public.store_issues
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
    OR auth.role() = 'service_role'
  );

-- RLS for store_issue_lines: mirror store_issues
DROP POLICY IF EXISTS "store_issue_lines_read"    ON public.store_issue_lines;
DROP POLICY IF EXISTS "store_issue_lines_write"   ON public.store_issue_lines;
DROP POLICY IF EXISTS "store_issue_lines_insert"  ON public.store_issue_lines;
DROP POLICY IF EXISTS "store_issue_lines_update"  ON public.store_issue_lines;

CREATE POLICY "store_issue_lines_read" ON public.store_issue_lines
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "store_issue_lines_insert" ON public.store_issue_lines
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
  );

CREATE POLICY "store_issue_lines_update" ON public.store_issue_lines
  FOR UPDATE USING (
    auth.role() = 'service_role'
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

-- ─────────────────────────────────────────────────────────────
-- 4. RPC: approve_store_issue
--    Called by PM or Warehouse Manager.
--    role_type: 'pm' | 'warehouse_manager'
--    When both approved ⇒ triggers confirm_store_issue
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_store_issue(
  p_issue_id  uuid,
  p_role_type text,   -- 'pm' | 'warehouse_manager'
  p_notes     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issue     public.store_issues%ROWTYPE;
  v_user_id   uuid := auth.uid();
BEGIN
  -- Lock the row
  SELECT * INTO v_issue FROM public.store_issues WHERE id = p_issue_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'إذن الصرف غير موجود');
  END IF;

  IF v_issue.status NOT IN ('pending_approval') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'لا يمكن الموافقة على هذا الإذن في حالته الحالية');
  END IF;

  -- Record approval in audit log
  INSERT INTO public.store_issue_approvals (store_issue_id, user_id, role_type, action_taken, notes)
  VALUES (p_issue_id, v_user_id, p_role_type, 'approved', p_notes);

  -- Update the matching status column
  IF p_role_type = 'pm' THEN
    UPDATE public.store_issues
    SET pm_status = 'approved', approved_by_pm = v_user_id, pm_approved_at = now(), updated_at = now()
    WHERE id = p_issue_id;
    -- Re-read
    SELECT * INTO v_issue FROM public.store_issues WHERE id = p_issue_id;
  ELSIF p_role_type = 'warehouse_manager' THEN
    UPDATE public.store_issues
    SET wm_status = 'approved', approved_by_wm = v_user_id, wm_approved_at = now(), updated_at = now()
    WHERE id = p_issue_id;
    SELECT * INTO v_issue FROM public.store_issues WHERE id = p_issue_id;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'نوع الدور غير صحيح');
  END IF;

  -- If both approved → confirm
  IF v_issue.pm_status = 'approved' AND v_issue.wm_status = 'approved' THEN
    RETURN public.confirm_store_issue(p_issue_id);
  END IF;

  RETURN jsonb_build_object('ok', true, 'message', 'تمت الموافقة بنجاح. في انتظار الموافقة الأخرى.');
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. RPC: reject_store_issue
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_store_issue(
  p_issue_id  uuid,
  p_role_type text,
  p_reason    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  -- Verify exists and is pending
  IF NOT EXISTS (
    SELECT 1 FROM public.store_issues
    WHERE id = p_issue_id AND status = 'pending_approval'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'لا يمكن رفض هذا الإذن في حالته الحالية');
  END IF;

  INSERT INTO public.store_issue_approvals (store_issue_id, user_id, role_type, action_taken, notes)
  VALUES (p_issue_id, v_user_id, p_role_type, 'rejected', p_reason);

  UPDATE public.store_issues
  SET
    status           = 'rejected',
    rejection_reason = p_reason,
    updated_at       = now()
  WHERE id = p_issue_id;

  RETURN jsonb_build_object('ok', true, 'message', 'تم رفض إذن الصرف');
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. RPC: confirm_store_issue
--    Core accounting: read weighted_avg_cost → deduct stock
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_store_issue(p_issue_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issue      public.store_issues%ROWTYPE;
  v_line       record;
  v_bal        public.stock_balances%ROWTYPE;
  v_unit_cost  numeric(18,6);
  v_total_val  numeric(18,2);
  v_new_qty    numeric(18,4);
  v_new_val    numeric(18,2);
  v_new_avg    numeric(18,6);
  v_run_qty    numeric(18,4);
  v_run_val    numeric(18,2);
BEGIN
  SELECT * INTO v_issue FROM public.store_issues WHERE id = p_issue_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'إذن الصرف غير موجود');
  END IF;

  -- Process each line
  FOR v_line IN
    SELECT * FROM public.store_issue_lines WHERE store_issue_id = p_issue_id
  LOOP
    -- Get current balance (lock row)
    SELECT * INTO v_bal
    FROM public.stock_balances
    WHERE warehouse_id = v_issue.warehouse_id AND item_id = v_line.item_id
    FOR UPDATE;

    IF NOT FOUND OR v_bal.quantity_on_hand < v_line.quantity THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'الرصيد غير كافٍ لأحد الأصناف. تحقق من الكميات.'
      );
    END IF;

    -- Use weighted average cost at time of issue
    v_unit_cost := v_bal.weighted_avg_cost;
    v_total_val := ROUND(v_line.quantity * v_unit_cost, 2);

    -- Update the line with the captured cost
    UPDATE public.store_issue_lines
    SET unit_cost = v_unit_cost
    WHERE id = v_line.id;

    -- Deduct from stock_balances
    v_new_qty := v_bal.quantity_on_hand - v_line.quantity;
    v_new_val := GREATEST(v_bal.total_value - v_total_val, 0);
    v_new_avg := CASE
                   WHEN v_new_qty > 0 THEN ROUND(v_new_val / v_new_qty, 6)
                   ELSE 0
                 END;

    UPDATE public.stock_balances
    SET
      quantity_on_hand  = v_new_qty,
      total_value       = v_new_val,
      weighted_avg_cost = v_new_avg,
      last_movement_at  = now(),
      updated_at        = now()
    WHERE warehouse_id = v_issue.warehouse_id AND item_id = v_line.item_id;

    -- Running totals for ledger
    v_run_qty := v_new_qty;
    v_run_val := v_new_val;

    -- Append to stock_ledger
    INSERT INTO public.stock_ledger (
      warehouse_id, item_id, unit_id, project_id,
      movement_type, document_type, document_id, document_no,
      qty_in, qty_out, unit_cost, total_value,
      running_qty, running_value, movement_date,
      created_by
    ) VALUES (
      v_issue.warehouse_id, v_line.item_id, v_line.unit_id, v_issue.project_id,
      'out', 'store_issue', p_issue_id, v_issue.document_no,
      0, v_line.quantity, v_unit_cost, v_total_val,
      v_run_qty, v_run_val, CURRENT_DATE,
      v_issue.confirmed_by
    );
  END LOOP;

  -- Mark the issue as confirmed
  UPDATE public.store_issues
  SET
    status       = 'confirmed',
    confirmed_at = now(),
    confirmed_by = auth.uid(),
    updated_at   = now()
  WHERE id = p_issue_id;

  RETURN jsonb_build_object('ok', true, 'message', 'تم تأكيد إذن الصرف وتحديث المخزون بنجاح');
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 7. Grant execute on RPCs to authenticated users
-- ─────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.approve_store_issue(uuid, text, text)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_store_issue(uuid, text, text)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_store_issue(uuid)              TO authenticated;

COMMIT;
