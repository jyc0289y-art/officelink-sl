// OfficeLink SL — App Controller
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
import { initPdfViewer, getPdfFileName, getPdfText, getPdfPageImages, openPdf } from './pdf/pdf-viewer.js';
import { initAiChat, setContextProviders, enterAiFullscreen, exitAiFullscreen } from './ai/ai-chat.js';
import { initI18n, setLang, getLang, showLanguagePicker, onLangChange } from './ui/i18n.js';

// Default welcome content
const WELCOME_MD = `# Welcome to OfficeLink SL ✦

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
 * Initialize the OfficeLink SL application
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
    document.title = `${name} — OfficeLink SL`;
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
        } else if (tab === 'pdf') {
          await openPdf();
          return; // openPdf handles its own filename update
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
        else if (tab === 'pdf') { await openPdf(); return; }
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

  // Update filename display on tab switch + AI fullscreen mode
  onTabChange((tab, prevTab) => {
    if (tab === 'document') updateFileName(getDocFileName());
    else if (tab === 'sheet') updateFileName(getSheetFileName());
    else if (tab === 'slide') updateFileName(getSlideFileName());
    else if (tab === 'pdf') updateFileName(getPdfFileName());
    else if (tab === 'ai') updateFileName('AI Assistant');
    else updateFileName(getCurrentFileName());

    // AI fullscreen mode
    if (tab === 'ai') enterAiFullscreen();
    else if (prevTab === 'ai') exitAiFullscreen();
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
    getPdfText: () => getPdfText(),
    getPdfImages: () => getPdfPageImages(),
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

  // 19. Fullscreen toggle
  const fullscreenBtn = document.getElementById('btn-fullscreen');
  const fullscreenIcon = document.getElementById('fullscreen-icon');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen();
      }
    });
    document.addEventListener('fullscreenchange', () => {
      if (fullscreenIcon) {
        fullscreenIcon.textContent = document.fullscreenElement ? '⛶' : '⛶';
      }
      fullscreenBtn.classList.toggle('active', !!document.fullscreenElement);
    });
  }

  // 20. Analytics — session duration tracking
  initSessionTracking();

  // 20. Internationalization
  initI18n();
  const langBtn = document.getElementById('lang-btn');
  if (langBtn) {
    langBtn.addEventListener('click', () => showLanguagePicker());
  }

  // 21. First-time user onboarding tour
  initOnboardingTour();

  // 22. Tutorial button — restart tour
  const tutorialBtn = document.getElementById('btn-tutorial');
  if (tutorialBtn) {
    tutorialBtn.addEventListener('click', () => {
      localStorage.removeItem('marklink-tour-done');
      startOnboardingTour();
    });
  }
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
 * First-time user onboarding tour — auto-start on first visit
 */
function initOnboardingTour() {
  const TOUR_KEY = 'marklink-tour-done';
  if (localStorage.getItem(TOUR_KEY)) return;

  const waitAndStart = () => {
    if (document.querySelector('.lang-recommend-overlay')) {
      setTimeout(waitAndStart, 1000);
      return;
    }
    setTimeout(() => startOnboardingTour(), 800);
  };

  setTimeout(waitAndStart, 2000);
}

/**
 * Onboarding tour — can be called from tutorial button or auto-start
 */
function startOnboardingTour() {
  const TOUR_KEY = 'marklink-tour-done';

  // Remove any existing tour
  document.querySelector('.tour-tooltip')?.remove();
  document.querySelector('.tour-highlight')?.classList.remove('tour-highlight');

  const dontShowLabel = { en: "Don't show again", ko: '다시 보지 않기', ja: '今後表示しない', zh: '不再显示', es: 'No mostrar de nuevo', fr: 'Ne plus afficher' };
  const nextLabel = { en: 'Next', ko: '다음', ja: '次へ', zh: '下一步', es: 'Siguiente', fr: 'Suivant' };
  const doneLabel = { en: 'Done', ko: '완료', ja: '完了', zh: '完成', es: 'Listo', fr: 'Terminé' };

  const steps = [
    {
      target: '#btn-open',
      text: { en: 'Open files here, or drag & drop them onto the app.', ko: '여기서 파일을 열거나 앱에 드래그&드롭하세요.', ja: 'ここでファイルを開くか、アプリにドラッグ&ドロップしてください。', zh: '在这里打开文件，或将文件拖放到应用中。', es: 'Abre archivos aquí o arrástralos a la aplicación.', fr: 'Ouvrez des fichiers ici ou glissez-déposez-les dans l\'application.' },
    },
    {
      target: '#btn-save',
      text: { en: 'Save your current work. Your changes are preserved locally.', ko: '현재 작업을 저장합니다. 변경사항이 로컬에 보존됩니다.', ja: '現在の作業を保存します。変更はローカルに保存されます。', zh: '保存当前工作。您的更改将保存在本地。', es: 'Guarda tu trabajo actual. Los cambios se conservan localmente.', fr: 'Enregistrez votre travail. Vos modifications sont conservées localement.' },
    },
    {
      target: '.tab-bar',
      text: { en: 'Switch between Document, Sheet, Slide, PDF, Markdown, and AI tabs to access different editors.', ko: 'Document, Sheet, Slide, PDF, Markdown, AI 탭을 전환하여 다양한 편집기에 접근합니다.', ja: 'Document、Sheet、Slide、PDF、Markdown、AIタブを切り替えて各エディタにアクセスします。', zh: '切换Document、Sheet、Slide、PDF、Markdown和AI选项卡以访问不同的编辑器。', es: 'Cambia entre las pestañas Document, Sheet, Slide, PDF, Markdown y AI para acceder a diferentes editores.', fr: 'Basculez entre les onglets Document, Sheet, Slide, PDF, Markdown et AI pour accéder aux différents éditeurs.' },
    },
    {
      target: '#btn-export',
      text: { en: 'Export your work as PDF, HTML, DOCX, or print directly.', ko: 'PDF, HTML, DOCX로 내보내기하거나 직접 인쇄하세요.', ja: 'PDF、HTML、DOCXでエクスポートするか、直接印刷してください。', zh: '将您的工作导出为PDF、HTML、DOCX或直接打印。', es: 'Exporta tu trabajo como PDF, HTML, DOCX o imprime directamente.', fr: 'Exportez votre travail en PDF, HTML, DOCX ou imprimez directement.' },
    },
    {
      target: '#btn-ai',
      text: { en: 'Quick AI access! Open the AI sidebar from any tab to analyze, translate, or summarize documents — runs free on your PC.', ko: '빠른 AI 접근! 어떤 탭에서든 AI 사이드바를 열어 문서 분석, 번역, 요약이 가능합니다. PC에서 무료로 동작합니다.', ja: 'クイックAIアクセス！どのタブからでもAIサイドバーを開いて文書の分析・翻訳・要約が可能です。PCで無料で動作します。', zh: '快速AI访问！从任何选项卡打开AI侧边栏来分析、翻译或总结文档——在您的PC上免费运行。', es: '¡Acceso rápido a IA! Abre la barra lateral de IA desde cualquier pestaña para analizar, traducir o resumir documentos — funciona gratis en tu PC.', fr: 'Accès rapide à l\'IA ! Ouvrez le panneau IA depuis n\'importe quel onglet pour analyser, traduire ou résumer des documents — fonctionne gratuitement sur votre PC.' },
    },
    {
      target: '[data-tab="ai"]',
      text: { en: 'Dedicated AI tab for the full AI experience. Chat with your documents, get writing help, and more.', ko: '전용 AI 탭에서 풀 AI 경험을 제공합니다. 문서와 대화하고, 작성 도움을 받으세요.', ja: '専用AIタブでフルAI体験を。文書とチャットしたり、執筆支援を受けたりできます。', zh: '专用AI选项卡提供完整的AI体验。与文档对话、获取写作帮助等。', es: 'Pestaña AI dedicada para la experiencia completa de IA. Chatea con tus documentos, obtén ayuda para escribir y más.', fr: 'Onglet IA dédié pour l\'expérience IA complète. Discutez avec vos documents, obtenez de l\'aide à la rédaction et plus.' },
    },
    {
      target: '#btn-fullscreen',
      text: { en: 'Go fullscreen for a distraction-free experience — makes the app feel like a desktop application.', ko: '전체 화면으로 전환하여 집중 모드로 사용하세요. 데스크톱 앱처럼 사용할 수 있습니다.', ja: 'フルスクリーンで集中モードに。デスクトップアプリのように使えます。', zh: '全屏模式让您专注工作——使应用如同桌面应用一样运行。', es: 'Pantalla completa para una experiencia sin distracciones — la app se siente como una aplicación de escritorio.', fr: 'Passez en plein écran pour une expérience sans distraction — l\'application ressemble à une application de bureau.' },
    },
    {
      target: '#lang-btn',
      text: { en: 'Change your language anytime by clicking here. 30+ languages are supported!', ko: '여기를 클릭해서 언제든 언어를 변경할 수 있습니다. 30개 이상의 언어를 지원합니다!', ja: 'ここをクリックしていつでも言語を変更できます。30以上の言語をサポート！', zh: '随时点击这里更改语言。支持30多种语言！', es: '¡Cambia el idioma en cualquier momento haciendo clic aquí. Más de 30 idiomas disponibles!', fr: 'Changez la langue à tout moment en cliquant ici. Plus de 30 langues disponibles !' },
    },
    {
      target: '#btn-tutorial',
      text: { en: 'Click here anytime to see this tutorial again!', ko: '언제든 여기를 클릭하면 이 튜토리얼을 다시 볼 수 있습니다!', ja: 'いつでもここをクリックしてこのチュートリアルを再表示できます！', zh: '随时点击这里再次查看此教程！', es: '¡Haz clic aquí en cualquier momento para ver este tutorial de nuevo!', fr: 'Cliquez ici à tout moment pour revoir ce tutoriel !' },
    },
  ];

  const lang = getLang();
  const getText = (obj) => obj[lang] || obj.en;

  function showStep(index) {
    document.querySelector('.tour-tooltip')?.remove();
    document.querySelector('.tour-highlight')?.classList.remove('tour-highlight');

    if (index >= steps.length) {
      localStorage.setItem(TOUR_KEY, '1');
      return;
    }

    const step = steps[index];
    const target = document.querySelector(step.target);
    if (!target) { showStep(index + 1); return; }

    target.classList.add('tour-highlight');
    const rect = target.getBoundingClientRect();

    const isLast = index >= steps.length - 1;
    const tooltip = document.createElement('div');
    tooltip.className = 'tour-tooltip';
    tooltip.innerHTML = `
      <div class="tour-tooltip-text">${getText(step.text)}</div>
      <div class="tour-tooltip-actions">
        <span class="tour-tooltip-progress">${index + 1} / ${steps.length}</span>
        <button class="tour-tooltip-dismiss">${getText(dontShowLabel)}</button>
        <button class="tour-tooltip-next">${isLast ? getText(doneLabel) : getText(nextLabel)}</button>
      </div>
    `;

    // Position below target
    tooltip.style.top = (rect.bottom + 10) + 'px';
    tooltip.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 340)) + 'px';

    tooltip.querySelector('.tour-tooltip-next').addEventListener('click', () => showStep(index + 1));
    tooltip.querySelector('.tour-tooltip-dismiss').addEventListener('click', () => {
      document.querySelector('.tour-tooltip')?.remove();
      document.querySelector('.tour-highlight')?.classList.remove('tour-highlight');
      localStorage.setItem(TOUR_KEY, '1');
    });

    document.body.appendChild(tooltip);
  }

  showStep(0);
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
