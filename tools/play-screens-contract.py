#!/usr/bin/env python3
"""Holds the tournament screen and the match picker to the shared system.

WHY THIS FILE EXISTS
--------------------
On 2026-08-10 these were the two screens on jaydenbetts.com that had never
joined it. Measured on a live page at 390x844, 320x568 and 1440x900 with a
seven-head roster, before the pass that added this file:

  * control adoption 0/12 on the picker and 0/3 on the tournament -- 0.0% on
    both, against a site-wide 57.8%. Every button on both screens was a private
    re-draw of a rule controls.css already ships, and three of the copies had
    drifted off it: --r-sm 10 where the control rung is --r-md 14, weight 600
    where every other control on the site is 400, and a --mat-2 ground that does
    not follow the night theme where --ctl-ground does.
  * at 320x568 in edit mode the picker's action bar measured 320.8px of content
    in a 320px viewport. Shuffle's last letters were off the right edge of the
    phone. At rest it cleared by 0.9px, which is not a margin.
  * at 320x568 the picker panel stood 533px tall in a 568px viewport -- 94% of
    the screen -- because a fixed 56px chip could not fit two to a 104px column,
    so every head took a row of its own. The heads on the stage BEHIND the panel
    are the whole reason the screen is not a modal: you flip a chip and the head
    changes colour. On a phone you could not see it happen.

Every assertion below is one of those, expressed so that it fails again if the
defect comes back. Numbers are measured in a real browser, not read out of CSS,
because three of the four defects above were invisible in source.

THE ARCHIVO EXCEPTION, decided and now enforced
-----------------------------------------------
`.bcNum` declares Archivo 800 and is the only third weight and second family in
the codebase. It IS sanctioned, and this file is where that stops being a
comment nobody can check. The exception rests on three facts, and the contract
asserts all three rather than the conclusion:

  1. It is not a synthesis. Instrument Sans ships as two static faces, so a
     third weight would have to be faux-bolded -- that is what the two-weights
     rule is about. Archivo is declared `font-weight:100 900`, a real variable
     axis, so 800 loads a genuine instance and the browser synthesises nothing.
  2. It is one declaration, in play.css, and nowhere else. A second copy would
     mean the broadcast register had leaked.
  3. It has zero nodes until a cup is running, which is exactly why every
     at-rest census keeps failing to see it and re-reporting it as drift. The
     contract counts the nodes in both states, so "invisible at rest" is an
     asserted property rather than an excuse.

    python3 tools/play-screens-contract.py
    python3 tools/play-screens-contract.py --verbose
    python3 tools/play-screens-contract.py --self-test

--self-test re-injects each defect and requires the detector to fire. A gate
nobody has watched fail is a gate nobody should trust.
"""

import argparse
import json
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

# The census definition, copied verbatim from the 2026-08-09 conformance audit so
# the number this file prints can be compared with the site-wide one.
CTL_SEL = ("button, a[href], input:not([type=hidden]), select, textarea, summary, "
           "[role=button], [role=tab], [role=switch], [role=menuitem], [role=link], "
           "[role=checkbox], [role=radio], [role=option], [tabindex]:not([tabindex='-1'])")

# 390x844 is the iPhone 14/15 and the size Jayden names first. 320x568 is the
# smallest phone still in the wild and the one that actually broke.
SIZES = [(390, 844), (320, 568), (1440, 900)]

# Seven saved heads plus mini-Jayden is a full eight-team field with an odd real
# roster -- the case that exercises both columns, the parity chip and a
# zero-bye bracket at once.
HEADS = 7

SEED = r"""
async (n) => {
  const EGG = window.__EGGHEAD;
  const HUES = ['#e05a4e','#5aa0d8','#3fa99a','#e0b23f','#8a6bd0','#d06ba0','#6bd08a','#d0846b'];
  const img = await new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = EGG.cut; });
  const out = [];
  for (let k = 0; k < n; k++) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = HUES[k % HUES.length]; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-over';
    // readAll() de-dupes by `cut` AND by an eyes/marks key, so N copies of one
    // egg collapse to one head and nothing spawns. Shift the eyes to defeat it.
    const eyes = JSON.parse(JSON.stringify(EGG.eyes));
    eyes[0].x += k * 0.004; eyes[1].x -= k * 0.004;
    out.push({cut: c.toDataURL('image/webp', 0.9), eyes: eyes, marks: EGG.marks});
  }
  localStorage.setItem('hmCompanions', JSON.stringify(out));
  return out.length;
}
"""

# One measurement pass over a screen. Everything the assertions need, read once,
# so a failure can name the element rather than just the rule.
MEASURE = r"""
(arg) => {
  const {scope, sel} = arg;
  const root = document.querySelector(scope);
  if (!root) return {error: 'missing ' + scope};
  const vw = innerWidth, vh = innerHeight;
  const name = (e) => (e.className && e.className.baseVal !== undefined
                       ? e.className.baseVal : e.className) || e.tagName;
  const rows = Array.from(root.querySelectorAll(sel)).map(e => {
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    // The REAL target: a .ctl--sm is a 36px ink box carrying a 44px ::after pad,
    // which is legal. Measuring the border box alone would report a false
    // failure on every compact control the library ships.
    const after = getComputedStyle(e, '::after');
    const padH = parseFloat(after.height) || 0;
    return {cls: name(e), on: e.classList.contains('ctl') || e.classList.contains('field'),
            w: +r.width.toFixed(2), h: +r.height.toFixed(2),
            left: +r.left.toFixed(2), right: +r.right.toFixed(2),
            top: +r.top.toFixed(2), bottom: +r.bottom.toFixed(2),
            hit: +Math.max(r.height, padH).toFixed(2),
            radius: cs.borderTopLeftRadius, fs: cs.fontSize, fw: cs.fontWeight,
            family: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
            vis: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden'
                 && cs.display !== 'none' && +cs.opacity > 0.01};
  }).filter(r => r.vis);

  // A real scrollport, not a text line box: only an element that CAN scroll and
  // has somewhere to scroll to. scrollHeight > clientHeight on overflow:visible
  // is normal and reports phantoms.
  const scrollers = [];
  root.querySelectorAll('*').forEach(c => {
    const cs = getComputedStyle(c);
    const canY = cs.overflowY === 'auto' || cs.overflowY === 'scroll';
    const canX = cs.overflowX === 'auto' || cs.overflowX === 'scroll';
    if ((canY && c.scrollHeight > c.clientHeight + 1) ||
        (canX && c.scrollWidth > c.clientWidth + 1))
      scrollers.push(name(c));
  });

  const spill = [];
  root.querySelectorAll('*').forEach(c => {
    const r = c.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    if (getComputedStyle(c).visibility === 'hidden') return;
    if (r.right > vw + 0.5 || r.left < -0.5)
      spill.push({cls: name(c), left: +r.left.toFixed(2), right: +r.right.toFixed(2)});
  });

  const rr = root.getBoundingClientRect();
  const de = document.documentElement;
  return {rows, scrollers, spill, vw, vh,
          box: {w: +rr.width.toFixed(2), h: +rr.height.toFixed(2), top: +rr.top.toFixed(2)},
          doc: {sh: de.scrollHeight, ch: de.clientHeight,
                sw: de.scrollWidth, cw: de.clientWidth}};
}
"""

