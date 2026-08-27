#!/usr/bin/env python3
import re
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
from io import BytesIO
from PIL import Image, ImageColor

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = Path("/tmp/hero-entrance-rhythm")
PORTRAIT = Image.open(ROOT / "images/neutral.webp").convert("RGBA")
PORTRAIT_ALPHA_BOUNDS = PORTRAIT.getchannel("A").getbbox()
PORTRAIT_ART_WIDTH_RATIO = (PORTRAIT_ALPHA_BOUNDS[2] - PORTRAIT_ALPHA_BOUNDS[0]) / PORTRAIT.width
PORTRAIT_ART_TOP_RATIO = PORTRAIT_ALPHA_BOUNDS[1] / PORTRAIT.height
RHYTHM_VIEWPORTS = (
    (1440, 900),
    (1280, 720),
    (1280, 650),
    (761, 844),
    (760, 844),
    (390, 844),
    (320, 800),
)


def expected_hero_height(width, height):
    # ── THE HERO GIVES A SLICE BACK, AND THIS FUNCTION HAD TO CHANGE ─────────
    # It returned `height` -- the Hero IS the viewport -- which was correct
    # from the full-bleed pass until 2026-08-20, when Jayden asked for the
    # opposite: "make the hero smaller like take up less space to see the tabs
    # and case study below". index.html now subtracts --heroReveal.
    # THIS MIRRORS THE CLAMP RATHER THAN READING IT, deliberately. A custom
    # property does not resolve through getPropertyValue -- a clamp() comes
    # back as the token stream and parseFloat gives NaN -- so the only way to
    # read the real number in a browser is to measure a probe, and a probe of
    # the Hero's height is the very thing under test. Mirroring means the two
    # have to be edited together, which for a composition value he is expected
    # to retune by eye is the right cost: the alternative is a gate that
    # cannot tell a deliberate retune from the Hero silently collapsing.
    # THE FLOOR AT ZERO IS THE SHORT-LAPTOP CASE and it is load-bearing: at
    # 1280x650 the reveal is zero and the Hero is still the whole 650px. A gate
    # that expected a constant fraction would fail that width.
    # ── RETUNED 2026-08-20 WITH THE CLAMP IT MIRRORS ────────────────────────
    # EDITED by the hero-corner-control pass, which does not own this file --
    # flagged in its report, and this is the edit the paragraph above says has
    # to happen together with index.html's.
    # Jayden: "i think the hero should be a bit smaller still like start kinda
    # around where the time button ends". Two things changed in the clamp.
    # THE FACTOR IS 1, NOT .9/.78. `(svh - K) * .9` keeps a tenth of every extra
    # pixel of window, so the Hero still grew with the monitor. Taking all the
    # slack makes the Hero its content's height -- K, or the viewport if the
    # viewport is shorter -- so the composition holds still from a 650px window
    # to a 1600px one. Everything inside it is solved against that constant.
    # THE CONSTANT IS 560 NOW, AND THE MODEL THAT SET 650 IS RETIRED.
    # It used to be solved from the resting composition: the head's rotated box
    # is 334.88px, the copy was 104px once the time control left it for the
    # corner rail, and the two gaps summed to H/2 - 269.88, so a 24px floor
    # clearance and a 31px gap under the eyebrow landed on 650. Every term in
    # that solve has since stopped being true -- the head TRAVELS the whole
    # field rather than resting under the copy, and the copy is centred in the
    # Hero rather than lifted above it, so there is no "gap under the eyebrow"
    # to solve for.
    # WHAT REPLACES IT IS THE FOLD BUDGET, which is what Jayden actually asked
    # for on 2026-08-20 ("the hero reducing in size a little more so you can
    # see at least the top of the mockups"). 560 is 62% of a 900px fold, which
    # is where the closest measured peer sits (davidhoang.com, 571 of 900 =
    # 63%, with 185px of the next section showing), and it is what NN/g's
    # illusion-of-completeness work asks for: content peeking above the fold
    # rather than a hero graphic filling it. It puts the first cover's top edge
    # at 660 -- 240px above the fold at 900 and 140px at 800.
    # The phone's 570 is unchanged: its own solve still holds and 390x844
    # already revealed the tab row and the cover top.
    # THE CAPS ARE SAFETY VALVES. They only bind above a 1150px viewport and
    # exist so a misreported svh cannot subtract the whole Hero.
    if width <= 760:
        reveal = min(max(0.0, height - 570), 400)
    else:
        reveal = min(max(0.0, height - 560), 500)
    return height - reveal

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass

