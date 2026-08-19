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

  3. THE LINES STOP SHORT.  A rule only reads as a grid if the things above and
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
RULE_BUDGET = 5

OWNED = ("tokens.css", "header.css", "controls.css", "index.html")


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

    # 3 ── THE WORK SECTION HAS ITS OPENING RULE.
    tabs = rule_block(index, ".csTabs")
    assert "border-top:var(--rule-w)solidvar(--rule)" in tabs, \
        ("the work section has lost its rule", tabs)

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
    stick: box('.jbStick'),
    tabsBorder: getComputedStyle(document.querySelector('.csTabs')).borderTopWidth,
    tabsColor:  getComputedStyle(document.querySelector('.csTabs')).borderTopColor,
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

            assert m["tabsBorder"] == "1px", (width, m)
            assert not m["tabsColor"].endswith(", 0)"), (width, m)
            assert m["floor"] not in ("none", ""), (width, m)
            # no blur, no spread: `0px 1px 0px 0px` is the whole of it
            assert re.search(r"0px 1px 0px 0px", m["floor"]), (width, m)
            print("  ok %4d  rule %s -> %s, floor %s"
                  % (width, m["tabs"]["l"], m["tabs"]["r"], m["floor"]))
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
    "carpet": ("controls.css",
               ".collection__tabs .csTabInk{display:block}",
               ".collection__tabs .csTabInk{display:block}"
               ".a{border-top:1px solid var(--rule)}.b{border-top:1px solid var(--rule)}"
               ".c{border-top:1px solid var(--rule)}.d{border-top:1px solid var(--rule)}"
               ".e{border-top:1px solid var(--rule)}.f{border-top:1px solid var(--rule)}"),
}


def read_sources():
    return {name: (ROOT / name).read_text(encoding="utf-8") for name in OWNED}


def main():
    self_test = "--self-test" in sys.argv
    sources = read_sources()

    if self_test:
        failures = 0
        for label, (name, needle, replacement) in INJECTIONS.items():
            broken = dict(sources)
            assert broken[name].count(needle) >= 1, (
                "the '%s' injection no longer matches the file it is meant to "
                "break -- an injection that cannot fail is worse than none" % label)
            broken[name] = broken[name].replace(needle, replacement, 1)
            try:
                static_contract(broken)
            except AssertionError as error:
                print("  ok   injection '%s' is caught: %s"
                      % (label, str(error)[:90]))
                failures += 1
                continue
            if label == "rule-stops-short":
                # this one is only visible in a browser; it is proved below by
                # serving the mutated file rather than by the static pass.
                print("  ..   injection '%s' is a geometry defect, checked in the "
                      "browser pass" % label)
                continue
            print("  FAIL injection '%s' passed the contract" % label)
        # the geometry injection, served for real
        name, needle, replacement = INJECTIONS["rule-stops-short"]
        original = (ROOT / name).read_text(encoding="utf-8")
        try:
            (ROOT / name).write_text(original.replace(needle, replacement, 1),
                                     encoding="utf-8")
            handler = partial(QuietHandler, directory=str(ROOT))
            server = QuietServer(("127.0.0.1", 0), handler)
            Thread(target=server.serve_forever, daemon=True).start()
            try:
                browser_contract("http://127.0.0.1:%d" % server.server_port)
            except AssertionError as error:
                print("  ok   injection 'rule-stops-short' is caught: %s"
                      % str(error)[:90])
                failures += 1
            else:
                print("  FAIL injection 'rule-stops-short' passed the contract")
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
    finally:
        server.shutdown()
        server.server_close()
    print("Structure rule contract: OK -- %d rule%s drawn (budget %d), "
          "all on the page's own column" % (drawn, "" if drawn == 1 else "s", RULE_BUDGET))


if __name__ == "__main__":
    main()
