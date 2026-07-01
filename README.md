# ux-sentinel

DOM says pass. Humans say “what do I click?”

ux-sentinel is a local CLI that detects perception mismatches in AI-generated frontends: cases where the DOM, accessibility tree, or guided test says a feature exists, but the human-visible UI does not clearly communicate the next action.

It collects screenshots, visible text, DOM/accessibility evidence, layout signals, console errors, and network failures, then generates a report and a Codex-ready patch brief.

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

You can also run the server and commands manually:

```bash
npm run demo:server
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
