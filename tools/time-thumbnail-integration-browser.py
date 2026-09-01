#!/usr/bin/env python3
"""Browser matrix for four completed time-aware thumbnail sets."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SHOTS = Path("/tmp/time-thumbnail-integration")
STATES = ("off", "pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night")
PROJECTS = ("bearings", "apollo", "strata", "cluster")
ORIGINALS = {
    "bearings": "images/cs/bearings-cover.webp",
    "apollo": "images/cs/apollo-cover.webp",
    "strata": "images/cs/strata-cover.webp",
    "cluster": "images/cs/cluster/cluster-cover.webp",
}
VIEWPORTS = (("desktop", 1280, 900), ("mobile-390", 390, 844), ("mobile-320", 320, 800))


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


def expected(project, state):
    if state == "off":
        return ORIGINALS[project]
    return f"images/cs/variants/time/{project}/{state}-1200.webp"


def verify_state(page, state):
    page.evaluate("state => window.SiteTheme.setMode(state, {persist:false})", state)
    page.wait_for_function(
        """
        ([projects, originals, state]) => projects.every(project => {
          const nodes = Array.from(document.querySelectorAll(`.csItem[data-slug="${project}"] img.csImg`));
          const expected = state === "off" ? originals[project]
            : `images/cs/variants/time/${project}/${state}-1200.webp`;
          // THE SWAP IS THE CONTRACT; DECODING IS NOT, AND CONFLATING THEM MADE THIS
          // GATE UNPASSABLE. Home puts several projects in more than one tab panel --
          // bearings and apollo sit in Featured AND in Case Studies -- and the copy in
          // the panel that is not open is loading="lazy", so it never fetches and
          // img.complete is never true for it. Requiring that of EVERY matching node
          // meant this could only pass on a layout with no tabs, which home has not had
          // for a long time: it timed out at 20s on a page doing exactly the right thing.
          // Every node must still carry the right src and srcset -- that is what the
          // controller is responsible for -- and only the nodes actually being rendered
          // have to have pixels behind them.
          return nodes.length > 0 && nodes.every(img => {
            const attrs = img.getAttribute("src") === expected &&
              (state === "off" ? !img.hasAttribute("srcset") && !img.hasAttribute("sizes")
                : img.getAttribute("srcset").includes(`${state}-2400.webp 2400w`) && img.hasAttribute("sizes"));
            const shown = img.offsetParent !== null;
            return attrs && (!shown || (img.complete && img.naturalWidth > 0));
          });
        })
        """,
        arg=[PROJECTS, ORIGINALS, state],
        timeout=20_000,
    )
    for project in PROJECTS:
        nodes = page.locator(f'.csItem[data-slug="{project}"] img.csImg')
        assert nodes.count() >= 1
        assert all(nodes.nth(i).get_attribute("src") == expected(project, state) for i in range(nodes.count()))


def run_viewport(browser, base_url, label, width, height):
    context = browser.new_context(viewport={"width": width, "height": height})
    page = context.new_page()
    failures = []
    errors = []
    page.on("requestfailed", lambda request: failures.append(request.url))
    page.on("response", lambda response: failures.append(f"{response.status} {response.url}") if response.status >= 400 else None)
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.goto(base_url + "/index.html", wait_until="domcontentloaded")
    page.wait_for_function("window.HomeTimeThumbnails && window.SiteTheme")

    preserved = page.evaluate(
        """
        projects => Object.fromEntries(projects.map(project => {
          const img = document.querySelector(`.csItem[data-slug="${project}"] img.csImg`);
          return [project, {alt: img.alt, loading: img.loading, decoding: img.decoding}];
        }))
        """,
        PROJECTS,
    )
    for state in STATES:
        verify_state(page, state)
    page.evaluate("document.querySelector('.csTab[data-tab=fun]').click()")
    page.wait_for_selector('.csPanel[data-panel="fun"].on')
    page.screenshot(path=str(SHOTS / f"{label}-night.png"), full_page=True)

    page.evaluate("window.SiteTheme.setMode('automatic', {persist:false})")
    snapshot = page.evaluate("window.SiteTheme.getSnapshot()")
    verify_state(page, snapshot["state"])
    after = page.evaluate(
        """
        projects => Object.fromEntries(projects.map(project => {
          const img = document.querySelector(`.csItem[data-slug="${project}"] img.csImg`);
          return [project, {alt: img.alt, loading: img.loading, decoding: img.decoding}];
        }))
        """,
        PROJECTS,
    )
    assert after == preserved, (preserved, after)
    overflow = page.evaluate("document.documentElement.scrollWidth - innerWidth")
    assert overflow <= 0, (label, overflow)
    assert not failures, failures
    assert not errors, errors
    context.close()


def main():
    SHOTS.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    base_url = f"http://127.0.0.1:{server.server_port}"
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            for viewport in VIEWPORTS:
                run_viewport(browser, base_url, *viewport)
                print(f"{viewport[0]}: 4 projects × 7 states + automatic OK")
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print(f"screenshots: {SHOTS}")


if __name__ == "__main__":
    main()
