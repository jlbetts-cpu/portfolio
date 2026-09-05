// Gate: under reduced motion nothing runs after 300ms and reveals still reach opacity 1; without it the arch and the figures move and the controls stop them.
import { browser, open, report } from './_lib.mjs';
const b = await browser();
let pg = await open(b, 1440, 900, { reduced: true });
await pg.waitForTimeout(300);
const r1 = await pg.evaluate(async () => {
  const running = document.getAnimations().filter(a => a.playState === 'running' && !(a.effect && a.effect.target && a.effect.target.closest('.orbit__ring, .logo__ring, .figures'))).length;
  const orbitRunning = [...document.querySelectorAll('.orbit__item')].filter(it => getComputedStyle(it).animationPlayState.split(',')[0].trim() === 'running').length;
  document.querySelector('#contact').scrollIntoView(); await new Promise(r => setTimeout(r, 500));
  const revealed = [...document.querySelectorAll('#contact .reveal')].every(e => getComputedStyle(e).opacity === '1');
  return { running, orbitRunning, revealed };
});
report('motion (reduced)', r1.running === 0 && r1.orbitRunning === 0 && r1.revealed, JSON.stringify(r1));
await pg.close();
pg = await open(b, 1440, 900);
const r2 = await pg.evaluate(async () => {
  const it = document.querySelector('.orbit__item'); const fg = document.querySelector('.figure');
  const t1 = getComputedStyle(it).transform; const f1 = getComputedStyle(fg).transform;
  await new Promise(r => setTimeout(r, 800));
  const moved = getComputedStyle(it).transform !== t1; const bobbed = getComputedStyle(fg).transform !== f1;
  document.querySelector('.orbit__pause').click(); document.querySelector('.figures__pause').click();
  await new Promise(r => setTimeout(r, 50));
  const t2 = getComputedStyle(it).transform; const f2 = getComputedStyle(fg).transform; await new Promise(r => setTimeout(r, 600));
  const stopped = getComputedStyle(it).transform === t2; const stoppedF = getComputedStyle(fg).transform === f2;
  const ringTurns = getComputedStyle(document.querySelector('.logo__ring')).animationName === 'ring-turn';
  return { moved, bobbed, stopped, stoppedF, ringTurns };
});
report('motion (full)', r2.moved && r2.bobbed && r2.stopped && r2.stoppedF && r2.ringTurns, JSON.stringify(r2));
await pg.close(); await b.close();
