# The control system — one rhythm for every button, tab, marker and field

2026-08-03. Companion to `2026-08-02-design-tokens.md` (radius / motion / material /
type) and `2026-08-03-header-v2-research.md` (`header.css`, which is the first and
so far only correct implementation of what is written below).

**Status: ship gate.** Jayden, 2026-08-03: *"The button spacing and padding needs to
look good and be consistent. These are all things that are important to fix before
shipping."* Nothing merges until this exists and is applied. Every value below is
exact and every decision is made — §10 is the token table an implementer copies, and
there is no row in it that says "pick one".

**The three quotes this document answers:**

> *"Buttons and such need a consistent design. Tab buttons, regular buttons, markers
> — they all look different. They should all have that premium system behind them
> that makes everything look a part of the same site."*
>
> *"Spacing has to be premium, and the hover animation has to feel premium and
> consistent site-wide."*
>
> *(on the socials)* *"in the same style and design system"* as the nav items.

`button-system.html` renders every kind in every state at desktop and 390px with the
resolved numbers printed beside each control.

---

## 0. The measured problem

Read off **live computed styles**, not declarations — several of these classes are
overridden three and four times down the cascade and the declarations lie.

### 0.1 Geometry — one page, at 1280px

`index.html`, 28 visible interactive elements:

| | distinct computed values | what they are |
|---|---|---|
| height | **8** | 20 · 22 · 32 · 36 · 38 · 40 · 44 · 600 |
| padding | **7** | `0` · `0 10px` · `0 8px` · `0 0 12px` · `8px 16px` · `12px 16px` · `0 12px 0 11px` |
| border-radius | **3** | `4px` ×12 · `0` ×8 · `999px` ×8 |
| border | **5 combinations** | `0` in four different colours, plus `1px #E6E6E6` |

`play.html`: 13 controls, 5 heights (38 · 40 · 42 · 43 · 44), 4 paddings, 2 radii.
`gradientlab.html`: 45 controls, 7 heights, **not one of them 44px** — the tallest
control in the Lab is 40px and `.miniBtn` measures **23.5px**.

### 0.2 Motion — the whole site

Every `transition` declaration across `index.html`, the five case studies,
`play.css`, `header.css`, `headmaker.html`, `gradientlab.html`, `play-games.js`:

| | count | distinct |
|---|---|---|
| **transition declarations** | 511 | — |
| **durations** | — | **30** |
| **easings** | — | **15** |
| of which, on **control** selectors | 171 | **10** durations, **4** easings |

Durations, by frequency: `200ms`×91 · `500`×86 · `160`×64 · `250`×53 · `375`×43 ·
`300`×29 · `180`×20 · `150`×19 · `100`×16 · `0`×8 · `700`×8 · `340`×8 · `120`×8 ·
`140`×8 · `400`×7 · `260`×6 · `550`×6 · `125`×5 · `80`×4 · then 11 more singletons
(`70` `280` `320` `350` `380` `420` `450` `600` `800` `950` `1150`).

Easings: `cubic-bezier(.2,.8,.2,1)`×378 · `steps(2,end)`×24 · `ease-out`×16 ·
`ease`×12 · `cubic-bezier(.22,.61,.36,1)`×6 · `linear`×4 · `steps(2)`×2 · then
8 one-off beziers.

Separately, **126 `animation:` declarations across 51 distinct durations** (60ms to
22 000ms). Those are the game, the celebration and the hero — §5.5 carves them out
explicitly. They are not UI motion and must not be forced into the scale.

**Only two motion tokens are consumed today:** `--ease-out` and `--ease-out-dur`.
`--press-dur`, `--enter-dur`, `--sp-quick`, `--sp-settle`, `--sp-pop` and
`--sp-bounce` all exist in `tokens.css` and have **zero** consumers on a control.

### 0.3 The sharpest motion finding, quantified

`ease-out` and `cubic-bezier(.2,.8,.2,1)` are used side by side and **are not the
same curve.** `ease-out` is `cubic-bezier(0,0,.58,1)`. Solved numerically:

| fraction of duration elapsed | `cubic-bezier(.2,.8,.2,1)` | `ease-out` | delta |
|---|---|---|---|
| 10% | 0.397 | 0.161 | **+0.236** |
| **25%** | **0.767** | **0.378** | **+0.389** |
| 50% | 0.946 | 0.685 | +0.261 |
| 75% | 0.991 | 0.907 | +0.085 |
| | **50% of travel at t=0.13** | 50% at t=0.34 | |
| | **90% of travel at t=0.39** | 90% at t=0.74 | |

At a quarter of the way through, the house curve has covered **77%** of the distance
and `ease-out` has covered **38%**. They diverge by nearly 39 points of travel.

**It is already visible on the site.** In the mood menu: `.moodItem` is
`transition: background-color .1s ease-out, color .1s ease-out`, and `.moodGo` —
the row immediately below it, in the same menu, at the same size — is
`transition: background-color var(--ease-out-dur) var(--ease-out)`. **Two adjacent
rows of one menu, on two different curves at two different durations.** Nothing
about them looks different at rest and they do not feel the same on hover.

### 0.4 Three findings that are not "inconsistency", they are bugs

**(a) `--accent` is rebound to green on two pages, and the controls do not know.**
`tokens.css` binds `--accent: #2961CE`. `play.css:53` and `gradientlab.html` both
re-declare `:root{--accent:#0E6B3B}` — deliberately, and documented in play.css.
Measured in the Lab: `getComputedStyle(document.documentElement).getPropertyValue
('--accent')` returns **`#0E6B3B`**, so `.btn:focus-visible{outline:2px solid
var(--accent)}` draws a **green focus ring in Gradient Lab and a blue one
everywhere else**. Any control rule written against `var(--accent)` inherits this.

**(b) The tab underline curves.** `apollo.html` sets `.tvTab.on{border-bottom:2px
solid var(--accent)}` on a box whose computed `border-radius` is `14px`. A bottom
border on a 14px-radius box is not a rule under a word; it is a swoosh that tapers
away 14px before each end.

**(c) A tab is not a target.** `.csTab` on `index.html` measures **35.5 × 73px** at
1280 with `padding: 0 0 12px` and no hit-area expansion. It is the primary
navigation of the work section and it is 8.5px short in both axes.

### 0.5 The one thing that is already right

`header.css` §1 is the system. It already ships a 38px ink box inside a 44px
`::after` hit area, hover that changes ink only, selection carried on three axes
so it never depends on a hover wash, one focus treatment, one press scale, one
transition. Everything below is `header.css` generalised — which is why the
migration is smaller than the class count suggests.

---

## 1. The taxonomy — 40 classes, six kinds

Enumerated from markup and CSS across `index.html`, the five case studies,
`play.css`, `play-games.js`, `headmaker.html`, `gradientlab.html`, `header.css`.

| Kind | What it is | Classes today |
|---|---|---|
| **1 · Primary** | The one action this view exists for. A filled ground. | `.workCta` `.abTalk` `.abLinkPrimary` `.hmBtn.hmBtnPrimary` `.tGo:not(.tGoQuiet)` `.teamStart` `.btn` (lab) |
| **2 · Secondary** | A real action with a boundary. A hairline rim, no fill. | `.aboutCta` `.moodBtn` `.abLink` `.hmBtn.ghost` `.tGo.tGoQuiet` `.toTop` `.sbBtn` `.skipLink` `.reelClose` `.reelTap` `.teamMini` `.hmPitX` `.miniBtn` `.copy` `.navDrawerX` `.hmZoom` |
| **3 · Quiet** | An action with no box at all. Ink and space. | `.moodItem` `.moodGo` `.moodTeamsBtn` `.mhToggle` `.mhPick` `.hmBtn` (bare) `.hmScoreEnd` `.hmPitPick` `.csGo` `.chap` `.footIn` `.back`/`.backlink` `.talk` `.ndLink` `.abBack` `.jbNav a` `.jbBack` `.jbHome` + **every nav item, menu row and social row in the header rebuild** |
| **4 · Tab** | One of a set; exactly one is selected. | `.csTab` `.tvTab` |
| **5 · Chip / marker** | A label. Usually **not** a target. | `.baChip` `.baLabel` `.tCardTag` `.battleBadge` `.hmName` `.teamHint` |
| **6 · Field** | Something you type in or pick from. | `select` `input[type=text]` (`.hmName`), the Lab's numeric boxes |

