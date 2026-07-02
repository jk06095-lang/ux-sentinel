import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { enrichFindingWithRules, rulesForDetector, unmappedDetectors } from "../src/core/rules/registry.js";
import type { Finding } from "../src/core/types.js";

const repoRoot = process.cwd();

function implementedDetectors(): string[] {
  const detectorNames = new Set<string>();
  for (const sourceFile of ["src/core/detectors.ts", "src/core/interactive.ts"]) {
    const source = readFileSync(path.join(repoRoot, sourceFile), "utf8");
    for (const match of source.matchAll(/finding\(\s*["']([a-z0-9_]+)["']/g)) {
      detectorNames.add(match[1]);
    }
  }

  return Array.from(detectorNames).sort((a, b) => a.localeCompare(b));
}

describe("UX rule registry", () => {
  it("maps every implemented detector to at least one UX rule", () => {
    const detectors = implementedDetectors();

    expect(detectors.length).toBeGreaterThan(60);
    expect(detectors).toContain("primary_cta_missing");
    expect(detectors).toContain("animation_ignores_reduced_motion");
    expect(unmappedDetectors(detectors)).toEqual([]);
  });

  it("enriches findings with rule metadata and confidence", () => {
    const finding: Finding = {
      id: "UX-001",
      detector: "empty_state_without_cta",
      title: "Empty state has no visible primary CTA",
      severity: "P1",
      type: "Perception Mismatch",
      evidence: "Visible page text looks like an empty state.",
      userImpact: "A user cannot identify the next step.",
      suggestedFix: "Add a visible CTA.",
      regressionCheck: "Run the empty-state scenario again."
    };

    const enriched = enrichFindingWithRules(finding);

    expect(enriched.ruleIds).toContain("nielsen.match_real_world");
    expect(enriched.ruleFamily).toBe("nielsen");
    expect(enriched.whyThisMatters).toContain("Match between system and the real world");
    expect(enriched.confidence).toBe("high");
  });

  it("links pointer trace detectors to pointer-trace evidence requirements", () => {
    const rules = rulesForDetector("cursor_target_drift");

    expect(rules.map((rule) => rule.id)).toEqual(expect.arrayContaining(["nielsen.error_prevention", "interaction_law.fitts_law"]));
    expect(rules.some((rule) => rule.evidenceRequired.includes("pointer_trace"))).toBe(true);
  });

  it("links animation detectors to animation-trace evidence requirements", () => {
    const rules = rulesForDetector("animation_ignores_reduced_motion");

    expect(rules.map((rule) => rule.id)).toContain("motion.reduced_motion_respect");
    expect(rules.some((rule) => rule.evidenceRequired.includes("animation_trace"))).toBe(true);
  });
});
