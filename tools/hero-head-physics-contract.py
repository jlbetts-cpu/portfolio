#!/usr/bin/env python3
"""The hero portrait's physics: soft boundaries, velocity handoff, interruption.

Four things this file exists to stop coming back, each of which was measured on
the build that shipped before it:

  1. THE BOUNDARY WAS A WALL. Jayden: "i dont like that you cant push the head
     past the boundary a little bit like its starting position -- if you pull it
     out and try to put it back you cant." Measured at 390x844, a thumb dragging
     the head to the top of the screen ran out of bound 27px before it ran out
     of screen, and those last 27px of travel moved nothing at all. It now
     resists progressively and springs back.

  2. THE ARRANGEMENT MUST STAY LEGAL ANYWAY. The give lives in its own additive
     channel; state.x/y -- what the clamp, reset() and every other contract
     reason about -- is committed at the release and is never a value outside
     the reachable region. If those two are ever merged, this file fails.

  3. THE FRAME IS WELDED TO THE HEAD, INCLUDING DURING THE GREETING. The arrival
     is a keyframe on --hero-head-enter-y, which the frame's geometry did not
     read: measured at 1440, the selection box sat 70px above the head for the
     420ms before the head was even visible, and the chin was still hanging out
     of the bottom edge 60ms into the rise.

  4. AN ANIMATION MUST BE GRABBABLE MID-FLIGHT WITH NO JUMP, from the
     presentation value rather than the target.

Every assertion has an injection under --self-test, because a detector nobody
has watched fail is one nobody should trust. The injections rewrite the served
hero-head-transform.js on the way to the browser, so the working tree is never
touched.

Serves the repo root on 127.0.0.1 on an ephemeral port -- never `localhost`,
which resolves to a different session's worktree.
"""
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
VIEWPORTS = ((1440, 900), (390, 844))

# THE RESTING COMPOSITION, PINNED. --hero-peek-width / -shift-x / -depth and
# --hero-head-rest-rotate were placed by hand off a coordinate HUD. The physics
# is odd-symmetric about the bound and the head rests inside its bounds on every
# axis, so none of it may move rest by so much as a pixel. Pinned as the
# wrapper's own painted matrix rather than as the tokens, because that is the
# thing a visitor sees and it catches a token that stopped being read.
REST_MATRIX = {
    (1440, 900): "matrix(0.971134, -0.238533, 0.238533, 0.971134, -137.5, 0)",
    (390, 844): "matrix(0.971134, -0.238533, 0.238533, 0.971134, -105.5, 0)",
}

STATE = "() => window.__heroHeadTransform.getState()"


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


def record(failures, ok, label, detail=None):
    print(("  ok   " if ok else "  FAIL ") + label
          + ("" if ok else "  %s" % (detail,)))
    if not ok:
        failures.append((label, detail))


# ── THE INJECTIONS ───────────────────────────────────────────────────────────
# Each one puts back exactly the bug the matching assertion was written for.
INJECTIONS = {
    # The band stops resisting on both axes: a hard clamp, the reported bug.
    "hard-clamp": (
        "if(!over||!dim)return 0;",
        "if(!over||!dim||1)return 0;",
    ),
    # The give leaks into the arrangement, which is what merging the two
    # channels back together would do -- and it is the failure that would put an
    # illegal position into everything downstream of the clamp.
    "leaky-arrangement": (
        "state.x=next.x;state.y=next.y;\n   /* PER AXIS",
        "state.x=rawX;state.y=rawY;\n   /* PER AXIS",
    ),
    # The frame stops reading the arrival's presentation value.
    "frame-ignores-arrival": (
        "+state.enterY\n    +cssNumber(wrap,\"--hero-head-float-y\");",
        "+cssNumber(wrap,\"--hero-head-float-y\");",
    ),
    # The grab starts from the target rather than from what is on screen.
    "grab-from-target": (
        "x:state.x+state.drift.x,y:state.y+state.drift.y};",
        "x:state.x,y:state.y};",
    ),
}


