#!/usr/bin/env python3
"""Rebuild the "jb" brand mark and the favicon set from Molle's glyph outlines.

WHY OUTLINES AND NOT TEXT
  A favicon cannot reference a webfont at all, and a header mark set as live text
  either needs a Google Fonts request -- this site self-hosts its faces and makes
  no external font requests -- or flashes and reflows while the font loads. So the
  typeface is a BUILD-TIME input: fontTools reads the `j` and `b` contours once,
  here, and everything downstream is plain SVG geometry.

WHAT "CHECK THE WEIGHT" TURNED OUT TO MEAN
  Molle ships exactly one weight and one style. Measured from the TTF:
  OS/2.usWeightClass 400, post.italicAngle -22.0, and Google's CSS API only
  resolves `family=Molle:ital@1` -- plain `family=Molle` answers "Font family not
  found". There is no weight to pick. The question is whether the one weight HOLDS
  small, and it does not: rendered at 16px the raw outlines measure 0.80px at their
  thinnest join (sub-pixel), and the two letters collapse into one grey blob.

  So the mark is an OPTICAL RAMP, not one drawing scaled -- the same move a type
  designer makes for a small optical size, and the same point Apple's typography
  talk makes about type changing shape with size:
    TRACKING  +0.06em at display sizes, opening to +0.24em at 16px, so the j's
              swash stops colliding with the b's bowl and each letter resolves.
    EMBOLDEN  a same-colour stroke over the fill -- a true optical embolden, not a
              second colour -- tapering to zero by 180px.
  Cropping the composition to enlarge the letters was tried and REJECTED: it eats
  the j's descender and the mark then reads "ib". The swash is the j.

LICENCE
  Molle is SIL Open Font License 1.1 (name ID 14: http://scripts.sil.org/OFL).
  The OFL permits deriving artwork from the outlines and using it as a logo; there
  is no attribution requirement for rendered output, and the only real restriction
  -- that you may not sell the font itself or release a derivative under a
  reserved name -- is not engaged here. The repo ships the DERIVED PATHS only, not
  the font binary, so the OFL's bundling clause never applies either.

USAGE
  tools/build-jb-mark.py            rebuild favicons + print the header path
  tools/build-jb-mark.py --check    verify the shipped files match a fresh build
"""

import argparse
import subprocess
import sys
from pathlib import Path

from fontTools.misc.transform import Transform
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path.home() / ".cache" / "jb-mark"
TTF = CACHE / "molle.ttf"
TTF_URL = "https://fonts.gstatic.com/s/molle/v25/E21n_dL5hOXFhWEsXzg.ttf"

INK, PAPER = "#121212", "#F1F1F1"
J_ADVANCE = 519                      # Molle's own advance for `j`, in font units

# size -> (tracking in /2048em units, embolden in 30-unit-viewBox units, margin fraction)
RAMP = {
    16:  (500, 1.35, 0.04),
    32:  (300, 0.75, 0.08),
    48:  (200, 0.55, 0.09),
    96:  (150, 0.25, 0.10),
    180: (120, 0.00, 0.10),
    192: (120, 0.00, 0.10),
}
DISPLAY_TRACK = 120                  # the header and footer mark
# The SVG favicon is ONE drawing for every size, so it cannot ride the ramp. It is
# tuned between the 16 and 32 rungs, because that is the band tabs actually paint
# it in (16 CSS px, 32 device px on HiDPI) -- biased small, since a mark that is
# slightly heavy at 32 still reads and one that is light at 16 does not.
SVG_FAVICON = (400, 1.05, 0.06)


def font():
    if not TTF.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        print(f"fetching Molle (SIL OFL 1.1) -> {TTF}")
        subprocess.run(["curl", "-sSLf", "-o", str(TTF), TTF_URL], check=True)
    f = TTFont(TTF)
    assert f["OS/2"].usWeightClass == 400, "Molle is expected to ship one weight"
    assert round(f["post"].italicAngle) == -22, "Molle is expected to be italic-only"
    return f


