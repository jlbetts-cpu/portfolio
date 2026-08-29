/* ═══════════════════════════════════════════════════════════════════════════
   league-hat.js -- the referee's cap on the Jayden head.

   Jayden: "could you realistically put this referee hat on the jayden head
   keeping in mind realistic shadow."

   WHY THIS IS A STANDALONE FILE. Nothing in the DOM marks the mini-Jayden: he
   is `peer.__filler` in play-engine's closure and carries no class, so CSS
   cannot reach him. Adding one would mean editing a 6,000-line engine that two
   other agents are working in tonight. He is identifiable without a flag, twice
   over, and both tests read only what the engine already renders.

   HOW HE IS FOUND, AND THE TWO WRONG ANSWERS THAT CAME FIRST.
   (1) MATCHING HIS BAKED CUT DOES NOT WORK. window.__hmFillerData() RE-BAKES
   the portrait on every call, so the data: URL it hands back is a fresh encode
   and never byte-equal to the one the live head was spawned with. Measured: cut
   length 26039, zero hits among 216 image-painting divs on a pitch he was
   standing on.
   (2) SCANNING FOR THE WIDEST PAINTED BACKGROUND FINDS HIS REFLECTION, NOT HIM.
   A head is three siblings of `.hero` -- `.hmRefl`, `.hmShadow`, then the root
   -- and the ROOT paints nothing: its face is an `<img>` child (or, for him, a
   live clone). The only one of the three carrying a background-image is the
   reflection. Measured on a 1512x850 match: the hat was landing inside a
   162x194 `.hmRefl`, which is why it rendered in the wrong box.
   So a head root is now identified structurally -- an absolutely-positioned DIV
   child of `.hero` that carries its own transform-origin and whose first child
   is an IMG -- and HE is the one whose root carries a cloned `.stage`.
   spawnCompanion() gives that clone to the mirror head and to nothing else:
   measured at 390x844, one root out of six had it, and it was the 96x115 one in
   a field of 64x77. His documented 1.5x size is kept as the fallback test for
   the no-clone render.

   WHERE THE CAP SITS, AND WHY IT IS NOT HALFWAY UP HIS FOREHEAD.
   His ink does not fill his box, so no number here may be a fraction of the box.
   The clone is a square of the head's own width, dropped 27% inside a 5:6 root,
   and his portrait's ink runs 0.212..0.807 across and 0.111..0.901 down it --
   MEASURED off the alpha channel the browser is painting, not read off
   `data-head-bounds`, which is a loose envelope and 0.049 of the box too high at
   the top. Everything below is expressed against that rectangle, so recutting
   the portrait moves the cap with it. This is the same class of offset that put
   his crown 36px above his hair (play-engine.js, _MJ_HB) and a second pair of
   eyes in it (e33531e).
   The cap is hung INSIDE the clone rather than on the root, which is what makes
   that arithmetic sound: percentages inside the clone resolve against the same
   box the portrait is drawn in, so the clone's own 27% drop and 83.333% height
   cancel instead of having to be re-derived. It is still a descendant of the
   root, so it inherits the tumble for free -- screenshotted at -17deg and on a
   live frame at -9.3deg with a 0.955/1.05 squash, cap riding both.

   THE SHADOW IS ON HIM, NOT UNDER HIM. CLAUDE.md's rule is absolute: the only
   thing on this site that casts a contact shadow is a companion head standing
   on something. A hat is not chrome and it is not standing on the ground -- it
   is part of the picture of his head, and a real peak throws a soft shade onto
   the brow beneath it. So what is drawn is an occlusion band ON HIS FACE under
   the brim, narrower than his temples, and nothing at all falls onto the pitch.
   It very nearly did not reach him at all: see the z-index note in league.css.

   NOT DONE, AND ON PURPOSE: his REFLECTION is bare-headed. It is a silhouette
   painted from `data.cut`, not a clone of the rig, so nothing added to the head
   appears in it -- the champion's crown has the same gap and has shipped that
   way. Adding the cap there means re-deriving the placement in the bake's own
   5:6 coordinates for something drawn at =<34% opacity under a ripple.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var SRC = "images/ref-hat.webp";

  /* The cap art is 320x210 with transparent margins; these are its own ink
     rectangle, measured off the file's alpha channel (43,16)-(277,185). The
     element is positioned by where its INK lands, not by where its box does,
     exactly as the head is. */
  var ART_L = 43 / 320, ART_T = 16 / 210, ART_R = 277 / 320, ART_B = 185 / 210;
  var ART_AR = 210 / 320;

  /* The two tuned numbers, both in units of HIS OWN MEASURED INK, so they hold at
     any head size, any viewport and any recut of the portrait.
     CAP_W -- the cap's box as a multiple of his ink width. The peak is 0.731 of
     that box, so 1.17 puts the peak at 0.855 of his head's width: wider than his
     skull, narrower than the hair-and-ears rectangle, which is what a cap looks
     like from the front. 1.30 was tried first and read as a crash helmet.
     SEAT -- where the peak's FRONT EDGE lands, measured down from his ink top in
     units of his ink height. His brows are at 0.455 of it and his eyes at 0.514
     (the engine's own marks, verified against the bitmap in e33531e), so 0.405
     rests the brim a twentieth of his head above the brows and leaves both eyes
     clear.
     The brim edge is the anchor rather than the crown because it is the edge a
     viewer reads: too high and the cap floats, too low and he is blindfolded.
     Where the crown lands then follows from the art's own aspect. */
  var CAP_W = 1.17, SEAT = 0.405;

  var on = false, timer = null;

  /* `data-head-bounds` is "left top right bottom" as fractions of the portrait's
     own box. Refuse anything that is not four numbers in order and in range
     rather than flinging the cap off-screen -- same guard the engine's crown
     correction uses. */
  function bounds(img) {
    if (!img) return null;
    var a = img.getAttribute("data-head-bounds");
    if (!a) return null;
    var p = String(a).trim().split(/\s+/), v = [], i, n;
    if (p.length !== 4) return null;
    for (i = 0; i < 4; i++) { n = parseFloat(p[i]); if (!(n >= 0 && n <= 1)) return null; v.push(n); }
    if (!(v[2] > v[0] && v[3] > v[1])) return null;
    return v;
  }

  /* HIS DECLARED BOUNDS ARE NOT HIS INK, AND THE CAP CANNOT USE THEM.
     `data-head-bounds` reads 0.1933 0.0616 0.8484 0.9234, but the alpha channel
     of images/neutral.webp measures 0.2122 0.1110 0.8073 0.9012 -- the attribute
     is a loose envelope, and its top is 0.049 of the box HIGH. Placed against it
     the cap cleared his hair by a tenth of his head and read as a helmet, which
     is what the first render showed. So the ink is measured off the artwork the
     browser is actually painting.
     Scanned at 160x160 rather than 820x820: 25k pixels instead of 672k, and the
     result is still good to 0.006 of the box, which is a third of a pixel on the
     head as rendered. MEASURED ONCE AND KEPT -- his expression changes the face
     inside the outline, not the outline, and re-scanning per frame would make
     the cap twitch every time he smiles. */
  var INK = null, inkTried = false;
  function scanInk(img) {
    if (INK || inkTried) return INK;
    if (!img || !img.complete || !img.naturalWidth) return null;
    inkTried = true;
    try {
      var N = 160, c = document.createElement("canvas");
      c.width = N; c.height = N;
      var g = c.getContext("2d");
      g.drawImage(img, 0, 0, N, N);
      var d = g.getImageData(0, 0, N, N).data;
      var l = N, t = N, r = -1, b = -1, x, y;
      for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
        if (d[(y * N + x) * 4 + 3] > 24) {
          if (x < l) l = x; if (x > r) r = x;
          if (y < t) t = y; if (y > b) b = y;
        }
      }
      if (r < l || b < t) return null;
      INK = [l / N, t / N, (r + 1) / N, (b + 1) / N];
    } catch (_) { INK = null; }   /* a tainted canvas falls back to the attribute */
    return INK;
  }

  /* A head root: a DIV child of the pitch that spawnCompanion() built -- absolute,
     with its own transform-origin, and with the face IMG as its first child.
     Those three are written together in one cssText and nothing else under
     `.hero` carries all three: the reflection and the shadow have no children at
     all, the HP bar's child is an <i>, and the lava, race and camera wrappers
     hold divs.
     DELIBERATELY NOT TESTED: the class. An earlier version required it to be
     EMPTY, which is true of a freshly spawned root and stopped being true the
     moment anything else touched it -- including the probe that parks him for a
     screenshot, which is how this was caught: the hat vanished 600ms after the
     head was pinned, because the next sweep no longer recognised its own host. */
  function heads() {
    var host = document.querySelector(".hero");
    if (!host) return [];
    var kids = host.children, out = [], i, e;
    for (i = 0; i < kids.length; i++) {
      e = kids[i];
      if (e.nodeType !== 1 || e.tagName !== "DIV") continue;
      if (e.style.position !== "absolute" || !e.style.transformOrigin) continue;
      if (!e.firstElementChild || e.firstElementChild.tagName !== "IMG") continue;
      if (!e.offsetWidth || !e.offsetHeight) continue;
      out.push(e);
    }
    return out;
  }

  function findHim() {
    var hs = heads(), i, st, widest = null, ws = [];
    for (i = 0; i < hs.length; i++) {
      /* The mirror clone. It is a copy of #stage with every id stripped, so the
         class is what survives -- and the page's own #stage is not a child of a
         head root, so there is nothing to confuse it with. */
      st = hs[i].querySelector(":scope > .stage");
      if (st) return hs[i];
      ws.push({ el: hs[i], w: hs[i].offsetWidth });
    }
    /* No clone: this is the fallback render, where his face is the baked cut on
       the root's own img. Then his SIZE is the marker -- CLAUDE.md, "the
       mini-Jayden head is 1.5x bigger than the others on purpose". 1.25 sits
       clear of the little heads' own spread and well under his 1.5. */
    if (ws.length < 2) return null;
    ws.sort(function (a, b) { return a.w - b.w; });
    var med = ws[Math.floor(ws.length / 2)].w;
    widest = ws[ws.length - 1];
    return (med > 0 && widest.w >= med * 1.25) ? widest.el : null;
  }

  /* Where his face is drawn, and where his INK is inside it. Two renders:
     - the mirror clone, a square box with the portrait drawn edge to edge, so
       data-head-bounds applies to it directly;
     - the fallback, where bakeMiniCut() has drawn the square portrait into the
       root's 5:6 frame and seated his chin on window.__hmFOOT. There the same
       fractions have to be scaled by 5/6 and shifted, and the shift is DERIVED
       from the foot plane rather than written down, because __hmFOOT measured
       0.9318 against its own 0.945 default the moment it was instrumented. */
  function face(root) {
    var st = root.querySelector(":scope > .stage"), img, b;
    if (st) {
      img = st.querySelector("img.face") || st.querySelector("img");
      b = scanInk(img) || bounds(img);
      return b ? { host: st, ink: b } : null;
    }
    /* The fallback render: no clone, and his face is the baked cut on the root's
       own img -- already drawn into the 5:6 frame and already seated on the foot
       plane, so a scan of it lands in root coordinates with nothing to map.
       Only the attribute needs mapping, and its shift is DERIVED from the foot
       plane rather than written down: __hmFOOT measured 0.9318 against its own
       0.945 default the moment it was instrumented (e33531e), so a constant here
       would go stale exactly the way that one did.
       NOT EXERCISED by anything that ships -- every spawn site carries __mirror
       and therefore the clone -- so this branch is reasoning, not observation. */
    img = root.querySelector(":scope > img");
    b = scanInk(img);
    if (b) return { host: root, ink: b };
    var b2 = bounds(img);
    if (!b2) return null;
    var K = 5 / 6, foot = +window.__hmFOOT;
    if (!(foot > 0.5 && foot < 1)) foot = 0.945;
    var B = foot - b2[3] * K;
    return { host: root, ink: [b2[0], b2[1] * K + B, b2[2], b2[3] * K + B] };
  }

  function fit(root) {
    var f = face(root);
    if (!f) return null;
    var host = f.host, ink = f.ink;
    var inkW = ink[2] - ink[0], inkH = ink[3] - ink[1], inkCx = (ink[0] + ink[2]) / 2;

    var hat = host.querySelector(":scope > .lgRefHat");
    if (!hat) {
      hat = document.createElement("div");
      hat.className = "lgRefHat";
      hat.setAttribute("aria-hidden", "true");
      hat.style.backgroundImage = "url(" + SRC + ")";
      var sh = document.createElement("i");
      sh.className = "lgRefHatShade";
      hat.appendChild(sh);
      host.appendChild(hat);   /* last, so it paints over the face it is worn on */
    }

    /* The box, from his ink width; then the height the art's aspect gives it.
       `host` is square on the clone path and 5:6 on the fallback, so a height in
       PERCENT would mean two different things -- everything vertical is written
       against the host's WIDTH and the aspect is carried by the ratio below. */
    var W = CAP_W * inkW;                       /* of the host's width */
    var Hh = W * ART_AR;                        /* also of the host's WIDTH */
    var hostAR = host.offsetHeight / (host.offsetWidth || 1);   /* px per px */
    var Hpc = hostAR > 0 ? Hh / hostAR : Hh;    /* the same height, in host-height % */

    /* Land the peak's front edge SEAT down his ink, then back out the art's own
       transparent margin below it to get the box's top edge. Left is the same
       trick sideways: the cap's ink is centred on HIS ink centre (0.510, not
       0.5 -- the portrait sits slightly right of its frame), not its box on his
       box. */
    var top = (ink[1] + SEAT * inkH) - ART_B * Hpc;
    var left = inkCx - W * (ART_L + ART_R) / 2;

    hat.style.width = (W * 100).toFixed(3) + "%";
    hat.style.height = (Hpc * 100).toFixed(3) + "%";
    hat.style.left = (left * 100).toFixed(3) + "%";
    hat.style.top = (top * 100).toFixed(3) + "%";
    return hat;
  }

  function sweep() {
    if (!on) return;
    var root = findHim(), hat = root ? fit(root) : null;
    /* Anything left over from a previous spawn -- or from a head that stopped
       being the one -- goes. He is despawned and re-spawned across a cup. */
    var all = document.querySelectorAll(".lgRefHat"), i;
    for (i = 0; i < all.length; i++) {
      if (all[i] !== hat && all[i].parentNode) all[i].parentNode.removeChild(all[i]);
    }
  }

  function start() {
    if (timer) return;
    /* A poll rather than a MutationObserver: he is spawned, despawned and
       re-spawned across a cup, and his element is REPLACED rather than mutated,
       so there is no single node to observe. 600ms is under the eye's threshold
       for "the hat was late" and costs one pass over `.hero`'s children. */
    sweep();
    timer = setInterval(sweep, 600);
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    var hats = document.querySelectorAll(".lgRefHat");
    for (var i = 0; i < hats.length; i++) {
      if (hats[i].parentNode) hats[i].parentNode.removeChild(hats[i]);
    }
  }

  function sync() {
    var want = document.body.classList.contains("hmYowCup");
    if (want === on) return;
    on = want;
    if (on) start(); else stop();
  }

  function boot() {
    if (!document.body) return;
    try {
      new MutationObserver(sync).observe(document.body,
        { attributes: true, attributeFilter: ["class"] });
    } catch (_) {}
    sync();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.__lgHat = { sweep: sweep, find: findHim, fit: fit };
})();
