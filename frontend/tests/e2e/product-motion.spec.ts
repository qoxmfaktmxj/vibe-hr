import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { PRODUCT_SCENES } from "../../src/components/landing/scenes";

const activePlayers = '[data-motion-playing="true"]';

test("water preview plays alone, pauses, and hands control to the live brand scene", async ({ page }) => {
  const textures: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/images/conservatory/")) textures.push(request.url()); });
  await page.goto("/");
  const gallery = page.getByTestId("product-gallery");
  await expect(gallery).toHaveAttribute("data-ready", "true");
  await page.getByLabel("장면 바로 이동", { exact: true }).selectOption("8");
  await expect(gallery).toHaveAttribute("data-motion-scene", "09");
  await expect(gallery).toHaveAttribute("data-motion-playing", "true");
  const time = await gallery.getAttribute("data-motion-time");
  await expect.poll(() => gallery.getAttribute("data-motion-time")).not.toBe(time);
  expect(textures).toEqual([]);
  await page.getByRole("button", { name: "시연 일시 정지", exact: true }).click();
  await expect(gallery).toHaveAttribute("data-motion-playing", "false");
  const paused = await gallery.getAttribute("data-motion-time");
  await page.waitForTimeout(350);
  expect(await gallery.getAttribute("data-motion-time")).toBe(paused);
  await page.getByRole("button", { name: "시연 재생", exact: true }).click();
  await expect(gallery).toHaveAttribute("data-motion-playing", "true");
  await page.getByRole("button", { name: "화면 확대", exact: true }).click();
  await expect(page.getByTestId("water-exhibit")).toHaveAttribute("data-ready", "true", { timeout: 45000 });
  await expect(gallery).toHaveAttribute("data-motion-playing", "false");
  await expect(page.getByRole("dialog").getByRole("img", { name: "사람이 중심이 되는 VIBE-HR", exact: true })).toBeAttached();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("water-exhibit")).toHaveCount(0);
  await expect(gallery).toHaveAttribute("data-motion-playing", "true");
  await page.getByLabel("장면 바로 이동", { exact: true }).selectOption("0");
  await expect(gallery).toHaveAttribute("data-motion-scene", "01");
  await expect(page.locator(activePlayers)).toHaveCount(1);
});

test("water list preview pauses offscreen and reduced motion avoids the video", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");
  const item = page.getByRole("button", { name: "09 사람이 중심이 되는 공간 확대", exact: true });
  await item.evaluate(el => el.scrollIntoView({ block: "center" }));
  const motion = page.getByTestId("product-motion");
  await expect(motion).toHaveAttribute("data-motion-scene", "09");
  await expect(motion).toHaveAttribute("data-motion-playing", "true");
  await expect(page.locator(activePlayers)).toHaveCount(1);
  await motion.evaluate(el => { el.style.transform = "translateY(300vh)"; });
  await expect(motion).toHaveAttribute("data-motion-playing", "false");
  await motion.evaluate(el => { el.style.transform = ""; });
  await expect(motion).toHaveAttribute("data-motion-playing", "true");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(motion).toHaveAttribute("data-motion-playing", "false");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(motion).toHaveAttribute("data-motion-playing", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const videos: string[] = [];
  page.on("request", request => { if (request.url().includes("/09/preview.mp4")) videos.push(request.url()); });
  await page.reload();
  await item.evaluate(el => el.scrollIntoView({ block: "center" }));
  await expect(page.getByTestId("product-motion")).toHaveCount(0);
  expect(videos).toEqual([]);
});

test("the enlarged water brand visibly flows under the real pointer and settles afterward", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await expect(page.getByTestId("product-gallery")).toHaveAttribute("data-ready", "true");
  await page.getByLabel("장면 바로 이동", { exact: true }).selectOption("8");
  await page.getByRole("button", { name: "화면 확대", exact: true }).click();
  const water = page.getByTestId("water-exhibit");
  await expect(water).toHaveAttribute("data-ready", "true", { timeout: 45000 });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  const box = (await water.boundingBox())!;
  const scale = box.width / Math.min(box.width, 960);
  const width = Math.min(Math.min(box.width, 960) - 24, 460) * scale;
  const title = { x: box.x + (box.width - width) / 2, y: box.y + 40 * scale + width * .12, width, height: width * .18 };
  const before = await page.screenshot({ clip: title });
  for (let step = 0; step < 60; step++) {
    await page.mouse.move(title.x + width * (.1 + step / 60 * .8), title.y + title.height * .55 + Math.sin(step * .3) * 18);
    await page.clock.runFor(20);
  }
  const active = await page.screenshot({ clip: title, path: "output/landing-20261018/water-preview/title-interactive.png" });
  await water.evaluate(el => el.dispatchEvent(new PointerEvent("pointerleave")));
  await page.clock.runFor(6000);
  const settled = await page.screenshot({ clip: title, path: "output/landing-20261018/water-preview/title-settled.png" });
  const decode = (buffer: Buffer) => sharp(buffer).removeAlpha().raw().toBuffer();
  const [a, b, c] = await Promise.all([decode(before), decode(active), decode(settled)]);
  let changed = 0, remaining = 0;
  for (let i = 0; i < a.length; i += 3) {
    const ink = (data: Buffer) => data[i] + data[i + 1] + data[i + 2] < 240;
    if (ink(a) !== ink(b)) changed++;
    if (ink(a) !== ink(c)) remaining++;
  }
  await test.info().attach("water-brand-pixels", { body: JSON.stringify({ changed, remaining }), contentType: "application/json" });
  expect(changed).toBeGreaterThan(100);
  expect(remaining).toBeLessThan(changed * .4);
});

