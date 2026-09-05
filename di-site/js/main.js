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

  /* ---- Theme: light unless the visitor chose dark; the header is dark either way ---- */
  const applyTheme = (t, animate) => {
    if (animate) { root.classList.add('is-theming'); setTimeout(() => root.classList.remove('is-theming'), 320); }
    root.dataset.theme = t;
    $$('[data-theme-toggle]').forEach(b => b.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'));
  };
  applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light', false);
  $$('[data-theme-toggle]').forEach(b => b.addEventListener('click', () => {
    const t = root.dataset.theme === 'dark' ? 'light' : 'dark';
    store.set('di:theme', t); applyTheme(t, true);
  }));

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
    const tween = (t) => { const d = target - offset; if (Math.abs(d) < .3) { offset = target; tweening = false; place(); return; } offset += d * .14; place(); requestAnimationFrame(tween); };
    const go = (d) => { target += d; if (!tweening) { tweening = true; requestAnimationFrame(tween); } };
    flow.on(place); flow.watch(viewport);
    const scope = track.closest('.strip') || viewport;
    const prev = $('[data-strip-prev]', scope), next = $('[data-strip-next]', scope);
    if (prev) prev.addEventListener('click', () => go(-pitch));
    if (next) next.addEventListener('click', () => go(pitch));
    viewport.addEventListener('pointerdown', (e) => { if (e.button !== 0 && e.pointerType === 'mouse') return; dragging = true; dragX = e.clientX; dragStart = offset; viewport.setPointerCapture(e.pointerId); viewport.classList.add('is-dragging'); flow.hold(track, true); });
    viewport.addEventListener('pointermove', (e) => { if (!dragging) return; offset = target = dragStart - (e.clientX - dragX); place(); });
    const release = () => { if (!dragging) return; dragging = false; viewport.classList.remove('is-dragging'); flow.hold(track, false); };
    viewport.addEventListener('pointerup', release); viewport.addEventListener('pointercancel', release);
    viewport.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') flow.hold(viewport, true); });
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
  // shapes and the logo's ring of figures move with the scroll part of the flow only, so at rest they are still
  const SPIN = { spin: .5, 'spin-slow': .2, float: .35 };
  $$('[data-flow]').forEach(el => { const k = SPIN[el.dataset.flow] || .5; const isFloat = el.dataset.flow === 'float'; flow.on((a, sa) => { el.style.transform = isFloat ? `translate3d(0, ${(-(sa * k) % 40).toFixed(2)}px, 0)` : `rotate(${(sa * k).toFixed(2)}deg)`; }); });
  $$('.logo__ring').forEach(el => flow.on((a, sa) => { el.style.transform = `rotate(${sa.toFixed(3)}deg)`; }));

  /* ---- Reveal on scroll, once ---- */
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
  }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });
  $$('.reveal, .pile').forEach(el => io.observe(el));
  $$('.reveal--stagger').forEach(p => $$(':scope > .reveal', p).forEach((c, i) => c.style.setProperty('--d', Math.min(i, 6))));

  /* ---- The stack: a covered card shrinks from its top edge as the next one climbs over it; deeper cards are smaller ---- */
  const stackUpdate = (() => {
    const cards = $$('.stack__card');
    if (!cards.length) return () => {};
    cards.forEach((c, i) => c.style.setProperty('--i', i));
    const update = () => {
      if (reduced.matches) { cards.forEach(c => { c.style.transform = ''; }); return; }
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
      }
    };
    let ticking = false;
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; update(); }); } };
    addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll);
    update();
    return update;
  })();

  /* ---- Testimonial pile: pager on mobile ---- */
  const pile = $('.pile');
  if (pile) {
    const marks = $$('.pile__pager .star');
    const pcards = $$('.pile__card', pile);
    pcards.forEach((c, i) => c.style.setProperty('--d', i));
    const setActive = () => {
      const x = pile.scrollLeft + pile.clientWidth / 2;
      let best = 0, dist = Infinity;
      pcards.forEach((c, i) => { const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - x); if (d < dist) { dist = d; best = i; } });
      marks.forEach((m, i) => m.classList.toggle('is-active', i === best));
    };
    pile.addEventListener('scroll', setActive, { passive: true }); setActive();
  }

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

  window.__di = { flow, stackUpdate };   // hooks for tools/gates
})();
