import path from "node:path";
import { readText, safeSlug, timestamp, writeText } from "./files.js";

function matchLine(source: string, label: string): string {
  const match = source.match(new RegExp(`^- ${label}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() ?? "unknown";
}

function extractFindings(report: string): string[] {
  const findingsStart = report.search(/^## Findings\s*$/m);
  if (findingsStart === -1) {
    return [];
  }

  const afterFindingsHeading = report.slice(findingsStart).replace(/^## Findings\s*\r?\n/m, "");
  const nextSectionStart = afterFindingsHeading.search(/^##\s+/m);
  const findingsSection = nextSectionStart === -1 ? afterFindingsHeading : afterFindingsHeading.slice(0, nextSectionStart);
  const matches = findingsSection.match(/^### UX-\d{3}: .+(?:\r?\n(?!### UX-\d{3}: |## ).*)*/gm);
  return matches?.map((finding) => finding.trim()).filter(Boolean) ?? [];
}

function artifactLine(label: string, value: string): string | undefined {
  return value === "unknown" ? undefined : `- ${label}: ${value}`;
}

function formatEvidenceArtifacts(report: string): string {
  const lines = [
    artifactLine("screenshot", matchLine(report, "screenshot")),
    artifactLine("screen-map", matchLine(report, "screen-map")),
    artifactLine("html overlay", matchLine(report, "html overlay")),
    artifactLine("accessibility snapshot", matchLine(report, "accessibility snapshot")),
    artifactLine("interactive action trace", matchLine(report, "interactive action trace")),
    artifactLine("interactive state graph", matchLine(report, "interactive state graph")),
    artifactLine("interactive contact sheet", matchLine(report, "interactive contact sheet")),
    artifactLine("interactive anomalies", matchLine(report, "interactive anomalies")),
    artifactLine("interactive trace manifest", matchLine(report, "interactive trace manifest"))
  ].filter(Boolean);

  return lines.length ? lines.join("\n") : "- No artifact paths were parsed from the source report.";
}

function hasInteractiveEvidence(report: string): boolean {
  return (
    matchLine(report, "interactive action trace") !== "unknown" ||
    matchLine(report, "interactive state graph") !== "unknown" ||
    matchLine(report, "interactive contact sheet") !== "unknown" ||
    matchLine(report, "interactive trace manifest") !== "unknown" ||
    /^## Interactive Exploration\s*$/m.test(report)
  );
}

function formatRegressionCommand(interactive: boolean): string {
  return `ux-sentinel run <scenario.yaml> --url <patched-url>${interactive ? " --interactive" : ""}`;
}

function formatInteractiveRegressionCheck(interactive: boolean): string {
  if (!interactive) {
    return "";
  }

  return [
    "",
    "For interactive source reports, inspect the newly generated contact sheet, action trace, and state graph after the rerun. Confirm the same action-linked visual anomaly, skip reason, pointer trace issue, or motion finding is gone rather than hidden by a scenario change."
  ].join("\n");
}

export function buildCodexBriefMarkdown(report: string, sourceReport: string): string {
  const scenario = matchLine(report, "id");
  const url = matchLine(report, "url");
  const result = matchLine(report, "result");
  const findings = extractFindings(report);
  const interactive = hasInteractiveEvidence(report);

  return `# Codex Patch Brief

## Source
- report: ${sourceReport}
- scenario: ${scenario}
- url: ${url}
- result: ${result}

## Evidence Artifacts
${formatEvidenceArtifacts(report)}

## Goal

Fix the visible UI perception mismatch without changing the product scope.

## Findings To Address

${findings.length ? findings.join("\n\n") : "No findings were parsed from the source report."}

## Acceptance Criteria

- The same ux-sentinel scenario passes after the UI patch.
- The primary next action is visible to a human, not only present in the DOM or accessibility tree.
- Evidence artifacts still include screenshot, screen-map.json, screen-map.html, console errors, and network errors.
- If the source report includes interactive exploration, the contact sheet, action trace, and state graph no longer show the same visual anomaly.

## Forbidden Fixes

- Do not suppress or delete checks to make the report pass.
- Do not change scenarios, fail conditions, or visual contracts just to hide findings.
- Do not rely on aria-label alone for a primary CTA.
- Do not add SaaS, auth, database, hosted runner, Chrome extension, or required LLM API behavior.

## Suggested Regression Check

Run:

\`\`\`bash
${formatRegressionCommand(interactive)}
\`\`\`
${formatInteractiveRegressionCheck(interactive)}
`;
}

export async function createCodexBrief(reportPath: string, outputDir = path.join(process.cwd(), ".ux-sentinel", "briefs")): Promise<string> {
  const report = await readText(reportPath);
  const slug = safeSlug(path.basename(reportPath, path.extname(reportPath)));
  const outputPath = path.resolve(outputDir, `${slug}-${timestamp()}.codex-brief.md`);
  await writeText(outputPath, buildCodexBriefMarkdown(report, reportPath));
  return outputPath;
}
