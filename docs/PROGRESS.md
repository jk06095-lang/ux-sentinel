# Progress

This file tracks checkpoints while building `ux-sentinel`.

## 2026-07-01

### Checkpoint: Project Docs Bootstrap

Status: done

Created the initial project guidance documents:

- `AGENTS.md`
- `docs/PRODUCT_BRIEF.md`
- `docs/MVP_SPEC.md`
- `docs/LAUNCH_PLAN.md`
- `docs/DECISIONS.md`
- `docs/PROGRESS.md`

Captured the MVP as a local CLI with five required commands:

- `ux-sentinel init`
- `ux-sentinel observe --url <url>`
- `ux-sentinel run <scenario.yaml> --url <url>`
- `ux-sentinel ingest-feedback <feedback.md>`
- `ux-sentinel codex-brief <report.md>`

Recorded the out-of-scope list: no SaaS dashboard, login, payments, cloud runner, complex database, Chrome extension, fully autonomous browser agent, required external LLM API, Figma integration, or enterprise QA platform.

### Next Checkpoint

Implement the CLI scaffold and `ux-sentinel init` using `docs/MVP_SPEC.md` as the contract.

### Checkpoint: Codex Start Prompt

Status: done

Added `docs/CODEX_START_PROMPT.md` with the first-message prompt for a fresh Codex session.

Updated `docs/PRODUCT_BRIEF.md` with the third user-provided context block and clarified that the product brief is background context, while `docs/MVP_SPEC.md` and `AGENTS.md` carry the implementation contract and engineering rules.

### Checkpoint: TypeScript CLI MVP Implementation

Implemented the local TypeScript CLI package with:

- `ux-sentinel init`
- `ux-sentinel observe --url <url>`
- `ux-sentinel run <scenario.yaml> --url <url>`
- `ux-sentinel ingest-feedback <file>`
- `ux-sentinel codex-brief <report>`

Implemented Playwright evidence collection for screenshot, `screen-map.json`, `screen-map.html`, accessibility snapshot, console errors, and network 4xx/5xx.

Implemented rule-based detectors for primary CTA missing, icon-only primary CTA, empty state without CTA, DOM-visible but human-invisible controls, below-fold CTA, horizontal scroll, console errors, network 5xx, and important text truncation.

Added the broken/fixed dashboard demo fixture and `npm run demo:verify`, which expects the broken page to fail and the fixed page to pass.

Added README, LICENSE, CONTRIBUTING, and sample feedback fixture.

### Checkpoint: MVP Verification

Status: done

Verified the MVP completion gates:

- `npm install` completed successfully with 0 vulnerabilities reported.
- `npm run build` passed.
- `npm test` passed with 5 test files and 9 tests.
- `node dist/cli.js init` created `.ux-sentinel` config, scenario, persona, feedback, report, and trace folders.
- `node dist/cli.js observe --url <demo file URL>` created screenshot, `screen-map.json`, `screen-map.html`, `accessibility.json`, and `observer-report.md`.
- `node dist/cli.js ingest-feedback demo/feedback/dashboard-empty-state.md` created distilled YAML feedback.
- `node dist/cli.js codex-brief <failing report>` created a Codex patch brief.
- `npm run demo:verify` passed: the broken demo exited with fail and the fixed demo exited with pass.

### Checkpoint: GitHub Publish Preparation

Status: done

Updated the top of `README.md` to lead with the product's most important GitHub-facing message:

> DOM says pass. Humans say “what do I click?”

Prepared package metadata for the public GitHub repository `jk06095-lang/ux-sentinel`.

Re-verified before publish:

- `npm run build` passed.
- `npm test` passed with 5 test files and 9 tests.
- `npm run demo:verify` passed with broken demo failing and fixed demo passing.

### Checkpoint: GitHub Publish

Status: done

Published the repository to GitHub:

- https://github.com/jk06095-lang/ux-sentinel
- default branch: `main`
- initial MVP commit: `dd4307f`

### Checkpoint: GitHub Launch Audit

Status: done

Audited the repository against the public launch checklist.

README launch fixes:

- Added `Why this exists`.
- Added a 5-minute copy-paste demo path.
- Clarified two-terminal manual demo usage.
- Added sample feedback YAML output.
- Added sample Codex brief section.
- Added links to `docs/examples/sample-failure-report.md` and `docs/examples/sample-codex-brief.md`.
- Clarified that screenshots are generated locally under `.ux-sentinel/traces/<timestamp>/`.

### Checkpoint: Cross-Project Codex Usage

Status: done

Improved the project so Codex can use ux-sentinel from another frontend repository without `npm link` or global install:

- Added `prepare: npm run build` for GitHub package installs.
- Added `docs/CODEX_MAGIC_PROMPT.md`.
- Added `docs/CODEX_INTEGRATION.md`.
- Added repo-scoped skill draft at `.agents/skills/ux-sentinel/SKILL.md`.
- Added copy-paste prompts under `examples/codex/`.
- Updated README with the GitHub `npm exec` fast path and temporary clone fallback.
- Updated `docs/LAUNCH_PLAN.md` with the prompt-only usage story.

Verification:

- `npm install` passed and ran `prepare -> npm run build`.
- `npm run build` passed.
- `npm test` passed with 6 test files and 16 tests.
- `npm run demo:verify` passed with broken demo failing and fixed demo passing.
- `npm pack --dry-run` included `dist`, docs, examples, and the repo-scoped skill draft.
- `npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel --help` passed from GitHub.
- `npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel init` created `.ux-sentinel` in a clean temporary target directory.

### Checkpoint: Clone Fallback CWD Safety

Status: done

Fixed the temporary clone fallback docs so the clone directory is only used to build ux-sentinel. The docs now instruct Codex to return to the target frontend repo before running `node /tmp/ux-sentinel/dist/cli.js`, because reports and traces are written relative to `process.cwd()`.

Updated README, Codex magic prompt, Codex integration guide, repo-scoped skill draft, launch plan, and copy-paste Codex prompts. Added tests to prevent fallback examples from running target scenario checks from inside `/tmp/ux-sentinel`.

### Checkpoint: Public Launch Polish

Status: done

Made the README Codex entry point more visible with a direct "Copy this prompt" block near the top.

Captured a real external-repo smoke log using the GitHub `npm exec` path. The temporary target frontend repo produced:

- broken page: exit 1, report verdict `fail`
- fixed page: exit 0, report verdict `pass`
- reports and traces written under the target repo `.ux-sentinel` directory

Documented the current packaging decision: v0.1 launch usage stays GitHub-only for now; npm publish waits until the v0.1.0 tag, release notes, and package ownership are deliberately finalized.

### Checkpoint: Launch Docs Review Polish

Status: done

Applied the final launch-doc review fixes:

- Made the README copy prompt self-contained with the minimal temporary clone fallback commands.
- Introduced a selected `UX_SENTINEL` runner in the magic prompt and Codex examples so fallback and npm exec paths share the same later workflow.
- Replaced stale launch-plan detector names with `primary_cta_icon_only`, `empty_state_without_cta`, and optional `dom_visible_but_human_invisible`.
- Clarified the external smoke log by explaining the broken and fixed checks used the same local URL after swapping the temporary target app HTML.
- Added `.codex-tools/ux-sentinel` safety guidance: do not commit it; prefer `.git/info/exclude` over changing `.gitignore` unless the user asks.
- Added docs tests for self-contained fallback commands, selected runner usage, stale detector names, and `.codex-tools` commit safety.

Verification:

- `npm run build` passed.
- `npm test` passed with 6 test files and 23 tests.
- `npm run demo:verify` passed with the broken demo failing and the fixed demo passing.

### Checkpoint: GitHub-Only v0.1.0 Release Prep

Status: done

Prepared release documentation for a GitHub-only `v0.1.0` release:

- Added `RELEASE_NOTES.md`.
- Added `docs/RELEASE_CHECKLIST.md`.
- Updated stable no-install commands to prefer `github:jk06095-lang/ux-sentinel#v0.1.0`.
- Kept `#main` documented as the latest-development path.
- Kept npm publishing deferred for `v0.1.0`.

The actual annotated tag, GitHub Release, and npm publish were not created during this checkpoint.

Verification:

