import { expect, test, type Locator, type Page } from "@playwright/test";

async function capture(page: Page, filename: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations()
      .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
      .map((animation) => animation.finished.catch(() => undefined)));
  });
  await page.mouse.move(0, 0);

  // Preserve evidence of the UI under test without asking Chromium to composite
  // the login page's decorative, continuously-rendered WebGL backdrop.
  let evidence: Locator;
  if (new URL(page.url()).pathname === "/login") {
    evidence = page.locator('[data-slot="card"]');
  } else {
    const dialog = page.getByRole("dialog");
    evidence = await dialog.count() > 0 ? dialog : page.getByRole("main");
  }

  await evidence.screenshot({ path: test.info().outputPath(filename) });
}

// These tests exercise the real Next UI/BFF with synthetic backend responses.
// They do not replace the Spring authentication or authorization test suites.
async function signIn(page: Page) {
  // Authentication and shell flows validate the reduced-motion fallback. The
  // dedicated scene cases below retain coverage for animated WebGL behavior.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await page.getByLabel("아이디", { exact: true }).fill("admin");
  await page.getByLabel("비밀번호", { exact: true }).fill("admin");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function openProfile(page: Page) {
  const trigger = page.getByRole("button", { name: "내 계정 메뉴", exact: true });
  if (await trigger.getAttribute("aria-expanded") !== "true") await trigger.click();
  await page.getByRole("button", { name: "내 정보", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

test.beforeEach(async ({ request }) => {
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "default" } });
});

test.describe("login before hydration", () => {
  test.use({ javaScriptEnabled: false });

  test("native login submission keeps credentials out of the URL", async ({ page }) => {
    await page.route("**/login*", async (route) => {
      const submission = route.request();
      const url = new URL(submission.url());
      if (submission.method() === "POST" || url.searchParams.has("password")) {
        await route.fulfill({ contentType: "text/html", body: "Native submission captured." });
        return;
      }
      await route.continue();
    });
    await page.goto("/login");
    await page.getByLabel("아이디", { exact: true }).fill("native-fixture");
    await page.getByLabel("비밀번호", { exact: true }).fill("native-fixture-password");
    const submitted = page.waitForRequest((request) => request.isNavigationRequest()
      && (request.method() === "POST" || new URL(request.url()).searchParams.has("password")));
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    const submission = await submitted;
    expect(submission.method()).toBe("POST");
    const query = new URL(submission.url()).searchParams;
    expect(query.has("password")).toBe(false);
    expect(query.has("loginId")).toBe(false);
  });
});

test("month-close routes retain the shell, menu, tabs and home navigation", async ({ page, request }) => {
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "production-repairs" } });
  await signIn(page);
  for (const [path, label] of [["/tim/month-close", "근태 월마감"], ["/tim/month-closing", "월마감 관리"]]) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("button", { name: "내 계정 메뉴", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "업무 영역", exact: true })).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "열린 업무", exact: true });
    await expect(tabs.getByRole("button", { name: label, exact: true })).toBeVisible();
    await expect(page.getByRole("main")).toContainText("근태 월마감");
    await capture(page, `${path.split("/").at(-1)}-shell-korean.png`);
    await page.getByRole("row").filter({ hasText: `${new Date().getFullYear()}년 1월` }).getByRole("button", { name: "마감", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder("마감 사유 또는 메모")).toBeVisible();
    await expect(dialog.locator("p p, p div")).toHaveCount(0);
    await capture(page, `${path.split("/").at(-1)}-confirmation-korean.png`);
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    await expect(dialog).toBeHidden();
    await tabs.getByRole("button", { name: "홈", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  }
});

test("HR basic search reaches employees beyond the first page and keeps selection across stale queries", async ({ page, request }) => {
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "production-repairs" } });
  const queries: URL[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/employees") queries.push(url);
  });
  await signIn(page);
  await page.goto("/hr/basic");
  const search = page.getByPlaceholder("사번/이름 검색", { exact: true });
  await search.fill("120");
  await page.getByRole("button", { name: "검색대상직원 EMP-120", exact: true }).click();
  await expect(search).toHaveValue("");
  const header = search.locator('xpath=ancestor::*[@data-slot="card"]');
  await expect(header).toContainText("검색대상직원");
  await expect(header).toContainText("사번 EMP-120");
  await search.fill("대상");
  await expect(page.getByRole("button", { name: "검색대상직원 EMP-120", exact: true })).toBeVisible();
  await search.clear();
  await expect(header).toContainText("검색대상직원");

  let releaseOldQuery!: () => void;
  const oldQueryDelay = new Promise<void>((resolve) => { releaseOldQuery = resolve; });
  let delayedRequests = 0;
  const oldResponses = Promise.all(["name", "employee_no"].map((field) => page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/employees" && url.searchParams.get(field) === "늦은";
  })));
  await page.route("**/api/employees?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("name") === "늦은" || url.searchParams.get("employee_no") === "늦은") {
      delayedRequests += 1;
      await oldQueryDelay;
    }
    await route.continue();
  });
  await search.fill("늦은");
  try {
    await expect.poll(() => delayedRequests).toBe(2);
    await search.fill("검색대상");
    await expect(page.getByRole("button", { name: "검색대상직원 EMP-120", exact: true })).toBeVisible();
    await expect(header).toContainText("사번 EMP-120");
  } finally {
    releaseOldQuery();
  }
  await oldResponses;
  await expect(page.getByRole("button", { name: "늦은검색직원 EMP-120-ALT", exact: true })).toHaveCount(0);
  await search.clear();
  await expect(header).toContainText("검색대상직원");
  await capture(page, "hr-basic-selected-employee-korean.png");
  const filteredQueries = queries.filter((url) => url.searchParams.has("name") || url.searchParams.has("employee_no"));
  expect(filteredQueries.some((url) => url.searchParams.get("name") === "대상")).toBe(true);
  expect(filteredQueries.some((url) => url.searchParams.get("employee_no") === "120")).toBe(true);
  for (const url of queries) {
    expect(url.searchParams.get("all")).not.toBe("true");
    expect(Number(url.searchParams.get("limit"))).toBeGreaterThan(0);
    expect(Number(url.searchParams.get("limit"))).toBeLessThanOrEqual(100);
    expect(url.searchParams.has("name") && url.searchParams.has("employee_no")).toBe(false);
  }
});

test("HR basic deep links select the exact employee number from bounded partial matches", async ({ page, request }) => {
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "production-repairs" } });
  const lookup = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/employees" && url.searchParams.get("employee_no") === "EMP-120";
  });
  await signIn(page);
  await page.goto("/hr/basic?employeeNo=EMP-120");
  const header = page.getByPlaceholder("사번/이름 검색", { exact: true }).locator('xpath=ancestor::*[@data-slot="card"]');
  await expect(header).toContainText("검색대상직원");
  await expect(header).toContainText("사번 EMP-120");
  const query = new URL((await lookup).url()).searchParams;
  expect(query.get("all")).not.toBe("true");
  expect(Number(query.get("limit"))).toBeGreaterThan(0);
  expect(Number(query.get("limit"))).toBeLessThanOrEqual(100);
});

