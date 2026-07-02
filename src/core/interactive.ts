import path from "node:path";
import { chromium, type ConsoleMessage, type Page, type Response } from "playwright";
import { buildScreenMapOverlay } from "./overlay.js";
import { collectScreenMap, safeAccessibilitySnapshot } from "./observe-page.js";
import { defaultPreferredLabels } from "./scenario.js";
import { displayPath, ensureDir, timestamp, writeJson, writeText } from "./files.js";
import type {
  ClickBlockage,
  ConsoleIssue,
  ElementBox,
  Finding,
  InteractiveActionRecord,
  InteractiveExplorationResult,
  InteractiveTarget,
  NetworkIssue,
  Scenario,
  Severity
} from "./types.js";

export interface InteractiveExploreOptions {
  url: string;
  scenario?: Scenario;
  traceRoot?: string;
  maxActions?: number;
  settleMs?: number;
  commandMode?: "explore" | "run";
  clickSafeOverride?: boolean;
}

export interface InteractiveConfig {
  maxActions: number;
  hoverAllClickables: boolean;
  clickAllSafeControls: boolean;
  focusAllKeyboardTargets: boolean;
  scrollContainers: boolean;
  screenshotBeforeAfterEachAction: boolean;
  settleMs: number;
  avoidClickText: string[];
  allowNavigation: boolean;
  notes: string[];
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
  "??젣",
  "?쒓굅",
  "寃곗젣",
  "濡쒓렇?꾩썐"
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
  const maxActions = options?.maxActions ?? source?.max_actions ?? 40;
  const settleMs = options?.settleMs ?? source?.settle_ms ?? 350;
  const notes: string[] = [];
  if (source?.screenshot_before_after_each_action === false) {
    notes.push("Interactive audit always captures before/after screenshots so the contact sheet remains evidence-backed.");
  }
  const commandMode = options?.commandMode ?? (scenario ? "run" : "explore");
  const clickAllSafeControls =
    options?.clickSafeOverride ??
    (commandMode === "explore" ? false : source?.click_all_safe_controls === true);

