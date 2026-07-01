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

### Checkpoint: GitHub Launch Audit

Status: done

Audited the repository against the public launch checklist.

README launch fixes:

- Added `Why this exists`.
- Added a 5-minute copy-paste demo path.
- Clarified two-terminal manual demo usage.
- Added sample feedback YAML output.
- Added sample Codex brief section.
- Added links to `docs/examples/sample-failure-report.md` and `docs/examples/sample-codex-brief.md`.
- Clarified that screenshots are generated locally under `.ux-sentinel/traces/<timestamp>/`.

### Checkpoint: Cross-Project Codex Usage

Status: done

Improved the project so Codex can use ux-sentinel from another frontend repository without `npm link` or global install:

- Added `prepare: npm run build` for GitHub package installs.
- Added `docs/CODEX_MAGIC_PROMPT.md`.
- Added `docs/CODEX_INTEGRATION.md`.
- Added repo-scoped skill draft at `.agents/skills/ux-sentinel/SKILL.md`.
- Added copy-paste prompts under `examples/codex/`.
- Updated README with the GitHub `npm exec` fast path and temporary clone fallback.
- Updated `docs/LAUNCH_PLAN.md` with the prompt-only usage story.

Verification:

- `npm install` passed and ran `prepare -> npm run build`.
- `npm run build` passed.
- `npm test` passed with 6 test files and 16 tests.
- `npm run demo:verify` passed with broken demo failing and fixed demo passing.
- `npm pack --dry-run` included `dist`, docs, examples, and the repo-scoped skill draft.
- `npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel --help` passed from GitHub.
- `npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel init` created `.ux-sentinel` in a clean temporary target directory.

### Checkpoint: Clone Fallback CWD Safety

Status: done

Fixed the temporary clone fallback docs so the clone directory is only used to build ux-sentinel. The docs now instruct Codex to return to the target frontend repo before running `node /tmp/ux-sentinel/dist/cli.js`, because reports and traces are written relative to `process.cwd()`.

Updated README, Codex magic prompt, Codex integration guide, repo-scoped skill draft, launch plan, and copy-paste Codex prompts. Added tests to prevent fallback examples from running target scenario checks from inside `/tmp/ux-sentinel`.
