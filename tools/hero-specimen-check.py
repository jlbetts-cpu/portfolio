#!/usr/bin/env python3
"""Static contract checks for Home's minimal time-aware hero."""

from pathlib import Path
import re


html = Path("index.html").read_text(encoding="utf-8")
time_css = Path("hero-time.css").read_text(encoding="utf-8")
site_theme_css = Path("site-theme.css").read_text(encoding="utf-8")
time_controller_path = Path("hero-time.js")
assert time_controller_path.exists(), "hero time controller must exist"
time_controller = time_controller_path.read_text(encoding="utf-8")
hero_engine = Path("hero-engine.js").read_text(encoding="utf-8")

for forbidden_renderer_contract in (
    "new FluidMesh",
    "IntersectionObserver",
    "heroTimeCanvas",
    "heroTimeBloom",
    "timeFallback",
):
    assert forbidden_renderer_contract not in time_controller, forbidden_renderer_contract

assert '<link rel="stylesheet" href="hero-time.css">' in html
for node_id in (
    "heroTimeSpill",
    "heroTimeClip",
    "heroTimeBtn",
    "heroTimeMenu",
    "heroTimePortraitCast",
):
    assert f'id="{node_id}"' in html, node_id
assert re.search(r'id="heroTimeBtn"[^>]+aria-controls="heroTimeMenu"', html)
assert html.index('id="workBtn"') < html.index('id="heroTimeBtn"') < html.index('class="heroTimeSupport"')
assert html.count('data-time-mode="') == 8
assert html.index('id="heroTimeSpill"') < html.index('id="main"')
assert html.index('id="heroTimeClip"') < html.index('class="heroCopy"')
assert html.count('class="heroTimeGradient"') == 6
for state in ("pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night"):
    assert html.count(f'data-time-gradient="{state}"') == 1, state
assert re.search(r'id="face"[^>]*><img id="heroTimePortraitCast"', html)
assert 'id="moodBtn"' not in html
assert 'id="moodMenu"' not in html
assert 'data-mood=' not in html
assert 'document.body.classList.add("heroEmpathy")' in hero_engine
assert 'document.body.classList.remove("heroEmpathy")' in hero_engine
assert re.search(r'body\.heroEmpathy \.jbStick \.jbNav\s*\{[^}]*--nav-mat:var\(--theme-page', html, re.S)
assert not re.search(r'<section class="hero"[^>]+data-time-state="daytime"', html)
assert not re.search(r'id="heroTimeIcon"[^>]+data-icon="daytime"', html)
prepaint = re.search(r'<script id="heroTimePrepaint">(.*?)</script>', html, re.S)
assert prepaint, "the complete root snapshot must reach Home controls during parsing"
for prepaint_contract in (
    "data-theme-mode",
    "data-theme-state",
    "data-reduced-motion",
    "heroTimeIcon",
    "menuitemradio",
    "aria-checked",
):
    assert prepaint_contract in prepaint.group(1), prepaint_contract
assert "heroTimeAutoState" not in html
assert "heroTimeAutoState" not in time_controller
assert html.index('href="header.css"') < html.index('href="hero-time.css"')
assert 'src="fluid-mesh.js"' not in html, "FluidMesh belongs to Gradient Maker, not the Hero"
assert '<script src="hero-time-presets.js"></script>' not in html
assert '<script src="hero-engine.js"></script>' not in html
assert '<script src="hero-time.js"></script>' in html
clip_start = html.index('id="heroTimeClip"')
clip_end = html.index('class="heroCopy"', clip_start)
clip_markup = html[clip_start:clip_end]
assert clip_markup.count('class="heroTimeGradient"') == 6, "six gradients must live in the clip"

movie_layer = re.search(
    r'<div class="heroMovieEffectsClip" id="heroMovieEffectsClip" aria-hidden="true">\s*'
    r'<div class="heroMovieEffectsStage" id="heroMovieEffectsStage"></div>\s*</div>',
    html,
)
assert movie_layer, "the Hero needs a dedicated movie-effects clip and stage host"
assert html.index('id="stage"') < movie_layer.start() < html.index("</section>", movie_layer.start())

