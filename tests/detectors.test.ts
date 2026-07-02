import { describe, expect, it } from "vitest";
import { runDetectors, verdictForFindings } from "../src/core/detectors.js";
import type { Finding, Scenario, ScreenElement, ScreenMap } from "../src/core/types.js";

const scenario: Scenario = {
  id: "onboarding-empty-state",
  title: "First-time user sees clear next action",
  persona: "first-time-user",
  goal: {
    user_wants: "Create the first project",
    primary_intent: "create_project"
  },
  visual_contract: {
    primary_cta: {
      preferred_labels: ["Create first project", "Create project"],
      avoid_icon_only: true,
      must_be_visible_above_fold: true,
      must_look_clickable: true
    },
    empty_state: {
      if_detected_requires_primary_cta: true
    }
  },
  fail_conditions: [
    "primary_cta_missing",
    "primary_cta_icon_only",
    "empty_state_without_cta",
    "console_error",
    "network_5xx",
    "horizontal_scroll"
  ]
};

function baseScreenMap(overrides: Partial<ScreenMap>): ScreenMap {
  return {
    url: "http://example.test",
    timestamp: "2026-07-01T00:00:00.000Z",
    viewport: { width: 1280, height: 720 },
    document: { width: 1280, height: 720, hasHorizontalScroll: false },
    visibleText: [],
    elements: [],
    consoleErrors: [],
    networkErrors: [],
    risks: [],
    ...overrides
  };
}

function baseElement(overrides: Partial<ScreenElement> & Pick<ScreenElement, "id" | "visibleText">): ScreenElement {
  return {
    id: overrides.id,
    tag: "div",
    role: null,
    visibleText: overrides.visibleText,
    ariaLabel: null,
    title: null,
    bbox: { x: 20, y: 20, width: 160, height: 40 },
    clickable: false,
    disabled: false,
    aboveFold: true,
    visible: true,
    looksClickable: false,
    hasVisibleLabel: true,
    isIconOnly: false,
    textTruncated: false,
    visualWeight: 0.0043,
    ...overrides
  };
}

