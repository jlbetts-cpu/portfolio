# Design tokens — radius, corner smoothing, motion, material, type

2026-08-02. Companion to `2026-08-02-next-chapter-brief.md` §3.5 (the iOS research)
and `2026-08-02-case-study-teardown.md` (the measured reference numbers).

**Status: proposal.** Nothing in this document has been applied. The specimen page
`specimen.html` renders every token below old-vs-new so the feel can be approved
before a single real file changes.

**Scope note — the typeface does not change.** Jayden's call, 2026-08-02:
*"maybe just keep instrument sans, if there is a problem just focus on leading
and spacing more for the instrument sans specifically."* So `--sans` stays
`"Instrument Sans"`, Archivo stays on the broadcast boards, and §5 is an
**optical pass on the face already in use** — leading, tracking, and the space
around headings — measured off the actual woff2 files in `fonts/`. Nothing needs
downloading.

---

## 0. The measured problem

I ran the real histogram over `index.html` rather than trusting the brief's
starting hypothesis. Every `border-radius` declaration, by value, with the
selectors that use it:

| Value | Count | What actually uses it |
|---|---|---|
| `4px` | **51** (+6 `!important`, +3 partial-corner) = **60** | Everything. Focus rings, badges, chips, buttons, menus, image frames, photo cards, the mobile drawer, tournament rows, scoreboards. |
| `50%` | 34 | Circles: eyes, pupils, glints, dots, ball shadows, knobs, pegs. |
| `0` | 8 (+2 `!important`) | Deliberate square: `.csFrame`, `.hmScoreEnd`, mirrored-bracket pseudo-elements. |
| `28px` family | 9 | The tournament cup card and its panels — one coherent broadcast object. |
| `1 / 2 / 3px` | 10 | Hairline details: burger bars, HP bars, the ticket stamp, race segments. |
| `5 / 6 / 8 / 9 / 10 / 12 / 16px` | 15 | Scattered game + broadcast chrome, no rule behind any of them. |
| `100px` | 1 | `.abTalk` — a pill. |
| `999px` | 1 | `.tCardTag` — also a pill. |
| `.03 / .06em` | 3 | Split-flap cells. Em-relative on purpose; leave alone. |
| `var(--rad,14px)` | 1 | `.reelFrame` — the only radius already parameterised. |

`corner-shape` appears **zero** times in `index.html` and `play.css`.

**The finding is not "4px is inconsistent."** 4px is applied with near-perfect
consistency. The problem is that it is applied *without regard to box size*: an
11px focus ring, a 38px-tall button, a 320px photo card and a full-height mobile
drawer all get the same 4px. That is exactly what makes the chrome read as a
web page rather than as a designed object — on iOS, **radius is a function of
the box, not of the component's name**. A constant radius across three orders of
magnitude of box size is the flat-CSS symptom the "photoreal direction" note
already diagnosed as a materials problem.

So the fix is not "pick a nicer number." It is: **make radius scale.**

---

## 1. Radius scale

### 1.1 Verdict on the brief's proposal

The brief proposed **6 / 10 / 14 / 20 / 28** for chips / inputs / buttons+small
cards / cards+sheets / modals. **I am adopting that spine unchanged**, and adding
three tokens the histogram proves are needed but the brief did not cover
(hairline details, the two pills, and the 34 circles).

I checked the spine against this site rather than against the research, and it
survives on three independent grounds:

1. **It is concentric against the site's own padding steps.** The concentric rule
   is `inner = outer − padding`. The site pads in 4 / 6 / 8 / 10px steps. The
   ladder closes exactly on those:
   `28 − 8 = 20` · `20 − 6 = 14` · `14 − 4 = 10` · `10 − 4 = 6`.
   No other 5-step ladder in the 6–28 range does that. This is the strongest
   argument for the exact numbers and it is why I did not shift them.
2. **It matches Apple's own ratio at this site's button size.** Apple's
   nonscrolling button radius is 22pt on a ~50pt button — a radius:height ratio
   of 0.44. This site's buttons (`.talk`, `.back`, `.csTab`, `.moodBtn`) run
   ~36–40px tall. `14 / 38 = 0.37`. Same register, slightly more restrained,
   which is correct for an editorial site.
3. **The top of the ladder already exists and is already liked.** The 28px
   tournament cup card was arrived at independently and reads correctly. The
   ladder therefore does not invent a new maximum; it back-fills the four rungs
   below one that already works.

### 1.2 The tokens

```css
:root{
  --r-hair : 2px;    /* bars, ticks, stamps, progress segments — sub-8px objects */
  --r-xs   : 6px;    /* chips, tags, badges, focus rings, small counters */
  --r-sm   : 10px;   /* inputs, small controls, scoreboard cells, inner mats */
  --r-md   : 14px;   /* buttons, small cards, menu items, drawer links */
  --r-lg   : 20px;   /* cards, media frames, panels, sheets */
  --r-xl   : 28px;   /* modals, the mobile drawer, the tournament cup card */
  --r-pill : 999px;  /* fully-round controls — status pills, caption pills */
  --r-full : 50%;    /* circles — dots, eyes, knobs, shadows */
}
```

**When to use each — one line apiece:**

| Token | Value | Use it when |
|---|---|---|
| `--r-hair` | `2px` | The object is under ~8px in its smallest dimension and just needs its corners knocked off. |
| `--r-xs` | `6px` | A chip, tag, badge or focus ring wrapping a single line of ≤13px text. |
| `--r-sm` | `10px` | An input, a small control ≤32px tall, or the **inner** element of an `--r-md` parent with 4px padding. |
| `--r-md` | `14px` | Any button, any card under ~200px, any menu item. This is the new default — the rung that replaces most 4px. |
| `--r-lg` | `20px` | A card, media frame, panel or sheet over ~200px, i.e. anything you'd call a surface. |
| `--r-xl` | `28px` | A modal, the mobile drawer, or a full broadcast object like the cup card. Never on anything smaller than ~320px. |
| `--r-pill` | `999px` | The shape *is* the affordance — a status pill, a caption pill, a fully-round control. Never on a rectangle you merely want soft. |
| `--r-full` | `50%` | The object is a circle. Not a "very round rectangle" — a circle. |

**Hard rule to prevent the next accretion:** a raw px `border-radius` in new CSS
is a bug. If none of the eight fits, the box is the wrong size, not the ladder.

### 1.3 What happens to the 60 uses of `4px`

They split by **box size**, not by component name. Concretely:

