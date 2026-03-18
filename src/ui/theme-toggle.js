// MarkLink SL — Dark Mode Toggle
import { setTheme as setEditorTheme } from '../editor/editor.js';

const STORAGE_KEY = 'marklink-theme';
let currentTheme = 'light';

/**
 * Initialize theme system
 */
export function initTheme() {
  // Check localStorage first
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'dark' || saved === 'light') {
    currentTheme = saved;
  } else {
    // Auto-detect system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    currentTheme = prefersDark ? 'dark' : 'light';
  }

  applyTheme(currentTheme);

  // Listen for system preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      currentTheme = e.matches ? 'dark' : 'light';
      applyTheme(currentTheme);
    }
  });
}

/**
 * Toggle between dark and light
 */
export function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(STORAGE_KEY, currentTheme);
  applyTheme(currentTheme);
}

/**
 * Apply theme to document and editor
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  setEditorTheme(theme === 'dark');

  // Update theme icon
  const icon = document.getElementById('theme-icon');
  if (icon) {
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

/**
 * Get current theme
 */
export function getCurrentTheme() {
  return currentTheme;
}

/**
 * Check if dark mode is active
 */
export function isDark() {
  return currentTheme === 'dark';
}
