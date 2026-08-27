#!/usr/bin/env python3
"""Fails when the night sky costs something by day, beats in time, or crosses the headline.

WHY THIS FILE EXISTS
Jayden, 2026-08-27: "it looks good though I want the night hero to do more like
the stars shimmer and shooting stars occationally."

Three things had to be true at once and each of them is a one-token edit away
from being false:

  1. IT COSTS NOTHING WHEN IT IS NOT NIGHT. The twinkle used to sit on the base
     `.heroNightStars i` rule, so all 32 stars animated for the whole day behind
     a layer at opacity:0 -- thirty-two compositor animations painting nothing
     for the fifteen hours of the clock that are not night. Measured at
     1440x900, medians of three interleaved 8s idle windows:
                            running animations   recalc/frame   script
         before, daytime            40               1.01      14.6 ms/s
         after,  daytime             8               1.01      12.6 ms/s
         before, night              40               1.00      13.5 ms/s
         after,  night              75               1.01      13.2 ms/s
     The shimmer doubled and the shooting stars are new, and NIGHT DID NOT GET
     MORE EXPENSIVE, because all of it is opacity and transform on 1px boxes.
     The whole feature was paid for by the daylight animations that went.
  2. THE SHIMMER HAS NO COLLECTIVE RHYTHM. "One twinkle animation across all of
     them" is what it read as, and the tell is not per-star -- it is that the
     WHOLE FIELD brightens and dims together. That is measurable: sum the stars'
     rendered brightness and watch the sum. Measured over 60s at 5Hz, the
     shipped field's sum varies by 3.2% of its mean; forced onto one rhythm the
     same sum varies by 17.2%. A 5x separation, and the two-sided version of it
     is below, because "no collective rhythm" is also satisfied by no shimmer at
     all.
  3. NOTHING CROSSES THE HEADLINE. A streak is fast, bright and unannounced,
     which is exactly what pulls an eye off a sentence. Every path lives in the
     top third of the sky by construction; this drives every flight frame by
     frame and measures it.

    python3 tools/hero-night-sky-contract.py
    python3 tools/hero-night-sky-contract.py --self-test

--self-test re-injects each defect in turn -- the twinkle back on the base rule,
every star on one rhythm, and one streak dropped into the headline's band -- and
requires the matching assertion to reject it.
"""

import statistics
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DAY_STATES = ("pre-dawn", "sunrise", "daytime", "dusk", "sunset", "off")

# ── THE TWO-SIDED SHIMMER BAND ───────────────────────────────────────────────
# Measured at 1440x900 over 60s at 5Hz, on the sum of every star's rendered
# opacity times the square of its rendered scale -- its share of the light:
#     shipped                      sd/mean 0.032
#     every star on one rhythm     sd/mean 0.172
# 0.07 sits between them with room on both sides. And the other end: over 30s
# every one of the 32 stars swings between 0.26 and 0.64 peak-to-peak against
# its own mean, so 0.12 on at least 28 of them fails a field that has stopped
# twinkling -- which is the other way to score a flat aggregate.
AGGREGATE_SWING_CEILING = 0.07
STAR_SWING_FLOOR = 0.12
STARS_THAT_MUST_SWING = 28

# ── AND THE TWO-SIDED "OCCASIONALLY" BAND ────────────────────────────────────
# Three streaks, two flights each per cycle, on 149s / 181s / 223s. Each flight
# is 0.55% of its own period, so the sky carries a visible streak about 3.3% of
# the time and delivers one every 30 seconds on average. The ceiling is what
# stops this becoming a feature that announces itself; the floor is what stops a
# retune quietly reducing it to something nobody ever sees.
VISIBLE_SHARE_FLOOR = 0.004
VISIBLE_SHARE_CEILING = 0.060
# The headline's box is at 41.7% of the Hero at 1440 and 44.4% at 390. The
# lowest any streak reaches, box included, is 32.6% and 29.1%. 24px is a
# clearance the shipped paths beat four times over and an injected path that
# aims a streak at the type misses outright.
HEADLINE_CLEARANCE = 24.0


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


STAR_LIGHT = """() => [...document.querySelectorAll('.heroNightStars i')].map(n => {
  const cs = getComputedStyle(n);
  const s = parseFloat(cs.scale) || 1;
  return parseFloat(cs.opacity) * s * s;
})"""

