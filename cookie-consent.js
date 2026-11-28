'use strict';
(() => {
  const key = 'moneytrend-cookie-consent-v1';
  const counterId = 114719984;
  const banner = document.getElementById('cookie-consent');
  const settings = document.getElementById('cookie-settings');
  if (!banner || !settings) return;

  let started = false;
  const getChoice = () => {
    try { return localStorage.getItem(key); } catch { return null; }
  };
  const saveChoice = value => {
    try { localStorage.setItem(key, value); } catch { /* Storage can be disabled. */ }
  };
  const startMetrika = () => {
    if (started) return;
    started = true;
    window.ym = window.ym || function() { (window.ym.a = window.ym.a || []).push(arguments); };
    window.ym.l = Date.now();
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://mc.yandex.ru/metrika/tag.js?id=114719984';
    document.head.appendChild(script);
    window.ym(counterId, 'init', {
      ssr: true,
      webvisor: true,
      clickmap: true,
      referrer: document.referrer,
      url: location.href,
      trackLinks: true,
      accurateTrackBounce: true
    });
  };

  const initialChoice = getChoice();
  banner.hidden = initialChoice === 'accept' || initialChoice === 'reject';
  settings.hidden = !banner.hidden;
  if (initialChoice === 'accept') startMetrika();

  banner.querySelectorAll('[data-cookie-choice]').forEach(button => {
    button.addEventListener('click', () => {
      const choice = button.dataset.cookieChoice;
      saveChoice(choice);
      banner.hidden = true;
      settings.hidden = false;
      if (choice === 'accept') startMetrika();
      else if (started) window.location.reload();
    });
  });
  settings.addEventListener('click', () => {
    banner.hidden = false;
    settings.hidden = true;
    banner.querySelector('[data-cookie-choice="reject"]').focus();
  });
  // Track interest in each offering separately, only after analytics consent.
  const offeringGoals = {
    standard: 'mt_standard_click',
    family: 'mt_family_click',
    vip: 'mt_vip_click',
    start: 'mt_exchange_click',
    practice: 'mt_practice_click'
  };
  document.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest('a[href^="https://t.me/"]') : null;
    if (!link || !started) return;
    const card = link.closest('article[id]');
    const goal = card && offeringGoals[card.id];
    if (goal) window.ym(counterId, 'reachGoal', goal);
  }, true);
})();
