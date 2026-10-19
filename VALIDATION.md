# Final validation

Validated on 19 October 2026 using Chrome, including a 2× device-pixel ratio.

- Both source product images are 1536 × 1024. The hero now uses the original photograph instead of the 749 × 480 screenshot crop. The page caps its content width, maintaining at least 2× source resolution for both main images at the tested sizes.
- Responsive widths: 320, 390, 768, 1024, 1366 and 1440 CSS pixels; no horizontal overflow.
- Shop Now scrolls to the product without adding an item or navigating away.
- Add to Bag updates once without moving the page; Bag opens empty or populated as appropriate.
- Modal keyboard focus, close/backdrop behavior, mobile layout and scroll restoration pass.
- DICE integration was tested with the existing, unmodified `nova_landing.js` host script and `nova_data.py` ingest/export functions, using an isolated in-memory test participant. No real participant slots or study data were modified.
- DICE activation, matching visit ID, allowed event names, cumulative snapshots, acknowledgments, positive active/section dwell, hidden-tab pause, Escape close, host-button close, repeat visits and duplicate-save handling pass.
- First test visit exported: 1 landing visit, 1 Shop Now click, 1 add-to-bag, positive landing/details/shop dwell, and 0 unclosed visits. After reopening: 2 visits, still 1 add-to-bag, 0 unclosed visits. No `load_incomplete` event or rejected backend message.
- Final snapshots remain unchanged when `finish()` is called repeatedly.
- No JavaScript page errors in these checks.

The current DICE host uses its same-origin static copy, not a cross-origin GitHub Pages iframe. This validation covers that existing integration; it does not claim compatibility with an unchanged host pointed directly at a remote iframe. See README.md.
