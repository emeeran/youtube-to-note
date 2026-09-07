# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- Next release: 2.2.0 (plugin + extension are versioned independently; see
     CONTRIBUTING.md for the release flow and extension/PUBLISH.md for the extension). -->

## [Unreleased]

A second hardening pass over v2.1.0. IDs refer to the 2026-09-07 audit ledger
(`local/improvement-report-2026-09-07.md`, summarised in `AUDIT.md`).

### Added

- **Any provider unlocks the plugin.** An API key for _any_ of Gemini, Groq, OpenRouter,
  Hugging Face or Ollama Cloud is now sufficient — previously only Gemini or Groq counted, so
  an OpenRouter-only setup was refused outright. Environment-variable mode with a prefix
  qualifies too. _(H2.)_
- **"Environment variable prefix" settings field.** The prefix keys are read under
  (default `YTC`) was load-bearing but reachable only by hand-editing `data.json`; it now sits
  directly under the _Env Variables_ toggle. _(M12.)_
- **Real timestamp citations.** When _Include timestamp links_ is on, the transcript handed to
  the model carries an inline `[MM:SS]` marker at each minute boundary, so the times it cites
  are actual caption timings instead of plausible inventions. One marker per minute bounds the
  size cost. Complete Transcription's deterministic index is unchanged. _(H1.)_
- **Retry re-runs only what failed.** After a partial batch failure, 🔄 Retry seeds from the
  failed URLs and leaves notes that already saved alone, with a label saying how many are
  left ("Retry 3 failed"); 🔁 **Retry all** is a separate, explicit button. The successful
  notes stay visible above the error as clickable links. _(H4.)_
- **Batch guardrails.** Repeated videos in one paste are collapsed to a single run (first
  spelling wins), and a batch is capped at **50 URLs** — anything past that is counted and
  reported rather than silently queued as paid runs. _(M11.)_
- **A second modal is refused.** Opening the modal from the ribbon, a command or the clipboard
  while one is already open shows a Notice instead of stacking a second run.
- **Key-safe settings export.** 📤 Export strips every API key from the JSON, and 📥 Import
  takes a key from the file only when it carries a non-empty value — so a key-free export can
  never blank the keys already stored in `data.json`. _(H5.)_
- **Per-format prompt overrides are capped at 20,000 characters** (enforced by the textarea
  and re-checked as a validation error for imported or hand-edited values) **and saved on a
  500 ms debounce** instead of rewriting all of `data.json` on every keystroke. _(H6.)_
- **Live validation feedback in settings.** Errors and warnings render into an in-place banner
  and the header badge, and an invalid edit is not persisted. _(H2, M12.)_
- **CI hardening.** A per-ref `concurrency` group cancels superseded runs; a
  `package-extension` job builds the ZIP and fails unless `manifest.json` sits at its root;
  the release job verifies tag = `package.json` = `manifest.json` before publishing; and the
  test job dry-runs `version-bump.mjs` asserting it produces no diff. Top-level
  `permissions: contents: read`, with only the tag-gated release job opting into write.
  _(H7, M18.)_
- Test suite grew from **12 suites / 268 tests** to **16 suites / 408 tests** (snapshot of
  `npx jest` on 2026-09-07), adding `processYouTubeVideo` pipeline coverage, all six AI
  providers, the validation rules and the modal's batch helpers.

### Changed

- **Unusual key formats are warnings, not errors.** A key whose prefix does not match its
  provider is reported in a banner and never blocks a run — gateways, proxies and rotated
  formats are legitimate. The READY/SETUP badge follows the same any-provider rule. _(H2.)_
- **Every AI request is bounded at 60 seconds** (`REQUEST_TIMEOUT_MS`), so a hung provider can
  no longer pin a run. _(M2.)_
- **Generation parameters are per-request.** `maxTokens` and `temperature` travel on
  `AIRequestOptions` rather than mutating shared provider singletons, so two concurrent runs
  cannot clobber each other's settings.
- **YouTube fetches are bounded and cancellable.** Watch-page, caption and innertube requests
  run under a 15s `withTimeout` and honour the run's abort signal, which is now threaded
  through the metadata, transcript and save stages. _(M3.)_
