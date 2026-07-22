import { expect, test, type Page, type Route } from "@playwright/test";

type JsonObject = Record<string, unknown>;
type CapturedRequest = {
  method: string;
  path: string;
  body: JsonObject | null;
  createdIds?: number[];
};

const NOW = "2026-07-22T00:00:00.000Z";
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

async function installMngRoutes(page: Page, readUrls?: string[]): Promise<CapturedRequest[]> {
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

  await page.route("**/api/employees**", async (route) => {
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
      await json(route, { companies: [COMPANY] });
      return;
    }

    if (path === "/api/mng/dev-inquiries") {
      if (method === "GET") await json(route, list(inquiries, url));
      else if (method === "DELETE") {
        const ids = (body?.ids as number[]) ?? [];
        inquiries.splice(0, inquiries.length, ...inquiries.filter((item) => !ids.includes(item.id as number)));
        await json(route, { deleted_count: ids.length });
      } else {
        const id = Number(body?.id ?? nextId++);
        capturedRequest!.createdIds = [id];
        const item = { ...body, id, company_name: COMPANY.company_name, created_at: NOW, updated_at: NOW };
        const index = inquiries.findIndex((entry) => entry.id === id);
        if (index >= 0) inquiries[index] = item;
        else inquiries.unshift(item);
        await json(route, { inquiry: item });
      }
      return;
    }

    if (path === "/api/mng/dev-projects") {
      if (method === "GET") await json(route, list(projects, url));
      else if (method === "DELETE") {
        const ids = (body?.ids as number[]) ?? [];
        projects.splice(0, projects.length, ...projects.filter((item) => !ids.includes(item.id as number)));
        await json(route, { deleted_count: ids.length });
      } else {
        const id = Number(body?.id ?? nextId++);
        capturedRequest!.createdIds = [id];
        const item = { ...body, id, company_name: COMPANY.company_name, created_at: NOW, updated_at: NOW };
        const index = projects.findIndex((entry) => entry.id === id);
        if (index >= 0) projects[index] = item;
        else projects.unshift(item);
        await json(route, { project: item });
      }
      return;
    }

    if (path === "/api/mng/dev-requests/monthly-summary") {
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
      else if (method === "DELETE") {
        const ids = (body?.ids as number[]) ?? [];
        requests.splice(0, requests.length, ...requests.filter((item) => !ids.includes(item.id as number)));
        await json(route, { deleted_count: ids.length });
      } else {
        const id = Number(body?.id ?? nextId++);
        capturedRequest!.createdIds = [id];
        const item = { ...body, id, company_name: COMPANY.company_name, created_at: NOW, updated_at: NOW };
        const index = requests.findIndex((entry) => entry.id === id);
        if (index >= 0) requests[index] = item;
        else requests.unshift(item);
        await json(route, { request: item });
      }
      return;
    }

    if (path === "/api/mng/infra-masters") {
      if (method === "GET") await json(route, list(masters, url));
      else if (method === "DELETE") {
        const ids = (body?.ids as number[]) ?? [];
        masters.splice(0, masters.length, ...masters.filter((item) => !ids.includes(item.id as number)));
        configs.splice(0, configs.length, ...configs.filter((item) => !ids.includes(item.master_id as number)));
        await json(route, { deleted_count: ids.length });
      } else {
        const item = { ...body, id: nextId++, company_name: COMPANY.company_name, is_active: true, created_at: NOW, updated_at: NOW };
        capturedRequest!.createdIds = [item.id];
        masters.unshift(item);
        await json(route, { master: item });
      }
      return;
    }

    if (path.startsWith("/api/mng/infra-configs/item/")) {
      const id = Number(path.split("/").pop());
      configs.splice(0, configs.length, ...configs.filter((item) => item.id !== id));
      await json(route, { deleted_count: 1 });
      return;
    }

    if (path.startsWith("/api/mng/infra-configs/")) {
      const masterId = Number(path.split("/").pop());
      if (method === "GET") await json(route, list(configs.filter((item) => item.master_id === masterId), url));
      else {
        const rows = (body?.rows as JsonObject[]) ?? [];
        const created = rows.map((row) => ({ ...row, id: nextId++, master_id: masterId, created_at: NOW, updated_at: NOW }));
        capturedRequest!.createdIds = created.map((item) => item.id);
        configs.unshift(...created);
        await json(route, { items: created });
      }
      return;
    }

    if (path === "/api/mng/manager-status") {
      if (method === "GET") await json(route, list(mappings, url));
      else if (method === "DELETE") {
        const ids = (body?.ids as number[]) ?? [];
        mappings.splice(0, mappings.length, ...mappings.filter((item) => !ids.includes(item.id as number)));
        await json(route, { deleted_count: ids.length });
      } else {
        const item = { ...body, id: nextId++, employee_name: EMPLOYEE.display_name, company_name: COMPANY.company_name, is_active: true, created_at: NOW, updated_at: NOW };
        capturedRequest!.createdIds = [item.id];
        mappings.unshift(item);
        await json(route, { item });
      }
      return;
    }

    if (path === "/api/mng/outsource-contracts/check-duplicate") {
      await json(route, { is_duplicate: false });
      return;
    }

    if (path === "/api/mng/outsource-contracts") {
      if (method === "GET") await json(route, list(contracts, url));
      else if (method === "DELETE") {
        const ids = (body?.ids as number[]) ?? [];
        contracts.splice(0, contracts.length, ...contracts.filter((item) => !ids.includes(item.id as number)));
        await json(route, { deleted_count: ids.length });
      } else {
        const id = Number(body?.id ?? nextId++);
        capturedRequest!.createdIds = [id];
        const item = { ...body, id, employee_name: EMPLOYEE.display_name, employee_no: EMPLOYEE.employee_no, created_at: NOW, updated_at: NOW };
        const index = contracts.findIndex((entry) => entry.id === id);
        if (index >= 0) contracts[index] = item;
        else contracts.unshift(item);
        await json(route, { contract: item });
      }
      return;
    }

    if (path === "/api/mng/outsource-attendances" || path === "/api/mng/outsource-attendances/summary") {
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
      if (method === "GET") await json(route, list(summary, url));
      else if (method === "DELETE") {
        const ids = (body?.ids as number[]) ?? [];
        attendances.splice(0, attendances.length, ...attendances.filter((item) => !ids.includes(item.id as number)));
        await json(route, { deleted_count: ids.length });
      } else {
        const item = { ...body, id: nextId++, created_at: NOW, updated_at: NOW };
        capturedRequest!.createdIds = [item.id];
        attendances.unshift(item);
        await json(route, { attendance: item });
      }
      return;
    }

    if (path.startsWith("/api/mng/outsource-attendances/")) {
      const contractId = Number(path.split("/").pop());
      await json(route, list(attendances.filter((item) => item.contract_id === contractId), url));
      return;
    }

    if (path === "/api/mng/dev-staff/projects") {
      await json(route, list([{ project_id: 501, project_name: "인력 조회 프로젝트", company_id: COMPANY.id, company_name: COMPANY.company_name, assigned_staff: "테스트 담당자", actual_man_months: 1, contract_amount: 1000 }], url));
      return;
    }

    if (path === "/api/mng/dev-staff/revenue-summary") {
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
  test.beforeEach(async ({ page }) => {
    page.on("dialog", (dialog) => void dialog.accept());
  });

  test("개발 문의는 실제 UI로 생성·수정·삭제하고 SWR 목록을 갱신한다", async ({ page }) => {
    const captured = await installMngRoutes(page);
    await page.goto("/mng/dev-inquiries");
    await selectCompany(page);
    await page.getByPlaceholder("문의 내용").fill("문의 생성 값");
    await page.getByRole("button", { name: "저장", exact: true }).first().click();
    await expectRow(page, "문의 생성 값");
    const created = captured.find((entry) => entry.path === "/api/mng/dev-inquiries" && entry.method === "POST");
    expect(created?.body).toMatchObject({ company_id: 1, inquiry_content: "문의 생성 값", is_confirmed: false });

    await page.locator(".ag-row").filter({ hasText: "문의 생성 값" }).click();
    await page.getByPlaceholder("문의 내용").fill("문의 수정 값");
    await page.getByRole("button", { name: "저장", exact: true }).first().click();
    await expectRow(page, "문의 수정 값");
    const updated = captured.find((entry) => entry.path === "/api/mng/dev-inquiries" && entry.method === "PUT");
    expect(updated?.body).toMatchObject({ id: expect.any(Number), inquiry_content: "문의 수정 값" });

    await page.locator(".ag-row").filter({ hasText: "문의 수정 값" }).click();
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await expect.poll(() => captured.filter((entry) => entry.path === "/api/mng/dev-inquiries" && entry.method === "DELETE").length).toBe(1);
    expect(captured.at(-1)?.body).toEqual({ ids: [expect.any(Number)] });
    await expect(page.locator(".ag-row").filter({ hasText: "문의 수정 값" })).toHaveCount(0);
  });

  test("개발 프로젝트는 실제 UI로 생성·수정·삭제한다", async ({ page }) => {
    const captured = await installMngRoutes(page);
    await page.goto("/mng/dev-projects");
    await page.getByPlaceholder("프로젝트명").fill("프로젝트 생성 값");
    await selectCompany(page);
    await page.getByRole("button", { name: "저장", exact: true }).first().click();
    await expectRow(page, "프로젝트 생성 값");
    expect(captured.find((entry) => entry.path === "/api/mng/dev-projects" && entry.method === "POST")?.body).toMatchObject({ project_name: "프로젝트 생성 값", company_id: 1 });

    await page.locator(".ag-row").filter({ hasText: "프로젝트 생성 값" }).click();
    await page.getByPlaceholder("프로젝트명").fill("프로젝트 수정 값");
    await page.getByRole("button", { name: "저장", exact: true }).first().click();
    await expectRow(page, "프로젝트 수정 값");
    expect(captured.find((entry) => entry.path === "/api/mng/dev-projects" && entry.method === "PUT")?.body).toMatchObject({ id: expect.any(Number), project_name: "프로젝트 수정 값" });

    await page.locator(".ag-row").filter({ hasText: "프로젝트 수정 값" }).click();
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await expect.poll(() => captured.filter((entry) => entry.path === "/api/mng/dev-projects" && entry.method === "DELETE").length).toBe(1);
    const deleted = captured.find((entry) => entry.path === "/api/mng/dev-projects" && entry.method === "DELETE");
    expect(deleted?.body).toEqual({ ids: [expect.any(Number)] });
    await expect(page.locator(".ag-row").filter({ hasText: "프로젝트 수정 값" })).toHaveCount(0);
  });

  test("추가 개발 요청은 실제 UI로 생성·수정·삭제한다", async ({ page }) => {
    const captured = await installMngRoutes(page);
    await page.goto("/mng/dev-requests");
    await selectCompany(page);
    await page.getByPlaceholder("요청 내용").fill("요청 생성 값");
    await page.getByRole("button", { name: "저장", exact: true }).first().click();
    await expectRow(page, "요청 생성 값");
    expect(captured.find((entry) => entry.path === "/api/mng/dev-requests" && entry.method === "POST")?.body).toMatchObject({ company_id: 1, request_content: "요청 생성 값", request_seq: 1 });

    await page.reload();
    await expectRow(page, "요청 생성 값");
    await page.getByRole("grid").first().getByRole("gridcell", { name: "요청 생성 값", exact: true }).click();
    await expect(page.getByPlaceholder("요청 내용")).toHaveValue("요청 생성 값");
    await page.getByPlaceholder("요청 내용").fill("요청 수정 값");
    await page.getByRole("button", { name: "저장", exact: true }).first().click();
    await expect.poll(() => captured.filter((entry) => entry.path === "/api/mng/dev-requests" && entry.method === "PUT").length).toBe(1);
    await expectRow(page, "요청 수정 값");
    expect(captured.find((entry) => entry.path === "/api/mng/dev-requests" && entry.method === "PUT")?.body).toMatchObject({ id: expect.any(Number), request_content: "요청 수정 값" });

    await page.reload();
    await expectRow(page, "요청 수정 값");
    await page.getByRole("grid").first().getByRole("gridcell", { name: "요청 수정 값", exact: true }).click();
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await expect.poll(() => captured.filter((entry) => entry.path === "/api/mng/dev-requests" && entry.method === "DELETE").length).toBe(1);
    const deleted = captured.find((entry) => entry.path === "/api/mng/dev-requests" && entry.method === "DELETE");
    expect(deleted?.body).toEqual({ ids: [expect.any(Number)] });
    await expect(page.locator(".ag-row").filter({ hasText: "요청 수정 값" })).toHaveCount(0);
  });

  test("인프라 마스터와 구성은 관계형 생성·삭제 요청을 만든다", async ({ page }) => {
    const captured = await installMngRoutes(page);
    await page.goto("/mng/infra");
    await selectCompany(page);
    await page.getByPlaceholder("서비스 구분").fill("mng-e2e-service");
    await page.getByRole("button", { name: "등록", exact: true }).click();
    await expectRow(page, "mng-e2e-service");
    const masterPost = captured.find((entry) => entry.path === "/api/mng/infra-masters" && entry.method === "POST");
    expect(masterPost?.body).toEqual({ company_id: 1, service_type: "mng-e2e-service", env_type: "dev" });
    const masterId = masterPost?.createdIds?.[0];
    expect(masterId).toEqual(expect.any(Number));

    await page.getByPlaceholder("섹션").fill("app");
    await page.getByPlaceholder("키").fill("feature-x");
    await page.getByRole("button", { name: "구성 저장", exact: true }).click();
    const configPost = captured.find((entry) => entry.path === `/api/mng/infra-configs/${masterId}` && entry.method === "POST");
    expect(configPost?.body).toEqual({ rows: [{ section: "app", config_key: "feature-x", config_value: null, sort_order: 0 }] });
    const configId = configPost?.createdIds?.[0];
    expect(configId).toEqual(expect.any(Number));
    await expect(page.getByRole("button", { name: "app/feature-x 삭제", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "app/feature-x 삭제", exact: true }).click();
    await expect.poll(() => captured.some((entry) => entry.path === `/api/mng/infra-configs/item/${configId}` && entry.method === "DELETE")).toBeTruthy();
    expect(captured.find((entry) => entry.path === `/api/mng/infra-configs/item/${configId}` && entry.method === "DELETE")?.body).toBeNull();
    await expect(page.getByRole("button", { name: "app/feature-x 삭제", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "테스트 고객사 / dev 삭제", exact: true }).click();
    await expect.poll(() => captured.some((entry) => entry.path === "/api/mng/infra-masters" && entry.method === "DELETE")).toBeTruthy();
    expect(captured.find((entry) => entry.path === "/api/mng/infra-masters" && entry.method === "DELETE")?.body).toEqual({ ids: [masterId] });
    await expect(page.locator(".ag-row").filter({ hasText: "mng-e2e-service" })).toHaveCount(0);
  });

  test("담당자 현황은 매핑 생성·삭제 요청을 만든다", async ({ page }) => {
    const captured = await installMngRoutes(page);
    await page.goto("/mng/manager-status");
    await page.getByRole("combobox").nth(0).selectOption(String(EMPLOYEE.id));
    await page.getByRole("combobox").nth(1).selectOption(String(COMPANY.id));
    await page.getByPlaceholder("비고").fill("담당자 매핑");
    await page.getByRole("button", { name: "등록", exact: true }).click();
    await expectRow(page, "테스트 담당자");
    const mappingPost = captured.find((entry) => entry.path === "/api/mng/manager-status" && entry.method === "POST");
    expect(mappingPost?.body).toMatchObject({ employee_id: 7, company_id: 1, note: "담당자 매핑" });
    const mappingId = mappingPost?.createdIds?.[0];
    expect(mappingId).toEqual(expect.any(Number));
    await page.getByRole("button", { name: "테스트 담당자 삭제", exact: true }).click();
    await expect.poll(() => captured.some((entry) => entry.path === "/api/mng/manager-status" && entry.method === "DELETE")).toBeTruthy();
    expect(captured.find((entry) => entry.path === "/api/mng/manager-status" && entry.method === "DELETE")?.body).toEqual({ ids: [mappingId] });
    await expect(page.getByRole("button", { name: "테스트 담당자 삭제", exact: true })).toHaveCount(0);
  });

  test("외주 계약은 중복 확인 후 생성·수정·삭제한다", async ({ page }) => {
    const captured = await installMngRoutes(page);
    await page.goto("/mng/outsource-contracts");
    await page.getByRole("combobox").selectOption(String(EMPLOYEE.id));
    const contractForm = page.locator("[data-slot='card']").filter({ has: page.getByText("계약 상세", { exact: true }) });
    // 계약 종료일은 필수이므로 계약 상세 form 안의 두 번째 날짜 선택기를 사용한다.
    await contractForm.getByRole("button", { name: "날짜 선택" }).nth(1).click();
    await page.locator(".rdp-day_button:not([disabled])").first().click();
    await page.getByPlaceholder("기본 연차 수").fill("12");
    await page.getByRole("button", { name: "저장", exact: true }).first().click();
    await expectRow(page, "테스트 담당자");
    const contractPost = captured.find((entry) => entry.path === "/api/mng/outsource-contracts" && entry.method === "POST");
    expect(contractPost?.body).toMatchObject({ employee_id: 7, total_leave_count: 12 });
    const contractId = contractPost?.createdIds?.[0];
    expect(contractId).toEqual(expect.any(Number));

    await page.locator(".ag-row").filter({ hasText: "테스트 담당자" }).click();
    await page.getByPlaceholder("기본 연차 수").fill("13");
    await page.getByRole("button", { name: "저장", exact: true }).first().click();
    await expect.poll(() => captured.some((entry) => entry.path === "/api/mng/outsource-contracts" && entry.method === "PUT")).toBeTruthy();
    expect(captured.find((entry) => entry.path === "/api/mng/outsource-contracts" && entry.method === "PUT")?.body).toMatchObject({ id: expect.any(Number), total_leave_count: 13 });
    await page.locator(".ag-row").filter({ hasText: "테스트 담당자" }).click();
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await expect.poll(() => captured.some((entry) => entry.path === "/api/mng/outsource-contracts" && entry.method === "DELETE")).toBeTruthy();
    expect(captured.find((entry) => entry.path === "/api/mng/outsource-contracts" && entry.method === "DELETE")?.body).toEqual({ ids: [contractId] });
    await expect(page.locator(".ag-row").filter({ hasText: "테스트 담당자" })).toHaveCount(0);
  });

  test("외주 근태는 선택된 계약에 생성·삭제 요청을 만든다", async ({ page }) => {
    const captured = await installMngRoutes(page);
    await page.goto("/mng/outsource-attendance");
    await expectRow(page, "테스트 담당자");
    await page.getByPlaceholder("근태코드").fill("VAC");
    await page.getByRole("button", { name: "등록", exact: true }).click();
    await expect(page.getByRole("button", { name: "VAC 삭제", exact: true })).toBeVisible();
    const attendancePost = captured.find((entry) => entry.path === "/api/mng/outsource-attendances" && entry.method === "POST");
    expect(attendancePost?.body).toMatchObject({ contract_id: 88, employee_id: 7, attendance_code: "VAC" });
    const attendanceId = attendancePost?.createdIds?.[0];
    expect(attendanceId).toEqual(expect.any(Number));
    await page.getByRole("button", { name: "VAC 삭제", exact: true }).click();
    await expect.poll(() => captured.some((entry) => entry.path === "/api/mng/outsource-attendances" && entry.method === "DELETE")).toBeTruthy();
    expect(captured.find((entry) => entry.path === "/api/mng/outsource-attendances" && entry.method === "DELETE")?.body).toEqual({ ids: [attendanceId] });
    await expect(page.getByRole("button", { name: "VAC 삭제", exact: true })).toHaveCount(0);
  });

  test("개발 인력 현황은 고객사 조회 GET만 수행한다", async ({ page }) => {
    const reads: string[] = [];
    const captured = await installMngRoutes(page, reads);
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
