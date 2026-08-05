# YouTube to Note

Generate structured, AI-powered notes from YouTube videos directly inside [Obsidian](https://obsidian.md).

Paste a YouTube URL, pick an output format and an AI provider, and the plugin fetches the
video's transcript + metadata, asks the model to analyze it, and saves a polished Markdown
note — frontmatter, embedded player, and all — into your vault.

## Features

- **Transcript-backed analysis** — pulls the actual captions (no third-party proxy) so the AI
  summarizes what was _said_, not just the title.
- **Native video ingestion for Gemini** — Gemini models receive the YouTube URL directly and can
  "watch" the video (audio + visuals), not just read the transcript.
- **6 AI providers with automatic fallback** — Google Gemini, OpenRouter, Groq, Ollama Cloud,
  Hugging Face, and local Ollama. If the primary provider fails, the next one is tried.
- **Live model lists** — the model dropdown fetches the models your key actually has access to
  (Groq, OpenRouter, Gemini, Ollama), curated so known-good models appear first.
- **7 output formats** — Quick Notes, Executive Summary, Technical Analysis, 3C Accelerated
  Learning, Atom Notes, Article, and Complete Transcription.
- **Companion Chrome extension** — adds a button to YouTube's player and a `Ctrl+Shift+Y` shortcut
  that sends the current video to Obsidian via the `obsidian://` protocol handler.
- **Per-run controls** — choose provider, model, performance mode, max tokens, temperature, and
  free-form user instructions for each note.
- **Processing history** — tracks processed videos (provider, model, format, file path).

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

Open **Settings → YouTube to Note**. Add an API key for any provider you want to use. At least
one of Gemini or Groq is required (the rest are optional). Keys are stored locally in the
plugin's `data.json`.

| Provider       | Where to get a key                     | Notes                                           |
| -------------- | -------------------------------------- | ----------------------------------------------- |
| Google Gemini  | https://ai.google.dev/                 | Recommended — supports native YouTube ingestion |
| Groq           | https://console.groq.com/              | Fastest text generation                         |
| OpenRouter     | https://openrouter.ai/keys             | Access to Claude, GPT-4o, Gemini, Llama, etc.   |
| Hugging Face   | https://huggingface.co/settings/tokens | Free inference models                           |
| Ollama (local) | —                                      | No key needed; runs on `http://localhost:11434` |
| Ollama Cloud   | https://ollama.com/settings            | Cloud-hosted Ollama models                      |

> **Environment variables (optional):** enable _Use Environment Variables_ and set vars prefixed
> with `YTC` (e.g. `YTC_GEMINI_API_KEY`) to avoid storing keys in `data.json`.

### Chrome extension

Load `extension/chrome-extension/` as an unpacked extension (chrome://extensions → Developer
mode). With Obsidian running, the button in the YouTube player (or `Ctrl+Shift+Y`) sends the
current video to the plugin. An **Options** help page is available from the extension's
Details screen. To package it for the Chrome Web Store, see
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
| Complete Transcription  | Full timestamped transcript             |

## Settings reference

- **Output folder** — where notes are saved (organized into daily subfolders).
- **Performance** — `Fast` / `Balanced` / `Quality` (affects prompt detail).
- **Max tokens / Temperature** — generation defaults.
- **Multimodal** — prefer providers that can ingest the video directly.
- **Transcript language** — preferred caption language code (e.g. `en`, `es`); blank = auto.
- **Parallel processing** — reserved for batch optimizations.

## Development

```bash
npm run dev               # esbuild watch
npm run build             # production bundle -> main.js
npm run type-check        # tsc --noEmit
npm run lint              # eslint
npm run test              # jest
npm run test:coverage     # jest with coverage
npm run package:extension # ZIP the Chrome extension for the Web Store -> dist/
```

### Architecture (service-oriented)

```
URL detection ──▶ processYouTubeVideo (main.ts)
                   ├─ VideoDataService   metadata (oEmbed + watch-page parse)
                   ├─ TranscriptService  captions via requestUrl (no CORS proxy)
                   ├─ PromptService      format templates + transcript → prompt
                   ├─ AIService          provider fallback chain (6 providers)
                   └─ FileService        save note, handle conflicts
```

Key modules:

- `src/services/youtube-page.ts` — proxy-free watch-page fetch + `ytInitialPlayerResponse` parser
  (brace-balanced) shared by transcript and metadata paths.
- `src/services/transcript-service.ts` — caption-track selection + timedtext parsing.
- `src/ai/*` — one client per provider, all extending `BaseAIProvider`.
- `src/secure-config.ts` — API-key resolution (plaintext in `data.json`, with legacy
  de-obfuscation for values written by older versions, plus env-var fallback).

## Limitations

- Requires at least one configured AI provider key (Gemini or Groq minimum).
- Transcript availability depends on the video having captions; if none, the note is
  generated from metadata only and a notice is shown.
- Native video ingestion (Gemini actually "watching" the video) requires a multimodal
  Gemini model; other providers summarize the transcript text.
- The Chrome extension needs Obsidian running and the `obsidian://` protocol permitted by
  the browser/OS.
- Production-readiness notes (open blockers/fixes) live in [`AUDIT.md`](AUDIT.md).

## License

MIT © Meeran E Mandhini
