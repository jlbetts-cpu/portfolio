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
# "View work" was deleted on 2026-08-20 (see static_contract). The row
# still has to hold a 44px target; it just has one instead of two.
TAP_TARGETS = ("heroTimeBtn",)


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
    allowed through deliberately -- a translation cannot change a width or a
    height anyway, which is all this file asserts. It used to be REQUIRED to be
    allowed, because .heroCopy carried a permanent translateY(-117px) that
    could never settle to identity; that lift was retired on 2026-08-20 when
    Jayden asked for the headline in the middle of the Hero, and .heroCopy now
    centres with justify-content and has no transform at all. The allowance
    stays because the entrance keyframes still translate.
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

    # ── "View work" IS GONE, AND THIS LINE USED TO DEMAND IT ─────────────────
    # 2026-08-20, Jayden: "removing the view work button and just having the
    # text". Inverted rather than deleted, because the failure mode worth
    # blocking is it coming BACK by accident -- hero-engine.js still binds a
    # click handler to the id behind an `if`, and play.html still ships one,
    # so the name is alive elsewhere in the tree and could be pasted back.
    assert 'id="workBtn"' not in hero, "the View work CTA is deleted, not hidden"
    assert 'class="workCta' not in hero
    # The row is not empty and must not become empty: the time control is what
    # is left in it, and it is the only way to reach the six skies.
    assert 'id="heroTimeBtn"' in hero and 'id="heroTimeMenu"' in hero
    # The reveal is the whole of the shrink. Named here so deleting the token
    # fails statically instead of only showing up as a geometry drift.
    assert "--heroReveal:clamp(" in html
    assert "min-height:var(--heroBox)" in html
    # The smooth path to the work section used to be JS, bound to the button
    # that is now gone. What is left is the native one, and it is the reason
    # the deletion costs nothing -- so it is pinned here.
    assert "html{scroll-behavior:smooth}" in html
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


