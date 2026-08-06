#!/usr/bin/env python3
"""Resting header and secondary Hero controls blend into their scene."""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
header = (ROOT / "header.css").read_text(encoding="utf-8")
hero_time = (ROOT / "hero-time.css").read_text(encoding="utf-8")


def rule(source: str, selector: str) -> str:
    match = re.search(re.escape(selector) + r"\s*\{([^}]*)\}", source, re.S)
    assert match, f"missing rule: {selector}"
    return re.sub(r"\s+", "", match.group(1))


# At the top of a route, the outline defines the header; its fill is the scene
# behind it. Once a scrollable route detaches, it settles to the page token so
# content cannot ghost through the sticky bar.
nav = rule(header, ".jbNav")
assert "--nav-mat:transparent" in nav

shrunk = rule(header, ":root.jbShrunk .jbNav")
assert "--nav-mat:var(--theme-page,var(--c50))" in shrunk

dark_nav = rule(header, ':root[data-theme="dark"] .jbNav')
assert "--nav-mat:transparent" in dark_nav

# Home Night owns a later override, so it must preserve the same top/scroll
# split rather than reintroducing frosted gray chrome.
home_dark_nav = rule(hero_time, ':root[data-theme="dark"] .jbNav')
assert "--nav-mat:transparent" in home_dark_nav
assert "backdrop-filter" not in home_dark_nav

home_dark_scrolled = rule(hero_time, ':root[data-theme="dark"].jbShrunk .jbNav')
assert "--nav-mat:var(--theme-page)" in home_dark_scrolled

# Mood and Time rest on the exact Night Hero base. Their hover/open state may
# lift, and View work remains the distinct primary action.
night = rule(hero_time, '.hero[data-time-state="night"]')
assert "--time-secondary-bg:var(--time-base)" in night
assert "--time-primary-bg:var(--c50)" in night

assert not re.search(
    r'\.hero\[data-time-state="night"\]\s+:is\(\.heroMood\s+\.moodBtn,\.heroTimeBtn\)\s*\{[^}]*backdrop-filter',
    hero_time,
    re.S,
)

print("chrome blend contract: OK")
