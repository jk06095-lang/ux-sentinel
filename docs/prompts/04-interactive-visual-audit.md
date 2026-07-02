# Codex Prompt: Interactive Visual Audit

Use `ux-sentinel` as a temporary local QA tool for this frontend repo.

Goal: find perception mismatches that only appear after hover, focus, safe click, scroll, overlays, graph movement, DAG layout, or dense card/timeline states.

Interactive audit is currently a `main` development feature, not part of the GitHub `v0.1.0` stable path unless it is released later.

Rules:

- Do not change scenarios or fail conditions to hide findings.
- Do not use external LLM or vision APIs.
- Do not use npm link or a global install.
- Do not commit `.ux-sentinel/traces`, `.ux-sentinel/reports`, or temporary tool clones.
- Fix only findings grounded in screenshots, screen maps, action trace, contact sheet, console errors, or network evidence.
- Treat `contact-sheet.html` as the primary human review surface.
- Remember that `explore` defaults to hover, focus, and scroll only; clicking requires `--click-safe`.
- Treat `data-ux-role` as analysis metadata by default. Use `data-ux-clickable="true"` or `data-ux-action` to opt non-native elements into safe-click filtering.
- Treat graph/DAG checks as bbox heuristics that need human review.

Preferred runner:

```bash
UX_SENTINEL="npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel"
```

If using a local checkout of ux-sentinel instead:

```bash
npm install
npm run build
UX_SENTINEL="node dist/cli.js"
```

Workflow:

1. Read this repo's `AGENTS.md`, package files, and app start command.
2. Start the app locally and identify the URL.
3. Run:

```bash
$UX_SENTINEL explore --url <local-url> --max-actions 40 --settle-ms 350
```

4. Open `.ux-sentinel/traces/<timestamp>/contact-sheet.html`.
5. Only if it is safe to click filtered controls in this app, rerun with:

```bash
$UX_SENTINEL explore --url <local-url> --max-actions 40 --settle-ms 350 --click-safe
```

6. If a scenario exists, rerun with:

```bash
$UX_SENTINEL run <scenario.yaml> --url <local-url> --interactive --max-actions 80 --settle-ms 350
```

For scenario-driven clicking, the scenario must explicitly set `interactive_exploration.click_all_safe_controls: true`.

7. Read the report and run:

```bash
$UX_SENTINEL codex-brief <report-path>
```

8. Patch the UI, not the scenario, so the human-visible state, action, consequence, or recovery path is clear.
9. Rerun the same command and report:

- command run
- report path
- contact sheet path
- final verdict
- changed files
- remaining risks
