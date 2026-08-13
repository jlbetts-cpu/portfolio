#!/usr/bin/env python3
"""A swipe that starts on the head scrolls the page, and leaves the head alone.

JAYDEN'S REPORT: "head resizes on scroll for some reason on mobile".

IT IS NOT A VIEWPORT BUG, and that is worth stating first because "resizes on
scroll" reads like one and a whole investigation was spent there. Measured on a
real Mobile Safari (iPhone 17, iOS 26.3) across a real URL-bar retraction --
innerHeight 714 <-> 754, 3 window resizes, 3 visualViewport resizes -- every
input to the head's rendered size held dead still: --hero-peek-width 211px,
--hero-head-scale 1, #heroHeadTransform.offsetWidth 211, .heroCharacterPeek
height 714.0. The head's size does not depend on viewport height at all. That
invariance is asserted here too (SIZE INVARIANCE below) so it stays true.

WHAT IT ACTUALLY IS: .heroHeadTransform, .heroHeadSelection, the handles and
.heroCharacterPeek .stage all declared touch-action:none. That is a promise to
the browser that a vertical swipe starting on any of them must NEVER scroll the
page -- and the selection frame is on screen from page load (ambient(), "the
page arrives already selected"), so the promise is armed over a 196 x 228pt box
in the middle of the first screen at 402x714, exactly where a thumb lands.
Measured through Chromium's own touch gesture pipeline before the fix:

    swipe up from the head's centre  ->  scrollY 0.0 -> 0.0,  head dy -275px
    swipe up from the NW handle      ->  scrollY 0.0 -> 0.0,  head SCALE +0.70
    swipe up from empty hero         ->  scrollY 0.0 -> 259.0        (control)

The second line is the bug verbatim: he swiped to scroll, the page refused, and
the head grew from 1.0 to its 1.7 ceiling. Confirmed on the device.

WHY THE GESTURE PIPELINE AND NOT window.scrollTo: scrollTo bypasses the only
question being asked. Input.synthesizeScrollGesture with a touch source goes
through the same hit test and the same touch-action arbitration a finger does,
which is why this gate can see a bug that every DOM measurement missed.

TWO HALVES, TWO RE-INJECTIONS (--self-test proves both are load-bearing):
  1. touch-action:pan-y in controls.css hands the vertical swipe back.
  2. pointercancel reverting in hero-head-transform.js throws away the opening
     pointermoves the browser delivered before it reached its verdict. Without
     it the page scrolls but the head keeps a permanent mark -- measured -23.1px
     of drift from the body and +0.1158 of scale from the NW handle.

AND THE HEAD MUST STILL BE DRAGGABLE, or the gate would pass on an inert head:
a horizontal drag still moves it and a diagonal drag on a corner still resizes
it, both asserted below.

Run:  python3 tools/hero-head-scroll-gesture-contract.py
      python3 tools/hero-head-scroll-gesture-contract.py --self-test
"""
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

VIEWPORT = {"width": 402, "height": 714}     # iPhone 17, Safari, toolbars shown
SCROLL_DISTANCE = 260
STILL = 0.001            # the restore is arithmetic, not a measurement
SCROLL_SHARE = 0.6       # a probe must scroll at least this much of the control
HEIGHT_CYCLE = (714, 730, 754, 730, 714)     # a URL bar retracting and returning

# ── THE RE-INJECTIONS ────────────────────────────────────────────────────────
# 1. the head swallowing the swipe again
REINJECT_CSS = (" touch-action:pan-y;\n touch-action:pan-y pinch-zoom", " touch-action:none")
# 2. the cancelled gesture being committed instead of reverted again
REINJECT_JS = ('addEventListener("pointercancel",cancel)', 'addEventListener("pointercancel",end)')


class Quiet(SimpleHTTPRequestHandler):
    reinject = False

    def log_message(self, _format, *_args):
        pass

    def translate_path(self, path):
        return str(ROOT / path.split("?")[0].lstrip("/"))

    def _serve(self, body, ctype):
        raw = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        name = self.path.split("?")[0]
        if self.reinject and name.endswith("/controls.css"):
            body = (ROOT / "controls.css").read_text(encoding="utf-8")
            assert REINJECT_CSS[0] in body, "the head's touch-action has moved; re-anchor the self-test"
            self._serve(body.replace(REINJECT_CSS[0], REINJECT_CSS[1]), "text/css; charset=utf-8")
            return
        if self.reinject and name.endswith("/hero-head-transform.js"):
            body = (ROOT / "hero-head-transform.js").read_text(encoding="utf-8")
            assert REINJECT_JS[0] in body, "the pointercancel binding has moved; re-anchor the self-test"
            self._serve(body.replace(REINJECT_JS[0], REINJECT_JS[1]),
                        "application/javascript; charset=utf-8")
            return
        SimpleHTTPRequestHandler.do_GET(self)


HEAD_STATE = """() => {
  const s = window.__heroHeadTransform.getState();
  return {sy: window.scrollY, x: s.x, y: s.y, scale: s.scale, rotate: s.rotate};
}"""

