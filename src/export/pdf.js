// OfficeLink SL — PDF Export (direct download via html2pdf.js)
import { render } from '../preview/renderer.js';
import { generateTimestampFilename } from './filename-utils.js';

// Theme color palettes
const THEMES = {
  light: {
    bg: '#ffffff',
    text: '#1d1d1f',
    textSecondary: '#6e6e73',
    border: '#e5e5ea',
    codeBg: '#f4f4f8',
    headerBg: '#f5f5f7',
    link: '#0071e3',
    codeText: '#e83e8c',
  },
  dark: {
    bg: '#1c1c1e',
    text: '#f5f5f7',
    textSecondary: '#a1a1a6',
    border: '#38383a',
    codeBg: '#2c2c2e',
    headerBg: '#2c2c2e',
    link: '#2997ff',
    codeText: '#ff6b9d',
  },
};

/**
 * Show PDF export dialog with theme selection and filename
 * @param {string} markdownText - Markdown content
 * @param {string} originalFileName - Original loaded filename
 */
export function exportPDF(markdownText, originalFileName = 'document') {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const defaultFilename = generateTimestampFilename(originalFileName, 'pdf');

  showExportDialog({
    defaultFilename,
    currentTheme,
    onExport: (filename, theme) => {
      generatePDF(markdownText, filename, theme);
    },
  });
}

/**
 * Show export settings dialog
 */
