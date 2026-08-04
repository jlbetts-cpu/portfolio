# Mobile audit — nine pages, 390 × 844 and 320px

**Measured 2026-08-03 18:07 PDT, branch `broadcast-match`, HEAD `1bfddfb`.**
Read-only audit. Nothing was changed.

**This is a moving target.** Two agents were writing `index.html`, `header.css`,
`header.js`, `play.*`, `tokens.css` and the case-study pages while these numbers
were taken — HEAD moved from `cc6e6ae` to `1bfddfb` during the session. Every
finding below is tagged **[branch]** (introduced by the header-v2 work, likely to
move under you) or **[pre-existing]** (present at `f445f43`, nobody is currently
in that file). Re-measure the **[branch]** ones before acting.

---

## Method, and why the numbers are trustworthy

- Headless Chrome clamps its own viewport to a 500px minimum, so every page was
  rendered **inside a 390px-wide same-origin iframe** and measured through
  `contentWindow`. Confirmed real: `iframe.contentWindow.innerWidth === 390`.
- Served from `python3 -m http.server 4241 --bind 127.0.0.1`, verified as the sole
  listener with `lsof -nP -iTCP:4241 -sTCP:LISTEN`, and addressed only as
  `127.0.0.1:4241` — never `localhost`.
- **Every page carries `overflow-x: clip` on `html` and `body`**, so
  `documentElement.scrollWidth` reads 390 even when content runs past the edge.
  Overflow was therefore measured twice: as shipped, and again with the clip
  lifted in memory. "As shipped 390 / unmasked 452" means *content is being cut
  off*, which is worse than a scrollbar, not better.
- Transforms were neutralised for the layout-overflow pass (`scrollWidth` ignores
  transforms; `getBoundingClientRect` does not).
- `play.html` was driven with a **real seeded roster of four heads** — unique
  `cut` pixels per head (the engine dedupes by pixel data *and* by geometry at
  `play-engine.js:10`, so four clones of `__EGGHEAD` collapse to one), each with
  complete `marks.BL/BR/M/N` and `eyes{x,y,w,h,ang,sc,ic}` in 0–1 units.
- rAF is throttled while the pane is backgrounded. The tab was fronted before any
  motion was sampled; `document.hidden === false` was asserted at sample time.

**Totals: 6 broken, 12 poor.**

---

# BROKEN — unusable, unreachable, or overflowing

## B1. The Play menu on the home page loses its right 29% off-screen — the 4th saved head is unreachable **[branch]**

`index.html`, `#moodbar.jbDiscMenu.jbPlayMenu` at 390px.

| measurement | value |
|---|---|
| panel box | x 236 → **452**, width 216 |
| viewport | 390 |
| **overhang** | **62px (29% of the panel)** |
| every menu row (`Empathy`…`Show on home`) | 206px wide, **right 57px cut** |
| 4th head's thumbnail (`.mhPick`) | 53px cut — **entirely off-screen** |
| 4th head's delete (`.mhX`) | 56px cut — **entirely off-screen** |
| `html{overflow-x}` | `clip` — so none of it can be scrolled to |

**Root cause.** `header.css:401` — `.jbPlay .jbDiscMenu{left:0;right:auto}`. Play
sits in the leading group, so its panel hangs from the item's *left* edge and
grows rightward. `.jbDiscMenu`'s `max-width:min(var(--menu-w),calc(100vw - var(--sp-32)))`
guards against a panel *wider* than the screen, but nothing repositions a panel
whose left anchor is already near the right edge. Computed: `left:0px; right:-172px`.

**The clamp that used to fix this is now dead code.** `hero-engine.js:1830`
`clampMenuX()` measures at open time and flips the panel to `right:0` when it
"would leave the column" — the exact bug. It is reached only from
`openM()`, which is bound at `hero-engine.js:1890` via
`if(btn) btn.addEventListener(...)` where `btn = document.getElementById("moodBtn")`.
**`index.html` no longer renders `#moodBtn`** (verified: `document.querySelector('#moodBtn')`
→ `null`; at `f445f43` it existed — `git show f445f43:index.html | grep -c 'id="moodBtn"'` → 1).
The Play control is now `<a class="jbDiscGo" href="play.html">` inside `#jbPlay`,
opened by `header.js`'s disclosure logic, which never calls the clamp. No inline
`left`/`right` is ever written — confirmed `mb.style.left === ''`.

`play.html:47-58` already documents this exact failure mode and fixes it there with
`#moodMenu{left:auto;right:0}`. The home page lost the equivalent fix in the rebuild.

