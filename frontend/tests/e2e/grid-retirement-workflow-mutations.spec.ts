import { expect, test, type Page, type Route } from "@playwright/test";

type Json = Record<string, unknown>;
type Write = { method: string; path: string; body: Json | null };
type RouteAudit = { unhandledWrites: Write[] };

const NOW = "2026-07-22T00:00:00.000Z";
const EMPLOYEE = {
  id: 71, employee_no: "E-0071", login_id: "workflow-admin", display_name: "워크플로우 담당자",
  email: "workflow@example.com", department_id: 8, department_name: "인사팀", position_title: "매니저",
  hire_date: "2020-01-01", employment_status: "active", is_active: true,
};

async function reply(route: Route, json: Json): Promise<void> {
  await route.fulfill({ contentType: "application/json", body: JSON.stringify(json) });
}

function body(route: Route): Json | null {
  const data = route.request().postData();
  return data ? (JSON.parse(data) as Json) : null;
}

function list(items: Json[], url: URL): Json {
  return { items, total_count: items.length, page: Number(url.searchParams.get("page") ?? 1), limit: Number(url.searchParams.get("limit") ?? 50) };
}

function caseList(detail: Json): Json {
  return {
    id: detail.id, employee_id: detail.employee_id, employee_no: detail.employee_no,
    employee_name: detail.employee_name, department_name: detail.department_name,
    position_title: detail.position_title, retire_date: detail.retire_date, reason: detail.reason,
    status: detail.status, created_at: detail.created_at, confirmed_at: detail.confirmed_at ?? null,
    cancelled_at: detail.cancelled_at ?? null,
  };
}

async function expectGridRow(page: Page, text: string): Promise<void> {
  await expect(page.locator(".ag-row").filter({ hasText: text }).first()).toBeVisible();
}

async function installGlobalWriteGuard(page: Page): Promise<RouteAudit> {
  const audit: RouteAudit = { unhandledWrites: [] };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") return route.fallback();
    const url = new URL(request.url());
    audit.unhandledWrites.push({ method: request.method(), path: url.pathname, body: body(route) });
    throw new Error(`Unhandled API write blocked before shared backend: ${request.method()} ${url.pathname}`);
  });
  return audit;
}

