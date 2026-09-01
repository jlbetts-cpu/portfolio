#!/usr/bin/env python3
"""Static Task 2 contracts for shared surfaces and case-study controls."""

from html.parser import HTMLParser
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
CASES = ("bearings.html", "apollo.html", "cluster.html", "strata.html", "ucdavis.html",
         "yowmings.html")
SHARED_ASSETS = {
    "tokens.css", "controls.css", "header.css", "footer.css", "site-theme.css", "hero-time.css",
}
# THE TOKEN IS DERIVED, SO THIS CANNOT BE A LITERAL ANY MORE. It was
# "v=20260806-shared-surfaces" and it pinned a string that had not moved since 6
# August while every file it versions changed on the 19th and 20th -- which is
# exactly the staleness tools/asset-token-contract.py was written to make
# impossible. What THIS contract cares about is that every shared stylesheet on
# every page carries the SAME token, not what the token says; the value's
# correctness is asset-token-contract's job. So it is read from the tree.
def _shared_version():
    hrefs = re.findall(r'\.css\?(v=[A-Za-z0-9._-]+)', (ROOT / "index.html").read_text(encoding="utf-8"))
    assert hrefs, "index.html carries no versioned stylesheet at all"
    return hrefs[0]


SHARED_VERSION = _shared_version()


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


