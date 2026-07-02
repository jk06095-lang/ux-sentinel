# Interactive Audit

`ux-sentinel` can run an interactive audit for UI states that are hard to judge from a single static screenshot: DAGs, graph canvases, hover panels, floating overlays, tab layouts, timelines, cards, and dense detail panes.

Interactive audit is currently a `main` development feature. It is not part of the GitHub `v0.1.0` stable path unless it is released later.

Interactive audit is still local-first and deterministic. It uses Playwright to move the mouse, hover targets, focus keyboard targets, scroll containers, capture before/after evidence, and run rule-based visual anomaly checks. It does not require an external LLM or vision API.

Safety policy details live in [SAFETY_POLICY.md](SAFETY_POLICY.md). The runner resolves a capability policy before acting: observe, hover, focus, and scroll are enabled by default; safe clicks are disabled unless enabled by the correct command or scenario path; typing, form submission, and destructive actions remain disabled.

Agentic planning details live in [AGENTIC_INTERACTIVE_AUDIT.md](AGENTIC_INTERACTIVE_AUDIT.md). When a scenario sets `interactive_exploration.mode: agentic`, ux-sentinel classifies targets, prioritizes meaningful UX exploration, and records `plannedReason`, `targetCategory`, and `riskLevel` in the action trace.

UX rule mappings live in [UX_RULE_REGISTRY.md](UX_RULE_REGISTRY.md). Reports include `Why this matters` text so detector output is tied to professional UX principles instead of only detector names.

Optional motion checks live in [MOTION_AUDIT.md](MOTION_AUDIT.md). Motion audit is disabled by default and only runs when a scenario sets `animation_audit.enabled: true`.

## Commands

Explore a page without a scenario:

```bash
ux-sentinel explore --url http://localhost:3000 --max-actions 40 --settle-ms 350
```

Standalone `explore` defaults to hover, focus, and scroll only. It does not click safe controls unless explicitly enabled:

```bash
ux-sentinel explore --url http://localhost:3000 --max-actions 40 --settle-ms 350 --click-safe
```

Run a scenario with interactive exploration:

```bash
ux-sentinel run demo/scenarios/interactive-dag-clarity.yaml --url http://localhost:3000 --interactive
```

`--max-actions <n>` limits the number of hover/focus/click/scroll actions. `--settle-ms <ms>` controls how long the page settles after hover, focus, click, and scroll. `--click-safe` is standalone `explore` only; for scenario-driven `run --interactive`, clicking requires `interactive_exploration.click_all_safe_controls: true`.

## Artifacts

Interactive runs write under `.ux-sentinel/traces/<timestamp>/`:

- `baseline.png`
- `screen-map.json`
- `screen-map.html`
- `accessibility.json`
- `action-trace.json`
- `state-graph.json`
- `anomalies.json`
- `contact-sheet.html`
- `actions/a001-before.png`
- `actions/a001-after.png`
- `actions/a001-diff.png`
- `actions/a001-screen-map.json`
- `actions/a001-dom-diff.json`
- `actions/a001-a11y-diff.json`
- `actions/a001-pointer-trace.json`
- `actions/a001-animation-trace.json` when `animation_audit.enabled: true`

The contact sheet is the fastest human review surface: each action shows the target, bbox, before/after/diff screenshots, pointer trace path, pointer movement metadata, optional animation trace path, and finding detectors linked to that action. It also includes severity, detector, and rule-family filters; an action timeline; state graph summary; a safety log that lists before/after/diff/screen-map evidence paths for each action; accessibility cross-check; animation audit section; bbox overlays; and UX principle mapping for evidence-backed findings. Per-action and global finding rows include the concrete evidence, user impact, suggested fix, and regression check so the sheet can drive repairs without opening the Markdown report first.

Interactive audit always captures before/after screenshots so `contact-sheet.html` remains evidence-backed. If a scenario sets `screenshot_before_after_each_action: false`, ux-sentinel keeps the field for compatibility but records a note and still writes screenshots.

Skipped actions are represented in `action-trace.json` and `contact-sheet.html` with a clear skip reason. A target can be skipped when it disappears, detaches, becomes invisible, moves offscreen, when pointer approach reveals an overlay, or when the final hit-test drifts away from the intended target. The action trace also records the resolved capability policy, planner budget, every baseline click candidate's allow/skip decision, target category, planned reason, risk level, pointer trace path, and each performed action's safe-click decision and reason. `state-graph.json` links state nodes and action edges with before/after screenshots, visual diff screenshots, DOM diff files, accessibility diff files, pointer trace files, cursor movement summaries, open dialog/menu/popover state evidence, finding detectors, and attached finding summaries with evidence, user impact, suggested fix, regression check, and UX rule metadata.

