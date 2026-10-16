import { expect, test } from "@playwright/test";

test("common-code group selection protects current detail edits", async ({ page }) => {
  const now = "2026-10-16T00:00:00Z";
  const groups = [
    { id: 9101, code: "QA_FIRST", name: "검증 첫 그룹", description: null, sort_order: 1, is_active: true, created_at: now, updated_at: now },
    { id: 9102, code: "QA_SECOND", name: "검증 둘째 그룹", description: null, sort_order: 2, is_active: true, created_at: now, updated_at: now },
  ];
  const writes: string[] = [];
  await page.route("**/api/codes/groups**", async (route) => {
    if (route.request().method() !== "GET") {
      writes.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
      await route.abort();
      return;
    }
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/codes/groups") {
      const page = Number(new URL(route.request().url()).searchParams.get("page") ?? "1");
      await route.fulfill({ json: {
        groups: page === 1 ? groups : [{ ...groups[0], id: 9103, code: "QA_NEXT", name: "다음 페이지 그룹" }],
        total_count: 102, page, limit: 100,
      } });
      return;
    }
    const second = pathname === "/api/codes/groups/9102/items";
    await route.fulfill({ json: {
      codes: [{ id: second ? 9202 : 9201, group_id: second ? 9102 : 9101, code: "ITEM", name: second ? "둘째 값" : "원래 값", description: null, sort_order: 1, is_active: true, created_at: now, updated_at: now }],
      total_count: 1, page: 1, limit: 100,
    } });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/settings/common-codes");
  const groupsGrid = page.getByRole("grid").nth(0);
  const detailGrid = page.getByRole("grid").nth(1);
  await expect(detailGrid).toContainText("원래 값");
  const detailName = detailGrid.locator('.ag-center-cols-container [row-id="9201"] [col-id="name"]');
  await detailName.dblclick();
  const editor = detailName.locator("input");
  await editor.fill("미저장 검증 값");
  await editor.press("Enter");
  await expect(detailName).toHaveText("미저장 검증 값");
  const selectSecond = groupsGrid.locator('.ag-row[row-id="9102"]').getByRole("button", { name: "선택", exact: true });
  await selectSecond.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("저장되지 않은 변경 사항이 있습니다.");
  await page.screenshot({ path: test.info().outputPath("common-code-unsaved.png"), fullPage: true });
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await expect(detailName).toHaveText("미저장 검증 값");
  await selectSecond.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "무시하고 이동", exact: true }).click();
  await expect(detailGrid).toContainText("둘째 값");
  await expect(detailGrid).not.toContainText("미저장 검증 값");
  const groupPageInput = page.getByPlaceholder("페이지", { exact: true }).first();
  await groupPageInput.fill("99");
  await expect(groupPageInput).toHaveValue("99");
  await page.getByRole("button", { name: "다음", exact: true }).first().click();
  await expect(groupsGrid).toContainText("다음 페이지 그룹");
  await expect(groupPageInput).toHaveValue("2");
  await page.getByRole("button", { name: "이전", exact: true }).first().click();
  await expect(groupsGrid).toContainText("검증 첫 그룹");
  await expect(groupPageInput).toHaveValue("1");
  expect(writes).toEqual([]);
});
