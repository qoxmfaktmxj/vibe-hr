import { expect, test, type APIRequestContext } from "@playwright/test";
import type { EmployeeListResponse } from "../../src/types/employee";
import type { HrRecruitCreateEmployeesResponse } from "../../src/types/hr-recruit";

const FRONTEND_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const ADMIN_LOGIN = { enter_cd: "VIBE", login_id: "admin", password: "admin" };

async function loginAsAdmin(request: APIRequestContext): Promise<void> {
  const loginRes = await request.post(`${FRONTEND_URL}/api/auth/login`, {
    data: ADMIN_LOGIN,
    headers: { "x-vibehr-client-ip": "127.0.0.1" },
  });
  expect(loginRes.ok()).toBeTruthy();
}

async function cleanupHrE2eData(
  request: APIRequestContext,
  authenticated: boolean,
  finalistId: number | null,
  employeeId: number | null,
  employeeNo: string | null,
  fullName: string,
  email: string,
): Promise<void> {
  if (!authenticated) {
    return;
  }

  if (employeeId) {
    const employeeUrl = `${FRONTEND_URL}/api/employees/${employeeId}`;
    expect(employeeNo).not.toBeNull();
    const response = await request.get(`${FRONTEND_URL}/api/employees?all=true&employee_no=${encodeURIComponent(employeeNo!)}`);
    expect(response.ok()).toBeTruthy();
    const { employees } = await response.json() as EmployeeListResponse;
    const matches = employees.filter((employee) => employee.id === employeeId);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ id: employeeId, employee_no: employeeNo, display_name: fullName, email });
    const deleteEmployeeRes = await request.delete(employeeUrl);
    expect([204, 404]).toContain(deleteEmployeeRes.status());
  }

  if (finalistId) {
    const deleteFinalistRes = await request.delete(`${FRONTEND_URL}/api/hr/recruit/finalists`, {
      data: { ids: [finalistId] },
    });
    expect([200, 404]).toContain(deleteFinalistRes.status());
  }
}

test("합격자 -> 사원 생성 -> 발령 확정 -> 인사기본 반영", async ({ page, request }) => {
  const suffix = Date.now().toString().slice(-8);
  const fullName = `PW테스트${suffix}`;
  const email = `pw.${suffix}@hr.minosek91.cloud`;
  const today = new Date();
  const joinDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let authenticated = false;
  let finalistId: number | null = null;
  let employeeId: number | null = null;
  let employeeNo: string | null = null;

  try {
    await loginAsAdmin(request);
    authenticated = true;

    const finalistRes = await request.post(`${FRONTEND_URL}/api/hr/recruit/finalists`, {
      data: {
        source_type: "manual",
        full_name: fullName,
        birth_date: "1996-01-15",
        phone_mobile: `010-77${suffix.slice(-4)}`,
        email,
        hire_type: "new",
        expected_join_date: joinDate,
        status_code: "draft",
        note: `playwright e2e ${suffix}`,
        is_active: true,
      },
    });
    expect(finalistRes.ok()).toBeTruthy();

    const finalistBody = (await finalistRes.json()) as {
      item?: { id?: number };
    };
    finalistId = finalistBody.item?.id ?? null;
    expect(finalistId).not.toBeNull();

    await page.goto(`${FRONTEND_URL}/login`);
    await page.selectOption('select[name="enterCd"]', "VIBE");
    await page.fill('input[name="loginId"]', "admin");
    await page.fill('input[name="password"]', "admin");
    await page.getByRole("button", { name: "로그인" }).click();
    await page.waitForURL("**/dashboard", { timeout: 20_000 });

    await page.goto(`${FRONTEND_URL}/hr/recruit/finalists`);
    const finalistSearchInput = page.getByPlaceholder("이름 / 후보번호 / 사번 / 로그인ID");
    await finalistSearchInput.fill(fullName);
    await finalistSearchInput.press("Enter");

    const finalistRow = page.locator(".ag-row").filter({ hasText: fullName }).first();
    await expect(finalistRow).toBeVisible({ timeout: 20_000 });
    const finalistSelection = page.locator(`.ag-pinned-left-cols-container .ag-row[row-id="${finalistId}"] .ag-selection-checkbox input[type="checkbox"]`);
    await finalistSelection.check();

    const employeeCreation = page.waitForResponse((response) => response.url().endsWith("/api/hr/recruit/finalists/create-employees")
      && response.request().method() === "POST");
    await page.getByRole("button", { name: "사원 생성" }).click();
    const employeeCreationResponse = await employeeCreation;
    const creation = await employeeCreationResponse.json() as HrRecruitCreateEmployeesResponse;
    const created = creation.results?.find((result) => result.finalist_id === finalistId && result.outcome === "created");
    employeeId = created?.employee_id ?? null;
    employeeNo = created?.employee_no ?? null;
    expect(employeeCreationResponse.ok(), JSON.stringify(creation)).toBeTruthy();
    expect(creation).toMatchObject({ created_count: 1, error_count: 0 });
    expect(employeeId).not.toBeNull();
    expect(employeeNo).not.toBeNull();
    await expect(page.getByText("사원 생성 완료")).toBeVisible({ timeout: 20_000 });

    await finalistSelection.check();
    await page.getByRole("button", { name: "발령 이동" }).click();
    await page.waitForURL("**/hr/appointment/records**", { timeout: 20_000 });

    const appointmentUrl = new URL(page.url());
    expect(appointmentUrl.searchParams.get("employeeNo")).toBe(employeeNo);

    await page.getByRole("button", { name: "입력" }).click();
    const appointmentRow = page.locator(".ag-row").filter({ hasText: fullName }).first();
    await expect(appointmentRow).toBeVisible({ timeout: 20_000 });
    await appointmentRow.click();

    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("저장 완료")).toBeVisible({ timeout: 20_000 });

    const confirmButton = appointmentRow.getByRole("button", { name: "확정" });
    await expect(confirmButton).toBeEnabled({ timeout: 20_000 });
    await confirmButton.click();
    await expect(page.getByText("발령 확정 완료")).toBeVisible({ timeout: 20_000 });

    await appointmentRow.click();
    await page.getByRole("button", { name: "인사기본 이동" }).click();
    await page.waitForURL("**/hr/basic**", { timeout: 20_000 });
    await expect(page.locator("span").filter({ hasText: fullName }).first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "발령", exact: true }).click();
    await expect(page.getByText("발령 이력")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("cell", { name: "입사발령" })).toBeVisible({ timeout: 20_000 });
  } finally {
    await cleanupHrE2eData(request, authenticated, finalistId, employeeId, employeeNo, fullName, email);
  }
});
