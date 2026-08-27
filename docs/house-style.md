# The house style, measured off the home page

**What this is.** `index.html` is the page Jayden is happy with. This document is
that page taken apart into numbers, so the other pages can be brought to it
without anybody guessing. Every value below was read out of a real Chromium with
`getComputedStyle` / `getBoundingClientRect` at **1440x900, 390x844 and 320x640**,
and every screen was looked at as well as measured.

**Measured at:** git HEAD `965e084` (working tree snapshot, 2026-08-27), served
from a copy of the tree on `127.0.0.1:4903`. HEAD moved to `d8091f1` during the
pass; the only diffs to the nine pages were an `aria-checked` flip in the
time-of-day menu (no layout effect) and one `draft.html` change noted in §12.
`header.css`, `controls.css`, `tokens.css`, `footer.css`, `hero-time.css` and
`play.css` were byte-identical before and after.

**How to use it.** §§1–8 are the style. §9 is the one thing Jayden named by
hand (the tabs). §10 is where home disagrees with itself — do not "fix" those by
inventing a rule; ask. §11 is the per-page work list.

**Do not flatten:** the sky's 640ms cross-fade, the About dissolve's 680/1000/1200,
the spring `linear()` curves (`--sp-bounce` / `--sp-pop` / `--sp-settle`), the
hero h1's `line-height:1.06`. These are hand-tuned and load-bearing.

---

## 0 · One open question

> **The tabs' selected mark.** Jayden said "style the tabs the same as the
> header". The header marks the current page with **ink + weight and no ground**
> (2026-08-26: "the bolding of the letters is enough"). The tabs mark the
> selected one with **ink + weight + a 2px travelling underline** — which is also
> his, 2026-08-26: "just have an underline on the selected tab we use this type
> of thing in the case studies".
>
> §9 assumes **the underline stays** and everything else matches the header.
> If he wants the underline gone too, that is a one-line change
> (`.collection__tabs .csTabInk{display:none}`) and §9 is otherwise unaffected.

---

## 1 · The column

One content column, on every viewport, and everything that carries content
aligns to it.

| viewport | column | width | gutter | source |
|---|---|---|---|---|
| 1440 | **120 .. 1320** | 1200 | 120 | `--page-max` 1280 − 2×`--surface-gutter` 40, centred |
| 390 | **16 .. 374** | 358 | 16 | `--sp-16` |
| 320 | **16 .. 304** | 288 | 16 | `--sp-16` |

**Columned** (box lands exactly on the column):

| thing | 1440 | 390 |
|---|---|---|
| `.jbNav` (the header bar's box) | 120..1320 | 16..374 |
| `.cases.collection` | 120..1320 | 16..374 |
| `.csTabs` (the tab row) | 120..1320 | 16..374 |
| `.collection__content`, every `.csFrame` cover, every `.csMeta` | 120..1320 | 16..374 |
| `.footTop` and all footer content (`.footBrand`, `.footCopy`, `.footCol`) | 120..1320 | 16..374 |

**Full-bleed** (0 .. viewport):

| thing | why |
|---|---|
| `.jbStick` — the bar's white ground and its hairline floor | chrome is a band, not a card |
| `.hero` and the whole sky stack, including `.hero::after` (the structural rule) | the hero is the page's top band, not an object on the page |
| `.footTop::before` — the footer's rule, `width:100vw`, `left:50%` + `translateX(-50%)` | matches the hero's edge; same `--rule` token, so they are one line drawn twice |
| `.footBand` — the ASCII gradient strip | the page's last surface |

**The rule behind it, in one line:** a *boundary* takes the edges of the surface
it bounds; a *box that introduces column content* takes the column. This is why
the section rule under the hero was moved off `.csTabs`' top edge (where it ran
120..1320 under a full-bleed gradient and Jayden called it "a random line") and
onto the hero's own bottom edge, where it runs 0..1440.

**The one box that is neither:** `.siteFoot` on `index.html` and `play.html` is
a `<body>` child at **80..1360** carrying `margin-inline:80px` +
`padding-inline:40px`, so its *inner* edge lands on 120..1320. On `about.html`,
`draft.html` and the five case studies `.siteFoot` is already inside `.wrap` and
measures 120..1320 directly. Both routes end on the column; do not "unify" them.

**The bar's inner inset is 6px, and the ink is not on the column.** `.jbNav` is
120..1320 but has `padding-inline:6px`, so the mark's box starts at **126** and
Contact's ends at **1314**. The header aligns its *box* to the column and lets
the item padding hold the ink inboard. Remember this in §9.

---

## 2 · Vertical rhythm

Measured top-to-bottom on home. `y` is document-absolute.

### 1440