ARCHIVO = r"""
() => {
  const nodes = Array.from(document.querySelectorAll('.bcNum'));
  const painted = nodes.filter(n => n.getBoundingClientRect().width > 0);
  const cs = painted.length ? getComputedStyle(painted[0]) : null;
  // Every rule in every live sheet that names Archivo, proven from the CSSOM
  // rather than by grepping: a stylesheet that reads correctly is not the same
  // as one that runs correctly, and this project has four precedents.
  const decls = [];
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch (_) { continue; }
    /* THREE TRAPS, ALL THREE HIT ON THE WAY TO THIS FUNCTION. Written down
       because a CSSOM walk that silently matches nothing is indistinguishable
       from a clean site, and this one reported a clean site twice.

       1. RECURSING ON `r.cssRules` SKIPS EVERY STYLE RULE. Since CSS Nesting
          shipped, a plain CSSStyleRule HAS a `.cssRules` list -- empty, but
          truthy. The obvious `if (r.cssRules) { walk(r.cssRules); continue; }`
          therefore descends into every rule's empty nest and records none of
          them. The only rule that survived was @font-face, which has no nested
          list, so the contract "found" Archivo exactly once in the wrong place.
          Grouping rules are identified by the ABSENCE of a selector instead.
       2. @font-face carries a style.fontFamily of "Archivo" too, so it must be
          excluded by name or it counts as a second declaration site.
       3. .bcNum's value is `'Archivo',var(--sans)`, and a declaration holding a
          var() reference reads back as an EMPTY STRING through the typed
          longhand -- the rule is stored unresolved. Matching `style.fontFamily`
          finds nothing at all. cssText is the authored text and cannot be
          hidden by a variable. */
    const walk = (list) => { for (const r of list) {
      if (!r.selectorText) {                        // @media, @supports, @layer...
        if (r.cssRules && r.cssRules.length) walk(r.cssRules);
        continue;
      }
      if (/font-family\s*:[^;}]*archivo/i.test(r.cssText || ''))
        decls.push({sel: r.selectorText,
                    href: (sheet.href || 'inline').split('/').pop().split('?')[0],
                    weight: r.style.fontWeight});
      if (r.cssRules && r.cssRules.length) walk(r.cssRules);   // genuinely nested
    } };
    walk(rules);
  }
  // The variable-axis claim, asserted rather than assumed.
  const faces = [];
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch (_) { continue; }
    for (const r of rules)
      if (r.constructor.name === 'CSSFontFaceRule' && /archivo/i.test(r.style.fontFamily || ''))
        faces.push({family: r.style.fontFamily, weight: r.style.fontWeight});
  }
  return {count: nodes.length, painted: painted.length, decls, faces,
          computed: cs ? {family: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
                          weight: cs.fontWeight} : null};
}
"""


# Drive a whole SEASON, through the UI, the way a visitor does.
#
# 2026-08-11, SECOND MOVE -- the league has been reverted and the cup is a single
# elimination knockout again, so this drives N-1 fixtures (7 at the default field of
# 8, 11 at 12) rather than a league's 18. The shortcut of writing results straight
# into the bracket is refused for the reason it always was: a knockout PROPAGATES,
# so a result recorded behind the screen's back leaves T.cur pointing at a fixture
# the board has already moved past, and the core throws "match already final". The
# honest path is the only path.
#
# THE DELAYS ARE NOT PADDING, AND T.holdMs IS NOT A CHEAT. play-engine.js's win
# path holds the celebration and calls finish() at 5,400ms; play-tournament.js
# waits 5,600 before painting the next screen so it cannot draw over a live pitch.
# Eighteen fixtures at 6.1s is nearly two minutes of a contract sleeping, so the
# hold is read from T.holdMs (documented at its use site) and this driver shortens
# it -- while still making BOTH calls the engine makes, __hmTourWin and then
# __hmSoccerEnd. Skipping the second is one of the two documented traps that make
# a working season look stuck: .tvScreen is display:none under body.hmSoccer, every
# rect reads 0, and the champion screen appears never to paint.
CHAMPION_DRIVE = r"""
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const season = window.__hmTourCup ? window.__hmTourCup() : null;
  if (!season) return {name: null, why: 'no __hmTourCup'};
  window.__hmTour.holdMs = 60;
  for (let i = 0; i < season.fixtures + 2; i++) {
    if (document.querySelector('.tvChampNm')) break;
    const go = document.querySelector('.tvGo');
    if (!go) return {name: null, why: 'no Kick off at fixture ' + i};
    /* On the last fixture -- the final -- record the treatment BEFORE kicking off, because
       after the whistle the screen is the champion and the match-up is gone. */
    const cup = window.__hmTourCup ? window.__hmTourCup() : null;
    if (cup && cup.remaining === 1) {
      const eb = document.querySelector('.tvEyebrow');
      window.__hmTourFinalSeen = {
        poster: document.querySelectorAll('.tvPoster').length,
        posterAnimated: (function(){ const p = document.querySelector('.tvPoster');
          if (!p) return null; const cs = getComputedStyle(p);
          return cs.animationName !== 'none' || cs.transitionDuration !== '0s'; })(),
        gold: document.querySelectorAll('.tvEyebrowGold').length,
        eyebrow: eb ? eb.textContent : null,
        goldBall: document.body.classList.contains('hmFinal'),
        length: (function(){ const t = document.querySelector('.tvTape');
          return t ? (t.textContent.match(/First to (\d+)/) || [])[1] : null; })()};
    }
    go.click();
    await sleep(160);
    if (!window.__hmTourWin) return {name: null, why: 'no __hmTourWin'};
    window.__hmTourWin(1, 2, 1);
    /* AND THEN THE PITCH HAS TO HAND THE SCREEN BACK. play-engine.js's win path
       calls __hmTourWin and then `setTimeout(finish, 5400)` -- finish IS
       __hmSoccerEnd, and it is the only thing that clears body.hmSoccer. Calling
       __hmTourWin on its own, as a test driver naturally does, records the result
       and leaves the pitch up forever: .tvScreen is `display:none` under
       hmSoccer, every rect reads 0, and the champion screen appears never to
       paint. This is the documented missing-__hmSoccerEnd trap and it cost this
       contract a false green -- the clipping assertions all passed on boxes of
       size zero. Drive the same two calls the engine drives. */
    try { if (window.__hmSoccerEnd) window.__hmSoccerEnd(); } catch (_) {}
    await sleep(320);
  }

  /* ---- THE BOARD IS WALKED FIRST, AND THE PICTURE IS MEASURED AFTER, because
     clicking a tab REPAINTS -- paint() does `h.innerHTML = ''` -- and every node
     held from before the walk is detached by the time it is asked for its box. A
     detached element reports a zero rect, `0 < wrap.top` is true, and this gate
     reported the champion's head as clipped on a screen where it was measurably
     whole. That is the documented "measuring a box of size zero" trap, and it
     produced a false FAILURE here rather than the usual false pass.

     So: collect the names, come back to the ending, and only then query. ---- */
  const seen = new Set();
  const tabs = [...document.querySelectorAll('.tvTab')];
  for (let i = 1; i < tabs.length; i++) {
    tabs[i].click();
    await sleep(80);
    document.querySelectorAll('.tvTie .tvNm').forEach(e => {
      const t = e.textContent.trim(); if (t && t !== '\u2014') seen.add(t); });
  }
  const back = document.querySelectorAll('.tvTab')[0];
  if (back) { back.click(); await sleep(200); }

  /* THE FINAL ITSELF, caught on the way past. The poster and the gold are a treatment for
     ONE fixture, and the thing that must be true is that they exist there and nowhere else.
     Nothing about them animates: the 2026-08-04 cancellation was a full-viewport wipe, and
     this is a still picture in a card. */
  const seenFinal = window.__hmTourFinalSeen || null;

  const wrap = document.querySelector('.tvChampWrap');
  const head = document.querySelector('.tvChampHead');
  const crown = document.querySelector('.tvCrown');
  const panel = document.querySelector('.tvPanel');
  const nm = document.querySelector('.tvChampNm');
  if (!wrap || !head || !panel)
    return {name: nm ? nm.textContent : null, why: 'champion did not paint'};
  const wb = wrap.getBoundingClientRect(), gb = panel.getBoundingClientRect();
  // A ZERO-SIZE SCREEN MUST NOT READ AS "NOT CLIPPED". body.hmSoccer sets
  // .tvScreen to display:none, and __hmTourWin can leave it set when the engine's
  // own __hmSoccerEnd has not run -- one of the two documented traps here. Every
  // rect is then 0, and the clipping assertions all pass on a screen nobody can see.
  if (wb.height < 1 || gb.width < 1)
    return {name: nm ? nm.textContent : null,
            why: 'the champion screen has no box -- body.className is "'
                 + document.body.className + '"'};
  const hb = head.getBoundingClientRect();
  const cb = crown ? crown.getBoundingClientRect() : null;
  return {name: nm ? nm.textContent : null,
          season: window.__hmTourCup ? window.__hmTourCup() : season,
          /* BOTH EDGES. The first version only looked UP, because the shipped defect
             cropped the top of the head. The rebuild produced the same bug upside
             down -- the head resolved to 109px inside a 34px wrap and was cut off 89px
             below its own clip -- and a top-only check passed on it. */
          headClipped: hb.top < wb.top - 0.5 || hb.bottom > wb.bottom + 0.5,
          crownClipped: !!cb && (cb.top < wb.top - 0.5 || cb.bottom > wb.bottom + 0.5),
          final: seenFinal,
          named: seen.size,
          standings: (window.__hmTourStandings ? window.__hmTourStandings().length : 0)};
}
"""


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_a):
        pass


