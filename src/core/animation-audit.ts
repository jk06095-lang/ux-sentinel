import path from "node:path";
import type { Page } from "playwright";
import { writeJson } from "./files.js";
import { withReducedMotion } from "./reduced-motion.js";
import type { AnimationAuditOptions, AnimationTargetTrace, AnimationTrace, ElementBox, InteractiveTarget } from "./types.js";

const riskyAnimatedProperties = new Set([
  "top",
  "left",
  "right",
  "bottom",
  "width",
  "height",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "font-size",
  "box-shadow",
  "filter"
]);

export interface RecordedAnimationTrace {
  trace: AnimationTrace;
  path: string;
}

function roundBox(box: ElementBox): ElementBox {
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height)
  };
}

function splitProperties(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function riskyPropertiesFor(properties: string[]): string[] {
  if (properties.includes("all")) {
    return ["all"];
  }

  return Array.from(new Set(properties.filter((property) => riskyAnimatedProperties.has(property))));
}

function layoutShift(before?: ElementBox, after?: ElementBox): number {
  if (!before || !after) {
    return 0;
  }

  return Math.round(Math.hypot(after.x - before.x, after.y - before.y));
}

function traceIsAnimating(trace: AnimationTargetTrace): boolean {
  return (
    trace.transitionDurationMs > 0 ||
    trace.animationDurationMs > 0 ||
    trace.webAnimations.some((animation) => animation.durationMs > 0)
  );
}

async function collectAnimationTargets(page: Page, targetId: string): Promise<AnimationTargetTrace[]> {
  return page.evaluate((currentTargetId) => {
    const normalize = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
    const parseTimeList = (value: string) =>
      value.split(",").map((part) => {
        const item = part.trim();
        if (!item || item === "none") {
          return 0;
        }
        if (item.endsWith("ms")) {
          return Number.parseFloat(item) || 0;
        }
        if (item.endsWith("s")) {
          return (Number.parseFloat(item) || 0) * 1000;
        }
        return Number.parseFloat(item) || 0;
      });
    const maxTime = (value: string) => Math.max(0, ...parseTimeList(value));

    const candidates = Array.from(document.querySelectorAll<HTMLElement>("[data-ux-sentinel-target-id], body *"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const hasMotion =
          maxTime(style.transitionDuration) > 0 ||
          maxTime(style.animationDuration) > 0 ||
          element.getAnimations().length > 0 ||
          element.getAttribute("data-ux-sentinel-target-id") === currentTargetId;
        return (
          hasMotion &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.top < window.innerHeight &&
          rect.left < window.innerWidth &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      })
      .slice(0, 80);

    return candidates.map((element, index) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const webAnimations = element.getAnimations().slice(0, 8).map((animation) => {
        const timing = animation.effect?.getTiming();
        const duration = typeof timing?.duration === "number" ? timing.duration : 0;
        const delay = typeof timing?.delay === "number" ? timing.delay : 0;
        return {
          playState: animation.playState,
          durationMs: Math.round(duration),
          delayMs: Math.round(delay),
          easing: typeof timing?.easing === "string" ? timing.easing : ""
        };
      });

      return {
        id: element.getAttribute("data-ux-sentinel-target-id") ?? `motion${index + 1}`,
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute("role"),
        text: normalize(element.innerText || element.textContent || element.getAttribute("aria-label") || "").slice(0, 160),
        bbox: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        transitionProperty: style.transitionProperty,
        transitionDurationMs: Math.round(maxTime(style.transitionDuration)),
        transitionDelayMs: Math.round(maxTime(style.transitionDelay)),
        transitionTimingFunction: style.transitionTimingFunction,
        animationName: style.animationName,
        animationDurationMs: Math.round(maxTime(style.animationDuration)),
        animationDelayMs: Math.round(maxTime(style.animationDelay)),
        animationTimingFunction: style.animationTimingFunction,
        webAnimationCount: webAnimations.length,
        webAnimations,
        riskyProperties: []
      };
    });
  }, targetId);
}

function addRiskyProperties(targets: AnimationTargetTrace[]): AnimationTargetTrace[] {
  return targets.map((target) => ({
    ...target,
    riskyProperties: riskyPropertiesFor(splitProperties(target.transitionProperty))
  }));
}

function normalReducedStillAnimating(normal: AnimationTargetTrace[], reduced: AnimationTargetTrace[]): boolean {
  return normal.some((normalTarget) => {
    if (!traceIsAnimating(normalTarget)) {
      return false;
    }
    const reducedTarget = reduced.find((target) => target.id === normalTarget.id);
    return Boolean(reducedTarget && traceIsAnimating(reducedTarget));
  });
}

export function resolveAnimationAuditOptions(scenarioOptions?: {
  enabled?: boolean;
  compare_reduced_motion?: boolean;
  detect_layout_shift?: boolean;
  detect_risky_properties?: boolean;
  max_animation_ms?: number;
}): AnimationAuditOptions {
  return {
    enabled: scenarioOptions?.enabled ?? false,
    compareReducedMotion: scenarioOptions?.compare_reduced_motion ?? false,
    detectLayoutShift: scenarioOptions?.detect_layout_shift ?? true,
    detectRiskyProperties: scenarioOptions?.detect_risky_properties ?? true,
    maxAnimationMs: Math.max(100, Math.min(10_000, Math.floor(scenarioOptions?.max_animation_ms ?? 1200)))
  };
}

export async function recordAnimationTrace(
  page: Page,
  target: InteractiveTarget,
  actionId: string,
  actionsDir: string,
  options: AnimationAuditOptions,
  beforeTargetBbox?: ElementBox
): Promise<RecordedAnimationTrace | undefined> {
  if (!options.enabled) {
    return undefined;
  }

  const normal = addRiskyProperties(await collectAnimationTargets(page, target.id));
  const reducedMotion = options.compareReducedMotion
    ? await withReducedMotion(page, async () => addRiskyProperties(await collectAnimationTargets(page, target.id)))
    : undefined;
  const afterTargetBbox = normal.find((item) => item.id === target.id)?.bbox ?? roundBox(target.bbox);
  const riskyProperties = Array.from(new Set(normal.flatMap((item) => item.riskyProperties)));
  const trace: AnimationTrace = {
    actionId,
    enabled: true,
    maxAnimationMs: options.maxAnimationMs,
    compareReducedMotion: options.compareReducedMotion,
    beforeTargetBbox: beforeTargetBbox ? roundBox(beforeTargetBbox) : undefined,
    afterTargetBbox,
    layoutShiftApproximationPx: layoutShift(beforeTargetBbox, afterTargetBbox),
    riskyProperties,
    normal,
    reducedMotion,
    reducedMotionStillAnimating: reducedMotion ? normalReducedStillAnimating(normal, reducedMotion) : false
  };
  const tracePath = path.join(actionsDir, `${actionId}-animation-trace.json`);
  await writeJson(tracePath, trace);

  return {
    trace,
    path: tracePath
  };
}

export function animationTraceHasLongDuration(trace: AnimationTrace): boolean {
  return trace.normal.some(
    (target) =>
      target.transitionDurationMs + target.transitionDelayMs > trace.maxAnimationMs ||
      target.animationDurationMs + target.animationDelayMs > trace.maxAnimationMs ||
      target.webAnimations.some((animation) => animation.durationMs + animation.delayMs > trace.maxAnimationMs)
  );
}

export function animationTraceHasRiskyProperties(trace: AnimationTrace): boolean {
  return trace.riskyProperties.length > 0;
}
