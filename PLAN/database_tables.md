### users.
  - id uuid? [PK]
  - display_name text
  - email text
  - is_active boolean
  - is_super_admin boolean
  - avatar_url text?
  - notes text?
  - created_at timestamptz
  - updated_at timestamptz

### employee_profiles
  - id uuid? [PK]
  - user_id uuid → users
  - arabic_name text?
  - national_id text?
  - department text?
  - job_title text?
  - hire_date date?
  - notes text?
  - created_at timestamptz
  - updated_at timestamptz

### roles
  - id uuid? [PK]
  - role_key text
  - arabic_name text
  - english_name text
  - is_active boolean
  - notes text?
  - created_at timestamptz

### permission_groups
  - id uuid? [PK]
  - group_key text
  - group_name text
  - arabic_name text
  - is_system_group boolean
  - is_active boolean
  - notes text?
  - created_at timestamptz
  - updated_at timestamptz

### permissions
  - id uuid? [PK]
  - module_key text
  - module_name_ar text
  - action_key text
  - action_name_ar text
  - created_at timestamptz

### permission_group_permissions
  - id uuid? [PK]
  - permission_group_id uuid → permission_groups
  - module_key text
  - action_key text
  - is_allowed boolean
  - created_at timestamptz

### user_role_assignments
  - id uuid? [PK]
  - user_id uuid → users
  - role_id uuid → roles
  - assigned_by uuid? → users
  - assigned_at timestamptz
  - is_active boolean

### user_permission_group_assignments
  - id uuid? [PK]
  - user_id uuid → users
  - permission_group_id uuid → permission_groups
  - assigned_by uuid? → users
  - assigned_at timestamptz
  - is_active boolean

### user_access_scopes
  - id uuid? [PK]
  - user_id uuid → users
  - scope_type text
  - project_id uuid?
  - warehouse_id uuid?
  - granted_by uuid? → users
  - granted_at timestamptz
  - is_active boolean

### approval_delegations
  - id uuid? [PK]
  - delegator_id uuid → users
  - delegate_id uuid → users
  - module_key text?
  - valid_from timestamptz
  - valid_until timestamptz
  - reason text?
  - created_by uuid? → users
  - created_at timestamptz
  - is_active boolean

### companies
  - id uuid? [PK]
  - arabic_name text
  - english_name text
  - short_code text
  - tax_number text?
  - commercial_reg text?
  - address text?
  - city text?
  - country text
  - phone text?
  - email text?
  - logo_url text?
  - is_active boolean
  - notes text?
  - created_at timestamptz
  - updated_at timestamptz

### branches
  - id uuid? [PK]
  - company_id uuid → companies
  - arabic_name text
  - english_name text
  - address text?
  - is_active boolean
  - notes text?
  - created_at timestamptz

### departments
  - id uuid? [PK]
  - company_id uuid → companies
  - arabic_name text
  - english_name text
  - parent_department_id uuid? → departments
  - is_active boolean
  - notes text?
  - created_at timestamptz

### cost_centers
  - id uuid? [PK]
  - company_id uuid → companies
  - cost_center_code text
  - arabic_name text
  - english_name text
  - center_type text
  - parent_center_id uuid? → cost_centers
  - is_active boolean
  - notes text?
  - created_at timestamptz
  - updated_at timestamptz

### projects
  - id uuid? [PK]
  - company_id uuid → companies
  - cost_center_id uuid? → cost_centers
  - project_code text
  - arabic_name text
  - english_name text
  - status text
  - project_onboarding_type text
  - project_type text?
  - location text?
  - start_date date?
  - expected_end_date date?
  - actual_end_date date?
  - planned_allocation_amount numeric?
  - estimated_contract_value numeric?
  - project_manager_user_id uuid? → users
  - owner_party_id uuid?
  - cutover_date date?
  - migration_status text
  - opening_balances_approved boolean
  - opening_data_locked_at timestamptz?
  - notes text?
  - archived_at timestamptz?
  - archived_by uuid? → users
  - created_by uuid? → users
  - created_at timestamptz
  - updated_at timestamptz

### parties
  - id uuid? [PK]
  - company_id uuid → companies
  - arabic_name text
  - english_name text?
  - tax_number text?
  - commercial_reg text?
  - phone text?
  - email text?
  - address text?
  - city text?
  - country text?
  - website text?
  - notes text?
  - is_active boolean
  - archived_at timestamptz?
  - archived_by uuid? → users
  - created_by uuid? → users
  - created_at timestamptz
  - updated_at timestamptz

