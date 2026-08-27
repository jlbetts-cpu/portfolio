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

WHAT CHANGED, 2026-08-20, AND WHY IT IS NOT A RELAXATION. Jayden: "i would prefer
if the footer matched with the time of day and the insert shadow wasnt that much
it just feels too strong right now I think we should remove the name and make it
like half the height so its just a nice ending to the site in a beautiful way."

Three assertions in here described the closing wordmark: that it read exactly
"Jayden Betts", that it was aria-hidden, and that .footMark was sized off the
container measure and filled with the page ground. All three were about an
element that no longer exists, so each has been INVERTED rather than dropped --
the contract now fails if the wordmark comes BACK, which is the assertion that
protects the decision he actually made. Section 7 of CLAUDE.md is the standing
instruction here: work out whether a gate is protecting behaviour or encoding a
decision that has changed, and record the reasoning.
Two more went the same way. The .footBand rule's required declarations gained the
height and the time-of-day cast, which are the two things he asked for and the
two that would fail silently and identically ("the footer looks normal") if a
merge dropped them. And the .siteFoot container assertion went, because its only
consumer was the wordmark's 100cqw; see the note on it below.

The --self-test at the bottom is new. This tool had none, which made it the one
footer gate whose failure nobody had ever watched.
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
    # play.html is here for the same reason as everything above it: it scrolls,
    # so it gets the footer. It was the last waived page, and it was waived on a
    # misreading -- see LEGACY_FOOTER_SHA256 below. play.css:650 hides the footer
    # while a game owns the viewport; that rule keys on .siteFoot itself, so it
    # survives markup changes and does not exempt the page from this contract.
    "play.html",
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
# Empty, and it should stay that way. play.html was the last waiver: it was held
# out because the rule had been written as "full-viewport tools have no footer",
# which is not the rule. The rule is "pages that can scroll get the footer" --
# the Play hub scrolls and only hides the footer while a game owns the viewport
# (body.playViewportOwned, play.css:650, which keys on .siteFoot itself and so
# survives a markup swap). headmaker.html and gradientlab.html compute
# overflow:hidden and genuinely cannot reach a footer; they are FOOTERLESS, not
# waived. A waiver here means a page is shipping a footer nobody is checking.
LEGACY_FOOTER_SHA256 = {}


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

    # 2. THE WORDMARK, AND THIS ASSERTION NOW POINTS THE OTHER WAY.
    #    It read: the large wordmark must be exactly "Jayden Betts" and must be
    #    aria-hidden. That was right for two years and Jayden reversed it --
    #    "we should remove the name" -- so the contract reverses with it. Kept as
    #    a check rather than deleted, because the failure it now guards is real
    #    and quiet: .footMark has no rule left in footer.css, so a page that gets
    #    one back renders unstyled 16px text inside a 42px band on a phone, and
    #    the seven other pages look fine.
    if parser.mark is not None:
        failures.append(
            "the footer still carries a .footMark wordmark (%r). Jayden asked for "
            "the name to come off the bottom of the site on 2026-08-20; there is no "
            "longer a rule in footer.css that would size or colour it." % parser.mark
        )
    if '<canvas class="footBandMark"' in block:
        failures.append(
            "the footer still carries the .footBandMark canvas. It painted the "
            "wordmark knockout and its inner shadow, and footer-band.js no longer "
            "looks for it -- so it would sit in the DOM doing nothing."
        )

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

    # 3b. THE BAND, WHICH IS THE WHOLE ENDING OF THE PAGE NOW. It was three
    #     elements -- a wrapper, a field canvas and a knockout canvas over a DOM
    #     wordmark -- and it is two: the wrapper and the field. The knockout went
    #     with the name; see section 2. The wrapper is checked separately from the
    #     canvas because they fail differently: no wrapper and there is no band at
    #     all, no canvas and there is a 114px strip of flat CSS gradient where the
    #     mesh should be, which reads as "a bit plain" rather than as broken.
    for needle, why in (
        ('<div class="footBand">', "the band wrapper"),
        # THE CANVAS IS NO LONGER ONE OF THESE.  2026-08-27. .footBandField held
        # the metaball mesh and the glyph layer and both left with the ASCII
        # treatment. The WRAPPER stays required, and it is the one that matters:
        # the band's sky is CSS on .footBand, so a page missing the wrapper has
        # no band at all, which is the failure this loop exists to catch.
    ):
        if needle not in block:
            failures.append("the footer is missing %s (%s)" % (why, needle))
    if False:  # footer-band.js is deleted; nothing to require. See above.
        failures.append("the page does not load footer-band.js; the band will not paint")

    # AND THE COUPLING THE BAND DEPENDS ON. footer.css pulls the band down by
    # exactly this value so the painted floor reaches the bottom of the document.
    # If a page stops declaring it, that page gets a gap and the other seven do
    # not -- the exact shape of drift this whole tool exists to stop.
    if "padding-bottom:var(--sp-32-64)" not in re.sub(r"\s+", "", source):
        failures.append(
            "this page no longer sets .siteFoot padding-bottom:var(--sp-32-64); "
            "footer.css cancels exactly that value to seat the band on the page bottom"
        )

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
        # THE RULE LEFT THE BOX, 2026-08-20. Jayden: "the footer line should be
        # all the way across not just a line that cuts out the gutters." No
        # element here is full-bleed on every page -- .siteFoot measures
        # 80..1360 on index, 120..1320 on about, 160..1280 on the case studies --
        # so a border could not be one length everywhere, which is the very
        # defect that put it on the content box originally. It is a 100vw
        # pseudo-element now, centred on the viewport, on the same --rule token
        # the Hero's bottom edge uses so the two are one line drawn twice.
        # The BOX is still asserted here; the LINE is asserted on ::before, and
        # structure-rule-contract measures its painted width against the
        # viewport at two widths.
        ".footTop": ["position:relative", "grid-template-columns"],
        ".footTop::before": ["100vw", "var(--rule-w)", "var(--rule)"],
        ".footStatus": ["var(--fs-lead)", "var(--theme-ink)"],
        # heading and link share one size; the heading is senior by weight and ink.
        ".footHead": ["var(--ctl-fs)", "var(--theme-ink)"],
        # THE BAND CARRIES THE TWO THINGS HE ASKED FOR, AND BOTH FAIL QUIETLY.
        # This slot used to pin .footMark: 100cqw, --foot-mark-fit and
        # --theme-page, i.e. the wordmark is sized by the footer's measure rather
        # than by the type scale, and filled with the page ground so it reads as
        # cut through the band. That assertion was a real decision twice over --
        # first --theme-rim so the footer was bracketed top and bottom by the
        # hairline's colour, then --theme-page when the band arrived and made a
        # rim-coloured wordmark a smudge. Jayden replaced the premise a third
        # time by deleting the wordmark, so the slot is gone rather than
        # weakened, and .footMark's absence is asserted up in section 2.
        # What takes its place is the pair he named on 2026-08-20. Both are one
        # declaration each, neither errors when it goes, and both look like
        # "the footer is fine" from a screenshot of the page above them:
        #   height:clamp(...)  the band had NO height rule before -- .footMark's
        #     line box was its height. Lose this and the band computes 0 and
        #     disappears, because the field canvas is inset:0 and takes the box
        #     rather than making it.
        #   --foot-band-sky-*  the hour's sky. THE MECHANISM CHANGED ON
        #     2026-08-20 AND SO DID THIS SLOT. It used to name --foot-band-cast
        #     and its two amounts, which were a HUE mixed 5-20% into a ground
        #     that was 58-98% of the way to --theme-ink. Jayden: "also the footer
        #     is dark for some reason not the right color for any of the time of
        #     day." He was right and the fault was structural: a strip that is
        #     93% ink is dark whatever you mix into it, so the clock could move
        #     the band's temperature and never its lightness (painted mean luma
        #     was 41-68 across all seven states). The tones are now positions
        #     between two stops of the hero's own sky for that hour, so the
        #     needles are the stops and the veil.
        # PRESENCE ONLY HERE; each tone is checked one by one below. The old slot
        # could get away with a rule-wide needle because --foot-band-cast-lit
        # appeared in exactly one tone, so its absence WAS that tone's absence.
        # Four tones now share the same two stops, so a rule-wide needle passes
        # while three of the four still consume them -- which is a tone that has
        # quietly stopped being sky, and it is the one that would show, because
        # tone 2 is the drifting light.
        ".footBand": ["100vw", "calc(50% - 50vw)", "var(--sp-32-64)", "overflow:clip",
                      "height:clamp("],
    }
    for selector, needles in required.items():
        match = re.search(re.escape(selector) + r"\s*\{([^}]*)\}", source, re.S)
        if not match:
            failures.append("footer.css has no %s rule" % selector)
            continue
        for needle in needles:
            if needle not in match.group(1):
                failures.append("%s does not resolve %s" % (selector, needle))
    # EVERY TONE IS SKY, ONE AT A TIME. The band's four tones are four depths in
    # one hour's sky, and any one of them can be replaced by a literal without a
    # thing on the page erroring -- it just stops tracking the clock in whichever
    # part of the mesh that tone paints. tone-2 is the one that would show first
    # (it is the drifting light) and the one an optimiser would reach for.
    band_rule = re.search(r"\.footBand\s*\{([^}]*)\}", source, re.S)
    if band_rule:
        body = band_rule.group(1)
        for tone in ("base", "tone-1", "tone-2", "tone-3"):
            decl = re.search(r"--foot-band-%s\s*:(.*?);" % re.escape(tone), body, re.S)
            if not decl:
                failures.append(".footBand declares no --foot-band-%s" % tone)
                continue
            value = decl.group(1)
            for needed in ("var(--foot-band-sky-low)", "var(--foot-band-sky-high)",
                           "var(--foot-band-veil)"):
                if needed not in value:
                    failures.append(
                        "--foot-band-%s does not resolve %s; that tone has stopped being "
                        "the hour's sky and will paint the same colour at every hour"
                        % (tone, needed))

    # THE ONE PLACE THIS COMPONENT MAY REACH INTO A PAGE, NAMED SO IT CANNOT ROT.
    # .footBand cancels the page's own padding-bottom with a negative margin, so
    # that a full-bleed painted floor is not left with 64px of page ground under
    # it. That only works while every page declares exactly that value, so the
    # coupling is checked here rather than trusted -- the day a page changes it,
    # this says so instead of leaving one page with a gap nobody screenshotted.
    if "margin-bottom:calc(var(--sp-32-64) * -1)" not in re.sub(r"\s+", " ", source):
        failures.append(
            ".footBand no longer cancels the page's padding-bottom; the band will "
            "not reach the bottom of the document"
        )

    # No cast shadow anywhere on this chrome: separation is a hairline.
    for rule in re.findall(r"box-shadow\s*:\s*([^;}]*)", source):
        if "inset" not in rule and rule.strip() not in {"none"}:
            failures.append("footer chrome casts a shadow: %s" % rule.strip())
    # The links take their height from the control system, not from a literal.
    if "--ctl-pad" not in source:
        failures.append("footer links do not consume the control system's padding token")

    # SEVEN STATES, SEVEN RULES. site-theme-state.js publishes exactly these and
    # site-theme.js writes the winner onto <html> on every page, so a state with
    # no rule here is an hour of the day in which the footer silently falls back
    # to the base cast -- which looks like the feature working, because six of the
    # seven still tint. The base rule carries daytime's hue as its default, so
    # that is the one an omission would be wearing.
    # THE SKIES ARE CHECKED FOR SPREAD AND FOR DEPTH, NOT FOR VALUES. Pinning the
    # fourteen hexes would freeze a design decision that is meant to be tunable
    # by eye; what may not drift is what makes the feature a feature.
    #   * six distinct sky PAIRS. Under the old cast mechanism sunrise and sunset
    #     shared a hue and so did pre-dawn and night, so the floor was four. The
    #     sky pairs are taken from six different hero gradients and no two of
    #     them are the same picture, so the floor is six.
    #   * every pair is a DEPTH, low darker than high by enough for the mesh to
    #     show its drifting light. A pair whose two stops converge paints a flat
    #     band -- the "flat black" failure the palette note describes, wearing a
    #     new colour. 40 luma levels is well under the ~110 authored and well
    #     over anything that reads as flat.
    # The painted result is footer-band-contract's job; this catches the source,
    # where both of those are one edit away from being silently untrue.
    THEME_STATES = ["off", "pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night"]
    bare = re.sub(r"/\*.*?\*/", "", source, flags=re.S)
    skies = set()
    for state in THEME_STATES:
        rule = re.search(
            r':root\[data-theme-state="%s"\]\s*\.footBand\s*\{([^}]*)\}'
            % re.escape(state), bare, re.S)
        if not rule:
            failures.append(
                "no :root[data-theme-state=%r] .footBand rule; in that state the band "
                "falls back to the base cast and stops matching the time of day" % state
            )
            continue
        body = re.sub(r"\s+", "", rule.group(1))
        pair = []
        for stop in ("low", "high"):
            found = re.search(r"--foot-band-sky-%s:(#[0-9a-fA-F]{6})" % stop, body)
            if not found:
                failures.append("the %r state's .footBand rule names no "
                                "--foot-band-sky-%s stop; that hour falls back to the "
                                "hueless 'off' grey and stops matching the time of day"
                                % (state, stop))
            else:
                pair.append(found.group(1).lower())
        if len(pair) != 2:
            continue
        if state == "off":
            # "OFF" IS NOT AN HOUR, SO IT GETS NO SKY. A hue here would give the
            # untimed site a colour it never asked for. Checked as chroma rather
            # than as r==g==b: a neutral may carry a couple of levels of cool
            # cast without being a colour, and 10 is well inside "grey" and well
            # under any of the six skies (the flattest, daytime's high, is 23).
            for hexed in pair:
                ch = [int(hexed[1:][i:i + 2], 16) for i in (0, 2, 4)]
                if max(ch) - min(ch) > 10:
                    failures.append(
                        "the 'off' state's sky stop %s spans %d levels of chroma; "
                        "with time-of-day turned off the band would carry an hour's "
                        "hue" % (hexed, max(ch) - min(ch))
                    )
            continue
        skies.add(tuple(pair))
        lo, hi = [[int(h[1:][i:i + 2], 16) for i in (0, 2, 4)] for h in pair]
        def luma(c):
            return .299 * c[0] + .587 * c[1] + .114 * c[2]
        depth = luma(hi) - luma(lo)
        if depth < 40:
            failures.append(
                "the %r state's sky is %.0f luma levels deep (%s -> %s); the mesh mixes "
                "six gaussians into every sample, so a pair this close paints a flat "
                "band and the drifting light stops being visible" % (state, depth, pair[0], pair[1])
            )
    if skies and len(skies) < 6:
        failures.append(
            "the time-of-day skies collapse to %d distinct pair(s) across six states; "
            "each is taken from a different hero gradient, so six is the floor and "
            "fewer means two hours are painting the same band" % len(skies)
        )

    # THE INLINE-SIZE CONTAINER ASSERTION IS GONE, AND SO IS THE CONTAINER.
    # It read: .siteFoot must establish an inline-size container, or .footMark's
    # 100cqw would silently resolve against the VIEWPORT and set the wordmark
    # ~80px too wide on the six pages whose footer sits inside .wrap -- correct
    # CSS, wrong by the width of the page gutter, and invisible in review.
    # That was a real trap and it had exactly one victim, which Jayden deleted on
    # 2026-08-20. .footMark's 100cqw was the only cqw on this site, so the
    # container had no consumer left and container-type:inline-size is not free
    # to leave lying around -- it also applies layout, style and inline-size
    # containment. It was removed after proving it was inert: document-absolute
    # rects for .siteFoot, .footTop, .footId, .footNav, .footCol, .footBrand,
    # .footStatus, .footCopy, .footList and .footBand, plus scrollWidth and
    # scrollHeight, are identical with and without it on index, about, apollo and
    # play at 1440, 900 and 390.
    # WHAT REPLACES IT IS THE ASSERTION THAT WAS ALWAYS DOING THE OTHER HALF OF
    # THE JOB. .siteFoot must NOT clip its overflow: it is at most the page
    # measure wide on every page, so a clip on it cuts the full-bleed band off at
    # 1200px on the six .wrap pages and not at all on the two whose footer is a
    # <body> child -- a band that is a different width on different pages and
    # looks right on the one anybody screenshots first. That failure survived the
    # wordmark; the container did not.
    site_foot = re.search(r"(?m)^\.siteFoot\s*\{([^}]*)\}", source)
    if not site_foot:
        failures.append("footer.css has no .siteFoot rule")
    else:
        body = re.sub(r"\s+", "", site_foot.group(1))
        if "overflow-x:clip" in body or "overflow:clip" in body or "overflow:hidden" in body:
            failures.append(
                ".siteFoot clips its overflow again. It is at most the page measure "
                "wide, so this cuts the full-bleed band off at 1200px on the six "
                "pages whose footer sits inside .wrap and not at all on the two "
                "whose footer is a <body> child."
            )
        if "container-type" in body:
            failures.append(
                ".siteFoot declares container-type again. Nothing queries it -- "
                ".footMark's 100cqw was the only cqw on this site and the wordmark "
                "is gone -- and it applies layout, style and inline-size "
                "containment for nothing. If a cqw comes back, bring this with it "
                "and update this check."
            )

    # And the other direction of the .footIn separation: the component stylesheet
    # may mention the prose class in prose, but must never style it.
    if re.search(r"(?m)^\s*[^/\n]*\.footIn[^{\n]*\{", source):
        failures.append("footer.css styles .footIn; that is a prose class, not a footer link")
    return failures