## Safe Target Collection

The explorer collects visible targets from:

- `button`
- `a`
- `input`
- `select`
- `textarea`
- `summary`
- `role=button/link/tab/menuitem/switch/checkbox/radio`
- elements with `tabindex`
- elements with `data-ux-role`

It avoids dangerous clicks by visible text, aria-label, or title. Defaults include destructive and account/payment terms such as `Delete`, `Remove`, `Pay`, `Purchase`, `Logout`, and `Sign out`.

`data-ux-role` is analysis metadata by default. A `data-ux-role` element is collected for hover and layout analysis, but it is not safe to click unless it is also a native interactive control, has an interactive role such as `role=button`, has `data-ux-clickable="true"`, or has `data-ux-action`.

## Scenario Extension

```yaml
interactive_exploration:
  enabled: true
  max_actions: 80
  hover_all_clickables: true
  # Default is false. Set true only when this scenario safely opts into clicks.
  click_all_safe_controls: true
  focus_all_keyboard_targets: true
  scroll_containers: true
  # Kept for schema compatibility; screenshots are always captured.
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

## Detectors

Interactive anomaly detectors include:

- `click_target_blocked_by_overlay`
- `click_target_too_small`
- `click_target_spacing_too_tight`
- `clickable_without_visible_affordance`
- `looks_clickable_but_not_actionable`
- `target_moved_during_cursor_approach`
- `overlay_appeared_during_cursor_approach`
- `hover_trigger_blocks_target`
- `cursor_target_drift`
- `focus_ring_missing`
- `focus_obscured_by_author_content`
- `focus_order_unexpected_jump`
- `focus_caused_context_change`
- `keyboard_target_not_reachable`
- `visible_label_not_in_accessible_name`
- `icon_button_without_visible_label`
- `aria_label_contradicts_visible_text`
- `status_change_not_announced`
- `dialog_without_accessible_name`
- `no_feedback_after_action`
- `safe_click_changed_unrelated_state`
- `loading_without_progress_or_timeout`
- `dead_end_state_without_recovery`
- `empty_state_without_next_step`
- `dialog_close_unavailable`
- `modal_trap_without_escape`
- `destructive_action_without_confirmation`
- `important_text_below_fold_without_cue`
- `primary_cta_low_visual_weight`
- `multiple_primary_ctas_conflict`
- `secondary_action_overpowers_primary`
- `same_label_different_actions`
- `same_action_different_labels`
- `floating_panel_overlaps_primary_action`
- `popover_blocks_primary_action`
- `tooltip_partially_offscreen`
- `tooltip_blocks_trigger`
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
- `animation_ignores_reduced_motion`
- `animation_hides_critical_action`
- `animation_duration_blocks_task`
- `animation_causes_layout_shift`
- `animation_uses_layout_paint_properties`
- `animation_jank_detected`
- `inconsistent_motion_tokens`

These are geometry, DOM/layout, label/action consistency, visual-hierarchy, graph/DAG metadata, status/recovery, focus-style, hit-test, and state-diff heuristics. They are meant to produce inspectable evidence, not taste judgments. Static graph/DAG screen-map detectors only run when `visual_anomaly_contract.graph_dag.enabled: true` and graph surface evidence is present. `no_feedback_after_action` currently runs for agentic interactive audits, where action/state evidence is expected to explain whether a click changed visible state.

## Reviewing The Contact Sheet

Use `contact-sheet.html` as a local static review surface:

1. Start with the action timeline to see the route through the UI.
2. Check the safety log to see what was clicked, skipped, or refused.
3. Use the severity, detector, and rule-family filters to focus the review.
4. Compare before, after, and visual diff panels for each action.
5. Inspect bbox overlays, pointer traces, animation traces, DOM diffs, and accessibility diffs before treating a finding as final.
6. Read `Why this matters` and confidence metadata to separate evidence-backed findings from lower-confidence review prompts.

## Limits

- This is not a full autonomous browser agent.
- It does not type into forms or perform destructive actions.
- Standalone `explore` does not click by default; clicking requires `--click-safe`.
- Scenario-driven clicking requires `interactive_exploration.click_all_safe_controls: true`; `run --interactive` does not accept `--click-safe` as a one-off click override.
- The core runner records safe-click allow/skip decisions for action trace review.
- It does not use visual AI by default.
- Motion audit is opt-in and records deterministic animation traces; it does not perform video-based review.
- Graph and DAG checks are bbox heuristics; humans should review `contact-sheet.html` before treating a finding as final.
