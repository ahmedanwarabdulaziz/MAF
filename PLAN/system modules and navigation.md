# Antigravity & Cloude - System Modules and Navigation

## Document Role

This document defines the Arabic-first module structure, navigation model, and main screen groups for the system.

It is intended to guide:

- product structure
- sidebar design
- dashboard planning
- role-based visibility
- page hierarchy
- Arabic labels and naming consistency

The application UI must remain Arabic-first and RTL, while technical identifiers and code-level names remain in English.

## 1. Navigation Philosophy

The product should be organized around two major surfaces:

- Public Website
- System Application

Inside the system application, navigation should then be organized around three internal contexts:

- Global Company Context
- Project Workspace Context
- Cross-System Shared Context

This means users should not feel that they are using one flat menu for everything, and they should not feel that the public website is the same thing as the operational system.

Instead:

- public content should live in the public website layer
- company-wide controls should live at the company level
- project operations should live inside the selected project workspace
- shared items such as notifications, approvals, and search should be accessible from anywhere

## 2. Public Website Structure

### 2.1 Public Website Purpose

The public website is the external-facing company presence.

It should communicate:

- who the company is
- what the company does
- selected work or portfolio
- trust and professionalism
- contact channels
- how authorized users access the system

### 2.2 Recommended Public Website Pages

Recommended Arabic-first public pages:

- `الرئيسية`
- `من نحن`
- `خدماتنا`
- `مشروعاتنا` or `سابقة الأعمال`
- `تواصل معنا`
- `الدخول إلى النظام`

### 2.3 Public Website Navigation Rule

The public website should remain simple, brand-focused, and lighter than the system application.

It should not expose internal business modules, operational sidebars, or authenticated data structures.

## 3. Main Application Shell

### 3.1 Top Bar

The top bar should include:

- company logo and system name
- global search
- current project selector
- current fiscal period if relevant
- approvals inbox
- notifications
- quick actions
- user profile menu

### 3.2 Primary Sidebar Logic

The sidebar should change based on context:

- if the user is in company context, show company modules
- if the user is inside a project, show project modules
- if the user lacks access to a module, hide it or show it as disabled based on policy

### 3.3 Project Switcher

The system should provide a clear project switcher so users can move between:

- Company View
- a selected Project View

This switcher is especially important for:

- executive management
- finance
- procurement
- warehouse leadership

## 4. Arabic Naming Rule

The UI should display Arabic labels, while the design documentation may preserve English technical names beside them.

Recommended pattern:

- Arabic Label
- Technical Key in English

Example:

- `Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ…` -> `dashboard`
- `Ø§Ù„Ù…Ø´Ø±ÙˆØ¹Ø§Øª` -> `projects`
- `Ø§Ù„Ù…Ù‚Ø§ÙˆÙ„ÙˆÙ†` -> `subcontractors`

## 5. Cross-System Shared Modules

These modules should be reachable from both company and project contexts where allowed.

| Arabic Label | Technical Key | Purpose |
| --- | --- | --- |
| Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ… | `dashboard` | Main landing page and KPIs |
| Ø§Ù„Ù…ÙˆØ§ÙÙ‚Ø§Øª | `approvals` | Pending approvals, returns, escalations |
| Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª | `notifications` | Alerts and system messages |
| Ø§Ù„Ù…Ù‡Ø§Ù… | `tasks` | Personal and assigned operational tasks |
| Ø§Ù„Ø¨Ø­Ø« | `search` | Search across projects, parties, and documents |
| Ø§Ù„Ù…Ø±ÙÙ‚Ø§Øª | `attachments` | Shared document access where permission allows |
| Ø§Ù„ØªÙ‚Ø§Ø±ÙŠØ± | `reports` | Role-based reporting entry point |

## 6. Company Context Modules

These modules belong to the parent company layer.

### 6.1 Recommended Company Sidebar

