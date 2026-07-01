# Contributing

Thanks for helping improve `ux-sentinel`.

## Scope

This MVP is a local-first TypeScript CLI. Contributions should preserve the core product rule:

> A UI can be functionally operable but still fail human perception.

Do not add SaaS, auth, payments, cloud runner, database, Chrome extension, or required external LLM API behavior to the core MVP.

## Local Setup

```bash
npm install
npm run build
npm test
npm run demo:verify
```

## Contribution Guidelines

- Keep detectors deterministic and explainable.
- Ground findings in screenshot, screen-map, accessibility, console, network, or scenario evidence.
- Add tests for new detector behavior.
- Update `docs/DECISIONS.md` when a product or technical decision changes.
- Update `docs/PROGRESS.md` at meaningful checkpoints.
- Keep README examples current with the CLI behavior.

## Before Opening A PR

Run:

```bash
npm run build
npm test
npm run demo:verify
```