movie_clip_rule = re.search(r'\.heroMovieEffectsClip\s*\{.*?\}', html, re.S)
assert movie_clip_rule
for movie_clip_contract in (
    "position:absolute",
    "inset:0",
    "overflow:clip",
    "border-radius:inherit",
    "corner-shape:inherit",
    "pointer-events:none",
):
    assert movie_clip_contract in movie_clip_rule.group(0), movie_clip_contract

movie_stage_rule = re.search(r'\.heroMovieEffectsStage\s*\{.*?\}', html, re.S)
assert movie_stage_rule
for movie_stage_contract in (
    "position:absolute",
    "width:0",
    "height:0",
    "transform-origin:50% 50%",
    "pointer-events:none",
):
    assert movie_stage_contract in movie_stage_rule.group(0), movie_stage_contract

for controller_contract in (
    "window.SiteTheme",
    "siteTheme.subscribe",
    "siteTheme.setMode",
    "captureScene",
    "transitionScene",
    "clearSceneAnimations",
    ".animate(",
    "fill:\"both\"",
    "jbthemesettle",
    "MutationObserver",
    "attributeFilter:[\"src\",\"srcset\",\"sizes\"]",
    "ArrowDown",
    "ArrowUp",
    "Home",
    "End",
    "Escape",
    "aria-checked",
    "opensAbove",
):
    assert controller_contract in time_controller, controller_contract
for forbidden_owner_contract in (
    "jbHeroTimeMode",
    "sessionStorage",
    "setTimeout",
    "new Date",
    "msUntilNextBoundary",
    "heroTimeHeaderScene",
    "requestAnimationFrame",
    "cancelAnimationFrame",
):
    assert forbidden_owner_contract not in time_controller, forbidden_owner_contract

time_control = re.search(r'<button class="heroTimeBtn"[^>]*>.*?</button>', html, re.S)
assert time_control
assert 'aria-label="Time of day"' in time_control.group(0)
assert 'aria-haspopup="menu"' in time_control.group(0)
assert 'aria-expanded="false"' in time_control.group(0)
assert '<svg class="heroTimeIcon uiIcon"' in time_control.group(0)
assert not re.sub(r"<[^>]+>", "", time_control.group(0)).strip()
assert re.search(r'id="heroTimeMenu"[^>]+role="menu"[^>]+aria-label="Choose time of day"', html)
assert len(re.findall(r'<button[^>]+role="menuitemradio"', html)) == 8
assert html.count('role="menuitemradio" aria-checked="true"') == 1
assert html.count('class="heroTimeOptionIcon uiIcon"') == 8
icon_symbols = {
    "auto": "lucide-rotate-ccw",
    "off": "lucide-circle-off",
    "pre-dawn": "lucide-moon-star",
    "sunrise": "lucide-sunrise",
    "daytime": "lucide-sun",
    "dusk": "lucide-cloud-sun",
    "sunset": "lucide-sunset",
    "night": "lucide-moon",
}
for mode, symbol_id in icon_symbols.items():
    assert f'id="{symbol_id}"' in Path("ui-icons.svg").read_text(encoding="utf-8"), symbol_id
    item = re.search(rf'<button[^>]+data-time-mode="{mode}"[^>]*>(.*?)</button>', html, re.S)
    assert item and 'class="heroTimeOptionIcon uiIcon"' in item.group(1), mode
    assert 'aria-hidden="true"' in item.group(1), mode
    assert f'href="ui-icons.svg#{symbol_id}"' in item.group(1), mode
for state, symbol_id in ((key, value) for key, value in icon_symbols.items() if key != "auto"):
    trigger_glyph = re.search(rf'<g data-hero-time-icon="{state}">(.*?)</g>', html, re.S)
    assert trigger_glyph and f'href="ui-icons.svg#{symbol_id}"' in trigger_glyph.group(1), state
assert "heroTimeGlyph" not in html

time_button_rules = re.findall(r'\.heroTimeBtn\s*\{.*?\}', time_css, re.S)
time_button_rule = next((rule for rule in time_button_rules if "min-width:var(--tap-min)" in rule), None)
assert time_button_rule
for target_rule in ("width:var(--tap-min)", "height:var(--tap-min)", "min-width:var(--tap-min)", "min-height:var(--tap-min)"):
    assert target_rule in time_button_rule, target_rule
