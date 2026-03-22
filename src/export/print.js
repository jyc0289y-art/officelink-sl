// OfficeLink SL — Print & PDF Export

import { render } from '../preview/renderer.js';

/**
 * Print the rendered markdown
 * @param {string} markdownText - Current markdown content
 * @param {string} title - Document title
 */
export function printDocument(markdownText, title = 'OfficeLink SL') {
  const html = render(markdownText);
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #1d1d1f;
      line-height: 1.7;
      font-size: 14px;
    }
    h1 { font-size: 2em; border-bottom: 1px solid #e5e5ea; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #e5e5ea; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    pre { background: #f4f4f8; padding: 16px; border-radius: 8px; overflow-x: auto; border: 1px solid #e5e5ea; }
    code { font-family: 'SF Mono', 'Menlo', monospace; font-size: 0.88em; }
    table { width: 100%; border-collapse: collapse; margin: 1em 0; }
    th, td { border: 1px solid #e5e5ea; padding: 8px 12px; text-align: left; }
    th { background: #f5f5f7; font-weight: 600; }
    blockquote { border-left: 4px solid #e5e5ea; margin: 0; padding: 0.5em 1em; color: #6e6e73; }
    img { max-width: 100%; }
    a { color: #0071e3; }
    @media print {
      body { padding: 0; }
      pre { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>`);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
}