test("HR basic exact lookup checks later bounded pages after one hundred partial matches", async ({ page, request }) => {
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "production-repairs" } });
  const lookups: URL[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/employees" && url.searchParams.get("employee_no") === "PAGE-EXACT") lookups.push(url);
  });
  await signIn(page);
  await page.goto("/hr/basic?employeeNo=PAGE-EXACT");
  const header = page.getByPlaceholder("사번/이름 검색", { exact: true }).locator('xpath=ancestor::*[@data-slot="card"]');
  await expect(header).toContainText("다음페이지직원");
  await expect(header).toContainText("사번 PAGE-EXACT");
  expect(lookups.map((url) => url.searchParams.get("page"))).toEqual(["1", "2"]);
  for (const url of lookups) {
    expect(url.searchParams.get("limit")).toBe("100");
    expect(url.searchParams.get("all")).not.toBe("true");
  }
});

test("HR basic exact lookup stops after exhausting partial matches without selecting another employee", async ({ page, request }) => {
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "production-repairs" } });
  const lookups: URL[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/employees" && url.searchParams.get("employee_no") === "PAGE-") lookups.push(url);
  });
  await signIn(page);
  await page.goto("/hr/basic?employeeNo=PAGE-");
  await expect.poll(() => lookups.map((url) => url.searchParams.get("page"))).toEqual(["1", "2"]);
  const header = page.getByPlaceholder("사번/이름 검색", { exact: true }).locator('xpath=ancestor::*[@data-slot="card"]');
  await expect(header).toContainText("사번 -");
  await expect(header).not.toContainText("부분일치직원");
});

test("leave approval initially requests pending rows and all statuses includes cancelled rows", async ({ page, request }) => {
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "production-repairs" } });
  await signIn(page);
  const initialQuery = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/tim/leave-requests");
  await page.goto("/tim/leave-approval");
  expect(new URL((await initialQuery).url()).searchParams.get("status")).toBe("pending");
  const grid = page.getByRole("grid");
  await expect(grid).toContainText("대기 중인 합성 요청");
  await expect(grid).not.toContainText("취소된 합성 요청");
  await expect(page.getByRole("combobox")).toHaveValue("pending");
  await page.getByRole("combobox").selectOption({ label: "전체 상태" });
  await page.getByRole("button", { name: "조회", exact: true }).first().click();
  await expect(grid).toContainText("대기 중인 합성 요청");
  await expect(grid).toContainText("취소된 합성 요청");
  await capture(page, "leave-approval-all-statuses-korean.png");
});

test("leave approval row buttons reject and approve the clicked pending request exactly once", async ({ page, request }) => {
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "production-repairs" } });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await signIn(page);
  await page.goto("/tim/leave-approval");
  await expect(page.getByRole("grid")).toContainText("대기 중인 합성 요청");
  await page.getByPlaceholder("반려 사유 기본값", { exact: true }).fill("로컬 반려 확인");
  for (const [id, action, label, reason] of [
    [201, "reject", "반려", "대기 중인 합성 요청"],
    [203, "approve", "승인", "다른 대기 합성 요청"],
  ] as const) {
    await page.locator(".ag-body-horizontal-scroll-viewport").evaluate((element) => { element.scrollLeft = element.scrollWidth; });
    const row = page.getByRole("row").filter({ hasText: reason });
    const button = row.getByRole("button", { name: label, exact: true });
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    await expect(button).toBeInViewport();
    expect(await button.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2) === element;
    })).toBe(true);
    const bounds = await button.boundingBox();
    expect(bounds).not.toBeNull();
    const response = page.waitForResponse((response) => new URL(response.url()).pathname === `/api/tim/leave-requests/${id}/${action}`
      && response.request().method() === "POST", { timeout: 10_000 });
    // One pointer gesture also detects a cell being replaced between pointerdown
    // and click, without locator retries masking an initial no-op.
    await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
    expect((await response).status()).toBe(200);
    await expect(row).toHaveCount(0);
  }
  expect(await (await request.get("http://127.0.0.1:3101/__leave-approval-actions")).json()).toEqual([
    { id: 201, action: "reject", method: "POST", body: { reason: "로컬 반려 확인" } },
    { id: 203, action: "approve", method: "POST", body: { reason: null } },
  ]);
  await page.getByRole("combobox").selectOption({ label: "전체 상태" });
  await page.getByRole("button", { name: "조회", exact: true }).first().click();
  await expect(page.getByRole("row").filter({ hasText: "대기 중인 합성 요청" }).locator('[col-id="request_status"]')).toHaveText("반려");
  await expect(page.getByRole("row").filter({ hasText: "다른 대기 합성 요청" }).locator('[col-id="request_status"]')).toHaveText("승인");
  expect(pageErrors).toEqual([]);
  await capture(page, "leave-approval-row-actions-korean.png");
});

