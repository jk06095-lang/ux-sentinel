import { createHash } from "node:crypto";
import type { Page } from "playwright";
import type { ElementBox, FindingConfidence, PointerPoint, ScreenMap, Severity, UxRuleFamily } from "./types.js";

export interface OpenUiState {
  id: string | null;
  tag: string;
  role: string | null;
  text: string;
  ariaLabel: string | null;
  ariaExpanded: string | null;
  ariaModal: string | null;
  dataState: string | null;
  dataUxRole: string | null;
  bbox: ElementBox;
}

export interface StateGraphNode {
  id: string;
  url: string;
  viewport: {
    width: number;
    height: number;
  };
  screenshot: string;
  screenMap: string;
  accessibility?: string;
  accessibilityHash: string;
  visibleTextHash: string;
  domStructureHash: string;
  openStates: OpenUiState[];
  consoleErrorCount: number;
  networkErrorCount: number;
}

export interface StateGraphEdge {
  id: string;
  actionId: string;
  actionType: string;
  targetId: string;
  targetCategory?: string;
  beforeStateId: string;
  afterStateId: string;
  beforeScreenshot: string;
  afterScreenshot: string;
  visualDiff?: string;
  domDiff: string;
  accessibilityDiff: string;
  pointerTrace?: string;
  cursorMovement?: {
    from: PointerPoint;
    to: PointerPoint;
    targetCenter: PointerPoint;
    pointCount: number;
    movementDurationMs: number;
    hoverDurationMs: number;
    targetMovedDuringApproach: boolean;
    overlayAppearedDuringApproach: boolean;
    finalHitTestMatchedTarget: boolean;
  };
  animationTrace?: string;
  findingDetectors: string[];
  findings: StateGraphFindingSummary[];
}

export interface StateGraphFindingSummary {
  id: string;
  detector: string;
  severity: Severity;
  title: string;
  ruleIds?: string[];
  ruleFamily?: UxRuleFamily;
  confidence?: FindingConfidence;
  evidencePaths?: Record<string, string>;
}

export interface StateGraph {
  version: 1;
  nodes: StateGraphNode[];
  edges: StateGraphEdge[];
}

export interface StateSnapshot {
  node: StateGraphNode;
  visibleText: string[];
  domStructure: string[];
  accessibilitySignature: string;
}

export interface StateDiff {
  beforeStateId: string;
  afterStateId: string;
  urlChanged: boolean;
  visibleTextAdded: string[];
  visibleTextRemoved: string[];
  domStructureChanged: boolean;
  domStructureBeforeHash: string;
  domStructureAfterHash: string;
  openStatesBefore: OpenUiState[];
  openStatesAfter: OpenUiState[];
  consoleErrorDelta: number;
  networkErrorDelta: number;
}

