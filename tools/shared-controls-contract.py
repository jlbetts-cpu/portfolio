#!/usr/bin/env python3
"""Static architecture contract for the first shared-control migration."""

from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stylesheets = []
        self.elements = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "link" and "stylesheet" in values.get("rel", "").split():
            self.stylesheets.append(values.get("href"))
        self.elements.append((tag, values))


def page(name):
    parser = PageParser()
    parser.feed((ROOT / name).read_text(encoding="utf-8"))
    return parser


def classes(attrs):
    return set(attrs.get("class", "").split())


def by_id(parser, element_id):
    return next(attrs for _, attrs in parser.elements if attrs.get("id") == element_id)


def main():
    for name in ("index.html", "play.html"):
        parsed = page(name)
        assert "controls.css" in parsed.stylesheets, (name, parsed.stylesheets)
        assert parsed.stylesheets.index("tokens.css") < parsed.stylesheets.index("controls.css")

        assert {"ctl", "ctl--primary"} <= classes(by_id(parsed, "workBtn"))
        assert {"ctl", "ctl--secondary"} <= classes(
            next(attrs for tag, attrs in parsed.elements if tag == "a" and "skipLink" in classes(attrs))
        )

        nav = next(attrs for tag, attrs in parsed.elements if tag == "nav" and "jbNav" in classes(attrs))
        assert "ctl-group" in classes(nav)

    home = page("index.html")
    assert {"ctl", "ctl--icon"} <= classes(by_id(home, "heroTimeBtn"))
    assert {"ctl-menu"} <= classes(by_id(home, "heroTimeMenu"))

    play = page("play.html")
    assert {"ctl", "ctl--secondary"} <= classes(by_id(play, "moodBtn"))
    assert {"ctl-menu"} <= classes(by_id(play, "moodMenu"))
    play_ids = {attrs.get("id") for _, attrs in play.elements}
    assert not {"heroTime", "heroTimeBtn", "heroTimeMenu", "heroTimeClip", "heroTimeSpill", "heroTimePortraitCast"} & play_ids
    play_html = (ROOT / "play.html").read_text(encoding="utf-8")
    assert "data-time-gradient" not in play_html
    assert 'src="hero-time.js"' not in play_html and 'src="hero-time-presets.js"' not in play_html
    face = by_id(play, "face")
    assert face.get("src") == "images/neutral.webp" and "heroTimePortraitCast" not in classes(face)

    css = (ROOT / "controls.css").read_text(encoding="utf-8")
    for selector in (".ctl{", ".ctl--primary{", ".ctl--secondary", ".ctl--icon", ".ctl-menu{"):
        assert selector in css, selector

    print("Shared control static contract: OK")


if __name__ == "__main__":
    main()
