#!/usr/bin/env python3
"""The commit band shows the date its data was taken, or it does not ship.

WHY THIS EXISTS
---------------
Jayden asked for this section twice.  The first time, in August, it was argued
down on three grounds; two of them are dead (the commit count now argues FOR him,
and he never asked for the token-usage panel that was the other objection).  The
third is permanent and is the reason the section is allowed to exist at all:

    data/commit-history.json is a COMMITTED SNAPSHOT, not a live feed.  A browser
    cannot run git, so the calendar is built by tools/build-commit-calendar.py and
    committed.  A panel that LOOKS live while being a stale snapshot is worse than
    no panel.

So the mitigation is not advice, it is a condition: the `generated` date is on the
page, level with the heading, and play-contributions.js renders NOTHING if the JSON
has lost it.  That is one visible string and one early return -- exactly the kind of
thing a later tidy-up removes without anything looking broken in review.  This file
is what makes removing it fail.

WHAT ELSE IS HELD HERE, and each one is a mistake that was actually made:

  * THE SOURCE.  The first cut drew GitHub's 12-month calendar: 52 active days of
    367, two empty stretches of 130 and 118 days, everything bunched at the right
    edge.  An honest caption under a weak picture is still a weak picture, so the
    source moved to this repository's own log.  The old fetcher and its JSON are
    DELETED, and this file asserts they stay deleted -- an unused data file that
    looks live is the failure mode all over again.

  * "DARKER SQUARES ARE BUSIER DAYS" WAS FALSE IN DARK MODE.  The ramp runs on the
    page's ink, so on a night page the busiest days are the LIGHTEST squares.  The
    caption may not name a direction of shade.  Found by looking at a screenshot,
    which is the only way it could have been found.

  * THE GRID'S COLUMN COUNT COMES FROM THE DATA.  A hard-coded 44 wraps a single
    square onto a row of its own the first day the repo gains one, and nothing
    errors, so nobody notices for a month.

  * NO SHADOW, NO BORDER, NO RULE.  The companion heads cast the only shadow on
    this site, and tools/structure-rule-contract.py caps how many lines it draws.

Run:  python3 tools/commit-band-contract.py [--self-test]
      --self-test  serve a play-contributions.js with the date guard removed and
                   the stamp left blank, and prove this contract fails on it.
"""

import json
import math
import pathlib
import re
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[1]
HTML = (ROOT / "play.html").read_text(encoding="utf-8")
JS = (ROOT / "play-contributions.js").read_text(encoding="utf-8")
DATA = json.loads((ROOT / "data" / "commit-history.json").read_text(encoding="utf-8"))

MONTHS = ["January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"]

# play.html with comments stripped. Assertions about what the page does NOT do have
# to read this, or the note explaining a removal trips the assertion -- the lesson
# tools/play-minimal-contract.py already learned.
LIVE = re.sub(r"<!--.*?-->", "", HTML, flags=re.S)


def human(iso):
    """Mirror of human() in play-contributions.js. Split, never Date(): a bare ISO
    date parses as UTC midnight and prints as the previous day west of Greenwich."""
    y, m, d = iso.split("-")
    return "%d %s %s" % (int(d), MONTHS[int(m) - 1], y)


