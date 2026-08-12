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


def hour_block(state):
    """Every declaration the stylesheet makes for one hour, comments stripped.

    An hour is authored in SEVERAL blocks now -- the chrome materials, the
    lighting depths and the catchlight each live in their own section -- so a
    single re.search reads only the first and reports a token as missing when it
    is simply further down the file. Concatenating them is what makes the
    per-state assertions below mean "this hour declares X" rather than "the
    first block that mentions this hour declares X".
    """
    # [^{}]* rather than a non-greedy run to a "\n}": these rules contain no
    # nested braces, and a newline-anchored terminator silently swallows the
    # NEXT rule the moment someone reindents a closing brace -- which makes a
    # missing declaration look present because a neighbour supplied it. Caught
    # by mutation test, not by reading.
    bodies = re.findall(rf'\.hero\[data-time-state="{state}"\]\s*\{{([^{{}}]*)\}}', time_css)
    return re.sub(r"/\*.*?\*/", " ", "\n".join(bodies), flags=re.S)


for forbidden_renderer_contract in (
    "new FluidMesh",
    "IntersectionObserver",
    "heroTimeCanvas",
    "heroTimeBloom",
    "timeFallback",
):
    assert forbidden_renderer_contract not in time_controller, forbidden_renderer_contract

# The stylesheet links carry a cache-busting query string, so match the href up
# to it rather than the whole literal -- this assertion had been failing on an
# exact string that stopped existing when ?v= was introduced, which meant every
# check below it was dead code.
assert re.search(r'<link rel="stylesheet" href="hero-time\.css(?:\?[^"]*)?">', html)
for node_id in (
    "heroTimeSpill",
    "heroTimeClip",
    "heroTimeBtn",
    "heroTimeMenu",
    "heroTimePortraitCast",
):
    assert f'id="{node_id}"' in html, node_id
assert re.search(r'id="heroTimeBtn"[^>]+aria-controls="heroTimeMenu"', html)
assert html.index('id="workBtn"') < html.index('id="heroTimeBtn"') < html.index('class="heroTimeSupport')
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
# THE EMPATHY BAR'S MATERIAL, AND WHY THIS LINE CHANGED  (2026-08-10)
# This asserted --nav-mat:var(--theme-page) and had been failing since the
# header-material work. It was the TOOL that was stale, not the site: --theme-page
# is the paper (#FDFDFD), so pinning the bar to it put the bar's ground at 1.00:1
# against the page under it, and the only thing drawing the component was a 1.31:1
# hairline. header.css records the fix and Jayden's rule behind it -- "header should
# not be grey -- if anything it should be lighter than the background" -- so the bar
# went UP the ramp to --c0, which is what --ctl-ground resolves to in light. This
# assertion was demanding the bug back.
# It now also requires index.html and play.css to AGREE, because the override is
# written out in full in both and two copies of one rule is how a value drifts.
EMPATHY_BAR = (r'body\.heroEmpathy \.jbStick \.jbNav\s*\{[^}]*'
               r'--nav-mat:var\(--ctl-ground\)[^}]*--nav-rim:var\(--ctl-container-rim\)')
assert re.search(EMPATHY_BAR, html, re.S), \
    "index.html: the empathy bar must take the control ground, not the paper"
_play_css = Path("play.css").read_text(encoding="utf-8")
assert re.search(EMPATHY_BAR, _play_css, re.S), \
    "play.css carries the same override and has drifted from index.html's"
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
assert html.index('href="header.css') < html.index('href="hero-time.css')
assert 'src="fluid-mesh.js"' not in html, "FluidMesh belongs to Gradient Maker, not the Hero"
assert '<script src="hero-time-presets.js"></script>' not in html
# THIS LINE USED TO FORBID hero-engine.js ON THE HOME PAGE, and it was never
# satisfiable. index.html loads it at :1984 and always has; the engine's own
# header says it owns the nav, the reel, the About takeover and the Play menu on
# this page and that the head-only mode is the OPT-IN for other pages. So the
# assertion failed on every tree it was ever run against, including a pristine
# HEAD, and it taught everyone that this check is "expected" to be red -- which
# hides the twenty real assertions underneath it. A gate that has never once
# passed protects nothing.
#
# What actually matters is the ORDER. hero-head-transform.js reads state the
# engine publishes, and hero-time.js drives the sky the other two react to, so
# engine -> transform -> time is a dependency chain, not a preference. That is
# asserted instead, and it is a thing that can genuinely break.
for _script in ("hero-engine.js", "hero-head-transform.js", "hero-time.js"):
    assert '<script src="%s"></script>' % _script in html, \
        "index.html must load %s" % _script
assert (html.index('src="hero-engine.js"')
        < html.index('src="hero-head-transform.js"')
        < html.index('src="hero-time.js"')), \
    "hero scripts out of dependency order: engine, then transform, then time"
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
    # 0 0, NOT 50% 50%, AND THE CHANGE WAS THE FIX. The effects layer used to be
    # placed from the stage's axis-aligned BOUNDING BOX, which for a head resting
    # at -13.8deg is 22% larger than the stage, offset up and left, and level
    # while the head is not -- so the popcorn hung 36-45px below the chin and, at
    # 320 on a dragged head, 59px off the left edge of the phone. It now reads the
    # stage's real affine basis from three zero-size corner probes and writes it
    # as a matrix(), which requires the origin to be the layer's own top-left.
    # A centre origin would re-introduce exactly the offset that was removed.
    "transform-origin:0 0",
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
):
    assert controller_contract in time_controller, controller_contract
# ── THE MENU NO LONGER FLIPS, IT FITS  (was: "opensAbove") ───────────────────
# This required the string `opensAbove` in hero-time.js. That symbol exists in
# no source file on this tree, and shared-surfaces-contract.py -- which is green
# -- asserts its ABSENCE in both hero-time.js and hero-time.css. Two gates
# demanding opposite things about one symbol is how a red gate becomes furniture.
# opensAbove was the old strategy: measure, and if the menu would fall off the
# bottom, flip it above the button. It was replaced by positionMenu(), which
# caps the menu's height to the space that actually exists under the trigger and
# lets controls.css scroll the overflow (`overflow-y:auto`), then nudges it
# sideways off the viewport gutter. That is strictly better -- a flipped menu
# covers the control that opened it -- but it also has more that can rot, so it
# is asserted as a mechanism rather than as a class name: the gutter token must
# be read, the height must be capped, and the whole thing must be recomputed on
# resize or the cap is a one-shot measurement of a window that has since changed.
for menu_fit_contract in (
    "function positionMenu()",
    '"--menu-viewport-gutter"',
    'menu.style.setProperty("max-height"',
    'window.addEventListener("resize",positionMenu)',
    'window.removeEventListener("resize",positionMenu)',
):
    assert menu_fit_contract in time_controller, menu_fit_contract
assert "opensAbove" not in time_controller, \
    "the menu flip was replaced by positionMenu(); it must not come back"
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

