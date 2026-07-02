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
        maxStateChanges: 1,
        safeClickEnabled: true
      }
    });

    expect(planned).toHaveLength(2);
    expect(planned[0].plannedSafeClick).toBe(true);
    expect(planned[1].plannedSafeClick).toBe(false);
    expect(planned[1].plannedClickSkipReason).toBe("max_clicks limit reached by planner");
  });
});
