// OfficeLink SL — Filename Utilities

/**
 * Generate timestamp-prefixed filename
 * Format: YYYYMMDD_HHMMSS_originalName.ext
 * @param {string} originalName - Original file name (e.g., "document.md")
 * @param {string} ext - Target extension (e.g., "pdf", "html")
 * @returns {string} Timestamped filename
 */
export function generateTimestampFilename(originalName, ext) {
  const now = new Date();
  const ts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '_',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');

  // Remove existing extension from original name
  const baseName = originalName.replace(/\.(md|markdown|txt|pdf|html)$/i, '');

  return `${ts}_${baseName}.${ext}`;
}
