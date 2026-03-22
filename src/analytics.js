// OfficeLink SL — GA4 Event Tracking

function send(eventName, params = {}) {
  if (typeof gtag === 'function') {
    gtag('event', eventName, params);
  }
}

/** File opened */
export function trackFileOpen(fileName) {
  send('file_open', { file_name: fileName });
}

/** File saved */
export function trackFileSave(fileName) {
  send('file_save', { file_name: fileName });
}

/** Export action */
export function trackExport(format) {
  send('export', { format });
}

/** Theme toggled */
export function trackThemeToggle(theme) {
  send('theme_toggle', { theme });
}

/** Feature usage (bold, italic, heading, code, list, link, table) */
export function trackToolbarAction(action) {
  send('toolbar_action', { action });
}

/** Folder opened */
export function trackFolderOpen() {
  send('folder_open');
}

/** Session duration — call on page unload */
export function initSessionTracking() {
  const start = Date.now();
  window.addEventListener('beforeunload', () => {
    const duration = Math.round((Date.now() - start) / 1000);
    send('session_duration', { duration_seconds: duration });
  });
}
