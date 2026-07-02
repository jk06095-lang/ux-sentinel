import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const port = process.env.PORT ?? "4173";
const server = spawn(process.execPath, ["demo/server.mjs"], {
  env: { ...process.env, PORT: port },
  stdio: ["ignore", "pipe", "pipe"]
});

let settled = false;

function stopServer() {
  if (!server.killed) {
    server.kill("SIGTERM");
  }
}

function waitForServer() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("demo server did not start in time")), 10_000);
    server.stdout.on("data", (chunk) => {
      const text = String(chunk);
      process.stdout.write(text);
      if (text.includes("listening")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.stderr.on("data", (chunk) => process.stderr.write(String(chunk)));
    server.on("exit", (code) => {
      if (!settled) {
        clearTimeout(timer);
        reject(new Error(`demo server exited early with code ${code}`));
      }
    });
  });
}

function assertReportContainsDetectors(reportPath, detectors) {
  if (!detectors.length) {
    return;
  }

  const report = readFileSync(reportPath, "utf8");
  for (const detector of detectors) {
    const section = report
      .split(/^### UX-/m)
      .find((candidate) => candidate.includes(`Detector: ${detector}`));

    if (!section) {
      throw new Error(`${reportPath} did not include detector ${detector}`);
    }

    const evidence = section.match(/^- Evidence: (.+)$/m)?.[1]?.trim();
    if (!evidence) {
      throw new Error(`${reportPath} included detector ${detector} without concrete evidence`);
    }
  }
}

function mustExist(filePath, label) {
  if (!filePath) {
    throw new Error(`${label} path was not recorded`);
  }
  if (!existsSync(filePath)) {
    throw new Error(`${label} does not exist: ${filePath}`);
  }
  return filePath;
}

function readJson(filePath, label) {
  const resolved = mustExist(filePath, label);
  return JSON.parse(readFileSync(resolved, "utf8"));
}

function artifactPath(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} was not recorded`);
  }
  return mustExist(value, label);
}

function outputPath(stdout, label) {
  return stdout.match(new RegExp(`^${label}: (.+)$`, "m"))?.[1]?.trim();
}

function assertInteractiveArtifacts({ reportPath, tracePath, contactSheetPath }) {
  mustExist(tracePath, "interactive trace directory");
  mustExist(contactSheetPath, "interactive contact sheet");
  if (path.basename(contactSheetPath) !== "contact-sheet.html") {
    throw new Error(`interactive contact sheet path should end with contact-sheet.html: ${contactSheetPath}`);
  }

  const actionTracePath = path.join(tracePath, "action-trace.json");
  const stateGraphPath = path.join(tracePath, "state-graph.json");
  const anomaliesPath = path.join(tracePath, "anomalies.json");
  const actionTrace = readJson(actionTracePath, "interactive action trace");
  const stateGraph = readJson(stateGraphPath, "interactive state graph");
  readJson(anomaliesPath, "interactive anomalies");

  if (!actionTrace.capabilityPolicy?.capabilities) {
    throw new Error(`${actionTracePath} is missing capability policy evidence`);
  }
  if (actionTrace.capabilityPolicy.capabilities.typing !== false || actionTrace.capabilityPolicy.capabilities.form_submit !== false) {
    throw new Error(`${actionTracePath} weakened form safety capabilities`);
  }
  if (!Array.isArray(actionTrace.clickCandidates) || actionTrace.clickCandidates.length === 0) {
    throw new Error(`${actionTracePath} did not record click candidate decisions`);
  }
  for (const candidate of actionTrace.clickCandidates) {
    if (!candidate.clickDecision || !candidate.clickDecisionReason) {
      throw new Error(`${actionTracePath} contains a click candidate without an allow/skip decision`);
    }
  }
  if (!Array.isArray(actionTrace.actions) || actionTrace.actions.length === 0) {
    throw new Error(`${actionTracePath} did not record interactive actions`);
  }

  for (const [index, action] of actionTrace.actions.entries()) {
    const actionLabel = `interactive action ${action.id ?? index + 1}`;
    if (!action.plannedReason || !action.targetCategory || !action.riskLevel) {
      throw new Error(`${actionLabel} is missing planner metadata`);
    }
    if (!action.clickDecision || !action.clickDecisionReason) {
      throw new Error(`${actionLabel} is missing safe-click decision evidence`);
    }
    artifactPath(action.beforeScreenshot, `${actionLabel} before screenshot`);
    artifactPath(action.afterScreenshot, `${actionLabel} after screenshot`);
    artifactPath(action.visualDiff, `${actionLabel} visual diff`);
    artifactPath(action.screenMap, `${actionLabel} screen map`);
    artifactPath(action.pointerTrace, `${actionLabel} pointer trace`);
    artifactPath(action.domDiff, `${actionLabel} DOM diff`);
    artifactPath(action.accessibilityDiff, `${actionLabel} accessibility diff`);
  }

  if (!Array.isArray(stateGraph.nodes) || stateGraph.nodes.length === 0) {
    throw new Error(`${stateGraphPath} did not record state nodes`);
  }
  if (!Array.isArray(stateGraph.edges) || stateGraph.edges.length === 0) {
    throw new Error(`${stateGraphPath} did not record action edges`);
  }
  for (const [index, edge] of stateGraph.edges.entries()) {
    const edgeLabel = `state graph edge ${edge.id ?? index + 1}`;
    for (const key of ["beforeStateId", "afterStateId", "beforeScreenshot", "afterScreenshot", "visualDiff", "domDiff", "accessibilityDiff", "pointerTrace"]) {
      if (!edge[key]) {
        throw new Error(`${edgeLabel} is missing ${key}`);
      }
    }
    artifactPath(edge.beforeScreenshot, `${edgeLabel} before screenshot`);
    artifactPath(edge.afterScreenshot, `${edgeLabel} after screenshot`);
    artifactPath(edge.visualDiff, `${edgeLabel} visual diff`);
    artifactPath(edge.domDiff, `${edgeLabel} DOM diff`);
    artifactPath(edge.accessibilityDiff, `${edgeLabel} accessibility diff`);
    artifactPath(edge.pointerTrace, `${edgeLabel} pointer trace`);
  }

  const report = readFileSync(reportPath, "utf8");
  for (const needle of ["## Interactive Exploration", "state graph:", "contact sheet:"]) {
    if (!report.includes(needle)) {
      throw new Error(`${reportPath} is missing interactive report section text: ${needle}`);
    }
  }

  const contactSheet = readFileSync(contactSheetPath, "utf8");
  for (const needle of ["Safety Log", "State Graph", "Pointer trace", "Safe click decision", "Accessibility"]) {
    if (!contactSheet.includes(needle)) {
      throw new Error(`${contactSheetPath} is missing review surface text: ${needle}`);
    }
  }
}

function runScenario(scenarioPath, path, expectedStatus, options = {}) {
  const result = spawnSync(process.execPath, [
    "dist/cli.js",
    "run",
    scenarioPath,
    "--url",
    `http://127.0.0.1:${port}${path}`,
    ...(options.args ?? [])
  ], {
    encoding: "utf8"
  });

  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);

  if (result.status !== expectedStatus) {
    throw new Error(`${path} expected exit ${expectedStatus}, got ${result.status}`);
  }

  const verdict = result.stdout.match(/^Verdict: (.+)$/m)?.[1]?.trim();
  if (options.expectedVerdict && verdict !== options.expectedVerdict) {
    throw new Error(`${path} expected verdict ${options.expectedVerdict}, got ${verdict ?? "unknown"}`);
  }

  const reportPath = outputPath(result.stdout, "Report");
  if (!reportPath) {
    throw new Error(`${path} did not print a report path`);
  }
  assertReportContainsDetectors(reportPath, options.expectedDetectors ?? []);
  if (options.expectedInteractiveArtifacts) {
    assertInteractiveArtifacts({
      reportPath,
      tracePath: outputPath(result.stdout, "Trace"),
      contactSheetPath: outputPath(result.stdout, "Contact sheet")
    });
  }
}

try {
  await waitForServer();
  runScenario("demo/scenarios/onboarding-empty-state.yaml", "/broken", 1, { expectedVerdict: "fail" });
  runScenario("demo/scenarios/onboarding-empty-state.yaml", "/fixed", 0, { expectedVerdict: "pass" });
  runScenario("demo/scenarios/high-priority-detectors.yaml", "/high-priority-broken", 1, {
    expectedVerdict: "fail",
    expectedDetectors: [
      "click_target_too_small",
      "visible_label_not_in_accessible_name",
      "looks_clickable_but_not_actionable",
      "destructive_action_without_confirmation"
    ]
  });
  runScenario("demo/scenarios/high-priority-detectors.yaml", "/high-priority-fixed", 0, { expectedVerdict: "pass" });
  runScenario("demo/scenarios/interactive-dag-clarity.yaml", "/fixed", 0, {
    expectedVerdict: "pass",
    args: ["--interactive", "--max-actions", "10", "--settle-ms", "100"],
    expectedInteractiveArtifacts: true
  });
  settled = true;
  stopServer();
  console.log("demo verification passed");
} catch (error) {
  settled = true;
  stopServer();
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
