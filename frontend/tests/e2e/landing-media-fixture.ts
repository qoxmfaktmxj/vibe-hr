import type { Page } from "@playwright/test";
import { installGridRolloutFixture } from "./grid-rollout-fixture";

export const LANDING_SCENES = [
  ["01", "/hr/employee", "employee-ux-preview", "light", "blue"],
  ["02", "/hr/basic", "hr-basic", "light", "gray"],
  ["03", "/hr/basic", "hr-basic", "light", "green"],
  ["04", "/hri/tasks/approvals", "hri-tasks", "dark", "blue"],
  ["05", "/org/chart", "landing-capture", "light", "blue"],
  ["06", "/tim/work-codes", "grid-rollout", "light", "skyblue"],
  ["07", "/tim/status", "production-repairs", "dark", "blue"],
  ["08", "/tim/month-closing", "grid-rollout", "light", "gray"],
  ["10", "/hri/my-payslip", "grid-rollout", "light", "blue"],
  ["11", "/payroll/runs", "file-actions", "dark", "gray"],
  ["12", "/payroll/vouchers", "grid-rollout", "light", "gray"],
  ["13", "/hr/severance/calcs", "grid-rollout", "light", "blue"],
  ["14", "/wel/requests", "grid-rollout", "light", "green"],
  ["15", "/tra/applications", "training-applications", "dark", "skyblue"],
  ["16", "/pap/targets", "appraisal-targets", "light", "gray"],
  ["17", "/settings/permissions", "landing-capture", "dark", "blue"],
] as const;

async function installCaptureReads(page: Page) {
  await page.route("**/api/org/chart", route => route.fulfill({ json: {
    departments: ["VIBE 본부", "경영지원", "제품개발", "고객경험", "인사팀", "재무팀", "플랫폼팀", "디자인팀"].map((name, index) => ({
      id: index + 1, code: `ORG-${index + 1}`, name, parent_id: index === 0 ? null : index < 4 ? 1 : index < 6 ? 2 : 3,
      parent_name: null, organization_type: index === 0 ? "본부" : "팀", cost_center_code: `CC-${100 + index}`, description: null,
      employee_count: [48, 12, 24, 12, 6, 6, 16, 8][index], is_active: true, created_at: "2026-01-01", updated_at: "2026-10-01",
    })), total_count: 8, reference_date: "2026-10-18",
  } }));
  await page.route("**/api/tim/attendance-daily?**", route => route.fulfill({ json: {
    items: ["김서윤", "이하은", "박지호", "정도윤", "최유진", "한지민", "서준호", "윤다은"].map((name, index) => ({
      id: index + 1, employee_id: index + 1, employee_no: `DEMO-${String(index + 1).padStart(3, "0")}`, employee_name: name,
      department_name: ["인사팀", "플랫폼팀", "디자인팀"][index % 3], work_date: "2026-10-16", check_in_at: "2026-10-16T00:00:00Z",
      check_out_at: "2026-10-16T09:00:00Z", attendance_status: index === 3 ? "remote" : index === 5 ? "leave" : "present", approved_leave_type: null,
    })), total_count: 8, page: 1, limit: 50,
  } }));
  await page.route("**/api/pay/runs**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes("/targets/")) return route.fulfill({ json: { snapshot: null, events: [] } });
    if (/\/employees\/\d+$/.test(path)) return route.fulfill({ json: { items: [], total_count: 0 } });
    return route.fulfill({ json: path.endsWith("/employees") ? { items: [1, 2, 3].map(id => ({
      id, run_id: 1, employee_id: id, employee_no: `DEMO-00${id}`, employee_name: ["김서윤", "이하은", "박지호"][id - 1],
      gross_pay: 4200000, taxable_income: 4000000, non_taxable_income: 200000, total_deductions: 518000, net_pay: 3682000, status: "calculated", warning_message: null,
    })), total_count: 3 } : { items: [1, 2, 3].map(id => ({
      id, year_month: `2026-${String(10 - id).padStart(2, "0")}`, payroll_code_id: 1, payroll_code_name: "정기급여", run_name: `${10 - id}월 정기급여`,
      status: id === 1 ? "calculated" : "paid", total_employees: 3, total_gross: 12600000, total_deductions: 1554000, total_net: 11046000,
      calculated_at: "2026-10-01T00:00:00Z", created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z",
    })), total_count: 3 } });
  });
  await page.route("**/api/pap/appraisals?**", route => route.fulfill({ json: { items: [{ id: 1, appraisal_name: "2026 하반기 역량평가", appraisal_year: 2026 }], total_count: 1 } }));
  await page.route("**/api/pap/targets?**", route => route.fulfill({ json: { items: ["김서윤", "이하은", "박지호", "최유진", "한지민"].map((name, index) => ({
    id: index + 1, appraisal_id: 1, appraisal_name: "2026 하반기 역량평가", employee_id: index + 1, employee_no: `DEMO-00${index + 1}`, employee_name: name,
    department_name: "제품개발", score: [92, 87, 90, null, null][index], grade_code: null, evaluator_note: null, status: "pending", evaluated_at: null, created_at: "2026-10-01", updated_at: "2026-10-01",
  })), total_count: 5 } }));
  const menus = ["사원관리", "인사기본", "근태 현황", "결재함", "급여 실행", "교육 신청"].map((name, index) => ({ id: index + 1, code: `demo.${index}`, name, path: `/demo/${index}`, children: [], is_active: true, sort_order: index }));
  await page.route("**/api/menus/admin/**", route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path.endsWith("/roles") ? { roles: ["관리자", "인사담당", "구성원"].map((name, index) => ({ id: index + 1, code: `ROLE_${index}`, name, description: name })) }
      : path.endsWith("/tree") ? { menus }
      : path.endsWith("/action-permissions") ? { mappings: [] }
      : { mappings: [{ role_id: 1, menu_ids: [1, 2, 3, 4, 5, 6] }, { role_id: 2, menu_ids: [1, 2, 3, 4, 6] }, { role_id: 3, menu_ids: [2, 4, 6] }] } });
  });
}

