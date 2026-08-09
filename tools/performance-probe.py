#!/usr/bin/env python3
"""Frame-rate and idle-cost probe for the portfolio.

WHY THIS EXISTS RATHER THAN THE BROWSER PANE
The embedded pane is not a performance instrument: it backgrounds tabs (which
throttles rAF to 1Hz and freezes CSS transitions at their start value), renders
at the wrong scale on ink-filter pages, and rasterises in software, so absolute
paint timings there are meaningless. A previous audit lost a day to a 33-83s
"slow" measurement that was the rasteriser, not the CSS.

WHAT THIS MEASURES INSTEAD, AND WHY YOU CAN TRUST IT
  * Frames actually delivered. A rAF sampler records every frame delta over a
    fixed wall-clock window in a foregrounded tab (backgrounding and timer
    throttling are switched off at the command line). A page pinned to the
    vsync clock reports 60.0fps / 16.7ms median; a page missing frames reports
    the real lower number with the dropped frames visible in p95 and worst.
    That discrimination is what makes the figure defensible.
  * layouts/sec and style-recalcs/sec (CDP Performance domain). These are
    integer counters, so no rasteriser can move them. They are the most
    portable numbers here.
  * Forced synchronous layout, attributed by call site. Every
    getBoundingClientRect / getComputedStyle / offset* / client* read is counted
    and blamed on the function that made it, so a read-after-write inside a rAF
    loop shows up by name and line.

WHAT TO DISCOUNT
  Script/style/layout MILLISECONDS are honest but machine-relative. Paint and
  composite cost is NOT measured here and would be pessimistic if it were:
  headless Chromium rasterises on the CPU, so `filter` and `backdrop-filter`
  look far worse than they are on real hardware. Compare before against after
  under identical conditions rather than quoting an absolute paint figure.

  The attribution phase installs shims that themselves cost time, so it is run
  in a SEPARATE window from the frame-rate phase. Never read fps off an
  attribution run.

USAGE
    python3 tools/performance-probe.py                       # everything
    python3 tools/performance-probe.py --modes lobby,soccer  # some game modes
    python3 tools/performance-probe.py --viewports 390       # phone only
    python3 tools/performance-probe.py --attribute           # add blame phase
    python3 tools/performance-probe.py --json before.json --label before
"""

import argparse
import json
import os
import statistics
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = int(os.environ.get("PERF_PROBE_PORT", "4894"))

# ---------------------------------------------------------------- frame sampler
# Cheap enough to leave running: one array push per frame, no DOM contact.
SAMPLER = r"""
(function () {
  var frames = [], sampling = false, last = 0;
  window.__perfSample = function () { frames = []; last = 0; sampling = true; };
  window.__perfStop = function () { sampling = false; };
  window.__perfFrames = function () { return frames.slice(); };
  (function tick(t) {
    if (sampling && last) frames.push(t - last);
    last = t;
    requestAnimationFrame(tick);
  })(0);
  window.__perfLongTasks = [];
  try {
    new PerformanceObserver(function (l) {
      l.getEntries().forEach(function (e) {
        window.__perfLongTasks.push({ start: e.startTime, dur: e.duration });
      });
    }).observe({ entryTypes: ["longtask"] });
  } catch (e) {}
})();
"""

