import type { UxRule } from "./registry.js";

export const interactionLawRules: UxRule[] = [
  {
    id: "interaction_law.fitts_law",
    family: "interaction_law",
    title: "Fitts's Law",
    principle: "Targets should be large, stable, and sufficiently spaced for the user's pointer path.",
    appliesTo: ["hover", "focus", "click"],
    detectors: ["click_target_too_small", "click_target_spacing_too_tight", "cursor_target_drift", "target_moved_during_cursor_approach"],
    severityDefault: "P2",
    evidenceRequired: ["bbox", "pointer_trace"]
  },
  {
    id: "interaction_law.visual_hierarchy",
    family: "interaction_law",
    title: "Visual hierarchy and action priority",
    principle: "The primary action should have enough visual weight and location priority that users do not hunt for it.",
    appliesTo: ["static", "hover", "scroll"],
    detectors: [
      "primary_cta_missing",
      "primary_cta_below_fold",
      "primary_cta_low_visual_weight",
      "multiple_primary_ctas_conflict",
      "secondary_action_overpowers_primary",
      "important_text_below_fold_without_cue"
    ],
    severityDefault: "P1",
    evidenceRequired: ["screenshot", "screen_map"]
  },
  {
    id: "interaction_law.feedback_loop",
    family: "interaction_law",
    title: "Feedback loop",
    principle: "After an action, the user needs visible feedback, recovery, or confirmation that matches the action consequence.",
    appliesTo: ["click", "focus"],
    detectors: ["safe_click_changed_unrelated_state", "no_feedback_after_action", "dead_end_state_without_recovery", "focus_caused_context_change"],
    severityDefault: "P1",
    evidenceRequired: ["before_after", "dom_diff"]
  }
];