PROBE_POINTS = """() => {
  const sel = document.getElementById('heroHeadSelection').getBoundingClientRect();
  const cx = sel.left + sel.width / 2, cy = sel.top + sel.height / 2;
  const wrap = document.getElementById('heroHeadTransform').getBoundingClientRect();
  const out = [{name: 'head body', x: Math.round(wrap.left + wrap.width / 2),
                y: Math.round(wrap.top + wrap.height / 2)}];
  // AIM AT THE DRAWN DOT, NUDGED INSIDE ITS OWN BOX. The handle's hit square is
  // clamped to stay inside the selection, so its centre can sit a pixel or two
  // outside the frame; a probe on the frame's outer edge hit the page instead
  // of the handle and scored a false pass.
  for (const h of document.querySelectorAll('.heroHeadHandle,.heroHeadRotate')) {
    const r = h.getBoundingClientRect();
    let x = r.left + r.width / 2, y = r.top + r.height / 2;
    x += (cx - x) * 0.12; y += (cy - y) * 0.12;
    out.push({name: h.dataset.corner ? 'handle ' + h.dataset.corner : 'rotator',
              x: Math.round(x), y: Math.round(y)});
  }
  return {points: out, sel: [sel.left, sel.top, sel.width, sel.height]};
}"""

SIZE_INPUTS = """() => {
  const root = document.documentElement;
  const wrap = document.getElementById('heroHeadTransform');
  const peek = document.querySelector('.heroCharacterPeek');
  const cs = getComputedStyle;
  return {
    peekWidth: cs(root).getPropertyValue('--hero-peek-width').trim(),
    headScale: cs(wrap).getPropertyValue('--hero-head-scale').trim(),
    declaredWidth: cs(wrap).width,
    offsetWidth: wrap.offsetWidth,
    stagewrapWidth: cs(wrap.querySelector('.stagewrap')).width,
    peekHeight: +peek.getBoundingClientRect().height.toFixed(2),
    innerHeight: window.innerHeight,
  };
}"""


def touch_drag(cdp, page, x, y, path):
    """A finger, stepped, with a real frame between moves."""
    cdp.send("Input.dispatchTouchEvent",
             {"type": "touchStart", "touchPoints": [{"x": x, "y": y, "id": 1}]})
    for dx, dy in path:
        cdp.send("Input.dispatchTouchEvent",
                 {"type": "touchMove", "touchPoints": [{"x": x + dx, "y": y + dy, "id": 1}]})
        page.wait_for_timeout(16)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    page.wait_for_timeout(400)


def settle(page):
    page.evaluate("() => { window.__heroHeadTransform.reset(); window.scrollTo(0, 0); }")
    page.wait_for_timeout(350)


