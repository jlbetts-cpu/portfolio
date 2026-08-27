#!/usr/bin/env python3
"""Fails when the Hero's weather stops being free, repeats itself, or paints on the page.

WHY THIS FILE EXISTS
It replaced tools/hero-ascii-field-contract.py, which guarded a 600-line canvas
renderer redrawn at 30fps. The weather is characters again -- Jayden, 2026-08-27:
"the clouds ... should be ascii ... and also the cloud patterns need to always
look differnt not the same" -- but it is NOT that renderer coming back. Each
band is two canvases half a period out of phase, each drawn ONCE when it wraps
off the right-hand edge, translated by a CSS animation for the rest of its life.
Every property that makes that true is a one-token edit away from being false:

  1. IT COSTS NOTHING PER FRAME, AND THAT IS THE WHOLE ARGUMENT FOR IT. The
     thing it replaced drew at 30fps and cost half a style recalculation per
     frame and 24ms of script per second at 1440. A transform on a promoted
     layer costs neither. Anything that puts a var() the head invalidates into
     a background, or animates a filter, or reaches for feTurbulence, puts the
     cost straight back -- and an animated SVG filter is the specific failure
     this page has already had once, re-rasterising on the CPU every frame.
  2. IT NEVER PAINTS ON FLAT PAGE COLOUR. Five of the six skies stop short of
     the Hero's top edge -- daytime stops lowest, at 32% -- and a texture above
     that edge reads as dirt on the page rather than as weather in the sky. The
     mask is a static shape and the hour is carried by opacity, because a mask
     that changed per state would re-rasterise three layers six times a day.
  3. IT NEVER SHOWS THE SAME WEATHER TWICE, and that requirement replaced the
     one that used to stand here. The gradient clouds this grew out of were
     SEAMLESS BY CONSTRUCTION -- a tile two Hero-widths wide translated by
     exactly one tile -- which solves seams and gives no variety at all: the
     same two clouds came back every 149 seconds. The field is generated
     against a coordinate that only advances, so there is no tile to come back
     around, and the failure mode this guards is somebody reintroducing one.
     It is proved twice, on the pixels and on the characters, because either
     alone can pass on a lie: the pixel test cannot afford enough frames to
     cover hours, and the character probe is a pure function that could drift
     out of step with what is drawn.
  4. IT IS STILL THERE UNDER REDUCED MOTION. A full-width surface in slow
     lateral motion is what section 14 of the Apple reference names; the
     picture is not. "Turn it off" and "hold it" are the same size of diff and
     only one of them is right.
  5. IT IS VISIBLE, AND AT NIGHT IT IS NEARLY NOT. Both ends fail here: a sky
     with no weather in it, and a pale smear over the one sky that has stars.
  6. THE HEADLINE STAYS LEGIBLE OVER IT, measured on rendered pixels rather
     than on the tokens the type is authored with, because what is behind the
     type is a picture and .heroCopy blends against it.

    python3 tools/hero-cloud-field-contract.py
    python3 tools/hero-cloud-field-contract.py --self-test

--self-test serves a MUTATED hero-time.css that re-injects each defect in turn
and requires the matching assertion to reject it. An injection that cannot fail
is worse than none.
"""

import io
import math
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
VIEWPORTS = ((1440, 900), (390, 844))
LIT_STATES = ("pre-dawn", "sunrise", "daytime", "dusk", "sunset")
ALL_STATES = LIT_STATES + ("night", "off")

# ── THE TWO-SIDED BANDS ──────────────────────────────────────────────────────
# Measured on 2026-08-27, device scale 1, headless Chromium, with the portrait,
# the selection frame and the bar hidden and every animation frozen so the two
# frames of the diff are the same instant of the sky.
#
#   state      peak cloud delta (sum of the three channels, out of 765)
#              1440x900   390x844
#   pre-dawn      55         58
#   sunrise       78         83
#   daytime       62         63
#   dusk          59         68
#   sunset        57         59
#   night         17         19
#   off            0          0
#
# THE PORTRAIT IS OUT OF THE FRAME FOR THESE and it took a wrong reading to
# notice: hiding .heroCharacterPeek with visibility:hidden does not hide it,
# something inside takes visibility back, and the head moves about 20px between
# two screenshots taken 120ms apart. Read that way every state came back 60-80
# points higher and night looked like a lit sky. display:none is what this file
# uses now, and these numbers are the weather alone.
#
# A LIT SKY MUST CARRY AT LEAST 40, which is under three quarters of the lowest
# measured and is the level at which the mark stops being findable at all --
# the failure the glyph field spent two passes on ("make sure it's more
# visible"). NIGHT MUST STAY UNDER 30 and it is the other end of the same rule:
# cloud at night is the absence of stars, not a white shape over them. The two
# bands do not overlap, so no single strength can satisfy both and the per-state
# table has to keep meaning something.
LIT_FLOOR = 40
NIGHT_CEILING = 30

