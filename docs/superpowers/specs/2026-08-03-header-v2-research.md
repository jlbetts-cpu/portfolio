# Header v2 — research and build spec

**Status:** research, not executed. Nothing in any existing file has been edited.
**Supersedes:** the recommendation in `.superpowers/sdd/2026-08-02-play-page/header-report.md`.
That report's *measurements* mostly still hold and are re-used by name below; its *design* is
being walked back on Jayden's instruction after seeing it live.
**Measured in:** Chromium 148, real viewports at 1280×800 and 390×812, served from
`127.0.0.1:4199`. Every number in this document was read from `getBoundingClientRect()` or
`getComputedStyle()` on the live page or on a probe injected into it, not derived from the CSS.

---

> ### REVISION 2 — the capsule is cut
>
> **What changed.** Rev 1 recommended a bar that morphs into a capsule on scroll. On reading §1's
> finding that none of the surveyed top-tier sites does that, Jayden cut it: *"maybe I want the top
> tier site header."* §3 is now a spec for **what those sites actually do**, re-measured
> first-hand. The capsule reasoning is preserved in **§3.7 — rejected with cause**, because the
> mechanism work behind it is the reason the replacement is confidently cheap, and because if
> anyone revives the idea they should find the analysis rather than redo it.
>
> **What survived unchanged, and is not re-litigated below:** the restored old bar (§2), the
> unified component across nine pages, the sentence-case stacked lockup, the icon system (§4),
> Back as its own `arrow-left` item at full opacity with its own 44×44 target (§5.1), `Play` →
> `Mood` with only the four dots (§5.6), the roster moving into `play.html`'s existing `#moodMenu`
> with its two bugs (§5.7), no cast shadows on chrome (§6), and the hero spacing numbers (§8).
>
> **Also settled:** the `≤640px` mobile rule — **labels drop, icons stay, the active item keeps
> its label**. See §4.4, which now states this as a rule rather than as an exception to a warning
> about a state that no longer exists.
>
> **And a correction that matters more than the rest.** §1 was originally written from a delegated
> survey. Re-measuring it first-hand, **two of its per-site claims were wrong** — dub.co does not
> fade in a scrim, and Notion's wrapper does not hide. Both are corrected in §1.2 and the method
> note in §1.4 explains how to avoid repeating the error. Only sites I measured myself are now
> cited with values.

---

## 0 · The brief, and the one place it contradicts itself

Jayden's four messages, reduced to instructions:

1. **Restore the old bar.** `Work` · `About me` · the lockup · a disclosure · `Contact`.
   Keep two things from the redesign: **one component on all nine pages**, and the
   **sentence-case stacked lockup** he approved.
2. **Icons on every nav item, as a system** — "not just back, and it should be a consistent
   system." This reverses the previous pass's "no icons on nav items", which was an agent's call,
   not his.
3. **`Play` → `Mood`, four mood dots only.** The saved-heads roster moves to `play.html`.
4. **No shadows on chrome.** Shadows are for the heads. Standing rule, not a tweak.
5. Plus the five complaints: cramped / no margins, the back affordance, the abrupt social
   animation, socials on top, and the hero's spacing.
6. And the headline: **the old header, plus a capsule on scroll.**

### The contradiction, named

**The old bar was a home-page nav, not a site nav.** Its three items were
`#cases`, an About overlay toggle, and `#contact` — all in-page anchors on `index.html`. Two of
the three do not exist as destinations on the other eight pages. That is *why* the case studies
ran a different component. "Restore the old bar" and "work site-wide" collide exactly here, and
§2.2 resolves it: **the labels and the silhouette are restored; the targets are made site-wide,
and the `Play` slot becomes `Games`.** Nothing else about the old bar changes.

**Second contradiction, and it dissolved.** An island is a centred object, and "doesn't use the
margins" is a complaint about a centred object — so at first reading, "restore the margins" and
"make it a capsule" looked like the same thing pulling in two directions, resolvable only by
separating them in time. **That was wrong, and §3.3 is where it comes apart:** Raycast's island is
83.6% of the viewport wide, and the pill he rejected was 24.9%. Detachment was never the problem.
An island at the page's own column width uses the margins *by definition*, because its edges are
the margins. No morph is needed to reconcile the two, which is a large part of why §3 can
recommend a single state.

**Instruction 6 has since been withdrawn** — see the Revision 2 note. §3 now specifies what the
top-tier sites actually do; §3.7 keeps the capsule analysis as rejected-with-cause.

---

## 1 · What the field actually does

Real sites, measured in a real browser at 1440×900, sampled at five scroll positions each. §1.0 is
the method and the two corrections; §1.1b is the count; §1.2 is the values. **Every site cited with
values in §1.2 I measured myself.** §1.2b lists patterns that exist elsewhere and is explicitly not
first-hand.

### 1.0 How these numbers were produced — read this before trusting any of them

Eight sites were re-measured **first-hand** for this revision, in the Browser pane at a real
1440×900 viewport. Each was sampled at **five scroll positions — 0, 1400, 2600, back up to 1600,
and back to 0** — reading `getBoundingClientRect()` plus computed `position`, `backgroundColor`,
`backdropFilter`, `borderRadius`, `borderBottom`, `boxShadow`, `transform` and `opacity` off the
header element and its widest skinned descendant. "Identical at all 5 sample points" below means
the serialised snapshot was byte-identical, including the scroll-up sample.

**Two claims from the earlier delegated survey did not survive that re-measurement**, and both are
corrected in the table:

- **dub.co** was reported as fading a `rgba(255,255,255,.75)` + `blur(16px)` scrim in on scroll.
  Measured: it does **not**. Its skin element carries `border-b border-transparent transition-all`
  — the machinery is there — but at y=0 and y=1200 the computed values are identical
  (`background: rgba(0,0,0,0)`, `backdrop-filter: none`, `border-bottom: 1px rgba(0,0,0,0)`), and
  the page genuinely scrolled (`scrollY` 1200 of a 12215px document, verified).
- **Clerk** was reported as inverting its background light→dark on scroll. I could not confirm the
  colour inversion and have **removed the claim**. What I did verify is below.

**One honest limitation, stated so nobody over-reads the table.** A synthetic `scrollTo()` jump is
a weak test for *direction-sensitive* logic (hide-on-scroll-down / show-on-scroll-up), which
compares successive deltas and can read one large jump as a single event. **Notion is therefore
marked inconclusive rather than "does nothing"** — its wrapper did not move at any sample point,
but that is not proof it never hides under a real trackpad gesture. Every other verdict below is
about *state that should be position-derived*, where a jump is a valid test.

### 1.1 The headline finding, and it is not the one he expects

**No top-tier production site was found that converts a full-width bar into a floating capsule on
scroll.** Across the survey the `width` / `left` / `border-radius` triple never moved on any site.
The pattern exists — but it lives in component libraries and Framer/Webflow templates, not in the
work of the studios and product companies he benchmarks against.

