# Natural Language → Agentic UX Audit Loop

Use this prompt when the user wants to describe a feature, screen, flow, or UX direction in plain language before running ux-sentinel.

## Prompt

```text
You are working inside this frontend repo.

I will describe what I want in natural language. First, distill it into:

1. Product direction
2. User goal
3. Primary flow to audit
4. UX success criteria
5. Non-goals and forbidden changes
6. Proposed ux-sentinel scenario shape

My raw request:
"""
<PASTE NATURAL-LANGUAGE REQUEST HERE>
"""

After distilling, stop and ask:
"Is this direction correct before I create the scenario and run ux-sentinel?"

Do not start implementation until I confirm or correct the direction.
```

## Follow-up prompt after confirmation

```text
Proceed with the confirmed direction.

Use ux-sentinel from GitHub main as a temporary external QA tool for this frontend repo.

Set the runner:

UX_SENTINEL="npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel"

Start the app, find the local URL, and initialize ux-sentinel if needed:

$UX_SENTINEL init

Create or update:

.ux-sentinel/scenarios/professional-agentic-ui-audit.yaml

The scenario must encode the confirmed product direction, user goal, primary flow, UX success criteria, non-goals, and forbidden changes.

Run:

$UX_SENTINEL run .ux-sentinel/scenarios/professional-agentic-ui-audit.yaml --url <local-url> --interactive

Inspect the report, contact sheet, action trace, state graph, and trace manifest. Fix only evidence-backed issues that block the confirmed user goal, then rerun the same command.

Final response format:
- Confirmed product direction:
- Scenario created or updated:
- Commands run:
- Report path:
- Contact sheet path:
- Findings fixed:
- Files changed:
- Remaining findings:
- Final verdict:
- Risks or follow-up:
```

## Intended loop

```text
natural-language request
→ distilled product/UX direction
→ user confirmation
→ scenario creation
→ agentic interactive audit
→ evidence-backed fix
→ same scenario rerun
```