class Findings:
    def __init__(self, verbose):
        self.rows = []
        self.verbose = verbose

    def check(self, ok, label, detail=""):
        self.rows.append((bool(ok), label, detail))
        if self.verbose or not ok:
            print(("  ok   " if ok else "  FAIL ") + label + (("  --  " + detail) if detail else ""))
        return bool(ok)

    @property
    def failures(self):
        return [r for r in self.rows if not r[0]]


def open_page(browser, base, w, h, sabotage=None, tamper=None):
    ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2,
                              is_mobile=(w < 700), has_touch=(w < 700))
    pg = ctx.new_page()
    pg.goto(base + "/play.html", wait_until="load")
    pg.wait_for_timeout(900)
    pg.evaluate(SEED, HEADS)
    pg.reload(wait_until="load")
    pg.wait_for_timeout(1600)
    if sabotage:
        pg.add_style_tag(content=sabotage)
        pg.wait_for_timeout(120)
    # A FORMAT DEFECT CANNOT BE INJECTED WITH A STYLESHEET. The self-test's format
    # case replaces the conditional global the shape assertions read, which is the
    # only honest way to make "this is a league again" happen to a running page.
    if tamper:
        pg.evaluate(tamper)
        pg.wait_for_timeout(80)
    return pg


def picker(pg):
    pg.evaluate("() => window.__hmTeamScreen.open()")
    pg.wait_for_timeout(700)


def picker_edit(pg):
    pg.evaluate("() => { const b = document.querySelector('.pTeamEdit'); if (b) b.click(); }")
    pg.wait_for_timeout(350)


def picker_close(pg):
    pg.evaluate("() => window.__hmTeamScreen.close()")
    pg.wait_for_timeout(350)


def tour(pg):
    pg.evaluate("() => window.__hmTourStart()")
    pg.wait_for_timeout(1800)


