#!/usr/bin/env python3
"""Every shipping page, rendered in real WebKit, at iPhone and desktop widths.

WHY THIS EXISTS. This site has already shipped one WebKit-only bug that broke a
core feature invisibly: `setProperty` without a priority argument clears an
`!important` flag in Blink and does NOT in WebKit, so the hero portrait never
moved on any iPhone -- no drag, no float, not even its resting tilt -- while its
selection frame tracked the finger perfectly. Reading the code could not find
it. Running Chromium could not find it. Only real WebKit could.

So this sweep does not read CSS looking for risky features. It loads each page
in Playwright's WebKit and in Chromium, and reports where the two DISAGREE --
plus the failures that are absolute rather than comparative (a page error, a
page that scrolls sideways on a phone, a custom property that never registered).

WHAT IT CHECKS, and why each one is here:

  page errors        An uncaught exception in WebKit and not Chromium is the
                     signature of the bug class above.
  horizontal overflow  The single most common iOS-Safari-only layout defect,
                     and invisible on desktop. Measured against the layout
                     viewport, with a 1px tolerance for sub-pixel rounding.
  feature support    CSS.supports() for the newer things this site leans on:
                     corner-shape, backdrop-filter (prefixed and not), dvh
                     units, linear() easing, color-mix, oklch, :has().
                     A feature Chromium supports and WebKit does not is a
                     degradation; whether it degrades GRACEFULLY is a judgement
                     the report has to make, not this script.
  @property          Registered custom properties that fail to register do not
                     interpolate, they SNAP. Counted live via CSS.registeredProperty
                     probing -- a registration that parsed is one whose initial
                     value is readable off a fresh element.
  dvh                100dvh vs 100vh on a phone is the address-bar problem.
                     Reported as measured pixels, not as a support boolean.

Run:  python3 tools/webkit-compat-sweep.py
      python3 tools/webkit-compat-sweep.py --self-test
      python3 tools/webkit-compat-sweep.py --page index.html --engine webkit
"""
import argparse
import json
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = 8349

PAGES = [
    "index.html", "about.html", "play.html", "headmaker.html", "gradientlab.html",
    "apollo.html", "bearings.html", "cluster.html", "strata.html", "ucdavis.html",
    "yowmings.html",
]

# (label, width, height, is_mobile)
VIEWPORTS = [("iphone-390", 390, 844), ("desktop-1440", 1440, 900)]

FEATURE_PROBES = {
    "corner-shape":            "CSS.supports('corner-shape','squircle')",
    "backdrop-filter":         "CSS.supports('backdrop-filter','blur(4px)')",
    "-webkit-backdrop-filter": "CSS.supports('-webkit-backdrop-filter','blur(4px)')",
    "dvh-unit":                "CSS.supports('height','100dvh')",
    "linear()-easing":         "CSS.supports('transition-timing-function','linear(0,1)')",
    "color-mix":               "CSS.supports('color','color-mix(in srgb, red, blue)')",
    "oklch":                   "CSS.supports('color','oklch(0.5 0.1 200)')",
    ":has()":                  "CSS.supports('selector(:has(a))')",
    "mask-image":              "CSS.supports('mask-image','linear-gradient(#000,#0000)')",
    "-webkit-mask-image":      "CSS.supports('-webkit-mask-image','linear-gradient(#000,#0000)')",
    "text-wrap-balance":       "CSS.supports('text-wrap','balance')",
    "@property":               "typeof CSS!=='undefined' && typeof CSS.registerProperty==='function'",
}

