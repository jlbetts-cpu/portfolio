#!/usr/bin/env python3
"""Focused contracts for the minimal Play-page production pass."""

from html.parser import HTMLParser
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "play.html").read_text(encoding="utf-8")
GAMES = (ROOT / "play-games.js").read_text(encoding="utf-8")
ENGINE = (ROOT / "play-engine.js").read_text(encoding="utf-8")
# The page with every comment removed. Assertions that a thing is GONE have to read this
# rather than the raw source, or the note recording the removal trips the assertion.
LIVE = re.sub(r"<!--.*?-->", "", re.sub(r"/\*.*?\*/", "", HTML, flags=re.S), flags=re.S)
HERO_ENGINE = (ROOT / "hero-engine.js").read_text(encoding="utf-8")
CSS = (ROOT / "play.css").read_text(encoding="utf-8")
TOURNAMENT = (ROOT / "play-tournament.js").read_text(encoding="utf-8")


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
# THE LEDE PINNED HERE WAS THE OLD ONE, AND IT WAS RIGHT TO PIN IT UNTIL IT WASN'T.
# It asserted the exact string "I made a few games for fun.</span> <span>Still building
# them." because the honest, one-size line was the fix for an earlier headline that
# stacked three type sizes over the crowd. Jayden has now reversed the second sentence's
# terminal punctuation and only that: "H1 is weak ... I was thinking we bring back the
# draggable mood words and recreate the h1 on this page, since the Play page kinda turned
# into what the home page used to look like."
# So the assertion keeps everything the original was protecting -- his own two sentences,
# verbatim and in order -- and adds the clause that hosts the live word. What it must NOT
# go back to protecting is a fixed final sentence, because the last line's WIDTH now
# changes every 8.5s as the mood cycles; the shape is asserted instead of the string.
assert "I made a few games for fun." in HTML and "Still building them," in HTML
assert 'class="pLine pMoodLine">with <span class="pMoodSlot"></span>' in HTML, \
    "the mood clause owns its own line so a word swap cannot reflow the sentence"
assert 'id="playLede"' in HTML, "play-games.js's word rig mounts on this id"
# ONE TYPE SIZE STILL. The regression Jayden named originally ("too many sizes") is a
# size count, not a line count, and the live word inherits the h1's type outright.
assert ".pLede{" in HTML and "font-size:var(--fs-heroline)" in HTML
assert not re.search(r"\.pLede[^{]*\{[^}]*font-size:[^;}]*;[^}]*font-size:", HTML)
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

# The resting page is normal flow. One named-owner state machine promotes the
# same hero to a fixed arena and owns chrome/scroll restoration for every game.
assert 'class="playViewport"' in HTML
assert ".playViewport{position:relative" in HTML
assert 'src="play-viewport.js"' in HTML
assert HTML.index('src="play-viewport.js"') < HTML.index('src="hero-engine.js"')
assert HTML.index('src="play-viewport.js"') < HTML.index('src="play-engine.js"')
assert "body.playViewportOwned .playViewport" in HTML
assert "body.playViewportOwned .jbStick" in HTML
assert ".pHub{position:relative" in HTML
assert "body.hmFull{height:auto;min-height:100%;overflow-x:clip;overflow-y:auto" in CSS
assert "body.hmFull.playViewportOwned" in CSS and "overflow:hidden" in CSS
assert "body.playViewportOwned .siteFoot{display:none}" in CSS
assert "body:is(.pTeamOn,.hmSoccer,.hmBattle,.hmRace,.hmTour) .playViewport" not in HTML
assert "body.hmFull:is(.pTeamOn,.hmSoccer,.hmBattle,.hmRace,.hmTour)" not in CSS
assert "body:is(.pTeamOn,.hmSoccer,.hmBattle,.hmRace,.hmTour) .siteFoot" not in CSS

# Each lifecycle has one authoritative named owner. Duplicate legacy scroll /
# focus capture must be absent or a second rAF can race the owner controller.
for owner_name, source in (
    ('"picker"', GAMES),
    ('"soccer"', ENGINE + GAMES),
    ('"battle"', ENGINE + GAMES),
    ('"race"', ENGINE),
    ('"tournament"', TOURNAMENT),
):
    assert f"PlayViewportOwner.enter({owner_name})" in source
    assert f"PlayViewportOwner.leave({owner_name})" in source
