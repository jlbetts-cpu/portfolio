#!/usr/bin/env python3
"""Holds the Marble Race to the four things Jayden could see were wrong with it.

WHY THIS FILE EXISTS
--------------------
On 2026-08-11 Jayden watched the race run for the first time and reported, in his
own words: "parts of the screen are cut off", "heads are pushed to spots that
they arent actually at", "there was some pre fired spinning from some of the
players", and "make it clear that top 8 qualify for the cup". Three of those four
are measurable properties of a running race, and every one of them was invisible
in source. What was measured, at 1440x900 with a twelve-head field, before the
pass that added this file:

  * CUT OFF. `body.playViewportOwned .hero` is 60vh, so the race ran inside a
    540px band in a 900px viewport -- 180px of blank page above it and 180px
    below. `.hmRaceWrap` is overflow:hidden and `.hero` is overflow:visible, so
    the COURSE was sliced at the band's edges (the spinner paddle cut in half
    mid-stroke) while the HEADS carried on into the empty page. At 320x568 the
    course was 340.8px deep, about two heads. Separately, the standings strip
    measured 392px of content in a 390px and in a 320px viewport, so both ends
    were clipped by the screen and the End button -- the only control the race
    has -- was off it entirely.

  * PUSHED TO SPOTS THEY ARE NOT AT. The head's transform is written at
    play-engine.js's render section; the race mailbox (`raceX`/`raceY`) was read
    about a hundred lines BELOW it. So every frame painted the previous frame's
    race position after this frame's free-fall integration (`x+=vx*DT`,
    `y+=vy*DT`) and the ceiling clamp had already moved it. Worst case over one
    race, not median: 66.1px out horizontally and 159.5px out vertically -- a
    head swatted above the top of the course window had its y clamped to CEIL and
    sat GLUED to the top edge of the screen while the simulation had it well off
    it. Only 27.8% of 11,628 samples were inside 2px; 5.9% were past 40px.

  * PRE-FIRED SPINNING. Nothing cleared `flipA`/`flipV` at the drop. A head that
    was mid-somersault when the grid formed kept integrating `flipA+=flipV*DT`
    all the way down the course, because the race sets air=true -- and it started
    spinning during the 3-2-1, before the race had dropped. The lobby hops flip,
    and the tumble home at the END of a race flips 40% of the field, so a second
    race run straight after a first is the reliable way to see it.

Every assertion below is one of those, written so it fails again if the defect
comes back.

    python3 tools/race-fidelity-contract.py
    python3 tools/race-fidelity-contract.py --verbose
    python3 tools/race-fidelity-contract.py --self-test

--self-test re-injects each defect into the served file and requires the detector
to fire. A gate nobody has watched fail is a gate nobody should trust.

NOTE ON THE INSTRUMENT. `?wraf=1` opens play-engine.js's dev-only `window.__race`
handle. Nothing here reads a screenshot: the browser pane rasterises the race
wrong and throttles its rAF, so every number below comes from the DOM and from
the simulation's own state, read in the same frame.
"""

import argparse
import json
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SIZES = [(1440, 900), (390, 844), (320, 568)]
FIELD = 12
ADVANCE = 8

