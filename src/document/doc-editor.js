// MarkLink SL — Document Editor (WYSIWYG)

let editorEl = null;
let dirty = false;

export function initDocEditor() {
  editorEl = document.getElementById('doc-editor');
  if (!editorEl) return;

  // Track dirty state + word count
  editorEl.addEventListener('input', () => {
    dirty = true;
    updateWordCount();
  });

  // Undo / Redo buttons
  const undoBtn = document.getElementById('doc-undo');
  if (undoBtn) {
    undoBtn.addEventListener('mousedown', (e) => e.preventDefault());
    undoBtn.addEventListener('click', () => { document.execCommand('undo'); editorEl.focus(); });
  }
  const redoBtn = document.getElementById('doc-redo');
  if (redoBtn) {
    redoBtn.addEventListener('mousedown', (e) => e.preventDefault());
    redoBtn.addEventListener('click', () => { document.execCommand('redo'); editorEl.focus(); });
  }

  // Find/Replace
  initFindReplace();

  // Formatting commands
  document.querySelectorAll('.doc-cmd').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => e.preventDefault());
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
      document.execCommand('formatBlock', false, val || 'P');
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

  // Font size
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
  document.getElementById('doc-insert-link')?.addEventListener('click', () => {
    const url = prompt('Enter URL:');
    if (url) document.execCommand('createLink', false, url);
    editorEl.focus();
  });

  // Insert image
  document.getElementById('doc-insert-image')?.addEventListener('click', () => {
    const url = prompt('Enter image URL:');
    if (url) document.execCommand('insertImage', false, url);
    editorEl.focus();
  });

  // Insert table
  document.getElementById('doc-insert-table')?.addEventListener('click', () => {
    const rows = parseInt(prompt('Rows:', '3'), 10) || 3;
    const cols = parseInt(prompt('Columns:', '3'), 10) || 3;
    insertHTMLAtCursor(buildTable(rows, cols));
    editorEl.focus();
  });

  // Insert horizontal rule
  document.getElementById('doc-insert-hr')?.addEventListener('click', () => {
    document.execCommand('insertHorizontalRule', false, null);
    editorEl.focus();
  });

  // HWPX import
  document.getElementById('doc-import-hwpx')?.addEventListener('click', async () => {
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
        updateWordCount();
      } catch (e) {
        alert('HWPX import error: ' + e.message);
      }
    };
    input.click();
  });

  // HWPX export
  document.getElementById('doc-export-hwpx')?.addEventListener('click', async () => {
    const { exportHwpx } = await import('./hwpx.js');
    try {
      await exportHwpx('document');
    } catch (e) {
      if (e.name !== 'AbortError') alert('HWPX export error: ' + e.message);
    }
  });

  // DOCX import
  document.getElementById('doc-import-docx')?.addEventListener('click', async () => {
    const { importDocx } = await import('./docx.js');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.docx';
    input.onchange = async () => {
      if (!input.files[0]) return;
      try {
        const result = await importDocx(input.files[0]);
        const fileNameEl = document.getElementById('file-name');
        if (fileNameEl) fileNameEl.textContent = result.name;
        updateWordCount();
      } catch (e) {
        alert('DOCX import error: ' + e.message);
      }
    };
    input.click();
  });

  // DOCX export
  document.getElementById('doc-export-docx')?.addEventListener('click', async () => {
    const { exportDocx } = await import('./docx.js');
    try {
      await exportDocx('document');
    } catch (e) {
      if (e.name !== 'AbortError') alert('DOCX export error: ' + e.message);
    }
  });

  // Keyboard shortcuts within doc editor
  editorEl.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
      switch (e.key.toLowerCase()) {
        case 'b': e.preventDefault(); document.execCommand('bold'); break;
        case 'i': e.preventDefault(); document.execCommand('italic'); break;
        case 'u': e.preventDefault(); document.execCommand('underline'); break;
        case 'z': e.preventDefault(); document.execCommand('undo'); break;
        case 'f': e.preventDefault(); toggleFindBar(); break;
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      document.execCommand('redo');
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      toggleFindBar(true);
    }
  });

  // Initial word count
  updateWordCount();
}

// ─── Find / Replace ────────────────────────────────────────
let findBarEl = null;
let findInput = null;
let replaceInput = null;
let highlightedNodes = [];

