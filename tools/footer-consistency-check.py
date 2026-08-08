#!/usr/bin/env python3
"""Static contract for the shared footer carried by the shipping pages.

WHAT CHANGED, 2026-08-08. The footer was a centred sentence with three inline
links over a ghost wordmark. It is now a conventional multi-column footer: an
identity block (mark, status, copyright) beside two link columns, with the
wordmark closing underneath. The old contract checked the sentence word for
word; this one checks the structure, the destinations, and -- the thing that
actually kept biting -- that every copy of the markup is the same bytes.

THE BYTE CHECK IS THE POINT. Every previous drift in this component was a page
that got edited alone. Comparing normalised text and attribute tuples let a page
diverge in whitespace, ordering or an extra class and still pass. The whole
<footer> element is now compared byte for byte against the reference copy, so
there is exactly one footer on this site and no way to have two.
"""

import hashlib
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
# THESE TWO DELIBERATELY CARRY NO FOOTER: both compute overflow:hidden and cannot
# scroll to one, so a footer there is furniture nobody can reach. Their header
# Contact control points at index.html#contact instead. A footer appearing on
# either is a regression. (play.html is often described alongside them and is NOT
# one of them -- see the waiver note above.)
FOOTERLESS = ["headmaker.html", "gradientlab.html"]

APPROVED_STATUS = "Open to full-time roles."
APPROVED_COPY = "© 2026 Jayden Betts"
APPROVED_MARK = "Jayden Betts"
LEGACY_PHRASES = (
    "Thanks for checking out my website",
    "would love to chat",
)
# Column heading -> the rows under it, in order, with the attributes each row
# must carry. Nothing here may be padded with a link that does not exist:
# there is no Resume page, and Spotify is not an account he has.
APPROVED_COLUMNS = [
    (
        "Menu",
        [
            ("Work", "index.html#cases", None, None),
            ("About", "about.html", None, None),
            ("Play", "play.html", None, None),
        ],
    ),
    (
        "Contact",
        [
            (
                "LinkedIn",
                "https://www.linkedin.com/in/jaydenbetts",
                "_blank",
                "noopener noreferrer",
            ),
            (
                "Instagram",
                "https://www.instagram.com/jaydenleebetts",
                "_blank",
                "noopener noreferrer",
            ),
            ("Email", "mailto:jaydenlbetts@gmail.com", None, None),
        ],
    ),
]

FOOTER_RE = re.compile(
    r'<footer class="siteFoot" id="contact" role="contentinfo">.*?</footer>', re.S
)

# ── TWO OPEN, DATED WAIVERS ──────────────────────────────────────────────────
# Two pages could not be converted in the 2026-08-08 pass:
#
#   index.html  its hero is being rewritten by a concurrent pass and the file is
#               locked for the duration.
#   play.html   it was outside the pass's file lane -- AND it was outside the old
#               version of this tool's PAGES list, which is why nobody noticed it
#               carries a footer at all. It does: <footer class="siteFoot"> at the
#               end of the Play hub, hidden by play.css only while a game owns the
#               viewport (body.playViewportOwned). The hub itself scrolls to it.
#
# The waivers cannot hide anything. Each one is the SHA-256 of that page's footer
# as it stood before the pass, so it fires only while the page carries the OLD
# footer byte for byte. The moment either file is touched -- to land the new
# footer, or to change the old one -- the hash stops matching and the page is held
# to the same contract as every other page. Deleting an entry is the whole of
# "closing" it; nothing else has to change.
LEGACY_FOOTER_SHA256 = {
    "index.html": "12cccd8fdaa09d5d8c54bf30f8445b932f38bc174b225b1bc660466fd927cce0",
    "play.html": "f0adb841fff9e044169c8d765bd2bd951ee4801c429d22d4fc2bbc03ca1f65b4",
}


def normalise(value):
    return " ".join(value.split())


