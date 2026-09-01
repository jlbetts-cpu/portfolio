#!/usr/bin/env python3
"""No part of one person's face may appear on the next person's head.

WHY THIS FILE EXISTS
Jayden, 2026-09-01: "the headmaker does have a small glitch where chunks of the
last persons head appears on the head and the only way to add new heads is to
say start over on an existing head."

Both halves of that sentence are one bug seen from two sides. The only route to
a second head was the step-4 button, and that button was the one path in the
Maker that tore the living rig down by hand:

    eyeEls.forEach(function(e){e.wrap.remove();});eyeEls=[];

It removed the eye WRAP and nothing else. Every eye also owns a `.hmScl` — the
cover patch, a lift of that subject's own cheek, painted `url(cutURL)` — and a
`.hmLidW`. Those two stayed in `#hmHead` with `eyeEls` then emptied, so nothing
referenced them any more and `buildLive()`'s teardown, which walks the same
arrays, could never find them either. Two patches of the previous person's skin,
welded to every head made afterwards, and into every PNG downloaded from one,
because `save()` clones `#hmHead` and rasterises it. They accumulate: one Start
over, two orphans; ten, twenty.

WHY tools/head-identity-contract.py DID NOT CATCH IT
That file measures what is STORED, and the stored `cut` is `packCut(bakedCanvas)`
— the raw bake, which never had the rig on it. The orphans live only on the
rendered head and in the download. Its own comment says the carry-over could not
be provoked behaviourally and names the guards textually instead. This file is
the behavioural half: it looks at the head on the screen.

WHAT IS ASSERTED, per subject after the first
  RULE    no child of #hmHead carries a background-image other than the cut
          currently on #hmLive. This is the mechanism, stated exactly.
  PIXELS  the rendered head contains none of the PREVIOUS subject's signature
          colour. This is the defect as Jayden sees it.
  KEEP    the previous subject's colour IS present on its own head. A detector
          that cannot see the thing it is looking for passes everything, so the
          positive control runs on every subject, not once.
  ROUTE   the step-4 secondary is a way to ADD a head: it does not name itself
          with a destructive verb, it clears the 44px floor, and clicking it
          never shortens the stored roster.

WHY THE EYES ARE MARKED DIFFERENTLY FOR EACH SUBJECT
Two subjects whose landmarks land on the same coordinates hide this bug
completely: the fresh cover sits exactly on top of the stale one and the pixels
agree. The dots are marked, per subject, to a different height — with real
keyboard input on the real `role="slider"` dots, which is what step 3 is FOR and
what every real visitor does, since no two faces have eyes in the same place.
Two identically-marked fixtures measured 0 bleed on the broken build.

    python3 tools/head-bleed-contract.py
    python3 tools/head-bleed-contract.py --write-artifacts DIR
    python3 tools/head-bleed-contract.py --self-test

`--self-test` serves a copy of headmaker.html with the historical teardown put
back — clearLive() reverted to walking the arrays, and the step-4 button reverted
to removing `e.wrap` alone — and requires this run to FAIL. The injection is the
two edits that were actually made, not a flag the shipping page carries.

STORAGE. Serves the repo root on 127.0.0.1 — never `localhost`, which on this
machine resolves into another session's worktree — and drives a headless
Chromium with a throwaway profile whose localStorage starts empty, which is
asserted before anything is clicked. It therefore cannot see, and cannot write,
the `hmCompanions` / `hmCompanion` keys holding Jayden's real baked heads. The
page does auto-save at step 4; that write lands in the throwaway profile.
"""

import argparse
import io
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from PIL import Image, ImageDraw, ImageFilter
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = 4926          # ours. 4187 belongs to another session; 4917 to head-identity.
PAGE = "/headmaker.html"


# ── THE SUBJECTS ─────────────────────────────────────────────────────────────
# Painted, not photographed, and in disjoint hue families, so "is this pixel the
# last person?" is a question with an exact answer rather than a threshold on
# somebody's skin tone. The shapes are the same portrait head-cut-fringe uses:
# a coherent lit wall the matte can anchor on, hair, face, eyes, mouth.

