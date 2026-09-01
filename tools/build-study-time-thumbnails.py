#!/usr/bin/env python3
"""Build the four new case-study covers as six time states, UI pixels preserved.

WHAT THIS IS.  The five covers that already ship are a photograph with the
product standing on top of it, and only the PHOTOGRAPH takes the hour -- the
mockup pixels are byte-identical in all six states.  That preservation is the
whole reason those plates read as one picture at six times of day instead of six
filters.  This builds Lifeline, Head Maker, Gradient Lab and the games engine to
the same construction, and it deliberately imports nothing from
build-missing-time-thumbnails.py except the numbers: PALETTES, atmosphere() and
grade() are copied verbatim so a new cover is graded by the identical curve the
shipped ones were, and a future edit to one file cannot silently re-grade the
other set.

THE PHOTOGRAPHS ARE DELIBERATE AND DIFFERENT, one per product, chosen so the
plate's colour agrees with that product's UI -- the same rule the shipped five
follow (an audit once called them "the same stock meadow"; it was wrong).  Each
is a NEUTRAL DAYLIGHT frame with no sun in shot, because a photograph that
already reads as sunset cannot be graded to pre-dawn without looking tinted.
Sources, all Unsplash (licence permits commercial use without attribution;
credited here so the credit exists if he ever wants it):

  lifeline     Eddie Lau        YjVNM-F-XuQ  Lake Pukaki under Aoraki: calm
               blue-teal water and a long level horizon, which is what a
               timeline is.
  headmaker    Jake Kling       8PPrRG9xT_c  a vermilion sandstone ridge --
               the same coral the cut-out face is drawn in.
  gradientlab  Liam Shaw        kY7-2ol_gjY  lavender rows under a pale sky:
               three clean bands of colour, a gradient ramp standing in a field.
  engine       Peter Robbins    RdTwjy65i8g  a mown football pitch with goals
               and a conifer treeline -- the games' own ground, and the joke
               the plate is built on: the match's white pitch standing on a
               real one.

UNSPLASH+ WAS AVOIDED ON PURPOSE.  Roughly a quarter of every search result is
served from plus.unsplash.com, which is the paid licence, not the free one.
Every photograph above is images.unsplash.com.

THE SOURCE FRAMES ARE NOT IN THE REPO.  They are fetched to a cache under /tmp
and only the finished plates are committed, the same way the shipped UC Davis
mockup lives outside the tree.  Re-running offline reuses the cache.

GEOMETRY.  ONE window per plate, the product's signature screen, fitted into a
box that is the same fraction of every plate and centred in it -- so the four
covers carry the same visual weight even though the four screenshots have four
different aspect ratios.  The corner radius is the one the shipped R3SHORE plate
uses, round(width * .014): 17px at 1200 and 34px at 2400, one value across the
whole series rather than one per cover.  It casts NO shadow.  On this site the
companion heads cast contact shadows and nothing else does.

WHY ONE WINDOW AND NOT A WINDOW PLUS A PHONE.  The first build paired each
window with that product's mobile view, and the mobile plates in
images/cs/study/*/ are not cut-out phones -- they are two phone screens laid on
their own light grey ground, which pastes a grey rectangle onto the photograph.
R3SHORE already proves a single window carries a plate in this series.
"""

import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageStat


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "images/cs/variants/time"
STUDY = ROOT / "images/cs/study"
CACHE = Path("/tmp/portfolio-study-covers")
STATES = ("pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night")

# Verbatim from tools/build-missing-time-thumbnails.py.  See the module note.
PALETTES = {
    "pre-dawn": ((72, 111, 253), (196, 137, 255), .74, .28),
    "sunrise": ((203, 131, 255), (255, 185, 119), .96, .24),
    "daytime": ((0, 113, 193), (180, 216, 255), 1.02, .08),
    "dusk": ((99, 112, 168), (255, 179, 106), .82, .25),
    "sunset": ((221, 120, 162), (255, 165, 119), .82, .29),
    "night": ((20, 30, 75), (69, 59, 179), .36, .38),
}

# raw Unsplash URL, then the crop's vertical centre as a fraction of the source
# height.  The offset is the only per-photograph tuning: it decides where the
# horizon lands, and the horizon is what the atmosphere gradient reads against.
SCENES = {
    "lifeline": ("https://images.unsplash.com/photo-1655476284454-ca64e462532d", .55),
    "headmaker": ("https://images.unsplash.com/photo-1778110858872-5bde317d0272", .55),
    "gradientlab": ("https://images.unsplash.com/photo-1611613042541-21b1afcae5fd", .55),
    "engine": ("https://images.unsplash.com/photo-1719469202552-3a86b1bf5ff0", .55),
}

