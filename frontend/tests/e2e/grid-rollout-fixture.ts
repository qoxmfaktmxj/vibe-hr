import type { Page } from "@playwright/test";

type Item = Record<string, unknown> & { id: number };
export async function installGridRolloutFixture(page: Page) {
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  const forms: Item[] = [1, 2].map(id => ({ id, form_code: `FORM_${id}`, form_name_ko: `신청서 ${id}`, form_name_en: null, module_code: "HRI", default_priority: 50, is_active: true, allow_draft: true, allow_withdraw: true, requires_receive: false }));
  const templates: Item[] = [1, 2].map(id => ({ id, template_code: `TPL_${id}`, template_name: `결재선 ${id}`, scope_type: "GLOBAL", scope_id: null, priority: 100, is_default: false, is_active: true, steps: [{ id, step_order: 1, step_type: "APPROVAL", actor_resolve_type: "USER_FIXED", actor_role_code: null, actor_user_id: 1, allow_delegate: true, required_action: "APPROVE" }] }));
  const department = { id: 1, code: "HR", name: "인사팀", parent_id: null, parent_name: null, organization_type: "headquarters", cost_center_code: "CC-HR", employee_count: 2, is_active: true };
  const employees = [1, 2].map(id => ({ id, employee_no: `EMP-00${id}`, display_name: id === 1 ? "김테스트" : "이테스트", department_id: 1, department_name: "인사팀", position_title: "사원", hire_date: "2021-01-01", employment_status: "active", is_active: true, email: `employee${id}@example.test`, login_id: `employee${id}` }));
  const pattern = { id: 1, code: "DAY", name: "주간 근무", is_active: true, days: [] };
  const assignments: Item[] = [{ id: 101, department_id: 1, department_code: "HR", department_name: "인사팀", organization_type: "headquarters", cost_center_code: "CC-HR", employee_count: 2, pattern_id: 1, pattern_code: "DAY", pattern_name: "주간 근무", effective_from: "2026-01-01", effective_to: null, priority: 100, is_active: true }];
  const exceptions: Item[] = [{ id: 201, employee_id: 1, employee_no: "EMP-001", employee_name: "김테스트", department_id: 1, department_code: "HR", department_name: "인사팀", pattern_id: 1, pattern_code: "DAY", pattern_name: "주간 근무", effective_from: "2026-01-01", effective_to: null, reason: "기존 예외", priority: 1000, is_active: true }];
  const payslip = { run_id: 1, run_employee_id: 1, year_month: "2026-09", run_name: "9월 급여", run_status: "paid", gross_pay: 3000000, total_deductions: 300000, net_pay: 2700000, taxable_income: 3000000, non_taxable_income: 0, paid_at: "2026-09-25" };
  const calc = { id: 31, retire_case_id: 31, employee_id: 1, employee_no: "EMP-001", employee_name: "김테스트", department_name: "인사팀", hire_date: "2021-01-01", retire_date: "2026-09-30", service_days: 2100, avg_wage_base_from: "2026-07-01", avg_wage_base_to: "2026-09-30", wage_total_3m: 9000000, base_days_3m: 92, avg_daily_wage: 97826, severance_amount: 16800000, adjustment_amount: 0, final_amount: 16800000, status: "draft", service_years: 6, income_tax: 100000, local_income_tax: 10000, net_severance: 16690000 };
  const voucher = { id: 51, voucher_no: "VCH-001", run_id: 1, voucher_type: "accrual", year_month: "2026-09", voucher_date: "2026-09-25", status: "draft", total_debit: 3000000, total_credit: 3000000, summary: "9월 급여" };
  const leaves = Array.from({ length: 51 }, (_, index) => ({ id: index + 1, employee_id: 1, employee_no: "EMP-001", employee_name: "김테스트", department_name: "인사팀", leave_type: "annual", start_date: "2026-10-21", end_date: "2026-10-21", leave_days: 1, request_status: index ? "approved" : "pending", reason: `휴가 사유 ${index + 1}`, created_at: "2026-10-18" }));
  const collections = new Map<string, Item[]>([["/api/hri/form-types", forms], ["/api/hri/approval-templates", templates], ["/api/tim/schedules/departments", assignments], ["/api/tim/schedules/exceptions/employees", exceptions]]);
  await page.route("**/api/**", async route => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const path = url.pathname;
    const send = (value: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
    const collectionPath = path.endsWith("/batch") ? path.slice(0, -6) : path;
    const collection = collections.get(collectionPath);
    if (collection && method === "GET") return send({ items: collection, total_count: collection.length });
    if (collection && method === "POST") {
      const body = req.postDataJSON() as { items: Item[]; delete_ids: number[] };
      writes.push({ path, body });
      if (JSON.stringify(body.items).includes("실패")) return send({ detail: "일괄 저장에 실패했습니다. 초안을 확인해 주세요." }, 409);
      const next = collection.filter(item => !body.delete_ids.includes(item.id));
      for (const change of body.items) {
        const index = next.findIndex(item => item.id === change.id);
        if (index >= 0) next[index] = { ...next[index], ...change };
        else next.push({ ...change, id: Math.max(1000, ...next.map(item => item.id)) + 1, ...(collectionPath.includes("/schedules/") ? { department_name: "인사팀", department_code: "HR", employee_no: "EMP-001", employee_name: "김테스트", pattern_name: "주간 근무", pattern_code: "DAY", employee_count: 2 } : {}) });
      }
      collection.splice(0, collection.length, ...next);
      return send({ items: collection, total_count: collection.length, inserted_count: body.items.filter(item => !item.id).length, updated_count: body.items.filter(item => item.id).length, deleted_count: body.delete_ids.length });
    }
    if (path === "/api/wel/requests") return send({ items: [{ id: 1, request_no: "WEL-001", benefit_type_code: "MEDICAL", benefit_type_name: "의료비", employee_no: "EMP-001", employee_name: "김테스트", department_name: "인사팀", status_code: "submitted", requested_amount: 100000, approved_amount: null, payroll_run_label: null, description: "검증 신청", requested_at: "2026-10-18", created_at: "2026-10-18", updated_at: "2026-10-18" }], total_count: 1, page: 1, limit: 50 });
    if (path === "/api/tim/schedules/patterns") return send({ items: [pattern], total_count: 1 });
    if (path === "/api/org/departments") return send({ departments: [department], total_count: 1 });
    if (path === "/api/employees") { const query = url.searchParams.get("name") ?? url.searchParams.get("employee_no") ?? ""; const rows = employees.filter(item => item.display_name.includes(query) || item.employee_no.includes(query)); return send({ employees: rows, total_count: rows.length }); }
    if (path === "/api/tim/work-schedules" && method === "GET") return send({ items: [{ id: 1, code: "DAY", name: "주간", work_start: "09:00", work_end: "18:00", break_minutes: 60, is_overnight: false, work_hours: 8, is_active: true, sort_order: 1, description: "기본 근무" }], total_count: 1 });
    if (path === "/api/pay/my/payslips") return send({ items: [payslip], total_count: 1 });
    if (path === "/api/pay/my/payslips/1") return send({ summary: payslip, items: [{ id: 1, item_code: "BASE", item_name: "기본급", direction: "earning", amount: 3000000 }, { id: 2, item_code: "TAX", item_name: "소득세", direction: "deduction", amount: 300000 }] });
    if (path === "/api/pay/my/payslips/1/pdf") return route.fulfill({ contentType: "application/pdf", body: "%PDF-1.4\nfixture" });
    if (path === "/api/hr/severance/calcs") return send({ items: [calc], total_count: 1, page: 1, limit: 50 });
    if (path === "/api/hr/severance/calcs/31") return send({ calc, tax_detail: { service_year_deduction: 1000000, conversion_income: 15000000, conversion_income_deduction: 2000000, taxable_base: 13000000, income_tax: 100000, local_income_tax: 10000, net_severance: 16690000 }, wage_details: [{ item_code: "BASE", item_name: "기본급", include_type: "full", raw_amount: 9000000, included_amount: 9000000 }] });
    if (path === "/api/pay/runs") return send({ items: [{ id: 1, run_name: "9월 급여", year_month: "2026-09", status: "paid" }], total_count: 1 });
    if (path === "/api/pay/vouchers") return send({ items: [voucher], total_count: 1, page: 1, limit: 50 });
    if (path === "/api/pay/vouchers/51") return send({ voucher, lines: [{ id: 1, line_no: 1, gl_account_code: "5001", gl_account_name: "급여", cost_center_code: "CC-HR", debit_amount: 3000000, credit_amount: 0, summary: "급여 비용" }, { id: 2, line_no: 2, gl_account_code: "2001", gl_account_name: "미지급금", cost_center_code: "CC-HR", debit_amount: 0, credit_amount: 3000000, summary: "급여 지급" }] });
    if (path === "/api/tim/leave-requests/my") { const pageNo = Number(url.searchParams.get("page") ?? 1); return send({ items: leaves.slice((pageNo - 1) * 50, pageNo * 50), total_count: leaves.length, page: pageNo, limit: 50 }); }
    if (path === "/api/tim/leave-requests/1/cancel") { writes.push({ path, body: req.postDataJSON() }); leaves[0].request_status = "cancelled"; return send({}); }
    if (path === "/api/tim/month-close" && method === "GET") return send({ items: [{ id: 1, year: Number(url.searchParams.get("year")), month: 1, close_status: "open", employee_count: 2, present_days: 40, absent_days: 0, late_days: 1, leave_days: 2, total_overtime_minutes: 120, total_night_minutes: 0, total_holiday_work_minutes: 0, closed_by_name: null, closed_at: null, note: null }], total_count: 1 });
    if (path === "/api/tim/month-close" && method === "POST") { writes.push({ path, body: req.postDataJSON() }); return send({}); }
    if (method !== "GET" && !path.startsWith("/api/auth/")) throw new Error(`Unplanned test write blocked: ${path}`);
    await route.continue();
  });
  return { writes, collections };
}
