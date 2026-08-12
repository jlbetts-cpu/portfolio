#!/usr/bin/env python3
"""The eyes: two invariants Jayden stated, and one he did not have to.

  A. THE IRIS IS VISIBLE WHENEVER THE EYE IS OPEN.
  B. THE IRIS IS NEVER VISIBLE WHEN THE EYE IS SHUT.
  C. NO POSE IS PERMANENT.

A and B are one rule stated from both ends, and they are a rule about what is
PAINTED, not about what has been assigned. That distinction is the whole bug.
A blink is two things at once: the drawn face swaps to its closed variant and
the live eye divs -- which carry the irises -- are hidden. The div change is
style and lands on the next paint; the artwork change is an <img> src and lands
whenever the bitmap is available. When the two use different clocks they
disagree for a frame or six: an open face with the irises already gone, which
is "sometimes it freezes a frame where the iris disappears".

C is separate. The 8fps judder is deliberate character and nothing here may
fight it -- the assertion is not about smoothness, it is that a pose which has
outlived its own authored duration comes home. The master clock drains the
blink queue on its very last line, after `return` statements for party, love,
rain, movie, dizzy, eating and the tap reactions, and the recovery below the
drain does nothing while `blinking` is still true. So an interrupted blink can
leave the lids down with no route back. The watchdog is the route back, and
--self-test re-injects both failures so this file has been watched failing.

═══════════════════════════════════════════════════════════════════════════════
WHAT "PAINTED" MEANS, SETTLED IN PIXELS ON 2026-08-11
═══════════════════════════════════════════════════════════════════════════════
This file used to define the presented frame as THE LAST SRC WHOSE `load` EVENT
HAD FIRED. That definition is wrong, and it was the entire remaining red gate.

An <img>'s image data is updated in a MICROTASK queued by the src assignment;
`complete` flips there. The `load` event is a TASK queued after that. Between
the two the bitmap is completely available and the compositor will paint it --
but no load event has fired yet. Instrumented on the shipped build, that gap
ran as long as 57.5ms, three and a half frames at 60fps, and every frame this
contract rejected in its last red runs sat inside it: `complete` true,
naturalWidth 600, the engine's painted frame and the src attribute agreeing on
neutral_closed.webp, and this file still holding neutral_browsup.webp because a
task had not been dispatched. The instrument was reporting a frame that had
already left the screen.

That is not an argument anyone should have to take on trust, so it was settled
against the compositor. --pixels re-encodes every face frame with a unique solid
patch stamped on the forehead, paints the irises flat green, and pulls every
COMPOSITED frame off the compositor with CDP screencast, classifying each one
from its pixels alone -- no load event, no attribute, nothing the engine
believes. The readings:

    shipped engine   1509 composited frames, 108 driven blinks
                     -> 0 open-without-iris, 0 iris-on-shut
    original pairing 1264 composited frames, 106 driven blinks
                     -> 316 open-without-iris, in unbroken runs of five and six

Five to six frames is ~90ms of blank-eyed stare, once per blink. That is the
defect, and it is the thing --pixels can be watched catching.

So `presented` below is now the frame that IS COMPLETELY AVAILABLE at the moment
the sample is taken: the attribute when `complete && naturalWidth > 0`, and the
last frame that loaded otherwise. That is a fact about the bitmap, not a report
of what the engine intends -- the engine could assign anything it liked and this
would go on reporting the old frame until the browser said the new one was
ready. The load-event count is still printed alongside it, as a note, so the gap
that produced two false red gates stays visible instead of being deleted.

═══════════════════════════════════════════════════════════════════════════════
WHAT THE ENGINE DOES ABOUT IT
═══════════════════════════════════════════════════════════════════════════════
Lid visibility is derived from paintedFace() rather than from the assignment, so
A and B hold by construction. Two lines close the timing:

  setFaceSrc()  every src write goes through it, and it reconciles in a
                MICROTASK queued immediately after the one the browser queues to
                update the image data -- so the lid decision is made in the same
                task-drain in which the bitmap becomes available.
  lidFrame()    reconciles once per animation frame, before that frame paints,
                which covers a genuinely asynchronous load whose `complete`
                flips between frames.

Neither waits for anything and neither holds pending state, which is what
separates them from the deferral that was tried in July and measured worse: an
<img> whose src is reassigned mid-flight fires neither load nor error for the
abandoned request, so anything that WAITS falls onto a timeout. These do not
wait. An abandoned request simply never becomes the painted one.

Run:  python3 tools/hero-eye-contract.py
      python3 tools/hero-eye-contract.py --self-test
      python3 tools/hero-eye-contract.py --pixels              (needs Pillow)
      python3 tools/hero-eye-contract.py --pixels --self-test
"""
import base64
import io
import json
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
WATCH_SECONDS = 30
VIEWPORTS = ((1440, 900), (390, 844))

