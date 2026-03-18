// MarkLink SL — File Manager (File System Access API + fallback)

let currentFileHandle = null;
let currentFileName = 'untitled.md';

/**
 * Check if File System Access API is available
 */
export function hasFileSystemAccess() {
  return 'showOpenFilePicker' in window;
}

/**
 * Open a .md file
 * @returns {Promise<{name: string, content: string}>}
 */
export async function openFile() {
  if (hasFileSystemAccess()) {
    return openFileModern();
  }
  return openFileFallback();
}

/**
 * Save content to file
 * @param {string} content - Markdown content to save
 */
export async function saveFile(content) {
  if (hasFileSystemAccess() && currentFileHandle) {
    return saveFileModern(content);
  }
  return saveFileFallback(content);
}

/**
 * Save As — always prompt for new file
 */
export async function saveFileAs(content) {
  if (hasFileSystemAccess()) {
    return saveFileAsModern(content);
  }
  return saveFileFallback(content);
}

// --- Modern API (Chromium) ---

async function openFileModern() {
  const [handle] = await window.showOpenFilePicker({
    types: [{
      description: 'Markdown Files',
      accept: { 'text/markdown': ['.md', '.markdown', '.txt'] },
    }],
    multiple: false,
  });
  currentFileHandle = handle;
  currentFileName = handle.name;
  const file = await handle.getFile();
  const content = await file.text();
  addToRecent(currentFileName);
  return { name: currentFileName, content };
}

async function saveFileModern(content) {
  const writable = await currentFileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function saveFileAsModern(content) {
  const handle = await window.showSaveFilePicker({
    suggestedName: currentFileName,
    types: [{
      description: 'Markdown Files',
      accept: { 'text/markdown': ['.md'] },
    }],
  });
  currentFileHandle = handle;
  currentFileName = handle.name;
  await saveFileModern(content);
  addToRecent(currentFileName);
  return { name: currentFileName };
}

// --- Fallback (Safari/Firefox) ---

function openFileFallback() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      currentFileName = file.name;
      const content = await file.text();
      addToRecent(currentFileName);
      resolve({ name: currentFileName, content });
    };
    input.click();
  });
}

function saveFileFallback(content) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = currentFileName;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Recent Files ---

const RECENT_KEY = 'marklink-recent-files';
const MAX_RECENT = 10;

function addToRecent(name) {
  const recent = getRecentFiles();
  const idx = recent.indexOf(name);
  if (idx !== -1) recent.splice(idx, 1);
  recent.unshift(name);
  if (recent.length > MAX_RECENT) recent.pop();
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

export function getRecentFiles() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
}

/**
 * Get current file name
 */
export function getCurrentFileName() {
  return currentFileName;
}

/**
 * Set file name (e.g., from drag-and-drop)
 */
export function setFileName(name) {
  currentFileName = name;
  currentFileHandle = null; // No handle for dropped files
}