test("overview stays static, one selected frame plays, and details take ownership", async ({ page }) => {
  const assets: string[] = [], writes: string[] = [];
  page.on("request", request => {
    if (request.url().includes("/product/motion/")) assets.push(request.url());
    if (request.method() !== "GET") writes.push(request.url());
  });
  await page.goto("/");
  const gallery = page.getByTestId("product-gallery");
  await expect(gallery).toHaveAttribute("data-ready", "true");
  await expect(page.locator(activePlayers)).toHaveCount(0);
  expect(assets).toEqual([]);
  await page.getByLabel("장면 바로 이동", { exact: true }).selectOption("0");
  await expect(gallery).toHaveAttribute("data-motion-playing", "true");
  await expect(gallery).toHaveAttribute("data-motion-scene", "01");
  await expect(page.locator(activePlayers)).toHaveCount(1);
  expect(assets.every(url => url.includes("/motion/01/"))).toBe(true);
  await page.getByLabel("장면 바로 이동", { exact: true }).selectOption("2");
  await expect(gallery).toHaveAttribute("data-motion-scene", "03");
  await expect(gallery).toHaveAttribute("data-motion-playing", "true");
  await page.getByRole("button", { name: "화면 확대", exact: true }).click();
  const motion = page.getByTestId("product-motion");
  await expect(motion).toHaveAttribute("data-motion-playing", "true");
  await expect(gallery).toHaveAttribute("data-motion-playing", "false");
  await expect(page.locator(activePlayers)).toHaveCount(1);
  await page.getByRole("dialog").getByRole("button", { name: "시연 일시 정지", exact: true }).click();
  await expect(page.locator(activePlayers)).toHaveCount(0);
  const paused = await motion.getAttribute("data-motion-time");
  await page.waitForTimeout(300);
  expect(await motion.getAttribute("data-motion-time")).toBe(paused);
  await page.getByRole("dialog").getByRole("button", { name: "시연 재생", exact: true }).click();
  await expect(motion).toHaveAttribute("data-motion-playing", "true");
  await page.keyboard.press("Escape");
  await expect(gallery).toHaveAttribute("data-motion-playing", "true");
  await expect(page.locator(activePlayers)).toHaveCount(1);
  await page.getByRole("button", { name: "전체 공간 보기", exact: true }).click();
  await expect(page.locator(activePlayers)).toHaveCount(0);
  expect(writes).toEqual([]);
});

test("all16 product scenes load real workflow motion without live business calls", async ({ page }) => {
  const errors: string[] = [], businessCalls: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) businessCalls.push(request.url()); });
  await page.goto("/");
  await expect(page.getByTestId("product-gallery")).toHaveAttribute("data-ready", "true");
  await mkdir("output/landing-20261018/motion-playback", { recursive: true });
  for (let index = 0; index < PRODUCT_SCENES.length; index++) {
    if (index === 8) continue;
    const scene = PRODUCT_SCENES[index];
    await page.getByLabel("장면 바로 이동", { exact: true }).selectOption(String(index));
    await page.getByRole("button", { name: "화면 확대", exact: true }).click();
    const motion = page.getByTestId("product-motion");
    await expect(motion).toHaveAttribute("data-ready", "true");
    await expect(motion).toHaveAttribute("data-motion-scene", scene.id);
    await expect(motion).toHaveAttribute("data-motion-phase", "1");
    await expect(page.locator(activePlayers)).toHaveCount(1);
    await page.getByRole("dialog").screenshot({ path: `output/landing-20261018/motion-playback/${scene.id}.png` });
    await page.keyboard.press("Escape");
  }
  expect(errors).toEqual([]); expect(businessCalls).toEqual([]);
});

