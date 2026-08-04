# Geometry audit — is the math actually consistent?

**Measured:** 2026-08-04 04:59 → 05:21 UTC
**Branch:** `broadcast-match`
**HEAD at start:** `97023d50ca1ef0567fb5c8a446c427fac65cb865`
**HEAD at finish:** `cba2eb83fc1ce31f69fc2a9601f1afff4d50da1f`
**Working tree was dirty throughout** — five other agents were writing. Section 8 records exactly what
moved under the measurement and which numbers were re-taken afterwards.

Read-only audit. Nothing in this repo was changed except this file.

---

## 1. The thirty-second summary

| # | Finding | Page(s) | Measured | Expected | Class |
|---|---|---|---|---|---|
| 1 | Range sliders are **2px** tall; real grab band **14px** | gradientlab | 14px | 44px | **BROKEN** |
| 2 | Chapter-rail links **89.6 × 14** | 5 case studies | 14px tall | 44px | **BROKEN** |
| 3 | 39 of 45 controls under 44px at 1280 (0 of 45 at 390) | gradientlab | 39 fail | 0 | **BROKEN** |
| 4 | Odd padding `7 / 9 / 11px` — 58 occurrences | gradientlab | off 2px grid | token | off-system |
| 5 | Case-study section joins take 5 different rungs | 5 case studies | 36/48/52/64/64 | one rung | off-system |
| 6 | `p+p` gap floors at **34px** | about | 34px | 32 or 36 | off-system |
| 7 | Same "section gap" capped 144 on one block, **150** on another | index, about | 144 vs 150 | one value | off-system |
| 8 | Tabs **42.5px** tall on mobile | index | 42.5px | 44px | off-system |
| 9 | `.sbBtn` **42 × 42** | apollo | 42px | 44px | off-system |
| 10 | `.mhX` close button **24px** tall | play | 24px | 44px | off-system |
| 11 | Mobile head-size formula's height term is dead code | index | width-bound | height-bound | off-system |

**Passes, measured not assumed:**

| Test | Result |
|---|---|
| Header acceptance (10 pages × 3 widths) | **30 / 30 pass** |
| Bar items on one vertical axis | spread **0.00px**, every page, both widths |
| Horizontal overflow at 320 (= 400% zoom reflow) | **0px on all 10 pages** |
| Hero head clears the fold at 700px | **yes, by 61.4px** |
| Values tracing to a token or the grid | 3,285 of 3,355 = **97.9%** |

**Off-system values: 70** across 10 pages × 3 widths. **59 of them (84%) are on `gradientlab.html`.**
Every other page in the site is between 0 and 6.

---

## 2. Method — so the numbers can be trusted

Three traps were live on this project. All three were defused before measuring.

1. **Headless Chrome clamps viewport width to a 500px minimum.** Every reading below was taken by
   rendering the page in an **iframe of the exact CSS width**, then asserting
   `iframe.contentWindow.innerWidth` equals the requested width. Verified: 1280 → 1280, 390 → **390**,
   320 → **320**. Not one reading was taken by resizing the window.

2. **Cache-busting a page URL does not bust its external CSS/JS.** All ten pages now load
   `tokens.css` + `header.css` externally; index and play add `hero-engine.js` / `play-engine.js`.
   Freshness was proven per load by comparing `decodedBodySize` from resource timing against the
   on-disk byte count: `header.css` 57,981 = 57,981 and `tokens.css` 22,393 = 22,393, with
   `transferSize > 0` (a real fetch, not a memory-cache hit).

3. **Port collision.** 4173 is bound by another session on a different git worktree. This audit ran its
   own server on **`127.0.0.1:4291`**, sole bind confirmed with `lsof -nP -iTCP:4291 -sTCP:LISTEN`,
   and was addressed by IP, never `localhost`.

Also handled:

- **A full 8-head roster was seeded** (`hmCompanions` + `hmCompanion`) with unique per-head geometry —
  `marks.BL/BR/M/N` and `eyes` carrying `x,y,w,h,ang,sc,ic` in 0–1 fractional units — over the real art
  from `window.__EGGHEAD`.
- **The `::after` tap expander was modelled, not guessed.** `header.css:393` sets
  `content:""; position:absolute; top:50%; left:0; right:0; height:var(--tap-min); transform:translateY(-50%)`,
  so a nav item's true target is *its own width × 44px, centred on its ink box*. The audit measures that
  expanded box. No nav item is reported as a failure — which is the correct result, and the reason the
  expander had to be modelled.