def inject(page, name):
    """Serve a mutated hero-head-transform.js. The tree is never written to."""
    if not name:
        return
    needle, replacement = INJECTIONS[name]
    source = (ROOT / "hero-head-transform.js").read_text(encoding="utf-8")
    assert needle in source, (
        "the injection no longer matches the file it is meant to break -- "
        "an injection that cannot fail is worse than none", name)
    mutated = source.replace(needle, replacement, 1)

    def handler(route):
        route.fulfill(status=200, content_type="text/javascript", body=mutated)

    page.route(re.compile(r"hero-head-transform\.js"), handler)


def settled_page(browser, base_url, width, height, injection=None, wait=1700):
    page = browser.new_page(viewport={"width": width, "height": height})
    inject(page, injection)
    page.goto(base_url + "/index.html", wait_until="load")
    page.wait_for_timeout(wait)
    page.wait_for_function("() => window.__heroHeadTransform")
    return page


def freeze_float(page):
    page.evaluate("() => window.__heroHeadTransform.stopFloat()")
    page.evaluate("""() => {const w=document.querySelector('#heroHeadTransform');
      ['--hero-head-float-x','--hero-head-float-y'].forEach(n=>w.style.setProperty(n,'0px'));
      w.style.setProperty('--hero-head-float-rot','0deg');}""")
    page.wait_for_timeout(60)


def push_past(page, dx, dy, steps=18, dwell=22):
    """Drive a real drag that runs out of bound before it runs out of gesture.

    page.mouse is Chromium's own input pipeline, not dispatchEvent: the handlers
    use setPointerCapture and a synthetic event reports failure on working code.
    """
    box = page.locator("#heroHeadSelection").bounding_box()
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    page.mouse.move(cx, cy)
    page.mouse.down()
    for i in range(1, steps + 1):
        page.mouse.move(cx + dx * i / steps, cy + dy * i / steps)
        page.wait_for_timeout(dwell)
    return page.evaluate(STATE)


def rest_is_untouched(page, width, height, failures):
    freeze_float(page)
    read = page.evaluate("""() => {
      const w=document.querySelector('#heroHeadTransform');
      const s=window.__heroHeadTransform.getState();
      return {matrix:getComputedStyle(w).transform,
        x:s.x,y:s.y,scale:s.scale,rotate:s.rotate,drift:s.drift};}""")
    label = "%dx%d resting composition is untouched by the physics" % (width, height)
    record(
        failures,
        read["matrix"] == REST_MATRIX[(width, height)]
        and read["x"] == 0 and read["y"] == 0
        and read["drift"]["x"] == 0 and read["drift"]["y"] == 0,
        label,
        {"want": REST_MATRIX[(width, height)], "got": read},
    )


def boundary_gives_and_returns(page, width, height, failures):
    """Past the bound the head keeps moving, and it comes back on its own."""
    page.evaluate("window.__heroHeadTransform.reset()")
    page.wait_for_timeout(80)
    # Straight up: the one bound a thumb can actually reach on a phone, and the
    # one Jayden's report is about.
    held = push_past(page, 0, -(height + 260))
    give = held["drift"]["y"]
    span = held["box"]["height"] * page.evaluate(
        "() => parseFloat(getComputedStyle(document.documentElement)"
        ".getPropertyValue('--hero-head-rubber-share'))")

    record(failures, give < -1,
           "%dx%d the top boundary gives rather than freezing" % (width, height),
           {"give": give})
    # SATURATION IS THE PROMISE. Apple's band cannot exceed its own dimension,
    # so a runaway give is a broken formula rather than a tuning question.
    record(failures, abs(give) <= span + .5,
           "%dx%d the give saturates at its share of the head" % (width, height),
           {"give": give, "share": span})
    # The arrangement is committed and legal even while the head is stretched.
    legal = page.evaluate("""() => {
      const s=window.__heroHeadTransform.getState();
      const hero=document.querySelector('#main').getBoundingClientRect();
      const bar=document.querySelector('.jbStick .jbNav')||document.querySelector('.jbStick');
      let ceiling=0;
      if(bar){const r=bar.getBoundingClientRect();
        if(r.bottom>hero.top&&r.top<hero.bottom&&r.width>0)
          ceiling=Math.min(r.bottom,hero.bottom)-hero.top;}
      const share=parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue('--hero-head-min-visible'))||.42;
      const need=Math.min(s.box.height*share,hero.height-ceiling);
      return {visible:Math.min(s.box.bottom,hero.height)-Math.max(s.box.top,ceiling),
        need:need};}""")
    record(failures, legal["visible"] >= legal["need"] - 1.5,
           "%dx%d the arrangement stays legal while the head is stretched"
           % (width, height), legal)

    trail = []
    page.mouse.up()
    for _ in range(26):
        page.wait_for_timeout(40)
        s = page.evaluate(STATE)
        trail.append(round(s["drift"]["y"], 3))
        if not s["settling"]:
            break
    # NO OVERSHOOT, EVER. Damping 1.0 means the band never crosses zero on its
    # way home: a bounce at the end of an elastic return is a second event where
    # the physics says there is one.
    crossed = [v for v in trail if v > 0.05]
    record(failures, not crossed,
           "%dx%d the return is critically damped" % (width, height), trail)
    record(failures, abs(trail[-1]) < .05 and not page.evaluate(STATE)["settling"],
           "%dx%d the band returns all the way home" % (width, height), trail)


