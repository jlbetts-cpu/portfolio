// Gate: every visible text node's computed colour against its effective background ≥ 4.5:1 (≥ 3:1 at ≥ 24px), from the DOM,
// in BOTH themes. The card tints and the footer module are ordinary background-colours, so the same walk covers them.
// --self-test: paints --ink-3 onto the ground colour and expects the walk to fail.
import { browser, open, report } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
let worstAll = 99, failed = 0;
for (const theme of ['light', 'dark']) {
  const pg = await open(b, 1440, 900, { theme });
  if (selfTest) await pg.evaluate(() => document.documentElement.style.setProperty('--ink-3', getComputedStyle(document.body).backgroundColor));
  await pg.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 100)); } });
  const r = await pg.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
    const parse = c => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
    const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const over = (fg, bg) => { const a = fg[3]; return [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a)); };
    const base = parse(getComputedStyle(document.body).backgroundColor).slice(0, 3);
    const bgOf = el => { let bg = base; const chain = []; for (let e = el; e; e = e.parentElement) chain.unshift(e); for (const e of chain) { const c = parse(getComputedStyle(e).backgroundColor); if (c[3] > 0) bg = over(c, bg); } return bg; };
    const bad = []; let n = 0, worst = 99;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node; while ((node = walker.nextNode())) {
      const t = node.textContent.trim(); if (!t) continue; const el = node.parentElement;
      if (el.closest('script, style, svg, .sr-only, dialog:not([open]), [aria-hidden=true]')) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;
      const fg = over(parse(cs.color), bgOf(el)); const bg = bgOf(el);
      const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const need = parseFloat(cs.fontSize) >= 24 ? 3 : 4.5; n++;
      if (ratio < need) bad.push(`${t.slice(0, 24)} ${ratio.toFixed(2)}:1`);
      if (ratio < worst) worst = ratio;
    }
    return { n, bad, worst };
  });
  worstAll = Math.min(worstAll, r.worst); failed += r.bad.length;
  report(`contrast (${theme})`, r.bad.length === 0, r.bad.length ? r.bad.slice(0, 6).join(' | ') : `${r.n} text nodes, worst ${r.worst.toFixed(2)}:1`);
  await pg.close();
}
if (selfTest) console.log(failed > 0 ? 'SELF-TEST OK: the injected colour was caught' : 'SELF-TEST FAILED: nothing was caught');
await b.close();
