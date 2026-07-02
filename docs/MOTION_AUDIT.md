# Motion Audit

Motion audit is an optional extension for interactive audit. It stays local-first and deterministic: ux-sentinel uses Playwright to inspect CSS transitions, CSS animations, Web Animations API entries, target bboxes, risky animated properties, and optional reduced-motion comparison.

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
- normal-motion animation and transition evidence
- optional reduced-motion comparison evidence
- animated properties
- duration, delay, and easing
- target bbox before and after the action
- approximate target layout shift
- risky properties such as `top`, `left`, `width`, `height`, `margin`, `padding`, `font-size`, `box-shadow`, and `filter`

The contact sheet links the animation trace beside pointer trace and focus evidence. Findings include the action id, target id, trace path, affected properties, and a regression check.

## Detectors

The current deterministic motion batch includes:

- `animation_ignores_reduced_motion`
- `animation_duration_blocks_task`
- `animation_causes_layout_shift`
- `animation_uses_layout_paint_properties`
- `animation_jank_detected`
- `inconsistent_motion_tokens`

Reduced-motion comparison is optional and only runs when `compare_reduced_motion: true`. It emulates `prefers-reduced-motion: reduce` and compares whether elements that animate normally still report animation or transition evidence under the reduced-motion preference.
Jank and token-consistency findings are deterministic trace heuristics: they use visible animated element counts, risky property evidence, target bbox movement, duration spread, and easing spread from `actions/aNNN-animation-trace.json`.

## Limits

- This is not a video or visual-AI motion review.
- Layout shift is an approximation based on target bbox movement around the action.
- Long tasks are not yet measured directly.
- Motion findings are evidence-backed heuristics; review the screenshots and trace before treating them as final.
