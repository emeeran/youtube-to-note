# CLAUDE.md — YouTube to Note (Obsidian plugin)

Reference for anyone (human or AI) working in this repo. Keep this in sync with the code.

## What this is

An Obsidian plugin (+ companion Chrome extension) that turns a YouTube video into a
structured Markdown note in the vault: fetches transcript + metadata, asks a configured AI
provider to analyze it, and saves the result. TypeScript, esbuild, MIT. Plugin and extension
are versioned independently (plugin **2.1.0**, extension **2.0.0** at the time of writing).

## Architecture (service-oriented)

Entry points all converge on `processYouTubeVideo(url, options?)` in `src/main.ts`:

```
URL detection (ribbon / command / clipboard / obsidian:// handler / file-watcher)
  -> processYouTubeVideo(url, options: ProcessRunOptions)     src/main.ts
       options = ProcessingOptions { format, model, userInstructions,
                 onProgress(stage, detail), signal } + per-run
                 provider/model/maxTokens/temperature/autoFallback
       1. duplicate check       ProcessingHistoryService.find(videoId) -> warn, never block
       2. progress('metadata')  VideoDataService   oEmbed, falling back to the watch-page
                                                 scrape on ANY oEmbed failure
       3. progress('transcript') TranscriptService.fetchTranscriptOutcome
                -> TranscriptOutcome: ok { fullText, segments, language, truncated }
                   | failure { reason: restricted|private|unavailable|no-captions|
                     network|unknown }
                hard failures (restricted/private/unavailable) abort the run with a typed
                Notice; no-captions returns { ok: true } and yields a metadata-only note
                with a warning
                caches: memory (7d) + optional disk (settings.persistTranscriptCache)
       4. progress('prompt')    PromptService      template + transcript -> prompt
                transcript is rendered with [MM:SS] markers at minute boundaries when
                settings.includeTimestamps is on, so cited times are real caption timings
                trimming to the format's budget is reported back via onTruncated
       5. progress('ai')        provider chain driven here (per-provider attribution)
                aiService.processWith(name, prompt, model, undefined, false,
                                      { signal, maxTokens, temperature })
                each request is bounded at 60s (REQUEST_TIMEOUT_MS)
       6. progress('save')      FileService        save note, conflict handling
       returns ProcessingResult (success | error | cancelled + warnings + attribution)
```

Every outcome — success, failure, cancellation — comes back as a `ProcessingResult`; the
pipeline never throws at its caller. `signal` (modal close / plugin unload) aborts in-flight
provider fetches via `AIRequestOptions.signal`. YouTube-side fetches (watch page, captions,
innertube) are bounded at 15s by `withTimeout` and honour the same signal.

Gemini providers additionally attach the YouTube URL as a `fileData` part (native
multimodal ingestion) when the model supports it. When such a media-carrying request is
rejected with an input-token-overflow 400 (a long video can exceed the model's 1M-token
input cap on server-side ingestion alone — the text prompt is capped near 40k tokens), it
is retried **once** text-only: no `fileData`, no video-analyzer `systemInstruction`, same
timeout + signal. Other 400s, already-text-only requests, and an exhausted retry keep the
detailed error. Connection-level fetch failures are wrapped by `BaseAIProvider.fetchGeneration`
as `<Provider>: network error reaching <host> — …`; aborts and timeouts keep their existing
shapes, and Ollama's unreachable copy is endpoint-aware (cloud ≠ "install local Ollama").

**Configuration validity is provider-agnostic.** `ValidationUtils.validateSettings`
(`src/validation.ts`) accepts ANY one of the five keyed providers, or env-var mode with a
non-empty `environmentPrefix`. A key whose prefix does not match its provider is returned as
a `warning` and never blocks. The settings tab's READY/SETUP badge
(`validateConfiguration`) applies the same rule — keep the two in sync.

**Batch intake** (`src/components/features/youtube/youtube-modal-utils.ts`) de-duplicates on
the extracted video id and caps a batch at `MAX_BATCH_URLS` (50); a retry seeds from the
failures only (`buildFailureRetry`), with an explicit "Retry all" alongside it. `ModalManager`
refuses a second concurrent modal.

## Where things live

- `src/main.ts` — plugin class, `processYouTubeVideo`, settings load (incl. legacy key migration).
- `src/types.ts` — shared contracts: `ProcessingOptions`/`ProcessStage`, `ProcessingResult`,
  `TranscriptOutcome`, `AIRequestOptions`, `TranscriptSegment`.
- `src/services/youtube-page.ts` — proxy-free watch-page fetch + brace-balanced
  `ytInitialPlayerResponse` parser (shared by transcript + metadata), and the innertube
  ANDROID fallback used for age-restricted videos (15s timeout).
