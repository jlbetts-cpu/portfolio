#!/usr/bin/env python3
"""Prove a change moved no pixels: render two trees and subtract them.

WHY. The image-box fix on the case studies adds `width`/`height` attributes to
45 <img> tags. That is meant to change WHEN a box exists, never HOW BIG it is --
but "meant to" is not a measurement, and this project has a standing rule that a
surprising number must be checked before it is trusted. So both trees are
rendered at the same widths with images already warm and the frames subtracted.
Zero differing pixels is the claim; anything else is a finding.

Screenshots are taken with `animations="disabled"` and after a settle delay, so
the reveal system and the ink boil cannot make two runs of the SAME tree differ.
The script proves that first (a tree against itself) before it compares two.

    python3 tools/render-diff.py --a /tmp/pristine --b . --widths 390,1440
    python3 tools/render-diff.py --self-test
"""
import argparse
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

REPO = Path(__file__).resolve().parents[1]
PAGES = ["about.html", "apollo.html", "bearings.html", "cluster.html",
         "strata.html", "ucdavis.html", "gradientlab.html"]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve(root, port):
    srv = ThreadingHTTPServer(("127.0.0.1", port), partial(Quiet, directory=str(root)))
    Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def shoot(browser, root, port, pages, widths, outdir, tag, settle):
    srv = serve(root, port)
    outdir.mkdir(parents=True, exist_ok=True)
    try:
        for w in widths:
            ctx = browser.new_context(viewport={"width": w, "height": 900},
                                      device_scale_factor=1,
                                      reduced_motion="reduce")
            pg = ctx.new_page()
            for page in pages:
                pg.goto(f"http://127.0.0.1:{port}/{page}", wait_until="load", timeout=45000)
                # every lazy image in, every reveal finished, every timer settled
                pg.evaluate("""() => new Promise(r => {
                    document.querySelectorAll('img[loading=lazy]').forEach(i =>
                        i.removeAttribute('loading'));
                    window.scrollTo(0, document.body.scrollHeight);
                    setTimeout(() => { window.scrollTo(0, 0); r(1); }, 900);
                })""")
                # EVERY IMAGE DECODED BEFORE THE SHUTTER. Without this the same
                # tree rendered twice differs -- one run catches a gallery frame
                # still blank -- and a harness that cannot reproduce itself
                # cannot testify about anything else. This is what the
                # --self-test proves before any two-tree verdict is believed.
                pg.evaluate("""() => Promise.all(
                    [...document.images]
                      .filter(i => i.src && !i.src.startsWith('data:'))
                      .map(i => i.decode().catch(() => {})))""")
                pg.wait_for_timeout(settle)
                pg.screenshot(path=str(outdir / f"{page}-{w}-{tag}.png"),
                              full_page=True, animations="disabled")
            ctx.close()
    finally:
        srv.shutdown()


def compare(outdir, pages, widths, ta, tb):
    worst = 0
    for page in pages:
        for w in widths:
            pa = outdir / f"{page}-{w}-{ta}.png"
            pb = outdir / f"{page}-{w}-{tb}.png"
            if not (pa.exists() and pb.exists()):
                print(f"{page:<18}{w:>6}  MISSING")
                continue
            a, b = Image.open(pa).convert("RGB"), Image.open(pb).convert("RGB")
            if a.size != b.size:
                print(f"{page:<18}{w:>6}  SIZE {a.size} -> {b.size}   "
                      f"(document height changed by {b.size[1]-a.size[1]}px)")
                worst = max(worst, 1)
                h = min(a.size[1], b.size[1])
                a, b = a.crop((0, 0, a.size[0], h)), b.crop((0, 0, b.size[0], h))
                if a.size != b.size:
                    continue
            diff = ImageChops.difference(a, b)
            bbox = diff.getbbox()
            if bbox is None:
                print(f"{page:<18}{w:>6}  identical")
                continue
            hist = diff.convert("L").histogram()
            nonzero = sum(hist[1:])
            over8 = sum(hist[9:])
            print(f"{page:<18}{w:>6}  {nonzero:>9} px differ ({over8} by >8/255)  bbox={bbox}")
            worst = max(worst, over8)
    return worst


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--a", default=None, help="reference tree")
    ap.add_argument("--b", default=str(REPO), help="tree under test")
    ap.add_argument("--pages", default=",".join(PAGES))
    ap.add_argument("--widths", default="390,1440")
    ap.add_argument("--out", default="/tmp/render-diff")
    ap.add_argument("--port", type=int, default=4820)
    ap.add_argument("--settle", type=int, default=2600)
    ap.add_argument("--self-test", action="store_true",
                    help="render the SAME tree twice; anything but identical means "
                         "the harness is non-deterministic and its verdicts are void")
    args = ap.parse_args()

    pages = args.pages.split(",")
    widths = [int(x) for x in args.widths.split(",")]
    out = Path(args.out)

    with sync_playwright() as p:
        br = p.chromium.launch()
        if args.self_test:
            shoot(br, Path(args.b), args.port, pages, widths, out, "s1", args.settle)
            shoot(br, Path(args.b), args.port + 1, pages, widths, out, "s2", args.settle)
            br.close()
            print("\nSELF-TEST: same tree twice, must be identical everywhere")
            worst = compare(out, pages, widths, "s1", "s2")
            print("SELF-TEST", "PASS" if worst == 0 else "FAIL")
            return 0 if worst == 0 else 1
        shoot(br, Path(args.a), args.port, pages, widths, out, "a", args.settle)
        shoot(br, Path(args.b), args.port + 1, pages, widths, out, "b", args.settle)
        br.close()
    print()
    compare(out, pages, widths, "a", "b")
    return 0


if __name__ == "__main__":
    sys.exit(main())
