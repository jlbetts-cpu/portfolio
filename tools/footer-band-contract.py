#!/usr/bin/env python3
"""Painted-pixel contract for the footer band.

WHY THIS IS A PIXEL CONTRACT AND NOT A CSS ONE. Every defect this band produced
while it was being built read as PASSING through the CSSOM and through the
component's own numbers:

  * the canvas backing store was sized from ResizeObserver's contentRect, which
    excludes the band's padding-block. The element was 249px tall and its bitmap
    was 201, so the whole picture -- mesh, glyphs and wordmark -- was stretched
    vertically by 1.24. Nothing errored, nothing clipped, and the probe reported
    a canvas that "fitted". On screen the wordmark was out of focus.
  * .siteFoot is at most the page measure wide on all eight pages, so an
    overflow-x:clip left on it cuts a full-bleed child off at 1200px on the six
    pages whose footer sits inside .wrap and not at all on the two whose footer
    is a <body> child. Six pages would have had a band that stopped short, and
    the page anybody screenshots first is one of the two that looked right.
  * the inner shadow is composited source-atop so it cannot leave the letters.
    Drop that one word and it becomes a drop shadow on the largest surface on
    the site -- and the shadow rule here is absolute: the companion heads cast a
    contact shadow and nothing else does. An inset shadow inside a letterform is
    a different claim and Jayden asked for it; an escaped one is the rule broken.
  * under reduced motion the original multiplies the per-glyph jitter by zero.
    Frozen at t=6 the same term is a fixed offset and the field reads as grain;
    zeroed, every glyph snaps to the 21px cell and the still frame is a lattice
    you can count rows and columns in. Both are "static" to a diff of two frames.

So: real pages, real pixels, real reduced-motion, and a --self-test that puts
each of those four back and requires the contract to catch it.

    python3 tools/footer-band-contract.py
    python3 tools/footer-band-contract.py --self-test
    python3 tools/footer-band-contract.py --prefix _band_    # verify a staged
        markup patch before it is applied to the shipping pages. The footer
        markup lives in eight files this component does not own, so the patch is
        handed over rather than applied; the prefix lets it be proved first.
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
PORT = 4231

# The eight pages that carry a footer. headmaker.html and gradientlab.html both
# compute overflow:hidden and cannot scroll to one; footer-consistency-check
# owns that list and this one must not drift from it.
PAGES = ["index.html", "about.html", "apollo.html", "bearings.html",
         "cluster.html", "strata.html", "ucdavis.html", "play.html"]

# The band is the largest animated surface on the site and it is on every page,
# so its frame cost is a standing tax. Measured 2026-08-19 on the band at 1440
# under headless Chromium's software rasteriser -- which is PESSIMISTIC, and the
# budget is set against it anyway so it can only get better on real hardware.
# One draw at 1440x228 is 671 warped mesh samples and ~760 glyphs: median 3.3ms
# on an idle machine, 4.2ms on a loaded one. The MEDIAN is what is gated, at 7 --
# a real regression is structural (an extra fbm octave, an uncapped mesh buffer,
# a per-frame mark rebuild) and doubles it, while the tail is the host's
# scheduler and GC and swings 4.6 to 16.5 with nothing changed. Gating the tail
# would be gating this laptop. The worst case is still gated, loosely, at 25 --
# far enough out that only something pathological reaches it, and still inside a
# 33ms frame.
MEDIAN_BUDGET_MS = 7.0
WORST_BUDGET_MS = 25.0
FRAME_MS = 33          # the band draws at 30fps; see footer-band.js


class Quiet(SimpleHTTPRequestHandler):
    """Serves the worktree, optionally with one substitution applied to one
    asset. That is how --self-test re-injects a bug: the file on disk is never
    touched, so a crashed run cannot leave the tree broken."""

    patch = None       # (filename, needle, replacement)

    def do_GET(self):
        name = self.path.split("?", 1)[0].lstrip("/")
        if self.patch and name == self.patch[0]:
            src = (ROOT / name).read_text(encoding="utf-8")
            if self.patch[1] not in src:
                self.send_error(500, "self-test needle not found: %r" % self.patch[1])
                return
            body = src.replace(self.patch[1], self.patch[2]).encode("utf-8")
            ctype = "text/css" if name.endswith(".css") else "application/javascript"
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        return SimpleHTTPRequestHandler.do_GET(self)

    def log_message(self, *_a):
        pass


def serve():
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), partial(Quiet, directory=str(ROOT)))
    Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def png(shot):
    return Image.open(io.BytesIO(shot)).convert("RGB")


def open_page(page, base, name, prefix, reduced=False):
    page.goto(base + prefix + name, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(300)
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(1600 if not reduced else 900)


def band_box(page):
    return page.evaluate("""()=>{
      const b=document.querySelector('.footBand');
      if(!b) return null;
      const r=b.getBoundingClientRect();
      const f=b.querySelector('.footBandField'), m=b.querySelector('.footBandMark');
      return {l:r.left, t:r.top, w:r.width, h:r.height, bottom:r.bottom,
              vw:document.documentElement.clientWidth,
              docH:document.documentElement.scrollHeight,
              pageBottom:r.bottom+scrollY,
              dpr:Math.min(devicePixelRatio||1,2),
              padW:b.clientWidth, padH:b.clientHeight,
              fw:f?f.width:0, fh:f?f.height:0, mw:m?m.width:0, mh:m?m.height:0};
    }""")


# ── the checks ───────────────────────────────────────────────────────────────

def check_bleed(page, name, fails):
    """END TO END, on every page. This is the assertion the six .wrap pages need
    and the two <body>-child pages would never have caught."""
    box = band_box(page)
    if not box:
        fails.append("%s: no .footBand in the DOM (markup patch not applied?)" % name)
        return None
    if abs(box["l"]) > 1 or abs(box["l"] + box["w"] - box["vw"]) > 1:
        fails.append("%s: band is not full bleed -- spans %.1f..%.1f of a %.0f viewport"
                     % (name, box["l"], box["l"] + box["w"], box["vw"]))
    # THE BITMAP MUST BE THE BOX. Both canvases are inset:0 / 100%x100%, so
    # they cover the band's PADDING box. Size the backing store from anything
    # smaller -- ResizeObserver's contentRect is the one that is right there and
    # excludes padding-block -- and the browser scales the bitmap up to fit. It
    # does not error, it does not clip, and the component's own probe reports a
    # canvas that "fitted". What you get is the whole picture stretched, and at
    # 249 against 201 that is 1.24x: the wordmark reads as out of focus and
    # every other number on this page still passes.
    for label, cw, ch in (("field", box["fw"], box["fh"]), ("mark", box["mw"], box["mh"])):
        want_w, want_h = box["padW"] * box["dpr"], box["padH"] * box["dpr"]
        if abs(cw - want_w) > 2 or abs(ch - want_h) > 2:
            fails.append("%s: the %s canvas is %dx%d device px for a %.0fx%.0f box at dpr %g "
                         "-- the bitmap does not match the element, so the picture is scaled "
                         "(%.3fx vertically)"
                         % (name, label, cw, ch, want_w, want_h, box["dpr"],
                            (want_h / ch) if ch else 0))
    if abs(box["pageBottom"] - box["docH"]) > 1.5:
        fails.append("%s: band is not the last thing on the page -- %.1fpx of page ground "
                     "below it (the page's padding-bottom is not being cancelled)"
                     % (name, box["docH"] - box["pageBottom"]))
    return box


def sample(page, box, xs, ys):
    """Reads the painted band. Screenshots the element and returns pixels at
    fractions of its box, so nothing here depends on a computed style."""
    el = page.query_selector(".footBand")
    im = png(el.screenshot())
    out = []
    for fx, fy in zip(xs, ys):
        x = max(0, min(im.width - 1, int(im.width * fx)))
        y = max(0, min(im.height - 1, int(im.height * fy)))
        out.append(im.getpixel((x, y)))
    return im, out


def check_knockout(page, name, fails):
    """The letterforms are the PAGE's ground colour and the band is not, which is
    what makes the wordmark read as cut through it rather than printed on it."""
    ground = page.evaluate("""()=>{
      const c=getComputedStyle(document.documentElement).backgroundColor;
      const m=/rgba?\\(([^)]+)\\)/.exec(c); if(!m) return null;
      const p=m[1].split(/[\\s,\\/]+/).map(Number); return [p[0],p[1],p[2]];
    }""")
    el = page.query_selector(".footBand")
    im = png(el.screenshot())
    W, H = im.size
    # The thickest ink in "Jayden Betts" is the B's stem. Walk the row through
    # the x-height and take the longest run that is within 12 of the page ground.
    y = int(H * 0.55)
    row = [im.getpixel((x, y)) for x in range(W)]

    def near(p, q, tol):
        return all(abs(p[i] - q[i]) <= tol for i in range(3))

    runs, start = [], None
    for x, p in enumerate(row):
        hit = near(p, ground, 14)
        if hit and start is None:
            start = x
        elif not hit and start is not None:
            runs.append((start, x)); start = None
    if start is not None:
        runs.append((start, W))
    runs = [r for r in runs if r[1] - r[0] >= 6]
    if not runs:
        fails.append("%s: no run of page-ground pixels across the wordmark -- the "
                     "letterforms are not the knockout" % name)
        return None
    longest = max(runs, key=lambda r: r[1] - r[0])
    # and the band itself must NOT be the page ground, or "knockout" means nothing
    edge = im.getpixel((int(W * 0.02), int(H * 0.5)))
    if near(edge, ground, 24):
        fails.append("%s: the band is the same colour as the page ground; there is "
                     "nothing for the wordmark to be cut out of" % name)
    return longest, y, im, ground


def check_inset(page, name, fails):
    """The depth is INSIDE the type. Two halves, and both matter:
       - inside the letterform, the top edge must be shaded against its middle
       - immediately OUTSIDE it, nothing may be darkened at all
    The second half is the shadow rule. An inner shadow that has escaped its
    letterform is a cast shadow, and on this site only the companion heads cast
    one."""
    got = check_knockout(page, name, fails)
    if not got:
        return
    (x0, x1), _y, im, ground = got
    W, H = im.size
    x = (x0 + x1) // 2
    col = [im.getpixel((x, yy)) for yy in range(H)]

    def lum(p):
        return .299 * p[0] + .587 * p[1] + .114 * p[2]

    def near(p, q, tol):
        return all(abs(p[i] - q[i]) <= tol for i in range(3))

    ink = [yy for yy, p in enumerate(col) if near(p, ground, 26)]
    if len(ink) < 20:
        fails.append("%s: could not find the letterform's vertical extent" % name)
        return
    top, bot = ink[0], ink[-1]
    mid = (top + bot) // 2
    inner_top = lum(col[min(bot, top + max(2, (bot - top) // 12))])
    centre = lum(col[mid])
    light = lum(ground) > 128
    delta = (centre - inner_top) if light else (inner_top - centre)
    if delta < 4:
        fails.append("%s: no inset shading inside the letterform (top edge vs centre "
                     "differs by %.1f, needs 4). The wordmark is flat." % (name, delta))

    # ── and nothing outside it. Compare a band pixel two glyph-heights above the
    #    letter against one at the same height far from any ink: an escaped
    #    shadow darkens the first and not the second.
    span = max(6, (bot - top) // 8)
    above = top - span
    if above >= 0:
        near_ink = lum(im.getpixel((x, above)))
        # the same row, at the far left where the wordmark never reaches
        away = lum(im.getpixel((int(W * 0.012), above)))
        if near_ink < away - 10:
            fails.append("%s: the band is %.1f darker just above the wordmark than it is "
                         "away from it -- the inner shadow has escaped the letterform "
                         "and is casting. Nothing on this site casts a shadow except "
                         "the companion heads." % (name, away - near_ink))


def check_reduced(page, base, prefix, fails):
    """Still means STILL, and it also means the picture does not change shape.
    Two frames 1.4s apart must be byte-identical, and the glyphs must NOT have
    snapped back onto the 21px cell grid -- a frozen jitter is grain, a zeroed
    one is a lattice."""
    open_page(page, base, "about.html", prefix, reduced=True)
    el = page.query_selector(".footBand")
    a = el.screenshot()
    page.wait_for_timeout(1400)
    b = el.screenshot()
    if a != b:
        fails.append("reduced motion: the band repainted between two frames 1.4s apart")
    probe = page.evaluate("()=>window.FooterBand?window.FooterBand.probe(false):null")
    if probe and probe["running"]:
        fails.append("reduced motion: the rAF loop is still scheduled")
    # A ZEROED JITTER AND A FROZEN ONE ARE BOTH PERFECTLY STATIC, so the diff
    # above cannot tell them apart -- and they are not the same picture. Frozen
    # at t=6 the term is a fixed per-glyph offset and the field reads as grain;
    # zeroed, every glyph sits exactly on the 21px cell and the still frame is a
    # lattice with countable rows and columns. It cannot be read off the pixels
    # either, because the mesh underneath is opaque everywhere and swamps any
    # column statistic (a first cut measured the width of its own sampling
    # window and reported 0.357 for both). So the renderer banks the mean
    # absolute offset it actually applied: 2 * (2/pi) * 2.2 = 2.80 for the real
    # thing, exactly 0 for the injected one.
    if probe and probe.get("jitter", 0) < 1.2:
        fails.append("reduced motion: the mean per-glyph jitter is %.2fpx (frozen is ~2.8). "
                     "It has been zeroed rather than frozen, and the still frame is a "
                     "countable 21px lattice rather than grain"
                     % probe.get("jitter", 0))


def check_observer(page, base, prefix, fails):
    """The band is below the fold on all eight pages. Off screen it must not
    merely pause -- it must not be scheduled at all."""
    page.goto(base + prefix + "about.html", wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(1200)
    page.evaluate("window.scrollTo(0,0)")
    page.wait_for_timeout(700)
    top = page.evaluate("()=>window.FooterBand?window.FooterBand.probe(false):null")
    if not top:
        fails.append("no window.FooterBand probe")
        return
    if top["running"]:
        fails.append("the loop is running while the band is off screen; an "
                     "IntersectionObserver is supposed to stop it")
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(700)
    bottom = page.evaluate("()=>window.FooterBand.probe(true)")
    if not bottom["running"]:
        fails.append("the loop did not restart when the band came back on screen")


def check_kill_switch(page, fails):
    """--foot-band-strength:0, one line, the same switch the Hero field has."""
    page.evaluate("""()=>{
      document.querySelector('.footBand').style.setProperty('--foot-band-strength','0');
      window.FooterBand.rebuild();
    }""")
    page.wait_for_timeout(400)
    p = page.evaluate("()=>window.FooterBand.probe(false)")
    if p["strength"] != 0:
        fails.append("--foot-band-strength:0 did not reach the renderer")
    if p["glyphs"] != 0:
        fails.append("--foot-band-strength:0 still painted %d glyphs" % p["glyphs"])
    if p["running"]:
        fails.append("--foot-band-strength:0 left the rAF loop scheduled")
    page.evaluate("""()=>{
      document.querySelector('.footBand').style.removeProperty('--foot-band-strength');
      window.FooterBand.rebuild();
    }""")


def check_cost(page, fails):
    """THE DRAW IS TIMED OFF THE rAF CLOCK, DELIBERATELY. Headless Chromium
    rasterises in software and throttles rAF, so wall-clock frame timings out of
    it are noise -- the same band measured p95 4.7ms on one run and 12.5ms on the
    next with nothing changed, at 12fps instead of 30. What is being bounded here
    is the cost of ONE draw, so it is called directly, sixty times, back to back:
    no scheduler, no compositor, one variable. The loop's own rate is checked
    separately and loosely, because that IS the thing headless cannot measure."""
    live = page.evaluate("""()=>{ window.FooterBand.probe(true); return 1; }""")
    page.wait_for_timeout(3000)
    p = page.evaluate("()=>window.FooterBand.probe(false)")
    if p["drawn"] < 20:
        fails.append("only %d frames drawn in 3s; the loop is not running" % p["drawn"])
    cost = page.evaluate("""()=>{
      const ts=[];
      for(let i=0;i<60;i++){
        const a=performance.now();
        window.FooterBand.frameAt(20 + i*0.001);
        ts.push(performance.now()-a);
      }
      ts.sort((a,b)=>a-b);
      return {p50:ts[30], p95:ts[56], max:ts[59]};
    }""")
    if cost["p50"] > MEDIAN_BUDGET_MS:
        fails.append("one draw costs a median of %.1fms against a budget of %.1f "
                     "(p95 %.1f, worst %.1f)"
                     % (cost["p50"], MEDIAN_BUDGET_MS, cost["p95"], cost["max"]))
    if cost["max"] > WORST_BUDGET_MS:
        fails.append("the worst of 60 draws took %.1fms against a ceiling of %.1f "
                     "(median %.1f)" % (cost["max"], WORST_BUDGET_MS, cost["p50"]))
    p["p50"] = cost["p50"]
    p["p95"] = cost["p95"]
    p["worstMs"] = cost["max"]
    return p


def check_theme_walk(page, fails):
    """A full-bleed surface may not SNAP between two grounds while every other
    colour in the footer cross-fades -- section 14 of the Apple reference names
    abrupt brightness changes, and this is the largest surface on the page.

    THE TRAJECTORY IS POLLED, NOT SCREENSHOTTED, and that is not a shortcut. A
    headless element screenshot takes long enough that a 400ms tween has finished
    before the pixels come back, so a pixel test reports every transition as a
    snap -- it did, at 77.4 against a target of 77.1. The pixels still have to
    prove the two ENDS differ; only the middle is read off the renderer."""
    el = page.query_selector(".footBand")

    def mean_lum():
        im = png(el.screenshot())
        px = list(im.getdata())
        return sum(.299 * p[0] + .587 * p[1] + .114 * p[2] for p in px) / len(px)

    page.evaluate("()=>{ if(window.SiteTheme) window.SiteTheme.setMode('daytime'); }")
    page.wait_for_timeout(900)
    day = mean_lum()
    page.evaluate("()=>{ window.SiteTheme.setMode('night'); }")
    page.wait_for_timeout(1200)
    night = mean_lum()
    if abs(day - night) < 6:
        fails.append("the band paints the same in daytime and night (%.1f vs %.1f); the "
                     "palette is not following the theme at all" % (day, night))
        return

    # WHAT IS ASSERTED IS THE SCHEDULED DURATION, NOT A FRAME COUNT. The walk
    # runs on --ease-out (cubic-bezier(.22,1,.36,1)), the sky's curve, which
    # spends most of its travel in the first third; the band draws at 30fps, and
    # a loaded machine drops the whole page to 8. Counting intermediate frames
    # therefore measures the HOST -- the same build read 5 distinct values on an
    # idle machine, 3 on a busy one and 0 on a busier one. The invariant is that
    # a tween of the theme's own length is SCHEDULED, which is one number and is
    # readable on the same tick as the theme change. The regression it exists to
    # catch -- settling the palette on the same call that starts it -- sets that
    # number to 0.
    walk = page.evaluate("""() => {
      window.SiteTheme.setMode('daytime');
      const p = window.FooterBand.probe(false);
      const r = getComputedStyle(document.documentElement)
                  .getPropertyValue('--theme-duration');
      const want = /ms/.test(r) ? parseFloat(r) : parseFloat(r) * 1000;
      return {dur: p.palDur, want: want, ink: p.pageInk};
    }""")
    if walk["dur"] <= 1:
        fails.append("the band scheduled a %.0fms palette tween on a theme change; it is "
                     "snapping between two grounds while every other colour in the footer "
                     "cross-fades over %.0fms" % (walk["dur"], walk["want"]))
    elif abs(walk["dur"] - walk["want"]) > 1:
        fails.append("the band's palette tween is %.0fms against --theme-duration %.0fms; "
                     "the band and the type it sits behind are travelling at different "
                     "speeds" % (walk["dur"], walk["want"]))
    page.wait_for_timeout(600)


def check_scripts(prefix, fails):
    """Static: every footer-bearing page loads the component."""
    for name in PAGES:
        path = ROOT / (prefix + name)
        if not path.exists():
            fails.append("%s: missing" % (prefix + name))
            continue
        src = path.read_text(encoding="utf-8")
        if 'src="footer-band.js"' not in src:
            fails.append("%s does not load footer-band.js" % (prefix + name))
        if 'class="footBand"' not in src:
            fails.append("%s has no .footBand in its footer markup" % (prefix + name))
    # And the field context must never be handed a shadow. The mark layer draws
    # one, inside the type; the layer that paints the whole band must not.
    js = (ROOT / "footer-band.js").read_text(encoding="utf-8")
    for bad in re.findall(r"\bfx\.shadow\w*", js):
        fails.append("footer-band.js sets %s on the FIELD context; only the mark "
                     "layer may carry a shadow, and only inside the type" % bad)
    if "source-atop" not in js:
        fails.append("footer-band.js no longer composites the inner shadow source-atop; "
                     "nothing is clipping it to the letterforms")
    css = (ROOT / "footer.css").read_text(encoding="utf-8")
    if "overflow-x:clip" in re.search(r"(?m)^\.siteFoot\s*\{([^}]*)\}", css).group(1):
        fails.append(".siteFoot clips overflow again; the full-bleed band is cut off at "
                     "the page measure on the six pages whose footer sits in .wrap")


def run(prefix, patch=None, quiet=False):
    Quiet.patch = patch
    httpd = serve()
    base = "http://127.0.0.1:%d/" % PORT
    fails = []
    try:
        check_scripts(prefix, fails)
        try:
            _drive(base, prefix, fails)
        except Exception as err:            # noqa: BLE001 -- a page that will not
            fails.append("the run did not complete: %s" % err)   # drive at all is a
    finally:                                                     # failure, not a crash
        httpd.shutdown()
        httpd.server_close()      # or the next self-test injection cannot bind
        Quiet.patch = None
    if not quiet and not fails and STATS:
        print("  band %dx%d, %d mesh samples, %d glyphs, one draw: median %.1fms / "
              "p95 %.1fms / worst %.1fms"
              % (STATS["w"], STATS["h"], STATS["samples"], STATS["glyphs"],
                 STATS["p50"], STATS["p95"], STATS["worstMs"]))
    return fails


STATS = {}


def _drive(base, prefix, fails):
        with sync_playwright() as pw:
            br = pw.chromium.launch()
            ctx = br.new_context(device_scale_factor=2, viewport={"width": 1440, "height": 900})
            page = ctx.new_page()
            page.on("pageerror", lambda e: fails.append("page error: %s" % e))
            for name in PAGES:
                open_page(page, base, name, prefix)
                check_bleed(page, name, fails)
            open_page(page, base, "about.html", prefix)
            check_inset(page, "about.html", fails)
            check_observer(page, base, prefix, fails)
            open_page(page, base, "about.html", prefix)
            STATS.clear()
            STATS.update(check_cost(page, fails) or {})
            check_kill_switch(page, fails)
            check_theme_walk(page, fails)
            ctx.close()

            rctx = br.new_context(device_scale_factor=2, viewport={"width": 1440, "height": 900},
                                  reduced_motion="reduce")
            rpage = rctx.new_page()
            rpage.on("pageerror", lambda e: fails.append("page error: %s" % e))
            check_reduced(rpage, base, prefix, fails)
            rctx.close()
            br.close()


# ── the self-test ────────────────────────────────────────────────────────────
# Each entry re-injects one defect this contract exists to catch. An injection
# that cannot fail is worse than no contract, so a green run here is the only
# reason to believe a green run above.
INJECTIONS = [
    ("the canvas sized from contentRect, not the border box (the 1.24x stretch)",
     "footer-band.js",
     "if (bs && bs.length) { w = bs[0].inlineSize; h = bs[0].blockSize; }",
     "if (e.contentRect) { w = e.contentRect.width; h = e.contentRect.height; }"),
    ("the inner shadow no longer clipped to the letterforms (it becomes a cast shadow)",
     "footer-band.js",
     'mx.globalCompositeOperation = "source-atop";\n  mx.shadowColor = insetInk;',
     'mx.globalCompositeOperation = "source-over";\n  mx.shadowColor = insetInk;'),
    ("the reduced-motion jitter zeroed instead of frozen (the countable lattice)",
     "footer-band.js",
     "ox = 2.2 * Math.sin(seconds * .9 + h);\n    oy = 2.2 * Math.cos(seconds * .8 + h * 1.2);",
     "ox = 0 * Math.sin(seconds * .9 + h);\n    oy = 0 * Math.cos(seconds * .8 + h * 1.2);"),
    ("the band no longer full bleed (clipped to the page measure)",
     "footer.css",
     "width:100vw;max-width:100vw;margin-inline:calc(50% - 50vw);",
     "width:100%;max-width:100%;margin-inline:0;"),
    ("the palette settled on the same call that started it (the theme snap)",
     "footer-band.js",
     "if (palDur <= 0) settlePalette(palStart + 1);",
     "settlePalette(palStart + palDur + 1);"),
    ("the loop left running while the band is off screen",
     "footer-band.js",
     ' }, { rootMargin: "120px 0px" }).observe(band);',
     ' }, { rootMargin: "100000px 0px" }).observe(band);'),
]


def self_test(prefix):
    print("SELF-TEST -- each injection must be caught\n")
    ok = True
    for label, target, needle, replacement in INJECTIONS:
        fails = run(prefix, patch=(target, needle, replacement), quiet=True)
        caught = bool(fails)
        print("  %s  %s" % ("CAUGHT " if caught else "MISSED ", label))
        if caught:
            print("            -> %s" % fails[0])
        ok = ok and caught
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument("--prefix", default="",
                    help="page filename prefix, for proving the markup patch "
                         "before it is applied to the shipping pages")
    args = ap.parse_args()
    if args.self_test:
        return 0 if self_test(args.prefix) else 1
    fails = run(args.prefix)
    if fails:
        for f in fails:
            print("FAIL  " + f)
        print("\nSTATUS=FAIL  %d problem(s)" % len(fails))
        return 1
    print("STATUS=PASS  the band bleeds edge to edge on %d pages, the wordmark is a "
          "knockout with its shading inside the type, reduced motion is one frozen "
          "frame, and the loop stops off screen." % len(PAGES))
    return 0


if __name__ == "__main__":
    sys.exit(main())
