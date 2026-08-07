#!/usr/bin/env python3
"""Computed-style and responsive contracts for Home/Play shared controls."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import re

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


def rgb(color):
    values = [float(value) for value in re.findall(r"[\d.]+", color)[:3]]
    assert len(values) == 3, color
    return values


def contrast(first, second):
    def luminance(color):
        channels = []
        for channel in rgb(color):
            channel /= 255
            channels.append(channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4)
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]

    light, dark = sorted((luminance(first), luminance(second)), reverse=True)
    return (light + 0.05) / (dark + 0.05)


def computed(page, selector):
    return page.eval_on_selector(
        selector,
        """node => {
          const opaqueGround = start => {
            for (let at=start; at; at=at.parentElement) {
              const value=getComputedStyle(at).backgroundColor;
              if (value !== 'transparent' && !value.endsWith(', 0)')) return value;
            }
            return 'rgb(255, 255, 255)';
          };
          const css=getComputedStyle(node);
          return {color:css.color,background:opaqueGround(node),surround:opaqueGround(node.parentElement),
            shadow:css.boxShadow,outlineColor:css.outlineColor,outlineWidth:css.outlineWidth};
        }""",
    )


def assert_contrast(style, label, minimum=4.5):
    ratio = contrast(style["color"], style["background"])
    assert ratio >= minimum, (label, ratio, style)


def assert_focus(page, selector, label):
    page.locator(selector).focus()
    page.wait_for_timeout(10)
    style = computed(page, selector)
    assert_contrast(style, label + " focus")
    assert float(style["outlineWidth"].removesuffix("px")) >= 2, (label, style)
    assert contrast(style["outlineColor"], style["surround"]) >= 3, (label, style)
    return style


def assert_hover(page, selector, label):
    session = page.context.new_cdp_session(page)
    session.send("DOM.enable")
    session.send("CSS.enable")
    root = session.send("DOM.getDocument")["root"]["nodeId"]
    node = session.send("DOM.querySelector", {"nodeId": root, "selector": selector})["nodeId"]
    session.send("CSS.forcePseudoState", {"nodeId": node, "forcedPseudoClasses": ["hover"]})
    page.wait_for_timeout(10)
    style = computed(page, selector)
    session.send("CSS.forcePseudoState", {"nodeId": node, "forcedPseudoClasses": []})
    session.detach()
    assert_contrast(style, label + " hover")
    return style


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

    hero_style = computed(page, ".heroCopy h1")
    hero_ground = computed(page, hero)["background"]
    hero_style["background"] = hero_ground
    assert_contrast(hero_style, f"{route} hero {width} {state}")

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
        assert "inset" in control["shadow"], control
    assert all(rgba_alpha(menu["background"]) == 1 for menu in data["menus"]), data["menus"]
    assert all("inset" in menu["shadow"] for menu in data["menus"]), data["menus"]

    skip = "#playSkip" if route.endswith("play.html") else ".skipLink"
    trigger = "#moodBtn" if route.endswith("play.html") else "#heroTimeBtn"
    rows = "#moodMenu .ctl--row" if route.endswith("play.html") else "#heroTimeMenu .ctl--row"
    for selector, label in (("#workBtn", "primary"), (trigger, "secondary/icon"), (skip, "skip")):
        rest = computed(page, selector)
        assert_contrast(rest, f"{route} {label} rest {width} {state}")
        focus = assert_focus(page, selector, f"{route} {label} {width} {state}")
        hover = assert_hover(page, selector, f"{route} {label} {width} {state}")
        assert all("inset" in style["shadow"] for style in (rest, focus, hover)), (label, rest, focus, hover)

    page.locator(trigger).click()
    page.wait_for_timeout(10)
    for index in range(page.locator(rows).count()):
        selector = f"{rows}:nth-child({index + 1})"
        rest = computed(page, selector)
        assert_contrast(rest, f"{route} row {index} rest {width} {state}")
        assert_focus(page, selector, f"{route} row {index} {width} {state}")
        assert_hover(page, selector, f"{route} row {index} {width} {state}")
    if route.endswith("play.html"):
        assert data["playTimeNodes"] == 0, data
        assert data["face"]["src"] == "images/neutral.webp" and data["face"]["filter"] == "none", data["face"]
        assert abs(data["heroBox"]["bottom"] - height) <= 2, data
        if width == 320:
            assert data["ctaRows"][0] == data["ctaRows"][1], data["ctaRows"]
        footer = page.locator("#contact")
        hub_footer = footer.evaluate(
            "node => ({display:getComputedStyle(node).display,height:node.getBoundingClientRect().height})"
        )
        assert hub_footer["display"] != "none" and hub_footer["height"] > 0, hub_footer
        for active_class in ("pTeamOn", "hmSoccer", "hmBattle", "hmRace", "hmTour"):
            active_footer = page.evaluate(
                """value => {
                  document.body.classList.add(value);
                  const node=document.querySelector('#contact');
                  const result={display:getComputedStyle(node).display,height:node.getBoundingClientRect().height};
                  document.body.classList.remove(value);
                  return result;
                }""",
                active_class,
            )
            assert active_footer == {"display": "none", "height": 0}, (active_class, active_footer)
        restored_footer = footer.evaluate(
            "node => ({display:getComputedStyle(node).display,height:node.getBoundingClientRect().height})"
        )
        assert restored_footer == hub_footer, (hub_footer, restored_footer)


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