# WHAT THIS PROBE ASSERTS, AND WHY IT STOPPED NAMING .jbNav.  2026-08-19.
# The behaviour under test is unchanged and is real: the header must sit on an
# OPAQUE ground, so a headline scrolling under it cannot ghost through. What
# changed is which box paints that ground. The bar used to be a floating pill and
# painted its own; it is a full-bleed band with a floor now (header.css §0b) and
# the ground is on .jbStick, so `getComputedStyle('.jbNav').backgroundColor`
# started returning rgba(0,0,0,0) and the gate failed a page that is MORE opaque
# than the one it was written against.
# Reading one fixed selector was the weakness. This walks UP from the nav's own
# label box to the first ancestor that actually paints something, which is what
# "is there an opaque ground behind this text" really means -- and it keeps
# failing if the ground is deleted anywhere in that chain, which is the bug worth
# catching. Verified to fail: forcing .jbStick and .jbNav both transparent makes
# it return rgba(0,0,0,0) and the assertion below trips.
PAINTED_GROUND = """['.jbNav','#heroTimeBtn'].map(function(selector){
  var node = document.querySelector(selector);
  while(node){
    var c = getComputedStyle(node).backgroundColor;
    if(c && c !== 'transparent' && !/,\\s*0\\)$/.test(c)) return c;
    node = node.parentElement;
  }
  return 'rgba(0, 0, 0, 0)';
})"""


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
                    ctas: {top: ctas.top, bottom: ctas.bottom,
                           left: ctas.left, right: ctas.right},
                    // The corner control and the column it is supposed to share
                    // with the tab row -- see the grid assertion below.
                    timeBtn: (() => {
                      const b = document.getElementById('heroTimeBtn');
                      if (!b) return null;
                      const r = b.getBoundingClientRect();
                      return {top: r.top, bottom: r.bottom, left: r.left, right: r.right};
                    })(),
                    tabsBox: (() => {
                      const t = document.querySelector('.collection__tabs .csTab');
                      if (!t) return null;
                      const r = t.getBoundingClientRect();
                      return {left: r.left, right: r.right};
                    })(),
                    coverLeft: (() => {
                      const c = document.querySelector('#cases .csItem');
                      return c ? c.getBoundingClientRect().left : null;
                    })(),
                    casesTop: cases.top,
                    // The tab row is the thing Jayden asked to be able to see.
                    // Measured off the live element, not derived from the
                    // Hero's height plus a gap -- a derived number cannot
                    // notice the join gap changing underneath it.
                    tabsBottom: (document.querySelector('.collection__tabs')
                      || document.querySelector('.csTabs')).getBoundingClientRect().bottom,
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
            # 44px, MEASURED WITH A SUB-PIXEL TOLERANCE (2026-08-10).
            # getBoundingClientRect returns floats, and a control that IS 44 can
            # report 43.98 or 43.86 -- fractional layout, a device pixel ratio
            # that does not divide evenly, or the --press-scale .97 catching it
            # mid-press. The 2026-08-09 audit logged this line failing on
            # workBtn 102.29 x 43.984 and heroTimeBtn 43.859 x 43.859: three
            # correct 44px controls, one exact-comparison bug. The tolerance is
            # the same 0.51 shared-controls-browser.py already uses, which is
            # half a CSS pixel -- wide enough to absorb rounding, far too narrow
            # to let a genuinely undersized 43px target through.
            TAP_MIN, TOL = 44, 0.51
            undersized = [t for t in state["targets"]
                          if t["width"] < TAP_MIN - TOL or t["height"] < TAP_MIN - TOL]
            assert not undersized, (undersized, state)
            # ── THE HERO IS NO LONGER THE VIEWPORT, AND THAT IS THE POINT ────
            # This asserted `hero.height == viewport` to the half-pixel. That
            # was right while the Hero was full-bleed on all four edges; on
            # 2026-08-20 Jayden asked for the opposite -- "make the hero
            # smaller like take up less space to see the tabs and case study
            # below" -- so the equality is now asserting the bug.
            # WHAT REPLACES IT IS THE BEHAVIOUR, NOT THE NUMBER. index.html's
            # --heroReveal is a clamp over svh and mirroring its arithmetic
            # here would only pin a value he is expected to retune. The two
            # things that must stay true whatever he tunes it to are that the
            # Hero never grows past the viewport (it would scroll) and never
            # collapses to a banner, plus -- on any viewport with the room --
            # that the tab row he asked to see is actually on screen.
            assert state["hero"]["height"] <= height + .5, state
            # ── THE FLOOR IS PIXELS NOW, BECAUSE THE HERO IS SIZED IN PIXELS ─
            # `>= height * .68` was a share of the viewport, and it failed on
            # 2026-08-20 at 390x844 with a 570px Hero -- 0.675, three
            # thousandths under -- for a change Jayden asked for outright:
            # "i think the hero should be a bit smaller still". A share was the
            # right shape while --heroReveal took .9 of the leftover slack and
            # the Hero still grew with the window. It takes ALL the slack now,
            # so the Hero is its content's height (650 desktop, 570 phone) and
            # its share of the viewport is whatever the visitor's monitor makes
            # it -- 0.72 at 900, 0.54 at 1200. Asserting a share would fail on a
            # tall screen for being correct.
            # WHAT THE LINE WAS FOR SURVIVES: "never collapses to a banner".
            # 520px is that, in the unit the Hero is authored in -- below it the
            # 335px head and the 104px copy cannot both stand up -- and it is
            # bounded by the viewport so a genuinely short window still passes.
            assert state["hero"]["height"] >= min(height, 520), state
            assert abs(state["hero"]["top"]) <= .5, state
            if height >= 780:
                assert state["tabsBottom"] <= height, (
                    "the tab row must clear the fold without a scroll", height, state)
            assert state["title"]["top"] >= state["hero"]["top"], state
            # ── THE HEADLINE IS CENTRED NOW, NOT PARKED IN THE TOP THIRD ────
            # This read `<= hero.top + hero.height * 0.38` and it failed on
            # 2026-08-20 at 219 against a ceiling of 212.8. The 0.38 was a
            # faithful description of a composition .heroCopy no longer has:
            # the copy was pinned to the top of the Hero's row and pulled up
            # another 92-124px by a negative transform, so its box genuinely
            # lived in the top third.
            # JAYDEN ASKED FOR THE OPPOSITE: "the h1 text I feel like should be
            # in the middle of the hero." A ceiling at 0.38 of the height is a
            # ceiling that forbids the middle, so it is rewritten rather than
            # loosened -- CLAUDE.md section 7, a gate protecting a decision
            # rather than a behaviour.
            # WHAT IS WORTH GUARDING IS THAT IT IS STILL A COMPOSITION. Two
            # ways this breaks and neither is subtle: the copy loses its
            # centring and slams against the Hero's ceiling (it is stretched to
            # a full-height grid row, so flex-start puts it at the very top), or
            # something drops it onto the corner control's rail at the floor. So
            # the headline's own CENTRE is asserted to sit in the middle band of
            # the Hero, generously: 0.30 to 0.62 of the height. At 1440x900 it
            # measures 0.47 and at 390x844 0.52.
            title_mid = (state["title"]["top"] + state["title"]["bottom"]) / 2
            title_share = (title_mid - state["hero"]["top"]) / state["hero"]["height"]
            assert 0.30 <= title_share <= 0.62, (title_share, state)
            assert state["ctas"]["bottom"] <= state["hero"]["bottom"], state
            # ── THE CORNER CONTROL, AND THE COLUMN IT STANDS IN ──────────────
            # Jayden, 2026-08-20: "put the button for day change in the bottom
            # right corner of the hero using the grid". Three things have to
            # hold and each fails differently, so each is its own line.
            # (1) IT IS IN THE BOTTOM HALF. The whole point is that it left the
            #     centred copy stack; a regression that puts it back would still
            #     satisfy every other assertion in this file.
            # (2) IT IS ON THE PAGE'S COLUMN. The tab row's first tab and the
            #     first cover share a left edge -- 120 at 1440, 16 at 390 -- and
            #     the rail's right edge has to be the column's right edge, which
            #     is what "using the grid" means. Measured against the LIVE tab
            #     row rather than against a literal, so it follows the page.
            #     1px of tolerance for sub-pixel layout, not for a different
            #     inset: the failure mode this catches is `left:0`, which is off
            #     by 16px at 390 and by 0 at 1440 -- it passed at one width and
            #     not the other, which is exactly why the check is relational.
            # (3) IT IS INSIDE THE HERO. A corner control that has slipped past
            #     the Hero's floor is over the work section.
            btn = state["timeBtn"]
            assert btn, "the Hero must keep its time-of-day control"
            assert btn["top"] > state["hero"]["top"] + state["hero"]["height"] * .5, (
                "the time control belongs in the Hero's bottom half, not the copy stack", state)
            assert btn["bottom"] <= state["hero"]["bottom"], state
            if state["tabsBox"]:
                assert abs(state["ctas"]["left"] - state["tabsBox"]["left"]) <= 1, (
                    "the rail's left edge must be the page column's", state)
                assert abs(btn["right"] - state["ctas"]["right"]) <= 1, (
                    "the control sits at the right end of the rail", state)
            if state["coverLeft"] is not None:
                assert abs(state["ctas"]["left"] - state["coverLeft"]) <= 1, (
                    "the rail and the first cover share a left edge", state)
            assert state["casesTop"] - state["hero"]["bottom"] <= 160, state
            initial_geometry = state["hero"]

            page.evaluate("window.SiteTheme.setMode('off', {persist:false})")
            page.wait_for_function("document.getElementById('main').dataset.timeState === 'off'")
            page.wait_for_timeout(700)
            off_geometry = page.locator("#main").bounding_box()
            off_surfaces = page.evaluate(
                PAINTED_GROUND
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
                PAINTED_GROUND
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
                # ── THE DRIVER CHANGED; THE PROPERTY DID NOT ─────────────────
                # This used to click #workBtn, whose handler in hero-engine.js
                # called window.__softScroll -- a JS rAF tween that turned the
                # native smooth scroll off (html.softScrolling) while it ran.
                # The button was deleted on 2026-08-20 and NOTHING on this page
                # calls __softScroll any more: the only other caller is bound to
                # #talk, which lives on about.html. So the JS path is not
                # "failing", it is unreachable, and a gate that kept driving it
                # would be testing a control the page does not have.
                # THE PROPERTY UNDER TEST IS UNCHANGED -- reaching the work
                # section is a travel, not a jump -- and the native path that
                # index.html:55 declares now carries it alone. Driven through
                # the anchor a visitor actually has, and sampled on the page's
                # own frames for the same latency reason the old note gives.
                assert page.evaluate(
                    "getComputedStyle(document.documentElement).scrollBehavior"
                ) == "smooth", "the native smooth path is the only one left"
                trace = page.evaluate(
                    """async () => {
                      const trace = []; let stop = false;
                      (function tick(){ trace.push(Math.round(scrollY));
                        if (!stop) requestAnimationFrame(tick); })();
                      location.hash = '#cases';
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


# ── THE SELF-TEST RE-INJECTS THE BUG, IT DOES NOT SIMULATE IT ───────────────
# A detector nobody has watched fail is one nobody should trust. The bug this
# file now blocks is "the Hero eats the whole first screen again", so the
# injection is the one line that causes it: --heroReveal forced to 0. It is
# served, not written to disk -- the tree is shared with other agents and a
# contract that edits index.html to test itself is a contract that can leave it
# edited. The handler rewrites index.html in flight and everything else, CSS
# included, is served untouched.
# EVERY `find` HERE IS A LIVE STRING OUT OF index.html AND THAT IS THE WHOLE
# POINT OF injected_handler()'s assert: an injection whose needle has drifted
# out of the file silently stops re-injecting the bug, and a detector nobody has
# watched fail is one nobody should trust. Both of the original two had drifted
# by 2026-08-20 -- the reveal expression was retuned and the rail's markup
# re-indented when it left .heroCopy -- and the self-test was failing with an
# ERR_EMPTY_RESPONSE rather than a message, because the assert fires inside the
# server thread. If that is what you are looking at, re-read the needles first.
INJECTIONS = {
    # revert the shrink: the Hero is the viewport again and the tab row falls
    # back under the fold. Must trip the tabsBottom assertion at 1440x900.
    "full-height-hero": (
        "--heroReveal:clamp(0px,calc(100svh - 560px),500px)",
        "--heroReveal:0px",
    ),
    # collapse the Hero to a banner. Must trip the 520px floor.
    "banner-hero": (
        "--heroReveal:clamp(0px,calc(100svh - 560px),500px)",
        "--heroReveal:clamp(0px,calc(100svh - 300px),900px)",
    ),
    # take the rail off the page column and back to the Hero's border edge --
    # which is `left:0`, the exact mistake this cost a round trip on, because an
    # absolutely positioned box is laid out against the PADDING box. It is
    # correct at 1440 by coincidence and 16px out at 390, so it must trip the
    # relational column assertion and not the desktop one.
    "rail-off-grid": (
        ".heroCtas{position:absolute;left:var(--heroPadL);right:var(--heroPadR)",
        ".heroCtas{position:absolute;left:0;right:0",
    ),
    # put the control back in the top half, where the centred copy stack had it.
    # Must trip the bottom-half assertion.
    "control-back-up-top": (
        "bottom:var(--heroRailB);\n /* left AND right set",
        "top:var(--heroRailB);\n /* left AND right set",
    ),
    # put "View work" back. Must trip the static contract.
    "cta-returns": (
        '<div class="heroCtas">\n   <div class="heroTime" id="heroTime">',
        '<div class="heroCtas">\n   <a class="workCta ctl ctl--primary" id="workBtn"'
        ' href="#cases"><span>View work</span></a>\n   <div class="heroTime" id="heroTime">',
    ),
}


def injected_handler(find, replace):
    class Injector(QuietHandler):
        def send_head(self):
            if self.path.split("?")[0] not in ("/index.html", "/"):
                return super().send_head()
            body = (ROOT / "index.html").read_text(encoding="utf-8")
            assert find in body, ("the injection no longer matches the file; "
                                 "an injection that cannot fail is worse than none", find)
            body = body.replace(find, replace).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            from io import BytesIO
            return BytesIO(body)
    return Injector


def self_test():
    ok = True
    for name, (find, replace) in INJECTIONS.items():
        if name == "cta-returns":
            # static only -- it never reaches a browser
            html = (ROOT / "index.html").read_text(encoding="utf-8")
            assert find in html, (name, "injection stale")
            broken = html.replace(find, replace)
            try:
                start = broken.index('<section class="hero surface surface--hero" id="main"')
                hero = broken[start:broken.index("</section>", start)]
                assert 'id="workBtn"' not in hero
            except AssertionError:
                print(f"  {name}: correctly detected")
                continue
            print(f"  {name}: NOT DETECTED"); ok = False
            continue
        server = ThreadingHTTPServer(
            ("127.0.0.1", 0), partial(injected_handler(find, replace), directory=str(ROOT))
        )
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            browser_contract(f"http://127.0.0.1:{server.server_port}")
        except AssertionError as failure:
            print(f"  {name}: correctly detected -> {str(failure)[:90]}")
        else:
            print(f"  {name}: NOT DETECTED"); ok = False
        finally:
            server.shutdown(); server.server_close()
    if not ok:
        raise SystemExit("self-test: an injected bug went undetected")
    print("Home minimal hero self-test: OK")


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
    import sys
    if "--self-test" in sys.argv:
        self_test()
    else:
        main()
