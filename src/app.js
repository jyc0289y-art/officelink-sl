// MarkLink SL — App Controller
import { createEditor, onChange, getContent, setContent, wrapSelection } from './editor/editor.js';
import { initPreview, updatePreview, updatePreviewImmediate } from './preview/preview.js';
import { registerAllPlugins } from './preview/plugins.js';
import { getRenderer } from './preview/renderer.js';
import { initSplitPane } from './ui/split-pane.js';
import { initTheme, toggleTheme, isDark } from './ui/theme-toggle.js';
import { initToolbar } from './ui/toolbar.js';
import { initSidebar, showSidebar } from './ui/sidebar.js';
import { initShortcuts } from './ui/shortcuts.js';
import { openFile, saveFile, quickSave, getCurrentFileName, setFileName } from './file/file-manager.js';
import { initDragDrop } from './file/drag-drop.js';
import { renderRecentFiles } from './file/recent-files.js';
import { openFolder } from './file/folder-tree.js';
import { printDocument } from './export/print.js';
import { exportHTML } from './export/html.js';
import { exportPDF } from './export/pdf.js';
import { trackFileOpen, trackFileSave, trackExport, trackThemeToggle, trackToolbarAction, trackFolderOpen, initSessionTracking } from './analytics.js';
import { initTabs, onTabChange, getCurrentTab } from './ui/tabs.js';
import { initDocEditor, getDocContent } from './document/doc-editor.js';
import { openDocFile, saveDocFile, quickSaveDoc, getDocFileName, setDocFileName } from './document/doc-file.js';
import { initSheetEditor, getSheetsData } from './sheet/sheet-ui.js';
import { openSheetFile, saveSheetFile, getSheetFileName } from './sheet/sheet-file.js';
import { initSlideEditor } from './slide/slide-editor.js';
import { openSlideFile, saveSlideFile, getSlideFileName } from './slide/slide-file.js';
import { initPdfViewer, getPdfFileName } from './pdf/pdf-viewer.js';
import { initAiChat, setContextProviders } from './ai/ai-chat.js';

// Default welcome content
const WELCOME_MD = `# Welcome to MarkLink SL ✦

A powerful **Markdown viewer & editor** by SeouLink.

## Features

- 📝 **Split View** — Edit markdown on the left, see rendered preview on the right
- 🎨 **Syntax Highlighting** — Code blocks with language detection
- 🌙 **Dark Mode** — Toggle with the moon icon or auto-detect system preference
- 📂 **File Management** — Open, save, and drag-and-drop \`.md\` files
- 📁 **Folder Browser** — Browse directories (Chrome/Edge)
- 🔍 **Search** — Press \`Cmd+F\` to search within the editor
- 📤 **Export** — Print or export as standalone HTML

## Quick Start

1. **Open a file**: Click 📂 or press \`⌘O\`
2. **Save**: Press \`⌘S\`
3. **Toggle theme**: Click 🌙
4. **Search**: Press \`⌘F\`

## Checklist

- [x] Create project structure
- [x] Implement split view editor
- [x] Add syntax highlighting
- [ ] Deploy to GitHub Pages
- [ ] Share with team

## Code Block

\`\`\`javascript
async function fetchData(url) {
  const response = await fetch(url);
  return await response.json();
}
\`\`\`

\`\`\`python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
\`\`\`

## Table

| Feature | Description | Status |
|---------|-------------|--------|
| Editor | CodeMirror 6 | ✅ |
| Preview | markdown-it | ✅ |
| Math | KaTeX | ✅ |
| Diagrams | Mermaid | ✅ |

## Math (KaTeX)

Inline math: $E = mc^2$

Block math:

$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$

## Diagram (Mermaid)

\`\`\`mermaid
graph LR
    A[Open File] --> B[Edit MD]
    B --> C[Live Preview]
    C --> D{Done?}
    D -->|Yes| E[Export]
    D -->|No| B
\`\`\`

## Blockquote

> The best way to predict the future is to create it.
> — *Peter Drucker*

---

*Start editing to see live preview!*
`;

/**
 * Initialize the MarkLink SL application
 */
