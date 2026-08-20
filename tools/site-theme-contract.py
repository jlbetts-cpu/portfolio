#!/usr/bin/env python3
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parent.parent
SHIPPING=(
    "index.html","about.html","apollo.html","bearings.html","cluster.html",
    "strata.html","ucdavis.html","play.html","headmaker.html","gradientlab.html",
)
INTERNAL={
    "accent-swatches.html","button-system.html","header-prototype.html",
    "orbs.html","specimen.html",
}
THEME_SOURCES=("site-theme.css","header.css","footer.css")
PORTFOLIO_PAGES={
    "index.html":"home",
    "about.html":"about",
    "apollo.html":"case-study",
    "bearings.html":"case-study",
    "cluster.html":"case-study",
    "strata.html":"case-study",
    "ucdavis.html":"case-study",
}
AUTHORED_MEDIA=re.compile(r"(?:\bimg\b|\bpicture\b|\bvideo\b|\bcanvas\b|\.face\b|\.case(?:Media|-media)\b|\.buildStage\b|\.shot\b|\.playerStage\b|\.game-artwork\b|\.arena\b)",re.I)
THEME_SELECTOR=re.compile(r"(?:\[data-theme(?:[\]\s=]|$)|\.theme-ready\b)",re.I)
FORBIDDEN_MEDIA_PROPERTY=re.compile(r"(?:^|;)\s*(filter|opacity|mix-blend-mode)\s*:",re.I)
STYLE_BLOCK=re.compile(r"<style\b[^>]*>(.*?)</style\s*>",re.I|re.S)
CSS_COMMENT=re.compile(r"/\*.*?\*/",re.S)

def css_rules(source):
    """Yield leaf CSS rules while descending through @media/@supports blocks."""
    source=CSS_COMMENT.sub("",source)

    def matching_close(opening,end):
        depth=1
        for index in range(opening+1,end):
            if source[index]=="{":
                depth+=1
            elif source[index]=="}":
                depth-=1
                if depth==0:
                    return index
        raise AssertionError("theme stylesheet has an unclosed CSS block")

    def parse(start,end):
        cursor=start
        while cursor<end:
            opening=source.find("{",cursor,end)
            if opening<0:
                return
            selector=source[cursor:opening].strip()
            closing=matching_close(opening,end)
            declarations=source[opening+1:closing]
            if selector.startswith("@"):
                yield from parse(opening+1,closing)
            else:
                yield selector,declarations
            cursor=closing+1

    yield from parse(0,len(source))

def theme_media_violations(source):
    """Return theme-only authored-media effects without touching authored CSS."""
    violations=[]
    for selector,declarations in css_rules(source):
        if THEME_SELECTOR.search(selector) and AUTHORED_MEDIA.search(selector):
            forbidden=FORBIDDEN_MEDIA_PROPERTY.search(declarations)
            if forbidden:
                violations.append(f"{selector.strip()}: {forbidden.group(1).lower()}")
    return violations

def assert_theme_media_safe(source,label):
    violations=theme_media_violations(source)
    assert not violations, f"{label}: theme selectors cannot alter authored media ({'; '.join(violations)})"

def declarations_for(source,*selector_fragments):
    matches=[]
    for selector,declarations in css_rules(source):
        if all(fragment in selector for fragment in selector_fragments):
            matches.append(re.sub(r"\s+", "", declarations))
    return "".join(matches)

def assert_semantic_rule(source,label,selector_fragments,*declarations):
    actual=declarations_for(source,*selector_fragments)
    assert actual, f"site-theme.css: missing {label} semantic adapter"
    for declaration in declarations:
        assert re.sub(r"\s+", "", declaration) in actual, f"site-theme.css: {label} must include {declaration}"

def nav_color_transition_violations(source):
    violations=[]
    for selector,declarations in css_rules(source):
        transitions=re.findall(r"\btransition\s*:\s*([^;}]+)",declarations,re.S)
        changes_color=any(
            part.strip().startswith("color ")
            for transition in transitions
            for part in transition.split(",")
        )
        if ".jbNav" in selector and changes_color and ".theme-ready" not in selector:
            violations.append(selector.strip())
    return violations

