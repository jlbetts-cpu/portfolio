#!/usr/bin/env python3
"""The structural rule: one token, few lines, and every one of them on the grid.

WHY THIS EXISTS.  Jayden, 2026-08-19, comparing the workspace with the home page:
"something I really like in the workspace ... is structure -- everything felt like
it was intentionally on a grid that is connected ... like think of sites like
stripe, that structure is what makes it so clean. The header for instance, instead
of a pill we can do a line across the bottom, lines separating sections."

Counted before the change: the workspace build draws 24 structural borders on its
one --border token; tokens.css, header.css and controls.css drew ZERO, and the
whole site drew exactly one (footer.css's .footTop).  Space alone was doing every
separation, which is why the page read as things placed near each other.

THE TWO THINGS THAT CAN GO WRONG ARE OPPOSITES, so both are asserted:

  1. THE LINES DISAPPEAR.  A rule is one declaration and it is invisible in a
     diff; the floor and the work-section rule are each a single line of CSS that
     a later sweep could drop without anything looking broken in code review.

  2. THE LINES MULTIPLY.  This is the likelier failure and the more damaging one.
     Stripe's pages are mostly space with a FEW decisive lines; adding rules
     everywhere is the obvious way to imitate that and the wrong one.  Jayden's
     most repeated instruction on this project is that premium is SUBTRACTION.
     So the count is capped, and a line that cannot name what it separates has to
     come out rather than be grandfathered by raising the cap.

  3. THE COLUMN STOPS SHORT, which is §3's defect one level up.  Added
     2026-08-20.  A bar that does not share the edges of the page under it says
     the same thing a short rule says, and five of the nine pages were 40px
     inside it.  So every page that HAS a column is measured against .jbNav, and
     the inset below the band is measured too -- it ran 16 to 88 across the nine.

  4. THE LINES STOP SHORT.  A rule only reads as a grid if the things above and
     below it share edges.  A line that ends 12px inboard of the content it
     introduces announces that nothing is on a grid, and it is exactly the kind of
     defect that measures fine (the rule is drawn, the colour is right) and looks
     wrong.  So the extents are measured in a real browser, at two widths, against
     the nav, the first cover and the footer.

Run:  python3 tools/structure-rule-contract.py [--self-test]
"""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import re
import sys

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


class QuietServer(ThreadingHTTPServer):
    def handle_error(self, _request, _client_address):
        pass

# HOW MANY RULES THE SITE IS ALLOWED TO DRAW, and the number is a budget rather
# than a count of what happens to be there. As shipped the home page draws three:
#   header floor          chrome | page      header.css
#   work section rule     hero   | the work  index.html
#   footer top rule       page   | footer    footer.css (on --theme-rim until its
#                                             owner moves it to --rule)
# The cap is deliberately only two above that. Raising it is a design decision and
# should be argued for in a commit message, not slipped in with the line it
# permits.
# ROUND 15, 2026-08-20: PLAY JOINS THE COUNT, AND THE BUDGET MOVES WITH IT.
# Jayden asked for the Stripe device on the play page -- "lets do the stripe
# method under the header with lines on the left and right showing the margins"
# -- and then, having seen it, "I like the lines". So play.html now draws two
# margin rails plus a restructured menu whose cells are separated by the same
# token, ported from the Workspace's own flush-cell band.
# THE POINT OF THIS FILE IS THAT SUCH A THING CANNOT ARRIVE UNCOUNTED. Until now
# OWNED did not include play.html, so six new structural lines landed and the
# contract still printed "2 rules drawn (budget 5)" and passed. A cap that
# cannot see half the site is not a cap. play.html and play.css are in OWNED
# below, and the budget is raised deliberately rather than by drift.
# WHAT THE COUNT STILL UNDERSTATES, said plainly rather than left to be
# rediscovered: it counts `var(--rule)` OCCURRENCES, and one occurrence can draw
# many lines -- `.pCards{gap:1px;background:var(--rule)}` draws N-1 seams from a
# single reference, and `border-block` draws two. So this is a budget on
# DECLARATIONS, which is the thing a sweep adds carelessly, not on painted
# lines. The painted count is what the browser pass measures at two widths.
RULE_BUDGET = 9

