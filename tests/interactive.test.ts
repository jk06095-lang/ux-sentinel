import { chromium } from "playwright";
import { describe, expect, it } from "vitest";
import {
  buildContactSheetHtml,
  clickBlockageFromHitTest,
  collectVisibleInteractiveTargets,
  detectVisualAnomalies,
  hasClippedTextMetric,
  intersectionRatio,
  isDangerousClickLabel
} from "../src/core/interactive.js";
import type { ClickBlockage, InteractiveExplorationResult, Scenario } from "../src/core/types.js";

function emptyAnalysis() {
  return {
    viewport: { width: 1280, height: 720 },
    textBoxes: [],
    primaryActions: [],
    floatingOverlays: [],
    svgNodes: [],
    svgEdges: [],
    svgTexts: [],
    cards: [],
    clippedText: [],
    dagContainers: [],
    emptyDagColumns: []
  };
}

describe("interactive exploration helpers", () => {
  it("collects visible interactive targets and flags unsafe clicks", async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await page.setContent(`
        <button aria-label="Create first project">+</button>
        <a href="/billing">Billing</a>
        <div role="button" tabindex="0" data-ux-role="primary">Open panel</div>
        <button>Delete project</button>
      `);

      const targets = await collectVisibleInteractiveTargets(page, ["Delete"]);

      expect(targets.map((target) => target.tag)).toContain("button");
      expect(targets.some((target) => target.role === "button" && target.dataUxRole === "primary")).toBe(true);
      expect(targets.find((target) => target.visibleText === "Delete project")?.safeToClick).toBe(false);
      expect(targets.find((target) => target.visibleText === "Billing")?.skipClickReason).toBe("navigation link");
    } finally {
      await browser.close();
    }
  });

  it("detects dangerous click labels", () => {
    expect(isDangerousClickLabel("Delete this project")).toBe(true);
    expect(isDangerousClickLabel("Create first project")).toBe(false);
  });

  it("calculates bbox overlap ratio", () => {
    const ratio = intersectionRatio(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 50, y: 50, width: 100, height: 100 }
    );

    expect(ratio).toBe(0.25);
  });

  it("reports click target blocking from center hit-test evidence", () => {
    const blocker: ClickBlockage["blocker"] = {
      tag: "div",
      role: "dialog",
      text: "Blocking modal",
      ariaLabel: null,
      bbox: { x: 0, y: 0, width: 400, height: 400 }
    };
    const blockage = clickBlockageFromHitTest([
      {
        kind: "center",
        point: { x: 120, y: 80 },
        topIsTargetOrDescendant: false,
        blocker
      }
    ]);

    expect(blockage?.blocked).toBe(true);
    expect(blockage?.blocker?.role).toBe("dialog");
  });

  it("detects text clipping metrics and emits card clipping anomalies", () => {
    const metric = {
      id: "clip1",
      kind: "clipped_text",
      text: "Create first project from this dashboard",
      bbox: { x: 20, y: 20, width: 120, height: 24 },
      inCard: true,
      overflowX: "hidden",
      overflowY: "hidden",
      scrollWidth: 260,
      clientWidth: 120,
      scrollHeight: 24,
      clientHeight: 24
    };
    const scenario: Scenario = {
      id: "clip",
      title: "Clip",
      persona: "first-time-user",
      visual_anomaly_contract: { no_important_text_truncation: true }
    };

    expect(hasClippedTextMetric(metric)).toBe(true);
    expect(detectVisualAnomalies({ ...emptyAnalysis(), clippedText: [metric] }, scenario).map((finding) => finding.detector)).toContain(
      "card_content_clipped"
    );
  });

  it("renders a contact sheet with before and after screenshots", () => {
    const result: Pick<InteractiveExplorationResult, "actions" | "findings" | "summary" | "artifacts"> = {
      actions: [
        {
          id: "a001",
          sequence: 1,
          actionType: "hover",
          target: {
            id: "t001",
            tag: "button",
            role: "button",
            dataUxRole: null,
            visibleText: "Create first project",
            ariaLabel: null,
            title: null,
            bbox: { x: 10, y: 20, width: 160, height: 44 },
            center: { x: 90, y: 42 },
            disabled: false,
            focusable: true,
            href: null,
            safeToClick: true
          },
          beforeScreenshot: "trace/actions/a001-before.png",
          afterScreenshot: "trace/actions/a001-after.png",
          screenMap: "trace/actions/a001-screen-map.json",
          clicked: false,
          focused: false,
          consoleErrorCount: 0,
          networkErrorCount: 0,
          findingDetectors: ["tooltip_partially_offscreen"]
        }
      ],
      findings: [],
      summary: { actionCount: 1, screenshotCount: 3, anomalyCount: 0 },
      artifacts: {
        traceDir: "trace",
        baseline: "trace/baseline.png",
        screenMap: "trace/screen-map.json",
        overlay: "trace/screen-map.html",
        actionsDir: "trace/actions",
        actionTrace: "trace/action-trace.json",
        anomalies: "trace/anomalies.json",
        contactSheet: "trace/contact-sheet.html"
      }
    };

    const html = buildContactSheetHtml(result);

    expect(html).toContain("a001-before.png");
    expect(html).toContain("a001-after.png");
    expect(html).toContain("tooltip_partially_offscreen");
  });
});
