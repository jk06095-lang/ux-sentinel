import type { Finding, Scenario, ScreenMap, Severity } from "./types.js";
import {
  ariaPrimaryCtas,
  elementLabel,
  labelMatchesPreferred,
  pageText,
  visiblePrimaryCtas
} from "./screen-map.js";
import { defaultPreferredLabels } from "./scenario.js";

const emptyStateHints = ["No projects", "Nothing here", "Empty", "아직", "없습니다", "비어", "0개"];

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

export function runDetectors(screenMap: ScreenMap, scenario: Scenario): Finding[] {
  const findings: Array<Omit<Finding, "id">> = [];
  const labels = preferredLabels(scenario);
  const visibleCtas = visiblePrimaryCtas(screenMap, labels);
  const aboveFoldVisibleCtas = visibleCtas.filter((element) => element.aboveFold);
  const ariaCtas = ariaPrimaryCtas(screenMap, labels);

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

  return findings.map((item, index) => ({
    id: `UX-${String(index + 1).padStart(3, "0")}`,
    ...item
  }));
}

export function verdictForFindings(findings: Finding[], scenario: Scenario): "pass" | "fail" | "ambiguous" {
  const failConditions = new Set(scenario.fail_conditions ?? []);
  const blocking = findings.filter(
    (finding) =>
      (finding.severity === "P0" || finding.severity === "P1") &&
      (failConditions.size === 0 || failConditions.has(finding.detector))
  );

  if (blocking.length > 0) {
    return "fail";
  }

  return findings.length > 0 ? "ambiguous" : "pass";
}
