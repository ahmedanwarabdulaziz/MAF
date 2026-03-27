# Antigravity & Cloude - Database Design

## Document Role

This document translates the approved master plan into a practical database structure.

It is the schema design reference for:

- core master data
- project separation and company roll-up
- approvals and audit logging
- warehouse and inventory movement
- subcontractor certificates
- supplier purchasing and invoices
- owner billing and collections
- employee custody and petty expenses
- treasury, payments, and balances

This is a living document and will evolve as workflows become more detailed.

## 1. Database Design Principles

### 1.1 Language Rule

The application UI is Arabic-first, but the database structure should remain in English.

Therefore:

- table names must be in English
- column names must be in English
- enum values and technical constants should be in English
- user-facing Arabic labels should be handled by the application layer, not the database schema

### 1.2 Scope Rule

The database must support:

- one parent company
- many projects
- company-wide reporting
- project-level operational separation

This is not a marketplace or multi-customer SaaS design. It is a single-company operational system with strong project isolation inside one business.

### 1.3 Core Data Rules

Recommended conventions:

- primary keys: `uuid`
- human-readable document numbers: separate text field
- money fields: `numeric(18,2)`
- quantity fields: `numeric(18,4)` unless business rules require more precision
- timestamps: `created_at`, `updated_at`
- actor references where needed: `created_by`, `updated_by`
- soft delete for business records: `archived_at`, `archived_by`
- immutable audit logs for sensitive activity

### 1.4 Separation of Concerns

The schema should separate:

- master data
- transactional data
- workflow data
- audit data
- reporting or summary data

Operational reports should be derived from transactional tables wherever possible, not stored as manually editable summary records.

### 1.5 Financial Control Rule

The database must preserve the difference between:

- planned allocation
- approved budget
- actual liability
- actual payment
- actual collection
- inventory value
- project consumption cost

These concepts must not be merged into one generic amount field.

## 2. Core Shared Tables

### 2.1 Company and Organizational Structure

Recommended tables:

- `companies`
- `branches`
- `projects`
- `cost_centers`
- `departments`

Key points:

- `companies` will likely contain a single active row, but should still exist explicitly
- `projects` must link to `companies`
- each project should link to a dedicated `cost_center`
- parent company activities may also use corporate-level cost centers

### 2.2 Users, Employees, and Access

Recommended tables:

- `users`
- `employee_profiles`
- `roles`
- `permission_groups`
- `permissions`
- `permission_group_permissions`
- `user_role_assignments`
- `user_permission_group_assignments`
- `user_access_scopes`
- `project_user_assignments`
- `warehouse_user_assignments`
- `approval_delegations`

Important notes:

- one user may hold multiple roles
- one user may belong to multiple permission groups
- permission groups should be editable without changing business role
- access must be limited by explicit scope assignment
- delegation must be time-bound and auditable

Recommended separation:

- `roles` = organizational or job-function identity
- `permission_groups` = actual reusable access bundles
- `user_access_scopes` = where the user's permissions apply

Suggested fields in `permission_groups`:

- `id`
- `group_key`
- `group_name`
- `is_system_group`
- `is_active`
- `notes`

Suggested fields in `permission_group_permissions`:

- `id`
- `permission_group_id`
- `permission_key`
- `action_key`
- `is_allowed`

Suggested fields in `user_permission_group_assignments`:

- `id`
- `user_id`
- `permission_group_id`
- `assigned_by`
- `assigned_at`
- `is_active`

Suggested fields in `user_access_scopes`:

- `id`
- `user_id`
- `scope_type`
- `project_id` nullable
- `warehouse_id` nullable
- `granted_by`
- `granted_at`
- `is_active`

Recommended `scope_type` values:

- `main_company`
- `all_projects`
- `selected_project`
- `selected_warehouse`

### 2.3 Parties and Contacts

Recommended tables:

- `parties`
- `party_roles`
- `party_role_accounts`
- `party_contacts`
- `project_parties`

Suggested approach:

- `parties` stores the main business entity
- `party_roles` stores which business roles that entity may play
- `party_role_accounts` stores the independent financial identity of each role
- `party_contacts` stores people related to that entity
- `project_parties` links a party to a project and defines its role in that project