test("pending leave cancellation requires in-app confirmation and sends one request while busy", async ({ page, request }) => {
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "production-repairs" } });
  const nativeDialogs: string[] = [];
  page.on("dialog", (dialog) => { nativeDialogs.push(dialog.message()); void dialog.dismiss(); });
  await signIn(page);
  await page.goto("/tim/leave-request");
  const pending = page.getByRole("row").filter({ hasText: "대기 중인 합성 휴가" });
  await expect(page.getByRole("row").filter({ hasText: "승인된 합성 휴가" }).getByRole("button", { name: "취소", exact: true })).toHaveCount(0);
  await expect(page.getByRole("row").filter({ hasText: "취소된 합성 휴가" }).getByRole("button", { name: "취소", exact: true })).toHaveCount(0);
  await pending.getByRole("button", { name: "취소", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "해당 신청을 취소할까요?", exact: true });
  await expect(confirmation).toBeVisible();
  expect(await (await request.get("http://127.0.0.1:3101/__leave-cancellations")).json()).toEqual([]);
  await confirmation.getByRole("button", { name: "취소", exact: true }).click();
  await expect(confirmation).toBeHidden();
  await pending.getByRole("button", { name: "취소", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  expect(await (await request.get("http://127.0.0.1:3101/__leave-cancellations")).json()).toEqual([]);

  let cancelRequests = 0;
  let releaseCancel!: () => void;
  const cancelDelay = new Promise<void>((resolve) => { releaseCancel = resolve; });
  await page.route("**/api/tim/leave-requests/201/cancel", async (route) => {
    cancelRequests += 1;
    await cancelDelay;
    await route.continue();
  });
  await pending.getByRole("button", { name: "취소", exact: true }).click();
  await confirmation.getByRole("button", { name: "확인", exact: true }).click();
  try {
    await expect.poll(() => cancelRequests).toBe(1);
    await expect(confirmation.getByRole("button", { name: "처리 중...", exact: true })).toBeDisabled();
    await expect(confirmation.getByRole("button", { name: "취소", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(confirmation).toBeVisible();
    await confirmation.screenshot({ path: test.info().outputPath("leave-cancel-confirmation-korean.png") });
    expect(cancelRequests).toBe(1);
  } finally {
    releaseCancel();
  }
  await expect(confirmation).toBeHidden();
  await expect(pending).toContainText("cancelled");
  await expect(pending.getByRole("button", { name: "취소", exact: true })).toHaveCount(0);
  expect(await (await request.get("http://127.0.0.1:3101/__leave-cancellations")).json()).toEqual([
    { id: 201, method: "POST", body: { reason: "사용자 취소" } },
  ]);
  expect(nativeDialogs).toEqual([]);
});

test.describe("Korean business date defaults", () => {
  test.use({ timezoneId: "UTC" });

  test("leave and attendance defaults use the Korea day in a UTC browser", async ({ page, request }) => {
    await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "production-repairs" } });
    await page.clock.setFixedTime(new Date("2026-10-16T15:05:00.000Z"));
    await signIn(page);
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe("UTC");
    await page.goto("/tim/leave-request");
    const leaveDates = page.locator('input[type="date"]');
    await expect(leaveDates).toHaveCount(2);
    await expect(leaveDates.nth(0)).toHaveValue("2026-10-17");
    await expect(leaveDates.nth(1)).toHaveValue("2026-10-17");
    await leaveDates.nth(0).fill("2026-10-20");
    await leaveDates.nth(1).fill("2026-10-21");
    await page.getByPlaceholder("사유", { exact: true }).fill("날짜 유지 확인");
    await expect(leaveDates.nth(0)).toHaveValue("2026-10-20");
    await expect(leaveDates.nth(1)).toHaveValue("2026-10-21");
    await capture(page, "leave-korea-date-defaults.png");

    const queryRequest = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/tim/attendance-daily");
    await page.goto("/tim/status");
    const attendanceDates = page.locator('input[type="date"]');
    await expect(attendanceDates.nth(0)).toHaveValue("2026-10-01");
    await expect(attendanceDates.nth(1)).toHaveValue("2026-10-17");
    const query = new URL((await queryRequest).url()).searchParams;
    expect(query.get("start_date")).toBe("2026-10-01");
    expect(query.get("end_date")).toBe("2026-10-17");
    await capture(page, "attendance-korea-date-defaults.png");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "다운로드", exact: true }).click();
    expect((await download).suggestedFilename()).toBe("attendance-status-2026-10-17.xlsx");
  });
});

test("login has clear company/social labels and accessible password visibility", async ({ page }) => {
  // This checks the form's accessible controls. Keep it independent from the
  // decorative WebGL compositor; scene behavior is exercised below.
  const imageWarnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes('parent element with invalid "position"')) imageWarnings.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await expect(page.getByLabel("회사", { exact: true })).toContainText("테스트 법인");
  await expect(page.getByRole("link", { name: /구글|Google/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /카카오/ })).toBeVisible();
  const password = page.getByLabel("비밀번호", { exact: true });
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: /비밀번호 표시|비밀번호 보기/ }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: /비밀번호 숨기기/ }).click();
  await expect(password).toHaveAttribute("type", "password");
  await capture(page, "login-desktop.png");
  expect(imageWarnings).toEqual([]);
});

for (const [scenario, guidance] of [
  ["login-401", /아이디.*비밀번호|회사.*확인/],
  ["login-429", /잠시|너무|여러 번/],
  ["login-503", /서비스|서버|연결/],
] as const) {
  test(`${scenario} gives relevant recovery guidance and keeps the form usable`, async ({ page, request }) => {
    await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario } });
    await page.goto("/login");
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: guidance })).toBeVisible();
    await expect(page.getByRole("button", { name: "로그인", exact: true })).toBeEnabled();
    await expect(page.getByLabel("아이디", { exact: true })).toHaveValue("admin");
  });
}

test("network failure offers retry without clearing entered credentials", async ({ page }) => {
  await page.goto("/login");
  await page.route("**/api/auth/login", (route) => route.abort("failed"));
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /연결|네트워크|인터넷/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인", exact: true })).toBeEnabled();
});

test("company service failure is visible and can be retried", async ({ page, request }) => {
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "enter-cds-failure" } });
  await page.goto("/login");
  await expect(page.getByRole("status").filter({ hasText: /회사|법인/ })).toBeVisible();
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "default" } });
  await page.getByRole("button", { name: /다시.*불러|다시.*시도|재시도/ }).click();
  await expect(page.getByLabel("회사", { exact: true })).toContainText("테스트 법인");
});

test("profile groups employee information, traps focus and restores the account trigger", async ({ page }) => {
  await signIn(page);
  await capture(page, "shell-desktop.png");
  await openProfile(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("테스트 부서");
  await expect(dialog).toContainText("TEST-001");
  await expect(dialog).toContainText("매니저");
  await capture(page, "profile-desktop.png");
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press("Tab");
    await expect.poll(() => dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "내 계정 메뉴", exact: true })).toBeFocused();
});

test("profile error supports recovery in place", async ({ page, request }) => {
  await signIn(page);
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "profile-failure" } });
  await openProfile(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("alert")).toBeVisible();
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "default" } });
  await dialog.getByRole("button", { name: /다시|재시도/ }).click();
  await expect(dialog).toContainText("TEST-001");
  await expect(dialog.getByRole("alert")).toBeHidden();
});

test("empty employee profile explains missing registration without inventing values", async ({ page, request }) => {
  await signIn(page);
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "empty-profile" } });
  await openProfile(page);
  await expect(page.getByRole("dialog")).toContainText(/등록|연결|없습니다/);
  await expect(page.getByRole("dialog")).not.toContainText("TEST-001");
});

test("appearance changes apply, persist and can be cancelled", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "내 계정 메뉴", exact: true }).click();
  await page.getByRole("button", { name: "화면 설정", exact: true }).click();
  const appearance = page.getByRole("dialog", { name: "화면 설정", exact: true });
  await appearance.getByRole("button", { name: /다크모드/ }).click();
  await appearance.getByRole("button", { name: "확인", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "내 계정 메뉴", exact: true }).click();
  await page.getByRole("button", { name: "화면 설정", exact: true }).click();
  await appearance.getByRole("button", { name: /다크모드/ }).click();
  await appearance.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.keyboard.press("Escape");
  await openProfile(page);
  await expect(page.getByRole("dialog")).toContainText("TEST-001");
  await capture(page, "profile-dark.png");
});