- **Metadata survives an oEmbed outage.** Any oEmbed failure falls back to the watch-page
  scrape; only when both fail does the run error, and it surfaces the more descriptive of the
  two. _(M6.)_
- **The background transcript prefetch is gone.** It duplicated the pipeline's own fetch,
  unabortably, for every video under 30 minutes. _(M7.)_
- **The transcript disk cache is hardened.** Paths derive from the vault config directory that
  is actually written (previously a junk `<vault>/youtube-to-note/cache` could appear), writes
  go to a unique temp file before an atomic rename, entries are shape-validated on read so a
  malformed file is a miss rather than a crash, and the cache is pruned to **200 files**.
  _(M4.)_
- **Truncation warnings state the real numbers.** PromptService reports the trim it actually
  applied through an `onTruncated` callback, and the copy is derived from it — e.g. "trimmed
  to the first 120,000 of 145,000 characters for this format" — or the 150,000-character
  source ceiling when that is what fired. The stale hardcoded "100,000" is gone.
  _(M1, H1.)_
- **The extension's injected-button observer disarms itself** once the button sits on a stable
  URL, and is re-armed by `yt-navigate-finish` or a 1.5s watchdog — previously a body-wide
  `MutationObserver` ran six `querySelector`s per mutation batch for the life of the page.
  Retry chains are per navigation instead of sharing one budget. The zero-permission claim is
  unchanged. _(M15.)_
- **Styling moved toward Obsidian's guidelines.** Hardcoded colours became CSS variables, the
  shared modal family became CSS classes, and a mobile breakpoint was added to a plugin that
  declares `isDesktopOnly: false`. _(M14 — partially; 51 inline `style.*` writes remain.)_

### Fixed

- **Documentation no longer claims a caption-less video produces no note.** The behaviour has
  always been split: hard failures (restricted, private, unavailable) stop the run, while a
  video that merely has no captions still produces a metadata-only note with a warning.
  `README.md` and `USER_MANUAL.md` said otherwise. _(M16.)_
- **A leading `---` rule is no longer mistaken for frontmatter**, which had skipped the
  deterministic header and let `ai_provider:` be injected under a horizontal rule. The opening
  block must now look like YAML. _(H3.)_
- **`## Resources` / `## Source` are de-duplicated** case-insensitively, so a custom prompt can
  no longer produce two of either or suppress attribution. _(M5.)_
- **Modal interaction fixes.** `Enter` in the instructions textarea no longer starts a run, the
  copy-path shortcut yields to `Ctrl+C` with text selected, and every timer is tracked and
  cleared through one owner. _(M8.)_
- **The video preview no longer refires a bare `fetch` on every keystroke.** It goes through
  `requestUrl` under a 10s timeout with a monotonic token that drops stale answers.
  _(M10.)_
- **Dead modal options removed** (`defaultModel`, `defaultProvider` and friends were passed
  in and never read). _(M13.)_
- **`data.json` is no longer logged verbatim** at debug level — a redacted summary logs which
  credentials are set and the names, never the values, of everything else.
- **Server-controlled `statusText` is sanitized** on the Ollama and error-handler paths before
  it can reach a Notice.
- **The innertube ANDROID `clientVersion` is pinned and labelled** (`19.09.37`, with a warn log
  telling the next reader to bump it) and the caption `baseUrl` fetch is host-allowlisted, so
  the age-gate fallback degrades loudly instead of silently.
- **Release hygiene.** The changelog section for 2.1.0 actually exists, `.claude/settings.local.json`
  is untracked and gitignored, and lint-staged no longer has a glob that would prettier-format
  the generated `main.js`. _(H7, H8.)_

## [2.1.0] - 2026-09-07

### Added

- **Pipeline v2 options bag.** `processYouTubeVideo(url, options?)` accepts a
  `ProcessingOptions` object: `format`, `model`, `userInstructions`, an `onProgress` callback
  and an abort `signal`. Every outcome — success, failure, cancellation — comes back as a
  `ProcessingResult` instead of throwing.
- **Honest progress UI.** A stage checklist (📡 Metadata → 📝 Transcript → 🧠 AI → 💾 Save)
  driven by the pipeline itself, an elapsed timer, and a Cancel that aborts the in-flight
  provider request via `AIRequestOptions.signal`.
