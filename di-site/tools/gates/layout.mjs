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
    // the sections are Some Wins' tiles since 2026-11-17 (they were Apple's centred stack from 2026-10-13): the words'
    // tile and the photograph's never overlap, side by side or stacked, which is the one way they break when the copy
    // grows. (The old check, words above the photograph, measured 3 crossings on the side-by-side tiles by design.)
    let cross = 0;
    for (const row of document.querySelectorAll('.tell__row')) {
      const f = row.querySelector('.tell__figure').getBoundingClientRect();
      const c = row.querySelector('.tell__copy').getBoundingClientRect();
      if (Math.min(c.right, f.right) - Math.max(c.left, f.left) > 1 && Math.min(c.bottom, f.bottom) - Math.max(c.top, f.top) > 1) cross++;
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
    // Since 2026-11-17 the glass buttons over a photograph (.on-photo: the strip's pause, the film's play) are Some
    // Wins' glass, which he picked with its light caught on the top edge: that inset is the material, not a line.
    // Anything else that draws a border or a shadow still fails.
    const allowed = e => e.matches('.nav__bar, .btn--primary, .btn--line, .on-photo');
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
    // the hero (700px up) never less than 32px — a peek nobody can see is no peek. It was the gallery's columns; since
    // 2026-10-13 it is the reel of photographs between the hero and the first section.
    const gTop = document.querySelector('.reel').getBoundingClientRect().top + scrollY;   // the reel of photographs, since 2026-10-13
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
      // the closing statement's words wait in the quiet ink until they are read (Some Wins' statement, 2026-11-17):
      // exempt only while the script is lighting them, so a word left grey with no --lit on it still fails
      if (!el.closest('.btn--primary, .skip') && !(el.matches('.close__lead span') && el.style.getPropertyValue('--lit') !== '') && getComputedStyle(el).color !== ink) grey.push(n.textContent.trim().slice(0, 24)); }
    // every control is a pill: a corner of at least half its height (on his portfolio's superellipse since 2026-10-13)
    const notCapsule = [...document.querySelectorAll('.btn, .input')].filter(e => e.getClientRects().length && !e.closest('dialog:not([open])')).filter(e => parseFloat(getComputedStyle(e).borderTopLeftRadius) < e.offsetHeight / 2 - 0.5).map(e => String(e.className).slice(0, 30));
    // no dark control (2026-10-13, "such a dark cta … doesnt really fit the site"): no button or link anywhere on the
    // page is filled with a ground darker than mid-grey, with ONE exception since 2026-11-17: the main action
    // (.btn--primary) is Some Wins' liquid ink, which he picked by name ("Liquid ink buttons"). Any other dark control
    // still fails.
    const lumOf = c => { const m = c.match(/[\d.]+/g); if (!m || (m[3] !== undefined && +m[3] === 0)) return 1; return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
    const darks = [...document.querySelectorAll('button, a, input')].filter(e => e.getClientRects().length && !e.closest('dialog:not([open]), .curtain, .skip') && !e.matches('.skip') && !e.matches('.btn--primary') && lumOf(getComputedStyle(e).backgroundColor) < 0.5).map(e => (e.textContent || e.className).trim().slice(0, 20));
    // from 900 the words' tile and the photograph's stand side by side as one row: their tops and their floors meet
    // within 2px (Some Wins' tiles, 2026-11-17; it was the headline and photograph sharing the centre line of Apple's
    // stack). Below 900 they stack, so there is nothing to measure.
    const capGap = innerWidth >= 900 ? Math.max(...[...document.querySelectorAll('.tell__row')].map(row => { const c = row.querySelector('.tell__copy').getBoundingClientRect(), f = row.querySelector('.tell__figure').getBoundingClientRect(); return Math.max(Math.abs(c.top - f.top), Math.abs(c.bottom - f.bottom)); })) : 0;
    // the reel is a film strip (2026-10-14, "kinda like a film strip"): frames 6px apart on the film base, 2px corners,
    // and the frames meet with no gap of their own, so the loop's seam is one more frame boundary and not a jump
    const ph = [...document.querySelectorAll('.reel__run:first-child .photo')].slice(0, 2).map(p => p.getBoundingClientRect());
    const its = [...document.querySelector('.reel__run').children].slice(0, 2).map(li => li.getBoundingClientRect());
    const strip = { across: Math.round(ph[1].left - ph[0].right), down: Math.round(its[1].left - its[0].right), corner: parseFloat(getComputedStyle(document.querySelector('.reel .photo')).borderTopLeftRadius) };
    return { overflow, lines, edges: [...edges], cards, cross, ragged, oneInk, drawn, peek, peekOk, weights: [...weights].sort(), notCapsule, darks, navLine, footLine, capGap: Math.round(capGap), strip, grey };
  });
  // five lines at every width by design (the display runs to 96px); six means the measure or the clamp has slipped
  const ok = r.overflow <= 0 && r.lines <= 5 && r.edges.length === 1 && r.cards.length === 3 && new Set(r.cards).size === 1 && r.cross === 0 && r.ragged === 0 && r.oneInk && r.drawn.length === 0 && r.peekOk
    && r.weights.join() === '400,600' && r.notCapsule.length === 0 && r.darks.length === 0 && r.navLine && r.footLine && r.capGap <= 2
    && r.strip.across === 6 && r.strip.down === 0 && r.strip.corner === 2 && r.grey.length === 0;
  report(`layout ${w}×${h}`, ok, `overflow ${r.overflow}px, headline ${r.lines} lines, column ${r.edges[0]}, quote cards ${[...new Set(r.cards)].join('/')}, words over the photo ${r.cross}, ragged rules ${r.ragged}, headline one colour ${r.oneInk}, lines drawn ${r.drawn.length ? r.drawn.join(', ') : 0}, peek ${r.peek}px, weights ${r.weights.join('/')}, not capsules ${r.notCapsule.length ? r.notCapsule.join(', ') : 0}, dark controls ${r.darks.length ? r.darks.join(', ') : 0}, header/footer hairlines ${r.navLine}/${r.footLine}, tiles' tops and floors apart by ${r.capGap}px, film frames ${r.strip.across}px apart, ${r.strip.down}px between cells, ${r.strip.corner}px corner, grey text ${r.grey.length ? r.grey.slice(0, 4).join(' | ') : 0}`);
  await pg.close();
}
await b.close();