  return {
    maxActions: Math.max(1, Math.min(250, Math.floor(maxActions))),
    hoverAllClickables: source?.hover_all_clickables ?? true,
    clickAllSafeControls,
    focusAllKeyboardTargets: source?.focus_all_keyboard_targets ?? true,
    scrollContainers: source?.scroll_containers ?? true,
    screenshotBeforeAfterEachAction: true,
    settleMs: Math.max(0, Math.min(5_000, Math.floor(settleMs))),
    avoidClickText: [...defaultAvoidClickText, ...(source?.avoid_click_text ?? [])],
    allowNavigation: source?.allow_navigation ?? false,
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
          const visibleText = normalize(element.innerText || element.textContent || "");
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
            tag === "input" ||
            tag === "select" ||
            tag === "textarea" ||
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
                : !clickEligible
                  ? "not a click control"
                  : insideForm
                    ? "inside form"
                    : unsafeInput
                      ? "unsafe input type"
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

function renumberInteractiveFindings(findings: Finding[]): Finding[] {
  return findings.map((item, index) => ({
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

export function buildContactSheetHtml(result: Pick<InteractiveExplorationResult, "actions" | "findings" | "summary" | "artifacts">): string {
  const rows = result.actions
    .map((action) => {
      const before = path.relative(result.artifacts.traceDir, action.beforeScreenshot).replace(/\\/g, "/");
      const after = path.relative(result.artifacts.traceDir, action.afterScreenshot).replace(/\\/g, "/");
      const findings = action.findingDetectors.length ? action.findingDetectors.join(", ") : "none";
      const status = action.skipped ? `skipped: ${action.skipReason ?? "unknown reason"}` : action.clicked ? "clicked" : "not clicked";
      return `<article>
  <h2>${escapeHtml(action.id)} - ${escapeHtml(action.actionType)} - ${escapeHtml(status)}</h2>
  <p><strong>Target:</strong> ${escapeHtml(action.target.role ?? action.target.tag)} ${escapeHtml(targetLabel(action.target))}</p>
  <p><strong>BBox:</strong> ${action.target.bbox.x}, ${action.target.bbox.y}, ${action.target.bbox.width}x${action.target.bbox.height}</p>
  <p><strong>URL:</strong> ${escapeHtml(action.urlBefore ?? "")}${action.urlAfter && action.urlAfter !== action.urlBefore ? ` -> ${escapeHtml(action.urlAfter)}` : ""}</p>
  <p><strong>Findings:</strong> ${escapeHtml(findings)}</p>
  <div class="shots">
    <figure><img src="${escapeHtml(before)}" alt="${escapeHtml(action.id)} before" /><figcaption>before</figcaption></figure>
    <figure><img src="${escapeHtml(after)}" alt="${escapeHtml(action.id)} after" /><figcaption>after</figcaption></figure>
  </div>
</article>`;
    })
    .join("\n");

  const findingList = result.findings.length
    ? result.findings.map((findingItem) => `<li><strong>${escapeHtml(findingItem.detector)}</strong>: ${escapeHtml(findingItem.title)}</li>`).join("\n")
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
    article { border: 1px solid #d1d5db; border-radius: 6px; background: #ffffff; padding: 14px; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    h2 { margin: 0 0 8px; font-size: 16px; }
    p { margin: 4px 0; font-size: 13px; color: #374151; }
    ul { margin: 8px 0 0; }
    .shots { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
    figure { margin: 0; }
    img { max-width: 100%; border: 1px solid #d1d5db; background: #111827; }
    figcaption { font-size: 12px; color: #4b5563; margin-top: 4px; }
  </style>
</head>
<body>
  <header>
    <h1>ux-sentinel interactive contact sheet</h1>
    <p>Actions: ${result.summary.actionCount} - screenshots: ${result.summary.screenshotCount} - anomalies: ${result.summary.anomalyCount}</p>
    ${notes}
    <ul>${findingList}</ul>
  </header>
  <main>
    ${rows || "<p>No actions were captured.</p>"}
  </main>
</body>
</html>
`;
}

async function captureActionScreenMap(page: Page, filePath: string, consoleErrors: ConsoleIssue[], networkErrors: NetworkIssue[]) {
  const screenMap = await collectScreenMap(page, page.url(), consoleErrors, networkErrors);
  await writeJson(filePath, screenMap);
  return screenMap;
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
  target: InteractiveTarget,
  sequence: number,
  actionsDir: string,
  reason: string,
  urlBefore: string,
  consoleErrors: ConsoleIssue[],
  networkErrors: NetworkIssue[]
): Promise<InteractiveActionRecord> {
  const actionId = `a${String(sequence).padStart(3, "0")}`;
  const beforeScreenshot = path.join(actionsDir, `${actionId}-before.png`);
  const afterScreenshot = path.join(actionsDir, `${actionId}-after.png`);
  const screenMapPath = path.join(actionsDir, `${actionId}-screen-map.json`);

  await page.screenshot({ path: beforeScreenshot, fullPage: false });
  await page.screenshot({ path: afterScreenshot, fullPage: false });
  const screenMap = await captureActionScreenMap(page, screenMapPath, consoleErrors, networkErrors);

  return {
    id: actionId,
    sequence,
    actionType: "hover",
    target,
    beforeScreenshot,
    afterScreenshot,
    screenMap: screenMapPath,
    clicked: false,
    focused: false,
    clickSkippedReason: reason,
    skipped: true,
    skipReason: reason,
    urlBefore,
    urlAfter: page.url(),
    consoleErrorCount: screenMap.consoleErrors.length,
    networkErrorCount: screenMap.networkErrors.length,
    findingDetectors: []
  };
}

async function performTargetAction(
  page: Page,
  target: InteractiveTarget,
  sequence: number,
  actionsDir: string,
  config: InteractiveConfig,
  scenario: Scenario | undefined,
  consoleErrors: ConsoleIssue[],
  networkErrors: NetworkIssue[]
): Promise<{ action: InteractiveActionRecord; findings: Finding[] }> {
  const actionId = `a${String(sequence).padStart(3, "0")}`;
  const beforeScreenshot = path.join(actionsDir, `${actionId}-before.png`);
  const afterScreenshot = path.join(actionsDir, `${actionId}-after.png`);
  const screenMapPath = path.join(actionsDir, `${actionId}-screen-map.json`);
  const locator = page.locator(`[data-ux-sentinel-target-id="${target.id}"]`).first();
  const findings: Finding[] = [];
  let clicked = false;
  let focused = false;
  let clickSkippedReason = target.skipClickReason;
  const urlBefore = page.url();

  await locator.scrollIntoViewIfNeeded({ timeout: 1_000 }).catch(() => undefined);
  const live = await resolveLiveTarget(page, target);
  if (live.status !== "ok") {
    return {
      action: await skippedAction(page, target, sequence, actionsDir, live.reason, urlBefore, consoleErrors, networkErrors),
      findings
    };
  }
  const liveTarget = live.target;

  await page.screenshot({ path: beforeScreenshot, fullPage: false });

  const blockage = await collectClickBlockage(page, liveTarget);
  if (blockage) {
    findings.push(buildBlockedClickFinding(liveTarget, blockage, actionId));
  }

  await page.mouse.move(liveTarget.center.x, liveTarget.center.y);
  await page.waitForTimeout(config.settleMs);

  if (config.focusAllKeyboardTargets && liveTarget.focusable) {
    await locator.focus({ timeout: 500 }).then(() => {
      focused = true;
    }).catch(() => undefined);
    await page.waitForTimeout(config.settleMs);
  }

  if (config.clickAllSafeControls && liveTarget.safeToClick && !blockage) {
    await page.mouse.click(liveTarget.center.x, liveTarget.center.y).then(() => {
      clicked = true;
    }).catch((error: unknown) => {
      clickSkippedReason = error instanceof Error ? error.message : String(error);
    });
    await page.waitForLoadState("networkidle", { timeout: Math.max(500, config.settleMs * 2) }).catch(() => undefined);
    await page.waitForTimeout(config.settleMs);
  } else if (blockage) {
    clickSkippedReason = "blocked by overlay";
  } else if (!config.clickAllSafeControls && liveTarget.safeToClick) {
    clickSkippedReason = "safe clicks disabled";
  }

  await page.screenshot({ path: afterScreenshot, fullPage: false });

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
    screenMap: screenMapPath,
    clicked,
    focused,
    clickBlockage: blockage,
    clickSkippedReason,
    urlBefore,
    urlAfter: page.url(),
    consoleErrorCount: screenMap.consoleErrors.length,
    networkErrorCount: screenMap.networkErrors.length,
    findingDetectors: findings.map((item) => item.detector)
  };

  return { action, findings };
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
        const id = `s${String(index + 1).padStart(3, "0")}`;
        if (scrollable) {
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
  target: InteractiveTarget,
  sequence: number,
  actionsDir: string,
  config: InteractiveConfig,
  scenario: Scenario | undefined,
  consoleErrors: ConsoleIssue[],
  networkErrors: NetworkIssue[]
): Promise<{ action: InteractiveActionRecord; findings: Finding[] }> {
  const actionId = `a${String(sequence).padStart(3, "0")}`;
  const beforeScreenshot = path.join(actionsDir, `${actionId}-before.png`);
  const afterScreenshot = path.join(actionsDir, `${actionId}-after.png`);
  const screenMapPath = path.join(actionsDir, `${actionId}-screen-map.json`);
  const urlBefore = page.url();

  await page.locator(`[data-ux-sentinel-target-id="${target.id}"]`).first().scrollIntoViewIfNeeded({ timeout: 1_000 }).catch(() => undefined);
  const live = await resolveLiveTarget(page, target);
  if (live.status !== "ok") {
    return {
      action: await skippedAction(page, target, sequence, actionsDir, live.reason, urlBefore, consoleErrors, networkErrors),
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
      screenMap: screenMapPath,
      clicked: false,
      focused: false,
      clickSkippedReason: "scroll only",
      urlBefore,
      urlAfter: page.url(),
      consoleErrorCount: screenMap.consoleErrors.length,
      networkErrorCount: screenMap.networkErrors.length,
      findingDetectors: findings.map((item) => item.detector)
    },
    findings
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
  const actionTracePath = path.join(traceDir, "action-trace.json");
  const anomaliesPath = path.join(traceDir, "anomalies.json");
  const contactSheetPath = path.join(traceDir, "contact-sheet.html");
  const consoleErrors: ConsoleIssue[] = [];
  const networkErrors: NetworkIssue[] = [];
  const actions: InteractiveActionRecord[] = [];
  const findings: Finding[] = [];
  const notes = [...config.notes];

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

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

    findings.push(...detectVisualAnomalies(await collectVisualAnalysis(page, options.scenario), options.scenario, "baseline"));

    const targets = config.hoverAllClickables ? await collectVisibleInteractiveTargets(page, config.avoidClickText) : [];
    let sequence = 1;
    let stoppedForNavigation = false;
    for (const target of targets.slice(0, config.maxActions)) {
      const result = await performTargetAction(page, target, sequence, actionsDir, config, options.scenario, consoleErrors, networkErrors);
      actions.push(result.action);
      findings.push(...result.findings);
      sequence += 1;
      if (
        result.action.urlBefore &&
        result.action.urlAfter &&
        result.action.urlBefore !== result.action.urlAfter &&
        !config.allowNavigation
      ) {
        stoppedForNavigation = true;
        notes.push(
          `Navigation changed URL from ${result.action.urlBefore} to ${result.action.urlAfter} after ${result.action.id}; stopped remaining baseline-collected targets.`
        );
        break;
      }
    }

    if (config.scrollContainers && !stoppedForNavigation && sequence <= config.maxActions) {
      const scrollTargets = await collectScrollableTargets(page, config.avoidClickText);
      for (const target of scrollTargets.slice(0, config.maxActions - sequence + 1)) {
        const result = await performScrollAction(page, target, sequence, actionsDir, config, options.scenario, consoleErrors, networkErrors);
        actions.push(result.action);
        findings.push(...result.findings);
        sequence += 1;
        if (
          result.action.urlBefore &&
          result.action.urlAfter &&
          result.action.urlBefore !== result.action.urlAfter &&
          !config.allowNavigation
        ) {
          notes.push(
            `Navigation changed URL from ${result.action.urlBefore} to ${result.action.urlAfter} after ${result.action.id}; stopped remaining scroll targets.`
          );
          break;
        }
      }
    }

    const numberedFindings = renumberInteractiveFindings(findings);
    const summary = {
      actionCount: actions.length,
      screenshotCount: 1 + actions.length * 2,
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
        anomalies: anomaliesPath,
        contactSheet: contactSheetPath
      },
      summary
    };

    await writeJson(actionTracePath, { summary, actions });
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
    `Anomalies: ${displayPath(result.artifacts.anomalies)}`,
    `Contact sheet: ${displayPath(result.artifacts.contactSheet)}`
  ].join("\n");
}
