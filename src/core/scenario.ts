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
    interactive_exploration: parsed.interactive_exploration
      ? {
          enabled: parsed.interactive_exploration.enabled ?? false,
          max_actions: parsed.interactive_exploration.max_actions ?? 40,
          hover_all_clickables: parsed.interactive_exploration.hover_all_clickables ?? true,
          click_all_safe_controls: parsed.interactive_exploration.click_all_safe_controls ?? true,
          focus_all_keyboard_targets: parsed.interactive_exploration.focus_all_keyboard_targets ?? true,
          scroll_containers: parsed.interactive_exploration.scroll_containers ?? true,
          screenshot_before_after_each_action:
            parsed.interactive_exploration.screenshot_before_after_each_action ?? true,
          settle_ms: parsed.interactive_exploration.settle_ms ?? 350,
          avoid_click_text: parsed.interactive_exploration.avoid_click_text ?? []
        }
      : undefined,
    visual_anomaly_contract: parsed.visual_anomaly_contract
      ? {
          no_text_occlusion: parsed.visual_anomaly_contract.no_text_occlusion ?? true,
          no_click_target_blocking: parsed.visual_anomaly_contract.no_click_target_blocking ?? true,
          no_floating_panel_covering_primary_action:
            parsed.visual_anomaly_contract.no_floating_panel_covering_primary_action ?? true,
          no_svg_edge_label_overlap: parsed.visual_anomaly_contract.no_svg_edge_label_overlap ?? true,
          no_card_overlap: parsed.visual_anomaly_contract.no_card_overlap ?? true,
          no_important_text_truncation: parsed.visual_anomaly_contract.no_important_text_truncation ?? true,
          graph_dag: parsed.visual_anomaly_contract.graph_dag
            ? {
                enabled: parsed.visual_anomaly_contract.graph_dag.enabled ?? true,
                columns_must_have_labels:
                  parsed.visual_anomaly_contract.graph_dag.columns_must_have_labels ?? true,
                selected_path_must_be_traceable:
                  parsed.visual_anomaly_contract.graph_dag.selected_path_must_be_traceable ?? true,
                edge_labels_must_not_cross_nodes:
                  parsed.visual_anomaly_contract.graph_dag.edge_labels_must_not_cross_nodes ?? true,
                max_unused_canvas_ratio:
                  parsed.visual_anomaly_contract.graph_dag.max_unused_canvas_ratio ?? 0.65
              }
            : undefined
        }
      : undefined,
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