def shipping_theme_sources():
    for filename in THEME_SOURCES:
        yield filename,(ROOT/filename).read_text(encoding="utf-8")
    for page in SHIPPING:
        source=(ROOT/page).read_text(encoding="utf-8")
        for number,match in enumerate(STYLE_BLOCK.finditer(source),start=1):
            yield f"{page} style {number}",match.group(1)

class HeadOrder(HTMLParser):
    def __init__(self):
        super().__init__()
        self.order=0
        self.scripts=[]
        self.styles=[]
        self.stylesheet_links=[]

    def handle_starttag(self,tag,attrs):
        self.order+=1
        attributes=dict(attrs)
        if tag=="script" and attributes.get("src"):
            self.scripts.append((self.order,attributes["src"]))
        if tag=="style":
            self.styles.append(self.order)
        if tag=="link" and "stylesheet" in attributes.get("rel","").lower().split():
            self.styles.append(self.order)
            self.stylesheet_links.append((self.order,attributes.get("href", "")))

def check(page):
    parser=HeadOrder()
    parser.feed((ROOT/page).read_text(encoding="utf-8"))
    sources=Counter(source for _,source in parser.scripts)
    assert sources["site-theme-state.js"]==1, f"{page}: expected one site-theme-state.js"
    assert sources["site-theme.js"]==1, f"{page}: expected one site-theme.js"
    state_order=next(order for order,source in parser.scripts if source=="site-theme-state.js")
    controller_order=next(order for order,source in parser.scripts if source=="site-theme.js")
    assert state_order<controller_order, f"{page}: state model must load before controller"
    assert parser.styles, f"{page}: no themeable styles found"
    assert controller_order<min(parser.styles), f"{page}: controller must precede all themeable styles"
    theme_links=[(order,href) for order,href in parser.stylesheet_links if href.split("?",1)[0]=="site-theme.css"]
    assert len(theme_links)==1, f"{page}: expected one site-theme.css"
    theme_order=theme_links[0][0]
    assert theme_order==max(parser.styles), f"{page}: site-theme.css must be the final stylesheet"
    for shared in ("header.css", "footer.css"):
        shared_links=[order for order,href in parser.stylesheet_links if href.split("?",1)[0]==shared]
        assert len(shared_links)==1, f"{page}: expected one {shared}"
        assert shared_links[0]<theme_order, f"{page}: {shared} must precede site-theme.css"
    if page in PORTFOLIO_PAGES:
        expected=PORTFOLIO_PAGES[page]
        source=(ROOT/page).read_text(encoding="utf-8")
        assert re.search(rf'<body\b[^>]*\bdata-theme-page=["\']{re.escape(expected)}["\']',source), f"{page}: missing data-theme-page={expected} hook"

def check_theme_stylesheet():
    source=(ROOT/"site-theme.css").read_text(encoding="utf-8")
    compact=re.sub(r"\s+", "", source)
    for token,value in (
        ("--theme-page", "#0B0C0F"), ("--theme-surface", "#111318"),
        ("--theme-elevated", "#171A21"), ("--theme-ink", "#F4F5F7"),
        ("--theme-muted", "#A7ABB4"), ("--theme-focus", "#D9D7FF"),
        ("--theme-atmosphere", "rgba(103,99,228,.16)"),
    ):
        assert f"{token}:{value}" in compact, f"site-theme.css: missing dark {token}"
    assert "color-scheme:dark" in compact, "site-theme.css: dark root must opt into color-scheme"
    assert "@media(max-width:760px){:root{--theme-duration:280ms}}" in compact, "site-theme.css: missing mobile timing"
    assert "@media(prefers-reduced-motion:reduce)" in compact and "--theme-duration:0ms" in compact, "site-theme.css: missing reduced-motion timing"
    assert "@media(forced-colors:active)" in compact, "site-theme.css: missing forced-colors guard"
    assert "--theme-atmosphere:transparent" in compact, "site-theme.css: forced colors must remove atmosphere"
    assert ".theme-ready" in source and not re.search(r"transition\s*:\s*all\b", source), "site-theme.css: transitions must be theme-ready and property-specific"
    for label,theme_source in shipping_theme_sources():
        assert_theme_media_safe(theme_source,label)
    # This probe keeps the detector honest: adding a dark media filter must fail
    # the same contract rather than merely matching a token name in source text.
    try:
        assert_theme_media_safe(':root[data-theme="dark"] .face{filter:invert(1)}',"media safety probe")
    except AssertionError:
        pass
    else:
        raise AssertionError("site-theme.css: media safety probe did not reject a dark media filter")

