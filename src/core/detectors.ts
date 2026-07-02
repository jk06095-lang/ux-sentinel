import type { Finding, Scenario, ScreenElement, ScreenMap, Severity } from "./types.js";
import { enrichFindingsWithRules } from "./rules/registry.js";
import {
  ariaPrimaryCtas,
  elementLabel,
  labelMatchesPreferred,
  pageText,
  visiblePrimaryCtas
} from "./screen-map.js";
import { defaultPreferredLabels } from "./scenario.js";

const emptyStateHints = ["No projects", "Nothing here", "Empty", "아직", "없습니다", "비어", "0개"];

const destructiveHints = ["delete", "remove", "pay", "purchase", "logout", "sign out", "삭제", "제거", "결제", "로그아웃"];
const confirmationHints = ["confirm", "confirmation", "are you sure", "undo", "복구", "확인"];

const recoveryHints = ["retry", "try again", "back", "go back", "refresh", "recover", "restore", "contact support", "help"];
const escapeActionHints = ["close", "dismiss", "cancel", "back", "done", "x"];
const deadEndHints = ["error", "failed", "failure", "unavailable", "not found", "forbidden", "permission", "access denied", "can't continue"];
const loadingHints = ["loading", "please wait", "processing", "saving", "syncing", "submitting"];
const statusHints = ["saved", "updated", "complete", "completed", "success", "failed", "error", "loading", "processing"];
const graphControlHints = ["zoom", "fit", "reset", "pan", "center", "layout", "minimap", "expand", "collapse", "filter"];
const selectedPathHints = ["selected path", "active path", "highlighted path", "current path", "path selected"];
const statusRoles = new Set(["status", "alert", "log", "progressbar"]);

function preferredLabels(scenario: Scenario): string[] {
  return scenario.visual_contract?.primary_cta?.preferred_labels?.length
    ? scenario.visual_contract.primary_cta.preferred_labels
    : defaultPreferredLabels;
}

function finding(
  detector: string,
  title: string,
  severity: Severity,
  type: Finding["type"],
  evidence: string,
  userImpact: string,
  suggestedFix: string,
  regressionCheck: string
): Omit<Finding, "id"> {
  return { detector, title, severity, type, evidence, userImpact, suggestedFix, regressionCheck };
}

function hasEmptyState(screenMap: ScreenMap): boolean {
  const text = pageText(screenMap).toLowerCase();
  return emptyStateHints.some((hint) => text.includes(hint.toLowerCase()));
}

