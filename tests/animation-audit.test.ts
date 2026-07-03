import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  animationTraceCriticalActionHideIndicators,
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

  it("detects visibility-affecting motion on a critical action target from trace evidence", () => {
    const trace: AnimationTrace = {
      actionId: "a001",
      enabled: true,
      maxAnimationMs: 1200,
      compareReducedMotion: false,
      layoutShiftApproximationPx: 0,
      riskyProperties: [],
      normal: [
        animationTarget({
          id: "primary",
          text: "Create first project",
          transitionProperty: "opacity",
          transitionDurationMs: 420
        }),
        animationTarget({
          id: "secondary",
          transitionProperty: "opacity",
          transitionDurationMs: 80
        })
      ],
      reducedMotionStillAnimating: false
    };

    expect(animationTraceCriticalActionHideIndicators(trace, "primary")).toContain(
      "critical action target transitions opacity for 420ms"
    );
    expect(animationTraceCriticalActionHideIndicators(trace, "secondary")).toEqual([]);
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
      expect(trace.longTaskApiAvailable).toEqual(expect.any(Boolean));
      expect(Array.isArray(trace.longTasks)).toBe(true);

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

  it("records long task markers in animation traces when the browser exposes them", async () => {
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
            }
          </style>
          <button>Run busy action</button>
          <p id="status" role="status"></p>
          <script>
            document.querySelector("button").addEventListener("click", () => {
              const started = performance.now();
              while (performance.now() - started < 90) {}
              document.getElementById("status").textContent = "Busy action complete";
            });
          </script>
        `),
        traceRoot,
        commandMode: "run",
        maxActions: 1,
        settleMs: 20,
        scenario: {
          id: "motion-long-task",
          title: "Motion long task",
          persona: "tester",
          interactive_exploration: { enabled: true, click_all_safe_controls: true },
          animation_audit: {
            enabled: true,
            max_animation_ms: 1000
          }
        }
      });

      expect(result.actions[0].clicked).toBe(true);
      const trace = JSON.parse(await readFile(result.actions[0].animationTrace!, "utf8")) as AnimationTrace;

      expect(Array.isArray(trace.longTasks)).toBe(true);
      if (trace.longTaskApiAvailable) {
        expect(trace.longTaskObserverInstalled).toBe(true);
        expect(trace.longTasks?.some((task) => task.durationMs >= 50)).toBe(true);
        expect(animationTraceJankIndicators(trace)).toContain("1 long task marker(s) recorded during the action");
      }
    } finally {
      await rm(traceRoot, { recursive: true, force: true });
    }
  });

  it("does not collect reduced-motion evidence or findings unless comparison is enabled", async () => {
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
              transition-property: opacity;
              transition-duration: 500ms;
            }
            @media (prefers-reduced-motion: reduce) {
              button {
                transition-duration: 500ms;
              }
            }
          </style>
          <button>Create first project</button>
        `),
        traceRoot,
        commandMode: "run",
        maxActions: 1,
        settleMs: 0,
        scenario: {
          id: "motion-no-compare",
          title: "Motion no compare",
          persona: "tester",
          interactive_exploration: { enabled: true },
          animation_audit: {
            enabled: true,
            compare_reduced_motion: false,
            max_animation_ms: 1000
          }
        }
      });

      expect(result.actions[0].animationTrace).toContain("a001-animation-trace.json");
      const trace = JSON.parse(await readFile(result.actions[0].animationTrace!, "utf8")) as AnimationTrace;

      expect(trace.compareReducedMotion).toBe(false);
      expect(trace.reducedMotion).toBeUndefined();
      expect(trace.reducedMotionStillAnimating).toBe(false);
      expect(result.findings.map((finding) => finding.detector)).not.toContain("animation_ignores_reduced_motion");
    } finally {
      await rm(traceRoot, { recursive: true, force: true });
    }
  });

  it("reports primary CTA visibility-affecting motion as critical action evidence", async () => {
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
              transition-property: opacity;
              transition-duration: 420ms;
              transition-timing-function: ease;
            }
          </style>
          <button>Create first project</button>
        `),
        traceRoot,
        commandMode: "run",
        maxActions: 1,
        settleMs: 0,
        scenario: {
          id: "critical-motion",
          title: "Critical motion",
          persona: "tester",
          visual_contract: { primary_cta: { preferred_labels: ["Create first project"] } },
          interactive_exploration: { enabled: true, mode: "agentic" },
          animation_audit: {
            enabled: true,
            max_animation_ms: 1000
          }
        }
      });

      expect(result.actions[0].targetCategory).toBe("primary_cta");
      expect(result.findings.map((finding) => finding.detector)).toContain("animation_hides_critical_action");
      expect(
        result.findings.find((finding) => finding.detector === "animation_hides_critical_action")?.evidencePaths?.animationTrace
      ).toContain("a001-animation-trace.json");

      const actionTrace = JSON.parse(await readFile(result.artifacts.actionTrace, "utf8")) as {
        actions: Array<{ findingDetectors: string[] }>;
      };
      expect(actionTrace.actions[0].findingDetectors).toContain("animation_hides_critical_action");
    } finally {
      await rm(traceRoot, { recursive: true, force: true });
    }
  });
});