test("help is reachable by keyboard and explains tabs and session renewal", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "내 계정 메뉴", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "이용 안내", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "VIBE-HR 이용 안내" });
  await expect(dialog).toContainText("Shift + F10");
  await expect(dialog).toContainText("로그인 시간 연장");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "내 계정 메뉴", exact: true })).toBeFocused();
});

test("session renewal failure is reported without pretending success", async ({ page }) => {
  await signIn(page);
  const renewal = page.getByRole("button", { name: /로그인 시간 연장/ });
  await expect(renewal).toBeEnabled();
  await page.route("**/api/auth/refresh", (route) => route.fulfill({ status: 503, json: { detail: "Synthetic unavailable" } }));
  await renewal.click();
  await expect(page.getByRole("alert").filter({ hasText: "연장하지 못했습니다" })).toBeVisible();
  await page.unroute("**/api/auth/refresh");
  await renewal.click();
  await expect(page.getByRole("alert").filter({ hasText: "연장하지 못했습니다" })).toBeHidden();
});

test("existing business grid and tab context menu retain navigation behavior", async ({ page }) => {
  await signIn(page);
  await page.goto("/mng/companies");
  await expect(page.getByRole("heading", { name: "고객사관리", exact: true })).toBeVisible();
  await expect(page.getByRole("grid")).toBeVisible();
  await expect(page.getByRole("grid")).toContainText("테스트 고객사");
  await capture(page, "business-grid.png");
  const tabs = page.getByRole("navigation", { name: "열린 업무" });
  const companyTab = tabs.getByRole("button", { name: "고객사관리", exact: true });
  await expect(companyTab).toHaveAttribute("aria-current", "page");
  await companyTab.focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menu", { name: "탭 관리 메뉴" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "좌측 탭 모두 닫기" })).toBeDisabled();
  await expect(page.getByRole("menuitem", { name: "우측 탭 모두 닫기" })).toBeDisabled();
  await page.keyboard.press("End");
  await expect(page.getByRole("menuitem", { name: "전체 탭 닫기 (홈 이동)" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(tabs.getByRole("button", { name: "고객사관리", exact: true })).toHaveCount(0);
});

test("mobile login, menu and profile fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "로그인", exact: true })).toBeInViewport();
  await expect(page.getByLabel("회사", { exact: true })).toContainText("테스트 법인");
  await capture(page, "login-mobile.png");
  await signIn(page);
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await capture(page, "navigation-mobile.png");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("button", { name: "메뉴 열기" })).toBeFocused();
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /내 정보 보기/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.getByRole("dialog")).toContainText("TEST-001");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "메뉴 열기" })).toBeFocused();
  await openProfile(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("TEST-001");
  await expect.poll(async () => (await dialog.boundingBox())?.x ?? -1).toBeGreaterThanOrEqual(0);
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.width).toBeLessThanOrEqual(390);
  expect(box!.height).toBeLessThanOrEqual(844);
  await capture(page, "profile-mobile.png");
  await page.setViewportSize({ width: 390, height: 500 });
  await expect.poll(async () => (await dialog.boundingBox())?.height ?? 999).toBeLessThanOrEqual(500);
  const shortBox = await dialog.boundingBox();
  expect(shortBox!.height).toBeLessThanOrEqual(500);
  await dialog.getByText("사용 가능", { exact: true }).scrollIntoViewIfNeeded();
  await expect(dialog.getByText("사용 가능", { exact: true })).toBeInViewport();
  await dialog.getByText("재직", { exact: true }).scrollIntoViewIfNeeded();
  await expect(dialog.getByText("재직", { exact: true })).toBeInViewport();
  await expect(dialog.getByRole("button", { name: "프로필 닫기" })).toBeInViewport();
  await capture(page, "profile-short.png");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("reduced-motion preference leaves login and profile immediately usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page);
  await openProfile(page);
  const motion = await page.getByRole("dialog").evaluate((node) => {
    const style = getComputedStyle(node);
    return { animation: style.animationName, duration: style.animationDuration };
  });
  expect(motion.animation === "none" || parseFloat(motion.duration) <= 0.01).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("logout returns to login through the real BFF cookie lifecycle", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "내 계정 메뉴", exact: true }).click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect.poll(async () => (await page.context().cookies()).some((cookie) => cookie.name === "vibe_hr_token")).toBe(false);
});

test("regular members keep account access without administrator switching", async ({ page, request }) => {
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "member" } });
  await signIn(page);
  await expect(page.getByRole("button", { name: "다른 사용자로 로그인" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "내 계정 메뉴", exact: true })).toBeVisible();
  await openProfile(page);
  await expect(page.getByRole("dialog")).toContainText("구성원");
});

test("account switching clears previous tabs and reloads the current member profile", async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "account-switch" } });
  await signIn(page);
  await page.goto("/mng/companies");
  const tabs = page.getByRole("navigation", { name: "열린 업무" });
  await expect(tabs.getByRole("button", { name: "고객사관리", exact: true })).toBeVisible();
  await openProfile(page);
  await expect(page.getByRole("dialog")).toContainText("TEST-001");
  await page.getByRole("button", { name: "프로필 닫기", exact: true }).click();
  await page.getByRole("button", { name: "다른 사용자로 로그인", exact: true }).click();
  await page.getByRole("group", { name: "전환할 사용자" }).getByRole("button", { name: /전환 구성원/ }).click();
  await page.getByRole("button", { name: "전환", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("button", { name: "다른 사용자로 로그인", exact: true })).toHaveCount(0);
  await expect(tabs.getByRole("button", { name: "고객사관리", exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("vibe_hr_open_tabs") ?? "[]"))).toEqual([]);
  await openProfile(page);
  await expect(page.getByRole("dialog")).toContainText("TEST-002");
  await expect(page.getByRole("dialog")).toContainText("전환 구성원");
  await expect(page.getByRole("dialog")).not.toContainText("TEST-001");
  await page.getByRole("button", { name: "프로필 닫기", exact: true }).click();
  await page.reload();
  await expect(tabs.getByRole("button", { name: "고객사관리", exact: true })).toHaveCount(0);
});

