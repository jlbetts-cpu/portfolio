#!/usr/bin/env python3
"""Asset contract for every time-aware cover plate that ships.

EVERY PLATE IS 2:1.  This file used to carry a hardcoded height per project --
892 at 1200 for most, 891 for ucrec, 893 for r3shore -- because the first six
covers were cut from 4/3 sources and each landed a pixel or two apart.  Those
plates were re-cut to a clean 2:1 in a later pass and this gate was never moved
with them, so it spent its life asserting the shape the site had stopped
shipping: it failed on bearings/pre-dawn-1200.webp at (1200, 600), which is the
CORRECT size.  A gate that fails on the right answer teaches people to ignore it.

The ratio is the real contract and it is what the builder itself asserts
(tools/build-study-time-thumbnails.py: `image.size == (width, width // 2)`), so
that is what is checked here, for every project rather than six of them.  It
still fails on a plate of the wrong size, a missing state, a stray alpha channel
or a PNG that got renamed .webp.
"""

from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
STATES = ("pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night")
WIDTHS = (1200, 2400)

# EVERY DIRECTORY UNDER variants/time IS CHECKED, rather than a list that has to be
# remembered.  Four covers were added in one day on 2026-09-01 (workspace, headmaker,
# gradientlab, engine) and two more later the same day (yowmings, tournament); a
# hardcoded list would have covered none of them, which is how six of eleven projects
# came to have no asset contract at all.
ROOTDIR = ROOT / "images" / "cs" / "variants" / "time"
projects = sorted(p.name for p in ROOTDIR.iterdir() if p.is_dir())
assert len(projects) >= 6, ("almost nothing to check -- has the variants tree moved?",
                            projects)

checked = 0
for project in projects:
    for state in STATES:
        for width in WIDTHS:
            path = ROOTDIR / project / f"{state}-{width}.webp"
            assert path.is_file(), path
            with Image.open(path) as image:
                assert image.format == "WEBP", (path, image.format)
                assert image.size == (width, width // 2), (path, image.size)
                assert image.mode == "RGB", (path, image.mode)
            checked += 1

print("time thumbnail integration assets: OK -- %d plates across %d projects, all 2:1"
      % (checked, len(projects)))