def outline(track, box=30.0, ndigits=2):
    """The two glyphs set with `track` extra advance, fitted to a `box` square."""
    f = font()
    gs, cm = f.getGlyphSet(), f.getBestCmap()

    def rec(ch):
        p = RecordingPen()
        gs[cm[ord(ch)]].draw(p)
        return p

    items = [("j", Transform()), ("b", Transform().translate(J_ADVANCE + track, 0))]
    bp = BoundsPen(gs)
    for ch, tx in items:
        rec(ch).replay(TransformPen(bp, tx))
    x0, y0, x1, y1 = bp.bounds
    w, h = x1 - x0, y1 - y0
    s = box / max(w, h)
    fit = Transform(s, 0, 0, -s, (box - w * s) / 2 - x0 * s, (box - h * s) / 2 + y1 * s)
    sp = SVGPathPen(gs, ntos=lambda v: f"{round(v, ndigits):g}")
    for ch, tx in items:
        rec(ch).replay(TransformPen(sp, fit.transform(tx)))
    return sp.getCommands()


def tile_svg(track, embolden, margin):
    """Favicon artwork: an ink tile with the mark knocked out in paper."""
    m = 30 * margin
    side = round(30 + 2 * m, 2)
    w = embolden * side / 30.0
    stroke = (f' stroke="{PAPER}" stroke-width="{round(w, 3)}"'
              f' stroke-linejoin="round" stroke-linecap="round"') if embolden else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-m} {-m} {side} {side}">'
            f'<rect x="{-m}" y="{-m}" width="{side}" height="{side}" fill="{INK}"/>'
            f'<path fill="{PAPER}"{stroke} d="{outline(track)}"/></svg>')


def render(out_dir):
    """Chromium rasterises each PNG natively at its target size. A supersample plus
    a Lanczos downscale was tried and rings visibly at 16px."""
    from playwright.sync_api import sync_playwright
    from PIL import Image

    out_dir.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 400, "height": 400}, device_scale_factor=1)
        for size, spec in RAMP.items():
            pg.set_content(
                f'<style>*{{margin:0}}svg{{display:block;width:{size}px;height:{size}px}}</style>'
                + tile_svg(*spec))
            pg.locator("svg").screenshot(path=str(out_dir / f"favicon-{size}.png"))
        b.close()
    # One SVG for browsers that prefer it; the raster set stays complete for Safari
    # and older Chrome, which is why this is an addition and not a replacement.
    (out_dir / "favicon.svg").write_text(tile_svg(*SVG_FAVICON) + "\n")
    # Multi-resolution ICO at the three sizes Windows and older Chrome actually pull.
    Image.open(out_dir / "favicon-48.png").convert("RGBA").save(
        out_dir / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    return sorted(p.name for p in out_dir.iterdir())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="verify the shipped files match a fresh build")
    args = ap.parse_args()

    display = outline(DISPLAY_TRACK)
    target = ROOT / ("_jb-mark-check" if args.check else ".")

    if args.check:
        import filecmp
        import shutil
        tmp = ROOT / "_jb-mark-check"
        try:
            names = render(tmp)
            bad = [n for n in names
                   if not (ROOT / n).exists() or not filecmp.cmp(tmp / n, ROOT / n, shallow=False)]
            # the .ico embeds a timestamp-free but encoder-dependent stream; compare size only
            bad = [n for n in bad if n != "favicon.ico"
                   or (ROOT / n).stat().st_size != (tmp / n).stat().st_size]
            html = (ROOT / "index.html").read_text()
            if display not in html:
                bad.append("index.html (header mark path is stale)")
            if bad:
                print("FAIL -- these do not match a fresh build:")
                for n in bad:
                    print("   ", n)
                return 1
            print(f"PASS -- {len(names)} generated files match a fresh build, "
                  f"and the header path in index.html is current.")
            return 0
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    names = render(ROOT)
    print("wrote:", ", ".join(names))
    print("\nheader/footer mark path (viewBox 0 0 30 30):\n")
    print(display)
    return 0


if __name__ == "__main__":
    sys.exit(main())
