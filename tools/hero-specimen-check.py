#!/usr/bin/env python3
"""Static contract checks for the home-page specimen-frame hero."""

from pathlib import Path
import re


html = Path("index.html").read_text(encoding="utf-8")
time_css = Path("hero-time.css").read_text(encoding="utf-8")

assert '<link rel="stylesheet" href="hero-time.css">' in html
for node_id in (
    "heroTimeCanvas",
    "heroTimeBloom",
    "heroTimeBtn",
    "heroTimeMenu",
    "heroTimePortraitCast",
):
    assert f'id="{node_id}"' in html, node_id
assert re.search(r'id="heroTimeBtn"[^>]+aria-controls="heroTimeMenu"', html)
assert html.index('id="moodbar"') < html.index('id="heroTimeBtn"') < html.index('class="stagewrap"')
assert html.count("data-time-mode=") == 8
assert html.index('id="heroTimeCanvas"') < html.index('id="heroTimeBloom"') < html.index('class="heroCopy"')
assert re.search(r'id="face"[^>]*><img id="heroTimePortraitCast"', html)
assert html.index('href="header.css"') < html.index('href="hero-time.css"')
assert html.index('src="fluid-mesh.js"') < html.index('src="hero-time-presets.js"') < html.index('src="hero-engine.js"')

time_control = re.search(r'<button class="heroTimeBtn"[^>]*>.*?</button>', html, re.S)
assert time_control
assert 'aria-label="Time of day"' in time_control.group(0)
assert 'aria-haspopup="menu"' in time_control.group(0)
assert 'aria-expanded="false"' in time_control.group(0)
assert '<svg class="heroTimeIcon"' in time_control.group(0)
assert not re.sub(r"<[^>]+>", "", time_control.group(0)).strip()
assert re.search(r'id="heroTimeMenu"[^>]+role="menu"[^>]+aria-label="Choose time of day"', html)
assert html.count('role="menuitemradio"') == 8
assert html.count('role="menuitemradio" aria-checked="true"') == 1

time_button_rules = re.findall(r'\.heroTimeBtn\s*\{.*?\}', time_css, re.S)
time_button_rule = next((rule for rule in time_button_rules if "min-width:var(--tap-min)" in rule), None)
assert time_button_rule
for target_rule in ("width:var(--tap-min)", "height:var(--tap-min)", "min-width:var(--tap-min)", "min-height:var(--tap-min)"):
    assert target_rule in time_button_rule, target_rule

rim_overlay = re.search(r'\.hero::after\s*\{.*?\}', time_css, re.S)
assert rim_overlay, "hero rim must paint above positioned atmosphere layers"
for rim_rule in ("pointer-events:none", "box-shadow:var(--time-rim)", "border-radius:inherit"):
    assert rim_rule in rim_overlay.group(0), rim_rule
rim_z = re.search(r'z-index:(\d+)', rim_overlay.group(0))
assert rim_z and int(rim_z.group(1)) > 1
assert re.search(r'\.heroTimeCanvas\s*\{[^}]*z-index:0', time_css, re.S)
assert re.search(r'\.heroTimeBloom\s*\{[^}]*z-index:1', time_css, re.S)

menu_rule = re.search(r'\.heroTimeMenu\s*\{.*?\}', time_css, re.S)
assert menu_rule and "right:0" in menu_rule.group(0)
assert "width:min(var(--menu-w),calc(50vw + var(--sp-6)))" in menu_rule.group(0)
assert "max-width:calc(100vw - (var(--sp-16) * 2))" in menu_rule.group(0)
assert re.search(r'\.heroCtas\s*\{[^}]*justify-content:center;[^}]*flex-wrap:wrap', html, re.S)
assert re.search(r'\.heroTime\.opensAbove \.heroTimeMenu\s*\{[^}]*top:auto;bottom:', time_css, re.S)

off_state = re.search(r'\.hero\[data-time-state="off"\]\s*\{.*?\}', time_css, re.S)
assert off_state and "--time-secondary-hover-border:var(--c500)" in off_state.group(0)
assert re.search(
    r'\.hero\[data-time-state\] \.heroMood \.moodBtn:hover,.*?border-color:var\(--time-secondary-hover-border\)',
    time_css,
    re.S,
)
forced_colors = re.search(r'@media\(forced-colors:active\)\s*\{(.*)\n\}', time_css, re.S)
assert forced_colors
assert re.search(r'\.hero::after\s*\{[^}]*border:var\(--hair-w\) solid CanvasText;[^}]*box-shadow:none', forced_colors.group(1), re.S)

for state in ("pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night"):
    state_rule = re.search(rf'\.hero\[data-time-state="{state}"\]\s*\{{.*?\n\}}', time_css, re.S)
    assert state_rule, state
    fallback = re.search(r'--time-fallback:(.*?);', state_rule.group(0), re.S)
    assert fallback, state
    arcs = re.findall(
        r'radial-gradient\(ellipse\s+(\d+)%\s+\d+%\s+at\s+\d+%\s+(\d+)%',
        fallback.group(1),
    )
    assert len(arcs) >= 3, state
    assert all(int(width) >= 80 and int(origin_y) > 100 for width, origin_y in arcs), state

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
assert re.search(r'\.heroMood \.moodLbl\s*\{[^}]*font:\s*inherit', html, re.S)
assert re.search(r'#loveScene\s*\{[^}]*z-index:\s*64', html, re.S)
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

# Case-study covers reuse the reel's single popcorn/glasses performance. Keep
# the glasses transition inside movie mode so every trigger gets the complete
# animation, and never leave the old smile hover state behind after cleanup.
assert re.search(r"function glassesOn\(\).*?classList\.add\(\"on\"\)", engine, re.S)
start_movie = re.search(r"function startMovie\(word\)\s*\{.*?\n\}", engine, re.S)
assert start_movie and "glassesOn();" in start_movie.group(0)
assert "function glOn()" not in engine

case_enter = re.search(r"function enter\(f,e\)\{.*?\}\s*// project cards", html, re.S)
assert case_enter and "startMovie(csw)" in case_enter.group(0)
assert 'activeHover="smile"' not in case_enter.group(0)
case_leave = re.search(r"function leave\(f\)\{.*?\}\n", html, re.S)
assert case_leave and "caughtMovie()" in case_leave.group(0)

print("hero specimen structure: OK")
