/* ═══════════════════════════════════════════════════════════════════════════
   league-photos.js -- when a cup tie is decided, the two players' photographs
   go up and the loser's is torn in half, in black and white.

   Jayden: "you know how everyone uploading there picture I think it would be
   funny to just put up the photo after they win like two photos the winner and
   looser and the losers photo gets torn up realistically and turns black and
   white like they died lol and then the winner photo and then they disapeear
   and its onto the next match I think that just adds more funny and enjoyable
   moments throughout the tournement."

   ── HOW IT HOOKS THE RESULT, WITHOUT TOUCHING play-tournament.js OR THE ENGINE
   `window.__hmTourWin(winSide, r, b)` is the one place a decided fixture exists
   as data, and it is a global. So this WRAPS it: read `__hmTour.cur` first --
   that has to be first, because the original clears T.cur synchronously and the
   two entrants are gone the instant it returns -- then call straight through,
   then schedule. The call-through is unconditional and is not inside any of the
   gates below, so the bracket cannot be delayed or blocked by anything in this
   file, including an exception in it.

   ── WHEN IT PLAYS, AND WHY IT IS NOT A CONSTANT
   play-engine's win path puts the big call ("Ozzy win") on screen at 850ms and
   .hmCount's hmCountP keyframes run 780ms, so the centre of the pitch is
   occupied until ~1630ms; the pitch itself comes down at 5400ms and the bracket
   moves at 5600ms. Both of those numbers live in a file this lane does not own,
   so rather than copy them, this WAITS FOR THE CALL TO CLEAR -- it polls
   .hmCount's computed opacity from 1150ms and starts as soon as it is gone,
   with a hard 2450ms cap in case the engine's timing changes. Measured on a
   real quarter-final at 1512x850: start 1740ms, last frame 4090ms, pitch down
   at 5400ms. The beat is 2350ms and it has never been the thing on the clock.

   ── WHY THE TEAR IS TWO CANVASES AND NOT A CSS FADE
   A CSS split can only cut a straight line, and a straight line does not read
   as paper. The card is painted once into an offscreen canvas -- rounded paper,
   hairline, head -- and each half is that same bitmap drawn through a clip()
   built from a random-walk polyline with per-point fibre jitter and the
   occasional torn tag. Because both halves come from ONE clip boundary they
   interlock exactly, and because they are both on screen from the start there
   is no swap and no pop at the moment of the tear: the picture was always two
   objects. The pale ragged edge is the paper's own core colour stroked along
   that same polyline under `source-atop`, so the clip does the masking for free
   and it never spills past the card's rounded corners.

   ── THE GATES
   It only ever runs under `body.hmYowCup`, never under `body.hmTourSim` (a
   simulated round calls this same hook with no pitch on screen), and a
   MutationObserver on body.class tears the whole thing down the moment either
   the cup ends or the pitch goes -- which is also the answer to "what if the
   bracket moves on first".
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* The beat, in ms from the moment the pair lands. Two photographs, a tear,
     gone -- it sits between every fixture, so its whole budget is one breath. */
  var T_TEAR  = 900;    // long enough to read both faces, short enough to still surprise
  var T_FALL  = 1000;   // matches .lgTear.isFalling's animation-duration
  var T_OUT   = 2050;   // the winner starts leaving 150ms after the halves are gone
  var T_END   = 2350;   // teardown -- 300ms after T_OUT, --dur-state-out is 240

  var WAIT_FROM = 1150; // start asking whether the engine's big call has cleared
  var WAIT_CAP  = 1300; // ...and stop asking after this long (so: 2450ms hard cap)

  /* --r-lg, the card-and-image rung. It is read off a computed probe rather than
     through getPropertyValue -- that returns the specified token stream, so a
     token that ever becomes a clamp() would come back a string and parseFloat
     would give NaN. This way the canvas's corner cannot drift from the CSS box's. */
  var RADIUS = 20;

  var wrap = null, timers = [], polls = [], live = null;

  function reduced() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (_) { return false; }
  }
  function after(ms, fn) { timers.push(setTimeout(fn, ms)); }

  /* ── teardown. Idempotent, and safe to call from anywhere including the
     observer, which is the point: no path can leave a node or a timer behind. */
  function clear() {
    for (var i = 0; i < timers.length; i++) { try { clearTimeout(timers[i]); } catch (_) {} }
    for (var j = 0; j < polls.length; j++) { try { clearInterval(polls[j]); } catch (_) {} }
    timers = []; polls = [];
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    wrap = null; live = null;
  }

  /* ── the two players ────────────────────────────────────────────────────────
     `tm.captain.portrait || tm.captain.cut` is the expression the bracket
     already uses to answer "what does this team look like", and mini-Jayden is
     the reason for the first half of it: his playing cut is baked into a 5:6
     frame and floats high in a square box, so he carries a square portrait for
     exactly this kind of use. Copying the expression rather than inventing one
     keeps the photograph here identical to the one on the match-up screen. */
  function pic(tm) {
    return (tm && tm.captain && (tm.captain.portrait || tm.captain.cut)) || null;
  }
  function snapshot(winSide) {
    var T = window.__hmTour;
    if (!T || !T.live || !T.cur) return null;
    var c = T.cur, A = c.a, B = c.b;
    var pa = pic(A), pb = pic(B);
    /* Both or neither. Half a beat -- one photograph going up alone -- would
       read as a bug rather than as a feature that could not find a picture. */
    if (!pa || !pb || !A || !B) return null;
    return {
      a: { src: pa, col: A.col || "117,117,117" },
      b: { src: pb, col: B.col || "117,117,117" },
      loser: (winSide === 1 ? "b" : "a")   // side 1 is always the fixture's `a`
    };
  }

  /* ── canvas helpers ────────────────────────────────────────────────────────*/
  function roundRect(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  }
  function sized(cv, w, h, dpr) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    return g;
  }

  /* WHERE THE HEAD ACTUALLY IS INSIDE ITS OWN FILE, measured rather than assumed.
     A dyed egghead's cut is tight to its silhouette; mini-Jayden's `portrait`
     (images/smile.webp) is an 820-square with the head sitting in 448x609 of it.
     Framed by the file's edges those two are wildly different sizes on the same
     row -- his photograph came out at about half the scale of the egghead beside
     it. So the alpha bounding box is found on a 100px thumbnail (cheap, and one
     pixel of the thumbnail is a whole margin of slack) and the card frames THAT.
     Nothing here is cross-origin -- data: URLs and same-origin webp -- so the
     read cannot taint, and the try/catch falls back to the untrimmed image if a
     future picture ever changes that. */
  function alphaBox(img) {
    try {
      var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      if (!iw || !ih) return null;
      var s = Math.min(1, 100 / Math.max(iw, ih));
      var w = Math.max(1, Math.round(iw * s)), h = Math.max(1, Math.round(ih * s));
      var c = document.createElement("canvas");
      c.width = w; c.height = h;
      var g = c.getContext("2d");
      g.drawImage(img, 0, 0, w, h);
      var d = g.getImageData(0, 0, w, h).data;
      var x0 = w, y0 = h, x1 = -1, y1 = -1, x, y;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 10) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      if (x1 < 0) return null;
      var k = 1 / s;
      var bx = Math.max(0, (x0 - 1) * k), by = Math.max(0, (y0 - 1) * k);
      var bw = Math.min(iw, (x1 + 2) * k) - bx, bh = Math.min(ih, (y1 + 2) * k) - by;
      /* Already tight: leave it alone rather than shave a pixel off a silhouette. */
      if (bw > iw * 0.96 && bh > ih * 0.96) return null;
      return { x: bx, y: by, w: bw, h: bh };
    } catch (_) { return null; }
  }

  /* The head is CONTAINED, never cropped. These are transparent cut-outs with
     their own silhouettes; a cover-crop takes the chin off. */
  function drawContain(g, img, x, y, w, h, b) {
    var sw = b ? b.w : (img.naturalWidth || img.width);
    var sh = b ? b.h : (img.naturalHeight || img.height);
    if (!sw || !sh) return;
    var s = Math.min(w / sw, h / sh);
    var dw = sw * s, dh = sh * s;
    g.drawImage(img, b ? b.x : 0, b ? b.y : 0, sw, sh,
                x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  /* One card, painted whole: paper, head, then the team's hairline on top. This
     is the ONLY place a card is drawn, so the winner and the loser cannot end up
     looking like two different objects. */
  function paintCard(cv, img, col, W, H, dpr, paper) {
    var g = sized(cv, W, H, dpr), pad = Math.round(W * 0.085);
    g.save();
    roundRect(g, 0, 0, W, H, RADIUS); g.clip();
    g.fillStyle = paper; g.fillRect(0, 0, W, H);
    drawContain(g, img, pad, pad, W - pad * 2, H - pad * 2, alphaBox(img));
    g.restore();
    g.save();
    roundRect(g, 0.5, 0.5, W - 1, H - 1, RADIUS - 0.5);
    g.lineWidth = 1; g.strokeStyle = "rgba(" + col + ",.30)"; g.stroke();
    g.restore();
    return cv;
  }

  /* ── the tear line ─────────────────────────────────────────────────────────
     A mean-reverting random walk down the card for the shape of the tear, then
     every coarse segment subdivided five ways with sub-pixel fibre jitter and a
     one-in-six chance of a torn tag several px to one side. The reversion term
     is what keeps it a tear down the middle rather than a diagonal; the clamp is
     what stops a half from being a sliver. */
  function tearPath(W, H) {
    var coarse = [], pts = [], n = 13, x = W * 0.5, vx = 0, i, k;
    for (i = 0; i <= n; i++) {
      coarse.push({ x: x, y: H * i / n });
      vx += (Math.random() - 0.5) * W * 0.085;
      vx *= 0.68;
      vx += (W * 0.5 - x) * 0.09;
      x = Math.max(W * 0.26, Math.min(W * 0.74, x + vx));
    }
    for (i = 0; i < n; i++) {
      var a = coarse[i], b = coarse[i + 1];
      for (k = 0; k < 5; k++) {
        var t = k / 5;
        var px = a.x + (b.x - a.x) * t + (Math.random() - 0.5) * 2.6;
        if (Math.random() < 0.16) px += (Math.random() < 0.5 ? -1 : 1) * (2.5 + Math.random() * 4.5);
        pts.push({ x: px, y: a.y + (b.y - a.y) * t });
      }
    }
    pts.push({ x: coarse[n].x, y: H });
    return pts;
  }

  /* `start` matters and getting it wrong is not subtle: a moveTo() halfway
     through a clip polygon opens a SECOND subpath, and the clip that came out of
     that was a wedge with the card's corners collapsed into it. When this is
     continuing an outline it must be lineTo. */
  function traceTear(g, pts, H, start, off) {
    off = off || 0;
    if (start) g.moveTo(pts[0].x + off, -2); else g.lineTo(pts[0].x + off, -2);
    for (var i = 0; i < pts.length; i++) g.lineTo(pts[i].x + off, pts[i].y);
    g.lineTo(pts[pts.length - 1].x + off, H + 2);
  }

  /* One half: the finished card drawn through the clip, plus -- only once the
     tear has actually happened -- the pale core of the paper along the break.
     `source-atop` is what keeps that stroke on the paper and off the rounded
     corners, and because the clip is already in force only its inner ~1.7px
     shows, which is what a torn edge is. */
  function paintHalf(cv, base, pts, side, W, H, dpr, paper, fibre) {
    var g = sized(cv, W, H, dpr);
    /* THE 0.7px OVERLAP, and it is a fix rather than a fudge. Two clips that
       share one boundary each antialias their own edge, so where they abut the
       alpha adds to less than 1 and a hairline crack was visible down an
       unbroken photograph a full second before anything tore. Each half is cut
       0.7px PAST the line instead, into territory the other half already owns.
       They still interlock exactly -- the shape is the same polyline -- and the
       overlap is invisible because both halves are opaque and identical there. */
    var off = -side * 0.7;
    g.save();
    g.beginPath();
    var edge = side < 0 ? -2 : W + 2;
    g.moveTo(edge, -2);
    traceTear(g, pts, H, false, off);
    g.lineTo(edge, H + 2);
    g.closePath();
    g.clip();
    g.drawImage(base, 0, 0, W, H);
    if (fibre) {
      g.globalCompositeOperation = "source-atop";
      g.lineCap = "round"; g.lineJoin = "round";
      g.beginPath(); traceTear(g, pts, H, true, off);
      g.lineWidth = 3.4; g.strokeStyle = paper; g.globalAlpha = 0.55; g.stroke();
      g.lineWidth = 1.4; g.globalAlpha = 1; g.stroke();
    }
    g.restore();
  }

  /* ── building the stage ────────────────────────────────────────────────────*/
  function card(cls) {
    var d = document.createElement("div");
    d.className = "lgPhoto" + (cls ? " " + cls : "");
    return d;
  }
  function canv(cls) {
    var c = document.createElement("canvas");
    if (cls) c.className = cls;
    c.setAttribute("aria-hidden", "true");
    return c;
  }

  function build(s, imgs) {
    var hero = document.querySelector(".hero");
    if (!hero) return false;
    var r = hero.getBoundingClientRect();
    if (r.height < 200) return false;

    wrap = document.createElement("div");
    wrap.className = "lgPhotos" + (reduced() ? " isRm" : "");
    wrap.setAttribute("aria-hidden", "true");
    document.body.appendChild(wrap);

    /* The paper is read off a computed probe rather than through
       getPropertyValue, which returns the specified token stream. This also
       means the card is whatever --theme-surface is right now, so it is #fff in
       the light theme and #111318 in the dark one without a second declaration
       anywhere -- and the torn core, being the same value, stays physically
       right in both. */
    var probe = document.createElement("i");
    probe.style.cssText = "position:absolute;width:60px;height:60px;"
      + "background-color:var(--theme-surface,#fff);border-top-left-radius:var(--r-lg,20px)";
    wrap.appendChild(probe);
    var cs = getComputedStyle(probe);
    var paper = cs.backgroundColor || "#fff";
    var rad = parseFloat(cs.borderTopLeftRadius);
    if (rad > 0 && rad < 60) RADIUS = rad;
    wrap.removeChild(probe);

    var A = card(), B = card("isB");
    wrap.appendChild(A); wrap.appendChild(B);

    /* Pin the card to WHOLE PIXELS before anything is drawn. --lgpH is a clamp
       against svh, so at 850px it resolves to 195.5 and the canvas backing store
       (an integer by definition) was being resampled up to it by CSS. Two
       identical-but-blurred halves still interlock, but the paper's hairline and
       the fibre edge both cost a fraction of their crispness for nothing. */
    var h0 = A.getBoundingClientRect().height || 180;
    var H = Math.max(100, Math.round(h0));
    var W = Math.round(H * 0.78);
    wrap.style.setProperty("--lgpH", H + "px");
    wrap.style.setProperty("--lgpW", W + "px");

    /* THE PAIR HANGS BY ITS FOOT, at 42% of the PITCH -- not of the window, and
       not by its centre. Above that line is the band the win call has just
       vacated; below it the heads are celebrating on the ground. Measured on a
       real quarter-final at 1512x850: the pitch starts at 92 and is 758 tall, so
       the cards end at 410, and the highest crown in the pile-up was 437. At
       390x844 the same fraction puts them at 196-378 against a ground at 560. */
    wrap.style.top = Math.round(r.top + r.height * 0.42 - H) + "px";
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    var sides = [
      { el: A, d: s.a, k: "a" },
      { el: B, d: s.b, k: "b" }
    ];
    live = { halves: null, tear: null, winner: null, loser: null, paper: paper, W: W, H: H, dpr: dpr };

    for (var i = 0; i < 2; i++) {
      var sd = sides[i];
      var base = paintCard(document.createElement("canvas"), imgs[sd.k], sd.d.col, W, H, dpr, paper);
      if (sd.k !== s.loser) { sd.el.appendChild(base); live.winner = sd.el; continue; }
      live.loser = sd.el;
      if (reduced()) { sd.el.appendChild(base); continue; }
      /* Both halves exist from this moment, stacked and un-moved. Nothing is
         swapped in later, so there is no frame where the picture changes
         identity. */
      var pts = tearPath(W, H);
      var hL = canv("hL"), hR = canv("hR");
      paintHalf(hL, base, pts, -1, W, H, dpr, paper, false);
      paintHalf(hR, base, pts, 1, W, H, dpr, paper, false);
      var t = document.createElement("div");
      t.className = "lgTear";
      t.appendChild(hL); t.appendChild(hR);
      sd.el.appendChild(t);
      live.tear = t;
      live.halves = { L: hL, R: hR, pts: pts, base: base };
    }
    return true;
  }

  function tear() {
    if (!live) return;
    if (live.winner) live.winner.classList.add("isSnap");
    if (live.loser && (reduced() || !live.halves)) {
      live.loser.classList.add("isTorn");
      return;
    }
    var h = live.halves;
    /* Repainted WITH the fibre edge at the instant of the break, not before:
       drawn up front it would have been a visible seam down an unbroken photo. */
    paintHalf(h.L, h.base, h.pts, -1, live.W, live.H, live.dpr, live.paper, true);
    paintHalf(h.R, h.base, h.pts, 1, live.W, live.H, live.dpr, live.paper, true);
    live.tear.classList.add("isFalling");
  }

  /* ── the run ───────────────────────────────────────────────────────────────*/
  function ok() {
    var c = document.body.classList;
    return c.contains("hmYowCup") && !c.contains("hmTourSim");
  }

  function load(s, cb) {
    var got = {}, n = 0, done = false;
    function one(k, src) {
      var im = new Image();
      im.onload = function () { got[k] = im; if (++n === 2 && !done) { done = true; cb(got); } };
      im.onerror = function () { if (!done) { done = true; cb(null); } };
      im.src = src;
    }
    one("a", s.a.src); one("b", s.b.src);
    /* A picture that has not decoded in 800ms is not going to be part of this
       beat. Nothing waits on it -- the fixture is already recorded. */
    after(800, function () { if (!done) { done = true; cb(null); } });
  }

  /* Wait for play-engine's big win call to leave the middle of the pitch. Its
     own timings belong to another file, so this measures the thing itself
     instead of copying them. */
  function whenCallClears(cb) {
    var waited = 0;
    var iv = setInterval(function () {
      waited += 100;
      var c = document.querySelector(".hmCount");
      var busy = false;
      try {
        busy = !!(c && c.textContent && parseFloat(getComputedStyle(c).opacity) > 0.04);
      } catch (_) {}
      if (!busy || waited >= WAIT_CAP) { clearInterval(iv); cb(); }
    }, 100);
    polls.push(iv);
  }

  function begin(s) {
    if (!ok()) return clear();
    load(s, function (imgs) {
      if (!imgs || !ok()) return clear();
      if (!build(s, imgs)) return clear();
      after(T_TEAR, function () { if (ok()) tear(); else clear(); });
      after(T_OUT, function () { if (live && live.winner) live.winner.classList.add("isGone"); });
      after(T_END, clear);
    });
  }

  /* One beat at a time, always: an armed beat replaces whatever was running. */
  function arm(s) {
    clear();
    after(WAIT_FROM, function () {
      if (!ok()) return clear();
      whenCallClears(function () { begin(s); });
    });
  }
  function fire(winSide) {
    var s = ok() ? snapshot(winSide) : null;
    if (s) arm(s);
  }

  /* ── the hook ──────────────────────────────────────────────────────────────*/
  function hook() {
    var orig = window.__hmTourWin;
    if (typeof orig !== "function" || orig.__lgp) return false;
    var wrapped = function (winSide) {
      /* T.cur FIRST -- the original clears it synchronously. */
      var s = null;
      try { s = ok() ? snapshot(winSide) : null; } catch (_) {}
      var out = orig.apply(this, arguments);   // the bracket, always, unconditionally
      try { if (s) arm(s); } catch (_) {}
      return out;
    };
    wrapped.__lgp = 1;
    window.__hmTourWin = wrapped;
    return true;
  }

  function boot() {
    if (!document.body) return;
    if (!hook()) {
      /* play-tournament.js is a classic script above this one so the global is
         already there; this is only for a load order that changes under us. */
      var n = 0, iv = setInterval(function () {
        if (hook() || ++n > 40) clearInterval(iv);
      }, 100);
    }
    /* The cup ending, the pitch coming down, or a simulation starting all take
       the beat with them -- immediately, with no timer to wait for. That is the
       whole answer to "what if the bracket moves on first". */
    try {
      new MutationObserver(function () {
        if (!wrap && !timers.length && !polls.length) return;
        var c = document.body.classList;
        if (!c.contains("hmYowCup") || c.contains("hmTourSim") || !c.contains("hmSoccer")) clear();
      }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    } catch (_) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  /* For the contracts and for driving the beat without winning a match. */
  window.__lgPhotos = { fire: fire, clear: clear };
})();
