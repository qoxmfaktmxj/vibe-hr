import { expect, test, type Page } from "@playwright/test";

const backend = "http://127.0.0.1:3101";

async function openTraining(page: Page, path: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(path);
  await expect(page.getByRole("grid")).toContainText("TRA-101");
}

function checkbox(page: Page, id: number) {
  return page.locator(`.ag-row[row-id="${id}"] input[type="checkbox"]`);
}

test.beforeEach(async ({ request }) => {
  await request.post(`${backend}/__scenario`, { data: { scenario: "training-applications" } });
});

test("approval and rejection follow selected rows and refreshed status", async ({ page, request }) => {
  await openTraining(page, "/tra/applications");
  const approve = page.getByRole("button", { name: "승인", exact: true });
  const reject = page.getByRole("button", { name: "반려", exact: true });
  await expect(approve).toBeDisabled();
  await expect(reject).toBeDisabled();

  await checkbox(page, 104).check();
  await expect(approve).toBeDisabled();
  await expect(reject).toBeDisabled();
  await checkbox(page, 104).uncheck();

  await checkbox(page, 101).check();
  await expect(approve).toBeEnabled();
  await expect(reject).toBeEnabled();
  await checkbox(page, 101).uncheck();
  await expect(approve).toBeDisabled();
  await expect(reject).toBeDisabled();

  await checkbox(page, 101).check();
  await approve.click();
  const approvalDialog = page.getByRole("dialog", { name: "교육 신청 승인", exact: true });
  await expect(approvalDialog).toContainText("선택한 1건");
  await approvalDialog.getByRole("button", { name: "승인", exact: true }).click();
  await expect(approvalDialog).toBeHidden();
  await expect(page.locator('.ag-row[row-id="101"] [col-id="status"]')).toHaveText("승인");
  await expect(approve).toBeDisabled();
  await expect(reject).toBeDisabled();
  await checkbox(page, 101).uncheck();

  await checkbox(page, 102).check();
  await reject.click();
  const rejectionDialog = page.getByRole("dialog", { name: "교육 신청 반려", exact: true });
  await rejectionDialog.getByLabel("반려 사유 (선택)", { exact: true }).fill("일정 조정 필요");
  await rejectionDialog.screenshot({ path: test.info().outputPath("training-rejection-korean.png") });
  await rejectionDialog.getByRole("button", { name: "반려", exact: true }).click();
  await expect(rejectionDialog).toBeHidden();
  await expect(page.locator('.ag-row[row-id="102"] [col-id="status"]')).toHaveText("반려");
  await expect(approve).toBeDisabled();
  await expect(reject).toBeDisabled();
  await checkbox(page, 102).uncheck();

  await checkbox(page, 103).check();
  await expect(approve).toBeDisabled();
  await expect(reject).toBeEnabled();
  await request.post(`${backend}/__training-status`, { data: { id: 103, status: "approved" } });
  await page.getByRole("button", { name: "조회", exact: true }).first().click();
  await expect(page.locator('.ag-row[row-id="103"] [col-id="status"]')).toHaveText("승인");
  await expect(reject).toBeDisabled();

  expect(await (await request.get(`${backend}/__training-actions`)).json()).toEqual([
    { id: 101, action: "approve", method: "POST", body: null },
    { id: 102, action: "reject", method: "POST", body: { reason: "일정 조정 필요" } },
  ]);
  await page.getByRole("main").screenshot({ path: test.info().outputPath("training-approval-korean.png") });
});

