import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { LANDING_SCENES, installLandingMediaReads } from "./landing-media-fixture";

// Opt-in asset production against the owned synthetic backend only.
test.skip(process.env.VIBEHR_CAPTURE_LANDING !== "1", "Explicit synthetic asset capture only");

for (const [id, path, scenario, mode, tone] of LANDING_SCENES) {
  test(`capture synthetic scene ${id}`, async ({ page, request }) => {
    await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario } });
    await page.addInitScript(({ mode, tone }) => localStorage.setItem("vibe_hr_theme_preferences", JSON.stringify({ darkMode: mode === "dark", paletteMode: "default", primaryTone: tone, chatbotButtonVisible: false })), { mode, tone });
    await page.goto("/login");
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30000 });
    await installLandingMediaReads(page, id, scenario);
    const writes: string[] = [];
    page.on("request", req => { if (req.url().includes("/api/") && req.method() !== "GET") writes.push(req.url()); });
    await page.goto(path);
    await expect(page.locator("#workspace-content")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    if (id === "03") await page.getByRole("navigation", { name: "인사 정보 탭" }).getByRole("button", { name: "학력", exact: true }).click();
    if (id === "04") await page.locator('.ag-cell[col-id="request_no"]').filter({ hasText: "DOC-103" }).click();
    if (id === "16") await page.getByLabel("평가 선택", { exact: true }).selectOption("1");
    if (id === "17") await expect(page.getByRole("cell", { name: "사원관리 (demo.0)", exact: true }).first()).toBeVisible();
    else if (id === "05") await expect(page.getByRole("heading", { name: "VIBE 본부", exact: true })).toBeVisible();
    else if (id === "02") await expect(page.getByRole("button", { name: "수정", exact: true })).toBeVisible();
    else await expect(page.locator('.ag-center-cols-container .ag-row').first()).toBeVisible();
    if (id === "12") await page.locator('.ag-cell[col-id="voucher_no"]').first().click();
    if (id === "13") await page.locator('.ag-cell[col-id="employee_no"]').first().click();
    if (id === "11") await page.locator('.ag-cell[col-id="run_name"]').first().click();
    if (id === "10") await page.locator('.ag-cell[col-id="year_month"]').first().click();
    if (id === "04") await expect(page.getByRole("region", { name: "결재 문서 상세" })).toContainText("신청 103 상세 사유");
    if (id === "10") await expect(page.getByText("기본급", { exact: true })).toBeVisible();
    if (id === "12") await expect(page.getByRole("grid").last()).toContainText("미지급금");
    if (id === "13") await expect(page.getByRole("grid").last()).toContainText("전액산입");
    if (id === "01" || id === "03") {
      const cell = page.locator(`.ag-center-cols-container .ag-row[row-id="${id === "01" ? "1" : "101"}"] [col-id="${id === "01" ? "display_name" : "title"}"]`);
      await cell.dblclick();
      await page.locator(".ag-cell-inline-editing input").fill(id === "01" ? "김서윤" : "대학 A 경영학과");
      await page.keyboard.press("Enter");
      await expect(page.getByRole("button", { name: /변경.*저장/ })).toBeEnabled();
    }
    if (id === "06") await page.getByRole("region", { name: "조직 기본 근무패턴", exact: true }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(400); // Let grid column layout and selected-detail render settle for pixels.
    const main = page.locator("#workspace-content");
    if (id === "06") await main.evaluate(el => { const region = el.querySelector('[aria-label="조직 기본 근무패턴"]'); if (region) el.scrollTop += region.getBoundingClientRect().top - el.getBoundingClientRect().top - 24; });
    if (id === "12" || id === "13") {
      const title = page.getByText(id === "12" ? "전표 상세" : "퇴직금 산정 상세", { exact: true });
      const titleBox = (await title.boundingBox())!;
      await main.evaluate((el, top) => { el.scrollTop += top - el.getBoundingClientRect().top - 24; }, titleBox.y);
    }
    const box = await main.boundingBox();
    if (!box) throw new Error("Missing product content");
    const png = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, box.width / 1.6) } });
    const webp = await sharp(png).webp({ quality: 90 }).toBuffer();
    await mkdir("public/images/product", { recursive: true });
    await mkdir("output/landing-20261018/captures", { recursive: true });
    await writeFile(`public/images/product/${id}.webp`, webp);
    await writeFile(`output/landing-20261018/captures/${id}.json`, JSON.stringify({ id, route: path, scenario, mode, tone, synthetic: true, contentOnly: true, bytes: webp.length, sha256: createHash("sha256").update(webp).digest("hex"), writes }, null, 2));
    expect(writes).toEqual([]);
  });
}
