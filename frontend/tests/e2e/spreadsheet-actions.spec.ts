import { readFile } from "node:fs/promises";
import { expect, test, type Page, type Route } from "@playwright/test";
import { read, utils, write } from "xlsx";

import {
  EMPLOYEE_PROFILE_COLUMNS, PAYMENT_SCHEDULE_COLUMNS, PAYROLL_RUN_COLUMNS, VARIABLE_INPUT_COLUMNS,
} from "../../src/lib/spreadsheet/payroll-operation-schemas";
import {
  ALLOWANCE_DEDUCTION_COLUMNS, GL_ACCOUNT_COLUMNS, GL_MAPPING_COLUMNS, ITEM_GROUP_COLUMNS,
  SEVERANCE_ITEM_RULE_COLUMNS,
} from "../../src/lib/spreadsheet/payroll-master-schemas";
import {
  ATTENDANCE_CODE_COLUMNS, HOLIDAY_COLUMNS, PAYROLL_CODE_COLUMNS, TAX_RATE_COLUMNS, WORK_SCHEDULE_COLUMNS,
} from "../../src/lib/spreadsheet/time-payroll-code-schemas";
import type { SpreadsheetColumn } from "../../src/lib/spreadsheet/workbook";

type RecordData = Record<string, unknown>;
type Batch = { items: RecordData[]; delete_ids: number[] };
type Screen = {
  name: string;
  path: string;
  api: string;
  columns: readonly SpreadsheetColumn[];
  filename: string;
  existing: RecordData[];
  upload: RecordData[];
  save: RecordData[];
  invalidKey: string;
  added: number;
  updated?: number;
  exportHeaders?: string[];
  exportRows?: (rows: RecordData[]) => unknown[][];
  currentPage?: boolean;
};

