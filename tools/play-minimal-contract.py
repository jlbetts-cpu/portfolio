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
# THE LEDE HAS BEEN ITERATED THREE TIMES AND THE PIN HAS FOLLOWED IT EACH TIME.
# v1 stacked three type sizes and was cut for it. v2 was the honest one-size line
# "I made a few games for fun. / Still building them," which Jayden then rejected:
# "this is a bad h1 lowkey". The fault was structural, not tonal -- the mood word
# arrived as a dangling clause ("with <word>") bolted onto a sentence that did not
# want one. v3 gives the word a grammatical home: "made with <word>" reads as
# English with all four of them (delight, empathy, hunger, love), which is the
# constraint that actually governs this line.
# What is asserted is the SHAPE, never the final string: the live word's width
# changes every 8.5s, so pinning the last sentence would pin a moving target.
assert "Crafting digital experiences," in HTML
assert 'class="pLine pMoodLine">made with <span class="pMoodSlot"></span>' in HTML, \
    "the mood clause owns its own line so a word swap cannot reflow the sentence"
for retired in ("I made a few games for fun.", "Still building them,"):
    assert retired not in LIVE, f"v2 lede text survives: {retired}"
assert 'id="playLede"' in HTML, "play-games.js's word rig mounts on this id"
# ONE TYPE SIZE STILL. The regression Jayden named originally ("too many sizes") is a
# size count, not a line count, and the live word inherits the h1's type outright.
assert ".pLede{" in HTML and "font-size:var(--fs-heroline)" in HTML
assert not re.search(r"\.pLede[^{]*\{[^}]*font-size:[^;}]*;[^}]*font-size:", HTML)
assert '<section class="pHub" id="games"' in HTML
assert HTML.index('class="hero" id="playArena"') < HTML.index('id="games"')
# 2026-08-26: SIX DOORS. The Yowmings League is the tournament re-aimed at a fantasy
# football draft (uprights instead of goals, a football instead of a ball) and the Workspace
# moved here off the top nav -- Jayden: "instead of being a whole tab please add it to the
# play page as well I feel like that makes more sense." This assertion was protecting "these
# are the doors, and this is their order", which is a real decision and still is; what
# changed is that there are six. It stays an EXACT list rather than a subset check, so a
# seventh door arriving unannounced still fails here.
assert parser.card_ids == ["pcYow", "pcExped", "pcTour", "pcHead", "pcGrad", "pcWork", "pcDraft"]
# TWO COLUMNS AND AN ODD COUNT LEAVES A HOLE, and a hole in this flush grid is not white
# space -- it is the container's --rule ground showing through as a solid block. Exactly one
# cell must span when the count is odd, and none may when it is even. Asserted as the
# arithmetic rather than as a fixed number of doors, so it keeps holding as doors come and go.
wide = HTML.count('class="pCard pCardWide"')
assert wide == (len(parser.card_ids) % 2), \
    f"{len(parser.card_ids)} doors need {len(parser.card_ids) % 2} spanning cell(s), found {wide}"
