// Gate: the film of Linda's work in China (2026-10-16), in its own section after the quote ring.
//   place        the section comes straight after the ring, and every section's ground differs from the one before it
//                (Apple's bands: the film's section is white, so the testimonials went grey and the close white)
//   nothing      a walk down the whole page fetches none of the film; its poster waits until it is near the screen
//   poster       9:16, whole on a 1440×900 screen under the header and the width of a phone's column; the play button
//                is 44px or more, inside the frame's bottom-right quarter (the centre is the poster's own title)
//   play         the button plays it with the sound on, hands over to the browser's controls and to the video's focus,
//                and the poster gives way once the film is drawing; a browser that refuses gives the button back
//   file         H.264 and AAC, which every browser plays (the iPhone's HEVC is not played by Chrome or Firefox on
//                many machines), laid out to start before it has all arrived (moov ahead of mdat), and stamped with
//                its own hash, since /assets/ is cached for a year. This test browser has no H.264 decoder of its own,
//                so playback itself is not watched here: play() is answered for it, and the refusal is real
// --self-test: preloads the film, puts the film's section on grey, and plays it muted; "nothing", "place" and "play"
// must each fail.
import { browser, report, URL } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
const page = async (w, h, { bug, answer } = {}) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const pg = await ctx.newPage();
  await pg.addInitScript((answer) => {
    try { sessionStorage.setItem('di:curtain', '1'); } catch {}
    // the answer a browser with an H.264 decoder gives: play() resolves, and the film starts drawing
    if (answer) HTMLMediaElement.prototype.play = function () { window.__played = { muted: this.muted, controls: this.controls }; setTimeout(() => this.dispatchEvent(new Event('playing')), 50); return Promise.resolve(); };
  }, !!answer);
  if (bug) {
    await pg.route(/index\.html$/, async (route) => {
      const res = await route.fetch(); let t = await res.text();
      if (bug === 'preload') t = t.replace('preload="none"', 'preload="auto"');
      if (bug === 'band') t = t.replace('class="tell watch"', 'class="tell watch band"');
      await route.fulfill({ response: res, body: t });
    });
    if (bug === 'muted') await pg.route(/main\.js/, async (route) => { const res = await route.fetch(); await route.fulfill({ response: res, body: (await res.text()).replace('video.muted = false', 'video.muted = true') }); });
  }
  const film = [], poster = [];
  pg.on('request', r => { if (/linda-china\.mp4/.test(r.url())) film.push(r.url()); if (/linda-china-poster/.test(r.url())) poster.push(r.url()); });
  await pg.goto(URL); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(500);
  return { ctx, pg, film, poster };
};
const fails = {};
const check = (name, ok, detail) => { report(`film: ${name}`, ok, detail); if (!ok) fails[name] = true; };

