#!/usr/bin/env python3
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parent.parent
SHIPPING=(
    "index.html","about.html","apollo.html","bearings.html","cluster.html",
    "strata.html","ucdavis.html","play.html","headmaker.html","gradientlab.html",
)
INTERNAL={
    "accent-swatches.html","button-system.html","header-prototype.html",
    "index-local-preview.html","orbs.html","specimen.html",
}
THEME_SOURCES=("site-theme.css","header.css","footer.css")
AUTHORED_MEDIA=re.compile(r"(?:\bimg\b|\bpicture\b|\bvideo\b|\bcanvas\b|\.face\b|\.case(?:Media|-media)\b|\.buildStage\b|\.shot\b|\.playerStage\b|\.game-artwork\b|\.arena\b)",re.I)
THEME_SELECTOR=re.compile(r"(?:\[data-theme(?:[\]\s=]|$)|\.theme-ready\b)",re.I)
FORBIDDEN_MEDIA_PROPERTY=re.compile(r"(?:^|;)\s*(filter|opacity|mix-blend-mode)\s*:",re.I)
STYLE_BLOCK=re.compile(r"<style\b[^>]*>(.*?)</style\s*>",re.I|re.S)
CSS_COMMENT=re.compile(r"/\*.*?\*/",re.S)

def css_rules(source):
    """Yield leaf CSS rules while descending through @media/@supports blocks."""
    source=CSS_COMMENT.sub("",source)

    def matching_close(opening,end):
        depth=1
        for index in range(opening+1,end):
            if source[index]=="{":
                depth+=1
            elif source[index]=="}":
                depth-=1
                if depth==0:
                    return index
        raise AssertionError("theme stylesheet has an unclosed CSS block")

    def parse(start,end):
        cursor=start
        while cursor<end:
            opening=source.find("{",cursor,end)
            if opening<0:
                return
            selector=source[cursor:opening].strip()
            closing=matching_close(opening,end)
            declarations=source[opening+1:closing]
            if selector.startswith("@"):
                yield from parse(opening+1,closing)
            else:
                yield selector,declarations
            cursor=closing+1

    yield from parse(0,len(source))

def theme_media_violations(source):
    """Return theme-only authored-media effects without touching authored CSS."""
    violations=[]
    for selector,declarations in css_rules(source):
        if THEME_SELECTOR.search(selector) and AUTHORED_MEDIA.search(selector):
            forbidden=FORBIDDEN_MEDIA_PROPERTY.search(declarations)
            if forbidden:
                violations.append(f"{selector.strip()}: {forbidden.group(1).lower()}")
    return violations

def assert_theme_media_safe(source,label):
    violations=theme_media_violations(source)
    assert not violations, f"{label}: theme selectors cannot alter authored media ({'; '.join(violations)})"

def nav_color_transition_violations(source):
    violations=[]
    for selector,declarations in css_rules(source):
        transitions=re.findall(r"\btransition\s*:\s*([^;}]+)",declarations,re.S)
        changes_color=any(
            part.strip().startswith("color ")
            for transition in transitions
            for part in transition.split(",")
        )
        if ".jbNav" in selector and changes_color and ".theme-ready" not in selector:
            violations.append(selector.strip())
    return violations

def shipping_theme_sources():
    for filename in THEME_SOURCES:
        yield filename,(ROOT/filename).read_text(encoding="utf-8")
    for page in SHIPPING:
        source=(ROOT/page).read_text(encoding="utf-8")
        for number,match in enumerate(STYLE_BLOCK.finditer(source),start=1):
            yield f"{page} style {number}",match.group(1)

class HeadOrder(HTMLParser):
    def __init__(self):
        super().__init__()
        self.order=0
        self.scripts=[]
        self.styles=[]
        self.stylesheet_links=[]

    def handle_starttag(self,tag,attrs):
        self.order+=1
        attributes=dict(attrs)
        if tag=="script" and attributes.get("src"):
            self.scripts.append((self.order,attributes["src"]))
        if tag=="style":
            self.styles.append(self.order)
        if tag=="link" and "stylesheet" in attributes.get("rel","").lower().split():
            self.styles.append(self.order)
            self.stylesheet_links.append((self.order,attributes.get("href", "")))

def check(page):
    parser=HeadOrder()
    parser.feed((ROOT/page).read_text(encoding="utf-8"))
    sources=Counter(source for _,source in parser.scripts)
    assert sources["site-theme-state.js"]==1, f"{page}: expected one site-theme-state.js"
    assert sources["site-theme.js"]==1, f"{page}: expected one site-theme.js"
    state_order=next(order for order,source in parser.scripts if source=="site-theme-state.js")
    controller_order=next(order for order,source in parser.scripts if source=="site-theme.js")
    assert state_order<controller_order, f"{page}: state model must load before controller"
    assert parser.styles, f"{page}: no themeable styles found"
    assert controller_order<min(parser.styles), f"{page}: controller must precede all themeable styles"
    theme_links=[(order,href) for order,href in parser.stylesheet_links if href=="site-theme.css"]
    assert len(theme_links)==1, f"{page}: expected one site-theme.css"
    theme_order=theme_links[0][0]
    assert theme_order==max(parser.styles), f"{page}: site-theme.css must be the final stylesheet"
    for shared in ("header.css", "footer.css"):
        shared_links=[order for order,href in parser.stylesheet_links if href==shared]
        assert len(shared_links)==1, f"{page}: expected one {shared}"
        assert shared_links[0]<theme_order, f"{page}: {shared} must precede site-theme.css"