class Quiet(ThreadingHTTPServer):
    def handle_error(self, *_):
        pass


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def static_contract():
    # 1 ── THE SECTION IS THERE, AND IT IS BETWEEN THE HERO AND THE DOORS.
    # "under the hero ... before all the options" is the whole request; a section
    # that drifts below the cards has stopped being the thing he asked for.
    assert '<section class="pGit" id="pGit"' in LIVE, "play.html no longer ships the commit band"
    hero = LIVE.index('class="hero" id="playArena"')
    band = LIVE.index('<section class="pGit" id="pGit"')
    hub = LIVE.index('<section class="pHub" id="games"')
    assert hero < band < hub, \
        "the band is not between the hero and the games band (hero %d, band %d, hub %d)" % (hero, band, hub)

    # 2 ── IT SHIPS HIDDEN.  With no JS, no JSON or no date there is nothing to show,
    # and a heading over an empty box is the stale-dashboard failure in another costume.
    section = LIVE[band:LIVE.index("</section>", band)]
    assert re.search(r'<section class="pGit" id="pGit"[^>]*\shidden', LIVE), \
        "the band no longer ships hidden; it will render a heading over an empty box"

    # 3 ── THE DATE HAS A HOME IN THE MARKUP, and it is in the heading row rather
    # than trailing the sentence underneath, where it reads as a footnote.
    assert 'id="pGitStamp"' in section, "the snapshot stamp element is gone"
    assert section.index('id="pGitStamp"') < section.index('id="pGitGraph"'), \
        "the snapshot stamp has moved below the graph; it is the condition, not a footnote"

    # 4 ── AND THE SCRIPT REFUSES TO RENDER WITHOUT ONE.  This is the assertion the
    # whole file is for: the early return is one line and it is invisible in a diff.
    assert re.search(r"if\s*\(\s*!\s*generated\s*\)\s*return\s+false", JS), \
        ("play-contributions.js no longer refuses to render without a `generated` date -- "
         "that guard is the condition this section exists on, not a nicety")
    assert 'stamp.textContent = "Snapshot taken "' in JS, \
        "the stamp is no longer written from the JSON's own `generated` field"

    # 5 ── THE SOURCE IS THIS REPOSITORY, AND THE GITHUB SNAPSHOT STAYS GONE.
    # An unused data file that looks live is the objection this whole section is
    # conditioned on, sitting in the tree with nothing to disprove it.
    assert "data/commit-history.json" in JS, "the band is no longer reading this repo's own log"
    assert not (ROOT / "data" / "contributions.json").exists(), \
        "data/contributions.json is back -- a stale GitHub snapshot must not ship"
    assert not (ROOT / "tools" / "fetch-contributions.py").exists(), \
        "the GitHub fetcher is back; nothing consumes its output"

    # 6 ── THE DATA CARRIES REAL COUNTS, not opaque buckets. This is what lets the
    # caption talk about commits at all; GitHub's levels had no number behind them.
    assert "levelFloors" in DATA, "the calendar no longer declares its level thresholds"
    assert all("n" in day for day in DATA["days"]), \
        "a day has no commit count; the shading would be an opaque bucket again"

    # 7 ── THE COLUMN COUNT COMES FROM THE DATA.  A literal in the stylesheet is a
    # fallback; the truth is written by the script, or the grid silently wraps one
    # square onto a row of its own the day the repo gains one.
    assert 'setProperty("--pgit-cols"' in JS and 'setProperty("--pgit-fold"' in JS, \
        "the grid's column count is no longer written from the data"

    css = HTML[HTML.index("<style"):HTML.index("</style>")]
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    assert "repeat(var(--pgit-cols," in css, \
        ("the grid no longer takes its column count from a custom property, or the var() "
         "has lost its fallback -- an unresolvable var() computes to `unset`, and "
         "grid-template-columns:none stacks every day into one very tall column")

    # 8 ── NO SHADOW AND NO BORDER, IN SOURCE.  The companion heads cast the only
    # shadow on this site; chrome separates with hairlines and translucency. The
    # computed check below catches an inherited one; this catches a declared one.
    for rule in re.findall(r"[^{}]*\.pGit[^{}]*\{([^}]*)\}", css):
        assert "box-shadow" not in rule, ("the band has taken a shadow", rule)
        assert not re.search(r"(?<!-)border\s*:", rule) and "border-top" not in rule \
            and "border-block" not in rule, ("the band has taken a border", rule)

    # 9 ── IT DOES NOT DRAW A STRUCTURAL LINE EITHER.  The hero's own bottom edge and
    # .pCards' border-block-start already bound it, and tools/structure-rule-contract.py
    # caps how many lines this site may draw. A rule added here spends that budget.
    assert "var(--rule)" not in "".join(re.findall(r"[^{}]*\.pGit[^{}]*\{[^}]*\}", css)), \
        "the band is drawing a structural rule; it is bounded by lines that already exist"

    # 10 ── AND THE RAMP IS THEMED.  It is the page's ink, not a colour of its own,
    # which is also why the caption may not name a direction of shade -- see §11 below.
    assert re.search(r':root\[data-theme="dark"\]\s*\.pGit\{', css), \
        "the band has no dark ramp; ink at 92% alpha on a night page is invisible"
    print("  static: this repo's log, band between hero and doors, ships hidden, "
          "guards the date, counts from the data, casts nothing")