# ── THE TRIGGER IS A .ctl NOW, SO ITS class= IS A LIST  ─────────────────────
# This matched `<button class="heroTimeBtn"` -- the class attribute had to be
# that one word and nothing else. The control system landed and the trigger
# became `class="heroTimeBtn ctl ctl--secondary ctl--icon"`, so the pattern
# stopped matching and every assertion about the trigger below it went dead:
# its label, its aria, its icon and the "no visible text" rule were all
# unenforced while this line was the one everybody saw fail.
# Matching on the id instead, and the class LIST is now asserted rather than
# assumed -- the four classes must all be present, which the old exact-string
# form could not express and which is the thing that actually breaks when
# someone hand-rolls the button again instead of using the library.
time_control = re.search(r'<button [^>]*id="heroTimeBtn"[^>]*>.*?</button>', html, re.S)
assert time_control, "the time trigger must be a <button> carrying id=heroTimeBtn"
_trigger_classes = set(
    re.search(r'class="([^"]*)"', time_control.group(0)).group(1).split())
assert {"heroTimeBtn", "ctl", "ctl--secondary", "ctl--icon"} <= _trigger_classes, \
    "the time trigger must be built from the control library: %s" % sorted(_trigger_classes)
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

# ── THE 44px TARGET MOVED TO THE LIBRARY, AND THAT IS THE POINT ─────────────
# This looked for a `.heroTimeBtn{...}` rule in hero-time.css carrying four
# copies of var(--tap-min). There is no `.heroTimeBtn` rule in hero-time.css at
# all any more: the trigger takes .ctl--icon, and controls.css sizes every icon
# control off --ctl-h once. Re-adding a private rule here to satisfy the old
# line would have been the regression -- a second owner of the tap target is
# exactly what the control library was built to remove.
# So what is asserted is the CHAIN that keeps the target at 44: the shared rule
# sizes on --ctl-h, --ctl-h resolves to --tap-min, and --tap-min is 44px. Any
# link breaking still fails, and it now also fails if hero-time.css starts
# competing for the trigger's box again.
assert not re.search(r'\.heroTimeBtn\s*\{', time_css), \
    "the time trigger's box belongs to .ctl--icon in controls.css, not to hero-time.css"
controls_css = Path("controls.css").read_text(encoding="utf-8")
# findall, not search: `.ctl--icon` also appears in grouped selectors above the
# sizing rule, and a bare search matches the first of those and reads the wrong
# declarations.
icon_ctl_rule = next((body for body in
                      re.findall(r'\.ctl--icon\s*\{([^}]*)\}', controls_css)
                      if "width:var(--ctl-h)" in body), None)
assert icon_ctl_rule, ".ctl--icon must size every icon control off --ctl-h"
for target_rule in ("width:var(--ctl-h)", "height:var(--ctl-h)", "min-width:var(--ctl-h)"):
    assert target_rule in icon_ctl_rule, target_rule
tokens_css = Path("tokens.css").read_text(encoding="utf-8")
assert "--ctl-h:var(--tap-min)" in tokens_css, "--ctl-h must resolve to the tap floor"
assert "--tap-min:44px" in tokens_css, "the tap floor must stay 44px"
# stroke-width was pinned at the literal 1.75 and the icon pack was moved onto
# --ico-stroke, which is the same decision expressed once for every icon on the
# site instead of twice here. The literal is what drifted; what must not is that
# both hero icons take the SAME token as everything else and keep round joins.
for icon_class in ("heroTimeIcon", "heroTimeOptionIcon"):
    icon_rule = re.search(rf'\.{icon_class}\s*\{{.*?\}}', time_css, re.S)
    assert icon_rule, icon_class
    for icon_contract in ("stroke-width:var(--ico-stroke)", "stroke-linecap:round",
                          "stroke-linejoin:round", "width:var(--ico-md)"):
        assert icon_contract in icon_rule.group(0), f"{icon_class}: {icon_contract}"
assert re.search(r'--ico-stroke:\s*[\d.]+', tokens_css), "--ico-stroke must be defined"

# ── THE HERO HAS NO RIM TO PAINT ABOVE ANYTHING ─────────────────────────────
# This required a `.hero::after` overlay carrying box-shadow:var(--time-rim),
# whose job was to lift the Hero's outline above the positioned atmosphere
# layers so the sky could not paint over its own border. The Hero went
# FULL-BLEED: it has no outline to protect any more. `.surface--hero` in
# controls.css sets box-shadow:none, `.hero` in hero-time.css sets box-shadow:
# none, and index.html's own rule sets box-shadow:none -- three places agreeing,
# and shared-surfaces-contract.py (green) asserts `.hero::after` is absent.
# Re-adding the overlay to satisfy this line would have drawn a rectangle
# through the middle of a full-bleed hero.
# --time-rim did NOT die with it: it is the colour of the portrait's rim LIGHT
# now, consumed by the drop-shadow chain on #face. So the absence is asserted on
# the SELECTOR, and the token is asserted to still be feeding the thing that
# actually uses it -- which the old line could not tell apart.
assert not re.search(r'\.hero::after\s*\{', time_css), \
    "the Hero is full-bleed and paints no rim; .hero::after must stay gone"
assert "box-shadow:none" in re.search(r'\.hero\s*\{.*?\}', time_css, re.S).group(0), \
    "a full-bleed Hero must not carry a box-shadow"
assert "--time-rim" in time_css and "var(--time-rim)" in re.search(
    r'\.hero\[data-time-state\] #face\s*\{.*?\n\}', time_css, re.S).group(0), \
    "--time-rim is the portrait's rim-light colour now and must reach the #face chain"
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
# ── THE SCENE'S TRANSITION IS LONGHANDS NOW, AND DELIBERATELY ───────────────
# This pinned the `transition:` SHORTHAND. The rule was rewritten to
# transition-property / -duration / -timing-function because the shorthand is
# what cost .csTab its motion when a theming rule replaced the list it
# inherited, and because the hour now animates nineteen registered custom
# properties -- nineteen repetitions of the same duration in a shorthand is an
# invitation to that same edit.
# The old line protected "the sky's background-color lands on the hour's own
# duration and curve". That is still asserted, and three things it could not say
# are added: every channel must share ONE duration and ONE curve (which is the
# actual design rule -- a sky on 640 with a rim on 400 reads as sloppy), and the
# shorthand must not come back.
assert "transition-duration:var(--hero-time-duration)" in hero_rule.group(0)
assert "transition-timing-function:var(--hero-time-ease)" in hero_rule.group(0)
_hero_props = re.search(r'transition-property:(.*?);', hero_rule.group(0), re.S)
assert _hero_props and "background-color" in _hero_props.group(1), \
    "the sky's own colour must ride the hour's transition"
for _scene_channel in ("--time-cast", "--time-shade", "--time-glow",
                       "--time-light-x", "--time-light-y", "--rim-throw"):
    assert _scene_channel in _hero_props.group(1), \
        "%s must land with the rest of the scene" % _scene_channel
