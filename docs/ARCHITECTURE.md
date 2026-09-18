# Architecture

## Purpose

`ux-sentinel` is a local, deterministic UX evidence harness for frontend applications.

Its core premise is simple:

> A feature can exist in the DOM and accessibility tree while still being unclear to the human looking at the screen.

The system therefore treats browser behavior, visible presentation, accessibility semantics, layout geometry, and interaction state as separate evidence sources.

The core runner does not require an external LLM or vision API.

## System Boundary

`ux-sentinel` is responsible for:

- collecting browser evidence,
- exploring safe UI states,
- detecting evidence-backed perception mismatches,
- producing human-readable and machine-readable reports,
- preserving enough artifacts to reconstruct how a finding was produced.

It is not responsible for:

- autonomous product redesign,
- unconstrained visual taste judgments,
- destructive browser actions,
- form submission,
- account or payment workflows,
- cloud execution,
- automatically trusting a coding agent's own claim that a patch is better.

## Current Pipeline

```text
Scenario / URL
      |
      v
Observe page
      |
      +--> screenshot
      +--> screen-map
      +--> accessibility snapshot
      +--> console/network evidence
      |
      v
Deterministic detectors
      |
      +--> static findings
      |
      v
Optional interactive exploration
      |
      +--> target collection
      +--> target classification
      +--> capability/safety policy
      +--> hover / focus / scroll / safe click
      +--> before/after screenshots
      +--> pointer and animation traces
      +--> state graph
      |
      v
Rule enrichment
      |
      v
Report + contact sheet + trace manifest
      |
      v
Codex patch brief
```

The important architectural distinction is that observation and judgment are evidence-producing stages. A coding agent is a downstream consumer of that evidence, not the authority that decides whether its own patch is acceptable.

## Major Modules

| Module | Responsibility |
| --- | --- |
| `src/core/observe-page.ts` | Collect visible DOM, layout, accessibility-adjacent, console, and network evidence |
| `src/core/screen-map.ts` | Query helpers over observed screen elements |
| `src/core/detectors.ts` | Deterministic static and interaction-linked UX findings |
| `src/core/interactive.ts` | Browser exploration and action execution |
| `src/core/action-planner.ts` | Order agentic exploration candidates within budgets |
| `src/core/target-classifier.ts` | Classify interactive targets by UX role and risk |
| `src/core/state-graph.ts` | Represent before/after UI states and action edges |
| `src/core/pointer-trace.ts` | Cursor movement and hit-test evidence |
| `src/core/animation-audit.ts` | Optional deterministic animation and motion evidence |
| `src/core/rules/*` | Map findings to UX principles and confidence metadata |
| `src/core/report.ts` | Human-readable report rendering |
| `src/core/brief.ts` | Convert reports into coding-agent patch briefs |
| `src/core/scenario.ts` | Parse scenario contracts and defaults |
| `src/core/capabilities.ts` | Resolve permitted browser capabilities |

## Evidence Model

### Static evidence

A static observation can include:

- screenshot,
- viewport and document geometry,
- visible text,
- visible element map,
- accessibility-related labels and roles,
- clickability and focusability signals,
- layout and affordance signals,
- console errors,
- network 4xx/5xx evidence.

### Interactive evidence

Interactive audit adds:

- planned action and reason,
- target category and risk level,
- before/after screenshots,
- visual diff,
- DOM diff,
- accessibility diff,
- pointer trace,
- live target identity checks,
- state graph nodes and edges,
- optional animation trace,
- action-linked findings,
- capability and click decisions.

### Review surfaces

Three artifacts serve different consumers:

- `report.md`: concise human-readable findings.
- `contact-sheet.html`: visual review and evidence reconstruction.
- `trace-manifest.json`: machine-readable index of the evidence bundle.

## Safety Model

The browser runner is capability-based.

Observe, hover, focus, and scroll are the low-risk baseline. Safe clicking requires explicit opt-in. Typing, form submission, destructive actions, payment, logout, and similar actions remain outside the current product boundary.

The runner also revalidates live target identity before user-like actions so state changes do not silently turn a previously safe target into a different or dangerous target.

See [SAFETY_POLICY.md](SAFETY_POLICY.md) for the full contract.

## Deterministic Judgment

The current implementation intentionally favors inspectable heuristics.

Examples include:

- whether a primary CTA has a visible label,
- whether an empty state provides a next action,
- whether a target is too small,
- whether content is occluded or truncated,
- whether focus is visible,
- whether a status change is announced,
- whether an interactive action produces visible feedback,
- whether an overlay blocks the intended target,
- whether motion ignores reduced-motion preferences.

The advantage is auditability: each finding can point to concrete browser evidence.

The limitation is that subtle visual hierarchy and design quality cannot be fully represented by simple geometry and DOM rules.

## Known Architectural Limitation: Visual Weight

The current `visualWeight` signal is primarily derived from element area relative to the viewport.

That is useful as a simple geometry feature, but it is not a complete model of human visual salience. Human attention is also affected by:

- foreground/background contrast,
- color uniqueness,
- typography,
- whitespace and isolation,
- screen position,
- affordance,
- nearby competing actions,
- occlusion and crowding.

The v0.2 roadmap therefore treats perceptual salience as a separate subsystem rather than continuing to overload a single area ratio.

## Judge / Fixer Separation

The architecture should preserve a strong separation:

```text
ux-sentinel judge
      |
      v
structured evidence + repair constraints
      |
      v
coding agent / fixer
      |
      v
patched UI
      |
      v
ux-sentinel judge again
```

The coding agent may propose and implement a patch, but acceptance should come from a fresh run of the judge.

This avoids a common failure mode where the same model both edits the UI and declares its own edit successful.

## Current Patch Handoff

Today, `src/core/brief.ts` converts Markdown findings into a Codex-oriented patch brief.

This is useful, but it still asks the downstream coding agent to infer too much:

- which source component owns the target,
- which visual property should change,
- how much change is enough,
- which properties must be preserved,
- what measurable postcondition defines success.

The planned v0.2 repair contract addresses this gap.

## Extension Points

The architecture can evolve without replacing the deterministic core.

Planned extension points include:

1. **Perceptual salience**
   - richer visual hierarchy features,
   - explainable per-feature scores.

2. **Coverage gate**
   - do not allow an audit to finish before required states or control classes have been explored.

3. **Repair contract**
   - machine-readable constraints for downstream coding agents.

4. **Before/after UX scoring**
   - measure improvement while preventing regressions in unrelated dimensions.

5. **Semantic goal model**
   - move beyond hard-coded preferred button labels.

6. **Source attribution**
   - map browser evidence back to likely frontend source files/components.

7. **Optional local visual critic**
   - disabled by default,
   - advisory rather than authoritative,
   - deterministic evidence remains available for verification.

See [V0.2_ROADMAP.md](V0.2_ROADMAP.md) for sequencing and acceptance criteria.
