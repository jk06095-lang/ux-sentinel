# ux-sentinel Goal Prompt

```text
/goal Use ux-sentinel as a temporary external QA harness for this frontend app. Do not use npm link or global install. Fetch it from GitHub with npm exec, or use a temporary clone fallback. Build ux-sentinel in the temporary tool directory, then cd back to the target repo before running node /tmp/ux-sentinel/dist/cli.js. Reports and traces are written relative to the current working directory. Start the app, run the default onboarding empty-state scenario, fix only report-backed P0/P1 perception mismatch findings, rerun until the scenario passes or a blocker is documented, and report changed files, commands, report path, patch brief path, final verdict, and risks.
```
