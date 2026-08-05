# YouTube to Note — User Manual

Generate structured, AI-powered notes from YouTube videos, saved as Markdown in your Obsidian
vault. This manual covers installation, the main workflow, every setting, the Chrome
extension, and troubleshooting.

---

## 1. Requirements

- [Obsidian](https://obsidian.md) (desktop; v0.15.0+).
- An API key for at least one AI provider — **Google Gemini** or **Groq** as a minimum.
  Others (OpenRouter, Hugging Face, Ollama Cloud, local Ollama) are optional.
- (Optional) Google Chrome / Chromium for the companion extension.

## 2. Installation

### Plugin — from a release

1. Copy `main.js`, `manifest.json`, and `styles.css` into
   `<vault>/.obsidian/plugins/youtube-to-note/`.
2. In Obsidian: **Settings → Community plugins**, enable **YouTube to Note**.

### Plugin — from source

```bash
git clone https://github.com/emeeran/youtube-to-note.git
cd youtube-to-note
npm install
npm run build        # produces main.js
```

Then copy `main.js`, `manifest.json`, and `styles.css` into the plugin folder above and
enable the plugin.

### Chrome extension (optional)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select the `extension/chrome-extension/` folder.
3. Visit a YouTube video — a button appears in the player controls (or press
   `Ctrl+Shift+Y` / `Cmd+Shift+Y`).

## 3. First-run setup

1. **Settings → YouTube to Note**.
2. Under **API Keys**, paste a key for at least Gemini or Groq (click the eye icon to reveal,
   ✓ to test the key against the provider).
3. Set **Output folder** (default `YouTube/Processed Videos`). Notes are saved into a
   date-stamped subfolder (`…/YYYY-MM-DD/`).
4. Done. Click the YouTube icon in Obsidian's ribbon (or run the command
   `Process YouTube Video`).

## 4. The main workflow

1. **Open the modal** — ribbon icon, the `Process YouTube Video` command, or paste a URL and
   use `Open URL Modal (from clipboard)`.
2. **Paste a YouTube URL** (or use the **Paste** button / `Ctrl+Shift+V`). A live preview
   (title, channel, thumbnail) appears when the URL is valid.
3. **Choose output format** (see §6) and, under **AI Configuration**, the provider and model.
   Click 🔄 to refresh the live model list for the provider.
4. (Optional) Add **User Instructions** — e.g. _"focus on the pricing discussion"_,
   _"include code examples"_. These take priority over the format's defaults.
5. **Process** (or `Ctrl+Enter`). Progress and elapsed time are shown. On completion the note
   is saved and can be opened inline, or its path copied.
6. If your primary provider errors (quota, rate limit, bad key), the plugin **automatically
   falls back** to the next configured provider (unless you disable Auto-Fallback).

Notes are named from the video title, de-slugged, and saved under
`<Output folder>/<date>/<Title>.md`.

## 5. Settings reference

| Setting                                                         | What it does                                                                              |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| API Keys (Gemini, Groq, OpenRouter, Hugging Face, Ollama Cloud) | Stored locally in `data.json`. At least Gemini or Groq required.                          |
| Ollama endpoint                                                 | Local Ollama URL (default `http://localhost:11434`) or cloud.                             |
| Output folder                                                   | Vault folder for notes (date-subfoldered).                                                |
| Performance                                                     | `Fast` / `Balanced` / `Quality` — controls prompt detail level.                           |
| Max tokens / Temperature                                        | Generation defaults (overridable per run in the modal).                                   |
| Multimodal                                                      | Prefer providers that can ingest the video directly (Gemini).                             |
| Transcript language                                             | Preferred caption language code (e.g. `en`, `es`, `fr`); blank = auto (English fallback). |
| Parallel processing                                             | Reserved for batch optimizations.                                                         |
| Env Variables                                                   | Read keys from `YTC_*` environment variables instead of `data.json`.                      |

### Environment-variable keys (optional)

Set these before launching Obsidian, enable **Use Environment Variables**, and leave the
in-app key fields empty:

```
YTC_GEMINI_API_KEY=...
YTC_GROQ_API_KEY=...
YTC_OLLAMA_API_KEY=...
YTC_HUGGINGFACE_API_KEY=...
YTC_OPENROUTER_API_KEY=...
```

## 6. Output formats

| Format                  | Best for                                |
| ----------------------- | --------------------------------------- |
| Quick Notes             | Fast, scannable summary                 |
| Executive Summary       | Strategic takeaways and recommendations |
| Technical Analysis      | Engineering-focused deep dive           |
| 3C Accelerated Learning | Structured learning                     |
| Atom Notes              | Concept-by-concept breakdown            |
| Article                 | Long-form, blog-style writeup           |
| Complete Transcription  | Full transcript                         |

## 7. Providers

| Provider       | Key source                             | Notes                                          |
| -------------- | -------------------------------------- | ---------------------------------------------- |
| Google Gemini  | https://ai.google.dev/                 | Recommended; supports native YouTube ingestion |
| Groq           | https://console.groq.com/              | Fastest text generation                        |
| OpenRouter     | https://openrouter.ai/keys             | Claude, GPT-4o, Gemini, Llama, etc.            |
| Hugging Face   | https://huggingface.co/settings/tokens | Free inference models                          |
| Ollama (local) | —                                      | No key; runs on `localhost:11434`              |
| Ollama Cloud   | https://ollama.com/settings            | Cloud-hosted Ollama models                     |

Provider priority when auto-selecting / falling back: Groq → Gemini → OpenRouter → Ollama
Cloud → Hugging Face → local Ollama.

## 8. Chrome extension

- A button is injected into the YouTube player controls; a toast confirms the send.
- Keyboard shortcut: `Ctrl+Shift+Y` (Windows/Linux) or `Cmd+Shift+Y` (macOS). Reassign in
  `chrome://extensions/shortcuts`.
- The extension sends the current video URL to Obsidian via the `obsidian://youtube-clipper`
  protocol handler — no server, no data collected (see
  [`extension/chrome-extension/PRIVACY.md`](extension/chrome-extension/PRIVACY.md)).
- An **Options** help page is available from the extension's Details screen.

## 9. Troubleshooting

- **"No transcript available" notice** — the video has no captions, so the note is built from
  metadata only. Use a multimodal Gemini model to let Gemini analyze the video directly.
- **Provider auth/quota errors** — check the key (✓ test button), quota, or billing. The
  plugin falls back to the next configured provider automatically.
- **The `obsidian://` link doesn't open (extension)** — ensure Obsidian is running, the
  plugin is enabled, and your browser/OS allows the `obsidian://` protocol.
- **Local Ollama not found** — confirm Ollama is running on the configured endpoint
  (`ollama serve`) and that you've pulled the model (`ollama pull <model>`).
- **File-name collisions** — when a note with the same name/date exists, you're asked to
  overwrite, save a versioned copy, or cancel.
- **OpenRouter key not working after upgrade** — older versions stored an obfuscated key; on
  first load the plugin migrates it to plaintext. If it still fails, re-enter the key once.

## 10. FAQ

- **Where are my API keys stored?** Locally in the plugin's `data.json` (or env vars if
  enabled). They never leave your machine except to the provider you call.
- **Does it send my videos/data anywhere?** Only the video URL goes to your AI provider as
  part of the prompt; transcripts are fetched directly from YouTube. No analytics.
- **Can I process a video without an API key?** No — at least one provider key is required.
- **Can I batch-process?** Not in this release (parallel processing is reserved for future
  batch support).

See [`AUDIT.md`](AUDIT.md) for known production-readiness items.
