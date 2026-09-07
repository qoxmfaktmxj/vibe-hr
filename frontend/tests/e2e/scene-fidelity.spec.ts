import { expect, test, type Page } from "@playwright/test";

async function prepare(page: Page) {
  await page.clock.install({ time: new Date("2026-09-06T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-06T01:00:00Z"));
  await page.goto("/login");
  await expect(page.getByTestId("login-scene")).toHaveAttribute("data-ready", "true");
  await page.evaluate(async () => {
    await Promise.all(["rock-color.jpg", "rock-normal.jpg", "architecture-gi.webp", "pearl-matcap.webp"].map(async (name) => {
      const image = new Image();
      image.src = `/images/conservatory/${name}`;
      await image.decode();
    }));
  });
}

async function comparePixels(page: Page, before: Buffer, after: Buffer) {
  return page.evaluate(async ({ before, after }) => {
    async function decode(encoded: string) {
      const image = new Image();
      image.src = `data:image/png;base64,${encoded}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, image.width, image.height).data;
    }
    const a = await decode(before), b = await decode(after);
    let changedInk = 0, changedPixels = 0, absoluteDifference = 0;
    for (let i = 0; i < a.length; i += 4) {
      const inkA = a[i] + a[i + 1] + a[i + 2] < 240;
      const inkB = b[i] + b[i + 1] + b[i + 2] < 240;
      if (inkA !== inkB) changedInk++;
      const difference = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      absoluteDifference += difference;
      if (difference > 24) changedPixels++;
    }
    return { changedInk, changedPixels, meanDifference: absoluteDifference / (a.length / 4 * 3) };
  }, { before: before.toString("base64"), after: after.toString("base64") });
}

test("cursor changes title outlines and water pixels at the same animation time", async ({ page, context }) => {
  await prepare(page);
  await page.clock.runFor(1000);
  const titleBox = { x: 235, y: 350, width: 550, height: 230 };
  const waterBox = { x: 150, y: 730, width: 750, height: 160 };
  const titleBaseline = await page.screenshot({ clip: titleBox, path: test.info().outputPath("title-idle.png") });
  await page.clock.runFor(1000);
  const waterBaseline = await page.screenshot({ clip: waterBox, path: test.info().outputPath("water-idle.png") });

  const interactive = await context.newPage();
  await prepare(interactive);
  for (let i = 0; i < 50; i++) {
    await interactive.mouse.move(300 + i * 8, 455 + Math.sin(i * .25) * 20);
    await interactive.clock.runFor(20);
  }
  const titleActive = await interactive.screenshot({ clip: titleBox, path: test.info().outputPath("title-cursor.png") });
  for (let i = 0; i < 50; i++) {
    await interactive.mouse.move(220 + i * 12, 790 + Math.sin(i * .2) * 30);
    await interactive.clock.runFor(20);
  }
  const waterActive = await interactive.screenshot({ clip: waterBox, path: test.info().outputPath("water-cursor.png") });
  const title = await comparePixels(page, titleBaseline, titleActive);
  const water = await comparePixels(page, waterBaseline, waterActive);
  await test.info().attach("rendered-cursor-response", { body: JSON.stringify({ title, water }, null, 2), contentType: "application/json" });
  expect(title.changedInk, "Mouse input must change the drawn glyph outlines, not just the background").toBeGreaterThan(100);
  expect(water.changedPixels, "The water region must visibly respond to pointer input").toBeGreaterThan(1500);
  await interactive.close();
});