for icon_class in ("heroTimeIcon", "heroTimeOptionIcon"):
    icon_rule = re.search(rf'\.{icon_class}\s*\{{.*?\}}', time_css, re.S)
    assert icon_rule, icon_class
    for icon_contract in ("stroke-width:1.75", "stroke-linecap:round", "stroke-linejoin:round"):
        assert icon_contract in icon_rule.group(0), f"{icon_class}: {icon_contract}"

rim_overlay = re.search(r'\.hero::after\s*\{.*?\}', time_css, re.S)
assert rim_overlay, "hero rim must paint above positioned atmosphere layers"
for rim_rule in ("pointer-events:none", "box-shadow:var(--time-rim)", "border-radius:inherit"):
    assert rim_rule in rim_overlay.group(0), rim_rule
rim_z = re.search(r'z-index:(\d+)', rim_overlay.group(0))
assert rim_z and int(rim_z.group(1)) > 1
clip_rule = re.search(r'\.heroTimeClip\s*\{.*?\}', time_css, re.S)
assert clip_rule, "hero gradient clip must exist"
for clip_contract in ("position:absolute", "inset:0", "overflow:hidden", "border-radius:inherit", "pointer-events:none"):
    assert clip_contract in clip_rule.group(0), clip_contract
gradient_rule = re.search(r'\.heroTimeGradient\s*\{.*?\}', time_css, re.S)
assert gradient_rule, "full-size gradient layers must exist"
for gradient_contract in ("position:absolute", "inset:0", "opacity:0", "filter:none", "mix-blend-mode:normal"):
    assert gradient_contract in gradient_rule.group(0), gradient_contract
assert "transition:opacity" not in gradient_rule.group(0)
hero_rule = re.search(r'\.hero\s*\{.*?\}', time_css, re.S)
assert hero_rule and "background-color:var(--time-base)" in hero_rule.group(0)
assert "--time-secondary-bg:var(--time-base)" in hero_rule.group(0)
for opaque_state in ("off", "pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night"):
    state_material = re.search(rf'\.hero\[data-time-state="{opaque_state}"\]\s*\{{(.*?)\}}', time_css, re.S)
    assert state_material and "--time-secondary-bg:var(--time-base)" in state_material.group(1), opaque_state
    assert "--time-menu-bg:var(--time-base)" in state_material.group(1), opaque_state
assert "transition:background-color var(--hero-time-duration) var(--hero-time-ease)" in hero_rule.group(0)
assert "overflow:visible" in hero_rule.group(0), "the clipped gradient child, not the hero, must own overflow"
spill_rule = re.search(r'\.heroTimeSpill\s*\{.*?\}', time_css, re.S)
assert spill_rule, "Night needs a page-level ambient spill"
for spill_contract in ("position:absolute", "top:calc(", "bottom:calc(", "left:50%", "width:100vw", "transform:translateX(-50%)", "pointer-events:none", "opacity:0"):
    assert spill_contract in spill_rule.group(0), spill_contract
assert "linear-gradient(180deg" in spill_rule.group(0)
assert "bottom:calc((var(--sp-48-80) + var(--sp-64)) * -1)" in spill_rule.group(0)
assert "linear-gradient(180deg,#0b0c0f 0%,#0b0c0f calc(100% - var(--sp-48-80) - var(--sp-64))" in spill_rule.group(0)
assert "mask-image:linear-gradient(180deg" in spill_rule.group(0)
assert "radial-gradient" not in spill_rule.group(0), "spill cannot become a head-centered halo"
assert "transition:opacity" not in spill_rule.group(0)
assert re.search(r'\.hero\[data-time-state="night"\] ~ .*', time_css, re.S) is None
assert re.search(r':root\[data-theme="dark"\]', site_theme_css)
assert "heroTimeHeaderScene" not in time_css
assert "data-time-state" not in time_css.split(".heroTimeSpill", 1)[1].split(".heroTimeClip", 1)[0], "header cutoff ownership must be gone"
assert re.search(r':root:root\s*\{[^}]*--theme-duration:var\(--hero-time-duration\)', time_css, re.S)
night_cases = re.search(r':root\[data-theme="dark"\] \.cases\s*\{(.*?)\}', time_css, re.S)
assert night_cases and "background:var(--theme-page)" in night_cases.group(1)
assert "transition:" not in night_cases.group(1), "dark values cannot own one direction of a symmetric transition"
ready_cases = re.search(r':root\.theme-ready \.cases\s*\{(.*?)\}', time_css, re.S)
assert ready_cases and "transition:background-color" in ready_cases.group(1)
ready_text = re.search(r':root\.theme-ready :is\(\.csTab,\.csName,\.csYear,\.footReach,\.footIn\)\s*\{(.*?)\}', time_css, re.S)
assert ready_text and "transition:color" in ready_text.group(1)
reduced_chrome = re.search(r':root\[data-reduced-motion="reduce"\](.*?)\{(.*?)\}', time_css, re.S)
assert reduced_chrome and "transition:none!important" in reduced_chrome.group(2)
for reduced_target in (".cases", ".csTabs::before", ".csTabInk", ".csMeta", ".footReach", ".footIn"):
    assert reduced_target in reduced_chrome.group(1), reduced_target
