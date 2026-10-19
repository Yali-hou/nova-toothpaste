/* Example host adapter; keep this outside the participant-facing landing page. */
(() => {
  'use strict';
  const dialog = document.getElementById('landing-dialog');
  const frame = document.getElementById('landing-frame');
  const trigger = document.getElementById('open-landing');
  const log = document.getElementById('event-log');
  const expectedOrigin = location.origin;
  let savedScroll = 0;
  let previousOverflow = '';
  const events = [];

  function signal(type) {
    if (expectedOrigin === 'null') {
      // Local-file preview has no web origin. Access is best-effort only.
      try { frame.contentWindow.NOVA?.[type === 'nova:pause' ? 'pause' : 'resume'](); } catch { /* Use a local server for full integration. */ }
    } else {
      frame.contentWindow.postMessage({ source: 'nova-host', version: 1, type }, expectedOrigin);
    }
  }
  function openLanding() {
    if (dialog.open) return;
    savedScroll = window.scrollY;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    if (!frame.getAttribute('src')) frame.src = 'index.html';
    else signal('nova:resume');
    frame.focus({ preventScroll: true });
  }
  function closeLanding() {
    if (!dialog.open) return;
    signal('nova:pause');
    dialog.close();
    document.body.style.overflow = previousOverflow;
    window.scrollTo({ top: savedScroll, behavior: 'instant' });
    trigger.focus({ preventScroll: true });
  }
  function record(event) {
    events.push(event);
    log.textContent = JSON.stringify(events, null, 2);
    // Replace record() with your DICE event collector; deduplicate by session_id + sequence.
  }
  window.addEventListener('message', event => {
    if (expectedOrigin === 'null' || event.origin !== expectedOrigin || event.source !== frame.contentWindow) return;
    if (event.data?.source !== 'nova-toothpaste' || event.data?.version !== 1) return;
    if (event.data.type === 'nova:close') closeLanding();
    if (event.data.type === 'nova:event') record(event.data.event);
  });
  frame.addEventListener('load', () => {
    if (expectedOrigin !== 'null') return;
    try {
      frame.contentWindow.addEventListener('nova:close', closeLanding);
      frame.contentWindow.addEventListener('nova:event', event => record(event.detail));
    } catch { /* Browsers may isolate file:// iframes. See README. */ }
  });
  trigger.addEventListener('click', openLanding);
  document.getElementById('back-to-feed').addEventListener('click', closeLanding);
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeLanding(); });
  openLanding();
})();
