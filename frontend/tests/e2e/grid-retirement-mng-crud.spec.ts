import { expect, test, type Page, type Route } from "@playwright/test";

type JsonObject = Record<string, unknown>;
type CapturedRequest = {
  method: string;
  path: string;
  body: JsonObject | null;
  createdIds?: number[];
};

const NOW = "2026-07-22T00:00:00.000Z";
const TODAY = new Date().toISOString().slice(0, 10);
const COMPANY = { id: 1, company_name: "테스트 고객사" };
const EMPLOYEE = {
  id: 7,
  employee_no: "E-0007",
  login_id: "mng-tester",
  display_name: "테스트 담당자",
  email: "mng@example.com",
  department_id: 1,
  department_name: "개발팀",
  position_title: "매니저",
  hire_date: "2020-01-01",
  employment_status: "active",
  is_active: true,
};

function list(items: JsonObject[], url: URL): JsonObject {
  return {
    items,
    total_count: items.length,
    page: Number(url.searchParams.get("page") ?? 1),
    limit: Number(url.searchParams.get("limit") ?? 50),
  };
}

async function json(route: Route, body: JsonObject): Promise<void> {
  await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
}

async function requestBody(route: Route): Promise<JsonObject | null> {
  const raw = route.request().postData();
  return raw ? (JSON.parse(raw) as JsonObject) : null;
}

function mapWrites(captured: CapturedRequest[]): Omit<CapturedRequest, "createdIds">[] {
  return captured.map(({ method, path, body }) => ({ method, path, body }));
}

