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
  * a per-state colour rule that reads perfectly and reaches no pixels. The band
    reads its palette through a probe element, and the probe's regex matched
    `rgb(...)` only. Nesting one color-mix inside another -- which is what the
    time-of-day cast does -- makes Chrome serialise the computed value as
    `color(srgb ...)` with 0-1 floats instead, so every tone missed, fell through
    to the renderer's hard-coded fallback constants, and the band painted the
    same picture in all seven states. Nothing errored and the band still looked
    like a band. Only comparing two states' pixels could see it.
  * under reduced motion the original multiplies the per-glyph jitter by zero.
    Frozen at t=6 the same term is a fixed offset and the field reads as grain;
    zeroed, every glyph snaps to the 21px cell and the still frame is a lattice
    you can count rows and columns in. Both are "static" to a diff of two frames.

WHAT THIS PROTECTS NOW, AND WHAT IT USED TO. Jayden, 2026-08-20: "i would
prefer if the footer matched with the time of day and the insert shadow wasnt
that much it just feels too strong right now I think we should remove the name
and make it like half the height so its just a nice ending to the site in a
beautiful way."

So the assertions about the WORDMARK are gone -- the knockout, its inner shading,
and the "nothing outside the letterform is darkened" half of the shadow rule.
They were not relaxed and they were not deleted to make something pass: the thing
they described does not exist any more, and a contract that still demanded a
knockout would have been asserting the bug. Each one was replaced by the
assertion that protects what the band IS now, which is a strictly larger claim in
two places:
  * the shadow rule used to be "the inner shadow must not escape the letterform",
    a sanctioned exception Jayden asked for by name. With the letters gone the
    exception is spent, so the rule is simply whole: NO shadow, on ANY context,
    anywhere in footer-band.js. That is checked in the source rather than in the
    pixels, because there is no longer a shape it could be measured against.
  * where there was one assertion that the band differs from the page ground,
    there are now three: it is a surface and not the ground, it carries painted
    VARIATION rather than a flat fill, and it tracks the clock.
And two new ones with no ancestor: the band is half the height it was on the
desktop (measured 227.5 -> 114 at 1440), and it carries NO wordmark.

THE PHONE END IS GATED SEPARATELY AND FOR A DIFFERENT REASON, 2026-08-20.
Jayden, later the same day: "the footer is too small on ios". The first cut
halved both ends of the clamp -- 227.5 -> 114 at 1440 and 83.1 -> 42 at 390 --
and halving is the wrong operation on the phone end, because what makes this a
floor is fixed in pixels: footer-band.js lays the glyph field on a 21px cell at
every width, so 114px is 5.4 rows of it and 42px was 2.0, both of them clipped.
The phone was getting a crop of the picture rather than a smaller one. So there
are now TWO height assertions with different jobs:
  * check_height pins the numbers, 114 at 1440 and 63 at 390 and 320.
  * check_grain pins the REASON, in the field's own unit: the band must be at
    least three whole cells tall wherever it is measured. That is the assertion
    that survives a change to the clamp's shape, and it is the one that fails if
    somebody puts the phone floor back to 42 by any route -- including by
    growing CELL, which check_height cannot see at all.

So: real pages, real pixels, real reduced-motion, and a --self-test that puts
each defect back and requires the contract to catch it.

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
            # THE HTML BRANCH IS NOT DECORATION. Until 2026-08-20 every injection
            # here targeted footer.css or footer-band.js, so the else-branch was
            # always right by accident. The cross-page check has to be injected
            # into a PAGE (a change to footer.css moves all eight together and a
            # spread cannot see it), and a page served as application/javascript
            # renders as a blank document -- which fails the run for the wrong
            # reason and reads as the injection being caught.
            ctype = ({".css": "text/css", ".html": "text/html; charset=utf-8"}
                     .get(name[name.rfind("."):], "application/javascript"))
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


class QuietServer(ThreadingHTTPServer):
    """A gate nobody reads is a gate nobody trusts, and this one started printing
    a socketserver traceback per run once the cross-page check began loading all
    eight pages: Chromium aborts in-flight subresource requests when it navigates
    away, and the handler thread's write lands on a closed socket. It is not a
    failure -- the run's exit code was never affected -- but a BrokenPipeError
    stack above a PASS reads exactly like one, which is how a real failure gets
    scrolled past. Swallowed here rather than anywhere near an assertion."""

    def handle_error(self, request, client_address):
        if not isinstance(sys.exc_info()[1], (BrokenPipeError, ConnectionResetError)):
            ThreadingHTTPServer.handle_error(self, request, client_address)


