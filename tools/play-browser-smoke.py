#!/usr/bin/env python3
"""Real-browser smoke checks for Play's minimal production changes."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = Path(os.environ.get("PLAY_THEME_ARTIFACTS", "/tmp/play-theme-task7"))


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


def boot_probe(context):
    context.add_init_script(
        """
        window.__playBootSnapshot = null;
        addEventListener("DOMContentLoaded", function () {
          var body = document.body;
          if (!body) return;
          new MutationObserver(function () {
            if (window.__playBootSnapshot || body.classList.contains("playBooting")) return;
            var nodes = Array.from(document.querySelectorAll("#playArena [data-hm-boot-ready]"));
            window.__playBootSnapshot = {
              count: nodes.length,
              painted: nodes.every(function (node) {
                var img = node.querySelector("img");
                return img && img.complete && img.naturalWidth > 0;
              }),
              opaque: nodes.every(function (node) {
                var css = getComputedStyle(node);
                return css.opacity === "1" && css.filter === "none";
              }),
              styles: nodes.map(function (node) {
                var css = getComputedStyle(node);
                return {opacity: css.opacity, filter: css.filter};
              }),
              firstState: window.__hmC && window.__hmC.get ? window.__hmC.get().st : null
            };
          }).observe(body, {attributes: true, attributeFilter: ["class"]});
        });
        """
    )


def wait_ready(page):
    page.wait_for_selector('body[data-play-ready="true"]', timeout=20_000)
    page.wait_for_function("window.__playBootSnapshot !== null", timeout=10_000)


def assert_seated(page, expected):
    snap = page.evaluate("window.__playBootSnapshot")
    assert snap["count"] == expected, snap
    assert snap["painted"] and snap["opaque"], snap
    assert snap["firstState"] == "idle", snap
    before = page.eval_on_selector_all(
        "#playArena [data-hm-boot-ready]",
        "els => els.map(el => el.getBoundingClientRect().top)",
    )
    page.wait_for_timeout(250)
    after = page.eval_on_selector_all(
        "#playArena [data-hm-boot-ready]",
        "els => els.map(el => el.getBoundingClientRect().top)",
    )
    assert len(before) == expected == len(after)
    assert max(abs(a - b) for a, b in zip(before, after)) < 3, (before, after)


def snap(page, mode, width, height, state):
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    path = ARTIFACTS / f"play-{mode}-{width}x{height}-{state}.png"
    page.screenshot(path=str(path), full_page=False)
    return path


def assert_no_overflow(page, label):
    metrics = page.evaluate(
        """
        () => ({
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth
        })
        """
    )
    assert metrics["scrollWidth"] <= metrics["width"] + 1, (label, metrics)


def assert_contrast(page, foreground, background, minimum=4.5):
    ratio = page.evaluate(
        """
        ([fgSelector, bgSelector]) => {
          const rgb = value => {
            const match = value.match(/[\d.]+/g);
            if (!match) return [0, 0, 0];
            return match.slice(0, 3).map(Number);
          };
          const lum = channels => {
            const linear = channels.map(value => {
              value /= 255;
              return value <= .04045 ? value / 12.92 : Math.pow((value + .055) / 1.055, 2.4);
            });
            return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
          };
          const fg = lum(rgb(getComputedStyle(document.querySelector(fgSelector)).color));
          const bg = lum(rgb(getComputedStyle(document.querySelector(bgSelector)).backgroundColor));
          return (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05);
        }
        """,
        [foreground, background],
    )
    assert ratio >= minimum, (foreground, background, ratio)


def run_theme_state(browser, base_url, mode, width, height):
    context = browser.new_context(viewport={"width": width, "height": height})
    context.add_init_script(
        f"""
        try {{ sessionStorage.setItem("jbHeroTimeMode", "{mode}"); }} catch (_) {{}}
        requestAnimationFrame(function () {{
          window.__playFirstFrame = {{
            theme: document.documentElement.getAttribute("data-theme"),
            mode: document.documentElement.getAttribute("data-theme-mode"),
            background: getComputedStyle(document.documentElement).backgroundColor
          }};
        }});
        """
    )
    boot_probe(context)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.goto(base_url + "/play.html", wait_until="domcontentloaded")
    wait_ready(page)
    page.wait_for_function("window.__playFirstFrame != null")

    expected_theme = "dark" if mode == "night" else "light"
    expected_bg = "rgb(11, 12, 15)" if mode == "night" else "rgb(253, 253, 253)"
    first = page.evaluate("window.__playFirstFrame")
    assert first == {"theme": expected_theme, "mode": mode, "background": expected_bg}, first
    assert page.evaluate("document.documentElement.dataset.theme") == expected_theme
    assert page.evaluate("document.documentElement.dataset.themeMode") == mode
    assert page.evaluate("getComputedStyle(document.body).backgroundColor") == expected_bg

    # Hub and Add-your-head-first launch surface.
    hub = page.evaluate(
        """
        () => ({
          cards: Array.from(document.querySelectorAll('.pCards > .pCard')).map(card => card.id),
          reachable: Array.from(document.querySelectorAll('.pCards > .pCard')).every(card => {
            const r = card.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return hit && hit.closest('.pCard') === card;
          }),
          headSurface: getComputedStyle(document.querySelector('#pcHead')).backgroundColor,
          regularSurface: getComputedStyle(document.querySelector('#pcExped')).backgroundColor
        })
        """
    )
    assert hub["cards"] == ["pcHead", "pcExped", "pcTour", "pcGrad"], hub
    assert hub["reachable"], hub
    if mode == "night":
        assert hub["headSurface"] == "rgb(23, 26, 33)", hub
        assert hub["regularSurface"] == "rgb(17, 19, 24)", hub
    else:
        assert hub["headSurface"] == "rgb(255, 255, 255)", hub
        assert hub["regularSurface"] == "rgb(255, 255, 255)", hub
    assert_contrast(page, ".pCardT", ".pCard")
    assert_contrast(page, ".pCardD", ".pCard")
    assert_no_overflow(page, f"{mode}-{width}-hub")
    snap(page, mode, width, height, "hub")

    page.locator("#contact").scroll_into_view_if_needed()
    assert page.locator("#contact").is_visible()
    assert_contrast(page, ".footReach", "body")
    assert_no_overflow(page, f"{mode}-{width}-footer")
    snap(page, mode, width, height, "footer")
    page.evaluate("scrollTo(0, 0)")

    # Team picker/setup remains reachable and owns the viewport.
    page.locator("#pcExped").dispatch_event("click")
    page.wait_for_selector("body.pTeamOn")
    picker = page.evaluate(
        """
        () => {
          const panel = document.querySelector('.pTeamIn').getBoundingClientRect();
          return {
            overflow: getComputedStyle(document.body).overflowY,
            left: panel.left,
            right: panel.right,
            bottom: panel.bottom,
            surface: getComputedStyle(document.querySelector('.pTeamIn')).backgroundColor
          };
        }
        """
    )
    assert picker["overflow"] == "hidden", picker
    assert picker["left"] >= -1 and picker["right"] <= width + 1 and picker["bottom"] <= height + 1, picker
    assert picker["surface"] == ("rgb(17, 19, 24)" if mode == "night" else "rgb(255, 255, 255)"), picker
    assert_contrast(page, ".pTeamHint", ".pTeamIn")
    assert_no_overflow(page, f"{mode}-{width}-picker")
    snap(page, mode, width, height, "picker")

    # Start a real match, then exercise the live, goal-flash, and match-end states.
    page.locator(".pBtnGo").click()
    page.wait_for_selector("body.hmSoccer", timeout=10_000)
    page.wait_for_selector(".hmScore .sbCard", state="visible", timeout=10_000)
    page.wait_for_timeout(500)
    board = page.evaluate(
        """
        () => {
          const card = document.querySelector('.hmScore .sbCard');
          const score = document.querySelector('.hmScore');
          const r = card.getBoundingClientRect();
          const before = getComputedStyle(score, '::before');
          return {
            left: r.left, right: r.right, top: r.top, bottom: r.bottom,
            background: getComputedStyle(card).backgroundColor,
            shadow: getComputedStyle(card).boxShadow,
            backingContent: before.content,
            backingZ: before.zIndex
          };
        }
        """
    )
    assert board["left"] >= -1 and board["right"] <= width + 1, board
    if mode == "night":
        assert board["background"] == "rgb(17, 19, 24)", board
        assert board["backingContent"] == '""' and board["backingZ"] == "-1", board
    else:
        assert board["backingContent"] == "none", board
    assert_contrast(page, ".sbNm", ".sbCard")
    assert_no_overflow(page, f"{mode}-{width}-live")
    snap(page, mode, width, height, "live")

    page.evaluate(
        """
        () => {
          const score = document.querySelector('.hmScore');
          score.style.setProperty('--sbFlash', '224,90,78');
          score.classList.add('sbHit');
        }
        """
    )
    page.wait_for_timeout(90)
    flash = page.evaluate(
        """
        () => ({
          shadow: getComputedStyle(document.querySelector('.hmScore .sbCard')).boxShadow,
          background: getComputedStyle(document.querySelector('.hmScore .sbCard')).backgroundColor,
          score: document.querySelector('.sbScore').textContent
        })
        """
    )
    assert flash["shadow"] != board["shadow"], (board, flash)
    assert flash["score"] != "", flash
    if mode == "night":
        assert flash["background"] == "rgb(17, 19, 24)", flash
    snap(page, mode, width, height, "goal-flash")

    page.evaluate(
        """
        () => {
          const score = document.querySelector('.hmScore');
          score.classList.remove('sbHit');
          score.classList.add('won');
          const call = document.querySelector('.hmCount');
          call.textContent = 'Red wins!';
          call.classList.add('hmMsg', 'hmCountPulse');
        }
        """
    )
    page.wait_for_timeout(100)
    assert page.locator(".hmScore.won").count() == 1
    assert page.locator(".hmCount.hmMsg").count() == 1
    assert_no_overflow(page, f"{mode}-{width}-match-end")
    snap(page, mode, width, height, "match-end")
    page.locator(".hmScore .hmScoreEnd").click()
    page.wait_for_selector("body:not(.hmSoccer)")

    # Real tournament bracket, mobile draw sheet, then a result-state specimen
    # using the production classes generated by play-tournament.js.
    page.evaluate("window.__hmTourStart()")
    page.wait_for_selector("body.hmTour", timeout=20_000)
    page.wait_for_selector("#tvScreen:not([hidden])", timeout=20_000)
    page.wait_for_selector("body:not(.pHubOn)", timeout=5_000)
    page.wait_for_timeout(400)
    assert_contrast(page, ".tvName", "body")
    assert_no_overflow(page, f"{mode}-{width}-tournament")
    snap(page, mode, width, height, "tournament")
    if width <= 760:
        page.locator(".tvChipDraw").click()
        page.wait_for_selector("body.tvBoardOpen")
        panel = page.locator(".tvSheetPanel").bounding_box()
        assert panel and panel["x"] >= -1 and panel["x"] + panel["width"] <= width + 1, panel
        assert_contrast(page, ".tvSheetTitle", ".tvSheetPanel")
        assert_no_overflow(page, f"{mode}-{width}-draw-sheet")
        snap(page, mode, width, height, "draw-sheet")
        page.locator(".tvSheetPanel .tvChip").click()
        page.wait_for_selector("body:not(.tvBoardOpen)")
        page.wait_for_timeout(400)

    page.evaluate(
        """
        () => {
          const host = document.querySelector('#tvScreen');
          const cut = document.querySelector('.tvFace img')?.src || '';
          host.innerHTML = '<div class="tvBody tvDone">'
            + '<section class="tvFixture tvFixtureDone"><div class="tvChampWrap">'
            + '<div class="tvChampHead">' + (cut ? '<img alt="" src="' + cut + '">' : '') + '</div>'
            + '</div><h2 class="tvChampNm">Red wins the cup</h2></section>'
            + '<aside class="tvRail"><div class="tvBoardHd">Final standings</div>'
            + '<div class="tvStandGrid"><div class="tvStandRow"><span class="tvStandRk">1</span>'
            + '<span class="tvStandNm">Red</span><span class="tvStandOut">Champion</span>'
            + '</div></div></aside></div>';
        }
        """
    )
    page.wait_for_timeout(600)
    assert_contrast(page, ".tvChampNm", "body")
    assert_no_overflow(page, f"{mode}-{width}-result")
    snap(page, mode, width, height, "result")

    # Manual mode survives a real reload and still resolves before the first frame.
    page.reload(wait_until="domcontentloaded")
    wait_ready(page)
    assert page.evaluate("document.documentElement.dataset.themeMode") == mode
    assert page.evaluate("document.documentElement.dataset.theme") == expected_theme
    assert page.evaluate("getComputedStyle(document.body).backgroundColor") == expected_bg
    assert not errors, errors
    context.close()


def run_theme_matrix(browser, base_url):
    for mode in ("off", "night"):
        for width, height in ((1280, 900), (390, 844), (320, 800)):
            run_theme_state(browser, base_url, mode, width, height)

    # Reduced motion removes the goal pulse while leaving the rendered score intact.
    context = browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
    context.add_init_script('sessionStorage.setItem("jbHeroTimeMode", "night")')
    page = context.new_page()
    page.goto(base_url + "/play.html", wait_until="domcontentloaded")
    page.wait_for_selector('body[data-play-ready="true"]', timeout=20_000)
    page.evaluate(
        """
        () => {
          const score = document.createElement('div');
          score.className = 'hmScore sbHit';
          score.innerHTML = '<div class="sbCard"><span class="sbScore">0 – 0</span></div>';
          document.body.appendChild(score);
        }
        """
    )
    reduced = page.evaluate(
        """
        () => ({
          animation: getComputedStyle(document.querySelector('.sbCard')).animationName,
          score: document.querySelector('.sbScore').textContent,
          display: getComputedStyle(document.querySelector('.sbCard')).display
        })
        """
    )
    assert reduced["animation"] == "none" and reduced["score"] != "" and reduced["display"] != "none", reduced
    context.close()


def run_desktop(browser, base_url):
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    boot_probe(context)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(base_url + "/play.html", wait_until="domcontentloaded")
    wait_ready(page)
    assert_seated(page, 5)

    layout = page.evaluate(
        """
        () => ({
          cards: Array.from(document.querySelectorAll(".pCards>.pCard")).map(el => el.id),
          heroH: document.querySelector("#playArena").getBoundingClientRect().height,
          viewportH: document.querySelector(".playViewport").getBoundingClientRect().height,
          hubPosition: getComputedStyle(document.querySelector("#pHub")).position,
          footerTop: document.querySelector("#contact").getBoundingClientRect().top,
          scrollH: document.documentElement.scrollHeight,
          selectorCount: document.querySelectorAll(".pArenaFrame,.pModeDock,.pModeRail").length
        })
        """
    )
    assert layout["cards"] == ["pcHead", "pcExped", "pcTour", "pcGrad"], layout
    assert abs(layout["heroH"] - 540) < 2, layout
    assert abs(layout["viewportH"] - 900) < 2, layout
    assert layout["hubPosition"] == "absolute" and layout["selectorCount"] == 0, layout
    assert layout["footerTop"] > 900 and layout["scrollH"] > 1050, layout

    page.locator("#contact").scroll_into_view_if_needed()
    scrolled = page.evaluate(
        """
        () => ({
          footerTop: document.querySelector("#contact").getBoundingClientRect().top,
          hubBottom: document.querySelector("#pHub").getBoundingClientRect().bottom,
          y: scrollY
        })
        """
    )
    assert scrolled["y"] > 0 and scrolled["footerTop"] < 900, scrolled
    assert scrolled["hubBottom"] < 900, scrolled

    # Open the original team picker from the footer offset without Playwright scrolling the
    # off-screen card into view. The picker owns the viewport and must pin the arena at top.
    page.locator("#pcExped").dispatch_event("click")
    page.wait_for_selector("body.pTeamOn")
    picker = page.evaluate(
        """
        () => ({
          overflow: getComputedStyle(document.body).overflowY,
          scrollY: scrollY
        })
        """
    )
    assert picker == {"overflow": "hidden", "scrollY": 0}, picker
    page.evaluate("scrollTo(0, document.documentElement.scrollHeight)")
    page.wait_for_timeout(50)
    assert page.evaluate("scrollY") == 0

    # Closing the picker restores the footer's normal document scroll.
    page.locator(".pBtnBack").click()
    page.wait_for_selector("body:not(.pTeamOn)")
    assert page.evaluate("getComputedStyle(document.body).overflowY") == "auto"
    page.locator("#contact").scroll_into_view_if_needed()
    before_launch = page.evaluate("scrollY")
    assert before_launch > 0, before_launch

    # Launch the match from that footer offset; there is deliberately no test-side top reset.
    page.locator("#pcExped").dispatch_event("click")
    page.wait_for_selector("body.pTeamOn")
    page.locator(".pBtnGo").click()
    page.wait_for_selector("body.hmSoccer", timeout=10_000)
    launched = page.evaluate(
        """
        () => {
          var arena = document.querySelector("#playArena").getBoundingClientRect();
          return {
            overflow: getComputedStyle(document.body).overflowY,
            scrollY: scrollY,
            arenaTop: arena.top,
            arenaBottom: arena.bottom
          };
        }
        """
    )
    assert launched["overflow"] == "hidden", launched
    assert launched["scrollY"] == 0, launched
    assert launched["arenaTop"] >= 0 and launched["arenaBottom"] <= 900, launched
    assert not errors, errors

    # Saved heads take the same seated boot path, without persisting boot-only flags.
    page.evaluate(
        """
        () => {
          localStorage.setItem("hmCompanions", JSON.stringify([window.__EGGHEAD]));
          localStorage.setItem("hmCompanion", JSON.stringify(window.__EGGHEAD));
        }
        """
    )
    page.reload(wait_until="domcontentloaded")
    wait_ready(page)
    assert_seated(page, 1)
    stored = page.evaluate("JSON.parse(localStorage.getItem('hmCompanions'))[0]")
    assert "__bootSeated" not in stored and "__bootTotal" not in stored

    # A stale saved cutout may satisfy the storage length check but fail image decoding.
    # Play must discard it, seed the usable fallback crowd, and release the boot veil.
    page.evaluate(
        """
        () => {
          var broken = Object.assign({}, window.__EGGHEAD, {
            cut: "data:image/png;base64," + "x".repeat(16000),
            eyes: window.__EGGHEAD.eyes.map(function (eye, index) {
              return Object.assign({}, eye, {x: eye.x + (index + 1) * 0.001});
            })
          });
          localStorage.setItem("hmCompanions", JSON.stringify([broken]));
          localStorage.setItem("hmCompanion", JSON.stringify(broken));
        }
        """
    )
    page.reload(wait_until="domcontentloaded")
    wait_ready(page)
    assert_seated(page, 5)
    recovered = page.evaluate(
        """
        () => ({
          saved: JSON.parse(localStorage.getItem("hmCompanions") || "[]").length,
          fallbacks: window.__hmPlaceholders ? window.__hmPlaceholders().length : 0
        })
        """
    )
    assert recovered == {"saved": 0, "fallbacks": 5}, recovered

    # A broken sibling must not make recovery evict a valid saved head that is still usable.
    page.evaluate(
        """
        () => {
          var broken = Object.assign({}, window.__EGGHEAD, {
            cut: "data:image/png;base64," + "x".repeat(16000),
            eyes: window.__EGGHEAD.eyes.map(function (eye, index) {
              return Object.assign({}, eye, {x: eye.x + (index + 1) * 0.001});
            })
          });
          localStorage.setItem("hmCompanions", JSON.stringify([broken, window.__EGGHEAD]));
          localStorage.setItem("hmCompanion", JSON.stringify(window.__EGGHEAD));
        }
        """
    )
    page.reload(wait_until="domcontentloaded")
    wait_ready(page)
    assert_seated(page, 1)
    preserved = page.evaluate(
        """
        () => ({
          saved: JSON.parse(localStorage.getItem("hmCompanions") || "[]").length,
          cut: JSON.parse(localStorage.getItem("hmCompanions") || "[]")[0].cut,
          expected: window.__EGGHEAD.cut
        })
        """
    )
    assert preserved["saved"] == 1 and preserved["cut"] == preserved["expected"], preserved
    assert not errors, errors
    context.close()


def run_mobile(browser, base_url):
    context = browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
    boot_probe(context)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(base_url + "/play.html", wait_until="domcontentloaded")
    wait_ready(page)
    assert_seated(page, 5)
    mobile = page.evaluate(
        """
        () => ({
          cards: Array.from(document.querySelectorAll(".pCards>.pCard")).map(el => el.id),
          heroH: document.querySelector("#playArena").getBoundingClientRect().height,
          viewportH: document.querySelector(".playViewport").getBoundingClientRect().height,
          columns: getComputedStyle(document.querySelector(".pCards")).gridTemplateColumns.split(" ").length,
          scrollH: document.documentElement.scrollHeight,
          scrollW: document.documentElement.scrollWidth,
          hubTransition: getComputedStyle(document.querySelector("#pHub")).transitionDuration
        })
        """
    )
    assert mobile["cards"][0] == "pcHead" and mobile["columns"] == 2, mobile
    assert abs(mobile["heroH"] - 844 * 0.57) < 3, mobile
    assert abs(mobile["viewportH"] - 844) < 3, mobile
    assert mobile["scrollH"] > 994 and mobile["scrollW"] <= 391, mobile
    assert mobile["hubTransition"] == "0s", mobile
    page.locator("#contact").scroll_into_view_if_needed()
    assert page.locator("#contact").is_visible()
    assert not errors, errors
    context.close()


def main():
    handler = partial(QuietHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_port}"
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            try:
                run_desktop(browser, base_url)
                run_mobile(browser, base_url)
                run_theme_matrix(browser, base_url)
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print(f"play browser smoke: PASS ({ARTIFACTS})")


if __name__ == "__main__":
    main()
