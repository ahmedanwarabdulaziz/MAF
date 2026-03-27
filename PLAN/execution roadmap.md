# Antigravity & Claude - Execution Roadmap

## Document Role

This file is the main execution reference for building the system.

It is designed to help:

- you
- Antigravity
- Claude

work from one practical roadmap without getting lost in large documents.

This file does not replace:

- `master plan.md`
- `database design.md`
- `cutover flow screens.md`
- `system modules and navigation.md`
- `role and permission matrix.md`
- `module permission breakdown.md`

Instead, it tells the team:

- what to build first
- how to split the work into small phases
- which phases are difficult
- which agent should handle each phase
- how to reduce token cost and context size

## 1. Working Model

The project should be delivered in small phases.

Each phase should be:

- small enough to review easily
- narrow enough to avoid wasted context
- clear enough to assign to one primary agent
- independent enough to reduce merge and coordination problems

Each phase should have:

- a clear goal
- clear inputs
- a clear output
- a recommended agent
- a difficulty level
- a review checkpoint before moving forward

## 2. Agent Assignment Strategy

To control token cost, we should not use the strongest agent for everything.

Recommended rule:

- use `Claude` for architecture-sensitive, logic-heavy, cross-module, finance-sensitive, workflow-sensitive, and schema-sensitive work
- use `Antigravity` for bounded implementation work, UI structure, screen building, CRUD pages, dashboard polish, and low-risk follow-up tasks

## 3. Difficulty Levels

### `L1`

Very small and low-risk work.

Typical examples:

- static pages
- simple forms
- display-only screens
- basic documentation cleanup

Recommended agent:

- `Antigravity`

### `L2`

Normal implementation work with moderate logic.

Typical examples:

- standard CRUD screens
- list and detail pages
- module navigation
- non-critical dashboard widgets

Recommended agent:

- `Antigravity` by default
- `Claude` only if blocked or tightly coupled with architecture

### `L3`

High-complexity work with important business rules.

Typical examples:

- approval-driven forms
- finance-linked modules
- cutover logic
- warehouse value movement
- project costing logic

Recommended agent:

- `Claude`

### `L4`

Critical architectural or high-risk work.

Typical examples:

- authentication and access model foundation
- schema design for core finance and workflow logic
- permission engine
- approval workflow engine
- migration and cutover core model
- subcontractor certificate engine

Recommended agent:

- `Claude`

## 4. Execution Rules

To keep work efficient:

- do not start a phase before its dependencies are ready
- keep each phase focused on one business slice
- review after every phase
- update this roadmap after each completed phase
- do not mix major schema work and major UI work in the same phase unless absolutely necessary

## 5. Delivery Status Legend

Recommended statuses:

- `Not Started`
- `Ready`
- `In Progress`
- `In Review`
- `Approved`
- `Blocked`
- `Done`

## 6. Phase Template

Each phase should follow this template:

- Phase ID
- Title
- Difficulty
- Recommended Agent
- Status
- Goal
- Inputs
- Deliverables
- Dependencies
- Review Notes

## 7. Recommended Build Order

The system should be built in this order:

1. Product foundation
2. Access and permission foundation
3. Core company and project data
4. Warehouse and item foundation
5. Cutover for existing projects
6. Subcontractor workflow
7. Supplier workflow
8. Owner billing and collections
9. Payments and treasury execution
10. Dashboards, reports, and stabilization

## 8. Execution Phases

### Phase 01

- Phase ID: `P01`
- Title: Public Website and System Shell Foundation
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Status: `Done`
- Goal: Create the public website entry layer and the protected system shell with Arabic-first RTL structure, clear route separation, base layout, navigation skeleton, and theme foundation.
- Inputs:
  - `master plan.md`
  - `system modules and navigation.md`
- Deliverables:
  - public website shell
  - system application shell
  - route split between public site and system area
  - RTL layout
  - top bar
  - sidebar switching between company and project context
  - theme token setup
- Dependencies:
  - none