- **Hydration was waited on, not slept through.** An early pass measured `#h1` at height 0 because a
  fixed 2.4s settle fired before `buildHeadline()` had painted. Every reading below polls until the h1
  has real height *and* `#face.complete && naturalWidth > 0`. The zero-height numbers were discarded.
- **Auto margins and viewport units were excluded by experiment, not by eye.** Each candidate stray was
  re-probed at 1280×900, 1280×1200 and 1500×900. A value that changes with height is `vh`-derived; one
  that changes with width is an `auto` margin; only a value constant across all three is an authored
  literal. This removed 11 false positives, including `.playerStage{margin:0 auto}` reporting as a
  "180px stray".

---

## 3. BROKEN — a visitor is blocked or misled

### 3.1 gradientlab's sliders are 2px tall on desktop

`gradientlab.html:182` puts the fix inside the wrong media query:

```css
@media(max-width:880px){
  input[type=range]{height:44px;background:none;touch-action:pan-y}
}
```

The base rule is `appearance:none; flex:1; height:2px`. So the 44px target applies **only at ≤880px**.
At 1280 the element's computed height is `2px`.

Verified with `elementFromPoint`, sampling every 1px through the control's centre: the contiguous band
that actually hits `#nx` is **14px** — the 20px thumb overflows the 2px box and is partly hit-testable.
So the real grab area is 14px, not 2 and not 44.

- **Measured:** 14px tall grab band, 24 sliders
- **Expected:** 44px
- **What a visitor sees:** on a desktop — the primary way anyone uses a gradient lab — every slider must
  be hit inside a 14px band. The control looks 44px tall because the track is drawn with a big thumb;
  it is not. On a phone it works perfectly. The media query is inverted relative to where the page is used.

### 3.2 The chapter rail's links are 14px tall

`.chap{display:grid; grid-template-columns:28px minmax(0,1fr); align-items:center; height:14px}`
inside `.chapters{gap:16px}`.

