#!/usr/bin/env python3
"""Fails when the Hero's glyph field stops being a texture and starts being a cost.

WHY THIS FILE EXISTS
The field was ported from the Workspace app's header band, where it is white
glyphs over one mid-blue mesh. This sky is six gradients running from #f8fafd to
#060a13, and the port only works because of decisions that are easy to undo by
accident and impossible to see failing in a diff:

  1. IT IS THE PAGE'S OWN GROUND COLOUR ON EVERY SKY, AND IT LIGHTENS ALL SIX.
     This assertion USED TO SAY THE OPPOSITE and the reversal is deliberate, not
     drift: the port shipped as ink on the five light skies, Jayden asked to
     "make ascii the background color", and the direction of the delta is now
     positive everywhere. The regression this catches is someone restoring
     `18 18 18` -- which is a one-token change that leaves the code looking like
     the version in git history and turns the light on the band back into specks
     of dirt on it. The strengths moved with the colour and cannot be carried
     back: light-on-light has (.976 - L_sky) of headroom where ink had L_sky.
  1b. IT ANSWERS THE CURSOR, AWAY AND BRIGHTER, AND FADES RATHER THAN SNAPS.
     Three separable things, three separable regressions: PUSH is the
     displacement and 0 kills it silently; the sign of the vector decides
     whether the field opens around the pointer or collects under it, and a
     minus sign is invisible in a diff; LIFT is what makes it read as light
     rather than only as motion, and dropping it leaves something that still
     "works". The activation has to be a fade -- assigned straight from the
     target it becomes the bundle's own hard boolean, which is fine on a
     full-bleed band and pops the whole surface on a Hero that has edges.
     Touch must not drive any of it: there is no hover, and the guard is on
     BOTH handlers because removing only one leaves a permanent bulge.
  2. IT NEVER PAINTS OVER ANYTHING INTERACTIVE. The head is draggable, the eyes
     track, and the canvas covers the whole Hero. pointer-events:none and a
     z-index under .heroCharacterPeek are the only things holding that.
  3. IT IS STILL UNDER REDUCED MOTION, NOT ABSENT. A full-width surface of
     oscillating alpha is the exact thing the Apple reference names in section
     14. The still frame has to carry the same picture, which means it must
     still PAINT -- "turn it off" and "hold it" are the same diff size and only
     one of them is right.
  4. IT YIELDS TO THE HEAD. The head is the one thing on this page you can
     grab. With the field drawing through a throw, hero-head-physics-contract
     failed "grabbing the head 60ms into its flight does not move it" 2 runs out
     of 2 (worst step 6.89 against a first step of 6.09, tolerance 0.5) while
     pristine HEAD was green 3 of 3 and the same tree with the field slowed to
     one draw a second was green 2 of 2. About 1.7ms of draw is nothing at rest
     and is the whole margin while a spring is resolving.
  5. IT COSTS WHAT IT WAS MEASURED TO COST. A canvas the size of the Hero,
     redrawn on a clock, is the single easiest way to lose the site's 60fps bar.
     The density knob (the cell pitch) is one number and moving it down is the
     obvious thing to try when someone wants the field "stronger".

WHAT IT MEASURES, and what it measured on 2026-08-19, device_scale 2, headless:

  coverage    fraction of the Hero's pixels a glyph touches
              .0019 (390 dusk) .. .0053 (1440 night)
  peak dL     95th percentile luminance delta the field makes at those pixels
              .066 (390 night) .. .197 (1440 sunrise)
  sign        whether the field darkens the sky or lightens it
              positive on all six, on every viewport, since the ground-colour
              pass -- see 1 above for why this flipped
  cursor      mean radial residual of each cell against its own 21px slot,
              averaged over 16 captured frames so the +/-2.2px jitter cancels
              +6.78px at r<60 with the pointer parked, -0.29 with it away;
              mean glyph alpha within 120px +33% (.1063 -> .1412)
  drawMs p95  the field's own self-time per drawn frame
              1.9 / 2.1 at 1440x900, 3.2 / 3.5 at 2560x1400 (daytime / night)
              on the machine that recorded them. RE-MEASURED 2026-08-19 on a box
              at load average 10, interleaved against the tree as it stood so the
              instrument is the same for both:
                            shipped p50/p95     this pass p50/p95
                1440 day       3.30 / 4.50        2.90 / 3.90
                1440 night     3.60 / 4.70        2.80 / 4.00
                2560 day       5.80 / 8.60        3.80 / 4.70
                2560 night     6.20 /10.80        4.00 / 6.50
                dropped           5                   0
              The pitch went 21 -> 26 in the same pass and glyph count goes as its
              square, which is what paid for the cursor term and the sky's drift.
              Absolute numbers off a loaded box mean nothing; the column-to-column
              comparison is the only part of that table worth reading.
  dropped     drawn frames whose self-time exceeded one 60fps frame -- 0 of 601

It draws on a 33ms clock, not every frame, and hero-time.js records why: the
fastest term in the field moves a glyph about 2px per SECOND, so a 33ms frame
moves it 0.066px -- three orders of magnitude under the perception threshold
section 11 is about.

    python3 tools/hero-ascii-field-contract.py
    python3 tools/hero-ascii-field-contract.py --verbose
    python3 tools/hero-ascii-field-contract.py --self-test

--self-test serves a MUTATED index.html / hero-time.css that re-injects each of
the four regressions above. It must then fail. A detector nobody has watched fail
is one nobody should trust.

The renderer is an inline script in index.html rather than a module beside
hero-time.js, and hero-specimen-check is why: that file may hold no
requestAnimationFrame handle and no visibility observer, because it is the sky's
CONTROLLER and the whole point of those two assertions is that it owns no
scheduler and cannot grow back the plumbing of the canvas renderer that was
deleted out of it. This renderer subscribes to SiteTheme directly and needs
neither.
"""

import argparse
import io
import re
import time
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = 4938

LIGHT_STATES = ("pre-dawn", "sunrise", "daytime", "dusk", "sunset")
DARK_STATES = ("night",)
ALL_STATES = LIGHT_STATES + DARK_STATES

# ── THE BANDS ────────────────────────────────────────────────────────────────
# Measured, then widened by roughly a third in each direction so the numbers only
# move when someone means them to. The point of a two-sided band is that BOTH
# failures are real: a field nobody can see is a frame nobody should be paying
# for, and a field you notice before you notice the sky is dirt on the artwork.
COVERAGE_MIN = 0.0012         # measured .0019 (390 dusk) .. .0053 (1440 night)
COVERAGE_MAX = 0.0120
PEAK_DL_MIN = 0.035           # measured .066 (390 night) .. .197 (1440 sunrise)
PEAK_DL_MAX = 0.300
# p95 AND NOT p99, because a 10s window is about 300 drawn frames and the 99th
# of 300 is the third-worst sample -- a max wearing a percentile's name, and it
# swung 2.9 -> 6.8ms run to run on an idle machine purely on scheduler noise.
# The assertion that actually protects the frame is the dropped-frame line
# below; this one protects the steady state.
DRAW_P95_MS = 6.0             # measured 1.9 / 2.1 at 1440x900, 3.2 / 3.5 at 2560x1400
FRAME_MS = 16.7               # one 60fps frame: the field must never eat a whole one
# A drawn frame over 16.7ms is a frame the field ate by itself. Zero is the
# intent and zero is what 1500+ samples measured; the 1% allowance is here
# because a headless run rasterises in software and a GC pause lands in the
# sample as a 17ms draw that a real one never sees. It is an allowance for the
# INSTRUMENT, not for the field: 2% would let a real regression hide in it.
DROPPED_RATE = 0.01