- Review Notes:
  - confirm public website exists separately from the system
  - confirm public-to-system entry path
  - confirm Arabic layout
  - confirm project switcher
  - confirm navigation groups

### Phase 02

- Phase ID: `P02`
- Title: Authentication, Users, Permission Groups, and Scope Model
- Difficulty: `L4`
- Recommended Agent: `Claude`
- Status: `Ready`
- Goal: Build the core access architecture for users, roles, permission groups, and scope assignment.
- Inputs:
  - `master plan.md`
  - `database design.md`
  - `role and permission matrix.md`
  - `module permission breakdown.md`
- Deliverables:
  - base auth integration
  - user model
  - permission group model
  - scope model for company and projects
  - admin access control foundation
- Dependencies:
  - `P01`
- Review Notes:
  - confirm Super Admin control
  - confirm project scope assignment
  - confirm company scope assignment

### Phase 03

- Phase ID: `P03`
- Title: Company, Project, Cost Center, and Party Core Tables
- Difficulty: `L4`
- Recommended Agent: `Claude`
- Status: `Ready`
- Goal: Build the foundational data layer for company structure, projects, parties, contacts, and role accounts.
- Inputs:
  - `database design.md`
- Deliverables:
  - companies
  - projects
  - cost centers
  - parties
  - party roles
  - party role accounts
  - project party links
- Dependencies:
  - `P02`
- Review Notes:
  - confirm one legal party can have multiple financial roles
  - confirm project onboarding type exists

### Phase 04

- Phase ID: `P04`
- Title: Permission Admin Screens
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Status: `Done`
- Goal: Build UI screens for managing users, permission groups, project scopes, and company scopes.
- Inputs:
  - `role and permission matrix.md`
  - `module permission breakdown.md`
- Deliverables:
  - users screen
  - permission groups screen
  - scope assignment screen
  - project assignment screen
- Dependencies:
  - `P02`
  - `P03`
- Review Notes:
  - confirm editable permission groups
  - confirm group-to-user assignment

### Phase 05

- Phase ID: `P05`
- Title: Item Master and Warehouse Foundation
- Difficulty: `L3`
- Recommended Agent: `Claude`
- Status: `Done`
- Goal: Build item groups, items, units, warehouses, stock balances, and stock movement foundation.
- Inputs:
  - `database design.md`
  - `master plan.md`
- Deliverables:
  - item master schema
  - warehouse schema
  - stock ledger foundation
  - warehouse movement model
- Dependencies:
  - `P03`
- Review Notes:
  - confirm value-based movement
  - confirm main warehouse and project warehouse model

### Phase 06

- Phase ID: `P06`
- Title: Warehouse and Item Screens
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Status: `Done`
- Goal: Build the item master and warehouse management screens for company and project use.
- Inputs:
  - `system modules and navigation.md`
  - `database design.md`
- Deliverables:
  - item groups screen
  - items screen
  - warehouse list
  - stock balance screens
  - transfer entry screens
- Dependencies:
  - `P05`
- Review Notes:
  - confirm Arabic labels
  - confirm warehouse scope visibility

### Phase 07

- Phase ID: `P07`
- Title: Existing Project Cutover Core Model
- Difficulty: `L4`
- Recommended Agent: `Claude / Antigravity`
- Status: `Done`
- Goal: Build the cutover data model and processing logic for existing projects.
- Inputs:
  - `master plan.md`
  - `database design.md`
  - `cutover flow screens.md`
- Deliverables:
  - migration batch model
  - opening balance entries
  - opening operational entries
  - cutover validation rules
  - lock logic
- Dependencies:
  - `P03`
  - `P05`
- Review Notes:
  - confirm financial vs operational opening positions
  - confirm locking rules

### Phase 08

- Phase ID: `P08`
- Title: Existing Project Cutover Screens
- Difficulty: `L3`
- Recommended Agent: `Antigravity`
- Status: `Done`
- Goal: Build the cutover wizard UI for ongoing projects.
- Inputs:
  - `cutover flow screens.md`
  - `system modules and navigation.md`
