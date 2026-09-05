// Gate: every photograph opens in the lightbox. A click on a strip card opens that photograph; a drag does not; the arrows and
// the keys move through the set; Esc closes and focus returns to the card; the scrim closes it; the image served is ≥ 960px wide.
import { browser, open, report } from './_lib.mjs';
const b = await browser();
const pg = await open(b, 1440, 900);
const count = await pg.evaluate(() => document.querySelectorAll('.photo__open').length);
const names = await pg.evaluate(() => new Set([...document.querySelectorAll('.photo__open')].map(b => b.dataset.photo)).size);
// a pointer over the strip eases the drift to a stop; then the card is still and a real click lands on it
const first = pg.locator('.strip__card:not([aria-hidden]) .photo__open').first();
const firstName = await first.getAttribute('data-photo');
const fb = await first.boundingBox(); await pg.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2); await pg.waitForTimeout(900);
const fb2 = await first.boundingBox(); await pg.mouse.click(fb2.x + fb2.width / 2, fb2.y + fb2.height / 2); await pg.waitForTimeout(400);
await pg.evaluate(() => { const img = document.querySelector('#lightbox img'); return img && !img.complete ? new Promise(r => { img.onload = img.onerror = r; }) : null; });
const s1 = await pg.evaluate(() => { const d = document.querySelector('#lightbox'); const img = d.querySelector('img'); return { open: d.open, modal: d.matches(':modal'), src: (img && img.currentSrc) || '', natural: img ? img.naturalWidth : 0, focus: (document.activeElement && document.activeElement.className) || '' }; });
report('lightbox: a click opens the photograph, modal, focus on close', s1.open && s1.modal && s1.src.includes(firstName) && s1.focus.includes('lightbox__close'), JSON.stringify({ src: s1.src.split('/').pop(), natural: s1.natural, focus: s1.focus }));
report('lightbox: serves the large file', s1.natural >= 960, `${s1.natural}px`);
await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(500);
const s2 = await pg.evaluate(() => document.querySelector('#lightbox img').currentSrc.split('/').pop());
await pg.click('.lightbox__prev'); await pg.waitForTimeout(500);
const s3 = await pg.evaluate(() => document.querySelector('#lightbox img').currentSrc.split('/').pop());
report('lightbox: the key advances, the arrow goes back', !s2.includes(firstName) && s3.includes(firstName), `${s2} → ${s3}`);
await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
const s4 = await pg.evaluate(() => ({ open: document.querySelector('#lightbox').open, focus: document.activeElement && document.activeElement.dataset.photo }));
report('lightbox: Esc closes and focus returns to the card', !s4.open && s4.focus === firstName, JSON.stringify(s4));
// a drag on the strip must not open it
const box = await first.boundingBox();
await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await pg.mouse.down();
for (let i = 1; i <= 8; i++) { await pg.mouse.move(box.x + box.width / 2 - i * 20, box.y + box.height / 2); await pg.waitForTimeout(16); }
await pg.mouse.up(); await pg.waitForTimeout(400);
const afterDrag = await pg.evaluate(() => document.querySelector('#lightbox').open);
report('lightbox: a drag does not open it', afterDrag === false);
// the scrim closes; a ring photograph opens too
await pg.evaluate(() => { const s = document.querySelector('.ring__stage'); scrollTo(0, scrollY + s.getBoundingClientRect().top + s.offsetHeight / 2 - innerHeight / 2); }); await pg.waitForTimeout(500);
const rb = await pg.locator('.ring__item .photo__open').nth(1).boundingBox(); await pg.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2); await pg.waitForTimeout(900);
const rb2 = await pg.locator('.ring__item .photo__open').nth(1).boundingBox(); await pg.mouse.click(rb2.x + rb2.width / 2, rb2.y + rb2.height / 2); await pg.waitForTimeout(600);
const ringOpen = await pg.evaluate(() => document.querySelector('#lightbox').open);
await pg.mouse.click(20, 120); await pg.waitForTimeout(400);   // the scrim, clear of the arrows
const scrimClosed = await pg.evaluate(() => !document.querySelector('#lightbox').open);
report('lightbox: a ring photograph opens; the scrim closes', ringOpen && scrimClosed, `${count} buttons over ${names} photographs`);
await pg.close(); await b.close();
