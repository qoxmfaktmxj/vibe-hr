import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const FRONTEND_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const LOGIN = { enterCd: "VIBE", loginId: "admin-local", password: "admin" };

export const AUTH_STATE_PATH = path.resolve(__dirname, "../../test-results/.auth/admin.json");

export default async function globalSetup(): Promise<void> {
  mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${FRONTEND_URL}/login`);
  await page.selectOption('select[name="enterCd"]', LOGIN.enterCd);
  await page.fill('input[name="loginId"]', LOGIN.loginId);
  await page.fill('input[name="password"]', LOGIN.password);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });

  await page.context().storageState({ path: AUTH_STATE_PATH });

  await browser.close();
}
