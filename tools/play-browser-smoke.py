#!/usr/bin/env python3
"""Real-browser contract for Play's responsive hub and owned game states."""

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


def assert_viewport_owner(page, expected):
    expected = sorted(expected if isinstance(expected, (list, tuple)) else [expected])
    state = page.evaluate(
        """
        () => {
          const body=document.body, arena=document.querySelector('.playViewport');
          const header=document.querySelector('.jbStick'), footer=document.querySelector('.siteFoot');
          const hs=getComputedStyle(header), fs=getComputedStyle(footer), a=arena.getBoundingClientRect();
          return {
            owners:(body.dataset.playViewportOwners||'').split(/\s+/).filter(Boolean).sort(),
            active:body.classList.contains('playViewportOwned'),
            overflow:getComputedStyle(body).overflowY,
            arena:{top:a.top,left:a.left,position:getComputedStyle(arena).position},
            header:{visibility:hs.visibility,pointerEvents:hs.pointerEvents},
            footerDisplay:fs.display
          };
        }
        """
    )
    assert state["owners"] == expected and state["active"], state
    assert state["overflow"] == "hidden" and state["arena"]["position"] == "fixed", state
    assert abs(state["arena"]["top"]) <= 1 and abs(state["arena"]["left"]) <= 1, state
    assert state["header"] == {"visibility": "hidden", "pointerEvents": "none"}, state
    assert state["footerDisplay"] == "none", state


def assert_soccer_plane(page, label, require_players=True):
    def sample():
        return page.evaluate(
            """
            () => {
              const hero=document.querySelector('.hero'), hr=hero.getBoundingClientRect();
              const plane=hr.top+(window.__hmFeetY||0);
              const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&parseFloat(s.opacity||'1')>.05&&r.width>0&&r.height>0};
              const footOf=e=>{try{const img=e.querySelector('img'),cv=document.createElement('canvas');cv.width=36;cv.height=44;const cx=cv.getContext('2d');cx.drawImage(img,0,0,36,44);const d=cx.getImageData(0,0,36,44).data;for(let row=43;row>=0;row--){for(let col=0;col<36;col++){if(d[(row*36+col)*4+3]>40)return (row+1)/44;}}}catch(_){}return .945;};
              const players=Array.from(document.querySelectorAll('#playArena [data-hm-boot-ready]'))
                .filter(visible).filter(e=>e.getAttribute('data-hm-lobby-slot')!=='9001').map(e=>{const r=e.getBoundingClientRect();return {slot:e.getAttribute('data-hm-lobby-slot'),left:r.left,right:r.right,top:r.top,bottom:r.bottom,feet:r.top+r.height*footOf(e)};});
              const goals=Array.from(document.querySelectorAll('.hmGoal')).filter(visible).map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};});
              const ball=document.querySelector('.hmBall'), br=ball&&ball.getBoundingClientRect();
              return {viewport:{w:innerWidth,h:innerHeight},arena:{left:hr.left,right:hr.right,top:hr.top,bottom:hr.bottom},plane,players,goals,ball:br?{left:br.left,right:br.right,top:br.top,bottom:br.bottom}:null};
            }
            """
        )

    first = sample()
    page.wait_for_timeout(120)
    second = sample()
    if require_players:
        assert first["players"] and second["players"], (label, first, second)
    assert len(second["goals"]) == 2 and second["ball"], (label, first, second)
    arena, viewport = second["arena"], second["viewport"]
    assert arena["left"] >= -1 and arena["top"] >= -1 and arena["right"] <= viewport["w"] + 1 and arena["bottom"] <= viewport["h"] + 1, (label, second)
    for rect in second["goals"] + [second["ball"]]:
        assert rect["left"] >= arena["left"] - 2 and rect["right"] <= arena["right"] + 2, (label, rect, arena)
        assert rect["top"] >= arena["top"] - 2 and rect["bottom"] <= arena["bottom"] + 2, (label, rect, arena)
    for rect in second["players"]:
        # Rotating/squashing heads intentionally overhang the 60vh hero pitch,
        # but the fixed owner viewport must keep the full painted box onscreen.
        assert rect["left"] >= -12 and rect["right"] <= viewport["w"] + 12, (label, rect, viewport)
        assert rect["top"] >= -12 and rect["bottom"] <= viewport["h"] + 12, (label, rect, viewport)
    # Do not mistake a rotating/jumping player's axis-aligned box for its
    # contact point. Only unchanged ordinary players prove the resting plane.
    prior = {player["slot"]: player for player in first["players"]}
    settled = [player for player in second["players"] if player["slot"] in prior
               and abs(player["feet"] - prior[player["slot"]]["feet"]) <= 1
               and abs(player["left"] - prior[player["slot"]]["left"]) <= 1]
    assert all(player["feet"] <= second["plane"] + 12 for player in second["players"]), (label, second)
    assert all(abs(player["feet"] - second["plane"]) <= 2 for player in settled), (label, settled, second)
    # Goal bottoms share the same flat line when the authored planet arc is at
    # its neutral edge; never permit a stale lobby line below the arena plane.
    assert all(abs(goal["bottom"] - second["plane"]) <= 2 for goal in second["goals"]), (label, second)


