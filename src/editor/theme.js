// OfficeLink SL — CodeMirror 6 Themes
import { EditorView } from 'codemirror';
import { oneDark } from '@codemirror/theme-one-dark';

// Light theme: minimal overrides — uses CSS custom properties
export const lightTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  '.cm-content': {
    caretColor: 'var(--brand-color)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--pane-header-bg)',
    color: 'var(--text-tertiary)',
    borderRight: '1px solid var(--border-color)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--hover-bg)',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--hover-bg)',
  },
}, { dark: false });

// Dark theme: based on One Dark
export const darkTheme = oneDark;