async function installHrRoutes(page: Page): Promise<Write[]> {
  const writes: Write[] = [];
  const checklist: Json[] = [];
  const retireCase: Json = {
    id: 301, employee_id: EMPLOYEE.id, employee_no: EMPLOYEE.employee_no, employee_name: EMPLOYEE.display_name,
    department_name: EMPLOYEE.department_name, position_title: EMPLOYEE.position_title, retire_date: "2026-07-31",
    reason: "계약 종료", status: "draft", previous_employment_status: "active", requested_by: 1,
    confirmed_by: null, confirmed_at: null, cancelled_by: null, cancelled_at: null, cancel_reason: null,
    created_at: NOW, updated_at: NOW,
    checklist_items: [{ id: 401, checklist_item_id: 1, checklist_code: "asset_return", checklist_title: "자산 반납",
      checklist_description: "노트북 반납", is_required: true, is_checked: false, checked_by: null, checked_at: null, note: null }],
    audit_logs: [],
  };
  const calc: Json = {
    id: 501, retire_case_id: 301, employee_id: EMPLOYEE.id, employee_no: EMPLOYEE.employee_no,
    employee_name: EMPLOYEE.display_name, department_name: EMPLOYEE.department_name, hire_date: "2020-01-01",
    retire_date: "2026-07-31", service_days: 2403, avg_wage_base_from: "2026-04-30", avg_wage_base_to: "2026-07-30",
    wage_total_3m: 9000000, base_days_3m: 92, avg_daily_wage: 97826, severance_amount: 19374150,
    adjustment_amount: 0, adjustment_reason: null, final_amount: 19374150, status: "draft", warning: null,
    calculated_at: NOW, confirmed_by: null, confirmed_at: null, service_years: 6, income_tax: 0,
    local_income_tax: 0, net_severance: 19374150, created_at: NOW, updated_at: NOW,
  };
  const calcDetail = (): Json => ({ calc, wage_details: [], tax_detail: null });

  await page.route("**/api/employees**", async (route) => {
    if (route.request().method() !== "GET") throw new Error(`Unexpected employee request: ${route.request().method()}`);
    await reply(route, { employees: [EMPLOYEE], total_count: 1 });
  });
  await page.route("**/api/hr/**", async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname; const method = request.method();
    const payload = body(route); if (method !== "GET") writes.push({ method, path, body: payload });
    if (path === "/api/hr/retire/checklist") {
      if (method === "GET") return reply(route, list(checklist, url));
      if (method === "POST") {
        const item = { id: checklist.length + 1, ...payload, created_at: NOW, updated_at: NOW };
        checklist.unshift(item); return reply(route, item);
      }
    }
    if (path === "/api/hr/retire/cases" && method === "GET") return reply(route, list([caseList(retireCase)], url));
    if (path === "/api/hr/retire/cases/301" && method === "GET") return reply(route, retireCase);
    if (path === "/api/hr/retire/cases/301/items/401" && method === "PUT") {
      const item = retireCase.checklist_items as Json[]; item[0] = { ...item[0], is_checked: payload?.is_checked, note: payload?.note };
      return reply(route, retireCase);
    }
    if (path === "/api/hr/retire/cases/301/confirm" && method === "POST") {
      Object.assign(retireCase, { status: "confirmed", confirmed_by: 1, confirmed_at: NOW, updated_at: NOW }); return reply(route, retireCase);
    }
    if (path === "/api/hr/retire/cases/301/cancel" && method === "POST") {
      Object.assign(retireCase, { status: "cancelled", cancel_reason: payload?.cancel_reason, cancelled_by: 1, cancelled_at: NOW, updated_at: NOW }); return reply(route, retireCase);
    }
    if (path === "/api/hr/severance/calcs" && method === "GET") return reply(route, list([calc], url));
    if (path === "/api/hr/severance/calcs/501" && method === "GET") return reply(route, calcDetail());
    if (path === "/api/hr/severance/calcs/501" && method === "PUT") {
      Object.assign(calc, { adjustment_amount: payload?.adjustment_amount, adjustment_reason: payload?.adjustment_reason, final_amount: 19375150, updated_at: NOW }); return reply(route, calcDetail());
    }
    if (path === "/api/hr/severance/calcs/501/recalculate" && method === "POST") return reply(route, calcDetail());
    if (path === "/api/hr/severance/calcs/501/confirm" && method === "POST") {
      Object.assign(calc, { status: "confirmed", confirmed_by: 1, confirmed_at: NOW, updated_at: NOW }); return reply(route, calcDetail());
    }
    throw new Error(`Unexpected HR domain request escaped fixture: ${method} ${path}`);
  });
  return writes;
}

