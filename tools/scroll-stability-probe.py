#!/usr/bin/env python3
"""Does anything move that should not, and does the page hold 60fps while you scroll?

WHY THIS EXISTS AND WHY IT IS NOT `PerformanceObserver('layout-shift')`.
The environment that matters most for this site is LinkedIn's in-app browser on
iOS -- an embedded WKWebView. WebKit does not implement the Layout Instability
API at all, so the one instrument everybody reaches for returns nothing in the
engine we most need an answer from. Reporting "CLS 0" from Chromium and calling
the phone fixed is exactly the mistake this file exists to stop.

THE ENGINE-NEUTRAL MEASUREMENT. An element's DOCUMENT-relative layout position
(`getBoundingClientRect().top + scrollY`) is invariant under scrolling. So a rAF
loop that records it every frame and reports any change is a layout-shift
detector that needs no browser API, works identically in WebKit and Chromium,
and -- unlike CLS -- keeps working *during* a scroll rather than being suppressed
by the 500ms input window. Every change it reports is a real re-layout.

WHAT IS DELIBERATELY EXCLUDED FROM THE SAMPLE, because each one moves BY DESIGN
and would otherwise drown the signal:
  * position:sticky / fixed elements and everything inside them (the header bar,
    the chapter rail, the sticky photo column on About) -- their whole job is to
    move relative to the document.
  * anything with a live transform (matrix != identity), and anything inside one.
    A transform is composited, contributes no layout, and shifts no neighbour.
  * elements inside a horizontally-scrollable box (.scrollbox and friends): their
    doc-relative position legitimately changes when that box scrolls.
So a reported mover is a node whose STATIC LAYOUT BOX moved -- the class of
motion that pushes its neighbours around, which is what Jayden is describing
when he says things move around too much.

TWO PASSES, NEVER ONE. Reading 300 rects a frame costs more than the page does.
The frame-rate pass reads NOTHING from the DOM; the shift pass reads rects and
its fps figure is discarded. Mixing them is how you measure your own instrument.
(Same reason tools/performance-probe.py splits its attribution phase out.)

WHAT TO TRUST AND WHAT TO DISCOUNT
  TRUST  the mover list, the moved-pixel totals, the frame counts, and the
         WebKit-vs-Chromium delta. Those are counters and geometry.
  TRUST  long-task counts and TBT in Chromium (CDP-backed).
  NEVER RUN TWO OF THESE AT ONCE, and never alongside another browser job. Under
         CPU contention the scroll loop stops advancing between animation frames
         and the run reports a 22-frame "stall" on a page that scrolls 588 frames
         when it has the machine to itself. Every cell that stalls is printed
         with a STALL flag for exactly that reason -- a stalled cell measured the
         host, not the page, and must be thrown away rather than read.
  DISCOUNT absolute paint milliseconds: headless rasterises on the CPU, so
         filter/backdrop-filter look far worse here than on a real phone.
         Compare before against after under identical conditions instead.

USAGE
    python3 tools/scroll-stability-probe.py
    python3 tools/scroll-stability-probe.py --pages about.html --widths 390
    python3 tools/scroll-stability-probe.py --engines webkit
    python3 tools/scroll-stability-probe.py --root /tmp/pristine --json before.json
    python3 tools/scroll-stability-probe.py --compare before.json after.json
    python3 tools/scroll-stability-probe.py --self-test
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

REPO = Path(__file__).resolve().parents[1]
PORT = int(os.environ.get("SCROLL_PROBE_PORT", "4808"))

PAGES = ["about.html", "apollo.html", "bearings.html", "cluster.html",
         "strata.html", "ucdavis.html", "gradientlab.html"]

# (label, width, height, deviceScaleFactor, isMobile)
VIEWPORTS = {
    "320": ("iphone-se-320", 320, 568, 2, True),
    "390": ("iphone-390", 390, 844, 3, True),
    "1440": ("desktop-1440", 1440, 900, 2, False),
}

# ---------------------------------------------------------------- shift sampler
#
# Installed before any page script runs. Collects the sample lazily on first
# tick so the DOM is complete, then walks it every frame.
SHIFT_JS = r"""
(() => {
  const MOVE_EPS = 0.5;      // sub-pixel rounding is not a shift
  const CAP = 420;           // read budget per frame

  window.__shift = { movers: {}, frames: 0, total: 0, ready: false };

  function eligible(el) {
    // Walk up: anything sticky/fixed/transformed, or inside such, is excluded --
    // those move by design and say nothing about layout stability.
    let n = el;
    let depth = 0;
    while (n && n !== document.documentElement && depth++ < 40) {
      const s = getComputedStyle(n);
      if (s.position === 'sticky' || s.position === 'fixed') return false;
      if (s.transform && s.transform !== 'none' &&
          s.transform !== 'matrix(1, 0, 0, 1, 0, 0)') return false;
      if (s.overflowX === 'auto' || s.overflowX === 'scroll') return false;
      if (s.contentVisibility === 'hidden') return false;
      n = n.parentElement;
    }
    return true;
  }

  function label(el) {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (el.className && typeof el.className === 'string') {
      const c = el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (c.length) s += '.' + c.join('.');
    }
    return s;
  }

  let sample = null, prev = null, keys = null;

  function collect() {
    const all = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (!eligible(el)) continue;
      all.push(el);
    }
    // Even stride rather than the first N, so the tail of a long page is covered.
    const step = Math.max(1, Math.ceil(all.length / CAP));
    sample = all.filter((_, i) => i % step === 0).slice(0, CAP);
    keys = sample.map(label);
    prev = sample.map(el => {
      const r = el.getBoundingClientRect();
      return [r.top + window.scrollY, r.left + window.scrollX, r.height];
    });
    window.__shift.sampled = sample.length;
    window.__shift.pool = all.length;
    window.__shift.ready = true;
  }

  function tick() {
    if (!sample) { collect(); requestAnimationFrame(tick); return; }
    const sy = window.scrollY, sx = window.scrollX;
    const m = window.__shift.movers;
    for (let i = 0; i < sample.length; i++) {
      const el = sample[i];
      if (!el.isConnected) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 && r.height < 1) continue;   // hidden this frame; not a shift
      const top = r.top + sy, left = r.left + sx;
      const p = prev[i];
      const dy = Math.abs(top - p[0]), dx = Math.abs(left - p[1]);
      const dh = Math.abs(r.height - p[2]);
      if (dy > MOVE_EPS || dx > MOVE_EPS || dh > MOVE_EPS) {
        const k = keys[i];
        const rec = m[k] || (m[k] = { n: 0, maxDy: 0, maxDx: 0, maxDh: 0, atY: [] });
        rec.n++;
        rec.maxDy = Math.max(rec.maxDy, dy);
        rec.maxDx = Math.max(rec.maxDx, dx);
        rec.maxDh = Math.max(rec.maxDh, dh);
        if (rec.atY.length < 4) rec.atY.push(Math.round(sy));
        window.__shift.total += dy + dx;
        prev[i] = [top, left, r.height];
      }
    }
    window.__shift.frames++;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
"""

# ---------------------------------------------------------------- frame sampler
# Reads nothing from the DOM. Frame deltas only.
FPS_JS = r"""
(() => {
  window.__fps = { d: [], last: 0 };
  function tick(t) {
    if (window.__fps.last) window.__fps.d.push(t - window.__fps.last);
    window.__fps.last = t;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
"""

# ---------------------------------------------------------------- web-vitals
# Chromium only: LayoutShift + LCP + longtask are Blink-only APIs.
VITALS_JS = r"""
(() => {
  window.__v = { cls: 0, shifts: [], lcp: 0, longTasks: [], blocking: 0 };
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue;
        window.__v.cls += e.value;
        const srcs = (e.sources || []).map(s => {
          const n = s.node;
          if (!n || n.nodeType !== 1) return '(anon)';
          let t = n.tagName.toLowerCase();
          if (n.id) t += '#' + n.id;
          else if (n.className && typeof n.className === 'string') {
            const c = n.className.trim().split(/\s+/).slice(0, 2).join('.');
            if (c) t += '.' + c;
          }
          return t;
        });
        window.__v.shifts.push({ v: e.value, t: Math.round(e.startTime), srcs });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver(list => {
      const es = list.getEntries();
      window.__v.lcp = Math.round(es[es.length - 1].startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        window.__v.longTasks.push(Math.round(e.duration));
        window.__v.blocking += Math.max(0, e.duration - 50);
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch (e) {}
})();
"""

# A scroll that behaves like a finger: a fixed pixel step every animation frame,
# all the way down and back up. Programmatic, so both engines get the identical
# input and the comparison is honest.
#
# THE STALL GUARD IS NOT OPTIONAL, and it cost 40 minutes to learn why.
# gradientlab.html computes overflow:hidden on html AND body -- it is a stage, not
# a document. scrollBy() there is a no-op, scrollY never leaves 0, and the naive
# "stop when you reach the bottom" loop spins forever inside page.evaluate(),
# which has no timeout in Playwright. Any page that stops advancing for 20 frames
# is finished, whether it ran out of document or never had any.
SCROLL_JS = r"""
([step, maxFrames]) => new Promise(resolve => {
  let dir = 1, n = 0, stuck = 0, prev = -1;
  function frame() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const y = window.scrollY;
    if (y === prev) { if (++stuck > 20) { resolve({ frames: n, stalled: true }); return; } }
    else stuck = 0;
    prev = y;
    if (dir > 0 && y >= max - 1) { dir = -1; stuck = 0; }
    else if (dir < 0 && y <= 0 && n > 4) { resolve({ frames: n, stalled: false }); return; }
    if (++n > maxFrames) { resolve({ frames: n, stalled: false, capped: true }); return; }
    // behavior:'instant' IS LOAD-BEARING. Every page here sets
    // `html{scroll-behavior:smooth}`, which turns a bare scrollBy() into an
    // ANIMATED scroll -- and calling it again next frame retargets the animation
    // before it has travelled, so the page creeps and the probe reads a stall
    // that is its own doing. A finger is instant; the instrument must be too.
    window.scrollBy({ top: step * dir, left: 0, behavior: 'instant' });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})
"""


class DelayingHandler(SimpleHTTPRequestHandler):
    """Images arrive late, the way they do on a phone on mobile data.

    THIS IS THE POINT OF THE PROBE, NOT A GARNISH. Served off a warm local disk
    every image is decoded before its first paint, so an <img> with no reserved
    box never gets the chance to jump -- the exact defect a recruiter on LTE
    would see is invisible to a localhost measurement. Delaying image bytes and
    nothing else reproduces it in BOTH engines, which CDP throttling cannot do
    (Playwright's WebKit has no network-throttling API at all).
    """
    img_delay_ms = 0

    def send_head(self):
        if self.img_delay_ms and self.path.rsplit("?", 1)[0].lower().endswith(
                (".webp", ".jpg", ".jpeg", ".png", ".gif", ".avif", ".svg", ".mp4")):
            import time
            time.sleep(self.img_delay_ms / 1000.0)
        return super().send_head()

    def log_message(self, *a):
        pass


def serve(root: Path, port: int, img_delay: int = 0):
    handler = partial(DelayingHandler, directory=str(root))
    DelayingHandler.img_delay_ms = img_delay
    srv = ThreadingHTTPServer(("127.0.0.1", port), handler)
    Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def new_context(browser, vp):
    _label, w, h, dsf, mobile = vp
    kw = dict(viewport={"width": w, "height": h}, device_scale_factor=dsf)
    if mobile:
        # An in-app WKWebView is a mobile UA with touch and no hover. Chromium
        # refuses is_mobile, so the two engines are matched on what both accept.
        kw["has_touch"] = True
        kw["is_mobile"] = True
    try:
        return browser.new_context(**kw)
    except Exception:
        kw.pop("is_mobile", None)
        return browser.new_context(**kw)


def measure(browser, url, vp, engine, step):
    out = {}

    # ---- pass 1: frame rate. No DOM reads anywhere in this window.
    ctx = new_context(browser, vp)
    pg = ctx.new_page()
    pg.goto(url, wait_until="load", timeout=45000)
    pg.wait_for_timeout(1400)          # fonts, lazy images, entrance animations
    pg.evaluate(FPS_JS)
    pg.wait_for_timeout(200)
    out["scroll"] = pg.evaluate(SCROLL_JS, [step, 1200])
    d = pg.evaluate("window.__fps.d")
    out["docHeight"] = pg.evaluate("document.documentElement.scrollHeight")
    ctx.close()
    d = [x for x in d if x > 0]
    if d:
        d_sorted = sorted(d)
        out["frames"] = len(d)
        out["medianMs"] = round(statistics.median(d), 2)
        out["p95Ms"] = round(d_sorted[int(len(d) * 0.95) - 1], 2)
        out["worstMs"] = round(max(d), 2)
        out["fpsMedian"] = round(1000 / statistics.median(d), 1)
        out["fpsWorst"] = round(1000 / max(d), 1)
        out["over20"] = sum(1 for x in d if x > 20)
        out["over33"] = sum(1 for x in d if x > 33)
        out["pctOver20"] = round(100 * out["over20"] / len(d), 1)
    else:
        out["frames"] = 0

    # ---- pass 2: layout shift, engine-neutral. fps here is meaningless.
    ctx = new_context(browser, vp)
    pg = ctx.new_page()
    pg.add_init_script(SHIFT_JS)       # armed before the page's own scripts run
    if engine == "chromium":
        pg.add_init_script(VITALS_JS)
    pg.goto(url, wait_until="load", timeout=45000)
    pg.wait_for_timeout(1800)
    pg.evaluate(SCROLL_JS, [step, 1200])
    pg.wait_for_timeout(700)           # a beat of stillness: late repaints land here
    sh = pg.evaluate("window.__shift")
    if engine == "chromium":
        out["vitals"] = pg.evaluate("window.__v")
    ctx.close()

    movers = sorted(
        ({"sel": k, **v} for k, v in sh.get("movers", {}).items()),
        key=lambda r: -(r["maxDy"] + r["maxDx"]),
    )
    out["sampled"] = sh.get("sampled", 0)
    out["pool"] = sh.get("pool", 0)
    out["shiftFrames"] = sh.get("frames", 0)
    out["movedPx"] = round(sh.get("total", 0), 1)
    out["movers"] = movers[:12]
    out["moverCount"] = len(movers)
    return out


def run(root, pages, widths, engines, step, port, img_delay=0):
    srv = serve(root, port, img_delay)
    results = {}
    try:
        with sync_playwright() as p:
            for engine in engines:
                browser = getattr(p, engine).launch()
                for page in pages:
                    for wkey in widths:
                        vp = VIEWPORTS[wkey]
                        url = f"http://127.0.0.1:{port}/{page}"
                        key = f"{page}|{wkey}|{engine}"
                        try:
                            results[key] = measure(browser, url, vp, engine, step)
                        except Exception as exc:      # a page that will not load is a finding
                            results[key] = {"error": repr(exc)[:300]}
                        r = results[key]
                        if "error" in r:
                            print(f"{key:<44} ERROR {r['error'][:90]}")
                        else:
                            v = r.get("vitals") or {}
                            extra = ""
                            if v:
                                extra = (f"  CLS {v['cls']:.4f}  LCP {v['lcp']}ms"
                                         f"  TBT {round(v['blocking'])}ms")
                            print(f"{key:<44} worst {r['worstMs']:>7.1f}ms "
                                  f"({r['fpsWorst']:>5.1f}fps)  >20ms {r['over20']:>3}"
                                  f"/{r['frames']:<4} movers {r['moverCount']:>2} "
                                  f"moved {r['movedPx']:>8.1f}px{extra}", flush=True)
                browser.close()
    finally:
        srv.shutdown()
    return results


def report(results):
    print("\n" + "=" * 78)
    print("MOVERS  (a node whose STATIC layout box moved -- every one is real)")
    print("=" * 78)
    any_mover = False
    for key, r in sorted(results.items()):
        movs = [m for m in r.get("movers", []) if (m["maxDy"] + m["maxDx"]) >= 1]
        if not movs:
            continue
        any_mover = True
        print(f"\n{key}   total {r['movedPx']}px over {r['sampled']} sampled nodes")
        for m in movs[:8]:
            print(f"   {m['sel']:<38} dy{m['maxDy']:>7.1f} dx{m['maxDx']:>7.1f} "
                  f"dh{m['maxDh']:>7.1f}  x{m['n']:<4} atY={m['atY']}")
    if not any_mover:
        print("  none >= 1px anywhere.")

    print("\n" + "=" * 78)
    print("WORST-CASE FRAME DURING SCROLL  (worst, not median)")
    print("=" * 78)
    print(f"{'page|width|engine':<44}{'worst':>9}{'p95':>9}{'median':>9}{'>20ms':>8}{'>33ms':>8}")
    for key, r in sorted(results.items()):
        if "error" in r or not r.get("frames"):
            continue
        print(f"{key:<44}{r['worstMs']:>9.1f}{r['p95Ms']:>9.1f}"
              f"{r['medianMs']:>9.1f}{r['over20']:>8}{r['over33']:>8}")

    print("\n" + "=" * 78)
    print("CHROMIUM WEB VITALS  (WebKit implements none of these APIs)")
    print("=" * 78)
    print(f"{'page|width':<32}{'CLS':>9}{'LCP ms':>9}{'TBT ms':>9}  top shift source")
    for key, r in sorted(results.items()):
        v = r.get("vitals")
        if not v:
            continue
        src = ""
        if v["shifts"]:
            worst = max(v["shifts"], key=lambda s: s["v"])
            src = f"{worst['v']:.4f} @{worst['t']}ms {','.join(worst['srcs'][:2])}"
        short = key.rsplit("|", 1)[0]
        print(f"{short:<32}{v['cls']:>9.4f}{v['lcp']:>9}{round(v['blocking']):>9}  {src}")


def compare(before_path, after_path):
    b = json.loads(Path(before_path).read_text())
    a = json.loads(Path(after_path).read_text())
    print(f"{'key':<44}{'worst ms':>18}{'>20ms':>14}{'movedPx':>18}{'CLS':>16}")
    for key in sorted(set(b) | set(a)):
        rb, ra = b.get(key, {}), a.get(key, {})
        if "error" in rb or "error" in ra or not rb or not ra:
            continue
        vb = (rb.get("vitals") or {}).get("cls")
        va = (ra.get("vitals") or {}).get("cls")
        cls = f"{vb:.4f}->{va:.4f}" if vb is not None and va is not None else ""
        print(f"{key:<44}"
              f"{rb['worstMs']:>8.1f}->{ra['worstMs']:<9.1f}"
              f"{rb['over20']:>6}->{ra['over20']:<7}"
              f"{rb['movedPx']:>8.1f}->{ra['movedPx']:<9.1f}"
              f"{cls:>16}")


def self_test(port):
    """Re-inject the bug the probe exists to catch, and fail if it is not caught.

    A detector nobody has watched fail is one nobody should trust. This writes a
    page whose block genuinely re-lays-out mid-scroll (an image that arrives with
    no reserved box), runs the probe against it, and asserts the mover is named.
    """
    tmp = Path(os.environ.get("TMPDIR", "/tmp")) / "scroll-probe-selftest"
    tmp.mkdir(parents=True, exist_ok=True)
    (tmp / "t.html").write_text(
        "<!doctype html><meta name=viewport content='width=device-width'>"
        "<style>body{margin:0}div{height:800px}#late{height:0;background:#ccc}</style>"
        "<div>a</div><div id=late></div><div id=below>below</div>"
        "<div>b</div><div>c</div><div>d</div>"
        "<script>setTimeout(()=>{document.getElementById('late').style.height='260px'},900)"
        "</script>"
    )
    res = run(tmp, ["t.html"], ["390"], ["chromium"], 40, port)
    r = res["t.html|390|chromium"]
    hit = [m for m in r.get("movers", []) if m["sel"] == "div#below" and m["maxDy"] > 200]
    print()
    if hit:
        print(f"SELF-TEST PASS  caught div#below moving {hit[0]['maxDy']:.0f}px")
        return 0
    print(f"SELF-TEST FAIL  movers were {[m['sel'] for m in r.get('movers', [])]}")
    return 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", default=",".join(PAGES))
    ap.add_argument("--widths", default="390,320,1440")
    ap.add_argument("--engines", default="webkit,chromium")
    ap.add_argument("--root", default=str(REPO))
    ap.add_argument("--step", type=int, default=48, help="px scrolled per frame")
    ap.add_argument("--img-delay", type=int, default=0,
                    help="ms to stall every image response -- reproduces a phone on "
                         "mobile data, where an unreserved <img> box jumps")
    ap.add_argument("--port", type=int, default=PORT)
    ap.add_argument("--json")
    ap.add_argument("--compare", nargs=2)
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    if args.compare:
        compare(*args.compare)
        return 0
    if args.self_test:
        return self_test(args.port)

    results = run(Path(args.root), args.pages.split(","), args.widths.split(","),
                  args.engines.split(","), args.step, args.port, args.img_delay)
    report(results)
    if args.json:
        Path(args.json).write_text(json.dumps(results, indent=1))
        print(f"\nwrote {args.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
