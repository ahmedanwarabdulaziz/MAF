# Antigravity & Cloude - Master Plan

## Document Role

This document is the master reference for the design and delivery of the core business system for Antigravity & Cloude.

It will serve as the single source of truth for:

- product vision
- architecture decisions
- security standards
- backup and disaster recovery policy
- module scope
- implementation phases
- operational governance

This is a living document and will be expanded and refined over time.

## 1. System Foundation and Technical Direction

### 1.1 Initial Assessment of the Proposed Stack

The proposed stack is technically strong and suitable for building a modern, scalable, bilingual business platform.

However, part of the original justification appears to come from a club or membership-management context. That means the technical base is good, but several business assumptions must be replaced with construction and contracting workflows.

For a professional Egyptian contracting company, the platform must be designed around:

- projects and sites
- contracts and subcontractors
- procurement and purchase approvals
- inventory and material movement
- equipment and asset tracking
- cost control and financial visibility
- HR, attendance, payroll, and permissions
- document control for drawings, invoices, RFIs, and approvals

### 1.2 Recommended Core Stack

The following stack is approved as a strong starting direction:

| Area | Recommended Choice | Decision |
| --- | --- | --- |
| Core web platform | Next.js 14 (App Router) | Keep |
| Language | TypeScript | Keep |
| Database | PostgreSQL via Supabase | Keep |
| Authentication | Supabase Auth | Keep with stronger access policy |
| File storage | Supabase Storage | Keep with private buckets and signed access |
| UI system | Tailwind CSS + shadcn/ui | Keep |
| Forms and validation | React Hook Form + Zod | Keep |
| Data fetching and cache | TanStack Query | Keep |
| Client state | Zustand | Keep only for lightweight UI state |
| Localization | next-intl | Keep with Arabic-first RTL configuration and English numerals |
| Media processing | Sharp | Keep if document and image optimization is needed |
| Error monitoring | Sentry | Keep |
| Scheduled jobs | Supabase Cron or server-side jobs | Keep |
| Business intelligence | Metabase or PostHog | Future phase |

### 1.3 Language, Localization, and RTL Standard

This platform will be Arabic-first in user experience and presentation.

That means the system must be designed from the start as an Arabic business application, not as an English system translated later.

The mandatory language and presentation rules are:

- all production-facing screens must use Arabic interface text by default
- all navigation, forms, labels, validation messages, alerts, and workflow text must be written in Arabic
- the application layout must be RTL across pages, forms, dialogs, dashboards, and printable views
- numbers must be displayed using English numerals `0-9`
- dates, amounts, percentages, document numbers, quantities, phone numbers, and reference codes must use English numerals
- reports, exports, and printable documents generated for users should follow the same Arabic-first and RTL presentation rule unless a specific business form requires otherwise

The technical implementation may remain in English where appropriate. This includes:

- source code
- database table names
- database column names
- API contracts
- environment variables
- internal technical documentation

The system must also handle mixed-content display correctly, especially in cases such as:

- Arabic labels with English numbers
- Arabic text with invoice numbers or contract codes
- Arabic forms that include email addresses, phone numbers, tax numbers, or bank references

Any component, library, or UI pattern selected for the platform must support:

- full RTL layout
- proper Arabic text rendering
- stable mixed Arabic-English content display
- consistent number formatting using English numerals

If an English-language interface is added in the future, it should be treated as a secondary option. Arabic remains the primary business language and design baseline for the platform.

### 1.4 Security Architecture Principles

Security is not an add-on. It must be part of the system design from day one.

The system must include the following mandatory controls:

- Role-based access control for all modules and actions.
- Row-level security at the database level for all sensitive data.
- Multi-factor authentication for administrators, finance users, HR, and executive management.
- Strict separation between Development, Staging, and Production environments.
- Full audit logging for insert, update, delete, approval, rejection, login, export, and permission-change events.
- Approval workflows for high-risk actions such as purchase orders, payment approvals, payroll actions, subcontractor approvals, and contract changes.
- Private file storage with signed URLs and short-lived access tokens.
- Encryption in transit and at rest.
- Centralized secrets management with no hardcoded credentials in the codebase.
- Least-privilege service access between application, database, storage, and background jobs.
- Protection against accidental deletion through soft delete, archival policy, and controlled restore paths.

### 1.5 Audit, Logging, and Traceability

The platform must maintain complete traceability for all important user and system actions.

This is not only for debugging. It is required for accountability, financial control, dispute resolution, compliance, and fraud prevention.

The system should record:

