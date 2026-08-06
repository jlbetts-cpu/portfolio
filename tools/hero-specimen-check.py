#!/usr/bin/env python3
"""Static contract checks for the home-page specimen-frame hero."""

from pathlib import Path
import re


html = Path("index.html").read_text(encoding="utf-8")

assert 'class="jbDisc jbPlay"' not in html
assert re.search(r'<a[^>]+data-nav-item="games"[^>]+href="play\.html"', html)
assert re.search(r'<a[^>]+id="workBtn"[^>]+href="#cases"', html)
work_control = re.search(r'<a[^>]+id="workBtn".*?</a>', html, re.S)
assert work_control and "<svg" not in work_control.group(0)
assert 'id="moodbar"' in html and 'class="heroMood' in html
assert re.search(r'<button[^>]+id="moodBtn"[^>]+aria-controls="moodMenu"', html)
mood_control = re.search(r'<button[^>]+id="moodBtn".*?</button>', html, re.S)
assert mood_control and "moodFaceIco" not in mood_control.group(0)
assert html.count('class="moodItem"') >= 4

for mood, icon, label in (
    ("empathy", "camDot", "Empathy"),
    ("hunger", "cookieDot", "Hunger"),
    ("delight", "discoDot", "Delight"),
    ("love", "heartDot", "Love"),
):
    pattern = rf'data-mood="{mood}"[^>]*>.*?class="moodIco {icon}".*?{label}</button>'
    assert re.search(pattern, html, re.S), mood

assert html.index('id="h1"') < html.index('id="moodbar"') < html.index('class="stagewrap"')

for token in ("--hero-aura-core", "--hero-aura-mid", "--hero-aura-fade"):
    assert token in html, token

assert re.search(
    r'\.hero\s*\{[^}]*box-shadow:\s*var\(--rim-3\)',
    html,
    re.S,
)
assert ".heroAura" in html
assert 'id="cursorGlow"' not in html
assert ".cursorGlow" not in html
hero_aura_rule = re.search(r'\.heroAura\s*\{.*?\}', html, re.S)
assert hero_aura_rule and "var(--accent)" not in hero_aura_rule.group(0)
assert "@media(max-width:880px)" in html
assert re.search(r'@media\(max-width:880px\).*?\.hero\s*\{[^}]*min-height:auto', html, re.S)
assert re.search(r'@media\(max-height:720px\).*?\.hero \.stagewrap\{[^}]*470px', html, re.S)
assert re.search(r'\.hero \.stagewrap\s*\{[^}]*620px', html, re.S)
assert re.search(r'@media\(max-width:760px\).*?\.cases\s*\{[^}]*margin-top:var\(--sp-16\)', html, re.S)
assert re.search(r'\.csTabs::before\s*\{[^}]*inset-inline:var\(--case-inset\)', html, re.S)

engine = Path("hero-engine.js").read_text(encoding="utf-8")
assert "aboutOpen" not in engine
assert 'document.documentElement.classList.add("softScrolling")' in engine
assert 'document.documentElement.classList.remove("softScrolling")' in engine
assert "scrollPaddingTop" in engine
assert "recalcFollowCap" not in engine
assert "cursorGlow" not in engine
assert 'btn.focus()' in engine
assert 'e.key==="Escape"' in engine
assert 'bar.contains(e.target)' in engine
assert 'var MAP={empathy:startRain,hunger:moodEat,delight:startParty,love:startLove}' in engine

print("hero specimen structure: OK")