- **Measured:** 89.6 × 14, five to six links per page, on all five case studies at 1280
- **Expected:** 44px minimum (Jayden's bar). WCAG 2.5.8 AA asks 24×24; this fails that too
- **Spacing:** 16px gap → 30px centre-to-centre, which clears 2.5.8's spacing exception but not the size floor
- **What a visitor sees:** the section jump-list on the left of every case study needs a 14px-tall
  landing. A miss scrolls nothing and reads as a dead link. Desktop only — `.rail{display:none}` on mobile,
  so this affects exactly the width where it is visible.

### 3.3 gradientlab fails 39 of 45 targets at 1280 — and 0 of 45 at 390

| Control | Count | Measured |
|---|---|---|
| `input[type=range]` | 24 | 14px real band |
| `input[type=color]` (`#c1`–`#c5`) | 5 | 30 × 30 |
| `select` (`#preset`, `#form`, `#shape`, `#scene`, `#nodeSel`, `#stageGround`) | 6 | 28.5 tall |
| `.miniBtn` / `.copy` / `.btn` | 4 | 23.5–38 tall |

The same page at 390 has **zero** failures. Every miss on this page is a desktop-only regression caused
by target sizing living under `@media(max-width:880px)` instead of in the base rule. This is one bug
with 39 symptoms, not 39 bugs.

---

## 4. Off-system — it works, but it is not on the system

### 4.1 Ranked stray values (authored, constant, neither a token nor on the grid)

The ladder the system implies: a **2px grid below 16px** (2,4,6,8,10,12,14) and a **4px grid at and
above 16** (16,20,24,28,32,36,40,…). 70 measured values sit outside it.

| Rank | Value | Occurrences | Pages | Property | Why it's off |
|---|---|---|---|---|---|
| 1 | **7px** | 48 | gradientlab | padding ×4 | odd — off the 2px sub-16 grid |
| 2 | **9px** | 10 | gradientlab | padding ×4 | odd |
| 3 | **34px** | 6 | about | `margin-top` | 34 % 4 = 2 |
| 4 | **74px** | 1 | gradientlab | `margin-top` | 74 % 4 = 2 |
| — | 76 / 92 / 132px | 5 | play, gradientlab | `padding-top` | **on grid and token-derived** via `calc(var(--nav-h) + var(--sp-24))` — counted, but these are fine |

Sources:

```css
/* gradientlab.html */
select        { padding:7px 8px;  min-height:44px }
.miniBtn      { padding:7px 11px; min-height:44px }
.copy         { padding:9px 12px; min-height:44px }
/* about.html */
p+p           { margin-top:clamp(34px,3vw,48px) }
.abSec        { margin-bottom:clamp(44px,5vw,72px) }
```

`7`, `9` and `11` are the single largest source of off-grid pixels in the site. Nearest rungs are
`--sp-6`/`--sp-8` and `--sp-10`/`--sp-12`.

`about.html`'s two body-rhythm clamps floor at **34** and **44**. 34 is on neither grid; 44 is on the 4px
grid but is `--tap-min`, a *target* token being used as a *spacing* value. Their ceilings (48, 72) are
both real rungs — so each clamp is half on the system.

**`header.css` contains zero off-grid literals.** The header is the most rigorous file in the repo and
it is worth saying so.

### 4.2 The vertical rhythm, per page

Measured gap sequences between successive blocks, top to bottom.

**`about.html` @1280 — on a ladder.**
`.abBody → 40, 64, 64, 64, 64`. One value repeated four times. This is what a system looks like.

**`apollo.html` @1280 — not on a ladder.** Per-section sequences:

```
#overview  43, 39.2, 52
#problem   51.2, 16, 16, 48
#research  51.2, 16, 16, 36
#system    51.2, 16, 16, 16, 16, 52
#north     51.2, 16
#adhd      51.2, 16, 16, 16, 64
#screens   51.2, 16, 64
#outcome   51.2, 16, 16
```

Two thirds of this is genuinely systematic and should be defended:
- **51.2px** opens every section — that is `--gap-head-top` (1.6em) against `--fs-h3` (32px). Seven
  sections, one number.
- **16px** is the intra-section rung, used 14 times.

The failure is the **section-closing gap** — the join between a section's last block and the next
section. It measures **36, 48, 52, 64, 64** at 1280 and **20, 28, 32, 40, 40** at 390. Four of those
five are legitimate tokens; the problem is that the *same structural join* is spaced with **four
different rungs** with nothing distinguishing the cases. That is the "24, 28, 36, 40, 54" signature —
values chosen individually rather than drawn from one ladder.

**Site-wide section gap.** `.cases` and `.siteFoot` both express the same idea and disagree at the top:

```css
.cases    { margin: clamp(80px,12vh,144px) auto 0 }
.siteFoot { margin-top: clamp(80px,12vh,150px) }     /* index.html AND about.html */
```

- `144` is `--sp-72-144`. **`150` is not a token and is off the 4px grid** (150/4 = 37.5). The nearest
  rung is `--sp-80-152` = 152.
- The two only diverge above ~1250px viewport height, so it rarely bites — but it is two caps for one idea.
- The `12vh` middle term is why the site's largest gap resolves to a different non-ladder number at every
  height: **101px at 844, 108px at 900, 144px at 1200.** The one gap a visitor sees most is the one gap
  not drawn from the ladder.

### 4.3 Targets between 24 and 44

| Element | Page | Measured | Short by |
|---|---|---|---|
| `button.csTab` | index @390 | 64.8 / 93.7 / 46.1 × **42.5** | 1.5px |
| `button.csTab` | index @1280 | × **30.5** | 13.5px |
| `.sbBtn` | apollo | **42 × 42** (44 tall after expander) | 2px wide |
| `.mhX` | play | 44 × **24** | 20px |
| `a.footIn` | apollo @390 | 49.3 × **41.5** | 2.5px |

`.csTab` at 390 is the near miss worth fixing first — `@media(max-width:768px){.csTab{padding-top:8px;padding-bottom:16px}}`
gives 8 + 18.5 + 16 = 42.5. Two more pixels of padding clears 44.

**Correctly exempt, not counted as failures:** `a.abIn` and `a.footIn` at 1280 are inline links inside
running prose (`display:inline`, inside a `<p>`), which WCAG 2.5.8 exempts. index.html already handles
this properly on mobile — `@media(max-width:768px){.footIn{display:inline-block;padding:12px 0;margin:-12px 0}}`
takes them to 50.3px tall without moving the text.

### 4.4 Page gutters disagree across pages

Left content edge, measured:

| Page | @1280 | @390 |
|---|---|---|
| index, about, case studies | **40** | **24** |
| gradientlab | **30** | **14** |
| play | 24 | 12 |

`--sp-40` exists precisely to name the 40px site gutter. gradientlab's 30/14 and play's 24/12 are the
two pages that do not use it. Both are tool pages, so this may be deliberate — but it is undeclared.

### 4.5 The mobile head-size formula's height term is dead code

```css
@media(max-width:760px){
  .hero .stagewrap{ width:min( clamp(200px, calc((100svh - 200px) * .9), 460px), 90vw ) }
}
```

The `svh` term only binds when `90vw < (100svh − 200) × 0.9`, i.e. when **viewport width < height − 200**.
On every portrait phone that is false, so `90vw` always wins:

| | 700 | 800 | 900 | 1000 |
|---|---|---|---|---|
| head height @320 | 198.8 | 198.8 | 198.8 | 198.8 |
| head height @390 | 242.3 | 242.3 | 242.3 | 242.3 |

Identical at all four heights. The head is purely width-driven on phones. Not a visible bug — the
result is fine — but the expression claims to solve for viewport height and does not. It only
activates in landscape.

---

## 5. The header's acceptance test — 30 / 30 PASS

Re-run against the **final** file state after `header.css` changed mid-audit (§8).

Required: bar 72, inset 0/0, leading-control centre 68 @1280 and 44 @390.

| Page | 1280 | 390 | 320 |
|---|---|---|---|
| index.html | 72 / 0 / 0 / **68** | 72 / 0 / 0 / **44** | 72 / 0 / 0 / 44 |
| about.html | 72 / 0 / 0 / 68 | 72 / 0 / 0 / 44 | 72 / 0 / 0 / 44 |
| apollo.html | 72 / 0 / 0 / 68 | 72 / 0 / 0 / 44 | 72 / 0 / 0 / 44 |
| bearings.html | 72 / 0 / 0 / 68 | 72 / 0 / 0 / 44 | 72 / 0 / 0 / 44 |
| cluster.html | 72 / 0 / 0 / 68 | 72 / 0 / 0 / 44 | 72 / 0 / 0 / 44 |
| strata.html | 72 / 0 / 0 / 68 | 72 / 0 / 0 / 44 | 72 / 0 / 0 / 44 |
| ucdavis.html | 72 / 0 / 0 / 68 | 72 / 0 / 0 / 44 | 72 / 0 / 0 / 44 |
| play.html | 72 / 0 / 0 / 68 | 72 / 0 / 0 / 44 | 72 / 0 / 0 / 44 |
| headmaker.html | 72 / 0 / 0 / 68 | 72 / 0 / 0 / 44 | 72 / 0 / 0 / 44 |
| gradientlab.html | 72 / 0 / 0 / 68 | 72 / 0 / 0 / 44 | 72 / 0 / 0 / 44 |

*(bar height / inset left / inset right / leading-control centre-x)*

**Zero drift.** Supporting numbers, also identical everywhere: `.jbNav` height 52 (`--nav-h`),
`.jbNav` x = 40 @1280 and 16 @390/320, width 1200 / 358 / 288.

This holds across **two different leading controls** — `.jbHome` on index/about/play/headmaker/gradientlab,
`.jbBack.backlink` on the five case studies. Different element, different content, same 68/44 centre.
That is the acceptance test doing exactly the job it was written for.

---

## 6. The hero, at four viewport heights

`index.html` at 1280 wide. All values are distances in CSS px from the top of the viewport at
`scrollY = 0`.

| | **700** | **800** | **900** | **1000** |
|---|---|---|---|---|
| bar bottom | 72 | 72 | 72 | 72 |
| → h1 top | +24 | +24 | +24 | +24 |
| h1 height | 84.8 | 84.8 | 84.8 | 84.8 |
| → head top | +24 | +24 | +24 | +24 |
| stage top | 204.8 | 204.8 | 204.8 | 204.8 |
| head height | 433.8 | 528.9 | 624.0 | 624.6 |
| head bottom (feet) | 638.6 | 733.7 | 828.8 | 829.4 |
| **feet clear the fold by** | **+61.4** | **+66.3** | **+71.2** | **+170.6** |
| contact shadow clears by | +79.3 | +87.3 | +95.3 | +194.7 |

**The head's feet clear the fold at all four heights, including 700.** The contact shadow clears by
more than the feet do, because `.floorshadow{bottom:3%; height:12%}` sits *inside* the stage box — the
feet are the binding edge, not the shadow.

**The chrome above the head is a constant 204.8px** at every height — `72 + 24 + 84.8 + 24`. Both gaps
are `--sp-16-24` = 24. That part of the hero is exactly on the system and should not be touched.

**The arithmetic behind the complaint.** The head is sized
`width: min(clamp(260px, (100svh − 248px) × .95, 620px), 62vw)`. Because it takes **95%** of every pixel
of new viewport height, clearance grows at only 5% of it:

> **clearance ≈ 0.05 × viewport_height + 26.4**

That predicts 61.4 / 66.4 / 71.4 against 61.4 / 66.3 / 71.2 measured. A visitor who makes their window
100px taller gets **5px** more air under the head. The jump to 170.6 at 1000px is only because the
620px cap finally binds at ~901px tall.

So "still too low" is not a spacing error — every gap above the head is a correct token. It is the
`.95` coefficient. The head consumes the viewport as fast as the viewport is granted.

**Real-world caveat.** These are measured against a true CSS viewport. Desktop Chrome's chrome eats
~90–110px, so a 800px-tall window presents ~700px — the 61.4px column is the realistic one for a
laptop, not the 900 column.

**Mobile is not the problem.** At 390 the head clears by 209.3px at 700 and at 320 by 229.6px, because
the head is width-capped there (§4.5).

---

## 7. Optical consistency

| Check | Result |
|---|---|
| **Bar items on one vertical axis** | **spread 0.00px** — all 4–5 items per page, all 10 pages, at 1280 and 390 |
| **Left edges down the page** | index/about/case studies: one edge, 40 @1280 / 24 @390. Case studies add a second at **209.6** = 80 + `--rail-w` (89.6) + `--rail-gutter` (40) — derived, correct |
| **Case-study card gutters** | consistent within each row; no mismatched gutters found |
| **Tabs vs content beneath** | `.csTab` row on index: single axis, spread 0. The larger spreads seen on cluster/ucdavis/bearings come from `.tvTab` elements in *different sections* down the page, not a broken row — **inconclusive, not a failure** |
| **400% zoom / reflow** | `scrollWidth − clientWidth = 0` on all 10 pages at 320. No horizontal scrolling. **Pass** |

The bar's 0.00px axis spread across 30 page-width combinations is the strongest single result in this
audit.

---

## 8. What moved under the measurement

The tree was written by five other agents throughout. Recorded honestly:

| | Start 04:59 UTC | Finish 05:21 UTC |
|---|---|---|
| HEAD | `97023d50` | `cba2eb83` |
| `header.css` | `57ffd84b` | `2e7504ab` |
| `index.html` | `dd68cf82` | `36ab0c3b` |
| `hero-engine.js` | `c7af9fe2` | `b0d17d99` |
| `tokens.css` | `5836658a` | `5836658a` *(unchanged)* |
| `gradientlab.html` | `156ab65a` | `156ab65a` *(unchanged)* |

**Consequently re-measured against the final state:** the full header acceptance table (§5) and the
full hero chain (§6). Both are reported at the finish-state hashes.

**Material change observed:** the hero headline was shortened mid-audit — `#h1` went from 133.6px to
**84.8px** tall, moving the stage top from 253.6 to 204.8. Feet clearance at 700px improved from
**+12.6px to +61.4px** in that window. §6 reports the later, better numbers. If the earlier figure is
in another document, this is why they differ.

**Unchanged and therefore reported at start-state hashes:** the token/stray scan (§4.1), the rhythm
sequences (§4.2) and the target census (§4.3, §3). `gradientlab.html`, `apollo.html`, `headmaker.html`
and `tokens.css` were not touched during the audit at all, which covers every BROKEN finding.

---

## 9. Fix order, by visitor impact per line changed

1. **Move gradientlab's target sizing out of `@media(max-width:880px)` into the base rule.** One edit,
   clears 39 of the site's ~50 target failures.
2. **Give `.chap` a real target.** `height:14px` → a 44px box, or an `::after` expander copying
   `header.css:393`. Restores the section jump-list on five pages.
3. **`.csTab` mobile padding 8/16 → 10/16.** Two pixels, clears 44.
4. **Retire `7 / 9 / 11px` in gradientlab** for `--sp-6`/`--sp-8`/`--sp-10`/`--sp-12`. 58 of the 70
   off-system values.
5. **Pick one section-closing rung on the case studies.** Five joins, four rungs, no rule.
6. **`clamp(…,150px)` → `clamp(…,144px)`** on `.siteFoot`, both pages. One idea, one cap.
7. **The hero's `.95` coefficient** — the only lever that changes what "still too low" feels like.
   Everything above the head already measures correct.