def luminance(px):
    def channel(v):
        v = v / 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = px[0], px[1], px[2]
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


# ── THE MUTATIONS ────────────────────────────────────────────────────────────
# Each is a regression someone could plausibly land, expressed as the smallest
# edit that lands it. They are applied to the SOURCE the page fetches, not to the
# page after load, because three of the four live inside a closed IIFE that a
# page-level evaluate cannot reach -- and a self-test that can only inject the
# bugs it happens to be able to reach is a self-test for the wrong contract.
# Each entry is (file, old, new, tag, why). TAG IS NOT DECORATION. The old
# --self-test applied every mutation at once and passed if the run produced ANY
# finding, which means it would have printed SELF-TEST PASS while quietly failing
# to notice half the bugs it injected -- the exact shape of a detector nobody has
# watched fail. Every tag below must now appear in at least one finding, and the
# self-test fails naming the ones that did not.
MUTATIONS = [
    ("hero-time.css",
     ".hero[data-time-state]{--ascii-ink:253 253 253;",
     ".hero[data-time-state]{--ascii-ink:18 18 18;",
     "darkens",
     "the ground-colour pass reverted to ink, so the field is dirt on five skies"),
    ("hero-time.css",
     ".heroTimeAscii{\n position:absolute;inset:0;z-index:2;width:100%;height:100%;\n pointer-events:none",
     ".heroTimeAscii{\n position:absolute;inset:0;z-index:2;width:100%;height:100%;\n pointer-events:auto",
     "pointer-events",
     "the canvas becomes a hit target over the draggable head"),
    ("index.html",
     'function reduced(){return root.getAttribute("data-reduced-motion")==="reduce";}',
     'function reduced(){return false;}',
     "reduced-motion",
     "reduced motion stops being honoured, so the still field animates"),
    ("index.html",
     " var CELL=26;", " var CELL=12;",
     "too small to read",
     '"make it denser": the pitch is one number, it is the whole cost, and it is'
     " also the only thing that decides whether a mark can be seen"),
    ("index.html",
     " var FONT=CELL*12/21,JIT=CELL*2.2/21;", " var FONT=12,JIT=2.2;",
     "ratio of",
     "the bundle's literals are restored over the ratios, so the mark stops"
     " growing with the slot and a bigger field is only a sparser one"),
    ("index.html",
     ' hero.addEventListener("pointerdown",function(){',
     ' hero.addEventListener("__never_pointerdown",function(){',
     "stands aside",
     "the field stops yielding to the head while it is being handled"),
    ("index.html",
     " var REACH=.36,PUSH=CELL/3,LIFT=.4;",
     " var REACH=.36,PUSH=-CELL/3,LIFT=.4;",
     "toward the cursor",
     "the displacement pulls instead of pushing -- one character in a diff"),
    ("index.html",
     "    b=(g+infl*LIFT)*mask;",
     "    b=(g+infl*0)*mask;",
     "a lift of",
     "the lift is dropped, so the cursor moves glyphs but does not light them"),
    ("index.html",
     "    act+=(actTo-act)*(1-Math.exp(-dt/(actTo>act?ACT_RISE:ACT_FALL)));",
     "    act=actTo;",
     "intermediate values",
     "the activation becomes the bundle's hard boolean and the surface pops"),
    ("index.html",
     '  if(e.pointerType==="touch")return;\n  ptrX=',
     '  if(false)return;\n  ptrX=',
     "touch",
     "touch drives the cursor term; measured, this leaves a permanent bulge"),
]


# ── WHY THE SELF-TEST RUNS IN TWO PASSES ────────────────────────────────────
# Applied all at once, the injections silently disable each other. The pitch
# mutation makes the field several times denser; on a loaded machine the capture
# instrument then cannot land equal frame counts, check_cursor correctly refuses
# to measure, and the four cursor regressions go in with nothing watching. The
# first run of the grouped self-test caught 5 of 9 for exactly that reason and
# said so, which is the whole point of naming them.
# So: the structural bugs are injected together, the cursor bugs are injected
# together, and each pass must produce a finding naming every tag in its group.
GROUPS = {
    "structural": ("darkens", "pointer-events", "reduced-motion", "stands aside",
                   "too small to read", "ratio of"),
    # A TAG IS A SUBSTRING OF THE FINDING IT EXPECTS, not a name for the bug.
    # The first draft used "toward the pointer" / "brightness" / "snaps", all of
    # which read as accurate descriptions and none of which appear in the text
    # the contract actually prints -- so three caught regressions were reported
    # as missed. If a tag stops matching, fix the tag or fix the message; do not
    # widen the tag until it matches everything.
    "cursor-motion": ("toward the cursor", "intermediate values", "touch"),
    # THE LIFT GETS A PASS OF ITS OWN, because the inverted-push injection
    # CORRUPTS THE INSTRUMENT THAT MEASURES IT. Cells are recovered from drawn
    # centres by rounding to the nearest slot; a displacement that converges on
    # the pointer lands two glyphs in one slot and empties the slot they came
    # from, so the emptied cells fall under the "seen in half the frames" filter
    # and drop out of the average while the crowded ones stay. The near-band mean
    # alpha then rises on its own and the missing lift is masked -- measured, and
    # it reported [mean glyph alpha] as uncaught twice while the assertion was
    # working perfectly. Two bugs whose injections interfere are two passes.
    "cursor-light": ("a lift of",),
}


def mutations_for(name, group):
    tags = GROUPS[group]
    return [(o, n) for f, o, n, t, _w in MUTATIONS if f == name and t in tags]


MUTATED_FILES = sorted({f for f, *_ in MUTATIONS})


class Handler(SimpleHTTPRequestHandler):
    mutate = False
    group = None

    def send_head(self):
        name = self.path.split("?")[0].lstrip("/")
        if self.mutate and name in MUTATED_FILES:
            source = (ROOT / name).read_text(encoding="utf-8")
            for old, new in mutations_for(name, self.group):
                if old not in source:
                    raise SystemExit(
                        "SELF-TEST CANNOT RUN: the anchor for a mutation is gone from "
                        f"{name}:\n  {old[:80]!r}\n"
                        "An injection that cannot be applied is worse than no injection, "
                        "because the self-test still prints a result. Re-anchor it.")
                source = source.replace(old, new, 1)
            body = source.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type",
                             "text/css" if name.endswith(".css") else
                             "text/html" if name.endswith(".html") else "text/javascript")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return io.BytesIO(body)
        return super().send_head()

    def log_message(self, *args):
        pass


def serve(mutate, group=None):
    handler = partial(Handler, directory=str(ROOT))
    handler.mutate = mutate
    Handler.mutate = mutate
    Handler.group = group
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{PORT}"


