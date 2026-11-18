import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import type { EmployeeBatchPayload, EmployeeBatchResponse, EmployeeDetailResponse, EmployeeListResponse } from "../../src/types/employee";

test("실제 사원 그리드에서 검색하고 편집한 이름이 저장 후 새로고침해도 유지된다", async ({ page, context }, testInfo) => {
  test.setTimeout(90_000);
  expect(process.env.VIBEHR_FINANCIAL_E2E).toBe("isolated-only");
  const container = process.env.VIBEHR_TIME_PAYROLL_CONTAINER ?? "";
  expect(container).toMatch(/^vibehr-financial-20261017-[a-f0-9]{6}$/);
  const metadata = JSON.parse(execFileSync("docker", ["inspect", container], { encoding: "utf8" }))[0];
  expect(metadata.Config.Labels["codex.task"]).toBe("financial-finalization-20261017");
  const binding = metadata.NetworkSettings.Ports["8080/tcp"][0];
  expect(binding.HostIp).toBe("127.0.0.1");
  expect(process.env.PLAYWRIGHT_API_URL).toBe(`http://127.0.0.1:${binding.HostPort}`);

  const api = context.request;
  const me = await api.get("/api/auth/me");
  expect(me.ok()).toBe(true);
  expect((await me.json()).user.roles).toContain("admin");
  const seeded = await api.get("/api/employees", { params: { employee_no: "HR-0001", all: true } });
  expect(seeded.ok()).toBe(true);
  const { employees } = await seeded.json() as EmployeeListResponse;
  expect(employees).toHaveLength(1);
  expect(employees[0]).toMatchObject({ employee_no: "HR-0001", login_id: "admin-local" });

  const suffix = randomUUID().slice(0, 8);
  const employeeNo = `FQ-${suffix}`;
  const before = `그리드 검증 ${suffix}`;
  const after = `그리드 수정 ${suffix}`;
  const created = await api.post("/api/employees", { data: {
    employee_no: employeeNo, login_id: `grid-${suffix}`, display_name: before,
    email: `grid-${suffix}@example.invalid`, password: `local-only-${randomUUID()}`,
    department_id: employees[0].department_id, position_title: "사원", hire_date: "2025-01-02", employment_status: "active",
  } });
  expect(created.status()).toBe(201);
  const { employee } = await created.json() as EmployeeDetailResponse;
  expect(employee).toMatchObject({ employee_no: employeeNo, display_name: before });
  expect(Number.isSafeInteger(employee.id)).toBe(true);

  function storedName(): string {
    return execFileSync("docker", ["exec", "-i", container, "psql", "-XqAt", "-v", "ON_ERROR_STOP=1",
      "-U", "vibehr", "-d", "vibehr_financial_20261017", "-v", `id=${employee.id}`, "-v", `number=${employeeNo}`], {
      input: "SELECT u.display_name FROM hr_employees e JOIN auth_users u ON u.id=e.user_id WHERE e.id=:'id'::integer AND e.employee_no=:'number';",
      encoding: "utf8",
    }).trim();
  }
  expect(storedName()).toBe(before);

  const nameCell = page.locator(`.ag-center-cols-container .ag-row[row-id="${employee.id}"] [col-id="display_name"]`);
  async function findEmployee(name: string) {
    await page.getByPlaceholder("사번", { exact: true }).fill(employeeNo);
    await page.getByRole("button", { name: "조회", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: `사번 ${employeeNo}` })).toBeVisible();
    await expect(nameCell).toHaveText(name);
  }

  await page.goto("/hr/employee");
  await findEmployee(before);
  await nameCell.dblclick();
  await nameCell.locator("input").fill(after);
  await page.keyboard.press("Enter");
  await expect(nameCell).toHaveText(after);
  const save = page.getByRole("button", { name: "변경 1건 저장", exact: true });
  await expect(save).toBeEnabled();
  expect(storedName()).toBe(before);
  const saved = page.waitForResponse(response => new URL(response.url()).pathname === "/api/employees/batch" && response.request().method() === "POST");
  await save.click();
  const response = await saved;
  const payload = response.request().postDataJSON() as EmployeeBatchPayload;
  expect(payload.insert).toEqual([]);
  expect(payload.delete).toEqual([]);
  expect(payload.update).toHaveLength(1);
  expect(payload.update[0]).toMatchObject({ id: employee.id, display_name: after });
  expect(response.ok()).toBe(true);
  expect(await response.json() as EmployeeBatchResponse).toMatchObject({ inserted_count: 0, updated_count: 1, deleted_count: 0 });
  await expect(page.getByRole("status").filter({ hasText: "저장 완료: 입력 0건, 수정 1건, 삭제 0건" })).toBeVisible();

  await page.reload();
  await findEmployee(after);
  const reread = await api.get("/api/employees", { params: { employee_no: employeeNo, all: true } });
  expect(reread.ok()).toBe(true);
  const result = await reread.json() as EmployeeListResponse;
  expect(result.total_count).toBe(1);
  expect(result.employees[0]).toMatchObject({ id: employee.id, employee_no: employeeNo, display_name: after });
  expect(storedName()).toBe(after);
  await page.getByRole("grid").screenshot({ path: testInfo.outputPath("employee-grid-persisted.png") });
});
