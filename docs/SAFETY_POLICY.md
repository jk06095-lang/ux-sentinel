# Interactive Audit Safety Policy

Interactive audit is local-first and deterministic. It can observe, hover, focus, scroll, and capture evidence in a real Playwright browser session, but it must not behave like an unrestricted browser agent.

## Capability Model

The interactive runner resolves a capability policy before actions are performed.

| Capability | Default | Notes |
| --- | --- | --- |
| `observe` | enabled | Required for screenshots, screen maps, accessibility snapshots, console errors, and network evidence. |
| `hover` | enabled | Used to inspect hover states and overlays. |
| `focus` | enabled | Used to inspect keyboard-target feedback. |
| `scroll` | enabled | Used to inspect scroll containers. |
| `safe_click` | disabled | Enabled only by standalone `explore --click-safe` or by scenario `interactive_exploration.click_all_safe_controls: true`. |
| `navigation` | disabled | Enabled only by scenario `interactive_exploration.allow_navigation: true`. |
| `typing` | disabled | The core runner does not type into forms. |
| `form_submit` | disabled | The core runner does not submit forms. |
| `destructive_action` | disabled | Destructive, payment, logout, removal, and irreversible actions are blocked. |

## Command Policy

Standalone exploration can enable safe clicks:

```bash
ux-sentinel explore --url http://localhost:3000 --click-safe
```

Scenario-driven interactive audit does not accept `--click-safe` as a one-off override. Clicking in `run --interactive` requires scenario opt-in:

```yaml
interactive_exploration:
  enabled: true
  click_all_safe_controls: true
```

Navigation remains disabled unless the scenario sets `interactive_exploration.allow_navigation: true`. Default target collection marks real `a[href]` navigation links as skipped with `navigation link`; the explicit opt-in path may click those links only after the same safe-click filters pass. `demo/scenarios/interactive-navigation-stop.yaml` verifies the default policy by clicking a safe-looking control that changes the URL, then asserting the runner stops remaining planned actions and records the stop note in the report, action trace, and contact sheet. `demo/scenarios/interactive-navigation-allow.yaml` verifies the explicit opt-in path with a real `a[href]` link to a destination page, replanning the next safe action, and asserting no stop note is recorded.

## Target Policy

`data-ux-role` is analysis metadata by default. A `data-ux-role` element can be clicked only when it is also natively interactive, has an interactive ARIA role, has `data-ux-clickable="true"`, or has `data-ux-action`.

The runner does not click:

- disabled controls
- form-contained controls
- submit, file, or password inputs
- navigation links unless navigation is explicitly allowed
- metadata-only `data-ux-role` elements
- targets with dangerous labels such as Delete, Remove, Pay, Purchase, Logout, Sign out, Account deletion, Deletion, Irreversible, 삭제, 제거, 결제, or 로그아웃
- safe-click candidates whose pointer trace shows the final hit-test drifted away from the intended target
- planned targets whose live DOM identity no longer matches the originally planned target

## Evidence Policy

Every action record in `action-trace.json` includes planner and runtime safe-click decisions:

- `allowed` when `safe_click` is enabled and the target passes filtering
- `skipped` when the target or policy blocks clicking
- `not_applicable` for actions such as scroll

Planner decisions are written as `plannerClickDecision` and `plannerClickDecisionReason`; runtime decisions are written as `runtimeClickDecision` and `runtimeClickDecisionReason`. The legacy `clickDecision` fields remain for compatibility and represent the runtime action decision on action records. `clickCandidates` in the action trace and trace manifest keep both planner and runtime fields so reports can show cases where the planner allowed a click but runtime skipped it because of cursor target drift, overlay blockage, stale target, identity mismatch, or navigation safety.

Target ids are stable during replanning. Existing `data-ux-sentinel-target-id` values are not overwritten; new interactive targets receive `t0001`, `t0002`, ... and new scroll targets receive `s0001`, `s0002`, .... Before any live action, ux-sentinel verifies that the live element still matches the planned target's semantic signature. If the id now points at a different label, role, href, or `data-ux-*` action, the action is skipped with `target identity mismatch`.

Skipped actions must keep before/after screenshots, a visual diff, a screen map, DOM diff, accessibility diff when available, and a clear skip reason. Hover, focus, and click-capable actions also write `actions/aNNN-pointer-trace.json` so a reviewer can inspect cursor movement, hover-triggered overlays, target movement, and final hit-test drift. The contact sheet shows planned click decision, runtime click decision, runtime reason, target identity status, visual diff path, and pointer trace path so a reviewer can see what the runner did and what it refused to do.