# The per-frame channels are excluded on purpose: the head's lighting must
# answer the hand on the frame it moves, not 640ms later.
for _live_channel in ("--light-ux", "--light-uy", "--light-prox", "--light-angle",
                      "--env-color", "--env-lum", "--env-raw", "--time-light-dir"):
    assert _live_channel not in _hero_props.group(1), \
        "%s is a per-frame channel and must not be transitioned" % _live_channel
# Comments are not CSS: this rule's own prose names the shorthand it replaced,
# so the declarations have to be read with the commentary stripped out.
_hero_decls = re.sub(r"/\*.*?\*/", " ", hero_rule.group(0), flags=re.S)
assert not re.search(r'(?:^|;|\{)\s*transition\s*:', _hero_decls, re.M), \
    "the .hero scene rule must stay longhand; a `transition:` shorthand replaces the list"
assert "overflow:visible" in hero_rule.group(0), "the clipped gradient child, not the hero, must own overflow"
spill_rule = re.search(r'\.heroTimeSpill\s*\{.*?\}', time_css, re.S)
assert spill_rule, "Night needs a page-level ambient spill"
# ── THE SPILL IS TWO EDGES, NOT A CENTRED 100vw BOX ─────────────────────────
# This required left:50%;width:100vw;transform:translateX(-50%). 100vw INCLUDES
# the scrollbar, so on any scrolling page that box is wider than the content and
# pushes a horizontal scrollbar -- this site's recurring overflow bug. The Hero
# wrapper is full-bleed now, so left:0;right:0 already IS the viewport and needs
# no centring trick. Demanding the old form was demanding the bug back.
# left/right are asserted instead, and 100vw is now FORBIDDEN in this rule,
# which the old line could not express and is the failure that actually hurts.
for spill_contract in ("position:absolute", "top:calc(", "bottom:calc(", "left:0", "right:0",
                       "width:auto", "pointer-events:none", "opacity:0"):
    assert spill_contract in spill_rule.group(0), spill_contract
assert "100vw" not in spill_rule.group(0), \
    "100vw includes the scrollbar and pushes a horizontal scrollbar; the spill uses left:0;right:0"
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
# ── CHROME IS NOT SCENE, AND IT KEEPS ITS OWN DURATION ──────────────────────
# This required :root:root{--theme-duration:var(--hero-time-duration)}, i.e. the
# Hero reaching out and setting every chrome transition on the home page to the
# sky's 640ms. hero-time.css records why it was deleted: 640 is --sp-pop-dur
# reused for a sky and never authored as a chrome duration, it made index the
# only one of ten pages running chrome at 640 while the rest ran site-theme's
# 400, and it bypassed site-theme's 280ms mobile fork and 0ms reduced-motion
# fork entirely. The old assertion was pinning that bug open.
# The inversion is the honest contract: the Hero may not reassign --theme-duration
# at all, and site-theme.css must still be the one that authors it.
assert not re.search(r'--theme-duration\s*:', re.sub(r"/\*.*?\*/", " ", time_css, flags=re.S)), \
    "the Hero must not reassign --theme-duration; chrome runs site-theme's own ladder"
assert "--theme-duration:400ms" in site_theme_css, \
    "site-theme.css must remain the author of the chrome duration"
# ── THE DARK CHROME COLOURS BELONG TO site-theme.css ────────────────────────
# These five asserted that hero-time.css set the dark colour of .csTab.on,
# .csName, .csYear, .footReach and .footIn, and that it owned
# :root[data-theme="dark"] .cases. Two of those five have since moved to
# site-theme.css scoped by body[data-theme-page="home"] (which is what stops the
# Hero's stylesheet re-colouring nine other pages), and .footReach no longer
# exists on this page at all -- it is a case-study footer class. So the check was
# demanding that the Hero own chrome it was deliberately relieved of.
# Ownership is the invariant now, in both directions: the site's dark chrome
# colours live in site-theme.css and are page-scoped there, and hero-time.css
# does not paint them. That is a rule a future edit can genuinely violate, which
# the old copy-of-the-values form could not detect -- it would have passed
# happily with the same declaration in both files.
assert not re.search(r':root\[data-theme="dark"\]\s*\.(?:cases|csTab|footIn|footReach)\b', time_css), \
    "dark chrome colours belong to site-theme.css, page-scoped; hero-time.css must not own them"
for _dark_chrome in (".cases", ".csTab.on"):
    assert re.search(
        r':root\[data-theme="dark"\] body\[data-theme-page="home"\] %s\s*\{'
        % re.escape(_dark_chrome), site_theme_css), \
        "site-theme.css must own %s's dark value, scoped to home" % _dark_chrome
# What hero-time.css DOES still own is the theme-ready transition for the two
# case-study text bits that have no control of their own.
ready_cases = re.search(r':root\.theme-ready \.cases\s*\{(.*?)\}', time_css, re.S)
assert ready_cases and "transition:background-color" in ready_cases.group(1)
ready_text = re.search(r':root\.theme-ready :is\(([^)]*)\)\s*\{(.*?)\}', time_css, re.S)
assert ready_text and "transition:color" in ready_text.group(2)
# .csTab IS NOT IN THAT LIST AND MUST NOT BE. `transition:` is a shorthand: it
# REPLACES the list it inherits. While .csTab was here its whole .ctl transition
# -- background, box-shadow, ink, press scale -- was wiped and replaced by one
# colour line, so a tab that animated correctly on the five case studies snapped
# on home. This is the regression the old list ENCODED; asserting its absence is
# the only version that keeps it from coming back.
assert ".csTab" not in ready_text.group(1), \
    "a `transition:` shorthand on .csTab replaces the list .ctl gives it"
for _fading_text in (".csName", ".csYear"):
    assert _fading_text in ready_text.group(1), _fading_text
reduced_chrome = re.search(r':root\[data-reduced-motion="reduce"\](.*?)\{(.*?)\}', time_css, re.S)
assert reduced_chrome and "transition:none!important" in reduced_chrome.group(2)
# .footReach dropped off this list with the rest of the case-study footer; every
# element hero-time.css still animates has to be in it or reduced-motion leaks.
for reduced_target in (".cases", ".csTabs::before", ".csTabInk", ".csMeta", ".csName",
                       ".csYear", ".footIn"):
    assert reduced_target in reduced_chrome.group(1), reduced_target
assert ".footReach" not in time_css, \
    ".footReach is a case-study footer class and is not on this page"
# ── THE HERO HAS NO FLOOR SHADOW AT ALL ──────────────────────────────────────
# It used to be asserted as "present but neutralised in the active states",
# which was the right contract while the head still stood on the Hero's lower
# edge. --hero-peek-depth went negative and it does not: the head is suspended
# clear of the floor, and this site only permits a shadow where it is grounding
# information. The element, its writer and its tokens are deleted, so the
# contract is now an absence -- and an absence is the only version of this that
# cannot quietly come back as a smudge near the bottom of the page.
normal_time_css = time_css.split("@media(forced-colors:active)", 1)[0]
assert "floorshadow" not in html, "the Hero must not carry a floor shadow element"
assert 'id="fsh"' not in html
assert not re.search(r'\.floorshadow\s*[,{]', time_css), \
    "no rule may style a Hero floor shadow that does not exist"
