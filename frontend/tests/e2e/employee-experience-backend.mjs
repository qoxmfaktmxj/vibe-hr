import { createHmac } from "node:crypto";
import { createServer } from "node:http";

// Synthetic data for local UI tests only. No database, real identity, or production
// authentication guarantees are exercised. Credentials and tokens are never logged.
const scenarios = new Set([
  "default", "login-401", "login-429", "login-503", "enter-cds-failure",
  "profile-failure", "empty-profile", "member", "sidebar-domains", "hri-tasks", "retire-layout",
]);
let scenario = "default";
const completedTasks = new Set();
const taskActions = [];
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
    completedTasks.clear();
    taskActions.length = 0;
    return json(response, 200, { scenario });
  }
  if (scenario === "hri-tasks" && route === "GET /__task-actions") return json(response, 200, taskActions);
  if (scenario === "hri-tasks" && url.pathname.startsWith("/api/v1/hri/")) {
    if (!request.headers.authorization?.startsWith("Bearer ")) return json(response, 401, { detail: "Not authenticated." });
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
      if (scenario === "retire-layout") return json(response, 200, { menus: [...menus,
        { id: 50, code: "hr.retire.approvals", name: "퇴직승인관리", path: "/hr/retire/approvals", icon: "FileText", sort_order: 3, children: [] },
        { id: 51, code: "tim.status", name: "근태현황", path: "/tim/status", icon: "FileText", sort_order: 4, children: [] },
      ] });
      if (scenario === "hri-tasks") return json(response, 200, { menus: [...menus,
        ...["approvals", "receives"].map((kind, index) => ({ id: 30 + index, code: `hri.tasks.${kind}`, name: index ? "수신함" : "결재함", path: `/hri/tasks/${kind}`, icon: "FileText", sort_order: 10 + index, children: [] })),
        { id: 40, code: "tim.attendance-status", name: "근태현황", path: "/tim/status", icon: "FileText", sort_order: 12, children: [] },
      ] });
      return json(response, 200, { menus: scenario === "sidebar-domains" ? [...menus, {
        id: 20, code: "other", name: "다른 업무", path: null, icon: "Folder", sort_order: 3,
        children: [{ id: 21, code: "other.group", name: "다른 그룹", path: null, icon: "Folder", sort_order: 1,
          children: [{ id: 22, code: "other.leaf", name: "다른 화면", path: "/settings/icons", icon: "Folder", sort_order: 1, children: [] }] }],
      }] : menus });
    case "GET /api/v1/menus/actions/current":
      return json(response, 200, {
        menu_code: "mng.companies", path: "/mng/companies", allowed_actions: actions,
        actions: actions.map((action_code) => ({ action_code, allowed: true })),
      });
    case "GET /api/v1/employees/me":
      if (scenario === "profile-failure") return json(response, 503, { detail: "프로필 정보를 불러오지 못했습니다." });
      return json(response, 200, { employee: scenario === "empty-profile" ? null : employee });
    case "GET /api/v1/employees":
      return json(response, 200, { employees: [{ ...employee, department_name: "긴 부서명 테스트 인사운영지원그룹" }], total_count: 1 });
    case "GET /api/v1/hr/retire/cases":
      return json(response, 200, { items: [{ id: 1, employee_id: 1, employee_no: "TEST-001", employee_name: "테스트 사용자", department_name: "테스트 부서", position_title: "매니저", retire_date: "2026-10-31", reason: "화면 검증용", status: "draft", created_at: "2026-09-13T00:00:00Z" }], total_count: 1, page: 1, limit: 50 });
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
