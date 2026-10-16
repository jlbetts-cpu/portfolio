/* Developmental Improvisation — home page behaviour. Vanilla, no dependencies. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { try { return sessionStorage.getItem(k); } catch { return null; } } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { try { sessionStorage.setItem(k, v); } catch {} } },
    sget(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    sset(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
  };
  const num = (cs, name, d) => { const v = parseFloat(cs.getPropertyValue(name)); return Number.isFinite(v) ? v : d; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* iOS Safari applies :active only inside something listening for touchstart, so without this every press on the
     page — the buttons' scale, the photographs' — never showed on an iPhone. Passive and empty: it changes nothing else. */
  document.addEventListener('touchstart', () => {}, { passive: true });

  /* ---- Light only (2026-10-13: "should we just do light mode … not dark mode?", then "Light only"). The page is light
     for everyone: data-di-theme="light" is written on the <html> element in the markup itself, so no script decides
     it and a host's own data-theme is never read. The dark token block in tokens.css is kept, unused. ---- */

  /* ---- The curtain: the first load of a session. It waits for the fonts and the hero's first photographs, then parts.
     Three things guarantee the site is never stuck behind it: a hard timeout, a floor on how long it can show, and
     the fact that the page underneath is already laid out and scrollable the moment the halves leave. ---- */
  const curtain = $('.curtain');
  if (curtain && root.classList.contains('curtaining')) {
    let opened = false;
    const open = () => {
      if (opened) return; opened = true;
      store.sset('di:curtain', '1');
      curtain.classList.add('is-open');
      setTimeout(() => { root.classList.remove('curtaining'); curtain.remove(); }, 1000);
    };
    // THE CURTAIN WAITS FOR THE TYPE, NOT THE PHOTOGRAPHS (2026-10-16). It waited on the About section's and the ring's
    // first four photographs, a screen and more below the fold, so on a phone over Lighthouse's slow 4G it held the whole
    // page until 2.27s for pictures nobody could see yet, and the claim painted at 2.36s; the font was there at 1.02s.
    // Every photograph fades in over its own placeholder as it arrives (v45), so there is nothing for the curtain to hide.
    const floor = new Promise(res => setTimeout(res, 620));
    Promise.all([document.fonts ? document.fonts.ready : Promise.resolve(), floor]).then(open);
    setTimeout(open, 2600);
  }

  /* ---- Nav: it leaves going down and comes back going up, and takes a ground only once there is something under it.
     The 6px threshold is what stops it flickering on a trackpad's noise; above the fold it always shows, and keyboard
     focus brings it back so it can never be reached while it is off screen. ---- */
  const nav = $('#nav');
  if (nav) {
    let last = scrollY, queued = false;
    const upd = () => {
      queued = false;
      const y = Math.max(0, scrollY), d = y - last;
      nav.classList.toggle('is-scrolled', y > 24);
      if (y < 120) { nav.classList.remove('is-hidden'); last = y; return; }
      if (Math.abs(d) < 6) return;              // under the threshold, keep `last` so a slow scroll still accumulates
      nav.classList.toggle('is-hidden', d > 0);
      last = y;
    };
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(upd); } }, { passive: true });
    nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));
    upd();
  }

  /* ---- The header shows where you are (2026-10-14) ----
     The section crossing a line 45% of the way down the screen names its link: either About section is About, the
     testimonials are Testimonials. The footer is too short ever to reach that line, so Contact is the footer whole on
     screen, which is the foot of the page. The hero, the strip, the ring and the sign-up name nothing. ---- */
  const navLinks = $$('.nav__links a, .sheet__links a');
  if (navLinks.length && 'IntersectionObserver' in window) {
    const ZONE = { about: '#about', founder: '#about', voices: '#voices' };
    let onLine = null, footWhole = false;
    const mark = () => {
      const at = footWhole ? '#contact' : onLine;
      navLinks.forEach(a => { if (a.getAttribute('href') === at) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    };
    const crossing = new Set();
    const line = new IntersectionObserver((entries) => {
      for (const en of entries) { if (en.isIntersecting) crossing.add(en.target); else crossing.delete(en.target); }
      const el = [...crossing][0];
      onLine = (el && ZONE[el.id]) || null;
      mark();
    }, { rootMargin: '-45% 0px -54% 0px' });
    $$('#top, #about, #founder, #quote, #voices, .close').forEach(el => line.observe(el));
    const foot = $('#contact');
    if (foot) new IntersectionObserver(([en]) => { footWhole = en.intersectionRatio > .95; mark(); }, { threshold: [0, .95, 1] }).observe(foot);
  }

  /* ---- The flow: one angle for everything that turns. A slow drift, plus what the visitor scrolls, eased. ----
     angle follows target with a time constant of --flow-settle, so a scroll accelerates the arch and it settles back to the drift. */
  const flow = (() => {
    let drift, perPx, settle;
    const readTokens = () => { const cs = getComputedStyle(root); drift = num(cs, '--flow-drift', 3.75); perPx = num(cs, '--flow-scroll', .09); settle = num(cs, '--flow-settle', .32); };
    readTokens();
    let target = 0, angle = 0, sTarget = 0, sAngle = 0, lastY = scrollY, lastT = 0, hold = 1, running = false;
    const holds = new Set();
    const listeners = new Set();
    const emit = () => { for (const fn of listeners) fn(angle, sAngle); };
    const frame = (t) => {
      const dt = lastT ? Math.min(.05, (t - lastT) / 1000) : 0; lastT = t;
      hold += ((holds.size ? 0 : 1) - hold) * (1 - Math.exp(-dt / .18));
      if (hold < .005) hold = 0; else if (hold > .995) hold = 1;
      target += drift * hold * dt;
      const k = 1 - Math.exp(-dt / settle);
      angle += (target - angle) * k; sAngle += (sTarget - sAngle) * k;
      emit();
      // idle only when it will stay still: with nothing holding it, a hold that has eased to 0 is about to grow again, and
      // calling that idle stopped the loop on the first frame after a long pause, for good (2026-10-16)
      const idle = Math.abs(target - angle) < .002 && Math.abs(sTarget - sAngle) < .002 && drift * (holds.size ? hold : 1) < .01;
      if (idle || document.hidden) { running = false; lastT = 0; return; }
      requestAnimationFrame(frame);
    };
    const wake = () => { if (running) return; running = true; lastT = 0; requestAnimationFrame(frame); };
    // the scroll feeds the flow only while the reel or the ring is on screen; otherwise the delta is dropped, so nothing whooshes on arrival
    // a keyboard's hold ('key:' + what has focus) stills the scroll's push too: Tab scrolls the page to what it focuses,
    // and that scroll carried the focused frame back off the screen (2026-10-16)
    // A JUMP IS NOT A SCROLL (2026-10-16). Tab, an anchor, find-in-page and Home move the page in one event of hundreds
    // of pixels, and each of them was pushing the strip and the ring as if it had been scrolled by hand: one 900px jump
    // spun the ring 81°, and a keyboard arriving at the ring watched it swing half a turn. A hand's scroll arrives a
    // frame at a time, well under 160px; past that, an event pushes no more than a brisk scroll would.
    const PUSH_MAX = 160;
    addEventListener('scroll', () => { const y = scrollY; const d = Math.max(-PUSH_MAX, Math.min(PUSH_MAX, y - lastY)) * perPx; lastY = y; if (holds.has('offscreen') || holds.has('paused') || [...holds].some(h => typeof h === 'string' && h.startsWith('key:'))) return; target += d; sTarget += d; wake(); }, { passive: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
    reduced.addEventListener('change', () => { readTokens(); wake(); });
    const stages = new Map();
    const stageIO = new IntersectionObserver((entries) => { for (const en of entries) stages.set(en.target, en.isIntersecting); const any = [...stages.values()].some(Boolean); if (any) holds.delete('offscreen'); else holds.add('offscreen'); wake(); }, { threshold: 0 });
    return {
      watch(el) { stages.set(el, true); stageIO.observe(el); },
      on(fn) { listeners.add(fn); fn(angle, sAngle); wake(); },
      hold(key, on) { if (on) holds.add(key); else holds.delete(key); wake(); },
      get angle() { return angle; },
      get settled() { return target + drift * hold * .18; },   // where the angle will come to rest if nothing else pushes it
      get scrollAngle() { return sAngle; },
      get held() { return holds.size > 0; },
      set(a) { angle = target = a; emit(); },   // test hook
      halt() { target = angle; sTarget = sAngle; },   // drop what is still to catch up, so a pause stops it now, not in a second and a half
      get holdKeys() { return [...holds].map(h => typeof h === 'string' ? h : (h.className || h.tagName)); },   // test hook
    };
  })();

  /* ---- The pause (2026-10-16): one control stills everything that moves by itself, and is remembered ----
     WCAG 2.2.2: the strip and the ring start by themselves and never end, beside the rest of the page, so a reader must
     be able to stop them. It holds the flow (which also stills the mark's sway), the scroll no longer pushes it, the
     glint stops where it is, and the choice is kept for the next visit. The strip still moves under a hand. */
  const pauser = $('[data-motion-toggle]');
  if (pauser) {
    const set = (paused, keep) => {
      root.classList.toggle('motion-paused', paused);
      if (paused) flow.halt();
      flow.hold('paused', paused);
      pauser.setAttribute('aria-label', paused ? 'Play motion' : 'Pause motion');
      if (keep) store.set('di:motion', paused ? 'paused' : 'moving');
    };
    set(store.get('di:motion') === 'paused', false);
    pauser.addEventListener('pointerdown', (e) => e.stopPropagation());   // the strip's own drag must not start under it
    // a phone has no hover: a touch anywhere on the strip shows the control for three seconds (capture, so a touch on the
    // control itself, which stops its own pointerdown, still keeps it up)
    const strip = pauser.closest('.reel');
    let shown = 0;
    if (strip) strip.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      strip.classList.add('is-touched'); clearTimeout(shown);
      shown = setTimeout(() => strip.classList.remove('is-touched'), 3000);
    }, true);
    pauser.addEventListener('click', (e) => { e.stopPropagation(); set(!root.classList.contains('motion-paused'), true); });
  }

  /* ---- Hero: first paint once per session ---- */
  const hero = $('#top');
  if (hero) {
    if (store.sget('di:arrived')) { hero.classList.add('is-ready'); }
    else {
      hero.classList.add('is-arriving');
      $$('.hero__head > *, .hero__figure', hero).forEach((el, i) => el.style.setProperty('--d', i));
      requestAnimationFrame(() => requestAnimationFrame(() => { hero.classList.add('is-ready'); store.sset('di:arrived', '1'); }));
    }
  }

  /* ---- Photographs resolve: each fades in over its own blurred placeholder once it has decoded (2026-10-14) ----
     A cached file is marked at once; a broken one is marked too, so nothing is left invisible. ---- */
  $$('.photo img').forEach((img) => {
    const done = () => img.classList.add('is-loaded');
    if (img.complete && img.naturalWidth) done();
    else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); }
  });

  // set while the viewer hands focus back to a photograph it was opened from by a pointer: that focus is the browser's
  // bookkeeping, not a keyboard arriving, so the strip and the ring do not hold for it (they did, after an Esc)
  let quietFocus = false;

  /* ---- The reel: one row of photographs between the hero and the first section, sliding on its own ----
     Three copies of one run; the loop length is the first run's width, so the translate wraps without a seam. The flow
     drives it and the pointer HOLDS it. Since 2026-10-14 it can also be moved by hand ("make it so you are able to
     horizonatal scroll on the film strip carousel if you want"): a sideways swipe on a trackpad (or shift and the wheel)
     and a drag, by mouse or by finger, move it one to one, and a drag let go with speed glides on at Apple's scroll
     deceleration (0.998 a millisecond) until it stops, then the drift takes it back. A VERTICAL wheel still scrolls the
     page and never the row, a finger moving up the strip scrolls the page (touch-action: pan-y), a drag never opens the
     lightbox, and a touch that stops a glide opens nothing either, as on a phone. ---- */
  const reel = $('[data-reel]');
  if (reel) {
    const track = $('.reel__track', reel), run = $('.reel__run', reel);
    let px = 11, len = 0, a = 0, by = 0;      // a: the flow's angle, by: how far the hand has moved it, in px
    const measure = () => { px = num(getComputedStyle(root), '--reel-px', 11); len = run.getBoundingClientRect().width; render(); };
    const render = () => {
      if (!len) return;
      const x = (((a * px + by) % len) + len) % len;
      track.style.transform = `translate3d(${(-x).toFixed(2)}px, 0, 0)`;
    };
    measure(); addEventListener('resize', measure); addEventListener('load', measure);
    flow.on((ang) => { a = ang; render(); });
    flow.watch(reel);
    reel.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') flow.hold(reel, true); });
    reel.addEventListener('pointerleave', () => flow.hold(reel, false));
    // no hold on a touch until it moves sideways: a scroll gesture that starts on the reel would freeze it. A tap opens
    // the lightbox, which holds the flow itself.

    // a sideways wheel. The axis is decided at the start of a gesture and kept until it pauses, as a browser does, so a
    // trackpad's cross-axis noise never flips a page scroll into a scrub or the other way round
    let axis = '', axisT = 0, wheelOff = 0;
    reel.addEventListener('wheel', (e) => {
      const t = e.timeStamp;
      if (t - axisT > 220) axis = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? 'x' : 'y';
      axisT = t;
      if (axis !== 'x') return;
      e.preventDefault();                       // also keeps a sideways swipe from turning into the browser's back
      stopGlide();
      by += e.deltaX * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerWidth : 1); render();
      flow.hold('reel-hand', true); clearTimeout(wheelOff);
      wheelOff = setTimeout(() => { if (!drag) flow.hold('reel-hand', false); }, 400);
    }, { passive: false });

    // a drag. It becomes one after 8px sideways; until then a press is a press, and a tap still opens the photograph
    let drag = null, glide = 0, gv = 0, eat = false;
    const stopGlide = () => { if (!glide) return; cancelAnimationFrame(glide); glide = 0; };
    reel.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      eat = !!glide && Math.abs(gv) > .15;       // a touch that catches a glide stops it and opens nothing; at a crawl it is a tap
      stopGlide();
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, on: false, s: [[e.timeStamp, e.clientX]] };
      if (eat) flow.hold('reel-hand', true);
    });
    reel.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.on) {
        const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
        drag.on = true; drag.x = e.clientX; eat = true;
        try { reel.setPointerCapture(e.pointerId); } catch {}
        reel.classList.add('is-dragging'); flow.hold('reel-hand', true);
      }
      by -= e.clientX - drag.x; drag.x = e.clientX; render();
      drag.s.push([e.timeStamp, e.clientX]);
      while (drag.s.length > 2 && e.timeStamp - drag.s[0][0] > 100) drag.s.shift();
    });
    const release = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      reel.classList.remove('is-dragging');
      if (!d.on) { if (!glide) flow.hold('reel-hand', false); return; }
      // the speed of the last tenth of a second, in px a millisecond; a finger that stopped before letting go throws nothing
      const [t0, x0] = d.s[0], [t1, x1] = d.s[d.s.length - 1];
      let v = e.type === 'pointerup' && e.timeStamp - t1 < 60 && t1 > t0 ? (x1 - x0) / (t1 - t0) : 0;
      if (Math.abs(v) < .05) { flow.hold('reel-hand', false); return; }
      let last = 0;
      const step = (t) => {
        const dt = last ? Math.min(50, t - last) : 16; last = t;
        v *= Math.pow(.998, dt); gv = v; by -= v * dt; render();
        if (Math.abs(v) < .02) { glide = 0; flow.hold('reel-hand', false); return; }
        glide = requestAnimationFrame(step);
      };
      glide = requestAnimationFrame(step);
    };
    reel.addEventListener('pointerup', release);
    reel.addEventListener('pointercancel', release);
    // the click that ends a drag (or catches a glide) is eaten before it reaches the photograph's button
    reel.addEventListener('click', (e) => { if (eat && e.detail && e.target.closest('.photo__open')) { eat = false; e.stopPropagation(); e.preventDefault(); } }, true);   // a photograph's click only, never a key's (detail 0) nor the pause control's
    reel.addEventListener('dragstart', (e) => e.preventDefault());
    /* THE KEYBOARD (2026-10-16). The strip was fifteen tab stops, and a frame could take focus off the screen (one at
       x -152) while the strip drifted on under it. Now it is one stop, as the ARIA carousel pattern has it: Tab lands on
       the frame most on screen, the arrow keys move along it (Home and End to its ends), the strip stands still while a
       key has it, and a frame given focus slides fully onto the screen first, 16px in from the edge (WCAG 2.4.11, focus
       not obscured). Only a keyboard's focus counts: a click's, or the focus the viewer hands back when it closes,
       neither holds nor slides. The frames are the first run's; the copies never take focus. */
    const frames = $$('.photo__open', run);
    const setRove = (i) => frames.forEach((f, k) => { f.tabIndex = k === i ? 0 : -1; });
    setRove(0);
    const onScreen = (el) => { const r = el.getBoundingClientRect(); return Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)); };
    let slideRaf = 0;
    const bring = (i) => {
      const item = frames[i].closest('.reel__item'), w = item.offsetWidth;
      const p = item.getBoundingClientRect().left - run.getBoundingClientRect().left;
      // planned against where the strip will come to rest, not where it is while the hold eases it to a stop
      const x = (((flow.settled * px + by) % len) + len) % len, m = 16, W = document.documentElement.clientWidth;
      let xn = x;
      if (p - x < m) xn = p - m; else if (p + w - x > W - m) xn = p + w - (W - m);
      // the first frame of the run can come no further right than the screen's edge; a pixel inside the loop, because
      // aimed at exactly 0 the last of the settle dipped below it and the wrap sent the frame a whole loop away
      xn = Math.min(len - 2, Math.max(2, xn));
      const d = xn - x;
      if (Math.abs(d) < .5) return;
      stopGlide(); cancelAnimationFrame(slideRaf);
      if (reduced.matches) { by += d; render(); return; }
      // a frame's step at the motion ladder's move, a long way (Home, End) a little longer, so it reads as travel, not a cut
      const by0 = by, t0 = performance.now(), ms = Math.min(560, num(getComputedStyle(root), '--dur-move', 280) * (1 + Math.abs(d) / W / 2));
      const tick = (t) => { const k = Math.min(1, (t - t0) / ms); by = by0 + d * (1 - Math.pow(1 - k, 3)); render(); if (k < 1) slideRaf = requestAnimationFrame(tick); };
      slideRaf = requestAnimationFrame(tick);
    };
    reel.addEventListener('focusin', (e) => {
      const i = frames.indexOf(e.target);
      if (i < 0 || !e.target.matches(':focus-visible')) return;
      if (quietFocus) { setRove(i); return; }   // Tab carries on from here, but nothing holds or slides
      reel.scrollLeft = 0;   // a browser may scroll even an overflow:hidden box to show what took focus; the transform does that here
      flow.hold('key:reel', true);
      if (!frames.includes(e.relatedTarget)) {   // arriving from outside the frames: the one most on screen, not the first in the list
        let best = i, most = onScreen(frames[i]);
        frames.forEach((f, k) => { const s = onScreen(f); if (s > most + 1) { best = k; most = s; } });
        if (best !== i) { setRove(best); frames[best].focus({ preventScroll: true }); return; }
      }
      setRove(i); bring(i);
    });
    // the hold belongs to the frames: focus moving on to the pause control, inside the strip, lets it go too
    reel.addEventListener('focusout', (e) => { if (!frames.includes(e.relatedTarget)) flow.hold('key:reel', false); });
    reel.addEventListener('keydown', (e) => {
      const i = frames.indexOf(document.activeElement);
      if (i < 0) return;
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: frames.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      const j = Math.max(0, Math.min(frames.length - 1, to));
      if (j !== i) { setRove(j); frames[j].focus({ preventScroll: true }); }
    });
    window.__di_reel = { get by() { return by; }, get len() { return len; }, get px() { return px; } };   // test hook
  }

  /* ---- The mark: black, with the palette sweeping over it, and it turns to face the pointer ----
     Anywhere on the page, not only over the mark: the offset from the mark's centre, as a fraction of the room
     between the mark and that edge of the window, is the angle. It eases toward that with a short time constant, so it follows like something with a
     little weight rather than snapping to the cursor. A flat mark turned far enough shows its edge, so it is held
     to ±30° across and ±20° up and down. With no hovering pointer it sways slowly on the flow instead, so a phone
     still sees an object rather than a picture of one. The glint's offset is tied to the same angles. ---- */
  const mark = $('[data-mark]');
  if (mark && !reduced.matches) {
    const MAX_Y = 30, MAX_X = 20, TAU = .2;
    const hover = matchMedia('(hover: hover) and (pointer: fine)');
    let ry = 0, rx = 0, ty = 0, tx = 0, raf = 0, last = 0, box = null;
    const paint = () => {
      mark.style.setProperty('--ry', ry.toFixed(2) + 'deg');
      mark.style.setProperty('--rx', rx.toFixed(2) + 'deg');
      // the rect is twice the mark's width and carries two bands, so a sweep of one mark-width covers every state
      // the glint rides the turn: tilting the mark slides the light across it, up to ±120 user units
      mark.style.setProperty('--glare', (ry * 4 - rx * 2).toFixed(1));
    };
    const tick = (t) => {
      const dt = Math.min(.05, (t - last) / 1000 || .016); last = t;
      const k = 1 - Math.exp(-dt / TAU);
      ry += (ty - ry) * k; rx += (tx - rx) * k;
      paint();
      if (Math.abs(ty - ry) < .02 && Math.abs(tx - rx) < .02) { raf = 0; return; }
      raf = requestAnimationFrame(tick);
    };
    const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    const place = () => { const r = mark.getBoundingClientRect(); box = [r.left + r.width / 2 + scrollX, r.top + r.height / 2 + scrollY]; };
    place(); addEventListener('resize', place); addEventListener('load', place);
    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      // each side is normalised by the room on that side, so the edge of the window is the full turn in every
      // direction — the mark sits high in the viewport, and halving the height made "up" a third of "down"
      const cx = box[0] - scrollX, cy = box[1] - scrollY, dx = e.clientX - cx, dy = e.clientY - cy;
      ty = clamp(dx / Math.max(1, dx < 0 ? cx : innerWidth - cx), -1, 1) * MAX_Y;
      tx = -clamp(dy / Math.max(1, dy < 0 ? cy : innerHeight - cy), -1, 1) * MAX_X;
      wake();
    }, { passive: true });
    // the pointer leaving the window is the pointer going away: the mark comes back to face the visitor
    document.documentElement.addEventListener('mouseleave', () => { ty = 0; tx = 0; wake(); });
    flow.on((a) => {
      if (!hover.matches) { ty = Math.sin(a * Math.PI / 45) * MAX_Y * .5; tx = 0; wake(); }   // one sway every 24s at rest
      else if (!raf) paint();
    });
    paint();
  }

  /* ---- The quote ring: shaped photographs on a circle, upright, turning with the flow ---- */
  $$('.ring__orbit').forEach(orbit => {
    const items = $$('.ring__item', orbit);
    const stage = orbit.closest('.ring__stage');
    let r = 300, n = items.length;
    // the radius CSS drew: the stage is two radii plus one circle tall (see .ring__stage), so it is read back, not re-derived
    const read = () => { const h = stage ? stage.getBoundingClientRect().height : 0, it = items[0] ? items[0].offsetWidth : 0; r = h && it ? (h - it) / 2 : num(getComputedStyle(root), '--ring-r', 300); render(flow.angle); };
    const render = (a) => {
      for (let i = 0; i < items.length; i++) {
        const t = (a + i * 360 / n) * Math.PI / 180;
        items[i].style.transform = `translate3d(${(r * Math.sin(t)).toFixed(2)}px, ${(-r * Math.cos(t)).toFixed(2)}px, 0)`;
      }
    };
    read(); addEventListener('resize', read);
    flow.on(render);
    orbit.addEventListener('pointerover', (e) => { if (e.target.closest('.photo')) flow.hold(orbit, true); });
    orbit.addEventListener('pointerout', (e) => { if (e.target.closest('.photo') && !(e.relatedTarget && e.relatedTarget.closest('.photo') && orbit.contains(e.relatedTarget))) flow.hold(orbit, false); });
    let touchTimer;
    orbit.addEventListener('touchstart', (e) => { if (!e.target.closest('.photo')) return; flow.hold(orbit, true); clearTimeout(touchTimer); touchTimer = setTimeout(() => flow.hold(orbit, false), 4000); }, { passive: true });
    // a keyboard's focus holds it too (2026-10-16): a photograph that has focus does not travel on under it
    orbit.addEventListener('focusin', (e) => { if (e.target.matches(':focus-visible') && !quietFocus) flow.hold('key:ring', true); });
    orbit.addEventListener('focusout', (e) => { if (!orbit.contains(e.relatedTarget)) flow.hold('key:ring', false); });
    flow.watch(orbit.closest('.ring') || orbit);
  });
  /* ---- Lightbox: every photograph opens large; arrows and keys move through all of them in page order ---- */
  const lb = $('#lightbox');
  const lbData = (() => { try { return JSON.parse($('#lbData').textContent); } catch { return null; } })();
  if (lb && lbData) {
    const buttons = $$('[data-photo]');
    const names = [...new Set(buttons.filter(b => !b.closest('[aria-hidden="true"]')).map(b => b.dataset.photo))];
    const figure = $('.lightbox__figure', lb);
    const live = $('.lightbox__live', lb);
    const stage = $('.lightbox__stage', lb), rail = $('.lightbox__rail', lb);
    let index = 0, opener = null, thumbs = [], openedByKey = false;
    const current = () => $('picture.is-current', figure);
    /* THE ROW OF PREVIEWS, Apple Photos' scrubber (2026-10-14). Built the first time the viewer opens: one button per
       photograph, its 160px file at the page's own crop point. Only the current one takes a tab stop; the arrow keys
       move along the row from there. Its centre is worked out from the row's final geometry rather than read while the
       previews are still opening out, so the scroll and the widening arrive together. */
    const buildRail = () => {
      if (thumbs.length) return;
      rail.innerHTML = names.map((n, i) => { const d = lbData[n]; return `<button class="lightbox__thumb" type="button" tabindex="-1" style="--w:${Math.max(44, Math.round(55 * d.w / d.h))}px;--pos:${d.pos}" aria-label="Photograph ${i + 1} of ${names.length}"><picture><source type="image/avif" srcset="${d.t[0]}"><img src="${d.t[1]}" alt="" decoding="async"></picture></button>`; }).join('');
      thumbs = $$('.lightbox__thumb', rail);
      thumbs.forEach((t, i) => t.addEventListener('click', () => { if (i !== index) show(i, i > index ? 1 : -1); }));
    };
    // a mouse's wheel turns the row too: a row that only a trackpad or shift could move would be half a control
    rail.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); rail.scrollLeft += e.deltaY; } }, { passive: false });
    const centreRail = (smooth) => {
      const t = thumbs[index]; if (!t) return;
      const pad = parseFloat(getComputedStyle(rail).paddingLeft), w = parseFloat(t.style.getPropertyValue('--w'));
      const mid = pad + index * (44 + 2) + 6 + w / 2;
      rail.scrollTo({ left: mid - rail.clientWidth / 2, behavior: smooth && !reduced.matches ? 'smooth' : 'instant' });
    };
    // the photograph's box from its own proportions, so it has its size before the file arrives and the preview can
    // stand in for it, drawn large, without anything moving when the photograph lands
    const fit = (img, d) => {
      const cs = getComputedStyle(stage), W = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), H = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const k = Math.min(W / d.w, H / d.h, 1440 / d.w);
      img.style.width = Math.round(d.w * k) + 'px'; img.style.height = Math.round(d.h * k) + 'px';
    };
    addEventListener('resize', () => { const pic = current(); if (lb.open && pic) fit($('img', pic), lbData[names[index]]); });
    // dir: 1 forward, -1 back, 0 no movement (the first photograph, or a jump with nothing to give way). from: where a
    // finger let go of the old one, so it carries on from there rather than starting again from the middle
    // one photograph's picture, sized from its own proportions and with its preview drawn large under it until it arrives
    const build = (i) => {
      const d = lbData[names[(i + names.length) % names.length]];
      const av = d.avif.map(([w, u]) => `${u} ${w}w`).join(', '), wp = d.webp.map(([w, u]) => `${u} ${w}w`).join(', ');
      const pic = document.createElement('picture');
      pic.innerHTML = `<source type="image/avif" srcset="${av}" sizes="90vw"><source type="image/webp" srcset="${wp}" sizes="90vw"><img src="${d.jpeg}" width="${d.w}" height="${d.h}" alt="${d.alt}" decoding="async">`;
      const img = $('img', pic);
      fit(img, d);
      img.style.backgroundImage = `url(${d.t[1]})`;
      img.addEventListener('load', () => { img.style.backgroundImage = ''; }, { once: true });
      return pic;
    };
    // everything else that follows the photograph showing: the row, its focus, the live line, the neighbours warmed
    const mark = () => {
      const d = lbData[names[index]];
      thumbs.forEach((t, k) => { if (k === index) { t.setAttribute('aria-current', 'true'); t.tabIndex = 0; } else { t.removeAttribute('aria-current'); t.tabIndex = -1; } });
      if (lb.open) { centreRail(true); if (rail.contains(document.activeElement)) thumbs[index].focus({ preventScroll: true }); }
      live.textContent = `Photograph ${index + 1} of ${names.length}. ${d.alt}`;
      for (const k of [index + 1, index - 1]) { const n = lbData[names[(k + names.length) % names.length]]; const im = new Image(); im.src = n.webp[n.webp.length - 1][1]; }
    };
    const show = (i, dir = 0) => {
      land();
      index = (i + names.length) % names.length;
      const pic = build(index);
      pic.className = 'is-current';
      const old = current();
      figure.appendChild(pic);
      if (old) {
        old.classList.remove('is-current');
        if (lb.open && dir && !reduced.matches) {
          // the old one carries on the way it was going and fades; the new one comes in after it, a short way, on the same ease
          const dx = dir * Math.min(64, stage.clientWidth * .06), ms = num(getComputedStyle(root), '--dur-move', 280);
          old.animate([{ transform: 'none', opacity: 1 }, { transform: `translateX(${-dx}px)`, opacity: 0 }], { duration: ms, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }).finished.then(() => old.remove(), () => old.remove());
          pic.animate([{ transform: `translateX(${dx}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: ms, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
        } else old.remove();
      }
      mark();
    };
    /* THE PHOTOGRAPH OPENS OUT OF ITS FRAME (2026-10-14, his pick): it grows from exactly where it sat on the page into
       the viewer, un-cropping as it goes, and closes back into the frame of whatever photograph is showing, if that
       frame is on screen. A view transition with one shared name: the page's crop is hidden at once and the large
       image is drawn covering a box that travels from the frame to its own size, so there is never a double image;
       the box's corner travels too, from the frame's (2px in the strip, 20 in a section, a circle in the ring) to the
       viewer's. Without view transitions, or under reduced motion, it opens and closes as it always did. */
    const VT = 'lb-photo';
    const canMorph = () => 'startViewTransition' in document && !reduced.matches;
    let morphing = false, closeAfter = false;
    const onScreen = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
    // the frame to close into: the one that opened it if it shows this photograph, else this photograph's frame on screen, a real one before a copy in the strip
    const frameFor = (name) => (opener && opener.dataset.photo === name && onScreen(opener) ? opener : null)
      || buttons.filter(b => b.dataset.photo === name && onScreen(b)).sort((p, q) => !!p.closest('[aria-hidden="true"]') - !!q.closest('[aria-hidden="true"]'))[0] || null;
    const cornerOf = (btn) => { const ph = btn.closest('.photo') || btn, r = ph.getBoundingClientRect(), c = getComputedStyle(ph).borderTopLeftRadius; return c.endsWith('%') ? Math.min(r.width, r.height) * parseFloat(c) / 100 : parseFloat(c) || 0; };
    const morph = (from, to, closing, change) => {
      morphing = true;
      const cs = getComputedStyle(root), dur = num(cs, closing ? '--dur-reveal' : '--dur-enter', closing ? 360 : 500);
      root.style.setProperty('--lb-dur', dur + 'ms');
      root.style.setProperty('--lb-pos', getComputedStyle(closing ? to.img : from.img).objectPosition);
      root.classList.toggle('lb-closing', closing);
      lb.classList.add('is-morphing');
      from.img.style.viewTransitionName = VT;
      const vt = document.startViewTransition(() => { from.img.style.viewTransitionName = ''; change(); to.img.style.viewTransitionName = VT; });
      vt.ready.then(() => root.animate({ borderRadius: [from.corner + 'px', to.corner + 'px'] }, { duration: dur, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both', pseudoElement: `::view-transition-group(${VT})` })).catch(() => {});
      vt.finished.finally(() => { to.img.style.viewTransitionName = ''; lb.classList.remove('is-morphing'); root.classList.remove('lb-closing'); morphing = false; if (closeAfter) { closeAfter = false; close(); } });
    };
    const big = () => $('picture.is-current img', figure);
    const bigCorner = () => parseFloat(getComputedStyle(big()).borderTopLeftRadius) || 0;
    const settle = () => { fit(big(), lbData[names[index]]); centreRail(false); $('.lightbox__close', lb).focus({ preventScroll: true }); flow.hold('lightbox', true); };
    const open = async (name, from) => {
      if (morphing || lb.open) return;
      opener = from; buildRail(); show(Math.max(0, names.indexOf(name)));
      const img = from && $('img', from);
      if (!canMorph() || !img) { lb.showModal(); settle(); return; }
      morphing = true;
      // the large file is decoded before the frame starts to grow, or the first frames would grow its placeholder
      try { await Promise.race([big().decode(), new Promise(r => setTimeout(r, 400))]); } catch {}
      morph({ img, corner: cornerOf(from) }, { img: big(), corner: bigCorner() }, false, () => { lb.showModal(); settle(); });
    };
    // a modal dialog hands focus back to what opened it inside close() itself, before its close event, so the flag that
    // keeps that hand-back quiet goes up around the call
    const shut = () => { quietFocus = !openedByKey; lb.close(); quietFocus = false; };
    // a click while it opens lands on the transition, not the page, and is dropped (a double-click must not open and
    // shut it); Esc is kept, and closes it the moment it has opened
    const close = () => {
      if (morphing) { closeAfter = lb.open || closeAfter; return; }
      if (!lb.open) return;
      const to = canMorph() && big() && frameFor(names[index]);
      const img = to && $('img', to);
      if (!img) { unempty(); shut(); return; }
      morph({ img: big(), corner: bigCorner() }, { img, corner: cornerOf(to) }, true, () => { unempty(); shut(); });
    };
    buttons.forEach(b => b.addEventListener('click', (e) => { openedByKey = e.detail === 0; open(b.dataset.photo, b); }));   // detail 0: Enter or Space
    $('.lightbox__prev', lb).addEventListener('click', () => step(-1));
    $('.lightbox__next', lb).addEventListener('click', () => step(1));
    $('.lightbox__close', lb).addEventListener('click', close);
    // Esc. Without a view transition the browser closes it after this, so the flag stays up until the close event
    lb.addEventListener('cancel', (e) => { if (canMorph()) { e.preventDefault(); close(); } else quietFocus = !openedByKey; });
    lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lightbox__stage')) close(); });
    lb.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); step(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); } });
    lb.addEventListener('close', () => { unempty(); lb.style.removeProperty('--dismiss'); const p = current(); if (p) p.style.transform = ''; flow.hold('lightbox', false); if (opener && opener.isConnected) { quietFocus = !openedByKey; opener.focus({ preventScroll: true }); } quietFocus = false; });
    /* A FINGER PAGES THROUGH THEM, as in Photos, and to the three rules of docs/apple-design.md that a gesture lives by.
       Once it has gone 8px sideways the photograph follows it one to one and the next one rides in beside it, 24px apart.
       Let go, and where it goes is decided by where the throw would land (§6: the finger's speed carried on at Apple's
       scroll deceleration, 0.998 a millisecond), not by how far it was dragged: past the middle, the pair carries on to
       the next; short of it, both go back. The settle leaves at the finger's own speed (§5): the ease-out's first frame
       moves at 1/0.22 of its average, so its length is chosen to match. And a touch while they are still moving catches
       them where they are (§3, never lock out input): whichever of the two is nearer home becomes the one showing, and
       the finger carries on from there. A swipe never closes the viewer, though it ends on the scrim (the click it
       leaves is eaten), and neither does a catch. */
    const GAP = 24, DECEL = .998;
    /* PULL DOWN TO CLOSE, as in Photos (2026-10-16). Drawn down, the photograph follows the finger (half as much sideways),
       shrinking a little, and the stage, the row of previews and the controls fade with it (--dismiss, 0 to 1 over 60% of
       the stage's height); drawn up, it resists. Let go, and where the throw would land decides (§6): past 30% of the
       stage it closes, flying back into its frame on the page from where the finger left it, since the view transition
       captures it there; short of that, it springs back. */
    // its own frame on the page is emptied while it is pulled, as Photos empties the slot, so the photograph is never
    // seen twice (the page shows through the fading stage); the frame comes back as it lands or springs back
    let emptied = null;
    const unempty = () => { if (emptied) { emptied.style.visibility = ''; emptied = null; } };
    const pull = (mx, dy) => {
      if (!emptied) { const f = frameFor(names[index]), ph = f && (f.closest('.photo') || f); if (ph) { ph.style.visibility = 'hidden'; emptied = ph; } }   // the whole frame, its blurred placeholder too
      const H = stage.clientHeight, y = dy < 0 ? dy * .25 : dy, k = Math.min(1, Math.max(0, y) / (H * .6));
      current().style.transform = `translate(${(mx * .5).toFixed(1)}px, ${y.toFixed(1)}px) scale(${(1 - .3 * k).toFixed(3)})`;
      lb.style.setProperty('--dismiss', k.toFixed(3));
      sw.dy = y;
    };
    let dismissRaf = 0;
    const release = (g, e) => {
      const [t0, , y0] = g.s[0], [t1, , y1] = g.s[g.s.length - 1];
      const vy = t1 > t0 && e.timeStamp - t1 < 60 ? (y1 - y0) / (t1 - t0) : 0;
      const landing = (g.dy || 0) + vy * DECEL / (1 - DECEL);
      if (landing > stage.clientHeight * .3 && vy > -.1) { close(); return; }   // close() fills the frame again as it lands
      unempty();
      // back: the photograph on the page's spring, the stage brought up again over the same time
      const pic = current(), from = pic.style.transform, k0 = parseFloat(lb.style.getPropertyValue('--dismiss')) || 0;
      const ms = num(getComputedStyle(root), '--dur-move', 280), t = performance.now();
      pic.style.transform = '';
      pic.animate([{ transform: from || 'none' }, { transform: 'none' }], { duration: ms, easing: getComputedStyle(root).getPropertyValue('--ease-pop').trim() || 'ease-out' });
      cancelAnimationFrame(dismissRaf);
      const tick = (now) => { const k = Math.min(1, (now - t) / ms); lb.style.setProperty('--dismiss', (k0 * Math.pow(1 - k, 3)).toFixed(3)); if (k < 1) dismissRaf = requestAnimationFrame(tick); else lb.style.removeProperty('--dismiss'); };
      dismissRaf = requestAnimationFrame(tick);
    };
    let sw = null, eatClick = false, flight = null;
    const place = (el, x) => { el.style.transform = x ? `translateX(${x}px)` : ''; };
    const liveX = (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41;
    stage.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' || morphing || sw || !current()) return;
      let base = 0, peek = null, side = 0;
      const caught = !!flight;
      if (flight) {
        const f = flight; flight = null;
        const px = liveX(f.pic), kx = liveX(f.peek);
        f.pic.getAnimations().forEach(a => a.cancel()); f.peek.getAnimations().forEach(a => a.cancel());
        if (Math.abs(kx) < Math.abs(px)) {   // the incoming one is nearer home, so it is the one showing now
          f.pic.classList.remove('is-current'); f.peek.className = 'is-current';
          index = (index + f.side + names.length) % names.length; mark();
          base = kx; peek = f.pic; side = -f.side;
        } else { base = px; peek = f.peek; side = f.side; }
        place(current(), base); place(peek, base + side * (stage.clientWidth + GAP));
      }
      sw = { id: e.pointerId, x0: e.clientX, y0: e.clientY, base, dx: base, on: caught, down: false, side, peek, s: [[e.timeStamp, e.clientX, e.clientY]] };
      eatClick = caught;
      if (caught) try { stage.setPointerCapture(e.pointerId); } catch {}
    });
    stage.addEventListener('pointermove', (e) => {
      if (!sw || e.pointerId !== sw.id) return;
      const mx = e.clientX - sw.x0, dy = e.clientY - sw.y0;
      if (!sw.on) {
        // the first 8px decide it: sideways pages, downwards dismisses (as Photos'), anything else is left alone
        if (Math.abs(mx) >= 8 && Math.abs(mx) >= Math.abs(dy)) sw.on = true;
        else if (dy >= 8 && dy > Math.abs(mx)) { sw.on = true; sw.down = true; }
        else return;
        eatClick = true; try { stage.setPointerCapture(e.pointerId); } catch {}
      }
      if (sw.down) { pull(mx, dy); sw.s.push([e.timeStamp, e.clientX, e.clientY]); while (sw.s.length > 2 && e.timeStamp - sw.s[0][0] > 100) sw.s.shift(); return; }
      const dx = sw.base + mx;
      // the neighbour on the side the finger is uncovering: the next one when it moves left, the one before when right
      const side = dx < 0 ? 1 : -1;
      if (side !== sw.side) { if (sw.peek) sw.peek.remove(); sw.peek = build(index + side); figure.appendChild(sw.peek); sw.side = side; }
      sw.dx = dx; place(current(), dx); place(sw.peek, dx + side * (stage.clientWidth + GAP));
      sw.s.push([e.timeStamp, e.clientX, e.clientY]); while (sw.s.length > 2 && e.timeStamp - sw.s[0][0] > 100) sw.s.shift();
    });
    const letGo = (e) => {
      if (!sw || e.pointerId !== sw.id) return;
      const g = sw; sw = null;
      if (g.on && g.down) { release(g, e); return; }
      if (!g.on || !g.peek) return;
      // the speed of the last tenth of a second; a finger that stopped before letting go throws nothing
      const [t0, x0] = g.s[0], [t1, x1] = g.s[g.s.length - 1], v = t1 > t0 && e.timeStamp - t1 < 60 ? (x1 - x0) / (t1 - t0) : 0;
      const pic = current(), peek = g.peek, W = stage.clientWidth + GAP;
      const landing = g.dx + v * DECEL / (1 - DECEL);
      const go = Math.abs(landing) > stage.clientWidth / 2 && Math.sign(landing) === -g.side;
      const to = go ? -g.side * W : 0;   // where the one that was showing ends: off the far side, or home
      const dist = Math.abs(to - g.dx), toward = Math.sign(v) === Math.sign(to - g.dx) && Math.abs(v) > .05;
      const ms = !dist ? 1 : toward ? Math.min(420, Math.max(180, dist / (.22 * Math.abs(v)))) : num(getComputedStyle(root), '--dur-move', 280);
      const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
      place(pic, 0); place(peek, 0);
      pic.animate([{ transform: `translateX(${g.dx}px)` }, { transform: `translateX(${to}px)` }], { duration: ms, easing: ease, fill: 'forwards' });
      const a = peek.animate([{ transform: `translateX(${g.dx + g.side * W}px)` }, { transform: `translateX(${to + g.side * W}px)` }], { duration: ms, easing: ease, fill: 'forwards' });
      const f = flight = { pic, peek, side: g.side, go, ms };
      const done = f.done = () => {
        if (flight !== f) return;   // caught by a finger on the way, which has taken them over
        flight = null;
        if (go) { pic.remove(); peek.getAnimations().forEach(x => x.cancel()); peek.className = 'is-current'; index = (index + g.side + names.length) % names.length; mark(); }
        else { peek.remove(); pic.getAnimations().forEach(x => x.cancel()); }
      };
      a.finished.then(done, done);
    };
    stage.addEventListener('pointerup', letGo);
    stage.addEventListener('pointercancel', letGo);
    // the keys, the arrows and the row land any page still in flight before they move on
    // synchronously, so the index they step from is the one that landed
    const land = () => { if (flight) flight.done(); };
    const step = (d) => { land(); show(index + d, d); };
    lb.addEventListener('click', (e) => { if (eatClick) { eatClick = false; e.stopPropagation(); } }, true);
  }

  /* ---- Reveal on scroll, once ----
     ONCE means the class comes off. `.js .reveal` declares `transition: opacity/transform var(--dur-reveal)` plus the
     stagger's transition-delay, and it outranks a component's own rule — so every card kept the arrival's timing for
     the rest of the session: the fourth card's hover lifted over 360ms after a 180ms delay, and its hue, which the
     reveal's shorthand does not list, never faded at all. The arrival is over the moment it lands; the element gets
     its own motion back. */
  const settle = (el) => {
    const cs = getComputedStyle(el);
    const ms = (v) => (parseFloat(v) || 0) * (/ms/.test(v) ? 1 : 1000);
    setTimeout(() => { el.classList.remove('reveal'); el.style.removeProperty('--d'); }, ms(cs.transitionDuration) + ms(cs.transitionDelay) + 60);
  };
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); if (en.target.classList.contains('reveal')) settle(en.target); }
  }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });
  $$('.reveal, .reveal--parts').forEach(el => io.observe(el));
  $$('.reveal--stagger').forEach(p => $$(':scope > .reveal', p).forEach((c, i) => c.style.setProperty('--d', Math.min(i, 6))));
  // the ring assembles: each photograph a beat after the last, going round
  $$('.ring__orbit .ring__item').forEach((el, i) => { const ph = $('.photo', el); if (ph) ph.style.setProperty('--d', i); });


  /* ---- Menu sheet (mobile) ---- */
  const sheet = $('#menuSheet');
  const menuBtn = $('[data-open-menu]');
  if (sheet && menuBtn) {
    const open = () => { sheet.showModal(); menuBtn.setAttribute('aria-expanded', 'true'); menuBtn.setAttribute('aria-label', 'Close menu'); };
    const close = () => { sheet.close(); };
    menuBtn.addEventListener('click', () => sheet.open ? close() : open());
    $('[data-close-menu]', sheet).addEventListener('click', close);
    sheet.addEventListener('close', () => { menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.setAttribute('aria-label', 'Menu'); });
    sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
    $$('a', sheet).forEach(a => a.addEventListener('click', close));
  }

  /* ---- Newsletter dialog ---- */
  /* ---- The newsletter dialog: it opens when a visitor asks for it, from a Subscribe button, and never by itself ----
     Until 2026-10-14 it also opened on its own after 40% of the page and ten seconds. Asked for "simple elegant
     things", the research behind the recommendation found Nielsen Norman Group ranking modal popups the most disliked
     kind and the closing section already asking; he picked dropping it. With it went the stored dismissal, which
     existed only to keep the automatic one from coming back, and the non-modal phone sheet it opened as. ---- */
  const dialog = $('#newsletterDialog');
  const KEY = 'di:newsletter';
  const openDialog = () => {
    if (!dialog || dialog.open) return;
    dialog.showModal();
    $('h2', dialog).focus({ preventScroll: true });
  };
  if (dialog) {
    $$('[data-open-dialog]').forEach(b => b.addEventListener('click', openDialog));
    $('.dialog__close', dialog).addEventListener('click', () => dialog.close('dismiss'));
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close('dismiss'); });
  }

  /* ---- Newsletter forms (dialog + inline): one handler ---- */
  $$('form[data-newsletter]').forEach(form => {
    const btn = $('button[type="submit"]', form);
    const msg = $('.field__message', form);
    const field = $('.field', form);
    const label = btn.textContent;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = $('input[type="email"]', form);
      field.classList.remove('is-error'); msg.textContent = ''; msg.dataset.state = '';
      if (!input.checkValidity()) { field.classList.add('is-error'); msg.textContent = 'Please enter an email address.'; msg.dataset.state = 'error'; input.focus(); return; }
      btn.setAttribute('aria-busy', 'true');
      try {
        const action = form.getAttribute('action');
        if (!action || action.startsWith('[')) { await new Promise(r => setTimeout(r, 600)); }
        else {
          const res = await fetch(action, { method: 'POST', body: new FormData(form), mode: 'no-cors' });
          if (res.type !== 'opaque' && !res.ok) throw new Error('bad status');
        }
        btn.removeAttribute('aria-busy');
        btn.classList.add('is-done');
        btn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>Subscribed';
        btn.disabled = true;
        store.set(KEY, 'subscribed');
        if (dialog && dialog.open && form.closest('dialog')) setTimeout(() => dialog.close('subscribed'), 1200);
      } catch {
        btn.removeAttribute('aria-busy'); btn.textContent = label;
        field.classList.add('is-error'); msg.textContent = 'That did not go through. Please try again.'; msg.dataset.state = 'error';
      }
    });
  });

  window.__di = { flow, lightbox: lb, reel: window.__di_reel };   // hooks for tools/gates
  delete window.__di_reel;
})();
