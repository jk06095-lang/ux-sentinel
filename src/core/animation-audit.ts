import path from "node:path";
import type { Page } from "playwright";
import { writeJson } from "./files.js";
import { withReducedMotion } from "./reduced-motion.js";
import type {
  AnimationAuditOptions,
  AnimationLongTaskMarker,
  AnimationMotionEnvironment,
  AnimationTargetTrace,
  AnimationTrace,
  AnimationTracePhase,
  AnimationTraceSample,
  ElementBox,
  InteractiveTarget
} from "./types.js";

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

interface LongTaskCollection {
  apiAvailable: boolean;
  observerInstalled: boolean;
  longTasks: AnimationLongTaskMarker[];
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

export async function beginAnimationLongTaskCollection(
  page: Page,
  actionId: string,
  options: AnimationAuditOptions
): Promise<void> {
  if (!options.enabled) {
    return;
  }

  await page
    .evaluate((currentActionId) => {
      const browserWindow = window as typeof window & {
        __uxSentinelLongTaskCollection?: {
          actionId: string;
          startTime: number;
          apiAvailable: boolean;
          observerInstalled: boolean;
          longTasks: AnimationLongTaskMarker[];
          observer?: PerformanceObserver;
          error?: string;
        };
      };
      const serialize = (entry: PerformanceEntry): AnimationLongTaskMarker => {
        const rawEntry = entry as PerformanceEntry & { attribution?: Array<Record<string, unknown>> };
        return {
          name: entry.name,
          entryType: entry.entryType,
          startTimeMs: Math.round(entry.startTime),
          durationMs: Math.round(entry.duration),
          attribution: (rawEntry.attribution ?? []).slice(0, 8).map((item) => ({
            name: typeof item.name === "string" ? item.name : undefined,
            entryType: typeof item.entryType === "string" ? item.entryType : undefined,
            containerType: typeof item.containerType === "string" ? item.containerType : undefined,
            containerName: typeof item.containerName === "string" ? item.containerName : undefined,
            containerId: typeof item.containerId === "string" ? item.containerId : undefined,
            containerSrc: typeof item.containerSrc === "string" ? item.containerSrc : undefined
          }))
        };
      };
      const supported =
        typeof PerformanceObserver !== "undefined" &&
        Array.isArray(PerformanceObserver.supportedEntryTypes) &&
        PerformanceObserver.supportedEntryTypes.includes("longtask");
      const collection: {
        actionId: string;
        startTime: number;
        apiAvailable: boolean;
        observerInstalled: boolean;
        longTasks: AnimationLongTaskMarker[];
        observer?: PerformanceObserver;
        error?: string;
      } = {
        actionId: currentActionId,
        startTime: performance.now(),
        apiAvailable: supported,
        observerInstalled: false,
        longTasks: [] as AnimationLongTaskMarker[]
      };
      browserWindow.__uxSentinelLongTaskCollection = collection;

      if (!supported) {
        return;
      }

      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.startTime >= collection.startTime) {
              collection.longTasks.push(serialize(entry));
            }
          }
        });
        observer.observe({ entryTypes: ["longtask"] });
        collection.observer = observer;
        collection.observerInstalled = true;
      } catch (error) {
        collection.error = error instanceof Error ? error.message : String(error);
      }
    }, actionId)
    .catch(() => undefined);
}

