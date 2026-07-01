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
2. Try running ux-sentinel through GitHub npm exec:
   npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel --help
3. If npm exec from GitHub fails, clone ux-sentinel into a temporary tool directory:
   - prefer /tmp/ux-sentinel on macOS/Linux
   - use .codex-tools/ux-sentinel inside this repo if /tmp is unavailable
   Then run npm install && npm run build there, and execute node <tool-dir>/dist/cli.js.
4. If this repo has no .ux-sentinel directory, run:
   npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel init
   Or use the temporary clone fallback command.
5. Detect this app's package manager and dev command from package.json and lockfiles. Start the app without changing its intended dev workflow.
6. Determine the local URL from terminal output or common defaults such as http://localhost:3000, http://localhost:5173, or http://127.0.0.1:5173.
7. Run the default scenario:
   npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel run .ux-sentinel/scenarios/onboarding-empty-state.yaml --url <local-url>
8. Read the generated .ux-sentinel/reports/*.md report.
9. Generate or read the Codex patch brief:
   npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel codex-brief <report-path>
10. Fix only P0/P1 findings that are grounded in the ux-sentinel report.
11. Rerun the exact same scenario.
12. Stop when the scenario passes, or document the blocker with evidence.

Final response:
- files changed
- commands run
- report path
- patch brief path
- final verdict
- remaining risks or blockers
```
