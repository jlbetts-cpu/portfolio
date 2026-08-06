#!/usr/bin/env python3
"""Capture and sanity-check every Hero time state at desktop and mobile."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SHOTS = Path("/tmp/hero-gradient-browser")
STATES = ("off", "pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night")
VIEWPORTS = (("desktop-1280", 1280, 900), ("mobile-390", 390, 844), ("mobile-320", 320, 800))


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


def main():
    SHOTS.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            for label, width, height in VIEWPORTS:
                context = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce")
                page = context.new_page()
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(f"http://127.0.0.1:{server.server_port}/index.html", wait_until="domcontentloaded")
                page.wait_for_function("window.SiteTheme && document.documentElement.classList.contains('theme-ready')")
                for state in STATES:
                    page.evaluate("state => window.SiteTheme.setMode(state, {persist:false})", state)
                    page.wait_for_function(
                        "state => document.querySelector('.hero').dataset.timeState === state",
                        arg=state,
                    )
                    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                    page.screenshot(path=str(SHOTS / f"{label}-{state}.png"), full_page=False)
                assert not errors, errors
                context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print(f"Hero gradients: OK; screenshots: {SHOTS}")


if __name__ == "__main__":
    main()
