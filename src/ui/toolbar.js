// OfficeLink SL — Toolbar Actions
import { wrapSelection, insertAtCursor } from '../editor/editor.js';

/**
 * Initialize toolbar button actions
 */
export function initToolbar() {
  bind('btn-bold', () => wrapSelection('**'));
  bind('btn-italic', () => wrapSelection('*'));
  bind('btn-heading', () => insertAtCursor('\n## '));
  bind('btn-code', () => insertAtCursor('\n```\n\n```\n'));
  bind('btn-list', () => insertAtCursor('\n- '));
  bind('btn-link', () => wrapSelection('[', '](url)'));
  bind('btn-table', () => insertAtCursor('\n| Header | Header |\n|--------|--------|\n| Cell   | Cell   |\n'));
}

function bind(id, action) {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener('click', action);
}