function initFindReplace() {
  findBarEl = document.getElementById('doc-find-bar');
  findInput = document.getElementById('doc-find-input');
  replaceInput = document.getElementById('doc-replace-input');
  if (!findBarEl || !findInput) return;

  findInput.addEventListener('input', () => doFind());
  document.getElementById('doc-find-next')?.addEventListener('click', () => doFind(true));
  document.getElementById('doc-find-prev')?.addEventListener('click', () => doFind(false));
  document.getElementById('doc-replace-btn')?.addEventListener('click', () => doReplace());
  document.getElementById('doc-replace-all')?.addEventListener('click', () => doReplaceAll());
  document.getElementById('doc-find-close')?.addEventListener('click', () => closeFindBar());
}

function toggleFindBar(showReplace) {
  if (!findBarEl) return;
  const isOpen = !findBarEl.classList.contains('hidden');
  if (isOpen && !showReplace) {
    closeFindBar();
    return;
  }
  findBarEl.classList.remove('hidden');
  if (showReplace) {
    findBarEl.classList.add('show-replace');
  }
  findInput?.focus();

  // Pre-fill with selection
  const sel = window.getSelection();
  if (sel && sel.toString().trim()) {
    findInput.value = sel.toString().trim();
    doFind();
  }
}

function closeFindBar() {
  if (findBarEl) {
    findBarEl.classList.add('hidden');
    findBarEl.classList.remove('show-replace');
  }
  clearHighlights();
  editorEl?.focus();
}

function doFind(forward = true) {
  clearHighlights();
  const query = findInput?.value;
  if (!query || !editorEl) return;

  const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT);
  let node;
  const matches = [];
  while ((node = walker.nextNode())) {
    let idx = 0;
    const text = node.textContent;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    while ((idx = lowerText.indexOf(lowerQuery, idx)) !== -1) {
      matches.push({ node, start: idx, length: query.length });
      idx += query.length;
    }
  }

  if (matches.length === 0) {
    updateFindCount(0, 0);
    return;
  }

  // Highlight all matches
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const range = document.createRange();
    range.setStart(m.node, m.start);
    range.setEnd(m.node, m.start + m.length);
    const span = document.createElement('mark');
    span.className = 'doc-find-highlight';
    range.surroundContents(span);
    highlightedNodes.push(span);
  }
  highlightedNodes.reverse();

  // Focus first match
  if (highlightedNodes.length > 0) {
    highlightedNodes[0].classList.add('doc-find-current');
    highlightedNodes[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  updateFindCount(1, highlightedNodes.length);
}

function clearHighlights() {
  for (const span of highlightedNodes) {
    const parent = span.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(span.textContent), span);
      parent.normalize();
    }
  }
  highlightedNodes = [];
}

function updateFindCount(current, total) {
  const countEl = document.getElementById('doc-find-count');
  if (countEl) countEl.textContent = total > 0 ? `${current}/${total}` : 'No results';
}

function doReplace() {
  if (!replaceInput || highlightedNodes.length === 0) return;
  const current = highlightedNodes.find(n => n.classList.contains('doc-find-current'));
  if (current) {
    current.replaceWith(document.createTextNode(replaceInput.value));
    editorEl?.normalize();
    dirty = true;
  }
  highlightedNodes = highlightedNodes.filter(n => n !== current);
  doFind();
}

function doReplaceAll() {
  if (!replaceInput || highlightedNodes.length === 0) return;
  for (const span of highlightedNodes) {
    span.replaceWith(document.createTextNode(replaceInput.value));
  }
  editorEl?.normalize();
  highlightedNodes = [];
  dirty = true;
  updateFindCount(0, 0);
}

// ─── Word Count ────────────────────────────────────────────
function updateWordCount() {
  const statusEl = document.getElementById('doc-status-bar');
  if (!statusEl || !editorEl) return;
  const text = editorEl.innerText || '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  const charsNoSpace = text.replace(/\s/g, '').length;
  const paras = editorEl.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li').length || 1;
  statusEl.textContent = `Words: ${words}  |  Characters: ${chars} (${charsNoSpace})  |  Paragraphs: ${paras}`;
}

// ─── Helpers ────────────────────────────────────────────────
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
    updateWordCount();
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
