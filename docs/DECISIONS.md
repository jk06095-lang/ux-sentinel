# Decisions

This file records product and technical decisions made during implementation.

## Decision Log

| Date | Decision | Reason | Status |
| --- | --- | --- | --- |
| 2026-07-01 | MVP is a local CLI, not SaaS. | The product must help developers locally before any account, dashboard, or cloud infrastructure exists. | Accepted |
| 2026-07-01 | Use Playwright for page evidence capture. | The MVP needs screenshots, DOM data, accessibility evidence, and element bounding boxes from real rendered pages. | Accepted |
| 2026-07-01 | Use deterministic rule-based detectors first. | The product must work without a required external LLM API and must produce explainable findings. | Accepted |
| 2026-07-01 | Use Markdown as the primary report and brief format. | Reports must be easy for humans and Codex to read, diff, and act on. | Accepted |
| 2026-07-01 | Store local config and artifacts under `.ux-sentinel`. | Keeps project-specific scenarios, personas, runs, reports, feedback, and briefs together. | Accepted |
| 2026-07-01 | Use scenario YAML for repeatable checks. | Scenarios make UX expectations explicit and versionable. | Accepted |
| 2026-07-01 | Demo centers on a broken/fixed empty dashboard CTA. | It clearly shows the difference between DOM existence and human-perceived next action. | Accepted |
| 2026-07-01 | Use npm for the MVP package workflow. | npm is available by default with Node.js and keeps setup simple for an open-source CLI MVP. | Accepted |
| 2026-07-01 | Compile the CLI to `dist/cli.js`. | The package `bin` entry and demo scripts need a predictable executable path. | Accepted |
| 2026-07-01 | Ship static HTML demo fixtures plus a tiny Node demo server. | This proves the broken/fixed perception mismatch without adding an app framework or SaaS surface. | Accepted |
| 2026-07-01 | Treat P0/P1 findings listed in `fail_conditions` as failing exit codes. | The CLI must be usable in local scripts and must fail the broken demo deterministically. | Accepted |
| 2026-07-01 | Write `screen-map.json`, `screen-map.html`, `accessibility.json`, and `screenshot.png` into timestamped trace folders. | Evidence artifacts need to be inspectable by both humans and Codex. | Accepted |
| 2026-07-01 | Support GitHub `npm exec` as the external-project path. | Developers should be able to use ux-sentinel from another Codex project without `npm link`, global install, or adding a dependency. | Accepted |
| 2026-07-01 | Add `prepare: npm run build`. | GitHub package installs need to compile `dist/cli.js` before npm exposes the `ux-sentinel` bin. | Accepted |
| 2026-07-01 | Keep Codex Skill and MCP as future packaging layers. | Prompt-only GitHub execution is lower scope and better matches the local-first MVP; MCP is not required for v0. | Accepted |
| 2026-07-01 | Keep v0.1 launch usage GitHub-only for now. | GitHub `npm exec` is verified from an external repo; npm publishing should wait until the v0.1.0 tag, release notes, and package ownership are deliberately finalized. | Accepted |

## Pending Decisions

- Whether to publish the package to npm after GitHub-only v0.1 usage gets feedback.
- When to cut the `v0.1.0` tag and GitHub release.
- How rich scenario action steps should become after the initial observe-only visual contract.
- Whether future optional LLM/provider integrations belong in core or separate plugins.
- Whether to package the repo-scoped skill as an installable Codex plugin after the prompt-only workflow has enough usage feedback.
