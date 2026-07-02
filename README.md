# ux-sentinel

DOM says pass. Humans say “what do I click?”

ux-sentinel is a local CLI that detects perception mismatches in AI-generated frontends: cases where the DOM, accessibility tree, or guided test says a feature exists, but the human-visible UI does not clearly communicate the next action.

It collects screenshots, visible text, DOM/accessibility evidence, layout signals, console errors, and network failures, then generates a report and a Codex-ready patch brief. Current `main` development builds also include interactive audit mode for hover, focus, scroll, overlay, card, and graph/DAG perception checks. Interactive audit is not part of the GitHub `v0.1.0` stable path unless it is released later.

## Why this exists

AI-built UIs can pass DOM tests while still failing the person looking at the screen. `ux-sentinel` checks the visible next action, empty-state guidance, layout signals, console errors, and network failures so the report points to the human-facing UX problem, not just the selector that exists.

## Use with Codex, no install required

Paste one prompt into Codex inside your frontend repo. Codex can pull `ux-sentinel` from GitHub, run perception checks, read the report, generate a patch brief, and fix only P0/P1 perception mismatch findings.

### Copy this prompt

**Copy-paste this into Codex from your target frontend repo:**

```text
Use ux-sentinel from GitHub as a temporary external QA tool for this frontend repo.

DOM says pass. Humans say “what do I click?”

Do not use npm link or a global install. First try:
npm exec --yes --package=github:jk06095-lang/ux-sentinel#v0.1.0 -- ux-sentinel --help

If that works, use this runner for all ux-sentinel commands:
UX_SENTINEL="npm exec --yes --package=github:jk06095-lang/ux-sentinel#v0.1.0 -- ux-sentinel"

If npm exec fails, run this fallback from the target repo root:
TARGET_REPO=$(pwd)
git clone https://github.com/jk06095-lang/ux-sentinel.git /tmp/ux-sentinel
cd /tmp/ux-sentinel
npm install
npm run build
cd "$TARGET_REPO"
node /tmp/ux-sentinel/dist/cli.js --help
UX_SENTINEL="node /tmp/ux-sentinel/dist/cli.js"

Build ux-sentinel in the temporary tool directory, then cd back to this target repo before running node /tmp/ux-sentinel/dist/cli.js. Reports and traces are written relative to the current working directory.

Read this repo's AGENTS.md and package files. Start the app, find the local URL, run $UX_SENTINEL init if .ux-sentinel is missing, run $UX_SENTINEL run .ux-sentinel/scenarios/onboarding-empty-state.yaml --url <local-url>, read the report, run $UX_SENTINEL codex-brief <report-path>, fix only P0/P1 perception mismatch findings, rerun the same scenario, and report files changed, commands run, final verdict, and remaining risks.
```

### Three Magic Prompts

Use these prompts when you want a more guided workflow:

1. [First Run Baseline](docs/prompts/01-first-run-baseline.md) — connect `ux-sentinel`, initialize the target repo, run the default baseline, and collect evidence without changing app source code.
2. [Natural Language Goal → Scenario](docs/prompts/02-natural-language-goal-to-scenario.md) — write the user's desired experience in plain language and let Codex refine it into a mission, persona, and executable visual-contract scenario.
3. [Continuous `/GOAL` Loop](docs/prompts/03-continuous-goal-loop.md) — let Codex implement the requested product work while `ux-sentinel` keeps checking and fixing report-backed P0/P1 perception mismatches.

Recommended order: run baseline first, turn the user's conversational goal into a scenario, then use the `/GOAL` loop for implementation and continuous QA.

Longer prompt files:

- [docs/CODEX_MAGIC_PROMPT.md](docs/CODEX_MAGIC_PROMPT.md)
- [examples/codex/magic-prompt.md](examples/codex/magic-prompt.md)

External repo smoke log:

- [docs/examples/external-codex-e2e-log.md](docs/examples/external-codex-e2e-log.md)

Fast path:

```bash
npm exec --yes --package=github:jk06095-lang/ux-sentinel#v0.1.0 -- ux-sentinel init
npm exec --yes --package=github:jk06095-lang/ux-sentinel#v0.1.0 -- ux-sentinel run .ux-sentinel/scenarios/onboarding-empty-state.yaml --url http://localhost:3000
```

