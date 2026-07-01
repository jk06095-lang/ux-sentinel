# Product Brief

## Product

`ux-sentinel` is a local CLI developer tool for finding perception mismatch in AI-generated frontend UIs.

It focuses on this problem:

> DOM상으로는 기능이 존재하지만, 사람이 화면을 보면 다음 행동을 알기 어려운 문제.

In plain English:

> The DOM says the UI is functional, but the human still cannot tell what to click.

## Why This Exists

AI-generated frontend code often passes shallow checks:

- The button exists in the DOM.
- The button has an `aria-label`.
- The route renders.
- The test can click a selector.

But the actual screen can still fail a human user:

- The primary action is only a tiny icon.
- Empty states do not explain the next step.
- Multiple controls compete for attention.
- Disabled states provide no recovery path.
- A user can see the screen and still ask, "what do I do now?"

`ux-sentinel` exists to catch that gap before the UI ships.

## Original Context From The Conversation

### User Message 1

이번 MVP는 이렇게 잡는 게 좋습니다.

`ux-sentinel`: AI가 만든 프론트엔드 UI에서 "DOM상으로는 기능이 존재하지만, 사람이 화면을 보면 다음 행동을 알기 어려운 문제"를 잡아내는 로컬 CLI.

초기 MVP는 SaaS가 아니라 로컬 개발자 도구여야 합니다.

만들 기능은 아래 5개입니다.

1. `ux-sentinel init`
   `.ux-sentinel` 설정, 기본 시나리오, 기본 페르소나, UX 헌법 파일 생성

2. `ux-sentinel observe --url <url>`
   특정 URL 화면을 캡처하고 screenshot, DOM map, accessibility evidence, screen-map 생성

3. `ux-sentinel run <scenario.yaml> --url <url>`
   시나리오 기반으로 UI를 검사하고 perception mismatch 리포트 생성

4. `ux-sentinel ingest-feedback <feedback.md>`
   사용자의 UX 피드백을 pain point / principle / suggested check 형태로 정제

5. `ux-sentinel codex-brief <report.md>`
   발견된 문제를 Codex가 수정할 수 있는 patch brief로 변환

절대 만들지 말아야 할 것은 이것입니다.

- SaaS 대시보드
- 계정/로그인
- 결제
- 클라우드 runner
- 복잡한 DB
- Chrome extension
- 완전 자율 브라우저 에이전트
- 외부 LLM API 필수 연동
- Figma 연동
- enterprise QA 플랫폼

처음에는 Playwright + 규칙 기반 detector + Markdown report만으로 충분합니다.

### User Message 2

Codex에게 처음부터 긴 대화 전체를 프롬프트로 계속 먹이지 말고, 저장소에 아래 파일을 만들라고 하세요.

```text
docs/
  PRODUCT_BRIEF.md
  MVP_SPEC.md
  LAUNCH_PLAN.md
  DECISIONS.md
  PROGRESS.md

AGENTS.md
```

각 파일 역할은 다음입니다.

`docs/PRODUCT_BRIEF.md`
- 지금까지 나눈 대화 전체 복사본
- 왜 이 제품을 만드는지에 대한 원문 컨텍스트

`docs/MVP_SPEC.md`
- 실제 구현 범위
- CLI 명령어
- scenario schema
- detector 목록
- report format
- demo 기준
- Definition of Done

`docs/LAUNCH_PLAN.md`
- GitHub 공개용 README 메시지
- Show HN / Reddit / X 홍보 문구
- broken/fixed demo 시나리오

`docs/DECISIONS.md`
- Codex가 구현 중 내린 제품/기술 결정 기록

`docs/PROGRESS.md`
- Codex가 checkpoint마다 진행상황 기록

`AGENTS.md`
- Codex가 항상 따라야 하는 개발 지침

Codex 공식 best practices도 프롬프트에 목표, 컨텍스트, 제약, 완료 기준을 포함하라고 안내합니다. 이 프로젝트에서는 그 네 가지를 `docs/MVP_SPEC.md`와 `AGENTS.md`에 나눠 넣는 방식이 가장 안정적입니다.

## Product Positioning

`ux-sentinel` is not a design system, analytics product, QA platform, or autonomous browser agent.

It is a developer-side inspection tool that produces evidence and repair briefs:

1. Observe a page.
2. Map what a human can plausibly perceive.
3. Compare that against the scenario goal.
4. Report perception mismatch.
5. Produce a patch brief Codex can act on.

### User Message 3

Codex에게 먼저 보낼 준비 프롬프트:

```text
I want to build an open-source MVP called ux-sentinel.

I will paste the full product discussion into docs/PRODUCT_BRIEF.md. Use it as background context, not as an implementation checklist.

Your job is to turn the idea into a small, working, local-first TypeScript CLI MVP.

Before starting implementation:
1. Create docs/MVP_SPEC.md from the product brief.
2. Create AGENTS.md with the engineering rules.
3. Create docs/DECISIONS.md and docs/PROGRESS.md.
4. Keep scope small and demo-driven.

Important product framing:
ux-sentinel detects perception mismatches in AI-generated frontends: cases where the DOM/accessibility tree says an action exists, but the human-visible UI does not clearly communicate the next action.

Do not build a SaaS, dashboard, database, account system, hosted runner, Chrome extension, or required LLM API integration.

After creating the docs, propose the smallest implementation plan, then set the /goal I provide.
```

Operational note:

- The product discussion should live in `docs/PRODUCT_BRIEF.md`.
- `docs/PRODUCT_BRIEF.md` is background context, not the implementation checklist.
- The implementation contract lives in `docs/MVP_SPEC.md`.
- The always-on engineering rules live in `AGENTS.md`.
- The next Codex session should keep the MVP small, local-first, TypeScript-based, and demo-driven.
