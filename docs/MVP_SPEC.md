# UX Sentinel MVP Spec

## Product Name

ux-sentinel

## One-line Pitch

A local CLI that catches UI perception mismatches in AI-generated frontends: cases where the DOM says the feature exists, but a human user would not know what to click.

## Core Problem

When vibe coding UI with AI, the app may technically work, but the user experience can still be confusing, visually broken, or misaligned with human intent.

AI agents often pass a task because:

- the DOM contains the right element,
- an accessibility label reveals hidden intent,
- the scenario tells the agent the correct route or button,
- the code structure gives away the answer.

Humans rely on visible cues, layout, hierarchy, copy, affordance, and feedback.

The MVP detects this gap.

## MVP Principle

Do not build a general AI testing platform.

Build a small, local, open-source developer tool that produces evidence-rich UX QA reports and Codex-ready patch briefs.

## Target User

- Vibe coders using Codex, Cursor, Claude Code, or similar tools
- Frontend developers shipping fast UI changes
- Indie hackers and solo builders
- QA-minded developers who want lightweight checks before shipping

## Non-goals for MVP

Do not build:

- SaaS dashboard
- account system
- hosted cloud runner
- payment
- Figma integration
- full autonomous browser agent
- full visual AI model
- enterprise test management
- self-healing test platform
- Chrome extension
- complex database

## Required Tech Stack

- TypeScript
- Node.js 20+
- Playwright
- YAML scenario files
- Markdown reports
- Vitest or Node test runner
- npm or pnpm, but document the choice

The MVP must run locally.

## CLI Commands

### ux-sentinel init

Creates:

```txt
.ux-sentinel/
  UX_CONSTITUTION.md
  scenarios/
    onboarding-empty-state.yaml
  personas/
    first-time-user.yaml
  feedback/
    raw/
    distilled/
  reports/
  traces/
```

Also creates or updates:

- AGENTS.md section for UX Sentinel
- .gitignore entries for traces/reports as appropriate

### ux-sentinel observe --url <url>

Captures the current screen and produces:

- raw screenshot
- screen-map.json
- screen-map.html with overlay boxes
- observer-report.md

This command should work even without a scenario.

### ux-sentinel run <scenario.yaml> --url <url>

Runs a scenario against a URL.

Responsibilities:

- launch Chromium with Playwright
- navigate to URL + start_path if provided
- collect screenshot
- collect DOM-derived visible element map
- collect accessibility snapshot when available
- collect console errors
- collect network 4xx/5xx
- evaluate visual contract
- output report path

### ux-sentinel ingest-feedback <file>

Reads a markdown file containing user feedback and produces a distilled YAML record.

It should extract:

- raw quote
- affected journey if inferable
- pain points
- likely UX principle
- suggested scenario/check
- confidence

This can be heuristic in the MVP.

### ux-sentinel codex-brief <report>

Reads a report and outputs a Codex-ready patch brief with:

- finding id
- severity
- evidence
- likely user impact
- suspected UI cause
- acceptance criteria
- forbidden fixes
- suggested regression check

## Scenario YAML Schema

Support a minimal scenario format:

```yaml
id: onboarding-empty-state
title: First-time user sees clear next action
persona: first-time-user
mode: visual_contract
start_path: /dashboard

goal:
  user_wants: "Create the first project"
  primary_intent: "create_project"

visual_contract:
  page_must_answer:
    - "Where am I?"
    - "What can I do next?"
    - "What happens after I do it?"

  primary_cta:
    preferred_labels:
      - "Create first project"
      - "Create project"
      - "New project"
      - "첫 프로젝트 만들기"
      - "프로젝트 만들기"
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
  - important_text_truncated
```

`fail_conditions` behavior is intentional:

- If the field is absent, ux-sentinel uses the default detector list and severity-based default behavior.
- If the field is a non-empty array, the listed detectors are explicit fail conditions even when their severity would otherwise be ambiguous.
- If the field is an empty array, ux-sentinel does not replace it with defaults; it treats the scenario as having no explicit detector list and falls back to severity-based default behavior.

## Screen Map Format

Generate screen-map.json:

```json
{
  "url": "...",
  "viewport": {
    "width": 1280,
    "height": 720
  },
  "elements": [
    {
      "id": "e1",
      "tag": "button",
      "role": "button",
      "visibleText": "Create project",
      "ariaLabel": "Create first project",
      "bbox": {
        "x": 100,
        "y": 200,
        "width": 180,
        "height": 44
      },
      "clickable": true,
      "disabled": false,
      "aboveFold": true,
      "visible": true,
      "looksClickable": true,
      "hasVisibleLabel": true,
      "isIconOnly": false,
      "visualWeight": 0.82
    }
  ],
  "risks": []
}
```

## Required Detectors

### primary_cta_missing

Fail when the scenario defines a primary intent but no visible button/link-like element has a label matching preferred labels.

### primary_cta_icon_only

Fail when the most likely primary CTA has an aria-label but no visible text, especially if the visible text is only "+", icon-like, or empty.

### empty_state_without_cta

Detect likely empty state text:

- "No projects"
- "Nothing here"
- "Empty"
- "아직"
- "없습니다"
- "비어"
- "0개"

Fail if empty state appears but no primary CTA is visible.

### dom_visible_but_human_invisible

Warn when an element is clickable and has an aria-label, but its visible text is empty or icon-only.

### primary_cta_below_fold

Fail or warn when the primary CTA exists but is below the initial viewport.

### horizontal_scroll

Fail when document width exceeds viewport width significantly.

### console_error

Fail on uncaught console errors unless scenario allows them.

### network_5xx

Fail on network 5xx.

## Report Format

Generate Markdown report:

```markdown
# UX Sentinel Report

## Scenario
- id:
- url:
- persona:
- viewport:
- timestamp:

## Verdict
- result: pass / fail / ambiguous
- functional issues:
- perception mismatch issues:

## Evidence
- screenshot:
- screen-map:
- html overlay:
- console errors:
- network errors:

## Findings

### UX-001: Empty state has no visible primary CTA
- Severity: P1
- Type: Perception Mismatch
- Evidence:
- User impact:
- Suggested fix:
- Regression check:

## Codex Patch Brief
...
```

## Demo App

Create a tiny demo app or static fixture with two pages.

Broken version:

- dashboard empty state
- small "+" icon button only
- aria-label says "Create first project"
- no visible primary CTA

Fixed version:

- visible "Create first project" CTA
- clear empty-state message

The demo should prove that ux-sentinel fails the broken page and passes the fixed page.

## Tests

Add tests for:

- scenario YAML parsing
- screen map risk classification
- icon-only CTA detection
- empty state without CTA detection
- report generation
- codex brief generation

## Definition of Done

The MVP is done when:

- npm install works
- npm run build passes
- npm test passes
- ux-sentinel init creates config files
- ux-sentinel observe works against the demo page
- ux-sentinel run fails the broken demo page with a perception mismatch
- ux-sentinel run passes the fixed demo page
- ux-sentinel codex-brief produces a useful patch brief
- README includes install, quickstart, sample scenario, sample output, limitations, roadmap
- docs/LAUNCH_PLAN.md exists
- LICENSE exists
- CONTRIBUTING.md exists
