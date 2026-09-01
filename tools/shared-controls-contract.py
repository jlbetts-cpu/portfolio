#!/usr/bin/env python3
"""Static architecture contract for the first shared-control migration."""

from html.parser import HTMLParser
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stylesheets = []
        self.elements = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "link" and "stylesheet" in values.get("rel", "").split():
            self.stylesheets.append(values.get("href"))
        self.elements.append((tag, values))


def page(name):
    parser = PageParser()
    parser.feed((ROOT / name).read_text(encoding="utf-8"))
    return parser


def classes(attrs):
    return set(attrs.get("class", "").split())


def by_id(parser, element_id):
    return next(attrs for _, attrs in parser.elements if attrs.get("id") == element_id)


def asset_name(href):
    return href.split("?", 1)[0] if href else href


def compact(value):
    return re.sub(r"\s+", "", value)


def rule(source, selector, occurrence=0):
    # ANCHORED AT A RULE BOUNDARY, 2026-08-19, because the unanchored version read
    # the wrong block and reported a false failure. header.css gained
    # `.jbStick:not(.isFixed) .jbNav{...}` ABOVE the component's own `.jbNav{...}`,
    # and a bare substring search for ".jbNav{" found the descendant rule first --
    # so the gate asserted against a three-declaration override and said the
    # header had lost its material. The selector must START a rule (i.e. follow a
    # `}`, a `/`-comment close, or the top of the file) for the match to count.
    pattern = r"(?:^|[}\n])\s*" + re.escape(selector) + r"\s*\{([^}]*)\}"
    matches = list(re.finditer(pattern, source, re.S))
    assert len(matches) > occurrence, (selector, len(matches))
    return compact(matches[occurrence].group(1))


# Every page that ships the shared bar. play.html is in the list because the two
# clauses that name it below are about what it must NOT contain; it is skipped by
# the loop that asserts the time control, because that control is another lane's
# to add there and this gate must not fail on a file it cannot fix.
SHARED_PAGES = ("index.html", "about.html", "apollo.html", "bearings.html",
                "cluster.html", "strata.html", "ucdavis.html", "yowmings.html",
                "headmaker.html", "gradientlab.html", "play.html")


