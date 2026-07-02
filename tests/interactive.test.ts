import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { describe, expect, it } from "vitest";
import {
  buildContactSheetHtml,
  clickBlockageFromHitTest,
  collectVisibleInteractiveTargets,
  detectVisualAnomalies,
  hasClippedTextMetric,
  interactiveExplorePage,
  intersectionRatio,
  isDangerousClickLabel,
  resolveInteractiveConfig
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

function dataUrl(html: string): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

async function tempTraceRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "ux-sentinel-interactive-test-"));
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
        <div data-ux-role="dag-node">Node A</div>
        <div data-ux-role="dag-node" data-ux-action="open-detail">Node B</div>
        <div data-ux-role="dag-node" data-ux-clickable="true">Node C</div>
        <div data-ux-role="dag-canvas">Canvas</div>
        <button disabled>Disabled action</button>
        <form><button>Save profile</button><input type="submit" value="Submit profile" /></form>
        <input type="button" value="Delete from input" />
        <button>Delete project</button>
      `);

      const targets = await collectVisibleInteractiveTargets(page, ["Delete"]);

      expect(targets.map((target) => target.tag)).toContain("button");
      expect(targets.some((target) => target.role === "button" && target.dataUxRole === "primary")).toBe(true);
      expect(targets.find((target) => target.visibleText === "Delete project")?.safeToClick).toBe(false);
      expect(targets.find((target) => target.visibleText === "Billing")?.skipClickReason).toBe("navigation link");
      expect(targets.find((target) => target.visibleText === "Node A")?.safeToClick).toBe(false);
      expect(targets.find((target) => target.visibleText === "Node A")?.skipClickReason).toBe("data-ux-role metadata only");
      expect(targets.find((target) => target.visibleText === "Node B")?.safeToClick).toBe(true);
      expect(targets.find((target) => target.visibleText === "Node C")?.safeToClick).toBe(true);
      expect(targets.find((target) => target.visibleText === "Canvas")?.safeToClick).toBe(false);
      expect(targets.find((target) => target.visibleText === "Disabled action")?.skipClickReason).toBe("disabled");
      expect(targets.find((target) => target.visibleText === "Save profile")?.skipClickReason).toBe("inside form");
      expect(targets.find((target) => target.visibleText === "Submit profile")?.skipClickReason).toBe("inside form");
      expect(targets.find((target) => target.visibleText === "Delete from input")?.skipClickReason).toBe("dangerous label");
    } finally {
      await browser.close();
    }
  });

  it("detects dangerous click labels", () => {
    expect(isDangerousClickLabel("Delete this project")).toBe(true);
    expect(isDangerousClickLabel("삭제")).toBe(true);
    expect(isDangerousClickLabel("제거")).toBe(true);
    expect(isDangerousClickLabel("결제")).toBe(true);
    expect(isDangerousClickLabel("로그아웃")).toBe(true);
    expect(isDangerousClickLabel("Create first project")).toBe(false);
    expect(isDangerousClickLabel("프로젝트 만들기")).toBe(false);
  });

  it("defaults explore and scenario interactive runs to no safe clicks", () => {
    expect(resolveInteractiveConfig(undefined, { commandMode: "explore" }).clickAllSafeControls).toBe(false);
    expect(
      resolveInteractiveConfig(
        { id: "s", title: "S", persona: "p", interactive_exploration: { enabled: true } },
        { commandMode: "run" }
      ).clickAllSafeControls
    ).toBe(false);
    expect(
      resolveInteractiveConfig(
        { id: "s", title: "S", persona: "p", interactive_exploration: { enabled: true, click_all_safe_controls: true } },
        { commandMode: "run" }
      ).clickAllSafeControls
    ).toBe(true);
    expect(resolveInteractiveConfig(undefined, { commandMode: "explore", clickSafeOverride: true }).clickAllSafeControls).toBe(true);
    expect(
      resolveInteractiveConfig(
        { id: "s", title: "S", persona: "p", interactive_exploration: { enabled: true } },
        { commandMode: "run", clickSafeOverride: true }
      ).clickAllSafeControls
    ).toBe(false);
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
      summary: { actionCount: 1, screenshotCount: 3, anomalyCount: 0, notes: [] },
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
    expect(html).toContain("Safe click decision:");
  });

  it("skips stale targets instead of clicking old coordinates", async () => {
    const traceRoot = await tempTraceRoot();
    try {
      const result = await interactiveExplorePage({
        url: dataUrl(`
          <button id="first" onclick="document.getElementById('second').remove()">Open panel</button>
          <button id="second" onclick="document.body.dataset.secondClicked='true'">Second action</button>
        `),
        traceRoot,
        commandMode: "run",
        maxActions: 2,
        settleMs: 0,
        scenario: {
          id: "stale-target",
          title: "Stale target",
          persona: "tester",
          interactive_exploration: { enabled: true, click_all_safe_controls: true }
        }
      });

      expect(result.actions).toHaveLength(2);
      expect(result.actions[0].clicked).toBe(true);
      expect(result.actions[1].skipped).toBe(true);
      expect(result.actions[1].skipReason).toContain("no longer exists");
      expect(result.actions[1].clicked).toBe(false);

      const actionTrace = JSON.parse(await readFile(result.artifacts.actionTrace, "utf8")) as {
        actions: Array<{ skipped?: boolean; skipReason?: string; clickDecision?: string; clickDecisionReason?: string }>;
      };
      expect(actionTrace.actions[1].skipped).toBe(true);
      expect(actionTrace.actions[1].skipReason).toContain("no longer exists");
      expect(actionTrace.actions[1].clickDecision).toBe("skipped");
      expect(actionTrace.actions[1].clickDecisionReason).toContain("no longer exists");
      const contactSheet = await readFile(result.artifacts.contactSheet, "utf8");
      expect(contactSheet).toContain("skipped:");
      expect(contactSheet).toContain("no longer exists");
    } finally {
      await rm(traceRoot, { recursive: true, force: true });
    }
  });

  it("stops baseline target execution after navigation unless explicitly allowed", async () => {
    const html = `
      <button id="first" onclick="location.href='about:blank#next'">Change route</button>
      <button id="second" onclick="document.body.dataset.secondClicked='true'">Second action</button>
    `;
    const baseScenario: Scenario = {
      id: "navigation",
      title: "Navigation",
      persona: "tester",
      interactive_exploration: { enabled: true, click_all_safe_controls: true }
    };
    const stoppedTraceRoot = await tempTraceRoot();
    const allowedTraceRoot = await tempTraceRoot();
    try {
      const stopped = await interactiveExplorePage({
        url: dataUrl(html),
        traceRoot: stoppedTraceRoot,
        commandMode: "run",
        maxActions: 2,
        settleMs: 0,
        scenario: baseScenario
      });
      expect(stopped.actions).toHaveLength(1);
      expect(stopped.actions[0].urlBefore).not.toBe(stopped.actions[0].urlAfter);
      expect(stopped.summary.notes.join(" ")).toContain("stopped remaining baseline-collected targets");

      const allowed = await interactiveExplorePage({
        url: dataUrl(html),
        traceRoot: allowedTraceRoot,
        commandMode: "run",
        maxActions: 2,
        settleMs: 0,
        scenario: {
          ...baseScenario,
          interactive_exploration: { enabled: true, click_all_safe_controls: true, allow_navigation: true }
        }
      });
      expect(allowed.actions).toHaveLength(2);
      expect(allowed.actions[1].skipped).toBe(true);
    } finally {
      await rm(stoppedTraceRoot, { recursive: true, force: true });
      await rm(allowedTraceRoot, { recursive: true, force: true });
    }
  });

  it("does not click in explore mode unless click-safe is enabled", async () => {
    const traceRoot = await tempTraceRoot();
    try {
      const result = await interactiveExplorePage({
        url: dataUrl(`<button onclick="this.textContent='Clicked'">Increment</button>`),
        traceRoot,
        commandMode: "explore",
        maxActions: 1,
        settleMs: 0
      });

      expect(result.actions[0].clicked).toBe(false);
      expect(result.actions[0].clickSkippedReason).toBe("safe_click capability disabled");
      expect(result.actions[0].clickDecision).toBe("skipped");
      expect(result.actions[0].target.visibleText).toBe("Increment");
    } finally {
      await rm(traceRoot, { recursive: true, force: true });
    }
  });

  it("clicks in explore mode when click-safe is enabled", async () => {
    const traceRoot = await tempTraceRoot();
    try {
      const result = await interactiveExplorePage({
        url: dataUrl(`<button onclick="this.textContent='Clicked'">Increment</button>`),
        traceRoot,
        commandMode: "explore",
        clickSafeOverride: true,
        maxActions: 1,
        settleMs: 0
      });

      expect(result.actions[0].clicked).toBe(true);
      expect(result.actions[0].clickDecision).toBe("allowed");
    } finally {
      await rm(traceRoot, { recursive: true, force: true });
    }
  });

  it("does not click dangerous labels even when safe-click capability is enabled", async () => {
    const traceRoot = await tempTraceRoot();
    try {
      const result = await interactiveExplorePage({
        url: dataUrl(`<button onclick="document.body.dataset.deleted='true'">Delete project</button>`),
        traceRoot,
        commandMode: "explore",
        clickSafeOverride: true,
        maxActions: 1,
        settleMs: 0
      });

      expect(result.actions[0].clicked).toBe(false);
      expect(result.actions[0].clickDecision).toBe("skipped");
      expect(result.actions[0].clickDecisionReason).toBe("dangerous label");
    } finally {
      await rm(traceRoot, { recursive: true, force: true });
    }
  });

  it("always writes contact sheet screenshots even when scenario disables per-action screenshots", async () => {
    const traceRoot = await tempTraceRoot();
    try {
      const result = await interactiveExplorePage({
        url: dataUrl(`<button>Review</button>`),
        traceRoot,
        commandMode: "run",
        maxActions: 1,
        settleMs: 0,
        scenario: {
          id: "screenshots",
          title: "Screenshots",
          persona: "tester",
          interactive_exploration: {
            enabled: true,
            screenshot_before_after_each_action: false
          }
        }
      });

      await stat(result.actions[0].beforeScreenshot);
      await stat(result.actions[0].afterScreenshot);
      const contactSheet = await readFile(result.artifacts.contactSheet, "utf8");
      expect(contactSheet).toContain("a001-before.png");
      expect(contactSheet).toContain("a001-after.png");
      expect(result.summary.notes.join(" ")).toContain("always captures before/after screenshots");
    } finally {
      await rm(traceRoot, { recursive: true, force: true });
    }
  });
});
