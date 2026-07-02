# Codex Patch Brief

## Source
- report: .ux-sentinel/reports/onboarding-empty-state-<timestamp>.md
- scenario: onboarding-empty-state
- url: http://127.0.0.1:4173/broken
- result: fail

## Evidence Artifacts

- screenshot: `.ux-sentinel/traces/<timestamp>/screenshot.png`
- screen-map: `.ux-sentinel/traces/<timestamp>/screen-map.json`
- html overlay: `.ux-sentinel/traces/<timestamp>/screen-map.html`
- accessibility snapshot: `.ux-sentinel/traces/<timestamp>/accessibility.json`

## Goal

Fix the visible UI perception mismatch without changing the product scope.

## Findings To Address

### UX-001: No visible primary CTA matches the scenario intent
- Severity: P1
- Type: Perception Mismatch
- Evidence: The page is an empty dashboard, but no visible button says "Create first project".
- User impact: A first-time user can see the page but cannot identify the primary next action.

### UX-002: Primary CTA is only communicated through an icon or hidden label
- Severity: P1
- Type: Perception Mismatch
- Evidence: The only create control is a tiny "+" button with aria-label "Create first project".
- User impact: DOM and accessibility checks can find the action, but the visible screen does not communicate it.

## Acceptance Criteria

- The same ux-sentinel scenario passes after the UI patch.
- The empty state has a visible "Create first project" CTA.
- The primary next action is visible to a human, not only present in the DOM or accessibility tree.
- Evidence artifacts still include screenshot, screen-map.json, screen-map.html, console errors, and network errors.

## Forbidden Fixes

- Do not suppress or delete checks to make the report pass.
- Do not change scenarios, fail conditions, or visual contracts just to hide findings.
- Do not rely on aria-label alone for a primary CTA.
- Do not add SaaS, auth, database, hosted runner, Chrome extension, or required LLM API behavior.

## Suggested Regression Check

```bash
ux-sentinel run demo/scenarios/onboarding-empty-state.yaml --url http://127.0.0.1:4173/fixed
```
