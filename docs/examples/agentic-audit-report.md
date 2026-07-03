# Agentic Interactive Audit Report Example

This example shows the intended shape of an evidence-backed interactive report. Paths are illustrative; real runs write timestamped artifacts under `.ux-sentinel/traces/<timestamp>/`.

## Scenario

- id: professional-agentic-ui-audit
- url: http://127.0.0.1:4173/fixed
- persona: first-time-user
- mode: visual_contract

## Verdict

- result: ambiguous
- interactive actions: 6
- screenshots: 19
- anomalies: 3
- contact sheet: `.ux-sentinel/traces/<timestamp>/contact-sheet.html`
- state graph: `.ux-sentinel/traces/<timestamp>/state-graph.json`
- trace manifest: `.ux-sentinel/traces/<timestamp>/trace-manifest.json`

## Interactive Evidence

- baseline screenshot: `.ux-sentinel/traces/<timestamp>/baseline.png`
- baseline screen map: `.ux-sentinel/traces/<timestamp>/screen-map.json`
- accessibility snapshot: `.ux-sentinel/traces/<timestamp>/accessibility.json`
- action trace: `.ux-sentinel/traces/<timestamp>/action-trace.json`
- trace manifest: `.ux-sentinel/traces/<timestamp>/trace-manifest.json`
- action visual diff: `.ux-sentinel/traces/<timestamp>/actions/a001-diff.png`
- DOM diff: `.ux-sentinel/traces/<timestamp>/actions/a001-dom-diff.json`
- accessibility diff: `.ux-sentinel/traces/<timestamp>/actions/a001-a11y-diff.json`
- pointer trace: `.ux-sentinel/traces/<timestamp>/actions/a001-pointer-trace.json`
- animation trace: `.ux-sentinel/traces/<timestamp>/actions/a001-animation-trace.json`

## Action Summary

| Action | Type | Target | Decision | Evidence |
| --- | --- | --- | --- | --- |
| a001 | hover_click | Create first project | planner allowed; runtime allowed | before/after/diff, pointer trace, state diff |
| a002 | focus | Help | planner skipped; runtime skipped | safe_click capability disabled |
| a003 | scroll | dashboard list | not_applicable | before/after/diff |
| a004 | hover | Open details | planner allowed original target; runtime skipped live target | pre-scroll `dangerous_label_change`, before/after/diff, DOM diff, accessibility diff |

`action-trace.json`, `state-graph.json`, and `trace-manifest.json` expose both `plannerClickDecision` and `runtimeClickDecision`. Click candidates preserve original fields such as `originalVisibleText: "Open details"` and later live fields such as `latestVisibleText: "Delete project"` so the report does not imply the planner allowed a dangerous label. If an old planned id resolves to a different semantic element, the action keeps `targetIdentity.status`, `targetIdentity.plannedLabel`, `targetIdentity.liveLabel`, `targetIdentityCheckedBeforeScroll`, `targetIdentityMismatchBeforeScroll`, `skipReason`, and local evidence links instead of acting on the live element.

Target identity statuses are:

- `match`
- `benign_label_change`
- `identity_mismatch`
- `dangerous_label_change`

Animation traces expose phased samples:

- `before_interaction`
- `after_hover_immediate`
- `after_focus_immediate`
- `after_click_immediate`
- `after_settle`
- `reduced_motion_comparison` when comparison is enabled

## Findings

### UX-001: Secondary action visually overpowers the primary CTA

- Severity: P2
- Detector: `secondary_action_overpowers_primary`
- Rule family: `interaction_law`
- UX rules: `interaction_law.visual_hierarchy`
- Confidence: high
- Why this matters: Visual hierarchy should make the intended next action easier to perceive than secondary commands.
- Evidence: `secondary-heavy` has `visualWeight=0.0220`; primary CTA `primary-low` has `visualWeight=0.0022`.
- Evidence paths:
  - screen map: `.ux-sentinel/traces/<timestamp>/screen-map.json`
  - contact sheet: `.ux-sentinel/traces/<timestamp>/contact-sheet.html`
- User impact: A user may follow the visually dominant secondary command instead of the scenario's main next action.
- Suggested fix: Strengthen the primary CTA size, contrast, placement, or whitespace; demote the secondary action.
- Regression check: Rerun `ux-sentinel run demo/scenarios/professional-agentic-ui-audit.yaml --url <url> --interactive`.

### UX-002: Same visible label maps to different actions

- Severity: P2
- Detector: `same_label_different_actions`
- Rule family: `nielsen`
- UX rules: `nielsen.consistency_standards`
- Confidence: high
- Why this matters: Consistent labels help users predict command consequences.
- Evidence: label `Open` appears on controls with `data-ux-action=open-settings` and `data-ux-action=open-billing`.
- User impact: The same label can mean different destinations or consequences.
- Suggested fix: Rename the controls to `Open settings` and `Open billing`, or align the underlying action.
- Regression check: Inspect `screen-map.json` and confirm repeated labels either share one action or are visibly disambiguated.

## Review Guidance

Treat a finding as actionable only when the report links to concrete evidence: screenshot, bbox, screen map, DOM diff, accessibility diff, hit-test, pointer trace, visual diff, or animation trace. Use the contact sheet first, then inspect `trace-manifest.json` and the linked machine-readable artifacts for the exact element ids and action ids.
