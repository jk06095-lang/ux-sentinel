# Codex Integration

`ux-sentinel` is a local evidence harness for perception mismatches.

> DOM says pass. Humans say “what do I click?”

It can be used from another Codex project without `npm link`, global install, SaaS, a cloud runner, or an external LLM API.

## Level 1: Prompt-only GitHub execution

The user opens Codex inside a frontend repo and pastes the magic prompt from `docs/CODEX_MAGIC_PROMPT.md`.

Codex should first try GitHub `npm exec`:

```bash
npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel --help
npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel init
npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel run .ux-sentinel/scenarios/onboarding-empty-state.yaml --url http://localhost:3000
```

This path requires no checked-in dependency in the target app.

If GitHub `npm exec` fails, use a temporary clone fallback:

```bash
# Run this from the target frontend repo root.
TARGET_REPO=$(pwd)
git clone https://github.com/jk06095-lang/ux-sentinel.git /tmp/ux-sentinel
cd /tmp/ux-sentinel
npm install
npm run build
cd "$TARGET_REPO"
node /tmp/ux-sentinel/dist/cli.js --help
node /tmp/ux-sentinel/dist/cli.js init
node /tmp/ux-sentinel/dist/cli.js run .ux-sentinel/scenarios/onboarding-empty-state.yaml --url http://localhost:3000
```

Build ux-sentinel in the temporary tool directory, then cd back to the target repo before running node /tmp/ux-sentinel/dist/cli.js. Reports and traces are written relative to the current working directory.

When `/tmp` is not appropriate, clone into the target repo under `.codex-tools/ux-sentinel`:

```bash
TARGET_REPO=$(pwd)
mkdir -p .codex-tools
git clone https://github.com/jk06095-lang/ux-sentinel.git .codex-tools/ux-sentinel
cd .codex-tools/ux-sentinel
npm install
npm run build
cd "$TARGET_REPO"
node .codex-tools/ux-sentinel/dist/cli.js --help
node .codex-tools/ux-sentinel/dist/cli.js init
node .codex-tools/ux-sentinel/dist/cli.js run .ux-sentinel/scenarios/onboarding-empty-state.yaml --url http://localhost:3000
```

Recommended target-project prompt:

```text
Use ux-sentinel from GitHub as a temporary external QA tool. Do not use npm link or global install. Start this app, run the default onboarding empty-state scenario, read the report and Codex patch brief, fix only P0/P1 perception mismatch findings, then rerun the same scenario and report the final verdict.
```

## Level 2: Global AGENTS.md autopilot

For recurring use, add a reusable section to `~/.codex/AGENTS.md`.

Codex reads global and project `AGENTS.md` guidance when a session starts, so this can make UX Sentinel part of your personal UI QA routine.

```md
## UX Sentinel UI QA

When I ask for UI QA, perception mismatch review, empty-state review, onboarding review, or "what do I click?" checks:

- Use ux-sentinel as a temporary external QA tool.
- Do not use npm link.
- Do not install ux-sentinel globally.
- First try:
  `npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel --help`
- If npm exec fails, clone `https://github.com/jk06095-lang/ux-sentinel.git` into `/tmp/ux-sentinel` or `.codex-tools/ux-sentinel`, run `npm install && npm run build` in the tool directory, then return to the target repo root before executing `node /tmp/ux-sentinel/dist/cli.js`.
- Run `ux-sentinel init` if `.ux-sentinel` is missing.
- Start the target app using its existing package manager and dev command.
- Run `.ux-sentinel/scenarios/onboarding-empty-state.yaml` against the local URL.
- Read the generated report and Codex patch brief.
- Fix only P0/P1 findings backed by evidence.
- Rerun the same scenario and report the final verdict.
```

## Level 3: Future Codex Skill / Plugin

This repository includes a repo-scoped draft skill at `.agents/skills/ux-sentinel/SKILL.md`.

That draft is useful for local authoring and testing a `$ux-sentinel` style workflow inside this repository. It is not currently published as an installable Codex plugin.

Future packaging may include:

- a user-installable Codex Skill
- a plugin bundle for a `$ux-sentinel` workflow
- optional MCP integration for richer tool discovery or report handoff

MCP is intentionally not part of v0. The current MVP remains local-first, deterministic, and evidence-based.

## Manual verification command

If you want to manually confirm GitHub execution from any target repo, run:

```bash
npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel --help
```

Then, with your app running:

```bash
npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel init
npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel run .ux-sentinel/scenarios/onboarding-empty-state.yaml --url http://localhost:3000
```