def check_portfolio_adapters():
    source=(ROOT/"site-theme.css").read_text(encoding="utf-8")
    assert_semantic_rule(source,"Home work surface",('body[data-theme-page="home"] .cases',),"background-color:var(--theme-page)")
    assert_semantic_rule(source,"Home selected work tab",('body[data-theme-page="home"] .csTab.on',),"color:var(--theme-ink)")
    assert_semantic_rule(source,"Home work card",('body[data-theme-page="home"] .csFrame',),"box-shadow:0 0 0 var(--hair-w) var(--theme-rim)")
    assert_semantic_rule(source,"Home footer",('body[data-theme-page="home"] .siteFoot',),"color:var(--theme-ink)")

    assert_semantic_rule(source,"About prose",('body[data-theme-page="about"]', '.abBody p'),"color:var(--theme-ink)")
    assert_semantic_rule(source,"About facts",('body[data-theme-page="about"]', '.abFactV'),"color:var(--theme-ink)")
    # ── THE "About cards" ASSERTION IS INVERTED, AND THIS IS THE REVERSAL ─────
    # It used to require site-theme.css to draw .abLink's dark rim itself:
    #   assert_semantic_rule(... 'body[data-theme-page="about"] .abLink',
    #                        'box-shadow:inset 0 0 0 var(--hair-w) var(--theme-rim)')
    # That rule is why the email button went missing at night. It is (0,4,1) and
    # .ctl--primary is (0,1,0), so an adapter written to give the row a rim also
    # overrode the library's PRIMARY -- ground, ink and all -- and repainted the
    # only call to action on a hiring page as a fourth secondary. Beside it sat
    # three rules for .abLinkPrimary, a class about.html stopped carrying when
    # the button became a .ctl, so the treatment meant to protect the primary
    # had not run since that migration.
    # The rim did not go away; it moved to where it was always defined.
    # .abLink is `class="abLink ctl ctl--primary|ctl--secondary"`, and
    # .ctl--secondary already paints --ctl-rim, which tokens.css binds to
    # var(--theme-rim). So the assertion now guards the thing that actually has
    # to stay true: THE ABOUT ADAPTER MUST NOT RESTATE WHAT THE CONTROL LIBRARY
    # OWNS. Anything that re-declares ground, ink or shadow for .abLink here
    # will outrank .ctl--primary again by specificity and reintroduce the bug.
    # The painted-pixel proof that the buttons are still themed AND still
    # distinguishable lives in tools/dark-legibility-contract.py, which measures
    # the rendered result in all seven states instead of the source text.
    # Declarations are matched at a boundary, not as substrings: the surviving
    # ':is(.abLink,.abIn,.abStack):focus-visible{outline-color:...}' rule is
    # legitimate, and a naive 'color:' test flags its outline-color and reports
    # a bug that is not there.
    about_ablink=re.compile(
        r'\[data-theme-page="about"\][^{}]*\.abLink[^{}]*\{([^{}]*)\}')
    owned_declaration=re.compile(r"(?:^|;)(background-color|background|color|box-shadow):")
    for body in about_ablink.findall(re.sub(r"\s+","",source)):
        hit=owned_declaration.search(body)
        assert hit is None, (
            "site-theme.css: the About adapter re-declares "
            f"'{hit.group(1)}' for .abLink. That selector outranks "
            ".ctl--primary and will repaint the email button as a secondary; "
            "let controls.css own it through --ctl-* instead.")
    assert_semantic_rule(source,"About media rim",('body[data-theme-page="about"] .abStack',),"box-shadow:0 0 0 var(--hair-w) var(--theme-rim)")

    assert_semantic_rule(source,"Case-study prose",('body[data-theme-page="case-study"]', '.secBody'),"color:var(--theme-ink-soft)")
    assert_semantic_rule(source,"Case-study facts",('body[data-theme-page="case-study"] .facts',),"border-color:var(--theme-rim)")
    assert_semantic_rule(source,"Case-study rail",('body[data-theme-page="case-study"] .chap[aria-current="true"] .tick',),"background-color:var(--theme-ink)")
    controls=(ROOT/"controls.css").read_text(encoding="utf-8")
    assert ".ctl--tab[aria-selected=\"true\"]" in controls and "color:var(--ctl-ink-strong)" in controls, "shared case-study tabs must consume semantic control ink"
    assert 'body[data-theme-page="case-study"] .tvTab.on' not in source, "migrated case-study tabs must not keep a competing theme adapter"
    # Before/After are captions, not badges: no chip in either theme, so what the
    # dark adapter owes them is legible ink, not a surface to sit on.
    assert_semantic_rule(source,"Case-study comparison labels",('body[data-theme-page="case-study"]', '.baLabel'),"color:var(--theme-muted)")
    assert '.baCol.isAfter .baLabel' not in source, "the After label must not take a filled chip"
    assert_semantic_rule(source,"Case-study demo caption",('body[data-theme-page="case-study"]', '.demoLabel'),"color:var(--theme-muted)")
    # The cover boundary is width-independent, so it remains present when the
    # existing mobile sheet makes the cover full-width. An outer shadow keeps
    # every authored image pixel untouched and does not affect box geometry.
    assert_semantic_rule(source,"Case-study media rim, including mobile",('body[data-theme-page="case-study"] .cover',),"box-shadow:0 0 0 var(--hair-w) var(--theme-rim)")

    # Theme interpolation must not replace component-owned entry or interaction
    # transitions. These selectors already define motion in their page styles;
    # assigning transition-property from site-theme.css would make facts jump
    # into view and would change the authored timing of tabs, links, and knobs.
    compact=re.sub(r"\s+", "", source)
    for selector in (".csTab", ".abIn", ".abLink", ".tvTab", ".chap"):
        theme_transition=re.compile(
            rf"\.theme-ready[^{{}}]*{re.escape(selector)}[^{{}}]*\{{[^{{}}]*transition-(?:property|duration|timing-function):"
        )
        assert not theme_transition.search(compact), f"site-theme.css: theme adapter must preserve {selector} transition ownership"
    # 2026-08-08, the motion consolidation. Both strings below were pinned to
    # LITERALS -- .5s / .2s / cubic-bezier(.2,.8,.2,1) -- and both now name the
    # motion ladder instead. What this contract exists to protect is the
    # COMPOSITION: the component keeps its own reveal/interaction timing AND the
    # theme keeps --theme-duration on the semantic property, in one declaration.
    # That is unchanged, and so is the reveal: --dur-enter IS 500ms and
    # --ease-out IS cubic-bezier(.2,.8,.2,1), so .facts is byte-for-byte the same
    # animation. The knob is the one deliberate change -- 200ms -> --dur-state's
    # 160ms -- so every control on the site shares one hover-in.
    facts_transition=(
        '.theme-readybody[data-theme-page="case-study"].facts{'
        'transition:opacityvar(--dur-enter)var(--ease-out),transformvar(--dur-enter)var(--ease-out),'
        'border-colorvar(--theme-duration)var(--ease-out)}'
    )
    assert facts_transition in compact, "site-theme.css: facts must compose its reveal and semantic border transitions"
    knob_transition=(
        '.theme-readybody[data-theme-page="case-study"].cmpKnob{'
        'transition:box-shadowvar(--dur-state)var(--ease-out),'
        'background-colorvar(--theme-duration)var(--ease-out),colorvar(--theme-duration)var(--ease-out)}'
    )
    assert knob_transition in compact, "site-theme.css: comparison knob must compose its interaction and semantic transitions"
    # And the ladder must actually be defined, or all three names above are a
    # silent inherit. This is the trap the radius rule fell into.
    tokens=(ROOT/"tokens.css").read_text(encoding="utf-8")
    for rung in ("--dur-press","--dur-state","--dur-state-out","--dur-move",
                 "--dur-reveal","--dur-enter"):
        assert re.search(rf"{re.escape(rung)}\s*:", tokens), \
            f"tokens.css: motion ladder rung {rung} is referenced but not defined"
    assert '@media(prefers-reduced-motion:reduce)' in compact and facts_transition.split('{',1)[0]+'{transition:none}' in compact, "site-theme.css: reduced motion must disable the composed facts reveal"