# ------------------------------------------------------------------ blame shims
# Expensive (a stack capture per DOM read), so this only ever runs in its own
# window, never while frames are being counted.
BLAME = r"""
(function () {
  var tally = Object.create(null), on = false;
  window.__perfArm = function () { on = true; tally = Object.create(null); };
  window.__perfDisarm = function () { on = false; };
  window.__perfTally = function () { return tally; };

  function site(depth) {
    var lines = ((new Error()).stack || "").split("\n"), hits = [];
    for (var i = 1; i < lines.length; i++) {
      var l = lines[i].trim().replace(/^at\s+/, "");
      if (l.indexOf("<anonymous>") !== -1 && l.indexOf(".js") === -1 && l.indexOf(".html") === -1) continue;
      hits.push(l.replace(/https?:\/\/127\.0\.0\.1:\d+\//, "").slice(0, 88));
      if (hits.length >= (depth || 2)) break;
    }
    return hits.length ? hits.join(" <- ") : "unknown";
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

  var rafOrig = window.requestAnimationFrame, live = Object.create(null);
  window.__perfRaf = function () { return live; };
  window.requestAnimationFrame = function (cb) {
    if (on) { var k = site(2); live[k] = (live[k] || 0) + 1; }
    return rafOrig.call(window, cb);
  };

  // element census: how much is on the page for the compositor to carry
  window.__perfCensus = function () {
    var all = document.querySelectorAll("*");
    var filtered = 0, backdrop = 0, willChange = 0, layers = 0;
    for (var i = 0; i < all.length; i++) {
      var cs = gcs(all[i]);
      if (cs.filter && cs.filter !== "none") filtered++;
      if ((cs.backdropFilter || cs.webkitBackdropFilter || "none") !== "none") backdrop++;
      if (cs.willChange && cs.willChange !== "auto") willChange++;
      if (cs.transform && cs.transform !== "none") layers++;
    }
    return { elements: all.length, filtered: filtered, backdrop: backdrop,
             willChange: willChange, transformed: layers };
  };
})();
"""

# ---------------------------------------------------------------- game scenarios
# Each entry drives play.html into one mode and waits for it to settle.
MODES = {
    "lobby": None,
    "soccer": "if(window.__hmSoccerStart)window.__hmSoccerStart();",
    "tournament": "if(window.__hmTourStart)window.__hmTourStart();",
    "race": "if(window.__hmRaceStart)window.__hmRaceStart();",
    "battle": ("window.__hmLavaTeams=false;window.__hmBattleReq=performance.now();"
               "document.body.classList.add('hmBattle');"
               "if(window.__hmNewArena)window.__hmNewArena();"),
}

COUNTERS = ["LayoutCount", "RecalcStyleCount", "LayoutDuration", "RecalcStyleDuration",
            "ScriptDuration", "TaskDuration"]

# ------------------------------------------------------------------- ablations
# Switch ONE suspect off, re-measure, and the fps delta is that suspect's price.
# This is how the audit ranks findings by measured impact instead of by hunch.
# CSS ablations are injected after the mode has settled, so nothing about boot
# or layout changes -- only what the compositor and style engine have to do.
ABLATIONS = {
    "none": "",
    # every SVG ink filter on the page (eyes, chrome, props)
    "no-ink": "*,*::before,*::after{filter:none!important}",
    # the lava heat haze: backdrop-filter with an SVG filter in the chain
    "no-haze": ".hmLavaHaze{display:none!important}",
    # every backdrop-filter anywhere
    "no-backdrop": "*,*::before,*::after{backdrop-filter:none!important;"
                   "-webkit-backdrop-filter:none!important}",
    # per-head reflections
    "no-refl": ".hmRefl{display:none!important}",
    # per-head contact shadows
    "no-shadow": ".hmShadow,.floorshadow{display:none!important}",
    # the water plane the reflections sit in
    "no-water": ".hmWater{display:none!important}",
    # the lava's WebGL + crust canvases
    "no-lava-canvas": ".hmLavaGL,.hmLavaCrust{display:none!important}",
    # the eyes, which carry filter:url(#inkEye) and move every frame
    "no-eyes": ".eye{display:none!important}",
}


# --------------------------------------------------------------------- patches
# Candidate fixes applied by rewriting the file in flight, so a proposed change
# to a file this audit must not edit can still be MEASURED before it is
# recommended. Each patch is a list of exact (old, new) substitutions; the probe
# fails loudly if a substitution does not match, so a patch cannot silently
# become a no-op after the file moves on.
PATCHES = {
    # THE LANDING PAGE'S IDLE COST. place() runs once per selection handle per
    # float frame, and each call ends with a getComputedStyle() on the document
    # root -- immediately after that same function has WRITTEN four custom
    # properties to the handle. Write-then-read is a forced synchronous style
    # recalc, five times a frame, on the largest DOM on the site. The value read
    # is --selection-handle-size, which is a constant that cannot change without
    # a resize, and metrics() is the cache that resize already invalidates.
    "hero-handle-cache": ("hero-head-transform.js", [
        ('    yAmp:rootNumber("--hero-head-float-y-amp",9),',
         '    handle:rootNumber("--selection-handle-size",8),\n'
         '    yAmp:rootNumber("--hero-head-float-y-amp",9),'),
        ('   var reach=(m.hit-rootNumber("--selection-handle-size",8))/2;',
         '   var reach=(m.hit-m.handle)/2;'),
    ]),
}


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_a):
        pass


