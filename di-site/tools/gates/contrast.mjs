// Gate: every visible text node's computed colour against its effective background ≥ 4.5:1 (≥ 3:1 at ≥ 24px), from the DOM.
import { browser, open, report } from './_lib.mjs';
const b = await browser();
const pg = await open(b, 1440, 900);
await pg.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 100)); } });
const r = await pg.evaluate(() => {
  const parse = c => { const m = c.match(/[\d.]+/g).map(Number); return m.length === 3 ? [...m, 1] : m; };
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const over = (fg, bg) => { const a = fg[3]; return [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a)); };
  const bgOf = el => { let bg = [24, 24, 24]; const chain = []; for (let e = el; e; e = e.parentElement) chain.unshift(e); for (const e of chain) { const c = parse(getComputedStyle(e).backgroundColor); if (c[3] > 0) bg = over(c, bg); } return bg; };
  const bad = []; let n = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node; while ((node = walker.nextNode())) {
    const t = node.textContent.trim(); if (!t) continue; const el = node.parentElement;
    if (el.closest('script, style, svg, .sr-only, dialog:not([open]), [aria-hidden=true]')) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;
    const fg = over(parse(cs.color), bgOf(el)); const bg = bgOf(el);
    const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const need = parseFloat(cs.fontSize) >= 24 ? 3 : 4.5; n++;
    if (ratio < need) bad.push(`${t.slice(0, 24)} ${ratio.toFixed(2)}:1`);
  }
  return { n, bad };
});
report('contrast', r.bad.length === 0, r.bad.length ? r.bad.slice(0, 6).join(' | ') : `${r.n} text nodes ≥ 4.5:1`);
await b.close();
