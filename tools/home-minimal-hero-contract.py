#!/usr/bin/env python3
"""Home's recruiter-facing minimal hero contract.

SUPERSEDED CLAUSES, AND WHY THEY ARE GONE. This file was written when the
minimal Hero had NO portrait: it asserted the stage was hidden/inert, that
hero-engine.js never loaded, and that nothing in the Hero was pointer-driven.
The head-transform generation deliberately reversed all three -- the animated
portrait is back, selectable, movable, resizable and rotatable, and
tools/hero-head-transform-contract.py is the authority on it. Those assertions
were left inverted and this file had been failing on them for several commits.
What survives here is what is still true and still worth blocking on: the
headline, the absence of the old mood bar, no horizontal overflow, 44px
targets, and the Hero owning the opening viewport -- which is now the WHOLE
viewport, because the Hero is full-bleed on all four edges.
"""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SHOTS = Path("/tmp/home-minimal-hero-contract")
VIEWPORTS = ((1280, 900), (1440, 900), (390, 844), (320, 800))
PROFILES = ("empty", "returning")


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


def static_contract():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    # The Hero carries the shared surface classes now (.surface .surface--hero),
    # so it can no longer be found by an exact opening tag.
    start = html.index('<section class="hero surface surface--hero" id="main"')
    end = html.index("</section>", start) + len("</section>")
    hero = html[start:end]

    assert 'id="workBtn"' in hero and 'href="#cases"' in hero
    assert 'id="heroTimeBtn"' in hero and 'id="heroTimeMenu"' in hero
    assert 'id="moodbar"' not in hero
    assert 'id="moodBtn"' not in hero
    assert 'id="moodMenu"' not in hero
    assert 'data-mood=' not in hero
    assert 'class="heroTimeSupport heroCharacterPeek"' in hero
    support = hero[hero.index('class="heroTimeSupport heroCharacterPeek"'):]
    assert 'id="stage"' in support and 'id="face"' in support
    assert 'id="heroTimePortraitCast"' in hero
    assert '<script src="play-engine.js"></script>' not in html
    assert 's.src="play-engine.js"' not in html
    assert '<h1 id="h1">SF product designer. iOS, B2C and design systems.</h1>' in hero


