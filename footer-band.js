/* ── THE FOOTER BAND ─────────────────────────────────────────────────────────
   Jayden: "instead of a Jayden Betts on the bottom could we add the same
   gradient found on the workspace with the nice water physics and ascii
   animations end to end ... and then having a Jayden Betts in the middle
   background color but with some inner shadow so it has some depth and looks
   like its encased in the gradient."
   And, 2026-08-20: "i would prefer if the footer matched with the time of day
   and the insert shadow wasnt that much it just feels too strong right now I
   think we should remove the name and make it like half the height so its just
   a nice ending to the site in a beautiful way."

   The second note spends half of the first. What this file paints now is the
   half he asked to keep: a full-bleed band of the Workspace's warped metaball
   mesh with its glyph field over the top, end to end on every page, at half the
   height and tinted by the hour. The wordmark, the knockout and the inner shadow
   that shaded it are gone -- and gone rather than turned down, because the
   shadow existed only to shade the inside of letterforms that no longer exist.
   There is now NO SHADOW OF ANY KIND in this file. The site's most absolute
   rule is that the companion heads cast a contact shadow and nothing else does;
   the inner shadow was a sanctioned exception Jayden asked for by name, and with
   the letters deleted the exception is spent and the rule is simply whole again.
   footer-band-contract asserts the absence on both contexts, not just the field.

   THIS IS THE THIRD COPY OF THE WORKSPACE'S FIELD AND THE FIRST SHARED ONE.
   The original is React, in workspace/assets/index-Bjpj2J7U.js. The second is
   the Hero's, an inline script in index.html gated to one ellipse. This one runs
   on eight pages, so it is a file rather than a script block, and it carries the
   one thing neither of the others needs: it is BELOW THE FOLD ON EVERY PAGE, so
   an IntersectionObserver stops the loop outright rather than a scroll
   subtraction pausing it. A band nobody has scrolled to costs nothing at all.

   WHAT IS THE ORIGINAL'S AND IS NOT RE-DERIVED HERE. Every number in the two
   blocks marked ── WORKSPACE ── is read out of that bundle: the nine-step ramp
   with two blanks at the bottom, the 21px cell, the six drifting gaussians, the
   6.2 falloff and .06 floor, the alpha law (.11 + .62*b) * w, the +/-2.2px
   per-glyph jitter, the domain-warped fbm that makes the mesh move like water,
   the breath, the mouse ripple, and the extra metaball the cursor drags with it.

   WHAT IS THIS SITE'S. The colour -- the Workspace's mesh is brand blue and blue
   is dead here, so the palette is the site's ink family and it is read out of
   CSS so the two themes own it. The 30fps clock, the still frame under reduced
   motion with the jitter FROZEN rather than zeroed, and the "loop reads nothing
   from the DOM" discipline all come from the Hero's port, which learned them the
   expensive way; see the comment block above the field in index.html.

   ONE LAYER NOW, WHERE THERE WERE THREE.
     .footBandField   the mesh and the glyphs, redrawn on the 30fps clock.
   The two that went were .footBandMark -- his name knocked out of the band with
   an inner shadow inside every letterform -- and .footMark, the DOM text that
   carried the band's height and the metrics that canvas was measured against.
   That second dependency is why footer.css now declares a height: the band used
   to be as tall as the wordmark plus its padding, and with no wordmark an
   undeclared height is zero, because this canvas is inset:0 and takes the box
   rather than making it.
   WHAT THE DEGRADED PICTURE IS, with this file blocked or broken: .footBand's
   own three-stop CSS gradient, off the same palette mixed here, at the same
   height and with the same time-of-day tint. The band goes still, not missing --
   which is the same answer it gave before, minus a wordmark.

   THE KILL SWITCH IS --foot-band-strength, exactly like the Hero's
   --ascii-strength: set it to 0 on .footBand and the loop stops, the field
   canvas clears, and the band falls back to the CSS gradient with the knockout
   still on it. It is a plain number and not a clamp() on purpose -- a custom
   property comes back as its SPECIFIED token stream, so a clamp() here would
   arrive as the literal string and parseFloat would hand back NaN. */
