import path from "node:path";
import type { Page } from "playwright";
import { writeJson } from "./files.js";
import type { ElementBox, InteractiveTarget, PointerPoint, PointerTrace, PointerTraceHitTest, PointerTracePoint } from "./types.js";

export interface RecordPointerTraceOptions {
  from: PointerPoint;
  movementDurationMs?: number;
  hoverDurationMs?: number;
  steps?: number;
}

export interface RecordedPointerTrace {
  trace: PointerTrace;
  path: string;
}

function roundPoint(point: PointerPoint): PointerPoint {
  return {
    x: Math.round(point.x),
    y: Math.round(point.y)
  };
}

function roundBox(box: ElementBox): ElementBox {
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height)
  };
}

function boxMoved(before?: ElementBox, after?: ElementBox): boolean {
  if (!before || !after) {
    return Boolean(before || after);
  }

  return (
    Math.abs(before.x - after.x) > 2 ||
    Math.abs(before.y - after.y) > 2 ||
    Math.abs(before.width - after.width) > 2 ||
    Math.abs(before.height - after.height) > 2
  );
}

function blockerKey(hitTest: PointerTraceHitTest): string {
  const blocker = hitTest.blocker;
  if (!blocker) {
    return "";
  }
  return [blocker.tag, blocker.role ?? "", blocker.text, blocker.ariaLabel ?? "", blocker.bbox.x, blocker.bbox.y].join("|");
}

export function buildPointerPath(
  from: PointerPoint,
  to: PointerPoint,
  movementDurationMs = 240,
  steps = 4
): PointerTracePoint[] {
  const safeSteps = Math.max(2, Math.round(steps));
  const start = roundPoint(from);
  const end = roundPoint(to);

  return Array.from({ length: safeSteps }, (_, index) => {
    const progress = index / (safeSteps - 1);
    const eased = progress * progress * (3 - 2 * progress);
    return {
      x: Math.round(start.x + (end.x - start.x) * eased),
      y: Math.round(start.y + (end.y - start.y) * eased),
      t: Math.round(Math.max(0, movementDurationMs) * progress)
    };
  });
}

async function collectPointerHitTest(page: Page, target: InteractiveTarget, point: PointerPoint): Promise<PointerTraceHitTest> {
  return page.evaluate(
    ({ targetId, samplePoint }) => {
      const normalize = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
      const element = document.querySelector<HTMLElement>(`[data-ux-sentinel-target-id="${targetId}"]`);
      const top = document.elementFromPoint(samplePoint.x, samplePoint.y) as HTMLElement | null;
      const rect = element?.getBoundingClientRect();
      const topRect = top?.getBoundingClientRect();
      const hitTestMatchedTarget = Boolean(element && top && (top === element || element.contains(top)));

      return {
        bbox: rect
          ? {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            }
          : undefined,
        hitTestMatchedTarget,
        blocker:
          !hitTestMatchedTarget && top && topRect
            ? {
                tag: top.tagName.toLowerCase(),
                role: top.getAttribute("role"),
                text: normalize(top.innerText || top.textContent || "").slice(0, 160),
                ariaLabel: top.getAttribute("aria-label"),
                bbox: {
                  x: Math.round(topRect.x),
                  y: Math.round(topRect.y),
                  width: Math.round(topRect.width),
                  height: Math.round(topRect.height)
                }
              }
            : undefined
      };
    },
    { targetId: target.id, samplePoint: roundPoint(point) }
  );
}

export async function recordPointerTrace(
  page: Page,
  target: InteractiveTarget,
  actionId: string,
  actionsDir: string,
  options: RecordPointerTraceOptions
): Promise<RecordedPointerTrace> {
  const movementDurationMs = Math.max(0, options.movementDurationMs ?? 240);
  const hoverDurationMs = Math.max(0, options.hoverDurationMs ?? 0);
  const to = roundPoint(target.center);
  const points = buildPointerPath(options.from, to, movementDurationMs, options.steps ?? 4);
  const initialHitTest = await collectPointerHitTest(page, target, to);

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    await page.mouse.move(point.x, point.y);
    const previous = points[index - 1];
    const waitMs = previous ? Math.max(0, point.t - previous.t) : 0;
    if (waitMs > 0) {
      await page.waitForTimeout(waitMs);
    }
  }

  if (hoverDurationMs > 0) {
    await page.waitForTimeout(hoverDurationMs);
  }

  const finalHitTest = await collectPointerHitTest(page, target, to);
  const targetMovedDuringApproach = boxMoved(initialHitTest.bbox, finalHitTest.bbox);
  const overlayAppearedDuringApproach =
    !finalHitTest.hitTestMatchedTarget &&
    Boolean(finalHitTest.blocker) &&
    (initialHitTest.hitTestMatchedTarget || blockerKey(initialHitTest) !== blockerKey(finalHitTest));
  const trace: PointerTrace = {
    actionId,
    from: roundPoint(options.from),
    to,
    targetCenter: to,
    points,
    movementDurationMs,
    hoverDurationMs,
    initialHitTest: {
      ...initialHitTest,
      bbox: initialHitTest.bbox ? roundBox(initialHitTest.bbox) : undefined
    },
    finalHitTest: {
      ...finalHitTest,
      bbox: finalHitTest.bbox ? roundBox(finalHitTest.bbox) : undefined
    },
    targetMovedDuringApproach,
    overlayAppearedDuringApproach,
    finalHitTestMatchedTarget: finalHitTest.hitTestMatchedTarget
  };
  const tracePath = path.join(actionsDir, `${actionId}-pointer-trace.json`);
  await writeJson(tracePath, trace);

  return {
    trace,
    path: tracePath
  };
}
