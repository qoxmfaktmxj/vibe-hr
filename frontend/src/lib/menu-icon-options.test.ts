import { describe, expect, it } from "vitest";

import { normalizeMenuIconName } from "@/lib/menu-icon-options";

describe("normalizeMenuIconName", () => {
  it("returns whitelisted icon as-is", () => {
    expect(normalizeMenuIconName("Home")).toBe("Home");
  });

  it("maps alias to normalized icon", () => {
    expect(normalizeMenuIconName("Users")).toBe("UsersRound");
  });

  it("allows unknown PascalCase icon names for advanced mode", () => {
    expect(normalizeMenuIconName("UnknownIcon")).toBe("UnknownIcon");
  });

  it("returns null for empty values", () => {
    expect(normalizeMenuIconName("   ")).toBeNull();
    expect(normalizeMenuIconName(null)).toBeNull();
  });
});
