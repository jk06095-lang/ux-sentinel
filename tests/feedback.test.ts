import { describe, expect, it } from "vitest";
import { distillFeedback } from "../src/core/feedback.js";

describe("feedback distillation", () => {
  it("extracts pain points and suggested check heuristically", () => {
    const distilled = distillFeedback(
      "I landed on the dashboard and saw no projects, but I did not know what to click. The tiny + button was confusing.",
      "feedback.md"
    );

    expect(distilled.pain_points.join(" ")).toContain("primary next action");
    expect(distilled.affected_journey).toBe("dashboard-empty-state");
    expect(distilled.suggested_scenario_check).toContain("visible primary CTA");
  });
});