for retired in ("--time-shadow:", "--time-shadow-opacity:", "--hero-ground-width:",
                "--hero-ground-height:", "--hero-ground-stretch:", "--hero-ground-throw:"):
    assert retired not in time_css, retired
assert "time-orb" not in time_css, "gradient layers must fill the hero, not use a 1:1 orb"
for forbidden_texture in ("heroTimeRay", "heroTimeLine", "heroTimeFilament", "heroTimeGrain"):
    assert forbidden_texture not in time_css and forbidden_texture not in html, forbidden_texture
assert re.search(r'\.hero\[data-time-state\] \.heroAura\s*\{[^}]*display:none', time_css, re.S)
assert re.search(
    r'\.hero\[data-time-state="off"\].*?\.heroAura.*?display:none',
    time_css,
    re.S,
), "Off must hard-hide the gradient clip and original hero aura"
assert re.search(
    r'\.hero\[data-time-state="off"\] \.heroAura(?:,|\s*\{).*?\{[^}]*display:none',
    time_css,
    re.S,
), "heroAura"
# ── OFF IS A DESTINATION, NOT AN EXCEPTION ───────────────────────────────────
# The cast layer used to be display:none in Off, and display is not animatable:
# leaving Off it appeared instantly at full strength and only then transitioned,
# entering Off it vanished on one frame. Against a 640ms sky cross-fade that
# reads as the transition being broken, and Off was the only state doing it.
# It fades on opacity now, with visibility stepped one duration behind so the
# element is still there to be seen going.
off_cast = re.search(
    r'\.hero\[data-time-state="off"\] \.heroTimePortraitCast\s*\{([^}]*)\}',
    time_css, re.S,
)
assert off_cast, "Off must still neutralise the portrait cast"
assert "display:none" not in off_cast.group(1), \
    "display is not animatable: Off must not pop the cast layer"
assert "opacity:0" in off_cast.group(1) and "visibility:hidden" in off_cast.group(1)
assert "transition:opacity var(--hero-time-duration)" in off_cast.group(1)
for crossfade_layer in ("heroTimeSpill", "heroTimeClip", "heroTimeGradient"):
    assert not re.search(
        rf'\.hero\[data-time-state="off"\] \.{crossfade_layer}(?:,|\s*\{{).*?\{{[^}}]*display:none',
        time_css,
        re.S,
    ), f"{crossfade_layer} must remain paintable long enough to crossfade Off"

assert "--hero-time-duration:640ms" in time_css
assert "--hero-time-ease:cubic-bezier(.22,1,.36,1)" in time_css
# hero-time.css grew from one @media(max-width:760px) block to three, and this
# non-greedy search only ever read the FIRST of them -- which is the head's
# mobile placement block, not the duration fork. The value never moved; the
# instrument stopped being able to see it. Every phone block is scanned now, so
# the assertion no longer depends on which one happens to be written first.
_mobile_blocks = [time_css[m.end():time_css.index("\n}", m.end())]
                  for m in re.finditer(r'@media\(max-width:760px\)\s*\{', time_css)]
assert _mobile_blocks, "hero-time.css must keep a phone fork"
assert any("--hero-time-duration:420ms" in block for block in _mobile_blocks), \
    "the hour must cross-fade faster on a phone"
assert "body[data-time-state]" not in time_css

menu_rule = re.search(r'\.heroTimeMenu\s*\{.*?\}', time_css, re.S)
assert menu_rule and "right:0" in menu_rule.group(0)
assert "width:min(var(--menu-w),calc(50vw + var(--sp-6)))" in menu_rule.group(0)
assert "max-width:calc(100vw - (var(--sp-16) * 2))" in menu_rule.group(0)
assert re.search(r'\.heroCtas\s*\{[^}]*justify-content:center;[^}]*flex-wrap:wrap', html, re.S)
# The CSS half of the flip that positionMenu() replaced. `.heroTime.opensAbove`
# is gone from the stylesheet on purpose -- a menu that flips above its trigger
# covers the control you just pressed -- so this required a rule that no longer
# exists. The menu is anchored BELOW the trigger unconditionally now and fits by
# capping its own height, so that anchor is what is asserted, plus the absence of
# any bottom-anchored fork sneaking back in.
assert "top:calc(100% + var(--sp-8))" in menu_rule.group(0) and "left:auto" in menu_rule.group(0), \
    "the time menu hangs below its trigger, right-aligned"
assert "opensAbove" not in time_css, "the flip was replaced by positionMenu(); it must not come back"

off_state = re.search(r'\.hero\[data-time-state="off"\]\s*\{.*?\}', time_css, re.S)
assert off_state and "--time-secondary-hover-border:var(--c500)" in off_state.group(0)
# ── THE MOOD BAR IS NOT ON THIS PAGE, AND THIS FILE ALREADY SAID SO ─────────
# This required a `.hero[data-time-state] .heroMood .moodBtn:hover` rule while
# the assertion near the bottom of this same file requires `class="heroMood` to
# be ABSENT from index.html -- two lines of one gate demanding opposite things,
# which is how a red gate stops meaning anything. The mood bar moved to
# play.html; the Hero's hover token is spent on the time trigger now.
assert 'class="heroMood' not in html and "heroMood" not in time_css, \
    "the mood bar lives on play.html; the Hero must not style it"
# The rule that CONSUMED --time-secondary-hover-border went with the mood bar,
# and the control library owns the trigger's hover states now. What the Hero
# still owns is the per-hour material vocabulary itself, so the contract becomes
# completeness rather than one consumer: no hour may be missing a material.
# That is stricter -- it covers all eight states and every token in the set,
# where the old line covered one selector -- and it is what breaks when a ninth
# state is added and someone forgets half the block.
# (NOTE for the source, not for this gate: nothing currently reads these. See
# the report -- they are dead until the controls are re-pointed at them.)
for _hour in ("off", "pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night"):
    _hour_materials = hour_block(_hour)
    assert _hour_materials, _hour
    for _material in ("--time-primary-bg:", "--time-primary-ink:", "--time-secondary-bg:",
                      "--time-secondary-ink:", "--time-secondary-border:",
                      "--time-secondary-hover-border:", "--time-menu-bg:", "--time-focus:"):
        assert _material in _hour_materials, f"{_hour}: {_material}"
forced_colors = re.search(r'@media\(forced-colors:active\)\s*\{(.*)\n\}', time_css, re.S)
assert forced_colors
assert ".heroTimeClip" in forced_colors.group(1), "forced colors must remove the decorative gradients"
assert ".heroTimeSpill" in forced_colors.group(1), "forced colors must remove the ambient spill"
# The forced-colors fallback used to redraw the Hero's outline as a CanvasText
# border on `.hero::after`, because in that mode the sky is stripped and the
# outline was the only thing left saying where the Hero was. The Hero is
# full-bleed and has no outline in ANY mode now, so an inserted CanvasText
# rectangle would be a shape that exists nowhere else. What the fallback owes is
# the pair the old line's second half was already asserting: real system colours,
# and no decorative shadow left behind.
assert not re.search(r'\.hero::after', forced_colors.group(1)), \
    "a full-bleed Hero has no outline to redraw in forced colors"