- Deliverables:
  - cutover wizard
  - review screen
  - approval and lock screen
  - go-live confirmation screen
- Dependencies:
  - `P07`
- Review Notes:
  - confirm section completion logic
  - confirm temporary cutover sidebar entry

### Phase 09

- Phase ID: `P09`
- Title: Subcontractor Agreement and Work Item Foundation
- Difficulty: `L4`
- Recommended Agent: `Claude`
- Status: `Done`
- Goal: Build the subcontractor agreement model and project work item catalog.
- Inputs:
  - `database design.md`
  - `master plan.md`
- Deliverables:
  - subcontract agreements
  - agreement lines
  - project work items
  - rate structure
  - Ta'liya defaults
- Dependencies:
  - `P03`
- Review Notes:
  - confirm different rates per subcontractor
  - confirm project-specific work items

### Phase 10

- Phase ID: `P10`
- Title: Subcontractor Certificate Engine
- Difficulty: `L4`
- Recommended Agent: `Claude`
- Status: `Done`
- Goal: Build certificate calculation logic including cumulative quantities, Ta'liya, Allowance, deductions, and outstanding balance logic.
- Inputs:
  - `master plan.md`
  - `database design.md`
- Deliverables:
  - certificate header model
  - certificate line model
  - allowance model
  - deduction model
  - retention release model
  - calculation services
- Dependencies:
  - `P09`
- Review Notes:
  - confirm cumulative logic
  - confirm allowance behavior
  - confirm Ta'liya levels

### Phase 11

- Phase ID: `P11`
- Title: Subcontractor Certificate Screens
- Difficulty: `L3`
- Recommended Agent: `Antigravity`
- Status: `Done`
- Goal: Build the screens for subcontractor list, agreements, certificates, statements, and retention views.
- Inputs:
  - `system modules and navigation.md`
  - `module permission breakdown.md`
- Deliverables:
  - certificate list
  - create certificate screen
  - detail screen
  - subcontractor statement
  - retention view
- Dependencies:
  - `P10`
- Review Notes:
  - confirm engineer flow
  - confirm PM review flow

### Phase 12

- Phase ID: `P12`
- Title: Supplier Procurement Core Logic
- Difficulty: `L4`
- Recommended Agent: `Claude`
- Status: `Done`
- Goal: Build purchase requests, supplier invoices, return invoices, receipt confirmation model, and supplier balances.
- Inputs:
  - `master plan.md`
  - `database design.md`
- Deliverables:
  - purchase request model
  - supplier invoice model
  - supplier return model
  - receipt confirmation logic
  - supplier balance logic
- Dependencies:
  - `P03`
  - `P05`
- Review Notes:
  - confirm warehouse-first rule
  - confirm return invoice behavior

### Phase 13

- Phase ID: `P13`
- Title: Supplier Procurement Screens
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Status: `Done`
- Goal: Build supplier project screens for requests, invoices, returns, and statements.
- Inputs:
  - `system modules and navigation.md`
  - `module permission breakdown.md`
- Deliverables:
  - purchase request screens
  - supplier invoice screens
  - return screens
  - supplier statement screens
- Dependencies:
  - `P12`
- Review Notes:
  - confirm PM and warehouse manager visibility

### Phase 14

- Phase ID: `P14`
- Title: Owner Billing and Collections Core Logic
- Difficulty: `L3`
- Recommended Agent: `Claude`
- Status: `Done`
- Goal: Build owner billing documents, billable source links, and collection recording.
- Inputs:
  - `master plan.md`
  - `database design.md`
- Deliverables:
  - owner billing model
  - source-link model
  - owner collection model
  - receivable logic
- Dependencies:
  - `P10`
  - `P12`
- Review Notes:
  - confirm billable source rules
  - confirm owner-facing text override

### Phase 15

- Phase ID: `P15`
- Title: Owner Billing and Collections Screens
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Status: `Done`
- Goal: Build owner invoice/certificate screens, collections screens, and receivable views.
- Inputs:
  - `system modules and navigation.md`
