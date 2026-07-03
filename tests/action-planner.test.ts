import { describe, expect, it } from "vitest";
import { planInteractiveActions } from "../src/core/action-planner.js";
import { classifyInteractiveTarget } from "../src/core/target-classifier.js";
import type { InteractiveTarget, Scenario } from "../src/core/types.js";

function target(overrides: Partial<InteractiveTarget>): InteractiveTarget {
  return {
    id: overrides.id ?? "t001",
    tag: overrides.tag ?? "button",
    role: Object.prototype.hasOwnProperty.call(overrides, "role") ? (overrides.role ?? null) : "button",
    dataUxRole: Object.prototype.hasOwnProperty.call(overrides, "dataUxRole") ? (overrides.dataUxRole ?? null) : null,
    dataUxAction: overrides.dataUxAction,
    dataUxClickable: overrides.dataUxClickable,
    visibleText: overrides.visibleText ?? "Action",
    ariaLabel: overrides.ariaLabel ?? null,
    ariaHasPopup: overrides.ariaHasPopup ?? null,
    title: overrides.title ?? null,
    bbox: overrides.bbox ?? { x: 10, y: 10, width: 120, height: 40 },
    center: overrides.center ?? { x: 70, y: 30 },
    disabled: overrides.disabled ?? false,
    focusable: overrides.focusable ?? true,
    href: overrides.href ?? null,
    safeToClick: overrides.safeToClick ?? true,
    skipClickReason: overrides.skipClickReason
  };
}

const scenario: Scenario = {
  id: "agentic",
  title: "Agentic",
  persona: "tester",
  visual_contract: {
    primary_cta: {
      preferred_labels: ["Create first project"]
    }
  }
};

