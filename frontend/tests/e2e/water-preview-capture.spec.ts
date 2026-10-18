import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

// Explicitly record the local renderer only. Requires an existing ffmpeg installation.
test.skip(process.env.VIBEHR_CAPTURE_WATER !== "1", "Opt-in water preview production");

test("record the existing water and liquid brand as an automatic cursor demonstration", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/");
  await expect(page.getByTestId("product-gallery")).toHaveAttribute("data-ready", "true");
  await page.getByLabel("장면 바로 이동", { exact: true }).selectOption("8");
  await page.getByRole("button", { name: "화면 확대", exact: true }).click();
  const water = page.getByTestId("water-exhibit");
  await expect(water).toHaveAttribute("data-ready", "true", { timeout: 60000 });
  await water.evaluate(canvas => {
    canvas.parentElement!.style.height = "800px";
    canvas.closest("dialog")!.style.width = "1280px";
  });
  await expect.poll(() => water.evaluate(canvas => canvas.clientWidth)).toBe(1280);
  await page.waitForTimeout(700);
  await mkdir("output/landing-20261018/water-preview", { recursive: true });
  await water.screenshot({ path: "output/landing-20261018/water-preview/live-brand.png" });
  const result = await water.evaluate(async source => {
    const canvas = source as HTMLCanvasElement;
    const composite = document.createElement("canvas");
    composite.width = 1280; composite.height = 800;
    const ctx = composite.getContext("2d")!;
    const stream = composite.captureStream(30);
    const mimeType = "video/webm;codecs=vp9";
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 7_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const finished = new Promise<string>(resolve => {
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.readAsDataURL(new Blob(chunks, { type: mimeType }));
      };
    });
    const start = performance.now();
    let left = false, frames = 0;
    recorder.start();
    const draw = (now: number) => {
      const time = (now - start) / 1000;
      ctx.drawImage(canvas, 0, 0, 1280, 800); frames++;
      if (time >= 1.5 && time < 6.5) {
        const progress = (time - 1.5) / 5;
        const x = 360 + progress * 570;
        const y = 186 + Math.sin(progress * Math.PI * 5) * 24;
        const rect = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new PointerEvent("pointermove", { clientX: rect.left + x, clientY: rect.top + y, isPrimary: true, pointerType: "mouse" }));
        ctx.save(); ctx.translate(x, y);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(7, 30); ctx.lineTo(14, 21); ctx.lineTo(23, 20); ctx.closePath();
        ctx.fillStyle = "#fff"; ctx.strokeStyle = "#315fce"; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.fill(); ctx.stroke(); ctx.restore();
      } else if (time >= 6.5 && !left) {
        left = true; canvas.dispatchEvent(new PointerEvent("pointerleave"));
      }
      if (time < 12) requestAnimationFrame(draw);
      else recorder.stop();
    };
    requestAnimationFrame(draw);
    return { base64: await finished, frames };
  });
  const source = "output/landing-20261018/water-preview/source.webm";
  await writeFile(source, Buffer.from(result.base64, "base64"));
  await mkdir("public/images/product/motion/09", { recursive: true });
  execFileSync("ffmpeg", ["-y", "-i", source, "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart", "public/images/product/motion/09/preview.mp4"], { windowsHide: true, stdio: "pipe" });
  const asset = await readFile("public/images/product/motion/09/preview.mp4");
  await writeFile("public/images/product/motion/09/provenance.json", JSON.stringify({ source: "Existing VIBE-HR conservatory renderer and liquid title, captured locally", interaction: "Automatic cursor demonstration; click the gallery frame for live control", durationSeconds: 12, width: 1280, height: 800, fps: 30, audio: false, bytes: asset.length, sha256: createHash("sha256").update(asset).digest("hex") }, null, 2) + "\n");
  expect(result.frames).toBeGreaterThan(180);
});
