(() => {
  'use strict';

  const frame = document.getElementById('preview-frame');
  const controls = document.getElementById('preview-controls');
  const motionToggle = document.getElementById('preview-motion-toggle');
  const motionStatus = document.getElementById('preview-motion-status');
  const widthOutput = document.getElementById('preview-frame-width');
  const warning = document.getElementById('preview-asset-warning');
  if (!frame || !controls || !motionToggle || !motionStatus) return;

  const pictures = [...frame.querySelectorAll('picture[data-icon]')];
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let userPaused = null;

  const updateWidth = () => {
    if (widthOutput) widthOutput.textContent = `Ширина макета: ${Math.round(frame.clientWidth)} px`;
  };

  function showMotionState() {
    const pausedByPreference = userPaused === null && preference.matches;
    const paused = document.hidden || (userPaused === null ? preference.matches : userPaused);

    pictures.forEach(picture => {
      const img = picture.querySelector('img');
      const source = picture.querySelector('source');
      if (!img) return;
      const next = paused || img.dataset.animationFailed === 'true'
        ? img.dataset.poster : img.dataset.animation;
      // Updating sources stops animated image decoding, including in Safari.
      // Without JavaScript, the original <source media> respects reduced motion.
      if (source) {
        source.media = 'all';
        if (source.getAttribute('srcset') !== next) source.setAttribute('srcset', next);
      }
      if (img.getAttribute('src') !== next) img.setAttribute('src', next);
    });

    motionToggle.setAttribute('aria-pressed', String(paused));
    motionToggle.textContent = paused ? 'Продолжить анимацию' : 'Приостановить анимацию';
    motionStatus.textContent = document.hidden
      ? 'Анимации приостановлены, пока вкладка скрыта.'
      : pausedByPreference
        ? 'Включено уменьшение движения: показаны статичные кадры.'
        : paused ? 'Анимации на паузе.' : 'Анимации зациклены · без звука.';
  }

  controls.querySelectorAll('[data-viewport]').forEach(button => {
    button.addEventListener('click', () => {
      frame.dataset.viewport = button.dataset.viewport;
      controls.querySelectorAll('[data-viewport]').forEach(item => {
        item.setAttribute('aria-pressed', String(item === button));
      });
      updateWidth();
    });
  });

  controls.querySelectorAll('[data-scale]').forEach(button => {
    button.addEventListener('click', () => {
      frame.dataset.scale = button.dataset.scale;
      controls.querySelectorAll('[data-scale]').forEach(item => {
        item.setAttribute('aria-pressed', String(item === button));
      });
    });
  });

  motionToggle.addEventListener('click', () => {
    const currentlyPaused = userPaused === null ? preference.matches : userPaused;
    userPaused = !currentlyPaused;
    showMotionState();
  });

  const onPreferenceChange = () => {
    userPaused = null;
    showMotionState();
  };
  if (preference.addEventListener) preference.addEventListener('change', onPreferenceChange);
  else if (preference.addListener) preference.addListener(onPreferenceChange);

  document.addEventListener('visibilitychange', showMotionState);
  pictures.forEach(picture => {
    const img = picture.querySelector('img');
    if (!img) return;
    img.addEventListener('error', () => {
      if (warning) warning.hidden = false;
      if (img.dataset.animationFailed !== 'true') {
        img.dataset.animationFailed = 'true';
        showMotionState();
      }
    });
  });

  controls.hidden = false;
  showMotionState();
  updateWidth();
  if ('ResizeObserver' in window) new ResizeObserver(updateWidth).observe(frame);
  else window.addEventListener('resize', updateWidth);
})();