Recommended `party_roles.role_type` options:

- `owner`
- `subcontractor`
- `supplier`
- `other`

Recommended fields in `parties`:

- `id`
- `arabic_name`
- `english_name`
- `phone`
- `email`
- `address`
- `tax_number`
- `notes`

Recommended fields in `party_roles`:

- `id`
- `party_id`
- `role_type`
- `is_active`
- `notes`

Recommended fields in `party_role_accounts`:

- `id`
- `party_id`
- `role_type`
- `project_id` nullable for company-level roles
- `account_code`
- `status`
- `notes`

Important accounting rule:

- the same legal party may act as supplier, subcontractor, or owner
- each role must keep an independent account, balance, and statement
- balances must not be automatically netted across roles
- project-specific balances may also need to remain separate from company-wide balances

Example:

- the same company may be both a supplier and a subcontractor
- the supplier balance must remain separate from the subcontractor balance
- if the same party works on more than one project, project-level balances may also need separate reporting

Recommended fields in `party_contacts`:

- `id`
- `party_id`
- `full_name`
- `job_title`
- `email`
- `phone`
- `is_primary`
- `preferred_language`
- `notes`

Recommended fields in `project_parties`:

- `id`
- `project_id`
- `party_id`
- `project_role`
- `status`
- `start_date`
- `end_date`
- `notes`

## 3. Project Structure and Financial Identity

### 3.1 Projects

Recommended `projects` fields:

- `id`
- `company_id`
- `cost_center_id`
- `project_code`
- `arabic_name`
- `english_name`
- `status`
- `project_onboarding_type`
- `start_date`
- `expected_end_date`
- `location`
- `project_type`
- `project_manager_user_id`
- `owner_party_id`
- `planned_allocation_amount`
- `estimated_contract_value`
- `cutover_date`
- `migration_status`
- `opening_balances_approved`
- `opening_data_locked_at`
- `notes`

### 3.2 Project Authorized Contacts

Owner-side authorized contacts may be modeled through `party_contacts`, but the project should also support project-specific contact linkage.

Recommended table:

- `project_party_contacts`

Suggested fields:

- `id`
- `project_id`
- `party_id`
- `party_contact_id`
- `contact_role`
- `is_primary_for_project`
- `notes`

### 3.3 Project Financial Identity

Recommended tables:

- `project_allocations`
- `project_funding_movements`
- `project_budget_headers`
- `project_budget_lines`
- `project_migration_batches`
- `project_opening_balance_entries`
- `project_opening_operational_entries`

Purpose:

- `project_allocations` stores planning indicators only
- `project_funding_movements` stores actual transfers or funding activity
- `project_budget_headers` stores budget versions
- `project_budget_lines` stores category-level or item-level budgets
- `project_migration_batches` stores the cutover event for existing projects
- `project_opening_balance_entries` stores opening financial balances as of cutover
- `project_opening_operational_entries` stores opening operational positions such as quantities, open documents, and outstanding obligations

Recommended `project_onboarding_type` values:

- `new`
- `existing`

Recommended `migration_status` values:

- `not_required`
- `draft`
- `in_progress`
- `ready_for_review`
- `approved`
- `locked`

Suggested `project_migration_batches` fields:

- `id`
- `project_id`
- `cutover_date`
- `status`
- `approved_by`
- `approved_at`
- `locked_at`
- `notes`

Suggested `project_opening_balance_entries` fields:

- `id`
- `migration_batch_id`
- `balance_type`
- `party_id` nullable
- `party_role_type` nullable
- `financial_account_id` nullable
- `warehouse_id` nullable
- `item_id` nullable
- `amount`
- `quantity`
- `unit_cost`
- `notes`

Suggested `project_opening_operational_entries` fields:

- `id`
- `migration_batch_id`
- `entity_type`
- `entity_reference`
- `party_id` nullable
- `project_work_item_id` nullable
- `document_no` nullable
- `previous_quantity`
- `cumulative_quantity`
- `gross_amount`
- `taaliya_amount`
- `paid_amount`
- `outstanding_amount`
- `notes`

## 4. Approval, Workflow, and Audit

### 4.1 Workflow Definitions

Recommended tables:

- `workflow_definitions`
- `workflow_definition_steps`
- `workflow_definition_step_roles`

