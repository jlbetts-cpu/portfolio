#!/usr/bin/env python3
"""Focused contracts for the minimal Play-page production pass."""

from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "play.html").read_text(encoding="utf-8")
GAMES = (ROOT / "play-games.js").read_text(encoding="utf-8")
ENGINE = (ROOT / "play-engine.js").read_text(encoding="utf-8")
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

# The accepted page stays the original page: one live arena, the honest lede,
# the same four doors, copy, destinations and launch IDs. Only their order changes.
assert HTML.count('class="hero" id="playArena"') == 1
assert "I made a few games for fun.</span> <span>Still building them." in HTML
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

# A viewport wrapper preserves the original 60vh/margin:auto field as a full
# first screen while letting the footer live below it in normal document flow.
assert 'class="playViewport"' in HTML
assert ".playViewport{position:relative;min-height:100svh;display:flex}" in HTML
assert ".hero{position:relative;width:100vw;height:60vh;margin:auto}" in HTML
assert ".pHub{position:absolute;inset:0" in HTML
assert "body.hmFull{height:auto;min-height:100%;overflow-x:clip;overflow-y:auto" in CSS
assert "body.hmFull:is(.hmSoccer,.hmBattle,.hmRace,.hmTour)" in CSS and "overflow:hidden" in CSS

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
