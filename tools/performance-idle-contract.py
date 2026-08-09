#!/usr/bin/env python3
"""Fails when a rAF loop starts reading the DOM again.

WHY THIS FILE EXISTS
hero-head-transform.js carries a sixteen-line comment recording a hard-won fix:
the hero float loop used to resolve styles and force layout on every frame, and
that cost eight rendered frames in a 1.5s window against twenty-four. The
comment ends "The steady-state loop now reads nothing from the DOM at all -- it
only writes."

By 2026-08-09 that was false again. One uncached rootNumber() call had come
back inside place(), which runs once per selection handle per frame, so the
landing page was performing 219 getComputedStyle() calls per second on the
document root -- each one a forced full-document style recalculation.

A comment that documents an invariant nothing enforces is a comment that will
be false again. This is the enforcement. It counts every forced-layout DOM read
made from inside an animation loop, attributes it to the exact function and
line, and fails on anything not explicitly allowed below.

WHAT COUNTS AS A READ
getBoundingClientRect, getComputedStyle, and the offset*/client*/scroll*
properties -- everything that can force the browser to lay out or restyle
synchronously in order to answer.

HOW TO USE IT WHEN IT FAILS
Do not raise the budget to make it green. Either cache the value against
something that already invalidates on resize (metrics() in
hero-head-transform.js, heroBox/HW in play-engine.js, both of which exist for
precisely this), or hoist the read out of the loop. If a read genuinely has to
stay, add it to ALLOWED with a reason and a measurement -- and expect to
justify it, because every entry there is a frame someone is paying for.

    python3 tools/performance-idle-contract.py
    python3 tools/performance-idle-contract.py --verbose
"""

import argparse
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = 4915
IDLE_SECONDS = 5.0
HEADS = 12

# ── THE BUDGET ───────────────────────────────────────────────────────────────
# Forced-layout reads per second an idle page may make in total. These are not
# aspirations; they are the measured values on 2026-08-09 with a little
# headroom, so the number only moves when someone means it to.
#
#   index.html  measured 56/s  -- all of it updateIris in hero-engine.js
#   play.html   measured 57/s  -- same source, plus the 2/s heroBox safety tick
TOTAL_BUDGET = {"index.html": 70, "play.html": 75}

# ── WHAT IS ALLOWED TO READ, AND WHY ─────────────────────────────────────────
# Matched as a substring against "<kind> @ <function> (<file>:<line>)".
# Every entry is a standing cost. If one of these stops appearing, the contract
# says so and asks you to delete it, so this list cannot rot into fiction.
ALLOWED = {
    "updateIris (hero-engine.js": (
        "F5 in docs/superpowers/specs/2026-08-09-performance-audit.md. Reads the "
        "stage rect and each eye's box INSIDE the loop that writes their "
        "transforms, so the second eye reads a tree the first just dirtied. "
        "~63 reads/sec. The patch (batch the reads ahead of the writes) is "
        "written up and routed to the agent that owns hero-engine.js; delete "
        "this entry when it lands."
    ),
    "place (play-games.js": (
        "The cycling headline's word swap: measures the outgoing word, replaces "
        "the element, measures the incoming one, and animates min-width between "
        "them so the line does not jump. It is driven by a 560ms setTimeout, not "
        "by an animation loop, and a width transition genuinely cannot be "
        "computed without measuring both words. ~0.2 reads/sec. Keep."
    ),
    "refreshHeroBox (play-engine.js": (
        "The deliberate one. ONE hero rect, cached and shared by every head, "
        "refreshed rAF-throttled on scroll/resize plus a 500ms safety tick -- "
        "about 2 reads/sec total. This exists so that N heads do not each "
        "force a layout per frame, which is the very thing this contract "
        "protects. Keep."
    ),
}

# Loops that must read NOTHING. A single read attributed to any of these fails
# the run outright, whatever the totals say -- these are the ones with a history.
SILENT_LOOPS = {
    "floatFrame (hero-head-transform.js": (
        "The hero float loop. Runs forever on the landing page. Documented as "
        "reading nothing; regressed once already via rootNumber() in place()."
    ),
    "_frame (play-engine.js": (
        "The per-head companion loop. Runs once per head per frame, so any read "
        "here is multiplied by the size of the crowd."
    ),
}

