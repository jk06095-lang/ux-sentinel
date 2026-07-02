import { describe, expect, it } from "vitest";
import { buildReportMarkdown } from "../src/core/report.js";
import type { Finding, ObservationResult, Scenario } from "../src/core/types.js";

describe("report generation", () => {
  it("renders evidence and Codex repair notes", () => {
    const scenario: Scenario = {
      id: "onboarding-empty-state",
      title: "First-time user sees clear next action",
      persona: "first-time-user",
      goal: { user_wants: "Create the first project", primary_intent: "create_project" }
    };
    const finding: Finding = {
      id: "UX-001",
      detector: "empty_state_without_cta",
      title: "Empty state has no visible primary CTA",
      severity: "P1",
      type: "Perception Mismatch",
      evidence: "No projects yet",
      userImpact: "User cannot identify the next step.",
      suggestedFix: "Add visible CTA.",
      regressionCheck: "Run scenario again."
    };
    const observation: ObservationResult = {
      accessibilitySnapshot: null,
      artifacts: {
        traceDir: ".ux-sentinel/traces/test",
        screenshot: ".ux-sentinel/traces/test/screenshot.png",
        screenMap: ".ux-sentinel/traces/test/screen-map.json",
        overlay: ".ux-sentinel/traces/test/screen-map.html",
        accessibility: ".ux-sentinel/traces/test/accessibility.json"
      },
      screenMap: {
        url: "http://example.test",
        timestamp: "2026-07-01T00:00:00.000Z",
        viewport: { width: 1280, height: 720 },
        document: { width: 1280, height: 720, hasHorizontalScroll: false },
        visibleText: [],
        elements: [],
        consoleErrors: [],
        networkErrors: [],
        risks: []
      },
      interactive: {
        screenMap: {
          url: "http://example.test",
          timestamp: "2026-07-01T00:00:00.000Z",
          viewport: { width: 1280, height: 720 },
          document: { width: 1280, height: 720, hasHorizontalScroll: false },
          visibleText: [],
          elements: [],
          consoleErrors: [],
          networkErrors: [],
          risks: []
        },
        accessibilitySnapshot: null,
        actions: [],
        clickCandidates: [],
        findings: [],
        artifacts: {
          traceDir: ".ux-sentinel/traces/test",
          baseline: ".ux-sentinel/traces/test/baseline.png",
          screenMap: ".ux-sentinel/traces/test/screen-map.json",
          overlay: ".ux-sentinel/traces/test/screen-map.html",
          actionsDir: ".ux-sentinel/traces/test/actions",
          actionTrace: ".ux-sentinel/traces/test/action-trace.json",
          stateGraph: ".ux-sentinel/traces/test/state-graph.json",
          anomalies: ".ux-sentinel/traces/test/anomalies.json",
          contactSheet: ".ux-sentinel/traces/test/contact-sheet.html"
        },
        summary: {
          actionCount: 0,
          screenshotCount: 1,
          anomalyCount: 0,
          notes: []
        }
      }
    };

    const report = buildReportMarkdown({
      scenario,
      url: "http://example.test",
      verdict: "fail",
      findings: [finding],
      observation
    });

    expect(report).toContain("# UX Sentinel Report");
    expect(report).toContain("screen-map.html");
    expect(report).toContain("## Interactive Exploration");
    expect(report).toContain("state-graph.json");
    expect(report).toContain("contact-sheet.html");
    expect(report).toContain("UX rules:");
    expect(report).toContain("Why this matters:");
    expect(report).toContain("Confidence:");
    expect(report).toContain("## Codex Patch Brief");
    expect(report).toContain("Do not change scenarios or visual contracts");
    expect(report).toContain("UX-001");
  });
});