assert re.search(r'\.hero[^{]*\{[^}]*background:Canvas;[^}]*color:CanvasText', forced_colors.group(1), re.S), \
    "forced colors must hand the Hero back to the system palette"
assert re.search(r'\.hero\s*\{[^}]*box-shadow:none', forced_colors.group(1), re.S)
assert ".heroTimePortraitLit" in forced_colors.group(1), \
    "the uplight layer is decorative and must drop out in forced colors too"

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
# ── ONE LAYER BECAME TWO, AND ITS SIGN REVERSED ─────────────────────────────
# This described a single duplicate portrait that SCREENED a radial ellipse of
# light onto the face, positioned at --time-light-x/-y and faded by
# --time-cast-opacity. All four of those strings are gone, and none of them was
# tidied away: the measurement is recorded in hero-time.css. images/rest.webp is
# lit almost frontally -- six columns across the mid-face read within a few
# percent -- so it has essentially no form shadow of its own, and screening MORE
# light onto a flat face lifted the blacks and flattened it further, which is the
# "sticker" quality Jayden objected to four times. What a flat face needs is the
# dark it never had.
# So the mechanism split in two and the shade half inverted:
#   .heroTimePortraitCast  MULTIPLIES a linear ramp turned 180deg from the light
#                          -- the form shadow, opaque on the far side.
#   .heroTimePortraitLit   SCREENS a radial hot spot at --lit-reach along
#                          --light-angle -- the near source's uplight.
# Asserting the old single-screen form was asserting the flattening back in.
# Both layers are now checked, and three properties the old block never had are
# added: the two layers must describe ONE light (both driven by --light-angle),
# neither may escape the silhouette (each carries a mask), and the ramps must
# reach zero before their own edge -- "if you can see where it ends, it is wrong".
for cast_contract in (
    "display:block",
    "visibility:visible",
    "opacity:var(--time-shade,0)",
    "mix-blend-mode:multiply",
    "url(#heroPortraitTintFilter)",
    "mask-image:linear-gradient(calc(var(--light-angle,180deg) + 180deg)",
    "background:none",
    "border:0",
    "outline:0",
):
    assert cast_contract in portrait_shell, cast_contract
assert "mix-blend-mode:screen" not in portrait_shell, \
    "the shade layer must multiply; screening light onto a frontally lit photo flattens it"
assert "transparent 92%" in portrait_shell, \
    "the shade ramp must reach zero inside the head -- a visible terminator edge is the bug"
assert "border-radius" not in portrait_shell
assert "box-shadow" not in portrait_shell
assert "drop-shadow" not in portrait_shell
lit_rule = re.search(r'\.heroTimePortraitLit\s*\{(.*?)\n\}', time_css, re.S)
assert lit_rule, "the uplight layer must exist: an edge cannot describe a lit surface"
for lit_contract in (
    "mix-blend-mode:screen",
    "background:radial-gradient(",
    "var(--lit-reach)",
    "sin(var(--light-angle,180deg))",
    "cos(var(--light-angle,180deg))",
    "transparent 78%",
):
    assert lit_contract in lit_rule.group(1), lit_contract
# BOTH SPELLINGS, and this was a real hole: "mask-image:var(--time-portrait-mask"
# is a substring of "-webkit-mask-image:var(--time-portrait-mask", so a single
# check passed while the unprefixed property had been set to none and the
# uplight had escaped the silhouette on every modern engine. Mutation test found
# it; reading the line did not.
for _masked in ("-webkit-mask-image:var(--time-portrait-mask,none)",
                "\n mask-image:var(--time-portrait-mask,none)"):
    assert _masked in lit_rule.group(1), _masked
assert "mask-image:none" not in lit_rule.group(1), \
    "the uplight is masked by the portrait's own alpha; unmasked it reaches the sky"
assert "var(--time-glow" in lit_rule.group(1) and "var(--light-prox" in lit_rule.group(1), \
    "the uplight must be per-hour depth times live proximity"
assert "linear-gradient" not in lit_rule.group(1), \
    "a linear ramp is a half-face wash; this source is near and throws a hot spot"
assert "hue-rotate" not in time_css, "portrait lighting must not rotate skin hue"


active_states = ("pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night")
# THE COLOURS ARE JAYDEN'S AND HAVE NOT MOVED. Only the strength and the place
# changed, so the hex table is kept verbatim -- that is the part that must never
# drift, and it still fails to the character if a stop is retinted.
expected_cast_colors = {
    "pre-dawn": "#9ab0ff",
    "sunrise": "#ffb58c",
    "daytime": "#eaf2ff",
    "dusk": "#c8bceb",
    "sunset": "#ffb58c",
    "night": "#9ab0ff",
}
state_materials = {}
for state in active_states:
    body = hour_block(state)
    assert body, state
    shade = re.search(r'--time-shade:(\d*\.?\d+)', body)
    glow = re.search(r'--time-glow:(\d*\.?\d+)', body)
    assert shade and glow, "%s: the hour must author both a shade depth and a glow depth" % state
    light_x = re.search(r'--time-light-x:(\d+(?:\.\d+)?)%', body)
    light_y = re.search(r'--time-light-y:(\d+(?:\.\d+)?)%', body)
    assert light_x and light_y, state
    cast = re.search(r'--time-cast:([^;]+)', body).group(1).strip().lower()
    assert cast == expected_cast_colors[state], (state, cast)
    state_materials[state] = {
        "shade": float(shade.group(1)),
        "glow": float(glow.group(1)),
        "x": float(light_x.group(1)),
        "y": float(light_y.group(1)),
        "cast": cast,
    }
    for directional_contract in ("--time-cast:", "--time-light-x:", "--time-light-y:"):
        assert directional_contract in body, f"{state}: {directional_contract}"

# ── THE SUN STOPS STANDING WHERE IT ISN'T ────────────────────────────────────
# The six lines here used to be an ordering: pre-dawn and sunrise left of centre,
# dusk and sunset right of it, sunset further right than dusk -- a sun travelling
# across the sky. It reads well and it was describing a sky that does not exist.
# Every one of Jayden's six approved gradients puts its glow at 50% (dusk at
# 49.98) on the hero's lower edge; there is no hour whose bright part is on the
# left. So the authored light point was placed where the picture is DARK, and the
# face was being modelled from a source the viewer cannot see. The horizontal
# travel the old lines wanted is real, but it comes from the head being dragged
# past the glow -- hero-head-transform.js computes the head-to-light vector every
# frame -- not from a constant per hour.
# Replaced with the invariant that actually holds the two halves together, and it
# is far stricter than an ordering: THE LIGHT POINT MUST BE WHERE THE SKY IS
# BRIGHT. Each state's --time-light-x/-y is checked against the `at X% Y%` of its
# own gradient, to within 1%. Retune a sky and forget its light and this fails;
# move the light off the glow and this fails. Measured drift today is <= 0.5%.
for state in active_states:
    layer = re.search(
        rf'\.heroTimeGradient\[data-time-gradient="{state}"\]\s*\{{(.*?)\}}',
        time_css, re.S)
    assert layer, state
    focus = re.search(r'\bat\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%', layer.group(1))
    assert focus, "%s: the sky must name where its glow is centred" % state
    sky_x, sky_y = float(focus.group(1)), float(focus.group(2))
    assert abs(state_materials[state]["x"] - sky_x) <= 1.0, (
        "%s: the light stands at x=%s%% but its sky is bright at x=%s%%"
        % (state, state_materials[state]["x"], sky_x))
    assert abs(state_materials[state]["y"] - sky_y) <= 1.0, (
        "%s: the light stands at y=%s%% but its sky is bright at y=%s%%"
        % (state, state_materials[state]["y"], sky_y))