Latest development path:

```bash
npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel init
npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel explore --url http://localhost:3000
npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel explore --url http://localhost:3000 --click-safe
```

If GitHub `npm exec` fails, Codex can use a temporary clone instead:

```bash
# Run this from the target frontend repo root.
TARGET_REPO=$(pwd)
git clone https://github.com/jk06095-lang/ux-sentinel.git /tmp/ux-sentinel
cd /tmp/ux-sentinel
npm install
npm run build
cd "$TARGET_REPO"
node /tmp/ux-sentinel/dist/cli.js init
node /tmp/ux-sentinel/dist/cli.js run .ux-sentinel/scenarios/onboarding-empty-state.yaml --url http://localhost:3000
```

Build ux-sentinel in the temporary tool directory, then cd back to the target repo before running node /tmp/ux-sentinel/dist/cli.js. Reports and traces are written relative to the current working directory.

This project is not published to npm yet. The command above uses GitHub as the package source. The Codex Skill/Plugin and MCP paths are future packaging options, not current requirements.

## Install

This MVP uses `npm` because it is the default Node.js package manager and keeps local setup simple.

```bash
npm install
npm run build
```

For local development, run the compiled CLI with:

```bash
node dist/cli.js --help
```

When installed as a package, the binary is:

```bash
ux-sentinel --help
```

## Quickstart

Run the whole demo in under 5 minutes:

```bash
npm install
npm run build
npm run demo:verify
```

Expected result:

```text
Scenario: onboarding-empty-state
Verdict: fail
...
Scenario: onboarding-empty-state
Verdict: pass
...
demo verification passed
```

`demo:verify` also runs the interactive DAG, agentic benign-state, skipped-action, navigation-stop, navigation-allow, hover-block, and motion-audit scenarios and checks that the local evidence bundle is reconstructable: `action-trace.json`, `state-graph.json`, `contact-sheet.html`, per-action screenshots, visual diffs, DOM/a11y diffs, pointer traces, animation traces, click decisions, skip reasons, navigation stop/allow evidence, hover pointer-drift evidence, action-linked finding detectors, and planner metadata must all be present.

Initialize UX Sentinel config in a project:

```bash
node dist/cli.js init
```

Observe a page without a scenario:

```bash
node dist/cli.js observe --url http://127.0.0.1:4173/fixed
```

Explore a page interactively:

```bash
node dist/cli.js explore --url http://127.0.0.1:4173/fixed --max-actions 20 --settle-ms 250
```

`explore` defaults to hover, focus, and scroll only. It does not click controls unless you pass `--click-safe`; `run --interactive` has no CLI click override, and passing `--click-safe` to `run` is rejected.

Run a visual-contract scenario:

```bash
node dist/cli.js run demo/scenarios/onboarding-empty-state.yaml --url http://127.0.0.1:4173/broken
```

Run a scenario with interactive exploration:

```bash
node dist/cli.js run demo/scenarios/interactive-dag-clarity.yaml --url http://127.0.0.1:4173/fixed --interactive
```

Turn feedback into a distilled YAML record:

```bash
node dist/cli.js ingest-feedback demo/feedback/dashboard-empty-state.md
```

Convert a report into a Codex-ready patch brief:

```bash
node dist/cli.js codex-brief .ux-sentinel/reports/<report>.md
```

## MVP Commands

- `ux-sentinel init`
- `ux-sentinel observe --url <url>`
- `ux-sentinel explore --url <url> [--click-safe]`
- `ux-sentinel run <scenario.yaml> --url <url>`
- `ux-sentinel run <scenario.yaml> --url <url> --interactive`
- `ux-sentinel ingest-feedback <file>`
- `ux-sentinel codex-brief <report>`

Interactive audit docs:

- [docs/INTERACTIVE_AUDIT.md](docs/INTERACTIVE_AUDIT.md)
- [docs/AGENTIC_INTERACTIVE_AUDIT.md](docs/AGENTIC_INTERACTIVE_AUDIT.md)
- [docs/SAFETY_POLICY.md](docs/SAFETY_POLICY.md)
- [docs/UX_RULE_REGISTRY.md](docs/UX_RULE_REGISTRY.md)
- [docs/prompts/04-interactive-visual-audit.md](docs/prompts/04-interactive-visual-audit.md)

