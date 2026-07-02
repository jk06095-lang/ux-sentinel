import path from "node:path";
import type { Finding, RunResult, Scenario, Verdict } from "./types.js";
import { displayPath, ensureDir, safeSlug, timestamp, writeText } from "./files.js";
import { enrichFindingsWithRules } from "./rules/registry.js";

function plural(value: unknown[]): string {
  return value.length === 1 ? "1" : String(value.length);
}

function formatUxRuleProfile(scenario: Scenario): string {
  const profile = scenario.ux_rule_profile;
  if (!profile?.enabled) {
    return "";
  }

  const ruleSets = profile.rule_sets?.length ? profile.rule_sets.join(", ") : "none declared";
  return [
    "- UX rule profile: enabled",
    `- UX rule sets: ${ruleSets}`,
    `- require rule mapping: ${profile.require_rule_mapping === true ? "true" : "false"}`
  ].join("\n");
}

function attachObservationEvidencePaths(result: Omit<RunResult, "reportPath">): Finding[] {
  const { observation } = result;
  return result.findings.map((finding) => ({
    ...finding,
    evidencePaths: {
      screenshot: displayPath(observation.artifacts.screenshot),
      screenMap: displayPath(observation.artifacts.screenMap),
      ...(observation.artifacts.accessibility
        ? { accessibilitySnapshot: displayPath(observation.artifacts.accessibility) }
        : {}),
      ...(finding.evidencePaths ?? {})
    }
  }));
}

export function buildReportMarkdown(result: Omit<RunResult, "reportPath">): string {
  const { scenario, url, verdict, observation } = result;
  const findings = enrichFindingsWithRules(attachObservationEvidencePaths(result));
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
${formatUxRuleProfile(scenario)}

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
- interactive state graph: ${displayPath(interactive.artifacts.stateGraph)}
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
  const notes = interactive.summary.notes.length
    ? ["- notes:", ...interactive.summary.notes.map((note) => `  - ${note}`)].join("\n")
    : "- notes: none";
  return `## Interactive Exploration
- actions: ${interactive.summary.actionCount}
- screenshots: ${interactive.summary.screenshotCount}
- anomalies: ${interactive.summary.anomalyCount}
- baseline screenshot: ${displayPath(interactive.artifacts.baseline)}
- state graph: ${displayPath(interactive.artifacts.stateGraph)}
- contact sheet: ${displayPath(interactive.artifacts.contactSheet)}
${notes}
`;
}

function formatFinding(finding: Finding): string {
  const ruleLines = [
    finding.ruleIds?.length ? `- UX rules: ${finding.ruleIds.join(", ")}` : undefined,
    finding.ruleFamily ? `- Rule family: ${finding.ruleFamily}` : undefined,
    finding.whyThisMatters ? `- Why this matters: ${finding.whyThisMatters}` : undefined,
    finding.confidence ? `- Confidence: ${finding.confidence}` : undefined,
    finding.evidencePaths && Object.keys(finding.evidencePaths).length
      ? `- Evidence paths: ${Object.entries(finding.evidencePaths).map(([key, value]) => `${key}=${value}`).join(", ")}`
      : undefined
  ].filter(Boolean).join("\n");

  return `### ${finding.id}: ${finding.title}
- Severity: ${finding.severity}
- Type: ${finding.type}
- Detector: ${finding.detector}
${ruleLines ? `${ruleLines}\n` : ""}- Evidence: ${finding.evidence}
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