Everything else that looks like a difference is a **modifier** (§4) or a
**composition** (§6) — not a kind. That includes the three patterns the header
rebuild is inventing: a split control is a Quiet control with a caret (§6.1), a
travelling indicator is a Tab row's shared `::before` (§6.2), and a menu row is a
Quiet control with `.is-row` (§6.3).

### 1.1 Where two classes are the same kind and the looks disagree

| Conflict | Winner | Why |
|---|---|---|
| Primary is `--accent` blue (`.workCta`, `.abTalk`) **vs** `--c950` near-black (`.tGo`, `.hmBtn.hmBtnPrimary`, `.teamStart`, `.btn`) **vs** `--c900` (`.abLinkPrimary`) | **Blue** | Standing call: the interactive accent is `#2961CE` and primary buttons take it. Black is the *page's* ink; a button in page ink is a rectangle of text, not an action. Biggest visible change in the document — §7. |
| Secondary is `1px solid --c100` + `--c50` fill (`.abLink`, `.moodBtn`, `.aboutCta`) **vs** `1px solid rgba(8,8,8,.16)` (`.tvTab`) **vs** no boundary at all (the shared "unify" block: *"no borders. The wash is the affordance."*) | **A `--rim-1` inset hairline, no fill** | (i) A `--c50` fill on a `--c50` page is a fill of nothing. (ii) A `border` participates in layout and is why `7px 11px` and `8px 16px` disagree by 1px; a `box-shadow` rim does not. (iii) The "wash is the affordance" comment is now false — the wash is being removed, so a control with no border and no wash has **nothing**. The rim is what replaces the wash. |
| Icon-only is a **circle** (`.toTop`, `.sbBtn`, `.hmPitX` at `50%`) **vs** a **square** (`.teamMini` at `6px`) | **The same `--r-md` as everything else** | Radius is a function of the box and of its container, never of whether the content is a glyph. Flagged for his eye — §11 item 5. |
| Tab selection is an **underline** (`.tvTab.on`) **vs** an **accent-wash pill** (`.jbNav [aria-current]`) | **Underline**, with the nav reclassified as navigation rather than tabs | §3.4, §11 item 4. |
| Marker is `1px solid --c100` + `--c50` fill (`.baLabel`, `.baChip`) **vs** bare ink | **Bare ink** | A marker is not a target; a boundary around a non-target is decoration. The purest *subtract* in the set — §3.5. |

---

## 2. The shared base

**This is the whole idea.** The premium read comes from every control on the site
sharing a height, a padding rhythm, a curve and a focus treatment — not from any
one of them being individually nice. So the base is large and the kinds are small.

### 2.1 The base rule

```css
.ctl{
  /* box — height is min-height, NEVER vertical padding */
  display:inline-flex; align-items:center; justify-content:center;
  box-sizing:border-box;
  min-height:var(--ctl-h);
  padding-block:0;
  padding-inline:var(--ctl-pad);
  gap:var(--ctl-gap);
  border:0;                                   /* the rim is a box-shadow, never a border */
  border-radius:var(--ctl-r); corner-shape:var(--corner);
  background:none; box-shadow:none;

  /* type */
  font-family:var(--sans); font-weight:400; font-size:var(--ctl-fs);
  line-height:var(--lh-flat); letter-spacing:var(--tr-body);
  color:var(--ctl-ink);
  white-space:nowrap; text-decoration:none;

  /* behaviour */
  position:relative; cursor:pointer; -webkit-tap-highlight-color:transparent;
  filter:none;                                /* the case studies put url(#inkSm) on chrome text */

  /* MOTION — the property set is closed (§5.3) and the duration here is the
     hover-OUT. The hover-IN is the shorter one, set on :hover below. */
  transition-property:color, background-color, box-shadow, text-decoration-color, transform;
  transition-timing-function:var(--ease-out);
  transition-duration:var(--dur-state-out);            /* 240ms */
}
.ctl .gIco{width:var(--ico-md);height:var(--ico-md);flex:0 0 var(--ico-md)}

.ctl:hover,
.ctl:focus-visible,
.ctl[aria-selected="true"],
.ctl[aria-current],
.ctl[aria-expanded="true"] { transition-duration:var(--dur-state) }   /* 160ms — the IN */
.ctl:active                { transition-duration:var(--dur-press) }   /* 100ms */

.ctl:hover                      { color:var(--ctl-ink-strong) }
.ctl:active                     { transform:scale(var(--press-scale)) }
.ctl:focus-visible              { outline:var(--focus-w) solid var(--ctl-ink-strong);
                                  outline-offset:var(--sp-2) }
.ctl:focus:not(:focus-visible)  { outline:none }
.ctl[disabled],
.ctl[aria-disabled="true"]      { opacity:var(--ctl-disabled-o); cursor:default }
.ctl[disabled]:hover            { color:var(--ctl-ink) }
.ctl[disabled]:active           { transform:none }
```

### 2.2 What a kind is allowed to vary — exactly four properties

**`background` · `box-shadow` · `color` · `font-weight`.**

Not height. Not padding. Not radius. Not gap. Not the transition. Not the focus
ring. Not the press. Not the font size — that comes from the container.

That single sentence is the system. Every inconsistency in §0 is a kind having
varied something outside those four.

**Height is set by `min-height`, never by padding.** This one rule deletes six of
the eight paddings on its own, and it is the direct cause of `7px 11px`: someone
padding *to* a height they never named. Name the height and the padding becomes a
single horizontal number.

**Press is `scale`, never `translateY`.** Gradient Lab uses `translateY(1px)` on
`.btn` and `.miniBtn`; the rest of the site uses `scale(.97)`. Scale wins because
it is already tokenised (`--press-scale` `.97`, `--press-scale-lg` `.985` for boxes
over ~200px) and because a downward nudge on a control with no shadow reads as a
rendering glitch rather than a press.

**The rim is a `box-shadow`, never a `border`.** A border adds 2px to the box and
is why the site's paddings are 1px apart from each other for no reason. An inset
`box-shadow` renders identically and is outside layout entirely.

---

## 3. The six kinds

Each spec lists **only** the four permitted properties per state. Everything else
comes from `.ctl`.

### 3.1 Primary — `.ctl--primary`

The one action a view exists for. **One per view.** That is a rule; two primaries
is the same as none.

| State | background | box-shadow | color | font-weight |
|---|---|---|---|---|
| rest | `var(--ctl-accent)` | none | `var(--c50)` | 400 |
| hover | `var(--ctl-accent-press)` | none | `var(--c50)` | 400 |
| active | `var(--ctl-accent-press)` | none | `var(--c50)` | 400 |
| focus-visible | `var(--ctl-accent)` | none | `var(--c50)` | 400 |
| disabled | `var(--ctl-accent)` | none | `var(--c50)` | 400 |

Plus, from the base: press adds `scale(.97)`; focus-visible adds the `--c950` ring
at 2px offset; disabled multiplies by `.38`.

- Contrast: white on `#2961CE` is **5.59:1**; on hover it improves to **7.86:1**.
- **No border.** `.workCta` currently ships `border:1px solid var(--accent)` on a
  `var(--accent)` ground — a border the same colour as its fill.
- The focus ring is `--c950` and sits **outside** the box at 2px offset, so it
  reads against the paper, not against the blue.

### 3.2 Secondary — `.ctl--secondary`

| State | background | box-shadow | color | font-weight |
|---|---|---|---|---|
| rest | none | `var(--rim-1)` | `var(--ctl-ink)` | 400 |
| hover | none | `var(--rim-2)` | `var(--ctl-ink-strong)` | 400 |
| active | none | `var(--rim-2)` | `var(--ctl-ink-strong)` | 400 |
| focus-visible | none | `var(--rim-1)` | `var(--ctl-ink)` | 400 |
| disabled | none | `var(--rim-1)` | `var(--ctl-ink)` | 400 |

- **The hover moves two channels and neither is a fill:** the rim goes
  `rgba(18,18,18,.08)` → `.14` (composites `#EAEAEA` → `#DCDCDC`, 1.18:1 → 1.35:1)
  and the ink goes `#525252` → `#121212` (7.68:1 → 18.42:1). The icon comes with
  the ink via `currentColor`, so the whole control strengthens as one object.
- **The one permitted addition:** a Secondary that floats over arbitrary content
  (`.toTop`, `.reelClose`, `.copy`) takes `background: var(--mat-3-solid)`. That is
  a *material* — what it needs to be legible over a photograph — not a fill.