# ── THE RE-INJECTIONS ────────────────────────────────────────────────────────
# Each one puts back a bug this contract was written for, so the contract can
# be watched failing rather than trusted on the strength of a green run.
#
# RE-ANCHORED 2026-08-11 and now reconstructing the ORIGINAL SEMANTICS rather
# than quoting the original code, because that code is gone. The defect as it
# shipped was three facts at once, and it takes all three to rebuild it:
#
#   PAIRED   -- the lids come down in the same statement that ASKS for the
#               closed artwork, which is how applyStep() used to read.
#   LATE     -- the closed artwork arrives 90ms after it is asked for, which is
#               precisely what an undecoded frame does on its own. Deterministic
#               rather than probabilistic, so the self-test cannot pass by
#               happening to get a warm cache.
#   NOSYNC   -- the reconciler that did not exist then is switched off. Without
#               this the engine simply repairs the injection on the next frame
#               and the self-test cannot fail, which is worse than no self-test.
#
# Together they paint 316 iris-less open frames in 1264 composited frames under
# --pixels, in unbroken runs of five and six. That is the measurement the
# header quotes, and it is why these three are trusted to be the old bug.
#
# DEAF is invariant C and is untouched: delete the watchdog's only call site.
# The engine still works; it simply has no way home from a pose that stops
# being drained.
PAIRED_LATE = (
    ' if(s.close){setFaceSrc(FACES[curFace].closed);syncLids();}',
    " if(s.close){var _l=FACES[curFace].closed;eyesClosed=true;applyBlink();"
    "eyeEls.forEach(function(e){e.el.style.display='none';});"
    "setTimeout(function(){faceImg.src=_l;},90);}",
)
NOSYNC = (
    "function syncLids(){\n if(!eyeEls.length)return;",
    "function syncLids(){\n return;\n if(!eyeEls.length)return;",
)
DEAF = ("setInterval(()=>{tk++;eyeWatchdog();", "setInterval(()=>{tk++;")

# ── THE PIXEL GROUND TRUTH ───────────────────────────────────────────────────
# Only used by --pixels. Each face frame is re-encoded with a unique saturated
# patch on the forehead -- opaque on every face, well clear of the eyes -- and
# the classifier works on colour DIRECTION rather than absolute colour, because
# the scene-lighting filter on #face dims the portrait by ~24%.
FACE_FRAMES = ["neutral.webp", "neutral_browsup.webp", "neutral_closed.webp",
               "rest.webp", "rest_closed.webp", "wink.webp", "wink_closed.webp",
               "smile.webp", "smile_closed.webp"]
PATCH_COLORS = [(255, 0, 0), (0, 0, 255), (255, 0, 255), (0, 255, 255),
                (255, 128, 0), (128, 0, 255), (255, 0, 128), (0, 128, 255),
                (255, 255, 128)]
PATCH_AT, PATCH_R = (0.5, 0.22), 0.075


def _dir(c):
    m = max(c) or 1
    return (c[0] / m, c[1] / m, c[2] / m)


def stamped_frames():
    """Every face frame, re-encoded with its own colour signature."""
    from PIL import Image
    out = {}
    for name, rgb in zip(FACE_FRAMES, PATCH_COLORS):
        im = Image.open(ROOT / "images" / name).convert("RGBA")
        w, h = im.size
        cx, cy, r = int(w * PATCH_AT[0]), int(h * PATCH_AT[1]), int(w * PATCH_R)
        for y in range(cy - r, cy + r):
            for x in range(cx - r, cx + r):
                im.putpixel((x, y), (rgb[0], rgb[1], rgb[2], 255))
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=90)
        out[name] = buf.getvalue()
    return out


