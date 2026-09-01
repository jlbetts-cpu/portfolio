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

  * FIVE LEVELS HAVE TO STAY FIVE LEVELS AT EVERY HOUR.  2026-09-01 the ramp started
    taking its hue from the site's clock, and the six hero ramps are SKIES: sunrise
    and daytime are near-white at both ends, so mapping their stops onto the levels
    puts three of five squares inside a pixel or two of a #fdfdfd page.  That is the
    same white-on-light-sky failure the workspace band had.  The band is safe from it
    by construction -- one ink per hour at five fixed alphas -- and check_hours() is
    what proves the construction is still the one shipping, in the painted pixels, at
    all six hours plus "off".

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

    # 9.5 ── THE HOUR COMES FROM THE SITE'S CLOCK, NOT A SECOND ONE.  site-theme.js
    # writes data-theme-state on <html> on every page and rewrites it when the picker
    # moves and when `auto` crosses a boundary; a band that picked a palette on load
    # would disagree with the sky the moment either happened.  So the whole mechanism is
    # this attribute table and there is no clock in play-contributions.js to drift.
    for state in ("pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night"):
        assert ':root[data-theme-state="%s"] .pGit{' % state in re.sub(r"\s+", " ", css), \
            "the band has no ink for %s; it cannot follow the site's clock" % state
    assert not re.search(r"(getHours|Date\(\)|setInterval|data-theme-state)", JS), \
        ("play-contributions.js has grown a clock of its own -- the hour is a CSS "
         "attribute table on data-theme-state, and a second reader of the time is a "
         "second answer to what hour it is")

    # 9.6 ── AND THE HOUR TABLE HAS A FALLBACK THAT IS REACHABLE.  It is color-mix(),
    # and an unsupported color-mix() is invalid at computed-value time, which falls back
    # to `unset` and NOT to an earlier declaration -- a transparent graph, not a grey
    # one.  @supports is the only thing that keeps the literal ramp reachable.
    assert "@supports (color:color-mix" in css, \
        ("the hour's ink is not inside @supports; without it an unsupported color-mix() "
         "computes to `unset` and every square goes transparent")
    assert "rgba(9,11,36,.055)" in css, \
        "the literal fallback ramp is gone; @supports has nothing to fall back to"

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
  const tr = document.querySelector('.pGitTop').getBoundingClientRect();
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
    topLeft: Math.round(tr.left), topRight: Math.round(tr.right),
    cellW: cell.getBoundingClientRect().width,
    cellH: cell.getBoundingClientRect().height,
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

# Every level's painted colour and the paper under it.  The levels are rgba over the
# page, so the ladder has to be composited before it means anything -- reading the
# alphas back and calling them the ramp is how a ramp that folds passes a check.
LADDER = """() => {
  const g = document.getElementById('pGitGraph');
  const out = [];
  for (let l = 0; l <= 4; l++) {
    const c = g.querySelector('.pGitCell[data-l="' + l + '"]');
    out.push(c ? getComputedStyle(c).backgroundColor : null);
  }
  let n = document.getElementById('pGit'), bg = '';
  while (n) { const b = getComputedStyle(n).backgroundColor;
              if (b && b !== 'rgba(0, 0, 0, 0)') { bg = b; break; } n = n.parentElement; }
  return {levels: out, bg: bg, state: document.documentElement.getAttribute('data-theme-state')};
}"""

# The seven hours site-theme-state.js can put on <html>.  "off" is in the list because
# it is a state the picker can reach and it is the one that is not an hour.
HOURS = ("off", "pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night")


def parse_rgb(text):
    """TWO SERIALISATIONS, AND MISSING THE SECOND IS A GATE THAT MEASURES NOTHING.
    A color-mix() comes back as `color(srgb 0.039 0.235 0.416 / 0.45)` -- channels in
    0..1 -- while a plain rgba() comes back in 0..255.  Read the first with the second's
    parser and every level composites to almost the page, identically at every hour, and
    the ladder check passes a band that has collapsed.  footer-band.js's palette regex
    has to parse both forms for the same reason; this is that lesson, here."""
    m = re.match(r"\s*color\(srgb\s+([^)]*)\)", text)
    if m:
        n = [float(x) for x in re.findall(r"[\d.eE+-]+", m.group(1))]
        return (n[0] * 255, n[1] * 255, n[2] * 255, n[3] if len(n) > 3 else 1.0)
    n = [float(x) for x in re.findall(r"[\d.]+", text)]
    return (n[0], n[1], n[2], n[3] if len(n) > 3 else 1.0)


def lstar(rgb):
    """CIE L* of an opaque sRGB triple.  Perceptual lightness is the right axis here:
    two levels can differ by a lot of alpha and very little of what an eye sees."""
    def lin(c):
        c /= 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    y = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2])
    return 116 * (y ** (1 / 3.0)) - 16 if y > 0.008856 else 903.3 * y


