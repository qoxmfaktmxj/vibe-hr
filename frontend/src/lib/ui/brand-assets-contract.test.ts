import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

function readPublic(...segments: string[]) {
  return readFileSync(path.resolve(process.cwd(), "public", ...segments), "utf8");
}

describe("VIBE-HR brand asset contract", () => {
  test("the approved two-part VIBE monogram is the master mark", () => {
    const mark = readPublic("vibehr_mark.svg");

    expect(mark).toContain('d="M0 35h51v150l52-46 35 33-68 64H0V35Z"');
    expect(mark).toContain('d="M222 35h50v201h-50v-63h-46l-55-52h101V35Z"');
    expect(mark).toContain('fill="#3C6DEE"');
    expect(mark).toContain('fill="#A8B3C5"');
    expect(mark).not.toContain("fill-rule");
    expect(mark).not.toContain("<rect");
  });

  test("transparent color, mono, white, and dark lockup SVGs are available", () => {
    const assets = [
      "vibehr-mark-color.svg",
      "vibehr-mark-mono.svg",
      "vibehr-mark-white.svg",
      "vibehr-lockup-color.svg",
      "vibehr-lockup-dark.svg",
      "vibehr-lockup-mono.svg",
      "vibehr-lockup-white.svg",
    ];

    for (const asset of assets) {
      expect(readPublic("brand", asset)).not.toContain("<rect");
    }
  });

  test("the web manifest includes standard and maskable application icons", () => {
    const manifest = JSON.parse(readPublic("site.webmanifest")) as {
      icons: Array<{ src: string; purpose?: string }>;
    };

    expect(manifest.icons).toContainEqual(
      expect.objectContaining({ src: "/android-chrome-512x512.png", purpose: "any" }),
    );
    expect(manifest.icons).toContainEqual(
      expect.objectContaining({ src: "/android-chrome-maskable-512x512.png", purpose: "maskable" }),
    );
  });
});
