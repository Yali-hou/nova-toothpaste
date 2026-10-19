/* Optional DICE/iframe adapter. Define window.NOVA_CONFIG before this script:
   { parentOrigin: 'https://your-dice-host.example', onEvent(event), onClose(state) }.
   No analytics service, cookies or persistent storage are used here. */
(() => {
  'use strict';
  const config = window.NOVA_CONFIG || {};
  const embedded = window.parent !== window;
  const diceEmbedded = embedded && new URLSearchParams(location.search).get('embed') === 'dice';
  let parentOrigin = config.parentOrigin || '';
  if (!parentOrigin && document.referrer) {
    try { parentOrigin = new URL(document.referrer).origin; } catch { /* Local preview. */ }
  }
  if (!parentOrigin && location.origin !== 'null') parentOrigin = location.origin;
  if (parentOrigin === 'null' || parentOrigin === '*') parentOrigin = '';

  const addButton = document.getElementById('add-to-bag');
  const header = document.querySelector('.site-header');
  const bagButton = document.getElementById('open-bag');
  const bagPanel = document.getElementById('bag-panel');
  let previousOverflow = '';
  let added = false;
  let hostActive = config.initiallyActive !== false && !diceEmbedded;
  let activeStart = hostActive && !document.hidden ? performance.now() : null;
  let accumulatedMs = 0;
  let maxScrollPercent = 0;
  let ctaExposed = false;
  let sequence = 0;
  let scrollPending = false;
  const sentMilestones = new Set();
  const sessionId = globalThis.crypto?.randomUUID?.() || `nova-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  function syncClock() {
    const now = performance.now();
    if (activeStart !== null) accumulatedMs += now - activeStart;
    activeStart = hostActive && !document.hidden ? now : null;
  }
  function snapshot() {
    return {
      product_id: 'nova-clinical-white-fresh-mint-100g',
      bag_count: added ? 1 : 0,
      bag_panel_open: bagPanel.open,
      cta_exposed: ctaExposed,
      active_dwell_ms: Math.round(accumulatedMs + (activeStart === null ? 0 : performance.now() - activeStart)),
      max_scroll_percent: maxScrollPercent
    };
  }
  function post(type, payload) {
    if (embedded && parentOrigin) window.parent.postMessage({ source: 'nova-toothpaste', version: 1, type, ...payload }, parentOrigin);
  }
  function emit(name, extra = {}) {
    const event = { name, session_id: sessionId, sequence: ++sequence, timestamp: new Date().toISOString(), ...snapshot(), ...extra };
    window.dispatchEvent(new CustomEvent('nova:event', { detail: event }));
    post('nova:event', { event });
    if (typeof config.onEvent === 'function') {
      try { config.onEvent(event); } catch (error) { console.error('NOVA onEvent callback failed.', error); }
    }
  }
  // This measures geometric visibility, not attention or gaze.
  // A host hiding the iframe must send nova:pause, then nova:resume on reopening.
  function checkCtaVisibility() {
    if (ctaExposed || !hostActive || document.hidden || bagPanel.open) return;
    const rect = addButton.getBoundingClientRect();
    const headerBottom = Math.max(0, header.getBoundingClientRect().bottom);
    const visibleWidth = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(0, rect.left));
    const visibleHeight = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(headerBottom, rect.top));
    if (rect.width > 0 && rect.height > 0 && visibleWidth * visibleHeight >= rect.width * rect.height * 0.5) {
      ctaExposed = true;
      emit('add_to_bag_visible', { minimum_visible_fraction: 0.5 });
    }
  }
  function updateScroll() {
    if (!hostActive || document.hidden || bagPanel.open || header.offsetWidth === 0) return;
    const range = document.documentElement.scrollHeight - innerHeight;
    const percentage = range > 0 ? Math.min(100, Math.max(0, scrollY / range * 100)) : 100;
    maxScrollPercent = Math.max(maxScrollPercent, Math.floor(percentage));
    for (const milestone of [25, 50, 75, 100]) {
      if (maxScrollPercent >= milestone && !sentMilestones.has(milestone)) {
        sentMilestones.add(milestone);
        emit('landing_page_scroll', { milestone });
      }
    }
    checkCtaVisibility();
  }
  function pause(reason = 'host_pause') {
    if (!hostActive) return;
    hostActive = false;
    syncClock();
    emit('landing_page_engagement', { reason });
  }
  function resume() {
    if (hostActive) return;
    hostActive = true;
    syncClock();
    emit('landing_page_resume');
    requestAnimationFrame(updateScroll);
  }
  // The host owns closing the overlay; no Close/X is drawn inside this page.
  function requestClose(reason) {
    if (!embedded && typeof config.onClose !== 'function') return;
    if (bagPanel.open) closeBag('landing_page_close');
    updateScroll();
    if (diceEmbedded && window.NOVAStudy) {
      const diceReason = reason === 'escape_key' ? 'escape' : reason;
      window.NOVAStudy.finish(diceReason);
      if (parentOrigin) window.parent.postMessage({ type: 'nova-close', reason: diceReason }, parentOrigin);
    }
    pause('close');
    emit('landing_page_close', { reason });
    const state = snapshot();
    window.dispatchEvent(new CustomEvent('nova:close', { detail: state }));
    post('nova:close', { state });
    if (typeof config.onClose === 'function') {
      try { config.onClose(state); } catch (error) { console.error('NOVA onClose callback failed.', error); }
    }
  }

  function openBag() {
    if (!hostActive || bagPanel.open) return;
    document.getElementById('bag-empty').hidden = added;
    document.getElementById('bag-filled').hidden = !added;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    bagPanel.showModal();
    bagButton.setAttribute('aria-expanded', 'true');
    emit('bag_open');
  }
  function closeBag(reason) {
    if (!bagPanel.open) return;
    bagPanel.close();
    document.body.style.overflow = previousOverflow;
    bagButton.setAttribute('aria-expanded', 'false');
    bagButton.focus({ preventScroll: true });
    emit('bag_close', { reason });
    requestAnimationFrame(checkCtaVisibility);
  }

  bagButton.addEventListener('click', openBag);
  document.getElementById('close-bag').addEventListener('click', () => closeBag('close_button'));
  document.getElementById('continue-browsing').addEventListener('click', () => closeBag('continue_browsing'));
  bagPanel.addEventListener('cancel', event => { event.preventDefault(); closeBag('escape_key'); });
  bagPanel.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = bagPanel.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]');
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  bagPanel.addEventListener('click', event => {
    const bounds = bagPanel.getBoundingClientRect();
    if (event.target === bagPanel && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) closeBag('backdrop');
  });

  document.getElementById('shop-now').addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!hostActive) return;
    emit('shop_now_click');
    const product = document.getElementById('product');
    const target = Math.max(0, scrollY + product.getBoundingClientRect().top - header.offsetHeight - 24);
    document.getElementById('product-heading').focus({ preventScroll: true });
    window.scrollTo({ top: target, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  });
  addButton.addEventListener('click', () => {
    if (added || !hostActive) return;
    checkCtaVisibility();
    added = true;
    document.getElementById('bag-count').textContent = 'Bag (1)';
    document.getElementById('add-label').textContent = 'Added to Bag ✓';
    document.getElementById('add-symbol').textContent = '';
    addButton.setAttribute('aria-disabled', 'true');
    document.getElementById('bag-announcement').textContent = 'Clinical White Toothpaste added to your bag. Bag contains one item.';
    emit('add_to_bag_click');
  });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && bagPanel.open) {
      event.preventDefault();
      event.stopPropagation();
      closeBag('escape_key');
      return;
    }
    if (event.key === 'Escape' && embedded && config.escapeCloses !== false) {
      event.preventDefault();
      requestClose('escape_key');
    }
  });
  window.addEventListener('scroll', () => {
    if (scrollPending) return;
    scrollPending = true;
    requestAnimationFrame(() => { scrollPending = false; updateScroll(); });
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    syncClock();
    if (document.hidden && hostActive) emit('landing_page_engagement', { reason: 'visibility_hidden' });
    if (!document.hidden) checkCtaVisibility();
  });
  window.addEventListener('resize', checkCtaVisibility, { passive: true });
  window.addEventListener('load', checkCtaVisibility, { once: true });
  window.addEventListener('pagehide', () => pause('pagehide'));
  window.addEventListener('pageshow', event => { if (event.persisted) resume(); });
  window.addEventListener('message', event => {
    if (!embedded || !parentOrigin || event.source !== window.parent || event.origin !== parentOrigin) return;
    if (event.data?.source !== 'nova-host' || event.data?.version !== 1) return;
    if (event.data.type === 'nova:pause') pause();
    if (event.data.type === 'nova:resume') resume();
  });

  window.NOVA = Object.freeze({ getState: snapshot, pause: () => pause('api_pause'), resume, close: () => requestClose('api_close') });
  emit('landing_page_view');
  requestAnimationFrame(checkCtaVisibility);
})();