PROBE = """() => {
  const s = document.getElementById('pGit');
  const g = document.getElementById('pGitGraph');
  const cards = document.querySelector('.pCards');
  const hero = document.querySelector('.hero');
  const cell = g && g.querySelector('.pGitCell');
  const gr = g.getBoundingClientRect(), cr = cards.getBoundingClientRect();
  return {
    hidden: s.hidden,
    display: getComputedStyle(s).display,
    stamp: document.getElementById('pGitStamp').textContent,
    note: document.getElementById('pGitNote').textContent,
    aria: g.getAttribute('aria-label') || '',
    cells: g.querySelectorAll('.pGitCell').length,
    titled: [...g.querySelectorAll('.pGitCell')].filter(c => c.title).length,
    cols: getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length,
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    graphLeft: Math.round(gr.left), graphRight: Math.round(gr.right),
    cardsLeft: Math.round(cr.left), cardsRight: Math.round(cr.right),
    bandTop: s.getBoundingClientRect().top + window.scrollY,
    heroBottom: hero.getBoundingClientRect().bottom + window.scrollY,
    cardsTop: cr.top + window.scrollY,
    shadows: [getComputedStyle(s).boxShadow, getComputedStyle(g).boxShadow,
              getComputedStyle(cell).boxShadow].join('|'),
  };
}"""

TOP_LEVEL = """() => {
  const c = document.querySelector('.pGitCell[data-l="4"]') ||
            document.querySelector('.pGitCell[data-l="3"]');
  return c ? getComputedStyle(c).backgroundColor : '';
}"""