- **On a dark ground** — `.ctl[data-surface="ink"]` — rim becomes `var(--rim-i1)` →
  `var(--rim-i2)`, ink `var(--i700)` → `var(--c50)`, focus ring `var(--c50)`.

### 3.3 Quiet — `.ctl--quiet`

The default, and the largest population — 18 of the 40 classes, plus every nav item
and menu row in the header rebuild. **No ground, no rim, no radius anyone will see.**

| State | background | box-shadow | color | font-weight |
|---|---|---|---|---|
| rest | none | none | `var(--ctl-ink)` | 400 |
| hover | none | none | `var(--ctl-ink-strong)` | 400 |
| active | none | none | `var(--ctl-ink-strong)` | 400 |
| focus-visible | none | none | `var(--ctl-ink)` | 400 |
| disabled | none | none | `var(--ctl-ink)` | 400 |

This is `header.css:247` generalised, verbatim, to the whole site.

**Where "less" is the right answer.** `.moodItem` (8 uses) is a menu row: it needs
ink, space and a 44px target and nothing else. `.moodGo`, `.hmBtn` bare, `.csGo`,
`.back`, `.talk`, `.ndLink`, `.abBack` are all boxes drawn around text that was
already legible. Each loses a background, a border and a radius and gains nothing —
which is the point.

**The one sub-variant, `.ctl--quiet.is-inline`** — a quiet action set *inside a
paragraph*, where surrounding prose means ink alone cannot mark it. `.footIn` today,
already correct; documented so nobody "fixes" it:

```css
.ctl--quiet.is-inline{
  display:inline; min-height:0; padding-inline:0; white-space:normal;
  font-weight:600; font-size:inherit; color:var(--ctl-ink-strong);
  text-decoration:underline; text-decoration-thickness:2px;
  text-underline-offset:3px; text-decoration-color:var(--ctl-ink-mute);
  padding-block:var(--sp-8); margin-block:calc(var(--sp-8) * -1);  /* 42px target, no reflow */
}
.ctl--quiet.is-inline:hover,
.ctl--quiet.is-inline:focus-visible{ color:var(--ctl-accent); text-decoration-color:currentColor }
.ctl--quiet.is-inline:active       { color:var(--ctl-accent-press); text-decoration-color:currentColor }
```

600 at rest is a carve-out with a reason: a 400 link inside 400 prose is
indistinguishable without colour, and colour alone fails 1.4.1.

### 3.4 Tab — `.ctl--tab`

