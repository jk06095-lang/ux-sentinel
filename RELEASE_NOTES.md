# ux-sentinel v0.1.0

DOM says pass. Humans say "what do I click?"

`ux-sentinel` is a local CLI that detects perception mismatches in AI-generated frontend UIs: cases where the DOM, accessibility tree, or guided test says an action exists, but the human-visible UI does not clearly communicate the next action.

## Highlights

- Local TypeScript CLI for frontend UX checks.
- Playwright evidence capture.
- Screenshot, DOM map, accessibility snapshot, visible text, layout, console, and network artifacts.
- Rule-based perception mismatch detectors.
- Broken/fixed empty-dashboard demo.
- Markdown UX reports.
- Codex-ready patch briefs.
- No-install Codex usage through GitHub `npm exec`.
- Copy-paste Codex magic prompt.

## Try It With Codex

Paste the prompt from:

- `docs/CODEX_MAGIC_PROMPT.md`

Or run the stable GitHub package path from a target frontend repo:

```bash
npm exec --yes --package=github:jk06095-lang/ux-sentinel#v0.1.0 -- ux-sentinel init
npm exec --yes --package=github:jk06095-lang/ux-sentinel#v0.1.0 -- ux-sentinel run .ux-sentinel/scenarios/onboarding-empty-state.yaml --url http://localhost:3000
```

## Demo

```bash
npm install
npm run build
npm run demo:verify
```

The demo verifies:

- broken dashboard empty state: fails with a perception mismatch
- fixed dashboard empty state: passes the same scenario

## Current Limitations

- Not published to the npm registry yet.
- Not a SaaS.
- Not a replacement for human UX research.
- No required external LLM API.
- Detector heuristics are intentionally small.
- The default scenario focuses on onboarding and empty-state next-action clarity.

## Non-Goals

- SaaS dashboard
- account system
- hosted cloud runner
- payment
- Figma integration
- full autonomous browser agent
- enterprise QA platform
- Chrome extension
- required external LLM API

## Verification

Before creating the release, run:

```bash
npm run build
npm test
npm run demo:verify
npm pack --dry-run
```

## Release Notes For Maintainers

`v0.1.0` is intended to be a GitHub-only release first. npm publishing is deferred until after early user feedback on the GitHub `npm exec` flow.
