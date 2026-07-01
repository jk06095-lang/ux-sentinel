import path from "node:path";
import { existsSync } from "node:fs";
import { readText, writeText, writeFileIfMissing } from "./files.js";

const defaultScenario = `id: onboarding-empty-state
title: First-time user sees clear next action
persona: first-time-user
mode: visual_contract
start_path: /dashboard

goal:
  user_wants: "Create the first project"
  primary_intent: "create_project"

visual_contract:
  page_must_answer:
    - "Where am I?"
    - "What can I do next?"
    - "What happens after I do it?"
  primary_cta:
    preferred_labels:
      - "Create first project"
      - "Create project"
      - "New project"
      - "첫 프로젝트 만들기"
      - "프로젝트 만들기"
    avoid_icon_only: true
    must_be_visible_above_fold: true
    must_look_clickable: true
  empty_state:
    if_detected_requires_primary_cta: true

fail_conditions:
  - primary_cta_missing
  - primary_cta_icon_only
  - empty_state_without_cta
  - console_error
  - network_5xx
  - horizontal_scroll
  - important_text_truncated
`;

const defaultPersona = `id: first-time-user
name: First-time user
description: A user who has not learned hidden shortcuts or icon meanings.
assumptions:
  - Relies on visible labels, hierarchy, and empty-state copy.
  - Does not inspect DOM or accessibility metadata.
`;

const constitution = `# UX Constitution

## Core Rule

DOM existence is not enough. A human must understand the current state, primary action, consequence, and recovery path from the visible UI.

## Principles

- Primary actions should be visible, legible, and above the fold for first-run journeys.
- Empty states should explain what is missing and what to do next.
- Icon-only controls should not carry the primary action unless the surrounding UI makes the action unmistakable.
- Recovery paths should be visible when an action is disabled or blocked.
`;

async function appendIfMissing(filePath: string, marker: string, content: string): Promise<void> {
  const current = existsSync(filePath) ? await readText(filePath) : "";
  if (current.includes(marker)) {
    return;
  }

  await writeText(filePath, current.trimEnd() ? `${current.trimEnd()}\n\n${content}` : content);
}

async function ensureGitignoreEntries(filePath: string, entries: string[]): Promise<void> {
  const current = existsSync(filePath) ? await readText(filePath) : "";
  const missing = entries.filter((entry) => !current.split(/\r?\n/).includes(entry));
  if (missing.length === 0) {
    return;
  }

  const next = [current.trimEnd(), ...missing].filter(Boolean).join("\n");
  await writeText(filePath, `${next}\n`);
}

export async function initProject(cwd = process.cwd()): Promise<string[]> {
  const created: string[] = [];
  const root = path.join(cwd, ".ux-sentinel");

  const writes: Array<[string, string]> = [
    [path.join(root, "UX_CONSTITUTION.md"), constitution],
    [path.join(root, "scenarios", "onboarding-empty-state.yaml"), defaultScenario],
    [path.join(root, "personas", "first-time-user.yaml"), defaultPersona],
    [path.join(root, "feedback", "raw", ".gitkeep"), ""],
    [path.join(root, "feedback", "distilled", ".gitkeep"), ""],
    [path.join(root, "reports", ".gitkeep"), ""],
    [path.join(root, "traces", ".gitkeep"), ""]
  ];

  for (const [filePath, value] of writes) {
    if ((await writeFileIfMissing(filePath, value)) === "created") {
      created.push(filePath);
    }
  }

  await ensureGitignoreEntries(path.join(cwd, ".gitignore"), [
    ".ux-sentinel/traces/",
    ".ux-sentinel/reports/",
    ".ux-sentinel/briefs/"
  ]);

  const agentsPath = path.join(cwd, "AGENTS.md");
  if (!existsSync(agentsPath)) {
    await writeText(
      agentsPath,
      `# AGENTS.md

## UX Sentinel

Follow docs/MVP_SPEC.md. Keep ux-sentinel local-first, TypeScript-based, Playwright-backed, and rule-based for the MVP.
`
    );
    created.push(agentsPath);
  }

  return created;
}
