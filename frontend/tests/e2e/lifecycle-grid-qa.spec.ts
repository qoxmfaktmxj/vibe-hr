import { expect, test, type ConsoleMessage, type Page, type Response } from "@playwright/test";

const FRONTEND_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

type ScreenResult = {
  route: string;
  loaded: boolean;
  hasGrid: boolean;
  rowCount: number | null;
  consoleErrors: string[];
  screenshot: string;
  note: string;
};

const ROUTES = [
  "/hr/recruit/finalists",
  "/hr/employee",
  "/hr/appointment/records",
  "/tim/status",
  "/wel/requests",
  "/payroll/runs",
  "/hr/retire/checklist",
  "/hr/retire/approvals",
  "/payroll/gl-accounts",
  "/payroll/gl-mappings",
  "/payroll/vouchers",
  "/hr/severance/calcs",
  "/payroll/severance-item-rules",
  // ReadonlyGridManager 직접 연결 회귀 범위
  "/mng/dev-inquiries",
  "/mng/dev-projects",
  "/mng/dev-requests",
  "/mng/dev-staff",
  "/mng/infra",
  "/mng/manager-status",
  "/mng/outsource-attendance",
  "/mng/outsource-contracts",
  "/wel/benefit-types",
  "/tim/annual-leave",
];

function routeSlug(route: string): string {
  return route.replace(/^\//, "").replace(/\//g, "-");
}

function isNoiseMessage(text: string): boolean {
  const noisePatterns = [
    "[Fast Refresh]",
    "[HMR]",
    "Download the React DevTools",
    "was preloaded using link preload",
  ];
  return noisePatterns.some((pattern) => text.includes(pattern));
}

async function inspectScreen(page: Page, route: string): Promise<ScreenResult> {
  const slug = routeSlug(route);
  const screenshotPath = test.info().outputPath(`${slug}.png`);
  const consoleErrors: string[] = [];

  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() === "error" && !isNoiseMessage(msg.text())) {
      consoleErrors.push(msg.text());
    }
  };
  page.on("console", onConsole);
  const onPageError = (err: Error) => {
    consoleErrors.push(`pageerror: ${err.message}`);
  };
  const onResponse = (response: Response) => {
    const url = new URL(response.url());
    if (url.origin === new URL(FRONTEND_URL).origin && url.pathname.startsWith("/api/") && response.status() >= 400) {
      consoleErrors.push(`API ${response.status()} ${url.pathname}`);
    }
  };
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  let loaded = false;
  let hasGrid = false;
  let rowCount: number | null = null;
  let note = "";

  try {
    const response = await page.goto(`${FRONTEND_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const status = response?.status() ?? 0;

    // 인증 만료/실패 가드: storageState 재사용 세션이 끊기면 클라이언트 라우팅으로 /login에 떨어진다.
    // 원인 진단이 쉽도록 이 경우 명확한 에러 메시지로 즉시 실패시킨다.
    if (new URL(page.url()).pathname.startsWith("/login")) {
      throw new Error(
        `authentication expired: redirected to /login while navigating to ${route}. ` +
          "storageState 세션이 만료되었거나 global-setup 로그인에 실패했을 수 있습니다.",
      );
    }

    const gridLocator = page.locator(".ag-root, [class*='ag-theme']").first();
    await expect(gridLocator).toBeVisible({ timeout: 20_000 });
    hasGrid = true;

    const bodyText = await page.locator("body").innerText().catch(() => "");
    const isErrorPage =
      bodyText.includes("Application error") ||
      (bodyText.includes("500") && bodyText.includes("Internal Server Error")) ||
      bodyText.includes("This page could not be found") ||
      // 과거 오탐: 권한 차단/404/일반 오류 안내 페이지를 정상 로드로 잘못 판정한 사례 방지
      bodyText.includes("접근 권한이 없습니다") ||
      bodyText.includes("권한이 없") ||
      bodyText.includes("찾을 수 없") ||
      bodyText.includes("오류가 발생");

    loaded = status > 0 && status < 400 && !isErrorPage;
    if (!loaded) {
      note = `load failed: status=${status}, errorPageDetected=${isErrorPage}`;
    }

    await expect(page.locator(".ag-center-cols-container .ag-row, .ag-overlay-no-rows-wrapper").first())
      .toBeVisible({ timeout: 20_000 });
    rowCount = await page.locator(".ag-center-cols-container .ag-row").count();
  } catch (error) {
    loaded = false;
    note = `navigation error: ${(error as Error).message}`;
  }

  await page.screenshot({ path: screenshotPath, fullPage: true });

  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  page.off("response", onResponse);

  const result: ScreenResult = {
    route,
    loaded,
    hasGrid,
    rowCount,
    consoleErrors,
    screenshot: screenshotPath,
    note: note.trim(),
  };
  await test.info().attach("screen-result", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
  return result;
}

test.describe("HR lifecycle grid QA", () => {
  for (const route of ROUTES) {
    test(`screen check: ${route}`, async ({ page }) => {
      const result = await test.step(`inspect ${route}`, async () => inspectScreen(page, route));

      expect(result.loaded, `${route} failed to load: ${result.note}`).toBeTruthy();
      expect(result.hasGrid, `${route} AG Grid missing: ${result.note}`).toBeTruthy();
      expect(result.consoleErrors, `${route} browser/API errors`).toEqual([]);
    });
  }
});
