#!/usr/bin/env python3
"""Asset contract for every completed time-aware Home thumbnail."""

from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
STATES = ("pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night")
PROJECTS = {
    "bearings": {1200: 892, 2400: 1784},
    "apollo": {1200: 892, 2400: 1784},
    "strata": {1200: 892, 2400: 1784},
    "cluster": {1200: 892, 2400: 1784},
    "ucrec": {1200: 891, 2400: 1782},
    "r3shore": {1200: 893, 2400: 1786},
}


for project, heights in PROJECTS.items():
    for state in STATES:
        for width in (1200, 2400):
            path = ROOT / "images" / "cs" / "variants" / "time" / project / f"{state}-{width}.webp"
            assert path.is_file(), path
            with Image.open(path) as image:
                assert image.format == "WEBP", (path, image.format)
                expected_height = heights[width]
                assert image.size == (width, expected_height), (path, image.size)
                assert image.mode == "RGB", (path, image.mode)

print("time thumbnail integration assets: OK")