for selector, token in (
    (r'\.csTab\.on', "var(--theme-ink)"),
    (r'\.csName', "var(--theme-ink)"),
    (r'\.csYear', "var(--theme-muted)"),
    (r'\.footReach', "var(--theme-muted)"),
    (r'\.footIn', "var(--theme-ink)"),
):
    assert re.search(rf':root\[data-theme="dark"\] {selector}\s*\{{[^}}]*color:{re.escape(token)}', time_css, re.S), selector
active_floor_rule = re.search(
    r'\.hero\[data-time-state\]:not\(\[data-time-state="off"\]\) \.floorshadow\s*\{.*?\}',
    time_css,
    re.S,
)
assert active_floor_rule, "active time gradients must not carry a dark floor oval"
normal_time_css = time_css.split("@media(forced-colors:active)", 1)[0]
for floor_contract in ("background:none!important", "opacity:0!important", "filter:none!important"):
    assert floor_contract in active_floor_rule.group(0), floor_contract
normal_floor_rules = re.findall(r'([^{}]*\.floorshadow[^{}]*)\{([^{}]*)\}', normal_time_css, re.S)
assert not any(
    '[data-time-state="off"]' in selectors and ':not([data-time-state="off"])' not in selectors
    for selectors, _ in normal_floor_rules
)
for floor_selectors, floor_declarations in normal_floor_rules:
    if ':not([data-time-state="off"])' not in floor_selectors:
        assert not re.search(r'(?:^|;)\s*(?:background|opacity|filter)\s*:', floor_declarations), floor_selectors.strip()
assert "time-orb" not in time_css, "gradient layers must fill the hero, not use a 1:1 orb"
for forbidden_texture in ("heroTimeRay", "heroTimeLine", "heroTimeFilament", "heroTimeGrain"):
    assert forbidden_texture not in time_css and forbidden_texture not in html, forbidden_texture
assert re.search(r'\.hero\[data-time-state\] \.heroAura\s*\{[^}]*display:none', time_css, re.S)
assert re.search(
    r'\.hero\[data-time-state="off"\].*?\.heroAura.*?display:none',
    time_css,
    re.S,
), "Off must hard-hide the gradient clip and original hero aura"
for off_layer in ("heroAura", "heroTimePortraitCast"):
    assert re.search(
        rf'\.hero\[data-time-state="off"\] \.{off_layer}(?:,|\s*\{{).*?\{{[^}}]*display:none',
        time_css,
        re.S,
    ), off_layer
for crossfade_layer in ("heroTimeSpill", "heroTimeClip", "heroTimeGradient"):
    assert not re.search(
        rf'\.hero\[data-time-state="off"\] \.{crossfade_layer}(?:,|\s*\{{).*?\{{[^}}]*display:none',
        time_css,
        re.S,
    ), f"{crossfade_layer} must remain paintable long enough to crossfade Off"

