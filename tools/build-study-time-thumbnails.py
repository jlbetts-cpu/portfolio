#!/usr/bin/env python3
"""Build the four new case-study covers as six time states, UI pixels preserved.

WHAT THIS IS.  The five covers that already ship are a photograph with the
product standing on top of it, and only the PHOTOGRAPH takes the hour -- the
mockup pixels are byte-identical in all six states.  That preservation is the
whole reason those plates read as one picture at six times of day instead of six
filters.  This builds Workspace, Head Maker, Gradient Lab and the games engine to
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

  workspace    Eddie Lau        YjVNM-F-XuQ  Lake Pukaki under Aoraki: calm
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
    "workspace": ("https://images.unsplash.com/photo-1655476284454-ca64e462532d", .55),
    "headmaker": ("https://images.unsplash.com/photo-1778110858872-5bde317d0272", .55),
    "gradientlab": ("https://images.unsplash.com/photo-1611613042541-21b1afcae5fd", .55),
    "engine": ("https://images.unsplash.com/photo-1719469202552-3a86b1bf5ff0", .55),
    # ADDED 2026-09-01, when he said the Tournament card had no picture and the
    # Yowmings one was not consistent with the rest.  Both were true: they were the
    # only two cards in the band with no photograph under them.  Yowmings was a flat
    # game capture graded in place by build_yowmings() below, and Tournament was a bare
    # UI panel on white that had never been through this tool at all.
    #
    # Three football grounds now, and they have to stay TELLABLE APART, which is the
    # same rule the other four follow: engine keeps its mown pitch and conifer treeline,
    # the League gets a big tiered bowl, and the cup gets a single stand behind an even
    # green.  Both new frames are flat overcast light with NO SUN IN SHOT, because a
    # photograph that already reads as one hour cannot be graded to another.
    #
    #   yowmings    Petr Ganaj       095cc0a28e09  a corner flag and a boundary line
    #               on flat turf, shot close in under cloud.  A STADIUM FRAME WAS TRIED
    #               FIRST AND PULLED: the MCG bowl reads well at card size but at
    #               case-study size its Toyota and AAMI hoardings are legible, and the
    #               crop cannot escape them -- the source is 3:2, so a 2:1 crop can drop
    #               only a quarter of the height and the stand is more than that.  Every
    #               professional-stadium photograph checked for this had boards on it;
    #               an amateur ground has none by construction.  This one also stays
    #               clearly apart from engine's mown pitch and treeline, which is the
    #               rule for the whole set.
    #   tournament  Nathan Bingle    9UVmlIb0wJU  one stand behind a flat green, shot
    #               level: a knockout tie is one match at one ground, not a season.
    #
    # A floodlit Parc des Princes frame was rejected on the way here for two reasons
    # worth recording: it is a night shot, which this grade cannot undo, and it carries
    # PSG, Mastercard, PS5 and Pepsi hoardings -- third-party marks have no business on
    # his portfolio.  Check both before adding a fourth ground.
    "yowmings": ("https://images.unsplash.com/photo-1582661714915-095cc0a28e09", .52),
    "tournament": ("https://images.unsplash.com/photo-1661924038279-9ce6514d5bf4", .60),
}

# The one screen that stands on each photograph: the product's signature view.
# THESE PATHS BELONG TO THE AGENT WRITING THE CASE-STUDY PAGES, and they have
# already been renamed once mid-session (mobile.webp -> phones.webp,
# race-late.webp -> race-finish.webp).  The tool therefore fails loudly on a
# missing screen rather than quietly falling back to a different one.
LAYOUTS = {
    "workspace": "study/workspace/timeline.webp",
    "headmaker": "study/headmaker/step3.webp",
    "gradientlab": "study/gradientlab/builder.webp",
    "engine": "study/engine/soccer.webp",
    # The kickoff, which is the screen he named: "put the kickoff on a real pitch photo".
    "yowmings": "yowmings/play-1600.webp",
    "tournament": "study/engine/tournament.webp",
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
# ONE SLUG DEVIATES, AND IT IS NOT A TUNING KNOB.  The four original covers hold the
# same fraction so they carry the same weight in a row, and that rule stands for
# anything that is an APP SCREENSHOT: a window of UI reads fine small because a reader
# only has to recognise it.  Yowmings is not a screenshot, it is a SCENE -- a wide shot
# of a kickoff with cut-out heads, a referee and a set of uprights at each end -- and at
# .66 the heads are two-thirds size and the thing the picture is of stops being legible.
# He said it directly: he likes the case study's picture, which is the same scene at full
# bleed, more than the card's. So the scene gets a bigger box and the photograph stays as
# a frame around it rather than a field it floats in.
WINDOW_BOX = {}

# SLUGS WHOSE PRODUCT IS CUT OUT AND STOOD ON THE PHOTOGRAPH, rather than fitted into a
# window.  Yowmings went through three shapes before this one and the reason it moved is
# worth keeping: its capture is not a UI screenshot, it is a SCENE, and a scene inside a
# white rounded panel on grass reads as a mistake -- "the screenshot i dont like it looks
# like a glitch".  A window works for an app because a reader expects an app to live in
# one.  Nothing expects a kickoff to.
#
# So the white is matted out and the heads, the ball and the uprights stand on the turf
# directly.  The matte is the same ink machinery build_yowmings() uses, and it is already
# built to exclude the capture's floor reflections (INK_CORE 130; reflections peak at 90)
# -- a reflection pasted onto grass is the same glitch in a smaller costume.
#
# THEY GET A CONTACT SHADOW, and that is not an exception to this site's shadow rule, it
# IS the rule: the companion heads cast contact shadows because they are standing on
# something, and here they are standing on a pitch.  Nothing else in the plate casts.
# EMPTIED ON 2026-09-01, and the reason is worth keeping because it went back and forth.
# The kickoff capture was matted out of its white ground and stood on the turf directly,
# because in a window it looked like a glitch. It did -- but the fault was the CAPTURE,
# not the construction: that frame is a pre-kickoff screen that is mostly empty white, so
# a window around it framed nothing. He was explicit about what he wanted instead: "I want
# a new screenshot of the heads playing on a background with corner roundness not no
# cutout of the heads on a background literally like every other thumbnail we have."
# So the plate is a real mid-match frame -- scoreboard, quarter-final, crowns, both
# uprights -- in the same rounded window every other cover uses. Nothing is matted now.
MATTE = set()
MATTE_SCALE = .90       # so the uprights at the capture's edges land inside the frame
MATTE_SHADOW = (7, 9, .34)   # blur px, drop px, opacity
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


def matte_layer(source, size):
    """The kickoff cut off its white ground, with a contact shadow under it.

    Returned at the plate's full size with everything outside the ink transparent, so
    build() composites it exactly like a window layer and every state still gets a
    byte-identical product.
    """
    width, height = size
    capture = Image.open(source).convert("RGB")
    alpha, ink = ink_matte(capture)
    inner = (round(width * MATTE_SCALE), round(height * MATTE_SCALE))
    alpha = alpha.resize(inner, Image.Resampling.LANCZOS)
    ink = ink.resize(inner, Image.Resampling.LANCZOS)
    left, top = (width - inner[0]) // 2, (height - inner[1]) // 2

    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    blur, drop, strength = MATTE_SHADOW
    # The shadow scales with the plate, or it is half as heavy at 2400 as at 1200.
    k = width / 1200
    cast = alpha.filter(ImageFilter.GaussianBlur(blur * k)).point(
        lambda v: round(v * strength))
    shadow = Image.new("RGBA", inner, (9, 11, 36, 255))
    shadow.putalpha(cast)
    layer.alpha_composite(shadow, (left, top + round(drop * k)))

    subject = ink.copy()
    subject.putalpha(alpha)
    layer.alpha_composite(subject, (left, top))
    return layer


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
    if slug in MATTE:
        return matte_layer(source, size)
    window = Image.open(source).convert("RGB")
    top, bottom = SCREEN_CROP.get(slug, (0.0, 1.0))
    if (top, bottom) != (0.0, 1.0):
        window = window.crop((0, round(window.height * top), window.width, round(window.height * bottom)))

    box_w, box_h = WINDOW_BOX.get(slug, (WINDOW_W, WINDOW_H))
    scale = min(width * box_w / window.width, height * box_h / window.height)
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
# replaced.  What it gets is the same separation the other ten get: the GROUND
# takes the hour, the INK does not.  Every head, both sets of uprights, the ball
# and the score bar come back byte-identical over the graded pitch, so this is
# the series' rule applied to a plate whose environment happens to be drawn
# rather than photographed -- not a recolour of the picture, which is the one
# thing the series is not.
#
# THE FIRST BUILD OF THIS SEPARATION WAS A THRESHOLD, AND A THRESHOLD CANNOT DO
# IT.  2026-09-01, looked at rather than measured: at night the referee's
# photographic face was stained purple across both cheeks, the chin and the
# forehead, his cap's white stripes went purple with it, and the soft reflection
# under every egghead inverted into a bright white ghost sitting ON the dark
# pitch.  All three are the same mistake.  The old mask was
# strength = max(darkness, 1.6*saturation) ramped from 22 to 62, and:
#
#   * INK IS NOT ALWAYS DARK OR COLOURED.  His skin, his teeth, the cap's white
#     stripes and the ball's laces are bright and neutral, so they scored below
#     the ramp and took the hour like ground.  A photograph of a person is ink.
#   * REFLECTIONS ARE NOT INK.  They reach darkness ~88 near the head, well over
#     the ramp's ceiling of 62, so their strongest part was held byte-identical
#     as light grey while their faint tail graded -- which is why they inverted.
#     A reflection is the pitch's own surface and has to grade WITH it.
#
# SO THE MATTE IS BUILT FROM SHAPE, NOT FROM BRIGHTNESS.  Three steps, and each
# one exists because the step before it is not enough on its own:
#
#   1. SILHOUETTE.  Threshold low (22) to catch every antialiased outer edge,
#      then fill every enclosed hole by flooding the OUTSIDE of the frame.  This
#      is what makes a bright cheek ink: it is not dark, it is INSIDE something.
#   1b. CUT AT THE GROUND LINE.  A reflection TOUCHES the head it belongs to, so
#      step 2 cannot drop it on connectivity, and it cannot be dropped on
#      brightness either: it reaches darkness ~88 under the head while the
#      referee's face is sealed by an outline of only ~53, so no single
#      threshold clears both.  What separates them is that nothing which is ink
#      extends below the lowest core-strength pixel in its own column.  Without
#      this cut every head grew a hard white pedestal at night -- the top of its
#      own reflection, promoted to ink and un-matted to white.
#   2. KEEP ONLY WHAT HAS A CORE.  Filling holes also keeps the reflections,
#      which are solid blobs of their own.  A morphological reconstruction from
#      strength >= 130 -- a level no reflection pixel reaches, measured max 90 --
#      keeps exactly the silhouettes that contain real ink and drops the rest.
#      A flood fill alone will not do this: the referee's temples are bare skin
#      against bare pitch with no dark outline, so the fill leaks straight into
#      his face and carves out the eyes.
#   3. UN-MATTE THE EDGE.  An antialiased edge pixel is a blend of ink and the
#      WHITE pitch.  Replayed unchanged over a night-blue ground it is a bright
#      rim, and that rim was visible around every head.  The ink's own colour is
#      recovered as (pixel - 253*(1-a)) / a before it is composited back.
#
# AND THE REFLECTIONS BECOME SHADING RATHER THAN PIXELS.  They are applied to
# the graded ground as a MULTIPLY -- pitch/253 -- so a reflection on a blue
# pitch is a darker blue and on a sunset pitch a darker sunset.  That is what
# the first build said it wanted and did not do.
#
# WHAT THIS DOES NOT FIX, AND CANNOT.  86.4% of the plate is bare 253 pitch, so
# there is nothing in it to carry depth.  Measured over the six states, its
# internal contrast is sd 32.2 against 61.6 for the next flattest cover and ~76
# for the series, while its mean swings 156.9 levels against 40-76 for every
# photograph -- it does not take too LITTLE hour, it takes far too much of it
# with nothing underneath.  That is the crop, not the grade, and the lever is
# composition: the same capture cropped to the action measures sd 65.7, inside
# the series' range.  No texture is invented here to close that gap.
YOWMINGS = ROOT / "images/cs/yowmings"
PITCH = 253             # the game's own ground, measured: (253,253,253) flat
INK_FLOOR, INK_RAMP, INK_SAT = 22, 40, 1.6   # the outer edge, unchanged
INK_CORE = 130          # strength only real ink reaches; reflections peak at 90


def _strength(plate):
    """Darkness and saturation together: ink is dark OR strongly coloured."""
    red, green, blue = plate.split()
    low = ImageChops.darker(ImageChops.darker(red, green), blue)
    high = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    darkness = ImageChops.invert(low)
    saturation = ImageChops.subtract(high, low).point(lambda v: min(255, round(v * INK_SAT)))
    return ImageChops.lighter(darkness, saturation)


def _fill_holes(binary):
    """Everything not reachable from outside the frame is inside something."""
    padded = Image.new("L", (binary.width + 2, binary.height + 2), 0)
    padded.paste(binary, (1, 1))
    ImageDraw.floodfill(padded, (0, 0), 128)
    return padded.point(lambda v: 0 if v == 128 else 255).crop(
        (1, 1, binary.width + 1, binary.height + 1))


def _reconstruct(cores, silhouette, step=4, limit=400):
    """The components of `silhouette` that contain a core, and only those."""
    kernel = 2 * step + 1
    current = ImageChops.multiply(cores, silhouette)
    for _ in range(limit):
        grown = ImageChops.multiply(current.filter(ImageFilter.MaxFilter(kernel)), silhouette)
        if ImageChops.difference(grown, current).getbbox() is None:
            return grown
        current = grown
    raise RuntimeError("yowmings: the ink reconstruction did not settle")


def _unmatte(plate, alpha):
    """The ink's own colour, with the white pitch divided back out of the edge."""
    out = plate.copy()
    pixels, mask, target = plate.load(), alpha.load(), out.load()
    width, height = plate.size
    for y in range(height):
        for x in range(width):
            weight = mask[x, y]
            if weight == 0 or weight == 255:
                continue                      # ground, or ink already itself
            share = weight / 255.0
            target[x, y] = tuple(
                min(255, max(0, round((value - PITCH * (1 - share)) / share)))
                for value in pixels[x, y])
    return out