def grabbable_mid_flight(page, width, height, failures):
    """A grab starts from what is on screen, not from where it is heading.

    A JUMP IS A PER-FRAME OUTLIER, NOT A DIFFERENCE ACROSS THE PRESS, and that
    distinction is the whole instrument. Reading the painted position, pressing,
    and reading it again measures the round trip as well as the press: at 60ms
    into a flick the head is legitimately covering ~10px a frame, so a healthy
    build reports several pixels of "jump" and the assertion becomes a coin
    toss -- it did, intermittently, before this was rewritten.
    What a jump actually is: one frame in which the head moves further than the
    frame before it, during a settle whose steps only ever shrink. So the whole
    press is recorded from inside the page at frame resolution and the series is
    checked for an outlier. Nothing is weakened -- a build that starts the drag
    from the target instead of the presentation value produces a 30px step in a
    series whose neighbours are under 10, and the injection proves it.
    """
    RECORD = """() => {window.__pt=[];
      const w=document.querySelector('#heroHeadTransform');
      (function f(t){const m=new DOMMatrix(getComputedStyle(w).transform);
        window.__pt.push([t,m.f]);
        if(window.__pt.length<180)requestAnimationFrame(f);})(performance.now());}"""
    # ONE FLICK PER SAMPLE. The grab is the interruption, so it ends the flight
    # it is measuring -- reusing it for the second sample would be asking
    # whether a head that has already stopped jumps when pressed, which is a
    # different and much easier question.
    # THE FLIGHT IS DRIVEN BY THE BAND, NOT BY A FLICK, and that is on purpose.
    # A flick's flight length depends on the release velocity, which depends on
    # how fast the harness could push events through CDP -- so half the runs
    # pressed a head that had already stopped and the test quietly measured
    # nothing (it reported settling:False rather than a jump, which is the only
    # reason it was caught). A stretch past the bound always returns over the
    # same authored response, so there is always a flight to interrupt.
    for delay in (60, 200):
        page.evaluate("window.__heroHeadTransform.reset()")
        page.wait_for_timeout(80)
        freeze_float(page)
        push_past(page, 0, -(height + 260), steps=14, dwell=18)
        page.mouse.up()
        page.wait_for_timeout(delay)
        # RECORDED, NOT ASSERTED. If nothing is in flight this test measured
        # nothing, which is a failure of the same rank as a jump -- and a
        # build with no spring at all should report exactly that rather than
        # crash the run before the remaining assertions get to speak.
        if not page.evaluate(STATE)["settling"]:
            record(failures, False,
                   "%dx%d there was a flight to interrupt %dms after the release"
                   % (width, height, delay), None)
            continue
        page.evaluate(RECORD)
        here = page.locator("#heroHeadSelection").bounding_box()
        assert here, "the selection left the screen, so there is nothing to press"
        # PRESS SOMETHING A FINGER COULD ACTUALLY PRESS.  2026-08-19.
        # The head returning from the TOP bound spends the first ~200ms of its
        # flight with its selection centre inside the sticky header's strip --
        # measured at 390x844, centre y 80.1 against a 72px bar, and lower still
        # on a slower frame. That was harmless while the bar was a pill that let
        # clicks through; it is not now the bar is an opaque full-bleed band
        # (header.css §0b), because an opaque band must not pass taps to what it
        # is covering. The head under it is INVISIBLE, so a press there is a press
        # nobody can make, and the gate was measuring the settle rather than the
        # grab: it reported movedBy 1.63-3.15 for a 1px finger move, which is the
        # head continuing to fly, not the head being held.
        # This is a strengthening, not a relaxation. The press is pushed clear of
        # whatever chrome is over the head and then PROVEN to land on the
        # selection with elementFromPoint, so a build where the head genuinely
        # becomes ungrabbable still fails here -- which the old centre-aimed press
        # could not tell apart from a build where it was merely covered.
        chrome = page.evaluate(
            "() => {const s=document.querySelector('.jbStick');"
            "if(!s) return 0;const b=s.getBoundingClientRect();"
            "return getComputedStyle(s).pointerEvents === 'none' ? 0 : b.bottom;}")
        px = here["x"] + here["width"] / 2
        py = min(max(here["y"] + here["height"] / 2, chrome + 4),
                 here["y"] + here["height"] - 4)
        landed = page.evaluate(
            "([x,y]) => {const e=document.elementFromPoint(x,y);"
            "return !!(e && e.closest && e.closest('#heroHeadSelection'));}", [px, py])
        record(failures, landed,
               "%dx%d the head can be pressed where it is drawn %dms after release"
               % (width, height, delay), {"x": round(px, 1), "y": round(py, 1),
                                          "chromeBottom": chrome})
        if not landed:
            continue
        page.mouse.move(px, py)
        settling = page.evaluate(STATE)["settling"]
        page.mouse.down()
        page.wait_for_timeout(120)
        # ON THE AXIS THE BAND WAS STRETCHED ON. The flight above is vertical,
        # so a horizontal probe would read a channel the interruption cannot
        # damage -- which is exactly how the grab-from-target injection passed
        # a test written to catch it.
        PAINTED_Y = ("() => new DOMMatrix(getComputedStyle("
                     "document.querySelector('#heroHeadTransform')).transform).f")
        at_press = page.evaluate(PAINTED_Y)
        page.mouse.move(px, py + 1)
        page.wait_for_timeout(60)
        after = page.evaluate(PAINTED_Y)
        page.mouse.up()
        trail = page.evaluate("() => window.__pt")
        steps = [abs(trail[i][1] - trail[i - 1][1]) for i in range(1, len(trail))]
        moving = [s for s in steps if s > .01]
        # The press lands somewhere inside the recorded series; a settle's steps
        # only shrink, so the largest step after the first is the outlier test.
        worst_after_first = max(moving[1:]) if len(moving) > 1 else 0
        record(failures, settling and worst_after_first <= moving[0] + .5,
               "%dx%d grabbing the head %dms into its flight does not move it"
               % (width, height, delay),
               {"firstStep": round(moving[0], 2) if moving else None,
                "worstLater": round(worst_after_first, 2),
                "settling": settling})
        # PAST THE BOUND, 1:1 IS THE WRONG ANSWER AND WOULD BE A BUG. The band
        # is still under the finger out here, so a pixel of travel buys the
        # band's own derivative -- somewhere between nothing and everything.
        # What must be true is that it is not zero (frozen again) and not more
        # than the finger (the double-damping fix over-correcting the other
        # way). 1:1 is asserted below, on a flight that is inside the bounds.
        moved = after - at_press
        record(failures, 0 < moved < 1.02,
               "%dx%d the interrupted head still resists past the bound"
               % (width, height), {"movedBy": round(moved, 3)})
        page.wait_for_timeout(700)


