#!/usr/bin/env python3
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
from io import BytesIO
from PIL import Image, ImageColor

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = Path("/tmp/hero-entrance-rhythm")
PORTRAIT = Image.open(ROOT / "images/neutral.webp").convert("RGBA")
PORTRAIT_ALPHA_BOUNDS = PORTRAIT.getchannel("A").getbbox()
PORTRAIT_ART_WIDTH_RATIO = (PORTRAIT_ALPHA_BOUNDS[2] - PORTRAIT_ALPHA_BOUNDS[0]) / PORTRAIT.width
PORTRAIT_ART_TOP_RATIO = PORTRAIT_ALPHA_BOUNDS[1] / PORTRAIT.height
RHYTHM_VIEWPORTS = (
    (1440, 900),
    (1280, 720),
    (1280, 650),
    (761, 844),
    (760, 844),
    (390, 844),
    (320, 800),
)


def expected_hero_height(width, height):
    # ── THE HERO GIVES A SLICE BACK, AND THIS FUNCTION HAD TO CHANGE ─────────
    # It returned `height` -- the Hero IS the viewport -- which was correct
    # from the full-bleed pass until 2026-08-20, when Jayden asked for the
    # opposite: "make the hero smaller like take up less space to see the tabs
    # and case study below". index.html now subtracts --heroReveal.
    # THIS MIRRORS THE CLAMP RATHER THAN READING IT, deliberately. A custom
    # property does not resolve through getPropertyValue -- a clamp() comes
    # back as the token stream and parseFloat gives NaN -- so the only way to
    # read the real number in a browser is to measure a probe, and a probe of
    # the Hero's height is the very thing under test. Mirroring means the two
    # have to be edited together, which for a composition value he is expected
    # to retune by eye is the right cost: the alternative is a gate that
    # cannot tell a deliberate retune from the Hero silently collapsing.
    # THE FLOOR AT ZERO IS THE SHORT-LAPTOP CASE and it is load-bearing: at
    # 1280x650 the head already rests 25px off the floor with the crowd-drop
    # saturated, so the reveal is zero there and the Hero is still the whole
    # 650px. A gate that expected a constant fraction would fail that width.
    if width <= 760:
        reveal = min(max(0.0, (height - 620) * .78), 196)
    else:
        reveal = min(max(0.0, (height - 680) * .9), 240)
    return height - reveal

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass

def static_contract():
    tokens = (ROOT / "tokens.css").read_text(encoding="utf-8")
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    assert "--section-join-gap:var(--sp-16)" in tokens
    assert "--work-item-gap:var(--sp-64)" in tokens
    assert "--work-item-gap:var(--sp-40)" in tokens
    assert ".cases{margin-top:var(--section-join-gap)}" in html
    assert ".csItem+.csItem{margin-top:var(--work-item-gap)}" in html
    assert "--hero-mobile-height:" in tokens
    # ── THE BELT MOVED ONTO --heroBox, AND IT IS STILL A BELT ────────────────
    # This pinned `@media(max-width:760px){.hero{min-height:var(--hero-mobile-height)}}`.
    # index.html now routes every one of the Hero's heights through --heroBox,
    # so the phone fork writes the TOKEN and min-height reads the name. The
    # property being protected is unchanged and is the reason the fork exists at
    # all: --hero-mobile-height is 100dvh, and on an engine that cannot parse
    # dvh the substitution is invalid at computed-value time and min-height
    # computes to `auto` -- the 844 -> 241.7 collapse. So the @supports gate is
    # asserted too, which the old line never did.
    assert "@media(max-width:760px){:root{--heroBox:calc(var(--hero-mobile-height) - var(--heroReveal))}}" in html
    assert "@supports (height:1dvh){\n @media(max-width:760px){:root{--heroBox:" in html
    assert "min-height:var(--heroBox)" in html
    # and the plain-vh floor that stands when dvh is unavailable
    assert "@media(max-width:760px){:root{--heroReveal:0px;--heroBox:100vh;--heroRow:100vh}}" in html
    hero_time = (ROOT / "hero-time.css").read_text(encoding="utf-8")
    controls = (ROOT / "controls.css").read_text(encoding="utf-8")
    assert ".surface--hero{" in controls and "box-shadow:none" in controls.split(".surface--hero{", 1)[1].split("}", 1)[0]
    seam = hero_time.split(".heroTimeGradient::after{", 1)[1].split("}", 1)[0]
    assert "var(--theme-page) 0%" in seam and "var(--theme-page) 10%" in seam
    assert "transparent 28%" in seam