def static_contract():
    tokens = (ROOT / "tokens.css").read_text(encoding="utf-8")
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    assert "--section-join-gap:var(--sp-16)" in tokens
    assert "--work-item-gap:var(--sp-64)" in tokens
    assert "--work-item-gap:var(--sp-40)" in tokens
    assert ".cases{margin-top:var(--section-join-gap)}" in html
    assert ".csItem+.csItem{margin-top:var(--work-item-gap)}" in html
    assert "--hero-mobile-height:" in tokens
    # ── THE BELT MOVED ONTO --heroBox, AND IT IS STILL A BELT ────────────────
    # This pinned `@media(max-width:760px){.hero{min-height:var(--hero-mobile-height)}}`.
    # index.html now routes every one of the Hero's heights through --heroBox,
    # so the phone fork writes the TOKEN and min-height reads the name. The
    # property being protected is unchanged and is the reason the fork exists at
    # all: --hero-mobile-height is 100dvh, and on an engine that cannot parse
    # dvh the substitution is invalid at computed-value time and min-height
    # computes to `auto` -- the 844 -> 241.7 collapse. So the @supports gate is
    # asserted too, which the old line never did.
    assert "@media(max-width:760px){:root{--heroBox:calc(var(--hero-mobile-height) - var(--heroReveal))}}" in html
    assert "@supports (height:1dvh){\n @media(max-width:760px){:root{--heroBox:" in html
    assert "min-height:var(--heroBox)" in html
    # and the plain-vh floor that stands when dvh is unavailable
    assert "@media(max-width:760px){:root{--heroReveal:0px;--heroBox:100vh;--heroRow:100vh}}" in html
    hero_time = (ROOT / "hero-time.css").read_text(encoding="utf-8")
    controls = (ROOT / "controls.css").read_text(encoding="utf-8")
    assert ".surface--hero{" in controls and "box-shadow:none" in controls.split(".surface--hero{", 1)[1].split("}", 1)[0]
    # ── THE SEAM IS A JOIN NOW, NOT A VEIL, AND THE OLD NUMBERS WERE STALE ──
    # This demanded `var(--theme-page) 10%` and `transparent 28%`. Neither has
    # been in the file since d82259a: the veil was cut back to a 0 -> 12% fade
    # when the bar became its own opaque band with a hairline floor, and
    # hero-time.css:838 carries the reasoning ("a hard stop there reads as a
    # second band rather than as one surface. A short fade keeps the join
    # soft"). The gate was red on a clean tree and was asserting a decision that
    # had been reversed, which is the failure mode CLAUDE.md section 7 lists.
    # WHAT IS STILL WORTH ASSERTING is the shape rather than the stop: the seam
    # starts on the page's own colour at 0% and has reached transparent inside
    # the top third of the Hero. That fails on a veil that grows back over the
    # sky and on a seam deleted outright, and it does not fail every time the
    # join is retuned by a few percent.
    seam = hero_time.split(".heroTimeGradient::after{", 1)[1].split("}", 1)[0]
    assert "var(--theme-page) 0%" in seam, seam
    stop = re.search(r"transparent (\d+)%", seam)
    assert stop and 5 <= int(stop.group(1)) <= 33, seam