| join | gap | token |
|---|---|---|
| header bar height | **72** (`padding 8 / 12` + `.jbNav` 52) | `--sp-8` / `--sp-12` + `--nav-h` |
| bar → hero | **0** — `.wrap` has `margin-top:-72px`; the bar floats over the sky | — |
| hero block padding | **108 / 108** | `clamp(72px,12svh,112px)` |
| hero bottom → `.cases` | **16** | `--section-join-gap` (`--sp-16`) |
| above the tab labels | **16** | `--sp-16` |
| below the tab labels | **8** | `--sp-8` |
| tab row → first cover | **24** (8 padding + 16 margin) | `--sp-8` + `--sp-16` |
| cover → its `.csMeta` | **16** | `--work-meta-gap` |
| work item → next work item | **64** | `--work-item-gap` (`--sp-64`) |
| content pane bottom padding | **36** | local |
| work → footer | **112** | `--sp-56-112` |
| footer rule → footer content | **64** | `--sp-48-80` |
| footer content → band | **64** | `--sp-32-64` |
| footer's two columns | **64** apart | `--sp-48-80` |

### 390 / 320

| join | gap |
|---|---|
| hero block padding | **72 top / 48 bottom** — the top is `calc(--sp-8 + --nav-h + --sp-12)`, i.e. **exactly the bar's height**, so the copy clears it |
| hero → `.cases` | 16 |
| tab row | 16 above / 8 below / 16 margin (unchanged) |
| work item → work item | **40** (`--sp-40`) |
| content pane bottom | 28 |
| work → footer | **80** (`--sp-56-112` collapses at 880) |
| footer rule → content | 48 · content → band 32 · columns 64 |

### The rungs home actually uses

**Present:** 8 · 12 · 16 · 24 · 36 · 40 · 64 · 108 · 112 (desktop);
8 · 12 · 16 · 24 · 28 · 40 · 48 · 72 · 80 (phone).

**Never appear on home:** 2 · 4 · 6 · 10 · 14 · 20 · 30 · 32 · 48 (desktop) ·
56 · 72 (desktop) · 104 · 120.

Read that as the taste: home moves in **8 / 16 / 24** for anything inside a
component, **40 / 64** between components, and **112** for the one big break
before the footer. It does not use 32 or 48 at all on desktop, and it never uses
a 2/4/6/10/14 micro-gap in layout — those exist only inside controls.

---

## 3 · Type

Geist, **two weights only, 400 and 600**. Every size that appears on home, at
1440 unless stated:

| px | wt | leading | tracking | ink | role | token |
|---|---|---|---|---|---|---|
| **44** | 600 | **1.06** (46.64) | −.030em (−1.32) | white on sky | hero h1 | `--fs-heroline` → `--fs-pagehead` `clamp(30px,3.4vw,44px)`; lh is a **hand-tuned literal**; `--tr-hero` |
| **18** | 600 | normal | −.027em (−0.486) | `#090b24` | cover title `.csName` | `--work-title-size` → `--fs-lead` `clamp(15px,1.4vw,18px)`; `--tr-head` |
| **18** | 600 | 1.2 (21.6) | −.011em | `#111214` | `.footStatus` | `--fs-lead`; `--tr-title` |
| **15** | 600 | normal | −.011em (−0.165) | `#848591` | cover year `.csYear` | `--work-year-size` → `--fs-small`; `--tr-title` |
| **15** | 400 | 1.45 (21.75) | −.006em | `#686b73` | `.csImpact` (the one-line credit) | `--fs-small`; `--tr-body` |
| **15** | 600 | 1.45 | −.006em | `#111214` | `.footHead` ("Menu", "Contact") | `--fs-small` |
| **15** | 400 | 1 (flat) | −.006em | `#686b73` | footer links, skip link, `.ctl` labels | `--ctl-fs` → `--fs-small`; `--lh-flat` |
| **13** | 400 / 600 | 1 (flat) | **normal** | `#686b73` / `#111214` | header nav items | `--fs-nav`; `letter-spacing:normal` set explicitly at `header.css:545` |
| **13** | 400 / 600 | 1 (flat) | −.006em (−0.078) | `#686b73` / `#111214` | the work tabs | `--fs-nav`; `--tr-body` |
| **12** | 400 | 1.45 (17.4) | normal | `#686b73` | `.footCopy` | `--fs-label` |
| **11** | 600 | normal | **+.01em** (+0.11) | `#848591` | `.csInfoLabel` (Role / Problem / Solution) | `--fs-caption` |

At 390/320 the hero drops to **30/600/31.8/−0.9** (same 1.06, same −.030em), the
cover title to 15, `.footStatus` to 15/1.2, and header items to **12px, labels
hidden, icons only** (see §6). Nothing else moves.

**Six sizes carry the whole home page: 44 · 18 · 15 · 13 · 12 · 11.**
That is the "minimal" he is describing. Rungs the design system defines that
home does not touch: `--fs-display`, `--fs-hero` (50), `--fs-title` (40),
`--fs-h1`–`--fs-h5`, `--fs-prose` (18 as *body*), `--fs-tab`, `--fs-body` (15 as
running prose).

