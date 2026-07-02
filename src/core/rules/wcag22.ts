import type { UxRule } from "./registry.js";

export const wcag22Rules: UxRule[] = [
  {
    id: "wcag22.name_role_value",
    family: "wcag",
    title: "Name, role, value",
    principle: "Visible controls and accessibility names should communicate the same purpose to sighted and assistive-technology users.",
    appliesTo: ["static", "hover", "focus", "click"],
    detectors: [
      "visible_label_not_in_accessible_name",
      "aria_label_contradicts_visible_text",
      "dialog_without_accessible_name",
      "primary_cta_icon_only",
      "dom_visible_but_human_invisible"
    ],
    severityDefault: "P1",
    evidenceRequired: ["screen_map", "a11y_snapshot"]
  },
  {
    id: "wcag22.focus_visible",
    family: "wcag",
    title: "Focus visible",
    principle: "Keyboard users need a visible, unobscured focus indicator that follows a predictable path.",
    appliesTo: ["focus"],
    detectors: [
      "focus_ring_missing",
      "focus_obscured_by_author_content",
      "focus_order_unexpected_jump",
      "keyboard_target_not_reachable",
      "modal_trap_without_escape",
      "dialog_close_unavailable"
    ],
    severityDefault: "P1",
    evidenceRequired: ["before_after", "screenshot"]
  },
  {
    id: "wcag22.reflow_and_readability",
    family: "wcag",
    title: "Reflow and readable content",
    principle: "Important content should remain readable without two-dimensional scrolling, clipping, or overlap at the audited viewport.",
    appliesTo: ["static", "scroll"],
    detectors: ["horizontal_scroll", "important_text_truncated", "card_content_clipped", "text_truncated"],
    severityDefault: "P1",
    evidenceRequired: ["screenshot", "bbox"]
  }
];