- `npm run build` passed.
- `npm test` passed with 6 test files and 25 tests.
- `npm run demo:verify` passed with the broken demo failing and the fixed demo passing.
- `npm pack --dry-run` passed and produced a dry-run `ux-sentinel-0.1.0.tgz` package listing.

### Checkpoint: GitHub v0.1.0 Release

Status: done

Created the GitHub-only `v0.1.0` release.

Release verification:

```json
{
  "isDraft": false,
  "isPrerelease": false,
  "name": "ux-sentinel v0.1.0",
  "tagName": "v0.1.0",
  "url": "https://github.com/jk06095-lang/ux-sentinel/releases/tag/v0.1.0"
}
```

Post-release `v0.1.0` smoke:

- `npm exec --yes --package=github:jk06095-lang/ux-sentinel#v0.1.0 -- ux-sentinel --help`: exit 0
- `ux-sentinel init`: exit 0
- `ux-sentinel run` against a temp fixed app: exit 0
- report verdict: `pass`
- reports and traces written under the target temp repo `.ux-sentinel`

npm publish remains deferred.

## 2026-07-03

### Checkpoint: Interactive Audit Mode

Status: done

Added deterministic interactive audit support:

- `ux-sentinel explore --url <url>`
- `ux-sentinel run <scenario.yaml> --url <url> --interactive`
- optional `--max-actions <n>`
- optional `--settle-ms <ms>`

Implemented Playwright-based target collection for visible controls, safe-click filtering for destructive/payment/account actions, hover/focus/click/scroll action capture, `action-trace.json`, `anomalies.json`, and `contact-sheet.html`.

Added rule-based visual anomaly coverage for blocked click targets, floating panels covering primary actions, off-screen tooltips, graph edge/text overlap, edge labels crossing nodes, clipped card content, overlapping cards, excessive DAG canvas whitespace, and unexplained empty DAG columns.

Added docs and scenario examples:

- `docs/INTERACTIVE_AUDIT.md`
- `docs/prompts/04-interactive-visual-audit.md`
- `demo/scenarios/interactive-dag-clarity.yaml`

Verification:

- `npm run build` passed.
- `npm test` passed with 7 test files and 32 tests.
- `npm run demo:verify` passed with the broken demo failing and the fixed demo passing.
- `node dist/cli.js explore --url http://127.0.0.1:4173/fixed --max-actions 10 --settle-ms 100` passed and generated `action-trace.json`, `anomalies.json`, and `contact-sheet.html`.
- `node dist/cli.js run demo/scenarios/interactive-dag-clarity.yaml --url http://127.0.0.1:4173/fixed --interactive --max-actions 10 --settle-ms 100` passed with verdict `pass` and generated the interactive report/contact sheet.

### Checkpoint: Interactive Audit Hardening

Status: done

Hardened interactive audit before v0.2 readiness:

- Revalidates each target before action and skips missing, detached, invisible, zero-size, or offscreen targets instead of reusing old coordinates.
- Records `urlBefore`, `urlAfter`, skipped status, and skip reasons in `action-trace.json`.
- Stops remaining baseline-collected targets after navigation unless `interactive_exploration.allow_navigation: true`.
- Makes standalone `explore` hover/focus/scroll only by default; clicking requires `--click-safe`.
- Makes scenario-driven clicking opt-in with `interactive_exploration.click_all_safe_controls: true`.
- Treats `data-ux-role` as analysis metadata by default; non-native metadata elements require `data-ux-clickable="true"` or `data-ux-action` before safe-click filtering can allow them.
- Always writes before/after action screenshots so `contact-sheet.html` has valid evidence.
- Makes explicit `fail_conditions` authoritative even for P2/P3 findings.

Verification:

- `npm run build` passed.
- `npm test` passed with 8 test files and 45 tests.
- `npm run demo:verify` passed with the broken demo failing and the fixed demo passing.
- `node dist/cli.js explore --url http://127.0.0.1:4173/fixed --max-actions 10 --settle-ms 100` passed and action trace showed `clicked: false`.
- `node dist/cli.js explore --url http://127.0.0.1:4173/fixed --max-actions 10 --settle-ms 100 --click-safe` passed and action trace showed `clicked: true`.
- `node dist/cli.js run demo/scenarios/interactive-dag-clarity.yaml --url http://127.0.0.1:4173/fixed --interactive --max-actions 10 --settle-ms 100` passed with verdict `pass`.
- `node dist/cli.js codex-brief .ux-sentinel/reports/interactive-dag-clarity-2026-07-02T16-17-40-263Z.md` generated a brief with interactive evidence paths.

### Checkpoint: Capability-Based Interactive Safety

Started the agentic interactive audit foundation without weakening the hardened click policy:

- Added an explicit capability model for `observe`, `hover`, `focus`, `scroll`, `safe_click`, `navigation`, `typing`, `form_submit`, and `destructive_action`.
- Kept standalone `explore --click-safe` as the only CLI path that enables safe clicks outside a scenario.
- Rejects `run --interactive --click-safe`; scenario-driven clicking still requires `interactive_exploration.click_all_safe_controls: true`.
- Added safe-click allow/skip decisions and reasons to action records and contact-sheet rows.
- Added a baseline click-candidate ledger to `action-trace.json` and the contact-sheet safety log so every collected click candidate has an explicit allow/skip decision.
- Documented the policy in `docs/SAFETY_POLICY.md`.

### Checkpoint: Agentic Planner Foundation

Added the first deterministic planner layer for agentic interactive audit:

- Added target classification for primary CTAs, secondary actions, navigation, tabs, menus, dropdowns, dialogs, tooltips/help, cards, expanders, graph/DAG nodes and controls, form-adjacent controls, scroll containers, and ambiguous targets.
- Added an action planner that preserves linear order by default and prioritizes meaningful UX exploration when `interactive_exploration.mode: agentic`.
- Added `plannedReason`, `targetCategory`, `riskLevel`, `planDepth`, `planPriority`, and `plannedSafeClick` to action records.
- Added planner metadata to `action-trace.json` and contact-sheet rows.
- Split planner click and state-change budget accounting so skipped safe clicks explain whether `max_clicks` or `max_state_changes` blocked the action.
- Kept safe-click policy intact: planner click budgets can reduce clicks, but cannot enable clicks without the existing capability policy.

### Checkpoint: State Graph Evidence

Added reconstructable state evidence for interactive audit:

- Added `state-graph.json` with state nodes and action edges.
- Added state node hashes for visible text, DOM structure, and accessibility snapshots.
- Captures open dialog/menu/popover/expanded-trigger state with id, bbox, ARIA, `data-state`, and `data-ux-role` evidence.
- Added per-action `aNNN-dom-diff.json` and `aNNN-a11y-diff.json`.
- Added `beforeStateId`, `afterStateId`, `domDiff`, and `accessibilityDiff` to action records.
- Added state graph and diff paths to reports, Codex briefs, CLI summaries, and contact-sheet rows.
- Added cursor movement summaries to state graph edges so reviewers can inspect point count, duration, target movement, overlay appearance, and final hit-test status without opening the full pointer trace first.
- Added attached finding summaries to state graph edges so each action edge carries the relevant finding id, detector, severity, title, UX rule metadata, and confidence alongside the artifact paths.
- Extended attached state-graph finding summaries with evidence, user impact, suggested fix, and regression check so each action edge is repair-ready without cross-referencing the Markdown report first.

### Checkpoint: Pointer Trace Evidence

Added cursor movement evidence for interactive audit:

- Added `actions/aNNN-pointer-trace.json` for hover, focus, and click-capable actions.
- Recorded start/end/intermediate cursor points, movement duration, hover duration, target movement, overlay appearance, and final hit-test match state.
- Skips otherwise allowed safe clicks when hover or target movement causes final pointer hit-test drift.
- Added pointer trace paths to action records, state graph edges, and contact-sheet rows.
- Added compact pointer summaries to action records and contact-sheet rows so point count, movement timing, target movement, overlay appearance, and final hit-test status are visible without opening the full pointer trace first.

### Checkpoint: UX Rule Registry

Added detector-to-rule mapping for current findings:

