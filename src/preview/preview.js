// OfficeLink SL — Preview Pane Controller
import { render } from './renderer.js';

let previewElement = null;
let updateTimer = null;
const DEBOUNCE_MS = 150;

/**
 * Initialize preview pane
 */
export function initPreview(element) {
  previewElement = element;
}

/**
 * Update preview with new markdown content (debounced)
 */
export function updatePreview(markdownText) {
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(() => {
    if (!previewElement) return;
    const html = render(markdownText);
    previewElement.innerHTML = html;

    // Post-render: trigger mermaid if loaded
    renderMermaidBlocks();
  }, DEBOUNCE_MS);
}

/**
 * Force immediate update (no debounce)
 */
export function updatePreviewImmediate(markdownText) {
  if (!previewElement) return;
  const html = render(markdownText);
  previewElement.innerHTML = html;
  renderMermaidBlocks();
}

/**
 * Lazily load and render Mermaid diagrams
 */
async function renderMermaidBlocks() {
  if (!previewElement) return;
  const mermaidBlocks = previewElement.querySelectorAll('.mermaid');
  if (mermaidBlocks.length === 0) return;

  try {
    const mermaid = await import('mermaid');
    mermaid.default.initialize({
      startOnLoad: false,
      theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
    });
    await mermaid.default.run({ nodes: mermaidBlocks });
  } catch (e) {
    // Mermaid not installed or render error — show error message
    mermaidBlocks.forEach((block) => {
      if (!block.querySelector('svg')) {
        const originalText = block.textContent;
        block.innerHTML = `<div class="mermaid-error">⚠️ Mermaid render error: ${e.message}<br><pre>${originalText}</pre></div>`;
      }
    });
  }
}