const run = async (bug) => {
  // place, nothing, poster at 1440
  {
    const { ctx, pg, film, poster } = await page(1440, 900, { bug });
    const posterAtLoad = poster.length;
    const place = await pg.evaluate(() => {
      const secs = [...document.querySelectorAll('main > section, body > section, body > footer')];
      const i = secs.findIndex(s => s.id === 'china');
      const ground = secs.map(s => getComputedStyle(s).backgroundColor === 'rgba(0, 0, 0, 0)' ? getComputedStyle(document.body).backgroundColor : getComputedStyle(s).backgroundColor);
      const same = ground.map((g, k) => k && g === ground[k - 1] ? `${secs[k - 1].id || secs[k - 1].className} / ${secs[k].id || secs[k].className}` : null).filter(Boolean);
      return { after: i > 0 && secs[i - 1].id, title: document.querySelector('#chinaTitle') && document.querySelector('#chinaTitle').textContent, same };
    });
    check('place: after the quote ring, and no two sections in a row on one ground', place.after === 'quote' && place.title === 'Her work in China' && place.same.length === 0, JSON.stringify(place));
    await pg.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto'; for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 100)); } });
    await pg.evaluate(() => document.querySelector('.film').scrollIntoView({ block: 'center' })); await pg.waitForTimeout(1200);
    check('nothing: a walk down the page fetches none of the film, and the poster only once near', film.length === 0 && posterAtLoad === 0 && poster.length === 1, JSON.stringify({ film: film.length, posterAtLoad, poster: poster.length }));
    const g = await pg.evaluate(() => {
      const f = document.querySelector('.film').getBoundingClientRect(), p = document.querySelector('.film__play').getBoundingClientRect(), nav = document.querySelector('.nav__bar').getBoundingClientRect();
      const img = document.querySelector('.film__poster img');
      return { w: f.width, h: f.height, room: innerHeight - nav.bottom, play: [p.width, p.height], quarter: p.left >= f.left + f.width / 2 && p.top >= f.top + f.height / 2 && p.right <= f.right && p.bottom <= f.bottom, shown: img.complete && img.naturalWidth > 0, label: document.querySelector('.film__play').getAttribute('aria-label') };
    });
    check('poster at 1440: 9:16, whole under the header, its button 44px+ in the bottom-right quarter', Math.abs(g.w / g.h - 9 / 16) < .005 && g.h <= g.room && g.play[0] >= 44 && g.play[1] >= 44 && g.quarter && g.shown && /^Play the film/.test(g.label), JSON.stringify(g));
    await ctx.close();
  }
  // poster on a phone
  {
    const { ctx, pg } = await page(390, 844, { bug });
    await pg.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('.film').scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(900);
    const g = await pg.evaluate(() => { const f = document.querySelector('.film').getBoundingClientRect(), c = document.querySelector('#china .tell__copy').getBoundingClientRect(); return { w: Math.round(f.width), col: Math.round(c.width), h: Math.round(f.height), vh: innerHeight }; });
    check('poster on a phone: the column\'s width, 9:16, shorter than the screen', g.w === g.col && Math.abs(g.w / g.h - 9 / 16) < .01 && g.h < g.vh, JSON.stringify(g));
    await ctx.close();
  }
  // play, answered
  {
    const { ctx, pg } = await page(1440, 900, { bug, answer: true });
    await pg.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('.film').scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(900);
    const before = await pg.evaluate(() => ({ controls: document.querySelector('.film__video').controls }));
    const p = await pg.locator('.film__play').boundingBox();
    await pg.mouse.click(p.x + p.width / 2, p.y + p.height / 2); await pg.waitForTimeout(700);
    const after = await pg.evaluate(() => ({ played: window.__played, controls: document.querySelector('.film__video').controls, focus: document.activeElement && document.activeElement.className, button: +getComputedStyle(document.querySelector('.film__play')).opacity, poster: +getComputedStyle(document.querySelector('.film__poster')).opacity }));
    check('play: with the sound on, then the browser\'s controls and focus, the poster gone', !before.controls && after.played && after.played.muted === false && after.controls && after.focus === 'film__video' && after.button === 0 && after.poster === 0, JSON.stringify({ before, after }));
    await ctx.close();
  }
  // play, refused: this browser has no H.264 decoder, so the real play() refuses
  {
    const { ctx, pg } = await page(1440, 900, { bug });
    await pg.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('.film').scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(900);
    await pg.focus('.film__play'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(1500);
    const r = await pg.evaluate(() => ({ started: document.querySelector('.film').classList.contains('is-started'), controls: document.querySelector('.film__video').controls, focus: document.activeElement && document.activeElement.className }));
    check('refused: the button comes back, with focus', !r.started && !r.controls && r.focus === 'film__play', JSON.stringify(r));
    await ctx.close();
  }
};
await run(null);
// the file, and the page without its script
{
  const { ctx, pg } = await page(1440, 900);
  const f = await pg.evaluate(async () => {
    const src = document.querySelector('.film__video source').getAttribute('src'), v = new window.URL(src, location.href).searchParams.get('v');
    const buf = await (await fetch(src)).arrayBuffer(), head = new TextDecoder('latin1').decode(new Uint8Array(buf, 0, Math.min(buf.byteLength, 400000)));
    const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-1', buf))].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 10);
    const raw = await (await fetch(location.href)).text();
    return { mb: +(buf.byteLength / 1048576).toFixed(1), avc1: head.includes('avc1'), mp4a: head.includes('mp4a'), hevc: head.includes('hvc1') || head.includes('hev1'), moov: head.indexOf('moov'), mdat: head.indexOf('mdat'), stamped: v === sha, scriptless: /<video[^>]*\scontrols[\s>]/.test(raw) && /preload="none"/.test(raw) };
  });
  check('file: H.264 and AAC, starts before it has arrived, stamped, the browser\'s controls without the script', f.avc1 && f.mp4a && !f.hevc && f.moov >= 0 && f.moov < f.mdat && f.stamped && f.scriptless && f.mb < 15, JSON.stringify(f));
  await ctx.close();
}
if (selfTest) {
  for (const bug of ['preload', 'band', 'muted']) await run(bug);
  await b.close();
  const caught = fails['nothing: a walk down the page fetches none of the film, and the poster only once near'] && fails['place: after the quote ring, and no two sections in a row on one ground'] && fails['play: with the sound on, then the browser\'s controls and focus, the poster gone'];
  console.log(caught ? 'SELF-TEST OK: the preloaded film, the grey section and the muted play were each caught' : 'SELF-TEST FAILED: ' + JSON.stringify(fails));
  process.exit(caught ? 0 : 1);
}
await b.close();