One of a set; exactly one is selected; selection is a **blue underline, never a
blue fill** (Jayden's explicit correction).

| State | background | box-shadow | color | font-weight |
|---|---|---|---|---|
| rest | none | none | `var(--ctl-ink-mute)` | 600 |
| hover | none | none | `var(--ctl-ink-strong)` | 600 |
| `[aria-selected="true"]` | none | none | `var(--ctl-ink-strong)` | 600 |
| focus-visible | none | none | rest/selected | 600 |
| disabled | none | none | `var(--ctl-ink-mute)` | 600 |

```css
.ctl--tab{ border-radius:0; font-size:inherit; font-weight:600; color:var(--ctl-ink-mute) }
.ctl--tab::before{                       /* the underline. NOT a border-bottom. */
  content:""; position:absolute; left:var(--ctl-pad); right:var(--ctl-pad); bottom:0;
  height:var(--focus-w); border-radius:var(--r-hair);
  background:var(--ctl-accent); opacity:0;
  transition:opacity var(--dur-state) var(--ease-out);
}
.ctl--tab[aria-selected="true"]{ color:var(--ctl-ink-strong) }
.ctl--tab[aria-selected="true"]::before{ opacity:1 }
.ctl--tab:focus-visible{ border-radius:var(--r-xs) }   /* the ring needs a shape; the tab does not */
```

Four load-bearing decisions:

1. **`::before`, not `border-bottom`.** Measured: the shipped `.tvTab.on` draws a
   2px accent bottom border on a `border-radius:14px` box, so the "underline" is a
   swoosh that tapers out 14px before each end. The pseudo-element is inset to
   `--ctl-pad`, so the rule sits under the *word*, not under the padding.
2. **`border-radius:0` at rest.** A tab has no ground, so it has no corners. The
   `4px` on `.csTab` and the `14px` on `.tvTab` are both invisible CSS.
3. **600 at rest, not 400.** Weight is normally the *selected* channel — but a
   weight change reflows the row, and a tab row that resizes when you select a tab
   is worse than one that never changes weight. So the tab is 600 throughout and
   selection is carried by **ink (4.53:1 → 18.42:1) plus the underline**, on two
   axes, neither of which moves a pixel. Matches what `.csTab` already ships.
4. **`font-size: inherit`.** `.csTab` is 19.2px and `.tvTab` is 15px because one is
   a section switcher and the other an in-content toggle. That is a decision about
   the **row**: `.csTabs{ font-size: var(--fs-tab) }`, and the tab inherits. One
   escape hatch, owned by the container; the control rules stay byte-identical.

**Target:** the tab is a `.ctl`, so it is 44px tall. `.csTab` at 35.5px today is
fixed by joining the base, not by a special case.

### 3.5 Chip / marker — `.ctl--chip`

The kind that is **usually not a target at all**, and where *subtract* removes most.

```css
.ctl--chip{
  min-height:var(--sp-24); padding-inline:0; border-radius:0;
  background:none; box-shadow:none;
  font-size:var(--fs-label); font-weight:600; color:var(--ctl-ink);
  letter-spacing:var(--tr-flat);      /* --tr-caps if text-transform:uppercase */
  cursor:default;
}
.ctl--chip[data-state="on"]{ color:var(--ctl-ink-strong) }
```

`.baLabel` today is `1px solid #E6E6E6` + `background:#FDFDFD` on a `#FDFDFD` page:
an invisible box inside an invisible border, three declarations doing nothing. Its
"after" state flips to a solid `--c950` fill with white ink — a filled black pill
to say *this column is the after*. Ink and weight say it just as clearly.

Two modifiers, each with a reason:

- **`.is-onmedia`** — the marker sits on a photograph or the pitch and must read
  against arbitrary colour (`.tCardTag`). `background:var(--wash-i1)`,
  `border-radius:var(--r-pill)`, `padding-inline:var(--sp-10)`.
- **`.is-toggle`** — the chip *is* a target. Then it stops being a chip: it takes
  `min-height:var(--ctl-h)`, the Secondary rest/hover, and the Tab's selected ink.

### 3.6 Field — `.ctl--field`

In scope because a `select` at 28.5px next to a button at 44px is the loudest single
inconsistency in Gradient Lab, and a form row cannot read as one object if its two
halves are on different ladders.

| State | background | box-shadow | color | font-weight |
|---|---|---|---|---|
| rest | `var(--mat-3-solid)` | `var(--rim-1)` | `var(--ctl-ink-strong)` | 400 |
| hover | `var(--mat-3-solid)` | `var(--rim-2)` | `var(--ctl-ink-strong)` | 400 |
| focus-visible | `var(--mat-3-solid)` | `var(--rim-2)` | `var(--ctl-ink-strong)` | 400 |
| disabled | `var(--mat-3-solid)` | `var(--rim-1)` | `var(--ctl-ink)` | 400 |
| placeholder | — | — | `var(--ctl-ink-mute)` | 400 |

Plus `justify-content:flex-start; text-align:left; cursor:text` (`cursor:default`
for `select`). A field carries a ground at rest because it is the one kind whose job
is to look *recessed* — it is where content goes, not where content is.

---

## 4. The modifiers — geometry only, never colour

Five, and they compose. A modifier may never touch `background`, `box-shadow`,
`color` or `font-weight` — those belong to the kind.

```css
.ctl.is-sm   { min-height:var(--ctl-h-sm); padding-inline:var(--ctl-pad-sm);
               gap:var(--ctl-gap-sm); font-size:var(--ctl-fs-sm); --ico-md:var(--ico-sm) }
.ctl.is-icon { padding-inline:0; width:var(--ctl-h); min-width:var(--ctl-h) }
.ctl.is-sm.is-icon{ width:var(--ctl-h-sm); min-width:var(--ctl-h-sm) }
.ctl.is-block{ display:flex; width:100% }
.ctl.is-row  { display:flex; width:100%; justify-content:flex-start; text-align:left }

/* the hit area, applied BY the compact modifier so it cannot be forgotten */
.ctl.is-sm::after{
  content:""; position:absolute; top:50%; left:0; right:0;
  height:var(--tap-min); transform:translateY(-50%);
}
.ctl.is-sm.is-icon::after{
  left:50%; right:auto; width:var(--tap-min); transform:translate(-50%,-50%);
}
```

`.is-row` is what `.moodItem`, `.moodGo`, `.ndLink`, `.mhPick` and every menu row in
the header rebuild need. They looked like a seventh kind; they are a Quiet control
with `justify-content:flex-start`.

### 4.1 `7px 11px` and `36px` are evidence, not errors

They point in opposite directions and both answers are definite.

**`36px` is legitimate, and `#moodBtn` already implements it correctly.** Measured
on `index.html`: `#moodBtn` is a 36px ink box carrying `::after{height:var(--tap-min)}`
— the visible control is 36 and the target is 44. That is the pattern; `.is-sm` is
that pattern promoted to a rule.

**`7px 11px` is not.** `.miniBtn` computes to a 23.5px box with 11px type, no
hit-area expansion, and neighbours 4–6px away — expanding it to 44 would overlap
them. **It must grow**, to `.is-sm` (36px) inside a panel whose gaps go to 8px. The
`7px 11px` itself is the fingerprint of padding-to-a-height: once the height has a
name, the vertical padding is 0 and the horizontal is 12.

### 4.2 The three conditions on the compact rung

`.is-sm` is legal only when **all three** hold. Any one failing means 44px.

1. **Container.** The control sits inside a chrome object — a bar, toolbar, card
   header or menu — that is itself ≥44px in its cross axis. The container is the
   target-sized object; the control is a subdivision of it. This is exactly why
   `#moodBtn` at 36 inside a 52px nav bar is right and `.miniBtn` at 23.5 in a
   hairline panel is not. **Free-standing in content is never compact.**
2. **Hit area.** It carries the `::after` expansion to `--tap-min`. Applied by the
   modifier itself so it cannot be omitted by hand.
3. **Spacing.** ≥`--sp-8` between adjacent *expanded* hit areas — in practice, the
   container's `gap` is ≥8px.

**A `pointer:coarse` media query is not the answer, and that is worth saying out
loud.** Coarse pointers do not need a bigger *ink box*; they need a bigger *target*,
and the `::after` already guarantees 44×44 on every pointer type. Growing the visual
box on touch would give the phone chunkier, less premium chrome than the desktop for
no accessibility gain.

---

## 5. Motion

### 5.1 Three tiers for UI, and nothing else

Every duration on a control comes from one of three tokens. The tier is chosen by
**what changes**, never by what looks right.

| Tier | Token | Duration | Curve | Chosen when the thing that changes is… |
|---|---|---|---|---|
| **Feedback** | `--dur-press` | **100ms** | `--ease-out` | …a `transform` the user is causing right now. The press scale. Only. |
| **State** | `--dur-state` | **160ms** | `--ease-out` | …a colour, an ink, a rim, an opacity, an underline. **Every hover, focus, select and active change on the site.** |
| **Reveal** | `--sp-settle-dur` | **360ms** | `--sp-settle` | …a position or a size. A menu, a drawer, a panel, the travelling tab indicator. |

Plus one asymmetry token, §5.3: `--dur-state-out` = **240ms**.

`--dur-press` is `--press-dur`, which already exists. `--dur-state` is
`--ease-out-dur`, which already exists. `--sp-settle` / `--sp-settle-dur` already
exist. **Only `--dur-state-out` is new.**

**Why 360ms does not feel slow.** `--sp-settle` is a sampled spring, not a linear
ramp: at 50% of its duration it has already covered **0.856** of the travel and at
60% it is at **0.912**. So a menu on the reveal tier is perceptually a ~180ms move
with a soft tail — which is exactly the 180ms the mood menu ships today, plus a
settle. Adopting the tier is not a slow-down; it is the same arrival with a landing.

### 5.2 The collapse — all 30 durations, mapped

| Today | → | Tier |
|---|---|---|
| `0` `30` `60` `70` `80` `100` `120` `125` `140` — **~45 declarations** | **100ms** | Feedback, and only when the property is `transform`. If it is a colour at 80ms, it goes to State. |
| `150` `160` `180` `200` `250` — **247 declarations, 48% of every transition on the site** | **160ms** | State |
| `260` `280` `300` `320` `340` `350` `375` `380` `400` `420` `450` — **108 declarations** | **360ms** | Reveal |
| `500` `550` `600` — **93 declarations** | `--enter-dur` **500ms** | **Not control motion.** These are content entrances: `.ch`, `.sub .l`, `.reelCap`, `.csMeta`, `#discoWrap` — the hero and case-study reveals, one per element, on scroll or load. They keep `--enter-dur`, which already exists, and they are out of this system's scope. |
| `700` `800` `950` `1150` — 12 declarations | — | **Carve-out.** The hero stage settle and the reel. Scene motion; see §5.5. |

### 5.3 The premium hover, as rules

**The property set that may animate on hover is closed. Five, and no others:**

| May animate | On which kinds | Duration |
|---|---|---|
| `color` | all | `--dur-state` |
| `box-shadow` (the rim) | Secondary, Field | `--dur-state` |
| `background-color` | **Primary only** (accent → accent-press) | `--dur-state` |
| `text-decoration-color` | `.is-inline` only | `--dur-state` |
| `transform` | **`:active` only, never `:hover`** | `--dur-press` |

**Never on hover, and each has a reason:**

- **`transform`** — a lift implies elevation, which violates the no-shadow rule, and
  it makes a row jitter as the pointer crosses it. Transform is the press channel
  and nothing else.
- **`opacity` on the control** — this is what `.abTalk` (`opacity:.82`),
  `.hmBtn` (`.86`) and `.teamStart` (`.9`) do today. It fades the whole object
  *including its label*, so the ink gets **weaker** on hover. Exactly backwards.
- **`font-weight`, `letter-spacing`, `padding`, `width`, `border-width`** — all
  reflow. A control that resizes under the pointer is the opposite of considered.
- **`filter`** — expensive, and the case studies already put `url(#inkSm)` on chrome
  text; animating a displacement map on a 15px label is a smear.

**On the "ink and weight" instruction.** Jayden asked for hover to change *ink and
weight*. Weight-on-hover reflows the label under the pointer — the control grows a
few pixels the instant you point at it. So this system assigns **weight to
selection** and gives hover **ink** (Quiet, Tab, Primary) or **ink + rim**
(Secondary, Field). Two channels, no reflow. Flagged for his call — §11 item 1.

**The asymmetry, which is most of why it reads as considered:**

```
hover-IN  : 160ms   (--dur-state)
hover-OUT : 240ms   (--dur-state-out, = 160 × 1.5)
```

The pointer *arriving* is user-initiated and should feel instant. The pointer
*leaving* is often incidental — crossing a row on the way somewhere else — and a
slower release stops a row of controls flickering as the cursor sweeps across it.
1.5× is the smallest ratio that is perceptible without reading as lag; 2× is sticky.

**Implemented in three lines, no second rule per control**, because the transition
declared on the `:hover` rule governs the in-transition and the one on the base rule
governs the out — see the base in §2.1:

```css
.ctl        { transition-duration:var(--dur-state-out) }   /* the OUT */
.ctl:hover, .ctl:focus-visible,
.ctl[aria-selected="true"], .ctl[aria-current],
.ctl[aria-expanded="true"] { transition-duration:var(--dur-state) }   /* the IN */
.ctl:active { transition-duration:var(--dur-press) }
```

### 5.4 One easing for UI state, and the one that earns a second

**`--ease-out` = `cubic-bezier(.2,.8,.2,1)` is the only curve on the Feedback and
State tiers.** It is already 378 of 454 easing declarations (83%). The burden was on
any second curve to earn its place and only one does:

**`--sp-settle` on the Reveal tier**, because a menu, a drawer and a travelling
indicator are *objects with position*, and a spring is the difference between one
arriving and one stopping. It is already a token and has never had a consumer.

Retired, with what each becomes:

| Retired | Count | Becomes | Why |
|---|---|---|---|
| `ease-out` (`cubic-bezier(0,0,.58,1)`) | 16 | `--ease-out` | §0.3. It is a genuinely different curve sitting beside the house curve, including on two adjacent rows of one menu. |
| `ease` | 12 | `--ease-out` | A default nobody chose. |
| `linear` | 4 | `--ease-out` | Constant velocity on a state change reads as a fade-in, not a response. |
| `cubic-bezier(.22,.61,.36,1)` | 6 | `--ease-out` at the Reveal tier | The mood dock's proximity reveal and `abHeadReturn`. A gentler decelerate, but not enough gentler to justify a third curve. |
| `cubic-bezier(.34,1.4,.5,1)` | 3 | `--sp-pop` (already a token) | The mood caret's overshoot rotation. It is a real overshoot and it should use the real overshoot token. **But not on a caret** — see §6.1. |
| `cubic-bezier(.3,0,.8,.15)` | 3 | `--ease-out` | An ease-**in**, for exits. The site has no considered exit choreography and adding one is a new axis nobody asked for. There is deliberately **no `--ease-in` token.** |
| 8 remaining one-off beziers | 8 | whichever tier they land in | None is distinguishable from `--ease-out` at these durations. |

### 5.5 The carve-outs — explicitly *not* UI motion

Do not flatten these. They are checked, and each is deliberate.

**`steps(2,end)` and `steps(2)` — 26 declarations. Keep verbatim.**
- `.playerStage img` and `.tv .tvFrame img` in the case studies:
  `transition: filter .25s steps(2,end), opacity .25s steps(2,end)`. The stepped
  transition makes the artefact swap read as a **two-frame ink cut** rather than a
  smooth cross-fade, which is the same language as the `filter:url(#inkSm)`
  displacement the pages already use. It is a stylistic choice and a good one.
- `.eye{transition:transform .08s steps(2)}` on the companion head: character
  animation. The head is not chrome — it is the thing the chrome is about.
- `.battleBadge i{animation:bbPulse 1.1s steps(2,end) infinite}`: a two-frame blink.

**All 126 `animation:` declarations across 51 durations.** The goal sequence
(5600ms), the champion reveal, the ambient stage loop (22 000ms), the head's idle
motion. These belong to the game and to the hero, they are governed by
`--sp-pop` / `--sp-bounce` in the tokens spec, and forcing them onto a 3-tier UI
scale would be a category error.

**The 500ms content entrances** (§5.2) keep `--enter-dur`. A `.csMeta` fading up on
scroll is not a control responding to a pointer.

### 5.6 `prefers-reduced-motion` — one rule, stated once

```css
@media (prefers-reduced-motion: reduce){
  .ctl, .ctl::before, .ctl::after,
  .ctl-menu, .ctl-tabrow__ind{
    transition-duration:1ms !important;
    animation-duration:1ms !important;
    animation-iteration-count:1 !important;
  }
  .ctl:active{ transform:none }
}
```

Two things about it are deliberate:

- **`1ms`, not `0s`.** `transitionend` still fires, so any JS waiting on it keeps
  working. `tokens.css`'s existing reduce block already uses `1ms` for the springs;
  this matches.
- **It removes motion, not feedback.** The hover ink change, the rim change and the
  underline all still happen — instantly. Suppressing them would be an accessibility
  regression dressed as an accommodation. The only thing actually removed from a
  control is the press `scale`.

---

## 6. Compositions

Three patterns that are not new kinds. Each is built from §3 and §4 and each has a
complete, buildable spec because the header rebuild needs them now.

### 6.1 The split control — a destination that also discloses

`Play ▾` and `Contact ▾`: a link that navigates on click and opens a menu on hover.

**It is ONE element.** Not a link plus a caret button. Two elements means two hit
areas, two focus stops, two hover states, and it reads as glued rather than made.
The caret is a `.gIco` inside the same `<a>`.

```css
.ctl--quiet.has-menu{ padding-inline-end:var(--sp-10) }   /* the caret needs less trailing air than a word */
.ctl--quiet.has-menu > .gIco-caret{
  width:var(--ico-xs); height:var(--ico-xs); flex:0 0 var(--ico-xs);   /* 11px */
  margin-inline-start:calc(var(--ctl-gap-sm) - var(--ctl-gap));        /* 6px total, not 8 */
  color:var(--ctl-ink-mute);
  transition:transform var(--dur-state) var(--ease-out),
             color     var(--dur-state) var(--ease-out);
}
.ctl--quiet.has-menu:hover > .gIco-caret,
.ctl--quiet.has-menu[aria-expanded="true"] > .gIco-caret{ color:inherit }
.ctl--quiet.has-menu[aria-expanded="true"] > .gIco-caret{ transform:rotate(180deg) }
```

| Rule | Value | Why |
|---|---|---|
| caret size | `--ico-xs` **11px** | One rung below the leading icon's `--ico-md` 18px. The caret is subordinate — a control with a 18px head and a 18px tail has no direction. |
| caret gap | `--ctl-gap-sm` **6px** | Tighter than the 8px icon⇄label gap, because the caret belongs to the *label*, not to the control. 8px would make it read as a third item. |
| caret hit area | **none of its own** | The whole control is the target. A caret with its own hit area is the two-element mistake. |
| caret motion | `rotate(180deg)`, **160ms `--ease-out`** | Explicitly **not** a spring. `.moodCar` today uses `cubic-bezier(.34,1.4,.5,1)` at 320ms; an overshoot on an 11px glyph reads as a twitch, not as weight. This is the one place §5.4's "retire to `--sp-pop`" does *not* apply. |
| open state ink | `--ctl-ink-strong` — **the hover ink, no fill** | Open ≠ selected. The menu is the disclosure indicator; the control does not also need one. |
| open trigger | `:hover` after `--dur-intent` **120ms**, `:focus-within`, click, `ArrowDown`, `Alt+ArrowDown` | The 120ms intent delay is why a cursor sweeping the bar does not fire three menus. |
| close trigger | pointer leaves for `--dur-state-out` **240ms**, `Esc`, blur, click outside | Same 1.5× asymmetry as the hover ink (§5.3), for the same reason. `Esc` returns focus to the control. |
| navigation | click on the control navigates; click on the caret **also navigates** | One element, one action. Disclosure is hover and keyboard, never a click target that steals the link. |

### 6.2 The travelling active indicator

One shared element per tab row, sliding between tabs.

```css
.ctl-tabrow{ position:relative }
.ctl-tabrow__ind{
  position:absolute; bottom:0; left:0;
  width:100px;                                  /* the scale base — never changes */
  height:var(--focus-w); border-radius:var(--r-hair);
  background:var(--ctl-accent);
  transform-origin:left center;
  transform:translateX(var(--ind-x)) scaleX(var(--ind-s));
  transition:transform var(--sp-settle-dur) var(--sp-settle);
  pointer-events:none;
}
.ctl-tabrow:not(.ready) .ctl-tabrow__ind{ transition:none }         /* no slide-in on first paint */
.ctl-tabrow.has-indicator .ctl--tab::before{ display:none }         /* the two must not both run */
```

JS sets two custom properties and nothing else:

```js
const t = row.querySelector('[aria-selected="true"]');
const r = t.getBoundingClientRect(), b = row.getBoundingClientRect();
const pad = parseFloat(getComputedStyle(t).paddingInline || 16);
ind.style.setProperty('--ind-x', (r.left - b.left + pad) + 'px');
ind.style.setProperty('--ind-s', (r.width - pad * 2) / 100);
requestAnimationFrame(() => row.classList.add('ready'));
```

| Rule | Value | Why |
|---|---|---|
| animated property | **`transform` only** | Never `left`/`width`. Those re-solve layout on every frame of a 360ms move; `transform` composites. |
| curve · duration | `--sp-settle` · **360ms** | The one place a spring belongs on chrome: the indicator is an object with position, and it should arrive rather than stop. |
| inset | `--ctl-pad` **16px** each side | The rule sits under the *word*, matching §3.4's `::before`. |
| first paint | `transition:none` until `.ready` | Otherwise it slides in from x=0 on every page load. |
| reduced motion | `transition-duration:1ms` — it **jumps**, it does not disappear | §5.6. |
| **it is never the only signal** | ink still goes `--c500` → `--c950` | Mid-flight the bar marks *neither* tab. Ink is instant and always correct. This is also 1.4.1. |
| on resize | recompute on `ResizeObserver`, with `.ready` removed for one frame | A slide triggered by a window resize is motion nobody asked for. |

### 6.3 Menu rows, and why the socials look like the nav

**A menu row and a nav item are the same kind** — `.ctl--quiet` — with the same ink
ramp, the same 44px target, the same focus ring, the same 160/240ms hover. That is
what *"in the same style and design system"* means, and it costs nothing because
they were already the same control.

**Exactly three permitted differences, each with a reason:**

| | Nav item | Menu row | Reason |
|---|---|---|---|
| alignment | centred (`.ctl`) | left (`.ctl.is-row`) | A menu is a vertical list; a ragged left edge is unreadable. A bar is a horizontal row; centred is correct there. |
| width | content | `100%` | Same reason. The row's full width is its hit area. |
| icon size ≤640px | drops to `--ico-sm` 15px | **stays `--ico-md` 18px** | The bar shrinks because it runs out of horizontal room; a menu has the full width of the sheet. Shrinking a menu's icons makes it look like a different component from the bar that opened it. |

**Everything else is identical, and specifically:** icon size at desktop is
`--ico-md` **18px** in both — which is already true today (`.moodItem svg` 18px,
`.jbNav .gIco` 18px); lock it. Stroke is `--ico-stroke` 1.8 site-wide.

**The socials are labelled rows, not an icon strip.** Same argument that gives the
phone nav icon-only gives the menu labels: the bar drops words because it has no
room, and the menu keeps them because it does. An icon-only social strip inside a
sheet with 200px of free width is a guessing game.

**Rows stack at `gap:0`.** Their 44px height is the separation. A gap between menu
rows makes the menu read as a list of buttons rather than as a list.

**The menu surface** — the one place a shadow is permitted:

```css
.ctl-menu{
  background:var(--mat-3-solid); box-shadow:var(--rim-2), var(--sh-2);
  border-radius:var(--r-lg); corner-shape:var(--corner);
  padding:var(--sp-8); min-width:196px;
  opacity:0; visibility:hidden; transform:translateY(var(--sp-6));
  transition:opacity   var(--dur-state)      var(--ease-out),
             transform var(--sp-settle-dur)  var(--sp-settle),
             visibility 0s var(--sp-settle-dur);
}
.ctl-menu[data-open]{
  opacity:1; visibility:visible; transform:none;
  transition:opacity   var(--dur-state)     var(--ease-out),
             transform var(--sp-settle-dur) var(--sp-settle);
}
.ctl-menu .ctl{ border-radius:var(--r-md) }   /* --r-lg 20 minus the --sp-8 inset: the concentric rule */
```

`--sh-2` here is not a contradiction of the no-shadow rule. That rule governs
**resting chrome** — a bar, a button, a card. `2026-08-02-design-tokens.md` §4.2
sanctions `--sh-2` for *"a surface genuinely floating over content — an open menu, a
tooltip."* A menu is transient and genuinely detached. Today `.moodMenu` ships a
one-off `0 8px 28px -8px rgba(18,18,18,.12), 0 2px 8px -2px rgba(18,18,18,.06)`;
that becomes `--sh-2`.

---

## 7. Spacing — the between-control rhythm

§2 fixes the space *inside* a control. This is the space *between* them. One ladder,
four rungs, all existing `--sp-*`, and **no fifth value**.

| Rung | Token | Value | Between |
|---|---|---|---|
| tight | `--sp-4` | 4px | **Never between two targets.** Glyph-to-glyph inside one control only. |
| **item** | `--sp-8` | **8px** | Two adjacent controls in the same group. This is also the 44px-target separation minimum, so it is a **floor**, not a preference. |
| **group** | `--sp-16` | **16px** | Two groups of controls in the same row — `[Back] ⟷ [Work][About][Play]`. |
| **band** | `--sp-24` | **24px** | A control row and the content above or below it. |
| section | the responsive `--sp-*-*` ladder | — | Anything larger belongs to the page, not to the controls. |

**The governing rule, one sentence: the gap between groups is exactly 2× the gap
between items, and there is no third value.** That 2:1 is what lets a bar read as
groups without a divider — the same argument as the type spec's 3.8:1 heading ratio,
applied horizontally.

Three sub-rules that cover every remaining case:

- **Control ⇄ its own icon:** `--ctl-gap` 8px at the 44 rung, `--ctl-gap-sm` 6px at
  the 36 rung and for a caret (§6.1). Already in the base.
- **Control ⇄ its external label** (a field's label above it): `--sp-6` 6px. A label
  and its field are one object and must not read at item distance.
- **Stacked menu rows:** `gap:0` (§6.3).

**Measured violations to fix in the same pass:**

| Where | Today | Should be |
|---|---|---|
| `header.css:396–397` — `.jbNav`/`.jbGrp` gap at ≤640px | `--sp-4` **4px** between two 44px targets | `--sp-8`. It was a deliberate trade to fit the bar, but labels already drop below 640px, so the room exists. |
| `.playerBar{gap:16px}` (case studies) | group spacing used between two items | `--sp-8` |
| `gradientlab` panel rows | 4–6px between 23.5px controls | `--sp-8`, with the controls at `.is-sm` 36px (§4.1) |
| `.moodMenu{padding:8px}` with rows | rows carry their own radius and sit in an 8px inset | keep the 8px inset; rows go `gap:0` and `--r-md` per the concentric rule |
| `.tvTabs{gap:8px}`, `.sbNav{gap:8px}`, `.baChips{gap:8px}` | ✓ | unchanged |

---

## 8. The migration table

`R` = pure refactor, no pixel moves. `V` = visible. **`J`** = visible on a surface
Jayden has already approved — needs his eye, not silent adoption.

### Primary

| Class | File | What changes | |
|---|---|---|---|
| `.workCta` | index | `min-height` 46 → 44 · drop `border:1px solid var(--accent)` (same colour as its fill) · radius `4px` → `--r-md` · padding `8px 16px` → `0 16px` · hover `--c900` → `--ctl-accent-press` | **J** |
| `.abTalk` | index | radius `100px` → `--r-md` · padding `8px 24px` → `0 16px` · hover `opacity:.82` → `--ctl-accent-press` · font 16 → 15 | **J** |
| `.abLinkPrimary` | index | ground `--c900` → `--ctl-accent` · drop the border | **V** |
| `.tGo:not(.tGoQuiet)` | play.css | ground `--c950` → `--ctl-accent` · **must not use `var(--accent)`** (green on play.html) · hover `opacity:.86` → accent-press | **V** |
| `.hmBtn.hmBtnPrimary` | play.css, headmaker | ground `--c950` → `--ctl-accent` · drop `border:1px solid var(--c950)` · padding `12px 24px` → `0 16px` | **V** |
| `.teamStart` | play-games.js | ground `--c950` → `--ctl-accent` · radius `8px` → `--r-md` · padding `12px` → `0 16px` + `min-height:44` (it is 41 today) · hover `opacity:.9` → accent-press · keep `.is-block` | **V** |
| `.btn` | gradientlab | ground `#232323` → `--ctl-accent` · radius `8px` → `--r-md` · padding `11px 14px` → `0 16px` · height 38 → 44 · font 13 → 15 · press `translateY(1px)` → `scale(.97)` | **V** |

### Secondary

| Class | File | What changes | |
|---|---|---|---|
| `.aboutCta` | index | `1px solid --c100` + `--c50` fill → `--rim-1`, no fill · `min-height` 46 → 44 · radius `4px` → `--r-md` · hover `border-color:--c500` → `--rim-2` + ink | **J** |
| `.moodBtn` | index, play.css | same; the two skins converge. The index pill keeps `--r-pill` (concentric rule, it sits in a pill bar) but **loses `--sh-1`** | **J** |
| `.abLink` | index | border + fill → `--rim-1` · padding `12px 20px`/`16px 20px` → `0 16px` · gap 12 → 8 · radius → `--r-md` | **V** |
| `.hmBtn.ghost` | headmaker | fill + `--c100` border → `--rim-1` · padding `12px 24px` → `0 16px` | **V** |
| `.tGo.tGoQuiet` | play.css | `1px solid --c100` → `--rim-1` · padding `12px 20px` → `0 16px` · hover loses the `--c75` wash, gains `--rim-2` + ink | **V** |
| `.toTop` | index, case studies | radius `50%` → `--r-md` · border → `--rim-1` · keep `--mat-3-solid` (it floats) · `height:46` → 44 | **J** |
| `.sbBtn` | play.css, case studies | radius `50%` → `--r-md` · border → `--rim-1` · `height:42` → 44 · hover loses the `--c75` wash and the accent-ink swap | **J** |
| `.skipLink` | all pages | drop `box-shadow:0 2px 10px` (a cast shadow on chrome) · border → `--rim-1` · radius → `--r-md` | **R** |
| `.reelClose` | index | `1px solid --c500` → `--rim-i1` via `data-surface="ink"` · radius → `--r-md` · `letter-spacing:.06em` at 12px sentence case → `--tr-flat` | **V** |
| `.reelTap` | index | `--c50` fill → `--mat-3-solid` + `--rim-1` (it floats over video) · padding `12px 20px 12px 16px` → `0 16px` | **V** |
| `.teamMini` | play-games.js | 28×28 → `.is-sm.is-icon` 36×36 with a 44 hit area · radius `6px` → `--r-md` · border → `--rim-1` | **V** |
| `.hmPitX` | headmaker | `height:18px`, radius `50%` → `.is-sm.is-icon` 36×36, `--r-md` | **V** |
| `.miniBtn` | gradientlab | **`7px 11px` → `.is-sm`**: 36px, `padding:0 12px`, `--r-md`, font 11 → 14, `--rim-1`, press `translateY` → `scale` | **V** |
| `.copy` | gradientlab | 25.5px → `.is-sm` 36 · `--r-md` · `rgba(255,255,255,.92)` → `--mat-3-solid` · `.ok` ink → `--ctl-accent` (green today) | **V** |
| `.navDrawerX`, `.hmZoom` | headmaker, index | join `.is-icon`; radius `4px` → `--r-md` | **R** |

### Quiet

| Class | File | What changes | |
|---|---|---|---|
| `.moodItem` ×8 | index, play.css | drop `border-radius` · padding `8px 12px`/`12px 16px`/`0 10px` → `0 16px` with `.is-row` · gap 12/10 → 8 · **hover `#F1F1F1` / `--c75` wash → ink only** · **`.1s ease-out` → `160/240ms --ease-out`** (§0.3) · `min-height` 42.5 on play.html → 44 | **J** |
| `.moodGo` | index, play.css | same, plus `.is-row` | **J** |
| `.moodTeamsBtn`, `.mhPick`, `.hmPitPick`, `.ndLink` | play.css, headmaker | join `.is-row`; drop grounds and radii | **R** |
| `.mhToggle` | index | `min-height:36`→44 (not in a bar) · padding `8px 8px` → `0 16px` · drop radius · hover wash → ink · the switch graphic untouched | **V** |
| `.hmBtn` (bare) | play.css | drops the `--c75` hover wash and the `--r-2xs` radius | **V** |
| `.hmScoreEnd` | play.css | keep the `#b3402e` destructive ink — the one sanctioned colour outside the ramp · `min-height:0` → `.is-sm` 36 (it sits in a 44px score bar) · drop `border-radius:8px` and `border-left` | **V** |
| `.csGo` | index | already a bare link; joins the base for its focus ring and press | **R** |
| `.chap` | case studies | already ink-only and correct. Joins the base for focus and transition only | **R** |
| `.footIn` ×28 | all pages | `.is-inline`. Already correct; only its `transition` collapses | **R** |
| `.back`/`.backlink`, `.talk`, `.abBack` | index, case studies | drop `border-radius` (invisible on a control with no ground) · padding → `0 16px` | **R** |
| `.jbNav a`, `.jbBack`, `.jbHome` | header.css | **already correct.** Two changes: focus ring `--nav-accent` → `--ctl-ink-strong` (§11 item 2), and the ≤640px gap `--sp-4` → `--sp-8` (§7) | **J** |

### Tab

| Class | File | What changes | |
|---|---|---|---|
| `.csTab` ×3 | index | **35.5px → 44px** and a real hit area · drop `border-radius:4px` · `padding:0 0 12px` → `0 16px` · rest ink `--c950` → `--c500` so the selected one is the only dark word · selected gains the `::before` underline · size moves to `.csTabs{font-size:var(--fs-tab)}` · `color .25s` → `160/240ms` | **J** |
| `.tvTab` ×22 | case studies | drop the border and the `--c50` fill · drop `border-radius:14px` · **`border-bottom` underline → `::before`** so it stops curving · hover accent-ink → `--c950` (the accent is reserved for selection) · padding `12px 16px` → `0 16px` | **J** |

### Chip / marker

| Class | File | What changes | |
|---|---|---|---|
| `.baLabel` | case studies | drop `1px solid --c100`, the `--c50` fill and `--r-xs` — three declarations painting nothing on a `--c50` page · `.isAfter` black fill → `--c950` ink | **J** |
| `.baChip` | case studies | same | **V** |
| `.tCardTag` | play.css | `.is-onmedia`: keeps `--r-pill` and a ground, but `rgba(255,255,255,.20)` → `--wash-i1` · `padding 3px 10px` → `0 10px` with `min-height:24` · `letter-spacing:.08em` at 12px uppercase → `--tr-caps` | **V** |
| `.battleBadge`, `.hmName`, `.teamHint` | play.css, play-games.js | join `.ctl--chip`; drop one-off radii | **R** |

### Field

| Class | File | What changes | |
|---|---|---|---|
| `select` ×5 | gradientlab | 28.5px → `.is-sm` 36 (the Lab panel is a chrome container) · radius `6px` → `--r-md` · `1px solid var(--hair)` → `--rim-1` · font 12 → 14 · focus ring `var(--accent)` (**green today**) → `--c950` | **V** |
| `input[type=text]` (`.hmName`) | headmaker | joins `.ctl--field`; height and radius to the ladder | **V** |
| `input[type=range]` | gradientlab | out of scope — a slider's track and thumb are their own geometry. Its **thumb** takes `--ctl-accent`, its focus ring the base ring | — |

**40 classes → 6 kinds + 5 modifiers + 3 compositions.** 12 rows are pure refactor,
17 visible, **11 marked `J`**.

---

## 9. What this deletes

| | before | after |
|---|---|---|
| computed paddings on one page | 7 | **2** (`0 16px`, `0 12px`), + `0` for icon-only and `--sp-10` on a caret's trailing side |
| computed heights on one page | 8 | **2** (44, 36) |
| radius values across controls | 8 | **1** (`--r-md`) + "inherit the container's shape" |
| **transition durations (all)** | **30** | **4** (100 · 160 · 240 · 360) + `--enter-dur` for content |
| **transition durations (controls)** | **10** | **3** (100 · 160 · 240) |
| **easings (all)** | **15** | **2** (`--ease-out`, `--sp-settle`) + 2 named carve-outs (`steps(2,end)`, `steps(2)`) |
| **easings (controls)** | **4** | **1** (`--ease-out`) |
| border treatments | 5 | **1** rim, as `box-shadow`, outside layout |
| icon⇄label gaps | 6 | **2** · icon sizes 5 → **2** |
| between-control gaps | ad hoc | **3** (8 · 16 · 24), on a 2:1 rule |
| press idioms | 2 | **1** · focus-ring colours 3 → **1** · disabled opacities 2 → **1** |

Plus: every `border` on a button; every `background` on a Quiet control; every
`border-radius` on a control with no ground; both cast shadows on chrome
(`.skipLink`, `#moodBtn`); `.baLabel`'s entire boundary.

---

## 10. The token block — copy this

To sit in `tokens.css` after the play.html tokenisation block. **This is the single
set of numbers. The header rebuild consumes these; it does not define its own.**

```css
:root{
  /* ── the control accent ────────────────────────────────────────────────────
     A control's OWN accent, bound here and never rebound. --accent is a
     page-level signal and TWO pages deliberately re-declare it (play.css:53 and
     gradientlab.html both bind it to #0E6B3B, the live-match green). A control
     rule written against var(--accent) therefore renders GREEN on play.html and
     in the Lab -- measured, and it is why the Lab's focus ring is green today. */
  --ctl-accent      : oklch(52% 0.18 262);    /* #2961CE · 5.59:1 on paper, 5.59:1 white-on */
  --ctl-accent-press: oklch(44% 0.16 262);    /* #1B4BA9 · 7.86:1 */
  --ctl-accent-wash : oklch(94.7% 0.018 262); /* #E7EEFA · accent on wash 4.87:1 */

  /* ── geometry ── two height rungs and nothing else ── */
  --ctl-h     : var(--tap-min);   /* 44px — the default */
  --ctl-h-sm  : 36px;             /* the compact rung; three conditions, §4.2 */
  --ctl-pad   : var(--sp-16);     /* 16px inline. 44 × 0.36, on the 4px grid */
  --ctl-pad-sm: var(--sp-12);     /* 12px inline. 36 × 0.36 */
  --ctl-gap   : var(--sp-8);      /* icon ⇄ label at the 44 rung */
  --ctl-gap-sm: var(--sp-6);      /* icon ⇄ label at 36; also label ⇄ caret */
  --ctl-r     : var(--r-md);      /* 14px. 14/44 = 0.32 */

  /* ── ink and type ── */
  --ctl-fs        : var(--fs-small);  /* 15px */
  --ctl-fs-sm     : var(--fs-nav);    /* 14px */
  --ctl-ink       : var(--c700);      /* 7.68:1 */
  --ctl-ink-strong: var(--c950);      /* 18.42:1 — also the focus ring */
  --ctl-ink-mute  : var(--c500);      /* 4.53:1 — tab rest, caret rest, placeholder */
  --ctl-disabled-o: .38;

  /* ── motion ── three tiers, plus the hover-out asymmetry ── */
  --dur-press    : var(--press-dur);      /* 100ms · transform only */
  --dur-state    : var(--ease-out-dur);   /* 160ms · hover-IN, focus, select */
  --dur-state-out: 240ms;                 /* THE ONE NEW TOKEN. 160 × 1.5 · hover-OUT */
  --dur-intent   : 120ms;                 /* hover-intent before a menu opens (§6.1) */
  /* reveal tier reuses --sp-settle / --sp-settle-dur (360ms), which already exist
     and have had zero consumers. Curve for everything else: --ease-out. */

  /* ── between-control spacing ── one ladder, 2:1, no third value (§7) ── */
  --gap-item : var(--sp-8);    /* two controls in a group. Also the 44px-target floor. */
  --gap-group: var(--sp-16);   /* two groups in a row. Exactly 2 × --gap-item. */
  --gap-band : var(--sp-24);   /* a control row and the content beside it. */
}
```

### 10.1 Token → value → what it applies to

For the header rebuild to consume directly.

| Token | Value | Applies to |
|---|---|---|
| `--ctl-h` | 44px | Every control's `min-height`. Back, socials, tabs, split controls, menu rows. |
| `--ctl-h-sm` | 36px | Nav items and any control **inside a ≥44px bar**, with the `::after` hit area. §4.2. |
| `--ctl-pad` | 16px | `padding-inline` at 44. Also the tab underline's inset. |
| `--ctl-pad-sm` | 12px | `padding-inline` at 36. A split control uses `--sp-10` on its caret side only. |
| `--ctl-gap` | 8px | Icon ⇄ label inside one control, at 44. |
| `--ctl-gap-sm` | 6px | Icon ⇄ label at 36. **Label ⇄ caret at any size.** |
| `--gap-item` | 8px | Between two nav items. Between two social rows. **Floor, not preference.** |
| `--gap-group` | 16px | Between `[Back]` and the nav group; between the nav group and `[Contact]`. |
| `--ctl-r` | 14px | Every free-standing control. **Inside a `--r-pill` bar, items take `--r-pill`** (concentric rule; `999 − 6` is still 999). Inside an `--r-lg` menu with an `--sp-8` inset, rows take `--r-md`. |
| `--hair-w` / rim | `--rim-1` → `--rim-2` | Secondary and Field only. **Border width on any control is 0** — the rim is a `box-shadow`. |
| `--ico-md` | 18px | Nav icons **and** menu/social icons at desktop. Same glyph size, deliberately. |
| `--ico-sm` | 15px | Nav icons ≤640px. **Menu icons do not shrink.** §6.3. |
| `--ico-xs` | 11px | The split control's caret, and nothing else. |
| `--ico-stroke` | 1.8 | Every `.gIco`, site-wide. Already in `tokens.css`. |
| `--fs-nav` | 14px | Control label at the 36 rung. |
| `--ctl-fs` | 15px | Control label at the 44 rung. |
| `--focus-w` | 2px | Focus ring width **and** the tab underline height. One value, two uses, on purpose. |
| `--ctl-ink-strong` | `--c950` | Hover ink, selected ink, **and the focus ring**. Not the accent — §11 item 2. |
| `--dur-state` / `--dur-state-out` | 160 / 240ms | Hover in / out, everywhere. |
| `--dur-intent` | 120ms | Delay before a hover opens a split control's menu. |
| `--sp-settle-dur` | 360ms | Menu reveal, travelling indicator. Paired with `--sp-settle`. |
| `--press-scale` / `-lg` | .97 / .985 | `:active` transform. `-lg` for boxes over ~200px. |

---

## 11. Five things to reconsider before this ships

1. **Hover changing weight.** The brief says hover changes *ink and weight*. A weight
   change reflows the label under the pointer. Every kind above therefore assigns
   **weight to selection** and gives hover **ink** or **ink + rim**. If he wants
   weight on hover anyway it needs a width-reserving pseudo-element on every control
   — real ceremony for a state that lasts 300ms.

2. **The focus ring already contradicts itself, and the header is the odd one out.**
   `header.css:250` ships `outline:2px solid var(--nav-accent)` — the blue, at
   **5.59:1**. Every other focus ring on the site is `var(--c950)` at **18.42:1**.
   1.4.11 applies to the indicator specifically, so the header's is the one to
   change. One line, and the header rebuild should land with it already correct.

3. **`--accent` is rebound to green on two pages and the controls do not know.**
   `play.css:53` and `gradientlab.html` both set `:root{--accent:#0E6B3B}`. Measured:
   the Lab's focus ring is green today. Without `--ctl-accent`, "primary buttons take
   the blue" is silently false on two of eight pages.

4. **The nav's selected item is a fill, and he asked for underlines.**
   `.jbNav [aria-current]` is an `--accent-wash` pill. It shipped, he approved it,
   and a pill bar has no baseline to underline against. My recommendation is to call
   the nav *navigation* rather than *tabs* — but it is his rule, so he should confirm
   the carve-out rather than have it assumed. **This matters more now**: the header
   rebuild is adding a travelling indicator, and an indicator plus a pill fill would
   be two selection signals doing one job.

5. **`.toTop` and `.sbBtn` stop being circles.** The strict reading of "radius is a
   function of the box" makes every icon-only control a 14px squircle. The counter is
   that `.sbBtn` in the case-study player bar reads as a media transport *because* it
   is round. If the squircles look wrong on sight, `--r-full` for free-floating
   icon-only controls is the one exception I would sanction — after he looks, not
   before.

---

## 12. Demo

`button-system.html` — vanilla, no dependencies, no build, reads `tokens.css` from the
same directory. Every kind in every state, at desktop and inside a real 390px iframe,
with **the resolved value of every property read live off each control and printed
beside it** — so the numbers in this document cannot drift from the ones that render.

Three toggles, each also available as a URL parameter so a static capture can show
what the toggle shows:

| Toggle | Param | What it is for |
|---|---|---|
| Show hit areas | `?hit=1` | Paints every control's target. The 36px rung's `::after` expansion to 44 becomes visible, which is the only way to check §4.2 condition 2 by eye. |
| Slow motion 8× | `?slow=1` | 160ms → 1280ms, 240ms → 1920ms. The hover asymmetry is otherwise asserted rather than seen. Sweep the pointer across the three-control row under §4. |
| Force hover / focus | — | Freezes every grid cell in its state, for side-by-side comparison. |
| 390px | `?embed=1` | The prose-free copy the desktop page embeds in an iframe. Headless Chrome clamps a window to 500px minimum, so an iframe is the only honest 390px. |

**Verified in the running page at 1280px**, across 56 rendered controls:
3 heights (24 chip · 36 compact · 44 default), **1 easing**, 2 durations
(0.16s in / 0.24s out), `--rim-1` `.08` → `--rim-2` `.14` on Secondary hover with ink
to `#121212`, tab `::before` opacity 0 → 1 at 2px accent, `.is-sm::after` height 44px,
and no horizontal overflow at 390px.

Screenshots, `.superpowers/sdd/2026-08-02-play-page/`:

| File | Shows |
|---|---|
| `btn-desktop-full.png` | the whole page, 1280 × 11000 |
| `btn-desktop-base.png` | §1 — the shared base table, every property old vs new |
| `btn-desktop-kinds.png` | §2 — the six kinds × five states |
| `btn-desktop-modifiers.png` | §3 — the five modifiers and the compact-rung evidence table |
| `btn-hit-areas.png` | the same, with every target painted |
| `btn-desktop-motion.png` | §4 — the three tiers, the two-curve chart, the closed hover property set |
| `btn-desktop-spacing.png` | §5 — the 2:1 rhythm bar and the ladder |
| `btn-desktop-compositions.png` | §6 — split control, travelling indicator, menu rows |
| `btn-390.png` | the full system at 390px |