# Measured inside the page. Returns everything the report needs in one round trip.
PROBE_JS = r"""
(() => {
  const out = {};
  const de = document.documentElement;

  // --- horizontal overflow, the iOS-only layout killer -------------------
  const layoutW = de.clientWidth;
  out.layoutWidth = layoutW;
  out.scrollWidth = de.scrollWidth;
  out.overflowPx  = Math.round((de.scrollWidth - layoutW) * 100) / 100;
  // Name the widest offenders so the finding is actionable, not just a number.
  const offenders = [];
  if (out.overflowPx > 1) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const right = r.right + (window.scrollX || 0);
      if (right > layoutW + 1) {
        offenders.push({
          sel: el.tagName.toLowerCase() +
               (el.id ? '#' + el.id : '') +
               (el.className && typeof el.className === 'string'
                  ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
          right: Math.round(right),
          overhang: Math.round(right - layoutW),
        });
      }
    }
    offenders.sort((a, b) => b.overhang - a.overhang);
  }
  out.offenders = offenders.slice(0, 6);

  // --- dvh vs vh, measured in real pixels --------------------------------
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:1px';
  document.body.appendChild(probe);
  const px = (v) => { probe.style.height = v; return probe.getBoundingClientRect().height; };
  out.vh100  = Math.round(px('100vh'));
  out.dvh100 = Math.round(px('100dvh'));
  out.svh100 = Math.round(px('100svh'));
  probe.remove();

  // --- @property: registered, or silently snapping? ----------------------
  // A registered property resolves its initial value on an element that never
  // declared it. An unregistered one resolves to the empty string.
  const REG = %REGNAMES%;
  const spare = document.createElement('div');
  document.body.appendChild(spare);
  const cs = getComputedStyle(spare);
  out.registered = {};
  for (const n of REG) {
    const v = cs.getPropertyValue(n).trim();
    out.registered[n] = v === '' ? null : v;
  }
  spare.remove();
  out.registeredCount = Object.values(out.registered).filter(v => v !== null).length;
  out.registeredTotal = REG.length;

  // --- did the visual systems actually paint? ----------------------------
  const seen = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      w: Math.round(r.width), h: Math.round(r.height),
      display: s.display, visibility: s.visibility,
      opacity: s.opacity,
      painted: r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none',
    };
  };
  out.landmarks = {
    h1:     seen('h1'),
    header: seen('header, .jbNav, [role=banner]'),
    footer: seen('footer, [role=contentinfo]'),
  };

  // --- how many elements actually carry the risky properties -------------
  let bdf = 0, mask = 0, corner = 0;
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el);
    const b = s.backdropFilter || s.webkitBackdropFilter || 'none';
    if (b && b !== 'none') bdf++;
    const m = s.maskImage || s.webkitMaskImage || 'none';
    if (m && m !== 'none') mask++;
    const c = s.getPropertyValue('corner-shape').trim();
    if (c && c !== '' && c !== 'round') corner++;
  }
  out.effective = { backdropFilter: bdf, maskImage: mask, cornerShape: corner };

  out.title = document.title;
  out.h1Count = document.querySelectorAll('h1').length;
  return out;
})()
"""


def reg_names():
    """Every @property this site registers, read out of the source."""
    import re
    names = set()
    for p in list(ROOT.glob("*.css")) + list(ROOT.glob("*.html")):
        try:
            txt = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for m in re.finditer(r"@property\s+(--[A-Za-z0-9_-]+)", txt):
            names.add(m.group(1))
    return sorted(names)


def serve():
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def run(pages, engines, break_corner_shape=False):
    names = reg_names()
    probe = PROBE_JS.replace("%REGNAMES%", json.dumps(names))
    results = {}
    with sync_playwright() as pw:
        for eng in engines:
            browser = getattr(pw, eng).launch()
            results[eng] = {}
            for vlabel, w, h in VIEWPORTS:
                ctx = browser.new_context(
                    viewport={"width": w, "height": h},
                    device_scale_factor=2 if w == 390 else 1,
                    is_mobile=(w == 390),
                    has_touch=(w == 390),
                    user_agent=(
                        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) "
                        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1"
                        if w == 390 else None
                    ),
                )
                for page_name in pages:
                    pg = ctx.new_page()
                    errors, console_errors = [], []
                    pg.on("pageerror", lambda e: errors.append(str(e)[:300]))
                    pg.on("console", lambda m: console_errors.append(m.text[:300])
                          if m.type == "error" else None)
                    if break_corner_shape:
                        # SELF-TEST: inject an element that overhangs the viewport,
                        # which is exactly the defect class this sweep must catch.
                        pg.add_init_script(
                            "addEventListener('DOMContentLoaded',()=>{"
                            "const d=document.createElement('div');"
                            "d.style.cssText='position:absolute;left:0;top:0;width:150vw;height:10px';"
                            "document.body.appendChild(d);})"
                        )
                    try:
                        pg.goto(f"http://127.0.0.1:{PORT}/{page_name}",
                                wait_until="load", timeout=45000)
                        pg.wait_for_timeout(1400)
                        feats = {k: pg.evaluate(f"()=>{{try{{return !!({v})}}catch(e){{return null}}}}")
                                 for k, v in FEATURE_PROBES.items()}
                        data = pg.evaluate(probe)
                    except Exception as exc:  # noqa: BLE001
                        data, feats = {"fatal": str(exc)[:300]}, {}
                    data["pageErrors"] = errors
                    data["consoleErrors"] = console_errors
                    data["features"] = feats
                    results[eng].setdefault(vlabel, {})[page_name] = data
                    pg.close()
                ctx.close()
            browser.close()
    return results


