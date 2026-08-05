# Privacy Policy — YouTube to Note for Obsidian (browser extension)

**Last updated: 2026-08-05**

This browser extension does **not collect, store, or transmit any personal data** to any
server. There is no backend.

## What it does

- It runs only on `youtube.com` pages.
- When you click its button in the YouTube player (or press `Ctrl+Shift+Y`), it reads the
  **video URL** of the video you are currently watching (the `v=` parameter).
- It sends that single URL to your **local Obsidian** app via your computer's
  `obsidian://youtube-clipper?url=…` protocol handler. This is an operating-system-level
  call to an app on your own machine — **no network request is made to any third party**.

## What it does not do

- No accounts, no analytics, no telemetry, no error reporting, no advertising or tracking.
- No cookies, no `localStorage`, no `IndexedDB`, no `webRequest` blocking.
- No remote code is fetched or executed. All code ships inside the extension package.

## Permissions and why each is needed

- **`activeTab`** — to add the "send to Obsidian" button to the YouTube player and read the
  current tab's URL, only when you invoke the extension.
- **Host permission `*://*.youtube.com/*`** — the content script that injects the button
  runs only on YouTube.

## Source code

Open source under the MIT license: https://github.com/emeeran/youtube-to-note

## Contact

Open an issue at the repository above.
