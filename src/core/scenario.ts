import YAML from "yaml";
import { readText } from "./files.js";
import type { Scenario } from "./types.js";

export const defaultPreferredLabels = [
  "Create first project",
  "Create project",
  "New project",
  "첫 프로젝트 만들기",
  "프로젝트 만들기"
];

export function parseScenarioText(source: string): Scenario {
  const parsed = YAML.parse(source) as Partial<Scenario> | null;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Scenario YAML must be an object.");
  }

  if (!parsed.id || typeof parsed.id !== "string") {
    throw new Error("Scenario is missing required string field: id.");
  }

  if (!parsed.title || typeof parsed.title !== "string") {
    throw new Error("Scenario is missing required string field: title.");
  }

  if (!parsed.persona || typeof parsed.persona !== "string") {
    throw new Error("Scenario is missing required string field: persona.");
  }

  return {
    ...parsed,
    visual_contract: {
      ...parsed.visual_contract,
      primary_cta: {
        preferred_labels:
          parsed.visual_contract?.primary_cta?.preferred_labels?.length
            ? parsed.visual_contract.primary_cta.preferred_labels
            : defaultPreferredLabels,
        avoid_icon_only: parsed.visual_contract?.primary_cta?.avoid_icon_only ?? true,
        must_be_visible_above_fold: parsed.visual_contract?.primary_cta?.must_be_visible_above_fold ?? true,
        must_look_clickable: parsed.visual_contract?.primary_cta?.must_look_clickable ?? true
      },
      empty_state: {
        if_detected_requires_primary_cta:
          parsed.visual_contract?.empty_state?.if_detected_requires_primary_cta ?? true
      }
    },
    fail_conditions:
      parsed.fail_conditions?.length
        ? parsed.fail_conditions
        : [
            "primary_cta_missing",
            "primary_cta_icon_only",
            "empty_state_without_cta",
            "horizontal_scroll",
            "console_error",
            "network_5xx"
          ]
  } as Scenario;
}

export async function parseScenarioFile(filePath: string): Promise<Scenario> {
  return parseScenarioText(await readText(filePath));
}

export function resolveTargetUrl(inputUrl: string, scenario?: Scenario): string {
  const startPath = scenario?.start_path?.trim();
  if (!startPath) {
    return inputUrl;
  }

  const parsed = new URL(inputUrl);
  if (parsed.protocol === "file:") {
    return inputUrl;
  }

  const explicitPath = parsed.pathname && parsed.pathname !== "/";
  if (explicitPath) {
    return inputUrl;
  }

  parsed.pathname = startPath.startsWith("/") ? startPath : `/${startPath}`;
  return parsed.toString();
}
