// OfficeLink SL — Document File I/O (.html)

import { getDocContent, setDocContent, markDocClean } from './doc-editor.js';
import { generateTimestampFilename } from '../export/filename-utils.js';

let currentHandle = null;
let currentName = 'untitled.html';

/**
 * Open an HTML document file
 */
export async function openDocFile() {
  if (window.showOpenFilePicker) {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'HTML Files', accept: { 'text/html': ['.html', '.htm'] } }],
    });
    const file = await handle.getFile();
    const text = await file.text();
    // Extract body content if full HTML document
    const content = extractBody(text);
    setDocContent(content);
    currentHandle = handle;
    currentName = file.name;
    return { name: file.name, content };
  }

  // Fallback for Safari/Firefox
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html,.htm';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return resolve(null);
      const text = await file.text();
      const content = extractBody(text);
      setDocContent(content);
      currentHandle = null;
      currentName = file.name;
      resolve({ name: file.name, content });
    };
    input.click();
  });
}

/**
 * Save document as full HTML file
 */
export async function saveDocFile() {
  const html = wrapFullHTML(getDocContent(), currentName);
  const tsName = generateTimestampFilename(currentName, 'html');

  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({
      suggestedName: tsName,
      types: [{ description: 'HTML Files', accept: { 'text/html': ['.html'] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(html);
    await writable.close();
    currentHandle = handle;
    currentName = handle.name || tsName;
    markDocClean();
    return { name: currentName };
  }

  // Fallback
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = tsName;
  a.click();
  URL.revokeObjectURL(url);
  markDocClean();
  return { name: tsName };
}

/**
 * Quick save (reuse existing handle)
 */
export async function quickSaveDoc() {
  if (currentHandle) {
    const html = wrapFullHTML(getDocContent(), currentName);
    const writable = await currentHandle.createWritable();
    await writable.write(html);
    await writable.close();
    markDocClean();
    return { name: currentName };
  }
  return saveDocFile();
}

export function getDocFileName() {
  return currentName;
}

export function setDocFileName(name) {
  currentName = name;
}

/** Extract body innerHTML from a full HTML string */
function extractBody(html) {
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return match ? match[1].trim() : html;
}

/** Wrap content in a full HTML document */
function wrapFullHTML(bodyContent, title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(title.replace(/\.html?$/i, ''))}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 210mm;
      margin: 0 auto;
      padding: 25.4mm;
      line-height: 1.6;
      color: #333;
    }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #ddd; padding: 6px 10px; }
    th { background: #f5f5f5; font-weight: 600; }
    img { max-width: 100%; }
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`;
}

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
