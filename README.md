# YouTube to Note

Generate structured, AI-powered notes from YouTube videos directly inside [Obsidian](https://obsidian.md).

Paste a YouTube URL (or several), pick an output format and an AI provider, and the plugin
fetches the video's transcript + metadata, asks the model to analyze it, and saves a polished
Markdown note — frontmatter, embedded player, and all — into your vault.

📖 **New to the plugin? The [user manual](USER_MANUAL.md) walks through every screen,
setting and troubleshooting case.**

## Features

- **Transcript-backed analysis** — pulls the actual captions (no third-party proxy) so the AI
  summarizes what was _said_, not just the title. Age-restricted videos get a second chance
  through YouTube's innertube ANDROID client before the plugin gives up.
- **Honest progress, not a spinner** — a live checklist (📡 Metadata → 📝 Transcript → 🧠 AI →
  💾 Save) driven by the pipeline itself, with an elapsed timer and a working Cancel that
  actually aborts the in-flight request.
- **Multi-URL batch input** — paste a list of links (separated by spaces, commas or newlines)
  and they are processed one at a time, with a per-video summary: created / duplicate / failed.
  Repeated videos are collapsed to one run, and a batch is capped at 50 URLs.
- **Clickable timestamp links** — key claims are cited as `[MM:SS](…&t=)` deep links. When the
  feature is on, the transcript handed to the model carries an `[MM:SS]` marker at every minute
  boundary, so the times it cites are real caption timings rather than inventions; Complete
  Transcription gets a deterministic timestamped index built the same way.
- **Typed transcript failures** — "no captions", "private", "age/region restricted",
  "unavailable" and "network error" each get their own explanation instead of a generic
  failure. Restricted, private and unavailable stop the run; no captions does not (see
  [Limitations](#limitations)).
- **6 AI providers with automatic fallback** — Google Gemini, OpenRouter, Groq, Ollama Cloud,
  Hugging Face, and local Ollama. If the primary provider fails, the next one is tried — and
  the completion screen tells you which provider and model actually wrote the note, and which
  ones fell over on the way.
- **Retry only what failed** — when a batch dies partway, 🔄 Retry re-runs just the failed URLs
  (same format, model and instructions) and leaves the notes that already saved alone; 🔁 Retry
  all is a separate, explicit button. The successes stay visible as clickable links above the
  error, and 📋 Copy error is there for a bug report.
- **Duplicate warnings** — if a video was already processed you're told when, with a link to
  the earlier note, instead of silently getting a second copy.
- **Live model lists** — the model dropdown fetches the models your key actually has access to
  (Groq, OpenRouter, Gemini, Ollama), curated so known-good models appear first.
- **Per-format prompt overrides** — replace any output format's template body with your own
  instructions, per format; blank means the built-in template. Overrides are capped at 20,000
  characters and saved on a short delay rather than on every keystroke.
- **7 output formats** — Quick Notes, Executive Summary, Technical Analysis, 3C Accelerated
  Learning, Atom Notes, Article, and Complete Transcription.
- **Companion Chrome extension** — adds a button to YouTube's player and a `Ctrl+Shift+Y`
  shortcut that sends the current video to Obsidian via the `obsidian://` protocol handler.
  Works on watch pages, Shorts, live streams, embedded players and music.youtube.com, keeps
  your timestamp, and requests **zero permissions**.
- **Per-run controls** — choose provider, model, performance mode, max tokens, temperature, and
  free-form user instructions for each note.
- **Processing history** — tracks processed videos (provider, model, format, file path).
- **Mobile-friendly** — the manifest declares `isDesktopOnly: false`, the transcript and
  metadata fetches go through Obsidian's CORS-free `requestUrl`, and there are no Node-only
  APIs.

## Installation

### From a release

1. Copy `main.js`, `manifest.json`, and `styles.css` into
   `<vault>/.obsidian/plugins/youtube-to-note/`.
2. Enable **YouTube to Note** under Settings → Community plugins.

### From source

```bash
npm install
npm run build      # produces main.js via esbuild
```

Then copy the three files above into the plugin folder.

## Configuring providers

Open **Settings → YouTube to Note**. Add an API key for **any one** of the providers — Gemini,
Groq, OpenRouter, Hugging Face or Ollama Cloud (local Ollama needs no key). No provider is
privileged: an OpenRouter-only setup is exactly as valid as a Gemini-only one, and
environment-variable mode counts too. Keys are stored locally in the plugin's `data.json` —
or kept off disk entirely with environment variables (see below).

| Provider       | Where to get a key                     | Notes                                           |
| -------------- | -------------------------------------- | ----------------------------------------------- |
| Google Gemini  | https://ai.google.dev/                 | Recommended — supports native YouTube ingestion |
| Groq           | https://console.groq.com/              | Fastest text generation                         |
| OpenRouter     | https://openrouter.ai/keys             | Access to Claude, GPT-4o, Gemini, Llama, etc.   |
| Hugging Face   | https://huggingface.co/settings/tokens | Free inference models                           |
| Ollama (local) | —                                      | No key needed; runs on `http://localhost:11434` |
| Ollama Cloud   | https://ollama.com/settings            | Cloud-hosted Ollama models                      |

> **Environment variables (optional):** enable _Env Variables_ and set vars prefixed with `YTC`
> (e.g. `YTC_GEMINI_API_KEY`) before launching Obsidian, then leave the in-app key fields
> empty. The prefix itself is a settings field (_Environment variable prefix_) if you would
> rather use your own. The plugin warns you if env mode is on while keys are still sitting in
> `data.json`. See `.env.example`.

### Chrome extension

Load `extension/chrome-extension/` as an unpacked extension (chrome://extensions → Developer
mode). With Obsidian running, the button in the YouTube player (or `Ctrl+Shift+Y`) sends the
current video to the plugin. The manifest declares **no permissions and no host permissions**:
the URL is read by the content script from the page itself, and everything is normalised to a
canonical `watch?v=` link before hand-off. An **Options** help page is available from the
extension's Details screen. To package it for the Chrome Web Store, see
[extension/PUBLISH.md](extension/PUBLISH.md) and run `npm run package:extension`.

## Output formats

| Format                  | Best for                                |
| ----------------------- | --------------------------------------- |
| Quick Notes             | A fast, scannable summary               |
| Executive Summary       | Strategic takeaways and recommendations |
| Technical Analysis      | Engineering-focused deep dive           |
| 3C Accelerated Learning | Learning-oriented structure             |
| Atom Notes              | Concept-by-concept breakdown            |
| Article                 | Blog-style long-form writeup            |
| Complete Transcription  | Full transcript + timestamped index     |

## Settings reference

- **API keys (Gemini, Groq, OpenRouter, Hugging Face, Ollama Cloud)** — each has a reveal (👁)
  and a test (✓) button; keys are sent as request headers, never in a URL. **Any one provider
  is enough.** A key whose prefix looks unusual for its provider is flagged as a warning, never
  a blocker — proxies and rotated key formats are legitimate.
- **📤 Export / 📥 Import** (in the ⚙️ menu) — settings round-trip as JSON with the API keys
  stripped out, and importing can never blank the keys already stored in `data.json`.
- **Ollama endpoint** — local Ollama URL (default `http://localhost:11434`) or a cloud endpoint.
- **Output folder** — where notes are saved (organized into daily subfolders).
- **Include timestamp links** — emit `[MM:SS](url&t=…)` citations from real caption timings
  (default on).
- **Performance** — `Fast` / `Balanced` / `Quality` (affects prompt detail).
- **Max tokens / Temperature** — generation defaults.
- **Multimodal** — prefer providers that can ingest the video directly.
- **Transcript language** — preferred caption language code (e.g. `en`, `es`); blank = auto.
- **Warn about already-processed videos** — flag duplicates before they're created
  (default on).
- **Cache transcripts on disk** — keep fetched transcripts under the plugin folder so an
  Obsidian reload doesn't re-download them (default **off**; 7-day freshness).
- **Prompt templates** — one editor per output format. Leave a template blank to use the
  built-in one; the transcript, metadata and formatting rules are always added for you. Each
  override is capped at 20,000 characters and persisted with a 500 ms debounce.
- **Parallel processing** — reserved. Batching today is sequential, one video at a time.
- **Auto-fallback** — on by default, and not yet exposed as a toggle: when your chosen
  provider fails, the next configured one is tried. Disable it by setting `enableAutoFallback`
  to `false` in `data.json`.
- **Env Variables** — read keys from environment variables instead of `data.json`.
- **Environment variable prefix** — the prefix keys are read under (default `YTC`, i.e.
  `YTC_GEMINI_API_KEY`). Required when _Env Variables_ is on; this field is what makes a
  keys-off-disk setup reachable without hand-editing `data.json`.

## Development

```bash
npm run dev               # esbuild watch
npm run build             # production bundle -> main.js (gitignored build artifact)
npm run type-check        # tsc --noEmit
npm run lint              # eslint (src only)
npm run lint:fix          # eslint --fix
npm run format            # prettier --write src/**/*.ts
npm run test              # jest (16 suites / 408 tests at the time of writing)
npm run test:coverage     # jest with coverage
npm run package:extension # ZIP the Chrome extension for the Web Store -> dist/
npm version <x.y.z>       # bumps package.json + manifest.json + versions.json
```

Pre-commit and pre-push hooks run lint-staged, type-check and the test suite — and they
**block** on failure. Branches are `feature/…` / `fix/…` / `chore/…` / `docs/…`, commits are
conventional. See [CONTRIBUTING.md](CONTRIBUTING.md); released changes are listed in
[CHANGELOG.md](CHANGELOG.md).

### Architecture (service-oriented)

```
URL detection ──▶ processYouTubeVideo(url, options)   src/main.ts
                   │    options: format, model, userInstructions,
                   │            onProgress(stage), signal (abort)
                   ├─ 1. ProcessingHistoryService   duplicate check (warn, never block)
                   ├─ 2. VideoDataService           metadata (oEmbed + watch-page parse)
                   ├─ 3. TranscriptService          captions via requestUrl (no CORS proxy)
                   │        fetchTranscriptOutcome → typed success/failure
                   │        caches: memory (7d) + optional on-disk cache
                   ├─ 4. PromptService              format template + transcript → prompt
                   ├─ 5. provider chain (6, tried in order, per-provider attribution)
                   └─ 6. FileService                save note, handle conflicts
```

Key modules:

- `src/services/youtube-page.ts` — proxy-free watch-page fetch + `ytInitialPlayerResponse`
  parser (brace-balanced) shared by transcript and metadata paths, plus the innertube
  ANDROID fallback for age-restricted videos.
- `src/services/transcript-service.ts` — `fetchTranscriptOutcome`: caption-track selection,
  timedtext parsing, and a machine-readable failure reason.
- `src/services/transcript-cache.ts` — the opt-in on-disk transcript cache.
- `src/ai/*` — one client per provider, all extending `BaseAIProvider`; shared
  error-sanitizing and abort helpers in `src/ai/error-utils.ts`.
- `src/secure-config.ts` — API-key resolution (plaintext in `data.json`, with legacy
  de-obfuscation for values written by older versions, plus env-var fallback).

## Limitations

- Requires at least one configured AI provider — any one of the five keyed providers, or
  environment-variable mode with a prefix.
- Captions are the difference between a real analysis and a guess, so the two cases behave
  differently: a **hard failure** (age/region restricted, private, unavailable) stops the run
  with a specific notice, while a video that merely has **no captions** still produces a
  metadata-only note, with a warning that it may be thin. Videos that are merely
  age-restricted usually still work, via the innertube fallback.
- Native video ingestion (Gemini actually "watching" the video) requires a multimodal
  Gemini model; other providers summarize the transcript text.
- Very long transcripts are truncated, and the completion screen says so with the real
  numbers — either the 150,000-character source ceiling, or the per-format prompt budget
  (e.g. "trimmed to the first 120,000 of 145,000 characters for this format").
- The Chrome extension needs Obsidian running and the `obsidian://` protocol permitted by
  the browser/OS.
- Production-readiness notes (what's fixed, what's deliberately deferred) live in
  [`AUDIT.md`](AUDIT.md).

## Roadmap — and what we deliberately did _not_ do

Not a promise list; these are the known gaps we chose not to paper over in this release:

- **Token-level streaming.** The provider interface is `Promise<string>`, so text arrives in
  one piece. Stage progress is the interim. Streaming means changing the provider interface
  and every client.
- **ESLint 9 flat config.** We're still on ESLint 8 (EOL). The migration touches the config
  format and the prettier/`indent` settlement — worth doing properly, not in passing.
- **Template variables.** Per-format prompt overrides are in; arbitrary `{{VARIABLE}}`
  customization of the built-in templates is not.
- **Mobile-specific UI testing.** The code is mobile-safe (`isDesktopOnly: false`, no
  unguarded Node APIs, `requestUrl` everywhere), but nobody has clicked through it on a phone.

## License

MIT © Meeran E Mandhini