def browser_contract(base_url):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, height in RHYTHM_VIEWPORTS:
            page = browser.new_page(viewport={"width": width, "height": height}, reduced_motion="reduce")
            page.goto(base_url + "/index.html?rhythm=1", wait_until="load")
            page.wait_for_selector(".csFrame")
            state = page.evaluate("""() => {
              const box = selector => {
                const r = document.querySelector(selector).getBoundingClientRect();
                return {top:r.top,bottom:r.bottom,width:r.width,height:r.height};
              };
              // MEASURED LEVEL. The head rests rotated now, so a bounding rect of
              // the stage is the TURNED box -- about 21% wider than the portrait at
              // 390 -- and the proportions below would be measuring the rotation
              // rather than the composition. Every angle the wrapper carries is
              // lifted for one read, !important because the entrance keyframe
              // outranks an inline write.
              const levelBox = selector => {
                const wrap = document.querySelector('#heroHeadTransform');
                const names = ['--hero-head-rotate','--hero-head-float-rot','--hero-head-enter-rot'];
                const saved = names.map(n => [n, wrap.style.getPropertyValue(n),
                  wrap.style.getPropertyPriority(n)]);
                names.forEach(n => wrap.style.setProperty(n, '0deg', 'important'));
                const out = box(selector);
                saved.forEach(([n,v,pr]) => { if (v) wrap.style.setProperty(n,v,pr);
                  else wrap.style.removeProperty(n); });
                return out;
              };
              const items = [...document.querySelectorAll('.csPanel.on .csItem')];
              const a = items[0].getBoundingClientRect();
              const b = items[1].getBoundingClientRect();
              const hero = document.querySelector('.hero');
              const heroStyle = getComputedStyle(hero);
              const headline = document.querySelector('.heroCopy h1');
              const characters = [...headline.querySelectorAll('.ch')];
              const lineCount = characters.length
                ? new Set(characters.map(node => node.offsetTop)).size
                : Math.round(headline.getBoundingClientRect().height / parseFloat(getComputedStyle(headline).lineHeight));
              // ── THIS LIST COULD GO EMPTY AND PASS, AND ALMOST DID ───────
              // It read '.heroCtas > .workCta,#heroTimeBtn'. "View work" was
              // deleted on 2026-08-20 and the tap-floor assertion below is an
              // all() over this array -- all([]) is True, so a row that had
              // lost BOTH its controls would have sailed through. The selector
              // is narrowed to what is actually there and the count is
              // asserted, so the gate fails when the row empties instead of
              // congratulating it.
              const controls = [...document.querySelectorAll('.heroCtas > *')]
                .filter(node => node.offsetParent !== null || node.getClientRects().length)
                .map(node => { const r = node.getBoundingClientRect();
                  return {cls:node.className || node.tagName, width:r.width, height:r.height}; });
              return {
                hero: box('.hero'), cases: box('.cases'), itemGap: b.top - a.bottom,
                tabsBottom: (document.querySelector('.collection__tabs')
                  || document.querySelector('.csTabs')).getBoundingClientRect().bottom,
                overflow: document.documentElement.scrollWidth > innerWidth,
                heroShadow: heroStyle.boxShadow,
                mobile: {
                  innerWidth: hero.getBoundingClientRect().width - parseFloat(heroStyle.paddingLeft) - parseFloat(heroStyle.paddingRight),
                  lineCount, copy: box('.heroCopy'), ctas: box('.heroCtas'),
                  peek: levelBox('.heroCharacterPeek .stagewrap'), controls
                }
              };
            }""")
            assert not state["overflow"], (width, state)
            # THE WHOLE POINT OF THE SHRINK, ASSERTED AS BEHAVIOUR. Above 780px
            # of viewport there is room for the tab row to clear the fold, and
            # Jayden asked for it in those words. Below that the reveal is zero
            # by design and there is nothing to assert.
            if height >= 780:
                assert state["tabsBottom"] <= height, (
                    "the tab row must clear the fold without a scroll", width, height, state)
            assert state["heroShadow"] == "none", state
            assert 15.5 <= state["cases"]["top"] - state["hero"]["bottom"] <= 16.5, state
            expected_gap = 40 if width <= 760 else 64
            assert expected_gap - .5 <= state["itemGap"] <= expected_gap + .5, state
            target = expected_hero_height(width, height)
            assert target - .5 <= state["hero"]["height"] <= target + .5, (
                width, height, state
            )
            if width <= 760:
                assert state["mobile"]["lineCount"] <= 3, state
                assert state["mobile"]["copy"]["top"] >= state["hero"]["top"], state
                assert state["mobile"]["ctas"]["bottom"] <= state["hero"]["bottom"], state
                assert state["mobile"]["peek"]["top"] >= state["hero"]["top"], state
                assert state["mobile"]["controls"], ("the CTA row has no controls left", state)
                assert all(control["width"] >= 43.5 and control["height"] >= 43.5 for control in state["mobile"]["controls"]), state
                if width <= 420:
                    # ── THE HEAD IS SMALLER, AND THAT IS JAYDEN'S CALL ────
                    # The old band (.60-.72) described a 336px portrait filling
                    # most of a phone's width. He placed it himself with the
                    # HUD at 211px, which is .35 of the art at 390 and .44 at
                    # 320 -- a portrait in a composition rather than a portrait
                    # that IS the composition. The band brackets both authored
                    # widths; it is a guard against the head drifting back to
                    # dominating the phone, not a re-derivation of the value.
                    head_ratio = state["mobile"]["peek"]["width"] * PORTRAIT_ART_WIDTH_RATIO / state["mobile"]["innerWidth"]
                    assert .30 <= head_ratio <= .48, (head_ratio, state)
                    visible_head_top = state["mobile"]["peek"]["top"] + state["mobile"]["peek"]["height"] * PORTRAIT_ART_TOP_RATIO
                    head_gap = visible_head_top - state["mobile"]["ctas"]["bottom"]
                    assert 24 <= head_gap <= 96, state
                    # ── THE HEAD NO LONGER MEETS THE FLOOR ────────────────
                    # This asserted a CROP: 62-67% of the portrait above the
                    # Hero's lower edge, with the rest hanging past it. That was
                    # the right contract while --hero-peek-depth was positive.
                    # It is negative now, deliberately -- the head is suspended
                    # clear of the floor rather than cropped by it, which is
                    # also why the ground shadow was deleted. Asserting a crop
                    # ratio would now be asserting the old composition back.
                    clearance = state["hero"]["bottom"] - state["mobile"]["peek"]["bottom"]
                    assert clearance > 0, ("the head must clear the floor", state)
                    assert clearance <= state["mobile"]["peek"]["height"] * .9, state
                page.wait_for_function("() => [...document.querySelectorAll('.heroCopy h1 .ch')].every(node => node.classList.contains('show'))")
                page.wait_for_timeout(2200)
                for capture in ("daytime", "night", "off"):
                    page.evaluate("state => window.SiteTheme.setMode(state,{persist:false})", capture)
                    page.wait_for_function("state => document.querySelector('#main').dataset.timeState === state", arg=capture)
                    page.wait_for_timeout(700)
                    page.screenshot(path=str(ARTIFACTS / f"home-{width}-{height}-{capture}.png"), full_page=False)
            page.evaluate("document.querySelectorAll('.jbStick,.heroCopy').forEach(el => el.style.visibility = 'hidden')")
            for theme in ("off", "pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night"):
                page.evaluate("state => window.SiteTheme.setMode(state,{persist:false})", theme)
                page.wait_for_function("state => document.querySelector('#main').dataset.timeState === state", arg=theme)
                page.wait_for_timeout(700)
                hero = page.locator("#main").bounding_box()
                expected = ImageColor.getrgb(page.evaluate(
                    "getComputedStyle(document.documentElement).getPropertyValue('--theme-page').trim()"
                ))
                image = Image.open(BytesIO(page.screenshot())).convert("RGB")
                y = int(hero["y"] + 2)
                xs = (
                    int(hero["x"] + 2),
                    int(hero["x"] + hero["width"] * .25),
                    int(hero["x"] + hero["width"] * .50),
                    int(hero["x"] + hero["width"] * .75),
                    int(hero["x"] + hero["width"] - 3),
                )
                for x in xs:
                    actual = image.getpixel((x, y))
                    hit = page.evaluate("([x,y]) => { const el = document.elementFromPoint(x,y); return el && `${el.tagName}.${el.className}`; }", [x, y])
                    assert max(abs(actual[i] - expected[i]) for i in range(3)) <= 2, (
                        width, height, theme, x, hero, hit, actual, expected
                    )
            page.close()
        browser.close()