def open_hero(browser, base, width, height, reduced=False):
    ctx = browser.new_context(viewport={"width": width, "height": height},
                              device_scale_factor=2,
                              reduced_motion="reduce" if reduced else "no-preference")
    page = ctx.new_page()
    page.goto(f"{base}/index.html", wait_until="load")
    page.wait_for_function("window.SiteTheme && window.HeroAsciiField")
    page.wait_for_timeout(1400)
    return page


def set_state(page, state):
    page.evaluate("(s) => window.SiteTheme.setMode(s, {persist:false})", state)
    page.wait_for_timeout(1100)


def field_delta(page):
    """Composite the canvas's OWN pixels onto the sky and measure what that does
    to the luminance. The obvious method -- screenshot with the field, screenshot
    without, subtract -- was tried first and is useless here: the head blinks and
    the ink boil runs between the two frames, so the diff came back at peak dL
    0.41 when the glyphs themselves are worth 0.02, and it flipped the SIGN on
    two states. The canvas is authoritative about its own alpha, one screenshot
    with the field hidden is authoritative about the backdrop, and the pixels
    under the head are excluded because that is the one region where the backdrop
    is not the sky and does not hold still."""
    ratio = page.evaluate("Math.min(window.devicePixelRatio||1,2)")
    head = page.evaluate("""() => { const r = document.getElementById('face').getBoundingClientRect();
        return {x:r.x, y:r.y, w:r.width, h:r.height}; }""")
    page.evaluate("document.getElementById('heroTimeAscii').style.visibility='hidden'")
    page.wait_for_timeout(140)
    bare = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    page.evaluate("document.getElementById('heroTimeAscii').style.removeProperty('visibility')")
    page.wait_for_timeout(140)
    # One frame of the field, straight out of its own backing store.
    raw = page.evaluate("""() => { const c = document.getElementById('heroTimeAscii');
        const g = c.getContext('2d');
        const d = g.getImageData(0, 0, c.width, c.height).data;
        const out = [];
        for (let i = 0; i < d.length; i += 4) { if (d[i+3] > 2) out.push(i>>2, d[i], d[i+1], d[i+2], d[i+3]); }
        return {w: c.width, h: c.height, hits: out}; }""")
    px = bare.load()
    bw, bh = bare.size
    hx0, hy0 = head["x"] * ratio, head["y"] * ratio
    hx1, hy1 = hx0 + head["w"] * ratio, hy0 + head["h"] * ratio
    flat = raw["hits"]
    deltas = []
    for k in range(0, len(flat), 5):
        idx = flat[k]
        x, y = idx % raw["w"], idx // raw["w"]
        if hx0 <= x <= hx1 and hy0 <= y <= hy1:
            continue
        if x >= bw or y >= bh:
            continue
        sky = px[x, y]
        a = flat[k + 4] / 255.0
        comp = (flat[k + 1] * a + sky[0] * (1 - a),
                flat[k + 2] * a + sky[1] * (1 - a),
                flat[k + 3] * a + sky[2] * (1 - a))
        deltas.append(luminance(comp) - luminance(sky))
    total = raw["w"] * raw["h"]
    if not deltas:
        return {"coverage": 0.0, "peak": 0.0, "sign": 0, "n": 0}
    mags = sorted(abs(d) for d in deltas)
    mean = sum(deltas) / len(deltas)
    return {"coverage": len(deltas) / total,
            "peak": mags[int(len(mags) * 0.95)],
            "sign": 1 if mean > 0 else -1,
            "n": len(deltas)}


# IT COUNTS THE HOST'S FRAMES AS WELL AS ITS OWN. The old sampler returned only
# the number of times it SAW drawn change, and the contract asserted that number
# against a flat 90 in 10 seconds -- which is a statement about the machine, not
# about the field. Headless Chromium rasterises in software, and at 2560x1400 on
# device scale 2 that is a 5120x2800 surface: this box served 11 rAF frames a
# second there for the SHIPPED tree and 6 with the sky drift added, so a field
# drawing perfectly on every frame it was given still reported "only 46 draws in
# 10s" and the gate fired on a stall that was not happening. Headed, on the same
# machine with a real GPU, the same page runs at 60.0fps with the drift and
# 59.4 without -- the whole penalty is the rasteriser, which is the thing
# verifying-this-site warns absolute frame timings from headless cannot see.
# So the sampler reports rafFrames and the true drawn delta, and the assertion
# below asks the only question that is about the field: of the frames the host
# actually gave it, did it draw on the ones its own 33ms clock called for.
DRAW_SAMPLER = """
(async (secs)=>{
  const v=[]; const t0=performance.now(); let seen=-1, raf=0, want=0, lastWant=-1e9;
  const first=window.HeroAsciiField.probe(false).drawn;
  await new Promise(res=>{
    function f(now){ raf++;
      // The field's own rule, run over the frames the host actually delivered.
      // "elapsed / 33" is NOT the budget: a host averaging 25fps delivers bursts
      // at 60 and then stalls, and inside a burst the 33ms clock deliberately
      // skips every other frame. Counting the skips as misses reported a healthy
      // field as drawing 202 of 256.
      if(now-lastWant>=33){ lastWant=now; want++; }
      const p=window.HeroAsciiField.probe(false);
      if(p.drawn!==seen){seen=p.drawn; if(p.drawn>2) v.push(p.drawMs);}
      if(now-t0>secs*1000) return res(); requestAnimationFrame(f); }
    requestAnimationFrame(f);
  });
  const s=v.slice().sort((a,b)=>a-b);
  const elapsed=(performance.now()-t0)/1000;
  return {n:v.length, p50:s[Math.floor(s.length*.5)]||0,
          p95:s[Math.floor(s.length*.95)]||0, max:s[s.length-1]||0,
          dropped:v.filter(x=>x>16.7).length,
          raf:raf, rafFps:+(raf/elapsed).toFixed(1),
          drew:window.HeroAsciiField.probe(false).drawn-first,
          budget:want};
})
"""


# ── 1 · the field paints, in every hour, and not in Off ───────────────────────
def check_presence(page, failures, verbose):
    set_state(page, "off")
    probe = page.evaluate("window.HeroAsciiField.probe(false)")
    if probe["glyphs"] != 0 or probe["running"]:
        failures.append(
            f"off: the field drew {probe['glyphs']} glyphs and running={probe['running']}. "
            "Off is the one state where the page underneath is the point, and it is also "
            "the free frame -- the loop must stop, not paint zero alpha.")
    for state in ALL_STATES:
        set_state(page, state)
        probe = page.evaluate("window.HeroAsciiField.probe(false)")
        if verbose:
            print(f"    {state:9s} glyphs={probe['glyphs']:5d} grid={probe['cols']}x{probe['rows']} "
                  f"power={probe['power']:.2f} ink={[round(c) for c in probe['ink']]}")
        if probe["glyphs"] <= 0:
            failures.append(
                f"{state}: the field painted no glyphs at all. Either --ascii-strength went "
                "to zero for this hour or the lit-ellipse gate has closed over the whole Hero.")


