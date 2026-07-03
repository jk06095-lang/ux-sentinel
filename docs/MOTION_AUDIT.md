# Motion Audit

Motion audit is an optional extension for interactive audit. It stays local-first and deterministic: ux-sentinel uses Playwright to inspect CSS transitions, CSS animations, Web Animations API entries, target bboxes, risky animated properties, optional reduced-motion comparison, and browser long-task markers when the Long Task API is available.

Motion audit is disabled by default. Enable it only from a scenario:

```yaml
animation_audit:
  enabled: true
  compare_reduced_motion: true
  detect_layout_shift: true
  detect_risky_properties: true
  max_animation_ms: 1200
```

## Evidence

When enabled, each hover, focus, or click-capable action can write:

```text
actions/a001-animation-trace.json
```

The trace records:

- action id
- normal-motion media environment (`prefers-reduced-motion: no-preference`)
- normal-motion animation and transition evidence
- optional reduced-motion media environment (`prefers-reduced-motion: reduce`)
- optional reduced-motion comparison evidence
- animated properties
- duration, delay, and easing
- target bbox before and after the action
- approximate target layout shift
- risky properties such as `top`, `left`, `width`, `height`, `margin`, `padding`, `font-size`, `box-shadow`, and `filter`
- `longTasks` markers from `PerformanceObserver` / `performance.getEntriesByType("longtask")` when the browser exposes them

The contact sheet links the animation trace beside pointer trace and focus evidence, and also shows a compact per-action animation summary: animated target count, risky properties, approximate layout shift, normal/reduced motion media environment, reduced-motion status, long-task count, max long-task duration, and Long Task API availability. Findings include the action id, target id, trace path, affected properties, and a regression check.

## Detectors

The current deterministic motion batch includes:

- `animation_ignores_reduced_motion`
- `animation_hides_critical_action`
- `animation_duration_blocks_task`
- `animation_causes_layout_shift`
- `animation_uses_layout_paint_properties`
- `animation_jank_detected`
- `inconsistent_motion_tokens`

Reduced-motion comparison is optional and only runs when `compare_reduced_motion: true`. Normal evidence is collected under explicit `prefers-reduced-motion: no-preference`; the comparison emulates `prefers-reduced-motion: reduce` and records `reducedMotionEnvironment` so the trace proves the browser media query matched the reduced-motion preference before comparing whether elements that animate normally still report animation or transition evidence.
Critical-action hiding findings only fire for targets classified as `primary_cta`, and only when the primary action itself has visibility-affecting transition evidence such as `opacity`, `filter`, or `all` lasting more than 150ms.
Jank and token-consistency findings are deterministic trace heuristics: they use visible animated element counts, risky property evidence, target bbox movement, long-task markers when available, duration spread, and easing spread from `actions/aNNN-animation-trace.json`.

## Demo Gate

`demo/scenarios/interactive-motion.yaml` runs against `demo/interactive-motion.html` and intentionally fails. It enables `animation_audit`, safe scenario clicking, reduced-motion comparison, and a low `max_animation_ms` threshold so the demo verifier can prove:

- `actions/a001-animation-trace.json` is written.
- the trace records normal-motion, reduced-motion, and available long-task marker evidence.
- motion detector ids are attached to the interactive action.
- `state-graph.json` links the animation trace.
- `contact-sheet.html` exposes the animation audit evidence.

Run it through the full demo gate:

```bash
npm run demo:verify
```

Or manually:

```bash
node dist/cli.js run demo/scenarios/interactive-motion.yaml --url http://127.0.0.1:4173/interactive-motion --interactive --max-actions 1
```

## Limits

- This is not a video or visual-AI motion review.
- Layout shift is an approximation based on target bbox movement around the action.
- Long-task markers depend on browser PerformanceObserver support; unsupported browsers record an empty `longTasks` array with `longTaskApiAvailable: false`.
- Motion findings are evidence-backed heuristics; review the screenshots and trace before treating them as final.
