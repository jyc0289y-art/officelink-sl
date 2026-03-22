// OfficeLink SL — Slide File I/O

import { getSlidesData, setSlidesData } from './slide-editor.js';
import { generateTimestampFilename } from '../export/filename-utils.js';

let currentName = 'untitled-presentation.html';

const THEMES = {
  default: 'background:#fff;color:#333',
  dark: 'background:#1a1a2e;color:#eee',
  blue: 'background:linear-gradient(135deg,#0f3460,#16213e);color:#eee',
  green: 'background:linear-gradient(135deg,#1a3c34,#2d6a4f);color:#eee',
};

/**
 * Open a slide presentation file (.html with embedded slide data)
 */
export async function openSlideFile() {
  if (window.showOpenFilePicker) {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'Presentation Files', accept: { 'text/html': ['.html'] } }],
    });
    const file = await handle.getFile();
    const text = await file.text();
    parsePresentation(text);
    currentName = file.name;
    return { name: file.name };
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return resolve(null);
      const text = await file.text();
      parsePresentation(text);
      currentName = file.name;
      resolve({ name: file.name });
    };
    input.click();
  });
}

/**
 * Save as standalone HTML presentation
 */
export async function saveSlideFile() {
  const html = buildPresHTML();
  const tsName = generateTimestampFilename(currentName, 'html');
  const blob = new Blob([html], { type: 'text/html' });

  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({
      suggestedName: tsName,
      types: [{ description: 'Presentation', accept: { 'text/html': ['.html'] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    currentName = handle.name || tsName;
    return { name: currentName };
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = tsName;
  a.click();
  URL.revokeObjectURL(url);
  currentName = tsName;
  return { name: tsName };
}

export function getSlideFileName() {
  return currentName;
}

/**
 * Build standalone HTML presentation (navigable with arrow keys)
 */
function buildPresHTML() {
  const slides = getSlidesData();
  let slidesHTML = '';
  slides.forEach((s, i) => {
    const themeStyle = THEMES[s.theme] || THEMES.default;
    slidesHTML += `<section class="slide" style="${themeStyle}" data-notes="${escape(s.notes || '')}">${s.content}</section>\n`;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(currentName.replace(/\.html?$/i, ''))}</title>
<meta name="generator" content="OfficeLink SL">
<!-- MARKLINK_SLIDE_DATA:${btoa(JSON.stringify(slides))} -->
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.slide{position:absolute;inset:0;display:none;flex-direction:column;justify-content:center;padding:64px 96px;font-size:32px;line-height:1.5}
.slide.active{display:flex}
.slide h1{font-size:56px;margin:0 0 16px}
.slide h2{font-size:40px;margin:0 0 12px}
.slide h3{font-size:28px;margin:0 0 8px}
.slide ul,.slide ol{padding-left:1.5em;margin:8px 0}
.slide li{margin:8px 0;font-size:28px}
.slide img{max-width:100%;max-height:70vh}
.nav{position:fixed;bottom:16px;right:16px;color:#fff;font-size:14px;opacity:0.5;z-index:10}
</style>
</head>
<body>
${slidesHTML}
<div class="nav"><span id="counter"></span> | ESC to exit</div>
<script>
const slides=document.querySelectorAll('.slide');
let idx=0;
function show(i){slides.forEach((s,j)=>s.classList.toggle('active',j===i));document.getElementById('counter').textContent=(i+1)+'/'+slides.length}
show(0);
document.addEventListener('keydown',e=>{
if(e.key==='ArrowRight'||e.key===' '||e.key==='Enter'){e.preventDefault();if(idx<slides.length-1){idx++;show(idx)}}
else if(e.key==='ArrowLeft'){e.preventDefault();if(idx>0){idx--;show(idx)}}
});
document.addEventListener('click',()=>{if(idx<slides.length-1){idx++;show(idx)}});
</script>
</body>
</html>`;
}

function escapeHTML(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escape(s) {
  return encodeURIComponent(s);
}

/**
 * Parse a OfficeLink presentation HTML file
 */
function parsePresentation(html) {
  // Try to find embedded slide data
  const dataMatch = html.match(/MARKLINK_SLIDE_DATA:([A-Za-z0-9+/=]+)/);
  if (dataMatch) {
    try {
      const data = JSON.parse(atob(dataMatch[1]));
      if (Array.isArray(data) && data.length > 0) {
        setSlidesData(data);
        return;
      }
    } catch { /* fall through */ }
  }

  // Fallback: parse <section class="slide"> elements
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const sections = doc.querySelectorAll('.slide');
  if (sections.length > 0) {
    const slides = Array.from(sections).map(s => ({
      content: s.innerHTML,
      notes: decodeURIComponent(s.getAttribute('data-notes') || ''),
      theme: 'default',
    }));
    setSlidesData(slides);
  }
}
