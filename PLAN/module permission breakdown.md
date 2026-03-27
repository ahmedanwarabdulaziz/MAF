# Antigravity & Cloude - Module Permission Breakdown

## Document Role

This document converts the role and permission model into a practical default module-by-module permission matrix.

It is intended to define:

- what each default permission group can do
- which modules are visible to each group
- which groups can create, review, approve, or execute
- how company scope and project scope affect module access

This is the default starter model only. Super Admin should be able to edit it later through permission group management.

## 1. Permission Evaluation Logic

Effective access should be calculated in this order:

1. User is active
2. User has one or more permission groups
3. User has valid access scope for the requested company, project, or warehouse
4. Record state allows the action
5. Workflow eligibility allows the action where approval is required

Important rule:

- no scope means no data access even if the permission group contains the module

## 2. Default Permission Group Codes

| Code | Permission Group |
| --- | --- |
| `SA` | `super_admin_full_control` |
| `EMV` | `executive_management_view` |
| `FNC` | `finance_control` |
| `FNO` | `finance_operations` |
| `TRE` | `treasury_operations` |
| `PRC` | `procurement_control` |
| `PRO` | `procurement_operations` |
| `PMC` | `project_management_control` |
| `SEO` | `site_engineering_operations` |
| `WHC` | `warehouse_control` |
| `DOC` | `document_control` |
| `IAR` | `internal_audit_read` |
| `MRO` | `management_read_only` |

## 3. Access Profile Codes

| Code | Meaning |
| --- | --- |
| `ADM` | Full administration, configuration, lock/unlock, archive, export, and module management |
| `MGR` | Full record management inside the module, including create, edit, submit, review, approve, reject, return, export, and archive where allowed |
| `REV` | Review and approval rights for assigned items, including view, print, export, approve, reject, and return |
| `FIN` | Finance or treasury execution rights, including view, create execution records, confirm payment or collection, print, export, and attach proof |
| `OPR` | Operational entry rights, including view, create, edit draft, attach files, submit, and print |
| `WH` | Warehouse operation and confirmation rights, including receipts, issues, returns, transfers, confirmations, and stock documents within warehouse scope |
| `DOC` | Document-management rights, including upload, organize, classify, link, and print documents |
| `VEX` | View, print, and export only |
| `VW` | View and print only |
| `---` | No access |

Important control note:

- for sensitive finance and warehouse modules, physical deletion should not be available in normal operation
- the default behavior should be archive, cancel, reverse, or formal adjustment

## 4. Shared Modules Matrix

| Module | SA | EMV | FNC | FNO | TRE | PRC | PRO | PMC | SEO | WHC | DOC | IAR | MRO |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard | ADM | VEX | VEX | VW | VW | VW | VW | VEX | VW | VW | VW | VEX | VEX |
| Approvals | ADM | REV | REV | VW | VW | REV | VW | REV | VW | VW | --- | VEX | --- |
| Notifications | ADM | VW | VW | VW | VW | VW | VW | VW | VW | VW | VW | VW | VW |
| Tasks | ADM | VW | VW | VW | VW | VW | VW | VW | OPR | VW | VW | VW | --- |
| Search | ADM | VEX | VEX | VW | VW | VW | VW | VW | VW | VW | VEX | VEX | VEX |
| Attachments | ADM | VW | VW | OPR | VW | VW | VW | VW | OPR | OPR | DOC | VEX | VW |
| Reports Entry | ADM | VEX | VEX | VEX | VW | VW | VW | VEX | VW | VW | VW | VEX | VEX |

## 5. Governance and Administration Modules Matrix

| Module | SA | EMV | FNC | FNO | TRE | PRC | PRO | PMC | SEO | WHC | DOC | IAR | MRO |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Projects | ADM | VEX | VEX | VW | VW | VW | VW | VW | VW | VW | VW | VEX | VEX |
| Cutover | ADM | REV | REV | OPR | --- | --- | --- | REV | OPR | OPR | --- | VEX | --- |
| Users and Access | ADM | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | VEX | --- |
| Approval Workflows | ADM | --- | VW | --- | --- | --- | --- | --- | --- | --- | --- | VEX | --- |
| Settings | ADM | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | VW | --- |