### party_roles
  - id uuid? [PK]
  - party_id uuid → parties
  - role_type text
  - is_active boolean
  - notes text?
  - created_at timestamptz

### party_role_accounts
  - id uuid? [PK]
  - party_id uuid → parties
  - role_type text
  - project_id uuid? → projects
  - account_code text?
  - status text
  - opening_balance numeric
  - notes text?
  - created_at timestamptz
  - updated_at timestamptz

### party_contacts
  - id uuid? [PK]
  - party_id uuid → parties
  - full_name text
  - job_title text?
  - email text?
  - phone text?
  - is_primary boolean
  - preferred_language text
  - notes text?
  - created_at timestamptz

### project_parties
  - id uuid? [PK]
  - project_id uuid → projects
  - party_id uuid → parties
  - project_role text
  - status text
  - start_date date?
  - end_date date?
  - notes text?
  - created_at timestamptz

### project_party_contacts
  - id uuid? [PK]
  - project_id uuid → projects
  - party_id uuid → parties
  - party_contact_id uuid → party_contacts
  - contact_role text?
  - is_primary_for_project boolean
  - notes text?
  - created_at timestamptz

### item_groups
  - id uuid? [PK]
  - company_id uuid → companies
  - group_code text
  - arabic_name text
  - english_name text?
  - parent_group_id uuid? → item_groups
  - is_active boolean
  - notes text?
  - created_by uuid? → users
  - created_at timestamptz
  - updated_at timestamptz

### units
  - id uuid? [PK]
  - company_id uuid → companies
  - unit_code text
  - arabic_name text
  - english_name text?
  - is_active boolean
  - notes text?
  - created_by uuid? → users
  - created_at timestamptz

### items
  - id uuid? [PK]
  - company_id uuid → companies
  - item_group_id uuid → item_groups
  - item_code text
  - arabic_name text
  - english_name text?
  - primary_unit_id uuid → units
  - default_purchase_unit_id uuid? → units
  - is_stocked boolean
  - min_stock_level numeric?
  - notes text?
  - is_active boolean
  - archived_at timestamptz?
  - archived_by uuid? → users
  - created_by uuid? → users
  - created_at timestamptz
  - updated_at timestamptz

### item_units
  - id uuid? [PK]
  - item_id uuid → items
  - unit_id uuid → units
  - conversion_factor numeric
  - is_default_purchase boolean
  - notes text?
  - created_at timestamptz

### item_cost_profiles
  - id uuid? [PK]
  - item_id uuid → items
  - costing_method text
  - fixed_cost numeric?
  - effective_from date
  - notes text?
  - created_by uuid? → users
  - created_at timestamptz

### warehouses
  - id uuid? [PK]
  - company_id uuid → companies
  - project_id uuid? → projects
  - warehouse_code text
  - arabic_name text
  - english_name text?
  - warehouse_type text
  - location text?
  - is_active boolean
  - notes text?
  - archived_at timestamptz?
  - archived_by uuid? → users
  - created_by uuid? → users
  - created_at timestamptz
  - updated_at timestamptz

### warehouse_user_assignments
  - id uuid? [PK]
  - warehouse_id uuid → warehouses
  - user_id uuid → users
  - assignment_role text
  - is_active boolean
  - assigned_by uuid? → users
  - assigned_at timestamptz
  - notes text?

### stock_balances
  - id uuid? [PK]
  - warehouse_id uuid → warehouses
  - item_id uuid → items
  - quantity_on_hand numeric
  - total_value numeric
  - weighted_avg_cost numeric
  - last_movement_at timestamptz?
  - updated_at timestamptz

### stock_ledger
  - id uuid? [PK]
  - warehouse_id uuid → warehouses
  - item_id uuid → items
  - unit_id uuid → units
  - project_id uuid? → projects
  - movement_type text
  - document_type text
  - document_id uuid
  - document_line_id uuid?
  - document_no text?
  - qty_in numeric
  - qty_out numeric
  - unit_cost numeric
  - total_value numeric
  - running_qty numeric
  - running_value numeric
  - movement_date date
  - notes text?
  - created_by uuid? → users
  - created_at timestamptz

