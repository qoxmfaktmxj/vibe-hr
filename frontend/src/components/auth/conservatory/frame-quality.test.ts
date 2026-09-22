import { describe, expect, it } from "vitest";

import { createFrameQualityController } from "./frame-quality";

describe("frame quality recovery", () => {
  it("lowers vegetation before resolution after six missed budgets", () => {
    const quality = createFrameQualityController();
    expect(quality.next(16, 900, true)).toBe("none");
    for (let index = 1; index < 6; index++) expect(quality.next(16 + index * 40, 900, true)).toBe("none");
    expect(quality.next(16 + 6 * 40, 900, true)).toBe("reduce-vegetation");
    expect(quality.next(16 + 7 * 40, 450, true)).toBe("none");
  });

  it("only lowers resolution after vegetation is already reduced", () => {
    const quality = createFrameQualityController();
    quality.next(16, 450, true);
    for (let index = 1; index < 6; index++) quality.next(16 + index * 40, 450, true);
    expect(quality.next(16 + 6 * 40, 450, true)).toBe("reduce-resolution");
  });
});