| Order | Arabic Label | Technical Key |
| --- | --- | --- |
| 1 | Ù„ÙˆØ­Ø© ØªØ­ÙƒÙ… Ø§Ù„Ø´Ø±ÙƒØ© | `company_dashboard` |
| 2 | Ø§Ù„Ù…Ø´Ø±ÙˆØ¹Ø§Øª | `projects` |
| 3 | Ø§Ù„Ø®Ø²ÙŠÙ†Ø© ÙˆØ§Ù„Ø­Ø³Ø§Ø¨Ø§Øª Ø§Ù„Ø¨Ù†ÙƒÙŠØ© | `financial_accounts` |
| 4 | Ø§Ù„Ø£ØµÙˆÙ„ | `assets` |
| 5 | Ø§Ù„Ù…Ø®Ø²Ù† Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ | `main_warehouse` |
| 6 | Ø§Ù„Ù…ÙˆØ±Ø¯ÙˆÙ† | `suppliers` |
| 7 | Ø§Ù„Ù…Ù‚Ø§ÙˆÙ„ÙˆÙ† | `subcontractors` |
| 8 | Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡ / Ø§Ù„Ù…Ù„Ø§Ùƒ | `owners_clients` |
| 9 | Ø§Ù„Ù…ØµØ±ÙˆÙØ§Øª Ø§Ù„Ø¹Ø§Ù…Ø© | `corporate_expenses` |
| 10 | Ø§Ù„Ù…ÙˆØ¸ÙÙˆÙ† ÙˆØ§Ù„ØµÙ„Ø§Ø­ÙŠØ§Øª | `users_access` |
| 11 | Ø§Ù„Ù…ÙˆØ§Ø²Ù†Ø§Øª ÙˆØ§Ù„Ø®Ø·Ø· | `budgets_plans` |
| 12 | Ø§Ù„ØªÙ‚Ø§Ø±ÙŠØ± Ø§Ù„Ù…Ø¬Ù…Ø¹Ø© | `consolidated_reports` |
| 13 | Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª | `settings` |

### 6.2 Company Dashboard

Arabic label:

- `Ù„ÙˆØ­Ø© ØªØ­ÙƒÙ… Ø§Ù„Ø´Ø±ÙƒØ©`

Recommended widgets:

- total company cash and bank balances
- deposits and certificates summary
- total project allocations
- active projects count
- total supplier payable
- total subcontractor payable
- total owner receivable
- main warehouse valuation
- corporate expenses this month
- alerts requiring management attention

### 6.3 Projects Module

Arabic label:

- `Ø§Ù„Ù…Ø´Ø±ÙˆØ¹Ø§Øª`

Recommended screens:

- project list
- project creation
- project onboarding type selection
- project cutover status
- project financial summary
- project profitability summary
- project settings

### 6.4 Treasury and Bank Module

Arabic label:

- `Ø§Ù„Ø®Ø²ÙŠÙ†Ø© ÙˆØ§Ù„Ø­Ø³Ø§Ø¨Ø§Øª Ø§Ù„Ø¨Ù†ÙƒÙŠØ©`

Recommended screens:

- cashboxes
- bank accounts
- deposits and certificates
- receipts
- payments
- transfers between accounts
- balances and reconciliation

### 6.5 Main Warehouse Module

Arabic label:

- `Ø§Ù„Ù…Ø®Ø²Ù† Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ`

Recommended screens:

- warehouse dashboard
- item groups
- items
- goods receipts
- stock issues
- stock returns
- transfers to projects
- stock valuation

### 6.6 Corporate Expenses Module

Arabic label:

- `Ø§Ù„Ù…ØµØ±ÙˆÙØ§Øª Ø§Ù„Ø¹Ø§Ù…Ø©`

Recommended screens:

- expense groups
- expense items
- corporate expense entries
- payment tracking
- monthly overhead summary

### 6.7 Consolidated Reports Module

Arabic label:

- `Ø§Ù„ØªÙ‚Ø§Ø±ÙŠØ± Ø§Ù„Ù…Ø¬Ù…Ø¹Ø©`

Recommended screens:

- company-wide profitability
- project comparison
- total liabilities by party type
- total receivables
- consolidated stock value
- budget versus actual at company level

## 7. Project Workspace Modules

These modules appear when a specific project is selected.

### 7.1 Recommended Project Sidebar

