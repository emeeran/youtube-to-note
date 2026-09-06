# CLAUDE.md — YouTube to Note (Obsidian plugin)

Reference for anyone (human or AI) working in this repo. Keep this in sync with the code.

## What this is

An Obsidian plugin (+ companion Chrome extension) that turns a YouTube video into a
structured Markdown note in the vault: fetches transcript + metadata, asks a configured AI
provider to analyze it, and saves the result. TypeScript, esbuild, MIT. Plugin and extension
are both at **2.0.0** and versioned independently.

## Architecture (service-oriented)

Entry points all converge on `processYouTubeVideo(url, options?)` in `src/main.ts`:

```
URL detection (ribbon / command / clipboard / obsidian:// handler / file-watcher)
  -> processYouTubeVideo(url, options: ProcessRunOptions)     src/main.ts
       options = ProcessingOptions { format, model, userInstructions,
                 onProgress(stage, detail), signal } + per-run
                 provider/model/maxTokens/temperature/autoFallback
       1. duplicate check       ProcessingHistoryService.find(videoId) -> warn, never block
       2. progress('metadata')  VideoDataService   oEmbed + watch-page parse
       3. progress('transcript') TranscriptService.fetchTranscriptOutcome
                -> TranscriptOutcome: ok { fullText, segments, language, truncated }
                   | failure { reason: restricted|private|unavailable|no-captions|
                     network|unknown }  (failure aborts the run with a typed Notice)
                caches: memory (7d) + optional disk (settings.persistTranscriptCache)
       4. progress('prompt')    PromptService      template + transcript -> prompt
       5. progress('ai')        provider chain driven here (per-provider attribution)
                aiService.processWith(name, prompt, model, undefined, false, { signal })
       6. progress('save')      FileService        save note, conflict handling
       returns ProcessingResult (success | error | cancelled + warnings + attribution)
```

Every outcome — success, failure, cancellation — comes back as a `ProcessingResult`; the
pipeline never throws at its caller. `signal` (modal close / plugin unload) aborts in-flight
provider fetches via `AIRequestOptions.signal`.

Gemini providers additionally attach the YouTube URL as a `fileData` part (native
multimodal ingestion) when the model supports it.

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
  (`<plugin dir>/cache/transcripts/<videoId>.<lang>.json`, 7-day TTL, best-effort).
- `src/services/prompt-service.ts` — prompt assembly, per-format transcript budgets,
  `[MM:SS](url&t=…)` timestamp links, deterministic transcript index for
  complete-transcription, `customPrompts` override resolution.
- `src/services/ai-service.ts` — provider map, `processWith` (restores the provider's model
  in `finally`), live `listModels` with a 1h cache.
- `src/services/processing-history.ts` — history + `withPluginDataLock`, the write mutex
  shared with `saveSettings`.
- `src/services/service-container.ts` — constructs providers; resolves keys via SecureConfigService.
- `src/ai/*` — one client per provider, all extend `BaseAIProvider` (`base.ts`);
  `src/ai/error-utils.ts` holds the shared `sanitizeRemoteMessage` / `createAbortSignal` /
  `MODEL_LIST_TIMEOUT_MS` (15s) helpers.
- `src/components/features/youtube/youtube-url-modal.ts` — the main UI modal (multi-URL,
  stage checklist, retry, attribution); `youtube-modal-utils.ts` holds its DOM-free helpers.
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

## Testing

Jest + ts-jest + jsdom. **7 suites, 101 tests** (snapshot — re-run `npx jest` for the current
count before quoting it).

- `tests/unit/services/youtube-page.spec.ts` (15) — player-response parsing
- `tests/unit/services/transcript-service.spec.ts` (8) — track selection + timedtext parsing
- `tests/unit/services/transcript-outcome.spec.ts` (22) — typed failures + innertube fallback
- `tests/unit/services/prompt-timestamps.spec.ts` (16) — timestamp links + transcript index
- `tests/unit/services/ai-service.spec.ts` (12) — provider chain, model restore, fallback
- `tests/unit/services/url-handler.spec.ts` (22) — URL/protocol/file intake
- `tests/unit/secure-config.spec.ts` (6) — key resolution + legacy migration

Still untested when you touch them: `processYouTubeVideo` end-to-end, `settings-tab.ts`,
`obsidian-file.ts`, `video-data.ts` metadata path, the six `src/ai/*` providers, and the
modal component itself.

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
- Known open/deferred items live in `AUDIT.md` (streaming, ESLint 9, `/live/` URL intake,
  extension verification on music.youtube.com).
