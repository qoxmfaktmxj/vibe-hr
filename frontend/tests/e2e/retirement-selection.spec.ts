import { expect, test, type Page, type Route } from "@playwright/test";

import type { HrRetireCaseDetail } from "../../src/types/hr-retire";
import type { HrSeveranceCalcItem } from "../../src/types/hr-severance";

const NOW = "2026-10-15T00:00:00.000Z";
type Write = { method: string; path: string; body: Record<string, unknown> | null };

function retireCase(id: number): HrRetireCaseDetail {
  return {
    id, employee_id: id, employee_no: `TEST-${String(id).padStart(3, "0")}`,
    employee_name: `직원${id}`, department_name: "인사팀", position_title: "매니저",
    retire_date: "2026-10-31", status: "draft", created_at: NOW, updated_at: NOW,
    checklist_items: [{
      id: 1000 + id, checklist_item_id: 1, checklist_code: "asset_return",
      checklist_title: "자산 반납", is_required: true, is_checked: false, note: null,
    }],
    audit_logs: [],
  };
}

function severanceCalc(id: number): HrSeveranceCalcItem {
  return {
    id, retire_case_id: id, employee_id: id, employee_no: `TEST-${String(id).padStart(3, "0")}`,
    employee_name: `직원${id}`, department_name: "인사팀", hire_date: "2020-01-01",
    retire_date: "2026-10-31", service_days: 2495, wage_total_3m: 9000000,
    base_days_3m: 92, avg_daily_wage: 97826, severance_amount: 20000000,
    adjustment_amount: 0, adjustment_reason: null, final_amount: 20000000,
    status: "draft", service_years: 6, income_tax: 0, local_income_tax: 0,
    net_severance: 20000000, created_at: NOW, updated_at: NOW,
  };
}

async function reply(route: Route, data: unknown): Promise<void> {
  await route.fulfill({ contentType: "application/json", body: JSON.stringify(data) });
}

