/**
 * YouTube to Note — Content Script v2.0.0 (keep in sync with manifest.json "version")
 *
 * Adds a compact "send to Obsidian" button to the YouTube player controls and
 * handles Ctrl+Shift+Y (registered in manifest.json "commands").
 * Protocol: obsidian://youtube-clipper?url=<canonical watch URL>
 *
 * Video pages: /watch?v=, /shorts/ID, /embed/ID, /live/ID, music.youtube.com/watch?v=
 * (youtu.be/ID is parsed too but is never reached: youtu.be redirects immediately).
 * Any other page (home, search, channel…) gets no button, and a stale one is removed.
 *
 * Top frames only: an <iframe> of youtube.com/embed inside another site cannot
 * launch an external protocol handler reliably, so those frames do nothing.
 *
 * The URL is normalised to https://www.youtube.com/watch?v=ID for consistency: every
 * shape this script recognises is already accepted by the Obsidian plugin's validator
 * (/live/ID included), and a canonical watch link means the same URL is handed off
 * wherever the video was playing. Only the timestamp survives; every other parameter
 * is dropped.
 *
 * Watching the DOM: YouTube is a SPA, so the button must be re-placed after every
 * internal navigation. A MutationObserver is the fast path, but it is disarmed as
 * soon as the button sits on a stable URL and re-armed by yt-navigate-finish — or
 * by the 1.5s watchdog, which stands in for "the next mutation" (a disconnected
 * observer cannot hear one). Retry chains are per navigation and give up after
 * ~15s, so nothing polls a page that has no player.
 */
