#!/usr/bin/env python3
"""The head stays where it was put, in the Hero's coordinates, across a scroll.

THE FRAME OF REFERENCE IS THE HERO, NOT THE VIEWPORT. The portrait lives inside
#main, which scrolls with the page, so where Jayden put it is a PAGE position.
Every rect this component measures is viewport-relative, so any of them leaking
into a durable value would make the head slide as you scroll. This asserts the
durable value directly: getState().box is the Hero-relative rectangle the clamp
reasons about and the frame is drawn from, and it is derived from state.base
and state.x/y with no float and no idle pose in it. If the coordinate spaces are
kept apart it cannot move on a scroll, at all, ever.

AND A SCROLL ON A PHONE IS A RESIZE. The Hero is min-height:100dvh -- a
deliberate call, documented in index.html, so that retracting browser chrome
never opens a gap on the gradient -- so innerHeight changes as you scroll, the
ResizeObserver fires, and reclamp() re-captures the base. That capture read the
portrait's LIVE rect, and the portrait is never still: hero-engine gives it an
idle pose on a 125ms clock worth about 14px, written to #stage and .stagewrap.
So each capture rolled a different base. Measured at 390 wide, dragging the head
and then cycling the viewport 760 -> 844 -> 760 -- one scroll down and back --
left the frame 10.8px from where it started and the clamp's box 6 to 7px out,
with state.x/y untouched at (-60,-150). Nothing brought it back, so it
accumulated once per scroll gesture. captureBase() lifts the idle pose off for
the measurement now, the way it already lifted the wrapper's own transform, and
the round trip returns to 0.00.

WHAT THIS FILE DOES NOT ASSERT, because it is a composition decision and not a
bug: while the viewport is tall the head IS lower in the Hero, by exactly the
chrome's height. It is laid out from the Hero's floor, so it tracks that floor
while the centred copy tracks the centre and moves by half as much. That is
visible on a phone and it is Jayden's to rule on -- see the report. What is
asserted is that the movement is exactly the layout delta and is exactly
reversible, with nothing left behind.

Run:  python3 tools/hero-head-scroll-contract.py
      python3 tools/hero-head-scroll-contract.py --self-test
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCROLLS = (120, 400, 900, 1600, 0)
# One scroll down and back up on a phone, as the URL bar retracts and returns.
CHROME_CYCLE = (800, 844, 800, 760)
TOLERANCE = 0.5          # sub-pixel; the value is arithmetic, not a measurement

# ── THE RE-INJECTION ─────────────────────────────────────────────────────────
# Put back the capture that reads the portrait through whatever idle pose it
# happened to be holding.
REINJECT = (
    """   stillBody(function(){
    var u=logicalRaw(),h=rectOf(hero);
    state.base={left:u.left-h.left,top:u.top-h.top,width:u.width,height:u.height};
   });""",
    """   var u=logicalRaw(),h=rectOf(hero);
   state.base={left:u.left-h.left,top:u.top-h.top,width:u.width,height:u.height};""",
)


class Quiet(SimpleHTTPRequestHandler):
    reinject = False

    def log_message(self, _format, *_args):
        pass

    def do_GET(self):
        if self.reinject and self.path.split("?")[0].endswith("/hero-head-transform.js"):
            body = (ROOT / "hero-head-transform.js").read_text(encoding="utf-8")
            assert REINJECT[0] in body, "captureBase has moved; re-anchor the self-test"
            raw = body.replace(REINJECT[0], REINJECT[1], 1).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript")
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


READ = """() => {
 const hero=document.querySelector('#main');
 const wrap=document.querySelector('#heroHeadTransform');
 const sel=document.querySelector('#heroHeadSelection');
 const st=window.__heroHeadTransform.getState();
 const h=hero.getBoundingClientRect();
 const fr=document.querySelector('.heroHeadFrame');
 const w=wrap.getBoundingClientRect(), s=sel.getBoundingClientRect();
 return {
  scrollY: window.scrollY, vh: window.innerHeight,
  heroH: +h.height.toFixed(2),
  state: [+st.x.toFixed(3), +st.y.toFixed(3), +st.scale.toFixed(4),
          +st.rotate.toFixed(3)],
  // Hero-relative and float-free: base + the arrangement, nothing else.
  box: [+st.box.left.toFixed(3), +st.box.top.toFixed(3)],
  // Rendered, Hero-relative. Carries the float, so it is compared as a
  // DIFFERENCE against the frame rather than against its own past.
  wrapInHero: [+(w.left-h.left).toFixed(2), +(w.top-h.top).toFixed(2)],
  selInHero:  [+(s.left-h.left).toFixed(2), +(s.top-h.top).toFixed(2)],
  // THE OUTLINE, NOT THE BOX. The box is the pointer surface and is clipped to
  // the Hero, so at 390 its left edge is pinned at 0 and stops tracking the
  // head -- comparing against it reports a de-weld that is really a crop.
  // --frame-x/y carry the outline's true origin back out of the clipped box.
  outlineInHero: [
   +(s.left-h.left+(parseFloat(fr.style.getPropertyValue('--frame-x'))||0)).toFixed(2),
   +(s.top-h.top+(parseFloat(fr.style.getPropertyValue('--frame-y'))||0)).toFixed(2)],
  // What the composition is actually laid out from.
  fromFloor: +(h.bottom-s.top).toFixed(2),
 };
}"""


def drag(page, dx, dy):
    spot = page.evaluate("()=>{const r=document.querySelector('#face')"
                         ".getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];}")
    page.mouse.move(spot[0], spot[1]); page.wait_for_timeout(60)
    page.mouse.down(); page.wait_for_timeout(60)
    for i in range(1, 11):
        page.mouse.move(spot[0] + dx*i/10, spot[1] + dy*i/10); page.wait_for_timeout(25)
    page.wait_for_timeout(80); page.mouse.up(); page.wait_for_timeout(250)


def open_page(browser, port, width, height):
    context = browser.new_context(viewport={"width": width, "height": height},
                                  has_touch=width <= 760, is_mobile=width <= 760)
    page = context.new_page()
    page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="load")
    page.wait_for_timeout(2600)
    # The float is the one thing that is SUPPOSED to move while nothing else
    # does, so it is held still rather than subtracted.
    page.evaluate("window.__heroHeadTransform.stopFloat()")
    page.wait_for_timeout(150)
    return context, page


def check_scroll(browser, port, width, height):
    """Scrolling the page must not move the head inside the Hero. At all."""
    failures = []
    context, page = open_page(browser, port, width, height)
    drag(page, -60, -150)
    start = page.evaluate(READ)
    worst = 0.0
    base_weld = None
    for amount in SCROLLS:
        page.evaluate(f"window.scrollTo(0,{amount})")
        page.wait_for_timeout(400)
        page.evaluate("window.__heroHeadTransform.stopFloat()")
        page.wait_for_timeout(120)
        now = page.evaluate(READ)
        drift = [now["box"][i] - start["box"][i] for i in (0, 1)]
        worst = max(worst, abs(drift[0]), abs(drift[1]))
        if abs(drift[0]) > TOLERANCE or abs(drift[1]) > TOLERANCE:
            failures.append(f"{width}x{height}: scrolling to {amount} moved the head "
                            f"{drift[0]:+.2f},{drift[1]:+.2f} inside the Hero -- a "
                            f"viewport coordinate has leaked into the arrangement")
        if now["state"][:2] != start["state"][:2]:
            failures.append(f"{width}x{height}: scrolling to {amount} changed the "
                            f"arrangement from {start['state'][:2]} to "
                            f"{now['state'][:2]} -- the clamp is re-running on scroll")
        # Head and outline are one rigid body at every scroll position.
        # Both are read in the same frame, so the float is in both and cancels.
        weld = [now["wrapInHero"][i] - now["outlineInHero"][i] for i in (0, 1)]
        if base_weld is None:
            base_weld = weld
        weld = [weld[i] - base_weld[i] for i in (0, 1)]
        if abs(weld[0]) > 1.0 or abs(weld[1]) > 1.0:
            failures.append(f"{width}x{height}: at scroll {amount} the head and its "
                            f"outline came apart by {weld[0]:+.2f},{weld[1]:+.2f}")
    print(f"  {width}x{height} scroll: worst Hero-relative drift {worst:.2f}px "
          f"over {len(SCROLLS)} positions, arrangement held at {start['state'][:2]}")
    context.close()
    return failures


def check_chrome_cycle(browser, port, width, height):
    """A phone scroll is a viewport-height change. It must leave nothing behind."""
    failures = []
    context, page = open_page(browser, port, width, height)
    drag(page, -60, -150)
    start = page.evaluate(READ)
    seen = []
    for tall in CHROME_CYCLE:
        page.set_viewport_size({"width": width, "height": tall})
        page.wait_for_timeout(700)
        page.evaluate("window.__heroHeadTransform.stopFloat()")
        page.wait_for_timeout(150)
        now = page.evaluate(READ)
        expected = tall - height          # the Hero grows with the viewport
        drift = [now["box"][i] - start["box"][i] for i in (0, 1)]
        seen.append((tall, round(drift[0], 2), round(drift[1], 2)))
        if now["state"][:2] != start["state"][:2]:
            failures.append(f"{width}: the arrangement changed from "
                            f"{start['state'][:2]} to {now['state'][:2]} when the "
                            f"viewport went to {tall} -- the clamp moved the head")
        # Horizontally nothing may move, and vertically only by the layout delta.
        if abs(drift[0]) > TOLERANCE:
            failures.append(f"{width}: viewport height {tall} moved the head "
                            f"{drift[0]:+.2f}px HORIZONTALLY -- nothing about a "
                            f"height change should")
        if abs(drift[1] - expected) > TOLERANCE:
            failures.append(f"{width}: at viewport height {tall} the head sat "
                            f"{drift[1]:+.2f}px from where it started, against the "
                            f"{expected:+d}px the Hero's own floor moved -- the "
                            f"difference is a base captured through the idle pose")
    print(f"  {width} chrome cycle {CHROME_CYCLE}: box drift {seen} "
          f"(expected {[t - height for t in CHROME_CYCLE]})")
    context.close()
    return failures


def main():
    self_test = "--self-test" in sys.argv
    server = serve(self_test)
    try:
        if self_test:
            print("SELF-TEST: capturing the base through the live idle pose again,\n"
                  "           the way the shipped bug did. The cycle MUST fail.")
        with sync_playwright() as play:
            browser = play.chromium.launch()
            print("Scrolling the page:")
            failures = check_scroll(browser, server.server_port, 1440, 900)
            failures += check_scroll(browser, server.server_port, 390, 760)
            print("Browser chrome retracting and returning:")
            failures += check_chrome_cycle(browser, server.server_port, 390, 760)
            failures += check_chrome_cycle(browser, server.server_port, 1440, 900)
            browser.close()
    finally:
        server.shutdown()

    if self_test:
        if failures:
            print("\nSELF-TEST PASS -- the contract caught the re-injected capture:")
            for line in failures[:6]:
                print("   *", line)
            return 0
        print("\nSELF-TEST FAIL -- the re-injected bug went undetected.")
        return 1
    if failures:
        print("\nFAIL:")
        for line in failures:
            print("   *", line)
        return 1
    print("\nHero head keeps its place across a scroll: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
