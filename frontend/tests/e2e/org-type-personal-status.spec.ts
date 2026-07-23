import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

test("personal status shows Korean dynamic columns without write controls", async ({ page }) => {
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
  await expect(page.getByText("조직구분개인별현황")).toBeVisible();
  await expect(page.getByText("원가센터", { exact: true })).toBeVisible();
  await expect(page.getByText("원가센터 A", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "저장" })).toHaveCount(0);
  await expect(page.locator(".ag-root")).toBeVisible();
  await page.screenshot({ path: "output/playwright/org-type-personal-status-ko.png", fullPage: true });
});