assert wide == 0 or '.pCardWide{grid-column:1/-1}' in HTML
for fragment in (
    "Upload a photo of your face and cut it out on a new page. It comes back and joins the crowd.",
    "Split the heads into two teams and watch them play soccer. You pick the teams first.",
    # 2026-08-11, SECOND MOVE: the cup became a twelve-team league and has been put
    # back. Jayden: "I still did like the one game elimination format." So the
    # sentence describes a knockout again, and it names the option he did ask for --
    # four more heads -- because the card is where a visitor decides whether to open
    # this door. The LABEL is still "Tournament", which is the word he uses for it and
    # the word on the Play menu row; one command in two menus must read identically.
    # This assertion is UPDATED rather than removed: the point of it is that the card
    # cannot silently disagree with the format again, which is what it caught here.
    "Eight heads knock each other out, one match at a time. Lose and you are gone. Add four more if you like.",
    # And the words the league brought with it must not survive it anywhere on the page.

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
# THE TIME OF DAY IS IN THE HEADER NOW, AND THIS ASSERTION WAS INVERTED RATHER THAN
# DELETED. It read `'id="heroTime"' not in HTML`, and it was right when it was written:
# the control lived in index.html's HERO RAIL and the Play lobby deliberately had no
# local copy. On 2026-08-26 it moved into the site header on every page -- Jayden: "the
# time of day button should be in the header since it affects all the pages" -- and
# play.html was the one page that never got it, alongside being the one page still
# carrying Workspace in the bar (2026-08-27: "why when im on the play screen workspace
# is in the header"). So a gate that would have BLOCKED the fix now asserts it: the
# control exists exactly once, it is inside the nav's utilities group, and the hero
# still has no local day-cycle UI of its own.
_end = LIVE.index('id="jbNavEnd"')
_grp = LIVE[_end:LIVE.index("</span>", _end)]
assert LIVE.count('id="heroTime"') == 1 and LIVE.count('id="heroTimeBtn"') == 1
assert 'id="heroTime"' in _grp and 'id="heroTimeBtn"' in _grp and 'id="heroTimeMenu"' in _grp
assert LIVE.index('id="heroTime"') < LIVE.index('id="jbContactBtn"' if 'id="jbContactBtn"' in LIVE else 'data-nav-item="contact"')
assert 'data-time-gradient=' not in HTML and 'id="heroTimePortraitCast"' not in HTML
# WORKSPACE IS A CARD, NOT A TAB, and the bar must not grow it back. Same shape as the
# rule above: the destinations are home/about/games/contact on every page, and the
# Workspace door lives in the games grid (#pcWork, asserted with its siblings above).
assert 'data-nav-item="workspace"' not in LIVE
assert 'id="pcWork"' in LIVE
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
# 2026-08-20: THIS ASSERTION IS INVERTED, NOT DELETED. It read "play.html still
# carries the closing wordmark", which was here because play.html was the last
# page onto the shared footer and the wordmark was the piece most likely to be
# left off. Jayden then asked for the name to come off the site entirely -- "we
# should remove the name and make it like half the height so its just a nice
# ending to the site in a beautiful way" -- so the risk this guarded reversed
# direction: the failure now is the wordmark coming BACK on one page, which is
# exactly the per-page drift .footMark{ above is watched for. Same element, same
# page, opposite sign. (Section 7 of CLAUDE.md: a gate that blocks a fix is
# updated with its reasoning, never relaxed.)
assert 'class="footMark"' not in HTML, "play.html still carries the closing wordmark"
assert 'class="footBandMark"' not in HTML, "play.html still carries the knockout canvas"
# and the band it ends on is still there, still one canvas.
assert '<div class="footBand"><canvas class="footBandField" aria-hidden="true"></canvas></div>' in HTML

# ══ THE COLUMN, THE RAILS AND THE WALLS ═══════════════════════════════════════════
# Added 2026-08-20 with the Stripe-style margin rails. Three of these guard bugs that
# were actually hit while building it, which is the only reason they are here.

# 1 ── ONE EXPRESSION FOR THE COLUMN. The rails, the walls and the card band must all
# resolve from --col-max / --col-inset. A second hand-written copy of the arithmetic is
# how the rails and the content drift apart, and the drift is invisible in a diff.
assert "--col-max:calc(var(--page-max) - var(--sp-40) * 2)" in LIVE, \
    "play.html no longer defines the column width in one place"
assert "--col-inset:max(var(--play-gutter),calc((100% - var(--col-max)) / 2))" in LIVE, \
    "play.html no longer defines the column inset in one place"
assert ".pCards{pointer-events:auto;width:100%;max-width:var(--col-max)" in LIVE, \
    "the games band has stopped taking its width from --col-max"
for side in ("left:var(--col-inset);border-left:var(--rule-w) solid var(--rule)",
             "right:var(--col-inset);border-right:var(--rule-w) solid var(--rule)"):
    assert side in LIVE, ("a margin rail is gone", side)

# 2 ── THE PHONE GUTTER IS THE SITE'S GUTTER. play.css used to push --play-gutter to 24
# below 640px while the header stayed at 16, so on a phone the page's own nav sat 8px
# outside the page's own content. With rails drawn, that gap is a visible break in the
# grid. Measured after the fix at 390: .jbNav, .pCards and .footTop are all 16 -> 374,
# which is index.html's column at the same width.
assert "@media(max-width:640px){:root{--play-gutter" not in re.sub(r"\s+", "", CSS), \
    "play.css has taken back a phone gutter that is not the site's column"
# 2026-08-27: THIS ASSERTION NOW PINS THE THING ITS OWN MESSAGE ASKED FOR. It read
# --play-gutter, which is 24 at 1440 -- and the column at 1440 is 120, so "the hero's own
# gutter has drifted off the column" was true of the value being pinned.
# docs/house-style.md §11 measured it: the page held a 24px gutter and a 120px gutter at
# once. --col-inset is the column by construction (max(gutter, (100% - --col-max)/2)) and
# was already drawing the rails, so the hero's content edge and the rail are now one line.
assert "padding:var(--sp-24) var(--col-inset) 0" in LIVE, \
    "the hero's own gutter has drifted off the column"

# 3 ── THE WALLS EXIST AND ARE NOT SWITCHED OFF BY body.hmFull. Jayden, 2026-08-20:
# "they can leave and come back like jump out the side behind the gutter wall but they
# shouldnt be on top, the gutter walls should be clean." Paint order alone is NOT
# enough -- --rule is 10% ink and a hairline at 10% over a saturated egghead cannot be
# seen, so the wall is an opaque mask at z-index 5 (above the heads at 1-4, below
# .heroCtas at 8). The hmFull clause is called out by name because play.html's <body>
# ships with that class ON: listing it in the hide selector switched the walls off on
# the only page that has them, and the symptom was a live rule computing display:none.
assert ".hero::before{content:\"\";position:absolute;inset:0;z-index:5" in LIVE, \
    "the gutter walls are gone; heads will paint across the rails"
assert "--wall-w:calc(var(--col-inset) + var(--rule-w))" in LIVE, \
    "the wall no longer covers the rail's own pixel column"
hide = re.search(r"([^{}]*)\.hero::before[^{]*\{display:none\}", LIVE)
assert hide, "nothing turns the walls off during a game"
hide_sel = LIVE[LIVE.index("body.playViewportOwned .hero::before"):]
hide_sel = hide_sel[: hide_sel.index("{display:none}")]
assert "hmFull" not in hide_sel, \
    "body.hmFull is in the wall's hide selector, and play.html's body ships with it: " \
    "the walls will be off at rest"
for game in ("hmSoccer", "hmRace", "hmTour", "hmBattle", "pTeamOn"):
    assert game in hide_sel, \
        (game + " can run with a gutter wall up; a pitch has no column and clipping "
         "a match at an invisible wall is exactly the tidying CLAUDE.md section 5 forbids")

# 4 ── THE DOORS ARE CELLS, NOT CARDS. The 2x2 grid's internal cross is the grid GAP
# over a --rule ground -- one declaration that re-forms itself when the phone block
# drops to a single column. A per-cell border version needs :nth-child() arithmetic
# rewritten at every breakpoint and is how a carpet of rules arrives.
assert "gap:var(--rule-w);background:var(--rule)" in LIVE, \
    "the games grid has lost its hairline seams"
# THE BAND OPENS ON ITS OWN RULE AND CLOSES ON THE FOOTER'S, and this assertion moved
# with that. It read `border-block`, i.e. the band drew both edges -- and 112px below
# the second one the footer drew its own, so the seam was two parallel horizontals of
# different lengths with an empty railed void between them. Jayden, 2026-08-27: "the
# point where the menu ends and the footer begins it should be connected like everything
# else on that page." One line there now, and it is the footer's, because the footer's
# is the settled one (full-bleed by his own 2026-08-20 call). So what is asserted is the
# pair that makes the join real: the band draws a TOP rule only, and .siteFoot carries no
# margin above it, or the void comes straight back.
assert "border-block-start:var(--rule-w) solid var(--rule)" in LIVE, \
    "the games band has lost the rule it opens on"
assert "border-block:var(--rule-w) solid var(--rule)" not in LIVE, \
    ("the band is closing itself again; with the footer's rule 112px below that is the "
     "doubled line and the empty railed void Jayden asked to have joined up")
_foot = LIVE[LIVE.index(" .siteFoot{"):]
_foot = _foot[: _foot.index("}")]
assert "margin-top:0" in _foot, \
    ("a gap is back between the games band and the footer's rule; the band closes ON "
     "that rule, so any margin here re-opens the void", _foot)
pcard = LIVE[LIVE.index(" .pCard{"):]
pcard = pcard[: pcard.index("}")]
assert "box-shadow:none" in pcard and "border-radius:0" in pcard, \
    ("a card rim or radius is back; the doors are cells flush to the rails now", pcard)
assert "background:var(--theme-page" in pcard, \
    ("a cell must carry the page's own ground so the seams are the only marks", pcard)

# 5 ── THE DASHED GRAB BOX IS GONE AND FOCUS IS NOT. Jayden, 2026-08-20: "could you
# remove the drag box hint it looks kinda bad especially on mobile." It had to sit
# faintly ON at rest to work on touch, which is what put a dashed rectangle around one
# word of a display headline. Removing the focus ring with it would leave a keyboard
# visitor with an invisible stop, so the ring is asserted separately.
assert "dashed" not in LIVE[LIVE.index(".cycw{"): LIVE.index(".cyc-ch{")], \
    "the dashed grab hint is back on the mood word"
assert ".cycw:focus-visible{outline:var(--focus-w) solid var(--c950)" in LIVE, \
    "the mood word has no visible keyboard focus"

print("play minimal contract: PASS")