export interface AccessibilityDiff {
  beforeStateId: string;
  afterStateId: string;
  accessibilityChanged: boolean;
  accessibilityBeforeHash: string;
  accessibilityAfterHash: string;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function hashValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export async function collectStateSnapshot(
  page: Page,
  options: {
    id: string;
    screenshot: string;
    screenMap: ScreenMap;
    screenMapPath: string;
    accessibilitySnapshot: unknown;
    accessibilityPath?: string;
  }
): Promise<StateSnapshot> {
  const domEvidence = await page.evaluate(() => {
    const normalize = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
    const visible = (element: Element) => {
      const htmlElement = element as HTMLElement;
      const rect = htmlElement.getBoundingClientRect();
      const style = window.getComputedStyle(htmlElement);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || "1") > 0
      );
    };
    const elements = Array.from(document.body?.querySelectorAll<HTMLElement>("*") ?? []);
    const visibleText = elements
      .filter(visible)
      .map((element) => normalize(element.innerText || element.textContent || element.getAttribute("aria-label") || ""))
      .filter(Boolean)
      .slice(0, 500);
    const domStructure = elements
      .slice(0, 1_500)
      .map((element) =>
        [
          element.tagName.toLowerCase(),
          element.getAttribute("role") ?? "",
          element.getAttribute("data-ux-role") ?? "",
          element.getAttribute("aria-expanded") ?? "",
          element.getAttribute("aria-selected") ?? "",
          normalize(element.innerText || element.textContent || element.getAttribute("aria-label") || "").slice(0, 80)
        ].join("|")
      );
    const openStates = elements
      .filter((element) => {
        const role = element.getAttribute("role") ?? "";
        const state = element.getAttribute("data-state") ?? "";
        return (
          visible(element) &&
          (element.matches("dialog[open], [open], [popover], [aria-expanded='true']") ||
            ["dialog", "menu", "listbox", "tooltip"].includes(role) ||
            state === "open")
        );
      })
      .slice(0, 50)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          id: element.id || null,
          tag: element.tagName.toLowerCase(),
          role: element.getAttribute("role"),
          text: normalize(element.innerText || element.textContent || "").slice(0, 160),
          ariaLabel: element.getAttribute("aria-label"),
          ariaExpanded: element.getAttribute("aria-expanded"),
          ariaModal: element.getAttribute("aria-modal"),
          dataState: element.getAttribute("data-state"),
          dataUxRole: element.getAttribute("data-ux-role"),
          bbox: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        };
      });

    return {
      visibleText,
      domStructure,
      openStates
    };
  });

  const accessibilitySignature = JSON.stringify(options.accessibilitySnapshot ?? null);
  return {
    node: {
      id: options.id,
      url: options.screenMap.url,
      viewport: options.screenMap.viewport,
      screenshot: options.screenshot,
      screenMap: options.screenMapPath,
      accessibility: options.accessibilityPath,
      accessibilityHash: hashValue(accessibilitySignature),
      visibleTextHash: hashValue(uniqueSorted([...options.screenMap.visibleText, ...domEvidence.visibleText])),
      domStructureHash: hashValue(domEvidence.domStructure),
      openStates: domEvidence.openStates,
      consoleErrorCount: options.screenMap.consoleErrors.length,
      networkErrorCount: options.screenMap.networkErrors.length
    },
    visibleText: uniqueSorted([...options.screenMap.visibleText, ...domEvidence.visibleText]),
    domStructure: domEvidence.domStructure,
    accessibilitySignature
  };
}

export function diffStateSnapshots(before: StateSnapshot, after: StateSnapshot): StateDiff {
  const beforeText = new Set(before.visibleText);
  const afterText = new Set(after.visibleText);

  return {
    beforeStateId: before.node.id,
    afterStateId: after.node.id,
    urlChanged: before.node.url !== after.node.url,
    visibleTextAdded: after.visibleText.filter((text) => !beforeText.has(text)).slice(0, 100),
    visibleTextRemoved: before.visibleText.filter((text) => !afterText.has(text)).slice(0, 100),
    domStructureChanged: before.node.domStructureHash !== after.node.domStructureHash,
    domStructureBeforeHash: before.node.domStructureHash,
    domStructureAfterHash: after.node.domStructureHash,
    openStatesBefore: before.node.openStates,
    openStatesAfter: after.node.openStates,
    consoleErrorDelta: after.node.consoleErrorCount - before.node.consoleErrorCount,
    networkErrorDelta: after.node.networkErrorCount - before.node.networkErrorCount
  };
}

export function diffAccessibilitySnapshots(before: StateSnapshot, after: StateSnapshot): AccessibilityDiff {
  return {
    beforeStateId: before.node.id,
    afterStateId: after.node.id,
    accessibilityChanged: before.node.accessibilityHash !== after.node.accessibilityHash,
    accessibilityBeforeHash: before.node.accessibilityHash,
    accessibilityAfterHash: after.node.accessibilityHash
  };
}

export function buildStateGraph(nodes: StateGraphNode[], edges: StateGraphEdge[]): StateGraph {
  return {
    version: 1,
    nodes,
    edges
  };
}