export async function installLandingMediaReads(page: Page, id: string, scenario: string) {
    if (scenario === "grid-rollout") await installGridRolloutFixture(page);
    if (["05", "07", "11", "16", "17"].includes(id)) await installCaptureReads(page);
    if (id === "01") await page.route("**/api/employees?**", async route => {
      const response = await route.fetch(); const payload = await response.json();
      const names = ["김서준", "이하은", "박지우", "정도윤", "최유진", "한지민", "서준호", "윤다은", "이도현", "박서아", "정하린", "김지안"];
      payload.employees = names.map((name, index) => ({ ...payload.employees[index % 3], id: index + 1, employee_no: `DEMO-${String(index + 1).padStart(3, "0")}`, display_name: name, login_id: `demo-${index + 1}`, email: `demo${index + 1}@example.test` }));
      payload.total_count = names.length;
      await route.fulfill({ json: payload });
    });
    if (id === "02") await page.route("**/api/hr/basic/1", async route => {
      const response = await route.fetch(); const payload = await response.json();
      Object.assign(payload.profile, { job_family: "경영지원", grade: "G3", gender: "여성", probation_end_date: "2021-04-02" });
      payload.appointments = [{ id: 901, title: "인사팀 팀장 보임", record_date: "2026-01-01" }, { id: 902, title: "인사팀 전입", record_date: "2024-01-01" }];
      await route.fulfill({ json: payload });
    });
    if (id === "10") await page.route("**/api/pay/my/payslips/1", async route => {
      await route.fulfill({ json: { summary: { run_id: 1, run_employee_id: 1, year_month: "2026-09", run_name: "9월 급여", run_status: "paid", gross_pay: 3000000, total_deductions: 300000, net_pay: 2700000, taxable_income: 3000000, non_taxable_income: 0, paid_at: "2026-09-25" }, items: [{ id: 1, item_code: "BASE", item_name: "기본급", direction: "earning", amount: 3000000, tax_type: "taxable" }, { id: 2, item_code: "TAX", item_name: "소득세", direction: "deduction", amount: 300000, tax_type: "tax" }] } });
    });
}
