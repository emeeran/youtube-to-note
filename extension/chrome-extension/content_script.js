/**
 * YouTube to Note — Content Script v2.1
 * Compact button in YouTube player controls + keyboard shortcut
 * Protocol: obsidian://youtube-clipper?url=...
 */
(function () {
  var B = 'yt2n-btn', T = 'yt2n-toast';

  function watch() {
    try { return location.pathname === '/watch' && new URL(location.href).searchParams.get('v'); }
    catch (e) { return false; }
  }

  function vid() {
    try { var id = new URL(location.href).searchParams.get('v'); if (id) return 'https://www.youtube.com/watch?v=' + id; }
    catch (e) {}
    return location.href;
  }

  function toast(t, err) {
    var el = document.getElementById(T);
    if (!el) { el = document.createElement('div'); el.id = T; document.body.appendChild(el); }
    el.textContent = t;
    el.style.cssText =
      'position:fixed;bottom:56px;right:12px;padding:6px 14px;border-radius:6px;z-index:999999;' +
      'font:500 12px/1.4 system-ui,sans-serif;color:#fff;pointer-events:none;' +
      'background:' + (err ? '#DC2626' : '#7C3AED') + ';opacity:1;transition:opacity .25s';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.opacity = '0'; }, 2000);
  }

  function send() {
    if (!watch()) { toast('Not a video page', 1); return; }
    toast('Opening Obsidian\u2026');
    var f = document.createElement('iframe');
    f.style.display = 'none';
    f.src = 'obsidian://youtube-clipper?url=' + encodeURIComponent(vid());
    document.body.appendChild(f);
    setTimeout(function () { f.remove(); }, 2000);
  }

  function mkBtn() {
    if (document.getElementById(B)) return;
    var b = document.createElement('button');
    b.id = B;
    b.className = 'ytp-button';
    b.title = 'Send to Obsidian (Ctrl+Shift+Y)';
    b.style.marginTop = '-2px';
    b.innerHTML =
      '<svg height="100%" viewBox="0 0 128 128" width="100%" fill="none">' +
        '<rect x="7" y="25" width="104" height="68" rx="18" fill="#FF0000"/>' +
        '<polygon points="47,39 47,79 81,59" fill="#fff"/>' +
      '</svg>';
    b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); send(); };
    return b;
  }

  function inject() {
    if (document.getElementById(B)) return true;
    if (!watch()) return false;
    var c = document.querySelector('.ytp-right-controls');
    if (!c) return false;
    var b = mkBtn();
    if (b) {
      // Insert before the "Play on TV" / cast button (must be direct child of c)
      var castBtn = c.querySelector('.ytp-play-on-tv-button') || c.querySelector('button[aria-label*="TV"]') || c.querySelector('button[aria-label*="Cast"]');
      var ref = null;
      if (castBtn) {
        // Walk up to find the direct child of c
        var node = castBtn;
        while (node && node.parentElement !== c) node = node.parentElement;
        if (node) ref = node;
      }
      c.insertBefore(b, ref || c.firstChild);
    }
    return true;
  }

  try { chrome.runtime.onMessage.addListener(function (m) { if (m && m.t === 's') send(); }); } catch (e) {}

  var url = location.href, n = 0;
  function retry() { if (inject()) return; if (++n < 30) setTimeout(retry, 500); }
  new MutationObserver(function () {
    if (location.href !== url) { url = location.href; n = 0; retry(); }
    else if (watch() && !document.getElementById(B)) inject();
  }).observe(document.body, { childList: true, subtree: true });

  function go() { retry(); }
  if (document.readyState === 'complete') setTimeout(go, 600);
  else window.addEventListener('load', function () { setTimeout(go, 600); });
})();
