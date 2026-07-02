import { spawn, spawnSync } from "node:child_process";

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

function runScenario(scenarioPath, path, expectedStatus) {
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
}

try {
  await waitForServer();
  runScenario("demo/scenarios/onboarding-empty-state.yaml", "/broken", 1);
  runScenario("demo/scenarios/onboarding-empty-state.yaml", "/fixed", 0);
  runScenario("demo/scenarios/high-priority-detectors.yaml", "/high-priority-broken", 1);
  runScenario("demo/scenarios/high-priority-detectors.yaml", "/high-priority-fixed", 0);
  settled = true;
  stopServer();
  console.log("demo verification passed");
} catch (error) {
  settled = true;
  stopServer();
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