def browser_contract(base, patched_js=None):
    from playwright.sync_api import sync_playwright

    stamp_want = "Snapshot taken " + human(DATA["generated"])
    days = DATA["days"]
    active = sum(1 for d in days if d["n"] > 0)
    commits = sum(d["n"] for d in days)
    busiest = max(d["n"] for d in days)
    total = len(days)

    def route(page):
        if patched_js is not None:
            page.route("**/play-contributions.js", lambda r: r.fulfill(
                status=200, content_type="text/javascript", body=patched_js))

    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, height in ((1512, 850), (390, 844), (320, 690)):
            page = browser.new_page(viewport={"width": width, "height": height})
            route(page)
            page.goto(base + "/play.html", wait_until="load")
            page.wait_for_timeout(2600)
            m = page.evaluate(PROBE)

            # THE DATE IS ON THE PAGE, AND IT IS THE JSON'S OWN.  A hand-typed date
            # would pass a "there is a date" check and be exactly the lie this guards.
            assert m["stamp"] == stamp_want, \
                ("%d: the snapshot date is not the JSON's own: %r, want %r"
                 % (width, m["stamp"], stamp_want))
            assert not m["hidden"] and m["display"] != "none", \
                "%d: the band did not render" % width

            # Every number on the page is the file's own.
            assert m["cells"] == total, ("%d: %d cells for %d days" % (width, m["cells"], total))
            assert m["titled"] == m["cells"], \
                "%d: %d of %d cells carry no hover date" % (width, m["titled"], m["cells"])
            for label, value in (("commits", commits), ("active days", active),
                                 ("window", total), ("busiest day", busiest)):
                assert str(value) in m["note"].replace(",", ""), \
                    ("%d: the note does not report the file's own %s (%d)" % (width, label, value),
                     m["note"])
            assert str(commits) in m["aria"].replace(",", ""), \
                ("%d: the graph has no real text alternative" % width, m["aria"])

            # THE CAPTION MAY NOT NAME A DIRECTION OF SHADE.  The ramp is the page's
            # ink, so "darker is busier" is true on paper and false at night. This
            # shipped once and only a dark screenshot caught it.
            for word in ("darker", "lighter", "dark squares", "light squares"):
                assert word not in m["note"].lower(), \
                    ("%d: the caption names a direction of shade (%r) -- the ramp inverts "
                     "with the theme, so it is false in one of them" % (width, word), m["note"])

            # THE GRID IS AS WIDE AS THE DATA, folding rather than being cut short.
            want_cols = total if width > 560 else math.ceil(total / 2)
            assert m["cols"] == want_cols, \
                ("%d: grid has %d columns, want %d -- the count must come from the data"
                 % (width, m["cols"], want_cols))

            # NO PAGE SCROLL.  A day-per-square strip is the obvious way to push a phone
            # sideways, and "nothing scrolls that should not" is the site's rule -- the
            # squares shrink and the row folds instead, and there is no scrollport here.
            assert m["overflow"] <= 0, \
                "%d: the band pushed the page %dpx sideways" % (width, m["overflow"])

            # IT SHARES THE COLUMN with the cards under it. A band 12px inboard of the
            # thing below it announces that nothing on the page is on a grid.
            assert abs(m["graphLeft"] - m["cardsLeft"]) <= 1 and abs(m["graphRight"] - m["cardsRight"]) <= 1, \
                ("%d: the graph is off the page's column: graph %d..%d, cards %d..%d"
                 % (width, m["graphLeft"], m["graphRight"], m["cardsLeft"], m["cardsRight"]))

            # UNDER THE HERO, BEFORE THE DOORS -- measured, not just in source order.
            assert m["heroBottom"] <= m["bandTop"] + 1 < m["cardsTop"], \
                ("%d: the band is not between the hero and the cards (hero ends %.0f, "
                 "band starts %.0f, cards start %.0f)"
                 % (width, m["heroBottom"], m["bandTop"], m["cardsTop"]))

            # NOTHING ELEVATES.  The heads cast the only shadow on this site.
            assert m["shadows"] == "none|none|none", \
                ("%d: something in the band is casting: %s" % (width, m["shadows"]))

            # AND THE RAMP ACTUALLY MOVES WITH THE THEME, measured rather than read out
            # of a stylesheet -- the rule can be live and still be outranked.
            paper = page.evaluate(TOP_LEVEL)
            page.evaluate("document.documentElement.setAttribute('data-theme','dark')")
            page.wait_for_timeout(200)
            night = page.evaluate(TOP_LEVEL)
            assert paper and night and paper != night, \
                ("%d: the ramp does not follow the theme (%s vs %s)" % (width, paper, night))
            page.close()

        # AND THE GUARD ACTUALLY HOLDS: strip `generated` and the section must not appear.
        stripped = dict(DATA)
        stripped.pop("generated", None)
        body = json.dumps(stripped)
        page = browser.new_page(viewport={"width": 1512, "height": 850})
        route(page)
        page.route("**/data/commit-history.json", lambda r: r.fulfill(
            status=200, content_type="application/json", body=body))
        page.goto(base + "/play.html", wait_until="load")
        page.wait_for_timeout(2600)
        assert page.evaluate("getComputedStyle(document.getElementById('pGit')).display") == "none", \
            ("the band rendered from a JSON with no `generated` date -- a snapshot that "
             "does not say when it was taken is the thing this section is not allowed to be")
        page.close()
        browser.close()
    print("  browser: date is the file's own at 3 widths, %d columns folding to %d, "
          "no page scroll, on the column, no shadow, ramp follows the theme"
          % (total, math.ceil(total / 2)))


def serve(fn, *args):
    handler = partial(QuietHandler, directory=str(ROOT))
    server = Quiet(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        fn("http://127.0.0.1:%d" % server.server_port, *args)
    finally:
        server.shutdown()
        server.server_close()


def self_test():
    """Re-inject the bug: a script that reveals the band without a date, and leaves
    the stamp blank. An injection that cannot fail is worse than no gate at all."""
    broken = JS.replace("if (!generated) return false;", "if (!generated) generated = \"\";")
    broken = broken.replace('stamp.textContent = "Snapshot taken " + generated;',
                            'stamp.textContent = "";')
    assert broken != JS, "the self-test could not find the guard to remove"
    try:
        serve(browser_contract, broken)
    except AssertionError as exc:
        print("  self-test: the gate fails on a band with no date, as it must")
        print("    %s" % str(exc).splitlines()[0][:140])
        return
    raise SystemExit("SELF-TEST FAILED: the contract passed a band that shows no snapshot date")


if __name__ == "__main__":
    print("Commit band contract")
    static_contract()
    if "--self-test" in sys.argv:
        self_test()
    else:
        serve(browser_contract)
    print("Commit band contract: OK")