def interrupted_flight_tracks_one_to_one(page, width, height, failures):
    """Inside its bounds, an interrupted head is glued to the finger.

    This is the half of interruptibility the band cannot express: out past a
    bound the object is meant to resist, so 1:1 can only be asked of a flight
    that is inside the reachable region -- a throw.
    """
    PAINTED_X = ("() => new DOMMatrix(getComputedStyle("
                 "document.querySelector('#heroHeadTransform')).transform).e")
    page.evaluate("window.__heroHeadTransform.reset()")
    page.wait_for_timeout(80)
    freeze_float(page)
    box = page.locator("#heroHeadSelection").bounding_box()
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    page.mouse.move(cx, cy)
    page.mouse.down()
    for i in range(1, 8):
        page.mouse.move(cx + i * 26, cy)
        page.wait_for_timeout(12)
    page.mouse.up()
    page.wait_for_timeout(80)
    # NOT ASSERTED AWAY. A build that produced no throw at all would otherwise
    # skip this test in silence, which is how a detector stops detecting.
    if not page.evaluate(STATE)["settling"]:
        record(failures, False,
               "%dx%d a flick left the head in flight to interrupt"
               % (width, height), None)
        return
    here = page.locator("#heroHeadSelection").bounding_box()
    page.mouse.move(here["x"] + here["width"] / 2, here["y"] + here["height"] / 2)
    page.mouse.down()
    page.wait_for_timeout(120)
    at_press = page.evaluate(PAINTED_X)
    page.mouse.move(here["x"] + here["width"] / 2 + 1, here["y"] + here["height"] / 2)
    page.wait_for_timeout(60)
    moved = page.evaluate(PAINTED_X) - at_press
    page.mouse.up()
    record(failures, abs(moved - 1) < .25,
           "%dx%d an interrupted throw tracks the finger 1:1" % (width, height),
           {"movedBy": round(moved, 3)})
    page.wait_for_timeout(700)