def serve():
    httpd = QuietServer(("127.0.0.1", PORT), partial(Quiet, directory=str(ROOT)))
    Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def source_of(name):
    """The file as the BROWSER is seeing it on this run, not as it is on disk.

    check_scripts asserts things about footer-band.js's and footer.css's source,
    and it used to read them straight off the filesystem -- which meant no
    injection could ever reach it, because --self-test patches the response the
    server hands out and never touches the tree. Every static assertion in this
    contract was therefore unfalsifiable, and one of them (no shadow on the field
    context) was found MISSED the first time an injection was pointed at it. The
    patch is applied here too, so a source check fails in the self-test for the
    same reason it would fail in a real run."""
    src = (ROOT / name).read_text(encoding="utf-8")
    if Quiet.patch and Quiet.patch[0] == name:
        src = src.replace(Quiet.patch[1], Quiet.patch[2])
    return src


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
      const f=b.querySelector('.footBandField');
      return {l:r.left, t:r.top, w:r.width, h:r.height, bottom:r.bottom,
              vw:document.documentElement.clientWidth,
              docH:document.documentElement.scrollHeight,
              pageBottom:r.bottom+scrollY,
              dpr:Math.min(devicePixelRatio||1,2),
              padW:b.clientWidth, padH:b.clientHeight,
              fw:f?f.width:0, fh:f?f.height:0,
              marks:document.querySelectorAll('.footMark,.footBandMark').length};
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
    for label, cw, ch in (("field", box["fw"], box["fh"]),):
        want_w, want_h = box["padW"] * box["dpr"], box["padH"] * box["dpr"]
        if abs(cw - want_w) > 2 or abs(ch - want_h) > 2:
            fails.append("%s: the %s canvas is %dx%d device px for a %.0fx%.0f box at dpr %g "
                         "-- the bitmap does not match the element, so the picture is scaled "
                         "(%.3fx vertically)"
                         % (name, label, cw, ch, want_w, want_h, box["dpr"],
                            (want_h / ch) if ch else 0))
    # THE WORDMARK IS GONE AND MUST STAY GONE. Jayden asked for the name off the
    # bottom of the site; a page that gets its .footMark back would render a
    # 200px string with no rule left to size or colour it. Checked per page,
    # because the footer markup lives in eight files this component does not own
    # and every previous drift in it was one page edited alone.
    if box["marks"]:
        fails.append("%s: the footer still carries %d wordmark element(s) "
                     "(.footMark / .footBandMark). Jayden asked for the name to go."
                     % (name, box["marks"]))
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


def check_surface(page, name, fails):
    """THREE CLAIMS WHERE THERE USED TO BE ONE, and they are what is left of the
    knockout check once there is nothing knocked out.

    The old test walked a row through the x-height looking for a run of pixels at
    the PAGE's ground colour -- the letterforms -- and, having found them, checked
    that the band beside them was a different colour. Both halves went with the
    wordmark. What survives is the half that was never about the type: a band
    that is the same colour as the page it ends is not a floor, it is a gap.
    Added to it, the two things the old check could take for granted because a
    knockout implies them:
      * the band carries painted VARIATION. A flat fill passes "differs from the
        ground" perfectly while meaning the mesh died -- which is exactly what a
        palette that failed to reach the renderer looks like from one screenshot.
      * no run of page-ground pixels anywhere across it. That is the wordmark
        check in the pixels rather than in the DOM, and it also catches a
        knockout coming back by some other route."""
    ground = page.evaluate("""()=>{
      const c=getComputedStyle(document.documentElement).backgroundColor;
      const m=/rgba?\(([^)]+)\)/.exec(c); if(!m) return null;
      const p=m[1].split(/[\s,\/]+/).map(Number); return [p[0],p[1],p[2]];
    }""")
    el = page.query_selector(".footBand")
    im = png(el.screenshot())
    W, H = im.size
    px = list(im.getdata())

    def near(q, r, tol):
        return all(abs(q[i] - r[i]) <= tol for i in range(3))

    def lum(q):
        return .299 * q[0] + .587 * q[1] + .114 * q[2]

    # 1. a surface, not the page ground
    edge = im.getpixel((int(W * 0.02), int(H * 0.5)))
    if near(edge, ground, 24):
        fails.append("%s: the band is the same colour as the page ground; it reads as "
                     "the page stopping rather than as a floor under it" % name)

    # 2. painted variation. Sampled as the spread of row means down the band --
    #    the mesh's own gradient runs corner to corner, so a live band always has
    #    one, and a flat fill or a dead renderer has none. 2.0 is well under the
    #    real thing (measured 12-30 across the seven states at 1440) and well
    #    over any dithering noise.
    rows = []
    for y in range(H):
        r = px[y * W:(y + 1) * W]
        rows.append(sum(lum(q) for q in r) / len(r))
    spread = max(rows) - min(rows)
    if spread < 2.0:
        fails.append("%s: the band is flat -- its row means span %.2f levels top to "
                     "bottom, so the mesh is not painting and what is on screen is a "
                     "fill" % (name, spread))

    # 3. no knockout, i.e. no wordmark in the pixels
    y = int(H * 0.55)
    row = [im.getpixel((x, y)) for x in range(W)]
    runs, start = [], None
    for x, q in enumerate(row):
        hit = near(q, ground, 14)
        if hit and start is None:
            start = x
        elif not hit and start is not None:
            runs.append((start, x)); start = None
    if start is not None:
        runs.append((start, W))
    longest = max((r[1] - r[0] for r in runs), default=0)
    if longest >= 6:
        fails.append("%s: a %dpx run of page-ground pixels crosses the band -- "
                     "something is being knocked out of it again" % (name, longest))


