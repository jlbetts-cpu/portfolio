/* ── THE FOOTER BAND ─────────────────────────────────────────────────────────
   Jayden: "instead of a Jayden Betts on the bottom could we add the same
   gradient found on the workspace with the nice water physics and ascii
   animations end to end ... and then having a Jayden Betts in the middle
   background color but with some inner shadow so it has some depth and looks
   like its encased in the gradient."

   So the closing wordmark stops being ink on white and becomes a full-bleed
   band: the Workspace's warped metaball mesh, its glyph field over the top, and
   his name knocked through both in the page's own ground colour.

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

   THE THREE LAYERS, AND WHY THE MARK IS A SECOND CANVAS.
     1  .footBandField   the mesh and the glyphs. Redrawn on the 30fps clock.
     2  .footBandMark    his name, filled with the page's ground colour, with a
                         real inner shadow inside every letterform. STATIC --
                         it changes on resize and on a theme change and never on
                         a frame -- so the compositor blends it for free and the
                         loop never touches it.
     3  .footMark        the DOM text. Invisible once layer 2 is live. It still
                         owns the METRICS (footer.css sizes it at 100cqw over a
                         measured font advance) and it is what you see if this
                         file never runs, so the band degrades to a flat
                         gradient with a flat knockout rather than to nothing.

   THE INNER SHADOW IS NOT A CAST SHADOW, and the distinction is the site's most
   absolute rule. Nothing here is lifted off the page: the shadow is drawn INSIDE
   the letterforms, is composited source-atop so it cannot escape them, and is
   translucent black -- so what you actually see inside the letter's top edge is
   the band's own gradient, darkened. That is "encased in the gradient" read
   literally. There is no box-shadow, no drop-shadow and no elevation anywhere in
   this file or in the rules it turns on.

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
 var markCv = band.querySelector(".footBandMark");
 var mark = band.querySelector(".footMark");
 if (!fieldCv || !markCv || !mark) return;
 if (typeof fieldCv.getContext !== "function") return;
 var fx = fieldCv.getContext("2d");
 var mx = markCv.getContext("2d");
 if (!fx || !mx) return;

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
 /* The inner shadow, in em of the mark. Both are read from CSS so the depth is a
    design value living with the palette rather than a literal in here. */
 var insetBlur = .020, insetOff = .014, riseAlpha = .10;

 /* ── state. Nothing below is read from the DOM inside the loop ───────────── */
 var boxW = 0, boxH = 0, ratio = 1;
 var cols = 0, rows = 0, phase = new Float32Array(0);
 var meshW = 0, meshH = 0, meshCv = null, meshCtx = null, meshData = null;
 var ptrX = .5, ptrY = .5, act = 0, actTo = 0, actAt = 0;
 var originX = 0, originY = 0;  /* the band's viewport rect, banked on resize+scroll */
 var visible = false, hidden = false, running = 0, lastDraw = 0;
 var timeBase = 0, pausedAt = 0;
 var strength = 1;
 /* THE PALETTE IS ELEVEN NUMBERS AND THEY ALL CROSS-FADE. A theme change on this
    site takes --theme-duration and every other colour in the footer travels with
    it; a full-bleed band that SNAPPED between two grounds in the middle of that
    is the "abrupt brightness jump" section 14 of the Apple reference names, on
    the largest surface on the page. So the palette is held as from/to pairs and
    walked on the site's own --ease-out, which is the same thing the Hero field
    does with the sky. Packed flat rather than as objects because it is lerped on
    a drawn frame and there is no reason to allocate there. */
 var PAL_N = 12;
 var palFrom = new Float32Array(PAL_N), palTo = new Float32Array(PAL_N), pal = new Float32Array(PAL_N);
 var palStart = 0, palDur = 0, palHave = false, markPaint = 0;
 var base = [14, 15, 18], tones = [[27, 30, 36], [42, 46, 54], [18, 20, 25]];
 var glyphInk = [244, 245, 247], insetInk = "rgba(0,0,0,.55)", pageInk = "#fdfdfd";
 var insetShade = [0, 0, 0], insetAlpha = .58;
 var drawMs = 0, worstMs = 0, drawn = 0, glyphs = 0, samples = 0, jitterSum = 0;
 var times = [];
 var fontReady = false, markLive = false;
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

 function readColour(expr, fallback) {
  probe.style.color = "";
  probe.style.color = expr;
  var got = window.getComputedStyle(probe).color;
  var m = /rgba?\(([^)]+)\)/.exec(got || "");
  if (!m) return fallback;
  var parts = m[1].split(/[\s,\/]+/);
  var out = [parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2])];
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
  var pg = readColour("var(--theme-page)", [253, 253, 253]);
  var alpha = parseFloat(style.getPropertyValue("--foot-band-inset-alpha"));
  if (!isFinite(alpha)) alpha = .55;
  insetShade = readColour("var(--foot-band-inset)", [0, 0, 0]);
  var i, src = [b0[0], b0[1], b0[2], t1[0], t1[1], t1[2], t2[0], t2[1], t2[2],
                gl[0], gl[1], gl[2]];
  for (i = 0; i < PAL_N; i++) palFrom[i] = palHave ? pal[i] : src[i];
  for (i = 0; i < PAL_N; i++) palTo[i] = src[i];
  /* tone 3, the page ground and the inset alpha ride along in the same walk */
  tone3To = t3; pageTo = pg; alphaTo = alpha;
  if (!palHave) { tone3From = t3; pageFrom = pg; alphaFrom = alpha; }
  else { tone3From = tone3.slice(); pageFrom = pageRgb.slice(); alphaFrom = insetAlpha; }
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
  var bl = parseFloat(style.getPropertyValue("--foot-band-inset-blur"));
  var of = parseFloat(style.getPropertyValue("--foot-band-inset-offset"));
  var ri = parseFloat(style.getPropertyValue("--foot-band-inset-rise"));
  if (isFinite(bl)) insetBlur = bl;
  if (isFinite(of)) insetOff = of;
  if (isFinite(ri)) riseAlpha = ri;
 }

 var tone3 = [18, 20, 25], tone3From = tone3.slice(), tone3To = tone3.slice();
 var pageRgb = [253, 253, 253], pageFrom = pageRgb.slice(), pageTo = pageRgb.slice();
 var alphaFrom = .58, alphaTo = .58;

 function settlePalette(now) {
  var k = palDur > 0 ? (now - palStart) / palDur : 1;
  var done = k >= 1;
  var e = done ? 1 : bezier(.22, 1, .36, 1, k < 0 ? 0 : k);
  var i;
  for (i = 0; i < PAL_N; i++) pal[i] = palFrom[i] + (palTo[i] - palFrom[i]) * e;
  base = [pal[0], pal[1], pal[2]];
  tones = [[pal[3], pal[4], pal[5]], [pal[6], pal[7], pal[8]], tone3];
  for (i = 0; i < 3; i++) {
   tone3[i] = tone3From[i] + (tone3To[i] - tone3From[i]) * e;
   pageRgb[i] = pageFrom[i] + (pageTo[i] - pageFrom[i]) * e;
  }
  tones[2] = tone3;
  glyphInk = [pal[9], pal[10], pal[11]];
  insetAlpha = alphaFrom + (alphaTo - alphaFrom) * e;
  pageInk = "rgb(" + (pageRgb[0] | 0) + "," + (pageRgb[1] | 0) + "," + (pageRgb[2] | 0) + ")";
  insetInk = "rgba(" + (insetShade[0] | 0) + "," + (insetShade[1] | 0) + "," +
             (insetShade[2] | 0) + "," + insetAlpha.toFixed(3) + ")";
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
  markCv.width = fieldCv.width;
  markCv.height = fieldCv.height;
  mx.setTransform(ratio, 0, 0, ratio, 0, 0);

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

 /* ── the mark: a knockout with a real inner shadow ────────────────────────
    THE LETTERFORMS ARE THE PAGE'S OWN GROUND COLOUR, which is what he asked for
    -- "a Jayden Betts in the middle background color". Because the fill is
    literally --theme-page it reads as a hole cut through the band, and it
    follows a theme change with no colour matching of any kind.

    THE INNER SHADOW IS THE CANONICAL CANVAS RECIPE, and it is the reason this
    layer is a canvas at all: text cannot take an inset box-shadow, and the two
    CSS routes both fail on the same thing -- a background-clip:text gradient
    shades by HEIGHT, so at 200px it puts a convincing shadow on the J and the
    B and none at all on the e, the a and the o, whose tops are at x-height.
    A shadow that only lands on two of twelve letters is worse than none. So:
      1. the inverse of the type (a filled rect with the letters punched out)
      2. the letters, filled with the page ground
      3. the inverse drawn back over them, blurred and offset DOWN, composited
         source-atop -- which clips it to the letters, so the only thing that
         survives is the soft dark the surrounding surface casts into the top
         inside edge of every letterform, whatever shape that letter is.
    Offset down, because the light on this site comes from above; a recess lit
    from above is dark at its top edge and open at its bottom. */
 function buildMark() {
  if (!boxW || !boxH) return;
  /* THE MARK LAYER IS BUILT IN DEVICE PIXELS, with the transform left at
     identity, because shadowBlur and shadowOffsetY are NOT in the current
     transform's coordinate space -- they are canvas units. Under a
     setTransform(dpr) they silently mean half what they say on a 2x screen,
     which is the sort of thing that reads as "the shadow is a bit weak" and
     never as a bug. Everything below is therefore multiplied by ratio once, in
     one place, and the field layer keeps its scaled transform because it draws
     no shadows at all. */
  mx.setTransform(1, 0, 0, 1, 0, 0);
  mx.clearRect(0, 0, markCv.width, markCv.height);
  markLive = false;
  band.classList.remove("is-marked");
  if (!fontReady) return;

  var cs = window.getComputedStyle(mark);
  var rect = mark.getBoundingClientRect();
  var target = mark.clientWidth;
  if (!target) return;
  var weight = cs.fontWeight || "600";
  var family = cs.fontFamily || '"Geist", sans-serif';
  var tracking = parseFloat(cs.letterSpacing);
  var declared = parseFloat(cs.fontSize) || 100;
  if (!isFinite(tracking)) tracking = 0;
  var trackEm = declared ? tracking / declared : 0;
  var spacing = "letterSpacing" in mx;

  /* THE FIT IS RE-DERIVED HERE RATHER THAN TRUSTED. footer.css sizes the DOM
     text at 100cqw over --foot-mark-fit, a font advance measured by hand off a
     Range at 1440 -- 5.9807 for Geist 600 at --tr-display. It is right, and it
     is also a constant that goes stale the moment the string, the weight or the
     tracking changes. measureText answers the same question exactly, at this
     width, in this font, so the canvas asks it: set the type at a reference
     size, read the advance, and scale. The CSS constant stays the authority for
     the height this band RESERVES and for what you see if this file never runs. */
  var REF = 200;
  function setFont(ctx, size) {
   if (spacing) ctx.letterSpacing = (trackEm * size).toFixed(3) + "px";
   ctx.font = weight + " " + size + 'px ' + family;
  }
  setFont(mx, REF);
  var advance = mx.measureText("Jayden Betts").width;
  if (!(advance > 0)) return;
  var size = REF * (target * ratio / advance);   /* device px */
  setFont(mx, size);

  /* The baseline the DOM text would have used, from the font's own metrics:
     CSS puts half the leading above the content area, so the baseline sits at
     (lineHeight - (ascent + descent)) / 2 + ascent below the line box top.
     Geist's content area is 1.30em against a --lh-display line box of 1.0, so
     that half-leading is NEGATIVE here and the ink overflows the box at both
     ends -- which is exactly why the band's padding is measured off the ink and
     not off the line box. */
  var m = mx.measureText("Jayden Betts");
  var asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
  if (!isFinite(asc) || !isFinite(desc) || asc <= 0) { asc = size * 1.005; desc = size * .295; }
  var lineH = (rect.height || size / ratio) * ratio;
  var left = (rect.left - originX) * ratio;
  var top = (rect.top - originY) * ratio;
  var baseline = top + (lineH - (asc + desc)) / 2 + asc;

  var blur = size * insetBlur, off = size * insetOff;
  var inv = document.createElement("canvas");
  inv.width = markCv.width; inv.height = markCv.height;
  var ic = inv.getContext("2d");
  if (!ic) return;
  /* The plate is the whole canvas, not a strip around the line box. Geist's ink
     overflows a --lh-display line box at both ends, so a strip sized off the box
     needs a padding term nobody would ever check again; the full rect cannot be
     too small and costs one fill. */
  ic.fillStyle = "#000";
  ic.fillRect(0, 0, inv.width, inv.height);
  ic.globalCompositeOperation = "destination-out";
  ic.textAlign = "left";
  ic.textBaseline = "alphabetic";
  setFont(ic, size);
  ic.fillStyle = "#000";
  ic.fillText("Jayden Betts", left, baseline);

  mx.textAlign = "left";
  mx.textBaseline = "alphabetic";
  mx.globalCompositeOperation = "source-over";
  mx.fillStyle = pageInk;
  mx.fillText("Jayden Betts", left, baseline);
  /* THE PLATE IS DRAWN OFF-CANVAS AND ONLY ITS SHADOW COMES BACK. Shifting the
     image by -far and the shadow by +far lands the shadow exactly where the
     plate would have been while the plate's own body falls outside the canvas.
     Without that, the plate's opaque black sits on every antialiased glyph edge;
     source-atop weights it by the edge's partial alpha and the result is a hard
     dark fringe right round every letter -- an outline, which is a different
     claim from depth and a much cheaper-looking one. */
  var far = inv.width * 2;
  mx.globalCompositeOperation = "source-atop";
  mx.shadowColor = insetInk;
  mx.shadowBlur = blur;
  mx.shadowOffsetX = far;
  mx.shadowOffsetY = off;
  mx.drawImage(inv, -far, 0);
  /* AND THE COUNTER-LIGHT, which is what turns a dark top edge from a smudge
     into a floor. A recess lit from above is shaded where the surface overhangs
     it and CATCHES that light on the lip opposite, so the same plate is cast
     back up: same blur, offset the other way, in the page's own colour at a
     tenth the strength. It is the second half of one lighting statement, not a
     second effect, which is why it shares the blur and inverts only the sign. */
  if (riseAlpha > 0) {
   mx.shadowColor = "rgba(255,255,255," + riseAlpha + ")";
   mx.shadowBlur = blur;
   mx.shadowOffsetY = -off;
   mx.drawImage(inv, -far, 0);
  }
  mx.shadowColor = "rgba(0,0,0,0)";
  mx.shadowBlur = 0;
  mx.shadowOffsetX = 0;
  mx.shadowOffsetY = 0;
  mx.globalCompositeOperation = "source-over";
  markLive = true;
  band.classList.add("is-marked");
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
   /* The mark layer is static EXCEPT while the palette is walking, because the
      letterforms are the page ground and the page ground is one of the things
      moving. Rebuilt every other drawn frame -- six repaints across a 400ms
      theme change, which is under a millisecond each and invisible, against
      twelve that would be exactly as invisible and cost twice. */
   if (palDur > 0) {
    var settled = settlePalette(now);
    if (settled || (markPaint = (markPaint + 1) & 1) === 0) buildMark();
   }
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
  buildMark();
  if (visible && !hidden) { repaint(); start(); }
 }

 /* THE BORDER BOX, NOT contentRect, AND THIS ONE COST A WHOLE SCREENSHOT. The
    canvases are inset:0 / 100%x100%, so they cover the band's PADDING box;
    contentRect is the CONTENT box and excludes the band's padding-block. Sizing
    a 249px-tall canvas element's backing store to the 201px content box does not
    error, it does not clip, and it does not look like a bug in the numbers -- it
    stretches the whole picture vertically by 1.24 and reads as a soft focus on
    the wordmark. Counting said "fits: true"; looking said the type was blurred.  */
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
  buildMark();
  if (visible && !hidden) { repaint(); start(); }
 }

 if (window.SiteTheme && typeof window.SiteTheme.subscribe === "function") {
  window.SiteTheme.subscribe(function () { retarget(false); });
 }
 window.addEventListener("jbthemesettle", function () { retarget(true); });

 readPalette(true);
 resized(band.clientWidth, band.clientHeight);

 /* The mark cannot be drawn before Geist has loaded: canvas text falls back to
    the system face silently and the fit is then measured against the wrong font,
    which lands the wordmark short of both edges. So the knockout waits, and the
    DOM text carries the band until it arrives. */
 function fontsIn() { fontReady = true; buildMark(); }
 if (document.fonts && typeof document.fonts.load === "function") {
  try {
   document.fonts.load('600 200px "Geist"', "Jayden Betts").then(fontsIn, fontsIn);
  } catch (err) { fontsIn(); }
  if (document.fonts.ready && typeof document.fonts.ready.then === "function") {
   document.fonts.ready.then(fontsIn, fontsIn);
  }
 } else { fontsIn(); }

 window.FooterBand = {
  /* Exposed so a contract -- and a designer sweeping the inset by eye -- can
     repaint the knockout after changing a custom property, without a reload. */
  rebuild: function () {
   readPalette(true); measure(); buildMark();
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
    act: act, markLive: markLive, fontReady: fontReady,
    /* The live palette, so a contract can watch the theme cross-fade without
       screenshotting it. A screenshot takes long enough in a headless browser
       that a 400ms tween is over before the pixels come back, and a test that
       cannot see the middle of a transition reports every transition as a snap. */
    pageInk: pageInk, glyph: [glyphInk[0] | 0, glyphInk[1] | 0, glyphInk[2] | 0],
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