def _standing(strength):
    """Everything at or above the lowest real ink in its own column.

    A REFLECTION TOUCHES THE HEAD IT BELONGS TO, so hole-filling and
    reconstruction cannot tell them apart on connectivity alone -- and they
    cannot be told apart on brightness either, because a reflection reaches
    darkness ~88 right under the head while the referee's own face is sealed by
    an outline of only ~53.  Any single threshold that keeps the reflection out
    lets the flood into his face, and vice versa; that collision is measured and
    it is why this exists.  What DOES separate them is that a reflection is
    always below the thing casting it: nothing that is ink extends past the
    lowest core-strength pixel in its column.  The small margin gives each
    object back its own soft bottom edge, and is in image pixels so 1200 and
    2400 are cut in the same place.
    """
    width, height = strength.size
    margin = max(2, round(height / 300))
    standing = Image.new("L", (width, height), 0)
    reading, writing = strength.load(), standing.load()
    for x in range(width):
        floor = -1
        for y in range(height - 1, -1, -1):
            if reading[x, y] >= INK_CORE:
                floor = y
                break
        if floor < 0:
            continue
        for y in range(min(height - 1, floor + margin) + 1):
            writing[x, y] = 255
    return standing


def ink_matte(plate):
    """(alpha, ink): what must not take the hour, and its own colour."""
    strength = _strength(plate)
    edge = strength.point(
        lambda v: 0 if v <= INK_FLOOR else 255 if v >= INK_FLOOR + INK_RAMP
        else round((v - INK_FLOOR) * 255 / INK_RAMP)
    ).filter(ImageFilter.GaussianBlur(.6))
    standing = _standing(strength)
    silhouette = ImageChops.multiply(_fill_holes(edge.point(lambda v: 255 if v else 0)), standing)
    solid = _reconstruct(strength.point(lambda v: 255 if v >= INK_CORE else 0), silhouette)
    # Solid inside, the measured ramp at the edge, nothing more than a pixel
    # outside the silhouette, and nothing at all below the ground line.
    alpha = ImageChops.multiply(
        ImageChops.multiply(
            ImageChops.lighter(solid.filter(ImageFilter.MinFilter(5)), edge),
            solid.filter(ImageFilter.MaxFilter(3)),
        ),
        standing,
    ).filter(ImageFilter.GaussianBlur(.5))
    return alpha, _unmatte(plate, alpha)


