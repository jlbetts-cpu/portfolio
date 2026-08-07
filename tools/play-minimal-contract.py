#!/usr/bin/env python3
"""Focused contracts for the minimal Play-page production pass."""

from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "play.html").read_text(encoding="utf-8")
GAMES = (ROOT / "play-games.js").read_text(encoding="utf-8")
ENGINE = (ROOT / "play-engine.js").read_text(encoding="utf-8")
HERO_ENGINE = (ROOT / "hero-engine.js").read_text(encoding="utf-8")
CSS = (ROOT / "play.css").read_text(encoding="utf-8")


class PlayParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.card_ids = []
        self.footer_ids = []
        self.body_classes = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        classes = (values.get("class") or "").split()
        if "pCard" in classes:
            self.card_ids.append(values.get("id"))
        if tag == "footer":
            self.footer_ids.append(values.get("id"))
        if tag == "body":
            self.body_classes = classes


parser = PlayParser()
parser.feed(HTML)

# The accepted page keeps one live arena, the honest lede, and the same four doors.
# The first screen is now the real Home hero; the doors live in #games below it.
assert HTML.count('class="hero" id="playArena"') == 1
assert "I made a few games for fun.</span> <span>Still building them." in HTML
assert '<section class="pHub" id="games"' in HTML
assert HTML.index('class="hero" id="playArena"') < HTML.index('id="games"')
assert parser.card_ids == ["pcHead", "pcExped", "pcTour", "pcGrad"]
for fragment in (
    "Upload a photo of your face and cut it out on a new page. It comes back and joins the crowd.",
    "Split the heads into two teams and watch them play soccer. You pick the teams first.",
    "A whole cup of matches, one at a time, with a bracket, goals and a winner.",
    "Dial a planet of coloured light on a new page, and leave with the image and the code.",
    'href="headmaker.html?from=play"',
    'href="gradientlab.html?from=play"',
):
    assert fragment in HTML
for rejected_selector_fragment in ("pArenaFrame", "pModeDock", "pModeRail", "play-select.css"):
    assert rejected_selector_fragment not in HTML

# The resting page is normal flow. Picker/game/tournament modes promote the same
# hero to a fixed arena and lock only while they own the viewport.
assert 'class="playViewport"' in HTML
assert ".playViewport{position:relative" in HTML
assert "body:is(.pTeamOn,.hmSoccer,.hmBattle,.hmRace,.hmTour) .playViewport" in HTML
assert ".pHub{position:relative" in HTML
assert "body.hmFull{height:auto;min-height:100%;overflow-x:clip;overflow-y:auto" in CSS
assert "body.hmFull:is(.pTeamOn,.hmSoccer,.hmBattle,.hmRace,.hmTour)" in CSS and "overflow:hidden" in CSS

# Initial saved and fallback heads are seated behind a readiness gate. The
# existing __noIntro fall path remains, protecting later game/tournament motion.
assert "playBooting" in parser.body_classes
assert ".playBooting .playViewport{visibility:hidden}" in HTML
assert "bootSeated" in ENGINE
assert "data-hm-boot-ready" in ENGINE
assert "__bootTotal" in GAMES
assert "releasePlayBoot" in GAMES
assert 'classList.remove("playBooting")' in GAMES
assert "if(first&&noIntro)" in ENGINE

# The Play lobby is literally the Home hero composition: same stage, controls,
# mood artwork, time controller, portrait tint and movie-effects host.
assert 'class="heroCopy"' in HTML
assert 'class="heroCtas"' in HTML
assert 'id="workBtn" href="#games"' in HTML
assert 'class="heroMood moodbar" id="moodbar"' in HTML
assert 'id="moodBtn"' in HTML and 'aria-controls="moodMenu"' in HTML
assert HTML.count('class="moodItem" type="button" role="menuitem" data-mood=') == 4
for artwork in ("camDot", "cookieDot", "discoDot", "heartDot"):
    assert artwork in HTML
assert 'id="heroTime"' in HTML and 'id="heroTimeBtn"' in HTML and 'id="heroTimeMenu"' in HTML
assert HTML.count('<div class="heroTimeGradient" data-time-gradient="') == 6
assert 'id="heroTimePortraitCast" class="heroTimePortraitCast"' in HTML
assert 'id="heroMovieEffectsStage"' in HTML
assert 'src="hero-time-presets.js"' in HTML and 'src="hero-time.js"' in HTML
assert 'href="hero-time.css"' in HTML
assert 'class="playHeroReflection" aria-hidden="true"' in HTML
assert '-webkit-box-reflect:' in HTML
assert "playArenaSurface" not in HTML and "playArenaGradient" not in HTML

# The hidden game launcher has its own identity. The visible Home mood menu is
# the sole owner of the canonical mood IDs and controller.
for game_id in ("gamebar", "gameBtn", "gameMenu"):
    assert f'id="{game_id}"' in HTML
assert HTML.count('id="moodbar"') == HTML.count('id="moodBtn"') == HTML.count('id="moodMenu"') == 1
assert 'getElementById("gamebar")' in GAMES and 'getElementById("gameBtn")' in GAMES
assert "getElementById('gameBtn')" in (ROOT / "play-tournament.js").read_text(encoding="utf-8")
assert "function installHeroMoodMenu" in HERO_ENGINE
assert "if(HEADONLY) return" not in HERO_ENGINE
assert 'this.hash.slice(1)' in HERO_ENGINE

# The five existing physics companions decode while hidden, then launch from
# alternating offstage sides. Reduced motion keeps the stable seated path.
assert "window.__hmLobbyThrowIn=function" in ENGINE
assert "me.lobbyThrow=function" in ENGINE
assert "me.lobbyThrowPrepare=function" in ENGINE
assert "var LOBBY_THROW_STAGGER=110" in ENGINE
assert "matchMedia(\"(prefers-reduced-motion:reduce)\").matches" in ENGINE
show_play = GAMES[GAMES.index("function showPlay"):GAMES.index("function watchPlayBoot")]
assert show_play.index("window.__hmLobbyThrowIn") < show_play.index('classList.remove("playBooting")')

# Play-only atmosphere points down from the fixed header and Night is a neutral
# near-black/violet treatment without the old bright blue floor light.
assert 'body[data-theme-page="play"] .heroTimeGradient[data-time-gradient="night"]' in HTML
night_rule = HTML.split('body[data-theme-page="play"] .heroTimeGradient[data-time-gradient="night"]', 1)[1].split("}", 1)[0]
assert "at 50% -" in night_rule and "#09090c" in night_rule
assert "#fcfdfe" not in night_rule and "#6763e4" not in night_rule

# Home-approved contact footer: exact content, links, 56ch measure and ghost mark.
assert parser.footer_ids == ["contact"]
assert "I&rsquo;m open to full-time roles and would love to chat. Find me on" in HTML
for href in (
    "https://www.linkedin.com/in/jaydenbetts",
    "https://www.instagram.com/jaydenleebetts",
    "mailto:jaydenlbetts@gmail.com",
):
    assert f'href="{href}"' in HTML
assert ".footReach{" in HTML and "max-width:56ch" in HTML
assert '<div class="footMark" aria-hidden="true">Jayden Betts</div>' in HTML

print("play minimal contract: PASS")