def rule_block(css, selector):
    """The declarations of one rule, comments stripped, or "" if it is absent.

    Written here rather than imported so this contract stays standalone -- it is
    the only thing in tools/ that reads hero-time.css for shape rather than for
    a substring, and a shared helper would make two files move together for no
    reason.
    """
    stripped = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    hit = re.search(re.escape(selector) + r"\s*\{([^}]*)\}", stripped)
    return hit.group(1) if hit else ""


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
        # --hero-peek-lift IS GONE FROM THIS LIST BECAUSE IT IS GONE FROM THE
        # SITE, 2026-08-21. It was the distance .heroCharacterPeek rose during a
        # movie, and the peek is the head's own crop -- the translate it fed
        # moved the crop with it, so driven up its authored 64px at 1440x900 the
        # chin was cut off at y=494 instead of at the Hero's floor at 560. It
        # could only ever crop the head. The movie's vertical fit is solved per
        # frame on --hero-movie-guard-y instead, inside the crop; see
        # hero-engine.js's movieCompositionFit(). Asserting the token still
        # exists would be asserting the dead knob.
        "--hero-peek-width", "--hero-peek-depth", "--hero-peek-offset",
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
    #
    # TWO CORRECTIONS, 2026-08-08, both of which were making this assert fire on
    # things that are not geometry.
    #  1. COMMENTS ARE NOT CSS. The block is heavily commented, and the moment a
    #     comment said "the 44px target stays inside the box" the check failed on
    #     prose describing the token ladder rather than on a value bypassing it.
    #  2. A ZERO FALLBACK IS NOT A CONSTANT. `var(--selection-x,0px)` does not
    #     pick a length off any ladder -- it names the absence of one, for the
    #     frames before JS writes the real value. Zero is on no rung, cannot
    #     drift, and inside calc() it cannot be written unitless. Any NON-zero
    #     literal still fails, which is the case the rule was written for.
    task2_css = controls.split("/* Task 2 shared surfaces", 1)[1].split("/* End Task 2 shared surfaces", 1)[0]
    task2_decls = re.sub(r"/\*.*?\*/", " ", task2_css, flags=re.S)
    offenders = [m.group(0) for m in
                 re.finditer(r"(?<![-\w])\d+(?:\.\d+)?(?:px|ms|s)\b", task2_decls)
                 if float(m.group(0).rstrip("pxms")) != 0]
    assert not offenders, (offenders, task2_decls)
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
    # ── THE TIME TRIGGER IS A BAR ITEM NOW, NOT AN ICON CHIP.  2026-08-27 ───
    # This demanded ctl--icon and exactly one ground variant, and both were
    # right while the control stood in the Hero's bottom-right rail: .ctl--icon
    # is a square button with a ground and a rim, and nothing else out there was
    # going to give it one. Jayden moved it into the header -- "the time of day
    # button should be in the header since it affects all the pages" -- and in
    # the bar it is one of six items and must be drawn by the variant the other
    # five are: .ctl--nav, which carries the 38px ink box, the pill radius and
    # the ::after that takes the target to 44 (docs/house-style.md 5). All ten
    # shipping pages carry `ctl ctl--nav` and no ground variant at all, because
    # the bar owns its items' ground -- rest none, hover and [aria-expanded] on
    # --nav-hover-bg. Demanding ctl--icon here would be asserting the bug: a
    # second control geometry in a bar whose whole point is one. Demanding a
    # ground variant would be asserting a seventh item drawn by a different rule
    # than the other six.
    # WHAT THIS FILE IS FOR IS UNCHANGED AND STILL ENFORCED: the control comes
    # from the shared library rather than being hand-rolled, and it carries at
    # most one ground -- two would be an equal-specificity cascade race between
    # library rules, which is the half-migrated state .reelTap was in.
    # tools/hero-specimen-check.py and tools/shared-controls-contract.py were
    # brought to this on 2026-08-26 and say the same thing; the three agree on
    # purpose, and this file was the one left behind.
    assert {"ctl", "ctl--nav"} <= classes(time_button), classes(time_button)
    assert "ctl--icon" not in classes(time_button), (
        "the bar has one item geometry", sorted(classes(time_button)))
    grounds = classes(time_button) & {
        "ctl--primary", "ctl--secondary", "ctl--quiet", "ctl--on-dark"}
    assert len(grounds) <= 1, (
        "the time trigger may name at most one library ground variant", sorted(grounds))
    for tag, attrs in home.elements:
        if "csTab" in classes(attrs):
            assert tag == "button" and {"ctl", "ctl--tab"} <= classes(attrs)
        if "csFrame" in classes(attrs):
            assert "surface--media" not in classes(attrs)

    hero_time_css = (ROOT / "hero-time.css").read_text(encoding="utf-8")
    hero_time_js = (ROOT / "hero-time.js").read_text(encoding="utf-8")
    assert "opensAbove" not in hero_time_css and "opensAbove" not in hero_time_js
    assert "overflow-y:auto" in controls
    # ── .hero::after MAY EXIST; IT MAY NOT BE A RIM. ───────────────────────
    # This was a blunt `".hero::after" not in hero_time_css`, and what it was
    # actually built to stop is what 422a90b deleted: an inset:0 overlay at
    # z-index 10 carrying `box-shadow:var(--time-rim)`, i.e. an ELEVATION on the
    # Hero. The companion heads cast the only shadow on this site, so that rule
    # had to go and this assertion kept it gone.
    # The selector came back on 2026-08-20 for the opposite kind of thing: a 1px
    # border-bottom that draws the gradient's own bottom edge, because Jayden
    # asked for the work section's rule to "do the whole bottom of the gradient
    # instead" and an inset box-shadow could not paint there (the sky is a child
    # and covers it). A hairline boundary is not a rim, so the assertion is
    # narrowed to the property that carries the defect rather than to the
    # selector that happened to carry it once.
    after = rule_block(hero_time_css, ".hero::after")
    if after:
        assert "box-shadow" not in after, \
            ("the Hero has taken an elevation back on ::after; chrome separates "
             "with a hairline and only the heads cast a shadow", after)
        assert "--time-rim" not in after, after
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
    # WHAT IS APPROVED IS THE LIGHT, NOT THE GEOMETRY. Each of these five once
    # carried its own hardcoded horizontal radius -- 103.24, 102.68, 102.84,
    # 102.83, 103.12 -- and they were collapsed into var(--hero-glow-rx) so the
    # glow scales with the viewport instead of the element. Five values within
    # half a percent of each other were not five decisions, and an exact-string
    # assertion turned that tidy-up into five failures while nothing about the
    # sky had changed.
    #
    # So the colours and their stops are asserted, which is the part Jayden chose
    # and the part that must never drift, and the radius is allowed to be a token.
    # Everything from the first colour to the closing brace still has to match to
    # the character -- reorder a stop or shift a hex and this still fails.
    for approved in approved_day_gradients:
        state = re.search(r'data-time-gradient="([a-z-]+)"', approved).group(1)
        light = approved[approved.index(",#"):]          # from the first colour on
        live = re.search(
            r'\.heroTimeGradient\[data-time-gradient="%s"\]\{background:[^}]*\}' % state,
            hero_time_css)
        assert live, "no gradient rule for %s in hero-time.css" % state
        assert light in live.group(0), (
            "the %s sky's colours or stops have drifted from the approved run\n"
            "  approved: %s\n  live:     %s" % (state, light[:120], live.group(0)[-120:]))
        assert "radial-gradient(var(--hero-glow-rx)" in live.group(0), (
            "%s no longer takes its glow radius from --hero-glow-rx" % state)
    assert "heroNightStars" in home_html and 28 <= home_html.count("--star-x:") <= 36
    # ── THE STAR FIELD, ASSERTED AS PROPERTIES AND NOT AS A STRING ──────────
    # 2026-08-27. This was `".heroNightStars{position:absolute;inset:0" in
    # hero_time_css` -- a literal that pinned not just the two properties but
    # the ORDER they were declared in and what came first in the block. The
    # night-sky work added --star-mask to the head of that rule, both
    # properties survived untouched, and the gate went red anyway. It stayed
    # red across several commits because the failure looks identical to a real
    # regression.
    # This is the same fix the reduced-motion assertion below already carries;
    # it was applied there and missed here. What is checked now is what
    # actually has to be true: the star layer fills its parent. Declaration
    # order is not behaviour.
    _stars = re.search(r"\.heroNightStars\{([^}]*)\}", hero_time_css)
    assert _stars, "the .heroNightStars rule is gone"
    for _prop in ("position:absolute", "inset:0"):
        assert _prop in _stars.group(1), (
            ".heroNightStars no longer sets %s, so the star field does not "
            "fill the hero" % _prop)
    assert ".hero[data-time-state=\"night\"] .heroNightStars{opacity:1}" in hero_time_css
    # ── THE REDUCED-MOTION STARS, ASSERTED AS PROPERTIES AND NOT AS A STRING ──
    # 2026-08-27. This pinned the rule's whole declaration block character for
    # character:
    #     .heroNightStars i{opacity:clamp(.34,var(--star-alpha),.72);animation:none!important}
    # and it failed the moment a `scale:1` was added beside them -- on a change
    # that made the guard STRONGER, not weaker, because the shimmer grew a
    # second animation on `scale` and stopping `animation` alone would have left
    # the last frame of it applied. A gate that cannot tell "this rule gained a
    # declaration" from "this rule lost its guard" is not testing the guard. It
    # is the same failure the gradient block above already has a headstone for,
    # thirty lines up.
    # WHAT MUST BE TRUE, stated directly: under prefers-reduced-motion the stars
    # do not animate, they are still THERE at their authored brightness, and
    # nothing about them is transformed away. Extra declarations are allowed;
    # losing any of these is not.
    # Comments come off first: this file's own gradient headstone was written
    # after an assertion matched prose describing a rule instead of the rule.
    css_only = re.sub(r"/\*.*?\*/", " ", hero_time_css, flags=re.S)
    guards = [m for m in re.finditer(r"\.heroNightStars i\{([^}]*)\}", css_only)
              if "animation:none!important" in m.group(1)]
    assert len(guards) == 1, (
        "expected exactly one .heroNightStars i rule that stops the animations, "
        f"found {len(guards)}")
    # It has to be the REDUCED-MOTION one and not a rule that stops the shimmer
    # for everybody: the last @media opened before it must be that query.
    opened = [m for m in re.finditer(r"@media\(([^)]*)\)\{", css_only)
              if m.start() < guards[0].start()]
    assert opened and "prefers-reduced-motion:reduce" in opened[-1].group(1), (
        "the star guard is not inside @media(prefers-reduced-motion:reduce) -- "
        "it stops the shimmer for everybody")
    guard = guards[0].group(1)
    assert "animation:none!important" in guard, (
        "reduced motion no longer stops the star animations: " + guard)
    assert "opacity:clamp(.34,var(--star-alpha),.72)" in guard, (
        "reduced motion no longer holds the stars at their authored brightness "
        "-- a starfield that vanishes is a different picture from a still one: "
        + guard)
    assert "scale:1" in guard, (
        "the shimmer's scale is not reset under reduced motion, so the stars "
        "keep whatever size the last frame of it left them at: " + guard)
    # ── AND THE SHIMMER ITSELF IS NIGHT-SCOPED ────────────────────────────────
    # It used to sit on the base rule, so 32 animations ran all day behind a
    # layer at opacity:0. Measured: 40 running animations in daylight before,
    # 8 after. The selector is the whole of that fix, so the selector is what is
    # asserted.
    assert re.search(r'\.hero\[data-time-state="night"\] \.heroNightStars i\{\s*\n?\s*animation:',
                     hero_time_css), (
        "the star twinkle is not scoped to night -- it will run all day behind "
        "a starfield at opacity:0")
    base_star = re.search(r"\n\.heroNightStars i\{([^}]*)\}", hero_time_css)
    assert base_star and "animation:" not in base_star.group(1), (
        "the base .heroNightStars i rule carries an animation again")
    browser_contract = (ROOT / "tools/shared-surfaces-browser.py").read_text(encoding="utf-8")
    assert "const iris=document.querySelector('#stage .iris')" in browser_contract, "brittle live-eye lookup"
    assert "iris ? getComputedStyle(iris).transform : null" in browser_contract, "brittle live-eye lookup"
    engine = (ROOT / "hero-engine.js").read_text(encoding="utf-8")
    transform = (ROOT / "hero-head-transform.js").read_text(encoding="utf-8")
    assert "window.HeroHeadTransform={init:init}" in transform
    assert 'face.addEventListener("pointerdown",beginMove)' in transform
    assert "tapReact()" not in transform
    # THIS ASSERTION COULD NEVER PASS, and it was forbidding the wrong thing.
    # It banned the substring outright, but the fix it was written to protect is a
    # GUARDED binding, and the guarded line contains that substring verbatim:
    #     if(!faceImg.closest(".heroHeadTransform"))faceImg.addEventListener("click",...)
    # So the contract went red the moment the bug was fixed properly, and stayed
    # red -- which is how it ended up on a list of failures everyone had learned
    # to expect. What must be true is not that the binding is absent; it is that
    # it never runs for the portrait the transform owns, because there the click
    # belongs to drag and select. So: every binding must carry the guard.
    for m in re.finditer(r'faceImg\.addEventListener\("click"', engine):
        head = engine[max(0, m.start() - 60):m.start()]
        assert 'closest(".heroHeadTransform")' in head, (
            "an UNGUARDED click binding on the portrait at offset %d -- inside "
            ".heroHeadTransform the click is the drag and the selection, and a tap "
            "reaction fights both" % m.start())
    assert 'addEventListener("heroheadtransform"' in engine
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
            # The carousel is ONE shared component now -- carousel.css plus
            # carousel.js -- rather than four byte-identical copies of a per-page
            # script. The page is no longer where the scene cut is written, so
            # asserting "transitionend" against page HTML asserted the
            # duplication rather than the behaviour; that moved to the file that
            # owns it, below. What a page still has to prove is that it USES the
            # shared component and keeps no private copy of the engine.
            assert '<script src="carousel.js"' in html, name
            assert "carousel.css" in assets, (name, parser.stylesheets)
            assert assets.index("controls.css") < assets.index("carousel.css")
            assert ".playerBeats'" not in html and '.playerBeats"' not in html, name
            assert ".tvItems'" not in html and '.tvItems"' not in html, name
            assert "scene-swap-target" in html
        if "playerTicks" in html:
            assert "playerTick ctl ctl--tick" in html

    # The scene cut lands on a transition ending, not on a guessed timer.
    # Asserted once against the one implementation instead of five times against
    # five copies of it. The swipe surface must yield the vertical axis: pan-y,
    # never none, or a thumb on the carousel traps the page.
    carousel_js = (ROOT / "carousel.js").read_text(encoding="utf-8")
    carousel_css = (ROOT / "carousel.css").read_text(encoding="utf-8")
    assert "addEventListener('transitionend'" in carousel_js
    assert "scene-swap-target" in carousel_js
    assert "touch-action:pan-y" in carousel_css

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