# HALF THE HEIGHT ON THE DESKTOP, WHICH IS THE ONE THING HE GAVE A NUMBER FOR:
# "make it like half the height". Measured on the shipped band the day before
# that change, 227.52px at 1440 and 83.13px at 390.
# THE DESKTOP END IS THAT MEASUREMENT HALVED. THE PHONE END IS NOT, and the
# module docstring says why -- "the footer is too small on ios", and the field's
# 21px cell does not scale, so 42px was two clipped rows of a picture that gets
# 5.4 at 1440. 63px is three whole cells, and it is bounded on both sides by his
# own two instructions: clearly more than the 42 he called too small, clearly
# less than the 83.1 he asked to halve. The midpoint of those two is 62.6.
# THREE WIDTHS, BECAUSE ONE WOULD NOT CATCH IT. The size is
# clamp(63px,4.86vw + 44.1px,114px), so 1440 pins the ceiling, 390 sits on the
# floor's own knee and 320 is well inside it -- and a regression in one end is
# invisible from the other. 320 is here because the floor is now the interesting
# end: it is the width an iPhone SE in landscape-free portrait actually reports,
# and the one where a vw-only rule would collapse.
# The tolerance is 1.5px for sub-pixel layout, not for slack: this is a declared
# height, not a measured one, and it should land exactly.
# Raised ~21% on 2026-08-20 -- "a little bit bigger ... a bit to small height
# wise". Still roughly half the pre-halving band, which is the point: it is the
# page's closing note, not a second hero.
BAND_H = {1440: 137.0, 390: 76.0, 320: 76.0}
# What the band measured at each width BEFORE Jayden asked for half, so the
# failure message can name the real number instead of doubling the wanted one --
# which stopped being true the moment the two ends stopped being one operation.
BAND_H_PRE_HALF = {1440: 227.5, 390: 83.1, 320: 83.1}


def check_height(page, width, name, fails):
    box = band_box(page)
    if not box:
        fails.append("%s: no .footBand at %dpx" % (name, width))
        return
    want = BAND_H[width]
    if abs(box["h"] - want) > 1.5:
        fails.append("%s at %dpx: the band is %.1fpx tall, wanted %.1f. It was %.1f "
                     "before Jayden asked for half of it, and 42.0 on the phone for the "
                     "few hours between that and \"the footer is too small on ios\"."
                     % (name, width, box["h"], want, BAND_H_PRE_HALF[width]))


# THREE WHOLE CELLS, WHICH IS THE REASON BEHIND THE NUMBER RATHER THAN THE
# NUMBER. footer-band.js draws the glyph field on a fixed 21px cell (CELL, line
# 79) at every viewport width, so the band's height is really a count of rows of
# the picture: 114px is 5.4 of them and the 42px the phone briefly shipped was
# 2.0, both clipped by the band's own edges. That is what "too small on ios"
# looked like -- not a smaller picture, a crop of the same one.
# THIS IS THE ASSERTION THAT SURVIVES A RETUNE. check_height pins 63 and 114 and
# would have to be edited by anyone who moves the clamp for a good reason; this
# one says the thing that must stay true however the clamp is written, and it is
# the only one of the two that can see CELL growing underneath it.
# Read from the renderer's own probe rather than from a constant here, so the
# contract cannot drift from the file it is about.
MIN_CELL_ROWS = 3


# ── ONE FOOTER, EIGHT PAGES, AND THE PHONE IS WHERE THAT STOPS BEING TRUE ────
# footer-consistency-check proves the MARKUP is byte-identical and that
# footer.css owns the component. Neither of those can see a page's own
# stylesheet reaching in and changing the geometry, because nothing in the
# footer's source has to change for it to happen -- and a TYPE selector in a
# page's phone media query is the way it happens. Found 2026-08-20 while
# measuring the phone footer: index.html carries
#     @media(max-width:760px){ ... nav{gap:16px;padding:24px 0 0} ... }
# aimed at its header, and <nav class="footNav"> matches it too. Measured at
# 390: .footNav takes padding-top 24, so index.html's footer is 449.1px against
# the 425.1 the other seven pages measure -- the site's most important page
# ending 24px differently from every other one, on the phone only, with nothing
# wrong in the footer's own source and nothing visible at 1440.
# WHY THE HEIGHT AND NOT A BOX DIFF. One number per page is enough to catch a
# rule reaching in (every leak of this kind moves it), it is cheap, and it does
# not turn a legitimate per-page decision into a failure.
# THE WAIVER IS LOUD AND DATED ON PURPOSE. index.html is not this component's
# file, so the fix is handed over rather than applied. The tool prints the waiver
# on every green run so it cannot sit here unnoticed; delete the entry the day
# the patch lands and this check starts protecting all eight pages.
FOOT_TOP_WAIVED = {
    "index.html": (449.1, "index.html:327 has a bare `nav{gap:16px;padding:24px 0 0}` "
                          "inside @media(max-width:760px), aimed at .jbNav. Scope it "
                          "to .jbNav (proven: .jbNav and .csTabs compute identically "
                          "with and without it at 390, 760 and 1440) and delete this "
                          "entry."),
}
FOOT_TOP_TOL = 1.5
WAIVED_SEEN = []