| Order | Arabic Label | Technical Key |
| --- | --- | --- |
| 1 | Ù„ÙˆØ­Ø© ØªØ­ÙƒÙ… Ø§Ù„Ù…Ø´Ø±ÙˆØ¹ | `project_dashboard` |
| 2 | Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø´Ø±ÙˆØ¹ | `project_profile` |
| 3 | Ø§Ù„Ù…ÙˆØ§Ø²Ù†Ø© ÙˆØ§Ù„ØªÙƒÙ„ÙØ© | `project_budget_cost` |
| 4 | Ø§Ù„Ù…Ù‚Ø§ÙˆÙ„ÙˆÙ† ÙˆØ§Ù„Ù…Ø³ØªØ®Ù„ØµØ§Øª | `subcontractor_certificates` |
| 5 | Ø§Ù„Ù…ÙˆØ±Ø¯ÙˆÙ† ÙˆØ§Ù„Ù…Ø´ØªØ±ÙŠØ§Øª | `suppliers_procurement` |
| 6 | Ù…Ø®Ø²Ù† Ø§Ù„Ù…Ø´Ø±ÙˆØ¹ | `project_warehouse` |
| 7 | ØµØ±Ù Ù…Ø®Ø²Ù†ÙŠ Ù„Ù„Ù…Ø´Ø±ÙˆØ¹ | `store_issued_cost` |
| 8 | Ø§Ù„Ø¹Ù‡Ø¯ ÙˆØ§Ù„Ù…ØµØ±ÙˆÙØ§Øª Ø§Ù„Ù†Ø«Ø±ÙŠØ© | `custody_petty_expenses` |
| 9 | ÙÙˆØ§ØªÙŠØ± / Ù…Ø³ØªØ®Ù„ØµØ§Øª Ø§Ù„Ù…Ø§Ù„Ùƒ | `owner_billing` |
| 10 | Ø§Ù„ØªØ­ØµÙŠÙ„Ø§Øª | `collections` |
| 11 | Ø§Ù„Ù…Ø¯ÙÙˆØ¹Ø§Øª | `project_payments` |
| 12 | Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª ÙˆØ§Ù„Ù…Ø±ÙÙ‚Ø§Øª | `project_documents` |
| 13 | Ø§Ù„ØªÙ‚Ø§Ø±ÙŠØ± | `project_reports` |
| 14 | Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù…Ø´Ø±ÙˆØ¹ | `project_settings` |

### 7.2 Project Dashboard

Arabic label:

- `Ù„ÙˆØ­Ø© ØªØ­ÙƒÙ… Ø§Ù„Ù…Ø´Ø±ÙˆØ¹`

Recommended widgets:

- project budget summary
- actual cost summary
- subcontractor payable
- supplier payable
- petty expense total
- store-issued material cost
- owner billed amount
- owner collected amount
- project cash or treasury balance
- pending approvals
- low-stock alerts
- overdue collections

### 7.3 Project Profile Module

Arabic label:

- `Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø´Ø±ÙˆØ¹`

Recommended screens:

- project basic information
- owner and authorized contacts
- onboarding type
- cutover details if existing project
- cost center details
- project team assignments

### 7.4 Project Budget and Cost Module

Arabic label:

- `Ø§Ù„Ù…ÙˆØ§Ø²Ù†Ø© ÙˆØ§Ù„ØªÙƒÙ„ÙØ©`

Recommended screens:

- budget versions
- budget by category
- budget by work item
- actual versus budget
- profitability view
- variance analysis

### 7.5 Subcontractors and Certificates Module

Arabic label:

- `Ø§Ù„Ù…Ù‚Ø§ÙˆÙ„ÙˆÙ† ÙˆØ§Ù„Ù…Ø³ØªØ®Ù„ØµØ§Øª`

Recommended screens:

- subcontractor list for the project
- subcontractor agreements
- work item catalog
- certificate list
- create certificate
- retention and deduction view
- allowance history
- subcontractor statement
- retention release

### 7.6 Suppliers and Procurement Module

Arabic label:

