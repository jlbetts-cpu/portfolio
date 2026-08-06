#!/usr/bin/env python3
"""Browser contract for the local Lucide treatment in shared site chrome."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ROUTES = ("index.html", "about.html", "play.html", "bearings.html")
VIEWPORTS = (
    ("desktop", 1280, 900, False),
    ("mobile-390", 390, 844, True),
    ("mobile-320", 320, 800, True),
)
THEMES = ("off", "night")
EXPECTED = {
    "work": "lucide-briefcase-business",
    "about": "lucide-user-round",
    "games": "lucide-gamepad-2",
    "contact": "lucide-mail",
}


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


class QuietServer(ThreadingHTTPServer):
    def handle_error(self, _request, _client_address):
        pass


def icon_href(page, selector):
    return page.locator(selector).first.locator("svg.uiIcon use").first.get_attribute("href")


def verify_page(browser, base_url, route, viewport, theme):
    label, width, height, touch = viewport
    context = browser.new_context(
        viewport={"width": width, "height": height},
        has_touch=touch,
        is_mobile=touch,
        reduced_motion="reduce",
    )
    page = context.new_page()
    errors = []
    failed = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.on("requestfailed", lambda request: failed.append(request.url))
    page.goto(f"{base_url}/{route}", wait_until="domcontentloaded")
    page.wait_for_selector(".jbNav")
    page.wait_for_function("document.querySelectorAll('.jbNav svg.uiIcon use').length >= 8")

    if page.evaluate("Boolean(window.SiteTheme)"):
        page.evaluate("mode => window.SiteTheme.setMode(mode, {persist:false})", theme)
        page.wait_for_function(
            "mode => document.documentElement.dataset.themeState === mode", arg=theme
        )

    for item, symbol in EXPECTED.items():
        href = icon_href(page, f'.jbNav [data-nav-item="{item}"]')
        assert href == f"ui-icons.svg#{symbol}", (route, item, href)

    back = page.locator(".jbNav .jbBack")
    if back.count():
        assert icon_href(page, ".jbNav .jbBack") == "ui-icons.svg#lucide-arrow-left"

    menu = page.locator(".jbContact .jbDiscMenu")
    assert icon_href(page, '.jbContact .jbDiscMenu a[href*="linkedin"]') == "ui-icons.svg#brand-linkedin"
    assert icon_href(page, '.jbContact .jbDiscMenu a[href*="instagram"]') == "ui-icons.svg#brand-instagram"
    assert icon_href(page, '.jbContact .jbDiscMenu a[href^="mailto:"]') == "ui-icons.svg#lucide-mail"

    contact = page.locator(".jbContact > .jbDiscGo")
    chevrons = contact.locator("svg.jbDiscChevron")
    assert chevrons.count() == 1, (route, chevrons.count())
    assert chevrons.locator("use").get_attribute("href") == "ui-icons.svg#lucide-chevron-down"
    assert chevrons.get_attribute("aria-hidden") == "true"
    assert chevrons.get_attribute("focusable") == "false"
    assert contact.get_attribute("aria-label") == "Contact"

    metrics = page.evaluate(
        """
        () => {
          const nav = document.querySelector('.jbNav');
          const ico = document.querySelector('.jbNav [data-nav-item="work"] .uiIcon');
          const logo = document.querySelector('.jbNav .jbLogo');
          const rect = nav.getBoundingClientRect();
          const ir = ico.getBoundingClientRect();
          const painted = ico.getBBox();
          return {
            overflow: document.documentElement.scrollWidth - innerWidth,
            navHeight: rect.height,
            iconWidth: ir.width,
            iconHeight: ir.height,
            paintedWidth: painted.width,
            paintedHeight: painted.height,
            logoPathCount: logo ? logo.querySelectorAll('path').length : 0,
            inlineUtilityPaths: document.querySelectorAll('.jbNav svg.uiIcon path').length,
            iconHidden: ico.getAttribute('aria-hidden'),
            iconFocusable: ico.getAttribute('focusable')
          };
        }
        """
    )
    assert metrics["overflow"] <= 0, (route, label, metrics)
    assert metrics["navHeight"] == 52, (route, label, metrics)
    expected_size = 16 if width <= 640 else 18
    assert metrics["iconWidth"] == expected_size, (route, label, metrics)
    assert metrics["iconHeight"] == expected_size, (route, label, metrics)
    assert metrics["paintedWidth"] > 0 and metrics["paintedHeight"] > 0, (route, label, metrics)
    assert metrics["inlineUtilityPaths"] == 0, (route, metrics)
    assert metrics["iconHidden"] == "true", (route, metrics)
    assert metrics["iconFocusable"] == "false", (route, metrics)
    if page.locator(".jbLogo").count():
        assert metrics["logoPathCount"] == 1, (route, metrics)

    # The existing disclosure behavior remains the contract: focus opens it,
    # Escape closes it and returns focus without changing the accessible name.
    contact.focus()
    page.wait_for_function("document.querySelector('.jbContact').classList.contains('open')")
    assert contact.get_attribute("aria-expanded") == "true"
    assert menu.evaluate("node => getComputedStyle(node).visibility") == "visible"
    contact.press("Escape")
    page.wait_for_function("!document.querySelector('.jbContact').classList.contains('open')")
    assert contact.get_attribute("aria-expanded") == "false"

    assert not errors, (route, label, theme, errors)
    assert not failed, (route, label, theme, failed)
    context.close()


def main():
    handler = partial(QuietHandler, directory=str(ROOT))
    server = QuietServer(("127.0.0.1", 0), handler)
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            base_url = f"http://127.0.0.1:{server.server_port}"
            response = browser.new_page().request.get(f"{base_url}/ui-icons.svg")
            assert response.ok, response.status
            sprite = response.text()
            required = set(EXPECTED.values()) | {
                "lucide-arrow-left", "lucide-chevron-down", "brand-linkedin", "brand-instagram"
            }
            for symbol in required:
                assert sprite.count(f'id="{symbol}"') == 1, symbol
            for route in ROUTES:
                for viewport in VIEWPORTS:
                    for theme in THEMES:
                        verify_page(browser, base_url, route, viewport, theme)
                        print(f"PASS {route} {viewport[0]} {theme}")
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
