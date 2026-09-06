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

  /* ---- Theme: light unless the visitor chose dark. The choice is read before first paint by the inline script in <head>. ---- */
  const applyTheme = (t, animate) => {
    if (animate) { root.classList.add('is-theming'); setTimeout(() => root.classList.remove('is-theming'), 260); }
    root.dataset.theme = t;
    const meta = $('meta[name="theme-color"]'); if (meta) meta.content = t === 'dark' ? '#131211' : '#F0ECE3';
    $$('[data-theme-toggle]').forEach(b => b.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'));
  };
  applyTheme(root.dataset.theme === 'light' ? 'light' : 'dark', false);
  $$('[data-theme-toggle]').forEach(b => b.addEventListener('click', () => {
    const t = root.dataset.theme === 'dark' ? 'light' : 'dark';
    store.set('di:theme', t); applyTheme(t, true);
  }));

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
    const shot = $$('.hero__bento img').slice(0, 6);
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

  /* ---- Nav: on a phone it is fixed, and it takes a ground only once there is something under it ---- */
  const nav = $('#nav');
  if (nav) { const onNav = () => nav.classList.toggle('is-scrolled', scrollY > 24); addEventListener('scroll', onNav, { passive: true }); onNav(); }

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
    // the scroll feeds the flow only while the strip or the ring is on screen; otherwise the delta is dropped, so nothing whooshes on arrival
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

  /* ---- The hero's bento: columns of photographs looping vertically with the flow, in alternating directions ----
     Each column holds its contents twice; [data-mid] is the first child of the second copy, so its offsetTop is the
     loop length. Every tile has an intrinsic ratio, so that length is stable before the images load. */
  $$('[data-bento]').forEach(col => {
    const dir = +col.dataset.bento || 1;
    const speed = parseFloat(getComputedStyle(col).getPropertyValue('--speed')) || 1;
    const mid = $('[data-mid]', col);
    let half = 0, pxPerDeg = 5;
    const measure = () => { half = mid ? mid.offsetTop : col.scrollHeight / 2; pxPerDeg = num(getComputedStyle(root), '--bento-px', 5); };
    measure(); addEventListener('resize', measure);
    const place = () => {
      if (!half) return;
      const pos = flow.angle * pxPerDeg * speed;
      const y = ((pos % half) + half) % half;
      col.style.transform = `translate3d(0, ${(dir > 0 ? -y : y - half).toFixed(2)}px, 0)`;
    };
    flow.on(place);
  });
  const bento = $('.hero__bento');
  if (bento) {
    flow.watch(bento);
    bento.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') flow.hold(bento, true); });
    bento.addEventListener('pointerleave', () => flow.hold(bento, false));
    let bentoTouch;
    bento.addEventListener('touchstart', () => { flow.hold(bento, true); clearTimeout(bentoTouch); bentoTouch = setTimeout(() => flow.hold(bento, false), 4000); }, { passive: true });
  }

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
    orbit.addEventListener('pointerout', (e) => { if (e.target.closest('.photo') && !(e.relatedTarget && e.relatedTarget.closest('.photo') && orbit.contains(e.relatedTarget))) flow.hold(orbit, false); });
    let touchTimer;
    orbit.addEventListener('touchstart', (e) => { if (!e.target.closest('.photo')) return; flow.hold(orbit, true); clearTimeout(touchTimer); touchTimer = setTimeout(() => flow.hold(orbit, false), 4000); }, { passive: true });
    flow.watch(orbit.closest('.ring') || orbit);
  });
  /* ---- Lightbox: every photograph opens large; arrows and keys move through all of them in page order ---- */
  const lb = $('#lightbox');
  const lbData = (() => { try { return JSON.parse($('#lbData').textContent); } catch { return null; } })();
  if (lb && lbData) {
    const buttons = $$('[data-photo]').filter(b => !b.closest('[aria-hidden="true"]'));
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
  $$('.reveal, .reveal--parts').forEach(el => io.observe(el));
  $$('.reveal--stagger').forEach(p => $$(':scope > .reveal', p).forEach((c, i) => c.style.setProperty('--d', Math.min(i, 6))));
  // the ring assembles: each photograph a beat after the last, going round
  $$('.ring__orbit .ring__item').forEach((el, i) => { const ph = $('.photo', el); if (ph) ph.style.setProperty('--d', i); });

  /* ---- The reader: the full copy behind a card. One dialog, filled from whichever card opened it, and the whole
     card is the trigger — the button inside it is the keyboard route and its click bubbles up to the same handler. ---- */
  const reader = $('#reader');
  if (reader) {
    const chips = $('.reader__chips', reader), title = $('.reader__title', reader), prose = $('.reader__prose', reader);
    let from = null;
    $$('.brief').forEach(card => card.addEventListener('click', () => {
      // a card is a big click target wrapped around selectable text: a drag-select ends in a click on the card,
      // and opening a dialog on top of the words someone just highlighted is the wrong answer
      if (reader.open || String(getSelection() || '').length) return;
      from = $('.brief__more', card) || card;
      reader.dataset.accent = card.dataset.accent || '';
      chips.innerHTML = $('.brief__chips', card).innerHTML;
      title.textContent = $('.brief__title', card).textContent;
      prose.innerHTML = $('.brief__full', card).innerHTML;
      prose.scrollTop = 0;
      reader.showModal();
      title.focus({ preventScroll: true });
      flow.hold('reader', true);
    }));
    $('.dialog__close', reader).addEventListener('click', () => reader.close());
    reader.addEventListener('click', (e) => { if (e.target === reader) reader.close(); });
    reader.addEventListener('close', () => { flow.hold('reader', false); if (from && from.isConnected) from.focus({ preventScroll: true }); });
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

  window.__di = { flow, lightbox: lb, reader };   // hooks for tools/gates
})();
