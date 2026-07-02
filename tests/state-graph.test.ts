import { describe, expect, it } from "vitest";
import {
  buildStateGraph,
  diffAccessibilitySnapshots,
  diffStateSnapshots,
  type StateGraphNode,
  type StateSnapshot
} from "../src/core/state-graph.js";

function snapshot(id: string, values: Omit<Partial<StateSnapshot>, "node"> & { node?: Partial<StateGraphNode> } = {}): StateSnapshot {
  return {
    node: {
      id,
      url: values.node?.url ?? "http://example.test",
      viewport: values.node?.viewport ?? { width: 1280, height: 720 },
      screenshot: values.node?.screenshot ?? `${id}.png`,
      screenMap: values.node?.screenMap ?? `${id}-screen-map.json`,
      accessibility: values.node?.accessibility,
      accessibilityHash: values.node?.accessibilityHash ?? "a".repeat(64),
      visibleTextHash: values.node?.visibleTextHash ?? "b".repeat(64),
      domStructureHash: values.node?.domStructureHash ?? "c".repeat(64),
      openStates: values.node?.openStates ?? [],
      consoleErrorCount: values.node?.consoleErrorCount ?? 0,
      networkErrorCount: values.node?.networkErrorCount ?? 0
    },
    visibleText: values.visibleText ?? [],
    domStructure: values.domStructure ?? [],
    accessibilitySignature: values.accessibilitySignature ?? "{}"
  };
}

describe("state graph evidence", () => {
  it("diffs visible text, DOM hashes, accessibility hashes, and error deltas", () => {
    const before = snapshot("s000", {
      visibleText: ["Dashboard", "Create"],
      node: { domStructureHash: "1".repeat(64), accessibilityHash: "2".repeat(64), consoleErrorCount: 1 }
    });
    const after = snapshot("s001", {
      visibleText: ["Dashboard", "Created"],
      node: { domStructureHash: "3".repeat(64), accessibilityHash: "4".repeat(64), consoleErrorCount: 3, networkErrorCount: 1 }
    });

    const domDiff = diffStateSnapshots(before, after);
    const a11yDiff = diffAccessibilitySnapshots(before, after);

    expect(domDiff.visibleTextAdded).toEqual(["Created"]);
    expect(domDiff.visibleTextRemoved).toEqual(["Create"]);
    expect(domDiff.domStructureChanged).toBe(true);
    expect(domDiff.consoleErrorDelta).toBe(2);
    expect(domDiff.networkErrorDelta).toBe(1);
    expect(a11yDiff.accessibilityChanged).toBe(true);
  });

  it("builds a reconstructable state graph", () => {
    const graph = buildStateGraph(
      [snapshot("s000").node, snapshot("s001").node],
      [
        {
          id: "e001",
          actionId: "a001",
          actionType: "hover_click",
          targetId: "t001",
          targetCategory: "primary_cta",
          beforeStateId: "s000",
          afterStateId: "s001",
          beforeScreenshot: "actions/a001-before.png",
          afterScreenshot: "actions/a001-after.png",
          domDiff: "actions/a001-dom-diff.json",
          accessibilityDiff: "actions/a001-a11y-diff.json",
          findingDetectors: []
        }
      ]
    );

    expect(graph.version).toBe(1);
    expect(graph.edges[0].beforeStateId).toBe("s000");
    expect(graph.edges[0].afterStateId).toBe("s001");
  });
});
