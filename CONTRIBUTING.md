# Contributing

Thanks for helping out. This covers setup, the checks that will actually stop your commit, and
how a release happens.

## Setup

```bash
npm install
npm run dev        # esbuild watch -> main.js (development, unminified, inline sourcemap)
```

Point a test vault at the repo (or symlink the folder into
`<vault>/.obsidian/plugins/youtube-to-note/`) and reload the plugin to see your changes.

## Commands

| Command                     | What it does                                             |
| --------------------------- | -------------------------------------------------------- |
| `npm run dev`               | esbuild watch, development build to `main.js`.           |
| `npm run build`             | Production bundle: minified, `main.js` in the repo root. |
| `npm run type-check`        | `tsc --noEmit`.                                          |
| `npm run lint`              | ESLint over `src/` only — 0 errors expected.             |
| `npm run lint:fix`          | ESLint with `--fix`.                                     |
| `npm run format`            | Prettier over `src/**/*.ts`.                             |
| `npm run format:check`      | Prettier check (no writes).                              |
| `npm run test`              | Jest.                                                    |
| `npm run test:watch`        | Jest in watch mode.                                      |
| `npm run test:coverage`     | Jest with coverage (writes `coverage/`).                 |
| `npm run package:extension` | ZIP the Chrome extension into `dist/` for the Web Store. |
| `npm version <x.y.z>`       | Bump the plugin version (see [Releasing](#releasing)).   |

Notes:

- `main.js` is **gitignored** — it's a build artifact, produced by `npm run build` and
  published by CI. Don't commit it.
- Formatting is owned by **Prettier** (4-space, single quotes, 120 cols, trailing commas).
  Don't add an ESLint `indent` rule — it fights Prettier; that settlement is deliberate.
- `npm run lint` and `npm run format` scope to `src/`; Markdown/JSON formatting happens
  through lint-staged on the files you actually touch.

## Tests

Jest + ts-jest + jsdom. `obsidian` is mocked in `tests/__mocks__/obsidian.ts`. Tests live in
`tests/unit/`. If you touch `src/services/`, `src/ai/`, or the pipeline in `src/main.ts`, add
or extend a spec in the same change — the pipeline, the providers and the settings tab are the
thinnest-covered areas (see `AUDIT.md` → Remaining).

## Branches and commits

- Branch names: `feature/…`, `fix/…`, `chore/…`, `docs/…`.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, with an optional scope —
  `fix(transcript): …`.
- No AI-generated co-author trailers in commit messages.

## Pre-commit and pre-push hooks (they block)

`.husky/pre-commit` runs, in order:

1. `npx lint-staged` — ESLint `--fix` + Prettier on staged `ts/tsx/js/jsx`, Prettier on staged
   `json/md/yml/yaml`;
2. `npm run type-check`;
3. `npx jest`.

`.husky/pre-push` runs `npm test`.

A non-zero exit aborts the commit or push — there is no `|| echo skipped` escape hatch. If a
hook fails, fix the code (or run `npm run lint:fix` / `npm run format` and re-stage). Don't
use `--no-verify` to get past it.

CI runs the same gates plus a build on every push to `main`/`develop` and every PR, so
anything you skip locally surfaces there anyway.

## Extension (Chrome)

Plain JS, MV3, **no build step**: edit the files in `extension/chrome-extension/` directly.

- Package for upload with `npm run package:extension` → `dist/youtube-to-note-ext-<version>.zip`
  (gitignored, regenerated each time; `manifest.json` sits at the ZIP root as the store
  requires).
- The extension is versioned **independently** of the plugin: bump `version` in
  `extension/chrome-extension/manifest.json` and keep the version comment in
  `content_script.js` / `background.js` in sync. Do **not** use `npm version` for it — that
  flow targets the plugin.
- It declares **zero permissions**. If a change seems to need one, it's almost always
  avoidable — see `extension/PUBLISH.md` for why, and `PRIVACY.md` for what the extension may
  touch.
- Store submission checklist and review notes: [`extension/PUBLISH.md`](extension/PUBLISH.md).

## Releasing

The plugin is released from a tag; CI builds and publishes the assets.

1. Make sure `main` is green (CI runs lint, type-check, tests, build).
2. Update `CHANGELOG.md` — move the `[Unreleased]` entries under the new version heading.
3. Run:

    ```bash
    npm version x.y.z        # e.g. npm version 2.1.0
    git push --follow-tags
    ```

    `npm version` bumps `package.json`, then runs `version-bump.mjs`, which writes the same
    version into `manifest.json` and appends `{ "x.y.z": minAppVersion }` to `versions.json`
    (sorted, strict x.y.z validated), and stages both. It also creates the `v x.y.z` tag.

4. Pushing the `v*` tag triggers the release job, which builds and attaches `main.js`,
   `manifest.json` and `styles.css` to the GitHub release. Those three files are what users
   install.

The Chrome extension is released separately, by uploading a freshly packaged ZIP to the Web
Store — see `extension/PUBLISH.md`.

## Where known issues live

`AUDIT.md` is the running record: what was found, what's fixed (with the date and branch),
and what's deliberately left open — streaming, the ESLint 9 migration, and the smaller
accepted risks. Read its **Remaining / deferred** section before picking up work, and update
it (and `CLAUDE.md`) in the same PR that changes the code.

## Reporting issues

Open a GitHub issue with the Obsidian version, the plugin version (**Settings → YouTube to
Note**, or `manifest.json`), the provider you used, and the console output. **Never paste your
API keys** — and if you accidentally did, rotate the key at the provider.
