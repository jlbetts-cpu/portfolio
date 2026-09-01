#!/usr/bin/env python3
"""The contribution band shows the date its data was taken, or it does not ship.

WHY THIS EXISTS
---------------
Jayden asked for this section twice.  The first time, in August, it was argued
down on three grounds; two of them are dead (the commit count now argues FOR him,
and he never asked for the token-usage panel that was the other objection).  The
third is permanent and is the reason the section is allowed to exist at all:

    data/contributions.json is a COMMITTED SNAPSHOT, not a live feed.  GitHub's
    calendar is CORS-blocked HTML and the GraphQL API needs a token a static site
    cannot ship (tools/fetch-contributions.py explains it in full).  A panel that
    LOOKS live while being a stale snapshot is worse than no panel.

So the mitigation is not advice, it is a condition: the `generated` date is on the
page, level with the heading, and play-contributions.js renders NOTHING if the JSON
has lost it.  That is one visible string and one early return -- exactly the kind of
thing a later tidy-up removes without anything looking broken in review.  This file
is what makes removing it fail.

It also holds the two things that make the band belong rather than look borrowed:
it is drawn in the site's own ink and it casts no shadow (the companion heads cast
the only shadow on this site), and it shares the page's column edges with the cards
band under it.

Run:  python3 tools/contributions-band-contract.py [--self-test]
      --self-test  serve a play-contributions.js with the date guard removed and
                   the stamp left blank, and prove this contract fails on it.
"""

import json
import pathlib
import re
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[1]
HTML = (ROOT / "play.html").read_text(encoding="utf-8")
JS = (ROOT / "play-contributions.js").read_text(encoding="utf-8")
DATA = json.loads((ROOT / "data" / "contributions.json").read_text(encoding="utf-8"))

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
    assert '<section class="pGit" id="pGit"' in LIVE, "play.html no longer ships the contribution band"
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

    # 5 ── NO SHADOW AND NO BORDER, IN SOURCE.  The companion heads cast the only
    # shadow on this site; chrome separates with hairlines and translucency. The
    # computed check below catches an inherited one; this catches a declared one.
    css = HTML[HTML.index("<style"):HTML.index("</style>")]
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    for rule in re.findall(r"[^{}]*\.pGit[^{}]*\{([^}]*)\}", css):
        assert "box-shadow" not in rule, ("the band has taken a shadow", rule)
        assert not re.search(r"(?<!-)border\s*:", rule) and "border-top" not in rule \
            and "border-block" not in rule, ("the band has taken a border", rule)

    # 6 ── IT DOES NOT DRAW A STRUCTURAL LINE EITHER.  The hero's own bottom edge and
    # .pCards' border-block-start already bound it, and tools/structure-rule-contract.py
    # caps how many lines this site may draw. A rule added here spends that budget.
    assert "var(--rule)" not in "".join(re.findall(r"[^{}]*\.pGit[^{}]*\{[^}]*\}", css)), \
        "the band is drawing a structural rule; it is bounded by lines that already exist"

    # 7 ── `l` IS A BUCKET.  The build tool refuses to invent a commit total and so
    # must the page. Every number rendered is a count of DAYS.
    assert "not a commit count" in JS, \
        "the note no longer says the shading is a bucket rather than a count"
    print("  static: band sits between hero and doors, ships hidden, guards the date, casts nothing")


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


def browser_contract(base, patched_js=None):
    from playwright.sync_api import sync_playwright

    stamp_want = "Snapshot taken " + human(DATA["generated"])
    active = DATA["activeDays"]
    total = DATA["totalDays"]

    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, height in ((1512, 850), (390, 844), (320, 690)):
            page = browser.new_page(viewport={"width": width, "height": height})
            if patched_js is not None:
                page.route("**/play-contributions.js", lambda r: r.fulfill(
                    status=200, content_type="text/javascript", body=patched_js))
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

            # Every number on the page is a count of days, and it is the file's.
            assert m["cells"] == len(DATA["days"]), \
                ("%d: %d cells for %d days" % (width, m["cells"], len(DATA["days"])))
            assert m["titled"] == m["cells"], \
                "%d: %d of %d cells carry no hover date" % (width, m["titled"], m["cells"])
            assert str(active) in m["note"] and str(total) in m["note"], \
                ("%d: the note does not report the file's own counts" % width, m["note"])
            assert ("%d of %d" % (active, total)) in m["aria"], \
                ("%d: the graph has no real text alternative" % width, m["aria"])

            # NO PAGE SCROLL.  367 cells at 7 rows is the obvious way to push a phone
            # sideways, and "nothing scrolls that should not" is the site's rule -- the
            # squares shrink instead, and there is no scrollport here to hide behind.
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
            page.close()

        # AND THE GUARD ACTUALLY HOLDS: strip `generated` and the section must not appear.
        stripped = dict(DATA)
        stripped.pop("generated", None)
        body = json.dumps(stripped)
        page = browser.new_page(viewport={"width": 1512, "height": 850})
        if patched_js is not None:
            page.route("**/play-contributions.js", lambda r: r.fulfill(
                status=200, content_type="text/javascript", body=patched_js))
        page.route("**/data/contributions.json", lambda r: r.fulfill(
            status=200, content_type="application/json", body=body))
        page.goto(base + "/play.html", wait_until="load")
        page.wait_for_timeout(2600)
        assert page.evaluate("getComputedStyle(document.getElementById('pGit')).display") == "none", \
            ("the band rendered from a JSON with no `generated` date -- a snapshot that "
             "does not say when it was taken is the thing this section is not allowed to be")
        page.close()
        browser.close()
    print("  browser: date is the file's own at 3 widths, no page scroll, on the column, no shadow")


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
    print("Contribution band contract")
    static_contract()
    if "--self-test" in sys.argv:
        self_test()
    else:
        serve(browser_contract)
    print("Contribution band contract: OK")
