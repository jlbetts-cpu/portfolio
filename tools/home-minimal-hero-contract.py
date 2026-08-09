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

import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SHOTS = Path("/tmp/home-minimal-hero-contract")
VIEWPORTS = ((1280, 900), (1440, 900), (390, 844), (320, 800))
PROFILES = ("empty", "returning")
TAP_TARGETS = ("workBtn", "heroTimeBtn")


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


def wait_for_tap_targets_at_rest(page):
    """A tap target measured mid-entrance is not the tap target.

    THE RULER WAS MOVING, NOT THE BUTTONS. getBoundingClientRect() reports the
    TRANSFORMED box, and the Hero's CTAs arrive on @keyframes ctaIn, whose 0%
    frame is translateY(12px) scale(.9). The second and third children carry
    animation-delays of .125s and .25s with fill mode `both`, so a control sits
    PINNED on that first frame -- not easing through it, parked on it -- for up
    to a quarter of a second. That is the whole of the 39.6 x 39.6 this line
    used to fail on: 44 * 0.9, measured off a control that had not started
    moving yet. Sampled once every 400ms across the entrance, the reading at
    t+1600ms was heroTimeBtn 39.5999 with its own transform reading
    matrix(0.9, 0, 0, 0.9, 0, 12) and offsetWidth/offsetHeight still 44 -- the
    layout box never changed at any point. (It is not .ctl:active either:
    --press-scale is .97, which would read 42.7.)

    So the wait is on the thing the measurement actually needs, which is that
    nothing between the control and the page is SCALING it. Translation is
    allowed through deliberately -- .heroCopy carries a permanent
    translateY(-117px) that will never settle to identity, and a translation
    cannot change a width or a height anyway, which is all this file asserts.
    On the mobile widths, where the entrance is switched off, the condition is
    already true on the first poll and nothing is waited for.
    """
    page.wait_for_function(
        """ids => ids.every(id => {
             let node = document.getElementById(id);
             if (!node) return false;
             for (; node && node !== document.body; node = node.parentElement) {
               const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
               if (matrix.a !== 1 || matrix.b !== 0 || matrix.c !== 0 || matrix.d !== 1) return false;
             }
             return true;
           })""",
        arg=list(TAP_TARGETS), timeout=15_000
    )


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
            wait_for_tap_targets_at_rest(page)

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
                    // layoutWidth/layoutHeight ride along so a future failure says
                    // WHICH of the two it is: a control that really is too small,
                    // or a control caught inside a transform again.
                    targets: __TAP_TARGETS__.map(id => {
                      const node = document.getElementById(id);
                      const box = node.getBoundingClientRect();
                      return {id, width: box.width, height: box.height,
                              layoutWidth: node.offsetWidth, layoutHeight: node.offsetHeight,
                              transform: getComputedStyle(node).transform};
                    }),
                    hero: {top: hero.top, bottom: hero.bottom, height: hero.height},
                    title: {top: title.top, bottom: title.bottom},
                    ctas: {top: ctas.top, bottom: ctas.bottom},
                    casesTop: cases.top,
                  };
                }
                """.replace("__TAP_TARGETS__", json.dumps(list(TAP_TARGETS)))
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
                page.wait_for_timeout(200)
                # SAMPLED IN THE PAGE, ON ITS OWN FRAMES. This used to poll
                # scrollY over CDP with page.evaluate() every 50ms, and that
                # does not measure what it means to measure: one round-trip
                # costs more than the interval it is trying to sample at, so
                # the first reading routinely lands after an 840px scroll has
                # already finished and a perfectly smooth scroll reads as an
                # instant jump. It reported a jump on the pre-full-bleed build
                # too, so it was not detecting a regression -- it was
                # detecting its own latency. Sampling on requestAnimationFrame
                # inside the page removes the round-trip from the loop
                # entirely and records what actually rendered.
                trace = page.evaluate(
                    """async () => {
                      const trace = []; let stop = false;
                      (function tick(){ trace.push(Math.round(scrollY));
                        if (!stop) requestAnimationFrame(tick); })();
                      document.querySelector('#workBtn').click();
                      await new Promise(r => setTimeout(r, 1500));
                      stop = true;
                      return {trace, final: Math.round(scrollY)};
                    }"""
                )
                scroll_samples, final_scroll = trace["trace"], trace["final"]
                assert final_scroll > 0, (profile, width, scroll_samples, final_scroll)
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
