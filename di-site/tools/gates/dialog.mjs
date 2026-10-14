// Gate: the newsletter dialog and the sign-up, for a visitor who has not subscribed and for one who has.
//   asked, not pushed  since 2026-10-14 it never opens by itself: not at half the page after eleven seconds, not at the
//                      foot. It used to, after 40% and ten seconds; asked for "simple elegant things", he picked
//                      dropping it (NN/g ranks modal popups the most disliked kind, and the closing section already
//                      asks). A Subscribe button still opens it, with focus on its heading, and Esc closes it
//   validation         a bad address is refused without a network call
//   phone              the sheet a button opens is the full width of the screen, on its foot
//   not asked twice    a stored subscriber sees no Subscribe anywhere, the hero's included, and the closing sign-up
//                      gives way to "Subscribed"; the header pill stays balanced without its button (within 2px)
// --self-test: puts the automatic opening back, and drops the subscriber's class; "never by itself" and "not asked
// twice" must each fail.
import { browser, report, URL } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
const fails = {};
const check = (name, ok, detail) => { report(`dialog: ${name}`, ok, detail); if (!ok) fails[name] = true; };
const ctxPage = async (w, h, subscriber) => {
  const pg = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  await pg.addInitScript((s) => { try { sessionStorage.setItem('di:curtain', '1'); if (s) localStorage.setItem('di:newsletter', 'subscribed'); } catch {} }, subscriber);
  if (selfTest) await pg.addInitScript((s) => {
    // the bug: the old automatic opening, and a page that forgot its subscriber
    addEventListener('DOMContentLoaded', () => { setTimeout(() => { const d = document.querySelector('#newsletterDialog'); if (d && !d.open) d.showModal(); }, 4000); if (s) document.documentElement.classList.remove('subscribed'); });
  }, subscriber);
  await pg.goto(URL); await pg.evaluate(() => document.fonts.ready);
  await pg.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
  return pg;
};

let pg = await ctxPage(1440, 900, false);
await pg.evaluate(() => scrollTo(0, document.documentElement.scrollHeight * 0.5)); await pg.waitForTimeout(11000);
const mid = await pg.evaluate(() => document.querySelector('#newsletterDialog').open);
await pg.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await pg.waitForTimeout(1500);
const foot = await pg.evaluate(() => document.querySelector('#newsletterDialog').open);
check('never opens by itself (half the page at 11s, then the foot)', !mid && !foot, JSON.stringify({ mid, foot }));
if (mid || foot) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(300); }
// the header leaves going down and comes back going up, so reach its button the way a visitor does: scroll up first
await pg.evaluate(() => scrollBy(0, -400)); await pg.waitForTimeout(600);
await pg.click('.nav__panel [data-open-dialog]'); await pg.waitForTimeout(300);
const manual = await pg.evaluate(() => ({ open: document.querySelector('#newsletterDialog').open, focus: document.activeElement && document.activeElement.id }));
check('the header button opens it, focus on its heading', manual.open && manual.focus === 'dialogTitle', JSON.stringify(manual));
await pg.fill('#dlg-email', 'not-an-email');
let requests = 0; pg.on('request', r => { if (r.method() === 'POST') requests++; });
await pg.click('#newsletterDialog button[type=submit]'); await pg.waitForTimeout(300);
const err = await pg.evaluate(() => document.querySelector('#newsletterDialog .field').classList.contains('is-error'));
check('rejects a bad email without a network call', err && requests === 0);
await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
check('Esc closes it', await pg.evaluate(() => !document.querySelector('#newsletterDialog').open));
const asked = await pg.evaluate(() => ({ done: getComputedStyle(document.querySelector('.close__done')).display, sign: getComputedStyle(document.querySelector('.close__sign')).display }));
check('a visitor who has not subscribed is asked, with no "Subscribed" line', asked.done === 'none' && asked.sign !== 'none', JSON.stringify(asked));
await pg.close();

pg = await ctxPage(390, 844, false);
await pg.click('.hero__act .btn'); await pg.waitForTimeout(700);
const sw = await pg.evaluate(() => { const r = document.querySelector('#newsletterDialog').getBoundingClientRect(); return { modal: document.querySelector('#newsletterDialog').matches(':modal'), left: r.left, right: Math.round(r.right * 10) / 10, vw: document.documentElement.clientWidth, bottom: Math.round(r.bottom), vh: innerHeight }; });
check('the sheet on a phone is the full width of the screen, on its foot', sw.modal && sw.left === 0 && Math.abs(sw.right - sw.vw) < 1 && Math.abs(sw.bottom - sw.vh) < 2, JSON.stringify(sw));
await pg.close();

for (const [w, h] of [[1440, 900], [390, 844]]) {
  pg = await ctxPage(w, h, true);
  await pg.waitForTimeout(500);
  const s = await pg.evaluate(() => {
    const shown = (el) => { const r = el.getBoundingClientRect(); return getComputedStyle(el).display !== 'none' && r.width > 0 && r.height > 0; };
    const asks = [...document.querySelectorAll('[data-open-dialog], .close__sign, .hero__act')].filter(shown).map(e => e.className || e.tagName);
    const bar = document.querySelector('.nav__bar').getBoundingClientRect(), glyph = document.querySelector('.nav__glyph').getBoundingClientRect();
    const links = [...document.querySelectorAll('.nav__links a')].filter(shown);
    let balance = 0;
    if (links.length) { const rg = document.createRange(); rg.selectNodeContents(links[links.length - 1]); balance = Math.round((bar.right - rg.getBoundingClientRect().right) - (glyph.left - bar.left)); }
    return { asks, done: shown(document.querySelector('.close__done')), balance };
  });
  check(`not asked twice ${w}`, s.asks.length === 0 && s.done && Math.abs(s.balance) <= 2, JSON.stringify(s));
  await pg.close();
}
await b.close();
if (selfTest) {
  const caught = fails['never opens by itself (half the page at 11s, then the foot)'] && fails['not asked twice 1440'] && fails['not asked twice 390'];
  console.log(caught ? 'SELF-TEST OK: the automatic popup and the forgotten subscriber were each caught' : 'SELF-TEST FAILED: ' + JSON.stringify(fails));
  process.exitCode = caught ? 0 : 1;
}