# ── 2 · it READS, on all six skies, and in the right direction ────────────────
def check_legibility(page, failures, verbose, width, height):
    for state in ALL_STATES:
        set_state(page, state)
        d = field_delta(page)
        # POSITIVE ON ALL SIX. The glyphs are --theme-page's near-white now, so
        # every sky gets lighter where one lands. DARK_STATES is kept because the
        # night ink is a different literal (the starfield's #f4f7ff) and the
        # message below still has to name which is which.
        want = 1
        if verbose:
            print(f"    {state:9s} coverage={d['coverage']:.4f} peak dL={d['peak']:.4f} "
                  f"sign={'+' if d['sign'] > 0 else '-'} ({d['n']} px sampled)")
        if d["sign"] != want and d["n"]:
            failures.append(
                f"{state} @{width}x{height}: the field darkens its sky. Every sky needs the "
                "other direction now -- the glyphs are the page's own ground colour "
                f"({'244 247 255, the starfield' if state in DARK_STATES else '253 253 253'}) "
                "and they are supposed to read as light catching the band, not as specks on it. "
                "Someone has put --ascii-ink back to 18 18 18.")
        if not (COVERAGE_MIN <= d["coverage"] <= COVERAGE_MAX):
            failures.append(
                f"{state} @{width}x{height}: the field covers {d['coverage']:.4f} of the Hero, "
                f"outside [{COVERAGE_MIN}, {COVERAGE_MAX}]. Below the floor it is a frame nobody "
                "can see; above the ceiling it is a screen of characters rather than grain.")
        if not (PEAK_DL_MIN <= d["peak"] <= PEAK_DL_MAX):
            failures.append(
                f"{state} @{width}x{height}: peak glyph contrast is {d['peak']:.4f} luminance, "
                f"outside [{PEAK_DL_MIN}, {PEAK_DL_MAX}]. Too low and the port is invisible on "
                "this sky; too high and it reads as dirt on approved artwork.")


# ── 3 · it never paints over anything interactive ─────────────────────────────
def check_stacking(page, failures, verbose):
    set_state(page, "daytime")
    facts = page.evaluate("""() => {
      const c = document.getElementById('heroTimeAscii');
      if (!c) return null;
      const clip = document.getElementById('heroTimeClip');
      const peek = document.querySelector('.heroCharacterPeek');
      const cs = getComputedStyle(c);
      const face = document.getElementById('face').getBoundingClientRect();
      const hit = document.elementFromPoint(face.x + face.width/2, face.y + face.height/2);
      const cta = document.querySelector('#heroTimeBtn').getBoundingClientRect();
      const ctaHit = document.elementFromPoint(cta.x + cta.width/2, cta.y + cta.height/2);
      return {inClip: clip.contains(c), pe: cs.pointerEvents, pos: cs.position,
              z: cs.zIndex, aria: c.getAttribute('aria-hidden'),
              clipZ: +getComputedStyle(clip).zIndex, peekZ: +getComputedStyle(peek).zIndex,
              headHit: hit ? (hit.id || String(hit.className)) : null,
              ctaHit: ctaHit ? (ctaHit.id || String(ctaHit.className)) : null};
    }""")
    if facts is None:
        failures.append("there is no #heroTimeAscii in the Hero at all.")
        return
    if verbose:
        print(f"    canvas: inClip={facts['inClip']} pointer-events={facts['pe']} z={facts['z']} "
              f"clipZ={facts['clipZ']} peekZ={facts['peekZ']}")
        print(f"    hit tests: head -> {facts['headHit']}   primary CTA -> {facts['ctaHit']}")
    if not facts["inClip"]:
        failures.append(
            "#heroTimeAscii is outside .heroTimeClip. The clip is what holds the field to the "
            "Hero's own rounded bottom edge; outside it the glyphs paint past the corners.")
    if facts["pe"] != "none":
        failures.append(
            f"#heroTimeAscii computes pointer-events:{facts['pe']}. It covers the whole Hero, "
            "including the draggable head and the primary CTA.")
    if facts["aria"] != "true":
        failures.append("#heroTimeAscii is not aria-hidden. It is decoration with no text value.")
    if facts["clipZ"] >= facts["peekZ"]:
        failures.append(
            f"the sky's clip (z {facts['clipZ']}) is no longer under .heroCharacterPeek "
            f"(z {facts['peekZ']}), so the glyph field can paint over the portrait.")
    if "heroTimeAscii" in str(facts["headHit"]) or "heroTimeAscii" in str(facts["ctaHit"]):
        failures.append(
            f"the canvas is the hit target over the head ({facts['headHit']}) or the CTA "
            f"({facts['ctaHit']}). The head's drag uses setPointerCapture; a layer in front of "
            "it does not degrade, it stops.")


# ── 4 · the field stands aside while the head is being handled ───────────────
def check_yield(page, failures, verbose):
    set_state(page, "night")
    page.wait_for_timeout(400)
    box = page.evaluate("""() => { const r = document.getElementById('face').getBoundingClientRect();
        return {x: r.x + r.width/2, y: r.y + r.height/2}; }""")
    page.mouse.move(box["x"], box["y"])
    page.mouse.down()
    page.wait_for_timeout(320)
    held = page.evaluate("window.HeroAsciiField.probe(false)")
    # THE CLOCK IS BANKED, NOT SKIPPED. A field that stops and restarts on
    # performance.now() steps its whole 0.2Hz drift at once on release, which is
    # a pop where the pause was supposed to be invisible. Two frames either side
    # of a held second have to be near neighbours, not a jump.
    before = page.evaluate("document.getElementById('heroTimeAscii').toDataURL()")
    page.wait_for_timeout(900)
    frozen = page.evaluate("document.getElementById('heroTimeAscii').toDataURL()")
    page.mouse.up()
    page.wait_for_timeout(1700)
    freed = page.evaluate("window.HeroAsciiField.probe(false)")
    if verbose:
        print(f"    under the finger: running={held['running']} frozen over 0.9s={before == frozen}; "
              f"after release: running={freed['running']}")
    if held["running"]:
        failures.append(
            "the field kept drawing while the head was under the pointer. Decoration stands "
            "aside for direct manipulation -- and it is not manners, it is the measurement: "
            "hero-head-physics-contract fails on the spring's merged frames when it does not.")
    if before != frozen:
        failures.append(
            "the field changed while the head was held. It is supposed to be holding its last "
            "frame, not drawing a slower one.")
    if not freed["running"]:
        failures.append(
            "the field never came back after the head was released. A hold with no matching "
            "release is a field frozen for the rest of the session.")