- Added rule modules for Nielsen heuristics, WCAG 2.2, motion, Gestalt, interaction laws, graph/DAG readability, and local product rules.
- Extended findings with `ruleIds`, `ruleFamily`, `whyThisMatters`, `confidence`, and optional evidence paths.
- Reports now render UX rule metadata and "Why this matters" text.
- Added tests that fail if implemented detectors are not mapped to at least one UX rule.

### Checkpoint: Expanded High-Priority Detectors

Added the first expanded detector batch:

- Static screen-map detectors for `click_target_too_small`, `click_target_spacing_too_tight`, `clickable_without_visible_affordance`, `looks_clickable_but_not_actionable`, `visible_label_not_in_accessible_name`, `aria_label_contradicts_visible_text`, `responsive_layout_breakpoint_overlap`, and `destructive_action_without_confirmation`.
- Interactive focus detectors for `focus_ring_missing`, `focus_obscured_by_author_content`, `focus_order_unexpected_jump`, `focus_caused_context_change`, and `keyboard_target_not_reachable`.
- Agentic state-diff detectors for `no_feedback_after_action` and `safe_click_changed_unrelated_state`.
- Added screen-map style/action metadata and focus evidence so these findings are grounded in bbox, computed style, hit-test, and state-diff evidence.

### Checkpoint: Optional Motion Audit Foundation

Added the first deterministic motion-audit slice:

- Added scenario parsing for `animation_audit`.
- Added `actions/aNNN-animation-trace.json` with CSS transition, CSS animation, Web Animations API, risky property, reduced-motion comparison, and target bbox evidence.
- Added motion findings for `animation_ignores_reduced_motion`, `animation_hides_critical_action`, `animation_duration_blocks_task`, `animation_causes_layout_shift`, `animation_uses_layout_paint_properties`, `animation_jank_detected`, and `inconsistent_motion_tokens`.
- Linked animation traces into action records, state graph edges, contact-sheet rows, and UX rule evidence paths.
- Documented the opt-in behavior in `docs/MOTION_AUDIT.md`.

### Checkpoint: Visual Diff Evidence

Added per-action visual diff artifacts:

- Writes `actions/aNNN-diff.png` for hover, focus, click-capable, scroll, and skipped actions.
- Adds `visualDiff` to action records and state graph edges.
- Shows visual diff thumbnails and paths in `contact-sheet.html`.
- Counts diff images in the interactive screenshot summary so evidence totals reflect before/after/diff panels.

### Checkpoint: Contact Sheet 2.0 Foundation

Upgraded the static local contact sheet into a richer review surface:

- Added severity, detector, and rule-family filters.
- Added an action timeline, state graph summary, safety log, accessibility cross-check, and animation audit section.
- Added a static state graph map in the contact sheet so the action route is visible without opening `state-graph.json`.
- Added a state transition path so reviewers can reconstruct each `beforeStateId -> afterStateId` edge from the contact sheet.
- Extended the safety log with before/after/diff/screen-map evidence paths for each action, including skipped actions.
- Added bbox overlays on before/after/diff panels.
- Added per-action UX principle mapping and finding confidence details.
- Added evidence, user impact, suggested fix, and regression check details to per-action and global finding rows.
- Added confidence filtering and explicit evidence-status labels so lower-confidence heuristic prompts are not presented like evidence-backed findings.
- Linked contact-sheet action trace, state graph, screenshots, visual diffs, screen maps, pointer traces, animation traces, DOM diffs, and accessibility diffs as local static artifact links.
- Kept the artifact as static HTML that works from local files without a server.

### Checkpoint: Visual Hierarchy And Action Consistency Detectors

Added the next deterministic detector slice for agentic UX review:

- `primary_cta_low_visual_weight` flags above-fold primary CTAs that exist but are too visually weak to read as primary.
- `multiple_primary_ctas_conflict` flags competing above-fold controls that all match the primary intent.
- `secondary_action_overpowers_primary` flags a non-primary command whose `visualWeight` overwhelms the intended CTA.
- `important_text_below_fold_without_cue` flags important setup, state, consequence, or recovery copy below the initial viewport when no above-fold scroll/more cue is visible.
- `same_label_different_actions` flags repeated visible labels backed by different `data-ux-action` semantics.
- `same_action_different_labels` flags one `data-ux-action` exposed through inconsistent visible labels.

