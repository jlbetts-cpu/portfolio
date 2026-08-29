/* ═══════════════════════════════════════════════════════════════════════════
   league-audio.js -- the bed that plays under the Yowmings League, and the
   mute control that sits in the header for as long as it is playing.

   Jayden: "I want it to play on loop throughout the tournment making sure it
   stops at the end and also that there is a mute button in the header at all
   times put in a clean way that matches the token."

   WHY THIS IS A SEPARATE FILE AND NOT A PATCH TO play-engine.js.
   The cup's whole lifetime is already published as a body class: play-tournament
   toggles `hmYowCup` on when the cup starts and off in stop(). That is exactly
   the signal this needs, so a MutationObserver on body.class gives a complete
   start/stop contract without adding a single line to a 6,000-line engine, and
   without a second place that has to remember to tear the audio down. Every
   ending path -- champion, End button, abort -- already goes through that class
   coming off, which is more coverage than a hand-placed hook would get.

   THE SOURCE, AND WHY THERE ARE TWO.
   `audio/league-loop.m4a` is HIS voice memo. It arrived as an iOS
   item-provider temp path that macOS had already cleaned up, so there was no
   file to import. Rather than ship a player with nothing to play, the fallback
   `audio/league-loop-baked.m4a` is a distant-stadium bed baked by
   tools/assets/bake-league-loop.py. The moment his file is saved at the first
   name it wins, with no code change: the element carries both <source>s in
   priority order and the browser takes the first that loads.

   AUTOPLAY. Browsers refuse audio that no gesture asked for, and rightly. The
   cup can only start from a click, so the first play() is inside that gesture's
   task and is allowed. If it is refused anyway the promise rejection is caught
   and a one-shot pointerdown listener retries -- silent failure here would be a
   feature that is simply missing on some machines, which is worse than late.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var SRCS = ["audio/league-loop.m4a", "audio/league-loop-baked.m4a"];
  var KEY = "lgMuted";
  var FADE_MS = 700;         // in and out, so it never slams on or cuts off
  var VOL = 0.34;            // it is a bed, not a soundtrack

  var el = null, btn = null, playing = false, fadeTimer = null, armed = false;

  /* localStorage here is a one-key preference and touches nothing else. The
     companion heads live in hmCompanions/hmCompanion and are irreplaceable;
     this never reads or writes those keys. */
  function muted() {
    try { return localStorage.getItem(KEY) === "1"; } catch (_) { return false; }
  }
  function setMuted(v) {
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (_) {}
  }

  function build() {
    if (el) return el;
    el = document.createElement("audio");
    el.id = "lgAudio";
    el.loop = true;
    el.preload = "auto";
    el.setAttribute("aria-hidden", "true");
    for (var i = 0; i < SRCS.length; i++) {
      var s = document.createElement("source");
      s.src = SRCS[i];
      s.type = "audio/mp4";
      el.appendChild(s);
    }
    el.volume = 0;
    document.body.appendChild(el);
    return el;
  }

  function fade(to, done) {
    if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
    if (!el) return;
    var from = el.volume, t0 = Date.now();
    fadeTimer = setInterval(function () {
      var f = Math.min(1, (Date.now() - t0) / FADE_MS);
      try { el.volume = from + (to - from) * f; } catch (_) {}
      if (f >= 1) {
        clearInterval(fadeTimer); fadeTimer = null;
        if (done) done();
      }
    }, 40);
  }

  function play() {
    build();
    if (muted()) { el.volume = 0; return; }
    var p = null;
    try { p = el.play(); } catch (_) {}
    if (p && p.catch) {
      p.catch(function () {
        /* Refused for want of a gesture. Arm one retry on the next pointer
           down anywhere -- once, so this cannot accumulate listeners. */
        if (armed) return;
        armed = true;
        var go = function () {
          document.removeEventListener("pointerdown", go, true);
          armed = false;
          if (playing && !muted()) { try { el.play(); } catch (_) {} fade(VOL); }
        };
        document.addEventListener("pointerdown", go, true);
      });
    }
    fade(VOL);
  }

  function stop() {
    if (!el) return;
    fade(0, function () {
      try { el.pause(); el.currentTime = 0; } catch (_) {}
    });
  }

  /* ── the control ──────────────────────────────────────────────────────────
     It is a .ctl, which is the whole point: controls.css owns its height, its
     radius, its press feedback and its 44px floor, so this matches the End
     button beside it without redeclaring one token. Drawing it privately is
     exactly what CLAUDE.md forbids. The icon is two paths in one <svg> with
     `currentColor`, same as every other icon on the site, and the muted state
     is a class rather than a second SVG so there is one node to keep. */
  function icon(on) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" '
      + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<path d="M11 5 6 9H3v6h3l5 4z"/>'
      + (on
        ? '<path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>'
        : '<path d="M16 9.5l5 5"/><path d="M21 9.5l-5 5"/>')
      + '</svg>';
  }

  function paint() {
    if (!btn) return;
    var m = muted();
    btn.innerHTML = icon(!m);
    btn.setAttribute("aria-pressed", m ? "true" : "false");
    btn.setAttribute("aria-label", m ? "Unmute the league" : "Mute the league");
    btn.setAttribute("title", m ? "Sound off" : "Sound on");
    btn.classList.toggle("isMuted", m);
  }

  function mount() {
    var navR = document.querySelector(".jbGrpR");
    if (!navR) return false;
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lgMute ctl ctl--quiet ctl--sm";
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var m = !muted();
        setMuted(m);
        paint();
        if (!el) return;
        if (m) { fade(0); }
        else { try { el.play(); } catch (_) {} fade(VOL); }
      });
      paint();
    }
    /* headerBuild() inserts the round at the FRONT of this group and appends
       End to the back, so sitting at the very end keeps the reading order
       matchup - round - End - sound, and nothing has to know about anything
       else's position. Re-appending an element that is already last is a
       no-op, so calling this repeatedly is free. */
    if (btn.parentNode !== navR || navR.lastChild !== btn) navR.appendChild(btn);
    return true;
  }

  function unmount() {
    if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
  }

  function sync() {
    var on = document.body.classList.contains("hmYowCup");
    if (on === playing) { if (on) mount(); return; }
    playing = on;
    if (on) { mount(); play(); }
    else { unmount(); stop(); }
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

  /* The tab going away should not leave a cup playing to an empty room. */
  document.addEventListener("visibilitychange", function () {
    if (!el || !playing) return;
    if (document.hidden) { try { el.pause(); } catch (_) {} }
    else if (!muted()) { try { el.play(); } catch (_) {} }
  });

  window.__lgAudio = { play: play, stop: stop, muted: muted };
})();