(function () {
 "use strict";

 var root = document.documentElement;
 var band = document.querySelector(".footBand");
 if (!band) return;
 var fieldCv = band.querySelector(".footBandField");
 if (!fieldCv) return;
 if (typeof fieldCv.getContext !== "function") return;
 var fx = fieldCv.getContext("2d");
 if (!fx) return;

 /* ── WORKSPACE: the glyph field ──────────────────────────────────────────── */
 var CELL = 21;                 /* the bundle's cell pitch, in CSS px */
 var RAMP = "  ·:-+=*#";        /* nine steps, TWO blanks. Do not close the gap. */
 var FALLOFF = 6.2, FLOOR = 0.06;
 var BLOBS = [
  { bx: .66, by: .24, ax: .20, ay: .16, fx: 1.6, fy: 1.9, ph: 0,   p2: 1.3, heat: 1 },
  { bx: .90, by: .40, ax: .18, ay: .16, fx: 2.1, fy: 1.5, ph: 1.7, p2: 0.4, heat: .74 },
  { bx: .22, by: .30, ax: .20, ay: .15, fx: 1.4, fy: 2.0, ph: 2.6, p2: 2.0, heat: .55 },
  { bx: .58, by: .66, ax: .22, ay: .16, fx: 2.3, fy: 1.7, ph: 0.7, p2: 2.6, heat: 1 },
  { bx: .86, by: .78, ax: .18, ay: .16, fx: 2.0, fy: 1.6, ph: 3.1, p2: 1.5, heat: .72 },
  { bx: .30, by: .80, ax: .23, ay: .17, fx: 1.7, fy: 2.1, ph: 4.2, p2: 0.8, heat: .70 }
 ];
 /* The cursor terms, also the bundle's: an influence radius in NORMALISED units
    (so it is an ellipse in pixels, not a circle -- that anisotropy is the
    original's), a 7px push away from the pointer, and a .4 brightness lift added
    to b BEFORE the ramp index so the cursor picks denser characters as well as
    brighter ones. PUSH is pixels, not cells: the bundle adds it straight to a
    pixel coordinate, and it transfers unscaled only because this file's CELL is
    also 21. If CELL moves, PUSH moves with it. */
 var REACH = .36, PUSH = 7, LIFT = .4;
 var STATIC_T = 6;              /* the frame reduced motion is shown, as in the original */

 /* ── WORKSPACE: the mesh ─────────────────────────────────────────────────────
    The gradient is not a CSS gradient and could not be: what makes it read as
    water is a DOMAIN WARP -- the metaball field is sampled at a point that has
    itself been displaced by two octaves of fbm noise, which is why the blobs
    stretch and fold instead of sliding. Those are the shader's numbers.
    It is evaluated on a COARSE buffer and blown up bilinearly. That is not a
    shortcut taken to save time; the warped field's own smallest feature is about
    a third of the band wide, so a sample every ~24px carries all of it, and it
    turns a per-pixel shader into about 700 samples a frame. */
 var WARP_SCALE = 2.3, WARP_AMP = .26, WARP_Q = 1.7;
 /* THREE OCTAVES, NOT THE SHADER'S FOUR, and this is sampling theory rather than
    a saving. The shader runs per pixel; this runs on a 24px grid, and the fourth
    octave's period at that scale is ~25px down the band's short axis -- below the
    Nyquist limit of the buffer it is written into, so it does not add detail, it
    aliases into a different pattern every frame. Measured on the band at 1440:
    four octaves p95 6.7ms / worst 25.8ms, three octaves p95 4.0ms / worst 4.6ms,
    and the two pictures differ by a mean of 4/255. Detail nobody can resolve, at
    a 40% p95 and a 5x worst case. */
 var OCTAVES = 3;
 var MESH_PITCH = 24;           /* CSS px between mesh samples */
 var BREATH_AMP = .13, BREATH_RATE = .45, ZOOM_AMP = .05, ZOOM_RATE = .4;
 var RIPPLE_K = 26, RIPPLE_RATE = 3.2, RIPPLE_FALL = 5, RIPPLE_AMP = .065;
 var MOUSE_BLOB = 1.3;          /* the extra metaball the cursor drags with it */
 var SATURATE = 1.34;
 var MESH_MAX = 1400;           /* and a hard ceiling on how many there may be */

 /* ── THIS SITE ───────────────────────────────────────────────────────────── */
 var FRAME_MS = 33;             /* 30fps. See the Hero's port for why this is not
                                   a compromise: the fastest term here moves a
                                   glyph about 2px per SECOND. */
 var ACT_RISE = 160 / 3, ACT_FALL = 500 / 3;   /* 95% of the way is 3 time constants */

 /* ── state. Nothing below is read from the DOM inside the loop ───────────── */
 var boxW = 0, boxH = 0, ratio = 1;
 var cols = 0, rows = 0, phase = new Float32Array(0);
 var meshW = 0, meshH = 0, meshCv = null, meshCtx = null, meshData = null;
 var ptrX = .5, ptrY = .5, act = 0, actTo = 0, actAt = 0;
 var originX = 0, originY = 0;  /* the band's viewport rect, banked on resize+scroll */
 var visible = false, hidden = false, running = 0, lastDraw = 0;
 var timeBase = 0, pausedAt = 0;
 var strength = 1;
 /* THE PALETTE CROSS-FADES, IT DOES NOT SNAP. A theme change on this
    site takes --theme-duration and every other colour in the footer travels with
    it; a full-bleed band that SNAPPED between two grounds in the middle of that
    is the "abrupt brightness jump" section 14 of the Apple reference names, on
    the largest surface on the page. So the palette is held as from/to pairs and
    walked on the site's own --ease-out, which is the same thing the Hero field
    does with the sky. Packed flat rather than as objects because it is lerped on
    a drawn frame and there is no reason to allocate there. */
 var PAL_N = 12;
 var palFrom = new Float32Array(PAL_N), palTo = new Float32Array(PAL_N), pal = new Float32Array(PAL_N);
 var palStart = 0, palDur = 0, palHave = false;
 var base = [14, 15, 18], tones = [[27, 30, 36], [42, 46, 54], [18, 20, 25]];
 var glyphInk = [244, 245, 247];
 var drawMs = 0, worstMs = 0, drawn = 0, glyphs = 0, samples = 0, jitterSum = 0;
 var times = [];
 var clock = (window.performance && window.performance.now)
  ? function () { return window.performance.now(); }
  : function () { return Date.now(); };

 function reduced() { return root.getAttribute("data-reduced-motion") === "reduce"; }

 /* ── simplex noise, the shader's own (Ashima/Gustavson 2D) ───────────────── */
 var PERM = new Uint8Array(512);
 (function () {
  /* A FIXED permutation, not Math.random(). The mesh has to look the same on
     every page and on every reload -- a random table would make the band a
     different picture each time it was drawn, which is the sort of thing that
     only shows up in a screenshot diff two weeks later. */
  var p = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,
   142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,
   35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,
   139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,
   245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,
   196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,
   202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,
   170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,
   98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,
   144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,
   184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,
   141,128,195,78,66,215,61,156,180];
  for (var i = 0; i < 512; i++) PERM[i] = p[i & 255];
 })();
 var GRAD2 = [1,1, -1,1, 1,-1, -1,-1, 1,0, -1,0, 1,0, -1,0, 0,1, 0,-1, 0,1, 0,-1];
 var F2 = .5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;

 function snoise(xin, yin) {
  var s = (xin + yin) * F2;
  var i = Math.floor(xin + s), j = Math.floor(yin + s);
  var t = (i + j) * G2;
  var x0 = xin - (i - t), y0 = yin - (j - t);
  var i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
  var x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
  var x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
  var ii = i & 255, jj = j & 255, n = 0, g, t0, t1, t2;
  t0 = .5 - x0 * x0 - y0 * y0;
  if (t0 > 0) { t0 *= t0; g = (PERM[ii + PERM[jj]] % 12) * 2; n += t0 * t0 * (GRAD2[g] * x0 + GRAD2[g + 1] * y0); }
  t1 = .5 - x1 * x1 - y1 * y1;
  if (t1 > 0) { t1 *= t1; g = (PERM[ii + i1 + PERM[jj + j1]] % 12) * 2; n += t1 * t1 * (GRAD2[g] * x1 + GRAD2[g + 1] * y1); }
  t2 = .5 - x2 * x2 - y2 * y2;
  if (t2 > 0) { t2 *= t2; g = (PERM[ii + 1 + PERM[jj + 1]] % 12) * 2; n += t2 * t2 * (GRAD2[g] * x2 + GRAD2[g + 1] * y2); }
  return 70 * n;
 }

 function fbm(x, y) {
  var v = 0, a = .5, i;
  for (i = 0; i < OCTAVES; i++) { v += a * snoise(x, y); x = x * 2 + 17.3; y = y * 2 + 17.3; a *= .5; }
  return v;
 }

 /* The plain metaball field, unwarped. The glyph layer samples this and the mesh
    samples it at a warped point -- which is the original's arrangement, not a
    simplification: the two layers are deliberately not locked together. */
 function field(px, py, t) {
  var num = 0, den = FLOOR, i, b, dx, dy, w;
  for (i = 0; i < 6; i++) {
   b = BLOBS[i];
   dx = px - (b.bx + b.ax * Math.sin(t * b.fx + b.ph));
   dy = py - (b.by + b.ay * Math.cos(t * b.fy + b.p2));
   w = Math.exp(-(dx * dx + dy * dy) * FALLOFF);
   num += w * b.heat; den += w;
  }
  return num / den;
 }

 /* ── colour, read through a probe rather than through getPropertyValue ─────
    A custom property comes back as its SPECIFIED token stream, so
    getPropertyValue("--foot-band-tone-1") on a value written as
    var(--theme-elevated) hands back the literal string "var(--theme-elevated)".
    The probe is a real element taking a real property, so what comes back is a
    resolved rgb() every time and the palette can be written in tokens. */
 var probe = document.createElement("span");
 probe.setAttribute("aria-hidden", "true");
 probe.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
 band.appendChild(probe);

 /* AND IT COMES BACK IN TWO SERIALISATIONS, NOT ONE. This cost a whole pass and
    it is the exact shape of bug this project keeps meeting: the CSS read
    correctly and did nothing.
    A resolved colour is `rgb(r g b)` with 0-255 channels while it stays in the
    legacy sRGB lane. Nest one color-mix inside another -- which is what the
    time-of-day cast does, casting a tone that is itself a mix of ink and page --
    and Chrome serialises the computed value as `color(srgb r g b)` with 0-1
    FLOATS instead. The old regex here matched `rgba?\(` only, so every tone
    missed, every read fell through to the fallback, and the renderer painted the
    hard-coded constants at the top of this file on every page and in every
    state. Nothing errored. The band still looked like a band -- it was the
    palette from before the tokens existed -- and only a per-state hue comparison
    could see it: the tokens said sunset was warm and the painted band was blue.
    So both forms are parsed, and the float form is scaled. Do not "simplify"
    this back to one branch. */
 function readColour(expr, fallback) {
  probe.style.color = "";
  probe.style.color = expr;
  var got = String(window.getComputedStyle(probe).color || "");
  var m = /rgba?\(([^)]+)\)/.exec(got);
  var scale = 1;
  if (!m) {
   m = /color\(\s*srgb\s+([^)]+)\)/.exec(got);
   scale = 255;
  }
  if (!m) return fallback;
  var parts = m[1].split(/[\s,\/]+/);
  var out = [parseFloat(parts[0]) * scale, parseFloat(parts[1]) * scale,
             parseFloat(parts[2]) * scale];
  if (!isFinite(out[0]) || !isFinite(out[1]) || !isFinite(out[2])) return fallback;
  return out;
 }

 /* The sky's easing, solved rather than approximated. cubic-bezier(.22,1,.36,1)
    spends most of its travel in the first third, and a linear tween against
    everything else on the page reads as the band lagging. */
 function bezier(x1, y1, x2, y2, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  var t = x, i, cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  var cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by, f, d;
  for (i = 0; i < 8; i++) {
   f = ((ax * t + bx) * t + cx) * t - x;
   if (f < 1e-5 && f > -1e-5) break;
   d = (3 * ax * t + 2 * bx) * t + cx;
   if (d < 1e-6 && d > -1e-6) break;
   t = t - f / d;
  }
  if (t < 0) t = 0; else if (t > 1) t = 1;
  return ((ay * t + by) * t + cy) * t;
 }

 function themeDuration() {
  var raw = String(window.getComputedStyle(root).getPropertyValue("--theme-duration")).trim();
  var v = parseFloat(raw) || 0;
  return /ms$/i.test(raw) ? v : v * 1000;
 }

 function readPalette(instant) {
  var style = window.getComputedStyle(band);
  var raw = parseFloat(style.getPropertyValue("--foot-band-strength"));
  strength = isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 1;
  var b0 = readColour("var(--foot-band-base)", base);
  var t1 = readColour("var(--foot-band-tone-1)", tones[0]);
  var t2 = readColour("var(--foot-band-tone-2)", tones[1]);
  var t3 = readColour("var(--foot-band-tone-3)", tones[2]);
  var gl = readColour("var(--foot-band-glyph)", glyphInk);
  var i, src = [b0[0], b0[1], b0[2], t1[0], t1[1], t1[2], t2[0], t2[1], t2[2],
                gl[0], gl[1], gl[2]];
  for (i = 0; i < PAL_N; i++) palFrom[i] = palHave ? pal[i] : src[i];
  for (i = 0; i < PAL_N; i++) palTo[i] = src[i];
  /* tone 3 rides along in the same walk. It sits outside the flat array only
     because PAL_N was sized before it existed; the tween is the same tween. */
  tone3To = t3;
  if (!palHave) tone3From = t3;
  else tone3From = tone3.slice();
  palStart = clock();
  palDur = (instant || !palHave || reduced()) ? 0 : themeDuration();
  palHave = true;
  /* Snap only when there is nothing to walk. Calling this unconditionally is
     what a first draft did, and it forced e=1 and cleared palDur on the same
     tick -- the tween existed, ran for zero frames, and the band snapped between
     two grounds while every other colour in the footer cross-faded. The contract
     samples at 25% of --theme-duration precisely because that is invisible in a
     before/after screenshot and obvious in a sampled one. */
  if (palDur <= 0) settlePalette(palStart + 1);
 }

 var tone3 = [18, 20, 25], tone3From = tone3.slice(), tone3To = tone3.slice();

 function settlePalette(now) {
  var k = palDur > 0 ? (now - palStart) / palDur : 1;
  var done = k >= 1;
  var e = done ? 1 : bezier(.22, 1, .36, 1, k < 0 ? 0 : k);
  var i;
  for (i = 0; i < PAL_N; i++) pal[i] = palFrom[i] + (palTo[i] - palFrom[i]) * e;
  base = [pal[0], pal[1], pal[2]];
  tones = [[pal[3], pal[4], pal[5]], [pal[6], pal[7], pal[8]], tone3];
  for (i = 0; i < 3; i++) tone3[i] = tone3From[i] + (tone3To[i] - tone3From[i]) * e;
  tones[2] = tone3;
  glyphInk = [pal[9], pal[10], pal[11]];
  if (done) palDur = 0;
  return done;
 }

 /* ── measure ─────────────────────────────────────────────────────────────── */
 function measure() {
  ratio = Math.min(window.devicePixelRatio || 1, 2);
  fieldCv.width = Math.max(1, Math.round(boxW * ratio));
  fieldCv.height = Math.max(1, Math.round(boxH * ratio));
  fx.setTransform(ratio, 0, 0, ratio, 0, 0);
  fx.textAlign = "center";
  fx.textBaseline = "middle";
  fx.font = '12px "Geist", ui-sans-serif, system-ui, sans-serif';

  cols = Math.ceil(boxW / CELL) + 1;
  rows = Math.ceil(boxH / CELL) + 1;
  var n = cols * rows;
  if (phase.length !== n) {
   phase = new Float32Array(n);
   for (var i = 0; i < n; i++) phase[i] = Math.random() * Math.PI * 2;
  }

  /* The mesh buffer. Its pitch is a target, not a rule: the ceiling is what
     keeps a 2560-wide band from paying for 2,600 warped samples a frame. */
  var mw = Math.max(2, Math.ceil(boxW / MESH_PITCH) + 1);
  var mh = Math.max(2, Math.ceil(boxH / MESH_PITCH) + 1);
  if (mw * mh > MESH_MAX) {
   var k = Math.sqrt(MESH_MAX / (mw * mh));
   mw = Math.max(2, Math.round(mw * k));
   mh = Math.max(2, Math.round(mh * k));
  }
  if (!meshCv) meshCv = document.createElement("canvas");
  if (mw !== meshW || mh !== meshH) {
   meshW = mw; meshH = mh;
   meshCv.width = mw; meshCv.height = mh;
   meshCtx = meshCv.getContext("2d");
   meshData = meshCtx ? meshCtx.createImageData(mw, mh) : null;
  }
  samples = meshW * meshH;
  bankOrigin();
 }

 function bankOrigin() {
  var r = band.getBoundingClientRect();
  originX = r.left; originY = r.top;
 }

 /* ── the mesh ────────────────────────────────────────────────────────────── */
 function drawMesh(seconds) {
  if (!meshData || !meshCtx) return;
  var px = meshData.data;
  var t = seconds * .1;
  var breath = 1 + BREATH_AMP * Math.sin(seconds * BREATH_RATE);
  var zoom = 1 + ZOOM_AMP * Math.sin(seconds * ZOOM_RATE);
  var amp = WARP_AMP * breath;
  var mAct = act, mX = ptrX, mY = ptrY;
  var ix = 0, r, c, u, v, ub, vb, qx, qy, wx, wy;
  var md, ripple, nx, ny, num0, num1, num2, den, i, b, dx, dy, w, cr, cg, cb, lum;
  for (r = 0; r < meshH; r++) {
   v = meshH > 1 ? r / (meshH - 1) : .5;
   for (c = 0; c < meshW; c++) {
    u = meshW > 1 ? c / (meshW - 1) : .5;
    ub = (u - .5) * zoom + .5;
    vb = (v - .5) * zoom + .5;
    qx = fbm(ub * WARP_SCALE + t, vb * WARP_SCALE + t);
    qy = fbm(ub * WARP_SCALE + 5.2 - t, vb * WARP_SCALE + 1.3 - t);
    wx = ub + fbm(ub * WARP_SCALE + WARP_Q * qx + t * .6, vb * WARP_SCALE + WARP_Q * qy + t * .6) * amp;
    wy = vb + fbm(ub * WARP_SCALE + WARP_Q * qx + 3.7 - t, vb * WARP_SCALE + WARP_Q * qy + 1.9 - t) * amp;
    if (mAct > .01) {
     dx = u - mX; dy = v - mY;
     md = Math.sqrt(dx * dx + dy * dy);
     ripple = Math.sin(md * RIPPLE_K - seconds * RIPPLE_RATE) * Math.exp(-md * RIPPLE_FALL) * mAct * RIPPLE_AMP;
     if (md > 1e-4) { nx = dx / md; ny = dy / md; wx += nx * ripple; wy += ny * ripple; }
    }
    num0 = base[0] * FLOOR; num1 = base[1] * FLOOR; num2 = base[2] * FLOOR; den = FLOOR;
    for (i = 0; i < 6; i++) {
     b = BLOBS[i];
     dx = wx - (b.bx + b.ax * Math.sin(t * b.fx + b.ph));
     dy = wy - (b.by + b.ay * Math.cos(t * b.fy + b.p2));
     w = Math.exp(-(dx * dx + dy * dy) * FALLOFF);
     cr = tones[i % 3];
     num0 += w * cr[0]; num1 += w * cr[1]; num2 += w * cr[2]; den += w;
    }
    if (mAct > .01) {
     dx = wx - mX; dy = wy - mY;
     w = mAct * Math.exp(-(dx * dx + dy * dy) * FALLOFF) * MOUSE_BLOB;
     cr = tones[0];
     num0 += w * cr[0]; num1 += w * cr[1]; num2 += w * cr[2]; den += w;
    }
    cr = num0 / den; cg = num1 / den; cb = num2 / den;
    lum = .299 * cr + .587 * cg + .114 * cb;
    cr = lum + (cr - lum) * SATURATE; cg = lum + (cg - lum) * SATURATE; cb = lum + (cb - lum) * SATURATE;
    px[ix] = cr < 0 ? 0 : cr > 255 ? 255 : cr;
    px[ix + 1] = cg < 0 ? 0 : cg > 255 ? 255 : cg;
    px[ix + 2] = cb < 0 ? 0 : cb > 255 ? 255 : cb;
    px[ix + 3] = 255;
    ix += 4;
   }
  }
  meshCtx.putImageData(meshData, 0, 0);
  fx.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in fx) fx.imageSmoothingQuality = "high";
  fx.drawImage(meshCv, 0, 0, meshW, meshH, 0, 0, boxW, boxH);
 }

 /* ── the glyphs ──────────────────────────────────────────────────────────── */
 function drawGlyphs(seconds) {
  var drift = seconds * .1;
  var head = "rgba(" + (glyphInk[0] | 0) + "," + (glyphInk[1] | 0) + "," + (glyphInk[2] | 0) + ",";
  var row, col, cy, cx, px, py, g, b, h, ix, glyph, wob, alpha, jx, jy;
  var infl, dx, dy, dist, push, ox, oy;
  jitterSum = 0;
  for (row = 0; row < rows; row++) {
   cy = row * CELL + CELL / 2;
   py = cy / boxH;
   for (col = 0; col < cols; col++) {
    cx = col * CELL + CELL / 2;
    px = cx / boxW;
    g = field(px, py, drift);
    if (g < 0) g = 0; else if (g > 1) g = 1;
    infl = 0; jx = 0; jy = 0;
    if (act > .01) {
     dx = px - ptrX; dy = py - ptrY;
     dist = Math.sqrt(dx * dx + dy * dy);
     infl = Math.max(0, 1 - dist / REACH) * act;
     if (infl > 0 && dist > 1e-4) { push = infl * PUSH; jx = dx / dist * push; jy = dy / dist * push; }
    }
    b = g + infl * LIFT;
    if (b > 1) b = 1;
    h = phase[row * cols + col];
    ix = (b + .17 * Math.sin(seconds * 1.1 + h)) * RAMP.length | 0;
    if (ix < 0) ix = 0; else if (ix >= RAMP.length) ix = RAMP.length - 1;
    glyph = RAMP.charAt(ix);
    if (glyph === " ") continue;
    wob = .5 + .5 * Math.sin(seconds * 1.3 + h * 1.3);
    alpha = (.11 + .62 * b) * wob * strength;
    if (alpha < .02) continue;
    /* THE JITTER IS EVALUATED EVEN ON THE STILL FRAME. The original multiplies
       it by zero under reduced motion and the result is every glyph pinned to
       the 21px grid -- a lattice you can count rows and columns in, not grain.
       Frozen at t=6 the same term is a fixed per-glyph offset: no motion, and
       the character survives. Section 14 of the Apple reference asks for a
       gentler equivalent, not a different picture. */
    ox = 2.2 * Math.sin(seconds * .9 + h);
    oy = 2.2 * Math.cos(seconds * .8 + h * 1.2);
    /* Banked so the still frame can be CHECKED rather than asserted in a
       comment. Zeroing the jitter and freezing it produce two frames that are
       both perfectly static, so a diff of two frames cannot tell them apart --
       but one is grain and the other is a lattice you can count rows in. This
       is two adds per glyph and it is the only thing that can see the
       difference from outside. */
    jitterSum += (ox < 0 ? -ox : ox) + (oy < 0 ? -oy : oy);
    jx += cx + ox;
    jy += cy + oy;
    fx.fillStyle = head + alpha.toFixed(3) + ")";
    fx.fillText(glyph, jx, jy);
    glyphs++;
   }
  }
 }

 function draw(seconds) {
  fx.clearRect(0, 0, boxW, boxH);
  glyphs = 0;
  if (boxW <= 0 || boxH <= 0) return;
  /* THE KILL SWITCH STOPS THE WHOLE FIELD, not just the glyphs. On the Hero,
     --ascii-strength:0 leaves a sky behind; here the field canvas IS the band's
     surface, so zero means the canvas stays empty and .footBand's own CSS
     gradient -- the three-stop still of this same palette -- is what you see,
     with the knockout still on top of it. One line, and the band goes quiet
     without going missing. */
  if (strength <= .001) return;
  drawMesh(seconds);
  drawGlyphs(seconds);
 }

 /* ── the loop ────────────────────────────────────────────────────────────── */
 /* REPAINT IS NOT THE SAME CALL AS THE STILL FRAME, and conflating them put a
    t=6 frame on screen for one tick every time the band was resized or the theme
    changed -- a visible jump backwards in a field whose whole point is that it
    never jumps. still() is the reduced-motion picture; repaint() is "draw now,
    at the clock you are actually on". */
 function still() {
  draw(STATIC_T);
 }

 function repaint() {
  if (reduced()) { still(); return; }
  draw(((pausedAt || clock()) - timeBase) / 1000);
 }

 function frame(now) {
  running = 0;
  if (!visible || hidden) return;
  if (strength <= .001) { fx.clearRect(0, 0, boxW, boxH); return; }
  if (reduced()) { still(); return; }
  /* The activation is a time-constant chase, not a boolean. The bundle's ASCII
     layer reads a hard 0/1 and gets away with it because its band is full-bleed
     and the pointer is always inside it; what fades there is the WebGL mesh
     underneath, whose own loop runs T += (a - T) * .04 per frame. Here the two
     layers are one canvas, so the mesh's law governs both -- written in dt form
     so it does not change meaning at 30fps, and split, because a field that took
     half a second to notice you would read as lag while a fast collapse when you
     leave would read as a switch being thrown. */
  var dt = actAt ? Math.min(200, now - actAt) : 0;
  actAt = now;
  if (dt > 0) {
   var tau = actTo > act ? ACT_RISE : ACT_FALL;
   act += (actTo - act) * (1 - Math.exp(-dt / tau));
  }
  if (now - lastDraw >= FRAME_MS) {
   lastDraw = now;
   /* THE PALETTE IS ADVANCED ON THE DRAWN FRAME, not on a timer of its own, so
      the ground the mesh is mixed from and the mesh itself are always the same
      instant. settlePalette clears palDur when it lands, which is what the
      contract reads to prove a tween was scheduled rather than snapped. */
   if (palDur > 0) settlePalette(now);
   var t0 = clock();
   draw((now - timeBase) / 1000);
   drawMs = clock() - t0;
   drawn++;
   if (drawMs > worstMs) worstMs = drawMs;
   times.push(drawMs);
   if (times.length > 600) times.shift();
  }
  running = requestAnimationFrame(frame);
 }

 function start() {
  if (!visible || hidden) return;
  if (strength <= .001) { fx.clearRect(0, 0, boxW, boxH); return; }
  if (reduced()) { still(); return; }
  if (pausedAt) { timeBase += clock() - pausedAt; pausedAt = 0; }
  actAt = 0;
  if (!running) running = requestAnimationFrame(frame);
 }

 function stop() {
  if (running) cancelAnimationFrame(running);
  running = 0;
  if (!pausedAt) pausedAt = clock();
 }

 /* ── wiring ──────────────────────────────────────────────────────────────── */
 function resized(w, h) {
  if (w === boxW && h === boxH && ratio === Math.min(window.devicePixelRatio || 1, 2)) return;
  boxW = w; boxH = h;
  measure();
  if (visible && !hidden) { repaint(); start(); }
 }

 /* THE BORDER BOX, NOT contentRect, AND THIS ONE COST A WHOLE SCREENSHOT. The
    canvas is inset:0 / 100%x100%, so it covers the band's PADDING box;
    contentRect is the CONTENT box and excluded the band's padding-block. Sizing
    a 249px-tall canvas element's backing store to the 201px content box did not
    error, did not clip, and did not look like a bug in the numbers -- it
    stretched the whole picture vertically by 1.24 and read as a soft focus on
    the wordmark. Counting said "fits: true"; looking said the type was blurred.
    THE BAND HAS NO PADDING TODAY, so the two boxes happen to agree and this
    looks like a difference that stopped mattering. It is not: the band's height
    is a declared clamp, the day anything puts padding back the two diverge
    silently again, and borderBoxSize is right either way. Kept deliberately. */
 if (typeof ResizeObserver === "function") {
  new ResizeObserver(function (entries) {
   var e = entries[0];
   if (!e) return;
   var w, h, bs = e.borderBoxSize;
   if (bs && bs.length) { w = bs[0].inlineSize; h = bs[0].blockSize; }
   else if (bs && bs.inlineSize) { w = bs.inlineSize; h = bs.blockSize; }
   else { w = band.clientWidth; h = band.clientHeight; }
   resized(Math.ceil(w), Math.ceil(h));
  }).observe(band);
 } else {
  resized(band.clientWidth, band.clientHeight);
 }

 /* THE BAND IS BELOW THE FOLD ON ALL EIGHT PAGES, so this is the one thing this
    port needs that the Hero's does not: while it is off screen the loop does not
    exist. The Hero's field can get away with a scroll subtraction because the
    Hero is the first thing in the document and never moves; this band's position
    depends on everything above it. */
 if (typeof IntersectionObserver === "function") {
  new IntersectionObserver(function (entries) {
   var e = entries[0];
   if (!e) return;
   var next = e.isIntersecting;
   if (next === visible) return;
   visible = next;
   if (visible) { bankOrigin(); start(); } else stop();
  }, { rootMargin: "120px 0px" }).observe(band);
 } else {
  visible = true; start();
 }

 document.addEventListener("visibilitychange", function () {
  hidden = document.hidden;
  if (hidden) stop(); else start();
 });

 /* The pointer writes three numbers and nothing else. The band's viewport rect
    is banked on resize and rAF-throttled on scroll, so a mouse move never forces
    a layout -- performance-idle-contract measures index.html at 56 forced reads
    a second against a budget of 70, and a rect per pointermove would have been
    the single largest source on the page. */
 var scrollPending = 0;
 window.addEventListener("scroll", function () {
  if (scrollPending || !visible) return;
  scrollPending = requestAnimationFrame(function () { scrollPending = 0; bankOrigin(); });
 }, { passive: true });
 window.addEventListener("resize", function () { bankOrigin(); }, { passive: true });

 window.addEventListener("pointermove", function (e) {
  if (!visible || !boxW || !boxH) return;
  var u = (e.clientX - originX) / boxW;
  var v = (e.clientY - originY) / boxH;
  if (u < 0 || u > 1 || v < 0 || v > 1) { actTo = 0; return; }
  ptrX = u; ptrY = v; actTo = 1;
 }, { passive: true });
 band.addEventListener("pointerleave", function () { actTo = 0; }, { passive: true });
 window.addEventListener("blur", function () { actTo = 0; });

 function retarget(instant) {
  readPalette(instant === true);
  if (visible && !hidden) { repaint(); start(); }
 }

 if (window.SiteTheme && typeof window.SiteTheme.subscribe === "function") {
  window.SiteTheme.subscribe(function () { retarget(false); });
 }
 window.addEventListener("jbthemesettle", function () { retarget(true); });

 readPalette(true);
 resized(band.clientWidth, band.clientHeight);

 /* NO FONT GATE ANY MORE, and it is worth recording that this is a deletion and
    not an oversight. The gate existed for the knockout only: canvas text falls
    back to the system face silently, so a fit measured before Geist arrived
    landed the wordmark short of both edges. The field never waited for it and
    still does not -- its ramp is nine punctuation glyphs at 12px, whose advance
    the layout does not depend on, because each one is drawn centred in its own
    21px cell rather than laid out in a run. */

 window.FooterBand = {
  /* Exposed so a contract -- and a designer sweeping the inset by eye -- can
     repaint the knockout after changing a custom property, without a reload. */
  rebuild: function () {
   readPalette(true); measure();
   if (visible && !hidden) { repaint(); start(); }
  },
  /* One deterministic frame at a named clock time. The band's whole picture is a
     pure function of t, the palette and the box, so this is what lets a contract
     compare two builds pixel for pixel instead of watching an animation. */
  frameAt: function (t) { draw(t); },
  probe: function (reset) {
   var sorted = times.slice().sort(function (a, b) { return a - b; });
   var p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] : 0;
   var out = {
    w: boxW, h: boxH, cols: cols, rows: rows, cell: CELL,
    mesh: meshW + "x" + meshH, samples: samples, glyphs: glyphs,
    running: !!running, visible: visible, strength: strength,
    act: act,
    /* The live palette, so a contract can watch the theme cross-fade without
       screenshotting it. A screenshot takes long enough in a headless browser
       that a 400ms tween is over before the pixels come back, and a test that
       cannot see the middle of a transition reports every transition as a snap. */
    glyph: [glyphInk[0] | 0, glyphInk[1] | 0, glyphInk[2] | 0],
    /* palDur is the tween that was SCHEDULED, in ms. It is the deterministic
       form of "the band cross-fades rather than snapping": a snap is palDur 0,
       and it can be read the instant the theme changes without waiting for a
       frame -- which matters, because on a loaded machine rAF drops to 8fps and
       a 400ms walk gets two samples. */
    tweening: palDur > 0, palDur: palDur,
    jitter: glyphs ? jitterSum / glyphs : 0,
    drawMs: drawMs, worstMs: worstMs, p95: p95, drawn: drawn
   };
   if (reset) { worstMs = 0; drawn = 0; times = []; }
   return out;
  }
 };
})();
