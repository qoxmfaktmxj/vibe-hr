import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, path: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(path);
}

async function editTitle(page: Page, id: number, value: string) {
  await page.locator(`.ag-center-cols-container .ag-row[row-id="${id}"] [col-id="title"]`).dblclick();
  await page.locator(".ag-cell-inline-editing input").fill(value);
  await page.keyboard.press("Enter");
}

test("HR history remains editable after requerying an unchanged response", async ({ page, request }) => {
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "hr-basic" } });
  await login(page, "/hr/basic");
  await page.getByRole("navigation", { name: "인사 정보 탭" }).getByRole("button", { name: "학력", exact: true }).click();
  await expect(page.getByRole("grid")).toContainText("학력 A");
  await Promise.all([page.waitForResponse(response => new URL(response.url()).pathname === "/api/hr/basic/1"), page.getByRole("button", { name: "조회", exact: true }).click()]);
  await editTitle(page, 101, "조회 후 변경 학력");
  await expect(page.getByRole("grid")).toContainText("학력 B");
  await page.getByRole("button", { name: "변경 1건 저장", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "저장 완료:" })).toContainText("수정 1건");
  const writes = await (await request.get("http://127.0.0.1:3101/__basic-writes")).json();
  expect(writes).toHaveLength(1);
  expect(writes[0].items).toEqual([expect.objectContaining({ id: 101, title: "조회 후 변경 학력" })]);
});

test("HR history keeps drafts until one batch save, preserves failed edits and guards navigation", async ({ page, request }) => {
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "hr-basic" } });
  await login(page, "/hr/basic");
  const tabs = page.getByRole("navigation", { name: "인사 정보 탭" });
  await tabs.getByRole("button", { name: "학력", exact: true }).click();
  await expect(page.getByRole("grid")).toContainText("학력 A");
  await editTitle(page, 101, "저장 실패");
  await page.getByLabel("학력 B 삭제 표시", { exact: true }).check();
  await page.getByRole("button", { name: "입력", exact: true }).click();
  await editTitle(page, -1, "새 학력");
  expect(await (await request.get("http://127.0.0.1:3101/__basic-writes")).json()).toEqual([]);
  await tabs.getByRole("button", { name: "경력", exact: true }).click();
  const discard = page.getByRole("dialog", { name: "저장되지 않은 변경 사항이 있습니다.", exact: true });
  await expect(discard).toBeVisible();
  await discard.getByRole("button", { name: "취소", exact: true }).click();
  await page.getByPlaceholder("사번/이름 검색").fill("이하은");
  await page.getByRole("button", { name: "이하은 EMP-002", exact: true }).click();
  await expect(discard).toBeVisible();
  await discard.getByRole("button", { name: "취소", exact: true }).click();
  await page.getByRole("button", { name: "인사기본 탭 닫기", exact: true }).click();
  await expect(discard).toBeVisible();
  await discard.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByRole("button", { name: "인사기본 탭 닫기", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "변경 3건 저장", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "이력 저장에 실패" })).toBeVisible();
  await expect(page.getByRole("grid")).toContainText("새 학력");
  await expect(page.getByLabel("학력 B 삭제 표시", { exact: true })).toBeChecked();
  await editTitle(page, 101, "변경 학력");
  await page.getByRole("button", { name: "변경 3건 저장", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "저장 완료:" })).toContainText("입력 1건, 수정 1건, 삭제 1건");
  const writes = await (await request.get("http://127.0.0.1:3101/__basic-writes")).json();
  expect(writes).toHaveLength(2);
  expect(writes[1]).toMatchObject({ category: "education", delete_ids: [102], items: expect.arrayContaining([expect.objectContaining({ id: 101, title: "변경 학력" }), expect.objectContaining({ id: null, title: "새 학력" })]) });
  await expect(page.getByRole("grid")).not.toContainText("학력 B");
  await expect(page.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
  await page.screenshot({ path: test.info().outputPath("hr-history-grid.png") });
});

for (const width of [1440, 390]) {
  test(`HR profile explicit save and responsive sections at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 1000 });
    await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "hr-basic" } });
    await login(page, "/hr/basic");
    await page.getByRole("button", { name: "수정", exact: true }).click();
    await page.getByLabel("직무", { exact: true }).fill("변경 직무");
    expect(await (await request.get("http://127.0.0.1:3101/__basic-writes")).json()).toEqual([]);
    await page.getByRole("button", { name: "기본정보 저장", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "기본정보가 저장되었습니다." })).toBeVisible();
    await expect(page.getByText("변경 직무", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`hr-basic-${width}.png`) });
  });

  test(`approval detail follows the chosen document and confirms before acting at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 1000 });
    await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "hri-tasks" } });
    await login(page, "/hri/tasks/approvals");
    const documentCell = page.locator('.ag-cell[col-id="request_no"]').filter({ hasText: "DOC-103" });
    await documentCell.focus();
    await page.keyboard.press("Enter");
    const detail = page.getByRole("region", { name: "결재 문서 상세" });
    await expect(detail).toContainText("신청 103 상세 사유");
    if (width === 390) {
      const approve = detail.getByRole("button", { name: "문서 승인", exact: true });
      await approve.scrollIntoViewIfNeeded();
      expect(await approve.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return hit === element || element.contains(hit);
      })).toBe(true);
    }
    await detail.getByRole("button", { name: "문서 승인", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "취소", exact: true }).click();
    expect(await (await request.get("http://127.0.0.1:3101/__task-actions")).json()).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`approval-detail-${width}.png`) });
    await detail.getByRole("button", { name: "문서 승인", exact: true }).click();
    await page.getByRole("button", { name: "처리 확인", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "1건 중 1건 완료" })).toBeVisible();
    const calls = await (await request.get("http://127.0.0.1:3101/__task-actions")).json();
    expect(calls).toHaveLength(1); expect(calls[0]).toMatchObject({ id: 103, action: "approve" });
    await expect(detail).not.toContainText("신청 103 상세 사유");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
