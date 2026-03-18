// MarkLink SL — Recent Files UI
import { getRecentFiles } from './file-manager.js';

/**
 * Render recent files list in sidebar
 * @param {HTMLElement} container - UL element for recent files
 * @param {Function} onFileClick - Callback when a recent file is clicked
 */
export function renderRecentFiles(container, onFileClick) {
  if (!container) return;
  const recent = getRecentFiles();
  container.innerHTML = '';

  if (recent.length === 0) {
    container.innerHTML = '<li class="recent-empty">No recent files</li>';
    return;
  }

  recent.forEach((name) => {
    const li = document.createElement('li');
    li.textContent = name;
    li.title = name;
    li.addEventListener('click', () => onFileClick(name));
    container.appendChild(li);
  });
}