export async function initApp() {
  // 1. Register markdown-it plugins (async — KaTeX, task lists)
  const md = getRenderer();
  await registerAllPlugins(md);

  // 2. Initialize theme (before editor creation)
  // Note: initTheme calls setEditorTheme internally, but editor doesn't exist yet.
  // So we just detect the theme first.
  // Default to dark mode unless user explicitly chose light
  const savedTheme = localStorage.getItem('marklink-theme');
  const prefersDark = savedTheme === 'light' ? false : true; // dark by default

  // 3. Create editor
  const editorContainer = document.getElementById('editor-container');
  const previewContent = document.getElementById('preview-content');
  createEditor(editorContainer, WELCOME_MD, prefersDark);

  // 4. Initialize preview
  initPreview(previewContent);
  updatePreviewImmediate(WELCOME_MD);

  // 5. Connect editor changes to preview
  onChange((content) => {
    updatePreview(content);
  });

  // 6. Initialize split pane
  const divider = document.getElementById('divider');
  const editorPane = document.getElementById('editor-pane');
  const previewPane = document.getElementById('preview-pane');
  initSplitPane(divider, editorPane, previewPane);

  // 7. Initialize theme toggle (now editor exists)
  initTheme();

  // 8. Theme toggle button
  const themeBtn = document.getElementById('btn-theme');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      toggleTheme();
      trackThemeToggle(isDark() ? 'dark' : 'light');
    });
  }

  // 9. Toolbar actions
  initToolbar();

  // 10. Sidebar
  initSidebar();

  // 11. File operations
  const fileNameEl = document.getElementById('file-name');

  function updateFileName(name) {
    setFileName(name);
    if (fileNameEl) fileNameEl.textContent = name;
    document.title = `${name} — MarkLink SL`;
  }

  function loadFile({ name, content }) {
    updateFileName(name);
    setContent(content);
    updatePreviewImmediate(content);
    renderRecentFiles(document.getElementById('recent-files'), (n) => {
      // Recent file click — can't reopen without handle, just update name
      console.log('Recent file clicked:', n);
    });
  }

  // Open file button — dispatches by active tab
  const openBtn = document.getElementById('btn-open');
  if (openBtn) {
    openBtn.addEventListener('click', async () => {
      try {
        const tab = getCurrentTab();
        let result;
        if (tab === 'document') {
          result = await openDocFile();
        } else if (tab === 'sheet') {
          result = await openSheetFile();
        } else if (tab === 'slide') {
          result = await openSlideFile();
        } else {
          result = await openFile();
          if (result) loadFile(result);
        }
        if (result) {
          updateFileName(result.name);
          trackFileOpen(result.name);
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.error('Open file error:', e);
      }
    });
  }

  // Save file button — dispatches by active tab
  const saveBtn = document.getElementById('btn-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      try {
        const tab = getCurrentTab();
        let result;
        if (tab === 'document') {
          result = await saveDocFile();
        } else if (tab === 'sheet') {
          result = await saveSheetFile();
        } else if (tab === 'slide') {
          result = await saveSlideFile();
        } else {
          result = await saveFile(getContent());
        }
        if (result) {
          updateFileName(result.name);
          trackFileSave(result.name);
        }
      } catch (e) {
        console.error('Save file error:', e);
      }
    });
  }

  // Open folder button
  const openFolderBtn = document.getElementById('btn-open-folder');
  if (openFolderBtn) {
    openFolderBtn.addEventListener('click', async () => {
      const tree = await openFolder(loadFile);
      if (tree) {
        trackFolderOpen();
        const treeContainer = document.getElementById('folder-tree');
        if (treeContainer) {
          treeContainer.innerHTML = '';
          treeContainer.appendChild(tree);
        }
        showSidebar();
      }
    });
  }

  // 12. Drag and drop
  initDragDrop(loadFile);

  // 13. Export button (dropdown or direct HTML export)
  const exportBtn = document.getElementById('btn-export');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      showExportMenu(exportBtn);
    });
  }

  // 14. Keyboard shortcuts
  initShortcuts({
    open: async () => {
      try {
        const tab = getCurrentTab();
        let result;
        if (tab === 'document') result = await openDocFile();
        else if (tab === 'sheet') result = await openSheetFile();
        else if (tab === 'slide') result = await openSlideFile();
        else { result = await openFile(); if (result) loadFile(result); }
        if (result) updateFileName(result.name);
      } catch (e) {
        if (e.name !== 'AbortError') console.error(e);
      }
    },
    save: async () => {
      try {
        const tab = getCurrentTab();
        let result;
        if (tab === 'document') result = await quickSaveDoc();
        else if (tab === 'sheet') result = await saveSheetFile();
        else if (tab === 'slide') result = await saveSlideFile();
        else { result = await quickSave(getContent()); }
        if (result) updateFileName(result.name);
      } catch (e) {
        console.error(e);
      }
    },
    bold: () => {
      if (getCurrentTab() === 'document') document.execCommand('bold');
      else wrapSelection('**');
    },
    italic: () => {
      if (getCurrentTab() === 'document') document.execCommand('italic');
      else wrapSelection('*');
    },
    print: () => printDocument(
      getCurrentTab() === 'document' ? getDocContent() : getContent(),
      getCurrentTab() === 'document' ? getDocFileName() : getCurrentFileName()
    ),
  });

  // 15. Render recent files
  renderRecentFiles(document.getElementById('recent-files'), (name) => {
    console.log('Recent file clicked:', name);
  });

  // 16. Scroll sync
  initScrollSync(editorContainer, document.getElementById('preview-container'));

  // 17. Tab navigation
  initTabs();
  initDocEditor();
  initSheetEditor();
  initSlideEditor();
  initPdfViewer();

  // Update filename display on tab switch
  onTabChange((tab) => {
    if (tab === 'document') updateFileName(getDocFileName());
    else if (tab === 'sheet') updateFileName(getSheetFileName());
    else if (tab === 'slide') updateFileName(getSlideFileName());
    else if (tab === 'pdf') updateFileName(getPdfFileName());
    else updateFileName(getCurrentFileName());
  });

  // 18. AI Chat (Local LLM)
  initAiChat();
  setContextProviders({
    getDocContent: () => getDocContent(),
    getSheetText: () => {
      try { return JSON.stringify(getSheetsData()); }
      catch { return ''; }
    },
    getMarkdownContent: () => getContent(),
    insertContent: (text) => {
      const tab = getCurrentTab();
      if (tab === 'document') {
        // Insert at cursor in document editor
        const docEl = document.getElementById('doc-editor');
        if (docEl) {
          docEl.focus();
          document.execCommand('insertHTML', false, text.replace(/\n/g, '<br>'));
        }
      } else {
        // Insert at cursor in markdown editor
        const content = getContent();
        setContent(content + '\n\n' + text);
        updatePreviewImmediate(getContent());
      }
    },
  });

  // 19. Analytics — session duration tracking
  initSessionTracking();
}

