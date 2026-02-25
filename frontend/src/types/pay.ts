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
