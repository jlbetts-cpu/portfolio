#!/usr/bin/env python3
"""Static contract for the shared footer carried by the shipping pages."""

import html
import os
import re
import sys
from html.parser import HTMLParser


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = [
    "index.html",
    "about.html",
    "apollo.html",
    "bearings.html",
    "cluster.html",
    "strata.html",
    "ucdavis.html",
]
APPROVED_REACH = (
    "I’m open to full-time roles and would love to chat. "
    "Find me on LinkedIn, Instagram, or email."
)
LEGACY_PHRASE = "Thanks for checking out my website"


def normalise(value):
    return " ".join(value.split())


class FooterParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.footer = None
        self._in_footer = False
        self._target = None
        self._reach = []
        self._mark = []

    def handle_starttag(self, tag, attrs):
        attr = dict(attrs)
        classes = set(attr.get("class", "").split())
        if tag == "footer" and "siteFoot" in classes:
            self.footer = attr
            self._in_footer = True
        if self._in_footer and tag == "p" and "footReach" in classes:
            self._target = "reach"
        if self._in_footer and tag == "div" and "footMark" in classes:
            self._target = "mark"

    def handle_data(self, data):
        if self._target == "reach":
            self._reach.append(data)
        elif self._target == "mark":
            self._mark.append(data)

    def handle_endtag(self, tag):
        if tag == "p" and self._target == "reach":
            self._target = None
        elif tag == "div" and self._target == "mark":
            self._target = None
        elif tag == "footer" and self._in_footer:
            self._in_footer = False

    @property
    def reach(self):
        return normalise("".join(self._reach))

    @property
    def mark(self):
        return normalise("".join(self._mark))


def footer_measure(source):
    match = re.search(r"\.footReach\s*\{([^}]*)\}", source, re.S)
    return match and re.search(r"\bmax-width\s*:\s*56ch\s*;", match.group(1))


def validate_page(page):
    path = os.path.join(ROOT, page)
    source = open(path, encoding="utf-8").read()
    parser = FooterParser()
    parser.feed(source)
    failures = []
    if not parser.footer or parser.footer.get("id") != "contact":
        failures.append("missing siteFoot contact id")
    if parser.reach != APPROVED_REACH:
        failures.append("footer reach copy does not match approved copy")
    if LEGACY_PHRASE in html.unescape(source):
        failures.append("legacy thank-you phrase remains")
    if not footer_measure(source):
        failures.append("footReach measure is not 56ch")
    if parser.mark != "Jayden Betts":
        failures.append("footer mark is not Jayden Betts")
    return failures


failures = {page: validate_page(page) for page in PAGES}
failed = {page: errors for page, errors in failures.items() if errors}
if failed:
    for page, errors in failed.items():
        print(f"{page}: " + "; ".join(errors))
    sys.exit(1)

print("Footer consistency: PASS (7 footer-bearing shipping pages)")
