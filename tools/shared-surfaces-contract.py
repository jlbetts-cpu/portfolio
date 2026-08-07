#!/usr/bin/env python3
"""Static Task 2 contracts for shared surfaces and case-study controls."""

from html.parser import HTMLParser
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
CASES = ("bearings.html", "apollo.html", "cluster.html", "strata.html", "ucdavis.html")
SHARED_ASSETS = {
    "tokens.css", "controls.css", "header.css", "footer.css", "site-theme.css", "hero-time.css",
}
SHARED_VERSION = "v=20260806-shared-surfaces"


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


def parse(name):
    parser = PageParser()
    parser.feed((ROOT / name).read_text(encoding="utf-8"))
    return parser


def classes(attrs):
    return set(attrs.get("class", "").split())


def first(parser, class_name):
    return next((tag, attrs) for tag, attrs in parser.elements if class_name in classes(attrs))


def asset_name(href):
    return href.split("?", 1)[0] if href else href


def main():
    tokens = (ROOT / "tokens.css").read_text(encoding="utf-8")
    controls = (ROOT / "controls.css").read_text(encoding="utf-8")

    # Shared CSS is one dependency generation. A browser must never be able to
    # combine new component rules with stale tokens from a previous generation.
    for page in sorted(ROOT.glob("*.html")):
        parser = parse(page.name)
        for href in parser.stylesheets:
            if asset_name(href) in SHARED_ASSETS:
                assert href == f"{asset_name(href)}?{SHARED_VERSION}", (page.name, href)
    for token in (
        "--surface-ground", "--surface-ground-muted", "--surface-rim",
        "--surface-radius", "--surface-radius-compact", "--surface-hero-radius",
        "--surface-hero-pad", "--surface-pad",
        "--surface-inset", "--surface-gutter", "--surface-gap",
        "--portrait-peek-width", "--portrait-peek-height", "--portrait-peek-offset",
        "--portrait-peek-opacity",
    ):
        assert token in tokens, token

    for selector in (
        ".surface{", ".surface--hero{", ".surface--specimen{",
        ".surface--media{", ".surface--card{", ".surface--tab-rail{",
        ".ctl--tab{", ".ctl--tick{", ".ctl--media-large{",
    ):
        assert selector in controls, selector

    # The shared component layer may only resolve geometry/motion through tokens.
    task2_css = controls.split("/* Task 2 shared surfaces", 1)[1].split("/* End Task 2 shared surfaces", 1)[0]
    assert not re.search(r"(?<![-\w])\d+(?:\.\d+)?(?:px|ms|s)\b", task2_css), task2_css
    assert "cubic-bezier(" not in task2_css

    home = parse("index.html")
    hero = next(attrs for _, attrs in home.elements if attrs.get("id") == "main")
    assert {"surface", "surface--hero"} <= classes(hero)
    _, peek = first(home, "portrait-peek")
    assert peek.get("aria-hidden") == "true"
    peek_img = next(attrs for tag, attrs in home.elements if tag == "img" and "portrait-peek__image" in classes(attrs))
    assert peek_img.get("src") == "images/neutral.webp" and peek_img.get("alt") == ""
    cases = next(attrs for _, attrs in home.elements if attrs.get("id") == "cases")
    assert {"surface", "surface--specimen"} <= classes(cases)
    _, tab_rail = first(home, "csTabs")
    assert "surface--tab-rail" in classes(tab_rail)
    _, time_button = first(home, "heroTimeBtn")
    assert {"ctl", "ctl--icon", "ctl--secondary"} <= classes(time_button)
    for tag, attrs in home.elements:
        if "csTab" in classes(attrs):
            assert tag == "button" and {"ctl", "ctl--tab"} <= classes(attrs)
        if "csFrame" in classes(attrs):
            assert "surface--specimen" in classes(cases)

    for name in CASES:
        parser = parse(name)
        html = (ROOT / name).read_text(encoding="utf-8")
        assets = [asset_name(href) for href in parser.stylesheets]
        assert "controls.css" in assets, (name, parser.stylesheets)
        assert assets.index("tokens.css") < assets.index("controls.css")
        assert {"ctl", "ctl--secondary"} <= classes(first(parser, "skipLink")[1])
        assert {"ctl", "ctl--icon"} <= classes(first(parser, "toTop")[1])
        for tag, attrs in parser.elements:
            if "tvTab" in classes(attrs):
                assert tag == "button" and {"ctl", "ctl--tab"} <= classes(attrs)
            if "sbBtn" in classes(attrs):
                assert tag == "button" and {"ctl", "ctl--icon"} <= classes(attrs)
        for copied in (".skipLink{", ".toTop{", ".sbBtn{", ".tvTab{"):
            assert copied not in html, (name, copied)
        assert "createElement('i')" not in html and 'createElement("i")' not in html
        if "playerTicks" in html:
            assert "playerTick ctl ctl--tick" in html

    strata = parse("strata.html")
    assert {"ctl", "ctl--media-large"} <= classes(first(strata, "demoPlay")[1])
    assert {"ctl", "ctl--media-large"} <= classes(first(strata, "demoMute")[1])

    print("Shared surface static contract: OK")


if __name__ == "__main__":
    main()
