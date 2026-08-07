#!/usr/bin/env python3
"""Computed shared-header material contract across representative routes."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ROUTES = ("index.html", "play.html", "about.html", "bearings.html")
VIEWPORTS = ((1280, 900), (390, 844), (320, 800))
STATES = ("off", "night")


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


def alpha(color):
    if color == "transparent":
        return 0.0
    if color.startswith("rgba("):
        return float(color.removeprefix("rgba(").removesuffix(")").split(",")[-1])
    return 1.0


def close(first, second, tolerance=0.51):
    return abs(first - second) <= tolerance


def read_nav(page):
    return page.evaluate(
        """
        () => {
          const nav=document.querySelector('.jbNav');
          const css=getComputedStyle(nav), box=nav.getBoundingClientRect();
          const probe=document.createElement('i');
          probe.style.cssText='position:fixed;pointer-events:none;background:var(--ctl-ground);box-shadow:var(--ctl-container-rim)';
          document.body.appendChild(probe);
          const probeCss=getComputedStyle(probe);
          const result={
            background:css.backgroundColor, expectedBackground:probeCss.backgroundColor,
            shadow:css.boxShadow, expectedShadow:probeCss.boxShadow,
            page:getComputedStyle(document.body).backgroundColor,
            radius:css.borderRadius, height:box.height, left:box.left, right:box.right,
            paddingLeft:css.paddingLeft, paddingRight:css.paddingRight
          };
          probe.remove();
          return result;
        }
        """
    )


def assert_geometry_same(first, second, label):
    for key in ("height", "left", "right"):
        assert close(first[key], second[key]), (label, key, first, second)
    for key in ("paddingLeft", "paddingRight", "radius"):
        assert first[key] == second[key], (label, key, first, second)


def assert_paper(state, label):
    assert alpha(state["background"]) == 1, (label, state)
    assert state["background"] == state["expectedBackground"], (label, state)
    assert state["background"] != state["page"], (label, state)
    assert state["shadow"] == state["expectedShadow"], (label, state)
    assert len(re.findall(r"\binset\b", state["shadow"])) == 1, (label, state)
    assert state["radius"] == "999px", (label, state)


def verify(page, base, route, width, height, mode):
    page.goto(f"{base}/{route}", wait_until="domcontentloaded")
    page.wait_for_selector(".jbNav")
    page.wait_for_function("window.SiteTheme && document.documentElement.classList.contains('theme-ready')")
    if route == "play.html":
        page.wait_for_selector('body[data-play-ready="true"]', timeout=20_000)
    page.evaluate("mode => window.SiteTheme.setMode(mode, {persist:false})", mode)
    page.wait_for_function(
        "mode => document.documentElement.dataset.theme === (mode === 'night' ? 'dark' : 'light')",
        arg=mode,
    )
    page.add_style_tag(content=".jbNav{transition:none!important}")
    page.evaluate("document.documentElement.classList.remove('jbShrunk')")

    resting = read_nav(page)
    assert_paper(resting, (route, width, mode, "resting"))

    page.evaluate("document.documentElement.classList.add('jbShrunk')")
    shrunk = read_nav(page)
    assert_paper(shrunk, (route, width, mode, "shrunk"))
    assert_geometry_same(resting, shrunk, (route, width, mode, "shrink"))

    if route == "index.html":
        page.evaluate("document.documentElement.classList.remove('jbShrunk'); document.body.classList.add('heroEmpathy')")
        empathy = read_nav(page)
        assert_paper(empathy, (route, width, mode, "empathy"))
        assert_geometry_same(resting, empathy, (route, width, mode, "empathy"))
        page.evaluate("document.body.classList.remove('heroEmpathy')")

        if mode == "off":
            page.evaluate("document.querySelector('.jbNav').setAttribute('data-surface','ink')")
            ink = read_nav(page)
            assert alpha(ink["background"]) == 1, (route, width, ink)
            assert ink["background"] != resting["background"], (route, width, ink, resting)
            assert ink["radius"] == "999px", (route, width, ink)
            assert len(re.findall(r"\binset\b", ink["shadow"])) == 1, (route, width, ink)
            assert_geometry_same(resting, ink, (route, width, mode, "ink"))

    assert page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth") <= 1


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            for width, height in VIEWPORTS:
                for mode in STATES:
                    for route in ROUTES:
                        context = browser.new_context(
                            viewport={"width": width, "height": height}, reduced_motion="reduce"
                        )
                        page = context.new_page()
                        verify(page, base, route, width, height, mode)
                        context.close()
                        print(f"PASS {route} {width}x{height} {mode}")
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print("Shared header material browser contract: OK")


if __name__ == "__main__":
    main()
