import { expect, test, type Locator, type Page } from "@playwright/test";
import { installGridRolloutFixture } from "./grid-rollout-fixture";

test.beforeEach(async ({ request }) => {
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "grid-rollout" } });
});

for (const timezoneId of ["UTC", "Asia/Seoul"]) {
  test.describe(`schedule defaults in ${timezoneId}`, () => {
    test.use({ timezoneId });
    test("uses the complete Korea business month at a UTC month boundary", async ({ page }) => {
      await page.clock.setFixedTime(new Date("2026-10-31T16:00:00Z"));
      await installGridRolloutFixture(page);
      await login(page, "/tim/work-codes");
      const dates = page.locator('input[type="date"]');
      await expect(dates.nth(0)).toHaveValue("2026-11-01");
      await expect(dates.nth(1)).toHaveValue("2026-11-30");
    });
  });
}
async function login(page: Page, path: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(path);
}
async function edit(page: Page, scope: Locator, id: number, field: string, value: string) {
  const cell = scope.locator(`.ag-center-cols-container .ag-row[row-id="${id}"] [col-id="${field}"]`);
  await cell.dblclick();
  await scope.locator(".ag-cell-inline-editing input").fill(value);
  await page.keyboard.press("Enter");
}
async function snapshot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath(name), fullPage: true });
}

test("form codes stage multirow edits and delete restoration, keep failed drafts and save once", async ({ page }) => {
  const { writes } = await installGridRolloutFixture(page);
  await login(page, "/hri/admin/form-types");
  const screen = page.getByRole("region", { name: "신청서 코드", exact: true });
  await edit(page, screen, 1, "form_name_ko", "임시 변경");
  await edit(page, screen, 1, "form_name_ko", "신청서 1");
  await expect(screen.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
  await screen.getByLabel("신청서 코드 2 삭제 표시", { exact: true }).check();
  await screen.getByRole("button", { name: "조회", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "무시하고 이동", exact: true }).click();
  await expect(screen.getByLabel("신청서 코드 2 삭제 표시", { exact: true })).not.toBeChecked();
  await edit(page, screen, 1, "form_name_ko", "실패 신청서");
  await screen.getByLabel("신청서 코드 2 삭제 표시", { exact: true }).check();
  await screen.getByLabel("신청서 코드 2 삭제 표시", { exact: true }).uncheck();
  await expect(screen.locator('.ag-row[row-id="2"] [col-id="status"]')).toHaveText("");
  await screen.getByLabel("신청서 코드 2 삭제 표시", { exact: true }).check();
  await screen.getByRole("button", { name: "입력", exact: true }).click();
  await edit(page, screen, -1, "form_code", "NEW_FORM");
  await edit(page, screen, -1, "form_name_ko", "새 신청서");
  expect(writes).toEqual([]);
  await screen.getByRole("button", { name: "변경 3건 저장", exact: true }).click();
  await expect(screen.getByRole("alert")).toContainText("초안을 확인");
  await expect(screen.getByRole("grid")).toContainText("새 신청서");
  await edit(page, screen, 1, "form_name_ko", "변경 신청서");
  await screen.getByRole("button", { name: "변경 3건 저장", exact: true }).click();
  await expect(screen.getByRole("status").filter({ hasText: "저장 완료" })).toContainText("입력 1건, 수정 1건, 삭제 1건");
  expect(writes).toHaveLength(2);
  expect(writes[1].body).toMatchObject({ delete_ids: [2], items: expect.arrayContaining([expect.objectContaining({ id: 1, form_name_ko: "변경 신청서" }), expect.objectContaining({ id: null, form_code: "NEW_FORM" })]) });
  await snapshot(page, "G01-form-codes.png");
});

test("template parent and edited steps stay in drafts when another template is selected", async ({ page }) => {
  const { writes } = await installGridRolloutFixture(page);
  await login(page, "/hri/admin/approval-lines");
  const screen = page.getByRole("region", { name: "결재선 템플릿", exact: true });
  await edit(page, screen, 1, "template_name", "수정 결재선");
  await screen.getByLabel("1단계 사용자 ID", { exact: true }).fill("2");
  await screen.getByRole("button", { name: "단계 추가", exact: true }).click();
  await edit(page, screen, 2, "template_name", "두 번째 수정");
  expect(writes).toEqual([]);
  await screen.getByRole("button", { name: "변경 2건 저장", exact: true }).click();
  await expect(screen.getByRole("status").filter({ hasText: "저장 완료" })).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0].body.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: 1, template_name: "수정 결재선", steps: expect.arrayContaining([expect.objectContaining({ step_order: 1, actor_user_id: 2 }), expect.objectContaining({ step_order: 2 })]) }), expect.objectContaining({ id: 2, template_name: "두 번째 수정" })]));
  await snapshot(page, "G02-approval-templates.png");
});