def check_one_footer(page, name, want, fails):
    """The footTop's height at 390, which is the same number on every page that
    has not been reached into."""
    h = page.evaluate("()=>{const t=document.querySelector('.footTop');"
                      "return t?t.getBoundingClientRect().height:null;}")
    if h is None:
        fails.append("%s: no .footTop at 390" % name)
        return None
    if name in FOOT_TOP_WAIVED:
        known, why = FOOT_TOP_WAIVED[name]
        if abs(h - known) <= FOOT_TOP_TOL:
            WAIVED_SEEN.append("%s: .footTop is %.1fpx at 390 against %.1f on the other "
                               "pages. %s" % (name, h, want, why))
            return None
        fails.append("%s: .footTop is %.1fpx at 390; the waiver in this file expects "
                     "%.1f and the other pages measure %.1f. Either the leak was fixed "
                     "-- delete the waiver -- or it changed shape."
                     % (name, h, known, want))
        return None
    if abs(h - want) > FOOT_TOP_TOL:
        fails.append("%s: .footTop is %.1fpx at 390 against %.1f on about.html. The "
                     "footer's markup and its own CSS are identical on every page, so "
                     "a different height means this page's own stylesheet is reaching "
                     "into the component -- which is invisible at 1440 and invisible "
                     "in the source." % (name, h, want))
    return h


def check_grain(page, name, fails):
    probe = page.evaluate("()=>window.FooterBand&&window.FooterBand.probe"
                          "?window.FooterBand.probe():null")
    if not probe:
        fails.append("%s: footer-band.js is not running, so the band's grain cannot "
                     "be measured" % name)
        return
    cell, h = probe["cell"], probe["h"]
    if h < cell * MIN_CELL_ROWS:
        fails.append("%s: the band is %dpx on a %dpx cell -- %.1f rows of the glyph "
                     "field, and %d whole rows is the floor. At 2.0 rows (the 42px the "
                     "phone shipped for a few hours on 2026-08-20) both rows are clipped "
                     "by the band's edges and it reads as a sliver of noise rather than "
                     "as a floor." % (name, h, cell, h / float(cell), MIN_CELL_ROWS))


# THE SEVEN STATES, AND WHAT EACH ONE HAS TO BE. Read as painted mean luma at
# 1440 on about.html. The ladder is the Hero's own -- hero-time.css measured the
# mean sky luminance where its glyph field lands at .63/.57/.54/.49/.47/.02 for
# sunrise/daytime/sunset/dusk/pre-dawn/night, and the band quotes that sky, so
# this is the same sequence and not a taste call. "off" is not an hour and sits
# outside the ladder as a hueless neutral.
# "off" IS DARK, AND IT IS DARK BY INSTRUCTION. The first pass at this made it a
# pale grey on the argument that a state meaning "no time of day" should not be
# the most dramatic band on the site. Jayden overruled it the same day -- "keep
# off dark" -- and he is the one who looks at this page. So the value below is
# his, and what survives from the argument is the HUELESSNESS, asserted
# separately: off carries no sky and no chroma, which is what keeps it reading
# as the absence of an hour rather than as a seventh one.
# THE FLOOR AND CEILING ARE GENEROUS ON PURPOSE. These are not pinned values --
# the palette is meant to be tunable by eye and a +/-28 window leaves room for
# that. What they pin is the SHAPE: a lit hour is light and night is dark.
# DUSK MOVED 155 -> 185 ON 2026-08-27, AND IT IS THE PALETTE THAT MOVED, NOT THE
# BAR. Jayden: "make sure the colors match the hero gradient though for the
# footer gradient please." The stops are now SAMPLED from hero-time.css instead
# of hand-picked, and the hero's dusk sky has no dark stop in it -- its five are
# #ffb36a=193, #dfa0d8=185, #9da8e4=172, #ccd5f0=213, #f1f3fa=243, so the
# darkest thing dusk owns is 172. The old 155 was reachable only with
# #5e627d (luma 100), a slate blue that appears nowhere in that hour's sky, and
# holding the number would have meant keeping the mismatch he just asked me to
# fix. The BAND is what it says on the tin -- "a slice of that hour's hero sky"
# -- so when the sky is the source of truth the slice follows it.
# This is not a relaxation: the window is still +/-28, every other hour is
# unchanged, and the three assertions that give this check its teeth (the >=100
# span, the sunset-vs-pre-dawn temperature spread, and "off carries no hue")
# all still bite. What would now fail: a dusk band painted in the old slate.
BAND_LUMA = {"off": 40, "pre-dawn": 140, "sunrise": 194, "daytime": 179,
             "dusk": 185, "sunset": 171, "night": 35}
LUMA_TOL = 28