class FooterParser(HTMLParser):
    """Reads the structure out of one page's <footer>."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.footer = None
        self.brand = None
        self.status = None
        self.copyright = None
        self.mark = None
        self.nav_label = None
        self.columns = []
        self._in_footer = False
        self._sink = None
        self._buf = []
        self._link = None

    def _open(self, sink):
        self._sink = sink
        self._buf = []

    def _close(self):
        text = normalise("".join(self._buf))
        self._sink, sink = None, self._sink
        self._buf = []
        return sink, text

    def handle_starttag(self, tag, attrs):
        attr = dict(attrs)
        classes = set(attr.get("class", "").split())
        if tag == "footer" and "siteFoot" in classes:
            self.footer = attr
            self._in_footer = True
            return
        if not self._in_footer:
            return
        if "footBrand" in classes:
            self.brand = attr
        elif "footStatus" in classes:
            self._open("status")
        elif "footCopy" in classes:
            self._open("copyright")
        elif "footMark" in classes:
            self.mark_attrs = attr
            self._open("mark")
        elif tag == "nav" and "footNav" in classes:
            self.nav_label = attr.get("aria-label")
        elif "footHead" in classes:
            self.columns.append({"head": None, "rows": []})
            self._open("head")
        elif tag == "a" and "footLink" in classes:
            self._link = {
                "classes": attr.get("class"),
                "href": attr.get("href"),
                "target": attr.get("target"),
                "rel": attr.get("rel"),
            }
            self._open("link")

    def handle_data(self, data):
        if self._sink:
            self._buf.append(data)

    def handle_endtag(self, tag):
        if not self._in_footer or self._sink is None:
            if tag == "footer":
                self._in_footer = False
            return
        if self._sink == "link" and tag != "a":
            return
        sink, text = self._close()
        if sink == "status":
            self.status = text
        elif sink == "copyright":
            self.copyright = text
        elif sink == "mark":
            self.mark = text
        elif sink == "head":
            self.columns[-1]["head"] = text
        elif sink == "link":
            self._link["label"] = text
            self.columns[-1]["rows"].append(self._link)
            self._link = None


def read(page):
    with open(os.path.join(ROOT, page), encoding="utf-8") as handle:
        return handle.read()


def footer_html(page, source):
    match = FOOTER_RE.search(source)
    return match.group(0) if match else None


def validate_page(page, source, canonical):
    failures = []
    block = footer_html(page, source)
    if block is None:
        return ["no <footer class=\"siteFoot\" id=\"contact\"> on the page"]
    if canonical is not None and block != canonical:
        failures.append("footer markup is not byte-identical to index.html's")

    parser = FooterParser()
    parser.feed(block)

    if parser.footer.get("role") != "contentinfo":
        failures.append("footer is not role=contentinfo")

    # 1. The identity block: mark, status, copyright.
    if not parser.brand or parser.brand.get("href") != "index.html":
        failures.append("identity mark does not link home")
    elif "ctl" not in (parser.brand.get("class") or "").split():
        failures.append("identity mark is not a shared control (.ctl)")
    elif not parser.brand.get("aria-label"):
        failures.append("identity mark has no accessible name")
    if parser.status != APPROVED_STATUS:
        failures.append(
            "the availability line is missing or reworded (expected %r)" % APPROVED_STATUS
        )
    if parser.copyright != APPROVED_COPY:
        failures.append("copyright line does not read %r" % APPROVED_COPY)

    # 2. The wordmark. Jayden asked for it and liked it; it stays, and it stays
    #    decorative so it never lands in a screen-reader heading list.
    if parser.mark != APPROVED_MARK:
        failures.append("the large wordmark is missing or is not %r" % APPROVED_MARK)
    elif getattr(parser, "mark_attrs", {}).get("aria-hidden") != "true":
        failures.append("the wordmark is not aria-hidden")

    # 3. The columns.
    if parser.nav_label != "Footer":
        failures.append("footer nav has no aria-label=Footer")
    found = [
        (col["head"], [(r["label"], r["href"], r["target"], r["rel"]) for r in col["rows"]])
        for col in parser.columns
    ]
    if found != APPROVED_COLUMNS:
        failures.append("footer columns do not match the approved headings or destinations")
    for col in parser.columns:
        for row in col["rows"]:
            classes = set((row["classes"] or "").split())
            if not {"ctl", "ctl--quiet", "ctl--row"} <= classes:
                failures.append(
                    "%r is not a shared control row (.ctl.ctl--quiet.ctl--row)" % row["label"]
                )

    for phrase in LEGACY_PHRASES:
        if phrase in block:
            failures.append("legacy footer copy remains: %r" % phrase)

    # 4. The page may own placement only. Any footer type, colour, grid or state
    #    rule left in a page <style> block is the drift this tool exists to stop.
    style = "".join(re.findall(r"<style[^>]*>(.*?)</style>", source, re.S))
    for selector in re.findall(r"(?m)^\s*(\.(?:siteFoot|foot[A-Z]\w*)[^{]*)\{([^}]*)\}", style):
        head, body = selector[0].strip(), selector[1]
        if head != ".siteFoot":
            failures.append("page still styles %s; that belongs in footer.css" % head)
            continue
        stray = [
            prop
            for prop in re.findall(r"([a-z-]+)\s*:", body)
            if prop not in {"margin-top", "padding-bottom", "scroll-margin-top"}
        ]
        if stray:
            failures.append(
                ".siteFoot in the page owns more than placement: %s" % ", ".join(stray)
            )
    return failures


def validate_footer_css():
    """footer.css must own the component, and own it through tokens."""
    source = read("footer.css")
    failures = []
    required = {
        ".footTop": ["border-top", "var(--hair-w)", "var(--theme-rim)", "grid-template-columns"],
        ".footStatus": ["var(--fs-lead)", "var(--theme-ink)"],
        ".footHead": ["var(--fs-label)", "var(--theme-ink)"],
        ".footMark": ["var(--fs-display)", "var(--theme-rim)"],
    }
    for selector, needles in required.items():
        match = re.search(re.escape(selector) + r"\s*\{([^}]*)\}", source, re.S)
        if not match:
            failures.append("footer.css has no %s rule" % selector)
            continue
        for needle in needles:
            if needle not in match.group(1):
                failures.append("%s does not resolve %s" % (selector, needle))
    # No cast shadow anywhere on this chrome: separation is a hairline.
    for rule in re.findall(r"box-shadow\s*:\s*([^;}]*)", source):
        if "inset" not in rule and rule.strip() not in {"none"}:
            failures.append("footer chrome casts a shadow: %s" % rule.strip())
    # The links take their height from the control system, not from a literal.
    if "--ctl-pad" not in source:
        failures.append("footer links do not consume the control system's padding token")
    return failures


def main():
    # about.html is the reference copy while index.html is locked; once index is
    # unlocked the two are byte-identical and it makes no difference which is read.
    canonical = footer_html("about.html", read("about.html"))
    failures = {}
    waived = []
    for page in sorted(set(PAGES) | set(LEGACY_FOOTER_SHA256)):
        source = read(page)
        block = footer_html(page, source)
        expected = LEGACY_FOOTER_SHA256.get(page)
        if expected and block is not None:
            digest = hashlib.sha256(block.encode("utf-8")).hexdigest()
            if digest == expected:
                waived.append(page)
                continue
        errors = validate_page(page, source, canonical)
        if errors:
            failures[page] = errors
    for page in FOOTERLESS:
        path = os.path.join(ROOT, page)
        if os.path.exists(path) and FOOTER_RE.search(read(page)):
            failures[page] = ["this page must NOT have a footer; it cannot scroll to one"]
    css_errors = validate_footer_css()
    if css_errors:
        failures["footer.css"] = css_errors

    if failures:
        for page, errors in failures.items():
            print(f"{page}: " + "; ".join(errors))
        return 1

    pages = sorted(set(PAGES) | set(LEGACY_FOOTER_SHA256))
    print(
        "Footer consistency: PASS (%d of %d footer-bearing pages on the new contract, "
        "byte-identical markup; %d tool pages correctly footerless)"
        % (len(pages) - len(waived), len(pages), len(FOOTERLESS))
    )
    for page in sorted(waived):
        print(
            "  WAIVED: %s still carries the pre-2026-08-08 footer. Land the patch, "
            "then delete its entry from LEGACY_FOOTER_SHA256." % page
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