**What a visitor hits.** On a phone `header.js` binds the touch path under
`(hover:none)`, so the first tap on Play opens the panel rather than navigating.
The panel appears with its right third sliced off — the mood labels are clipped
mid-word, and if four heads are saved, the fourth is simply not there. No amount
of scrolling or rotating reveals it.

Also confirmed: the overhang is constant at every scroll position (unmasked
scrollWidth 452 at 0%, 25%, 50%, 75%, 100% of the page), and still present at
320px (unmasked 417).

---

## B2. `gradientlab.html` is the one page that genuinely scrolls sideways — and the only 400%-zoom failure **[pre-existing]**

This page does **not** carry `overflow-x: clip`; `html` and `body` compute
`visible`. The overflow is real and the page scrolls in two dimensions.

| viewport | `documentElement.scrollWidth` | overflow |
|---|---|---|
| 390 × 844 | **426** | **+36px** |
| 320 × 256 (WCAG 1.4.10, 1280px @ 400%) | **349** | **+29px** |

**Culprit:** `.haloWrap` — `position:absolute; inset:-26%` around `#orbWrap`
(`gradientlab.html:79`). At 390px `#orbWrap` is 304px, so `.haloWrap` is 462px and
sits at **x −36 → 426**, hanging off *both* edges. `#haloCanvas` inside it is
536px (x −73 → 463) but is clipped by `#halo{overflow:hidden}`.

**400% zoom (WCAG 1.4.10 Reflow).** Never run on this site before. Result across
all nine pages at 320 × 256:

- **8 pass** — `index`, `apollo`, `bearings`, `cluster`, `strata`, `ucdavis`,
  `play`, `headmaker` all hold `scrollWidth === 320`.
- **`gradientlab.html` fails** — 349 in 320, requiring two-dimensional scrolling.

**What a visitor hits.** The page drifts left-right under the thumb while they
try to drag a slider, and the orb is never quite centred.

---

## B3. `gradientlab.html`'s entire mobile stylesheet is dead code **[pre-existing]**

Both mobile blocks sit at **lines 49–69**, *above* the base rules they are meant
to override at **lines 72–130**. Same specificity, later source wins — so almost
every declaration in them is discarded.

| mobile rule (line) | intended | actually computed at 390px | beaten by |
|---|---|---|---|
| `.panel{position:static;max-height:none}` (51) | static, unbounded | `sticky`, `max-height:100vh`, height **844px** | line 96 |
| `.stage{min-height:56vh}` (52) | 472px | **607.68px** (72vh) | line 72 |
| `.orbWrap{width:min(430px,86vw)}` (53) | 335px | **304px** (78vw) | line 78 |
| `.orbWrap.orb2` / `.orb3` (54–55) | smaller | base widths | 93 / 94 |
| `input[type=range]::-webkit-slider-thumb{width:20px;height:20px}` (59) | 20px thumb | **14px** | line 122 |
| `input[type=range]{touch-action:pan-y}` (60) | drag ≠ scroll | **`auto`** | line 120 |
| `input[type=color]{width:34px;height:34px}` (61) | 34px | **30px** | line 116 |
| `select{max-width:150px;font-size:13px;padding:7px 8px}` (62) | 13px | **12px**, 28.5px tall | line ~127 |
| `.miniBtn{padding:7px 11px}` (63) | roomier | **4px 9px** → 45.7 × 23.5 | line 118 |
| `.row{margin:14px 0}` (57) | 14px | **10px** | line 105 |
| `.secH{font-size:10px}` (67, ≤420) | 10px | **11px** | line 100 |
| `.row label{font-size:12.5px}` (68, ≤420) | 12.5px | **13px** | line 106 |
| `.swRow{gap:8px}` (66, ≤420) | 8px | **10px** | line 113 |

The **only** survivor is `.lab{grid-template-columns:1fr}` (line 50), because its
base rule is at line 48 — *above* the media block. Verified: `getComputedStyle(.lab).gridTemplateColumns`
→ `"390px"` (stacked, correct) while `.panel` is still `sticky` at 844px tall.

This ordering is identical at `f445f43` (media block at line 26, base rules at
49/55/73/97), so it is not a branch regression — the mobile pass has simply never
taken effect.

---

## B4. `gradientlab.html`'s 22 sliders are 2px-tall touch targets **[pre-existing]**

`input[type=range]` computes to **255.1 × 2px** (`height:2px`, line 120). The
element's border box *is* the hit area; the 14px thumb is a pseudo-element that
paints outside it. A finger must land inside a 2px horizontal band.

The fix was written and is dead (B3): the mobile block's 20px thumb and
`touch-action:pan-y` never apply. Without `pan-y` a successful drag also scrolls
the page underneath.