def check_shared_theme_transitions():
    header=(ROOT/"header.css").read_text(encoding="utf-8")
    footer=(ROOT/"footer.css").read_text(encoding="utf-8")
    compact_header=re.sub(r"\s+", "", header)
    compact_footer=re.sub(r"\s+", "", footer)
    assert ".theme-ready.jbNav:is(a,button,.jbDiscGo){transition:colorvar(--theme-duration,400ms)" in compact_header, "header.css: ready-state nav color transition must use --theme-duration"
    direct_hover=".theme-ready.jbGrp>:is(a,button):not(.jbHome):hover,.theme-ready.jbGrp>.jbDisc:hover>.jbDiscGo,.theme-ready.jbGrp>.jbDisc:focus-within>.jbDiscGo{transition:colorvar(--theme-duration,400ms)"
    assert direct_hover in compact_header, "header.css: ready-state direct-nav hover/focus color transition is missing"
    assert compact_header.index(direct_hover)>compact_header.index(".jbGrp>:is(a,button):not(.jbHome):hover,"), "header.css: ready-state direct-nav transition must follow the overriding hover rule"
    direct_reduced="@media(prefers-reduced-motion:reduce){.theme-ready.jbGrp>:is(a,button):not(.jbHome):hover,.theme-ready.jbGrp>.jbDisc:hover>.jbDiscGo,.theme-ready.jbGrp>.jbDisc:focus-within>.jbDiscGo{transition-duration:0ms}}"
    assert direct_reduced in compact_header, "header.css: reduced motion must match direct-nav hover/focus specificity"
    assert compact_header.index(direct_reduced)>compact_header.index(direct_hover), "header.css: direct-nav reduced-motion override must follow its ready transition"
    assert "@media(prefers-reduced-motion:reduce){.theme-ready.jbNav:is(a,button,.jbDiscGo){transition-duration:0ms}" in compact_header, "header.css: reduced motion must zero ready-state nav color transition"
    # 2026-08-08: the footer became a multi-column component, so this list is its
    # new set of ink-bearing parts. .footReach (the retired centred sentence) and
    # .footIn (which turned out to be the CASE-STUDY PROSE cross-link class, not
    # a footer class at all -- see tools/footer-consistency-check.py) are gone
    # from it deliberately. .footIn is still themed, by site-theme.css under
    # .content, which is where a prose link belongs.
    # 2026-08-20: .footMark left this list because it left the site. Jayden asked
    # for the closing wordmark to go ("we should remove the name"), so the element
    # this clause named no longer exists on any page and the assertion could only
    # have been satisfied by a dead selector. The list is still every ink-bearing
    # part of the footer, which is the property being protected -- what changed is
    # how many parts there are. The band is deliberately NOT in it: its colours
    # are canvas, not CSS ink, and footer-band.js walks them over the same
    # --theme-duration by reading the palette on a SiteTheme change.
    # tools/footer-band-contract.py asserts that walk in the renderer.
    assert ".theme-ready.siteFoot,.theme-ready.footStatus,.theme-ready.footCopy,.theme-ready.footHead{transition:colorvar(--theme-duration)" in compact_footer, "footer.css: ready-state semantic footer transition is missing"
    violations=nav_color_transition_violations(header)
    assert not violations, f"header.css: nav color transitions must be theme-ready ({'; '.join(violations)})"

def main():
    try:
        assert len(SHIPPING)==10 and len(set(SHIPPING))==10, "shipping routes must be exactly ten unique pages"
        assert not set(SHIPPING)&INTERNAL, "internal prototypes cannot be shipping routes"
        assert all((ROOT/page).is_file() for page in SHIPPING), "a shipping page is missing"
        check_theme_stylesheet()
        check_shared_theme_transitions()
        check_portfolio_adapters()
        for page in SHIPPING:
            check(page)
    except AssertionError as error:
        print(f"site theme contract: FAIL: {error}",file=sys.stderr)
        return 1
    print("site theme contract: OK")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
