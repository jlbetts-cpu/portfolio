#!/usr/bin/env python3
"""Header and secondary Hero controls use opaque scene-matched surfaces."""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
header = (ROOT / "header.css").read_text(encoding="utf-8")
hero_time = (ROOT / "hero-time.css").read_text(encoding="utf-8")


def rule(source: str, selector: str) -> str:
    match = re.search(re.escape(selector) + r"\s*\{([^}]*)\}", source, re.S)
    assert match, f"missing rule: {selector}"
    return re.sub(r"\s+", "", match.group(1))


# The header is always the shared opaque control ground, including before
# scroll, so gradients and page content cannot ghost through it.
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