def browser_contract(base_url):
    SHOTS.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        for profile in PROFILES:
          profile_viewports = VIEWPORTS if profile == "returning" else (VIEWPORTS[0], VIEWPORTS[2])
          for viewport_index, (width, height) in enumerate(profile_viewports):
            context = browser.new_context(
                viewport={"width": width, "height": height}, reduced_motion="no-preference"
            )
            context.add_init_script(
                """
                (() => {
                  const profile = '__PROFILE__';
                  localStorage.removeItem('hmCompanion');
                  localStorage.removeItem('hmCompanions');
                  if (profile === 'returning') {
                    const cut = 'data:image/webp;base64,' + 'A'.repeat(16000);
                    localStorage.setItem('hmCompanions', JSON.stringify([{
                      cut, eyes: [{x:.4,y:.5,w:.08,h:.03},{x:.6,y:.5,w:.08,h:.03}]
                    }]));
                  }
                })()
                """.replace("__PROFILE__", profile)
            )
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
            page.goto(base_url + "/index.html", wait_until="load")
            # The portrait engine's intro owns a brief scroll lock, so "never
            # hidden" is only meaningful once the intro has finished. The
            # guarantee that matters -- the page is scrollable when the Hero is
            # ready -- is asserted below on rootOverflow.
            page.wait_for_function(
                "typeof introMode === 'undefined' || !introMode", timeout=15_000
            )
            page.wait_for_timeout(1_400 if viewport_index == 0 else 100)
            page.wait_for_function(
                "document.documentElement.style.overflow !== 'hidden'", timeout=15_000
            )
            overflow_at_load = page.evaluate("document.documentElement.style.overflow")

            state = page.evaluate(
                """
                () => {
                  const hero = document.getElementById('main').getBoundingClientRect();
                  const title = document.getElementById('h1').getBoundingClientRect();
                  const ctas = document.querySelector('.heroCtas').getBoundingClientRect();
                  const cases = document.getElementById('cases').getBoundingClientRect();
                  const visible = id => {
                    const node = document.getElementById(id);
                    return Boolean(node && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
                  };
                  return {
                    headline: document.getElementById('h1').innerText.replace(/\\s+/g, ' ').trim(),
                    moodControls: document.querySelectorAll('#moodbar,#moodBtn,#moodMenu,[data-mood]').length,
                    portraitVisible: visible('face') || visible('heroTimePortraitCast') || visible('stage'),
                    focusableMoodControls: [...document.querySelectorAll('[data-mood],#moodBtn,#moodMenu button')]
                      .filter(node => node.tabIndex >= 0).length,
                    headScripts: document.querySelectorAll('script[src$="hero-engine.js"],script[src$="play-engine.js"]').length,
                    headGlobals: ['introMode','eventLock','CALIB','startMovie','tapReact','__hmLive','__hmSpawnOne']
                      .filter(name => name in window),
                    rootOverflow: document.documentElement.style.overflow,
                    directCompanions: document.querySelectorAll(
                      '.hero > .hmRefl,.hero > .hmShadow,.hero > .hmPlanet,.hero > .hmWater,.hero > .hmSky,' +
                      '.hero > [style*="cursor: grab"],.hero > [style*="cursor:grab"]'
                    ).length,
                    directPointerTargets: [...document.querySelectorAll('.hero > *')].filter(node => {
                      const style = getComputedStyle(node);
                      return style.cursor === 'grab' || style.touchAction === 'none';
                    }).length,
                    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
                    targets: ['workBtn','heroTimeBtn'].map(id => {
                      const box = document.getElementById(id).getBoundingClientRect();
                      return {id, width: box.width, height: box.height};
                    }),
                    hero: {top: hero.top, bottom: hero.bottom, height: hero.height},
                    title: {top: title.top, bottom: title.bottom},
                    ctas: {top: ctas.top, bottom: ctas.bottom},
                    casesTop: cases.top,
                  };
                }
                """
            )
            assert state["headline"] == "SF product designer. iOS, B2C and design systems.", state
            assert state["moodControls"] == 0, state
            assert state["focusableMoodControls"] == 0, state
            assert state["headScripts"] == 1, state
            assert overflow_at_load != "hidden", (profile, overflow_at_load)
            assert state["rootOverflow"] != "hidden", state
            assert state["directCompanions"] == 0, state
            assert not state["horizontalOverflow"], state
            assert all(target["width"] >= 44 and target["height"] >= 44 for target in state["targets"]), state
            # The approved Hero owns the opening viewport. Moving the portrait to Play must
            # not collapse Home into a short banner at any responsive width.
            # Full-bleed: the Hero is the viewport, top and bottom flush.
            assert abs(state["hero"]["height"] - height) <= .5, state
            assert abs(state["hero"]["top"]) <= .5, state
            assert state["title"]["top"] >= state["hero"]["top"], state
            assert state["title"]["top"] <= state["hero"]["top"] + state["hero"]["height"] * 0.38, state
            assert state["ctas"]["bottom"] <= state["hero"]["bottom"], state
            assert state["casesTop"] - state["hero"]["bottom"] <= 160, state
            initial_geometry = state["hero"]

            page.evaluate("window.SiteTheme.setMode('off', {persist:false})")
            page.wait_for_function("document.getElementById('main').dataset.timeState === 'off'")
            page.wait_for_timeout(700)
            off_geometry = page.locator("#main").bounding_box()
            off_surfaces = page.evaluate(
                """['.jbNav','#heroTimeBtn'].map(selector => getComputedStyle(document.querySelector(selector)).backgroundColor)"""
            )
            assert all(not color.startswith("rgba(") or not color.endswith(", 0)") for color in off_surfaces), off_surfaces
            assert not page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
            visible_portraits = page.evaluate(
                """[...document.querySelectorAll('#face,#heroTimePortraitCast,#stage,.hmRefl,.hmShadow')]
                  .filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden').length"""
            )
            assert visible_portraits >= 1
            page.screenshot(path=str(SHOTS / f"{profile}-{width}x{height}-off.png"), full_page=False)

            page.evaluate("window.SiteTheme.setMode('night', {persist:false})")
            page.wait_for_function("document.getElementById('main').dataset.timeState === 'night'")
            page.wait_for_timeout(700)
            night_geometry = page.locator("#main").bounding_box()
            night_surfaces = page.evaluate(
                """['.jbNav','#heroTimeBtn'].map(selector => getComputedStyle(document.querySelector(selector)).backgroundColor)"""
            )
            assert all(not color.startswith("rgba(") or not color.endswith(", 0)") for color in night_surfaces), night_surfaces
            assert not page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
            for geometry in (off_geometry, night_geometry):
                assert abs(geometry["height"] - initial_geometry["height"]) <= 0.5, (initial_geometry, geometry)
                assert abs(geometry["y"] - initial_geometry["top"]) <= 0.5, (initial_geometry, geometry)
            visible_portraits = page.evaluate(
                """[...document.querySelectorAll('#face,#heroTimePortraitCast,#stage,.hmRefl,.hmShadow')]
                  .filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden').length"""
            )
            assert visible_portraits >= 1
            page.screenshot(path=str(SHOTS / f"{profile}-{width}x{height}-night.png"), full_page=False)

            if profile == "returning" and width in (1280, 390):
                page.evaluate("window.scrollTo(0, 0); history.replaceState(null, '', location.pathname)")
                page.locator("#workBtn").click()
                scroll_samples = []
                for _ in range(6):
                    page.wait_for_timeout(50)
                    scroll_samples.append(page.evaluate("scrollY"))
                page.wait_for_timeout(700)
                final_scroll = page.evaluate("scrollY")
                assert any(0 < sample < final_scroll for sample in scroll_samples), (
                    profile, width, scroll_samples, final_scroll
                )
            assert not errors, errors
            context.close()
        browser.close()


def main():
    static_contract()
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        browser_contract(f"http://127.0.0.1:{server.server_port}")
    finally:
        server.shutdown()
        server.server_close()
    print(f"Home minimal hero: OK; screenshots: {SHOTS}")


if __name__ == "__main__":
    main()
