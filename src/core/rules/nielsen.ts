import type { UxRule } from "./registry.js";

export const nielsenRules: UxRule[] = [
  {
    id: "nielsen.visibility_of_system_status",
    family: "nielsen",
    title: "Visibility of system status",
    principle: "The interface should make current state, progress, and consequences visible without requiring DOM knowledge.",
    appliesTo: ["static", "hover", "focus", "click", "scroll"],
    detectors: ["no_feedback_after_action", "status_change_not_announced", "loading_without_progress_or_timeout"],
    severityDefault: "P1",
    evidenceRequired: ["screenshot", "before_after"]
  },
  {
    id: "nielsen.match_real_world",
    family: "nielsen",
    title: "Match between system and the real world",
    principle: "Visible labels and empty states should use language that helps a human understand the next action.",
    appliesTo: ["static", "hover", "click"],
    detectors: ["primary_cta_missing", "empty_state_without_cta", "empty_state_without_next_step", "dom_visible_but_human_invisible"],
    severityDefault: "P1",
    evidenceRequired: ["screenshot", "screen_map"]
  },
  {
    id: "nielsen.recognition_over_recall",
    family: "nielsen",
    title: "Recognition rather than recall",
    principle: "Primary actions should be recognizable from visible copy and affordance, not remembered from hidden labels or test hints.",
    appliesTo: ["static", "hover", "focus"],
    detectors: ["primary_cta_icon_only", "icon_button_without_visible_label", "clickable_without_visible_affordance"],
    severityDefault: "P1",
    evidenceRequired: ["screenshot", "screen_map", "a11y_snapshot"]
  },
  {
    id: "nielsen.error_prevention",
    family: "nielsen",
    title: "Error prevention",
    principle: "The UI should prevent misclicks, accidental destructive actions, and hidden target changes before the user commits.",
    appliesTo: ["hover", "click"],
    detectors: [
      "click_target_blocked_by_overlay",
      "cursor_target_drift",
      "hover_trigger_blocks_target",
      "dialog_close_unavailable",
      "modal_trap_without_escape",
      "destructive_action_without_confirmation"
    ],
    severityDefault: "P1",
    evidenceRequired: ["hit_test", "before_after"]
  }
];
