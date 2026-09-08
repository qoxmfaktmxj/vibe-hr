import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFiles = ["src/components/auth/conservatory-scene.ts", "src/components/auth/conservatory/architecture-lighting.ts", "src/components/auth/conservatory/vegetation-quality.ts"];
const digest = data => createHash("sha256").update(data).digest("hex");
const bundle = await build({
  stdin: {
    resolveDir: frontend,
    contents: `import { createConservatoryScene } from './src/components/auth/conservatory-scene';
      window.renderPoster = async () => {
        const canvas=document.querySelector('canvas');
        const world=createConservatoryScene(canvas);
        try {
          await world.ready;
          world.resize(innerWidth,innerHeight,1.25);
          world.render(0,0);
          return canvas.toDataURL('image/png');
        } finally { world.dispose(); }
      };`,
  },
  bundle: true, write: false, format: "iife", platform: "browser", minify: true,
});
const routes = new Map([
  ["/", { type: "text/html", body: '<!doctype html><html><body style="margin:0"><canvas></canvas><script src="/scene.js"></script></body></html>' }],
  ["/scene.js", { type: "text/javascript", body: bundle.outputFiles[0].contents }],
]);
for (const name of ["rock-color.webp", "rock-normal.webp", "architecture-gi.webp", "pearl-matcap.webp"]) {
  routes.set(`/images/conservatory/${name}`, { type: "image/webp", body: await readFile(path.join(frontend, "public/images/conservatory", name)) });
}
const server = createServer((request, response) => {
  const asset = routes.get(new URL(request.url, "http://localhost").pathname);
  response.writeHead(asset ? 200 : 404, { "Content-Type": asset?.type ?? "text/plain" });
  response.end(asset?.body ?? "Not found");
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, args: process.platform === "win32" ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] : [] });
  const output = [];
  for (const [name, width, height] of [["desktop", 1440, 900], ["mobile", 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const dataUrl = await page.evaluate(() => window.renderPoster());
    const vegetationCount = await page.evaluate(() => Number(document.querySelector("canvas").dataset.grassCount));
    if (errors.length) throw new Error(errors.join("\n"));
    const png = Buffer.from(dataUrl.split(",")[1], "base64");
    const image = await sharp(png).webp({ quality: 84, effort: 6 }).toBuffer();
    const filename = `conservatory-login-${name}.webp`;
    await writeFile(path.join(frontend, "public/images", filename), image);
    const metadata = await sharp(image).metadata();
    output.push({ filename, width: metadata.width, height: metadata.height, vegetation_count: vegetationCount, bytes: image.length, sha256: digest(image) });
    await page.close();
  }
  const sources = await Promise.all(sourceFiles.map(async filename => ({ filename, sha256: digest(await readFile(path.join(frontend, filename))) })));
  await writeFile(path.join(frontend, "public/images/conservatory-login-posters.json"), JSON.stringify({
    generated_by: "현재 Three.js 장면의 첫 프레임 렌더링",
    reproduction: "node scripts/render-conservatory-posters.mjs",
    animation_time: 0, pixel_ratio: 1.25, webp_quality: 84,
    content: "로그인 UI와 글자를 제외한 실제 장면. 데스크톱과 모바일 카메라 구도를 각각 사용한다.",
    sources, output,
  }, null, 2) + "\n");
  console.log(JSON.stringify(output, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
