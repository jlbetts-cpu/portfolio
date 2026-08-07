#!/usr/bin/env python3
"""Real-browser contract for Play's Home Hero port and retained game states."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = Path(os.environ.get("PLAY_HERO_ARTIFACTS", "/tmp/play-hero-port"))


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


def boot_probe(context):
    context.add_init_script(
        """
        window.__playBootSnapshot = null;
        (function () {
          function capture() {
          var body = document.body;
          if (!body) return;
            if (window.__playBootSnapshot || body.classList.contains("playBooting")) return;
            var nodes = Array.from(document.querySelectorAll("#playArena [data-hm-boot-ready]"));
            if (!nodes.length) return;
            window.__playBootSnapshot = {
              count: nodes.length,
              painted: nodes.every(function (node) {
                var img = node.querySelector("img");
                return img && img.complete && img.naturalWidth > 0;
              }),
              throwState: body.getAttribute("data-lobby-throw"),
              throwing: nodes.filter(node => node.getAttribute("data-hm-lobby-throw") === "active").length,
              queued: nodes.filter(node => node.getAttribute("data-hm-lobby-throw") === "queued").length,
              firstState: window.__hmC && window.__hmC.get ? window.__hmC.get().st : null
            };
          }
          window.__playCaptureBoot = capture;
          new MutationObserver(capture).observe(document, {
            subtree: true, childList: true, attributes: true,
            attributeFilter: ["class", "data-play-ready"]
          });
          addEventListener("DOMContentLoaded", capture);
        })();
        """
    )


def new_page(browser, base_url, viewport, reduced=False, mode=None):
    context = browser.new_context(
        viewport={"width": viewport[0], "height": viewport[1]},
        reduced_motion="reduce" if reduced else "no-preference",
    )
    if mode:
        context.add_init_script(
            "try { sessionStorage.setItem('jbHeroTimeMode', %r); } catch (_) {}" % mode,
        )
    boot_probe(context)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("response", lambda response: errors.append("HTTP %s %s" % (response.status, response.url)) if response.status >= 400 and "/images/preview/" not in response.url else None)
    page.goto(base_url + "/play.html", wait_until="domcontentloaded")
    page.wait_for_selector('body[data-play-ready="true"]', timeout=20_000)
    page.wait_for_function("window.__playBootSnapshot !== null", timeout=10_000)
    page.wait_for_function(
        "parseFloat(getComputedStyle(document.querySelector('#stage')).opacity) > .99",
        timeout=4_000,
    )
    return context, page, errors


def assert_seated(page, expected=5):
    snap = page.evaluate("window.__playBootSnapshot")
    assert snap["count"] == expected and snap["painted"], snap
    reduced = page.evaluate('matchMedia("(prefers-reduced-motion:reduce)").matches')
    if reduced:
        assert snap["throwState"] == "reduced" and snap["firstState"] == "idle", snap
    else:
        assert snap["throwState"] == "active", snap
        assert snap["throwing"] >= 1 and snap["throwing"] + snap["queued"] == expected, snap
        page.wait_for_selector('body[data-lobby-throw="settled"]', timeout=5_000)
        page.wait_for_function(
            """count => Array.from(document.querySelectorAll('#playArena [data-hm-boot-ready]'))
              .slice(0, count).every(node => node.getAttribute('data-hm-lobby-throw') === 'settled')""",
            arg=expected,
            timeout=5_000,
        )
    visible = page.evaluate(
        """
        () => Array.from(document.querySelectorAll('#playArena [data-hm-boot-ready]')).map(node => {
          const r=node.getBoundingClientRect(), css=getComputedStyle(node);
          return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,opacity:parseFloat(css.opacity)};
        })
        """
    )
    assert all(item["opacity"] >= .99 and item["right"] > 0 and item["left"] < page.viewport_size["width"] for item in visible), visible
    if page.viewport_size["width"] <= 390:
        centers = sorted((item["left"] + item["right"]) / 2 for item in visible)
        assert centers[-1] - centers[0] >= page.viewport_size["width"] * .55, visible


def assert_no_overflow(page, label):
    metrics = page.evaluate(
        """() => ({width: innerWidth, scrollWidth: document.documentElement.scrollWidth})"""
    )
    assert metrics["scrollWidth"] <= metrics["width"] + 1, (label, metrics)


def screenshot(page, label):
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(ARTIFACTS / (label + ".png")), full_page=False)


def run_layout(browser, base_url, width, height, reduced=False):
    context, page, errors = new_page(browser, base_url, (width, height), reduced=reduced)
    assert_seated(page)
    data = page.evaluate(
        """
        () => {
          const r = s => document.querySelector(s).getBoundingClientRect();
          const hero = r('#playArena'), header = r('.jbStick'), nav = r('.jbNav');
          const gradientClip = r('#heroTimeClip');
          const h1 = r('.heroCopy h1'), ctas = r('.heroCtas'), stage = r('.stagewrap');
          const games = r('#games'), cards = r('.pCards');
          const bounds = rect => ({left:rect.left,right:rect.right,width:rect.width});
          const target = s => { const x = r(s); return {w:x.width,h:x.height}; };
          return {
            heroes: document.querySelectorAll('.hero').length,
            mains: document.querySelectorAll('main').length,
            cards: Array.from(document.querySelectorAll('.pCards>.pCard')).map(x => x.id),
            columns: getComputedStyle(document.querySelector('.pCards')).gridTemplateColumns.split(' ').length,
            header: {top:header.top,height:header.height}, navTop: nav.top,
            hero: {top:hero.top,left:hero.left,right:hero.right,bottom:hero.bottom,height:hero.height},
            gradientTop: gradientClip.top,
            gamesGap: cards.top - hero.bottom,
            h1Cta: ctas.top - h1.bottom,
            ctaStage: stage.top - ctas.bottom,
            radius: getComputedStyle(document.querySelector('#playArena')).borderRadius,
            shadow: getComputedStyle(document.querySelector('#playArena')).boxShadow,
            targets: ['#workBtn','#moodBtn','#heroTimeBtn'].map(target),
            stage: {left:stage.left,right:stage.right,width:stage.width},
            games: bounds(games), cardsBounds: bounds(cards),
            cardBounds: Array.from(document.querySelectorAll('.pCards>.pCard')).map(card => bounds(card.getBoundingClientRect())),
            canonical: ['moodbar','moodBtn','moodMenu'].map(id => document.querySelectorAll('#'+id).length),
            gameIds: ['gamebar','gameBtn','gameMenu'].every(id => !!document.getElementById(id)),
            statusHidden: !!document.querySelector('#qdots[aria-live] [aria-hidden="true"]')
            ,surfaces: ['.jbNav','#moodBtn','#heroTimeBtn'].map(selector => getComputedStyle(document.querySelector(selector)).backgroundColor)
          };
        }
        """
    )
    assert data["heroes"] == 1 and data["mains"] == 1, data
    assert data["cards"] == ["pcHead", "pcExped", "pcTour", "pcGrad"], data
    assert data["canonical"] == [1, 1, 1] and data["gameIds"], data
    assert abs(data["header"]["top"]) <= 1 and abs(data["header"]["height"] - 72) <= 1, data
    assert abs(data["navTop"] - 8) <= 1, data
    assert abs(data["hero"]["top"] - 72) <= 1, data
    assert data["gradientTop"] <= 1, data
    assert abs(data["hero"]["left"]) <= 1 and abs(data["hero"]["right"] - width) <= 1, data
    assert abs(data["hero"]["bottom"] - height) <= 2, data
    assert 14 <= data["gamesGap"] <= 18, data
    assert data["radius"] == "0px" and data["shadow"] == "none", data
    assert all(item["w"] >= 44 and item["h"] >= 44 for item in data["targets"]), data
    assert data["stage"]["left"] >= -1 and data["stage"]["right"] <= width + 1, data
    assert not data["statusHidden"], data
    assert all(not color.startswith("rgba(") or not color.endswith(", 0)") for color in data["surfaces"]), data
    if width <= 390:
        assert data["columns"] == 2, data
        assert data["games"]["left"] >= -1 and data["games"]["right"] <= width + 1 and data["games"]["width"] <= width + 1, data
        assert data["cardsBounds"]["left"] >= -1 and data["cardsBounds"]["right"] <= width + 1, data
        assert all(card["left"] >= -1 and card["right"] <= width + 1 for card in data["cardBounds"]), data
        assert 12 <= data["h1Cta"] <= 16, data
        assert 6 <= data["ctaStage"] <= 10, data
        assert data["stage"]["width"] >= (250 if width == 320 else 300), data
    else:
        assert data["columns"] == 4, data
    assert_no_overflow(page, "layout-%s" % width)
    screenshot(page, "layout-%sx%s" % (width, height))

    page.mouse.wheel(0, 520)
    page.wait_for_timeout(120)
    natural_scroll = page.evaluate("scrollY")
    assert natural_scroll > 0, (width, natural_scroll)
    page.evaluate("window.scrollTo(0, 0)")

    page.locator("#workBtn").click()
    page.wait_for_function("location.hash === '#games'")
    page.wait_for_timeout(800 if not reduced else 50)
    scroll = page.evaluate(
        """() => ({y:scrollY, top:document.querySelector('#games').getBoundingClientRect().top})"""
    )
    assert scroll["y"] > 0 and 0 <= scroll["top"] < height, scroll
    assert not errors, errors
    context.close()


def run_mood(browser, base_url, mood, selector, predicate, reduced=True):
    context, page, errors = new_page(browser, base_url, (1280, 800), reduced=reduced)
    # Dispatch without Playwright's synthetic pre-click hover: fine-pointer Home opens on
    # hover by design, so a physical click after hovering is the close gesture.
    page.locator("#moodBtn").dispatch_event("click")
    assert page.locator("#moodBtn").get_attribute("aria-expanded") == "true"
    page.locator('#moodMenu [data-mood="%s"]' % mood).dispatch_event("click")
    page.wait_for_selector(selector, timeout=4_000)
    page.wait_for_function(predicate, timeout=4_000)
    assert page.locator("#moodBtn").get_attribute("aria-expanded") == "false"
    assert not errors, (mood, errors)
    context.close()


def run_skip_link(browser, base_url):
    context, page, errors = new_page(browser, base_url, (390, 844), reduced=True)
    skip = page.locator("#playSkip")
    assert skip.count() == 1, "Play needs one keyboard-first skip link"
    hidden = skip.bounding_box()
    assert hidden and hidden["y"] + hidden["height"] <= 0, hidden
    page.keyboard.press("Tab")
    focused = page.evaluate(
        """() => { const r=document.activeElement.getBoundingClientRect(); return {id:document.activeElement.id,top:r.top,bottom:r.bottom,height:r.height}; }"""
    )
    assert focused["id"] == "playSkip" and focused["top"] >= 0 and focused["bottom"] <= 844 and focused["height"] >= 44, focused
    page.keyboard.press("Enter")
    page.wait_for_function("location.hash === '#games'")
    page.wait_for_timeout(50)
    result = page.evaluate(
        """() => ({focus:document.activeElement&&document.activeElement.id,y:scrollY,top:document.querySelector('#games').getBoundingClientRect().top})"""
    )
    assert result["focus"] == "games" and result["y"] > 0 and result["top"] < 844, result
    assert not errors, errors
    context.close()


def run_time_and_games(browser, base_url):
    context, page, errors = new_page(browser, base_url, (1280, 800), mode="night")
    assert_seated(page)
    page.wait_for_function("document.querySelector('#playArena').dataset.timeState === 'night'")
    night = page.evaluate(
        """
        () => ({
          theme: document.documentElement.dataset.theme,
          mode: document.documentElement.dataset.themeMode,
          h1: getComputedStyle(document.querySelector('.heroCopy h1')).color,
          background: getComputedStyle(document.querySelector('#playArena [data-time-gradient="night"]')).backgroundImage,
          heroBg: getComputedStyle(document.querySelector('#playArena')).backgroundColor,
          surfaces: ['.jbNav','#moodBtn','#heroTimeBtn'].map(selector => getComputedStyle(document.querySelector(selector)).backgroundColor)
        })
        """
    )
    assert night["theme"] == "dark" and night["mode"] == "night", night
    assert all(int(x) >= 240 for x in night["h1"].removeprefix("rgb(").removesuffix(")").split(", ")), night
    assert "81, 69, 154" in night["background"] and "9, 9, 12" in night["background"], night
    assert "spotlight" not in night["background"].lower(), night
    assert all(not color.startswith("rgba(") or not color.endswith(", 0)") for color in night["surfaces"]), night

    page.locator("#heroTimeBtn").click()
    page.locator('#heroTimeMenu [data-time-mode="daytime"]').click()
    page.wait_for_function("document.querySelector('#playArena').dataset.timeState === 'daytime'")
    assert page.locator('#heroTimeMenu [data-time-mode="daytime"]').get_attribute("aria-checked") == "true"

    page.locator("#workBtn").click()
    page.wait_for_timeout(800)
    before = page.evaluate("scrollY")
    page.locator("#pcExped").focus()
    page.locator("#pcExped").dispatch_event("click")
    page.wait_for_selector("body.pTeamOn")
    picker = page.evaluate(
        """
        () => ({
          y: scrollY,
          viewportTop: document.querySelector('.playViewport').getBoundingClientRect().top,
          overflow: getComputedStyle(document.body).overflowY,
          focus: document.activeElement && document.activeElement.className,
          hidden: document.querySelector('#pTeam').hidden
        })
        """
    )
    assert abs(picker["viewportTop"]) <= 1 and picker["overflow"] == "hidden", picker
    assert not picker["hidden"] and "pBtn" in picker["focus"], picker
    page.locator(".pBtnBack").click()
    page.wait_for_function("!document.body.classList.contains('pTeamOn')")
    page.wait_for_function("y => Math.abs(scrollY-y) <= 2", arg=before)
    restored = page.evaluate("() => ({y:scrollY, focus:document.activeElement && document.activeElement.id})")
    assert abs(restored["y"] - before) <= 2 and restored["focus"] == "pcExped", restored

    page.locator("#pcTour").focus()
    page.locator("#pcTour").dispatch_event("click")
    page.wait_for_selector("body.hmTour")
    tour = page.evaluate(
        """() => ({live:!!(window.__hmTour&&window.__hmTour.live), disabled:document.querySelector('#gameBtn').getAttribute('aria-disabled'), y:scrollY})"""
    )
    assert tour["live"] and tour["disabled"] == "true", tour
    page.evaluate("window.__hmTourStop()")
    page.wait_for_function("!document.body.classList.contains('hmTour')")
    page.wait_for_function("y => Math.abs(scrollY-y) <= 2", arg=before)
    assert page.locator("#gameBtn").get_attribute("aria-disabled") is None
    assert_no_overflow(page, "time-and-games")
    assert not errors, errors
    context.close()


def main():
    handler = partial(QuietHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = "http://127.0.0.1:%s" % server.server_port
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            try:
                run_layout(browser, base_url, 1440, 900)
                run_layout(browser, base_url, 390, 844)
                run_layout(browser, base_url, 320, 800, reduced=True)
                run_skip_link(browser, base_url)
                run_mood(browser, base_url, "empathy", "#photorain", "() => document.body.classList.contains('heroEmpathy')")
                run_mood(browser, base_url, "hunger", ".hungerdrag", "() => !!document.querySelector('.hungerdrag') && parseFloat(getComputedStyle(document.querySelector('.mouth')).opacity) > .9", reduced=False)
                run_mood(browser, base_url, "delight", "#party.on", "() => document.body.classList.contains('partyLock') && !!document.querySelector('#discoWrap.on')")
                run_mood(browser, base_url, "love", "#loveScene.on", "() => document.querySelectorAll('.heartEye').length === 2")
                run_time_and_games(browser, base_url)
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print("play browser smoke: PASS (%s)" % ARTIFACTS)


if __name__ == "__main__":
    main()
