import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const FIXED_NEUTRAL_UTILITY =
  /(?:text-black|text-(?:slate|gray|zinc|neutral|stone)-(?:200|300|400|500|600|700|800|900)|bg-white|bg-(?:slate|gray|zinc|neutral|stone)-(?:50|100|200)|border(?:-[trblxy])?-white|border-(?:slate|gray|zinc|neutral|stone)-(?:100|200|300|400))/g;

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectTsxFiles(entryPath);
    }
    return entry.isFile() && entry.name.endsWith(".tsx") ? [entryPath] : [];
  });
}

describe("dark mode contrast contract", () => {
  test("neutral surfaces and text use theme-aware semantic utilities", () => {
    const sourceRoot = path.resolve(process.cwd(), "src");
    const violations = collectTsxFiles(sourceRoot).flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");
      const matches = [...source.matchAll(FIXED_NEUTRAL_UTILITY)].map((match) => match[0]);
      return matches.length > 0
        ? [`${path.relative(sourceRoot, filePath)}: ${[...new Set(matches)].join(", ")}`]
        : [];
    });

    expect(violations).toEqual([]);
  });

  test("dark overlays expose semantic selection and keyboard focus cues", () => {
    const themeSettings = readFileSync(
      path.resolve(process.cwd(), "src/components/layout/theme-settings-popover.tsx"),
      "utf8",
    );
    const impersonation = readFileSync(
      path.resolve(process.cwd(), "src/components/layout/impersonation-popover.tsx"),
      "utf8",
    );
    const dropdownMenu = readFileSync(
      path.resolve(process.cwd(), "src/components/ui/dropdown-menu.tsx"),
      "utf8",
    );

    const chatbotToggleStart = themeSettings.indexOf("chatbotButtonVisible: !prev.chatbotButtonVisible");
    const chatbotToggle = themeSettings.slice(
      chatbotToggleStart,
      themeSettings.indexOf("</button>", chatbotToggleStart),
    );

    expect(themeSettings).toContain('role="group"');
    expect(themeSettings).toContain("aria-pressed={draft.primaryTone === option.value}");
    expect(themeSettings).toContain("aria-pressed={draft.paletteMode === option.value}");
    expect(themeSettings).not.toContain('role="radio"');
    expect(themeSettings).toContain("border-[var(--vibe-border-emphasis)]");
    expect(chatbotToggle).toContain("focus-visible:ring-2");
    expect(impersonation).toContain('role="group"');
    expect(impersonation).toContain("aria-pressed={selectedUserId === user.id}");
    expect(impersonation).not.toContain('role="option"');
    expect(dropdownMenu).toMatch(/focus:bg-(?:primary|accent)(?:\/\d+)?/);
    expect(dropdownMenu).toContain("focus-visible:ring-2");
  });
});
