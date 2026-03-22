// OfficeLink SL — DOCX Import/Export
// mammoth.js (MIT) for import, docx (MIT) for export

import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
         Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { setDocContent, getDocContent, markDocClean } from './doc-editor.js';
import { generateTimestampFilename } from '../export/filename-utils.js';

/**
 * Import a .docx file → Document editor
 */
export async function importDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = result.value || '<p>(Empty document)</p>';

  setDocContent(html);
  markDocClean();
  return { name: file.name, content: html };
}

/**
 * Export Document editor content → .docx file
 */
export async function exportDocx(fileName) {
  const content = getDocContent();
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${content}</body>`, 'text/html');
  const body = doc.body;

  const children = [];
  for (const node of body.childNodes) {
    const items = convertNode(node);
    children.push(...items);
  }

  if (children.length === 0) {
    children.push(new Paragraph({ children: [new TextRun('')] }));
  }

  const docx = new Document({
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(docx);
  const tsName = generateTimestampFilename(fileName || 'document', 'docx');

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: tsName,
        types: [{ description: 'Word Documents', accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { name: handle.name || tsName };
    } catch (e) {
      if (e.name === 'AbortError') return null;
      throw e;
    }
  }

  // Fallback download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = tsName;
  a.click();
  URL.revokeObjectURL(url);
  return { name: tsName };
}

/**
 * Convert HTML DOM node → docx elements
 */
function convertNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent.trim();
    if (!text) return [];
    return [new Paragraph({ children: [new TextRun(text)] })];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  const tag = node.tagName.toLowerCase();

  // Headings
  const headingMap = {
    h1: HeadingLevel.HEADING_1,
    h2: HeadingLevel.HEADING_2,
    h3: HeadingLevel.HEADING_3,
    h4: HeadingLevel.HEADING_4,
    h5: HeadingLevel.HEADING_5,
    h6: HeadingLevel.HEADING_6,
  };
  if (headingMap[tag]) {
    return [new Paragraph({
      heading: headingMap[tag],
      children: extractTextRuns(node),
    })];
  }

  // Paragraph
  if (tag === 'p' || tag === 'div') {
    const align = getAlignment(node);
    return [new Paragraph({
      alignment: align,
      children: extractTextRuns(node),
    })];
  }

  // Lists
  if (tag === 'ul' || tag === 'ol') {
    const items = [];
    for (const li of node.querySelectorAll(':scope > li')) {
      items.push(new Paragraph({
        bullet: tag === 'ul' ? { level: 0 } : undefined,
        numbering: tag === 'ol' ? { reference: 'default-numbering', level: 0 } : undefined,
        children: extractTextRuns(li),
      }));
    }
    return items;
  }

  // Table
  if (tag === 'table') {
    return [convertTable(node)];
  }

  // Blockquote
  if (tag === 'blockquote') {
    return [new Paragraph({
      indent: { left: 720 },
      children: extractTextRuns(node),
    })];
  }

  // HR
  if (tag === 'hr') {
    return [new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6 } },
      children: [new TextRun('')],
    })];
  }

  // Fallback: treat as paragraph
  if (node.textContent.trim()) {
    return [new Paragraph({ children: extractTextRuns(node) })];
  }
  return [];
}

function extractTextRuns(el) {
  const runs = [];
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent) {
        runs.push(new TextRun({ text: child.textContent }));
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const ctag = child.tagName.toLowerCase();
      const isBold = ctag === 'strong' || ctag === 'b';
      const isItalic = ctag === 'em' || ctag === 'i';
      const isUnderline = ctag === 'u';
      const isStrike = ctag === 's' || ctag === 'del' || ctag === 'strike';

      if (ctag === 'br') {
        runs.push(new TextRun({ break: 1 }));
        continue;
      }

      // Recursively get text from nested elements
      const text = child.textContent;
      if (text) {
        runs.push(new TextRun({
          text,
          bold: isBold || undefined,
          italics: isItalic || undefined,
          underline: isUnderline ? {} : undefined,
          strike: isStrike || undefined,
        }));
      }
    }
  }
  return runs.length ? runs : [new TextRun('')];
}

function getAlignment(el) {
  const style = el.style?.textAlign || '';
  if (style === 'center') return AlignmentType.CENTER;
  if (style === 'right') return AlignmentType.RIGHT;
  if (style === 'justify') return AlignmentType.JUSTIFIED;
  return AlignmentType.LEFT;
}

function convertTable(tableEl) {
  const rows = [];
  for (const tr of tableEl.querySelectorAll('tr')) {
    const cells = [];
    for (const td of tr.querySelectorAll('td, th')) {
      cells.push(new TableCell({
        children: [new Paragraph({ children: extractTextRuns(td) })],
        width: { size: 100 / tr.children.length, type: WidthType.PERCENTAGE },
      }));
    }
    if (cells.length > 0) {
      rows.push(new TableRow({ children: cells }));
    }
  }
  if (rows.length === 0) {
    rows.push(new TableRow({
      children: [new TableCell({ children: [new Paragraph('')] })],
    }));
  }
  return new Table({ rows });
}
