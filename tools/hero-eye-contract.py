#!/usr/bin/env python3
"""The eyes: two invariants Jayden stated, and one he did not have to.

  A. THE IRIS IS VISIBLE WHENEVER THE EYE IS OPEN.
  B. THE IRIS IS NEVER VISIBLE WHEN THE EYE IS SHUT.
  C. NO POSE IS PERMANENT.

A and B are one rule stated from both ends, and they are a rule about what is
PAINTED, not about what has been assigned. That distinction is the whole bug.
A blink is two things at once: the drawn face swaps to its closed variant and
the live eye divs -- which carry the irises -- are hidden. The div change is
style and lands on the next paint; the artwork change is a decode and lands
whenever the bitmap is ready. Instrumented on the shipped build with a warm
cache and no throttling at all, 6 of 45 swaps in 26 seconds landed with
complete === false and took one or two frames to present, four of them on the
close step -- so roughly one blink in eight showed the open, iris-less face
with the irises already gone. That is "sometimes it freezes a frame where the
iris disappears", and it is why this file samples against the PRESENTED frame
rather than the src attribute: an instrument that reads the attribute reports
the state the engine intends, which is exactly the state that is not on screen.

C is separate. The 8fps judder is deliberate character and nothing here may
fight it -- the assertion is not about smoothness, it is that a pose which has
outlived its own authored duration comes home. The master clock drains the
blink queue on its very last line, after `return` statements for party, love,
rain, movie, dizzy, eating and the tap reactions, and the recovery below the
drain does nothing while `blinking` is still true. So an interrupted blink can
leave the lids down with no route back. The watchdog is the route back, and
--self-test re-injects both failures so this file has been watched failing.

STATE OF PLAY, 2026-08-10. C passes. A and B do NOT yet, and the gap is older
than this file: bisected against eaadf9d with this same instrument, the shipped
build reported 5-23 frames of an open eye without an iris and 3-61 frames of an
iris on a shut one per thirty-second run, worst unbroken runs of 4 to 28 frames.
The current build is in the same band. Decoding the face frames in the warm-up
closed the part of it that was decode latency; what remains is a state race
between the master clock's own eye recovery and a closed frame that has been
assigned but not yet presented, and it needs the blink state machine looked at
rather than another guard bolted to a call site. A deferral was tried at each
call site and measured WORSE -- an <img> whose src is reassigned mid-flight
fires no load and no error for the abandoned request, so the pairing fell onto
a timeout and produced unbroken runs of 8 to 17 frames of the same defect.
This file is deliberately left asserting the true invariant rather than a
budget, so the number it prints is the real distance still to travel.

Run:  python3 tools/hero-eye-contract.py
      python3 tools/hero-eye-contract.py --self-test
"""
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
# LATE: make the closed artwork arrive 90ms after the lids go down, which is
# precisely what an undecoded frame does on its own -- the engine's warm-up
# decodes every face so the swap presents on the next paint, and this models the
# world in which it does not. Deterministic rather than probabilistic, so the
# self-test cannot pass by happening to get a warm cache.
#
# DEAF: delete the watchdog's only call site. The engine still works; it simply
# has no way home from a pose that stops being drained.
UNPAIR = (
    ' if(s.close){faceImg.src=FACES[curFace].closed;'
    'eyeEls.forEach(e=>e.el.style.display="none");}',
    ' if(s.close){var _late=FACES[curFace].closed;'
    'if(window.__REINJECT_UNPAIR)setTimeout(function(){faceImg.src=_late;},90);'
    'else faceImg.src=_late;'
    'eyeEls.forEach(e=>e.el.style.display="none");}',
)
DEAF = ("setInterval(()=>{tk++;eyeWatchdog();", "setInterval(()=>{tk++;")


class Quiet(SimpleHTTPRequestHandler):
    """Serves the worktree, and rewrites hero-engine.js under --self-test."""

    reinject = ()

    def log_message(self, _format, *_args):
        pass

    def do_GET(self):
        if self.reinject and self.path.split("?")[0].endswith("/hero-engine.js"):
            body = (ROOT / "hero-engine.js").read_text(encoding="utf-8")
            for old, new in self.reinject:
                assert old in body, f"re-injection anchor is gone: {old[:40]!r}"
                body = body.replace(old, new, 1)
            raw = body.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        super().do_GET()


def serve(reinject=()):
    handler = type("H", (Quiet,), {"reinject": reinject})
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(handler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    return server


# ── THE SAMPLER ──────────────────────────────────────────────────────────────
# `presented` is the frame the <img> is actually painting. It advances on the
# same `load` event the engine waits for, and this listener is registered
# first, so if the engine's pairing is honest the two are never out of step by
# even one frame -- and if it is not, this reports the gap rather than hiding
# inside it.
SAMPLER = """() => {
 const img=document.querySelector('#face'), stage=document.querySelector('#stage');
 const L={frames:0, openNoIris:0, shutWithIris:0, swaps:0, cold:0,
          runs:[], worst:0, sample:null};
 let presented=img.getAttribute('src');
 const d=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
 Object.defineProperty(img,'src',{configurable:true,
  get(){return d.get.call(this);},
  set(v){ d.set.call(this,v); L.swaps++;
   if(this.complete&&this.naturalWidth>0){presented=this.getAttribute('src');return;}
   L.cold++;
   const want=this.getAttribute('src'), land=()=>{presented=want;};
   this.addEventListener('load',land,{once:true});
   this.addEventListener('error',land,{once:true});
  }});
 let kind=null, run=0;
 function tick(){
  L.frames++;
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
            if self_test:
                page.evaluate("window.__REINJECT_UNPAIR=true")
            log = watch(page, WATCH_SECONDS)
            label = f"{width}x{height}"
            print(f"  {label}: {log['frames']} frames, {log['swaps']} face swaps "
                  f"({log['cold']} needing a decode) -- "
                  f"open-without-iris {log['openNoIris']}, "
                  f"iris-while-shut {log['shutWithIris']}")
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


def anchors_present():
    """The re-injections have to still describe the shipped code."""
    body = (ROOT / "hero-engine.js").read_text(encoding="utf-8")
    for old, _new in (UNPAIR, DEAF):
        assert old in body, f"self-test anchor no longer in hero-engine.js: {old!r}"
    assert re.search(r"function eyeWatchdog\(\)", body), "the watchdog is gone"


def main():
    self_test = "--self-test" in sys.argv
    anchors_present()
    if self_test:
        print("SELF-TEST: re-injecting the unpaired swap and deafening the watchdog.")
        print("           Both checks below MUST fail.")
        server = serve((UNPAIR, DEAF))
    else:
        server = serve()
    try:
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