### goods_receipts
  - id uuid? [PK]
  - company_id uuid → companies
  - warehouse_id uuid → warehouses
  - project_id uuid? → projects
  - supplier_party_id uuid? → parties
  - document_no text
  - receipt_date date
  - status text
  - supplier_invoice_ref text?
  - notes text?
  - confirmed_at timestamptz?
  - confirmed_by uuid? → users
  - cancelled_at timestamptz?
  - cancelled_by uuid? → users
  - cancelled_reason text?
  - archived_at timestamptz?
  - archived_by uuid? → users
  - created_by uuid? → users
  - created_at timestamptz
  - updated_at timestamptz

### goods_receipt_lines
  - id uuid? [PK]
  - goods_receipt_id uuid → goods_receipts
  - item_id uuid → items
  - unit_id uuid → units
  - quantity numeric
  - unit_cost numeric
  - total_cost numeric?
  - notes text?
  - created_at timestamptz

### store_issues
  - id uuid? [PK]
  - company_id uuid → companies
  - warehouse_id uuid → warehouses
  - project_id uuid → projects
  - document_no text
  - issue_date date
  - issued_to_user_id uuid? → users
  - cost_center_id uuid? → cost_centers
  - status text
  - notes text?
  - confirmed_at timestamptz?
  - confirmed_by uuid? → users
  - cancelled_at timestamptz?
  - cancelled_by uuid? → users
  - cancelled_reason text?
  - archived_at timestamptz?
  - archived_by uuid? → users
  - created_by uuid? → users
  - created_at timestamptz
  - updated_at timestamptz

### store_issue_lines
  - id uuid? [PK]
  - store_issue_id uuid → store_issues
  - item_id uuid → items
  - unit_id uuid → units
  - quantity numeric
  - unit_cost numeric
  - total_cost numeric?
  - notes text?
  - created_at timestamptz

### store_returns
  - id uuid? [PK]
  - company_id uuid → companies
  - warehouse_id uuid → warehouses
  - project_id uuid? → projects
  - document_no text
  - return_date date
  - returned_by_user_id uuid? → users
  - original_issue_id uuid? → store_issues
  - status text
  - notes text?
  - confirmed_at timestamptz?
  - confirmed_by uuid? → users
  - cancelled_at timestamptz?
  - cancelled_by uuid? → users
  - cancelled_reason text?
  - archived_at timestamptz?
  - archived_by uuid? → users
  - created_by uuid? → users
  - created_at timestamptz
  - updated_at timestamptz

### store_return_lines
  - id uuid? [PK]
  - store_return_id uuid → store_returns
  - item_id uuid → items
  - unit_id uuid → units
  - quantity numeric
  - unit_cost numeric
  - total_cost numeric?
  - condition_note text?
  - notes text?
  - created_at timestamptz

### warehouse_transfers
  - id uuid? [PK]
  - company_id uuid → companies
  - source_warehouse_id uuid → warehouses
  - destination_warehouse_id uuid → warehouses
  - project_id uuid? → projects
  - document_no text
  - transfer_date date
  - status text
  - notes text?
  - confirmed_at timestamptz?
  - confirmed_by uuid? → users
  - cancelled_at timestamptz?
  - cancelled_by uuid? → users
  - cancelled_reason text?
  - archived_at timestamptz?
  - archived_by uuid? → users
  - created_by uuid? → users
  - created_at timestamptz
  - updated_at timestamptz

### warehouse_transfer_lines
  - id uuid? [PK]
  - warehouse_transfer_id uuid → warehouse_transfers
  - item_id uuid → items
  - unit_id uuid → units
  - quantity numeric
  - unit_cost numeric
  - total_cost numeric?
  - notes text?
  - created_at timestamptz

### stock_adjustments
  - id uuid? [PK]
  - company_id uuid → companies
  - warehouse_id uuid → warehouses
  - project_id uuid? → projects
  - document_no text
  - adjustment_date date
  - status text
  - notes text?
  - confirmed_at timestamptz?
  - confirmed_by uuid? → users
  - cancelled_at timestamptz?
  - cancelled_by uuid? → users
  - cancelled_reason text?
  - archived_at timestamptz?
  - archived_by uuid? → users
  - created_by uuid? → users
  - created_at timestamptz
  - updated_at timestamptz