def check_theme_stylesheet():
    source=(ROOT/"site-theme.css").read_text(encoding="utf-8")
    compact=re.sub(r"\s+", "", source)
    for token,value in (
        ("--theme-page", "#0B0C0F"), ("--theme-surface", "#111318"),
        ("--theme-elevated", "#171A21"), ("--theme-ink", "#F4F5F7"),
        ("--theme-muted", "#A7ABB4"), ("--theme-focus", "#D9D7FF"),
        ("--theme-atmosphere", "rgba(103,99,228,.16)"),
    ):
        assert f"{token}:{value}" in compact, f"site-theme.css: missing dark {token}"
    assert "color-scheme:dark" in compact, "site-theme.css: dark root must opt into color-scheme"
    assert "@media(max-width:760px){:root{--theme-duration:280ms}}" in compact, "site-theme.css: missing mobile timing"
    assert "@media(prefers-reduced-motion:reduce)" in compact and "--theme-duration:0ms" in compact, "site-theme.css: missing reduced-motion timing"
    assert "@media(forced-colors:active)" in compact, "site-theme.css: missing forced-colors guard"
    assert "--theme-atmosphere:transparent" in compact, "site-theme.css: forced colors must remove atmosphere"
    assert ".theme-ready" in source and not re.search(r"transition\s*:\s*all\b", source), "site-theme.css: transitions must be theme-ready and property-specific"
    for label,theme_source in shipping_theme_sources():
        assert_theme_media_safe(theme_source,label)
    # This probe keeps the detector honest: adding a dark media filter must fail
    # the same contract rather than merely matching a token name in source text.
    try:
        assert_theme_media_safe(':root[data-theme="dark"] .face{filter:invert(1)}',"media safety probe")
    except AssertionError:
        pass
    else:
        raise AssertionError("site-theme.css: media safety probe did not reject a dark media filter")

def check_shared_theme_transitions():
    header=(ROOT/"header.css").read_text(encoding="utf-8")
    footer=(ROOT/"footer.css").read_text(encoding="utf-8")
    compact_header=re.sub(r"\s+", "", header)
    compact_footer=re.sub(r"\s+", "", footer)
    assert ".theme-ready.jbNav:is(a,button,.jbDiscGo){transition:colorvar(--theme-duration,400ms)" in compact_header, "header.css: ready-state nav color transition must use --theme-duration"
    direct_hover=".theme-ready.jbGrp>:is(a,button):not(.jbHome):hover,.theme-ready.jbGrp>.jbDisc:hover>.jbDiscGo,.theme-ready.jbGrp>.jbDisc:focus-within>.jbDiscGo{transition:colorvar(--theme-duration,400ms)"
    assert direct_hover in compact_header, "header.css: ready-state direct-nav hover/focus color transition is missing"
    assert compact_header.index(direct_hover)>compact_header.index(".jbGrp>:is(a,button):not(.jbHome):hover,"), "header.css: ready-state direct-nav transition must follow the overriding hover rule"
    direct_reduced="@media(prefers-reduced-motion:reduce){.theme-ready.jbGrp>:is(a,button):not(.jbHome):hover,.theme-ready.jbGrp>.jbDisc:hover>.jbDiscGo,.theme-ready.jbGrp>.jbDisc:focus-within>.jbDiscGo{transition-duration:0ms}}"
    assert direct_reduced in compact_header, "header.css: reduced motion must match direct-nav hover/focus specificity"
    assert compact_header.index(direct_reduced)>compact_header.index(direct_hover), "header.css: direct-nav reduced-motion override must follow its ready transition"
    assert "@media(prefers-reduced-motion:reduce){.theme-ready.jbNav:is(a,button,.jbDiscGo){transition-duration:0ms}" in compact_header, "header.css: reduced motion must zero ready-state nav color transition"
    assert ".theme-ready.siteFoot,.theme-ready.footReach,.theme-ready.footIn,.theme-ready.footMark{transition:colorvar(--theme-duration)" in compact_footer, "footer.css: ready-state semantic footer transition is missing"
    violations=nav_color_transition_violations(header)
    assert not violations, f"header.css: nav color transitions must be theme-ready ({'; '.join(violations)})"

def main():
    try:
        assert len(SHIPPING)==10 and len(set(SHIPPING))==10, "shipping routes must be exactly ten unique pages"
        assert not set(SHIPPING)&INTERNAL, "internal prototypes cannot be shipping routes"
        assert all((ROOT/page).is_file() for page in SHIPPING), "a shipping page is missing"
        check_theme_stylesheet()
        check_shared_theme_transitions()
        for page in SHIPPING:
            check(page)
    except AssertionError as error:
        print(f"site theme contract: FAIL: {error}",file=sys.stderr)
        return 1
    print("site theme contract: OK")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
