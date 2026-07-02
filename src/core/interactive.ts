import path from "node:path";
import { readFile } from "node:fs/promises";
import { chromium, type ConsoleMessage, type Page, type Response } from "playwright";
import { buildScreenMapOverlay } from "./overlay.js";
import { collectScreenMap, safeAccessibilitySnapshot } from "./observe-page.js";
import { defaultPreferredLabels } from "./scenario.js";
import { displayPath, ensureDir, timestamp, writeJson, writeText } from "./files.js";
import { resolveInteractiveCapabilities } from "./capabilities.js";
import { planInteractiveActions, type PlannedInteractiveAction } from "./action-planner.js";
import { recordPointerTrace } from "./pointer-trace.js";
import {
  animationTraceHasLongDuration,
  animationTraceHasRiskyProperties,
  recordAnimationTrace,
  resolveAnimationAuditOptions
} from "./animation-audit.js";
import { enrichFindingsWithRules } from "./rules/registry.js";
import {
  buildStateGraph,
  collectStateSnapshot,
  diffAccessibilitySnapshots,
  diffStateSnapshots,
  type StateGraphEdge,
  type StateGraphNode,
  type StateDiff,
  type StateSnapshot
} from "./state-graph.js";
import type {
  AnimationAuditOptions,
  AnimationTrace,
  ClickBlockage,
  ConsoleIssue,
  ElementBox,
  Finding,
  FocusEvidence,
  InteractiveCapabilities,
  InteractiveActionRecord,
  InteractiveCapabilityPolicy,
  InteractiveCommandMode,
  InteractiveExplorationResult,
  InteractiveTarget,
  NetworkIssue,
  PointerPoint,
  PointerTrace,
  Scenario,
  ScreenMap,
  Severity
} from "./types.js";

export interface InteractiveExploreOptions {
  url: string;
  scenario?: Scenario;
  traceRoot?: string;
  maxActions?: number;
  settleMs?: number;
  commandMode?: InteractiveCommandMode;
  clickSafeOverride?: boolean;
}

export interface InteractiveConfig {
  maxActions: number;
  mode: string;
  maxDepth: number;
  maxClicks: number;
  maxStateChanges: number;
  hoverAllClickables: boolean;
  clickAllSafeControls: boolean;
  focusAllKeyboardTargets: boolean;
  scrollContainers: boolean;
  screenshotBeforeAfterEachAction: boolean;
  settleMs: number;
  avoidClickText: string[];
  allowNavigation: boolean;
  animationAudit: AnimationAuditOptions;
  capabilityPolicy: InteractiveCapabilityPolicy;
  notes: string[];
}

interface ActionExecutionResult {
  action: InteractiveActionRecord;
  findings: Finding[];
  screenMap: ScreenMap;
  pointerEnd?: PointerPoint;
}

export interface VisualBox {
  id: string;
  kind: string;
  text: string;
  bbox: ElementBox;
}

export interface TextClipMetric extends VisualBox {
  inCard: boolean;
  overflowX: string;
  overflowY: string;
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
}

export interface DagContainerMetric extends VisualBox {
  unusedRatio: number;
}

export interface VisualAnalysis {
  viewport: {
    width: number;
    height: number;
  };
  textBoxes: VisualBox[];
  primaryActions: VisualBox[];
  floatingOverlays: VisualBox[];
  svgNodes: VisualBox[];
  svgEdges: VisualBox[];
  svgTexts: VisualBox[];
  cards: VisualBox[];
  clippedText: TextClipMetric[];
  dagContainers: DagContainerMetric[];
  emptyDagColumns: VisualBox[];
}

export interface HitTestSample {
  point: {
    x: number;
    y: number;
  };
  kind: "center" | "corner";
  topIsTargetOrDescendant: boolean;
  blocker?: ClickBlockage["blocker"];
}

const defaultAvoidClickText = [
  "Delete",
  "Remove",
  "Pay",
  "Purchase",
  "Logout",
  "Sign out",
  "delete",
  "remove",
  "pay",
  "purchase",
  "logout",
  "sign out",
  "삭제",
  "제거",
  "결제",
  "로그아웃"
];

const targetSelector = [
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "summary",
  "[role='button']",
  "[role='link']",
  "[role='tab']",
  "[role='menuitem']",
  "[role='switch']",
  "[role='checkbox']",
  "[role='radio']",
  "[tabindex]",
  "[data-ux-role]"
].join(",");

function consoleIssue(message: ConsoleMessage): ConsoleIssue {
  return {
    type: message.type(),
    text: message.text(),
    location: message.location()
  };
}

function networkIssue(response: Response): NetworkIssue {
  return {
    url: response.url(),
    status: response.status(),
    statusText: response.statusText(),
    method: response.request().method()
  };
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function targetLabel(target: Pick<InteractiveTarget, "visibleText" | "ariaLabel" | "title">): string {
  return normalizeText([target.visibleText, target.ariaLabel, target.title].filter(Boolean).join(" "));
}

export function resolveInteractiveConfig(scenario?: Scenario, options?: InteractiveExploreOptions): InteractiveConfig {
  const source = scenario?.interactive_exploration;
  const mode = source?.mode ?? "linear";
  const maxActions = options?.maxActions ?? source?.max_actions ?? 40;
  const settleMs = options?.settleMs ?? source?.settle_ms ?? 350;
  const maxDepth = source?.max_depth ?? (mode === "agentic" ? 2 : 1);
  const maxClicks = source?.max_clicks ?? (mode === "agentic" ? 20 : 250);
  const maxStateChanges = source?.max_state_changes ?? (mode === "agentic" ? 40 : 250);
  const notes: string[] = [];
  if (source?.screenshot_before_after_each_action === false) {
    notes.push("Interactive audit always captures before/after screenshots so the contact sheet remains evidence-backed.");
  }
  const commandMode = options?.commandMode ?? (scenario ? "run" : "explore");
  const capabilityPolicy =
    commandMode === "explore"
      ? resolveInteractiveCapabilities(scenario, {
          commandMode,
          clickSafeOverride: options?.clickSafeOverride
        })
      : resolveInteractiveCapabilities(scenario, { commandMode });
  const clickAllSafeControls = capabilityPolicy.capabilities.safe_click;

  return {
    maxActions: Math.max(1, Math.min(250, Math.floor(maxActions))),
    mode,
    maxDepth: Math.max(0, Math.min(8, Math.floor(maxDepth))),
    maxClicks: Math.max(0, Math.min(250, Math.floor(maxClicks))),
    maxStateChanges: Math.max(0, Math.min(250, Math.floor(maxStateChanges))),
    hoverAllClickables: source?.hover_all_clickables ?? true,
    clickAllSafeControls,
    focusAllKeyboardTargets: source?.focus_all_keyboard_targets ?? true,
    scrollContainers: source?.scroll_containers ?? true,
    screenshotBeforeAfterEachAction: true,
    settleMs: Math.max(0, Math.min(5_000, Math.floor(settleMs))),
    avoidClickText: [...defaultAvoidClickText, ...(source?.avoid_click_text ?? [])],
    allowNavigation: capabilityPolicy.capabilities.navigation,
    animationAudit: resolveAnimationAuditOptions(scenario?.animation_audit),
    capabilityPolicy,
    notes
  };
}

export function isDangerousClickLabel(label: string, avoidClickText = defaultAvoidClickText): boolean {
  const normalized = normalizeText(label).toLowerCase();
  return Boolean(normalized) && avoidClickText.some((item) => normalized.includes(normalizeText(item).toLowerCase()));
}

export function intersectionArea(a: ElementBox, b: ElementBox): number {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

export function intersectionRatio(a: ElementBox, b: ElementBox): number {
  const smallestArea = Math.max(1, Math.min(a.width * a.height, b.width * b.height));
  return intersectionArea(a, b) / smallestArea;
}

export function hasClippedTextMetric(metric: Pick<TextClipMetric, "text" | "scrollWidth" | "clientWidth" | "scrollHeight" | "clientHeight">): boolean {
  return (
    normalizeText(metric.text).length > 6 &&
    (metric.scrollWidth > metric.clientWidth + 2 || metric.scrollHeight > metric.clientHeight + 2)
  );
}

export function clickBlockageFromHitTest(samples: HitTestSample[]): ClickBlockage | undefined {
  const center = samples.find((sample) => sample.kind === "center");
  const blockedCenter = center && !center.topIsTargetOrDescendant ? center : undefined;
  const blockedCorners = samples.filter((sample) => sample.kind === "corner" && !sample.topIsTargetOrDescendant);
  const blocked = blockedCenter ?? (blockedCorners.length >= 3 ? blockedCorners[0] : undefined);

  if (!blocked) {
    return undefined;
  }

  return {
    blocked: true,
    samplePoint: blocked.point,
    blocker: blocked.blocker
  };
}

export async function collectVisibleInteractiveTargets(page: Page, avoidClickText = defaultAvoidClickText): Promise<InteractiveTarget[]> {
  const targets = await page.evaluate(
    ({ selector, avoidText }) => {
      const normalize = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
      const dangerous = (label: string) => {
        const normalized = normalize(label).toLowerCase();
        return Boolean(normalized) && avoidText.some((item) => normalized.includes(normalize(item).toLowerCase()));
      };
      const roleSet = new Set(["button", "link", "tab", "menuitem", "switch", "checkbox", "radio"]);
      const seen = new Set<Element>();

      return Array.from(document.querySelectorAll<HTMLElement>(selector))
        .filter((element) => {
          if (seen.has(element)) {
            return false;
          }
          seen.add(element);
          return true;
        })
        .map((element, index) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          const tag = element.tagName.toLowerCase();
          const role = element.getAttribute("role");
          const ariaLabel = element.getAttribute("aria-label");
          const title = element.getAttribute("title");
          const dataUxRole = element.getAttribute("data-ux-role");
          const dataUxAction = element.getAttribute("data-ux-action");
          const dataUxClickable = element.getAttribute("data-ux-clickable") === "true";
          const inputValue = element instanceof HTMLInputElement ? element.value : "";
          const visibleText = normalize(element.innerText || element.textContent || inputValue || "");
          const visible =
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > 0 &&
            rect.right > 0 &&
            rect.top < window.innerHeight &&
            rect.left < window.innerWidth &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity || "1") > 0;
          const disabled =
            element.hasAttribute("disabled") ||
            element.getAttribute("aria-disabled") === "true" ||
            (element as HTMLButtonElement).disabled === true;
          const href = element instanceof HTMLAnchorElement ? element.href : null;
          const inputType = element instanceof HTMLInputElement ? element.type.toLowerCase() : "";
          const focusable =
            tag === "button" ||
            tag === "a" ||
            tag === "input" ||
            tag === "select" ||
            tag === "textarea" ||
            tag === "summary" ||
            element.hasAttribute("tabindex") ||
            roleSet.has(role ?? "");
          const label = [visibleText, ariaLabel, title].filter(Boolean).join(" ");
          const insideForm = Boolean(element.closest("form"));
          const navigationLink = tag === "a" && Boolean(href) && !href?.startsWith("#") && role !== "button";
          const unsafeInput = tag === "input" && ["file", "password", "submit"].includes(inputType);
          const dangerousLabel = dangerous(label);
          const nativeClickControl =
            tag === "button" ||
            tag === "select" ||
            tag === "summary" ||
            (tag === "input" && ["button", "checkbox", "radio"].includes(inputType));
          const roleClickControl = role ? ["button", "tab", "menuitem", "switch", "checkbox", "radio"].includes(role) : false;
          const clickEligible = nativeClickControl || roleClickControl || dataUxClickable || Boolean(dataUxAction);
          const dataUxMetadataOnly = Boolean(dataUxRole) && !clickEligible;
          const safeToClick =
            clickEligible && !disabled && !insideForm && !navigationLink && !unsafeInput && !dangerousLabel;
          const skipClickReason = disabled
            ? "disabled"
            : dangerousLabel
              ? "dangerous label"
              : navigationLink
                ? "navigation link"
                : dataUxMetadataOnly
                  ? "data-ux-role metadata only"
                  : insideForm
                    ? "inside form"
                    : unsafeInput
                      ? "unsafe input type"
                      : !clickEligible
                        ? "not a click control"
                        : undefined;
          const id = `t${String(index + 1).padStart(3, "0")}`;

          element.setAttribute("data-ux-sentinel-target-id", id);

          return {
            id,
            tag,
            role,
            dataUxRole,
            dataUxAction,
            dataUxClickable,
            visibleText: visibleText.slice(0, 240),
            ariaLabel,
            title,
            bbox: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            center: {
              x: Math.round(rect.x + rect.width / 2),
              y: Math.round(rect.y + rect.height / 2)
            },
            disabled,
            focusable,
            href,
            safeToClick,
            skipClickReason,
            visible
          };
        })
        .filter((target) => target.visible)
        .map(({ visible, ...target }) => target);
    },
    { selector: targetSelector, avoidText: avoidClickText }
  );

  return targets;
}

