#!/usr/bin/env python3
"""
TREATMENT CONTRACT -- the six things the 2026-08-10 design-system pass fixed, and
what has to stay true for them to stay fixed.

Every assertion here replaced a bug that a human found by looking, not a gate.
Four of the six were rules that READ correctly and did not RUN, so every check
below reads a COMPUTED value or a hit-test result, never the source text.

  A1  EXTRAS SITS WHERE ITS SIBLINGS SIT.  Jayden: "the extra video thumbnail is
      still not on the same spacing as the others -- sitting on the tab line
      while the others sit below."  At 390 the reel started 0px under the tab
      hairline and every .csFrame started 16.875px under it.  The two stages now
      read one --work-stage-pad; this asserts they still resolve equal.

  A2  THE VIDEO POP-UP OUTRANKS THE STICKY HEADER.  header.css:69 justifies the
      bar's z-index:100 with "the reel overlay at 130"; the overlay was at 90, so
      the bar painted over the player.  Measured, that made the Close button dead
      to a tap at 390 and 80% dead at 1280.

  A3  ITS CLOSE CONTROL IS A REAL, REACHABLE 44px TARGET.  Not "declares 44" --
      elementFromPoint at all four corners has to come back as the button itself.
      When .reelClose adopted .ctl, `.ctl{position:relative}` beat
      `.reelClose{position:fixed}` and threw the button off the left edge of its
      own scrim while getComputedStyle still reported top:24px right:24px.

  A4  NO CAST SHADOW ON CHROME.  The heads cast contact shadows because they are
      standing on something.  Nothing else does.  Checked on the COMPUTED
      box-shadow, so a token that grows a drop layer is caught too.

  A5  index.html LINKS controls.css BEFORE header.css.  Six pages did; index did
      not, and that single coin-flip produced both A3 and the nav-icon shrink.
      The library declares the default, header.css declares what the bar does
      differently, so header.css has to be able to win a (0,2,0) tie.

  A6  THE BAR ITEMS ARE ON THE LIBRARY.  35 controls across 7 pages carry
      `ctl ctl--nav`, and the bar's icons still draw at --ico-md.  Adoption that
      changes a pixel is not adoption, it is a redesign.

--self-test re-injects A1, A2 and A3 one at a time and expects each to FAIL.  A
detector nobody has watched fail is one nobody should trust.

Usage:
    python3 tools/treatment-contract.py [--self-test] [--port 4187]
"""
import argparse, json, subprocess, sys, threading, time, http.server, socketserver, os, functools

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIDTHS = [1440, 1280, 390]
NAV_PAGES = ["index.html", "about.html", "bearings.html", "apollo.html",
             "cluster.html", "ucdavis.html", "strata.html"]

# The three injections. Each is CSS or JS that reinstates exactly one shipped bug.
INJECT = {
    "A1": ".csPanel[data-panel='goodness'] .reelStage{padding:0!important}",
    "A2": ".reelOverlay{z-index:90!important}",
    "A3": ".reelOverlay .reelClose{position:relative!important}",
}


