export type FrameQualityAction = "none" | "reduce-vegetation" | "reduce-resolution";

/**
 * Tracks consecutive missed frame budgets without depending on the renderer.
 * Keeping this separate makes the recovery policy testable even where software
 * WebGL schedules callbacks too slowly for an end-to-end timing assertion.
 */
export function createFrameQualityController() {
  let previous = 0;
  let slowFrames = 0;

  return {
    next(now: number, vegetationCount: number, canReduceResolution: boolean): FrameQualityAction {
      const slowFrameLimit = vegetationCount > 450 ? 24 : 36;
      if (previous && now - previous > slowFrameLimit) slowFrames++;
      else slowFrames = Math.max(0, slowFrames - 1);
      previous = now;

      if (slowFrames < 6) return "none";
      slowFrames = 0;
      return vegetationCount > 450 ? "reduce-vegetation" : canReduceResolution ? "reduce-resolution" : "none";
    },
    reset() {
      previous = 0;
      slowFrames = 0;
    },
  };
}