async function collectClickBlockage(page: Page, target: InteractiveTarget): Promise<ClickBlockage | undefined> {
  const samples = await page.evaluate((targetId) => {
    const element = document.querySelector<HTMLElement>(`[data-ux-sentinel-target-id="${targetId}"]`);
    if (!element) {
      return [];
    }

    const rect = element.getBoundingClientRect();
    const points = [
      { kind: "center" as const, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
      { kind: "corner" as const, x: rect.x + 3, y: rect.y + 3 },
      { kind: "corner" as const, x: rect.right - 3, y: rect.y + 3 },
      { kind: "corner" as const, x: rect.x + 3, y: rect.bottom - 3 },
      { kind: "corner" as const, x: rect.right - 3, y: rect.bottom - 3 }
    ];

    return points.map((point) => {
      const top = document.elementFromPoint(point.x, point.y) as HTMLElement | null;
      const rectForTop = top?.getBoundingClientRect();
      const topIsTargetOrDescendant = Boolean(top && (top === element || element.contains(top)));

      return {
        kind: point.kind,
        point: {
          x: Math.round(point.x),
          y: Math.round(point.y)
        },
        topIsTargetOrDescendant,
        blocker:
          top && !topIsTargetOrDescendant
            ? {
                tag: top.tagName.toLowerCase(),
                role: top.getAttribute("role"),
                text: (top.innerText || top.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
                ariaLabel: top.getAttribute("aria-label"),
                bbox: {
                  x: Math.round(rectForTop?.x ?? 0),
                  y: Math.round(rectForTop?.y ?? 0),
                  width: Math.round(rectForTop?.width ?? 0),
                  height: Math.round(rectForTop?.height ?? 0)
                }
              }
            : undefined
      };
    });
  }, target.id);

  return clickBlockageFromHitTest(samples);
}

async function collectVisualAnalysis(page: Page, scenario?: Scenario): Promise<VisualAnalysis> {
  const preferredLabels = scenario?.visual_contract?.primary_cta?.preferred_labels?.length
    ? scenario.visual_contract.primary_cta.preferred_labels
    : defaultPreferredLabels;

  return page.evaluate(
    ({ interactiveSelector, labels }) => {
      const normalize = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
      const boxFor = (element: Element) => {
        const rect = element.getBoundingClientRect();
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      };
      const visibleBox = (box: ElementBox) =>
        box.width > 0 && box.height > 0 && box.x + box.width > 0 && box.y + box.height > 0 && box.x < window.innerWidth && box.y < window.innerHeight;
      const labelMatches = (value: string) => {
        const normalized = normalize(value).toLowerCase();
        return labels.some((label) => {
          const preferred = normalize(label).toLowerCase();
          return normalized === preferred || normalized.includes(preferred);
        });
      };
      const visualBoxes = (selector: string, kind: string): VisualBox[] =>
        Array.from(document.querySelectorAll<HTMLElement>(selector))
          .map((element, index) => ({
            id: `${kind}${index + 1}`,
            kind,
            text: normalize(element.innerText || element.textContent || element.getAttribute("aria-label") || ""),
            bbox: boxFor(element)
          }))
          .filter((item) => visibleBox(item.bbox));

      const textBoxes: VisualBox[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let textIndex = 1;
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        const text = normalize(node.textContent);
        const parent = node.parentElement;
        if (!text || !parent) {
          continue;
        }
        const style = window.getComputedStyle(parent);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || "1") <= 0) {
          continue;
        }
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of Array.from(range.getClientRects())) {
          const bbox = {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
          if (visibleBox(bbox)) {
            textBoxes.push({ id: `text${textIndex}`, kind: "text", text: text.slice(0, 160), bbox });
            textIndex += 1;
          }
        }
      }

      const primaryActions = Array.from(document.querySelectorAll<HTMLElement>(interactiveSelector))
        .map((element, index) => {
          const text = normalize([element.innerText || element.textContent || "", element.getAttribute("aria-label"), element.getAttribute("title")].filter(Boolean).join(" "));
          return {
            id: `primary${index + 1}`,
            kind: "primary_action",
            text,
            bbox: boxFor(element)
          };
        })
        .filter((item) => visibleBox(item.bbox) && labelMatches(item.text));

      const floatingOverlays = Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .map((element, index) => {
          const style = window.getComputedStyle(element);
          const role = element.getAttribute("role") ?? "";
          const className = String(element.getAttribute("class") ?? "").toLowerCase();
          const overlayish =
            ["fixed", "sticky", "absolute"].includes(style.position) &&
            (Number.parseInt(style.zIndex || "0", 10) > 0 ||
              /tooltip|popover|overlay|modal|dialog|menu|floating/.test(role.toLowerCase() + " " + className));
          return {
            id: `floating${index + 1}`,
            kind: /tooltip/.test(role.toLowerCase() + " " + className) ? "tooltip" : "floating",
            text: normalize(element.innerText || element.textContent || element.getAttribute("aria-label") || ""),
            bbox: boxFor(element),
            overlayish
          };
        })
        .filter((item) => item.overlayish && visibleBox(item.bbox))
        .map(({ overlayish, ...item }) => item);

      const svgNodes = visualBoxes("svg rect, svg circle, svg ellipse, svg polygon", "svg_node");
      const svgEdges = visualBoxes("svg path, svg line, svg polyline", "svg_edge");
      const svgTexts = visualBoxes("svg text", "svg_text");
      const cards = visualBoxes("[data-ux-role='card'], [data-ux-card], .card, article, [class*='card']", "card");

      const clippedText = Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .map((element, index) => {
          const style = window.getComputedStyle(element);
          const text = normalize(element.innerText || element.textContent || "");
          const inCard = Boolean(element.closest("[data-ux-role='card'], [data-ux-card], .card, article, [class*='card']"));
          return {
            id: `clip${index + 1}`,
            kind: "clipped_text",
            text: text.slice(0, 180),
            bbox: boxFor(element),
            inCard,
            overflowX: style.overflowX,
            overflowY: style.overflowY,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight
          };
        })
        .filter(
          (item) =>
            normalize(item.text).length > 6 &&
            visibleBox(item.bbox) &&
            (item.scrollWidth > item.clientWidth + 2 || item.scrollHeight > item.clientHeight + 2)
        );

      const dagContainers = Array.from(document.querySelectorAll<HTMLElement | SVGElement>("svg, canvas, [data-ux-role*='dag'], [data-ux-role*='graph'], [class*='dag'], [class*='graph']"))
        .map((element, index) => {
          const box = boxFor(element);
          const area = Math.max(1, box.width * box.height);
          const childArea = Array.from(element.querySelectorAll?.("*") ?? [])
            .map((child) => boxFor(child))
            .filter((childBox) => visibleBox(childBox))
            .reduce((sum, childBox) => sum + Math.min(area, childBox.width * childBox.height), 0);
          return {
            id: `dag${index + 1}`,
            kind: "dag_container",
            text: normalize(element.textContent || ""),
            bbox: box,
            unusedRatio: Math.max(0, Math.min(1, 1 - Math.min(1, childArea / area)))
          };
        })
        .filter((item) => visibleBox(item.bbox) && item.bbox.width * item.bbox.height > window.innerWidth * window.innerHeight * 0.1);

      const emptyDagColumns = Array.from(document.querySelectorAll<HTMLElement>("[data-ux-role='dag-column'], [data-ux-column], [class*='dag-column'], [class*='graph-column']"))
        .map((element, index) => ({
          id: `dag_column${index + 1}`,
          kind: "dag_column",
          text: normalize(element.innerText || element.textContent || element.getAttribute("aria-label") || ""),
          bbox: boxFor(element),
          childCount: element.children.length
        }))
        .filter((item) => visibleBox(item.bbox) && !item.text && item.childCount === 0)
        .map(({ childCount, ...item }) => item);

      return {
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        textBoxes,
        primaryActions,
        floatingOverlays,
        svgNodes,
        svgEdges,
        svgTexts,
        cards,
        clippedText,
        dagContainers,
        emptyDagColumns
      };
    },
    { interactiveSelector: targetSelector, labels: preferredLabels }
  );
}