def contrast(a, b):
    def lum(rgb):
        def lin(c):
            c /= 255.0
            return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
        return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2])
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def check_hours(page):
    """FIVE LEVELS, AT EVERY HOUR, MEASURED IN THE PAINTED PIXELS.

    The band takes its hue from the site's clock, and the six ramps it borrows from are
    SKIES.  Sunrise and daytime are near-white at both ends, so the naive mapping -- a
    sky stop per level -- puts three of the five squares within a pixel or two of the
    page and the graph stops being a graph at exactly the hours most people visit.  The
    shipping design avoids that by construction (one ink an hour at five fixed alphas,
    so the ladder is monotone whatever the hue is); this measures the construction
    rather than trusting it, because a stylesheet that reads correctly is not one that
    runs correctly and a later 'nicer' mapping would read fine in a diff.

    THE FLOORS, and what each is for:
      * levels 1-4 are STRICTLY DEEPER, step by step.  A ramp that folds is a ramp with
        four levels and a repeat, and the caption claims five.
      * adjacent levels are >= 8 dL* apart.  The ink that shipped before the hours
        existed runs 15.9 at its tightest, so 8 is half of a picture already approved --
        loose enough not to pin the design, tight enough that a sky-mapped sunrise
        (which lands two of its steps under 2) cannot get through.
      * level 4 clears 4.5:1 against the paper.  The busiest day is the one square the
        caption points at by name.
      * level 0 stays UNDER 8 dL*.  It is the grid, not data; an empty day that reads as
        a light commit is the one direction this check has to fail in as well.
    """
    seen = {}
    for hour in HOURS:
        page.evaluate("h => window.SiteTheme.setMode(h)", hour)
        page.wait_for_timeout(120)
        m = page.evaluate(LADDER)
        assert m["state"] == hour, \
            ("the clock did not reach the band: asked for %s, <html> says %s -- the band "
             "reads data-theme-state and nothing else writes it" % (hour, m["state"]))
        bg = parse_rgb(m["bg"])[:3]
        painted = []
        for i, text in enumerate(m["levels"]):
            assert text, "%s: level %d has no cell to measure" % (hour, i)
            r, g, b, a = parse_rgb(text)
            painted.append(tuple(r * a + bg[k] * (1 - a) for k, r in
                                 zip(range(3), (r, g, b))))
        ls = [lstar(c) for c in painted]
        seen[hour] = tuple(round(x, 1) for x in ls)

        assert lstar(bg) - ls[0] < 8, \
            ("%s: the empty day is %.1f dL* under the page -- level 0 is the grid the "
             "squares sit on, not the lightest bucket of data"
             % (hour, lstar(bg) - ls[0]))
        for i in range(1, 5):
            step = ls[i - 1] - ls[i]
            assert step >= 8, \
                ("%s: levels %d and %d are %.1f dL* apart (%s vs %s) -- this hour cannot "
                 "carry five levels as five levels, which is the sky-mapped-onto-paper "
                 "failure this ramp is built to be immune to"
                 % (hour, i - 1, i, step, m["levels"][i - 1], m["levels"][i]))
        cr4 = contrast(painted[4], bg)
        assert cr4 >= 4.5, \
            ("%s: the busiest day is %.2f:1 against the page -- the caption names that "
             "square by number and it has to be visible" % (hour, cr4))

    # AND THE HOURS ARE ACTUALLY DIFFERENT HOURS.  A table that is live but outranked,
    # or six rules that all resolve to the same ink, passes every check above.
    tops = {h: seen[h][4] for h in HOURS}
    assert len(set(tops.values())) >= 6, \
        ("the band does not change with the hour: level 4 is %r across %d states -- "
         "either the data-theme-state table is being outranked or it has collapsed"
         % (tops, len(HOURS)))
    return seen