| Current selectors at `4px` | New token | Why |
|---|---|---|
| `.battleBadge`, `.battleCount`, `.csItem.wip .csYear`, `.tCardTag`-adjacent counters, focus-ring group (`.footIn:focus-visible`, `.abLink:focus-visible`, `.back:focus-visible`, `.heroBack:focus-visible`, `.skipLink`) | `--r-xs` **6px** | Single-line ≤13px content. The focus rings must match the radius of what they wrap — see §2.3. |
| `.hmScore`, `.tRow`, `.tM`, `.hmRaceRow`, `.hmPitPick`, `.mhToggle`, `.mhPick` | `--r-sm` **10px** | Short controls and data rows, ≤32px tall. |
| `.talk`, `.back`, `.tvTab`, `.csTab`, `.hmBtn`, `.moodBtn`, `.moodGo`, `.moodItem`, `.aboutCta`, `.tGo`, `.toTop`, `.sbBtn`, `.hmPitX`, `.navDrawerX`, `.ndLink`, `.ndTalk`, `.heroBack`, `.navLink`, `.moodTeamsBtn`, `.reelClose`, `.reelTap` | `--r-md` **14px** | Every button and menu item on the site. **This is the change that will be visible**, and it is the one that carries the iOS read. |
| `.moodMenu`, `.csInfoCard`, `.abShot`, `.abShot img`, `.mhItem`, `.mhItem img`, `.photoFig img`, `.photoPair img`, `.stat`, `.reelOverlayVid`, `.reelOverlayYt`, `.reelFrame`, `.pcInner`, `.vcInner`, `.dlogo`, `.hint`, `.tChamp`, `.tChampIn`, `.tCup`, `.tCupFx`, `.tResGroup` | `--r-lg` **20px** | Surfaces and media frames. `.reelFrame`'s existing `var(--rad,14px)` becomes `var(--rad,var(--r-lg))`. |
| `.navDrawer` | `--r-xl` **28px** | Full-height sheet. Corner-specific: `28px 0 0 28px`. |
| `.workcard` (`4px 4px 0 0`), `.tCupPanel` (`4px 4px 0 0`) | `--r-xl` on the top two corners | They sit against the cup card's existing 28px; matching it makes the stack one object. |
| `.hmGoal::before`, `.tCupCard`'s trailing `4px 4px` | `--r-xs` **6px** | Bottom corners of an object whose top is 28px — the deliberate asymmetry stays, it just gets tokenised. |

**Net effect: 60 undifferentiated 4px become 5 differentiated rungs.** Fifty-one
of the sixty move *up*, most of them by 10px or more. That is a large visual
change and it is the whole point of the specimen.

### 1.4 The pills, the circles, the squares

- **`999px` (`.tCardTag`) and `100px` (`.abTalk`)** are the same intent written
  twice. Both become **`--r-pill: 999px`**. `999px` wins over `100px` because it
  cannot fail on a tall box — a 100px radius on a 240px-tall element is a
  rounded rectangle, not a pill. One token, one behaviour, at every height.
- **The 34 `50%` uses become `--r-full`** with no value change. They are true
  circles; nothing to reconcile. Tokenising them is purely so the ladder is
  complete and grep-able.
- **The 8 deliberate `0`s stay `0`.** `.csFrame`, `.hmScoreEnd` and the mirrored
  bracket pseudo-elements are square on purpose. The teardown's "square content,
  round controls" rule endorses this; do not sweep them.
- **The 3 em-relative split-flap radii (`.03em` / `.06em`) stay.** They scale with
  the flap's own type size, which is correct for a broadcast component, and they
  are inside the Archivo register this spec does not touch.
- **The 10 hairline radii (1/2/3px)** all collapse to `--r-hair: 2px`. The
  difference between 1px and 3px on a 2px-tall bar is not perceptible; it is
  three values doing one job.

### 1.5 The concentric rule, applied

```css
/* a card with a 10px mat (the teardown's frame-not-box move) */
.card      { border-radius: var(--r-lg); padding: 10px; }  /* 20 */
.card > *  { border-radius: var(--r-sm); }                 /* 20 − 10 = 10 */

/* a button inside a card, 6px inset */
.card .btn { border-radius: var(--r-md); }                 /* 20 − 6 = 14 */

/* a chip inside a button-sized row, 4px inset */
.row .chip { border-radius: var(--r-xs); }                 /* 10 − 4 = 6 */
```

If the inner radius is *equal to* the outer, the corners look pinched. If it is
*larger*, they look broken. Both are visible on the specimen's concentric strip.

---

## 2. Corner smoothing

### 2.1 The token

```css
:root{ --corner: squircle; }

.sq{
  border-radius: var(--r-md);   /* the fallback, always present */
  corner-shape: var(--corner);  /* the enhancement, ignored where unsupported */
}
```

`border-radius` is a circular arc — **G1 continuous**, so curvature jumps
discontinuously where the arc meets the straight edge. Apple's corner is
curvature-continuous: roughly a two-thirds Bézier ramp into a one-third arc.
Figma exposes it as corner smoothing and **60% is the iOS preset**.
`corner-shape: squircle` is the CSS spelling of the same idea.

### 2.2 Browser support — honestly

- **Chrome / Edge 139+ only.** Roughly two-thirds of traffic today; Safari and
  Firefox have not shipped it.
- **It degrades silently.** An unsupported browser drops the `corner-shape`
  declaration and keeps the `border-radius` that is already there. Nothing
  breaks, nothing shifts, nothing needs a feature query.
- **Therefore it is safe to ship unconditionally**, and it is the one part of
  this spec with genuinely zero risk. Progressive enhancement in the textbook
  sense: absence of the enhancement is the current state of the site.
- **Do not chase parity.** The delta between a squircle and an arc at 14px
  radius is roughly 1.5px of outline. It is worth having where it is free. It is
  not worth a single line of JS, a polyfill, or a build step.

### 2.3 The `clip-path` fallback and its accessibility trap

If cross-browser parity is ever genuinely required, the fallback is to generate
a squircle path and apply `clip-path`. **This has a real trap and the brief is
right to flag it:**

> `clip-path` clips **`box-shadow` and the focus ring** as well as the content.

A clipped element loses its outer shadow entirely (the shadow is painted outside
the border box, which is exactly what got clipped away) and — worse — its
`:focus-visible` outline is clipped to the same path, which can reduce a 2px ring
to a hairline or erase it at the corners. That is a WCAG 2.4.7 / 2.4.11 failure
introduced by a purely decorative change.

**The required pattern is an unclipped wrapper:**

```css
.sq-shell{                        /* unclipped: owns shadow + focus ring */
  border-radius: var(--r-md);
  box-shadow: var(--sh-2);
}
.sq-shell:focus-within{ outline: 2px solid var(--accent); outline-offset: 2px; }

.sq-shell > .sq-clip{             /* clipped: owns the shape only */
  clip-path: path("…");
  border-radius: var(--r-md);     /* keep, for when clip-path is unsupported */
}
```

**Recommendation: do not build the clip-path path at all right now.** Ship
`corner-shape` alone. The wrapper pattern is documented here so that if someone
reaches for `clip-path` later they do not silently ship an accessibility
regression — not because we need it.

### 2.4 Where smoothing goes

Apply `corner-shape: squircle` on `--r-md` and above (buttons, cards, sheets,
modals). Below 14px the difference is under a pixel and not worth the extra
declaration. Never on `--r-full` (a squircled circle is a squircle, not a
circle) and never on `--r-pill` (the pill's flat sides have no corner to smooth
— `corner-shape` on a pill visibly deforms the ends).

