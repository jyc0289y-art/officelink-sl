// MarkLink SL — PDF Export (direct download via html2pdf.js)
import { render } from '../preview/renderer.js';

/**
 * Export rendered markdown directly as PDF file
 * @param {string} markdownText - Markdown content
 * @param {string} title - Document title / filename
 */
export async function exportPDF(markdownText, title = 'document') {
  const html = render(markdownText);

  // Create a temporary container for PDF rendering
  const container = document.createElement('div');
  container.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    width: 210mm;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.7;
    color: #1d1d1f;
    background: #ffffff;
    padding: 20mm 15mm;
  `;
  container.innerHTML = `
    <style>
      .pdf-body h1, .pdf-body h2, .pdf-body h3, .pdf-body h4, .pdf-body h5, .pdf-body h6 {
        margin-top: 1.2em; margin-bottom: 0.5em; font-weight: 700; color: #1d1d1f;
      }
      .pdf-body h1 { font-size: 1.8em; border-bottom: 1px solid #e5e5ea; padding-bottom: 0.3em; }
      .pdf-body h2 { font-size: 1.4em; border-bottom: 1px solid #e5e5ea; padding-bottom: 0.3em; }
      .pdf-body h3 { font-size: 1.2em; }
      .pdf-body p { margin-bottom: 0.8em; }
      .pdf-body a { color: #0071e3; text-decoration: none; }
      .pdf-body ul, .pdf-body ol { margin-bottom: 0.8em; padding-left: 2em; }
      .pdf-body li { margin-bottom: 0.2em; }
      .pdf-body code {
        padding: 0.1em 0.3em; font-size: 0.85em;
        background: #f4f4f8; border-radius: 3px;
        font-family: 'SF Mono', 'Menlo', monospace;
      }
      .pdf-body pre {
        margin-bottom: 0.8em; padding: 12px; overflow-x: auto;
        background: #f4f4f8; border-radius: 6px; border: 1px solid #e5e5ea;
        page-break-inside: avoid;
      }
      .pdf-body pre code { padding: 0; background: transparent; font-size: 0.85em; }
      .pdf-body blockquote {
        margin: 0 0 0.8em 0; padding: 0.5em 1em;
        border-left: 4px solid #e5e5ea; color: #6e6e73;
      }
      .pdf-body table { width: 100%; margin-bottom: 0.8em; border-collapse: collapse; }
      .pdf-body th, .pdf-body td { padding: 6px 10px; border: 1px solid #e5e5ea; text-align: left; }
      .pdf-body th { font-weight: 600; background: #f5f5f7; }
      .pdf-body hr { height: 1px; margin: 1.5em 0; background: #e5e5ea; border: none; }
      .pdf-body img { max-width: 100%; }
      .pdf-body .mermaid svg { max-width: 100%; }
      .pdf-body .katex-display { margin: 0.8em 0; }
    </style>
    <div class="pdf-body">${html}</div>
  `;
  document.body.appendChild(container);

  // Wait a bit for KaTeX/images to render
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    const html2pdf = (await import('html2pdf.js')).default;

    const filename = title.replace(/\.(md|markdown)$/i, '') + '.pdf';

    await html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
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
    // Fallback to print dialog
    const { printDocument } = await import('./print.js');
    printDocument(markdownText, title);
  } finally {
    document.body.removeChild(container);
  }
}
