// MarkLink SL — Entry Point (v2)
import { initApp } from './app.js';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initApp().catch(console.error);
});
