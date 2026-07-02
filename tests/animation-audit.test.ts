import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  animationTraceInconsistentMotionTokens,
  animationTraceJankIndicators,
  resolveAnimationAuditOptions
} from "../src/core/animation-audit.js";
import { interactiveExplorePage } from "../src/core/interactive.js";
import type { AnimationTargetTrace, AnimationTrace } from "../src/core/types.js";

function dataUrl(html: string): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

async function tempTraceRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "ux-sentinel-motion-test-"));
}

function animationTarget(overrides: Partial<AnimationTargetTrace>): AnimationTargetTrace {
  return {
    id: "motion",
    tag: "div",
    role: null,
    text: "",
    bbox: { x: 0, y: 0, width: 100, height: 40 },
    transitionProperty: "opacity",
    transitionDurationMs: 100,
    transitionDelayMs: 0,
    transitionTimingFunction: "ease",
    animationName: "none",
    animationDurationMs: 0,
    animationDelayMs: 0,
    animationTimingFunction: "ease",
    webAnimationCount: 0,
    webAnimations: [],
    riskyProperties: [],
    ...overrides
  };
}

describe("animation audit", () => {
  it("resolves disabled defaults and clamps configured limits", () => {
    expect(resolveAnimationAuditOptions()).toEqual({
      enabled: false,
      compareReducedMotion: false,
      detectLayoutShift: true,
      detectRiskyProperties: true,
      maxAnimationMs: 1200
    });

    expect(resolveAnimationAuditOptions({ enabled: true, compare_reduced_motion: true, max_animation_ms: 25 })).toMatchObject({
      enabled: true,
      compareReducedMotion: true,
      maxAnimationMs: 100
    });
  });

  it("detects deterministic jank indicators and inconsistent motion tokens from trace evidence", () => {
    const trace: AnimationTrace = {
      actionId: "a001",
      enabled: true,
      maxAnimationMs: 1200,
      compareReducedMotion: false,
      beforeTargetBbox: { x: 0, y: 0, width: 100, height: 40 },
      afterTargetBbox: { x: 18, y: 0, width: 100, height: 40 },
      layoutShiftApproximationPx: 18,
      riskyProperties: ["left"],
      normal: [
        animationTarget({
          id: "primary",
          transitionProperty: "left",
          transitionDurationMs: 600,
          transitionTimingFunction: "ease-out",
          riskyProperties: ["left"]
        }),
        animationTarget({
          id: "secondary",
          transitionDurationMs: 120,
          transitionTimingFunction: "linear"
        })
      ],
      reducedMotionStillAnimating: false
    };

    expect(animationTraceJankIndicators(trace)).toEqual(
      expect.arrayContaining([
        "layout or paint-heavy properties animate for more than 150ms",
        "target layout moved 18px while risky properties were present"
      ])
    );
    expect(animationTraceInconsistentMotionTokens(trace)).toContain("duration tokens vary from 120ms to 600ms");
  });

  it("writes per-action animation traces and evidence-backed motion findings when enabled", async () => {
    const traceRoot = await tempTraceRoot();
    try {
      const result = await interactiveExplorePage({
        url: dataUrl(`
          <style>
            button {
              position: absolute;
              left: 32px;
              top: 48px;
              width: 180px;
              height: 44px;
              transition-property: left, opacity;
              transition-duration: 500ms, 50ms;
              transition-timing-function: ease-out;
            }
            .secondary-motion {
              position: absolute;
              left: 260px;
              top: 52px;
              width: 160px;
              height: 36px;
              transition-property: opacity;
              transition-duration: 100ms;
              transition-timing-function: linear;
            }
          </style>
          <button>Create first project</button>
          <div class="secondary-motion">Secondary panel</div>
        `),
        traceRoot,
        commandMode: "run",
        maxActions: 1,
        settleMs: 0,
        scenario: {
          id: "motion",
          title: "Motion",
          persona: "tester",
          interactive_exploration: { enabled: true },
          animation_audit: {
            enabled: true,
            compare_reduced_motion: true,
            detect_risky_properties: true,
            max_animation_ms: 200
          }
        }
      });

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].animationTrace).toContain("a001-animation-trace.json");
      await stat(result.actions[0].animationTrace!);

      const trace = JSON.parse(await readFile(result.actions[0].animationTrace!, "utf8")) as AnimationTrace;
      expect(trace.normal.some((item) => item.id === result.actions[0].target.id)).toBe(true);
      expect(trace.riskyProperties).toContain("left");
      expect(trace.reducedMotionStillAnimating).toBe(true);

      expect(result.findings.map((finding) => finding.detector)).toEqual(
        expect.arrayContaining([
          "animation_uses_layout_paint_properties",
          "animation_duration_blocks_task",
          "animation_ignores_reduced_motion",
          "animation_jank_detected",
          "inconsistent_motion_tokens"
        ])
      );
      expect(result.findings.find((finding) => finding.detector === "animation_ignores_reduced_motion")?.evidencePaths?.animationTrace).toContain(
        "a001-animation-trace.json"
      );
      const actionTrace = JSON.parse(await readFile(result.artifacts.actionTrace, "utf8")) as {
        actions: Array<{ animationTrace?: string; findingDetectors: string[] }>;
      };
      expect(actionTrace.actions[0].animationTrace).toContain("a001-animation-trace.json");
      expect(actionTrace.actions[0].findingDetectors).toContain("animation_ignores_reduced_motion");
      expect(actionTrace.actions[0].findingDetectors).toContain("animation_jank_detected");
      const contactSheet = await readFile(result.artifacts.contactSheet, "utf8");
      expect(contactSheet).toContain("Animation trace:");
      expect(contactSheet).toContain("a001-animation-trace.json");
    } finally {
      await rm(traceRoot, { recursive: true, force: true });
    }
  });
});