function normalizedIncludes(haystack: string | null | undefined, needle: string | null | undefined): boolean {
  const normalizedHaystack = (haystack ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const normalizedNeedle = (needle ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  return Boolean(normalizedHaystack && normalizedNeedle) && normalizedHaystack.includes(normalizedNeedle);
}

function meaningfulText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function elementActionLabel(element: ScreenElement): string {
  return meaningfulText([element.visibleText, element.ariaLabel, element.title, element.accessibleName].filter(Boolean).join(" "));
}

function normalizedKey(value: string | null | undefined): string {
  return meaningfulText(value).toLowerCase();
}

function actionSignature(element: ScreenElement): string {
  return normalizedKey(element.dataUxAction);
}

function intersectionArea(a: ScreenElement["bbox"], b: ScreenElement["bbox"]): number {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function intersectionRatio(a: ScreenElement["bbox"], b: ScreenElement["bbox"]): number {
  const smallestArea = Math.max(1, Math.min(a.width * a.height, b.width * b.height));
  return intersectionArea(a, b) / smallestArea;
}

function hasAccessibleDialogName(element: ScreenElement): boolean {
  return Boolean(meaningfulText(element.ariaLabel) || meaningfulText(element.ariaLabelledBy) || meaningfulText(element.title));
}

function isDialogLikeElement(element: ScreenElement): boolean {
  const roleOrUx = `${element.role ?? ""} ${element.dataUxRole ?? ""}`.toLowerCase();
  return element.visible && (element.tag === "dialog" || roleOrUx.includes("dialog") || roleOrUx.includes("modal"));
}

function isModalElement(element: ScreenElement): boolean {
  const roleOrUx = `${element.role ?? ""} ${element.dataUxRole ?? ""}`.toLowerCase();
  return isDialogLikeElement(element) && (element.ariaModal === "true" || roleOrUx.includes("modal") || element.tag === "dialog");
}

function isPopoverLikeElement(element: ScreenElement): boolean {
  const roleOrUx = `${element.role ?? ""} ${element.dataUxRole ?? ""}`.toLowerCase();
  return (
    element.visible &&
    (roleOrUx.includes("popover") ||
      roleOrUx.includes("tooltip") ||
      roleOrUx.includes("menu") ||
      roleOrUx.includes("listbox") ||
      roleOrUx.includes("dialog") ||
      roleOrUx.includes("floating"))
  );
}

function graphDagEnabled(scenario: Scenario): boolean {
  return scenario.visual_anomaly_contract?.graph_dag?.enabled === true;
}

function roleText(element: ScreenElement): string {
  return `${element.tag} ${element.role ?? ""} ${element.dataUxRole ?? ""} ${element.dataUxAction ?? ""}`.toLowerCase();
}

function isGraphSurfaceElement(element: ScreenElement): boolean {
  const roleOrUx = roleText(element);
  return (
    element.visible &&
    (element.tag === "svg" ||
      element.tag === "canvas" ||
      roleOrUx.includes("graph") ||
      roleOrUx.includes("dag") ||
      roleOrUx.includes("flowchart") ||
      roleOrUx.includes("canvas"))
  );
}

function isGraphNodeElement(element: ScreenElement): boolean {
  const roleOrUx = roleText(element);
  return element.visible && (roleOrUx.includes("graph-node") || roleOrUx.includes("dag-node") || roleOrUx.includes("node"));
}

function isGraphEdgeElement(element: ScreenElement): boolean {
  const roleOrUx = roleText(element);
  return (
    element.visible &&
    (roleOrUx.includes("graph-edge") ||
      roleOrUx.includes("dag-edge") ||
      roleOrUx.includes("edge") ||
      roleOrUx.includes("connector") ||
      element.tag === "path" ||
      element.tag === "line" ||
      element.tag === "polyline")
  );
}

function isGraphLabelElement(element: ScreenElement): boolean {
  const roleOrUx = roleText(element);
  return (
    element.visible &&
    Boolean(element.visibleText) &&
    (roleOrUx.includes("graph-label") ||
      roleOrUx.includes("dag-label") ||
      roleOrUx.includes("edge-label") ||
      roleOrUx.includes("critical-label") ||
      element.tag === "text")
  );
}

function isGraphControlElement(element: ScreenElement): boolean {
  if (!element.visible || !element.clickable || element.disabled) {
    return false;
  }
  const roleOrUx = roleText(element);
  const label = elementActionLabel(element).toLowerCase();
  return (
    roleOrUx.includes("graph-control") ||
    roleOrUx.includes("dag-control") ||
    roleOrUx.includes("canvas-control") ||
    graphControlHints.some((hint) => label.includes(hint))
  );
}

function isSelectedPathEvidence(element: ScreenElement): boolean {
  const roleOrUx = roleText(element);
  const label = elementActionLabel(element).toLowerCase();
  return (
    element.visible &&
    (roleOrUx.includes("selected-path") ||
      roleOrUx.includes("active-path") ||
      roleOrUx.includes("highlighted-path") ||
      selectedPathHints.some((hint) => label.includes(hint)))
  );
}

function visibleEscapeAction(screenMap: ScreenMap): ScreenElement | undefined {
  return clickableElements(screenMap).find((element) => {
    const label = elementActionLabel(element).toLowerCase();
    const action = actionSignature(element);
    return escapeActionHints.some((hint) => label === hint || label.includes(hint) || action.includes(hint));
  });
}

function hasLiveAnnouncement(element: ScreenElement): boolean {
  return statusRoles.has(element.role ?? "") || ["polite", "assertive"].includes((element.ariaLive ?? "").toLowerCase());
}

function isStatusLikeElement(element: ScreenElement): boolean {
  const roleOrUx = `${element.role ?? ""} ${element.dataUxRole ?? ""}`.toLowerCase();
  const text = elementActionLabel(element).toLowerCase();
  return (
    (roleOrUx.includes("status") || roleOrUx.includes("toast") || roleOrUx.includes("notification")) &&
    statusHints.some((hint) => text.includes(hint))
  );
}

function isDestructiveLabel(label: string): boolean {
  const normalized = label.toLowerCase();
  return Boolean(normalized) && destructiveHints.some((hint) => normalized.includes(hint.toLowerCase()));
}

function hasConfirmationCue(screenMap: ScreenMap, element: ScreenElement): boolean {
  const text = `${pageText(screenMap)} ${elementActionLabel(element)}`.toLowerCase();
  return confirmationHints.some((hint) => text.includes(hint.toLowerCase()));
}

function clickableElements(screenMap: ScreenMap): ScreenElement[] {
  return screenMap.elements.filter((element) => element.visible && element.clickable && !element.disabled);
}

function visibleActionWithLabel(elements: ScreenElement[]): ScreenElement | undefined {
  return elements.find((element) => element.hasVisibleLabel && element.looksClickable);
}

function recoveryAction(screenMap: ScreenMap): ScreenElement | undefined {
  return clickableElements(screenMap).find((element) => {
    const label = elementActionLabel(element).toLowerCase();
    return recoveryHints.some((hint) => label.includes(hint));
  });
}

export function runDetectors(screenMap: ScreenMap, scenario: Scenario): Finding[] {
  const findings: Array<Omit<Finding, "id">> = [];
  const labels = preferredLabels(scenario);
  const visibleCtas = visiblePrimaryCtas(screenMap, labels);
  const aboveFoldVisibleCtas = visibleCtas.filter((element) => element.aboveFold);
  const ariaCtas = ariaPrimaryCtas(screenMap, labels);
  const actionable = clickableElements(screenMap);

  if (scenario.goal?.primary_intent && visibleCtas.length === 0) {
    findings.push(
      finding(
        "primary_cta_missing",
        "No visible primary CTA matches the scenario intent",
        "P1",
        "Perception Mismatch",
        `Scenario intent "${scenario.goal.primary_intent}" expects one of: ${labels.join(", ")}.`,
        "A human can see the page but cannot identify the primary next action from visible copy.",
        "Add a visually prominent button or link with explicit text such as the preferred scenario label.",
        "Run the same scenario and confirm a visible primary CTA is detected above the fold."
      )
    );
  }

  const visibleAboveFoldPrimary = aboveFoldVisibleCtas.find((element) => labelMatchesPreferred(elementLabel(element), labels));
  if (
    scenario.visual_contract?.primary_cta?.must_look_clickable !== false &&
    visibleAboveFoldPrimary &&
    visibleAboveFoldPrimary.visualWeight > 0 &&
    visibleAboveFoldPrimary.visualWeight < 0.003
  ) {
    findings.push(
      finding(
        "primary_cta_low_visual_weight",
        "Primary CTA has low visual weight",
        "P2",
        "Perception Mismatch",
        `${visibleAboveFoldPrimary.id} "${elementActionLabel(visibleAboveFoldPrimary)}" visualWeight=${visibleAboveFoldPrimary.visualWeight.toFixed(4)} with bbox ${visibleAboveFoldPrimary.bbox.width}x${visibleAboveFoldPrimary.bbox.height}px.`,
        "The intended next action exists, but it may not stand out enough for a human to identify as primary.",
        "Increase the CTA size, contrast, placement, or surrounding whitespace so it is visually dominant.",
        "Run the scenario and confirm the primary CTA visualWeight is no longer below the low-salience threshold."
      )
    );
  }

  if (aboveFoldVisibleCtas.length > 1) {
    findings.push(
      finding(
        "multiple_primary_ctas_conflict",
        "Multiple visible primary CTAs compete for attention",
        "P2",
        "Perception Mismatch",
        aboveFoldVisibleCtas
          .map((element) => `${element.id} "${elementActionLabel(element)}" at ${element.bbox.x},${element.bbox.y}`)
          .join("; "),
        "Users may hesitate when several above-fold controls appear to be the primary next step.",
        "Choose one dominant primary action and demote alternatives to secondary styling or supporting placement.",
        "Run the scenario and confirm only one above-fold control matches the primary intent as the dominant CTA."
      )
    );
  }

  if (visibleAboveFoldPrimary) {
    const overpoweringSecondary = actionable.find(
      (element) =>
        element.id !== visibleAboveFoldPrimary.id &&
        element.aboveFold &&
        !labelMatchesPreferred(elementActionLabel(element), labels) &&
        element.visualWeight >= Math.max(0.006, visibleAboveFoldPrimary.visualWeight * 1.8)
    );
    if (overpoweringSecondary) {
      findings.push(
        finding(
          "secondary_action_overpowers_primary",
          "Secondary action visually overpowers the primary CTA",
          "P2",
          "Perception Mismatch",
          `${overpoweringSecondary.id} "${elementActionLabel(overpoweringSecondary)}" visualWeight=${overpoweringSecondary.visualWeight.toFixed(4)} exceeds primary ${visibleAboveFoldPrimary.id} visualWeight=${visibleAboveFoldPrimary.visualWeight.toFixed(4)}.`,
          "The page may guide users toward a less important action even though the intended primary CTA exists.",
          "Reduce the secondary action's visual prominence or strengthen the primary CTA hierarchy.",
          "Run the scenario and confirm the intended primary action is the most visually prominent command above the fold."
        )
      );
    }
  }

  const iconOnlyPrimary = ariaCtas.find((element) => element.isIconOnly || !element.hasVisibleLabel);
  if (scenario.visual_contract?.primary_cta?.avoid_icon_only !== false && iconOnlyPrimary) {
    findings.push(
      finding(
        "primary_cta_icon_only",
        "Primary CTA is only communicated through an icon or hidden label",
        "P1",
        "Perception Mismatch",
        `${iconOnlyPrimary.id} is a ${iconOnlyPrimary.tag} with visible text "${iconOnlyPrimary.visibleText}" and aria-label "${iconOnlyPrimary.ariaLabel ?? ""}".`,
        "The DOM and accessibility tree expose the action, but the visible screen does not make the action legible.",
        "Use visible CTA copy next to or instead of the icon, for example \"Create first project\".",
        "Confirm the CTA has visible text, not only an aria-label or icon glyph."
      )
    );
  }

  if (scenario.visual_contract?.empty_state?.if_detected_requires_primary_cta !== false && hasEmptyState(screenMap) && visibleCtas.length === 0) {
    findings.push(
      finding(
        "empty_state_without_cta",
        "Empty state has no visible primary CTA",
        "P1",
        "Perception Mismatch",
        `Visible page text looks like an empty state: "${pageText(screenMap).slice(0, 180)}".`,
        "A first-time user reaches an empty page but does not get an obvious next step.",
        "Pair the empty-state explanation with a visible primary CTA that matches the scenario intent.",
        "Run the empty-state scenario and confirm the report has no blocking empty-state CTA finding."
      )
    );
  }

  if (hasEmptyState(screenMap) && !visibleActionWithLabel(actionable)) {
    findings.push(
      finding(
        "empty_state_without_next_step",
        "Empty state has no visible next-step action",
        "P2",
        "Perception Mismatch",
        `Visible page text looks like an empty state, but no enabled visible action has a human-readable label. Text: "${pageText(screenMap).slice(0, 180)}".`,
        "A user can understand that nothing exists yet but still cannot see how to recover or start.",
        "Add a visible next-step action near the empty-state message, even if it is not the scenario's primary CTA.",
        "Run the scenario and confirm the empty state includes at least one visible, labeled recovery or creation action."
      )
    );
  }

  const pageTextLower = pageText(screenMap).toLowerCase();
  if (deadEndHints.some((hint) => pageTextLower.includes(hint)) && !recoveryAction(screenMap)) {
    findings.push(
      finding(
        "dead_end_state_without_recovery",
        "Dead-end state has no visible recovery action",
        "P2",
        "Perception Mismatch",
        `Visible text suggests a dead end without a retry, back, help, or recovery action: "${pageText(screenMap).slice(0, 180)}".`,
        "Users can get stuck when the interface states a problem but does not expose a clear recovery path.",
        "Add a visible recovery action such as retry, go back, refresh, or contact support.",
        "Run the scenario and confirm dead-end copy is paired with a visible recovery control."
      )
    );
  }

  const loadingText = loadingHints.find((hint) => pageTextLower.includes(hint));
  const hasAnnouncedLoading = screenMap.elements.some((element) => element.visible && isStatusLikeElement(element) && hasLiveAnnouncement(element));
  if (loadingText && !hasAnnouncedLoading && !recoveryAction(screenMap)) {
    findings.push(
      finding(
        "loading_without_progress_or_timeout",
        "Loading state lacks progress announcement or recovery",
        "P2",
        "Perception Mismatch",
        `Visible text includes "${loadingText}", but no visible status/progress/live-region evidence or recovery action was found.`,
        "Users may not know whether the app is working, stalled, or recoverable.",
        "Expose loading progress with role=status, role=progressbar, or aria-live, and provide a timeout or recovery path when needed.",
        "Run the scenario and confirm loading text is announced or paired with visible recovery."
      )
    );
  }

  const closeAction = visibleEscapeAction(screenMap);
  const dialogWithoutClose = screenMap.elements.find((element) => isDialogLikeElement(element) && !closeAction);
  if (dialogWithoutClose) {
    findings.push(
      finding(
        "dialog_close_unavailable",
        "Dialog has no visible close or dismiss action",
        "P2",
        "Perception Mismatch",
        `${dialogWithoutClose.id} is a visible ${dialogWithoutClose.tag}${dialogWithoutClose.role ? ` role=${dialogWithoutClose.role}` : ""}, but no enabled close, dismiss, cancel, done, or back action appears in the screen map.`,
        "Users can enter a dialog or overlay state but may not perceive how to leave it.",
        "Add a visible close, cancel, done, back, or dismiss control with a clear label and keyboard path.",
        "Run observe or interactive audit and confirm visible dialogs expose an enabled escape control."
      )
    );
  }

  const modalWithoutEscape = screenMap.elements.find((element) => isModalElement(element) && !closeAction);
  if (modalWithoutEscape) {
    findings.push(
      finding(
        "modal_trap_without_escape",
        "Modal has no visible escape path",
        "P2",
        "Perception Mismatch",
        `${modalWithoutEscape.id} is modal-like with aria-modal="${modalWithoutEscape.ariaModal ?? ""}" and no enabled close, dismiss, cancel, done, or back action in the screen map.`,
        "A modal without an obvious escape path can trap users in a state they did not mean to enter.",
        "Provide a visible close or cancel control and ensure keyboard users can leave the modal predictably.",
        "Run interactive audit and confirm modal states include a visible escape action and no modal-trap finding."
      )
    );
  }

  if (visibleAboveFoldPrimary) {
    const blockingPopover = screenMap.elements.find(
      (element) =>
        element.id !== visibleAboveFoldPrimary.id &&
        isPopoverLikeElement(element) &&
        intersectionRatio(element.bbox, visibleAboveFoldPrimary.bbox) >= 0.2
    );
    if (blockingPopover) {
      findings.push(
        finding(
          "popover_blocks_primary_action",
          "Popover overlaps the primary action",
          "P2",
          "Perception Mismatch",
          `${blockingPopover.id} "${elementActionLabel(blockingPopover)}" overlaps ${visibleAboveFoldPrimary.id} "${elementActionLabel(visibleAboveFoldPrimary)}" by ratio ${intersectionRatio(blockingPopover.bbox, visibleAboveFoldPrimary.bbox).toFixed(2)}.`,
          "A user may see the intended primary action but be unable to confidently perceive or use it because a foreground layer covers it.",
          "Reposition the popover, reduce its footprint, or move the primary CTA outside the covered region.",
          "Run interactive audit and confirm no popover-like foreground layer intersects the primary CTA bbox."
        )
      );
    }
  }

  if (graphDagEnabled(scenario)) {
    const graphSurface = screenMap.elements.filter(isGraphSurfaceElement);
    if (graphSurface.length > 0) {
      const graphControls = screenMap.elements.filter(isGraphControlElement);
      const graphNodes = screenMap.elements.filter(isGraphNodeElement);
      const graphEdges = screenMap.elements.filter(isGraphEdgeElement);
      const selectedPathEvidence = screenMap.elements.filter(isSelectedPathEvidence);
      const graphLooksInteractive = graphSurface.some((element) => element.tag === "svg" || element.tag === "canvas" || element.visualWeight >= 0.05);

      if (graphLooksInteractive && graphControls.length === 0) {
        findings.push(
          finding(
            "graph_control_not_discoverable",
            "Graph controls are not discoverable",
            "P2",
            "Perception Mismatch",
            `Graph contract is enabled and graph surface evidence exists (${graphSurface.map((element) => `${element.id}:${element.tag}/${element.dataUxRole ?? element.role ?? ""}`).join(", ")}), but no visible graph control label or data-ux-role was found.`,
            "Users may see a graph or DAG but not discover how to zoom, fit, pan, reset, or orient the canvas.",
            "Add visible graph controls with clear labels or data-ux-role metadata such as graph-control, fit, reset, zoom, or layout.",
            "Run the graph scenario and confirm at least one visible graph control is present in the screen map."
          )
        );
      }

      const truncatedNode = graphNodes.find((element) => element.textTruncated && meaningfulText(element.visibleText).length > 6);
      if (truncatedNode) {
        findings.push(
          finding(
            "node_label_truncated",
            "Graph node label is truncated",
            "P2",
            "Perception Mismatch",
            `${truncatedNode.id} "${truncatedNode.visibleText}" is graph-node evidence with bbox ${truncatedNode.bbox.width}x${truncatedNode.bbox.height}px and textTruncated=true.`,
            "Users may not be able to identify a node or compare graph branches when node labels are clipped.",
            "Allow node labels to wrap, widen the node, shorten the label, or provide an accessible persistent detail affordance.",
            "Run the graph scenario and confirm graph node labels no longer report textTruncated=true."
          )
        );
      }

      if (
        scenario.visual_anomaly_contract?.graph_dag?.selected_path_must_be_traceable === true &&
        selectedPathEvidence.length > 0 &&
        (graphNodes.length < 2 || graphEdges.length === 0)
      ) {
        findings.push(
          finding(
            "selected_path_not_traceable",
            "Selected graph path is not traceable",
            "P2",
            "Perception Mismatch",
            `Selected-path evidence exists (${selectedPathEvidence.map((element) => element.id).join(", ")}), but graph evidence has ${graphNodes.length} node(s) and ${graphEdges.length} edge(s).`,
            "A user can see that a path is selected but cannot visually trace how the selected nodes are connected.",
            "Render selected-path nodes and connecting edges with visible labels and graph metadata so the path can be reconstructed.",
            "Run the graph scenario and confirm selected-path evidence includes at least two nodes and a connecting edge."
          )
        );
      }

      const graphLabels = screenMap.elements.filter(isGraphLabelElement);
      const crossingEdge = graphEdges
        .map((edge) => ({
          edge,
          label: graphLabels.find((label) => label.id !== edge.id && intersectionRatio(edge.bbox, label.bbox) >= 0.15)
        }))
        .find((pair) => pair.label);
      if (crossingEdge?.label) {
        findings.push(
          finding(
            "edge_crosses_critical_label",
            "Graph edge crosses a critical label",
            "P2",
            "Perception Mismatch",
            `${crossingEdge.edge.id} intersects ${crossingEdge.label.id} "${crossingEdge.label.visibleText}" with ratio ${intersectionRatio(crossingEdge.edge.bbox, crossingEdge.label.bbox).toFixed(2)}.`,
            "Graph labels can become ambiguous when edges cross through the text users need to identify a path or node.",
            "Reroute the edge, move the label, add padding, or reserve a label lane that edges cannot cross.",
            "Run the graph scenario and confirm edge bboxes no longer intersect critical label bboxes."
          )
        );
      }
    }
  }

  for (const element of screenMap.elements) {
    if (element.visible && element.clickable && element.ariaLabel && (element.isIconOnly || !element.hasVisibleLabel)) {
      findings.push(
        finding(
          "dom_visible_but_human_invisible",
          "Clickable control relies on non-visible intent",
          "P2",
          "Perception Mismatch",
          `${element.id} label source is aria-label "${element.ariaLabel}" while visible text is "${element.visibleText}".`,
          "Agentic or DOM-based checks can find the action, but a human may not understand it from the visible UI.",
          "Give the control visible text or place it near explicit explanatory copy.",
          "Confirm the control has a visible label or is clearly secondary."
        )
      );
    }

    if (element.visible && element.clickable && (element.isIconOnly || !element.hasVisibleLabel) && (element.ariaLabel || element.title)) {
      findings.push(
        finding(
          "icon_button_without_visible_label",
          "Icon button has no visible label",
          "P2",
          "Perception Mismatch",
          `${element.id} is a ${element.tag} with visible text "${element.visibleText}" and hidden label "${element.ariaLabel ?? element.title ?? ""}".`,
          "A sighted user may miss the control's purpose even though automation or assistive metadata can identify it.",
          "Add adjacent visible text or a persistent label for the icon button, especially when the action is important.",
          "Run observe and confirm icon buttons have visible labels or are clearly decorative/secondary."
        )
      );
    }

    if (element.visible && (element.role === "dialog" || element.tag === "dialog") && !hasAccessibleDialogName(element)) {
      findings.push(
        finding(
          "dialog_without_accessible_name",
          "Dialog has no accessible name",
          "P2",
          "Perception Mismatch",
          `${element.id} is a visible ${element.tag}${element.role ? ` role=${element.role}` : ""} without aria-label, aria-labelledby, or title evidence.`,
          "Users may enter a modal or dialog without a clear announced purpose or visible orientation cue.",
          "Give the dialog an accessible name with aria-labelledby tied to its visible heading, or aria-label when no heading exists.",
          "Run observe and confirm visible dialogs expose aria-label, aria-labelledby, or title evidence."
        )
      );
    }

    if (element.visible && isStatusLikeElement(element) && !hasLiveAnnouncement(element)) {
      findings.push(
        finding(
          "status_change_not_announced",
          "Status change is not announced",
          "P2",
          "Perception Mismatch",
          `${element.id} "${elementActionLabel(element)}" is marked ${element.dataUxRole ? `data-ux-role=${element.dataUxRole}` : `role=${element.role ?? "none"}`} but has no role=status/alert/log/progressbar or aria-live evidence.`,
          "Users may miss an important state change when the visual status is not exposed as an announcement.",
          "Use role=status, role=alert, role=progressbar, or aria-live for dynamic state messages.",
          "Run observe and confirm status-like messages have live-region or status-role evidence."
        )
      );
    }

    if (
      element.visible &&
      element.clickable &&
      element.hasVisibleLabel &&
      element.ariaLabel &&
      !normalizedIncludes(element.ariaLabel, element.visibleText)
    ) {
      findings.push(
        finding(
          "visible_label_not_in_accessible_name",
          "Visible label is not included in the accessible name",
          "P2",
          "Perception Mismatch",
          `${element.id} visible text "${element.visibleText}" is not present in aria-label "${element.ariaLabel}".`,
          "Sighted users and assistive-technology users may understand the same control as different actions.",
          "Keep the visible label in the accessible name, or remove the conflicting aria-label.",
          "Run the scenario and confirm visible control labels are included in their accessible names."
        )
      );
    }

    if (
      element.visible &&
      element.clickable &&
      element.hasVisibleLabel &&
      element.ariaLabel &&
      !normalizedIncludes(element.ariaLabel, element.visibleText) &&
      !normalizedIncludes(element.visibleText, element.ariaLabel)
    ) {
      findings.push(
        finding(
          "aria_label_contradicts_visible_text",
          "ARIA label contradicts visible text",
          "P2",
          "Perception Mismatch",
          `${element.id} visible text "${element.visibleText}" conflicts with aria-label "${element.ariaLabel}".`,
          "The same control can communicate different consequences depending on whether the user reads the screen or accessibility tree.",
          "Align aria-label with the visible label and action consequence.",
          "Inspect the screen map and confirm the accessible name and visible text describe the same action."
        )
      );
    }
  }

  for (const element of clickableElements(screenMap)) {
    const minSize = Math.min(element.bbox.width, element.bbox.height);
    if (minSize > 0 && minSize < 32) {
      findings.push(
        finding(
          "click_target_too_small",
          "Click target is smaller than the recommended touch/pointer size",
          "P2",
          "Perception Mismatch",
          `${element.id} "${elementActionLabel(element)}" bbox is ${element.bbox.width}x${element.bbox.height}px.`,
          "Small controls are harder to notice and easier to misclick, especially near other controls.",
          "Increase the target's hit area to at least 32x32px, preferably 44x44px for primary actions.",
          "Run observe or interactive audit and confirm the target bbox is no longer below the size threshold."
        )
      );
    }

    if (element.hasVisibleAffordance === false) {
      findings.push(
        finding(
          "clickable_without_visible_affordance",
          "Clickable element lacks a visible affordance",
          "P2",
          "Perception Mismatch",
          `${element.id} "${elementActionLabel(element)}" is clickable but has cursor "${element.cursor ?? "unknown"}" and no visible affordance marker in the screen map.`,
          "A human may not realize the text or region can be acted on even though DOM-based checks can click it.",
          "Add visible button/link styling, a pointer cursor for custom controls, or clearer command copy.",
          "Inspect the overlay and confirm clickable controls have a visible affordance."
        )
      );
    }

    const label = elementActionLabel(element);
    if (isDestructiveLabel(label) && !hasConfirmationCue(screenMap, element)) {
      findings.push(
        finding(
          "destructive_action_without_confirmation",
          "Destructive action has no visible confirmation cue",
          "P2",
          "Perception Mismatch",
          `${element.id} exposes destructive label "${label}" without nearby confirmation, undo, or recovery copy in visible text.`,
          "Users may not understand the consequence or recovery path before a destructive action.",
          "Add confirmation, undo, or consequence copy before allowing the destructive action.",
          "Run the scenario and confirm destructive controls are paired with a visible confirmation or recovery path."
        )
      );
    }
  }

  for (const element of screenMap.elements) {
    const looksActionable = element.visible && !element.clickable && (element.hasPointerCursor || element.dataUxClickable || element.dataUxAction);
    if (looksActionable) {
      findings.push(
        finding(
          "looks_clickable_but_not_actionable",
          "Element looks clickable but is not actionable",
          "P2",
          "Perception Mismatch",
          `${element.id} "${elementActionLabel(element)}" has cursor/action metadata but was not classified as clickable in the screen map.`,
          "Users may try to interact with a visual affordance that has no actual action.",
          "Attach a real button/link role or remove the pointer/action styling from non-actionable content.",
          "Run observe and confirm clickable-looking elements are either actionable or no longer styled as controls."
        )
      );
    }
  }

  for (let index = 0; index < actionable.length; index += 1) {
    for (let other = index + 1; other < actionable.length; other += 1) {
      const first = actionable[index];
      const second = actionable[other];
      const horizontallyClose =
        first.bbox.y < second.bbox.y + second.bbox.height &&
        first.bbox.y + first.bbox.height > second.bbox.y &&
        Math.abs(second.bbox.x - (first.bbox.x + first.bbox.width)) < 8;
      const verticallyClose =
        first.bbox.x < second.bbox.x + second.bbox.width &&
        first.bbox.x + first.bbox.width > second.bbox.x &&
        Math.abs(second.bbox.y - (first.bbox.y + first.bbox.height)) < 8;
      if (horizontallyClose || verticallyClose) {
        findings.push(
          finding(
            "click_target_spacing_too_tight",
            "Click targets are spaced too tightly",
            "P2",
            "Perception Mismatch",
            `${first.id} "${elementActionLabel(first)}" and ${second.id} "${elementActionLabel(second)}" have less than 8px spacing between their bboxes.`,
            "Adjacent actions can be hard to choose accurately and can lead to accidental clicks.",
            "Add spacing between adjacent controls or combine them into a clearer grouped control.",
            "Run observe and confirm adjacent clickable bboxes have at least 8px of spacing."
          )
        );
        break;
      }
    }
  }

  const byVisibleLabel = new Map<string, ScreenElement[]>();
  const byAction = new Map<string, ScreenElement[]>();
  for (const element of actionable) {
    const visibleLabel = normalizedKey(element.visibleText);
    if (visibleLabel) {
      byVisibleLabel.set(visibleLabel, [...(byVisibleLabel.get(visibleLabel) ?? []), element]);
    }
    const signature = actionSignature(element);
    if (signature) {
      byAction.set(signature, [...(byAction.get(signature) ?? []), element]);
    }
  }

  for (const [label, elements] of byVisibleLabel) {
    const actions = new Set(elements.map(actionSignature).filter(Boolean));
    if (actions.size > 1) {
      findings.push(
        finding(
          "same_label_different_actions",
          "Same visible label maps to different actions",
          "P2",
          "Perception Mismatch",
          `Visible label "${label}" appears on ${elements.map((element) => `${element.id}:${actionSignature(element)}`).join(", ")}.`,
          "Users cannot reliably predict the consequence when identical visible labels trigger different actions.",
          "Give each action a distinct visible label or align the underlying action semantics.",
          "Run observe and confirm repeated labels either perform the same action or are visually disambiguated."
        )
      );
    }
  }

  for (const [signature, elements] of byAction) {
    const labelsForAction = new Set(elements.map((element) => normalizedKey(element.visibleText)).filter(Boolean));
    if (labelsForAction.size > 1) {
      findings.push(
        finding(
          "same_action_different_labels",
          "Same action is exposed through inconsistent labels",
          "P2",
          "Perception Mismatch",
          `Action "${signature}" appears as ${elements.map((element) => `${element.id}:"${meaningfulText(element.visibleText)}"`).join(", ")}.`,
          "Inconsistent command labels make it harder to learn and trust repeated actions across the screen.",
          "Use one consistent visible label for the same action, or separate the actions if their consequences differ.",
          "Run observe and confirm controls sharing the same action metadata use consistent visible labels."
        )
      );
    }
  }

  const belowFoldPrimary = [...visibleCtas, ...ariaCtas].find((element) => !element.aboveFold && labelMatchesPreferred(elementLabel(element), labels));
  if (
    scenario.visual_contract?.primary_cta?.must_be_visible_above_fold !== false &&
    visibleCtas.length > 0 &&
    aboveFoldVisibleCtas.length === 0 &&
    belowFoldPrimary
  ) {
    findings.push(
      finding(
        "primary_cta_below_fold",
        "Primary CTA is below the initial viewport",
        "P1",
        "Perception Mismatch",
        `${belowFoldPrimary.id} is at y=${belowFoldPrimary.bbox.y}, below viewport height ${screenMap.viewport.height}.`,
        "The intended next action exists, but the initial screen does not reveal it.",
        "Move the primary CTA above the fold or add a visible cue that guides the user to it.",
        "Run the scenario at the target viewport and confirm the CTA is above the fold."
      )
    );
  }

  if (screenMap.document.hasHorizontalScroll) {
    findings.push(
      finding(
        "horizontal_scroll",
        "Page has significant horizontal scroll",
        "P1",
        "Functional Issue",
        `Document width ${screenMap.document.width}px exceeds viewport width ${screenMap.viewport.width}px.`,
        "The layout may hide important actions or text off-screen.",
        "Fix overflowing layout containers so the viewport does not scroll horizontally.",
        "Confirm document width is no greater than viewport width plus a small tolerance."
      )
    );
  }

  if (screenMap.consoleErrors.length > 0) {
    findings.push(
      finding(
        "console_error",
        "Page emitted uncaught console errors",
        "P1",
        "Functional Issue",
        screenMap.consoleErrors.map((issue) => issue.text).join("\n"),
        "Runtime errors can invalidate the visible UX and make detector evidence unreliable.",
        "Fix uncaught browser console errors or explicitly allow known benign errors in a future scenario extension.",
        "Run the scenario and confirm no uncaught console errors are recorded."
      )
    );
  }

  const serverErrors = screenMap.networkErrors.filter((issue) => issue.status >= 500);
  if (serverErrors.length > 0) {
    findings.push(
      finding(
        "network_5xx",
        "Page triggered network 5xx responses",
        "P1",
        "Functional Issue",
        serverErrors.map((issue) => `${issue.status} ${issue.method} ${issue.url}`).join("\n"),
        "Server failures can remove or corrupt the UI a user needs to proceed.",
        "Fix failing backend or asset responses before assessing perception quality.",
        "Run the scenario and confirm there are no 5xx network responses."
      )
    );
  }

  const truncated = screenMap.elements.find((element) => element.textTruncated && element.visibleText.length > 6);
  if (truncated) {
    findings.push(
      finding(
        "important_text_truncated",
        "Visible text appears truncated",
        "P2",
        "Perception Mismatch",
        `${truncated.id} text may be clipped: "${truncated.visibleText}".`,
        "Users may miss the label or consequence needed to choose the next action.",
        "Allow the label to wrap, shorten the copy, or widen the container.",
        "Confirm important labels are readable at the scenario viewport."
      )
    );
  }

  return enrichFindingsWithRules(findings.map((item, index) => ({
    id: `UX-${String(index + 1).padStart(3, "0")}`,
    ...item
  })));
}

export function verdictForFindings(findings: Finding[], scenario: Scenario): "pass" | "fail" | "ambiguous" {
  const failConditions = new Set(scenario.fail_conditions ?? []);
  const hasExplicitFailConditions =
    failConditions.size > 0 &&
    (scenario.fail_conditions_explicit === true || scenario.fail_conditions_explicit === undefined);
  const blocking = hasExplicitFailConditions
    ? findings.filter((finding) => failConditions.has(finding.detector))
    : findings.filter((finding) => finding.severity === "P0" || finding.severity === "P1");

  if (blocking.length > 0) {
    return "fail";
  }

  return findings.length > 0 ? "ambiguous" : "pass";
}

export function renumberFindings(findings: Finding[]): Finding[] {
  return enrichFindingsWithRules(findings).map((finding, index) => ({
    ...finding,
    id: `UX-${String(index + 1).padStart(3, "0")}`
  }));
}