def browser_contract(base, patched_js=None, patched_css=None):
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
            if patched_css:
                page.add_style_tag(content=patched_css)
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

            # IT STARTS ON THE COLUMN with the cards under it. A band 12px inboard of the
            # thing below it announces that nothing on the page is on a grid.
            #
            # THE RIGHT EDGE USED TO BE PINNED HERE TOO, and it is not any more.  It was
            # pinned because the strip was 44 equal 1fr tracks and therefore always the
            # full column -- the assertion was describing the mechanism, not a decision.
            # On 2026-09-01 Jayden said "the squares should be smaller", and 44 marks
            # across a 1200px column is 23.4px a mark: a row of buttons.  A day is a
            # fixed 10px now and the strip ends where the data ends.  What ties the
            # section to the page is unchanged and is still asserted: the LEFT edge is
            # the column's, shared with the heading, the caption and the cards, and the
            # heading row above still spans the whole column with the date on its far
            # edge.  What replaces the old assertion is a CEILING -- the strip may never
            # run past the column, which is the thing the pinned edge was really
            # protecting, and it now also holds for a strip narrower than it.
            assert abs(m["graphLeft"] - m["cardsLeft"]) <= 1, \
                ("%d: the graph does not start on the page's column: graph %d, cards %d"
                 % (width, m["graphLeft"], m["cardsLeft"]))
            assert m["graphRight"] <= m["cardsRight"] + 1, \
                ("%d: the graph runs past the page's column: graph %d..%d, cards %d..%d"
                 % (width, m["graphLeft"], m["graphRight"], m["cardsLeft"], m["cardsRight"]))
            assert m["topLeft"] == m["cardsLeft"] and abs(m["topRight"] - m["cardsRight"]) <= 1, \
                ("%d: the heading row no longer spans the column -- it is what holds the "
                 "section to the page now that the strip is shorter than it: row %d..%d, "
                 "cards %d..%d" % (width, m["topLeft"], m["topRight"], m["cardsLeft"], m["cardsRight"]))

            # A DAY IS A MARK, NOT A CONTROL.  The 10px ceiling is the whole of his note
            # and it is one `max-width` holding it up; without that the 1fr tracks go
            # straight back to 23.4px at 1512 and nothing errors.  The floor is here so
            # that "smaller" cannot quietly become "gone" on a narrow phone.
            assert 6 <= m["cellW"] <= 10.5, \
                ("%d: a day is %.1fpx -- it is meant to be a 10px mark, and 44 of them at "
                 "23px was the row of buttons this was fixed for" % (width, m["cellW"]))
            assert abs(m["cellW"] - m["cellH"]) < 0.6, \
                ("%d: a day is not square (%.1f x %.1f)" % (width, m["cellW"], m["cellH"]))

            # UNDER THE HERO, BEFORE THE DOORS -- measured, not just in source order.
            assert m["heroBottom"] <= m["bandTop"] + 1 < m["cardsTop"], \
                ("%d: the band is not between the hero and the cards (hero ends %.0f, "
                 "band starts %.0f, cards start %.0f)"
                 % (width, m["heroBottom"], m["bandTop"], m["cardsTop"]))

            # NOTHING ELEVATES.  The heads cast the only shadow on this site.
            assert m["shadows"] == "none|none|none", \
                ("%d: something in the band is casting: %s" % (width, m["shadows"]))

            # AND THE RAMP CARRIES FIVE LEVELS AT EVERY HOUR.  Only at the widest
            # viewport: this measures colour, which does not change with width, and it
            # walks seven states.
            #
            # THE TRANSITION HAS TO GO FIRST.  The cells cross-fade over 640ms to match
            # the sky, and a backgrounded tab freezes a transition at its START value --
            # read naively, every hour reports the colour it is LEAVING, which is the
            # trap that has already cost this project two agents on the theme switch.
            if width == 1512:
                page.add_style_tag(content=".pGitCell{transition:none!important}")
                ladder = check_hours(page)
                print("  hours: " + "; ".join(
                    "%s %s" % (h, "/".join("%.0f" % v for v in ladder[h])) for h in HOURS))

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


# THE NAIVE MAPPING, WRITTEN OUT SO IT CAN BE PROVED TO FAIL.  This is the obvious way
# to make the band follow the clock -- take the hour's five sky stops and use them as the
# five levels -- and it is wrong for a reason that is invisible until someone looks at a
# sunrise page: those stops are a SKY, #F6F9FF to #FFF0D4, and four of the five are within
# a few L* of #fdfdfd paper.  A gate that cannot fail on this is a gate that would not
# have caught the shipping bug it exists for.
SKY_MAPPED = """
.pGit{--pgit-0:#F6F9FF!important;--pgit-1:#BCD8FF!important;--pgit-2:#FFD4B8!important;
      --pgit-3:#F1A36B!important;--pgit-4:#FFF0D4!important}
"""


def self_test():
    """Re-inject both bugs. An injection that cannot fail is worse than no gate at all.

    ONE: a script that reveals the band without a date, and leaves the stamp blank.
    TWO: the hour's sky stops mapped straight onto the five levels."""
    broken = JS.replace("if (!generated) return false;", "if (!generated) generated = \"\";")
    broken = broken.replace('stamp.textContent = "Snapshot taken " + generated;',
                            'stamp.textContent = "";')
    assert broken != JS, "the self-test could not find the guard to remove"
    failures = 0

    try:
        serve(browser_contract, broken)
    except AssertionError as exc:
        failures += 1
        print("  self-test: the gate fails on a band with no date, as it must")
        print("    %s" % str(exc).splitlines()[0][:140])
    else:
        raise SystemExit("SELF-TEST FAILED: the contract passed a band that shows no snapshot date")

    try:
        serve(browser_contract, None, SKY_MAPPED)
    except AssertionError as exc:
        failures += 1
        print("  self-test: the gate fails on sky stops mapped onto the levels, as it must")
        print("    %s" % str(exc).splitlines()[0][:140])
    else:
        raise SystemExit("SELF-TEST FAILED: the contract passed a ramp whose levels are a "
                         "near-white sky -- the five levels are not five levels and it "
                         "said nothing")
    assert failures == 2


if __name__ == "__main__":
    print("Commit band contract")
    static_contract()
    if "--self-test" in sys.argv:
        self_test()
    else:
        serve(browser_contract)
    print("Commit band contract: OK")