READ_SHIM = r"""
(function () {
  var tally = Object.create(null), on = false;
  window.__cArm = function () { on = true; tally = Object.create(null); };
  window.__cTally = function () { return tally; };
  function site() {
    var lines = ((new Error()).stack || "").split("\n"), hits = [];
    for (var i = 1; i < lines.length; i++) {
      var l = lines[i].trim().replace(/^at\s+/, "");
      if (l.indexOf("<anonymous>") !== -1 && l.indexOf(".js") === -1 && l.indexOf(".html") === -1) continue;
      hits.push(l.replace(/https?:\/\/127\.0\.0\.1:\d+\//, "").slice(0, 90));
      if (hits.length >= 3) break;
    }
    return hits.join(" <- ");
  }
  function note(kind) { if (!on) return; var k = kind + " @ " + site(); tally[k] = (tally[k] || 0) + 1; }
  var rect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () { note("getBoundingClientRect"); return rect.apply(this, arguments); };
  var gcs = window.getComputedStyle;
  window.getComputedStyle = function () { note("getComputedStyle"); return gcs.apply(this, arguments); };
  ["offsetWidth","offsetHeight","offsetTop","offsetLeft",
   "clientWidth","clientHeight","scrollHeight","scrollWidth"].forEach(function (p) {
    var own = Object.getOwnPropertyDescriptor(HTMLElement.prototype, p);
    var proto = own ? HTMLElement.prototype : Element.prototype;
    var d = own || Object.getOwnPropertyDescriptor(Element.prototype, p);
    if (!d || !d.get) return;
    Object.defineProperty(proto, p, { configurable: true, get: function () { note(p); return d.get.call(this); } });
  });
})();
"""


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_a):
        pass


# ── PROVING THE GUARD CAN FAIL ───────────────────────────────────────────────
# A contract nobody has watched fail is a contract nobody should trust. With
# --self-test the exact regression this file was written for is re-injected
# into the float loop -- one getComputedStyle on the document root, per frame,
# which is the shape of the original bug -- and the run is expected to FAIL.
# If it passes, the detector is broken and every green run before it was noise.
SELF_TEST_SITE = "   state.lastFloatMs=ms;"
SELF_TEST_INJECT = ("   state.lastFloatMs=ms;"
                    "getComputedStyle(document.documentElement).getPropertyValue('--selection-air');")


def measure(pw, page_name, self_test=False):
    browser = pw.chromium.launch(args=[
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows",
    ])
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_init_script("window.__hmPlaceholderCount=%d;" % HEADS)
    ctx.add_init_script(READ_SHIM)
    if self_test and page_name == "index.html":
        src = (ROOT / "hero-head-transform.js").read_text()
        if SELF_TEST_SITE not in src:
            raise SystemExit("--self-test cannot find the float loop's body to instrument; "
                             "update SELF_TEST_SITE to match hero-head-transform.js.")
        src = src.replace(SELF_TEST_SITE, SELF_TEST_INJECT, 1)
        ctx.route("**/hero-head-transform.js*",
                  lambda route: route.fulfill(status=200,
                                              content_type="application/javascript", body=src))
    page = ctx.new_page()
    page.goto("http://127.0.0.1:%d/%s" % (PORT, page_name), wait_until="load")
    page.wait_for_timeout(5000)   # entrance animations, boot, head seating

    # SELECT THE HEAD FIRST, ON THE PAGE THAT HAS ONE.
    # This is the whole reason the contract is worth running. syncSelection()
    # returns immediately unless the portrait is selected, so place() -- the
    # function the 2026-08-09 regression lived in -- never executes on a page
    # nobody has clicked. Measuring only the untouched page would have watched
    # the float loop in the one state where the bug is invisible, and passed.
    if page_name == "index.html":
        try:
            page.click("#heroHeadTransform .head, #heroHeadTransform img",
                       timeout=3000, force=True)
        except Exception:
            page.evaluate("()=>{var f=document.querySelector('#heroHeadTransform "
                          "[aria-pressed],#heroHeadTransform img');if(f)f.click();}")
        page.wait_for_timeout(600)
        selected = page.evaluate(
            "()=>{var s=document.getElementById('heroHeadSelection');"
            " return !!(s&&!s.hidden);}")
        if not selected:
            raise SystemExit(
                "performance-idle-contract could not select the hero portrait, so the "
                "float loop's place() path would go unmeasured. Fix the selector here "
                "rather than letting the contract pass blind.")

    # The float pauses while the pointer is over the head or its frame, so the
    # cursor is parked in the corner: a still head is not the steady state.
    page.mouse.move(5, 5)
    page.wait_for_timeout(1500)
    page.evaluate("window.__cArm();")
    page.wait_for_timeout(int(IDLE_SECONDS * 1000))
    tally = page.evaluate("window.__cTally()")
    browser.close()
    return {k: v / IDLE_SECONDS for k, v in tally.items()}


