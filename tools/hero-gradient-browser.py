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
                page.wait_for_function("typeof introMode !== 'undefined'")
                page.evaluate("document.getElementById('heroTimeBtn').click()")
                page.wait_for_function("document.getElementById('heroTime').classList.contains('open')")
                page.wait_for_function(
                    """() => Array.from(document.querySelectorAll('.heroTimeMenu .heroTimeOptionIcon'))
                      .every(icon => icon.getBBox().width > 0 && icon.getBBox().height > 0)"""
                )
                page.evaluate("document.getElementById('heroTimeBtn').click()")
                for state in STATES:
                    page.evaluate("state => window.SiteTheme.setMode(state, {persist:false})", state)
                    page.wait_for_function(
                        "state => document.querySelector('.hero').dataset.timeState === state",
                        arg=state,
                    )
                    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                    page.screenshot(path=str(SHOTS / f"{label}-{state}.png"), full_page=False)
                page.evaluate("window.SiteTheme.setMode('off', {persist:false})")
                page.wait_for_function("getComputedStyle(document.querySelector('.jbNav')).backgroundColor === 'rgb(255, 255, 255)'")
                before = page.locator(".jbNav").evaluate("node => getComputedStyle(node).backgroundColor")
                page.evaluate("document.querySelector('.jbNav').setAttribute('data-surface','ink')")
                page.wait_for_function("getComputedStyle(document.querySelector('.jbNav')).backgroundColor === 'rgb(18, 18, 18)'")
                material = page.locator(".jbNav").evaluate(
                    "node => ({after:getComputedStyle(node).backgroundColor,radius:getComputedStyle(node).borderRadius})"
                )
                material["before"] = before
                assert material["after"] not in ("transparent", "rgba(0, 0, 0, 0)"), material
                assert material["after"] != material["before"], material
                assert material["radius"] == "999px", material
                page.screenshot(path=str(SHOTS / f"{label}-ink-solid-header.png"), full_page=False)
                assert not errors, errors
                context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print(f"Hero gradients: OK; screenshots: {SHOTS}")


if __name__ == "__main__":
    main()