- who performed the action
- what action was performed
- which record or document was affected
- the old value and the new value for critical field changes
- when the action happened
- from which module the action was triggered
- approval comments, rejection reasons, and workflow notes
- whether the action was manual, scheduled, or system-generated

The audit log must cover at minimum:

- login and logout events
- failed login attempts
- record creation, update, archive, restore, and delete operations
- approval, rejection, cancellation, escalation, and reassignment actions
- file upload, replacement, download, and deletion events for sensitive documents
- permission changes, role assignment changes, and configuration changes
- export and print actions for sensitive operational and financial data

Audit logs should be:

- append-only at the business level
- protected from ordinary user editing
- searchable by date, user, module, project, and document number
- retained according to the company retention policy
- visible to authorized audit and management roles only

### 1.6 Recommended Access Model

The platform should be built around explicit business roles, configurable permission groups, and controlled access scope.

The first expected role model is:

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

However, job title alone should not define final access.

The recommended access-control model should include:

- Business Role
- Permission Group
- Access Scope

This means:

- a user may have an organizational role such as Project Manager or Accountant
- a user may be assigned one or more permission groups
- a user may be allowed to access the main company, selected projects, all projects, or a mixed scope

Each effective user access set should have:

- module-level access rules
- action-level permissions
- approval authority limits
- site or project scope restrictions
- export and reporting restrictions where needed

The system must also support multiple users under the same role or function. For example, more than one Project Manager may exist, and approvals may require one specific assigned manager or any authorized user within that role group, depending on workflow configuration.

The system must also support:

- user groups with editable permissions
- project-by-project visibility assignment
- main company access assignment
- Super Admin control over permission groups and approval configuration

Important control rule:

- Super Admin may edit permissions and approval workflows freely as part of system administration
- all such changes must remain fully audited

### 1.7 Approval Workflow Engine

Many processes in this platform will require controlled approval before the next business step can begin.

The system must support multi-step approval workflows driven by:

- module type
- transaction type
- project or branch
- monetary threshold
- role or job title
- assigned person
- urgency or exception rules

The approval engine should support:

- sequential approvals
- parallel approvals
- one-of-many approval rules
- all-required approval rules
- minimum approval count rules
- amount-based routing
- escalation rules after timeout
- rejection with mandatory reason
- return for correction without deleting the request
- delegation for approved temporary substitutes
- workflow history and current approval status at all times

Workflow eligibility should also support:

- business role eligibility
- permission-group eligibility
- scope-based approval eligibility

Example business flow:

1. A request is created at the project level.
2. One or more Project Managers approve based on amount and project assignment.
3. The request moves automatically to Finance for review and approval.
4. The request moves to Treasury or final disbursement authority.
5. The transaction is released only after all required approvals are completed.

This engine is critical for:

- purchase requests
- purchase orders
- subcontractor approvals
- expense claims
- cash requests
- payment certificates
- payroll exceptions
- contract amendments

No workflow step should be bypassed silently. Any override must be restricted to specially authorized roles and fully logged with reason, timestamp, and responsible user.

### 1.8 Backup and Disaster Recovery Policy

Because the system will store critical operational and financial data, backup must be treated as a core architecture requirement.

The backup strategy should include:

- Point-in-time recovery for the production database.
- Automated daily database backups.
- Encrypted off-platform backup copies on a separate provider or isolated storage target.
- Versioned file backups for contracts, invoices, drawings, payroll documents, and supporting attachments.
- Retention policy for daily, monthly, and yearly restore points.
- Restore procedures documented and tested on a scheduled basis.
- Limited restore permissions so that only authorized senior personnel can trigger recovery actions.
- Monitoring and alerting for backup failures.

### 1.9 Backup Recovery Targets

The initial operational targets should be:

- Recovery Point Objective (RPO): 15 minutes or better for database transactions.
- Recovery Time Objective (RTO): 4 hours or better for a major production recovery.

These values can be tightened later depending on business risk tolerance and infrastructure budget.

### 1.10 Professional Backup Structure

The recommended backup design is:

1. Primary production database protected by point-in-time recovery.
2. Automated encrypted snapshot backups taken daily.
3. Secondary copy stored outside the primary production environment.
4. File storage versioning enabled for critical document buckets.
5. Monthly restore drill into a staging recovery environment.
6. Quarterly disaster recovery review by technical and business leadership.

### 1.11 Non-Negotiable Production Rules

The following rules should be treated as mandatory:

- No direct work in Production.
- No testing on live financial or HR data.
- No shared admin accounts.
- No permanent public document links.
- No production-to-development data copy without masking sensitive information.
- No schema changes in Production without versioned migration control.
- No high-risk action without audit logging.

