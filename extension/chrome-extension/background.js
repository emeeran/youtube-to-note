/**
 * YouTube to Note — background service worker v2.0.0 (keep in sync with manifest.json)
 *
 * Pure relay: it forwards "the user asked for a hand-off" to the content script,
 * which owns everything page-specific (it reads location.href itself). The worker
 * never reads tab metadata, so the extension declares no permissions at all.
 *
 * The sendMessage callback reads chrome.runtime.lastError so a tab without a
 * content script (any non-YouTube page) stays silent instead of logging
 * "Unchecked runtime lastError: Receiving end does not exist".
 */
(function () {
  function forward(tab) {
    if (!tab || typeof tab.id !== 'number') return;
    chrome.tabs.sendMessage(tab.id, { type: 'send' }, function () {
      void chrome.runtime.lastError;
    });
  }

  chrome.commands?.onCommand?.addListener(function (c) {
    if (c !== 'send-current-video') return;
    chrome.tabs.query({ active: true, currentWindow: true }, function (t) {
      forward(t?.[0]);
    });
  });

  chrome.action?.onClicked?.addListener(forward);
})();
