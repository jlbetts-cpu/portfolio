// Gate: no horizontal overflow; the headline's line count (it carries four inline photographs and must not run away);
// every container on the column — the closing field included, which used to size itself and sat 36px wide of it at 1920 —
// and the four cards equal width.
import { browser, open, report } from './_lib.mjs';
const b = await browser();
for (const [w, h] of [[1440, 900], [1024, 768], [390, 844], [320, 640]]) {
  const pg = await open(b, w, h);
  const r = await pg.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - innerWidth;
    // the shapes sit on the line as inline-blocks, so counting client rects over-counts: divide the box by the line pitch instead
    const h1 = document.querySelector('.hero__title'); const cs = getComputedStyle(h1);
    const lines = Math.round(h1.getBoundingClientRect().height / parseFloat(cs.lineHeight));
    const cont = [...document.querySelectorAll('.container')].filter(c => !c.closest('.nav')).map(c => { const cs = getComputedStyle(c); const b = c.getBoundingClientRect(); return [Math.round(b.left + parseFloat(cs.paddingLeft)), Math.round(b.right - parseFloat(cs.paddingRight))]; });
    const edges = new Set(cont.map(c => c.join('-')));
    // offsetWidth, not the bounding rect: a card lifts 4px under the pointer and the rect would report the transform
    const cards = [...document.querySelectorAll('.brief')].map(c => c.offsetWidth);
    // The testimonials are the ring now, so the person chip sits INSIDE the necklace. What it must never do is land
    // under a photograph: the clear space is a circle and the chip is a rectangle at the bottom of the quote, which is
    // exactly where the inscribed rectangle runs out. Every ring photograph is a box the chip must miss.
    const boxes = [...document.querySelectorAll('.ring__item .photo')].map(c => c.getBoundingClientRect());
    const whos = [...document.querySelectorAll('.ring__quote.is-on .who')].map(c => c.getBoundingClientRect());
    let overhang = 0;
    whos.forEach((w) => boxes.forEach((b) => {
      if (w.bottom > b.top + 1 && w.top < b.bottom - 1 && w.right > b.left + 1 && w.left < b.right - 1) overhang++;
    }));
    return { overflow, lines, edges: [...edges], cards, overhang };
  });
  // five lines at every width by design (the display runs to 96px); six means the measure or the clamp has slipped
  const ok = r.overflow <= 0 && r.lines <= 5 && r.edges.length === 1 && r.cards.length === 4 && new Set(r.cards).size === 1 && r.overhang === 0;
  report(`layout ${w}×${h}`, ok, `overflow ${r.overflow}px, headline ${r.lines} lines, column ${r.edges[0]}, card widths ${[...new Set(r.cards)].join('/')}, chip overlaps ${r.overhang}`);
  await pg.close();
}
await b.close();
