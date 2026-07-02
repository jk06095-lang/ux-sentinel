import { describe, expect, it } from "vitest";
import { enrichFindingWithRules, rulesForDetector, unmappedDetectors } from "../src/core/rules/registry.js";
import type { Finding } from "../src/core/types.js";

const knownDetectors = [
  "primary_cta_missing",
  "primary_cta_icon_only",
  "empty_state_without_cta",
  "dom_visible_but_human_invisible",
  "primary_cta_below_fold",
  "horizontal_scroll",
  "console_error",
  "network_5xx",
  "important_text_truncated",
  "important_text_below_fold_without_cue",
  "clickable_without_visible_affordance",
  "looks_clickable_but_not_actionable",
  "click_target_too_small",
  "click_target_spacing_too_tight",
  "visible_label_not_in_accessible_name",
  "icon_button_without_visible_label",
  "aria_label_contradicts_visible_text",
  "status_change_not_announced",
  "dialog_without_accessible_name",
  "focus_ring_missing",
  "focus_obscured_by_author_content",
  "focus_order_unexpected_jump",
  "focus_caused_context_change",
  "keyboard_target_not_reachable",
  "no_feedback_after_action",
  "safe_click_changed_unrelated_state",
  "loading_without_progress_or_timeout",
  "dead_end_state_without_recovery",
  "empty_state_without_next_step",
  "dialog_close_unavailable",
  "modal_trap_without_escape",
  "popover_blocks_primary_action",
  "destructive_action_without_confirmation",
  "primary_cta_low_visual_weight",
  "multiple_primary_ctas_conflict",
  "secondary_action_overpowers_primary",
  "same_label_different_actions",
  "same_action_different_labels",
  "click_target_blocked_by_overlay",
  "target_moved_during_cursor_approach",
  "overlay_appeared_during_cursor_approach",
  "hover_trigger_blocks_target",
  "cursor_target_drift",
  "floating_panel_overlaps_primary_action",
  "tooltip_partially_offscreen",
  "tooltip_blocks_trigger",
  "sticky_layer_hides_content",
  "text_occluded_by_graph_edge",
  "edge_label_crosses_node",
  "selected_path_not_traceable",
  "edge_crosses_critical_label",
  "graph_control_not_discoverable",
  "node_label_truncated",
  "card_content_clipped",
  "card_overlap",
  "dag_canvas_excessive_unused_space",
  "empty_dag_column_without_explanation",
  "animation_ignores_reduced_motion",
  "animation_hides_critical_action",
  "animation_duration_blocks_task",
  "animation_causes_layout_shift",
  "animation_uses_layout_paint_properties",
  "animation_jank_detected",
  "inconsistent_motion_tokens"
];

describe("UX rule registry", () => {
  it("maps every implemented detector to at least one UX rule", () => {
    expect(unmappedDetectors(knownDetectors)).toEqual([]);
  });

  it("enriches findings with rule metadata and confidence", () => {
    const finding: Finding = {
      id: "UX-001",
      detector: "empty_state_without_cta",
      title: "Empty state has no visible primary CTA",
      severity: "P1",
      type: "Perception Mismatch",
      evidence: "Visible page text looks like an empty state.",
      userImpact: "A user cannot identify the next step.",
      suggestedFix: "Add a visible CTA.",
      regressionCheck: "Run the empty-state scenario again."
    };

    const enriched = enrichFindingWithRules(finding);

    expect(enriched.ruleIds).toContain("nielsen.match_real_world");
    expect(enriched.ruleFamily).toBe("nielsen");
    expect(enriched.whyThisMatters).toContain("Match between system and the real world");
    expect(enriched.confidence).toBe("high");
  });

  it("links pointer trace detectors to pointer-trace evidence requirements", () => {
    const rules = rulesForDetector("cursor_target_drift");

    expect(rules.map((rule) => rule.id)).toEqual(expect.arrayContaining(["nielsen.error_prevention", "interaction_law.fitts_law"]));
    expect(rules.some((rule) => rule.evidenceRequired.includes("pointer_trace"))).toBe(true);
  });

  it("links animation detectors to animation-trace evidence requirements", () => {
    const rules = rulesForDetector("animation_ignores_reduced_motion");

    expect(rules.map((rule) => rule.id)).toContain("motion.reduced_motion_respect");
    expect(rules.some((rule) => rule.evidenceRequired.includes("animation_trace"))).toBe(true);
  });
});
