# Natural Language → Agentic UX Audit Loop

Use this prompt when the user wants to describe a feature, screen, flow, or UX direction in plain language and let Codex turn it into an evidence-backed ux-sentinel agentic audit loop.

The user should not need to write YAML first. They can write a rough natural-language request. Codex should distill it, create or update the ux-sentinel scenario, run the audit, patch evidence-backed issues, and rerun the same scenario. Codex should ask a clarification question only when the request is too ambiguous to execute safely or when the requested behavior could affect destructive, payment, account, logout, or irreversible flows.

## Recommended autonomous prompt

```text
You are working inside this frontend repo.

I will describe what I want in natural language. Do not ask me to write YAML. Do not stop for confirmation unless the request is too ambiguous to execute safely or involves destructive, payment, account, logout, or irreversible flows.

My raw request:
"""
<PASTE NATURAL-LANGUAGE REQUEST HERE>
"""

First, briefly distill my request into:
- Product direction
- User goal
- Primary flow to audit
- UX success criteria
- Non-goals and forbidden changes
- Proposed ux-sentinel scenario shape

Then proceed automatically.

1. Use ux-sentinel from GitHub main:
   UX_SENTINEL="npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel"

2. Start the app, find the local URL, and run `$UX_SENTINEL init` if needed.

3. Create or update:
   .ux-sentinel/scenarios/professional-agentic-ui-audit.yaml

4. Encode the distilled product direction, user goal, primary flow, UX success criteria, non-goals, and forbidden changes into the scenario.

5. Use agentic interactive audit with hover, focus, scroll, safe scenario-approved clicks, target identity checks, planner/runtime decision evidence, contact sheet, UX rule mapping, and animation audit.

6. Run:
   $UX_SENTINEL run .ux-sentinel/scenarios/professional-agentic-ui-audit.yaml --url <local-url> --interactive

7. Inspect:
   - .ux-sentinel/reports/<report>.md
   - .ux-sentinel/traces/<timestamp>/contact-sheet.html
   - .ux-sentinel/traces/<timestamp>/action-trace.json
   - .ux-sentinel/traces/<timestamp>/state-graph.json
   - .ux-sentinel/traces/<timestamp>/trace-manifest.json

8. Fix only evidence-backed P0/P1/P2 issues that block the distilled user goal.

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
- Distilled product direction:
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

## Optional confirmation-first variant

Use this variant only when the user explicitly wants a planning checkpoint before Codex touches files.

```text
You are working inside this frontend repo.

I will describe what I want in natural language. First, distill it into product direction, user goal, primary flow, UX success criteria, non-goals, and proposed ux-sentinel scenario shape. Then stop and ask:
"Is this direction correct before I create the scenario and run ux-sentinel?"

Do not start implementation until I confirm.

My raw request:
"""
<PASTE NATURAL-LANGUAGE REQUEST HERE>
"""
```

## Intended loop

```text
natural-language request
→ distilled product/UX direction
→ scenario creation
→ agentic interactive audit
→ evidence-backed fix
→ same scenario rerun
```

## When to ask instead of proceeding

Ask a clarification question only when:

- the requested route, screen, or primary task cannot be inferred,
- the request conflicts with existing product scope,
- the audit would require destructive, payment, account-deletion, logout, or irreversible actions,
- the app cannot be started or no local URL can be found,
- the scenario cannot be created without guessing a safety-sensitive intent.

## Why this prompt exists

This keeps the user-facing workflow simple. The user writes what they want in plain language. Codex turns that into a product direction, creates a repeatable ux-sentinel scenario, runs the agentic interactive audit, fixes evidence-backed blockers, and reruns the same scenario. Confirmation is optional, not the default blocking behavior.