def run(base, browser, f, sabotage=None, strip_ctl=False, tamper=None):
    """Every assertion, at every size. Returns the adoption tally for the report."""
    tally = {}
    for (w, h) in SIZES:
        pg = open_page(browser, base, w, h, sabotage, tamper)
        if strip_ctl:
            # The self-test's first injection: take the two screens back off the
            # shared library exactly the way they were before this pass.
            pg.evaluate("""() => { const strip = () => document.querySelectorAll(
              '.pBtn, .teamChip, .teamDel, .teamUndo, .tvTab, .tvQuit, .tvGo, .tvOptG button')
              .forEach(e => e.classList.remove(
                'ctl','ctl--primary','ctl--secondary','ctl--sm','ctl--tab'));
              strip(); new MutationObserver(strip).observe(document.body,
                {subtree:true, childList:true}); }""")
            pg.wait_for_timeout(200)

        at = "%dx%d" % (w, h)

        # THE AT-REST ARCHIVO COUNT, taken before anything is opened. This is the
        # exact state every component census samples, and it is the whole reason
        # .bcNum keeps being re-reported as a two-weights violation by tools that
        # cannot see it. Asserting zero HERE (rather than after a cup, where the
        # scoreboard's own digits legitimately outlive the tournament screen) is
        # the claim that actually matters.
        rest_bc = pg.evaluate("() => document.querySelectorAll('.bcNum').length")
        f.check(rest_bc == 0,
                "Archivo %s: zero .bcNum nodes at rest -- which is why every at-rest "
                "census misses it and re-reports it as drift" % at,
                "%d node(s) before any cup started" % rest_bc)

        # ---- the picker ----
        picker(pg)
        m = pg.evaluate(MEASURE, {"scope": ".pTeam", "sel": CTL_SEL})
        f.check("error" not in m, "picker renders at " + at, m.get("error", ""))
        if "error" not in m:
            off = [r["cls"] for r in m["rows"] if not r["on"]]
            f.check(not off, "picker %s: every control is on the shared library" % at,
                    "off-system: " + ", ".join(sorted(set(off))[:4]))
            small = [(r["cls"], r["hit"], r["w"]) for r in m["rows"]
                     if r["hit"] < 43.99 or r["w"] < 43.99]
            f.check(not small, "picker %s: every target clears 44px" % at, json.dumps(small[:3]))
            f.check(not m["spill"], "picker %s: nothing reaches past the viewport" % at,
                    json.dumps(m["spill"][:3]))
            f.check(not m["scrollers"], "picker %s: nothing scrolls" % at,
                    ", ".join(m["scrollers"][:3]))
            # THE PANEL MUST LEAVE THE STAGE VISIBLE. The heads behind it change
            # colour as you pick, and that beat is the reason this is not a modal.
            if w <= 400:
                share = m["box"]["h"] / m["vh"]
                f.check(share <= 0.72, "picker %s: panel leaves the stage room (%.0f%% of viewport)"
                        % (at, share * 100), "was 94%% at 320x568 before this pass")
            tally.setdefault("picker " + at, (sum(1 for r in m["rows"] if r["on"]), len(m["rows"])))

        # Edit mode is the wider bar -- Back plus Edit plus Shuffle -- and the
        # case that actually overflowed.
        picker_edit(pg)
        me = pg.evaluate(MEASURE, {"scope": ".pTeam", "sel": CTL_SEL})
        if "error" not in me:
            f.check(not me["spill"], "picker %s edit mode: nothing reaches past the viewport" % at,
                    json.dumps(me["spill"][:3]))
            offe = [r["cls"] for r in me["rows"] if not r["on"]]
            f.check(not offe, "picker %s edit mode: delete and undo are on the library" % at,
                    ", ".join(sorted(set(offe))[:4]))
        # THE BAR MUST FIT ITS OWN PANEL, which is the real statement of the
        # defect and a stricter test than "inside the viewport". The shipped bug
        # was 320.8px of buttons in a 320px screen, but a bar that merely spills
        # over the panel's padding -- ending flush against the rounded corner
        # rather than off the phone -- is the same fault one pixel earlier, and
        # the viewport test cannot see it. Children against parent, not against
        # the window.
        fit = pg.evaluate("""() => {
          const bar = document.querySelector('.pTeamBar');
          if (!bar) return null;
          const b = bar.getBoundingClientRect();
          let far = -Infinity, who = null;
          bar.querySelectorAll(':scope > *').forEach(c => {
            const r = c.getBoundingClientRect();
            if (r.width > 0 && r.right > far) { far = r.right; who = c.className; }
          });
          return {barRight: +b.right.toFixed(2), farRight: +far.toFixed(2), who: who,
                  over: +(far - b.right).toFixed(2)};
        }""")
        f.check(fit and fit["over"] <= 0.5,
                "picker %s edit mode: the action bar fits inside its own panel" % at,
                json.dumps(fit))
        picker_edit(pg)
        picker_close(pg)

        # ---- the tournament ----
        tour(pg)
        t = pg.evaluate(MEASURE, {"scope": ".tvScreen", "sel": CTL_SEL})
        f.check("error" not in t, "tournament renders at " + at, t.get("error", ""))
        if "error" not in t:
            off = [r["cls"] for r in t["rows"] if not r["on"]]
            f.check(not off, "tournament %s: every control is on the shared library" % at,
                    "off-system: " + ", ".join(sorted(set(off))[:4]))
            small = [(r["cls"], r["hit"]) for r in t["rows"] if r["hit"] < 43.99 or r["w"] < 43.99]
            f.check(not small, "tournament %s: every target clears 44px" % at, json.dumps(small[:3]))
            f.check(not t["spill"], "tournament %s: nothing reaches past the viewport" % at,
                    json.dumps(t["spill"][:3]))
            f.check(not t["scrollers"], "tournament %s: nothing scrolls" % at,
                    ", ".join(t["scrollers"][:3]))
            f.check(t["doc"]["sh"] <= t["doc"]["ch"] + 1,
                    "tournament %s: the page itself does not scroll" % at,
                    "scrollHeight %s vs clientHeight %s" % (t["doc"]["sh"], t["doc"]["ch"]))
            tally.setdefault("tournament " + at, (sum(1 for r in t["rows"] if r["on"]), len(t["rows"])))

        # THE ROUND NAME MUST SURVIVE. It is the one piece of information on the
        # strip, and it is what the short button labels were bought to protect.
        # ---- THE CUP'S SHAPE, read off the running bracket rather than asserted
        # against a constant that could have been copied. FIELD is the only number
        # that decides the competition; the rounds, their names, the fixture count
        # and whether there is a play-in at all are DERIVED from it, so every check
        # below fails the moment something downstream grows a second hardcoded copy.
        # That is not hypothetical: a hardcoded row count hid half a table twice, once
        # when the field went 12 -> 8 and again when it went 8 -> 12.
        shape = pg.evaluate("""() => {
          const c = window.__hmTourCup ? window.__hmTourCup() : null;
          const st = window.__hmTourStandings ? window.__hmTourStandings() : [];
          const tabs = [...document.querySelectorAll('.tvTab')];
          const clipped = tabs.filter(e => e.scrollWidth > e.clientWidth + 1)
                              .map(e => e.textContent);
          return {cup: c, teams: st.length,
                  tabs: tabs.map(e => e.textContent), tabsClipped: clipped,
                  eyebrow: (document.querySelector('.tvEyebrow')||{}).textContent,
                  seedShown: /seed/i.test(document.querySelector('.tvScreen').textContent),
                  screenText: document.querySelector('.tvScreen').textContent}; }""")
        cup = shape["cup"]
        f.check(bool(cup), "cup %s: a cup is running and describes itself" % at,
                json.dumps(shape)[:200])

        # ---- SINGLE ELIMINATION, WHICH IS THE FORMAT JAYDEN ASKED FOR BACK.
        # "I still did like the one game elimination format." A knockout has exactly
        # N-1 fixtures, because every fixture eliminates exactly one team and all but
        # the champion are eliminated. That identity is the format, so asserting it is
        # asserting the format -- a league of the same field would have had 18.
        f.check(cup and cup["fixtures"] == cup["teams"] - 1,
                "cup %s: %s fixtures for %s teams -- N-1, single elimination"
                % (at, cup and cup["fixtures"], cup and cup["teams"]), json.dumps(cup))

        # ---- THE DEFAULT FIELD IS EIGHT, and it is quarter -> semi -> final with
        # nothing else. This is the shape the cup had before the league and the shape
        # he named. A field of 8 needs no play-in, so there must not be one.
        f.check(cup and cup["teams"] == 8,
                "cup %s: the default field is 8" % at, json.dumps(cup))
        f.check(cup and not cup["playIn"],
                "cup %s: a field of 8 opens with no play-in" % at, json.dumps(cup))
        f.check(cup and [r["label"] for r in cup["rounds"]]
                == ["Quarter-final", "Semi-final", "Final"],
                "cup %s: the rounds are quarter, semi, final" % at,
                json.dumps(cup and [r["label"] for r in cup["rounds"]]))

        # ---- NO ROUND MAY BE NAMED FOR MORE TEAMS THAN ENTERED. Jayden, on the
        # sixteen-slot bracket the field was cut to eight to escape: "What's the round
        # of 16? There are only 8 players." A round named for competitors who do not
        # exist is the specific defect, so it is checked rather than remembered.
        if cup:
            phantom = [r["label"] for r in cup["rounds"] if r["teams"] > cup["teams"]]
            f.check(not phantom,
                    "cup %s: no round is named for more teams than entered" % at,
                    json.dumps(phantom))

        # ---- AND NO BYES. The play-in construction cannot produce one at any field
        # size, which is the whole reason it was chosen over padding to sixteen -- a
        # bye is free advancement handed to whoever the draw favoured. Every fixture
        # the board carries must have two real sides by the time it is playable, and
        # the round sizes must add up to the field with nobody counted twice.
        if cup:
            entered = cup["rounds"][0]["matches"] * 2 + (
                cup["rounds"][1]["matches"] * 2 - cup["rounds"][0]["matches"]
                if cup["playIn"] else 0)
            f.check(entered == cup["teams"],
                    "cup %s: every one of the %d heads enters a real fixture"
                    % (at, cup["teams"]), json.dumps({"entered": entered, "cup": cup}))
            f.check("bye" not in shape["screenText"].lower()
                    and "walkover" not in shape["screenText"].lower(),
                    "cup %s: the words bye and walkover appear nowhere on screen" % at)

        # ---- THE SEED IS GONE FROM THE SCREEN. Jayden: "The seeds don't really make
        # sense -- like who is 1 and 8, and what does that mean." It came back on the
        # match-up screen once already ("Seeds 3 and 7"), so it is checked rather than
        # remembered. The league replaced it with a league POSITION, which meant
        # replacing the format; the knockout needs neither, because who meets whom is
        # the draw.
        f.check(not shape["seedShown"],
                "cup %s: the word 'seed' appears nowhere on the screen" % at,
                json.dumps(shape["screenText"])[:160])

        # ---- AND SO IS THE LEAGUE. The vocabulary it brought must not outlive it on
        # this screen, or the two formats are both half-present.
        low = shape["screenText"].lower()
        stale = [w for w in ("matchday", "league table", "goal difference", "points")
                 if w in low]
        f.check(not stale, "cup %s: no league vocabulary survives on the screen" % at,
                json.dumps(stale))

        # ---- THE ROUND NAMES DERIVE FROM THE FIELD, and the tabs carry them. Nothing
        # in the UI counts rounds or names them: it asks the bracket, which had to know
        # how many teams are in each round in order to build it.
        f.check(shape["tabs"] == ["Next", "Last 8", "Last 4", "Final"],
                "cup %s: the tabs are named by the bracket" % at, json.dumps(shape["tabs"]))
        f.check(not shape["tabsClipped"],
                "cup %s: no tab label is clipped by its own column" % at,
                json.dumps(shape["tabsClipped"]))
        # EVERY TAB IS A 44px TARGET, and this is the assertion the Draft tab broke: a
        # finished twelve-head cup carries six tabs, and at 320 six equal columns measured
        # 39.7 wide. Width, not just height -- .ctl--tab's ::after is an underline, not a
        # hit pad, so nothing is padding these out.
        tabw = pg.evaluate("""() => [...document.querySelectorAll('.tvTab')]
          .map(e => ({t: e.textContent, w: +e.getBoundingClientRect().width.toFixed(1)}))""")
        thin = [t for t in tabw if t["w"] < 43.99]
        f.check(not thin, "cup %s: every tab clears the 44px target on width" % at,
                json.dumps(tabw))
        f.check((shape["eyebrow"] or "").strip() in ("Quarter-final", "Last 8"),
                "cup %s: the pane names its round" % at, json.dumps(shape["eyebrow"]))
        # THE DRAFT ORDER DOES NOT EXIST UNTIL THERE IS ONE. Publishing a provisional order
        # mid-cup would be the seed in its most expensive form -- a draft pick decided by a
        # shuffle. The tab is absent rather than present and empty.
        f.check("Draft" not in shape["tabs"],
                "draft %s: there is no draft order until the cup has one" % at,
                json.dumps(shape["tabs"]))
        # ---- THE POSTER IS THE FINAL'S ALONE. The 2026-08-04 cancellation was a
        # full-viewport wipe on EVERY fixture -- "looks like a glitch" -- so the thing that
        # must never come back is this treatment appearing on an ordinary tie. Checked in the
        # quarter-final, where it must be absent; the champion drive checks the final itself.
        f.check(pg.evaluate("() => document.querySelectorAll('.tvPoster').length") == 0,
                "poster %s: no poster on a quarter-final" % at)
        f.check(pg.evaluate("() => document.querySelectorAll('.tvEyebrowGold').length") == 0,
                "poster %s: no gold on a quarter-final" % at)

        # ---- THE FIELD FOLLOWS THE ROSTER, AND NOBODY IS ASKED. Jayden: "it shouldn't
        # be like you pick 8 or 12 it should just be like based on how many heads you have
        # built like before 8 it would be 8 more than 8 it would be 12." The 8/12 control is
        # deleted, so the first assertion is that it is not there.
        f.check(pg.evaluate("() => document.querySelectorAll('.tvOptG').length") == 0,
                "field %s: the 8/12 control is gone -- the roster answers the question" % at)

        # THE BOUNDARY IS PINNED DIRECTLY, not through the roster, and that is deliberate:
        # play-engine.js:11 and play-games.js:49 both slice hmCompanions to 8 AND write the
        # truncated list back, so a live roster can never report 9 today and an assertion
        # routed through it would silently test nothing. Testing the rule itself means this
        # keeps working -- and keeps being checked -- on the day that cap is raised.
        rule = pg.evaluate("""() => { const g = window.__hmTourField; if (!g) return null;
          return {a: g(0), b: g(1), c: g(8), d: g(9), e: g(12), f: g(20)}; }""")
        f.check(rule is not None, "field %s: the field rule is a conditional global" % at)
        if rule:
            f.check(rule["c"] == 8 and rule["d"] == 12,
                    "field %s: 8 heads -> 8, 9 heads -> 12 (the boundary Jayden named)" % at,
                    json.dumps(rule))
            f.check(rule["a"] == 8 and rule["b"] == 8,
                    "field %s: an empty or tiny roster still gets a real cup" % at,
                    json.dumps(rule))
            f.check(rule["e"] == 12 and rule["f"] == 12,
                    "field %s: above the boundary it stays 12" % at, json.dumps(rule))

        # ---- AND THE SCREEN SAYS HOW THE FIELD WAS MADE. With seven built heads the cup is
        # eight, so one captain is not the visitor's -- and a cup that silently presents a
        # stranger as your roster is the quiet lie this screen has been cleaned of twice.
        legend = pg.evaluate("""() => {
          const e = document.querySelector('.tvHead .tvOptL');
          return {text: e ? e.textContent : null,
                  roster: (window.__hmTour && window.__hmTour.roster) || null}; }""")
        f.check(legend["text"], "field %s: the match-up says how the field was made" % at,
                json.dumps(legend))
        if legend["text"] and legend["roster"]:
            r = legend["roster"]
            f.check(r["mine"] + r["house"] + r["eggs"] == r["field"],
                    "field %s: the roster tally accounts for every captain" % at,
                    json.dumps(legend))
            f.check(str(r["mine"]) in legend["text"],
                    "field %s: the legend names how many are the visitor's own" % at,
                    json.dumps(legend))

        # ---- HOW LONG THE MATCH IS, SAID BEFORE IT STARTS. Jayden: "make that clear."
        # AND IT IS CHECKED AGAINST THE ENGINE, not against a copy of the engine's number.
        # play-engine.js owns the curve (first to 5 at the final, 4 one round out, 3
        # elsewhere) and this lane mirrors the expression; a mirror that nobody watches is a
        # number waiting to drift. So: read the label, start the match, read the scoreboard's
        # own .sbRule, and require them to agree.
        length = pg.evaluate("""async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          const tape = document.querySelector('.tvTape');
          const said = tape ? (tape.textContent.match(/First to (\\d+)/) || [])[1] : null;
          const go = document.querySelector('.tvGo');
          if (!go) return {said: said, why: 'no Kick off'};
          go.click();
          await sleep(900);
          const el = document.querySelector('.hmScore .sbRule');
          const shown = el ? (el.textContent.match(/First to (\\d+)/) || [])[1] : null;
          return {said: said, shown: shown, board: !!el}; }""")
        f.check(length.get("said"),
                "length %s: the match-up says how long the match is" % at, json.dumps(length))
        f.check(length.get("shown") and length["said"] == length["shown"],
                "length %s: it agrees with the scoreboard the engine paints" % at,
                json.dumps(length))
        # hand the pitch back, or .tvScreen stays display:none for everything after this
        pg.evaluate("() => { try{ window.__hmTourAbort && window.__hmTourAbort(); }catch(_){}"
                    "  try{ window.__hmSoccerEnd && window.__hmSoccerEnd(); }catch(_){} }")
        pg.wait_for_timeout(700)

        # ---- THE PANEL, which is the thing this screen did not have. Every element on
        # it used to be ink floating on the page: measured at 390, elementsFromPoint at
        # the centre of Kick off returned tvGo -> tvFixture -> pCard -> pCards -> hero,
        # so the primary action was painted on a Play-hub card. That is the defect three
        # passes of spacing work could not fix, and these are the assertions that say it
        # cannot come back.
        panel = pg.evaluate("""() => {
          const pn = document.querySelector('.tvPanel');
          if (!pn) return {why: 'no panel'};
          const b = pn.getBoundingClientRect(), cs = getComputedStyle(pn);
          const go = document.querySelector('.tvGo');
          const gb = go ? go.getBoundingClientRect() : null;
          const under = gb ? document.elementsFromPoint(gb.x + gb.width / 2, gb.y + gb.height / 2)
                              .map(e => (e.className.baseVal ?? e.className) || e.tagName) : [];
          return {ground: cs.backgroundColor, shadow: cs.boxShadow,
                  radius: cs.borderRadius, onSurface: pn.classList.contains('surface'),
                  centred: +((b.left) - (innerWidth - b.right)).toFixed(1),
                  under: under.slice(0, 6),
                  goRightInset: gb ? +(b.right - gb.right).toFixed(1) : null,
                  padRight: parseFloat(cs.paddingRight)}; }""")
        f.check(panel.get("onSurface"),
                "panel %s: the screen is one .surface from the shared library" % at,
                json.dumps(panel)[:200])
        f.check(panel.get("ground") not in (None, "rgba(0, 0, 0, 0)"),
                "panel %s: it has a ground, so nothing behind it reads through" % at,
                json.dumps(panel.get("ground")))
        # The hub card must no longer be under the primary action.
        f.check("pCard" not in " ".join(panel.get("under", [])),
                "panel %s: no Play-hub card is painted under Kick off" % at,
                json.dumps(panel.get("under")))
        # NO CAST SHADOW. The heads cast contact shadows because they stand on
        # something; chrome separates with a hairline and translucency. `.surface`'s
        # rim is an INSET hairline, which is what the rule asks for -- so this looks
        # for an OUTSET layer rather than for any box-shadow at all.
        cast = [x for x in str(panel.get("shadow", "none")).split("), ")
                if x.strip() and "inset" not in x]
        f.check(str(panel.get("shadow")) == "none" or not cast,
                "panel %s: the panel casts no shadow, it has a hairline" % at,
                json.dumps(panel.get("shadow")))
        _c = panel.get("centred")
        f.check(_c is not None and abs(_c) <= 0.5,
                "panel %s: the panel is centred in the window" % at,
                json.dumps(panel.get("centred")))
        # ---- AND THE BUTTON IS CENTRED BY CONSTRUCTION. Jayden: "The button isn't
        # even centred." It was `justify-self:start` on the second track of a two-track
        # grid, so at 390 it had 91.7px of inset on the left and 24 on the right. It now
        # fills the panel's row, so its right edge is exactly the panel's own padding --
        # which is a thing that can be asserted, unlike "it looks centred".
        f.check(panel.get("goRightInset") is not None
                and abs(panel["goRightInset"] - panel["padRight"]) <= 0.5,
                "panel %s: the primary reaches the panel's own padding on the right" % at,
                json.dumps(panel))

        # ---- NOTHING CROSSES THE GROUND LINE. .tvScreen is height-banded so that
        # 58svh -> 100svh (62svh on a phone) belongs to the world and the heads. It
        # is structural rather than a promise, but only for elements that FIT: content
        # taller than its band overflows downward and draws over the pitch, which is
        # what twelve table rows did to the champion screen at 390 and what the pane
        # switch did to Kick off at 320. Both were silent.
        ground = pg.evaluate("""() => {
          const s = document.querySelector('.tvScreen');
          if (!s) return null;
          const b = s.getBoundingClientRect();
          const over = [...s.querySelectorAll('*')].filter(e => {
            const q = e.getBoundingClientRect();
            return q.height > 0.5 && q.bottom > b.bottom + 0.5; })
            .map(e => e.className + '@' + e.getBoundingClientRect().bottom.toFixed(1));
          return {bottom: +b.bottom.toFixed(1), over: over.slice(0, 6),
                  docScroll: document.documentElement.scrollHeight > innerHeight + 1}; }""")
        f.check(ground and not ground["over"],
                "cup %s: nothing on the screen crosses the ground line" % at,
                json.dumps(ground))
        f.check(ground and not ground["docScroll"],
                "cup %s: the page does not scroll while a cup is up" % at,
                json.dumps(ground))

        # ---- THE CASCADE, which is where an earlier pass nearly shipped a regression.
        # controls.css is linked after play.html's <style> block and after
        # tournament.css, so a page rule of EQUAL specificity loses to the library on
        # source order and loses SILENTLY -- the rule reads correctly and the CSSOM
        # holds it. Four overrides were lost that way and one of them squeezed every
        # head to half its tile. Computed values, not source text, because source text
        # was what looked fine.
        cascade = pg.evaluate("""() => {
          const g = (sel, prop) => { const e = document.querySelector(sel);
            return e ? getComputedStyle(e)[prop] : null; };
          return {chipPad: g('.teamChip', 'paddingInline'),
                  chipGround: g('.teamChip', 'backgroundColor'),
                  goPad: g('.pBtnGo', 'paddingInline'),
                  backPad: g('.pBtnBack', 'paddingLeft'),
                  tabSize: g('.tvTab', 'fontSize'),
                  goFlex: g('.tvGo', 'flexGrow')};
        }""")
        f.check(cascade["chipPad"] == "0px",
                "cascade %s: the chip's own padding beats the library's" % at,
                json.dumps(cascade))
        f.check(cascade["chipGround"] not in (None, "rgba(0, 0, 0, 0)"),
                "cascade %s: the chip keeps its --c100 ground" % at, json.dumps(cascade))
        f.check(cascade["goPad"] == "32px",
                "cascade %s: Start match keeps its --sp-32 padding" % at, json.dumps(cascade))
        # `.ctl--tab` declares `font-size:inherit`, so a tab takes the size of the row
        # it is in -- and this row inherits <body>'s 16px unless the row names the
        # control rung. Measured before it did, the tabs were the largest text on the
        # panel after the names. This is the assertion that keeps every control on this
        # screen at one size.
        f.check(cascade["tabSize"] == "15px",
                "cascade %s: the tabs take the control rung, not the body's 16px" % at,
                json.dumps(cascade))
        f.check(cascade["goFlex"] not in (None, "0"),
                "cascade %s: the primary still fills its row" % at, json.dumps(cascade))

        # ---- the Archivo exception ----
        # ON A ROUND PANE, because .bcNum rides the SCORE cell and an unplayed tie
        # prints nothing -- that empty column is the intended "not yet". Counting it on
        # the match-up, which has no scores at all, measured zero and read exactly like
        # the numeral having been deleted.
        pg.evaluate("() => { const t = document.querySelectorAll('.tvTab');"
                    "  if (t[1]) t[1].click(); }")
        pg.wait_for_timeout(300)
        a = pg.evaluate(ARCHIVO)
        f.check(a["count"] > 0, "Archivo: .bcNum exists while a cup is running",
                json.dumps({"nodes": a["count"]}))
        f.check(len(a["decls"]) == 1, "Archivo: exactly one declaration site",
                json.dumps(a["decls"]))
        if a["decls"]:
            d = a["decls"][0]
            f.check(d["href"] == "play.css", "Archivo: it lives in play.css", json.dumps(d))
            f.check(d["sel"] == ".bcNum", "Archivo: the selector is .bcNum", json.dumps(d))
        f.check(any(fa["weight"] and "900" in fa["weight"] for fa in a["faces"]),
                "Archivo: the face declares a real weight axis, so 800 is not a synthesis",
                json.dumps(a["faces"]))

        # ---- THE CHAMPION SCREEN, at the size that broke it.
        # It is the payoff of the whole cup and it arrived clipped: at 320x568 the
        # head was a sliver of chin and the crown -- which sits ABOVE the head's own
        # box, at top:-8% -- was gone entirely. The second failure here was that the
        # ending silently described fewer competitors than entered, which
        # `column-fill:auto` did to the final table. The knockout has no table, so
        # that assertion is now made against the BOARD: walk every round pane and the
        # names on it must account for the whole field.
        if (w, h) == (320, 568):
            champ = pg.evaluate(CHAMPION_DRIVE)
            f.check(champ.get("name"), "champion %s: the cup produces a champion" % at,
                    json.dumps(champ)[:200])
            f.check(not champ.get("why"),
                    "champion %s: the champion screen actually paints" % at,
                    champ.get("why", ""))
            # ---- THE FINAL'S OWN TREATMENT, recorded on the way past. Jayden wants "that
            # finals poster design implemented into the UI of the final matchup"; the trap is
            # the cancelled wipe growing back, so this asserts the treatment EXISTS and that
            # it does not move.
            fin = champ.get("final") or {}
            f.check(fin.get("gold"), "final %s: the final's round name wears the cup's gold"
                    % at, json.dumps(fin))
            f.check(fin.get("goldBall"),
                    "final %s: hmFinal is set, so the ball is gold too" % at, json.dumps(fin))
            f.check(fin.get("length") == "5",
                    "final %s: the final says it is first to 5" % at, json.dumps(fin))
            # NOT ANIMATED. The poster is a still picture in a card. A transition or an
            # animation on it is the 2026-08-04 wipe growing back, and it is checked rather
            # than promised. (At 320 the poster itself is dropped for room -- see
            # tournament.css -- so its presence is asserted only where it is meant to be.)
            f.check(fin.get("posterAnimated") in (False, None),
                    "final %s: the poster does not move -- the wipe stays cancelled" % at,
                    json.dumps(fin))
            if champ.get("name") and not champ.get("why"):
                f.check(not champ["headClipped"],
                        "champion %s: the winner's head is whole" % at, json.dumps(champ))
                f.check(not champ["crownClipped"],
                        "champion %s: the crown is inside the clip" % at, json.dumps(champ))
                f.check(champ["named"] == champ["season"]["teams"],
                        "champion %s: all %d heads are named on the finished board"
                        % (at, champ["season"]["teams"]), json.dumps(champ))
                f.check(champ["standings"] == champ["season"]["teams"],
                        "champion %s: the standings account for every head" % at,
                        json.dumps(champ))
                # ---- THE DRAFT ORDER, which is what the whole tournament is for. Jayden:
                # "after the cup finishes can see clear number order to make sure everyone
                # knows the draft order at the end". It must be 1..N with NO GAPS -- a draft
                # needs a number for every head, not a list of survivors -- it must only
                # exist once the cup is finished, and it must not interrupt the champion
                # (the ending still opens on the champion, not on the draft).
                draft = pg.evaluate("""async () => {
                  const sleep = ms => new Promise(r => setTimeout(r, ms));
                  const opened = document.querySelector('.tvTab[aria-selected="true"]');
                  const openedOn = opened ? opened.textContent : null;
                  const t = [...document.querySelectorAll('.tvTab')]
                              .find(e => e.textContent.trim() === 'Draft');
                  if (!t) return {why: 'no Draft tab', openedOn: openedOn};
                  t.click(); await sleep(300);
                  const rows = [...document.querySelectorAll('.tvDraftRow')];
                  return {openedOn: openedOn,
                          n: rows.length,
                          numbers: rows.map(r => (r.querySelector('.tvDraftN')||{}).textContent),
                          wheres: rows.map(r => (r.querySelector('.tvDraftOut')||{}).textContent),
                          drawn: rows.filter(r => r.classList.contains('tvDrawn')).length,
                          drawnMarked: rows.filter(r => r.classList.contains('tvDrawn'))
                                         .filter(r => {const t=r.getAttribute('title');
                                                       return !!t && t.trim().length>12;}).length,
                        key: !!document.querySelector('.tvDraftKey')}; }""")
                f.check(not draft.get("why"),
                        "draft %s: the finished cup grows a Draft tab" % at,
                        draft.get("why", ""))
                f.check(draft.get("openedOn") == "Cup",
                        "draft %s: the ending still opens on the champion, not the draft" % at,
                        json.dumps(draft.get("openedOn")))
                if not draft.get("why"):
                    want = [str(i + 1) for i in range(champ["season"]["teams"])]
                    f.check(draft["numbers"] == want,
                            "draft %s: it is 1..%d with no gaps"
                            % (at, champ["season"]["teams"]), json.dumps(draft)[:220])
                    # EVERY POSITION SAYS WHERE IT CAME FROM. A number with no account of
                    # itself is the seed again, in the one place it would cost somebody a
                    # draft pick.
                    f.check(all(w for w in draft["wheres"]),
                            "draft %s: every row says which round it went out in" % at,
                            json.dumps(draft["wheres"]))
                    # ...and where it came from nothing. If any row is separated from the one
                    # above it only by the draw, the key has to be printed.
                    # THE ROW EXPLAINS ITSELF; THERE IS NO LEGEND TO CHECK.
                    # WHERE THE ACCOUNT LIVES MOVED AGAIN, 2026-09-04. 14a9346
                    # ("The draft order stops labelling positions it did not have
                    # to explain") deleted the .tvDraftTie span and its CSS
                    # outright and moved the explanation onto the row's title.
                    # The span exists nowhere in the tree now, so this check was
                    # asserting a decision that had been reversed, and had been
                    # failing at 320x568 ever since: drawn 4, marked 0.
                    # THE ASSERTION IS UNCHANGED -- every row separated by the
                    # draw must still account for itself -- only WHERE it looks
                    # for that account moved, from a visible span to the title.
                    # It still fails if a drawn row carries no explanation at
                    # all, which is the defect actually worth catching.
                    # 2026-08-27. This was `drawn == 0 or key`: a row separated
                    # by the draw had to be accompanied by a key line under the
                    # table, because the row's own marker was a bare "·" that
                    # means nothing on sight. Jayden called that pairing
                    # clutter, and it was also costing the pane the room it
                    # needed -- play-tournament.js records the twelve-row
                    # over-run and his screenshot showed DRAFT ORDER printing
                    # over row 1 because of it.
                    # The dot is a WORD now, "Draw" or "Race", so the account
                    # is in the row and needs no legend.
                    # STRICTLY STRONGER, NOT RELAXED: the old check accepted one
                    # key line for the whole table; this requires EVERY drawn
                    # row to carry its own. It fails if the marker reverts to a
                    # bare symbol.
                    f.check(draft["drawn"] == draft["drawnMarked"],
                            "draft %s: every row split by the draw says so in the row" % at,
                            json.dumps(draft))

        pg.evaluate("() => window.__hmTourStop()")
        pg.wait_for_timeout(500)
        screen_bc = pg.evaluate(
            "() => document.querySelectorAll('.tvScreen .bcNum').length")
        f.check(screen_bc == 0,
                "Archivo %s: the tournament screen's numerals leave with the cup" % at,
                "%d node(s) survived" % screen_bc)

        pg.context.close()
    return tally