OWNED = ("tokens.css", "header.css", "controls.css", "index.html",
         "hero-time.css", "play.html", "play.css")


def compact(value):
    return re.sub(r"\s+", "", value)


def rule_block(source, selector):
    """The declarations of the rule that STARTS with this selector.

    Anchored, because header.css carries `.jbStick:not(.isFixed) .jbNav{...}`
    above `.jbNav{...}` and an unanchored search reads the wrong block -- which is
    how two existing gates reported a false failure on the day this was written.
    """
    pattern = r"(?:^|[}\n])\s*" + re.escape(selector) + r"\s*\{([^}]*)\}"
    match = re.search(pattern, source, re.S)
    assert match, "missing rule: " + selector
    return compact(match.group(1))


def static_contract(sources):
    tokens = sources["tokens.css"]
    header = sources["header.css"]
    index = sources["index.html"]

    # 1 ── THE TOKEN EXISTS AND IS THEMED.  It is deliberately NOT --theme-rim:
    # that name edges OBJECTS, and an object rim is allowed to be louder at night
    # (a raised surface catches light along its edge). A rule that crosses the
    # whole viewport is not, so --rule holds one weight in both themes.
    assert "--rule:" in tokens, "tokens.css no longer declares --rule"
    assert "--rule-w:" in tokens, "tokens.css no longer declares --rule-w"
    assert re.search(r':root\[data-theme="dark"\][^{]*\{[^}]*--rule:', tokens), \
        "--rule has no dark value; a light hairline on a night page is the loudest thing on it"

    # 2 ── THE HEADER HAS A FLOOR, and it is a hairline rather than elevation.
    # The companion heads cast the only shadow on this site; chrome separates with
    # a line. A box-shadow with a blur or a spread here would be elevation wearing
    # a rule's name, so the exact zero-blur form is what is asserted.
    band = rule_block(header, ".jbStick:not(.isFixed)")
    assert "box-shadow:0var(--rule-w)0var(--rule)" in band, \
        ("the header has lost its floor", band)
    assert "background:var(--ctl-ground)" in band, \
        ("the band has lost its opaque ground; content will ghost through it", band)

    # 3 ── THE HERO CLOSES ITSELF.  ROUND 14 MOVED THIS LINE.
    # It was `border-top` on .csTabs -- the work section's opening rule, stopping
    # at the column (120 -> 1320 at 1440) while the surface it bounded ran
    # full-bleed 0 -> 1440.  Jayden, 2026-08-20: "there is a random line above the
    # tabs which should do the whole bottom of the gradient instead."  He is
    # describing the defect this file's own §3 names -- a rule that does not share
    # the edges of what it separates -- so the fix is the boundary moving to the
    # edge it bounds, not the assertion being relaxed.  The count is unchanged:
    # still three lines, still hero | the work.
    # IT IS A PSEUDO-ELEMENT because an inset box-shadow measured as nothing: it
    # paints above .hero's background but BELOW its children, and the sky is a
    # child.  Asserted in hero-time.css, which is where it has to live -- three
    # files write .hero's box-shadow and that one links last.
    hero_edge = rule_block(sources["hero-time.css"], ".hero::after")
    assert "border-bottom:var(--rule-w)solidvar(--rule)" in hero_edge, \
        ("the hero has lost its bottom edge", hero_edge)
    assert "border-radius:var(--surface-hero-radius)" in hero_edge, \
        ("the edge no longer follows the hero's bottom corners", hero_edge)
    # corner-shape does NOT inherit the way border-radius does, so it is restated
    # or the line runs straight through a squircle corner.
    assert "corner-shape:" in hero_edge, \
        ("the edge does not restate corner-shape", hero_edge)
    tabs = rule_block(index, ".csTabs")
    assert "border-top:" not in tabs, \
        ("the tab row has taken a rule back; the boundary is the hero's", tabs)

    # 4 ── AND THERE ARE STILL ONLY A FEW.  Every var(--rule) reference in the
    # files this lane owns is one line on the page (or one half of one, in the
    # transparent-on-collapse pair, which is why that one is discounted).
    # COUNTED PER OCCURRENCE, NOT PER LINE. A line-based count was the first
    # version and it could not see six rules written on one line, which is
    # exactly how a carpet of them would arrive -- inside a minified sweep.
    # Comments are stripped first, because this file and the stylesheets it reads
    # both talk about var(--rule) in prose.
    used = []
    for name in OWNED:
        body = re.sub(r"/\*.*?\*/", "", sources[name], flags=re.S)
        body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
        for declaration in re.findall(r"[^;{}]*var\(--rule\)[^;{}]*", body):
            text = declaration.strip()
            if text.startswith("--rule"):
                continue          # the token's own declaration
            used.append((name, text))
    # the collapsed header re-declares the floor as transparent; it is the same
    # line, switched off, not a second one.
    drawn = [u for u in used if "transparent" not in u[1]]
    assert len(drawn) <= RULE_BUDGET, (
        "the page is drawing %d structural rules against a budget of %d -- "
        "if a line cannot name what it separates, delete it rather than raise "
        "the budget" % (len(drawn), RULE_BUDGET), drawn)
    return len(drawn)


