import path from "node:path";
import type { Finding, RunResult, Scenario, Verdict } from "./types.js";
import { displayPath, ensureDir, safeSlug, timestamp, writeText } from "./files.js";

function plural(value: unknown[]): string {
  return value.length === 1 ? "1" : String(value.length);
}

export function buildReportMarkdown(result: Omit<RunResult, "reportPath">): string {
  const { scenario, url, verdict, findings, observation } = result;
  const functional = findings.filter((finding) => finding.type === "Functional Issue");
  const perception = findings.filter((finding) => finding.type === "Perception Mismatch");
  const interactive = observation.interactive;

  return `# UX Sentinel Report

## Scenario
- id: ${scenario.id}
- title: ${scenario.title}
- url: ${url}
- persona: ${scenario.persona}
- viewport: ${observation.screenMap.viewport.width}x${observation.screenMap.viewport.height}
- timestamp: ${observation.screenMap.timestamp}

## Verdict
- result: ${verdict}
- functional issues: ${plural(functional)}
- perception mismatch issues: ${plural(perception)}

## Evidence
- screenshot: ${displayPath(observation.artifacts.screenshot)}
- screen-map: ${displayPath(observation.artifacts.screenMap)}
- html overlay: ${displayPath(observation.artifacts.overlay)}
- accessibility snapshot: ${observation.artifacts.accessibility ? displayPath(observation.artifacts.accessibility) : "not available"}
- console errors: ${observation.screenMap.consoleErrors.length}
- network errors: ${observation.screenMap.networkErrors.length}
${interactive ? `- interactive action trace: ${displayPath(interactive.artifacts.actionTrace)}
- interactive contact sheet: ${displayPath(interactive.artifacts.contactSheet)}
- interactive anomalies: ${displayPath(interactive.artifacts.anomalies)}` : ""}

${interactive ? formatInteractiveSection(interactive) : ""}

## Findings

${findings.length ? findings.map(formatFinding).join("\n\n") : "No findings."}

## Codex Patch Brief

${buildInlinePatchBrief(scenario, verdict, findings)}
`;
}

function formatInteractiveSection(interactive: NonNullable<RunResult["observation"]["interactive"]>): string {
  return `## Interactive Exploration
- actions: ${interactive.summary.actionCount}
- screenshots: ${interactive.summary.screenshotCount}
- anomalies: ${interactive.summary.anomalyCount}
- baseline screenshot: ${displayPath(interactive.artifacts.baseline)}
- contact sheet: ${displayPath(interactive.artifacts.contactSheet)}
`;
}

function formatFinding(finding: Finding): string {
  return `### ${finding.id}: ${finding.title}
- Severity: ${finding.severity}
- Type: ${finding.type}
- Detector: ${finding.detector}
- Evidence: ${finding.evidence}
- User impact: ${finding.userImpact}
- Suggested fix: ${finding.suggestedFix}
- Regression check: ${finding.regressionCheck}`;
}

function buildInlinePatchBrief(scenario: Scenario, verdict: Verdict, findings: Finding[]): string {
  if (findings.length === 0) {
    return `The scenario \`${scenario.id}\` is ${verdict}. No patch is required.`;
  }

  return [
    `Patch the UI so the scenario goal is human-visible: ${scenario.goal?.user_wants ?? scenario.title}.`,
    "",
    "Required behavior:",
    ...findings.map((finding) => `- ${finding.id}: ${finding.suggestedFix}`),
    "",
    "Acceptance checks:",
    ...findings.map((finding) => `- ${finding.regressionCheck}`),
    "",
    "Forbidden fixes:",
    "- Do not hide or suppress ux-sentinel findings without fixing the visible UI.",
    "- Do not change scenarios or visual contracts just to hide interactive findings.",
    "- Do not rely on aria-labels alone for a primary action.",
    "- Do not introduce a SaaS, account system, cloud runner, database, Chrome extension, or required LLM API."
  ].join("\n");
}

export async function writeRunReport(result: Omit<RunResult, "reportPath">, reportsDir = path.join(process.cwd(), ".ux-sentinel", "reports")): Promise<string> {
  await ensureDir(reportsDir);
  const reportPath = path.resolve(reportsDir, `${safeSlug(result.scenario.id)}-${timestamp()}.md`);
  await writeText(reportPath, buildReportMarkdown(result));
  return reportPath;
}