### 1.12 Foundation Decision

The proposed stack is approved in principle, with one important adjustment:

This system must be positioned as a secure contracting and operations platform, not as a repurposed membership or club system.

That means the technology choices are acceptable, but the data model, workflows, approval system, and document structure must all be rebuilt around the real business of a contracting company.

## 2. Initial Strategic Conclusion

The best current direction is:

- use Next.js + TypeScript as the application foundation
- use PostgreSQL via Supabase as the core transactional database
- enforce strong RBAC and RLS from the start
- implement full user activity logging and searchable audit trails
- build a configurable approval workflow engine with role-based and amount-based routing
- design backup and disaster recovery before feature expansion
- build around contracting operations, finance, procurement, HR, and document control

This creates a professional and scalable base for the next planning sections.

## 3. Approval Matrix and Authority Rules

### 3.1 Objective

The system must include a configurable approval framework that controls financial and operational transactions before they are executed.

This framework is required to ensure:

- accountability
- budget control
- separation of duties
- fraud prevention
- management visibility
- proper escalation when approvals are delayed

### 3.2 Core Approval Principles

The approval model must follow these rules:

- No user may fully approve a transaction that they created themselves.
- The requester, approver, finance reviewer, and treasury disbursement role should remain separated wherever practical.
- Approval paths must be configurable by module, amount, project, branch, and transaction type.
- Thresholds must support Egyptian Pounds as the primary operating currency, while remaining configurable for multi-currency expansion if needed.
- A workflow may require one named person, any one user from a role group, or multiple users from the same role group.
- Approvals may be sequential or parallel depending on the business process.
- Every approval, rejection, return, reassignment, delegation, and override must be fully logged.
- Rejection must require a reason.
- Return for correction must preserve workflow history instead of deleting the request.
- High-risk overrides must be limited to specially authorized roles and must trigger audit visibility.

### 3.3 Required Workflow States

The first version of the system should support the following workflow states:

- Draft
- Submitted
- Under Review
- Returned for Correction
- Partially Approved
- Fully Approved
- Rejected
- Cancelled
- Released for Payment or Execution
- Closed

Each workflow instance should also store:

- current step
- pending approvers
- completed approvers
- required approval count
- approval comments
- due date and escalation date
- linked project, vendor, subcontractor, employee, or financial document

### 3.4 Starter Approval Matrix

The following matrix is a starting business model and should be validated with company leadership before final implementation.

| Process | Amount Range | Suggested Approval Route | Final Action |
| --- | --- | --- | --- |
| Purchase Request | Up to 50,000 EGP | Requester -> Project Manager -> Procurement -> Finance | Ready for procurement execution |
| Purchase Request | 50,001 to 250,000 EGP | Requester -> Project Manager -> Procurement Manager -> Finance Manager | Ready for procurement execution |
| Purchase Request | Above 250,000 EGP | Requester -> Project Manager -> Procurement Manager -> Finance Manager -> Executive Management | Ready for procurement execution |
| Supplier Invoice / Payment Request | Up to 100,000 EGP | Requester -> Project Manager confirms delivery or work completion -> Accountant -> Finance Manager -> Treasury | Payment release |
| Supplier Invoice / Payment Request | Above 100,000 EGP | Requester -> Project Manager -> Accountant -> Finance Manager -> Executive Management -> Treasury | Payment release |
| Petty Cash / Site Cash Request | Up to 10,000 EGP | Requester -> Project Manager -> Accountant -> Treasury | Cash release |
| Petty Cash / Site Cash Request | 10,001 to 50,000 EGP | Requester -> Project Manager -> Finance Manager -> Treasury | Cash release |
| Petty Cash / Site Cash Request | Above 50,000 EGP | Requester -> Project Manager -> Finance Manager -> Executive Management -> Treasury | Cash release |
| Subcontractor Payment Certificate | Any value | Site Engineer confirms progress -> Project Manager -> Accountant -> Finance Manager -> Treasury | Payment release |
| Contract Variation / Change Order | Up to 250,000 EGP impact | Project Manager -> Finance Manager -> Executive Management | Variation approval |
| Contract Variation / Change Order | Above 250,000 EGP impact | Project Manager -> Finance Manager -> Executive Management with multi-user approval if required | Variation approval |
| Payroll Exception / Manual Adjustment | Any value | HR Manager -> Finance Manager -> Executive Management if threshold or exception policy requires | Payroll release |

### 3.5 Multi-User Approval Logic