# ── 5 · the field answers the cursor: away, brighter, and by a fade ──────────
# HOW THIS IS MEASURED, because "a screenshot looked different" is not an
# assertion. Every glyph is drawn at its cell centre plus a per-glyph jitter of
# at most 2.2px plus the cursor displacement. The contract asks the renderer for
# the centres it actually drew (HeroAsciiField.capture, off in every shipped
# frame), recovers each glyph's cell by rounding -- exact while |push| + 2.2 is
# under half a cell, which is asserted below -- and averages the residual over 16
# frames. The jitter is two sines over a phase that differs per glyph and a time
# that moves between frames, so it averages to zero and what is left is the
# displacement itself. Then that is compared against the law, per cell, not
# against "some number went up".
CURSOR_FRAMES = 16
NEAR_PX = 120.0          # the band the assertions are made in, around the pointer
# THE DISPLACEMENT TOLERANCE IS RELATIVE TO THE INSTRUMENT'S OWN NOISE FLOOR,
# not an absolute number of pixels, and that is a correction. It was 1.5px, which
# was calibrated when the jitter was 2.2px on a 21px cell; the pitch moved to 26,
# the jitter moved with it to 2.72, the residual noise moved with THAT, and the
# assertion started failing at 1.51 on a field that was doing exactly the right
# thing. A fixed pixel tolerance on a measurement whose noise scales with the
# pitch is a gate that fails on the pitch instead of on the behaviour.
# So the cursor-away gather is the zero. Measured: 1.50 at rest and 1.51 with the
# cursor parked -- identical, because every pixel of that is jitter and the
# displacement itself is matched. Pulling instead of pushing puts roughly twice
# the displacement into the error and lands near 3px, which this catches easily.
# Measured with the cursor parked and the field correct: 0.69 at rest, 1.07
# active. The active gather is always the noisier of the two and it is not the
# displacement -- the brightness lift pulls cells in and out of the ramp near the
# pointer, so those cells are sampled in fewer of the frames and their mean is
# less settled. 2.2x leaves room for that and is still nowhere near what a wrong
# law costs: pulling instead of pushing puts twice the displacement into the
# error and reads 3.5px+ (--self-test).
PUSH_MAE_RATIO = 2.2     # active mean-abs-error against the at-rest floor
PUSH_MAE_FLOOR = 1.30    # px, so a very quiet baseline cannot make it hair-trigger
# Cells past 1.6x REACH see no influence at all, so the SAME statistic with the
# cursor away is the zero to read them against -- not 0.0. Those cells sit at the
# outer edge of the lit ellipse where the mask is small, the alpha is low and
# glyphs flicker in and out of the ramp, which is the noisiest place in the
# picture and has no business being compared to an absolute.
FAR_DRIFT_MAX = 1.6      # px, |active - at rest| in the far band
BASELINE_RADIAL_MAX = 1.0  # px, what "no cursor" is allowed to look like


def gather_cells(page, frames=CURSOR_FRAMES):
    """Mean residual and mean alpha per cell, over `frames` captured draws.

    IT REPORTS ITS FRAME COUNT, AND THE CALLER CORRECTS FOR IT. The residual this
    measurement is built on is the per-glyph jitter averaged toward zero, and how
    close to zero it gets depends entirely on HOW MANY frames went into the mean.
    The first version ran a fixed number of attempts and skipped the ones that
    timed out, so on a loaded machine the cursor-away gather and the cursor-on
    gather could average different numbers of frames and be compared against each
    other anyway -- which produced a 0.73 baseline against a 1.48 active reading
    on a field that was measurably correct in the run before.
    Demanding equal counts instead was the next attempt and it was worse: on a box
    at load average 26 the second gather ran out of budget at 14 frames against
    16, the contract declared the instrument broken, and three real injected bugs
    went past it unnoticed. A gate that refuses to measure is not safer than one
    that measures carefully. Noise in the mean falls as 1/sqrt(frames), so the
    count is returned and the floor is scaled by it."""
    cells, meta, taken = {}, None, 0
    deadline = time.monotonic() + 120
    while taken < frames and time.monotonic() < deadline:
        page.evaluate("window.HeroAsciiField.capture()")
        got = None
        for _ in range(90):
            page.wait_for_timeout(12)
            got = page.evaluate("window.HeroAsciiField.takeCapture()")
            if got:
                break
        if not got:
            continue
        taken += 1
        meta = got
        d, cell = got["data"], got["cell"]
        for k in range(0, len(d), 3):
            x, y, a = d[k], d[k + 1], d[k + 2]
            cx = round((x - cell / 2) / cell)
            cy = round((y - cell / 2) / cell)
            e = cells.setdefault((cx, cy), [0.0, 0.0, 0, 0.0])
            e[0] += x - (cx * cell + cell / 2)
            e[1] += y - (cy * cell + cell / 2)
            e[2] += 1
            e[3] += a
    return cells, meta, taken


def cursor_stats(cells, meta, probe, taken, ref):
    """Radial residual, alpha and per-cell agreement with the documented law.

    `ref` IS THE POINT THE BANDS ARE DRAWN AROUND AND IT IS THE SAME FOR BOTH
    GATHERS, while `meta["ptr"]` -- where the pointer actually was -- is what the
    law is predicted from. Those are the same point when the cursor is parked and
    they are not when it is away, and conflating them made the at-rest gather a
    zero for a DIFFERENT REGION of the Hero: with the pointer parked below the
    Hero its "near band" was the bottom strip, which is the brightest part of the
    lit ellipse, so the near/far alpha ratio it produced was a fact about the
    gradient rather than about the cursor. Banding both gathers on the same point
    makes the at-rest numbers the honest baseline for the active ones.
    """
    cell, (bw, bh) = meta["cell"], meta["box"]
    ptx, pty = meta["ptr"]
    px, py = ref
    reach, push, act = probe["reach"], probe["push"], meta["act"]
    near_r, near_a, near_n, far_r, far_a, far_n, errs = 0.0, 0.0, 0, 0.0, 0.0, 0, []
    cellalpha = {}
    for (cx, cy), (sx, sy, n, sa) in cells.items():
        if n < taken * 0.5:
            continue
        gx, gy = cx * cell + cell / 2, cy * cell + cell / 2
        mrx, mry = sx / n, sy / n
        dx, dy = gx - px, gy - py
        r = (dx * dx + dy * dy) ** 0.5
        # the law, in the renderer's own normalised space (an ellipse in pixels),
        # predicted from where the pointer really was
        ex, ey = gx / bw - ptx, gy / bh - pty
        nn = (ex * ex + ey * ey) ** 0.5
        infl = max(0.0, 1 - nn / reach) * act
        vx = vy = 0.0
        if infl > 0 and nn > 1e-4:
            vx, vy = ex / nn * infl * push, ey / nn * infl * push
        errs.append(abs(mrx - vx))
        errs.append(abs(mry - vy))
        cellalpha[(cx, cy)] = (sa / n, infl / act if act else 0.0, n / taken)
        if r < 1:
            continue
        refn = ((gx / bw - px / bw) ** 2 + (gy / bh - py / bh) ** 2) ** 0.5
        if r <= NEAR_PX:
            near_r += (mrx * dx + mry * dy) / r
            near_a += sa / n
            near_n += 1
        elif refn > reach * 1.6:
            far_r += (mrx * dx + mry * dy) / r
            far_a += sa / n
            far_n += 1
    return {"radial": near_r / near_n if near_n else 0.0,
            "alpha": near_a / near_n if near_n else 0.0,
            "far": far_r / far_n if far_n else 0.0,
            "faralpha": far_a / far_n if far_n else 0.0,
            "mae": sum(errs) / len(errs) if errs else 99.0,
            "n": near_n, "frames": taken, "cellalpha": cellalpha}


def hero_point(page, fx, fy):
    """Viewport coordinates of a point in the field, plus the canvas origin so a
    caller can turn them back into the canvas-local pixels the capture reports."""
    return page.evaluate("""(f)=>{const r=document.getElementById('heroTimeAscii')
        .getBoundingClientRect(); return {x:r.x+r.width*f[0], y:r.y+r.height*f[1],
        ox:r.x, oy:r.y,
        below:{x:r.x+r.width*0.5, y:r.y+r.height+240}};}""", [fx, fy])


