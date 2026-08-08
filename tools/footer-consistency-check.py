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
# THE RULE IS "PAGES THAT CAN SCROLL GET THE FOOTER", NOT "TOOLS DON'T HAVE ONE".
# Stated the second way it swept play.html in with these two and kept the Play
# hub out of this component for a whole pass. play.html scrolls and has always
# carried a footer; only these two genuinely cannot reach one, because both
# compute overflow:hidden. Their header Contact control points at
# index.html#contact instead. A footer appearing on either is a regression --
# and so is one going missing from any page that scrolls.
FOOTERLESS = ["headmaker.html", "gradientlab.html"]

APPROVED_STATUS = "Open to full-time roles."
APPROVED_COPY = "© 2026 Jayden Betts"
APPROVED_MARK = "Jayden Betts"
LEGACY_PHRASES = (
    "Thanks for checking out my website",
    "would love to chat",
)
# Column heading -> the rows under it, in order, with the attributes each row
# must carry. Nothing here may be padded with a link that does not exist, and
# Spotify is not an account he has.
#
# THE RÉSUMÉ ROW IS REAL, and the earlier "there is no Resume page" note was
# half-right: there is no résumé PAGE, but Jayden-Betts-Resume.pdf is a shipping
# 105 KB file that about.html has always linked. A footer is where a recruiter
# looks for it, so it is the fourth Menu row -- 4 and 3 across the two columns
# rather than 3 and 3.
# ITS ONLY PDF AFFORDANCE IS THE ACCESSIBLE NAME, and that is deliberate. The
# whole site signals "this is a PDF" in exactly one place -- about.html's
# aria-label, matched here word for word. The file icon and the arrow on that
# link are .abLink component furniture that every one of its four links carries,
# so neither is a PDF signal and copying either would be inventing a treatment.
# It is also the only footer row with an accessible name: LinkedIn and Instagram
# merely open in a new tab, while this one changes the KIND of thing you land on.
APPROVED_RESUME_LABEL = "Jayden Betts résumé (PDF, opens in a new tab)"
APPROVED_COLUMNS = [
    (
        "Menu",
        [
            ("Work", "index.html#cases", None, None),
            ("About", "about.html", None, None),
            ("Play", "play.html", None, None),
            (
                "Résumé",
                "Jayden-Betts-Resume.pdf",
                "_blank",
                "noopener noreferrer",
            ),
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
# index.html is OUT: it carried the old centred-sentence footer and was pinned
# by hash so the contract would not fail on it while the hero lane held the
# file. It now ships the same conventional footer as every other page, so it is
# held to the full byte-identical contract like the rest.
LEGACY_FOOTER_SHA256 = {
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
                "aria-label": attr.get("aria-label"),
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
            # THE ONE ROW THAT LEAVES THE WEB. Its accessible name is the site's
            # only PDF signal, so it is contract, not decoration.
            if row["label"] == "Résumé" and row["aria-label"] != APPROVED_RESUME_LABEL:
                failures.append(
                    "the Résumé row's accessible name is missing or reworded "
                    "(expected %r)" % APPROVED_RESUME_LABEL
                )
            # AND THE RULE THAT MADE US DOUBT IT IN THE FIRST PLACE: no invented
            # destinations. A relative href must be a file that actually ships,
            # which is what turns "there is no résumé" into a question the tool
            # can answer instead of a note someone has to remember.
            href = row["href"] or ""
            if not re.match(r"^(https?:|mailto:|#)", href):
                target = href.split("#", 1)[0].split("?", 1)[0]
                if target and not os.path.exists(os.path.join(ROOT, target)):
                    failures.append(
                        "%r points at %r, which does not exist" % (row["label"], target)
                    )

    for phrase in LEGACY_PHRASES:
        if phrase in block:
            failures.append("legacy footer copy remains: %r" % phrase)

    # 4. The page may own placement only. Any footer type, colour, grid or state
    #    rule left in a page <style> block is the drift this tool exists to stop.
    #
    #    .footIn IS EXEMPT, AND THE EXEMPTION IS THE FINDING. It reads like a
    #    footer class and it is not one: besides the retired footer sentence it
    #    has always carried the INLINE CROSS-LINKS in case-study prose (Apollo ->
    #    Strata x2, Strata -> Apollo, UC Davis -> Bearings, Cluster's three,
    #    index's three, play's three). Restyling it as a footer link would have
    #    silently rewritten links in the middle of the body copy. The footer's
    #    links are .footLink now; .footIn stays a prose class, keeps its name
    #    because site-theme.css and hero-time.css already theme it under
    #    .content, and keeps its own target rule (the WCAG 2.5.8 inline
    #    exception, 41.5-46.7px on a 25.5px line pitch) which the footer's
    #    standalone 44px rows do not qualify for.
    #    So the exemption is not a hole: the two rules below hold the concerns
    #    apart in both directions -- the prose class may not appear in the
    #    footer's markup, and the component stylesheet may not style it.
    style = "".join(re.findall(r"<style[^>]*>(.*?)</style>", source, re.S))
    if "footIn" in block:
        failures.append("the prose cross-link class .footIn is back inside the footer markup")
    for selector in re.findall(r"(?m)^\s*(\.(?:siteFoot|foot[A-Z]\w*)[^{]*)\{([^}]*)\}", style):
        head, body = selector[0].strip(), selector[1]
        if head.startswith(".footIn"):
            continue
        if head != ".siteFoot":
            failures.append("page still styles %s; that belongs in footer.css" % head)
            continue
        # PLACEMENT, AND ONLY PLACEMENT. Six of the seven pages carry the footer
        # inside .wrap, which has already applied the page measure, so they need
        # two properties. index.html's footer is a child of <body>, so on that
        # page the measure itself is a page decision and it needs four more --
        # all of them still placement, none of them type, colour, grid or state.
        # The shorthands are NOT allowed: `padding` would smuggle in padding-top
        # and `margin` would smuggle in a horizontal offset. text-align is not
        # here on purpose; it is what made the old footer a centred sentence.
        stray = [
            prop
            for prop in re.findall(r"([a-z-]+)\s*:", body)
            if prop
            not in {
                "margin-top",
                "margin-inline",
                "max-width",
                "padding-inline",
                "padding-bottom",
                "scroll-margin-top",
            }
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
        # heading and link share one size; the heading is senior by weight and ink.
        ".footHead": ["var(--ctl-fs)", "var(--theme-ink)"],
        # THE WORDMARK IS SIZED BY THE MEASURE, NOT BY THE TYPE SCALE. Jayden's
        # note was that it "doesn't pertain to anything"; the answer is that its
        # ink spans the footer's measure exactly, so the same two verticals bound
        # the hairline at the top and the wordmark at the bottom. --fs-display
        # deliberately does NOT appear here: capping at the scale's top rung put
        # the ink 280px short of the right edge at 1440, which is the defect.
        # --theme-rim keeps it on the time-of-day theme AND makes it literally
        # the hairline's colour.
        ".footMark": ["100cqw", "var(--foot-mark-fit)", "var(--theme-rim)"],
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

    # THE SILENT FAILURE THIS PROJECT KEEPS HITTING. 100cqw with no query
    # container above it does not error -- it quietly resolves against the small
    # viewport instead. On index.html, whose .siteFoot carries the page gutter as
    # its own padding, that would set the wordmark ~80px too wide and push the
    # page sideways, and the CSS would still read correctly. So the container is
    # a contract, not a detail.
    site_foot = re.search(r"(?m)^\.siteFoot\s*\{([^}]*)\}", source)
    if not site_foot:
        failures.append("footer.css has no .siteFoot rule")
    elif "container-type:inline-size" not in re.sub(r"\s+", "", site_foot.group(1)):
        failures.append(
            ".siteFoot does not establish an inline-size container; .footMark's "
            "100cqw would silently resolve against the viewport"
        )

    # And the other direction of the .footIn separation: the component stylesheet
    # may mention the prose class in prose, but must never style it.
    if re.search(r"(?m)^\s*[^/\n]*\.footIn[^{\n]*\{", source):
        failures.append("footer.css styles .footIn; that is a prose class, not a footer link")
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
