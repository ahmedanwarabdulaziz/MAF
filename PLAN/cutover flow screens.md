# Antigravity & Cloude - Cutover Flow Screens for Existing Projects

## Document Role

This document defines the onboarding and cutover screens required when a project is already active before being entered into the system.

It is intended to guide:

- product design
- UX flow
- role responsibilities
- cutover validation
- finance and warehouse reconciliation
- implementation planning

This flow applies only when `Project Onboarding Type = Existing Ongoing Project`.

## 1. Cutover Objective

The objective of cutover is to bring an already-running project into the system without re-entering all historical activity from the project start date.

The system should:

- capture the project position as of a defined cutover date
- load opening financial balances
- load opening operational positions
- load opening warehouse balances
- preserve auditability
- lock the opening data after approval
- start all new live transactions after cutover

## 2. High-Level Flow

Recommended wizard sequence:

1. Project Creation and Onboarding Choice
2. Cutover Setup
3. Opening Financial Balances
4. Opening Subcontractor Positions
5. Opening Supplier Positions
6. Opening Owner / Client Position
7. Opening Warehouse Stock
8. Opening Employee Custody Balances
9. Document Numbering and Open Sequences
10. Attachments and Supporting Documents
11. Review and Reconciliation
12. Approval and Lock
13. Go-Live Confirmation

## 3. Roles Involved

The cutover process should involve:

- General Manager
- Finance Manager
- Accountant
- Project Manager
- Project Engineer
- Warehouse Manager
- Internal Auditor or Reviewer
- System Administrator

Not every role must edit every screen, but each screen should have clear ownership and approval responsibility.

## 4. Screen 1: Project Creation and Onboarding Choice

### Purpose

Create the project master record and force the user to choose whether the project is:

- New Project
- Existing Ongoing Project

### Main Fields

- Project Code
- Project Arabic Name
- Project English Name
- Project Status
- Project Onboarding Type
- Start Date
- Expected End Date
- Owner / Client
- Project Location
- Project Manager
- Planned Allocation Amount
- Estimated Contract Value
- Project Type
- Cost Center
- Notes

### Key Behavior

- if `New Project` is selected, normal project setup continues
- if `Existing Ongoing Project` is selected, the system opens the cutover wizard
- normal transactions must remain blocked until cutover is approved or explicitly bypassed by a top-level authorized user

## 5. Screen 2: Cutover Setup

### Purpose

Define the migration event and the accounting boundary.

### Main Fields

- Cutover Date
- Migration Batch Name or Reference
- Financial Period Reference
- Prepared By
- Reviewed By
- Notes

### Key Rules

- the cutover date is the official separation point between historical activity and live system activity
- all opening positions must reflect the situation as of the end of the cutover date
- all new transactions must start after the cutover date

### Recommended Validation

- cutover date cannot be empty
- cutover date cannot be earlier than the project start date
- cutover date should not be in a closed accounting period unless authorized

## 6. Screen 3: Opening Financial Balances

### Purpose

Load the opening monetary position of the project.

### Data Groups

- project petty cash opening balance
- project treasury opening balance
- project bank balances if applicable
- project funding received from parent company
- other project-level financial accounts if approved

### Main Columns

- Balance Type
- Financial Account
- Currency
- Opening Amount
- Reference Notes

### Key Rules

- this screen is for opening balances only, not transaction history
- balances must reconcile with accounting records as of cutover date
- each account entry should support attachment or evidence reference

## 7. Screen 4: Opening Subcontractor Positions

### Purpose

Load the current outstanding operational and financial position for each subcontractor in the project.

### Why This Screen Is Critical

This screen is required so future certificates can calculate previous quantities automatically.

### Main Data Per Subcontractor

- Subcontractor
- Role Account
- Agreement or Project Reference
- Certificate Number Reference
- Work Item
- Unit
- Previous Quantity
- Cumulative Quantity
- Agreed Rate
- Gross Certified Amount to Date
- Ta'liya Balance
- Other Deductions Balance
- Advance Balance if any
- Paid to Date
- Outstanding Balance
- Notes

### Key Rules

- opening position may be loaded from one summarized opening record per work item
- the system must preserve enough detail for the next certificate to continue correctly
- supplier balances and subcontractor balances for the same legal party must remain separate

### Recommended Validation

- cumulative quantity cannot be less than previous quantity
- gross certified amount should reconcile with rate and quantity unless override is explicitly approved
- Ta'liya loaded at cutover must remain available for later release workflows

## 8. Screen 5: Opening Supplier Positions

### Purpose

Load open supplier obligations and supplier-specific advances as of the cutover date.

### Main Data Per Supplier

- Supplier
- Role Account
- Open Invoice Number
- Invoice Date
- Gross Invoice Amount
- Paid Amount to Date
- Remaining Amount
- Return Invoice Balance if any
- Advance Paid to Supplier if any
- Notes

### Key Rules

- this screen should load only open supplier positions, not fully settled historical invoices
- if finance wants document-level aging, each open invoice should be entered separately
- because supplier purchases must pass through warehouse, any unmatched inventory situation must be reviewed before approval

## 9. Screen 6: Opening Owner / Client Position

### Purpose

Load the receivable and billing position for the project owner or client.

### Main Data

