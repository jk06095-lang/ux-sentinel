export type Severity = "P0" | "P1" | "P2" | "P3";
export type Verdict = "pass" | "fail" | "ambiguous";
export type InteractiveCommandMode = "explore" | "run";
export type InteractiveCapability =
  | "observe"
  | "hover"
  | "focus"
  | "scroll"
  | "safe_click"
  | "navigation"
  | "typing"
  | "form_submit"
  | "destructive_action";
export type InteractiveCapabilities = Record<InteractiveCapability, boolean>;
export type ClickDecision = "allowed" | "skipped" | "not_applicable";
export type InteractiveTargetCategory =
  | "primary_cta"
  | "secondary_cta"
  | "navigation"
  | "tab"
  | "menu"
  | "dropdown"
  | "dialog_trigger"
  | "tooltip_help_trigger"
  | "card"
  | "expandable_section"
  | "graph_dag_node"
  | "graph_dag_control"
  | "form_adjacent_control"
  | "scroll_container"
  | "ambiguous_clickable";
export type InteractiveRiskLevel = "low" | "medium" | "high";

export interface InteractiveCapabilityPolicy {
  commandMode: InteractiveCommandMode;
  capabilities: InteractiveCapabilities;
  reasons: Record<InteractiveCapability, string>;
  enabled: InteractiveCapability[];
  disabled: InteractiveCapability[];
}

export interface Scenario {
  id: string;
  title: string;
  persona: string;
  mode?: "visual_contract" | string;
  start_path?: string;
  goal?: {
    user_wants?: string;
    primary_intent?: string;
  };
  visual_contract?: {
    page_must_answer?: string[];
    primary_cta?: {
      preferred_labels?: string[];
      avoid_icon_only?: boolean;
      must_be_visible_above_fold?: boolean;
      must_look_clickable?: boolean;
    };
    empty_state?: {
      if_detected_requires_primary_cta?: boolean;
    };
  };
  interactive_exploration?: {
    enabled?: boolean;
    mode?: "linear" | "agentic" | string;
    max_actions?: number;
    max_depth?: number;
    max_clicks?: number;
    max_state_changes?: number;
    hover_all_clickables?: boolean;
    click_all_safe_controls?: boolean;
    focus_all_keyboard_targets?: boolean;
    scroll_containers?: boolean;
    screenshot_before_after_each_action?: boolean;
    settle_ms?: number;
    avoid_click_text?: string[];
    allow_navigation?: boolean;
  };
  visual_anomaly_contract?: {
    no_text_occlusion?: boolean;
    no_click_target_blocking?: boolean;
    no_floating_panel_covering_primary_action?: boolean;
    no_svg_edge_label_overlap?: boolean;
    no_card_overlap?: boolean;
    no_important_text_truncation?: boolean;
    graph_dag?: {
      enabled?: boolean;
      columns_must_have_labels?: boolean;
      selected_path_must_be_traceable?: boolean;
      edge_labels_must_not_cross_nodes?: boolean;
      max_unused_canvas_ratio?: number;
    };
  };
  fail_conditions?: string[];
  fail_conditions_explicit?: boolean;
}

export interface ElementBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenElement {
  id: string;
  tag: string;
  role: string | null;
  visibleText: string;
  ariaLabel: string | null;
  title: string | null;
  bbox: ElementBox;
  clickable: boolean;
  disabled: boolean;
  aboveFold: boolean;
  visible: boolean;
  looksClickable: boolean;
  hasVisibleLabel: boolean;
  isIconOnly: boolean;
  textTruncated: boolean;
  visualWeight: number;
}

