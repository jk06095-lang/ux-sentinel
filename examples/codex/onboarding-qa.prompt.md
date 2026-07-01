# Onboarding QA Prompt

```text
Run ux-sentinel against this app's onboarding or first-run screen.

Use GitHub npm exec first:
npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel --help

Avoid npm link and global install. If npm exec fails, clone ux-sentinel into /tmp/ux-sentinel or .codex-tools/ux-sentinel. Build ux-sentinel in the temporary tool directory, then cd back to the target repo before running node /tmp/ux-sentinel/dist/cli.js. Reports and traces are written relative to the current working directory.

Start the app, find the local URL, initialize .ux-sentinel if needed, run the onboarding-empty-state scenario, read the report and Codex patch brief, fix only P0/P1 issues where the visible UI does not communicate the next action, then rerun and report the final verdict.
```
