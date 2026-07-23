import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

test("type-items uses the supported toolbar subset", async ({ page }) => {
  mkdirSync("output/playwright", { recursive: true });

  await page.route("**/api/org/mapping-types**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          { code: "COST", name: "원가" },
          { code: "PAY", name: "급여" },
        ],
      }),
    });
  });

  await page.route("**/api/org/mapping-type-items**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: 1,
            type_code: "COST",
            item_code: "CC-100",
            name: "원가센터 A",
            effective_from: "2026-01-01",
            effective_to: null,
            erp_employee_code: "ERP-001",
            cost_center_type: "CC",
            remark: "메모",
            sort_order: 1,
            is_active: true,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
        total_count: 1,
        page: 1,
        limit: 100,
      }),
    });
  });

  await page.goto("/org/type-items");
  await expect(page.getByText("조직구분항목관리")).toBeVisible();
  await expect(page.getByRole("button", { name: "조회" })).toBeVisible();
  await expect(page.getByRole("button", { name: "저장" })).toBeVisible();
  await expect(page.getByRole("button", { name: "양식 다운로드" })).toHaveCount(0);
  await expect(page.getByText("CC-100")).toBeVisible();
  await page.screenshot({ path: "output/playwright/org-type-items-ko.png", fullPage: true });
});