def portrait(wall, hair, skin, shirt, eye_dy=0):
    W, H = 1200, 1600
    im = Image.new("RGB", (W, H), wall)
    d = ImageDraw.Draw(im)
    for y in range(H):                                   # a lit wall, not a flat fill
        k = 1.0 - 0.18 * (y / H)
        d.line([(0, y), (W, y)], fill=tuple(int(c * k) for c in wall))
    cx, cy = W // 2, int(H * 0.42)
    d.ellipse([cx - 330, int(H * 0.80), cx + 330, H + 300], fill=shirt)
    d.ellipse([cx - 95, cy + 180, cx + 95, cy + 430], fill=skin)
    d.ellipse([cx - 300, cy - 330, cx + 300, cy + 250], fill=hair)
    d.ellipse([cx - 215, cy - 210, cx + 215, cy + 275], fill=skin)
    for sx in (-105, 105):
        d.ellipse([cx + sx - 45, cy - 40 + eye_dy, cx + sx + 45, cy + 10 + eye_dy],
                  fill=(250, 248, 246))
        d.ellipse([cx + sx - 22, cy - 32 + eye_dy, cx + sx + 22, cy + 12 + eye_dy],
                  fill=(56, 40, 30))
    d.ellipse([cx - 70, cy + 120 + eye_dy, cx + 70, cy + 165 + eye_dy], fill=(150, 88, 82))
    return im.filter(ImageFilter.GaussianBlur(1.1))       # a lens, not a vector file


def is_magenta(r, g, b):
    return r > 90 and b > 70 and g < min(r, b) - 40


def is_green(r, g, b):
    return g > 90 and r < g - 60 and b < g - 60


def is_blue(r, g, b):
    return b > 110 and r < b - 60 and g < b - 60


# name, image, "is this pixel me?", how far up this visitor marks their eyes.
# NUDGE is in Shift+Arrow steps of 0.02 of the stage; every subject differs from
# the one before it, which is what puts a stale cover somewhere a fresh one is
# not. Real faces differ by more than this.
SUBJECTS = [
    ("magenta", portrait((236, 233, 228), (120, 0, 90), (255, 40, 190), (44, 42, 46)),
     is_magenta, 8),
    ("green", portrait((236, 233, 228), (0, 90, 40), (30, 220, 60), (44, 42, 46), eye_dy=60),
     is_green, 0),
    ("blue", portrait((236, 233, 228), (0, 30, 110), (70, 110, 255), (44, 42, 46), eye_dy=-40),
     is_blue, 5),
]

# How many of a subject's own pixels must the detector find on that subject's own
# head before its silence about the previous one means anything. The heads above
# render around 100k opaque signature pixels at this viewport; 5000 is a floor
# that a broken fixture or a declined matte trips long before a real change does.
POSITIVE_FLOOR = 5000

# The bleed budget. Zero, and it can be zero because these subjects share no hue:
# on the broken build the same walk measured 907 stale pixels at device scale 2.
BLEED_MAX = 0


def png_bytes(image):
    buf = io.BytesIO()
    image.save(buf, "PNG")
    return buf.getvalue()


# ── THE INJECTION ────────────────────────────────────────────────────────────
# The two edits that fixed this, put back exactly. Reverting only the button
# would not reproduce it: the rule-based clearLive() at the top of buildLive()
# would sweep the orphans away on the next head and the defect would vanish. The
# historical asymmetry is the bug, so both halves are restored.

INJECTIONS = [
    ("""function clearLive(){
 if(tick){clearInterval(tick);tick=null;}
 [].slice.call(headEl.children).forEach(function(n){if(n!==liveImg)n.remove();});
 eyeEls=[];browEls=[];noseEl=null;mouthEl=null;
}""",
     """function clearLive(){
 eyeEls.forEach(function(e){e.wrap.remove();if(e.scl)e.scl.remove();if(e.lidW)e.lidW.remove();});eyeEls=[];
 browEls.forEach(function(b){b.remove();});browEls=[];if(noseEl){noseEl.remove();noseEl=null;}if(mouthEl){mouthEl.remove();mouthEl=null;}
}"""),
    (" clearLive();   /* the whole rig, by rule.",
     " if(tick){clearInterval(tick);tick=null;}\n eyeEls.forEach(function(e){e.wrap.remove();});eyeEls=[];\n /* INJECTED, historical:"),
]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


