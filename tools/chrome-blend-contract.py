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


# The header is always an opaque page-token surface, including before scroll,
# so gradients and page content cannot ghost through it.
nav = rule(header, ".jbNav")
assert "--nav-mat:var(--theme-page,var(--c50))" in nav

shrunk = rule(header, ":root.jbShrunk .jbNav")
assert "--nav-mat:var(--theme-page,var(--c50))" in shrunk

dark_nav = rule(header, ':root[data-theme="dark"] .jbNav')
assert "--nav-mat:var(--theme-page,var(--c50))" in dark_nav

# Home Night owns a later override and preserves the same opaque surface.
home_dark_nav = rule(hero_time, ':root[data-theme="dark"] .jbNav')
assert "--nav-mat:var(--theme-page)" in home_dark_nav
assert "backdrop-filter" not in home_dark_nav

home_dark_scrolled = rule(hero_time, ':root[data-theme="dark"].jbShrunk .jbNav')
assert "--nav-mat:var(--theme-page)" in home_dark_scrolled

# Mood and Time use the Hero's opaque base color. View work remains distinct.
night = rule(hero_time, '.hero[data-time-state="night"]')
assert "--time-secondary-bg:var(--time-base)" in night
assert "--time-primary-bg:var(--c50)" in night

assert not re.search(
    r'\.hero\[data-time-state="night"\]\s+:is\(\.heroMood\s+\.moodBtn,\.heroTimeBtn\)\s*\{[^}]*backdrop-filter',
    hero_time,
    re.S,
)

print("chrome blend contract: OK")