---

## 3. Motion

The site's existing house curve is `cubic-bezier(.2,.8,.2,1)` and it is used
widely. **It stays** for anything under ~200ms — colour, opacity, small fades.
It is a good ease-out and replacing it site-wide would be churn for nothing.

Springs are added *above* it, for anything that moves or changes size.

### 3.1 The sampled-spring tokens

Each curve is a real damped-harmonic-oscillator response sampled into CSS
`linear()`. Parameters use the SwiftUI convention (`response`, `dampingFraction`)
so they are directly comparable to the iOS originals. `linear()` describes shape
only, so each curve is paired with the duration at which its physics is real —
**use the pair, not the curve alone.**

```css
:root{
  /* response .22 · damping 1.00 · critically damped · no overshoot */
  --sp-quick: linear(0, 0.0757, 0.2282, 0.3918, 0.5383, 0.6586, 0.7524, 0.8231, 0.8751, 0.9126, 0.9394, 0.9582, 0.9714, 0.9805, 0.9867, 0.991, 0.994, 0.9959, 0.9973, 1);
  --sp-quick-dur: 300ms;

  /* response .38 · damping 0.90 · no overshoot, longer settle */
  --sp-settle: linear(0, 0.024, 0.0833, 0.1633, 0.2531, 0.3454, 0.4352, 0.5193, 0.5959, 0.6642, 0.724, 0.7755, 0.8194, 0.8562, 0.8867, 0.9118, 0.9322, 0.9486, 0.9616, 0.9719, 0.9799, 0.986, 0.9907, 0.9941, 0.9967, 1);
  --sp-settle-dur: 360ms;

  /* response .50 · damping 0.80 · +1.5% overshoot — the iOS default feel */
  --sp-pop: linear(0, 0.0435, 0.1463, 0.2761, 0.4118, 0.5401, 0.6536, 0.7493, 0.8265, 0.8866, 0.9316, 0.964, 0.9863, 1.0007, 1.0092, 1.0136, 1.0151, 1.0148, 1.0134, 1.0115, 1.0095, 1.0075, 1.0057, 1.0042, 1.0029, 1);
  --sp-pop-dur: 640ms;

  /* response .55 · damping 0.58 · +10.7% overshoot — celebration only */
  --sp-bounce: linear(0, 0.0659, 0.222, 0.4163, 0.6109, 0.7819, 0.917, 1.0128, 1.072, 1.1007, 1.1065, 1.0972, 1.0794, 1.0584, 1.0379, 1.0203, 1.0066, 0.9972, 0.9915, 0.989, 0.9887, 0.9899, 0.9919, 0.9942, 0.9963, 1);
  --sp-bounce-dur: 860ms;

  /* the existing house ease-out — unchanged, still correct under 200ms */
  --ease-out: cubic-bezier(.2,.8,.2,1);
  --ease-out-dur: 160ms;
}
```

### 3.2 The bezier approximation

```css
--sp-bounce-approx: cubic-bezier(0.34, 1.56, 0.64, 1);   /* peak +9.78% */
```

Measured, not eyeballed: `cubic-bezier(0.34,1.56,0.64,1)` peaks at **1.0978**;
the sampled `--sp-bounce` peaks at **1.1065**. They are within 0.9% of each other
at the crest, so the approximation is genuinely interchangeable *for the bouncy
curve*.

**Where to use which:**

- Use **`--sp-bounce-approx`** when the animation is on a **transform or opacity
  only** and you want one short declaration. A bezier is cheaper to read in the
  source and is universally supported.
- Use the **sampled `linear()`** when the motion (a) crosses 1.0 more than once,
  (b) animates a non-transform property where the settle shape is visible, or
  (c) needs to match a native iOS animation frame-for-frame. A bezier
  mathematically **cannot** produce a second oscillation; `--sp-bounce`'s
  undershoot to 0.9887 after its crest is the part that reads as physical and it
  is unavailable to any cubic-bezier.
- `--sp-quick`, `--sp-settle` and `--sp-pop` **have no usable bezier equivalent**
  and must stay `linear()`. `--sp-pop`'s 1.5% overshoot is too small for a bezier
  control point to hit accurately, and `--sp-settle`'s long tail is the shape a
  bezier flattens.
- `linear()` is supported in all current evergreen browsers (Chrome 113+,
  Safari 17.2+, Firefox 112+). Older browsers fall back to `linear` easing — a
  constant-velocity move, which looks mechanical but is never broken. If that
  matters for a specific element, declare `transition-timing-function` twice:
  the bezier first, the `linear()` second.

### 3.3 Which is used where

| Token | Duration | Use it for |
|---|---|---|
| `--ease-out` | 120–200ms | Colour, opacity, border, hover tint. Anything that does not move. |
| `--sp-quick` | 300ms | Press and release states, toggles, tick growth, chip selection. Critically damped so a rapid double-tap never stacks a wobble. |
| `--sp-settle` | 360ms | Drawers, menus, panels, the About morph. Anything large that must arrive without drawing attention to arriving. |
| `--sp-pop` | 640ms | Cards and media entering on scroll, the head/stage settling, the mood menu opening. The 1.5% overshoot is the "expensive" cue. |
| `--sp-bounce` | 860ms | **Celebration only** — goal moment, champion reveal, the draw-board stamp. Never on navigation and never on anything a user triggers more than once per minute. |

**Guard rails:**
- Every spring must sit inside `@media (prefers-reduced-motion: no-preference)`
  or be nulled by a `reduce` block. The site already does this for `.bounceDot`,
  `.glasses` and `.availDot`; the same pattern applies.
- Springs animate `transform` and `opacity` only. A spring on `width`, `height`
  or `top` overshoots into a layout the browser must re-solve on every frame —
  that is how a 640ms animation becomes a long task.
- One spring per element. Nested overshoots multiply and read as broken.

---

## 4. Materials

### 4.1 The standing constraint this ladder must respect

- Mobile comfortably paints **3–5 simultaneous blur effects**.
- `index.html` already declares **71** `filter: blur()` rules and **7**
  `backdrop-filter` rules.
- `blur()` cost scales with **radius × area**, so a full-viewport blur is the
  single most expensive thing on the list.

**Therefore the ladder's rule is: translucency is free, blur is rationed.** Every
step below can render with `backdrop-filter` omitted and still be a legible,
correct surface. Blur is the top 20% of the effect, and it is the 100% of the
cost.

### 4.2 The ladder

