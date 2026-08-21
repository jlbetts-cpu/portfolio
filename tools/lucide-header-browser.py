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
# ── "work" BECAME "home".  2026-08-21 ──────────────────────────────────────
# Jayden: "can we make the work tab and turn into the home with a home icon".
# The key here is the data-nav-item attribute, so the rename has to land in this
# dict or every route fails on a missing selector rather than on a wrong glyph.
# The pin is still on the DRAWING, not the mechanism -- lucide-house has to exist
# in ui-icons.svg and the header has to inline that exact shape -- which is the
# property that made this file worth keeping when the sprite fetch was removed.
EXPECTED = {
    "home": "lucide-house",
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
    # FIVE, NOT EIGHT.  2026-08-19: the Contact disclosure is deleted, and with it
    # the panel's three brand rows, the touch destination row's mail glyph and the
    # chevron -- five of the eight this used to count. What is left is exactly the
    # four nav items plus Contact, and a route with a Back arrow adds one more.
    # The number is asserted below per control by SHAPE, which is the assertion
    # that matters; this wait only has to know when header.js has finished.
    page.wait_for_function("document.querySelectorAll('.jbNav svg.uiIcon').length >= 4")

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

    # ── CONTACT IS A BUTTON THAT GOES TO HIS INBOX.  2026-08-19 ─────────────
    # What stood here asserted the disclosure: three brand rows inside
    # .jbDiscMenu, a chevron on .jbDiscGo, and (further down) focus-opens /
    # Escape-closes. Jayden's call is that Contact stops being a nav item that
    # reveals three links on hover and becomes a noticeable, non-primary button
    # straight to his email; the three links are unchanged in the footer, on
    # every page, in the same order.
    # THE OLD ASSERTIONS ARE REPLACED RATHER THAN DELETED, because "the panel is
    # gone" is only half a contract -- the half that matters is that nothing was
    # left behind. aria-expanded on a link with nothing to expand is a lie a
    # screen reader reads out loud, and a chevron is a promise the control cannot
    # keep, so both are asserted ABSENT here and the file, the handler and the
    # markup all have to agree for that to hold.
    contact = page.locator('.jbNav [data-nav-item="contact"]')
    assert contact.count() == 1, (route, contact.count())
    assert contact.get_attribute("aria-label") == "Contact"
    href = contact.get_attribute("href") or ""
    assert href.startswith("mailto:"), (route, href)
    for dead in ("aria-haspopup", "aria-expanded", "aria-controls"):
        assert contact.get_attribute(dead) is None, (route, dead)
    assert page.locator(".jbNav .jbDisc, .jbNav .jbDiscMenu, .jbNav .jbDiscChevron").count() == 0, route
    assert page.locator("#jbContactMenu").count() == 0, route
    # it is the library's secondary kind, not a button rebuilt in the bar
    assert "ctl--secondary" in (contact.get_attribute("class") or ""), route

    metrics = page.evaluate(
        """
        () => {
          const nav = document.querySelector('.jbNav');
          const ico = document.querySelector('.jbNav [data-nav-item="home"] .uiIcon');
          const logo = document.querySelector('.jbNav .jbLogo');
          const rect = nav.getBoundingClientRect();
          const ir = ico.getBoundingClientRect();
          let painted = {width: 0, height: 0};
          try { painted = ico.getBBox(); } catch (e) {}   // getBBox throws on display:none
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
            iconFocusable: ico.getAttribute('focusable'),
            iconDisplay: getComputedStyle(ico).display,
            litIconDisplay: (() => {
              const lit = nav.querySelector('[aria-current]:not(.jbHome) .uiIcon');
              return lit ? getComputedStyle(lit).display : null;
            })(),
            unlitIconDisplay: (() => {
              const un = nav.querySelector(
                '[data-nav-item]:not([aria-current]) .uiIcon');
              return un ? getComputedStyle(un).display : null;
            })(),
            /* THE BOX IS MEASURED ON AN UNLIT ITEM, not on Work. Work carries
               aria-current on index.html (the item is Home as of 2026-08-21),
               and under the round-14 rule the lit item was the one that dropped
               its glyph -- so the old fixed `ico` probe measured the one icon
               the design deliberately hid and read 0x0. Round 15 gave that
               glyph back; the unlit probe is kept because it is the one that
               works whichever way that rule goes. */
            unlitIcon: (() => {
              const un = nav.querySelector(
                '[data-nav-item]:not([aria-current]) .uiIcon');
              if (!un) return null;
              const r = un.getBoundingClientRect();
              let p = {width: 0, height: 0};
              try { p = un.getBBox(); } catch (e) {}
              return {w: r.width, h: r.height, pw: p.width, ph: p.height};
            })()
          };
        }
        """
    )
    assert metrics["overflow"] <= 0, (route, label, metrics)
    assert metrics["navHeight"] == 52, (route, label, metrics)
    # ── WHERE THE GLYPHS ARE, AND WHERE THEY ARE NOT.  2026-08-19 ───────────
    # This used to assert an 18px box on the desktop bar and a 16px one below
    # 640. The 18px half is gone by design: above 640 the nav is type alone,
    # because five glyphs beside five words repeat what the words already say and
    # give the eye ten objects to sort instead of five. Below 640 the labels do
    # not fit (header.css §6) and the glyph IS the item, so the 16px box is still
    # the contract. (The clause that used to follow -- "and the LIT item drops
    # its glyph there instead of carrying both" -- described round 14 and was
    # reversed by round 15; see the assertion below.)
    # Written as an either/or rather than deleted: a build that puts the icons
    # back on desktop, or takes them off mobile, fails here in both directions.
    if width <= 640:
        un = metrics["unlitIcon"]
        assert un, (route, label, metrics)
        assert un["w"] == 16 and un["h"] == 16, (route, label, metrics)
        assert un["pw"] > 0 and un["ph"] > 0, (route, label, metrics)
        assert metrics["unlitIconDisplay"] not in (None, "none"), (route, label, metrics)
        # ── THIS ASSERTION WAS PINNING A DECISION THAT HAD ALREADY BEEN
        # REVERSED, and it was failing on main before 2026-08-21 touched it.
        # It demanded the LIT item hide its glyph, which was correct while the
        # mobile rule handed the current page its WORD back instead. Round 15
        # (header.css §6, 2026-08-20) took that word away -- Jayden: "the rest
        # should be just text instead of the icons or just icons" -- so the row
        # is now uniformly glyphs, and hiding the lit one would leave the
        # current page as the only item with nothing in it at all. header.css
        # says exactly that in the note above `.jbNav .jbContactBtn`.
        # It is INVERTED rather than deleted, so it still fails in both
        # directions: a build that hides the lit glyph again, or one that lets
        # the lit item drop out of the row, is caught here.
        # A case study lights NOTHING as of 2026-08-21: the first item is Home,
        # and a case study is not the home page, so aria-current came off it.
        # `None` here means "no lit item on this route", which is a legal state
        # and not the state this guards against.
        if metrics["litIconDisplay"] is not None:
            assert metrics["litIconDisplay"] != "none", (route, label, metrics)
    else:
        assert metrics["iconDisplay"] == "none", (route, label, metrics)
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

    # FOCUSING CONTACT OPENS NOTHING, which is the replacement for the
    # focus-opens/Escape-closes pair this used to drive. It is a real assertion
    # and not a formality: header.js's whole .jbDisc block was deleted with the
    # markup, and a listener left bound to markup that no longer ships is the
    # defect rather than the leftover -- this is what would catch it coming back.
    contact.focus()
    page.wait_for_timeout(240)          # longer than the panel's old open delay
    assert page.evaluate("document.querySelectorAll('.jbNav .open').length") == 0, route
    assert contact.get_attribute("aria-expanded") is None, route

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
            # ui-icons.svg stays the source of truth for the shapes the header
            # DRAWS. The chevron and the two brand marks left that list with the
            # Contact panel -- the sprite may still carry them for other
            # consumers, but requiring them here would pin drawings this
            # component no longer has any way to show.
            required = set(EXPECTED.values()) | {"lucide-arrow-left"}
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
            # AT 390, BECAUSE THAT IS WHERE THE GLYPHS ARE DRAWN.  2026-08-19.
            # The nav's icons come off above 640px -- five glyphs beside five
            # words is the repetition the structure pass removed -- so on a
            # desktop viewport getBBox() would be reading elements the design
            # deliberately does not paint, and "renders empty" would be true and
            # meaningless. The question this test exists to answer ("does a
            # header glyph still draw with the sprite blocked") is only askable
            # where a header glyph draws.
            blocked.set_viewport_size({"width": 390, "height": 844})
            blocked.goto(f"{base_url}/about.html", wait_until="load")
            blocked.wait_for_function(
                "document.querySelectorAll('.jbNav svg.uiIcon').length >= 4")
            drawn = blocked.evaluate("""
                () => Array.from(document.querySelectorAll('.jbNav svg.uiIcon'))
                        .filter(s => getComputedStyle(s).display !== 'none')
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
