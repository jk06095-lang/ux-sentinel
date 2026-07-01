import path from "node:path";
import { readText, safeSlug, timestamp, writeText } from "./files.js";

function matchLine(source: string, label: string): string {
  const match = source.match(new RegExp(`^- ${label}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() ?? "unknown";
}

function extractFindings(report: string): string[] {
  const matches = report.match(/^### UX-\d{3}: .+(?:\n- .+)*/gm);
  return matches ?? [];
}

export function buildCodexBriefMarkdown(report: string, sourceReport: string): string {
  const scenario = matchLine(report, "id");
  const url = matchLine(report, "url");
  const result = matchLine(report, "result");
  const findings = extractFindings(report);

  return `# Codex Patch Brief

## Source
- report: ${sourceReport}
- scenario: ${scenario}
- url: ${url}
- result: ${result}

## Goal

Fix the visible UI perception mismatch without changing the product scope.

## Findings To Address

${findings.length ? findings.join("\n\n") : "No findings were parsed from the source report."}

## Acceptance Criteria

- The same ux-sentinel scenario passes after the UI patch.
- The primary next action is visible to a human, not only present in the DOM or accessibility tree.
- Evidence artifacts still include screenshot, screen-map.json, screen-map.html, console errors, and network errors.

## Forbidden Fixes

- Do not suppress or delete checks to make the report pass.
- Do not rely on aria-label alone for a primary CTA.
- Do not add SaaS, auth, database, hosted runner, Chrome extension, or required LLM API behavior.

## Suggested Regression Check

Run:

\`\`\`bash
ux-sentinel run <scenario.yaml> --url <patched-url>
\`\`\`
`;
}

export async function createCodexBrief(reportPath: string, outputDir = path.join(process.cwd(), ".ux-sentinel", "briefs")): Promise<string> {
  const report = await readText(reportPath);
  const slug = safeSlug(path.basename(reportPath, path.extname(reportPath)));
  const outputPath = path.resolve(outputDir, `${slug}-${timestamp()}.codex-brief.md`);
  await writeText(outputPath, buildCodexBriefMarkdown(report, reportPath));
  return outputPath;
}