# The one screen that stands on each photograph: the product's signature view.
# THESE PATHS BELONG TO THE AGENT WRITING THE CASE-STUDY PAGES, and they have
# already been renamed once mid-session (mobile.webp -> phones.webp,
# race-late.webp -> race-finish.webp).  The tool therefore fails loudly on a
# missing screen rather than quietly falling back to a different one.
LAYOUTS = {
    "lifeline": "study/lifeline/timeline.webp",
    "headmaker": "study/headmaker/step3.webp",
    "gradientlab": "study/gradientlab/builder.webp",
    "engine": "study/engine/soccer.webp",
}
# How much of the screen to keep, top and bottom as fractions of its height.
# Only the match capture needs it: measured, its last non-white row is 601 of
# 798, so a quarter of that window would have been a blank white band -- the
# single thing that made the first build of this plate read flatter than the
# five that ship.  Trimming it also makes the window wider relative to the
# plate, which puts more pitch above and below it.
SCREEN_CROP = {"engine": (0.0, 0.83)}
WINDOW_W = .66          # the box the window is fitted into, as a fraction of
WINDOW_H = .76          # the plate.  Aspect is preserved inside it.
RADIUS = .014           # the shipped R3SHORE corner: 17px at 1200, 34px at 2400
# The site's own --rim-1, inset 0 0 0 1px rgba(9,11,36,.08).  A white product
# panel standing on a pale pre-dawn sky has no edge of its own, and elevation is
# not available to give it one: on this site the companion heads cast contact
# shadows and NOTHING else does.  Chrome separates with hairlines, so the window
# gets the hairline chrome already uses -- one CSS pixel, which is 1 device pixel
# at 1200 and 2 at 2400 because the plate is served at DPR 2.
RIM = (9, 11, 36, 20)


