import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

test("types uses protected option sources and canonical toolbar", async ({ page }) => {
  mkdirSync("output/playwright", { recursive: true });

  await page.route("**/api/org/mapping-type-options**", async (route) => {
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

  await page.route("**/api/org/mapping-item-options**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          { code: "CC-100", name: "원가센터 A" },
          { code: "CC-200", name: "원가센터 B" },
        ],
      }),
    });
  });

  await page.route("**/api/org/department-options**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          { code: "D001", name: "인사팀" },
          { code: "D002", name: "총무팀" },
        ],
      }),
    });
  });

  await page.route("**/api/org/departments**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        departments: [
          {
            id: 1,
            code: "D001",
            name: "인사팀",
            parent_id: null,
            parent_name: null,
            organization_type: "본부",
            cost_center_code: "CC-100",
            description: null,
            employee_count: 12,
            is_active: true,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
          {
            id: 2,
            code: "D002",
            name: "총무팀",
            parent_id: null,
            parent_name: null,
            organization_type: "실",
            cost_center_code: "CC-200",
            description: null,
            employee_count: 7,
            is_active: true,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
        total_count: 2,
        reference_date: null,
        page: 1,
        limit: 100,
      }),
    });
  });

  await page.route("**/api/org/mapping-assignments**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: 11,
            department_id: 1,
            department_code: "D001",
            department_name: "인사팀",
            type_code: "COST",
            item_id: 101,
            item_code: "CC-100",
            item_name: "원가센터 A",
            effective_from: "2026-01-01",
            effective_to: null,
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

  await page.goto("/org/types");
  await expect(page.getByText("조직구분")).toBeVisible();
  await expect(page.locator(".ag-root")).toBeVisible();
  await expect(page.getByText("CC-100")).toBeVisible();
  await expect(page.getByRole("button", { name: "업로드" })).toHaveCount(0);
  await page.screenshot({ path: "output/playwright/org-types-ko.png", fullPage: true });
});
