// OfficeLink SL — Search (delegates to CM6 built-in search)
import { openSearchPanel } from '@codemirror/search';
import { getEditorView } from '../editor/editor.js';

/**
 * Open search panel in editor
 */
export function openSearch() {
  const view = getEditorView();
  if (view) {
    openSearchPanel(view);
  }
}