# THE ANIMATION'S currentTime CARRIES THE DELAY, AND FORGETTING THAT READS AS
# "the meteors never fire". Every streak is authored with a negative delay so
# the three do not start together, and Animation.currentTime is timeline time --
# the effect's own progress is currentTime minus the delay. Seeking to a
# percentage of the effect therefore has to add the delay back. Measured the
# wrong way round first: every sample came back at opacity 0 across the whole
# flight window, on a field that was working.
SEEK_METEORS = """(pct) => {
  document.querySelectorAll('.heroMeteor').forEach(n => {
    const a = n.getAnimations()[0];
    if (!a) return;
    const t = a.effect.getTiming();
    a.pause();
    a.currentTime = t.duration * pct / 100 + (t.delay || 0);
  });
}"""

METEOR_STATE = """() => {
  const hero = document.getElementById('main').getBoundingClientRect();
  const h1 = document.getElementById('h1').getBoundingClientRect();
  return {
    heroTop: hero.top, heroHeight: hero.height, h1Top: h1.top,
    meteors: [...document.querySelectorAll('.heroMeteor')].map(n => {
      const b = n.getBoundingClientRect();
      return {opacity: parseFloat(getComputedStyle(n).opacity),
              bottom: b.bottom, top: b.top, left: b.left, right: b.right};
    })};
}"""


def night_page(browser, base_url, width, height, state="night", reduced=False):
    context = browser.new_context(
        viewport={"width": width, "height": height},
        reduced_motion="reduce" if reduced else "no-preference")
    context.add_init_script(
        "try{sessionStorage.setItem('jbHeroTimeMode',%r)}catch(e){}" % state)
    page = context.new_page()
    page.goto(base_url + "/index.html", wait_until="load")
    page.wait_for_timeout(2200)
    return context, page


def running(page, selector):
    return page.evaluate(
        "sel => [...document.querySelectorAll(sel)]"
        ".reduce((n, el) => n + el.getAnimations()"
        ".filter(a => a.playState === 'running').length, 0)", selector)


# ── 1. THE SKY IS ASLEEP UNTIL IT IS NIGHT ───────────────────────────────────
def assert_free_by_day(browser, base_url, failures, verbose):
    for state in DAY_STATES:
        context, page = night_page(browser, base_url, 1440, 900, state)
        stars = running(page, ".heroNightStars i")
        meteors = running(page, ".heroMeteor")
        context.close()
        if verbose:
            print(f"  {state:9s} star animations {stars}, streak animations {meteors}")
        if stars or meteors:
            failures.append(
                f"{state} runs {stars} star and {meteors} streak animations behind "
                "a starfield at opacity:0 -- the night sky is animating in daylight")


# ── 2. THE SHIMMER, FROM BOTH ENDS ───────────────────────────────────────────
def assert_shimmer(page, failures, label, samples=90, gap=200, verbose=True):
    rows = []
    for _ in range(samples):
        rows.append(page.evaluate(STAR_LIGHT))
        page.wait_for_timeout(gap)
    if not rows or not rows[0]:
        failures.append(f"{label} there are no stars to shimmer")
        return None
    totals = [sum(r) for r in rows]
    mean = statistics.fmean(totals)
    aggregate = statistics.pstdev(totals) / mean if mean else 0
    count = len(rows[0])
    swings = []
    for j in range(count):
        column = [r[j] for r in rows]
        lo, hi = min(column), max(column)
        swings.append((hi - lo) / ((hi + lo) / 2) if hi + lo else 0)
    lively = sum(1 for s in swings if s >= STAR_SWING_FLOOR)
    if aggregate > AGGREGATE_SWING_CEILING:
        failures.append(
            f"{label} the whole field brightens and dims together: the sum of "
            f"the stars' light varies by {aggregate:.1%} of its mean (ceiling "
            f"{AGGREGATE_SWING_CEILING:.0%}) -- they are sharing a rhythm")
    if lively < STARS_THAT_MUST_SWING:
        failures.append(
            f"{label} only {lively} of {count} stars actually twinkle "
            f"(floor {STARS_THAT_MUST_SWING}, threshold "
            f"{STAR_SWING_FLOOR:.0%} peak-to-peak)")
    if verbose:
        print(f"  {label} shimmer: aggregate {aggregate:.3f}, {lively}/{count} "
              f"stars swinging, median star swing "
              f"{statistics.median(swings):.2f}")
    return aggregate, lively


# ── 3. AND THE PERIODS ARE ALL DIFFERENT ─────────────────────────────────────
def assert_periods(page, failures, label, verbose=True):
    periods = page.evaluate(
        "() => [...document.querySelectorAll('.heroNightStars i')]"
        ".flatMap(n => n.getAnimations().map(a => a.effect.getTiming().duration))")
    if len(periods) < 60:
        failures.append(f"{label} expected two periods on each of 32 stars, "
                        f"found {len(periods)}")
        return
    ordered = sorted(periods)
    closest = min(b - a for a, b in zip(ordered, ordered[1:]))
    if closest < 1:
        failures.append(
            f"{label} two of the {len(periods)} star periods are {closest:.1f}ms "
            "apart -- they will visibly beat")
    if verbose:
        print(f"  {label} periods: {len(set(periods))} distinct of "
              f"{len(periods)}, closest pair {closest:.1f}ms, spread "
              f"{ordered[0]/1000:.1f}..{ordered[-1]/1000:.1f}s")


