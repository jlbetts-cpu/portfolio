#!/usr/bin/env python3
"""Does the head maker's bake() leave the photo's background on the cut edge?

WHY THIS EXISTS. `tools/head-matte-decontaminate.py` fixed the ten stock faces
in `images/`, and it fixed them in the pixels, once, offline. Nothing has ever
measured the OTHER source of companion heads: the ones a visitor bakes in
headmaker.html. Jayden reported "the rest still have the white outline" and the
stock faces measured clean (worst fringe 0.82x its own interior), so the heads
still carrying a rim had to be his own bakes.

WHAT THE OLD BAKE ACTUALLY WAS. Not an anti-aliased fringe: `bake()` drew the
photograph and cut it with an oval, and the oval is a head SHAPE while a real
head is narrower than it everywhere below the cheekbones. Measured on three
painted portraits, HALF the cut's alpha mass was the room behind the person --
50.2%, 50.7%, 50.1% -- and on a near-black sky that is a bright band tracing the
silhouette. The ten stock faces in images/ are true hand-cut mattes and read
clean, which is exactly why one face looked right and the rest did not.

WHAT THIS MEASURES. It drives the page's real file picker and its real step
buttons -- the script is a strict-mode IIFE and this tool adds no hook to reach
inside it -- reads the cut back off `#hmCut`, and bakes the SAME subjects
through the pinned BASELINE revision so every number is a before and an after.

  WALL   how much of the photograph's background is still in the cut, by
         colour, alpha-weighted. Exact, because these subjects are painted.
  KEPT   how much of the subject's own hair and skin survived, against the
         baseline. This is the bald-head guard, and it is here because the
         first working version of the matte anchored on the top border -- which
         at a head-fills-the-oval framing is HAIR -- and shaved the person bald
         while every other number in this tool improved.
  HOLES  transparent pixels inside the silhouette's own span, for the subject
         whose background the matte must REFUSE.
  RIM    the boundary band over the subject behind it, the same statistic
         head-matte-decontaminate.py calls "over own interior".

Every number is worst-case, never median: a previous pass on this class of bug
reported a median of 1.00 with a 5.89 tail and Jayden could still see the line.

    python3 tools/head-cut-fringe-contract.py            # measure and assert
    python3 tools/head-cut-fringe-contract.py --write-artifacts DIR
    python3 tools/head-cut-fringe-contract.py --self-test

`--self-test` asserts that the BASELINE bake fails this tool. The seam is a real
earlier revision rather than a runtime flag, so production carries nothing that
exists only for a test, and every run is already the bisect against a pristine
tree that any "regression" claim on this file needs.

Serves the repo root on 127.0.0.1 on an ephemeral port -- never `localhost`,
which on this machine resolves into another session's worktree -- and drives a
headless Chromium with its own empty storage, so it cannot see or write the
`hmCompanions` / `hmCompanion` keys that hold Jayden's real baked heads. Only
the file picker and the step buttons are driven; the save button is never
clicked.
"""

import argparse
import base64
import io
import subprocess
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from PIL import Image, ImageDraw, ImageFilter
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

# The near-black ground Jayden reports the halo against: the Play page's sky.
SKY = (11, 11, 11)
# THE PRIMARY ASSERTION: how much of the photograph's background may survive
# inside the cut, as a share of the cut's alpha mass. The old bake left 40-60%.
WALL_LIMIT = 0.06
# THE SECONDARY ASSERTION, and the looser one on purpose. The rim statistic
# sweeps in from the frame edge and reads the FIRST pixel with any alpha, which
# on a true matte is frequently the tip of a hair wisp -- a pixel that is
# genuinely a third hair and two thirds room, whose honest composite over the
# night sky is a grey wisp and not a white line. It cannot reach the 0.82x the
# ten hand-cut stock faces measure, because those have no wisps standing clear
# of the mass at all. It CAN and must stay far below the 4.55x the old bake
# produced, where the bright band was the wall itself and 200px wide.
RIM_LIMIT = 6.0
# A background the matte refuses may not be removed in patches: the cut has to
# come back as the oval it always was.
HOLE_LIMIT = 0.02
# How much of the subject's own hair and skin the matte may cost, against the
# same bake at HEAD. This is the bald-head guard and it is deliberately tight.
KEEP_FLOOR = 0.92
# The whole bake, on a click, measured in a headless software rasteriser -- so
# real hardware is faster than this and the budget is generous on purpose.
BAKE_BUDGET_MS = 400


def luminance(r, g, b):
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


