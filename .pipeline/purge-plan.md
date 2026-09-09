# Purge Plan — dry run, 2026-09-09 (branch cleanup/pipeline-2026-09-09)

**Result: zero candidates.** No tracked file qualifies for relocation. Evidence per
category:

## 1. Exact / near-duplicate files

- `md5sum` over all 104 tracked files: **no duplicate content hashes**.
- Same-size scan over `src/` + extension: one collision pair, both barrel `index.ts`
  re-export files — expected, not duplicates.

## 2. Orphaned files (zero inbound references)

The inventory grep flagged 27 files with 0 grep-visible inbound refs. Every one is
referenced by tooling rather than by imports:

- 16 `tests/unit/**/*.spec.ts` — picked up by jest `testMatch: '**/*.(test|spec).+...'`
- 8 root/config docs (`AUDIT/CHANGELOG/CLAUDE/CONTRIBUTING/USER_MANUAL/LICENSE`,
  `.eslintrc.js`, `tsconfig.json`) — tool entry points and docs
- `scripts/package-extension.sh` ← `npm run package:extension` ← CI
- `version-bump.mjs` ← `npm run version` + CI dry-run
- `esbuild.config.mjs`, `jest.config.js`, `.husky/*`, `package-lock.json` — build/test/CI
- `extension/PUBLISH.md` — extension-store docs

**All 46 `src/**` files have ≥1 inbound reference.\*\*

## 3. Superseded generations

- No tracked file matches `_old|copy|backup|legacy|deprecated|~|.bak|v\d`.
- `src/` layout is single-generation (46 files, listed in inventory.csv).

## 4. Build/cache artifacts accidentally committed

- None tracked. `main.js`, `coverage/`, `node_modules/`, `dist/`, `local/`,
  `.auto-claude/` are all already covered by `.gitignore` — regenerable or local-only,
  nothing to untrack.

## Conclusion

No `git mv` operations proposed. `trash2review/` stays empty; its README documents
restoration for future passes. If a later phase's audit surfaces a dead-file candidate,
it gets appended here and moved at that point.
