(function () {
  function ensureOverlay(gifSrc) {
    let el = document.getElementById('appLoadingOverlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'appLoadingOverlay';
      el.className = 'loading-overlay';
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-busy', 'false');
      el.innerHTML = `
        <div class="loading-box" role="status" aria-label="Loading">
          <img class="loading-gif" alt="Loading..." src="${gifSrc}">
          <div class="loading-text">Loading…</div>
        </div>`;
      document.body.appendChild(el);
    } else {
      const img = el.querySelector('img.loading-gif');
      if (img && gifSrc) img.src = gifSrc;
    }
    return el;
  }

  function lockScroll(lock) {
    const html = document.documentElement;
    if (lock) {
      html.dataset.prevOverflow = html.style.overflow || '';
      html.style.overflow = 'hidden';
    } else {
      html.style.overflow = html.dataset.prevOverflow || '';
      delete html.dataset.prevOverflow;
    }
  }

  let hideTimer = null;

  function showLoadingOverlay(opts = {}) {
    const {
      durationMs = 8000,
      navigateTo = null,
      gif = './assets/BeaconLoading.gif' // change to './asset/BeaconLoading.gif' if that’s your path
    } = opts;

    const overlay = ensureOverlay(gif);
    overlay.classList.add('show');
    overlay.setAttribute('aria-busy', 'true');
    lockScroll(true);

    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      hideLoadingOverlay();
      if (navigateTo) window.location.href = navigateTo;
    }, durationMs);
  }

  function hideLoadingOverlay() {
    const overlay = document.getElementById('appLoadingOverlay');
    if (!overlay) return;
    overlay.classList.remove('show');
    overlay.setAttribute('aria-busy', 'false');
    lockScroll(false);
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  // Expose globally (optional)
  window.showLoadingOverlay = showLoadingOverlay;
  window.hideLoadingOverlay = hideLoadingOverlay;

  // Wire the Admin menu by default when present
  document.addEventListener('DOMContentLoaded', () => {
    const adminLink = document.getElementById('menuAdmin');
    if (adminLink) {
      adminLink.addEventListener('click', (e) => {
        e.preventDefault();
        // Optionally read the href to navigate after loading
        const href = adminLink.getAttribute('href');
        showLoadingOverlay({ durationMs: 8000, navigateTo: href && href !== '#' ? href : null });
      });
    }
  });
})();