'use strict';
(() => {
  const header = document.getElementById('site-header');
  const button = document.getElementById('site-menu-toggle');
  const panel = document.getElementById('site-nav-panel');
  const nav = document.getElementById('site-navigation');
  if (!header || !button || !panel || !nav) return;
  const compact = window.matchMedia('(max-width: 1100px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let open = false;

  function updateHeaderHeight() {
    document.documentElement.style.setProperty('--site-header-height', Math.ceil(header.getBoundingClientRect().height) + 'px');
  }
  function applyMode() {
    if (!compact.matches) open = false;
    button.hidden = !compact.matches;
    panel.hidden = compact.matches && !open;
    button.setAttribute('aria-expanded', String(compact.matches && open));
    header.classList.toggle('is-menu-open', compact.matches && open);
    updateHeaderHeight();
  }
  function closeMenu(returnFocus = false) {
    open = false;
    applyMode();
    if (returnFocus && compact.matches) button.focus();
  }
  button.addEventListener('click', () => {
    if (!compact.matches) return;
    open = !open;
    applyMode();
  });
  nav.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const hash = link.getAttribute('href');
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    event.preventDefault();
    closeMenu();
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - header.getBoundingClientRect().height - 16);
    if (window.location.hash !== hash) {
      try { window.history.pushState(null, '', hash); }
      catch { /* Embedded previews may restrict history; scrolling remains available. */ }
    }
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    window.scrollTo({ top, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      closeMenu(true);
    }
  });
  document.addEventListener('pointerdown', event => {
    if (open && !header.contains(event.target)) closeMenu();
  });
  if (compact.addEventListener) compact.addEventListener('change', applyMode);
  else compact.addListener(applyMode);
  window.addEventListener('resize', updateHeaderHeight);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(updateHeaderHeight).observe(header);
  applyMode();
})();
