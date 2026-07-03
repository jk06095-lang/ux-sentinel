import { classifyInteractiveTarget } from "./target-classifier.js";
import type { InteractiveTarget, InteractiveTargetCategory, InteractiveRiskLevel, Scenario } from "./types.js";

export type PlannedActionKind = "target" | "scroll";

export interface PlannerConfig {
  mode?: string;
  maxActions: number;
  maxDepth: number;
  maxClicks: number;
  maxStateChanges: number;
  safeClickEnabled: boolean;
  depth?: number;
}

export interface PlannedInteractiveAction {
  kind: PlannedActionKind;
  target: InteractiveTarget;
  targetCategory: InteractiveTargetCategory;
  riskLevel: InteractiveRiskLevel;
  plannedReason: string;
  priority: number;
  depth: number;
  plannedSafeClick: boolean;
  plannedClickSkipReason?: string;
  stateKey: string;
}

export interface PlanInteractiveActionsInput {
  targets: InteractiveTarget[];
  scrollTargets: InteractiveTarget[];
  scenario?: Scenario;
  config: PlannerConfig;
}

function targetText(target: InteractiveTarget): string {
  return [target.visibleText, target.ariaLabel, target.title].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function targetStateKey(kind: PlannedActionKind, target: InteractiveTarget, category: InteractiveTargetCategory): string {
  const text = targetText(target).toLowerCase();
  const box = `${Math.round(target.bbox.x / 8)}:${Math.round(target.bbox.y / 8)}:${Math.round(target.bbox.width / 8)}:${Math.round(target.bbox.height / 8)}`;
  return [
    kind,
    category,
    target.tag,
    target.role ?? "",
    target.ariaHasPopup ?? "",
    target.dataUxRole ?? "",
    target.dataUxAction ?? "",
    target.href ?? "",
    text,
    box
  ].join("|");
}

function plannedReason(kind: PlannedActionKind, category: InteractiveTargetCategory, reason: string, target: InteractiveTarget): string {
  const label = targetText(target) || target.id;
  if (kind === "scroll") {
    return `planned as scroll_container: inspect hidden content in ${label}`;
  }
  return `planned as ${category}: ${reason}`;
}

export function planInteractiveActions(input: PlanInteractiveActionsInput): PlannedInteractiveAction[] {
  const agenticMode = input.config.mode === "agentic";
  const candidates = [
    ...input.targets.map((target, index) => ({ kind: "target" as const, target, index })),
    ...input.scrollTargets.map((target, index) => ({ kind: "scroll" as const, target, index: input.targets.length + index }))
  ];
  const seen = new Set<string>();
  const planned = candidates
    .map((candidate) => {
      const classification =
        candidate.kind === "scroll"
          ? {
              category: "scroll_container" as const,
              riskLevel: "low" as const,
              priority: 76,
              reason: "scrollable container"
            }
          : classifyInteractiveTarget(candidate.target, input.scenario);
      return {
        ...candidate,
        classification,
        stateKey: targetStateKey(candidate.kind, candidate.target, classification.category)
      };
    })
    .filter((candidate) => {
      if (seen.has(candidate.stateKey)) {
        return false;
      }
      seen.add(candidate.stateKey);
      return true;
    })
    .sort((a, b) => {
      if (!agenticMode) {
        return a.index - b.index;
      }
      return a.classification.priority - b.classification.priority || a.index - b.index;
    });

  const maxActions = Math.max(0, input.config.maxActions);
  const maxDepth = Math.max(0, input.config.maxDepth);
  const maxClicks = Math.max(0, input.config.maxClicks);
  const maxStateChanges = Math.max(0, input.config.maxStateChanges);
  let clickSlots = input.config.safeClickEnabled ? maxClicks : 0;
  let stateChangeSlots = input.config.safeClickEnabled ? maxStateChanges : 0;

  return planned.slice(0, maxActions).map((candidate) => {
    const depth = Math.max(0, Math.floor(input.config.depth ?? 0));
    const eligibleForPlannedClick =
      candidate.kind === "target" &&
      depth <= maxDepth &&
      candidate.target.safeToClick &&
      input.config.safeClickEnabled &&
      clickSlots > 0 &&
      stateChangeSlots > 0;
    if (eligibleForPlannedClick) {
      clickSlots -= 1;
      stateChangeSlots -= 1;
    }

    const plannedClickSkipReason =
      candidate.kind === "scroll"
        ? "scroll actions do not click"
        : !input.config.safeClickEnabled
          ? "safe_click capability disabled"
          : !candidate.target.safeToClick
            ? candidate.target.skipClickReason ?? "target is not safe to click"
            : depth > maxDepth
              ? "max_depth limit reached by planner"
              : !eligibleForPlannedClick && (clickSlots <= 0 || stateChangeSlots <= 0)
                ? stateChangeSlots <= 0
                  ? "max_state_changes limit reached by planner"
                  : "max_clicks limit reached by planner"
                : undefined;

    return {
      kind: candidate.kind,
      target: candidate.target,
      targetCategory: candidate.classification.category,
      riskLevel: candidate.classification.riskLevel,
      plannedReason: plannedReason(candidate.kind, candidate.classification.category, candidate.classification.reason, candidate.target),
      priority: candidate.classification.priority,
      depth,
      plannedSafeClick: eligibleForPlannedClick,
      plannedClickSkipReason,
      stateKey: candidate.stateKey
    };
  });
}