function shouldCheck(scenario: Scenario | undefined, key: keyof NonNullable<Scenario["visual_anomaly_contract"]>): boolean {
  return scenario?.visual_anomaly_contract?.[key] !== false;
}

function finding(
  detector: string,
  title: string,
  severity: Severity,
  evidence: string,
  userImpact: string,
  suggestedFix: string,
  regressionCheck: string,
  actionId?: string
): Finding {
  const suffix = actionId ? ` Action: ${actionId}.` : "";
  return {
    id: "UX-I000",
    detector,
    title,
    severity,
    type: "Perception Mismatch",
    evidence: `${evidence}${suffix}`,
    userImpact,
    suggestedFix,
    regressionCheck
  };
}

function pushOnce(findings: Finding[], findingToAdd: Finding): void {
  const key = `${findingToAdd.detector}:${findingToAdd.evidence}`;
  if (!findings.some((item) => `${item.detector}:${item.evidence}` === key)) {
    findings.push(findingToAdd);
  }
}

export function detectVisualAnomalies(analysis: VisualAnalysis, scenario?: Scenario, actionId?: string): Finding[] {
  const findings: Finding[] = [];
  const graphDag = scenario?.visual_anomaly_contract?.graph_dag;

  if (shouldCheck(scenario, "no_floating_panel_covering_primary_action")) {
    for (const floating of analysis.floatingOverlays) {
      for (const primary of analysis.primaryActions) {
        if (intersectionRatio(floating.bbox, primary.bbox) > 0.15) {
          pushOnce(
            findings,
            finding(
              "floating_panel_overlaps_primary_action",
              "Floating panel overlaps the primary action",
              "P1",
              `${floating.id} overlaps primary action "${primary.text || primary.id}".`,
              "A user may not be able to perceive or safely click the intended next action.",
              "Move the floating panel away from primary actions or dismiss it before the action is needed.",
              "Rerun interactive exploration and confirm no floating panel intersects the primary CTA.",
              actionId
            )
          );
        }
      }
    }
  }

  for (const floating of analysis.floatingOverlays) {
    const offscreen =
      floating.kind === "tooltip" &&
      (floating.bbox.x < 0 ||
        floating.bbox.y < 0 ||
        floating.bbox.x + floating.bbox.width > analysis.viewport.width ||
        floating.bbox.y + floating.bbox.height > analysis.viewport.height);
    if (offscreen) {
      pushOnce(
        findings,
        finding(
          "tooltip_partially_offscreen",
          "Tooltip is partially off-screen",
          "P2",
          `${floating.id} extends outside the ${analysis.viewport.width}x${analysis.viewport.height} viewport.`,
          "Hover help can hide the state or consequence it is meant to explain.",
          "Constrain tooltip placement so it flips or shifts inside the viewport.",
          "Hover the same target and confirm the tooltip is fully visible.",
          actionId
        )
      );
    }
  }

  if (shouldCheck(scenario, "no_text_occlusion")) {
    for (const text of analysis.textBoxes.slice(0, 300)) {
      for (const edge of analysis.svgEdges.slice(0, 250)) {
        if (intersectionArea(text.bbox, edge.bbox) > 4 && intersectionRatio(text.bbox, edge.bbox) > 0.05) {
          pushOnce(
            findings,
            finding(
              "text_occluded_by_graph_edge",
              "Text appears occluded by a graph edge",
              "P2",
              `${edge.id} intersects text "${text.text.slice(0, 80)}".`,
              "Users may not be able to read a label that explains the graph state.",
              "Reroute graph edges or add label backgrounds/padding so text remains readable.",
              "Run interactive exploration and confirm graph edges do not cross readable labels.",
              actionId
            )
          );
          break;
        }
      }
    }
  }

  if (shouldCheck(scenario, "no_svg_edge_label_overlap") || graphDag?.edge_labels_must_not_cross_nodes !== false) {
    for (const label of analysis.svgTexts) {
      for (const node of analysis.svgNodes) {
        if (intersectionRatio(label.bbox, node.bbox) > 0.05) {
          pushOnce(
            findings,
            finding(
              "edge_label_crosses_node",
              "Graph edge label crosses a node",
              "P2",
              `SVG label "${label.text || label.id}" overlaps ${node.id}.`,
              "DAG labels can become visually attached to the wrong node or path.",
              "Reposition labels or reserve label lanes so edge text does not cross nodes.",
              "Run the DAG scenario and confirm edge labels do not intersect node boxes.",
              actionId
            )
          );
        }
      }
    }
  }

  if (shouldCheck(scenario, "no_important_text_truncation")) {
    for (const metric of analysis.clippedText) {
      if (hasClippedTextMetric(metric)) {
        pushOnce(
          findings,
          finding(
            "card_content_clipped",
            "Important text appears clipped",
            metric.inCard ? "P1" : "P2",
            `${metric.id} text may be clipped: "${metric.text.slice(0, 120)}".`,
            "A user may miss the current state, consequence, or recovery path.",
            "Allow the text to wrap, expand the container, or remove overflow clipping around important copy.",
            "Rerun interactive exploration and confirm important text boxes do not overflow their containers.",
            actionId
          )
        );
      }
    }
  }

  if (shouldCheck(scenario, "no_card_overlap")) {
    for (let index = 0; index < analysis.cards.length; index += 1) {
      for (let other = index + 1; other < analysis.cards.length; other += 1) {
        if (intersectionRatio(analysis.cards[index].bbox, analysis.cards[other].bbox) > 0.08) {
          pushOnce(
            findings,
            finding(
              "card_overlap",
              "Cards visually overlap",
              "P2",
              `${analysis.cards[index].id} overlaps ${analysis.cards[other].id}.`,
              "Overlapping cards can make content order and clickable regions ambiguous.",
              "Fix the layout so repeated cards reserve stable space and do not cover each other.",
              "Rerun interactive exploration and confirm card boxes no longer intersect.",
              actionId
            )
          );
        }
      }
    }
  }

  if (graphDag?.enabled !== false) {
    const maxUnused = graphDag?.max_unused_canvas_ratio ?? 0.65;
    for (const container of analysis.dagContainers) {
      if (container.unusedRatio > maxUnused) {
        pushOnce(
          findings,
          finding(
            "dag_canvas_excessive_unused_space",
            "DAG canvas has excessive unused space",
            "P2",
            `${container.id} unused ratio is ${container.unusedRatio.toFixed(2)}; limit is ${maxUnused.toFixed(2)}.`,
            "The graph can look empty or misaligned even when nodes exist elsewhere on the canvas.",
            "Tighten graph layout bounds or pan/fit the selected path into the visible canvas.",
            "Run the DAG scenario and confirm the visible canvas has meaningful occupied space.",
            actionId
          )
        );
      }
    }

    if (graphDag?.columns_must_have_labels !== false) {
      for (const column of analysis.emptyDagColumns) {
        pushOnce(
          findings,
          finding(
            "empty_dag_column_without_explanation",
            "DAG column appears empty without explanation",
            "P2",
            `${column.id} has no visible label or content.`,
            "A user can mistake an unexplained empty graph column for missing data or a rendering bug.",
            "Add a visible column label, empty-state copy, or collapse unused graph columns.",
            "Rerun the DAG scenario and confirm empty columns are labeled or removed.",
            actionId
          )
        );
      }
    }
  }

  return findings.slice(0, 50);
}

function buildBlockedClickFinding(target: InteractiveTarget, blockage: ClickBlockage, actionId: string): Finding {
  const blocker = blockage.blocker;
  return finding(
    "click_target_blocked_by_overlay",
    "Click target is blocked by another element",
    "P1",
    `${target.id} "${targetLabel(target) || target.tag}" is covered at (${blockage.samplePoint.x}, ${blockage.samplePoint.y}) by ${blocker?.tag ?? "unknown element"} "${blocker?.text || blocker?.ariaLabel || ""}".`,
    "The UI may look like it offers an action, but the click lands on a different visual layer.",
    "Remove the overlay, adjust z-index/pointer-events, or move the target so the top hit-test element is the target.",
    "Rerun interactive exploration and confirm elementFromPoint hits the target or its descendants.",
    actionId
  );
}

