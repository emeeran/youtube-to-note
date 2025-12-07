# YouTube Clipper

> 🎬 **Transform YouTube videos into structured notes in Obsidian with AI-powered analysis**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.4.0-blue.svg)](https://github.com/emeeran/yt-clipper)
[![Obsidian](https://img.shields.io/badge/Obsidian-0.15.0+-purple.svg)](https://obsidian.md/)

## Overview

YouTube Clipper is an Obsidian plugin that extracts transcripts from YouTube videos and uses AI to generate structured, actionable notes. Perfect for researchers, students, and content creators who want to capture key insights from videos.

### Features

- 🤖 **Multiple AI Providers** - Google Gemini, Groq, HuggingFace, OpenRouter, and Ollama (local)
- 📝 **Smart Output Formats** - Executive Summary, Step-by-Step Tutorial, Brief Overview, or Custom Prompt
- 📦 **Batch Processing** - Process multiple videos at once with progress tracking
- 🔄 **Provider Fallback** - Automatically switches to backup providers on rate limits
- ⚡ **Performance Optimized** - Intelligent caching and parallel processing
- 🎯 **Custom Prompts** - Tailor AI analysis to your specific needs

---

## Installation

### From Community Plugins (Recommended)

1. Open **Settings → Community Plugins**
2. Disable Safe Mode if prompted
3. Click **Browse** and search for "YouTube Clipper"
4. Click **Install**, then **Enable**

### Manual Installation

1. Download `main.js`, `manifest.json` from the [latest release](https://github.com/emeeran/yt-clipper/releases)
2. Create folder: `<vault>/.obsidian/plugins/yt-clipper/`
3. Copy the downloaded files into the folder
4. Restart Obsidian and enable the plugin in Settings

---

## Quick Start

1. **Configure an API Key** - Go to Settings → YouTube Clipper and enter at least one API key
2. **Open the Plugin** - Click the ribbon icon (🎬) or use Command Palette: "YouTube Clipper: Process Video"
3. **Enter a YouTube URL** - Paste any YouTube video URL
4. **Select Output Format** - Choose Executive Summary, Tutorial, Brief, or Custom
5. **Process** - Click "Process Video" to generate your note

---

## AI Provider Setup

### Google Gemini (Recommended)
- Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- Free tier: 60 requests/minute

### Groq (Fast)
- Get API key from [Groq Console](https://console.groq.com/keys)
- Free tier: 30 requests/minute

### HuggingFace
- Get API key from [HuggingFace Settings](https://huggingface.co/settings/tokens)
- Free tier with inference API access

### OpenRouter
- Get API key from [OpenRouter](https://openrouter.ai/keys)
- Pay-as-you-go with many model options

### Ollama (Local/Free)
- Install from [ollama.ai](https://ollama.ai)
- Run: `ollama pull llama3.2`
- No API key needed, runs locally

---

## Output Formats

| Format | Length | Best For |
|--------|--------|----------|
| **Executive Summary** | ~250 words | Quick overviews, decision-making |
| **Step-by-Step Tutorial** | ~8000 words | Learning, implementation guides |
| **Brief Overview** | ~100 words | Quick reference, social sharing |
| **Custom Prompt** | Variable | Specialized analysis needs |

---

## Commands

| Command | Description |
|---------|-------------|
| `YouTube Clipper: Process Video` | Open the video processing modal |
| `YouTube Clipper: Batch Process` | Process multiple videos at once |
| `YouTube Clipper: Settings` | Open plugin settings |

---

## Settings

### API Keys
Configure API keys for each provider you want to use. At least one is required.

### Output Settings
- **Output Folder** - Where to save generated notes (default: root)
- **Filename Template** - Use `{{title}}`, `{{date}}`, `{{videoId}}`

### Performance
- **Default Provider** - Primary AI provider to use
- **Temperature** - AI creativity level (0.0-1.0)
- **Max Tokens** - Maximum response length

---

## Troubleshooting

### "Failed to fetch transcript"
- Ensure the video has captions/subtitles available
- Some videos have disabled captions

### "API Key Invalid"
- Verify the API key is correct and active
- Check for extra spaces or characters

### "Rate Limit Exceeded"
- Wait a few minutes before retrying
- Plugin will automatically try fallback providers

### "Provider Unavailable"
- Check your internet connection
- For Ollama: ensure the server is running (`ollama serve`)

---

## Development

```bash
# Clone repository
git clone https://github.com/emeeran/yt-clipper.git
cd yt-clipper

# Install dependencies
npm install

# Development build (with watch)
npm run dev

# Production build
npm run build

# Run tests
npm test
```

---

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [Obsidian](https://obsidian.md/) - The amazing knowledge base app
- [Google Gemini](https://ai.google.dev/) - AI capabilities
- [Groq](https://groq.com/) - Fast AI inference
- [HuggingFace](https://huggingface.co/) - Open AI models
- [OpenRouter](https://openrouter.ai/) - Unified AI gateway
- [Ollama](https://ollama.ai/) - Local AI models

---

<div align="center">

**Made with ❤️ by [Meeran E Mandhini](https://github.com/emeeran)**

</div>
