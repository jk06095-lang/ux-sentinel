# AGENTS.md

## Project

This repository builds `ux-sentinel`, a local open-source CLI for detecting UX perception mismatches in AI-generated frontend apps.

## Core Product Rule

The product is not a general testing platform.

The central concept is:

A UI can be functionally operable but still fail human perception.

A perception mismatch occurs when the DOM, accessibility tree, or guided test says a feature exists, but the human-visible UI does not clearly communicate the current state, primary action, consequence, or recovery path.

## Required Reading

Before implementation, read:

1. docs/PRODUCT_BRIEF.md
2. docs/MVP_SPEC.md
3. this AGENTS.md

## Engineering Rules

- Use TypeScript.
- Use Node.js 20+.
- Use Playwright for browser evidence collection.
- Use YAML for scenario files.
- Use Markdown for reports.
- Keep the MVP local-first.
- Do not require a paid API key.
- Do not build a SaaS dashboard.
- Prefer deterministic Playwright and rule-based checks.
- Add LLM/provider integration only as a future extension point.
- Keep commands fast and understandable.
- Generate evidence artifacts that a human and Codex can inspect.

## MVP Commands

Implement:

- `ux-sentinel init`
- `ux-sentinel observe --url <url>`
- `ux-sentinel run <scenario.yaml> --url <url>`
- `ux-sentinel ingest-feedback <file>`
- `ux-sentinel codex-brief <report>`

## Required Evidence

Reports should be grounded in:

- screenshot path
- DOM-derived visible element map
- accessibility snapshot if available
- visible text
- layout signals
- console errors
- network 4xx/5xx
- scenario visual contract

## Detector Rules

Implement rule-based detectors first:

- primary_cta_missing
- primary_cta_icon_only
- empty_state_without_cta
- dom_visible_but_human_invisible
- primary_cta_below_fold
- horizontal_scroll
- console_error
- network_5xx

## MVP Demo Requirement

Create a demo with two pages:

1. Broken page:
   - dashboard empty state
   - tiny "+" icon button
   - correct aria-label such as "Create first project"
   - no visible primary CTA

2. Fixed page:
   - clear empty-state message
   - visible "Create first project" CTA

The broken page must fail with a perception mismatch.
The fixed page must pass.

## Done Means

Before claiming done, run:

- npm run build
- npm test
- demo scenario against broken page
- demo scenario against fixed page

Update README with:

- one-line pitch
- install instructions
- quickstart
- sample scenario
- sample report
- demo commands
- limitations
- roadmap

## Do Not

- Do not overbuild.
- Do not create account systems.
- Do not create cloud infrastructure.
- Do not hide failing checks to make tests pass.
- Do not make vague AI claims that are not implemented.
- Do not call external LLM APIs in core MVP.
- Do not weaken validation, security, or privacy protections.