def collect():
    """Every failure this contract can see, as {page or file: [reasons]}."""
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
    return failures, waived


# ── the self-test ────────────────────────────────────────────────────────────
# THIS TOOL SHIPPED WITHOUT ONE FOR TWO YEARS, which made it the only footer gate
# whose failure nobody had ever watched. Section 7 of CLAUDE.md: several gates on
# this site have been found asserting the bug rather than the behaviour, and an
# injection that cannot fail is worse than no contract at all.
# NOTHING ON DISK IS TOUCHED. read() is the single door every source in this file
# comes through, so an injection is a substitution applied in memory -- a crashed
# run cannot leave the tree broken, which is the same discipline
# footer-band-contract.py's patching server uses.
INJECTIONS = [
    # THE ANCHOR THESE TWO PATCHED AGAINST IS GONE, so they are re-anchored on
    # the band wrapper's own closing tag rather than deleted -- the bug each one
    # injects (the wordmark coming back, a second canvas coming back) is still a
    # bug and the self-test still has to be able to fail on it.
    ("the closing wordmark back in the markup (Jayden asked for it to go)",
     "about.html",
     '<div class="footBand"></div>',
     '<div class="footBand"><div class="footMark" aria-hidden="true">Jayden Betts</div></div>'),
    ("a canvas back in the band (there is no script left to paint one)",
     "about.html",
     '<div class="footBand"></div>',
     '<div class="footBand"><canvas class="footBandMark" aria-hidden="true"></canvas></div>'),
    ("the band's height rule dropped (the band computes 0 and vanishes)",
     "footer.css", " height:clamp(63px,4.86vw + 44.1px,114px);", " "),
    ("the hour's sky dropped from the band's lit tone (the tones stop being sky)",
     "footer.css",
     " --foot-band-tone-2:color-mix(in srgb,var(--theme-page) var(--foot-band-veil),\n"
     "  color-mix(in srgb,var(--foot-band-sky-low) 4%,var(--foot-band-sky-high)));",
     " --foot-band-tone-2:#c9ccd2;"),
    ("one hour left without a rule (it silently wears the hueless 'off' grey)",
     "footer.css",
     ':root[data-theme-state="dusk"]     .footBand{--foot-band-sky-low:#5e627d;--foot-band-sky-high:#cbd2e6}  /* #9da8e4 . #ccd5f0 */',
     ""),
    # THIS NEEDLE WENT STALE AND TOOK THE REST OF THE LIST WITH IT. "keep off
    # dark" (2026-08-20) rewrote the off rule to a hueless ink pair with no veil,
    # and this injection still carried the pale-grey pair it replaced -- so the
    # self-test raised on injection 6 and the seven after it never ran. A stale
    # needle is not a passing injection and it is not a failing one either; it is
    # a gate that stopped being able to fail without saying so. Re-pointed at the
    # rule that ships, and the ASSERTION is unchanged: off carries no hue.
    ("the 'off' state given an hour's hue (the untimed site gets a colour)",
     "footer.css",
     ':root[data-theme-state="off"]      .footBand{--foot-band-sky-low:#131417;--foot-band-sky-high:#3a3c40;--foot-band-veil:0%}',
     ':root[data-theme-state="off"]      .footBand{--foot-band-sky-low:#956b55;--foot-band-sky-high:#e7d8f5;--foot-band-veil:0%}'),
    ("two hours given the same sky (the ladder flattened)",
     "footer.css",
     ':root[data-theme-state="sunrise"]  .footBand{--foot-band-sky-low:#bd8a6d;--foot-band-sky-high:#fbecd7}  /* #ffc977 . #ffd79b */',
     ':root[data-theme-state="sunrise"]  .footBand{--foot-band-sky-low:#956b55;--foot-band-sky-high:#e7d8f5}'),
    ("a state's sky collapsed to one depth (a flat band, the old 'flat black')",
     "footer.css",
     ':root[data-theme-state="daytime"]  .footBand{--foot-band-sky-low:#5a86a9;--foot-band-sky-high:#ddeaf9}  /* #60a8e2 . #b4d8ff */',
     ':root[data-theme-state="daytime"]  .footBand{--foot-band-sky-low:#5a86a9;--foot-band-sky-high:#6a93b4}'),
    ("the full bleed lost (the band stops at the page measure on six of eight pages)",
     "footer.css",
     " width:100vw;max-width:100vw;margin-inline:calc(50% - 50vw);",
     " width:100%;max-width:100%;"),
    ("overflow clipped on .siteFoot again (cuts the band off at 1200px)",
     "footer.css",
     ".siteFoot{color:var(--theme-ink)}",
     ".siteFoot{color:var(--theme-ink);overflow-x:clip}"),
    ("the dead inline-size container put back on .siteFoot",
     "footer.css",
     ".siteFoot{color:var(--theme-ink)}",
     ".siteFoot{color:var(--theme-ink);container-type:inline-size}"),
    ("one page's footer edited alone (the drift this whole tool exists to stop)",
     "play.html", 'aria-label="Footer"', 'aria-label="Site footer"'),
    ("a page stops cancelling the band's negative margin",
     "apollo.html", "padding-bottom:var(--sp-32-64)", "padding-bottom:var(--sp-24)"),
]