def pitch_shading(plate, alpha):
    """The pitch's own reflections, as a multiply, neutralised under the ink."""
    lift = plate.convert("L").point(lambda v: min(255, round(v * 255 / PITCH)))
    gap = ImageChops.subtract(Image.new("L", plate.size, 255), lift)
    return ImageChops.add(lift, ImageChops.multiply(gap, alpha))


def yowmings_state(plate, alpha, ink, shading, state):
    ground = grade(Image.new("RGB", plate.size, (PITCH, PITCH, PITCH)), state)
    lit = ImageChops.multiply(ground, Image.merge("RGB", (shading, shading, shading)))
    return Image.composite(ink, lit, alpha)


def build_yowmings():
    written = []
    for width in (2400, 1200):
        source = YOWMINGS / f"card-{width}.webp"
        if not source.exists():
            raise FileNotFoundError(f"yowmings: the shipped plate moved: {source}")
        plate_image = Image.open(source).convert("RGB")
        assert plate_image.size == (width, width // 2), (source, plate_image.size)
        alpha, ink = ink_matte(plate_image)
        shading = pitch_shading(plate_image, alpha)
        for state in STATES:
            written.append(save(yowmings_state(plate_image, alpha, ink, shading, state),
                                "yowmings", state, width))
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
    # THE SAMPLE FOLLOWS THE CONSTRUCTION, NOT THE NAME.  This read `slug ==
    # "yowmings"` and picked the silhouette sample for it always.  Once yowmings moved
    # onto a photograph (2026-09-01) that mask -- built from the OLD flat capture's ink
    # -- was laid over a plate whose silhouette is now mostly PHOTOGRAPH, so it measured
    # the sky changing between states and called it the product moving: peak 101 against
    # a 60 bound, on a plate that measures 24 when sampled correctly.  A slug with a
    # photograph under it has its product in one rectangle and is cropped; only a plate
    # graded in place needs the mask.
    if slug not in SCENES or slug in MATTE:
        # The ink is scattered over the whole plate rather than sitting in one
        # rectangle, so the sample is taken through a mask instead of a crop --
        # and the mask is the ink's SILHOUETTE, not the pixels the matte happens
        # to hold fully opaque.  That difference is the whole point: the first
        # build's matte was opaque only where the plate was dark or coloured, so
        # sampling its opaque pixels asked "did the parts I already protected
        # stay protected", which is a question that cannot fail.  The referee's
        # cheeks were inside the ink and turning purple, and this check passed.
        # Sampling the silhouette asks the question that matters -- did anything
        # INSIDE a head move -- and the injection below proves it can fail.
        # THE MASK IS THE PRODUCT LAYER'S OWN, so it cannot drift out of register with
        # the thing it is measuring.  It used to be rebuilt here from the 1200-wide
        # capture at full scale; once the matte was scaled to .90 and centred, that
        # mask sat over GRASS at the edges and reported the sky moving as the product
        # moving -- mean 1.11, peak 95, on a layer that is byte-identical by
        # construction.  Asking the layer where it is solid is the same question and
        # cannot fall out of step with it.
        #
        # ONLY WHERE IT IS FULLY OPAQUE, and eroded by 5.  The contact shadow is
        # deliberately translucent, so the graded photograph shows THROUGH it and it
        # is supposed to change between states; sampling it would fail every build.
        # The erosion drops the antialiased rim for the same reason.
        opaque = foreground(slug, frames[0].size).getchannel("A") \
            .point(lambda v: 255 if v >= 250 else 0).filter(ImageFilter.MinFilter(5))
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


def self_test_yowmings():
    """Re-inject the matte the league's plate shipped with, and prove it fails.

    The bug is the whole first construction: one threshold on darkness and
    saturation, the ink replayed unchanged over the graded ground.  It looks
    reasonable and it passed the old check, because the old check sampled the
    pixels that matte held opaque -- the ones it had already got right.  Against
    the silhouette the failure is obvious: the referee's face is inside a head
    and it moves.
    """
    scratch = CACHE / "self-test-yowmings"
    scratch.mkdir(parents=True, exist_ok=True)
    plate = Image.open(YOWMINGS / "card-1200.webp").convert("RGB")
    strength = _strength(plate)
    threshold = strength.point(
        lambda v: 0 if v <= INK_FLOOR else 255 if v >= INK_FLOOR + INK_RAMP
        else round((v - INK_FLOOR) * 255 / INK_RAMP)
    ).filter(ImageFilter.GaussianBlur(.6))
    ink = plate.convert("RGBA")
    ink.putalpha(threshold)                       # <-- the injected mistake
    for state in STATES:
        broken = grade(plate, state).convert("RGBA")
        broken.alpha_composite(ink)
        broken.convert("RGB").save(scratch / f"{state}-1200.webp", "WEBP", quality=84, method=6)
    mean, peak = product_drift("yowmings", scratch)
    assert peak > PRODUCT_DRIFT_PEAK, \
        f"the check cannot fail: the injected matte drifted only {peak} at peak"
    healthy = product_drift("yowmings")
    print(f"self-test: the shipped threshold matte measures mean {mean:.2f} / peak {peak} "
          f"inside the ink silhouette; the matte that ships now measures mean "
          f"{healthy[0]:.2f} / peak {healthy[1]}; threshold {PRODUCT_DRIFT_PEAK}. OK")


def main():
    if "--self-test" in sys.argv:
        self_test()
        self_test_yowmings()
        return
    # YOWMINGS IS NO LONGER THE EXCEPTION.  It used to run build_yowmings(), which
    # grades the shipped game capture in place behind an ink matte -- no photograph
    # under it.  That is exactly what he meant on 2026-09-01 by "the yowmings picture
    # is not consistent either": it was the only card in the band with no photograph,
    # and beside five plates that all are one it read as a different kind of object.
    # It is in SCENES now and takes the same path as the rest.  build_yowmings() and
    # its self-test are kept, unreferenced by default, because the matte work in them
    # is the only thing that knows how to lift the heads off that capture and someone
    # may want it back; `--legacy-yowmings` still runs it.
    if "--legacy-yowmings" in sys.argv:
        for path in build_yowmings():
            print(path.relative_to(ROOT), path.stat().st_size)
        return
    slugs = [a for a in sys.argv[1:] if not a.startswith("--")] or list(SCENES)
    for slug in slugs:
        for path in build(slug):
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