Affected: `#nx`, `#ny`, `#nsize`, `#nlen`, `#nang`, `#flow`, and the whole Field
section — 22 controls, which is most of the Lab.

**What a visitor hits.** The Lab looks complete on a phone and the panel is
reachable, but the sliders — the entire point — cannot be operated.

---

## B5. On all five case studies the Back control is dead below ~350px **[branch]**

`.jbBack` and the `Work` link occupy the same pixels. Measured on `apollo.html`;
identical markup on `bearings`, `cluster`, `strata`, `ucdavis`.

| viewport | Back box | Work starts at | overlap | live sliver of Back | `elementFromPoint` at Back's centre |
|---|---|---|---|---|---|
| **320** | x 70–114 (44px) | **75** | **39 × 44px** | **5px** | **`Work`** |
| **344** | x 70–114 | 87 | 27 × 44px | 17px | **`Work`** |
| 360 | x 70–114 | 95 | 19 × 44px | 25px | `Back to work` |
| 375 | x 70–114 | 102 | 12 × 44px | 32px | `Back to work` |
| 390 | x 70–114 | 110 | 4 × 44px | 40px | `Back to work` |
| 414 / 430 | x 70–114 | 122 / 130 | none | full | `Back to work` |

Sampled at 15%, 35%, 50%, 70% and 90% across Back at 320px — **`Work` wins every
single point.** Only a 5px strip at Back's left edge is live.

**Root cause.** `.jbGrp` is `flex:1 1 0; min-width:0; overflow:visible`. `.jbGrpL`
holds the lockup (44) + 4px gap + Back (44) = 92px of content, but the centred-
wordmark layout gives it only ~53px at 320px. It shrinks below its content and
Back spills into `.jbGrpC`'s territory. `Work` is later in the DOM, so it paints
on top and takes the hit test. The nav never reports overflow
(`scrollWidth === clientWidth` at every width tested), which is why this is
invisible to the usual check.

**Consequence.** Back → `index.html`; Work → `index.html#cases`. Different
destinations, so a visitor on an iPhone SE or a 360px Android who taps the back
arrow lands part-way down the home page instead of at the top. `.jbBack` did not
exist at `f445f43` (`git show f445f43:apollo.html | grep -c jbBack` → 0), so this
arrived with the header rebuild. Note `header.js:80` already argues the lockup and
Back are redundant — deleting Back would close this outright.

---

## B6. `headmaker.html` — the delete button sits on top of the head it deletes **[pre-existing]**

Each saved head's `.mhX` overlaps its own `.mhPick` thumbnail by **37 × 37px**
(four instances, one per seeded head). `.mhX` is
`position:absolute; top:-6px; right:-6px; width:16px; height:16px`, bumped to
26 × 26 by a later rule — pinned to the corner of a ~45px thumbnail.

`.mhX` is 16–26px against a 44px minimum, and it is a **destructive** control
layered over a benign one. On index's Play panel the same pair measures 18 × 18
overlapping the thumbnail by 15px (see P7). A thumb aimed at the top-right of a
head opens the delete instead of the head.

Unchanged from `f445f43`.

---

# POOR — cramped, small, or awkward

## P1. Before/after phone shots are halved to 163px **[pre-existing]**

`.baGrid .shot.phone img` renders **163px wide** at 390px on `apollo.html` and
`ucdavis.html` — six per page, from a 460px natural source (2.8× down).
`@media(max-width:560px){.baGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}`
keeps two columns at 390px, so each phone gets 163 of the 342px content width.

This is the standing "don't shrink the phone shots" rule being broken by the one
component whose entire job is letting you see the difference between two screens.
Stacking to one column would give each 342px.

## P2. `ucdavis.html`'s desktop board renders at 342px from 1152px **[pre-existing]**

`.tv.tvBoard .tvFrame img` — a 3.4× downscale of a dense desktop layout. Nothing
in it is legible on a phone. (`.tv.tvPhone` and `.playerStage` fare better at
242px.)

## P3. `play.html`'s live scoreboard is 10–11px type **[pre-existing]**

With a match running at 390px: `Red` / `Blue` labels **10.5px**, `First to 5`
**10px**, the `End` chip **11px** in a **58 × 25px** box. This is the only chrome
on screen during a match.

## P4. `gradientlab.html`'s panel is desktop-density throughout **[pre-existing]**

`.secH` 11px · `.miniBtn` 11px at 45.7 × 23.5 · `.sw` labels 9px · colour swatches
30 × 30 · `select` 12px at 28.5px tall · `Save` 45.7 × 23.5 · `Download PNG`,
`Copy`, `Random colours` all 11px. **56 of 56 interactive controls on the page
measure under 44px on at least one axis.** All of the intended mobile relief is
in the dead block (B3).

