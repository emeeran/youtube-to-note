# Publishing the Chrome Extension

Checklist for submitting **YouTube to Note for Obsidian** to the Chrome Web Store.

## 1. Package it

```bash
npm run package:extension
# -> dist/youtube-to-note-ext-<version>.zip   (manifest.json at the ZIP root)
```

`dist/` is gitignored — the ZIP is a build artifact, regenerated each release. The script
reads the version out of `extension/chrome-extension/manifest.json`, so bump that first.

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
- **Long description** — mention watch pages, Shorts, live streams, embedded players and
  music.youtube.com, plus the timestamp carry-over. Include the
  "unofficial / not affiliated" disclaimer.
- **Privacy policy URL** — host `extension/chrome-extension/PRIVACY.md` somewhere public
  (e.g. the GitHub repo renders it) and paste that URL. The store only **requires** one for
  items that use permissions or handle user data, and this extension now requests neither —
  but publishing it anyway is cheap, and it is the honest place to document the
  `obsidian://` hand-off.
- **Screenshots** — 1280×800 or 640×400, at least 1 (recommended 3–5): the button in the
  YouTube player, the confirmation bubble, a Shorts page, the options/help page.
- **Icon** — a 128×128 store tile (use `extension/chrome-extension/icons/icon128.png`).
- **Single purpose** (required field): _"Add a button to YouTube that sends the current
  video to the user's local Obsidian note-taking app."_

## 4. Permissions justification (review will ask)

**None.** The manifest declares no `permissions` and no `host_permissions`.

- The button comes from a statically declared content script (`content_scripts.matches` —
  injection is granted by the match pattern itself, no host permission needed).
- The video URL is read by the content script from `location.href`; the service worker is a
  pure relay and never looks at the tab, so `activeTab`/`tabs` are not used.
- `tabs.sendMessage` needs no permission, so the toolbar button and `Ctrl+Shift+Y` work.

No `tabs` history, no broad `<all_urls>`, no content blocking, no remote code. Reviewers
should find nothing to justify; say so plainly in the review notes rather than leaving the
field blank.

## 5. Data use disclosure

In the dashboard's "Privacy" tab, answer truthfully: the extension **does not sell or
transfer user data**, **does not use it for purposes unrelated to its single purpose**, and
**does not collect personally identifiable information**. (It collects nothing and stores
nothing — see `PRIVACY.md`.) No authentication, no financial, no personal communications.

## 6. Submit

Upload → fill listing → Submit for review. First-time reviews typically take a few days.

## 7. Release / versioning

The extension and the Obsidian plugin are versioned **independently** — a plugin release
does not imply an extension release and vice versa. Do not reuse the plugin's
`manifest.json`/`versions.json` bump flow (`npm version`, `npm run version`) for the
extension; that flow targets the plugin at the repo root.

To release a new extension version:

1. Edit `version` in `extension/chrome-extension/manifest.json` (three numeric components,
   e.g. `2.0.0` → `2.1.0`). Bump **minor** for new behavior (new supported page types),
   **patch** for fixes.
2. Keep the `v<version>` notes in the header comments of `content_script.js` and
   `background.js` in sync with the manifest — they are the only other place a version
   appears.
3. Update the store listing copy if user-visible behavior changed.
4. `npm run package:extension` → upload the resulting `dist/youtube-to-note-ext-<version>.zip`
   to the store as a **new item submission** (the Web Store has no in-place version bump;
   every upload is a review).

Manual steps that stay manual — nothing in this repo automates them:

- the Chrome Web Store **developer account** and its $5 fee;
- **screenshots** and the 128×128 store tile;
- the **single purpose**, **data use** and permission disclosures (human answers, and the
  wording must stay truthful after each change);
- clicking **Submit for review** and any follow-up the reviewer requests.

## Files in the shipped package

```
extension/chrome-extension/
  manifest.json      MV3 manifest (version, options_ui, commands, zero permissions)
  background.js      service worker — relay only: command + action click → message
  content_script.js  detects videos, injects/removes the player button, hands the
                     normalised URL to obsidian:// (DOMParser-built SVG, no innerHTML)
  options.html       static help page (surfaced via options_ui, no JS)
  icons/             16/48/128 PNG
  PRIVACY.md         privacy policy (also linked from the listing)
```

`options.js` was removed (it was an empty stub). The help page is fully static HTML.

## Behavior notes for the listing / review

- Videos are recognised on `/watch?v=`, `/shorts/`, `/embed/`, `/live/` and
  `music.youtube.com/watch?v=`. Everything is normalised to a canonical
  `https://www.youtube.com/watch?v=ID` URL for consistency: the plugin accepts every one
  of those shapes already, and a canonical watch link means the same URL is handed off
  wherever the video was playing.
- The playback timestamp (`t`, or `start` on embeds) is preserved; all other parameters are
  dropped.
- Hand-off uses a top-level `obsidian://` navigation. Chrome increasingly blocks protocol
  navigations started from a subframe, which is why the old hidden-iframe trick was
  dropped.
- The confirmation bubble explicitly says Obsidian may not have opened — a content script
  cannot observe the outcome of an external protocol launch.
- The button is removed when YouTube's SPA navigates to a non-video page (`yt-navigate-finish`,
  with a MutationObserver fallback), and content scripts only run in top-level frames, so no
  button appears inside players embedded in other sites.
- The MutationObserver is disarmed as soon as the button is in place on a stable URL, and
  re-armed by `yt-navigate-finish` or by a 1.5s watchdog, so the extension does no
  per-mutation work once a page has settled. Retry chains are per navigation, stop early on
  pages with no video, and give up after ~15s.