test("account switching requires a visible explicit selection after changing the query", async ({ page, request }) => {
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "account-switch" } });
  await signIn(page);
  await page.getByRole("button", { name: "다른 사용자로 로그인", exact: true }).click();
  const candidates = page.getByRole("group", { name: "전환할 사용자", exact: true });
  const switchAccount = page.getByRole("button", { name: "전환", exact: true });
  await candidates.getByRole("button", { name: "이전 구성원 first-member", exact: true }).click();
  await expect(switchAccount).toBeEnabled();
  await page.getByPlaceholder("이름/로그인ID 검색", { exact: true }).fill("second-member");
  await expect(switchAccount).toBeDisabled();
  const target = candidates.getByRole("button", { name: "전환 구성원 second-member", exact: true });
  await expect(target).toBeVisible();
  await expect(target).toHaveAttribute("aria-pressed", "false");
  await expect(candidates.getByRole("button")).toHaveCount(1);
  await expect(switchAccount).toBeDisabled();
  expect(await (await request.get("http://127.0.0.1:3101/__impersonation-logins")).json()).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("account-switch-new-query-korean.png") });
  await target.click();
  await expect(switchAccount).toBeEnabled();
  const switched = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/impersonation/login" && response.request().method() === "POST");
  await switchAccount.click();
  expect((await switched).status()).toBe(200);
  await expect(page.getByRole("button", { name: "내 계정 메뉴", exact: true })).toContainText("전환 구성원");
  await expect(page.getByRole("button", { name: "다른 사용자로 로그인", exact: true })).toHaveCount(0);
  expect(await (await request.get("http://127.0.0.1:3101/__impersonation-logins")).json()).toEqual([{ user_id: 2 }]);
});

test("account switching ignores an older lookup completing after the latest selection", async ({ page, request }) => {
  // Keep the delayed transport alive to exercise stale-response rejection even
  // when cancelling a request cannot prevent its response from arriving.
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => originalFetch(input, typeof input === "string" && input.startsWith("/api/auth/impersonation/users?")
      ? { ...init, signal: undefined } : init);
  });
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "account-switch" } });
  await signIn(page);
  let oldCalls = 0;
  let releaseOldLookup!: () => void;
  const oldLookup = new Promise<void>((resolve) => { releaseOldLookup = resolve; });
  await page.route("**/api/auth/impersonation/users?**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("query") === "first-member") {
      oldCalls += 1;
      await oldLookup;
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "다른 사용자로 로그인", exact: true }).click();
  const candidates = page.getByRole("group", { name: "전환할 사용자", exact: true });
  await expect(candidates.getByRole("button")).toHaveCount(2);
  const query = page.getByPlaceholder("이름/로그인ID 검색", { exact: true });
  const oldResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/auth/impersonation/users" && url.searchParams.get("query") === "first-member";
  });
  try {
    await query.fill("first-member");
    await expect.poll(() => oldCalls).toBe(1);
    await query.fill("second-member");
    const target = candidates.getByRole("button", { name: "전환 구성원 second-member", exact: true });
    await target.click();
    releaseOldLookup();
    await (await oldResponse).finished();
    await page.screenshot({ path: test.info().outputPath("account-switch-stale-response-korean.png") });
    await expect(target).toBeVisible();
    await expect(target).toHaveAttribute("aria-pressed", "true");
    await expect(candidates.getByRole("button")).toHaveCount(1);
    expect(await (await request.get("http://127.0.0.1:3101/__impersonation-logins")).json()).toEqual([]);
    const switched = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/impersonation/login" && response.request().method() === "POST");
    await page.getByRole("button", { name: "전환", exact: true }).click();
    expect((await switched).status()).toBe(200);
    await expect(page.getByRole("button", { name: "내 계정 메뉴", exact: true })).toContainText("전환 구성원");
    await expect(page.getByRole("button", { name: "다른 사용자로 로그인", exact: true })).toHaveCount(0);
    expect(await (await request.get("http://127.0.0.1:3101/__impersonation-logins")).json()).toEqual([{ user_id: 2 }]);
  } finally {
    releaseOldLookup();
  }
});

test("account switching clears selection for empty queries and cancels closed lookups before reopening", async ({ page, request }) => {
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "account-switch" } });
  await signIn(page);
  const trigger = page.getByRole("button", { name: "다른 사용자로 로그인", exact: true });
  await trigger.click();
  const candidates = page.getByRole("group", { name: "전환할 사용자", exact: true });
  const query = page.getByPlaceholder("이름/로그인ID 검색", { exact: true });
  const switchAccount = page.getByRole("button", { name: "전환", exact: true });
  await query.fill("second-member");
  await candidates.getByRole("button", { name: "전환 구성원 second-member", exact: true }).click();
  await expect(switchAccount).toBeEnabled();
  await query.clear();
  await expect(candidates.getByRole("button")).toHaveCount(2);
  await expect(candidates.getByRole("button", { pressed: true })).toHaveCount(0);
  await expect(switchAccount).toBeDisabled();
  await query.fill("missing-member");
  await expect(candidates).toContainText("검색 결과가 없습니다.");
  await expect(switchAccount).toBeDisabled();

  let delayedCalls = 0;
  let aborted = false;
  let releaseClosedLookup!: () => void;
  const closedLookup = new Promise<void>((resolve) => { releaseClosedLookup = resolve; });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/auth/impersonation/users" && url.searchParams.get("query") === "first-member") aborted = true;
  });
  await page.route("**/api/auth/impersonation/users?**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("query") === "first-member" && ++delayedCalls === 1) {
      await closedLookup;
      await route.fulfill({ status: 200, json: { users: [{ id: 3, display_name: "지연된 이전 구성원", login_id: "first-member" }] } }).catch(() => undefined);
      return;
    }
    await route.continue();
  });
  try {
    await query.fill("first-member");
    await expect.poll(() => delayedCalls).toBe(1);
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect.poll(() => aborted).toBe(true);
    await trigger.click();
    await expect(candidates.getByRole("button", { name: "이전 구성원 first-member", exact: true })).toBeVisible();
    releaseClosedLookup();
    await expect(candidates).not.toContainText("지연된 이전 구성원");
    await expect(candidates.getByRole("button", { pressed: true })).toHaveCount(0);
    await expect(switchAccount).toBeDisabled();
    expect(await (await request.get("http://127.0.0.1:3101/__impersonation-logins")).json()).toEqual([]);
  } finally {
    releaseClosedLookup();
  }
});

test("sidebar group and panel collapse hide links from keyboard navigation", async ({ page }) => {
  await signIn(page);
  await page.goto("/mng/companies");
  const group = page.getByRole("button", { name: "기본 관리", exact: true });
  const companyLink = page.locator('a[href="/mng/companies"]');
  await expect(companyLink).toBeInViewport();
  await group.click();
  await expect(companyLink).not.toBeInViewport();
  await group.focus();
  await page.keyboard.press("Tab");
  await expect(companyLink).not.toBeFocused();
  await group.click();
  await expect(companyLink).toBeInViewport();
  await page.getByRole("button", { name: "세부 메뉴 접기", exact: true }).click();
  await expect(companyLink).not.toBeInViewport();
  await page.keyboard.press("Tab");
  await expect(companyLink).not.toBeFocused();
  await page.getByRole("button", { name: "세부 메뉴 펼치기", exact: true }).click();
  await expect(companyLink).toBeInViewport();
});

