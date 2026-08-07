#!/usr/bin/env python3
"""Computed-style and responsive contracts for Home/Play shared controls."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
VIEWPORTS = ((1440, 900), (390, 844), (320, 800))
STATES = ("off", "night")


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


def rgba_alpha(color):
    if color == "transparent":
        return 0.0
    if color.startswith("rgba("):
        return float(color.removeprefix("rgba(").removesuffix(")").split(",")[-1])
    return 1.0


def verify(page, route, width, height, state):
    page.goto(route, wait_until="domcontentloaded")
    page.wait_for_function("window.SiteTheme && document.documentElement.classList.contains('theme-ready')")
    if route.endswith("play.html"):
        page.wait_for_selector('body[data-play-ready="true"]', timeout=20_000)
    page.evaluate("state => window.SiteTheme.setMode(state, {persist:false})", state)
    hero = "#playArena" if route.endswith("play.html") else "#main"
    if route.endswith("index.html"):
        page.wait_for_function(
            "([selector,state]) => document.querySelector(selector).dataset.timeState === state",
            arg=[hero, state],
        )

    selectors = ["#workBtn"]
    if route.endswith("play.html"):
        selectors.append("#moodBtn")
    else:
        selectors.append("#heroTimeBtn")
    data = page.evaluate(
        """selectors => ({
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          controls: selectors.map(selector => {
            const node=document.querySelector(selector), box=node.getBoundingClientRect(), css=getComputedStyle(node);
            return {selector,left:box.left,right:box.right,top:box.top,bottom:box.bottom,width:box.width,height:box.height,
              boxSizing:css.boxSizing,radius:css.borderRadius,border:css.borderTopWidth,
              background:css.backgroundColor,shadow:css.boxShadow,fontSize:css.fontSize,fontWeight:css.fontWeight};
          }),
          menus: ['#heroTimeMenu','#moodMenu','.jbDiscMenu'].flatMap(selector => [...document.querySelectorAll(selector)]).map(node => {
            const css=getComputedStyle(node); return {background:css.backgroundColor,shadow:css.boxShadow};
          }),
          ctaRows: selectors.map(selector => Math.round(document.querySelector(selector).getBoundingClientRect().top)),
          heroBox: (() => { const node=document.querySelector(selectorForHero()), r=node.getBoundingClientRect(); return {top:r.top,bottom:r.bottom,height:r.height,barH:getComputedStyle(node).getPropertyValue('--bar-h'),minHeight:getComputedStyle(node).minHeight,padding:getComputedStyle(node).padding}; })(),
          viewportHeight: innerHeight,
          playTimeNodes: document.querySelectorAll('#heroTime,#heroTimeBtn,#heroTimeMenu,#heroTimeClip,#heroTimeSpill,[data-time-gradient],#heroTimePortraitCast').length,
          face: document.querySelector('#face') ? {src:document.querySelector('#face').getAttribute('src'),filter:getComputedStyle(document.querySelector('#face')).filter} : null
        })"""
        .replace("selectorForHero()", repr(hero)),
        selectors,
    )
    assert data["overflow"] <= 1, (route, width, state, data)
    for control in data["controls"]:
        assert control["boxSizing"] == "border-box", control
        assert abs(control["height"] - 44) <= 0.5, control
        assert control["radius"] == "14px" and control["border"] == "0px", control
        assert control["left"] >= -1 and control["right"] <= width + 1, control
        assert rgba_alpha(control["background"]) == 1, control
    assert all(rgba_alpha(menu["background"]) == 1 for menu in data["menus"]), data["menus"]
    if route.endswith("play.html"):
        assert data["playTimeNodes"] == 0, data
        assert data["face"]["src"] == "images/neutral.webp" and data["face"]["filter"] == "none", data["face"]
        assert abs(data["heroBox"]["bottom"] - height) <= 2, data
        if width == 320:
            assert data["ctaRows"][0] == data["ctaRows"][1], data["ctaRows"]


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            for width, height in VIEWPORTS:
                for state in STATES:
                    context = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce")
                    page = context.new_page()
                    verify(page, base + "/index.html", width, height, state)
                    verify(page, base + "/play.html", width, height, state)
                    context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print("Shared control browser contract: OK")


if __name__ == "__main__":
    main()