### stock_adjustment_lines
  - id uuid? [PK]
  - stock_adjustment_id uuid → stock_adjustments
  - item_id uuid → items
  - unit_id uuid → units
  - adjustment_type text
  - direction text
  - quantity numeric
  - unit_cost numeric
  - total_cost numeric?
  - notes text?
  - created_at timestamptz

### cutover_batches
  - id UUID? [PK]
  - company_id UUID → companies
  - project_id UUID → projects
  - cutover_date DATE
  - prepared_by UUID? → users
  - reviewed_by UUID? → users
  - approved_by UUID? → users
  - locked_at TIMESTAMPTZ?
  - notes TEXT?
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ

### cutover_financial_balances
  - id UUID? [PK]
  - batch_id UUID → cutover_batches
  - currency VARCHAR
  - opening_amount DECIMAL
  - notes TEXT?
  - created_at TIMESTAMPTZ

### cutover_subcontractor_positions
  - id UUID? [PK]
  - batch_id UUID → cutover_batches
  - subcontractor_id UUID → parties
  - work_item_name VARCHAR
  - previous_quantity DECIMAL
  - cumulative_quantity DECIMAL
  - agreed_rate DECIMAL
  - gross_certified_amount DECIMAL
  - taliya_balance DECIMAL
  - advance_balance DECIMAL
  - other_deductions_balance DECIMAL
  - paid_to_date DECIMAL
  - outstanding_balance DECIMAL
  - created_at TIMESTAMPTZ

### cutover_supplier_positions
  - id UUID? [PK]
  - batch_id UUID → cutover_batches
  - supplier_id UUID → parties
  - open_invoice_number VARCHAR?
  - invoice_date DATE?
  - gross_invoice_amount DECIMAL
  - paid_amount DECIMAL
  - remaining_amount DECIMAL
  - advance_paid DECIMAL
  - created_at TIMESTAMPTZ

### cutover_owner_positions
  - id UUID? [PK]
  - batch_id UUID → cutover_batches
  - client_id UUID → parties
  - open_certificate_number VARCHAR?
  - billing_date DATE?
  - billed_amount DECIMAL
  - collected_amount DECIMAL
  - remaining_receivable DECIMAL
  - created_at TIMESTAMPTZ

### cutover_warehouse_stock
  - id UUID? [PK]
  - batch_id UUID → cutover_batches
  - warehouse_id UUID → warehouses
  - item_id UUID → items
  - unit_id UUID → units
  - opening_quantity DECIMAL
  - unit_cost DECIMAL
  - opening_value DECIMAL
  - created_at TIMESTAMPTZ

### cutover_employee_custody
  - id UUID? [PK]
  - batch_id UUID → cutover_batches
  - employee_id UUID → users
  - custody_account_type VARCHAR?
  - opening_balance DECIMAL
  - temporary_advance_balance DECIMAL
  - created_at TIMESTAMPTZ

### project_work_items
  - id UUID? [PK]
  - project_id UUID → projects
  - company_id UUID → companies
  - item_code VARCHAR?
  - arabic_description TEXT
  - english_description TEXT?
  - default_unit_id UUID? → units
  - is_active BOOLEAN
  - notes TEXT?
  - created_by UUID? → users
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ

### subcontract_agreements
  - id UUID? [PK]
  - project_id UUID → projects
  - company_id UUID → companies
  - subcontractor_party_id UUID → parties
  - agreement_code VARCHAR
  - default_taaliya_value DECIMAL
  - start_date DATE?
  - end_date DATE?
  - notes TEXT?
  - created_by UUID? → users
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ

### subcontract_agreement_lines
  - id UUID? [PK]
  - subcontract_agreement_id UUID → subcontract_agreements
  - work_item_id UUID → project_work_items
  - unit_id UUID → units
  - agreed_rate DECIMAL
  - taaliya_value DECIMAL?
  - owner_billable_default BOOLEAN
  - estimated_quantity DECIMAL?
  - notes TEXT?
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ

### subcontractor_certificates
  - id UUID? [PK]
  - project_id UUID → projects
  - company_id UUID → companies
  - subcontractor_party_id UUID → parties
  - subcontract_agreement_id UUID → subcontract_agreements
  - certificate_no VARCHAR
  - certificate_date DATE
  - period_from DATE?
  - period_to DATE?
  - gross_amount DECIMAL
  - taaliya_amount DECIMAL
  - other_deductions_amount DECIMAL
  - net_amount DECIMAL
  - paid_to_date DECIMAL
  - outstanding_amount DECIMAL
  - notes TEXT?
  - created_by UUID? → users
  - approved_by UUID? → users
  - approved_at TIMESTAMPTZ?
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ

### subcontractor_certificate_lines
  - id UUID? [PK]
  - certificate_id UUID → subcontractor_certificates
  - project_work_item_id UUID → project_work_items
  - unit_id UUID → units
  - previous_quantity DECIMAL
  - current_quantity DECIMAL
  - cumulative_quantity DECIMAL
  - agreed_rate DECIMAL
  - gross_line_amount DECIMAL
  - taaliya_value DECIMAL?
  - taaliya_amount DECIMAL
  - net_line_amount DECIMAL
  - owner_billable BOOLEAN
  - owner_description_override TEXT?
  - notes TEXT?
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ

### subcontractor_certificate_allowances
  - id UUID? [PK]
  - certificate_id UUID → subcontractor_certificates
  - certificate_line_id UUID? → subcontractor_certificate_lines
  - base_project_work_item_id UUID? → project_work_items
  - current_quantity DECIMAL
  - allowance_rate_difference DECIMAL?
  - allowance_amount DECIMAL
  - reason TEXT
  - approval_reference VARCHAR?
  - show_as_notice_in_next_certificate BOOLEAN?
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ

### subcontractor_certificate_deductions
  - id UUID? [PK]
  - certificate_id UUID → subcontractor_certificates
  - deduction_type VARCHAR
  - calculation_type VARCHAR
  - rate_or_amount DECIMAL
  - deduction_amount DECIMAL
  - notes TEXT?
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ

### subcontractor_retention_releases
  - id UUID? [PK]
  - project_id UUID → projects
  - company_id UUID → companies
  - subcontractor_party_id UUID → parties
  - subcontract_agreement_id UUID? → subcontract_agreements
  - release_date DATE
  - released_amount DECIMAL
  - status VARCHAR
  - notes TEXT?
  - created_by UUID? → users
  - approved_by UUID? → users
  - approved_at TIMESTAMPTZ?
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ

### purchase_requests
  - id UUID? [PK]
  - project_id UUID → projects
  - company_id UUID → companies
  - request_no VARCHAR
  - request_date DATE
  - required_by_date DATE?
  - status VARCHAR
  - notes TEXT?
  - requested_by UUID? → users
  - approved_by UUID? → users
  - approved_at TIMESTAMPTZ?
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ

### purchase_request_lines
  - id UUID? [PK]
  - pr_id UUID → purchase_requests
  - item_id UUID → items
  - requested_quantity DECIMAL
  - estimated_unit_price DECIMAL?
  - notes TEXT?
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ

### supplier_invoices
  - id UUID? [PK]
  - project_id UUID → projects
  - company_id UUID → companies
  - supplier_party_id UUID → parties
  - pr_id UUID? → purchase_requests
  - invoice_no VARCHAR
  - invoice_date DATE
  - status VARCHAR
  - gross_amount DECIMAL
  - tax_amount DECIMAL
  - discount_amount DECIMAL
  - net_amount DECIMAL
  - paid_to_date DECIMAL
  - outstanding_amount DECIMAL
  - notes TEXT?
  - created_by UUID? → users
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ

### supplier_invoice_lines
  - id UUID? [PK]
  - invoice_id UUID → supplier_invoices
  - pr_line_id UUID? → purchase_request_lines
  - item_id UUID → items
  - invoiced_quantity DECIMAL
  - unit_price DECIMAL
  - line_gross DECIMAL
  - line_net DECIMAL
  - notes TEXT?
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ

### invoice_receipt_confirmations
  - id UUID? [PK]
  - supplier_invoice_id UUID → supplier_invoices
  - warehouse_id UUID → warehouses
  - warehouse_manager_status VARCHAR
  - pm_status VARCHAR
  - confirmed_at TIMESTAMPTZ?
  - notes TEXT?
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ

### invoice_receipt_confirmation_users
  - id UUID? [PK]
  - confirmation_id UUID → invoice_receipt_confirmations
  - user_id UUID → users
  - role_type VARCHAR
  - action_taken VARCHAR
  - action_at TIMESTAMPTZ
  - notes TEXT?