# Night is the deepest modelling and the dimmest exposure; nothing may be flat.
assert state_materials["night"]["shade"] == max(m["shade"] for m in state_materials.values())
for state in active_states:
    assert 0 < state_materials[state]["shade"] <= 1, state
    assert 0 < state_materials[state]["glow"] <= 1, state

# Off is the one hour with no light in it, so every channel that describes light
# has to be at rest. --time-cast-opacity was the single strength dial; the model
# now has two, and Off has to zero both or half the lighting survives a state
# whose whole point is that none of it does.
off_material = hour_block("off")
assert off_material
for off_contract in (
    "--time-cast:transparent",
    "--time-shade:0",
    "--time-glow:0",
    "--time-exposure:1",
    "--time-contrast:1",
):
    assert off_contract in off_material, off_contract

# ── NIGHT STOPPED BORROWING DAYLIGHT'S SKY ──────────────────────────────────
# This required night's gradient to end on `#0b0c0f 100%`. Night was rebuilt as
# three layers -- two soft radial glows over an opaque linear base -- so there is
# no single final stop to pin, and the last colour is #11162b rather than the
# page's near-black.
# What the old line was protecting is still exactly right and is now asserted
# directly instead of by proxy: nothing behind the sky may show through, so no
# blue halo can appear outside the Hero. That means the LAST background layer
# must be opaque, which is a property of the sky rather than of one hex, and it
# survives night being retuned again. The daylight base it must not fall back to
# is named explicitly, and the top seam is asserted on the mechanism that
# actually closes it now -- the ::after fade into --theme-page.
night_gradient = re.search(
    r'\.heroTimeGradient\[data-time-gradient="night"\]\s*\{background:(.*?)\}', time_css, re.S)
assert night_gradient, "night must have a sky"
night_layers = night_gradient.group(1).lower()
night_base = night_layers[night_layers.rindex("),") + 2:] if ")," in night_layers else night_layers
assert night_base.startswith("linear-gradient("), \
    "night's bottom layer must be an opaque base, not a fading radial"
assert "transparent" not in night_base and "rgba" not in night_base, \
    "night's base layer must be fully opaque or the page shows through as a halo"
assert "#f8fafd" not in night_layers, "night must not resolve into daylight's sky"
gradient_seam = re.search(r'\.heroTimeGradient::after\s*\{(.*?)\}', time_css, re.S)
assert gradient_seam and "var(--theme-page)" in gradient_seam.group(1), \
    "the sky's top edge must fade into the page or the join is a visible line"
spill = re.search(r'\.heroTimeSpill\s*\{(.*?)\}', time_css, re.S)
assert spill and "#0b0c0f" in spill.group(1).lower()
assert "#141e4b 0%" not in spill.group(1).lower()

# ── THE PORTRAIT IS LIT NOW, AND THAT IS NOT THE SAME AS TINTED ─────────────
# This forbade a `filter:` on ANY selector naming #face or .face. index.html and
# hero-time.css both used to honour that, and then the Hero's whole premise
# changed: "the sky becomes the light". The rim light is a drop-shadow ON the
# portrait, because drop-shadow follows the image's ALPHA and traces a cut-out
# silhouette exactly -- no mask, no second copy of the photograph, no per-frame
# work -- and it is the single highest-value compositing cue there is. A blanket
# ban on filtering #face bans the feature.
# But the rule underneath it is real and worth keeping: the PHOTOGRAPH's own
# pixels must not be recoloured, because that is identity, and this site has
# rejected the tinted-cutout look four times. drop-shadow paints outside the
# alpha and changes nothing inside it; contrast/brightness are exposure, which is
# what a scene does to a face. hue-rotate, saturate, grayscale, sepia, invert and
# blur are not lighting -- they are a different person.
# So the ban is now on the OPERATIONS rather than on the property, plus a limit
# the old line could not express: exactly one selector in the whole page may
# filter the portrait at all, and it must be the scene-lighting rule.
# COMMENTS ARE NOT CSS. This loop reads selectors with a naive brace split, and
# the failure it reported quoted 26 lines of prose above the rule -- the same
# trap shared-surfaces-contract.py documents. Stripped first now.
# Matched as FUNCTION CALLS, for two reasons this file has already been bitten
# by: `--rim-blur` is a drop-shadow radius and is required, not banned; and the
# words "saturated" and "inverted" appear in the stylesheet's prose, which is not
# CSS. Both are checked against declarations with the commentary stripped out.
IDENTITY_FILTERS = ("hue-rotate(", "saturate(", "grayscale(", "sepia(", "invert(", "blur(")
time_css_decls = re.sub(r"/\*.*?\*/", " ", time_css, flags=re.S)
face_filter_rules = []
all_css = re.sub(r"/\*.*?\*/", " ", html + "\n" + time_css, flags=re.S)
for selectors, declarations in re.findall(r'([^{}]+)\{([^{}]*)\}', all_css, re.S):
    exact_face_selector = any(
        re.search(r'(?<![A-Za-z0-9_-])(?:#face|\.face)(?![A-Za-z0-9_-])', selector)
        for selector in selectors.split(",")
    )
    if exact_face_selector and re.search(r'(?:^|;)\s*(?:-webkit-)?filter\s*:', declarations):
        face_filter_rules.append((" ".join(selectors.split()), declarations))
assert len(face_filter_rules) == 1, \
    "exactly one rule may light the portrait: %s" % [s for s, _ in face_filter_rules]
face_selector, face_declarations = face_filter_rules[0]
assert face_selector == '.hero[data-time-state] #face', \
    "the portrait's filter belongs to the scene-lighting rule, not to %s" % face_selector
assert face_declarations.count("drop-shadow(") == 2, \
    "the rim light and the ambient fill are two drop-shadows on one chain"
