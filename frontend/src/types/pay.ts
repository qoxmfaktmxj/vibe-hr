export interface PayPayrollCodeItem {
    [key: string]: unknown;
    id: number;
    code: string;
    name: string;
    pay_type: string;
    payment_day: string;
    tax_deductible: boolean;
    social_ins_deductible: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface PayPayrollCodeBatchRequest {
    items: Array<Partial<PayPayrollCodeItem>>;
    delete_ids: number[];
}

export interface PayPayrollCodeBatchResponse {
    items: PayPayrollCodeItem[];
    total_count: number;
    inserted_count: number;
    updated_count: number;
    deleted_count: number;
}

export interface PayTaxRateItem {
    [key: string]: unknown;
    id: number;
    year: number;
    rate_type: string;
    employee_rate: number | null;
    employer_rate: number | null;
    min_limit: number | null;
    max_limit: number | null;
    created_at: string;
    updated_at: string;
}

export interface PayTaxRateBatchRequest {
    items: Array<Partial<PayTaxRateItem>>;
    delete_ids: number[];
}

export interface PayTaxRateBatchResponse {
    items: PayTaxRateItem[];
    total_count: number;
    inserted_count: number;
    updated_count: number;
    deleted_count: number;
}

export interface PayIncomeTaxBracketItem {
    [key: string]: unknown;
    id: number;
    year: number;
    annual_taxable_from: number;
    annual_taxable_to: number | null;
    tax_rate: number;
    quick_deduction: number;
    created_at: string;
    updated_at: string;
}

export interface PayIncomeTaxBracketBatchRequest {
    items: Array<Partial<PayIncomeTaxBracketItem>>;
    delete_ids: number[];
}

export interface PayIncomeTaxBracketBatchResponse {
    items: PayIncomeTaxBracketItem[];
    total_count: number;
    inserted_count: number;
    updated_count: number;
    deleted_count: number;
}

export interface PayAllowanceDeductionItem {
    [key: string]: unknown;
    id: number;
    code: string;
    name: string;
    type: string; // "allowance" | "deduction"
    tax_type: string; // "taxable" | "non-taxable" | "tax" | "insurance"
    calculation_type: string; // "fixed" | "hourly" | "formula"
    is_active: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export interface PayAllowanceDeductionBatchRequest {
    items: Array<Partial<PayAllowanceDeductionItem>>;
    delete_ids: number[];
}

export interface PayAllowanceDeductionBatchResponse {
    items: PayAllowanceDeductionItem[];
    total_count: number;
    inserted_count: number;
    updated_count: number;
    deleted_count: number;
}

export interface PayItemGroupDetailItem {
    id: number;
    group_id: number;
    item_id: number;
    type: string; // "allowance" | "deduction"
    created_at: string;
}

export interface PayItemGroupItem {
    [key: string]: unknown;
    id: number;
    code: string;
    name: string;
    description: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    details: PayItemGroupDetailItem[];
}

export interface PayItemGroupBatchRequest {
    items: Array<Partial<PayItemGroupItem>>;
    delete_ids: number[];
}

export interface PayItemGroupBatchResponse {
    items: PayItemGroupItem[];
    total_count: number;
    inserted_count: number;
    updated_count: number;
    deleted_count: number;
}

export interface PayEmployeeProfileItem {
    [key: string]: unknown;
    id: number;
    employee_id: number;
    employee_no: string | null;
    employee_name: string | null;
    payroll_code_id: number;
    payroll_code_name: string | null;
    item_group_id: number | null;
    item_group_name: string | null;
    base_salary: number;
    pay_type_code: string;
    payment_day_type: string;
    payment_day_value: number | null;
    holiday_adjustment: string;
    effective_from: string;
    effective_to: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface PayEmployeeProfileBatchRequest {
    items: Array<Partial<PayEmployeeProfileItem>>;
    delete_ids: number[];
}

export interface PayEmployeeProfileBatchResponse {
    items: PayEmployeeProfileItem[];
    total_count: number;
    inserted_count: number;
    updated_count: number;
    deleted_count: number;
}

export interface PayVariableInputItem {
    [key: string]: unknown;
    id: number;
    year_month: string;
    employee_id: number;
    employee_no: string | null;
    employee_name: string | null;
    item_code: string;
    item_name: string | null;
    direction: string;
    amount: number;
    memo: string | null;
    created_at: string;
    updated_at: string;
}

export interface PayVariableInputBatchRequest {
    items: Array<Partial<PayVariableInputItem>>;
    delete_ids: number[];
}

export interface PayVariableInputBatchResponse {
    items: PayVariableInputItem[];
    total_count: number;
    inserted_count: number;
    updated_count: number;
    deleted_count: number;
}

export interface PayPayrollRunItem {
    [key: string]: unknown;
    id: number;
    year_month: string;
    payroll_code_id: number;
    payroll_code_name: string | null;
    run_name: string | null;
    status: "draft" | "calculated" | "closed" | "paid";
    total_employees: number;
    total_gross: number;
    total_deductions: number;
    total_net: number;
    calculated_at: string | null;
    closed_at: string | null;
    paid_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface PayPayrollRunActionResponse {
    run: PayPayrollRunItem;
}

export interface PayPayrollRunEmployeeItem {
    id: number;
    run_id: number;
    employee_id: number;
    employee_no: string | null;
    employee_name: string | null;
    profile_id: number | null;
    gross_pay: number;
    taxable_income: number;
    non_taxable_income: number;
    total_deductions: number;
    net_pay: number;
    status: string;
    warning_message: string | null;
    created_at: string;
    updated_at: string;
}

export interface PayPayrollRunEmployeeDetailItem {
    id: number;
    run_employee_id: number;
    item_code: string;
    item_name: string;
    direction: string;
    amount: number;
    tax_type: string;
    calculation_type: string;
    source_type: string;
    created_at: string;
}

export interface PayPayrollRunEmployeeDetailResponse {
    employee: PayPayrollRunEmployeeItem;
    items: PayPayrollRunEmployeeDetailItem[];
}
