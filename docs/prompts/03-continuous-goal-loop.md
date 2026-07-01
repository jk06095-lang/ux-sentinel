# Magic Prompt 3: Continuous `/GOAL` Loop

Use this prompt when you want Codex to keep `ux-sentinel` running while it implements the user's requested product work.

Purpose:

- implement the user's requested UI/product change,
- create or reuse a relevant `ux-sentinel` scenario,
- run a baseline check,
- fix only report-backed P0/P1 perception mismatches,
- rerun until the target flow passes or a real blocker is documented.

Copy everything below into Codex from the target frontend repo, then replace the `User's requested work` block.

```text
/goal Use ux-sentinel v0.1.0 as a continuous UX QA harness while implementing the user's requested product work in this frontend repo.

Core principle:
DOM says pass. Humans say “what do I click?”

User's requested work:
<<<
여기에 사용자가 해당 프로젝트에 원하는 작업을 일반 대화체로 적는다.

예시:
첫 사용자가 회원가입 후 대시보드에 들어왔을 때 바로 첫 프로젝트를 만들 수 있게 해줘. 빈 화면처럼 보이면 안 되고, 사용자가 다음에 뭘 해야 하는지 확실히 알아야 해.
>>>

Primary objective:
Complete the user's requested work while preserving human-visible UX clarity.
Use ux-sentinel to detect and fix P0/P1 perception mismatches during the work, not only at the end.

Rules:
- Do not use npm link.
- Do not install ux-sentinel globally.
- Do not require an external LLM API.
- Do not modify ux-sentinel itself.
- Do not suppress ux-sentinel findings by weakening scenarios or detectors.
- Do not make speculative P2/P3 taste changes unless they are directly necessary for the user's request.
- Do not weaken auth, validation, security, privacy, billing, or tests.
- If a finding is not grounded in ux-sentinel evidence, treat it as a hypothesis, not proof.
- If the requested work does not affect UI, still complete the work but do not force irrelevant ux-sentinel checks.

Step 1: Understand the target repo
- Read AGENTS.md if it exists.
- Read package.json and lockfiles.
- Determine package manager and dev command.
- Inspect relevant routes/pages/components for the user's requested work.
- Read .ux-sentinel/UX_CONSTITUTION.md if present.
- Read existing .ux-sentinel/scenarios/*.yaml.

Step 2: Select ux-sentinel runner

First try:

npm exec --yes --package=github:jk06095-lang/ux-sentinel#v0.1.0 -- ux-sentinel --help

If it works:

UX_SENTINEL="npm exec --yes --package=github:jk06095-lang/ux-sentinel#v0.1.0 -- ux-sentinel"

If npm exec fails, run fallback from the target repo root:

TARGET_REPO=$(pwd)
git clone https://github.com/jk06095-lang/ux-sentinel.git /tmp/ux-sentinel
cd /tmp/ux-sentinel
git checkout v0.1.0
npm install
npm run build
cd "$TARGET_REPO"
node /tmp/ux-sentinel/dist/cli.js --help
UX_SENTINEL="node /tmp/ux-sentinel/dist/cli.js"

Build ux-sentinel in the temporary tool directory, then cd back to the target repo before running node /tmp/ux-sentinel/dist/cli.js. Reports and traces are written relative to the current working directory.

Step 3: Initialize if needed
If .ux-sentinel does not exist:

$UX_SENTINEL init

Step 4: Convert the user's requested work into UX scenarios
If a relevant scenario already exists, reuse it.
If not, create a small visual_contract scenario under:

.ux-sentinel/scenarios/<slug>.yaml

The scenario should describe:
- target persona
- user goal
- primary intent
- likely start_path
- visible primary CTA labels
- empty-state requirements if relevant
- fail_conditions:
  - primary_cta_missing
  - primary_cta_icon_only
  - empty_state_without_cta
  - dom_visible_but_human_invisible
  - primary_cta_below_fold
  - console_error
  - network_5xx
  - horizontal_scroll
  - important_text_truncated

Step 5: Start the app
Start the app with its existing dev command.
Find the local URL from output or common defaults.

Step 6: Baseline before changes
Run the relevant scenario before modifying code if possible:

$UX_SENTINEL run .ux-sentinel/scenarios/<scenario>.yaml --url <local-url>

Read the report.
If it already fails, note the baseline findings.

Step 7: Implement the requested work
Modify only the target app files needed for the user's request.
Prefer simple, clear UI changes.
Make primary actions visible to humans, not only present in the DOM or aria-labels.

Step 8: Continuous ux-sentinel loop
After each meaningful UI change, rerun the relevant scenario:

$UX_SENTINEL run .ux-sentinel/scenarios/<scenario>.yaml --url <local-url>

If the scenario fails with P0/P1 perception mismatch:
- read the report
- run:
  $UX_SENTINEL codex-brief <report-path>
- fix the visible UI issue
- rerun the same scenario

Do not silence the finding by changing the scenario unless the scenario is clearly wrong and you explain why.

Step 9: Functional verification
Run existing project tests or checks if available:
- npm test
- npm run build
- npm run lint
Use the project's actual scripts.

Step 10: Stop condition
Stop only when:
- the user's requested work is implemented,
- relevant ux-sentinel scenario passes, or a real blocker is documented,
- existing build/test/lint checks pass where available,
- no P0/P1 ux-sentinel perception mismatch remains for the target flow.

Final response:
- user's requested work interpreted as
- scenarios created or reused
- ux-sentinel runner used
- baseline verdict
- final verdict
- report path
- patch brief path if generated
- files changed
- commands run
- tests/build/lint run
- remaining P2/P3 suggestions
- remaining risks or blockers
```