async function installRoutes(page: Page) {
  const cases = Array.from({ length: 60 }, (_, index) => retireCase(index + 1));
  const calcs = Array.from({ length: 60 }, (_, index) => severanceCalc(index + 1));
  const writes: Write[] = [];
  const unhandledWrites: Write[] = [];
  let releasePageTwo = () => {};
  const pageTwoGate = new Promise<void>((resolve) => { releasePageTwo = resolve; });
  let markPageTwoRequested = () => {};
  const pageTwoRequested = new Promise<void>((resolve) => { markPageTwoRequested = resolve; });
  let created = false;
  let releaseCreatedPage = () => {};
  const createdPageGate = new Promise<void>((resolve) => { releaseCreatedPage = resolve; });
  let markCreatedPageRequested = () => {};
  const createdPageRequested = new Promise<void>((resolve) => { markCreatedPageRequested = resolve; });

  await page.route("**/api/**", async (route) => {
    if (route.request().method() === "GET") return route.fallback();
    unhandledWrites.push({ method: route.request().method(), path: new URL(route.request().url()).pathname, body: null });
    throw new Error("Unexpected write outside isolated retirement fixture.");
  });
  await page.route("**/api/employees**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return reply(route, {
      employees: Array.from({ length: 61 }, (_, index) => ({
        id: index + 1, employee_no: `TEST-${String(index + 1).padStart(3, "0")}`,
        display_name: `직원${index + 1}`, department_name: "인사팀", employment_status: "active",
      })),
      total_count: 61,
    });
  });
  await page.route("**/api/hr/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const payload = request.postData() ? request.postDataJSON() as Record<string, unknown> : null;
    if (method !== "GET") writes.push({ method, path: url.pathname, body: payload });
    if (method === "GET" && ["/api/hr/retire/cases", "/api/hr/severance/calcs"].includes(url.pathname)) {
      const items = url.pathname.endsWith("/cases") ? cases : calcs;
      const pageNumber = Number(url.searchParams.get("page") ?? 1);
      const limit = Number(url.searchParams.get("limit") ?? 50);
      if (pageNumber === 2) {
        markPageTwoRequested();
        await pageTwoGate;
      }
      if (created && pageNumber === 1 && url.pathname.endsWith("/cases")) {
        markCreatedPageRequested();
        await createdPageGate;
      }
      return reply(route, { items: items.slice((pageNumber - 1) * limit, pageNumber * limit), total_count: items.length, page: pageNumber, limit });
    }
    if (url.pathname === "/api/hr/retire/cases" && method === "POST") {
      created = true;
      const createdCase = { ...retireCase(61), reason: String(payload?.reason ?? "") };
      cases.unshift(createdCase);
      return reply(route, createdCase);
    }
    const caseMatch = url.pathname.match(/^\/api\/hr\/retire\/cases\/(\d+)(?:\/items\/(\d+))?$/);
    if (caseMatch) {
      const selected = cases.find((item) => item.id === Number(caseMatch[1]));
      if (!selected) throw new Error(`Unknown case requested: ${url.pathname}`);
      if (method === "GET" && !caseMatch[2]) return reply(route, selected);
      if (method === "PUT" && Number(caseMatch[2]) === selected.checklist_items[0].id) {
        Object.assign(selected.checklist_items[0], { is_checked: payload?.is_checked, note: payload?.note });
        return reply(route, selected);
      }
    }
    const calcMatch = url.pathname.match(/^\/api\/hr\/severance\/calcs\/(\d+)(\/recalculate|\/confirm)?$/);
    if (calcMatch) {
      const selected = calcs.find((item) => item.id === Number(calcMatch[1]));
      if (!selected) throw new Error(`Unknown calculation requested: ${url.pathname}`);
      if (method === "PUT" && !calcMatch[2]) {
        Object.assign(selected, { status: "reviewed", adjustment_amount: payload?.adjustment_amount, adjustment_reason: payload?.adjustment_reason });
      } else if (method === "POST" && calcMatch[2] === "/confirm") {
        Object.assign(selected, { status: "confirmed", confirmed_at: NOW, confirmed_by: 1 });
      } else if (!(method === "GET" && !calcMatch[2]) && !(method === "POST" && calcMatch[2])) {
        throw new Error(`Unexpected calculation request: ${method} ${url.pathname}`);
      }
      return reply(route, { calc: selected, wage_details: [], tax_detail: null });
    }
    throw new Error(`Unexpected retirement request: ${method} ${url.pathname}`);
  });
  return { cases, calcs, writes, unhandledWrites, pageTwoRequested, releasePageTwo, createdPageRequested, releaseCreatedPage };
}

async function expectSelected(page: Page, id: number): Promise<void> {
  await expect(page.getByText(`직원${id} (TEST-${String(id).padStart(3, "0")})`, { exact: true })).toBeVisible();
  await expect(page.locator(".ag-row.vibe-row-selected").first()).toContainText(`TEST-${String(id).padStart(3, "0")}`);
}

test.use({ viewport: { width: 1440, height: 1600 } });

