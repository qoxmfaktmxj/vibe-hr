import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
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

  test("the vendored shadcn stylesheet preserves its upstream bytes and license", () => {
    const vendorDir = path.resolve(process.cwd(), "src/styles/vendor");
    const stylesheet = readFileSync(path.join(vendorDir, "shadcn-3.8.5.css"));
    const license = readFileSync(path.join(vendorDir, "shadcn-3.8.5.LICENSE.md"), "utf8");

    expect(createHash("sha256").update(stylesheet).digest("hex"))
      .toBe("146941ac3ff65496fdf1cb306e697255328e4dadc7c105d66e36bb031b00f6d6");
    expect(license).toContain("Copyright (c) 2023 shadcn");
    expect(license).toContain("The above copyright notice and this permission notice shall be included");
  });

  test("the generator packs three decodable PNG frames into the ICO directory", async () => {
    const generatedDir = mkdtempSync(path.join(tmpdir(), "vibehr-brand-assets-"));

    try {
      mkdirSync(path.join(generatedDir, "src/app"), { recursive: true });
      execFileSync(process.execPath, [path.resolve(process.cwd(), "scripts/generate-brand-assets.mjs")], {
        cwd: generatedDir,
        timeout: 30_000,
      });
      const ico = readFileSync(path.join(generatedDir, "public/favicon.ico"));
      expect(ico.readUInt16LE(0)).toBe(0);
      expect(ico.readUInt16LE(2)).toBe(1);
      expect(ico.readUInt16LE(4)).toBe(3);

      let expectedOffset = 6 + 3 * 16;
      for (const [index, size] of [16, 32, 48].entries()) {
        const entryOffset = 6 + index * 16;
        expect(ico.readUInt8(entryOffset)).toBe(size);
        expect(ico.readUInt8(entryOffset + 1)).toBe(size);
        expect(ico.readUInt16LE(entryOffset + 2)).toBe(0);
        expect(ico.readUInt16LE(entryOffset + 4)).toBe(1);
        expect(ico.readUInt16LE(entryOffset + 6)).toBe(32);

        const length = ico.readUInt32LE(entryOffset + 8);
        const offset = ico.readUInt32LE(entryOffset + 12);
        expect(offset).toBe(expectedOffset);
        const frame = ico.subarray(offset, offset + length);
        expect(frame.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        const { info } = await sharp(frame).raw().toBuffer({ resolveWithObject: true });
        expect(info).toMatchObject({ width: size, height: size, channels: 4 });
        if (size <= 32) {
          expect(frame).toEqual(readFileSync(path.join(generatedDir, `public/favicon-${size}x${size}.png`)));
        }
        expectedOffset += length;
      }
      expect(expectedOffset).toBe(ico.length);
    } finally {
      rmSync(generatedDir, { recursive: true, force: true });
    }
  }, 30_000);
});
