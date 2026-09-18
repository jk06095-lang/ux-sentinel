# Documentation

This directory is the canonical documentation map for `ux-sentinel`.

The repository has grown from a small static MVP into an interactive evidence harness. To keep the docs usable, each document now has one primary responsibility instead of repeating the same product story, command list, and roadmap in multiple places.

## Start Here

Choose the path that matches what you are doing.

### I want to use ux-sentinel

1. [README](../README.md) — install, quickstart, commands, and examples.
2. [Interactive Audit](INTERACTIVE_AUDIT.md) — hover, focus, scroll, safe-click, and state-change evidence.
3. [Safety Policy](SAFETY_POLICY.md) — capability boundaries and dangerous-action rules.
4. [Codex Integration](CODEX_INTEGRATION.md) — using ux-sentinel from another frontend repository.

### I want to understand how it works

1. [Architecture](ARCHITECTURE.md) — current pipeline, modules, evidence model, and system boundaries.
2. [MVP Spec](MVP_SPEC.md) — original deterministic product contract.
3. [Agentic Interactive Audit](AGENTIC_INTERACTIVE_AUDIT.md) — planner, state graph, pointer traces, and agentic exploration.
4. [Motion Audit](MOTION_AUDIT.md) — optional deterministic animation evidence.
5. [UX Rule Registry](UX_RULE_REGISTRY.md) — detector-to-principle mappings and rule metadata.

### I want to contribute

1. [Architecture](ARCHITECTURE.md) — understand the current code boundaries first.
2. [Decisions](DECISIONS.md) — design decisions and unresolved questions.
3. [v0.2 Roadmap](V0.2_ROADMAP.md) — planned work, sequencing, and acceptance criteria.
4. [Progress](PROGRESS.md) — chronological implementation history.
5. [Release Checklist](RELEASE_CHECKLIST.md) — release gate and publishing procedure.

## Document Roles

| Document | Role | Status |
| --- | --- | --- |
| [../README.md](../README.md) | User-facing entry point and quickstart | Current |
| [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md) | Original product rationale and positioning | Reference |
| [MVP_SPEC.md](MVP_SPEC.md) | Original v0.1 deterministic contract | Stable reference |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Current implementation architecture | Current |
| [INTERACTIVE_AUDIT.md](INTERACTIVE_AUDIT.md) | Interactive runner behavior and artifacts | Current |
| [AGENTIC_INTERACTIVE_AUDIT.md](AGENTIC_INTERACTIVE_AUDIT.md) | Agentic planner and state exploration details | Current development |
| [MOTION_AUDIT.md](MOTION_AUDIT.md) | Motion audit evidence and detectors | Current development |
| [UX_RULE_REGISTRY.md](UX_RULE_REGISTRY.md) | UX rules and detector mappings | Current |
| [SAFETY_POLICY.md](SAFETY_POLICY.md) | Browser capability and action safety policy | Current |
| [CODEX_INTEGRATION.md](CODEX_INTEGRATION.md) | External Codex workflow | Current |
| [V0.2_ROADMAP.md](V0.2_ROADMAP.md) | Next architecture direction | Planned |
| [DECISIONS.md](DECISIONS.md) | Design decision log | Ongoing |
| [PROGRESS.md](PROGRESS.md) | Chronological implementation log | Historical log |
| [LAUNCH_PLAN.md](LAUNCH_PLAN.md) | v0.1 launch copy and launch notes | Historical/reference |
| [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) | Release procedure | Current |

## Documentation Rules

To keep the docs from drifting again:

- Put install commands, common CLI usage, and the shortest product explanation in the root README.
- Put implementation structure and module responsibilities in `ARCHITECTURE.md`.
- Put future work only in `V0.2_ROADMAP.md` or the decision log.
- Put detector definitions and UX rule mappings in `UX_RULE_REGISTRY.md`, not in every feature document.
- Put interactive artifact details in `INTERACTIVE_AUDIT.md`.
- Keep `PROGRESS.md` chronological. Do not use it as the canonical roadmap.
- Keep historical launch material for provenance, but do not treat it as current product documentation.
- When a feature graduates from planned to implemented, update Architecture first, then the feature-specific document, and finally the README if the user-facing workflow changed.

## Product Direction

The current product is an evidence-backed UX perception auditor.

The next architectural step is described in [v0.2 Roadmap](V0.2_ROADMAP.md): evolve from a tool that only reports UX mismatches into a **repair compiler** that turns evidence into structured constraints a coding agent can safely implement and verify.