def main():
    for name in ("index.html", "play.html"):
        parsed = page(name)
        assets = [asset_name(href) for href in parsed.stylesheets]
        assert "controls.css" in assets, (name, parsed.stylesheets)
        assert assets.index("tokens.css") < assets.index("controls.css")

        # index.html's #workBtn was removed on 2026-08-20 by request. play.html
        # still ships one and is still checked by its own contract; this loop
        # runs over the shared pages, so the clause cannot live here any more.
        assert {"ctl", "ctl--secondary"} <= classes(
            next(attrs for tag, attrs in parsed.elements if tag == "a" and "skipLink" in classes(attrs))
        )

        nav = next(attrs for tag, attrs in parsed.elements if tag == "nav" and "jbNav" in classes(attrs))
        assert "ctl-group" in classes(nav)

    # THE TIME TRIGGER IS A BAR ITEM NOW, NOT AN ICON CHIP.  2026-08-26.
    # This asserted ctl--icon, which was correct while the control stood in the
    # Hero's bottom-right rail: .ctl--icon is a square button with a ground and a
    # rim. Jayden moved it into the header ("the time of day button should be in
    # the header since it affects all the pages"), where it is one of the bar's
    # own items and must be drawn by the same variant they are -- .ctl--nav, which
    # carries the 38px ink box, the pill radius and the ::after that takes the
    # target to 44. Asserting ctl--icon here would now be asserting the bug: it
    # would demand a second control geometry in a bar whose whole point is one.
    # WHAT IS STILL ASSERTED IS THE THING THAT MATTERS -- that the trigger and its
    # menu come from the shared library rather than being rebuilt privately -- and
    # it is asserted on EVERY page that ships the bar rather than on index.html
    # alone, because the control is site-wide now and a page that forgot the
    # classes is exactly what this gate exists to catch.
    for name in SHARED_PAGES:
        if name == "play.html":
            continue          # another lane's file; see the play_ids note below
        doc = page(name)
        trigger = by_id(doc, "heroTimeBtn")
        assert trigger is not None, name
        assert {"ctl", "ctl--nav"} <= classes(trigger), name
        assert "ctl--icon" not in classes(trigger), (name, "the bar has one item geometry")
        assert {"ctl-menu"} <= classes(by_id(doc, "heroTimeMenu")), name
    home = page("index.html")

    play = page("play.html")
    assert {"ctl", "ctl--secondary"} <= classes(by_id(play, "moodBtn"))
    assert {"ctl-menu"} <= classes(by_id(play, "moodMenu"))
    play_ids = {attrs.get("id") for _, attrs in play.elements}
    assert not {"heroTime", "heroTimeBtn", "heroTimeMenu", "heroTimeClip", "heroTimeSpill", "heroTimePortraitCast"} & play_ids
    play_html = (ROOT / "play.html").read_text(encoding="utf-8")
    assert "data-time-gradient" not in play_html
    assert 'src="hero-time.js"' not in play_html and 'src="hero-time-presets.js"' not in play_html
    face = by_id(play, "face")
    assert face.get("src") == "images/neutral.webp" and "heroTimePortraitCast" not in classes(face)

    css = (ROOT / "controls.css").read_text(encoding="utf-8")
    for selector in (".ctl{", ".ctl--primary{", ".ctl--secondary", ".ctl--icon", ".ctl-menu{"):
        assert selector in css, selector
    assert "min-width:var(--menu-w)" in css
    assert ".ctl--primary{background:var(--ctl-primary-ground);color:var(--ctl-primary-ink);box-shadow:var(--ctl-rim)}" in css
    compact_controls = compact(css)
    assert ".ctl-group:not(.jbNav){background:var(--ctl-container-ground);box-shadow:var(--ctl-container-rim)}" in compact_controls
    assert ".ctl-group{" not in compact_controls

    header = (ROOT / "header.css").read_text(encoding="utf-8")
    for selector in (".jbNav", ':root[data-theme="dark"] .jbNav', ":root.jbShrunk .jbNav"):
        material = rule(header, selector)
        assert "--nav-mat:var(--ctl-ground)" in material, (selector, material)
        assert "--nav-rim:var(--ctl-container-rim)" in material, (selector, material)
    assert "border-radius:var(--r-pill)" in rule(header, ".jbNav")
    compact_header = compact(header)
    assert "@media(forced-colors:active){.jbNav{background:Canvas;color:CanvasText;box-shadow:none;outline:var(--hair-w)solidCanvasText;outline-offset:calc(var(--hair-w)*-1)}}" in compact_header

    hero_time = (ROOT / "hero-time.css").read_text(encoding="utf-8")
    assert ':root[data-theme="dark"] .jbNav' not in hero_time
    assert ':root[data-theme="dark"].jbShrunk .jbNav' not in hero_time

    # Page effects may select a semantic material, but the component stylesheet
    # remains the sole owner of the nav's actual paint properties.
    for path in (ROOT / "index.html", ROOT / "play.css"):
        source = path.read_text(encoding="utf-8")
        empathy = rule(source, "body.heroEmpathy .jbStick .jbNav")
        assert "--nav-mat:var(--ctl-ground)" in empathy, (path.name, empathy)
        assert "--nav-rim:var(--ctl-container-rim)" in empathy, (path.name, empathy)
        assert not re.search(r"(?:^|;)(?:background|background-color|box-shadow):", empathy), (path.name, empathy)
        assert "!important" not in empathy, (path.name, empathy)

    tokens = (ROOT / "tokens.css").read_text(encoding="utf-8")
    assert "--ctl-ink:var(--theme-muted" in tokens
    assert "--ctl-ink-strong:var(--theme-ink" in tokens
    assert "--ctl-ink-mute:var(--theme-muted" in tokens
    assert "--mat-i3-solid:rgb(18,18,18)" in compact(tokens)

    home_css = (ROOT / "index.html").read_text(encoding="utf-8")
    for legacy in (
        ".workCta{display:inline-flex",
        ".workCta{background:",
        ".workCta:hover",
        ".workCta:focus-visible",
        ".workCta:active",
        ".reelClose,.workCta,.mhToggle{",
    ):
        assert legacy not in home_css, legacy

    play_css = (ROOT / "play.css").read_text(encoding="utf-8")
    for legacy in (".moodBtn{display:inline-flex", ".moodMenu{position:absolute", ".moodItem{display:flex"):
        assert legacy not in play_css, legacy
    theme_css = (ROOT / "site-theme.css").read_text(encoding="utf-8")
    assert ":is(.moodBtn,.moodTeamsBtn)" not in theme_css
    assert 'body[data-theme-page="play"] .moodMenu{' not in theme_css

    assert "background:var(--theme-page,var(--c50))" in play_html

    print("Shared control static contract: OK")


if __name__ == "__main__":
    main()
