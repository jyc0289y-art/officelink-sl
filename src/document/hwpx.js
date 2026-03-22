// OfficeLink SL — HWPX Import/Export (한컴오피스 OWPML / KS X 6101)
// Custom implementation — MIT-compatible, no AGPL dependencies

import JSZip from 'jszip';
import { setDocContent, getDocContent, markDocClean } from './doc-editor.js';
import { generateTimestampFilename } from '../export/filename-utils.js';

/**
 * Import a .hwpx file → Document editor
 */
export async function importHwpx(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  // Read sections
  const sections = [];
  let i = 0;
  while (true) {
    const sectionFile = zip.file(`Contents/section${i}.xml`);
    if (!sectionFile) break;
    const xml = await sectionFile.async('string');
    sections.push(xml);
    i++;
  }

  if (sections.length === 0) {
    throw new Error('No sections found in HWPX file');
  }

  // Parse OWPML XML → HTML
  let html = '';
  for (const xml of sections) {
    html += parseOwpmlToHTML(xml);
  }

  setDocContent(html || '<p>(Empty document)</p>');
  markDocClean();
  return { name: file.name, content: html };
}

/**
 * Export Document editor content → .hwpx file
 */
export async function exportHwpx(fileName) {
  const content = getDocContent();
  const zip = new JSZip();

  // mimetype (must be first, uncompressed)
  zip.file('mimetype', 'application/hwp+zip');

  // META-INF/manifest.xml
  zip.file('META-INF/manifest.xml', `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry manifest:media-type="application/hwp+zip" manifest:full-path="/"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="Contents/header.xml"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="Contents/section0.xml"/>
</manifest:manifest>`);

  // Contents/header.xml
  zip.file('Contents/header.xml', `<?xml version="1.0" encoding="UTF-8"?>
<hp:head xmlns:hp="http://www.hancom.co.kr/hwpml/2011/head">
  <hp:beginNum page="1" footnote="1" endnote="1"/>
  <hp:refList>
    <hp:fontfaces>
      <hp:fontface lang="HANGUL"><hp:font face="맑은 고딕"/></hp:fontface>
      <hp:fontface lang="LATIN"><hp:font face="Arial"/></hp:fontface>
    </hp:fontfaces>
  </hp:refList>
</hp:head>`);

  // Contents/section0.xml — convert HTML to OWPML
  const sectionXml = htmlToOwpml(content);
  zip.file('Contents/section0.xml', sectionXml);

  // Contents/content.hpf
  zip.file('Contents/content.hpf', `<?xml version="1.0" encoding="UTF-8"?>
<opf:package xmlns:opf="http://www.idpf.org/2007/opf" version="1.0">
  <opf:spine>
    <opf:itemref idref="section0"/>
  </opf:spine>
</opf:package>`);

  // Generate file
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/hwp+zip' });
  const tsName = generateTimestampFilename(fileName || 'document', 'hwpx');

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: tsName,
        types: [{ description: 'HWPX Files', accept: { 'application/hwp+zip': ['.hwpx'] } }],
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
 * Parse OWPML section XML → HTML
 */
function parseOwpmlToHTML(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  let html = '';

  // Find all paragraphs: <hp:p> or <p> (namespace may vary)
  const paragraphs = doc.querySelectorAll('p');
  for (const p of paragraphs) {
    const runs = p.querySelectorAll('run, r');
    if (runs.length === 0) {
      // Try direct text
      const texts = p.querySelectorAll('t');
      if (texts.length > 0) {
        let text = '';
        for (const t of texts) text += t.textContent;
        html += `<p>${escapeHTML(text)}</p>\n`;
      } else if (p.textContent.trim()) {
        html += `<p>${escapeHTML(p.textContent)}</p>\n`;
      }
      continue;
    }

    let paraHTML = '';
    let isBold = false;
    for (const run of runs) {
      const charPr = run.querySelector('charPr, rPr');
      if (charPr) {
        isBold = charPr.getAttribute('bold') === '1' || charPr.getAttribute('b') === '1';
      }
      const texts = run.querySelectorAll('t');
      for (const t of texts) {
        let text = escapeHTML(t.textContent);
        if (isBold) text = `<strong>${text}</strong>`;
        paraHTML += text;
      }
    }

    // Check paragraph style for headings
    const pPr = p.querySelector('paraPr, pPr');
    const styleId = pPr?.getAttribute('styleIDRef') || pPr?.getAttribute('style') || '';
    if (styleId.includes('제목') || styleId.includes('Heading') || styleId.includes('heading')) {
      if (styleId.includes('1')) html += `<h1>${paraHTML}</h1>\n`;
      else if (styleId.includes('2')) html += `<h2>${paraHTML}</h2>\n`;
      else if (styleId.includes('3')) html += `<h3>${paraHTML}</h3>\n`;
      else html += `<h2>${paraHTML}</h2>\n`;
    } else {
      html += `<p>${paraHTML || '&nbsp;'}</p>\n`;
    }
  }

  return html;
}

/**
 * Convert HTML content → OWPML section XML
 */
function htmlToOwpml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');
  const body = doc.body;

  let owpml = `<?xml version="1.0" encoding="UTF-8"?>
<hp:sec xmlns:hp="http://www.hancom.co.kr/hwpml/2011/body"
        xmlns:hp1="http://www.hancom.co.kr/hwpml/2011/para">
`;

  for (const node of body.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (text) owpml += wrapParagraph(text);
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const tag = node.tagName.toLowerCase();
    const text = node.textContent;

    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      owpml += wrapParagraph(text, `Heading${tag[1]}`);
    } else if (tag === 'ul' || tag === 'ol') {
      for (const li of node.querySelectorAll('li')) {
        owpml += wrapParagraph(li.textContent);
      }
    } else {
      // Check for inline formatting
      const runs = extractRuns(node);
      owpml += wrapParagraphWithRuns(runs);
    }
  }

  owpml += '</hp:sec>';
  return owpml;
}

function wrapParagraph(text, styleId) {
  const styleAttr = styleId ? ` styleIDRef="${styleId}"` : '';
  return `  <hp:p>
    <hp:paraPr${styleAttr}/>
    <hp:run>
      <hp:t>${escapeXML(text)}</hp:t>
    </hp:run>
  </hp:p>\n`;
}

function wrapParagraphWithRuns(runs) {
  let xml = '  <hp:p>\n    <hp:paraPr/>\n';
  for (const run of runs) {
    const boldAttr = run.bold ? ' bold="1"' : '';
    xml += `    <hp:run>
      <hp:charPr${boldAttr}/>
      <hp:t>${escapeXML(run.text)}</hp:t>
    </hp:run>\n`;
  }
  xml += '  </hp:p>\n';
  return xml;
}

function extractRuns(el) {
  const runs = [];
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent) runs.push({ text: child.textContent, bold: false });
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName.toLowerCase();
      const isBold = tag === 'strong' || tag === 'b';
      runs.push({ text: child.textContent, bold: isBold });
    }
  }
  return runs.length ? runs : [{ text: el.textContent || '', bold: false }];
}

function escapeHTML(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeXML(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
