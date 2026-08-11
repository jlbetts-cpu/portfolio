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


# Drive a whole cup, through the UI, the way a visitor does.
#
# IT IS SLOW ON PURPOSE -- about fifty seconds -- and the obvious shortcut does
# not work. Recording the first six winners straight through the bracket core
# leaves T.cur pointing at fixture zero while the board has moved on, so the
# next Kick off re-records a decided match and throws "match already final";
# and propagate() re-derives every round after the one you touch, so seeding the
# later rounds first is not safe either. paint() is internal and __hmTourWin is
# the only thing that calls it, so the honest path is the only path.
#
# THE DELAYS ARE NOT PADDING. The celebration holds the screen for 5,600ms after
# every fixture and 10,500ms after the final, before the next screen is painted.
# Sampling early is one of the two things that make a working bracket look stuck
# -- the other is a missing __hmSoccerEnd -- and both have cost this project time.
CHAMPION_DRIVE = r"""
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 10; i++) {
    if (document.querySelector('.tvChampNm')) break;
    const go = document.querySelector('.tvGo');
    if (!go) return {name: null, why: 'no Kick off at fixture ' + i};
    go.click();
    await sleep(700);
    if (!window.__hmTourWin) return {name: null, why: 'no __hmTourWin'};
    const isFinal = document.body.classList.contains('hmFinal');
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
    await sleep(isFinal ? 11200 : 6100);
  }

  const wrap = document.querySelector('.tvChampWrap');
  const head = document.querySelector('.tvChampHead');
  const crown = document.querySelector('.tvCrown');
  const grid = document.querySelector('.tvStandGrid');
  const nm = document.querySelector('.tvChampNm');
  if (!wrap || !head || !grid) return {name: nm ? nm.textContent : null, why: 'champion did not paint'};
  const wb = wrap.getBoundingClientRect(), gb = grid.getBoundingClientRect();
  // A ZERO-SIZE SCREEN MUST NOT READ AS "NOT CLIPPED". body.hmSoccer sets
  // .tvScreen to display:none, and __hmTourWin can leave it set when the engine's
  // own __hmSoccerEnd has not run -- one of the two documented traps here. Every
  // rect is then 0, `head.top < wrap.top - 0.5` is 0 < -0.5, and the clipping
  // assertions all pass on a screen nobody can see. This gate did exactly that
  // once, and reported green on a champion who was visibly a chin.
  if (wb.height < 1 || gb.width < 1)
    return {name: nm ? nm.textContent : null,
            why: 'the champion screen has no box -- body.className is "'
                 + document.body.className + '"'};
  const rows = Array.from(document.querySelectorAll('.tvStandRow'));
  // A row is hidden if it falls outside its own clipping grid OR off the screen.
  const hidden = rows.filter(r => { const q = r.getBoundingClientRect();
    return q.right > gb.right + 0.5 || q.bottom > gb.bottom + 0.5
        || q.right > innerWidth + 0.5 || q.bottom > innerHeight + 0.5; });
  return {name: nm ? nm.textContent : null,
          headClipped: head.getBoundingClientRect().top < wb.top - 0.5,
          crownClipped: !!crown && crown.getBoundingClientRect().top < wb.top - 0.5,
          rows: rows.length, rowsHidden: hidden.length,
          standRows: getComputedStyle(grid).gridTemplateRows};
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


def open_page(browser, base, w, h, sabotage=None):
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


def run(base, browser, f, sabotage=None, strip_ctl=False):
    """Every assertion, at every size. Returns the adoption tally for the report."""
    tally = {}
    for (w, h) in SIZES:
        pg = open_page(browser, base, w, h, sabotage)
        if strip_ctl:
            # The self-test's first injection: take the two screens back off the
            # shared library exactly the way they were before this pass.
            pg.evaluate("""() => { const strip = () => document.querySelectorAll(
              '.pBtn, .teamChip, .teamDel, .teamUndo, .tvChip, .tvGo').forEach(
              e => e.classList.remove('ctl','ctl--primary','ctl--secondary','ctl--sm'));
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
        strip = pg.evaluate("""() => { const l = document.querySelector('.tvRound');
          if (!l) return null;
          return {text: l.textContent, clipped: l.scrollWidth > l.clientWidth + 1}; }""")
        f.check(strip and not strip["clipped"],
                "tournament %s: the round name is not truncated" % at,
                json.dumps(strip))

        # Eight teams, three rounds, zero byes -- and the labels derived from the
        # field rather than hardcoded.
        shape = pg.evaluate("""() => { const t = window.__hmTourStandings();
          const heads = document.querySelectorAll('.tvRdH, .tvSheetBoard .tvRdH');
          return {teams: t.length, rounds: new Set([...document.querySelectorAll('.tvRd')]
            .map(e => e.querySelector('.tvRdH') && e.querySelector('.tvRdH').textContent)).size}; }""")
        f.check(shape["teams"] == 8, "tournament %s: the field is eight" % at, json.dumps(shape))
        if w > 760:
            f.check(shape["rounds"] == 3, "tournament %s: three rounds, no ghost round" % at,
                    json.dumps(shape))

        # ---- THE CASCADE, which is where this pass nearly shipped a regression.
        # controls.css is linked after play.html's <style> block and after
        # tournament.css, so a page rule of EQUAL specificity loses to the
        # library on source order and loses silently -- the rule reads correctly
        # and the CSSOM holds it. Four overrides were lost that way and one of
        # them (the chip's padding) squeezed every head to half its tile.
        # Computed values, not source text, because source text was what looked
        # fine.
        cascade = pg.evaluate("""() => {
          const g = (sel, prop) => { const e = document.querySelector(sel);
            return e ? getComputedStyle(e)[prop] : null; };
          return {chipPad: g('.teamChip', 'paddingInline'),
                  chipGround: g('.teamChip', 'backgroundColor'),
                  goPad: g('.pBtnGo', 'paddingInline'),
                  backPad: g('.pBtnBack', 'paddingLeft'),
                  drawDisplay: g('.tvChipDraw', 'display')};
        }""")
        f.check(cascade["chipPad"] == "0px",
                "cascade %s: the chip's own padding beats the library's" % at,
                json.dumps(cascade))
        f.check(cascade["chipGround"] not in (None, "rgba(0, 0, 0, 0)"),
                "cascade %s: the chip keeps its --c100 ground" % at, json.dumps(cascade))
        f.check(cascade["goPad"] == "32px",
                "cascade %s: Start match keeps its --sp-32 padding" % at, json.dumps(cascade))
        # The draw button exists for the phone only: above 760 the rail already
        # shows all three rounds, so a button opening a copy of what is on screen
        # is one of the unnecessary elements this screen was rebuilt to remove.
        want = "none" if w > 760 else "flex"
        f.check(cascade["drawDisplay"] == want,
                "cascade %s: the draw chip is %s here" % (at, "hidden" if w > 760 else "shown"),
                json.dumps(cascade))

        # ---- the Archivo exception ----
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
        # It is the payoff of seven fixtures and it arrived clipped: at 320x568
        # the head was a sliver of chin, the crown -- which sits ABOVE the head's
        # own box, at top:-8% -- was gone entirely, and `column-fill:auto` in a
        # 111px band pushed ranks 5 to 8 into a third and fourth column and
        # straight into overflow:hidden. Half the final table, silently missing.
        if (w, h) == (320, 568):
            champ = pg.evaluate(CHAMPION_DRIVE)
            f.check(champ.get("name"), "champion %s: the cup produces a champion" % at,
                    json.dumps(champ)[:200])
            f.check(not champ.get("why"),
                    "champion %s: the champion screen actually paints" % at,
                    champ.get("why", ""))
            if champ.get("name") and not champ.get("why"):
                f.check(not champ["headClipped"],
                        "champion %s: the winner's head is whole" % at, json.dumps(champ))
                f.check(not champ["crownClipped"],
                        "champion %s: the crown is inside the clip" % at, json.dumps(champ))
                f.check(champ["rowsHidden"] == 0,
                        "champion %s: every team is in the final table (%d rows)"
                        % (at, champ["rows"]), json.dumps(champ))
                f.check(champ["rows"] == 8,
                        "champion %s: eight teams finish the cup" % at, json.dumps(champ))

        pg.evaluate("() => window.__hmTourStop()")
        pg.wait_for_timeout(500)
        screen_bc = pg.evaluate(
            "() => document.querySelectorAll('.tvScreen .bcNum, #tvSheet .bcNum').length")
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

    print("  [6] restore column-fill:auto, which dropped half the final table at 320")
    f6 = Findings(verbose=False)
    # THE WHOLE SHIPPED MECHANISM, not just the display mode. Re-injecting
    # column-fill alone no longer reproduced the bug, because the 640-and-under
    # block now buys the table 26px of heading and 9px a row -- so eight short
    # rows fit two columns even under the old algorithm, and the detector went
    # quiet on a defect that had genuinely been fixed twice over. An injection
    # that no longer reproduces its defect is a passing self-test that proves
    # nothing. This restores the band split and the row height with it.
    run(base, browser, f6, sabotage="""
      .tvBody.tvDone{grid-template-rows:minmax(0,1fr) minmax(0,1.15fr)!important}
      .tvBody.tvDone .tvBoardHd{display:block!important}
      .tvStandRow{min-height:29px!important}
      .tvStandGrid{display:block!important;column-count:2;column-fill:auto;overflow:hidden}""")
    caught6 = [r for r in f6.failures if "every team is in the final table" in r[1]]
    print("      %d standings failure(s) raised" % len(caught6))
    ok = ok and bool(caught6)

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