async function installPayRoutes(page: Page): Promise<Write[]> {
  const writes: Write[] = [];
  const run: Json = { id: 601, year_month: "2026-07", payroll_code_id: 1, payroll_code_name: "정기급여", run_name: "7월 급여",
    status: "closed", total_employees: 1, total_gross: 5000000, total_deductions: 500000, total_net: 4500000,
    calculated_at: NOW, closed_at: NOW, paid_at: null, created_at: NOW, updated_at: NOW };
  const vouchers: Json[] = [];
  const voucher = (): Json => ({ id: 701, voucher_no: "PV-202607-0001", run_id: 601, voucher_type: "accrual", year_month: "2026-07",
    voucher_date: "2026-07-22", status: vouchers[0]?.status ?? "draft", total_debit: 5000000, total_credit: 5000000,
    summary: "7월 급여", created_by: 1, confirmed_by: vouchers[0]?.confirmed_by ?? null, confirmed_at: vouchers[0]?.confirmed_at ?? null,
    created_at: NOW, updated_at: NOW });
  await page.route("**/api/pay/**", async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname; const method = request.method(); const payload = body(route);
    if (method !== "GET") writes.push({ method, path, body: payload });
    if (path === "/api/pay/runs" && method === "GET") return reply(route, { items: [run], total_count: 1 });
    if (path === "/api/pay/vouchers" && method === "GET") return reply(route, { ...list(vouchers, url) });
    if (path === "/api/pay/vouchers/701" && method === "GET") return reply(route, { voucher: vouchers[0], lines: [] });
    if (path === "/api/pay/vouchers/generate" && method === "POST") { vouchers.splice(0, 0, voucher()); return reply(route, { voucher: vouchers[0] }); }
    if (path === "/api/pay/vouchers/701/confirm" && method === "POST") { vouchers[0] = { ...vouchers[0], status: "confirmed", confirmed_by: 1, confirmed_at: NOW }; return reply(route, { voucher: vouchers[0] }); }
    if (path === "/api/pay/vouchers/701/cancel" && method === "POST") { vouchers[0] = { ...vouchers[0], status: "cancelled" }; return reply(route, { voucher: vouchers[0] }); }
    throw new Error(`Unexpected PAY domain request escaped fixture: ${method} ${path}`);
  });
  return writes;
}

async function installTimRoutes(page: Page): Promise<Write[]> {
  const writes: Write[] = [];
  const leave: Json = { id: 801, employee_id: EMPLOYEE.id, employee_no: EMPLOYEE.employee_no, employee_name: EMPLOYEE.display_name,
    department_name: EMPLOYEE.department_name, year: 2026, granted_days: 15, used_days: 3, carried_over_days: 0,
    remaining_days: 12, grant_type: "annual", note: null };
  const attendance: Json = { id: 901, employee_id: EMPLOYEE.id, employee_no: EMPLOYEE.employee_no, employee_name: EMPLOYEE.display_name,
    department_id: EMPLOYEE.department_id, department_name: EMPLOYEE.department_name, work_date: "2026-07-22", check_in_at: `${NOW}`,
    check_out_at: null, worked_minutes: null, attendance_status: "present", actual_minutes: 0, regular_minutes: 0,
    overtime_minutes: 0, night_minutes: 0, holiday_work_minutes: 0, holiday_overtime_minutes: 0, holiday_night_minutes: 0, is_holiday_work: false };
  await page.route("**/api/tim/**", async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname; const method = request.method(); const payload = body(route);
    if (method !== "GET") writes.push({ method, path, body: payload });
    if (path === "/api/tim/annual-leave/my" && method === "GET") return reply(route, { item: leave });
    if (path === "/api/tim/annual-leave/list" && method === "GET") return reply(route, list([leave], url));
    if (path === "/api/tim/annual-leave/adjust" && method === "POST") {
      Object.assign(leave, { remaining_days: Number(leave.remaining_days) + Number(payload?.adjustment_days), note: payload?.reason }); return reply(route, { item: leave });
    }
    if (path === "/api/tim/attendance-daily" && method === "GET") return reply(route, { ...list([attendance], url), total_pages: 1 });
    if (path === "/api/tim/attendance-daily/901" && method === "GET") return reply(route, attendance);
    if (path === "/api/tim/attendance-daily/901/corrections" && method === "GET") return reply(route, { corrections: [], total_count: 0 });
    throw new Error(`Unexpected TIM domain request escaped fixture: ${method} ${path}`);
  });
  return writes;
}

test.use({ viewport: { width: 1440, height: 1600 } });