## Sample Scenario

```yaml
id: onboarding-empty-state
title: First-time user sees clear next action
persona: first-time-user
mode: visual_contract

goal:
  user_wants: "Create the first project"
  primary_intent: "create_project"

visual_contract:
  primary_cta:
    preferred_labels:
      - "Create first project"
      - "Create project"
      - "New project"
    avoid_icon_only: true
    must_be_visible_above_fold: true
    must_look_clickable: true
  empty_state:
    if_detected_requires_primary_cta: true

fail_conditions:
  - primary_cta_missing
  - primary_cta_icon_only
  - empty_state_without_cta
  - console_error
  - network_5xx
  - horizontal_scroll
```

If `fail_conditions` is absent, ux-sentinel uses the default detector list and normal severity-based verdict behavior. A non-empty array is explicit and makes the listed detectors fail regardless of severity. An empty array (`fail_conditions: []`) means no explicit detector list, so normal severity-based behavior still applies.

Interactive extension for graph, overlay, and hover-heavy screens:

```yaml
interactive_exploration:
  enabled: true
  max_actions: 80
  hover_all_clickables: true
  # Default is false. Set true only when the scenario safely opts into clicks.
  click_all_safe_controls: true
  focus_all_keyboard_targets: true
  scroll_containers: true
  # Kept for schema compatibility; interactive audit always captures before/after screenshots.
  screenshot_before_after_each_action: true
  settle_ms: 350
  allow_navigation: false
  avoid_click_text:
    - "Delete"
    - "Sign out"
    - "Pay"

visual_anomaly_contract:
  no_text_occlusion: true
  no_click_target_blocking: true
  no_floating_panel_covering_primary_action: true
  no_svg_edge_label_overlap: true
  no_card_overlap: true
  no_important_text_truncation: true
  graph_dag:
    enabled: true
    columns_must_have_labels: true
    selected_path_must_be_traceable: true
    edge_labels_must_not_cross_nodes: true
    max_unused_canvas_ratio: 0.65

animation_audit:
  enabled: true
  compare_reduced_motion: true
  detect_layout_shift: true
  detect_risky_properties: true
  max_animation_ms: 1200
```

For standalone `explore`, clicking requires `--click-safe`. Scenario-driven `run --interactive` rejects `--click-safe` and has no one-off CLI click override; clicking requires `interactive_exploration.click_all_safe_controls: true`. Elements with `data-ux-role` are collected as analysis metadata by default; add `data-ux-clickable="true"` or `data-ux-action="..."` to opt a non-native element into safe-click filtering.

Interactive traces include `actions/a001-pointer-trace.json` for hover, focus, and click-capable actions. Pointer traces record the cursor path, hover duration, target movement, overlay appearance, and whether the final hit-test still matched the target. If a safe click would land on a different element after hover, ux-sentinel skips the click and records `cursor target drift`.

When `animation_audit.enabled: true`, interactive runs also write `actions/a001-animation-trace.json` with CSS transition/animation evidence, optional reduced-motion comparison, risky properties, and motion findings such as `animation_ignores_reduced_motion`.

Current interactive development builds also map findings to UX rules and include expanded deterministic detectors for target size/spacing, visible affordance, visible/accessibility label mismatch, dialog/status accessibility, dialog/modal escape, popover-over-primary overlap, graph/DAG control and traceability, empty/loading/dead-end recovery, primary-action hierarchy, label/action consistency, focus visibility, destructive-action cues, agentic click feedback, and opt-in motion audit.

For a larger opt-in template, see `demo/scenarios/professional-agentic-ui-audit.yaml`.

## Sample Report Output

```markdown
# UX Sentinel Report

## Verdict
- result: fail
- functional issues: 0
- perception mismatch issues: 4

## Interactive Exploration
- actions: 12
- screenshots: 25
- anomalies: 2
- contact sheet: .ux-sentinel/traces/<timestamp>/contact-sheet.html
- notes: none

## Findings

### UX-001: No visible primary CTA matches the scenario intent
- Severity: P1
- Type: Perception Mismatch
- Detector: primary_cta_missing
- UX rules: nielsen.match_real_world, interaction_law.visual_hierarchy, local.perception_mismatch
- Why this matters: Match between system and the real world: Visible labels and empty states should use language that helps a human understand the next action.
- Evidence: Scenario intent "create_project" expects one of: Create first project, Create project, New project.
- User impact: A human can see the page but cannot identify the primary next action from visible copy.
```