- Deliverables:
  - owner bill draft screen
  - line pricing screen
  - collections entry screen
  - receivable summary screen
- Dependencies:
  - `P14`
- Review Notes:
  - confirm formal numbering
  - confirm account receiving field

### Phase 16

- Phase ID: `P16`
- Title: Petty Expenses and Custody Core Logic
- Difficulty: `L3`
- Recommended Agent: `Claude`
- Status: `Done`
- Goal: Build custody accounts, petty expenses, negative limit logic, and reimbursement model.
- Inputs:
  - `master plan.md`
  - `database design.md`
- Deliverables:
  - custody account model
  - petty expense model
  - reimbursement logic
  - negative balance rule
- Dependencies:
  - `P03`
- Review Notes:
  - confirm permanent and temporary custody

### Phase 17

- Phase ID: `P17`
- Title: Petty Expenses and Custody Screens
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Status: `Done`
- Goal: Build screens for custody balances, petty expense entry, and reimbursement tracking.
- Inputs:
  - `system modules and navigation.md`
- Deliverables:
  - custody accounts screen
  - petty expense entry screen
  - reimbursement history
  - alerts for negative balances
- Dependencies:
  - `P16`
- Review Notes:
  - confirm engineer-friendly flow

### Phase 18

- Phase ID: `P18`
- Title: Payments and Treasury Execution Core Logic
- Difficulty: `L4`
- Recommended Agent: `Claude`
- Status: `Done`
- Goal: Build payment vouchers, partial settlement logic, treasury source handling, and attachment-proof handling.
- Inputs:
  - `master plan.md`
  - `database design.md`
  - `module permission breakdown.md`
- Deliverables:
  - payment voucher model
  - payment allocation model
  - execution logic
  - treasury linkage
- Dependencies:
  - `P10`
  - `P12`
  - `P16`
- Review Notes:
  - confirm party-balance payment logic
  - confirm split between finance and treasury

### Phase 19

- Phase ID: `P19`
- Title: Payments and Treasury Screens
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Status: `Ready`
- Goal: Build payment queue, payment voucher, treasury source, and proof-upload screens.
- Inputs:
  - `system modules and navigation.md`
- Deliverables:
  - approved payments queue
  - payment entry screen
  - voucher detail screen
  - receipt and attachment view
- Dependencies:
  - `P18`
- Review Notes:
  - confirm execution-only treasury behavior

### Phase 20

- Phase ID: `P20`
- Title: Dashboards, Reports, and Stabilization
- Difficulty: `L3`
- Recommended Agent: `Antigravity`
- Status: `Done`
- Goal: Build operational dashboards, reporting views, and final UI stabilization.
- Inputs:
  - all previous phases
- Deliverables:
  - company dashboard
  - project dashboard
  - report entry pages
  - KPI cards
  - final polish and consistency fixes
- Dependencies:
  - `P01` to `P19`
- Review Notes:
  - confirm management usefulness
  - confirm report accuracy

## 9. Cost-Control Notes

To reduce token cost:

- use `Claude` only for logic-heavy and architecture-heavy phases
- use `Antigravity` for UI-heavy and bounded implementation phases
- do not send the full project context to every agent if the phase needs only one module
- close each phase before opening too many parallel large phases

Recommended practical rule:

- if the phase changes schema, workflows, approvals, or finance logic, prefer `Claude`
- if the phase mostly builds screens on top of stable rules, prefer `Antigravity`

## 10. Review Checkpoint Policy

Before marking any phase as `Done`, confirm:

- business rules were followed
- scope is complete
- Arabic UI behavior is correct where applicable
- permissions are respected
- auditability is preserved
- the next phase has what it needs

## 11. Design Decision

The system should be delivered through many small, reviewable phases, with agent assignment based on difficulty and business risk.

This is the best way to:

- keep quality high
- control token cost
- reduce context waste
- let you and the team review progress step by step

This file should now be treated as the main execution reference for implementation planning.
