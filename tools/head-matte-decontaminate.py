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
matter what the stylesheet says.

WHAT THIS DOES. Edge decontamination, which is the second half of any real matte
extraction: at the alpha boundary the RGB is replaced with colour pulled from
INWARD neighbours, so the edge takes the subject's own colour instead of the
background it was cut from. Alpha is never touched -- the silhouette, and with it
the hand-cut stop-motion character, is exactly the one Jayden drew, and
data-head-bounds (which is derived from alpha) therefore does not move. Erosion
was considered and rejected: it eats hair, which is the one place the eye is
looking.

    * depth(p) = 8-connected distance from p to the nearest pixel that is not
      opaque, with everything off the edge of the canvas counting as
      transparent so a head running off its own frame is treated at that seam.
    * CLEAN = fully opaque and depth > --taper. These keep their colour and are
      the only colour source.
    * Everything else with alpha > 0 is refilled by a breadth-first sweep
      travelling ALONG ALPHA outward from CLEAN, each pixel taking the mean of
      the darkest half of the neighbours already decided. Colour therefore flows
      from the interior out to the rim, never the reverse, and a hair strand too
      thin to hold a clean pixel of its own inherits the colour of the mass it
      grows out of, which is what a strand of that hair should be.
    * The refill is blended back by depth: full at the rim, tapering to nothing
      at --taper, so nothing changes abruptly and no line appears where the
      treated band ends.

TWO THINGS THIS FILE GOT WRONG BEFORE IT HAD EVER BEEN RUN, both found by
running it, and both recorded here because the numbers that replaced them are
the only reason the current settings are what they are.

  * THE SWEEP WENT BY DEPTH RING, NOT ALONG ALPHA. Sources were restricted to
    strictly greater depth, which sounds like the same thing and is not: a hair
    strand with no pixel deep enough to seed had no source at all and kept its
    rim untouched. That was 12,159 pixels on rest.webp and 19,826 on
    tongue.webp -- 46% of everything the tool set out to fix -- and it held the
    worst face at 12.1x when the whole point was to get near 3x. Sweeping along
    alpha from the seeds takes the orphan count to zero.

  * THE BAND WAS FIVE DEEP FADING TO NINE, so the colour handed to the rim came
    from ten pixels inside. Measured, the residue ramp is about three: at
    rest.webp (225,267) the walk in reads 254 229 213 165 121 39 21 21 -- clean
    by the fourth opaque pixel. Ten pixels in is a DIFFERENT PART OF THE
    SUBJECT: at the shoulder it is lit cloth at luminance 151, and the tool was
    dutifully painting that over a genuinely dark rim at 40. Three full, fading
    to five, sources the rim from the colour actually beside it and takes the
    median edge from 10.4x to 1.0x.

WHAT THE NUMBERS MEAN, because two of them look like failures and are not. The
reading is the brightest pixel of the profile as a multiple of the SKY, and the
sky is luminance 11. An edge whose subject is genuinely mid-grey therefore
cannot read below its own colour over 11 -- a rim sitting correctly on cloth at
luminance 58 reads 5.3x with no halo left on it whatsoever. So the absolute
ratio has a floor that varies per edge, and the tail of the distribution is made
of edges at that floor rather than edges still carrying background. The honest
halo measure is the second one printed here, PEAK OVER THE SUBJECT'S OWN
INTERIOR: 1.0x means the rim is the same colour as the thing it is the rim of,
which is what "no halo" actually means. Before treatment that runs to 10x.

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

# HOW DEEP THE RESIDUE ACTUALLY GOES, measured rather than assumed -- see the
# second correction in the docstring. Three full, fading to five.
FULL_DEPTH = 3
TAPER_DEPTH = 5
# A pixel is only pulled if it is BRIGHTER than the colour the interior sends
# out. Dark rim pixels are the silhouette and are left exactly alone, so this
# cannot thin the hairline -- the failure mode erosion has and the reason
# erosion was not the move. The gate is soft over this many luminance steps so
# no line appears where it engages.
BRIGHTER_THAN_REFERENCE = 8.0
# The originals were encoded at about q80: re-encoding rest.webp's ORIGINAL
# pixels at 90 gives 46,864B against the 30,660B it ships as, so the +35% the
# first settings produced was the quality knob and not the treatment. At 80 the
# treated files come out SMALLER than the originals, because a rim that agrees
# with its interior costs the encoder less than one that fights it.
WEBP_QUALITY = 80
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
# SKY. Keep the row only where the interior is dark. Two readings come back: the
# peak over the SKY, which is what "a white edge on it" means as a number but
# carries a per-edge floor, and the peak over the edge's OWN INTERIOR, which is
# the halo with that floor divided out.

