/* ============================================================================
   carousel.js -- the one carousel on this site.

   It replaces four byte-identical copies of a per-page script (apollo, bearings,
   cluster and ucdavis each carried the same 3,436 bytes) and gives both stepped
   viewers the same four affordances Jayden asked for: swipe, an arrow either
   side, a page indicator, and controls you can reach without scrolling away from
   the image.

   TWO SKINS, ONE ENGINE.
     .player  a sequence of unlabelled steps  -> tick indicator
     .tv      a handful of named screens      -> labelled tabs, direct access

   The indicator differs because the CONTENT differs, not because the component
   does: seven steps as tabs would wrap to two rows and four named screens as
   ticks would throw away their names.  Everything else -- arrows, swipe,
   keyboard, focus, the scene cut, and the auto-advance rules -- is this file,
   once, for both.

   THINGS THAT ARE LOAD-BEARING AND ARE NOT TO BE "TIDIED":
     * touch-action:pan-y (carousel.css) is why a swipe registers immediately
       instead of after the browser has finished deciding it was not a scroll.
       It must not become `none`; that would eat vertical page scrolling.
     * The scene cut is driven by `transitionend`, not a timer, so the image
       swaps at the bottom of the dissolve rather than at a guessed moment.  The
       timer below is only a fallback for when no transition runs at all (a
       backgrounded tab, or reduced motion).
     * setPointerCapture is deliberately NOT used.  It is what makes drag on this
       site behave differently under synthetic events than under real ones, and
       the swipe here is simple enough not to need it.
   ========================================================================== */

