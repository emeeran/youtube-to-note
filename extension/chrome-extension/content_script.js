/**
 * YouTube Clipper Content Script
 * Injects a "Clip" button into the YouTube player
 */
(function () {
  const BUTTON_ID = 'youtube-clipper-button';
  const TOAST_ID = 'youtube-clipper-toast';

  // Find YouTube player controls
  function getVideoControls() {
    return (
      document.querySelector('.ytp-right-controls') ||
      document.querySelector('#top-level-buttons-computed') ||
      document.querySelector('#info-contents')
    );
  }

  // Create the Clip button
  function createButton() {
    if (document.getElementById(BUTTON_ID)) return null;

    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.title = 'Send to YouTube to Note in Obsidian (Ctrl+Shift+Y)';
    btn.setAttribute('aria-label', 'YouTube to Note');
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <line x1="10" y1="9" x2="8" y2="9"/>
    </svg>`;
    btn.style.cssText = `
      margin-left: 8px;
      padding: 6px;
      background: transparent;
      color: #fff;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      transition: background-color 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    `.replace(/\s+/g, ' ');

    btn.addEventListener('mouseenter', () => {
      btn.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.backgroundColor = 'transparent';
    });
    btn.addEventListener('click', onClick);
    
    return btn;
  }

  // Show toast notification
  function showToast(text, isError = false) {
    let el = document.getElementById(TOAST_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = TOAST_ID;
      el.style.cssText = `
        position: fixed;
        right: 20px;
        bottom: 80px;
        background: ${isError ? 'rgba(220, 38, 38, 0.95)' : 'rgba(124, 58, 237, 0.95)'};
        color: white;
        padding: 12px 18px;
        border-radius: 8px;
        z-index: 999999;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: opacity 0.3s ease;
      `.replace(/\s+/g, ' ');
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 2500);
  }

  // Send URL to Obsidian
  async function sendToObsidian(url) {
    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      showToast('✓ URL copied, opening Obsidian...');
    } catch (e) {
      console.warn('Clipper: clipboard write failed', e);
    }

    // Open Obsidian protocol
    try {
      const params = new URLSearchParams({ url });
      window.open('obsidian://youtube-to-note?' + params.toString());
    } catch (e) {
      showToast('✗ Failed to open Obsidian', true);
      console.error('Clipper: failed to open obsidian', e);
    }
  }

  // Handle button click
  function onClick() {
    sendToObsidian(location.href);
  }

  // Listen for keyboard shortcut from background
  chrome.runtime?.onMessage?.addListener((msg) => {
    if (msg?.type === 'send-current-video') {
      sendToObsidian(location.href);
    }
  });

  // Watch for YouTube SPA navigation and add button when player appears
  const observer = new MutationObserver(() => {
    const controls = getVideoControls();
    if (controls && !document.getElementById(BUTTON_ID)) {
      const btn = createButton();
      if (btn) controls.appendChild(btn);
    }
  });

  // Initialize
  function start() {
    const controls = getVideoControls();
    if (controls && !document.getElementById(BUTTON_ID)) {
      const btn = createButton();
      if (btn) controls.appendChild(btn);
    }
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Wait for page to load
  if (document.readyState === 'complete') {
    setTimeout(start, 500);
  } else {
    window.addEventListener('load', () => setTimeout(start, 500));
  }
})();
