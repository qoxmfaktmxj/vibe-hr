import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { read, utils } from "xlsx";

for (const width of [1440, 390]) {
  test(`checklist standard layout and registration at ${width}px`, async ({ page, request }) => {
    await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "checklist-layout" } });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/login");
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/hr/retire/checklist");
    await expect(page.getByRole("grid")).toContainText("회사 자산 반납");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByPlaceholder("코드 예: asset_return")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "업로드", exact: true })).toHaveCount(0);
    const rowHeight = await page.locator('.ag-center-cols-container [role="row"]').first().evaluate((node) => node.getBoundingClientRect().height);
    expect(rowHeight).toBe(34);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "입력", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("체크리스트 코드", { exact: true }).fill(" layout_check ");
    await dialog.getByLabel("제목", { exact: true }).fill("검증 항목");
    await dialog.getByLabel("설명", { exact: true }).fill("화면 검증용 설명");
    await dialog.getByLabel("정렬순서", { exact: true }).fill("3");
    await dialog.getByLabel("필수 항목", { exact: true }).uncheck();
    await page.screenshot({ path: test.info().outputPath(`checklist-dialog-${width}.png`) });
    await page.getByRole("button", { name: "취소", exact: true }).click();
    await expect(page.getByRole("grid")).not.toContainText("검증 항목");
    await page.getByRole("button", { name: "입력", exact: true }).click();
    await expect(dialog.getByLabel("제목", { exact: true })).toHaveValue("검증 항목");
    await dialog.getByRole("button", { name: "등록", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("grid")).toContainText("layout_check");
    await page.getByPlaceholder("코드, 제목, 설명", { exact: true }).fill("검증 항목");
    await page.getByRole("button", { name: "조회", exact: true }).click();
    await expect(page.locator('.ag-center-cols-container [role="row"]')).toHaveCount(1);
    const event = page.waitForEvent("download");
    await page.getByRole("button", { name: "다운로드", exact: true }).click();
    const workbook = read(await readFile((await (await event).path())!), { type: "buffer" });
    const rows = utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ "코드": "layout_check", "제목": "검증 항목", "필수 여부": "선택", "정렬순서": 3 });
    await page.screenshot({ path: test.info().outputPath(`checklist-${width}.png`), fullPage: true });
  });
}