(function () {
  'use strict';

  var reduceQuery = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)');
  function reduced() { return !!(reduceQuery && reduceQuery.matches); }

  var DWELL = 2600;          /* how long a beat holds before auto-advancing */
  var SWIPE_MIN = 40;        /* px of travel that counts as a swipe */
  var SWIPE_FLICK = 0.5;     /* px/ms that counts as a flick regardless of travel */
  var AXIS_LOCK = 6;         /* px before we decide the gesture's axis */
  var DRAG_DIVISOR = 3;      /* the image follows the finger at a third speed */
  var DRAG_MAX = 64;         /* and never further than this */

  var uid = 0;

  function parseJSON(root, selector) {
    var node = root.querySelector(selector);
    if (!node) return [];
    try { return JSON.parse(node.textContent); } catch (e) { return []; }
  }

  function ms(value, fallback) {
    var n = parseFloat(value);
    if (!n) return fallback;
    return /ms\s*$/.test(value) ? n : n * 1000;
  }

  function svgArrow(back) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="' +
      (back ? '15 18 9 12 15 6' : '9 6 15 12 9 18') + '"/></svg>';
  }

  /* ------------------------------------------------------------------------
     The engine.
     ---------------------------------------------------------------------- */
  function build(root, cfg) {
    var slides = cfg.slides;
    var stage = cfg.stage;
    var img = cfg.img;
    if (!slides.length || !stage || !img) return null;

    var i = 0;
    var auto = !reduced() && cfg.auto;
    var started = false;
    var timer = null;
    var cutTimer = null;
    var live = null;
    var id = 'crsl' + (++uid);

    img.classList.add('scene-swap-target');
    slides.forEach(function (s) { var pre = new Image(); pre.src = s.src; });

    /* --- arrows ---------------------------------------------------------- */
    function arrow(dir, label) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'crslNav crslNav--' + (dir < 0 ? 'prev' : 'next') + ' ctl ctl--icon';
      b.setAttribute('aria-label', label);
      b.innerHTML = svgArrow(dir < 0);
      b.addEventListener('click', function () { surrender(); go(i + dir); });
      stage.appendChild(b);
      return b;
    }
    arrow(-1, cfg.prevLabel);
    arrow(1, cfg.nextLabel);

    /* --- the announcement, for screen readers ---------------------------- */
    live = document.createElement('span');
    live.className = 'qsr';
    /* "off" while the thing is advancing on its own -- an unattended carousel
       must not narrate itself seven times.  surrender() turns it on. */
    live.setAttribute('aria-live', 'off');
    root.appendChild(live);

    /* --- indicator ------------------------------------------------------- */
    var marks = cfg.indicator(go, surrender, id);

    /* --- rendering ------------------------------------------------------- */
    function render() {
      var s = slides[i];
      img.src = s.src;
      img.alt = s.alt || '';
      cfg.paint(s, i);
      marks.forEach(function (m, k) { cfg.mark(m, k === i, k); });
      live.textContent = cfg.announce(s, i, slides.length);
    }

    function go(k) {
      var next = (k % slides.length + slides.length) % slides.length;
      if (next === i && marks.length) { /* still repaint: a swipe may have moved the image */ }
      i = next;
      clearTimeout(cutTimer);
      if (reduced()) { render(); root.classList.remove('dev'); return; }

      function finish(e) {
        if (e && (e.target !== img || (e.propertyName !== 'filter' && e.propertyName !== 'opacity'))) return;
        img.removeEventListener('transitionend', finish);
        clearTimeout(cutTimer);
        render();
        root.classList.remove('dev');
      }
      img.addEventListener('transitionend', finish);
      /* If no transition runs at all -- backgrounded tab, forced-colors, a UA
         that drops the filter -- transitionend never fires and the old code
         wedged here.  Land it anyway. */
      cutTimer = setTimeout(finish, ms(getComputedStyle(root).getPropertyValue('--scene-cut-duration'), 250) + 140);
      root.classList.add('dev');
    }

    /* --- auto-advance, and how it yields --------------------------------- */
    function schedule() {
      clearTimeout(timer);
      if (!auto) return;
      timer = setTimeout(function () {
        if (!auto) return;
        if (i >= slides.length - 1) { auto = false; return; }
        go(i + 1);
        schedule();
      }, DWELL);
    }

    /* The moment a person touches this thing it stops moving on its own, for
       good.  A carousel that keeps advancing under your hand is worse than one
       that never moved. */
    function surrender() {
      if (!auto && live.getAttribute('aria-live') === 'polite') return;
      auto = false;
      clearTimeout(timer);
      live.setAttribute('aria-live', 'polite');
    }

    root.addEventListener('pointerenter', function () { clearTimeout(timer); });
    root.addEventListener('pointerleave', function () { if (auto && started) schedule(); });
    root.addEventListener('focusin', surrender);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) clearTimeout(timer); else if (auto && started) schedule();
    });

    /* --- keyboard -------------------------------------------------------- */
    root.addEventListener('keydown', function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var k = e.key, moved = true;
      if (k === 'ArrowLeft') go(i - 1);
      else if (k === 'ArrowRight') go(i + 1);
      else if (k === 'Home') go(0);
      else if (k === 'End') go(slides.length - 1);
      else moved = false;
      if (!moved) return;
      surrender();
      e.preventDefault();
      cfg.focusMark(marks, i);
    });

    /* --- swipe ----------------------------------------------------------- */
    var drag = null;
    stage.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, axis: 0 };
    });

    function release() {
      stage.classList.remove('crsl-dragging');
      stage.style.setProperty('--crsl-drag', '0px');
    }

    function onMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.axis) {
        if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
        /* Vertical first means the reader is scrolling the page, not the
           carousel.  Let go of it completely. */
        drag.axis = Math.abs(dx) > Math.abs(dy) ? 1 : -1;
        if (drag.axis < 0) { drag = null; return; }
        surrender();
        if (!reduced()) stage.classList.add('crsl-dragging');
      }
      if (reduced()) return;
      var shift = Math.max(-DRAG_MAX, Math.min(DRAG_MAX, dx / DRAG_DIVISOR));
      stage.style.setProperty('--crsl-drag', shift.toFixed(1) + 'px');
    }

    function onUp(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x;
      var horizontal = drag.axis > 0;
      var speed = Math.abs(dx) / Math.max(1, e.timeStamp - drag.t);
      drag = null;
      release();
      if (!horizontal) return;
      if (Math.abs(dx) >= SWIPE_MIN || speed >= SWIPE_FLICK) {
        surrender();
        go(i + (dx < 0 ? 1 : -1));
      }
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      release();
    });

    /* --- start when it comes into view ----------------------------------- */
    if (auto && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries, io) {
        entries.forEach(function (en) {
          if (en.isIntersecting && !started) { started = true; schedule(); io.disconnect(); }
        });
      }, { threshold: 0.5 }).observe(root);
    }

    render();
    return { root: root, go: go, reserve: cfg.reserve };
  }

  /* ------------------------------------------------------------------------
     Skin 1: .player -- a flow, one step at a time, with a tick per step.
     ---------------------------------------------------------------------- */
  function flowPlayer(root) {
    var slides = parseJSON(root, '.playerBeats');
    var stage = root.querySelector('.playerStage');
    var img = stage && stage.querySelector('img');
    var step = root.querySelector('.playerStep');
    var note = root.querySelector('.playerNote');
    var cap = root.querySelector('.playerCap');
    var ticksBox = root.querySelector('.playerTicks');
    if (!slides.length || !stage || !img) return null;

    /* The caption is rewritten every beat, and a two-line note followed by a
       one-line note used to collapse the block by 21.75px -- moving the toolbar
       and everything under it while you read.  Reserve the tallest.  Measured
       after fonts land, because a fallback face measures short. */
    function reserve() {
      if (!cap || (!step && !note)) return;
      var was = [step && step.textContent, note && note.textContent];
      cap.style.setProperty('--crsl-cap-h', '0px');
      var tallest = 0;
      slides.forEach(function (s) {
        if (step) step.textContent = s.step || '';
        if (note) note.textContent = s.note || '';
        tallest = Math.max(tallest, cap.getBoundingClientRect().height);
      });
      if (step) step.textContent = was[0];
      if (note) note.textContent = was[1];
      cap.style.setProperty('--crsl-cap-h', Math.ceil(tallest) + 'px');
    }

    var api = build(root, {
      slides: slides, stage: stage, img: img, auto: true,
      prevLabel: 'Previous screen', nextLabel: 'Next screen',
      paint: function (s) {
        if (step) step.textContent = s.step || '';
        if (note) note.textContent = s.note || '';
      },
      announce: function (s, k, n) {
        return (s.step ? s.step + '. ' : '') + 'Step ' + (k + 1) + ' of ' + n + '.';
      },
      /* The ticks are authored in the markup, one per beat, so the indicator
         renders before this file does and survives without it. They are
         reconciled rather than trusted: if a beat is ever added to the JSON and
         the markup is not updated, the count is corrected here instead of
         silently showing the wrong number of steps. */
      indicator: function (go, surrender) {
        if (!ticksBox) return [];
        var out = [].slice.call(ticksBox.querySelectorAll('.playerTick'));
        while (out.length > slides.length) out.pop().remove();
        while (out.length < slides.length) {
          var add = document.createElement('button');
          add.className = 'playerTick ctl ctl--tick';
          ticksBox.appendChild(add);
          out.push(add);
        }
        out.forEach(function (t, k) {
          t.type = 'button';
          t.setAttribute('aria-label', 'Show step ' + (k + 1) + ' of ' + slides.length);
          t.addEventListener('click', function () { surrender(); go(k); });
        });
        return out;
      },
      mark: function (t, on) {
        t.classList.toggle('on', on);
        t.setAttribute('aria-pressed', on ? 'true' : 'false');
      },
      focusMark: function (marks, k) { if (marks[k]) marks[k].focus(); },
      reserve: reserve
    });
    if (api) reserve();
    return api;
  }

  /* ------------------------------------------------------------------------
     Skin 2: .tv -- named screens, every one a tap away.
     The tabs stay: direct access to a named screen is worth more than a dot,
     and they double as the page indicator.  They gain the arrow keys, a roving
     tabindex and a real tabpanel relationship, which they did not have.
     ---------------------------------------------------------------------- */
  function tabbedViewer(root) {
    var slides = parseJSON(root, '.tvItems');
    var frame = root.querySelector('.tvFrame');
    var img = frame && frame.querySelector('img');
    var tabs = [].slice.call(root.querySelectorAll('.tvTab'));
    if (!slides.length || !frame || !img) return null;

    return build(root, {
      slides: slides, stage: frame, img: img, auto: false,
      prevLabel: 'Previous screen', nextLabel: 'Next screen',
      paint: function () {},
      announce: function (s, k, n) {
        return (s.label ? s.label + '. ' : '') + (k + 1) + ' of ' + n + '.';
      },
      indicator: function (go, surrender, id) {
        frame.setAttribute('role', 'tabpanel');
        frame.setAttribute('tabindex', '0');
        tabs.forEach(function (t, k) {
          t.id = id + 'tab' + k;
          t.setAttribute('aria-controls', id + 'panel');
          t.setAttribute('tabindex', k === 0 ? '0' : '-1');
          t.addEventListener('click', function () { surrender(); go(k); });
        });
        frame.id = id + 'panel';
        if (tabs[0]) frame.setAttribute('aria-labelledby', tabs[0].id);
        return tabs;
      },
      mark: function (t, on, k) {
        t.classList.toggle('on', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.setAttribute('tabindex', on ? '0' : '-1');
        if (on) frame.setAttribute('aria-labelledby', t.id || (t.id = 'crslTab' + k));
      },
      focusMark: function (marks, k) { if (marks[k]) marks[k].focus(); },
      reserve: function () {}
    });
  }

  /* ------------------------------------------------------------------------
     Boot.
     ---------------------------------------------------------------------- */
  function boot() {
    var all = [];
    [].slice.call(document.querySelectorAll('.player')).forEach(function (el) {
      var c = flowPlayer(el); if (c) all.push(c);
    });
    [].slice.call(document.querySelectorAll('.tv')).forEach(function (el) {
      var c = tabbedViewer(el); if (c) all.push(c);
    });
    if (!all.length) return;

    /* A caption reserved against a fallback font is the wrong height. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { all.forEach(function (c) { c.reserve(); }); });
    }
    var t = null;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () { all.forEach(function (c) { c.reserve(); }); }, 200);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