def install_patch(ctx, name):
    fname, subs = PATCHES[name]
    src = (ROOT / fname).read_text()
    for old, new in subs:
        if old not in src:
            raise SystemExit("patch %r no longer applies: %r not found in %s"
                             % (name, old[:60], fname))
        src = src.replace(old, new, 1)

    def handler(route):
        route.fulfill(status=200, content_type="application/javascript", body=src)

    ctx.route("**/" + fname + "*", handler)


def serve():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    return server


def metrics(cdp):
    return {m["name"]: m["value"] for m in cdp.send("Performance.getMetrics")["metrics"]}


def frame_stats(frames):
    frames = [f for f in frames if f > 0]
    if not frames:
        return {"frames": 0, "fps": 0}
    s = sorted(frames)
    n = len(s)
    return {
        "frames": n,
        "fps": round(1000.0 / statistics.mean(s), 1),
        "median_ms": round(statistics.median(s), 2),
        "p95_ms": round(s[min(n - 1, int(n * 0.95))], 2),
        "worst_ms": round(s[-1], 2),
        "dropped": sum(1 for f in s if f > 20),
        "dropped_pct": round(100.0 * sum(1 for f in s if f > 20) / n, 1),
    }


def launch(pw, headed=False):
    return pw.chromium.launch(headless=not headed, args=[
        "--force-device-scale-factor=1",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows",
        "--disable-features=CalculateNativeWinOcclusion",
    ])


def open_page(browser, width, blame, heads=12, patch=None):
    ctx = browser.new_context(viewport={"width": width, "height": 900 if width > 700 else 844},
                              device_scale_factor=1)
    # A one-head lobby is not the workload anybody complained about. The engine
    # exposes __hmPlaceholderCount precisely so a harness can seat a real crowd
    # at boot -- heads added after load never get [data-hm-boot-ready], and the
    # marble race refuses to start with fewer than two racers.
    ctx.add_init_script("window.__hmPlaceholderCount=%d;" % heads)
    ctx.add_init_script(SAMPLER)
    if blame:
        ctx.add_init_script(BLAME)
    if patch:
        install_patch(ctx, patch)
    page = ctx.new_page()
    cdp = ctx.new_cdp_session(page)
    cdp.send("Performance.enable")
    return page, cdp


def measure(page, cdp, seconds):
    """One frame-rate window. Returns fps stats plus the integer counters."""
    page.evaluate("window.__perfLongTasks.length=0; window.__perfSample();")
    before = metrics(cdp)
    page.wait_for_timeout(int(seconds * 1000))
    after = metrics(cdp)
    frames = page.evaluate("window.__perfFrames()")
    page.evaluate("window.__perfStop();")
    tasks = page.evaluate("window.__perfLongTasks")
    d = {k: after.get(k, 0) - before.get(k, 0) for k in COUNTERS}
    out = frame_stats(frames)
    out.update({
        "layouts_per_sec": round(d["LayoutCount"] / seconds, 1),
        "recalcs_per_sec": round(d["RecalcStyleCount"] / seconds, 1),
        "script_ms_per_sec": round(d["ScriptDuration"] * 1000 / seconds, 1),
        "layout_ms_per_sec": round(d["LayoutDuration"] * 1000 / seconds, 1),
        "style_ms_per_sec": round(d["RecalcStyleDuration"] * 1000 / seconds, 1),
        "long_tasks": len(tasks),
        "worst_long_task_ms": round(max([t["dur"] for t in tasks], default=0), 1),
    })
    return out


STEPS = 60


