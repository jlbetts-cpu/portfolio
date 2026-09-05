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

  /* ---- Nav: a surface only once there is something under it ---- */
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 24);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

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
    addEventListener('scroll', () => { const y = scrollY; const d = (y - lastY) * perPx; lastY = y; target += d; sTarget += d; wake(); }, { passive: true });
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
    };
  })();

  /* ---- Hero: first paint once per session ---- */
  const hero = $('#top');
  if (hero) {
    if (store.sget('di:arrived')) { hero.classList.add('is-ready'); }
    else {
      hero.classList.add('is-arriving');
      $$('.hero__head > *, .hero__row > *, .strip', hero).forEach((el, i) => el.style.setProperty('--d', i));
      requestAnimationFrame(() => requestAnimationFrame(() => { hero.classList.add('is-ready'); store.sset('di:arrived', '1'); }));
    }
  }

  /* ---- The strip: one loop of photographs on a track, moved by the flow; the arrows step a card; it can be dragged ---- */
  $$('[data-strip]').forEach(track => {
    const viewport = track.parentElement;
    const cards = [...track.children];
    const n = cards.length / 2;
    let pitch = 0, half = 0, pxPerDeg = 6;
    const measure = () => { const a = cards[0].getBoundingClientRect(), b = cards[1].getBoundingClientRect(); pitch = b.left - a.left; half = pitch * n; pxPerDeg = num(getComputedStyle(root), '--strip-px', 6); };
    measure(); addEventListener('resize', measure);
    let offset = 0, target = 0, dragging = false, dragX = 0, dragStart = 0, tweening = false;
    const place = () => { const pos = flow.angle * pxPerDeg + offset; const x = ((pos % half) + half) % half; track.style.transform = `translate3d(${(-x).toFixed(2)}px,0,0)`; };
    let tweenT = 0;
    const tween = (t) => { const dt = tweenT ? Math.min(.05, (t - tweenT) / 1000) : 0; tweenT = t; const d = target - offset; if (Math.abs(d) < .3) { offset = target; tweening = false; tweenT = 0; place(); return; } offset += d * (1 - Math.exp(-dt / .11)); place(); requestAnimationFrame(tween); };   // time-based, so a slow frame rate cannot shorten a step
    const go = (d) => { target += d; if (!tweening) { tweening = true; tweenT = 0; requestAnimationFrame(tween); } };
    flow.on(place); flow.watch(viewport);
    const scope = track.closest('.strip') || viewport;
    const prev = $('[data-strip-prev]', scope), next = $('[data-strip-next]', scope);
    if (prev) prev.addEventListener('click', () => go(-pitch));
    if (next) next.addEventListener('click', () => go(pitch));
    let moved = false;
    // the pointer is captured only once this is a drag (6px), so a plain click still reaches the photograph's button
    viewport.addEventListener('pointerdown', (e) => { if (e.button !== 0 && e.pointerType === 'mouse') return; dragging = true; moved = false; dragX = e.clientX; dragStart = offset; flow.hold(track, true); });
    viewport.addEventListener('pointermove', (e) => { if (!dragging) return; const dx = e.clientX - dragX; if (!moved && Math.abs(dx) > 6) { moved = true; viewport.classList.add('is-dragging'); try { viewport.setPointerCapture(e.pointerId); } catch {} } if (moved) { offset = target = dragStart - dx; place(); } });
    const release = () => { if (!dragging) return; dragging = false; viewport.classList.remove('is-dragging'); flow.hold(track, false); };
    viewport.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    viewport.addEventListener('pointerup', release); viewport.addEventListener('pointercancel', release);
    viewport.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') flow.hold(viewport, true); });
    let stripTouch;
    viewport.addEventListener('touchstart', () => { flow.hold(viewport, true); clearTimeout(stripTouch); stripTouch = setTimeout(() => flow.hold(viewport, false), 4000); }, { passive: true });
    viewport.addEventListener('pointerleave', () => flow.hold(viewport, false));
  });

  /* ---- The quote ring: shaped photographs on a circle, upright, turning with the flow ---- */
  $$('.ring__orbit').forEach(orbit => {
    const items = $$('.ring__item', orbit);
    let r = 300, n = items.length;
    const read = () => { const cs = getComputedStyle(root); r = num(cs, '--ring-r', 300); };
    read(); addEventListener('resize', read);
    const render = (a) => {
      for (let i = 0; i < items.length; i++) {
        const t = (a + i * 360 / n) * Math.PI / 180;
        items[i].style.transform = `translate3d(${(r * Math.sin(t)).toFixed(2)}px, ${(-r * Math.cos(t)).toFixed(2)}px, 0)`;
      }
    };
    flow.on(render);
    orbit.addEventListener('pointerover', (e) => { if (e.target.closest('.photo')) flow.hold(orbit, true); });
    orbit.addEventListener('pointerout', (e) => { if (e.target.closest('.photo') && !(e.relatedTarget && e.relatedTarget.closest('.photo'))) flow.hold(orbit, false); });
    let touchTimer;
    orbit.addEventListener('touchstart', (e) => { if (!e.target.closest('.photo')) return; flow.hold(orbit, true); clearTimeout(touchTimer); touchTimer = setTimeout(() => flow.hold(orbit, false), 4000); }, { passive: true });
    flow.watch(orbit.closest('.ring') || orbit);
  });
  /* ---- Lightbox: every photograph opens large; arrows and keys move through all of them in page order ---- */
  const lb = $('#lightbox');
  const lbData = (() => { try { return JSON.parse($('#lbData').textContent); } catch { return null; } })();
  if (lb && lbData) {
    const buttons = $$('.photo__open').filter(b => !b.closest('[aria-hidden="true"]'));
    const names = [...new Set(buttons.map(b => b.dataset.photo))];
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

  /* ---- Reveal on scroll, once ---- */
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
  }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });
  $$('.reveal').forEach(el => io.observe(el));
  $$('.reveal--stagger').forEach(p => $$(':scope > .reveal', p).forEach((c, i) => c.style.setProperty('--d', Math.min(i, 6))));

  /* ---- The stack: a covered card shrinks from its top edge as the next one climbs over it; deeper cards are smaller ---- */
  const stackUpdate = (() => {
    const cards = $$('.stack__card');
    if (!cards.length) return () => {};
    cards.forEach((c, i) => c.style.setProperty('--i', i));
    const update = () => {
      if (reduced.matches) { cards.forEach(c => { c.style.transform = ''; c.style.setProperty('--bloom', '1'); }); return; }
      const cover = cards.map((c, i) => {
        const next = cards[i + 1]; if (!next) return 0;
        const r = c.getBoundingClientRect(), nr = next.getBoundingClientRect();
        return clamp((r.bottom - nr.top) / r.height, 0, 1);
      });
      let depth = 0;
      for (let i = cards.length - 1; i >= 0; i--) {
        depth += cover[i];
        const s = 1 - .045 * Math.min(depth, 3);
        cards[i].style.transform = depth > 0.001 ? `scale(${s.toFixed(4)})` : '';
        // the bloom rises as the card fills the screen: none below 30% visible, full from 70%, and it fades as the next card covers it
        const r = cards[i].getBoundingClientRect(); const shown = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / Math.min(r.height, innerHeight);
        const bloom = clamp((shown - .3) / .4, 0, 1) * (1 - cover[i]);
        cards[i].style.setProperty('--bloom', bloom.toFixed(3));
      }
    };
    let ticking = false;
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; update(); }); } };
    addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll);
    update();
    return update;
  })();

  /* ---- Menu sheet (mobile) ---- */
  const sheet = $('#menuSheet');
  const menuBtn = $('[data-open-menu]');
  if (sheet && menuBtn) {
    const open = () => { sheet.showModal(); menuBtn.textContent = 'Close'; menuBtn.setAttribute('aria-expanded', 'true'); };
    const close = () => { sheet.close(); };
    menuBtn.addEventListener('click', () => sheet.open ? close() : open());
    $('[data-close-menu]', sheet).addEventListener('click', close);
    sheet.addEventListener('close', () => { menuBtn.textContent = 'Menu'; menuBtn.setAttribute('aria-expanded', 'false'); });
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

  window.__di = { flow, stackUpdate, lightbox: lb };   // hooks for tools/gates
})();
