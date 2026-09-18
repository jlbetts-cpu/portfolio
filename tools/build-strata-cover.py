#!/usr/bin/env python3
"""Rebuild the Strata cover as six time states, UI pixels preserved.

WHY THIS FILE EXISTS.  The twelve Strata plates that shipped until today were
built on 2026-08-20 by a script that lived inside the output folder
(`images/cs/variants/time/strata/sources/build_strata_variants.py`) and was
deleted with the rest of that folder.  The app has since changed completely --
it is an iOS app on TestFlight now, not the four-screen habit builder those
plates show -- so the screens had to be replaced, and there was nothing left in
the tree to replace them with.  This is that builder, restored, with the new
screens and the reasoning that was scattered across a production report folded
into it.  It lives in tools/ so the next person does not have to dig it out of
git twice.

THE CONSTRUCTION IS UNCHANGED AND IT IS THE WHOLE POINT.  Every cover on this
site is a photograph with the product standing on top of it, and only the
PHOTOGRAPH takes the hour: the product pixels are byte-identical in all six
states.  That preservation is why these plates read as one picture at six times
of day instead of six filters.  The invariant is asserted at the bottom of this
file, on the opaque pixels of the product layer, exactly as the 2026-08-20 build
asserted it.

THE PHOTOGRAPH IS THE SAME PHOTOGRAPH.  Strata's is a sloping sheep pasture with
layered hedgerows and a low hazy horizon, and it is a DELIBERATE, per-project
choice -- an audit once called the covers "the same stock meadow" and was wrong
and was pushed back on.  Six phone-free plates of that pasture exist, one per
state, generated for the 2026-08-20 build and committed at `a8a3cb7` under
`images/cs/variants/time/strata/sources/`.  They were removed from the tree in a
later page-weight pass but they are still reachable as git objects, so this file
restores them to a cache under /tmp rather than putting 14 MB of PNG back into
the repo.  Re-running offline reuses the cache.  Nothing here regenerates,
repaints or re-grades the pasture: the six plates are used exactly as they were.

GEOMETRY.  The 2026-08-20 build fitted each plate to a 2400x1784 canvas and
placed a 1800x948 mockup at (300, 420); a later pass (`d76f055`) re-cut every
cover on the site to 2:1, because 2:1 is the box they are painted into at every
viewport and a third of each file was being discarded by object-fit at paint
time.  Both steps are reproduced here in order -- fit to 2400x1784, then take the
same centre crop to 2400x1200 -- so the pasture behind the phones is pixel-for-
pixel the pasture that ships today.

THREE PHONES, NOT FOUR, and they are bigger than the four were.  The old master
was four 431x948 screens with a 26px gap, spanning 75% of the plate.  Three
screens of that height would span 57% and float; at 1040 tall they span 62% and
carry the plate.  Measured against the alternatives by looking at them at 1200,
552 (the desktop card) and 342 (the card at a 390 viewport): 948 is too small to
read the tower's blocks, 1100 leaves too little pasture above and below.

THE CORNER RADIUS IS THE DEVICE'S, NOT THE SERIES'.  The other covers round a
WINDOW of desktop UI at round(width * .014), and the old Strata master was a
design mockup whose screens were rounded at .087 of their own width.  These are
real iPhone 17 screenshots, and at .087 they read as rounded rectangles rather
than as phones.  .115 of the screen width is the device's own display radius
(62pt on a 402pt-wide screen) and it is the one that reads as a phone.  Looked
at, at all three sizes, against .087 and .145.

NO SHADOW.  On this site the companion heads cast contact shadows and nothing
else does, because a shadow is information -- it says the head is standing on
something.  A screen gets the same hairline the rest of the site's chrome uses,
`--rim-1`, one CSS pixel: 1 device pixel at 1200 and 2 at 2400, because the
plate is served at DPR 2.

THE OFF PLATE.  time-aware-thumbnails.js serves ORIGINALS["strata"] --
`images/cs/strata-cover.webp` -- when the clock is off, and the rule there is
that Off is the same picture with no grade applied, so switching it off changes
the light and nothing else.  Strata has no ungraded plate: its six states are
generative relights of the DAYTIME plate, which is itself the phone-free
reconstruction of the original composition.  The daytime plate is therefore the
base, and that is what Off is built from.  The file it replaces was the original
warm 1600x1189 composite, which was neither one of the six nor 2:1.
"""

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "images/cs/variants/time/strata"
SCREENS = ROOT / "images/cs/study/strata"
ORIGINAL = ROOT / "images/cs/strata-cover.webp"
CACHE = Path("/tmp/portfolio-strata-plates")