These checks use screen-map bbox, visualWeight, visible label, and action metadata evidence; they do not depend on external LLM or vision APIs.

### Checkpoint: Accessibility And Recovery-State Detectors

Added another deterministic detector slice:

- `icon_button_without_visible_label` flags icon-only controls that rely on hidden labels.
- `dialog_without_accessible_name` flags visible dialogs without `aria-label`, `aria-labelledby`, or title evidence.
- `status_change_not_announced` flags explicit `data-ux-role=status/toast/notification` messages without status/alert/progress/live-region evidence.
- `loading_without_progress_or_timeout` flags loading states without announced progress or recovery.
- `dead_end_state_without_recovery` flags error/dead-end copy without a retry/back/help path.
- `empty_state_without_next_step` flags empty states with no visible labeled action.

Screen maps now preserve `aria-live` and `aria-labelledby` metadata so these findings can cite concrete DOM/a11y evidence.

### Checkpoint: Dialog And Popover Escape Detectors

Added deterministic modal/popover detector coverage:

- `dialog_close_unavailable` flags visible dialogs that have no enabled close, dismiss, cancel, done, or back action in the screen map.
- `modal_trap_without_escape` flags modal-like dialogs with `aria-modal`, native dialog, or modal metadata but no visible escape action.
- `popover_blocks_primary_action` flags popover-like foreground layers whose bbox overlaps the scenario primary CTA.
- `tooltip_blocks_trigger` flags tooltip-like foreground layers whose bbox overlaps an interactive trigger target.
- `hover_content_blocks_trigger` is emitted from pointer-trace evidence when hover content appears during cursor approach and intercepts the final trigger hit-test.
- `sticky_layer_hides_content` flags fixed or sticky layers whose bbox overlaps page content or controls outside the layer subtree.

Screen maps now preserve `aria-modal` metadata. These checks use role/data-ux-role, visible action labels, and bbox intersection evidence; they do not click or infer hidden behavior.

### Checkpoint: Graph/DAG Screen-Map Detectors

Added graph/DAG detector coverage that only runs when `visual_anomaly_contract.graph_dag.enabled: true` and graph surface evidence exists:

- `graph_control_not_discoverable` flags graph surfaces without visible zoom, fit, reset, pan, layout, or related graph controls.
- `node_label_truncated` flags graph/DAG node labels whose screen-map text is clipped.
- `selected_path_not_traceable` flags selected-path evidence that lacks enough node/edge evidence to reconstruct the path.
- `edge_crosses_critical_label` flags graph edge bboxes intersecting critical graph label bboxes.

These checks use `data-ux-role`, SVG/canvas tags, bbox intersection, and text truncation evidence rather than visual AI.

### Checkpoint: High-Priority Detector Demo Pair

Added a second broken/fixed demo pair for the first high-priority static detector batch:

- `demo/high-priority-broken.html` intentionally exercises `click_target_too_small`, `visible_label_not_in_accessible_name`, `looks_clickable_but_not_actionable`, and `destructive_action_without_confirmation`.
- `demo/high-priority-fixed.html` fixes the same UI by using standard target sizes, aligned visible/accessibility labels, real actionable affordances, and confirmation/undo copy for the destructive control.
- `demo/scenarios/high-priority-detectors.yaml` lists those detector ids as explicit fail conditions.
- `npm run demo:verify` now checks exact fail/pass verdicts for the original empty-state pair and the high-priority detector pair, then reads the broken high-priority report to confirm the intended detector findings include concrete evidence.

### Checkpoint: UX Rule Profile Scenario Contract

Added `ux_rule_profile` as first-class scenario metadata:

- `parseScenarioText` now preserves `enabled`, `rule_sets`, and `require_rule_mapping`.
- `demo/scenarios/professional-agentic-ui-audit.yaml` declares the professional rule sets: Nielsen, WCAG 2.2 interaction, motion accessibility, Gestalt grouping, interaction laws, and graph/DAG readability.
- Markdown reports render the enabled rule profile so reviewers can confirm the intended UX review lens alongside enriched detector rule metadata.

