// MarkLink SL — markdown-it Renderer Setup
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

// Import highlight.js CSS (light theme — will switch via CSS class)
import 'highlight.js/styles/github.css';

/**
 * Create and configure markdown-it instance
 */
function createRenderer() {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: false,
    highlight(str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`;
        } catch (_) { /* ignore */ }
      }
      // Mermaid blocks — don't highlight, pass through
      if (lang === 'mermaid') {
        return `<div class="mermaid">${md.utils.escapeHtml(str)}</div>`;
      }
      return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
    },
  });

  // Enable tables (built-in)
  md.enable('table');

  return md;
}

const renderer = createRenderer();

/**
 * Render markdown string to HTML
 */
export function render(markdownText) {
  return renderer.render(markdownText);
}

/**
 * Get the markdown-it instance for plugin registration
 */
export function getRenderer() {
  return renderer;
}