- `Ø§Ù„Ù…ÙˆØ±Ø¯ÙˆÙ† ÙˆØ§Ù„Ù…Ø´ØªØ±ÙŠØ§Øª`

Recommended screens:

- supplier list for the project
- purchase requests
- purchase orders
- supplier invoices
- return invoices
- receipt confirmation
- supplier statement
- outstanding balance summary

### 7.7 Project Warehouse Module

Arabic label:

- `Ù…Ø®Ø²Ù† Ø§Ù„Ù…Ø´Ø±ÙˆØ¹`

Recommended screens:

- current stock
- receipts from suppliers
- transfers from main warehouse
- transfers to other project warehouses
- returns to main warehouse
- returns to supplier
- damaged or wasted stock
- stock valuation

### 7.8 Store-Issued Cost Module

Arabic label:

- `ØµØ±Ù Ù…Ø®Ø²Ù†ÙŠ Ù„Ù„Ù…Ø´Ø±ÙˆØ¹`

Recommended screens:

- issue to engineer or site
- return from engineer or site
- material consumption ledger
- material cost by item
- material cost by work category

This module should make the fourth project expense stream visible clearly.

### 7.9 Custody and Petty Expenses Module

Arabic label:

- `Ø§Ù„Ø¹Ù‡Ø¯ ÙˆØ§Ù„Ù…ØµØ±ÙˆÙØ§Øª Ø§Ù„Ù†Ø«Ø±ÙŠØ©`

Recommended screens:

- custody accounts
- temporary advances
- petty expense entry
- reimbursement requests
- custody balance statement
- negative balance alerts

### 7.10 Owner Billing Module

Arabic label:

- `ÙÙˆØ§ØªÙŠØ± / Ù…Ø³ØªØ®Ù„ØµØ§Øª Ø§Ù„Ù…Ø§Ù„Ùƒ`

Recommended screens:

- owner billing list
- draft owner billable lines
- create owner certificate or invoice
- owner line pricing
- owner-facing description editing
- billed versus unbilled work
- receivable aging

### 7.11 Collections Module

Arabic label:

- `Ø§Ù„ØªØ­ØµÙŠÙ„Ø§Øª`

Recommended screens:

- owner collection entries
- collection history
- account receiving details
- remaining receivable balance

### 7.12 Project Payments Module

Arabic label:

- `Ø§Ù„Ù…Ø¯ÙÙˆØ¹Ø§Øª`

Recommended screens:

- approved payments queue
- subcontractor payments
- supplier payments
- petty reimbursement payments
- payment vouchers
- treasury source and receipt tracking

### 7.13 Project Documents Module

Arabic label:

- `Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª ÙˆØ§Ù„Ù…Ø±ÙÙ‚Ø§Øª`

Recommended screens:

- project document library
- filtered attachments by module
- outgoing correspondence
- owner-facing files
- payment proof files

### 7.14 Project Reports Module

Arabic label:

- `Ø§Ù„ØªÙ‚Ø§Ø±ÙŠØ±`

Recommended screens:

- project profitability
- subcontractor statement
- supplier statement
- owner receivables
- petty expenses summary
- warehouse valuation
- material consumption report
- budget versus actual

## 8. Shared Workflow Screens

Certain screens should appear consistently across modules.

Recommended shared screen patterns:

- list screen
- create screen
- detail screen
- approval history tab
- attachments tab
- audit log tab where authorized
- print and export actions

## 9. Arabic Dashboard and KPI Rules

The dashboard language should be Arabic, but numeric presentation should use English numerals.

Recommended display rules:

- Arabic labels for all cards and charts
- English numerals for amounts, dates, and quantities
- clear status labels in Arabic
- compact summary cards with drill-down actions

## 10. Role-Based Navigation Visibility

The sidebar should adapt to role and scope.

Examples:

- Executive Management sees company dashboard, consolidated reports, approvals, projects, and financial summaries
- Finance Manager sees treasury, payments, supplier balances, subcontractor balances, owner collections, and reports
- Project Manager sees project dashboard, subcontractors, suppliers, warehouse, petty expenses, owner billing visibility, and approvals
- Site Engineer sees limited project screens such as certificates, purchase requests, store issues, petty expenses, and assigned tasks
- Warehouse Manager sees warehouse modules, receipt confirmation, stock movement, and stock reports
- Internal Auditor sees audit-enabled read access, workflow history, payments, and key reports

