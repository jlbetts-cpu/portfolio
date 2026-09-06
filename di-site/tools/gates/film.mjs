// Gate: the one moving picture. It must not be fetched before it is seen, it must run only while it is on screen,
// its own control must stop it, it must never autoplay under reduced motion, and the panel must not stretch the
// 852px source past the point where 20fps handheld footage turns to mush.
// --self-test: takes pause() away and starts the video, which is what "the film ignores reduced motion" looks like
// from the outside — the observer still asks it to stop and it keeps running.
import { browser, open, report } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();

// 1. cold: nothing fetched, and the poster is standing in for it
let pg = await open(b, 1440, 900);
const cold = await pg.evaluate(() => {
  const v = document.querySelector('.film__video');
  return { preload: v.preload, poster: !!v.getAttribute('poster'), bytes: v.readyState, sources: [...v.querySelectorAll('source')].map(s => s.type) };
});
report('film: not fetched before it is seen', cold.preload === 'none' && cold.poster && cold.bytes === 0 && cold.sources.length === 2, JSON.stringify(cold));

// 2. it runs when it arrives, and stops when it leaves
await pg.evaluate(() => document.querySelector('.film__panel').scrollIntoView({ block: 'center' }));
await pg.waitForTimeout(1500);
const playing = await pg.evaluate(() => !document.querySelector('.film__video').paused);
await pg.evaluate(() => scrollTo(0, 0));
await pg.waitForTimeout(900);
const stopped = await pg.evaluate(() => document.querySelector('.film__video').paused);
report('film: runs on screen, stops off it', playing && stopped, JSON.stringify({ playing, stopped }));

// 3. the control stops it, and says so
await pg.evaluate(() => document.querySelector('.film__panel').scrollIntoView({ block: 'center' }));
await pg.waitForTimeout(1200);
await pg.locator('[data-film-toggle]').click();
await pg.waitForTimeout(300);
const held = await pg.evaluate(() => ({ paused: document.querySelector('.film__video').paused, label: document.querySelector('[data-film-toggle]').getAttribute('aria-label'), marked: document.querySelector('.film__panel').classList.contains('is-paused') }));
await pg.locator('[data-film-toggle]').click();
await pg.waitForTimeout(500);
const back = await pg.evaluate(() => !document.querySelector('.film__video').paused);
report('film: its own control stops and restarts it', held.paused && /play/i.test(held.label) && held.marked && back, JSON.stringify({ ...held, back }));

// 4. the panel never stretches the source past 1.17x
const stretch = await pg.evaluate(() => { const r = document.querySelector('.film__panel').getBoundingClientRect(); return +(r.width / 852).toFixed(2); });
report('film: the panel does not stretch the source', stretch <= 1.18, `${stretch}x of 852px`);
await pg.close();

// 5. reduced motion: the poster stands and nothing plays by itself
pg = await open(b, 1920, 1080, { reduced: true });
if (selfTest) await pg.evaluate(() => { HTMLMediaElement.prototype.pause = () => {}; document.querySelector('.film__video').play(); });
await pg.evaluate(() => document.querySelector('.film__panel').scrollIntoView({ block: 'center' }));
await pg.waitForTimeout(1600);
const calm = await pg.evaluate(() => ({ paused: document.querySelector('.film__video').paused, marked: document.querySelector('.film__panel').classList.contains('is-paused') }));
const calmOk = calm.paused && calm.marked;
report('film: never autoplays under reduced motion', calmOk, JSON.stringify(calm));
await pg.close(); await b.close();
if (selfTest) { console.log(!calmOk ? 'SELF-TEST OK: the forced autoplay was caught' : 'SELF-TEST FAILED: gate cannot fail'); process.exitCode = calmOk ? 1 : 0; }