async function installMngRoutes(
  page: Page,
  readUrls?: string[],
  unexpectedWrites: string[] = [],
): Promise<CapturedRequest[]> {
  const captured: CapturedRequest[] = [];
  let nextId = 100;
  const inquiries: JsonObject[] = [];
  const projects: JsonObject[] = [];
  const requests: JsonObject[] = [];
  const masters: JsonObject[] = [];
  const configs: JsonObject[] = [];
  const mappings: JsonObject[] = [];
  const contracts: JsonObject[] = [];
  const attendances: JsonObject[] = [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fallback();
      return;
    }
    const message = `Unexpected API write escaped fixture: ${request.method()} ${new URL(request.url()).pathname}`;
    unexpectedWrites.push(message);
    throw new Error(message);
  });

  await page.route("**/api/employees**", async (route) => {
    if (route.request().method() !== "GET") {
      throw new Error(`Unexpected employees write: ${route.request().method()}`);
    }
    await json(route, { employees: [EMPLOYEE], total_count: 1 });
  });

  await page.route("**/api/mng/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const body = await requestBody(route);
    const capturedRequest: CapturedRequest | null = method !== "GET" ? { method, path, body } : null;
    if (capturedRequest) captured.push(capturedRequest);
    if (method === "GET" && path.startsWith("/api/mng/dev-staff/")) readUrls?.push(request.url());

    if (path === "/api/mng/companies/dropdown") {
      if (method !== "GET") throw new Error(`Unexpected companies dropdown write: ${method}`);
      await json(route, { companies: [COMPANY] });
      return;
    }

    if (path === "/api/mng/dev-inquiries") {
      if (method === "GET") await json(route, list(inquiries, url));
      else if (method === "POST" || method === "PUT") {
        const id = Number(body?.id ?? nextId++);
        capturedRequest!.createdIds = [id];
        const item = { ...body, id, company_name: COMPANY.company_name, created_at: NOW, updated_at: NOW };
        const index = inquiries.findIndex((entry) => entry.id === id);
        if (index >= 0) inquiries[index] = item;
        else inquiries.unshift(item);
        await json(route, { inquiry: item });
      } else if (method === "DELETE") {
        const ids = (body?.ids as number[]) ?? [];
        inquiries.splice(0, inquiries.length, ...inquiries.filter((item) => !ids.includes(item.id as number)));
        await json(route, { deleted_count: ids.length });
      } else throw new Error(`Unexpected dev inquiry method: ${method}`);
      return;
    }

    if (path === "/api/mng/dev-projects") {
      if (method === "GET") await json(route, list(projects, url));
      else if (method === "POST" || method === "PUT") {
        const id = Number(body?.id ?? nextId++);
        capturedRequest!.createdIds = [id];
        const item = { ...body, id, company_name: COMPANY.company_name, created_at: NOW, updated_at: NOW };
        const index = projects.findIndex((entry) => entry.id === id);
        if (index >= 0) projects[index] = item;
        else projects.unshift(item);
        await json(route, { project: item });
      } else if (method === "DELETE") {
        const ids = (body?.ids as number[]) ?? [];
        projects.splice(0, projects.length, ...projects.filter((item) => !ids.includes(item.id as number)));
        await json(route, { deleted_count: ids.length });
      } else throw new Error(`Unexpected dev project method: ${method}`);
      return;
    }

    if (path === "/api/mng/dev-requests/monthly-summary") {
      if (method !== "GET") throw new Error(`Unexpected request summary write: ${method}`);
      const byMonth = new Map<string, JsonObject[]>();
      for (const item of requests) {
        const month = String(item.request_ym).slice(0, 7);
        byMonth.set(month, [...(byMonth.get(month) ?? []), item]);
      }
      await json(route, list([...byMonth.entries()].map(([request_ym, items]) => ({
        request_ym,
        total_count: items.length,
        paid_count: items.filter((item) => item.is_paid).length,
        paid_man_months_total: 0,
        actual_man_months_total: 0,
      })), url));
      return;
    }

    if (path === "/api/mng/dev-requests") {
      if (method === "GET") await json(route, list(requests, url));
      else if (method === "POST" || method === "PUT") {
        const id = Number(body?.id ?? nextId++);
        capturedRequest!.createdIds = [id];
        const item = { ...body, id, company_name: COMPANY.company_name, created_at: NOW, updated_at: NOW };
        const index = requests.findIndex((entry) => entry.id === id);
        if (index >= 0) requests[index] = item;
        else requests.unshift(item);
        await json(route, { request: item });
      } else if (method === "DELETE") {
        const ids = (body?.ids as number[]) ?? [];
        requests.splice(0, requests.length, ...requests.filter((item) => !ids.includes(item.id as number)));
        await json(route, { deleted_count: ids.length });
      } else throw new Error(`Unexpected dev request method: ${method}`);
      return;
    }

    if (path === "/api/mng/infra-masters") {
      if (method === "GET") await json(route, list(masters, url));
      else if (method === "POST") {
        const item = { ...body, id: nextId++, company_name: COMPANY.company_name, is_active: true, created_at: NOW, updated_at: NOW };
        capturedRequest!.createdIds = [item.id];
        masters.unshift(item);
        await json(route, { master: item });
      } else if (method === "DELETE") {
        const ids = (body?.ids as number[]) ?? [];
        masters.splice(0, masters.length, ...masters.filter((item) => !ids.includes(item.id as number)));
        configs.splice(0, configs.length, ...configs.filter((item) => !ids.includes(item.master_id as number)));
        await json(route, { deleted_count: ids.length });
      } else throw new Error(`Unexpected infra master method: ${method}`);
      return;
    }

    if (path.startsWith("/api/mng/infra-configs/item/")) {
      if (method !== "DELETE") throw new Error(`Unexpected infra config item method: ${method}`);
      const id = Number(path.split("/").pop());
      configs.splice(0, configs.length, ...configs.filter((item) => item.id !== id));
      await json(route, { deleted_count: 1 });
      return;
    }

    if (path.startsWith("/api/mng/infra-configs/")) {
      const masterId = Number(path.split("/").pop());
      if (method === "GET") await json(route, list(configs.filter((item) => item.master_id === masterId), url));
      else if (method === "POST") {
        const rows = (body?.rows as JsonObject[]) ?? [];
        const created = rows.map((row) => ({ ...row, id: nextId++, master_id: masterId, created_at: NOW, updated_at: NOW }));
        capturedRequest!.createdIds = created.map((item) => item.id);
        configs.unshift(...created);
        await json(route, { items: created });
      } else throw new Error(`Unexpected infra config method: ${method}`);
      return;
    }

    if (path === "/api/mng/manager-status") {
      if (method === "GET") await json(route, list(mappings, url));
      else if (method === "POST") {
        const item = { ...body, id: nextId++, employee_name: EMPLOYEE.display_name, company_name: COMPANY.company_name, is_active: true, created_at: NOW, updated_at: NOW };
        capturedRequest!.createdIds = [item.id];
        mappings.unshift(item);
        await json(route, { item });
      } else if (method === "DELETE") {
        const ids = (body?.ids as number[]) ?? [];
        mappings.splice(0, mappings.length, ...mappings.filter((item) => !ids.includes(item.id as number)));
        await json(route, { deleted_count: ids.length });
      } else throw new Error(`Unexpected manager status method: ${method}`);
      return;
    }

    if (path === "/api/mng/outsource-contracts/check-duplicate") {
      if (method !== "GET") throw new Error(`Unexpected contract duplicate-check write: ${method}`);
      await json(route, { is_duplicate: false });
      return;
    }

    if (path === "/api/mng/outsource-contracts") {
      if (method === "GET") await json(route, list(contracts, url));
      else if (method === "POST" || method === "PUT") {
        const id = Number(body?.id ?? nextId++);
        capturedRequest!.createdIds = [id];
        const item = { ...body, id, employee_name: EMPLOYEE.display_name, employee_no: EMPLOYEE.employee_no, created_at: NOW, updated_at: NOW };
        const index = contracts.findIndex((entry) => entry.id === id);
        if (index >= 0) contracts[index] = item;
        else contracts.unshift(item);
        await json(route, { contract: item });
      } else if (method === "DELETE") {
        const ids = (body?.ids as number[]) ?? [];
        contracts.splice(0, contracts.length, ...contracts.filter((item) => !ids.includes(item.id as number)));
        await json(route, { deleted_count: ids.length });
      } else throw new Error(`Unexpected outsource contract method: ${method}`);
      return;
    }

    if (path === "/api/mng/outsource-attendances/summary") {
      if (method !== "GET") throw new Error(`Unexpected attendance summary write: ${method}`);
      const summary = [{
        contract_id: 88,
        employee_id: EMPLOYEE.id,
        employee_name: EMPLOYEE.display_name,
        employee_no: EMPLOYEE.employee_no,
        start_date: "2026-01-01",
        end_date: "2026-12-31",
        total_count: 12,
        used_count: attendances.length,
        remain_count: 12 - attendances.length,
        note: null,
      }];
      await json(route, list(summary, url));
      return;
    }

    if (path === "/api/mng/outsource-attendances") {
      if (method === "GET") {
        const summary = [{
          contract_id: 88,
          employee_id: EMPLOYEE.id,
          employee_name: EMPLOYEE.display_name,
          employee_no: EMPLOYEE.employee_no,
          start_date: "2026-01-01",
          end_date: "2026-12-31",
          total_count: 12,
          used_count: attendances.length,
          remain_count: 12 - attendances.length,
          note: null,
        }];
        await json(route, list(summary, url));
      } else if (method === "POST") {
        const item = { ...body, id: nextId++, created_at: NOW, updated_at: NOW };
        capturedRequest!.createdIds = [item.id];
        attendances.unshift(item);
        await json(route, { attendance: item });
      } else if (method === "DELETE") {
        const ids = (body?.ids as number[]) ?? [];
        attendances.splice(0, attendances.length, ...attendances.filter((item) => !ids.includes(item.id as number)));
        await json(route, { deleted_count: ids.length });
      } else throw new Error(`Unexpected outsource attendance method: ${method}`);
      return;
    }

    if (path.startsWith("/api/mng/outsource-attendances/")) {
      if (method !== "GET") throw new Error(`Unexpected attendance detail write: ${method}`);
      const contractId = Number(path.split("/").pop());
      await json(route, list(attendances.filter((item) => item.contract_id === contractId), url));
      return;
    }

    if (path === "/api/mng/dev-staff/projects") {
      if (method !== "GET") throw new Error(`Unexpected dev staff projects write: ${method}`);
      await json(route, list([{ project_id: 501, project_name: "인력 조회 프로젝트", company_id: COMPANY.id, company_name: COMPANY.company_name, assigned_staff: "테스트 담당자", actual_man_months: 1, contract_amount: 1000 }], url));
      return;
    }

    if (path === "/api/mng/dev-staff/revenue-summary") {
      if (method !== "GET") throw new Error(`Unexpected dev staff revenue-summary write: ${method}`);
      await json(route, list([{ month: "2026-07", project_count: 1, contract_amount_total: 1000, actual_man_months_total: 1 }], url));
      return;
    }

    if (method !== "GET") {
      throw new Error(`Unexpected MNG domain write escaped fixture: ${method} ${path}`);
    }
    await route.fallback();
  });

  return captured;
}

