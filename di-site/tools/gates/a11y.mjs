// Gate: axe-core, zero violations; one h1; skip link first; every section labelled.
import { browser, open, report } from './_lib.mjs';
import { readFileSync } from 'node:fs';
const axe = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const b = await browser();
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const pg = await open(b, w, h);
  await pg.addScriptTag({ content: axe });
  const res = await pg.evaluate(async () => { const r = await axe.run(document, { rules: { 'color-contrast': { enabled: true } } }); return r.violations.map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0].target[0]}`); });
  const basics = await pg.evaluate(() => ({ h1: document.querySelectorAll('h1').length, skipFirst: document.body.firstElementChild.classList.contains('skip'), unlabelled: [...document.querySelectorAll('section')].filter(s => !s.getAttribute('aria-label') && !s.getAttribute('aria-labelledby')).length }));
  report(`a11y ${w}×${h}`, res.length === 0 && basics.h1 === 1 && basics.skipFirst && basics.unlabelled === 0, res.length ? res.join(' | ') : JSON.stringify(basics));
  await pg.close();
}
await b.close();
