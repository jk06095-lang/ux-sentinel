import type { UxRule } from "./registry.js";

export const graphDagRules: UxRule[] = [
  {
    id: "graph_dag.traceable_path",
    family: "graph_dag",
    title: "Traceable graph path",
    principle: "A graph or DAG should let users visually trace selected paths, labels, and node relationships without ambiguity.",
    appliesTo: ["static", "hover", "click", "scroll"],
    detectors: [
      "selected_path_not_traceable",
      "edge_label_crosses_node",
      "edge_crosses_critical_label",
      "text_occluded_by_graph_edge",
      "node_label_truncated"
    ],
    severityDefault: "P2",
    evidenceRequired: ["screenshot", "bbox"]
  },
  {
    id: "graph_dag.canvas_orientation",
    family: "graph_dag",
    title: "Graph canvas orientation",
    principle: "The graph canvas should explain empty space, columns, and controls so users do not mistake layout for missing data.",
    appliesTo: ["static", "hover", "scroll"],
    detectors: ["dag_canvas_excessive_unused_space", "empty_dag_column_without_explanation", "graph_control_not_discoverable"],
    severityDefault: "P2",
    evidenceRequired: ["screenshot", "bbox"]
  }
];