The workflow engine must support cases where more than one user holds the same job function.

Examples:

- Any one authorized Project Manager may approve for a project if the workflow is configured as one-of-many.
- Two Project Managers may both be required for high-value approvals if the workflow is configured with a minimum approval count of two.
- A specific assigned Project Manager may be mandatory for a given project, while Finance approval may be open to any authorized Finance Manager.

This is important because business authority is often role-based, but some transactions must also respect project assignment and amount threshold at the same time.

### 3.6 Amount Threshold and Escalation Rules

The system must support threshold-based routing and timed escalation.

Examples of required behavior:

- If the amount crosses a configured threshold, the next approval level is added automatically.
- If an approver does not act within the defined service window, the request is escalated to the next authority level or delegated substitute.
- If a transaction exceeds the budget or policy limit, the workflow may lock and require special exception approval.

The exact threshold values must remain configurable from an admin-controlled policy layer, not hardcoded in application logic.

### 3.7 Non-Negotiable Workflow Controls

The following controls must always be enforced:

- no silent bypass of workflow steps
- no payment release before required approvals are complete
- no deletion of approval history
- no change to an approved financial transaction without creating a new audit event
- no reassignment of approvers without logging who changed it and why
- no approval rights outside the user's authorized scope

### 3.8 Items to Finalize with Management

Before implementation, the following business decisions must be confirmed:

- final amount thresholds for each module
- which actions require one approval versus multiple approvals
- whether Executive Management approval is required by amount, by module, or by exception only
- treasury release policy for cash, bank transfer, and cheque workflows
- project-specific versus company-wide approval authority
- timeout periods and escalation hierarchy
- exception rules for urgent operational cases

## 4. Visual Identity and Color System

### 4.1 Design Direction

The platform should present a professional, calm, and trustworthy visual identity suitable for a serious contracting and operations system.

The approved primary color direction is:

- matte off-white
- corporate blue
- navy blue

This combination is appropriate because it gives the system:

- visual comfort during long work sessions
- a clean and executive business feel
- strong hierarchy for navigation and actions
- a professional corporate tone without looking cold or overly aggressive

### 4.2 Primary Color Palette

The first approved palette is:

| Token | Color | Usage |
| --- | --- | --- |
| Background Primary | `#F5F4EF` | Main application background |
| Background Secondary | `#F6F6F2` | Secondary surfaces and large content areas |
| Primary Blue | `#2F6FB3` | Primary buttons, links, active states, selected items |
| Navy Blue | `#16324F` | Sidebar, header, major section titles, important panels |
| Border Neutral | `#D7DEE7` | Borders, dividers, table lines, input outlines |
| Text Secondary | `#5F6B7A` | Secondary text, help text, inactive labels |
| Text Primary | `#1F2A37` | Main body text and important labels |

### 4.3 Core Usage Rules

The main background should use matte off-white, not pure white, so the interface remains softer on the eyes during long operational use.

The recommended distribution is:

- 60% matte off-white and soft neutral surfaces
- 25% navy blue for structure and visual hierarchy
- 15% corporate blue for actions, highlights, and active interface states

The palette should be applied as follows:

- matte off-white for page background and work surfaces
- navy blue for sidebar, top navigation, section banners, and authority-focused areas
- corporate blue for primary buttons, active tabs, selected rows, links, and charts

### 4.4 Interface Guidance

The system should avoid:

- pure white as the dominant background
- very bright or saturated blue on large surfaces
- heavy navy usage across full page bodies
- too many competing accent colors

The system should prefer:

- clear spacing and quiet backgrounds
- strong contrast for important data tables
- restrained use of color to indicate priority and action
- consistent color meaning across all modules

### 4.5 Semantic Color Extensions

In addition to the primary brand palette, the UI should define clear semantic colors for status communication.

Suggested starting values:

| Semantic Use | Color |
| --- | --- |
| Success | `#2E7D5A` |
| Warning | `#C58A1C` |
| Danger | `#B54747` |
| Info | `#2F6FB3` |

These colors should be used for:

- approval states
- payment status
- overdue alerts
- workflow exceptions
- validation messages

### 4.6 Accessibility and Readability Rules

The design system must preserve readability and professional clarity.

The first UI version should follow these rules:

- all primary text must maintain strong contrast against the background
- buttons and links must remain clearly identifiable in both hover and active states
- status colors must not be the only signal; icons, labels, or text should reinforce meaning
- financial and workflow-critical screens must prioritize readability over decoration

### 4.7 Design Decision

The approved visual base for the platform is:

- matte off-white as the main background
- navy blue as the structural anchor color
- corporate blue as the primary action color

This should be treated as the default design system direction unless future brand requirements introduce a formal company identity package.

## 5. Business Structure: Parent Company, Projects, Treasury, Assets, and Warehouses

### 5.1 Core Business Model

The platform should be structured in three connected layers:

- Parent Company Layer
- Project Layer
- Consolidated Reporting Layer

This means each project operates independently for day-to-day business activity, while all projects still roll up into the main company for final financial position, operational control, and management reporting.

### 5.2 Parent Company Layer

The parent company must have its own separate operational and financial structure.

The system should support recording the company's core capital base and resources, including:

- cash on hand
- multiple bank accounts
- deposits and certificates
- fixed assets such as units, offices, or shops
- equipment and tools
- contracting materials and reusable operational stock

The parent company must also support direct head-office activity that is not linked to any specific project.

Examples include:

- salaries for non-project employees
- branch rent
- administrative overhead
- general operating expenses
- company-level procurement

### 5.3 Project Layer

Each project must have its own dedicated space in the system.

Projects may follow a similar business pattern, but they must remain separated operationally so that each project can maintain its own:

- cost center
- financial position
- profitability view
- warehouse activity
- operational documents
- approvals and spending history
- revenue and collection tracking

At the same time, all projects must remain connected to the parent company so management can see the overall company position at any time.

### 5.4 Consolidated Company View

The platform must provide a company-wide view that combines:

- all active and closed projects
- parent company assets and liabilities
- head-office expenses
- treasury and bank balances
- inventory and warehouse value
- project profitability and overall company profitability

This consolidated layer is essential for owners and executive management.

### 5.5 Financial Meaning of Project Amounts

When a new project is created, management may assign a project amount.

This amount must not automatically deduct money from the parent company treasury or bank balances.

Instead, the system must distinguish clearly between:

- Planned Project Allocation: a management planning indicator used for financial follow-up
- Actual Project Funding: real cash, bank, or treasury transfers made to the project
- Project Revenue and Collections: money earned from the client and money actually collected
- Project Profitability: revenue minus direct costs and any approved allocated overhead

This distinction is critical to avoid confusion between planning figures and actual accounting movement.

### 5.6 Project Creation Data

The initial project creation form should include the following fields:

- Project Code
- Project Arabic Name
- Project English Name
- Project Status
- Project Onboarding Type
- Start Date
- Expected End Date
- Project Owner / Client Name
- Project Location
- Project Manager
- Planned Allocation Amount
- Estimated Contract Value
- Project Type
- Cost Center Code
- Notes

Recommended onboarding options:

- New Project
- Existing Ongoing Project

If the project is created as an Existing Ongoing Project, the system must require a cutover and migration setup before normal operations begin.

### 5.6.1 Existing Project Cutover Rule

If a project is already running before the system go-live date, it must not be treated as a clean new project.

Instead, the system must support a formal cutover process with a defined opening date and controlled opening balances.

The cutover setup should include:

- cutover date
- migration status
- opening balances approval status
- opening operational data lock status
- opening stock load status
- opening subcontractor positions
- opening supplier positions
- opening owner receivable position
- opening employee custody balances

The system should distinguish between:

- Opening Financial Balances
- Opening Operational Positions
- New Transactions After Cutover

This is necessary to ensure that a project already in progress can continue correctly in the system without re-entering all historical activity from day one.

### 5.7 Client Authorized Representative and Correspondence Data

Because the system may later send emails, official notices, and formal correspondence, each project should also store the owner-side or client-side authorized contact details.

Recommended fields:

- Authorized Representative Name
- Authorized Representative Job Title
- Authorized Representative Email
- Authorized Representative Phone
- Alternative Contact Person
- Alternative Contact Email
- Alternative Contact Phone
- Preferred Correspondence Language
- Official Address
- Correspondence Notes

### 5.8 Parent Company Expenses vs Project Expenses

The system must separate expenses into two major categories:

- Parent Company Expenses
- Project Expenses

Parent company expenses are not tied to a project and must remain visible at the corporate level.

Project expenses must be linked to the relevant project and affect that project's cost position and profitability.

This separation is essential for correct reporting and for preventing general overhead from being mixed incorrectly with project costs.

### 5.9 Warehouse and Inventory Structure

The company must have:

- one main warehouse at the parent company level
- one or more warehouses for each project as needed

The warehouse model should support:

- item groups
- items
- stock balances
- unit of measure
- warehouse transfers
- receipts
- issues
- adjustments
- damaged or consumed stock tracking where needed

