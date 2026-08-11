#!/usr/bin/env python3
"""Pull the light background out of the companion heads' cut edges.

WHAT WAS WRONG. The faces are Jayden's own cut-outs, lifted off a light
background, and the lift left the background behind in the edge pixels. Sampled
against the night sky, a hair edge in wink.webp reads

    11 11 11 11 11  83 213 198 152  73   5
    \___ sky ____/  \__ halo ___/  \_ hair _/

-- a 213 spike between an 11 sky and 5 hair, 19x the sky's luminance, sitting in
FULLY OPAQUE pixels rather than in soft alpha. That is matte residue, not a soft
edge, and it is why the head reads with a white rim on the Play page.

WHY IT HAD TO BE FIXED IN THE PIXELS. A night-mode grade takes the worst edge
from 15.3x the sky down to about 4.2x and erosion plateaus near 10x, so CSS gets
close and stops. And CSS filters do not reach the `drawImage` calls in
play-engine.js at all, so during a match the halo comes back at full strength no
matter what the stylesheet says. Below ~3.5x is a pixel job.

WHAT THIS DOES. Edge decontamination, which is the second half of any real matte
extraction: at the alpha boundary the RGB is replaced with colour pulled from
INWARD neighbours, so the edge takes the subject's own colour instead of the
background it was cut from. Alpha is never touched -- the silhouette, and with it
the hand-cut stop-motion character, is exactly the one Jayden drew. Erosion was
considered and rejected: it eats hair, which is the one place the eye is looking.

    * depth(p) = 8-connected distance from p to the nearest pixel that is not
      fully opaque. Soft-alpha pixels are depth 0.
    * CLEAN = fully opaque and depth > --taper. These keep their colour and are
      the only colour source.
    * Everything else with alpha > 0 is refilled by a breadth-first sweep
      outward from CLEAN, each pixel taking the weighted mean of the neighbours
      already decided (orthogonal 2, diagonal 1). Colour therefore flows from the
      interior out to the rim, never the reverse.
    * The refill is blended back by depth: full at the rim, tapering to nothing
      at --taper, so nothing changes abruptly and no hard line appears where the
      treated band ends.

A hair strand thinner than the band has no clean pixel of its own; because the
sweep travels along alpha, it inherits the colour of the mass it grows out of,
which is what a strand of that hair should be. Only a fleck fully detached from
the head has no source at all, and those are counted and reported, not guessed.

    python3 tools/head-matte-decontaminate.py            # rewrite the faces
    python3 tools/head-matte-decontaminate.py --dry-run  # measure, write nothing
    python3 tools/head-matte-decontaminate.py --measure-only

The face list is read out of hero-engine.js's FACES table, not typed here --
typing it is how wink.webp, which is reachable only from an idle fidget, gets
missed. #tongue is added because it is companion artwork cut the same way, even
though the engine swaps it through a different element.
"""

import argparse
import re
import sys
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent

# The near-black ground the halo is read against: the Play page's night sky.
# Any dark ground gives the same verdict; this one is the one Jayden was
# looking at when he said the head "reads poorly".
SKY = (11, 11, 11)

# Only edges whose interior is DARK are counted. A halo against a cheek is
# invisible; a halo against black hair is the whole complaint.
DARK_INTERIOR_MAX = 60.0

# HOW DEEP THE RESIDUE ACTUALLY GOES, measured rather than assumed. Walking in
# from the rim of rest.webp at (225,267): 255 229 213 166 121 40 21 21 21 ...
# The first FIVE opaque pixels are the light background decaying; 21 is the
# hair. smile.webp runs six deep. A two-pixel band -- the first guess -- left
# more than half the ramp behind and only took the worst edge from 15.3x to
# 6.4x. Five full plus a fade to nine covers every ramp in the set with room,
# and nine pixels of an 820px image is about 1.5 device pixels at the size the
# head is actually drawn.
FULL_DEPTH = 5
TAPER_DEPTH = 9
# A pixel is only pulled if it is BRIGHTER than the colour the interior sends
# out. Dark rim pixels are the silhouette and are left exactly alone, so this
# cannot thin the hairline -- the failure mode erosion has and the reason
# erosion was not the move. The gate is soft over this many luminance steps so
# no line appears where it engages.
BRIGHTER_THAN_REFERENCE = 8.0
WEBP_QUALITY = 90
WEBP_METHOD = 6


