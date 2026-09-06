import { createHmac } from "node:crypto";
import { createServer } from "node:http";

// Synthetic data for local UI tests only. No database, real identity, or production
// authentication guarantees are exercised. Credentials and tokens are never logged.
const scenarios = new Set([
  "default", "login-401", "login-429", "login-503", "enter-cds-failure",
  "profile-failure", "empty-profile", "member",
]);
let scenario = "default";
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
    return json(response, 200, { scenario });
  }
  request.resume();
  switch (route) {
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
      return json(response, 200, { menus });
    case "GET /api/v1/menus/actions/current":
      return json(response, 200, {
        menu_code: "mng.companies", path: "/mng/companies", allowed_actions: actions,
        actions: actions.map((action_code) => ({ action_code, allowed: true })),
      });
    case "GET /api/v1/employees/me":
      if (scenario === "profile-failure") return json(response, 503, { detail: "프로필 정보를 불러오지 못했습니다." });
      return json(response, 200, { employee: scenario === "empty-profile" ? null : employee });
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