function showExportDialog({ defaultFilename, currentTheme, onExport }) {
  // Remove existing dialog
  document.querySelector('.pdf-export-dialog-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'pdf-export-dialog-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 2000;
    background: rgba(0,0,0,0.5); display: flex;
    align-items: center; justify-content: center;
  `;

  const dialog = document.createElement('div');
  dialog.className = 'pdf-export-dialog';
  dialog.style.cssText = `
    background: var(--bg-primary); border-radius: 14px;
    padding: 28px 32px; width: 420px; max-width: 90vw;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    border: 1px solid var(--border-color);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

  dialog.innerHTML = `
    <h3 style="margin: 0 0 20px; font-size: 17px; font-weight: 700; color: var(--text-primary);">
      📄 Export as PDF
    </h3>

    <div style="margin-bottom: 16px;">
      <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px;">
        File Name
      </label>
      <input type="text" id="pdf-filename" value="${defaultFilename}"
        style="width: 100%; padding: 8px 12px; border-radius: 8px;
        border: 1px solid var(--border-color); background: var(--bg-secondary, var(--bg-primary));
        color: var(--text-primary); font-size: 14px; outline: none;
        box-sizing: border-box;"
      />
    </div>

    <div style="margin-bottom: 20px;">
      <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">
        PDF Theme
      </label>
      <div style="display: flex; gap: 10px;">
        <button id="pdf-theme-light" class="theme-option" data-theme="light" style="
          flex: 1; padding: 14px 12px; border-radius: 10px; cursor: pointer;
          border: 2px solid ${currentTheme === 'light' ? 'var(--brand-color)' : 'var(--border-color)'};
          background: #ffffff; text-align: center; transition: border-color 0.15s;
        ">
          <div style="font-size: 24px; margin-bottom: 4px;">☀️</div>
          <div style="font-size: 13px; font-weight: 600; color: #1d1d1f;">Light</div>
          <div style="font-size: 11px; color: #6e6e73; margin-top: 2px;">White background</div>
        </button>
        <button id="pdf-theme-dark" class="theme-option" data-theme="dark" style="
          flex: 1; padding: 14px 12px; border-radius: 10px; cursor: pointer;
          border: 2px solid ${currentTheme === 'dark' ? 'var(--brand-color)' : 'var(--border-color)'};
          background: #1c1c1e; text-align: center; transition: border-color 0.15s;
        ">
          <div style="font-size: 24px; margin-bottom: 4px;">🌙</div>
          <div style="font-size: 13px; font-weight: 600; color: #f5f5f7;">Dark</div>
          <div style="font-size: 11px; color: #a1a1a6; margin-top: 2px;">Dark background</div>
        </button>
      </div>
    </div>

    <div style="display: flex; gap: 10px; justify-content: flex-end;">
      <button id="pdf-cancel" style="
        padding: 8px 20px; border-radius: 8px; border: 1px solid var(--border-color);
        background: transparent; color: var(--text-primary); font-size: 14px;
        cursor: pointer; font-weight: 500;
      ">Cancel</button>
      <button id="pdf-export-btn" style="
        padding: 8px 24px; border-radius: 8px; border: none;
        background: var(--brand-color); color: white; font-size: 14px;
        cursor: pointer; font-weight: 600;
      ">Export PDF</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Theme selection logic
  let selectedTheme = currentTheme;
  const lightBtn = dialog.querySelector('#pdf-theme-light');
  const darkBtn = dialog.querySelector('#pdf-theme-dark');

  function selectTheme(theme) {
    selectedTheme = theme;
    lightBtn.style.borderColor = theme === 'light' ? 'var(--brand-color)' : 'var(--border-color)';
    darkBtn.style.borderColor = theme === 'dark' ? 'var(--brand-color)' : 'var(--border-color)';
  }

  lightBtn.addEventListener('click', () => selectTheme('light'));
  darkBtn.addEventListener('click', () => selectTheme('dark'));

  // Cancel
  const close = () => overlay.remove();
  dialog.querySelector('#pdf-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  // Export
  dialog.querySelector('#pdf-export-btn').addEventListener('click', () => {
    const filename = dialog.querySelector('#pdf-filename').value.trim() || defaultFilename;
    close();
    onExport(filename, selectedTheme);
  });

  // Focus filename input and select basename
  const input = dialog.querySelector('#pdf-filename');
  input.focus();
  const dotIdx = input.value.lastIndexOf('.');
  if (dotIdx > 0) input.setSelectionRange(0, dotIdx);

  // Enter key to export
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      dialog.querySelector('#pdf-export-btn').click();
    }
    if (e.key === 'Escape') close();
  });
}

/**
 * Generate PDF with specified theme
 */
async function generatePDF(markdownText, filename, theme = 'light') {
  const html = render(markdownText);
  const colors = THEMES[theme];

  const container = document.createElement('div');
  container.style.cssText = `
    position: absolute; left: -9999px; top: 0; width: 210mm;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px; line-height: 1.7;
    color: ${colors.text}; background: ${colors.bg};
    padding: 20mm 15mm;
  `;
  container.innerHTML = `
    <style>
      .pdf-body { color: ${colors.text}; }
      .pdf-body h1, .pdf-body h2, .pdf-body h3, .pdf-body h4, .pdf-body h5, .pdf-body h6 {
        margin-top: 1.2em; margin-bottom: 0.5em; font-weight: 700; color: ${colors.text};
      }
      .pdf-body h1 { font-size: 1.8em; border-bottom: 1px solid ${colors.border}; padding-bottom: 0.3em; }
      .pdf-body h2 { font-size: 1.4em; border-bottom: 1px solid ${colors.border}; padding-bottom: 0.3em; }
      .pdf-body h3 { font-size: 1.2em; }
      .pdf-body p { margin-bottom: 0.8em; color: ${colors.text}; }
      .pdf-body a { color: ${colors.link}; text-decoration: none; }
      .pdf-body ul, .pdf-body ol { margin-bottom: 0.8em; padding-left: 2em; color: ${colors.text}; }
      .pdf-body li { margin-bottom: 0.2em; }
      .pdf-body strong { color: ${colors.text}; }
      .pdf-body em { color: ${colors.text}; }
      .pdf-body code {
        padding: 0.1em 0.3em; font-size: 0.85em;
        background: ${colors.codeBg}; border-radius: 3px;
        font-family: 'SF Mono', 'Menlo', monospace;
        color: ${colors.codeText};
      }
      .pdf-body pre {
        margin-bottom: 0.8em; padding: 12px; overflow-x: auto;
        background: ${colors.codeBg}; border-radius: 6px;
        border: 1px solid ${colors.border};
        page-break-inside: avoid;
      }
      .pdf-body pre code {
        padding: 0; background: transparent;
        font-size: 0.85em; color: ${colors.text};
      }
      .pdf-body blockquote {
        margin: 0 0 0.8em 0; padding: 0.5em 1em;
        border-left: 4px solid ${colors.border}; color: ${colors.textSecondary};
        background: ${colors.codeBg};
      }
      .pdf-body table { width: 100%; margin-bottom: 0.8em; border-collapse: collapse; }
      .pdf-body th, .pdf-body td {
        padding: 6px 10px; border: 1px solid ${colors.border};
        text-align: left; color: ${colors.text};
      }
      .pdf-body th { font-weight: 600; background: ${colors.headerBg}; }
      .pdf-body tr:nth-child(even) td { background: ${theme === 'dark' ? '#252528' : '#fafafa'}; }
      .pdf-body hr { height: 1px; margin: 1.5em 0; background: ${colors.border}; border: none; }
      .pdf-body img { max-width: 100%; }
      .pdf-body .mermaid svg { max-width: 100%; }
      .pdf-body .katex-display { margin: 0.8em 0; }
      .pdf-body .katex { color: ${colors.text}; }
      .pdf-body .task-list-item { list-style: none; margin-left: -1.5em; }
      .pdf-body del { color: ${colors.textSecondary}; }
    </style>
    <div class="pdf-body">${html}</div>
  `;
  document.body.appendChild(container);

  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    const html2pdf = (await import('html2pdf.js')).default;

    // Ensure .pdf extension
    if (!filename.endsWith('.pdf')) filename += '.pdf';

    await html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          backgroundColor: colors.bg,
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      })
      .from(container.querySelector('.pdf-body'))
      .save();
  } catch (e) {
    console.error('PDF export error:', e);
    const { printDocument } = await import('./print.js');
    printDocument(markdownText, filename);
  } finally {
    document.body.removeChild(container);
  }
}
