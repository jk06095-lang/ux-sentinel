# Magic Prompt 1: First Run Baseline

Use this prompt first when you open Codex inside a frontend repo that you want to inspect with `ux-sentinel`.

Purpose:

- connect `ux-sentinel` to the target project,
- initialize `.ux-sentinel/` if needed,
- start the app,
- run the default baseline scenario,
- collect report and trace artifacts,
- avoid app source changes during the first run.

Copy everything below into Codex from the target frontend repo.

```text
Use ux-sentinel v0.1.0 as a temporary external UX QA baseline tool for this frontend repo.

Core principle:
DOM says pass. Humans say “what do I click?”

Purpose of this first run:
Do not modify app source code yet.
Only initialize ux-sentinel if needed, start the app, run the default UX perception scenario, collect evidence, and summarize the current baseline.

Rules:
- Do not use npm link.
- Do not install ux-sentinel globally.
- Do not require an external LLM API.
- Do not modify ux-sentinel itself.
- Do not change app source code during this first baseline run.
- Do not change auth, validation, security, privacy, billing, or tests.
- Treat ux-sentinel evidence as the source of truth.

Step 1: Read this target repo
- Read AGENTS.md if it exists.
- Read package.json and lockfiles.
- Determine the package manager.
- Determine the dev command.
- Identify likely app routes such as /, /dashboard, /onboarding, /projects, /settings.

Step 2: Select ux-sentinel runner

First try:

npm exec --yes --package=github:jk06095-lang/ux-sentinel#v0.1.0 -- ux-sentinel --help

If it works, use this runner for all ux-sentinel commands:

UX_SENTINEL="npm exec --yes --package=github:jk06095-lang/ux-sentinel#v0.1.0 -- ux-sentinel"

If npm exec fails, use this fallback from the target repo root:

TARGET_REPO=$(pwd)
git clone https://github.com/jk06095-lang/ux-sentinel.git /tmp/ux-sentinel
cd /tmp/ux-sentinel
git checkout v0.1.0
npm install
npm run build
cd "$TARGET_REPO"
node /tmp/ux-sentinel/dist/cli.js --help
UX_SENTINEL="node /tmp/ux-sentinel/dist/cli.js"

Build ux-sentinel in the temporary tool directory, then cd back to the target repo before running node /tmp/ux-sentinel/dist/cli.js. Reports and traces are written relative to the current working directory.

Step 3: Initialize ux-sentinel

If .ux-sentinel does not exist, run:

$UX_SENTINEL init

Do not overwrite existing scenario or persona files unless necessary. If files already exist, keep them.

Step 4: Start this app

Start the app using its existing dev command.
Use the package manager and scripts already present in this repo.
Do not invent a new dev workflow.

Determine the local URL from terminal output or common defaults:
- http://localhost:3000
- http://localhost:5173
- http://127.0.0.1:5173
- http://localhost:8080

Step 5: Run baseline scenario

Run:

$UX_SENTINEL run .ux-sentinel/scenarios/onboarding-empty-state.yaml --url <local-url>

If the scenario path does not exist, inspect .ux-sentinel/scenarios and choose the closest default scenario.

Step 6: Read evidence

Read:
- the generated .ux-sentinel/reports/*.md report
- the latest .ux-sentinel/traces/*/screen-map.json
- the latest .ux-sentinel/traces/*/screen-map.html if useful
- console and network issue summaries in the report

If the run fails, generate a Codex patch brief:

$UX_SENTINEL codex-brief <report-path>

Do not fix yet unless I explicitly ask.

Final response format:
- ux-sentinel runner used
- app dev command used
- local URL tested
- scenario run
- report path
- trace path
- verdict
- P0/P1 findings, if any
- whether a patch brief was generated
- recommended next scenario to create
- blockers or assumptions
```