- **Multi-URL batch input.** Paste several YouTube URLs (spaces, commas, semicolons or new
  lines); they are processed sequentially with a per-URL summary
  (`✅ 4 created · ⚠️ 1 duplicate · ❌ 1 failed`) and per-note attribution.
- **Typed transcript failures.** `fetchTranscriptOutcome` reports _why_ a transcript is
  missing — restricted / private / unavailable / no-captions / network / unknown — and each
  reason gets its own Notice. Hard failures (restricted, private, unavailable) stop the run;
  a video that merely has no captions still produces a metadata-only note, with a warning.
- **Innertube fallback for restricted videos.** Age-restricted videos are retried once through
  YouTube's innertube ANDROID player endpoint (no API key, 15s timeout) before giving up.
- **Timestamp links** (`includeTimestamps`, default on). Key claims are cited as
  `[MM:SS](url&t=seconds)` deep links built from real caption timings; Complete Transcription
  gets a deterministic `## Timestamped Transcript` index generated from the same timings
  rather than reconstructed by the model.
- **Duplicate detection** (`warnOnDuplicates`, default on). A video that was processed before
  is flagged — with the date and a link to the earlier note — before any AI work is spent.
- **Provider attribution.** The completion screen shows which provider and model actually
  produced the note, plus which providers failed on the way (`↩️ Fell back from: …`).
- **Retry and Copy error** buttons on a failed run; Retry re-runs the exact submission
  (same URLs, format, model and instructions).
- **Per-format prompt overrides** (`customPrompts`). Each output format gets a settings editor;
  a non-empty value replaces that format's template body, blank keeps the built-in one.
  User instructions survive across runs with an explicit ✖ Clear button.
- **Transcript truncation warnings** surfaced in the completion UI.
- **Optional on-disk transcript cache** (`persistTranscriptCache`, default off). Transcripts
  persist under `<plugin dir>/cache/transcripts/` (7-day TTL, best-effort, desktop-only) so an
  Obsidian reload does not re-fetch YouTube.
- **New command:** `Clear transcript cache`.
- `CONTRIBUTING.md` and this `CHANGELOG.md`; `data.json.example` extended with the new keys.

### Changed

- **Prompt system overhauled.** Prompts now lead with the role + output contract and put
  metadata + transcript LAST, so the model's attention lands on the source material right
  before generation. Rules that were duplicated across per-mode base templates and all
  seven format templates are factored into one shared rules block, which gained guardrails:
  no code-fence wrapping, replace every bracketed placeholder, write "Not covered in the
  video." instead of inventing facts, handle `[transcript truncated]` honestly, and match
  the video's language. Mermaid skeletons are labelled as examples the model must replace.
  `complete-transcription` now restructures the supplied caption transcript faithfully
  instead of pretending to watch the video.
- **Notes are assembled deterministically.** YAML frontmatter, the video embed, the
  thumbnail and the `## Source` attribution are generated by the plugin _after_ the AI
  responds, from known-good values — the model can no longer mangle frontmatter, forge
  attribution, or waste tokens echoing structural markup (it is now told not to emit it).
- **Chrome extension requests zero permissions.** `permissions` and `host_permissions` are
  gone (`activeTab` included): the content script reads `location.href` itself and the service
  worker is a pure relay.
- **Extension page coverage.** Videos are recognised on `/watch`, `/shorts/`, `/embed/`,
  `/live/` and `music.youtube.com`; every URL is normalised to a canonical
  `https://www.youtube.com/watch?v=ID` because the plugin's validator does not accept every
  shape. The playback timestamp is preserved and all other parameters are dropped. Stale
  buttons are removed on SPA navigation, and the confirmation toast now says honestly that it
  only confirms the hand-off.
- **CI reworked.** Releases are tag-gated on `v*` and publish `main.js`, `manifest.json` and
  `styles.css` as release assets; `actions/upload-artifact` and `codecov/codecov-action` are on
  v4.
- **Release tooling restored.** `version-bump.mjs` is back (strict x.y.z validation, sorted
  `versions.json`), so `npm version x.y.z` updates `package.json`, `manifest.json` and
  `versions.json` in one step.
