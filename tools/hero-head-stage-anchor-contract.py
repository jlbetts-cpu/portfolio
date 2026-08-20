#!/usr/bin/env python3
"""Change the Hero's height; nothing inside the Hero may move.

WHY THIS REPLACES hero-head-chrome-slack-contract.py. That gate asserted, in
text, that `.heroHeadTransform`'s `bottom` carried a (100dvh - 100svh) term --
the phone's chrome slack -- because in headless Chromium dvh == svh, the term is
always exactly 0px, and no behavioural test could ever see it work or fail. A
correction nothing can observe is not a correction, and it was worse than
useless in the environment Jayden's recruiters actually use: an in-app WebView
(LinkedIn's, Instagram's) has FIXED chrome, so dvh == svh there too and the term
was a permanent no-op on the very device he was complaining about.

The mechanism is now testable, so this gate is behavioural instead of textual.
The head is bottom-anchored inside .heroCharacterPeek, and the peek is
`height:100svh` -- the small viewport, defined with every dynamic toolbar
EXPANDED, and the one viewport unit specified NOT to change during a scroll.
The copy is centred in a grid row of the same rest height rather than in the
Hero's live box. So the invariant is a thing a machine can check on any
machine: MOVE THE HERO'S FLOOR AND NOTHING INSIDE MOVES.

The Hero's height is driven directly rather than by faking browser chrome:
  <=760  .hero is min-height:var(--hero-mobile-height) (tokens.css, 100dvh), so
         overriding that custom property drives exactly the layout change a
         retracting Safari toolbar drives;
  >760   an explicit `height` on .hero.
Both are the same layout change the chrome makes, and neither needs chrome.

Run:  python3 tools/hero-head-stage-anchor-contract.py
      python3 tools/hero-head-stage-anchor-contract.py --self-test
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
VIEWPORTS = ((390, 844), (320, 568), (1440, 900))
# ONLY GROWTH, AND THAT IS NOT LAZINESS. The Hero's floor can only ever move
# DOWN: dvh >= svh by definition, so retracting chrome makes the box taller and
# nothing makes it shorter. Asking for -40 is asking for a state the layout
# cannot enter -- the stable row floors the Hero's natural height at its rest
# height -- so it is asserted as a floor of its own below instead of pretended
# to be a resize. An earlier draft of this file scored it as "the driver stopped
# driving", which is the correct thing for a driver to say and the wrong test.
DELTAS = (81, 140)
SHRINK = -60
TOLERANCE = 0.02          # the value is arithmetic, not a measurement

# ── THE RE-INJECTIONS ────────────────────────────────────────────────────────
# Put the moving floor back: drop the stage's fixed height, and drop the stable
# grid row so the copy goes back to being centred in a live box.
CSS_BUG = ("position:absolute;inset:0;height:100svh;",
           "position:absolute;inset:0;")
HTML_BUG = ("@supports (height:1svh){\n .hero{align-content:start;",
            "@supports (height:1svh){\n .hero{")


class Quiet(SimpleHTTPRequestHandler):
    reinject = False

    def log_message(self, _format, *_args):
        pass

    def _patched(self, name, swap):
        body = (ROOT / name).read_text(encoding="utf-8")
        assert swap[0] in body, f"{name} has moved; re-anchor the self-test"
        return body.replace(swap[0], swap[1], 1).encode("utf-8")

    def do_GET(self):
        path = self.path.split("?")[0]
        table = {"/controls.css": ("controls.css", CSS_BUG, "text/css"),
                 "/index.html": ("index.html", HTML_BUG, "text/html")}
        if self.reinject and path in table:
            name, swap, mime = table[path]
            raw = self._patched(name, swap)
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        super().do_GET()


def serve(reinject=False):
    handler = type("H", (Quiet,), {"reinject": reinject})
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(handler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    return server


# Every position is Hero-relative: the Hero scrolls with the page, so where
# Jayden put a thing is a PAGE position and a viewport-relative reading would
# report the scroll rather than the drift.
READ = """() => {
 const hero=document.querySelector('.hero');
 const hb=hero.getBoundingClientRect();
 const at=(sel)=>{const e=document.querySelector(sel); if(!e) return null;
   const b=e.getBoundingClientRect();
   return [+(b.left-hb.left).toFixed(2), +(b.top-hb.top).toFixed(2)];};
 return {heroH:+hb.height.toFixed(2),
         head:at('#heroHeadTransform'), face:at('#face'),
         copy:at('.heroCopy h1'),      sel:at('#heroHeadSelection')};
}"""

# The head breathes on a 125ms idle clock and the entrance is still landing for
# the first second, so two samples taken live are never comparable. Freezing is
# the instrument, not the fix -- reduced-motion is already set on the context.
FREEZE = """*,*::before,*::after{
 animation-play-state:paused!important;transition:none!important}"""


def check(browser, port, width, height, delta):
    ctx = browser.new_context(viewport={"width": width, "height": height},
                              device_scale_factor=3 if width <= 760 else 1,
                              is_mobile=width <= 760, has_touch=width <= 760,
                              reduced_motion="reduce")
    page = ctx.new_page()
    page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="load")
    page.wait_for_function("!!window.__heroHeadTransform")
    page.wait_for_timeout(2200)
    page.add_style_tag(content=FREEZE)
    page.wait_for_timeout(150)

    before = page.evaluate(READ)
    target = before["heroH"] + delta
    # ONE DRIVER, BOTH WIDTHS. The Hero's height is --heroBox now (2026-08-20,
    # when the fold was cut from 100vh so the tab row is reachable without
    # crossing dead gradient), and it is the same token at every width -- so the
    # old fork, which wrote --hero-mobile-height under 760 and an inline height
    # above it, was driving two things that no longer exist. Setting the box is
    # also closer to what a real viewport change does than pinning a height.
    page.evaluate("h=>document.documentElement.style.setProperty('--heroBox',h+'px')", target)
    page.wait_for_timeout(350)
    after = page.evaluate(READ)
    ctx.close()

    fails = []
    grew = after["heroH"] - before["heroH"]
    if delta < 0:
        # The gap this whole design exists to prevent. If the Hero ever DID
        # shrink below its rest height, the sky would stop short of the fold.
        if grew < -1.0:
            fails.append(
                f"{width}x{height}: the Hero shrank {grew:.2f}px below its rest "
                f"height. The gradient now stops short of the fold -- the exact "
                f"gap min-height:100dvh was chosen to prevent.")
        print(f"  {width}x{height} asked for {delta:+}px and held at "
              f"{after['heroH']:.0f}: floor holds")
        return fails
    if abs(grew - delta) > 1.0:
        fails.append(f"{width}x{height}: the Hero did not resize "
                     f"({before['heroH']} -> {after['heroH']}, wanted {delta:+}). "
                     "The driver has stopped driving; this run proves nothing.")
        return fails
    for key in ("head", "face", "copy", "sel"):
        a, b = before.get(key), after.get(key)
        if not a or not b:
            continue
        dx, dy = b[0] - a[0], b[1] - a[1]
        if abs(dx) > TOLERANCE or abs(dy) > TOLERANCE:
            fails.append(
                f"{width}x{height}: the Hero's height changed {delta:+}px and "
                f"`{key}` moved ({dx:+.2f}, {dy:+.2f})px inside it.\n"
                f"    It is laid out from a floor that moves. Anchor it to the "
                f"stage box (height:100svh), not to the Hero.")
    print(f"  {width}x{height} hero {before['heroH']:.0f} -> {after['heroH']:.0f}"
          f"  head {tuple(before['head'])} -> {tuple(after['head'])}"
          f"   copy dy "
          f"{after['copy'][1]-before['copy'][1]:+.2f}")
    return fails


def main():
    self_test = "--self-test" in sys.argv
    server = serve(self_test)
    failures = []
    try:
        if self_test:
            print("SELF-TEST: stage height and stable row removed, the way the\n"
                  "           shipped bug had them. Every viewport MUST fail.")
        with sync_playwright() as play:
            for engine in ("chromium", "webkit"):
                # WebKit is the closest approximation available to iOS Safari
                # and to the WKWebView LinkedIn opens this site in.
                print(f"{engine}:")
                browser = getattr(play, engine).launch()
                for (w, h) in VIEWPORTS:
                    for d in DELTAS + (SHRINK,):
                        failures += check(browser, server.server_port, w, h, d)
                browser.close()
    finally:
        server.shutdown()

    if self_test:
        if failures:
            print("\nSELF-TEST PASS -- the contract caught the re-injected floor:")
            for line in failures[:4]:
                print("   *", line.splitlines()[0])
            return 0
        print("\nSELF-TEST FAIL -- the re-injected bug went undetected.")
        return 1
    if failures:
        print("\nFAIL:")
        for line in failures:
            print("   *", line)
        return 1
    print("\nThe Hero's floor moves and nothing inside it does: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
