import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import toIco from "to-ico";

const publicDir = path.resolve("public");

const markSvg = path.join(publicDir, "vibehr_mark.svg");
const lockupSvg = path.join(publicDir, "vibehr_lockup.svg");

async function renderPng(input, output, size) {
  await sharp(input)
    .resize(size, size)
    .png()
    .toFile(path.join(publicDir, output));
}

async function renderThumbnail() {
  const lockup = await readFile(lockupSvg, "utf8");
  const thumbnailSvg = `
  <svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="80" y1="60" x2="1120" y2="570" gradientUnits="userSpaceOnUse">
        <stop stop-color="#F8FBFF"/>
        <stop offset="1" stop-color="#E7EEFF"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" rx="48" fill="url(#bg)"/>
    <circle cx="1055" cy="120" r="140" fill="#DCE7FF"/>
    <circle cx="1125" cy="510" r="190" fill="#EDF3FF"/>
    <g transform="translate(150 170)">
      ${lockup.replace(/<\?xml[\s\S]*?\?>/g, "").replace(/<svg[^>]*>|<\/svg>/g, "")}
    </g>
  </svg>`;

  await sharp(Buffer.from(thumbnailSvg))
    .webp({ quality: 92 })
    .toFile(path.join(publicDir, "vibe-hr-thumbnail.webp"));
}

async function renderFaviconIco() {
  const pngBuffers = await Promise.all([
    sharp(markSvg).resize(16, 16).png().toBuffer(),
    sharp(markSvg).resize(32, 32).png().toBuffer(),
    sharp(markSvg).resize(48, 48).png().toBuffer(),
  ]);

  const ico = await toIco(pngBuffers);
  await writeFile(path.join(publicDir, "favicon.ico"), ico);
}

async function main() {
  await Promise.all([
    renderPng(markSvg, "favicon-16x16.png", 16),
    renderPng(markSvg, "favicon-32x32.png", 32),
    renderPng(markSvg, "apple-touch-icon.png", 180),
    renderPng(markSvg, "android-chrome-192x192.png", 192),
    renderPng(markSvg, "android-chrome-512x512.png", 512),
    renderPng(markSvg, "mstile-150x150.png", 150),
    renderPng(markSvg, "vibehr_logo-256x256.png", 256),
    renderThumbnail(),
    renderFaviconIco(),
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
