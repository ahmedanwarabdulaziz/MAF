-- Migration 060: Dashboard Aggregations (PERF-05)

CREATE OR REPLACE VIEW vw_project_financial_summary AS
SELECT 
    p.id AS project_id,
    p.arabic_name,
    COALESCE(p.estimated_contract_value, 0) AS budget,
    COALESCE(ob.total_billed, 0) AS billed,
    COALESCE(ob.total_collected, 0) AS collected,
    COALESCE(sup.total_cost, 0) AS sup_cost,
    COALESCE(sup.total_paid, 0) AS sup_paid,
    COALESCE(sub.total_cost, 0) AS sub_cost,
    COALESCE(sub.total_paid, 0) AS sub_paid
FROM projects p
LEFT JOIN (
    SELECT project_id, SUM(amount) AS total_billed, SUM(collected_amount) AS total_collected
    FROM owner_billing_certificates
    WHERE status = 'approved'
    GROUP BY project_id
) ob ON ob.project_id = p.id
LEFT JOIN (
    SELECT project_id, SUM(net_amount) AS total_cost, SUM(paid_to_date) AS total_paid
    FROM supplier_invoices
    WHERE status IN ('posted', 'partially_paid', 'paid')
    GROUP BY project_id
) sup ON sup.project_id = p.id
LEFT JOIN (
    SELECT project_id, SUM(net_amount) AS total_cost, SUM(paid_to_date) AS total_paid
    FROM subcontractor_certificates
    WHERE status IN ('approved', 'paid_in_full')
    GROUP BY project_id
) sub ON sub.project_id = p.id;

CREATE OR REPLACE VIEW vw_company_financial_summary AS
SELECT
    (SELECT COUNT(id) FROM projects) AS active_projects,
    (SELECT COALESCE(SUM(net_amount - paid_to_date), 0) FROM supplier_invoices WHERE status IN ('posted', 'partially_paid', 'paid')) AS supplier_liability,
    (SELECT COALESCE(SUM(net_amount - paid_to_date), 0) FROM subcontractor_certificates WHERE status IN ('approved', 'paid_in_full')) AS subcontractor_liability;