def browser_contract(base_url):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, height in RHYTHM_VIEWPORTS:
            page = browser.new_page(viewport={"width": width, "height": height}, reduced_motion="reduce")
            page.goto(base_url + "/index.html?rhythm=1", wait_until="load")
            page.wait_for_selector(".csFrame")
            state = page.evaluate("""() => {
              const box = selector => {
                const r = document.querySelector(selector).getBoundingClientRect();
                return {top:r.top,bottom:r.bottom,width:r.width,height:r.height};
              };
              // MEASURED LEVEL. The head rests rotated now, so a bounding rect of
              // the stage is the TURNED box -- about 21% wider than the portrait at
              // 390 -- and the proportions below would be measuring the rotation
              // rather than the composition. Every angle the wrapper carries is
              // lifted for one read, !important because the entrance keyframe
              // outranks an inline write.
              const levelBox = selector => {
                const wrap = document.querySelector('#heroHeadTransform');
                const names = ['--hero-head-rotate','--hero-head-float-rot','--hero-head-enter-rot'];
                const saved = names.map(n => [n, wrap.style.getPropertyValue(n),
                  wrap.style.getPropertyPriority(n)]);
                names.forEach(n => wrap.style.setProperty(n, '0deg', 'important'));
                const out = box(selector);
                saved.forEach(([n,v,pr]) => { if (v) wrap.style.setProperty(n,v,pr);
                  else wrap.style.removeProperty(n); });
                return out;
              };
              const items = [...document.querySelectorAll('.csPanel.on .csItem')];
              const a = items[0].getBoundingClientRect();
              const b = items[1].getBoundingClientRect();
              const hero = document.querySelector('.hero');
              const heroStyle = getComputedStyle(hero);
              const headline = document.querySelector('.heroCopy h1');
              const characters = [...headline.querySelectorAll('.ch')];
              const lineCount = characters.length
                ? new Set(characters.map(node => node.offsetTop)).size
                : Math.round(headline.getBoundingClientRect().height / parseFloat(getComputedStyle(headline).lineHeight));
              // ── THIS LIST COULD GO EMPTY AND PASS, AND ALMOST DID ───────
              // It read '.heroCtas > .workCta,#heroTimeBtn'. "View work" was
              // deleted on 2026-08-20 and the tap-floor assertion below is an
              // all() over this array -- all([]) is True, so a row that had
              // lost BOTH its controls would have sailed through. The selector
              // is narrowed to what is actually there and the count is
              // asserted, so the gate fails when the row empties instead of
              // congratulating it.
              // ── AND THEN THE ROW ITSELF WENT.  2026-08-26 ──────────────
              // .heroCtas is deleted, with a headstone at index.html:949 and
              // the reasoning at :2605 -- it held exactly one control and the
              // time-of-day trigger moved to the Hero's bottom-right corner.
              // This gate went red on a clean tree the moment it did, because
              // box('.heroCtas') dereferences null. What is left to assert is
              // the deletion itself: if a row comes back, every measurement
              // below that used to be taken against it has to be re-derived
              // deliberately rather than silently, so this fails loudly.
              const ctaRow = document.querySelector('.heroCtas');
              return {
                hero: box('.hero'), cases: box('.cases'), itemGap: b.top - a.bottom,
                tabsBottom: (document.querySelector('.collection__tabs')
                  || document.querySelector('.csTabs')).getBoundingClientRect().bottom,
                overflow: document.documentElement.scrollWidth > innerWidth,
                heroShadow: heroStyle.boxShadow,
                mobile: {
                  innerWidth: hero.getBoundingClientRect().width - parseFloat(heroStyle.paddingLeft) - parseFloat(heroStyle.paddingRight),
                  lineCount, copy: box('.heroCopy'), ctaRow: !!ctaRow,
                  peek: levelBox('.heroCharacterPeek .stagewrap')
                }
              };
            }""")
            assert not state["overflow"], (width, state)
            # THE WHOLE POINT OF THE SHRINK, ASSERTED AS BEHAVIOUR. Above 780px
            # of viewport there is room for the tab row to clear the fold, and
            # Jayden asked for it in those words. Below that the reveal is zero
            # by design and there is nothing to assert.
            if height >= 780:
                assert state["tabsBottom"] <= height, (
                    "the tab row must clear the fold without a scroll", width, height, state)
            assert state["heroShadow"] == "none", state
            assert 15.5 <= state["cases"]["top"] - state["hero"]["bottom"] <= 16.5, state
            expected_gap = 40 if width <= 760 else 64
            assert expected_gap - .5 <= state["itemGap"] <= expected_gap + .5, state
            target = expected_hero_height(width, height)
            assert target - .5 <= state["hero"]["height"] <= target + .5, (
                width, height, state
            )
            if width <= 760:
                assert state["mobile"]["lineCount"] <= 3, state
                assert state["mobile"]["copy"]["top"] >= state["hero"]["top"], state
                assert state["mobile"]["copy"]["bottom"] <= state["hero"]["bottom"], state
                assert state["mobile"]["peek"]["top"] >= state["hero"]["top"], state
                assert not state["mobile"]["ctaRow"], (
                    "the CTA row is back in the Hero -- it was deleted on "
                    "2026-08-26 (index.html:949) and this gate's phone "
                    "measurements were re-aimed at .heroCopy's lower edge "
                    "because of it. Re-derive them before re-enabling it.",
                    state)
                if width <= 420:
                    # ── THE HEAD IS SMALLER, AND THAT IS JAYDEN'S CALL ────
                    # The old band (.60-.72) described a 336px portrait filling
                    # most of a phone's width. He placed it himself with the
                    # HUD at 211px, which is .35 of the art at 390 and .44 at
                    # 320 -- a portrait in a composition rather than a portrait
                    # that IS the composition. The band brackets both authored
                    # widths; it is a guard against the head drifting back to
                    # dominating the phone, not a re-derivation of the value.
                    head_ratio = state["mobile"]["peek"]["width"] * PORTRAIT_ART_WIDTH_RATIO / state["mobile"]["innerWidth"]
                    # FLOOR LOWERED 2026-08-27. The note above says it outright:
                    # this is "a guard against the head drifting back to
                    # dominating the phone", and .30 was just the authored 211px
                    # bracketed at the time. He has since asked for the head
                    # smaller twice -- "a bit smaller by default just so its a
                    # little less loud" -- so the phone head measures .256 and it
                    # is the FLOOR that fails, not the guard. .20 keeps the
                    # assertion biting in the direction it was built for and
                    # still catches the head collapsing to nothing. If he asks
                    # for smaller a third time, re-read this instead of lowering
                    # it again by reflex: below about .20 the portrait stops
                    # being a subject and becomes a detail, which is a
                    # composition decision rather than a bounds change.
                    assert .20 <= head_ratio <= .48, (head_ratio, state)
                    # ── THE HEAD IS MEASURED AGAINST THE COPY NOW, NOT THE
                    #    CTA ROW, BECAUSE THE ROW IS UNDERNEATH IT ─────────
                    # EDITED 2026-08-20 by the hero-corner-control pass, which
                    # does not own this file -- flagged in its report.
                    # This read `visible_head_top - ctas.bottom`, which was the
                    # right pair while .heroCtas was the last line of the
                    # centred copy stack. Jayden asked for the control in the
                    # Hero's bottom-right corner, so the rail is now 44px at the
                    # FLOOR -- at 390 it measures 510..554 against a head whose
                    # ink starts at 333, and the subtraction returns -221. The
                    # gate was still able to fail; it had stopped being able to
                    # pass.
                    # THE THING IT GUARDS IS UNCHANGED: the head must not crowd
                    # the type above it. That type is .heroCopy's lower edge --
                    # the same edge hero-head-transform.js floors the travel
                    # field on and the same one --hero-head-crowd-drop is solved
                    # against -- so the pair is now the head and the copy, and
                    # the band is the one that was already measured for it.
                    # ── AND THE BAND BETWEEN THEM IS GONE, DELIBERATELY ───
                    # EDITED AGAIN 2026-08-20, same day, by the hero-fold pass.
                    # `24 <= head_gap <= 96` failed at -0.26 once the copy was
                    # centred in the Hero, and the negative number is the
                    # feature rather than the regression.
                    # THE PAIR IT GUARDED HAS STOPPED BEING A PAIR. The floor
                    # of 24 encoded "the head must not crowd the type above
                    # it", which was true while the head RESTED below the copy
                    # and its travel field was floored on .heroCopy's lower
                    # edge. Neither holds: the head travels the whole field up
                    # to the bar's underside, and .heroCopy carries
                    # mix-blend-mode:difference precisely so the crossing is
                    # legible -- Jayden asked for it ("if the head is passing
                    # through it that part of the text turns white and inverts
                    # the part of the head hovering over it"). A minimum gap is
                    # now a rule that the feature must never happen, and with
                    # the headline centred the head passes through it on most
                    # frames.
                    # WHAT REPLACES IT IS THE THING THAT WOULD ACTUALLY BE
                    # WRONG: the head sitting so high that it covers the
                    # headline instead of crossing it. Measured off the ART's
                    # top edge, not the box's, and against the copy's TOP: the
                    # head's ink must never begin above the headline's first
                    # line, or the portrait is a lid on the type rather than a
                    # thing moving behind it.
                    visible_head_top = state["mobile"]["peek"]["top"] + state["mobile"]["peek"]["height"] * PORTRAIT_ART_TOP_RATIO
                    head_gap = visible_head_top - state["mobile"]["copy"]["top"]
                    assert head_gap >= 0, (
                        "the head crosses the copy, it does not cap it", head_gap, state)
                    # ── THE HEAD NO LONGER MEETS THE FLOOR ────────────────
                    # This asserted a CROP: 62-67% of the portrait above the
                    # Hero's lower edge, with the rest hanging past it. That was
                    # the right contract while --hero-peek-depth was positive.
                    # It is negative now, deliberately -- the head is suspended
                    # clear of the floor rather than cropped by it, which is
                    # also why the ground shadow was deleted. Asserting a crop
                    # ratio would now be asserting the old composition back.
                    clearance = state["hero"]["bottom"] - state["mobile"]["peek"]["bottom"]
                    assert clearance > 0, ("the head must clear the floor", state)
                    assert clearance <= state["mobile"]["peek"]["height"] * .9, state
                page.wait_for_function("() => [...document.querySelectorAll('.heroCopy h1 .ch')].every(node => node.classList.contains('show'))")
                page.wait_for_timeout(2200)
                for capture in ("daytime", "night", "off"):
                    page.evaluate("state => window.SiteTheme.setMode(state,{persist:false})", capture)
                    page.wait_for_function("state => document.querySelector('#main').dataset.timeState === state", arg=capture)
                    page.wait_for_timeout(700)
                    page.screenshot(path=str(ARTIFACTS / f"home-{width}-{height}-{capture}.png"), full_page=False)
            page.evaluate("document.querySelectorAll('.jbStick,.heroCopy').forEach(el => el.style.visibility = 'hidden')")
            # ── NIGHT IS NOT IN THIS LIST, AND THAT IS THE SKY'S DESIGN ────
            # Every other state's gradient fades out before the Hero's top edge
            # -- daytime stops lowest, at 32% -- so the top row is the page's
            # own colour and this assertion means "nothing paints above the
            # sky". Night's gradient RUNS FULL HEIGHT, by design and measured:
            # tools/hero-cloud-field-contract.py records its sky beginning at
            # row 0 at both viewports while the other five begin at 5.7% to 32%.
            # Sampled two rows in, night reads 150,151,155 against a page of
            # 253 -- a hundred levels, not a rounding error, and it is the
            # picture Jayden approved. Asserting page colour there was
            # asserting that one of the six states does not exist.
            for theme in ("off", "pre-dawn", "sunrise", "daytime", "dusk", "sunset"):
                page.evaluate("state => window.SiteTheme.setMode(state,{persist:false})", theme)
                page.wait_for_function("state => document.querySelector('#main').dataset.timeState === state", arg=theme)
                page.wait_for_timeout(700)
                hero = page.locator("#main").bounding_box()
                expected = ImageColor.getrgb(page.evaluate(
                    "getComputedStyle(document.documentElement).getPropertyValue('--theme-page').trim()"
                ))
                image = Image.open(BytesIO(page.screenshot())).convert("RGB")
                y = int(hero["y"] + 2)
                xs = (
                    int(hero["x"] + 2),
                    int(hero["x"] + hero["width"] * .25),
                    int(hero["x"] + hero["width"] * .50),
                    int(hero["x"] + hero["width"] * .75),
                    int(hero["x"] + hero["width"] - 3),
                )
                # ── THE TOLERANCE IS A CHANNEL SUM NOW, AND IT MOVED WITH
                #    THE VEIL ────────────────────────────────────────────────
                # This asked for every channel to be inside 2 of --theme-page.
                # It went red on a clean tree when the seam was cut back from a
                # 0 -> 28% veil to a 0 -> 12% join (d82259a): the sample is two
                # rows into a 560px Hero, which is 0.36% down a fade that is now
                # three times steeper, so the sky shows through by three levels
                # on one channel. Pre-dawn at mid-width read 250,251,253 against
                # 253,253,253 -- a channel SUM of 5.
                # 6 IS NOT A LOOSENING, IT IS THE SITE'S OWN DEFINITION OF
                # "this pixel is still flat page colour":
                # tools/hero-cloud-field-contract.py's sky_top() uses the same
                # number to decide where each sky begins, and it is the number
                # every measurement of the mask's placement was taken with. Two
                # gates disagreeing about what page colour is, is how the veil
                # change came to read as a regression.
                for x in xs:
                    actual = image.getpixel((x, y))
                    hit = page.evaluate("([x,y]) => { const el = document.elementFromPoint(x,y); return el && `${el.tagName}.${el.className}`; }", [x, y])
                    assert sum(abs(actual[i] - expected[i]) for i in range(3)) <= 6, (
                        width, height, theme, x, hero, hit, actual, expected
                    )
            page.close()
        browser.close()

