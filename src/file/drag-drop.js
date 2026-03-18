// MarkLink SL — Drag & Drop Handler

/**
 * Initialize drag and drop for .md files
 * @param {Function} onFileLoad - Callback with {name, content}
 */
export function initDragDrop(onFileLoad) {
  const overlay = document.getElementById('drop-overlay');

  // Prevent default browser drag behavior
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    overlay?.classList.remove('hidden');
  });

  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    // Only hide if leaving the window
    if (e.relatedTarget === null) {
      overlay?.classList.add('hidden');
    }
  });

  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    overlay?.classList.add('hidden');

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.match(/\.(md|markdown|txt)$/i)) {
      console.warn('Not a markdown file:', file.name);
      return;
    }

    const content = await file.text();
    onFileLoad({ name: file.name, content });
  });
}