## 6. Company-Level Modules Matrix

| Module | SA | EMV | FNC | FNO | TRE | PRC | PRO | PMC | SEO | WHC | DOC | IAR | MRO |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Treasury and Bank Accounts | ADM | VEX | REV | OPR | FIN | --- | --- | VW | --- | --- | --- | VEX | VEX |
| Assets | ADM | VEX | VEX | --- | --- | --- | --- | --- | --- | --- | --- | VEX | VEX |
| Party Masters | ADM | VEX | VEX | OPR | VW | OPR | OPR | VW | --- | --- | VW | VEX | VEX |
| Item Master | ADM | VW | VW | --- | --- | VW | --- | VW | VW | VW | --- | VEX | VW |
| Main Warehouse | ADM | VEX | VEX | VW | --- | VW | VW | --- | --- | WH | --- | VEX | VEX |
| Corporate Expenses | ADM | VEX | REV | OPR | VW | --- | --- | --- | --- | --- | --- | VEX | VEX |
| Consolidated Reports | ADM | VEX | VEX | VEX | VW | VW | VW | VEX | --- | VW | --- | VEX | VEX |

## 7. Project Workspace Modules Matrix

| Module | SA | EMV | FNC | FNO | TRE | PRC | PRO | PMC | SEO | WHC | DOC | IAR | MRO |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Project Profile | ADM | VEX | VW | VW | --- | --- | --- | OPR | VW | --- | VW | VEX | VEX |
| Project Budget and Cost | ADM | VEX | VEX | VW | --- | --- | --- | REV | VW | --- | --- | VEX | VEX |
| Subcontractor Certificates | ADM | VEX | REV | VW | VW | --- | --- | REV | OPR | --- | VW | VEX | VEX |
| Supplier Procurement and Invoices | ADM | VEX | REV | OPR | VW | REV | OPR | REV | OPR | WH | VW | VEX | VEX |
| Project Warehouse | ADM | VEX | VW | VW | --- | VW | VW | REV | VW | WH | VW | VEX | VEX |
| Store-Issued Cost | ADM | VEX | VEX | VW | --- | --- | --- | REV | OPR | WH | --- | VEX | VEX |
| Employee Custody and Petty Expenses | ADM | VEX | REV | OPR | VW | --- | --- | REV | OPR | --- | --- | VEX | VEX |
| Owner Billing and Collections | ADM | VEX | REV | OPR | FIN | --- | --- | VW | --- | --- | DOC | VEX | VEX |
| Payments | ADM | VEX | REV | OPR | FIN | --- | --- | VW | --- | --- | VW | VEX | VEX |
| Project Documents | ADM | VW | VW | VW | VW | VW | VW | OPR | OPR | VW | DOC | VEX | VW |
| Project Reports | ADM | VEX | VEX | VEX | VW | VW | VW | VEX | VW | VW | VW | VEX | VEX |

## 8. High-Risk Module Rules

### 8.1 Users and Access

Default rule:

- only `SA` may manage users, permission groups, scopes, and administrative access assignments
- `IAR` may view and export for audit review only

### 8.2 Approval Workflows

Default rule:

- only `SA` may create, edit, activate, deactivate, or redesign workflow definitions
- `FNC` may view workflow rules
- `IAR` may view and export workflow definitions and workflow history

### 8.3 Cutover

Cutover should be distributed by responsibility, even though it is one module:

- `SA`: full control and final administrative override
- `EMV`: final approval visibility when cutover requires executive sign-off
- `FNC`: financial review and approval
- `FNO`: enter opening balances and supporting entries
- `PMC`: operational review and project-level sign-off
- `SEO`: enter operational opening positions where assigned
- `WHC`: enter opening stock and warehouse opening data
- `IAR`: review and export only

### 8.4 Payments

Payment rights should be split clearly:

- `FNC`: review and approve payment readiness where workflow requires it
- `FNO`: prepare payment record and accounting details
- `TRE`: execute actual disbursement or receipt handling
- `EMV`: high-level approval only when thresholds require it