# --------------------------------------------------------------------------
# The defects, re-injected into the served source. Each is the smallest edit
# that reproduces the measured symptom, so a detector that stays green here is
# a detector that was never watching.
# --------------------------------------------------------------------------
INJECTIONS = {
    # The ordering bug, expressed as its arithmetic: one gravity step of drift on
    # top of the mailbox, and the ceiling clamp pinning anything above the course
    # window to y=CEIL. That is exactly what painting before the mailbox produced.
    "desync": (
        "if(window.__hmRaceOn&&me.raceX!=null){x=me.raceX;y=me.raceY;",
        "if(window.__hmRaceOn&&me.raceX!=null){x=me.raceX+vx*DT;y=Math.max(2,me.raceY+vy*DT);",
    ),
    # The spin leak: stop clearing the somersault at the drop.
    "spin": (
        "flipA=0;flipV=0;wig=null;rotX=0;breathe=0;me.__spin=0;me.__disco=0;depthT=1;depth=1;",
        "",
    ),
    # The letterbox: take the race back off the full viewport.
    "band": (
        '+"body.hmRace.playViewportOwned .hero{height:100%;min-height:100%;margin:0}"',
        '+""',
    ),
    # The strip that did not fit: put the fixed-width chips back.
    "strip": (
        '+".hmRaceBoard .hmRaceRow{flex:0 1 auto;min-width:0;padding:var(--sp-2);'
        'font-size:var(--fs-micro);gap:0}"',
        '+".hmRaceBoard .hmRaceRow{flex:0 0 auto;padding:var(--sp-2);'
        'font-size:var(--fs-micro);gap:0}"',
    ),
}


class Handler(SimpleHTTPRequestHandler):
    inject = None

    def log_message(self, *a):
        pass

    def send_head(self):
        if self.inject and self.path.split("?")[0] == "/play-engine.js":
            src = (ROOT / "play-engine.js").read_text()
            find, repl = INJECTIONS[self.inject]
            if find not in src:
                raise SystemExit(
                    "self-test cannot re-inject '%s': the anchor text is gone from "
                    "play-engine.js, so this detector is no longer watching what it "
                    "claims to watch.\n  anchor: %s" % (self.inject, find[:90])
                )
            body = src.replace(find, repl, 1).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            import io

            return io.BytesIO(body)
        return SimpleHTTPRequestHandler.send_head(self)


SEED = r"""
async (n) => {
  const EGG = window.__EGGHEAD;
  const HUES = ['#e05a4e','#5aa0d8','#3fa99a','#e0b23f','#8a6bd0','#d06ba0','#6bd08a','#d0846b',
                '#b06b3f','#4f7fd0','#57b06b','#c04f8a'];
  const img = await new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = EGG.cut; });
  const out = [];
  for (let k = 0; k < n; k++) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = HUES[k % HUES.length]; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-over';
    // readAll() de-dupes by `cut` AND by an eyes/marks key, so N copies of one egg
    // collapse to one head and nothing spawns. Shift the eyes to defeat it.
    const eyes = JSON.parse(JSON.stringify(EGG.eyes));
    eyes[0].x += k * 0.004; eyes[1].x -= k * 0.004;
    out.push({cut: c.toDataURL('image/webp', 0.9), eyes: eyes, marks: EGG.marks});
  }
  localStorage.setItem('hmCompanions', JSON.stringify(out));
  return out.length;
}
"""

# THE FIDELITY SAMPLER. One invariant, asserted every frame on every visible
# racer: the translation the browser is drawing IS the mailbox the race wrote.
# Rotation, squash and the depth scale all pivot about the head's own foot line
# and are character, not position -- they are deliberately outside the claim.
SAMPLER = r"""
() => {
  window.__rf = {n: 0, worst: {err: -1}, over: 0};
  function sample(){
    requestAnimationFrame(sample);
    const R = window.__race;
    if (!R || !window.__hmRaceOn || !R.balls.length) return;
    for (let i = 0; i < R.balls.length; i++){
      const b = R.balls[i], pr = b.peer;
      if (b.out || !pr || pr.raceX == null || pr.raceHide || !pr.root) continue;
      const cs = getComputedStyle(pr.root);
      if (cs.opacity === '0' || cs.display === 'none') continue;
      let m; try { m = new DOMMatrix(cs.transform); } catch (_) { continue; }
      const dx = m.e - pr.raceX, dy = m.f - pr.raceY;
      const err = Math.max(Math.abs(dx), Math.abs(dy));
      window.__rf.n++;
      if (err > 0.6) window.__rf.over++;
      if (err > window.__rf.worst.err)
        window.__rf.worst = {err: +err.toFixed(2), dx: +dx.toFixed(2), dy: +dy.toFixed(2),
                             i: i, sy: Math.round(b.y - R.st().camY)};
    }
  }
  requestAnimationFrame(sample);
  return true;
}
"""