export interface ConsoleIssue {
  type: string;
  text: string;
  location?: {
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
}

export interface NetworkIssue {
  url: string;
  status: number;
  statusText: string;
  method: string;
}

export interface ScreenMap {
  url: string;
  title?: string;
  timestamp: string;
  viewport: {
    width: number;
    height: number;
  };
  document: {
    width: number;
    height: number;
    hasHorizontalScroll: boolean;
  };
  visibleText: string[];
  elements: ScreenElement[];
  consoleErrors: ConsoleIssue[];
  networkErrors: NetworkIssue[];
  risks: Array<{
    detector: string;
    severity: Severity;
    message: string;
  }>;
}

export interface EvidencePaths {
  traceDir: string;
  screenshot: string;
  screenMap: string;
  overlay: string;
  observerReport?: string;
  accessibility?: string;
}

export interface ObservationResult {
  screenMap: ScreenMap;
  accessibilitySnapshot: unknown;
  artifacts: EvidencePaths;
  interactive?: InteractiveExplorationResult;
}

export interface Finding {
  id: string;
  detector: string;
  title: string;
  severity: Severity;
  type: "Perception Mismatch" | "Functional Issue";
  evidence: string;
  userImpact: string;
  suggestedFix: string;
  regressionCheck: string;
}

export interface RunResult {
  scenario: Scenario;
  url: string;
  verdict: Verdict;
  findings: Finding[];
  observation: ObservationResult;
  reportPath: string;
}

export interface InteractiveTarget {
  id: string;
  tag: string;
  role: string | null;
  dataUxRole: string | null;
  dataUxAction?: string | null;
  dataUxClickable?: boolean;
  visibleText: string;
  ariaLabel: string | null;
  title: string | null;
  bbox: ElementBox;
  center: {
    x: number;
    y: number;
  };
  disabled: boolean;
  focusable: boolean;
  href: string | null;
  safeToClick: boolean;
  skipClickReason?: string;
}

export interface ClickBlockage {
  blocked: boolean;
  samplePoint: {
    x: number;
    y: number;
  };
  blocker?: {
    tag: string;
    role: string | null;
    text: string;
    ariaLabel: string | null;
    bbox: ElementBox;
  };
}

export interface PointerPoint {
  x: number;
  y: number;
}

export interface PointerTracePoint extends PointerPoint {
  t: number;
}

export interface PointerTraceHitTest {
  bbox?: ElementBox;
  hitTestMatchedTarget: boolean;
  blocker?: ClickBlockage["blocker"];
}

export interface PointerTrace {
  actionId: string;
  from: PointerPoint;
  to: PointerPoint;
  targetCenter: PointerPoint;
  points: PointerTracePoint[];
  movementDurationMs: number;
  hoverDurationMs: number;
  initialHitTest: PointerTraceHitTest;
  finalHitTest: PointerTraceHitTest;
  targetMovedDuringApproach: boolean;
  overlayAppearedDuringApproach: boolean;
  finalHitTestMatchedTarget: boolean;
}

export interface InteractiveActionRecord {
  id: string;
  sequence: number;
  actionType: "hover" | "hover_click" | "focus" | "scroll";
  target: InteractiveTarget;
  beforeScreenshot: string;
  afterScreenshot: string;
  screenMap: string;
  clicked: boolean;
  focused: boolean;
  clickBlockage?: ClickBlockage;
  clickSkippedReason?: string;
  clickDecision?: ClickDecision;
  clickDecisionReason?: string;
  plannedReason?: string;
  targetCategory?: InteractiveTargetCategory;
  riskLevel?: InteractiveRiskLevel;
  planDepth?: number;
  planPriority?: number;
  plannedSafeClick?: boolean;
  beforeStateId?: string;
  afterStateId?: string;
  domDiff?: string;
  accessibilityDiff?: string;
  pointerTrace?: string;
  skipped?: boolean;
  skipReason?: string;
  urlBefore?: string;
  urlAfter?: string;
  consoleErrorCount: number;
  networkErrorCount: number;
  findingDetectors: string[];
}

export interface InteractiveArtifacts {
  traceDir: string;
  baseline: string;
  screenMap: string;
  overlay: string;
  accessibility?: string;
  actionsDir: string;
  actionTrace: string;
  stateGraph: string;
  anomalies: string;
  contactSheet: string;
}

export interface InteractiveExplorationResult {
  screenMap: ScreenMap;
  accessibilitySnapshot: unknown;
  actions: InteractiveActionRecord[];
  findings: Finding[];
  artifacts: InteractiveArtifacts;
  summary: {
    actionCount: number;
    screenshotCount: number;
    anomalyCount: number;
    notes: string[];
  };
}
