# Privacy Policy — YouTube to Note for Obsidian (browser extension)

**Last updated: 2026-09-06**

This browser extension does **not collect, store, or transmit any personal data** to any
server. There is no backend.

## What it does

- It runs only on `youtube.com` pages, and only in the page's top frame.
- When you click its button in the YouTube player, click the toolbar button, or press
  `Ctrl+Shift+Y`, it reads the **URL of the page you are on** in order to extract the video
  ID (and, if present, the timestamp).
- It hands a single, normalised watch URL
  (`https://www.youtube.com/watch?v=…&t=…`) to your **local Obsidian** app via your
  computer's `obsidian://youtube-clipper?url=…` protocol handler. This is an
  operating-system-level call to an app on your own machine — **no network request is made
  to any third party**.
- All other URL parameters are discarded and nothing is written anywhere.

## What it does not do

- No accounts, no analytics, no telemetry, no error reporting, no advertising or tracking.
- No cookies, no `localStorage`, no `chrome.storage`, no `IndexedDB`, no `webRequest`.
- No remote code is fetched or executed. All code ships inside the extension package.

## Permissions: none

The extension declares **no `permissions` and no `host_permissions`**.

- The player button is added by a **statically declared content script**, so Chrome injects
  it into `*://*.youtube.com/*` pages without needing a host permission.
- The video URL is read by that content script from `location.href` — not by the service
  worker — so `activeTab` (and the `tabs` permission) are unnecessary.
- The service worker only forwards a "user asked for a hand-off" message to the tab's
  content script; it never reads tab URLs or titles.
- `commands` needs no permission, so `Ctrl+Shift+Y` keeps working.

Because the extension requests no permissions and handles no user data, no permission
justification is owed to the store or to the user.

## Source code

Open source under the MIT license: https://github.com/emeeran/youtube-to-note

## Contact

Open an issue at the repository above.
