(function () {
  const STORAGE_KEY = 'beacon_sidebar_collapsed_v1';

  function qs(id) { return document.getElementById(id); }

  function getState() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  }
  function setState(collapsed) {
    try { localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0'); } catch {}
  }

  function applyCollapsed(collapsed) {
    const sidebar = qs('sidebar');
    const toggle = qs('sidebarToggle');
    if (!sidebar) return;

    // Width
    sidebar.classList.toggle('w-64', !collapsed);
    sidebar.classList.toggle('w-16', collapsed);

    // Labels, tooltips, alignment
    const labels = sidebar.querySelectorAll('[data-link-label]');
    const links = sidebar.querySelectorAll('a[data-nav-link]');
    labels.forEach(lbl => lbl.classList.toggle('hidden', collapsed));
    links.forEach(a => {
      a.classList.toggle('justify-center', collapsed);
      const lbl = a.querySelector('[data-link-label]');
      if (lbl) a.title = collapsed ? lbl.textContent.trim() : '';
      // Icon spacing
      const icon = a.querySelector('img, svg');
      if (icon) {
        if (collapsed) icon.classList.remove('mr-2');
        else if (!icon.classList.contains('mr-2')) icon.classList.add('mr-2');
      }
    });

    // Header visibility (avatar + text)
    const headerText = sidebar.querySelector('[data-sidebar-header]');
    const avatar = sidebar.querySelector('[data-sidebar-avatar]');
    if (headerText) headerText.classList.toggle('hidden', collapsed);
    if (avatar) avatar.classList.toggle('hidden', collapsed);

    // Toggle button icons
    const iconCollapse = qs('iconCollapse');
    const iconExpand = qs('iconExpand');
    if (iconCollapse && iconExpand) {
      iconCollapse.classList.toggle('hidden', collapsed);
      iconExpand.classList.toggle('hidden', !collapsed);
    }

    // ARIA
    if (toggle) toggle.setAttribute('aria-expanded', (!collapsed).toString());
  }

  function init() {
    const sidebar = qs('sidebar');
    const toggle = qs('sidebarToggle');
    if (!sidebar || !toggle) return;

    applyCollapsed(getState());

    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      const next = !getState();
      setState(next);
      applyCollapsed(next);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();