#!/usr/bin/env python3
"""Responsive computed-style contracts for Task 2 shared surfaces."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ROUTES = ("index.html", "bearings.html", "apollo.html", "cluster.html", "strata.html", "ucdavis.html")
VIEWPORTS = ((1440, 900), (390, 844), (320, 800))
MODES = ("light", "dark")
ARTIFACTS = Path("/tmp/shared-surfaces-browser")


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


def alpha(color):
    if color == "transparent":
        return 0.0
    if color.startswith("rgba("):
        return float(color.removeprefix("rgba(").removesuffix(")").split(",")[-1])
    return 1.0


def verify(page, route, route_name, width, mode):
    page.goto(route, wait_until="domcontentloaded")
    page.wait_for_function("document.documentElement.classList.contains('theme-ready')")
    page.evaluate("mode => window.SiteTheme.setMode(mode, {persist:false})", mode)
    data = page.evaluate("""route => {
      const one=s=>document.querySelector(s), css=(n,p)=>getComputedStyle(n,p), box=n=>n.getBoundingClientRect();
      const controls=[...document.querySelectorAll('.tvTab,.sbBtn,.toTop,.skipLink,.playerTick')];
      const surfaces=[...document.querySelectorAll('.surface--hero,.surface--specimen,.surface--media,.surface--tab-rail,.surface--specimen .csFrame')];
      const metric=n=>{const r=box(n);return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,
        radius:css(n).borderRadius,ground:css(n).backgroundColor,shadow:css(n).boxShadow,opacity:css(n).opacity}};
      return {
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        controls:controls.map(n=>({cls:n.className,tag:n.tagName,h:box(n).height,w:box(n).width,
          border:css(n).borderTopWidth,radius:css(n).borderRadius,ground:css(n).backgroundColor})),
        surfaces:surfaces.slice(0,8).map(n=>({cls:n.className,radius:css(n).borderRadius,
          ground:css(n).backgroundColor,shadow:css(n).boxShadow})),
        home:route==='index.html'?{
          nav:metric(one('.jbNav')),hero:metric(one('.surface--hero')),cases:metric(one('.surface--specimen')),
          tabs:metric(one('.csTabs')),frame:metric(one('.csFrame')),
          primary:metric(one('#workBtn')),time:metric(one('#heroTimeBtn')),
          skip:metric(one('.skipLink'))
        }:null,
        peek:route==='index.html'?(()=>{const p=one('.portrait-peek'),i=one('.portrait-peek__image'),h=box(one('.surface--hero')),
          r=box(p),ir=box(i);return{overflow:css(one('.surface--hero')).overflow,top:r.top,bottom:r.bottom,
            heroTop:h.top,heroBottom:h.bottom,imageBottom:ir.bottom,imageHeight:ir.height,src:i.getAttribute('src')};})():null,
        ticks:[...document.querySelectorAll('.playerTick')].map(n=>({tag:n.tagName,w:box(n).width,h:box(n).height,
          markW:parseFloat(css(n,'::before').width),markH:parseFloat(css(n,'::before').height)}))
      };
    }""", route_name)
    assert data["overflow"] <= 1, (route, width, mode, data["overflow"])
    for control in data["controls"]:
        assert control["tag"] in ("BUTTON", "A") and control["h"] >= 43.5, (route, control)
        assert control["border"] == "0px", (route, control)
    for surface in data["surfaces"]:
        assert alpha(surface["ground"]) == 1 and surface["shadow"] != "none", (route, surface)
    for tick in data["ticks"]:
        assert tick["tag"] == "BUTTON" and tick["w"] >= 43.5 and tick["h"] >= 43.5, tick
        assert abs(tick["markW"] - 14) <= .5 and abs(tick["markH"] - 2) <= .5, tick
    if data["peek"]:
        peek = data["peek"]
        home = data["home"]
        expected_edge = 120 if width == 1440 else 16
        expected_hero_radius = "28px" if width == 1440 else "20px"
        assert home["skip"]["bottom"] <= 0, home["skip"]
        assert home["nav"]["shadow"] != "none" and home["nav"]["radius"] == "999px", home["nav"]
        assert home["hero"]["shadow"] != "none" and home["hero"]["radius"] == expected_hero_radius, home["hero"]
        assert home["cases"]["radius"] == "28px" and home["tabs"]["radius"] == "20px", home
        assert home["frame"]["radius"] == "20px", home["frame"]
        for name in ("nav", "hero", "cases", "tabs", "frame"):
            assert abs(home[name]["left"] - expected_edge) <= 1, (width, mode, name, home[name])
            assert abs(home[name]["right"] - (width - expected_edge)) <= 1, (width, mode, name, home[name])
        for name in ("primary", "time"):
            assert home[name]["height"] >= 43.5 and alpha(home[name]["ground"]) == 1, (name, home[name])
        assert abs(home["primary"]["top"] - home["time"]["top"]) <= .5, home
        assert abs(home["primary"]["bottom"] - home["time"]["bottom"]) <= .5, home
        page.keyboard.press("Tab")
        page.wait_for_function("getComputedStyle(document.querySelector('.skipLink')).transform === 'none'", timeout=1000)
        focused_skip = page.locator(".skipLink").evaluate("n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,active:document.activeElement===n}}")
        assert focused_skip["active"] and focused_skip["top"] >= 0 and focused_skip["bottom"] > focused_skip["top"], focused_skip
        page.locator(".skipLink").evaluate("n=>n.blur()")
        page.wait_for_function("document.querySelector('.skipLink').getBoundingClientRect().bottom <= 0", timeout=1000)
        assert peek["src"] == "images/neutral.webp" and peek["overflow"] in ("hidden", "clip"), peek
        assert peek["heroTop"] <= peek["top"] < peek["bottom"] <= peek["heroBottom"] + 1, peek
        assert peek["imageBottom"] > peek["bottom"] and peek["imageHeight"] > (peek["bottom"] - peek["top"]), peek
        visible_ratio = (peek["bottom"] - peek["top"]) / peek["imageHeight"]
        assert .62 <= visible_ratio <= .74, peek
        page.screenshot(path=str(ARTIFACTS / f"home-{width}-{mode}.png"), full_page=False)
        page.locator("#cases").scroll_into_view_if_needed()
        page.screenshot(path=str(ARTIFACTS / f"home-work-{width}-{mode}.png"), full_page=False)
    elif page.locator(".player,.tv,.demoWrap").count():
        page.locator(".player,.tv,.demoWrap").first.scroll_into_view_if_needed()
        page.screenshot(path=str(ARTIFACTS / f"{route_name[:-5]}-{width}-{mode}.png"), full_page=False)


def main():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}/"
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            for width, height in VIEWPORTS:
                for mode in MODES:
                    context = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce")
                    page = context.new_page()
                    for route in ROUTES:
                        verify(page, base + route, route, width, mode)
                    context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print(f"Shared surface browser contract: OK ({ARTIFACTS})")


if __name__ == "__main__":
    main()