```css
:root{
  /* rims — a hairline is the primary material, per the teardown */
  --rim-1: inset 0 0 0 1px rgba(18,18,18,.08);   /* resting surface edge */
  --rim-2: inset 0 0 0 1px rgba(18,18,18,.14);   /* raised / focused edge */
  --rim-top: inset 0 1px 0 rgba(255,255,255,.55);/* specular top edge, on tint only */

  /* tints — the surface itself */
  --mat-0: transparent;                          /* flush with the page */
  --mat-1: rgba(253,253,253,.72);                /* resting translucent surface */
  --mat-2: rgba(253,253,253,.86);                /* raised surface */
  --mat-3: rgba(253,253,253,.96);                /* modal / drawer — near-opaque */
  --mat-scrim: rgba(18,18,18,.34);               /* behind a modal (already in use) */

  /* blur — rationed. see the budget below. */
  --blur-1: 8px;                                 /* small chrome: pills, captions */
  --blur-2: 14px;                                /* menus, panels */
  --blur-3: 20px;                                /* modal / drawer only */

  /* shadows — soft, low-alpha, large-radius, with a light direction */
  --sh-1: 0 1px 2px rgba(18,18,18,.05);
  --sh-2: 0 2px 8px rgba(18,18,18,.06), 0 1px 2px rgba(18,18,18,.04);
  --sh-3: 0 8px 28px rgba(18,18,18,.10), 0 2px 6px rgba(18,18,18,.05);
  --sh-hero: -12px 12px 48px rgba(18,18,18,.22); /* the one directional shadow */
}
```

**When to use each:**

| Token | Use it when |
|---|---|
| `--rim-1` | Any surface that needs an edge. **This is the default separator — reach for it before any shadow.** |
| `--rim-2` | The same surface, raised or focused. |
| `--rim-top` | Only on a tinted surface, only on the top edge — the iOS 26 specular cue. One per screen; more and it reads as chrome plating. |
| `--mat-0` | The element is part of the page, not on it. Most elements. |
| `--mat-1` | A resting surface that must let the paper texture show through — menus, chips over media. |
| `--mat-2` | A raised surface that must stay readable over arbitrary content. |
| `--mat-3` | A modal or drawer. Near-opaque on purpose: a fully translucent modal is a legibility failure, not a material. |
| `--mat-scrim` | Behind a modal. Never blurred — see the budget. |
| `--blur-1/2/3` | Only per the budget below. |
| `--sh-1` | Almost never. A resting card should use `--rim-1`, not a shadow. |
| `--sh-2` | A surface genuinely floating over content — an open menu, a tooltip. |
| `--sh-3` | A modal or drawer, paired with `--mat-3`. |
| `--sh-hero` | **One per page, maximum.** The hero image / staged screenshot. This is the shadow that makes a flat PNG read as a physical object; its value is that it is the only one. |

### 4.3 The blur budget — a hard rule

1. **Never blur a full-viewport surface.** The scrim is a flat tint. If a modal
   needs the page behind it de-emphasised, `--mat-scrim` does that at zero paint
   cost. This rule alone is why the ladder does not regress the 71-blur problem.
2. **Maximum two `backdrop-filter` surfaces painted simultaneously.** In practice
   that is: the nav pill, plus whatever is open. If a third wants blur, it gets
   `--mat-2` and `--rim-1` instead and nobody will notice.
3. **Below 760px, drop to one.** Ship:
   ```css
   @media (max-width: 760px){
     :root{ --blur-1: 0px; --blur-2: 0px; }
     .m-1, .m-2 { background: var(--mat-3); }   /* opaque instead */
   }
   ```
   The tint carries the material; the blur was the garnish.
4. **Blur radius never exceeds 20px.** Cost is radius × area and there is no
   perceptual gain past ~20px on a surface this size.
5. **A blurred surface must be small and transient.** A `backdrop-filter` on a
   permanently-visible element pays its cost on every single frame of every
   scroll, whether or not anything changed.

### 4.4 Why this replaces shadows rather than adding to them

The teardown's central finding is that the reference page has **no elevation
anywhere in content** — one `1px` hairline does rules, image frames, card
borders and the nav edge, and the only shadow on the page is the single
directional hero shadow. It reads as premium *because* of the restraint.

The site currently mixes four materials for one conceptual edge:
`inset 0 0 0 1px rgba(8,8,8,.3)`, `inset 0 0 0 1.5px rgba(8,8,8,.42)`,
`inset 0 0 0 1px rgba(8,8,8,.22)` and `1px solid var(--c100)`. Those four all
become **`--rim-1`**. That single sweep is worth more than every other material
token in this document combined, and it costs nothing to paint.

---

## 5. Type — an optical pass on Instrument Sans

The typeface is not changing. This section is leading, tracking, and the space
around headings, tuned to **Instrument Sans specifically**, using metrics read
straight out of `fonts/instrument-sans-variable.woff2` with fontTools.

### 5.1 The measured face

| Metric | Instrument Sans (measured) | Typical grotesque | Consequence |
|---|---|---|---|
| unitsPerEm | 1000 | 1000 | — |
| cap height | **720** (0.72 em) | ~700 | Caps are **tall**. |
| x-height | **510** (0.51 em) | ~530 | x-height is **low**. |
| x / cap ratio | **0.708** | ~0.75 | Big cap-to-lowercase contrast. |
| typo asc / desc / gap | 970 / −250 / 0 | — | `line-height:normal` = **1.22 em**. |
| win asc / desc | 986 / 350 | — | Ink can reach 1.336 em. |
| `n` advance | 0.599 em | ~0.58 | — |
| `n` advance / x-height | **1.175** | ~1.08 | Sidebearings are **loose for its x-height**. |
| variable axes | `wdth 75–100`, `wght 400–700` | — | It has a **real width axis** — see §5.6. |

Three of those drive everything below:

1. **Low x-height (0.51) with tall caps (0.72).** The face reads *smaller* than
   its cap height implies, and its lowercase sits well below its caps. Lines look
   airier than the raw line-height number suggests, so Instrument Sans wants
   **slightly tighter body leading** than the generic 1.6 advice.
2. **Loose sidebearings for that x-height** (`n`/x = 1.175 vs ~1.08 for a face
   like Inter). It is spaced for UI legibility at small sizes. At display sizes
   that spacing is visibly slack, so it needs **more negative tracking than
   generic guidance** — and at 13px caps its tall caps need **more positive
   opening**, not less.
3. **A 1.22 em default line box.** Any line-height under 1.22 is negative
   leading. That is fine and correct for headlines; it is worth knowing that the
   hero at 1.08 is already 0.14 em of negative leading.

### 5.2 The measured problem — leading is *less* tokenised than radius

Five `--lh-*` tokens exist. Here is how much they are actually used in
`index.html`:

| Token | Value | Uses |
|---|---|---|
| `--lh-display` | `1.0` | **1** |
| `--lh-tight` | `1.08` | **2** |
| `--lh-prose` | `1.6` | **2** |
| `--lh-body` | `1.5` | **0** |
| `--lh-flat` | `1` | **0** |

Five tokens, **five uses total.** Meanwhile the raw values in the same file:

`1` ×35 · `1.2` ×8 · `1.1` ×4 · `1.06` ×3 · `1.55` ×2 · `1.05` ×2 · `1.16em` ×2 ·
`26px` ×2 · and singletons at `1.5` `1.4` `1.35` `1.3` `1.22` `.9` `.86` `.82`
`60px` `28px`.

