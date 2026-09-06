// Gate: under reduced motion nothing drifts (ring, bento), nothing animates after 300ms and reveals still reach opacity 1;
// without it the ring drifts and the bento drifts. The cards lift on hover, which is a transform the gate reads directly.
// The reveal check names the ELEMENTS, not the .reveal class: the class is removed once an element has arrived (it
// carries the arrival's timing and was overriding every component's own hover), so `.reveal` after the fact selects
// nothing and `.every()` on an empty list passes for free — an assertion that cannot fail.
// --self-test: puts the .reveal class back on a card after it has arrived — the state this gate now forbids, and the
// one that quietly governed every card's hover for the rest of the session.
import { browser, open, report } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
let pg = await open(b, 1440, 900, { reduced: true });
await pg.waitForTimeout(300);
const r1 = await pg.evaluate(async (st) => {
  const running = document.getAnimations().filter(a => a.playState === 'running').length;
  const a0 = window.__di.flow.angle; const t0 = document.querySelector('[data-bento]').style.transform;
  await new Promise(r => setTimeout(r, 500));
  const still = Math.abs(window.__di.flow.angle - a0) < 0.01 && document.querySelector('[data-bento]').style.transform === t0;
  // walk down the page rather than jumping: an IntersectionObserver only reports what it sees, and a single
  // scrollIntoView past four cards can leave them at opacity 0 for good
  for (let y = 0; y <= document.body.scrollHeight; y += innerHeight / 2) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
  await new Promise(r => setTimeout(r, 500));
  if (st) document.querySelector('.brief').classList.add('reveal');   // --self-test: the state below forbids
  const shown = [...document.querySelectorAll('.brief, .scene__panel, .ring__centre .reveal, #contact .close__field')];
  // arrived AND handed its motion back: an element that keeps .reveal keeps the arrival's 360ms and its stagger delay
  // on every later hover, and the hue in its own transition list never fades at all
  const bad = shown.filter(e => getComputedStyle(e).opacity !== '1' || e.classList.contains('reveal')).map(e => e.className + ':' + getComputedStyle(e).opacity);
  const revealed = shown.length >= 6 && bad.length === 0;
  const cardStill = getComputedStyle(document.querySelector('.brief')).transform;
  return { running, still, revealed, shown: shown.length, bad, cardStill };
}, selfTest);
const ok1 = r1.running === 0 && r1.still && r1.revealed && (r1.cardStill === 'none' || r1.cardStill === 'matrix(1, 0, 0, 1, 0, 0)');
report('motion (reduced)', ok1, JSON.stringify(r1));
await pg.close();
pg = await open(b, 1440, 900);
const r2 = await pg.evaluate(async () => {
  // the flow drifts while the bento or the ring is on screen; the bento is in the hero, so start at the top
  scrollTo(0, 0); await new Promise(r => setTimeout(r, 1800));
  const a0 = window.__di.flow.angle; await new Promise(r => setTimeout(r, 800)); const drifts = window.__di.flow.angle - a0 > 1;
  return { drifts };
});
report('motion (full)', r2.drifts, JSON.stringify(r2));
await pg.close(); await b.close();
if (selfTest) { console.log(!ok1 ? 'SELF-TEST OK: the stuck reveal was caught' : 'SELF-TEST FAILED: gate cannot fail'); process.exitCode = ok1 ? 1 : 0; }
