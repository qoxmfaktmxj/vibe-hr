import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import toIco from "to-ico";

const publicDir = path.resolve("public");
const brandDir = path.join(publicDir, "brand");
const appIconPath = path.resolve("src", "app", "icon.svg");

const COLORS = {
  cobalt: "#3C6DEE",
  steel: "#A8B3C5",
  ink: "#0E1B31",
  paper: "#F7F9FF",
  white: "#FFFFFF",
};

const MARK_PATHS = {
  vibe: "M0 35h51v150l52-46 35 33-68 64H0V35Z",
  hr: "M222 35h50v201h-50v-63h-46l-55-52h101V35Z",
};

function markArtwork(vibeColor, hrColor = vibeColor) {
  return `<path d="${MARK_PATHS.vibe}" fill="${vibeColor}"/><path d="${MARK_PATHS.hr}" fill="${hrColor}"/>`;
}

function markSvg(vibeColor, hrColor = vibeColor) {
  return `<svg width="272" height="272" viewBox="0 0 272 272" fill="none" xmlns="http://www.w3.org/2000/svg">${markArtwork(vibeColor, hrColor)}</svg>`;
}

function lockupSvg({ vibeColor, hrColor, wordColor }) {
  return `<svg width="900" height="240" viewBox="0 0 900 240" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(30 20) scale(.735294)">${markArtwork(vibeColor, hrColor)}</g>
  <text x="270" y="151" font-family="Inter, Pretendard, Segoe UI, Arial, sans-serif" font-size="82" font-weight="800" letter-spacing="-2" fill="${wordColor}">VIBE-HR</text>
</svg>`;
}