**22 distinct line-height values, and the token layer is bypassed 95% of the
time.** Letter-spacing is worse — **19 distinct values, zero tokens**:
`.01em` ×15 · `-.02em` ×13 · `-.015em` ×9 · `.08em` ×7 · `-.01em` ×5 · `.06em` ×4 ·
`.04em` ×4 · `.22/.14/.09/.05em` ×2 each · `.1/.16/.12/.07/-.055em` ×1 each.

This is the same disease as the 60 `4px` radii, in a place nobody has looked.

### 5.3 The leading law

Leading must **fall as size rises** — that is the whole of optical leading — and
every `--fs-*` on this site is a `clamp()`, so a fixed ratio is wrong at one end
of every single one of them.

Fit a curve `lh(s) = a + b/s` through two anchors the site already owns:

- **60px → 1.08** — the hero `h1` at its desktop maximum. Sacred, so it is not a
  target, it is the **anchor**.
- **16px → 1.55** — body. (Not 1.6: Instrument Sans's 0.51 x-height means 1.6
  over-opens. The interline gap at 1.6 is 0.63 em = 1.24× x-height; at 1.55 it is
  0.58 em = 1.14×, which is mid-range for comfortable prose. A ~3% tightening.)

Solving: **a = 0.909, b = 10.25**. In `em` terms the line box in px is
`0.91 × font-size + 10.25`, which CSS can express directly — and because `em` in
`line-height` resolves against the element's **own** font-size, it tracks every
clamp automatically:

```css
--lh-auto: clamp(0.95em, 0.91em + 10.25px, 1.6em);
```

The clamp ends stop it going silly: floor 0.95 em so display type never collapses,
ceiling 1.6 em so 11px micro copy never balloons.

**What the law yields, per role:**

| Token | font-size | `--lh-auto` gives | Now | Verdict |
|---|---|---|---|---|
| `--fs-display` | 68 → 168 | **1.06 → 0.97** | `1.0` flat | Adopt. The 168px end is currently 3% too loose, the 68px end 6% too tight. |
| `--fs-hero` (h1) | 38 → 60 | 1.18 → **1.08** | `1.08` flat | **Desktop identical.** Mobile differs — see §5.4. |
| `--fs-h1` | 28 → 38 | **1.28 → 1.18** | `1.08` / `1.06` | Adopt. 1.06 at 28px is genuinely too tight for a wrapping line. |
| `--fs-h2` | 26 → 36 | **1.30 → 1.19** | untokenised | Adopt. |
| `--fs-h3` | 21 → 32 | **1.40 → 1.23** | untokenised | Adopt. |
| `--fs-h4` | 19 → 28 | **1.45 → 1.28** | untokenised | Adopt. |
| `--fs-h5` | 20 → 24 | **1.42 → 1.34** | untokenised | Adopt. |
| `--fs-lead` | 15 → 18 | **1.59 → 1.48** | untokenised | Adopt. |
| `--fs-prose` | 17 → 20 | 1.51 → 1.42 | `1.6` | **Do not use `--lh-auto` here** — see below. |
| `--fs-body` | 16 | 1.55 | — | `--lh-body: 1.5` → **1.55**. |
| `--fs-small` | 15 | 1.59 | — | `--lh-small: 1.58`. |
| `--fs-label` / `caption` / `micro` | 13 / 12 / 11 | 1.70 / 1.76 / 1.85 (clamped to 1.6) | `1` mostly | Single-line labels keep `--lh-flat: 1`. Multi-line small copy gets `--lh-small`. |

**The one exception — prose.** `--lh-auto` at `--fs-prose` gives 1.42–1.51,
which is right for a *heading-length* line and too tight for a 680px measure. Run
length changes the requirement: longer lines need more leading to keep the return
sweep from landing on the wrong row. So prose keeps its own token:

```css
--lh-prose: 1.55;   /* was 1.6 — a 3% tightening, justified by the 0.51 x-height */
```

**The `em` gotcha, documented so nobody trips on it.** A `line-height` in `em`
computes to a fixed px length that children inherit *as px*. So `--lh-auto` must
be set **on the element that sets the font-size**, never on `body` or a wrapper.
The discrete tokens (`--lh-body`, `--lh-prose`, `--lh-small`, `--lh-flat`) are
unitless and inherit correctly — use those for anything that cascades.

### 5.4 The hero `h1` — explicit proposal, not a silent change

```css
h1{font-weight:600;font-size:var(--fs-hero);line-height:var(--lh-tight);letter-spacing:-.02em;max-width:15ch;text-wrap:balance}
```

`--fs-hero: clamp(38px, 4.7vw, 60px)`, `--lh-tight: 1.08`, tracking `-.02em`.

**Desktop: nothing changes.** The leading law was anchored on this exact setting,
so at 60px `--lh-auto` resolves to 1.081. The hero defines the ladder rather than
being exempt from it — which is a better outcome than an exemption.

**Tracking: nothing changes, and it is now validated.** For Instrument Sans's
loose sidebearings, the 38–60px band wants −0.020 to −0.024em. The existing
`-.02em` is correct. No edit.

**Mobile: one explicit proposal.** At the 38px clamp floor the hero currently
still runs 1.08 — a 41.0px line box against 36.9px of ink, i.e. **4.1px of air**
between a descender and the cap below it, on a headline that wraps to 2–3 lines.
The leading law wants **1.18** there (44.8px box, 7.9px of air).

I am **proposing** the change, not making it:

```css
h1{ line-height: clamp(0.95em, 0.91em + 10.25px, 1.6em); }   /* 1.18 @38 → 1.08 @60 */
```

Case for it: a poster-tight 1.08 is a *display* setting, and at 38px across three
wrapped lines the hero is no longer display — it is a paragraph in a big face,
and it is set tighter than any other paragraph on the site. Case against it: it
is the hero, it has been looked at more than anything else on the page, and
"tight" may be the intent. **Both are side by side at 390px on the specimen.** If
1.18 is not visibly better there, it should not ship.

### 5.5 The tracking ladder

Instrument Sans is spaced for UI, which means it is slack at display sizes and
its tall caps are cramped at label sizes. The ladder is therefore **steeper at
both ends** than generic advice:

```css
:root{
  --tr-display: -.042em;  /* ≥88px  */
  --tr-hero   : -.028em;  /* 48–88px */
  --tr-head   : -.020em;  /* 32–48px  ← what h1 already uses; validated */
  --tr-sub    : -.015em;  /* 24–32px  ← matches the existing -.015em ×9 */
  --tr-title  : -.010em;  /* 18–24px  ← matches the existing -.01em ×5 */
  --tr-body   : -.004em;  /* 14–18px */
  --tr-flat   :  0;       /* ≤13px lowercase */
  --tr-caps   :  .045em;  /* ≤13px UPPERCASE — the flip */
  --tr-mark   :  .100em;  /* the logo lockup only — see §5.6 */
}
```

