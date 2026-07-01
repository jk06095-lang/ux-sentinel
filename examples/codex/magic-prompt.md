# ux-sentinel Magic Prompt

```text
Use ux-sentinel from GitHub as a temporary external QA tool for this frontend repo.

DOM says pass. Humans say “what do I click?”

Do not use npm link or a global install. First try:
npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel --help

If that fails, clone https://github.com/jk06095-lang/ux-sentinel.git into /tmp/ux-sentinel or .codex-tools/ux-sentinel. Build ux-sentinel in the temporary tool directory, then cd back to the target repo before running node /tmp/ux-sentinel/dist/cli.js. Reports and traces are written relative to the current working directory.

Read this repo's AGENTS.md and package files. Start the app with its existing dev command, find the local URL, run ux-sentinel init if .ux-sentinel is missing, then run:
npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel run .ux-sentinel/scenarios/onboarding-empty-state.yaml --url <local-url>

Read the report, generate/read the Codex patch brief, fix only P0/P1 perception mismatch findings, rerun the same scenario, and report files changed, commands run, final verdict, and remaining risks.
```
