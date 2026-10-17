import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { expect, test, type APIRequestContext } from "@playwright/test";

test("isolated payroll payment and retirement reach their final states", async ({ page, context, browser, baseURL }, testInfo) => {
  expect(process.env.VIBEHR_FINANCIAL_E2E, "Explicit disposable-environment opt-in is required").toBe("isolated-only");
  const origin = new URL(baseURL!);
  expect(origin.protocol).toBe("http:");
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(origin.hostname);
  const api = context.request;
  async function call(client: APIRequestContext, method: "get" | "post" | "put", route: string, data?: unknown) {
    const response = await client[method](route, data === undefined ? {} : { data });
    expect(response.ok(), `${method} ${route}: ${response.status()}`).toBeTruthy();
    return response.json();
  }
  expect((await call(api, "get", "/api/auth/me")).user.roles).toContain("admin");
  const initial = await call(api, "get", "/api/employees?all=true");
  expect(initial.employees.length).toBeGreaterThanOrEqual(2);
  expect(initial.employees.every((row: { employee_no: string }) => ["HR-0001", "HR-0002"].includes(row.employee_no) || row.employee_no.startsWith("FQ-")),
    "Only minimal development administrators and this test's synthetic employees are allowed").toBe(true);
  const suffix = randomUUID().slice(0, 8);
  const employeeNo = `FQ-${suffix}`;
  const password = `local-only-${randomUUID()}`;
  const loginId = `fin-${suffix}`;
  const { employee } = await call(api, "post", "/api/employees", {
    employee_no: employeeNo, display_name: `격리재무직원 ${suffix}`, department_id: initial.employees[0].department_id,
    position_title: "검증 직원", hire_date: "2023-01-01", employment_status: "active", login_id: loginId,
    email: `${loginId}@example.invalid`, password,
  });
  const codeResult = await call(api, "post", "/api/pay/setup/codes/batch", {
    items: [{ code: `FQ${suffix}`, name: `격리 급여 ${suffix}`, pay_type: "regular", payment_day: "25", tax_deductible: true, social_ins_deductible: true, is_active: true }], delete_ids: [],
  });
  const codeId = codeResult.items.find((row: { code: string }) => row.code === `FQ${suffix}`).id;
  await call(api, "post", "/api/pay/employee-profiles/batch", {
    items: [{ employee_id: employee.id, payroll_code_id: codeId, base_salary: 3_000_000, pay_type_code: "regular", payment_day_type: "fixed_day", payment_day_value: 25, holiday_adjustment: "previous_business_day", effective_from: "2023-01-01", is_active: true }], delete_ids: [],
  });
  async function runState(runId: number) {
    return (await call(api, "get", "/api/pay/runs")).items.find((row: { id: number }) => row.id === runId);
  }
  async function clickRunAction(runId: number, action: string, label: string) {
    const response = page.waitForResponse((result) => new URL(result.url()).pathname === `/api/pay/runs/${runId}/${action}` && result.request().method() === "POST");
    await page.getByRole("button", { name: label, exact: true }).click();
    expect((await response).ok()).toBeTruthy();
  }
  let octoberRunId = 0;
  const paymentEvidence: { month: string; runId: number; net: number; vouchers: number }[] = [];
  for (const month of ["2026-08", "2026-09", "2026-10"]) {
    await test.step(`real payroll finalization ${month}`, async () => {
      const runName = `LOCAL FIN ${suffix} ${month}`;
      const { run } = await call(api, "post", "/api/pay/runs", { year_month: month, payroll_code_id: codeId, run_name: runName });
      expect((await api.post(`/api/pay/runs/${run.id}/mark-paid`)).status()).toBe(409);
      if (month === "2026-10") {
        octoberRunId = run.id;
        await page.goto("/payroll/runs");
        const monthFields = page.getByPlaceholder("YYYY-MM", { exact: true });
        await monthFields.first().fill(month);
        await page.getByRole("button", { name: "조회", exact: true }).first().click();
        const row = page.getByRole("row").filter({ hasText: runName });
        await expect(row).toBeVisible();
        await row.click();
        await expect(page.getByRole("button", { name: "지급완료", exact: true })).toBeDisabled();
        await clickRunAction(run.id, "calculate", "계산");
        await expect.poll(async () => (await runState(run.id)).status).toBe("calculated");
        await expect(page.getByRole("button", { name: "마감", exact: true })).toBeEnabled();
        await clickRunAction(run.id, "close", "마감");
      } else {
        await call(api, "post", `/api/pay/runs/${run.id}/calculate`);
        await call(api, "post", `/api/pay/runs/${run.id}/close`);
      }
      const calculated = await runState(run.id);
      expect(calculated.total_employees).toBe(1);
      expect(calculated.total_gross).toBe(3_000_000);
      expect(calculated.total_gross - calculated.total_deductions).toBeCloseTo(calculated.total_net, 2);
      const result = await call(api, "get", `/api/pay/runs/${run.id}/employees`);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].employee_id).toBe(employee.id);
      const vouchers = (await call(api, "get", `/api/pay/vouchers?year_month=${month}`)).items;
      const accrual = vouchers.find((row: { run_id: number; voucher_type: string }) => row.run_id === run.id && row.voucher_type === "accrual");
      expect(accrual).toBeTruthy();
      expect(accrual.total_debit).toBe(accrual.total_credit);
      await call(api, "post", `/api/pay/vouchers/${accrual.id}/confirm`);
      if (month === "2026-10") {
        await expect(page.getByRole("button", { name: "지급완료", exact: true })).toBeEnabled();
        await clickRunAction(run.id, "mark-paid", "지급완료");
      } else await call(api, "post", `/api/pay/runs/${run.id}/mark-paid`);
      const paid = await runState(run.id);
      expect(paid.status).toBe("paid");
      expect(paid.paid_at).toBeTruthy();
      const { voucher } = await call(api, "post", "/api/pay/vouchers/generate-disbursement", { run_id: run.id });
      expect(voucher.total_debit).toBe(voucher.total_credit);
      await call(api, "post", `/api/pay/vouchers/${voucher.id}/confirm`);
      expect((await api.post(`/api/pay/runs/${run.id}/mark-paid`)).status()).toBe(409);
      expect((await api.post(`/api/pay/runs/${run.id}/recalculate`)).status()).toBe(409);
      expect((await api.post("/api/pay/vouchers/generate-disbursement", { data: { run_id: run.id } })).status()).toBe(409);
      const finalVouchers = (await call(api, "get", `/api/pay/vouchers?year_month=${month}`)).items.filter((row: { run_id: number }) => row.run_id === run.id);
      expect(finalVouchers).toHaveLength(2);
      expect(finalVouchers.every((row: { status: string }) => row.status === "confirmed")).toBe(true);
      paymentEvidence.push({ month, runId: run.id, net: paid.total_net, vouchers: finalVouchers.length });
    });
  }
  await expect(page.getByRole("button", { name: "지급완료", exact: true })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("local-payroll-paid.png"), fullPage: true });
  const ownerContext = await browser.newContext({ baseURL, extraHTTPHeaders: { "x-vibehr-client-ip": "127.0.0.1" } });
  try {
    await call(ownerContext.request, "post", "/api/auth/login", { enter_cd: "VIBE", login_id: loginId, password });
    const payslip = await call(ownerContext.request, "get", `/api/pay/my/payslips/${octoberRunId}`);
    expect(payslip.summary.run_status).toBe("paid");
    expect(payslip.summary.net_pay).toBe(paymentEvidence[2].net);
    const pdf = await ownerContext.request.get(`/api/pay/my/payslips/${octoberRunId}/pdf`);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    await writeFile(testInfo.outputPath("local-payslip.pdf"), await pdf.body());
  } finally { await ownerContext.close(); }
  const reason = `LOCAL FIN RETIRE ${suffix}`;
  const retirement = await call(api, "post", "/api/hr/retire/cases", { employee_id: employee.id, retire_date: "2026-10-31", reason });
  expect((await api.post(`/api/hr/retire/cases/${retirement.id}/confirm`)).status()).toBe(400);
  for (const item of retirement.checklist_items) await call(api, "put", `/api/hr/retire/cases/${retirement.id}/items/${item.id}`, { is_checked: true, note: "Synthetic verification complete" });
  await page.goto("/hr/retire/approvals");
  await page.getByRole("row").filter({ hasText: employeeNo }).click();
  const retirementResponse = page.waitForResponse((result) => new URL(result.url()).pathname === `/api/hr/retire/cases/${retirement.id}/confirm` && result.request().method() === "POST");
  await page.getByRole("button", { name: "퇴직 확정", exact: true }).click();
  expect((await retirementResponse).ok()).toBeTruthy();
  const confirmedCase = await call(api, "get", `/api/hr/retire/cases/${retirement.id}`);
  expect(confirmedCase.status).toBe("confirmed");
  expect(confirmedCase.audit_logs.some((row: { action_type: string }) => row.action_type === "confirm")).toBe(true);
  expect((await call(api, "get", `/api/employees?employee_no=${employeeNo}`)).employees[0].employment_status).toBe("resigned");
  await expect.poll(async () => (await call(api, "get", "/api/hr/severance/calcs?year=2026")).items.filter((row: { retire_case_id: number }) => row.retire_case_id === retirement.id).length).toBe(1);
  const calc = (await call(api, "get", "/api/hr/severance/calcs?year=2026")).items.find((row: { retire_case_id: number }) => row.retire_case_id === retirement.id);
  await call(api, "post", `/api/hr/severance/calcs/${calc.id}/recalculate`);
  const reviewed = await call(api, "put", `/api/hr/severance/calcs/${calc.id}`, { adjustment_amount: 0, adjustment_reason: "Synthetic wage reconciliation complete" });
  expect(reviewed.calc.status).toBe("reviewed");
  expect(reviewed.calc.wage_total_3m).toBe(9_000_000);
  expect(reviewed.calc.base_days_3m).toBe(92);
  expect(reviewed.calc.severance_amount).toBeCloseTo(9_000_000 / 92 * 30 * reviewed.calc.service_days / 365, 2);
  await page.goto("/hr/severance/calcs");
  await page.getByRole("row").filter({ hasText: employeeNo }).click();
  const confirmCalc = page.getByRole("button", { name: "퇴직금 확정", exact: true });
  await expect(confirmCalc).toBeEnabled();
  const calcResponse = page.waitForResponse((result) => new URL(result.url()).pathname === `/api/hr/severance/calcs/${calc.id}/confirm` && result.request().method() === "POST");
  await confirmCalc.click();
  expect((await calcResponse).ok()).toBeTruthy();
  const finalCalc = await call(api, "get", `/api/hr/severance/calcs/${calc.id}`);
  expect(finalCalc.calc.status).toBe("confirmed");
  expect(finalCalc.calc.final_amount - finalCalc.calc.income_tax - finalCalc.calc.local_income_tax).toBeCloseTo(finalCalc.calc.net_severance, 2);
  expect((await api.post(`/api/hr/retire/cases/${retirement.id}/confirm`)).status()).toBe(409);
  expect((await api.post(`/api/hr/severance/calcs/${calc.id}/confirm`)).status()).toBe(409);
  expect((await api.post(`/api/hr/severance/calcs/${calc.id}/recalculate`)).status()).toBe(409);
  expect((await api.put(`/api/hr/severance/calcs/${calc.id}`, { data: { adjustment_amount: 1, adjustment_reason: "Must reject after confirmation" } })).status()).toBe(409);
  await expect(confirmCalc).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("local-retirement-confirmed.png"), fullPage: true });
  await writeFile(testInfo.outputPath("synthetic-final-state.json"), JSON.stringify({ synthetic: true, employeeId: employee.id, employeeNo, paymentEvidence, retirementCaseId: retirement.id, retirementStatus: confirmedCase.status, severanceCalcId: calc.id, severanceStatus: finalCalc.calc.status }, null, 2));
});
