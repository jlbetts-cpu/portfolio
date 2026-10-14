/* Developmental Improvisation — home page behaviour. Vanilla, no dependencies. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 767px)');
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
    // the curtain waits on the first photographs the page will actually show — the bento it used to watch is gone
    const shot = $$('.tell__figure img, .ring__item img').slice(0, 4);
    const loaded = new Promise(res => {
      let n = shot.filter(i => !i.complete).length;
      if (!n) return res();
      shot.forEach(i => { if (!i.complete) i.addEventListener('load', () => { if (!--n) res(); }, { once: true }); });
      setTimeout(res, 1600);
    });
    const floor = new Promise(res => setTimeout(res, 620));
    Promise.all([document.fonts ? document.fonts.ready : Promise.resolve(), loaded, floor]).then(open);
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
      const idle = Math.abs(target - angle) < .002 && Math.abs(sTarget - sAngle) < .002 && drift * hold < .01;
      if (idle || document.hidden) { running = false; lastT = 0; return; }
      requestAnimationFrame(frame);
    };
    const wake = () => { if (running) return; running = true; lastT = 0; requestAnimationFrame(frame); };
    // the scroll feeds the flow only while the reel or the ring is on screen; otherwise the delta is dropped, so nothing whooshes on arrival
    addEventListener('scroll', () => { const y = scrollY; const d = (y - lastY) * perPx; lastY = y; if (holds.has('offscreen')) return; target += d; sTarget += d; wake(); }, { passive: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
    reduced.addEventListener('change', () => { readTokens(); wake(); });
    const stages = new Map();
    const stageIO = new IntersectionObserver((entries) => { for (const en of entries) stages.set(en.target, en.isIntersecting); const any = [...stages.values()].some(Boolean); if (any) holds.delete('offscreen'); else holds.add('offscreen'); wake(); }, { threshold: 0 });
    return {
      watch(el) { stages.set(el, true); stageIO.observe(el); },
      on(fn) { listeners.add(fn); fn(angle, sAngle); wake(); },
      hold(key, on) { if (on) holds.add(key); else holds.delete(key); wake(); },
      get angle() { return angle; },
      get scrollAngle() { return sAngle; },
      get held() { return holds.size > 0; },
      set(a) { angle = target = a; emit(); },   // test hook
      get holdKeys() { return [...holds].map(h => typeof h === 'string' ? h : (h.className || h.tagName)); },   // test hook
    };
  })();

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
    reel.addEventListener('click', (e) => { if (eat && e.detail) { eat = false; e.stopPropagation(); e.preventDefault(); } }, true);   // detail 0 is a key, never eaten
    reel.addEventListener('dragstart', (e) => e.preventDefault());
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
    let index = 0, opener = null;
    const show = (i) => {
      index = (i + names.length) % names.length;
      const d = lbData[names[index]];
      const av = d.avif.map(([w, u]) => `${u} ${w}w`).join(', '), wp = d.webp.map(([w, u]) => `${u} ${w}w`).join(', ');
      figure.innerHTML = `<picture><source type="image/avif" srcset="${av}" sizes="90vw"><source type="image/webp" srcset="${wp}" sizes="90vw"><img src="${d.jpeg}" width="${d.w}" height="${d.h}" alt="${d.alt}" decoding="async"></picture>`;
      live.textContent = `Photograph ${index + 1} of ${names.length}. ${d.alt}`;
      // warm the neighbours
      for (const k of [index + 1, index - 1]) { const n = lbData[names[(k + names.length) % names.length]]; const im = new Image(); im.src = n.webp[n.webp.length - 1][1]; }
    };
    const open = (name, from) => { opener = from; show(Math.max(0, names.indexOf(name))); lb.showModal(); $('.lightbox__close', lb).focus({ preventScroll: true }); flow.hold('lightbox', true); };
    buttons.forEach(b => b.addEventListener('click', () => open(b.dataset.photo, b)));
    $('.lightbox__prev', lb).addEventListener('click', () => show(index - 1));
    $('.lightbox__next', lb).addEventListener('click', () => show(index + 1));
    $('.lightbox__close', lb).addEventListener('click', () => lb.close());
    lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lightbox__stage')) lb.close(); });
    lb.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); } });
    lb.addEventListener('close', () => { flow.hold('lightbox', false); if (opener && opener.isConnected) opener.focus({ preventScroll: true }); });
    // swipe on touch
    let sx = null;
    lb.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 48) show(index + (dx < 0 ? 1 : -1)); }, { passive: true });
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
  const dialog = $('#newsletterDialog');
  const KEY = 'di:newsletter';
  const state = store.get(KEY) || '';
  const dismissedRecently = state.startsWith('dismissed:') && (Date.now() - Date.parse(state.slice(10)) < 30 * 864e5);
  const subscribed = state === 'subscribed';
  let lastClick = 0;
  addEventListener('pointerdown', () => { lastClick = Date.now(); }, { capture: true, passive: true });
  const openDialog = (opener) => {
    if (!dialog || dialog.open) return;
    dialog.dataset.opener = opener ? 'button' : 'auto';
    if (mobile.matches && !opener) dialog.show(); else dialog.showModal();
    $('h2', dialog).focus({ preventScroll: true });
  };
  if (dialog) {
    $$('[data-open-dialog]').forEach(b => b.addEventListener('click', () => openDialog(b)));
    $('.dialog__close', dialog).addEventListener('click', () => dialog.close('dismiss'));
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close('dismiss'); });
    dialog.addEventListener('close', () => {
      if (dialog.returnValue !== 'subscribed' && !subscribed) store.set(KEY, 'dismissed:' + new Date().toISOString());
    });
    // automatic: both ≥40% scroll and ≥10s, not within 2s of a click, no field focused, no sheet open, once per session
    if (!subscribed && !dismissedRecently && !store.sget('di:nl-shown')) {
      const t0 = Date.now();
      let armed = true;
      const check = () => {
        if (!armed) return;
        const depth = (scrollY + innerHeight) / document.documentElement.scrollHeight;
        const ok = depth >= 0.4 && Date.now() - t0 >= 10000 && Date.now() - lastClick > 2000
          && !(document.activeElement && document.activeElement.matches('input, textarea')) && !(sheet && sheet.open) && !dialog.open;
        if (ok) { armed = false; store.sset('di:nl-shown', '1'); openDialog(null); }
      };
      addEventListener('scroll', check, { passive: true });
      const iv = setInterval(() => { check(); if (!armed) clearInterval(iv); }, 1000);
    }
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
