import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { expect, test, type APIRequestContext } from "@playwright/test";

test("isolated leave approval and time close reconcile through paid payroll", async ({ page, context, browser, baseURL }, testInfo) => {
  expect(process.env.VIBEHR_FINANCIAL_E2E).toBe("isolated-only");
  expect(new URL(baseURL!).protocol).toBe("http:");
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(new URL(baseURL!).hostname);
  const container = process.env.VIBEHR_TIME_PAYROLL_CONTAINER ?? "";
  expect(container).toMatch(/^vibehr-financial-20261017-[a-f0-9]{6}$/);
  const database = "vibehr_financial_20261017";
  const inspected = JSON.parse(execFileSync("docker", ["inspect", container], { encoding: "utf8" }))[0];
  expect(inspected.Config.Labels["codex.task"]).toBe("financial-finalization-20261017");
  expect(inspected.NetworkSettings.Ports["5432/tcp"][0].HostIp).toBe("127.0.0.1");
  function sql(statement: string) {
    return execFileSync("docker", ["exec", "-i", container, "psql", "-X", "-U", "vibehr", "-d", database, "-v", "ON_ERROR_STOP=1", "-At"], { input: statement, encoding: "utf8" }).trim();
  }
  async function call(client: APIRequestContext, method: "get" | "post", route: string, data?: unknown) {
    const response = await client[method](route, data === undefined ? {} : { data });
    expect(response.ok(), `${method} ${route}: ${response.status()}`).toBeTruthy();
    return response.json();
  }
  const api = context.request;
  expect((await call(api, "get", "/api/auth/me")).user.roles).toContain("admin");
  const initial = await call(api, "get", "/api/employees?all=true");
  expect(initial.employees.every((row: { employee_no: string }) => ["HR-0001", "HR-0002"].includes(row.employee_no) || row.employee_no.startsWith("FQ-"))).toBe(true);
  const suffix = randomUUID().slice(0, 8);
  const employeeNo = `FQ-${suffix}`;
  const loginId = `time-${suffix}`;
  const password = `local-only-${randomUUID()}`;
  const { employee } = await call(api, "post", "/api/employees", {
    employee_no: employeeNo, display_name: `격리근태직원 ${suffix}`, department_id: initial.employees[0].department_id,
    position_title: "검증 직원", hire_date: "2023-01-01", employment_status: "active", login_id: loginId,
    email: `${loginId}@example.invalid`, password,
  });
  // Prove the backend-created synthetic employee belongs to this disposable database before fixture SQL.
  expect(Number.isSafeInteger(employee.id)).toBe(true);
  expect(sql(`select employee_no from hr_employees where id=${employee.id}`)).toBe(employeeNo);
  const code = `TQ${suffix}`;
  const codeResult = await call(api, "post", "/api/pay/setup/codes/batch", {
    items: [{ code, name: `격리 근태급여 ${suffix}`, pay_type: "regular", payment_day: "25", tax_deductible: true, social_ins_deductible: true, is_active: true }], delete_ids: [],
  });
  const codeId = codeResult.items.find((row: { code: string }) => row.code === code).id;
  await call(api, "post", "/api/pay/employee-profiles/batch", {
    items: [{ employee_id: employee.id, payroll_code_id: codeId, base_salary: 2_090_000, pay_type_code: "regular", payment_day_type: "fixed_day", payment_day_value: 25, holiday_adjustment: "previous_business_day", effective_from: "2023-01-01", is_active: true }], delete_ids: [],
  });
  const october = (await call(api, "get", "/api/tim/month-close?year=2026")).items.find((row: { month: number }) => row.month === 10);
  if (october.close_status === "closed") await call(api, "post", "/api/tim/month-close/2026/10/reopen");
  const owner = await browser.newContext({ baseURL, extraHTTPHeaders: { "x-vibehr-client-ip": "127.0.0.1" } });
  try {
    await call(owner.request, "post", "/api/auth/login", { enter_cd: "VIBE", login_id: loginId, password });
    const requests: Record<string, number> = {};
    for (const [key, type, day] of [["annual", "annual", "06"], ["half", "half_day", "07"], ["unpaid", "unpaid", "08"], ["cancelled", "unpaid", "09"], ["pending", "unpaid", "13"], ["rejected", "unpaid", "14"]]) {
      const leave = await call(owner.request, "post", "/api/tim/leave-requests", { leave_type: type, start_date: `2026-10-${day}`, end_date: `2026-10-${day}`, reason: `LOCAL TIME ${suffix} ${key}` });
      requests[key] = leave.id;
    }
    const runName = `LOCAL TIME ${suffix}`;
    const { run } = await call(api, "post", "/api/pay/runs", { year_month: "2026-10", payroll_code_id: codeId, run_name: runName });
    expect((await call(api, "post", `/api/pay/runs/${run.id}/calculate`)).run.total_gross).toBe(2_090_000);
    await page.goto("/tim/leave-approval");
    for (const key of ["annual", "half"]) {
      const response = page.waitForResponse((result) => new URL(result.url()).pathname === `/api/tim/leave-requests/${requests[key]}/approve` && result.request().method() === "POST");
      await page.getByRole("row").filter({ hasText: `LOCAL TIME ${suffix} ${key}` }).getByRole("button", { name: "승인", exact: true }).click();
      expect((await response).ok()).toBeTruthy();
    }
    for (const key of ["unpaid", "cancelled"]) await call(api, "post", `/api/tim/leave-requests/${requests[key]}/approve`, {});
    await call(owner.request, "post", `/api/tim/leave-requests/${requests.cancelled}/cancel`, {});
    await call(api, "post", `/api/tim/leave-requests/${requests.rejected}/reject`, { reason: "Synthetic rejected request" });
    const annual = await call(owner.request, "get", "/api/tim/annual-leave/my?year=2026");
    expect(annual.item.used_days).toBe(1.5);
    expect(annual.item.remaining_days).toBe(13.5);
    await call(api, "post", `/api/pay/runs/${run.id}/snapshot-backfill`);
    const leaveEvents = JSON.parse(sql(`select coalesce(json_agg(json_build_object('code',event_code,'source_id',source_id,'decision',decision_code)), '[]') from pay_payroll_run_target_events where run_id=${run.id} and source_type='tim_leave'`));
    expect(leaveEvents).toEqual([{ code: "unpaid_leave_approved", source_id: requests.unpaid, decision: "review" }]);
    // Historical punches are fixture inputs only; correction, calculation and closing use the real API.
    sql(`insert into tim_employee_daily_schedules(employee_id,work_date,schedule_source,is_holiday,is_workday,break_minutes,expected_minutes,is_overnight,generated_at,version_tag)
      values (${employee.id},'2026-10-05','company_default',false,true,60,480,true,now(),'isolated-time-payroll'),
             (${employee.id},'2026-10-11','company_default',true,false,60,480,false,now(),'isolated-time-payroll'),
             (${employee.id},'2026-10-12','company_default',true,false,60,480,true,now(),'isolated-time-payroll');
      insert into tim_attendance_daily(employee_id,work_date,attendance_status,actual_minutes,regular_minutes,overtime_minutes,night_minutes,holiday_work_minutes,holiday_overtime_minutes,holiday_night_minutes,is_holiday_work,created_at,updated_at)
      select ${employee.id},day::date,'present',0,0,0,0,0,0,0,false,now(),now() from (values ('2026-10-05'),('2026-10-06'),('2026-10-11'),('2026-10-12')) dates(day);`);
    const attendanceIds = JSON.parse(sql(`select json_object_agg(work_date,id) from tim_attendance_daily where employee_id=${employee.id}`));
    async function correct(day: string, checkIn: string | null, checkOut: string | null, status = "present") {
      return call(api, "post", `/api/tim/attendance-daily/${attendanceIds[day]}/correct`, { new_status: status, new_check_in_at: checkIn, new_check_out_at: checkOut, reason: "Synthetic punch verification" });
    }
    await correct("2026-10-05", "2026-10-05T12:00:00Z", "2026-10-05T22:00:00Z");
    await correct("2026-10-06", null, null, "leave");
    await correct("2026-10-11", "2026-10-11T00:00:00Z", "2026-10-11T11:00:00Z");
    await correct("2026-10-12", "2026-10-12T12:00:00Z", "2026-10-12T22:00:00Z");
    const otherTotals = JSON.parse(sql(`select json_build_object('overtime',coalesce(sum(overtime_minutes),0),'night',coalesce(sum(night_minutes),0),'holiday',coalesce(sum(holiday_work_minutes),0),'holiday_overtime',coalesce(sum(holiday_overtime_minutes),0),'holiday_night',coalesce(sum(holiday_night_minutes),0),'leave',count(*) filter(where attendance_status='leave')) from tim_attendance_daily where work_date between '2026-10-01' and '2026-10-31' and employee_id<>${employee.id}`));
    await page.goto("/tim/month-closing");
    const closeResponse = page.waitForResponse((result) => new URL(result.url()).pathname === "/api/tim/month-close" && result.request().method() === "POST");
    await page.getByRole("row").filter({ hasText: "2026년 10월" }).getByRole("button", { name: "마감", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "마감", exact: true }).click();
    expect((await closeResponse).ok()).toBeTruthy();
    const closed = (await call(api, "get", "/api/tim/month-close?year=2026")).items.find((row: { month: number }) => row.month === 10);
    expect(closed.total_overtime_minutes - otherTotals.overtime).toBe(60);
    expect(closed.total_night_minutes - otherTotals.night).toBe(480);
    expect(closed.total_holiday_work_minutes - otherTotals.holiday).toBe(960);
    expect(closed.total_holiday_overtime_minutes - otherTotals.holiday_overtime).toBe(180);
    expect(closed.total_holiday_night_minutes - otherTotals.holiday_night).toBe(480);
    expect(closed.leave_days - otherTotals.leave).toBe(1);
    async function payInputs() {
      return (await call(api, "get", "/api/pay/variable-inputs?year_month=2026-10")).items.filter((row: { employee_id: number }) => row.employee_id === employee.id);
    }
    const firstInputs = await payInputs();
    expect(Object.fromEntries(firstInputs.map((row: { item_code: string; amount: number }) => [row.item_code, row.amount]))).toEqual({ OTX: 15_000, NGT: 40_000, HDW: 240_000, HDO: 60_000, HDN: 160_000 });
    expect((await owner.request.post(`/api/tim/leave-requests/${requests.annual}/cancel`, { data: {} })).status()).toBe(423);
    expect((await api.post(`/api/tim/leave-requests/${requests.pending}/approve`, { data: {} })).status()).toBe(423);
    expect((await api.post(`/api/tim/attendance-daily/${attendanceIds["2026-10-05"]}/correct`, { data: { new_status: "present", reason: "Locked period" } })).status()).toBe(423);
    await page.screenshot({ path: testInfo.outputPath("local-time-month-closed.png"), fullPage: true });
    for (const [end, expectedOtx, expectedNgt] of [["23", 30_000, 40_000], ["20", 0, 35_000], ["22", 15_000, 40_000]] as const) {
      await call(api, "post", "/api/tim/month-close/2026/10/reopen");
      await correct("2026-10-05", "2026-10-05T12:00:00Z", `2026-10-05T${end}:00:00Z`);
      await call(api, "post", "/api/tim/month-close", { year: 2026, month: 10, note: "Synthetic reclose" });
      const inputs = await payInputs();
      expect(inputs).toHaveLength(5);
      expect(inputs.find((row: { item_code: string }) => row.item_code === "OTX").amount).toBe(expectedOtx);
      expect(inputs.find((row: { item_code: string }) => row.item_code === "NGT").amount).toBe(expectedNgt);
      expect(inputs.map((row: { id: number }) => row.id).sort()).toEqual(firstInputs.map((row: { id: number }) => row.id).sort());
    }
    const calculated = (await call(api, "post", `/api/pay/runs/${run.id}/recalculate`)).run;
    expect(calculated.total_gross).toBe(2_605_000);
    expect(calculated.total_gross - calculated.total_deductions).toBeCloseTo(calculated.total_net, 2);
    const employees = (await call(api, "get", `/api/pay/runs/${run.id}/employees`)).items;
    expect(employees).toHaveLength(1);
    expect(employees[0].employee_id).toBe(employee.id);
    expect(employees[0].warning_message).toContain("무급휴가 승인");
    const detail = await call(api, "get", `/api/pay/runs/${run.id}/employees/${employees[0].id}`);
    expect(detail.items.find((row: { item_code: string }) => row.item_code === "BSC").amount).toBe(2_090_000);
    expect(detail.items.filter((row: { source_type: string }) => row.source_type === "variable")).toHaveLength(5);
    // V1 requires an explicit reviewed deduction; 10,000 is a synthetic input, not a new leave formula.
    const deductionCode = `TD${suffix}`;
    await call(api, "post", "/api/pay/setup/allowance-deductions/batch", {
      items: [{ code: deductionCode, name: "격리 무급휴가 검토 공제", type: "deduction", tax_type: "tax", calculation_type: "fixed", is_active: true }], delete_ids: [],
    });
    const deductionMapping = (await call(api, "get", "/api/pay/gl-mappings")).items.find((row: { pay_item_code: string }) => row.pay_item_code === "EMP");
    expect(deductionMapping).toBeTruthy();
    await call(api, "post", "/api/pay/gl-mappings/batch", {
      items: [{ pay_item_code: deductionCode, gl_account_code: deductionMapping.gl_account_code, effective_from: "2026-01-01", is_active: true }], delete_ids: [],
    });
    await call(api, "post", "/api/pay/variable-inputs/batch", {
      items: [{ year_month: "2026-10", employee_id: employee.id, item_code: deductionCode, direction: "deduction", amount: 10_000, memo: "Synthetic reviewed unpaid leave" }], delete_ids: [],
    });
    const reviewed = (await call(api, "post", `/api/pay/runs/${run.id}/recalculate`)).run;
    expect(reviewed.total_gross).toBe(calculated.total_gross);
    expect(reviewed.total_deductions - calculated.total_deductions).toBe(10_000);
    expect(calculated.total_net - reviewed.total_net).toBe(10_000);
    await page.goto("/payroll/runs");
    await page.getByRole("row").filter({ hasText: runName }).click();
    const closeRun = page.waitForResponse((result) => new URL(result.url()).pathname === `/api/pay/runs/${run.id}/close` && result.request().method() === "POST");
    await page.getByRole("button", { name: "마감", exact: true }).click();
    expect((await closeRun).ok()).toBeTruthy();
    const accrual = (await call(api, "get", "/api/pay/vouchers?year_month=2026-10")).items.find((row: { run_id: number; voucher_type: string }) => row.run_id === run.id && row.voucher_type === "accrual");
    expect(accrual.total_debit).toBe(accrual.total_credit);
    await call(api, "post", `/api/pay/vouchers/${accrual.id}/confirm`);
    const paidResponse = page.waitForResponse((result) => new URL(result.url()).pathname === `/api/pay/runs/${run.id}/mark-paid` && result.request().method() === "POST");
    await page.getByRole("button", { name: "지급완료", exact: true }).click();
    expect((await paidResponse).ok()).toBeTruthy();
    const { voucher } = await call(api, "post", "/api/pay/vouchers/generate-disbursement", { run_id: run.id });
    expect(voucher.total_debit).toBe(voucher.total_credit);
    await call(api, "post", `/api/pay/vouchers/${voucher.id}/confirm`);
    const payslip = await call(owner.request, "get", `/api/pay/my/payslips/${run.id}`);
    expect(payslip.summary.run_status).toBe("paid");
    expect(payslip.summary.gross_pay).toBe(2_605_000);
    expect(payslip.summary.net_pay).toBe(reviewed.total_net);
    expect(payslip.items.find((row: { item_code: string }) => row.item_code === deductionCode).amount).toBe(10_000);
    expect(payslip.items.filter((row: { source_type: string; direction: string }) => row.source_type === "variable" && row.direction === "earning").map((row: { item_code: string; amount: number }) => [row.item_code, row.amount])).toEqual(detail.items.filter((row: { source_type: string }) => row.source_type === "variable").map((row: { item_code: string; amount: number }) => [row.item_code, row.amount]));
    const pdf = await owner.request.get(`/api/pay/my/payslips/${run.id}/pdf`);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    for (const action of ["recalculate", "snapshot-backfill", "mark-paid"]) expect((await api.post(`/api/pay/runs/${run.id}/${action}`)).status()).toBe(409);
    await expect(page.getByRole("button", { name: "지급완료", exact: true })).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath("local-time-payroll-paid.png"), fullPage: true });
    await writeFile(testInfo.outputPath("synthetic-time-payroll.json"), JSON.stringify({ synthetic: true, employeeId: employee.id, employeeNo, runId: run.id, leaveRequests: requests, annual: annual.item, inputs: firstInputs, gross: reviewed.total_gross, deductions: reviewed.total_deductions, net: reviewed.total_net, explicitDeduction: 10_000, status: payslip.summary.run_status, vouchers: [accrual.id, voucher.id], unpaidPolicy: "review event plus explicit deduction; no automatic deduction formula in V1" }, null, 2));
  } finally { await owner.close(); }
});