def frame_tracks_the_arrival(browser, base_url, width, height, failures,
                             injection=None):
    """The selection box and the head arrive as one object.

    Sampled against the head's own painted centre. The two are never identical
    -- the frame traces the head-bounds rectangle and the portrait carries
    hero-engine's idle breathing -- so the test is that the entrance adds
    nothing to the separation the page already has at rest.
    """
    page = browser.new_page(viewport={"width": width, "height": height})
    inject(page, injection)
    page.goto(base_url + "/index.html", wait_until="commit")
    rise = page.evaluate(
        "() => parseFloat(getComputedStyle(document.documentElement)"
        ".getPropertyValue('--hero-head-enter-rise')) || 64")
    PROBE = """() => {
      const f=document.querySelector('#face');
      const g=document.querySelector('#heroHeadSelection .heroHeadFrame');
      if(!f||!g||!window.__heroHeadTransform)return null;
      const a=f.getBoundingClientRect(),b=g.getBoundingClientRect();
      if(!b.height)return null;
      return {d:(a.y+a.height/2)-(b.y+b.height/2),
        ent:parseFloat(getComputedStyle(document.querySelector('#heroHeadTransform'))
          .getPropertyValue('--hero-head-enter-y'))||0};}"""
    during = []
    for _ in range(22):
        page.wait_for_timeout(55)
        row = page.evaluate(PROBE)
        if row:
            during.append(row)
    # THE RESTING BASELINE IS AN ENVELOPE, NOT A READING. The frame traces the
    # head-bounds rectangle while the portrait carries hero-engine's own idle
    # breathing, so the separation at rest oscillates by several pixels on a
    # 125ms clock. Three samples in a row can all land in the same quiet moment
    # and understate it -- measured at 1.26px against a true envelope of ~10 --
    # which turns the comparison below into a coin toss. Sampled across more
    # than a full breathing cycle instead.
    page.wait_for_timeout(600)
    at_rest = []
    for _ in range(24):
        page.wait_for_timeout(55)
        at_rest.append(page.evaluate(PROBE)["d"])
    page.close()

    moving = [r["d"] for r in during if r["ent"]]
    assert moving, "the greeting never ran, so this measured nothing"
    baseline = max(abs(v) for v in at_rest)
    worst = max(abs(v) for v in moving)
    # THE THRESHOLD IS A SHARE OF THE ARRIVAL'S OWN TRAVEL, not the measured
    # resting envelope. The envelope is hero-engine's breathing and it is
    # stochastic -- 24 samples across a breathing cycle still land anywhere
    # between 1 and 10px -- so `baseline + 2` made this a coin toss rather than
    # a test. What the failure actually looks like is unambiguous: a frame that
    # ignores the arrival carries the WHOLE of --hero-head-enter-rise as
    # separation, 70px measured against a 64px rise. A third of the rise is
    # comfortably above every breath and nowhere near the bug.
    ceiling = rise * .35
    record(failures, worst <= ceiling,
           "%dx%d the frame stays on the head through the greeting"
           % (width, height),
           {"worstDuringArrival": round(worst, 2), "ceiling": round(ceiling, 2),
            "restingBaseline": round(baseline, 2)})
    return worst, baseline