- `obsidian` pinned to `1.10.3` and `jest-environment-jsdom` to `^29.7.0` for reproducible CI.
- `main.js` is now an untracked build artifact (gitignored) rather than a committed file.
- README and user manual rewritten against the current code, including a settings reference
  that lists every key that actually exists.
- Test suite grew from 5 suites / 63 tests to **7 suites / 101 tests**, adding typed
  transcript outcomes, prompt timestamp logic, and prompt-template override coverage.

### Fixed

- **Git hooks no longer swallow failures.** `.husky/pre-commit` (lint-staged, type-check,
  jest) and `.husky/pre-push` (jest) exit non-zero and actually block. _(AUDIT blocker B1.)_
- **Modal timer leak closed.** The 100ms elapsed timer is cleared in `onClose`, so closing the
  modal mid-process no longer leaves an interval running against a destroyed DOM.
  _(AUDIT blocker B2.)_
- **Gemini key test no longer puts the key in the URL.** The settings "Test" button sends
  `x-goog-api-key` as a header, matching the production provider. _(AUDIT blocker B3.)_
- **`processWith` restores the provider's model** in a `finally`, so a one-off model override
  no longer leaks into later runs. _(AUDIT High.)_
- **`data.json` write race.** History and settings writes are serialized through
  `withPluginDataLock`, so neither can silently revert the other. _(AUDIT High.)_
- **`listModels()` timeouts.** All four providers bound their model-list requests at 15s via
  `BaseAIProvider.fetchWithTimeout`. _(AUDIT High.)_
- **Remote error text is sanitized** before it reaches a Notice in the Hugging Face, Gemini
  and error-handler paths — no more multi-line content injected by a hostile endpoint.
  _(AUDIT High.)_
- **Video title is escaped** before it is written into YAML frontmatter
  (`escapeYamlScalar`) and the iframe `title` attribute (`escapeHtmlAttr`), so a title
  containing `"` or `:` can no longer break frontmatter or the embed.
- **Plugin version is read from `manifest.json`** instead of a hardcoded `1.3.5` constant.
- **Protocol-handler hardening.** URLs longer than 2048 characters are rejected and only the
  extracted video id is logged — never the raw, attacker-controlled `params`.
- **`ensureDirectoryExists` rethrows** everything except "already exists", so permission and
  path failures reach the user.
- **Clipboard paste extracts URLs** out of surrounding prose instead of requiring the
  clipboard to contain nothing but a link.
- **`video-data.ts` background refresh no longer mutates** the result object already handed to
  the caller; it re-caches a copy. _(AUDIT High.)_

### Removed

- `trash2review/` and `.pipeline/` (the holding pen and the cleanup scaffolding, including the
  dead Express server that had been parked there).
- The `customTimeouts` setting — it was never read.
- The unused `PAGE_TIMEOUT_MS` / `CAPTION_TIMEOUT_MS` constants in `youtube-page.ts`.
- The hardcoded `PLUGIN_VERSION` constant in `main.ts`.
- `extension/chrome-extension/options.js` — an empty stub; the Options page is static HTML.
- The extension's hidden-iframe protocol hand-off, replaced by a top-level navigation
  (Chrome increasingly blocks subframe protocol launches).

### Security

- Extension manifest now declares **no permissions and no host permissions**; the privacy
  policy and the store notes were updated to match.
- API keys travel in request headers only — the last key-in-URL path (the settings Gemini
  test) is closed.
- Server-controlled error text is length-capped and stripped of newlines/control characters
  (`sanitizeRemoteMessage`) before it can reach an Obsidian Notice.
- Network-controlled video metadata is YAML- and HTML-attribute-escaped before it is written
  into generated notes.
- The `obsidian://` protocol handler bounds its input (2048 chars) and no longer logs raw
  parameters.
- API keys remain **plaintext in `data.json` by design** (standard Obsidian practice) —
  documented as an accepted risk in `AUDIT.md`; `YTC_*` environment variables are available if
  you want them off disk entirely.

[2.1.0]: https://github.com/emeeran/youtube-to-note/compare/v1.4.0...v2.1.0
[Unreleased]: https://github.com/emeeran/youtube-to-note/compare/v2.1.0...HEAD