def run_layout(browser, base_url, width, height, reduced=False):
    context, page, errors = new_page(browser, base_url, (width, height), reduced=reduced)
    assert_seated(page)
    data = page.evaluate(
        """
        () => {
          const r = s => document.querySelector(s).getBoundingClientRect();
          const hero = r('#playArena'), header = r('.jbStick'), nav = r('.jbNav');
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
            localTimeNodes: document.querySelectorAll('#heroTimeClip,#heroTimeBtn,#heroTimeMenu,[data-time-gradient],#heroTimePortraitCast').length,
            gamesGap: cards.top - hero.bottom,
            h1Cta: ctas.top - h1.bottom,
            ctaStage: stage.top - ctas.bottom,
            radius: getComputedStyle(document.querySelector('#playArena')).borderRadius,
            shadow: getComputedStyle(document.querySelector('#playArena')).boxShadow,
            targets: ['#workBtn','#moodBtn'].map(target),
            stage: {left:stage.left,right:stage.right,width:stage.width},
            games: bounds(games), cardsBounds: bounds(cards),
            cardBounds: Array.from(document.querySelectorAll('.pCards>.pCard')).map(card => bounds(card.getBoundingClientRect())),
            canonical: ['moodbar','moodBtn','moodMenu'].map(id => document.querySelectorAll('#'+id).length),
            gameIds: ['gamebar','gameBtn','gameMenu'].every(id => !!document.getElementById(id)),
            statusHidden: !!document.querySelector('#qdots[aria-live] [aria-hidden="true"]')
            ,surfaces: ['.jbNav','#moodBtn'].map(selector => getComputedStyle(document.querySelector(selector)).backgroundColor)
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
    assert data["localTimeNodes"] == 0, data
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
    page.wait_for_timeout(180)
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


def run_soccer_entry(browser, base_url, viewport, mode, picker):
    context, page, errors = new_page(browser, base_url, viewport, mode=mode)
    assert_seated(page)
    assert page.locator("#heroTimeClip,#heroTimeBtn,#heroTimeMenu,[data-time-gradient],#heroTimePortraitCast").count() == 0
    expected_theme = "dark" if mode == "night" else "light"
    page.wait_for_function("theme => document.documentElement.dataset.theme === theme", arg=expected_theme)
    page.locator("#workBtn").click()
    page.wait_for_timeout(850)
    launch = "pcExped" if picker else "workBtn"
    if picker:
        page.locator("#pcExped").focus()
        page.locator("#pcExped").dispatch_event("click")
        page.wait_for_selector("body.pTeamOn")
        assert_viewport_owner(page, "picker")
        page.locator(".pBtnGo").click()
    else:
        page.locator("#soccerGo").dispatch_event("click")
    page.wait_for_selector("body.hmSoccer")
    assert_viewport_owner(page, "soccer")
    assert_soccer_plane(page, "%s-%s-%s-direct" % (viewport[0], mode, "picker" if picker else "menu"))

    reversed_width = 390 if viewport[0] > 390 else 1440
    reversed_height = 844 if reversed_width == 390 else 900
    page.set_viewport_size({"width": reversed_width, "height": reversed_height})
    page.wait_for_timeout(180)
    assert_viewport_owner(page, "soccer")
    assert_soccer_plane(page, "%s-%s-%s-resized" % (viewport[0], mode, "picker" if picker else "menu"))

    page.locator('.hmScoreEnd[aria-label="End the match"]').click()
    page.wait_for_function("!document.body.classList.contains('hmSoccer')")
    page.wait_for_function("!document.body.classList.contains('playViewportOwned')")
    page.wait_for_function("id => document.activeElement&&document.activeElement.id===id", arg=launch)
    restored = page.evaluate("() => ({focus:document.activeElement&&document.activeElement.id, owners:document.body.dataset.playViewportOwners||''})")
    assert restored["owners"] == "" and restored["focus"] == launch, restored
    assert not errors, errors
    context.close()


def run_picker_and_tournament_ownership(browser, base_url):
    context, page, errors = new_page(browser, base_url, (390, 844), mode="night")
    assert_seated(page)
    page.locator("#workBtn").click()
    page.wait_for_timeout(850)
    before = page.evaluate("scrollY")
    page.locator("#pcExped").focus()
    page.locator("#pcExped").dispatch_event("click")
    page.wait_for_selector("body.pTeamOn")
    assert_viewport_owner(page, "picker")
    page.locator(".pBtnBack").click()
    page.wait_for_function("!document.body.classList.contains('playViewportOwned')")
    page.wait_for_function("y => Math.abs(scrollY-y) <= 2", arg=before)
    assert page.evaluate("document.activeElement&&document.activeElement.id") == "pcExped"

    page.locator("#pcTour").focus()
    page.locator("#pcTour").dispatch_event("click")
    page.wait_for_selector("body.hmTour")
    assert_viewport_owner(page, "tournament")
    page.locator(".tvGo").click()
    page.wait_for_selector("body.hmSoccer")
    assert_viewport_owner(page, ["soccer", "tournament"])
    assert_soccer_plane(page, "390-night-tournament", require_players=False)
    page.locator('.hmScoreEnd[aria-label="End the match"]').click()
    page.wait_for_function("!document.body.classList.contains('hmSoccer')")
    assert_viewport_owner(page, "tournament")
    assert page.evaluate("document.activeElement&&document.activeElement.id") != "pcTour"
    page.evaluate("window.__hmTourStop()")
    page.wait_for_function("!document.body.classList.contains('playViewportOwned')")
    page.wait_for_function("y => Math.abs(scrollY-y) <= 2", arg=before)
    assert page.evaluate("document.activeElement&&document.activeElement.id") == "pcTour"
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
                run_soccer_entry(browser, base_url, (1440, 900), "off", picker=False)
                run_soccer_entry(browser, base_url, (1440, 900), "night", picker=True)
                run_soccer_entry(browser, base_url, (390, 844), "off", picker=False)
                run_soccer_entry(browser, base_url, (390, 844), "night", picker=True)
                run_soccer_entry(browser, base_url, (320, 800), "off", picker=False)
                run_soccer_entry(browser, base_url, (320, 800), "night", picker=True)
                run_picker_and_tournament_ownership(browser, base_url)
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print("play browser smoke: PASS (%s)" % ARTIFACTS)


if __name__ == "__main__":
    main()
