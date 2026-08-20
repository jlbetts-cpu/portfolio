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


def new_page(browser, base_url, viewport, reduced=False, mode=None, placeholders=None):
    context = browser.new_context(
        viewport={"width": viewport[0], "height": viewport[1]},
        reduced_motion="reduce" if reduced else "no-preference",
    )
    if mode:
        context.add_init_script(
            "try { sessionStorage.setItem('jbHeroTimeMode', %r); } catch (_) {}" % mode,
        )
    if placeholders:
        # Before the page boots, so these heads are boot-seated and carry
        # data-hm-boot-ready -- see MATCH_CROWD.
        context.add_init_script("window.__hmPlaceholderCount = %d;" % placeholders)
    boot_probe(context)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("response", lambda response: errors.append("HTTP %s %s" % (response.status, response.url)) if response.status >= 400 and "/images/preview/" not in response.url else None)
    page.goto(base_url + "/play.html?wraf=1", wait_until="domcontentloaded")
    page.wait_for_selector('body[data-play-ready="true"]', timeout=20_000)
    page.wait_for_function("window.__playBootSnapshot !== null", timeout=10_000)
    page.wait_for_function(
        "parseFloat(getComputedStyle(document.querySelector('#stage')).opacity) > .99",
        timeout=4_000,
    )
    return context, page, errors


# ONE, NOT FIVE. The default was the placeholder crowd's old size. Jayden, after
# weighing hiding the crowd behind an off-by-default toggle: "keep it on at default --
# but can we only show one coloured egghead, not all of them." Five satisfied "the page
# must not look empty"; it spent the reveal a visitor gets when they cut out their own
# face. One satisfies both.
# EVERY OTHER ASSERTION IN THIS FUNCTION IS UNCHANGED and still meaningful at n=1: the
# head must paint, the throw must run (throwing + queued == expected), and every seated
# head must reach data-hm-lobby-throw="settled". Measured on the live page the snapshot
# now reads {count: 1, painted: true, throwState: "active", throwing: 1, queued: 0}.
def assert_seated(page, expected=1):
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
        if len(visible) > 1:
            # THE SPREAD TEST ONLY MEANS ANYTHING FOR A CROWD. It existed to catch five
            # placeholders piling up in one spot on a phone; with one head the span is 0
            # by definition, so asserting it would be asserting nothing and failing.
            centers = sorted((item["left"] + item["right"]) / 2 for item in visible)
            assert centers[-1] - centers[0] >= page.viewport_size["width"] * .55, visible
        else:
            # What is worth asserting about ONE head is that the whole of it is on screen.
            # This is strictly stronger than the right>0 / left<width test above, which only
            # requires it to overlap the viewport, and it is the failure that would actually
            # show: a lone head half off the edge reads as a bug rather than as a hint.
            # It is not asserted to be CENTRED, deliberately -- play-engine.js:978 seats a
            # single boot head on the arena's axis and then it walks, like every other head.
            assert all(0 <= item["left"] and item["right"] <= page.viewport_size["width"] for item in visible), visible


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
    page.wait_for_function("!document.querySelector('.hmCamPunch')&&!document.querySelector('.hmGoalHit')", timeout=2_000)
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
        assert rect["left"] >= arena["left"] - 1 and rect["right"] <= arena["right"] + 1, (label, rect, arena)
        assert rect["top"] >= arena["top"] - 1 and rect["bottom"] <= arena["bottom"] + 1, (label, rect, arena)
    # Goal bottoms share the same flat line when the authored planet arc is at
    # its neutral edge; never permit a stale lobby line below the arena plane.
    assert all(abs(goal["bottom"] - second["plane"]) <= 2 for goal in second["goals"]), (label, second)