SKY_LUMINANCE = luminance(*SKY)


# The pristine HEAD copy of headmaker.html is served from memory at
# /__pristine__.html rather than written into the tree: this repo is worked by
# several agents at once and a scratch file in the root is a file one of them
# will stage. Serving it from the same origin means it links the same CSS and
# the same vendor scripts, so the only difference between the two bakes is the
# one file under test.
PRISTINE_PATH = "/__pristine__.html"


class QuietHandler(SimpleHTTPRequestHandler):
    pristine = b""

    def log_message(self, _format, *_args):
        pass

    def do_GET(self):
        if self.path.split("?")[0] == PRISTINE_PATH:
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(self.pristine)))
            self.end_headers()
            self.wfile.write(self.pristine)
            return
        return SimpleHTTPRequestHandler.do_GET(self)


# ── THE SUBJECTS ─────────────────────────────────────────────────────────────
# Painted rather than photographed so the answer is not one person's lighting.
# Each is a dark-haired head on a background chosen to be the worst case for
# this bug: bright, and brighter than every part of the subject.

WALL_TOL = 30       # rgb distance a pixel may sit from the wall and still be wall
WALL_K = (0.79, 1.04)   # the lit wall's own top-to-bottom range, plus the bake's contrast


def portrait(wall, hair, skin, shirt, name):
    W, H = 1200, 1600
    _ = None
    im = Image.new("RGB", (W, H), wall)
    d = ImageDraw.Draw(im)
    # a lit wall, so the contamination is not one flat colour the maths could
    # get lucky on
    for y in range(H):
        k = 1.0 - 0.18 * (y / H)
        d.line([(0, y), (W, y)], fill=tuple(int(c * k) for c in wall))
    cx, cy = W // 2, int(H * 0.42)
    d.ellipse([cx - 330, int(H * 0.80), cx + 330, H + 300], fill=shirt)   # shoulders
    d.ellipse([cx - 95, cy + 180, cx + 95, cy + 430], fill=skin)          # neck
    d.ellipse([cx - 300, cy - 330, cx + 300, cy + 250], fill=hair)        # hair mass
    d.ellipse([cx - 215, cy - 210, cx + 215, cy + 275], fill=skin)        # face
    for sx in (-105, 105):                                                # eyes
        d.ellipse([cx + sx - 45, cy - 40, cx + sx + 45, cy + 10], fill=(250, 248, 246))
        d.ellipse([cx + sx - 22, cy - 32, cx + sx + 22, cy + 12], fill=(56, 40, 30))
    d.ellipse([cx - 70, cy + 120, cx + 70, cy + 165], fill=(150, 88, 82))  # mouth
    # a few stray hairs, which are the part erosion destroys and the reason the
    # fix may not erode
    for i in range(90):
        x0 = cx - 300 + i * 7
        d.line([(x0, cy - 300), (x0 + (i % 11) - 5, cy - 380 - (i % 7) * 9)],
               fill=hair, width=2)
    im = im.filter(ImageFilter.GaussianBlur(1.1))   # a lens, not a vector file
    im.info["wall"] = wall
    im.info["hair"] = hair
    im.info["skin"] = skin
    return name, im


def busy(wall, hair, skin, shirt, name):
    """The same head in a room that is not one colour -- a bookshelf.

    This is the case the matte must REFUSE. A magic wand here leaves ragged
    holes, which is worse than the clean oval it would replace, so the four
    gates have to decline it and the bake has to come out byte-for-byte what it
    was before. Nothing else in this file tests a refusal, and a safety valve
    nobody has watched close is one nobody should trust.
    """
    _n, im = portrait(wall, hair, skin, shirt, name)
    d = ImageDraw.Draw(im)
    W, H = im.size
    shelf = [(96, 70, 44), (150, 40, 36), (30, 66, 96), (210, 190, 120),
             (60, 60, 64), (176, 120, 60), (24, 90, 70)]
    for row in range(6):
        y0 = row * 260 + 20
        d.rectangle([0, y0 + 190, W, y0 + 210], fill=(70, 52, 34))
        for col in range(14):
            x0 = col * 88 - 8
            d.rectangle([x0, y0 + 40, x0 + 74, y0 + 190],
                        fill=shelf[(row * 5 + col) % len(shelf)])
    # the person is painted back over the room
    _n2, clean = portrait(wall, hair, skin, shirt, name)
    mask = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mask)
    cx, cy = W // 2, int(H * 0.42)
    md.ellipse([cx - 330, int(H * 0.80), cx + 330, H + 300], fill=255)
    md.ellipse([cx - 300, cy - 330, cx + 300, cy + 250], fill=255)
    md.ellipse([cx - 95, cy + 180, cx + 95, cy + 430], fill=255)
    im.paste(clean, (0, 0), mask)
    out = im.filter(ImageFilter.GaussianBlur(1.1))
    out.info["wall"] = wall
    out.info["hair"] = hair
    out.info["skin"] = skin
    return name, out


