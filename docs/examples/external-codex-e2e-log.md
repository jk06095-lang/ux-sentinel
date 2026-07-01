# External Codex E2E Log

This is a real smoke log from running `ux-sentinel` against a temporary frontend repository outside this repo. The local user directory is redacted as `%TEMP%`.

The target repository was:

```text
%TEMP%\ux-sentinel-target-49292f804f774788abd5d38ed21c9660
```

The temporary target app served `/dashboard` from a local `page.html` file.

The run used the GitHub no-install path from the target repo root. First, the target app served the broken empty-state HTML:

```bash
npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel init
npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel run .ux-sentinel/scenarios/onboarding-empty-state.yaml --url http://127.0.0.1:4871
```

Then `page.html` was replaced with the fixed empty-state HTML and the same scenario was rerun against the same URL:

```bash
npm exec --yes --package=github:jk06095-lang/ux-sentinel#main -- ux-sentinel run .ux-sentinel/scenarios/onboarding-empty-state.yaml --url http://127.0.0.1:4871
```

## Result

```text
TARGET_REPO=%TEMP%\ux-sentinel-target-49292f804f774788abd5d38ed21c9660
INIT_EXIT=0
BROKEN_EXIT=1
BROKEN_REPORT=%TEMP%\ux-sentinel-target-49292f804f774788abd5d38ed21c9660\.ux-sentinel\reports\onboarding-empty-state-2026-07-01T05-50-56-046Z.md
BROKEN_VERDICT=- result: fail
FIXED_EXIT=0
FIXED_REPORT=%TEMP%\ux-sentinel-target-49292f804f774788abd5d38ed21c9660\.ux-sentinel\reports\onboarding-empty-state-2026-07-01T05-51-01-009Z.md
FIXED_VERDICT=- result: pass
TRACE_DIR_COUNT=2
```

## What This Proves

- `npm exec --package=github:jk06095-lang/ux-sentinel#main` works from another repository.
- `ux-sentinel init` writes `.ux-sentinel` into the target frontend repo.
- The broken empty-state page fails with a perception mismatch.
- The fixed page passes the same scenario.
- Reports and traces are written under the target repo, not the tool repo.

For the temporary clone fallback, build `ux-sentinel` in the temporary tool directory, then `cd` back to the target repo before running `node /tmp/ux-sentinel/dist/cli.js`. Reports and traces are written relative to the current working directory.