def resize_drag(page, cdp, width, blame=False):
    """A drag, not a jump -- and crucially FASTER THAN FRAMES ARRIVE.

    A hand on a window corner emits a resize event per compositor tick, which is
    quicker than the page can paint. An earlier version of this harness spaced
    its steps 33ms apart, which is about two frames, so every event comfortably
    got its own frame and a coalescing bug could not show up at all. Steps are
    now issued back to back through CDP -- no sleep between them -- so several
    land inside one frame and a handler that re-measures per EVENT is separated
    from one that re-measures per FRAME.

    With blame on, the DOM-read tally across the drag is the honest number: it
    is an integer count of forced-layout reads, so it does not move when the
    machine is busy, unlike fps.
    """
    if blame:
        page.evaluate("window.__perfArm();")
    page.evaluate("window.__perfLongTasks.length=0; window.__perfSample();")
    before = metrics(cdp)
    h = 900 if width > 700 else 844
    for i in range(STEPS):
        cdp.send("Emulation.setDeviceMetricsOverride", {
            "width": width - (i % 20) * 18, "height": h,
            "deviceScaleFactor": 1, "mobile": False})
    page.wait_for_timeout(500)
    cdp.send("Emulation.clearDeviceMetricsOverride")
    after = metrics(cdp)
    frames = page.evaluate("window.__perfFrames()")
    page.evaluate("window.__perfStop();")
    tasks = page.evaluate("window.__perfLongTasks")
    d = {k: after.get(k, 0) - before.get(k, 0) for k in COUNTERS}
    out = frame_stats(frames)
    if blame:
        tally = page.evaluate("window.__perfTally()")
        page.evaluate("window.__perfDisarm();")
        out["dom_reads_total"] = sum(tally.values())
        out["dom_reads_top"] = dict(sorted(tally.items(), key=lambda kv: -kv[1])[:12])
    out.update({
        "layouts": round(d["LayoutCount"]),
        "layouts_per_step": round(d["LayoutCount"] / STEPS, 1),
        "recalcs_per_step": round(d["RecalcStyleCount"] / STEPS, 1),
        "script_ms": round(d["ScriptDuration"] * 1000, 1),
        "style_ms": round(d["RecalcStyleDuration"] * 1000, 1),
        "layout_ms": round(d["LayoutDuration"] * 1000, 1),
        "long_tasks": len(tasks),
        "long_task_ms": round(sum(t["dur"] for t in tasks), 1),
        "worst_long_task_ms": round(max([t["dur"] for t in tasks], default=0), 1),
    })
    return out


def blame_window(page, seconds):
    page.evaluate("window.__perfArm();")
    page.wait_for_timeout(int(seconds * 1000))
    tally = page.evaluate("window.__perfTally()")
    rafs = page.evaluate("window.__perfRaf()")
    page.evaluate("window.__perfDisarm();")
    return {
        "dom_reads_per_sec": {k: round(v / seconds, 1)
                              for k, v in sorted(tally.items(), key=lambda kv: -kv[1])[:15]},
        "total_reads_per_sec": round(sum(tally.values()) / seconds, 1),
        "raf_owners_per_sec": {k: round(v / seconds, 1)
                               for k, v in sorted(rafs.items(), key=lambda kv: -kv[1])[:10]},
    }


STATE = ("({race:!!window.__hmRaceOn,lava:!!window.__hmLavaOn,"
         " heads:(window.__hmLive||[]).length,"
         " arena:document.querySelectorAll('#playArena [data-hm-boot-ready]').length,"
         " body:document.body.className.slice(0,90)})")