def halo_profile(path, step=2):
    image = Image.open(path).convert("RGBA")
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
    over_interior = []
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
            peak = max(profile[:8])
            ratio = peak / SKY_LUMINANCE
            ratios.append(ratio)
            # The subject's own colour is the floor this edge could ever reach.
            # Below it the reading says the rim is darker than the head, which
            # is a fringe and would be its own bug.
            over_interior.append(peak / max(interior, SKY_LUMINANCE))
            if worst is None or ratio > worst[0]:
                worst = (ratio, at(i), interior, profile)
    if not ratios:
        return None
    ratios.sort()
    over_interior.sort()

    def quantile(values, p):
        return values[min(len(values) - 1, int(len(values) * p))]

    return {"n": len(ratios), "max": ratios[-1],
            "p99": quantile(ratios, 0.99), "p90": quantile(ratios, 0.90),
            "median": quantile(ratios, 0.50),
            "own_p99": quantile(over_interior, 0.99),
            "own_median": quantile(over_interior, 0.50),
            "worst": worst}


# ── THE TREATMENT ────────────────────────────────────────────────────────────

def decontaminate(image, full_depth=FULL_DEPTH, taper_depth=TAPER_DEPTH):
    width, height = image.size
    pixels = list(image.getdata())          # flat RGBA tuples
    alpha = [p[3] for p in pixels]
    count = width * height

    # depth: 8-connected distance to the nearest FULLY TRANSPARENT pixel, with
    # everything off the edge of the canvas counting as transparent.
    #
    # Measuring from "not fully opaque" instead -- the first attempt -- puts
    # every soft-alpha pixel at depth 0, and the soft band here is two pixels
    # wide. The outer one then has no neighbour deeper than itself, the sweep
    # below has nowhere to pull from, and it stays exactly as contaminated as it
    # started. Depth has to increase strictly outward-to-inward across the soft
    # band as well as the opaque one.
    INF = 1 << 30
    depth = [INF] * count
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
        for dy in (-1, 0, 1):
            ny = y + dy
            if not 0 <= ny < height:
                continue
            base = ny * width
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                nx = x + dx
                if not 0 <= nx < width:
                    continue
                j = base + nx
                if depth[j] > d:
                    depth[j] = d
                    queue.append(j)

    # ── THE COLOUR SOURCE IS EVERYTHING DEEPER THAN THE RESIDUE ──────────────
    # Nothing shallower can be trusted, because it is the thing being fixed.
    seed = [alpha[i] == 255 and depth[i] > taper_depth for i in range(count)]
    known_r = [0.0] * count
    known_g = [0.0] * count
    known_b = [0.0] * count
    settled = [False] * count
    for i in range(count):
        if seed[i]:
            r, g, b, _ = pixels[i]
            known_r[i], known_g[i], known_b[i] = r, g, b
            settled[i] = True

    # ── THE SWEEP TRAVELS ALONG ALPHA, OUTWARD FROM THE SEEDS ────────────────
    # Breadth-first from the clean interior, so every pixel is decided only
    # after the neighbours between it and the interior have been. Going by depth
    # ring instead -- sources restricted to strictly greater depth -- looks
    # equivalent and orphans every feature too thin to hold a seed, which on
    # this set was 46% of the pixels being treated. Only a fleck with no path to
    # any seed is left alone now, and those are counted rather than guessed at.
    order = []
    seen = [False] * count
    queue = deque()
    for i in range(count):
        if seed[i]:
            seen[i] = True
            queue.append(i)
    while queue:
        i = queue.popleft()
        x, y = i % width, i // width
        for dy in (-1, 0, 1):
            ny = y + dy
            if not 0 <= ny < height:
                continue
            base = ny * width
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                nx = x + dx
                if not 0 <= nx < width:
                    continue
                j = base + nx
                if not seen[j] and alpha[j] > 0:
                    seen[j] = True
                    order.append(j)
                    queue.append(j)

    # Of the settled neighbours the DARKEST HALF is taken, because the halo is a
    # light background bleeding in: at a rim where clean hair and residue are
    # both in reach, the dark one is the hair. Neighbours strictly deeper are
    # preferred where they exist, so the flow is inward-out wherever the shape
    # allows it, and only a feature with no deeper neighbour at all falls back
    # to its siblings.
    NEIGHBOURS = ((-1, 0), (1, 0), (0, -1), (0, 1),
                  (-1, -1), (1, -1), (-1, 1), (1, 1))
    for i in order:
        x, y = i % width, i // width
        d = depth[i]
        deeper = []
        any_settled = []
        for dx, dy in NEIGHBOURS:
            nx, ny = x + dx, y + dy
            if not (0 <= nx < width and 0 <= ny < height):
                continue
            j = ny * width + nx
            if not settled[j]:
                continue
            entry = (luminance(known_r[j], known_g[j], known_b[j]), j)
            any_settled.append(entry)
            if depth[j] > d:
                deeper.append(entry)
        sources = deeper or any_settled
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
    for i in range(count):
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
    worst_before = worst_after = 0.0
    own_before = own_after = 0.0
    bytes_before = bytes_after = 0

    for name in names:
        path = ROOT / name
        before = halo_profile(path)
        size_before = path.stat().st_size
        bytes_before += size_before
        if before:
            worst_before = max(worst_before, before["p99"])
            own_before = max(own_before, before["own_p99"])

        if args.measure_only:
            if before:
                ratio, point, interior, profile = before["worst"]
                print(f"{name:28s} n={before['n']:5d} p99={before['p99']:6.2f}x "
                      f"max={before['max']:6.2f}x own_p99={before['own_p99']:6.2f}x "
                      f" worst@{point} "
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

        scratch = path.with_suffix(".webp.new")
        cleaned.save(scratch, "WEBP", quality=args.quality,
                     method=WEBP_METHOD, exact=True)
        # THE ASSERTION THAT ACTUALLY PROTECTS data-head-bounds. Checking the
        # in-memory result proves the algorithm did not touch alpha; it says
        # nothing about what the encoder did. The attribute is derived from the
        # alpha of the files ON DISK, so the file on disk is what has to match.
        encoded = Image.open(scratch).convert("RGBA")
        if encoded.getchannel("A").tobytes() != image.getchannel("A").tobytes():
            scratch.unlink()
            print(f"{name}: the encoder moved alpha; data-head-bounds would "
                  f"have to be recomputed and this tool cannot do that quietly",
                  file=sys.stderr)
            return 1

        after = halo_profile(scratch)
        size_after = scratch.stat().st_size
        if args.dry_run:
            scratch.unlink()
        else:
            scratch.replace(path)
        bytes_after += size_after
        if after:
            worst_after = max(worst_after, after["p99"])
            own_after = max(own_after, after["own_p99"])

        print(f"{name:28s} p99 {before['p99']:6.2f}x -> {after['p99']:5.2f}x   "
              f"median {before['median']:5.2f}x -> {after['median']:4.2f}x   "
              f"over own interior {before['own_p99']:5.2f}x -> {after['own_p99']:4.2f}x   "
              f"{size_before:7d} -> {size_after:7d} B   "
              f"touched={stats['touched']:6d} orphans={stats['orphans']}")
        print("      after, worst dark edge: "
              + " ".join(f"{v:.0f}" for v in after["worst"][3]))

    if args.measure_only:
        print(f"\nworst p99 across the set: {worst_before:.2f}x  "
              f"(sky={SKY_LUMINANCE:.0f}); over own interior {own_before:.2f}x")
        return 0

    print(f"\nworst p99 across the set: {worst_before:.2f}x -> {worst_after:.2f}x"
          f"   over own interior {own_before:.2f}x -> {own_after:.2f}x"
          f"   bytes {bytes_before} -> {bytes_after} "
          f"({100.0 * (bytes_after - bytes_before) / bytes_before:+.1f}%)")
    print("alpha is asserted unchanged both in memory and on disk, so "
          "data-head-bounds does not move; hero-head-transform-contract.py "
          "re-derives it from these files and will say so.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
