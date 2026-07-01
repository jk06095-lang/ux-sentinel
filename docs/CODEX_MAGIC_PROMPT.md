# Codex Magic Prompt

Paste this into Codex from inside any frontend repository you want to inspect.

```text
Use ux-sentinel from GitHub as a temporary external UX QA tool for this frontend repo.

Core principle:
DOM says pass. Humans say “what do I click?”

Goal:
Run ux-sentinel against this app, inspect the report, fix only P0/P1 perception mismatch findings, and rerun the same scenario until it passes or a real blocker is documented.

Rules:
- Do not use npm link.
- Do not install ux-sentinel globally.
- Do not require an external LLM API.
- Do not build SaaS, dashboard, auth, database, hosted runner, Chrome extension, or MCP.
- Do not make speculative P2/P3 taste changes.
- Do not weaken auth, security, privacy, billing, validation, or tests.
- Treat ux-sentinel evidence as the source of truth.

Workflow:
1. Read this target repo's AGENTS.md and package files first.
2. Try running the stable ux-sentinel release through GitHub npm exec:
   npm exec --yes --package=github:jk06095-lang/ux-sentinel#v0.1.0 -- ux-sentinel --help
3. If npm exec works, use this selected runner for all ux-sentinel commands:
   UX_SENTINEL="npm exec --yes --package=github:jk06095-lang/ux-sentinel#v0.1.0 -- ux-sentinel"
4. If npm exec from GitHub fails, clone ux-sentinel into a temporary tool directory:
   - prefer /tmp/ux-sentinel on macOS/Linux
   - use .codex-tools/ux-sentinel inside this repo if /tmp is unavailable
   Build ux-sentinel in the temporary tool directory, then cd back to the target repo before running node /tmp/ux-sentinel/dist/cli.js. Reports and traces are written relative to the current working directory.
   If using .codex-tools/ux-sentinel inside the target repo, do not commit it. Prefer adding it to .git/info/exclude rather than changing the project's .gitignore unless the user asks.
   Example:
   TARGET_REPO=$(pwd)
   git clone https://github.com/jk06095-lang/ux-sentinel.git /tmp/ux-sentinel
   cd /tmp/ux-sentinel
   npm install
   npm run build
   cd "$TARGET_REPO"
   node /tmp/ux-sentinel/dist/cli.js --help
   UX_SENTINEL="node /tmp/ux-sentinel/dist/cli.js"
   Latest development path, only if the user asks for unreleased changes:
   npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel --help
5. Use the selected runner for every ux-sentinel command:
   $UX_SENTINEL init
   $UX_SENTINEL run .ux-sentinel/scenarios/onboarding-empty-state.yaml --url <local-url>
   $UX_SENTINEL codex-brief <report-path>
6. If this repo has no .ux-sentinel directory, run:
   $UX_SENTINEL init
7. Detect this app's package manager and dev command from package.json and lockfiles. Start the app without changing its intended dev workflow.
8. Determine the local URL from terminal output or common defaults such as http://localhost:3000, http://localhost:5173, or http://127.0.0.1:5173.
9. Run the default scenario:
   $UX_SENTINEL run .ux-sentinel/scenarios/onboarding-empty-state.yaml --url <local-url>
10. Read the generated .ux-sentinel/reports/*.md report.
11. Generate or read the Codex patch brief:
   $UX_SENTINEL codex-brief <report-path>
12. Fix only P0/P1 findings that are grounded in the ux-sentinel report.
13. Rerun the exact same scenario.
14. Stop when the scenario passes, or document the blocker with evidence.

Final response:
- files changed
- commands run
- report path
- patch brief path
- final verdict
- remaining risks or blockers
```
