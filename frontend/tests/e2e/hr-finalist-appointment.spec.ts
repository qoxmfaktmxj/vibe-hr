import { expect, test } from "@playwright/test";

const FRONTEND_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:8000";
const ADMIN_LOGIN = { enter_cd: "VIBE", login_id: "admin", password: "admin" };

test("합격자 -> 사원 생성 -> 발령 확정 -> 인사기본 반영", async ({ page, request }) => {
  const suffix = Date.now().toString().slice(-8);
  const fullName = `PW테스트${suffix}`;
  const email = `pw.${suffix}@hr.minosek91.cloud`;
  const today = new Date();
  const joinDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const loginRes = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: ADMIN_LOGIN,
  });
  expect(loginRes.ok()).toBeTruthy();
  const { access_token: accessToken } = (await loginRes.json()) as { access_token: string };
  const headers = { Authorization: `Bearer ${accessToken}` };

  const finalistRes = await request.post(`${API_URL}/api/v1/hr/recruit/finalists`, {
    headers,
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
  await finalistRow.click();

  await page.getByRole("button", { name: "사원 생성" }).click();
  await expect(page.getByText("사원 생성 완료")).toBeVisible({ timeout: 20_000 });

  await finalistRow.click();
  await page.getByRole("button", { name: "발령 이동" }).click();
  await page.waitForURL("**/hr/appointment/records**", { timeout: 20_000 });

  const appointmentUrl = new URL(page.url());
  expect(appointmentUrl.searchParams.get("employeeNo")).toBeTruthy();

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
});