# ── SELF-TEST ────────────────────────────────────────────────────────────────
# Two injections, one per assertion this pass added or changed. Both are served
# in flight rather than written: several agents share this worktree and a
# contract that edits index.html to test itself is one that can leave it edited.
INJECTIONS = {
    # the shrink reverted. expected_hero_height and tabsBottom must both trip.
    "full-height-hero": ("--heroReveal:clamp(0px,calc((100svh - 680px) * .9),240px)",
                         "--heroReveal:0px"),
    # the CTA row emptied. Before this pass all([]) was True and let it through.
    # INJECTED INLINE, NOT AS A RULE. The first attempt appended
    # `.heroCtas>*{display:none}` to that rule in index.html's <style> and it
    # did NOT trip the gate: controls.css and hero-time.css link after that
    # block, so their equal-specificity display on the row's children wins --
    # the same link-order trap the site's own notes keep pointing at. An
    # injection that cannot fail is worse than none, so it moved to the one
    # place nothing in a stylesheet can outrank.
    "empty-cta-row": ('<div class="heroCtas">',
                      '<div class="heroCtas" style="display:none">'),
}


def injected_handler(find, replace):
    class Injector(Quiet):
        def send_head(self):
            if self.path.split("?")[0] not in ("/index.html", "/"):
                return super().send_head()
            body = (ROOT / "index.html").read_text(encoding="utf-8")
            assert find in body, ("injection stale; an injection that cannot fail "
                                  "is worse than none", find)
            body = body.replace(find, replace).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            from io import BytesIO
            return BytesIO(body)
    return Injector


def self_test():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    ok = True
    for name, (find, replace) in INJECTIONS.items():
        server = ThreadingHTTPServer(
            ("127.0.0.1", 0), partial(injected_handler(find, replace), directory=str(ROOT)))
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
    print("Hero entrance rhythm self-test: OK")


def main():
    static_contract()
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        browser_contract(f"http://127.0.0.1:{server.server_port}")
    finally:
        server.shutdown(); server.server_close()
    print("Hero entrance rhythm: OK")

if __name__ == "__main__":
    import sys
    if "--self-test" in sys.argv:
        self_test()
    else:
        main()
