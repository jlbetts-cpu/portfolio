#!/usr/bin/env python3
"""MINI-JAYDEN WEARS ONE PAIR OF EYES, AND THEY ARE ON HIS FACE.

Jayden: "his big head sometimes has four eyes -- a second pair up on his hair."

It is one head, not two stacked. The mini-Jayden is built from
fillerData() in play-engine.js, which hands spawnCompanion() a `cut` (the big
head baked into a 5:6 frame) plus `eyes` and `marks` saying where the features
are inside that frame. bakeMiniCut() draws the square portrait at the TOP of the
frame and then RE-DRAWS it shifted DOWN so his chin lands on the shared foot
plane -- and the eyes/marks were written for the un-shifted draw. Every one of
them therefore pointed a fifth of his own height too high, so his eye rig stood
on his forehead and the hairline above his real (blank-socket) eyes: four eyes.

WHY IT IS INTERMITTENT. spawnCompanion() hides this whole rig for a `__mirror`
head and shows a live clone of the big head instead, so the stale marks only
reach the screen on the FALLBACK -- when the clone cannot be built. That is the
path this file drives, deliberately: the fallback is the only place the numbers
are visible, and a number that is wrong everywhere but visible in one place is
still wrong.

WHAT IS ASSERTED
  A. FALLBACK REGISTRATION. Spawned without __mirror, the visible eye rig's
     centre lands on the eyes actually drawn in the bake, within 0.02 of the
     head's box height. The truth is measured from the bitmaps -- the bake's ink
     bbox against the source portrait's -- never from a constant, because the
     shift is derived from the live artwork and from window.__hmFOOT (measured
     0.9318, not the 0.945 default) and will move if either changes.
  B. THE MIRROR PATH STILL SHOWS ONE FACE. Spawned with __mirror, his own rig is
     display:none and the only visible eyes on him are the clone's two.

--self-test re-injects the pre-fix constants (the un-shifted eyes and marks) and
requires A to FAIL. An assertion that cannot fail is worth nothing.
"""
import argparse
import json
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent

# The stale constants this fix removed, restored verbatim for --self-test.
BUG = (
    """eyes:[{x:0.400,y:fy(0.5169),w:0.100,h:fh(0.048),ang:0,sc:"rgb(236,234,229)",ic:[46,35,28]},{x:0.603,y:fy(0.5269),w:0.100,h:fh(0.048),ang:0,sc:"rgb(236,234,229)",ic:[46,35,28]}],""",
    """eyes:[{x:0.400,y:0.431,w:0.100,h:0.040,ang:0,sc:"rgb(236,234,229)",ic:[46,35,28]},{x:0.603,y:0.439,w:0.100,h:0.040,ang:0,sc:"rgb(236,234,229)",ic:[46,35,28]}],""",
)

TOL = 0.02          # of the head's box height
SQUARE_EYE_Y = (0.5169, 0.5269)   # FACES.rest, in the square portrait's own space
BAKE_W, BAKE_H = 500, 600


class Quiet(SimpleHTTPRequestHandler):
    reinject = ()

    def log_message(self, _f, *_a):
        pass

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True

    def do_GET(self):
        if self.reinject and self.path.split("?")[0].endswith("/play-engine.js"):
            body = (ROOT / "play-engine.js").read_text(encoding="utf-8")
            for old, new in self.reinject:
                assert old in body, "re-injection anchor is gone: %r" % old[:48]
                body = body.replace(old, new, 1)
            raw = body.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        super().do_GET()