# Rendered rotation of every racer, in degrees, off the live matrix.
ROT = r"""
() => {
  const R = window.__race; if (!R) return [];
  return R.balls.map(b => {
    const el = b.peer && b.peer.root; if (!el) return null;
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return +(Math.atan2(m.b, m.a) * 180 / Math.PI).toFixed(2);
  }).filter(v => v !== null);
}
"""

# CAPTURING THE FIELD, so a later race can be started with rotation already in
# flight. The peers are only reachable while a race is up (`__race.balls`), and
# they outlive it, so one throwaway race hands over the whole field.
CAPTURE = "() => { const R = window.__race; if (!R) return 0;" \
          "  window.__rfPeers = R.balls.map(b => b.peer); return window.__rfPeers.length; }"

# LEAVE THE SPIN RUNNING INTO THE NEXT RACE. `__spin` is the banana's dizzy spin
# and `__disco` the disco stun: both are plain deadlines on the peer, both drive
# a live rotation in the render section, and neither was cleared at the drop --
# the same leak as the somersault's flipA/flipV, which is a closure local and so
# cannot be poked from out here. Asserting on `__spin` asserts the whole family,
# because one line clears all five.
SPIN_ALL = r"""
() => {
  const P = window.__rfPeers || []; const t = performance.now() + 120000;
  for (const p of P){ p.__spin = t; p.__disco = t; }
  return P.length;
}
"""

GEO = r"""
() => {
  const hero = document.querySelector('.hero');
  const board = document.querySelector('.hmRaceBoard');
  const stake = document.querySelector('.hmRaceStake');
  const end = document.querySelector('.hmRaceEnd');
  const box = e => { if (!e) return null; const b = e.getBoundingClientRect();
    return {l:+b.left.toFixed(1), t:+b.top.toFixed(1), r:+b.right.toFixed(1),
            b:+b.bottom.toFixed(1), w:+b.width.toFixed(1), h:+b.height.toFixed(1)}; };
  let endTarget = 0;
  if (end){ const a = getComputedStyle(end, '::after');
    endTarget = Math.max(end.getBoundingClientRect().height, parseFloat(a.height) || 0); }
  // The strip's real content width, not its clipped box: the sum of the children
  // plus the gaps, which is what overflowed the phone.
  let content = 0;
  if (board){ const cs = getComputedStyle(board);
    const gap = parseFloat(cs.columnGap) || 0;
    const kids = Array.from(board.children);
    if (cs.flexDirection.indexOf('row') === 0){
      content = kids.reduce((s, k) => s + k.getBoundingClientRect().width, 0)
              + gap * Math.max(0, kids.length - 1)
              + (parseFloat(cs.paddingLeft)||0) + (parseFloat(cs.paddingRight)||0);
    }
  }
  return {vw: innerWidth, vh: innerHeight,
          hero: box(hero), board: box(board), stake: box(stake), end: box(end),
          endTarget: +endTarget.toFixed(2),
          boardRow: board ? getComputedStyle(board).flexDirection : null,
          boardContent: +content.toFixed(1),
          stakeText: stake ? stake.textContent.trim() : null,
          scrolls: document.scrollingElement
                   ? document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight
                   : 0};
}
"""


class Findings:
    def __init__(self, verbose):
        self.failures = []
        self.verbose = verbose

    def ok(self, label, detail=""):
        if self.verbose:
            print("  ok   %-46s %s" % (label, detail))

    def check(self, cond, label, detail=""):
        if cond:
            self.ok(label, detail)
        else:
            self.failures.append("%s  %s" % (label, detail))
            print("  FAIL %-46s %s" % (label, detail))
        return cond


def open_page(browser, base, w, h):
    ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
    pg = ctx.new_page()
    pg.goto(base + "/play.html", wait_until="load")
    pg.evaluate(SEED, FIELD)
    pg.goto(base + "/play.html?wraf=1", wait_until="load")
    pg.wait_for_timeout(2600)
    return ctx, pg


