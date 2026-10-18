import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";

const ids = Array.from({ length: 17 }, (_, index) => String(index + 1).padStart(2, "0")).filter(id => id !== "09");
const clips = [];
for (const id of ids) {
  const source = JSON.parse(await readFile(`output/landing-20261018/motion/${id}.json`, "utf8"));
  if (!source.synthetic || source.steps.length < 4) throw new Error(`Incomplete scene ${id}`);
  for (const step of source.steps) {
    const buffer = await readFile(`public${step.image}`);
    if (createHash("sha256").update(buffer).digest("hex") !== step.sha256) throw new Error(`Changed frame ${step.image}`);
  }
  const clip = { id, theme: source.theme, steps: source.steps.map(({ image, label, pointer, action }) => ({ image, label, pointer, action })) };
  await mkdir(`public/images/product/motion/${id}`, { recursive: true });
  await writeFile(`public/images/product/motion/${id}/motion.json`, JSON.stringify(clip) + "\n");
  clips.push({ ...source, writes: source.writes.map(({ path, method }) => ({ path, method, environment: "isolated synthetic fixture" })) });
}
const bytes = (await Promise.all(clips.flatMap(clip => clip.steps.map(step => stat(`public${step.image}`))))).reduce((sum, file) => sum + file.size, 0);
await writeFile("public/images/product/motion/provenance.json", JSON.stringify({ date: "2026-10-18", source: "Real application state captures using isolated synthetic data and responses", runtime: "Canvas state transitions and cursor animation; no live business API calls in the gallery", playback: "Only the viewed scene; paused when hidden, offscreen or reduced motion is enabled", bytes, clips }, null, 2) + "\n");
console.log(JSON.stringify({ clips: clips.length, frames: clips.reduce((sum, clip) => sum + clip.steps.length, 0), bytes }));
