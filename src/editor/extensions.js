// OfficeLink SL — CodeMirror 6 Extensions
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { search } from '@codemirror/search';

/**
 * Returns shared CM6 extensions (keymaps, search, etc.)
 */
export function getExtensions() {
  return [
    keymap.of([indentWithTab]),
    search(),
  ];
}