## P5. `headmaker.html`'s footer links are half the height of every other page's **[pre-existing]**

`.footIn` measures **68.4 × 21**, **81.6 × 21**, **43.6 × 21**. `index.html`,
`apollo.html` and `ucdavis.html` all ship
`@media(max-width:768px){.footIn{display:inline-block;padding-top:12px;padding-bottom:12px;margin-top:-12px;margin-bottom:-12px}}`
which lifts them to 41.5px. **`headmaker.html` does not have this rule** (grep
count 0, here and at `f445f43`). Adjacent gap `LinkedIn`↔`Instagram` is 7.7px.

## P6. Nav items are 4px apart at ≤640px **[branch]**

`Work`↔`About` and `About`↔`Play` sit **4px** apart on every page
(`header.css:627`, `.jbNav{gap:var(--sp-4)}`). Targets are a true 44 × 44 — the
`::after` expander at `header.css:283` does lift the visual 38px box to a 44px hit
box, so the height is fine — but 4px between three same-size icons is thumb-tight.
On `apollo` the lockup↔Back gap is also 4px.

## P7. The Play panel's delete buttons are 18 × 18 and overlap their own thumbnails **[pre-existing rule, branch context]**

`.mhX` measures **18 × 18** in index's Play panel, at x 275–293 over a `.mhPick`
at x 245–290 — **15px of overlap**. Same family as B6; smaller, and inside a panel
that is already being clipped (B1).

## P8. `gradientlab.html`'s control panel is a `100vh` sticky column on a phone **[pre-existing]**

`.panel{position:sticky; top:0; max-height:100vh; overflow-y:auto}` (line 96)
survives on mobile because its `position:static; max-height:none` override is dead
(B3). Computed height at 390 × 844: exactly **844px**. On iOS Safari `vh` resolves
against the *large* viewport, so with the browser chrome showing, the bottom of
this 100vh panel — and the last controls in it — sits under Safari's toolbar with
no way to scroll the page to reveal them.

## P9. 13px type across the case studies **[pre-existing]**

Below 14px but above a hard floor: nav `.jbLbl` 13px · `.eyebrow` 13px · `.rlabel`
13px · `.kicker` 13px · `.subKick` 13px · `.baLabel` 13px · `.playerKick` 13px ·
`.tvTab` 13px. Driven by `--fs-label:13px`. `--fs-caption:12px` and
`--fs-micro:11px` appear in captions and chips.

## P10. `index.html`'s hero overflows itself by 20px **[pre-existing]**

`section#main.hero` — `offsetWidth 342`, `scrollWidth 362`. The culprit is
`#fsh.floorshadow`, whose box reaches x 410 (20px past the viewport). Decorative,
`opacity:.46`, and swallowed by `html{overflow-x:clip}` — cosmetic only, listed so
it is not re-discovered as a mystery.

## P11. Zero `100dvh` and zero `env(safe-area-inset-*)` site-wide **[branch removed the last dvh]**

Across all nine pages plus `header.css`, `tokens.css` and `play.css`:
**`100dvh`: 0 occurrences. `safe-area-inset`: 0 occurrences.** Only `100svh`
(3 uses in `index.html`) and `70svh` (`tokens.css`, `index.html`).

`f445f43` had exactly one `100dvh` — `index.html:887`,
`@media(max-width:760px){body.hmFull .hero{min-height:calc(100dvh - 68px)}}` — the
full-screen game mode, which has since moved to `play.html`. Its removal follows
the split rather than being a regression, but the site now has no dynamic-viewport
unit anywhere.

**The eight `100vh` declarations, adjudicated one by one:**

| where | verdict |
|---|---|
| `index.html:71` `.hero{min-height:calc(100vh - 80px)}` | **Not a problem.** `@media(max-width:760px)` sets `min-height:auto`; computed hero height on mobile is 395.43px. |
| `index.html:195` `.reelStage{position:sticky;top:0;height:100vh}` | **Not a problem.** Later `.reelStage{position:static!important}` / `.reelTrack{height:auto!important}` win; computed `position:static; height:auto` at 390px. |
| `index.html:196` `.reelFrame{width:min(...,calc((100vh - 40px)*16/9))}` | **Not a problem.** Computed `height:auto`; the `100vh` term never wins at phone widths. |
| `index.html:272/321/322` `#loveScene`, `#photorain`, `#camflash` at `height:100vh` | **Low risk.** Not in the DOM until a mood plays (all three query `null` at rest); `pointer-events:none` decorative overlays. Would sit ~110px taller than the visible area on iOS — invisible. |
| `index.html` `.reelFrame.isFull{position:fixed;inset:0;height:100vh}` | **Low risk / unreachable.** No fullscreen trigger renders at 390px (0 matches for a fullscreen/expand control). Would be a genuine trap if that path is ever re-enabled on mobile. |
| `gradientlab.html:48` `.lab{min-height:100vh}` | **Benign** — a min-height on a page that scrolls. |
| `gradientlab.html:96` `.panel{max-height:100vh}` | **Real problem** — see P8. |

