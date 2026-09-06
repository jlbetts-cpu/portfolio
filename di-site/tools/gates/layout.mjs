// Gate: no horizontal overflow; the headline's line count (it carries four inline photographs and must not run away);
// section hairlines and containers on the column; stack cards equal width.
import { browser, open, report } from './_lib.mjs';
const b = await browser();
for (const [w, h] of [[1440, 900], [1024, 768], [390, 844], [320, 640]]) {
  const pg = await open(b, w, h);
  const r = await pg.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - innerWidth;
    // the shapes sit on the line as inline-blocks, so counting client rects over-counts: divide the box by the line pitch instead
    const h1 = document.querySelector('.hero__title'); const cs = getComputedStyle(h1);
    const lines = Math.round(h1.getBoundingClientRect().height / parseFloat(cs.lineHeight));
    const cont = [...document.querySelectorAll('.section .container')].map(c => { const cs = getComputedStyle(c); const b = c.getBoundingClientRect(); return [Math.round(b.left + parseFloat(cs.paddingLeft)), Math.round(b.right - parseFloat(cs.paddingRight))]; });
    const edges = new Set(cont.map(c => c.join('-')));
    // offsetWidth, not the bounding rect: a covered card carries a scale transform, and the rect would report that
    // instead of the card's laid-out width — the assertion here is about the layout, not about the scroll position
    const cards = [...document.querySelectorAll('.stack__card')].map(c => c.offsetWidth);
    return { overflow, lines, edges: [...edges], cards };
  });
  // five lines at every width by design (the display runs to 96px); six means the measure or the clamp has slipped
  const ok = r.overflow <= 0 && r.lines <= 5 && r.edges.length === 1 && new Set(r.cards).size === 1;
  report(`layout ${w}×${h}`, ok, `overflow ${r.overflow}px, headline ${r.lines} lines, column ${r.edges[0]}, stack widths ${[...new Set(r.cards)].join('/')}`);
  await pg.close();
}
await b.close();