# WHAT "NEVER OVER FLAT PAGE COLOUR" IS WORTH AS A NUMBER. The sky's boundary is
# an ELLIPSE and the mask is a horizontal band, so at the far left and right of
# the Hero the mask is open over sky that has already faded out -- 692 sampled
# pixels of it at 1440 daytime. It does not matter, and the reason is that the
# cloud's ink and the page's ground are the same near-white: the worst change
# any of those pixels took was 7 out of 765, which is two levels on one channel
# and below the 6/765 threshold this same file uses to decide a sky is painted
# at all. Against a peak of 119 in the sky itself, the weather is 17x fainter at
# the sky's edge than at its middle -- it fades out because it is made of the
# same colour the sky fades to, which is a better answer than a mask that has to
# know the ellipse. 12 is that 7 with room for antialiasing, and it still fails
# on any real mark: a cloud at half strength over the page white is 30+.
FLAT_PAGE_DELTA = 12

# The headline is measured on rendered pixels because .heroCopy carries
# mix-blend-mode:difference and what it inverts is the picture behind it.
# Measured with the clouds in: 16.2..21.0:1 across the seven states at both
# viewports, against 17.0..20.6:1 recorded before they existed. The floor is
# well under the worst of those and well over WCAG's 4.5:1, because what it is
# guarding is a REGRESSION -- somebody raising --cloud-strength until the type
# starts to swim -- and not the standard.
CONTRAST_FLOOR = 12.0


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


FREEZE = """() => {
  const s = document.createElement('style'); s.id = 'contractFreeze';
  s.textContent =
    /* display, NOT visibility. visibility:hidden on .heroCharacterPeek does not
       hide the portrait -- something inside it takes visibility back -- and the
       head is the one thing in this Hero that moves 20px between two
       screenshots taken 120ms apart. Measured: with visibility, a sky whose
       clouds were switched off entirely still reported a 123-level "cloud" at
       66% of the clip, which is exactly where the portrait is. Both nodes are
       position:absolute, so display:none costs the measurement no layout. */
    '.heroCharacterPeek,.heroHeadSelection{display:none!important}' +
    '.jbStick{visibility:hidden!important}' +
    '.heroTimeDrift,.heroNightStars,.heroNightStars i,.heroCloudTile{' +
    'animation:none!important;transition:none!important}';
  document.head.appendChild(s);
}"""
CLOUDS_OFF = """() => {const s = document.createElement('style'); s.id = 'cloudsOff';
  s.textContent = '.heroClouds{opacity:0!important}'; document.head.appendChild(s);}"""
CLOUDS_ON = """() => {const n = document.getElementById('cloudsOff'); if (n) n.remove();}"""