function buildPointerTraceFindings(trace: PointerTrace, tracePath: string, target: InteractiveTarget, actionId: string): Finding[] {
  const findings: Finding[] = [];
  const targetName = targetLabel(target) || target.tag;
  const evidence = `Pointer trace: ${tracePath}. Cursor moved toward target ${target.id} "${targetName}" from (${trace.from.x}, ${trace.from.y}) to (${trace.to.x}, ${trace.to.y}).`;

  if (trace.targetMovedDuringApproach) {
    findings.push(
      finding(
        "target_moved_during_cursor_approach",
        "Target moved during cursor approach",
        "P2",
        evidence,
        "A user may chase a moving target or click a different point than intended.",
        "Keep the control stable during hover approach or reserve layout space before interaction.",
        "Rerun interactive exploration and confirm the pointer trace shows a stable target bbox.",
        actionId
      )
    );
  }

  if (trace.overlayAppearedDuringApproach) {
    findings.push(
      finding(
        "overlay_appeared_during_cursor_approach",
        "Overlay appeared during cursor approach",
        "P2",
        `${evidence} Final blocker: ${trace.finalHitTest.blocker?.tag ?? "unknown element"} "${trace.finalHitTest.blocker?.text || trace.finalHitTest.blocker?.ariaLabel || ""}".`,
        "A hover-triggered layer can hide or intercept the action before the user completes it.",
        "Position hover content so it does not cover the trigger or intended action path.",
        "Rerun interactive exploration and confirm the pointer trace remains target-matched after hover.",
        actionId
      )
    );
  }

  if (trace.overlayAppearedDuringApproach && !trace.finalHitTestMatchedTarget) {
    findings.push(
      finding(
        "hover_trigger_blocks_target",
        "Hover content blocks the target",
        "P1",
        `${evidence} The final hit-test did not resolve to the target or a descendant.`,
        "A user can see the action but the cursor lands on hover content instead of the intended control.",
        "Move the hover layer away from the trigger or make it non-intercepting when it overlaps.",
        "Rerun the same action and confirm final elementFromPoint still resolves to the target.",
        actionId
      )
    );
  }

  if (!trace.finalHitTestMatchedTarget) {
    findings.push(
      finding(
        "cursor_target_drift",
        "Cursor final hit-test drifted away from the target",
        "P1",
        `${evidence} The final elementFromPoint result no longer matched the target.`,
        "The click affordance may be visually available while the actual pointer target has changed.",
        "Stabilize the hit target during hover, or update the control so overlays cannot steal the final hit-test.",
        "Rerun interactive exploration and confirm the pointer trace finalHitTestMatchedTarget is true.",
        actionId
      )
    );
  }

  return findings;
}

async function collectFocusEvidence(page: Page, target: InteractiveTarget): Promise<FocusEvidence> {
  return page.evaluate((targetId) => {
    const normalize = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
    const element = document.querySelector<HTMLElement>(`[data-ux-sentinel-target-id="${targetId}"]`);
    const active = document.activeElement as HTMLElement | null;
    const style = element ? window.getComputedStyle(element) : undefined;
    const rect = element?.getBoundingClientRect();
    const point = rect
      ? {
          x: Math.round(rect.x + rect.width / 2),
          y: Math.round(rect.y + rect.height / 2)
        }
      : undefined;
    const top = point ? (document.elementFromPoint(point.x, point.y) as HTMLElement | null) : null;
    const topRect = top?.getBoundingClientRect();
    const activeElementMatchesTarget = Boolean(element && active && (active === element || element.contains(active)));
    const hitTestMatchedTarget = Boolean(element && top && (top === element || element.contains(top)));
    const outlineWidth = style?.outlineWidth ?? "0px";
    const outlineWidthValue = Number.parseFloat(outlineWidth || "0") || 0;
    const outlineVisible = Boolean(style && style.outlineStyle !== "none" && outlineWidthValue > 0);
    const boxShadowVisible = Boolean(style && style.boxShadow && style.boxShadow !== "none");

    return {
      activeElementMatchesTarget,
      hasVisibleFocusIndicator: outlineVisible || boxShadowVisible,
      outlineStyle: style?.outlineStyle ?? "none",
      outlineWidth,
      boxShadow: style?.boxShadow ?? "none",
      hitTestMatchedTarget,
      blocker:
        !hitTestMatchedTarget && top && topRect
          ? {
              tag: top.tagName.toLowerCase(),
              role: top.getAttribute("role"),
              text: normalize(top.innerText || top.textContent || "").slice(0, 160),
              ariaLabel: top.getAttribute("aria-label"),
              bbox: {
                x: Math.round(topRect.x),
                y: Math.round(topRect.y),
                width: Math.round(topRect.width),
                height: Math.round(topRect.height)
              }
            }
          : undefined
    };
  }, target.id);
}

function buildFocusFindings(evidence: FocusEvidence, target: InteractiveTarget, actionId: string): Finding[] {
  const findings: Finding[] = [];
  const label = targetLabel(target) || target.tag;

  if (!evidence.activeElementMatchesTarget) {
    findings.push(
      finding(
        "keyboard_target_not_reachable",
        "Keyboard focus did not reach the intended target",
        "P1",
        `${target.id} "${label}" was focusable in the target map, but document.activeElement did not match it after focus().`,
        "Keyboard users may not be able to reach the control that the visual UI suggests is available.",
        "Fix tabindex, disabled state, or focus delegation so keyboard focus lands on the intended control.",
        "Run interactive exploration and confirm the action trace focus evidence matches the target.",
        actionId
      )
    );
    return findings;
  }

  if (!evidence.hasVisibleFocusIndicator) {
    findings.push(
      finding(
        "focus_ring_missing",
        "Focused target has no visible focus indicator",
        "P1",
        `${target.id} "${label}" focused with outline ${evidence.outlineStyle}/${evidence.outlineWidth} and box-shadow "${evidence.boxShadow}".`,
        "Keyboard users can lose track of the current action target.",
        "Add a visible :focus-visible style with outline, ring, or equivalent high-contrast indicator.",
        "Focus the same target and confirm before/after screenshots show a visible focus indicator.",
        actionId
      )
    );
  }

  if (!evidence.hitTestMatchedTarget) {
    findings.push(
      finding(
        "focus_obscured_by_author_content",
        "Focused target is obscured by author content",
        "P1",
        `${target.id} "${label}" is focused, but center hit-test resolves to ${evidence.blocker?.tag ?? "unknown element"} "${evidence.blocker?.text || evidence.blocker?.ariaLabel || ""}".`,
        "A keyboard user may have focus on a control they cannot see or safely activate.",
        "Move or dismiss the covering content, or ensure focused controls are scrolled and layered above overlays.",
        "Run interactive exploration and confirm focused targets are visible and hit-testable.",
        actionId
      )
    );
  }

  return findings;
}

function buildFeedbackFindings(action: InteractiveActionRecord, diff: StateDiff, domDiffPath: string): Finding[] {
  if (!action.clicked) {
    return [];
  }

  const noVisibleStateChange =
    !diff.urlChanged &&
    diff.visibleTextAdded.length === 0 &&
    diff.visibleTextRemoved.length === 0 &&
    !diff.domStructureChanged &&
    JSON.stringify(diff.openStatesBefore) === JSON.stringify(diff.openStatesAfter) &&
    diff.consoleErrorDelta <= 0 &&
    diff.networkErrorDelta <= 0;

  if (!noVisibleStateChange) {
    return [];
  }

  return [
    finding(
      "no_feedback_after_action",
      "Action produced no visible feedback",
      "P2",
      `${action.id} clicked ${action.target.id} "${targetLabel(action.target) || action.target.tag}", but DOM/text/open-state diff showed no visible state change. DOM diff: ${domDiffPath}.`,
      "A user may not know whether the action worked, failed, or is still pending.",
      "Show visible feedback after the action, such as changed state, confirmation copy, a loading state, or an error/recovery path.",
      "Run the same agentic interactive scenario and confirm the action produces a visible state change or feedback message.",
      action.id
    )
  ];
}

function buildAnimationFindings(trace: AnimationTrace, tracePath: string, target: InteractiveTarget, actionId: string, config: InteractiveConfig): Finding[] {
  const findings: Finding[] = [];
  const label = targetLabel(target) || target.tag;
  const evidencePrefix = `Animation trace: ${tracePath}. Target ${target.id} "${label}".`;

  if (config.animationAudit.detectRiskyProperties && animationTraceHasRiskyProperties(trace)) {
    findings.push(
      finding(
        "animation_uses_layout_paint_properties",
        "Animation uses layout or paint-heavy properties",
        "P2",
        `${evidencePrefix} Risky properties: ${trace.riskyProperties.join(", ")}.`,
        "Layout and paint-heavy animations can cause jank or unstable target positions during interaction.",
        "Prefer transform and opacity for motion, and avoid animating layout or expensive paint properties.",
        "Rerun the motion audit and confirm risky animated properties are absent.",
        actionId
      )
    );
  }

  if (animationTraceHasLongDuration(trace)) {
    findings.push(
      finding(
        "animation_duration_blocks_task",
        "Animation duration may block the task",
        "P2",
        `${evidencePrefix} At least one animation or transition exceeds ${trace.maxAnimationMs}ms including delay.`,
        "Long motion can delay recognition of state, consequence, or the next available action.",
        "Shorten the animation duration or show usable feedback before the motion completes.",
        "Rerun the motion audit and confirm durations stay within the scenario max animation window.",
        actionId
      )
    );
  }

  if (config.animationAudit.detectLayoutShift && trace.layoutShiftApproximationPx > 8) {
    findings.push(
      finding(
        "animation_causes_layout_shift",
        "Animation appears to move the target layout",
        "P2",
        `${evidencePrefix} Target layout shift approximation is ${trace.layoutShiftApproximationPx}px.`,
        "Moving controls can make the visible target difficult to track or click confidently.",
        "Reserve stable layout space or animate transform without changing the target's layout position.",
        "Rerun the motion audit and confirm the target bbox remains stable during the action.",
        actionId
      )
    );
  }

  if (config.animationAudit.compareReducedMotion && trace.reducedMotionStillAnimating) {
    findings.push(
      finding(
        "animation_ignores_reduced_motion",
        "Animation still runs under reduced-motion preference",
        "P1",
        `${evidencePrefix} Reduced-motion comparison still reported active animation or transition evidence.`,
        "Users who request reduced motion may still experience motion that distracts from or blocks the task.",
        "Add prefers-reduced-motion styles that disable or substantially shorten non-essential motion.",
        "Rerun the motion audit with reduced-motion comparison enabled and confirm no non-essential animation remains.",
        actionId
      )
    );
  }

  return findings;
}

function renumberInteractiveFindings(findings: Finding[]): Finding[] {
  return enrichFindingsWithRules(findings).map((item, index) => ({
    ...item,
    id: `UX-I${String(index + 1).padStart(3, "0")}`
  }));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function uniqueValues(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b));
}

function relativeArtifact(traceDir: string, filePath: string | undefined): string {
  return filePath ? path.relative(traceDir, filePath).replace(/\\/g, "/") : "none";
}