### Checkpoint: Interactive Demo Artifact Gate

Extended demo verification so interactive evidence is part of the automated local gate:

- `npm run demo:verify` now runs `demo/scenarios/interactive-dag-clarity.yaml` with `--interactive --max-actions 10 --settle-ms 100`.
- Added `demo/interactive-skip.html` and `demo/scenarios/interactive-skip.yaml` to force a stale-target skipped action after a safe click changes the UI.
- The verifier reads `action-trace.json`, `state-graph.json`, `anomalies.json`, and `contact-sheet.html` instead of trusting stdout alone.
- It asserts planner metadata, safe-click decisions, click-candidate decisions, before/after screenshots, visual diffs, DOM diffs, accessibility diffs, and pointer traces for recorded actions.
- It separately asserts skipped actions include a skip reason, before/after screenshots, visual diff, screen map, DOM/a11y diffs, state graph edges, and contact-sheet skip evidence.
- It checks state graph nodes/edges and contact-sheet review surface text so the demo gate proves the local artifacts are reconstructable by a human reviewer.

### Checkpoint: Agentic Benign State Demo Gate

Added a deterministic demo gate for planner continuation across benign UI state changes:

- Added `demo/interactive-agentic-states.html` with safe controls for a primary CTA, tab, menu trigger, help trigger, accordion, and a safe control that appears only after the first state change.
- Added `demo/scenarios/interactive-agentic-states.yaml` with `interactive_exploration.mode: agentic`, safe scenario click opt-in, and explicit fail conditions for missing feedback or unrelated state changes.
- Routed `/interactive-agentic-states` through the demo server.
- Extended `npm run demo:verify` to assert agentic planner mode, at least six actions, at least six clicked actions, expected target categories, state-graph edges, and DOM diff text for each benign state change.

### Checkpoint: Agentic Replanning For Discovered Controls

Added bounded depth replanning on top of the existing safe-click policy:

- After an agentic action changes the state fingerprint, the runner can recollect visible targets and append newly discovered controls while `max_actions`, `max_depth`, `max_clicks`, and `max_state_changes` still have room.
- Replanning filters out already planned target ids and state keys so repeated identical controls are not explored endlessly.
- Dynamic click candidates are merged into `action-trace.json`, preserving explicit allow/skip decisions for discovered controls.
- `demo/scenarios/interactive-agentic-states.yaml` now proves a depth-1 discovered control is clicked and evidenced by DOM diff text.

### Checkpoint: Interactive Motion Demo Gate

Added a deterministic demo gate for opt-in motion audit evidence:

- Added `demo/interactive-motion.html`, an intentionally failing primary CTA motion fixture with reduced-motion-ignoring transition evidence.
- Added `demo/scenarios/interactive-motion.yaml` with `animation_audit.enabled: true`, scenario-approved safe clicking, reduced-motion comparison, and explicit motion fail conditions.
- Routed `/interactive-motion` through the demo server.
- Extended `npm run demo:verify` to assert the failing motion report includes the expected motion detectors, `actions/a001-animation-trace.json` exists, action trace finding detectors are attached to the action, `state-graph.json` links the animation trace, contact sheet animation evidence is visible, and DOM diff text proves the safe click produced feedback.

### Checkpoint: Contact Sheet Reviewer Answer Matrix

Upgraded the static contact sheet review surface:

- Added a reviewer answer matrix that summarizes each action in terms of what the agent did, what it clicked or avoided, what changed, which artifacts support the result, and which UX rule/fix/regression check applies.
- Kept the matrix fully local and linked to existing before/after/diff, DOM diff, accessibility diff, pointer trace, and animation trace artifacts.
- Extended `npm run demo:verify` so interactive demo runs require the matrix headings in `contact-sheet.html`.

### Checkpoint: Navigation Stop Demo Gate

Added a deterministic demo gate for the default scenario-driven navigation safety policy:

