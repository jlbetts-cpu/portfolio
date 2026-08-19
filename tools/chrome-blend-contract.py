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
assert "--time-primary-bg:var(--c50)" in night

assert not re.search(
    r'\.hero\[data-time-state="night"\]\s+:is\(\.heroMood\s+\.moodBtn,\.heroTimeBtn\)\s*\{[^}]*backdrop-filter',
    hero_time,
    re.S,
)

print("chrome blend contract: OK")