def luminance(r, g, b):
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


SKY_LUMINANCE = luminance(*SKY)


def face_images():
    """Every image the engine can put in #face, read from the engine's table."""
    engine = (ROOT / "hero-engine.js").read_text(encoding="utf-8")
    table = engine.split("const FACES={", 1)[1].split("\n};", 1)[0]
    names = sorted(set(re.findall(r'"(images/[\w./-]+\.webp)"', table)))
    assert len(names) >= 8, names
    return names


def treated_images():
    names = list(face_images())
    tongue = "images/tongue.webp"
    if tongue not in names:
        names.append(tongue)
    return names


# ── THE MEASUREMENT ──────────────────────────────────────────────────────────
# Sweep in from all four sides, stop at the first pixel that is not fully
# transparent, and read the eleven-pixel profile straddling it composited over
# SKY. Keep the row only where the interior is dark. The reading is the peak of
# the profile as a multiple of the sky -- which is what "a white edge on it"
# means, stated as a number.

def halo_profile(path, step=2):
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    pixels = image.load()
    box = image.getchannel("A").getbbox()
    if not box:
        return None

    def over_sky(x, y):
        r, g, b, a = pixels[x, y]
        f = a / 255.0
        return luminance(r * f + SKY[0] * (1 - f),
                         g * f + SKY[1] * (1 - f),
                         b * f + SKY[2] * (1 - f))

    ratios = []
    worst = None
    for axis, sign in (("x", 1), ("x", -1), ("y", 1), ("y", -1)):
        if axis == "x":
            lanes, low, high = range(box[1], box[3], step), box[0], box[2] - 1
        else:
            lanes, low, high = range(box[0], box[2], step), box[1], box[3] - 1
        for lane in lanes:
            def at(i, lane=lane, axis=axis):
                return (i, lane) if axis == "x" else (lane, i)

            i = low if sign > 0 else high
            while low <= i <= high and pixels[at(i)][3] == 0:
                i += sign
            if not low <= i <= high:
                continue
            if not (low <= i - 5 * sign <= high and low <= i + 8 * sign <= high):
                continue
            inward = [pixels[at(i + k * sign)] for k in range(4, 9)]
            if any(c[3] < 250 for c in inward):
                continue
            interior = sum(luminance(*c[:3]) for c in inward) / len(inward)
            if interior > DARK_INTERIOR_MAX:
                continue
            profile = [over_sky(*at(i + k * sign)) for k in range(-5, 6)]
            ratio = max(profile[:8]) / SKY_LUMINANCE
            ratios.append(ratio)
            if worst is None or ratio > worst[0]:
                worst = (ratio, at(i), interior, profile)
    if not ratios:
        return None
    ratios.sort()

    def quantile(p):
        return ratios[min(len(ratios) - 1, int(len(ratios) * p))]

    return {"n": len(ratios), "max": ratios[-1], "p99": quantile(0.99),
            "p90": quantile(0.90), "median": quantile(0.50), "worst": worst}


def alpha_extent(path):
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    box = image.getchannel("A").getbbox()
    return (box[0] / width, box[1] / height, box[2] / width, box[3] / height)


# ── THE TREATMENT ────────────────────────────────────────────────────────────

