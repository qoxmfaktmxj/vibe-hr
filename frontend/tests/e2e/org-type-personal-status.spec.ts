import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

test("personal status shows Korean dynamic columns without write controls", async ({ page }) => {
  const calendarWarnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("displayIndex")) calendarWarnings.push(message.text());
  });
  mkdirSync("output/playwright", { recursive: true });

  await page.route("**/api/org/mapping-personal-status**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [{
          employee_id: 1,
          employee_no: "E-001",
          display_name: "홍길동",
          department_id: 10,
          department_code: "D-10",
          department_name: "인사팀",
          position_title: "대리",
          mappings: { COST: { item_code: "CC-100", item_name: "원가센터 A" } },
        }],
        type_columns: [{ type_code: "COST", name: "원가센터" }],
        total_count: 1,
        page: 1,
        limit: 100,
      }),
    });
  });

  await page.goto("/org/type-personal-status");
  await expect(page.getByRole("banner").getByRole("heading", { name: "조직구분개인별현황", exact: true })).toBeVisible();
  await expect(page.getByText("원가센터", { exact: true })).toBeVisible();
  await expect(page.getByText("원가센터 A", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "저장" })).toHaveCount(0);
  await expect(page.locator(".ag-root")).toBeVisible();
  await page.getByRole("button", { name: "기준일", exact: true }).click();
  await page.getByLabel("Select year", { exact: true }).selectOption("2027");
  await page.getByLabel("Select month", { exact: true }).selectOption("0");
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(page.getByLabel("Select month", { exact: true })).toHaveValue("1");
  await page.getByRole("button", { name: /2027년 2월 10일/ }).click();
  await expect(page.getByRole("button", { name: "기준일", exact: true })).toHaveText("2027-02-10");
  await Promise.all([
    page.waitForRequest((request) => new URL(request.url()).pathname === "/api/org/mapping-personal-status"
      && new URL(request.url()).searchParams.get("reference_date") === "2027-02-10"),
    page.getByRole("button", { name: "조회", exact: true }).first().click(),
  ]);
  expect(calendarWarnings).toEqual([]);
  await page.screenshot({ path: "output/playwright/org-type-personal-status-ko.png", fullPage: true });
});