**Fixed-position elements vs Safari's bottom bar and the home indicator:**
no page positions an interactive control against the bottom edge. `.jbStick.isFixed`
is top-anchored; `play.html`'s `#moodbar` is top-anchored
(`top:var(--play-top)`, measured y 72–116); `gradientlab.html` has zero
`position:fixed`. The only bottom-reaching fixed elements are `#reelOverlay` and
`#flash`, both full-viewport decorative layers. **No collision, so the missing
`safe-area-inset` is currently harmless** — worth stating so it is not chased.
One thing to confirm on a real iPhone rather than assert: `play.html` sets
`html,body{height:100%;overflow:hidden}`, and whether `%` resolves to the small or
large viewport there decides if the arena's bottom edge tucks under the toolbar.
The arena band leaves 148px of slack below it, so the margin is probably enough.

## P12. The tournament poster gives no hint that there is more below **[pre-existing]**

`#tourPanel` is `overflow-y:auto` with `scrollHeight 1080` vs `clientHeight 697` —
**384px of bracket and schedule below the fold**, reachable but unadvertised. The
poster fills the viewport cleanly, so a visitor may never learn the draw is there.
(`.tCupSchedIn` is a *second*, nested scroller — `scrollHeight 331` vs
`clientHeight 143` — which is awkward on touch but does work.)

---

# What is actually fine

Worth recording, because several of these were the things most likely to be wrong.

**`play.html` is the strongest page on mobile.** With four real heads seeded:

- `documentElement.scrollWidth === 390`, `scrollHeight === 844`, `body{overflow:hidden}`
  — **does not scroll in either axis**, exactly as intended.
- The Play menu opens **fully inside the viewport** (x 191–378, 187 × 206), right-
  anchored by `#moodMenu{left:auto;right:0}` (`play.html:58`). Every row is
  42–44px tall and 0px is cut. This is the fix `index.html` is missing (B1).
- `#moodBtn` is a true **85 × 44**.
- **Soccer starts and plays.** `__hmSoccer.on === true`, phase cycled
  `play → reset → play`, ball travelled (301,153) → (362,490) → (42,280) over 5s,
  score reached **2–1**, both goals and all four heads on screen and inside the
  frame. Screenshotted.