def run(pw, page_name, path, modes, viewports, seconds, do_resize, do_blame,
        headed=False, heads=12, ablations=None, patch=None):
    results = []
    browser = launch(pw, headed)
    for width in viewports:
        for mode in modes:
            page, cdp = open_page(browser, width, do_blame, heads, patch)
            page.goto(f"http://127.0.0.1:{PORT}/{path}", wait_until="load")
            page.wait_for_timeout(4500)
            entry = {"page": page_name, "mode": mode, "viewport": width}
            script = MODES.get(mode)
            if script:
                page.evaluate(script)
                page.wait_for_timeout(4500)  # let the mode settle before counting
            entry["mode_active"] = page.evaluate(STATE)
            entry["run"] = measure(page, cdp, seconds)
            if ablations:
                entry["ablations"] = {}
                for ab in ablations:
                    css = ABLATIONS[ab]
                    page.evaluate(
                        "css=>{var s=document.getElementById('__abl')||"
                        "Object.assign(document.createElement('style'),{id:'__abl'});"
                        "s.textContent=css;document.head.appendChild(s);}", css)
                    page.wait_for_timeout(900)
                    r = measure(page, cdp, seconds)
                    entry["ablations"][ab] = {
                        "fps": r["fps"], "median_ms": r["median_ms"],
                        "dropped_pct": r["dropped_pct"],
                        "style_ms_per_sec": r["style_ms_per_sec"],
                        "gain_fps": round(r["fps"] - entry["run"]["fps"], 1),
                    }
                page.evaluate("()=>{var s=document.getElementById('__abl');if(s)s.remove();}")
            if do_resize and mode == modes[0]:
                entry["resize"] = resize_drag(page, cdp, width, do_blame)
            if do_blame:
                entry["blame"] = blame_window(page, 4)
                entry["census"] = page.evaluate("window.__perfCensus()")
            page.context.close()
            results.append(entry)
    browser.close()
    return results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", default="index,play")
    ap.add_argument("--modes", default="lobby,soccer,tournament,race,battle",
                    help="play.html game modes; index.html always runs 'lobby' (idle)")
    ap.add_argument("--viewports", default="1440,390")
    ap.add_argument("--seconds", type=float, default=6.0)
    ap.add_argument("--no-resize", action="store_true")
    ap.add_argument("--attribute", action="store_true", help="add the DOM-read blame phase")
    ap.add_argument("--headed", action="store_true",
                    help="real window with GPU compositing; headless rasterises in "
                         "software and makes filter/backdrop-filter look far worse than it is")
    ap.add_argument("--heads", type=int, default=12, help="placeholder heads seated at boot")
    ap.add_argument("--patch", default="", choices=[""] + list(PATCHES),
                    help="apply a candidate fix by rewriting the file in flight, "
                         "so a proposed change can be measured before it is recommended")
    ap.add_argument("--ablate", default="",
                    help="comma-separated suspects to switch off one at a time: "
                         + ",".join(k for k in ABLATIONS if k != "none"))
    ap.add_argument("--json")
    ap.add_argument("--label", default="")
    args = ap.parse_args()

    viewports = [int(v) for v in args.viewports.split(",")]
    ablations = [a for a in args.ablate.split(",") if a in ABLATIONS] if args.ablate else None
    pages = args.pages.split(",")
    modes = [m for m in args.modes.split(",") if m in MODES]

    server = serve()
    out = []
    try:
        with sync_playwright() as pw:
            if "index" in pages:
                out += run(pw, "index", "index.html", ["lobby"], viewports,
                           args.seconds, not args.no_resize, args.attribute,
                           args.headed, args.heads, ablations, args.patch or None)
            if "play" in pages:
                out += run(pw, "play", "play.html", modes, viewports,
                           args.seconds, not args.no_resize, args.attribute,
                           args.headed, args.heads, ablations, args.patch or None)
    finally:
        server.shutdown()

    blob = {"label": args.label, "results": out}
    # a compact table first, the detail after
    print("\n  %s  (%s rasteriser%s)" % (args.label or "run",
                                       "GPU" if args.headed else "SOFTWARE",
                                       ", patch=" + args.patch if args.patch else ""))
    print("\n  page/mode            vp    heads    fps   med   p95  worst  drop%  layout/s  style ms/s")
    print("  " + "-" * 94)
    for e in out:
        r = e["run"]
        print("  {:<20} {:<5} {:>5}  {:>5}  {:>4}  {:>4}  {:>5}  {:>5}  {:>8}  {:>10}".format(
            e["page"] + "/" + e["mode"], e["viewport"],
            e.get("mode_active", {}).get("arena", "-"), r["fps"], r["median_ms"],
            r["p95_ms"], r["worst_ms"], r["dropped_pct"], r["layouts_per_sec"],
            r["style_ms_per_sec"]))
    print()
    if args.json:
        Path(args.json).write_text(json.dumps(blob, indent=2))
        print("  detail -> " + args.json)
    else:
        print(json.dumps(blob, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
