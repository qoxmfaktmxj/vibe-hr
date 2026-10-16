import { expect, test, type BrowserContext } from "@playwright/test";
import type { PayRunTargetSnapshotItem } from "../../src/types/pay";

const FRONTEND_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const ADMIN_LOGIN = { enter_cd: "VIBE", login_id: "admin", password: "admin" };

async function authenticateBrowserSession(
  context: BrowserContext,
): Promise<void> {
  const loginRes = await context.request.post(`${FRONTEND_URL}/api/auth/login`, {
    data: ADMIN_LOGIN,
    headers: { "x-vibehr-client-ip": "127.0.0.1" },
  });
  expect(loginRes.ok()).toBeTruthy();
}

test("정기급여 Run 화면에서 스냅샷 갱신을 호출한다", async ({ context, page }) => {
  await authenticateBrowserSession(context);

  const now = "2026-03-15T12:00:00.000Z";
  const run = {
    id: 2,
    year_month: "2026-03",
    payroll_code_id: 1,
    payroll_code_name: "정규급여",
    run_name: "2026-03 정기급여",
    status: "calculated" as const,
    total_employees: 1,
    total_gross: 4_200_000,
    total_deductions: 518_000,
    total_net: 3_682_000,
    calculated_at: now,
    closed_at: null,
    paid_at: null,
    created_at: now,
    updated_at: now,
  };
  const employee = {
    id: 2001,
    run_id: 2,
    employee_id: 6018,
    employee_no: "EMP-900001",
    employee_name: "급여테스트",
    profile_id: 301,
    gross_pay: 4_200_000,
    taxable_income: 4_200_000,
    non_taxable_income: 0,
    total_deductions: 518_000,
    net_pay: 3_682_000,
    status: "review",
    warning_message: "payroll events: 기본급 변경",
    created_at: now,
    updated_at: now,
  };
  const detailItems = [
    {
      id: 3001,
      run_employee_id: 2001,
      item_code: "BSC",
      item_name: "기본급",
      direction: "earning",
      amount: 4_200_000,
      tax_type: "taxable",
      calculation_type: "snapshot",
      source_type: "snapshot",
      created_at: now,
    },
    {
      id: 3002,
      run_employee_id: 2001,
      item_code: "ITX",
      item_name: "소득세",
      direction: "deduction",
      amount: 230_000,
      tax_type: "tax",
      calculation_type: "formula",
      source_type: "system",
      created_at: now,
    },
  ];
  let snapshotRefreshCount = 0;
  let snapshotReadCount = 0;
  const snapshot: PayRunTargetSnapshotItem = {
    employee_id: employee.employee_id, employee_no: employee.employee_no, employee_name: employee.employee_name,
    department_id: 1, department_name: "검증 부서", position_title: "사원", hire_date: "2025-01-01",
    employment_status: "active", retire_date: null, profile_id: 301, payroll_code_id: 1, item_group_id: 1,
    base_salary: 4_200_000, pay_type_code: "monthly", payment_day_type: "fixed", payment_day_value: 25,
    holiday_adjustment: null, effective_from: "2026-03-01", effective_to: null,
    period_start: "2026-03-01", period_end: "2026-03-31", event_count: 0, review_required: false,
  };

  await page.route("**/api/pay/runs**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    const method = route.request().method();

    if (method === "GET" && pathname.endsWith("/api/pay/runs")) {
      await route.fulfill({
        status: 200,
        json: { items: [run], total_count: 1 },
      });
      return;
    }

    if (method === "GET" && pathname.endsWith("/api/pay/runs/2/employees")) {
      await route.fulfill({
        status: 200,
        json: { items: [employee], total_count: 1 },
      });
      return;
    }

    if (method === "GET" && pathname.endsWith("/api/pay/runs/2/employees/2001")) {
      await route.fulfill({
        status: 200,
        json: { employee, items: detailItems },
      });
      return;
    }

    if (method === "GET" && pathname.endsWith("/api/pay/runs/2/targets/6018")) {
      snapshotReadCount += 1;
      await route.fulfill({ status: 200, json: { snapshot, events: [] } });
      return;
    }

    if (method === "POST" && pathname.endsWith("/api/pay/runs/2/snapshot-backfill")) {
      snapshotRefreshCount += 1;
      snapshot.base_salary = 4_300_000;
      run.updated_at = "2026-03-15T12:05:00.000Z";
      await route.fulfill({
        status: 200,
        json: { run },
      });
      return;
    }

    await route.continue();
  });

  await page.goto(`${FRONTEND_URL}/payroll/runs`);

  const runRow = page.locator(".ag-row").filter({ hasText: "2026-03 정기급여" }).first();
  await expect(runRow).toBeVisible({ timeout: 20_000 });
  await runRow.click();

  await expect(page.getByRole("button", { name: "재계산" })).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "스냅샷 갱신" })).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "마감" })).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "지급완료" })).toBeDisabled();

  await expect(page.locator(".ag-row").filter({ hasText: "EMP-900001" }).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "스냅샷", exact: true }).click();
  const baseSalary = page.getByText("기본급", { exact: true }).locator("..");
  await expect(baseSalary).toContainText("4,200,000");
  await page.getByRole("button", { name: "스냅샷 갱신" }).click();

  await expect.poll(() => snapshotRefreshCount).toBe(1);
  await expect(page.getByText("대상자 스냅샷을 갱신했습니다.")).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => snapshotReadCount).toBeGreaterThanOrEqual(2);
  await expect(baseSalary).toContainText("4,300,000");
  await page.getByRole("button", { name: "계산결과", exact: true }).click();
  await expect(page.getByText("경고: payroll events: 기본급 변경")).toBeVisible({ timeout: 20_000 });
});