- Owner / Client
- Open Owner Certificate or Invoice Number
- Billing Date
- Billed Amount
- Collected Amount to Date
- Remaining Receivable
- Unbilled Completed Work Value if management wants visibility
- Notes

### Key Rules

- owner receivables must remain separate from subcontractor or supplier balances
- collections loaded at cutover should indicate the receiving financial account if known

## 10. Screen 7: Opening Warehouse Stock

### Purpose

Load the physical and financial stock position as of the cutover date.

### Main Data Per Warehouse Item

- Warehouse
- Item Group
- Item
- Unit
- Opening Quantity
- Unit Cost
- Opening Value
- Storage Location if used
- Notes

### Key Rules

- only stock physically existing at cutover should be loaded here
- already consumed material must not be loaded as opening stock
- stock should be entered per warehouse, not only per project

### Recommended Validation

- opening value should equal quantity multiplied by unit cost unless override is approved
- item must exist in the item master
- warehouse must belong to the correct project or to the parent company

## 11. Screen 8: Opening Employee Custody Balances

### Purpose

Load employee custody and temporary advance positions as of cutover.

### Main Data Per Employee

- Employee
- Custody Account Type
- Allowed Negative Limit
- Opening Balance
- Temporary Advance Balance if any
- Notes

### Key Rules

- custody balances may be positive or negative
- negative balances should still respect approved policy limits
- reimbursement after cutover must be recorded as live transactions, not backdated opening entries unless explicitly approved

## 12. Screen 9: Document Numbering and Open Sequences

### Purpose

Set the next document numbers so the new system continues from the current project reality.

### Main Sequences

- next subcontractor certificate number
- next supplier invoice internal sequence if needed
- next owner billing number
- next petty expense or custody sequence
- next warehouse issue sequence
- next warehouse transfer sequence
- next payment voucher reference if project-specific

### Key Rules

- numbering should not create duplicates
- numbering should match the selected cutover policy
- finance-level voucher numbering may follow company-wide rules rather than project rules

## 13. Screen 10: Attachments and Supporting Documents

### Purpose

Collect the files that support the cutover position.

### Recommended Attachments

- approved balance sheets or trial references for the project
- open subcontractor statements
- open supplier statements
- owner receivable statement
- stock count sheets
- custody statements
- signed reconciliation sheets

### Key Rule

The cutover should not depend only on manual typed numbers. Supporting documents should be attached wherever possible.

## 14. Screen 11: Review and Reconciliation

### Purpose

Show one consolidated review screen before approval.

### Dashboard Sections

- project basic data summary
- cutover date summary
- total opening financial balances
- total subcontractor outstanding balance
- total supplier outstanding balance
- total owner receivable balance
- total warehouse opening value
- total custody opening balance
- warnings and unresolved validation issues

### Required Checks

- all mandatory screens completed
- no missing required party account
- no invalid document numbering
- no stock item without warehouse
- no negative quantity in opening stock
- no subcontractor opening line without work item

### Recommended UX

- show completion percentage
- show issue counters by section
- allow drill-down into each error
- block approval while critical issues remain

## 15. Screen 12: Approval and Lock

### Purpose

Finalize the cutover and freeze opening data.

### Approval Chain

Recommended approval order:

1. Project Manager reviews operational positions
2. Finance Manager reviews balances
3. General Manager approves final cutover

Internal Auditor or authorized reviewer may also participate if the company wants stronger control.

### Main Actions

- Approve Section
- Return for Correction
- Approve Cutover
- Lock Opening Data

### Key Rules

- once locked, opening entries should not be edited directly
- any later correction should happen through a formal adjustment workflow
- approval and locking events must be fully audited

## 16. Screen 13: Go-Live Confirmation

### Purpose

Activate normal project operations after successful cutover.

### Result

Once approved and locked:

- project transactions become enabled
- certificates, invoices, warehouse movements, and payments may start from the go-live point
- opening balances remain visible as opening data, not normal live transactions

### Final Confirmation Message

The system should clearly confirm:

- cutover date
- locking timestamp
- approved by
- project operational start in system

## 17. Recommended Status Model

Suggested cutover statuses:

- Draft
- In Progress
- Waiting for Review
- Returned for Correction
- Approved
- Locked
- Go-Live Enabled

## 18. Recommended Security and Audit Controls

The cutover flow must enforce:

- role-based access per screen
- no direct editing after lock
- full audit trail for every opening entry
- attachment logging
- approval comments and rejection reasons
- section-level completion tracking

## 19. Accounting Best-Practice Notes

Recommended accounting approach:

- do not re-enter full historical detail unless the company explicitly wants that cost and effort
- load opening positions as of a clean cutover date
- reconcile opening balances to the latest approved accounting and project records
- keep operational opening positions detailed enough for future workflow continuity

Examples:

- subcontractor previous quantities should be loaded so next certificates work correctly
- warehouse opening stock should represent only stock still physically available
- fully settled old supplier invoices do not need to be migrated as active records

## 20. Design Decision

The cutover for existing projects should be implemented as a controlled wizard with mandatory review, reconciliation, approval, and locking.

This is the safest operational and accounting approach for bringing a live project into the new system without corrupting future balances, workflow continuity, or project profitability.