# ── 4. THE STREAKS ARE RARE, AND THEY STAY OFF THE TYPE ──────────────────────
def assert_meteors(page, failures, label, verbose=True):
    count = page.evaluate("() => document.querySelectorAll('.heroMeteor').length")
    if not count:
        failures.append(f"{label} there are no shooting stars")
        return
    # 800 samples across one whole cycle: fine enough to land inside a flight
    # window that is 0.55% of the period, and cheap because it is a seek rather
    # than a wait.
    # ONE ROUND TRIP PER SAMPLE, NOT TWO, and the whole sweep in one call. At two
    # evaluates per step this took minutes per viewport, and this gate has to run
    # serially with twenty-nine others.
    steps = 600
    sweep = page.evaluate("""(steps) => {
      const hero = document.getElementById('main').getBoundingClientRect();
      const h1 = document.getElementById('h1').getBoundingClientRect();
      const nodes = [...document.querySelectorAll('.heroMeteor')];
      const anims = nodes.map(n => n.getAnimations()[0]);
      anims.forEach(a => a && a.pause());
      const visible = nodes.map(() => 0), lowest = nodes.map(() => 0);
      for (let i = 0; i < steps; i++) {
        const pct = i * 100 / steps;
        anims.forEach(a => { if (!a) return;
          const t = a.effect.getTiming();
          a.currentTime = t.duration * pct / 100 + (t.delay || 0); });
        nodes.forEach((n, j) => {
          const cs = getComputedStyle(n);
          if (parseFloat(cs.opacity) > 0.02) {
            visible[j]++;
            const b = n.getBoundingClientRect();
            lowest[j] = Math.max(lowest[j], b.bottom - hero.top);
          }
        });
      }
      anims.forEach(a => a && a.play());
      return {visible, lowest, heroTop: hero.top, heroHeight: hero.height,
              h1Top: h1.top};
    }""", steps)
    visible, lowest = sweep["visible"], sweep["lowest"]
    reference = sweep
    share = sum(visible) / float(steps)
    hero_height = reference["heroHeight"]
    h1_depth = reference["h1Top"] - reference["heroTop"]
    worst = max(lowest)
    clearance = h1_depth - worst
    if share < VISIBLE_SHARE_FLOOR:
        failures.append(
            f"{label} a streak is on screen {share:.2%} of the time -- nobody "
            f"will ever see one (floor {VISIBLE_SHARE_FLOOR:.1%})")
    if share > VISIBLE_SHARE_CEILING:
        failures.append(
            f"{label} a streak is on screen {share:.2%} of the time, which is "
            f"not occasional (ceiling {VISIBLE_SHARE_CEILING:.1%})")
    if clearance < HEADLINE_CLEARANCE:
        failures.append(
            f"{label} a shooting star reaches {worst:.0f}px into a Hero whose "
            f"headline starts at {h1_depth:.0f}px -- {clearance:.0f}px of "
            f"clearance against a floor of {HEADLINE_CLEARANCE:.0f}")
    if verbose:
        print(f"  {label} streaks: {count} elements, visible {share:.2%} of the "
              f"cycle, lowest reach {100*worst/hero_height:.1f}% of the Hero, "
              f"headline at {100*h1_depth/hero_height:.1f}%, clearance "
              f"{clearance:.0f}px")


# ── 5. REDUCED MOTION ────────────────────────────────────────────────────────
def assert_reduced(browser, base_url, failures, verbose):
    context, page = night_page(browser, base_url, 1440, 900, "night", reduced=True)
    stars = running(page, ".heroNightStars i")
    lit = page.evaluate(
        "() => [...document.querySelectorAll('.heroNightStars i')]"
        ".filter(n => parseFloat(getComputedStyle(n).opacity) > .2).length")
    streaks = page.evaluate(
        "() => [...document.querySelectorAll('.heroMeteor')]"
        ".filter(n => getComputedStyle(n).display !== 'none').length")
    context.close()
    if verbose:
        print(f"  reduced motion: {stars} animations, {lit} stars lit, "
              f"{streaks} streaks rendered")
    if stars:
        failures.append(f"reduced motion still runs {stars} star animations")
    if streaks:
        failures.append(f"reduced motion still renders {streaks} shooting stars "
                        "-- a streak frozen mid-flight is a scratch on the sky")
    # STILL, NOT ABSENT -- the same answer the sky's other layers give.
    if lit < 20:
        failures.append(f"reduced motion took the starfield away: only {lit} "
                        "stars are lit")


