import type {
  InteractiveCapabilities,
  InteractiveCapability,
  InteractiveCapabilityPolicy,
  InteractiveCommandMode,
  Scenario
} from "./types.js";

const capabilityNames: InteractiveCapability[] = [
  "observe",
  "hover",
  "focus",
  "scroll",
  "safe_click",
  "navigation",
  "typing",
  "form_submit",
  "destructive_action"
];

const defaultCapabilities: InteractiveCapabilities = {
  observe: true,
  hover: true,
  focus: true,
  scroll: true,
  safe_click: false,
  navigation: false,
  typing: false,
  form_submit: false,
  destructive_action: false
};

export interface ResolveCapabilityOptions {
  commandMode: InteractiveCommandMode;
  clickSafeOverride?: boolean;
}

export function resolveInteractiveCapabilities(
  scenario: Scenario | undefined,
  options: ResolveCapabilityOptions
): InteractiveCapabilityPolicy {
  const source = scenario?.interactive_exploration;
  const capabilities: InteractiveCapabilities = {
    ...defaultCapabilities,
    safe_click:
      options.commandMode === "explore"
        ? options.clickSafeOverride === true
        : source?.click_all_safe_controls === true,
    navigation: source?.allow_navigation === true,
    typing: false,
    form_submit: false,
    destructive_action: false
  };

  const reasons: Record<InteractiveCapability, string> = {
    observe: "enabled for evidence collection",
    hover: "enabled for interactive visual inspection",
    focus: "enabled for keyboard-target inspection",
    scroll: "enabled for scroll-container inspection",
    safe_click: capabilities.safe_click
      ? options.commandMode === "explore"
        ? "enabled by standalone explore --click-safe"
        : "enabled by scenario interactive_exploration.click_all_safe_controls: true"
      : options.commandMode === "explore"
        ? "disabled unless standalone explore receives --click-safe"
        : "disabled for run --interactive unless the scenario sets interactive_exploration.click_all_safe_controls: true",
    navigation: capabilities.navigation
      ? "enabled by scenario interactive_exploration.allow_navigation: true"
      : "disabled by default for interactive audits",
    typing: "disabled: ux-sentinel does not type into forms",
    form_submit: "disabled: ux-sentinel does not submit forms",
    destructive_action: "disabled: destructive, payment, logout, removal, and irreversible actions are blocked"
  };

  return {
    commandMode: options.commandMode,
    capabilities,
    reasons,
    enabled: capabilityNames.filter((name) => capabilities[name]),
    disabled: capabilityNames.filter((name) => !capabilities[name])
  };
}
