import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { PRODUCT_SCENES } from "../../src/components/landing/scenes";

async function screenshot(page: Page, name: string) {
  await mkdir("output/landing-20261018", { recursive: true });
  await page.screenshot({ path: `output/landing-20261018/${name}.png`, fullPage: false });
}

test("public introduction makes no business/session requests and leads to login", async ({ page, request }) => {
  await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "default" } });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const calls: string[] = [];
  page.on("request", req => { if (new URL(req.url()).pathname.startsWith("/api/")) calls.push(req.url()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("하나의 흐름으로");
  await expect(page.getByRole("button", { name: /확대$/ })).toHaveCount(17);
  await expect(page).toHaveURL("/");
  expect(calls).toEqual([]);
  await page.getByRole("link", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL("/login");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30000 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("사람과 일");
});

test("all 17 enlarged scenes load and modal focus returns without business writes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const writes: string[] = [], errors: string[] = [];
  page.on("request", req => { if (req.method() !== "GET") writes.push(req.url()); });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  const first = page.getByRole("button", { name: "01 사원관리 확대", exact: true });
  await first.click();
  for (let index = 0; index < 17; index++) {
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.locator("img").evaluateAll(images => images.every(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
    if (index < 16) await dialog.getByRole("button", { name: "다음 확대 화면", exact: true }).click();
  }
  await expect(page.getByRole("button", { name: "다음 확대 화면", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(first).toBeFocused();
  expect(writes).toEqual([]); expect(errors).toEqual([]);
});

for (const width of [390, 768, 1440]) {
  test(`static gallery and enlarged image remain reachable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("main")).toHaveAttribute("data-mode", "list");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await screenshot(page, `list-${width}`);
    await page.getByLabel("장면 바로 이동", { exact: true }).selectOption("16");
    await page.getByRole("button", { name: "17 운영 설정 확대", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await screenshot(page, `detail-${width}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest("dialog")))).toBe(true);
    await page.getByRole("button", { name: "확대 화면 닫기", exact: true }).click();
    await expect(page.getByRole("button", { name: "17 운영 설정 확대", exact: true })).toBeFocused();
  });
}

test("3D wheel, primary drag, click threshold, screen hit and keyboard navigation", async ({ page }) => {
  await page.goto("/");
  const canvas = page.getByTestId("product-gallery");
  await expect(canvas).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.waitForTimeout(1000);
  await screenshot(page, "space-desktop");
  await canvas.hover();
  await page.mouse.wheel(0, 110);
  await expect(page.getByLabel("장면 바로 이동", { exact: true })).toHaveValue("0");
  await page.waitForTimeout(1000);
  const before = await canvas.getAttribute("data-view");
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 40, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => canvas.getAttribute("data-view")).not.toBe(before);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await screenshot(page, "space-dragged");
  await page.getByLabel("장면 바로 이동", { exact: true }).selectOption("3");
  await page.waitForTimeout(1200);
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(page.getByRole("dialog")).toContainText("결재 상세");
  await screenshot(page, "space-enlarged");
  await page.keyboard.press("Escape");
  await expect(canvas).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("장면 바로 이동", { exact: true })).toHaveValue("4");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toContainText("조직도");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "전체 공간 보기", exact: true }).click();
  await expect(page.getByLabel("장면 바로 이동", { exact: true })).toHaveValue("");
});

test("3D list toggle and responsive mode switch release the canvas", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("product-gallery")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "목록으로 보기", exact: true }).click();
  await expect(page.getByTestId("product-gallery")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /확대$/ })).toHaveCount(17);
  await page.getByRole("button", { name: "공간으로 보기", exact: true }).click();
  await expect(page.getByTestId("product-gallery")).toHaveAttribute("data-ready", "true");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("product-gallery")).toHaveCount(0);
  await expect(page.locator("main")).toHaveAttribute("data-mode", "list");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByTestId("product-gallery")).toHaveAttribute("data-ready", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByTestId("product-gallery")).toHaveCount(0);
});

test("every room frame can be reached and clicked, with bounded navigation", async ({ page }) => {
  await page.goto("/");
  const canvas = page.getByTestId("product-gallery");
  const jump = page.getByLabel("장면 바로 이동", { exact: true });
  await expect(canvas).toHaveAttribute("data-ready", "true");
  const box = (await canvas.boundingBox())!;
  for (let index = 0; index < 17; index++) {
    await jump.selectOption(String(index));
    await page.waitForTimeout(1100);
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
    await expect(page.getByRole("dialog").getByRole("heading", { level: 2 })).toHaveText(PRODUCT_SCENES[index].title);
    await page.keyboard.press("Escape");
  }
  await expect(page.getByRole("button", { name: "다음 장면", exact: true })).toBeDisabled();
  await canvas.press("ArrowRight");
  await expect(jump).toHaveValue("16");
  await page.getByRole("button", { name: "전체 공간 보기", exact: true }).click();
  await page.waitForTimeout(1100);
  await canvas.hover();
  await page.mouse.down({ button: "right" });
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 20);
  await page.mouse.up({ button: "right" });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 20, { steps: 10 });
  await page.mouse.up();
  await page.getByRole("button", { name: "전체 공간 보기", exact: true }).click();
  await expect.poll(() => canvas.getAttribute("data-view")).toMatch(/,0\.000,0\.000$/);
  await canvas.press("ArrowLeft");
  await expect(jump).toHaveValue("");
});