# ── DRIVING THE REAL MAKER ───────────────────────────────────────────────────
# The page's script is a strict-mode IIFE and this tool adds no hook into it. The
# real file input, the real step buttons, the real slider dots and the real
# step-4 secondary are all that is touched.

def build(page, image, name, nudge):
    page.set_input_files("#file", files=[{
        "name": name + ".png", "mimeType": "image/png", "buffer": png_bytes(image)}])
    page.wait_for_selector("#stage2:not(.hidden)", timeout=30_000)
    page.wait_for_timeout(400)
    page.click("#next2")
    page.wait_for_selector("#stage3:not(.hidden)", timeout=30_000)
    page.wait_for_timeout(400)
    for dot in ("#dLC", "#dRC"):          # where THIS visitor's eyes are
        page.focus(dot)
        for _ in range(nudge):
            page.keyboard.press("Shift+ArrowUp")
    page.wait_for_timeout(150)
    page.click("#next3")
    page.wait_for_selector("#stage4:not(.hidden)", timeout=30_000)
    page.wait_for_timeout(700)


STALE_LAYERS = """() => {
  var h = document.getElementById('hmHead');
  var cur = document.getElementById('hmLive').src;
  var out = [];
  [].slice.call(h.children).forEach(function (n) {
    var m = /url\\("?([^")]*)"?\\)/.exec(n.style.backgroundImage || '');
    if (m && m[1] !== cur) out.push(n.className || n.tagName);
  });
  return {stale: out, children: h.children.length};
}"""

ROSTER = ("() => { try { return (JSON.parse(localStorage.getItem('hmCompanions')) || []).length; }"
          " catch (e) { return -1; } }")


def count_signature(png, predicate):
    """Opaque pixels of the rendered head that belong to one subject's palette."""
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    px = im.load()
    w, h = im.size
    hits = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a >= 40 and predicate(r, g, b):
                hits += 1
    return hits


# The step-4 secondary must not name itself after throwing work away. This is
# the wording half of the report -- "the only way to add new heads is to say
# start over on an existing head" -- and it is checked, not assumed, because a
# label is the whole of what makes the route findable.
DESTRUCTIVE_WORDS = ("start over", "restart", "reset", "clear", "discard",
                     "delete", "erase", "throw away")


