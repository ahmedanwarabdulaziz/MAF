# Antigravity & Cloude - Role and Permission Matrix

## Document Role

This document defines the access-control model for the system.

It covers:

- business roles
- permission groups
- access scopes
- approval authority
- Super Admin powers
- project-level and company-level access rules

This is a living document and should be updated whenever modules, workflows, or approval rules change.

## 1. Access Control Philosophy

The system should not rely on job title alone.

Instead, access should be built from three connected layers:

- Business Role
- Permission Group
- Access Scope

This means:

- a user may have a job title such as Project Manager or Accountant
- the user may be assigned one or more permission groups
- the user may be allowed to see the main company only, selected projects only, or both

## 2. Core Access Model

### 2.1 Business Role

Business role describes the user's organizational function.

Examples:

- Super Admin
- Executive Management
- Finance Manager
- Accountant
- Treasury / Cashier
- Procurement Manager
- Procurement Officer
- HR Manager
- HR Officer
- Project Manager
- Site Engineer
- Storekeeper / Warehouse
- Document Controller
- Internal Auditor
- Read-Only Management Viewer

### 2.2 Permission Group

Permission groups are the real access containers.

Each permission group defines:

- visible modules
- allowed actions
- approval abilities
- export rights
- edit rights
- workflow access

Users should be assigned to permission groups, and Super Admin should be able to create, edit, activate, deactivate, or copy those groups freely.

### 2.3 Access Scope

Each user must also have a scope assignment that controls where the assigned permissions apply.

Recommended scope types:

- Main Company Only
- All Projects
- Selected Projects
- Main Company + Selected Projects
- Main Company + All Projects

Examples:

- a company accountant may have access to the main company and all projects
- a project engineer may have access only to Project A and Project B
- a warehouse manager may have access only to the main warehouse and one project warehouse

## 3. Super Admin Authority

The Super Admin should have full system administration authority.

Super Admin powers should include:

- create and edit permission groups
- assign users to permission groups
- assign or revoke project access
- assign or revoke main company access
- edit approval workflow definitions
- edit approval routing rules
- edit amount thresholds
- override configuration where necessary
- lock or unlock selected administrative settings when permitted by company policy

Important control rule:

- Super Admin actions must still be fully logged in the audit trail
- workflow or permission changes made by Super Admin should record old value, new value, timestamp, and user identity

This keeps control strong without blocking administration flexibility.

## 4. Recommended Permission Structure

### 4.1 Best-Practice Model

The recommended model is:

- one user may have one or more business roles
- one user may have one or more permission groups
- one user may have one or more scope assignments
- the effective permission set is the allowed combination of those assignments

### 4.2 Practical Interpretation

This allows the company to handle real-world cases such as:

- one user acting as Project Manager on one project and read-only management viewer on another
- one user having accounting permissions across all projects
- one user having warehouse rights in one project only
- one user seeing the main company but not seeing all projects

## 5. Recommended Standard Permission Groups

These are recommended default permission groups. Super Admin should be able to modify them later.

| Permission Group | Main Use |
| --- | --- |
| `super_admin_full_control` | Full administration of settings, permissions, scopes, and workflows |
| `executive_management_view` | Company-wide and project-wide strategic visibility |
| `finance_control` | Finance review, liability visibility, approvals, and reports |
| `finance_operations` | Daily accounting entry and settlement work |
| `treasury_operations` | Cashbox, payment execution, and receipt tracking |
| `procurement_control` | Procurement review and purchasing control |
| `procurement_operations` | Purchase request and purchase order operations |
| `project_management_control` | Project-level operational review and approvals |
| `site_engineering_operations` | Project engineer operational entry rights |
| `warehouse_control` | Warehouse movement and stock validation |
| `hr_admin_control` | HR and employee administration |
| `document_control` | Controlled access to project and company documents |
| `internal_audit_read` | Audit visibility with limited edit rights |
| `management_read_only` | Management view without operational editing |

## 6. Module Permission Categories

Permissions should be managed by module and action, not by page visibility only.

Recommended module categories:

- Dashboard
- Projects
- Cutover
- Treasury and Bank Accounts
- Assets
- Main Warehouse
- Project Warehouse
- Item Master
- Subcontractor Certificates
- Supplier Procurement and Invoices
- Owner Billing and Collections
- Employee Custody and Petty Expenses
- Corporate Expenses
- Payments
- Reports
- Attachments
- Settings
- Approval Workflows
- Users and Access

Recommended action categories:

- view
- create
- edit
- submit
- approve
- reject
- return_for_correction
- cancel
- lock
- unlock
- export
- print
- attach_files
- delete_or_archive

## 7. Recommended Scope Assignment Rules

### 7.1 Scope Layers

