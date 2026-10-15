import { expect, test, type Page, type Route } from "@playwright/test";

import type { PapAppraisalTargetItem } from "../../src/types/pap-appraisal";

const NOW = "2026-10-15T00:00:00Z";
const employees = [
  { id: 27, employee_no: "EMP-027", display_name: "김평가", department_name: "인사팀" },
  { id: 28, employee_no: "EMP-028", display_name: "김평가", department_name: "개발팀" },
];

function target(appraisalId: number): PapAppraisalTargetItem {
  return {
    id: 100 + appraisalId, appraisal_id: appraisalId, appraisal_name: `평가${appraisalId}`,
    employee_id: appraisalId, employee_no: `BASE-00${appraisalId}`, employee_name: `기존직원${appraisalId}`,
    department_name: "인사팀", score: 80, grade_code: null, evaluator_note: null,
    status: "pending", evaluated_at: null, created_at: NOW, updated_at: NOW,
  };
}

async function reply(route: Route, data: unknown) {
  await route.fulfill({ contentType: "application/json", body: JSON.stringify(data) });
}

async function installRoutes(page: Page) {
  const targets = [target(1), target(2)];
  const reads: number[] = [];
  const writes: Array<{ items: Array<Record<string, unknown>> }> = [];
  const employeeSearches: URL[] = [];
  await page.route("**/api/**", async (route) => {
    if (route.request().method() === "GET") return route.fallback();
    throw new Error(`Unexpected write outside isolated appraisal fixture: ${route.request().url()}`);
  });
  await page.route("**/api/employees?**", async (route) => {
    const url = new URL(route.request().url());
    employeeSearches.push(url);
    const results = employees.filter((employee) =>
      (!url.searchParams.get("name") || employee.display_name.includes(url.searchParams.get("name")!))
      && (!url.searchParams.get("employee_no") || employee.employee_no.includes(url.searchParams.get("employee_no")!)),
    );
    await reply(route, { employees: results, total_count: results.length });
  });
  await page.route("**/api/pap/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/pap/appraisals" && route.request().method() === "GET") {
      return reply(route, {
        items: [1, 2].map((id) => ({ id, appraisal_name: `평가${id}`, appraisal_year: 2026 })),
        total_count: 2, page: 1, limit: 100,
      });
    }
    if (url.pathname === "/api/pap/targets" && route.request().method() === "GET") {
      const id = Number(url.searchParams.get("appraisal_id"));
      reads.push(id);
      const items = targets.filter((row) => row.appraisal_id === id);
      return reply(route, { items, total_count: items.length });
    }
    if (url.pathname === "/api/pap/targets/batch" && route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { items: Array<Record<string, unknown>> };
      writes.push(body);
      let created = 0;
      let updated = 0;
      for (const row of body.items) {
        if (row._status === "updated") {
          const existing = targets.find((item) => item.id === row.id);
          if (!existing) throw new Error("Unknown target update.");
          if (row.clear_score === true) existing.score = null;
          else if (row.score != null) existing.score = Number(row.score);
          updated++;
          continue;
        }
        const employee = employees.find((item) => item.id === row.employee_id);
        if (!employee || row._status !== "added") throw new Error("Invalid employee or unexpected batch operation.");
        targets.push({
          ...target(Number(row.appraisal_id)), ...row, id: 200 + employee.id,
          employee_id: employee.id, employee_no: employee.employee_no,
          employee_name: employee.display_name, department_name: employee.department_name,
        } as PapAppraisalTargetItem);
        created++;
      }
      return reply(route, { created, updated, deleted: 0 });
    }
    throw new Error(`Unexpected appraisal request: ${route.request().method()} ${url.pathname}`);
  });
  return { targets, reads, writes, employeeSearches };
}

async function openAppraisal(page: Page) {
  await page.goto("/pap/targets");
  await page.getByLabel("평가 선택", { exact: true }).selectOption("1");
  await expect(page.locator('.ag-row[row-id="101"]')).toContainText("BASE-001");
}

async function editNote(page: Page, rowId: number, note: string) {
  const cell = page.locator(`.ag-row[row-id="${rowId}"] [col-id="evaluator_note"]`);
  await cell.dblclick();
  await cell.locator("input").fill(note);
}

