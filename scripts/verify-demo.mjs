import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

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

function runScenario(scenarioPath, path, expectedStatus, options = {}) {
  const result = spawnSync(process.execPath, [
    "dist/cli.js",
    "run",
    scenarioPath,
    "--url",
    `http://127.0.0.1:${port}${path}`
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

  const reportPath = result.stdout.match(/^Report: (.+)$/m)?.[1]?.trim();
  if (!reportPath) {
    throw new Error(`${path} did not print a report path`);
  }
  assertReportContainsDetectors(reportPath, options.expectedDetectors ?? []);
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
  settled = true;
  stopServer();
  console.log("demo verification passed");
} catch (error) {
  settled = true;
  stopServer();
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
