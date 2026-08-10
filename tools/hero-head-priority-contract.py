#!/usr/bin/env python3
"""The head must still move after it has been measured.

hero-head-transform.js measures the portrait by neutralising its transform with
`important` -- it has to, because the entrance is a keyframe and a keyframe
outranks a plain inline style, so a base rectangle captured without the flag is
captured mid-arrival. It then puts the saved values back.

PUTTING A VALUE BACK IS NOT THE SAME AS TAKING THE FLAG OFF. `setProperty(name,
value)` with no priority argument clears the important flag in Blink. It does
NOT in WebKit: setting a custom property that is already declared !important
leaves the priority where it was. So on Safari the neutralising flag survived
every restore, and from that moment nothing could write the transform again --
not the drag, not the float, not even the resting tilt. Measured on the shipped
build in WebKit at 390x844: after a drag, --hero-head-x read `0px !important`
inline while getState().x read 24, and the computed matrix was
matrix(1,0,0,1,-105.5,0) -- a head that was not merely stuck but LEVEL, having
never received --hero-head-rest-rotate at all. The selection frame is written
from state.x/y rather than from these properties, so it tracked the finger
perfectly while the portrait sat still. That is exactly what Jayden reported:
"the box moves but the head doesn't move on mobile".

A CHROMIUM-ONLY TEST CANNOT SEE THIS, which is the whole difficulty: Blink
clears the flag, so the buggy code passes. So the failing engine is MODELLED
rather than required -- setProperty is shimmed, before any page script runs, to
behave the way WebKit does. Code that clears the flag with removeProperty is
unaffected by the shim; code that relies on setProperty to do it is not. If
Playwright's WebKit is installed the same drag is also run there for real, and
the two must agree.

Run:  python3 tools/hero-head-priority-contract.py
      python3 tools/hero-head-priority-contract.py --self-test
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
VIEWPORTS = ((390, 844), (1440, 900))
DRAG = (48, -32)

# The nine properties the file neutralises. All of them ride the transform, so
# any one of them left flagged freezes part of the head.
NEUTRAL = ["--hero-head-x", "--hero-head-y", "--hero-head-scale",
           "--hero-head-rotate", "--hero-head-float-x", "--hero-head-float-y",
           "--hero-head-float-rot", "--hero-head-enter-y", "--hero-head-enter-rot"]

# ── THE MODEL OF THE FAILING ENGINE ──────────────────────────────────────────
# Installed before any page script. This is not an approximation of WebKit's
# behaviour, it is the behaviour: a priority-less set over an existing
# !important declaration keeps the flag.
WEBKIT_SHIM = """
(() => {
  const raw = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function(name, value, priority){
    if(!priority && this.getPropertyPriority(name) === "important"){
      return raw.call(this, name, value, "important");
    }
    return raw.call(this, name, value, priority);
  };
})();
"""

# ── THE RE-INJECTION ─────────────────────────────────────────────────────────
# Puts back the restore that trusts setProperty to clear the flag.
REINJECT = (
    "   saved.forEach(function(pair){\n"
    "    wrap.style.removeProperty(pair[0]);\n"
    "    if(pair[1])wrap.style.setProperty(pair[0],pair[1],pair[2]||\"\");\n"
    "   });",
    "   saved.forEach(function(pair){\n"
    "    if(pair[1])wrap.style.setProperty(pair[0],pair[1]);\n"
    "    else wrap.style.removeProperty(pair[0]);\n"
    "   });",
)

READ = """() => {
 const wrap=document.querySelector('#heroHeadTransform');
 const sel=document.querySelector('#heroHeadSelection');
 const m=new DOMMatrixReadOnly(getComputedStyle(wrap).transform);
 const s=sel.getBoundingClientRect();
 const st=window.__heroHeadTransform.getState();
 const flagged={};
 for(const n of %s){
  const p=wrap.style.getPropertyPriority(n);
  if(p) flagged[n]=wrap.style.getPropertyValue(n)+' !'+p;
 }
 return {tx:+m.e.toFixed(2), ty:+m.f.toFixed(2), a:+m.a.toFixed(4), b:+m.b.toFixed(4),
         sel:[+s.left.toFixed(1),+s.top.toFixed(1)],
         state:{x:+st.x.toFixed(1),y:+st.y.toFixed(1),rot:+st.rotate.toFixed(2)},
         flagged};
}""" % NEUTRAL


class Quiet(SimpleHTTPRequestHandler):
    reinject = False

    def log_message(self, _format, *_args):
        pass

    def do_GET(self):
        if self.reinject and self.path.split("?")[0].endswith("/hero-head-transform.js"):
            body = (ROOT / "hero-head-transform.js").read_text(encoding="utf-8")
            assert REINJECT[0] in body, "the restore helper has moved; re-anchor the self-test"
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


def drag_head(page):
    spot = page.evaluate("()=>{const r=document.querySelector('#face')"
                         ".getBoundingClientRect();"
                         "return [r.left+r.width/2, r.top+r.height/2];}")
    page.mouse.move(spot[0], spot[1])
    page.wait_for_timeout(60)
    page.mouse.down()
    page.wait_for_timeout(60)
    for i in range(1, 9):
        page.mouse.move(spot[0] + DRAG[0] * i / 8, spot[1] + DRAG[1] * i / 8)
        page.wait_for_timeout(30)
    page.wait_for_timeout(80)
    result = page.evaluate(READ)
    page.mouse.up()
    return result


def check(browser_type, port, shim, label):
    """Rest must be tilted, and a drag must move the head as far as the frame."""
    failures = []
    with sync_playwright() as play:
        browser = getattr(play, browser_type).launch()
        for width, height in VIEWPORTS:
            context = browser.new_context(viewport={"width": width, "height": height},
                                          has_touch=width <= 760, is_mobile=width <= 760)
            if shim:
                context.add_init_script(WEBKIT_SHIM)
            page = context.new_page()
            page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="load")
            page.wait_for_timeout(2600)
            rest = page.evaluate(READ)
            moved = drag_head(page)
            where = f"{label} {width}x{height}"

            # 1. Nothing may still be carrying the neutralising flag.
            if rest["flagged"]:
                failures.append(f"{where}: the measuring pass left "
                                f"{rest['flagged']} declared !important -- every "
                                f"later transform write loses to it")
            # 2. The resting tilt has to be on the head, not merely in state.
            if abs(rest["b"]) < 0.05:
                failures.append(f"{where}: the head is rendering LEVEL "
                                f"(matrix b={rest['b']}) while state says "
                                f"{rest['state']['rot']}deg -- the resting tilt "
                                f"never reached the pixels")
            # 3. Head and frame are one rigid body: they move by the same amount.
            head = (moved["tx"] - rest["tx"], moved["ty"] - rest["ty"])
            frame = (moved["sel"][0] - rest["sel"][0], moved["sel"][1] - rest["sel"][1])
            print(f"  {where}: rest tilt b={rest['b']:+.4f}  "
                  f"drag moved head ({head[0]:+.1f},{head[1]:+.1f}) "
                  f"frame ({frame[0]:+.1f},{frame[1]:+.1f}) "
                  f"state ({moved['state']['x']:+.0f},{moved['state']['y']:+.0f})")
            if abs(head[0] - frame[0]) > 2 or abs(head[1] - frame[1]) > 2:
                failures.append(f"{where}: the frame moved "
                                f"({frame[0]:+.1f},{frame[1]:+.1f}) and the head moved "
                                f"({head[0]:+.1f},{head[1]:+.1f}) -- they are supposed "
                                f"to be one rigid body")
            if abs(head[0]) < 2 and abs(head[1]) < 2 and abs(moved["state"]["x"]) > 2:
                failures.append(f"{where}: the drag reached the model "
                                f"({moved['state']}) and never reached the head")
            context.close()
        browser.close()
    return failures


def webkit_available():
    try:
        with sync_playwright() as play:
            browser = play.webkit.launch()
            browser.close()
        return True
    except Exception:
        return False


def main():
    self_test = "--self-test" in sys.argv
    server = serve(self_test)
    try:
        if self_test:
            print("SELF-TEST: restoring the saved values with a priority-less "
                  "setProperty,\n           the way the shipped bug did. "
                  "Every check below MUST fail.")
        print("Blink, with WebKit's setProperty behaviour modelled:")
        failures = check("chromium", server.server_port, True, "modelled")
        if webkit_available():
            print("WebKit, for real:")
            failures += check("webkit", server.server_port, False, "webkit")
        else:
            print("WebKit not installed (`playwright install webkit`); "
                  "the modelled run above is the only evidence.")
    finally:
        server.shutdown()

    if self_test:
        if failures:
            print("\nSELF-TEST PASS -- the contract caught the re-injected restore:")
            for line in failures:
                print("   *", line)
            return 0
        print("\nSELF-TEST FAIL -- the re-injected bug went undetected.")
        return 1
    if failures:
        print("\nFAIL:")
        for line in failures:
            print("   *", line)
        return 1
    print("\nHero head transform priority: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
