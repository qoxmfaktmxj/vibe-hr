import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const FRONTEND_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const OUTPUT_DIR = path.resolve(__dirname, "../../../output/playwright/lifecycle-grid-20260708");
const REPORT_PATH = path.join(OUTPUT_DIR, "report.json");

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
    "webpack-internal",
    "was preloaded using link preload",
  ];
  return noisePatterns.some((pattern) => text.includes(pattern));
}

function appendResult(result: ScreenResult): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  let results: ScreenResult[] = [];
  if (existsSync(REPORT_PATH)) {
    try {
      results = JSON.parse(readFileSync(REPORT_PATH, "utf-8")) as ScreenResult[];
    } catch {
      results = [];
    }
  }
  const filtered = results.filter((entry) => entry.route !== result.route);
  filtered.push(result);
  writeFileSync(REPORT_PATH, JSON.stringify(filtered, null, 2), "utf-8");
}

async function inspectScreen(page: Page, route: string): Promise<ScreenResult> {
  const slug = routeSlug(route);
  const screenshotPath = path.join(OUTPUT_DIR, `${slug}.png`);
  const consoleErrors: string[] = [];

  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() === "error" && !isNoiseMessage(msg.text())) {
      consoleErrors.push(msg.text());
    }
  };
  page.on("console", onConsole);
  page.on("pageerror", (err) => {
    consoleErrors.push(`pageerror: ${err.message}`);
  });

  let loaded = false;
  let hasGrid = false;
  let rowCount: number | null = null;
  let note = "";

  try {
    const response = await page.goto(`${FRONTEND_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const status = response?.status() ?? 0;

    // Allow client-side render to settle.
    await page.waitForTimeout(1500);

    // 인증 만료/실패 가드: storageState 재사용 세션이 끊기면 클라이언트 라우팅으로 /login에 떨어진다.
    // 원인 진단이 쉽도록 이 경우 명확한 에러 메시지로 즉시 실패시킨다.
    if (new URL(page.url()).pathname.startsWith("/login")) {
      throw new Error(
        `authentication expired: redirected to /login while navigating to ${route}. ` +
          "storageState 세션이 만료되었거나 global-setup 로그인에 실패했을 수 있습니다.",
      );
    }

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

    const gridLocator = page.locator(".ag-root, [class*='ag-theme']").first();
    hasGrid = (await gridLocator.count()) > 0;

    if (hasGrid) {
      try {
        await page.waitForSelector(".ag-center-cols-container .ag-row, .ag-body-viewport .ag-row", {
          timeout: 8_000,
        });
      } catch {
        // no rows rendered within timeout; rowCount will reflect actual count below
      }
      rowCount = await page.locator(".ag-center-cols-container .ag-row").count();
    } else {
      note = note || "no AG Grid element found on this screen (expected for non-registered custom screens)";
    }
  } catch (error) {
    loaded = false;
    note = `navigation error: ${(error as Error).message}`;
  }

  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {
    note += " | screenshot failed";
  });

  page.off("console", onConsole);

  const result: ScreenResult = {
    route,
    loaded,
    hasGrid,
    rowCount,
    consoleErrors,
    screenshot: screenshotPath,
    note: note.trim(),
  };
  appendResult(result);
  return result;
}

test.describe("HR lifecycle grid QA", () => {
  test.beforeAll(() => {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    if (existsSync(REPORT_PATH)) {
      writeFileSync(REPORT_PATH, "[]", "utf-8");
    }
  });

  for (const route of ROUTES) {
    test(`screen check: ${route}`, async ({ page }) => {
      const result = await test.step(`inspect ${route}`, async () => inspectScreen(page, route));

      expect(result.loaded, `${route} failed to load: ${result.note}`).toBeTruthy();
      expect(result.hasGrid, `${route} AG Grid missing: ${result.note}`).toBeTruthy();
    });
  }
});
