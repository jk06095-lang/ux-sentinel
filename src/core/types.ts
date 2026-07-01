export type Severity = "P0" | "P1" | "P2" | "P3";
export type Verdict = "pass" | "fail" | "ambiguous";

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
  fail_conditions?: string[];
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