| Token | Use it when |
|---|---|
| `--tr-display` | Type at 88px or above. Currently one place: `.abName`. |
| `--tr-hero` | 48–88px. The hero at its desktop end sits at the boundary and keeps `--tr-head`. |
| `--tr-head` | 32–48px headings. |
| `--tr-sub` | 24–32px subheads. |
| `--tr-title` | 18–24px titles and large UI. |
| `--tr-body` | 14–18px running text. Barely perceptible, and that is the point. |
| `--tr-flat` | Small lowercase UI text. Do not track small lowercase. |
| `--tr-caps` | **Any `text-transform:uppercase` at 13px or below.** The direction flip. |
| `--tr-mark` | The wordmark. Nothing else. |

**Everything closes up; small caps open up.** That direction flip is the single
cheapest typographic upgrade available and the site currently gets it about a
third right: `.heroAvail`, `.worklabel`, `.csTab`, `.csInfoLabel`, `.reelCap`
et al. set `letter-spacing:.01em` — **+0.13px at 13px**, where Instrument Sans's
0.72 em caps want **+0.585px** (`.045em`). Four and a half times more.

**The single biggest tracking miss on the site:** `.abName` sets
`font-size: var(--fs-display)` — up to **168px** — at `letter-spacing: -.02em`.
At 168px that is 3.4px of tracking where the face wants ~7.1px of *negative*
tracking (`--tr-display`). It is the largest piece of type on the site and it is
set with body-heading tracking. Fixing that one declaration is the most visible
typographic change in this document. (`.tChampGhost` already uses `-.055em`,
which proves the instinct exists — it is just a one-off instead of a token.)

### 5.6 The "Jayden Betts" lockup — sentence case

**Jayden's call, 2026-08-02:** *"I love the Betts with the capital B and then the rest
lower case in the leading section, it's gorgeous. I think we change the logo to reflect
that because I think that is perfect."*

Dropping `text-transform:uppercase` is not one property. **All three of the mark's other
values are derived from the caps setting** and all three become wrong at once:

```css
nav .logo{font-family:"Instrument Sans Var",var(--sans);font-weight:600;font-size:17px;
          line-height:1;letter-spacing:.08em;text-transform:uppercase;…}
.logo .logoL1{font-stretch:85.8%}
```

#### Method note — the font tables lie, the browser doesn't

I first solved the width match from advance sums taken out of an instanced variable font
(fontTools). Those numbers were **wrong by up to 2%**, because Instrument Sans carries an
`avar` table that remaps the `wdth` axis non-linearly (`−0.48 → −0.50`). Every number below
was re-solved by binary search on live `getBoundingClientRect()` in Chrome. **For anything
involving a variable axis, measure in the browser.**

#### What I measured

| | Value | Source |
|---|---|---|
| cap height | 0.720 em | `OS/2.sCapHeight` |
| x-height | 0.510 em | `OS/2.sxHeight` |
| `y` descender | −0.205 em | glyph bounds |
| `n` advance ÷ x-height | 1.175× | glyph metrics (vs ~1.08 for Inter) |
| caps width-match @ `.08em` | **85.5%** | browser |
| **shipped 85.8% is** | **0.4% out** | browser — effectively correct |
| caps width-match @ `.10em` | **85.0%** | browser |
| **sentence-case stacked needs** | **77.75%** | browser |
| one-line "Jayden Betts" @ `−.008em` | 5.882 em = **100.0px @ 17px** | browser |
| caps stacked @ 17px | **61.4 × 34.0 px** | browser |

#### The three levers, re-derived

**1. Tracking. `.08em` is a *capitals* value.** Tall narrow caps need opening; lowercase
does not — and Instrument Sans is already loosely spaced for its x-height (`n` advance =
1.175× x-height, against ~1.08 for a face like Inter). **The sign flips.**

```css
--tr-mark: -.008em;   /* was: +.100em, and before that +.08em */
```

At 17px that is −0.136px. Small, and correct: it closes the mark without cramping it. My
earlier `+.100em` proposal was tuned against caps and is void.

**2. `font-stretch`. It goes away entirely.** `85.8%` exists only to width-match six-letter
"JAYDEN" against five-letter "BETTS" as stacked caps. In sentence case the ratio changes and
the match needs **77.75%** — **7.75pp deeper than caps, and only 2.75pp above the axis floor
of 75%.** At that depth "Jayden"'s bowls and stems visibly stop matching "Betts" at 100%;
caps at 85.5% got away with it because caps are geometric and lowercase is not.

**One line removes the problem rather than solving it.** Nothing to width-match, so the mark
stops depending on a variable width axis at all — which §8 flags as its most fragile
dependency.

**3. Leading. `1.04` cannot survive a descender.** Sentence case puts a `y` on line 1, so the
ink extent goes **0.730 em → 0.925 em** and the visible interline gap collapses from
0.310 em to **0.115 em** (1.96px at 17px — the `y` all but touches the `B`). Holding the old
gap needs **line-height 1.235**, at which point the stack is taller than the caps mark it
replaced and the reason for stacking is gone.

#### Recommendation — sentence case, one line

```css
nav .logo{
  font-family:"Instrument Sans Var",var(--sans);
  font-weight:600;            /* unchanged — the two-weight rule */
  font-size:17px;             /* unchanged — leads without shouting, against 15px links */
  line-height:1.05;
  letter-spacing:var(--tr-mark);   /* -.008em */
  /* text-transform: REMOVED */
  /* font-stretch on .logoL1: REMOVED — no longer needed */
}
```
Markup collapses from two spans to one text node: `Jayden Betts`.

| | stacked caps (today) | one line, sentence case |
|---|---|---|
| footprint @ 17px | 61.4 × 34.0 px | **100.0 × 17.8 px** |
| declarations | 5 (+ 2 spans) | **3** |
| depends on `wdth` axis | yes | **no** |

Wider, half the height, three declarations lighter, and it stops depending on a variable
axis. *Premium = subtract.*

**If the mark stays uppercase instead**, the retuned caps answer is
`line-height:1.04; letter-spacing:.10em; font-stretch:85.0%` — two values change and neither
is dramatic. Both are on the specimen alongside the shipped mark, at 42px and at 17px, with
live box measurements.

### 5.7 Space around headings — where "premium" typography actually lives

The site spaces everything on the `--sp-*` ladder (16 / 24 / 32 / 40 / 48 / 56 /
64 / 72 / 80 / 96). That ladder is about **the page**, and it is correct for
sections. It is wrong for headings, because a heading's correct margins are a
function of **its own size**, not of the page — and every heading here is a
`clamp()`, so a fixed px margin is wrong at one end of every one.

**The rule: page gaps stay on `--sp-*`; heading gaps go `em`-relative to the
heading.**

```css
:root{
  --gap-head-top: 1.6em;   /* space ABOVE a heading, in the heading's own em */
  --gap-head-bot: 0.42em;  /* space BELOW it */
  --gap-eyebrow : 0.55em;  /* eyebrow → heading, in the EYEBROW's em */
  --gap-para    : 0.75em;  /* paragraph → paragraph, in the body's em */
}
```

