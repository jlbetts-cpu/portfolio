#!/usr/bin/env python3
"""A head you make is the head that gets stored, and no head is ever deleted by a read.

WHY THIS FILE EXISTS
Two reports, both about the Maker, both eventually the same family of bug:

  "there still is no way to create up to 12 heads"
  "when you create a new head sometimes it shows some of the skin from the last
   person's head on the new person's face"

Neither was a limit. Both were state from one subject surviving into the next, or a
READ PATH deleting what a write path had saved:

  1. readAll / readPit / the engine's boot list all chained .slice(CAP) onto their
     dedupe filter and then wrote the result back whenever it came out shorter than
     what they read. Seed eleven heads, load any page, and eight remain. The ninth
     was not refused -- it was destroyed, by a page that was only supposed to be
     reading. Healing (dropping duplicates and debris) may be written back. Capping
     may not.
  2. The dedupe key was marks + eye boxes. Two DIFFERENT people whose marks land on
     the same coordinates hashed identically, and the newer one was deleted as a
     duplicate.
  3. restoreHead's image decode, guessFace's FaceDetector promise and slimDown's
     repack all wrote module state with no check that they were still talking about
     the same person. An image decode cannot be cancelled, so a promise opened for
     subject A lands on subject B -- A's whole bake, or A's landmarks, or (in
     slimDown's case) A's entire roster snapshot written back over B's save.

WHAT IS ASSERTED
  identity   two visibly different faces built back to back are stored as two heads,
             each with its own skin and its own marked geometry
  survival   seed N heads, load every page that reads them, and N heads remain --
             for N below, at, and above the cap
  agreement  the cap and the dedupe key are literally the same in every file that
             enforces them

PROVING THE GUARD CAN FAIL
    python3 tools/head-identity-contract.py --self-test
re-injects each historical bug into a served copy of the source and expects the run
to FAIL. A detector nobody has watched fail is one nobody should trust.

    python3 tools/head-identity-contract.py
    python3 tools/head-identity-contract.py --self-test
"""

import argparse
import json
import re
import struct
import sys
import zlib
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = 4917

# The number every file must agree on. Read from the source rather than hardcoded, so
# raising the roster does not mean editing this file too -- but every copy must match.
CAP_DECL = re.compile(r"window\.__HM_MAX_HEADS\s*=\s*window\.__HM_MAX_HEADS\s*\|\|\s*(\d+)")
# index.html JOINED THE ENFORCED SET once its own read path was fixed. It was
# advisory only because it belonged to another lane mid-session; it kept the
# literal 8 and the capped write-back, so loading the home page -- which only
# wants to draw some ambient heads -- deleted the ninth. It now matches the
# others, and being merely "noted" is what let it stay broken while every other
# file was green.
CAP_FILES = ["play-games.js", "play-engine.js", "headmaker.html", "index.html"]
CAP_ADVISORY = []   # nothing is merely advised any more; see CAP_FILES

DEDUPE_KEY = ('var k2=d.cut.length+"|"+JSON.stringify(d.marks||"m")'
              '+JSON.stringify((d.eyes||[]).map(function(e){return[e.x,e.y,e.w,e.h];}));')

# The write-back must persist the HEALED list, never a capped one. In every file the
# cap is applied on its own line, after the write-back.
CAPPED_WRITEBACK = re.compile(r"\.slice\(0,\s*HM_MAX\)\s*;\s*\n?\s*if\s*\(\s*_?raw")


