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
    # FULL-BLEED, ALL FOUR EDGES. The Hero used to be a card: desktop reserved
    # 88px for the bar above it plus a gap below, and mobile was deliberately
    # shorter than the screen. Both of those subtractions ARE the gap Jayden
    # asked us to remove -- the bar floats over the Hero now, so the Hero is
    # the viewport. 100dvh is what makes this exact on a phone; svh would
    # reopen the gap the moment browser chrome retracts.
    return height

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
    assert "@media(max-width:760px){.hero{min-height:var(--hero-mobile-height)}}" in html
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
              const controls = [...document.querySelectorAll('.heroCtas > .workCta,#heroTimeBtn')].map(node => {
                const r = node.getBoundingClientRect(); return {width:r.width,height:r.height};
              });
              return {
                hero: box('.hero'), cases: box('.cases'), itemGap: b.top - a.bottom,
                overflow: document.documentElement.scrollWidth > innerWidth,
                heroShadow: heroStyle.boxShadow,
                mobile: {
                  innerWidth: hero.getBoundingClientRect().width - parseFloat(heroStyle.paddingLeft) - parseFloat(heroStyle.paddingRight),
                  lineCount, copy: box('.heroCopy'), ctas: box('.heroCtas'),
                  peek: box('.heroCharacterPeek .stagewrap'), controls
                }
              };
            }""")
            assert not state["overflow"], (width, state)
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
                assert all(control["width"] >= 43.5 and control["height"] >= 43.5 for control in state["mobile"]["controls"]), state
                if width <= 420:
                    head_ratio = state["mobile"]["peek"]["width"] * PORTRAIT_ART_WIDTH_RATIO / state["mobile"]["innerWidth"]
                    assert .60 <= head_ratio <= .72, state
                    visible_head_top = state["mobile"]["peek"]["top"] + state["mobile"]["peek"]["height"] * PORTRAIT_ART_TOP_RATIO
                    head_gap = visible_head_top - state["mobile"]["ctas"]["bottom"]
                    assert 24 <= head_gap <= 96, state
                    crop_ratio = (state["hero"]["bottom"] - state["mobile"]["peek"]["top"]) / state["mobile"]["peek"]["height"]
                    assert .62 <= crop_ratio <= .67, state
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
    main()