for _identity_op in IDENTITY_FILTERS:
    assert _identity_op not in face_declarations, \
        "%s recolours the photograph itself -- that is identity, not lighting" % _identity_op
    assert _identity_op not in time_css_decls, \
        "%s must not reach the portrait through a token either" % _identity_op
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
# ── THE NAV IS NOT THE HERO'S TO PAINT, AND ITS MATERIAL WAS THE BUG ────────
# This required hero-time.css to carry `:root[data-theme="dark"] .jbNav` with
# --nav-mat:var(--theme-page). Two things are wrong with it, and this file
# already knows about the second one.
#  1. OWNERSHIP. The dark nav moved to header.css, which is the only file that
#     should describe the header on any of the ten pages. A copy of the rule in
#     the Hero's stylesheet is how index ends up looking different from about.
#  2. THE VALUE. --theme-page is the paper. Pinning the bar to it puts the bar's
#     ground at 1.00:1 against the page underneath it, leaving a 1.31:1 hairline
#     as the only thing drawing the component -- which is precisely what the
#     comment on EMPATHY_BAR at the top of this file records as the bug, and
#     records the fix for. This line was asking for the bug back in a second
#     place while that comment was preventing it in the first.
# So the Hero must not theme the header at all, which is a rule that can be
# broken and would matter, and the empathy-bar assertion above still guards the
# material itself.
assert not re.search(r'\.jbNav', time_css), \
    "the header is header.css's; hero-time.css must not carry nav rules"
assert not re.search(r'--nav-(?:mat|rim|hover-bg|active-bg)\s*:', time_css), \
    "hero-time.css must not set header material tokens"
assert "backdrop-filter" not in time_css, \
    "the Hero's chrome separates with hairlines and translucency, not with blur"

# ── WHAT IS APPROVED IS THE LIGHT, NOT THE GEOMETRY ─────────────────────────
# Each of these six pinned the whole background declaration to the character,
# including a hardcoded horizontal radius. The five day skies had those radii --
# 103.24, 102.68, 102.84, 102.83, 103.12 -- collapsed into var(--hero-glow-rx) so
# the glow scales with the viewport rather than the element. Five values within
# half a percent of each other were never five decisions, and pinning them turned
# a tidy-up into five failures while nothing about the sky had changed. Night was
# then rebuilt outright as glow-over-opaque-base, so its entry described a sky
# that no longer exists at all.
# The colours and their stops are what Jayden chose and what must never drift, so
# those are still matched to the character, from the first colour to the closing
# brace. The radius is allowed to be a token -- but it must BE a token, which is
# the part that stops anyone quietly reinstating a per-state literal.
# (shared-surfaces-contract.py owns the same five day skies. That duplication is
# deliberate: it is the one thing on this page a stray hex could ruin silently.)
approved_skies = {
    "pre-dawn": ",#486ffd 0,#7f81f3 9.84%,#c489ff 20.83%,#dac0ff 34.13%,#eadcff 44.86%,#f9f6ff 58.59%,#f8fafd 100%)",
    "sunrise": ",#cb83ff 0,#ff90b9 15.77%,#ffc977 30.62%,#ffd79b 38.04%,#fff1dc 50.11%,#fff 63.1%,#fcfdfe 77.95%,#f8fafd 98.81%)",
    "daytime": ",#0071c1 1.33%,#60a8e2 15.71%,#b4d8ff 33.15%,#d9ebff 45%,#f8fafd 60%)",
    "dusk": ",#ffb36a 0,#dfa0d8 14%,#9da8e4 30%,#ccd5f0 44%,#f1f3fa 58%,#f8fafd 100%)",
    "sunset": ",#ffa577 0,#ff90a1 15.52%,#ddadff 30.09%,#ecd8ff 45.72%,#f5eaff 54.96%,#f8fafd 88.16%)",
    "night": (",rgba(93,80,155,.58) 0,rgba(48,52,105,.38) 38%,rgba(24,35,70,.18) 60%,transparent 78%),"
              "radial-gradient(var(--hero-glow-rx-far) 58% at 50% 88%,rgba(35,55,101,.22),transparent 76%),"
              "linear-gradient(180deg,#060a13,#09101f 66%,#11162b)"),
}
for state, approved_light in approved_skies.items():
    layer_rule = re.search(
        rf'\.heroTimeGradient\[data-time-gradient="{state}"\]\s*\{{(.*?)\}}',
        time_css,
        re.S,
    )
    assert layer_rule, "no gradient rule for %s" % state
    assert approved_light in layer_rule.group(1), (
        "the %s sky's colours or stops have drifted from the approved run\n"
        "  approved: %s\n  live:     %s"
        % (state, approved_light[:110], layer_rule.group(1)[-110:]))
    assert re.search(r'radial-gradient\(var\(--hero-glow-rx', layer_rule.group(1)), \
        "%s no longer takes its glow radius from a --hero-glow-rx token" % state
    # Only night may carry `transparent`, and only in the two glow layers it
    # composites over its own opaque base -- checked above.
    if state != "night":
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
assert html.index('id="h1"') < html.index('id="heroTimeBtn"') < html.index('class="heroTimeSupport')
assert '<h1 id="h1">SF product designer. iOS, B2C and design systems.</h1>' in html

# ── THE HERO WENT FULL-BLEED, WHICH RETIRED ITS RIM AND ITS 88px ────────────
# Two assertions here described a Hero that sat inside the page as a card: a
# var(--rim-3) outline, and min-height:calc(100svh - 88px) -- the viewport less
# the floating bar's clearance. The Hero is the viewport now. index.html sets
# box-shadow:none on it, hero-time.css sets box-shadow:none on it, and
# controls.css sets box-shadow:none on .surface--hero: three files agreeing that
# there is no edge to draw. Satisfying the old lines would have put a rectangle
# through a full-bleed hero and cut 88px off the bottom of the sky.
# The absence of the rim is asserted rather than a replacement value, because an
# absence is the only form of this that cannot come back as a faint line. The
# height is asserted as the svh/dvh PAIR, which is the real requirement: dvh
# alone re-lays out the Hero every time mobile chrome slides, and svh alone
# leaves a gap under the sky on engines that have the chrome hidden.
hero_page_rule = next(
    (m.group(0) for m in re.finditer(r'\.hero\s*\{.*?\n\}', html, re.S)
     if "--heroPadT" in m.group(0)), None)
assert hero_page_rule, "index.html must own the Hero's box"
assert "box-shadow:none" in hero_page_rule, "a full-bleed Hero draws no rim"
assert "var(--rim-3)" not in hero_page_rule
# THE HEIGHT IS A FALLBACK CHAIN, NOT ONE DECLARATION. It was
# `min-height:100svh;min-height:100dvh` -- the old CSS trick of letting an engine
# that cannot parse the second keep the first. That is not safe here, because a
# custom property carrying a unit the engine cannot parse is still a VALID custom
# property: the token stream parses, and the failure only appears at
# computed-value time, where min-height falls back to `auto`. Measured, that
# collapsed 844px of Hero to 241.7. So the units are gated on feature queries
# instead, over a plain 100vh floor that every engine understands.
# Asserted as the chain, which is what must not break: a floor that always
# resolves, and each better unit behind its own @supports. Pinning either literal
# would go stale again the next time the unit ladder moves.
assert "min-height:100vh" in hero_page_rule, \
    "the Hero needs a viewport-height floor that every engine can resolve"