test("tab context dismissal respects outside clicks and sequential keyboard focus", async ({ page }) => {
  await signIn(page);
  await page.goto("/mng/companies");
  const companyTab = page.getByRole("navigation", { name: "열린 업무" }).getByRole("button", { name: "고객사관리", exact: true });
  const search = page.getByPlaceholder("회사명", { exact: true });
  await companyTab.focus();
  await page.keyboard.press("Shift+F10");
  await search.click();
  await expect(search).toBeFocused();
  await expect(page.getByRole("menu", { name: "탭 관리 메뉴" })).toBeHidden();
  await companyTab.focus();
  await page.keyboard.press("Shift+F10");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "고객사관리 탭 닫기" })).toBeFocused();
  await companyTab.focus();
  await page.keyboard.press("Shift+F10");
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("navigation", { name: "열린 업무" }).getByRole("button", { name: "홈", exact: true })).toBeFocused();
});

test("sidebar profile returns focus to its own trigger", async ({ page }) => {
  await signIn(page);
  const trigger = page.getByRole("button", { name: "내 정보 보기", exact: true });
  await trigger.click();
  await expect(page.getByRole("dialog")).toContainText("재직 상태");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("closing a delayed profile retry aborts it before reopening", async ({ page }) => {
  await signIn(page);
  let calls = 0;
  let aborted = false;
  let releaseRetry!: () => void;
  const delayed = new Promise<void>((resolve) => { releaseRetry = resolve; });
  page.on("requestfailed", (request) => {
    if (request.url().endsWith("/api/employees/me")) aborted = true;
  });
  await page.route("**/api/employees/me", async (route) => {
    calls += 1;
    if (calls === 1) return route.fulfill({ status: 503, json: { detail: "Synthetic failure" } });
    if (calls === 2) {
      await delayed;
      await route.fulfill({ status: 200, json: { employee: { display_name: "지연된 이전 응답" } } }).catch(() => undefined);
      return;
    }
    await route.continue();
  });
  try {
    await openProfile(page);
    await page.getByRole("dialog").getByRole("button", { name: /다시 시도/ }).click();
    await expect.poll(() => calls).toBe(2);
    await expect(page.getByRole("dialog").getByRole("status")).toContainText("프로필을 불러오는 중입니다");
    await page.keyboard.press("Escape");
    await expect.poll(() => aborted).toBe(true);
    await openProfile(page);
    await expect(page.getByRole("dialog")).toContainText("TEST-001");
    releaseRetry();
    await expect(page.getByRole("dialog")).not.toContainText("지연된 이전 응답");
  } finally {
    releaseRetry();
  }
});

test("reduced motion also stops login waiting and account popover animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  let releaseLogin!: () => void;
  const delayed = new Promise<void>((resolve) => { releaseLogin = resolve; });
  await page.route("**/api/auth/login", async (route) => { await delayed; await route.continue(); });
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  const status = page.getByRole("status").filter({ hasText: "로그인을 처리하고 있습니다" });
  await expect(status).toBeVisible();
  await expect(status.locator("svg")).toHaveCSS("animation-name", "none");
  releaseLogin();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: "내 계정 메뉴", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "내 계정", exact: true })).toHaveCSS("animation-name", "none");
  await page.getByRole("button", { name: "화면 설정", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "화면 설정", exact: true })).toHaveCSS("animation-name", "none");
});

test("expanding the viewport closes the mobile modal and unlocks business inputs", async ({ page }) => {
  await signIn(page);
  await page.goto("/mng/companies");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const mobileGroup = page.getByRole("dialog").getByRole("button", { name: "기본 관리", exact: true });
  const controlledId = await mobileGroup.getAttribute("aria-controls");
  expect(controlledId).toBeTruthy();
  expect(await page.evaluate((id) => {
    const matching = Array.from(document.querySelectorAll("[id]")).filter((element) => element.id === id);
    return matching.length === 1 && Boolean(matching[0].closest('[role="dialog"]'));
  }, controlledId)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("dialog")).toBeHidden();
  const search = page.getByPlaceholder("회사명", { exact: true });
  await search.click();
  await expect(search).toBeFocused();
});

test("left and right tab cleanup return keyboard focus to the surviving tab", async ({ page }) => {
  await signIn(page);
  for (const side of ["left", "right"] as const) {
    await page.evaluate((direction) => {
      const company = { path: "/mng/companies", label: "고객사관리" };
      const development = { path: "/mng/dev-requests", label: "개발 요청" };
      localStorage.setItem("vibe_hr_open_tabs", JSON.stringify(direction === "left" ? [development, company] : [company, development]));
    }, side);
    await page.goto("/mng/companies");
    const tabs = page.getByRole("navigation", { name: "열린 업무" });
    const company = tabs.getByRole("button", { name: "고객사관리", exact: true });
    await expect(tabs.getByRole("button", { name: "개발 요청", exact: true })).toBeVisible();
    await company.focus();
    await page.keyboard.press("Shift+F10");
    await page.getByRole("menuitem", { name: side === "left" ? "좌측 탭 모두 닫기" : "우측 탭 모두 닫기" }).focus();
    await page.keyboard.press("Enter");
    await expect(tabs.getByRole("button", { name: "개발 요청", exact: true })).toHaveCount(0);
    await expect(company).toBeFocused();
  }
});

test("closing the active page from another tab also selects the retained page", async ({ page }) => {
  await signIn(page);
  for (const side of ["left", "right"] as const) {
    await page.evaluate((direction) => {
      const company = { path: "/mng/companies", label: "고객사관리" };
      const development = { path: "/mng/dev-requests", label: "개발 요청" };
      localStorage.setItem("vibe_hr_open_tabs", JSON.stringify(direction === "left" ? [company, development] : [development, company]));
    }, side);
    await page.goto("/mng/companies");
    const tabs = page.getByRole("navigation", { name: "열린 업무" });
    await tabs.getByRole("button", { name: "개발 요청", exact: true }).focus();
    await page.keyboard.press("Shift+F10");
    await page.getByRole("menuitem", { name: side === "left" ? "좌측 탭 모두 닫기" : "우측 탭 모두 닫기" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/mng\/dev-requests$/);
    await expect(page.getByRole("heading", { name: "추가 개발 관리", exact: true })).toBeVisible();
    await expect(tabs.getByRole("button", { name: "개발 요청", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(tabs.getByRole("button", { name: "고객사관리", exact: true })).toHaveCount(0);
  }
});

test("mobile session expiry has visible renewal text and a spoken warning", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { authenticated: true, remaining_sec: 120, show_countdown: true } }));
  await signIn(page);
  await expect(page.getByRole("button", { name: /로그인 시간 연장/ })).toContainText("지금 연장");
  await expect(page.getByRole("status").filter({ hasText: "3분 안에" })).toHaveText(/작업을 저장하거나 로그인 시간을 연장/);
});

