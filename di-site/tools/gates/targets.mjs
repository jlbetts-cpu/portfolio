// Gate: every interactive element ≥ 44×44 at four viewports, except links inside paragraphs.
import { browser, open, report } from './_lib.mjs';
const b = await browser();
for (const [w, h] of [[1440, 900], [1024, 768], [390, 844], [320, 640]]) {
  const pg = await open(b, w, h);
  const r = await pg.evaluate(() => {
    const els = [...document.querySelectorAll('a, button, input, [role=button]')].filter(e => !e.closest('p') && !e.closest('dialog:not([open])') && !e.closest('[aria-hidden="true"]') && e.offsetParent !== null && getComputedStyle(e).display !== 'none' && !e.classList.contains('skip'));
    let min = 1e9, worst = '';
    for (const e of els) { const b = e.getBoundingClientRect(); const m = Math.min(b.width, b.height); if (m < min) { min = m; worst = (e.className || e.tagName) + ' "' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24) + '"'; } }
    return { count: els.length, min: Math.round(min), worst };
  });
  report(`targets ${w}×${h}`, r.min >= 44, `${r.count} targets, smallest ${r.min}px (${r.worst})`);
  await pg.close();
}
await b.close();
