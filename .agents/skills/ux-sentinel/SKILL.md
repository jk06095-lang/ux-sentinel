---
name: ux-sentinel
description: Use ux-sentinel to run local, evidence-based UI perception mismatch QA in frontend repos, especially empty-state, onboarding, and "what do I click?" reviews.
---

# ux-sentinel Skill

## When To Use

Use this skill when the user asks for UI QA, perception mismatch review, empty-state review, onboarding review, first-run flow review, or asks whether a screen makes the next action clear.

Do not use this skill for general unit testing, SaaS dashboards, cloud runners, account systems, Chrome extensions, Figma sync, or broad visual redesign.

## Core Concept

DOM says pass. Humans say “what do I click?”

A perception mismatch occurs when the DOM, accessibility tree, or guided test says a feature exists, but the human-visible UI does not clearly communicate the current state, primary action, consequence, or recovery path.

## Preferred Execution

Prefer GitHub `npm exec` so the target repo does not need `npm link`, global install, or a committed dependency:

```bash
npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel --help
```

Common commands:

```bash
npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel init
npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel run .ux-sentinel/scenarios/onboarding-empty-state.yaml --url http://localhost:3000
```

## Fallback Execution

If GitHub `npm exec` fails, clone into a temporary tool directory:

```bash
TARGET_REPO=$(pwd)
git clone https://github.com/jk06095-lang/ux-sentinel.git /tmp/ux-sentinel
cd /tmp/ux-sentinel
npm install
npm run build
cd "$TARGET_REPO"
node /tmp/ux-sentinel/dist/cli.js --help
```

Build ux-sentinel in the temporary tool directory, then cd back to the target repo before running node /tmp/ux-sentinel/dist/cli.js. Reports and traces are written relative to the current working directory.

If `/tmp` is unavailable, use `.codex-tools/ux-sentinel` in the target repo and keep it out of production changes.

## Workflow

1. Read the target repo `AGENTS.md` and relevant package files.
2. Determine the app dev command and package manager from lockfiles and `package.json`.
3. Initialize `.ux-sentinel` if missing.
4. Start the app with its existing dev command.
5. Determine the local URL from terminal output or common defaults.
6. Run the default onboarding empty-state scenario.
7. Read the generated `.ux-sentinel/reports/*.md` report.
8. Generate or read the Codex patch brief with `ux-sentinel codex-brief <report>`.
9. Fix only P0/P1 findings grounded in the report.
10. Rerun the same scenario.
11. Report files changed, commands run, report path, brief path, final verdict, and remaining risks.

## Safety Rules

- Do not use `npm link`.
- Do not install ux-sentinel globally.
- Do not make speculative P3 taste changes.
- Do not weaken auth, security, privacy, billing, validation, or tests.
- Evidence is the source of truth.
- Persona critique is a hypothesis, not proof.
- Do not suppress ux-sentinel findings by changing scenarios or detectors unless the user explicitly asks to change ux-sentinel itself.