**Where `docs/apple-design.md` §15 is already satisfied.** Tracking is
size-specific and monotonic — 44px at −.030em, 18px at −.027em, 15px at −.011em,
13px at −.006em, 11px at **+.01em**. Leading tracks size inversely — 1.06 at 44,
1.2 at 18, 1.45 at 15/12, 1.0 flat on controls. Hierarchy is built from
weight + size + leading as a set (600 is used for *every* heading role and for
selection state; it is never used decoratively). **Do not re-derive these; copy
them.**

**One rule that is site-wide and often violated elsewhere:** control labels take
`--lh-flat` (line-height 1) and prose takes 1.45–1.5. A control with 1.5 leading
grows its box.

---

## 4 · Boundaries

Home separates things three ways and no others.

**1. The hairline.** `--rule` = `rgba(9,11,36,.10)` (dark: `rgba(255,255,255,.10)`),
`--rule-w` = 1px. Home draws **exactly two** structural hairlines:

| line | extents 1440 | extents 390 | how it is drawn |
|---|---|---|---|
| the bar's floor | 0..1440 | 0..390 | `.jbStick{box-shadow:rgba(9,11,36,.1) 0 1px 0 0}` — a shadow with **zero blur and zero offset**, which is a border, not elevation |
| the hero's bottom edge | 0..1440 | 0..390 | `.hero::after{border-bottom:1px solid var(--rule)}` |

Plus one non-structural line: `.csInfoRow{border-top:1px #E6E7E9}` (`--c100`)
inside the cover's hover info card.

There is **no** rule between the tab row and the covers, none between work items,
and none inside the work section. That job is done by space.

**2. Proximity.** The tab row and the first cover are 24px apart and the second
cover is 64px below the first: 24 says "these belong together", 64 says "new
item". Nothing is boxed to say it.

**3. The full-bleed edge.** The hero's sky ends and the page's `#FDFDFD` begins.
That colour change *is* the boundary; the hairline only sharpens it.

**Zero shadows on chrome.** The full surface census at 1440 finds no offset,
blurred shadow anywhere in home's chrome. What exists is:

- inset rims — `--ctl-rim` `rgba(17,18,20,.12) 0 0 0 1px inset` on the Contact
  pill, the time menu, `.csFrame`, the skip link; `--rim-2` `rgba(9,11,36,.14)`
  on `.csInfoCard`
- the bar's 0-blur hairline (above)
- `i.is-bright` — a 2px glow on three stars in the night sky (it is a picture)
- `.dshadow` — the companion head's contact shadow. **The only real shadow on
  the site**, and it is information: it says the head is standing on something.

---

## 5 · Controls — the header bar

### Anatomy at 1440

```
.jbStick   0..1440   h=72   position:sticky   bg #fff   floor: 0-blur 1px rgba(9,11,36,.10)
           padding 8px 40px 12px
  .jbNav   120..1320  h=52  bg transparent  padding-inline 6px  gap 8px
    .jbGrpL  flex:1 1 0, start   126..607   → the mark (or Back on case studies)
    .jbGrpC  flex:0 0 auto, centre  615..825  → Home · About · Play
    .jbGrpR  flex:1 1 0, end     833..1314  → time-of-day · Contact
```

The two outer zones take equal flex basis, which is what makes the centre group
truly centred regardless of what the sides hold.

### The item

| property | value | token |
|---|---|---|
| ink box height | **38px** | `--ctl-h-nav` |
| tap target | **44px**, via a transparent `::after` centred on the ink box | `--tap-min` |
| inline padding | **16px** | `--ctl-pad-nav` (`--sp-16`) |
| gap icon↔label | 6px | `--sp-6` |
| gap item↔item | **8px** | `--gap-item` (`--sp-8`) |
| radius | **999px** + `corner-shape:squircle` | `--r-pill`, `--corner` |
| font | 13px / 400 / lh 1 / **letter-spacing normal** | `--ctl-fs-sm` → `--fs-nav` |
| icon | 18px Lucide outline, stroke 1.75 | `--ico-md`, `--ico-stroke` |

### States

| state | ground | ink | weight | icon stroke |
|---|---|---|---|---|
| rest | none | `#686b73` (`--theme-muted`) | 400 | 1.75 |
| hover / `:focus-visible` | **`#f8f8f8` pill** (`--theme-elevated`) | `#111214` | **600** | **2.0** |
| current page (`aria-current`) | **none** | `#111214` | **600** | **2.0** |
| current + hover | *no change at all* — written `:not([aria-current])` | | | |
| `:active` | — | — | — | `transform:scale(.97)`, `.985` on the mark |

