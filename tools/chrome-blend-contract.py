#!/usr/bin/env python3
"""Header and secondary Hero controls use opaque scene-matched surfaces."""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
header = (ROOT / "header.css").read_text(encoding="utf-8")
hero_time = (ROOT / "hero-time.css").read_text(encoding="utf-8")


def rule(source: str, selector: str) -> str:
    # ANCHORED AT A RULE BOUNDARY, 2026-08-19. header.css now carries
    # `.jbStick:not(.isFixed) .jbNav{...}` above the component's own `.jbNav{...}`,
    # and an unanchored substring search matched the descendant rule first and
    # reported the header had lost its material when it had not. The selector has
    # to START a rule for the match to count.
    pattern = r"(?:^|[}\n])\s*" + re.escape(selector) + r"\s*\{([^}]*)\}"
    match = re.search(pattern, source, re.S)
    assert match, f"missing rule: {selector}"
    return re.sub(r"\s+", "", match.group(1))


# The header is always the shared opaque control ground, including before
# scroll, so gradients and page content cannot ghost through it.
#
# 2026-08-19: the BOX that paints that ground moved. On the seven scrolling pages
# the bar is a full-bleed band with a hairline floor, so .jbStick paints and
# .jbNav is layout only (header.css §0b); on play.html and gradientlab.html a pill
# still floats over a full-viewport stage and .jbNav paints as before. The
# invariant is unchanged -- an opaque, token-sourced ground with a hairline and no
# elevation -- so both halves are asserted rather than one being dropped.
band = rule(header, ".jbStick:not(.isFixed)")
assert "background:var(--ctl-ground)" in band, band
# the floor is a hairline drawn in the structural-rule token, and it is a
# box-shadow with NO blur and NO spread: the site's one shadow belongs to the
# companion heads, and chrome separates with a line.
assert "box-shadow:0var(--rule-w)0var(--rule)" in band, band

nav = rule(header, ".jbNav")
assert "--nav-mat:var(--ctl-ground)" in nav
assert "--nav-rim:var(--ctl-container-rim)" in nav

shrunk = rule(header, ":root.jbShrunk .jbNav")
assert "--nav-mat:var(--ctl-ground)" in shrunk
assert "--nav-rim:var(--ctl-container-rim)" in shrunk

dark_nav = rule(header, ':root[data-theme="dark"] .jbNav')
assert "--nav-mat:var(--ctl-ground)" in dark_nav
assert "--nav-rim:var(--ctl-container-rim)" in dark_nav

# Hero scene CSS cannot own or repaint shared header material.
assert ':root[data-theme="dark"] .jbNav' not in hero_time
assert ':root[data-theme="dark"].jbShrunk .jbNav' not in hero_time

# Time uses the Hero's opaque base color. View work remains distinct.
night = rule(hero_time, '.hero[data-time-state="night"]')
assert "--time-secondary-bg:var(--time-base)" in night

# NIGHT IS NOT INVERTED ANY MORE, AND THAT IS THE THING TO PROTECT.  2026-08-27.
# This line asked for --time-primary-bg:var(--c50) -- a WHITE primary button,
# which is only correct on a black hero. Jayden: "I dont like how differnt the
# gradient looks for the night im thinking of making it more of a light mode
# gradient like the rest". Night now mirrors dusk token for token, so the
# assertion was pinning the inversion it exists to describe rather than the
# rule, and it went red the moment the inversion left.
# Replaced with the invariant that actually matters now and can still fail: all
# seven hours are LIGHT, so night's primary button must be the ink one like
# everyone else's, and its ink must not be the pale --c50 it used to be.
assert "--time-primary-bg:var(--c950)" in night, (
    "night's primary button is not the ink one -- if night has gone back to a "
    "dark hero, that reverses a decision made on 2026-08-27 and the whole block "
    "needs re-reading, not just this line")
assert "--time-ink:var(--c950)" in night, "night's hero ink is not the light-hour ink"
assert "--time-ink:var(--c50)" not in night, "night is inverted again"

# and the seven hours agree: nothing sets a dark hero base any more
for _st in ("pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night"):
    _blk = rule(hero_time, '.hero[data-time-state="%s"]' % _st)
    assert "--time-ink:var(--c950)" in _blk, "%s is not a light hour" % _st

assert not re.search(
    r'\.hero\[data-time-state="night"\]\s+:is\(\.heroMood\s+\.moodBtn,\.heroTimeBtn\)\s*\{[^}]*backdrop-filter',
    hero_time,
    re.S,
)

print("chrome blend contract: OK")
