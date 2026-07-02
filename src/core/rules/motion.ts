import type { UxRule } from "./registry.js";

export const motionRules: UxRule[] = [
  {
    id: "motion.reduced_motion_respect",
    family: "motion",
    title: "Reduced motion respect",
    principle: "Motion should respect reduced-motion preferences and avoid hiding critical actions during task flow.",
    appliesTo: ["animation", "hover", "click"],
    detectors: ["animation_ignores_reduced_motion", "animation_hides_critical_action", "animation_duration_blocks_task"],
    severityDefault: "P1",
    evidenceRequired: ["animation_trace", "before_after"]
  },
  {
    id: "motion.stable_spatial_transition",
    family: "motion",
    title: "Stable spatial transition",
    principle: "Movement should not cause targets to jump, drift, or become unclickable as the user approaches them.",
    appliesTo: ["hover", "click", "animation"],
    detectors: [
      "target_moved_during_cursor_approach",
      "overlay_appeared_during_cursor_approach",
      "animation_causes_layout_shift",
      "animation_uses_layout_paint_properties",
      "animation_jank_detected",
      "inconsistent_motion_tokens"
    ],
    severityDefault: "P2",
    evidenceRequired: ["pointer_trace"]
  }
];
