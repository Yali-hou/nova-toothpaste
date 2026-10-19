/* Compatibility with the existing DICE nova_landing.js / nova_data.py contract.
   Do not rename these API methods, snapshot fields, or legacy event types.
   Participant identity and revision numbers are attached by the DICE host. */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const embedded = params.get('embed') === 'dice' && window.parent !== window;
  const config = window.NOVA_CONFIG || {};
  let parentOrigin = config.parentOrigin || '';
  if (!parentOrigin && document.referrer) {
    try { parentOrigin = new URL(document.referrer).origin; } catch { /* Standalone preview. */ }
  }
  if (!parentOrigin && location.origin !== 'null') parentOrigin = location.origin;
  if (parentOrigin === '*' || parentOrigin === 'null') parentOrigin = '';

  const started = performance.now();
  const state = {
    visit_id: params.get('visit_id') || globalThis.crypto?.randomUUID?.() || `nova-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    active_ms: 0, wall_ms: 0, details_ms: 0, shop_ms: 0, closed: false,
    events: [{ seq: 1, type: 'ad_click', elapsed_ms: 0, at: params.get('click_at') || new Date().toISOString() }]
  };
  let enabled = false, active = false, viewed = false, inBag = false;
  let sections = new Set(), lastTick = started, scrollRequest = 0;
  const elements = { details: document.querySelector('.introduction'), shop: document.querySelector('.product-section') };
  const header = document.querySelector('.site-header');
  const bag = document.getElementById('bag-panel');

  function accrue() {
    if (state.closed) return;
    const now = performance.now();
    const delta = Math.max(0, now - lastTick);
    if (active) {
      state.active_ms += delta;
      for (const section of sections) state[`${section}_ms`] += delta;
    }
    lastTick = now;
    state.wall_ms = now - started;
  }
  function visibility() {
    accrue();
    active = enabled && !state.closed && document.visibilityState === 'visible' && header.offsetWidth > 0;
    sections = new Set();
    if (!active || bag.open) return;
    const top = Math.max(0, header.getBoundingClientRect().bottom);
    const availableHeight = Math.max(0, innerHeight - top);
    // Retain DICE's 50% region threshold; exclude the sticky navigation area.
    for (const [id, element] of Object.entries(elements)) {
      const r = element.getBoundingClientRect();
      const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, top));
      const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
      if (r.height > 0 && r.width > 0 && availableHeight > 0 &&
          h / Math.min(r.height, availableHeight) >= .5 && w / Math.min(r.width, innerWidth) >= .5) sections.add(id);
    }
  }
  function snapshot() {
    accrue();
    const rounded = Object.fromEntries(['active_ms', 'wall_ms', 'details_ms', 'shop_ms'].map(key => [key, Math.round(state[key])]));
    return JSON.parse(JSON.stringify({ ...state, ...rounded }));
  }
  function publish() {
    const data = snapshot();
    if (embedded && parentOrigin) window.parent.postMessage({ type: 'nova-snapshot', snapshot: data }, parentOrigin);
    return data;
  }
  function append(type, data = {}) {
    state.events.push({ seq: state.events.length + 1, type, elapsed_ms: Math.round(performance.now() - started), at: new Date().toISOString(), ...data });
  }
  function record(type, data = {}) {
    if (state.closed || !enabled) return;
    visibility();
    append(type, data);
    publish();
  }
  function activate() {
    if (state.closed) return snapshot();
    enabled = true;
    visibility();
    if (!viewed) { viewed = true; append('landing_view'); }
    window.NOVA?.resume();
    return publish();
  }
  function pause() {
    accrue();
    enabled = false;
    active = false;
    sections.clear();
    return publish();
  }
  function finish(reason = 'close_button') {
    if (!state.closed) {
      accrue();
      if (reason === 'return_to_study') append('return_to_study');
      append(reason === 'page_exit' ? 'page_exit' : 'landing_close', { reason });
      // Close atomically: never publish a close event with closed:false.
      state.closed = true;
      active = false;
      enabled = false;
      sections.clear();
      window.NOVA?.pause();
    }
    return publish();
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `nova-${state.visit_id}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  window.NOVAStudy = Object.freeze({ snapshot, activate, finish, download });

  // Map only recognized events into the existing DICE allowlist.
  // Extra nova:event diagnostics stay separate and cannot invalidate DICE saves.
  window.addEventListener('nova:event', event => {
    const name = event.detail?.name;
    if (state.closed) return;
    if (name === 'shop_now_click') record('shop_now_click', { location: 'product_information' });
    if (name === 'add_to_bag_click' && !inBag) { inBag = true; record('add_to_bag'); }
    if (name === 'bag_open') record('bag_open');
    if (name === 'bag_open' || name === 'bag_close') visibility();
    if (name === 'landing_page_resume' && !enabled) activate();
    if (name === 'landing_page_engagement' && event.detail.reason !== 'visibility_hidden') pause();
  });
  window.addEventListener('scroll', () => {
    if (!scrollRequest) scrollRequest = requestAnimationFrame(() => { scrollRequest = 0; visibility(); });
  }, { passive: true });
  window.addEventListener('resize', visibility, { passive: true });
  document.addEventListener('visibilitychange', () => { visibility(); publish(); });
  window.addEventListener('pagehide', () => finish('page_exit'));
  setInterval(() => { if (enabled && !state.closed) { visibility(); publish(); } }, 2000);
  if (!embedded && config.initiallyActive !== false) activate();
})();
