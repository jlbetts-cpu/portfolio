// Gate: what the page is seen by before it is opened. Since 2026-10-14, when they went light with the page ("Share card
// + icons", his pick): until then the share card and the home-screen icon were still the old dark ground and the first
// palette with a white star, the tab's icon was a white monogram that vanished on every light tab strip, the browser
// bar's colour was a ground the page no longer had, and og:image was relative, which a link preview cannot resolve.
//   bar        theme-color, and the manifest's theme and background, are the page's own ground
//   card       og:image is an absolute https address, stamped; its picture is 1200×630 as declared, its ground is the
//              page's, and it holds the tuned sky and the gold star and none of the old sky (a few pixels near it are
//              the new sky's antialiased edge on white, so it is a share: under 1 in 100 of the sky); og:url is the canonical
//   icons      the home-screen icon and both manifest icons: the page's ground at the corner, the tuned sky and gold
//   tab        the favicon is drawn in the two tokens --logo-sky and --logo-star and nothing else
//   stamps     every one of these addresses carries ?v= and the stamp is the file's own sha1, because /assets/ is
//              served immutable for a year: a file replaced under an old stamp never reaches a cache that has it
// --self-test: puts back the relative og:image and the old bar colour, and points the home-screen icon at a dark
// picture; "card", "bar" and "icons" must each fail.
import { browser, open, report, URL } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
const pg = await open(b, 1440, 900);
if (selfTest) await pg.evaluate(() => {
  document.querySelector('meta[property="og:image"]').content = 'assets/og.png';
  document.querySelector('meta[name="theme-color"]').content = '#FAFAFB';
  const c = document.createElement('canvas'); c.width = c.height = 180; const x = c.getContext('2d'); x.fillStyle = '#1B1916'; x.fillRect(0, 0, 180, 180);
  document.querySelector('link[rel="apple-touch-icon"]').href = c.toDataURL();
});
const r = await pg.evaluate(async (pageURL) => {
  const hex = (rgb) => '#' + rgb.match(/\d+/g).slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('').toUpperCase();
  const ground = hex(getComputedStyle(document.body).backgroundColor);
  const tok = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim().toUpperCase();
  const sky = tok('--logo-sky'), gold = tok('--logo-star');
  const meta = (sel) => (document.querySelector(sel) || {}).content || (document.querySelector(sel) || {}).href || '';
  const OLD_SKY = '#58CDFC';
  // a production address is read from this server instead: same path, same stamp
  const local = (u) => { const a = new window.URL(u, location.href); return new window.URL(a.pathname + a.search, pageURL).href; };
  const sha = async (buf) => [...new Uint8Array(await crypto.subtle.digest('SHA-1', buf))].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 10);
  const stamped = async (u) => { if (u.startsWith('data:')) return false; const a = new window.URL(u, location.href); const v = a.searchParams.get('v'); if (!v) return false; const res = await fetch(local(u)); return res.ok && v === await sha(await res.arrayBuffer()); };
  // a picture's corner, and how many of its pixels are each of the given colours (within a small distance, for the antialiasing)
  const look = async (u, colours) => {
    const img = new Image(); img.src = u.startsWith('data:') ? u : local(u); await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
    const rgb = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const counts = colours.map(() => 0), want = colours.map(rgb);
    for (let i = 0; i < d.length; i += 4) want.forEach((w, k) => { if (Math.abs(d[i] - w[0]) + Math.abs(d[i + 1] - w[1]) + Math.abs(d[i + 2] - w[2]) < 12) counts[k]++; });
    return { w: c.width, h: c.height, corner: '#' + [d[0], d[1], d[2]].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase(), counts };
  };
  const out = { ground, sky, gold };
  // bar
  const man = document.querySelector('link[rel="manifest"]').href;
  const mj = await (await fetch(local(man))).json();
  out.bar = { theme: meta('meta[name="theme-color"]').toUpperCase(), manTheme: mj.theme_color.toUpperCase(), manGround: mj.background_color.toUpperCase() };
  out.barOk = out.bar.theme === ground && out.bar.manTheme === ground && out.bar.manGround === ground;
  // card
  const og = meta('meta[property="og:image"]');
  const card = await look(og, [sky, gold, OLD_SKY]);
  out.card = { og, absolute: /^https:\/\//.test(og), ...card, declared: [+meta('meta[property="og:image:width"]'), +meta('meta[property="og:image:height"]')], url: meta('meta[property="og:url"]'), canonical: document.querySelector('link[rel="canonical"]').href, large: meta('meta[name="twitter:card"]') };
  out.cardOk = out.card.absolute && card.w === 1200 && card.h === 630 && out.card.declared[0] === 1200 && out.card.declared[1] === 630 && card.corner === ground && card.counts[0] > 2000 && card.counts[1] > 200 && card.counts[2] < card.counts[0] / 100 && out.card.url === out.card.canonical && out.card.large === 'summary_large_image';
  // icons
  const touch = document.querySelector('link[rel="apple-touch-icon"]').href;
  const icons = [touch, ...mj.icons.map(i => new window.URL(i.src, man).href)];
  out.icons = [];
  for (const u of icons) { const l = await look(u, [sky, gold, OLD_SKY]); out.icons.push({ u: u.slice(-40), corner: l.corner, sky: l.counts[0], gold: l.counts[1], old: l.counts[2] }); }
  out.iconsOk = out.icons.every(i => i.corner === ground && i.sky > 100 && i.gold > 10 && i.old < i.sky / 100);
  // tab
  const fav = document.querySelector('link[rel="icon"]').href;
  const fills = [...new Set(((await (await fetch(local(fav))).text()).match(/fill="(#[0-9A-Fa-f]{6}|[a-z]+)"/g) || []).map(f => f.slice(6, -1).toUpperCase()).filter(f => f !== 'NONE'))].sort();
  out.tab = fills; out.tabOk = fills.length === 2 && fills.includes(sky) && fills.includes(gold);
  // stamps
  out.stamps = {};
  for (const [k, u] of [['og', og], ['favicon', fav], ['touch', touch], ['manifest', man], ...mj.icons.map(i => [i.sizes, new window.URL(i.src, man).href])]) out.stamps[k] = await stamped(u);
  out.stampsOk = Object.values(out.stamps).every(Boolean);
  return out;
}, URL);
const parts = { bar: r.barOk, card: r.cardOk, icons: r.iconsOk, tab: r.tabOk, stamps: r.stampsOk };
for (const [k, ok] of Object.entries(parts)) report(`share: ${k}`, ok, JSON.stringify(k === 'bar' ? r.bar : k === 'card' ? r.card : k === 'icons' ? r.icons : k === 'tab' ? { fills: r.tab, sky: r.sky, gold: r.gold } : r.stamps));
await b.close();
if (selfTest) { const caught = !parts.card && !parts.bar && !parts.icons; console.log(caught ? 'SELF-TEST OK: the relative card, the old bar and the dark icon were each caught' : 'SELF-TEST FAILED: ' + JSON.stringify(parts)); process.exitCode = caught ? 0 : 1; }