def run(page_url, browser, artifacts=None):
    fails, notes = [], []
    context = browser.new_context(viewport={"width": 1400, "height": 950},
                                  device_scale_factor=2)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(page_url, wait_until="domcontentloaded", timeout=180_000)
    page.wait_for_timeout(400)

    # THE STORAGE ASSERTION, BEFORE ANYTHING IS CLICKED. If this profile is not
    # empty it is not a throwaway one, and nothing below may run against a
    # browser that might be holding somebody's real heads.
    if page.evaluate("() => localStorage.getItem('hmCompanions')") is not None:
        raise SystemExit("refusing to run: this profile already holds hmCompanions")

    previous = None
    for i, (name, image, predicate, nudge) in enumerate(SUBJECTS):
        if i:
            btn = page.locator("#restart")
            label = (btn.inner_text() or "").strip()
            box = btn.bounding_box()
            before = page.evaluate(ROSTER)
            if i == 1:
                low = label.lower()
                for word in DESTRUCTIVE_WORDS:
                    if word in low:
                        fails.append(
                            "the only route to another head is labelled %r. It destroys "
                            "nothing -- the head is already in hmCompanions -- and on a "
                            "screen whose storage is irreplaceable a destructive verb is "
                            "the reason the Maker reads as holding one head." % label)
                if box["height"] < 44:
                    fails.append("the new-head control is %.1fpx tall, under the 44px floor"
                                 % box["height"])
                notes.append("route: %r, %.0fx%.0f" % (label, box["width"], box["height"]))
            btn.click()
            page.wait_for_selector("#stage1:not(.hidden)", timeout=30_000)
            page.wait_for_timeout(400)
            after = page.evaluate(ROSTER)
            if after < before:
                fails.append("clicking the new-head control took the roster from %d to %d: "
                             "it must never be able to remove a saved head" % (before, after))

        build(page, image, name, nudge)

        info = page.evaluate(STALE_LAYERS)
        if info["stale"]:
            fails.append("[%s] %d layer(s) of #hmHead still painted with an earlier "
                         "subject's cut: %s -- this is the head bleed"
                         % (name, len(info["stale"]), ", ".join(info["stale"])))

        shot = page.locator("#hmHead").screenshot()
        if artifacts:
            (Path(artifacts) / ("head-%d-%s.png" % (i + 1, name))).write_bytes(shot)

        mine = count_signature(shot, predicate)
        if mine < POSITIVE_FLOOR:
            fails.append("[%s] the detector finds only %d of this subject's own pixels on "
                         "its own head (floor %d): it cannot be trusted to have found none "
                         "of anyone else's" % (name, mine, POSITIVE_FLOOR))
        if previous:
            prev_name, prev_pred = previous
            bled = count_signature(shot, prev_pred)
            notes.append("%-8s own %6d px | %s on it %4d px" % (name, mine, prev_name, bled))
            if bled > BLEED_MAX:
                fails.append("[%s] %d pixels of the previous subject (%s) are on this head "
                             "(budget %d)" % (name, bled, prev_name, BLEED_MAX))
        else:
            notes.append("%-8s own %6d px" % (name, mine))
        previous = (name, predicate)

    stored = page.evaluate(ROSTER)
    if stored != len(SUBJECTS):
        fails.append("built %d heads through the new-head route, %d stored"
                     % (len(SUBJECTS), stored))
    notes.append("roster after %d heads: %d" % (len(SUBJECTS), stored))

    context.close()
    if errors:
        fails.append("page errors: %s" % errors)
    return fails, notes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--self-test", action="store_true",
                    help="re-inject the historical teardown and require a FAIL")
    ap.add_argument("--write-artifacts", metavar="DIR",
                    help="save each rendered head as a PNG to look at")
    args = ap.parse_args()

    if args.write_artifacts:
        Path(args.write_artifacts).mkdir(parents=True, exist_ok=True)

    source = (ROOT / "headmaker.html").read_text()
    broken = source
    if args.self_test:
        for good, bad in INJECTIONS:
            if good not in broken:
                raise SystemExit("--self-test cannot find its injection site in "
                                 "headmaker.html; update INJECTIONS.")
            broken = broken.replace(good, bad, 1)

    server = ThreadingHTTPServer(("127.0.0.1", PORT),
                                 partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    url = "http://127.0.0.1:%d%s" % (PORT, PAGE)
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            if args.self_test:
                # Served from memory: this repo is worked by several agents at
                # once and a scratch file in the root is a file one of them stages.
                browser_ctx_route = broken
                def serve_broken(route):
                    route.fulfill(status=200, content_type="text/html; charset=utf-8",
                                  body=browser_ctx_route)
                # routed per-context inside run(), via a wrapper below
                orig_new_context = browser.new_context

                def patched(**kw):
                    ctx = orig_new_context(**kw)
                    ctx.route("**/headmaker.html*", lambda r: serve_broken(r))
                    return ctx
                browser.new_context = patched

            fails, notes = run(url, browser, args.write_artifacts)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()

    for line in notes:
        print("  " + line)

    if args.self_test:
        if fails:
            print("self-test    OK: the historical teardown fails this tool "
                  "(%d finding(s), first: %s)" % (len(fails), fails[0]))
            return 0
        print("self-test    FAIL: the injected bug passed. This tool cannot fail, "
              "which is worse than not having it.")
        return 1

    if fails:
        for f in fails:
            print("FAIL  " + f)
        return 1
    print("head bleed   OK: %d subjects built through the new-head route, "
          "no layer and no pixel of one on the next" % len(SUBJECTS))
    return 0


if __name__ == "__main__":
    sys.exit(main())