Timing: hover-**in** 160ms (`--dur-state`), hover-**out** 240ms
(`--dur-state-out`) — a control answers immediately and lets go gently.
`font-weight` is deliberately **not** in the transition list; it snaps, the
ground and ink glide. Weight 400→600 costs 0.7px of label width, measured, which
is below the threshold at which anything reads as movement.

**The current page has no ground.** This is 6 days old (2026-08-26): the pill was
1.25:1 against the bar and the ink/weight pair is 7.8:1 → 16.6:1, so the pill was
the weaker of two markers and it was the duplicate. Do not put it back.

### How the right-hand cluster differs from the centre

| | centre destinations | time-of-day | Contact |
|---|---|---|---|
| shape | 38px pill, no rim | 38px pill, no rim | 38px pill, **`--ctl-rim` inset hairline** |
| content | icon + label | icon only (18px sun/moon) | icon + label |
| ink at rest | `#686b73` | `#686b73` | `#686b73` |
| hover ground | `#f8f8f8` pill | same, plus `[aria-expanded="true"]` | same |
| marks a page | yes (`aria-current`) | no — it sets `data-theme-mode` on `<html>` | no |
| width @1440 | 68 / 68 / 58 | 44 | 79 |

**The rim is the whole distinction.** The three centre items are *destinations*
and wear nothing at rest. Contact is an *action* and carries a hairline rim so it
reads as a button in a row of links. The time control is a *setting* and is
icon-only. One rim in the bar, and it is on the only thing that is not
navigation.

### The mark

`.jbHome` never takes the pill and never takes the lit treatment — "a grey pill
round a logo is the one place the fill reads as chrome clutter". It keeps
ink-only hover. On the five case studies the Back arrow **replaces** it in the
same slot, at `--ico-mark` 22px, so the leading control's centre is identical on
all nine pages.

### Below 640px

Labels drop (`.jbLbl{display:none}`), items become 44×38 icon-only, font-size
`--fs-label` 12px, padding `0 8px`, gap 8, icons 16px. Every item keeps its
`aria-label`. Measured: an all-text bar is 358.7px against 358 available at 390,
so glyphs are arithmetic, not preference.

---

## 6 · Radius

| rung | value | where on home |
|---|---|---|
| `--r-pill` | 999 | every header nav item, the Contact pill |
| `--r-xl` | 28 | the reel's overlay video (the only 28 in the flow) |
| `--r-lg` | 20 | `.csFrame` covers, `.csImg`, the time menu, `.csInfoCard` |
| `--r-md` | 14 | `.csTab` (declared, never painted — no ground), skip link, `.footBrand`, time-menu rows, focus rings |
| `--r-2xs` | 3 | `.csYear` in the WIP state, `.dlogo`, the cursor chips |
| `--r-full` | 50% | the head's eyes, pupils, glints |
| **0** | | `.hero`, `.jbStick`, `.cases.collection`, `.csTabs`, `.collection__content` |

**The rule:** something that becomes the *environment* leaves the ladder rather
than taking a compromise rung. `--surface-hero-radius` is **0** — Jayden,
2026-08-20: "on both versions the bottom of the hero shouldn't be curved, should
go straight across." A 28px corner would make a full-bleed boundary stop 28px
early at both ends and read as a card's lip instead of a section's edge. The same
reasoning zeroes `.cases.collection` (no fill, no rim → no corners to round) and
`.collection__content`.

**Corollary already shipping:** the first cover's *top* two corners are squared
(`.collection__content .csItem:first-child :is(.csImg,.cover,img)`) so the
picture meets the tab row's baseline instead of showing white through two arcs.
Only the first item, only the top pair.

Always pair a radius with `corner-shape:var(--corner)` (squircle). A `--r-pill`
clamped to half a 38px box **with** squircle reads as a soft rounded rectangle,
not a capsule — that is why the bar's pill is not a stadium.

---

## 7 · Colour

`--accent` is **ink `#090b24`**. Blue is dead. Never rebind `--accent` locally.

| colour | token | used on home for |
|---|---|---|
| `#FDFDFD` | `--c50` / `--theme-page` | the page |
| `#FFFFFF` | `--theme-surface` | the bar's ground, the content pane |
| `#f8f8f8` | `--theme-elevated` | the nav hover pill — **the only fill in home's chrome** |
| `#111214` | `--theme-ink` | chrome + control ink: current nav item, selected tab, `.footHead`, `.footStatus` |
| `#090b24` | `--c950` / `--accent` | content ink: `.csName`, the hero's own `color`, the tab underline |
| `#686b73` | `--theme-muted` | resting nav ink, resting tab ink, footer links, `.csImpact`, `.footCopy` |
| `#848591` | `--c500` | `.csYear`, `.csInfoLabel` — the quietest legible grey |
| `#E6E7E9` | `--c100` | `.csInfoRow`'s hairline |
| `rgba(9,11,36,.10)` | `--rule` | the two structural hairlines |
| `rgba(17,18,20,.12)` | `--theme-rim` | every inset rim |