def decontaminate(image, full_depth=FULL_DEPTH, taper_depth=TAPER_DEPTH):
    width, height = image.size
    pixels = list(image.getdata())          # flat RGBA tuples
    alpha = [p[3] for p in pixels]

    def index(x, y):
        return y * width + x

    # depth: 8-connected distance to the nearest FULLY TRANSPARENT pixel, with
    # everything off the edge of the canvas counting as transparent so a head
    # that runs off its own frame is treated at that seam too.
    #
    # Measuring from "not fully opaque" instead -- the first attempt -- puts
    # every soft-alpha pixel at depth 0, and the soft band here is two pixels
    # wide. The outer one then has no neighbour deeper than itself, the sweep
    # below has nowhere to pull from, and it stays exactly as contaminated as it
    # started: 16,325 pixels per face declined to settle, including the (240,
    # 240, 240) rim pixel that IS the white edge. Depth has to increase strictly
    # outward-to-inward across the soft band as well as the opaque one.
    INF = 1 << 30
    depth = [INF] * (width * height)
    queue = deque()
    for y in range(height):
        row = y * width
        for x in range(width):
            i = row + x
            if alpha[i] == 0:
                depth[i] = 0
                queue.append(i)
            elif x == 0 or y == 0 or x == width - 1 or y == height - 1:
                depth[i] = 0
                queue.append(i)
    while queue:
        i = queue.popleft()
        d = depth[i] + 1
        x, y = i % width, i // width
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height:
                    j = index(nx, ny)
                    if depth[j] > d:
                        depth[j] = d
                        queue.append(j)

    # ── THE COLOUR SOURCE IS EVERYTHING DEEPER THAN THE RESIDUE ──────────────
    # Nothing shallower can be trusted, because it is the thing being fixed.
    # Seeding the medial ridge as well was tried, so that a feature thinner than
    # twice the band would have a source of its own; it made the set worse
    # (rest.webp 3.8x -> 10.9x) for the reason that should have been obvious --
    # inside a thin feature the ridge IS in the halo, so ridge-seeding hands the
    # sweep the contamination as its reference and spreads it. A feature with no
    # clean core has no recoverable colour, and those pixels are counted as
    # orphans and left alone rather than guessed at.
    NEIGHBOURS = ((-1, 0), (1, 0), (0, -1), (0, 1),
                  (-1, -1), (1, -1), (-1, 1), (1, 1))
    seed = [alpha[i] == 255 and depth[i] > taper_depth
            for i in range(width * height)]

    known_r = [0.0] * (width * height)
    known_g = [0.0] * (width * height)
    known_b = [0.0] * (width * height)
    settled = [False] * (width * height)
    for i in range(width * height):
        if seed[i]:
            r, g, b, _ = pixels[i]
            known_r[i], known_g[i], known_b[i] = r, g, b
            settled[i] = True

    # ── RING BY RING, DEEP TO SHALLOW, AND ONLY EVER FROM DEEPER ─────────────
    # Taking the mean of every settled neighbour lets colour travel SIDEWAYS
    # along a ring, so a bright pixel one step round the rim can supply a dark
    # one. Restricting the source to strictly greater depth makes the flow
    # purely inward-out, and every non-ridge pixel has such a neighbour by
    # definition, so nothing is ever left without a source.
    # Of those sources the DARKEST half is taken, because the halo is a light
    # background bleeding in: at a rim where clean hair and residue are both in
    # reach, the dark one is the hair.
    rings = [[] for _ in range(taper_depth + 1)]
    for i in range(width * height):
        if alpha[i] > 0 and not settled[i] and depth[i] <= taper_depth:
            rings[depth[i]].append(i)
    for d in range(taper_depth, -1, -1):
        for i in rings[d]:
            x, y = i % width, i // width
            sources = []
            for dx, dy in NEIGHBOURS:
                nx, ny = x + dx, y + dy
                if not (0 <= nx < width and 0 <= ny < height):
                    continue
                j = index(nx, ny)
                if settled[j] and depth[j] > d:
                    sources.append((luminance(known_r[j], known_g[j], known_b[j]), j))
            if not sources:
                continue
            sources.sort()
            keep = sources[:max(1, (len(sources) + 1) // 2)]
            known_r[i] = sum(known_r[j] for _, j in keep) / len(keep)
            known_g[i] = sum(known_g[j] for _, j in keep) / len(keep)
            known_b[i] = sum(known_b[j] for _, j in keep) / len(keep)
            settled[i] = True

    # Blend the refill back in by depth: whole at the rim, nothing by taper.
    span = max(1, taper_depth - full_depth)
    out = []
    orphans = 0
    touched = 0
    for i in range(width * height):
        r, g, b, a = pixels[i]
        if a == 0 or seed[i]:
            out.append((r, g, b, a))
            continue
        if not settled[i]:
            orphans += 1
            out.append((r, g, b, a))
            continue
        d = depth[i]
        if d <= full_depth:
            w = 1.0
        else:
            w = max(0.0, 1.0 - (d - full_depth) / float(span))
        # Only pull DOWN toward the interior. A rim pixel darker than the
        # colour flowing out to it is the subject, not the background it was
        # cut from, and nothing here may lighten it.
        excess = luminance(r, g, b) - luminance(known_r[i], known_g[i], known_b[i])
        w *= max(0.0, min(1.0, excess / BRIGHTER_THAN_REFERENCE))
        if w <= 0:
            out.append((r, g, b, a))
            continue
        nr = int(round(r + (known_r[i] - r) * w))
        ng = int(round(g + (known_g[i] - g) * w))
        nb = int(round(b + (known_b[i] - b) * w))
        if (nr, ng, nb) != (r, g, b):
            touched += 1
        out.append((max(0, min(255, nr)), max(0, min(255, ng)),
                    max(0, min(255, nb)), a))

    result = Image.new("RGBA", (width, height))
    result.putdata(out)
    return result, {"touched": touched, "orphans": orphans}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true",
                        help="run the treatment and report, but write nothing")
    parser.add_argument("--measure-only", action="store_true",
                        help="report the halo of the files on disk and stop")
    parser.add_argument("--full-depth", type=int, default=FULL_DEPTH)
    parser.add_argument("--taper", type=int, default=TAPER_DEPTH)
    parser.add_argument("--quality", type=int, default=WEBP_QUALITY)
    args = parser.parse_args()

    names = treated_images()
    worst_before = 0.0
    worst_after = 0.0
    bytes_before = bytes_after = 0

    for name in names:
        path = ROOT / name
        before = halo_profile(path)
        size_before = path.stat().st_size
        bytes_before += size_before
        if before:
            worst_before = max(worst_before, before["p99"])

        if args.measure_only:
            if before:
                ratio, point, interior, profile = before["worst"]
                print(f"{name:28s} n={before['n']:5d} p99={before['p99']:6.2f}x "
                      f"max={before['max']:6.2f}x  worst@{point} "
                      + " ".join(f"{v:.0f}" for v in profile))
            else:
                print(f"{name:28s} no dark edges to read")
            continue

        image = Image.open(path).convert("RGBA")
        cleaned, stats = decontaminate(image, args.full_depth, args.taper)
        if image.getchannel("A").tobytes() != cleaned.getchannel("A").tobytes():
            print(f"{name}: alpha changed, which this tool must never do",
                  file=sys.stderr)
            return 1

        target = path if not args.dry_run else Path("/dev/null")
        scratch = path.with_suffix(".webp.new")
        cleaned.save(scratch, "WEBP", quality=args.quality,
                     method=WEBP_METHOD, exact=True)
        after = halo_profile(scratch)
        size_after = scratch.stat().st_size
        if args.dry_run:
            scratch.unlink()
        else:
            scratch.replace(path)
        bytes_after += size_after
        if after:
            worst_after = max(worst_after, after["p99"])

        b99 = before["p99"] if before else 0.0
        a99 = after["p99"] if after else 0.0
        amax = after["max"] if after else 0.0
        print(f"{name:28s} p99 {b99:6.2f}x -> {a99:5.2f}x   max -> {amax:5.2f}x   "
              f"{size_before:7d} -> {size_after:7d} B   "
              f"touched={stats['touched']:6d} orphans={stats['orphans']}")
        if after:
            print("      after, worst dark edge: "
                  + " ".join(f"{v:.0f}" for v in after["worst"][3]))

    if args.measure_only:
        print(f"\nworst p99 across the set: {worst_before:.2f}x  (sky={SKY_LUMINANCE:.0f})")
        return 0

    print(f"\nworst p99 across the set: {worst_before:.2f}x -> {worst_after:.2f}x"
          f"   bytes {bytes_before} -> {bytes_after} "
          f"({100.0 * (bytes_after - bytes_before) / bytes_before:+.1f}%)")
    print("data-head-bounds must now be recomputed: "
          "python3 tools/hero-head-transform-contract.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
