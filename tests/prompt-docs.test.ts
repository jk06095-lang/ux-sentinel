import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readText(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const promptFiles = [
  "docs/prompts/01-first-run-baseline.md",
  "docs/prompts/02-natural-language-goal-to-scenario.md",
  "docs/prompts/03-continuous-goal-loop.md"
];

describe("three magic prompt docs", () => {
  it("ships the three guided Codex prompts", () => {
    for (const file of promptFiles) {
      expect(existsSync(path.join(repoRoot, file)), file).toBe(true);
    }
  });

  it("links the three prompt workflow from the README", () => {
    const readme = readText("README.md");

    expect(readme).toContain("### Three Magic Prompts");
    expect(readme).toContain("docs/prompts/01-first-run-baseline.md");
    expect(readme).toContain("docs/prompts/02-natural-language-goal-to-scenario.md");
    expect(readme).toContain("docs/prompts/03-continuous-goal-loop.md");
    expect(readme).toContain("Recommended order: run baseline first");
  });

  it("keeps the prompts on the stable GitHub v0.1.0 runner", () => {
    const docs = promptFiles.map(readText).join("\n");

    expect(docs).toContain("github:jk06095-lang/ux-sentinel#v0.1.0");
    expect(docs).toContain("DOM says pass. Humans say");
    expect(docs).not.toContain("npm link 방식");
  });

  it("separates baseline, scenario creation, and continuous goal usage", () => {
    expect(readText("docs/prompts/01-first-run-baseline.md")).toContain("Do not modify app source code yet");
    expect(readText("docs/prompts/02-natural-language-goal-to-scenario.md")).toContain("User's plain-language destination");
    expect(readText("docs/prompts/03-continuous-goal-loop.md")).toContain("/goal Use ux-sentinel v0.1.0");
  });
});