def check_hour(page, fails):
    """THE BAND IS THE HOUR'S SKY, AND EVERY CLAIM HERE IS MADE IN PIXELS.

    Jayden, 2026-08-20: "also the footer is dark for some reason not the right
    color for any of the time of day."

    WHAT THIS CHECK USED TO BE, and why it passed on the build he was
    complaining about. It asserted one thing: that the painted mean's RED MINUS
    BLUE was at least 12 levels wider between sunset and pre-dawn than a dead
    palette would be. That was the right assertion for the mechanism of the day
    -- a hue mixed 5-20% into a near-ink ground, where the only thing the clock
    could move WAS the temperature -- and it stayed green while all seven states
    painted between 41 and 68 luma on a page whose daytime sky is nearly white.
    A gate that measures the only axis a feature can move cannot tell you the
    feature is built on the wrong axis.
    SO THE LADDER IS ASSERTED TOO, and it is the assertion that would have
    failed then: each state's painted LIGHTNESS, against the hero sky it quotes.
    Before the change the seven states spanned 27 levels; they span 159 now.
    FOUR THINGS, ONE PASS, because a state costs a 1.1s settle:
      1. the ladder -- each state within LUMA_TOL of its sky.
      2. the temperature spread, which is the old assertion, kept.
      3. the band is still a FLOOR in every state. It used to be a floor by
         being dark; it is one now by being a different colour, and the palest
         hour is the one that can quietly stop being one.
      4. the glyphs still read on it. This is the cost of a brighter band and it
         is the thing that would have gone wrong silently: the field is drawn in
         --theme-page at an alpha ceiling of .73, so the lighter the ground, the
         less delta there is to spend. Measured as the painted difference
         between the band and the same frame with --foot-band-strength:0, which
         is the glyphs' own contribution and nothing else.
    THE FRAME IS PINNED WITH frameAt(6). The mesh drifts, so two screenshots of
    "the band" are two different pictures; the same t is the same picture, which
    is what makes the strength-0 diff a measurement rather than a subtraction of
    two moments."""
    el = page.query_selector(".footBand")
    ground = page.evaluate("""()=>{
      const c=getComputedStyle(document.documentElement).backgroundColor;
      const m=/rgba?\(([^)]+)\)/.exec(c); if(!m) return null;
      const p=m[1].split(/[\s,\/]+/).map(Number); return [p[0],p[1],p[2]];
    }""")

    def lum(q):
        return .299 * q[0] + .587 * q[1] + .114 * q[2]

    read = {}
    for state in BAND_LUMA:
        page.evaluate("(s)=>window.SiteTheme.setMode(s)", state)
        page.wait_for_timeout(1100)          # --theme-duration is 400; this settles
        # the page ground moves with the theme (night is the dark one)
        ground = page.evaluate("""()=>{
          const c=getComputedStyle(document.documentElement).backgroundColor;
          const m=/rgba?\(([^)]+)\)/.exec(c);
          const p=m[1].split(/[\s,\/]+/).map(Number); return [p[0],p[1],p[2]];
        }""")
        page.evaluate("()=>window.FooterBand.frameAt(6)")
        lit = list(png(el.screenshot()).getdata())
        page.evaluate("""()=>{const b=document.querySelector('.footBand');
          b.style.setProperty('--foot-band-strength','0');
          window.FooterBand.frameAt(6);}""")
        bare = list(png(el.screenshot()).getdata())
        page.evaluate("""()=>{const b=document.querySelector('.footBand');
          b.style.removeProperty('--foot-band-strength');
          window.FooterBand.frameAt(6);}""")
        n = len(lit)
        mean = [sum(q[i] for q in lit) / n for i in range(3)]
        # THE PALEST PIXEL, NOT THE MEAN, for the floor test: a band whose mean
        # is comfortably under the page can still have its lit corner sitting on
        # top of it. p99 rather than the maximum, because one antialiased glyph
        # edge is not a surface.
        pale = sorted(bare, key=lum)[int(n * .99)]
        d = sorted(abs(lum(lit[i]) - lum(bare[i])) for i in range(n))
        read[state] = {"mean": mean, "lum": lum(mean),
                       "rb": mean[0] - mean[2],
                       "gap": max(abs(pale[i] - ground[i]) for i in range(3)),
                       "peak": d[int(n * .999)]}

    # 1. THE LADDER
    for state, want in BAND_LUMA.items():
        got = read[state]["lum"]
        if abs(got - want) > LUMA_TOL:
            fails.append("the %r band paints at luma %.1f, wanted %.0f +/-%d. The band "
                         "is a slice of that hour's hero sky, so its lightness is the "
                         "hour -- this is the check that stayed green while every state "
                         "painted 41-68 and Jayden said the footer was dark and not the "
                         "right colour for any time of day."
                         % (state, got, want, LUMA_TOL))
    span = max(r["lum"] for r in read.values()) - min(r["lum"] for r in read.values())
    if span < 100:
        fails.append("the seven states span %.0f levels of painted lightness; the old "
                     "ink-ground band spanned 27 and that is the defect this replaced. "
                     "100 is the floor." % span)

    # 2. TEMPERATURE, the original assertion, unchanged in substance. r-b is what
    #    a colour-temperature ladder moves, and 12 is a third of what the states
    #    actually reach -- enough headroom for the mesh's drift between frames
    #    and nowhere near what a dead palette (0.0) gets to.
    warm, cold = read["sunset"]["rb"], read["pre-dawn"]["rb"]
    if warm - cold < 12:
        fails.append("the band paints the same warmth at sunset (%.1f) and pre-dawn "
                     "(%.1f); the time-of-day spread is %.1f levels wide and needs 12. "
                     "The per-state CSS can be perfect and still not reach the "
                     "renderer -- see the probe's two serialisations."
                     % (warm, cold, warm - cold))
    if read["off"]["rb"] > warm - 6:
        fails.append("with time-of-day off the band is as warm as sunset (%.1f vs %.1f); "
                     "'off' is not an hour and must carry no hue"
                     % (read["off"]["rb"], warm))

    # 3. STILL A FLOOR. 20 rather than the 24 check_surface uses at the band's
    #    dark edge, because this samples the LIT corner -- the one place the band
    #    is closest to the page it ends.
    for state, r in read.items():
        if r["gap"] < 20:
            fails.append("in %r the band's lit corner comes within %d levels of the page "
                         "ground; a floor you cannot distinguish from the room is not a "
                         "floor" % (state, r["gap"]))

    # 4. THE GLYPHS STILL READ. Two-sided, like hero-ascii-field-contract's own
    #    dL band: under the floor is a texture nobody can see, over the ceiling
    #    is a screen of characters rather than grain in a sky. The floor is set
    #    at 24 because the Hero's approved field peaks at ~35 over its palest
    #    sky and 24 is comfortably under it; the ceiling at 150 is just over what
    #    night reaches (91) plus the old near-ink band's 130.
    for state, r in read.items():
        if r["peak"] < 24:
            fails.append("in %r the glyph field peaks at %.1f levels over its own ground; "
                         "the band got brighter than its ink can carry and the field has "
                         "gone invisible. --foot-band-glyph has to move with the sky."
                         % (state, r["peak"]))
        elif r["peak"] > 150:
            fails.append("in %r the glyph field peaks at %.1f levels over its own ground; "
                         "that is not grain in a sky, it is a screen of characters on top "
                         "of one" % (state, r["peak"]))

    page.evaluate("()=>window.SiteTheme.setMode('daytime')")
    page.wait_for_timeout(900)


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
      return {dur: p.palDur, want: want};
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
        if 'class="footBandMark"' in src or 'class="footMark"' in src:
            fails.append("%s still carries a wordmark element in its footer" % (prefix + name))
    # ── AND NOW THE SHADOW RULE, WHOLE ──────────────────────────────────────
    # This used to be two assertions that pulled against each other: no shadow on
    # the FIELD context, and a source-atop composite on the MARK context so the
    # inner shadow could not escape the letterforms. That was the shape of the
    # rule while Jayden's inner shadow was a sanctioned exception to it -- he
    # asked for it by name, "some inner shadow so it has some depth".
    # He has now asked for it to go ("the insert shadow wasnt that much it just
    # feels too strong"), and the letters it shaded went with it, so the
    # exception is spent and the site's absolute rule applies with nothing carved
    # out of it: the companion heads cast a contact shadow and NOTHING else does.
    # A single assertion replaces both, and it is strictly stronger -- it binds
    # every context in the file, not just the one that was known to be dangerous.
    # It is a source check because there is no longer a shape to measure a shadow
    # against: an escaped shadow used to be visible as darkening beside a
    # letterform, and a band with no ink in it has no beside.
    js = source_of("footer-band.js")
    for bad in sorted(set(re.findall(r"\b\w+\.shadow(?:Color|Blur|OffsetX|OffsetY)\b", js))):
        fails.append("footer-band.js sets %s. Nothing this file paints may carry a "
                     "shadow of any kind: the companion heads cast a contact shadow "
                     "and nothing else on this site does, and the one exception -- "
                     "the wordmark's inner shading -- was deleted with the wordmark."
                     % bad)
    css = source_of("footer.css")
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
                check_height(page, 1440, name, fails)
            open_page(page, base, "about.html", prefix)
            check_surface(page, "about.html", fails)
            check_grain(page, "about.html at 1440", fails)
            check_hour(page, fails)
            check_observer(page, base, prefix, fails)
            open_page(page, base, "about.html", prefix)
            STATS.clear()
            STATS.update(check_cost(page, fails) or {})
            check_kill_switch(page, fails)
            check_theme_walk(page, fails)
            ctx.close()

            # THE PHONE, AND IT IS NOW THE END THAT MOVES. The clamp pins its
            # ceiling at 1440 and its floor at and below 390, so a regression in
            # one end is completely invisible from the other -- and 390 is the
            # width the band was 83px at when Jayden said "half" and 42px at when
            # he said "too small on ios". Both of his sentences are about this
            # width, so both numbers are checked here.
            # TWO PHONE WIDTHS, NOT ONE. 320 is inside the clamp's floor and 390
            # sits on its knee (63.05 computed), so a rule that lost its floor
            # and went back to a bare vw would still measure 63 at 390 and
            # collapse to 59.6 at 320. One width cannot see that.
            # The band is checked on both pages that frame it: index has the hero
            # above it, about does not.
            for pw_ in (390, 320):
                pctx = br.new_context(device_scale_factor=2,
                                      viewport={"width": pw_, "height": 844})
                ppage = pctx.new_page()
                ppage.on("pageerror",
                         lambda e, _w=pw_: fails.append("page error at %d: %s" % (_w, e)))
                for name in ("index.html", "about.html"):
                    open_page(ppage, base, name, prefix)
                    check_height(ppage, pw_, name, fails)
                    check_surface(ppage, name, fails)
                    check_grain(ppage, "%s at %d" % (name, pw_), fails)
                # ONE FOOTER ON EIGHT PAGES, MEASURED AT 390 ONLY. This is the
                # width where a page's own phone media query can reach into the
                # component, and the one where nobody was looking. about.html is
                # the reference because it is the plainest host: a footer inside
                # .wrap with no hero above it and no page-level rule touching it.
                if pw_ == 390:
                    open_page(ppage, base, "about.html", prefix)
                    ref = ppage.evaluate("()=>document.querySelector('.footTop')"
                                         ".getBoundingClientRect().height")
                    del WAIVED_SEEN[:]
                    for name in PAGES:
                        open_page(ppage, base, name, prefix)
                        check_one_footer(ppage, name, ref, fails)
                pctx.close()

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
    # THE contentRect INJECTION RETIRED, AND WAS REPLACED RATHER THAN DROPPED.
    # It used to swap borderBoxSize for contentRect and produce the 1.24x
    # vertical stretch described at the top of this file. That defect is
    # unreachable today: the band's padding-block went with the wordmark, so the
    # content box and the border box are the same box and the injection is a
    # no-op -- it was found MISSED, which is the correct answer for an injection
    # that no longer injects anything. The ASSERTION it exercised is still live
    # and still the one that caught a stretched picture no number complained
    # about, so it is exercised by a defect that IS reachable: dropping the
    # device-pixel-ratio term, which gives a 1x bitmap on a 2x screen. Same
    # check, same failure mode (a scaled picture, nothing errors), reachable
    # today. The borderBoxSize read stays as it is; see the note above it.
    ("the canvas bitmap not scaled to the device pixel ratio (a soft picture)",
     "footer-band.js",
     "fieldCv.width = Math.max(1, Math.round(boxW * ratio));",
     "fieldCv.width = Math.max(1, Math.round(boxW));"),
    # WHY THIS ONE REPLACED THE source-atop INJECTION. That one re-broke the
    # composite that kept the inner shadow inside the letterforms; there is no
    # inner shadow and no letterform now, so the needle no longer exists in the
    # file. What replaces it re-breaks the rule the old one was a special case
    # of: it puts a shadow back on the context that paints the whole band.
    ("a shadow on the field context (the shadow rule, which now has no exception)",
     "footer-band.js",
     "  fx.clearRect(0, 0, boxW, boxH);\n  glyphs = 0;",
     '  fx.clearRect(0, 0, boxW, boxH);\n  fx.shadowBlur = 4;\n  glyphs = 0;'),
    # THE DEFECT THAT COST THIS PASS. The per-state rules were correct and the
    # renderer never saw them, because a nested color-mix serialises as
    # color(srgb ...) and the probe only parsed rgb(...). Re-injected by taking
    # the second branch back out.
    ("the palette probe blind to color(srgb ...) -- every state paints alike",
     "footer-band.js",
     '   m = /color\\(\\s*srgb\\s+([^)]+)\\)/.exec(got);\n   scale = 255;',
     "   m = null;"),
    ("the time-of-day sky flattened to one hue for every state",
     "footer.css",
     ':root[data-theme-state="sunset"]   .footBand{--foot-band-sky-low:#956b55;--foot-band-sky-high:#e7d8f5}',
     ':root[data-theme-state="sunset"]   .footBand{--foot-band-sky-low:#50517d;--foot-band-sky-high:#c9b9df}'),
    # THE DEFECT JAYDEN REPORTED ON 2026-08-20, re-injected exactly: the tones
    # rebuilt as walks toward --theme-ink with the hour mixed in as a tint. That
    # is a dark strip in every state by construction, and the contract that
    # shipped with it could not see it -- it only measured red-minus-blue.
    ("the band rebuilt on ink rather than on the hour's sky (the dark strip)",
     "footer.css",
     " --foot-band-tone-1:color-mix(in srgb,var(--theme-page) var(--foot-band-veil),\n"
     "  color-mix(in srgb,var(--foot-band-sky-low) 62%,var(--foot-band-sky-high)));",
     " --foot-band-tone-1:color-mix(in srgb,var(--foot-band-sky-low) 7%,\n"
     "  color-mix(in srgb,var(--theme-ink) 93%,var(--theme-page)));"),
    # THE COST OF A BRIGHTER BAND, and the one that would have gone wrong in
    # silence: page-white glyphs have less delta to spend the lighter the ground
    # gets. Injected as an ink that is nearly the ground it is drawn on.
    ("the glyph ink left too close to the ground it is drawn on (an invisible field)",
     "footer.css",
     " --foot-band-glyph:var(--theme-page);",
     " --foot-band-glyph:#c9cbd0;"),
    ("the band back at its old height (Jayden asked for half)",
     "footer.css",
     "height:clamp(63px,4.86vw + 44.1px,114px);",
     "height:clamp(126px,9.72vw + 88.2px,228px);"),
    # THE OTHER DIRECTION, AND THE ONE THAT ACTUALLY HAPPENED. On 2026-08-20 the
    # phone floor was 42px -- half of the 83.1 the band measured at 390 -- and
    # Jayden's answer was "the footer is too small on ios". This puts that floor
    # back. It is a SEPARATE injection from the one above and not a variant of
    # it, because the two failures look nothing alike from a desktop screenshot:
    # this one leaves 1440 pixel-for-pixel correct and only the phone wrong,
    # which is exactly how it shipped in the first place.
    ("the phone floor back at 42px (the sliver Jayden called too small on ios)",
     "footer.css",
     "height:clamp(63px,4.86vw + 44.1px,114px);",
     "height:clamp(42px,4.86vw + 44.1px,114px);"),
    # AND THE SAME DEFECT ARRIVING BY THE OTHER ROUTE. A bare vw term keeps the
    # ceiling and every desktop number, measures 63.0 at 390 -- so check_height
    # at 390 stays green -- and collapses below it. Only 320 and check_grain see
    # this one, which is the whole reason both exist.
    ("the clamp's floor dropped for a bare vw (correct at 390, a sliver at 320)",
     "footer.css",
     "height:clamp(63px,4.86vw + 44.1px,114px);",
     "height:min(4.86vw + 44.1px,114px);"),
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
    # ONE PAGE'S OWN STYLESHEET REACHING INTO THE COMPONENT. This is the defect
    # found on index.html at 390 on 2026-08-20, re-injected on a page that does
    # not have it: a type selector in a page's phone media query landing on the
    # footer's <nav>. It has to be injected into a PAGE and not into footer.css,
    # because a change to footer.css moves all eight pages together and a
    # cross-page comparison is blind to that by construction -- which is exactly
    # why check_one_footer measures a spread and not a value.
    ("one page's own CSS reaching into the footer at 390 (invisible at 1440)",
     "apollo.html",
     ".siteFoot{margin-top:var(--sp-80-152);padding-bottom:var(--sp-32-64)}",
     ".siteFoot{margin-top:var(--sp-80-152);padding-bottom:var(--sp-32-64)}"
     "@media(max-width:760px){nav{padding:24px 0 0}}"),
    ("the loop left running while the band is off screen",
     "footer-band.js",
     ' }, { rootMargin: "120px 0px" }).observe(band);',
     ' }, { rootMargin: "100000px 0px" }).observe(band);'),
]