- **The tournament runs.** `Apollo Cup — Semi-final` poster renders entirely within
  390px; `#tourPanel` scrolls to its true bottom (`scrollTop 384`, bottom reached)
  and the schedule becomes visible. Nothing horizontal overflows
  (every element's right edge ≤ 390).

**Eight of nine pages pass WCAG 1.4.10 reflow at 400% zoom** (320 × 256, no
horizontal scroll). Only `gradientlab.html` fails.

**No horizontal overflow on any of the five case studies** at 390px or 320px —
unmasked `scrollWidth === 390` / `320` on `apollo`, `bearings`, `cluster`,
`strata`, `ucdavis`, and on `headmaker`.

**Nav tap heights are genuinely 44px.** The visual box is 38px, but
`.jbNav a::after{height:var(--tap-min)}` (`header.css:283`) lifts the hit box to
44. Anything reporting these as 38px tall is measuring the wrong rectangle.

**No hover-only content.** `header.js:126` binds the touch path explicitly under
`(hover:none)` — first tap opens the panel, and `.jbDiscTouch` supplies the
destination as a real `<a href>` row. The mechanism is right; only the Play
panel's *position* is wrong (B1).

**`index.html` gains no new overflow while scrolling.** Unmasked `scrollWidth`
held at 452 across 0 / 25 / 50 / 75 / 100% of the page — the 62px is the Play
panel and nothing else.

---

# Suggested order

1. **B1** — one line, restores the Play menu. Either add `.jbPlay .jbDiscMenu{left:auto;right:0}`
   at phone widths, or re-point `clampMenuX` at the v2 markup. `play.html:58`
   already has the answer.
2. **B5** — the Back/Work collision. Deleting `.jbBack` on case studies closes it
   and matches the argument already written in `header.js:80`.
3. **B3 → B2/B4/P4/P8** — move `gradientlab.html`'s two media blocks *below* line
   130. One cut-and-paste revives thirteen dead declarations and fixes the sliders,
   the sticky panel, and most of P4. Then clamp `.haloWrap`'s `inset:-26%` for B2.
4. **B6 / P7** — give `.mhX` a 44px hit box that does not sit inside `.mhPick`.
5. **P1** — stack `.baGrid` to one column below 560px.
6. **P5** — copy the `.footIn` mobile-padding rule into `headmaker.html`.

---

## Verdict

**Not mobile-ready today.** `play.html` is genuinely good and the case studies are
structurally sound, but the home page's Play menu — the front door to everything
the Play work has bought — loses its right third to a clip on every phone, and
`gradientlab.html` is effectively inoperable by finger. Both are single-cause and
cheap to fix; B1 and the `gradientlab` source-order move would take the site most
of the way in an afternoon.

---

# FIX ROUND — 2026-08-03, branch `broadcast-match`

Worked from `1bfddfb`. Three commits: `aff2a3b` (B1), `7231b74` (B2/B3/B4/P4/P8/P11),
`752d496` (P5). Both gates green at every commit — `tools/hm-check.py` → `syntax OK`,
`tools/token-audit.py` → `errors=0 STATUS=PASS`, `raw_px_total=4732`,
`raw_hex_total=446`, `warnings=289`, all unchanged from the pre-fix baseline.

**Method.** Same harness as the audit: `python3 -m http.server 4291 --bind 127.0.0.1`,
addressed only as `127.0.0.1`, pages rendered inside a **390px same-origin iframe**
inside headless Chrome (which clamps its own viewport to 500px), measured through
`contentWindow`. Every run used a **fresh `--user-data-dir`**, so no run could read a
stale `header.css` or `hero-engine.js` — the trap that has cost this project rounds
before. The four-head roster was seeded into `localStorage` from the harness before the
iframe was created, with per-head pixel data and per-head `marks`/`eyes` so the engine's
double dedupe (by `cut` string *and* by geometry key) does not collapse them, and with
`cut` data URLs over the 15 000-character floor `readAll()` enforces. Interaction checks
(dragging a Lab slider, firing a mood) were done in a real Chrome at 375 × 812.

---

## CLOSED

### B1 — the Play panel runs off-screen on `index.html` ✅ `aff2a3b`

**Primary fix is the CSS**, ported from `play.html:58` as instructed:
`@media(max-width:640px){.jbPlay .jbDiscMenu{left:auto;right:0}}`, placed
**immediately after** `.jbPlay .jbDiscMenu{left:0;right:auto}` — same specificity,
and a media query adds none, so only source order decides it. (Placing it anywhere
above that rule would have reproduced B3 in a second file.)

`640` is not a new number: it is this component's own breakpoint, already used at
`header.css:608`, and the file states why breakpoints here must be raw. Measured, the
flip is only needed below ~520px, so riding 640 leaves 120px of headroom and touches
nothing on desktop.

| viewport | panel before | panel after | overhang |
|---|---|---|---|
| 320 | 201 → **417** | 29 → 245 | +97 → **0** |
| 390 | 236 → **452** | 64 → 280 | +62 → **0** |
| 430 | 256 → **472** | 84 → 300 | +82 → **0** |
| 640 | 361 → 577 | 189 → 405 | none either way |
| 641 | 381 → 597 | *unchanged* | — |
| 1280 | 700 → 916 | **700 → 916, unchanged** | — |

**With four real heads seeded**, at 390 and at 320, every `.mhPick` and every `.mhX`
returns `right − innerWidth ≤ 0` — **0px cut on all eight elements**, where before the
fourth head's thumbnail lost 53px and its delete button 56px, both entirely off-screen.
The worst overhang of *any* descendant of the panel is 0. Confirmed visually in a real
Chrome at 375: the panel opens at 57 → 273 with every mood row complete.

**The JS guard: deleted, not revived.** It was worse than dead. `clampMenuX` and
`clampMenu` both operate on `menu = #moodMenu`, which in the v2 header is the static
inner `.jbDiscGrp` holding the four mood buttons — the panel is `#moodbar`. And they are
*reachable*: the audit traced `openM` only to the `#moodBtn` binding, but the
`(hover:hover) and (pointer:fine)` block at `hero-engine.js:1844` also calls it
(`openM` is a hoisted declaration, so its `typeof` guard passes). Measured at 390 by
dispatching `mouseenter` on `#moodbar`: `#moodMenu` came back carrying
`top: calc(100% + 10px) !important; bottom: auto !important; max-height: 584px !important; overflow-y: auto`
— `!important` inline geometry written onto a `position:static` div, where `top` and
`bottom` are inert and the `max-height` is meaningless. Reviving it would have meant
re-pointing it at `#moodbar` to duplicate, in JavaScript at open time, what one CSS
declaration now does statically. The panel's box has one owner and it is the stylesheet:
`.jbDiscMenu` already carried `max-height:var(--menu-max-h); overflow-y:auto` for the
vertical half. `menuOpensDown()`, unreferenced anywhere, went with them.

Mood dispatch re-verified after the deletion: clicking `Delight` in the panel still puts
`partyLock` on `<body>`. No console errors on `index.html`.

`play.html`'s comment at line 52, which pointed at `index.html:4273 clampMenuX`, was
stale in both file and line and now records what actually happened.

### B3 / B4 / B2 / P4 / P8 / P11 — `gradientlab.html` ✅ `7231b74`

Both media blocks moved from the top of the sheet to its foot, below every rule they
override, with a standing note that nothing may be added after them.

| symptom | before | after |
|---|---|---|
| `.panel` | `sticky`, `max-height:100vh`, **844px** | `static`, `max-height:none` |
| `.lab` | 1 column (only surviving rule) | 1 column |
| `input[type=range]` box | **255 × 2** | **261 × 44** |
| `input[type=range]` `touch-action` | `auto` | `pan-y` |
| controls under 44px on the page | **56 / 56** | **5 / 46**, and all five are nav items whose `::after` expander makes them a true 44 |
| `scrollWidth` at 390 | **426** (+36) | **390** |
| `scrollWidth` at 320 × 256 (400% zoom) | **349** (+29) | **320** |

The task's warning was right: **two of the relocated rules were themselves wrong**,
because they had never run and so had never been checked.

- `header{padding:14px 16px 0}` targets an element this page stopped having when the
  site header was adopted. Deleted.
- `.stage{padding:58px …}` did not clear the 72px bar plus the `.labId` plate that sits
  at `top:72px` beneath it — the orb would have been centred into them. Now `132px`.

And the slider rule would not have fixed the sliders even if it had run:
`::-webkit-slider-thumb` is a pseudo-element that paints **outside** a 2px input's border
box and catches nothing, so a 20px thumb on a 2px input is still a 2px target. The track
moved to `::-webkit-slider-runnable-track` so the input itself can be 44px tall while the
line stays the same 2px hair; the thumb is centred on it with `margin-top:-9px`. The
Gecko half is the track only — restyling `::-moz-range-thumb` would mean re-stating two
literal colours this sheet already carries once, and the 44px hit box is the fix either
way. **Verified by dragging `Speed` from 40 to 76 in a real Chrome at 375 × 812.**

`.row{margin:8px 0}` rather than the block's original 14: with 44px controls the row's
height is now the control's, and 8px is the separation a touch list wants.

**B2** is closed with `overflow-x:clip` on `.stage`. `.haloWrap` is `inset:-26%` around
`.orbWrap`, so at 390 it is 462px sitting at x −36 → 426 and hung off the right edge of
the one page carrying no clip — a genuine two-dimensional scroll. What overflows is a
blurred decorative glow already outside the viewport, so clipping removes the scroll and
nothing anyone can see; `clip` rather than `hidden` so it never becomes a scroll
container, and x-only so the halo keeps its vertical bleed (`visible`/`clip` is the one
mixed pair CSS permits). **All nine pages now hold `scrollWidth === 320` at 320 × 256** —
the site's first clean sweep of WCAG 1.4.10.

**P11** is partly closed: `.panel{max-height:100vh; max-height:100dvh}` is the site's
first dynamic viewport unit, with the `vh` line kept ahead of it as the fallback. This is
the one declaration the audit adjudicated as a real problem; the other seven `100vh`s
were adjudicated benign there and are untouched. `safe-area-inset` is still zero
site-wide, which the audit established is currently harmless because no page anchors an
interactive control to the bottom edge.

Desktop re-checked at 1280 × 800: panel still `sticky` at `max-height:800px`, grid still
`960px 320px`, `overflow-x:clip` / `overflow-y:visible` as intended. Nothing above 880px
moved.

### P5 — `headmaker.html`'s footer links ✅ `752d496`

The `@media(max-width:768px)` `.footIn` rule copied from `index.html`. Measured at 390:
**68 × 21, 82 × 21, 43 × 21 → 68 × 50, 82 × 50, 44 × 50**, byte-identical to
`index.html`'s numbers. The padding is cancelled by an equal negative margin, so the
prose keeps its exact leading and only the hit box grows.

*Noted, not changed:* the five case studies carry the same rule at **8px**, not 12, which
lands them at ~37px rather than 45. Raising them would be visually free (the negative
margins cancel), but it also deepens the overlap between the hit boxes of links on
adjacent lines of the same paragraph, which is a real trade and not mine to make.

---

## FLAGGED, NOT CHANGED

Each of these would visibly move a surface Jayden has approved, or picks one of two
defensible designs. Measurements are done so the call takes a minute.

### B5 — Back/Work collision on the five case studies **[header]**

Reproduced exactly: at 320 and at 344, `elementFromPoint` at Back's centre returns
**`Work`**. There are two fixes and they are different designs.

1. **Stop `.jbGrpL` shrinking below its content** —
   `@media(max-width:640px){.jbNav .jbGrpL{flex:0 0 auto;min-width:max-content}}`.
   Measured with this injected on `apollo.html`: overlap **39 × 44 → 0** at 320, and all
   five sample points across Back (15/35/50/70/90%) return **`Back to work`** at 320, 344
   and 390. The header acceptance test is unaffected — bar 72, inset 0/0, logo centre
   unchanged — and no page overflows. **The cost:** the centred trio shifts right, 8px at
   390 (Work 110 → 118) and 43px at 320, so it is no longer exactly centred at phone
   widths. That is a visible change to the bar on five approved pages.
2. **Delete `.jbBack` on case studies** — closes it outright, frees 48px, and matches the
   argument already written at `header.js:80` that the lockup and Back are redundant. It
   removes a control from an approved header.

I recommend (1) — it is a bug fix to a flex group that is permitted to shrink below its
own content, and the 8px it costs at 390 buys back a control that is currently dead below
350 — but two defensible answers is not a clear-cut call.

### B6 / P7 — `.mhX` sits on top of the head it deletes **[Play panel]**

Confirmed unchanged: 18 × 18 in index's Play panel, 16–26px on `headmaker.html`, each
overlapping its own `.mhPick`. `.mhX::before{inset:calc(var(--sp-6) * -1)}` expands the
target *further into* the thumbnail, so it makes the overlap worse, not better. Every
honest fix moves the delete out of the thumbnail's corner — which is restructuring the
saved-heads grid, and that grid is on the do-not-restructure list.

### P1 — before/after phone shots at 163px **[case-study body]**

Measured on `apollo.html`: `.baGrid` computes `163px 163px` at 390 and `128px 128px` at
320, from a 460px source. Worth recording for whoever takes it: the
`@media(max-width:560px)` rule intended to handle this is **itself half-dead** — a later
base `.baGrid{grid-template-columns:repeat(2,minmax(0,270px))}` overrides its
`grid-template-columns`, and only the `gap:16px` survives (which is what produces 163
rather than 151). Same disease as B3, in a second file. Stacking to one column would give
each shot 342px and satisfies the standing "don't shrink the phone shots" rule, but it
also removes the side-by-side reading that is the component's entire point, so it is a
design call.

### P6 — nav items 4px apart **[header]** · P3, P12 — **[play surface]** · P2, P9

`P6` is `header.css:609`'s `--sp-4`, on every page, and the targets are a true 44 × 44;
tightening the gap is a header change. `P3` (10–11px scoreboard type) and `P12` (384px of
bracket below an unadvertised fold) are both on the play surface. `P2` (ucdavis' 1152px
board at 342px) is a content decision about which artifact belongs on a phone. `P9` (13px
type across the case studies) is `--fs-label`, a token-level change that would move every
page at once.

### P10 — index's hero overflows itself by 20px

Left as the audit recommends: `#fsh.floorshadow`, decorative at `opacity:.46`, swallowed
by `html{overflow-x:clip}`, cosmetic only.

---

## Header acceptance test — re-run after every change

`.jbStick` height and insets, and `.jbLogo`'s centre, at 1280 and 390, on all nine pages:

| | 1280 | 390 |
|---|---|---|
| bar height | **72** ×9 | **72** ×9 |
| inset left / right | **0 / 0** ×9 | **0 / 0** ×9 |
| logo centre | **68** ×9 | **44** ×9 |

Nine identical rows at each width, matching the pre-fix baseline. `.jbNav` inside it is
also uniform — 52px tall, inset 40 at 1280 and 16 at 390, logo centre 68 / 44.

## Regression sweep

All nine pages, unmasked, at three viewports:

- **390 × 844** — `scrollWidth === 390` on all nine.
- **320 × 844** — `scrollWidth === 320` on all nine.
- **320 × 256 (400% zoom)** — `scrollWidth === 320` on all nine. Was 8 of 9.

No console errors on any page. `play.html` untouched apart from a stale comment, and
still does not scroll in either axis.

**Score: 6 broken + 12 poor → 2 broken + 9 poor.** Closed: B1, B2, B3, B4, P4, P5, P8,
and P11's one real case. Outstanding: B5, B6, and P1, P2, P3, P6, P7, P9, P10, P12 —
every one of them flagged above with its measurement and its recommended option.
