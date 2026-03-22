// MarkLink SL — PDF Viewer (using PDF.js)

import * as pdfjsLib from 'pdfjs-dist';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).href;

let pdfDoc = null;
let currentPage = 1;
let scale = 1.0;
let currentName = '';

let pagesEl, emptyEl, pageNumEl, pageCountEl, zoomInfoEl, containerEl;

export function initPdfViewer() {
  pagesEl = document.getElementById('pdf-pages');
  emptyEl = document.getElementById('pdf-empty');
  pageNumEl = document.getElementById('pdf-page-num');
  pageCountEl = document.getElementById('pdf-page-count');
  zoomInfoEl = document.getElementById('pdf-zoom-info');
  containerEl = document.getElementById('pdf-container');
  if (!pagesEl) return;

  bindEvents();
}

function bindEvents() {
  document.getElementById('pdf-open')?.addEventListener('click', openPdf);
  document.getElementById('pdf-prev')?.addEventListener('click', prevPage);
  document.getElementById('pdf-next')?.addEventListener('click', nextPage);
  document.getElementById('pdf-zoom-in')?.addEventListener('click', () => setZoom(scale + 0.25));
  document.getElementById('pdf-zoom-out')?.addEventListener('click', () => setZoom(scale - 0.25));
  document.getElementById('pdf-fit')?.addEventListener('click', fitWidth);

  // MD → PDF: switch to markdown tab's export
  document.getElementById('pdf-convert-md')?.addEventListener('click', () => {
    // Import dynamically to avoid circular deps
    import('../export/pdf.js').then(({ exportPDF }) => {
      import('../editor/editor.js').then(({ getContent }) => {
        import('../file/file-manager.js').then(({ getCurrentFileName }) => {
          exportPDF(getContent(), getCurrentFileName());
        });
      });
    });
  });

  // Doc → PDF
  document.getElementById('pdf-convert-doc')?.addEventListener('click', () => {
    import('../document/doc-editor.js').then(({ getDocContent }) => {
      import('../document/doc-file.js').then(({ getDocFileName }) => {
        const content = getDocContent();
        const name = getDocFileName();
        // Use html2pdf via the existing export module
        import('../export/pdf.js').then(({ exportPDF }) => {
          // Wrap doc content as markdown-ish HTML for the PDF exporter
          exportPDF(content, name);
        });
      });
    });
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    const pdfView = document.getElementById('view-pdf');
    if (!pdfView?.classList.contains('active') || !pdfDoc) return;

    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault();
      nextPage();
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      prevPage();
    }
  });
}

async function openPdf() {
  let file;
  if (window.showOpenFilePicker) {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }],
    });
    file = await handle.getFile();
  } else {
    file = await new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf';
      input.onchange = () => resolve(input.files[0]);
      input.click();
    });
  }

  if (!file) return;
  currentName = file.name;

  const data = await file.arrayBuffer();
  await loadPdfData(data);

  // Update filename display
  const fileNameEl = document.getElementById('file-name');
  if (fileNameEl) fileNameEl.textContent = currentName;
  document.title = `${currentName} — MarkLink SL`;
}

async function loadPdfData(data) {
  pdfDoc = await pdfjsLib.getDocument({ data }).promise;
  currentPage = 1;
  scale = 1.0;

  emptyEl?.classList.add('hidden');
  updatePageInfo();
  await renderAllPages();
}

async function renderAllPages() {
  pagesEl.innerHTML = '';
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.dataset.page = i;

    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    pagesEl.appendChild(canvas);
  }
}

function updatePageInfo() {
  if (pageNumEl) pageNumEl.textContent = currentPage;
  if (pageCountEl) pageCountEl.textContent = pdfDoc ? pdfDoc.numPages : 0;
  if (zoomInfoEl) zoomInfoEl.textContent = Math.round(scale * 100) + '%';
}

function prevPage() {
  if (!pdfDoc || currentPage <= 1) return;
  currentPage--;
  scrollToPage(currentPage);
  updatePageInfo();
}

function nextPage() {
  if (!pdfDoc || currentPage >= pdfDoc.numPages) return;
  currentPage++;
  scrollToPage(currentPage);
  updatePageInfo();
}

function scrollToPage(num) {
  const canvas = pagesEl?.querySelector(`canvas[data-page="${num}"]`);
  if (canvas) canvas.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function setZoom(newScale) {
  if (!pdfDoc) return;
  scale = Math.max(0.25, Math.min(5, newScale));
  updatePageInfo();
  await renderAllPages();
}

async function fitWidth() {
  if (!pdfDoc || !containerEl) return;
  const page = await pdfDoc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const containerWidth = containerEl.clientWidth - 48; // padding
  scale = containerWidth / viewport.width;
  updatePageInfo();
  await renderAllPages();
}

export function getPdfFileName() {
  return currentName || 'untitled.pdf';
}
