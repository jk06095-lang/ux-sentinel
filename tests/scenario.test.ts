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
});