function bboxOverlayStyle(box: ElementBox): string {
  const viewportWidth = 1280;
  const viewportHeight = 720;
  return [
    `left:${Math.max(0, (box.x / viewportWidth) * 100).toFixed(2)}%`,
    `top:${Math.max(0, (box.y / viewportHeight) * 100).toFixed(2)}%`,
    `width:${Math.max(0, (box.width / viewportWidth) * 100).toFixed(2)}%`,
    `height:${Math.max(0, (box.height / viewportHeight) * 100).toFixed(2)}%`
  ].join(";");
}

export function buildContactSheetHtml(result: Pick<InteractiveExplorationResult, "actions" | "findings" | "summary" | "artifacts">): string {
  const findingsByDetector = new Map<string, Finding[]>();
  for (const findingItem of result.findings) {
    findingsByDetector.set(findingItem.detector, [...(findingsByDetector.get(findingItem.detector) ?? []), findingItem]);
  }
  const severityOptions = uniqueValues(result.findings.map((findingItem) => findingItem.severity));
  const ruleFamilyOptions = uniqueValues(result.findings.map((findingItem) => findingItem.ruleFamily));
  const detectorOptions = uniqueValues(result.findings.map((findingItem) => findingItem.detector));
  const actionTrace = relativeArtifact(result.artifacts.traceDir, result.artifacts.actionTrace);
  const stateGraph = relativeArtifact(result.artifacts.traceDir, result.artifacts.stateGraph);
  const stateIds = uniqueValues(result.actions.flatMap((action) => [action.beforeStateId, action.afterStateId]));
  const filterOptions = (items: string[]) => items.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
  const timeline = result.actions.length
    ? result.actions
        .map((action) => {
          const status = action.skipped ? "skipped" : action.clicked ? "clicked" : action.focused ? "focused" : "observed";
          return `<a href="#${escapeHtml(action.id)}" title="${escapeHtml(action.plannedReason ?? action.actionType)}">${escapeHtml(action.id)}<span>${escapeHtml(status)}</span></a>`;
        })
        .join("\n")
    : "<p>No action timeline was captured.</p>";
  const safetyLog = result.actions.length
    ? result.actions
        .map((action) => {
          const decision = action.clickDecision ? `${action.clickDecision}: ${action.clickDecisionReason ?? "no reason recorded"}` : "not recorded";
          const skipped = action.skipped ? `; skipped: ${action.skipReason ?? "unknown reason"}` : "";
          return `<li><strong>${escapeHtml(action.id)}</strong> ${escapeHtml(decision + skipped)}</li>`;
        })
        .join("\n")
    : "<li>No action safety decisions were captured.</li>";
  const accessibilityCrossCheck = result.actions.length
    ? result.actions
        .map((action) => {
          const focusEvidence = action.focusEvidence
            ? `focus active=${action.focusEvidence.activeElementMatchesTarget}, visible=${action.focusEvidence.hasVisibleFocusIndicator}, hit-test=${action.focusEvidence.hitTestMatchedTarget}`
            : "focus evidence not captured";
          return `<li><strong>${escapeHtml(action.id)}</strong> ${escapeHtml(focusEvidence)}; a11y diff=${escapeHtml(relativeArtifact(result.artifacts.traceDir, action.accessibilityDiff))}</li>`;
        })
        .join("\n")
    : "<li>No accessibility cross-check evidence was captured.</li>";
  const animationAudit = result.actions.some((action) => action.animationTrace)
    ? result.actions
        .filter((action) => action.animationTrace)
        .map((action) => `<li><strong>${escapeHtml(action.id)}</strong> ${escapeHtml(relativeArtifact(result.artifacts.traceDir, action.animationTrace))}</li>`)
        .join("\n")
    : "<li>No animation trace was captured for this run.</li>";
  const rows = result.actions
    .map((action) => {
      const before = relativeArtifact(result.artifacts.traceDir, action.beforeScreenshot);
      const after = relativeArtifact(result.artifacts.traceDir, action.afterScreenshot);
      const visualDiff = relativeArtifact(result.artifacts.traceDir, action.visualDiff);
      const actionFindings = uniqueValues(action.findingDetectors).flatMap((detector) => findingsByDetector.get(detector) ?? []);
      const actionSeverities = uniqueValues(actionFindings.map((findingItem) => findingItem.severity));
      const actionRuleFamilies = uniqueValues(actionFindings.map((findingItem) => findingItem.ruleFamily));
      const findings = action.findingDetectors.length ? action.findingDetectors.join(", ") : "none";
      const status = action.skipped ? `skipped: ${action.skipReason ?? "unknown reason"}` : action.clicked ? "clicked" : "not clicked";
      const clickDecision = action.clickDecision
        ? `${action.clickDecision}: ${action.clickDecisionReason ?? "no reason recorded"}`
        : "not recorded";
      const planned = action.plannedReason
        ? `${action.targetCategory ?? "unknown"} / ${action.riskLevel ?? "unknown"} risk: ${action.plannedReason}`
        : "not recorded";
      const pointerTrace = action.pointerTrace
        ? path.relative(result.artifacts.traceDir, action.pointerTrace).replace(/\\/g, "/")
        : "none";
      const animationTrace = action.animationTrace
        ? relativeArtifact(result.artifacts.traceDir, action.animationTrace)
        : "none";
      const focusEvidence = action.focusEvidence
        ? `active=${action.focusEvidence.activeElementMatchesTarget}, visible=${action.focusEvidence.hasVisibleFocusIndicator}, hit-test=${action.focusEvidence.hitTestMatchedTarget}`
        : "none";
      const actionFindingList = actionFindings.length
        ? actionFindings
            .map(
              (findingItem) =>
                `<li><strong>${escapeHtml(findingItem.severity)} ${escapeHtml(findingItem.detector)}</strong> ${escapeHtml(findingItem.title)}<br /><span>${escapeHtml(findingItem.whyThisMatters ?? "No UX rule mapping recorded.")}</span></li>`
            )
            .join("\n")
        : "<li>No findings attached to this action.</li>";
      const overlay = `<span class="bbox" style="${bboxOverlayStyle(action.target.bbox)}"></span>`;
      return `<article id="${escapeHtml(action.id)}" data-action-card data-detectors="${escapeHtml(action.findingDetectors.join(" "))}" data-severities="${escapeHtml(actionSeverities.join(" "))}" data-rule-families="${escapeHtml(actionRuleFamilies.join(" "))}">
  <h2>${escapeHtml(action.id)} - ${escapeHtml(action.actionType)} - ${escapeHtml(status)}</h2>
  <p><strong>Target:</strong> ${escapeHtml(action.target.role ?? action.target.tag)} ${escapeHtml(targetLabel(action.target))}</p>
  <p><strong>BBox:</strong> ${action.target.bbox.x}, ${action.target.bbox.y}, ${action.target.bbox.width}x${action.target.bbox.height}</p>
  <p><strong>Plan:</strong> ${escapeHtml(planned)}</p>
  <p><strong>Safe click decision:</strong> ${escapeHtml(clickDecision)}</p>
  <p><strong>Pointer trace:</strong> ${escapeHtml(pointerTrace)}</p>
  <p><strong>Animation trace:</strong> ${escapeHtml(animationTrace)}</p>
  <p><strong>Focus evidence:</strong> ${escapeHtml(focusEvidence)}</p>
  <p><strong>State:</strong> ${escapeHtml(action.beforeStateId ?? "unknown")} -> ${escapeHtml(action.afterStateId ?? "unknown")}</p>
  <p><strong>Diffs:</strong> visual=${escapeHtml(visualDiff)} / dom=${escapeHtml(relativeArtifact(result.artifacts.traceDir, action.domDiff))} / a11y=${escapeHtml(relativeArtifact(result.artifacts.traceDir, action.accessibilityDiff))}</p>
  <p><strong>URL:</strong> ${escapeHtml(action.urlBefore ?? "")}${action.urlAfter && action.urlAfter !== action.urlBefore ? ` -> ${escapeHtml(action.urlAfter)}` : ""}</p>
  <p><strong>Findings:</strong> ${escapeHtml(findings)}</p>
  <details open><summary>UX principle mapping for this action</summary><ul>${actionFindingList}</ul></details>
  <div class="shots">
    <figure><div class="shot-frame"><img src="${escapeHtml(before)}" alt="${escapeHtml(action.id)} before" />${overlay}</div><figcaption>before</figcaption></figure>
    <figure><div class="shot-frame"><img src="${escapeHtml(after)}" alt="${escapeHtml(action.id)} after" />${overlay}</div><figcaption>after</figcaption></figure>
    ${
      action.visualDiff
        ? `<figure><div class="shot-frame"><img src="${escapeHtml(visualDiff)}" alt="${escapeHtml(action.id)} visual diff" />${overlay}</div><figcaption>visual diff</figcaption></figure>`
        : ""
    }
  </div>
</article>`;
    })
    .join("\n");

  const findingList = result.findings.length
    ? result.findings
        .map(
          (findingItem) =>
            `<li data-finding-detail data-detector="${escapeHtml(findingItem.detector)}" data-severity="${escapeHtml(findingItem.severity)}" data-rule-family="${escapeHtml(findingItem.ruleFamily ?? "")}"><strong>${escapeHtml(findingItem.severity)} ${escapeHtml(findingItem.detector)}</strong>: ${escapeHtml(findingItem.title)}<br /><span>Rule family: ${escapeHtml(findingItem.ruleFamily ?? "none")} | Confidence: ${escapeHtml(findingItem.confidence ?? "unknown")}</span><br /><span>Why this matters: ${escapeHtml(findingItem.whyThisMatters ?? "No UX rule mapping recorded.")}</span></li>`
        )
        .join("\n")
    : "<li>No interactive anomalies detected.</li>";
  const notes = result.summary.notes.length
    ? `<h2>Notes</h2><ul>${result.summary.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("\n")}</ul>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>ux-sentinel interactive contact sheet</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #f8fafc; color: #111827; }
    header { padding: 20px 24px; border-bottom: 1px solid #d1d5db; background: #ffffff; }
    main { padding: 20px 24px; display: grid; gap: 18px; }
    section { border: 1px solid #d1d5db; border-radius: 6px; background: #ffffff; padding: 14px; }
    article { border: 1px solid #d1d5db; border-radius: 6px; background: #ffffff; padding: 14px; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    h2 { margin: 0 0 8px; font-size: 16px; }
    h3 { margin: 10px 0 6px; font-size: 14px; }
    p { margin: 4px 0; font-size: 13px; color: #374151; }
    ul { margin: 8px 0 0; }
    label { display: grid; gap: 4px; font-size: 12px; color: #374151; }
    select, input, button { font: inherit; font-size: 13px; padding: 7px 8px; border: 1px solid #9ca3af; border-radius: 4px; background: #ffffff; }
    button { cursor: pointer; background: #111827; color: #ffffff; }
    .filters { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 14px; align-items: end; }
    .timeline { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .timeline a { text-decoration: none; color: #111827; border: 1px solid #9ca3af; border-radius: 999px; padding: 6px 9px; font-size: 12px; background: #f9fafb; }
    .timeline span { color: #6b7280; margin-left: 5px; }
    .shots { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
    figure { margin: 0; }
    img { width: 100%; display: block; border: 1px solid #d1d5db; background: #111827; }
    .shot-frame { position: relative; overflow: hidden; background: #111827; }
    .bbox { position: absolute; border: 2px solid #22c55e; box-shadow: 0 0 0 1px #052e16; pointer-events: none; }
    figcaption { font-size: 12px; color: #4b5563; margin-top: 4px; }
    [hidden] { display: none; }
  </style>
</head>
<body>
  <header>
    <h1>ux-sentinel interactive contact sheet</h1>
    <p>Actions: ${result.summary.actionCount} - screenshots: ${result.summary.screenshotCount} - anomalies: ${result.summary.anomalyCount}</p>
    <p>Action trace: ${escapeHtml(actionTrace)} - state graph: ${escapeHtml(stateGraph)}</p>
    <div class="filters" aria-label="Contact sheet filters">
      <label>Severity filter<select id="severity-filter"><option value="">All severities</option>${filterOptions(severityOptions)}</select></label>
      <label>Rule-family filter<select id="rule-family-filter"><option value="">All rule families</option>${filterOptions(ruleFamilyOptions)}</select></label>
      <label>Detector filter<input id="detector-filter" list="detectors" placeholder="Type detector name" /></label>
      <button id="reset-filters" type="button">Reset filters</button>
      <datalist id="detectors">${filterOptions(detectorOptions)}</datalist>
    </div>
    ${notes}
  </header>
  <main>
    <section>
      <h2>Action Timeline</h2>
      <div class="timeline">${timeline}</div>
      <h3>State Graph Summary</h3>
      <p>States observed: ${stateIds.length || "unknown"} - edges: ${result.actions.length} - artifact: ${escapeHtml(stateGraph)}</p>
    </section>
    <section>
      <h2>Safety Log</h2>
      <ul>${safetyLog}</ul>
    </section>
    <section>
      <h2>Accessibility Cross-Check</h2>
      <ul>${accessibilityCrossCheck}</ul>
    </section>
    <section>
      <h2>Animation Audit</h2>
      <ul>${animationAudit}</ul>
    </section>
    <section>
      <h2>Finding Evidence And UX Principles</h2>
      <p>Evidence-backed findings are shown with severity, detector, rule family, confidence, and mapped UX rationale. Lower-confidence entries should be treated as review prompts, not final judgments.</p>
      <ul>${findingList}</ul>
    </section>
    ${rows || "<p>No actions were captured.</p>"}
  </main>
  <script>
    const severityFilter = document.getElementById("severity-filter");
    const ruleFamilyFilter = document.getElementById("rule-family-filter");
    const detectorFilter = document.getElementById("detector-filter");
    const resetFilters = document.getElementById("reset-filters");
    const actionCards = Array.from(document.querySelectorAll("[data-action-card]"));
    const findingDetails = Array.from(document.querySelectorAll("[data-finding-detail]"));
    function matches(value, haystack) {
      return !value || haystack.toLowerCase().includes(value.toLowerCase());
    }
    function applyFilters() {
      const severity = severityFilter.value;
      const ruleFamily = ruleFamilyFilter.value;
      const detector = detectorFilter.value.trim();
      for (const card of actionCards) {
        const visible =
          matches(severity, card.dataset.severities || "") &&
          matches(ruleFamily, card.dataset.ruleFamilies || "") &&
          matches(detector, card.dataset.detectors || "");
        card.hidden = !visible;
      }
      for (const item of findingDetails) {
        const visible =
          matches(severity, item.dataset.severity || "") &&
          matches(ruleFamily, item.dataset.ruleFamily || "") &&
          matches(detector, item.dataset.detector || "");
        item.hidden = !visible;
      }
    }
    severityFilter.addEventListener("change", applyFilters);
    ruleFamilyFilter.addEventListener("change", applyFilters);
    detectorFilter.addEventListener("input", applyFilters);
    resetFilters.addEventListener("click", () => {
      severityFilter.value = "";
      ruleFamilyFilter.value = "";
      detectorFilter.value = "";
      applyFilters();
    });
  </script>
</body>
</html>
`;
}

