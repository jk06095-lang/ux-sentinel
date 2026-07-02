import { describe, expect, it } from "vitest";
import { parseScenarioText, resolveTargetUrl } from "../src/core/scenario.js";

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
  max_actions: 12
  settle_ms: 125
  avoid_click_text:
    - "Delete"
visual_anomaly_contract:
  no_click_target_blocking: true
  graph_dag:
    enabled: true
    max_unused_canvas_ratio: 0.5
`);

    expect(scenario.interactive_exploration?.enabled).toBe(true);
    expect(scenario.interactive_exploration?.max_actions).toBe(12);
    expect(scenario.interactive_exploration?.settle_ms).toBe(125);
    expect(scenario.interactive_exploration?.avoid_click_text).toContain("Delete");
    expect(scenario.visual_anomaly_contract?.graph_dag?.max_unused_canvas_ratio).toBe(0.5);
  });
});