Full example: [docs/examples/sample-failure-report.md](docs/examples/sample-failure-report.md)

## Sample Codex Brief

```markdown
# Codex Patch Brief

## Goal

Fix the visible UI perception mismatch without changing the product scope.

## Findings To Address

### UX-002: Primary CTA is only communicated through an icon or hidden label
- Severity: P1
- Type: Perception Mismatch
- Evidence: The button has visible text "+" and aria-label "Create first project".
- User impact: The DOM exposes the action, but the visible screen does not make the action legible.

## Acceptance Criteria

- The same ux-sentinel scenario passes after the UI patch.
- The primary next action is visible to a human, not only present in the DOM or accessibility tree.
```

Full example: [docs/examples/sample-codex-brief.md](docs/examples/sample-codex-brief.md)

## Sample Feedback Output

```yaml
raw_quote: "I landed on the dashboard and saw no projects, but I did not know what to click."
affected_journey: dashboard-empty-state
pain_points:
  - The primary next action is not visually obvious.
  - The empty state does not provide enough guidance.
likely_ux_principle: Primary actions must be visible, legible, and aligned with the user's current goal.
suggested_scenario_check: Add or update a visual_contract scenario that requires a visible primary CTA and empty-state next-step copy.
confidence: medium
```

## Demo

The demo includes two local pages:

- `demo/broken.html`: dashboard empty state with only a tiny `+` icon button and `aria-label="Create first project"`.
- `demo/fixed.html`: dashboard empty state with a visible `Create first project` CTA.

It also includes a high-priority detector pair:

- `demo/high-priority-broken.html`: intentionally triggers small click target, visible-label/accessibility-name mismatch, clickable-looking non-action, and destructive-action-without-confirmation findings.
- `demo/high-priority-fixed.html`: fixes the same UI with a correctly named primary CTA, standard target sizes, real secondary action affordance, and visible confirmation/undo copy.

The interactive demo set also includes `demo/interactive-navigation-stop.html` with `demo/scenarios/interactive-navigation-stop.yaml`, which proves scenario-driven interactive audit stops remaining planned actions after unexpected navigation when `allow_navigation: false`. The paired `demo/interactive-navigation-allow.html` and `demo/scenarios/interactive-navigation-allow.yaml` fixture proves that explicitly allowed navigation keeps the navigation capability enabled, avoids the stop note, and replans onto the destination page. `demo/interactive-hover-block.html` with `demo/scenarios/interactive-hover-block.yaml` intentionally fails when hover content blocks the trigger, proving pointer trace drift findings are attached to the report, action trace, state graph, and contact sheet. `demo/interactive-motion.html` with `demo/scenarios/interactive-motion.yaml` is an intentionally failing motion-audit fixture that proves per-action animation traces and motion findings are attached to the report, action trace, state graph, and contact sheet.

Run the full demo gate. It checks exact fail/pass verdicts and confirms the high-priority broken report includes the intended detector evidence:

```bash
npm run build
npm run demo:verify
```

Expected output:

```text
Scenario: onboarding-empty-state
Verdict: fail
...
Scenario: onboarding-empty-state
Verdict: pass
...
Scenario: high-priority-detectors
Verdict: fail
...
Scenario: high-priority-detectors
Verdict: pass
...
demo verification passed
```

You can also run the server and commands manually. Use one terminal for the server:

```bash
npm run demo:server
```

Then use a second terminal for the checks:

