import path from "node:path";
import YAML from "yaml";
import { readText, safeSlug, timestamp, writeText } from "./files.js";

export interface DistilledFeedback {
  source: string;
  raw_quote: string;
  affected_journey: string;
  pain_points: string[];
  likely_ux_principle: string;
  suggested_scenario_check: string;
  confidence: "low" | "medium" | "high";
}

function linesWithSignals(source: string): string[] {
  return source
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*>#\s]+/, "").trim())
    .filter(Boolean);
}

export function distillFeedback(source: string, sourcePath: string): DistilledFeedback {
  const lines = linesWithSignals(source);
  const rawQuote = lines[0] ?? source.trim().slice(0, 240);
  const joined = lines.join(" ").toLowerCase();
  const painPoints: string[] = [];

  if (/click|cta|button|\+|action|버튼|클릭|행동/.test(joined)) {
    painPoints.push("The primary next action is not visually obvious.");
  }
  if (/empty|nothing|no project|아직|없|비어/.test(joined)) {
    painPoints.push("The empty state does not provide enough guidance.");
  }
  if (/confus|unclear|lost|모르|헷갈/.test(joined)) {
    painPoints.push("The screen does not communicate state or consequence clearly.");
  }

  if (painPoints.length === 0) {
    painPoints.push("The feedback describes a possible human-perception gap that should become a scenario.");
  }

  const affectedJourney = /dashboard|project|프로젝트/.test(joined)
    ? "dashboard-empty-state"
    : "unknown";

  return {
    source: sourcePath,
    raw_quote: rawQuote,
    affected_journey: affectedJourney,
    pain_points: painPoints,
    likely_ux_principle: "Primary actions must be visible, legible, and aligned with the user's current goal.",
    suggested_scenario_check:
      "Add or update a visual_contract scenario that requires a visible primary CTA and empty-state next-step copy.",
    confidence: painPoints.length >= 2 ? "medium" : "low"
  };
}

export async function ingestFeedback(feedbackPath: string, outputRoot = path.join(process.cwd(), ".ux-sentinel", "feedback", "distilled")): Promise<string> {
  const source = await readText(feedbackPath);
  const distilled = distillFeedback(source, feedbackPath);
  const outputPath = path.resolve(outputRoot, `${safeSlug(path.basename(feedbackPath, path.extname(feedbackPath)))}-${timestamp()}.yaml`);
  await writeText(outputPath, YAML.stringify(distilled));
  return outputPath;
}
