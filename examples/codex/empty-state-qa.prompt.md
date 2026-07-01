# Empty-state QA Prompt

```text
Check this app's empty states with ux-sentinel.

Principle: DOM says pass. Humans say "what do I click?"

Use ux-sentinel from GitHub as a temporary external tool. Do not use npm link or global install. Try:
npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel --help

If npm exec works, set UX_SENTINEL="npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel". If npm exec fails, use a temporary clone fallback. Build ux-sentinel in the temporary tool directory, then cd back to the target repo before running node /tmp/ux-sentinel/dist/cli.js. Reports and traces are written relative to the current working directory. If using .codex-tools/ux-sentinel inside the target repo, do not commit it. Prefer adding it to .git/info/exclude rather than changing the project's .gitignore unless the user asks. Then set UX_SENTINEL="node /tmp/ux-sentinel/dist/cli.js".

If .ux-sentinel is missing, initialize it first with $UX_SENTINEL init. Run the scenario with $UX_SENTINEL run .ux-sentinel/scenarios/onboarding-empty-state.yaml --url <local-url>. Fix only P0/P1 findings from the report, especially missing visible primary CTA, icon-only primary CTA, and empty state without CTA. Rerun the same scenario and summarize the result.
```
