#!/usr/bin/env python3
"""Real-browser dark/light checks for Gradient Maker and Add your head."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = Path(os.environ.get("BUILDER_THEME_ARTIFACTS", "/tmp/builder-theme"))
PAGES = {
    "gradientlab": {
        "path": "gradientlab.html",
        "panel": ".panel",
        "field": "select",
        "primary": ".ctl--primary",
        "utility": ".ctl--secondary",
        "ink": ".labHead h1",
        "muted": ".labHead span",
    },
    "headmaker": {
        "path": "headmaker.html",
        "panel": ".mkPanel",
        "field": ".mkField",
        "primary": ".ctl--primary",
        "utility": ".ctl:not(.ctl--primary)",
        "ink": ".mkSteps li[aria-current]",
        "muted": ".mkHint",
    },
}


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


def rgb(page, selector, property_name):
    return page.eval_on_selector(selector, f"el => getComputedStyle(el).{property_name}")


def assert_no_overflow(page, label):
    metrics = page.evaluate(
        """() => ({inner: innerWidth, scroll: document.documentElement.scrollWidth})"""
    )
    assert metrics["scroll"] <= metrics["inner"] + 1, (label, metrics)


def contrast(page, foreground, background):
    return page.evaluate(
        """([fgSelector, bgSelector]) => {
          const channels = value => (value.match(/[\d.]+/g) || [0,0,0]).slice(0,3).map(Number);
          const luminance = value => {
            const linear = channels(value).map(channel => {
              channel /= 255;
              return channel <= .04045 ? channel / 12.92 : Math.pow((channel + .055) / 1.055, 2.4);
            });
            return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
          };
          const fg = luminance(getComputedStyle(document.querySelector(fgSelector)).color);
          const bg = luminance(getComputedStyle(document.querySelector(bgSelector)).backgroundColor);
          return (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);
        }""",
        [foreground, background],
    )


def run_case(browser, base_url, name, config, mode, width, height):
    context = browser.new_context(viewport={"width": width, "height": height})
    context.add_init_script(
        f'try {{ sessionStorage.setItem("jbHeroTimeMode", "{mode}"); }} catch (_) {{}}'
    )
    page = context.new_page()
    errors = []
    page.on("console", lambda msg: errors.append(f"console: {msg.text}") if msg.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(f"pageerror: {error}"))
    page.goto(f"{base_url}/{config['path']}", wait_until="load")
    page.wait_for_timeout(80)

    expected_theme = "dark" if mode == "night" else "light"
    assert page.locator(f'html[data-theme="{expected_theme}"]').count() == 1
    assert page.locator(f'body[data-theme-page="{name}"]').count() == 1
    assert not errors, (name, mode, width, errors)
    assert_no_overflow(page, f"{name}-{mode}-{width}")

    if mode == "night":
        assert rgb(page, "body", "backgroundColor") == "rgb(11, 12, 15)"
        assert rgb(page, config["panel"], "backgroundColor") == "rgb(17, 19, 24)"
        assert rgb(page, config["field"], "backgroundColor") == "rgb(23, 26, 33)"
        assert rgb(page, config["utility"], "backgroundColor") == "rgba(0, 0, 0, 0)"
        assert rgb(page, config["primary"], "backgroundColor") == "rgb(217, 215, 255)"
        assert contrast(page, config["ink"], config["panel"]) >= 7
        assert contrast(page, config["muted"], config["panel"]) >= 4.5
    else:
        assert rgb(page, "body", "backgroundColor") == "rgb(253, 253, 253)"
        assert rgb(page, config["panel"], "backgroundColor") == "rgb(255, 255, 255)"

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(ARTIFACTS / f"{name}-{mode}-{width}x{height}.png"), full_page=False)
    context.close()


def main():
    supplied_url = os.environ.get("BUILDER_THEME_BASE_URL")
    server = None
    if supplied_url:
        base_url = supplied_url.rstrip("/")
    else:
        handler = partial(QuietHandler, directory=str(ROOT))
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        Thread(target=server.serve_forever, daemon=True).start()
        base_url = f"http://127.0.0.1:{server.server_port}"
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            for name, config in PAGES.items():
                for mode, width, height in (
                    ("off", 1280, 820),
                    ("night", 1280, 820),
                    ("night", 390, 844),
                    ("night", 320, 720),
                ):
                    run_case(browser, base_url, name, config, mode, width, height)
            browser.close()
    finally:
        if server:
            server.shutdown()
            server.server_close()
    print(f"builder theme browser: OK ({ARTIFACTS})")


if __name__ == "__main__":
    main()