Stock must be transferable:

- from main warehouse to project warehouse
- from project warehouse back to main warehouse when allowed
- between project warehouses if business policy permits

### 5.10 Inventory Value and Cost Movement

Warehouse transfers should not be tracked by quantity only. They should also carry financial value so project costing remains meaningful.

The recommended accounting direction is:

- inventory movement should track both quantity and value
- transfer value should follow an approved inventory costing method
- the costing method must remain consistent across the system

The final costing policy should be confirmed with company finance leadership and accounting advisors, but the system must be ready to support a proper valuation model such as weighted average or another approved method.

### 5.11 Project Treasury and Banking Direction

The system should be designed so that a project may later have its own petty cash, treasury tracking, or bank-related movement if the business requires it.

This area will be discussed in more detail in the dedicated project section, but the architecture must be prepared for:

- project cash balances
- project funding movement from the parent company
- project payments
- project collections
- project treasury controls

### 5.12 Design Decision

The approved business structure direction is:

- projects are operationally separated
- projects remain financially and administratively linked to the parent company
- each project has its own cost center and profitability tracking
- the parent company retains its own expenses, assets, treasury, and main warehouse
- management must always be able to see both project-level and company-level financial position

This section forms the foundation for the upcoming detailed project design, finance logic, and database structure.

## 6. Project Operational and Financial Model

### 6.1 Objective

Each project must operate as a controlled business unit inside the parent company.

The project layer must manage operational execution, cost tracking, approvals, liabilities, collections, and profitability without losing connection to company-wide accounting and management reporting.

### 6.2 Core Project Expense and Liability Streams

The project layer should be designed around four main operational and financial streams:

- Subcontractor Certificates
- Supplier Procurement and Invoices
- Employee Custody and Petty Expenses
- Cost of Materials Issued from Store to Project Consumption

Important accounting note:

- supplier purchases that enter warehouse create stock and supplier liability
- project material cost is recognized when stock is issued or consumed for the project
- this prevents double counting between supplier invoices and material consumption

### 6.3 Subcontractor Master and Project Separation

The system should maintain a global subcontractor master containing:

- subcontractor name
- phone number
- email
- address
- notes

The same subcontractor may work in multiple projects, but each project relationship must remain operationally separate.

This means each project should maintain its own subcontractor agreement or project-specific setup, including:

- project reference
- subcontractor reference
- project-specific approval scope
- project-specific agreed rates
- default Ta'liya setting
- contract start and end context if needed

### 6.4 Project Work Item Catalog and Pricing Rules

For subcontractor certificates, the project should maintain a controlled work item catalog created by authorized management users.

The catalog should define:

- work item description
- unit of measure
- project relevance
- optional reference notes

The final agreed price must not rely only on the project catalog, because the same work item may have a different rate for different subcontractors in the same project.

Therefore, the subcontractor agreement layer should store:

- selected work item
- agreed unit rate
- default retention or deduction behavior where needed

### 6.5 Subcontractor Certificate Workflow

The subcontractor certificate flow should work as follows:

1. The project engineer creates a new subcontractor certificate.
2. The engineer adds work item lines and enters current quantities.
3. The system automatically retrieves previous quantities for any item already used in earlier certificates.
4. The system calculates cumulative quantity and gross value.
5. Ta'liya and other approved deductions are applied.
6. The certificate is saved and sent to the Project Manager for approval.
7. After Project Manager approval, it moves to the Projects Director or equivalent authority for pricing and management review.
8. After final operational approval, the certificate value becomes visible to Accounts for liability and payment preparation.

The certificate should always preserve status history, comments, and attachments.

### 6.6 Subcontractor Certificate Data Model

Each subcontractor certificate line should store at minimum:

- certificate number
- project
- subcontractor
- work item
- unit
- previous quantity
- current quantity
- cumulative quantity
- agreed unit rate
- gross line value
- Ta'liya method
- Ta'liya value
- net line value
- owner-billable flag if applicable
- owner-facing description override if applicable
- notes

The system should calculate totals for:

- gross certificate value
- total Ta'liya
- total deductions
- net certificate value
- previously paid amount
- current outstanding certified position

### 6.7 Calculation Logic for Consecutive Certificates

For later certificates such as certificate number 2, the system must calculate based on cumulative progress, not isolated current entry only.

Required behavior:

- if the engineer selects a work item used before, previous quantity is loaded automatically
- if the engineer selects a work item for the first time, previous quantity is zero
- the certificate value must be derived from cumulative value minus previously certified value for the same item set
- payment history must remain separate from certification history so partial or delayed payment does not distort work progress