def report(results, pages):
    fails, warns = [], []
    engines = list(results)

    # ---- feature support divergence (engine-level, viewport-independent) ----
    print("\n=== FEATURE SUPPORT ===")
    ref = results[engines[0]]["desktop-1440"][pages[0]].get("features", {})
    print(f"{'feature':<26}" + "".join(f"{e:>12}" for e in engines))
    for feat in FEATURE_PROBES:
        row = []
        for e in engines:
            v = results[e]["desktop-1440"][pages[0]].get("features", {}).get(feat)
            row.append("yes" if v else ("no" if v is False else "?"))
        flag = ""
        if len(set(row)) > 1:
            flag = "   <-- DIVERGES"
            warns.append(f"feature {feat}: " + ", ".join(f"{e}={r}" for e, r in zip(engines, row)))
        print(f"{feat:<26}" + "".join(f"{r:>12}" for r in row) + flag)

    # ---- per page ----
    for vlabel, _, _ in VIEWPORTS:
        print(f"\n=== {vlabel} ===")
        print(f"{'page':<18}{'engine':<10}{'overflow':>9}{'h1':>4}{'@prop':>8}"
              f"{'bdf':>5}{'mask':>6}{'corner':>7}{'err':>5}")
        for page_name in pages:
            for e in engines:
                d = results[e][vlabel][page_name]
                if "fatal" in d:
                    print(f"{page_name:<18}{e:<10}  FATAL {d['fatal'][:50]}")
                    fails.append(f"{page_name} [{e}/{vlabel}] fatal: {d['fatal'][:120]}")
                    continue
                ov = d["overflowPx"]
                nerr = len(d["pageErrors"])
                eff = d["effective"]
                print(f"{page_name:<18}{e:<10}{ov:>9}{d['h1Count']:>4}"
                      f"{d['registeredCount']:>4}/{d['registeredTotal']:<3}"
                      f"{eff['backdropFilter']:>5}{eff['maskImage']:>6}"
                      f"{eff['cornerShape']:>7}{nerr:>5}")
                if ov > 1:
                    fails.append(
                        f"{page_name} [{e}/{vlabel}] scrolls sideways by {ov}px; "
                        f"widest: " + ", ".join(
                            f"{o['sel']} (+{o['overhang']}px)" for o in d["offenders"][:3]))
                if nerr:
                    fails.append(f"{page_name} [{e}/{vlabel}] page error: {d['pageErrors'][0][:160]}")
                if d["registeredCount"] < d["registeredTotal"]:
                    missing = [k for k, v in d["registered"].items() if v is None]
                    warns.append(f"{page_name} [{e}/{vlabel}] {len(missing)} @property "
                                 f"not registered (they SNAP, not interpolate): {missing[:6]}")
                lm = d["landmarks"]
                if lm.get("h1") and not lm["h1"]["painted"]:
                    warns.append(f"{page_name} [{e}/{vlabel}] h1 present but not painted")

    # ---- dvh, reported as pixels ----
    print("\n=== VIEWPORT UNITS (iphone-390) ===")
    print(f"{'page':<18}{'engine':<10}{'100vh':>7}{'100dvh':>8}{'100svh':>8}")
    for page_name in pages:
        for e in engines:
            d = results[e]["iphone-390"][page_name]
            if "fatal" in d:
                continue
            print(f"{page_name:<18}{e:<10}{d['vh100']:>7}{d['dvh100']:>8}{d['svh100']:>8}")

    # ---- engine disagreement on effective use ----
    if len(engines) > 1:
        print("\n=== WEBKIT vs CHROMIUM DISAGREEMENT ===")
        found = False
        for vlabel, _, _ in VIEWPORTS:
            for page_name in pages:
                a = results[engines[0]][vlabel][page_name]
                b = results[engines[1]][vlabel][page_name]
                if "fatal" in a or "fatal" in b:
                    continue
                for key in ("backdropFilter", "maskImage", "cornerShape"):
                    if a["effective"][key] != b["effective"][key]:
                        found = True
                        msg = (f"{page_name} [{vlabel}] {key}: "
                               f"{engines[0]}={a['effective'][key]} "
                               f"{engines[1]}={b['effective'][key]}")
                        print("  " + msg)
                        warns.append(msg)
                if a["h1Count"] != b["h1Count"]:
                    found = True
                    print(f"  {page_name} [{vlabel}] h1 count differs")
        if not found:
            print("  none")

    print("\n" + "=" * 72)
    for f in fails:
        print("FAIL  " + f)
    for w in warns:
        print("WARN  " + w)
    print("=" * 72)
    print(f"STATUS={'FAIL' if fails else 'PASS'}  "
          f"{len(fails)} failure(s), {len(warns)} warning(s)")
    return 1 if fails else 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--page", action="append")
    ap.add_argument("--engine", action="append", choices=["webkit", "chromium"])
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    pages = args.page or PAGES
    engines = args.engine or ["webkit", "chromium"]
    httpd = serve()
    try:
        if args.self_test:
            # Re-inject the defect this sweep exists to catch: an element that
            # overhangs the layout viewport. A sweep that cannot fail is a sweep
            # nobody should trust.
            print("SELF-TEST: injecting a 150vw element into every page.")
            res = run(pages[:1], ["webkit"], break_corner_shape=True)
            d = res["webkit"]["iphone-390"][pages[0]]
            ok = d["overflowPx"] > 1
            print(f"  measured overflow: {d['overflowPx']}px "
                  f"(offenders: {[o['sel'] for o in d['offenders'][:3]]})")
            print("SELF-TEST " + ("PASS  the injected overflow was caught."
                                  if ok else "FAIL  the injected overflow was MISSED."))
            return 0 if ok else 1
        res = run(pages, engines)
        return report(res, pages)
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    sys.exit(main())
