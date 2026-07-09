import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const FRONTEND_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const LOGIN = { enterCd: "VIBE", loginId: "admin-local", password: "admin" };

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

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto(`${FRONTEND_URL}/login`);
  await page.selectOption('select[name="enterCd"]', LOGIN.enterCd);
  await page.fill('input[name="loginId"]', LOGIN.loginId);
  await page.fill('input[name="password"]', LOGIN.password);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });
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
      await loginAsAdmin(page);

      const result = await test.step(`inspect ${route}`, async () => inspectScreen(page, route));

      // Soft assertion: record the fact, but only fail the test on hard navigation/load failure.
      expect(result.loaded, `${route} failed to load: ${result.note}`).toBeTruthy();
    });
  }
});
