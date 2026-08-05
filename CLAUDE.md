# CLAUDE.md — YouTube to Note (Obsidian plugin)

Reference for anyone (human or AI) working in this repo. Keep this in sync with the code.

## What this is

An Obsidian plugin (+ companion Chrome extension) that turns a YouTube video into a
structured Markdown note in the vault: fetches transcript + metadata, asks a configured AI
provider to analyze it, and saves the result. TypeScript, esbuild, MIT.

## Architecture (service-oriented)

Entry points all converge on `processYouTubeVideo` in `src/main.ts`:

```
URL detection (ribbon / command / clipboard / obsidian:// handler / file-watcher)
  -> processYouTubeVideo (main.ts)
       VideoDataService   metadata: oEmbed + watch-page parse
       TranscriptService  captions (requestUrl, no CORS proxy)
       PromptService      format template + transcript -> prompt
       AIService          provider fallback chain (Groq>Gemini>OpenRouter>OllamaCloud>HF>Ollama)
       FileService        save note, conflict handling
```

Gemini providers additionally attach the YouTube URL as a `fileData` part (native
multimodal ingestion) when the model supports it.

## Where things live

- `src/main.ts` — plugin class, `processYouTubeVideo`, settings load (incl. legacy key migration).
- `src/services/youtube-page.ts` — proxy-free watch-page fetch + brace-balanced
  `ytInitialPlayerResponse` parser (shared by transcript + metadata).
- `src/services/transcript-service.ts` — caption-track selection + timedtext parsing
  (handles both `<text>` and `<t>` XML shapes).
- `src/services/ai-service.ts` — provider map, fallback, live `listModels` with 1h cache.
- `src/services/service-container.ts` — constructs providers; resolves keys via SecureConfigService.
- `src/ai/*` — one client per provider, all extend `BaseAIProvider` (`base.ts`).
- `src/secure-config.ts` — API-key resolution: plaintext in `data.json`, legacy XOR values
  de-obfuscated on read + migrated to plaintext on load, env-var fallback.
- `src/components/features/youtube/youtube-url-modal.ts` — the main UI modal (large).
- `src/templates/`, `src/constants/`, `src/types.ts` — format templates, messages, types.
- `extension/chrome-extension/` — MV3 extension (plain JS, no build step).

## Conventions

- **Formatting:** prettier (4-space, single-quote, 120, trailing-comma all) + eslint.
  Indentation is owned by **prettier** — do not add an eslint `indent` rule (it conflicts;
  see commit history). Run `npm run lint` / `npm run format`.
- **Error handling:** throw `Error` (+ `ErrorHandler.handle` for user-facing Notices); `null`
  returns only at fetch boundaries. Do not swallow errors silently — log at minimum.
- **Naming:** `Service` / `Handler` / `Utils` suffixes are the established convention — match it.
- **UI voice:** emoji-rich (the codebase's intentional tone) — keep it, don't strip it.
- **Network:** use Obsidian's `requestUrl` (CORS-free) for YouTube fetches; `fetch` is fine
  for provider APIs. Add timeouts on new fetches (several existing calls still lack them —
  see AUDIT.md).
- **Security:** keys via header not URL query; sanitize remote error text via
  `BaseAIProvider.sanitizeRemoteMessage` before embedding in thrown Errors; never `innerHTML`
  untrusted strings (use `textContent` / `DOMParser`).

## Commands

```
npm run dev               # esbuild watch
npm run build             # production bundle -> main.js
npm run type-check        # tsc --noEmit
npm run lint              # eslint (0 errors expected)
npm run test              # jest
npm run test:coverage
npm run package:extension # ZIP the Chrome extension -> dist/
```

## Testing

Jest + ts-jest + jsdom. Tests under `tests/unit/services/` (youtube-page,
transcript-service, ai-service, url-handler). ~57 tests. Critical untested paths are listed
in `AUDIT.md` (processYouTubeVideo pipeline, prompt-service, obsidian-file, providers,
secure-config) — add tests there when touching those modules.

## Gotchas

- `data.json` is gitignored (holds live API keys + processing history) — never commit it.
  `data.json.example` is the documented template.
- API keys are stored **plaintext** in `data.json` by design (standard Obsidian practice).
  Legacy obfuscated values from older versions are auto-migrated to plaintext on load.
- `trash2review/` is a holding pen for files removed during cleanup — nothing there is
  loaded by the plugin. Safe to empty after review.
- Known open issues live in `AUDIT.md` (blockers: husky hooks swallow failures, modal
  `timerInterval` leak on mid-process close, Gemini key in settings-tab URL; highs:
  `processWith` mutates provider model, history/settings `data.json` write race, missing
  fetch timeouts, thin test coverage).
- The husky pre-commit/pre-push hooks currently suppress failures (`|| echo skipped`) — they
  run lint/type-check/tests but do not block. Don't rely on them; run checks manually.
