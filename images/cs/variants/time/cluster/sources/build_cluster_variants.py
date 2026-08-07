#!/usr/bin/env python3
"""Deterministically composite and encode the Cluster time-of-day thumbnails."""

from __future__ import annotations

import hashlib
import json
import math
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageOps


ROOT = Path(__file__).resolve().parents[6]
OUT = ROOT / "images/cs/variants/time/cluster"
SOURCES = OUT / "sources"
MASTER = ROOT / "images/cs/masters/cluster-mockups.png"
STATES = ("pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night")
CANVAS_SIZE = (2400, 1784)
MOBILE_SIZE = (1200, 892)
MOCKUP_SIZE = (1313, 912)
MOCKUP_POSITION = (543, 436)
DESKTOP_QUALITIES = (90, 89, 88, 87, 86, 85, 84)
DESKTOP_LIMIT = 700 * 1024
MOBILE_QUALITY = 88


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def psnr(reference: Image.Image, encoded_path: Path) -> float:
    with Image.open(encoded_path) as encoded:
        difference = ImageChops.difference(reference.convert("RGB"), encoded.convert("RGB"))
    histogram = difference.histogram()
    squared_error = sum((value % 256) ** 2 * count for value, count in enumerate(histogram))
    mse = squared_error / (reference.width * reference.height * 3)
    return math.inf if mse == 0 else 10.0 * math.log10((255.0**2) / mse)


def encode_webp(source_png: Path, output: Path, quality: int) -> None:
    subprocess.run(
        [
            "cwebp",
            "-quiet",
            "-m",
            "6",
            "-pass",
            "10",
            "-sharp_yuv",
            "-metadata",
            "none",
            "-q",
            str(quality),
            str(source_png),
            "-o",
            str(output),
        ],
        check=True,
    )


def webpmux_features(path: Path) -> str:
    result = subprocess.run(
        ["webpmux", "-info", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return (result.stdout + result.stderr).strip()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    SOURCES.mkdir(parents=True, exist_ok=True)

    with Image.open(MASTER) as source_master:
        if source_master.size != (2454, 1704) or source_master.mode != "RGBA":
            raise RuntimeError(f"Unexpected Cluster master: {source_master.size} {source_master.mode}")
        # The only foreground transformation is this single deterministic geometric downscale.
        resized_mockup = source_master.resize(MOCKUP_SIZE, Image.Resampling.LANCZOS)

    resized_mockup.save(SOURCES / "mockup-resized-1313x912.png", optimize=True)
    opaque_mask = resized_mockup.getchannel("A").point(lambda value: 255 if value == 255 else 0)
    opaque_pixel_count = opaque_mask.histogram()[255]
    expected_rgb = resized_mockup.convert("RGB")

    metrics: dict[str, object] = {
        "pipeline": {
            "canvas": list(CANVAS_SIZE),
            "mobile": list(MOBILE_SIZE),
            "master": str(MASTER.relative_to(ROOT)),
            "master_dimensions": [2454, 1704],
            "master_sha256": sha256(MASTER),
            "mockup_resize": list(MOCKUP_SIZE),
            "mockup_position": list(MOCKUP_POSITION),
            "resampling": "Pillow Lanczos",
            "encoder": "cwebp -m 6 -pass 10 -sharp_yuv -metadata none",
            "opaque_pixel_count": opaque_pixel_count,
        },
        "states": {},
    }
    opaque_checks: list[bool] = []

    with tempfile.TemporaryDirectory(prefix="cluster-variants-") as temp_dir:
        temp = Path(temp_dir)
        for state in STATES:
            plate_path = SOURCES / f"{state}-generated.png"
            with Image.open(plate_path) as plate:
                plate_dimensions = list(plate.size)
                fitted = ImageOps.fit(
                    plate.convert("RGB"),
                    CANVAS_SIZE,
                    method=Image.Resampling.LANCZOS,
                    centering=(0.5, 0.5),
                ).convert("RGBA")

            overlay = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
            overlay.alpha_composite(resized_mockup, dest=MOCKUP_POSITION)
            composite = Image.alpha_composite(fitted, overlay).convert("RGB")
            desktop_png = temp / f"{state}-2400.png"
            composite.save(desktop_png, compress_level=1)

            crop = composite.crop(
                (
                    MOCKUP_POSITION[0],
                    MOCKUP_POSITION[1],
                    MOCKUP_POSITION[0] + MOCKUP_SIZE[0],
                    MOCKUP_POSITION[1] + MOCKUP_SIZE[1],
                )
            )
            opaque_difference = ImageChops.difference(crop, expected_rgb)
            masked_difference = Image.new("RGB", MOCKUP_SIZE)
            masked_difference.paste(opaque_difference, mask=opaque_mask)
            opaque_matches = masked_difference.getbbox() is None
            if not opaque_matches:
                raise RuntimeError(f"Opaque master pixels changed in {state}")
            opaque_checks.append(opaque_matches)

            desktop_output = OUT / f"{state}-2400.webp"
            desktop_quality = DESKTOP_QUALITIES[-1]
            for candidate in DESKTOP_QUALITIES:
                encode_webp(desktop_png, desktop_output, candidate)
                desktop_quality = candidate
                if desktop_output.stat().st_size < DESKTOP_LIMIT:
                    break
            if desktop_output.stat().st_size >= DESKTOP_LIMIT:
                raise RuntimeError(f"Desktop output exceeds limit: {desktop_output}")

            mobile = composite.resize(MOBILE_SIZE, Image.Resampling.LANCZOS)
            mobile_png = temp / f"{state}-1200.png"
            mobile.save(mobile_png, compress_level=1)
            mobile_output = OUT / f"{state}-1200.webp"
            encode_webp(mobile_png, mobile_output, MOBILE_QUALITY)

            with Image.open(desktop_output) as desktop_check, Image.open(mobile_output) as mobile_check:
                if desktop_check.size != CANVAS_SIZE or mobile_check.size != MOBILE_SIZE:
                    raise RuntimeError(f"Wrong encoded dimensions for {state}")

            desktop_features = webpmux_features(desktop_output)
            mobile_features = webpmux_features(mobile_output)
            if "No features present" not in desktop_features or "No features present" not in mobile_features:
                raise RuntimeError(f"Unexpected WebP metadata/features for {state}")

            metrics["states"][state] = {
                "plate": str(plate_path.relative_to(ROOT)),
                "plate_dimensions": plate_dimensions,
                "desktop": {
                    "path": str(desktop_output.relative_to(ROOT)),
                    "dimensions": list(CANVAS_SIZE),
                    "bytes": desktop_output.stat().st_size,
                    "quality": desktop_quality,
                    "psnr_db_rgb": round(psnr(composite, desktop_output), 3),
                    "webpmux": desktop_features,
                    "sha256": sha256(desktop_output),
                },
                "mobile": {
                    "path": str(mobile_output.relative_to(ROOT)),
                    "dimensions": list(MOBILE_SIZE),
                    "bytes": mobile_output.stat().st_size,
                    "quality": MOBILE_QUALITY,
                    "psnr_db_rgb": round(psnr(mobile, mobile_output), 3),
                    "webpmux": mobile_features,
                    "sha256": sha256(mobile_output),
                },
            }

    invariant = all(opaque_checks)
    if not invariant:
        raise RuntimeError("Cross-state opaque mockup invariant failed")
    metrics["pipeline"]["opaque_pixels_byte_identical_across_states"] = invariant
    metrics["pipeline"]["opaque_pixels_match_resized_master"] = True

    (SOURCES / "build-metrics.json").write_text(
        json.dumps(metrics, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
