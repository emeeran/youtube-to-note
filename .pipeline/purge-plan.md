# Phase 1 — Redundant File Purge (dry-run plan)

Generated 2026-08-05. **No files moved yet.** This is the plan for human review.
On approval (`--apply`), each `git mv` moves the file into `trash2review/<mirrored-path>`
(never deleted). Test suite re-run after every move.

Recency rule applied: nothing with a commit <30 days is moved unless it is an exact
duplicate or clearly-unrelated scaffolding.

| #   | Path                           | Reason                                                                                                                                                                                                                                         | Confidence    | Inbound refs | Last commit |
| --- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------ | ----------- |
| 1   | `src/.gitignore_1`             | Stray misnamed `.gitignore` duplicate (git never reads a `_1`-suffixed file; root `.gitignore` is the real one and is comprehensive). Pure dead weight.                                                                                        | High          | 0            | 2025-11-24  |
| 2   | `data.json.template`           | Stale — lists removed fields `openaiApiKey` + `customPrompts` that no longer exist in the settings schema. Fully superseded by `data.json.example` (accurate, current schema).                                                                 | High          | 0            | 2025-11-24  |
| 3   | `scripts/cli.sh`               | Unrelated scaffolding: a `codacy-cli-v2` installer. Has nothing to do with this Obsidian plugin; not wired into package.json/CI. Appears committed by accident.                                                                                | High          | 0            | 2025-11-24  |
| 4   | `scripts/optimizer.sh` (34 KB) | Standalone "plugin enhancement" dev script. Not invoked by any package.json script, CI step, or hook. Orphaned automation. Reversible move; confirm you don't run it manually.                                                                 | Medium        | 0            | 2025-11-24  |
| 5   | `assets/images/icon.svg`       | Byte-identical to `extension/chrome-extension/icons/icon.svg` (verified `diff -q`), and unreferenced by `manifest.json`, `esbuild.config.mjs`, or `package.json`. The extension copy is retained (it IS referenced by the extension manifest). | Medium        | 0\*          | —           |
| 6   | `CC_review_290526.md`          | Ad-hoc review notes from a prior session, now superseded by `README.md` + this pipeline's `AUDIT.md`. **Recent (<30 days: 2026-08-04)** — flagging per the recency rule rather than auto-moving. Recommend moving only if you confirm.         | Low (recency) | 0            | 2026-08-04  |

\* `icon` matches broadly (false positives); the meaningful check — referenced by
manifest/build — returned nothing.

### Deferred to Phase 3 (test padding, not redundant files)

These are `expect(true).toBe(true)` stubs that inflate the pass count (7 of the 71
tests) without testing anything. They belong to Phase 3's "remove trivial tests" pass,
not a file purge:

- `tests/unit/example.spec.ts` — explicitly labeled "This will be replaced with actual
  unit tests"; 2 no-op assertions.
- `tests/e2e/video-processing.spec.ts` — 5 stubs, each `expect(true).toBe(true)` under a
  comment describing what the test "would" do.

### Flagged for Phase 2/3 (not a file purge, but found during this pass)

- `.eslintrc.js:104,106` references `src/performance-optimizer.ts` and
  `src/end-to-end-optimizer.ts`, **neither of which exists**. Stale eslint ignore/override
  entries pointing at deleted files. Will be cleaned in Phase 2/3.

### What is explicitly NOT being moved (load-bearing despite 0 inbound-import refs)

- All `src/**` files — every one has inbound references (verified in inventory).
- Configs/entrypoints/assets that are legitimately non-imported: `manifest.json`,
  `package.json`, `tsconfig.json`, `.eslintrc.js`, `.prettierrc`, `jest.config.js`,
  `esbuild.config.mjs`, `main.js`, `styles.css`, `LICENSE`, `README.md`, `.husky/*`,
  `.github/workflows/ci.yml`, extension files (loaded by the browser, not imported).