test("isolated month-close dialogs contain valid description markup", async ({ page, context }, testInfo) => {
  expect(process.env.VIBEHR_FINANCIAL_E2E).toBe("isolated-only");
  const response = await context.request.get("/api/tim/month-close?year=2026");
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  // Only this read response is synthetic; opening and cancelling dialogs performs no business write.
  data.items = data.items.map((row: { month: number; close_status: string }) => ({ ...row, close_status: row.month === 10 ? "closed" : "open" }));
  await page.route("**/api/tim/month-close?year=2026", (route) => route.fulfill({ json: data }));
  const markupErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /cannot (?:be|contain)|hydration/i.test(message.text())) markupErrors.push(message.text());
  });
  await page.goto("/tim/month-closing");
  const row = page.getByRole("row").filter({ hasText: "2026년 10월" });
  await row.getByRole("button", { name: "재오픈", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("p p, p div")).toHaveCount(0);
  expect(markupErrors).toEqual([]);
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await page.getByRole("row").filter({ hasText: "2026년 9월" }).getByRole("button", { name: "마감", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByPlaceholder("마감 사유 또는 메모")).toBeVisible();
  await expect(dialog.locator("p p, p div")).toHaveCount(0);
  expect(markupErrors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("local-time-close-dialog.png"), fullPage: true });
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
});