/**
 * Show export dropdown menu
 */
function showExportMenu(anchorBtn) {
  // Remove existing menu
  const existing = document.querySelector('.export-menu');
  if (existing) {
    existing.remove();
    return;
  }

  const menu = document.createElement('div');
  menu.className = 'export-menu';
  menu.style.cssText = `
    position: absolute;
    right: 12px;
    top: 82px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    padding: 4px;
    z-index: 100;
    min-width: 160px;
  `;

  const items = [
    { label: '🖨️ Print', action: () => { trackExport('print'); printDocument(getContent(), getCurrentFileName()); } },
    { label: '📄 Export as PDF', action: () => { trackExport('pdf'); exportPDF(getContent(), getCurrentFileName()); } },
    { label: '🌐 Export as HTML', action: () => { trackExport('html'); exportHTML(getContent(), getCurrentFileName()); } },
  ];

  items.forEach(({ label, action }) => {
    const item = document.createElement('button');
    item.textContent = label;
    item.style.cssText = `
      display: block;
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: transparent;
      color: var(--text-primary);
      font-size: 13px;
      text-align: left;
      cursor: pointer;
      border-radius: 4px;
    `;
    item.addEventListener('mouseenter', () => item.style.background = 'var(--hover-bg)');
    item.addEventListener('mouseleave', () => item.style.background = 'transparent');
    item.addEventListener('click', () => {
      menu.remove();
      action();
    });
    menu.appendChild(item);
  });

  document.body.appendChild(menu);

  // Close on outside click
  setTimeout(() => {
    const closeHandler = (e) => {
      if (!menu.contains(e.target) && e.target !== anchorBtn) {
        menu.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  }, 0);
}

/**
 * Simple proportional scroll sync
 */
function initScrollSync(editorContainer, previewContainer) {
  if (!previewContainer) return;

  let syncing = false;

  // Editor scroll → preview scroll
  const editorScroller = editorContainer?.querySelector('.cm-scroller');
  if (editorScroller) {
    editorScroller.addEventListener('scroll', () => {
      if (syncing) return;
      syncing = true;
      const ratio = editorScroller.scrollTop / (editorScroller.scrollHeight - editorScroller.clientHeight || 1);
      previewContainer.scrollTop = ratio * (previewContainer.scrollHeight - previewContainer.clientHeight);
      requestAnimationFrame(() => { syncing = false; });
    });
  }
}
