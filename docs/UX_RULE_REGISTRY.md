# UX Rule Registry

The UX rule registry maps detector names to professional UX principles. It keeps findings from being only ad hoc labels and gives reports a clear "Why this matters" explanation.

The implementation lives in:

- `src/core/rules/registry.ts`
- `src/core/rules/nielsen.ts`
- `src/core/rules/wcag22.ts`
- `src/core/rules/motion.ts`
- `src/core/rules/gestalt.ts`
- `src/core/rules/interaction-laws.ts`
- `src/core/rules/graph-dag.ts`

## Finding Metadata

Each enriched finding can include:

- `ruleIds`
- `ruleFamily`
- `whyThisMatters`
- `confidence`
- `evidencePaths`

Reports render this metadata as `UX rules`, `Rule family`, `Why this matters`, `Confidence`, and optional evidence paths.

## Rule Shape

```ts
export interface UxRule {
  id: string;
  family: "nielsen" | "wcag" | "motion" | "gestalt" | "interaction_law" | "graph_dag" | "local_product_rule";
  title: string;
  principle: string;
  appliesTo: Array<"static" | "hover" | "focus" | "click" | "scroll" | "animation">;
  detectors: string[];
  severityDefault: "P0" | "P1" | "P2" | "P3";
  evidenceRequired: Array<
    | "screenshot"
    | "before_after"
    | "visual_diff"
    | "bbox"
    | "screen_map"
    | "a11y_snapshot"
    | "hit_test"
    | "dom_diff"
    | "a11y_diff"
    | "pointer_trace"
    | "animation_trace"
  >;
}
```

## Current Rule Families

- Nielsen heuristics for status visibility, real-world language, recognition over recall, and error prevention.
- WCAG 2.2 interaction/readability rules for name-role-value, focus visibility, and reflow.
- Motion rules for reduced motion and stable spatial transitions.
- Gestalt rules for grouping and figure-ground clarity.
- Interaction-law rules for target size, visual hierarchy, and feedback loops.
- Graph/DAG rules for traceable paths and canvas orientation.
- Local product rules for perception mismatch, runtime evidence integrity, and interactive safety evidence.

## Current Detector Coverage

The registry currently maps the MVP detectors, interactive visual detectors, pointer-trace detectors, and the first expanded high-priority detector batch:

- click and affordance: `click_target_too_small`, `click_target_spacing_too_tight`, `clickable_without_visible_affordance`, `looks_clickable_but_not_actionable`, `click_target_blocked_by_overlay`
- focus and keyboard: `focus_ring_missing`, `focus_obscured_by_author_content`, `focus_caused_context_change`, `keyboard_target_not_reachable`
- label and accessibility: `visible_label_not_in_accessible_name`, `icon_button_without_visible_label`, `aria_label_contradicts_visible_text`, `dialog_without_accessible_name`, `primary_cta_icon_only`, `dom_visible_but_human_invisible`, `same_label_different_actions`, `same_action_different_labels`
- feedback and safety: `no_feedback_after_action`, `safe_click_changed_unrelated_state`, `status_change_not_announced`, `loading_without_progress_or_timeout`, `dead_end_state_without_recovery`, `empty_state_without_next_step`, `dialog_close_unavailable`, `modal_trap_without_escape`, `destructive_action_without_confirmation`
- visual hierarchy: `primary_cta_low_visual_weight`, `multiple_primary_ctas_conflict`, `secondary_action_overpowers_primary`, `important_text_below_fold_without_cue`
- layout, graph, and pointer traces: `card_overlap`, `card_content_clipped`, `popover_blocks_primary_action`, `tooltip_blocks_trigger`, `sticky_layer_hides_content`, `edge_label_crosses_node`, `edge_crosses_critical_label`, `selected_path_not_traceable`, `graph_control_not_discoverable`, `node_label_truncated`, `text_occluded_by_graph_edge`, `cursor_target_drift`, `target_moved_during_cursor_approach`, `overlay_appeared_during_cursor_approach`
- motion audit: `animation_ignores_reduced_motion`, `animation_hides_critical_action`, `animation_duration_blocks_task`, `animation_causes_layout_shift`, `animation_uses_layout_paint_properties`, `animation_jank_detected`, `inconsistent_motion_tokens`

## Adding A Detector

When adding a detector:

1. Emit concrete evidence first: screenshot, bbox, screen map, hit-test, pointer trace, DOM diff, or accessibility diff.
2. Add the detector name to at least one rule in `src/core/rules/`.
3. Pick the rule family that best explains the user impact.
4. If the detector needs new evidence, include it in `evidenceRequired`.
5. Add or update tests so `unmappedDetectors(...)` stays empty for implemented detectors.

Findings without sufficient evidence are marked lower confidence by the enrichment layer. Do not raise confidence by weakening evidence requirements.
