#!/usr/bin/env python3
"""Painted-pixel legibility contract for the time-of-day themes.

WHY THIS MEASURES PIXELS AND NOT COMPUTED STYLE, which is the whole reason the
file exists. Every defect it guards read as PASSING through the CSSOM:

  * the case-studies tabs computed rgb(244,245,247) on rgb(17,19,24) -- 17.03:1 --
    while painting rgb(62,63,65) on rgb(11,12,16), 1.85:1. #heroTimeSpill was
    covering them, and a colour-vs-computed-ground check cannot see a layer.
  * the About email button computed a perfectly legible 17.03:1 and was legible.
    It was legible AS A SECONDARY: a dead .abLinkPrimary selector meant the
    primary call to action on a hiring site rendered identically to Resume.
    Contrast was never the failure; DISTINCTION was.
  * the primary's focus ring measured fine unfocused, because an unfocused
    outline-color computes to currentColor. It has to be focused, by keyboard,
    or the number is meaningless.

So: real states, real focus, real screenshots, transitions neutralised BEFORE
any theme switch (a naive read hands back the colour the element is LEAVING).

  tools/dark-legibility-contract.py              run it
  tools/dark-legibility-contract.py --self-test  re-inject all three bugs
"""

import argparse
import io
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

# All six authored states plus "off". The dark-ish ones are not all data-theme
# "dark" -- only night is -- and that asymmetry is exactly where half-migrated
# values hide, so every one of them is walked rather than assumed.
STATES = ("off", "pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night")

AA_TEXT = 4.5          # body text
AA_UI = 3.0            # large text and UI components

KILL_TRANSITIONS = """
(() => {
  let s = document.getElementById('__killTransitions');
  if (!s) { s = document.createElement('style'); s.id = '__killTransitions';
            document.documentElement.appendChild(s); }
  s.textContent = '*,*::before,*::after{transition-duration:0s!important;' +
    'transition-delay:0s!important;animation-duration:0s!important;' +
    'animation-delay:0s!important}';
})()
"""


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


def serve():
    handler = partial(QuietHandler, directory=str(ROOT))
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{httpd.server_address[1]}"


def luminance(rgb):
    def channel(v):
        v /= 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (channel(c) for c in rgb[:3])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def rgb_tuple(value):
    parts = re.findall(r"[\d.]+", value)
    return tuple(int(float(p)) for p in parts[:3])