**Hue appears in exactly two places: photography and the time-of-day sky.** The
covers are photographs with palettes matched to each product's UI; the hero
gradient is the clock. Nothing in the chrome is chromatic. The one exception is
`--selection-ink` `#64a5dd` on the portrait's drag frame, which only exists while
the head is grabbed.

See §10 for the `#111214` / `#090b24` collision.

---

## 8 · Motion, briefly

The ladder — use the rungs, do not invent numbers:

`--dur-press` 100 · `--dur-state` 160 · `--dur-state-out` 240 · `--dur-move` 280
· `--dur-reveal` 360 · `--dur-enter` 500 · `--dur-intent` 120 (a *delay*).

Home's own uses: nav hover in 160 / out 240; press `scale(.97)` at 100ms; the tab
underline travels on `--sp-settle` at its bound 360ms; the panel cross-fade 420ms.

**Not to be flattened:** the sky's 640ms cross-fade, the About dissolve's
680/1000/1200, and the `linear()` spring curves themselves.

---

## 9 · The tabs, styled as the header

*(Jayden: "the tabs i think we should style them the same as the header.")*

### Where they stand now — measured, at HEAD `965e084`

The premise that "the tabs show a filled ground on the selected item" is **no
longer true**. The tab row is already transparent (`.cases.collection
.collection__tabs{background:transparent}`), the selected tab already carries no
fill, and selection is already ink + weight 600 + a travelling 2px underline.
That work landed 2026-08-26.

What is left is a **box-and-rhythm mismatch**, not a colour one:

| property | header `.ctl--nav` | tabs `.ctl--tab` in `.cases.collection` | same? |
|---|---|---|---|
| font-size | 13px (`--fs-nav`) | 13px (`--fs-nav`) | ✅ |
| weight rest / selected | 400 / 600 | 400 / 600 | ✅ |
| rest ink | `#686b73` | `#686b73` | ✅ |
| selected ink | `#111214` | `#111214` | ✅ |
| letter-spacing | **normal** | **−.006em** (−0.078px) | ❌ |
| ink box height | **38px** | **44px** | ❌ |
| tap target | 44px via `::after` | 44px (the real box) | ✅ in effect |
| inline padding | **16px** | **12px**, and **0** on the first item | ❌ |
| item gap | **8px** | **2px** | ❌ |
| radius | 999px + squircle | 14px (never painted) | ❌ |
| hover | **`#f8f8f8` pill** + ink + weight 600 | **ink only, no ground** | ❌ |
| selected mark | ink + weight, no ground | ink + weight + 2px travelling underline | see §0 |
| icons | 18px Lucide | none | ❌ (leave it — the tabs have no icons and should not gain any) |

### The rule to apply

Everything lives in **`controls.css`**, in the existing `.cases.collection`
scope — that is the file that wins the cascade against `index.html`'s inline
`<style>`, and it is where the tab's geometry already is. Do not write these in
`index.html`; six of the seven would lose an equal-specificity tie and silently
do nothing (§10).

```css
.cases.collection .collection__tabs{
  gap:var(--gap-item);                       /* 2px  -> 8px  */
}
.cases.collection .collection__tabs>.ctl--tab{
  min-height:var(--ctl-h-nav);               /* 44px -> 38px */
  padding-inline:var(--ctl-pad-nav);         /* 12px -> 16px */
  border-radius:var(--r-pill);               /* 14   -> 999  */
  corner-shape:var(--corner);
  letter-spacing:normal;                     /* -.006em -> normal, matching header.css:545 */
}
/* the first item stops being flush — see the trade below */
.cases.collection .collection__tabs>.ctl--tab:first-child{padding-inline-start:var(--ctl-pad-nav)}

/* hover becomes the bar's pill. Reverses the "NO HOVER GROUND ON A CONTENT TAB"
   note above it: that note's own argument is "the pill on nav tabs, ink-and-
   weight everywhere else" — this row is being made a nav tab. */
.cases.collection .collection__tabs>.ctl--tab:hover:not([aria-selected="true"]),
.cases.collection .collection__tabs>.ctl--tab:focus-visible:not([aria-selected="true"]){
  background:var(--theme-elevated,var(--c75));
  color:var(--ctl-ink-strong);
  font-weight:600;
  transition:background-color var(--dur-state) var(--ease-out);
}
```

Three things that must **not** change with it:

1. **The 44px target survives.** `index.html:1872` already declares
   `.csTab::before` as a transparent `--tap-min` expander centred on the ink box —
   the same technique `.ctl--nav::after` uses. Shrinking the ink box to 38 is
   therefore free. Do **not** touch `.csTab::before`, and do **not** remove
   `.cases.collection .collection__tabs>.ctl--tab::after{content:none}` — that
   `::after` is the retired per-tab underline, and re-enabling it would give the
   row two selection marks.
