# UX Rule Registry

The UX rule registry maps detector names to professional UX principles. It keeps findings from being only ad hoc labels and gives reports a clear "Why this matters" explanation.

The implementation lives in:

- `src/core/rules/registry.ts`
- `src/core/rules/nielsen.ts`
- `src/core/rules/wcag22.ts`
- `src/core/rules/motion.ts`
- `src/core/rules/gestalt.ts`
- `src/core/rules/interaction-laws.ts`
- `src/core/rules/graph-dag.ts`

## Finding Metadata

Each enriched finding can include:

- `ruleIds`
- `ruleFamily`
- `whyThisMatters`
- `confidence`
- `evidencePaths`

Reports render this metadata as `UX rules`, `Rule family`, `Why this matters`, `Confidence`, and optional evidence paths.

## Rule Shape

```ts
export interface UxRule {
  id: string;
  family: "nielsen" | "wcag" | "motion" | "gestalt" | "interaction_law" | "graph_dag" | "local_product_rule";
  title: string;
  principle: string;
  appliesTo: Array<"static" | "hover" | "focus" | "click" | "scroll" | "animation">;
  detectors: string[];
  severityDefault: "P0" | "P1" | "P2" | "P3";
  evidenceRequired: Array<
    | "screenshot"
    | "before_after"
    | "visual_diff"
    | "bbox"
    | "screen_map"
    | "a11y_snapshot"
    | "hit_test"
    | "dom_diff"
    | "a11y_diff"
    | "pointer_trace"
    | "animation_trace"
  >;
}
```

## Current Rule Families

- Nielsen heuristics for status visibility, real-world language, recognition over recall, and error prevention.
- WCAG 2.2 interaction/readability rules for name-role-value, focus visibility, and reflow.
- Motion rules for reduced motion and stable spatial transitions.
- Gestalt rules for grouping and figure-ground clarity.
- Interaction-law rules for target size, visual hierarchy, and feedback loops.
- Graph/DAG rules for traceable paths and canvas orientation.
- Local product rules for perception mismatch, runtime evidence integrity, and interactive safety evidence.

## Adding A Detector

When adding a detector:

1. Emit concrete evidence first: screenshot, bbox, screen map, hit-test, pointer trace, DOM diff, or accessibility diff.
2. Add the detector name to at least one rule in `src/core/rules/`.
3. Pick the rule family that best explains the user impact.
4. If the detector needs new evidence, include it in `evidenceRequired`.
5. Add or update tests so `unmappedDetectors(...)` stays empty for implemented detectors.

Findings without sufficient evidence are marked lower confidence by the enrichment layer. Do not raise confidence by weakening evidence requirements.