def check_cursor(page, failures, verbose):
    set_state(page, "night")
    page.wait_for_timeout(400)
    at = hero_point(page, 0.30, 0.80)
    probe = page.evaluate("window.HeroAsciiField.probe(false)")

    # The cell-recovery this whole measurement rests on is only exact while a
    # glyph cannot be displaced past half a cell. Assert the premise, not just
    # the conclusion -- if PUSH is raised past this the numbers below would keep
    # looking plausible while measuring the wrong cells.
    if abs(probe["push"]) + probe["jitter"] >= probe["cell"] / 2:
        failures.append(
            f"PUSH {probe['push']:.2f} + jitter {probe['jitter']:.2f} is {probe['cell']/2:.2f} or more "
            f"against a {probe['cell']}px cell. Both are written as ratios of the pitch (1/3 and "
            "2.2/21) precisely so this holds at any pitch, so reaching it means one of them has been "
            "made a literal again. A displaced glyph then lands nearer its neighbour's slot than its "
            "own: unrecoverable here, and on screen the field stops being a grid that flexes and "
            "becomes glyphs swapping places.")
    # THE MARK IS THE THING HE LOOKED AT. Coverage cannot police the pitch any
    # more and that is correct rather than a gap: the glyph is now a ratio of the
    # cell, so shrinking the pitch shrinks the marks with it and the fraction of
    # the Hero they cover barely moves -- measured .0048 at pitch 26, .0045 at 12,
    # .0086 at 7. What changes is whether you can SEE one, which is the thing
    # Jayden actually reported about the 12px mark the port shipped with. So the
    # assertion is on the drawn size, two-sided: under 13.5 that judgement is
    # being quietly undone, over 20 the ramp's two blanks stop reading as holes in
    # a texture and start reading as gaps in a row, which is the failure at the
    # other end and the reason the pitch is 26 and not 30.
    if not (13.5 <= probe["font"] <= 20.0):
        failures.append(
            f"the glyph is drawn at {probe['font']:.1f}px on a {probe['cell']}px cell, outside "
            "[13.5, 20]. That is too small to read or too big to be grain -- and the pitch is the "
            "only lever for it, because alpha past a point stops reading as brighter marks and "
            "starts reading as a dirtier sky.")
    if abs(probe["font"] / probe["cell"] - 12 / 21) > 0.02:
        failures.append(
            f"the glyph is {probe['font']:.1f}px in a {probe['cell']}px cell, a ratio of "
            f"{probe['font']/probe['cell']:.3f} against the Workspace bundle's 12/21 = 0.571. The mark "
            "and its slot are one decision; a glyph that does not grow with the pitch is how "
            '"make it bigger" turns into "make it sparser".')

    # ── cursor away ──────────────────────────────────────────────────────────
    page.mouse.move(at["below"]["x"], at["below"]["y"])
    page.wait_for_timeout(1300)
    rest = page.evaluate("window.HeroAsciiField.probe(false)")
    c0, m0, f0 = gather_cells(page)
    ref = (at["x"] - at["ox"], at["y"] - at["oy"])
    s0 = cursor_stats(c0, m0, probe, f0, ref) if m0 else None

    # ── cursor parked in the lit band ────────────────────────────────────────
    page.mouse.move(at["x"], at["y"])
    page.wait_for_timeout(40)
    page.mouse.move(at["x"] + 1, at["y"])
    page.wait_for_timeout(700)
    hot = page.evaluate("window.HeroAsciiField.probe(false)")
    c1, m1, f1 = gather_cells(page)
    s1 = cursor_stats(c1, m1, probe, f1, ref) if m1 else None

    if verbose:
        print(f"    at rest:   act={rest['act']:.3f} radial={s0['radial']:+.3f}px "
              f"alpha={s0['alpha']:.4f}/{s0['faralpha']:.4f} mae={s0['mae']:.3f} frames={f0}" if s0 else "    at rest: no capture")
        print(f"    on cursor: act={hot['act']:.3f} radial={s1['radial']:+.3f}px "
              f"alpha={s1['alpha']:.4f}/{s1['faralpha']:.4f} mae={s1['mae']:.3f} far={s1['far']:+.3f} frames={f1}" if s1 else "    on cursor: no capture")

    if not s0 or not s1 or s1["n"] < 8 or min(f0, f1) < 10:
        failures.append(
            f"THE INSTRUMENT FAILED, not the field: {f0} and {f1} frames captured against "
            f"{CURSOR_FRAMES} wanted, {s1['n'] if s1 else 0} cells in range. Ten frames a side is the "
            "floor at which the jitter has averaged far enough toward zero for any of this to mean "
            "anything. Re-run on a machine that is not being throttled rather than reading anything "
            "into it.")
        return
    # The noise in a mean falls as 1/sqrt(n), so an unequal gather is corrected
    # rather than rejected: the at-rest floor is what it would have been had it
    # been measured over the same number of frames as the active one.
    noise_scale = (f0 / f1) ** 0.5

    if rest["act"] > 0.01:
        failures.append(
            f"with the pointer parked outside the Hero the activation is {rest['act']:.3f}. It has "
            "to reach zero, or the field carries a permanent bulge wherever the cursor last was.")
    if hot["act"] < 0.98:
        failures.append(
            f"with the pointer parked in the field for 700ms the activation only reached "
            f"{hot['act']:.3f}. ACT_RISE is 160ms to 95%; anything this slow reads as lag, which "
            "is section 1 of the Apple reference and the thing the whole effect is for.")

    if abs(s0["radial"]) > BASELINE_RADIAL_MAX:
        failures.append(
            f"with no cursor the glyphs already sit {s0['radial']:+.2f}px off their own slots "
            f"radially (limit {BASELINE_RADIAL_MAX}). The measurement's zero has moved, so every "
            "number below it is being read against the wrong baseline.")
    if s1["radial"] < 3.5:
        failures.append(
            f"with the pointer parked the glyphs within {NEAR_PX:.0f}px moved {s1['radial']:+.2f}px "
            "radially, and the whole effect is that they move AWAY. Negative means they are being "
            "pulled toward the cursor -- the field collecting under the pointer instead of opening "
            "around it -- and near zero means PUSH is off.")
    mae_limit = max(PUSH_MAE_FLOOR, s0["mae"] * noise_scale * PUSH_MAE_RATIO)
    if s1["mae"] > mae_limit:
        failures.append(
            f"the measured displacement disagrees with the documented law by {s1['mae']:.2f}px per "
            f"axis, against {mae_limit:.2f} -- the same gather with the cursor away reads "
            f"{s0['mae']:.2f}, and that is pure jitter. REACH {probe['reach']}, PUSH "
            f"{probe['push']:.2f} (CELL/3) and the 1 - n/REACH falloff are the Workspace bundle's "
            "own numbers; the field is no longer doing what this file says it does.")
    if abs(s1["far"] - s0["far"] * noise_scale) > FAR_DRIFT_MAX:
        failures.append(
            f"cells past 1.6x REACH read {s1['far']:+.2f}px radially with the cursor parked against "
            f"{s0['far']:+.2f}px with it away -- a shift of "f"{abs(s1['far']-s0['far']*noise_scale):.2f}px where "
            f"the limit is {FAR_DRIFT_MAX}. The falloff is supposed to reach zero AT REACH; a cursor "
            "that disturbs the whole Hero is a wash, not a touch.")
    # ── THE BRIGHTNESS IS A PAIRED, PER-CELL MEASUREMENT ─────────────────────
    # Two simpler versions were tried and both were too noisy to trust, which is
    # worth recording because both LOOKED fine on a good run:
    #   near-band mean, cursor gather vs rest gather -- the field's own slow
    #     weather moves the mean alpha of any fixed region by tens of percent
    #     between two gathers seconds apart, and each gather spans 0.6s, so both
    #     sample one instant of it.
    #   near/far within each gather, then compared -- same problem one level up:
    #     the at-rest ratio measured 1.12, 2.11 and 2.41 on three runs of an
    #     unchanged field, and the LIFT=0 injection slipped through one of them.
    # What is weather-invariant is a RATIO PER CELL. The weather multiplies every
    # cell by about the same factor, so dividing each cell's cursor-on alpha by
    # its own cursor-off alpha cancels it; what is left is what the cursor did to
    # that cell. Cells the cursor reaches are then compared against cells it
    # cannot -- the same subtraction, done where it survives.
    # ONLY CELLS THAT WERE DRAWN IN NEARLY EVERY FRAME OF BOTH GATHERS. A cell
    # that flickers in and out of the ramp has a mean over a different, smaller
    # sample each side, and near the pointer the displacement makes that
    # systematic rather than random: glyphs pushed outward crowd into their
    # neighbours' slots and vacate their own, so the survivors of a naive filter
    # are biased bright. With LIFT zeroed that bias alone read +10.2% against a
    # 12% floor -- a real bug with 1.8 points of margin. Stable cells only, and
    # the closest ring rather than the whole reach, puts it at a distance a
    # scheduler cannot close.
    ratios_hot, ratios_cold = [], []
    for key, (a1, infl, seen1) in s1["cellalpha"].items():
        prior = s0["cellalpha"].get(key)
        if not prior or prior[0] <= 0 or seen1 < 0.8 or prior[2] < 0.8:
            continue
        q = a1 / prior[0]
        if infl >= 0.7:
            ratios_hot.append(q)
        elif infl <= 0.0:
            ratios_cold.append(q)
    q_hot = sum(ratios_hot) / len(ratios_hot) if ratios_hot else 0.0
    q_cold = sum(ratios_cold) / len(ratios_cold) if ratios_cold else 0.0
    lift = (q_hot / q_cold - 1) if q_cold else -1
    if verbose:
        print(f"    lift: {len(ratios_hot)} reached cells x{q_hot:.3f}, "
              f"{len(ratios_cold)} unreached x{q_cold:.3f} -> {lift*100:+.1f}%")
    if len(ratios_hot) < 12 or len(ratios_cold) < 12:
        failures.append(
            f"only {len(ratios_hot)} reached and {len(ratios_cold)} unreached cells survived both "
            "gathers, so a lift of any size could not be computed and the brightness half of the "
            "cursor is going unmeasured.")
    elif lift < 0.12:
        failures.append(
            f"cells the cursor reaches changed alpha by x{q_hot:.3f} against x{q_cold:.3f} for cells "
            f"it cannot -- a lift of {lift*100:+.1f}% where 12% is the floor. LIFT is added to b "
            "BEFORE the ramp index, so the cursor is supposed to pick denser characters as well as "
            "brighter ones -- that is what makes it read as light rather than as things sliding "
            "about. Dropped, the effect still 'works' and is wrong.")

    # ── the activation is a fade, not a boolean ──────────────────────────────
    page.mouse.move(at["below"]["x"], at["below"]["y"])
    trail = page.evaluate("""async ()=>{const out=[];const t0=performance.now();
      return await new Promise(res=>{function f(){out.push([performance.now()-t0,
        window.HeroAsciiField.probe(false).act]);
        if(performance.now()-t0>1100)return res(out); setTimeout(f,45);} f();});}""")
    mid = [a for _t, a in trail if 0.05 < a < 0.95]
    ended = trail[-1][1]
    if verbose:
        print("    fade after leaving: " + " ".join(f"{int(t)}:{a:.3f}" for t, a in trail[::3]))
    if len(mid) < 3:
        failures.append(
            f"the activation passed through {len(mid)} intermediate values on its way down (needs 3). "
            "It is being assigned from its target rather than eased toward it, which is the bundle's "
            "own hard boolean -- fine on a full-bleed band, a pop on a Hero that has edges.")
    if ended > 0.05:
        failures.append(
            f"1.1s after the pointer left the Hero the activation is still {ended:.3f}. ACT_FALL is "
            "500ms to 95%; a field that never lets go is a field that is always on.")