test.beforeEach(async ({ page, request }) => {
  const scenarioResponse = await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "retirement-selection" } });
  expect(scenarioResponse.ok()).toBeTruthy();
  await page.goto("/login");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.waitForURL(/\/dashboard$/);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("retirement page 2 keeps the selected employee through writes and selects a newly created case", async ({ page }) => {
  const fixture = await installRoutes(page);
  await page.goto("/hr/retire/approvals");
  await expectSelected(page, 1);
  await page.getByRole("button", { name: "다음", exact: true }).first().click();
  await fixture.pageTwoRequested;
  try {
    await expect(page.getByText("직원1 (TEST-001)", { exact: true })).toBeVisible();
  } finally {
    fixture.releasePageTwo();
  }
  await expectSelected(page, 51);
  await page.getByRole("grid").getByText("TEST-052", { exact: true }).click();
  await expectSelected(page, 52);
  await page.getByPlaceholder("비고", { exact: true }).fill("직원52 반납 확인");
  await page.getByRole("button", { name: "메모 저장", exact: true }).click();
  await expect(page.getByRole("button", { name: "메모 저장", exact: true })).toBeEnabled();
  await expectSelected(page, 52);
  expect(fixture.writes).toEqual([{ method: "PUT", path: "/api/hr/retire/cases/52/items/1052", body: { is_checked: false, note: "직원52 반납 확인" } }]);
  await page.getByRole("button", { name: "이전", exact: true }).first().click();
  await expectSelected(page, 1);
  await page.getByRole("button", { name: "다음", exact: true }).first().click();
  await expectSelected(page, 51);
  await page.getByLabel("퇴직 대상자", { exact: true }).selectOption("61");
  await page.getByPlaceholder("사유(선택)", { exact: true }).fill("신규 퇴직 요청");
  await page.getByRole("button", { name: "퇴직 건 생성", exact: true }).click();
  await fixture.createdPageRequested;
  try {
    await expect(page.getByRole("button", { name: "퇴직 건 생성", exact: true })).toBeDisabled();
  } finally {
    fixture.releaseCreatedPage();
  }
  await expect(page.getByRole("button", { name: "퇴직 건 생성", exact: true })).toBeEnabled();
  await expectSelected(page, 61);
  await expect(page.getByRole("button", { name: "이전", exact: true }).first()).toBeDisabled();
  expect(fixture.writes[1]).toMatchObject({ method: "POST", path: "/api/hr/retire/cases", body: { employee_id: 61, reason: "신규 퇴직 요청" } });
  await page.getByRole("grid").screenshot({ path: test.info().outputPath("retirement-selected-grid.png") });
  await page.screenshot({ path: test.info().outputPath("retirement-selected-created.png"), fullPage: true });
  fixture.cases.splice(0);
  await page.getByRole("button", { name: "조회", exact: true }).click();
  await expect(page.getByText("위 목록에서 퇴직 케이스를 선택해 주세요.", { exact: true })).toBeVisible();
  expect(fixture.unhandledWrites).toEqual([]);
});

test("severance page 2 keeps the selected employee through adjustment and recalculation", async ({ page }) => {
  const fixture = await installRoutes(page);
  await page.goto("/hr/severance/calcs");
  await expectSelected(page, 1);
  await page.getByRole("button", { name: "다음", exact: true }).first().click();
  await fixture.pageTwoRequested;
  try {
    await expect(page.getByText("직원1 (TEST-001)", { exact: true })).toBeVisible();
  } finally {
    fixture.releasePageTwo();
  }
  await expectSelected(page, 51);
  await page.getByRole("grid").getByText("TEST-052", { exact: true }).click();
  await expectSelected(page, 52);
  await page.locator('input[type="number"]').fill("1000");
  await page.getByPlaceholder("조정 사유를 입력해 주세요.").fill("직원52 정산 확인");
  await page.getByRole("button", { name: "조정액 저장", exact: true }).click();
  await expect(page.getByRole("button", { name: "조정액 저장", exact: true })).toBeEnabled();
  await expectSelected(page, 52);
  await page.getByRole("button", { name: "재산정", exact: true }).click();
  await expect(page.getByRole("button", { name: "재산정", exact: true })).toBeEnabled();
  await expectSelected(page, 52);
  expect(fixture.writes).toEqual([
    { method: "PUT", path: "/api/hr/severance/calcs/52", body: { adjustment_amount: 1000, adjustment_reason: "직원52 정산 확인" } },
    { method: "POST", path: "/api/hr/severance/calcs/52/recalculate", body: null },
  ]);
  await page.getByRole("button", { name: "퇴직금 확정", exact: true }).click();
  await expect(page.getByRole("button", { name: "퇴직금 확정", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "조정액 저장", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "재산정", exact: true })).toBeDisabled();
  await expectSelected(page, 52);
  expect(fixture.writes[2]).toEqual({ method: "POST", path: "/api/hr/severance/calcs/52/confirm", body: null });
  await page.getByRole("grid").first().screenshot({ path: test.info().outputPath("severance-selected-grid.png") });
  await page.screenshot({ path: test.info().outputPath("severance-selected-page-2.png"), fullPage: true });
  await page.getByRole("button", { name: "이전", exact: true }).first().click();
  await expectSelected(page, 1);
  fixture.calcs.splice(0);
  await page.getByRole("button", { name: "조회", exact: true }).first().click();
  await expect(page.getByText("위 목록에서 산정 건을 선택해 주세요.", { exact: true })).toBeVisible();
  expect(fixture.unhandledWrites).toEqual([]);
});