const NOW = "2026-10-16T00:00:00Z";
const YEAR = new Date().getFullYear();
const MONTH = `${YEAR}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
const metadata = { created_at: NOW, updated_at: NOW };
const schedule = {
  payment_day_type: "fixed_day", payment_day_value: 25,
  holiday_adjustment: "previous_business_day", effective_from: `${YEAR}-01-01`,
  effective_to: null, is_active: true,
};
const profile = {
  ...schedule, employee_id: 6018, employee_no: "EMP-900001", employee_name: "급여테스트",
  payroll_code_id: 1, payroll_code_name: "정규급여", item_group_id: null,
  item_group_name: null, base_salary: 4200000, pay_type_code: "regular",
};
const profiles = [
  { ...profile, ...metadata, id: 1 },
  { ...profile, ...metadata, id: 2, employee_id: 6020, employee_no: "EMP-900003", employee_name: "유지할 직원" },
];
const profileValues = { ...schedule, employee_id: 6019, payroll_code_id: 1, item_group_id: null, base_salary: 1000000, pay_type_code: "regular" };
const profileUpdate = { ...profileValues, id: 1, employee_id: 6018, base_salary: 4300000 };
const variable = { year_month: MONTH, employee_id: 6018, item_code: "BONUS", direction: "earning", amount: 100000, memo: null };
const variableNew = { ...variable, employee_id: 6019, amount: 200000, memo: "추가 상여" };
const variableUpdate = { ...variable, id: 1, amount: 150000, memo: "수정 상여" };
const glAccount = { code: "NEW_GL", name: "급여비용", account_type: "expense", is_net_pay_account: false, is_cash_account: true, is_active: true, sort_order: 10 };
const glMapping = { pay_item_code: "NEW_PAY", gl_account_code: "GL100", effective_from: `${YEAR}-10-01`, note: "신규 매핑", is_active: true };
const itemGroup = { code: "NEW_GROUP", name: "월급제", description: "신규 그룹", is_active: true };
const allowance = { code: "NEW_ITEM", name: "기본급", type: "allowance", tax_type: "taxable", calculation_type: "fixed", is_active: true, sort_order: 1 };
const severance = { pay_item_code: "NEW_RULE", include_type: "prorate_12", note: "상여금", is_active: true };
const payrollCode = { code: "PXLSX", name: "엑셀 급여", pay_type: "급여", payment_day: "25", tax_deductible: true, social_ins_deductible: false, is_active: true };
const tax = { year: YEAR, rate_type: "엑셀요율", employee_rate: 4.5, employer_rate: 4.5, min_limit: 390000, max_limit: 6170000 };
const holiday = { holiday_date: `${YEAR}-12-24`, name: "엑셀 휴일", holiday_type: "company", is_active: true };
const attendance = { code: "AXLSX", name: "엑셀 근태", category: "leave", unit: "day", is_requestable: true, min_days: 0.5, max_days: 3, deduct_annual: false, is_active: true, sort_order: 1, description: "검증" };
const work = { code: "WXLSX", name: "엑셀 근무", work_start: "09:00", work_end: "18:00", break_minutes: 60, is_overnight: false, work_hours: 8, is_active: true, sort_order: 1, description: "검증" };

function originals(row: RecordData, key: string, values: unknown[] = ["BASE_1", "BASE_2"]) {
  return values.map((value, index) => ({ ...row, ...metadata, id: index + 1, [key]: value }));
}

function cells(columns: readonly SpreadsheetColumn[], rows: RecordData[]): unknown[][] {
  return rows.map((row) => columns.map((column) => {
    const value = row[column.key];
    return typeof value === "boolean" ? value ? "Y" : "N" : value ?? "";
  }));
}

const screens: Screen[] = [
  {
    name: "employee profiles", path: "/payroll/employee-profiles", api: "/api/pay/employee-profiles",
    columns: EMPLOYEE_PROFILE_COLUMNS, filename: "employee-profiles", existing: profiles,
    upload: [profileValues, profileUpdate], save: [profileValues, profileUpdate],
    invalidKey: "employee_id", added: 1, updated: 1, currentPage: true,
  },
  {
    name: "payment schedules", path: "/payroll/payment-schedules", api: "/api/pay/employee-profiles",
    columns: PAYMENT_SCHEDULE_COLUMNS, filename: "payment-schedules", existing: profiles,
    upload: [{ ...schedule, id: 1, employee_id: 6018, payment_day_value: 20 }],
    save: [{ ...profileUpdate, base_salary: 4200000, payment_day_value: 20 }],
    invalidKey: "payment_day_type", added: 0, updated: 1, currentPage: true,
  },
  {
    name: "variable inputs", path: "/payroll/variable-inputs", api: "/api/pay/variable-inputs",
    columns: VARIABLE_INPUT_COLUMNS, filename: "variable-inputs",
    existing: [
      { ...variable, ...metadata, id: 1, employee_no: "EMP-900001", employee_name: "급여테스트", item_name: "상여" },
      { ...variable, ...metadata, id: 2, employee_id: 6020, employee_no: "EMP-900003", employee_name: "유지할 직원", item_name: "상여" },
    ],
    upload: [variableNew, variableUpdate], save: [variableNew, variableUpdate],
    invalidKey: "employee_id", added: 1, updated: 1, currentPage: true,
  },
  {
    name: "GL accounts", path: "/payroll/gl-accounts", api: "/api/pay/gl-accounts",
    columns: GL_ACCOUNT_COLUMNS, filename: "pay-gl-accounts", existing: originals(glAccount, "code"),
    upload: [glAccount], save: [{ id: null, ...glAccount }], invalidKey: "code", added: 1,
    exportHeaders: ["계정코드", "계정명", "계정유형", "실지급계정", "사용여부", "순서"],
    exportRows: (rows) => rows.map((row) => [row.code, row.name, "비용", "N", "Y", row.sort_order]),
  },
  {
    name: "GL mappings", path: "/payroll/gl-mappings", api: "/api/pay/gl-mappings",
    columns: GL_MAPPING_COLUMNS, filename: "pay-gl-mappings", existing: originals(glMapping, "pay_item_code"),
    upload: [glMapping], save: [{ id: null, ...glMapping }], invalidKey: "pay_item_code", added: 1,
    exportRows: (rows) => rows.map((row) => [row.pay_item_code, "GL100 (급여비용)", row.effective_from, row.note, "Y"]),
  },
  {
    name: "item groups", path: "/payroll/item-groups", api: "/api/pay/setup/item-groups",
    columns: ITEM_GROUP_COLUMNS, filename: "payroll-item-groups", existing: originals({ ...itemGroup, details: [] }, "code"),
    upload: [itemGroup], save: [itemGroup], invalidKey: "code", added: 1,
  },
  {
    name: "allowance and deduction items", path: "/payroll/allowance-deduction-items", api: "/api/pay/setup/allowance-deductions",
    columns: ALLOWANCE_DEDUCTION_COLUMNS, filename: "allowance-deduction-items", existing: originals(allowance, "code"),
    upload: [allowance], save: [allowance], invalidKey: "code", added: 1,
    exportHeaders: ["코드", "이름", "항목유형", "과세유형", "계산방식", "사용여부", "정렬순서"],
    exportRows: (rows) => rows.map((row) => [row.code, row.name, "지급(수당)", "과세", "고정액", "Y", row.sort_order]),
  },
  {
    name: "severance item rules", path: "/payroll/severance-item-rules", api: "/api/pay/severance-item-rules",
    columns: SEVERANCE_ITEM_RULE_COLUMNS, filename: "pay-severance-item-rules", existing: originals(severance, "pay_item_code"),
    upload: [severance], save: [{ id: null, ...severance }], invalidKey: "pay_item_code", added: 1,
    exportRows: (rows) => rows.map((row) => [row.pay_item_code, "12분의1산입", row.note, "Y"]),
  },
  {
    name: "payroll codes", path: "/payroll/codes", api: "/api/pay/setup/codes",
    columns: PAYROLL_CODE_COLUMNS, filename: "payroll-codes", existing: originals(payrollCode, "code"),
    upload: [payrollCode], save: [payrollCode], invalidKey: "code", added: 1,
  },
  {
    name: "tax rates", path: "/payroll/tax-rates", api: "/api/pay/setup/tax-rates",
    columns: TAX_RATE_COLUMNS, filename: "tax-rates", existing: originals(tax, "rate_type"),
    upload: [tax], save: [tax], invalidKey: "rate_type", added: 1,
  },
  {
    name: "holidays", path: "/tim/holidays", api: "/api/tim/holidays",
    columns: HOLIDAY_COLUMNS, filename: "holidays", existing: originals(holiday, "holiday_date", [`${YEAR}-01-01`, `${YEAR}-03-01`]),
    upload: [holiday], save: [{ id: null, ...holiday }], invalidKey: "name", added: 1,
    exportRows: (rows) => rows.map((row) => [row.holiday_date, row.name, "회사지정", "Y"]),
  },
  {
    name: "attendance codes", path: "/tim/codes", api: "/api/tim/attendance-codes",
    columns: ATTENDANCE_CODE_COLUMNS, filename: "attendance-codes", existing: originals(attendance, "code"),
    upload: [attendance], save: [{ id: null, ...attendance }], invalidKey: "code", added: 1,
    exportHeaders: ["근태코드", "근태명", "분류", "단위", "신청가능", "최소일수", "최대일수", "연차차감", "사용여부", "설명"],
    exportRows: (rows) => rows.map((row) => [row.code, row.name, "휴가", "전일", "Y", row.min_days, row.max_days, "N", "Y", row.description]),
  },
  {
    name: "work schedules", path: "/tim/work-codes", api: "/api/tim/work-schedules",
    columns: WORK_SCHEDULE_COLUMNS, filename: "work-schedules", existing: originals(work, "code"),
    upload: [work], save: [{ id: null, ...work }], invalidKey: "code", added: 1,
    exportHeaders: ["근무코드", "근무명", "출근시간", "퇴근시간", "휴게시간(분)", "야간여부", "소정시간", "사용여부", "설명"],
    exportRows: (rows) => rows.map((row) => [row.code, row.name, row.work_start, row.work_end, row.break_minutes, "N", row.work_hours, "Y", row.description]),
  },
];

async function reply(route: Route, data: unknown) {
  await route.fulfill({ contentType: "application/json", body: JSON.stringify(data) });
}

// Only screen API calls are stubbed. Login, session, menu permissions, React,
// the file chooser, workbook parsing, grid state and downloads use the real app.
async function installRoutes(page: Page, screen: Pick<Screen, "api" | "existing">) {
  const writes: Batch[] = [];
  const rows = structuredClone(screen.existing);
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === screen.api && method === "GET") {
      return reply(route, { items: rows, total_count: rows.length, year: YEAR });
    }
    if (url.pathname === `${screen.api}/batch` && method === "POST") {
      const body = route.request().postDataJSON() as Batch;
      writes.push(body);
      for (const item of body.items) {
        const index = rows.findIndex((row) => row.id === item.id);
        if (index >= 0) rows[index] = { ...rows[index], ...item };
        else rows.push({ ...metadata, ...item, id: 100 + rows.length });
      }
      return reply(route, {
        items: rows, total_count: rows.length, year: YEAR,
        inserted_count: body.items.filter((row) => !row.id).length,
        updated_count: body.items.filter((row) => row.id).length, deleted_count: 0,
      });
    }
    if (url.pathname === "/api/pay/gl-accounts" && method === "GET") {
      return reply(route, { items: [{ ...glAccount, ...metadata, id: 100, code: "GL100" }], total_count: 1 });
    }
    if (method === "GET") return route.fallback();
    throw new Error(`Unexpected write outside spreadsheet fixture: ${method} ${url.pathname}`);
  });
  return writes;
}

async function download(page: Page, label: string, filename: RegExp) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: label, exact: true }).click();
  const file = await pending;
  expect(file.suggestedFilename()).toMatch(filename);
  expect(await file.failure()).toBeNull();
  const localPath = await file.path();
  expect(localPath).not.toBeNull();
  const bytes = await readFile(localPath!);
  expect(bytes.subarray(0, 2).toString()).toBe("PK");
  const book = read(bytes, { type: "buffer" });
  expect(book.SheetNames).toHaveLength(1);
  return utils.sheet_to_json<unknown[]>(book.Sheets[book.SheetNames[0]], { header: 1, raw: true, defval: "" });
}

async function upload(page: Page, columns: readonly SpreadsheetColumn[], rows: RecordData[]) {
  const book = utils.book_new();
  utils.book_append_sheet(book, utils.aoa_to_sheet([columns.map((column) => column.label), ...cells(columns, rows)]), "업로드");
  const pending = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "업로드", exact: true }).click();
  const chooser = await pending;
  await chooser.setFiles({
    name: "검증자료.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: write(book, { type: "buffer", bookType: "xlsx" }),
  });
}

async function holdWorkbookRead(page: Page) {
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer;
    const harness = window as typeof window & { releaseSpreadsheetRead?: () => void };
    File.prototype.arrayBuffer = function (this: File) {
      document.documentElement.dataset.spreadsheetRead = "waiting";
      return new Promise<ArrayBuffer>((resolve, reject) => {
        harness.releaseSpreadsheetRead = () => {
          File.prototype.arrayBuffer = original;
          original.call(this).then(resolve, reject);
        };
      });
    };
  });
}

async function releaseWorkbookRead(page: Page) {
  await page.evaluate(() => {
    const harness = window as typeof window & { releaseSpreadsheetRead?: () => void };
    if (!harness.releaseSpreadsheetRead) throw new Error("The workbook read did not reach the test gate.");
    harness.releaseSpreadsheetRead();
    delete harness.releaseSpreadsheetRead;
  });
}

function statusCells(page: Page) {
  return page.locator('.ag-row [col-id="_status"]');
}

async function capture(page: Page, filename: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: test.info().outputPath(filename), fullPage: true });
}

test.beforeEach(async ({ page, request }) => {
  const response = await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "file-actions" } });
  expect(response.ok()).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

async function verifyImport(page: Page, screen: Screen, mobile = false) {
  const writes = await installRoutes(page, screen);
  await page.goto(screen.path);
  await expect(statusCells(page)).toHaveText(["", ""]);
  expect(writes).toEqual([]);

  await test.step("downloads contain real XLSX headers and current data", async () => {
    const template = await download(page, "양식 다운로드", new RegExp(`^${screen.filename}-template\\.xlsx$`));
    expect(template).toEqual([screen.columns.map((column) => column.label)]);
    const label = screen.currentPage ? "현재 페이지 다운로드" : "다운로드";
    const table = await download(page, label, new RegExp(`^${screen.filename}-.+\\.xlsx$`));
    expect(table).toEqual([
      screen.exportHeaders ?? screen.columns.map((column) => column.label),
      ...(screen.exportRows?.(screen.existing) ?? cells(screen.columns, screen.existing)),
    ]);
    expect(writes).toEqual([]);
  });

  await test.step("a later invalid row rejects the entire file", async () => {
    await upload(page, screen.columns, [screen.upload[0], { ...screen.upload[0], [screen.invalidKey]: "" }]);
    await expect(page.getByText(/3행.*필수 값입니다/)).toBeVisible();
    await expect(statusCells(page)).toHaveText(["", ""]);
    expect(writes).toEqual([]);
    if (screen.name === "holidays") await capture(page, `invalid-file-${mobile ? "mobile" : "desktop"}.png`);
  });

  await test.step("valid upload only marks local rows until explicit Save", async () => {
    await upload(page, screen.columns, screen.upload);
    await expect(page.getByText(/건을.*저장 버튼을 눌러/)).toBeVisible();
    await expect(statusCells(page)).toHaveCount(2 + screen.added);
    await expect(statusCells(page).filter({ hasText: /^입력$/ })).toHaveCount(screen.added);
    await expect(statusCells(page).filter({ hasText: /^수정$/ })).toHaveCount(screen.updated ?? 0);
    await expect(page.locator('.ag-row[row-id="2"] [col-id="_status"]')).toHaveText("");
    expect(writes).toEqual([]);
    await expect(page.getByRole("button", { name: "저장", exact: true })).toBeEnabled();
    if (screen.name === "holidays") await capture(page, `imported-file-${mobile ? "mobile" : "desktop"}.png`);
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes).toEqual([{ items: screen.save, delete_ids: [] }]);
    await expect(statusCells(page)).toHaveText(Array(2 + screen.added).fill(""));
    expect(writes).toHaveLength(1);
  });
}

for (const screen of screens) {
  test(`${screen.name}: workbook actions preserve atomic import and explicit typed Save`, async ({ page }) => {
    await verifyImport(page, screen);
  });
}

test("holiday workbook actions remain usable at 390px with Korean validation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await verifyImport(page, screens.find((screen) => screen.name === "holidays")!, true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("payment schedules reject unmatched IDs without creating a profile", async ({ page }) => {
  const screen = screens.find((item) => item.name === "payment schedules")!;
  const writes = await installRoutes(page, screen);
  await page.goto(screen.path);
  await expect(statusCells(page)).toHaveCount(2);
  await upload(page, screen.columns, [screen.upload[0], { ...schedule, id: 999, employee_id: 999 }]);
  await expect(page.getByText(/3행.*기존 급여프로필을 하나로 식별할 수 없습니다/)).toBeVisible();
  await expect(statusCells(page)).toHaveText(["", ""]);
  expect(writes).toEqual([]);
});

test("variable input queries cannot replace rows while a chosen workbook is being read", async ({ page }) => {
  const screen = screens.find((item) => item.name === "variable inputs")!;
  const writes = await installRoutes(page, screen);
  const reads: string[] = [];
  await page.route("**/api/pay/variable-inputs**", async (route) => {
    if (route.request().method() === "GET") reads.push(route.request().url());
    await route.fallback();
  });
  await page.goto(screen.path);
  await expect(statusCells(page)).toHaveText(["", ""]);
  expect(reads).toHaveLength(1);

  // Change the search field without applying it. An Enter event during the
  // delayed file read must not apply this other month over the import's rows.
  const month = page.getByPlaceholder("예: 2026-03", { exact: true });
  const otherMonth = `${YEAR}-${MONTH.endsWith("-12") ? "11" : "12"}`;
  await month.fill(otherMonth);
  await holdWorkbookRead(page);
  await upload(page, screen.columns, [variableNew]);
  await expect(page.locator("html")).toHaveAttribute("data-spreadsheet-read", "waiting");
  await expect(page.getByRole("button", { name: "조회", exact: true })).toBeDisabled();
  await expect(month).toBeDisabled();
  await expect(page.getByRole("button", { name: "저장", exact: true })).toBeDisabled();

  // Dispatching directly exercises the handler guard as well as the disabled
  // control. Native user input cannot fire Enter on the disabled field.
  await month.dispatchEvent("keydown", { key: "Enter", code: "Enter", bubbles: true });
  await page.waitForLoadState("networkidle");
  expect(reads).toHaveLength(1);
  expect(new URL(reads[0]).searchParams.get("year_month")).toBe(MONTH);
  await expect(statusCells(page)).toHaveText(["", ""]);
  expect(writes).toEqual([]);

  await releaseWorkbookRead(page);
  await expect(statusCells(page)).toHaveCount(3);
  await expect(page.locator('.ag-row[row-id="-1"] [col-id="_status"]')).toHaveText("입력");
  await expect(page.locator('.ag-row[row-id="1"] [col-id="_status"]')).toHaveText("");
  await expect(page.locator('.ag-row[row-id="2"] [col-id="_status"]')).toHaveText("");
  await expect(page.locator('.ag-row[row-id="-1"] [col-id="year_month"]')).toHaveText(MONTH);
  await expect(page.locator('.ag-row[row-id="-1"] [col-id="employee_id"]')).toHaveText("6019");
  await expect(page.locator('.ag-row[row-id="-1"] [col-id="amount"]')).toHaveText("200000");
  await expect(month).toBeEnabled();
  expect(reads).toHaveLength(1);
  expect(writes).toEqual([]);

  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes).toEqual([{ items: [variableNew], delete_ids: [] }]);
  await expect(statusCells(page)).toHaveText(["", "", ""]);
  expect(reads).toHaveLength(1);
});

test("holiday year copy and workbook upload cannot replace each other's pending rows", async ({ page }) => {
  const screen = screens.find((item) => item.name === "holidays")!;
  const targetYear = YEAR + 1;
  const copied = screen.existing.map((row) => ({
    ...row, holiday_date: String(row.holiday_date).replace(String(YEAR), String(targetYear)),
  }));
  const imported = { ...holiday, holiday_date: `${targetYear}-12-24` };
  const reads: number[] = [];
  const copies: RecordData[] = [];
  const writes: Batch[] = [];
  let releaseCopy: () => void = () => { throw new Error("Copy gate is not initialized."); };
  let releaseReload: () => void = () => { throw new Error("Reload gate is not initialized."); };
  const copyGate = new Promise<void>((resolve) => { releaseCopy = resolve; });
  const reloadGate = new Promise<void>((resolve) => { releaseReload = resolve; });
  await page.route("**/api/tim/holidays**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === screen.api && method === "GET") {
      const year = Number(url.searchParams.get("year"));
      reads.push(year);
      if (year === targetYear) await reloadGate;
      const items = year === targetYear ? copied : screen.existing;
      return reply(route, { items, total_count: items.length, year });
    }
    if (url.pathname === `${screen.api}/copy-year` && method === "POST") {
      copies.push(route.request().postDataJSON() as RecordData);
      await copyGate;
      return reply(route, { copied_count: 2, year_to: targetYear });
    }
    if (url.pathname === `${screen.api}/batch` && method === "POST") {
      const body = route.request().postDataJSON() as Batch;
      writes.push(body);
      expect(url.searchParams.get("year")).toBe(String(targetYear));
      const items = [...copied, ...body.items.map((item) => ({ ...metadata, ...item, id: 103 }))];
      return reply(route, { items, total_count: items.length, year: targetYear, inserted_count: 1, updated_count: 0, deleted_count: 0 });
    }
    throw new Error(`Unexpected holiday request: ${method} ${url.pathname}`);
  });
  await page.goto(screen.path);
  await expect(statusCells(page)).toHaveText(["", ""]);
  const yearInput = page.getByText("조회 연도", { exact: true }).locator("..").getByRole("spinbutton");
  await yearInput.fill(String(YEAR - 1));
  await page.getByText("복사 원본 연도", { exact: true }).locator("..").getByRole("spinbutton").fill(String(YEAR));
  await page.getByText("대상 연도", { exact: true }).locator("..").getByRole("spinbutton").fill(String(targetYear));
  await page.getByRole("button", { name: "연도 복사", exact: true }).click();
  await expect.poll(() => copies.length).toBe(1);
  expect(copies).toEqual([{ year_from: YEAR, year_to: targetYear }]);
  await expect(page.getByRole("button", { name: "업로드", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "조회", exact: true })).toBeDisabled();
  await yearInput.dispatchEvent("keydown", { key: "Enter", code: "Enter", bubbles: true });
  await expect(statusCells(page)).toHaveText(["", ""]);
  expect(reads).toEqual([YEAR]);
  expect(writes).toEqual([]);

  releaseCopy();
  await expect.poll(() => reads).toEqual([YEAR, targetYear]);
  await expect(page.getByText(`${targetYear}년 공휴일 데이터를 불러오는 중...`, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "업로드", exact: true })).toHaveCount(0);
  releaseReload();
  await expect(statusCells(page)).toHaveText(["", ""]);
  await expect(yearInput).toHaveValue(String(targetYear));

  // The reverse ordering is protected as well: copying and querying cannot
  // replace rows between choosing a workbook and its atomic local commit.
  await holdWorkbookRead(page);
  await upload(page, screen.columns, [imported]);
  await expect(page.locator("html")).toHaveAttribute("data-spreadsheet-read", "waiting");
  await expect(page.getByRole("button", { name: "연도 복사", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "조회", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
  expect(reads).toEqual([YEAR, targetYear]);
  expect(writes).toEqual([]);
  await releaseWorkbookRead(page);
  await expect(statusCells(page)).toHaveCount(3);
  await expect(page.locator('.ag-row[row-id="-1"] [col-id="_status"]')).toHaveText("입력");
  await expect(page.locator('.ag-row[row-id="1"] [col-id="_status"]')).toHaveText("");
  await expect(page.locator('.ag-row[row-id="2"] [col-id="_status"]')).toHaveText("");
  await expect(page.locator('.ag-row[row-id="-1"] [col-id="holiday_date"]')).toHaveText(`${targetYear}-12-24`);
  expect(copies).toHaveLength(1);
  expect(reads).toEqual([YEAR, targetYear]);
  expect(writes).toEqual([]);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes).toEqual([{ items: [{ id: null, ...imported }], delete_ids: [] }]);
  await expect(statusCells(page)).toHaveText(["", "", ""]);
});

test("payroll runs export the current page as an XLSX without a write", async ({ page }) => {
  const run = {
    ...metadata, id: 1, year_month: MONTH, payroll_code_id: 1, payroll_code_name: "정규급여",
    run_name: "월 정기급여", status: "draft", total_employees: 2,
    total_gross: 8400000, total_deductions: 1200000, total_net: 7200000,
    calculated_at: null, closed_at: null, paid_at: null,
  };
  const writes = await installRoutes(page, { api: "/api/pay/runs", existing: [run] });
  await page.goto("/payroll/runs");
  await expect(page.getByRole("grid").first()).toContainText("월 정기급여");
  const table = await download(page, "현재 페이지 다운로드", /^payroll-runs-current-page\.xlsx$/);
  expect(table).toEqual([PAYROLL_RUN_COLUMNS.map((column) => column.label), ...cells(PAYROLL_RUN_COLUMNS, [run])]);
  expect(writes).toEqual([]);
});