```bash
node dist/cli.js run demo/scenarios/onboarding-empty-state.yaml --url http://127.0.0.1:4173/broken
node dist/cli.js run demo/scenarios/onboarding-empty-state.yaml --url http://127.0.0.1:4173/fixed
node dist/cli.js run demo/scenarios/high-priority-detectors.yaml --url http://127.0.0.1:4173/high-priority-broken
node dist/cli.js run demo/scenarios/high-priority-detectors.yaml --url http://127.0.0.1:4173/high-priority-fixed
node dist/cli.js explore --url http://127.0.0.1:4173/fixed --max-actions 20 --settle-ms 250
node dist/cli.js explore --url http://127.0.0.1:4173/fixed --max-actions 20 --settle-ms 250 --click-safe
node dist/cli.js run demo/scenarios/interactive-dag-clarity.yaml --url http://127.0.0.1:4173/fixed --interactive --max-actions 20
node dist/cli.js run demo/scenarios/interactive-agentic-states.yaml --url http://127.0.0.1:4173/interactive-agentic-states --interactive --max-actions 6
node dist/cli.js run demo/scenarios/interactive-skip.yaml --url http://127.0.0.1:4173/interactive-skip --interactive --max-actions 2
node dist/cli.js run demo/scenarios/interactive-navigation-stop.yaml --url http://127.0.0.1:4173/interactive-navigation-stop --interactive --max-actions 2
node dist/cli.js run demo/scenarios/interactive-navigation-allow.yaml --url http://127.0.0.1:4173/interactive-navigation-allow --interactive --max-actions 2
node dist/cli.js run demo/scenarios/interactive-hover-block.yaml --url http://127.0.0.1:4173/interactive-hover-block --interactive --max-actions 1
node dist/cli.js run demo/scenarios/interactive-motion.yaml --url http://127.0.0.1:4173/interactive-motion --interactive --max-actions 1
```

## Evidence Artifacts

Each observation/run writes local artifacts under `.ux-sentinel/traces/<timestamp>/`:

- `screenshot.png`
- `screen-map.json`
- `screen-map.html`
- `accessibility.json`
- `observer-report.md` for `observe`

Interactive exploration writes:

- `baseline.png`
- `action-trace.json`
- `state-graph.json`
- `anomalies.json`
- `contact-sheet.html`
- `actions/a001-before.png`
- `actions/a001-after.png`
- `actions/a001-screen-map.json`
- `actions/a001-dom-diff.json`
- `actions/a001-a11y-diff.json`

Skipped actions are recorded in `action-trace.json` and shown in `contact-sheet.html` with a skip reason; `demo/scenarios/interactive-skip.yaml` exercises this by removing a baseline target before the runner reaches it. `demo/scenarios/interactive-agentic-states.yaml` exercises agentic continuation and depth-1 replanning through benign state changes by clicking a primary CTA, tab, menu trigger, help trigger, accordion, and a newly discovered control while the verifier checks planner mode, target categories, clicked-action count, state-graph edges, and DOM diff text. `demo/scenarios/interactive-navigation-stop.yaml` exercises the default navigation safety policy by expecting one clicked action, a URL-change edge, and a report/action-trace/contact-sheet note that remaining planned actions stopped because `allow_navigation: false`. `demo/scenarios/interactive-navigation-allow.yaml` exercises explicit navigation opt-in by expecting `navigation: true`, two clicked actions, a URL-change edge, no stop note, destination-page DOM diff evidence, and contact-sheet evidence for the replanned destination action. `demo/scenarios/interactive-hover-block.yaml` exercises pointer-path safety by expecting hover content to appear during cursor approach, final hit-test mismatch, a skipped safe click with `cursor target drift`, action-linked hover detector ids, and contact-sheet pointer evidence. `demo/scenarios/interactive-motion.yaml` exercises opt-in motion audit by expecting `actions/a001-animation-trace.json`, action-linked motion detector ids, and contact-sheet animation evidence for an intentionally failing primary CTA. The action trace also records the resolved capability policy, every baseline click candidate's allow/skip decision, and each performed action's safe-click decision. `state-graph.json` links before/after states, screenshots, visual diffs, screen maps, DOM diffs, accessibility diffs, and animation traces so a reviewer can reconstruct the audit path. The contact sheet is the primary human review surface for interactive audit.

Each interactive action writes `actions/a001-diff.png` alongside `a001-before.png` and `a001-after.png`, giving reviewers a local static visual diff without an external image service.

`contact-sheet.html` is a static local review surface with a reviewer answer matrix, severity, detector, and rule-family filters, an action timeline, a safety log, accessibility and animation audit sections, bbox overlays, and UX principle mapping for findings. The matrix answers what the agent did, what it clicked or avoided, what changed, which evidence supports the result, and which UX principle or fix should guide review.

Scenario reports are written under `.ux-sentinel/reports/`. Codex patch briefs are written under `.ux-sentinel/briefs/`.