test("multiple schedule grids keep independent drafts and a clean grid cannot bypass navigation protection", async ({ page }) => {
  const { writes } = await installGridRolloutFixture(page);
  await login(page, "/tim/work-codes");
  const department = page.getByRole("region", { name: "조직 기본 근무패턴", exact: true });
  const employee = page.getByRole("region", { name: "개인 예외 근무조", exact: true });
  await page.getByLabel("추가할 조직", { exact: true }).selectOption("1");
  await page.getByLabel("조직 추가할 근무패턴", { exact: true }).selectOption("1");
  await department.getByRole("button", { name: "입력", exact: true }).click();
  await page.getByLabel("추가할 사원 검색", { exact: true }).fill("김");
  await page.getByRole("button", { name: "EMP-001 / 김테스트 / 인사팀", exact: true }).click();
  await page.getByLabel("개인 추가할 근무패턴", { exact: true }).selectOption("1");
  await employee.getByRole("button", { name: "입력", exact: true }).click();
  expect(writes).toEqual([]);
  await page.getByRole("navigation", { name: "열린 업무" }).getByRole("button", { name: "홈", exact: true }).click();
  const discard = page.getByRole("dialog", { name: "저장되지 않은 변경 사항이 있습니다.", exact: true });
  await expect(discard).toHaveCount(1);
  await discard.getByRole("button", { name: "취소", exact: true }).click();
  await department.getByRole("button", { name: "변경 1건 저장", exact: true }).click();
  await expect(department.getByRole("status").filter({ hasText: "저장 완료" })).toBeVisible();
  expect(writes).toHaveLength(1);
  await page.getByRole("navigation", { name: "열린 업무" }).getByRole("button", { name: "홈", exact: true }).click();
  await expect(discard).toHaveCount(1);
  await discard.getByRole("button", { name: "취소", exact: true }).click();
  await employee.getByRole("button", { name: "변경 1건 저장", exact: true }).click();
  await expect(employee.getByRole("status").filter({ hasText: "저장 완료" })).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(writes[0].body.items).toEqual([expect.objectContaining({ id: null, department_id: 1, pattern_id: 1 })]);
  expect(writes[1].body.items).toEqual([expect.objectContaining({ id: null, employee_id: 1, pattern_id: 1 })]);
  await snapshot(page, "G03-G04-schedules.png");
});

const readScreens = [
  ["G07", "/hri/my-payslip", "9월 급여"], ["G08", "/hr/severance/calcs", "임금 산입 근거"], ["G09", "/payroll/vouchers", "전표 라인"],
  ["G10", "/tim/leave-request", "휴가 사유 1"], ["G11", "/tim/month-close", "월별 마감 현황"], ["G11-alias", "/tim/month-closing", "월별 마감 현황"],
] as const;
for (const [name, path, content] of readScreens) {
  test(`${name} preserves readonly values and its specific document or action flow`, async ({ page }) => {
    const { writes } = await installGridRolloutFixture(page);
    await login(page, path);
    await expect(page.getByRole("main")).toContainText(content);
    await expect(page.getByRole("button", { name: "저장", exact: true })).toHaveCount(0);
    await expect(page.locator('.ag-cell-inline-editing')).toHaveCount(0);
    if (name === "G07") {
      await snapshot(page, "G07-payslip-list.png");
      await page.getByRole("grid").getByText("9월 급여", { exact: true }).click();
      await expect(page.locator("table")).toHaveCount(2);
      await expect(page.getByRole("main")).toContainText("기본급");
      await expect(page.getByRole("main")).toContainText("소득세");
    }
    if (name === "G08") { await expect(page.locator("table")).toHaveCount(1); await expect(page.getByRole("grid").last()).toContainText("9,000,000"); }
    if (name === "G09") { await expect(page.locator("table")).toHaveCount(0); await expect(page.getByRole("grid").last()).toContainText("3,000,000"); }
    if (name === "G10") {
      await page.locator('.ag-row[row-id="1"]').getByRole("button", { name: "취소", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "취소", exact: true }).click();
      await page.getByRole("button", { name: "다음", exact: true }).click();
      await expect(page.getByRole("grid")).toContainText("휴가 사유 51");
    }
    if (name.startsWith("G11")) {
      await expect(page.locator('.ag-center-cols-container .ag-row')).toHaveCount(12);
      await page.locator('.ag-row[row-id="1"]').getByRole("button", { name: "마감", exact: true }).click();
      await expect(page.getByRole("dialog")).toContainText("1월 근태를 마감");
      await page.getByRole("dialog").getByRole("button", { name: "취소", exact: true }).click();
    }
    expect(writes).toEqual([]);
    await snapshot(page, `${name}-readonly.png`);
  });
}

for (const [name, path] of [["G01", "/hri/admin/form-types"], ["G02", "/hri/admin/approval-lines"], ["G03-G04", "/tim/work-codes"], ...readScreens.map(([name, path]) => [name, path])] as const) {
  test(`${name} fits a narrow viewport without document overflow`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installGridRolloutFixture(page);
    await login(page, path);
    await expect(page.getByRole("grid").first()).toBeVisible();
    await snapshot(page, `${name}-mobile.png`);
    if (name === "G03-G04") {
      await page.getByRole("region", { name: "개인 예외 근무조", exact: true }).scrollIntoViewIfNeeded();
      await snapshot(page, "G04-personal-schedule-mobile.png");
      await page.getByRole("region", { name: "근무코드 목록", exact: true }).scrollIntoViewIfNeeded();
      await snapshot(page, "work-code-grid-mobile.png");
    }
  });
}


test("welfare status renders a styled label instead of literal HTML", async ({ page }) => {
  await installGridRolloutFixture(page);
  await login(page, "/wel/requests");
  const status = page.locator('.ag-center-cols-container .ag-row [col-id="status_code"]').first();
  await expect(status).toHaveText("승인 대기");
  await expect(status.locator("span.text-amber-600")).toBeVisible();
  await expect(page.getByRole("grid")).not.toContainText("<span");
  await snapshot(page, "welfare-status.png");
});