async function collectLongTaskMarkers(page: Page, actionId: string): Promise<LongTaskCollection> {
  return page
    .evaluate((currentActionId) => {
      const browserWindow = window as typeof window & {
        __uxSentinelLongTaskCollection?: {
          actionId: string;
          startTime: number;
          apiAvailable: boolean;
          observerInstalled: boolean;
          longTasks: AnimationLongTaskMarker[];
          observer?: PerformanceObserver;
        };
      };
      const serialize = (entry: PerformanceEntry): AnimationLongTaskMarker => {
        const rawEntry = entry as PerformanceEntry & { attribution?: Array<Record<string, unknown>> };
        return {
          name: entry.name,
          entryType: entry.entryType,
          startTimeMs: Math.round(entry.startTime),
          durationMs: Math.round(entry.duration),
          attribution: (rawEntry.attribution ?? []).slice(0, 8).map((item) => ({
            name: typeof item.name === "string" ? item.name : undefined,
            entryType: typeof item.entryType === "string" ? item.entryType : undefined,
            containerType: typeof item.containerType === "string" ? item.containerType : undefined,
            containerName: typeof item.containerName === "string" ? item.containerName : undefined,
            containerId: typeof item.containerId === "string" ? item.containerId : undefined,
            containerSrc: typeof item.containerSrc === "string" ? item.containerSrc : undefined
          }))
        };
      };
      const supported =
        typeof PerformanceObserver !== "undefined" &&
        Array.isArray(PerformanceObserver.supportedEntryTypes) &&
        PerformanceObserver.supportedEntryTypes.includes("longtask");
      const collection = browserWindow.__uxSentinelLongTaskCollection;
      const startTime = collection?.actionId === currentActionId ? collection.startTime : performance.now();
      const fromObserver = collection?.longTasks ?? [];
      const fromPerformance =
        typeof performance.getEntriesByType === "function"
          ? performance
              .getEntriesByType("longtask")
              .filter((entry) => entry.startTime >= startTime)
              .map(serialize)
          : [];
      collection?.observer?.disconnect();
      delete browserWindow.__uxSentinelLongTaskCollection;

      const byKey = new Map<string, AnimationLongTaskMarker>();
      for (const task of [...fromObserver, ...fromPerformance]) {
        byKey.set(`${task.startTimeMs}:${task.durationMs}:${task.name}`, task);
      }

      return {
        apiAvailable: collection?.apiAvailable ?? supported,
        observerInstalled: collection?.observerInstalled ?? false,
        longTasks: Array.from(byKey.values()).sort((left, right) => left.startTimeMs - right.startTimeMs)
      };
    }, actionId)
    .catch(() => ({
      apiAvailable: false,
      observerInstalled: false,
      longTasks: []
    }));
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

async function collectMotionEnvironment(
  page: Page,
  mediaEmulation: AnimationMotionEnvironment["mediaEmulation"]
): Promise<AnimationMotionEnvironment> {
  const prefersReducedMotionMatches = await page
    .evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    .catch(() => false);

  return {
    mediaEmulation,
    prefersReducedMotionMatches
  };
}

export async function collectAnimationTraceSample(
  page: Page,
  target: InteractiveTarget,
  phase: AnimationTracePhase,
  mediaEmulation: AnimationMotionEnvironment["mediaEmulation"] = phase === "reduced_motion_comparison" ? "reduce" : "no-preference"
): Promise<AnimationTraceSample> {
  return {
    phase,
    timestampMs: Date.now(),
    targets: addRiskyProperties(await collectAnimationTargets(page, target.id)),
    motionEnvironment: await collectMotionEnvironment(page, mediaEmulation)
  };
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
  beforeTargetBbox?: ElementBox,
  phaseSamples: AnimationTraceSample[] = []
): Promise<RecordedAnimationTrace | undefined> {
  if (!options.enabled) {
    return undefined;
  }

  await page.emulateMedia({ reducedMotion: "no-preference" });
  const normalMotionEnvironment = await collectMotionEnvironment(page, "no-preference");
  const afterSettleSample = await collectAnimationTraceSample(page, target, "after_settle", "no-preference");
  const normal = afterSettleSample.targets;
  const reducedMotionRun = options.compareReducedMotion
    ? await withReducedMotion(page, async () => ({
        environment: await collectMotionEnvironment(page, "reduce"),
        sample: await collectAnimationTraceSample(page, target, "reduced_motion_comparison", "reduce")
      }))
    : undefined;
  const reducedMotion = reducedMotionRun?.sample.targets;
  const reducedMotionEnvironment = reducedMotionRun?.environment;
  const samples = [...phaseSamples, afterSettleSample, ...(reducedMotionRun?.sample ? [reducedMotionRun.sample] : [])];
  const afterTargetBbox = normal.find((item) => item.id === target.id)?.bbox ?? roundBox(target.bbox);
  const riskyProperties = Array.from(new Set(normalAnimationTargets({ normal, samples } as AnimationTrace).flatMap((item) => item.riskyProperties)));
  const longTaskCollection = await collectLongTaskMarkers(page, actionId);
  const trace: AnimationTrace = {
    actionId,
    enabled: true,
    maxAnimationMs: options.maxAnimationMs,
    compareReducedMotion: options.compareReducedMotion,
    samples,
    beforeTargetBbox: beforeTargetBbox ? roundBox(beforeTargetBbox) : undefined,
    afterTargetBbox,
    layoutShiftApproximationPx: layoutShift(beforeTargetBbox, afterTargetBbox),
    riskyProperties,
    normalMotionEnvironment,
    normal,
    reducedMotionEnvironment,
    reducedMotion,
    reducedMotionStillAnimating: reducedMotion
      ? normalReducedStillAnimating(normalAnimationTargets({ normal, samples } as AnimationTrace), reducedMotion)
      : false,
    longTaskApiAvailable: longTaskCollection.apiAvailable,
    longTaskObserverInstalled: longTaskCollection.observerInstalled,
    longTasks: longTaskCollection.longTasks
  };
  const tracePath = path.join(actionsDir, `${actionId}-animation-trace.json`);
  await writeJson(tracePath, trace);

  return {
    trace,
    path: tracePath
  };
}

function normalAnimationTargets(trace: Pick<AnimationTrace, "normal"> & Partial<Pick<AnimationTrace, "samples">>): AnimationTargetTrace[] {
  const sampleTargets =
    trace.samples
      ?.filter((sample) => sample.phase !== "reduced_motion_comparison")
      .flatMap((sample) => sample.targets) ?? [];

  return sampleTargets.length ? sampleTargets : trace.normal;
}

function normalRiskyProperties(trace: Pick<AnimationTrace, "normal" | "riskyProperties"> & Partial<Pick<AnimationTrace, "samples">>): string[] {
  const fromSamples = Array.from(new Set(normalAnimationTargets(trace).flatMap((target) => target.riskyProperties)));
  return fromSamples.length ? fromSamples : trace.riskyProperties;
}

export function animationTraceHasLongDuration(trace: AnimationTrace): boolean {
  return normalAnimationTargets(trace).some(
    (target) =>
      target.transitionDurationMs + target.transitionDelayMs > trace.maxAnimationMs ||
      target.animationDurationMs + target.animationDelayMs > trace.maxAnimationMs ||
      target.webAnimations.some((animation) => animation.durationMs + animation.delayMs > trace.maxAnimationMs)
  );
}

export function animationTraceHasRiskyProperties(trace: AnimationTrace): boolean {
  return normalRiskyProperties(trace).length > 0;
}

function activeMotionDuration(target: AnimationTargetTrace): number {
  return Math.max(
    target.transitionDurationMs + target.transitionDelayMs,
    target.animationDurationMs + target.animationDelayMs,
    ...target.webAnimations.map((animation) => animation.durationMs + animation.delayMs)
  );
}

function motionDurations(trace: AnimationTrace): number[] {
  return normalAnimationTargets(trace)
    .flatMap((target) => [
      target.transitionDurationMs,
      target.animationDurationMs,
      ...target.webAnimations.map((animation) => animation.durationMs)
    ])
    .filter((duration) => duration > 0);
}

function motionEasings(trace: AnimationTrace): string[] {
  return normalAnimationTargets(trace)
    .flatMap((target) => [
      ...splitProperties(target.transitionTimingFunction),
      ...splitProperties(target.animationTimingFunction),
      ...target.webAnimations.map((animation) => animation.easing.trim().toLowerCase())
    ])
    .filter((easing) => easing && easing !== "normal" && easing !== "none");
}

export function animationTraceJankIndicators(trace: AnimationTrace): string[] {
  const indicators: string[] = [];
  const riskyProperties = normalRiskyProperties(trace);
  const activeTargets = normalAnimationTargets(trace).filter(traceIsAnimating);
  const riskyAnimatedTargets = activeTargets.filter((target) => target.riskyProperties.length > 0);

  if (riskyAnimatedTargets.some((target) => activeMotionDuration(target) > 150)) {
    indicators.push("layout or paint-heavy properties animate for more than 150ms");
  }

  if (riskyProperties.includes("all")) {
    indicators.push("transition-property: all can animate layout or paint unexpectedly");
  }

  if (activeTargets.length >= 6) {
    indicators.push(`${activeTargets.length} visible elements report simultaneous motion evidence`);
  }

  if (trace.longTasks?.length) {
    indicators.push(`${trace.longTasks.length} long task marker(s) recorded during the action`);
  }

  if (trace.layoutShiftApproximationPx > 8 && riskyProperties.length > 0) {
    indicators.push(`target layout moved ${trace.layoutShiftApproximationPx}px while risky properties were present`);
  }

  return Array.from(new Set(indicators));
}

export function animationTraceInconsistentMotionTokens(trace: AnimationTrace): string[] {
  const issues: string[] = [];
  const durations = Array.from(new Set(motionDurations(trace).map((duration) => Math.round(duration)))).sort((a, b) => a - b);
  const easings = Array.from(new Set(motionEasings(trace))).sort((a, b) => a.localeCompare(b));

  if (durations.length >= 2) {
    const shortest = durations[0];
    const longest = durations[durations.length - 1];
    if (longest - shortest >= 250 || longest / Math.max(1, shortest) >= 3) {
      issues.push(`duration tokens vary from ${shortest}ms to ${longest}ms`);
    }
  }

  if (easings.length >= 3) {
    issues.push(`easing tokens vary across ${easings.slice(0, 4).join(", ")}`);
  }

  return issues;
}

export function animationTraceCriticalActionHideIndicators(trace: AnimationTrace, targetId: string): string[] {
  const target = normalAnimationTargets(trace).find((item) => item.id === targetId);
  if (!target) {
    return [];
  }

  const transitionProperties = splitProperties(target.transitionProperty);
  const visibilityAffectingProperties = transitionProperties.filter((property) =>
    ["opacity", "filter", "all"].includes(property)
  );
  const transitionTotalMs = target.transitionDurationMs + target.transitionDelayMs;

  if (transitionTotalMs <= 150 || visibilityAffectingProperties.length === 0) {
    return [];
  }

  return [
    `critical action target transitions ${visibilityAffectingProperties.join(", ")} for ${transitionTotalMs}ms`
  ];
}