for rejected_restore in (
    "_returnFocus",
    "_returnScroll",
    "resetPlayScroll",
    "restorePlayPosition",
    "__hmResetPlayScroll",
):
    assert rejected_restore not in GAMES + ENGINE + TOURNAMENT

# Picker -> game is a continuous handoff: destination first, then picker art /
# owner release, then launch. The old synthetic resize belongs to Soccer Task 2.
handoff_start = GAMES.index("function startWithTeams")
handoff = GAMES[handoff_start : GAMES.index('teamsBtn.setAttribute("aria-expanded"', handoff_start)]
soccer_enter = handoff.index('PlayViewportOwner.enter("soccer")')
picker_art_off = handoff.index('classList.remove("pTeamOn")')
picker_leave = handoff.index('PlayViewportOwner.leave("picker")')
soccer_launch = handoff.index("__hmSoccerStart()")
assert soccer_enter < picker_art_off < picker_leave < soccer_launch
assert "dispatchEvent(new Event(\"resize\"))" not in handoff[:soccer_launch]

# Soccer must promote the real fixed arena and synchronously publish the
# companion plane before any soccer DOM/layout/team measurement consumes it.
soccer_start = ENGINE.index("function start(){if(S.on)return")
soccer_finish = ENGINE.index("function finish(){S.on=false", soccer_start)
soccer_lifecycle = ENGINE[soccer_start:soccer_finish]
assert "function syncSoccerArena()" in ENGINE
sync_start = ENGINE.index("function syncSoccerArena()")
sync_end = ENGINE.index("function start(){if(S.on)return", sync_start)
sync = ENGINE[sync_start:sync_end]
for fragment in (
    'PlayViewportOwner.enter("soccer")',
    'classList.add("hmSoccer")',
    "void hero.offsetHeight",
    'dispatchEvent(new Event("resize"))',
    "geo()",
):
    assert fragment in sync
assert sync.index('PlayViewportOwner.enter("soccer")') < sync.index('classList.add("hmSoccer")')
assert sync.index('classList.add("hmSoccer")') < sync.index("void hero.offsetHeight")
assert sync.index("void hero.offsetHeight") < sync.index('dispatchEvent(new Event("resize"))')
assert sync.index('dispatchEvent(new Event("resize"))') < sync.index("geo()")
assert "syncSoccerArena()" in soccer_lifecycle
assert soccer_lifecycle.index("syncSoccerArena()") < soccer_lifecycle.index("if(!ball)dom()")
assert soccer_lifecycle.count('classList.add("hmSoccer")') == 0
direct_soccer = GAMES[GAMES.index('var sg=document.getElementById("soccerGo")'):GAMES.index('var tg=document.getElementById("tourGo")')]
assert "var rc=gameCount()" in direct_soccer
assert "if(soccerOn&&!window.__hmLavaOn&&!grabbed&&!perched)surface=floorY" in ENGINE
assert "if(gameOn&&!window.__hmLavaOn&&!grabbed&&!perched)surface=floorY" not in ENGINE
assert 'if(_ownedFeet){groundY=window.__hmFeetY;if(S.on)_gyLock=groundY;}' in ENGINE
assert 'if(document.body.classList.contains("hmFull")&&window.__hmFeetY!=null)groundY=window.__hmFeetY;' not in ENGINE
assert 'if(/[?&]wraf=1/.test(location.search))window.__hmSoccerSettleProbe=' in ENGINE
assert 'by=groundY-BR' in ENGINE and 'S.ball.y=by' in ENGINE
assert 'me.__settleProbe=function(){var _ps=window.__hmSoccer;if(_ps&&_ps.on)soccerKickSeen=_ps.kickSeed;survey();var _ord=peers.filter' in ENGINE
assert 'me.kx=me.ky=0;me.__probeSettled=1;air=false;st="idle"' in ENGINE
assert '!me.__probeSettled' in ENGINE and 'o2.__probeSettled' in ENGINE

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