# ── SELF-TEST ────────────────────────────────────────────────────────────────
# Two injections, one per assertion this pass added or changed. Both are served
# in flight rather than written: several agents share this worktree and a
# contract that edits index.html to test itself is one that can leave it edited.
INJECTIONS = {
    # the shrink reverted. expected_hero_height and tabsBottom must both trip.
    # THE NEEDLE WAS STALE AND THE SYMPTOM WAS NOT A MESSAGE. It still read
    # `calc((100svh - 680px) * .9)`, which index.html stopped carrying two
    # retunes ago, so `assert find in html` fired INSIDE the server thread and
    # Playwright reported ERR_EMPTY_RESPONSE instead of an assertion. If that is
    # what you are looking at, re-read the needle before the contract --
    # home-minimal-hero-contract.py carries the same headstone.
    "full-height-hero": ("--heroReveal:clamp(0px,calc(100svh - 560px),500px)",
                         "--heroReveal:0px"),
    # the CTA row back in the Hero. It replaces "empty-cta-row", whose needle
    # was `<div class="heroCtas">` -- deleted on 2026-08-26 (index.html:949), so
    # the injection could no longer be found and the assertion it aimed at could
    # no longer be reached. The phone measurements were re-aimed at .heroCopy's
    # lower edge when the row went, and this is what makes putting one back a
    # loud failure rather than a silent change of what is being measured.
    "cta-row-returns": ('<div class="heroCopy">',
                        '<div class="heroCtas"><button type="button">x</button></div>'
                        '<div class="heroCopy">'),
}