test("own withdrawal follows selection, cleared selection and refreshed status", async ({ page, request }) => {
  await openTraining(page, "/tra/my-applications");
  const withdraw = page.getByRole("button", { name: "회수", exact: true });
  await expect(withdraw).toBeDisabled();
  await checkbox(page, 104).check();
  await expect(withdraw).toBeDisabled();
  await checkbox(page, 101).check();
  await expect(withdraw).toBeEnabled();
  await checkbox(page, 101).uncheck();
  await expect(withdraw).toBeDisabled();

  await checkbox(page, 101).check();
  let releaseWithdrawal!: () => void;
  const withdrawalDelay = new Promise<void>((resolve) => { releaseWithdrawal = resolve; });
  let withdrawalRequests = 0;
  await page.route("**/api/tra/applications/101/withdraw", async (route) => {
    withdrawalRequests += 1;
    await withdrawalDelay;
    await route.continue();
  });
  await withdraw.click();
  const dialog = page.getByRole("dialog", { name: "신청 회수", exact: true });
  await expect(dialog).toContainText("회수 후에는 취소 상태");
  await dialog.screenshot({ path: test.info().outputPath("training-withdrawal-korean.png") });
  await dialog.getByRole("button", { name: "회수", exact: true }).click();
  try {
    await expect.poll(() => withdrawalRequests).toBe(1);
    await expect(dialog.getByRole("button", { name: "처리 중...", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "취소", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    expect(withdrawalRequests).toBe(1);
  } finally {
    releaseWithdrawal();
  }
  await expect(dialog).toBeHidden();
  await expect(page.locator('.ag-row[row-id="101"] [col-id="status"]')).toHaveText("취소");
  await expect(withdraw).toBeDisabled();

  await checkbox(page, 103).check();
  await expect(withdraw).toBeEnabled();
  await request.post(`${backend}/__training-status`, { data: { id: 103, status: "approved" } });
  await page.getByRole("button", { name: "조회", exact: true }).first().click();
  await expect(page.locator('.ag-row[row-id="103"] [col-id="status"]')).toHaveText("승인");
  await expect(withdraw).toBeDisabled();
  expect(await (await request.get(`${backend}/__training-actions`)).json()).toEqual([
    { id: 101, action: "withdraw", method: "PUT", body: null },
  ]);
});

test("creating an application keeps the confirmation busy until one request completes", async ({ page, request }) => {
  await openTraining(page, "/tra/my-applications");
  let releaseCreate!: () => void;
  const createDelay = new Promise<void>((resolve) => { releaseCreate = resolve; });
  let createRequests = 0;
  await page.route("**/api/tra/my-applications", async (route) => {
    if (route.request().method() === "POST") {
      createRequests += 1;
      await createDelay;
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "신청", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "교육 신청", exact: true });
  await dialog.getByLabel("과정 선택 *", { exact: true }).selectOption("1");
  await dialog.getByLabel("비고", { exact: true }).fill("업무 관련 교육");
  await dialog.getByRole("button", { name: "신청", exact: true }).click();
  try {
    await expect.poll(() => createRequests).toBe(1);
    await expect(dialog.getByRole("button", { name: "처리 중...", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "취소", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    expect(createRequests).toBe(1);
  } finally {
    releaseCreate();
  }
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("grid")).toContainText("TRA-105");
  expect(await (await request.get(`${backend}/__training-actions`)).json()).toEqual([
    { action: "create", method: "POST", body: { course_id: 1, year_plan_yn: false, note: "업무 관련 교육" } },
  ]);
});

test("structured create errors preserve the draft and allow retry without page errors", async ({ page, request }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openTraining(page, "/tra/my-applications");
  let attempts = 0;
  await page.route("**/api/tra/my-applications", async (route) => {
    if (route.request().method() === "POST" && ++attempts === 1) {
      await route.fulfill({ status: 422, json: { detail: [{ type: "json_invalid", loc: ["body", 1], msg: "JSON decode error", input: {} }] } });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "신청", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "교육 신청", exact: true });
  await dialog.getByLabel("과정 선택 *", { exact: true }).selectOption("1");
  await dialog.getByLabel("비고", { exact: true }).fill("다시 신청할 교육");
  await dialog.getByRole("button", { name: "신청", exact: true }).click();
  await expect(page.getByText("신청에 실패했습니다.", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("과정 선택 *", { exact: true })).toHaveValue("1");
  await expect(dialog.getByLabel("비고", { exact: true })).toHaveValue("다시 신청할 교육");
  await dialog.screenshot({ path: test.info().outputPath("training-create-error-korean.png") });
  expect(await (await request.get(`${backend}/__training-actions`)).json()).toEqual([]);
  await dialog.getByRole("button", { name: "신청", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("grid")).toContainText("TRA-105");
  expect(attempts).toBe(2);
  expect(pageErrors).toEqual([]);
});

test("structured withdrawal errors keep selection and allow retry without page errors", async ({ page, request }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openTraining(page, "/tra/my-applications");
  let attempts = 0;
  await page.route("**/api/tra/applications/101/withdraw", async (route) => {
    if (++attempts === 1) {
      await route.fulfill({ status: 422, json: { detail: [{ type: "value_error", loc: ["body"], msg: "Invalid request", input: {} }] } });
    } else await route.continue();
  });
  await checkbox(page, 101).check();
  await page.getByRole("button", { name: "회수", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "신청 회수", exact: true });
  await dialog.getByRole("button", { name: "회수", exact: true }).click();
  await expect(page.getByText("회수에 실패했습니다.", { exact: true })).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(checkbox(page, 101)).toBeChecked();
  expect(await (await request.get(`${backend}/__training-actions`)).json()).toEqual([]);
  await dialog.getByRole("button", { name: "회수", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.ag-row[row-id="101"] [col-id="status"]')).toHaveText("취소");
  expect(attempts).toBe(2);
  expect(pageErrors).toEqual([]);
});