# The Play lobby keeps the Home spacing/stage composition and mood artwork, but
# intentionally has no local day-cycle UI or coloured portrait-lighting layer.
assert 'class="heroCopy"' in HTML
assert 'class="heroCtas"' in HTML
assert 'id="workBtn" href="#games"' in HTML
assert 'class="heroMood moodbar" id="moodbar"' in HTML
assert 'id="moodBtn"' in HTML and 'aria-controls="moodMenu"' in HTML
assert HTML.count('data-mood=') == 4
for artwork in ("camDot", "cookieDot", "discoDot", "heartDot"):
    assert artwork in HTML
assert 'id="heroTime"' not in HTML and 'id="heroTimeBtn"' not in HTML and 'id="heroTimeMenu"' not in HTML
assert 'data-time-gradient=' not in HTML and 'id="heroTimePortraitCast"' not in HTML
assert 'id="face" src="images/neutral.webp"' in HTML
assert 'id="heroMovieEffectsStage"' in HTML
assert 'src="hero-time-presets.js"' not in HTML and 'src="hero-time.js"' not in HTML
assert 'href="hero-time.css"' not in HTML
# THE HERO REFLECTION IS GONE AND THE ASSERTION IS INVERTED, not deleted -- a removal
# that leaves no trace is a removal the next pass re-adds. Jayden: "there is a random
# reflection of the big head on the bottom which looks horrible and not like the rest."
# Both implementations went: the -webkit-box-reflect on #stageMorph and the
# .playHeroReflection fallback for engines without it. A reflection asserts a polished
# floor, and this head hangs over an empty field.
# THE MATCH REFLECTIONS ARE NOT IN SCOPE and are not asserted against: .hmRefl belongs to
# heads that genuinely stand on the pitch, and play.css:428 records why it is a transform
# rather than a box-reflect.
# Measured against the page with its CSS and HTML comments stripped: the note explaining
# WHY these went names them, and a note is the opposite of a regression.
assert 'playHeroReflection' not in LIVE, "the hero head's reflection was removed on purpose"
assert '-webkit-box-reflect:' not in LIVE, "the hero head's reflection was removed on purpose"
# AND THE HERO GRADIENT WITH IT. "Subtle gradient behind the head that looks bad -- just
# remove the gradient completely." The element, its rule and its --play-aura tokens are
# out; nothing on this page paints a backdrop behind the portrait any more.
assert 'heroAura' not in LIVE and '--play-aura' not in LIVE, \
    "the Play hero carries no backdrop gradient"
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

# Play uses only the neutral global page theme; no page-local atmosphere remains.
assert "heroTimeGradient" not in HTML and "--time-cast" not in HTML

# The shared sign-off. This page used to carry its own copy of the footer -- a
# centred sentence in a 56ch measure, styled by five page-local rules. It is now
# the same column footer as every other scrolling page, and footer.css owns the
# whole component. So this contract asserts only what is Play's business:
#   * the footer is here at all, with the #contact anchor the header links to;
#   * the three contact destinations survive;
#   * the page declares no footer styling of its own beyond placement.
# Byte-identical markup across all eight pages is footer-consistency-check.py's
# job and is NOT duplicated here -- two tools asserting the same strings is how
# a footer change turns into two failures and one of them gets waived.
assert parser.footer_ids == ["contact"]
for href in (
    "https://www.linkedin.com/in/jaydenbetts",
    "https://www.instagram.com/jaydenleebetts",
    "mailto:jaydenlbetts@gmail.com",
):
    assert f'href="{href}"' in HTML
# The page owns placement (margin, measure, gutters) and nothing else. These four
# were the old page-local component and must not come back.
for dead in (".footReach{", ".footIn{", ".footMark{", "max-width:56ch"):
    assert dead not in HTML, f"play.html re-declares retired footer CSS: {dead}"
# ...and .siteFoot must carry placement only. text-align:center is what made the
# old footer a centred sentence; it is legitimate elsewhere on this page (.pLede,
# the hero line), so match the rule rather than the property.
site_foot = HTML[HTML.index(".siteFoot{"):]
site_foot = site_foot[: site_foot.index("}")]
assert "text-align" not in site_foot, ".siteFoot must not set text-align"
assert '<div class="footMark" aria-hidden="true">Jayden Betts</div>' in HTML

print("play minimal contract: PASS")