The demo generates screenshots automatically as `.ux-sentinel/traces/<timestamp>/screenshot.png`; these local runtime artifacts are ignored by git.

## Current Detectors

Static visual-contract detectors:

- `primary_cta_missing`
- `primary_cta_icon_only`
- `empty_state_without_cta`
- `dom_visible_but_human_invisible`
- `primary_cta_below_fold`
- `horizontal_scroll`
- `console_error`
- `network_5xx`
- `important_text_truncated`
- `important_text_below_fold_without_cue`
- `primary_cta_low_visual_weight`
- `multiple_primary_ctas_conflict`
- `secondary_action_overpowers_primary`
- `same_label_different_actions`
- `same_action_different_labels`
- `click_target_too_small`
- `click_target_spacing_too_tight`
- `clickable_without_visible_affordance`
- `looks_clickable_but_not_actionable`
- `visible_label_not_in_accessible_name`
- `icon_button_without_visible_label`
- `aria_label_contradicts_visible_text`
- `status_change_not_announced`
- `dialog_without_accessible_name`
- `loading_without_progress_or_timeout`
- `dead_end_state_without_recovery`
- `empty_state_without_next_step`
- `dialog_close_unavailable`
- `modal_trap_without_escape`
- `popover_blocks_primary_action`
- `destructive_action_without_confirmation`

Interactive focus and state detectors:

- `focus_ring_missing`
- `focus_obscured_by_author_content`
- `focus_order_unexpected_jump`
- `focus_caused_context_change`
- `keyboard_target_not_reachable`
- `no_feedback_after_action`
- `safe_click_changed_unrelated_state`

Interactive visual anomaly detectors:

- `click_target_blocked_by_overlay`
- `floating_panel_overlaps_primary_action`
- `tooltip_partially_offscreen`
- `tooltip_blocks_trigger`
- `hover_content_blocks_trigger`
- `sticky_layer_hides_content`
- `responsive_layout_breakpoint_overlap`
- `text_occluded_by_graph_edge`
- `edge_label_crosses_node`
- `selected_path_not_traceable`
- `edge_crosses_critical_label`
- `graph_control_not_discoverable`
- `node_label_truncated`
- `card_content_clipped`
- `card_overlap`
- `dag_canvas_excessive_unused_space`
- `empty_dag_column_without_explanation`

Opt-in motion audit detectors:

- `animation_ignores_reduced_motion`
- `animation_hides_critical_action`
- `animation_duration_blocks_task`
- `animation_causes_layout_shift`
- `animation_uses_layout_paint_properties`
- `animation_jank_detected`
- `inconsistent_motion_tokens`

## Limitations

- This MVP uses deterministic DOM, layout, accessibility, console, and network evidence. It does not use a visual AI model.
- It does not call external LLM APIs.
- It is not a SaaS dashboard, cloud runner, account system, database, Chrome extension, or enterprise QA platform.
- Interactive audit moves the mouse, focuses targets, and scrolls containers. Clicking is disabled by default. Standalone `explore` requires `--click-safe`; scenario-driven `run --interactive` has no CLI click override and requires explicit scenario opt-in with `click_all_safe_controls: true`.
- `data-ux-role` is analysis metadata by default, not permission to click. Use `data-ux-clickable="true"` or `data-ux-action` to opt non-native elements into safe-click filtering.
- Graph and DAG anomaly checks are bbox heuristics. Review `contact-sheet.html` before treating them as final UX truth.
- It is not a replacement for human UX research; it is a local evidence harness for catching obvious perception mismatches before review.
- It is not currently published as an npm registry package.
- The repo-scoped Codex skill draft is included for local workflow design; it is not a published Codex plugin.
- Detector heuristics are intentionally small and explainable.
- The first visual contract focuses on clear primary CTA and empty-state perception.

## Roadmap

- More visual-contract detectors for disabled recovery, confusing hierarchy, and copy/consequence mismatch.
- Agentic action planning on top of the current capability-based safety model.
- Richer scenario action steps that remain deterministic and local-first.
- Optional vision review behind an explicit disabled-by-default flag.
- Optional provider hooks for teams that want LLM-assisted feedback distillation.
- Richer screen-map overlay controls.
- Package publishing workflow after the MVP stabilizes.