A user should be assignable to:

- company scope
- project scope
- warehouse scope where needed

### 7.2 Scope Examples

Examples:

- `Finance Manager` may have `Main Company + All Projects`
- `Project Manager` may have `Selected Projects`
- `Site Engineer` may have `Selected Projects`
- `Warehouse Manager` may have `Main Company + Selected Projects`
- `Executive Management` may have `Main Company + All Projects`

### 7.3 Scope Enforcement Rule

Even if a permission group allows a module, the user must still be inside the correct scope to access actual records.

Example:

- a user may have supplier permission
- but if the user is assigned only to Project X, the user must not see supplier records from Project Y

## 8. Approval Authority Model

Approval authority should not depend only on permission groups. It should also consider:

- workflow definition
- assigned scope
- project assignment
- amount threshold
- role or permission-group eligibility

Recommended approval behavior:

- a user may view a record without being allowed to approve it
- a user may approve in one project but not another
- a user may approve up to a limit while a higher amount requires escalation
- Super Admin may edit workflow structures, but operational approvals should still follow the approved workflow unless an authorized override is used

## 9. Recommended Matrix by User Type

This is the starter functional model and should remain configurable.

| User Type | Main Company Access | Project Access | Permission Level | Approval / Workflow Rights |
| --- | --- | --- | --- | --- |
| Super Admin | Full | Full | Full create, edit, archive, settings, permissions | Full workflow and permission management |
| Executive Management | Yes | All Projects | Strategic view, selected high-level actions | High-level approvals by threshold or exception |
| Finance Manager | Yes | All or Selected | Finance review, reports, liability control, payment review | Finance approvals and review steps |
| Accountant | Yes | All or Selected | Accounting entries, invoices, balances, reconciliations | No approval by default unless assigned |
| Treasury / Cashier | Yes | All or Selected | Cash and bank execution functions | Payment execution after approval |
| Procurement Manager | Optional | All or Selected | Procurement review and purchasing control | Procurement approvals |
| Procurement Officer | Optional | All or Selected | Purchase and supplier operational work | Usually submit only unless assigned |
| Project Manager | Optional | Selected Projects | Project operations, review, cost visibility | Project-level approvals |
| Site Engineer | No by default | Selected Projects | Operational data entry for project workflows | Usually no approval unless explicitly assigned |
| Storekeeper / Warehouse | Optional | Selected Warehouses / Projects | Warehouse receipts, issues, returns, transfers | Confirmation rights where assigned |
| HR Manager | Yes | Optional | HR and employee control | HR approvals where needed |
| HR Officer | Yes | Optional | HR operations | Usually submit only unless assigned |
| Document Controller | Optional | Selected Projects | Document upload, organization, and controlled visibility | No approval unless assigned |
| Internal Auditor | Yes | All or Selected | Read-heavy access with audit visibility | No operational approval by default |
| Read-Only Management Viewer | Yes | All or Selected | Read only | No approval |

## 10. Permission Group Design Rules

Recommended rules:

- permission groups should be reusable
- permission groups should be editable without changing the user's business role
- one user may belong to multiple groups
- the system should resolve the effective permission set safely
- restricted actions should remain blocked even if the user can see the module

Examples:

- one user may have `finance_operations` and `treasury_operations`
- one user may have `project_management_control` for one project and `management_read_only` for another scope

## 11. Suggested User Access Tables for Administration

From a product perspective, the administration screens should support:

- user list
- business roles
- permission groups
- permission matrix editor
- user-to-group assignments
- user scope assignments
- project access assignments
- warehouse access assignments if needed
- approval delegation assignments
- workflow configuration editor

## 12. Recommended Admin Screens

The Super Admin or authorized administrator should have access to screens such as:

- `إدارة المستخدمين`
- `مجموعات الصلاحيات`
- `مصفوفة الصلاحيات`
- `تحديد نطاق الوصول`
- `توزيع المشروعات على المستخدمين`
- `توزيع المخازن على المستخدمين`
- `إعدادات الموافقات`
- `تفويضات الموافقات`

## 13. High-Risk Permission Rules

The following actions should be treated as high risk:

- editing permission groups
- changing user scope
- editing workflow definitions
- editing approval thresholds
- unlocking cutover data
- unlocking approved financial records
- changing payment authority settings

These actions should:

- require strong authorization
- be fully audited
- be visible in admin audit reports

## 14. Design Decision

The approved access-control direction is:

- use permission groups, not job title alone
- allow users to access the main company, selected projects, or both
- allow Super Admin to manage permissions and approval workflows freely
- keep all admin changes fully audited
- keep project visibility and approval authority scope-based

This model will give the company strong flexibility without losing control over sensitive financial and operational actions.