2. **`.csTabInk` stays** unless §0 is answered otherwise. It travels on
   `--sp-settle` / 360ms, which is a rung, and it re-targets from the presentation
   value — the interruptibility `apple-design.md` §3 asks for.
3. **Do not copy the header's `<640px` font-size drop to 12px.** The header goes
   to 12 to fit five items plus a mark in 288px; the tab row has three items and
   fits at 13.

### The one real trade, with the number

Today the first tab has `padding-inline-start:0`, so **"Featured"'s ink starts at
120 — dead on the column, and dead on the left edge of the cover below it.**
A hover pill needs symmetric padding or it looks lopsided (controls.css says
exactly this, and it is why the flush start was allowed in the first place).

Adopting the header's uniform 16px moves it:

| | now | after |
|---|---|---|
| "Featured" ink starts at (1440) | **120** | **136** |
| "Featured" box | 120..187.1 (67.1 wide) | 120..207.1 (87.1) |
| "Case Studies" box | 189.1..290.4 | 215.1..324.4 |
| "Extras" box | 292.4..353.7 | 332.4..401.7 |
| row width | 233.7 | **281.7** |
| row width at 320 (288 available) | 233.7 | **281.7** — fits, 6.3px of slack |

**This is the header's own behaviour, not a regression:** `.jbNav`'s box is on
the column at 120 and its mark's ink is at 126. The bar aligns its *box*, not its
*ink*. But it does mean the tab label no longer lines up with the cover's left
edge, and Jayden looks at that edge.

**Recommended:** apply it as written and show him. If the 16px indent reads
wrong, the fallback is to keep the ink-only hover on the tabs and take only the
box, padding, gap, radius and tracking from the header — six of the seven
mismatches, and the flush start survives.

---

## 10 · Where home disagrees with itself

Stated rather than papered over. None of these are urgent; all of them are real.

**a. Two blacks, 16px apart on screen.** The chrome layer runs on
`--theme-ink` **`#111214`**; the content layer runs on `--c950` / `--accent`
**`#090b24`**. On the work section the selected tab "Featured" is `#111214` and
the cover title "Bearings" directly under it is `#090b24`. Same for the muted
pair: `--theme-muted` `#686b73` vs `--c500` `#848591`, both in use as "quiet
grey" within one screen. Two systems, one page. Pick one before an agent
"harmonises" them by guessing.

**b. Three of `index.html`'s `.csTab` colour declarations are dead.** Lines
711–713 set `color:var(--c500)`, `:hover{color:var(--c950)}` and
`.on{color:var(--c950)}`. Measured computed values are `#686b73`, `#111214`,
`#111214` — i.e. `controls.css`'s `.ctl--tab` rules win every one of them
(equal specificity, later file). The file reads as though the tabs are on the
`--c*` ramp; they are on the `--theme-*` ramp. This is the exact trap CLAUDE.md
§6 warns about, sitting in the live code.

**c. `--fs-hero` is defined and never used on home.** `index.html:90` declares
`--fs-hero:clamp(33px,4.1vw,50px)` with a long comment; the hero actually runs on
`--fs-heroline` → `--fs-pagehead`. The bare `h1{}` rule at :165 that consumes it
never matches a visible element on this page.

**d. `.reel` renders 0×0.** The reel section is in the markup at :2776 and
measures zero at every viewport. Either it is meant to be gone (delete it) or it
is broken (fix it) — it should not be neither.

**e. `:root.jbShrunk .jbStick.isFixed{padding-block:14px 6px}` never runs on
home.** The bar is `position:sticky`, so it never gets `.isFixed`; `jbShrunk` is
applied to `<html>` on scroll and nothing changes. Measured identical at scroll 0
and scroll 900.

**f. `.csTab` declares `border-radius:14px` and can never paint it** — the tabs
have no ground in any state. Harmless today; §9 replaces it with 999px, which
*will* paint on hover.

---

## 11 · Per-page divergence list

Everything below is a measured difference from §§1–8. Sorted by page, most
consequential first within each. Measurements at 1440 unless stated.

### `about.html`

1. **The prose runs a 616px measure, not the column.** `.abBody` and every
   `.abSec` measure **120..736**; `.abShots` measures **800..1320** (520 wide);
   `.abGrid` gap 64. Home has a single 1200 column. This is About's own
   two-column layout and is probably deliberate — but it is the largest visual
   difference between the two pages and Jayden should confirm it stays before
   anyone else touches it. *(Note: CLAUDE.md's "prose runs the full column" ruling
   is about the **case studies**, not About.)*
2. **Body copy is 18px/400/27/`normal`** (`--fs-prose`, `--lh-prose`) in
   `#090b24`. Home has no 18px running text at all — its 18px rung is a 600-weight
   title. Nothing to change necessarily, but note that About's body tracking is
   `normal` while every other 15px+ role on home carries `--tr-body`.
