# Agentic Interactive Audit

Agentic interactive audit is the development path for making `ux-sentinel` inspect a UI more like a careful UX reviewer while staying local-first, deterministic, and evidence-backed.

This mode builds on the existing interactive runner. It does not introduce SaaS infrastructure, external LLM calls, visual AI, form typing, form submission, or destructive browser actions.

## Current Foundation

The current implementation adds a deterministic planning layer:

1. Collect visible interactive targets and scroll containers.
2. Classify targets into UX-relevant categories.
3. Sort by planning priority when `interactive_exploration.mode: agentic`.
4. Respect action and click budgets.
5. Record the planner decision in `action-trace.json` and `contact-sheet.html`.
6. Write `state-graph.json` plus per-action DOM and accessibility diff files so a reviewer can reconstruct the path.

The runner still uses the hardened safety policy from [SAFETY_POLICY.md](SAFETY_POLICY.md). `explore --click-safe` is the standalone opt-in for safe clicks. `run --interactive --click-safe` is intentionally not a click override; scenario-driven clicking requires `interactive_exploration.click_all_safe_controls: true`.

## Scenario Options

```yaml
interactive_exploration:
  enabled: true
  mode: agentic
  max_actions: 120
  max_depth: 2
  max_clicks: 20
  max_state_changes: 40
  hover_all_clickables: true
  focus_all_keyboard_targets: true
  scroll_containers: true
  click_all_safe_controls: true
  allow_navigation: false
  settle_ms: 350
```

## Target Categories

The target classifier currently recognizes:

- `primary_cta`
- `secondary_cta`
- `navigation`
- `tab`
- `menu`
- `dropdown`
- `dialog_trigger`
- `tooltip_help_trigger`
- `card`
- `expandable_section`
- `graph_dag_node`
- `graph_dag_control`
- `form_adjacent_control`
- `scroll_container`
- `ambiguous_clickable`

The planner prioritizes primary CTAs first, then tabs/menus/navigation, help and disclosure controls, cards and dense regions, graph/DAG targets, scroll containers, and finally ambiguous targets.

## Evidence

Each action record includes:

- `plannedReason`
- `targetCategory`
- `riskLevel`
- `planDepth`
- `planPriority`
- `plannedSafeClick`
- `clickDecision`
- `clickDecisionReason`

The action trace also includes a root `planner` object with the selected mode and action/click/depth/state-change budgets.

`state-graph.json` includes:

- state nodes with URL, viewport, screenshot, screen map path, accessibility hash, visible text hash, DOM structure hash, open UI state, console error count, and network error count
- action edges with action id, action type, target id, target category, before/after state ids, before/after screenshots, DOM diff path, accessibility diff path, and finding detectors

## Current Limits

This is the planner foundation, not the full professional audit surface yet. Upcoming work should add:

- visual diffs
- real pointer traces
- UX rule registry mappings
- expanded detector batches
- animation audit
- contact sheet 2.0 filters and timelines
