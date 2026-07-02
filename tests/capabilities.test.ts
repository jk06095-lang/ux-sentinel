import { describe, expect, it } from "vitest";
import { resolveInteractiveCapabilities } from "../src/core/capabilities.js";

describe("interactive capability policy", () => {
  it("keeps safe clicks disabled by default for explore and run", () => {
    expect(resolveInteractiveCapabilities(undefined, { commandMode: "explore" }).capabilities.safe_click).toBe(false);
    expect(
      resolveInteractiveCapabilities(
        { id: "s", title: "S", persona: "tester", interactive_exploration: { enabled: true } },
        { commandMode: "run" }
      ).capabilities.safe_click
    ).toBe(false);
  });

  it("allows safe clicks through the correct command or scenario path only", () => {
    expect(
      resolveInteractiveCapabilities(undefined, { commandMode: "explore", clickSafeOverride: true }).capabilities.safe_click
    ).toBe(true);
    expect(
      resolveInteractiveCapabilities(
        { id: "s", title: "S", persona: "tester", interactive_exploration: { enabled: true, click_all_safe_controls: true } },
        { commandMode: "run" }
      ).capabilities.safe_click
    ).toBe(true);
    expect(
      resolveInteractiveCapabilities(
        { id: "s", title: "S", persona: "tester", interactive_exploration: { enabled: true } },
        { commandMode: "run", clickSafeOverride: true }
      ).capabilities.safe_click
    ).toBe(false);
  });

  it("keeps navigation, typing, form submit, and destructive actions disabled unless explicitly supported", () => {
    const defaultPolicy = resolveInteractiveCapabilities(undefined, { commandMode: "explore" });
    expect(defaultPolicy.capabilities.navigation).toBe(false);
    expect(defaultPolicy.capabilities.typing).toBe(false);
    expect(defaultPolicy.capabilities.form_submit).toBe(false);
    expect(defaultPolicy.capabilities.destructive_action).toBe(false);

    const navigationPolicy = resolveInteractiveCapabilities(
      { id: "s", title: "S", persona: "tester", interactive_exploration: { enabled: true, allow_navigation: true } },
      { commandMode: "run" }
    );
    expect(navigationPolicy.capabilities.navigation).toBe(true);
    expect(navigationPolicy.capabilities.form_submit).toBe(false);
  });
});
