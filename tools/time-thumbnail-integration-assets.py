#!/usr/bin/env python3
"""Asset contract for the four completed time-aware home thumbnails."""

from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
STATES = ("pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night")
PROJECTS = ("bearings", "apollo", "strata", "cluster")


for project in PROJECTS:
    for state in STATES:
        for width in (1200, 2400):
            path = ROOT / "images" / "cs" / "variants" / "time" / project / f"{state}-{width}.webp"
            assert path.is_file(), path
            with Image.open(path) as image:
                assert image.format == "WEBP", (path, image.format)
                expected_height = 892 if width == 1200 else 1784
                assert image.size == (width, expected_height), (path, image.size)

print("time thumbnail integration assets: OK")
