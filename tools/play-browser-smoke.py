#!/usr/bin/env python3
"""Real-browser smoke checks for Play's minimal production changes."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]


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
    page.wait_for_function("window.__playBootSnapshot !== null", timeout=5_000)


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

    # The original card still opens the original team picker and starts the live match.
    page.evaluate("scrollTo(0, 0)")
    page.locator("#pcExped").click()
    page.wait_for_selector("body.pTeamOn")
    page.locator(".pBtnGo").click()
    page.wait_for_selector("body.hmSoccer", timeout=10_000)
    assert page.evaluate("getComputedStyle(document.body).overflowY") == "hidden"
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
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print("play browser smoke: PASS")


if __name__ == "__main__":
    main()