assert "--hero-time-duration:640ms" in time_css
assert "--hero-time-ease:cubic-bezier(.22,1,.36,1)" in time_css
mobile_time = re.search(r'@media\(max-width:760px\)\s*\{(.*?)\n\}', time_css, re.S)
assert mobile_time and "--hero-time-duration:420ms" in mobile_time.group(1)
assert "body[data-time-state]" not in time_css

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
assert ".heroTimeClip" in forced_colors.group(1), "forced colors must remove the decorative gradients"
assert ".heroTimeSpill" in forced_colors.group(1), "forced colors must remove the ambient spill"
assert re.search(r'\.hero::after\s*\{[^}]*border:var\(--hair-w\) solid CanvasText;[^}]*box-shadow:none', forced_colors.group(1), re.S)

portrait_rules = re.findall(r'\.heroTimePortraitCast\s*\{.*?\}', time_css, re.S)
portrait_shell = next((rule for rule in portrait_rules if "position:absolute" in rule), None)
assert portrait_shell
for svg_contract in (
    'id="heroPortraitTintFilter"',
    'id="heroPortraitTintFlood"',
    '<feFlood',
    'in2="SourceAlpha"',
    'operator="in"',
):
    assert svg_contract in html, svg_contract
for cast_contract in (
    "display:block",
    "visibility:visible",
    "opacity:var(--time-cast-opacity)",
    "mix-blend-mode:screen",
    "var(--time-light-x)",
    "var(--time-light-y)",
    "url(#heroPortraitTintFilter)",
    "mask-image:radial-gradient",
    "background:none",
    "border:0",
    "outline:0",
):
    assert cast_contract in portrait_shell, cast_contract
assert "border-radius" not in portrait_shell
assert "box-shadow" not in portrait_shell
assert "drop-shadow" not in portrait_shell
assert "ellipse 52% 39% at var(--time-light-x) var(--time-light-y)" in portrait_shell
assert "hue-rotate" not in time_css, "portrait lighting must not rotate skin hue"

active_states = ("pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night")
expected_casts = {
    "pre-dawn": ("#9ab0ff", .22, 34, 82),
    "sunrise": ("#ffb58c", .25, 32, 82),
    "daytime": ("#eaf2ff", .16, 50, 84),
    "dusk": ("#c8bceb", .20, 62, 82),
    "sunset": ("#ffb58c", .26, 68, 82),
    "night": ("#9ab0ff", .24, 66, 82),
}
state_materials = {}
for state in active_states:
    state_rule = re.search(rf'\.hero\[data-time-state="{state}"\]\s*\{{(.*?)\}}', time_css, re.S)
    assert state_rule, state
    opacity = re.search(r'--time-cast-opacity:(\.?\d+)', state_rule.group(1))
    assert opacity, state
    light_x = re.search(r'--time-light-x:(\d+(?:\.\d+)?)%', state_rule.group(1))
    light_y = re.search(r'--time-light-y:(\d+(?:\.\d+)?)%', state_rule.group(1))
    assert light_x and light_y, state
    cast = re.search(r'--time-cast:([^;]+)', state_rule.group(1)).group(1).strip().lower()
    expected_color, expected_opacity, expected_x, expected_y = expected_casts[state]
    assert cast == expected_color, (state, cast)
    assert float(opacity.group(1)) == expected_opacity, state
    assert float(light_x.group(1)) == expected_x, state
    assert float(light_y.group(1)) == expected_y, state
    state_materials[state] = {
        "opacity": float(opacity.group(1)),
        "x": float(light_x.group(1)),
        "cast": cast,
    }
    for directional_contract in ("--time-cast:", "--time-light-x:", "--time-light-y:"):
        assert directional_contract in state_rule.group(1), f"{state}: {directional_contract}"

assert state_materials["pre-dawn"]["x"] < 50
assert state_materials["sunrise"]["x"] < 50
assert state_materials["daytime"]["x"] == 50
assert state_materials["dusk"]["x"] > 50
assert state_materials["sunset"]["x"] > state_materials["dusk"]["x"]
assert state_materials["night"]["x"] > 50
assert state_materials["night"]["opacity"] == .24

off_material = re.search(r'\.hero\[data-time-state="off"\]\s*\{(.*?)\}', time_css, re.S)
assert off_material
for off_contract in (
    "--time-cast:transparent",
    "--time-cast-opacity:0",
):
    assert off_contract in off_material.group(1), off_contract