### supplier_return_invoices
  - id UUID? [PK]
  - project_id UUID → projects
  - company_id UUID → companies
  - supplier_party_id UUID → parties
  - original_invoice_id UUID? → supplier_invoices
  - return_no VARCHAR
  - return_date DATE
  - status VARCHAR
  - net_amount DECIMAL
  - notes TEXT?
  - created_by UUID? → users
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ

### supplier_return_invoice_lines
  - id UUID? [PK]
  - return_id UUID → supplier_return_invoices
  - item_id UUID → items
  - returned_quantity DECIMAL
  - unit_price DECIMAL
  - line_net DECIMAL
  - notes TEXT?
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ

### owner_billing_documents
  - id uuid? [PK]
  - project_id uuid → projects
  - company_id uuid → companies
  - owner_party_id uuid → parties
  - document_no text
  - document_type text
  - billing_date date
  - status text
  - gross_amount numeric
  - tax_amount numeric
  - net_amount numeric
  - notes text?
  - created_by uuid? → users
  - created_at timestamptz
  - updated_at timestamptz
  - archived_at timestamptz?
  - archived_by uuid? → users

### owner_billing_lines
  - id uuid? [PK]
  - owner_billing_document_id uuid → owner_billing_documents
  - line_description text
  - unit_id uuid? → item_units
  - quantity numeric
  - unit_price numeric
  - line_gross numeric
  - line_net numeric
  - notes text?
  - created_at timestamptz
  - updated_at timestamptz

### owner_billing_source_links
  - id uuid? [PK]
  - owner_billing_line_id uuid → owner_billing_lines
  - source_type text
  - source_reference_id uuid
  - allocated_quantity numeric
  - allocated_cost numeric
  - notes text?
  - created_at timestamptz

### owner_collections
  - id uuid? [PK]
  - project_id uuid → projects
  - company_id uuid → companies
  - owner_billing_document_id uuid? → owner_billing_documents
  - owner_party_id uuid → parties
  - received_amount numeric
  - received_date date
  - payment_method text
  - reference_no text?
  - notes text?
  - created_by uuid? → users
  - created_at timestamptz
  - updated_at timestamptz
  - archived_at timestamptz?

### expense_groups
  - id UUID? [PK]
  - company_id UUID?
  - group_code TEXT
  - arabic_name TEXT
  - english_name TEXT?
  - is_active BOOLEAN?
  - created_at TIMESTAMPTZ?
  - updated_at TIMESTAMPTZ?

### expense_items
  - id UUID? [PK]
  - expense_group_id UUID
  - item_code TEXT
  - arabic_name TEXT
  - english_name TEXT?
  - is_active BOOLEAN?
  - created_at TIMESTAMPTZ?
  - updated_at TIMESTAMPTZ?

### employee_custody_accounts
  - id UUID? [PK]
  - company_id UUID
  - project_id UUID?
  - employee_user_id UUID
  - account_type TEXT
  - allowed_negative_limit NUMERIC?
  - is_active BOOLEAN?
  - notes TEXT?
  - created_by UUID?
  - created_at TIMESTAMPTZ?
  - updated_at TIMESTAMPTZ?

### employee_custody_transactions
  - id UUID? [PK]
  - employee_custody_account_id UUID
  - transaction_date DATE
  - transaction_type TEXT
  - amount NUMERIC
  - reference_type TEXT?
  - reference_id UUID?
  - notes TEXT?
  - created_by UUID?
  - created_at TIMESTAMPTZ?

### petty_expenses
  - id UUID? [PK]
  - company_id UUID
  - project_id UUID?
  - employee_custody_account_id UUID?
  - expense_group_id UUID?
  - expense_item_id UUID?
  - quantity NUMERIC?
  - unit_price NUMERIC?
  - total_amount NUMERIC
  - expense_date DATE
  - status TEXT
  - notes TEXT?
  - attachment_url TEXT?
  - created_by UUID?
  - pm_approved_by UUID?
  - pm_approved_at TIMESTAMPTZ?
  - gm_approved_by UUID?
  - gm_approved_at TIMESTAMPTZ?
  - created_at TIMESTAMPTZ?
  - updated_at TIMESTAMPTZ?

### financial_accounts
  - id UUID? [PK]
  - company_id UUID → companies
  - project_id UUID? → projects
  - account_type TEXT
  - arabic_name TEXT
  - english_name TEXT?
  - currency TEXT
  - is_active BOOLEAN
  - notes TEXT?
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ
  - created_by UUID? → users

