#!/usr/bin/env python3
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
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

    def handle_starttag(self,tag,attrs):
        self.order+=1
        attributes=dict(attrs)
        if tag=="script" and attributes.get("src"):
            self.scripts.append((self.order,attributes["src"]))
        if tag=="style" or (tag=="link" and "stylesheet" in attributes.get("rel","").lower().split()):
            self.styles.append(self.order)

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

def main():
    try:
        assert len(SHIPPING)==10 and len(set(SHIPPING))==10, "shipping routes must be exactly ten unique pages"
        assert not set(SHIPPING)&INTERNAL, "internal prototypes cannot be shipping routes"
        assert all((ROOT/page).is_file() for page in SHIPPING), "a shipping page is missing"
        for page in SHIPPING:
            check(page)
    except AssertionError as error:
        print(f"site theme contract: FAIL: {error}",file=sys.stderr)
        return 1
    print("site theme contract: OK")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
