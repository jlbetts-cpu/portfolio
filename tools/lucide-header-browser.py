#!/usr/bin/env python3
"""Browser contract for the local Lucide treatment in shared site chrome."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import re
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


SPRITE_SHAPES = {}


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


class QuietServer(ThreadingHTTPServer):
    def handle_error(self, _request, _client_address):
        pass


def normalise(markup):
    """Shape markup canonicalised so the header's drawing can be compared with the
    sprite's without depending on either side's serialisation.

    The sprite is authored self-closing (`<path d="..."/>`); the DOM serialises
    the same node as `<path d="..."></path>`. Both collapse to the same string
    here, which is the only reason this comparison is meaningful rather than a
    test of how Chrome writes SVG back out."""
    text = re.sub(r"\s+", " ", (markup or "")).replace('"', "'").strip()
    text = re.sub(r"\s*/>", ">", text)                  # self-closing -> open
    text = re.sub(r"</(path|rect|circle|line|polyline|polygon|ellipse)>", "", text)
    return re.sub(r"\s+>", ">", text).strip()


def icon_shapes(page, selector):
    """What the header ACTUALLY DRAWS for this control.

    This used to read the <use href="ui-icons.svg#..."> attribute -- it pinned the
    MECHANISM, and the mechanism was the bug. An external <use> renders nothing
    until its document resolves, so on a cold cache the header showed the stale
    inline Tabler drawing, then a hole, then the Lucide one. Measured at rAF
    resolution with the sprite delayed 900ms: Tabler at t+107ms, blank at
    t+205ms, drawn at t+1039ms. The glyphs are inline in header.js now, so there
    is no href to read and no fetch to lose -- and what has to stay true is not
    "it points at the sprite" but "it draws the right Lucide shape". That is
    what this returns, and SPRITE_SHAPES is what it is checked against, so
    ui-icons.svg remains the single source of truth for the drawings even though
    the header no longer fetches it."""
    return normalise(page.locator(selector).first.locator("svg.uiIcon").first.inner_html())


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
    page.wait_for_function("document.querySelectorAll('.jbNav svg.uiIcon').length >= 8")

    if page.evaluate("Boolean(window.SiteTheme)"):
        page.evaluate("mode => window.SiteTheme.setMode(mode, {persist:false})", theme)
        page.wait_for_function(
            "mode => document.documentElement.dataset.themeState === mode", arg=theme
        )

    for item, symbol in EXPECTED.items():
        drawn = icon_shapes(page, f'.jbNav [data-nav-item="{item}"]')
        assert drawn == SPRITE_SHAPES[symbol], (route, item, symbol, drawn)

    back = page.locator(".jbNav .jbBack")
    if back.count():
        assert icon_shapes(page, ".jbNav .jbBack") == SPRITE_SHAPES["lucide-arrow-left"]

    menu = page.locator(".jbContact .jbDiscMenu")
    assert icon_shapes(page, '.jbContact .jbDiscMenu a[href*="linkedin"]') == SPRITE_SHAPES["brand-linkedin"]
    assert icon_shapes(page, '.jbContact .jbDiscMenu a[href*="instagram"]') == SPRITE_SHAPES["brand-instagram"]
    assert icon_shapes(page, '.jbContact .jbDiscMenu a[href^="mailto:"]') == SPRITE_SHAPES["lucide-mail"]

    contact = page.locator(".jbContact > .jbDiscGo")
    chevrons = contact.locator("svg.jbDiscChevron")
    assert chevrons.count() == 1, (route, chevrons.count())
    assert normalise(chevrons.inner_html()) == SPRITE_SHAPES["lucide-chevron-down"]
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
            inlineUtilityPaths: document.querySelectorAll(
              '.jbNav svg.uiIcon :is(path,rect,circle,line)').length,
            useElements: document.querySelectorAll('.jbNav svg.uiIcon use').length,
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
    # THIS ASSERTION IS INVERTED, and the inversion is the fix.
    # It used to be `inlineUtilityPaths == 0` -- the header was required to carry
    # NO inline shapes, because every glyph had to come through the sprite. That
    # requirement is what produced "sometimes the icons don't load in properly":
    # a <use> at an external document paints nothing until the fetch lands, and
    # the fetch is a separate request that can be slow, cold or absent. The
    # shapes are inline now, so the header cannot have a blank state at all.
    assert metrics["inlineUtilityPaths"] > 0, (route, metrics)
    assert metrics["useElements"] == 0, (
        route, metrics,
        "a header glyph is back on an external <use>; that reintroduces the "
        "blank window between the swap and the sprite arriving")
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
                body = re.search(rf'<symbol id="{re.escape(symbol)}"[^>]*>(.*?)</symbol>',
                                 sprite, re.S)
                assert body, symbol
                SPRITE_SHAPES[symbol] = normalise(body.group(1))

            # ── THE REGRESSION THIS FILE NOW EXISTS TO CATCH ────────────────
            # Jayden: "sometimes the icons don't load in properly in the header."
            # The header must not need ui-icons.svg AT ALL. Blocking the sprite
            # outright is the only honest test of that: with the request failing,
            # every header glyph must still render with non-zero geometry. Under
            # the old <use> implementation this page would show eight empty
            # boxes, which is exactly what a cold or flaky cache produced.
            blocked = browser.new_page()
            sprite_requests = []
            blocked.route("**/ui-icons.svg",
                          lambda route: (sprite_requests.append(route.request.url),
                                         route.abort()))
            blocked.goto(f"{base_url}/about.html", wait_until="load")
            blocked.wait_for_function(
                "document.querySelectorAll('.jbNav svg.uiIcon').length >= 8")
            drawn = blocked.evaluate("""
                () => Array.from(document.querySelectorAll('.jbNav svg.uiIcon'))
                        .map(s => { try { const b = s.getBBox();
                                          return Math.round(b.width * b.height); }
                                    catch (e) { return 0; } })""")
            assert drawn and all(area > 0 for area in drawn), (
                "with ui-icons.svg blocked, header glyphs rendered empty: " + repr(drawn) +
                " -- the header has taken a network dependency on the sprite again")
            assert not sprite_requests, (
                "about.html requested ui-icons.svg: " + repr(sprite_requests) +
                " -- the header's glyphs are inline and must cost no request")
            blocked.close()
            print(f"PASS sprite-blocked cold-cache render ({len(drawn)} glyphs drawn)")

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
