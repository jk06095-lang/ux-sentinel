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
import { collectScreenMap } from "../src/core/observe-page.js";
import type { ClickBlockage, InteractiveExplorationResult, Scenario } from "../src/core/types.js";

function emptyAnalysis() {
  return {
    viewport: { width: 1280, height: 720 },
    textBoxes: [],
    interactiveTargets: [],
    primaryActions: [],
    floatingOverlays: [],
    svgNodes: [],
    svgEdges: [],
    svgTexts: [],
    cards: [],
    clippedText: [],
    stickyLayerOverlaps: [],
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

  it("preserves explicit tabindex values in the screen map", async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await page.setContent(`
        <main>
          <button tabindex="2">Top action</button>
          <button tabindex="1">Bottom action</button>
          <button>Native action</button>
        </main>
      `);

      const screenMap = await collectScreenMap(page, page.url(), [], []);

      expect(screenMap.elements.find((element) => element.visibleText === "Top action")?.tabIndex).toBe(2);
      expect(screenMap.elements.find((element) => element.visibleText === "Bottom action")?.tabIndex).toBe(1);
      expect(screenMap.elements.find((element) => element.visibleText === "Native action")?.tabIndex).toBeNull();
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

    const oldMojibakeLabels = [
      [0x3f, 0x3f, 0xc823],
      [0x3f, 0xc493, 0xad45],
      [0x5bc3, 0xacd7, 0xc823],
      [0x6fe1, 0xc493, 0xb807, 0x3f, 0xafa9, 0xc350]
    ].map((codePoints) => String.fromCodePoint(...codePoints));
    for (const label of oldMojibakeLabels) {
      expect(isDangerousClickLabel(label)).toBe(false);
    }
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
        { id: "s", title: "S", persona: "p", interactive_exploration: { enabled: true, click_all_safe_controls: false } },
        { commandMode: "run" }
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

  it("detects tooltips that overlap their trigger target", () => {
    const findings = detectVisualAnomalies({
      ...emptyAnalysis(),
      floatingOverlays: [
        {
          id: "floating1",
          kind: "tooltip",
          text: "Helpful details",
          bbox: { x: 90, y: 90, width: 180, height: 64 }
        }
      ],
      interactiveTargets: [
        {
          id: "target1",
          kind: "interactive_target",
          text: "Help",
          bbox: { x: 100, y: 104, width: 96, height: 36 }
        }
      ]
    }).map((finding) => finding.detector);

    expect(findings).toContain("tooltip_blocks_trigger");
  });

  it("detects sticky layers that hide content outside their own subtree", () => {
    const findings = detectVisualAnomalies({
      ...emptyAnalysis(),
      stickyLayerOverlaps: [
        {
          id: "sticky1",
          kind: "sticky_layer",
          text: "Global nav",
          bbox: { x: 0, y: 0, width: 1280, height: 72 },
          position: "fixed",
          coveredId: "target1",
          coveredKind: "interactive_target",
          coveredText: "Create first project",
          coveredBox: { x: 40, y: 24, width: 180, height: 44 },
          hitTestPoint: { x: 130, y: 46 },
          overlapRatio: 0.78
        }
      ]
    });

    expect(findings.map((finding) => finding.detector)).toContain("sticky_layer_hides_content");
    expect(findings.find((finding) => finding.detector === "sticky_layer_hides_content")?.evidence).toContain(
      "Create first project"
    );
  });

  it("collects sticky layer overlap evidence from a real page", async () => {
    const traceRoot = await tempTraceRoot();
    try {
      const result = await interactiveExplorePage({
        url: dataUrl(`
          <style>
            body { margin: 0; }
            .topbar { position: fixed; z-index: 20; left: 0; top: 0; width: 100%; height: 80px; background: white; }
            main { position: relative; min-height: 240px; }
            button { position: absolute; left: 40px; top: 24px; width: 180px; height: 44px; }
          </style>
          <div class="topbar">Global navigation</div>
          <main><button>Create first project</button></main>
        `),
        traceRoot,
        commandMode: "run",
        maxActions: 1,
        settleMs: 0,
        scenario: {
          id: "sticky-overlap",
          title: "Sticky overlap",
          persona: "tester",
          interactive_exploration: { enabled: true }
        }
      });

      const finding = result.findings.find((item) => item.detector === "sticky_layer_hides_content");

      expect(finding?.evidence).toContain("Create first project");
      expect(finding?.ruleIds).toContain("gestalt.common_region");
    } finally {
      await rm(traceRoot, { recursive: true, force: true });
    }
  });

  it("renders a contact sheet with before and after screenshots", () => {
    const result: Pick<InteractiveExplorationResult, "actions" | "clickCandidates" | "findings" | "summary" | "artifacts"> = {
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
          visualDiff: "trace/actions/a001-diff.png",
          screenMap: "trace/actions/a001-screen-map.json",
          beforeStateId: "s000",
          afterStateId: "s001",
          targetCategory: "tooltip_help_trigger",
          riskLevel: "low",
          pointerTrace: "trace/actions/a001-pointer-trace.json",
          pointerTraceSummary: {
            from: { x: 40, y: 40 },
            to: { x: 120, y: 80 },
            targetCenter: { x: 120, y: 80 },
            pointCount: 5,
            movementDurationMs: 240,
            hoverDurationMs: 100,
            targetMovedDuringApproach: false,
            overlayAppearedDuringApproach: false,
            finalHitTestMatchedTarget: true
          },
          animationTrace: "trace/actions/a001-animation-trace.json",
          clicked: false,
          focused: false,
          consoleErrorCount: 0,
          networkErrorCount: 0,
          findingDetectors: ["tooltip_partially_offscreen"]
        }
      ],
      clickCandidates: [
        {
          id: "t001",
          tag: "button",
          role: "button",
          dataUxRole: null,
          visibleText: "Open help",
          ariaLabel: null,
          title: null,
          bbox: { x: 10, y: 20, width: 120, height: 36 },
          href: null,
          targetCategory: "tooltip_help_trigger",
          riskLevel: "low",
          safeToClick: true,
          clickDecision: "allowed",
          clickDecisionReason: "safe_click capability enabled and target passed planner budget checks",
          planned: true,
          plannedActionId: "a001",
          plannedSafeClick: true
        }
      ],
      findings: [
        {
          id: "UX-I001",
          detector: "tooltip_partially_offscreen",
          title: "Tooltip is partially offscreen",
          severity: "P2",
          type: "Perception Mismatch",
          evidence: "Tooltip bbox extends beyond viewport.",
          userImpact: "A user may not be able to read the hover help.",
          suggestedFix: "Keep tooltip content inside the viewport.",
          regressionCheck: "Rerun the interactive audit.",
          ruleIds: ["nielsen.visibility_of_system_status"],
          ruleFamily: "nielsen",
          whyThisMatters: "Visibility of system status: hover feedback should remain readable.",
          confidence: "high"
        },
        {
          id: "UX-I002",
          detector: "ambiguous_panel_overlap",
          title: "Panel overlap needs review",
          severity: "P3",
          type: "Perception Mismatch",
          evidence: "Panel overlap was inferred from weak geometry evidence.",
          userImpact: "A reviewer should confirm whether the overlap blocks important UI.",
          suggestedFix: "Inspect the screenshot before changing layout.",
          regressionCheck: "Rerun the contact sheet review.",
          ruleIds: ["gestalt.common_region"],
          ruleFamily: "gestalt",
          whyThisMatters: "Common region: grouped content should not be visually ambiguous.",
          confidence: "low"
        }
      ],
      summary: { actionCount: 1, screenshotCount: 4, anomalyCount: 0, notes: [] },
      artifacts: {
        traceDir: "trace",
        baseline: "trace/baseline.png",
        screenMap: "trace/screen-map.json",
        overlay: "trace/screen-map.html",
        actionsDir: "trace/actions",
        actionTrace: "trace/action-trace.json",
        stateGraph: "trace/state-graph.json",
        anomalies: "trace/anomalies.json",
        contactSheet: "trace/contact-sheet.html"
      }
    };

    const html = buildContactSheetHtml(result);

    expect(html).toContain("a001-before.png");
    expect(html).toContain("a001-after.png");
    expect(html).toContain("a001-diff.png");
    expect(html).toContain("a001-pointer-trace.json");
    expect(html).toContain("a001-animation-trace.json");
    expect(html).toContain("tooltip_partially_offscreen");
    expect(html).toContain("Severity filter");
    expect(html).toContain("Rule-family filter");
    expect(html).toContain("Confidence filter");
    expect(html).toContain("Detector filter");
    expect(html).toContain("Action Timeline");
    expect(html).toContain("State Graph Summary");
    expect(html).toContain("State Graph Map");
    expect(html).toContain('<svg class="state-graph-map"');
    expect(html).toContain('data-state-node="s000"');
    expect(html).toContain('data-state-node="s001"');
    expect(html).toContain('data-state-edge="a001"');
    expect(html).toContain("State Transition Path");
    expect(html).toContain('<a href="#a001">a001</a> <strong>s000 -> s001</strong> observed hover on Create first project');
    expect(html).toContain("tooltip_help_trigger / low risk");
    expect(html).toContain("Safety Log");
    expect(html).toContain("Click Candidate Decisions");
    expect(html).toContain("safe_click capability enabled and target passed planner budget checks");
    expect(html).toContain('Action trace: <a href="action-trace.json">action-trace.json</a>');
    expect(html).toContain('state graph: <a href="state-graph.json">state-graph.json</a>');
    expect(html).toContain('before=<a href="actions/a001-before.png">actions/a001-before.png</a>');
    expect(html).toContain('after=<a href="actions/a001-after.png">actions/a001-after.png</a>');
    expect(html).toContain('diff=<a href="actions/a001-diff.png">actions/a001-diff.png</a>');
    expect(html).toContain('screen-map=<a href="actions/a001-screen-map.json">actions/a001-screen-map.json</a>');
    expect(html).toContain("Accessibility Cross-Check");
    expect(html).toContain("Finding Evidence And UX Principles");
    expect(html).toContain("data-action-card");
    expect(html).toContain("data-severities=\"P2\"");
    expect(html).toContain("data-rule-families=\"nielsen\"");
    expect(html).toContain("data-confidences=\"high\"");
    expect(html).toContain("data-confidence=\"low\"");
    expect(html).toContain("bbox");
    expect(html).toContain("Visibility of system status");
    expect(html).toContain("Evidence status: evidence-backed finding");
    expect(html).toContain("Evidence status: ambiguous heuristic review prompt");
    expect(html).toContain("Evidence: Tooltip bbox extends beyond viewport.");
    expect(html).toContain("User impact: A user may not be able to read the hover help.");
    expect(html).toContain("Suggested fix: Keep tooltip content inside the viewport.");
    expect(html).toContain("Regression check: Rerun the interactive audit.");
    expect(html).toContain("Safe click decision:");
    expect(html).toContain("Pointer trace:");
    expect(html).toContain('href="actions/a001-pointer-trace.json"');
    expect(html).toContain("Pointer metadata:");
    expect(html).toContain("points=5, move=240ms, hover=100ms, targetMoved=false, overlayAppeared=false, finalHit=true");
    expect(html).toContain("Animation trace:");
    expect(html).toContain('href="actions/a001-animation-trace.json"');
    expect(html).toContain('href="actions/a001-diff.png"');
    expect(html).toContain("visual diff");
    expect(html).toContain("Focus evidence:");
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
      expect(contactSheet).toContain('before=<a href="actions/a002-before.png">actions/a002-before.png</a>');
      expect(contactSheet).toContain('after=<a href="actions/a002-after.png">actions/a002-after.png</a>');
      expect(contactSheet).toContain('diff=<a href="actions/a002-diff.png">actions/a002-diff.png</a>');
      expect(contactSheet).toContain('screen-map=<a href="actions/a002-screen-map.json">actions/a002-screen-map.json</a>');
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
      expect(stopped.summary.notes.join(" ")).toContain("stopped remaining planned actions");

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

  it("uses agentic planning to prioritize the scenario primary CTA", async () => {
    const traceRoot = await tempTraceRoot();
    try {
      const result = await interactiveExplorePage({
        url: dataUrl(`
          <button onclick="document.body.dataset.secondary='true'">Secondary settings</button>
          <button onclick="document.body.dataset.created='true'">Create first project</button>
        `),
        traceRoot,
        commandMode: "run",
        maxActions: 1,
        settleMs: 0,
        scenario: {
          id: "agentic-priority",
          title: "Agentic priority",
          persona: "tester",
          visual_contract: { primary_cta: { preferred_labels: ["Create first project"] } },
          interactive_exploration: { enabled: true, mode: "agentic", click_all_safe_controls: true, max_clicks: 1, max_state_changes: 1 }
        }
      });

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].target.visibleText).toBe("Create first project");
      expect(result.actions[0].targetCategory).toBe("primary_cta");
      expect(result.actions[0].plannedReason).toContain("primary_cta");
      expect(result.actions[0].riskLevel).toBe("low");
      expect(result.actions[0].clicked).toBe(true);

      const actionTrace = JSON.parse(await readFile(result.artifacts.actionTrace, "utf8")) as {
        planner: { mode: string; maxClicks: number; maxStateChanges: number; plannedActionCount: number };
        actions: Array<{
          targetCategory?: string;
          plannedReason?: string;
          pointerTraceSummary?: {
            pointCount: number;
            movementDurationMs: number;
            hoverDurationMs: number;
            finalHitTestMatchedTarget: boolean;
          };
        }>;
      };
      expect(actionTrace.planner.mode).toBe("agentic");
      expect(actionTrace.planner.maxClicks).toBe(1);
      expect(actionTrace.planner.maxStateChanges).toBe(1);
      expect(actionTrace.actions[0].targetCategory).toBe("primary_cta");
      expect(actionTrace.actions[0].plannedReason).toContain("primary_cta");
      expect(result.actions[0].beforeStateId).toBe("s000");
      expect(result.actions[0].afterStateId).toBe("s001");
      expect(result.actions[0].domDiff).toContain("a001-dom-diff.json");
      expect(result.actions[0].accessibilityDiff).toContain("a001-a11y-diff.json");
      expect(result.actions[0].visualDiff).toContain("a001-diff.png");
      expect(result.actions[0].pointerTrace).toContain("a001-pointer-trace.json");
      await stat(result.artifacts.stateGraph);
      await stat(result.actions[0].domDiff!);
      await stat(result.actions[0].accessibilityDiff!);
      await stat(result.actions[0].visualDiff!);
      await stat(result.actions[0].pointerTrace!);
      const pointerTrace = JSON.parse(await readFile(result.actions[0].pointerTrace!, "utf8")) as {
        points: Array<{ x: number; y: number; t: number }>;
        finalHitTestMatchedTarget: boolean;
      };
      expect(pointerTrace.points.length).toBeGreaterThan(2);
      expect(pointerTrace.finalHitTestMatchedTarget).toBe(true);
      expect(actionTrace.actions[0].pointerTraceSummary).toMatchObject({
        pointCount: pointerTrace.points.length,
        movementDurationMs: 0,
        hoverDurationMs: 0,
        finalHitTestMatchedTarget: true
      });
      const stateGraph = JSON.parse(await readFile(result.artifacts.stateGraph, "utf8")) as {
        nodes: Array<{ id: string; visibleTextHash: string; domStructureHash: string }>;
        edges: Array<{
          actionId: string;
          beforeStateId: string;
          afterStateId: string;
          domDiff: string;
          accessibilityDiff: string;
          visualDiff?: string;
          pointerTrace?: string;
          cursorMovement?: {
            pointCount: number;
            movementDurationMs: number;
            hoverDurationMs: number;
            finalHitTestMatchedTarget: boolean;
          };
          findings: Array<{
            id: string;
            detector: string;
            severity: string;
            title: string;
            evidence: string;
            userImpact: string;
            suggestedFix: string;
            regressionCheck: string;
            ruleIds?: string[];
            confidence?: string;
          }>;
        }>;
      };
      expect(stateGraph.nodes.map((node) => node.id)).toEqual(["s000", "s001"]);
      expect(stateGraph.nodes[0].visibleTextHash).toMatch(/^[a-f0-9]{64}$/);
      expect(stateGraph.edges[0]).toMatchObject({ actionId: "a001", beforeStateId: "s000", afterStateId: "s001" });
      expect(stateGraph.edges[0].visualDiff).toContain("a001-diff.png");
      expect(stateGraph.edges[0].pointerTrace).toContain("a001-pointer-trace.json");
      expect(stateGraph.edges[0].cursorMovement).toMatchObject({
        pointCount: pointerTrace.points.length,
        movementDurationMs: 0,
        hoverDurationMs: 0,
        finalHitTestMatchedTarget: true
      });
      expect(stateGraph.edges[0].findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            detector: "no_feedback_after_action",
            severity: "P2",
            title: "Action produced no visible feedback",
            evidence: expect.stringContaining("a001 clicked"),
            userImpact: "A user may not know whether the action worked, failed, or is still pending.",
            suggestedFix: "Show visible feedback after the action, such as changed state, confirmation copy, a loading state, or an error/recovery path.",
            regressionCheck: "Run the same agentic interactive scenario and confirm the action produces a visible state change or feedback message.",
            ruleIds: expect.arrayContaining(["nielsen.visibility_of_system_status"])
          })
        ])
      );
      const domDiff = JSON.parse(await readFile(result.actions[0].domDiff!, "utf8")) as {
        beforeStateId: string;
        afterStateId: string;
        domStructureChanged: boolean;
      };
      expect(domDiff.beforeStateId).toBe("s000");
      expect(domDiff.afterStateId).toBe("s001");
      expect(result.actions[0].findingDetectors).toContain("no_feedback_after_action");
    } finally {
      await rm(traceRoot, { recursive: true, force: true });
    }
  });

  it("records every baseline click candidate decision in action trace and contact sheet", async () => {
    const traceRoot = await tempTraceRoot();
    try {
      const result = await interactiveExplorePage({
        url: dataUrl(`
          <button onclick="document.body.dataset.created='true'">Create first project</button>
          <button>Delete project</button>
          <a href="/billing">Billing</a>
          <div data-ux-role="dag-node">Graph node metadata</div>
          <form><button>Save profile</button></form>
          <button disabled>Disabled action</button>
        `),
        traceRoot,
        commandMode: "run",
        maxActions: 1,
        settleMs: 0,
        scenario: {
          id: "candidate-decisions",
          title: "Candidate decisions",
          persona: "tester",
          visual_contract: { primary_cta: { preferred_labels: ["Create first project"] } },
          interactive_exploration: { enabled: true, mode: "agentic", click_all_safe_controls: true, max_clicks: 1 }
        }
      });

      const actionTrace = JSON.parse(await readFile(result.artifacts.actionTrace, "utf8")) as {
        clickCandidates: Array<{
          visibleText: string;
          clickDecision: string;
          clickDecisionReason: string;
          planned: boolean;
          plannedActionId?: string;
        }>;
      };

      expect(actionTrace.clickCandidates).toHaveLength(6);
      expect(actionTrace.clickCandidates.find((item) => item.visibleText === "Create first project")).toMatchObject({
        clickDecision: "allowed",
        planned: true,
        plannedActionId: "a001"
      });
      expect(actionTrace.clickCandidates.find((item) => item.visibleText === "Delete project")?.clickDecisionReason).toBe(
        "dangerous label"
      );
      expect(actionTrace.clickCandidates.find((item) => item.visibleText === "Billing")?.clickDecisionReason).toBe("navigation link");
      expect(actionTrace.clickCandidates.find((item) => item.visibleText === "Graph node metadata")?.clickDecisionReason).toBe(
        "data-ux-role metadata only"
      );
      expect(actionTrace.clickCandidates.find((item) => item.visibleText === "Save profile")?.clickDecisionReason).toBe("inside form");
      expect(actionTrace.clickCandidates.find((item) => item.visibleText === "Disabled action")?.clickDecisionReason).toBe("disabled");

      const contactSheet = await readFile(result.artifacts.contactSheet, "utf8");
      expect(contactSheet).toContain("Click Candidate Decisions");
      expect(contactSheet).toContain("dangerous label");
      expect(contactSheet).toContain("data-ux-role metadata only");
      expect(contactSheet).toContain("inside form");
    } finally {
      await rm(traceRoot, { recursive: true, force: true });
    }
  });

  it("detects safe clicks that introduce unrelated high-risk state", async () => {
    const traceRoot = await tempTraceRoot();
    try {
      const result = await interactiveExplorePage({
        url: dataUrl(`
          <button onclick="document.getElementById('panel').hidden = false">Create first project</button>
          <section id="panel" hidden>Billing settings opened</section>
        `),
        traceRoot,
        commandMode: "run",
        maxActions: 1,
        settleMs: 0,
        scenario: {
          id: "unrelated-state",
          title: "Unrelated state",
          persona: "tester",
          visual_contract: { primary_cta: { preferred_labels: ["Create first project"] } },
          interactive_exploration: { enabled: true, mode: "agentic", click_all_safe_controls: true, max_clicks: 1 }
        }
      });

      expect(result.actions[0].clicked).toBe(true);
      expect(result.actions[0].findingDetectors).toContain("safe_click_changed_unrelated_state");
      expect(result.findings.find((finding) => finding.detector === "safe_click_changed_unrelated_state")?.evidence).toContain(
        "Billing settings opened"
      );
      const domDiff = JSON.parse(await readFile(result.actions[0].domDiff!, "utf8")) as {
        visibleTextAdded: string[];
      };
      expect(domDiff.visibleTextAdded).toContain("Billing settings opened");
    } finally {
      await rm(traceRoot, { recursive: true, force: true });
    }
  });

  it("does not flag safe click state changes that match the target label", async () => {
    const traceRoot = await tempTraceRoot();
    try {
      const result = await interactiveExplorePage({
        url: dataUrl(`
          <button onclick="document.getElementById('panel').hidden = false">Open billing</button>
          <section id="panel" hidden>Billing settings opened</section>
        `),
        traceRoot,
        commandMode: "run",
        maxActions: 1,
        settleMs: 0,
        scenario: {
          id: "related-state",
          title: "Related state",
          persona: "tester",
          interactive_exploration: { enabled: true, mode: "agentic", click_all_safe_controls: true, max_clicks: 1 }
        }
      });

      expect(result.actions[0].clicked).toBe(true);
      expect(result.actions[0].findingDetectors).not.toContain("safe_click_changed_unrelated_state");
      expect(result.findings.map((finding) => finding.detector)).not.toContain("safe_click_changed_unrelated_state");
    } finally {
      await rm(traceRoot, { recursive: true, force: true });
    }
  });

  it("detects missing and obscured focus evidence after focusing keyboard targets", async () => {
    const traceRoot = await tempTraceRoot();
    try {
      const result = await interactiveExplorePage({
        url: dataUrl(`
          <style>
            button { position: absolute; left: 80px; top: 80px; width: 180px; height: 44px; outline: none; box-shadow: none; }
            button:focus { outline: none; box-shadow: none; }
            #cover { position: fixed; left: 72px; top: 72px; width: 210px; height: 70px; z-index: 5; background: white; }
          </style>
          <button onfocus="document.getElementById('cover').hidden = false">Focus target</button>
          <div id="cover" hidden>Covering focus</div>
        `),
        traceRoot,
        commandMode: "run",
        maxActions: 1,
        settleMs: 20,
        scenario: {
          id: "focus-evidence",
          title: "Focus evidence",
          persona: "keyboard-user",
          interactive_exploration: { enabled: true, focus_all_keyboard_targets: true }
        }
      });

      expect(result.actions[0].focused).toBe(true);
      expect(result.actions[0].focusEvidence?.activeElementMatchesTarget).toBe(true);
      expect(result.actions[0].focusEvidence?.hasVisibleFocusIndicator).toBe(false);
      expect(result.actions[0].focusEvidence?.hitTestMatchedTarget).toBe(false);
      expect(result.findings.map((finding) => finding.detector)).toEqual(
        expect.arrayContaining(["focus_ring_missing", "focus_obscured_by_author_content"])
      );
    } finally {
      await rm(traceRoot, { recursive: true, force: true });
    }
  });

  it("detects visible context changes caused by focus alone", async () => {
    const traceRoot = await tempTraceRoot();
    try {
      const result = await interactiveExplorePage({
        url: dataUrl(`
          <style>
            button { position: absolute; left: 80px; top: 80px; width: 180px; height: 44px; }
            button:focus { outline: 3px solid #111; }
            #panel { position: absolute; left: 80px; top: 150px; width: 220px; min-height: 48px; }
          </style>
          <button onfocus="document.getElementById('panel').hidden = false">Show details</button>
          <div id="panel" hidden>Focus opened account details</div>
        `),
        traceRoot,
        commandMode: "run",
        maxActions: 1,
        settleMs: 20,
        scenario: {
          id: "focus-context-change",
          title: "Focus context change",
          persona: "keyboard-user",
          interactive_exploration: { enabled: true, focus_all_keyboard_targets: true }
        }
      });

      expect(result.actions[0].focused).toBe(true);
      expect(result.actions[0].clicked).toBe(false);
      expect(result.actions[0].findingDetectors).toContain("focus_caused_context_change");
      expect(result.findings.map((finding) => finding.detector)).toContain("focus_caused_context_change");
      expect(result.findings.find((finding) => finding.detector === "focus_caused_context_change")?.evidence).toContain(
        "DOM diff:"
      );

      const domDiff = JSON.parse(await readFile(result.actions[0].domDiff!, "utf8")) as {
        visibleTextAdded: string[];
      };
      expect(domDiff.visibleTextAdded).toContain("Focus opened account details");
    } finally {
      await rm(traceRoot, { recursive: true, force: true });
    }
  });

  it("skips safe clicks when hover changes the final pointer hit-test", async () => {
    const traceRoot = await tempTraceRoot();
    try {
      const result = await interactiveExplorePage({
        url: dataUrl(`
          <style>
            body { margin: 0; min-height: 320px; }
            button { position: absolute; left: 100px; top: 100px; width: 180px; height: 48px; }
            #overlay { position: fixed; left: 90px; top: 90px; width: 240px; height: 100px; z-index: 999; background: white; }
          </style>
          <button onmouseenter="document.getElementById('overlay').hidden = false" onclick="document.body.dataset.clicked='true'">Open panel</button>
          <div id="overlay" hidden>Hover panel</div>
        `),
        traceRoot,
        commandMode: "explore",
        clickSafeOverride: true,
        maxActions: 1,
        settleMs: 20
      });

      expect(result.actions[0].clicked).toBe(false);
      expect(result.actions[0].clickDecision).toBe("skipped");
      expect(result.actions[0].clickDecisionReason).toBe("cursor target drift");
      expect(result.actions[0].pointerTrace).toContain("a001-pointer-trace.json");
      expect(result.findings.map((finding) => finding.detector)).toEqual(
        expect.arrayContaining([
          "overlay_appeared_during_cursor_approach",
          "hover_trigger_blocks_target",
          "hover_content_blocks_trigger",
          "cursor_target_drift"
        ])
      );
      const pointerTrace = JSON.parse(await readFile(result.actions[0].pointerTrace!, "utf8")) as {
        overlayAppearedDuringApproach: boolean;
        finalHitTestMatchedTarget: boolean;
      };
      expect(pointerTrace.overlayAppearedDuringApproach).toBe(true);
      expect(pointerTrace.finalHitTestMatchedTarget).toBe(false);
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
      await stat(result.actions[0].visualDiff!);
      const contactSheet = await readFile(result.artifacts.contactSheet, "utf8");
      expect(contactSheet).toContain("a001-before.png");
      expect(contactSheet).toContain("a001-after.png");
      expect(contactSheet).toContain("a001-diff.png");
      expect(result.summary.notes.join(" ")).toContain("always captures before/after screenshots");
    } finally {
      await rm(traceRoot, { recursive: true, force: true });
    }
  });
});