test("session query failure offers retry before renewal is available", async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ status: 503, json: { detail: "Synthetic failure" } }));
  await signIn(page);
  await expect(page.getByRole("alert").filter({ hasText: "로그인 시간을 확인하지 못했습니다" })).toBeVisible();
  const retry = page.getByRole("button", { name: "로그인 시간 다시 확인", exact: true });
  await expect(retry).toBeEnabled();
  await page.unroute("**/api/auth/session");
  await retry.click();
  await expect(page.getByRole("alert").filter({ hasText: "로그인 시간을 확인하지 못했습니다" })).toBeHidden();
  await expect(page.getByRole("button", { name: /로그인 시간 연장/ })).toBeEnabled();
});

test("mobile tabs have an explicit management action", async ({ page }) => {
  await signIn(page);
  await page.goto("/mng/companies");
  await page.setViewportSize({ width: 390, height: 844 });
  const trigger = page.getByRole("button", { name: "고객사관리 탭 관리", exact: true });
  await trigger.click();
  await expect(page.getByRole("menu", { name: "탭 관리 메뉴" })).toBeVisible();
  await page.getByRole("menuitem", { name: "전체 탭 닫기 (홈 이동)" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("successful renewal with a failed time query does not expire the old countdown", async ({ page }) => {
  await page.clock.install();
  let renewed = false;
  let logoutRequests = 0;
  await page.route("**/api/auth/session", (route) => {
    return !renewed
      ? route.fulfill({ json: { authenticated: true, remaining_sec: 60, show_countdown: true } })
      : route.fulfill({ status: 503, json: { detail: "Synthetic query failure" } });
  });
  await page.route("**/api/auth/refresh", (route) => { renewed = true; return route.fulfill({ json: {} }); });
  page.on("request", (request) => { if (request.url().endsWith("/api/auth/logout")) logoutRequests += 1; });
  await signIn(page);
  await page.getByRole("button", { name: /로그인 시간 연장/ }).click();
  await expect(page.getByRole("button", { name: "로그인 시간 다시 확인", exact: true })).toBeEnabled();
  await page.clock.runFor(61_000);
  expect(logoutRequests).toBe(0);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.unroute("**/api/auth/session");
  await page.getByRole("button", { name: "로그인 시간 다시 확인", exact: true }).click();
  await expect(page.getByRole("button", { name: /로그인 시간 연장/ })).toBeEnabled();
});

test("malformed remaining time is recoverable and is not treated as expiration", async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { authenticated: true, remaining_sec: null, show_countdown: true } }));
  await signIn(page);
  await expect(page.getByRole("button", { name: "로그인 시간 다시 확인", exact: true })).toBeEnabled();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("conservatory motion control stays hidden without blocking login", async ({ page }) => {
  await page.goto("/login");
  const scene = page.getByTestId("login-scene");
  await expect(scene).toHaveAttribute("data-ready", "true");
  const first = await scene.getAttribute("data-frame");
  await expect.poll(() => scene.getAttribute("data-frame")).not.toBe(first);
  await expect(page.getByRole("button", { name: "배경 일시 정지", exact: true })).toBeHidden();
  await signIn(page);
});

test("reduced motion keeps the scenic image static and the form usable", async ({ page }) => {
  const textures: string[] = [];
  page.on("request", request => {
    if (request.url().includes("/images/conservatory/")) textures.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  const scene = page.getByTestId("login-scene");
  await expect(scene).toHaveAttribute("data-ready", "false");
  await expect(scene).toHaveAttribute("data-motion", "paused");
  await expect(page.getByRole("button", { name: "배경 일시 정지", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "로그인", exact: true })).toBeEnabled();
  await signIn(page);
  expect(textures).toEqual([]);
});

test("mobile static background uses its own camera framing without downloading the desktop poster", async ({ page }) => {
  const posters: string[] = [];
  page.on("request", request => {
    if (request.url().includes("conservatory-login-")) posters.push(request.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  const background = page.locator('img[src*="conservatory-login"]');
  await expect.poll(() => background.evaluate(node => (node as HTMLImageElement).currentSrc)).toContain("conservatory-login-mobile.webp");
  await background.evaluate(node => (node as HTMLImageElement).decode());
  expect(posters.some(url => url.includes("conservatory-login-desktop"))).toBe(false);
  await expect(page.getByRole("button", { name: "로그인", exact: true })).toBeInViewport();
});

async function sceneHardware(page: Page, renderer: string) {
  await page.addInitScript(rendererName => {
    Object.defineProperty(navigator, "hardwareConcurrency", { value: 12 });
    Object.defineProperty(navigator, "deviceMemory", { value: 8 });
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0 });
    const getParameter = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function (parameter: number) {
      return parameter === 0x9246 ? rendererName : getParameter.call(this, parameter);
    };
  }, renderer);
}

test("Intel integrated graphics uses 450 grass instances", async ({ page }) => {
  await sceneHardware(page, "ANGLE (Intel, Intel UHD Graphics 630)");
  await page.goto("/login");
  const scene = page.getByTestId("login-scene");
  await expect(scene).toHaveAttribute("data-ready", "true");
  await expect(scene).toHaveAttribute("data-grass-count", "450");
});

test("mobile scene uses 450 grass instances even with a powerful GPU", async ({ page }) => {
  await sceneHardware(page, "NVIDIA GeForce RTX 4060");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  const scene = page.getByTestId("login-scene");
  await expect(scene).toHaveAttribute("data-ready", "true");
  await expect(scene).toHaveAttribute("data-grass-count", "450");
});

test("scene waits for its textures while the login form stays usable", async ({ page }) => {
  let releaseTexture!: () => void;
  const textureGate = new Promise<void>(resolve => { releaseTexture = resolve; });
  let textureRequested!: () => void;
  const textureStarted = new Promise<void>(resolve => { textureRequested = resolve; });
  await page.route("**/images/conservatory/rock-normal.webp", async route => {
    textureRequested();
    await textureGate;
    await route.continue();
  });
  try {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await textureStarted;
    const scene = page.getByTestId("login-scene");
    await expect(scene).toHaveAttribute("data-ready", "false");
    await page.getByLabel("아이디", { exact: true }).fill("still-usable");
    await expect(page.getByLabel("아이디", { exact: true })).toHaveValue("still-usable");
    await expect(page.getByRole("button", { name: "로그인", exact: true })).toBeEnabled();
    releaseTexture();
    await expect(scene).toHaveAttribute("data-ready", "true");
  } finally {
    releaseTexture();
  }
});

test("failed scene texture preserves the static background and login", async ({ page }) => {
  await page.route("**/images/conservatory/architecture-gi.webp", route => route.abort("failed"));
  await page.goto("/login");
  await expect(page.getByTestId("login-scene")).toHaveAttribute("data-ready", "false");
  await expect(page.locator('img[src*="conservatory-login"]')).toBeVisible();
  await signIn(page);
});

test("changing the motion preference starts and stops the scene", async ({ page }) => {
  await page.addInitScript(() => {
    const media = "(prefers-reduced-motion: reduce)";
    const nativeMatchMedia = window.matchMedia.bind(window);
    let reduced = true;
    const listeners = new Set<EventListenerOrEventListenerObject>();
    const motionQuery = {
      media,
      get matches() { return reduced; },
      onchange: null,
      addEventListener: (type: string, listener: EventListenerOrEventListenerObject | null) => {
        if (type === "change" && listener) listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject | null) => {
        if (listener) listeners.delete(listener);
      },
      addListener: (listener: EventListenerOrEventListenerObject) => listeners.add(listener),
      removeListener: (listener: EventListenerOrEventListenerObject) => listeners.delete(listener),
      dispatchEvent: () => true,
    } as MediaQueryList;
    window.matchMedia = query => query === media ? motionQuery : nativeMatchMedia(query);
    (window as Window & { setReducedMotionForTest: (value: boolean) => void }).setReducedMotionForTest = value => {
      reduced = value;
      const event = new Event("change");
      listeners.forEach(listener => typeof listener === "function" ? listener.call(motionQuery, event) : listener.handleEvent(event));
    };
  });
  await page.goto("/login");
  const scene = page.getByTestId("login-scene");
  await expect(scene).toHaveAttribute("data-ready", "false");
  await page.evaluate(() => { (window as Window & { setReducedMotionForTest: (value: boolean) => void }).setReducedMotionForTest(false); });
  await expect(scene).toHaveAttribute("data-ready", "true");
  await expect(scene).toHaveAttribute("data-motion", "playing");
  await page.evaluate(() => { (window as Window & { setReducedMotionForTest: (value: boolean) => void }).setReducedMotionForTest(true); });
  await expect(scene).toHaveAttribute("data-motion", "paused");
});

test("scene loads when requestIdleCallback is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "requestIdleCallback", { value: undefined });
  });
  await page.goto("/login");
  await expect(page.getByTestId("login-scene")).toHaveAttribute("data-ready", "true");
});

test("static scenic fallback preserves login when WebGL is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { value: function (type: string, ...args: unknown[]) {
      if (type === "webgl" || type === "webgl2") return null;
      return Reflect.apply(original, this, [type, ...args]);
    } });
  });
  await page.goto("/login");
  await expect(page.locator('img[src*="conservatory-login"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "배경 일시 정지", exact: true })).toHaveCount(0);
  await capture(page, "login-static-fallback.png");
  await signIn(page);
});

