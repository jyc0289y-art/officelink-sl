// MarkLink SL — Folder Tree (File System Access API - Chromium only)

/**
 * Open a directory and build tree
 * @param {Function} onFileSelect - Callback with {name, content} when file is selected
 * @returns {Promise<HTMLElement>} Tree DOM element
 */
export async function openFolder(onFileSelect) {
  if (!('showDirectoryPicker' in window)) {
    return createUnsupportedMessage();
  }

  try {
    const dirHandle = await window.showDirectoryPicker();
    const tree = document.createElement('ul');
    tree.className = 'tree-root';
    await buildTree(dirHandle, tree, onFileSelect);
    return tree;
  } catch (e) {
    if (e.name === 'AbortError') return null; // User cancelled
    console.error('Folder open error:', e);
    return null;
  }
}

/**
 * Recursively build folder tree
 */
async function buildTree(dirHandle, parentEl, onFileSelect, depth = 0) {
  if (depth > 5) return; // Max depth to prevent excessive recursion

  const entries = [];
  for await (const entry of dirHandle.values()) {
    entries.push(entry);
  }

  // Sort: directories first, then files, alphabetically
  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of entries) {
    // Skip hidden files/folders
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;

    const li = document.createElement('li');
    li.className = `tree-item tree-${entry.kind}`;

    if (entry.kind === 'directory') {
      const label = document.createElement('span');
      label.className = 'tree-folder';
      label.textContent = `📁 ${entry.name}`;
      li.appendChild(label);

      const subList = document.createElement('ul');
      subList.className = 'tree-children hidden';
      li.appendChild(subList);

      label.addEventListener('click', async () => {
        if (subList.children.length === 0) {
          await buildTree(entry, subList, onFileSelect, depth + 1);
        }
        subList.classList.toggle('hidden');
        label.textContent = subList.classList.contains('hidden')
          ? `📁 ${entry.name}`
          : `📂 ${entry.name}`;
      });
    } else {
      // Only show markdown files
      if (!entry.name.match(/\.(md|markdown|txt)$/i)) continue;

      const label = document.createElement('span');
      label.className = 'tree-file';
      label.textContent = `📄 ${entry.name}`;
      li.appendChild(label);

      label.addEventListener('click', async () => {
        const file = await entry.getFile();
        const content = await file.text();
        onFileSelect({ name: entry.name, content });
      });
    }

    parentEl.appendChild(li);
  }
}

function createUnsupportedMessage() {
  const div = document.createElement('div');
  div.className = 'tree-unsupported';
  div.innerHTML = '<p>📂 Folder browsing requires<br>Chrome or Edge browser</p>';
  div.style.cssText = 'padding: 12px; font-size: 12px; color: var(--text-tertiary); text-align: center;';
  return div;
}
