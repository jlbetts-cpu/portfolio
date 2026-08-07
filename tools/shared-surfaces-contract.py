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
        "--radius-container", "--radius-media", "--radius-control", "--radius-menu",
        "--surface-radius", "--surface-radius-compact", "--surface-hero-radius",
        "--surface-hero-pad", "--surface-pad",
        "--surface-inset", "--surface-gutter", "--surface-gap",
        "--hero-peek-width", "--hero-peek-depth", "--hero-peek-offset", "--hero-peek-lift",
        "--media-mockup-inset", "--scene-cut-duration", "--scene-cut-ease",
        "--star-twinkle-duration", "--star-twinkle-ease", "--star-bright-size", "--star-glow-size",
        "--menu-viewport-gutter",
    ):
        assert token in tokens, token

    for selector in (
        ".surface{", ".surface--hero{", ".surface--specimen{",
        ".surface--media{", ".surface--card{", ".collection{",
        ".collection__tabs{", ".collection__content{", ".carousel-toolbar{",
        ".media--full{", ".media--mockup{", ".ctl--internal{",
        ".ctl--tab{", ".ctl--tick{", ".ctl--media-large{",
    ):
        assert selector in controls, selector

    # The shared component layer may only resolve geometry/motion through tokens.
    task2_css = controls.split("/* Task 2 shared surfaces", 1)[1].split("/* End Task 2 shared surfaces", 1)[0]
    assert not re.search(r"(?<![-\w])\d+(?:\.\d+)?(?:px|ms|s)\b", task2_css), task2_css
    assert "cubic-bezier(" not in task2_css

    home = parse("index.html")
    home_html = (ROOT / "index.html").read_text(encoding="utf-8")
    hero = next(attrs for _, attrs in home.elements if attrs.get("id") == "main")
    assert {"surface", "surface--hero"} <= classes(hero)
    assert "portrait-peek" not in home_html
    _, stage_peek = first(home, "heroCharacterPeek")
    assert "hidden" not in stage_peek and "inert" not in stage_peek
    assert stage_peek.get("aria-hidden") != "true"
    assert first(home, "stagewrap") and first(home, "stage") and first(home, "face")
    assert '<script src="hero-engine.js"></script>' in home_html
    assert home_html.index('src="hero-engine.js"') < home_html.index('src="hero-time.js"')
    cases = next(attrs for _, attrs in home.elements if attrs.get("id") == "cases")
    assert "collection" in classes(cases) and "surface--specimen" not in classes(cases)
    _, tab_rail = first(home, "csTabs")
    assert "collection__tabs" in classes(tab_rail) and "surface--tab-rail" not in classes(tab_rail)
    assert "collection__content" in home_html
    _, time_button = first(home, "heroTimeBtn")
    assert {"ctl", "ctl--icon", "ctl--secondary"} <= classes(time_button)
    for tag, attrs in home.elements:
        if "csTab" in classes(attrs):
            assert tag == "button" and {"ctl", "ctl--tab"} <= classes(attrs)
        if "csFrame" in classes(attrs):
            assert "surface--media" not in classes(attrs)

    hero_time_css = (ROOT / "hero-time.css").read_text(encoding="utf-8")
    hero_time_js = (ROOT / "hero-time.js").read_text(encoding="utf-8")
    assert "opensAbove" not in hero_time_css and "opensAbove" not in hero_time_js
    assert "overflow-y:auto" in controls
    assert ".hero::after" not in hero_time_css
    assert ".skipLink{" not in home_html and ".skipLink:focus" not in home_html
    assert ".skipLink.ctl:focus-visible" in controls
    assert ".skipLink.ctl:focus{" not in controls
    approved_day_gradients = (
        '.heroTimeGradient[data-time-gradient="pre-dawn"]{background:radial-gradient(103.24% 102.63% at 50% 102.63%,#486ffd 0,#7f81f3 9.84%,#c489ff 20.83%,#dac0ff 34.13%,#eadcff 44.86%,#f9f6ff 58.59%,#f8fafd 100%)}',
        '.heroTimeGradient[data-time-gradient="sunrise"]{background:radial-gradient(102.68% 99.11% at 50% 104.6%,#cb83ff 0,#ff90b9 15.77%,#ffc977 30.62%,#ffd79b 38.04%,#fff1dc 50.11%,#fff 63.1%,#fcfdfe 77.95%,#f8fafd 98.81%)}',
        '.heroTimeGradient[data-time-gradient="daytime"]{background:radial-gradient(102.84% 104.98% at 50% 104.98%,#0071c1 1.33%,#60a8e2 15.71%,#b4d8ff 33.15%,#d9ebff 45%,#f8fafd 60%)}',
        '.heroTimeGradient[data-time-gradient="dusk"]{background:radial-gradient(102.83% 103.24% at 49.98% 104.51%,#ffb36a 0,#dfa0d8 14%,#9da8e4 30%,#ccd5f0 44%,#f1f3fa 58%,#f8fafd 100%)}',
        '.heroTimeGradient[data-time-gradient="sunset"]{background:radial-gradient(103.12% 100% at 50% 100%,#ffa577 0,#ff90a1 15.52%,#ddadff 30.09%,#ecd8ff 45.72%,#f5eaff 54.96%,#f8fafd 88.16%)}',
    )
    for approved in approved_day_gradients:
        assert approved in hero_time_css
    assert "heroNightStars" in home_html and 28 <= home_html.count("--star-x:") <= 36
    assert ".heroNightStars{position:absolute;inset:0" in hero_time_css
    assert ".hero[data-time-state=\"night\"] .heroNightStars{opacity:1}" in hero_time_css
    assert ".heroNightStars i{opacity:clamp(.34,var(--star-alpha),.72);animation:none!important}" in hero_time_css
    browser_contract = (ROOT / "tools/shared-surfaces-browser.py").read_text(encoding="utf-8")
    assert "const iris=document.querySelector('#stage .iris')" in browser_contract, "brittle live-eye lookup"
    assert "iris ? getComputedStyle(iris).transform : null" in browser_contract, "brittle live-eye lookup"
    assert 'faceImg.addEventListener("click"' in (ROOT / "hero-engine.js").read_text(encoding="utf-8")
    assert 'activeHover="smile"' in (ROOT / "hero-engine.js").read_text(encoding="utf-8")
    assert 'frame.addEventListener("focusin"' in (ROOT / "hero-engine.js").read_text(encoding="utf-8")
    assert 'frame.addEventListener("keydown"' in (ROOT / "hero-engine.js").read_text(encoding="utf-8")
    assert 'setMoviePeek(true)' in (ROOT / "hero-engine.js").read_text(encoding="utf-8")
    reel_frame = next(attrs for _, attrs in home.elements if attrs.get("id") == "reelFrame")
    assert reel_frame.get("role") == "button" and reel_frame.get("tabindex") == "0"

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
                assert tag == "button" and {"ctl", "ctl--internal"} <= classes(attrs)
            if "playerBar" in classes(attrs):
                assert "carousel-toolbar" in classes(attrs)
                assert attrs.get("role") == "group" and attrs.get("aria-label")
            if "tv" in classes(attrs):
                assert "collection" in classes(attrs)
            if "tvTabs" in classes(attrs):
                assert "collection__tabs" in classes(attrs) and "surface--tab-rail" not in classes(attrs)
            if "tvFrame" in classes(attrs):
                assert "collection__content" in classes(attrs) and "surface--media" not in classes(attrs)
                assert {"media", "media--mockup"} <= classes(attrs)
            if "cover" in classes(attrs):
                assert {"media", "media--full"} <= classes(attrs)
            if "playerStage" in classes(attrs):
                assert {"media", "media--mockup"} <= classes(attrs)
        for copied in (".skipLink{", ".toTop{", ".sbBtn{", ".tvTab{"):
            assert copied not in html, (name, copied)
        assert "createElement('i')" not in html and 'createElement("i")' not in html
        assert "surface--tab-rail" not in html
        assert "surface surface--media" not in html
        assert "},250)" not in html and "}, 250)" not in html
        assert ".25s steps(2,end)" not in html
        if "playerBeats" in html or "tvItems" in html:
            assert "transitionend" in html
            assert "scene-swap-target" in html
        if "playerTicks" in html:
            assert "playerTick ctl ctl--tick" in html

    assert ".demoPoster:hover .demoPlay{transform:scale" not in (ROOT / "strata.html").read_text(encoding="utf-8")

    strata = parse("strata.html")
    assert {"ctl", "ctl--media-large"} <= classes(first(strata, "demoPlay")[1])
    assert {"ctl", "ctl--media-large"} <= classes(first(strata, "demoMute")[1])

    audited_media = {
        "bearings.html": (("cmpBoard", "media--full"), ("photoPair", "media--full")),
        "strata.html": (("videoFrame", "media--full"), ("photoPair", "media--full")),
        "cluster.html": (("photoPair", "media--full"),),
        "ucdavis.html": (("photoPair", "media--full"),),
    }
    for name, regions in audited_media.items():
        parser = parse(name)
        for region, expected_role in regions:
            _, attrs = first(parser, region)
            roles = classes(attrs) & {"media--full", "media--mockup"}
            assert roles == {expected_role}, f"incomplete media roles: {name} .{region} has {sorted(roles)}"
            assert "media" in classes(attrs), f"incomplete media primitive: {name} .{region}"

    print("Shared surface static contract: OK")


if __name__ == "__main__":
    main()
