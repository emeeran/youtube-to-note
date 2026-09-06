# YouTube to Note — User Manual

Generate structured, AI-powered notes from YouTube videos, saved as Markdown in your Obsidian
vault. This manual covers installation, the main workflow, every setting, the Chrome
extension, and troubleshooting.

---

## 1. Requirements

- [Obsidian](https://obsidian.md) (v0.15.0+). Desktop, mobile and tablet all work — the
  plugin declares no desktop-only restriction and uses Obsidian's own networking.
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
3. Set **Folder** (default `YouTube/Processed Videos`). Notes are saved into a date-stamped
   subfolder (`…/YYYY-MM-DD/`).
4. Done. Click the YouTube icon in Obsidian's ribbon (or run the command
   `Process YouTube Video`).

## 4. The main workflow

1. **Open the modal** — ribbon icon, the `Process YouTube Video` command, or paste a URL and
   use `YouTube Clipper: Open URL Modal (from clipboard)`.
2. **Paste one or more YouTube URLs.** Separate them with spaces, commas, semicolons or
   new lines — or press 📋 Paste, which pulls the links out of surrounding prose. A live hint
   tells you how many videos were recognized (⚠️ marks the ones that weren't), and a preview
   (thumbnail, title, channel) appears for the first one.
3. **Choose output format** (see §6) and the AI provider. Expand **AI Configuration** to pick
   a model (🔄 refreshes the live list, ⭐ saves one as your default) and to add
   **User Instructions**.
4. **Process** (or `Enter` / `Ctrl+Enter`).
5. Watch the stage checklist: 📡 Metadata → 📝 Transcript → 🧠 AI → 💾 Save. Each step lights
   up only when the pipeline actually reaches it, the label says what is happening
   ("Contacting AI providers…", "Trying Groq…"), and the timer counts up. **Cancel** stops
   the run for real — the in-flight request is aborted, not abandoned.
6. **On success** the note is saved, the header shows how many videos were processed, and the
   details line tells you who wrote it: `🧠 Generated with Groq · llama-3.3-70b`. If a provider
   failed on the way you'll also see `↩️ Fell back from: …`. Click a note name to open it, or
   use **Open** / **Copy Path**.
7. **On failure** you get the error, a **🔄 Retry** button (same URLs, format, model and
   instructions, exactly as you set them) and a **📋 Copy error** button for a bug report.

Notes are named from the video title, de-slugged, and saved under
`<Output folder>/<date>/<Title>.md`. If a note with that name already exists you're asked to
overwrite, save a versioned copy, or cancel.

### Batch runs

Videos in a batch are processed **one at a time**, sharing the same progress UI
(`2/5:` prefixes the status). At the end you get a summary line —
`✅ 4 created · ⚠️ 1 duplicate · ❌ 1 failed` — and a row per video with its own note link and
attribution. One bad video doesn't stop the others; the failure is reported at the end.

### Duplicates

If a video was processed before (with any format), you'll see
`ℹ️ Duplicate: this video was already processed on <date>.` **before** any AI work starts,
and the note link to the earlier version appears in the result. The new note is still
created — the warning is informational. Turn it off with _Warn about already-processed videos_.

### Commands

| Command                                            | What it does                                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `Process YouTube Video`                            | Open the processing modal (same as the ribbon icon).                                               |
| `YouTube Clipper: Open URL Modal (from clipboard)` | Read the clipboard and open the modal; you're prompted for a URL if the clipboard has none.        |
| `Clear transcript cache`                           | Delete every cached transcript from disk (only useful if you enabled _Cache transcripts on disk_). |

## 5. Settings reference

| Setting                                                   | What it does                                                                                                                                          |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| API Keys (Gemini, Groq, OpenRouter, Hugging Face, Ollama) | Stored locally in `data.json`. At least Gemini or Groq required. Each has a 👁 reveal and a ✓ test button.                                            |
| Endpoint                                                  | Local Ollama URL (default `http://localhost:11434`) or a cloud endpoint.                                                                              |
| Max Tokens / Temperature                                  | Generation defaults (overridable per run in the modal).                                                                                               |
| Performance                                               | `Fast` / `Balanced` / `Quality` — controls prompt detail level.                                                                                       |
| Prompt templates                                          | One editor per output format. Blank = built-in template; the transcript, metadata and formatting rules are always added for you. ↺ Reset restores it. |
| Folder                                                    | Vault folder for notes (date-subfoldered).                                                                                                            |
| Include timestamp links                                   | Add `[MM:SS]` links that jump straight to that moment in the video (default on).                                                                      |
| Parallel Processing                                       | Reserved — batching runs sequentially today.                                                                                                          |
| Multimodal                                                | Prefer providers that can ingest the video directly (Gemini).                                                                                         |
| Transcript language                                       | Preferred caption language code (e.g. `en`, `es`, `fr`); blank = auto (English fallback).                                                             |
| Warn about already-processed videos                       | Tell you when a note for this video already exists instead of duplicating silently (default on).                                                      |
| Cache transcripts on disk                                 | Keep fetched transcripts inside the plugin folder so they survive an Obsidian reload (default **off**).                                               |
| Env Variables                                             | Read keys from `YTC_*` environment variables instead of `data.json`.                                                                                  |
| Clear Keys                                                | Remove every stored API key from `data.json`.                                                                                                         |
| ⚙️ / 📤 / 🔄 (header)                                     | Manage menu (Export / Import settings as JSON) and Reset to defaults (keys are kept).                                                                 |

### Prompt templates (per-format overrides)

Each output format has its own text area. What you write there **replaces that format's
instructions only** — the video metadata, the transcript and the shared output rules are
still assembled for you, so the note stays parseable. Leave it empty (or press ↺ Reset) to go
back to the built-in template. Note that Complete Transcription's timestamp index is generated
from the real captions either way.

### Transcript disk cache

With _Cache transcripts on disk_ enabled, transcripts are stored as
`<vault>/.obsidian/plugins/youtube-to-note/cache/transcripts/<videoId>.<lang>.json` and stay
fresh for 7 days. Turning the setting off stops new writes but keeps existing files — run
`Clear transcript cache` to delete them. The cache is desktop-only (it needs a real
filesystem) and is never written unless you opt in.

### Environment-variable keys (optional)

Set these before launching Obsidian, enable **Env Variables**, and leave the in-app key
fields empty (`.env.example` in the repo has the same list):

```
YTC_GEMINI_API_KEY=...
YTC_GROQ_API_KEY=...
YTC_OLLAMA_API_KEY=...
YTC_HUGGINGFACE_API_KEY=...
YTC_OPENROUTER_API_KEY=...
```

If env mode is on but keys are still saved in `data.json`, the plugin warns you so you can
press **Clear Keys** and keep secrets off disk.

## 6. Output formats

| Format                  | Best for                                |
| ----------------------- | --------------------------------------- |
| Quick Notes             | Fast, scannable summary                 |
| Executive Summary       | Strategic takeaways and recommendations |
| Technical Analysis      | Engineering-focused deep dive           |
| 3C Accelerated Learning | Structured learning                     |
| Atom Notes              | Concept-by-concept breakdown            |
| Article                 | Long-form, blog-style writeup           |
| Complete Transcription  | Full transcript + timestamped index     |

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
Cloud → Hugging Face → local Ollama. The modal's dropdown lists the first five; Hugging Face
is still in the fallback chain and configurable in settings, it just isn't offered as a
hand-picked target there.

With **Auto-fallback** on (the default), a failing provider hands off to the next one
automatically and the result tells you which provider fell over. That switch isn't in the
settings UI yet — set `"enableAutoFallback": false` in `data.json` if you want the run to
stop at your chosen provider.

## 8. Chrome extension

- A button is injected into the YouTube player controls; a toast confirms the send.
- Keyboard shortcut: `Ctrl+Shift+Y` (Windows/Linux) or `Cmd+Shift+Y` (macOS). Reassign in
  `chrome://extensions/shortcuts`, or click the extension's toolbar button.
- Works on `youtube.com/watch`, `/shorts/`, `/live/`, embedded `/embed/` players and
  `music.youtube.com`. On any other page (home, search, channel) there is no button, and a
  stale one is removed when you navigate away. Buttons are never injected into players
  embedded in _other_ sites.
- Your playback timestamp (`t=`) is carried over, so the note's links land where you were
  watching. Every other URL parameter is dropped.
- The extension sends the current video URL to Obsidian via the `obsidian://youtube-clipper`
  protocol handler — no server, no network request, no data collected, and the manifest
  requests **no permissions at all** (see
  [`extension/chrome-extension/PRIVACY.md`](extension/chrome-extension/PRIVACY.md)).
- The toast says `Sent to Obsidian ✓ — nothing happened? Make sure Obsidian is running with
the plugin enabled.` That is deliberate: a browser extension cannot see whether the
  operating system actually launched Obsidian, so it reports only the hand-off.

**If nothing happened:** check that Obsidian is running (not just open in the background with
the plugin disabled), that **YouTube to Note** is enabled under Settings → Community plugins,
and that your browser/OS allows the `obsidian://` protocol. On first use your OS may show a
consent prompt — accept it. Then try again.

## 9. Troubleshooting

- **"No captions available for this video"** — the video has no caption tracks, so no note is
  produced. This is deliberate: a note with no transcript behind it would just be guessing.
- **"Age/region restricted"** — YouTube refused to serve captions. The plugin already retried
  through YouTube's innertube ANDROID client; if that failed too, the video is genuinely
  locked.
- **"This video is private" / "This video is unavailable"** — exactly what it says: the video
  is private, removed, or the link is wrong.
- **Provider auth/quota errors** — check the key (✓ test button), quota, or billing. The
  plugin falls back to the next configured provider automatically and tells you it did. Use
  🔄 Retry after fixing the key — your format, model and instructions are preserved.
- **"Transcript truncated"** — the transcript was longer than the prompt budget, so the
  analysis covers the first portion. Try a shorter format, or a provider with a bigger context.
- **The `obsidian://` link doesn't open (extension)** — see §8, "If nothing happened".
- **Local Ollama not found** — confirm Ollama is running on the configured endpoint
  (`ollama serve`) and that you've pulled the model (`ollama pull <model>`).
- **File-name collisions** — when a note with the same name/date exists, you're asked to
  overwrite, save a versioned copy, or cancel.
- **OpenRouter key not working after upgrade** — older versions stored an obfuscated key; on
  first load the plugin migrates it to plaintext. If it still fails, re-enter the key once.
- **Freeing disk space / clearing the cache** — run the `Clear transcript cache` command.

## 10. FAQ

- **Where are my API keys stored?** Locally in the plugin's `data.json` — or nowhere at all,
  if you enable _Env Variables_ and use `YTC_*` environment variables. They never leave your
  machine except to the provider you call.
- **Does it send my videos/data anywhere?** Only the video URL goes to your AI provider as
  part of the prompt; transcripts are fetched directly from YouTube. No analytics.
- **Can I process a video without an API key?** No — at least one provider key (or env var)
  is required.
- **Can I batch-process?** Yes. Paste several URLs; they're processed one after another with a
  per-video summary. (The old _Parallel Processing_ switch is still reserved — batching is
  sequential by design so a failure is easy to attribute.)
- **Why does a note get no timestamp links?** Timestamps come from real caption timings, so a
  video without captions has none to offer — and the setting has to be on (it is by default).
- **Does it work on mobile?** The plugin is built to: no desktop-only flag, no Node-only APIs,
  and transcripts/metadata are fetched with Obsidian's CORS-free `requestUrl`. The optional
  transcript disk cache is desktop-only (it needs a real filesystem).

See [`AUDIT.md`](AUDIT.md) for what's fixed and what's deliberately left open.
