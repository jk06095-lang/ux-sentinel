# UX Sentinel Report

## Scenario
- id: onboarding-empty-state
- title: First-time user sees clear next action
- url: http://127.0.0.1:4173/broken
- persona: first-time-user
- viewport: 1280x720

## Verdict
- result: fail
- functional issues: 0
- perception mismatch issues: 4

## Evidence
- screenshot: .ux-sentinel/traces/<timestamp>/screenshot.png
- screen-map: .ux-sentinel/traces/<timestamp>/screen-map.json
- html overlay: .ux-sentinel/traces/<timestamp>/screen-map.html
- accessibility snapshot: .ux-sentinel/traces/<timestamp>/accessibility.json
- console errors: 0
- network errors: 0

## Findings

### UX-001: No visible primary CTA matches the scenario intent
- Severity: P1
- Type: Perception Mismatch
- Detector: primary_cta_missing
- Evidence: Scenario intent "create_project" expects one of: Create first project, Create project, New project.
- User impact: A human can see the page but cannot identify the primary next action from visible copy.
- Suggested fix: Add a visually prominent button or link with explicit text such as the preferred scenario label.
- Regression check: Run the same scenario and confirm a visible primary CTA is detected above the fold.

### UX-002: Primary CTA is only communicated through an icon or hidden label
- Severity: P1
- Type: Perception Mismatch
- Detector: primary_cta_icon_only
- Evidence: The button has visible text "+" and aria-label "Create first project".
- User impact: The DOM and accessibility tree expose the action, but the visible screen does not make the action legible.
- Suggested fix: Use visible CTA copy next to or instead of the icon, for example "Create first project".
- Regression check: Confirm the CTA has visible text, not only an aria-label or icon glyph.

### UX-003: Empty state has no visible primary CTA
- Severity: P1
- Type: Perception Mismatch
- Detector: empty_state_without_cta
- Evidence: Visible page text looks like an empty state: "No projects yet".
- User impact: A first-time user reaches an empty page but does not get an obvious next step.
- Suggested fix: Pair the empty-state explanation with a visible primary CTA that matches the scenario intent.
- Regression check: Run the empty-state scenario and confirm the report has no blocking empty-state CTA finding.

## Codex Patch Brief

Patch the UI so the scenario goal is human-visible: Create the first project.

Required behavior:
- Add a visually prominent button or link with explicit text such as "Create first project".
- Do not rely on the "+" icon or aria-label alone for the primary action.
- Pair the empty-state explanation with a visible primary CTA.
