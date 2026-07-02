import type { UxRule } from "./registry.js";

export const gestaltRules: UxRule[] = [
  {
    id: "gestalt.common_region",
    family: "gestalt",
    title: "Common region and grouping",
    principle: "Visual groups should have clear boundaries so users can tell which text, controls, and panels belong together.",
    appliesTo: ["static", "hover", "scroll"],
    detectors: [
      "card_overlap",
      "responsive_layout_breakpoint_overlap",
      "floating_panel_overlaps_primary_action",
      "popover_blocks_primary_action",
      "sticky_layer_hides_content"
    ],
    severityDefault: "P2",
    evidenceRequired: ["screenshot", "bbox"]
  },
  {
    id: "gestalt.figure_ground",
    family: "gestalt",
    title: "Figure-ground clarity",
    principle: "Foreground overlays, graph edges, and labels should not obscure the content or action the user needs to perceive.",
    appliesTo: ["static", "hover", "click"],
    detectors: [
      "text_occluded_by_graph_edge",
      "edge_crosses_critical_label",
      "tooltip_partially_offscreen",
      "tooltip_blocks_trigger",
      "floating_panel_overlaps_primary_action"
    ],
    severityDefault: "P2",
    evidenceRequired: ["screenshot", "bbox"]
  }
];
