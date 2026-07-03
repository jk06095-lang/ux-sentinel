# Agentic Interactive Audit

Agentic interactive audit is the development path for making `ux-sentinel` inspect a UI more like a careful UX reviewer while staying local-first, deterministic, and evidence-backed.

This mode builds on the existing interactive runner. It does not introduce SaaS infrastructure, external LLM calls, visual AI, form typing, form submission, or destructive browser actions.

## Current Foundation

The current implementation adds a deterministic planning layer:

1. Collect visible interactive targets and scroll containers.
2. Classify targets into UX-relevant categories.
3. Sort by planning priority when `interactive_exploration.mode: agentic`.
4. Respect action and click budgets.
5. Record the planner decision, runtime decision, and target identity status in `action-trace.json`, `state-graph.json`, `trace-manifest.json`, and `contact-sheet.html`.
6. Write `state-graph.json` plus per-action visual, DOM, and accessibility diff files so a reviewer can reconstruct the path.
7. Write per-action pointer traces so hover, focus, and click-capable actions show the cursor path and final hit-test result.
8. Enrich findings with UX rule mappings so reports explain why each detector matters.
9. Optionally write per-action animation traces when `animation_audit.enabled: true`.

The runner still uses the hardened safety policy from [SAFETY_POLICY.md](SAFETY_POLICY.md). `explore --click-safe` is the standalone opt-in for safe clicks. `run --interactive --click-safe` is rejected; scenario-driven clicking requires `interactive_exploration.click_all_safe_controls: true`.

## Scenario Options

```yaml
interactive_exploration:
  enabled: true
  mode: agentic
  max_actions: 120
  max_depth: 2
  max_clicks: 20
  max_state_changes: 40
  hover_all_clickables: true
  focus_all_keyboard_targets: true
  scroll_containers: true
  click_all_safe_controls: true
  allow_navigation: false
  settle_ms: 350

ux_rule_profile:
  enabled: true
  rule_sets:
    - nielsen_10_heuristics
    - wcag_2_2_interaction
    - motion_accessibility
    - gestalt_visual_grouping
    - interaction_laws
    - graph_dag_readability
  require_rule_mapping: true
```

The fuller professional-audit template lives at `demo/scenarios/professional-agentic-ui-audit.yaml`. It combines agentic planning, clean English/Korean dangerous-label avoids, account-deletion and irreversible-action avoids, visual anomaly contracts, an explicit `ux_rule_profile`, and opt-in motion audit.

The concrete local regression fixture for benign state continuation is `demo/scenarios/interactive-agentic-states.yaml` against `/interactive-agentic-states`. It proves the planner can keep working after safe UI state changes and replan once newly revealed controls appear by requiring clicked actions for a primary CTA, tab, menu trigger, help trigger, accordion, and discovered control, with DOM diff text and state-graph edges asserted by `npm run demo:verify`.

## Target Categories

The target classifier currently recognizes:

- `primary_cta`
- `secondary_cta`
- `navigation`
- `tab`
- `menu`
- `dropdown`
- `dialog_trigger`
- `tooltip_help_trigger`
- `card`
- `expandable_section`
- `graph_dag_node`
- `graph_dag_control`
- `form_adjacent_control`
- `scroll_container`
- `ambiguous_clickable`

The planner prioritizes primary CTAs first, then tabs/menus/navigation, help and disclosure controls, cards and dense regions, graph/DAG targets, scroll containers, and finally ambiguous targets.

## Evidence

Each action record includes:

- `plannedReason`
- `targetCategory`
- `riskLevel`
- `planDepth`
- `planPriority`
- `plannedSafeClick`
- `plannerClickDecision`
- `plannerClickDecisionReason`
- `runtimeClickDecision`
- `runtimeClickDecisionReason`
- `clickDecision`
- `clickDecisionReason`
- `targetIdentity` with status `match`, `benign_label_change`, `identity_mismatch`, or `dangerous_label_change`
- `targetIdentityCheckedBeforeScroll`
- `targetIdentityMismatchBeforeScroll`
- `visualDiff`
- `pointerTrace`
- `animationTrace` when motion audit is enabled

The action trace also includes a root `planner` object with the selected mode and action/click/depth/state-change budgets. On action records, `clickDecision` and `clickDecisionReason` are compatibility aliases for the runtime decision. Prefer runtimeClickDecision and `runtimeClickDecisionReason` in new consumers. On click candidates, `clickDecision` and `clickDecisionReason` are compatibility aliases for the planner decision. Prefer plannerClickDecision and `plannerClickDecisionReason` in new consumers. Candidate records preserve the original planned identity in fields such as `originalVisibleText`, `originalDataUxAction`, and `originalIdentitySignature`, while later recollection writes `latestVisibleText`, `latestDataUxAction`, and `latestIdentitySignature`. This makes safe behavior legible when the planner allowed the original target but runtime skipped the latest live target because of cursor target drift, blockage, stale DOM, identity mismatch, dangerous label change, or navigation safety.

Target ids are stable within a page. `collectVisibleInteractiveTargets()` and `collectScrollableTargets()` do not overwrite an existing `data-ux-sentinel-target-id`; new targets receive monotonic ids (`t0001`, `t0002`, ... for interactive targets and `s0001`, `s0002`, ... for scroll targets). Replanning after a state change adds newly discovered controls without corrupting old planned actions. Before any user-like scroll, hover, focus, or click, `resolveLiveTargetIdentityOnly()` checks the live element without scrolling. The full `resolveLiveTarget()` still runs after scroll to verify visibility, viewport, and identity again.

