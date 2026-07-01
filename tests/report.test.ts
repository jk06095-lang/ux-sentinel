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
    expect(report).toContain("## Codex Patch Brief");
    expect(report).toContain("UX-001");
  });
});
