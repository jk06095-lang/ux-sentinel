# Codex Start Prompt

Use this as the first message in a fresh Codex session for this project.

```text
I want to build an open-source MVP called ux-sentinel.

I will paste the full product discussion into docs/PRODUCT_BRIEF.md. Use it as background context, not as an implementation checklist.

Your job is to turn the idea into a small, working, local-first TypeScript CLI MVP.

Before starting implementation:
1. Create docs/MVP_SPEC.md from the product brief.
2. Create AGENTS.md with the engineering rules.
3. Create docs/DECISIONS.md and docs/PROGRESS.md.
4. Keep scope small and demo-driven.

Important product framing:
ux-sentinel detects perception mismatches in AI-generated frontends: cases where the DOM/accessibility tree says an action exists, but the human-visible UI does not clearly communicate the next action.

Do not build a SaaS, dashboard, database, account system, hosted runner, Chrome extension, or required LLM API integration.

After creating the docs, propose the smallest implementation plan, then set the /goal I provide.
```

## Current Repository State

The initial docs already exist in this repository:

- `docs/PRODUCT_BRIEF.md`
- `docs/MVP_SPEC.md`
- `docs/LAUNCH_PLAN.md`
- `docs/DECISIONS.md`
- `docs/PROGRESS.md`
- `AGENTS.md`

For this repository, a fresh Codex session should read the existing files first, then propose the smallest implementation plan. It should not recreate the docs unless they are missing or the user asks for a rewrite.