test("lost WebGL context returns to the static background", async ({ page }) => {
  await page.goto("/login");
  const scene = page.getByTestId("login-scene");
  await expect(scene).toHaveAttribute("data-ready", "true");
  const supported = await scene.evaluate((element) => {
    const extension = (element as HTMLCanvasElement).getContext("webgl2")?.getExtension("WEBGL_lose_context");
    extension?.loseContext();
    return Boolean(extension);
  });
  expect(supported).toBe(true);
  await expect(scene).toHaveAttribute("data-ready", "false");
  await expect(page.getByRole("button", { name: "배경 일시 정지", exact: true })).toHaveCount(0);
  await expect(page.locator('img[src*="conservatory-login"]')).toBeVisible();
});

for (const mobile of [false, true]) {
  test(`@ui-smoke sidebar home and scoped group controls work on ${mobile ? "mobile" : "desktop"}`, async ({ page, request }) => {
    const sceneTextures: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/images/conservatory/")) sceneTextures.push(request.url());
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "sidebar-domains" } });
    await signIn(page);
    if (mobile) await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
    const rail = page.getByRole("navigation", { name: "업무 영역", exact: true });
    await expect(rail.getByRole("link", { name: "대시보드", exact: true })).toHaveCount(0);
    await expect(rail.getByRole("button", { name: "대시보드", exact: true })).toHaveCount(0);
    const expand = page.getByRole("button", { name: "메뉴 전체 펼치기", exact: true });
    const collapse = page.getByRole("button", { name: "메뉴 전체 접기", exact: true });
    await expect(expand).toBeVisible();
    await expect(expand.locator("..").getByText("업무 영역", { exact: true })).toBeVisible();
    await expand.click();
    await expect(page.getByRole("button", { name: "기본 관리", exact: true })).toHaveAttribute("aria-expanded", "true");
    await rail.getByRole("button", { name: "다른 업무", exact: true }).click();
    await expect(expand).toBeVisible();
    await expand.click();
    await collapse.click();
    await expect(page.getByRole("button", { name: "다른 그룹", exact: true })).toHaveAttribute("aria-expanded", "false");
    await rail.getByRole("button", { name: "고객관리", exact: true }).click();
    await expect(collapse).toBeVisible();
    await expect(page.getByRole("button", { name: "기본 관리", exact: true })).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("button", { name: "기본 관리", exact: true }).click();
    await expect(expand).toBeVisible();
    await expand.focus();
    await page.keyboard.press("Enter");
    await expect(collapse).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`sidebar-${mobile ? "mobile" : "desktop"}.png`) });
    if (mobile) await page.getByRole("button", { name: "메뉴 닫기", exact: true }).click();
    await page.goto("/mng/companies");
    const tabActions = page.getByRole("button", { name: "고객사관리 탭 관리", exact: true });
    const companyTab = page.getByRole("navigation", { name: "열린 업무" }).getByRole("button", { name: "고객사관리", exact: true });
    if (mobile) {
      await expect(tabActions).toBeVisible();
      await tabActions.click();
    } else {
      await expect(tabActions).toBeHidden();
      await companyTab.click({ button: "right" });
    }
    await expect(page.getByRole("menu", { name: "탭 관리 메뉴" })).toBeVisible();
    await page.keyboard.press("Escape");
    if (!mobile) {
      await companyTab.focus();
      await page.keyboard.press("Shift+F10");
      await expect(page.getByRole("menu", { name: "탭 관리 메뉴" })).toBeVisible();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "고객사관리 탭 닫기", exact: true })).toBeFocused();
    }
    await page.screenshot({ path: test.info().outputPath(`work-tabs-${mobile ? "mobile" : "desktop"}.png`) });
    await page.getByRole("navigation", { name: "열린 업무" }).getByRole("button", { name: "홈", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    expect(sceneTextures, "UI smoke checks must use the static login background").toEqual([]);
  });
}
