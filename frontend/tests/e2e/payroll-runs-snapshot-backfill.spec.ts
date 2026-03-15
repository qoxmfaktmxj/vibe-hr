import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";

const FRONTEND_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:8000";
const ADMIN_LOGIN = { enter_cd: "VIBE", login_id: "admin", password: "admin" };

async function authenticateBrowserSession(
  context: BrowserContext,
  request: APIRequestContext,
): Promise<void> {
  const loginRes = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: ADMIN_LOGIN,
  });
  expect(loginRes.ok()).toBeTruthy();

  const { access_token: accessToken } = (await loginRes.json()) as { access_token: string };
  await context.addCookies([
    {
      name: "vibe_hr_token",
      value: accessToken,
      url: FRONTEND_URL,
    },
    {
      name: "vibe_hr_enter_cd",
      value: ADMIN_LOGIN.enter_cd,
      url: FRONTEND_URL,
    },
  ]);
}

test("정기급여 Run 화면에서 스냅샷 갱신을 호출한다", async ({ context, page, request }) => {
  await authenticateBrowserSession(context, request);

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

    if (method === "POST" && pathname.endsWith("/api/pay/runs/2/snapshot-backfill")) {
      snapshotRefreshCount += 1;
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
  await page.getByRole("button", { name: "스냅샷 갱신" }).click();

  await expect.poll(() => snapshotRefreshCount).toBe(1);
  await expect(page.getByText("대상자 스냅샷을 갱신했습니다.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("경고: payroll events: 기본급 변경")).toBeVisible({ timeout: 20_000 });
});