| Token | Use it when |
|---|---|
| `--gap-head-top` | Margin-block-start on any `h2`–`h5` that follows content. |
| `--gap-head-bot` | Margin-block-end on the same heading. |
| `--gap-eyebrow` | Between a label/eyebrow and the heading it introduces. Set on the eyebrow so it scales with the *small* type, not the big type. |
| `--gap-para` | Between consecutive paragraphs in the same block. |

**Why these numbers.** The ratio `1.6 : 0.42` is **3.8 : 1**, and the ratio is the
whole point — a heading must be unambiguously closer to the text it introduces
than to the text it follows. Below about 3:1 the heading floats between two
blocks and the reader has to work out which one it belongs to. That single
relationship is more responsible for "premium" than any radius or shadow in this
document, and it is free.

It also scales for free: an `h2` at its 36px desktop maximum gets 57.6px above and
15.1px below; at its 26px mobile floor it gets 41.6px and 10.9px. No media query,
no second set of values, and the proportion holds at both ends.

**The checkable rule to carry forward:** *space above a heading ≥ 3× space below
it.* If that fails anywhere, the grouping is broken — no amount of type polish
will fix it, and fixing it usually needs no type polish at all.

---

## 6. Targets

```css
:root{ --tap-min: 44px; }
```

**44 × 44 CSS px minimum for every interactive element.** Use it when the visual
control is smaller than 44px — which is most of them.

The rule is that the *target* is 44px, not the *ink*. Grow the hit area without
growing the visible control:

```css
.small-control{
  position: relative;
  /* visible size stays whatever it is */
}
.small-control::after{
  content:"";
  position:absolute;
  top:50%; left:50%;
  width: max(100%, var(--tap-min));
  height: max(100%, var(--tap-min));
  transform: translate(-50%,-50%);
}
```

The site already gets this right in one place — `.navBurger` is
`width:44px;height:44px` around 22px bars. That is the pattern; it needs to reach
the rest. Known offenders to audit when applying: `.reelClose`, `.hmPitX`,
`.navDrawerX`, `.moodGo`, `.tDot`, `.sbDot`, and every `.tick` in the
case-study rails.

Spacing between adjacent targets: **8px minimum** so two 44px targets cannot be
hit ambiguously.

---

## 7. Full token block, ready to paste

```css
:root{
  /* ── radius ─────────────────────────────────────────── */
  --r-hair:2px; --r-xs:6px; --r-sm:10px; --r-md:14px;
  --r-lg:20px;  --r-xl:28px; --r-pill:999px; --r-full:50%;
  --corner:squircle;

  /* ── motion ─────────────────────────────────────────── */
  --ease-out:cubic-bezier(.2,.8,.2,1); --ease-out-dur:160ms;
  --sp-quick:linear(0, 0.0757, 0.2282, 0.3918, 0.5383, 0.6586, 0.7524, 0.8231, 0.8751, 0.9126, 0.9394, 0.9582, 0.9714, 0.9805, 0.9867, 0.991, 0.994, 0.9959, 0.9973, 1);
  --sp-quick-dur:300ms;
  --sp-settle:linear(0, 0.024, 0.0833, 0.1633, 0.2531, 0.3454, 0.4352, 0.5193, 0.5959, 0.6642, 0.724, 0.7755, 0.8194, 0.8562, 0.8867, 0.9118, 0.9322, 0.9486, 0.9616, 0.9719, 0.9799, 0.986, 0.9907, 0.9941, 0.9967, 1);
  --sp-settle-dur:360ms;
  --sp-pop:linear(0, 0.0435, 0.1463, 0.2761, 0.4118, 0.5401, 0.6536, 0.7493, 0.8265, 0.8866, 0.9316, 0.964, 0.9863, 1.0007, 1.0092, 1.0136, 1.0151, 1.0148, 1.0134, 1.0115, 1.0095, 1.0075, 1.0057, 1.0042, 1.0029, 1);
  --sp-pop-dur:640ms;
  --sp-bounce:linear(0, 0.0659, 0.222, 0.4163, 0.6109, 0.7819, 0.917, 1.0128, 1.072, 1.1007, 1.1065, 1.0972, 1.0794, 1.0584, 1.0379, 1.0203, 1.0066, 0.9972, 0.9915, 0.989, 0.9887, 0.9899, 0.9919, 0.9942, 0.9963, 1);
  --sp-bounce-dur:860ms;
  --sp-bounce-approx:cubic-bezier(.34,1.56,.64,1);

  /* ── material ───────────────────────────────────────── */
  --rim-1:inset 0 0 0 1px rgba(18,18,18,.08);
  --rim-2:inset 0 0 0 1px rgba(18,18,18,.14);
  --rim-top:inset 0 1px 0 rgba(255,255,255,.55);
  --mat-0:transparent;
  --mat-1:rgba(253,253,253,.72);
  --mat-2:rgba(253,253,253,.86);
  --mat-3:rgba(253,253,253,.96);
  --mat-scrim:rgba(18,18,18,.34);
  --blur-1:8px; --blur-2:14px; --blur-3:20px;
  --sh-1:0 1px 2px rgba(18,18,18,.05);
  --sh-2:0 2px 8px rgba(18,18,18,.06),0 1px 2px rgba(18,18,18,.04);
  --sh-3:0 8px 28px rgba(18,18,18,.10),0 2px 6px rgba(18,18,18,.05);
  --sh-hero:-12px 12px 48px rgba(18,18,18,.22);

  /* ── type ── typeface UNCHANGED. all --fs-* UNCHANGED. ─ */
  /* leading: one fluid law, anchored on the hero's 1.08 @60px */
  --lh-auto:clamp(0.95em, 0.91em + 10.25px, 1.6em);
  /* inheritable discretes (unitless — safe to cascade) */
  --lh-display:1.0; --lh-tight:1.08; --lh-prose:1.55; /* was 1.6 */
  --lh-body:1.55;   --lh-small:1.58; --lh-flat:1;
  /* tracking */
  --tr-display:-.042em; --tr-hero:-.028em; --tr-head:-.020em;
  --tr-sub:-.015em;     --tr-title:-.010em; --tr-body:-.004em;
  --tr-flat:0;          --tr-caps:.045em;   --tr-mark:-.008em;
  /* space around headings — em-relative to the heading itself */
  --gap-head-top:1.6em; --gap-head-bot:.42em;
  --gap-eyebrow:.55em;  --gap-para:.75em;

  /* ── bar/chrome ── added while building the header (§9) ── */
  --pad-bar:5px;        /* a bar's own inset; sets its inner concentric radius */
  --gap-bar:2px;        /* between items inside one bar group */

  /* ── targets ────────────────────────────────────────── */
  --tap-min:44px;
}
@media(max-width:760px){ :root{ --blur-1:0px; --blur-2:0px; } }
@media(prefers-reduced-motion:reduce){
  :root{ --sp-quick-dur:1ms; --sp-settle-dur:1ms; --sp-pop-dur:1ms; --sp-bounce-dur:1ms; }
}
```