- `src/services/transcript-service.ts` — `fetchTranscriptOutcome`: caption-track selection,
  playability classification, timedtext parsing (both `<text>` and `<t>` shapes), a
  150k-char source ceiling, and the innertube retry for restricted videos.
- `src/services/transcript-cache.ts` — opt-in on-disk transcript cache
  (`<plugin dir>/cache/transcripts/<videoId>.<lang>.json`, 7-day TTL, best-effort). Entries
  are shape-validated on read (a malformed file is a miss and is deleted), writes go to a
  unique temp file before an atomic rename, and the cache is pruned to
  `TRANSCRIPT_CACHE_MAX_FILES` (200) after each write.
- `src/services/prompt-service.ts` — prompt assembly (role-first, transcript-last; shared
  rules in `SHARED_OUTPUT_RULES`), per-format transcript budgets,
  `buildMinuteMarkedTranscript` (the `[MM:SS]` markers that make cited timestamps real),
  `[MM:SS](url&t=…)` timestamp links, deterministic transcript index for
  complete-transcription, `onTruncated` reporting with real numbers, `customPrompts` override
  resolution. `processAIResponse` assembles the finished note deterministically — frontmatter,
  embed, thumbnail and `## Source` are never left to the model, and `## Resources` /
  `## Source` are de-duplicated case-insensitively.
- `src/services/ai-service.ts` — provider map, `processWith` (restores the provider's model
  in `finally`), live `listModels` with a 1h cache. Generation parameters are per-request:
  `maxTokens`/`temperature` ride on `AIRequestOptions` rather than mutating shared provider
  singletons.
- `src/services/processing-history.ts` — history + `withPluginDataLock`, the write mutex
  shared with `saveSettings`.
- `src/services/service-container.ts` — constructs providers; resolves keys via SecureConfigService.
- `src/ai/*` — one client per provider, all extend `BaseAIProvider` (`base.ts`);
  `src/ai/error-utils.ts` holds the shared `sanitizeRemoteMessage` / `createAbortSignal` /
  `MODEL_LIST_TIMEOUT_MS` (15s) / `REQUEST_TIMEOUT_MS` (60s) helpers.
- `src/components/features/youtube/youtube-url-modal.ts` — the main UI modal (multi-URL,
  stage checklist, retry-failures-only, partial-success links, attribution);
  `youtube-modal-utils.ts` holds its DOM-free helpers (`MAX_BATCH_URLS`, `buildFailureRetry`,
  `failedUrlsOf`, the keyboard/timing helpers).
- `src/settings-tab.ts` — settings UI incl. per-format prompt template editors.
- `src/templates/`, `src/constants/` — format templates (built-in + `FORMAT_META`), messages.
- `extension/chrome-extension/` — MV3 extension (plain JS, no build step), **zero
  permissions** (no `permissions`, no `host_permissions`).

## Conventions

- **Formatting:** prettier (4-space, single-quote, 120, trailing-comma all) + eslint.
  Indentation is owned by **prettier** — do not add an eslint `indent` rule (it conflicts;
  see commit history). Run `npm run lint` / `npm run format`.
- **Error handling:** throw `Error` (+ `ErrorHandler.handle` for user-facing Notices); `null`
  returns only at fetch boundaries. Do not swallow errors silently — log at minimum.