# Night's atmosphere must resolve into the same near-black as the site rather
# than producing a blue halo outside the outlined Hero.
night_gradient = re.search(r'\.heroTimeGradient\[data-time-gradient="night"\]\{background:(.*?)\}', time_css, re.S)
assert night_gradient and "#0b0c0f 100%" in night_gradient.group(1).lower()
spill = re.search(r'\.heroTimeSpill\s*\{(.*?)\}', time_css, re.S)
assert spill and "#0b0c0f" in spill.group(1).lower()
assert "#141e4b 0%" not in spill.group(1).lower()

# The source portrait stays identity-only. Lighting is confined to the duplicate
# cast image and neither CSS nor the Mood engine may filter #face itself.
all_css = html + "\n" + time_css
for selectors, declarations in re.findall(r'([^{}]+)\{([^{}]*)\}', all_css, re.S):
    exact_face_selector = any(
        re.search(r'(?<![A-Za-z0-9_-])(?:#face|\.face)(?![A-Za-z0-9_-])', selector)
        for selector in selectors.split(",")
    )
    if exact_face_selector:
        assert not re.search(r'(?:^|;)\s*(?:-webkit-)?filter\s*:', declarations), selectors.strip()
for forbidden_face_filter in (
    "face.style.filter",
    "faceImg.style.filter",
    "face.style.setProperty(\"filter\"",
    "faceImg.style.setProperty(\"filter\"",
):
    assert forbidden_face_filter not in time_controller + hero_engine, forbidden_face_filter

night_state = re.search(r'\.hero\[data-time-state="night"\]\s*\{(.*?)\}', time_css, re.S)
assert night_state
for material_contract in (
    "--time-primary-bg:var(--c50)",
    "--time-secondary-bg:var(--time-base)",
    "--time-secondary-hover-bg:var(--time-base)",
    "--time-secondary-border:rgba(244,245,247,.28)",
    "--time-secondary-hover-border:rgba(244,245,247,.42)",
    "--time-menu-bg:var(--time-base)",
):
    assert material_contract in night_state.group(1), material_contract
night_nav = re.search(r':root\[data-theme="dark"\] \.jbNav\s*\{(.*?)\}', time_css, re.S)
assert night_nav
for nav_material_contract in (
    "--nav-mat:var(--theme-page)",
    "--nav-hover-bg:rgba(244,245,247,.10)",
    "--nav-active-bg:rgba(244,245,247,.14)",
):
    assert nav_material_contract in night_nav.group(1), nav_material_contract
assert "backdrop-filter" not in night_nav.group(1)
assert not re.search(
    r'\.hero\[data-time-state="night"\] :is\(\.heroMood \.moodBtn,\.heroTimeBtn\)\s*\{[^}]*backdrop-filter:blur\(12px\)',
    time_css,
    re.S,
)

exact_gradients = {
    "pre-dawn": "radial-gradient(103.24% 102.63% at 50% 102.63%,#486ffd 0,#7f81f3 9.84%,#c489ff 20.83%,#dac0ff 34.13%,#eadcff 44.86%,#f9f6ff 58.59%,#f8fafd 100%)",
    "sunrise": "radial-gradient(102.68% 99.11% at 50% 104.6%,#cb83ff 0,#ff90b9 15.77%,#ffc977 30.62%,#ffd79b 38.04%,#fff1dc 50.11%,#fff 63.1%,#fcfdfe 77.95%,#f8fafd 98.81%)",
    "daytime": "radial-gradient(102.84% 104.98% at 50% 104.98%,#0071c1 1.33%,#60a8e2 15.71%,#b4d8ff 33.15%,#d9ebff 45%,#f8fafd 60%)",
    "dusk": "radial-gradient(102.83% 103.24% at 49.98% 104.51%,#ffb36a 0,#dfa0d8 14%,#9da8e4 30%,#ccd5f0 44%,#f1f3fa 58%,#f8fafd 100%)",
    "sunset": "radial-gradient(103.12% 100% at 50% 100%,#ffa577 0,#ff90a1 15.52%,#ddadff 30.09%,#ecd8ff 45.72%,#f5eaff 54.96%,#f8fafd 88.16%)",
    "night": "radial-gradient(102.82% 106.44% at 50% 106.44%,#fcfdfe 1.11%,#6763e4 28.73%,#453bb3 45.76%,#29227d 63.37%,#17194f 80%,#0b0c0f 100%)",
}
for state, exact_gradient in exact_gradients.items():
    layer_rule = re.search(
        rf'\.heroTimeGradient\[data-time-gradient="{state}"\]\s*\{{(.*?)\}}',
        time_css,
        re.S,
    )
    assert layer_rule and f"background:{exact_gradient}" in layer_rule.group(1), state
    assert "transparent" not in layer_rule.group(1), state
    assert re.search(
        rf'\.hero\[data-time-state="{state}"\] \.heroTimeGradient\[data-time-gradient="{state}"\]\s*\{{[^}}]*opacity:1',
        time_css,
        re.S,
    ), state