for _unit in ("svh", "dvh"):
    assert re.search(
        r'@supports \(height:1%s\)\s*\{[^@]*?\.hero\{[^}]*min-height:100%s' % (_unit, _unit),
        html, re.S), \
        "100%s must be gated on @supports; ungated it can compute min-height to auto" % _unit
assert not re.search(r'min-height:calc\(100[sd]?vh - \d+px\)', hero_page_rule), \
    "the Hero is full-bleed: the rule that owns its box no longer subtracts the bar's clearance"
# (index.html still carries three EARLIER .hero rules with `min-height:calc(100vh
# - 68px)` and `calc(100svh - 68px)` from the pre-full-bleed era. They are dead --
# the block above is later and wins -- but they are dead code in a file this gate
# does not own, so they are reported rather than failed here.)
assert ".heroAura" in html
assert 'id="cursorGlow"' not in html
assert ".cursorGlow" not in html
hero_aura_rule = re.search(r'\.heroAura\s*\{.*?\}', html, re.S)
assert hero_aura_rule and "var(--accent)" not in hero_aura_rule.group(0)
# The copy's lift was clamp(-80px,-8svh,-48px) and is clamp(-124px,-13svh,-92px):
# the Hero absorbed the bar's 88px of clearance when it went full-bleed, so
# dead-centre sits ~44px below the authored composition and opens a hole between
# the copy and the head. The numbers are Jayden's composition and he retunes them
# by eye -- pinning them is what made this line rot. The SHAPE cannot be retuned
# and is what actually breaks: a viewport-relative lift, clamped at both ends, in
# the negative direction, with the bounds the right way round. A sign flip or a
# swapped clamp is a broken hero; -124 instead of -80 is a design decision.
# index.html carries several .heroCopy rules across its responsive forks -- the
# first is `display:contents` from the centred-hero block -- so the one that
# owns the lift has to be picked by content, not by position.
copy_rule = next((m.group(0) for m in re.finditer(r'\.heroCopy\s*\{[^}]*\}', html, re.S)
                  if "translateY(clamp(" in m.group(0)), None)
assert copy_rule, ".heroCopy must own the copy's lift"
lift = re.search(r'transform:translateY\(clamp\((-?[\d.]+)px,(-?[\d.]+)svh,(-?[\d.]+)px\)\)',
                 copy_rule)
assert lift, "the copy's lift must stay a clamped svh expression: %s" % copy_rule[:160]
lift_min, lift_pref, lift_max = (float(v) for v in lift.groups())
assert lift_min < 0 and lift_pref < 0 and lift_max < 0, "the copy lifts, it does not drop"
assert lift_min < lift_max, "clamp bounds are the wrong way round: the lift cannot resolve"
# .heroTimeSupport WAS display:none!important -- for the one release when the
# character hero lived on Play and Home showed only a sky. The head came back and
# the class is now the wrapper around #heroHeadTransform, the stage and #face, so
# this assertion had become "hide the Hero's head". shared-surfaces-contract.py,
# which is green, asserts the same wrapper is neither hidden nor inert.
assert 'class="heroTimeSupport heroCharacterPeek"' in html, \
    "the support wrapper is the head's host on Home"
assert not re.search(r'\.heroTimeSupport\s*\{[^}]*display:none', html, re.S), \
    "the Hero's head must not be hidden on Home"
assert re.search(r'\.heroCtas>\*\s*\{[^}]*opacity:1;[^}]*transform:none', html, re.S)
assert re.search(r'#loveScene\s*\{[^}]*z-index:\s*64', html, re.S)
# The join between the Hero and the work collection was a literal var(--sp-16)
# inside the phone fork. It is --section-join-gap now and applies at every width,
# which is the same measurement named once. The token has to resolve to the same
# rung or the tidy-up moved the gap.
assert re.search(r'\.cases\s*\{[^}]*margin-top:var\(--section-join-gap\)', html, re.S), \
    "the Hero-to-work join must come from --section-join-gap"
assert "--section-join-gap:var(--sp-16)" in tokens_css, \
    "--section-join-gap must still resolve to the 16px rung"
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

# ── THE LAYER MEASURES THE POSE, IT NO LONGER COPIES IT ─────────────────────
# These three described the old mechanism: read the stage's bounding rect, and
# mirror the stage's transform string onto the effects layer. Both halves were
# wrong for the same reason. getBoundingClientRect returns the AXIS-ALIGNED
# BOUNDING BOX, and for a head resting at -13.8deg that box is 22% larger than
# the stage, offset up and left, and level while the head is not -- which put the
# popcorn 36-45px below the chin and, at 320 on a dragged head, 59px off the left
# edge of the phone. Mirroring the transform on top of that then applied the same
# pose twice, because the measured rect already contained it.
# The layer reads the stage's real affine basis from three zero-size corner
# probes and writes it as a matrix() -- which is why the stylesheet's
# transform-origin is 0 0, asserted further up. Mirroring is now the DEFECT, so
# it is forbidden rather than required, and the two things that must hold are
# asserted positively: the basis comes from the probes, and the pose has exactly
# one writer.
sync_movie = re.search(r"function syncMovieEffectsLayer\(\)\{.*?\n\}", movie_section, re.S)
transform_movie = re.search(r"function setMovieStageTransform\(value\)\{.*?\n\}", movie_section, re.S)
assert sync_movie, "the effects layer needs a sync function"
assert "ensureMovieFrameProbes()" in sync_movie.group(0), \
    "the layer's basis must come from the probes, not from a bounding box"
assert 'movieEffectsStage.style.transform="matrix(' in sync_movie.group(0), \
    "the composed pose must be written as a real affine basis"
assert "movieEffectsStage.parentNode.getBoundingClientRect()" in sync_movie.group(0)
assert "stage.getBoundingClientRect()" not in sync_movie.group(0), \
    "the axis-aligned bounding box of a rotated head is 22% oversized and offset"
assert transform_movie and "stage.style.transform=value;" in transform_movie.group(0)
assert "movieEffectsStage.style.transform=value;" not in transform_movie.group(0), \
    "syncMovieEffectsLayer() already measures this pose; writing it here applies it twice"
assert "syncMovieEffectsLayer();" in transform_movie.group(0), \
    "moving the stage must re-measure the layer"
assert start_movie.group(0).index("ensureMovieEls();") < start_movie.group(0).index("syncMovieEffectsLayer();")
assert movie_section.count("stage.style.transform=") == 1, \
    "the stage pose must have exactly one writer: setMovieStageTransform()"
assert movie_section.count("movieEffectsStage.style.transform=") == 1, \
    "the effects layer's pose must only ever be written by syncMovieEffectsLayer()"

case_enter = re.search(r"function enter\(f,e\)\{.*?\}\n\s*function leave", html, re.S)
assert case_enter and "startMovie" not in case_enter.group(0)
assert 'activeHover="smile"' not in case_enter.group(0)
case_leave = re.search(r"function leave\(f\)\{.*?\}\n", html, re.S)
assert case_leave and "caughtMovie" not in case_leave.group(0)

print("hero specimen structure: OK")
