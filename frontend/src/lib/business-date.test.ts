import { afterEach, describe, expect, it, vi } from "vitest";

import { getKoreaDateKey } from "@/lib/business-date";

afterEach(() => vi.useRealTimers());

describe("Korean business date", () => {
  it.each([
    ["2026-10-16T14:59:59.999Z", "2026-10-16"],
    ["2026-10-16T15:00:00.000Z", "2026-10-17"],
    ["2026-10-31T14:59:59.999Z", "2026-10-31"],
    ["2026-10-31T15:00:00.000Z", "2026-11-01"],
    ["2026-12-31T14:59:59.999Z", "2026-12-31"],
    ["2026-12-31T15:00:00.000Z", "2027-01-01"],
  ])("formats %s as %s", (instant, expected) => {
    expect(getKoreaDateKey(new Date(instant))).toBe(expected);
  });

  it("uses the current instant when no date is supplied", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T15:05:00.000Z"));
    expect(getKoreaDateKey()).toBe("2026-10-17");
  });
});
