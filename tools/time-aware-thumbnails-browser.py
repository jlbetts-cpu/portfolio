#!/usr/bin/env python3
"""Real-browser matrix for the home page's time-aware case-study thumbnails."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SHOTS = Path("/tmp/time-aware-thumbnails-browser")
STATES = ("off", "daytime", "sunset", "night")
VIEWPORTS = (
    ("desktop-1280", 1280, 900, "no-preference"),
    ("mobile-390", 390, 844, "reduce"),
    ("mobile-320", 320, 800, "reduce"),
)
SIZES = "(max-width: 760px) calc(100vw - 48px), (max-width: 1280px) calc(100vw - 80px), 1200px"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


def expected(project, state):
    if state == "off":
        return f"images/cs/{project}-cover.webp"
    return f"images/cs/variants/time/{project}/{state}-1200.webp"


def assert_state(page, state):
    page.wait_for_function(
        """
        ([state, sizes]) => {
          const nodes = Array.from(document.querySelectorAll("img[data-time-thumbnail]"));
          return nodes.length === 4 && nodes.every(img => {
            const project = img.dataset.timeThumbnail;
            const src = state === "off"
              ? `images/cs/${project}-cover.webp`
              : `images/cs/variants/time/${project}/${state}-1200.webp`;
            return img.getAttribute("src") === src &&
              (state === "off"
                ? !img.hasAttribute("srcset") && !img.hasAttribute("sizes")
                : img.getAttribute("sizes") === sizes &&
                  img.getAttribute("srcset").includes(`${state}-1200.webp 1200w`) &&
                  img.getAttribute("srcset").includes(`${state}-2400.webp 2400w`));
          });
        }
        """,
        arg=[state, SIZES],
        timeout=20_000,
    )
    for project in ("bearings", "apollo"):
        locator = page.locator(f'.csPanel[data-panel="cs"] img[data-time-thumbnail="{project}"]')
        locator.scroll_into_view_if_needed()
        page.wait_for_function(
            "img => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0",
            arg=locator.element_handle(),
        )
        assert locator.get_attribute("src") == expected(project, state)


def inspect_panel_duplicates(page):
    page.evaluate('document.querySelector(".csTab[data-tab=fun]").click()')
    page.wait_for_selector('.csPanel[data-panel="fun"].on')
    for project in ("bearings", "apollo"):
        locator = page.locator(f'.csPanel[data-panel="fun"] img[data-time-thumbnail="{project}"]')
        locator.scroll_into_view_if_needed()
        page.wait_for_function(
            "img => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0",
            arg=locator.element_handle(),
        )
    page.evaluate('document.querySelector(".csTab[data-tab=cs]").click()')
    page.wait_for_selector('.csPanel[data-panel="cs"].on')


def run_viewport(browser, base_url, label, width, height, reduced_motion):
    context = browser.new_context(
        viewport={"width": width, "height": height},
        reduced_motion=reduced_motion,
    )
    page = context.new_page()
    errors = []
    failed_requests = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on(
        "console",
        lambda message: errors.append(message.text) if message.type == "error" else None,
    )
    page.on("requestfailed", lambda request: failed_requests.append(request.url))
    page.goto(base_url + "/index.html", wait_until="domcontentloaded")
    page.wait_for_function("window.HomeTimeThumbnails && window.SiteTheme")

    preserved = page.eval_on_selector_all(
        "img[data-time-thumbnail]",
        "imgs => imgs.map(img => ({alt: img.alt, loading: img.loading, decoding: img.decoding, fetchpriority: img.getAttribute('fetchpriority')}))",
    )

    for state in STATES:
        page.evaluate("state => window.SiteTheme.setMode(state, {persist:false})", state)
        assert_state(page, state)
        inspect_panel_duplicates(page)
        geometry = page.evaluate(
            """
            () => ({
              overflow: document.documentElement.scrollWidth - innerWidth,
              frames: Array.from(document.querySelectorAll('.csPanel[data-panel="cs"] .csFrame')).map(frame => {
                const box = frame.getBoundingClientRect();
                const img = frame.querySelector('img');
                const imageBox = img.getBoundingClientRect();
                return {ratio: box.width / box.height, same: Math.abs(box.width-imageBox.width)<1 && Math.abs(box.height-imageBox.height)<1};
              })
            })
            """
        )
        assert geometry["overflow"] <= 0, geometry
        # THE FRAME RATIO FORKS AT 760 AND THIS GATE DID NOT.  It demanded 2/1
        # at every width, which could only pass before index.html's
        # `@media(max-width:760px){.csFrame{aspect-ratio:8/5}}` -- the crop
        # Jayden chose by looking at 390 and 320, over 17/10 and 3/2, because
        # 8/5 is the last rung where four phones still read as four phones.
        # So the assertion was pinning a decision that had already changed, and
        # both mobile viewports had been failing on it.  The property worth
        # protecting is not one number: it is that the frame matches THE CROP
        # DECLARED FOR ITS WIDTH and that the image still fills the frame
        # exactly (`same`), which is what catches a plate whose shape has
        # drifted from the box built for it.  Written as a fork it can still
        # fail -- change either rung in index.html and this stops.
        expected = 8 / 5 if width <= 760 else 2.0
        assert all(
            abs(frame["ratio"] - expected) < 0.02 and frame["same"]
            for frame in geometry["frames"]
        ), (label, expected, geometry)
        page.screenshot(path=str(SHOTS / f"{label}-{state}.png"), full_page=True)

    after = page.eval_on_selector_all(
        "img[data-time-thumbnail]",
        "imgs => imgs.map(img => ({alt: img.alt, loading: img.loading, decoding: img.decoding, fetchpriority: img.getAttribute('fetchpriority')}))",
    )
    assert after == preserved, (preserved, after)
    assert not errors, errors
    assert not failed_requests, failed_requests
    resources = page.evaluate(
        """
        () => performance.getEntriesByType('resource')
          .filter(entry => entry.name.includes('/images/cs/variants/time/'))
          .map(entry => ({name: entry.name.split('/').slice(-3).join('/'), transferSize: entry.transferSize, duration: entry.duration}))
        """
    )
    context.close()
    return resources


def main():
    SHOTS.mkdir(parents=True, exist_ok=True)
    handler = partial(QuietHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    Thread(target=server.serve_forever, daemon=True).start()
    base_url = f"http://127.0.0.1:{server.server_port}"
    results = {}
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            for viewport in VIEWPORTS:
                results[viewport[0]] = run_viewport(browser, base_url, *viewport)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    for label, resources in results.items():
        transferred = sum(item["transferSize"] for item in resources)
        slowest = max((item["duration"] for item in resources), default=0)
        print(f"{label}: 4 states OK; {len(resources)} variant requests; {transferred} transfer bytes; slowest {slowest:.1f}ms")
    print(f"screenshots: {SHOTS}")


if __name__ == "__main__":
    main()