### 8.5 Owner Billing and Collections

Default split:

- `PMC`: may view owner billing position
- `FNC`: review and approve owner billing and collection visibility
- `FNO`: prepare billing records and register collection records
- `TRE`: confirm money receipt into treasury or bank account
- `DOC`: manage owner-facing files and correspondence attachments

## 9. Detailed Workflow Role Mapping by Module

### 9.1 Subcontractor Certificates

Default operational flow:

- `SEO` creates and submits draft certificates
- `PMC` reviews and approves project-side certificate steps
- `FNC` reviews finance-sensitive impact where workflow requires
- `EMV` approves only by threshold or exception
- `FNO` views certified amounts and prepares downstream financial handling

### 9.2 Supplier Procurement and Invoices

Default operational flow:

- `SEO` creates purchase request
- `PMC` reviews and approves request
- `PRO` or `FNO` enters supplier procurement and invoice records depending on internal policy
- `WHC` confirms warehouse-side receipt actions
- `FNC` reviews finance-sensitive steps
- `TRE` executes payment only after approval

### 9.3 Employee Custody and Petty Expenses

Default operational flow:

- `SEO` or assigned employee enters petty expense
- `PMC` reviews and approves project-side expense
- `EMV` or higher authority approves when workflow requires
- `FNO` processes reimbursement
- `TRE` executes reimbursement payment if treasury execution is separated

### 9.4 Store-Issued Cost

Default operational flow:

- `SEO` requests or records issue-to-site need where business policy allows
- `WHC` records stock issue or return
- `PMC` reviews cost visibility and operational impact
- `FNC` views cost impact for reporting and profitability

## 10. Scope Rules by Module Family

### 10.1 Company-Scoped Modules

These normally require main-company access scope:

- Treasury and Bank Accounts
- Assets
- Main Warehouse
- Corporate Expenses
- Users and Access
- Approval Workflows
- Consolidated Reports

### 10.2 Project-Scoped Modules

These normally require selected-project or all-projects scope:

- Project Profile
- Project Budget and Cost
- Subcontractor Certificates
- Supplier Procurement and Invoices
- Project Warehouse
- Store-Issued Cost
- Employee Custody and Petty Expenses
- Owner Billing and Collections
- Payments
- Project Documents
- Project Reports
- Cutover for an existing project

### 10.3 Warehouse-Scoped Restrictions

Even inside a project, some warehouse actions should require warehouse-specific assignment.

Recommended examples:

- only assigned warehouse users should confirm goods receipt
- only assigned warehouse users should issue or return stock
- project visibility alone should not grant warehouse execution rights automatically

## 11. Recommended Default Rules for Multiple Permission Groups

If a user has multiple permission groups:

- scope filtering still applies first
- the user receives the safe union of allowed module actions
- workflow approval rights still require workflow eligibility

Recommended rule for v1:

- do not use explicit deny rules unless there is a strong product reason
- use positive grants plus scope restriction

This keeps the access model simpler and easier to audit.

## 12. Recommended Starter Group Assignments by User Type

Examples:

- Super Admin -> `SA`
- Executive Manager or General Manager -> `EMV`
- Finance Manager -> `FNC`
- Accountant -> `FNO`
- Treasury / Cashier -> `TRE`
- Procurement Manager -> `PRC`
- Procurement Officer -> `PRO`
- Project Manager -> `PMC`
- Site Engineer -> `SEO`
- Warehouse Manager / Storekeeper -> `WHC`
- Document Controller -> `DOC`
- Internal Auditor -> `IAR`
- Read-Only Management User -> `MRO`

Users may hold more than one group if business needs require it.

## 13. Design Decision

The default module permission model should follow these principles:

- Super Admin manages permission groups, scopes, and approval workflow configuration
- permission groups define default module behavior
- scope determines where those permissions apply
- approval rights are still filtered by workflow logic and thresholds
- finance execution, warehouse execution, and operational entry remain separated by default

This file should be used as the baseline for building the admin permission editor and for configuring the first production permission groups.