def assert_settled_soccer_contacts(page, label):
    # Soccer is intentionally lively. The opt-in browser hook seats each real
    # companion closure through survey() and parks the real private ball model;
    # production hit-stop holds both while the normal render loop paints them.
    ready = page.evaluate("""() => {const ordinary=(window.__peers||[]).filter(peer=>!peer.__filler);if(!ordinary.length||ordinary.some(peer=>typeof peer.__settleProbe!=='function')||typeof window.__hmSoccerSettleProbe!=='function')return false;ordinary.forEach(peer=>peer.__settleProbe());if(!window.__hmSoccerSettleProbe())return false;window.__hmFreeze=Math.max(window.__hmFreeze||0,performance.now()+1000);return true;}""")
    assert ready, label

    def sample():
        return page.evaluate(
            """
            () => {const hero=document.querySelector('.hero'),hr=hero.getBoundingClientRect(),plane=hr.top+(window.__hmFeetY||0),ratios=window.__settledFootRatios||(window.__settledFootRatios={}),peerBySlot={};(window.__peers||[]).forEach(peer=>peerBySlot[String(peer.slot)]=peer);const footOf=e=>{const slot=e.getAttribute('data-hm-lobby-slot');if(ratios[slot])return ratios[slot];try{const img=e.querySelector('img'),cv=document.createElement('canvas');cv.width=36;cv.height=44;const cx=cv.getContext('2d');cx.drawImage(img,0,0,36,44);const d=cx.getImageData(0,0,36,44).data;for(let row=43;row>=0;row--){for(let col=0;col<36;col++){if(d[(row*36+col)*4+3]>40)return ratios[slot]=(row+1)/44;}}}catch(_){}return ratios[slot]=.945;};const players=Array.from(document.querySelectorAll('#playArena [data-hm-boot-ready]')).filter(e=>e.getAttribute('data-hm-lobby-slot')!=='9001').map(e=>{const r=e.getBoundingClientRect(),slot=e.getAttribute('data-hm-lobby-slot'),peer=peerBySlot[slot];return {slot,left:r.left,top:r.top,feet:r.top+r.height*footOf(e),ground:!!(peer&&peer.ground)};});const br=document.querySelector('.hmBall').getBoundingClientRect();return {phase:window.__hmSoccer&&window.__hmSoccer.phase,plane,players,ballBottom:br.bottom};}
            """
        )

    page.wait_for_timeout(50)
    first = sample()
    page.wait_for_timeout(120)
    second = sample()
    prior = {item["slot"]: item for item in first["players"]}
    checked = []
    for item in second["players"]:
        previous = prior.get(item["slot"])
        grounded = bool(previous) and previous["ground"] and item["ground"]
        jumping = not previous or abs(item["top"] - previous["top"]) > .5
        unchanged = bool(previous) and abs(item["left"] - previous["left"]) <= .5 and abs(item["top"] - previous["top"]) <= .5
        checked.append({**item, "grounded": grounded, "jumping": jumping, "unchanged": unchanged})
    assert second["phase"] == "play" and first["players"] and len(first["players"]) == len(second["players"]) == len(checked), (label, first, second, checked)
    assert all(item["grounded"] and not item["jumping"] and item["unchanged"] for item in checked), (label, "ordinary player moved", first, second, checked)
    assert all(abs(item["feet"] - second["plane"]) <= 2 for item in checked), (label, "ordinary player off plane", second, checked)
    assert abs(second["ballBottom"] - second["plane"]) <= 2, (label, "resting ball", second)


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
            ,surfaces: ['#moodBtn'].map(selector => getComputedStyle(document.querySelector(selector)).backgroundColor)
            /* THE BAR'S GROUND MOVED OFF .jbNav. On the band pages header.css
               §0b gives the nav its skin back and puts the opaque ground on
               .jbStick -- so reading .jbNav alone now reports rgba(0,0,0,0) and
               says "transparent header" about a header that is solid white.
               play.html joined those pages on 2026-08-20. What has to stay true
               is that the BAR is opaque, wherever the ground lives, so this
               reads whichever of the two carries it. */
            ,barGround: (() => {
              for (const sel of ['.jbStick', '.jbNav']) {
                const node = document.querySelector(sel);
                if (!node) continue;
                const bg = getComputedStyle(node).backgroundColor;
                if (!(bg.startsWith('rgba(') && bg.endsWith(', 0)'))) return sel + ' ' + bg;
              }
              return null;
            })()
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
    # and the bar is opaque somewhere -- content must not ghost through it
    assert data["barGround"], data
    if width <= 390:
        # ---- ONE COLUMN UNDER 560px, AND IT IS THE SAME INSTRUCTION, NOT A REVERSAL.
        # "Two on top, two on the bottom, so we can make them bigger" was measured at
        # 1440, where a second column takes a card from 291px to 594px. Under 560 it
        # does the opposite: measured, the two-up column is 167px at 390 and 132px at
        # 320, where "Make a gradient" WRAPS TO TWO LINES and no card has room for the
        # sentence every wider viewport gets. One column is 342px and 272px -- wider
        # than the 252px two-up card that already carries its description -- so the
        # label fits on one line and the description comes back.
        # The card is still a CARD (icon over label over sentence), not a list row, so
        # the four doors are one object at every width and only their measure changes.
        assert data["columns"] == 1, data
        assert data["games"]["left"] >= -1 and data["games"]["right"] <= width + 1 and data["games"]["width"] <= width + 1, data
        assert data["cardsBounds"]["left"] >= -1 and data["cardsBounds"]["right"] <= width + 1, data
        assert all(card["left"] >= -1 and card["right"] <= width + 1 for card in data["cardBounds"]), data
        assert 12 <= data["h1Cta"] <= 16, data
        assert 6 <= data["ctaStage"] <= 10, data
        assert data["stage"]["width"] >= (250 if width == 320 else 300), data
    else:
        # TWO ON TOP, TWO ON THE BOTTOM AT EVERY WIDTH NOW. Jayden: "I think making the
        # menu for the games -- it should be like two on the top, two on the bottom, so we
        # can make them bigger." The phone already used two columns, so this branch is no
        # longer the odd one out; the assertion stays split because the narrow branch
        # carries five more checks the wide one does not.
        assert data["columns"] == 2, data
        # ...and the cards still sit on the SITE COLUMN, which is the constraint the
        # column count could quietly have broken. Measured 120 / 40 at 1440 / 1280.
        gutter = (width - 1200) / 2 if width >= 1280 else None
        if gutter is not None:
            assert abs(data["cardsBounds"]["left"] - gutter) <= 1, data
            assert abs((width - data["cardsBounds"]["right"]) - gutter) <= 1, data
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