async function selectCompany(page: Page): Promise<void> {
  await page.getByRole("combobox").filter({ has: page.locator("option", { hasText: COMPANY.company_name }) }).first().selectOption(String(COMPANY.id));
}

async function expectRow(page: Page, text: string): Promise<void> {
  await expect(page.locator(".ag-row").filter({ hasText: text })).toBeVisible();
}

test.use({ viewport: { width: 1440, height: 1600 } });

test.describe("MNG UI mutation contracts", () => {
  let unexpectedWrites: string[];

  test.beforeEach(async ({ page }) => {
    unexpectedWrites = [];
    page.on("dialog", (dialog) => void dialog.accept());
  });

  test.afterEach(() => {
    expect(unexpectedWrites).toEqual([]);
  });

  test("개발 문의는 실제 UI로 생성·수정·삭제하고 SWR 목록을 갱신한다", async ({ page }) => {
    const captured = await installMngRoutes(page, undefined, unexpectedWrites);
    await page.goto("/mng/dev-inquiries");
    await selectCompany(page);
    await page.getByPlaceholder("문의 내용").fill("문의 생성 값");
    await page.getByRole("button", { name: "저장", exact: true }).first().click();
    await expectRow(page, "문의 생성 값");

    await page.locator(".ag-row").filter({ hasText: "문의 생성 값" }).click();
    await page.getByPlaceholder("문의 내용").fill("문의 수정 값");
    await page.getByRole("button", { name: "저장", exact: true }).first().click();
    await expectRow(page, "문의 수정 값");

    await page.locator(".ag-row").filter({ hasText: "문의 수정 값" }).click();
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await expect.poll(() => captured).toHaveLength(3);
    await expect(page.locator(".ag-row").filter({ hasText: "문의 수정 값" })).toHaveCount(0);
    expect(mapWrites(captured)).toEqual([
      { method: "POST", path: "/api/mng/dev-inquiries", body: { company_id: 1, inquiry_content: "문의 생성 값", hoped_start_date: null, estimated_man_months: null, sales_rep_name: null, client_contact_name: null, progress_code: null, project_name: null, note: null, is_confirmed: false } },
      { method: "PUT", path: "/api/mng/dev-inquiries", body: { id: 100, company_id: 1, inquiry_content: "문의 수정 값", hoped_start_date: null, estimated_man_months: null, sales_rep_name: null, client_contact_name: null, progress_code: null, project_name: null, note: null, is_confirmed: false } },
      { method: "DELETE", path: "/api/mng/dev-inquiries", body: { ids: [100] } },
    ]);
  });

  test("개발 프로젝트는 실제 UI로 생성·수정·삭제한다", async ({ page }) => {
    const captured = await installMngRoutes(page, undefined, unexpectedWrites);
    await page.goto("/mng/dev-projects");
    await page.getByPlaceholder("프로젝트명").fill("프로젝트 생성 값");
    await selectCompany(page);
    await page.getByRole("button", { name: "저장", exact: true }).first().click();
    await expectRow(page, "프로젝트 생성 값");

    await page.locator(".ag-row").filter({ hasText: "프로젝트 생성 값" }).click();
    await page.getByPlaceholder("프로젝트명").fill("프로젝트 수정 값");
    await page.getByRole("button", { name: "저장", exact: true }).first().click();
    await expectRow(page, "프로젝트 수정 값");

    await page.locator(".ag-row").filter({ hasText: "프로젝트 수정 값" }).click();
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await expect.poll(() => captured).toHaveLength(3);
    await expect(page.locator(".ag-row").filter({ hasText: "프로젝트 수정 값" })).toHaveCount(0);
    expect(mapWrites(captured)).toEqual([
      { method: "POST", path: "/api/mng/dev-projects", body: { project_name: "프로젝트 생성 값", company_id: 1, assigned_staff: null, contract_start_date: null, contract_end_date: null, dev_start_date: null, dev_end_date: null, contract_amount: null, actual_man_months: null, inspection_status: null, has_tax_bill: false, note: null } },
      { method: "PUT", path: "/api/mng/dev-projects", body: { id: 100, project_name: "프로젝트 수정 값", company_id: 1, assigned_staff: null, contract_start_date: null, contract_end_date: null, dev_start_date: null, dev_end_date: null, contract_amount: null, actual_man_months: null, inspection_status: null, has_tax_bill: false, note: null } },
      { method: "DELETE", path: "/api/mng/dev-projects", body: { ids: [100] } },
    ]);
  });

  test("추가 개발 요청은 실제 UI로 생성·수정·삭제한다", async ({ page }) => {
    const captured = await installMngRoutes(page, undefined, unexpectedWrites);
    await page.goto("/mng/dev-requests");
    await selectCompany(page);
    await page.getByPlaceholder("요청 내용").fill("요청 생성 값");
    await page.getByRole("button", { name: "저장", exact: true }).first().click();
    await expectRow(page, "요청 생성 값");

    await page.reload();
    await expectRow(page, "요청 생성 값");
    await page.getByRole("grid").first().getByRole("gridcell", { name: "요청 생성 값", exact: true }).click();
    await expect(page.getByPlaceholder("요청 내용")).toHaveValue("요청 생성 값");
    await page.getByPlaceholder("요청 내용").fill("요청 수정 값");
    await page.getByRole("button", { name: "저장", exact: true }).first().click();
    await expect.poll(() => captured).toHaveLength(2);
    await expectRow(page, "요청 수정 값");

    await page.reload();
    await expectRow(page, "요청 수정 값");
    await page.getByRole("grid").first().getByRole("gridcell", { name: "요청 수정 값", exact: true }).click();
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await expect.poll(() => captured).toHaveLength(3);
    await expect(page.locator(".ag-row").filter({ hasText: "요청 수정 값" })).toHaveCount(0);
    expect(mapWrites(captured)).toEqual([
      { method: "POST", path: "/api/mng/dev-requests", body: { company_id: 1, request_ym: TODAY, request_seq: 1, requester_name: null, status_code: null, request_content: "요청 생성 값", is_paid: false, has_tax_bill: false, paid_man_months: null, actual_man_months: null, note: null } },
      { method: "PUT", path: "/api/mng/dev-requests", body: { id: 100, company_id: 1, request_ym: TODAY, requester_name: null, status_code: null, request_content: "요청 수정 값", is_paid: false, has_tax_bill: false, paid_man_months: null, actual_man_months: null, note: null } },
      { method: "DELETE", path: "/api/mng/dev-requests", body: { ids: [100] } },
    ]);
  });

  test("인프라 마스터와 구성은 관계형 생성·삭제 요청을 만든다", async ({ page }) => {
    const captured = await installMngRoutes(page, undefined, unexpectedWrites);
    await page.goto("/mng/infra");
    await selectCompany(page);
    await page.getByPlaceholder("서비스 구분").fill("mng-e2e-service");
    await page.getByRole("button", { name: "등록", exact: true }).click();
    await expectRow(page, "mng-e2e-service");
    await page.getByPlaceholder("섹션").fill("app");
    await page.getByPlaceholder("키").fill("feature-x");
    await page.getByRole("button", { name: "구성 저장", exact: true }).click();
    await expect(page.getByRole("button", { name: "app/feature-x 삭제", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "app/feature-x 삭제", exact: true }).click();
    await expect.poll(() => captured).toHaveLength(3);
    await expect(page.getByRole("button", { name: "app/feature-x 삭제", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "테스트 고객사 / dev 삭제", exact: true }).click();
    await expect.poll(() => captured).toHaveLength(4);
    await expect(page.locator(".ag-row").filter({ hasText: "mng-e2e-service" })).toHaveCount(0);
    expect(mapWrites(captured)).toEqual([
      { method: "POST", path: "/api/mng/infra-masters", body: { company_id: 1, service_type: "mng-e2e-service", env_type: "dev" } },
      { method: "POST", path: "/api/mng/infra-configs/100", body: { rows: [{ section: "app", config_key: "feature-x", config_value: null, sort_order: 0 }] } },
      { method: "DELETE", path: "/api/mng/infra-configs/item/101", body: null },
      { method: "DELETE", path: "/api/mng/infra-masters", body: { ids: [100] } },
    ]);
  });

  test("담당자 현황은 매핑 생성·삭제 요청을 만든다", async ({ page }) => {
    const captured = await installMngRoutes(page, undefined, unexpectedWrites);
    await page.goto("/mng/manager-status");
    await page.getByRole("combobox").nth(0).selectOption(String(EMPLOYEE.id));
    await page.getByRole("combobox").nth(1).selectOption(String(COMPANY.id));
    await page.getByPlaceholder("비고").fill("담당자 매핑");
    await page.getByRole("button", { name: "등록", exact: true }).click();
    await expectRow(page, "테스트 담당자");
    await page.getByRole("button", { name: "테스트 담당자 삭제", exact: true }).click();
    await expect.poll(() => captured).toHaveLength(2);
    await expect(page.getByRole("button", { name: "테스트 담당자 삭제", exact: true })).toHaveCount(0);
    expect(mapWrites(captured)).toEqual([
      { method: "POST", path: "/api/mng/manager-status", body: { employee_id: 7, company_id: 1, start_date: TODAY, end_date: null, note: "담당자 매핑" } },
      { method: "DELETE", path: "/api/mng/manager-status", body: { ids: [100] } },
    ]);
  });

  test("외주 계약은 중복 확인 후 생성·수정·삭제한다", async ({ page }) => {
    const captured = await installMngRoutes(page, undefined, unexpectedWrites);
    await page.goto("/mng/outsource-contracts");
    await page.getByRole("combobox").selectOption(String(EMPLOYEE.id));
    const contractForm = page.locator("[data-slot='card']").filter({ has: page.getByText("계약 상세", { exact: true }) });
    const datePickers = contractForm.getByRole("button", { name: "날짜 선택" });
    await datePickers.nth(0).click();
    const startCalendarId = await datePickers.nth(0).getAttribute("aria-controls");
    expect(startCalendarId).toBeTruthy();
    const startCalendar = page.locator(`#${startCalendarId!}`);
    await startCalendar.getByRole("combobox", { name: "Select year" }).selectOption("2026");
    await startCalendar.getByRole("combobox", { name: "Select month" }).selectOption("6");
    await startCalendar.getByRole("button", { name: /2026년 7월 22일/ }).click();
    await datePickers.nth(1).click();
    const endCalendarId = await datePickers.nth(1).getAttribute("aria-controls");
    expect(endCalendarId).toBeTruthy();
    const endCalendar = page.locator(`#${endCalendarId!}`);
    await endCalendar.getByRole("combobox", { name: "Select year" }).selectOption("2026");
    await endCalendar.getByRole("combobox", { name: "Select month" }).selectOption("6");
    await endCalendar.getByRole("button", { name: /2026년 7월 23일/ }).click();
    await page.getByPlaceholder("기본 연차 수").fill("12");
    await page.getByRole("button", { name: "저장", exact: true }).first().click();
    await expectRow(page, "테스트 담당자");

    await page.locator(".ag-row").filter({ hasText: "테스트 담당자" }).click();
    await page.getByPlaceholder("기본 연차 수").fill("13");
    await page.getByRole("button", { name: "저장", exact: true }).first().click();
    await expect.poll(() => captured).toHaveLength(2);
    await page.locator(".ag-row").filter({ hasText: "테스트 담당자" }).click();
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await expect.poll(() => captured).toHaveLength(3);
    await expect(page.locator(".ag-row").filter({ hasText: "테스트 담당자" })).toHaveCount(0);
    expect(mapWrites(captured)).toEqual([
      { method: "POST", path: "/api/mng/outsource-contracts", body: { employee_id: 7, start_date: "2026-07-22", end_date: "2026-07-23", total_leave_count: 12, extra_leave_count: 0, note: null, is_active: true } },
      { method: "PUT", path: "/api/mng/outsource-contracts", body: { id: 100, employee_id: 7, start_date: "2026-07-22", end_date: "2026-07-23", total_leave_count: 13, extra_leave_count: 0, note: null, is_active: true } },
      { method: "DELETE", path: "/api/mng/outsource-contracts", body: { ids: [100] } },
    ]);
  });

  test("외주 근태는 선택된 계약에 생성·삭제 요청을 만든다", async ({ page }) => {
    const captured = await installMngRoutes(page, undefined, unexpectedWrites);
    await page.goto("/mng/outsource-attendance");
    await expectRow(page, "테스트 담당자");
    await page.getByPlaceholder("근태코드").fill("VAC");
    await page.getByRole("button", { name: "등록", exact: true }).click();
    await expect(page.getByRole("button", { name: "VAC 삭제", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "VAC 삭제", exact: true }).click();
    await expect.poll(() => captured).toHaveLength(2);
    await expect(page.getByRole("button", { name: "VAC 삭제", exact: true })).toHaveCount(0);
    expect(mapWrites(captured)).toEqual([
      { method: "POST", path: "/api/mng/outsource-attendances", body: { contract_id: 88, employee_id: 7, attendance_code: "VAC", status_code: null, start_date: TODAY, end_date: TODAY, apply_date: null, apply_count: 1, note: null } },
      { method: "DELETE", path: "/api/mng/outsource-attendances", body: { ids: [100] } },
    ]);
  });

  test("개발 인력 현황은 고객사 조회 GET만 수행한다", async ({ page }) => {
    const reads: string[] = [];
    const captured = await installMngRoutes(page, reads, unexpectedWrites);
    await page.goto("/mng/dev-staff");
    reads.splice(0, reads.length);
    await page.getByRole("combobox").selectOption(String(COMPANY.id));
    await page.getByRole("button", { name: "조회", exact: true }).first().click();
    await expect.poll(() => reads.filter((url) => url.includes("company_id=1")).length).toBeGreaterThanOrEqual(2);
    expect(reads.filter((url) => url.includes("company_id=1")).some((url) => url.includes("/projects?"))).toBeTruthy();
    expect(reads.filter((url) => url.includes("company_id=1")).some((url) => url.includes("/revenue-summary?"))).toBeTruthy();
    await expectRow(page, "인력 조회 프로젝트");
    expect(captured).toEqual([]);
  });
});
