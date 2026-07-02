import { describe, expect, it } from "vitest";
import { buildPointerPath } from "../src/core/pointer-trace.js";

describe("pointer trace helpers", () => {
  it("builds a stable cursor path with start, intermediate, and end points", () => {
    const points = buildPointerPath({ x: 40, y: 40 }, { x: 520, y: 280 }, 240, 4);

    expect(points).toHaveLength(4);
    expect(points[0]).toEqual({ x: 40, y: 40, t: 0 });
    expect(points.at(-1)).toEqual({ x: 520, y: 280, t: 240 });
    expect(points[1].t).toBeGreaterThan(points[0].t);
    expect(points[2].x).toBeGreaterThan(points[1].x);
  });
});
