# ux-sentinel Magic Prompt

```text
Use ux-sentinel from GitHub as a temporary external QA tool for this frontend repo.

DOM says pass. Humans say "what do I click?"

Do not use npm link or a global install. First try:
npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel --help

If that works, use:
UX_SENTINEL="npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel"

If that fails, clone https://github.com/jk06095-lang/ux-sentinel.git into /tmp/ux-sentinel or .codex-tools/ux-sentinel. Build ux-sentinel in the temporary tool directory, then cd back to the target repo before running node /tmp/ux-sentinel/dist/cli.js. Reports and traces are written relative to the current working directory.

Fallback commands:
TARGET_REPO=$(pwd)
git clone https://github.com/jk06095-lang/ux-sentinel.git /tmp/ux-sentinel
cd /tmp/ux-sentinel
npm install
npm run build
cd "$TARGET_REPO"
node /tmp/ux-sentinel/dist/cli.js --help
UX_SENTINEL="node /tmp/ux-sentinel/dist/cli.js"

If using .codex-tools/ux-sentinel inside the target repo, do not commit it. Prefer adding it to .git/info/exclude rather than changing the project's .gitignore unless the user asks.

Read this repo's AGENTS.md and package files. Start the app with its existing dev command, find the local URL, run $UX_SENTINEL init if .ux-sentinel is missing, then run:
$UX_SENTINEL run .ux-sentinel/scenarios/onboarding-empty-state.yaml --url <local-url>

Read the report, run $UX_SENTINEL codex-brief <report-path>, fix only P0/P1 perception mismatch findings, rerun the same scenario, and report files changed, commands run, final verdict, and remaining risks.
```