def self_test(base, browser):
    """Re-inject each defect and require the detector to fire."""
    print("SELF-TEST -- each injection must produce failures\n")
    ok = True

    print("  [1] take both screens back off the shared library")
    f = Findings(verbose=False)
    run(base, browser, f, strip_ctl=True)
    caught = [r for r in f.failures if "shared library" in r[1]]
    print("      %d adoption failure(s) raised" % len(caught))
    ok = ok and bool(caught)

    print("  [2] restore the 56px fixed chip that stacked the panel to 94% of a 320 screen")
    f2 = Findings(verbose=False)
    run(base, browser, f2, sabotage="""
      @media(max-width:760px){
        .pTeamChips{display:flex!important;flex-wrap:wrap!important}
        .teamChip,.teamUndo{width:56px!important;height:66px!important;aspect-ratio:auto!important}
      }""")
    caught2 = [r for r in f2.failures if "stage room" in r[1]]
    print("      %d panel-height failure(s) raised" % len(caught2))
    ok = ok and bool(caught2)

    print("  [3] restore the 44px action bar that ran off the right edge at 320")
    f3 = Findings(verbose=False)
    run(base, browser, f3, sabotage="""
      .pTeamBar .ctl{min-height:44px!important;padding-inline:16px!important;
                     font-size:15px!important;font-weight:600!important}""")
    caught3 = [r for r in f3.failures if "fits inside its own panel" in r[1]]
    print("      %d overflow failure(s) raised" % len(caught3))
    ok = ok and bool(caught3)

    print("  [5] let the library win the cascade again -- the chip's padding")
    f5 = Findings(verbose=False)
    run(base, browser, f5, sabotage=".teamChip.ctl{padding-inline:16px}")
    caught5 = [r for r in f5.failures if "chip's own padding" in r[1]]
    print("      %d cascade failure(s) raised" % len(caught5))
    ok = ok and bool(caught5)

    print("  [6] take the panel's ground away -- the defect the whole rewrite is for")
    f6 = Findings(verbose=False)
    # THE ORIGINAL DEFECT, RE-INJECTED. `.tvScreen` was a transparent layer and every
    # element on it was ink floating on the page: measured at 390, the Play-hub card
    # was painted directly under the Kick off button. Making the panel transparent
    # again reproduces exactly that, and both detectors -- the ground check and the
    # elementsFromPoint check -- have to fire.
    run(base, browser, f6, sabotage=".tvPanel{background:transparent!important}")
    caught6 = [r for r in f6.failures
               if "it has a ground" in r[1] or "Play-hub card is painted" in r[1]]
    print("      %d panel-ground failure(s) raised" % len(caught6))
    ok = ok and bool(caught6)

    print("  [7] put the primary back on the old two-track grid, off-centre at 390")
    f7 = Findings(verbose=False)
    # Jayden: "The button isn't even centred." The shipped defect was
    # `justify-self:start` inside a grid whose first track was the captains' faces,
    # so the button began 91.7px in on the left and 24 in on the right. Stopping the
    # primary from filling its row reproduces the asymmetry.
    run(base, browser, f7, sabotage=".tvGo{flex:0 0 auto!important}")
    caught7 = [r for r in f7.failures if "reaches the panel's own padding" in r[1]
               or "still fills its row" in r[1]]
    print("      %d off-centre failure(s) raised" % len(caught7))
    ok = ok and bool(caught7)

    print("  [8] rebuild the cup as a league -- the format revert, asserted")
    f8 = Findings(verbose=False)
    # The format is the thing that was reverted, so the gate has to fail when it
    # comes back. There is no stylesheet that can do this, so it is injected at the
    # source: a league of the same field has more fixtures than N-1, which is the
    # identity that DEFINES single elimination.
    run(base, browser, f8, tamper="""() => {
      const real = window.__hmTourCup;
      window.__hmTourCup = function(){ const c = real(); if (!c) return c;
        c.fixtures = c.teams * 3 / 2;              // three matchdays, a league
        c.rounds = [{label:'Matchday 1', short:'MD1', teams:c.teams, playIn:false,
                     matches:c.teams/2}];
        return c; }; }""")
    caught8 = [r for r in f8.failures if "single elimination" in r[1]]
    print("      %d format failure(s) raised" % len(caught8))
    ok = ok and bool(caught8)

    print("  [4] give .bcNum a second declaration site")
    f4 = Findings(verbose=False)
    run(base, browser, f4, sabotage=".tvFxS{font-family:'Archivo',sans-serif;font-weight:800}")
    caught4 = [r for r in f4.failures if "one declaration site" in r[1]]
    print("      %d Archivo failure(s) raised" % len(caught4))
    ok = ok and bool(caught4)

    print()
    print("SELF-TEST %s" % ("PASS  every injected defect was caught" if ok
                            else "FAIL  an injected defect went unnoticed -- do not trust this gate"))
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    handler = partial(QuietHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    Thread(target=server.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % server.server_port

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=["--force-color-profile=srgb"])
            try:
                if args.self_test:
                    return 0 if self_test(base, browser) else 1
                f = Findings(args.verbose)
                tally = run(base, browser, f)
                print()
                for k in sorted(tally):
                    on, total = tally[k]
                    print("%-28s %d/%d controls on the shared library = %.1f%%"
                          % (k, on, total, 100.0 * on / max(1, total)))
                print()
                if f.failures:
                    print("STATUS=FAIL  (%d finding%s)"
                          % (len(f.failures), "" if len(f.failures) == 1 else "s"))
                    return 1
                print("STATUS=PASS  both screens are on the system, on every size, "
                      "and nothing scrolls that should not.")
                return 0
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    sys.exit(main())