Target identity uses strict structural matching for tag, role, href, `data-ux-role`, `data-ux-action`, and `data-ux-clickable`, then separately classifies label drift. Counter, punctuation, whitespace, and safe suffix changes such as `Notifications` -> `Notifications 2` or `Open details` -> `Open details expanded` can be recorded as `benign_label_change`; non-dangerous structural drift remains `identity_mismatch`; destructive/payment/logout/removal/irreversible live labels take `dangerous_label_change` precedence even when structure also changed, while still recording `structuralSignatureMatches: false`. Mismatched and dangerous targets are skipped before scroll, hover, focus, or click, and the contact sheet states whether the skip happened before scroll.

`state-graph.json` includes:

- state nodes with URL, viewport, screenshot, screen map path, accessibility hash, visible text hash, DOM structure hash, open UI state with id/bbox/ARIA/data-state evidence, console error count, and network error count
- action edges with action id, action type, target id, target category, planner reason/risk/depth/priority, skipped/skip reason, planner/runtime click decisions, target identity status when present, before/after state ids, before/after screenshots, visual diff path, DOM diff path, accessibility diff path, pointer trace path plus cursor movement summary, finding detectors, and attached finding summaries with evidence, impact, suggested fix, regression check, and rule metadata

`trace-manifest.json` is written beside the action trace and state graph. It indexes root artifacts, click candidate original/latest identity fields, click candidate planner/runtime decisions, per-action target identity status, per-action evidence files, state/finding counts, planner metadata, and the resolved capability policy so a reviewer or Codex can quickly verify that the bundle is complete before drilling into individual files.

Visual diffs are written as `actions/aNNN-diff.png`. They are generated by composing the before and after screenshots with a deterministic difference blend, so reviewers can quickly spot visible changes without requiring a server or external image service.

Pointer traces are written as `actions/aNNN-pointer-trace.json`. They record the start point, target center, intermediate points, movement and hover duration, whether the target moved during approach, whether an overlay appeared, and whether the final `elementFromPoint` still matched the target. `action-trace.json`, `state-graph.json`, and `contact-sheet.html` also include a compact pointer summary with point count, movement duration, hover duration, target movement, overlay appearance, and final hit-test status. If a safe click was otherwise allowed but the final hit-test drifts away from the target, the runner skips the click and records `cursor target drift`.

Animation traces are written as `actions/aNNN-animation-trace.json` only when motion audit is enabled. They record phased samples (`before_interaction`, `after_hover_immediate`, `after_focus_immediate`, `after_click_immediate`, `after_settle`, and optional `reduced_motion_comparison`), CSS transition/animation evidence, Web Animations API entries, risky properties, normal/reduced motion media environment, optional reduced-motion comparison, target bbox movement, and browser long-task markers when available. Action records and contact sheets also include a compact `animationTraceSummary` with sampled phases so reviewers can see motion risk and the active media preference without opening the full trace first. See [MOTION_AUDIT.md](MOTION_AUDIT.md).

Rule mappings live in [UX_RULE_REGISTRY.md](UX_RULE_REGISTRY.md). Enriched findings include `ruleIds`, `ruleFamily`, `whyThisMatters`, `confidence`, and optional evidence paths. Reports render this as `UX rules`, `Rule family`, `Why this matters`, `Evidence status`, and `Confidence`.

When a scenario sets `ux_rule_profile.enabled: true`, reports also show the selected rule sets and whether the scenario requires rule mapping. This profile is declarative: it documents the intended professional review lens while the deterministic enrichment layer continues to attach the concrete rule evidence.

The expanded detector batches add target-size, target-spacing, visible affordance, visible/accessibility label mismatch, unnamed dialog checks, dialog/modal escape checks, popover-over-primary checks, graph/DAG control and traceability checks, unannounced status checks, empty/loading/dead-end recovery checks, focus-ring, focus-obscuring, destructive-action cue, click-feedback, primary-action visual hierarchy, and label/action consistency checks. These rely on screen-map bbox/style evidence, `aria-live`, `aria-labelledby`, `aria-modal`, `visualWeight`, `data-ux-action`, `data-ux-role`, focus evidence, pointer hit-tests, or state diffs.

The contact sheet now acts as the professional review surface for this evidence. It remains a static local HTML file and includes a reviewer answer matrix for what the agent did, what it clicked or avoided, what changed, which evidence supports the result, and which UX rule or fix applies; severity, detector, rule-family, and confidence filters; an action timeline; a state graph summary; a static state graph map; a state transition path for reconstructing `beforeStateId -> afterStateId` edges; pointer movement metadata; a safety log that separates planned click decision, runtime click decision, runtime reason, identity mismatch, stale target, and cursor target drift; local links to before/after/diff/screen-map evidence artifacts for each action; accessibility and animation audit sections; bbox overlays on before/after/diff panels; linked pointer, animation, DOM diff, and accessibility diff artifacts; UX principle mapping with confidence metadata; and per-action/global finding details for evidence status, concrete evidence, user impact, suggested fix, and regression check.

## Current Limits

This is the planner foundation, not the full professional audit surface yet. Upcoming work should add:

- expanded detector batches
- richer graph visualization for branching or repeated-state runs
- broader branching visualization for multiple discovered-control paths
