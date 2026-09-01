/* ═══════════════════════════════════════════════════════════════════════════
   league-hat.js -- the referee's cap on the Jayden head.

   Jayden: "could you realistically put this referee hat on the jayden head
   keeping in mind realistic shadow."

   WHY THIS IS A STANDALONE FILE. Nothing in the DOM marks the mini-Jayden: he
   is `peer.__filler` in play-engine's closure and carries no class, so CSS
   cannot reach him. Adding one would mean editing a 6,000-line engine that two
   other agents are working in tonight. He is identifiable without a flag, twice
   over, and both tests read only what the engine already renders.

   IT IS THE BIG HEAD'S CAP, NOT THE MINI'S.  2026-08-31
   Jayden: "the big jayden head should be the one with the ref hat not the
   playing mini jayden head."
   IT WAS ON THE MINI, AND THAT WAS THE WRONG JOKE. The mini-Jayden is a PLAYER
   -- he is on the team sheet, he is tackled, he scores. A player in a
   referee's cap is a costume. The BIG head is the one that is not playing: he
   comes down over the centre spot, hands the ball to the match and leaves,
   which is what an official does, and he is on screen largest at exactly that
   moment. One referee is the joke; two would be noise, so the mini keeps
   nothing -- the sweep below removes every .lgRefHat that is not the one it
   just placed, so his comes off on the first pass after this change.

   FINDING HIM IS NOW TRIVIAL, AND THE THREE WRONG ANSWERS THAT CAME BEFORE ARE
   KEPT HERE BECAUSE THEY WERE ANSWERS TO A HARDER QUESTION -- "which of eight
   identical spawned roots is the mini" -- WHICH NO LONGER HAS TO BE ASKED.
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
   (3) STRUCTURE PLUS THE CLONE identified him correctly and is what shipped.
   The big head needs none of it: he is `#stage`, he is in the markup of
   play.html, and his id is unique on the page. The one thing to be careful of
   is WHERE he is -- during the ball-drop ceremony play-engine borrows
   `#stageMorph` out of `.stagewrap` and into `.hmDropper` for 1.2s (see
   headDropIn), so a query rooted at `.stagewrap` would lose him for exactly the
   second the cap is most visible. getElementById follows him wherever he is
   moved, and the cap is a child of his own `.stage`, so it goes with him.

   WHERE THE CAP SITS, AND WHY IT IS NOT HALFWAY UP HIS FOREHEAD.
   His ink does not fill his box, so no number here may be a fraction of the box.
   `#stage` is a square (aspect-ratio:1) with the portrait drawn edge to edge in
   it, and that portrait's ink runs 0.212..0.807 across and 0.113..0.900 down it
   -- MEASURED off the alpha channel the browser is painting, not read off
   `data-head-bounds`, which is a loose envelope and 0.049 of the box too high at
   the top. Everything below is expressed against that rectangle, so recutting
   the portrait moves the cap with it. This is the same class of offset that put
   his crown 36px above his hair (play-engine.js, _MJ_HB) and a second pair of
   eyes in it (e33531e).
   THE CAP IS HUNG INSIDE `.stage` rather than on `#stageMorph` above it, which
   is what makes that arithmetic sound: percentages inside `.stage` resolve
   against the same square the portrait is drawn in, so there is nothing to
   re-derive. It is a descendant, so it inherits every transform on the way down
   for free -- the dropper's own translate/rotate ceremony included.
   IT IS APPENDED LAST, AND THE EYES ARE APPENDED AFTER IT. hero-engine's
   buildEyes() does stage.appendChild() on every face change, so the live eye
   rig ends up in front of the cap in paint order. That is the right way round:
   the brim sits above his brows and never overlaps an eye, and the brow shade
   is meant to darken skin, not to be drawn over an iris.

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

  var on = false, timer = null, faceObs = null;

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
     head as rendered.
     CACHED PER SOURCE IMAGE, NOT ONCE FOR ALL TIME.  2026-08-31
     The old cache took the FIRST face it could scan and kept it forever, on the
     stated grounds that "his expression changes the face inside the outline,
     not the outline". That is measured false, and it did not matter while the
     cap rode the mini's mirror; it matters now that it rides the head that
     actually emotes. Measured off the alpha channels at 160x160:
       neutral / neutral_browsup / neutral_closed  .2125 .1125 .8063 .9000
       rest / rest_closed                          .2125 .1187 .8063 .9125
       smile / smile_closed                        .2375 .1437 .7812 .8812
       wink / wink_closed                          .1938 .0625 .8438 .9250
     -- wink's crown is 0.050 of the box above smile's, which is 13px on a 260px
     dropper. Keying the cache on the src gives the right answer for each and
     costs at most nine scans in a session; and because a blink swaps only to a
     variant with an IDENTICAL outline (every pair above), the number the cap is
     placed against does not move when he blinks. The twitch the old comment was
     guarding against was re-scanning the SAME image every frame, and a keyed
     cache does not do that either.
     The last good reading is kept as well: an <img> whose src has just changed
     reports !complete for a frame or two, and the cap holding still is right
     where the cap snapping to a default is not. */
  var INK = null, INKS = {};
  function scanInk(img) {
    if (!img) return INK;
    var key = img.currentSrc || img.src || "";
    if (INKS[key] !== undefined) return INKS[key] || INK;
    if (!img.complete || !img.naturalWidth) return INK;
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
      if (r < l || b < t) { INKS[key] = null; return INK; }
      INK = INKS[key] = [l / N, t / N, (r + 1) / N, (b + 1) / N];
    } catch (_) { INKS[key] = null; }   /* a tainted canvas falls back to the attribute */
    return INKS[key] || INK;
  }

  /* HE IS `#stage`, WHEREVER `#stage` HAPPENS TO BE.
     Returned as his PARENT (`#stageMorph`) so that face() below can keep its one
     shape: it is handed a root and asks for the `.stage` inside it, exactly as it
     did for the mirror clone. getElementById rather than a `.stagewrap` query,
     because headDropIn() moves `#stageMorph` into `.hmDropper` for the length of
     the ball-drop and a rooted query would drop the cap for that second.
     offsetWidth is the liveness test: he is display:none'd on some screens of the
     cup, and a zero-width host would put the cap at 0x0 in the corner. */
  function findHim() {
    var st = document.getElementById("stage");
    if (!st || !st.parentNode || st.parentNode.nodeType !== 1) return null;
    if (!st.offsetWidth || !st.offsetHeight) return null;
    return st.parentNode;
  }

  /* Where his face is drawn, and where his INK is inside it. `.stage` is square
     and the portrait fills it edge to edge, so the scanned fractions apply to the
     host directly and there is nothing to map.
     THE 5:6 FALLBACK THAT USED TO LIVE HERE IS GONE WITH THE MINI. It existed for
     a head whose face was a baked cut seated on window.__hmFOOT inside a 5:6
     root; the big head has no such render, and the branch was already marked
     "NOT EXERCISED by anything that ships". `data-head-bounds` survives as the
     tainted-canvas fallback, which is the one case scanInk cannot answer. */
  function face(root) {
    var st = root.querySelector(":scope > .stage");
    if (!st) return null;
    var img = st.querySelector("img.face") || st.querySelector("img");
    var b = scanInk(img) || bounds(img);
    return b ? { host: st, ink: b } : null;
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
       Everything vertical is written against the host's WIDTH and converted to a
       height percentage by the ratio below, rather than being written as a height
       percentage directly. `.stage` is square today so the two are the same
       number; they were not when this rode a 5:6 root, and keeping the width as
       the single unit is what makes the arithmetic survive the host changing. */
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
    /* A poll rather than a MutationObserver on the tree: he is moved into and out
       of .hmDropper across a cup and screens come and go around him, and 600ms is
       under the eye's threshold for "the hat was late" while costing one
       getElementById and four style writes.
       BUT THE POLL IS NOT FAST ENOUGH FOR HIS FACE. The cap is sized off the ink
       of whichever portrait is loaded, and those outlines differ by up to 0.050
       of the box between expressions (see scanInk) -- 13px on the 260px dropper,
       which is his hair coming through the crown. A 600ms lag on that is visible
       during a 1.2s ceremony, so the one thing that IS observed is the face img's
       src. It fires a handful of times a match and re-runs the same sweep. */
    sweep();
    timer = setInterval(sweep, 600);
    try {
      var fi = document.getElementById("face");
      if (fi && !faceObs) {
        faceObs = new MutationObserver(sweep);
        faceObs.observe(fi, { attributes: true, attributeFilter: ["src"] });
      }
    } catch (_) {}
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    if (faceObs) { try { faceObs.disconnect(); } catch (_) {} faceObs = null; }
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
