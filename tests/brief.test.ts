import { describe, expect, it } from "vitest";
import { buildCodexBriefMarkdown } from "../src/core/brief.js";

describe("codex brief generation", () => {
  it("converts a report into a patch brief", () => {
    const report = `# UX Sentinel Report

## Scenario
- id: onboarding-empty-state
- url: http://example.test/broken

## Verdict
- result: fail

## Evidence
- screenshot: .ux-sentinel/traces/test/screenshot.png
- screen-map: .ux-sentinel/traces/test/screen-map.json
- html overlay: .ux-sentinel/traces/test/screen-map.html
- accessibility snapshot: .ux-sentinel/traces/test/accessibility.json
- interactive action trace: .ux-sentinel/traces/test/action-trace.json
- interactive state graph: .ux-sentinel/traces/test/state-graph.json
- interactive contact sheet: .ux-sentinel/traces/test/contact-sheet.html
- interactive anomalies: .ux-sentinel/traces/test/anomalies.json
- interactive trace manifest: .ux-sentinel/traces/test/trace-manifest.json

## Findings

### UX-001: Empty state has no visible primary CTA
- Severity: P1
- Type: Perception Mismatch
- Evidence: No projects yet
- Evidence paths: beforeScreenshot=.ux-sentinel/traces/test/actions/a001-before.png, afterScreenshot=.ux-sentinel/traces/test/actions/a001-after.png, visualDiff=.ux-sentinel/traces/test/actions/a001-diff.png
- User impact: User cannot identify the next step.
- Suggested fix: Add visible CTA.
- Regression check: Run scenario again.
`;

    const brief = buildCodexBriefMarkdown(report, "report.md");

    expect(brief).toContain("# Codex Patch Brief");
    expect(brief).toContain("onboarding-empty-state");
    expect(brief).toContain("## Evidence Artifacts");
    expect(brief).toContain("screenshot.png");
    expect(brief).toContain("screen-map.json");
    expect(brief).toContain("state-graph.json");
    expect(brief).toContain("contact-sheet.html");
    expect(brief).toContain("trace-manifest.json");
    expect(brief).toContain("a001-before.png");
    expect(brief).toContain("a001-diff.png");
    expect(brief).toContain("ux-sentinel run <scenario.yaml> --url <patched-url> --interactive");
    expect(brief).toContain("inspect the newly generated contact sheet, action trace, and state graph");
    expect(brief).toContain("same action-linked visual anomaly");
    expect(brief).toContain("Do not change scenarios");
    expect(brief).toContain("Do not rely on aria-label alone");
  });

  it("keeps nested evidence bullets inside parsed findings", () => {
    const report = `# UX Sentinel Report

## Scenario
- id: interactive-review
- url: http://example.test/fixed

## Verdict
- result: fail

## Findings

### UX-042: Action feedback is not visible
- Severity: P1
- Type: Perception Mismatch
- Evidence paths:
  - before screenshot: .ux-sentinel/traces/test/actions/a001-before.png
  - after screenshot: .ux-sentinel/traces/test/actions/a001-after.png
- Evidence: Safe click changed DOM without visible feedback.
- User impact: User cannot tell whether the action worked.
- Suggested fix: Add visible confirmation.
- Regression check: Rerun interactive scenario.

## Codex Patch Brief

Inline source brief.
`;

    const brief = buildCodexBriefMarkdown(report, "interactive-report.md");

    expect(brief).toContain("UX-042");
    expect(brief).toContain("before screenshot: .ux-sentinel/traces/test/actions/a001-before.png");
    expect(brief).toContain("after screenshot: .ux-sentinel/traces/test/actions/a001-after.png");
    expect(brief).toContain("ux-sentinel run <scenario.yaml> --url <patched-url>");
    expect(brief).not.toContain("ux-sentinel run <scenario.yaml> --url <patched-url> --interactive");
    expect(brief).not.toContain("inspect the newly generated contact sheet");
    expect(brief).not.toContain("Inline source brief.");
  });
});