function iconSvg({ size, background, vibeColor, hrColor, padding, radius = 0 }) {
  const artworkSize = size - padding * 2;
  const scale = artworkSize / 272;
  const backgroundRect = background
    ? `<rect width="${size}" height="${size}" rx="${radius}" fill="${background}"/>`
    : "";

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${backgroundRect}
  <g transform="translate(${padding} ${padding}) scale(${scale})">${markArtwork(vibeColor, hrColor)}</g>
</svg>`;
}

const colorMark = markSvg(COLORS.cobalt, COLORS.steel);
const monoMark = markSvg(COLORS.ink);
const whiteMark = markSvg(COLORS.white);
const colorLockup = lockupSvg({
  vibeColor: COLORS.cobalt,
  hrColor: COLORS.steel,
  wordColor: COLORS.ink,
});
const darkLockup = lockupSvg({
  vibeColor: COLORS.cobalt,
  hrColor: COLORS.steel,
  wordColor: COLORS.white,
});
const monoLockup = lockupSvg({
  vibeColor: COLORS.ink,
  hrColor: COLORS.ink,
  wordColor: COLORS.ink,
});
const whiteLockup = lockupSvg({
  vibeColor: COLORS.white,
  hrColor: COLORS.white,
  wordColor: COLORS.white,
});

async function writeSvgAssets() {
  await mkdir(brandDir, { recursive: true });

  const files = [
    [path.join(publicDir, "vibehr_mark.svg"), colorMark],
    [path.join(publicDir, "vibehr_lockup.svg"), colorLockup],
    [path.join(brandDir, "vibehr-mark-color.svg"), colorMark],
    [path.join(brandDir, "vibehr-mark-mono.svg"), monoMark],
    [path.join(brandDir, "vibehr-mark-white.svg"), whiteMark],
    [path.join(brandDir, "vibehr-lockup-color.svg"), colorLockup],
    [path.join(brandDir, "vibehr-lockup-dark.svg"), darkLockup],
    [path.join(brandDir, "vibehr-lockup-mono.svg"), monoLockup],
    [path.join(brandDir, "vibehr-lockup-white.svg"), whiteLockup],
    [
      appIconPath,
      iconSvg({
        size: 256,
        background: COLORS.paper,
        vibeColor: COLORS.cobalt,
        hrColor: COLORS.steel,
        padding: 42,
        radius: 54,
      }),
    ],
  ];

  await Promise.all(files.map(([file, contents]) => writeFile(file, `${contents}\n`, "utf8")));
}

async function renderPng(svg, outputPath, width, height = width) {
  await sharp(Buffer.from(svg))
    .resize({ width, height, fit: "contain" })
    .png()
    .toFile(outputPath);
}

async function renderTransparentBrandAssets() {
  const sizes = [64, 128, 256, 512];
  const marks = [
    ["color", colorMark],
    ["mono", monoMark],
    ["white", whiteMark],
  ];
  const lockups = [
    ["color", colorLockup],
    ["dark", darkLockup],
    ["mono", monoLockup],
    ["white", whiteLockup],
  ];

  await Promise.all([
    ...marks.flatMap(([variant, svg]) =>
      sizes.map((size) => renderPng(svg, path.join(brandDir, `vibehr-mark-${variant}-${size}.png`), size)),
    ),
    ...lockups.map(([variant, svg]) =>
      renderPng(svg, path.join(brandDir, `vibehr-lockup-${variant}-900.png`), 900, 240),
    ),
    renderPng(colorMark, path.join(publicDir, "vibehr_logo-256x256.png"), 256),
  ]);
}

async function renderPlatformIcons() {
  const favicon16 = iconSvg({
    size: 16,
    vibeColor: COLORS.cobalt,
    hrColor: COLORS.steel,
    padding: 1,
  });
  const favicon32 = iconSvg({
    size: 32,
    vibeColor: COLORS.cobalt,
    hrColor: COLORS.steel,
    padding: 2,
  });
  const favicon48 = iconSvg({
    size: 48,
    vibeColor: COLORS.cobalt,
    hrColor: COLORS.steel,
    padding: 3,
  });
  const appIcon180 = iconSvg({
    size: 180,
    background: COLORS.paper,
    vibeColor: COLORS.cobalt,
    hrColor: COLORS.steel,
    padding: 30,
  });
  const appIcon192 = iconSvg({
    size: 192,
    background: COLORS.paper,
    vibeColor: COLORS.cobalt,
    hrColor: COLORS.steel,
    padding: 32,
  });
  const appIcon512 = iconSvg({
    size: 512,
    background: COLORS.paper,
    vibeColor: COLORS.cobalt,
    hrColor: COLORS.steel,
    padding: 84,
  });
  const maskable512 = iconSvg({
    size: 512,
    background: COLORS.cobalt,
    vibeColor: COLORS.white,
    hrColor: COLORS.white,
    padding: 128,
  });
  const tile150 = iconSvg({
    size: 150,
    vibeColor: COLORS.white,
    hrColor: COLORS.white,
    padding: 28,
  });

  await Promise.all([
    renderPng(favicon16, path.join(publicDir, "favicon-16x16.png"), 16),
    renderPng(favicon32, path.join(publicDir, "favicon-32x32.png"), 32),
    renderPng(appIcon180, path.join(publicDir, "apple-touch-icon.png"), 180),
    renderPng(appIcon192, path.join(publicDir, "android-chrome-192x192.png"), 192),
    renderPng(appIcon512, path.join(publicDir, "android-chrome-512x512.png"), 512),
    renderPng(maskable512, path.join(publicDir, "android-chrome-maskable-512x512.png"), 512),
    renderPng(tile150, path.join(publicDir, "mstile-150x150.png"), 150),
  ]);

  const faviconBuffers = await Promise.all(
    [favicon16, favicon32, favicon48].map((svg, index) =>
      sharp(Buffer.from(svg))
        .resize([16, 32, 48][index], [16, 32, 48][index])
        .png()
        .toBuffer(),
    ),
  );
  await writeFile(path.join(publicDir, "favicon.ico"), await toIco(faviconBuffers));
}

async function renderThumbnail() {
  const thumbnailSvg = `<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="70" y1="40" x2="1130" y2="590" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FAFBFF"/>
      <stop offset="1" stop-color="#E9EFFF"/>
    </linearGradient>
    <linearGradient id="orb" x1="890" y1="50" x2="1160" y2="530" gradientUnits="userSpaceOnUse">
      <stop stop-color="#D9E4FF"/>
      <stop offset="1" stop-color="#EFF3FF"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1080" cy="90" r="180" fill="url(#orb)"/>
  <circle cx="1135" cy="555" r="240" fill="#F3F6FF"/>
  <g transform="translate(135 178) scale(.94)">${markArtwork(COLORS.cobalt, COLORS.steel)}</g>
  <text x="455" y="295" font-family="Inter, Pretendard, Segoe UI, Arial, sans-serif" font-size="94" font-weight="800" letter-spacing="-3" fill="${COLORS.ink}">VIBE-HR</text>
  <text x="460" y="355" font-family="Pretendard, Segoe UI, Arial, sans-serif" font-size="29" font-weight="600" letter-spacing="-.5" fill="#52617A">사람과 조직의 흐름을 하나로</text>
  <rect x="460" y="397" width="66" height="8" rx="4" fill="${COLORS.cobalt}"/>
</svg>`;

  await sharp(Buffer.from(thumbnailSvg))
    .webp({ quality: 92 })
    .toFile(path.join(publicDir, "vibe-hr-thumbnail.webp"));
}

async function renderBrandPreview() {
  const previewSvg = `<svg width="1600" height="960" viewBox="0 0 1600 960" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1600" height="960" fill="#F3F6FC"/>
  <rect x="60" y="60" width="1480" height="390" rx="36" fill="${COLORS.ink}"/>
  <g transform="translate(150 120) scale(.92)">${markArtwork(COLORS.cobalt, COLORS.steel)}</g>
  <text x="475" y="273" font-family="Inter, Pretendard, Segoe UI, Arial, sans-serif" font-size="118" font-weight="800" letter-spacing="-4" fill="white">VIBE-HR</text>
  <text x="480" y="338" font-family="Pretendard, Segoe UI, Arial, sans-serif" font-size="28" font-weight="600" fill="#AEBAD0">VIBE MONOGRAM · MASTER BRAND SYSTEM</text>
  <text x="75" y="520" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="24" font-weight="700" fill="${COLORS.ink}">PRIMARY MARK</text>
  <rect x="60" y="550" width="410" height="330" rx="28" fill="white"/>
  <g transform="translate(135 586) scale(.96)">${markArtwork(COLORS.cobalt, COLORS.steel)}</g>
  <text x="98" y="841" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="17" font-weight="700" fill="${COLORS.cobalt}">COBALT ${COLORS.cobalt}</text>
  <text x="286" y="841" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="17" font-weight="700" fill="#718096">STEEL ${COLORS.steel}</text>
  <text x="535" y="520" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="24" font-weight="700" fill="${COLORS.ink}">MONOCHROME</text>
  <rect x="520" y="550" width="410" height="330" rx="28" fill="white"/>
  <g transform="translate(595 586) scale(.96)">${markArtwork(COLORS.ink)}</g>
  <text x="659" y="841" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" fill="${COLORS.ink}">INK ${COLORS.ink}</text>
  <text x="995" y="520" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="24" font-weight="700" fill="${COLORS.ink}">REVERSED</text>
  <rect x="980" y="550" width="560" height="330" rx="28" fill="${COLORS.cobalt}"/>
  <g transform="translate(1045 610) scale(.78)">${markArtwork(COLORS.white)}</g>
  <text x="1285" y="728" font-family="Inter, Pretendard, Segoe UI, Arial, sans-serif" font-size="43" font-weight="800" letter-spacing="-1.5" fill="white">VIBE-HR</text>
  <text x="1288" y="770" font-family="Pretendard, Segoe UI, Arial, sans-serif" font-size="16" font-weight="600" fill="#DCE5FF">사람과 조직의 흐름을 하나로</text>
</svg>`;

  await sharp(Buffer.from(previewSvg))
    .webp({ quality: 90 })
    .toFile(path.join(brandDir, "vibehr-brand-preview.webp"));
}

async function main() {
  await writeSvgAssets();
  await Promise.all([
    renderTransparentBrandAssets(),
    renderPlatformIcons(),
    renderThumbnail(),
    renderBrandPreview(),
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
