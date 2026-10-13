// Gate: no horizontal overflow; the headline's line count (it carries four inline photographs and must not run away);
// every container on the column — the closing field included, which used to size itself and sat 36px wide of it at 1920 —
// and the four cards equal width; and since 2026-10-13 Some Wins' rules: two weights, capsule controls, one white
// button on the first screen, and the sections' headings standing on their photographs' top edge.
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
    // the three quotes: equal width, and on a row (1024 up) the names on one line however uneven the quotes are —
    // each quote stands under a hairline and the name is pushed to the foot. Below 1024 they are one per row.
    const cards = [...document.querySelectorAll('.voice')].map(c => c.offsetWidth);
    const rules = [...document.querySelectorAll('.voice__who')].map(c => Math.round(c.getBoundingClientRect().top));
    const ragged = innerWidth >= 1024 && new Set(rules).size > 1 ? 1 : 0;
    // the headline is one colour: every word of the claim in the ink, none of it a tier down (2026-10-03)
    const inks = [...h1.querySelectorAll('*')].concat(h1).map(e => getComputedStyle(e).color);
    const oneInk = new Set(inks).size === 1;
    // no lines anywhere (2026-10-03, "remove the lines … just use clean white space"): no visible element draws a
    // border or a box-shadow. Focus and error rings only appear in those states, so a page at rest has none.
    const drawn = [...document.querySelectorAll('body *')].filter(e => {
      if (!e.getClientRects().length || e.closest('dialog:not([open]), .curtain')) return false;
      const cs = getComputedStyle(e);
      const border = ['Top', 'Right', 'Bottom', 'Left'].some(k => parseFloat(cs['border' + k + 'Width']) > 0 && cs['border' + k + 'Style'] !== 'none' && !/rgba\([^)]*, 0\)|transparent/.test(cs['border' + k + 'Color']));
      return border || cs.boxShadow !== 'none';
    }).map(e => String(e.className || e.tagName).slice(0, 30));
    // the hero is the first screen and the gallery only peeks under it (2026-10-03, "you should be able to barely see
    // that it's under the hero"): never more than 80px of it on the first screen, and on a screen tall enough to hold
    // the hero (700px up) never less than 32px — a peek nobody can see is no peek
    const gTop = document.querySelector('.gallery').getBoundingClientRect().top + scrollY;
    const peek = Math.round(innerHeight - gTop);
    const peekOk = peek <= 80 && (innerHeight < 700 || peek >= 32);
    // Some Wins' rules, taken 2026-10-13 (docs/taste.md). Two weights, Medium and Bold, on every visible word: a third
    // weight is how a ladder rots, and there were two stray 600s before this check existed.
    const weights = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; while ((n = walker.nextNode())) { const el = n.parentElement; if (!n.textContent.trim() || !el.getClientRects().length || el.closest('script, style, svg, dialog:not([open]), .curtain, .sr-only')) continue; weights.add(getComputedStyle(el).fontWeight); }
    // every control is a capsule: a corner of at least half its height, drawn round rather than as a superellipse
    const notCapsule = [...document.querySelectorAll('.btn, .input')].filter(e => e.getClientRects().length && !e.closest('dialog:not([open])')).filter(e => { const cs = getComputedStyle(e); return parseFloat(cs.borderTopLeftRadius) < e.offsetHeight / 2 - 0.5 || (cs.cornerShape && !/^round/.test(cs.cornerShape)); }).map(e => String(e.className).slice(0, 30));
    // one white thing on the first screen: of the controls visible at the top of the page, one carries the primary fill
    const primary = getComputedStyle(document.querySelector('.hero .btn--primary')).backgroundColor;
    const whites = [...document.querySelectorAll('button, a, input')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.bottom > 0 && r.top < innerHeight && getComputedStyle(e).backgroundColor === primary; }).length;
    // the sections read from the top: above 768 the heading's capitals stand on the photograph's top edge
    const capGap = innerWidth >= 768 ? Math.max(...[...document.querySelectorAll('.tell__row')].map(row => Math.abs(row.querySelector('.tell__title').getBoundingClientRect().top - row.querySelector('.tell__figure .photo').getBoundingClientRect().top))) : 0;
    // the gallery is a tight strip (his pick, 2026-10-13): 4px between photographs across and down, a 4px corner
    const cols = [...document.querySelectorAll('.gallery__col')].filter(c => c.offsetParent).map(c => c.getBoundingClientRect());
    const items = [...document.querySelector('.gallery__run').children].slice(0, 2).map(li => li.getBoundingClientRect());
    const strip = { across: Math.round(cols[1].left - cols[0].right), down: Math.round(items[1].top - items[0].bottom), corner: parseFloat(getComputedStyle(document.querySelector('.gallery .photo')).borderTopLeftRadius) };
    return { overflow, lines, edges: [...edges], cards, cross, ragged, oneInk, drawn, peek, peekOk, weights: [...weights].sort(), notCapsule, whites, capGap: Math.round(capGap), strip };
  });
  // five lines at every width by design (the display runs to 96px); six means the measure or the clamp has slipped
  const ok = r.overflow <= 0 && r.lines <= 5 && r.edges.length === 1 && r.cards.length === 3 && new Set(r.cards).size === 1 && r.cross === 0 && r.ragged === 0 && r.oneInk && r.drawn.length === 0 && r.peekOk
    && r.weights.join() === '500,700' && r.notCapsule.length === 0 && r.whites === 1 && r.capGap <= 2
    && r.strip.across === 4 && r.strip.down === 4 && r.strip.corner === 4;
  report(`layout ${w}×${h}`, ok, `overflow ${r.overflow}px, headline ${r.lines} lines, column ${r.edges[0]}, quote cards ${[...new Set(r.cards)].join('/')}, columns crossing ${r.cross}, ragged rules ${r.ragged}, headline one colour ${r.oneInk}, lines drawn ${r.drawn.length ? r.drawn.join(', ') : 0}, gallery peek ${r.peek}px, weights ${r.weights.join('/')}, not capsules ${r.notCapsule.length ? r.notCapsule.join(', ') : 0}, white buttons on the first screen ${r.whites}, heading off the photo's top ${r.capGap}px, gallery strip ${r.strip.across}/${r.strip.down}px gaps, ${r.strip.corner}px corner`);
  await pg.close();
}
await b.close();
