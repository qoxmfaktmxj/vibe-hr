import { createHmac } from "node:crypto";
import { createServer } from "node:http";

// Synthetic data for local UI tests only. No database, real identity, or production
// authentication guarantees are exercised. Credentials and tokens are never logged.
const scenarios = new Set([
  "default", "login-401", "login-429", "login-503", "enter-cds-failure",
  "profile-failure", "empty-profile", "member", "sidebar-domains", "hri-tasks", "retire-layout", "checklist-layout", "employee-ux", "employee-ux-no-save", "employee-ux-preview", "training-applications", "retirement-selection", "appraisal-targets", "file-actions",
]);
let scenario = "default";
const completedTasks = new Set();
const taskActions = [];
const hriRequestWrites = [];
const hriRequests = [];
const checklistRows = [];
let uxEmployees = [];
const employeeWrites = [];
let trainingApplications = [];
const trainingActions = [];
let rejectNextSave = true;
const user = { id: 1, email: "employee@example.test", display_name: "테스트 사용자", roles: ["admin"] };
const employee = {
  id: 1, employee_no: "TEST-001", login_id: "test-user", display_name: user.display_name,
  email: user.email, department_id: 1, department_name: "테스트 부서", position_title: "매니저",
  hire_date: "2025-01-06", employment_status: "active", is_active: true,
};
const menus = [
  { id: 1, code: "dashboard", name: "대시보드", path: "/dashboard", icon: "LayoutDashboard", sort_order: 1, children: [] },
  {
    id: 2, code: "mng", name: "고객관리", path: null, icon: "Building2", sort_order: 2,
    children: [
      { id: 4, code: "mng.basic", name: "기본 관리", path: null, icon: "Folder", sort_order: 1, children: [
        { id: 3, code: "mng.companies", name: "고객사관리", path: "/mng/companies", icon: "Building2", sort_order: 1, children: [] },
        { id: 5, code: "mng.dev-requests", name: "개발 요청", path: "/mng/dev-requests", icon: "FileText", sort_order: 2, children: [] },
      ] },
    ],
  },
];
const actions = ["query", "create", "copy", "template_download", "upload", "save", "download"];

function loginResponse() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: scenario === "member" ? "synthetic-member" : "synthetic-test-user", iat: now, exp: now + 7200 })).toString("base64url");
  const signature = createHmac("sha256", process.env.AUTH_TOKEN_SECRET).update(`${header}.${payload}`).digest("base64url");
  return {
    access_token: `${header}.${payload}.${signature}`, user: scenario === "member" ? { ...user, roles: ["employee"] } : user,
    access_ttl_min: 120, refresh_threshold_min: 60, remember_enabled: true,
    remember_ttl_min: 43_200, show_countdown: true,
  };
}

function json(response, status, body, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  response.end(JSON.stringify(body));
}

if (!process.env.AUTH_TOKEN_SECRET) throw new Error("Synthetic backend requires the test config environment.");

createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:3101");
  const route = `${request.method} ${url.pathname}`;
  if (route === "POST /__scenario") {
    let body = "";
    for await (const chunk of request) body += chunk;
    const input = JSON.parse(body || "null");
    if (!scenarios.has(input?.scenario)) return json(response, 400, { detail: "Unknown synthetic scenario." });
    scenario = input.scenario;
    trainingActions.length = 0;
    trainingApplications = ["submitted", "submitted", "draft", "approved"].map((status, index) => ({
      id: 101 + index, application_no: `TRA-${101 + index}`, employee_id: 1,
      employee_no: "TEST-001", employee_name: "테스트 사용자", department_name: "테스트 부서",
      course_id: 1, course_name: "업무 교육", event_id: null, event_name: "기본 과정", in_out_type: "IN",
      status, year_plan_yn: false, survey_yn: false, edu_memo: null, note: null,
      created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z",
    }));
    employeeWrites.length = 0;
    rejectNextSave = scenario !== "employee-ux-preview";
    uxEmployees = [1, 2, 3].map((id) => ({ ...employee, id, employee_no: `EMP-00${id}`, login_id: `employee-${id}`, display_name: ["김서준", "이하은", "박지우"][id - 1], email: `person${id}@example.test`, position_title: id === 1 ? "팀장" : "사원", hire_date: `202${id}-01-02T00:00:00`, employment_status: id === 3 ? "leave" : "active" }));
    completedTasks.clear();
    taskActions.length = 0;
    hriRequestWrites.length = 0;
    hriRequests.length = 0;
    checklistRows.length = 0;
    checklistRows.push({ id: 1, code: "asset_return", title: "회사 자산 반납", description: "지급 자산 확인", is_required: true, is_active: true, sort_order: 0, created_at: "2026-09-13T00:00:00Z", updated_at: "2026-09-13T00:00:00Z" });
    return json(response, 200, { scenario });
  }
  if (scenario === "training-applications") {
    if (route === "GET /__training-actions") return json(response, 200, trainingActions);
    if (route === "POST /__training-status") {
      let body = ""; for await (const part of request) body += part;
      const input = JSON.parse(body);
      trainingApplications.find((row) => row.id === input.id).status = input.status;
      return json(response, 200, { updated: true });
    }
    if (url.pathname.startsWith("/api/v1/tra/")) {
      if (!request.headers.authorization?.startsWith("Bearer ")) return json(response, 401, { detail: "Not authenticated." });
      if (["GET /api/v1/tra/applications-detail", "GET /api/v1/tra/my-applications"].includes(route)) {
        return json(response, 200, { items: trainingApplications, total_count: trainingApplications.length });
      }
      if (route === "GET /api/v1/tra/courses") return json(response, 200, { items: [{ id: 1, course_name: "업무 교육" }], total_count: 1 });
      if (route === "POST /api/v1/tra/my-applications") {
        let body = ""; for await (const part of request) body += part;
        const input = JSON.parse(body);
        const item = { ...trainingApplications[0], ...input, id: 105, application_no: "TRA-105", status: "submitted" };
        trainingActions.push({ action: "create", method: request.method, body: input });
        trainingApplications.push(item);
        return json(response, 201, { item });
      }
      const match = url.pathname.match(/^\/api\/v1\/tra\/applications\/(\d+)\/(approve|reject|withdraw)$/);
      if (match && request.method === (match[2] === "withdraw" ? "PUT" : "POST")) {
        let body = ""; for await (const part of request) body += part;
        const item = trainingApplications.find((row) => row.id === Number(match[1]));
        trainingActions.push({ id: item.id, action: match[2], method: request.method, body: body ? JSON.parse(body) : null });
        item.status = { approve: "approved", reject: "rejected", withdraw: "canceled" }[match[2]];
        return json(response, 200, { item });
      }
    }
  }
  if (scenario.startsWith("employee-ux") && route === "GET /__employee-writes") return json(response, 200, employeeWrites);
  if (scenario.startsWith("employee-ux") && route === "POST /api/v1/employees/batch") {
    let text = ""; for await (const chunk of request) text += chunk;
    if (scenario === "employee-ux-no-save") return json(response, 403, { detail: "저장 권한이 없습니다." });
    const payload = JSON.parse(text); employeeWrites.push(payload);
    if (rejectNextSave) { rejectNextSave = false; return json(response, 503, { detail: "테스트 저장 실패: 다시 시도해 주세요." }); }
    for (const row of payload.update) { const index = uxEmployees.findIndex((item) => item.id === row.id); if (index >= 0) uxEmployees[index] = { ...uxEmployees[index], ...row }; }
    uxEmployees = uxEmployees.filter((row) => !payload.delete.includes(row.id));
    for (const row of payload.insert) { const id = Math.max(0, ...uxEmployees.map((item) => item.id)) + 1; uxEmployees.push({ ...row, id, employee_no: `EMP-00${id}`, login_id: `employee-${id}`, department_name: "테스트 부서", is_active: true }); }
    return json(response, 200, { inserted_count: payload.insert.length, updated_count: payload.update.length, deleted_count: payload.delete.length });
  }
  if (scenario === "checklist-layout" && request.method === "POST" && url.pathname === "/api/v1/hr/retire/checklist") {
    if (!request.headers.authorization?.startsWith("Bearer ")) return json(response, 401, { detail: "Not authenticated." });
    let text = "";
    for await (const part of request) text += part;
    const created = { ...JSON.parse(text), id: checklistRows.length + 1, created_at: "2026-09-13T00:00:00Z", updated_at: "2026-09-13T00:00:00Z" };
    checklistRows.push(created);
    return json(response, 201, created);
  }
  if (scenario === "hri-tasks" && route === "GET /__task-actions") return json(response, 200, taskActions);
  if (scenario === "hri-tasks" && route === "GET /__hri-request-writes") return json(response, 200, hriRequestWrites);
  if (scenario === "hri-tasks" && url.pathname.startsWith("/api/v1/hri/")) {
    if (!request.headers.authorization?.startsWith("Bearer ")) return json(response, 401, { detail: "Not authenticated." });
    if (route === "GET /api/v1/hri/form-types") return json(response, 200, { items: [{
      id: 11, form_code: "GENERIC_REQUEST", form_name_ko: "일반 신청", module_code: "HRI",
      is_active: true, allow_draft: false, allow_withdraw: true, requires_receive: false, default_priority: 1,
    }], total_count: 1 });
    if (route === "GET /api/v1/hri/requests/my") return json(response, 200, { items: hriRequests, total_count: hriRequests.length, page: 1, limit: 50 });
    if (request.method === "POST" && ["/api/v1/hri/requests/submit", "/api/v1/hri/requests/draft"].includes(url.pathname)) {
      let body = "";
      for await (const part of request) body += part;
      const payload = JSON.parse(body);
      hriRequestWrites.push({ path: url.pathname, ...payload });
      if (url.pathname.endsWith("/draft")) return json(response, 409, { detail: "Draft is disabled for this form type." });
      if (payload.title.includes("실패")) return json(response, 400, { detail: "결재선 설정을 확인해 주세요." });
      const item = {
        id: 401, request_no: "HRI-401", form_type_id: 11, form_name: "일반 신청", requester_id: 1,
        title: payload.title, content_json: payload.content_json, status_code: "APPROVAL_IN_PROGRESS",
        current_step_order: 1, current_actor_name: "테스트 결재자", submitted_at: "2026-10-15T00:00:00Z",
        completed_at: null, created_at: "2026-10-15T00:00:00Z", updated_at: "2026-10-15T00:00:00Z",
      };
      hriRequests.push(item);
      return json(response, 200, { request_id: item.id, status_code: item.status_code, current_step_order: 1 });
    }
    const match = url.pathname.match(/\/requests\/(\d+)\/(approve|reject|receive-complete|receive-reject)$/);
    if (request.method === "POST" && match) {
      let text = "";
      for await (const part of request) text += part;
      const id = Number(match[1]);
      taskActions.push({ id, action: match[2], ...JSON.parse(text) });
      if (id % 100 === 2 && ["approve", "receive-complete"].includes(match[2])) return json(response, 409, { detail: "현재 처리 차수가 변경되었습니다." });
      if (completedTasks.has(id)) return json(response, 409, { detail: "이미 처리되었습니다." });
      completedTasks.add(id);
      return json(response, 200, { request_id: id, status_code: "COMPLETED" });
    }
    if (request.method === "GET" && /\/tasks\/my-(approvals|receives)$/.test(url.pathname)) {
      const approval = url.pathname.endsWith("my-approvals");
      const base = approval ? 100 : 200;
      const items = [1, 2, 3].filter((n) => !completedTasks.has(base + n)).map((n) => ({
        request_id: base + n, request_no: `DOC-${base + n}`, title: `테스트 신청 ${n}`,
        form_name: "휴가 신청", status_code: approval ? "APPROVAL_IN_PROGRESS" : "RECEIVE_IN_PROGRESS",
        step_type: approval ? "APPROVAL" : "RECEIVE", step_order: 1, requester_id: 1, requested_at: "2026-09-13T00:00:00Z",
      }));
      return json(response, 200, { items, total_count: items.length, page: 1, limit: 50 });
    }
  }
  request.resume();
  switch (route) {
    case "GET /api/v1/tim/attendance-daily":
      return json(response, 200, { items: [], total_count: 0, page: 1, limit: 50 });
    case "GET /health":
      return json(response, 200, { status: "ok", synthetic: true });
    case "GET /api/v1/auth/enter-cds":
      if (scenario === "enter-cds-failure") return json(response, 503, { detail: "Synthetic corporation service unavailable." });
      return json(response, 200, {
        corporations: [{ enter_cd: "VIBE", company_code: "TEST", corporation_name: "테스트 법인", company_logo_url: null }], total_count: 1,
      });
    case "POST /api/v1/auth/login":
      if (scenario === "login-401") return json(response, 401, { detail: "Invalid credentials." });
      if (scenario === "login-429") return json(response, 429, { detail: "Too many authentication requests." }, { "Retry-After": "1" });
      if (scenario === "login-503") return json(response, 503, { detail: "Login service is unavailable." });
      return json(response, 200, loginResponse());
    case "POST /api/v1/auth/refresh":
      return json(response, 200, loginResponse());
    case "GET /api/v1/auth/me":
      return json(response, 200, scenario === "member" ? { ...user, roles: ["employee"] } : user);
    case "GET /api/v1/menus/tree":
      if (scenario === "appraisal-targets") return json(response, 200, { menus: [...menus,
        { id: 90, code: "pap.targets", name: "평가 대상자 관리", path: "/pap/targets", icon: "Users", sort_order: 3, children: [] },
      ] });
      if (scenario === "file-actions") return json(response, 200, { menus: [...menus,
        ...[
          "/payroll/runs", "/payroll/employee-profiles", "/payroll/variable-inputs", "/payroll/payment-schedules",
          "/payroll/gl-accounts", "/payroll/gl-mappings", "/payroll/item-groups", "/payroll/allowance-deduction-items",
          "/payroll/severance-item-rules", "/payroll/codes", "/payroll/tax-rates",
          "/tim/holidays", "/tim/codes", "/tim/work-codes",
        ].map((path, index) => ({ id: 100 + index, code: path.slice(1).replaceAll("/", "."), name: `파일 검증 ${index + 1}`, path, icon: "FileText", sort_order: 3 + index, children: [] })),
      ] });
      if (scenario === "training-applications") return json(response, 200, { menus: [...menus,
        { id: 80, code: "tra.applications", name: "교육 신청 승인 관리", path: "/tra/applications", icon: "FileText", sort_order: 3, children: [] },
        { id: 81, code: "tra.my-applications", name: "나의 교육 신청", path: "/tra/my-applications", icon: "FileText", sort_order: 4, children: [] },
      ] });
      if (scenario.startsWith("employee-ux")) return json(response, 200, { menus: [...menus, { id: 70, code: "hr.employee", name: "사원관리", path: "/hr/employee", icon: "Users", sort_order: 3, children: [] }] });
      if (scenario === "checklist-layout") return json(response, 200, { menus: [...menus,
        { id: 60, code: "hr.retire.checklist", name: "퇴직체크리스트", path: "/hr/retire/checklist", icon: "FileText", sort_order: 3, children: [] },
      ] });
      if (scenario === "retire-layout") return json(response, 200, { menus: [...menus,
        { id: 50, code: "hr.retire.approvals", name: "퇴직승인관리", path: "/hr/retire/approvals", icon: "FileText", sort_order: 3, children: [] },
        { id: 51, code: "tim.status", name: "근태현황", path: "/tim/status", icon: "FileText", sort_order: 4, children: [] },
      ] });
      if (scenario === "retirement-selection") return json(response, 200, { menus: [...menus,
        { id: 50, code: "hr.retire.approvals", name: "퇴직승인관리", path: "/hr/retire/approvals", icon: "FileText", sort_order: 3, children: [] },
        { id: 52, code: "hr.severance.calcs", name: "퇴직금산정", path: "/hr/severance/calcs", icon: "FileText", sort_order: 4, children: [] },
      ] });
      if (scenario === "hri-tasks") return json(response, 200, { menus: [...menus,
        { id: 32, code: "hri.requests.mine", name: "내 신청서", path: "/hri/requests/mine", icon: "FileText", sort_order: 9, children: [] },
        ...["approvals", "receives"].map((kind, index) => ({ id: 30 + index, code: `hri.tasks.${kind}`, name: index ? "수신함" : "결재함", path: `/hri/tasks/${kind}`, icon: "FileText", sort_order: 10 + index, children: [] })),
        { id: 40, code: "tim.attendance-status", name: "근태현황", path: "/tim/status", icon: "FileText", sort_order: 12, children: [] },
      ] });
      return json(response, 200, { menus: scenario === "sidebar-domains" ? [...menus, {
        id: 20, code: "other", name: "다른 업무", path: null, icon: "Folder", sort_order: 3,
        children: [{ id: 21, code: "other.group", name: "다른 그룹", path: null, icon: "Folder", sort_order: 1,
          children: [{ id: 22, code: "other.leaf", name: "다른 화면", path: "/settings/icons", icon: "Folder", sort_order: 1, children: [] }] }],
      }] : menus });
    case "GET /api/v1/menus/actions/current":
      if (scenario === "employee-ux-no-save") return json(response, 200, { menu_code: "hr.employee", path: "/hr/employee", allowed_actions: ["query", "download"], actions: [] });
      return json(response, 200, {
        menu_code: "mng.companies", path: "/mng/companies", allowed_actions: actions,
        actions: actions.map((action_code) => ({ action_code, allowed: true })),
      });
    case "GET /api/v1/employees/me":
      if (scenario === "profile-failure") return json(response, 503, { detail: "프로필 정보를 불러오지 못했습니다." });
      return json(response, 200, { employee: scenario === "empty-profile" ? null : employee });
    case "GET /api/v1/employees":
      if (scenario.startsWith("employee-ux")) {
        const positions = url.searchParams.getAll("positions"), statuses = url.searchParams.getAll("employment_statuses");
        const filtered = uxEmployees.filter((row) => (!url.searchParams.get("name") || row.display_name.includes(url.searchParams.get("name")))
          && (!url.searchParams.get("employee_no") || row.employee_no.includes(url.searchParams.get("employee_no")))
          && (!positions.length || positions.includes(row.position_title))
          && (!statuses.length || statuses.includes(row.employment_status))
          && (!url.searchParams.get("employment_status") || row.employment_status === url.searchParams.get("employment_status"))
          && (!url.searchParams.get("hire_date_to") || row.hire_date.slice(0, 10) <= url.searchParams.get("hire_date_to")));
        return json(response, 200, { employees: filtered, total_count: filtered.length, page: 1, limit: 100 });
      }
      return json(response, 200, { employees: [{ ...employee, department_name: "긴 부서명 테스트 인사운영지원그룹" }], total_count: 1 });
    case "GET /api/v1/employees/departments":
      return json(response, 200, { departments: [{ id: 1, code: "HR", name: "테스트 부서" }] });
    case "GET /api/v1/codes/groups/by-code/POSITION/active":
      return json(response, 200, { options: [{ code: "LEAD", name: "팀장" }, { code: "STAFF", name: "사원" }] });
    case "GET /api/v1/codes/groups/by-code/EMPLOYMENT_STATUS/active":
      return json(response, 200, { options: [{ code: "ACTIVE", name: "재직" }, { code: "LEAVE", name: "휴직" }, { code: "RESIGNED", name: "퇴직" }] });
    case "GET /api/v1/tim/holidays":
      return json(response, 200, { items: [], holidays: [], total_count: 0 });
    case "GET /api/v1/hr/retire/cases":
      return json(response, 200, { items: [{ id: 1, employee_id: 1, employee_no: "TEST-001", employee_name: "테스트 사용자", department_name: "테스트 부서", position_title: "매니저", retire_date: "2026-10-31", reason: "화면 검증용", status: "draft", created_at: "2026-09-13T00:00:00Z" }], total_count: 1, page: 1, limit: 50 });
    case "GET /api/v1/hr/retire/checklist":
      return json(response, 200, { items: checklistRows, total_count: checklistRows.length, page: 1, limit: 50 });
    case "GET /api/v1/hr/retire/cases/1":
      return json(response, 200, { id: 1, employee_id: 1, employee_no: "TEST-001", employee_name: "테스트 사용자", department_name: "테스트 부서", position_title: "매니저", retire_date: "2026-10-31", status: "draft", checklist_items: [], audit_logs: [] });
    case "GET /api/v1/dashboard/summary":
      return json(response, 200, {
        total_employees: 128, total_departments: 8, attendance_present_today: 112,
        attendance_late_today: 3, attendance_absent_today: 2, pending_leave_requests: 4,
      });
    case "GET /api/v1/tim/attendance-daily/today-schedule":
      return json(response, 200, {
        schedule: {
          work_date: new Date().toISOString().slice(0, 10), day_type: "workday", schedule_code: "TEST",
          schedule_name: "테스트 근무", work_start: "09:00", work_end: "18:00", break_minutes: 60,
          work_hours: 8, is_holiday: false, holiday_name: null,
        },
        attendance: null, derived: { is_late: false, overtime_minutes: 0, is_weekend_work: false },
      });
    case "GET /api/v1/mng/companies":
      return json(response, 200, {
        companies: [{
          id: 1, company_code: "TEST", company_name: "테스트 고객사", company_group_code: "TEST-GROUP",
          company_type: "테스트", management_type: null, representative_company: null,
          start_date: "2025-01-06", is_active: true, created_at: "2025-01-06T00:00:00Z", updated_at: "2025-01-06T00:00:00Z",
        }], total_count: 1, page: 1, limit: 100,
      });
    case "GET /api/v1/mng/dev-requests":
    case "GET /api/v1/mng/dev-requests/monthly-summary":
      return json(response, 200, { items: [], total_count: 0 });
    case "GET /api/v1/mng/companies/dropdown":
      return json(response, 200, { companies: [] });
    default:
      return json(response, 404, { detail: "Unsupported synthetic test route." });
  }
}).listen(3101, "127.0.0.1");