def run(reinject):
    Quiet.reinject = reinject
    server = ThreadingHTTPServer(("127.0.0.1", 0), Quiet)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % server.server_port
    failures, notes = [], []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            context = browser.new_context(viewport=dict(VIEWPORT), device_scale_factor=3,
                                          is_mobile=True, has_touch=True)
            page = context.new_page()
            cdp = context.new_cdp_session(page)
            page.goto(base + "/index.html", wait_until="load")
            page.wait_for_function("window.__heroHeadTransform")
            page.wait_for_timeout(2600)   # past the entrance; the frame is up

            # ── SIZE INVARIANCE ─────────────────────────────────────────────
            # Every input to the head's rendered size, across a chrome cycle.
            seen = []
            for h in HEIGHT_CYCLE:
                page.set_viewport_size({"width": VIEWPORT["width"], "height": h})
                page.evaluate("""() => { window.dispatchEvent(new Event('resize'));
                  if (window.visualViewport) visualViewport.dispatchEvent(new Event('resize')); }""")
                page.wait_for_timeout(320)
                seen.append(page.evaluate(SIZE_INPUTS))
            page.set_viewport_size(dict(VIEWPORT))
            page.wait_for_timeout(320)
            # peekHeight is REPORTED, NOT ASSERTED, and the difference is the
            # whole svh blind spot. .heroCharacterPeek is height:100svh, and a
            # headless browser makes svh == dvh == innerHeight, so here it
            # tracks the viewport and on a phone it does not. Measured on the
            # device it held at 714.0 through the full retraction. It is a
            # POSITION anyway -- the floor the head is anchored to -- and
            # hero-head-stage-anchor-contract already owns that.
            for key in ("peekWidth", "headScale", "declaredWidth", "offsetWidth",
                        "stagewrapWidth"):
                values = sorted({str(row[key]) for row in seen})
                notes.append("  %-15s %s across innerHeight %s"
                             % (key, values[0] if len(values) == 1 else values,
                                [row["innerHeight"] for row in seen]))
                if len(values) != 1:
                    failures.append("the head's %s moved with viewport height: %s" % (key, values))
            notes.append("  %-15s %s (svh; headless cannot pin it -- 714.0 on the device)"
                         % ("peekHeight", sorted({str(r["peekHeight"]) for r in seen})))

            settle(page)
            geometry = page.evaluate(PROBE_POINTS)
            notes.append("  selection box %s at %dx%d"
                         % ([round(v, 1) for v in geometry["sel"]],
                            VIEWPORT["width"], VIEWPORT["height"]))

            surfaces = page.evaluate("""() => ({
              wrap: getComputedStyle(document.getElementById('heroHeadTransform')).touchAction,
              selection: getComputedStyle(document.getElementById('heroHeadSelection')).touchAction,
              handle: getComputedStyle(document.querySelector('.heroHeadHandle')).touchAction,
              stage: getComputedStyle(document.getElementById('stage')).touchAction})""")
            notes.append("  touch-action %s" % surfaces)
            for where, value in surfaces.items():
                if "pan-y" not in value:
                    failures.append("%s declares touch-action:%s -- a vertical swipe there "
                                    "can never reach the page" % (where, value))

            # ── THE CONTROL, FIRST ──────────────────────────────────────────
            def scroll_gesture(x, y):
                settle(page)
                before = page.evaluate(HEAD_STATE)
                cdp.send("Input.synthesizeScrollGesture",
                         {"x": x, "y": y, "xDistance": 0, "yDistance": -SCROLL_DISTANCE,
                          "gestureSourceType": "touch", "speed": 800, "preventFling": True})
                page.wait_for_timeout(900)
                return before, page.evaluate(HEAD_STATE)

            _, control = scroll_gesture(VIEWPORT["width"] - 22, 600)
            notes.append("  control swipe off the head scrolled %.0fpx" % control["sy"])
            if control["sy"] < 100:
                failures.append("the control swipe did not scroll the page (%.1f) -- the probe "
                                "is broken, not the head" % control["sy"])
            floor = control["sy"] * SCROLL_SHARE

            for point in geometry["points"]:
                before, after = scroll_gesture(point["x"], point["y"])
                moved = {k: after[k] - before[k] for k in ("x", "y", "scale", "rotate")}
                notes.append("  swipe from %-12s (%3d,%3d): scrollY %5.0f -> %5.0f   "
                             "head dx %+.2f dy %+.2f dscale %+.4f drot %+.2f"
                             % (point["name"], point["x"], point["y"], before["sy"], after["sy"],
                                moved["x"], moved["y"], moved["scale"], moved["rotate"]))
                if after["sy"] < floor:
                    failures.append("a swipe from the %s scrolled %.1fpx against the control's "
                                    "%.1f -- the head is eating the gesture"
                                    % (point["name"], after["sy"], control["sy"]))
                for axis, delta in moved.items():
                    if abs(delta) > STILL:
                        failures.append("a swipe from the %s changed the head's %s by %+.4f -- "
                                        "a cancelled gesture must leave nothing behind"
                                        % (point["name"], axis, delta))

            # ── AND THE HEAD IS STILL DRAGGABLE ─────────────────────────────
            settle(page)
            body = geometry["points"][0]
            before = page.evaluate(HEAD_STATE)
            touch_drag(cdp, page, body["x"], body["y"],
                       [(18, 0), (36, 0), (54, -10), (72, -24), (90, -40)])
            after = page.evaluate(HEAD_STATE)
            notes.append("  sideways drag on the head: dx %+.1f dy %+.1f, scrollY %.0f"
                         % (after["x"] - before["x"], after["y"] - before["y"], after["sy"]))
            if abs(after["x"] - before["x"]) < 40:
                failures.append("a sideways drag no longer moves the head (dx %+.1f) -- the fix "
                                "has made the portrait inert" % (after["x"] - before["x"]))

            corner = next(q for q in geometry["points"] if q["name"] == "handle se")
            settle(page)
            before = page.evaluate(HEAD_STATE)
            touch_drag(cdp, page, corner["x"], corner["y"],
                       [(14, 4), (28, 10), (42, 18), (56, 26), (70, 34)])
            after = page.evaluate(HEAD_STATE)
            notes.append("  diagonal drag on the se handle: dscale %+.4f, scrollY %.0f"
                         % (after["scale"] - before["scale"], after["sy"]))
            if abs(after["scale"] - before["scale"]) < 0.02:
                failures.append("a diagonal drag on a corner no longer resizes the head "
                                "(dscale %+.4f)" % (after["scale"] - before["scale"]))

            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    return failures, notes


def main():
    self_test = "--self-test" in sys.argv
    failures, notes = run(reinject=self_test)
    print("\n".join(notes))
    print()
    if self_test:
        if failures:
            print("SELF-TEST OK -- the re-injected bug was caught, %d finding(s):" % len(failures))
            for f in failures:
                print("  x " + f)
            return 0
        print("SELF-TEST FAILED -- touch-action:none and a committing pointercancel were put "
              "back and the contract still passed. This gate cannot see its own bug.")
        return 1
    if failures:
        print("FAIL -- %d finding(s):" % len(failures))
        for f in failures:
            print("  x " + f)
        return 1
    print("A swipe that starts on the head scrolls the page and leaves it alone: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