This separation is important because certification and cash settlement are related but not identical.

### 6.8 Ta'liya (Retention / Withheld Amount)

Ta'liya must be treated as a formal retained amount held back from the subcontractor's certified amount until management decides to release it.

The system must support Ta'liya at all three levels:

- subcontractor default
- certificate-level override
- line-level override

Ta'liya must support:

- percentage
- fixed amount
- full certificate application
- line-specific application
- partial release later
- full release later

The subcontractor position should always show:

- total certified amount
- total retained amount
- released retained amount
- actual payments made
- remaining outstanding amount

### 6.9 Allowance for Price Increase

The subcontractor module must support an Allowance field for cases where management approves an increase without changing the original base rate of the work item.

Example:

- base marble rate remains 500 EGP
- approved increase is 100 EGP
- the certificate records an Allowance linked to that work item

The Allowance model should follow these rules:

- the original work item and original base rate must remain unchanged
- an Allowance line must be linked to a valid base work item
- the base work item must exist in the certificate context
- Allowance applies to the current certificate quantity only
- the next certificate should show the prior Allowance as a historical notice or reference, not as an automatic new charge

Each Allowance record should store:

- base work item reference
- current quantity affected
- allowance rate difference
- allowance value
- reason
- approval reference

### 6.10 Additional Deductions and Adjustments

Beyond Ta'liya, the system should be prepared to support other approved deductions and adjustments such as:

- tax
- penalties
- advance recovery
- insurance
- other management-approved deductions

These deductions should be configurable and fully traceable in certificate history.

### 6.11 Supplier Procurement and Invoice Flow

The supplier process should follow this controlled path:

1. The project engineer creates a purchase request.
2. The Project Manager approves the request.
3. Accounts or the authorized procurement function coordinates with the supplier.
4. A supplier purchase invoice is entered in the system.
5. A copy becomes visible to the Project Manager and the project warehouse manager.
6. The invoice is confirmed only after receipt is acknowledged by the required project roles.
7. The supplier balance is updated and becomes available for payment control.

Because the company policy requires supplier purchases to pass through inventory, the supplier module must always remain connected to warehouse operations.

### 6.12 Supplier Data, Balances, and Return Invoices

The supplier module should maintain:

- supplier master data
- invoice list
- paid amount
- outstanding amount
- last payment date
- cumulative supplier balance

The system must also support Supplier Return Invoices from day one.

Supplier return logic should support:

- return quantity
- return value
- reason for return
- warehouse impact
- balance impact on supplier account
- attachment where needed

### 6.13 Receipt Confirmation and Delegation Rule

Supplier receipt confirmation should normally require both:

- Project Manager
- Project Warehouse Manager

Delegation may be allowed only when explicitly assigned by the General Manager.

This rule should be enforced in workflow design and logged in the audit trail.

### 6.14 Owner / Client Billing and Collections

The project layer must also support formal billing to the project owner or client.

This should be implemented as a dedicated Owner Certificate or Owner Invoice document with:

- its own numbering
- its own approval workflow
- project linkage
- owner or client linkage
- line details
- pricing
- status
- collection history

At the line level, the system should support:

- owner-billable flag
- owner-facing text override for professional presentation

Eligible owner-billable lines may come from:

- subcontractor certificate lines
- supplier-related project lines where the business chooses to expose them to the owner

Petty expenses must not appear in owner billing.

The Owner Billing page should allow management to see:

- eligible completed work
- owner-facing line descriptions
- owner pricing entered by the General Manager or authorized management
- total value of completed works
- total billed amount
- collected amount
- remaining receivable

When an owner payment is received, the system must record:

- received amount
- receipt date
- receiving treasury or bank account
- payment reference
- attachment if provided

This receipt must update company and project financial visibility.

### 6.15 Payment Settlement Logic for Suppliers and Subcontractors

Payment should be controlled at the party-balance level, not forced to match one invoice or one certificate only.

This means:

- a supplier or subcontractor may have multiple open documents
- management may approve a payment amount against the total outstanding balance
- Accounts may record a partial payment such as 2,345 EGP even if the open documents total more than that

The payment record should store:

- payment voucher number
- party type
- party name
- payment amount
- receipt number
- payment method
- treasury or bank source
- payment date
- attachment for receipt or payment proof

The system should still support optional internal allocation of the payment across open documents for reporting and aging purposes.

### 6.16 Employee Custody and Petty Expenses

Petty expenses should be managed through employee custody accounts.

The system must support:

- permanent custody accounts
- temporary advances
- employee-level balance tracking
- configurable negative balance limit

If an employee has permission for custody use, the employee may register a petty expense even if the balance becomes negative, but only within the configured allowed limit.

Each petty expense record should include:

- expense group
- expense item
- quantity where relevant
- total amount
- date
- receipt or invoice image
- notes

Workflow:

1. The employee or engineer records the expense.
2. The Project Manager approves it.
3. The General Manager approves it.
4. Accounts reimburses the employee and updates the custody balance.

Petty expenses should not appear in owner billing.

### 6.17 Cost of Materials Issued from Store to Project Consumption

This is the fourth major project expense stream and must be visible separately in project costing.

Important accounting rule:

- purchase into warehouse creates inventory, not project cost yet
- transfer between warehouses is a stock movement, not project cost yet
- issue from project warehouse to site, engineer, or actual project consumption creates project material cost
- return from site or engineer back to warehouse should reverse or reduce that material cost accordingly

This expense stream should be reported as:

- Cost of Materials Issued from Store

This category is essential for accurate project profitability.

### 6.18 Warehouse Movement Inside and Across Projects

The warehouse model must support all of the following:

- receipt from supplier into warehouse
- issue from warehouse to engineer or site use
- return from engineer or site back to warehouse
- transfer from main warehouse to project warehouse
- transfer from project warehouse back to main warehouse
- transfer between project warehouses
- return to supplier
- approved stock adjustment for damage, loss, or waste

Every movement must update quantity and value according to the approved costing policy.

### 6.19 Numbering Strategy

Operational project documents should use project-based numbering.

Recommended examples:

- PRJ-001-SCERT-0001 for subcontractor certificates
- PRJ-001-SINV-0001 for supplier documents where appropriate
- PRJ-001-OWN-0001 for owner billing documents
- PRJ-001-PC-0001 for petty cash or custody-related documents

Financial vouchers may use company-wide or fiscal-year-based numbering if required by accounting policy.

All records must also maintain an internal unique system ID independent of human-readable numbering.

### 6.20 Budgeting Direction

The system should be prepared not only for total project profitability, but also for future project budgets by category and work item.

This means the architecture should allow:

- project budget by category
- project budget by work item
- actual cost versus budget comparison
- variance visibility for management

### 6.21 Design Decision

The approved project-layer direction is:

- subcontractor certificates must support cumulative progress logic, Ta'liya, Allowance, and later payment release
- supplier purchases must pass through warehouse control and support supplier return invoices
- owner billing must exist as a formal project-owner document with its own numbering and approval flow
- petty expenses must run through employee custody with configurable negative limits
- material cost must appear as a separate project expense when stock is issued for actual consumption
- project payments must support partial settlement against total outstanding party balances

This section should be treated as the core operational model for detailed workflow design, database design, and future screen planning.

## 7. Product Surface Structure

### 7.1 Core Product Split

The product should not be treated as one single interface only.

It should be built as two connected but clearly separated surfaces:

- Public Website
- Protected System Application

### 7.2 Public Website

The public website is the company's external-facing digital presence.

Its purpose is to present:

- company identity
- services
- portfolio or selected projects
- credibility and professionalism
- contact and inquiry channels
- entry point to the system application

The public website should remain separate in purpose from the internal operational system.

### 7.3 Protected System Application

The system application is the authenticated business platform used by company staff and authorized users.

Its purpose is to handle:

- projects
- finance
- procurement
- warehouses
- approvals
- reporting
- collections and payments
- operational workflows

This part must be protected by authentication and authorization from the beginning.

### 7.4 Recommended Product Routing Direction

The recommended structure is:

- public website on the main entry route such as `/`
- system application on a dedicated route such as `/app`
- authentication pages under the system area such as `/app/login`

This keeps the product clean and avoids mixing marketing content with business operations.

### 7.5 Design Rule

The public website and the system application should share the same brand identity, but they should not behave like the same type of product.

Recommended distinction:

- public website = presentation, trust, brand, inquiry, company image
- system application = operational clarity, speed, data density, workflow efficiency

### 7.6 Planning Impact

This requirement affects the roadmap in the following ways:

- the first implementation phase must include both the public website entry layer and the system shell
- navigation planning must distinguish public pages from authenticated system pages
- authentication should protect only the system application, not the public website
- UI design should keep brand consistency while preserving different user goals

### 7.7 Design Decision

The approved product direction is:

- one public-facing website
- one separate authenticated system application
- one shared brand identity across both
- clear route and UX separation between public content and internal operations