test("query edit and saved states visibly change, with a stable manual pause", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("product-gallery")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "화면 확대", exact: true }).click();
  const motion = page.getByTestId("product-motion");
  await expect(motion).toHaveAttribute("data-ready", "true");
  const before = await motion.screenshot({ path: "output/landing-20261018/motion-query.png" });
  await expect(motion).toHaveAttribute("data-motion-phase", "4");
  await page.getByRole("dialog").getByRole("button", { name: "시연 일시 정지", exact: true }).click();
  await expect(motion).toHaveAttribute("data-motion-phase", "4");
  const after = await motion.screenshot({ path: "output/landing-20261018/motion-saved.png" });
  const { width, height } = await sharp(before).metadata();
  const region = { left: Math.round(width! * .15), top: Math.round(height! * .2), width: Math.round(width! * .6), height: Math.round(height! * .5) };
  const a = await sharp(before).extract(region).removeAlpha().raw().toBuffer();
  const b = await sharp(after).extract(region).removeAlpha().raw().toBuffer();
  let changed = 0;
  for (let index = 0; index < a.length; index += 3) if (Math.abs(a[index] - b[index]) + Math.abs(a[index + 1] - b[index + 1]) + Math.abs(a[index + 2] - b[index + 2]) > 40) changed++;
  expect(changed).toBeGreaterThan(200);
  await expect(page.locator(activePlayers)).toHaveCount(0);
});

test("hidden and offscreen playback pauses without advancing the timeline", async ({ page }) => {
  await page.goto("/");
  const gallery = page.getByTestId("product-gallery");
  await expect(gallery).toHaveAttribute("data-ready", "true");
  await page.getByLabel("장면 바로 이동", { exact: true }).selectOption("0");
  await expect(gallery).toHaveAttribute("data-motion-playing", "true");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator(activePlayers)).toHaveCount(0);
  const time = await gallery.getAttribute("data-motion-time");
  await page.waitForTimeout(300);
  expect(await gallery.getAttribute("data-motion-time")).toBe(time);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(gallery).toHaveAttribute("data-motion-playing", "true");
  await gallery.evaluate(el => { el.style.transform = "translateY(200vh)"; });
  await expect(page.locator(activePlayers)).toHaveCount(0);
  await gallery.evaluate(el => { el.style.transform = ""; });
  await expect(gallery).toHaveAttribute("data-motion-playing", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByTestId("product-motion")).toHaveCount(0);
  await expect(page.locator(activePlayers)).toHaveCount(0);
});

test("mobile list plays one visible item and hands it to the enlarged view", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("product-motion")).toHaveAttribute("data-motion-playing", "true");
  await expect(page.locator(activePlayers)).toHaveCount(1);
  const item = page.getByRole("button", { name: "10 급여 명세서 확대", exact: true });
  await item.evaluate(el => el.scrollIntoView({ block: "center" }));
  await expect(page.getByTestId("product-motion")).toHaveAttribute("data-motion-scene", "10");
  await expect(page.getByTestId("product-motion")).toHaveAttribute("data-motion-playing", "true");
  await item.click();
  await expect(page.getByRole("dialog").getByTestId("product-motion")).toHaveAttribute("data-motion-playing", "true");
  await expect(page.locator(activePlayers)).toHaveCount(1);
  await page.screenshot({ path: "output/landing-20261018/motion-mobile.png" });
});

test("reduced motion requests no workflow assets", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const assets: string[] = [];
  page.on("request", request => { if (request.url().includes("/product/motion/")) assets.push(request.url()); });
  await page.goto("/");
  await page.getByRole("button", { name: "01 사원관리 확대", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("img")).toBeVisible();
  await expect(page.getByTestId("product-motion")).toHaveCount(0);
  expect(assets).toEqual([]);
});

test("failed motion keeps the poster and can retry without breaking the gallery", async ({ page }) => {
  await page.route("**/images/product/motion/01/**", route => route.fulfill({ status: 503, body: "Synthetic unavailable" }));
  await page.goto("/");
  const gallery = page.getByTestId("product-gallery");
  await expect(gallery).toHaveAttribute("data-ready", "true");
  await page.getByLabel("장면 바로 이동", { exact: true }).selectOption("0");
  await expect(gallery).toHaveAttribute("data-motion-failed", "true");
  await expect(page.locator(activePlayers)).toHaveCount(0);
  await page.getByRole("button", { name: "화면 확대", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("시연을 불러오지 못했습니다. 화면을 다시 열어 주세요.")).toBeVisible();
  await page.unroute("**/images/product/motion/01/**");
  await page.getByRole("dialog").getByRole("button", { name: "시연 일시 정지", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "시연 재생", exact: true }).click();
  await expect(page.getByTestId("product-motion")).toHaveAttribute("data-motion-playing", "true");
});

test("water takes over without a product demonstration continuing behind it", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("product-gallery")).toHaveAttribute("data-ready", "true");
  await page.getByLabel("장면 바로 이동", { exact: true }).selectOption("0");
  await expect(page.locator(activePlayers)).toHaveCount(1);
  await page.getByLabel("장면 바로 이동", { exact: true }).selectOption("8");
  await page.getByRole("button", { name: "화면 확대", exact: true }).click();
  await expect(page.getByTestId("water-exhibit")).toHaveAttribute("data-ready", "true", { timeout: 45000 });
  await expect(page.locator(activePlayers)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByLabel("장면 바로 이동", { exact: true }).selectOption("9");
  await expect(page.getByTestId("product-gallery")).toHaveAttribute("data-motion-playing", "true");
  await expect(page.locator(activePlayers)).toHaveCount(1);
});
