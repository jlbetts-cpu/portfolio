// Gate: every visible text node is a substring of the allowed copy, placeholders included.
import { browser, open, report } from './_lib.mjs';
import { readFileSync } from 'node:fs';
const allowed = readFileSync(new URL('./allowed-copy.txt', import.meta.url), 'utf8').toLowerCase().replace(/\s+/g, ' ');
const norm = s => s.toLowerCase().replace(/[“”"]/g, '"').replace(/\s+/g, ' ').trim();
const b = await browser();
const pg = await open(b, 1440, 900);
const texts = await pg.evaluate(() => {
  const out = []; const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = walker.nextNode())) { const t = n.textContent.trim(); if (!t) continue; const el = n.parentElement; if (el.closest('script, style, svg, [hidden], .sr-only')) continue; out.push(t); }
  return out;
});
const bad = texts.filter(t => !allowed.includes(norm(t).replace(/"/g, '')) && !allowed.includes(norm(t)));
report('copy', bad.length === 0, bad.length ? `${bad.length} stray strings: ${bad.slice(0, 5).map(s => JSON.stringify(s.slice(0, 40))).join(', ')}` : `${texts.length} text nodes, all from the copy`);
await b.close();