MEASURE = """() => {
  const box = sel => { const e = document.querySelector(sel); if (!e) return null;
    const b = e.getBoundingClientRect();
    return {l: +b.left.toFixed(1), r: +b.right.toFixed(1)}; };
  return {
    nav:   box('.jbNav'),
    tabs:  box('.csTabs'),
    cover: box('.csFrame'),
    foot:  box('.footTop'),
    /* THE FOOTER'S RULE LEFT ITS BOX ON 2026-08-20. Jayden: "the footer line
       should be all the way across not just a line that cuts out the gutters."
       No element in that footer is full-bleed on every page -- .siteFoot
       measures 80..1360 on index, 120..1320 on about and 160..1280 on the case
       studies -- so the line is a 100vw pseudo centred on the viewport. The BOX
       is still the column and is still measured above for alignment; this reads
       the LINE. */
    footRule: (() => {
      const t = document.querySelector('.footTop');
      const b = getComputedStyle(t, '::before');
      return {w: parseFloat(b.width), h: parseFloat(b.height),
              colour: b.backgroundColor};
    })(),
    stick: box('.jbStick'),
    heroEdgeW: getComputedStyle(document.querySelector('.hero'),'::after').borderBottomWidth,
    heroEdgeC: getComputedStyle(document.querySelector('.hero'),'::after').borderBottomColor,
    hero:      box('.hero'),
    tabsBorder: getComputedStyle(document.querySelector('.csTabs')).borderTopWidth,
    floor:      getComputedStyle(document.querySelector('.jbStick')).boxShadow,
    viewport:   innerWidth
  };
}"""


def browser_contract(base_url):
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        for width, height in ((1440, 900), (390, 844)):
            context = browser.new_context(viewport={"width": width, "height": height})
            page = context.new_page()
            page.goto(base_url + "/index.html", wait_until="networkidle")
            page.wait_for_timeout(900)
            m = page.evaluate(MEASURE)

            # THE FLOOR IS FULL-BLEED and the content is on the column. Those are
            # two different classes of line on purpose: a header's floor is the
            # boundary between chrome and page and spans the window, while a
            # section rule introduces content and has to share that content's
            # edges. A full-bleed section rule would read as decoration.
            assert m["stick"]["l"] <= 0.5 and m["stick"]["r"] >= width - 0.5, m

            # ALIGNMENT IS STRUCTURE. The section rule, the nav's own contents,
            # the first cover and the footer's rule all have to sit on the same
            # two x values or none of them reads as a grid.
            for name in ("nav", "cover", "foot"):
                assert abs(m["tabs"]["l"] - m[name]["l"]) <= 0.5, (width, name, m)
                assert abs(m["tabs"]["r"] - m[name]["r"]) <= 0.5, (width, name, m)

            # THE HERO'S EDGE IS FULL-BLEED, like the header's floor and unlike a
            # section rule -- it is the boundary OF that surface, so it shares
            # that surface's extents rather than the column's.
            assert m["hero"]["l"] <= 0.5 and m["hero"]["r"] >= width - 0.5, (width, m)
            # the footer's rule is full-bleed for the same reason the Hero's
            # edge is: both separate two FULL-WIDTH things. The two rules that
            # stop at the column are the ones introducing column content.
            assert abs(m["footRule"]["w"] - width) <= 1, (width, m["footRule"])
            assert abs(m["footRule"]["h"] - 1) <= 0.5, (width, m["footRule"])
            assert not m["footRule"]["colour"].endswith(", 0)"), (width, m["footRule"])
            assert m["heroEdgeW"] == "1px", (width, m)
            assert not m["heroEdgeC"].endswith(", 0)"), (width, m)
            # and the row it came off does not draw one again
            assert m["tabsBorder"] in ("0px", ""), (width, m)
            assert m["floor"] not in ("none", ""), (width, m)
            # no blur, no spread: `0px 1px 0px 0px` is the whole of it
            assert re.search(r"0px 1px 0px 0px", m["floor"]), (width, m)
            print("  ok %4d  rule %s -> %s, floor %s"
                  % (width, m["tabs"]["l"], m["tabs"]["r"], m["floor"]))
            context.close()
        browser.close()