- Added `demo/interactive-navigation-stop.html`, where the first safe-looking primary CTA changes the URL and a second safe control remains in the original page.
- Added `demo/scenarios/interactive-navigation-stop.yaml` with scenario-approved safe clicking but `allow_navigation: false`.
- Routed `/interactive-navigation-stop` through the demo server.
- Extended `npm run demo:verify` to assert the run performs exactly one clicked action, records a URL-changing action, keeps the navigation capability disabled, stops remaining planned actions, and exposes the navigation stop note in the report, action trace, and contact sheet.

### Checkpoint: Navigation Allow Demo Gate

Added the explicit opt-in counterpart for scenario-driven navigation:

- Added `demo/interactive-navigation-allow.html` and `demo/interactive-navigation-allow-next.html`, where the first safe CTA changes the URL and the destination page exposes a new safe CTA.
- Added `demo/scenarios/interactive-navigation-allow.yaml` with `mode: agentic`, safe clicking enabled, and `allow_navigation: true`.
- Routed `/interactive-navigation-allow` and `/interactive-navigation-allow-next` through the demo server.
- Extended `npm run demo:verify` to assert the run keeps `navigation: true`, records a URL-changing action, performs two clicked actions, replans onto the destination page, and avoids the navigation stop note.

### Checkpoint: Hover Block Pointer Demo Gate

Added a deterministic demo gate for pointer-path hover blockers:

- Added `demo/interactive-hover-block.html`, where hovering the primary CTA opens foreground content directly over the trigger.
- Added `demo/scenarios/interactive-hover-block.yaml` with safe clicking enabled and fail conditions for `hover_content_blocks_trigger`, `hover_trigger_blocks_target`, `cursor_target_drift`, and `overlay_appeared_during_cursor_approach`.
- Routed `/interactive-hover-block` through the demo server.
- Extended `npm run demo:verify` to assert the run records pointer trace evidence with `overlayAppearedDuringApproach: true` and `finalHitTestMatchedTarget: false`, skips the safe click with `cursor target drift`, attaches the hover detector ids to the action, and exposes the pointer evidence in the report and contact sheet.

### Checkpoint: Feedback Recovery Demo Gate

Added a broken/fixed demo pair for feedback and recovery detectors:

- Added `demo/feedback-recovery-broken.html`, which intentionally lacks a visible next step, recovery action, loading/live announcement, dialog name, and dialog escape path.
- Added `demo/feedback-recovery-fixed.html`, which provides a visible next step, retry/help recovery, announced status, accessible dialog naming, and close controls.
- Added `demo/scenarios/feedback-recovery.yaml` with explicit fail conditions for `empty_state_without_next_step`, `dead_end_state_without_recovery`, `loading_without_progress_or_timeout`, `status_change_not_announced`, `dialog_without_accessible_name`, `dialog_close_unavailable`, and `modal_trap_without_escape`.
- Routed `/feedback-recovery-broken` and `/feedback-recovery-fixed` through the demo server.
- Extended `npm run demo:verify` to assert exact fail/pass verdicts and concrete report evidence for the intended feedback and recovery detectors.

### Checkpoint: Target Movement Pointer Regression

Added a focused browser regression for pointer-path target movement evidence:

- Added an interactive fixture where a safe button shifts horizontally during cursor approach while the final hit-test still lands on the target.
- Asserted `target_moved_during_cursor_approach` appears in action-linked findings.
- Asserted `a001-pointer-trace.json` records `targetMovedDuringApproach: true`, `finalHitTestMatchedTarget: true`, and the before/after target bbox movement.

### Checkpoint: Planner Semantic Deduplication

Tightened repeated-target planning so visually identical controls are not collapsed when their semantic action differs:

- Included `data-ux-action` and `href` in the planner state key used to avoid repeated target exploration.
- Preserved deduplication for genuinely identical same-label/same-bbox targets.
- Added a planner regression proving same-label/same-bbox targets with different `data-ux-action` or `href` identities are all planned.

### Checkpoint: Reduced-Motion Opt-In Regression

Added a runtime regression for the motion audit opt-in boundary:

- Verified animation traces are still written when `animation_audit.enabled: true`.
- Verified `compare_reduced_motion: false` leaves `reducedMotion` evidence absent and `reducedMotionStillAnimating: false`.
- Verified `animation_ignores_reduced_motion` is not emitted unless reduced-motion comparison is explicitly enabled.
