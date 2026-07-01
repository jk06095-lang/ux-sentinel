# Launch Plan

## Public README Message

```markdown
# ux-sentinel

Catch the UI bug your DOM tests miss.

`ux-sentinel` is a local CLI for AI-generated frontend UIs. It looks for perception mismatch: cases where the DOM contains a working control, but a human looking at the screen cannot tell what to do next.

Example: an empty dashboard has a tiny `+` icon button with a correct `aria-label`. Automated checks can find it. A real user still asks, "what do I click?"

## MVP

- `ux-sentinel init`
- `ux-sentinel observe --url <url>`
- `ux-sentinel run <scenario.yaml> --url <url>`
- `ux-sentinel ingest-feedback <feedback.md>`
- `ux-sentinel codex-brief <report.md>`

The first version uses Playwright, deterministic rule-based detectors, local evidence artifacts, and Markdown reports. No SaaS account, cloud runner, browser extension, or required external LLM API.
```

## Show HN Draft

```text
Show HN: ux-sentinel - a local CLI that catches "what do I click?" failures in AI-built UIs

I am building ux-sentinel, a small local CLI for frontend developers using AI-generated UI code.

The idea: DOM and accessibility checks can pass while the visible screen still fails a human. For example, a dashboard empty state may have a tiny + icon with a correct aria-label, but no visible "Create first project" CTA.

The MVP uses Playwright, rule-based detectors, and Markdown reports. No SaaS, no login, no cloud runner, no required LLM API.

I would love feedback on the detector model and the broken/fixed demo.
```

## Reddit Draft

```text
I am building a local CLI that checks AI-generated frontend UIs for perception mismatch.

The failure mode: the DOM has a valid button, tests can click it, accessibility metadata exists, but a person looking at the screen still cannot tell what to do next.

The MVP is intentionally small:
- Playwright evidence capture
- rule-based detectors
- Markdown reports
- Codex patch briefs

No SaaS dashboard, no accounts, no cloud runner, no Chrome extension.

The first demo is an empty dashboard where the broken version only has a tiny + icon, and the fixed version has a visible "Create first project" CTA.
```

## X Drafts

```text
DOM tests can pass while the UI still fails the human.

I am building ux-sentinel: a local CLI that catches "what do I click?" failures in AI-generated frontend UIs.

Playwright + rule detectors + Markdown reports. No SaaS, no login, no cloud runner.
```

```text
New project: ux-sentinel.

It looks for perception mismatch in frontend UI:

"The button exists in the DOM" is not the same as "a human knows what to click."

MVP: local CLI, Playwright evidence, rule-based detectors, Codex-ready patch briefs.
```

## Broken Demo Scenario

Screen: dashboard empty state.

Broken UI:

- Page title says `Projects`.
- Empty area says little or nothing.
- Primary create control is only a tiny `+` icon button in the corner.
- Button has a correct `aria-label="Create project"`.
- DOM tests and accessibility lookup can find it.
- Human next action is unclear.

Expected `ux-sentinel` result:

- Fail.
- Finding from `aria-only-action`.
- Finding from `empty-state-primary-cta`.
- Report explains that accessible metadata is not enough because the primary action is not visually legible.

## Fixed Demo Scenario

Screen: same dashboard empty state.

Fixed UI:

- Page title says `Projects`.
- Empty state explains `No projects yet`.
- Visible primary CTA says `Create first project`.
- Optional secondary text explains what happens next.

Expected `ux-sentinel` result:

- Pass, or no blocking findings.
- Report confirms that the next action is visible, labeled, and aligned with the scenario goal.