def contract(base_url, failures, verbose=True, browser=None):
    def body(browser):
        assert_free_by_day(browser, base_url, failures, verbose)
        for width, height in ((1440, 900), (390, 844)):
            context, page = night_page(browser, base_url, width, height, "night")
            label = f"{width}x{height}"
            assert_periods(page, failures, label, verbose)
            assert_meteors(page, failures, label, verbose)
            assert_shimmer(page, failures, label, verbose=verbose)
            context.close()
        assert_reduced(browser, base_url, failures, verbose)

    if browser is not None:
        body(browser)
        return
    with sync_playwright() as pw:
        launched = pw.chromium.launch()
        try:
            body(launched)
        finally:
            launched.close()


# ── THE RE-INJECTIONS ────────────────────────────────────────────────────────
# One per assertion this file makes, each of them the edit somebody would
# actually make, and each served in flight rather than written to the tree --
# several agents share this worktree.
INJECTIONS = (
    ("hero-time.css", "the twinkle back on the base rule, so it runs all day",
     ".heroNightStars i{--star-visible:clamp(.34,var(--star-alpha),.72);"
     "position:absolute;left:var(--star-x);top:var(--star-y);",
     ".heroNightStars i{--star-visible:clamp(.34,var(--star-alpha),.72);"
     "animation:heroStarTwinkle 7s linear infinite alternate;"
     "position:absolute;left:var(--star-x);top:var(--star-y);",
     ("animating in daylight",)),
    ("hero-time.css", "every star on one rhythm",
     "  heroStarTwinkle calc(var(--star-twinkle-duration) * var(--star-rate)) "
     "var(--star-twinkle-ease) var(--star-delay) infinite alternate,",
     "  heroStarTwinkle var(--star-twinkle-duration) "
     "var(--star-twinkle-ease) 0s infinite alternate,",
     ("sharing a rhythm", "will visibly beat")),
    ("index.html", "a shooting star aimed across the headline",
     "--m-x:38%;--m-y:20%;--m-rot:12deg;--m-slope:.213;",
     "--m-x:38%;--m-y:44%;--m-rot:12deg;--m-slope:.213;",
     ("clearance against a floor",)),
)


def self_test(browser, base_url_for):
    types = {"hero-time.css": "text/css", "index.html": "text/html"}
    for target, name, site, inject, wanted in INJECTIONS:
        source = (ROOT / target).read_text(encoding="utf-8")
        if site not in source:
            raise SystemExit(
                f"--self-test cannot find the site for '{name}' in {target}; "
                "update INJECTIONS to match it rather than letting the "
                "self-test pass blind.")
        broken = source.replace(site, inject, 1)
        failures = []
        base_url = base_url_for()
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        context.route(
            "**/" + target + "*",
            lambda route, req=None, b=broken, kind=types[target]:
            route.fulfill(status=200, content_type=kind, body=b))
        context.add_init_script(
            "try{sessionStorage.setItem('jbHeroTimeMode','%s')}catch(e){}"
            % ("daytime" if "all day" in name else "night"))
        page = context.new_page()
        page.goto(base_url + "/index.html", wait_until="load")
        page.wait_for_timeout(2200)
        if "all day" in name:
            stars = running(page, ".heroNightStars i")
            if stars:
                failures.append(f"daytime runs {stars} star animations behind a "
                                "starfield at opacity:0 -- the night sky is "
                                "animating in daylight")
        elif "one rhythm" in name:
            assert_periods(page, failures, "self-test", verbose=False)
            assert_shimmer(page, failures, "self-test", samples=60, verbose=False)
        else:
            assert_meteors(page, failures, "self-test", verbose=False)
        context.close()
        caught = [f for f in failures if any(w in f for w in wanted)]
        if not caught:
            raise SystemExit(
                f"--self-test FAILED: with {name} the contract still passed. "
                f"Recorded: {failures!r}")
        print(f"self-test: the contract rejected {name}, as it must")
    print("Hero night sky self-test: OK (the detectors fail when they should)")


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    base_url = f"http://127.0.0.1:{server.server_port}"
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            try:
                if "--self-test" in sys.argv:
                    self_test(browser, lambda: base_url)
                    return
                failures = []
                contract(base_url, failures, browser=browser)
                if failures:
                    print("\n".join("FAIL " + f for f in failures))
                    raise SystemExit(1)
                print("Hero night sky: OK")
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
