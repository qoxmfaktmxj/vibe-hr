import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

test("chart saves Korean screenshot", async ({ page }) => {
  mkdirSync("output/playwright", { recursive: true });

  await page.route("**/api/org/chart", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        departments: [
          {
            id: 1,
            code: "HQ",
            name: "본부",
            parent_id: null,
            parent_name: null,
            organization_type: "본부",
            cost_center_code: "CC-100",
            description: null,
            employee_count: 120,
            is_active: true,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
          {
            id: 2,
            code: "HR",
            name: "인사팀",
            parent_id: 1,
            parent_name: "본부",
            organization_type: "실",
            cost_center_code: "CC-110",
            description: null,
            employee_count: 18,
            is_active: true,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
        total_count: 2,
        reference_date: "2026-07-22",
      }),
    });
  });

  await page.goto("/org/chart");
  await expect(page.getByText("조직도관리")).toBeVisible();
  await expect(page.getByRole("link", { name: "조직코드관리에서 편집" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "본부" })).toBeVisible();
  await expect(page.getByText("CC-100")).toBeVisible();
  await page.screenshot({ path: "output/playwright/org-chart-ko.png", fullPage: true });
});

test("chart shows empty UI when backend returns 204", async ({ page }) => {
  mkdirSync("output/playwright", { recursive: true });

  await page.route("**/api/org/chart", async (route) => {
    await route.fulfill({
      status: 204,
      contentType: "application/json",
      body: "",
    });
  });

  await page.goto("/org/chart");
  await expect(page.getByText("조직도 데이터가 없습니다.")).toBeVisible();
  await expect(page.getByText("조직코드관리에서 부서를 추가한 뒤 다시 확인하세요.")).toBeVisible();
  await page.screenshot({ path: "output/playwright/org-chart-ko.png", fullPage: true });
});
