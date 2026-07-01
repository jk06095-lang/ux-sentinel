# ux-sentinel

DOM says pass. Humans say “what do I click?”

ux-sentinel is a local CLI that detects perception mismatches in AI-generated frontends: cases where the DOM, accessibility tree, or guided test says a feature exists, but the human-visible UI does not clearly communicate the next action.

It collects screenshots, visible text, DOM/accessibility evidence, layout signals, console errors, and network failures, then generates a report and a Codex-ready patch brief.

## Why this exists

AI-built UIs can pass DOM tests while still failing the person looking at the screen. `ux-sentinel` checks the visible next action, empty-state guidance, layout signals, console errors, and network failures so the report points to the human-facing UX problem, not just the selector that exists.

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

Initialize UX Sentinel config in a project:

```bash
node dist/cli.js init
```

Observe a page without a scenario:

```bash
node dist/cli.js observe --url http://127.0.0.1:4173/fixed
```

Run a visual-contract scenario:

```bash
node dist/cli.js run demo/scenarios/onboarding-empty-state.yaml --url http://127.0.0.1:4173/broken
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
- `ux-sentinel run <scenario.yaml> --url <url>`
- `ux-sentinel ingest-feedback <file>`
- `ux-sentinel codex-brief <report>`

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

## Sample Report Output

```markdown
# UX Sentinel Report

## Verdict
- result: fail
- functional issues: 0
- perception mismatch issues: 4

## Findings

### UX-001: No visible primary CTA matches the scenario intent
- Severity: P1
- Type: Perception Mismatch
- Detector: primary_cta_missing
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

Run the full demo gate:

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
```

## Evidence Artifacts

Each observation/run writes local artifacts under `.ux-sentinel/traces/<timestamp>/`:

- `screenshot.png`
- `screen-map.json`
- `screen-map.html`
- `accessibility.json`
- `observer-report.md` for `observe`

Scenario reports are written under `.ux-sentinel/reports/`. Codex patch briefs are written under `.ux-sentinel/briefs/`.

The demo generates screenshots automatically as `.ux-sentinel/traces/<timestamp>/screenshot.png`; these local runtime artifacts are ignored by git.

## Current Detectors

- `primary_cta_missing`
- `primary_cta_icon_only`
- `empty_state_without_cta`
- `dom_visible_but_human_invisible`
- `primary_cta_below_fold`
- `horizontal_scroll`
- `console_error`
- `network_5xx`
- `important_text_truncated`

## Limitations

- This MVP uses deterministic DOM, layout, accessibility, console, and network evidence. It does not use a visual AI model.
- It does not call external LLM APIs.
- It is not a SaaS dashboard, cloud runner, account system, database, Chrome extension, or enterprise QA platform.
- Detector heuristics are intentionally small and explainable.
- The first visual contract focuses on clear primary CTA and empty-state perception.

## Roadmap

- More visual-contract detectors for disabled recovery, confusing hierarchy, and copy/consequence mismatch.
- Scenario action steps beyond initial observation.
- Optional provider hooks for teams that want LLM-assisted feedback distillation.
- Richer screen-map overlay controls.
- Package publishing workflow after the MVP stabilizes.
