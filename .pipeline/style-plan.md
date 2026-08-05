# Phase 3 — Authorship & Style Consistency (dry-run plan)

Generated 2026-08-05. **No edits made yet.**

## Detected conventions (MATCH these — do not change)

The codebase already has a strong, internally consistent voice. Per the pipeline rule
"match existing conventions, don't impose new ones," these are confirmed and left alone:

- **Formatter:** prettier (`tabWidth 4`, `singleQuote`, `printWidth 120`, trailing comma
  `all`) + eslint (`indent 4`, same quote/semi/comma rules). This IS the standard.
- **Error-handling philosophy:** throw `Error` + `ErrorHandler.handle(...)` for user-facing
  surfacing; `null` returns only at fetch boundaries (e.g. `getTranscript`). Consistent now
  that the unused `Result` type was retired in Phase 2. No change.
- **Voice:** emoji-rich UI/notice tone — `🎬🔑🤖⚡✅⭐📂🔒` across `settings-tab.ts`,
  `youtube-url-modal.ts`, `constants/messages.ts`. This is the established human-written
  tone, so it is KEPT (the "strip AI emoji" rule does not apply when precedent uses emoji).
- **Naming:** `Service` / `Handler` / `Utils` / `Manager` suffixes are the project's
  convention (`AIService`, `UrlHandler`, `ValidationUtils`, `ModalManager`). Consistent —
  no renames (renaming would impose a new convention, the opposite of the goal).
- **Structure:** `services/`, `ai/`, `components/{common,features}/`, `constants/`,
  `templates/`, `types/`. Justified for a ~10k-LOC multi-provider plugin — not enterprise
  over-layering. No flattening.
- **Docstrings:** JSDoc `/** ... */` throughout. Consistent.

## Actions (apply on `--apply`)

### C1. Stale eslint `ignorePatterns` (config hygiene)
`.eslintrc.js:103–114` ignores 11 source files that **no longer exist** — leftovers from a
larger earlier codebase (`performance-optimizer.ts`, `security-hardener.ts`, `agent-*.ts`,
`optimized-ai-service.ts`, `main-original.ts`, `main-refactored.ts`, `video-optimization.ts`
[note: the real one lives at `src/constants/`], etc.). All 11 verified absent.
**Action:** delete those 11 lines; keep `node_modules/`, `dist/`, `build/`, `coverage/`,
`*.js` / `!*.config.js`, `tests/**/*`.

### C2. Trivial test padding → trash2review
- `tests/unit/example.spec.ts` — 2 no-op tests ("verify Jest is configured" /
  `expect(message).toBe('Hello, tests!')`). Explicitly labeled "will be replaced".
- `tests/e2e/video-processing.spec.ts` — 5 stubs, every one `expect(true).toBe(true)`
  under a comment describing what the test "would" do.
**Action:** `git mv` both to `trash2review/`. Suite drops 71 → 64 real tests, 7 → 5 files.
The removed tests assert nothing, so coverage is unchanged.

### C3. Formatting sweep
4 test files are not prettier-conforming: `tests/__mocks__/obsidian.ts`,
`tests/fixtures/video-data.fixtures.ts`, `tests/unit/services/url-handler.spec.ts`,
`tests/utils/test-helpers.ts`.
**Action:** `prettier --write` those (and confirm the whole tree). Mechanical, no behavior
change. (Source files already conform.)

### C4. No-op (documented)
No renames, no emoji stripping, no structural flattening — see "Detected conventions" above.

## Verification (on `--apply`)
`npx prettier --check`, `npx eslint src --ext .ts` (0 errors), `npx tsc --noEmit`,
`npx jest`, `npm run build`.

## Applied (2026-08-05)

C1–C3 applied; all checks green (eslint 0 errors, prettier 0 non-conforming, tsc OK,
64 tests / 5 suites, build OK).

- C1: removed 11 stale `.eslintrc.js` ignorePatterns for non-existent files.
- C2: moved `tests/unit/example.spec.ts` and `tests/e2e/video-processing.spec.ts`
  (7 no-op assertions) to `trash2review/`. Suite 71 → 64 real tests; coverage unchanged.
- C3: prettier-formatted 4 non-conforming test files.
- **Conflict fix (discovered during C3):** the repo had eslint's `indent` rule AND
  prettier both controlling indentation, and the husky hook runs prettier last — so
  committed code was prettier-formatted but eslint-non-conforming (10 `indent` errors
  → CI-red on the prior commits). Removed the explicit `indent` rule from `.eslintrc.js`;
  prettier is now the single indentation authority (it already was, via husky). Tried
  `eslint-config-prettier` but reverted it — unnecessary, since neither recommended
  preset enables `indent` and the dependency added lockfile churn for no benefit.

No renames, emoji stripping, or structural flattening — the codebase's existing voice
(emoji-rich UI, Service/Handler/Utils naming, justified layering) is consistent and was
matched, not changed.

