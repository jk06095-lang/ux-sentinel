# Empty-state QA Prompt

```text
Check this app's empty states with ux-sentinel.

Principle: DOM says pass. Humans say “what do I click?”

Use ux-sentinel from GitHub as a temporary external tool. Do not use npm link or global install. Try:
npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel run .ux-sentinel/scenarios/onboarding-empty-state.yaml --url <local-url>

If .ux-sentinel is missing, initialize it first. If npm exec fails, use a temporary clone fallback. Fix only P0/P1 findings from the report, especially missing visible primary CTA, icon-only primary CTA, and empty state without CTA. Rerun the same scenario and summarize the result.
```
