import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { read, utils } from "xlsx";

test("own withdrawal requires in-app confirmation and sends one request while busy", async ({ page, request }) => {
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "hri-tasks" } });
  const nativeDialogs: string[] = [];
  page.on("dialog", (dialog) => { nativeDialogs.push(dialog.message()); void dialog.dismiss(); });
  await page.goto("/login");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/hri/requests/mine");
  await page.getByRole("button", { name: "신청서 작성", exact: true }).click();
  const create = page.getByRole("dialog");
  await create.getByRole("button", { name: "일반 신청", exact: true }).click();
  await create.getByPlaceholder("신청서 제목").fill("회수 확인 신청");
  await create.locator("textarea").fill("회수 확인용 합성 사유");
  await create.getByRole("button", { name: "결재신청", exact: true }).click();
  await expect(create).toHaveCount(0);
  await page.getByRole("grid").getByText("회수 확인 신청", { exact: true }).click();
  const detail = page.getByRole("dialog", { name: "일반 신청", exact: true });
  await detail.getByRole("button", { name: "회수", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "신청서를 회수하시겠습니까?", exact: true });
  await expect(confirmation).toBeVisible();
  expect(await (await request.get("http://127.0.0.1:3101/__hri-request-writes")).json()).toHaveLength(1);
  await confirmation.getByRole("button", { name: "취소", exact: true }).click();
  await expect(confirmation).toBeHidden();
  await expect(detail).toBeVisible();
  await detail.getByRole("button", { name: "회수", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  expect(await (await request.get("http://127.0.0.1:3101/__hri-request-writes")).json()).toHaveLength(1);

  let withdrawalRequests = 0;
  let releaseWithdrawal!: () => void;
  const withdrawalDelay = new Promise<void>((resolve) => { releaseWithdrawal = resolve; });
  await page.route("**/api/hri/requests/401/withdraw", async (route) => {
    withdrawalRequests += 1;
    await withdrawalDelay;
    await route.continue();
  });
  await detail.getByRole("button", { name: "회수", exact: true }).click();
  await confirmation.getByRole("button", { name: "확인", exact: true }).click();
  try {
    await expect.poll(() => withdrawalRequests).toBe(1);
    await expect(confirmation.getByRole("button", { name: "처리 중...", exact: true })).toBeDisabled();
    await expect(confirmation.getByRole("button", { name: "취소", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(confirmation).toBeVisible();
    await confirmation.screenshot({ path: test.info().outputPath("hri-withdraw-confirmation-korean.png") });
    expect(withdrawalRequests).toBe(1);
  } finally {
    releaseWithdrawal();
  }
  await expect(confirmation).toBeHidden();
  await expect(detail).toBeHidden();
  await expect(page.getByRole("grid").locator('.ag-row[row-id="401"]')).toContainText("회수");
  const writes = await (await request.get("http://127.0.0.1:3101/__hri-request-writes")).json();
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual({ path: "/api/v1/hri/requests/401/withdraw", method: "POST" });
  expect(nativeDialogs).toEqual([]);
});

for (const width of [1440, 390]) {
  test(`draft-disabled form submits atomically and keeps failed edits at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 1000 });
    await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "hri-tasks" } });
    await page.goto("/login");
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/hri/requests/mine");
    await page.getByRole("button", { name: "신청서 작성", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "일반 신청", exact: true }).click();
    await dialog.getByPlaceholder("신청서 제목").fill("실패 신청");
    await dialog.locator("textarea").fill("입력한 신청 사유");
    await dialog.getByRole("button", { name: "결재신청", exact: true }).click();
    await expect(page.getByText("결재선 설정을 확인해 주세요.", { exact: true })).toBeVisible();
    await expect(dialog.getByPlaceholder("신청서 제목")).toHaveValue("실패 신청");
    await expect(dialog.locator("textarea")).toHaveValue("입력한 신청 사유");
    await expect(page.locator('[role="grid"]')).not.toContainText("실패 신청");
    await page.screenshot({ path: test.info().outputPath(`direct-submit-failure-${width}.png`) });

    await dialog.getByPlaceholder("신청서 제목").fill("최종 신청");
    await dialog.getByRole("button", { name: "결재신청", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("grid")).toContainText("최종 신청");
    const writes = await (await request.get("http://127.0.0.1:3101/__hri-request-writes")).json();
    expect(writes).toHaveLength(2);
    expect(writes.map((write: { path: string }) => write.path)).toEqual([
      "/api/v1/hri/requests/submit", "/api/v1/hri/requests/submit",
    ]);
    expect(writes[1]).toMatchObject({ request_id: null, form_type_id: 11, title: "최종 신청", content_json: { reason: "입력한 신청 사유" } });
    await page.screenshot({ path: test.info().outputPath(`direct-submit-success-${width}.png`) });
  });
}

for (const kind of ["approvals", "receives"] as const) {
  test(`${kind}: export, confirm/cancel and partial bulk processing`, async ({ page, request }) => {
    await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "hri-tasks" } });
    await page.goto("/login");
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/hri/tasks/${kind}`);
    await expect(page.getByRole("grid")).toBeVisible();
    await expect(page.getByRole("grid")).toContainText("DOC-");
    await expect(page.getByLabel("처리 의견", { exact: true })).toHaveCount(0);
    await expect(page.locator('.ag-header-cell[col-id="actions"]')).toHaveCount(0);
    expect(await page.locator('.ag-center-cols-container [role="row"]').first().evaluate((row) => row.getBoundingClientRect().height)).toBe(34);
    await expect(page.getByRole("button", { name: "업로드", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "입력", exact: true })).toHaveCount(0);
    const label = kind === "approvals" ? "선택 승인" : "선택 수신 완료";
    await expect(page.getByRole("button", { name: label, exact: true })).toBeDisabled();
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "현재 페이지 다운로드", exact: true }).click();
    const download = await downloadEvent;
    const file = await download.path();
    const book = read(await readFile(file!), { type: "buffer" });
    const items = utils.sheet_to_json(book.Sheets[book.SheetNames[0]]);
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveProperty("문서번호", kind === "approvals" ? "DOC-101" : "DOC-201");
    await page.locator('.ag-header-cell[col-id="title"] .ag-header-cell-filter-button').click();
    const filterInput = page.locator('.ag-filter input').first();
    await filterInput.fill("1");
    await expect(page.locator('.ag-center-cols-container [role="row"]')).toHaveCount(1);
    await page.keyboard.press("Escape");
    const filteredDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "현재 페이지 다운로드", exact: true }).click();
    const filteredBook = read(await readFile((await (await filteredDownload).path())!), { type: "buffer" });
    expect(utils.sheet_to_json(filteredBook.Sheets[filteredBook.SheetNames[0]])).toHaveLength(1);
    await page.locator('.ag-header-cell[col-id="title"] .ag-header-cell-filter-button').click();
    await page.locator('.ag-filter input').first().fill("");
    await expect(page.locator('.ag-center-cols-container [role="row"]')).toHaveCount(3);
    await page.keyboard.press("Escape");
    await page.locator('.ag-header input[type="checkbox"]').check();
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.getByRole("dialog").getByLabel("처리 의견", { exact: true }).fill("확인했습니다");
    await expect(page.getByRole("dialog").getByLabel("처리 의견", { exact: true })).toHaveValue("확인했습니다");
    await page.screenshot({ path: test.info().outputPath(`${kind}-confirm.png`) });
    await page.getByRole("button", { name: "취소", exact: true }).click();
    expect(await (await request.get("http://127.0.0.1:3101/__task-actions")).json()).toEqual([]);
    await expect(page.getByRole("button", { name: label, exact: true })).toBeEnabled();
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.getByRole("button", { name: "처리 확인", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "3건 중 2건 완료, 1건 실패" })).toBeVisible();
    await expect(page.getByText(/현재 처리 차수가 변경되었습니다/)).toBeVisible();
    const calls = await (await request.get("http://127.0.0.1:3101/__task-actions")).json();
    expect(calls).toHaveLength(3);
    expect(calls.every((call: { action: string; comment: string }) => call.action === (kind === "approvals" ? "approve" : "receive-complete") && call.comment === "확인했습니다")).toBe(true);
    await expect(page.getByRole("grid")).not.toContainText(kind === "approvals" ? "DOC-101" : "DOC-201");
    await page.screenshot({ path: test.info().outputPath(`${kind}.png`) });
    await page.locator('.ag-header input[type="checkbox"]').check();
    await page.getByRole("button", { name: "반려", exact: true }).click();
    await page.getByRole("button", { name: "처리 확인", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "1건 중 1건 완료, 0건 실패" })).toBeVisible();
    await expect(page.getByRole("button", { name: "현재 페이지 다운로드", exact: true })).toBeDisabled();
    const rejected = await (await request.get("http://127.0.0.1:3101/__task-actions")).json();
    expect(rejected.at(-1).action).toBe(kind === "approvals" ? "reject" : "receive-reject");
    // A pre-existing consumer keeps its default toolbar and has no new row checkboxes.
    await page.goto("/tim/status");
    await expect(page.getByRole("grid")).toBeVisible();
    await expect(page.getByRole("button", { name: "업로드", exact: true })).toHaveCount(0);
    await expect(page.locator('.ag-header input[type="checkbox"]')).toHaveCount(0);
  });
}
