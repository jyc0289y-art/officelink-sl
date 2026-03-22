// OfficeLink SL — Slide Editor

const LAYOUTS = {
  title: '<h1 class="slide-title">Title</h1><p class="slide-subtitle">Subtitle</p>',
  content: '<h2>Slide Title</h2><ul><li>Point 1</li><li>Point 2</li><li>Point 3</li></ul>',
  'two-col': '<h2>Title</h2><div style="display:flex;gap:32px"><div style="flex:1"><p>Left column</p></div><div style="flex:1"><p>Right column</p></div></div>',
  blank: '<p>&nbsp;</p>',
  image: '<h2>Image Slide</h2><p style="text-align:center;color:#999">Click 🖼 to insert an image</p>',
};

let slides = [
  { content: LAYOUTS.title, notes: '', theme: 'default' },
];
let activeSlideIdx = 0;
let canvasEl, panelEl, notesEl, themeSelect;

export function initSlideEditor() {
  canvasEl = document.getElementById('slide-canvas');
  panelEl = document.getElementById('slide-panel');
  notesEl = document.getElementById('slide-notes');
  themeSelect = document.getElementById('slide-theme');
  if (!canvasEl) return;

  renderPanel();
  loadSlide(0);
  bindEvents();
}

function bindEvents() {
  // Save content on input
  canvasEl.addEventListener('input', () => {
    slides[activeSlideIdx].content = canvasEl.innerHTML;
    updateThumb(activeSlideIdx);
  });

  // Notes
  notesEl?.addEventListener('input', () => {
    slides[activeSlideIdx].notes = notesEl.value;
  });

  // Add slide
  document.getElementById('slide-add')?.addEventListener('click', () => {
    const layout = document.getElementById('slide-layout')?.value || 'content';
    const theme = themeSelect?.value || 'default';
    slides.splice(activeSlideIdx + 1, 0, {
      content: LAYOUTS[layout] || LAYOUTS.content,
      notes: '',
      theme,
    });
    activeSlideIdx++;
    renderPanel();
    loadSlide(activeSlideIdx);
  });

  // Delete slide
  document.getElementById('slide-del')?.addEventListener('click', () => {
    if (slides.length <= 1) return;
    slides.splice(activeSlideIdx, 1);
    if (activeSlideIdx >= slides.length) activeSlideIdx = slides.length - 1;
    renderPanel();
    loadSlide(activeSlideIdx);
  });

  // Layout change (applies to new slides only, but also allows re-applying)
  document.getElementById('slide-layout')?.addEventListener('change', (e) => {
    const layout = e.target.value;
    if (confirm('Replace current slide content with this layout?')) {
      slides[activeSlideIdx].content = LAYOUTS[layout] || LAYOUTS.content;
      loadSlide(activeSlideIdx);
      updateThumb(activeSlideIdx);
    }
  });

  // Theme change
  themeSelect?.addEventListener('change', (e) => {
    slides[activeSlideIdx].theme = e.target.value;
    canvasEl.setAttribute('data-theme', e.target.value === 'default' ? '' : e.target.value);
    updateThumb(activeSlideIdx);
  });

  // Present
  document.getElementById('slide-present')?.addEventListener('click', startPresentation);

  // Insert image
  document.getElementById('slide-insert-image')?.addEventListener('click', () => {
    const url = prompt('Enter image URL:');
    if (url) {
      document.execCommand('insertImage', false, url);
      slides[activeSlideIdx].content = canvasEl.innerHTML;
      updateThumb(activeSlideIdx);
    }
  });

  // Thumbnail click
  panelEl?.addEventListener('click', (e) => {
    const thumb = e.target.closest('.slide-thumb');
    if (thumb && thumb.dataset.idx != null) {
      saveCurrentSlide();
      activeSlideIdx = parseInt(thumb.dataset.idx, 10);
      loadSlide(activeSlideIdx);
      renderPanel();
    }
  });

  // F5 for presentation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F5') {
      const slideView = document.getElementById('view-slide');
      if (slideView?.classList.contains('active')) {
        e.preventDefault();
        startPresentation();
      }
    }
  });
}

function saveCurrentSlide() {
  slides[activeSlideIdx].content = canvasEl.innerHTML;
  slides[activeSlideIdx].notes = notesEl?.value || '';
}

function loadSlide(idx) {
  activeSlideIdx = idx;
  const slide = slides[idx];
  canvasEl.innerHTML = slide.content;
  if (notesEl) notesEl.value = slide.notes || '';
  canvasEl.setAttribute('data-theme', slide.theme === 'default' ? '' : slide.theme);
  if (themeSelect) themeSelect.value = slide.theme;

  // Update active thumb
  panelEl?.querySelectorAll('.slide-thumb').forEach((t, i) => {
    t.classList.toggle('active', i === idx);
  });
}

function renderPanel() {
  if (!panelEl) return;
  panelEl.innerHTML = '';
  slides.forEach((slide, i) => {
    const thumb = document.createElement('div');
    thumb.className = `slide-thumb ${i === activeSlideIdx ? 'active' : ''}`;
    thumb.dataset.idx = i;
    thumb.innerHTML = miniContent(slide.content) +
      `<span class="slide-thumb-number">${i + 1}</span>`;
    panelEl.appendChild(thumb);
  });
}

function updateThumb(idx) {
  const thumb = panelEl?.querySelector(`.slide-thumb[data-idx="${idx}"]`);
  if (thumb) {
    const numSpan = thumb.querySelector('.slide-thumb-number');
    thumb.innerHTML = miniContent(slides[idx].content) +
      `<span class="slide-thumb-number">${idx + 1}</span>`;
  }
}

function miniContent(html) {
  // Strip to plain text for thumbnail
  const div = document.createElement('div');
  div.innerHTML = html;
  const text = div.textContent.substring(0, 80);
  return `<span style="font-size:6px;line-height:1.2;word-break:break-all">${text}</span>`;
}

/**
 * Fullscreen presentation mode
 */
function startPresentation() {
  saveCurrentSlide();
  let presIdx = activeSlideIdx;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#000;display:flex;align-items:center;justify-content:center';

  const slideEl = document.createElement('div');
  slideEl.className = 'slide-canvas';
  slideEl.style.cssText = 'width:100vw;height:100vh;display:flex;flex-direction:column;justify-content:center;padding:64px 96px;font-size:32px;cursor:none';
  slideEl.contentEditable = 'false';

  function showSlide(idx) {
    const slide = slides[idx];
    slideEl.innerHTML = slide.content;
    const theme = slide.theme === 'default' ? '' : slide.theme;
    slideEl.setAttribute('data-theme', theme);
  }

  showSlide(presIdx);
  overlay.appendChild(slideEl);
  document.body.appendChild(overlay);

  const handler = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', handler);
    } else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (presIdx < slides.length - 1) {
        presIdx++;
        showSlide(presIdx);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (presIdx > 0) {
        presIdx--;
        showSlide(presIdx);
      }
    }
  };
  document.addEventListener('keydown', handler);

  // Click to advance
  overlay.addEventListener('click', () => {
    if (presIdx < slides.length - 1) {
      presIdx++;
      showSlide(presIdx);
    } else {
      overlay.remove();
      document.removeEventListener('keydown', handler);
    }
  });
}

/** Get all slides data for file saving */
export function getSlidesData() {
  return slides;
}

/** Set slides data (from file load) */
export function setSlidesData(newSlides) {
  slides = newSlides;
  activeSlideIdx = 0;
  renderPanel();
  loadSlide(0);
}

/** Get current slide count */
export function getSlideCount() {
  return slides.length;
}
