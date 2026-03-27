-- 016_petty_expenses_custody.sql

-- 1. Expense Taxonomy
CREATE TABLE expense_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    group_code TEXT NOT NULL,
    arabic_name TEXT NOT NULL,
    english_name TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, group_code)
);

CREATE TABLE expense_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_group_id UUID NOT NULL REFERENCES expense_groups(id) ON DELETE CASCADE,
    item_code TEXT NOT NULL,
    arabic_name TEXT NOT NULL,
    english_name TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(expense_group_id, item_code)
);

-- 2. Employee Custody Accounts (العهد)
CREATE TABLE employee_custody_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE, -- Nullable for corporate-level custody
    employee_user_id UUID NOT NULL REFERENCES auth.users(id),
    account_type TEXT NOT NULL CHECK (account_type IN ('permanent', 'temporary')),
    allowed_negative_limit NUMERIC(15,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, employee_user_id, account_type) -- Prevent duplicate identical active custody accounts
);

-- 3. Custody Transactions (Ledger)
CREATE TABLE employee_custody_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_custody_account_id UUID NOT NULL REFERENCES employee_custody_accounts(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('funding', 'expense', 'refund', 'cutover', 'adjustment')),
    amount NUMERIC(15,2) NOT NULL, -- Positive represents money injected to employee. Negative represents employee spent money.
    reference_type TEXT, -- e.g. 'petty_expense', 'bank_transfer', 'cash_receipt'
    reference_id UUID,   -- ID of the related source document
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Petty Expenses
CREATE TABLE petty_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    project_id UUID REFERENCES projects(id),
    employee_custody_account_id UUID REFERENCES employee_custody_accounts(id) ON DELETE RESTRICT,
    expense_group_id UUID REFERENCES expense_groups(id),
    expense_item_id UUID REFERENCES expense_items(id),
    quantity NUMERIC(15,2) DEFAULT 1,
    unit_price NUMERIC(15,2) DEFAULT 0,
    total_amount NUMERIC(15,2) NOT NULL CHECK (total_amount > 0),
    expense_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'pm_approved', 'gm_approved', 'reimbursed', 'rejected')) DEFAULT 'draft',
    notes TEXT,
    attachment_url TEXT,
    created_by UUID REFERENCES auth.users(id),
    pm_approved_by UUID REFERENCES auth.users(id),
    pm_approved_at TIMESTAMPTZ,
    gm_approved_by UUID REFERENCES auth.users(id),
    gm_approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Custody Balance View
-- Sums up the transactions to yield the current live balance per custody account
CREATE OR REPLACE VIEW employee_custody_balances_view AS
SELECT 
    eca.id AS custody_account_id,
    eca.company_id,
    eca.project_id,
    eca.employee_user_id,
    eca.account_type,
    eca.allowed_negative_limit,
    COALESCE(SUM(ect.amount), 0) AS current_balance,
    (COALESCE(SUM(ect.amount), 0) + eca.allowed_negative_limit) AS available_spending_power
FROM employee_custody_accounts eca
LEFT JOIN employee_custody_transactions ect ON eca.id = ect.employee_custody_account_id
GROUP BY eca.id, eca.company_id, eca.project_id, eca.employee_user_id, eca.account_type, eca.allowed_negative_limit;

-- Trigger to protect negative spending limits if attempting to insert an expense transaction
CREATE OR REPLACE FUNCTION check_custody_negative_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_current_balance NUMERIC;
    v_allowed_limit NUMERIC;
BEGIN
    -- Only check if this is an expense (negative amount)
    IF NEW.amount < 0 THEN
        -- Get the current balance and allowed negative limit before this transaction
        SELECT current_balance, allowed_negative_limit
        INTO v_current_balance, v_allowed_limit
        FROM employee_custody_balances_view
        WHERE custody_account_id = NEW.employee_custody_account_id;

        -- If applying this transaction drops the balance below the allowed negative limit (limit is a positive number representing max allowable deficit, so balance + limit >= 0 means OK)
        IF (v_current_balance + NEW.amount + v_allowed_limit) < 0 THEN
            RAISE EXCEPTION 'Transaction denied: Custody account would exceed its allowed negative limit. Current Balance: %, Allowed Deficit: %, Requested Expense: %', 
                v_current_balance, v_allowed_limit, NEW.amount;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_custody_negative_limit
BEFORE INSERT ON employee_custody_transactions
FOR EACH ROW
EXECUTE FUNCTION check_custody_negative_limit();

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------

ALTER TABLE expense_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_custody_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_custody_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE petty_expenses ENABLE ROW LEVEL SECURITY;

-- Expense Taxonomy is readable by active users in the company
CREATE POLICY "expense_groups_select" ON expense_groups FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
       OR EXISTS (SELECT 1 FROM public.user_access_scopes s WHERE s.user_id = auth.uid() AND s.is_active = true AND s.scope_type IN ('all_projects', 'main_company')));

CREATE POLICY "expense_items_select" ON expense_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
       OR EXISTS (SELECT 1 FROM public.user_access_scopes s WHERE s.user_id = auth.uid() AND s.is_active = true AND s.scope_type IN ('all_projects', 'main_company')));

-- Custody accounts: Readable if employee themselves, OR if user has scope on the project/company
CREATE POLICY "custody_accounts_select" ON employee_custody_accounts FOR SELECT TO authenticated
USING (
    employee_user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true) OR
    EXISTS (SELECT 1 FROM public.user_access_scopes s WHERE s.user_id = auth.uid() AND s.is_active = true AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = employee_custody_accounts.project_id)))
);

-- Transactions: Inherits Custody Accounts logic
CREATE POLICY "custody_transactions_select" ON employee_custody_transactions FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM employee_custody_accounts eca WHERE eca.id = employee_custody_transactions.employee_custody_account_id AND (
        eca.employee_user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true) OR
        EXISTS (SELECT 1 FROM public.user_access_scopes s WHERE s.user_id = auth.uid() AND s.is_active = true AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = eca.project_id)))
    ))
);

-- Petty Expenses: Readable if created by self, mapped to own custody, OR if user has project scope
CREATE POLICY "petty_expenses_select" ON petty_expenses FOR SELECT TO authenticated
USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM employee_custody_accounts eca WHERE eca.id = petty_expenses.employee_custody_account_id AND eca.employee_user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true) OR
    EXISTS (SELECT 1 FROM public.user_access_scopes s WHERE s.user_id = auth.uid() AND s.is_active = true AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = petty_expenses.project_id)))
);

-- Writes allowed generally managed by server actions, so simple robust checks.
CREATE POLICY "custody_accounts_insert_update" ON employee_custody_accounts FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true) OR EXISTS (SELECT 1 FROM public.user_access_scopes s WHERE s.user_id = auth.uid() AND s.is_active = true AND s.scope_type IN ('all_projects', 'main_company')));

CREATE POLICY "custody_transactions_insert_update" ON employee_custody_transactions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true) OR EXISTS (SELECT 1 FROM public.user_access_scopes s WHERE s.user_id = auth.uid() AND s.is_active = true AND s.scope_type IN ('all_projects', 'main_company')));

CREATE POLICY "petty_expenses_insert_update" ON petty_expenses FOR ALL TO authenticated
USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true) OR 
    EXISTS (SELECT 1 FROM public.user_access_scopes s WHERE s.user_id = auth.uid() AND s.is_active = true AND s.scope_type IN ('all_projects', 'main_company'))
);