# ── THE COLUMN, ACROSS THE WHOLE SITE. ─────────────────────────────────────────
# §3 above says a line that does not share the edges of what it separates
# announces that nothing is on a grid. The same is true one level up: a BAR that
# does not share the edges of the page under it announces the same thing, and
# until 2026-08-20 five of the nine pages were in that state.
#
# Measured before the fix, band bottom (.jbStick, 72px) to the first thing that
# paints, and the page's own content box against .jbNav:
#
#   page             top gap 390 / 1440      content box at 1440   vs .jbNav
#   index                  -  /  -           full bleed            (by design)
#   about                 16 /  24           120..1320             agrees
#   5 case studies        48 /  56           160..1280             40px inside
#   play                   0 /   0           full bleed            (by design)
#   headmaker             84 /  88           120..1320             agrees
#   gradientlab           78 /  88           120..1320             agrees
#
# -- a 5.4x spread in the gap, and the five case studies 40px inside the bar on
# both sides. Jayden, 2026-08-20: "the mobile experience doesnt really match up
# with the desktop ... spacing on phone feels a bit odd like some parts dont feel
# connected ... or just too much space." Both halves of that are here.
#
# WHAT IS ASSERTED, and it is deliberately geometry rather than CSS: the pages
# that HAVE a column put its inner edges on .jbNav's, and the inset below the
# band is one value across all of them. index.html and play.html are exempt by
# design -- both open full-bleed, which is a different kind of page, not a
# looser version of this one.
COLUMN_PAGES = {
    "about.html": ".abGrid",
    "apollo.html": ".layout",
    "bearings.html": ".layout",
    "cluster.html": ".layout",
    "strata.html": ".layout",
    "ucdavis.html": ".layout",
    "headmaker.html": ".mkApp",
    "gradientlab.html": ".lab",
}

# THE ONE INSET BELOW THE BAND, in the two states of --sp-32-48. Not a literal
# chosen here: it is the rung those eight pages now name, read back from the
# rendered page so that a change to the token is caught rather than mirrored.
PAGE_TOP = {390: 32, 1440: 48}

# THE TWO ONE-VIEWPORT FRAMES. Both draw a 100svh tool under an IN-FLOW sticky
# band, so their height has to subtract the band; when it did not, and the band
# was additionally re-reserved inside padding-top, scrollHeight measured 916 in
# an 844 viewport -- a page whose whole premise is that it does not scroll,
# scrolling by exactly the height of the bar, with the primary button ("Choose a
# photo", "Download PNG") under the fold on a phone.
FRAME_PAGES = ("headmaker.html", "gradientlab.html")

