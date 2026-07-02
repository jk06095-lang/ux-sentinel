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

### Checkpoint: Public Launch Polish

Status: done

Made the README Codex entry point more visible with a direct "Copy this prompt" block near the top.

Captured a real external-repo smoke log using the GitHub `npm exec` path. The temporary target frontend repo produced:

- broken page: exit 1, report verdict `fail`
- fixed page: exit 0, report verdict `pass`
- reports and traces written under the target repo `.ux-sentinel` directory

Documented the current packaging decision: v0.1 launch usage stays GitHub-only for now; npm publish waits until the v0.1.0 tag, release notes, and package ownership are deliberately finalized.

### Checkpoint: Launch Docs Review Polish

Status: done

Applied the final launch-doc review fixes:

- Made the README copy prompt self-contained with the minimal temporary clone fallback commands.
- Introduced a selected `UX_SENTINEL` runner in the magic prompt and Codex examples so fallback and npm exec paths share the same later workflow.
- Replaced stale launch-plan detector names with `primary_cta_icon_only`, `empty_state_without_cta`, and optional `dom_visible_but_human_invisible`.
- Clarified the external smoke log by explaining the broken and fixed checks used the same local URL after swapping the temporary target app HTML.
- Added `.codex-tools/ux-sentinel` safety guidance: do not commit it; prefer `.git/info/exclude` over changing `.gitignore` unless the user asks.
- Added docs tests for self-contained fallback commands, selected runner usage, stale detector names, and `.codex-tools` commit safety.

Verification:

- `npm run build` passed.
- `npm test` passed with 6 test files and 23 tests.
- `npm run demo:verify` passed with the broken demo failing and the fixed demo passing.

### Checkpoint: GitHub-Only v0.1.0 Release Prep

Status: done

Prepared release documentation for a GitHub-only `v0.1.0` release:

- Added `RELEASE_NOTES.md`.
- Added `docs/RELEASE_CHECKLIST.md`.
- Updated stable no-install commands to prefer `github:jk06095-lang/ux-sentinel#v0.1.0`.
- Kept `#main` documented as the latest-development path.
- Kept npm publishing deferred for `v0.1.0`.

The actual annotated tag, GitHub Release, and npm publish were not created during this checkpoint.

Verification:

- `npm run build` passed.
- `npm test` passed with 6 test files and 25 tests.
- `npm run demo:verify` passed with the broken demo failing and the fixed demo passing.
- `npm pack --dry-run` passed and produced a dry-run `ux-sentinel-0.1.0.tgz` package listing.

### Checkpoint: GitHub v0.1.0 Release

Status: done

Created the GitHub-only `v0.1.0` release.

Release verification:

```json
{
  "isDraft": false,
  "isPrerelease": false,
  "name": "ux-sentinel v0.1.0",
  "tagName": "v0.1.0",
  "url": "https://github.com/jk06095-lang/ux-sentinel/releases/tag/v0.1.0"
}
```

Post-release `v0.1.0` smoke:

- `npm exec --yes --package=github:jk06095-lang/ux-sentinel#v0.1.0 -- ux-sentinel --help`: exit 0
- `ux-sentinel init`: exit 0
- `ux-sentinel run` against a temp fixed app: exit 0
- report verdict: `pass`
- reports and traces written under the target temp repo `.ux-sentinel`

npm publish remains deferred.

## 2026-07-03

### Checkpoint: Interactive Audit Mode

Status: done

Added deterministic interactive audit support:

- `ux-sentinel explore --url <url>`
- `ux-sentinel run <scenario.yaml> --url <url> --interactive`
- optional `--max-actions <n>`
- optional `--settle-ms <ms>`

Implemented Playwright-based target collection for visible controls, safe-click filtering for destructive/payment/account actions, hover/focus/click/scroll action capture, `action-trace.json`, `anomalies.json`, and `contact-sheet.html`.

Added rule-based visual anomaly coverage for blocked click targets, floating panels covering primary actions, off-screen tooltips, graph edge/text overlap, edge labels crossing nodes, clipped card content, overlapping cards, excessive DAG canvas whitespace, and unexplained empty DAG columns.

Added docs and scenario examples:

- `docs/INTERACTIVE_AUDIT.md`
- `docs/prompts/04-interactive-visual-audit.md`
- `demo/scenarios/interactive-dag-clarity.yaml`

Verification:

- `npm run build` passed.
- `npm test` passed with 7 test files and 32 tests.
- `npm run demo:verify` passed with the broken demo failing and the fixed demo passing.
- `node dist/cli.js explore --url http://127.0.0.1:4173/fixed --max-actions 10 --settle-ms 100` passed and generated `action-trace.json`, `anomalies.json`, and `contact-sheet.html`.
- `node dist/cli.js run demo/scenarios/interactive-dag-clarity.yaml --url http://127.0.0.1:4173/fixed --interactive --max-actions 10 --settle-ms 100` passed with verdict `pass` and generated the interactive report/contact sheet.
