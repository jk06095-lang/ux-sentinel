# Onboarding QA Prompt

```text
Run ux-sentinel against this app's onboarding or first-run screen.

Use GitHub npm exec first:
npm exec --yes --package=github:jk06095-lang/ux-sentinel#v0.1.0 -- ux-sentinel --help

Avoid npm link and global install. If npm exec works, set UX_SENTINEL="npm exec --yes --package=github:jk06095-lang/ux-sentinel#v0.1.0 -- ux-sentinel". If npm exec fails, clone ux-sentinel into /tmp/ux-sentinel or .codex-tools/ux-sentinel. Build ux-sentinel in the temporary tool directory, then cd back to the target repo before running node /tmp/ux-sentinel/dist/cli.js. Reports and traces are written relative to the current working directory. If using .codex-tools/ux-sentinel inside the target repo, do not commit it. Prefer adding it to .git/info/exclude rather than changing the project's .gitignore unless the user asks. Then set UX_SENTINEL="node /tmp/ux-sentinel/dist/cli.js".

Start the app, find the local URL, initialize .ux-sentinel if needed with $UX_SENTINEL init, run the onboarding-empty-state scenario with $UX_SENTINEL run, read the report, run $UX_SENTINEL codex-brief <report-path>, fix only P0/P1 issues where the visible UI does not communicate the next action, then rerun and report the final verdict.
```