def start_race(pg, advance=ADVANCE):
    return pg.evaluate(
        "(a) => !!(window.__hmRaceStart && window.__hmRaceStart({advance:a, format:'line'}))",
        advance,
    )


def run(base, browser, f):
    """Every assertion, at every size. The long ones run at 1440x900 only --
    they are size-independent by construction and the geometry is not."""
    for (w, h) in SIZES:
        deep = (w, h) == SIZES[0]
        print("\n%dx%d" % (w, h))
        ctx, pg = open_page(browser, base, w, h)
        try:
            pg.evaluate(SAMPLER)

            # ---- 4. PRE-FIRED SPINNING, over three consecutive races ----------
            # A throwaway race hands over the field, then each following race is
            # started with a live rotation already running on every head. The drop
            # has to clear it. Three races back to back because Jayden's report was
            # of a second race inheriting the state of a first.
            races = 3 if deep else 2
            for run_i in range(races):
                if run_i:
                    f.check(pg.evaluate(SPIN_ALL) == FIELD,
                            "race %d: field captured" % run_i, "")
                assert start_race(pg), "the race refused to start"
                pg.wait_for_timeout(300)
                at_grid = pg.evaluate(ROT)
                if run_i == 0:
                    pg.evaluate(CAPTURE)
                pg.wait_for_timeout(3200)           # through the 3-2-1, at the drop
                at_drop = pg.evaluate(ROT)
                pg.wait_for_timeout(240)            # ...and a beat later: no angular velocity
                after = pg.evaluate(ROT)
                worst_grid = max([abs(v) for v in at_grid] or [999])
                # At the drop the heads are falling, so `lean` (raceVX*0.028, capped
                # at 10) is legitimately non-zero. A leaked rotation is not bounded by
                # anything -- the banana runs a full 360 and flipV runs to 700 deg/s --
                # so the two are never confused at this threshold.
                worst_drop = max([abs(v) for v in at_drop] or [999])
                worst_after = max([abs(v) for v in after] or [999])
                f.check(len(at_grid) == FIELD, "race %d: whole field on the grid" % run_i,
                        "%d of %d" % (len(at_grid), FIELD))
                f.check(worst_grid < 0.01, "race %d: no spin on the grid" % run_i,
                        "worst |rotation| %.2f deg during the 3-2-1" % worst_grid)
                f.check(worst_drop <= 10.01, "race %d: no spin at the drop" % run_i,
                        "worst |rotation| %.2f deg (lean caps at 10)" % worst_drop)
                f.check(worst_after <= 10.01, "race %d: no angular velocity" % run_i,
                        "worst |rotation| %.2f deg a beat later" % worst_after)
                if run_i < races - 1:
                    pg.evaluate("() => window.__hmRaceEnd && window.__hmRaceEnd()")
                    pg.wait_for_timeout(1400)

            # ---- 1. NOTHING IS CUT OFF ---------------------------------------
            g = pg.evaluate(GEO)
            hero = g["hero"]
            f.check(hero and abs(hero["t"]) < 1 and abs(hero["h"] - g["vh"]) < 1.5,
                    "the race owns the whole viewport",
                    "hero %.1f..%.1f in a %dpx screen" % (hero["t"], hero["b"], g["vh"]))
            b = g["board"]
            f.check(b and b["l"] >= -0.5 and b["r"] <= g["vw"] + 0.5 and b["t"] >= -0.5
                    and b["b"] <= g["vh"] + 0.5,
                    "the standings are inside the screen", json.dumps(b))
            if g["boardRow"] and g["boardRow"].startswith("row"):
                f.check(g["boardContent"] <= g["vw"] + 0.5,
                        "the standings strip fits without clipping",
                        "%.1fpx of content in a %dpx screen" % (g["boardContent"], g["vw"]))
            e = g["end"]
            f.check(e and e["l"] >= -0.5 and e["r"] <= g["vw"] + 0.5 and e["b"] <= g["vh"] + 0.5,
                    "the End control is reachable", json.dumps(e))
            f.check(g["endTarget"] >= 43.9, "the End control is a 44px target",
                    "%.2fpx" % g["endTarget"])
            f.check(g["scrolls"] <= 0, "nothing scrolls", "%dpx of overflow" % g["scrolls"])

            # ---- 5. THE STAKE IS STATED, BEFORE AND DURING --------------------
            st = (g["stakeText"] or "")
            f.check(str(ADVANCE) in st and "qualif" in st.lower(),
                    "the stake names the cut", repr(st[:80]))
            f.check("draft" not in st.lower(), "the race does not talk about a draft",
                    repr(st[:80]))

            # ---- 3. THE FINISH IS SEQUENTIAL ---------------------------------
            # Let the race run and watch the pill: it must name a place, and it must
            # name MORE THAN ONE over the run, which is only true if each crossing is
            # acknowledged in turn rather than the field resolving as a batch.
            if deep:
                seen = pg.evaluate("""async () => {
                  const el = document.querySelector('.hmRaceStake'); const seen = [];
                  for (let i = 0; i < 90; i++){
                    const t = (el && el.textContent || '').trim();
                    const m = t.match(/^\\s*(\\d+(?:st|nd|rd|th))/);
                    if (m && seen[seen.length-1] !== m[1]) seen.push(m[1]);
                    if (!window.__hmRaceOn && seen.length) break;
                    await new Promise(r => setTimeout(r, 500));
                  }
                  return seen; }""")
                f.check(len(seen) >= 3,
                        "the finish is announced place by place",
                        "pill named %s" % (", ".join(seen[:8]) or "nothing"))

            # ---- 2. DRAWN IS WHERE SIMULATED IS ------------------------------
            rf = pg.evaluate("() => window.__rf")
            f.check(rf["n"] > 1500, "the sampler saw a whole race",
                    "%d samples" % rf["n"])
            f.check(rf["worst"]["err"] <= 0.6,
                    "drawn position equals simulated position",
                    "worst %.2fpx (%d of %d samples past 0.6px) %s"
                    % (rf["worst"]["err"], rf["over"], rf["n"], json.dumps(rf["worst"])))
            pg.evaluate("() => window.__hmRaceEnd && window.__hmRaceEnd()")
        finally:
            ctx.close()


