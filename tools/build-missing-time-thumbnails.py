#!/usr/bin/env python3
"""Build UC Davis and R3SHORE time variants while preserving UI pixels."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
UCD_SOURCE = ROOT / "images/cs/ucrec/cover.webp"
R3_SOURCE = ROOT / "images/cs/r3shore.webp"
UCD_UI = Path("/tmp/portfolio-mockups.qDtoJq/Group 707.png")
OUT = ROOT / "images/cs/variants/time"
STATES = ("pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night")

PALETTES = {
    "pre-dawn": ((72, 111, 253), (196, 137, 255), .74, .28),
    "sunrise": ((203, 131, 255), (255, 185, 119), .96, .24),
    "daytime": ((0, 113, 193), (180, 216, 255), 1.02, .08),
    "dusk": ((99, 112, 168), (255, 179, 106), .82, .25),
    "sunset": ((221, 120, 162), (255, 165, 119), .82, .29),
    "night": ((20, 30, 75), (69, 59, 179), .36, .38),
}


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


def resize_cover(image, width):
    height = round(width * image.height / image.width)
    return image.resize((width, height), Image.Resampling.LANCZOS)


def ucd_foreground(size):
    if not UCD_UI.exists():
        raise FileNotFoundError(f"Missing extracted source mockup: {UCD_UI}")
    width, height = size
    # Measured from the approved 1600x1200 cover; keeping this transform fixed
    # makes every state share byte-identical UI pixels.
    group_width = round(width * .56)
    group_height = round(group_width * 1748 / 2508)
    x = round(width * .22)
    y = round(height * .235)
    ui = Image.open(UCD_UI).convert("RGBA").resize((group_width, group_height), Image.Resampling.LANCZOS)
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    layer.alpha_composite(ui, (x, y))
    return layer


def r3_foreground(source, size):
    scaled = source.resize(size, Image.Resampling.LANCZOS).convert("RGBA")
    width, height = size
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle(
        (round(width * .143), round(height * .237), round(width * .861), round(height * .760)),
        radius=round(width * .014), fill=255,
    )
    # A two-pixel feather protects the antialiased mockup edge without creating
    # a hard pasted-on seam against the newly graded background.
    mask = mask.filter(ImageFilter.GaussianBlur(max(1, width / 1200)))
    scaled.putalpha(mask)
    return scaled


def save_variant(image, project, state, width):
    target = OUT / project / f"{state}-{width}.webp"
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "WEBP", quality=88, method=6, exact=True, exif=b"", icc_profile=None)
    return target


def build_project(project, source_path, foreground_factory):
    source = Image.open(source_path).convert("RGB")
    for width in (2400, 1200):
        original = resize_cover(source, width)
        foreground = foreground_factory(original, original.size)
        for state in STATES:
            background = grade(original, state).convert("RGBA")
            background.alpha_composite(foreground)
            save_variant(background.convert("RGB"), project, state, width)


def main():
    build_project("ucrec", UCD_SOURCE, lambda _source, size: ucd_foreground(size))
    build_project("r3shore", R3_SOURCE, r3_foreground)
    for project in ("ucrec", "r3shore"):
        paths = sorted((OUT / project).glob("*.webp"))
        assert len(paths) == 12, (project, len(paths))
        for path in paths:
            with Image.open(path) as image:
                expected_width = int(path.stem.rsplit("-", 1)[1])
                assert image.width == expected_width, path
                assert image.format == "WEBP", path
    print("UC Davis and R3SHORE time thumbnails: OK")


if __name__ == "__main__":
    main()