- [shadcn.io Floating Pill Navbar](https://www.shadcn.io/blocks/navbar-floating-pill)
- [Aceternity Navbar Pill](https://ui.aceternity.com/blocks/navbars/navbar-pill)
- [Framer marketplace Floating Pill Nav](https://www.framer.com/community/marketplace/components/floating-pill-nav/)

**This is worth telling him plainly.** He asked to "copy the most modern and aesthetic headers".
The honest answer is that the scroll-to-capsule reads as *template-current*, not *studio-current*.
If he builds it, it should be because he likes it — which is a perfectly good reason — not because
it signals a high bar. He should get to disagree with this, but he should have it first.

### 1.1b The dominant pattern, with the count

Of the **8 sites measured first-hand at 5 scroll positions each**:

| Verdict | Count | Sites |
|---|---|---|
| **Header state is identical at every scroll position — nothing happens** | **6 of 8** | raycast.com, linear.app, vercel.com, anthropic.com, dub.co, notion.com* |
| Header is not sticky at all — scrolls away with the page | 1 of 8 | stripe.com |
| Header changes something on scroll | **0 of 8 confirmed** | — |
| Inconclusive for direction-sensitive hiding | 1 (*notion.com, counted above on its position-derived state) |

**The dominant pattern is: the header does nothing on scroll.** Six of eight. Not one confirmed
instance of a scroll-triggered state change in the whole set — including the two sites the earlier
survey had claimed as scroll-reactive.

That splits into two camps by **resting state**, and this is the only axis on which the good sites
actually differ:

| Camp | Count | Resting state | Members |
|---|---|---|---|
| **A — flush full-bleed band** | **4 of 6** | spans the viewport edge-to-edge at `top: 0`, height 56–73px, separated from the page by either an opaque fill or a 1px bottom hairline | linear.app, vercel.com, anthropic.com, dub.co |
| **B — always-detached island** | **2 of 6** | inset from the top edge and from both side edges, rounded, its own ground, page visible above and beside it | raycast.com, clerk.com |

Within camp A the split on *material* is even: **2 opaque, 2 transparent-with-blur**. Nobody in
either camp casts a shadow.

### 1.2 The measured values

**Everything in this table I read myself.** Viewport 1440×900.

| Site | Resting state — measured | On scroll |
|---|---|---|
| **raycast.com** — camp B | Outer fixed wrapper 1440×92 at `top:0`, fully transparent. The **visible** bar is an inner div: **`top: 16`, `left: 118`, `1204 × 76`** (so **118px side margins = 83.6% of viewport width**), `border-radius: 16px`, `background: rgba(0,0,0,0)`, `backdrop-filter: blur(5px)`, `border: 1px rgba(255,255,255,.06)`, `box-shadow: rgba(255,255,255,.15) 0 1px 1px 0 inset` — **an inset highlight, not a cast shadow** | **Identical at all 5 sample points**, including scroll-up |
| **linear.app** — camp A | `position: fixed`, **1440 × 73 at `top:0`, flush**, `background: rgba(0,0,0,0)`, `backdrop-filter: blur(20px)` **already at scroll 0**, `border-bottom: 1px rgba(255,255,255,.08)`, `box-shadow: none`, `border-radius: 0` | **Identical at all 5 sample points** |
| **vercel.com** — camp A | `position: sticky`, **1440 × 64 at `top:0`, flush**, **`background: rgb(0,0,0)` — fully opaque**, no blur, no shadow, no border, no radius | **Identical at all 5 sample points** |
| **anthropic.com** — camp A | `position: sticky`, **1440 × 68 at `top:0`, flush**, **`background: rgb(240,238,230)` — fully opaque**, no blur, no shadow, no border, no radius | **Identical at all 5 sample points** |
| **dub.co** — camp A | `position: sticky`, 1440 × 56 at `top:0`, flush, transparent; skin element is `border-b border-transparent transition-all` | **Identical.** The transition machinery exists and never fires. **Corrects the earlier claim.** |
| **clerk.com** — camp B | `position: sticky` with `top-2` (= 8px), height **42px**, layered `backdrop-filter: blur(1px)` skin at `inset: 0`, no radius on the sticky root | Its `top` reads **48 → 8** once it sticks. **That is `position: sticky` doing its job, not an animation** — the flow position is 48px down, the stuck position is 8px. Width, height, radius and material do not change. **The colour-inversion claim is withdrawn — unverified.** |
| **stripe.com** — camp: none | `position: relative`, 1440 × 76, transparent, no border, no shadow | `top` tracks scroll exactly: **0 → −1400 → −2600 → −1600**. It genuinely scrolls away. |
| **notion.com** — camp A | `position: sticky`, 1440 × 64 at `top:0`, flush, transparent wrapper | No change at any sample point. **Marked inconclusive for hide-on-scroll** per §1.0 — jump-scrolls do not reliably exercise direction-sensitive logic. |

### 1.2b The patterns that exist but are not in the good tier

Kept because the brief asked for the full taxonomy, and because knowing what to *avoid* is worth
as much as knowing what to copy. These are **not** first-hand verified unless marked.

| Pattern | Where it actually lives | What it costs / where it fails |
|---|---|---|
| **Shrink-on-scroll** | Airbnb's collapsing hero search; Policybazaar (in Chrome's own scroll-driven-animations case study) | Animating `height`/`font-size` is layout-tier, and a header with two heights has two correct `scroll-padding-top` values and can only have one (§7.2). |
| **Hide on scroll down / show on scroll up** | Originated at Medium; popularised by [Headroom.js](https://wicky.nillia.ms/headroom.js/) | Takes the back affordance away exactly when you are deepest in a case study. Rejected in the previous round; the reason still holds. |
| **Scroll-to-capsule (bar → floating pill)** | [shadcn.io Floating Pill Navbar](https://www.shadcn.io/blocks/navbar-floating-pill) · [Aceternity Navbar Pill](https://ui.aceternity.com/blocks/navbars/navbar-pill) · [Framer marketplace Floating Pill Nav](https://www.framer.com/community/marketplace/components/floating-pill-nav/) | **Zero production instances found.** Component-library and template territory. §3.7. |
| **Dynamic-Island-style morph** | Dribbble concepts and GitHub recreations | Needs a FLIP or shared-element animation and a reason for the shape to change. There is no such reason in a five-item portfolio nav. |

### 1.3 The three lessons

1. **The good tier does nothing on scroll.** 6 of 8. The expensive behaviour was not optimised —
   it was designed out. Raycast binds no scroll listener and blurs at 5px, not 20.
2. **Where anything appears to change, it is the browser, not the site.** Clerk's `top: 48 → 8` is
   `position: sticky` resolving; nobody wrote an animation for it. That is worth internalising:
   the "premium" feel in these headers costs zero JavaScript.
3. **Nobody casts a shadow.** Across all eight, separation is done with **an opaque fill, a 1px
   hairline, or a 1px inset highlight** — never `box-shadow` with an offset and a blur. Jayden's
   no-shadow rule, arrived at independently, is what the field already does.

All three point one way, and it is the way §3 now goes: **pick one resting state, make it good,
and leave it alone.**

---

## 2 · The bar

### 2.1 What is being restored, and what is being kept — explicitly

Because "the old header" and "works site-wide" are in tension, here is the line, property by
property.

**Restored from the pre-`54c7f15` bar:**

| Property | Old value | Measured |
|---|---|---|
| Full page width, aligned to the gutters | `nav{display:flex}` inside `.wrap{padding:0 40px}` | probe: nav spans **x 40 → 1240** at 1280, i.e. exactly the content column; `Work` at **x = 40**, `Contact`'s right edge at **1240** |
| Three zones with equal-basis outer groups | `.navGroup{flex:1 1 0}` | this is what makes the wordmark *geometrically* centred regardless of group widths — measured at 640.0px against a viewport centre of 640.0px even with an asymmetric Back arrow in the leading group (§3.7). **Do not drop it:** without it, adding Back to a sub-page pushes the wordmark off centre |
| No pill, no ground, no rim at rest | — | ink on paper |
| Bar height | 44px content + 32px top padding = **76px** total chrome | vs the redesign's **130px** on home |
| Five slots: 2 · mark · 2 | `Work` `About me` \| mark \| `Play` `Contact` | |

**Kept from the redesign (and only these):**

| Property | Why it survives |
|---|---|
| **One `.jbNav` on all nine pages** | Explicit requirement. The case studies do **not** go back to `1fr auto 1fr`. |
| **The sentence-case two-line lockup** | Explicitly approved, called perfect. Keeps `--fs-mark` 17px / weight 600 / `--tr-mark` / `--mark-lh` 1.075 / `--mark-flush` −.049em / `--mark-inset` 11px — every one of those is a measured optical correction (header-report §3) and re-deriving them would be waste. |
| `body[data-nav]` as the single source of the active state | One attribute, `aria-current` derived from it. |
| `data-surface="ink"` for `gradientlab.html` | Six custom properties, no second component. |
| The `::after` 44×44 target under a smaller ink box | Keeps targets legal without visible padding. |
| `.jbStick{pointer-events:none}` + `.jbNav{pointer-events:auto}` | The only reason `play.html`'s pitch and the Lab's canvas stay clickable under the header. |

**Deleted:**

| Thing | Why |
|---|---|
| `.jbTop` — the social row above the bar | Jayden: "Social media icons on top not needed." 58px of chrome at 1280, 52px at 390. |
| `.jbBarSoc` / `.jbBarSep` — the in-bar socials | They existed only to catch the row as it scrolled away. With no row, no catch. |
| The `isLifted` shadow-deepening | Shadows are out (§6), and nothing replaces it — the bar has one state (§3.5). |
| `header.js`'s scroll listener | Deleted, replaced by **nothing** (§3.6). |
| `Home` as a nav item | The lockup is the home indicator; two leading slots to one URL was the last redundancy in the bar and the header report already flagged it. |

### 2.2 The bar, resolved

```
[Back]  Work · About me        Jayden          Games · Contact
                                Betts
```

- **`Work`** → `index.html#cases`. In-page on home, a link home on the other eight. Lit
  (`aria-current="true"`) on the five case studies, because a case study *is* the work.
- **`About me`** → a `<button aria-expanded>` on `index.html` (the overlay), an `<a>` to
  `index.html#about` everywhere else. Keeps `#navAbout`, so `hero-engine.js:1560` still owns it.
- **The lockup** → `<button aria-current="page">` on home (nowhere to go; clicking his name is how
  he introduces himself, and `hero-engine.js:1520` binds the wink), `<a href="index.html">` with a
  Back icon on the other eight and while the About overlay is open.
- **`Games`** → `play.html`. `aria-current="page"` there, `"true"` on `headmaker.html`.
- **`Contact`** → `#contact`. Verified present on every page that scrolls: `index.html` has
  `<footer class="siteFoot" id="contact">` and so do all five case studies (`apollo.html:580`,
  with LinkedIn, Instagram and email in one sentence).

**Why `Games` and not `Mood` in the fifth slot.** Three reasons, and the third is decisive:

1. **Mood is not a destination, it is a control on the hero head** — and the head exists on
   exactly one of the nine pages. A site-wide component whose fifth item is present on 1/9 pages
   reintroduces the per-page inconsistency the unification was built to kill.
2. **It costs the phone.** Measured at 390px (budget 366px): the home bar with `Mood` in it is
   **407.9px** — 42px over. Without it, **353px** — 13px spare. On a sub-page with Back it is
   **455.9px**, 90px over.
3. **Without it, `play.html` has no route from the header at all.** The old bar reached Games
   *through* the Play menu (`<a class="moodGo" id="playGames" href="play.html">Games</a>`, old
   `index.html:1081`). Jayden has now emptied that menu down to four dots — so the route goes with
   it unless `Games` takes the slot. It occupies the same position, same silhouette, same
   two-per-side shape as `Play` did.

**Mood stays where the last pass put it: a dock directly under the head.** He did not object to
the move — he objected to the name and the contents, both of which §5 fixes.

### 2.3 The width budget — the numbers that decide mobile

Desktop, 1280px viewport, `--fs-nav` 14px / `--fs-mark` 17px / `--ico-md` 18px / item padding
`0 var(--sp-16)`:

| Bar | Measured |
|---|---|
| home: mark + `Work · About me · Games · Contact`, all iconed | **535.8px** |
| sub-page: Back + mark + the same four | **581.8px** |
| home, three items (no `Games`) | 440.3px |
| intrinsic width of the full 5-zone bar with icons | **564.8px** |

→ The bar's **content** is 536–582px wide inside a **1200px** island, so the three zones sit in
618–664px of free space distributed by `flex: 1 1 0`. That is the point of the full-column island
rather than a hugging pill: the leading group sits **on the page gutter**, the trailing group on
the opposite gutter, and the wordmark dead centre. Nothing is squeezed and nothing floats.

(These same measurements set `--bar-shut` in the rejected capsule design; retained in §3.7.)

Mobile, 390px viewport, budget `390 − 2×12` = **366px**, `--fs-nav` 13px / `--fs-mark` 15px /
`--ico-md` 16px / item padding `0 var(--sp-8)`:

| Bar | Measured | Verdict |
|---|---|---|
| home, 4 items, labels + icons | 407.9 | ✗ 42 over |
| sub-page, Back + 4 items, labels + icons | 455.9 | ✗ **90 over** |
| sub-page, Back + 3 items, labels + icons | 379.1 | ✗ 13 over |
| home, 4 items, labels only (no icons) | 319.9 | ✓ 46 spare |
| sub-page, Back + 4 items, labels only | 367.9 | ✗ 2 over |
| **sub-page, Back + 4 items, icons only + the active item keeps its label** | **327.8** | **✓ 38 spare** |
| sub-page, Back + 4 items, icons only, no labels at all | 286.4 | ✓ 80 spare |

**This is the single hardest consequence of "icons on every item": at 390px, labels + icons does
not fit on any page, and on a sub-page it is 90px over.** There is no arrangement of padding that
recovers 90px.

**Recommended answer — `≤640px`: labels drop, icons stay, and the active item keeps its label.**
Measured 327.8 of 366 with Back present, 38px spare, every target 44×44, no overflow. It is
consistent-system-compliant (every item still carries its icon), it gives the phone a stronger
active state than the desktop has (the lit item is the only *word* in the row), and it degrades
the right way on `gradientlab.html` where nothing is lit and the bar is at its narrowest.

Two things that make the unlabelled state legible rather than a puzzle:
- Each item keeps an `aria-label` matching its desktop label, so nothing changes for screen
  readers.
- **Back is the one item that never needs a label at any width.** A leading-edge `arrow-left` is
  the most universally read control on the web; "which glyph means Work" is not.

### 2.4 Alignment — closing "doesn't use the margins" with numbers

| | Old bar | Shipped redesign | Proposed |
|---|---|---|---|
| Bar left edge @1280 (index) | **40px** = the page gutter, = the `h1`'s left edge | **480.8px** | **40px** |
| Bar width @1280 (index) | 1200px = the whole content column | **318.3px** (24.9% of viewport) | **1200px** (93.8%) |
| Dead margin each side | 0 | **480.8px** | 0 |
| Bar left edge @1280 (apollo) | 80px = the chapter rail's left edge | **399.8px** (the `h1` starts at 209.6) | 80px |
| Chrome above content, home | **76px** | **130px** (+71%) | **76px** |
| Chrome above content, sub-page | 76px | 72px | 76px |
| Reference: raycast.com | — | — | 1204 of 1440 = 83.6% |

The redesign did not merely fail to use the margins — it used **less** margin than the old bar and
**more** height. Nothing in it touched the 40px gutter at any point.

**How the bar learns each page's column.** `.jbStick` must stay outside `.wrap` (on `index.html`
`.wrap` closes at the end of the hero, so a sticky bar inside it unsticks the moment the hero
leaves). So the component takes two properties from its host page:

```css
/* header.css — defaults */
.jbStick{ --bar-gutter: var(--sp-16-40); --bar-open: 1200px; }
```
```css
/* index.html   */  .jbStick{ --bar-open: 1200px; --bar-gutter: 40px; }  /* .wrap 1280 − 2×40 */
/* case studies */  .jbStick{ --bar-open: 1120px; --bar-gutter: 80px; }  /* .wrap 1200 − 2×40, inside a 1280 page */
/* play, lab, headmaker: leave the defaults — full-viewport pages, no page column to match */
```

Two lines per page, and the bar's edges become that page's own content edges by construction, at
every width. On a case study that puts the leading edge exactly on the chapter rail's left edge
(both 80px) — an alignment the page has and the header currently ignores.

### 2.5 "Cramped" — the internal spacing

The pill is 52px tall around a 42px ink box: **5px of air above and below a two-line wordmark**,
with `--gap-bar` 2px between items and a hairline 6px from the mark.

The largest part of this fixes itself: the bar goes from 318px to 1200px wide, so the items stop
being packed shoulder-to-shoulder and spread across 618–664px of free space (§2.3). Three changes
finish it:

| Token | Now | Proposed | Why |
|---|---|---|---|
| item padding-inline | `var(--sp-12)` = 12px | **`var(--sp-16)` = 16px** ≥761px | 12px around a 14px label inside a pill is the pinch. `--sp-16` already exists. |
| `--gap-bar` between items | 2px | **`var(--sp-8)` = 8px** (`var(--sp-4)` = 4px ≤640) | 2px between two 44px targets is a thumb hazard and reads as a jam. |
| `--pad-bar` | 5px | **6px** | keeps the bar at 52px (42 + 2×5 = 52; 42 + 2×6 = 54 — so drop `--bar-mark-h` to 40 and hold 52). **The bar must stay 52px: `--nav-h` is consumed by five case studies' rail offsets and every `scroll-margin-top`.** |

---

## 3 · The header, at rest — and it stays there

### 3.1 The recommendation, in one line

**An always-detached island at the page's own column width, inset 16px from the top edge, with an
opaque ground and a hairline rim — and nothing changes on scroll, ever.**

"It does nothing on scroll" is the finding, the recommendation, and the whole spec. It is also the
cheapest and most robust option on the table: no observer, no listener, no class, no state, no
animation, nothing to test at a scroll threshold, nothing to get wrong on the two pages that
cannot scroll.

### 3.2 Why the island (camp B) and not the flush band (camp A)

Camp A is numerically dominant — 4 of the 6 do-nothing sites are flush full-bleed bands. I am
recommending camp B anyway, for three reasons that are specific to this site rather than to taste:

1. **The paper texture.** `index.html`'s `.bgtex` is a grayscale paper image at `opacity: .4`,
   masked across the top `165vh` and at full strength at y=0. A full-bleed opaque band cuts a hard
   horizontal edge straight across it. An island lets the paper run above and beside the bar, which
   is the only treatment that does not fight the page's own material.
2. **Two of the nine pages are full-viewport stages.** A translucent or opaque band across the top
   of `gradientlab.html`'s generative mesh or `play.html`'s pitch fights the exact surface those
   pages exist to show. This was the original and still-correct argument for a pill
   (header-report §1): **an island brings its own ground, so it works over anything.** Camp A cannot
   serve those two pages; camp B serves all nine with one component — which is the hard requirement.
3. **He already approved the shape.** "The header has the bones of a good header." The island keeps
   the bones and fixes the proportion, which §3.3 shows is the actual defect.

### 3.3 The crux: the island was never the problem — a 25%-wide island was

This is the single most useful number in the revision.

| | Viewport | Bar width | **% of viewport** | Margin each side |
|---|---|---|---|---|
| **raycast.com** (measured) | 1440 | 1204 | **83.6%** | 118px |
| **What shipped and he rejected** | 1280 | 318.3 | **24.9%** | **480.8px** |
| **Proposed** | 1280 | 1200 | **93.8%** | 40px — *the page's own gutter* |
| **Proposed @390** | 390 | 366 | 93.8% | 12px |

Raycast's header is a detached island **and** it uses the margins, because it stops 118px short of
each edge rather than 481px. Jayden's complaint was never with detachment; it was with a 318px stub
floating in 962px of dead space. At the page's column width the island's left and right edges *are*
the 40px page gutters and *are* the `h1`'s edges — the alignment §2.4 asks for, delivered by a
shape he has already said he likes.

This also retires the contradiction flagged in §0: there is no longer any tension between "use the
margins" and "be an island", because the island is as wide as the margins allow.

### 3.4 The resting state, specified

```css
.jbStick{
  --bar-gutter: var(--sp-16-40);        /* 40px ≥881, 16px below — matches .wrap */
  --bar-open  : 1200px;                 /* per page; case studies set 1120px  (§2.4) */
  --nav-inset-top: var(--sp-16);        /* 16px — Raycast's inset, measured   */

  position:sticky; top:0; z-index:100;
  display:flex; justify-content:center;
  padding:var(--nav-inset-top) var(--bar-gutter) var(--sp-8);   /* 16 + 52 + 8 = 76px */
  pointer-events:none;
}
.jbStick>*{pointer-events:auto}
.jbStick.isFixed{position:fixed;left:0;right:0}   /* play.html, gradientlab.html */

.jbNav{
  width:100%; max-width:var(--bar-open);
  min-height:var(--nav-h);              /* 52px, unchanged */
  display:flex; align-items:center; gap:var(--sp-8);
  padding-inline:var(--pad-bar);
  border-radius:var(--r-pill); corner-shape:var(--corner);
  background:var(--nav-mat);            /* --mat-3-solid  → #FDFDFD, fully opaque */
  box-shadow:var(--nav-rim);            /* --rim-2 only. No cast shadow. No blur.  */
}
.jbNav[data-surface="ink"]{
  --nav-mat:var(--mat-i3-solid);        /* rgba(18,18,18,.92) */
  --nav-rim:var(--rim-i2), var(--rim-top);
}
```

| Property | Value | Why this value |
|---|---|---|
| Detached or flush? | **Detached**, 16px from the top edge | Raycast's measured inset, and it is the number that makes the page read as continuing *behind* the bar |
| Width | the page's content column — 1200px on `index.html`, 1120px on the case studies | §3.3; the two custom properties are already specified in §2.4 |
| Total chrome | **76px** (16 + 52 + 8) | **Exactly the old bar's 76px.** Not a coincidence worth hiding — it is the budget he was happy with |
| Bar height | `--nav-h` **52px**, constant | Five case-study rails and every anchor offset derive from it |
| Ground | **opaque** `--mat-3-solid` (`#FDFDFD`) / `--mat-i3-solid` on ink | vercel.com and anthropic.com are both fully opaque; opacity deletes the mobile ghosting bug outright (§6.3) |
| Rim | `--rim-2` — inset 1px `rgba(18,18,18,.14)` | Composites to ≈`#DCDCDC` ≈ **1.31 : 1** against the page, which is exactly the site's own `--c100` hairline value (1.30 : 1). Not a new visual weight — the site's hairline, wrapped round a bar |
| Inset highlight | `--rim-top` — **ink surface only** | `tokens.css` already ships `--rim-top: inset 0 1px 0 rgba(255,255,255,.55)`. That is precisely Raycast's `rgba(255,255,255,.15) 0 1px 1px inset`. It reads on a dark ground and is invisible on a light one, so it earns its place on `gradientlab.html` and nowhere else |
| Cast shadow | **none, anywhere** | §6. All eight measured sites agree |
| Blur | **none, anywhere** | §6.3 |
| Radius | `--r-pill` (caps at 26px on a 52px bar) | Keeps the shape he approved. If it reads too soft at 1200px wide, `--r-lg` (20px) is the fallback — Raycast uses 16px on a 76px bar, a 0.21 ratio, which maps to ~11px here, so anything from 14 to 26 is defensible |

### 3.5 What changes on scroll

**Nothing.** No class, no threshold, no observer, no listener, no transition.

Stated positively, because it is a feature and not an absence: the bar is in its final state the
moment it paints, at every scroll position, on every page, on first load, at every viewport, with
JavaScript disabled, before fonts finish loading, and during the tournament. There is no second
state to design, to test, to get wrong on a page that cannot scroll, or to explain.

### 3.6 What this deletes — including the mechanism from Rev 1

The Rev-1 recommendation was already careful about cost. Doing nothing is cheaper still, and it is
worth being precise about what falls away:

| Thing | Rev 1 | Now |
|---|---|---|
| `header.js:40` — `window.addEventListener("scroll", …)` calling `getBoundingClientRect()` on **every scroll event, unthrottled** (the site's only unthrottled scroll handler; every other one, on `index.html`, the five case studies and `play-engine.js`, is rAF-gated) | deleted, replaced by an observer | **deleted, replaced by nothing** |
| `.jbSentinel` + `IntersectionObserver` | required | **still needed** — one sentinel, one class toggle, consumed by §6.2's inset. It is the only scroll machinery that survives, and it replaces `header.js`'s unthrottled listener rather than adding to it |
| `--bar-shut`, `--close` (the capsule's width morph) | required | **not needed** |
| `html.jbShrunk` + its sentinel | required | **still needed** — now drives §6.2's inset only |
| `<html class="jbShrunk">` on the two fixed pages | required | **still needed** — static, not toggled; §3.8 |
| `.jbNav.isLifted` + the `--sh-2 → --sh-3` shadow deepening + its `transition: box-shadow` | deleted | deleted |

**Net effect on `header.js`: its entire scroll section (lines 26–42) is removed and nothing
replaces it.** The file keeps only the About-state mirroring. The site ends this change with one
fewer scroll listener than it started with and no new observers — which is the outcome the
performance rules were reaching for, arrived at by removing the requirement rather than by
optimising the implementation.

**The composite-only discipline still governs**, because two things in the header do still animate
— just not on scroll: the nav items' hover/press (`background-color`, `color`, `transform: scale`)
and the Mood disclosure's open/close (`opacity`, `transform`). Both are already correct. The rule
that produced §3.3 of Rev 1 — *move things with `transform`, reveal things with `opacity`, never
animate a shape* — stands as the standing rule for anything added to this component later.

### 3.7 The scroll-to-capsule — rejected, with cause

Preserved rather than deleted, so that a future pass finds the analysis instead of redoing it, and
so the rejection is legible as a decision rather than as an omission.

**What it was.** The full-width bar's two nav groups would close inward around the wordmark into a
620px capsule, triggered by a 1px sentinel observed with `rootMargin: '-64px'`.

**The mechanism was sound, and was verified.** `.navGroup{flex:1 1 0}` makes the wordmark centred
by construction: measured at bar widths 1200, 620 and 600, the mark's centre held at **640.0px
against a viewport centre of 640.0px** — it never moves, so the capsule is just the two groups
translating around a fixed pivot. That made the whole animation `transform: translateX()` on two
elements plus `opacity` on a static-geometry `::before` ground: **zero layout, zero per-frame paint,
zero rAF, no JS measurement**, with `--close: max(0px, calc((var(--bar-open) - var(--bar-shut)) / 2))`
as pure CSS arithmetic that self-clamps to `0px` on phones.

**Why it is cut anyway.** Zero of the surveyed production sites do it (§1.1). It is a
component-library pattern. Jayden's own read on seeing that: *"maybe I want the top tier site
header."*

**Two findings from that work that outlive it and are used above:**

- The `flex:1 1 0` centring proof is why §3.4 can put an asymmetric Back arrow in the leading group
  without the wordmark drifting off centre.
- The measured cost of the rejected alternatives is why §3.4 is confident that an opaque, unblurred,
  unshadowed bar is not a compromise: `border-radius` is paint-tier and repaints the whole layer;
  `backdrop-filter` forces layer creation and composites on the **main thread**; animating both
  together is the worst combination available. A static bar pays none of it.

**If it is ever revived**, the numbers are: `--bar-shut: 620px` (widest measured bar, a sub-page
with Back and four iconed items, is 581.8px + 38px slack), `--sp-settle-dur` 360ms for the groups,
`--ease-out-dur` 160ms for the ground so it lands at ~44% of the motion, and
`prefers-reduced-motion` is already handled because `tokens.css` sets `--sp-settle-dur: 1ms`.

**Also worth keeping on file: `animation-timeline: scroll()` was not the answer either**, and would
not have been even if the capsule had shipped. Support as of Aug 2026: Chrome/Edge **115**, Safari
and iOS Safari **26.0**, **Firefox stable does not ship it** (caniuse lists first stable at **156**;
FF 154 shipped 18 Aug 2026). **caniuse global 83.66%, not Baseline.** And the obvious feature test
is wrong: `@supports (animation-timeline: scroll())` alone passes in Firefox Nightly's partial
implementation while giving materially wrong timing, so the correct test is
`@supports ((animation-timeline: scroll()) and (animation-range: 0% 100%))` —
[Bramus, who owns the feature at Chrome DevRel](https://www.bram.us/2024/09/24/feature-detecting-scroll-driven-animations-you-want-to-check-for-animation-range-too/)
and [Google's own shrinking-header guide](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/shrinking-header-on-scroll.md)
both call the second half mandatory.
([caniuse](https://caniuse.com/mdn-css_properties_animation-timeline_scroll) ·
[MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline/scroll) ·
[WebKit Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/))

Likewise **scroll-state container queries** (`@container scroll-state(stuck: top)`) — Chrome/Edge
**133**, caniuse global **68.45%**, absent from Firefox and Safari. Neither is needed now.

### 3.8 The two pages that never scroll — now a non-issue

`play.html` and `gradientlab.html` compute `overflow: hidden` on both `html` and `body`, with
`scrollHeight === innerHeight === 800` (verified). Under Rev 1 they needed a static `jbShrunk`
class to pin them into the correct state.

**They still need `jbShrunk`, but set once rather than toggled.** Rev 2 kept two states after all —
not the capsule's width morph, but §6.2's inset, where the bar drops 6px clear of the viewport edge.
A page that cannot scroll can never trip the sentinel, so it would otherwise sit forever in the
flush-to-edge state that exists only for the top of a scrollable page. Both fixed pages therefore
ship `<html class="jbShrunk">` as static markup: one attribute, no observer, no listener.

That is a real reduction from Rev 1 even so — the class survives, but the machinery around it does
not: no sentinel bound, no scroll handler, no measurement, and nothing to keep in sync. The other
page-specific markup is unchanged and was already correct: `.jbStick.isFixed` (a sticky element on
a non-scrolling page is pointless) and `data-surface="ink"` on the Lab. `headmaker.html` scrolls
normally and needs nothing.

**Caveat worth stating plainly:** an earlier draft of this section claimed these pages "need
nothing", written in the window after the capsule was cut but before §6.2's inset was settled as
the surviving scroll behaviour. That was wrong, and §3.6's table carried the same error. Both are
corrected; if you find a copy still saying "need nothing", this paragraph supersedes it.

## 4 · The icon system

### 4.1 What already exists, and the regression in it

The site's pack is **Tabler Icons (MIT)**, adopted 2026-07-27, with a standing rule: paste the
outline SVG carrying only `class`, `viewBox` and path data — strip `width`, `height`, `stroke`,
`stroke-width`, `stroke-linecap`, `stroke-linejoin`, because CSS owns them. The licence notice
lives at the top of `index.html` and MIT requires it be retained.

**The rule was followed and then nothing put the values back.** Measured on the live page:

| Class | `stroke-width` computed | `stroke-linecap` | `stroke-linejoin` | Rendered stroke at its box size |
|---|---|---|---|---|
| `.gIco` (18px box, 24 viewBox) — 40+ uses | **1px** (the SVG default; *no CSS rule sets it*) | **butt** | **miter** | **0.75px** |
| `.jbArrow` (15px box) — header only | 1.8px | round | round | 1.13px |

Two consequences. First, the site ships **two different icon renderings**, and the larger set is
the wrong one: Tabler's own drawings are round-cap / round-join, and stripping the attributes
dropped that with nothing to restore it, so every `.gIco` on the site currently renders with
mitred corners Tabler never intended. Second, at **0.75px** the icons are roughly half the weight
of the labels beside them — a 14px/400 Instrument Sans stem measures ~1–1.5px (canvas alpha scan
at 14px/400 → 1px, 17px/600 → 2px; quantised to whole pixels, so read it as a range, not a point).

**Fix, one rule, site-wide:**

```css
.gIco{ width:var(--ico-md); height:var(--ico-md); flex:0 0 var(--ico-md);
       stroke:currentColor; fill:none;
       stroke-width:var(--ico-stroke);            /* 1.8 */
       stroke-linecap:round; stroke-linejoin:round; }
```

At `--ico-md` 18px on a 24 viewBox, `--ico-stroke: 1.8` renders **1.35px** — inside the label's
stem range. At the mobile 16px box it renders 1.20px against a 13px label. That is the whole
optical argument for 1.8, and it is why 1.8 is the right single value rather than a compromise.

### 4.2 The system, stated as rules

| Rule | Value |
|---|---|
| Family | Tabler Icons **outline** only. Never the filled set — it is a different pack with different optical weight. |
| Grid | 24×24 `viewBox`, always. |
| Box | `--ico-md` **18px** ≥641px, **16px** ≤640px. One token, one step. |
| Stroke | `--ico-stroke` **1.8**, round cap, round join. **CSS owns it; the markup never carries it.** |
| Colour | `currentColor`, always. No icon has a colour of its own. |
| Alignment | `align-items: center` against the label inside a 38px flex item — **not** baseline. The label is a single 14px line in a 38px box; baseline-aligning a 18px square sits it 2–3px low. |
| Gap to label | `var(--sp-6)` = 6px. |
| Silhouette | Prefer glyphs whose primary form is one enclosing shape, so the set shares an optical mass. |
| Active state | The item's ink goes to `--nav-accent`; the icon follows via `currentColor`. **One rule, no per-state icon variant, no outline→filled swap.** A filled icon would make the active item the heaviest object in the bar. |
| Never | recolour, re-weight, or replace **Jayden's photographic mood dots** (`.camDot` / `.cookieDot` / `.discoDot` / `.heartDot`). They are his artwork and he has already pushed back once on their removal. |

### 4.3 The set

| Slot | Tabler glyph | Note |
|---|---|---|
| Back | `arrow-left` | Its own item at the leading edge — see §5.1. Never a chevron. |
| Work | `briefcase` | alt `layout-grid` if `briefcase` reads too corporate. |
| About me | `user` | Matches the person glyph in his reference screenshot. |
| Games | `device-gamepad` | **Already in the codebase** — it is the icon on the old Play menu's Games row and on `play.html`'s menu. Reuse verbatim. |
| Contact | `mail` | Already in the codebase as the `.jbGlyph` mail path; swap the filled version for Tabler's outline `mail` so it joins the system. |
| Mood (hero dock only) | **the current mood's own photo dot** | The one deliberate exception, and it is a readout, not decoration — the trigger states which mood is live. Size it to `--ico-md` 18px so its optical box matches the line icons, and give it a 1px `--c100` ring: an 18px photograph next to a 1.35px stroke otherwise reads much heavier. That ring is the one measured adjustment the exception needs. |

`device-gamepad` and the mail path are already in the repo, so this is four new glyphs, not six.

### 4.4 Do labels ever drop, leaving icons alone?

The coordinator asked whether the obvious capsule move is right. **No — and this one is worth
holding the line on.** Five reasons:

1. **It is a content change mid-scroll.** Dropping a label changes a text box's width, which is
   the one thing in this whole design that genuinely re-runs line-breaking. Everything else in §3.3
   is `transform` and `opacity` precisely so that no text is ever measured during the animation;
   dropping labels puts the reflow straight back in.
2. **It halves the bar's information exactly when the user is deepest in a page** and most needs
   to know where they are.
3. **It destroys the active state.** A lit glyph with no name is a worse you-are-here indicator
   than a lit word, and a real active state is on the non-regression list.
4. **It is not what he liked.** His reference screenshot showed icons *beside* labels. Icons
   *instead of* labels is a different design.
5. **It doubles the states the icon system must serve** — every glyph would need to work labelled
   and unlabelled, which is where one-off exceptions start.

Labels drop in exactly one place, and for a different reason: **`≤640px`, where they do not fit**
(§2.3). That is a width constraint with a measured number behind it, not a stylistic move, and
there the active item keeps its label so the row is never wordless.

---

## 5 · The five complaints, answered

### 5.1 "The back button looks weird, no icons"

Read both ways, the sentence resolves one way, decisively:

- *Reading A — "it lacks an icon."* It does have one.
- *Reading B — "it should not have icons."* Ruled out by his own follow-up: **"all the different
  options need icons, not just back."** That sentence presupposes Back correctly has one and
  complains that its siblings do not. His reference screenshot is the same evidence.

So: **the complaint is that Back is the only iconed thing in the bar, which makes its glyph read
as arbitrary rather than as part of a system.** Fixing the system fixes the complaint. Two changes
beyond that:

1. **Back stops being fused to the lockup.** Today it is a 15px chevron at **opacity .55**,
   injected inside the lockup's own `<a>` (`header.js:70`), which is why it reads as stray
   punctuation. It becomes **its own item**: Tabler `arrow-left`, `--ico-md` 18px, `--ico-stroke`
   1.8, **full opacity**, its own 44×44 target, at the leading edge, `var(--sp-8)` clear of the
   lockup.
2. **That also fixes an accessibility oddity.** Today one element's accessible name flips between
   `"Jayden Betts, home"` and `"Back — Jayden Betts, home"` depending on overlay state. Split into
   two controls, each has one stable name: `"Back"` and `"Jayden Betts, home"`.

Cost, honestly: the merge into the lockup was bought with the 390px budget (header-report §6). A
separate Back costs ~+10px over the merged chevron at mobile scale. The measured mobile bar with
a separate Back and icon-only items is **327.8 of 366**, so it is paid for by §2.3's label drop.

### 5.2 "Animation opening social media is too abrupt"

The social row is being deleted (§5.3), so **the fix is deletion** — but the diagnosis matters
because the same mistake will recur, so here it is with numbers.

The transition is `max-width 0 → var(--bar-soc-max)` + `opacity` + `visibility`, all on
`--sp-quick` over `--sp-quick-dur` = **300ms** (`header.css:195`). Three things are wrong:

1. **`--bar-soc-max` is 190px; the content is 136px wide** (measured). So the reveal *visually*
   completes when `max-width` crosses 136/190 = **71.6%** of its value range. On `--sp-quick`'s
   `linear()` curve, 0.716 falls between the stops at 26.3% (0.6586) and 31.6% (0.7524) →
   **~29.5% of 300ms ≈ 88ms**. **Two-thirds of the timeline animates nothing you can see.**
2. **`--sp-quick` is front-loaded.** Half the distance (0.5) is reached at ~19.7% → **59ms**.
   Opacity is at 0.875 by 42% (126ms). The curve is a fast-out spring — the right easing for a
   press, the wrong one for a reveal.
3. **It moves the whole bar.** The pill grows 318px → ~467px, and being centred, **both edges slide
   74px** in that same ~88ms. That is the abruptness he is actually seeing.

**The rule, for next time:** for a reveal, use `--sp-settle` (360ms; reaches 0.5 at ~28% of the
timeline, not 20%), animate `opacity` + `transform: translateX(-6px)` on the *items*, and if a
container must resize at all, size the animated range to the **content** (`max-width: 136px`), not
to a round number above it, so the whole timeline is visible.

### 5.3 "Social media icons on top not needed"

`.jbTop` is deleted, and `.jbBarSoc` / `.jbBarSep` go with it — they existed only to catch the row
as it left. Saving: **58px of chrome at 1280, 52px at 390**, on the home page only.

Where socials live instead — three places, all of which already exist:

1. **`Contact` returns to the bar** as a labelled nav item on all nine pages. That is the restored
   old bar and it is the single most direct answer to "Contact was removed".
2. **Every page's footer.** `index.html`'s `<footer class="siteFoot" id="contact">` and all five
   case studies' (`apollo.html:580`) carry LinkedIn, Instagram and email in one sentence.
3. **The About panel's `.abConnect` "Get in touch" row** carries Email, LinkedIn, Instagram and
   Résumé as labelled links with icons.

Three routes to contact, zero social glyphs in the chrome. The header stops being a contact widget
and goes back to being navigation.

### 5.4 "Cramped, doesn't use the margins"

§2.4 (alignment, with the before/after table) and §2.5 (internal spacing).

### 5.5 "`Play` should just be named `Mood`"

§5.6 immediately below, and §5.7 for the roster.

### 5.6 Does a four-dot disclosure still earn being a disclosure?

Fair challenge — four items behind a click is a thin payload for a menu that was built to hold
nine rows. Both answers, with the argument:

**Keep the disclosure. Recommended.** Because:

- **It is already a readout, not just a trigger.** `index.html:1032` states the intent verbatim:
  the button shows the current mood's dot + name + caret, "a control and a readout in one slot, so
  the mood is legible without opening anything." That makes the real ratio 1 visible : 3 hidden,
  which is a legitimate disclosure — not 0 : 4.
- **Four dots inline means four photographs in the chrome.** They are `.webp` images under
  `#inkSm`, not glyphs. He has just finished telling us he does not want icon rows in the header;
  four photos in the hero's furniture is the same objection wearing a different hat, and I would
  expect him to dislike it for the same reason.
- **It is on hover, not click, on pointer devices** (`hero-engine.js:1845`) — the cost of "behind
  a disclosure" is already near zero on desktop.
- **`hero-engine.js:1822–1901` owns open, close, `clampMenuX()`, the chevron and the whole mood
  dispatch by id.** Collapsing the disclosure means rewriting all of it for a control he did not
  ask to change.
- **Standing rule:** the Play menu is load-bearing; small tweaks only, never collapse or reorder.

**The inline alternative, if he wants it anyway:** four 28px dots in a row is ~130px and fits the
dock comfortably; the current mood gets a ring. Cheap to build, easy to reverse. Offer it, do not
default to it.

**What actually changes:** the label `Play` → `Mood`, and the menu loses everything below the
first separator. That is it — same `#moodbar` / `#moodBtn` / `#moodMenu`, same four `.moodItem`s
in the same order (Empathy · Hunger · Delight · Love), so the engine keeps working untouched.

### 5.7 Where the saved-heads roster goes

`Add your head`, `Add an egghead`, the `#moodHeads` grid and the `Show on home` toggle move to
`play.html`. Four things to get right, and none of them is a hand-wave:

**1. It is not a new menu — `play.html` already has one.** `play.html:124–140` carries its own
`#moodbar` / `#moodBtn` / `#moodMenu`, labelled **"Play"**, holding `Soccer`, `Tournament`,
`End game`, a separator, `Create head` → `headmaker.html`, and `Gradient maker` →
`gradientlab.html`. The roster goes **into that menu**, below the existing separator, in its shipped
order.

**2. `Add your head` and `Create head` are the same control and must not both ship.** Both link
`headmaker.html`. Keep one — `Add your head`, which is the phrasing the roster is built around and
the one the user has seen on home — and delete `Create head`. Shipping both is the most likely
mistake in this task.

**3. Two mechanical traps in `play.html`.**
- `play-games.js:91 syncMoodSeps()` measures every separator each tick and hides the ones with
  nothing visible on one side. New rows must be inside that accounting or a stray hairline appears.
- **`#moodBtn` is disabled and restored by id during a tournament.** Move the roster into that
  menu and the roster becomes unreachable mid-tournament — including "Add an egghead", which is
  exactly what someone wants mid-tournament. **Flag this as a real regression to solve**, not to
  absorb: either the roster gets its own trigger on `play.html`, or the tournament's disable is
  narrowed to the game rows rather than the whole button.

**4. `Show on home` now lives on a different page from the thing it controls.** Real problem, two
distinct failures:
- The word *"home"* is ambiguous from a page that is not home — it can read as "this screen".
- The user cannot see the effect, so the control gives no feedback at all.

**Recommended:** relabel to **"Show my heads on the home page"** (or "Show on the home page" if
width is tight), put it under a plain **"Your heads"** heading with the `#moodHeads` grid, and add
one line of live text under the switch that states the resulting condition — "Your heads appear on
the home page" / "Hidden — they still play here". The switch stays `role="switch"` with
`aria-checked`; the line is the feedback the page cannot give visually. That is a small addition,
and without it the control is a light switch in another room.

Residual cost, stated so it is not discovered later: **someone who never visits `play.html` can no
longer turn their heads off.** If that becomes a real complaint, the answer is a second copy of the
toggle in the hero dock — not moving the roster back.

---

## 6 · Shadows: the standing rule

> **Shadows are for the heads. Chrome does not cast shadows.**

The heads' contact shadow is a physical grounding cue — it says the head is standing on a surface,
and the engine enforces that every head's feet share one ground line. It is load-bearing. A
navigation bar floating above a near-white page is not standing on anything; its shadow is a claim
about depth that nothing else on the page makes.

`tokens.css` already has this right — its materials ladder is **translucency**
(`--mat-0` … `--mat-3`, the ink variants, the scrim) and it declares no shadow on any component.
The `--sh-*` rungs exist; the drift is that the header started *consuming* them.

### 6.1 Every shadow declaration in the new chrome, sorted

| # | File · line | Declaration | Rim or elevation? | Verdict |
|---|---|---|---|---|
| 1 | `header.css:84` | `box-shadow: var(--nav-rim), var(--nav-sh)` on `.jbNav` | `--nav-rim` = `--rim-1`, an **inset hairline** — not a shadow. `--nav-sh` = `--sh-2` = `0 2px 8px rgba(18,18,18,.06), 0 1px 2px rgba(18,18,18,.04)` — **cast** | **Keep the rim, drop `--nav-sh`.** Promote the rim to `--rim-2` (§6.2). |
| 2 | `header.css:106–107` | `.jbNav.isLifted{--nav-sh: var(--sh-3)}` + the ink twin | `--sh-3` = `0 8px 28px …` — **cast, and deepening** | **Delete the whole mechanism.** Note what this means: *the entire current scroll behaviour of the header is a shadow getting deeper.* Removing shadows removes it — which is fine, because the capsule replaces it. |
| 3 | `header.css:87` | `transition: box-shadow …` | the animation for #2 | Delete with #2. |
| 4 | `header.css:242` | `.heroAvail{ background:var(--mat-2); box-shadow:var(--rim-1) }` | **rim only, no cast** | **Already correct.** Keep. This is the one piece of the new chrome that never drifted. |
| 5 | `header.css:255` | `.heroAvail i{ box-shadow: 0 0 0 3px var(--nav-accent-wash) }` | zero offset, zero blur — a **ring**, not a shadow | Keep. |
| 6 | `index.html:1036` | `#moodBtn{ box-shadow: var(--rim-1), var(--sh-1) }` | `--sh-1` = `0 1px 2px rgba(18,18,18,.05)` — **cast** | **This is the one he named.** Drop `--sh-1`; keep the rim. |
| 7 | `index.html:1047` | `#moodBtn:hover{ box-shadow: var(--rim-2), var(--sh-2) }` | **cast** | Drop `--sh-2`. **Keep `--rim-1 → --rim-2` as the hover signal** — the rim darkening *is* the affordance, and it is a material change, not an elevation change. |
| 8 | `index.html:1066` | `#moodMenu{ box-shadow: var(--rim-1), var(--sh-3) }` | a 28px-blur **cast** on the panel | Drop `--sh-3`; the panel separates by rim + opaque material. |

Net: **five cast shadows out, four rims in.** No new declarations.

### 6.2 How the capsule reads as detached without a shadow

This needs saying honestly, because it is the hardest consequence of the rule.

**On a near-white page, a 96%-white translucent pill is invisible.** `--mat-3` is
`rgba(253,253,253,.96)` and the paper is `--c50` `#FDFDFD`. There is nothing to see. So on this
site, with shadows banned, **the rim is doing all of the separation work** and it has to be strong
enough:

| Rim | Composited over `#FDFDFD` | Contrast vs the page |
|---|---|---|
| `--rim-1` (`rgba(18,18,18,.08)`) | ≈ `#EAEAEA` | ≈ **1.14 : 1** |
| **`--rim-2` (`rgba(18,18,18,.14)`)** | ≈ `#DCDCDC` | ≈ **1.31 : 1** |
| the site's own hairline `--c100` `#E6E6E6` | — | ≈ **1.30 : 1** |

**Use `--rim-2` for the capsule.** It lands on exactly the value the site already uses everywhere
as a legitimate divider, so it is not a new visual weight — it is the site's hairline, wrapped
round a pill. (It is not a WCAG 1.4.11 case: the rim is decorative separation, not a state or a
boundary that carries meaning. The active state carries meaning and it is carried by colour +
weight + `aria-current`, not by the rim.)

**And add the one non-shadow detachment cue that is genuinely free: an inset from the top edge.**
`.jbStick` keeps a **constant 72px height**, but redistributes its padding when shrunk:

```css
.jbStick        { padding-block: var(--sp-8) var(--sp-12); }   /*  8 / 52 / 12 = 72 */
:root.jbShrunk .jbStick { padding-block: var(--sp-14) var(--sp-6); }   /* 14 / 52 /  6 = 72 */
```

The pill drops 6px clear of the viewport edge with page visible above it. That is what "detaches
from the page edge" literally means in the pattern, it is the move Clerk makes (`top: 48px → 8px`,
the only geometry it touches), and it costs a `padding` change on a wrapper with one child and no
text — no reflow, no repaint of anything with content in it. **The wrapper's total height never
changes**, so `--nav-h` and every offset derived from it stay valid.

### 6.3 The blur, and the mobile ghosting problem this makes worse

The rule pushes separation entirely onto material, which raises the stakes on a known bug: below
760px `tokens.css` zeroes `--blur-1` and `--blur-2`, so `--mat-3` becomes a flat 96% tint and a
headline scrolling under the bar ghosts through visibly. `header.css:298` patches it with
`--mat-3-solid`.

**Recommendation: go further and drop `backdrop-filter` from the header entirely, at every width.**
Use `--mat-3-solid` (= `--c50`, fully opaque) on paper and `--mat-i3-solid` (`rgba(18,18,18,.92)`)
on ink. Five reasons, and they all point the same way:

1. **It deletes the ghosting bug rather than patching it.** An opaque ground cannot ghost. The
   760px special case disappears.
2. **It removes the last expensive property in the header.** `backdrop-filter` forces layer
   creation and composites on the **main thread** — one tier worse than `filter`. With it gone, the
   header's entire scroll behaviour is `transform` + `opacity`, both compositor-only.
3. **It removes the trap.** Any ancestor with `opacity < 1` silently becomes a backdrop root and
   kills the effect — a very common "my blur does nothing" failure, and this header sits inside
   pages that animate opacity on overlays.
4. **NN/g explicitly advises against translucent sticky headers**, on the grounds that low contrast
   makes the half-visible content behind them hard to read
   ([Sticky Headers: 5 Ways to Make Them Better](https://www.nngroup.com/articles/sticky-headers/),
   Page Laubheimer, 2021). That is a direct primary-source argument against the glass, and it cuts
   against the current trend.
5. **Raycast — the best-executed header in the survey — uses `blur(5px)` and never animates it.**
   Nobody in the top tier is doing heavy glass on a nav.

Cost, stated: the bar loses the glassiness. Given the brief is "clean, modern, minimal", and given
he has just asked to subtract elevation, subtracting translucency in the same pass is consistent
rather than contradictory. **Flag it as a separate decision from the shadow rule** — he asked for
one and this is a second — but recommend it.

### 6.4 The rest of the new chrome, checked for the same drift

| Component | Verdict |
|---|---|
| `.heroAvail` availability pill | Clean already — `--mat-2` + `--rim-1`, no cast. Its dot's ring is a ring. Keep. |
| `#moodBtn` mood trigger | Two casts out (§6.1 #6, #7). Rim-darkening survives as the hover signal. |
| `#moodMenu` disclosure panel | One cast out (#8). Panel keeps `--rim-1` + `--mat-3-solid`, `--r-lg`. |
| The active-state pill (`--nav-active-bg`) | Never had a shadow. Fine. |
| Cards introduced by the header | None — the header introduced no cards. |

---

## 7 · Non-regression list

| Must not regress | Status under this design |
|---|---|
| **One component, nine pages** | Kept, and strengthened: the *targets* are now site-wide too (§2.2), which is the part the old bar never had. |
| **The sentence-case stacked lockup** | Untouched. All six measured constants carry over verbatim. Its only change is that Back stops being injected inside it. |
| **Back survives on mobile** | Yes, as its own 44×44 item. Measured sub-page bar **327.8 of 366px** at 390. |
| **44×44 targets** | Preserved by the existing `::after` trick. Back and every icon-only item at ≤640 are explicit 44px squares. |
| **A real active state** | Stronger: `--nav-accent` ink + weight 600 + `--nav-accent-wash` pill + `aria-current`, and at ≤640 the active item is the only labelled word in the row. |
| **`gradientlab.html` dark full-bleed** | `data-surface="ink"` unchanged; `--mat-i3-solid` instead of `--mat-i3` + blur. Ships permanently in the shrunk state. |
| **`play.html` is fixed and must not scroll** | Untouched. No observer bound and no scroll listener: the page cannot scroll, so it ships with `jbShrunk` set statically rather than toggled. |
| **`--nav-h: 52px`** | Constant in both states, by design. Five case-study rails and every `scroll-margin-top` keep resolving. |
| **`.jbStick` height 72px** | Constant in both states — the padding redistributes, the total does not change. |
| **The chapter rail** | Its sticky `top` computes to **0px** today, so it slides under the 52px bar — the adoption list called for `calc(var(--nav-h) + var(--sp-16-24))` and it was not applied. **Pre-existing bug; fix it in this pass.** |
| **`hero-engine.js` bindings** | `#logo`, `#navAbout`, `#moodbar`, `#moodBtn`, `#moodMenu` all keep their ids. Nothing in `hero-engine.js:1520–1560` or `:1822–1901` needs to change. |

### 7.1–7.4 · Accessibility, four items

1. **WCAG 2.4.11 Focus Not Obscured (Minimum), AA.** The Understanding document names sticky
   headers explicitly as a cause. The failure mode is Shift+Tab: focus moves up the page, the
   browser scrolls the focused element to the top of the viewport, and the sticky bar covers it.
2. **The fix is `scroll-padding-top` on the scroll container — not `scroll-margin-top` on targets.**
   W3C lists CSS `scroll-padding` as a sufficient technique; TetraLogical recommends it *over*
   `scroll-margin` because `scroll-margin` has browser bugs, particularly in Safari. **The site has
   no `scroll-padding-top` anywhere** (`apollo.html` has only `scroll-padding-inline`); it relies
   on `scroll-margin-top: calc(var(--nav-h) + var(--sp-16-24))` = 76px on case-study sections and a
   bare `80px` on `index.html`. Add, once, in `tokens.css`:
   ```css
   html{ scroll-padding-top: calc(var(--nav-h) + var(--sp-16-24)); }   /* 76px ≥881, 68px below */
   ```
   Use the **taller** state's number. This is a direct argument for §3.1's "the bar's height must
   not change": a header with two heights has two correct `scroll-padding-top` values and can only
   have one.
3. **WCAG 1.4.10 Reflow, AA — the one that is usually missed.** Content must work at a 320 CSS px
   equivalent, i.e. **1280px at 400% zoom**, without two-dimensional scrolling. At 400% on a 16:9
   laptop the usable vertical viewport can be as little as ~145px; a 72px sticky header eats half
   of it, and sticky chrome **cannot be scrolled out of the way**. **Add a short-viewport escape:**
   ```css
   @media (max-height: 420px){ .jbStick{ position: static } }
   ```
   Test explicitly at 400% zoom — this is the check the previous round did not run.
4. **`prefers-reduced-motion`.** The scroll-driven-animations spec itself has no accessibility
   section, but WebKit's guide recommends gating scroll-driven motion and **WCAG 2.3.3 Animation
   from Interactions (AAA)** is on point — its Intent text says scrolling motion the user controls
   is allowed, and only *non-essential* animation added to it must be gatable
   ([C39](https://www.w3.org/WAI/WCAG22/Techniques/css/C39)). The useful nuance: scroll-driven
   motion is gentler on vestibular users than autonomous motion because the user is the driver, so
   the right treatment is **reduce, not remove** — drop the geometry change, keep the ground. As
   noted in §3.3, `--sp-settle-dur: 1ms` under reduced motion already produces exactly that, for
   free.

---

## 8 · The hero's "weird spacing"

Measured on `index.html` at 1280×800 and 390×812.

### 8.1 What is wrong — it is mechanical, not aesthetic

Every gap in the hero is being solved **twice**: once by the grid's `row-gap`, and again by the
child's own margin, and the two disagree.

| Gap | Grid `row-gap` | The child's own margin | Result @1280 | Result @390 |
|---|---|---|---|---|
| header → capsule | — | `.hero{padding-top: var(--sp-16-40)}` | **40px** | **24px** |
| capsule → `h1` | 24px | `.heroAvail{margin-bottom: var(--sp-12)}` = +12 | **36px** | **28px** |
| `h1` → head | 24px | `.stagewrap{margin-top: calc(var(--sp-8-16) * -1)}` = **−16** | **8px** | **8px** |
| head → Mood dock | 24px | `.hero>.faceMoodCorner{margin-top: var(--sp-16-24)}` = +24 | **48px** | **32px** |

Three specific faults:

1. **The `h1` → head gap is 8px** — the *smallest* gap in the hero, between its two *largest*
   objects. The head reads as glued to the headline. It is 8px only because a −16px margin is
   fighting a 24px gap.
2. **The capsule sits at 36px from the `h1` and 40px from the header** — nearly equidistant, so it
   belongs to neither. It is the `h1`'s eyebrow and it is not spaced like one. (The site has a
   token for exactly this relationship, `--gap-eyebrow: .55em`, and the hero does not use it.)
3. **Three of the four gaps are the sum of two numbers in different files**, one of which is
   negative. There is no single place to read or change the hero's rhythm.

### 8.2 What the numbers should be

**Delete `row-gap` from `.hero` (`row-gap: 0`) and give each child exactly one `margin-top`.** One
number per gap, all four legible in one block.

| Gap | Now @1280 | Proposed | Token | @390 |
|---|---|---|---|---|
| header → availability capsule | 40 | **64** | `.hero{padding-top: var(--sp-48-64)}` | 48 |
| capsule → `h1` | 36 | **18** | `h1{margin-top: var(--gap-eyebrow)}` (.55em of 33.28px) | 14 |
| `h1` → head | **8** | **48** | `.stagewrap{margin-top: var(--sp-32-48)}` — **delete the −16px** | 32 |
| head → Mood dock | 48 | **24** | `.faceMoodCorner{margin-top: var(--sp-16-24)}` | 16 |

The shape this produces: **one big gap separating the hero from the chrome (64), then a tight
eyebrow (18), then a real break before the payload (48), then the dock hugging the head it acts on
(24).** Currently the order of gaps is 40 / 36 / 8 / 48 — no hierarchy at all.

### 8.3 What it buys

With `.jbTop` deleted, chrome drops **130 → 72px** at 1280 and **120 → 68px** at 390.
Head top position: **355.1 → 295px** at 1280 (−60px), so 60px less of the head is cut by an
800px-tall viewport. At 390×812 the whole hero including the Mood dock lands at ~681px in an 812px
viewport — **131px of slack**, against 98px today.

### 8.4 One overflow bug found in passing

At 390px the `h1` measures **344.9px wide inside a 342px column** — `max-width: 13.2em` at
26.13px resolves above the column width, so it sits 3px past the hero's left edge and 6px past its
right. Fix: `max-width: min(13.2em, 100%)`.

---

## 9 · Where I disagree with him

1. **The scroll-to-capsule is a template pattern, not a studio pattern.** §1.1. Seventeen top-tier
   sites measured, none does it; it ships in shadcn, Aceternity and Framer marketplace components.
   The two best headers found — Raycast and Clerk — are **always** detached and change *nothing*
   or *only colour and position* on scroll. He should build it because he likes it; he should not
   build it believing it is what the high bar looks like. **This is the one I most want him to
   read.**
2. **The biggest single thing I would tell him not to do: do not drop the labels and keep the
   icons in the capsule.** §4.4. It is the obvious capsule move, it is the one change here that
   reintroduces text reflow into an otherwise composite-only animation, it destroys the active
   state, and it is not what his reference screenshot showed.
3. **`Mood` should not be in the site header** — it is a control on a head that exists on one of
   nine pages, and it costs 42–90px of the 390px budget. `Games` takes that slot instead, which
   also keeps `play.html` reachable now that the Mood menu no longer carries the Games link. §2.2.
4. **Drop the blur too, not just the shadow.** §6.3. He asked for one subtraction; I am proposing
   a second, because on a near-white page the glass is invisible anyway, NN/g argues against it,
   and removing it deletes the mobile ghosting bug and the header's last main-thread effect.
5. **Icons at 390px do not fit with labels, on any page.** §2.3. This is not negotiable by taste —
   the sub-page bar is 90px over a 366px budget. Something gives, and I recommend it be the labels
   at ≤640 with the active item keeping its own.
6. **Two pre-existing bugs to fix in the same pass, since the header is open anyway:** the chapter
   rail's sticky `top` computes to 0px so it slides under the bar (§7); and `.gIco` renders at
   0.75px with mitred joins across 40+ uses, roughly half the weight of the labels beside it (§4.1).

---

## 10 · Build order

1. **`tokens.css`** — `html{scroll-padding-top}`; the `.gIco` stroke/cap/join fix. No new tokens
   needed; `--sp-16`, `--rim-2`, `--mat-3-solid`, `--mat-i3-solid`, `--gap-eyebrow`, `--sp-48-64`,
   `--sp-32-48` and `--ico-stroke` all already exist.
2. **`header.css` + `header.js`** — the three-zone bar, the icon slots, the `::before` ground, the
   five shadow deletions, the blur deletion, the `≤640` label drop, the `max-height: 420px`
   un-stick, and **deleting `header.js`'s unthrottled scroll listener** (it forces a layout per
   event and nothing replaces it — the bar's resting state is static).
   **Built:** `html.jbShrunk` and the `IntersectionObserver` sentinel that toggles it. They survive
   the capsule's rejection because Rev 2 still has two states — they now drive only §6.2's inset
   (`.jbStick` redistributes its padding, 8/52/12 → 14/52/6, so the bar drops 6px clear of the
   viewport edge at a constant 72px height). That is the Clerk move, and it is the whole of what
   this header does on scroll.
   **Not built:** `--bar-open` / `--bar-shut` / `--close`. Those are the capsule's width morph
   specifically, and only that is rejected — see §3.7 for the analysis and §3.6's table.
   An earlier draft of this build order listed the morph variables as things to build, and a
   correction to it briefly over-swung and listed `jbShrunk` and the sentinel as *not* built. Both
   were wrong. This line supersedes both.
3. **The five case studies** — two custom properties each, the `Work` active state, and the rail's
   sticky `top` fix. Cheapest files, and where the original complaint started.
4. **`index.html`** — delete `.jbTop`; the hero rhythm (§8); `Play` → `Mood`; strip the menu to the
   four dots.
5. **`play.html`** — the roster moves in; `Add your head` / `Create head` deduplicated; the
   `syncMoodSeps()` and tournament-disable traps (§5.7).
6. **`gradientlab.html`, `headmaker.html`** — static `jbShrunk`, ink surface.
7. **Verify** at 1280, 390, and **at 400% zoom** (§7.3) — that last one is the check the previous
   round did not run.