def self_test(base, browser, server):
    """Re-inject each defect; the detector for it must fail."""
    expect = {
        "desync": "drawn position equals simulated position",
        "spin": "no spin",
        "band": "the race owns the whole viewport",
        "strip": "the standings strip fits without clipping",
    }
    ok = True
    for key, needle in expect.items():
        print("\n--- re-injecting: %s" % key)
        Handler.inject = key
        f = Findings(False)
        try:
            run(base, browser, f)
        except Exception as exc:                       # a crash is not a detection
            print("  the injected build threw: %s" % exc)
        finally:
            Handler.inject = None
        fired = [x for x in f.failures if needle in x]
        if fired:
            print("  detector fired: %s" % fired[0][:110])
        else:
            print("  NO DETECTOR FIRED for '%s' -- this gate is not watching it." % key)
            ok = False
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    handler = partial(Handler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    Thread(target=server.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % server.server_port
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=["--force-color-profile=srgb"])
            try:
                if args.self_test:
                    good = self_test(base, browser, server)
                    print("\nSTATUS=%s  (self-test)" % ("PASS" if good else "FAIL"))
                    return 0 if good else 1
                f = Findings(args.verbose)
                run(base, browser, f)
                print()
                if f.failures:
                    print("STATUS=FAIL  (%d finding%s)"
                          % (len(f.failures), "" if len(f.failures) == 1 else "s"))
                    return 1
                print("STATUS=PASS  the race fills the screen, draws every head where it "
                      "actually is, drops a still field, and says what is at stake.")
                return 0
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    sys.exit(main())