def serve(port):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    class Q(socketserver.TCPServer):
        allow_reuse_address = True
    httpd = Q(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def run(port, inject=None):
    """Returns (failures, notes). `inject` is a key of INJECT or None."""
    from playwright.sync_api import sync_playwright
    fails, notes = [], []
    base = f"http://127.0.0.1:{port}/"
    css = INJECT.get(inject)

    with sync_playwright() as pw:
        b = pw.chromium.launch()

        # ---- A5: link order, read from the live document, not the file text ----
        ctx = b.new_context(viewport={"width": 1440, "height": 900})
        pg = ctx.new_page()
        pg.goto(base + "index.html", wait_until="load")
        order = pg.evaluate("""() => [...document.querySelectorAll('link[rel=stylesheet]')]
            .map(l => l.href.split('/').pop().split('?')[0])""")
        try:
            if order.index("controls.css") > order.index("header.css"):
                fails.append("A5 index.html links controls.css AFTER header.css; "
                             f"header.css can no longer win a (0,2,0) tie. order={order}")
            else:
                notes.append(f"A5 ok: {' '.join(order)}")
        except ValueError:
            fails.append(f"A5 index.html is missing controls.css or header.css: {order}")
        ctx.close()

        # ---- A6: bar-item adoption + icon size, across all seven pages ----
        ctx = b.new_context(viewport={"width": 1440, "height": 900})
        pg = ctx.new_page()
        adopted = 0
        for p in NAV_PAGES:
            pg.goto(base + p, wait_until="load")
            pg.wait_for_timeout(500)
            r = pg.evaluate("""() => {
              const bar = [...document.querySelectorAll('.jbNav a, .jbNav button')]
                .filter(e => e.dataset.navItem || e.classList.contains('jbHome')
                          || e.classList.contains('jbBack'));
              const missing = bar.filter(e => !(e.classList.contains('ctl')
                          && e.classList.contains('ctl--nav')))
                .map(e => e.dataset.navItem || e.className);
              // .jbDiscChevron is a 10px caret, not a nav glyph -- it is deliberately
              // a different size and is excluded by name rather than by tolerance.
              const ico = [...document.querySelectorAll('.jbNav [data-nav-item] .gIco')]
                .filter(e => !e.classList.contains('jbDiscChevron'))
                .map(e => getComputedStyle(e).width);
              const want = getComputedStyle(document.documentElement)
                .getPropertyValue('--ico-md').trim();
              return {n: bar.length, missing, ico: [...new Set(ico)], want};
            }""")
            adopted += r["n"] - len(r["missing"])
            if r["missing"]:
                fails.append(f"A6 {p}: {len(r['missing'])} bar items not on .ctl--nav: {r['missing']}")
            bad = [w for w in r["ico"] if w != r["want"]]
            if bad:
                fails.append(f"A6 {p}: nav icons at {bad}, expected --ico-md {r['want']} "
                             "(.ctl--nav's --ico-sm is winning a tie it should not)")
        notes.append(f"A6 ok: {adopted} bar items on ctl ctl--nav across {len(NAV_PAGES)} pages")
        ctx.close()

        # ---- A1-A4 on index.html, per width ----
        for w in WIDTHS:
            mobile = w < 760
            # REDUCED MOTION ON PURPOSE. .csFrame enters on a translateY, so a panel
            # measured mid-reveal reports a sub-pixel gap that is the animation, not the
            # padding -- 0.593px at 1440 on a first run and 0 on a second. Under
            # prefers-reduced-motion the page's own rules settle both stages outright,
            # which is what makes A1 a measurement rather than a race.
            ctx = b.new_context(viewport={"width": w, "height": 844 if mobile else 900},
                                device_scale_factor=1, is_mobile=mobile, has_touch=mobile,
                                reduced_motion="reduce")
            pg = ctx.new_page()
            pg.goto(base + "index.html", wait_until="load")
            pg.wait_for_timeout(1500)
            if css:
                pg.add_style_tag(content=css)
                pg.wait_for_timeout(200)

            # A1 -- measure each panel's first painted box against the tab line
            gaps = {}
            for i, name in enumerate(["Featured", "Case Studies", "Extras"]):
                pg.evaluate(f"() => document.querySelectorAll('.csTab')[{i}].click()")
                pg.wait_for_timeout(700)
                pg.evaluate("() => document.getElementById('cases').scrollIntoView({block:'start'})")
                pg.wait_for_timeout(500)
                gaps[name] = pg.evaluate("""() => {
                  const nav = document.querySelector('.csTabs').getBoundingClientRect();
                  const p = document.querySelector('.csPanel.on');
                  const f = p.querySelector('.csFrame, .reelFrame').getBoundingClientRect();
                  return Math.round((f.top - nav.bottom) * 1000) / 1000;
                }""")
            sib = gaps["Featured"]
            if abs(gaps["Case Studies"] - sib) > 0.5:
                fails.append(f"A1 @{w}: the two card panels disagree with each other "
                             f"({gaps}); the baseline itself is broken")
            if abs(gaps["Extras"] - sib) > 0.5:
                fails.append(f"A1 @{w}: Extras sits {gaps['Extras']}px under the tab line, "
                             f"its siblings sit {sib}px under it (delta "
                             f"{round(gaps['Extras']-sib,3)}px)")
            else:
                notes.append(f"A1 @{w} ok: all three panels at {sib}px under the tab line")

            # open the player for A2/A3/A4
            pg.evaluate("""() => { const o = document.getElementById('reelOverlay');
                o.classList.add('on'); o.setAttribute('aria-hidden','false');
                document.documentElement.style.overflow = 'hidden'; }""")
            pg.wait_for_timeout(500)

            z = pg.evaluate("""() => ({
              ov: +getComputedStyle(document.getElementById('reelOverlay')).zIndex,
              bar: +getComputedStyle(document.querySelector('.jbStick')).zIndex })""")
            if not (z["ov"] > z["bar"]):
                fails.append(f"A2 @{w}: reel overlay z-index {z['ov']} does not outrank "
                             f".jbStick's {z['bar']}; the header paints over the player")
            else:
                notes.append(f"A2 @{w} ok: overlay {z['ov']} > bar {z['bar']}")

            c = pg.evaluate("""() => {
              const el = document.getElementById('reelClose');
              const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
              const pts = [[r.left+3,r.top+3],[r.right-3,r.top+3],
                           [r.left+3,r.bottom-3],[r.right-3,r.bottom-3],
                           [r.left+r.width/2, r.top+r.height/2]];
              const hits = pts.map(([x,y]) => { const h = document.elementFromPoint(x,y);
                  return h === el || el.contains(h); });
              return {pos: cs.position, w: r.width, h: r.height,
                      onScreen: r.left >= 0 && r.top >= 0 &&
                                r.right <= innerWidth && r.bottom <= innerHeight,
                      dead: hits.filter(v => !v).length,
                      rect: {l: Math.round(r.left), t: Math.round(r.top)}};
            }""")
            tap = 44
            if c["pos"] != "fixed":
                fails.append(f"A3 @{w}: .reelClose computes position:{c['pos']}, not fixed "
                             f"(box at {c['rect']}); the library is winning the page's placement")
            if not c["onScreen"]:
                fails.append(f"A3 @{w}: .reelClose is off-screen at {c['rect']}")
            if c["w"] + 0.05 < tap or c["h"] + 0.05 < tap:
                fails.append(f"A3 @{w}: .reelClose measures {c['w']}x{c['h']}, below {tap}px")
            if c["dead"]:
                fails.append(f"A3 @{w}: {c['dead']} of 5 sampled points on .reelClose are "
                             "covered by something else -- the button is not reachable")
            if not any(f.startswith(f"A3 @{w}") for f in fails):
                notes.append(f"A3 @{w} ok: {c['w']}x{c['h']} fixed, 5/5 points live")

            # A4 -- computed box-shadow on the chrome that used to cast one
            sh = pg.evaluate("""() => {
              const out = {};
              for (const s of ['.reelOverlayVid', '.csInfoCard', '.moodMenu', '.reelClose']) {
                const el = document.querySelector(s);
                if (el) out[s] = getComputedStyle(el).boxShadow;
              }
              return out;
            }""")
            for sel, val in sh.items():
                for layer in [l.strip() for l in val.split("),") if l.strip()]:
                    if val != "none" and "inset" not in layer:
                        fails.append(f"A4 @{w}: {sel} casts a shadow on chrome -- "
                                     f"'{layer}' has no inset. Only the heads may cast.")
            if not any(f.startswith(f"A4 @{w}") for f in fails):
                notes.append(f"A4 @{w} ok: {len(sh)} chrome surfaces, rims only")

            ctx.close()
        b.close()
    return fails, notes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument("--port", type=int, default=4187)
    a = ap.parse_args()

    httpd = serve(a.port)
    try:
        if a.self_test:
            bad = 0
            for key, css in INJECT.items():
                fails, _ = run(a.port, inject=key)
                caught = [f for f in fails if f.startswith(key)]
                if caught:
                    print(f"SELF-TEST PASS  {key} re-injected and caught:\n    {caught[0]}")
                else:
                    print(f"SELF-TEST FAIL  {key} was re-injected and went UNDETECTED. "
                          f"This contract is not watching what it claims to watch.")
                    bad += 1
            return 1 if bad else 0

        fails, notes = run(a.port)
        for n in notes:
            print("  ", n)
        if fails:
            print(f"\nTreatment contract: FAIL ({len(fails)})")
            for f in fails:
                print("  -", f)
            return 1
        print("\nTreatment contract: OK")
        return 0
    finally:
        httpd.shutdown()


sys.exit(main())