def channel_sum(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def luminance(c):
    def part(v):
        v /= 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * part(c[0]) + 0.7152 * part(c[1]) + 0.0722 * part(c[2])


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    if la < lb:
        la, lb = lb, la
    return (la + 0.05) / (lb + 0.05)


def shot(page, box):
    return Image.open(io.BytesIO(page.screenshot(clip=box))).convert("RGB")


def sky_top(image):
    """The highest row of a sky that still differs from the flat page colour.

    The page colour is read from the clip's own top-left corner, which is the
    one place every one of the six gradients has already resolved to it -- or,
    at night, is the top of night's own linear gradient, which is why night's
    answer is about its own sky and not about the page.
    """
    px = image.load()
    w, h = image.size
    page = px[2, 2]
    for y in range(h):
        for x in range(0, w, 3):
            if channel_sum(px[x, y], page) > 6:
                return y, page
    return h, page


def cloud_reading(page, clip):
    """Everything the clouds change, against the same frame with them switched off."""
    with_clouds = shot(page, clip)
    page.evaluate(CLOUDS_OFF)
    page.wait_for_timeout(120)
    without = shot(page, clip)
    page.evaluate(CLOUDS_ON)
    page.wait_for_timeout(60)
    top, page_colour = sky_top(without)
    a, b = with_clouds.load(), without.load()
    w, h = with_clouds.size
    highest = None
    peak = 0
    worst_on_flat = 0
    for y in range(h):
        for x in range(0, w, 3):
            delta = channel_sum(a[x, y], b[x, y])
            if delta <= 3:
                continue
            if highest is None:
                highest = y
            peak = max(peak, delta)
            if channel_sum(b[x, y], page_colour) <= 6:
                worst_on_flat = max(worst_on_flat, delta)
    return {"skyTop": top, "cloudTop": highest, "peak": peak,
            "worstOnFlat": worst_on_flat, "height": h}


def headline_contrast(page):
    box = page.locator(".heroCopy h1").bounding_box()
    image = shot(page, box)
    px = image.load()
    w, h = image.size
    ranked = sorted((luminance(px[x, y]), px[x, y]) for y in range(h) for x in range(w))
    ink = ranked[int(len(ranked) * 0.02)][1]
    ground = ranked[int(len(ranked) * 0.98)][1]
    return contrast(ink, ground)


def state_page(browser, base_url, width, height, state, reduced=False):
    context = browser.new_context(
        viewport={"width": width, "height": height},
        reduced_motion="reduce" if reduced else "no-preference")
    context.add_init_script(
        "try{sessionStorage.setItem('jbHeroTimeMode',%r)}catch(e){}" % state)
    page = context.new_page()
    page.goto(base_url + "/index.html", wait_until="load")
    page.wait_for_timeout(2200)
    return context, page


# ── 1. THE FIELD IS MARKUP AND A STYLESHEET, NOT A RENDERER ─────────────────
def static_contract(failures):
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "hero-time.css").read_text(encoding="utf-8")

    if "heroTimeAscii" in html or "HeroAsciiField" in html.replace(
            "the HeroAsciiField", ""):
        failures.append("the 30fps canvas glyph field is back in index.html")
    if 'class="heroClouds"' not in html:
        failures.append("index.html has no .heroClouds layer")
    for band in ("far", "mid", "near"):
        if f"heroCloud--{band}" not in html or f".heroCloud--{band}{{" not in css:
            failures.append(f"the {band} cloud band is missing")
    # TWO TILES PER BAND, AND NOT ONE. One tile cannot cover the window while it
    # is crossing an edge, so a band reduced to one is a sky that blinks empty
    # once a period -- and it is the shape a "simplification" would take.
    tiles = html.count('class="heroCloudTile"')
    if tiles != 6:
        failures.append(f"expected six cloud tiles (two per band), found {tiles}")
    # NO BLUR ON A FIELD OF CHARACTERS. The brief asked for blur and the answer
    # is the far band's wider cell pitch, lighter ramp cap and thinner ink --
    # not a filter, which is a per-frame convolution over the largest surface on
    # the page and sands the characters back into the smear this replaced.
    for rule in re.findall(r"\.heroCloudTile?[^{}]*\{([^}]*)\}", css):
        if "blur" in rule or "filter" in rule:
            failures.append("a cloud tile declares a filter: " + rule.strip()[:80])

    # NO FILTER ON THE WEATHER. feTurbulence and an animated `filter` are the
    # two ways to make weather that re-rasterises on the CPU every frame, which
    # is the cost this whole treatment exists to avoid.
    # SCOPED TO THE CLOUD RULES AND NOT TO THE FILE, and that scope is a
    # correction: a bare `"feTurbulence" in html` fails on this page today for
    # a reason that has nothing to do with the sky. index.html:2387 declares
    # #inkBig / #inkSm / #inkEye -- the STATIC displacement filters that give
    # the headline and the irises their ink texture -- and .iris::before
    # carries a data-URI fractalNoise tile. None of those is animated and none
    # of them is in this sky. Asserting on the file would have been the classic
    # gate that fails on working code and gets relaxed the first time it does.
    for rule in re.findall(r"\.heroClouds?[^{}]*\{([^}]*)\}", css):
        if "filter" in rule:
            failures.append("a cloud rule declares a filter: " + rule.strip()[:80])
        if "feTurbulence" in rule:
            failures.append("feTurbulence is in the weather -- it rasterises per frame")
    keyframes = re.search(r"@keyframes heroCloudDrift\{([^}]*\}[^}]*)\}", css)
    if not keyframes:
        failures.append("@keyframes heroCloudDrift is gone")
    else:
        body = keyframes.group(1)
        declared = set(re.findall(r"([a-z-]+)\s*:", body))
        if declared != {"transform"}:
            failures.append(
                "the drift animates more than transform, so it is not free: "
                f"{sorted(declared)}")

    # THE THREE PERIODS MUST BE DISTINCT AND SHARE NO FACTOR. The sky returns to
    # an arrangement it has held before only when all three coincide; equal or
    # commensurate periods bring that back inside a minute.
    periods = [int(v) for v in re.findall(r"--cloud-period:(\d+)s", css)]
    if len(periods) != 3:
        failures.append(f"expected three cloud periods, found {periods}")
    else:
        if len(set(periods)) != 3:
            failures.append(f"two cloud bands share a period: {periods}")
        for i in range(3):
            for j in range(i + 1, 3):
                if math.gcd(periods[i], periods[j]) != 1:
                    failures.append(
                        "cloud periods %d and %d share a factor, so the sky "
                        "repeats every %ds" % (periods[i], periods[j],
                                               periods[i] * periods[j]
                                               // math.gcd(periods[i], periods[j])))
    return periods


# ── 2. IT NEVER SHOWS THE SAME WEATHER TWICE ────────────────────────────────
# THE PIXELS AND THE CHARACTERS, because neither alone is a proof.
# window.__heroClouds.seek(t) puts every animation and every tile where they
# would be t seconds after load, so a screenshot at t is the sky at t -- and
# twelve of them, spread over forty minutes of drift, is as far as screenshots
# can reach. sample(band, chunk) is the pure generator behind the same draw, so
# it can sweep hundreds of chunks in a second; on its own it would only prove
# that a function nobody has tied to the page returns different strings.
# TIED TOGETHER: the frames that must differ on screen are the same instants the
# strings are read for, so a generator that had drifted out of step with the
# canvas would show up as identical pixels under different text.
FIELD_SETUP = """() => {const s = document.createElement('style'); s.id='fieldOnly';
  s.textContent =
   '.heroClouds{opacity:1!important;mask-image:none!important;-webkit-mask-image:none!important}' +
   '.heroCharacterPeek,.heroHeadSelection,.jbStick,.heroCopy,.heroTimeDrift,.heroNightStars{display:none!important}' +
   '.heroTimeClip{background:#2a4a7a!important}';
  document.head.appendChild(s);}"""

# HOW DIFFERENT TWO SCREENFULS OF WEATHER HAVE TO BE. Measured on the shipped
# field at 1440x900: the worst channel difference between any two of the twelve
# frames below is 113 levels and the mean absolute difference over the whole
# clip is 0.06 out of 255 -- small because the weather is sparse and faint by
# design and most of the clip is untouched sky. A repeating tile scores exactly
# 0 on both. 12 and 0.005 are an order of magnitude under the live field and an
# order over rounding, which is the only band that means anything here.
FRAME_PEAK_FLOOR = 12
FRAME_MEAN_FLOOR = 0.005
# HOW MUCH OF A CHUNK MAY MATCH THE ONE BEFORE IT. Two independent screenfuls of
# a mostly-clear sky share their blanks, so the floor is not zero -- measured
# across 400 consecutive chunks per band the worst neighbouring pair agrees on
# 0.97 of its cells, while a repeat scores exactly 1.000.
CHUNK_MATCH_CEILING = 0.995
# AND HOW OFTEN THE SKY MAY BE EMPTY. This is a DESIGN assertion wearing a
# uniqueness test's clothes, and it is here because that is how it was found:
# two chunks that are both entirely blank are byte-identical, so a "the field
# never repeats" sweep fails on an empty sky. Measured over 400 chunks per band
# with the feature size fixed at 150px, 5.6% of PHONE screenfuls carried no
# weather at all against 0.9% of desktop ones, and eight pairs of consecutive
# phone screenfuls were the same because both were blank. The generator scales
# its feature size with the viewport now; 6% is a ceiling the shipped field
# clears at 0.1% and 1.5%, and it fails on any change that makes the sky empty
# on a phone -- which is a real defect and not a measurement artefact.
BLANK_CHUNK_CEILING = 0.06


def frame_at(page, clip, seconds):
    page.evaluate("t => window.__heroClouds.seek(t)", seconds)
    page.wait_for_timeout(90)
    return shot(page, clip)


def frame_distance(a, b):
    diff = ImageChops.difference(a, b)
    peak = max(diff.getextrema(), key=lambda pair: pair[1])[1]
    data = diff.getdata()
    mean = sum(sum(px) for px in data) / (len(data) * 3.0)
    return peak, mean


def assert_never_repeats(page, failures, label, verbose=True):
    """Twelve frames minutes apart, and four hundred chunks per band."""
    if not page.evaluate("() => !!window.__heroClouds"):
        failures.append(f"{label} there is no cloud field on the page at all")
        return None
    page.evaluate(FIELD_SETUP)
    page.wait_for_timeout(180)
    clip = page.locator("#heroTimeClip").bounding_box()

    # 0, 200, 400 .. 2200 seconds: nearly forty minutes of drift, and past the
    # point every band has wrapped several times.
    # THE TEXT IS READ IN THE SAME PASS AS THE FRAME, and that is not a style
    # note: reading the strings in a second loop afterwards returns the state
    # the page ended in, twelve times over, and the assertion below then fails
    # on a field that is working perfectly. It did, once.
    times = [i * 200 for i in range(12)]
    frames, texts = [], []
    for t in times:
        frames.append((t, frame_at(page, clip, t)))
        texts.append((t, page.evaluate(
            "() => window.__heroClouds.rendered().map(r => r.text).join('|')")))
    page.evaluate("() => {const n=document.getElementById('fieldOnly'); if(n) n.remove();}")

    worst_peak, worst_mean, worst_pair = 10 ** 6, 10 ** 6, None
    for i in range(len(frames)):
        for j in range(i + 1, len(frames)):
            peak, mean = frame_distance(frames[i][1], frames[j][1])
            if peak < worst_peak:
                worst_peak, worst_pair = peak, (frames[i][0], frames[j][0])
            worst_mean = min(worst_mean, mean)
    if worst_peak < FRAME_PEAK_FLOOR or worst_mean < FRAME_MEAN_FLOOR:
        failures.append(
            f"{label} the sky repeats: the closest of 12 frames spread over "
            f"{times[-1]}s differ by only {worst_peak} levels at their peak and "
            f"{worst_mean:.2f} on average (floors {FRAME_PEAK_FLOOR} and "
            f"{FRAME_MEAN_FLOOR}), at t={worst_pair}")
    if len(set(t for _, t in texts)) != len(texts):
        failures.append(f"{label} two of the twelve rendered fields are the "
                        "same characters, so the generator is looping")

    # THE SWEEP. 400 chunks is 10.6 hours of the near band's drift at 1440 and
    # the pure generator can do it in about a second. Blank chunks are counted
    # rather than compared: an empty sky is identical to another empty sky and
    # that is arithmetic, not a loop, so the uniqueness claim is made about the
    # chunks that carry weather and the empty ones are held to a ceiling of
    # their own.
    sweep = page.evaluate("""() => {
      const out = [];
      const bands = window.__heroClouds.bands().length;
      for (let b = 0; b < bands; b++) {
        const seen = new Map();
        let blank = 0, dup = null, worst = 0, worstPair = null, adjacent = null;
        let prev = null;
        for (let k = 0; k < 400; k++) {
          const t = window.__heroClouds.sample(b, k);
          const empty = !/\S/.test(t);
          if (empty) blank++;
          else {
            if (seen.has(t)) dup = [seen.get(t), k];
            seen.set(t, k);
          }
          if (prev !== null && prev === t && adjacent === null) adjacent = [k - 1, k];
          if (prev !== null && !empty) {
            let same = 0;
            for (let i = 0; i < t.length; i++) if (t[i] === prev[i]) same++;
            const ratio = same / t.length;
            if (ratio > worst) { worst = ratio; worstPair = [k - 1, k]; }
          }
          prev = t;
        }
        out.push({band: b, inked: seen.size, blank: blank / 400, dup, worst,
                  worstPair, adjacent});
      }
      return out;}""")
    for row in sweep:
        if row["dup"]:
            failures.append(
                f"{label} band {row['band']} draws the same weather twice: "
                f"chunks {row['dup']} are identical")
        if row["adjacent"]:
            failures.append(
                f"{label} band {row['band']} shows the same screenful twice "
                f"running, at chunks {row['adjacent']}")
        if row["blank"] > BLANK_CHUNK_CEILING:
            failures.append(
                f"{label} band {row['band']} has no weather at all in "
                f"{row['blank']:.1%} of screenfuls (ceiling "
                f"{BLANK_CHUNK_CEILING:.0%})")
        if row["worst"] > CHUNK_MATCH_CEILING:
            failures.append(
                f"{label} band {row['band']} chunks {row['worstPair']} agree on "
                f"{row['worst']:.3f} of their cells (ceiling {CHUNK_MATCH_CEILING})")
    if verbose:
        print(f"  {label} never repeats: closest of 12 frames over {times[-1]}s "
              f"peak {worst_peak}, mean {worst_mean:.3f}; per band "
              + ", ".join("%d inked chunks, %.1f%% blank, worst neighbour %.3f"
                          % (r["inked"], 100 * r["blank"], r["worst"])
                          for r in sweep))
    return worst_peak, worst_mean


# ── 3. THE PER-FRAME COST ───────────────────────────────────────────────────
FRAME_COUNTER = """() => {window.__cc = 0;
  const tick = () => {window.__cc++; requestAnimationFrame(tick);};
  requestAnimationFrame(tick);}"""


def assert_per_frame(context, page, failures, label):
    """One layout and one style recalculation per frame, and no script for the sky.

    THE RATIO, NOT THE RATE, because the rate reads the machine. Measured on
    2026-08-27 at 1440x900, medians of three interleaved 8s windows:
        glyph field   1.00 layout   1.50 recalc   24.2 ms/s script
        clouds        1.00 layout   1.00 recalc    5.7 ms/s script
        neither       1.00 layout   1.01 recalc    4.7 ms/s script
    The clouds are inside a millisecond of NOTHING BEING THERE, which is what a
    transform on a promoted layer is supposed to cost. 1.15 is the ceiling: the
    field's own 1.50 fails it, and so does anything that draws every other frame.
    """
    cdp = context.new_cdp_session(page)
    cdp.send("Performance.enable")
    page.evaluate(FRAME_COUNTER)

    def read():
        return {m["name"]: m["value"] for m in cdp.send("Performance.getMetrics")["metrics"]}

    before = read()
    page.wait_for_timeout(6000)
    after = read()
    frames = max(1, page.evaluate("() => window.__cc"))
    recalcs = (after["RecalcStyleCount"] - before["RecalcStyleCount"]) / frames
    layouts = (after["LayoutCount"] - before["LayoutCount"]) / frames
    if recalcs > 1.15:
        failures.append(f"{label} {recalcs:.2f} style recalculations per frame "
                        "-- something in the sky is drawing, not compositing")
    if layouts > 1.15:
        failures.append(f"{label} {layouts:.2f} layouts per frame")
    return recalcs, layouts


def browser_contract(base_url, failures, verbose=True):
    periods = static_contract(failures)
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            for width, height in VIEWPORTS:
                peaks = {}
                for state in ALL_STATES:
                    context, page = state_page(browser, base_url, width, height, state)
                    page.evaluate(FREEZE)
                    page.wait_for_timeout(150)
                    clip = page.locator("#heroTimeClip").bounding_box()
                    ratio = headline_contrast(page)
                    reading = cloud_reading(page, clip)
                    peaks[state] = reading["peak"]
                    label = f"{width}x{height} {state}"
                    if verbose:
                        top = reading["cloudTop"]
                        share = "none" if top is None else f"{100*top/reading['height']:.1f}%"
                        print(f"  {label:20s} h1 {ratio:5.1f}:1   sky from "
                              f"{100*reading['skyTop']/reading['height']:5.1f}%   "
                              f"weather from {share:>6s}   peak {reading['peak']:3d}   "
                              f"worst over flat page {reading['worstOnFlat']}")
                    if ratio < CONTRAST_FLOOR:
                        failures.append(f"{label} the headline reads {ratio:.1f}:1 "
                                        f"over its own sky (floor {CONTRAST_FLOOR})")
                    if reading["worstOnFlat"] > FLAT_PAGE_DELTA:
                        failures.append(
                            f"{label} the weather paints {reading['worstOnFlat']} "
                            "levels onto flat page colour "
                            f"(ceiling {FLAT_PAGE_DELTA})")
                    if state == "off":
                        if reading["cloudTop"] is not None:
                            failures.append(f"{label} there is weather in a sky "
                                            "that has been switched off")
                    elif reading["cloudTop"] is None:
                        failures.append(f"{label} no weather at all")
                    elif reading["cloudTop"] < reading["skyTop"]:
                        failures.append(
                            f"{label} the weather starts at row "
                            f"{reading['cloudTop']} and the sky only starts at "
                            f"{reading['skyTop']} -- it is painting on the page")
                    context.close()

                for state in LIT_STATES:
                    if peaks[state] < LIT_FLOOR:
                        failures.append(f"{width}x{height} {state} the weather peaks "
                                        f"at {peaks[state]} and cannot be seen "
                                        f"(floor {LIT_FLOOR})")
                if peaks["night"] > NIGHT_CEILING:
                    failures.append(f"{width}x{height} night the weather peaks at "
                                    f"{peaks['night']} over the starfield "
                                    f"(ceiling {NIGHT_CEILING})")

                context, page = state_page(browser, base_url, width, height, "daytime")
                assert_never_repeats(page, failures, f"{width}x{height}", verbose)
                if verbose:
                    print(f"  {width}x{height} periods {periods}")
                context.close()

                context, page = state_page(browser, base_url, width, height, "daytime")
                recalcs, layouts = assert_per_frame(context, page, failures,
                                                    f"{width}x{height}")
                if verbose:
                    print(f"  {width}x{height} idle: {layouts:.2f} layouts and "
                          f"{recalcs:.2f} style recalculations per frame")
                context.close()

                # ── STILL, NOT ABSENT, UNDER REDUCED MOTION ─────────────────
                context, page = state_page(browser, base_url, width, height,
                                           "daytime", reduced=True)
                page.evaluate(FREEZE)
                page.wait_for_timeout(150)
                clip = page.locator("#heroTimeClip").bounding_box()
                reading = cloud_reading(page, clip)
                running = page.evaluate(
                    "() => [...document.querySelectorAll('.heroCloudTile')]"
                    ".some(n => getComputedStyle(n).animationName !== 'none')")
                if reading["cloudTop"] is None:
                    failures.append(f"{width}x{height} reduced motion took the "
                                    "picture away instead of holding it")
                if running:
                    failures.append(f"{width}x{height} the sky still drifts under "
                                    "reduced motion")
                if verbose:
                    print(f"  {width}x{height} reduced motion: peak "
                          f"{reading['peak']}, drifting {running}")
                context.close()
        finally:
            browser.close()


# ── THE RE-INJECTIONS ────────────────────────────────────────────────────────
# Each one is a single token, and each one is the token somebody would actually
# move. If any of them survives, the assertion it is aimed at is decoration.
INJECTIONS = (
    # ── WHY THIS ONE MOVES TWO TOKENS AND NOT ONE ──────────────────────────
    # Taking the mask off alone changes nothing this file can see, and that is
    # the mask doing its job rather than the mask being pointless: the three
    # bands are POSITIONED at 40%, 48% and 58%, all of them already below the
    # tightest sky's own edge, so with them where they are the mask is a soft
    # entry and exit and not a fence. Lifting a band alone changes nothing
    # either, because the mask is holding it. It takes BOTH to put weather on
    # the page, and a re-injection that only removes the belt while the braces
    # are on proves nothing. So this moves the band AND the mask, and either
    # half restored makes the page clean again -- which is the statement that
    # both are load-bearing.
    ("hero-time.css", "a band lifted out of the sky with the mask taken off",
     "-webkit-mask-image:var(--cloud-mask);mask-image:var(--cloud-mask);",
     "-webkit-mask-image:none;mask-image:none;",
     ("painting on the page", "onto flat page colour")),
    # ── AND THIS ONE IS THE WHOLE POINT OF THE REWRITE ─────────────────────
    # x0 is the tile's place in a world coordinate that only advances. Drop it
    # and every tile draws chunk 0 forever: the field becomes exactly the
    # repeating tile the gradient clouds were, which is the thing Jayden asked
    # to be rid of and the thing a later "simplification" would reach for.
    # It is one token, in the one line that makes the sky weather rather than
    # wallpaper.
    ("index.html", "a field that stops advancing, so the tile comes back round",
     "var nx=(x0+j*pitch)/featW;",
     "var nx=(0*x0+j*pitch)/featW;",
     ("the sky repeats", "draws the same weather twice")),
    ("hero-time.css", "the weather turned down to nothing",
     '.hero[data-time-state="daytime"]{--cloud-strength:',
     '.hero[data-time-state="daytime"]{--cloud-strength:0;--dead:',
     ("no weather at all", "cannot be seen")),
)


def self_test(base_url_factory):
    """Re-inject each defect into the file that actually carries it.

    Two of the three live in hero-time.css and one lives in index.html -- the
    generator's world coordinate -- so the route is chosen per injection rather
    than hard-wired to the stylesheet. An injection served to the wrong file is
    a self-test that cannot fail, which is worse than none.
    """
    types = {"hero-time.css": "text/css", "index.html": "text/html"}
    for target, name, site, inject, wanted in INJECTIONS:
        source = (ROOT / target).read_text(encoding="utf-8")
        if site not in source:
            raise SystemExit(
                f"--self-test cannot find the site for '{name}' in {target}; "
                "update INJECTIONS to match it rather than letting the self-test "
                "pass blind.")
        broken = source.replace(site, inject, 1)
        if "lifted out of the sky" in name:
            broken = broken.replace(" top:40%;height:24%;", " top:8%;height:24%;", 1)
        failures = []
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            try:
                base_url = base_url_factory()
                for width, height in ((1440, 900),):
                    context = browser.new_context(viewport={"width": width,
                                                            "height": height})
                    context.add_init_script(
                        "try{sessionStorage.setItem('jbHeroTimeMode','daytime')}catch(e){}")
                    context.route(
                        "**/" + target + "*",
                        lambda route, req=None, body=broken, kind=types[target]:
                        route.fulfill(status=200, content_type=kind, body=body))
                    page = context.new_page()
                    page.goto(base_url + "/index.html", wait_until="load")
                    page.wait_for_timeout(2200)
                    if "the sky repeats" in wanted:
                        assert_never_repeats(page, failures, f"{width}x{height}",
                                             verbose=False)
                    else:
                        page.evaluate(FREEZE)
                        page.wait_for_timeout(150)
                        clip = page.locator("#heroTimeClip").bounding_box()
                        reading = cloud_reading(page, clip)
                        if reading["cloudTop"] is None:
                            failures.append("no weather at all")
                        else:
                            if reading["cloudTop"] < reading["skyTop"]:
                                failures.append("it is painting on the page")
                            if reading["worstOnFlat"] > FLAT_PAGE_DELTA:
                                failures.append("onto flat page colour")
                            if reading["peak"] < LIT_FLOOR:
                                failures.append("cannot be seen")
                    context.close()
            finally:
                browser.close()
        caught = [f for f in failures if any(w in f for w in wanted)]
        if not caught:
            raise SystemExit(
                f"--self-test FAILED: with {name} the contract still passed. "
                f"Recorded: {failures!r}")
        print(f"self-test: the contract rejected {name}, as it must")
    print("Hero cloud field self-test: OK (the detectors fail when they should)")


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    base_url = f"http://127.0.0.1:{server.server_port}"
    try:
        if "--self-test" in sys.argv:
            self_test(lambda: base_url)
            return
        failures = []
        browser_contract(base_url, failures)
        if failures:
            print("\n".join("FAIL " + f for f in failures))
            raise SystemExit(1)
        print("Hero cloud field: OK")
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