test.describe("퇴직·급여·근태·복리후생 workflow mutation contracts", () => {
  let audit: RouteAudit;

  test.beforeEach(async ({ page }) => {
    audit = await installGlobalWriteGuard(page);
    page.on("dialog", (dialog) => void dialog.accept("테스트 취소 사유"));
  });

  test.afterEach(() => { expect(audit.unhandledWrites).toEqual([]); });

  test("퇴직 체크리스트 등록은 실제 입력값을 POST하고 목록을 갱신한다", async ({ page }) => {
    const writes = await installHrRoutes(page);
    await page.goto("/hr/retire/checklist");
    await page.getByPlaceholder("코드 예: asset_return").fill("badge_return");
    await page.getByRole("textbox", { name: "제목", exact: true }).fill("출입증 반납");
    await page.getByRole("textbox", { name: "설명", exact: true }).fill("보안팀 확인");
    await page.getByPlaceholder("정렬순서").fill("7");
    await page.getByRole("button", { name: "등록", exact: true }).click();
    await expectGridRow(page, "출입증 반납");
    expect(writes).toEqual([{ method: "POST", path: "/api/hr/retire/checklist", body: { code: "badge_return", title: "출입증 반납", description: "보안팀 확인", is_required: true, is_active: true, sort_order: 7 } }]);
  });

  test("퇴직 승인은 체크·확정·취소 요청과 상세 상태를 갱신한다", async ({ page }) => {
    const writes = await installHrRoutes(page);
    await page.goto("/hr/retire/approvals");
    await expectGridRow(page, EMPLOYEE.employee_no);
    await page.locator(".ag-row").filter({ hasText: EMPLOYEE.employee_no }).first().click();
    const assetReturn = page.getByRole("checkbox", { name: /자산 반납/ });
    await assetReturn.click();
    await expect(assetReturn).toBeChecked();
    await expect.poll(() => writes.some((item) => item.path.endsWith("/items/401"))).toBeTruthy();
    await page.getByRole("button", { name: "퇴직 확정", exact: true }).click();
    await expect(page.getByText("상태: 확정", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "퇴직 취소", exact: true }).click();
    await expect(page.getByText("상태: 취소", { exact: false })).toBeVisible();
    expect(writes).toEqual([
      { method: "PUT", path: "/api/hr/retire/cases/301/items/401", body: { is_checked: true, note: null } },
      { method: "POST", path: "/api/hr/retire/cases/301/confirm", body: null },
      { method: "POST", path: "/api/hr/retire/cases/301/cancel", body: { cancel_reason: "테스트 취소 사유" } },
    ]);
  });

  test("퇴직금은 조정·재산정·확정을 실제 요청으로 수행한다", async ({ page }) => {
    const writes = await installHrRoutes(page);
    await page.goto("/hr/severance/calcs");
    await expectGridRow(page, EMPLOYEE.employee_no);
    const detailCard = page.getByText("퇴직금 산정 상세", { exact: true }).locator("xpath=../..");
    await detailCard.locator('input[type="number"]').fill("1000");
    await page.getByPlaceholder("조정 사유를 입력해 주세요.").fill("정산 차이");
    await page.getByRole("button", { name: "조정액 저장", exact: true }).click();
    await expect(page.getByText("최종액 19,375,150", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "재산정", exact: true }).click();
    await page.getByRole("button", { name: "퇴직금 확정", exact: true }).click();
    await expect(page.getByText("상태 확정", { exact: false })).toBeVisible();
    expect(writes).toEqual([
      { method: "PUT", path: "/api/hr/severance/calcs/501", body: { adjustment_amount: 1000, adjustment_reason: "정산 차이" } },
      { method: "POST", path: "/api/hr/severance/calcs/501/recalculate", body: null },
      { method: "POST", path: "/api/hr/severance/calcs/501/confirm", body: null },
    ]);
  });

  test("급여 전표는 생성·확정·취소를 격리된 급여 route로 수행한다", async ({ page }) => {
    const writes = await installPayRoutes(page);
    await page.goto("/payroll/vouchers");
    await page.getByRole("combobox").selectOption("601");
    await page.getByRole("button", { name: "전표 생성", exact: true }).click();
    await expectGridRow(page, "PV-202607-0001");
    await page.getByRole("button", { name: "전표 확정", exact: true }).click();
    await expect(page.getByText("상태: 확정", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "전표 취소", exact: true }).click();
    await expect(page.getByText("상태: 취소", { exact: false })).toBeVisible();
    expect(writes).toEqual([
      { method: "POST", path: "/api/pay/vouchers/generate", body: { run_id: 601 } },
      { method: "POST", path: "/api/pay/vouchers/701/confirm", body: null },
      { method: "POST", path: "/api/pay/vouchers/701/cancel", body: null },
    ]);
  });

  test("연차 조정은 요청 payload와 새 잔여 일수를 반영한다", async ({ page }) => {
    const writes = await installTimRoutes(page);
    await page.goto("/tim/annual-leave");
    await expectGridRow(page, EMPLOYEE.employee_no);
    await page.getByPlaceholder("employee_id").fill(String(EMPLOYEE.id));
    await page.getByPlaceholder("조정 일수 (+/-)").fill("2");
    await page.getByPlaceholder("조정 사유").fill("관리자 조정");
    await page.getByRole("button", { name: "조정 반영", exact: true }).click();
    await expectGridRow(page, "14");
    expect(writes).toEqual([{ method: "POST", path: "/api/tim/annual-leave/adjust", body: { employee_id: 71, year: 2026, adjustment_days: 2, reason: "관리자 조정" } }]);
  });

  test("근태 현황 정정은 mutation 없이 해당 attendance 경로로 이동한다", async ({ page }) => {
    const writes = await installTimRoutes(page);
    await page.goto("/tim/status");
    await expectGridRow(page, EMPLOYEE.employee_no);
    await page.getByRole("button", { name: "정정", exact: true }).click();
    await expect(page).toHaveURL(/\/tim\/correction\?attendance_id=901$/);
    expect(writes).toEqual([]);
  });

  test("복리후생 유형은 검색·요약·행을 표시하고 mutation을 만들지 않는다", async ({ page }) => {
    const writes: Write[] = [];
    const items: Json[] = [
      { id: 1, code: "meal", name: "식대", module_path: "/wel/meal", is_deduction: false, pay_item_code: "MEAL", is_active: true, sort_order: 1, created_at: NOW, updated_at: NOW },
      { id: 2, code: "club", name: "동호회", module_path: "/wel/club", is_deduction: true, pay_item_code: null, is_active: false, sort_order: 2, created_at: NOW, updated_at: NOW },
    ];
    await page.route("**/api/wel/**", async (route) => {
      const request = route.request(); const url = new URL(request.url());
      if (request.method() !== "GET") { writes.push({ method: request.method(), path: url.pathname, body: body(route) }); throw new Error(`Unexpected WEL domain write: ${request.method()} ${url.pathname}`); }
      if (url.pathname !== "/api/wel/benefit-types") throw new Error(`Unexpected WEL domain GET: ${url.pathname}`);
      await reply(route, list(items, url));
    });
    await page.goto("/wel/benefit-types");
    const summaryCard = (title: string) => page.getByText(title, { exact: true }).locator("xpath=ancestor::div[contains(@class, 'border-border')][1]");
    await expect(summaryCard("유형 수").getByText("2", { exact: true })).toBeVisible();
    await expect(summaryCard("지급형 / 공제형").getByText("1 / 1", { exact: true })).toBeVisible();
    await expect(summaryCard("활성 유형").getByText("1", { exact: true })).toBeVisible();
    await page.getByPlaceholder("코드, 유형명, 모듈 경로, 급여 항목").fill("식대");
    await page.getByRole("button", { name: "조회", exact: true }).first().click();
    await expectGridRow(page, "식대");
    await expect(page.locator(".ag-row").filter({ hasText: "동호회" })).toHaveCount(0);
    expect(writes).toEqual([]);
  });
});