# COHERENT says what this subject is entitled to. The first three stand in front
# of one wall and must come out with it gone. The fourth stands in a room, where
# no flood can do better than the oval it started with, and its entitlement is
# the opposite one: the cut must come back WITHOUT HOLES IN IT. Both promises
# are asserted, because a matte that only ever fires is as broken as one that
# never does.
SUBJECTS = [
    portrait((236, 233, 228), (26, 22, 20), (198, 158, 130), (44, 42, 46), "bright-wall") + (True,),
    portrait((252, 251, 250), (18, 16, 15), (232, 200, 178), (60, 58, 62), "white-studio") + (True,),
    portrait((214, 226, 240), (34, 30, 34), (140, 100, 78), (30, 30, 34), "pale-window") + (True,),
    busy((236, 233, 228), (26, 22, 20), (198, 158, 130), (44, 42, 46), "busy-room") + (False,),
]


def png_bytes(image):
    buf = io.BytesIO()
    image.save(buf, "PNG")
    return buf.getvalue()


# ── DRIVING THE REAL BAKE ────────────────────────────────────────────────────
# The page's script is a strict-mode IIFE, so `bake()` is not reachable from the
# outside and this tool does NOT add a hook to make it reachable -- a seam that
# exists only for a test is a seam that will one day be the only thing keeping a
# path alive. It drives the real file input and the real "next" button instead,
# and reads the cut back off `#hmCut`, whose `src` is the very data URL the save
# path stores. Nothing on the save path is clicked, and the context is a
# throwaway profile, so `hmCompanions` / `hmCompanion` are never touched.

def bake_one(page, subject, name, zoom=None):
    page.set_input_files("#file", files=[{
        "name": f"{name}.png", "mimeType": "image/png",
        "buffer": png_bytes(subject)}])
    page.wait_for_selector("#stage2:not(.hidden)", timeout=30_000)
    page.wait_for_timeout(300)
    if zoom is not None:
        page.eval_on_selector(
            "#zoom",
            "(el, v) => { el.value = String(v);"
            " el.dispatchEvent(new Event('input', {bubbles: true})); }", zoom)
        page.wait_for_timeout(120)
    page.click("#next2")
    page.wait_for_selector("#stage3:not(.hidden)", timeout=30_000)
    url = page.eval_on_selector("#hmCut", "el => el.src")
    assert url.startswith("data:image/png;base64,"), (name, url[:60])
    stats = page.evaluate("() => window.__hmBakeStats || null") or {}
    cut = Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1]))).convert("RGBA")
    return cut, stats


def bake_all(page_url, browser, zoom=None):
    out = []
    errors = []
    for name, subject, _coherent in SUBJECTS:
        # A FRESH CONTEXT PER SUBJECT, not one page walked back with "Start
        # over". `#restart` only exists on step 4, and reusing a page would also
        # mean each bake inherits the previous subject's landmarks -- the exact
        # cross-contamination headmaker.html's own `subjGen` guard exists to
        # stop. One person per browser is the only framing that cannot lie here.
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(page_url, wait_until="domcontentloaded", timeout=180_000)
        page.wait_for_timeout(250)
        cut, stats = bake_one(page, subject, name, zoom)
        out.append((name, subject, cut, stats, _coherent))
        context.close()
    assert not errors, errors
    return out


# ── THE RIM ──────────────────────────────────────────────────────────────────