STATES = ("pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night")
# The commit that still carries the six phone-free pasture plates.
PLATE_COMMIT = "a8a3cb7"
PLATE_PATH = "images/cs/variants/time/strata/sources/{state}-generated.png"

CANVAS = (2400, 1784)          # the 2026-08-20 canvas
CROP = (0, 292, 2400, 1492)    # the 2:1 centre crop d76f055 re-cut every cover to
WIDTHS = (2400, 1200)
OFF_WIDTH = 1600

# The three screens, left to right.  The launch mark sits in the MIDDLE because
# it is the only dark screen and it separates the two light ones; at either end
# the plate reads lopsided.
SCREEN_ORDER = ("tower", "launch", "map")
PHONE_H = 1040                 # at 2400 wide
PHONE_ASPECT = 1206 / 2622     # iPhone 17, the size every screenshot was taken at
GAP = .06                      # of a phone's width
RADIUS = .115                  # of a phone's width: the device's own display radius
RIM = (9, 11, 36, 20)          # the site's --rim-1

DESKTOP_QUALITY = 90           # d76f055 measured q82/q90/q95 at 37.8/40.8/43.1 dB
MOBILE_QUALITY = 88            # and picked q90; the mobile plates ship at q88
DESKTOP_LIMIT = 700 * 1024


def plate(state):
    """The phone-free pasture for one state, restored from git if need be."""
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / f"{state}.png"
    if not cached.exists():
        blob = f"{PLATE_COMMIT}:{PLATE_PATH.format(state=state)}"
        with cached.open("wb") as handle:
            subprocess.run(["git", "show", blob], cwd=ROOT, stdout=handle, check=True)
    return Image.open(cached)


def background(state, width):
    """The pasture at `width`, cropped exactly as every cover on the site is."""
    with plate(state) as source:
        fitted = ImageOps.fit(
            source.convert("RGB"), CANVAS,
            method=Image.Resampling.LANCZOS, centering=(0.5, 0.5),
        )
    cropped = fitted.crop(CROP)
    if width != CROP[2]:
        cropped = cropped.resize((width, width // 2), Image.Resampling.LANCZOS)
    return cropped


def rounded(image, size, radius, hairline):
    """A screenshot scaled into `size` with the device's corners and a hairline.

    The two-pixel feather is the trick the rest of the series uses: it protects
    the screenshot's own antialiased edge without leaving a hard pasted seam
    against the pasture.
    """
    scaled = image.resize(size, Image.Resampling.LANCZOS).convert("RGBA")
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1),
                                           radius=radius, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(max(1, size[0] / 900)))
    scaled.putalpha(mask)
    rim = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(rim).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1),
                                          radius=radius, outline=RIM, width=hairline)
    scaled.alpha_composite(rim)
    return scaled


def foreground(size):
    """The three screens, built once per width and reused for every state.

    Building it once is what makes the six plates differ only where the
    photograph is; rebuilding it per state would let a resample land a pixel
    apart and quietly break the thing the whole series rests on.
    """
    width, height = size
    scale = width / 2400.0
    ph = round(PHONE_H * scale)
    pw = round(ph * PHONE_ASPECT)
    gap = round(pw * GAP)
    radius = round(pw * RADIUS)
    hairline = max(1, round(width / 1200))
    span = 3 * pw + 2 * gap
    x = round((width - span) / 2)
    y = round((height - ph) / 2)
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    for index, name in enumerate(SCREEN_ORDER):
        source = SCREENS / f"{name}.webp"
        if not source.exists():
            raise FileNotFoundError(f"the Strata screen moved: {source}")
        with Image.open(source) as screen:
            layer.alpha_composite(rounded(screen.convert("RGB"), (pw, ph), radius, hairline),
                                  (x + index * (pw + gap), y))
    return layer


