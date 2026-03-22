// MarkLink SL — Document Editor (WYSIWYG)

let editorEl = null;
let dirty = false;

export function initDocEditor() {
  editorEl = document.getElementById('doc-editor');
  if (!editorEl) return;

  // Track dirty state
  editorEl.addEventListener('input', () => { dirty = true; });

  // Formatting commands
  document.querySelectorAll('.doc-cmd').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in editor
    btn.addEventListener('click', () => {
      document.execCommand(btn.dataset.cmd, false, null);
      editorEl.focus();
    });
  });

  // Heading select
  const headingSelect = document.getElementById('doc-heading');
  if (headingSelect) {
    headingSelect.addEventListener('change', () => {
      const val = headingSelect.value;
      if (val) {
        document.execCommand('formatBlock', false, val);
      } else {
        document.execCommand('formatBlock', false, 'P');
      }
      editorEl.focus();
    });
  }

  // Font family
  const fontFamily = document.getElementById('doc-font-family');
  if (fontFamily) {
    fontFamily.addEventListener('change', () => {
      document.execCommand('fontName', false, fontFamily.value);
      editorEl.focus();
    });
  }

  // Font size (via style, not execCommand fontSize which uses 1-7 scale)
  const fontSize = document.getElementById('doc-font-size');
  if (fontSize) {
    fontSize.addEventListener('change', () => {
      editorEl.style.fontSize = fontSize.value;
      editorEl.focus();
    });
  }

  // Text color
  const textColor = document.getElementById('doc-color');
  if (textColor) {
    textColor.addEventListener('input', () => {
      document.execCommand('foreColor', false, textColor.value);
      editorEl.focus();
    });
  }

  // Background/highlight color
  const bgColor = document.getElementById('doc-bg-color');
  if (bgColor) {
    bgColor.addEventListener('input', () => {
      document.execCommand('hiliteColor', false, bgColor.value);
      editorEl.focus();
    });
  }

  // Insert link
  const linkBtn = document.getElementById('doc-insert-link');
  if (linkBtn) {
    linkBtn.addEventListener('click', () => {
      const url = prompt('Enter URL:');
      if (url) document.execCommand('createLink', false, url);
      editorEl.focus();
    });
  }

  // Insert image
  const imgBtn = document.getElementById('doc-insert-image');
  if (imgBtn) {
    imgBtn.addEventListener('click', () => {
      const url = prompt('Enter image URL:');
      if (url) document.execCommand('insertImage', false, url);
      editorEl.focus();
    });
  }

  // Insert table
  const tableBtn = document.getElementById('doc-insert-table');
  if (tableBtn) {
    tableBtn.addEventListener('click', () => {
      const rows = parseInt(prompt('Rows:', '3'), 10) || 3;
      const cols = parseInt(prompt('Columns:', '3'), 10) || 3;
      const table = buildTable(rows, cols);
      insertHTMLAtCursor(table);
      editorEl.focus();
    });
  }

  // Insert horizontal rule
  const hrBtn = document.getElementById('doc-insert-hr');
  if (hrBtn) {
    hrBtn.addEventListener('click', () => {
      document.execCommand('insertHorizontalRule', false, null);
      editorEl.focus();
    });
  }

  // HWPX import
  const hwpxImportBtn = document.getElementById('doc-import-hwpx');
  if (hwpxImportBtn) {
    hwpxImportBtn.addEventListener('click', async () => {
      const { importHwpx } = await import('./hwpx.js');
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.hwpx,.hwp';
      input.onchange = async () => {
        if (!input.files[0]) return;
        try {
          const result = await importHwpx(input.files[0]);
          const fileNameEl = document.getElementById('file-name');
          if (fileNameEl) fileNameEl.textContent = result.name;
        } catch (e) {
          alert('HWPX import error: ' + e.message);
        }
      };
      input.click();
    });
  }

  // HWPX export
  const hwpxExportBtn = document.getElementById('doc-export-hwpx');
  if (hwpxExportBtn) {
    hwpxExportBtn.addEventListener('click', async () => {
      const { exportHwpx } = await import('./hwpx.js');
      try {
        await exportHwpx('document');
      } catch (e) {
        if (e.name !== 'AbortError') alert('HWPX export error: ' + e.message);
      }
    });
  }

  // Keyboard shortcuts within doc editor
  editorEl.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
      switch (e.key.toLowerCase()) {
        case 'b': e.preventDefault(); document.execCommand('bold'); break;
        case 'i': e.preventDefault(); document.execCommand('italic'); break;
        case 'u': e.preventDefault(); document.execCommand('underline'); break;
      }
    }
  });
}

function buildTable(rows, cols) {
  let html = '<table><thead><tr>';
  for (let c = 0; c < cols; c++) html += `<th>Header ${c + 1}</th>`;
  html += '</tr></thead><tbody>';
  for (let r = 0; r < rows - 1; r++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) html += '<td>&nbsp;</td>';
    html += '</tr>';
  }
  html += '</tbody></table><p>&nbsp;</p>';
  return html;
}

function insertHTMLAtCursor(html) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const frag = range.createContextualFragment(html);
  range.insertNode(frag);
  sel.collapseToEnd();
}

/** Get document HTML content */
export function getDocContent() {
  return editorEl ? editorEl.innerHTML : '';
}

/** Set document HTML content */
export function setDocContent(html) {
  if (editorEl) {
    editorEl.innerHTML = html;
    dirty = false;
  }
}

/** Check if document has unsaved changes */
export function isDocDirty() {
  return dirty;
}

/** Mark document as saved */
export function markDocClean() {
  dirty = false;
}
