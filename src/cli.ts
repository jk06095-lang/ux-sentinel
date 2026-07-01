#!/usr/bin/env node
import path from "node:path";
import { createCodexBrief } from "./core/brief.js";
import { runDetectors, verdictForFindings } from "./core/detectors.js";
import { displayPath, writeJson } from "./core/files.js";
import { ingestFeedback } from "./core/feedback.js";
import { initProject } from "./core/init.js";
import { observePage } from "./core/observe-page.js";
import { buildReportMarkdown, writeRunReport } from "./core/report.js";
import { parseScenarioFile, resolveTargetUrl } from "./core/scenario.js";
import type { RunResult } from "./core/types.js";

interface ParsedArgs {
  command?: string;
  positionals: string[];
  options: Map<string, string | true>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const positionals: string[] = [];
  const options = new Map<string, string | true>();

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token.startsWith("--")) {
      const name = token.slice(2);
      const next = rest[index + 1];
      if (next && !next.startsWith("--")) {
        options.set(name, next);
        index += 1;
      } else {
        options.set(name, true);
      }
    } else {
      positionals.push(token);
    }
  }

  return { command, positionals, options };
}

function stringOption(args: ParsedArgs, name: string): string | undefined {
  const value = args.options.get(name);
  return typeof value === "string" ? value : undefined;
}

function requireOption(args: ParsedArgs, name: string): string {
  const value = stringOption(args, name);
  if (!value) {
    throw new Error(`Missing required option: --${name}`);
  }
  return value;
}

function requirePositional(args: ParsedArgs, label: string): string {
  const value = args.positionals[0];
  if (!value) {
    throw new Error(`Missing required argument: ${label}`);
  }
  return value;
}

function help(): string {
  return `ux-sentinel

Commands:
  ux-sentinel init
  ux-sentinel observe --url <url>
  ux-sentinel run <scenario.yaml> --url <url>
  ux-sentinel ingest-feedback <file>
  ux-sentinel codex-brief <report>
`;
}

async function initCommand(): Promise<void> {
  const created = await initProject();
  console.log("ux-sentinel initialized.");
  if (created.length) {
    console.log("Created:");
    for (const filePath of created) {
      console.log(`- ${displayPath(filePath)}`);
    }
  } else {
    console.log("No files needed to be created.");
  }
}

async function observeCommand(args: ParsedArgs): Promise<void> {
  const url = requireOption(args, "url");
  const observation = await observePage({ url, writeObserverReport: true });
  console.log(`Observed ${observation.screenMap.url}`);
  console.log(`Trace: ${displayPath(observation.artifacts.traceDir)}`);
  console.log(`Screenshot: ${displayPath(observation.artifacts.screenshot)}`);
  console.log(`Screen map: ${displayPath(observation.artifacts.screenMap)}`);
  console.log(`HTML overlay: ${displayPath(observation.artifacts.overlay)}`);
  if (observation.artifacts.observerReport) {
    console.log(`Observer report: ${displayPath(observation.artifacts.observerReport)}`);
  }
}

async function runCommand(args: ParsedArgs): Promise<void> {
  const scenarioPath = path.resolve(requirePositional(args, "scenario.yaml"));
  const inputUrl = requireOption(args, "url");
  const scenario = await parseScenarioFile(scenarioPath);
  const targetUrl = resolveTargetUrl(inputUrl, scenario);
  const observation = await observePage({ url: targetUrl, scenario });
  const findings = runDetectors(observation.screenMap, scenario);
  const verdict = verdictForFindings(findings, scenario);

  observation.screenMap.risks = findings.map((finding) => ({
    detector: finding.detector,
    severity: finding.severity,
    message: finding.title
  }));
  await writeJson(observation.artifacts.screenMap, observation.screenMap);

  const partial: Omit<RunResult, "reportPath"> = {
    scenario,
    url: observation.screenMap.url,
    verdict,
    findings,
    observation
  };
  const reportPath = await writeRunReport(partial);

  // Build once here too, so TypeScript keeps report rendering exercised in the command path.
  buildReportMarkdown(partial);

  console.log(`Scenario: ${scenario.id}`);
  console.log(`Verdict: ${verdict}`);
  console.log(`Report: ${displayPath(reportPath)}`);
  console.log(`Trace: ${displayPath(observation.artifacts.traceDir)}`);

  if (verdict === "fail") {
    process.exitCode = 1;
  }
}

async function ingestFeedbackCommand(args: ParsedArgs): Promise<void> {
  const feedbackPath = path.resolve(requirePositional(args, "file"));
  const outputPath = await ingestFeedback(feedbackPath);
  console.log(`Distilled feedback: ${displayPath(outputPath)}`);
}

async function codexBriefCommand(args: ParsedArgs): Promise<void> {
  const reportPath = path.resolve(requirePositional(args, "report"));
  const outputPath = await createCodexBrief(reportPath);
  console.log(`Codex patch brief: ${displayPath(outputPath)}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.command || args.command === "--help" || args.command === "-h") {
    console.log(help());
    return;
  }

  switch (args.command) {
    case "init":
      await initCommand();
      break;
    case "observe":
      await observeCommand(args);
      break;
    case "run":
      await runCommand(args);
      break;
    case "ingest-feedback":
      await ingestFeedbackCommand(args);
      break;
    case "codex-brief":
      await codexBriefCommand(args);
      break;
    default:
      throw new Error(`Unknown command: ${args.command}\n\n${help()}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ux-sentinel error: ${message}`);
  process.exitCode = 1;
});
