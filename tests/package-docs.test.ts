import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readText(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("package metadata for GitHub npm exec", () => {
  const packageJson = JSON.parse(readText("package.json")) as {
    bin?: Record<string, string>;
    scripts?: Record<string, string>;
    files?: string[];
  };

  it("exposes the ux-sentinel binary from dist", () => {
    expect(packageJson.bin?.["ux-sentinel"]).toBe("./dist/cli.js");
  });

  it("builds during GitHub package installs", () => {
    expect(packageJson.scripts?.prepare).toBe("npm run build");
  });

  it("includes generated CLI output and Codex docs in the package", () => {
    expect(packageJson.files).toEqual(expect.arrayContaining(["dist", "docs", "examples", ".agents"]));
  });

  it("keeps the source CLI shebang for executable output", () => {
    expect(readText("src/cli.ts").startsWith("#!/usr/bin/env node")).toBe(true);
  });

  it("rejects click-safe on scenario-driven run commands", () => {
    const cli = readText("src/cli.ts");

    expect(cli).toContain("Passing --click-safe to run is rejected.");
    expect(cli).toContain("--click-safe is only supported by `ux-sentinel explore`");
    expect(cli).toContain("commandMode: \"run\"");
    expect(cli).not.toContain("commandMode: \"run\",\n      clickSafeOverride");
  });

  it("keeps dangerous Korean labels clean and removes old mojibake labels", () => {
    const sources = [
      "src/core/interactive.ts",
      "tests/interactive.test.ts",
      "demo/scenarios/interactive-dag-clarity.yaml",
      "demo/scenarios/professional-agentic-ui-audit.yaml"
    ].map(readText).join("\n");
    const cleanLabels = ["삭제", "제거", "결제", "로그아웃"];
    const oldMojibakeLabels = [
      [0x3f, 0x3f, 0xc823],
      [0x3f, 0xc493, 0xad45],
      [0x5bc3, 0xacd7, 0xc823],
      [0x6fe1, 0xc493, 0xb807, 0x3f, 0xafa9, 0xc350]
    ].map((codePoints) => String.fromCodePoint(...codePoints));

    for (const label of cleanLabels) {
      expect(sources).toContain(label);
    }
    for (const label of oldMojibakeLabels) {
      expect(sources).not.toContain(label);
    }
  });
});

describe("Codex integration docs", () => {
  const requiredFiles = [
    "RELEASE_NOTES.md",
    "docs/CODEX_MAGIC_PROMPT.md",
    "docs/CODEX_INTEGRATION.md",
    "docs/RELEASE_CHECKLIST.md",
    "docs/examples/agentic-audit-report.md",
    "docs/examples/agentic-codex-brief.md",
    ".agents/skills/ux-sentinel/SKILL.md",
    "examples/codex/magic-prompt.md",
    "examples/codex/goal-prompt.md",
    "examples/codex/onboarding-qa.prompt.md",
    "examples/codex/empty-state-qa.prompt.md"
  ];

  it("includes the requested prompt and skill files", () => {
    for (const file of requiredFiles) {
      expect(existsSync(path.join(repoRoot, file)), file).toBe(true);
    }
  });

  it("documents clone fallback cwd safety for target repo artifacts", () => {
    const fallbackDocs = [
      "README.md",
      "docs/CODEX_MAGIC_PROMPT.md",
      "docs/CODEX_INTEGRATION.md",
      "docs/LAUNCH_PLAN.md",
      ".agents/skills/ux-sentinel/SKILL.md",
      "examples/codex/magic-prompt.md",
      "examples/codex/goal-prompt.md",
      "examples/codex/onboarding-qa.prompt.md",
      "examples/codex/empty-state-qa.prompt.md"
    ];
    const requiredNote =
      "Build ux-sentinel in the temporary tool directory, then cd back to the target repo before running node /tmp/ux-sentinel/dist/cli.js. Reports and traces are written relative to the current working directory.";

    for (const file of fallbackDocs) {
      const text = readText(file);
      if (/temporary clone|\/tmp\/ux-sentinel|\.codex-tools\/ux-sentinel/i.test(text)) {
        expect(text, file).toContain(requiredNote);
      }
    }
  });

  it("does not show target repo scenario checks running from the tool repo", () => {
    const docs = [
      "README.md",
      "docs/CODEX_MAGIC_PROMPT.md",
      "docs/CODEX_INTEGRATION.md",
      "docs/LAUNCH_PLAN.md",
      ".agents/skills/ux-sentinel/SKILL.md",
      "examples/codex/magic-prompt.md",
      "examples/codex/goal-prompt.md",
      "examples/codex/onboarding-qa.prompt.md",
      "examples/codex/empty-state-qa.prompt.md"
    ].map(readText).join("\n");

    expect(docs).not.toContain("node /tmp/ux-sentinel/dist/cli.js run <target-repo>");
    expect(docs).not.toContain("<target-repo>/.ux-sentinel");
  });

  it("clone fallback command blocks return to the target repo before running the absolute CLI", () => {
    const commandDocs = [
      "README.md",
      "docs/CODEX_INTEGRATION.md",
      "docs/LAUNCH_PLAN.md",
      ".agents/skills/ux-sentinel/SKILL.md"
    ];

    for (const file of commandDocs) {
      const text = readText(file);
      if (text.includes("cd /tmp/ux-sentinel")) {
        const cloneIndex = text.indexOf("cd /tmp/ux-sentinel");
        const returnIndex = text.indexOf('cd "$TARGET_REPO"', cloneIndex);
        const runIndex = text.indexOf("node /tmp/ux-sentinel/dist/cli.js", cloneIndex);
        expect(returnIndex, `${file} must cd back to target repo`).toBeGreaterThan(cloneIndex);
        expect(runIndex, `${file} must run absolute CLI after returning`).toBeGreaterThan(returnIndex);
      }
    }
  });

  it("documents GitHub npm exec v0.1.0 as the stable external-project fast path", () => {
    const docs = [
      readText("README.md"),
      readText("docs/CODEX_MAGIC_PROMPT.md"),
      readText("docs/CODEX_INTEGRATION.md"),
      readText("examples/codex/magic-prompt.md")
    ].join("\n");

    expect(docs).toContain("npm exec --yes --package=github:jk06095-lang/ux-sentinel#v0.1.0 -- ux-sentinel");
  });

  it("keeps main documented only as a latest-development path", () => {
    const docs = [
      readText("README.md"),
      readText("docs/CODEX_MAGIC_PROMPT.md"),
      readText("docs/CODEX_INTEGRATION.md")
    ].join("\n");

    expect(docs).toContain("Latest development");
    expect(docs).toContain("github:jk06095-lang/ux-sentinel#main");
  });

  it("documents interactive audit as a main-only feature with safe click opt-in", () => {
    const docs = [
      readText("README.md"),
      readText("docs/INTERACTIVE_AUDIT.md"),
      readText("docs/AGENTIC_INTERACTIVE_AUDIT.md"),
      readText("docs/MOTION_AUDIT.md"),
      readText("docs/SAFETY_POLICY.md"),
      readText("docs/prompts/04-interactive-visual-audit.md")
    ].join("\n");

    expect(docs).toContain("not part of the GitHub `v0.1.0` stable path");
    expect(docs).toContain("clicking requires `--click-safe`");
    expect(docs).toContain("passing `--click-safe` to `run --interactive` is rejected");
    expect(docs).toContain("click_all_safe_controls: true");
    expect(docs).toContain("data-ux-role");
    expect(docs).toContain("data-ux-clickable");
    expect(docs).toContain("Account deletion");
    expect(docs).toContain("Irreversible");
    expect(docs).toContain("contact-sheet.html");
    expect(docs).toContain("reviewer answer matrix");
    expect(docs).toContain("what it clicked or avoided");
    expect(docs).toContain("state-graph.json");
    expect(docs).toContain("a001-diff.png");
    expect(docs).toContain("severity, detector, and rule-family filters");
    expect(docs).toContain("safety log");
    expect(docs).toContain("bbox heuristics");
    expect(docs).toContain("Capability Model");
    expect(docs).toContain("plannedReason");
    expect(docs).toContain("targetCategory");
    expect(docs).toContain("a001-pointer-trace.json");
    expect(docs).toContain("a001-animation-trace.json");
    expect(docs).toContain("cursor target drift");
    expect(docs).toContain("animation_ignores_reduced_motion");
    expect(docs).toContain("animation_hides_critical_action");
    expect(docs).toContain("animation_jank_detected");
    expect(docs).toContain("inconsistent_motion_tokens");
    expect(docs).toContain("UX_RULE_REGISTRY.md");
    expect(docs).toContain("MOTION_AUDIT.md");
    expect(docs).toContain("ux_rule_profile");
    expect(docs).toContain("require_rule_mapping");
    expect(readText("demo/scenarios/professional-agentic-ui-audit.yaml")).toContain("animation_audit:");
    expect(readText("demo/scenarios/professional-agentic-ui-audit.yaml")).toContain("ux_rule_profile:");
    expect(readText("demo/scenarios/professional-agentic-ui-audit.yaml")).toContain("graph_dag_readability");
    expect(readText("demo/scenarios/professional-agentic-ui-audit.yaml")).toContain("Account deletion");
    expect(readText("demo/scenarios/professional-agentic-ui-audit.yaml")).toContain("Irreversible");
    expect(docs).toContain("Why this matters");
    expect(docs).toContain("focus_ring_missing");
    expect(docs).toContain("focus_order_unexpected_jump");
    expect(docs).toContain("focus_caused_context_change");
    expect(docs).toContain("click_target_too_small");
    expect(docs).toContain("no_feedback_after_action");
    expect(docs).toContain("safe_click_changed_unrelated_state");
    expect(docs).toContain("important_text_below_fold_without_cue");
    expect(docs).toContain("primary_cta_low_visual_weight");
    expect(docs).toContain("multiple_primary_ctas_conflict");
    expect(docs).toContain("secondary_action_overpowers_primary");
    expect(docs).toContain("responsive_layout_breakpoint_overlap");
    expect(docs).toContain("text_truncated");
    expect(docs).toContain("same_label_different_actions");
    expect(docs).toContain("same_action_different_labels");
    expect(docs).toContain("icon_button_without_visible_label");
    expect(docs).toContain("status_change_not_announced");
    expect(docs).toContain("dialog_without_accessible_name");
    expect(docs).toContain("loading_without_progress_or_timeout");
    expect(docs).toContain("dead_end_state_without_recovery");
    expect(docs).toContain("empty_state_without_next_step");
    expect(docs).toContain("dialog_close_unavailable");
    expect(docs).toContain("modal_trap_without_escape");
    expect(docs).toContain("popover_blocks_primary_action");
    expect(docs).toContain("tooltip_blocks_trigger");
    expect(docs).toContain("hover_content_blocks_trigger");
    expect(docs).toContain("sticky_layer_hides_content");
    expect(docs).toContain("selected_path_not_traceable");
    expect(docs).toContain("edge_crosses_critical_label");
    expect(docs).toContain("graph_control_not_discoverable");
    expect(docs).toContain("node_label_truncated");
    expect(readText("demo/scenarios/professional-agentic-ui-audit.yaml")).toContain("dialog_without_accessible_name");
    expect(readText("demo/scenarios/professional-agentic-ui-audit.yaml")).toContain("modal_trap_without_escape");
    expect(readText("demo/scenarios/professional-agentic-ui-audit.yaml")).toContain("selected_path_not_traceable");
    expect(readText("docs/examples/agentic-audit-report.md")).toContain("trace-manifest.json");
    expect(readText("docs/examples/agentic-audit-report.md")).toContain("contact-sheet.html");
    expect(readText("docs/examples/agentic-codex-brief.md")).toContain("trace-manifest.json");
    expect(readText("docs/examples/agentic-codex-brief.md")).toContain("Forbidden Fixes");
  });

  it("documents intentional fail_conditions empty-array behavior", () => {
    const docs = [readText("README.md"), readText("docs/MVP_SPEC.md")].join("\n");

    expect(docs).toContain("If `fail_conditions` is absent");
    expect(docs).toContain("A non-empty array is explicit");
    expect(docs).toContain("An empty array (`fail_conditions: []`) means no explicit detector list");
  });

  it("ships the high-priority detector demo pair and verifies it in demo:verify", () => {
    expect(existsSync(path.join(repoRoot, "demo/high-priority-broken.html"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "demo/high-priority-fixed.html"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "demo/feedback-recovery-broken.html"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "demo/feedback-recovery-fixed.html"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "demo/scenarios/feedback-recovery.yaml"))).toBe(true);

    const scenario = readText("demo/scenarios/high-priority-detectors.yaml");
    expect(scenario).toContain("click_target_too_small");
    expect(scenario).toContain("visible_label_not_in_accessible_name");
    expect(scenario).toContain("looks_clickable_but_not_actionable");
    expect(scenario).toContain("destructive_action_without_confirmation");

    const feedbackScenario = readText("demo/scenarios/feedback-recovery.yaml");
    expect(feedbackScenario).toContain("empty_state_without_next_step");
    expect(feedbackScenario).toContain("loading_without_progress_or_timeout");
    expect(feedbackScenario).toContain("dialog_without_accessible_name");
    expect(feedbackScenario).toContain("modal_trap_without_escape");

    const verifier = readText("scripts/verify-demo.mjs");
    expect(verifier).toContain("/high-priority-broken");
    expect(verifier).toContain("/high-priority-fixed");
    expect(verifier).toContain("/feedback-recovery-broken");
    expect(verifier).toContain("/feedback-recovery-fixed");
    expect(verifier).toContain("expectedVerdict");
    expect(verifier).toContain("expectedDetectors");
    expect(verifier).toContain("status_change_not_announced");
    expect(verifier).toContain("without concrete evidence");

    const readme = readText("README.md");
    expect(readme).toContain("demo/high-priority-broken.html");
    expect(readme).toContain("demo/scenarios/high-priority-detectors.yaml");
    expect(readme).toContain("demo/feedback-recovery-broken.html");
    expect(readme).toContain("demo/scenarios/feedback-recovery.yaml");
    expect(readme).toContain("intended concrete evidence");
  });

  it("verifies interactive demo artifacts in demo:verify", () => {
    const verifier = readText("scripts/verify-demo.mjs");
    const readme = readText("README.md");
    const progress = readText("docs/PROGRESS.md");

    expect(existsSync(path.join(repoRoot, "demo/interactive-skip.html"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "demo/scenarios/interactive-skip.yaml"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "demo/interactive-navigation-stop.html"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "demo/scenarios/interactive-navigation-stop.yaml"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "demo/interactive-navigation-allow.html"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "demo/interactive-navigation-allow-next.html"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "demo/scenarios/interactive-navigation-allow.yaml"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "demo/interactive-hover-block.html"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "demo/scenarios/interactive-hover-block.yaml"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "demo/interactive-agentic-states.html"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "demo/scenarios/interactive-agentic-states.yaml"))).toBe(true);
    expect(verifier).toContain("expectedInteractiveArtifacts");
    expect(verifier).toContain("demo/scenarios/interactive-dag-clarity.yaml");
    expect(verifier).toContain("demo/scenarios/interactive-agentic-states.yaml");
    expect(verifier).toContain("demo/scenarios/interactive-skip.yaml");
    expect(verifier).toContain("demo/scenarios/interactive-navigation-stop.yaml");
    expect(verifier).toContain("demo/scenarios/interactive-navigation-allow.yaml");
    expect(verifier).toContain("demo/scenarios/interactive-hover-block.yaml");
    expect(verifier).toContain("expectedPlannerMode");
    expect(verifier).toContain("expectedMinClickedActions");
    expect(verifier).toContain("expectedNavigationStop");
    expect(verifier).toContain("expectedNavigationAllowed");
    expect(verifier).toContain("expectedPointerDrift");
    expect(verifier).toContain("stopped remaining planned actions");
    expect(verifier).toContain("Allowed navigation confirmed");
    expect(verifier).toContain("finalHitTestMatchedTarget");
    expect(verifier).toContain("cursor target drift");
    expect(verifier).toContain("expectedTargetCategories");
    expect(verifier).toContain("expectedDomDiffTextAdded");
    expect(verifier).toContain("Discovered insight open");
    expect(verifier).toContain("expectedSkippedAction");
    expect(verifier).toContain("action-trace.json");
    expect(verifier).toContain("state-graph.json");
    expect(verifier).toContain("contact-sheet.html");
    expect(verifier).toContain("trace-manifest.json");
    expect(verifier).toContain("action count does not match action trace");
    expect(verifier).toContain("Reviewer Answer Matrix");
    expect(verifier).toContain("What did it click or avoid?");
    expect(verifier).toContain("visualDiff");
    expect(verifier).toContain("pointerTrace");
    expect(verifier).toContain("clickDecision");
    expect(verifier).toContain("skipReason");
    expect(verifier).toContain("plannedReason");
    expect(verifier).toContain("targetId did not match action trace target id");
    expect(readme).toContain("`demo:verify` also runs the interactive DAG, agentic benign-state, skipped-action, navigation-stop, navigation-allow, hover-block, and motion-audit scenarios");
    expect(readme).toContain("trace-manifest.json");
    expect(readme).toContain("demo/scenarios/interactive-agentic-states.yaml");
    expect(readme).toContain("depth-1 replanning");
    expect(readme).toContain("demo/scenarios/interactive-skip.yaml");
    expect(readme).toContain("demo/scenarios/interactive-navigation-stop.yaml");
    expect(readme).toContain("demo/scenarios/interactive-navigation-allow.yaml");
    expect(readme).toContain("demo/scenarios/interactive-hover-block.yaml");
    expect(progress).toContain("Interactive Demo Artifact Gate");
    expect(progress).toContain("Agentic Benign State Demo Gate");
    expect(progress).toContain("stale-target skipped action");
    expect(progress).toContain("Navigation Allow Demo Gate");
    expect(progress).toContain("Hover Block Pointer Demo Gate");
  });

  it("verifies the interactive motion demo gate and animation evidence docs", () => {
    const verifier = readText("scripts/verify-demo.mjs");
    const readme = readText("README.md");
    const interactiveDocs = readText("docs/INTERACTIVE_AUDIT.md");
    const motionDocs = readText("docs/MOTION_AUDIT.md");

    expect(existsSync(path.join(repoRoot, "demo/interactive-motion.html"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "demo/scenarios/interactive-motion.yaml"))).toBe(true);

    const scenario = readText("demo/scenarios/interactive-motion.yaml");
    expect(scenario).toContain("animation_audit:");
    expect(scenario).toContain("compare_reduced_motion: true");
    expect(scenario).toContain("click_all_safe_controls: true");
    expect(scenario).toContain("animation_ignores_reduced_motion");
    expect(scenario).toContain("animation_hides_critical_action");
    expect(scenario).toContain("inconsistent_motion_tokens");

    expect(verifier).toContain("demo/scenarios/interactive-motion.yaml");
    expect(verifier).toContain("/interactive-motion");
    expect(verifier).toContain("expectedAnimationTrace");
    expect(verifier).toContain("reduced-motion comparison evidence");
    expect(verifier).toContain("reducedMotion");
    expect(verifier).toContain("expectedActionFindingDetectors");
    expect(verifier).toContain("a001-animation-trace.json");
    expect(verifier).toContain("Animation Audit");

    expect(readme).toContain("demo/scenarios/interactive-motion.yaml");
    expect(readme).toContain("animation traces");
    expect(readme).toContain("navigation stop/allow evidence");
    expect(interactiveDocs).toContain("interactive-motion");
    expect(interactiveDocs).toContain("interactive-navigation-stop");
    expect(interactiveDocs).toContain("interactive-navigation-allow");
    expect(interactiveDocs).toContain("interactive-hover-block");
    expect(interactiveDocs).toContain("pointer-path safety");
    expect(interactiveDocs).toContain("attach motion detector ids to the action");
    expect(motionDocs).toContain("Demo Gate");
    expect(motionDocs).toContain("state-graph.json");
    expect(motionDocs).toContain("contact-sheet.html");
  });

  it("keeps the README copy prompt self-contained for clone fallback", () => {
    const readme = readText("README.md");

    expect(readme).toContain("### Copy this prompt");
    expect(readme).toContain("TARGET_REPO=$(pwd)");
    expect(readme).toContain("git clone https://github.com/jk06095-lang/ux-sentinel.git /tmp/ux-sentinel");
    expect(readme).toContain("node /tmp/ux-sentinel/dist/cli.js --help");
    expect(readme).toContain('UX_SENTINEL="node /tmp/ux-sentinel/dist/cli.js"');
    expect(readme).not.toContain("use the temporary clone fallback from the ux-sentinel README");
  });

  it("uses a selected runner in the magic prompt after npm exec or fallback", () => {
    const prompt = readText("docs/CODEX_MAGIC_PROMPT.md");

    expect(prompt).toContain('UX_SENTINEL="npm exec --yes --package=github:jk06095-lang/ux-sentinel#v0.1.0 -- ux-sentinel"');
    expect(prompt).toContain('UX_SENTINEL="node /tmp/ux-sentinel/dist/cli.js"');
    expect(prompt).toContain("$UX_SENTINEL init");
    expect(prompt).toContain("$UX_SENTINEL run .ux-sentinel/scenarios/onboarding-empty-state.yaml --url <local-url>");
    expect(prompt).toContain("$UX_SENTINEL codex-brief <report-path>");
  });

  it("documents the GitHub-only v0.1.0 release workflow", () => {
    const notes = readText("RELEASE_NOTES.md");
    const checklist = readText("docs/RELEASE_CHECKLIST.md");

    expect(notes).toContain("# ux-sentinel v0.1.0");
    expect(notes).toContain("Not published to the npm registry yet.");
    expect(notes).toContain("github:jk06095-lang/ux-sentinel#v0.1.0");
    expect(checklist).toContain("gh release create v0.1.0");
    expect(checklist).toContain("--verify-tag");
    expect(checklist).toContain("npm publish is deferred for `v0.1.0`.");
    expect(checklist).toContain("npm pack --dry-run");
  });

  it("does not reference stale launch detector names", () => {
    const docs = [
      "README.md",
      "docs/MVP_SPEC.md",
      "docs/LAUNCH_PLAN.md",
      "docs/examples/sample-failure-report.md"
    ].map(readText).join("\n");

    expect(docs).not.toContain("aria-only-action");
    expect(docs).not.toContain("empty-state-primary-cta");
    expect(docs).toContain("primary_cta_icon_only");
    expect(docs).toContain("empty_state_without_cta");
  });

  it("warns not to commit target-repo .codex-tools fallback clones", () => {
    const docs = [
      "docs/CODEX_MAGIC_PROMPT.md",
      "docs/CODEX_INTEGRATION.md",
      ".agents/skills/ux-sentinel/SKILL.md",
      "examples/codex/magic-prompt.md",
      "examples/codex/goal-prompt.md",
      "examples/codex/onboarding-qa.prompt.md",
      "examples/codex/empty-state-qa.prompt.md"
    ].map(readText).join("\n");

    expect(docs).toContain(".codex-tools/ux-sentinel");
    expect(docs).toMatch(/do not commit it/i);
    expect(docs).toContain(".git/info/exclude");
  });

  it("mentions npm link only as something to avoid", () => {
    const docs = [
      "README.md",
      "docs/CODEX_MAGIC_PROMPT.md",
      "docs/CODEX_INTEGRATION.md",
      ".agents/skills/ux-sentinel/SKILL.md",
      "examples/codex/magic-prompt.md",
      "examples/codex/goal-prompt.md",
      "examples/codex/onboarding-qa.prompt.md",
      "examples/codex/empty-state-qa.prompt.md"
    ].map(readText).join("\n");

    const npmLinkLines = docs.split(/\r?\n/).filter((line) => /npm link/i.test(line));
    expect(npmLinkLines.length).toBeGreaterThan(0);
    for (const line of npmLinkLines) {
      expect(line).toMatch(/do not|does not need|no npm link|avoid|without/i);
    }
  });
});
