import { describe, expect, it } from "vitest";

import { normalizeMenuIconName } from "@/lib/menu-icon-options";

describe("normalizeMenuIconName", () => {
  it("returns whitelisted icon as-is", () => {
    expect(normalizeMenuIconName("Home")).toBe("Home");
  });

  it("maps alias to normalized icon", () => {
    expect(normalizeMenuIconName("Users")).toBe("UsersRound");
  });

  it("returns null for unknown icon", () => {
    expect(normalizeMenuIconName("UnknownIcon")).toBeNull();
  });

  it("returns null for empty values", () => {
    expect(normalizeMenuIconName("   ")).toBeNull();
    expect(normalizeMenuIconName(null)).toBeNull();
  });
});
