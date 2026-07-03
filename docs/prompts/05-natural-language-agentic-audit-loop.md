# Natural Language → Agentic UX Audit Loop

Use this prompt when the user wants to describe a feature, screen, flow, or UX direction in plain language and let Codex turn it into an evidence-backed ux-sentinel agentic audit loop.

The user should not need to write YAML first. They can write a rough natural-language request. Codex should distill it, ask for confirmation, then create or update the ux-sentinel scenario and run the audit after confirmation.

## Recommended one-shot prompt

```text
You are working inside this frontend repo.

I will describe what I want in natural language. Do not code immediately.

My raw request:
"""
<PASTE NATURAL-LANGUAGE REQUEST HERE>
"""

First, distill my request into:
- Product direction
- User goal
- Primary flow to audit
- UX success criteria
- Non-goals and forbidden changes
- Proposed ux-sentinel scenario shape

Then stop and ask:
"Is this direction correct before I create the scenario and run ux-sentinel?"

After I confirm, continue automatically:

1. Use ux-sentinel from GitHub main:
   UX_SENTINEL="npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel"

2. Start the app, find the local URL, and run `$UX_SENTINEL init` if needed.

3. Create or update:
   .ux-sentinel/scenarios/professional-agentic-ui-audit.yaml

4. Encode the confirmed product direction, user goal, primary flow, UX success criteria, non-goals, and forbidden changes into the scenario.

5. Use agentic interactive audit with hover, focus, scroll, safe scenario-approved clicks, target identity checks, planner/runtime decision evidence, contact sheet, UX rule mapping, and animation audit.

6. Run:
   $UX_SENTINEL run .ux-sentinel/scenarios/professional-agentic-ui-audit.yaml --url <local-url> --interactive

7. Inspect:
   - .ux-sentinel/reports/<report>.md
   - .ux-sentinel/traces/<timestamp>/contact-sheet.html
   - .ux-sentinel/traces/<timestamp>/action-trace.json
   - .ux-sentinel/traces/<timestamp>/state-graph.json
   - .ux-sentinel/traces/<timestamp>/trace-manifest.json

8. Fix only evidence-backed P0/P1/P2 issues that block the confirmed user goal.

Do not:
- weaken ux-sentinel safety policy
- bypass findings by deleting tests
- remove important UI just to pass
- make destructive/payment/logout/removal actions easier to trigger
- ignore planner/runtime click decision differences
- ignore target identity mismatch or dangerous_label_change evidence
- fake a pass without rerunning the same scenario

After patching, rerun the same ux-sentinel command.

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

## Why this prompt exists

This keeps the user-facing workflow simple. The user writes what they want in plain language. Codex turns that into a clear product direction and asks for confirmation before touching code. Once confirmed, ux-sentinel makes the direction repeatable through a scenario and evidence-backed interactive audit artifacts.
