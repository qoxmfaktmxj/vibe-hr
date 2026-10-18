import { expect, test, type Locator } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { LANDING_SCENES } from "./landing-media-fixture";
import { installLandingMotionFixture } from "./landing-motion-fixture";

test.skip(process.env.VIBEHR_CAPTURE_MOTION !== "1", "Explicit synthetic motion preparation only");

for (const [id, path, scenario, mode, tone] of LANDING_SCENES) {
  test(`prepare workflow ${id}`, async ({ page, request }) => {
    page.setDefaultTimeout(15000);
    await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario } });
    await page.addInitScript(({ mode, tone }) => localStorage.setItem("vibe_hr_theme_preferences", JSON.stringify({ darkMode: mode === "dark", paletteMode: "default", primaryTone: tone, chatbotButtonVisible: false })), { mode, tone });
    await page.goto("/login");
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30000 });
    const { writes } = await installLandingMotionFixture(page, id, scenario);
    await page.goto(path);
    const main = page.locator("#workspace-content");
    await expect(main).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    if (id === "03") await page.getByRole("navigation", { name: "인사 정보 탭" }).getByRole("button", { name: "학력", exact: true }).click();
    if (id === "16") await page.getByLabel("평가 선택", { exact: true }).selectOption("1");
    if (id === "02") await expect(page.getByRole("button", { name: "수정", exact: true })).toBeVisible();
    else if (id === "05") await expect(page.getByRole("heading", { name: "VIBE 본부", exact: true })).toBeVisible();
    else if (id === "17") await expect(page.getByRole("cell", { name: "사원관리 (demo.0)", exact: true }).first()).toBeVisible();
    else await expect(page.locator(".ag-center-cols-container .ag-row").first()).toBeVisible();
    const steps: { image: string; label: string; pointer: { x: number; y: number }; action: string; sha256: string; bytes: number }[] = [];
    let pointer = { x: .5, y: .3 };
    const query = page.getByRole("button", { name: "조회", exact: true }).first();
    const point = async (locator: Locator) => {
      const a = await locator.boundingBox(), b = await main.boundingBox();
      if (a && b) pointer = { x: Math.max(.03, Math.min(.97, (a.x + a.width / 2 - b.x) / b.width)), y: Math.max(.03, Math.min(.9, (a.y + a.height / 2 - b.y) / (b.width / 1.6))) };
    };
    const click = async (locator: Locator) => { const label = await locator.innerText(); await point(locator); await locator.click(); if (label === "조회") await page.waitForLoadState("networkidle"); };
    const frame = async (label: string, action = "click") => {
      await page.waitForTimeout(180);
      const box = (await main.boundingBox())!;
      const png = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, box.width / 1.6) } });
      const webp = await sharp(png).webp({ quality: 90 }).toBuffer();
      const filename = `${String(steps.length).padStart(2, "0")}.webp`;
      await mkdir(`public/images/product/motion/${id}`, { recursive: true });
      await writeFile(`public/images/product/motion/${id}/${filename}`, webp);
      steps.push({ image: `/images/product/motion/${id}/${filename}`, label, pointer: { ...pointer }, action, sha256: createHash("sha256").update(webp).digest("hex"), bytes: webp.length });
    };
    const edit = async (cell: Locator, value: string) => {
      await point(cell); await cell.dblclick();
      await page.locator(".ag-cell-inline-editing input").fill(value);
      await frame("값 수정", "type");
      await page.keyboard.press("Enter");
      await frame("저장 전 변경 확인", "inspect");
    };
    const align = async (title: Locator) => {
      const box = (await title.boundingBox())!;
      await main.evaluate((el, y) => { el.scrollTop += y - el.getBoundingClientRect().top - 24; }, box.y);
    };

    if (id === "01") {
      const employeeNo = page.getByPlaceholder("사번", { exact: true });
      await employeeNo.fill("EMP-001");
      await point(employeeNo); await frame("조회 조건 입력", "type"); await click(query);
      await expect(page.locator(".ag-center-cols-container .ag-row")).toHaveCount(1); await frame("조회 결과 확인");
      await edit(page.locator('.ag-center-cols-container .ag-row[row-id="1"] [col-id="display_name"]'), "김서윤");
      await click(page.getByRole("button", { name: "변경 1건 저장", exact: true }));
      await expect(page.getByRole("button", { name: "저장", exact: true })).toBeDisabled(); await frame("저장 완료");
    } else if (id === "02") {
      await point(page.getByPlaceholder("사번/이름 검색")); await frame("구성원 정보 조회", "inspect");
      await click(page.getByRole("button", { name: "수정", exact: true }));
      const input = page.getByLabel("직무", { exact: true }); await point(input); await input.fill("인사 기획"); await frame("직무 수정", "type");
      await point(page.getByRole("button", { name: "기본정보 저장", exact: true })); await frame("변경 내용 확인", "inspect");
      await click(page.getByRole("button", { name: "기본정보 저장", exact: true }));
      await expect(page.getByRole("status").filter({ hasText: "기본정보가 저장되었습니다." })).toBeVisible(); await frame("저장 완료");
    } else if (id === "03") {
      await click(query); await expect(page.getByRole("grid")).toContainText("학력 A"); await frame("학력 이력 조회");
      await edit(page.locator('.ag-center-cols-container .ag-row[row-id="101"] [col-id="title"]'), "대학 A 경영학과");
      await click(page.getByRole("button", { name: "변경 1건 저장", exact: true }));
      await expect(page.getByRole("status").filter({ hasText: "저장 완료:" })).toBeVisible(); await frame("저장 완료");
    } else if (id === "04") {
      await click(query); await frame("대기 문서 조회");
      await click(page.locator('.ag-cell[col-id="request_no"]').filter({ hasText: "DOC-103" }));
      await expect(page.getByRole("region", { name: "결재 문서 상세" })).toContainText("신청 103 상세 사유"); await frame("문서 내용 확인");
      await click(page.getByRole("button", { name: "문서 승인", exact: true })); await expect(page.getByRole("dialog")).toBeVisible(); await frame("승인 전 확인");
      await click(page.getByRole("button", { name: "처리 확인", exact: true }));
      await expect(page.getByRole("status").filter({ hasText: "1건 중 1건 완료" })).toBeVisible(); await frame("승인 처리 완료");
    } else if (id === "05") {
      await click(page.getByRole("button", { name: "전체 접기", exact: true })); await frame("조직 구조 확인");
      await click(page.getByRole("button", { name: "전체 펼치기", exact: true })); await frame("하위 조직 펼치기");
      const search = page.getByPlaceholder("조직코드, 조직명, 유형, COST CENTER, 인원 검색"); await point(search); await search.fill("인사팀"); await frame("조직 검색", "type");
      await expect(page.getByRole("heading", { name: "인사팀", exact: true })).toBeVisible(); await frame("조직 관계 확인", "inspect");
    } else if (id === "06") {
      const region = page.getByRole("region", { name: "조직 기본 근무패턴", exact: true }); await align(region);
      const query = region.getByRole("button", { name: "조회", exact: true }); await click(query); await frame("조직 배정 조회");
      await region.locator('.ag-body-horizontal-scroll-viewport').evaluate(el => { el.scrollLeft = el.scrollWidth; });
      await edit(region.locator('.ag-center-cols-container .ag-row[row-id="101"] [col-id="priority"]'), "200");
      await click(region.getByRole("button", { name: "변경 1건 저장", exact: true }));
      await expect(region.getByRole("button", { name: "저장", exact: true })).toBeDisabled(); await frame("배정 저장 완료");
    } else if (id === "07") {
      await point(main.locator('input[type="date"]').first()); await frame("조회 기간 선택", "inspect");
      await click(query); await expect(page.getByRole("grid")).toContainText("김서윤"); await frame("근태 조회");
      await click(page.locator('.ag-center-cols-container .ag-row[row-id="4"] [col-id="employee_name"]')); await frame("대상자 선택");
      await point(page.locator('.ag-center-cols-container .ag-row[row-id="4"] [col-id="attendance_status"]')); await frame("근태 상태 확인", "inspect");
    } else if (id === "08") {
      await click(query); await frame("월별 마감 조회");
      const close = page.locator('.ag-pinned-right-cols-container .ag-row[row-id="1"]').getByRole("button", { name: "마감", exact: true });
      await click(close); await expect(page.getByRole("dialog")).toBeVisible(); await frame("마감 전 확인");
      await page.getByPlaceholder("마감 사유 또는 메모").fill("월별 집계 확인 완료"); await point(page.getByPlaceholder("마감 사유 또는 메모")); await frame("처리 메모", "type");
      await click(page.getByRole("dialog").getByRole("button", { name: "마감", exact: true }));
      await expect(page.locator('.ag-center-cols-container .ag-row[row-id="1"]')).toContainText("마감완료"); await frame("월마감 완료");
    } else if (id === "10") {
      await click(query); await frame("월별 급여 조회");
      await click(page.locator('.ag-cell[col-id="year_month"]').first());
      await expect(page.getByText("기본급", { exact: true })).toBeVisible(); await frame("급여 명세서 선택");
      await point(page.getByRole("heading", { name: "수당 내역", exact: true })); await frame("수당 확인", "inspect");
      await point(page.getByRole("heading", { name: "공제 내역", exact: true })); await frame("공제 확인", "inspect");
    } else if (id === "11") {
      await click(query); await frame("급여 실행 조회");
      await click(page.locator('.ag-cell[col-id="run_name"]').first()); await expect(page.getByRole("grid").nth(1)).toContainText("김서윤"); await frame("실행 대상자 확인");
      await click(page.locator('.ag-cell[col-id="employee_name"]').first()); await frame("대상자 선택");
      await point(page.locator('.ag-cell[col-id="net_pay"]').first()); await frame("지급 집계 확인", "inspect");
    } else if (id === "12" || id === "13") {
      await click(query); await frame(id === "12" ? "급여 전표 조회" : "퇴직금 산정 조회");
      await click(page.locator(`.ag-cell[col-id="${id === "12" ? "voucher_no" : "employee_no"}"]`).first());
      await expect(page.getByRole("grid").last()).toContainText(id === "12" ? "미지급금" : "전액산입");
      await align(page.getByText(id === "12" ? "전표 상세" : "퇴직금 산정 상세", { exact: true })); await frame("상세 내역 선택");
      await point(page.getByText(id === "12" ? "전표 라인" : "임금 산입 근거", { exact: true })); await frame(id === "12" ? "차변과 대변 대조" : "임금 산입 근거 확인", "inspect");
      await point(page.getByRole("grid").last().locator('.ag-cell').last()); await frame("산출 근거 확인", "inspect");
    } else if (id === "14") {
      await click(query); await frame("복리후생 신청 조회");
      await click(page.locator('.ag-cell[col-id="request_no"]').first()); await frame("신청 대상 선택");
      await click(page.getByRole("button", { name: "승인", exact: true })); await expect(page.getByRole("dialog")).toBeVisible(); await frame("승인 금액 확인");
      await click(page.getByRole("dialog").getByRole("button", { name: "승인", exact: true }));
      await expect(page.locator('.ag-cell[col-id="status_code"]')).toContainText("승인"); await frame("승인 처리 완료");
    } else if (id === "15") {
      await click(query); await frame("교육 신청 조회");
      const checkbox = page.locator('.ag-row[row-id="101"] input[type="checkbox"]'); await point(checkbox); await checkbox.check(); await frame("승인 대상 선택");
      await click(page.getByRole("button", { name: "승인", exact: true })); await expect(page.getByRole("dialog", { name: "교육 신청 승인", exact: true })).toBeVisible(); await frame("승인 전 확인");
      await click(page.getByRole("dialog").getByRole("button", { name: "승인", exact: true }));
      await expect(page.locator('.ag-row[row-id="101"] [col-id="status"]')).toHaveText("승인"); await frame("교육 승인 완료");
    } else if (id === "16") {
      await click(query); await frame("평가 대상 조회");
      await edit(page.locator('.ag-center-cols-container .ag-row[row-id="1"] [col-id="evaluator_note"]'), "목표 달성 근거 확인");
      await click(page.getByRole("button", { name: /저장/ }).first());
      await expect(page.getByText(/저장 완료 \(신규 0, 수정 1, 삭제 0\)/)).toBeVisible(); await frame("평가 저장 완료");
    } else if (id === "17") {
      const search = page.getByPlaceholder("메뉴명 또는 코드 검색"); await point(search); await search.fill("사원관리"); await frame("메뉴 검색", "type");
      const row = page.getByRole("row", { name: "사원관리 (demo.0)", exact: true }).first();
      const checkbox = row.getByRole("checkbox").nth(1); await point(checkbox); await checkbox.uncheck(); await frame("역할 권한 수정");
      const save = page.getByRole("button", { name: "메뉴 권한 저장", exact: true }); await point(save); await frame("변경 권한 확인", "inspect"); await click(save);
      await expect(page.getByText("메뉴 권한 저장이 완료되었습니다.", { exact: true })).toBeVisible(); await expect(checkbox).not.toBeChecked(); await frame("권한 저장 완료");
    }
    expect(steps.length).toBeGreaterThanOrEqual(4);
    const writeScenes = ["01", "02", "03", "04", "06", "08", "14", "15", "16", "17"];
    expect(writes.length).toBe(writeScenes.includes(id) ? 1 : 0);
    await mkdir("output/landing-20261018/motion", { recursive: true });
    await writeFile(`output/landing-20261018/motion/${id}.json`, JSON.stringify({ id, route: path, theme: mode, tone, synthetic: true, steps, writes }, null, 2));
  });
}
