// Gate: the four cards and the reader behind them. A card opens the reader on a click anywhere in it; the reader takes
// that card's accent, carries that card's full copy, focuses its title, and Esc returns focus to the card's own control.
// The card photographs are NOT lightbox triggers — the card's click is the only thing that happens when you press one.
// --self-test: strips the reader's copy before comparing, and expects the copy check to fail.
import { browser, open, report } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
let allOk = true;
const check = (name, ok, detail) => { allOk = allOk && ok; report(name, ok, detail); };

const pg = await open(b, 1440, 900);
const shape = await pg.evaluate(() => {
  const cards = [...document.querySelectorAll('.brief')];
  return {
    n: cards.length,
    accents: cards.map(c => c.dataset.accent),
    controls: cards.map(c => !!c.querySelector('.brief__more')),
    titles: cards.map(c => c.querySelector('.brief__title').tagName),
    fullHidden: cards.every(c => getComputedStyle(c.querySelector('.brief__full')).display === 'none'),
    lightboxTriggers: document.querySelectorAll('.briefs [data-photo]').length,
  };
});
check('reader: four cards, four hues, one control each, no lightbox trigger',
  shape.n === 4 && new Set(shape.accents).size === 4 && shape.controls.every(Boolean)
  && shape.titles.every(t => t === 'H2') && shape.fullHidden && shape.lightboxTriggers === 0, JSON.stringify(shape));

// a click on the card's head — not on the button — must open it
await pg.evaluate(() => document.querySelector('.briefs').scrollIntoView({ block: 'center' }));
await pg.waitForTimeout(400);
await pg.locator('.brief').nth(2).locator('.brief__title').click();
await pg.waitForTimeout(500);
const opened = await pg.evaluate((strip) => {
  const d = document.querySelector('#reader'), card = document.querySelectorAll('.brief')[2];
  if (strip) d.querySelector('.reader__prose').textContent = 'lorem';
  const norm = s => s.replace(/\s+/g, ' ').trim();
  return {
    open: d.open, modal: d.matches(':modal'),
    accent: d.dataset.accent === card.dataset.accent,
    head: getComputedStyle(d.querySelector('.reader__head')).backgroundColor,
    title: norm(d.querySelector('.reader__title').textContent) === norm(card.querySelector('.brief__title').textContent),
    copy: norm(d.querySelector('.reader__prose').textContent) === norm(card.querySelector('.brief__full').textContent),
    focus: document.activeElement === d.querySelector('.reader__title'),
    locked: getComputedStyle(d).position === 'fixed',
  };
}, selfTest);
check('reader: a click anywhere on a card opens it, on that card\'s hue, with that card\'s copy',
  opened.open && opened.modal && opened.accent && opened.title && opened.copy && opened.focus, JSON.stringify(opened));

await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
const closed = await pg.evaluate(() => ({
  open: document.querySelector('#reader').open,
  focus: document.activeElement && document.activeElement.className,
  flowFree: !window.__di.flow.holdKeys.includes('reader'),
}));
check('reader: Esc closes it, focus returns to the card, the flow is released',
  !closed.open && /brief__more/.test(closed.focus || '') && closed.flowFree, JSON.stringify(closed));
await pg.close();

// on a phone it is a sheet, and it must still be able to show a paragraph
const m = await open(b, 390, 844);
await m.evaluate(() => document.querySelector('.briefs').scrollIntoView({ block: 'center' }));
await m.waitForTimeout(300);
await m.locator('.brief').nth(0).locator('.brief__title').click();
await m.waitForTimeout(500);
const mob = await m.evaluate(() => { const d = document.querySelector('#reader'); const r = d.getBoundingClientRect(); return { open: d.open, h: Math.round(r.height), vh: innerHeight, prose: Math.round(d.querySelector('.reader__prose').getBoundingClientRect().height) }; });
check('reader: the phone sheet fits the screen and shows the copy',
  mob.open && mob.h <= mob.vh && mob.prose > 60, JSON.stringify(mob));
await m.close();
await b.close();
if (selfTest) { console.log(allOk ? 'SELF-TEST FAILED: gate cannot fail' : 'SELF-TEST OK: the injected copy mismatch was caught'); process.exitCode = allOk ? 1 : 0; }