test.beforeEach(async ({ page, request }) => {
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "appraisal-targets" } });
  await page.goto("/login");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`selected employee creates a real appraisal target at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const fixture = await installRoutes(page);
    await openAppraisal(page);
    await page.getByRole("button", { name: "행추가", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "평가 대상자 선택" });
    await dialog.getByRole("textbox", { name: "이름", exact: true }).fill("없는직원");
    await dialog.getByRole("button", { name: "사원 검색", exact: true }).click();
    await expect(dialog.getByText("검색 결과 0건", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "사원 검색", exact: true })).toBeEnabled();
    await dialog.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(page.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
    expect(fixture.writes).toEqual([]);

    await page.getByRole("button", { name: "행추가", exact: true }).click();
    await dialog.getByRole("textbox", { name: "이름", exact: true }).fill("김");
    await dialog.getByRole("button", { name: "사원 검색", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "김평가 (EMP-028) / 개발팀", exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("employee-selection.png"), fullPage: true });
    await dialog.getByRole("button", { name: "김평가 (EMP-027) / 인사팀", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('.ag-row[row-id="-1"]')).toContainText("EMP-027");
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
    await expect(page.locator('.ag-row[row-id="227"]')).toContainText("김평가");
    expect(fixture.writes).toEqual([{ items: [{
      appraisal_id: 1, employee_id: 27, score: null, grade_code: null,
      evaluator_note: null, status: "pending", _status: "added",
    }] }]);
    for (const search of fixture.employeeSearches) {
      expect(search.searchParams.get("page")).toBe("1");
      expect(search.searchParams.get("limit")).toBe("50");
      expect(search.searchParams.has("all")).toBe(false);
    }
    await page.screenshot({ path: test.info().outputPath("appraisal-target-saved.png"), fullPage: true });
  });
}

test("query and appraisal changes preserve dirty edits on cancel and discard only after confirmation", async ({ page }) => {
  const fixture = await installRoutes(page);
  await openAppraisal(page);
  await editNote(page, 101, "저장 전 평가 메모");
  await page.getByRole("button", { name: "조회", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "저장되지 않은 변경 사항이 있습니다." });
  await expect(dialog).toBeVisible();
  expect(fixture.reads).toEqual([1]);
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.locator('.ag-row[row-id="101"]')).toContainText("저장 전 평가 메모");
  await page.getByLabel("평가 선택", { exact: true }).selectOption("2");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByLabel("평가 선택", { exact: true })).toHaveValue("1");
  await expect(page.locator('.ag-row[row-id="101"]')).toContainText("저장 전 평가 메모");
  expect(fixture.reads).toEqual([1]);
  await page.getByLabel("평가 선택", { exact: true }).selectOption("2");
  await dialog.getByRole("button", { name: "무시하고 이동", exact: true }).click();
  await expect(page.locator('.ag-row[row-id="102"]')).toContainText("BASE-002");
  await expect(page.getByLabel("평가 선택", { exact: true })).toHaveValue("2");

  await editNote(page, 102, "조회 전 메모");
  await page.getByRole("button", { name: "조회", exact: true }).last().click();
  await dialog.getByRole("button", { name: "무시하고 이동", exact: true }).click();
  await expect(page.locator('.ag-row[row-id="102"]')).not.toContainText("조회 전 메모");
  await expect(page.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
  expect(fixture.reads).toEqual([1, 2, 2]);
  expect(fixture.writes).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("dirty-navigation-verified.png"), fullPage: true });
});

test("invalid numeric scores cannot be saved and clearing an existing score persists null", async ({ page }) => {
  const fixture = await installRoutes(page);
  await openAppraisal(page);
  const scoreCell = () => page.locator('.ag-row[row-id="101"] [col-id="score"]');
  await expect(scoreCell()).toHaveText("80");
  for (const invalid of ["숫자아님", "Infinity"]) {
    await scoreCell().dblclick();
    await scoreCell().locator("input").fill(invalid);
    await scoreCell().locator("input").press("Enter");
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText("점수는 올바른 숫자로 입력해주세요.", { exact: true }).first()).toBeVisible();
    expect(fixture.writes).toEqual([]);
    expect(fixture.targets[0].score).toBe(80);
  }
  await scoreCell().dblclick();
  await scoreCell().locator("input").fill("");
  await scoreCell().locator("input").press("Enter");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
  await expect(scoreCell()).toBeEmpty();
  expect(fixture.writes).toEqual([{ items: [{
    id: 101, appraisal_id: 1, employee_id: 1, score: null, clear_score: true,
    grade_code: null, evaluator_note: null, status: "pending", _status: "updated",
  }] }]);
  expect(fixture.targets[0].score).toBeNull();
  await page.getByRole("button", { name: "조회", exact: true }).first().click();
  await expect(scoreCell()).toBeEmpty();
  await page.screenshot({ path: test.info().outputPath("cleared-score-saved.png"), fullPage: true });
});