def encode(image, target, quality):
    with tempfile.TemporaryDirectory(prefix="strata-cover-") as tmp:
        png = Path(tmp) / "plate.png"
        image.save(png, compress_level=1)
        if shutil.which("cwebp"):
            subprocess.run(["cwebp", "-quiet", "-m", "6", "-pass", "10", "-sharp_yuv",
                            "-metadata", "none", "-q", str(quality), str(png),
                            "-o", str(target)], check=True)
        else:
            image.save(target, "WEBP", quality=quality, method=6,
                       exact=True, exif=b"", icc_profile=None)
    return target


def build():
    written = []
    products = {}
    for width in WIDTHS:
        product = foreground((width, width // 2))
        products[width] = product
        for state in STATES:
            composed = background(state, width).convert("RGBA")
            composed.alpha_composite(product)
            target = OUT / f"{state}-{width}.webp"
            target.parent.mkdir(parents=True, exist_ok=True)
            encode(composed.convert("RGB"), target,
                   DESKTOP_QUALITY if width == 2400 else MOBILE_QUALITY)
            if width == 2400 and target.stat().st_size >= DESKTOP_LIMIT:
                raise RuntimeError(f"desktop plate over the 700 KiB limit: {target}")
            written.append(target)

    off = background("daytime", OFF_WIDTH).convert("RGBA")
    off.alpha_composite(foreground(off.size))
    encode(off.convert("RGB"), ORIGINAL, MOBILE_QUALITY)
    written.append(ORIGINAL)
    return written, products


# THE INVARIANT, AND WHY IT IS MEASURED ON THE MEAN.  WebP is lossy and
# re-quantises a flat panel differently depending on what surrounds it, so
# single pixels inside an untouched screen still move between states: on this
# cover the peak reaches the twenties while the mean sits near zero.  A grade
# that actually reached the product is not a scattering of stray pixels, it is
# every pixel moving the same way at once.  --self-test re-injects that bug and
# proves this check can fail.
DRIFT_MEAN = 3.0
DRIFT_PEAK = 60


def drift(inject=False):
    """How far the product layer moves across the six states, in levels."""
    frames = []
    for state in STATES:
        with Image.open(OUT / f"{state}-1200.webp") as image:
            frames.append(image.convert("RGB"))
    if inject:
        # The bug: grade the product with the photograph instead of over it.
        frames[-1] = Image.eval(frames[-1], lambda v: round(v * .36))
    opaque = foreground(frames[0].size).getchannel("A").point(lambda v: 255 if v == 255 else 0)
    box = opaque.getbbox()
    reference = frames[2].crop(box)
    mask = opaque.crop(box)
    worst_mean = worst_peak = 0.0
    for frame in frames:
        difference = ImageChops.difference(frame.crop(box), reference)
        masked = Image.new("RGB", difference.size)
        masked.paste(difference, mask=mask)
        band = masked.convert("L")
        histogram = band.histogram()
        counted = sum(histogram[1:]) or 1
        worst_mean = max(worst_mean, sum(v * n for v, n in enumerate(histogram)) / counted)
        worst_peak = max(worst_peak, band.getextrema()[1])
    return worst_mean, worst_peak


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true",
                        help="re-inject the grade-the-product bug and prove the check fails")
    args = parser.parse_args()

    if args.self_test:
        mean, peak = drift(inject=True)
        if mean <= DRIFT_MEAN and peak <= DRIFT_PEAK:
            print("strata cover self-test: FAIL -- injected grade went unnoticed "
                  "(mean %.2f, peak %d)" % (mean, peak))
            return 1
        print("strata cover self-test: OK -- injected grade caught "
              "(mean %.2f, peak %d)" % (mean, peak))
        return 0

    written, _ = build()
    for path in written:
        with Image.open(path) as image:
            assert image.format == "WEBP", (path, image.format)
            assert image.mode == "RGB", (path, image.mode)
            if path.parent == OUT:
                width = int(path.stem.rsplit("-", 1)[1])
                assert image.size == (width, width // 2), (path, image.size)
    mean, peak = drift()
    if mean > DRIFT_MEAN or peak > DRIFT_PEAK:
        print("strata cover: FAIL -- the product layer moves between states "
              "(mean %.2f, peak %d)" % (mean, peak))
        return 1
    print("strata cover: OK -- %d files, product drift mean %.2f peak %d"
          % (len(written), mean, peak))
    return 0


if __name__ == "__main__":
    sys.exit(main())