### financial_transactions
  - id UUID? [PK]
  - financial_account_id UUID → financial_accounts
  - transaction_date DATE
  - transaction_type TEXT
  - amount NUMERIC
  - reference_type TEXT
  - reference_id UUID?
  - notes TEXT?
  - created_at TIMESTAMPTZ
  - created_by UUID? → users

### payment_vouchers
  - id UUID? [PK]
  - company_id UUID → companies
  - project_id UUID? → projects
  - voucher_no TEXT
  - payment_date DATE
  - payment_method TEXT
  - financial_account_id UUID? → financial_accounts
  - total_amount NUMERIC
  - direction TEXT
  - status TEXT
  - receipt_reference_no TEXT?
  - notes TEXT?
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ
  - created_by UUID? → users
  - posted_at TIMESTAMPTZ?
  - posted_by UUID? → users

### payment_voucher_parties
  - id UUID? [PK]
  - payment_voucher_id UUID → payment_vouchers
  - party_id UUID → parties
  - paid_amount NUMERIC
  - notes TEXT?
  - created_at TIMESTAMPTZ

### payment_allocations
  - id UUID? [PK]
  - payment_voucher_party_id UUID → payment_voucher_parties
  - source_entity_type TEXT
  - source_entity_id UUID
  - allocated_amount NUMERIC
  - created_at TIMESTAMPTZ

### audit_logs
  - id uuid? [PK]
  - performed_by uuid? → users
  - action text
  - entity_type text?
  - entity_id text?
  - description text?
  - metadata jsonb?
  - ip_address text?
  - created_at timestamptz

### expense_categories
  - id UUID? [PK]
  - company_id UUID → companies
  - parent_id UUID? → expense_categories
  - category_code VARCHAR
  - arabic_name TEXT
  - english_name TEXT?
  - is_active BOOLEAN
  - notes TEXT?
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ

### company_purchase_invoices
  - id UUID? [PK]
  - company_id UUID → companies
  - supplier_party_id UUID → parties
  - invoice_no VARCHAR
  - invoice_date DATE
  - invoice_type TEXT
  - expense_category_id UUID? → expense_categories
  - branch_id UUID? → branches
  - warehouse_id UUID? → warehouses
  - gross_amount DECIMAL
  - tax_amount DECIMAL
  - discount_amount DECIMAL
  - net_amount DECIMAL
  - paid_to_date DECIMAL
  - outstanding_amount DECIMAL
  - status TEXT
  - notes TEXT?
  - created_by UUID? → users
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ

### company_purchase_invoice_lines
  - id UUID? [PK]
  - invoice_id UUID → company_purchase_invoices
  - item_id UUID? → items
  - description TEXT
  - expense_category_id UUID? → expense_categories
  - quantity DECIMAL
  - unit_price DECIMAL
  - line_gross DECIMAL
  - line_net DECIMAL
  - notes TEXT?
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ

### document_sequences
  - company_id UUID → companies
  - document_type TEXT
  - prefix TEXT
  - current_value BIGINT
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ

### store_issue_approvals
  - id uuid? [PK]
  - store_issue_id uuid → store_issues
  - user_id uuid → users
  - role_type text
  - action_taken text
  - notes text?
  - action_at timestamptz

### company_purchase_returns
  - id UUID? [PK]
  - company_id UUID → companies
  - original_invoice_id UUID → company_purchase_invoices
  - return_no VARCHAR
  - return_date DATE
  - gross_amount DECIMAL
  - tax_amount DECIMAL
  - discount_amount DECIMAL
  - net_amount DECIMAL
  - status TEXT
  - notes TEXT?
  - created_by UUID? → users
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ

### company_purchase_return_lines
  - id UUID? [PK]
  - return_id UUID → company_purchase_returns
  - original_line_id UUID → company_purchase_invoice_lines
  - return_quantity DECIMAL
  - unit_price DECIMAL
  - line_gross DECIMAL
  - line_net DECIMAL
  - notes TEXT?
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ

### party_advance_balances
  - id uuid? [PK]
  - company_id uuid → companies
  - project_id uuid? → projects
  - party_id uuid → parties
  - party_type text
  - total_advanced numeric
  - total_deducted numeric
  - balance_remaining numeric?
  - updated_at timestamptz