COLUMN_MEASURE = """(sel) => {
  const r = e => { const b = e.getBoundingClientRect();
    return {l: +b.left.toFixed(1), r: +b.right.toFixed(1), t: +(b.top + scrollY).toFixed(1),
            b: +(b.bottom + scrollY).toFixed(1)}; };
  const nav = document.querySelector('.jbNav');
  const band = document.querySelector('.jbStick');
  const box = document.querySelector(sel);
  if (!nav || !band || !box) return {missing: !nav ? 'nav' : !band ? 'band' : sel};
  const cs = getComputedStyle(box), bb = box.getBoundingClientRect();
  return {nav: r(nav), band: r(band),
          inner: {l: +(bb.left + parseFloat(cs.paddingLeft)).toFixed(1),
                  r: +(bb.right - parseFloat(cs.paddingRight)).toFixed(1),
                  t: +(bb.top + scrollY + parseFloat(cs.paddingTop)).toFixed(1)},
          doc: document.documentElement.scrollHeight, win: innerHeight,
          ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth};
}"""


def column_contract(base_url):
    """Every page with a column puts it on the bar's, at one inset."""
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        for width, height in ((1440, 900), (390, 844)):
            context = browser.new_context(viewport={"width": width, "height": height},
                                          is_mobile=width < 768, has_touch=width < 768)
            page = context.new_page()
            for name, selector in COLUMN_PAGES.items():
                page.goto(base_url + "/" + name, wait_until="load")
                page.wait_for_timeout(700)
                m = page.evaluate(COLUMN_MEASURE, selector)
                assert "missing" not in m, (name, m)

                # 1 ── THE COLUMN IS THE BAR'S COLUMN, on both sides.
                assert abs(m["inner"]["l"] - m["nav"]["l"]) <= 0.6, \
                    ("left edge off the bar's column", name, width, m)
                assert abs(m["inner"]["r"] - m["nav"]["r"]) <= 0.6, \
                    ("right edge off the bar's column", name, width, m)

                # 2 ── AND THE INSET BELOW THE BAND IS ONE VALUE.
                gap = m["inner"]["t"] - m["band"]["b"]
                assert abs(gap - PAGE_TOP[width]) <= 0.6, \
                    ("top inset %.1f, expected %d" % (gap, PAGE_TOP[width]),
                     name, width, m)

                # 3 ── NOTHING SCROLLS SIDEWAYS.
                assert m["ovf"] <= 0, ("horizontal overflow", name, width, m)

                # 4 ── AND THE TWO FRAMES DO NOT SCROLL AT ALL.
                if name in FRAME_PAGES:
                    assert abs(m["doc"] - m["win"]) <= 1, \
                        ("a one-viewport frame is scrolling by %d px -- the band is "
                         "in the flow and is being reserved twice"
                         % (m["doc"] - m["win"]), name, width, m)
                print("  ok %4d  %-17s %s..%s  top %+d"
                      % (width, name, m["inner"]["l"], m["inner"]["r"], gap))
            context.close()
        browser.close()


# ── THE INJECTIONS.  A detector nobody has watched fail is one nobody should
# trust, so each of the three failure modes above has one that re-introduces it.
INJECTIONS = {
    "no-floor": ("header.css",
                 "box-shadow:0 var(--rule-w) 0 var(--rule);",
                 "box-shadow:none;"),
    # INJECTED IN controls.css, NOT index.html, and that is not arbitrary: the row's
    # box is owned there at (0,3,0), and a margin written into index.html's own
    # .csTabs rule loses to `.collection__tabs{margin:0}` in the file that links
    # after it -- so the injection would have been a no-op and the detector would
    # have "passed" while proving nothing.
    "rule-stops-short": ("controls.css",
                         "  padding-inline:0;gap:var(--sp-2);",
                         "  padding-inline:0;margin-inline:12px;gap:var(--sp-2);"),
    # the boundary itself, at its new home
    "no-hero-edge": ("hero-time.css",
                     "border-bottom:var(--rule-w) solid var(--rule);",
                     "border-bottom:0;"),
    # THE COLUMN INJECTIONS. Both are geometry, so both are proved by serving the
    # mutated file rather than by the static pass -- see main().
    "column-off-the-bar": ("apollo.html",
                           ".wrap{position:relative;z-index:2;max-width:1280px;",
                           ".wrap{position:relative;z-index:2;max-width:1200px;"),
    "frame-scrolls": ("headmaker.html",
                      " gap:var(--sp-24);height:calc(100svh - var(--bar-h));",
                      " gap:var(--sp-24);height:100svh;"),
    "carpet": ("controls.css",
               ".collection__tabs .csTabInk{display:block}",
               ".collection__tabs .csTabInk{display:block}"
               ".a{border-top:1px solid var(--rule)}.b{border-top:1px solid var(--rule)}"
               ".c{border-top:1px solid var(--rule)}.d{border-top:1px solid var(--rule)}"
               ".e{border-top:1px solid var(--rule)}.f{border-top:1px solid var(--rule)}"),
}


