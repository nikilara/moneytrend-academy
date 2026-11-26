'use strict';
(() => {
  // Retain the older tabbed page's behavior where its markup is still served.
  const tabs = Array.from(document.querySelectorAll('[data-evidence-tab]'));
  const panels = new Map(tabs.map(tab => [tab.dataset.evidenceTab, document.getElementById(tab.getAttribute('aria-controls'))]));
  function selectTab(tab, focus = false) {
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      const panel = panels.get(item.dataset.evidenceTab);
      if (panel) panel.hidden = !selected;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      selectTab(tabs[next], true);
    });
  });

  // Capture original materials before adding presentation-only edge copies.
  const links = Array.from(document.querySelectorAll('[data-evidence-group]'));
  const controllersByLink = new Map();
  const reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const now = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
  const focusWithoutScroll = element => {
    if (!element) return;
    try { element.focus({ preventScroll: true }); } catch (_) { element.focus(); }
  };

  function createCarousel(panel) {
    const viewport = panel.querySelector('[data-carousel-viewport]');
    const track = panel.querySelector('[data-carousel-track]');
    const counter = panel.querySelector('[data-carousel-count]');
    const previous = panel.querySelector('[data-carousel-prev]');
    const next = panel.querySelector('[data-carousel-next]');
    if (!viewport || !track || !counter || !previous || !next) return null;
    const slides = Array.from(track.children);
    const slideLinks = slides.map(slide => slide.querySelector('[data-evidence-group]'));
    const count = slides.length;
    if (!count || slideLinks.some(link => !link)) return null;
    let active = 0;
    let physical = count > 1 ? 1 : 0;
    let stride = 0;
    let moving = false;
    let pending = 0;
    let fallback = null;
    let motionId = 0;
    let gesture = null;
    let suppressClickUntil = 0;
    const edgeCopies = [];

    function copyEdge(slide) {
      const copy = slide.cloneNode(true);
      copy.setAttribute('data-carousel-clone', 'true');
      copy.setAttribute('aria-hidden', 'true');
      copy.setAttribute('inert', '');
      copy.inert = true;
      copy.removeAttribute('id');
      copy.style.pointerEvents = 'none';
      copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      copy.querySelectorAll('[data-evidence-group]').forEach(node => node.removeAttribute('data-evidence-group'));
      copy.querySelectorAll('a, button, input, [tabindex]').forEach(node => { node.tabIndex = -1; });
      return copy;
    }
    if (count > 1) {
      const lastCopy = copyEdge(slides[count - 1]);
      const firstCopy = copyEdge(slides[0]);
      track.insertBefore(lastCopy, slides[0]);
      track.append(firstCopy);
      edgeCopies.push(lastCopy, firstCopy);
    }
    slides.forEach((slide, i) => {
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'слайд');
      slide.setAttribute('aria-label', `${i + 1} из ${count}`);
    });
    track.querySelectorAll('img').forEach(img => { img.draggable = false; });
    viewport.tabIndex = 0;
    previous.disabled = next.disabled = count < 2;

    function prepareImages() {
      for (const offset of [-1, 0, 1]) {
        const slide = slides[(active + offset + count) % count];
        const img = slide.querySelector('img');
        if (img) img.loading = 'eager';
      }
      edgeCopies.forEach(copy => { const img = copy.querySelector('img'); if (img) img.loading = 'eager'; });
    }
    function updateState() {
      panel.setAttribute('data-carousel-index', String(active));
      counter.textContent = `${String(active + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`;
      slides.forEach((slide, i) => {
        const selected = i === active;
        slide.classList.toggle('is-active', selected);
        slide.setAttribute('aria-hidden', String(!selected));
        slideLinks[i].tabIndex = selected ? 0 : -1;
      });
      if (edgeCopies.length) {
        edgeCopies[0].classList.toggle('is-active', active === count - 1);
        edgeCopies[1].classList.toggle('is-active', active === 0);
      }
      prepareImages();
    }
    function draw(animate) {
      track.style.transition = animate && !reducedMotion.matches
        ? 'transform 320ms cubic-bezier(.22,.61,.36,1)' : 'none';
      track.style.transform = `translate3d(${-physical * stride}px,0,0)`;
      updateState();
    }
    function cancelMotion() {
      motionId++;
      if (fallback !== null) clearTimeout(fallback);
      fallback = null;
      moving = false;
    }
    function goTo(index) {
      cancelMotion();
      pending = 0;
      active = ((index % count) + count) % count;
      physical = count > 1 ? active + 1 : 0;
      draw(false);
    }
    function refresh() {
      cancelMotion();
      pending = 0;
      const children = Array.from(track.children);
      const difference = children.length > 1 ? children[1].offsetLeft - children[0].offsetLeft : 0;
      const width = slides[0].getBoundingClientRect().width;
      const gap = typeof getComputedStyle === 'function' ? parseFloat(getComputedStyle(track).columnGap) || 14 : 14;
      stride = difference > 0 ? difference : (width || Math.max(1, viewport.clientWidth - 28)) + gap;
      physical = count > 1 ? active + 1 : 0;
      draw(false);
    }
    function finish() {
      if (!moving) return;
      cancelMotion();
      physical = count > 1 ? active + 1 : 0;
      draw(false);
      if (pending) {
        const direction = Math.sign(pending);
        pending -= direction;
        const focusedSlide = slideLinks.includes(document.activeElement);
        move(direction);
        if (focusedSlide) focusWithoutScroll(slideLinks[active]);
      }
    }
    function move(direction) {
      if (count < 2) return;
      direction = direction < 0 ? -1 : 1;
      if (moving) {
        pending = Math.max(-count, Math.min(count, pending + direction));
        return;
      }
      if (reducedMotion.matches) { goTo(active + direction); return; }
      // Apply a seamless clone reset before starting any queued transition.
      track.getBoundingClientRect();
      active = (active + direction + count) % count;
      physical += direction;
      moving = true;
      const token = ++motionId;
      draw(true);
      fallback = setTimeout(() => { if (token === motionId) finish(); }, 380);
    }
    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    track.addEventListener('transitionend', event => {
      if (event.target === track && event.propertyName === 'transform') finish();
    });
    panel.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const focusedSlide = slideLinks.includes(document.activeElement);
      if (event.key === 'Home') goTo(0);
      else if (event.key === 'End') goTo(count - 1);
      else move(event.key === 'ArrowLeft' ? -1 : 1);
      if (focusedSlide) focusWithoutScroll(slideLinks[active]);
    });

    function startGesture(x, y, id) {
      suppressClickUntil = 0;
      gesture = { x, y, id, horizontal: false };
    }
    function moveGesture(x, y, event) {
      if (!gesture) return;
      const dx = x - gesture.x, dy = y - gesture.y;
      if (!gesture.horizontal && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) gesture.horizontal = true;
      if (gesture.horizontal && event.cancelable) event.preventDefault();
    }
    function endGesture(x, y, cancelled = false) {
      if (!gesture) return;
      const dx = x - gesture.x, dy = y - gesture.y;
      const horizontal = gesture.horizontal || Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2;
      gesture = null;
      if (horizontal) suppressClickUntil = now() + 500;
      if (!cancelled && horizontal && Math.abs(dx) >= 35 && Math.abs(dx) > Math.abs(dy) * 1.2) move(dx < 0 ? 1 : -1);
    }
    viewport.addEventListener('pointerdown', event => {
      if (event.isPrimary === false || event.pointerType === 'mouse' && event.button !== 0) return;
      startGesture(event.clientX, event.clientY, event.pointerId);
    });
    viewport.addEventListener('pointermove', event => {
      if (!gesture || event.pointerId !== gesture.id) return;
      moveGesture(event.clientX, event.clientY, event);
      if (gesture.horizontal && typeof viewport.setPointerCapture === 'function') {
        try { viewport.setPointerCapture(event.pointerId); } catch (_) { /* Pointer already cancelled by scrolling. */ }
      }
    });
    viewport.addEventListener('pointerup', event => {
      if (!gesture || event.pointerId !== gesture.id) return;
      endGesture(event.clientX, event.clientY);
      if (typeof viewport.releasePointerCapture === 'function') {
        try { viewport.releasePointerCapture(event.pointerId); } catch (_) { /* No active capture. */ }
      }
    });
    viewport.addEventListener('pointercancel', event => {
      if (gesture && event.pointerId === gesture.id) endGesture(event.clientX, event.clientY, true);
    });
    if (typeof window !== 'undefined' && !('PointerEvent' in window)) {
      viewport.addEventListener('touchstart', event => {
        if (event.touches.length !== 1) return;
        const touch = event.touches[0]; startGesture(touch.clientX, touch.clientY, touch.identifier);
      }, { passive: true });
      viewport.addEventListener('touchmove', event => {
        if (!gesture || event.touches.length !== 1) return;
        const touch = event.touches[0]; moveGesture(touch.clientX, touch.clientY, event);
      }, { passive: false });
      viewport.addEventListener('touchend', event => {
        const touch = Array.from(event.changedTouches).find(item => gesture && item.identifier === gesture.id);
        if (touch) endGesture(touch.clientX, touch.clientY);
      });
      viewport.addEventListener('touchcancel', () => { if (gesture) endGesture(gesture.x, gesture.y, true); });
    }
    viewport.addEventListener('click', event => {
      if (now() >= suppressClickUntil) return;
      suppressClickUntil = 0;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    viewport.addEventListener('dragstart', event => event.preventDefault());
    if (typeof ResizeObserver === 'function') {
      let lastWidth = -1;
      new ResizeObserver(entries => {
        const width = entries[0]?.contentRect.width ?? viewport.clientWidth;
        if (Math.abs(width - lastWidth) <= .5) return;
        lastWidth = width;
        refresh();
      }).observe(viewport);
    } else if (typeof window !== 'undefined') window.addEventListener('resize', refresh);
    const controller = { goTo, refresh, links: slideLinks };
    slideLinks.forEach((link, i) => controllersByLink.set(link, { controller, index: i }));
    refresh();
    return controller;
  }
  const carousels = Array.from(document.querySelectorAll('[data-community-carousel]')).map(createCarousel).filter(Boolean);
  if (typeof reducedMotion.addEventListener === 'function') reducedMotion.addEventListener('change', () => carousels.forEach(carousel => carousel.refresh()));
  if (document.fonts) document.fonts.ready.then(() => carousels.forEach(carousel => carousel.refresh()));

  const dialog = document.getElementById('evidence-viewer');
  const image = document.getElementById('evidence-full-image');
  const scroller = document.getElementById('evidence-image-scroll');
  const zoom = document.getElementById('evidence-zoom');
  if (!dialog || !image || !scroller || !zoom) return;
  let items = [];
  let index = 0;
  let opener = null;
  let previousOverflow = '';
  let zoomed = false;
  let mobileReturnPosition = null;
  function reflectZoom(active) {
    zoomed = active;
    scroller.classList.toggle('is-zoomed', active);
    zoom.setAttribute('aria-pressed', String(active));
    zoom.textContent = active ? 'Уместить целиком' : 'Увеличить';
  }
  const mobileZoom = createMobileImageZoom(dialog, image, scroller, reflectZoom);
  function setZoom(active) {
    if (mobileZoom.matches()) {
      mobileZoom.setZoom(active);
      return;
    }
    reflectZoom(active);
    scroller.scrollTop = 0;
    scroller.scrollLeft = 0;
  }
  function showImage() {
    const link = items[index];
    const original = link.querySelector('img');
    image.src = link.getAttribute('href');
    image.alt = original.alt;
    document.getElementById('evidence-viewer-title').textContent = link.dataset.evidenceGroup === 'review' ? 'Отзыв из чата практикума' : 'Пример отдельной сделки';
    document.getElementById('evidence-counter').textContent = `${index + 1} из ${items.length}`;
    document.getElementById('evidence-original').href = link.getAttribute('href');
    opener = link;
    const matched = controllersByLink.get(link);
    if (matched) matched.controller.goTo(matched.index);
    setZoom(false);
  }
  function step(direction) {
    if (!items.length) return;
    index = (index + direction + items.length) % items.length;
    showImage();
  }
  links.forEach(link => link.addEventListener('click', event => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || typeof dialog.showModal !== 'function') return;
    event.preventDefault();
    items = links.filter(item => item.dataset.evidenceGroup === link.dataset.evidenceGroup);
    index = items.indexOf(link);
    showImage();
    if (!dialog.open) {
      mobileReturnPosition = mobileZoom.matches() ? { x: window.scrollX, y: window.scrollY } : null;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      dialog.showModal();
      mobileZoom.refresh();
    }
  }));
  document.getElementById('evidence-prev').addEventListener('click', () => step(-1));
  document.getElementById('evidence-next').addEventListener('click', () => step(1));
  document.getElementById('evidence-close').addEventListener('click', () => dialog.close());
  zoom.addEventListener('click', () => setZoom(!zoomed));
  dialog.addEventListener('keydown', event => {
    if (zoomed || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    step(event.key === 'ArrowLeft' ? -1 : 1);
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow;
    setZoom(false);
    mobileZoom.close();
    focusWithoutScroll(opener);
    if (mobileReturnPosition) {
      const scrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(mobileReturnPosition.x, mobileReturnPosition.y);
      document.documentElement.style.scrollBehavior = scrollBehavior;
      mobileReturnPosition = null;
    }
  });

  // Mobile-only zoom keeps the full-resolution image inside the existing dialog.
  // A scrollable canvas supplies real image bounds; desktop uses its old path.
  function createMobileImageZoom(viewer, photo, viewport, onZoom) {
    const media = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width:700px), (max-width:1100px) and (hover:none) and (pointer:coarse)') : { matches: false };
    const maximumScale = 6;
    let canvas = null;
    let scale = 1;
    let geometry = null;
    let gesture = null;
    const matches = () => media.matches;
    const clamp = value => Math.max(1, Math.min(maximumScale, value));

    function removeCanvas() {
      if (!canvas) return;
      canvas.before(photo);
      canvas.remove();
      canvas = null;
      geometry = null;
      gesture = null;
    }
    function centerAnchor() {
      if (!geometry) return { x: .5, y: .5 };
      return {
        x: (viewport.scrollLeft + geometry.viewportWidth / 2 - geometry.left) / geometry.width,
        y: (viewport.scrollTop + geometry.viewportHeight / 2 - geometry.top) / geometry.height
      };
    }
    function render(anchor = { x: .5, y: .5 }, focal = null) {
      if (!matches() || !viewer.open || !photo.complete || !photo.naturalWidth || !photo.naturalHeight) return;
      const viewportWidth = viewport.clientWidth;
      const viewportHeight = viewport.clientHeight;
      if (!viewportWidth || !viewportHeight) return;
      if (!canvas) {
        canvas = document.createElement('div');
        canvas.className = 'evidence-mobile-canvas';
        viewport.append(canvas);
        canvas.append(photo);
      }
      const fit = Math.min(viewportWidth / photo.naturalWidth, viewportHeight / photo.naturalHeight);
      const width = photo.naturalWidth * fit * scale;
      const height = photo.naturalHeight * fit * scale;
      const canvasWidth = Math.max(viewportWidth, width);
      const canvasHeight = Math.max(viewportHeight, height);
      const left = (canvasWidth - width) / 2;
      const top = (canvasHeight - height) / 2;
      canvas.style.width = canvasWidth + 'px';
      canvas.style.height = canvasHeight + 'px';
      canvas.style.setProperty('--evidence-photo-width', width + 'px');
      canvas.style.setProperty('--evidence-photo-height', height + 'px');
      canvas.style.setProperty('--evidence-photo-left', left + 'px');
      canvas.style.setProperty('--evidence-photo-top', top + 'px');
      viewport.scrollLeft = left + anchor.x * width - (focal ? focal.x : viewportWidth / 2);
      viewport.scrollTop = top + anchor.y * height - (focal ? focal.y : viewportHeight / 2);
      geometry = { width, height, left, top, viewportWidth, viewportHeight };
    }
    function setZoom(active) {
      scale = active ? 2.5 : 1;
      gesture = null;
      onZoom(active);
      render();
      if (!active) viewport.scrollLeft = viewport.scrollTop = 0;
    }
    function refresh() {
      if (!matches()) {
        const wasMobile = Boolean(canvas);
        removeCanvas();
        scale = 1;
        if (wasMobile) onZoom(false);
        return;
      }
      if (!viewer.open) return;
      const anchor = centerAnchor();
      gesture = null;
      onZoom(scale > 1.001);
      render(anchor);
    }
    function localPoint(touches) {
      const rect = viewport.getBoundingClientRect();
      const count = Math.min(touches.length, 2);
      let x = 0, y = 0;
      for (let i = 0; i < count; i++) { x += touches[i].clientX; y += touches[i].clientY; }
      return { x: x / count - rect.left - viewport.clientLeft, y: y / count - rect.top - viewport.clientTop };
    }
    const distance = touches => Math.hypot(touches[1].clientX - touches[0].clientX, touches[1].clientY - touches[0].clientY);
    function begin(touches) {
      gesture = null;
      if (!touches.length || !geometry) return;
      const point = localPoint(touches);
      if (touches.length >= 2) {
        gesture = { count: 2, scale, distance: distance(touches), anchor: {
          x: (viewport.scrollLeft + point.x - geometry.left) / geometry.width,
          y: (viewport.scrollTop + point.y - geometry.top) / geometry.height
        } };
      } else gesture = { count: 1, point, left: viewport.scrollLeft, top: viewport.scrollTop };
    }
    viewport.addEventListener('touchstart', event => {
      if (!matches() || !viewer.open) return;
      if (event.cancelable) event.preventDefault();
      begin(event.touches);
    }, { passive: false });
    viewport.addEventListener('touchmove', event => {
      if (!matches() || !viewer.open) return;
      if (event.cancelable) event.preventDefault();
      if (!event.touches.length) return;
      const count = Math.min(event.touches.length, 2);
      if (!gesture || gesture.count !== count) { begin(event.touches); return; }
      const point = localPoint(event.touches);
      if (count === 2) {
        if (gesture.distance < 1) { begin(event.touches); return; }
        scale = clamp(gesture.scale * distance(event.touches) / gesture.distance);
        onZoom(scale > 1.001);
        render(gesture.anchor, point);
      } else {
        viewport.scrollLeft = gesture.left + gesture.point.x - point.x;
        viewport.scrollTop = gesture.top + gesture.point.y - point.y;
      }
    }, { passive: false });
    viewport.addEventListener('touchend', event => {
      if (matches() && viewer.open) begin(event.touches);
    });
    viewport.addEventListener('touchcancel', () => { gesture = null; });
    photo.addEventListener('load', refresh);
    if (typeof ResizeObserver === 'function') {
      let previousWidth = 0, previousHeight = 0;
      new ResizeObserver(() => {
        const width = viewport.clientWidth, height = viewport.clientHeight;
        if (width === previousWidth && height === previousHeight) return;
        previousWidth = width; previousHeight = height;
        refresh();
      }).observe(viewport);
    } else if (typeof window !== 'undefined') window.addEventListener('resize', refresh);
    if (typeof media.addEventListener === 'function') media.addEventListener('change', refresh);
    return { matches, setZoom, refresh, close() { scale = 1; removeCanvas(); } };
  }
})();
