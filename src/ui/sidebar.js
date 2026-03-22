// OfficeLink SL — Sidebar Toggle

let sidebarVisible = false;

/**
 * Initialize sidebar toggle
 */
export function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const btn = document.getElementById('btn-sidebar');

  if (btn) {
    btn.addEventListener('click', () => {
      sidebarVisible = !sidebarVisible;
      if (sidebar) {
        sidebar.classList.toggle('hidden', !sidebarVisible);
      }
    });
  }
}

/**
 * Show sidebar
 */
export function showSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebarVisible = true;
    sidebar.classList.remove('hidden');
  }
}

/**
 * Hide sidebar
 */
export function hideSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebarVisible = false;
    sidebar.classList.add('hidden');
  }
}