# ── 6 · touch is not a cursor ────────────────────────────────────────────────
def check_touch(browser, base, failures, verbose):
    """A real touch drag, dispatched through the debugger rather than synthesised
    in the page, because a page-made PointerEvent is not what a finger sends and
    would not exercise the guard the same way."""
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              has_touch=True, is_mobile=True)
    page = ctx.new_page()
    page.goto(f"{base}/index.html", wait_until="load")
    page.wait_for_function("window.SiteTheme && window.HeroAsciiField")
    page.wait_for_timeout(1400)
    set_state(page, "night")
    cdp = ctx.new_cdp_session(page)
    at = hero_point(page, 0.16, 0.86)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart",
                                          "touchPoints": [{"x": at["x"], "y": at["y"]}]})
    for i in range(1, 11):
        page.wait_for_timeout(45)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove",
                 "touchPoints": [{"x": at["x"] + i * 14, "y": at["y"] - i * 4}]})
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    page.wait_for_timeout(2600)          # past the head's 1200ms hold and then some
    probe = page.evaluate("window.HeroAsciiField.probe(false)")
    if verbose:
        print(f"    after a real touch drag: act={probe['act']:.3f} actTo={probe['actTo']} "
              f"ptr={[round(v,3) for v in probe['ptr']]}")
    if probe["act"] > 0.01 or probe["actTo"] != 0:
        failures.append(
            f"a touch drag left the field activated (act {probe['act']:.3f}, target {probe['actTo']}). "
            "There is no hover on a touch device: a touch pointermove exists only between down and "
            "up, which is the window the field is already held for the head, so the only thing a "
            "touch user can see of the cursor term is a bulge that appears after their finger has "
            "gone. Measured with the move guard removed and the leave guard left: act 1.000 at "
            "+1.6s and still 1.000 at +3.0s -- permanent, for the rest of the session.")
    if probe["ptr"] != [0.5, 0.5]:
        failures.append(
            f"a touch drag wrote the pointer reference ({probe['ptr']}). Even when the activation "
            "happens to settle at zero, a written pointer means the next real cursor entry opens "
            "the field somewhere a finger was rather than where the mouse is.")
    page.context.close()


