#!/usr/bin/env python3
"""Real-browser proof for dark-mode chrome blending at desktop and mobile."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SHOTS = Path("/tmp/chrome-blend-browser")
VIEWPORTS = (("desktop-1280", 1280, 900), ("mobile-390", 390, 844), ("mobile-320", 320, 800))


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


def rgba_tuple(value):
    channels = re.findall(r"[\d.]+", value)
    return tuple(int(float(part)) for part in channels[:3])


def run_viewport(browser, base_url, label, width, height):
    context = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce")
    page = context.new_page()
    errors = []
    failed = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.on("requestfailed", lambda request: failed.append(request.url))
    page.goto(base_url + "/index.html", wait_until="domcontentloaded")
    page.wait_for_function("window.SiteTheme && document.documentElement.classList.contains('theme-ready')")
    page.evaluate("window.SiteTheme.setMode('night', {persist:false})")
    page.wait_for_function("document.documentElement.dataset.theme === 'dark'")

    top = page.evaluate(
        """
        () => {
          const nav = document.querySelector('.jbNav');
          const hero = document.querySelector('.hero');
          const mood = document.querySelector('.heroMood .moodBtn');
          const time = document.querySelector('.heroTimeBtn');
          const cta = document.querySelector('.workCta');
          const style = node => getComputedStyle(node);
          return {
            nav: style(nav).backgroundColor,
            hero: style(hero).backgroundColor,
            mood: style(mood).backgroundColor,
            time: style(time).backgroundColor,
            cta: style(cta).backgroundColor,
            overflow: document.documentElement.scrollWidth - innerWidth,
            shrunk: document.documentElement.classList.contains('jbShrunk')
          };
        }
        """
    )
    assert top["nav"] == "rgba(0, 0, 0, 0)", top
    assert rgba_tuple(top["mood"]) == rgba_tuple(top["hero"]), top
    assert rgba_tuple(top["time"]) == rgba_tuple(top["hero"]), top
    assert rgba_tuple(top["cta"]) != rgba_tuple(top["hero"]), top
    assert top["overflow"] <= 0, top
    assert not top["shrunk"], top
    page.screenshot(path=str(SHOTS / f"{label}-top.png"), full_page=False)

    page.evaluate("window.scrollTo(0, document.querySelector('#cases').offsetTop)")
    page.wait_for_function(
        "scrollY > 100 && document.documentElement.classList.contains('jbShrunk')"
    )
    page.wait_for_function(
        "getComputedStyle(document.querySelector('.jbNav')).backgroundColor === 'rgb(11, 12, 15)'"
    )
    scrolled = page.evaluate(
        """
        () => {
          const nav = getComputedStyle(document.querySelector('.jbNav'));
          const root = getComputedStyle(document.documentElement);
          return {nav: nav.backgroundColor, page: root.getPropertyValue('--theme-page').trim()};
        }
        """
    )
    assert rgba_tuple(scrolled["nav"]) == (11, 12, 15), scrolled
    assert scrolled["page"].lower() == "#0b0c0f", scrolled
    page.screenshot(path=str(SHOTS / f"{label}-scrolled.png"), full_page=False)

    assert not errors, errors
    assert not failed, failed
    context.close()
    return top, scrolled


def main():
    SHOTS.mkdir(parents=True, exist_ok=True)
    handler = partial(QuietHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            for viewport in VIEWPORTS:
                top, scrolled = run_viewport(browser, f"http://127.0.0.1:{server.server_port}", *viewport)
                print(f"{viewport[0]}: top={top['hero']}; controls blend; scrolled={scrolled['nav']}")
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print(f"screenshots: {SHOTS}")


if __name__ == "__main__":
    main()
