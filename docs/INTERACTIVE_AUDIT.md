# Interactive Audit

`ux-sentinel` can run an interactive audit for UI states that are hard to judge from a single static screenshot: DAGs, graph canvases, hover panels, floating overlays, tab layouts, timelines, cards, and dense detail panes.

Interactive audit is currently a `main` development feature. It is not part of the GitHub `v0.1.0` stable path unless it is released later.

Interactive audit is still local-first and deterministic. It uses Playwright to move the mouse, hover targets, focus keyboard targets, scroll containers, capture before/after evidence, and run rule-based visual anomaly checks. It does not require an external LLM or vision API.

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

`--max-actions <n>` limits the number of hover/focus/click/scroll actions. `--settle-ms <ms>` controls how long the page settles after hover, focus, click, and scroll. For scenario-driven `run --interactive`, clicking requires `interactive_exploration.click_all_safe_controls: true`.

## Artifacts

Interactive runs write under `.ux-sentinel/traces/<timestamp>/`:

- `baseline.png`
- `screen-map.json`
- `screen-map.html`
- `accessibility.json`
- `action-trace.json`
- `anomalies.json`
- `contact-sheet.html`
- `actions/a001-before.png`
- `actions/a001-after.png`
- `actions/a001-screen-map.json`

The contact sheet is the fastest human review surface: each action shows the target, bbox, before/after screenshots, and finding detectors linked to that action.

Interactive audit always captures before/after screenshots so `contact-sheet.html` remains evidence-backed. If a scenario sets `screenshot_before_after_each_action: false`, ux-sentinel keeps the field for compatibility but records a note and still writes screenshots.

Skipped actions are represented in `action-trace.json` and `contact-sheet.html` with a clear skip reason. A target can be skipped when it disappears, detaches, becomes invisible, moves offscreen, or a previous action changed the page.

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
```

## Detectors

Interactive anomaly detectors include:

- `click_target_blocked_by_overlay`
- `floating_panel_overlaps_primary_action`
- `tooltip_partially_offscreen`
- `text_occluded_by_graph_edge`
- `edge_label_crosses_node`
- `card_content_clipped`
- `card_overlap`
- `dag_canvas_excessive_unused_space`
- `empty_dag_column_without_explanation`

These are geometry and DOM/layout heuristics. They are meant to produce inspectable evidence, not taste judgments.

## Limits

- This is not a full autonomous browser agent.
- It does not type into forms or perform destructive actions.
- Standalone `explore` does not click by default; clicking requires `--click-safe`.
- Scenario-driven clicking requires `interactive_exploration.click_all_safe_controls: true`.
- It does not use visual AI by default.
- Graph and DAG checks are bbox heuristics; humans should review `contact-sheet.html` before treating a finding as final.