# The three that a static read of the OWNED files cannot see: each is a geometry
# defect, so each is proved by serving the mutated file to a real browser.
GEOMETRY_INJECTIONS = ("rule-stops-short", "column-off-the-bar", "frame-scrolls")


def read_sources():
    return {name: (ROOT / name).read_text(encoding="utf-8") for name in OWNED}


def main():
    self_test = "--self-test" in sys.argv
    sources = read_sources()

    if self_test:
        failures = 0
        for label, (name, needle, replacement) in INJECTIONS.items():
            # EVERY injection is checked against the file it names FIRST, whether
            # or not the static pass can see that file. An injection whose needle
            # has drifted is worse than no injection, and three of the five below
            # target pages the static contract does not read.
            assert (ROOT / name).read_text(encoding="utf-8").count(needle) >= 1, (
                "the '%s' injection no longer matches the file it is meant to "
                "break -- an injection that cannot fail is worse than none" % label)
            if label in GEOMETRY_INJECTIONS:
                # only visible in a browser; proved below by serving the mutated
                # file rather than by the static pass.
                print("  ..   injection '%s' is a geometry defect, checked in the "
                      "browser pass" % label)
                continue
            broken = dict(sources)
            broken[name] = broken[name].replace(needle, replacement, 1)
            try:
                static_contract(broken)
            except AssertionError as error:
                print("  ok   injection '%s' is caught: %s"
                      % (label, str(error)[:90]))
                failures += 1
                continue
            print("  FAIL injection '%s' passed the contract" % label)
        # the geometry injections, served for real. Each one mutates a file on
        # disk, serves it, and is restored in a finally -- so an interrupted run
        # cannot leave the tree edited.
        for label, checker in (("rule-stops-short", browser_contract),
                               ("column-off-the-bar", column_contract),
                               ("frame-scrolls", column_contract)):
            name, needle, replacement = INJECTIONS[label]
            original = (ROOT / name).read_text(encoding="utf-8")
            try:
                (ROOT / name).write_text(original.replace(needle, replacement, 1),
                                         encoding="utf-8")
                handler = partial(QuietHandler, directory=str(ROOT))
                server = QuietServer(("127.0.0.1", 0), handler)
                Thread(target=server.serve_forever, daemon=True).start()
                try:
                    checker("http://127.0.0.1:%d" % server.server_port)
                except AssertionError as error:
                    print("  ok   injection '%s' is caught: %s"
                          % (label, str(error)[:90]))
                    failures += 1
                else:
                    print("  FAIL injection '%s' passed the contract" % label)
                finally:
                    server.shutdown()
                    server.server_close()
            finally:
                (ROOT / name).write_text(original, encoding="utf-8")
        assert failures == len(INJECTIONS), (failures, len(INJECTIONS))
        print("SELF-TEST OK -- all %d injections fail the contract" % failures)
        return

    drawn = static_contract(sources)
    handler = partial(QuietHandler, directory=str(ROOT))
    server = QuietServer(("127.0.0.1", 0), handler)
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        browser_contract("http://127.0.0.1:%d" % server.server_port)
        column_contract("http://127.0.0.1:%d" % server.server_port)
    finally:
        server.shutdown()
        server.server_close()
    print("Structure rule contract: OK -- %d rule%s drawn (budget %d), "
          "all on the page's own column; %d pages on the bar's column at 2 widths"
          % (drawn, "" if drawn == 1 else "s", RULE_BUDGET, len(COLUMN_PAGES)))


if __name__ == "__main__":
    main()
