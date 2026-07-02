import { describe, expect, it } from "vitest";
import { verdictForFindings } from "../src/core/detectors.js";
import { parseScenarioText, resolveTargetUrl } from "../src/core/scenario.js";
import type { Finding } from "../src/core/types.js";

describe("scenario parsing", () => {
  it("parses the minimal visual contract scenario", () => {
    const scenario = parseScenarioText(`
id: onboarding-empty-state
title: First-time user sees clear next action
persona: first-time-user
mode: visual_contract
start_path: /dashboard
goal:
  user_wants: "Create the first project"
  primary_intent: "create_project"
visual_contract:
  primary_cta:
    preferred_labels:
      - "Create first project"
fail_conditions:
  - primary_cta_missing
`);

    expect(scenario.id).toBe("onboarding-empty-state");
    expect(scenario.visual_contract?.primary_cta?.preferred_labels).toContain("Create first project");
    expect(scenario.fail_conditions).toContain("primary_cta_missing");
    expect(scenario.fail_conditions_explicit).toBe(true);
  });

  it("uses default fail conditions without explicit detector failure when absent", () => {
    const scenario = parseScenarioText(`
id: default-fail-conditions
title: Default fail conditions
persona: first-time-user
`);

    expect(scenario.fail_conditions).toContain("primary_cta_missing");
    expect(scenario.fail_conditions).toContain("network_5xx");
    expect(scenario.fail_conditions_explicit).toBe(false);
  });

  it("keeps explicit non-empty fail conditions authoritative", () => {
    const scenario = parseScenarioText(`
id: explicit-fail-conditions
title: Explicit fail conditions
persona: first-time-user
fail_conditions:
  - edge_label_crosses_node
`);

    expect(scenario.fail_conditions).toEqual(["edge_label_crosses_node"]);
    expect(scenario.fail_conditions_explicit).toBe(true);
  });

  it("keeps empty fail conditions empty and uses severity-based failure", () => {
    const scenario = parseScenarioText(`
id: empty-fail-conditions
title: Empty fail conditions
persona: first-time-user
fail_conditions: []
`);

    expect(scenario.fail_conditions).toEqual([]);
    expect(scenario.fail_conditions_explicit).toBe(false);
  });

  it("uses severity-based verdicts for absent and empty fail conditions only", () => {
    const p1Finding: Finding = {
      id: "UX-000",
      detector: "focus_ring_missing",
      title: "Focus ring missing",
      severity: "P1",
      type: "Perception Mismatch",
      evidence: "focused control has no visible indicator",
      userImpact: "Keyboard users may lose their current position.",
      suggestedFix: "Show a visible focus indicator.",
      regressionCheck: "Tab through the scenario and confirm focus is visible."
    };
    const p2Finding: Finding = {
      id: "UX-001",
      detector: "edge_label_crosses_node",
      title: "Edge label crosses node",
      severity: "P2",
      type: "Perception Mismatch",
      evidence: "edge label overlaps a DAG node",
      userImpact: "The selected path is ambiguous.",
      suggestedFix: "Move labels away from node boxes.",
      regressionCheck: "Rerun the DAG scenario."
    };

    const absentScenario = parseScenarioText(`
id: absent-fail-conditions
title: Absent fail conditions
persona: first-time-user
`);
    const explicitScenario = parseScenarioText(`
id: explicit-fail-conditions
title: Explicit fail conditions
persona: first-time-user
fail_conditions:
  - edge_label_crosses_node
`);
    const emptyScenario = parseScenarioText(`
id: empty-fail-conditions
title: Empty fail conditions
persona: first-time-user
fail_conditions: []
`);

    expect(absentScenario.fail_conditions).toContain("primary_cta_missing");
    expect(absentScenario.fail_conditions_explicit).toBe(false);
    expect(verdictForFindings([p1Finding], absentScenario)).toBe("fail");
    expect(verdictForFindings([p2Finding], absentScenario)).toBe("ambiguous");

    expect(explicitScenario.fail_conditions).toEqual(["edge_label_crosses_node"]);
    expect(explicitScenario.fail_conditions_explicit).toBe(true);
    expect(verdictForFindings([p2Finding], explicitScenario)).toBe("fail");

    expect(emptyScenario.fail_conditions).toEqual([]);
    expect(emptyScenario.fail_conditions_explicit).toBe(false);
    expect(verdictForFindings([p1Finding], emptyScenario)).toBe("fail");
    expect(verdictForFindings([p2Finding], emptyScenario)).toBe("ambiguous");
  });

  it("applies start_path only to base HTTP URLs", () => {
    const scenario = parseScenarioText(`
id: dashboard
title: Dashboard
persona: first-time-user
start_path: /dashboard
`);

    expect(resolveTargetUrl("http://127.0.0.1:4173", scenario)).toBe("http://127.0.0.1:4173/dashboard");
    expect(resolveTargetUrl("http://127.0.0.1:4173/broken", scenario)).toBe("http://127.0.0.1:4173/broken");
  });

  it("parses interactive exploration and visual anomaly contract extensions", () => {
    const scenario = parseScenarioText(`
id: interactive-dag
title: DAG remains visually traceable
persona: first-time-user
interactive_exploration:
  enabled: true
  mode: agentic
  max_actions: 12
  max_depth: 2
  max_clicks: 4
  max_state_changes: 8
  settle_ms: 125
  avoid_click_text:
    - "Delete"
  allow_navigation: true
visual_anomaly_contract:
  no_click_target_blocking: true
  graph_dag:
    enabled: true
    max_unused_canvas_ratio: 0.5
`);

    expect(scenario.interactive_exploration?.enabled).toBe(true);
    expect(scenario.interactive_exploration?.mode).toBe("agentic");
    expect(scenario.interactive_exploration?.max_actions).toBe(12);
    expect(scenario.interactive_exploration?.max_depth).toBe(2);
    expect(scenario.interactive_exploration?.max_clicks).toBe(4);
    expect(scenario.interactive_exploration?.max_state_changes).toBe(8);
    expect(scenario.interactive_exploration?.settle_ms).toBe(125);
    expect(scenario.interactive_exploration?.click_all_safe_controls).toBe(false);
    expect(scenario.interactive_exploration?.allow_navigation).toBe(true);
    expect(scenario.interactive_exploration?.avoid_click_text).toContain("Delete");
    expect(scenario.visual_anomaly_contract?.graph_dag?.max_unused_canvas_ratio).toBe(0.5);
    expect(scenario.fail_conditions_explicit).toBe(false);
  });

  it("parses animation audit options", () => {
    const scenario = parseScenarioText(`
id: motion-audit
title: Motion audit
persona: first-time-user
animation_audit:
  enabled: true
  compare_reduced_motion: true
  detect_layout_shift: false
  detect_risky_properties: true
  max_animation_ms: 900
`);

    expect(scenario.animation_audit?.enabled).toBe(true);
    expect(scenario.animation_audit?.compare_reduced_motion).toBe(true);
    expect(scenario.animation_audit?.detect_layout_shift).toBe(false);
    expect(scenario.animation_audit?.detect_risky_properties).toBe(true);
    expect(scenario.animation_audit?.max_animation_ms).toBe(900);
  });

  it("parses UX rule profile options", () => {
    const scenario = parseScenarioText(`
id: professional-agentic-ui-audit
title: Professional Agentic UI Audit
persona: first-time-user
ux_rule_profile:
  enabled: true
  rule_sets:
    - nielsen_10_heuristics
    - wcag_2_2_interaction
    - graph_dag_readability
  require_rule_mapping: true
`);

    expect(scenario.ux_rule_profile?.enabled).toBe(true);
    expect(scenario.ux_rule_profile?.rule_sets).toEqual([
      "nielsen_10_heuristics",
      "wcag_2_2_interaction",
      "graph_dag_readability"
    ]);
    expect(scenario.ux_rule_profile?.require_rule_mapping).toBe(true);
  });
});