3. **The h1 is the same size as home's and set differently.** About:
   44 / 600 / **47.52 (lh 1.08)** / **−1.188 (−.027em)**. Home:
   44 / 600 / **46.64 (lh 1.06)** / **−1.32 (−.030em)**. Two settings of one size,
   16px apart in the type scale. Home's is the tuned one.
4. Off-rung spacing: `.abLinkRow{gap:12px}` (site rung is 8), `.abCap{margin-top:10px}`
   (rungs are 8 / 12 / 16), `.abGrid{padding-top:48px}` at 1440 / 32 at 390 — home
   never uses 48 as a desktop gap.
5. At 390 the grid collapses to one column with `gap:48px 32px`; `.abShot`
   becomes 16..374. Correct, no action.
6. Header, footer and column: **identical to home.** `.jbNav` 120..1320,
   `.siteFoot` 120..1320, `.footTop` padding 64/64, `margin-top:112`. Do not touch.

### The five case studies — `apollo` · `bearings` · `cluster` · `strata` · `ucdavis`

1. **`.tvTabs` is the old tab treatment and it is the loudest divergence.**
   Measured on apollo / cluster / ucdavis: the row has a **white ground**
   (`rgb(255,255,255)`) 120..1320 with `padding:8px`, and its tabs are **16px**
   (vs home's 13), `padding-inline:16px`, `gap:8px`, `justify-content:center`,
   with a **per-tab `::after` underline that scales in place** rather than
   travelling. They also still take the base `.ctl--tab` **grey hover ground**,
   because the "no hover ground" rule is scoped `.cases.collection`. This is
   precisely the "why do the tabs have a different background colour" complaint,
   still shipping one page over. Bring `.tvTabs` to whatever §9 settles on, minus
   the centring.
2. **Section rhythm is 104px, not 64.** `.sec{padding-top:var(--sp-72-144)}` →
   104 desktop / 72 phone. Home's largest in-section gap is 64 and its largest
   gap of any kind before the footer is 112. Nothing is wrong with 104, but it is
   a rung home never uses, and it makes the case studies feel airier than the
   page they hang off.
3. **Five heading sizes against home's two.** `.head` 40/600/48 (lh 1.2)/−.027em ·
   `.secHead` 30/600/32.4 (lh 1.08)/−.021em · `.subHead` 26/600/28.08/−.021em ·
   `.secBody` 18/400/27/`normal` · `.eyebrow` 12/600/18/`normal`. Plus
   `.statNum` at **40/400** — the only large 400-weight type on the site.
   The h1 is 40 where home's is 44 and About's is 44.
4. **The column is right and the brief's guess was wrong.** `.layout`, `.content`,
   `.sec`, `.head`, `.siteFoot` all measure **120..1320** at 1440 and 16..374 at
   390 — the same column as the header. `.wrap` is 80..1360 with 40px padding.
   *(`footer.css`'s comment claiming `.siteFoot` is 160..1280 on case studies is
   stale — measured 120..1320.)* No indent to fix.
5. Inner measures that are *not* the column and are deliberate: `.cap` and
   `.baText` at `max-width:680px` centred (380..1060), `.stat` at `max-width:540px`
   (120..660), `.baGrid` two 270px columns centred. The **running prose**
   (`.secBody`) does run the full 1200 column — that is Jayden's explicit ruling,
   do not add a measure to it.
6. `.rail` is gone (`ABSENT` at 1440 and 1600). Its tokens (`--rail-w`,
   `--rail-gutter`, `--rail-gap`) still sit in `tokens.css` with no consumer.
7. Header, footer: identical to home, plus the Back arrow replacing the mark in
   `.jbGrpL`. Correct.

### `play.html`

1. **Its gutter is 24px, and it has two columns at once.** `main` and `.wrap`
   are full-bleed 0..1440 with `padding:24px 24px 0`; `.pCards`, `.siteFoot`'s
   inner content and `.footTop` are on **120..1320**. So the page holds a 24px
   gutter and a 120px gutter simultaneously. At 390: `main` padding 20/16/20.
   Pick one — the column.
2. **The header is different from every other page's.** Play is the only page
   with a **fourth centre destination ("Workspace")** and the only page with **no
   time-of-day control** in `.jbGrpR`. Measured across all nine pages: eight run
   `home · about · games · contact` with `heroTimeBtn`; play runs
   `home · about · games · workspace · contact` without it. If the bar is one
   component on every page, this is the exception to resolve.
3. **The h1 is 35px** (`--fs-pagehead-sm` `clamp(27px,7.2vw,35px)`) / 600 / 37.8
   (lh 1.08) / −.027em, with `margin-top:88px` at 1440 and 56 at 390. Home 44,
   About 44, case studies 40, play 35, draft 35 — **four page-head sizes across
   five page types.**
4. **The cards are a 1px-gap table, radius 0.** `.pCards` is a grid on an
   `rgba(9,11,36,.1)` ground with `gap:1px`, so the ground shows through as
   hairlines; each `.pCard` is `#FDFDFD`, **radius 0**, no rim,
   `padding:16px 20px 20px` (12/16/16 at 390). Home's equivalent objects (covers)
   are `--r-lg` 20 with `--surface-rim`. The hairline-through-the-gap device is
   consistent with §4; the radius-0 card and the 20px padding are not on the
   ladder (§2 uses 16 / 24, not 20).
5. `.pCardT` 15/600/16.2 (lh 1.08)/−.011em and `.pCardD` 11/400/16.5/−.006em —
   an 11px *body* rung home does not have (home's 11px is a 600-weight label).
6. Two vertical hairlines run the full height of the page at x=120 and x=1320
   (`.playViewport`'s edges). Home draws no vertical rules anywhere.
7. Footer: identical to home (80..1360 box, 120..1320 inner, `margin-top:112`).
   Correct.

### `draft.html`

1. **The content column is 800px wide and left-aligned inside a 1200px wrap.**
   `main.dbCol` measures **120..920** at 1440, leaving 400px of empty page to its
   right while the header, the footer and both hairlines run past it. Every other
   page fills the column. This is the single biggest structural divergence on the
   site.
2. **Body copy runs at 12px and labels at 11px.** `--fs-label` (12) is the size of
   `.dbMoreIn p`, `.dbEyebrow`, `.dbLbl`, `.dbCtx .at`, `.dbClock .sub`;
   `--fs-caption` (11) carries `.dbRank`, `.dbPos`, `.dbTeam`, `.dbFlag`,
   `.dbKind`, `.dbSrc`, `.dbFig .l`. Census at 1440: **20 elements at 12px and 4
   at 11px carrying running prose**, in `#3F424A` / `#686b73`. On home, 12px is
   used once — the copyright line — and 11px once, as a 600-weight label.
   *(In flight at `d8091f1`: `.dbWhy` was just lifted from `--fs-label` to
   `--fs-body`. That is the right direction; the rest of the page has not moved.)*
3. **It is the only page with uppercase type.** `.dbEyebrow` / `.dbLbl`
   12/600/`--tr-caps` +0.24px `text-transform:uppercase`, and `h3` / `.dbKind`
   11/600/+0.22px uppercase. Home's one label role (`.csInfoLabel`) is 11/600 at
   +0.01em and **not** uppercase.
4. **It is the only page that sets a base font-size.** `.wrap` carries
   15px/22.5/−0.09, which even the header inherits (`.jbNav` computes
   `font-size:15px`; harmless only because `.ctl` re-declares it). Every other
   page leaves the base at 16.
5. **`.siteFoot{margin-top:80px}`** at 1440 and 56 at 390, against 112/80
   everywhere else. One rung short of the site's biggest break.
6. `.dbSlots{gap:4px}` — the twelve seat buttons are 4px apart. `--gap-item` is 8,
   and header.css's mobile note says 4px between same-size targets means adjacent
   targets effectively touch. At 390 the row wraps to two rows, 92px tall.
7. Rules that stop at 920 (`.dbSlotSect` bottom edge, the `.dbMore` divider) while
   the header's floor runs 0..1440 — the same "random line" geometry Jayden
   objected to on home in §1.
8. Header, footer content, `.footBand`: identical to home apart from item 5.

---

## 12 · Quick checklist for an applying agent

- Column: **120..1320 / 16..374 / 16..304.** If a content box is not on it, it
  needs a reason.
- Gutters: **40 desktop, 16 phone.** Not 24, not 20.
- Spacing: **8 / 16 / 24** inside a component, **40 / 64** between, **112** before
  the footer. No 32 or 48 on desktop.
- Type: **six sizes**, two weights, tracking negative and shrinking with size,
  leading 1.06 → 1.2 → 1.45 → 1.5 as size falls, `--lh-flat` on control labels.
- Boundaries: **`--rule` hairlines at full-bleed edges, space everywhere else.**
  Zero shadows on chrome; the companion heads are the only exception.
- Radius: 999 controls · 20 media · 14 the rest · **0 for anything that becomes
  the environment.** Always with `corner-shape:var(--corner)`.
- Colour: ink, two greys, one `#f8f8f8` hover fill. Hue only in photographs and
  the sky.
- Controls come from `controls.css`. Write the fix where the cascade lets it win
  — `controls.css` links **after** `index.html`'s inline `<style>`, so an
  equal-specificity rule there always beats one written in the page (§10b is the
  live proof).
- Prove a rule is live by reading `document.styleSheets[…].cssRules`, and prove
  a look by opening the screenshot. Counting is not looking.