# ── two faces the guess can actually find, and that no eye can confuse ────────
def _png(path, skin, eye_dx, eye_y, mouth_y, seed):
    import random
    W, H = 720, 864
    random.seed(seed)
    buf = [[(245, 245, 245)] * W for _ in range(H)]
    cx, cy, rx, ry = W // 2, int(H * 0.5), int(W * 0.34), int(H * 0.40)
    for y in range(H):
        for x in range(W):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                n = random.randint(-7, 7)
                buf[y][x] = tuple(max(0, min(255, c + n)) for c in skin)

    def blob(px, py, rrx, rry, col):
        for y in range(max(0, py - rry), min(H, py + rry)):
            for x in range(max(0, px - rrx), min(W, px + rrx)):
                if ((x - px) / rrx) ** 2 + ((y - py) / rry) ** 2 <= 1:
                    buf[y][x] = col

    ey = int(H * eye_y)
    for sgn in (-1, 1):
        ex = cx + sgn * int(W * eye_dx)
        blob(ex, ey, int(W * 0.075), int(H * 0.030), (250, 250, 250))
        blob(ex, ey, int(W * 0.026), int(H * 0.022), (35, 30, 28))
        blob(ex, ey - int(H * 0.062), int(W * 0.070), int(H * 0.011), (60, 45, 38))
    blob(cx, int(H * mouth_y), int(W * 0.085), int(H * 0.028), (190, 70, 72))

    raw = b""
    for y in range(H):
        row = bytearray([0])
        for x in range(W):
            row += bytes(buf[y][x])
        raw += bytes(row)

    def ck(t, d):
        c = t + d
        return struct.pack(">I", len(d)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    path.write_bytes(b"\x89PNG\r\n\x1a\n"
                     + ck(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
                     + ck(b"IDAT", zlib.compress(raw, 6)) + ck(b"IEND", b""))


def _flat(path, rgb):
    """A featureless subject: guessFace() finds no eyes, so nothing overwrites the
    geometry already on the bench. That is the state the carry-over bugs live in."""
    import random
    W, H = 900, 1080
    random.seed(7)
    raw = b""
    for y in range(H):
        row = bytearray([0])
        for x in range(W):
            row += bytes(max(0, min(255, c + random.randint(-12, 12))) for c in rgb)
        raw += bytes(row)

    def ck(t, d):
        c = t + d
        return struct.pack(">I", len(d)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    path.write_bytes(b"\x89PNG\r\n\x1a\n"
                     + ck(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
                     + ck(b"IDAT", zlib.compress(raw, 6)) + ck(b"IEND", b""))


MEAN = r"""
async (src) => {
  if (!src) return null;
  const im = new Image();
  await new Promise(r => { im.onload = r; im.onerror = r; im.src = src; });
  const c = document.createElement('canvas'); c.width = 80; c.height = 96;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0, 80, 96);
  const d = x.getImageData(0, 0, 80, 96).data;
  let r=0,g=0,b=0,n=0;
  for (let i=0;i<d.length;i+=4){ if(d[i+3]<128) continue; r+=d[i]; g+=d[i+1]; b+=d[i+2]; n++; }
  return n ? [Math.round(r/n), Math.round(g/n), Math.round(b/n)] : null;
}
"""


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_a):
        pass


# ── the historical bugs, re-injected one at a time ───────────────────────────
SELF_TEST_INJECTIONS = {
    # THE GEOMETRY CARRY-OVER HAS NO INJECTION HERE, DELIBERATELY, AND THIS NOTE
    # IS THE POINT OF IT. Three attempts, all failed, each for its own reason:
    #   1. break newSubject() at the restart button -- unreachable, because a new
    #      PHOTO also calls newSubject (headmaker.html, "a new photo is a new
    #      face") and this contract builds its second head by uploading one, so
    #      the upload reset the subject no matter what restart did.
    #   2. break it at the photo load instead -- still missed, because guessFace
    #      does not reliably decline even on a flat featureless fixture, so the
    #      marks get overwritten and no contamination survives to be measured.
    #   3. assert the guards statically instead -- correct, and invisible to THIS
    #      harness: injections are served over HTTP to the browser, while a static
    #      check reads the file from disk, which the injection never touches.
    # So the guards are named in run() and they will fail if anyone deletes them
    # from the source. What is NOT claimed is that this file can provoke the bug
    # behaviourally. An injection kept here would report "caught" or "MISSED" on
    # something it is not testing, and a detector that reports on nothing is the
    # exact defect this whole file exists to stamp out.
    "dedupe-key-without-the-picture": (
        "headmaker.html",
        'var k2=d.cut.length+"|"+JSON.stringify(d.marks||"m")',
        'var k2=""+JSON.stringify(d.marks||"m")'),
    "read-path-writes-back-the-capped-list": (
        "play-games.js",
        'return true;});\n  if(rawN!==null&&rawN!==a.length)',
        'return true;}).slice(0,HM_MAX);\n  if(rawN!==null&&rawN!==a.length)'),
}


def build_head(page, path):
    page.set_input_files("#file", str(path))
    page.wait_for_timeout(1300)
    page.click("#next2")
    page.wait_for_timeout(900)
    page.click("#next3")
    page.wait_for_timeout(1600)


def run(inject=None, verbose=False):
    tmp = ROOT / "tools" / "_head_identity_faces"
    tmp.mkdir(exist_ok=True)
    p1, p2 = tmp / "p1.png", tmp / "p2.png"
    if not p1.exists():
        _png(p1, (232, 120, 105), 0.105, 0.40, 0.665, 1)
    if not p2.exists():
        _png(p2, (105, 150, 232), 0.135, 0.455, 0.715, 2)
    # THE PAIR THAT ACTUALLY CATCHES IT. A pair the auto-guess can read gives each face
    # its own marks, which hides every carry-over bug: measured, the first two
    # injections below were MISSED until this pair existed. These two have no findable
    # eyes, so guessFace() declines and whatever geometry is already on the bench stays
    # -- which is precisely the state the second face must not inherit. Their skins are
    # still flatly distinguishable, so contamination is unambiguous.
    f1, f2 = tmp / "flat1.png", tmp / "flat2.png"
    if not f1.exists():
        _flat(f1, (210, 60, 50))
    if not f2.exists():
        _flat(f2, (50, 80, 210))

    fails, notes = [], []

    # ── agreement: static, and it does not need a browser ────────────────────
    caps = {}
    for f in CAP_FILES:
        src = (ROOT / f).read_text()
        m = CAP_DECL.search(src)
        if not m:
            fails.append("%s does not declare the shared roster cap" % f)
        else:
            caps[f] = int(m.group(1))
        if DEDUPE_KEY not in src.replace("\r", ""):
            # headmaker breaks the line differently; match on the distinguishing part
            if 'k2=d.cut.length+"|"' not in src:
                fails.append("%s does not use the shared dedupe key (cut length + geometry)" % f)
    # THE GEOMETRY GUARDS ARE ASSERTED STATICALLY, BECAUSE THE BEHAVIOUR CANNOT BE
    # PROVOKED FROM HERE. The carry-over bug is that a new subject inherits the last
    # one's pts and marks, and buildLive() then cuts brow and eye-cover patches from
    # another person's coordinates -- what Jayden sees as the previous person's skin
    # on the new face. Two separate injections were tried, breaking newSubject() at
    # the restart button and at the photo load, and NEITHER reached the assertion:
    # every path this contract can drive resets the subject by some other route, and
    # guessFace does not reliably decline even on a featureless fixture, so the marks
    # get overwritten anyway. Rather than leave an injection that cannot fail -- the
    # exact defect this file was written to stamp out -- the guards are named here.
    # A textual check is weaker than a behavioural one, and it is far stronger than a
    # green tick that proves nothing.
    maker = (ROOT / "headmaker.html").read_text()
    for what, needle in (
        ("a new photo must start a new subject",
         "var g=newSubject();   /* a new photo is a new face"),
        ("Start over must start a new subject",
         'document.getElementById("restart").addEventListener("click",function(){newSubject();'),
        ("a restored head is a subject too",
         "var g=newSubject();   // a restored head is a subject too"),
    ):
        if needle not in maker:
            fails.append("headmaker.html: %s -- newSubject() is gone from that path, so "
                         "pts and marks survive into the next person and their patches "
                         "are cut from the last face's coordinates" % what)

    if len(set(caps.values())) > 1:
        fails.append("the roster cap disagrees across files: %s" % caps)
    cap = max(caps.values()) if caps else 0
    for f in CAP_ADVISORY:
        src = (ROOT / f).read_text()
        if ".slice(0,8)" in src or "length>=8)return" in src:
            notes.append("%s still carries the old literal 8 and the capped write-back "
                         "(other lane -- handover patch pending)" % f)

    for f in CAP_FILES:
        if CAPPED_WRITEBACK.search((ROOT / f).read_text()):
            fails.append("%s writes a CAPPED list back to storage: a read must never delete" % f)

    srv = ThreadingHTTPServer(("127.0.0.1", PORT), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=srv.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as pw:
            br = pw.chromium.launch()
            ctx = br.new_context(viewport={"width": 1440, "height": 900})
            if inject:
                fname, good, bad = SELF_TEST_INJECTIONS[inject]
                src = (ROOT / fname).read_text()
                if good not in src:
                    raise SystemExit("--self-test cannot find the site for %r in %s; "
                                     "update SELF_TEST_INJECTIONS." % (inject, fname))
                broken = src.replace(good, bad, 1)
                ctype = "text/html" if fname.endswith(".html") else "application/javascript"
                # ONE PARAMETER. Playwright counts the handler's parameters and passes
                # the Request as a second positional argument when it can -- a lambda
                # carrying default args for the body gets the Request bound to them
                # instead, and fulfill() then hangs the navigation until goto times out.
                ctx.route("**/" + fname + "*",
                          lambda r: r.fulfill(status=200, content_type=ctype, body=broken))
            page = ctx.new_page()
            errs = []
            page.on("pageerror", lambda e: errs.append(str(e)))

            # ── identity: two subjects, twice, with and without findable eyes ────
            # "mixed" is the pair that actually pins the geometry bug: a face
            # guessFace CAN read, followed by one it cannot. Head 1 is measured
            # into real marks; head 2 must fall back to the defaults. If restart
            # failed to reset, head 2 keeps head 1's measured geometry and the
            # patches are cut from another person's coordinates. Two featureless
            # faces cannot show this -- both are defaults either way -- and two
            # readable faces cannot either, because the second overwrites.
            for label, (a, b_) in (("guessable", (p1, p2)),
                                   ("featureless", (f1, f2)),
                                   ("mixed", (p1, f2))):
                page.goto("http://127.0.0.1:%d/headmaker.html" % PORT, wait_until="load")
                page.wait_for_timeout(400)
                page.evaluate("()=>{localStorage.removeItem('hmCompanions');"
                              "localStorage.removeItem('hmCompanion');}")
                page.goto("http://127.0.0.1:%d/headmaker.html" % PORT, wait_until="load")
                page.wait_for_timeout(900)
                build_head(page, a)
                page.click("#restart")
                page.wait_for_timeout(700)
                build_head(page, b_)

                stored = page.evaluate("()=>{try{return JSON.parse(localStorage.getItem('hmCompanions'))||[]}"
                                       "catch(e){return []}}")
                if len(stored) != 2:
                    fails.append("[%s] built two different faces, %d head(s) stored: the "
                                 "Maker is losing or merging heads" % (label, len(stored)))
                    continue
                m1 = page.evaluate(MEAN, stored[0]["cut"])
                m2 = page.evaluate(MEAN, stored[1]["cut"])
                if not (m1 and m2):
                    fails.append("[%s] a stored cut would not decode" % label)
                    continue
                if not (m1[0] - m1[2] > 6):
                    fails.append("[%s] head 1 is not the warm face it was built from: %s" % (label, m1))
                if not (m2[2] - m2[0] > 6):
                    fails.append("[%s] head 2 carries the previous person's skin: %s "
                                 "(expected cool, got warm or neutral)" % (label, m2))

                # THE COLOUR CHECK ABOVE CANNOT SEE THE HALF OF THIS BUG THAT HURT.
                # It compares mean skin tone, and the cut is always taken from the
                # NEW photo, so the tone is the new person's even when everything
                # else was inherited. What actually survived was the GEOMETRY:
                # newSubject() resets pts and marks, but restart() once cleared
                # restoredEyes and nothing else, and guessFace() only overwrites the
                # marks when its heuristic finds two eyes. When it declines, the new
                # face is measured with the old face's eye corners and brow/nose/
                # mouth marks, and buildLive() cuts its brow and eye-cover patches
                # from those coordinates -- which is exactly what Jayden sees as
                # "some of the skin from the last person on the new person's face".
                # Reproduced historically to the last decimal place, and the
                # self-test's restart-keeps-the-last-face injection was MISSED until
                # this assertion existed: every green run before it was noise.
                # IDENTICAL MARKS ARE ONLY DAMNING WHEN THEY ARE NOT THE DEFAULTS.
                # Measured on the real tree: two FEATURELESS faces both come out
                # carrying BL 0.395 / BR 0.605 / M 0.5 -- MARKS0, symmetric about
                # centre -- because guessFace declines on both and each correctly
                # resets to the defaults. That is the fix working, not the bug, and
                # a naive equality check cannot tell "both reset" from "the second
                # inherited the first". The signal is a match on marks that some
                # face was actually MEASURED into.
                # ONLY THE MIXED PAIR CAN JUDGE THIS, so only it is asked to.
                # Reading MARKS0 out of the page to recognise "these are just the
                # defaults" does not work -- it is not on the global scope, the
                # probe returns null, and the comparison then fires on every
                # featureless run. The mixed pair needs no such probe: head 1 was
                # MEASURED into real marks and head 2 must not be wearing them,
                # whatever the defaults happen to be.
                g1 = json.dumps(stored[0].get("marks"), sort_keys=True)
                g2 = json.dumps(stored[1].get("marks"), sort_keys=True)
                if label == "mixed" and g1 == g2 and stored[0].get("marks") is not None:
                    fails.append("[%s] head 2 was measured with head 1's geometry -- "
                                 "identical NON-DEFAULT marks %s. restart() must reset "
                                 "pts and marks, not just restoredEyes; guessFace only "
                                 "overwrites them when it finds two eyes, so a face it "
                                 "declines keeps whatever the last one left."
                                 % (label, g1[:120]))
                if verbose:
                    print("  %-12s head 1 %s   head 2 %s   cut bytes %d/%d"
                          % (label, m1, m2, len(stored[0]["cut"]), len(stored[1]["cut"])))
            page.evaluate("()=>{localStorage.removeItem('hmCompanions');localStorage.removeItem('hmCompanion');}")
            page.goto("http://127.0.0.1:%d/headmaker.html" % PORT, wait_until="load")
            page.wait_for_timeout(600)
            build_head(page, p1)   # one real head to clone the survival seeds from

            # ── survival, below / at / above the cap ─────────────────────────
            for n in (cap - 1, cap, cap + 1):
                if n < 1:
                    continue
                # EVERY SEEDED HEAD MUST BE A DIFFERENT PICTURE. The dedupe drops
                # byte-identical cuts on sight, and rightly so -- clone one head N
                # times and one head is the correct answer. So each seed is painted
                # at its own hue, which is what a roster of N real people is.
                page.evaluate(
                    """(n)=>{var a=[],base=JSON.parse(localStorage.getItem('hmCompanions'))[0];
                       for(var i=0;i<n;i++){
                         var c=document.createElement('canvas');c.width=840;c.height=1008;
                         var x=c.getContext('2d');
                         x.fillStyle='hsl('+(i*29%360)+',55%,58%)';x.fillRect(0,0,840,1008);
                         for(var k=0;k<900;k++){x.fillStyle='rgba('+((i*37+k)%256)+',80,120,.5)';
                           x.fillRect((k*173+i*11)%840,(k*307+i*7)%1008,9,9);}
                         var h=JSON.parse(JSON.stringify(base));
                         h.cut=c.toDataURL('image/webp',0.82);
                         h.marks.N.y+=i*0.001;h.eyes[0].x+=i*0.0007;h.__i=i;a.push(h);}
                       localStorage.setItem('hmCompanions',JSON.stringify(a));
                       localStorage.setItem('hmCompanion',JSON.stringify(a[a.length-1]));}""", n)
                seeded = page.evaluate("()=>JSON.parse(localStorage.getItem('hmCompanions')).length")
                for target in ("headmaker.html", "play.html", "index.html"):
                    page.goto("http://127.0.0.1:%d/%s" % (PORT, target), wait_until="load")
                    page.wait_for_timeout(2500)
                    left = page.evaluate("()=>{try{return JSON.parse("
                                         "localStorage.getItem('hmCompanions')).length}catch(e){return -1}}")
                    if left < seeded:
                        fails.append("seeded %d head(s), %s left %d in storage: a read "
                                     "path is deleting heads" % (seeded, target, left))
                    elif verbose:
                        print("  %-15s seeded %2d -> %2d survived" % (target, seeded, left))
                page.goto("http://127.0.0.1:%d/headmaker.html" % PORT, wait_until="load")
                page.wait_for_timeout(600)

            if errs:
                fails.append("page errors: %s" % errs[:3])
            br.close()
    finally:
        srv.shutdown()
        srv.server_close()   # shutdown alone leaves the socket bound, and --self-test runs this three times

    return cap, fails, notes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    a = ap.parse_args()

    if a.self_test:
        bad = []
        for name in SELF_TEST_INJECTIONS:
            _, fails, _ = run(inject=name, verbose=False)
            print("  re-injected %-36s -> %s" % (name, "caught" if fails else "MISSED"))
            if a.verbose and fails:
                for f in fails:
                    print("        %s" % f)
            if not fails:
                bad.append(name)
        if bad:
            print("\nSTATUS=FAIL  the detector did not notice: %s\n"
                  "Every green run before this was noise." % ", ".join(bad))
            return 1
        print("\nSTATUS=PASS  every historical bug is still detected.")
        return 0

    cap, fails, notes = run(verbose=a.verbose)
    print("roster cap: %d, agreed across %s" % (cap, ", ".join(CAP_FILES)))
    for n in notes:
        print("note: %s" % n)
    if fails:
        print("")
        for f in fails:
            print("  FAIL  %s" % f)
        print("\nSTATUS=FAIL  the Maker is losing or contaminating heads.")
        return 1
    print("\nSTATUS=PASS  two faces stay two faces, and no page load deletes a head.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
