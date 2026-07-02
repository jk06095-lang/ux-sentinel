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
- interactive action trace: .ux-sentinel/traces/test/action-trace.json
- interactive state graph: .ux-sentinel/traces/test/state-graph.json
- interactive contact sheet: .ux-sentinel/traces/test/contact-sheet.html
- interactive anomalies: .ux-sentinel/traces/test/anomalies.json

## Findings

### UX-001: Empty state has no visible primary CTA
- Severity: P1
- Type: Perception Mismatch
- Evidence: No projects yet
- User impact: User cannot identify the next step.
- Suggested fix: Add visible CTA.
- Regression check: Run scenario again.
`;

    const brief = buildCodexBriefMarkdown(report, "report.md");

    expect(brief).toContain("# Codex Patch Brief");
    expect(brief).toContain("onboarding-empty-state");
    expect(brief).toContain("state-graph.json");
    expect(brief).toContain("contact-sheet.html");
    expect(brief).toContain("Do not change scenarios");
    expect(brief).toContain("Do not rely on aria-label alone");
  });
});