describe("target classifier and action planner", () => {
  it("classifies scenario primary CTAs and graph/DAG metadata", () => {
    expect(classifyInteractiveTarget(target({ visibleText: "Create first project" }), scenario).category).toBe("primary_cta");
    expect(classifyInteractiveTarget(target({ dataUxRole: "dag-node", visibleText: "Node A", safeToClick: false }), scenario).category).toBe(
      "graph_dag_node"
    );
    expect(classifyInteractiveTarget(target({ role: "tab", visibleText: "Details" }), scenario).category).toBe("tab");
  });

  it("classifies ARIA popup and combobox targets for agentic planning", () => {
    expect(classifyInteractiveTarget(target({ visibleText: "Actions", ariaHasPopup: "menu" }), scenario)).toMatchObject({
      category: "menu",
      reason: "ARIA popup menu trigger"
    });
    expect(classifyInteractiveTarget(target({ visibleText: "Filters", ariaHasPopup: "listbox" }), scenario)).toMatchObject({
      category: "dropdown",
      reason: "ARIA popup listbox trigger"
    });
    expect(classifyInteractiveTarget(target({ visibleText: "Choose workspace", role: "combobox" }), scenario)).toMatchObject({
      category: "dropdown"
    });
    expect(classifyInteractiveTarget(target({ visibleText: "Open settings", ariaHasPopup: "dialog" }), scenario)).toMatchObject({
      category: "dialog_trigger",
      reason: "ARIA popup dialog trigger"
    });
  });

  it("prioritizes agentic actions by UX meaning instead of DOM order", () => {
    const planned = planInteractiveActions({
      targets: [
        target({ id: "t1", tag: "div", role: null, visibleText: "Mystery", safeToClick: false, skipClickReason: "not a click control" }),
        target({ id: "t2", role: "tab", visibleText: "Details" }),
        target({ id: "t3", visibleText: "Create first project" })
      ],
      scrollTargets: [target({ id: "s1", tag: "section", role: null, visibleText: "Scrollable activity", safeToClick: false })],
      scenario,
      config: {
        mode: "agentic",
        maxActions: 4,
        maxDepth: 2,
        maxClicks: 4,
        maxStateChanges: 4,
        safeClickEnabled: true
      }
    });

    expect(planned.map((item) => item.targetCategory)).toEqual(["primary_cta", "tab", "scroll_container", "ambiguous_clickable"]);
    expect(planned[0].plannedReason).toContain("primary_cta");
  });

  it("respects max_actions, max_clicks, max_state_changes, and repeated target keys", () => {
    const duplicateBox = { x: 20, y: 20, width: 100, height: 40 };
    const planned = planInteractiveActions({
      targets: [
        target({ id: "t1", visibleText: "Create first project", bbox: duplicateBox }),
        target({ id: "t2", visibleText: "Create first project", bbox: duplicateBox }),
        target({ id: "t3", visibleText: "Archive" })
      ],
      scrollTargets: [],
      scenario,
      config: {
        mode: "agentic",
        maxActions: 3,
        maxDepth: 2,
        maxClicks: 1,
        maxStateChanges: 3,
        safeClickEnabled: true
      }
    });

    expect(planned).toHaveLength(2);
    expect(planned[0].plannedSafeClick).toBe(true);
    expect(planned[1].plannedSafeClick).toBe(false);
    expect(planned[1].plannedClickSkipReason).toBe("max_clicks limit reached by planner");
  });

  it("does not collapse same-label targets when their action identity differs", () => {
    const duplicateBox = { x: 20, y: 20, width: 100, height: 40 };
    const planned = planInteractiveActions({
      targets: [
        target({ id: "t1", visibleText: "Open", bbox: duplicateBox, dataUxAction: "open-billing" }),
        target({ id: "t2", visibleText: "Open", bbox: duplicateBox, dataUxAction: "open-security" }),
        target({ id: "t3", tag: "a", role: "link", visibleText: "Open", href: "/audit-log", bbox: duplicateBox })
      ],
      scrollTargets: [],
      scenario,
      config: {
        mode: "agentic",
        maxActions: 3,
        maxDepth: 2,
        maxClicks: 3,
        maxStateChanges: 3,
        safeClickEnabled: true
      }
    });

    expect(planned).toHaveLength(3);
    expect(planned.map((item) => item.target.id)).toEqual(["t3", "t1", "t2"]);
    expect(new Set(planned.map((item) => item.stateKey)).size).toBe(3);
  });

  it("does not collapse same-label targets when popup semantics differ", () => {
    const duplicateBox = { x: 20, y: 20, width: 100, height: 40 };
    const planned = planInteractiveActions({
      targets: [
        target({ id: "t1", visibleText: "Open", bbox: duplicateBox, ariaHasPopup: "menu" }),
        target({ id: "t2", visibleText: "Open", bbox: duplicateBox, ariaHasPopup: "dialog" })
      ],
      scrollTargets: [],
      scenario,
      config: {
        mode: "agentic",
        maxActions: 2,
        maxDepth: 2,
        maxClicks: 2,
        maxStateChanges: 2,
        safeClickEnabled: true
      }
    });

    expect(planned).toHaveLength(2);
    expect(planned.map((item) => item.targetCategory)).toEqual(["menu", "dialog_trigger"]);
    expect(new Set(planned.map((item) => item.stateKey)).size).toBe(2);
  });

  it("reports max_state_changes when state-change budget blocks otherwise safe clicks", () => {
    const planned = planInteractiveActions({
      targets: [
        target({ id: "t1", visibleText: "Create first project" }),
        target({ id: "t2", visibleText: "Review settings" })
      ],
      scrollTargets: [],
      scenario,
      config: {
        mode: "agentic",
        maxActions: 2,
        maxDepth: 2,
        maxClicks: 4,
        maxStateChanges: 1,
        safeClickEnabled: true
      }
    });

    expect(planned).toHaveLength(2);
    expect(planned[0].plannedSafeClick).toBe(true);
    expect(planned[1].plannedSafeClick).toBe(false);
    expect(planned[1].plannedClickSkipReason).toBe("max_state_changes limit reached by planner");
  });

  it("records non-zero depth for actions planned after a state change", () => {
    const planned = planInteractiveActions({
      targets: [target({ id: "t1", visibleText: "Open discovered insight", dataUxAction: "open-discovered-panel" })],
      scrollTargets: [],
      scenario,
      config: {
        mode: "agentic",
        maxActions: 1,
        maxDepth: 2,
        maxClicks: 1,
        maxStateChanges: 1,
        safeClickEnabled: true,
        depth: 1
      }
    });

    expect(planned).toHaveLength(1);
    expect(planned[0].depth).toBe(1);
    expect(planned[0].targetCategory).toBe("dialog_trigger");
    expect(planned[0].plannedSafeClick).toBe(true);
  });
});