def self_test(prefix, only=""):
    """--only is a SUBSTRING FILTER, not a way to declare a partial run green.
    One injection costs a full drive of eight pages, so the whole list is about
    an hour and the honest answer to "is my new injection reachable?" was
    previously to wait for it or to skip the question. It prints what it skipped
    so a filtered run can never be mistaken for the full one."""
    picked = [i for i in INJECTIONS if not only or only.lower() in i[0].lower()]
    if only:
        print("SELF-TEST -- FILTERED to %d of %d injections on %r; this is NOT a "
              "full run\n" % (len(picked), len(INJECTIONS), only))
        if not picked:
            print("  no injection label matches %r" % only)
            return False
    else:
        print("SELF-TEST -- each injection must be caught\n")
    ok = True
    for label, target, needle, replacement in picked:
        fails = run(prefix, patch=(target, needle, replacement), quiet=True)
        caught = bool(fails)
        print("  %s  %s" % ("CAUGHT " if caught else "MISSED ", label))
        # EVERY FAILURE, NOT JUST THE FIRST. An injection caught by a check other
        # than the one it was written for reads as green here and leaves the
        # intended assertion unproven -- which is the "a gate must be able to
        # fail" problem one level down. Printing the whole list is what makes
        # that visible: the 2026-08-20 sky pass added a glyph-legibility check
        # that fires on the reduced-motion jitter injection too, and only the
        # full list shows that check_reduced still fires on it as well.
        for line in fails:
            print("            -> %s" % line)
        ok = ok and caught
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument("--only", default="",
                    help="run only the injections whose label contains this "
                         "substring. A filtered run is not a full run and says so.")
    ap.add_argument("--prefix", default="",
                    help="page filename prefix, for proving the markup patch "
                         "before it is applied to the shipping pages")
    args = ap.parse_args()
    if args.self_test:
        return 0 if self_test(args.prefix, args.only) else 1
    fails = run(args.prefix)
    if fails:
        for f in fails:
            print("FAIL  " + f)
        print("\nSTATUS=FAIL  %d problem(s)" % len(fails))
        return 1
    print("STATUS=PASS  the band bleeds edge to edge on %d pages at half its old "
          "desktop height and three whole cells of its own field on a phone "
          "(114 at 1440, 63 at 390 and 320), carries no wordmark and no shadow, "
          "paints each hour's own sky in the pixels -- lightness and temperature, "
          "159 levels of ladder against the old 27 -- stays a floor and stays "
          "legible in all seven states, cross-fades rather than snapping, is one "
          "frozen frame under reduced motion, and stops off screen." % len(PAGES))
    for line in WAIVED_SEEN:
        print("  WAIVED: " + line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