def self_test():
    print("SELF-TEST -- each injection must be caught\n")
    real = read
    ok = True
    for label, target, needle, replacement in INJECTIONS:
        def patched(page, _t=target, _n=needle, _r=replacement):
            src = real(page)
            if page != _t:
                return src
            if _n not in src:
                raise AssertionError("self-test needle not found in %s: %r" % (_t, _n))
            return src.replace(_n, _r)
        globals()["read"] = patched
        try:
            failures, _ = collect()
        finally:
            globals()["read"] = real
        caught = bool(failures)
        print("  %s  %s" % ("CAUGHT " if caught else "MISSED ", label))
        if caught:
            page = sorted(failures)[0]
            print("            -> %s: %s" % (page, failures[page][0]))
        ok = ok and caught
    return ok


def main():
    if "--self-test" in sys.argv:
        return 0 if self_test() else 1
    failures, waived = collect()
    if failures:
        for page, errors in failures.items():
            print(f"{page}: " + "; ".join(errors))
        return 1

    pages = sorted(set(PAGES) | set(LEGACY_FOOTER_SHA256))
    print(
        "Footer consistency: PASS (%d of %d footer-bearing pages on the new contract, "
        "byte-identical markup, no wordmark, band sized and cast by the clock; "
        "%d tool pages correctly footerless)"
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