async function captureActionScreenMap(page: Page, filePath: string, consoleErrors: ConsoleIssue[], networkErrors: NetworkIssue[]) {
  const screenMap = await collectScreenMap(page, page.url(), consoleErrors, networkErrors);
  await writeJson(filePath, screenMap);
  return screenMap;
}

async function writeVisualDiffScreenshot(page: Page, beforeScreenshot: string, afterScreenshot: string, diffPath: string): Promise<void> {
  const [beforeBuffer, afterBuffer] = await Promise.all([readFile(beforeScreenshot), readFile(afterScreenshot)]);
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  const diffPage = await page.context().newPage();
  try {
    await diffPage.setViewportSize(viewport);
    await diffPage.setContent(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
    .frame { position: relative; width: ${viewport.width}px; height: ${viewport.height}px; background: #000; }
    img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; }
    .after { mix-blend-mode: difference; }
  </style>
</head>
<body>
  <div class="frame">
    <img src="data:image/png;base64,${beforeBuffer.toString("base64")}" alt="before" />
    <img class="after" src="data:image/png;base64,${afterBuffer.toString("base64")}" alt="after" />
  </div>
</body>
</html>`);
    await diffPage.screenshot({ path: diffPath, fullPage: false });
  } finally {
    await diffPage.close();
  }
}

async function recordActionStateEvidence(options: {
  page: Page;
  action: InteractiveActionRecord;
  screenMap: ScreenMap;
  beforeState: StateSnapshot;
  stateSequence: number;
  actionsDir: string;
  detectNoFeedback: boolean;
}): Promise<{ nextState: StateSnapshot; edge: StateGraphEdge; findings: Finding[] }> {
  const afterAccessibilitySnapshot = await safeAccessibilitySnapshot(options.page);
  const afterState = await collectStateSnapshot(options.page, {
    id: `s${String(options.stateSequence).padStart(3, "0")}`,
    screenshot: options.action.afterScreenshot,
    screenMap: options.screenMap,
    screenMapPath: options.action.screenMap,
    accessibilitySnapshot: afterAccessibilitySnapshot
  });
  const domDiffPath = path.join(options.actionsDir, `${options.action.id}-dom-diff.json`);
  const accessibilityDiffPath = path.join(options.actionsDir, `${options.action.id}-a11y-diff.json`);
  const domDiff = diffStateSnapshots(options.beforeState, afterState);
  await writeJson(domDiffPath, domDiff);
  await writeJson(accessibilityDiffPath, diffAccessibilitySnapshots(options.beforeState, afterState));

  options.action.beforeStateId = options.beforeState.node.id;
  options.action.afterStateId = afterState.node.id;
  options.action.domDiff = domDiffPath;
  options.action.accessibilityDiff = accessibilityDiffPath;
  const findings = options.detectNoFeedback ? buildFeedbackFindings(options.action, domDiff, domDiffPath) : [];
  if (findings.length) {
    options.action.findingDetectors = Array.from(new Set([...options.action.findingDetectors, ...findings.map((item) => item.detector)]));
  }

  return {
    nextState: afterState,
    findings,
    edge: {
      id: `e${String(options.action.sequence).padStart(3, "0")}`,
      actionId: options.action.id,
      actionType: options.action.actionType,
      targetId: options.action.target.id,
      targetCategory: options.action.targetCategory,
      beforeStateId: options.beforeState.node.id,
      afterStateId: afterState.node.id,
      beforeScreenshot: options.action.beforeScreenshot,
      afterScreenshot: options.action.afterScreenshot,
      visualDiff: options.action.visualDiff,
      domDiff: domDiffPath,
      accessibilityDiff: accessibilityDiffPath,
      pointerTrace: options.action.pointerTrace,
      animationTrace: options.action.animationTrace,
      findingDetectors: options.action.findingDetectors
    }
  };
}

export type LiveTargetResult =
  | { status: "ok"; target: InteractiveTarget }
  | { status: "missing" | "invisible" | "offscreen" | "detached"; reason: string };

export async function resolveLiveTarget(page: Page, target: InteractiveTarget): Promise<LiveTargetResult> {
  return page
    .evaluate((currentTarget) => {
      const element = document.querySelector<HTMLElement>(`[data-ux-sentinel-target-id="${currentTarget.id}"]`);
      if (!element) {
        return { status: "missing" as const, reason: `Target ${currentTarget.id} no longer exists in the DOM.` };
      }
      if (!element.isConnected) {
        return { status: "detached" as const, reason: `Target ${currentTarget.id} is detached from the document.` };
      }

      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || "1") > 0;

      if (!visible) {
        return { status: "invisible" as const, reason: `Target ${currentTarget.id} is invisible or has a zero-size box.` };
      }

      const insideViewport =
        rect.left >= 0 &&
        rect.top >= 0 &&
        rect.right <= window.innerWidth &&
        rect.bottom <= window.innerHeight;
      if (!insideViewport) {
        return { status: "offscreen" as const, reason: `Target ${currentTarget.id} is outside the current viewport.` };
      }

      return {
        status: "ok" as const,
        target: {
          ...currentTarget,
          bbox: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          center: {
            x: Math.round(rect.x + rect.width / 2),
            y: Math.round(rect.y + rect.height / 2)
          }
        }
      };
    }, target)
    .catch((error: unknown) => ({
      status: "missing" as const,
      reason: error instanceof Error ? error.message : String(error)
    }));
}

async function skippedAction(
  page: Page,
  planned: PlannedInteractiveAction,
  sequence: number,
  actionsDir: string,
  reason: string,
  urlBefore: string,
  consoleErrors: ConsoleIssue[],
  networkErrors: NetworkIssue[]
): Promise<{ action: InteractiveActionRecord; screenMap: ScreenMap }> {
  const actionId = `a${String(sequence).padStart(3, "0")}`;
  const target = planned.target;
  const beforeScreenshot = path.join(actionsDir, `${actionId}-before.png`);
  const afterScreenshot = path.join(actionsDir, `${actionId}-after.png`);
  const visualDiff = path.join(actionsDir, `${actionId}-diff.png`);
  const screenMapPath = path.join(actionsDir, `${actionId}-screen-map.json`);

  await page.screenshot({ path: beforeScreenshot, fullPage: false });
  await page.screenshot({ path: afterScreenshot, fullPage: false });
  await writeVisualDiffScreenshot(page, beforeScreenshot, afterScreenshot, visualDiff);
  const screenMap = await captureActionScreenMap(page, screenMapPath, consoleErrors, networkErrors);

  return {
    action: {
      id: actionId,
      sequence,
      actionType: "hover",
      target,
      beforeScreenshot,
      afterScreenshot,
      visualDiff,
      screenMap: screenMapPath,
      clicked: false,
      focused: false,
      clickSkippedReason: reason,
      clickDecision: "skipped",
      clickDecisionReason: reason,
      plannedReason: planned.plannedReason,
      targetCategory: planned.targetCategory,
      riskLevel: planned.riskLevel,
      planDepth: planned.depth,
      planPriority: planned.priority,
      plannedSafeClick: planned.plannedSafeClick,
      skipped: true,
      skipReason: reason,
      urlBefore,
      urlAfter: page.url(),
      consoleErrorCount: screenMap.consoleErrors.length,
      networkErrorCount: screenMap.networkErrors.length,
      findingDetectors: []
    },
    screenMap
  };
}

function resolveClickDecision(
  target: InteractiveTarget,
  capabilities: InteractiveCapabilities,
  planned: PlannedInteractiveAction,
  blockage?: ClickBlockage
): { decision: "allowed" | "skipped"; reason: string } {
  if (!target.safeToClick) {
    return { decision: "skipped", reason: target.skipClickReason ?? "target is not safe to click" };
  }
  if (!capabilities.safe_click) {
    return { decision: "skipped", reason: "safe_click capability disabled" };
  }
  if (blockage) {
    return { decision: "skipped", reason: "blocked by overlay" };
  }
  if (!planned.plannedSafeClick) {
    return { decision: "skipped", reason: planned.plannedClickSkipReason ?? "planner did not allocate a safe click" };
  }
  return { decision: "allowed", reason: "safe_click capability enabled and target passed safe-click filtering" };
}

async function performTargetAction(
  page: Page,
  planned: PlannedInteractiveAction,
  sequence: number,
  actionsDir: string,
  pointerStart: PointerPoint,
  config: InteractiveConfig,
  scenario: Scenario | undefined,
  consoleErrors: ConsoleIssue[],
  networkErrors: NetworkIssue[]
): Promise<ActionExecutionResult> {
  const actionId = `a${String(sequence).padStart(3, "0")}`;
  const beforeScreenshot = path.join(actionsDir, `${actionId}-before.png`);
  const afterScreenshot = path.join(actionsDir, `${actionId}-after.png`);
  const visualDiff = path.join(actionsDir, `${actionId}-diff.png`);
  const screenMapPath = path.join(actionsDir, `${actionId}-screen-map.json`);
  const target = planned.target;
  const locator = page.locator(`[data-ux-sentinel-target-id="${target.id}"]`).first();
  const findings: Finding[] = [];
  let clicked = false;
  let focused = false;
  let clickSkippedReason = target.skipClickReason;
  let pointerTracePath: string | undefined;
  let animationTracePath: string | undefined;
  let pointerEnd: PointerPoint | undefined;
  let focusEvidence: FocusEvidence | undefined;
  const urlBefore = page.url();

  await locator.scrollIntoViewIfNeeded({ timeout: 1_000 }).catch(() => undefined);
  const live = await resolveLiveTarget(page, target);
  if (live.status !== "ok") {
    const skipped = await skippedAction(page, planned, sequence, actionsDir, live.reason, urlBefore, consoleErrors, networkErrors);
    return {
      ...skipped,
      findings
    };
  }
  const liveTarget = live.target;

  await page.screenshot({ path: beforeScreenshot, fullPage: false });

  const blockage = await collectClickBlockage(page, liveTarget);
  if (blockage) {
    findings.push(buildBlockedClickFinding(liveTarget, blockage, actionId));
  }
  const livePlanned = { ...planned, target: liveTarget };
  let clickDecision = resolveClickDecision(liveTarget, config.capabilityPolicy.capabilities, livePlanned, blockage);

  const pointerTrace = await recordPointerTrace(page, liveTarget, actionId, actionsDir, {
    from: pointerStart,
    movementDurationMs: Math.min(240, Math.max(0, config.settleMs)),
    hoverDurationMs: config.settleMs
  });
  pointerTracePath = pointerTrace.path;
  pointerEnd = pointerTrace.trace.to;
  findings.push(...buildPointerTraceFindings(pointerTrace.trace, pointerTrace.path, liveTarget, actionId));

  if (clickDecision.decision === "allowed" && !pointerTrace.trace.finalHitTestMatchedTarget) {
    clickDecision = {
      decision: "skipped",
      reason: "cursor target drift"
    };
    clickSkippedReason = clickDecision.reason;
  }

  if (config.focusAllKeyboardTargets && liveTarget.focusable) {
    await locator.focus({ timeout: 500 }).then(() => {
      focused = true;
    }).catch(() => undefined);
    await page.waitForTimeout(config.settleMs);
    if (focused) {
      focusEvidence = await collectFocusEvidence(page, liveTarget);
      findings.push(...buildFocusFindings(focusEvidence, liveTarget, actionId));
    }
  }

  if (clickDecision.decision === "allowed") {
    const clickPoint = pointerEnd ?? liveTarget.center;
    await page.mouse.click(clickPoint.x, clickPoint.y).then(() => {
      clicked = true;
    }).catch((error: unknown) => {
      clickSkippedReason = error instanceof Error ? error.message : String(error);
    });
    await page.waitForLoadState("networkidle", { timeout: Math.max(500, config.settleMs * 2) }).catch(() => undefined);
    await page.waitForTimeout(config.settleMs);
  } else {
    clickSkippedReason = clickDecision.reason;
  }

  const animationTrace = await recordAnimationTrace(page, liveTarget, actionId, actionsDir, config.animationAudit, liveTarget.bbox);
  if (animationTrace) {
    animationTracePath = animationTrace.path;
    findings.push(...buildAnimationFindings(animationTrace.trace, animationTrace.path, liveTarget, actionId, config));
  }

  await page.screenshot({ path: afterScreenshot, fullPage: false });
  await writeVisualDiffScreenshot(page, beforeScreenshot, afterScreenshot, visualDiff);

  const screenMap = await captureActionScreenMap(page, screenMapPath, consoleErrors, networkErrors);
  const visualFindings = detectVisualAnomalies(await collectVisualAnalysis(page, scenario), scenario, actionId);
  findings.push(...visualFindings);

  const action: InteractiveActionRecord = {
    id: actionId,
    sequence,
    actionType: clicked ? "hover_click" : focused ? "focus" : "hover",
    target: liveTarget,
    beforeScreenshot,
    afterScreenshot,
    visualDiff,
    screenMap: screenMapPath,
    pointerTrace: pointerTracePath,
    animationTrace: animationTracePath,
    focusEvidence,
    clicked,
    focused,
    clickBlockage: blockage,
    clickSkippedReason,
    clickDecision: clickDecision.decision,
    clickDecisionReason: clickDecision.reason,
    plannedReason: planned.plannedReason,
    targetCategory: planned.targetCategory,
    riskLevel: planned.riskLevel,
    planDepth: planned.depth,
    planPriority: planned.priority,
    plannedSafeClick: planned.plannedSafeClick,
    urlBefore,
    urlAfter: page.url(),
    consoleErrorCount: screenMap.consoleErrors.length,
    networkErrorCount: screenMap.networkErrors.length,
    findingDetectors: findings.map((item) => item.detector)
  };

  return { action, findings, screenMap, pointerEnd };
}

async function collectScrollableTargets(page: Page, avoidClickText: string[]): Promise<InteractiveTarget[]> {
  const targets = await page.evaluate((avoidText) => {
    const normalize = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
    const dangerous = (label: string) => {
      const normalized = normalize(label).toLowerCase();
      return Boolean(normalized) && avoidText.some((item) => normalized.includes(normalize(item).toLowerCase()));
    };

    return Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element, index) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const scrollable =
          (element.scrollHeight > element.clientHeight + 24 && ["auto", "scroll"].includes(style.overflowY)) ||
          (element.scrollWidth > element.clientWidth + 24 && ["auto", "scroll"].includes(style.overflowX));
        const label = normalize(element.innerText || element.textContent || element.getAttribute("aria-label") || "");
        const id = element.getAttribute("data-ux-sentinel-target-id") ?? `s${String(index + 1).padStart(3, "0")}`;
        if (scrollable && !element.hasAttribute("data-ux-sentinel-target-id")) {
          element.setAttribute("data-ux-sentinel-target-id", id);
        }
        return {
          id,
          tag: element.tagName.toLowerCase(),
          role: element.getAttribute("role"),
          dataUxRole: element.getAttribute("data-ux-role"),
          visibleText: label.slice(0, 240),
          ariaLabel: element.getAttribute("aria-label"),
          title: element.getAttribute("title"),
          bbox: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          center: {
            x: Math.round(rect.x + rect.width / 2),
            y: Math.round(rect.y + rect.height / 2)
          },
          disabled: false,
          focusable: false,
          href: null,
          safeToClick: false,
          skipClickReason: dangerous(label) ? "dangerous label" : "scroll only",
          scrollable,
          visible:
            scrollable &&
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > 0 &&
            rect.right > 0 &&
            rect.top < window.innerHeight &&
            rect.left < window.innerWidth
        };
      })
      .filter((item) => item.visible)
      .map(({ visible, scrollable, ...target }) => target);
  }, avoidClickText);

  return targets;
}

async function performScrollAction(
  page: Page,
  planned: PlannedInteractiveAction,
  sequence: number,
  actionsDir: string,
  config: InteractiveConfig,
  scenario: Scenario | undefined,
  consoleErrors: ConsoleIssue[],
  networkErrors: NetworkIssue[]
): Promise<ActionExecutionResult> {
  const actionId = `a${String(sequence).padStart(3, "0")}`;
  const beforeScreenshot = path.join(actionsDir, `${actionId}-before.png`);
  const afterScreenshot = path.join(actionsDir, `${actionId}-after.png`);
  const visualDiff = path.join(actionsDir, `${actionId}-diff.png`);
  const screenMapPath = path.join(actionsDir, `${actionId}-screen-map.json`);
  const urlBefore = page.url();
  const target = planned.target;

  await page.locator(`[data-ux-sentinel-target-id="${target.id}"]`).first().scrollIntoViewIfNeeded({ timeout: 1_000 }).catch(() => undefined);
  const live = await resolveLiveTarget(page, target);
  if (live.status !== "ok") {
    const skipped = await skippedAction(page, planned, sequence, actionsDir, live.reason, urlBefore, consoleErrors, networkErrors);
    return {
      ...skipped,
      findings: []
    };
  }
  const liveTarget = live.target;
  await page.screenshot({ path: beforeScreenshot, fullPage: false });
  await page.evaluate((targetId) => {
    const element = document.querySelector<HTMLElement>(`[data-ux-sentinel-target-id="${targetId}"]`);
    if (element) {
      element.scrollBy({ top: Math.max(80, element.clientHeight * 0.65), left: 0, behavior: "auto" });
    }
  }, liveTarget.id);
  await page.waitForTimeout(config.settleMs);
  await page.screenshot({ path: afterScreenshot, fullPage: false });
  await writeVisualDiffScreenshot(page, beforeScreenshot, afterScreenshot, visualDiff);
  const screenMap = await captureActionScreenMap(page, screenMapPath, consoleErrors, networkErrors);
  const findings = detectVisualAnomalies(await collectVisualAnalysis(page, scenario), scenario, actionId);

  return {
    action: {
      id: actionId,
      sequence,
      actionType: "scroll",
      target: liveTarget,
      beforeScreenshot,
      afterScreenshot,
      visualDiff,
      screenMap: screenMapPath,
      clicked: false,
      focused: false,
      clickSkippedReason: "scroll only",
      clickDecision: "not_applicable",
      clickDecisionReason: "scroll action does not perform safe clicks",
      plannedReason: planned.plannedReason,
      targetCategory: planned.targetCategory,
      riskLevel: planned.riskLevel,
      planDepth: planned.depth,
      planPriority: planned.priority,
      plannedSafeClick: false,
      urlBefore,
      urlAfter: page.url(),
      consoleErrorCount: screenMap.consoleErrors.length,
      networkErrorCount: screenMap.networkErrors.length,
      findingDetectors: findings.map((item) => item.detector)
    },
    findings,
    screenMap
  };
}

export async function interactiveExplorePage(options: InteractiveExploreOptions): Promise<InteractiveExplorationResult> {
  const config = resolveInteractiveConfig(options.scenario, options);
  const runId = timestamp();
  const traceDir = path.resolve(options.traceRoot ?? path.join(process.cwd(), ".ux-sentinel", "traces"), runId);
  const actionsDir = path.join(traceDir, "actions");
  await ensureDir(actionsDir);

  const baseline = path.join(traceDir, "baseline.png");
  const screenMapPath = path.join(traceDir, "screen-map.json");
  const overlayPath = path.join(traceDir, "screen-map.html");
  const accessibilityPath = path.join(traceDir, "accessibility.json");
  const stateGraphPath = path.join(traceDir, "state-graph.json");
  const actionTracePath = path.join(traceDir, "action-trace.json");
  const anomaliesPath = path.join(traceDir, "anomalies.json");
  const contactSheetPath = path.join(traceDir, "contact-sheet.html");
  const consoleErrors: ConsoleIssue[] = [];
  const networkErrors: NetworkIssue[] = [];
  const actions: InteractiveActionRecord[] = [];
  const findings: Finding[] = [];
  const stateNodes: StateGraphNode[] = [];
  const stateEdges: StateGraphEdge[] = [];
  const notes = [...config.notes];
  let currentPointer: PointerPoint = { x: 40, y: 40 };

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(consoleIssue(message));
      }
    });

    page.on("response", (response) => {
      if (response.status() >= 400) {
        networkErrors.push(networkIssue(response));
      }
    });

    await page.goto(options.url, { waitUntil: "networkidle", timeout: 20_000 });
    await page.screenshot({ path: baseline, fullPage: false });

    const accessibilitySnapshot = await safeAccessibilitySnapshot(page);
    await writeJson(accessibilityPath, accessibilitySnapshot);

    const screenMap = await collectScreenMap(page, page.url(), consoleErrors, networkErrors);
    await writeJson(screenMapPath, screenMap);
    await writeText(overlayPath, buildScreenMapOverlay(screenMap, baseline));
    let currentState = await collectStateSnapshot(page, {
      id: "s000",
      screenshot: baseline,
      screenMap,
      screenMapPath,
      accessibilitySnapshot,
      accessibilityPath
    });
    stateNodes.push(currentState.node);

    findings.push(...detectVisualAnomalies(await collectVisualAnalysis(page, options.scenario), options.scenario, "baseline"));

    const targets = config.hoverAllClickables ? await collectVisibleInteractiveTargets(page, config.avoidClickText) : [];
    const scrollTargets = config.scrollContainers ? await collectScrollableTargets(page, config.avoidClickText) : [];
    const plannedActions = planInteractiveActions({
      targets,
      scrollTargets,
      scenario: options.scenario,
      config: {
        mode: config.mode,
        maxActions: config.maxActions,
        maxDepth: config.maxDepth,
        maxClicks: config.maxClicks,
        maxStateChanges: config.maxStateChanges,
        safeClickEnabled: config.capabilityPolicy.capabilities.safe_click
      }
    });
    let sequence = 1;
    let stateSequence = 1;
    for (const plannedAction of plannedActions) {
      const result =
        plannedAction.kind === "scroll"
          ? await performScrollAction(page, plannedAction, sequence, actionsDir, config, options.scenario, consoleErrors, networkErrors)
          : await performTargetAction(
              page,
              plannedAction,
              sequence,
              actionsDir,
              currentPointer,
              config,
              options.scenario,
              consoleErrors,
              networkErrors
            );
      if (result.pointerEnd) {
        currentPointer = result.pointerEnd;
      }
      const evidence = await recordActionStateEvidence({
        page,
        action: result.action,
        screenMap: result.screenMap,
        beforeState: currentState,
        stateSequence,
        actionsDir,
        detectNoFeedback: config.mode === "agentic"
      });
      currentState = evidence.nextState;
      stateNodes.push(evidence.nextState.node);
      stateEdges.push(evidence.edge);
      stateSequence += 1;
      actions.push(result.action);
      findings.push(...result.findings);
      findings.push(...evidence.findings);
      sequence += 1;
      if (
        result.action.urlBefore &&
        result.action.urlAfter &&
        result.action.urlBefore !== result.action.urlAfter &&
        !config.allowNavigation
      ) {
        notes.push(
          `Navigation changed URL from ${result.action.urlBefore} to ${result.action.urlAfter} after ${result.action.id}; stopped remaining planned actions.`
        );
        break;
      }
    }

    const numberedFindings = renumberInteractiveFindings(findings);
    const summary = {
      actionCount: actions.length,
      screenshotCount: 1 + actions.length * 3,
      anomalyCount: numberedFindings.length,
      notes
    };
    const result: InteractiveExplorationResult = {
      screenMap,
      accessibilitySnapshot,
      actions,
      findings: numberedFindings,
      artifacts: {
        traceDir,
        baseline,
        screenMap: screenMapPath,
        overlay: overlayPath,
        accessibility: accessibilityPath,
        actionsDir,
        actionTrace: actionTracePath,
        stateGraph: stateGraphPath,
        anomalies: anomaliesPath,
        contactSheet: contactSheetPath
      },
      summary
    };

    await writeJson(actionTracePath, {
      summary,
      capabilityPolicy: config.capabilityPolicy,
      planner: {
        mode: config.mode,
        maxActions: config.maxActions,
        maxDepth: config.maxDepth,
        maxClicks: config.maxClicks,
        maxStateChanges: config.maxStateChanges,
        plannedActionCount: plannedActions.length
      },
      actions
    });
    await writeJson(stateGraphPath, buildStateGraph(stateNodes, stateEdges));
    await writeJson(anomaliesPath, numberedFindings);
    await writeText(contactSheetPath, buildContactSheetHtml(result));

    return result;
  } finally {
    await browser.close();
  }
}

export function formatInteractiveSummary(result: InteractiveExplorationResult): string {
  return [
    `Trace: ${displayPath(result.artifacts.traceDir)}`,
    `Actions: ${result.summary.actionCount}`,
    `Screenshots: ${result.summary.screenshotCount}`,
    `Anomalies: ${result.summary.anomalyCount}`,
    `Notes: ${result.summary.notes.length ? result.summary.notes.join(" | ") : "none"}`,
    `Action trace: ${displayPath(result.artifacts.actionTrace)}`,
    `State graph: ${displayPath(result.artifacts.stateGraph)}`,
    `Anomalies: ${displayPath(result.artifacts.anomalies)}`,
    `Contact sheet: ${displayPath(result.artifacts.contactSheet)}`
  ].join("\n");
}
