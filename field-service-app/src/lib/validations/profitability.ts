// ── Profitability Types ──────────────────────────────────────────

/** Single job profitability — matches get_job_profitability RPC */
export interface JobProfitability {
    job_id: string;
    total_revenue: number;
    total_labor_cost: number;
    total_material_cost: number;
    gross_margin: number;
    gross_margin_pct: number;
    is_over_budget: boolean;
}

/** Overview row — matches get_profitability_overview RPC */
export interface ProfitabilityOverview {
    job_id: string;
    job_title: string;
    customer_name: string;
    job_status: string;
    total_revenue: number;
    total_labor_cost: number;
    total_material_cost: number;
    total_cost: number;
    gross_margin: number;
    gross_margin_pct: number;
    is_over_budget: boolean;
    technician_count: number;
    parts_count: number;
}

/** Aggregate KPIs for the profitability dashboard header */
export interface ProfitabilityKPIs {
    total_revenue: number;
    total_costs: number;
    average_margin_pct: number;
    over_budget_count: number;
    job_count: number;
}
