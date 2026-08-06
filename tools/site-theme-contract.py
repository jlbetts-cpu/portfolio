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
    for media in ("img", "picture", "video", "canvas", ".face", ".caseMedia", ".game-artwork"):
        assert media in source, f"site-theme.css: missing explicit media guard for {media}"
    for guard in ("--theme-media-filter", "--theme-media-opacity", "--theme-media-blend-mode"):
        assert guard in source, f"site-theme.css: missing {guard} media guard"

def main():
    try:
        assert len(SHIPPING)==10 and len(set(SHIPPING))==10, "shipping routes must be exactly ten unique pages"
        assert not set(SHIPPING)&INTERNAL, "internal prototypes cannot be shipping routes"
        assert all((ROOT/page).is_file() for page in SHIPPING), "a shipping page is missing"
        check_theme_stylesheet()
        for page in SHIPPING:
            check(page)
    except AssertionError as error:
        print(f"site theme contract: FAIL: {error}",file=sys.stderr)
        return 1
    print("site theme contract: OK")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
