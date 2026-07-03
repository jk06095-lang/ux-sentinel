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

function assertInteractiveArtifacts({
  reportPath,
  tracePath,
  contactSheetPath,
  expectedSkippedAction = false,
  expectedPlannerMode,
  expectedMinActions,
  expectedMaxActions,
  expectedMinClickedActions,
  expectedTargetCategories = [],
  expectedDomDiffTextAdded = [],
  expectedActionFindingDetectors = [],
  expectedAnimationTrace = false,
  expectedNavigationStop = false,
  expectedNavigationAllowed = false,
  expectedPointerDrift = false
}) {
  mustExist(tracePath, "interactive trace directory");
  mustExist(contactSheetPath, "interactive contact sheet");
  if (path.basename(contactSheetPath) !== "contact-sheet.html") {
    throw new Error(`interactive contact sheet path should end with contact-sheet.html: ${contactSheetPath}`);
  }

  const actionTracePath = path.join(tracePath, "action-trace.json");
  const stateGraphPath = path.join(tracePath, "state-graph.json");
  const anomaliesPath = path.join(tracePath, "anomalies.json");
  const traceManifestPath = path.join(tracePath, "trace-manifest.json");
  const actionTrace = readJson(actionTracePath, "interactive action trace");
  const stateGraph = readJson(stateGraphPath, "interactive state graph");
  const anomalies = readJson(anomaliesPath, "interactive anomalies");
  const traceManifest = readJson(traceManifestPath, "interactive trace manifest");

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
  if (traceManifest.version !== 1) {
    throw new Error(`${traceManifestPath} did not record trace manifest version 1`);
  }
  if (traceManifest.artifacts?.actionTrace !== "action-trace.json") {
    throw new Error(`${traceManifestPath} did not link action-trace.json`);
  }
  if (traceManifest.artifacts?.stateGraph !== "state-graph.json") {
    throw new Error(`${traceManifestPath} did not link state-graph.json`);
  }
  if (traceManifest.artifacts?.contactSheet !== "contact-sheet.html") {
    throw new Error(`${traceManifestPath} did not link contact-sheet.html`);
  }
  if (traceManifest.artifacts?.traceManifest !== "trace-manifest.json") {
    throw new Error(`${traceManifestPath} did not self-link trace-manifest.json`);
  }
  if (traceManifest.counts?.actions !== actionTrace.actions.length) {
    throw new Error(`${traceManifestPath} action count does not match action trace`);
  }
  if (traceManifest.counts?.states !== stateGraph.nodes.length || traceManifest.counts?.edges !== stateGraph.edges.length) {
    throw new Error(`${traceManifestPath} state graph counts do not match state-graph.json`);
  }
  if (traceManifest.counts?.findings !== anomalies.length) {
    throw new Error(`${traceManifestPath} finding count does not match anomalies.json`);
  }
  if (expectedPlannerMode && actionTrace.planner?.mode !== expectedPlannerMode) {
    throw new Error(`${actionTracePath} expected planner mode ${expectedPlannerMode}, got ${actionTrace.planner?.mode ?? "unknown"}`);
  }
  if (expectedMinActions !== undefined && actionTrace.actions.length < expectedMinActions) {
    throw new Error(`${actionTracePath} expected at least ${expectedMinActions} actions, got ${actionTrace.actions.length}`);
  }
  if (expectedMaxActions !== undefined && actionTrace.actions.length > expectedMaxActions) {
    throw new Error(`${actionTracePath} expected at most ${expectedMaxActions} actions, got ${actionTrace.actions.length}`);
  }
  if (expectedNavigationStop && actionTrace.capabilityPolicy.capabilities.navigation !== false) {
    throw new Error(`${actionTracePath} should keep navigation disabled for the navigation-stop scenario`);
  }
  if (expectedNavigationAllowed && actionTrace.capabilityPolicy.capabilities.navigation !== true) {
    throw new Error(`${actionTracePath} should enable navigation for the navigation-allow scenario`);
  }

  const actionsById = new Map(actionTrace.actions.map((action) => [action.id, action]));
  const targetCategories = new Set(actionTrace.actions.map((action) => action.targetCategory));
  for (const category of expectedTargetCategories) {
    if (!targetCategories.has(category)) {
      throw new Error(`${actionTracePath} did not include expected target category ${category}`);
    }
  }
  let skippedActionCount = 0;
  let clickedActionCount = 0;
  const domDiffTextAdded = [];
  const actionFindingDetectors = new Set();
  const animationTracePaths = [];
  const pointerTraceRecords = [];
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
    artifactPath(action.domDiff, `${actionLabel} DOM diff`);
    artifactPath(action.accessibilityDiff, `${actionLabel} accessibility diff`);
    if (action.skipped) {
      skippedActionCount += 1;
      if (action.clickDecision !== "skipped" || !action.skipReason) {
        throw new Error(`${actionLabel} is marked skipped without a skipped click decision and reason`);
      }
    } else {
      artifactPath(action.pointerTrace, `${actionLabel} pointer trace`);
      pointerTraceRecords.push(readJson(action.pointerTrace, `${actionLabel} pointer trace`));
    }
    if (action.clicked) {
      clickedActionCount += 1;
    }
    if (Array.isArray(action.findingDetectors)) {
      for (const detector of action.findingDetectors) {
        actionFindingDetectors.add(detector);
      }
      if (action.findingDetectors.length > 0) {
        if (!Array.isArray(action.findings) || action.findings.length === 0) {
          throw new Error(`${actionLabel} recorded finding detectors without action-level finding summaries`);
        }
        for (const detector of action.findingDetectors) {
          const summary = action.findings.find((finding) => finding.detector === detector);
          if (!summary?.evidence || !summary?.userImpact || !summary?.suggestedFix || !summary?.regressionCheck) {
            throw new Error(`${actionLabel} finding summary for ${detector} is missing actionable evidence fields`);
          }
          if (!Array.isArray(summary.ruleIds) || summary.ruleIds.length === 0 || !summary.confidence) {
            throw new Error(`${actionLabel} finding summary for ${detector} is missing rule/confidence metadata`);
          }
          if (!summary.evidencePaths?.beforeScreenshot || !summary.evidencePaths?.afterScreenshot || !summary.evidencePaths?.screenMap) {
            throw new Error(`${actionLabel} finding summary for ${detector} is missing action evidence paths`);
          }
        }
      }
    }
    if (action.animationTrace) {
      animationTracePaths.push(action.animationTrace);
      const trace = readJson(action.animationTrace, `${actionLabel} animation trace`);
      if (trace.enabled !== true || !Array.isArray(trace.normal) || trace.normal.length === 0) {
        throw new Error(`${action.animationTrace} did not record enabled normal-motion evidence`);
      }
      if (
        trace.normalMotionEnvironment?.mediaEmulation !== "no-preference" ||
        trace.normalMotionEnvironment?.prefersReducedMotionMatches !== false
      ) {
        throw new Error(`${action.animationTrace} did not record expected normal-motion environment evidence`);
      }
      if (trace.actionId !== action.id) {
        throw new Error(`${action.animationTrace} action id ${trace.actionId ?? "unknown"} did not match ${action.id}`);
      }
      if (!Array.isArray(trace.longTasks)) {
        throw new Error(`${action.animationTrace} did not record long task marker evidence array`);
      }
      if (!action.animationTraceSummary || action.animationTraceSummary.targetCount !== trace.normal.length) {
        throw new Error(`${actionLabel} did not record animation summary target count`);
      }
      if (action.animationTraceSummary.longTaskCount !== trace.longTasks.length) {
        throw new Error(`${actionLabel} animation summary long task count did not match trace`);
      }
      if (expectedAnimationTrace) {
        if (trace.compareReducedMotion !== true) {
          throw new Error(`${action.animationTrace} did not record expected reduced-motion comparison evidence`);
        }
        if (!Array.isArray(trace.reducedMotion)) {
          throw new Error(`${action.animationTrace} did not record reduced-motion target evidence`);
        }
        if (
          trace.reducedMotionEnvironment?.mediaEmulation !== "reduce" ||
          trace.reducedMotionEnvironment?.prefersReducedMotionMatches !== true
        ) {
          throw new Error(`${action.animationTrace} did not record expected reduced-motion environment evidence`);
        }
        if (trace.longTaskApiAvailable === true && !trace.longTasks.some((task) => Number(task.durationMs) >= 50)) {
          throw new Error(`${action.animationTrace} did not record expected long task marker evidence`);
        }
      }
    }
    const domDiff = readJson(action.domDiff, `${actionLabel} DOM diff`);
    domDiffTextAdded.push(...(Array.isArray(domDiff.visibleTextAdded) ? domDiff.visibleTextAdded : []));
  }
  if (expectedMinClickedActions !== undefined && clickedActionCount < expectedMinClickedActions) {
    throw new Error(`${actionTracePath} expected at least ${expectedMinClickedActions} clicked actions, got ${clickedActionCount}`);
  }
  if (expectedSkippedAction && skippedActionCount === 0) {
    throw new Error(`${actionTracePath} did not record the expected skipped action`);
  }
  for (const expectedText of expectedDomDiffTextAdded) {
    if (!domDiffTextAdded.some((text) => String(text).includes(expectedText))) {
      throw new Error(`${actionTracePath} DOM diffs did not record expected visible text: ${expectedText}`);
    }
  }
  for (const detector of expectedActionFindingDetectors) {
    if (!actionFindingDetectors.has(detector)) {
      throw new Error(`${actionTracePath} did not attach expected finding detector to an action: ${detector}`);
    }
  }
  if (expectedAnimationTrace && animationTracePaths.length === 0) {
    throw new Error(`${actionTracePath} did not record an expected animation trace`);
  }
  if (expectedPointerDrift) {
    if (
      !pointerTraceRecords.some(
        (trace) => trace.overlayAppearedDuringApproach === true && trace.finalHitTestMatchedTarget === false
      )
    ) {
      throw new Error(`${actionTracePath} did not record expected hover overlay pointer drift evidence`);
    }
    if (!actionTrace.actions.some((action) => action.clickDecision === "skipped" && action.clickDecisionReason === "cursor target drift")) {
      throw new Error(`${actionTracePath} did not skip the hover-blocked click with cursor target drift`);
    }
  }
  if (expectedNavigationStop) {
    const noteText = (actionTrace.summary?.notes ?? []).join(" ");
    if (!noteText.includes("Navigation changed URL") || !noteText.includes("stopped remaining planned actions")) {
      throw new Error(`${actionTracePath} did not record the expected navigation stop note`);
    }
    if (!actionTrace.actions.some((action) => action.urlBefore && action.urlAfter && action.urlBefore !== action.urlAfter)) {
      throw new Error(`${actionTracePath} did not record an action URL change`);
    }
  }
  if (expectedNavigationAllowed) {
    const noteText = (actionTrace.summary?.notes ?? []).join(" ");
    if (noteText.includes("stopped remaining planned actions")) {
      throw new Error(`${actionTracePath} recorded a navigation stop note even though navigation was allowed`);
    }
    if (!actionTrace.actions.some((action) => action.urlBefore && action.urlAfter && action.urlBefore !== action.urlAfter)) {
      throw new Error(`${actionTracePath} did not record an allowed action URL change`);
    }
  }

  if (!Array.isArray(stateGraph.nodes) || stateGraph.nodes.length === 0) {
    throw new Error(`${stateGraphPath} did not record state nodes`);
  }
  if (!Array.isArray(stateGraph.edges) || stateGraph.edges.length === 0) {
    throw new Error(`${stateGraphPath} did not record action edges`);
  }
  if (expectedMinActions !== undefined && stateGraph.edges.length < expectedMinActions) {
    throw new Error(`${stateGraphPath} expected at least ${expectedMinActions} edges, got ${stateGraph.edges.length}`);
  }
  if (expectedMaxActions !== undefined && stateGraph.edges.length > expectedMaxActions) {
    throw new Error(`${stateGraphPath} expected at most ${expectedMaxActions} edges, got ${stateGraph.edges.length}`);
  }
  let stateGraphAnimationTraceCount = 0;
  for (const [index, edge] of stateGraph.edges.entries()) {
    const edgeLabel = `state graph edge ${edge.id ?? index + 1}`;
    const action = actionsById.get(edge.actionId);
    for (const key of ["beforeStateId", "afterStateId", "beforeScreenshot", "afterScreenshot", "visualDiff", "domDiff", "accessibilityDiff"]) {
      if (!edge[key]) {
        throw new Error(`${edgeLabel} is missing ${key}`);
      }
    }
    for (const key of ["targetId", "targetCategory", "plannedReason", "riskLevel"]) {
      if (!edge[key]) {
        throw new Error(`${edgeLabel} is missing planner reconstruction metadata: ${key}`);
      }
    }
    if (typeof edge.planDepth !== "number" || typeof edge.planPriority !== "number") {
      throw new Error(`${edgeLabel} is missing numeric planner depth or priority metadata`);
    }
    if (!action) {
      throw new Error(`${edgeLabel} actionId ${edge.actionId ?? "unknown"} was not found in action-trace.json`);
    }
    if (edge.targetId !== action.target?.id) {
      throw new Error(`${edgeLabel} targetId did not match action trace target id`);
    }
    for (const key of ["targetCategory", "plannedReason", "riskLevel", "planDepth", "planPriority"]) {
      if (edge[key] !== action[key]) {
        throw new Error(`${edgeLabel} ${key} did not match action trace metadata`);
      }
    }
    artifactPath(edge.beforeScreenshot, `${edgeLabel} before screenshot`);
    artifactPath(edge.afterScreenshot, `${edgeLabel} after screenshot`);
    artifactPath(edge.visualDiff, `${edgeLabel} visual diff`);
    artifactPath(edge.domDiff, `${edgeLabel} DOM diff`);
    artifactPath(edge.accessibilityDiff, `${edgeLabel} accessibility diff`);
    if (!action?.skipped) {
      artifactPath(edge.pointerTrace, `${edgeLabel} pointer trace`);
    }
    if (edge.animationTrace) {
      stateGraphAnimationTraceCount += 1;
      artifactPath(edge.animationTrace, `${edgeLabel} animation trace`);
    }
  }
  if (expectedAnimationTrace && stateGraphAnimationTraceCount === 0) {
    throw new Error(`${stateGraphPath} did not link the expected animation trace`);
  }

  const report = readFileSync(reportPath, "utf8");
  for (const needle of ["## Interactive Exploration", "state graph:", "contact sheet:"]) {
    if (!report.includes(needle)) {
      throw new Error(`${reportPath} is missing interactive report section text: ${needle}`);
    }
  }
  if (expectedNavigationStop) {
    for (const needle of ["Navigation changed URL", "stopped remaining planned actions"]) {
      if (!report.includes(needle)) {
        throw new Error(`${reportPath} is missing navigation stop note text: ${needle}`);
      }
    }
  }
  if (expectedNavigationAllowed && report.includes("stopped remaining planned actions")) {
    throw new Error(`${reportPath} should not include a navigation stop note when navigation is allowed`);
  }

  const contactSheet = readFileSync(contactSheetPath, "utf8");
  for (const needle of [
    "Reviewer Answer Matrix",
    "What did the agent do?",
    "What did it click or avoid?",
    "What changed visually?",
    "What evidence supports it?",
    "Which UX rule or principle?",
    "Safety Log",
    "State Graph",
    "Pointer trace",
    "Safe click decision",
    "Accessibility"
  ]) {
    if (!contactSheet.includes(needle)) {
      throw new Error(`${contactSheetPath} is missing review surface text: ${needle}`);
    }
  }
  if (expectedSkippedAction) {
    for (const needle of ["skipped:", "no longer exists", "actions/a002-before.png", "actions/a002-diff.png"]) {
      if (!contactSheet.includes(needle)) {
        throw new Error(`${contactSheetPath} is missing skipped-action evidence text: ${needle}`);
      }
    }
  }
  if (expectedAnimationTrace) {
    for (const needle of ["Animation Audit", "Animation trace:", "a001-animation-trace.json"]) {
      if (!contactSheet.includes(needle)) {
        throw new Error(`${contactSheetPath} is missing animation evidence text: ${needle}`);
      }
    }
  }
  if (expectedNavigationStop) {
    for (const needle of ["Navigation changed URL", "stopped remaining planned actions", "Clicked: safe_click capability enabled"]) {
      if (!contactSheet.includes(needle)) {
        throw new Error(`${contactSheetPath} is missing navigation stop evidence text: ${needle}`);
      }
    }
  }
  if (expectedNavigationAllowed) {
    for (const needle of ["Confirm navigated audit", "Clicked: safe_click capability enabled", "a002 clicked"]) {
      if (!contactSheet.includes(needle)) {
        throw new Error(`${contactSheetPath} is missing navigation allow evidence text: ${needle}`);
      }
    }
    if (contactSheet.includes("stopped remaining planned actions")) {
      throw new Error(`${contactSheetPath} should not include a navigation stop note when navigation is allowed`);
    }
  }
  if (expectedPointerDrift) {
    for (const needle of ["hover_content_blocks_trigger", "cursor_target_drift", "skipped: cursor target drift"]) {
      if (!contactSheet.includes(needle)) {
        throw new Error(`${contactSheetPath} is missing hover-block pointer evidence text: ${needle}`);
      }
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
      contactSheetPath: outputPath(result.stdout, "Contact sheet"),
      expectedSkippedAction: options.expectedSkippedAction === true,
      expectedPlannerMode: options.expectedPlannerMode,
      expectedMinActions: options.expectedMinActions,
      expectedMaxActions: options.expectedMaxActions,
      expectedMinClickedActions: options.expectedMinClickedActions,
      expectedTargetCategories: options.expectedTargetCategories,
      expectedDomDiffTextAdded: options.expectedDomDiffTextAdded,
      expectedActionFindingDetectors: options.expectedActionFindingDetectors,
      expectedAnimationTrace: options.expectedAnimationTrace === true,
      expectedNavigationStop: options.expectedNavigationStop === true,
      expectedNavigationAllowed: options.expectedNavigationAllowed === true,
      expectedPointerDrift: options.expectedPointerDrift === true
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
  runScenario("demo/scenarios/feedback-recovery.yaml", "/feedback-recovery-broken", 1, {
    expectedVerdict: "fail",
    expectedDetectors: [
      "empty_state_without_next_step",
      "dead_end_state_without_recovery",
      "loading_without_progress_or_timeout",
      "status_change_not_announced",
      "dialog_without_accessible_name",
      "dialog_close_unavailable",
      "modal_trap_without_escape"
    ]
  });
  runScenario("demo/scenarios/feedback-recovery.yaml", "/feedback-recovery-fixed", 0, { expectedVerdict: "pass" });
  runScenario("demo/scenarios/interactive-dag-clarity.yaml", "/fixed", 0, {
    expectedVerdict: "pass",
    args: ["--interactive", "--max-actions", "10", "--settle-ms", "100"],
    expectedInteractiveArtifacts: true
  });
  runScenario("demo/scenarios/interactive-agentic-states.yaml", "/interactive-agentic-states", 0, {
    expectedVerdict: "pass",
    args: ["--interactive", "--max-actions", "6", "--settle-ms", "100"],
    expectedInteractiveArtifacts: true,
    expectedPlannerMode: "agentic",
    expectedMinActions: 6,
    expectedMinClickedActions: 6,
    expectedTargetCategories: ["primary_cta", "tab", "menu", "tooltip_help_trigger", "expandable_section", "dialog_trigger"],
    expectedDomDiffTextAdded: [
      "Review started",
      "Timeline panel selected",
      "Actions menu open",
      "Hint visible",
      "Details expanded",
      "Discovered insight open"
    ]
  });
  runScenario("demo/scenarios/interactive-skip.yaml", "/interactive-skip", 0, {
    expectedVerdict: "pass",
    args: ["--interactive", "--max-actions", "2", "--settle-ms", "100"],
    expectedInteractiveArtifacts: true,
    expectedSkippedAction: true
  });
  runScenario("demo/scenarios/interactive-navigation-stop.yaml", "/interactive-navigation-stop", 0, {
    expectedVerdict: "pass",
    args: ["--interactive", "--max-actions", "2", "--settle-ms", "100"],
    expectedInteractiveArtifacts: true,
    expectedMinActions: 1,
    expectedMaxActions: 1,
    expectedMinClickedActions: 1,
    expectedTargetCategories: ["primary_cta"],
    expectedDomDiffTextAdded: ["Projects"],
    expectedNavigationStop: true
  });
  runScenario("demo/scenarios/interactive-navigation-allow.yaml", "/interactive-navigation-allow", 0, {
    expectedVerdict: "pass",
    args: ["--interactive", "--max-actions", "2", "--settle-ms", "100"],
    expectedInteractiveArtifacts: true,
    expectedPlannerMode: "agentic",
    expectedMinActions: 2,
    expectedMaxActions: 2,
    expectedMinClickedActions: 2,
    expectedTargetCategories: ["primary_cta"],
    expectedDomDiffTextAdded: ["Navigation destination ready", "Allowed navigation confirmed"],
    expectedNavigationAllowed: true
  });
  runScenario("demo/scenarios/interactive-hover-block.yaml", "/interactive-hover-block", 1, {
    expectedVerdict: "fail",
    args: ["--interactive", "--max-actions", "1", "--settle-ms", "100"],
    expectedDetectors: [
      "overlay_appeared_during_cursor_approach",
      "hover_trigger_blocks_target",
      "hover_content_blocks_trigger",
      "cursor_target_drift"
    ],
    expectedInteractiveArtifacts: true,
    expectedPlannerMode: "agentic",
    expectedMinActions: 1,
    expectedMaxActions: 1,
    expectedTargetCategories: ["primary_cta"],
    expectedDomDiffTextAdded: ["Hover panel"],
    expectedActionFindingDetectors: [
      "overlay_appeared_during_cursor_approach",
      "hover_trigger_blocks_target",
      "hover_content_blocks_trigger",
      "cursor_target_drift"
    ],
    expectedPointerDrift: true
  });
  runScenario("demo/scenarios/interactive-motion.yaml", "/interactive-motion", 1, {
    expectedVerdict: "fail",
    args: ["--interactive", "--max-actions", "1", "--settle-ms", "100"],
    expectedDetectors: [
      "animation_ignores_reduced_motion",
      "animation_hides_critical_action",
      "animation_duration_blocks_task",
      "animation_uses_layout_paint_properties",
      "animation_jank_detected",
      "inconsistent_motion_tokens"
    ],
    expectedInteractiveArtifacts: true,
    expectedPlannerMode: "agentic",
    expectedMinActions: 1,
    expectedMinClickedActions: 1,
    expectedTargetCategories: ["primary_cta"],
    expectedDomDiffTextAdded: ["Motion review started"],
    expectedActionFindingDetectors: [
      "animation_ignores_reduced_motion",
      "animation_hides_critical_action",
      "animation_duration_blocks_task",
      "animation_uses_layout_paint_properties",
      "animation_jank_detected",
      "inconsistent_motion_tokens"
    ],
    expectedAnimationTrace: true
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