---

## 9. The header — first real consumer of the token layer

**Jayden, 2026-08-02:** *"I do want the header to be like an actual header because
it looks good on the hero but I noticed it kinda falls flat when you go to sub pages."*

### 9.1 The measured cause

Verified in the source, not assumed. **The home page and the case studies do not share a
header component — they share a stylesheet.**

| | `index.html` | all five case studies |
|---|---|---|
| layout | `nav{display:flex;align-items:center;gap:var(--sp-16-24);padding:32px 0 0}` | `nav{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;column-gap:16px;padding:32px 0 0}` |
| children | burger · drawer · `.navTitle` · `.heroBack` · `.navGroup.navL` (Work / About me) · logo · `.navGroup.navR` (the whole Play menu) · `#talk` | **three** — `.back.backlink` · `.logo` · `.talk` |
| `.navLink` CSS present | yes | **yes (4 occurrences per file)** |
| `.navLink` markup present | yes | **zero** |
| `.moodBtn` CSS present | yes | **yes (8 occurrences per file)** |

**Styles travelled; structure didn't.** A `1fr auto 1fr` grid with one item per cell has no
way to look like a bar — it is three things at three unrelated x-positions with nothing
binding them. That is the "falls flat", and it is a structural fix, not a styling one.

Every one of the five case-study files also ships the full `.navLink` and `.moodBtn` rules
for markup it never renders — dead CSS on five pages.

### 9.2 The token gap this exposed, and how I closed it

Both treatments needed a **horizontal inset for a control inside a bar** — the distance from
the bar's edge to the first item's text. Nothing in §1–§7 covered it, and inventing it per
treatment is precisely how 60 one-off radii happen. Added to §7:

```css
--pad-bar:5px;   /* the bar's own padding; sets the inner concentric radius */
--gap-bar:2px;   /* between items inside one group */
```

Note the one place the concentric rule inverts: with `--r-pill` on the outside and
`--pad-bar` inside, the items take **`--r-pill` too**. `999 − 5` is still `999` in practice —
both ends are already fully round, so equal radii are correct here and only here.

### 9.3 The two treatments

**T1 — the floating pill.** One rounded container (`--r-pill`), `--rim-1` + `--sh-2`,
`--mat-3` + `--blur-2`, icon + label per item, active item in a filled `--accent` tint at
10%. Identical on every page; only the active item and the leading slot change.

**T2 — the ledge.** Full-width translucent bar, `--r-lg`, 1px bottom rim, `--mat-2` +
`--blur-2`, active state as a 2px `--accent` underline instead of a filled pill.

**Recommendation: T2 for the case studies, T1 for the home page** — or T2 everywhere if only
one can exist. T2 sits better under an editorial hero, survives a long "Let's talk" label
without reading as a toolbar, and reuses the `1fr auto 1fr` grid the case studies already
have. T1 is the more distinctive object and the better fit for a page that has a Play menu
to host.

**Active state keys off `data-nav="work|about|play"` on `<body>`** — set once per page on a
case study (always `work`, because a case study *is* a piece of work), flipped by a
scroll-spy on the home page. One attribute, one source of truth, no per-page CSS.

**The Play disclosure opens a panel *below* the bar**, on `--sp-settle` 360ms, with
`--r-lg` + `--sh-3` + `--mat-3`. The bar never becomes a container for a second UI — that
was the hard constraint, and it is why Play earns one slot rather than four.

### 9.4 What comes out of the bar

Six things want it — logo, Work, About, Play, Contact, Back — and the reference carries
three plus a search.

1. **"About me" → "About".** Two words for one idea.
2. **Contact loses its button.** It is a link, not a primary action; the hero and the footer
   both already carry a real CTA. Demoting it to a weighted link (600, ink) removes the only
   filled control in the bar and buys ~30px. This is the teardown's "strip the chrome off the
   back button" finding applied one element over.
3. **Play stays** — it is the site's whole personality — but as a disclosure, so it costs one
   slot, not four.
4. **Back and Play are never both present.** Sub-pages have no Play; the home page has no
   Back. That is what makes six things fit in four slots: the bar is never asked to hold all
   of them at once.
5. **No search.** The reference needs one because it has a corpus. Five case studies do not.

### 9.5 Mobile — Back must not regress

Below 640px: Work / About / Play / Contact collapse into the existing `.navDrawer` (which
takes `--r-xl` and `--sp-settle`). **Back stays in the bar at a real 44 × 44 target on every
sub-page at every width.** The teardown records that the reference drops both its back
affordance *and* its chapter rail below 900px, leaving no way back — that is their bug, and
the existing header-based Back already beats it. Nothing here changes that.

`--blur-1/2` are already `0px` below 760px (§4.3), so the mobile bar costs one tint and no
blur.

### 9.6 Shipping order

**T2 can go to `apollo.html`, `bearings.html`, `cluster.html`, `strata.html` and
`ucdavis.html` immediately.** They are not locked, they already have the `1fr auto 1fr`
grid, and the change is a wrapper element plus `--r-lg` / `--mat-2` / `--rim-1` on it.

The Play disclosure and the scroll-spy active state need `index.html`, which is locked until
the concurrent rewrite lands. **Do the case studies first — they are where the complaint is.**

---

## 8. Found while measuring (not fixed — `index.html` is off-limits)

1. **`--c800` is used but never defined.** `.speech .tw{color:var(--c800)}` and
   one other site both reference it; `:root` declares `--c50 --c75 --c100 --c500
   --c600 --c700 --c900 --c950` and no `--c800`. Those two elements are currently
   inheriting their colour, silently. Either add `--c800:#3A3A3A` or point them at
   `--c900`.
2. **`--lh-body` and `--lh-flat` are declared and used zero times** (§5.2). Five
   `--lh-*` tokens exist and account for **five** declarations between them, while
   22 distinct raw line-height values are set inline. The token layer for leading
   exists on paper only.
3. **`.abName` sets 168px type at `-.02em`** (§5.5). The largest piece of type on
   the site, tracked as though it were a 36px heading. One declaration, biggest
   visible typographic win in this document.
4. **The wordmark's `font-stretch:85.8%` is a hidden dependency on a variable
   axis** (§5.6). It is *well chosen* — measured in-browser it is 0.4% off a
   perfect width match — but it works only because `"Instrument Sans Var"`
   carries a real `wdth` axis (75–100), and it would become a silent no-op with
   no error and no layout shift under any face that lacks one. The sentence-case
   recommendation removes the declaration entirely, which is the cleanest
   possible resolution.
5. **All five case-study files ship `.navLink` and `.moodBtn` CSS for markup they
   never render** (§9.1) — 4 and 8 occurrences per file, zero matching elements.
   Dead CSS on five pages, and the reason the "shared header" looks shared in the
   stylesheet while being a different component in the DOM.
