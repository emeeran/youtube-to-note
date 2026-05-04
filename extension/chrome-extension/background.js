chrome.commands?.onCommand?.addListener(function (c) {
  if (c === 'send-current-video')
    chrome.tabs.query({ active: true, currentWindow: true }, function (t) {
      if (t?.[0]) chrome.tabs.sendMessage(t[0].id, { t: 's' });
    });
});
chrome.action?.onClicked?.addListener(function (t) {
  if (t?.url?.includes('youtube.com/watch'))
    chrome.tabs.sendMessage(t.id, { t: 's' });
});
