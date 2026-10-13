// Gate: no horizontal overflow; the headline's line count (it carries four inline photographs and must not run away);
// every container on the column — the closing field included, which used to size itself and sat 36px wide of it at 1920 —
// and the four cards equal width; and since 2026-10-13: two weights, pill controls, no dark control, lines only under
// the header, over the footer and inside an outlined control, and the sections' headings on their photographs' top edge.
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
    // LINES IN THREE PLACES ONLY. They all went on 2026-10-03 ("remove the lines … just use clean white space"), and
    // on 2026-10-13 he asked for "the footer with the clean lines", and the header became a floating pill: so the
    // pill's 1px edge, the footer's hairline (a pseudo-element, checked below), and the 1px ring inside an outlined
    // control are drawn, and nothing else is. Focus and error rings only appear in those states.
    const allowed = e => e.matches('.nav__bar, .btn--primary, .btn--line');
    const navLine = getComputedStyle(document.querySelector('.nav__bar')).boxShadow !== 'none';
    const ft = document.querySelector('.foot__top'); const footLine = !!ft && parseFloat(getComputedStyle(ft, '::before').height) === 1;
    const drawn = [...document.querySelectorAll('body *')].filter(e => {
      if (!e.getClientRects().length || e.closest('dialog:not([open]), .curtain') || allowed(e)) return false;
      const cs = getComputedStyle(e);
      const border = ['Top', 'Right', 'Bottom', 'Left'].some(k => parseFloat(cs['border' + k + 'Width']) > 0 && cs['border' + k + 'Style'] !== 'none' && !/rgba\([^)]*, 0\)|transparent/.test(cs['border' + k + 'Color']));
      return border || cs.boxShadow !== 'none';
    }).map(e => String(e.className || e.tagName).slice(0, 30));
    // the hero is the first screen and what follows only peeks under it (2026-10-03, "you should be able to barely see
    // that it's under the hero"): never more than 80px of it on the first screen, and on a screen tall enough to hold
    // the hero (700px up) never less than 32px — a peek nobody can see is no peek. It was the gallery; since the
    // gallery went to the foot of the page (2026-10-13) it is the first section's photograph.
    const gTop = document.querySelector('#about .tell__figure .photo').getBoundingClientRect().top + scrollY;
    const peek = Math.round(innerHeight - gTop);
    const peekOk = peek <= 80 && (innerHeight < 700 || peek >= 32);
    // Two weights on every visible word, his portfolio's Regular and Semibold since 2026-10-13 (Some Wins' Medium and
    // Bold for the day before, on the dark ground): a third
    // weight is how a ladder rots, and there were two stray 600s before this check existed.
    const weights = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    // and no grey text (2026-10-13, "I'm not a fan of the grey text"): every visible word is in the ink, or is the
    // label on the one filled button, or the skip link, which is inverted (the page's colour on the ink) and only shows on
    // focus. Hierarchy is size and weight. A field's placeholder is not a word on the page.
    const ink = getComputedStyle(h1).color; const grey = [];
    let n; while ((n = walker.nextNode())) { const el = n.parentElement; if (!n.textContent.trim() || !el.getClientRects().length || el.closest('script, style, svg, dialog:not([open]), .curtain, .sr-only')) continue; weights.add(getComputedStyle(el).fontWeight);
      if (!el.closest('.btn--primary, .skip') && getComputedStyle(el).color !== ink) grey.push(n.textContent.trim().slice(0, 24)); }
    // every control is a pill: a corner of at least half its height (on his portfolio's superellipse since 2026-10-13)
    const notCapsule = [...document.querySelectorAll('.btn, .input')].filter(e => e.getClientRects().length && !e.closest('dialog:not([open])')).filter(e => parseFloat(getComputedStyle(e).borderTopLeftRadius) < e.offsetHeight / 2 - 0.5).map(e => String(e.className).slice(0, 30));
    // no dark control (2026-10-13, "such a dark cta … doesnt really fit the site"): no button or link anywhere on the
    // page is filled with a ground darker than mid-grey. The main action is outlined.
    const lumOf = c => { const m = c.match(/[\d.]+/g); if (!m || (m[3] !== undefined && +m[3] === 0)) return 1; return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
    const darks = [...document.querySelectorAll('button, a, input')].filter(e => e.getClientRects().length && !e.closest('dialog:not([open]), .curtain, .skip') && !e.matches('.skip') && lumOf(getComputedStyle(e).backgroundColor) < 0.5).map(e => (e.textContent || e.className).trim().slice(0, 20));
    // the sections read from the top: above 768 the heading's capitals stand on the photograph's top edge
    const capGap = innerWidth >= 768 ? Math.max(...[...document.querySelectorAll('.tell__row')].map(row => Math.abs(row.querySelector('.tell__title').getBoundingClientRect().top - row.querySelector('.tell__figure .photo').getBoundingClientRect().top))) : 0;
    // the gallery is a tight strip (his pick, 2026-10-13): 4px between photographs across and down, a 4px corner
    const cols = [...document.querySelectorAll('.gallery__col')].filter(c => c.offsetParent).map(c => c.getBoundingClientRect());
    const items = [...document.querySelector('.gallery__run').children].slice(0, 2).map(li => li.getBoundingClientRect());
    const strip = { across: Math.round(cols[1].left - cols[0].right), down: Math.round(items[1].top - items[0].bottom), corner: parseFloat(getComputedStyle(document.querySelector('.gallery .photo')).borderTopLeftRadius) };
    return { overflow, lines, edges: [...edges], cards, cross, ragged, oneInk, drawn, peek, peekOk, weights: [...weights].sort(), notCapsule, darks, navLine, footLine, capGap: Math.round(capGap), strip, grey };
  });
  // five lines at every width by design (the display runs to 96px); six means the measure or the clamp has slipped
  const ok = r.overflow <= 0 && r.lines <= 5 && r.edges.length === 1 && r.cards.length === 3 && new Set(r.cards).size === 1 && r.cross === 0 && r.ragged === 0 && r.oneInk && r.drawn.length === 0 && r.peekOk
    && r.weights.join() === '400,600' && r.notCapsule.length === 0 && r.darks.length === 0 && r.navLine && r.footLine && r.capGap <= 2
    && r.strip.across === 4 && r.strip.down === 4 && r.strip.corner === 4 && r.grey.length === 0;
  report(`layout ${w}×${h}`, ok, `overflow ${r.overflow}px, headline ${r.lines} lines, column ${r.edges[0]}, quote cards ${[...new Set(r.cards)].join('/')}, columns crossing ${r.cross}, ragged rules ${r.ragged}, headline one colour ${r.oneInk}, lines drawn ${r.drawn.length ? r.drawn.join(', ') : 0}, gallery peek ${r.peek}px, weights ${r.weights.join('/')}, not capsules ${r.notCapsule.length ? r.notCapsule.join(', ') : 0}, dark controls ${r.darks.length ? r.darks.join(', ') : 0}, header/footer hairlines ${r.navLine}/${r.footLine}, heading off the photo's top ${r.capGap}px, gallery strip ${r.strip.across}/${r.strip.down}px gaps, ${r.strip.corner}px corner, grey text ${r.grey.length ? r.grey.slice(0, 4).join(' | ') : 0}`);
  await pg.close();
}
await b.close();