These tables define:

- module type
- transaction type
- amount thresholds
- routing logic
- sequential or parallel approval behavior
- minimum required approvals
- eligibility by role, permission group, or scope where needed

### 4.2 Workflow Runtime Tables

Recommended tables:

- `workflow_instances`
- `workflow_instance_steps`
- `workflow_actions`

Purpose:

- store the active workflow state for each document
- store step status
- store who approved, rejected, returned, or delegated
- preserve comments and timestamps

### 4.3 Audit and Traceability

Recommended tables:

- `audit_logs`
- `entity_change_logs`
- `file_attachments`
- `attachment_access_logs`

Suggested `audit_logs` fields:

- `id`
- `entity_type`
- `entity_id`
- `action_type`
- `performed_by`
- `performed_at`
- `project_id`
- `remarks`
- `ip_address` if available

Suggested `entity_change_logs` fields:

- `id`
- `entity_type`
- `entity_id`
- `field_name`
- `old_value`
- `new_value`
- `changed_by`
- `changed_at`

## 5. Treasury, Banks, Assets, and Corporate Expenses

### 5.1 Treasury and Bank Accounts

Recommended tables:

- `financial_accounts`
- `financial_account_balances`
- `financial_transactions`

Recommended `account_type` values:

- `cashbox`
- `bank`
- `deposit`
- `certificate`

Purpose:

- parent company treasury
- project-level treasury if enabled
- bank accounts
- controlled tracking of incoming and outgoing money

### 5.2 Corporate Assets

Recommended tables:

- `asset_categories`
- `assets`
- `asset_movements`

This area should support:

- units, offices, or shops
- equipment
- tools
- reusable operational materials if treated as assets instead of inventory

### 5.3 Corporate Expenses

Recommended tables:

- `expense_groups`
- `expense_items`
- `corporate_expense_claims`
- `corporate_expense_payments`

These tables are for non-project expenses such as:

- administrative salaries
- office rent
- branch expenses
- overhead payments

## 6. Warehouse and Inventory

### 6.1 Core Inventory Tables

Recommended tables:

- `warehouses`
- `item_groups`
- `items`
- `item_units`
- `item_cost_profiles`
- `stock_ledger`
- `stock_balances`

Important notes:

- one main warehouse should exist at company level
- projects may have one or more warehouses
- `stock_ledger` should be the source of truth for movement history
- `stock_balances` may be maintained as a derived current-balance table for performance

### 6.2 Warehouse Types

Recommended `warehouse_type` values:

- `main_company`
- `project`
- `temporary`

### 6.3 Stock Movement Tables

Recommended tables:

- `goods_receipts`
- `goods_receipt_lines`
- `store_issues`
- `store_issue_lines`
- `store_returns`
- `store_return_lines`
- `warehouse_transfers`
- `warehouse_transfer_lines`
- `stock_adjustments`
- `stock_adjustment_lines`

Purpose:

- receipt from supplier
- issue to project consumption
- return from site or engineer
- transfer between warehouses
- return to supplier
- controlled loss, waste, or damage adjustments

### 6.4 Inventory Cost Rule

The schema must support quantity and value movement together.

Recommended design behavior:

- every stock movement line stores quantity
- every value-impacting line stores unit cost and total cost
- project consumption cost should come from store issue transactions, not from purchase invoice entry alone

## 7. Subcontractor Management

### 7.1 Project-Specific Subcontract Setup

Recommended tables:

- `subcontract_agreements`
- `subcontract_agreement_lines`

Suggested `subcontract_agreements` fields:

- `id`
- `project_id`
- `subcontractor_party_id`
- `agreement_code`
- `status`
- `default_taaliya_type`
- `default_taaliya_value`
- `start_date`
- `end_date`
- `notes`

Suggested `subcontract_agreement_lines` fields:

- `id`
- `subcontract_agreement_id`
- `work_item_id`
- `unit_id`
- `agreed_rate`
- `default_taaliya_type`
- `default_taaliya_value`
- `owner_billable_default`
- `notes`

### 7.2 Project Work Item Catalog

Recommended tables:

- `project_work_items`
- `project_work_item_units`

Suggested fields in `project_work_items`:

- `id`
- `project_id`
- `item_code`
- `arabic_description`
- `english_description`
- `default_unit_id`
- `is_active`
- `notes`

### 7.3 Subcontractor Certificates

Recommended tables:

- `subcontractor_certificates`
- `subcontractor_certificate_lines`
- `subcontractor_certificate_allowances`
- `subcontractor_certificate_deductions`
- `subcontractor_retention_releases`

Suggested `subcontractor_certificates` fields:

- `id`
- `project_id`
- `subcontractor_party_id`
- `subcontract_agreement_id`
- `certificate_no`
- `certificate_date`
- `period_from`
- `period_to`
- `status`
- `gross_amount`
- `taaliya_amount`
- `other_deductions_amount`
- `net_amount`
- `paid_to_date`
- `outstanding_amount`
- `notes`

Suggested `subcontractor_certificate_lines` fields:

- `id`
- `certificate_id`
- `project_work_item_id`
- `unit_id`
- `previous_quantity`
- `current_quantity`
- `cumulative_quantity`
- `agreed_rate`
- `gross_line_amount`
- `taaliya_type`
- `taaliya_value`
- `taaliya_amount`
- `net_line_amount`
- `owner_billable`
- `owner_description_override`
- `notes`

Suggested `subcontractor_certificate_allowances` fields:

- `id`
- `certificate_line_id`
- `base_project_work_item_id`
- `current_quantity`
- `allowance_rate_difference`
- `allowance_amount`
- `reason`
- `approval_reference`
- `show_as_notice_in_next_certificate`

Suggested `subcontractor_certificate_deductions` fields:

- `id`
- `certificate_id`
- `deduction_type`
- `calculation_type`
- `rate_or_amount`
- `deduction_amount`
- `notes`

### 7.4 Key Subcontractor Logic

The schema must support:

- cumulative quantity tracking
- previous quantity snapshot storage
- Ta'liya at subcontractor, certificate, and line levels
- Allowance linked to a base work item without changing the base rate
- payment settlement independent from certificate creation

## 8. Supplier Procurement and Invoices

### 8.1 Procurement Core Tables

Recommended tables:

- `purchase_requests`
- `purchase_request_lines`
- `purchase_orders`
- `purchase_order_lines`
- `supplier_invoices`
- `supplier_invoice_lines`
- `supplier_return_invoices`
- `supplier_return_invoice_lines`

### 8.2 Warehouse Integration

All supplier purchasing must pass through warehouse control.

Recommended supporting tables:

- `invoice_receipt_confirmations`
- `invoice_receipt_confirmation_users`

Purpose:

- confirm receipt against supplier invoice
- enforce PM and warehouse-manager confirmation
- record delegated confirmation by authorized substitute only

### 8.3 Supplier Balance Tracking

Recommended tables:

- `supplier_account_summaries`
- `supplier_invoice_allocations`

Note:

- `supplier_account_summaries` may be a materialized summary table or reporting view
- liability should still be based on underlying invoices, returns, and payments

## 9. Owner Billing and Collections

### 9.1 Owner Billing Core Tables

Recommended tables:

- `owner_billing_documents`
- `owner_billing_lines`
- `owner_billing_source_links`
- `owner_collections`

Suggested `owner_billing_documents` fields:

- `id`
- `project_id`
- `owner_party_id`
- `document_no`
- `document_type`
- `billing_date`
- `status`
- `gross_amount`
- `notes`

Suggested `owner_billing_lines` fields:

- `id`
- `owner_billing_document_id`
- `line_description`
- `unit_id`
- `quantity`
- `unit_price`
- `line_total`
- `source_type`
- `source_reference_id`
- `notes`

### 9.2 Owner Billing Source Rule

Owner billing lines may come from:

- subcontractor certificate lines
- supplier-related project lines that the business wants to expose to the owner

Owner billing lines must not come from:

- petty expenses

### 9.3 Owner Collections

Suggested `owner_collections` fields:

- `id`
- `owner_billing_document_id`
- `project_id`
- `received_amount`
- `received_date`
- `financial_account_id`
- `reference_no`
- `attachment_id`
- `notes`

## 10. Payments and Settlement

### 10.1 Payment Vouchers

Recommended tables:

- `payment_vouchers`
- `payment_voucher_parties`
- `payment_allocations`

Suggested `payment_vouchers` fields:

- `id`
- `voucher_no`
- `project_id` nullable where corporate payment
- `payment_date`
- `payment_method`
- `financial_account_id`
- `total_amount`
- `status`
- `receipt_reference_no`
- `notes`

Suggested `payment_voucher_parties` fields:

- `id`
- `payment_voucher_id`
- `party_id`
- `party_role_type`
- `approved_payment_amount`
- `paid_amount`

Suggested `payment_allocations` fields:

- `id`
- `payment_voucher_id`
- `source_entity_type`
- `source_entity_id`
- `allocated_amount`

This design allows:

- payment by total outstanding balance
- optional allocation to multiple open invoices or certificates
- partial settlement

## 11. Employee Custody and Petty Expenses

### 11.1 Custody Accounts

Recommended tables:

- `employee_custody_accounts`
- `employee_custody_transactions`

Suggested `employee_custody_accounts` fields:

- `id`
- `employee_user_id`
- `project_id`
- `account_type`
- `allowed_negative_limit`
- `is_active`
- `notes`

Recommended `account_type` values:

- `permanent`
- `temporary`

### 11.2 Petty Expense Tables

Recommended tables:

- `petty_expenses`
- `petty_expense_attachments`

Suggested `petty_expenses` fields:

- `id`
- `project_id`
- `employee_custody_account_id`
- `expense_group_id`
- `expense_item_id`
- `quantity`
- `total_amount`
- `expense_date`
- `status`
- `notes`

The reimbursement event should normally be stored as a custody transaction rather than a separate financial concept.

## 12. Document Numbering and Attachments

### 12.1 Number Sequences

Recommended tables:

- `number_sequences`
- `number_sequence_counters`

The schema should support:

- project-based numbering for project operational documents
- company-level numbering for selected finance vouchers if needed
- fiscal-year-aware numbering if finance policy requires it

### 12.2 Attachments

Recommended tables:

- `attachments`
- `attachment_links`

Suggested `attachments` fields:

- `id`
- `storage_bucket`
- `storage_path`
- `original_file_name`
- `mime_type`
- `file_size`
- `uploaded_by`
- `uploaded_at`

Suggested `attachment_links` fields:

- `id`
- `attachment_id`
- `entity_type`
- `entity_id`
- `document_role`

This avoids duplicating file metadata across modules.

## 13. Reporting and Derived Views

The following should preferably be views or generated reports, not manually edited tables:

- project profitability summary
- project expense ledger by source stream
- subcontractor statement
- supplier balance statement
- owner receivables statement
- project budget versus actual
- warehouse stock valuation
- custody balance summary
- company consolidated financial view

## 14. Recommended Relationship Map

High-level relationship flow:

- one `company` has many `projects`
- one `project` has one main `cost_center`
- one `project` has many `warehouses`
- one `project` has many `project_parties`
- one `subcontract_agreement` belongs to one project and one subcontractor
- one `subcontractor_certificate` belongs to one project and one subcontractor agreement
- one `supplier_invoice` may lead to one or more warehouse receipt confirmations
- one `owner_billing_document` belongs to one project and one owner
- one `employee_custody_account` belongs to one employee and optionally one project
- one `payment_voucher` may allocate to many source documents

## 15. Open Design Items for Next Discussion

These items should be finalized before writing migrations:

- final decision on inventory costing policy such as weighted average or another approved method
- whether project treasury accounts are always required or optional per project
- exact tax and deduction models for subcontractor certificates
- whether purchase orders are mandatory in all supplier cases or optional in phase one
- fiscal-year numbering format for finance vouchers
- how detailed owner billing source links should be for supplier-related lines
- final budget versioning rules
- asset depreciation policy if fixed assets will be managed deeply inside the same system

## 16. Initial Design Decision

The first database design direction should follow these principles:

- keep the schema in English
- keep project operations separated but financially connected
- use explicit workflow and audit tables
- store inventory as movement-based data
- treat subcontractors, suppliers, owners, and employees as structured entities with clear document flows
- keep payment settlement flexible without losing traceability

This file is the foundation for the next stage: turning each module into final tables, columns, constraints, and migration order.
