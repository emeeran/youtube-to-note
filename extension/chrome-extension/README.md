# YouTube Clipper Chrome Extension

> 🎬 One-click YouTube clipping directly to Obsidian

## Features

- **Clip Button**: Injects a stylish "Clip" button into YouTube player controls
- **Keyboard Shortcut**: Use `Ctrl+Shift+Y` (or `Cmd+Shift+Y` on Mac) to clip instantly
- **Deep Link Integration**: Opens Obsidian directly with the video URL
- **Fallback**: Copies URL to clipboard if Obsidian isn't available
- **Toast Notifications**: Visual feedback for all actions

## Installation

### Method 1: Developer Mode (Recommended)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `extension/chrome-extension` folder from this repository
5. The extension icon should appear in your toolbar

### Method 2: Manual Installation

1. Download the `extension/chrome-extension` folder
2. Follow steps 1-4 above

## Configuration

1. Click the extension icon → **Options** (or right-click → **Options**)
2. Set the endpoint URL:

### Recommended: Obsidian Protocol Handler

```
obsidian://youtube-clipper?url=
```

This directly triggers the YT-Clipper plugin's URL modal.

### Alternative: Custom Server

```
http://localhost:3000/clip
```

For advanced integrations with a custom webhook server.

## Usage

### On YouTube

1. Navigate to any YouTube video
2. Look for the **Clip** button in the player controls (bottom right)
3. Click **Clip** or press `Ctrl+Shift+Y`
4. Obsidian will open with the YT-Clipper modal pre-filled

### What Happens

1. Extension captures the current YouTube URL
2. Opens `obsidian://youtube-clipper?url=<video-url>`
3. Obsidian launches and the YT-Clipper plugin shows the URL modal
4. You can select output format and process the video

## Troubleshooting

### Button Not Appearing

- Refresh the YouTube page
- Check if the extension is enabled in `chrome://extensions/`
- Make sure you're on a YouTube video page (not homepage)

### Obsidian Not Opening

- Ensure Obsidian is installed
- Check that the YT-Clipper plugin is enabled in Obsidian
- Verify the endpoint in extension options is correct

### Modal Not Showing in Obsidian

- Open Obsidian Developer Tools (`Ctrl+Shift+I`)
- Check console for `[YT-Clipper]` messages
- Restart Obsidian and try again

## Development

### Files

```
chrome-extension/
├── manifest.json      # Extension manifest (V3)
├── content_script.js  # Injects Clip button into YouTube
├── background.js      # Service worker for shortcuts
├── options.html       # Settings page
├── options.js         # Settings logic
└── helper/            # Optional helper scripts
```

### Testing

1. Make changes to the extension files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the YT-Clipper extension
4. Refresh YouTube to test

## Browser Support

- ✅ Chrome (Manifest V3)
- ✅ Chromium-based browsers (Edge, Brave, etc.)
- ⚠️ Firefox (requires manifest modification)

---

**Made with ❤️ for the YT-Clipper Obsidian Plugin**
