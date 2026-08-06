#!/usr/bin/env python3
"""Static contract checks for the home-page specimen-frame hero."""

from pathlib import Path
import re


html = Path("index.html").read_text(encoding="utf-8")

assert 'class="jbDisc jbPlay"' not in html
assert re.search(r'<a[^>]+data-nav-item="games"[^>]+href="play\.html"', html)
assert re.search(r'<a[^>]+id="workBtn"[^>]+href="#cases"', html)
assert 'id="moodbar"' in html and 'class="heroMood' in html
assert re.search(r'<button[^>]+id="moodBtn"[^>]+aria-controls="moodMenu"', html)
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
    r'\.hero\s*\{[^}]*border:\s*var\(--hair-w\)\s+solid\s+var\(--c100\)',
    html,
    re.S,
)
assert ".heroAura" in html
hero_aura_rule = re.search(r'\.heroAura\s*\{.*?\}', html, re.S)
assert hero_aura_rule and "var(--accent)" not in hero_aura_rule.group(0)

engine = Path("hero-engine.js").read_text(encoding="utf-8")
assert 'btn.focus()' in engine
assert 'e.key==="Escape"' in engine
assert 'bar.contains(e.target)' in engine
assert 'var MAP={empathy:startRain,hunger:moodEat,delight:startParty,love:startLove}' in engine

print("hero specimen structure: OK")