def contract(base_url, injection=None):
    failures = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, height in VIEWPORTS:
            page = settled_page(browser, base_url, width, height, injection)
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            rest_is_untouched(page, width, height, failures)
            boundary_gives_and_returns(page, width, height, failures)
            grabbable_mid_flight(page, width, height, failures)
            interrupted_flight_tracks_one_to_one(page, width, height, failures)
            record(failures, not errors,
                   "%dx%d no script errors" % (width, height), errors)
            page.close()
            frame_tracks_the_arrival(browser, base_url, width, height, failures,
                                     injection)

        # ── REDUCED MOTION KEEPS THE FEEDBACK AND DROPS THE JOURNEY ──────────
        # The band is finger-driven and bounded and stays. A throw is autonomous
        # travel of arbitrary distance, which is the thing the setting is about,
        # so the flick puts the head where it was let go.
        for mode, wants_throw in (("no-preference", True), ("reduce", False)):
            page = browser.new_page(viewport={"width": 390, "height": 844},
                                    reduced_motion=mode)
            inject(page, injection)
            page.goto(base_url + "/index.html", wait_until="load")
            page.wait_for_timeout(1500)
            box = page.locator("#heroHeadSelection").bounding_box()
            cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
            page.mouse.move(cx, cy)
            page.mouse.down()
            for i in range(1, 8):
                page.mouse.move(cx + i * 26, cy)
                page.wait_for_timeout(12)
            released = page.evaluate(STATE)["x"]
            page.mouse.up()
            committed = page.evaluate(STATE)["x"]
            throw = committed - released
            record(failures, (throw > 20) if wants_throw else (abs(throw) < .01),
                   "%s: a flick %s the head"
                   % (mode, "throws" if wants_throw else "places"),
                   {"throwPx": round(throw, 2)})
            # The band survives reduced motion in both modes.
            page.evaluate("window.__heroHeadTransform.reset()")
            page.wait_for_timeout(60)
            held = push_past(page, 0, -1100)
            page.mouse.up()
            record(failures, held["drift"]["y"] < -1,
                   "%s: the boundary still gives" % mode,
                   {"give": held["drift"]["y"]})
            page.close()
        browser.close()
    return failures


def main():
    injection = None
    if "--self-test" in sys.argv:
        index = sys.argv.index("--self-test")
        injection = (sys.argv[index + 1] if len(sys.argv) > index + 1
                     else "hard-clamp")

    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    base_url = "http://127.0.0.1:%d" % server.server_address[1]
    try:
        failures = contract(base_url, injection)
    finally:
        server.shutdown()

    if injection:
        print("\nself-test injection %r produced %d failure(s)"
              % (injection, len(failures)))
        if not failures:
            print("SELF-TEST FAILED: the injected bug did not trip a single "
                  "assertion, so none of them is protecting anything.")
            raise SystemExit(1)
        print("SELF-TEST OK")
        return

    if failures:
        print("\n%d failure(s)" % len(failures))
        raise SystemExit(1)
    print("\nHero head physics: OK")


if __name__ == "__main__":
    main()
