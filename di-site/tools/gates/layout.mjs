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
    // the two sections: above 768 the photograph and the prose sit in their own columns and must never overlap,
    // which is the one way a two-column row breaks when the copy grows
    let cross = 0;
    for (const row of document.querySelectorAll('.tell__row')) {
      const f = row.querySelector('.tell__figure').getBoundingClientRect();
      const c = row.querySelector('.tell__copy').getBoundingClientRect();
      const side = innerWidth >= 768;
      if (side && f.right > c.left + 1 && f.left < c.right - 1) cross++;
    }
    // the three quote cards: equal width, and their rules on one line across the row — the cards stretch so the
    // hairlines align however uneven the quotes are, and that is the thing the design is holding
    const cards = [...document.querySelectorAll('.voice')].map(c => c.offsetWidth);
    const rules = [...document.querySelectorAll('.voice__who')].map(c => Math.round(c.getBoundingClientRect().top));
    const ragged = innerWidth >= 768 && new Set(rules).size > 1 ? 1 : 0;
    return { overflow, lines, edges: [...edges], cards, cross, ragged };
  });
  // five lines at every width by design (the display runs to 96px); six means the measure or the clamp has slipped
  const ok = r.overflow <= 0 && r.lines <= 5 && r.edges.length === 1 && r.cards.length === 3 && new Set(r.cards).size === 1 && r.cross === 0 && r.ragged === 0;
  report(`layout ${w}×${h}`, ok, `overflow ${r.overflow}px, headline ${r.lines} lines, column ${r.edges[0]}, quote cards ${[...new Set(r.cards)].join('/')}, columns crossing ${r.cross}, ragged rules ${r.ragged}`);
  await pg.close();
}
await b.close();
