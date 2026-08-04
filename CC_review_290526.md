# YouTube-to-Note Plugin — Main Processing Flow Review

## Entry Points (all converge to `processYouTubeVideo`)

| Source | File | Function |
|---|---|---|
| Ribbon icon / command | `main.ts:158` | `safeShowUrlModal()` |
| Protocol handler (Chrome ext) | `url-handler.ts:294` | `handleProtocol()` |
| Clipboard detection | `url-handler.ts:323` | `handleClipboardUrl()` |
| File watcher | `url-handler.ts:198` | `handleFileCreate()` |

All routes lead to `main.ts:197` — `handleUrlDetection()` → opens modal → user confirms → calls `processYouTubeVideo()`.

---

## Core Pipeline: `processYouTubeVideo()` — `main.ts:375`

```
Step 1: Validate
    main.ts:395  → ValidationUtils.validateSettings()
    main.ts:407  → youtubeService.extractVideoId(url)
                      validation.ts:63 — regex extraction of 11-char video ID

Step 2: Fetch Metadata
    main.ts:412  → youtubeService.getVideoData(videoId)
                      video-data.ts:54  → getVideoMetadata()
                      video-data.ts:114 → YouTube oEmbed API
                      video-data.ts:202 → fallback: page scraping

Step 3: Fetch Transcript
    main.ts:417  → youtubeService.getTranscript(videoId)
                      transcript-service.ts:32 — getTranscript()
                        75 → Method 1: YouTube API endpoint
                        83 → Method 2: Page scraping fallback
                        91 → Method 3: Third-party service fallback

Step 4: Build Prompt
    main.ts:435  → promptService.createAnalysisPrompt()
                      prompt-service.ts:148 — template selection
                      prompt-service.ts:435 — placeholder replacement

Step 5: AI Processing
    main.ts:473  → aiService.processWith(provider, prompt, model)
                   OR
    main.ts:488  → aiService.process(prompt)  // auto-select provider
                      ai-service.ts:42  → processWith() with fallback
                      ai-service.ts:25  → process() — first available

    Provider priority (service-container.ts:45-75):
      Groq → Gemini → OpenRouter → Ollama Cloud → HuggingFace → Ollama Local

Step 6: Format Response
    main.ts:510  → promptService.processAIResponse()
                      prompt-service.ts:500 — applies output formatting

Step 7: Save File
    main.ts:519  → fileService.saveToFile()
                      obsidian-file.ts:18 — save to vault, handle conflicts
```

---

## Key Branching Points

- **AI provider fallback** (`ai-service.ts:66-84`): if the primary provider fails, it automatically tries the next one in the priority chain
- **Transcript fallback** (`transcript-service.ts:75-91`): three methods tried sequentially if the transcript isn't available
- **Metadata fallback** (`video-data.ts:114-202`): page scraping used as fallback for age-restricted or oEmbed-incompatible videos
- **Format selection**: the user-chosen template (executive summary, technical analysis, etc.) determines the prompt structure at step 4

---

## Architecture Overview (Service-Oriented)

| Service | Role |
|---|---|
| URL Handler | Detects, validates, and routes YouTube URLs |
| Video Data Service | Fetches video metadata (title, duration, thumbnail) and transcripts |
| AI Service | Unified interface to multiple AI providers with automatic fallback |
| Prompt Service | Builds prompts from format templates + video data |
| File Service | Creates and manages the output Markdown files in Obsidian |
| Modal Manager | Manages UI state for the URL input modal |
| Error Handler | User-friendly error messages |
| Service Container | Central service manager / dependency injection |

---

## Output Formats

Users can choose from several note templates:

- **Executive Summary** — strategic/insights format
- **Technical Analysis** — engineering-focused
- **3C Accelerated Learning** — learning-oriented
- **Atom Notes** — concept-focused
- **Article** — blog-style
- **Complete Transcription** — full timestamped transcript
- **Quick Notes** — simple summary

---

## Chrome Extension Integration

A companion Chrome extension (`extension/chrome-extension/`) injects a button into YouTube's player controls and supports a keyboard shortcut (Ctrl+Shift+Y). It communicates with Obsidian via the custom protocol handler `obsidian://youtube-clipper?url=...`.

---

## Settings

Configurable via Obsidian's settings panel: API keys (with env var support), performance modes (Fast/Balanced/Quality), output folder path, default format, token limits, and temperature.

---

*Review generated 2026-05-29*
