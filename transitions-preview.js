(() => {
  'use strict';

  const stage = document.getElementById('transition-preview-stage');
  const frame = document.getElementById('transition-preview-frame');
  const status = document.getElementById('transition-preview-status');
  const sizeOutput = document.getElementById('transition-preview-size');
  if (!stage || !frame || !status || !sizeOutput) return;

  const widthButtons = [...document.querySelectorAll('[data-preview-size]')];
  const targetButtons = [...document.querySelectorAll('[data-transition-target]')];
  let mode = window.innerWidth <= 700 ? 'phone' : 'desktop';
  let selectedTarget = 'transition-to-reviews';
  let ready = false;
  let initialJumpDone = false;
  let srcdocAssigned = false;
  let lastGeometry = '';
  let jumpRequest = 0;

  function showStatus(text, error = false) {
    status.textContent = text;
    status.classList.toggle('is-error', error);
  }

  function draftDocument() {
    try { return frame.contentDocument; }
    catch { return null; }
  }

  function jumpToSelected() {
    if (!ready) return false;
    const target = draftDocument()?.getElementById(selectedTarget);
    if (!target) {
      showStatus('Переход не найден в открытом документе. Откройте черновик отдельно.', true);
      return false;
    }
    target.scrollIntoView({block: 'center', behavior: 'auto'});
    targetButtons.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.transitionTarget === selectedTarget));
    });
    showStatus(selectedTarget === 'transition-to-reviews'
      ? 'Переход перед отзывами показан в контексте страницы.'
      : 'Переход перед обучением показан в контексте страницы.');
    return true;
  }

  function scheduleSelectedJump() {
    const request = ++jumpRequest;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      if (request === jumpRequest) jumpToSelected();
    }));
  }

  function fit(recenterAfterResize = false) {
    const available = Math.max(1, stage.clientWidth);
    const width = mode === 'phone' ? Math.max(320, Math.min(390, available)) : 1280;
    const scale = Math.min(1, available / width);
    const height = Math.max(1, stage.clientHeight) / scale;
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
    frame.style.transform = `scale(${scale})`;
    frame.style.left = `${Math.max(0, (available - width * scale) / 2)}px`;
    widthButtons.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.previewSize === mode));
    });
    const label = mode === 'phone' ? 'Телефон' : 'Компьютер';
    sizeOutput.textContent = `${label} · ${Math.round(width)} px${scale < .999 ? ` · масштаб ${Math.round(scale * 100)}%` : ''}`;
    const geometry = `${width}:${scale}:${height}`;
    const changed = geometry !== lastGeometry;
    lastGeometry = geometry;
    if (ready && recenterAfterResize && changed) scheduleSelectedJump();
  }

  widthButtons.forEach(button => {
    button.disabled = false;
    button.addEventListener('click', () => {
      mode = button.dataset.previewSize;
      fit();
      scheduleSelectedJump();
    });
  });
  targetButtons.forEach(button => {
    button.addEventListener('click', () => {
      selectedTarget = button.dataset.transitionTarget;
      scheduleSelectedJump();
    });
  });

  frame.addEventListener('load', async () => {
    if (!srcdocAssigned) return;
    const doc = draftDocument();
    if (!doc) {
      showStatus('Не удалось открыть черновик во встроенном окне. Используйте ссылку «Открыть черновик отдельно».', true);
      return;
    }
    if (!initialJumpDone && !doc.getElementById('transition-to-reviews')) return;
    ready = false;
    try { if (doc.fonts?.ready) await doc.fonts.ready; }
    catch { /* Font fallback must not prevent reviewing the document. */ }
    ready = true;
    fit();
    targetButtons.forEach(button => { button.disabled = false; });
    if (!initialJumpDone) {
      initialJumpDone = jumpToSelected();
    }
    stage.classList.add('is-ready');
    stage.setAttribute('aria-busy', 'false');
    // Subsequent frame navigations retain their own anchor position. Only an
    // explicit toolbar jump or a width change recenters the selected transition.
  });

  async function loadDraft() {
    try {
      const url = new URL('transitions-draft.html', window.location.href);
      const response = await window.fetch(url, {credentials: 'same-origin', mode: 'same-origin', cache: 'no-store'});
      if (!response.ok) throw new Error('Preview fetch failed');
      const markup = await response.text();
      if (!markup.includes('id="transition-to-reviews"') || !markup.includes('id="transition-to-learning"')) {
        throw new Error('Preview targets missing');
      }
      srcdocAssigned = true;
      frame.srcdoc = markup;
    } catch {
      stage.setAttribute('aria-busy', 'false');
      stage.hidden = true;
      showStatus('Не удалось загрузить предпросмотр. Откройте черновик отдельно по ссылке выше.', true);
    }
  }

  stage.hidden = false;
  fit();
  if ('ResizeObserver' in window) new ResizeObserver(() => fit(true)).observe(stage);
  else window.addEventListener('resize', () => fit(true));
  loadDraft();
})();
