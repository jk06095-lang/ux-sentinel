# Agentic Interactive Codex Brief Example

## Goal

Fix evidence-backed perception mismatches from an agentic interactive audit without changing the scenario, weakening safety policy, or hiding detector output.

## Evidence To Inspect

- report: `.ux-sentinel/reports/professional-agentic-ui-audit-<timestamp>.md`
- contact sheet: `.ux-sentinel/traces/<timestamp>/contact-sheet.html`
- action trace: `.ux-sentinel/traces/<timestamp>/action-trace.json`
- state graph: `.ux-sentinel/traces/<timestamp>/state-graph.json`
- screen map: `.ux-sentinel/traces/<timestamp>/screen-map.json`
- visual diff: `.ux-sentinel/traces/<timestamp>/actions/a001-diff.png`
- DOM diff: `.ux-sentinel/traces/<timestamp>/actions/a001-dom-diff.json`
- accessibility diff: `.ux-sentinel/traces/<timestamp>/actions/a001-a11y-diff.json`

## Findings To Address

### UX-001: Secondary action visually overpowers the primary CTA

- Severity: P2
- Detector: `secondary_action_overpowers_primary`
- UX rule: `interaction_law.visual_hierarchy`
- Evidence status: evidence-backed finding
- Evidence: The secondary command has higher `visualWeight` than the scenario's intended primary CTA.
- User impact: The visible screen may guide a first-time user toward a lower-priority action.
- Likely cause: CTA styling and layout do not establish one dominant next action.

Acceptance criteria:

- The scenario's primary CTA is the most visually prominent above-fold command.
- The secondary action remains available but reads as secondary.
- The same scenario no longer emits `primary_cta_low_visual_weight`, `multiple_primary_ctas_conflict`, or `secondary_action_overpowers_primary`.

### UX-002: Same visible label maps to different actions

- Severity: P2
- Detector: `same_label_different_actions`
- UX rule: `nielsen.consistency_standards`
- Evidence status: evidence-backed finding
- Evidence: Two controls share visible label `Open` but expose different `data-ux-action` values.
- User impact: Users cannot predict which action a repeated label will perform.
- Likely cause: Generic command copy reused across different destinations.

Acceptance criteria:

- Repeated labels either map to the same action or include visible disambiguating nouns.
- The same scenario no longer emits `same_label_different_actions`.
- The screen remains readable without relying on aria-only labels.

## Forbidden Fixes

- Do not edit the scenario to remove failing `fail_conditions`.
- Do not hide controls with CSS just to make detectors pass.
- Do not remove `data-ux-action` metadata to avoid consistency findings.
- Do not disable interactive exploration or contact sheet generation.
- Do not enable `run --interactive --click-safe`; scenario-driven clicks must use `interactive_exploration.click_all_safe_controls: true`.

## Regression Command

```bash
node dist/cli.js run demo/scenarios/professional-agentic-ui-audit.yaml --url http://127.0.0.1:4173/fixed --interactive --max-actions 20 --settle-ms 250
```

Review the newly generated report, `contact-sheet.html`, `action-trace.json`, and `state-graph.json` before claiming the UX issue is fixed. Confirm the same action-linked visual anomaly or evidence-backed finding is gone rather than hidden by a scenario change.
