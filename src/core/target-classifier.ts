import { defaultPreferredLabels } from "./scenario.js";
import type { InteractiveRiskLevel, InteractiveTarget, InteractiveTargetCategory, Scenario } from "./types.js";

export interface TargetClassification {
  category: InteractiveTargetCategory;
  riskLevel: InteractiveRiskLevel;
  priority: number;
  reason: string;
}

function normalizedText(target: Pick<InteractiveTarget, "visibleText" | "ariaLabel" | "title" | "dataUxRole" | "dataUxAction">): string {
  return [target.visibleText, target.ariaLabel, target.title, target.dataUxRole, target.dataUxAction]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function labelMatchesPreferred(target: InteractiveTarget, scenario?: Scenario): boolean {
  const labels = scenario?.visual_contract?.primary_cta?.preferred_labels?.length
    ? scenario.visual_contract.primary_cta.preferred_labels
    : defaultPreferredLabels;
  const value = normalizedText(target);

  return labels.some((label) => {
    const preferred = label.replace(/\s+/g, " ").trim().toLowerCase();
    return Boolean(preferred) && (value === preferred || value.includes(preferred));
  });
}

function riskForTarget(target: InteractiveTarget, category: InteractiveTargetCategory): InteractiveRiskLevel {
  if (
    target.skipClickReason === "dangerous label" ||
    target.skipClickReason === "inside form" ||
    target.skipClickReason === "unsafe input type" ||
    target.skipClickReason === "disabled"
  ) {
    return "high";
  }
  if (target.skipClickReason === "navigation link" || category === "navigation" || category === "form_adjacent_control") {
    return "medium";
  }
  return target.safeToClick ? "low" : "medium";
}

function priorityForCategory(category: InteractiveTargetCategory, target: InteractiveTarget): number {
  const categoryPriority: Record<InteractiveTargetCategory, number> = {
    primary_cta: 10,
    tab: 20,
    menu: 24,
    navigation: 28,
    tooltip_help_trigger: 32,
    dialog_trigger: 36,
    dropdown: 40,
    expandable_section: 44,
    secondary_cta: 48,
    card: 58,
    graph_dag_control: 64,
    graph_dag_node: 68,
    scroll_container: 76,
    form_adjacent_control: 84,
    ambiguous_clickable: 96
  };

  return categoryPriority[category] + (target.safeToClick ? 0 : 6);
}

export function classifyInteractiveTarget(target: InteractiveTarget, scenario?: Scenario): TargetClassification {
  const text = normalizedText(target);
  const role = target.role?.toLowerCase() ?? "";
  const tag = target.tag.toLowerCase();
  const dataRole = target.dataUxRole?.toLowerCase() ?? "";
  const action = target.dataUxAction?.toLowerCase() ?? "";
  let category: InteractiveTargetCategory = "ambiguous_clickable";
  let reason = "fallback ambiguous interactive target";

  if (labelMatchesPreferred(target, scenario)) {
    category = "primary_cta";
    reason = "matches the scenario primary CTA labels";
  } else if (dataRole.includes("dag") || dataRole.includes("graph") || action.includes("node")) {
    if (/control|toolbar|zoom|pan|filter|layout/.test(dataRole + " " + action + " " + text)) {
      category = "graph_dag_control";
      reason = "graph or DAG control metadata";
    } else {
      category = "graph_dag_node";
      reason = "graph or DAG node metadata";
    }
  } else if (role === "tab") {
    category = "tab";
    reason = "ARIA tab target";
  } else if (role === "menuitem" || /menu/.test(action + " " + text)) {
    category = "menu";
    reason = "menu or menuitem target";
  } else if (tag === "select" || /dropdown|combobox|select/.test(role + " " + action + " " + text)) {
    category = "dropdown";
    reason = "dropdown or selection control";
  } else if (tag === "summary" || /accordion|expand|details?|more/.test(action + " " + text)) {
    category = "expandable_section";
    reason = "expander or detail panel trigger";
  } else if (target.href || tag === "a" || role === "link") {
    category = "navigation";
    reason = "link or navigation-like target";
  } else if (/help|tooltip|hint|\?|info/.test(action + " " + text)) {
    category = "tooltip_help_trigger";
    reason = "help or tooltip-like trigger";
  } else if (/dialog|modal|popover|panel|drawer/.test(action + " " + text)) {
    category = "dialog_trigger";
    reason = "dialog or popover trigger";
  } else if (dataRole.includes("card")) {
    category = "card";
    reason = "card metadata target";
  } else if (target.skipClickReason === "inside form" || ["input", "textarea", "select"].includes(tag)) {
    category = "form_adjacent_control";
    reason = "form-adjacent target";
  } else if (target.safeToClick || role === "button" || tag === "button") {
    category = "secondary_cta";
    reason = "clickable action target without primary CTA label match";
  }

  return {
    category,
    riskLevel: riskForTarget(target, category),
    priority: priorityForCategory(category, target),
    reason
  };
}