def rim_profile(image, step=2):
    """Peak of the boundary band over the mean of the interior behind it."""
    px = image.load()
    box = image.getchannel("A").getbbox()
    if not box:
        return None

    def over_sky(x, y):
        r, g, b, a = px[x, y]
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
            while low <= i <= high and px[at(i)][3] == 0:
                i += sign
            if not low <= i <= high:
                continue
            if not (low <= i - 5 * sign <= high and low <= i + 8 * sign <= high):
                continue
            inward = [px[at(i + k * sign)] for k in range(4, 9)]
            if any(c[3] < 250 for c in inward):
                continue
            interior = sum(luminance(*c[:3]) for c in inward) / len(inward)
            peak = max(over_sky(*at(i + k * sign)) for k in range(-5, 3))
            ratios.append(peak / max(interior, SKY_LUMINANCE))
            if worst is None or ratios[-1] > worst[0]:
                worst = (ratios[-1], at(i), interior,
                         [over_sky(*at(i + k * sign)) for k in range(-5, 6)])
    if not ratios:
        return None
    ratios.sort()
    return {"n": len(ratios), "max": ratios[-1],
            "p99": ratios[min(len(ratios) - 1, int(len(ratios) * 0.99))],
            "median": ratios[len(ratios) // 2],
            "min": ratios[0], "worst": worst}


# ── THE WALL ─────────────────────────────────────────────────────────────────
# How much of the cut is background rather than subject, and how much of that
# sits in a band hugging the oval edge, which is where it reads as an outline.

def wall_left(image, wall):
    """How much of the PHOTOGRAPH'S BACKGROUND is still in the cut.

    This is the number Jayden's complaint is about, and it is exact here
    because these subjects are painted rather than photographed, so the wall
    colour is known rather than inferred. A pixel counts as wall if it lies
    within WALL_TOL of that colour at some point along the wall's own lit
    gradient, and it is weighted by its ALPHA -- a rim pixel left half
    transparent contributes half, which is what it contributes to the eye.
    Reported as a fraction of the cut's whole alpha mass.

    Luminance thresholds were tried first and are useless: light skin reads
    brighter than a dim wall, so "bright pixels" counted most of a face.
    """
    px = image.load()
    W, H = image.size
    ww = wall[0] ** 2 + wall[1] ** 2 + wall[2] ** 2
    mass = 0.0
    wall_mass = 0.0
    for y in range(0, H, 2):
        for x in range(0, W, 2):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            f = a / 255.0
            mass += f
            t = (r * wall[0] + g * wall[1] + b * wall[2]) / ww
            if not WALL_K[0] <= t <= WALL_K[1]:
                continue
            dr, dg, db = r - t * wall[0], g - t * wall[1], b - t * wall[2]
            if dr * dr + dg * dg + db * db <= WALL_TOL * WALL_TOL:
                wall_mass += f
    return wall_mass / mass if mass else 0.0


def colour_mass(image, colour, tol=34):
    """Alpha-weighted count of pixels that are a given part of the subject.

    THIS IS THE MEASUREMENT THE FIRST WORKING VERSION DID NOT HAVE, and the
    omission cost a whole pass. A flood that anchored on the top border -- which
    at a head-fills-the-oval framing is HAIR -- removed every strand of it, and
    every number then in the tool got better as it happened: the wall was gone,
    there were no holes, the matte reported a confident 59% of the frame. The
    cut was a bald head. Nothing measures a subject except by knowing what the
    subject is made of, so these subjects are painted and their hair and skin
    colours are read back here and compared against the same bake at HEAD.
    """
    px = image.load()
    W, H = image.size
    mass = 0.0
    for y in range(0, H, 2):
        for x in range(0, W, 2):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            dr, dg, db = r - colour[0], g - colour[1], b - colour[2]
            if dr * dr + dg * dg + db * db <= tol * tol:
                mass += a / 255.0
    return mass


def holes(image):
    """Transparent pixels lying BETWEEN the silhouette's own left and right edge.

    The signature of a magic wand that half-worked: a room removed in patches
    leaves gaps inside the shape rather than around it. A plain oval scores ~0
    and so does a clean matte, because on a clean matte the removed background
    is outside the subject's span on every row rather than inside it.
    """
    px = image.load()
    W, H = image.size
    box = image.getchannel("A").getbbox()
    if not box:
        return 0.0
    inside = 0
    gap = 0
    for y in range(box[1], box[3]):
        lo = hi = None
        for x in range(box[0], box[2]):
            if px[x, y][3] > 8:
                if lo is None:
                    lo = x
                hi = x
        if lo is None or hi - lo < 8:
            continue
        for x in range(lo, hi + 1):
            inside += 1
            if px[x, y][3] <= 8:
                gap += 1
    return gap / inside if inside else 0.0


BASELINE = "fe42953"   # the last revision whose bake() was an oval crop and nothing
                       # else. Pinned to a sha rather than HEAD~1 so that this
                       # comparison keeps meaning something after the next commit.
FRAMINGS = (None, 1.9)  # the zoom the page opens at, and head-fills-the-oval --
                        # which is where the bald head appeared and the default
                        # framing did not show it.


def verdict(rows, base_rows, verbose=True):
    """Every promise this pass makes, checked against the same bake at BASELINE."""
    fails = []
    before = {r[0]: r for r in base_rows}
    for name, subject, cut, stats, coherent in rows:
        b = before[name]
        rim = rim_profile(cut)
        left = wall_left(cut, subject.info["wall"])
        was = wall_left(b[2], subject.info["wall"])
        keep = {}
        for part in ("hair", "skin"):
            had = colour_mass(b[2], subject.info[part])
            now = colour_mass(cut, subject.info[part])
            keep[part] = (now / had) if had > 200 else 1.0
        gap = holes(cut)
        if verbose:
            print(f"{name:14s} {stats.get('matte','?'):>20s} {stats.get('ms',0):4.0f}ms"
                  f"  wall {100*was:5.1f}% -> {100*left:5.1f}%"
                  f"   hair kept {100*keep['hair']:5.1f}%  skin kept {100*keep['skin']:5.1f}%"
                  f"   holes {100*gap:4.1f}%"
                  f"   rim {rim['max'] if rim else 0:5.2f}x")
        if coherent and left > WALL_LIMIT:
            fails.append(f"{name}: {100*left:.1f}% of the photograph's background is "
                         f"still in the cut")
        if not coherent and gap > HOLE_LIMIT:
            fails.append(f"{name}: a background the matte cannot handle was removed "
                         f"in patches, leaving {100*gap:.1f}% holes")
        for part, k in keep.items():
            if k < KEEP_FLOOR:
                fails.append(f"{name}: only {100*k:.1f}% of the subject's {part} "
                             f"survived the matte")
        if rim and rim["max"] > RIM_LIMIT:
            fails.append(f"{name}: the cut edge reads {rim['max']:.2f}x the subject "
                         f"behind it")
        if stats.get("ms", 0) > BAKE_BUDGET_MS:
            fails.append(f"{name}: the bake took {stats['ms']:.0f}ms")
    return fails


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--write-artifacts", metavar="DIR")
    ap.add_argument("--self-test", action="store_true",
                    help="prove this tool fails on the revision that had the bug")
    ap.add_argument("--against", default=BASELINE, metavar="REV")
    args = ap.parse_args()

    pristine = subprocess.run(
        ["git", "-C", str(ROOT), "show", f"{args.against}:headmaker.html"],
        capture_output=True, check=True).stdout
    assert b"destination-in" in pristine and b"bgMatte" not in pristine, args.against
    QuietHandler.pristine = pristine

    server = ThreadingHTTPServer(("127.0.0.1", 0),
                                 partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    fails = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            for zoom in FRAMINGS:
                label = "the zoom the page opens at" if zoom is None else f"zoom {zoom}"
                print(f"\n-- {label} --")
                was = bake_all(f"{base}{PRISTINE_PATH}", browser, zoom)
                now = bake_all(f"{base}/headmaker.html", browser, zoom)
                fails += verdict(now, was)
                if args.self_test:
                    # THE SELF-TEST IS THE BASELINE ITSELF. No runtime flag, no
                    # seam in production: the bug is re-injected by serving the
                    # revision that had it, and the tool must fail on that.
                    sick = verdict(was, was, verbose=False)
                    if not any("still in the cut" in f for f in sick):
                        fails.append(f"SELF-TEST at {label}: {args.against} baked a "
                                     f"clean cut, so this tool is not measuring "
                                     f"what it claims")
                    else:
                        print(f"self-test    OK: {args.against} fails this tool "
                              f"({len(sick)} findings)")
                if args.write_artifacts:
                    out = Path(args.write_artifacts)
                    out.mkdir(parents=True, exist_ok=True)
                    tag = "open" if zoom is None else f"z{zoom}"
                    for nm, su, cut, _s, _c in now:
                        su.save(out / f"{nm}-source.png")
                        cut.save(out / f"{nm}-{tag}-cut.png")
                        for lbl, im in (("after", cut), ("before", dict(
                                (r[0], r[2]) for r in was)[nm])):
                            dk = Image.new("RGBA", im.size, SKY + (255,))
                            dk.alpha_composite(im)
                            dk.convert("RGB").save(out / f"{nm}-{tag}-{lbl}.png")
            browser.close()
    finally:
        server.shutdown()
        server.server_close()

    for f in fails:
        print("FAIL: " + f, file=sys.stderr)
    print("\nhead cut fringe: " + ("FAIL" if fails else "OK"))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