def check(page_name, reads, verbose):
    failures, seen_allowed = [], set()
    total = sum(reads.values())
    print("\n%s -- %.1f forced-layout reads/sec (budget %d)"
          % (page_name, total, TOTAL_BUDGET[page_name]))

    for site, rate in sorted(reads.items(), key=lambda kv: -kv[1]):
        silent = next((s for s in SILENT_LOOPS if s in site), None)
        allowed = next((a for a in ALLOWED if a in site), None)
        if silent:
            failures.append(
                "A loop that must read nothing is reading again:\n"
                "      %.1f/sec  %s\n"
                "      %s\n"
                "      Cache it against something resize already invalidates, or hoist it out."
                % (rate, site, SILENT_LOOPS[silent]))
        elif allowed:
            seen_allowed.add(allowed)
            if verbose:
                print("   allowed  %6.1f/s  %s" % (rate, site))
        else:
            failures.append(
                "An unlisted forced-layout read inside an idle page:\n"
                "      %.1f/sec  %s\n"
                "      Remove it, or add it to ALLOWED with a reason and a measurement."
                % (rate, site))

    if total > TOTAL_BUDGET[page_name]:
        failures.append("Total idle reads %.1f/sec exceeds the budget of %d/sec."
                        % (total, TOTAL_BUDGET[page_name]))

    for entry in ALLOWED:
        # Only nag about entries that could plausibly appear on this page.
        if entry not in seen_allowed and entry.split("(")[-1].rstrip() in _files_on(page_name):
            print("   NOTE  ALLOWED entry no longer fires here: %s" % entry)
            print("         If it is gone for good, delete it -- a stale allowance hides a real one.")
    return failures


def _files_on(page_name):
    return {"index.html": ["hero-engine.js", "hero-head-transform.js"],
            "play.html": ["hero-engine.js", "play-engine.js"]}[page_name]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--self-test", action="store_true",
                    help="re-inject the 2026-08-09 regression and require this contract to catch it")
    args = ap.parse_args()

    server = ThreadingHTTPServer(("127.0.0.1", PORT),
                                partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    all_failures = []
    try:
        with sync_playwright() as pw:
            for page_name in ("index.html", "play.html"):
                all_failures += [(page_name, f) for f in
                                 check(page_name, measure(pw, page_name, args.self_test),
                                       args.verbose)]
    finally:
        server.shutdown()

    print()
    if args.self_test:
        caught = [f for pg, f in all_failures if "must read nothing" in f]
        if caught:
            print("SELF-TEST PASS  the injected float-loop read was caught:")
            print("   " + caught[0].splitlines()[1].strip())
            return 0
        print("SELF-TEST FAIL  the injected read went UNDETECTED. This contract is not "
              "watching what it claims to watch -- fix the detector before trusting a green run.")
        return 1
    if all_failures:
        for page_name, failure in all_failures:
            print("FAIL [%s] %s" % (page_name, failure))
        print("\nSTATUS=FAIL  (%d finding%s)"
              % (len(all_failures), "" if len(all_failures) == 1 else "s"))
        return 1
    print("STATUS=PASS  every animation loop is still reading only what it is allowed to.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
