# Release Checklist

This checklist prepares `ux-sentinel` for a GitHub-only `v0.1.0` release.

## Policy

- Do not publish to npm for `v0.1.0`.
- Do not implement new features during release prep.
- Do not change detector behavior unless a release-blocking bug is found.
- Use GitHub `npm exec` as the stable no-install path.
- Keep `#main` documented only as the latest-development path.

## Pre-Release Checks

Run from the repository root:

```bash
npm run build
npm test
npm run demo:verify
npm pack --dry-run
```

Confirm:

- README explains the project in under 30 seconds.
- README stable commands use `github:jk06095-lang/ux-sentinel#v0.1.0`.
- `docs/CODEX_MAGIC_PROMPT.md` uses the `#v0.1.0` stable runner.
- `#main` is only presented as the latest-development path.
- Broken demo fails for the perception mismatch reason.
- Fixed demo passes.
- `RELEASE_NOTES.md` is ready.
- npm publish remains deferred.

## Create The Tag

Do this only after the release gate passes and the maintainer confirms the release.

```bash
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

## Create The GitHub Release

```bash
gh release create v0.1.0 --title "ux-sentinel v0.1.0" --notes-file RELEASE_NOTES.md
```

## Post-Release Smoke

From a clean target frontend repo, run:

```bash
npm exec --yes --package=github:jk06095-lang/ux-sentinel#v0.1.0 -- ux-sentinel --help
npm exec --yes --package=github:jk06095-lang/ux-sentinel#v0.1.0 -- ux-sentinel init
npm exec --yes --package=github:jk06095-lang/ux-sentinel#v0.1.0 -- ux-sentinel run .ux-sentinel/scenarios/onboarding-empty-state.yaml --url http://localhost:3000
```

If GitHub `npm exec` fails, use the documented temporary clone fallback from README.

## npm Publish Decision

npm publish is deferred for `v0.1.0`.

Revisit npm publishing after:

- GitHub Release `v0.1.0` is live.
- The no-install Codex prompt has been tried in 2-3 external projects.
- Windows and macOS/Linux usage have both been checked.
- The package name `ux-sentinel` is confirmed as the long-term name.
- npm account ownership, 2FA, and provenance workflow are ready.

Suggested future command, not for `v0.1.0`:

```bash
npm publish --provenance --access public
```
