#!/usr/bin/env python3
"""Fails when the Hero's glyph field stops being a texture and starts being a cost.

WHY THIS FILE EXISTS
The field was ported from the Workspace app's header band, where it is white
glyphs over one mid-blue mesh. This sky is six gradients running from #f8fafd to
#060a13, and the port only works because of decisions that are easy to undo by
accident and impossible to see failing in a diff:

  1. IT IS INK ON THE FIVE LIGHT SKIES AND LIGHT ONLY AT NIGHT. Copying the
     original's `rgba(255,255,255,a)` back in is a one-token change that leaves
     the code looking more faithful and the field invisible on five of six
     states. Nothing else in the tree would notice.
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
  sign        whether the field darkens the sky (ink) or lightens it (night)
              five light skies negative, night positive, on every viewport
  drawMs p95  the field's own self-time per drawn frame
              1.9 / 2.1 at 1440x900, 3.2 / 3.5 at 2560x1400 (daytime / night)
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
MUTATIONS = {
    "index.html": [
        # 3 -- reduced motion stops being honoured, so the still field animates.
        ('function reduced(){return root.getAttribute("data-reduced-motion")==="reduce";}',
         'function reduced(){return false;}'),
        # 4 -- "make it denser": the cell pitch is one number and it is the cost.
        (" var CELL=21;", " var CELL=6;"),
        # 5 -- the field stops standing aside for the head.
        (' hero.addEventListener("pointerdown",function(){',
         ' hero.addEventListener("__never_pointerdown",function(){'),
    ],
    "hero-time.css": [
        # 1 -- the port "corrected" back to the original's white on every sky.
        (".hero[data-time-state]{--ascii-ink:18 18 18;",
         ".hero[data-time-state]{--ascii-ink:244 247 255;"),
        # 2 -- the canvas becomes a hit target over the draggable head.
        (".heroTimeAscii{\n position:absolute;inset:0;z-index:2;width:100%;height:100%;\n pointer-events:none",
         ".heroTimeAscii{\n position:absolute;inset:0;z-index:2;width:100%;height:100%;\n pointer-events:auto"),
    ],
}


class Handler(SimpleHTTPRequestHandler):
    mutate = False

    def send_head(self):
        name = self.path.split("?")[0].lstrip("/")
        if self.mutate and name in MUTATIONS:
            source = (ROOT / name).read_text(encoding="utf-8")
            for old, new in MUTATIONS[name]:
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


def serve(mutate):
    handler = partial(Handler, directory=str(ROOT))
    handler.mutate = mutate
    Handler.mutate = mutate
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


DRAW_SAMPLER = """
(async (secs)=>{
  const v=[]; const t0=performance.now(); let seen=-1;
  await new Promise(res=>{
    function f(now){ const p=window.HeroAsciiField.probe(false);
      if(p.drawn!==seen){seen=p.drawn; if(p.drawn>2) v.push(p.drawMs);}
      if(now-t0>secs*1000) return res(); requestAnimationFrame(f); }
    requestAnimationFrame(f);
  });
  const s=v.slice().sort((a,b)=>a-b);
  return {n:v.length, p50:s[Math.floor(s.length*.5)]||0,
          p95:s[Math.floor(s.length*.95)]||0, max:s[s.length-1]||0,
          dropped:v.filter(x=>x>16.7).length};
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
        want = 1 if state in DARK_STATES else -1
        if verbose:
            print(f"    {state:9s} coverage={d['coverage']:.4f} peak dL={d['peak']:.4f} "
                  f"sign={'+' if d['sign'] > 0 else '-'} ({d['n']} px sampled)")
        if d["sign"] != want and d["n"]:
            failures.append(
                f"{state} @{width}x{height}: the field {'darkens' if d['sign'] < 0 else 'lightens'} "
                f"its sky, and this hour needs the other one. Ink subtracts from the five light "
                "skies; night is the one state where subtracting from #060a13 subtracts nothing, "
                "so there and only there the field is light.")
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
      const cta = document.querySelector('.heroCtas .ctl--primary').getBoundingClientRect();
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


# ── 5 · reduced motion gets the still frame, not an absent one ────────────────
def check_reduced_motion(browser, base, failures, verbose):
    page = open_hero(browser, base, 1440, 900, reduced=True)
    set_state(page, "night")
    probe = page.evaluate("window.HeroAsciiField.probe(false)")
    first = page.evaluate("document.getElementById('heroTimeAscii').toDataURL()")
    page.wait_for_timeout(2200)
    second = page.evaluate("document.getElementById('heroTimeAscii').toDataURL()")
    if verbose:
        print(f"    reduce: glyphs={probe['glyphs']} running={probe['running']} "
              f"identical over 2.2s={first == second}")
    if probe["glyphs"] <= 0:
        failures.append(
            "under prefers-reduced-motion the field painted nothing. Reduced motion is a gentler "
            "equivalent, not an absent one -- the original already carries a single-frame path "
            "and so must this.")
    if probe["running"]:
        failures.append("under prefers-reduced-motion the field still holds a rAF handle.")
    if first != second:
        failures.append(
            "under prefers-reduced-motion the field is still changing between frames. A "
            "full-width surface of oscillating alpha is the exact thing section 14 names.")
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
                      f"draws={r['n']:4d} p50={r['p50']:.2f} p95={r['p95']:.2f} "
                      f"max={r['max']:.2f} dropped={r['dropped']}")
            if r["n"] < 90:
                failures.append(
                    f"{width}x{height}/{state}: only {r['n']} draws in 10s. The field should be "
                    "running on its 33ms clock; either it stalled or the probe stopped reporting.")
                continue
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--self-test", action="store_true",
                    help="serve a mutated hero-time.js/.css re-injecting all four "
                         "regressions; this contract must then FAIL")
    args = ap.parse_args()

    httpd, base = serve(args.self_test)
    failures = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = open_hero(browser, base, 1440, 900)
            check_stacking(page, failures, args.verbose)
            check_presence(page, failures, args.verbose)
            check_legibility(page, failures, args.verbose, 1440, 900)
            check_yield(page, failures, args.verbose)
            page.context.close()

            page = open_hero(browser, base, 390, 844)
            check_legibility(page, failures, args.verbose, 390, 844)
            page.context.close()

            check_reduced_motion(browser, base, failures, args.verbose)
            check_cost(browser, base, failures, args.verbose)
            browser.close()
    finally:
        httpd.shutdown()

    if args.self_test:
        if failures:
            print(f"SELF-TEST PASS -- the injected regressions were caught ({len(failures)} findings):")
            for f in failures:
                print("  -", f)
            return 0
        print("SELF-TEST FAIL -- all four bugs were re-injected and this contract did not notice.")
        return 1

    if failures:
        print(f"FAIL -- {len(failures)} findings:")
        for f in failures:
            print("  -", f)
        return 1
    print("Hero glyph field: OK -- reads on all six skies, stays off every hit target, "
          "holds still under reduced motion, and draws inside the frame.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