- **Naming:** `Service` / `Handler` / `Utils` suffixes are the established convention — match it.
- **UI voice:** emoji-rich (the codebase's intentional tone) — keep it, don't strip it.
- **Network:** use Obsidian's `requestUrl` (CORS-free) for YouTube fetches; `fetch` is fine
  for provider APIs. New fetches get a timeout (`withTimeout` for `requestUrl`,
  `BaseAIProvider.fetchWithTimeout` for `fetch`) and honor `AIRequestOptions.signal`.
- **Security:** keys via header not URL query; sanitize remote error text via
  `sanitizeRemoteMessage` (in `src/ai/error-utils.ts`) before embedding it in thrown Errors;
  never `innerHTML` untrusted strings (use `textContent` / `DOMParser`); YAML values via
  `escapeYamlScalar`, HTML attributes via `escapeHtmlAttr`; never log raw protocol params.

## Commands

```
npm run dev               # esbuild watch
npm run build             # production bundle -> main.js (minified, untracked)
npm run type-check        # tsc --noEmit
npm run lint              # eslint (src only, 0 errors expected)
npm run lint:fix          # eslint --fix
npm run format            # prettier --write src/**/*.ts
npm run format:check      # prettier --check
npm run test              # jest
npm run test:coverage     # jest --coverage
npm run package:extension # ZIP the Chrome extension -> dist/
npm run version           # version-bump.mjs; run via `npm version <x.y.z>`
```

CI (`.github/workflows/ci.yml`) runs `test` → `build` → `release` plus `package-extension`,
under a top-level `permissions: contents: read` (only the tag-gated release job opts back
into `contents: write`) and a per-ref `concurrency` group. The test job lints, type-checks,
tests with coverage, and dry-runs `version-bump.mjs` asserting no diff. The release job
refuses to publish unless the tag, `package.json` and `manifest.json` versions all agree.
`package-extension` builds the ZIP and fails unless `manifest.json` sits at its root.

## Testing

Jest + ts-jest + jsdom. **16 suites, 430 tests** (snapshot of `npx jest` on 2026-09-09 —
re-run it for the current count before quoting it; a parallel agent may be adding specs).

- `tests/unit/pipeline.spec.ts` (38) — `processYouTubeVideo` end-to-end, incl. aggregate
  failure attribution and the per-provider reason caps (240 chars / 1500 total)
- `tests/unit/ai-providers.spec.ts` (62) — all six `src/ai/*` clients, incl. the Gemini
  text-only overflow retry, network-error wrapping, Ollama/HF error copy, and the HF
  router-v1 request/response shapes plus its live `listModels` filter
- `tests/unit/url-parity.spec.ts` (52) — plugin vs extension URL acceptance
- `tests/unit/youtube-modal-utils.spec.ts` (32) — batch parse/dedupe/cap, failure retry
- `tests/unit/services/transcript-outcome.spec.ts` (33) — typed failures + innertube fallback
- `tests/unit/obsidian-mock.spec.ts` (32) — the shared Obsidian mock's own contract
- `tests/unit/services/prompt-timestamps.spec.ts` (24) — minute markers, timestamp links,
  transcript index
- `tests/unit/validation.spec.ts` (22) — any-provider rule, key-format warnings, caps
- `tests/unit/tier0-regressions.spec.ts` (22) — fixed-regression guard
- `tests/unit/services/url-handler.spec.ts` (19) — URL/protocol/file intake
- `tests/unit/obsidian-file.spec.ts` (17) — save/conflict/path handling
- `tests/unit/secure-config.spec.ts` (30) — key resolution + legacy migration
- `tests/unit/services/youtube-page.spec.ts` (19) — player-response parsing
- `tests/unit/prompt-formats.spec.ts` (13) — per-format prompt assembly
- `tests/unit/services/ai-service.spec.ts` (8) — provider chain, model restore, fallback
- `tests/unit/services/transcript-service.spec.ts` (8) — track selection + timedtext parsing

Still untested when you touch them: `settings-tab.ts` and the `video-data.ts` metadata path.

## Gotchas

- `data.json` is gitignored (holds live API keys + processing history) — never commit it.
  `data.json.example` is the documented template.
- API keys are stored **plaintext** in `data.json` by design (standard Obsidian practice).
  Legacy obfuscated values from older versions are auto-migrated to plaintext on load.
  Env-var-only mode (`useEnvironmentVariables`, `YTC_*` prefix) keeps keys off disk.
- **Husky hooks are enforced** — pre-commit runs lint-staged + `type-check` + `jest`, pre-push
  runs `npm test`, and a failure blocks the operation. No `|| echo skipped` suppression.
- `main.js` is **gitignored/untracked** — it is a build artifact, published by CI on a `v*` tag.
- The transcript disk cache lives at `<vault>/.obsidian/plugins/youtube-to-note/cache/transcripts/`,
  is **off by default** (`persistTranscriptCache`), survives plugin reload, and is emptied by
  the `Clear transcript cache` command.
- `saveSettings` and `ProcessingHistoryService` both write the whole `data.json`; they share
  `withPluginDataLock`. Any new writer of plugin data must join that lock.
- The aggregate "All AI providers failed — …" message caps per-provider reasons at
  `MAX_PROVIDER_REASON_CHARS` (240) and the join at `MAX_AGGREGATE_ERROR_CHARS` (1500,
  word-boundary trimmed) — both in `src/main.ts`. If provider error copy grows, raise the
  constants rather than re-slicing at call sites.
- Known open/deferred items live in `AUDIT.md` (token streaming, ESLint 9 flat config,
  TypeScript 5.3.3, the `setApiKey` field-name masking dead path, `MemoryCache` FIFO
  eviction, 51 remaining inline `style.*` writes, extension verification on
  music.youtube.com). Fixed in earlier passes and no longer open: `/live/` URL intake
  (the validator has a `live` pattern — the extension still normalises to `watch?v=` for the
  other shapes), any-provider validation, the truncation-copy figures, and the extension
  observer lifecycle.
- The innertube ANDROID client version is pinned as `INNERTUBE_ANDROID_CLIENT_VERSION` in
  `src/services/youtube-page.ts`. When YouTube eventually stops serving player responses to
  it, bump that constant — the warn log beside it says so.
