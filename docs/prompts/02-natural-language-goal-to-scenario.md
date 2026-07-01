# Magic Prompt 2: Natural Language Goal to UX Scenario

Use this prompt when a user describes the desired product experience in normal conversational language.

Purpose:

- preserve the raw user intent,
- distill it into a UX mission,
- create or update a lightweight persona,
- create an executable `ux-sentinel` visual-contract scenario,
- avoid app source changes until the scenario is clear.

Copy everything below into Codex from the target frontend repo, then replace the `User's plain-language destination` block.

```text
Use ux-sentinel v0.1.0 to turn the user's plain-language product goal into an executable UX perception scenario.

The user will describe what they want this app to achieve in normal conversational language.
Your job is to refine that into a concrete ux-sentinel scenario.

Do not implement the feature yet.
Do not modify application source code yet.
Only create or update ux-sentinel scenario/persona/feedback files.

Core principle:
DOM says pass. Humans say “what do I click?”

User's plain-language destination:
<<<
여기에 사용자가 원하는 목적지를 일반 대화체로 적는다.

예시:
첫 사용자가 회원가입을 마치고 대시보드에 들어왔을 때, 화면이 비어 있어도 당황하지 않고 첫 프로젝트를 만들 수 있었으면 좋겠어. 버튼이 작거나 + 아이콘만 있으면 안 되고, “첫 프로젝트 만들기” 같은 명확한 행동이 보여야 해.
>>>

Rules:
- If the user's description is ambiguous, make the best reasonable interpretation and document assumptions.
- Do not ask follow-up questions unless the scenario cannot be created at all.
- Prefer small screen-level visual_contract scenarios over huge multi-step journeys.
- The scenario should test human-visible clarity, not just DOM operability.
- Do not weaken auth, validation, security, privacy, billing, or tests.
- Do not modify app source files.
- Do not modify ux-sentinel itself.
- Do not create speculative P3 taste requirements.

Step 1: Read existing context
- Read AGENTS.md if it exists.
- Read .ux-sentinel/UX_CONSTITUTION.md if it exists.
- Read existing .ux-sentinel/scenarios/*.yaml.
- Read existing .ux-sentinel/personas/*.yaml if present.
- Read package.json to understand likely app type.
- Inspect routes/pages/components only enough to choose a likely start_path.

Step 2: Distill the user's destination

Write a short UX Mission Brief with:

- raw user description
- inferred target user
- inferred screen or route
- user goal
- primary intent
- current risk
- desired visible next action
- unacceptable failure modes
- assumptions
- confidence

Save it as:

.ux-sentinel/missions/<slug>.md

If .ux-sentinel/missions does not exist, create it.

Step 3: Create or update persona

If the target persona does not exist, create one under:

.ux-sentinel/personas/<persona-id>.yaml

Keep it simple.

Include:
- id
- name
- goals
- frustrations
- questions_this_persona_asks
- must_not_assume

Do not claim this persona is real user research. Treat it as a QA lens.

Step 4: Create scenario YAML

Create a scenario under:

.ux-sentinel/scenarios/<slug>.yaml

Use this structure:

id: <slug>
title: <clear human-readable title>
persona: <persona-id>
mode: visual_contract
start_path: <best inferred route, such as /dashboard, /onboarding, /billing/failed, /generate/result>

goal:
  user_wants: "<the human goal>"
  primary_intent: "<machine-readable intent>"

visual_contract:
  page_must_answer:
    - "Where am I?"
    - "What happened?"
    - "What can I do next?"
    - "What happens after I do it?"

  primary_cta:
    preferred_labels:
      - "<English label 1>"
      - "<English label 2>"
      - "<Korean label 1>"
      - "<Korean label 2>"
    avoid_icon_only: true
    must_be_visible_above_fold: true
    must_look_clickable: true

  empty_state:
    if_detected_requires_primary_cta: true

fail_conditions:
  - primary_cta_missing
  - primary_cta_icon_only
  - empty_state_without_cta
  - dom_visible_but_human_invisible
  - primary_cta_below_fold
  - console_error
  - network_5xx
  - horizontal_scroll
  - important_text_truncated

Adjust page_must_answer and preferred_labels to match the user's actual destination.
For non-empty-state scenarios, set if_detected_requires_primary_cta appropriately.

Step 5: Explain the scenario

After writing the files, summarize:
- what user goal was inferred
- which route/start_path was chosen
- which primary CTA labels are accepted
- which failures will block the scenario
- what assumptions were made
- how to run it

Step 6: Provide run command

Use:

npm exec --yes --package=github:jk06095-lang/ux-sentinel#v0.1.0 -- ux-sentinel run .ux-sentinel/scenarios/<slug>.yaml --url <local-url>

Do not run it unless the app can be started safely and the local URL is known.
```