class Quiet(SimpleHTTPRequestHandler):
    """Serves the worktree, rewriting hero-engine.js and the faces on demand."""

    reinject = ()
    stamps = None

    def log_message(self, _format, *_args):
        pass

    def handle_one_request(self):
        # --pixels tears the context down while frames are still in flight, and
        # a dropped socket is not a finding. Without this the real result is
        # buried under a BrokenPipeError traceback from a server thread.
        try:
            super().handle_one_request()
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True

    def do_GET(self):
        path = self.path.split("?")[0]
        base = path.rsplit("/", 1)[-1]
        if self.stamps and path.startswith("/images/") and base in self.stamps:
            self._send(self.stamps[base], "image/webp")
            return
        if self.reinject and path.endswith("/hero-engine.js"):
            body = (ROOT / "hero-engine.js").read_text(encoding="utf-8")
            for old, new in self.reinject:
                assert old in body, f"re-injection anchor is gone: {old[:40]!r}"
                body = body.replace(old, new, 1)
            self._send(body.encode("utf-8"), "application/javascript")
            return
        super().do_GET()

    def _send(self, raw, ctype):
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


def serve(reinject=(), stamps=None):
    handler = type("H", (Quiet,), {"reinject": reinject, "stamps": stamps})
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(handler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    return server


# ── THE SAMPLER ──────────────────────────────────────────────────────────────
# `presented` is computed AT SAMPLE TIME from the browser's own readiness
# signal, not from an event: if the element reports the attribute's bitmap
# completely available, that is the frame the next paint uses; otherwise the
# frame that last loaded is still up. See this file's header for why the load
# event is the wrong signal and for the pixel measurement that settled it.
# `presentedByLoad` keeps the old definition alongside it, reported and never
# asserted, so the gap between the two stays visible in every run.
SAMPLER = """() => {
 const img=document.querySelector('#face'), stage=document.querySelector('#stage');
 const L={frames:0, openNoIris:0, shutWithIris:0, swaps:0, cold:0, lagFrames:0,
          runs:[], worst:0, sample:null};
 let loaded=img.currentSrc||img.getAttribute('src')||'';
 let byLoad=loaded;
 const d=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
 Object.defineProperty(img,'src',{configurable:true,
  get(){return d.get.call(this);},
  set(v){ d.set.call(this,v); L.swaps++;
   if(this.complete&&this.naturalWidth>0){byLoad=this.getAttribute('src');return;}
   L.cold++;
   const want=this.getAttribute('src'), land=()=>{byLoad=want;};
   this.addEventListener('load',land,{once:true});
   this.addEventListener('error',land,{once:true});
  }});
 img.addEventListener('load',()=>{loaded=img.currentSrc||img.getAttribute('src')||'';});
 img.addEventListener('error',()=>{loaded=img.getAttribute('src')||'';});
 function presentedNow(){
  if(img.complete&&img.naturalWidth>0)return img.getAttribute('src')||'';
  return loaded;
 }
 let kind=null, run=0;
 function tick(){
  L.frames++;
  const presented=presentedNow();
  if(presented!==byLoad)L.lagFrames++;
  const shut=/_closed\\.webp/.test(presented||'');
  const eyes=[...stage.querySelectorAll('.eye')];
  // An eye "paints an iris" when its own box is visible AND the iris inside it
  // is visible and has a box. Faces with painted-in eyes (smile) build no eye
  // elements at all, so they are vacuously fine on both invariants.
  const per=eyes.map(el=>{
   const cs=getComputedStyle(el);
   const shown=cs.display!=='none'&&cs.visibility!=='hidden'
               &&parseFloat(cs.opacity)>0.02;
   const ir=el.querySelector('.iris');
   if(!shown||!ir)return false;
   const b=ir.getBoundingClientRect();
   return parseFloat(getComputedStyle(ir).opacity)>0.05&&b.width>0.5&&b.height>0.5;
  });
  let k=null;
  if(!shut&&per.length&&per.some(v=>!v))k='open-no-iris';
  else if(shut&&per.some(v=>v))k='shut-with-iris';
  if(k){ if(k===kind)run++; else {kind=k;run=1;}
    if(k==='open-no-iris')L.openNoIris++; else L.shutWithIris++;
    if(run>L.worst){L.worst=run;L.sample=[k,presented,per];} }
  else { if(kind)L.runs.push([kind,run,presented]); kind=null; run=0; }
  requestAnimationFrame(tick);
 }
 requestAnimationFrame(tick);
 window.__eyeLog=L;
}"""

# The blink storm --pixels drives. An idle page blinks about forty times in
# thirty seconds; a defect that lives for five frames of one blink in eight
# needs more swaps than that before a null reading means anything.
STORM = """() => { window.__stormN=0;
  window.__storm=setInterval(()=>{ window.__stormN++;
    try{ requestBlink(curFace,false,false); }catch(e){} }, 240); }"""

PIXEL_PROBE = """() => {
  const st=document.createElement('style');
  st.textContent='.eye{filter:none!important}'
   +'.iris{background:#00ff00!important}'
   +'.iris::before,.iris::after{display:none!important}'
   +'.pupil{display:none!important}.glint{display:none!important}';
  document.head.appendChild(st);
}"""


def watch(page, seconds):
    """Run the page and poke it through every path that touches the eyes."""
    page.evaluate(SAMPLER)
    logo = "()=>{const b=document.querySelector('#logo').getBoundingClientRect();"\
           "return [b.left+b.width/2,b.top+b.height/2];}"
    face = "()=>{const b=document.querySelector('#face').getBoundingClientRect();"\
           "return [b.left+b.width/2,b.top+b.height/2];}"
    for elapsed in range(0, int(seconds * 1000), 500):
        page.wait_for_timeout(500)
        if elapsed in (4000, 22000):                       # wink, then home
            spot = page.evaluate(logo)
            page.mouse.move(spot[0], spot[1])
        elif elapsed in (6000, 24000):
            page.mouse.move(page.viewport_size["width"] - 40, 300)
        elif elapsed == 10000:                             # a tap reaction
            spot = page.evaluate(face)
            page.mouse.click(spot[0], spot[1])
    return page.evaluate("window.__eyeLog")


def check_iris_invariants(server, self_test):
    failures = []
    with sync_playwright() as play:
        browser = play.chromium.launch()
        for width, height in VIEWPORTS:
            context = browser.new_context(viewport={"width": width, "height": height},
                                          has_touch=width <= 760, is_mobile=width <= 760)
            page = context.new_page()
            page.goto(f"http://127.0.0.1:{server.server_port}/index.html",
                      wait_until="domcontentloaded")
            log = watch(page, WATCH_SECONDS)
            label = f"{width}x{height}"
            print(f"  {label}: {log['frames']} frames, {log['swaps']} face swaps "
                  f"({log['cold']} needing a decode) -- "
                  f"open-without-iris {log['openNoIris']}, "
                  f"iris-while-shut {log['shutWithIris']}")
            # The gap that made this contract report two false red gates. It is
            # printed, never asserted: it is how far behind the frame on screen
            # the load event was, and it is not zero on a busy machine.
            print(f"    (note: {log['lagFrames']} frames where the load event had "
                  f"not caught up with the available bitmap)")
            # The cold swaps are the ones that used to show the artefact. If a
            # run never hits one it has not exercised the invariant at all, and
            # a green result would mean nothing.
            if not self_test and log["cold"] == 0 and log["swaps"] > 0:
                print(f"    (note: every swap was already decoded at {label})")
            if log["openNoIris"] or log["shutWithIris"]:
                failures.append(f"{label}: {log['openNoIris']} frames of an open eye "
                                f"with no iris and {log['shutWithIris']} frames of an "
                                f"iris on a shut one; worst unbroken run "
                                f"{log['worst']} frames {log['sample']}")
            context.close()
        browser.close()
    return failures


def check_no_permanent_pose(server, self_test):
    """Force the unrecoverable pose and watch it come home."""
    failures = []
    with sync_playwright() as play:
        browser = play.chromium.launch()
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.goto(f"http://127.0.0.1:{server.server_port}/index.html?eyestuck=1",
                  wait_until="load")
        page.wait_for_timeout(3000)
        page.wait_for_function("() => typeof window.__hmEyeStick === 'function'")
        budget = page.evaluate("window.__hmEyeState().budget")
        # The COUNTER is the reading, not a snapshot of the lids. Spontaneous
        # blinks land every two to five seconds, so any single sample taken
        # after the budget has a fair chance of catching an ordinary blink and
        # calling it a stuck pose. eyeRecovered only moves when the watchdog
        # itself fires, which is the thing being asserted.
        page.evaluate("window.__hmEyeStick()")
        stuck = page.evaluate("window.__hmEyeState()")
        assert stuck["shut"], f"the injected pose was not stuck to begin with: {stuck}"
        assert stuck["recovered"] == 0, f"the watchdog had already fired: {stuck}"
        # A watchdog that fires early would clip real blinks, so both ends are
        # asserted: silent at half the budget, fired well before twice it.
        page.wait_for_timeout(int(budget * 0.5))
        early = page.evaluate("window.__hmEyeState()")
        if early["recovered"] or not early["shut"]:
            failures.append(f"the watchdog fired at {budget * 0.5:.0f}ms, inside the "
                            f"{budget:.0f}ms a real blink is allowed -- it would cut "
                            f"blinks short: {early}")
        page.wait_for_timeout(int(budget * 1.5))
        late = page.evaluate("window.__hmEyeState()")
        print(f"  watchdog: fired by {budget * 0.5:.0f}ms = {bool(early['recovered'])}, "
              f"fired by {budget * 2:.0f}ms = {bool(late['recovered'])}")
        if not late["recovered"]:
            failures.append(f"the pose was still held {budget * 2:.0f}ms after it was "
                            f"forced -- nothing brought the eyes home: {late}")
        context.close()
        browser.close()
    return failures


def check_pixels(server, self_test, seconds=26, width=390, height=844):
    """Ground truth: classify every COMPOSITED frame from its own pixels.

    Nothing the page believes is consulted. The artwork is identified by the
    colour patch stamped into each face frame, the iris by flat green, and the
    frames come off the compositor through CDP screencast.
    """
    from PIL import Image
    failures, frames = [], []
    with sync_playwright() as play:
        browser = play.chromium.launch()
        context = browser.new_context(viewport={"width": width, "height": height},
                                      has_touch=True, is_mobile=True)
        page = context.new_page()
        page.goto(f"http://127.0.0.1:{server.server_port}/index.html", wait_until="load")
        page.evaluate(PIXEL_PROBE)
        page.wait_for_timeout(3500)                 # let the warm-up decode everything
        stage = page.evaluate("()=>{const b=document.querySelector('#stage')"
                              ".getBoundingClientRect();"
                              "return [b.left,b.top,b.width,b.height];}")
        cdp = context.new_cdp_session(page)

        def on_frame(event):
            try:
                cdp.send("Page.screencastFrameAck", {"sessionId": event["sessionId"]})
            except Exception:
                pass
            frames.append(event["data"])

        cdp.on("Page.screencastFrame", on_frame)
        cdp.send("Page.startScreencast", {"format": "png", "everyNthFrame": 1,
                                          "maxWidth": width, "maxHeight": height})
        page.evaluate(STORM)
        page.wait_for_timeout(seconds * 1000)
        blinks = page.evaluate("window.__stormN")
        try:
            cdp.send("Page.stopScreencast")
        except Exception:
            pass
        page.wait_for_timeout(300)
        context.close()
        browser.close()

    sx, sy, sw, sh = stage
    pad = 60
    box = (max(0, int(sx - pad)), max(0, int(sy - pad)),
           min(width, int(sx + sw + pad)), min(height, int(sy + sh + pad)))
    dirs = [_dir(c) for c in PATCH_COLORS]
    bad_open = bad_shut = unknown = 0
    seen, kind, run, worst = {}, None, 0, 0
    for data in frames:
        im = Image.open(io.BytesIO(base64.b64decode(data))).convert("RGB")
        if im.size != (width, height):
            im = im.resize((width, height))
        tally = dict.fromkeys(FACE_FRAMES, 0)
        green = 0
        for count, (r, g, b) in (im.crop(box).getcolors(1 << 22) or []):
            if g > 150 and r < 120 and b < 120:
                green += count
                continue
            if max(r, g, b) - min(r, g, b) < 55 or max(r, g, b) < 60:
                continue
            here, best, bd = _dir((r, g, b)), None, 0.34
            for name, nd in zip(FACE_FRAMES, dirs):
                dist = sum((a - c) ** 2 for a, c in zip(here, nd)) ** 0.5
                if dist < bd:
                    bd, best = dist, name
            if best:
                tally[best] += count
        name = max(tally, key=tally.get)
        if tally[name] < 400:
            unknown += 1
            continue
        seen[name] = seen.get(name, 0) + 1
        if name.startswith("smile"):                # painted-in eyes, no divs
            continue
        iris, shut = green > 12, "_closed" in name
        k = None
        if not shut and not iris:
            k, bad_open = "open-no-iris", bad_open + 1
        elif shut and iris:
            k, bad_shut = "shut-with-iris", bad_shut + 1
        if k:
            run = run + 1 if k == kind else 1
            kind, worst = k, max(worst, run)
        else:
            kind, run = None, 0

    print(f"  {width}x{height}: {len(frames)} COMPOSITED frames, {blinks} blinks "
          f"driven, {unknown} unclassifiable")
    print(f"    artwork the compositor actually painted: {json.dumps(seen)}")
    print(f"    painted open-without-iris {bad_open}, painted iris-while-shut "
          f"{bad_shut}, worst unbroken run {worst}")
    if unknown > len(frames) * 0.2:
        failures.append(f"the pixel classifier could not read {unknown} of "
                        f"{len(frames)} frames -- the reading means nothing")
    if len(seen) < 2:
        failures.append(f"only {len(seen)} distinct face frame(s) were ever painted "
                        f"-- the blink storm did not exercise the invariant")
    if bad_open or bad_shut:
        failures.append(f"the COMPOSITOR painted {bad_open} open faces without an "
                        f"iris and {bad_shut} irises on a shut face; worst unbroken "
                        f"run {worst} frames")
    return failures


def anchors_present():
    """The re-injections have to still describe the shipped code."""
    body = (ROOT / "hero-engine.js").read_text(encoding="utf-8")
    for old, _new in (PAIRED_LATE, NOSYNC, DEAF):
        assert old in body, f"self-test anchor no longer in hero-engine.js: {old!r}"
    assert re.search(r"function eyeWatchdog\(\)", body), "the watchdog is gone"
    # The two lines that make the pairing exact rather than lucky. If either
    # goes, the window in the header's measurement is open again and this file
    # should say so before it says anything else.
    assert re.search(r"function setFaceSrc\(url\)", body), \
        "setFaceSrc is gone -- src writes no longer reconcile in a microtask"
    assert "queueMicrotask(syncLids)" in body, \
        "setFaceSrc no longer reconciles the lids in the image-data microtask"
    assert "function lidFrame()" in body, \
        "the per-frame lid reconcile is gone"
    # Every artwork write must go through the funnel. Two raw assignments are
    # allowed and named: setFaceSrc's own, and the dev-only stuck-pose injector
    # behind ?eyestuck=1, which exists precisely to leave the lids unpaired.
    raw = len(re.findall(r"(?<![A-Za-z_.])faceImg\.src\s*=", body))
    assert raw == 2, (f"{raw} raw faceImg.src assignments -- every artwork write "
                      f"belongs in setFaceSrc() or the microtask reconcile is skipped")


def main():
    self_test = "--self-test" in sys.argv
    pixels = "--pixels" in sys.argv
    anchors_present()
    stamps = stamped_frames() if pixels else None
    if self_test:
        print("SELF-TEST: re-injecting the original pairing (lids on assignment, "
              "artwork 90ms late,")
        print("           reconciler off) and deafening the watchdog. "
              "Every check below MUST fail.")
        server = serve((PAIRED_LATE, NOSYNC, DEAF), stamps)
    else:
        server = serve((), stamps)
    try:
        if pixels:
            print("Iris invariant, measured on the COMPOSITOR (ground truth):")
            failures = check_pixels(server, self_test)
        else:
            print("Iris invariant (visible when open, never when shut):")
            failures = check_iris_invariants(server, self_test)
            print("No permanent pose:")
            failures += check_no_permanent_pose(server, self_test)
    finally:
        server.shutdown()

    if self_test:
        if failures:
            print("\nSELF-TEST PASS -- the contract caught its own re-injected bugs:")
            for line in failures:
                print("   *", line)
            return 0
        print("\nSELF-TEST FAIL -- the re-injected bugs went undetected. "
              "This contract cannot be trusted.")
        return 1

    if failures:
        print("\nFAIL:")
        for line in failures:
            print("   *", line)
        return 1
    print("\nHero eyes: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
