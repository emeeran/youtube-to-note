# Publishing the Chrome Extension

Checklist for submitting **YouTube to Note for Obsidian** to the Chrome Web Store.

## 1. Package it

```bash
npm run package:extension
# -> dist/youtube-to-note-ext-<version>.zip   (manifest.json at the ZIP root)
```

`dist/` is gitignored — the ZIP is a build artifact, regenerated each release.

## 2. Before first upload — one-time setup

- A **Chrome Web Store developer account** ($5 one-time fee): https://chrome.google.com/webstore/devbuilder/
- Decide the **name** carefully. The current name contains "YouTube" and "Obsidian",
  which are third-party trademarks. The Web Store does not auto-reject descriptive
  "for X" names, but a trademark owner _can_ file a complaint. Mitigations already in place:
  the options/help page and store copy say _"Unofficial — not affiliated with YouTube or
  Obsidian."_ Keep that wording in the listing description.

## 3. Create the listing

In the developer dashboard → **Add new item** → upload the ZIP, then fill in:

- **Name / short description / category** (Productivity).
- **Long description** — include the "unofficial / not affiliated" disclaimer.
- **Privacy policy URL** — host `extension/chrome-extension/PRIVACY.md` somewhere public
  (e.g. the GitHub repo renders it) and paste that URL. **Required**: the extension
  requests permissions (`activeTab` + a host permission), so the Web Store requires a
  privacy policy.
- **Screenshots** — 1280×800 or 640×400, at least 1 (recommended 3–5): the button in the
  YouTube player, the toast confirmation, the options/help page.
- **Icon** — a 128×128 store tile (use `extension/chrome-extension/icons/icon128.png`).
- **Single purpose** (required field): _"Add a button to YouTube that sends the current
  video to the user's local Obsidian note-taking app."_

## 4. Permissions justification (review will ask)

- `activeTab` — inject the send button + read the current video URL on user action.
- Host permission `*://*.youtube.com/*` — the button only appears on YouTube.

No `tabs` history, no broad `<all_urls>`, no content blocking, no remote code.

## 5. Data use disclosure

In the dashboard's "Privacy" tab, answer truthfully: the extension **does not sell or
transfer user data**, **does not use it for purposes unrelated to its single purpose**, and
**does not collect personally identifiable information**. (It collects nothing — see
`PRIVACY.md`.) No authentication, no financial, no personal communications.

## 6. Submit

Upload → fill listing → Submit for review. First-time reviews typically take a few days.

## Files in the shipped package

```
extension/chrome-extension/
  manifest.json      MV3 manifest (version, permissions, options_ui, commands)
  background.js      service worker — command + action click → message content script
  content_script.js  injects the player button, fires obsidian:// handler (no innerHTML)
  options.html       static help page (surfaced via options_ui)
  icons/             16/48/128 PNG
  PRIVACY.md         privacy policy (also paste into the listing)
```

`options.js` was removed (it was an empty stub). The help page is fully static HTML.
