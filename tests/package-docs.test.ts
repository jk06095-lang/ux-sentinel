import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readText(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("package metadata for GitHub npm exec", () => {
  const packageJson = JSON.parse(readText("package.json")) as {
    bin?: Record<string, string>;
    scripts?: Record<string, string>;
    files?: string[];
  };

  it("exposes the ux-sentinel binary from dist", () => {
    expect(packageJson.bin?.["ux-sentinel"]).toBe("./dist/cli.js");
  });

  it("builds during GitHub package installs", () => {
    expect(packageJson.scripts?.prepare).toBe("npm run build");
  });

  it("includes generated CLI output and Codex docs in the package", () => {
    expect(packageJson.files).toEqual(expect.arrayContaining(["dist", "docs", "examples", ".agents"]));
  });

  it("keeps the source CLI shebang for executable output", () => {
    expect(readText("src/cli.ts").startsWith("#!/usr/bin/env node")).toBe(true);
  });
});

describe("Codex integration docs", () => {
  const requiredFiles = [
    "docs/CODEX_MAGIC_PROMPT.md",
    "docs/CODEX_INTEGRATION.md",
    ".agents/skills/ux-sentinel/SKILL.md",
    "examples/codex/magic-prompt.md",
    "examples/codex/goal-prompt.md",
    "examples/codex/onboarding-qa.prompt.md",
    "examples/codex/empty-state-qa.prompt.md"
  ];

  it("includes the requested prompt and skill files", () => {
    for (const file of requiredFiles) {
      expect(existsSync(path.join(repoRoot, file)), file).toBe(true);
    }
  });

  it("documents GitHub npm exec as the external-project fast path", () => {
    const docs = [
      readText("README.md"),
      readText("docs/CODEX_MAGIC_PROMPT.md"),
      readText("docs/CODEX_INTEGRATION.md"),
      readText("examples/codex/magic-prompt.md")
    ].join("\n");

    expect(docs).toContain("npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel");
  });

  it("mentions npm link only as something to avoid", () => {
    const docs = [
      "README.md",
      "docs/CODEX_MAGIC_PROMPT.md",
      "docs/CODEX_INTEGRATION.md",
      ".agents/skills/ux-sentinel/SKILL.md",
      "examples/codex/magic-prompt.md",
      "examples/codex/goal-prompt.md",
      "examples/codex/onboarding-qa.prompt.md",
      "examples/codex/empty-state-qa.prompt.md"
    ].map(readText).join("\n");

    const npmLinkLines = docs.split(/\r?\n/).filter((line) => /npm link/i.test(line));
    expect(npmLinkLines.length).toBeGreaterThan(0);
    for (const line of npmLinkLines) {
      expect(line).toMatch(/do not|does not need|no npm link|avoid|without/i);
    }
  });
});
