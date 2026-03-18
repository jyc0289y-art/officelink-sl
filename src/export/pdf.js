// MarkLink SL — PDF Export (via browser print dialog)
import { printDocument } from './print.js';

/**
 * Export to PDF — uses print dialog with "Save as PDF" option
 */
export function exportPDF(markdownText, title) {
  printDocument(markdownText, title);
}