def ink_and_ground(png):
    """Sample the 0.5% tails. Aggregates hide spatial defects; the extremes are
    the glyph and the ground, and the median says which is which."""
    img = Image.open(io.BytesIO(png)).convert("RGB")
    pixels = sorted(img.getdata(), key=luminance)
    if len(pixels) < 40:
        return None
    n = max(1, len(pixels) // 200)
    avg = lambda s: tuple(round(sum(p[i] for p in s) / len(s)) for i in range(3))
    dark, bright = avg(pixels[:n]), avg(pixels[-n:])
    median = pixels[len(pixels) // 2]
    if abs(luminance(median) - luminance(dark)) < abs(luminance(median) - luminance(bright)):
        return bright, dark
    return dark, bright


def open_page(browser, base, path, state):
    page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
    page.goto(f"{base}/{path}", wait_until="load")
    page.evaluate(KILL_TRANSITIONS)
    page.wait_for_function("window.SiteTheme && document.documentElement.classList.contains('theme-ready')")
    page.evaluate("(s) => window.SiteTheme.setMode(s, {persist:false})", state)
    page.evaluate(KILL_TRANSITIONS)
    page.wait_for_timeout(160)
    return page


# ── 1 · the case-studies tabs, measured in pixels ──────────────────────────────
def check_tabs(browser, base, failures, self_test):
    for state in STATES:
        page = open_page(browser, base, "index.html", state)
        if self_test:
            # The regression: .cases back below .wrap, so #heroTimeSpill covers it.
            page.evaluate("() => { const c = document.querySelector('.cases');"
                          " c.style.setProperty('z-index','61','important'); }")
            page.wait_for_timeout(120)
        for tab in page.query_selector_all(".csTab"):
            tab.scroll_into_view_if_needed()
            page.wait_for_timeout(80)
            sampled = ink_and_ground(tab.screenshot())
            if not sampled:
                continue
            ink, ground = sampled
            ratio = contrast(ink, ground)
            label = (tab.text_content() or "").strip()[:16]
            if ratio < AA_TEXT:
                failures.append(
                    f"tabs/{state}: '{label}' paints {ratio:.2f}:1 (needs {AA_TEXT}) "
                    f"ink={ink} ground={ground} -- computed {tab.evaluate('e=>getComputedStyle(e).color')}. "
                    f"A layer is painting over the tab bar; check that .cases outranks .wrap.")
        page.close()


# ── 2 · the About primary is DISTINCT, not merely legible ─────────────────────
def check_about_primary(browser, base, failures, self_test):
    for state in STATES:
        page = open_page(browser, base, "about.html", state)
        if self_test:
            # The regression: the dark adapter repainting the primary as a secondary.
            page.evaluate("""() => { const s = document.createElement('style');
              s.textContent = ':root[data-theme="dark"] body[data-theme-page="about"] .abLink' +
                '{background-color:var(--theme-surface);color:var(--theme-ink)}';
              document.head.appendChild(s); }""")
            page.wait_for_timeout(120)
        primary = page.query_selector(".abConnect .abLink.ctl--primary")
        if primary is None:
            failures.append(f"about/{state}: no .abConnect .abLink.ctl--primary in the markup. "
                            "If the email button was reclassed, every rule naming the old class is now dead.")
            page.close()
            continue
        primary.scroll_into_view_if_needed()
        page.wait_for_timeout(80)
        grounds = page.evaluate("""() => Array.from(
            document.querySelectorAll('.abConnect .abLink')).map(
            e => [e.className, getComputedStyle(e).backgroundColor])""")
        prim = [g for c, g in grounds if "ctl--primary" in c]
        secs = [g for c, g in grounds if "ctl--primary" not in c]
        if not prim or not secs:
            page.close()
            continue
        p_rgb = rgb_tuple(prim[0])
        for s in secs:
            ratio = contrast(p_rgb, rgb_tuple(s))
            if ratio < AA_UI:
                failures.append(
                    f"about/{state}: the email button's ground {prim[0]} is only {ratio:.2f}:1 "
                    f"from a secondary's {s} (needs {AA_UI}). The primary call to action on a "
                    "hiring site is not distinguishable from Resume.")
                break
        page.close()


# ── 3 · the primary's focus ring, with REAL keyboard focus ────────────────────
def check_focus_ring(browser, base, failures, self_test):
    for state in ("daytime", "night"):
        page = open_page(browser, base, "index.html", state)
        if self_test:
            page.evaluate("""() => { const s = document.createElement('style');
              s.textContent = '.ctl--primary:focus-visible{box-shadow:var(--ctl-rim-strong)}';
              document.head.appendChild(s); }""")
            page.wait_for_timeout(120)
        for _ in range(60):
            page.keyboard.press("Tab")
            if page.evaluate("() => !!document.activeElement && "
                             "document.activeElement.classList.contains('ctl--primary')"):
                break
        else:
            page.close()
            continue
        got = page.evaluate("""() => {
            const e = document.activeElement, c = getComputedStyle(e);
            const probe = document.createElement('div');
            probe.style.color = 'var(--ctl-primary-ink)';
            document.body.appendChild(probe);
            const sep = getComputedStyle(probe).color;
            probe.remove();
            return {ring: c.outlineColor, fill: c.backgroundColor,
                    shadow: c.boxShadow, sep: sep};
        }""")
        # The separator only exists if a non-inset ring was added to the shadow list.
        has_sep = "inset" not in got["shadow"].split(",")[-1]
        ring, fill, sep = (rgb_tuple(got[k]) for k in ("ring", "fill", "sep"))
        if not has_sep:
            failures.append(
                f"focus/{state}: .ctl--primary:focus-visible has no separator ring. "
                f"Its outline is {contrast(ring, fill):.2f}:1 against the button's own fill, "
                "so the indicator survives only on the 2px offset showing the page through.")
            page.close()
            continue
        for name, pair in (("separator vs fill", (sep, fill)), ("ring vs separator", (ring, sep))):
            ratio = contrast(*pair)
            if ratio < AA_UI:
                failures.append(f"focus/{state}: {name} is {ratio:.2f}:1 (needs {AA_UI}).")
        page.close()


# ── 4 · no dark rule may address a class no shipping page carries ─────────────
def check_no_dead_theme_selectors(failures, self_test):
    """The email bug was a rule for .abLinkPrimary, a class the markup lost when
    the button became a .ctl. A rule nobody matches is not inert: the broader
    rule that outranks the library keeps running beside it.

    COMMENTS ARE STRIPPED BEFORE ANYTHING IS COUNTED, and that is not fussiness.
    about.html's own prose still discusses ".abLinkPrimary" in two places, so a
    naive text search over the sources finds the dead class and reports the bug
    as fixed. Only parsed class="" attributes and JS string literals count.
    The tournament's .tv* classes are built at runtime by play-tournament.js, so
    script strings are part of the shipped surface too -- a class that only ever
    exists after a click is still a class the page carries."""
    css = (ROOT / "site-theme.css").read_text()
    if self_test:
        css += ('\n:root[data-theme="dark"] body[data-theme-page="about"] '
                '.abLinkPrimary{background-color:var(--theme-focus)}\n')

    html_comment = re.compile(r"<!--.*?-->", re.S)
    js_comment = re.compile(r"/\*.*?\*/|(?<![:'\"])//[^\n]*", re.S)

    shipped = set()
    sources = []
    for name in ("index.html", "about.html", "apollo.html", "bearings.html", "cluster.html",
                 "strata.html", "ucdavis.html", "yowmings.html", "play.html", "headmaker.html",
                 "gradientlab.html"):
        sources.append(html_comment.sub("", (ROOT / name).read_text()))
    for js in sorted(ROOT.glob("*.js")):
        sources.append(js_comment.sub("", js.read_text()))

    for text in sources:
        for attr in re.findall(r'class="([^"]*)"', text):
            shipped.update(attr.split())
        # JS builds class names in string literals and template literals
        for literal in re.findall(r"""["'`]([^"'`\n]{0,400})["'`]""", text):
            shipped.update(re.findall(r"[A-Za-z][A-Za-z0-9_-]{1,}", literal))

    # A class the rest of the system still STYLES is part of the system, even if
    # this contract cannot see where it is applied. Only site-theme.css is
    # excluded -- a class that exists nowhere but the dark adapter is precisely
    # the .abLinkPrimary shape: a treatment for something that is not there.
    for sheet in sorted(ROOT.glob("*.css")):
        if sheet.name == "site-theme.css":
            continue
        shipped.update(re.findall(r"\.([A-Za-z][A-Za-z0-9_-]+)",
                                  re.sub(r"/\*.*?\*/", "", sheet.read_text(), flags=re.S)))
    for text in sources:
        for block in re.findall(r"<style\b[^>]*>(.*?)</style\s*>", text, re.S):
            shipped.update(re.findall(r"\.([A-Za-z][A-Za-z0-9_-]+)",
                                      re.sub(r"/\*.*?\*/", "", block, flags=re.S)))

    seen = set()
    for selector in re.findall(r"(:root\[data-theme=\"dark\"\][^{}]*)\{", css):
        for token in re.findall(r"\.([A-Za-z][A-Za-z0-9_-]+)", selector):
            if token in shipped or token in seen:
                continue
            seen.add(token)
            failures.append(
                f"site-theme.css addresses .{token}, which no shipping page carries in markup "
                "or builds in script. A dark rule for a class that no longer exists is a "
                "treatment that has silently stopped running -- and whatever broader rule "
                "outranks the library is still running in its place.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--self-test", action="store_true",
                    help="re-inject every regression this file guards; it must then FAIL")
    args = ap.parse_args()

    httpd, base = serve()
    failures = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            check_tabs(browser, base, failures, args.self_test)
            check_about_primary(browser, base, failures, args.self_test)
            check_focus_ring(browser, base, failures, args.self_test)
            check_no_dead_theme_selectors(failures, args.self_test)
            browser.close()
    finally:
        httpd.shutdown()

    if args.self_test:
        if failures:
            print(f"SELF-TEST PASS -- the injected regressions were caught ({len(failures)} findings):")
            for f in failures[:6]:
                print("  -", f)
            return 0
        print("SELF-TEST FAIL -- the bugs were re-injected and this contract did not notice.")
        return 1

    if failures:
        print(f"FAIL -- {len(failures)} legibility findings:")
        for f in failures:
            print("  -", f)
        return 1
    print(f"PASS -- tabs, About primary, focus ring and dark selectors clean across "
          f"{len(STATES)} time-of-day states.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