describe("detectors", () => {
  it("fails the broken empty state with an icon-only CTA", () => {
    const screenMap = baseScreenMap({
      visibleText: ["Projects", "No projects yet", "+"],
      elements: [
        {
          id: "e1",
          tag: "button",
          role: "button",
          visibleText: "+",
          ariaLabel: "Create first project",
          title: null,
          bbox: { x: 1200, y: 32, width: 28, height: 28 },
          clickable: true,
          disabled: false,
          aboveFold: true,
          visible: true,
          looksClickable: true,
          hasVisibleLabel: false,
          isIconOnly: true,
          textTruncated: false,
          visualWeight: 0.001
        }
      ]
    });

    const findings = runDetectors(screenMap, scenario);

    expect(findings.map((finding) => finding.detector)).toContain("primary_cta_icon_only");
    expect(findings.map((finding) => finding.detector)).toContain("empty_state_without_cta");
    expect(verdictForFindings(findings, scenario)).toBe("fail");
  });

  it("passes the fixed empty state with a visible primary CTA", () => {
    const screenMap = baseScreenMap({
      visibleText: ["Projects", "No projects yet", "Create first project"],
      elements: [
        {
          id: "e1",
          tag: "button",
          role: "button",
          visibleText: "Create first project",
          ariaLabel: null,
          title: null,
          bbox: { x: 520, y: 340, width: 180, height: 44 },
          clickable: true,
          disabled: false,
          aboveFold: true,
          visible: true,
          looksClickable: true,
          hasVisibleLabel: true,
          isIconOnly: false,
          textTruncated: false,
          visualWeight: 0.0086
        }
      ]
    });

    const findings = runDetectors(screenMap, scenario);

    expect(findings).toEqual([]);
    expect(verdictForFindings(findings, scenario)).toBe("pass");
  });

  it("detects horizontal scroll and network 5xx as functional issues", () => {
    const screenMap = baseScreenMap({
      document: { width: 1500, height: 720, hasHorizontalScroll: true },
      networkErrors: [{ url: "http://example.test/api", status: 503, statusText: "Service Unavailable", method: "GET" }]
    });

    const findings = runDetectors(screenMap, scenario);

    expect(findings.map((finding) => finding.detector)).toContain("horizontal_scroll");
    expect(findings.map((finding) => finding.detector)).toContain("network_5xx");
  });

  it("detects evidence-backed affordance, label, size, spacing, and destructive-action issues", () => {
    const screenMap = baseScreenMap({
      visibleText: ["Open settings", "Save", "Delete account", "A", "B"],
      elements: [
        {
          id: "small",
          tag: "button",
          role: "button",
          visibleText: "A",
          ariaLabel: null,
          title: null,
          bbox: { x: 20, y: 20, width: 24, height: 24 },
          clickable: true,
          disabled: false,
          aboveFold: true,
          visible: true,
          looksClickable: true,
          hasVisibleLabel: true,
          isIconOnly: false,
          textTruncated: false,
          visualWeight: 0.0006,
          hasVisibleAffordance: true
        },
        {
          id: "tight",
          tag: "button",
          role: "button",
          visibleText: "B",
          ariaLabel: null,
          title: null,
          bbox: { x: 48, y: 20, width: 24, height: 24 },
          clickable: true,
          disabled: false,
          aboveFold: true,
          visible: true,
          looksClickable: true,
          hasVisibleLabel: true,
          isIconOnly: false,
          textTruncated: false,
          visualWeight: 0.0006,
          hasVisibleAffordance: true
        },
        {
          id: "plain",
          tag: "div",
          role: "button",
          visibleText: "Open settings",
          ariaLabel: null,
          title: null,
          bbox: { x: 20, y: 80, width: 180, height: 40 },
          clickable: true,
          disabled: false,
          aboveFold: true,
          visible: true,
          looksClickable: false,
          hasVisibleLabel: true,
          isIconOnly: false,
          textTruncated: false,
          visualWeight: 0.006,
          cursor: "auto",
          hasVisibleAffordance: false
        },
        {
          id: "label",
          tag: "button",
          role: "button",
          visibleText: "Save",
          ariaLabel: "Delete account",
          title: null,
          bbox: { x: 20, y: 140, width: 160, height: 44 },
          clickable: true,
          disabled: false,
          aboveFold: true,
          visible: true,
          looksClickable: true,
          hasVisibleLabel: true,
          isIconOnly: false,
          textTruncated: false,
          visualWeight: 0.006,
          hasVisibleAffordance: true
        },
        {
          id: "fake",
          tag: "div",
          role: null,
          visibleText: "Open fake panel",
          ariaLabel: null,
          title: null,
          bbox: { x: 20, y: 200, width: 160, height: 44 },
          clickable: false,
          disabled: false,
          aboveFold: true,
          visible: true,
          looksClickable: false,
          hasVisibleLabel: true,
          isIconOnly: false,
          textTruncated: false,
          visualWeight: 0.006,
          cursor: "pointer",
          hasPointerCursor: true
        }
      ]
    });

    const detectors = runDetectors(screenMap, scenario).map((finding) => finding.detector);

    expect(detectors).toEqual(
      expect.arrayContaining([
        "click_target_too_small",
        "click_target_spacing_too_tight",
        "clickable_without_visible_affordance",
        "visible_label_not_in_accessible_name",
        "aria_label_contradicts_visible_text",
        "destructive_action_without_confirmation",
        "looks_clickable_but_not_actionable"
      ])
    );
  });

  it("detects primary hierarchy conflicts and inconsistent action labels", () => {
    const screenMap = baseScreenMap({
      visibleText: ["Create first project", "Create project", "Learn more", "Open", "Open", "Save", "Save changes"],
      elements: [
        {
          id: "primary-low",
          tag: "button",
          role: "button",
          visibleText: "Create first project",
          ariaLabel: null,
          title: null,
          bbox: { x: 40, y: 40, width: 72, height: 28 },
          clickable: true,
          disabled: false,
          aboveFold: true,
          visible: true,
          looksClickable: true,
          hasVisibleLabel: true,
          isIconOnly: false,
          textTruncated: false,
          visualWeight: 0.0022,
          dataUxAction: "create-project",
          hasVisibleAffordance: true
        },
        {
          id: "primary-second",
          tag: "button",
          role: "button",
          visibleText: "Create project",
          ariaLabel: null,
          title: null,
          bbox: { x: 130, y: 40, width: 110, height: 36 },
          clickable: true,
          disabled: false,
          aboveFold: true,
          visible: true,
          looksClickable: true,
          hasVisibleLabel: true,
          isIconOnly: false,
          textTruncated: false,
          visualWeight: 0.0043,
          dataUxAction: "create-project",
          hasVisibleAffordance: true
        },
        {
          id: "secondary-heavy",
          tag: "button",
          role: "button",
          visibleText: "Learn more",
          ariaLabel: null,
          title: null,
          bbox: { x: 260, y: 32, width: 280, height: 72 },
          clickable: true,
          disabled: false,
          aboveFold: true,
          visible: true,
          looksClickable: true,
          hasVisibleLabel: true,
          isIconOnly: false,
          textTruncated: false,
          visualWeight: 0.022,
          dataUxAction: "open-docs",
          hasVisibleAffordance: true
        },
        {
          id: "open-settings",
          tag: "button",
          role: "button",
          visibleText: "Open",
          ariaLabel: null,
          title: null,
          bbox: { x: 40, y: 120, width: 100, height: 40 },
          clickable: true,
          disabled: false,
          aboveFold: true,
          visible: true,
          looksClickable: true,
          hasVisibleLabel: true,
          isIconOnly: false,
          textTruncated: false,
          visualWeight: 0.0043,
          dataUxAction: "open-settings",
          hasVisibleAffordance: true
        },
        {
          id: "open-billing",
          tag: "button",
          role: "button",
          visibleText: "Open",
          ariaLabel: null,
          title: null,
          bbox: { x: 150, y: 120, width: 100, height: 40 },
          clickable: true,
          disabled: false,
          aboveFold: true,
          visible: true,
          looksClickable: true,
          hasVisibleLabel: true,
          isIconOnly: false,
          textTruncated: false,
          visualWeight: 0.0043,
          dataUxAction: "open-billing",
          hasVisibleAffordance: true
        },
        {
          id: "save",
          tag: "button",
          role: "button",
          visibleText: "Save",
          ariaLabel: null,
          title: null,
          bbox: { x: 40, y: 180, width: 100, height: 40 },
          clickable: true,
          disabled: false,
          aboveFold: true,
          visible: true,
          looksClickable: true,
          hasVisibleLabel: true,
          isIconOnly: false,
          textTruncated: false,
          visualWeight: 0.0043,
          dataUxAction: "save-project",
          hasVisibleAffordance: true
        },
        {
          id: "save-changes",
          tag: "button",
          role: "button",
          visibleText: "Save changes",
          ariaLabel: null,
          title: null,
          bbox: { x: 150, y: 180, width: 140, height: 40 },
          clickable: true,
          disabled: false,
          aboveFold: true,
          visible: true,
          looksClickable: true,
          hasVisibleLabel: true,
          isIconOnly: false,
          textTruncated: false,
          visualWeight: 0.0061,
          dataUxAction: "save-project",
          hasVisibleAffordance: true
        }
      ]
    });

    const detectors = runDetectors(screenMap, scenario).map((finding) => finding.detector);

    expect(detectors).toEqual(
      expect.arrayContaining([
        "primary_cta_low_visual_weight",
        "multiple_primary_ctas_conflict",
        "secondary_action_overpowers_primary",
        "same_label_different_actions",
        "same_action_different_labels"
      ])
    );
  });

  it("detects evidence-backed accessibility and recovery-state issues", () => {
    const screenMap = baseScreenMap({
      visibleText: ["No projects yet", "Loading projects", "Error loading dashboard", "+"],
      elements: [
        baseElement({
          id: "icon",
          tag: "button",
          role: "button",
          visibleText: "+",
          ariaLabel: "Create first project",
          bbox: { x: 20, y: 20, width: 28, height: 28 },
          clickable: true,
          looksClickable: true,
          hasVisibleLabel: false,
          isIconOnly: true,
          visualWeight: 0.001,
          hasVisibleAffordance: true
        }),
        baseElement({
          id: "dialog",
          tag: "dialog",
          role: "dialog",
          visibleText: "Settings"
        }),
        baseElement({
          id: "status",
          visibleText: "Loading projects",
          dataUxRole: "status"
        })
      ]
    });

    const detectors = runDetectors(screenMap, scenario).map((finding) => finding.detector);

    expect(detectors).toEqual(
      expect.arrayContaining([
        "icon_button_without_visible_label",
        "dialog_without_accessible_name",
        "status_change_not_announced",
        "loading_without_progress_or_timeout",
        "dead_end_state_without_recovery",
        "empty_state_without_next_step"
      ])
    );
  });

  it("does not flag announced status messages or named dialogs as recovery issues", () => {
    const screenMap = baseScreenMap({
      visibleText: ["Loading projects", "Retry", "Settings"],
      elements: [
        baseElement({
          id: "dialog",
          tag: "dialog",
          role: "dialog",
          visibleText: "Settings",
          ariaLabelledBy: "settings-title"
        }),
        baseElement({
          id: "status",
          role: "status",
          visibleText: "Loading projects",
          dataUxRole: "status",
          ariaLive: "polite"
        }),
        baseElement({
          id: "retry",
          tag: "button",
          role: "button",
          visibleText: "Retry",
          clickable: true,
          looksClickable: true,
          hasVisibleAffordance: true
        })
      ]
    });

    const detectors = runDetectors(screenMap, scenario).map((finding) => finding.detector);

    expect(detectors).not.toContain("dialog_without_accessible_name");
    expect(detectors).not.toContain("status_change_not_announced");
    expect(detectors).not.toContain("loading_without_progress_or_timeout");
    expect(detectors).not.toContain("dead_end_state_without_recovery");
  });

  it("fails when the primary CTA is only below the fold", () => {
    const screenMap = baseScreenMap({
      visibleText: ["Projects", "No projects yet", "Create first project"],
      elements: [
        {
          id: "e1",
          tag: "button",
          role: "button",
          visibleText: "Create first project",
          ariaLabel: null,
          title: null,
          bbox: { x: 520, y: 900, width: 180, height: 44 },
          clickable: true,
          disabled: false,
          aboveFold: false,
          visible: true,
          looksClickable: true,
          hasVisibleLabel: true,
          isIconOnly: false,
          textTruncated: false,
          visualWeight: 0.0086
        }
      ]
    });

    const findings = runDetectors(screenMap, scenario);

    expect(findings.map((finding) => finding.detector)).toContain("primary_cta_below_fold");
  });

  it("fails P2 findings when the detector is explicitly listed in fail_conditions", () => {
    const finding: Finding = {
      id: "UX-001",
      detector: "edge_label_crosses_node",
      title: "Graph edge label crosses a node",
      severity: "P2",
      type: "Perception Mismatch",
      evidence: "label overlaps node",
      userImpact: "Graph path is ambiguous.",
      suggestedFix: "Move the label.",
      regressionCheck: "Rerun interactive audit."
    };

    expect(
      verdictForFindings([finding], {
        id: "dag",
        title: "DAG",
        persona: "tester",
        fail_conditions: ["edge_label_crosses_node"],
        fail_conditions_explicit: true
      })
    ).toBe("fail");
    expect(
      verdictForFindings([finding], {
        id: "dag",
        title: "DAG",
        persona: "tester"
      })
    ).toBe("ambiguous");
    expect(
      verdictForFindings([finding], {
        id: "dag",
        title: "DAG",
        persona: "tester",
        fail_conditions: [],
        fail_conditions_explicit: false
      })
    ).toBe("ambiguous");
  });
});