def atmosphere(size, upper, lower):
    layer = Image.new("RGB", size)
    pixels = layer.load()
    width, height = size
    for y in range(height):
        t = y / max(1, height - 1)
        # Smoothstep keeps the horizon soft rather than banded.
        t = t * t * (3 - 2 * t)
        color = tuple(round(a + (b - a) * t) for a, b in zip(upper, lower))
        for x in range(width):
            pixels[x, y] = color
    return layer.filter(ImageFilter.GaussianBlur(max(2, width // 400)))


def grade(image, state):
    upper, lower, brightness, opacity = PALETTES[state]
    base = ImageEnhance.Brightness(image.convert("RGB")).enhance(brightness)
    if state == "night":
        base = ImageEnhance.Color(base).enhance(.64)
        base = ImageEnhance.Contrast(base).enhance(1.08)
    elif state in ("pre-dawn", "dusk", "sunset"):
        base = ImageEnhance.Color(base).enhance(.88)
    overlay = atmosphere(base.size, upper, lower)
    return Image.blend(base, overlay, opacity)


def fetch(slug):
    """Cache the 2400-wide source frame.  Nothing here reaches the repo."""
    CACHE.mkdir(parents=True, exist_ok=True)
    target = CACHE / f"{slug}.jpg"
    if not target.exists():
        url, _ = SCENES[slug]
        urllib.request.urlretrieve(f"{url}?w=2400&q=88&fm=jpg", target)
    return Image.open(target).convert("RGB")


def plate(slug, width):
    """The photograph alone, cropped to 2:1 at `width`."""
    source = fetch(slug)
    _, focus = SCENES[slug]
    height = width // 2
    scale = max(width / source.width, height / source.height)
    scaled = source.resize(
        (round(source.width * scale), round(source.height * scale)), Image.Resampling.LANCZOS
    )
    left = (scaled.width - width) // 2
    top = min(max(round(scaled.height * focus - height / 2), 0), scaled.height - height)
    return scaled.crop((left, top, left + width, top + height))


def rounded(image, size, radius, hairline):
    """Scale a screenshot into `size` and round its corners.

    The two-pixel feather is the same trick the shipped R3SHORE plate uses: it
    protects the screenshot's own antialiased edge without leaving a hard pasted
    seam against a freshly graded background.
    """
    scaled = image.resize(size, Image.Resampling.LANCZOS).convert("RGBA")
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(max(1, size[0] / 900)))
    scaled.putalpha(mask)
    rim = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(rim).rounded_rectangle(
        (0, 0, size[0] - 1, size[1] - 1), radius=radius, outline=RIM, width=hairline
    )
    scaled.alpha_composite(rim)
    return scaled


def foreground(slug, size):
    """The product layer, identical in every state.

    It is built ONCE per width and composited unchanged over each graded
    background, so the six files of a cover differ only where the photograph is.
    """
    width, height = size
    radius = round(width * RADIUS)
    source = ROOT / "images/cs" / LAYOUTS[slug]
    if not source.exists():
        raise FileNotFoundError(f"{slug}: the case-study screen moved: {source}")
    window = Image.open(source).convert("RGB")
    top, bottom = SCREEN_CROP.get(slug, (0.0, 1.0))
    if (top, bottom) != (0.0, 1.0):
        window = window.crop((0, round(window.height * top), window.width, round(window.height * bottom)))

    scale = min(width * WINDOW_W / window.width, height * WINDOW_H / window.height)
    box = (round(window.width * scale), round(window.height * scale))
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    layer.alpha_composite(
        rounded(window, box, radius, max(1, round(width / 1200))),
        (round((width - box[0]) / 2), round((height - box[1]) / 2)),
    )
    return layer


# ── YOWMINGS ─────────────────────────────────────────────────────────────────
# The league's cover is not a photograph with a product on it; it is a capture
# of a match on the game's own flat 253 pitch, and it is the plate the Home card
# and the case-study hero both already load.  It is NOT rebuilt here and NOT
# replaced.  What it gets is the same separation the other five get: the GROUND
# takes the hour, the INK does not.  Every head, both sets of uprights, the ball
# and the score bar come back byte-identical over the graded pitch, so this is
# the series' rule applied to a plate whose environment happens to be drawn
# rather than photographed -- not a recolour of the picture, which is the one
# thing the series is not.
#
# THE MASK IS MEASURED, NOT GUESSED.  Ground is (253,253,253): darkness 2,
# saturation 0.  The soft reflections under the eggheads run to darkness ~9 and
# are part of the pitch's surface, so they must grade WITH it -- a shadow on a
# blue pitch is a darker blue -- and the ramp therefore starts above them, at
# 22.  A head reads darkness 222 and saturation 124; the black score bar reads
# darkness ~220 at saturation 0, which is why darkness and saturation are taken
# together rather than either alone.  Saturation is weighted 1.6 so a bright
# yellow upright (light, but strongly coloured) clears the ramp on colour.
YOWMINGS = ROOT / "images/cs/yowmings"
INK_FLOOR, INK_RAMP, INK_SAT = 22, 40, 1.6


def ink_layer(plate):
    """The parts of the match that must not take the hour, with soft edges."""
    red, green, blue = plate.split()
    low = ImageChops.darker(ImageChops.darker(red, green), blue)
    high = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    darkness = ImageChops.invert(low)
    saturation = ImageChops.subtract(high, low).point(lambda v: min(255, round(v * INK_SAT)))
    strength = ImageChops.lighter(darkness, saturation)
    mask = strength.point(
        lambda v: 0 if v <= INK_FLOOR else 255 if v >= INK_FLOOR + INK_RAMP
        else round((v - INK_FLOOR) * 255 / INK_RAMP)
    )
    # A sub-pixel feather only: the capture's own antialiasing is already soft,
    # and anything wider would leave a pale halo around every head.
    mask = mask.filter(ImageFilter.GaussianBlur(.6))
    layer = plate.convert("RGBA")
    layer.putalpha(mask)
    return layer


def build_yowmings():
    written = []
    for width in (2400, 1200):
        source = YOWMINGS / f"card-{width}.webp"
        if not source.exists():
            raise FileNotFoundError(f"yowmings: the shipped plate moved: {source}")
        plate_image = Image.open(source).convert("RGB")
        assert plate_image.size == (width, width // 2), (source, plate_image.size)
        ink = ink_layer(plate_image)
        for state in STATES:
            composed = grade(plate_image, state).convert("RGBA")
            composed.alpha_composite(ink)
            written.append(save(composed.convert("RGB"), "yowmings", state, width))
    return written


def save(image, slug, state, width):
    target = OUT / slug / f"{state}-{width}.webp"
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "WEBP", quality=84, method=6, exact=True, exif=b"", icc_profile=None)
    return target


def build(slug):
    written = []
    for width in (2400, 1200):
        background = plate(slug, width)
        product = foreground(slug, background.size)
        for state in STATES:
            composed = grade(background, state).convert("RGBA")
            composed.alpha_composite(product)
            written.append(save(composed.convert("RGB"), slug, state, width))
    # THE OFF STATE.  time-aware-thumbnails.js serves ORIGINALS[slug] when the
    # clock is off, so an ungraded plate has to exist as a real file.  It is the
    # same photograph and the same product layer with no grade applied, at the
    # 1600 the shipped originals use, so switching to Off changes the light and
    # nothing else.
    background = plate(slug, 1600)
    ungraded = background.convert("RGBA")
    ungraded.alpha_composite(foreground(slug, background.size))
    cover = STUDY / slug / "cover.webp"
    cover.parent.mkdir(parents=True, exist_ok=True)
    ungraded.convert("RGB").save(cover, "WEBP", quality=84, method=6, exact=True, exif=b"", icc_profile=None)
    written.append(cover)
    return written


# THE MEASUREMENT IS THE MEAN, NOT THE PEAK, and that is the whole subtlety of
# the check below.  WebP at quality 84 is lossy and re-quantises a flat panel
# differently depending on what surrounds it, so single pixels inside an
# untouched window still move: measured across all four covers, peaks reach 33
# levels while the MEAN sits at 0.76 or below.  A grade that actually reached
# the product is not a scattering of stray pixels, it is every pixel moving the
# same way at once -- injected, it measures a mean of 21 and a peak of 96.  A
# peak threshold would therefore have to be set above 33, which is under the
# noise a real leak on a dark plate can hide in; the mean separates the two
# cases by a factor of 27.  --self-test re-injects the bug and proves it.
PRODUCT_DRIFT_MEAN = 3.0
PRODUCT_DRIFT_PEAK = 60


def product_drift(slug, folder=None):
    """How far the product layer moves across the six states, in levels.

    Six states of a cover must differ ONLY where the photograph is.  A composite
    ordered wrong, a mask that stopped covering, an alpha channel dropped by a
    save -- each shows up here, and each is otherwise invisible until six plates
    are opened side by side.
    """
    folder = folder or OUT / slug
    frames = [Image.open(folder / f"{state}-1200.webp").convert("RGB") for state in STATES]
    if slug == "yowmings":
        # The ink is scattered over the whole plate rather than sitting in one
        # rectangle, so the sample is every pixel the mask holds fully opaque.
        opaque = ink_layer(Image.open(YOWMINGS / "card-1200.webp").convert("RGB")).getchannel("A")
        opaque = opaque.point(lambda v: 255 if v == 255 else 0)
        void = Image.new("RGB", frames[0].size)
        samples = [Image.composite(frame, void, opaque) for frame in frames]
    else:
        box = foreground(slug, frames[0].size).getbbox()
        pad = round(frames[0].width * RADIUS) + 3
        samples = [f.crop((box[0] + pad, box[1] + pad, box[2] - pad, box[3] - pad)) for f in frames]
    mean = peak = 0.0
    for sample in samples[1:]:
        difference = ImageChops.difference(samples[0], sample)
        mean = max(mean, max(ImageStat.Stat(difference).mean))
        peak = max(peak, max(high for _, high in difference.getextrema()))
    return mean, peak


def check_product_is_fixed(slug):
    mean, peak = product_drift(slug)
    assert mean <= PRODUCT_DRIFT_MEAN and peak <= PRODUCT_DRIFT_PEAK, \
        f"{slug}: the grade reached the product layer (mean {mean:.2f}, peak {peak})"
    return mean, peak


def self_test():
    """Re-inject the bug the check exists for and prove the check catches it.

    The bug is one line out of order: composite the product BEFORE grading
    instead of after, so the hour lands on the mockup as well as on the
    photograph.  It is written to a scratch folder, never into images/.
    """
    slug = "headmaker"
    scratch = CACHE / "self-test"
    scratch.mkdir(parents=True, exist_ok=True)
    background = plate(slug, 1200)
    product = foreground(slug, background.size)
    for state in STATES:
        broken = background.convert("RGBA")
        broken.alpha_composite(product)            # <-- the injected mistake
        graded = grade(broken.convert("RGB"), state)
        graded.save(scratch / f"{state}-1200.webp", "WEBP", quality=84, method=6)
    mean, peak = product_drift(slug, scratch)
    assert mean > PRODUCT_DRIFT_MEAN, f"the check cannot fail: injected drift was only {mean:.2f}"
    healthy = product_drift(slug)
    print(f"self-test: injected grade-on-product measures mean {mean:.2f} / peak {peak}; "
          f"the shipped plate measures mean {healthy[0]:.2f} / peak {healthy[1]}; "
          f"threshold {PRODUCT_DRIFT_MEAN}. OK")


def main():
    if "--self-test" in sys.argv:
        self_test()
        return
    slugs = sys.argv[1:] or list(SCENES) + ["yowmings"]
    for slug in slugs:
        for path in (build_yowmings() if slug == "yowmings" else build(slug)):
            print(path.relative_to(ROOT), path.stat().st_size)
        variants = sorted((OUT / slug).glob("*.webp"))
        assert len(variants) == 12, (slug, len(variants))
        for path in variants:
            with Image.open(path) as image:
                width = int(path.stem.rsplit("-", 1)[1])
                assert image.size == (width, width // 2), (path, image.size)
                assert image.format == "WEBP", path
        mean, peak = check_product_is_fixed(slug)
        print(f"  {slug}: product fixed across six states (mean {mean:.2f}, peak {peak})")
    print("study time thumbnails: OK", " ".join(slugs))


if __name__ == "__main__":
    main()
