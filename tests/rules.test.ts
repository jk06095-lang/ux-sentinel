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
  "clickable_without_visible_affordance",
  "looks_clickable_but_not_actionable",
  "click_target_too_small",
  "click_target_spacing_too_tight",
  "visible_label_not_in_accessible_name",
  "aria_label_contradicts_visible_text",
  "focus_ring_missing",
  "focus_obscured_by_author_content",
  "keyboard_target_not_reachable",
  "no_feedback_after_action",
  "destructive_action_without_confirmation",
  "click_target_blocked_by_overlay",
  "target_moved_during_cursor_approach",
  "overlay_appeared_during_cursor_approach",
  "hover_trigger_blocks_target",
  "cursor_target_drift",
  "floating_panel_overlaps_primary_action",
  "tooltip_partially_offscreen",
  "text_occluded_by_graph_edge",
  "edge_label_crosses_node",
  "card_content_clipped",
  "card_overlap",
  "dag_canvas_excessive_unused_space",
  "empty_dag_column_without_explanation",
  "animation_ignores_reduced_motion",
  "animation_duration_blocks_task",
  "animation_causes_layout_shift",
  "animation_uses_layout_paint_properties"
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
