# Progress

This file tracks checkpoints while building `ux-sentinel`.

## 2026-07-01

### Checkpoint: Project Docs Bootstrap

Status: done

Created the initial project guidance documents:

- `AGENTS.md`
- `docs/PRODUCT_BRIEF.md`
- `docs/MVP_SPEC.md`
- `docs/LAUNCH_PLAN.md`
- `docs/DECISIONS.md`
- `docs/PROGRESS.md`

Captured the MVP as a local CLI with five required commands:

- `ux-sentinel init`
- `ux-sentinel observe --url <url>`
- `ux-sentinel run <scenario.yaml> --url <url>`
- `ux-sentinel ingest-feedback <feedback.md>`
- `ux-sentinel codex-brief <report.md>`

Recorded the out-of-scope list: no SaaS dashboard, login, payments, cloud runner, complex database, Chrome extension, fully autonomous browser agent, required external LLM API, Figma integration, or enterprise QA platform.

### Next Checkpoint

Implement the CLI scaffold and `ux-sentinel init` using `docs/MVP_SPEC.md` as the contract.

### Checkpoint: Codex Start Prompt

Status: done

Added `docs/CODEX_START_PROMPT.md` with the first-message prompt for a fresh Codex session.

Updated `docs/PRODUCT_BRIEF.md` with the third user-provided context block and clarified that the product brief is background context, while `docs/MVP_SPEC.md` and `AGENTS.md` carry the implementation contract and engineering rules.

### Checkpoint: TypeScript CLI MVP Implementation

Implemented the local TypeScript CLI package with:

- `ux-sentinel init`
- `ux-sentinel observe --url <url>`
- `ux-sentinel run <scenario.yaml> --url <url>`
- `ux-sentinel ingest-feedback <file>`
- `ux-sentinel codex-brief <report>`

Implemented Playwright evidence collection for screenshot, `screen-map.json`, `screen-map.html`, accessibility snapshot, console errors, and network 4xx/5xx.

Implemented rule-based detectors for primary CTA missing, icon-only primary CTA, empty state without CTA, DOM-visible but human-invisible controls, below-fold CTA, horizontal scroll, console errors, network 5xx, and important text truncation.

Added the broken/fixed dashboard demo fixture and `npm run demo:verify`, which expects the broken page to fail and the fixed page to pass.

Added README, LICENSE, CONTRIBUTING, and sample feedback fixture.

### Checkpoint: MVP Verification

Status: done

Verified the MVP completion gates:

- `npm install` completed successfully with 0 vulnerabilities reported.
- `npm run build` passed.
- `npm test` passed with 5 test files and 9 tests.
- `node dist/cli.js init` created `.ux-sentinel` config, scenario, persona, feedback, report, and trace folders.
- `node dist/cli.js observe --url <demo file URL>` created screenshot, `screen-map.json`, `screen-map.html`, `accessibility.json`, and `observer-report.md`.
- `node dist/cli.js ingest-feedback demo/feedback/dashboard-empty-state.md` created distilled YAML feedback.
- `node dist/cli.js codex-brief <failing report>` created a Codex patch brief.
- `npm run demo:verify` passed: the broken demo exited with fail and the fixed demo exited with pass.

### Checkpoint: GitHub Publish Preparation

Status: done

Updated the top of `README.md` to lead with the product's most important GitHub-facing message:

> DOM says pass. Humans say “what do I click?”

Prepared package metadata for the public GitHub repository `jk06095-lang/ux-sentinel`.

Re-verified before publish:

- `npm run build` passed.
- `npm test` passed with 5 test files and 9 tests.
- `npm run demo:verify` passed with broken demo failing and fixed demo passing.

### Checkpoint: GitHub Publish

Status: done

Published the repository to GitHub:

- https://github.com/jk06095-lang/ux-sentinel
- default branch: `main`
- initial MVP commit: `dd4307f`