MATCH_CROWD = 5
"""How many heads a MATCH test needs on the field, seated at boot.

THE PLACEHOLDER COUNT IS NO LONGER THE GAME ROSTER, and that separation is why this
constant exists. It used to be five, which happened to be enough bodies for the soccer
assertions below to measure what they were written to measure. Jayden has since cut the
lobby to one head ("can we only show one coloured egghead, not all of them") -- a decision
about the first impression of the LOBBY that says nothing about how a match should behave.
Left alone, assert_settled_soccer_contacts started failing on a one-player match, and for
a reason that is true rather than incidental: with nobody to stop the first goal the match
never settles into the "play" phase at all.
Adding heads after load does not work either -- the sampler reads
`#playArena [data-hm-boot-ready]`, an attribute only boot-seated heads carry -- so the
count is set BEFORE the page boots, through play-games.js's own __hmPlaceholderCount.
The lobby's real default (1) is still exercised by every layout and theme run in this file.
"""


def run_soccer_entry(browser, base_url, viewport, mode, picker):
    context, page, errors = new_page(browser, base_url, viewport, mode=mode, placeholders=MATCH_CROWD)
    assert_seated(page, MATCH_CROWD)
    assert page.locator("#heroTimeClip,#heroTimeBtn,#heroTimeMenu,[data-time-gradient],#heroTimePortraitCast").count() == 0
    expected_theme = "dark" if mode == "night" else "light"
    page.wait_for_function("theme => document.documentElement.dataset.theme === theme", arg=expected_theme)
    page.locator("#workBtn").click()
    page.wait_for_timeout(850)
    prelaunch = page.evaluate("""() => {const h=getComputedStyle(document.querySelector('.jbStick')),f=getComputedStyle(document.querySelector('.siteFoot'));return {x:scrollX,y:scrollY,header:{visibility:h.visibility,pointerEvents:h.pointerEvents},footer:f.display}}""")
    page.evaluate("""() => {window.__ownerMutations=[];const push=value=>{value=value||'';if(window.__ownerMutations.at(-1)!==value)window.__ownerMutations.push(value);};new MutationObserver(records=>{records.forEach(record=>push(record.oldValue));push(document.body.dataset.playViewportOwners||'');}).observe(document.body,{attributes:true,attributeOldValue:true,attributeFilter:['data-play-viewport-owners']});}""")
    launch = "pcExped" if picker else "workBtn"
    if picker:
        page.locator("#pcExped").focus()
        page.locator("#pcExped").dispatch_event("click")
        page.wait_for_selector("body.pTeamOn")
        assert_viewport_owner(page, "picker")
        page.evaluate("window.__ownerMutations=[]")
        page.locator(".pBtnGo").click()
    else:
        page.locator("#soccerGo").dispatch_event("click")
    page.wait_for_selector("body.hmSoccer")
    assert_viewport_owner(page, "soccer")
    if picker:
        transitions = page.evaluate("window.__ownerMutations.slice()")
        assert transitions[0] == "picker" and transitions[-1] == "soccer", transitions
        assert all(transitions), transitions
    assert_settled_soccer_contacts(page, "%s-%s-%s-entry" % (viewport[0], mode, "picker" if picker else "menu"))
    assert_soccer_plane(page, "%s-%s-%s-direct" % (viewport[0], mode, "picker" if picker else "menu"))

    reversed_width = 390 if viewport[0] > 390 else 1440
    reversed_height = 844 if reversed_width == 390 else 900
    page.set_viewport_size({"width": reversed_width, "height": reversed_height})
    page.wait_for_timeout(180)
    assert_viewport_owner(page, "soccer")
    assert_settled_soccer_contacts(page, "%s-%s-%s-resized" % (viewport[0], mode, "picker" if picker else "menu"))
    assert_soccer_plane(page, "%s-%s-%s-resized" % (viewport[0], mode, "picker" if picker else "menu"))
    page.set_viewport_size({"width": viewport[0], "height": viewport[1]})
    page.wait_for_timeout(180)
    assert_viewport_owner(page, "soccer")

    page.locator('.hmScoreEnd[aria-label="End the match"]').click()
    page.wait_for_function("!document.body.classList.contains('hmSoccer')")
    page.wait_for_function("!document.body.classList.contains('playViewportOwned')")
    page.wait_for_function("id => document.activeElement&&document.activeElement.id===id", arg=launch)
    restored = page.evaluate("""() => {const h=getComputedStyle(document.querySelector('.jbStick')),f=getComputedStyle(document.querySelector('.siteFoot'));return {x:scrollX,y:scrollY,focus:document.activeElement&&document.activeElement.id,owners:document.body.dataset.playViewportOwners||'',header:{visibility:h.visibility,pointerEvents:h.pointerEvents},footer:f.display}}""")
    assert restored["owners"] == "" and restored["focus"] == launch, restored
    assert abs(restored["x"] - prelaunch["x"]) <= 1 and abs(restored["y"] - prelaunch["y"]) <= 1, (prelaunch, restored)
    assert restored["header"] == prelaunch["header"] and restored["footer"] == prelaunch["footer"], (prelaunch, restored)
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


