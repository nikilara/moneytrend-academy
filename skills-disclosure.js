'use strict';

(() => {
  const cards = document.querySelectorAll('#skills .skill-disclosure');
  if (!cards.length) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const states = [];

  cards.forEach(card => {
    const summary = card.querySelector('summary');
    const state = { card, expanded: card.open, animation: null };
    states.push(state);

    function cancelAnimation() {
      if (!state.animation) return;
      const animation = state.animation;
      state.animation = null;
      animation.onfinish = null;
      animation.oncancel = null;
      animation.cancel();
    }

    state.settle = () => {
      cancelAnimation();
      card.open = state.expanded;
      card.dataset.expanded = String(state.expanded);
      card.style.removeProperty('height');
      card.style.removeProperty('overflow');
    };

    summary.addEventListener('click', event => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      const startHeight = card.getBoundingClientRect().height;
      state.expanded = !state.expanded;
      cancelAnimation();
      card.dataset.expanded = String(state.expanded);
      if (reducedMotion.matches || typeof card.animate !== 'function') {
        state.settle();
        return;
      }

      // Measure natural content, rather than imposing a maximum height on long lists.
      card.open = true;
      card.style.height = 'auto';
      const endHeight = state.expanded
        ? card.getBoundingClientRect().height
        : summary.getBoundingClientRect().height;
      card.style.height = startHeight + 'px';
      card.style.overflow = 'hidden';
      const animation = card.animate(
        { height: [startHeight + 'px', endHeight + 'px'] },
        { duration: 260, easing: 'cubic-bezier(.25,.46,.45,.94)' }
      );
      state.animation = animation;
      animation.onfinish = () => {
        if (state.animation === animation) state.settle();
      };
    });

    // Keep native behavior, browser find-in-page and script-triggered toggles in sync.
    card.addEventListener('toggle', () => {
      if (state.animation) return;
      state.expanded = card.open;
      card.dataset.expanded = String(card.open);
    });
  });

  const settleAll = () => states.forEach(state => state.settle());
  window.addEventListener('resize', settleAll);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) settleAll();
  });
  if (document.fonts) document.fonts.ready.then(settleAll);
})();