test("WebGL creation failure and context loss preserve access to all scenes", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type.startsWith("webgl")) return null;
      return original.call(this, type, ...args);
    } as typeof original;
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("목록으로");
  await expect(page.getByRole("button", { name: /확대$/ })).toHaveCount(17);
});

test("losing a running gallery context falls back without navigation loss", async ({ page }) => {
  await page.goto("/");
  const canvas = page.getByTestId("product-gallery");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await canvas.evaluate(el => el.dispatchEvent(new Event("webglcontextlost", { cancelable: true })));
  await expect(page.getByRole("status")).toContainText("목록으로");
  await page.getByRole("button", { name: "09 사람이 중심이 되는 공간 확대", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("clicking the center frame starts water automatically and closing releases it", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("product-gallery")).toHaveAttribute("data-ready", "true");
  await page.getByLabel("장면 바로 이동", { exact: true }).selectOption("8");
  await expect(page.getByTestId("water-exhibit")).toHaveCount(0);
  await page.waitForTimeout(1100);
  const gallery = page.getByTestId("product-gallery");
  const box = (await gallery.boundingBox())!;
  await gallery.click({ position: { x: box.width / 2, y: box.height / 2 } });
  const water = page.getByTestId("water-exhibit");
  await expect(water).toHaveAttribute("data-ready", "true", { timeout: 45000 });
  const before = await water.getAttribute("data-frame");
  await water.hover({ position: { x: 300, y: 400 } });
  await expect.poll(() => water.getAttribute("data-frame")).not.toBe(before);
  await screenshot(page, "water-live");
  await page.getByRole("button", { name: "장면 정지", exact: true }).click();
  await expect(water).toHaveCount(0);
  await page.getByRole("button", { name: "물결 장면 재생", exact: true }).click();
  await expect(water).toHaveAttribute("data-ready", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(water).toHaveCount(0);
  await page.getByRole("button", { name: "화면 확대", exact: true }).click();
  await expect(water).toHaveAttribute("data-ready", "true");
});

test("opening water with reduced motion keeps the static poster without loading textures", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const textures: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/images/conservatory/")) textures.push(request.url()); });
  await page.goto("/");
  await page.getByRole("button", { name: "09 사람이 중심이 되는 공간 확대", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("img", { name: "물결과 진주, 분홍빛 정원으로 이루어진 기존 VIBE-HR 배경" })).toBeVisible();
  await expect(page.getByTestId("water-exhibit")).toHaveCount(0);
  expect(textures).toEqual([]);
});

test("public navigation does not expose protected routes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/hr/employee");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fhr%2Femployee$/);
  await page.goto("/");
  const links = await page.getByRole("link").evaluateAll(nodes => nodes.map(node => node.getAttribute("href")));
  expect(links.every(href => href === "/" || href === "/login" || href?.startsWith("#"))).toBe(true);
});

test("wide gallery preserves its palette under saved dark app preferences", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("vibe_hr_theme_preferences", JSON.stringify({ darkMode: true, paletteMode: "vivid", primaryTone: "red" })));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await expect(page.getByTestId("product-gallery")).toHaveAttribute("data-ready", "true");
  await page.waitForTimeout(1200);
  expect(await page.locator("main").evaluate(el => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await screenshot(page, "space-wide");
  const wideDepth = Number((await page.getByTestId("product-gallery").getAttribute("data-view"))!.split(",")[1]);
  await page.setViewportSize({ width: 1175, height: 1252 });
  await expect.poll(async () => Number((await page.getByTestId("product-gallery").getAttribute("data-view"))!.split(",")[1])).toBeGreaterThan(wideDepth + 3);
  await page.waitForTimeout(800);
  await screenshot(page, "space-tall");
});

for (const viewport of [{ width: 900, height: 720 }, { width: 1440, height: 1000 }, { width: 1175, height: 1252 }]) {
  test(`white canvas fills the viewport below the inline title at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const canvas = page.getByTestId("product-gallery");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    const box = (await canvas.boundingBox())!;
    const brand = (await page.getByRole("link", { name: "VIBE-HR 제품 소개", exact: true }).boundingBox())!;
    const title = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
    expect(box.x).toBe(0); expect(box.width).toBe(viewport.width);
    expect(box.y).toBe(64); expect(box.height).toBe(viewport.height - 64);
    expect(title.x).toBeGreaterThan(brand.x + brand.width);
    expect(Math.abs(title.y + title.height / 2 - brand.y - brand.height / 2)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const whitePatch = await page.screenshot({ clip: { x: viewport.width / 2, y: box.y + 90, width: 4, height: 4 } });
    const pixels = await sharp(whitePatch).removeAlpha().raw().toBuffer();
    expect([...pixels].every(value => value === 255)).toBe(true);
    await expect(page.getByRole("link", { name: "로그인", exact: true })).toBeVisible();
    const next = page.getByRole("button", { name: "다음 장면", exact: true });
    expect(await next.evaluate(el => { const rect = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)); })).toBe(true);
    await screenshot(page, `white-canvas-${viewport.width}x${viewport.height}`);
  });
}