## 11. Navigation Rules for Existing Project Cutover

If a project is created as an existing ongoing project:

- the project workspace should show a cutover banner until migration is complete
- operational modules should remain blocked or limited until cutover approval
- the sidebar should include a temporary `Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„ØªØ±Ø­ÙŠÙ„ Ø§Ù„Ø§ÙØªØªØ§Ø­ÙŠ` entry during migration

Technical key:

- `project_cutover`

Recommended cutover screens inside the project workspace:

- cutover setup
- opening balances
- opening subcontractor positions
- opening supplier positions
- opening owner receivables
- opening stock
- opening custody balances
- review and lock

## 12. Quick Actions

Recommended quick actions in the top bar or dashboard:

- Ø¥Ù†Ø´Ø§Ø¡ Ù…Ø´Ø±ÙˆØ¹ Ø¬Ø¯ÙŠØ¯
- Ø¥Ù†Ø´Ø§Ø¡ Ù…Ø³ØªØ®Ù„Øµ Ù…Ù‚Ø§ÙˆÙ„
- Ø¥Ù†Ø´Ø§Ø¡ Ø·Ù„Ø¨ Ø´Ø±Ø§Ø¡
- Ø¥Ø¯Ø®Ø§Ù„ ÙØ§ØªÙˆØ±Ø© Ù…ÙˆØ±Ø¯
- ØµØ±Ù Ù…Ø®Ø²Ù†ÙŠ
- ØªØ³Ø¬ÙŠÙ„ Ù…ØµØ±ÙˆÙ Ù†Ø«Ø±ÙŠ
- Ø¥Ù†Ø´Ø§Ø¡ ÙØ§ØªÙˆØ±Ø© Ù…Ø§Ù„Ùƒ
- ØªØ³Ø¬ÙŠÙ„ ØªØ­ØµÙŠÙ„
- ØªØ³Ø¬ÙŠÙ„ Ø³Ø¯Ø§Ø¯

## 13. Recommended Landing Pages by Role

Recommended defaults:

- Executive Management -> `Ù„ÙˆØ­Ø© ØªØ­ÙƒÙ… Ø§Ù„Ø´Ø±ÙƒØ©`
- Finance Manager -> `Ø§Ù„Ø®Ø²ÙŠÙ†Ø© ÙˆØ§Ù„Ø­Ø³Ø§Ø¨Ø§Øª Ø§Ù„Ø¨Ù†ÙƒÙŠØ©`
- Accountant -> `Ø§Ù„Ù…ÙˆØ§ÙÙ‚Ø§Øª` or `Ø§Ù„Ù…Ø¯ÙÙˆØ¹Ø§Øª`
- Project Manager -> `Ù„ÙˆØ­Ø© ØªØ­ÙƒÙ… Ø§Ù„Ù…Ø´Ø±ÙˆØ¹`
- Site Engineer -> `Ø§Ù„Ù…Ù‡Ø§Ù…` or `Ø§Ù„Ù…Ù‚Ø§ÙˆÙ„ÙˆÙ† ÙˆØ§Ù„Ù…Ø³ØªØ®Ù„ØµØ§Øª`
- Warehouse Manager -> `Ù…Ø®Ø²Ù† Ø§Ù„Ù…Ø´Ø±ÙˆØ¹`
- Internal Auditor -> `Ø§Ù„ØªÙ‚Ø§Ø±ÙŠØ±` or `Ø§Ù„Ù…ÙˆØ§ÙÙ‚Ø§Øª`

## 14. Design Decision

The system navigation should be implemented as an Arabic-first, role-aware, context-sensitive structure with:

- a public website surface
- a company workspace
- a project workspace
- shared approval and notification access
- separate operational modules for each major business stream

This navigation model will make the product easier to scale, easier to secure, and easier for non-technical business users to understand.

