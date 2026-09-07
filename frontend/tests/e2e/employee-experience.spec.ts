import { expect, test, type Page } from "@playwright/test";

async function capture(page: Page, filename: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations()
      .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
      .map((animation) => animation.finished.catch(() => undefined)));
  });
  await page.mouse.move(0, 0);
  await page.screenshot({ path: test.info().outputPath(filename) });
}

// These tests exercise the real Next UI/BFF with synthetic backend responses.
// They do not replace the Spring authentication or authorization test suites.
async function signIn(page: Page) {
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

test("login has clear company/social labels and accessible password visibility", async ({ page }) => {
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
  await expect(page.getByRole("button", { name: "고객사관리 탭 관리" })).toBeFocused();
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

test("conservatory water motion pauses and resumes without blocking login", async ({ page }) => {
  await page.goto("/login");
  const scene = page.getByTestId("login-scene");
  await expect(scene).toHaveAttribute("data-ready", "true");
  const first = await scene.getAttribute("data-frame");
  await expect.poll(() => scene.getAttribute("data-frame")).not.toBe(first);
  await expect(page.getByRole("button", { name: "배경 일시 정지", exact: true })).toBeInViewport();
  await page.getByRole("button", { name: "배경 일시 정지", exact: true }).click();
  await expect(scene).toHaveAttribute("data-motion", "paused");
  const frozen = await scene.getAttribute("data-frame");
  await page.waitForTimeout(150);
  expect(await scene.getAttribute("data-frame")).toBe(frozen);
  await page.getByRole("button", { name: "배경 재생", exact: true }).click();
  await expect.poll(() => scene.getAttribute("data-frame")).not.toBe(frozen);
  await signIn(page);
});

test("reduced motion keeps the scenic image static and the form usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  const scene = page.getByTestId("login-scene");
  await expect(scene).toHaveAttribute("data-ready", "true");
  await expect(scene).toHaveAttribute("data-motion", "paused");
  await expect(page.getByRole("button", { name: "배경 일시 정지", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "로그인", exact: true })).toBeEnabled();
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