assert 'class="jbDisc jbPlay"' not in html
assert re.search(r'<a[^>]+data-nav-item="games"[^>]+href="play\.html"', html)
assert re.search(r'<a[^>]+id="workBtn"[^>]+href="#cases"', html)
work_control = re.search(r'<a[^>]+id="workBtn".*?</a>', html, re.S)
assert work_control and "<svg" not in work_control.group(0)
assert 'id="moodbar"' not in html and 'class="heroMood' not in html
assert html.index('id="h1"') < html.index('id="heroTimeBtn"') < html.index('class="heroTimeSupport"')
assert '<h1 id="h1">SF product designer. iOS, B2C and design systems.</h1>' in html

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
assert re.search(r'\.hero\s*\{[^}]*min-height:calc\(100svh - 88px\)', html, re.S)
assert re.search(r'\.heroCopy\s*\{[^}]*transform:translateY\(clamp\(-80px,-8svh,-48px\)\)', html, re.S)
assert re.search(r'\.heroTimeSupport\s*\{[^}]*display:none!important', html, re.S)
assert re.search(r'\.heroCtas>\*\s*\{[^}]*opacity:1;[^}]*transform:none', html, re.S)
assert re.search(r'#loveScene\s*\{[^}]*z-index:\s*64', html, re.S)
assert re.search(r'@media\(max-width:760px\).*?\.cases\s*\{[^}]*margin-top:var\(--sp-16\)', html, re.S)
assert re.search(r'\.csTabs::before\s*\{[^}]*inset-inline:var\(--case-inset\)', html, re.S)

engine = hero_engine
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

movie_section = engine[engine.index("/* ===== popcorn movie-watching mode"):engine.index("function startRain()")]
assert 'const movieEffectsStage=document.getElementById("heroMovieEffectsStage");' in engine
ensure_movie = re.search(r"function ensureMovieEls\(\)\{.*?\n\}", movie_section, re.S)
assert ensure_movie
assert "var host=movieEffectsStage||stage;" in ensure_movie.group(0)
assert ensure_movie.group(0).count("host.appendChild(") == 3
for legacy_mount in (
    "stage.appendChild(bucketEl)",
    "stage.appendChild(k)",
    "stage.appendChild(cc)",
):
    assert legacy_mount not in ensure_movie.group(0), legacy_mount

sync_movie = re.search(r"function syncMovieEffectsLayer\(\)\{.*?\n\}", movie_section, re.S)
transform_movie = re.search(r"function setMovieStageTransform\(value\)\{.*?\n\}", movie_section, re.S)
assert sync_movie and "stage.getBoundingClientRect()" in sync_movie.group(0)
assert "movieEffectsStage.parentNode.getBoundingClientRect()" in sync_movie.group(0)
assert transform_movie and "stage.style.transform=value;" in transform_movie.group(0)
assert "movieEffectsStage.style.transform=value;" in transform_movie.group(0)
assert start_movie.group(0).index("ensureMovieEls();") < start_movie.group(0).index("syncMovieEffectsLayer();")
assert movie_section.count("stage.style.transform=") == 3, "movie transforms must stay mirrored to the clip host"

case_enter = re.search(r"function enter\(f,e\)\{.*?\}\n\s*function leave", html, re.S)
assert case_enter and "startMovie" not in case_enter.group(0)
assert 'activeHover="smile"' not in case_enter.group(0)
case_leave = re.search(r"function leave\(f\)\{.*?\}\n", html, re.S)
assert case_leave and "caughtMovie" not in case_leave.group(0)

print("hero specimen structure: OK")
