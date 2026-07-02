import type { Finding, FindingConfidence, Severity, UxEvidenceKind, UxRuleFamily } from "../types.js";
import { gestaltRules } from "./gestalt.js";
import { graphDagRules } from "./graph-dag.js";
import { interactionLawRules } from "./interaction-laws.js";
import { motionRules } from "./motion.js";
import { nielsenRules } from "./nielsen.js";
import { wcag22Rules } from "./wcag22.js";

export interface UxRule {
  id: string;
  family: UxRuleFamily;
  title: string;
  principle: string;
  appliesTo: Array<"static" | "hover" | "focus" | "click" | "scroll" | "animation">;
  detectors: string[];
  severityDefault: Severity;
  evidenceRequired: UxEvidenceKind[];
}

const localProductRules: UxRule[] = [
  {
    id: "local.perception_mismatch",
    family: "local_product_rule",
    title: "Perception mismatch",
    principle:
      "A UI can be operable in the DOM but still fail if the human-visible state, primary action, consequence, or recovery path is unclear.",
    appliesTo: ["static", "hover", "focus", "click", "scroll"],
    detectors: [
      "primary_cta_missing",
      "primary_cta_icon_only",
      "empty_state_without_cta",
      "dom_visible_but_human_invisible",
      "primary_cta_below_fold",
      "important_text_truncated",
      "card_content_clipped",
      "clickable_without_visible_affordance",
      "looks_clickable_but_not_actionable",
      "same_label_different_actions",
      "same_action_different_labels"
    ],
    severityDefault: "P1",
    evidenceRequired: ["screenshot", "screen_map"]
  },
  {
    id: "local.runtime_evidence_integrity",
    family: "local_product_rule",
    title: "Runtime evidence integrity",
    principle: "Console and network failures can make visual evidence misleading, so they must be surfaced alongside UX findings.",
    appliesTo: ["static"],
    detectors: ["console_error", "network_5xx"],
    severityDefault: "P1",
    evidenceRequired: ["screen_map"]
  },
  {
    id: "local.interactive_safety_evidence",
    family: "local_product_rule",
    title: "Interactive safety evidence",
    principle: "Interactive audit should explain what it clicked, avoided, or skipped with machine-readable evidence.",
    appliesTo: ["hover", "focus", "click", "scroll"],
    detectors: [
      "click_target_blocked_by_overlay",
      "overlay_appeared_during_cursor_approach",
      "hover_trigger_blocks_target",
      "hover_content_blocks_trigger",
      "cursor_target_drift",
      "target_moved_during_cursor_approach",
      "tooltip_partially_offscreen"
    ],
    severityDefault: "P1",
    evidenceRequired: ["before_after", "hit_test", "pointer_trace"]
  }
];

export const uxRules: UxRule[] = [
  ...nielsenRules,
  ...wcag22Rules,
  ...motionRules,
  ...gestaltRules,
  ...interactionLawRules,
  ...graphDagRules,
  ...localProductRules
];

export function allUxRules(): UxRule[] {
  return uxRules;
}

export function rulesForDetector(detector: string): UxRule[] {
  return uxRules.filter((rule) => rule.detectors.includes(detector));
}

export function unmappedDetectors(detectors: string[]): string[] {
  return detectors.filter((detector) => rulesForDetector(detector).length === 0);
}

function inferEvidencePaths(finding: Finding): Record<string, string> | undefined {
  const paths = { ...(finding.evidencePaths ?? {}) };
  const pointerTraceMatch = finding.evidence.match(/Pointer trace: ([^\n]+?a\d{3}-pointer-trace\.json)/);
  if (pointerTraceMatch) {
    paths.pointerTrace = pointerTraceMatch[1];
  }
  const animationTraceMatch = finding.evidence.match(/Animation trace: ([^\n]+?a\d{3}-animation-trace\.json)/);
  if (animationTraceMatch) {
    paths.animationTrace = animationTraceMatch[1];
  }
  const domDiffMatch = finding.evidence.match(/DOM diff: ([^\n]+?a\d{3}-dom-diff\.json)/);
  if (domDiffMatch) {
    paths.domDiff = domDiffMatch[1];
  }
  return Object.keys(paths).length ? paths : undefined;
}

function confidenceForFinding(finding: Finding, rules: UxRule[]): FindingConfidence {
  if (!rules.length || !finding.evidence.trim()) {
    return "low";
  }

  const required = new Set(rules.flatMap((rule) => rule.evidenceRequired));
  if (required.has("pointer_trace") && !finding.evidencePaths?.pointerTrace && !/pointer trace/i.test(finding.evidence)) {
    return "medium";
  }
  if (required.has("animation_trace") && !finding.evidencePaths?.animationTrace && !/animation trace/i.test(finding.evidence)) {
    return "medium";
  }
  if (required.has("dom_diff") && !finding.evidencePaths?.domDiff && !/dom diff/i.test(finding.evidence)) {
    return "medium";
  }
  if (
    required.has("before_after") &&
    (!finding.evidencePaths?.beforeScreenshot || !finding.evidencePaths?.afterScreenshot) &&
    !/before\/after|before and after/i.test(finding.evidence)
  ) {
    return "medium";
  }
  if (required.has("visual_diff") && !finding.evidencePaths?.visualDiff && !/visual diff/i.test(finding.evidence)) {
    return "medium";
  }
  if (required.has("a11y_diff") && !finding.evidencePaths?.accessibilityDiff && !/a11y diff|accessibility diff/i.test(finding.evidence)) {
    return "medium";
  }
  if (required.has("bbox") && !/(bbox|overlap|intersect|covered|extends|width|height|x=|y=|\d+x\d+)/i.test(finding.evidence)) {
    return "medium";
  }
  if (required.has("hit_test") && !/(hit-test|elementFromPoint|covered|blocked|pointer|cursor)/i.test(finding.evidence)) {
    return "medium";
  }

  return "high";
}

export function enrichFindingWithRules(finding: Finding): Finding {
  const rules = rulesForDetector(finding.detector);
  const evidencePaths = inferEvidencePaths(finding);
  const enriched: Finding = {
    ...finding,
    evidencePaths,
    ruleIds: rules.map((rule) => rule.id),
    ruleFamily: rules[0]?.family,
    whyThisMatters: rules.map((rule) => `${rule.title}: ${rule.principle}`).slice(0, 2).join(" "),
    confidence: confidenceForFinding({ ...finding, evidencePaths }, rules)
  };

  if (!rules.length) {
    enriched.whyThisMatters = "No UX rule mapping exists yet; treat this finding as lower confidence until a rule is added.";
  }

  return enriched;
}

export function enrichFindingsWithRules(findings: Finding[]): Finding[] {
  return findings.map(enrichFindingWithRules);
}