def injected_handler(find, replace):
    class Injector(Quiet):
        def send_head(self):
            if self.path.split("?")[0] not in ("/index.html", "/"):
                return super().send_head()
            body = (ROOT / "index.html").read_text(encoding="utf-8")
            assert find in body, ("injection stale; an injection that cannot fail "
                                  "is worse than none", find)
            body = body.replace(find, replace).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            from io import BytesIO
            return BytesIO(body)
    return Injector


def self_test():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    ok = True
    for name, (find, replace) in INJECTIONS.items():
        server = ThreadingHTTPServer(
            ("127.0.0.1", 0), partial(injected_handler(find, replace), directory=str(ROOT)))
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            browser_contract(f"http://127.0.0.1:{server.server_port}")
        except AssertionError as failure:
            print(f"  {name}: correctly detected -> {str(failure)[:90]}")
        else:
            print(f"  {name}: NOT DETECTED"); ok = False
        finally:
            server.shutdown(); server.server_close()
    if not ok:
        raise SystemExit("self-test: an injected bug went undetected")
    print("Hero entrance rhythm self-test: OK")


def main():
    static_contract()
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        browser_contract(f"http://127.0.0.1:{server.server_port}")
    finally:
        server.shutdown(); server.server_close()
    print("Hero entrance rhythm: OK")

if __name__ == "__main__":
    import sys
    if "--self-test" in sys.argv:
        self_test()
    else:
        main()