def run_battle_and_race_reversals(browser, base_url):
    context, page, errors = new_page(browser, base_url, (390, 844), mode="off")
    assert_seated(page)
    page.locator("#workBtn").click()
    page.wait_for_timeout(850)

    for owner, focus_id, enter_js, exit_action in (
        (
            "battle", "pcGrad",
            """() => {window.PlayViewportOwner.enter('battle');window.__hmBattleReq=performance.now();document.body.classList.add('hmBattle');if(window.__hmNewArena)window.__hmNewArena();}""",
            lambda: page.locator('.hmScoreEnd[aria-label="End the battle"]').click(),
        ),
        (
            "race", "pcHead",
            """() => {window.__hmRaceStart();}""",
            lambda: page.evaluate("window.__hmRaceEnd()"),
        ),
    ):
        before = page.evaluate("""() => {const h=getComputedStyle(document.querySelector('.jbStick')),f=getComputedStyle(document.querySelector('.siteFoot'));return {x:scrollX,y:scrollY,header:{visibility:h.visibility,pointerEvents:h.pointerEvents},footer:f.display}}""")
        page.locator("#" + focus_id).focus()
        page.evaluate("y => scrollTo(0,y)", before["y"])
        page.wait_for_function("y => Math.abs(scrollY-y)<=1", arg=before["y"])
        page.evaluate(enter_js)
        page.wait_for_function("name => document.body.dataset.playViewportOwners===name", arg=owner)
        assert_viewport_owner(page, owner)
        exit_action()
        page.wait_for_function("!document.body.classList.contains('playViewportOwned')")
        page.wait_for_function("id => document.activeElement&&document.activeElement.id===id", arg=focus_id)
        page.wait_for_function("y => Math.abs(scrollY-y)<=1", arg=before["y"])
        after = page.evaluate("""() => {const h=getComputedStyle(document.querySelector('.jbStick')),f=getComputedStyle(document.querySelector('.siteFoot'));return {x:scrollX,y:scrollY,focus:document.activeElement&&document.activeElement.id,header:{visibility:h.visibility,pointerEvents:h.pointerEvents},footer:f.display}}""")
        assert abs(after["x"] - before["x"]) <= 1 and abs(after["y"] - before["y"]) <= 1 and after["focus"] == focus_id, (owner, before, after)
        assert after["header"] == before["header"] and after["footer"] == before["footer"], (owner, before, after)

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
                focused = os.environ.get("PLAY_SOCCER_CASE")
                if focused:
                    width, height, mode, route = focused.split(",")
                    run_soccer_entry(browser, base_url, (int(width), int(height)), mode, picker=route == "picker")
                    return
                run_layout(browser, base_url, 1440, 900)
                run_layout(browser, base_url, 390, 844)
                run_layout(browser, base_url, 320, 800, reduced=True)
                run_skip_link(browser, base_url)
                run_mood(browser, base_url, "empathy", "#photorain", "() => document.body.classList.contains('heroEmpathy')")
                run_mood(browser, base_url, "hunger", ".hungerdrag", "() => !!document.querySelector('.hungerdrag') && parseFloat(getComputedStyle(document.querySelector('.mouth')).opacity) > .9", reduced=False)
                run_mood(browser, base_url, "delight", "#party.on", "() => document.body.classList.contains('partyLock') && !!document.querySelector('#discoWrap.on')")
                run_mood(browser, base_url, "love", "#loveScene.on", "() => document.querySelectorAll('.heartEye').length === 2")
                for viewport in ((1440, 900), (390, 844), (320, 800)):
                    for mode in ("off", "night"):
                        for picker in (False, True):
                            run_soccer_entry(browser, base_url, viewport, mode, picker=picker)
                run_picker_and_tournament_ownership(browser, base_url)
                run_battle_and_race_reversals(browser, base_url)
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print("play browser smoke: PASS (%s)" % ARTIFACTS)


if __name__ == "__main__":
    main()