(function () {
  if (window.top !== window) return; // top frames only — see header

  var BTN = 'yt2n-btn';
  var TOAST = 'yt2n-toast';
  var HANDOFF = 'obsidian://youtube-clipper?url=';
  var ID_RE = /^[A-Za-z0-9_-]{11}$/;

  /* ---------------- video detection ---------------- */

  // Video ID in the current URL, or null when this page shows no video.
  function videoId(href) {
    try {
      var u = new URL(href);
      var m;
      if (u.pathname === '/watch') return id(u.searchParams.get('v')); // www / m / music
      if ((m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/))) return id(m[1]);
      if (u.hostname === 'youtu.be') return id(u.pathname.slice(1).split('/')[0]);
      return null;
    } catch (e) {
      return null;
    }
  }

  function id(raw) {
    return raw && ID_RE.test(raw) ? raw : null;
  }

  // Same question as videoId(location.href), memoised on the href string. The
  // watchdog below asks it every 1.5s, and there is no reason to build a URL
  // object and run four regexes for an answer that cannot have changed.
  var vidHref = null;
  var vidAns = false;
  function isVideo() {
    var href = location.href;
    if (href !== vidHref) {
      vidHref = href;
      vidAns = videoId(href) !== null;
    }
    return vidAns;
  }

  // YouTube stores the seek position as `t` (watch/shorts), `start` or
  // `time_continue` (embeds and deep links). The value's own format — "90",
  // "1m30s" — is passed through untouched; everything but `v` is dropped.
  function timestamp(href) {
    try {
      var p = new URL(href).searchParams;
      var t = p.get('t') || p.get('start') || p.get('time_continue');
      return t && /^[0-9hms.]+$/.test(t) ? t : null;
    } catch (e) {
      return null;
    }
  }

  function canonicalUrl(href) {
    var v = videoId(href);
    if (!v) return null;
    var url = 'https://www.youtube.com/watch?v=' + encodeURIComponent(v);
    var t = timestamp(href);
    return t ? url + '&t=' + encodeURIComponent(t) : url;
  }

  /* ---------------- feedback ---------------- */

  // Toasts are pointer-events:none (never in the way) and remove themselves.
  function toast(text, isError) {
    if (!document.body) return;
    var el = document.getElementById(TOAST);
    if (!el) {
      el = document.createElement('div');
      el.id = TOAST;
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.cssText =
      'position:fixed;bottom:56px;right:12px;max-width:340px;padding:6px 14px;border-radius:6px;z-index:999999;' +
      'font:500 12px/1.4 system-ui,sans-serif;color:#fff;pointer-events:none;' +
      'background:' + (isError ? '#DC2626' : '#7C3AED') + ';opacity:1;transition:opacity .3s';
    clearTimeout(el._fade);
    clearTimeout(el._gone);
    el._fade = setTimeout(function () { el.style.opacity = '0'; }, 3200);
    el._gone = setTimeout(function () { el.remove(); }, 3600);
  }

  /* ---------------- hand-off ---------------- */

  // A content script cannot tell whether the OS launched the handler, so the
  // toast reports only what happened (the hand-off) and names the usual
  // culprits for silence. Top-level navigation is used instead of a hidden
  // iframe: Chrome increasingly blocks protocol navigations started from a
  // subframe, while a top-level one leaves the YouTube page untouched.
  function sendToObsidian() {
    var url = canonicalUrl(location.href);
    if (!url) {
      toast('No YouTube video on this page', true);
      return;
    }
    toast('Sent to Obsidian ✓ — nothing happened? Make sure Obsidian is running with the plugin enabled.');
    try {
      location.href = HANDOFF + encodeURIComponent(url);
    } catch (e) {
      toast('Could not hand off to Obsidian', true);
    }
  }

  /* ---------------- button ---------------- */

  // The SVG is built through DOMParser instead of innerHTML, so no markup is
  // parsed into the page DOM. It is static/trusted today; this keeps the sink
  // closed if it is ever templated from page data.
  function svgIcon() {
    var doc = new DOMParser().parseFromString(
      '<svg xmlns="http://www.w3.org/2000/svg" height="100%" viewBox="0 0 128 128" width="100%" fill="none">' +
        '<rect x="7" y="25" width="104" height="68" rx="18" fill="#FF0000"/>' +
        '<polygon points="47,39 47,79 81,59" fill="#fff"/>' +
      '</svg>',
      'image/svg+xml'
    );
    return doc.documentElement;
  }

  // Player control containers, most specific first. The desktop player (.ytp-*),
  // YouTube Music's bar (.ytmusic-*) and the /embed player do not share markup.
  // styled:false → keep the native .ytp-button metrics; styled:true → our own.
  var CONTAINERS = [
    { sel: '.ytp-right-controls', styled: false },
    { sel: '#movie_player .ytp-right-controls', styled: false },
    { sel: 'ytmusic-player-bar .right-controls-buttons', styled: true },
    { sel: 'ytmusic-player-bar .middle-controls-buttons', styled: true },
    { sel: '.ytmusic-player-bar', styled: true },
    { sel: 'ytmusic-player-bar', styled: true }
  ];

  // Returns { el, styled, overlay } or null when there is no player at all.
  function findContainer() {
    for (var i = 0; i < CONTAINERS.length; i++) {
      var c = document.querySelector(CONTAINERS[i].sel);
      if (c) return { el: c, styled: CONTAINERS[i].styled, overlay: false };
    }
    var p = document.querySelector('#movie_player, .html5-video-player, ytmusic-player');
    if (!p) {
      var video = document.querySelector('video');
      if (!video || !video.parentElement) return null;
      p = video.parentElement;
    }
    return { el: p, styled: true, overlay: true };
  }

  function mkBtn(styled) {
    var b = document.createElement('button');
    b.id = BTN;
    b.className = 'ytp-button';
    b.title = 'Send to Obsidian (Ctrl+Shift+Y)';
    b.setAttribute('aria-label', 'Send this video to Obsidian');
    if (styled) {
      b.style.cssText =
        'display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;margin:0 4px;' +
        'padding:0;background:none;border:0;cursor:pointer;opacity:.9';
    } else {
      b.style.marginTop = '-2px';
    }
    b.appendChild(svgIcon());
    b.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      sendToObsidian();
    });
    return b;
  }

  // Only used in the overlay fallback: anchor the button to the player box.
  // Declarations are set one by one — `style.cssText +=` re-parses the already
  // serialised text and quietly loses declarations.
  function asOverlay(host, btn) {
    var pos = window.getComputedStyle(host).position;
    if (pos === 'static' || pos === '') host.style.setProperty('position', 'relative');
    btn.style.setProperty('position', 'absolute');
    btn.style.setProperty('top', '10px');
    btn.style.setProperty('right', '56px');
    btn.style.setProperty('z-index', '64');
    btn.style.setProperty('border-radius', '6px');
    btn.style.setProperty('box-shadow', '0 1px 4px rgba(0,0,0,.4)');
  }

  function removeBtn() {
    var b = document.getElementById(BTN);
    if (b) b.remove();
  }

  function inject() {
    if (!isVideo()) {
      removeBtn(); // SPA navigation to a non-video page must not leave a stale button
      return false;
    }
    if (document.getElementById(BTN)) return true; // id-based duplicate guard
    var c = findContainer();
    if (!c) return false;
    var b = mkBtn(c.styled);
    if (c.overlay) asOverlay(c.el, b);
    // Sit before the cast / "play on TV" button on the desktop player.
    var cast = c.el.querySelector('.ytp-play-on-tv-button, button[aria-label*="TV"], button[aria-label*="Cast"]');
    var node = cast;
    while (node && node.parentElement !== c.el) node = node.parentElement;
    c.el.insertBefore(b, node || c.el.firstChild);
    return true;
  }

  /* ---------------- lifecycle ---------------- */

  try {
    chrome.runtime.onMessage.addListener(function (m) {
      if (m && m.type === 'send') sendToObsidian();
    });
  } catch (e) {}

  var IDLE_MS = 250; // mutation batches are throttled to this
  var RETRY_MS = 500; // poll cadence while the player has not mounted yet
  var RETRY_LIMIT = 30; // 30 × 500ms ≈ 15s, and only ever on a video page
  var WATCHDOG_MS = 1500;

  var navUrl = location.href;
  var gen = 0; // bumped on every navigation; a chain dies when it goes stale
  var lastSync = 0;
  var exhausted = false; // this page's chain spent its budget: stop re-arming for it

  // Exactly one observer for the whole life of the script: `arm` starts it,
  // `sleep` stops it, and `observing` turns a second start into a no-op, so two
  // observers can never pile up. observe() on the same instance would replace
  // its registration anyway, but the flag makes the invariant explicit.
  var observer = typeof MutationObserver === 'function' ? new MutationObserver(sync) : null;
  var observing = false;

  function arm() {
    if (observing || !observer || !document.body) return;
    observing = true;
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function sleep() {
    if (!observing) return;
    observing = false;
    observer.disconnect();
  }

  // Watch again + one fresh chain for the page we are on now.
  function wake() {
    arm();
    startChain();
  }

  function startChain() {
    gen += 1; // orphans every step still pending from the previous page
    attempt(gen, 0);
  }

  // One chain per navigation. `forGen` is the generation the chain was started
  // for, so a newer navigation invalidates the pending steps instead of letting
  // a second chain eat the same budget — the old shared counter reset to zero
  // for every chain still in flight. A page that is not a video page stops
  // immediately: whether there is anything to inject into is decided by the URL
  // alone, so polling cannot possibly help there.
  function attempt(forGen, tries) {
    if (forGen !== gen) return; // superseded by a newer navigation
    if (!isVideo()) {
      removeBtn();
      sleep();
      return;
    }
    if (inject()) {
      sleep(); // placed and the URL is stable → nothing left to watch for
      return;
    }
    if (tries + 1 >= RETRY_LIMIT) {
      exhausted = true;
      return;
    }
    setTimeout(function () {
      attempt(forGen, tries + 1);
    }, RETRY_MS);
  }

  // Navigation is a discrete, user-visible event, so it skips the throttle
  // below and starts a fresh chain: the stale button must not outlive it.
  function onNavigate() {
    var unchanged = location.href === navUrl;
    navUrl = location.href;
    lastSync = Date.now();
    exhausted = false;
    if (unchanged && document.getElementById(BTN)) return; // already in place
    if (!isVideo()) {
      gen += 1; // kill whatever the previous page left pending
      removeBtn();
      sleep();
      return;
    }
    wake();
  }

  // Only runs while armed, and is the only per-mutation work. Once the button
  // sits on a stable URL it disarms the observer, so YouTube's constant DOM
  // churn costs nothing from then on; the watchdog below takes over.
  function sync() {
    var now = Date.now();
    if (now - lastSync < IDLE_MS) return;
    lastSync = now;
    if (location.href !== navUrl) {
      onNavigate();
      return;
    }
    if (!isVideo()) {
      removeBtn();
      sleep();
      return;
    }
    if (inject()) sleep();
  }

  // The one timer that never stops, and the wake-up path for a disarmed
  // observer: a disconnected observer cannot hear the next mutation, so a player
  // rebuild that silently drops the button (theatre mode, miniplayer) would stay
  // invisible until the next navigation. That is why this heartbeat exists
  // instead of re-arming on mutation. Per tick it is a string compare plus — on
  // a video page only — one getElementById; `exhausted` keeps a page that has no
  // player at all from being re-armed forever, which is the deliberate
  // trade-off: such a page is given up on until the next navigation rather than
  // polled indefinitely.
  setInterval(function () {
    if (location.href !== navUrl) {
      onNavigate();
      return;
    }
    if (!isVideo() || observing || exhausted || document.getElementById(BTN)) return;
    wake();
  }, WATCHDOG_MS);

  // yt-navigate-finish fires on every internal navigation (heard on window and
  // document, whichever dispatches it). The observer is the fast path — it covers
  // the very first paint and any player that mounts late — and is disarmed again
  // as soon as the button sits. The delayed chain below is the slow path, and
  // exists because an observer only hears future mutations: a player that was
  // already in the DOM when this script ran will never announce itself.
  window.addEventListener('yt-navigate-finish', onNavigate);
  document.addEventListener('yt-navigate-finish', onNavigate);
  arm();

  if (document.readyState === 'complete') setTimeout(startChain, 600);
  else window.addEventListener('load', function () { setTimeout(startChain, 600); });
})();