# ── 7 · reduced motion gets the still frame, not an absent one ────────────────
def check_reduced_motion(browser, base, failures, verbose):
    page = open_hero(browser, base, 1440, 900, reduced=True)
    set_state(page, "night")
    probe = page.evaluate("window.HeroAsciiField.probe(false)")
    first = page.evaluate("document.getElementById('heroTimeAscii').toDataURL()")
    # THE CURSOR IS DRIVEN ACROSS THE FIELD INSIDE THIS WINDOW, on purpose. A
    # surface that chases the pointer is motion of exactly the kind section 14
    # names, and the still frame has to be still under a moving mouse and not
    # only under an idle one. Both halves are checked by this: the displacement
    # would move glyphs and the brightness lift would change their alpha, and
    # either one changes the bytes.
    at = hero_point(page, 0.30, 0.80)
    for step in range(8):
        page.mouse.move(at["x"] + step * 26, at["y"] - step * 12)
        page.wait_for_timeout(90)
    page.wait_for_timeout(1500)
    second = page.evaluate("document.getElementById('heroTimeAscii').toDataURL()")
    after = page.evaluate("window.HeroAsciiField.probe(false)")
    if verbose:
        print(f"    reduce: glyphs={probe['glyphs']} running={probe['running']} "
              f"identical over 2.2s incl. a cursor sweep={first == second} act={after['act']:.3f}")
    if after["act"] > 0:
        failures.append(
            f"under prefers-reduced-motion the cursor activation reached {after['act']:.3f}. The "
            "still frame passes a literal zero for exactly this reason -- not `act`, which could "
            "leak in from before the setting changed.")
    if probe["glyphs"] <= 0:
        failures.append(
            "under prefers-reduced-motion the field painted nothing. Reduced motion is a gentler "
            "equivalent, not an absent one -- the original already carries a single-frame path "
            "and so must this.")
    if probe["running"]:
        failures.append("under prefers-reduced-motion the field still holds a rAF handle.")
    if first != second:
        failures.append(
            "under prefers-reduced-motion the field changed between frames while the cursor was "
            "driven across it. A full-width surface of oscillating alpha is the exact thing "
            "section 14 names, and one that answers the mouse is the same thing with a trigger.")
    page.context.close()


# ── 6 · it costs what it was measured to cost ─────────────────────────────────
def check_cost(browser, base, failures, verbose):
    for width, height in ((1440, 900), (2560, 1400)):
        page = open_hero(browser, base, width, height)
        for state in ("daytime", "night"):
            set_state(page, state)
            page.evaluate("window.HeroAsciiField.probe(true)")
            r = page.evaluate(DRAW_SAMPLER, 10)
            probe = page.evaluate("window.HeroAsciiField.probe(false)")
            if verbose:
                print(f"    {width}x{height} {state:8s} glyphs={probe['glyphs']:5d} "
                      f"drew={r['drew']:4d}/{r['budget']:4d} host={r['rafFps']:5.1f}fps "
                      f"p50={r['p50']:.2f} p95={r['p95']:.2f} "
                      f"max={r['max']:.2f} dropped={r['dropped']}")
            if r["budget"] < 30 or r["n"] < 20:
                failures.append(
                    f"{width}x{height}/{state}: the host served {r['rafFps']}fps, so there were only "
                    f"{r['budget']} frames the field could have drawn in and {r['n']} usable timing "
                    "samples. That is too few to say anything about the field. This is the "
                    "instrument, not the code -- run it on a machine that is not saturated.")
                continue
            if r["drew"] < r["budget"] * 0.9:
                failures.append(
                    f"{width}x{height}/{state}: the field drew {r['drew']} times out of {r['budget']} "
                    f"it had frames for (host {r['rafFps']}fps). The budget is this contract running "
                    "the field's OWN 33ms rule over the frames the host delivered, so it already "
                    "allows for a slow or bursty host; missing a tenth of what that rule asked for "
                    "means the loop is stalling, being paused and not resumed, or losing its rAF "
                    "handle.")
            if r["p95"] > DRAW_P95_MS:
                failures.append(
                    f"{width}x{height}/{state}: the field's own p95 self-time is {r['p95']:.2f}ms "
                    f"against a ceiling of {DRAW_P95_MS}ms. Do not raise the ceiling -- the density "
                    "knob is the cell pitch and the gate is the lit ellipse, and both are cheaper "
                    "than the frame.")
            if r["dropped"] > max(1, int(r["n"] * DROPPED_RATE)):
                failures.append(
                    f"{width}x{height}/{state}: {r['dropped']} of {r['n']} drawn frames took longer "
                    f"than one 60fps frame ({FRAME_MS}ms) inside draw() alone. The site's standing "
                    "bar is 60fps and this is decoration.")
        page.context.close()


def run_pass(group, verbose, cost=True):
    """One full sweep of the page. `group` selects which mutations the server
    injects, or None for the tree as it stands."""
    httpd, base = serve(group is not None, group)
    failures = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = open_hero(browser, base, 1440, 900)
            check_stacking(page, failures, verbose)
            check_presence(page, failures, verbose)
            check_legibility(page, failures, verbose, 1440, 900)
            check_cursor(page, failures, verbose)
            check_yield(page, failures, verbose)
            page.context.close()

            check_touch(browser, base, failures, verbose)

            page = open_hero(browser, base, 390, 844)
            check_legibility(page, failures, verbose, 390, 844)
            page.context.close()

            check_reduced_motion(browser, base, failures, verbose)
            if cost:
                check_cost(browser, base, failures, verbose)
            browser.close()
    finally:
        # shutdown() stops serve_forever; it does NOT release the socket, and
        # this file now opens the port twice in one run. Without the close the
        # second pass dies on EADDRINUSE and the four cursor injections go in
        # with nothing watching -- the same failure mode the two passes exist to
        # prevent, one layer down.
        httpd.shutdown()
        httpd.server_close()
    return failures


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--self-test", action="store_true",
                    help="serve a mutated index.html / hero-time.css re-injecting every "
                         "regression this file claims to catch, in two passes; each pass "
                         "must then produce a finding NAMING each bug it was given")
    args = ap.parse_args()

    if args.self_test:
        # The cost sweep is skipped here on purpose. It is a timing measurement,
        # it takes 40 seconds of the run, and no mutation in either group is
        # aimed at it -- the pitch's deterministic half is the mark-size band,
        # which check_cursor asserts. Leaving it in would only add the machine's
        # own noise to a pass/fail about detection.
        missed_any = False
        for group, tags in GROUPS.items():
            failures = run_pass(group, args.verbose, cost=False)
            blob = " || ".join(failures).lower()
            missed = [(t, w) for _f, _o, _n, t, w in MUTATIONS
                      if t in tags and t.lower() not in blob]
            print(f"SELF-TEST [{group}] -- {len(tags)} regressions injected, "
                  f"{len(failures)} findings, {len(tags) - len(missed)} of {len(tags)} "
                  "caught by name.")
            for f in failures:
                print("  -", f)
            if missed:
                missed_any = True
                print(f"\n  MISSED in [{group}]:")
                for tag, why in missed:
                    print(f"    - [{tag}] {why}")
            print()
        if missed_any:
            print("SELF-TEST FAIL -- an injection that cannot fail is worse than none: it is a "
                  "green line that means nothing. Re-anchor the mutation or add the assertion "
                  "it needs.")
            return 1
        print("SELF-TEST PASS -- every injected regression produced a finding that names it.")
        return 0

    failures = run_pass(None, args.verbose)
    if failures:
        print(f"FAIL -- {len(failures)} findings:")
        for f in failures:
            print("  -", f)
        return 1
    print("Hero glyph field: OK -- reads as light on all six skies, answers the cursor and lets "
          "go of it, stays off every hit target, holds still under reduced motion, and draws "
          "inside the frame.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