def serve(reinject=()):
    handler = type("H", (Quiet,), {"reinject": reinject})
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(handler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    return server


SPAWN = r"""
(mirror) => {
  var d = window.__hmFillerData && window.__hmFillerData();
  if (!d) return null;
  var sp = {cut: d.cut, eyes: d.eyes, marks: d.marks, __pid: 'rigtest',
            __noIntro: true, __filler: true};
  if (mirror) sp.__mirror = true;
  window.__hmSpawnOne(sp, 9500);
  return true;
}
"""

# The bake's true eye line, read off the two bitmaps rather than assumed.
TRUTH = r"""
async () => {
  var d = window.__hmFillerData && window.__hmFillerData();
  if (!d) return null;
  function load(src){return new Promise(function(r){
    var i=new Image(); i.onload=function(){r(i);}; i.onerror=function(){r(null);}; i.src=src;});}
  function ink(img){
    var c=document.createElement('canvas'); c.width=img.width; c.height=img.height;
    var x=c.getContext('2d'); x.drawImage(img,0,0);
    var a=x.getImageData(0,0,c.width,c.height).data, top=-1, bot=-1;
    for (var y=0;y<c.height;y++) for (var xx=0;xx<c.width;xx++)
      if (a[(y*c.width+xx)*4+3]>24){ if(top<0)top=y; bot=y; break; }
    return {w:c.width, h:c.height, top:top, bot:bot};
  }
  var bake = await load(d.cut);
  var face = document.getElementById('face');
  var src  = await load(face.getAttribute('src'));
  if (!bake || !src) return null;
  return {bake: ink(bake), src: ink(src), srcW: src.width};
}
"""

RIG = r"""
() => {
  var roots = [].slice.call(document.querySelectorAll('.hero > div'));
  var host = null;
  for (var i = roots.length - 1; i >= 0; i--) {
    var im = roots[i].querySelector(':scope > img');
    if (im && /^data:/.test(im.getAttribute('src') || '')) { host = roots[i]; break; }
  }
  if (!host) return null;
  var hr = host.getBoundingClientRect();
  if (!hr.height) return null;
  var out = {box: {w: +hr.width.toFixed(1), h: +hr.height.toFixed(1)}, visible: [], hidden: 0};
  [].forEach.call(host.querySelectorAll('.eye'), function (e) {
    var r = e.getBoundingClientRect();
    var shown = getComputedStyle(e).display !== 'none' && r.width > 0.5;
    if (!shown) { out.hidden++; return; }
    out.visible.push({fy: +(((r.top + r.height / 2) - hr.top) / hr.height).toFixed(4),
                      fw: +(r.width / hr.width).toFixed(4)});
  });
  return out;
}
"""


def measure(server, mirror):
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1512, "height": 850})
        page = ctx.new_page()
        page.goto("http://127.0.0.1:%d/play.html" % server.server_port,
                  wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(5000)
        truth = page.evaluate(TRUTH)
        if page.evaluate(SPAWN, mirror) is None:
            ctx.close(); browser.close()
            return None, None
        page.wait_for_timeout(2500)
        rig = page.evaluate(RIG)
        ctx.close(); browser.close()
    return truth, rig


def true_eye_line(truth):
    """Where the bake actually draws his eyes, as a fraction of the 5:6 frame.

    The square is drawn at BAKE_W wide, so the source's ink top maps to
    src.top * BAKE_W / srcW; the difference against the bake's own ink top IS
    the chin-seating shift, in bake pixels."""
    k = float(BAKE_W) / truth["srcW"]
    shift = truth["bake"]["top"] - truth["src"]["top"] * k
    return [(y * BAKE_W + shift) / BAKE_H for y in SQUARE_EYE_Y]


def check_fallback(server):
    truth, rig = measure(server, mirror=False)
    if not truth or not rig:
        return False, "could not spawn the mini-Jayden (no #face bake)"
    want = true_eye_line(truth)
    got = sorted(e["fy"] for e in rig["visible"])
    if len(got) != 2:
        return False, "fallback rig shows %d eyes, expected 2 (%r)" % (len(got), got)
    worst = max(abs(g - w) for g, w in zip(got, sorted(want)))
    line = ("rig fy %s vs the bake's drawn eyes %s -> worst %.4f of the box (tol %.2f)"
            % (got, [round(w, 4) for w in want], worst, TOL))
    return worst <= TOL, line


def check_mirror(server):
    truth, rig = measure(server, mirror=True)
    if not rig:
        return False, "could not spawn the mini-Jayden"
    n = len(rig["visible"])
    return n == 2, "mirror path shows %d visible eyes (%d hidden) -- expected 2" % (n, rig["hidden"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--self-test", action="store_true",
                    help="re-inject the un-shifted marks and require task A to fail")
    args = ap.parse_args()

    if args.self_test:
        server = serve((BUG,))
        ok, line = check_fallback(server)
        server.shutdown()
        print("self-test  A  %s" % line)
        if ok:
            print("FAIL  the injected bug did not trip the assertion")
            return 1
        print("PASS  the injected bug trips it")
        return 0

    server = serve()
    fails = 0
    for name, fn in (("A fallback registration", check_fallback),
                     ("B mirror shows one face", check_mirror)):
        ok, line = fn(server)
        print("%-26s %s  %s" % (name, "PASS" if ok else "FAIL", line))
        if not ok:
            fails += 1
    server.shutdown()
    print("PASS" if not fails else "FAIL")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
