# Hero environment lighting

**Status:** built 2026-08-08. Supersedes the per-state constant light direction.

Jayden, twice: *"Since the head moves around, the light needs to move and
manipulate with it — can't just be stagnant, won't look realistic"* and *"if
it's closer to the gradient it should shine that colour brighter."*

## The problem with the model, not the numbers

The first pass authored `--time-light-dir` as a **signed constant per
time-of-day state** — `-0.36` at sunrise, `+0.36` at sunset. The head could be
dragged the entire width of the Hero and its lighting never changed, because
the model had no notion of *position*. No amount of retuning the constants could
have fixed that.

## What replaced it

The sky **is** the light source. This is image-based (environment) lighting: a
subject's appearance is driven by the light *arriving* at it (irradiance), which
is dominated by whatever is large, bright and close — here, the gradient behind
it.

Renderers do not integrate the whole environment per pixel. They reduce it to
three terms — the **L1 spherical-harmonic approximation** — and that captures
almost all of the perceptual effect for almost none of the cost:

| term | here | drives |
|---|---|---|
| dominant **direction** | vector from head to the light's authored position | rim side, shadow throw, catchlight offset |
| dominant **colour + intensity** | the sky gradient evaluated at the head | rim hue and strength, bounce |
| **ambient** | a fraction of the same colour, undirected | fills the unlit side so it is never flatly black |

### Direction is computed, position is authored

`--time-light-x` / `--time-light-y` are authored per state: **where the source
sits in the Hero**. `--time-light-dir` is no longer data — it is computed every
frame from `normalise(light − head)` and written back onto the Hero.

The payoff is the **crossover**: drag the head past the light and the rim swings
to the other side. Measured, dragging left to right at 1440: `dir +0.539 →
+0.177 → −0.184`, rim `+17.2px → +6.3 → −5.4`. That is the thing a constant can
never do.

### Colour comes from evaluating the gradient, not sampling it

The skies are authored CSS radial gradients with known focal points and colour
stops, so they can be evaluated **analytically**: find where the head sits in
the gradient's own elliptical coordinate, then interpolate its stops there.

**No pixels are read.** `getImageData` would force a GPU→CPU readback every
frame. There is direct precedent for refusing that in this codebase — the
tournament posters' `--fit` alpha probe was deleted for exactly this reason.

**The gradient stays the only source of truth.** The stop table is parsed from
the *CSSOM* at state-change time, not duplicated in JS, so retuning a sky in
`hero-time.css` retunes the lighting with it and the two cannot drift.

Measured at 1440, same drag positions:

| | daytime | night |
|---|---|---|
| rest | `rgb(126,158,183)` lum .730 | `rgb(71,71,96)` lum .421 |
| toward the focus | `rgb(102,140,168)` lum .681 | `rgb(83,81,108)` lum .441 |
| far corner | `rgb(222,231,241)` lum .931 | `rgb(0,0,0)` lum .350 |

The two skies behave oppositely, correctly: daytime's core is *saturated blue*
so moving away from it goes paler, while night's core is its *only* light so
moving away goes darker. A hand-authored constant could not have expressed both.

## Where judgement beats accuracy

Physical correctness is not the goal; plausibility is. Two deliberate departures:

- **Saturation is restrained** (`0.42` toward grey). Full colour bleed reads as
  a gel. Jayden called this lighting harsh twice; the hue should be present and
  never announced.
- **The range is compressed** (`0.35 + 0.65·lum`). A literal falloff makes the
  head vanish in a dim corner. Note night's far corner floors at `.350` above —
  that floor is the reason it still reads.

## What was removed

The `.heroTimePortraitCast` flood is gone. Measured three ways at sunset and
night before removing it: with the cast forced to zero the picture barely
changes. At sunset the large warm bloom is the **sky's own sun**, not the cast.
At night what survives cast-off is the rim, and halving the rim is what actually
removes the halo. So the flood was paying for nothing while contributing the one
thing he objected to: a localised bright patch with a findable edge.

**If you can see where the light ends, it is wrong.** Light has no edge; a glow
does. `--time-cast` survives as the light *colour*; `--time-cast-opacity` is
retired with the layer.

## Cost

The float loop was deliberately rewritten to read nothing from the DOM and only
write. This preserves that: per frame it is arithmetic plus four
`setProperty` calls (`--time-light-dir`, `--light-prox`, `--env-color`,
`--env-lum`). The gradient parse happens on a state change, not per frame.

## Second pass: the vector had only one component, and nothing was lit

Jayden, on the built version:

> *"That bottom middle light should be shining on the face — I don't see why
> not when I drag it over there."* and *"shouldn't there be more light on his
> face, like the bottom part, how actual light travels when it's under you."*

Both complaints are the same missing piece stated twice, and both were right.

### Direction was horizontal only

`--time-light-dir` is a signed left/right number. The rim it drove was an
x-displacement, and the vertical channel was a per-state `--time-light-elev`
constant — "how high the sun is". A sun height can describe a sky. It cannot
describe where the light is **relative to the head**, and this head rests
*above* the glow, because every one of these skies focuses on its own lower
edge. So the one condition the resting composition is actually in — uplight —
was the one the model had no way to express.

`normalise(light − head)` was already being computed. Its **y** is now kept:

- `--light-ux` / `--light-uy` are the unit vector.
- The rim's offset is the whole vector, so the lit edge travels **around** the
  silhouette rather than switching between two sides. Above the glow it sits
  along the bottom; drag below the glow and it swings over the top.
- `--light-angle` is the same vector in CSS gradient convention, pointing away
  from the source, so a mask written with it is opaque on the lit side.

`--time-light-elev` is deleted. It had one consumer and the vector replaces it.
`--time-light-y` stays low in the frame in every state, because that is where
these skies are genuinely bright — the position has to be where the light is,
or proximity is computed against the wrong place.

### Proximity fed the rim's opacity and nothing else

`--light-prox` faded the edge. The face's exposure was a per-state constant, so
the head could be dragged into the brightest part of the sky and its
illumination never changed. Measured before: face luminance `0.189 / 0.189 /
0.189` across three positions at night. That is a decal that knows where the
lamp is, not a subject in a scene.

Proximity now scales the authored per-state exposure (`--env-gain`) and drives
`flood-opacity` on the uplight layer. Measured after, at 1440, night, same sky:

| head at | face luminance | sky behind it |
|---|---|---|
| level with the glow | **0.284** | 0.100 |
| above the glow | 0.257 | 0.059 |
| off to one side | 0.218 | 0.062 |
| far corner | 0.196 | 0.048 |

Monotonic with proximity, a 1.45x swing end to end.

**Proximity, not `--env-lum`, drives exposure — and they disagree.** At sunset
`--env-lum` *rises* as the head moves away, because that sky's periphery is
near-white while its core is saturated. Weighting exposure by luminance is
defensible image lighting and the exact opposite of "drag it to the glow and it
brightens".

### An edge cannot describe a lit surface

The rim is a `drop-shadow`. It traces the silhouette, which is why it is cheap
and why it is the highest-value cue — and also why it can never say "the chin
and the underside of the nose catch this and the brow falls away". That is a
gradient over a surface.

So the portrait cast layer is back, and it is **not** the layer that was
deleted. That one was masked by a radial ellipse anchored in *hero* space: a
localised bright patch with a findable edge, and if you can see where light
ends it is wrong. This one is masked by a **linear ramp in the head's own box**,
oriented along the live light vector, composited into the portrait's own alpha.
It fades to nothing before it reaches any boundary, so there is no edge to
find.

Its strength is authored per state, and the two ends of the range are opposite
problems: **night needs the most** (its sampled sky is nearly black, and a
faithful screen of black does nothing you can see), **daytime the least** (its
light is near-white, and a strong screen turns a face into paper).

### The white line at night

Halving the rim had not fixed it, because strength was not the whole problem.
Two things were:

1. **The rim was weighted by `--env-lum`, which carries a `.35` floor.** That
   floor exists so a head in a dim corner cannot vanish — right for the face,
   wrong for the edge. Against a near-black sky it held the rim at roughly a
   third strength, and an edge brighter than everything around it is the single
   most recognisable tell of a pasted-on cutout. The rim now reads `--env-raw`,
   the scene's own **uncompressed** luminance. Measured: the brightest band
   outside the silhouette is now **1.04-1.19x** the sky immediately behind it.
2. **The "ground bounce" was a halo.** 2px of offset under 9px of blur, at
   `.32` alpha — by this file's own rule that is a glow, not an edge, and at
   night it was the brightest thing in the picture, sitting on every side of the
   head at once. It is deleted. A rim that can point *downward* says the same
   thing honestly.

### One colour for every lit surface

`--time-lit` (rim, ambient) and `--time-lit-face` (the uplight) are both the
sampled sky pulled toward the state's authored intent, so the edge and the
surface cannot disagree about what is illuminating the head. They differ only in
how far they lean on the authored colour, and that difference is the point: the
edge must never out-shine the scene; the surface must be visible at all.

## The ground shadow is gone

Not tuned — deleted, along with its element, its writer, its five
`--hero-ground-*` knobs and the per-state `--time-shadow` pairs.

This site's rule is that a head casts a contact shadow **because it stands on
something**; that is the one place a shadow is load-bearing here. The Hero head
stopped standing on anything when `--hero-peek-depth` went negative: it is
suspended 164px clear of the floor. At that separation the ellipse is not its
shadow, it is an unrelated smudge near the bottom of the page. Removing it is
the rule being applied, not broken.

Every other head keeps its shadow. Play's companion, the soccer heads and the
tournament heads genuinely stand on a surface; `hero-engine`'s `updateShadow()`
still writes theirs, and now no-ops on a page that has no `#fsh`.

## Traps found here, worth not rediscovering

- **A cross-fade is not an instant.** Picking the sky layer at `opacity === "1"`
  returns nothing for the whole 640ms transition, stranding the previous hour's
  colours on the head. Take the *most visible* layer, and re-read as it settles.
- **A shorthand in a themeing rule silently deletes component motion** — the
  same class of bug that cost `.csTab` its transitions.
- **`display` is not animatable, and `off` is where that bites.** The cast layer
  carried `display:none` in the `off` state only, so leaving `off` it appeared
  instantly at full strength and only then began transitioning, and entering
  `off` it vanished on one frame — a pop against a 640ms sky cross-fade doing
  the right thing all around it. `off` is the state most likely to carry these,
  because it is written as "none of the above" rather than as a look. Fixed with
  `visibility` stepped one duration behind `opacity`, which keeps the original
  intent (an inert layer must not participate) without leaving the transition.
  This project has paid for the same trap once already, in the head and face
  internals.
- **hero-time.js pins this layer's `opacity` inline.** It cross-fades the cast
  through the Web Animations API and leaves the settled value on the element, so
  anything live written to `opacity` in CSS is frozen at whatever it was when
  the hour last changed. Per-state values belong on `opacity`; per-frame values
  belong on `flood-opacity` inside the filter, which nothing else writes.

## Third pass: the sign of the problem was wrong

Jayden, on the second-pass build: *"The light is washing out the face, and it's
not hitting the face realistically at all."* Then, unprompted: *"Honestly I feel
like no shadow might be the move"*, and immediately after, *"maybe shadows on the
face itself, but not on the ground or background."*

Those last two are not a contradiction. They are the distinction this pass is
built on, and it is worth stating in the vocabulary so nobody collapses it again:

| | what it is | verdict |
|---|---|---|
| **cast shadow** | the dark shape an object throws **onto a surface** | gone, and stays gone — nothing here stands on anything |
| **form shadow** | the object's own far side **falling away from the light** | kept, and it is now doing most of the work |
| `drop-shadow()` | a filter that follows alpha, used to draw the **rim** | kept — it draws light and only shares the name |

### First, the measurement nobody had taken: which way is the photograph lit

Every earlier tuning pass was guessing, because the head is a photograph and
nobody had established what light it was already carrying. Sampled off the alpha
and pixels of `images/rest.webp`:

- six columns across the **mid-face** band read `.568 / .767 / .756 / .736 /
  .707 / .412` left to right — **symmetric to within a few percent**;
- the **mouth/chin** band reads `.683` against `.692` and the **jaw** `.544`
  against `.538` — symmetric to within `.01`;
- the luminance centroid sits **dead centre horizontally** (`dx −0.013` of the
  head's width) and **0.14 below** the geometric centre.

So: **a broad, soft, near-frontal key with a slight lift from underneath, and
essentially no form shadow of its own.** Beauty lighting. Two consequences that
decide everything downstream:

1. **The scene's direction cannot contradict the photograph, because the
   photograph does not assert one.** Any azimuth is available.
2. **A flat face composited into a directional sky is the "sticker".** And the
   second-pass layer *screened light onto it*, which flattens it further and
   lifts the blacks. Adding light to a face that is already evenly lit is the
   wash. **What it was missing was the dark it never had.**

### The layer inverted: screen → multiply

Same element, opposite sign. It is a copy of the portrait composited into its own
alpha, so it can only ever paint on the face — it cannot reach the ground or the
sky, and there is no cast anywhere in this file. What changed:

- `mix-blend-mode: screen` → **`multiply`**;
- the mask ramp is turned `+180deg`, so it is opaque on the side facing **away**
  from the source and fades to nothing by 92%, with its last third under `.1`.
  If you can see where it ends it is wrong, and that applies to the absence of
  light as much as to light;
- `--time-uplight` → **`--time-shade`**, and the per-state ordering **inverts**:
  daytime the lightest hand, night the firmest. A huge soft source barely shades
  anything; a small dim one is all shadow. That inversion is itself the evidence
  the old sign was wrong;
- the flood colour is `--time-shade-color`, the hour's light taken down toward a
  dark blue rather than toward black — **a shadow is not an absence of colour**,
  it is what the rest of the sky still reaches into.

Measured, lit-side over shadow-side across the head, with the layer off and on:
`2.91 → 3.67` at night, `9.95 → 10.91` at daytime, `4.25 → 4.81` at sunset. The
mean face luminance moves far less than that — which is the point. **The shade
layer supplies form, not exposure.** Exposure is `--time-exposure`.

### The light was standing somewhere it is not

`--time-light-x` was authored per state at `34% / 32% / 50% / 62% / 68% / 66%`.
**Five of those six were fiction.** Every sky here is a radial gradient focused
at `50%` of its own lower edge; nothing in any of them is brighter on one side.
The head therefore got a different light vector each hour for a reason not
present in the picture — measured at rest, `(0.04, 1.00)` at pre-dawn,
`(−0.23, 0.97)` at sunrise, `(0.98, 0.21)` at sunset. The rim swung from directly
underneath to sideways to the opposite side between skies that are identical in
shape.

**The source is read off the gradient's own focal point now.** The authored pair
survives as the pre-script fallback and has been retuned to name the same place.
At rest the vector is `(0.57–0.64, 0.77–0.82)` in **every** state — consistently
up and inward, which is both true and the uplight Jayden asked for.

`--light-angle` also has the head's own rotation subtracted. The ramp is painted
in the portrait's box, which hangs inside a wrapper turned `−13.8°` plus the
float, so a screen-space angle was arriving that much off the light it describes.

### A sky is every layer of itself

`parseGradient` read only the **first** `radial-gradient(` in the background.
Right for the five daylight skies, which are one opaque radial. Wrong for night,
which is two translucent glows over an opaque linear base — so the model saw
`rgba(…,0)` wherever the glows had faded and concluded the sky was **pure
black**. Measured on the shipped build at the resting position: `--env-color`
`rgb(0,0,0)`, `--env-raw` `0.000`, which collapsed the rim to **3.9% alpha** and
the ambient to nothing. Night — the one state this file puts legibility *on* the
rim and the catchlight — had neither.

Every layer is parsed and composited now, over the Hero's own background colour,
with **premultiplied** stop interpolation (straight RGB drags a hue to black on
its way through a `transparent` stop). Night's sample at rest is `rgb(19,23,31)`.

**And the rim asks a different question from the face.** Diffuse shading is
irradiance — large, close, blurred — so `--env-color` / `--env-lum` sample the
sky **at the head**. A grazing highlight is a reflection of the **brightest**
thing present, so `--env-raw` blends the local sky toward the **source's** own
luminance by proximity. That is why the rim can exist at night without the face
being lifted to match.

### The self-referential opacity: investigated, and it was not the cause

Handed over as the prime suspect for the wash. It is not, and the reason is an
ordering detail: `transitionScene` calls `clearSettledSceneStyles()` **before**
`targetScene()`, so the inline pin is gone by the time the read happens and the
computed value falls through to the authored per-state CSS. Reproduced in the
browser on a probe carrying the same `opacity:var(--authored)` plus a 640ms
opacity transition — pin `.34`, retarget to `.18`, `removeProperty`, read →
**`0.18`, not `0.34`**; identical with the transition removed. The controller's
own unit tests assert a different destination per hour and passed against the
pre-fix source, which is the same answer from a second direction.

It is still read from `--time-shade` on the Hero rather than off the element,
because the old version's correctness rested entirely on two lines in another
function staying in that order. The test harness now pins the layer's rendered
opacity to a decoy no state asks for, so a regression fails every state
assertion instead of quietly agreeing with itself. The `filter` channel was read
the same way and is simply **not written any more** — it never varies by hour.

**The wash was the additive flood plus night's exposure**, not the plumbing.

## The measured table, at 1440, at rest

Ratios are against **each state's own sky**, never absolute.

| state | face | its sky | **ratio** | rim α | rim vs sky | form (off → on) | light | vector |
|---|---|---|---|---|---|---|---|---|
| `off` | .350 | 1.000 | **0.35** | — | — | — | — | — |
| `pre-dawn` | .388 | .823 | **0.47** | .114 | 1.02× | 3.98 → 4.61 | 50% 103% | (.61, .80) |
| `sunrise` | .456 | .879 | **0.52** | .157 | 1.01× | 4.72 → 5.31 | 50% 105% | (.58, .82) |
| `daytime` | .452 | .872 | **0.52** | .082 | 1.02× | 9.95 → 10.91 | 50% 105% | (.57, .82) |
| `dusk` | .432 | .784 | **0.55** | .137 | 1.02× | 4.00 → 4.57 | 50% 105% | (.59, .81) |
| `sunset` | .442 | .801 | **0.55** | .165 | 1.02× | 4.25 → 4.81 | 50% 100% | (.64, .77) |
| `night` | .136 | .077 | **1.77** | .086 | 1.23× | 2.91 → 3.67 | 50% 104% | (.60, .80) |

Night was **2.87×** before this pass — worse than the 2.40× already called a
ghost. It is 1.77× against the 1.68× that was judged right. Every daylight state
is below 1: the face is the darker thing against a bright sky, which is correct.

## And in motion, which is the only way to judge it

Dragging the head around the night sky, at 1440:

| head at | ux | uy | prox | face | its sky | ratio | rim α |
|---|---|---|---|---|---|---|---|
| rest (482, 622) | +.60 | +.80 | .70 | .136 | .078 | 1.76 | .090 |
| into the glow (699, 761) | +.09 | **+1.00** | **.86** | .145 | .132 | 1.10 | .110 |
| left of it (300, 640) | **+.81** | +.59 | .60 | .131 | .073 | 1.81 | .078 |
| right of it (1148, 640) | **−.82** | +.57 | .59 | .129 | .073 | 1.78 | .078 |
| high above it (700, 239) | +.02 | **+1.00** | .46 | .125 | .048 | 2.62 | .063 |
| far top-left (148, 200) | +.61 | +.80 | .28 | .115 | .046 | 2.50 | .047 |

- The rim **crosses over**: `ux` swings `+.81 → −.82` as the head passes the
  glow, `--light-angle` sweeping a 110° arc, and `uy` stays positive throughout —
  the light is always below, which is the truth of this composition.
- **Proximity drives exposure**: face luminance falls monotonically `.145 → .115`
  as `--light-prox` falls `.86 → .28`. A 1.26× swing from nothing but position.
- **The face takes the sky's colour**: `--env-color` `rgb(33,36,49)` in the glow,
  `rgb(11,13,18)` in the far corner.
- The far corners rise to ~2.5×, because the sky there is nearly black while the
  face is held up by the `--lit-floor` and the `--env-lum` floor. That is the
  compression working as authored: a head dragged into a dead corner reads dim
  rather than disappearing.

## The default hour is `daytime`

Not `auto`. A recruiter opening this at 11pm landed on the near-black hero, which
is the least legible state and the hardest one to judge any of the above in.
Daytime is the legible baseline and discovery becomes a reward rather than a
lottery. `auto` stays in the menu and still follows the real clock.

The mechanical part matters: `auto` used to be persisted **by removing the
storage key**, so an explicit choice of Automatic and never having chosen were
the same row. Harmless while auto was also the default, fatal once it is not — a
default has to apply where there is no preference and lose to one where there is,
including to `auto`. Every mode is written out now, and only a genuinely absent
key falls through to `SiteThemeState.DEFAULT_MODE`. `normalizeMode` still answers
`auto` for garbage on purpose: that names an *unreadable* preference, which is a
different question from a *missing* one.

Verified on a fresh origin: no key → `data-theme-mode="daytime"`, state
`daytime`, icon `daytime`, exactly one `aria-checked` item and it is Daytime. A
stored `auto` survives a reload and resolves to the real hour.

## Fourth pass: an hour has to pass, not be set

Jayden: *"All the transitions of the lighting need to be smooth as well... when
it goes to dark mode it should feel like the time of day is changing."*

Every value was landing on the right number. They were just not travelling.

### Unregistered custom properties do not interpolate — they snap

To CSS an unregistered custom property is an untyped string, so a transition on
it jumps at the substitution point. There is no halfway between `#eaf2ff` and
`#9ab0ff` for the engine to compute, because it does not know those are colours.

Measured 25% of the way through a daytime → night change (169ms of 640):

| channel | 0% | **25%** | 100% |
|---|---|---|---|
| `--time-cast` | `#eaf2ff` | **`#9ab0ff`** | `#9ab0ff` |
| `--time-exposure` | 1.20 | **.36** | .36 |
| `--time-contrast` | .96 | **.70** | .70 |
| `--rim-strength` | 16% | **34%** | 34% |
| `--time-shade` | .34 | **.58** | .58 |
| `--eye-glint-mix` | 26% | **56%** | 56% |
| `.heroNightStars` opacity | 0 | **1** | 1 |

Six channels and the stars finished on frame one while the sky took the full
640ms behind them. That is the "settings change" reading exactly: the light
jumps, the backdrop drifts after it.

`@property` fixes it, and **which properties get a transition is the design**:

- **Per-state channels — what the hour *is*** — are registered and transitioned
  on `.hero`. One duration, one easing, declared once via `transition-property`
  longhands rather than repeated nineteen times.
- **Per-frame channels — where the head *is*** (`--light-ux/-uy`,
  `--light-prox`, `--light-angle`, `--env-color`, `--env-lum`, `--env-raw`,
  `--time-light-dir`) — are registered for their *type* and deliberately left
  out of that list. A transition on those makes the lighting chase the drag.
- **Derived values are registered for nothing**: `--time-rim`, `--time-ambient`,
  `--time-lit`, `--time-shade-color`, `--time-portrait-filter` recompute from
  the channels above on every frame and arrive smooth without a type of their
  own. `--time-rim` in particular *cannot* be typed — the base `.hero` rule
  assigns it `var(--rim-3)`, a box-shadow.

**Registration is not free**: a registered property always has a value, so
`var(--x, fallback)` stops reaching its fallback. Every `initial-value` is set
to the fallback its `var()` already carried.

### The transition that was making it worse

`#face` transitioned `filter` and `opacity` on 640ms. That is the obvious way to
smooth an hour change and it was the wrong one: the chain is fed by
`--light-ux/-uy`, which change **every frame** while the head floats or is
dragged, and a transition restarts on every change — so the rendered rim chased
the head with a 640ms lag. The feature Jayden asked for was being smeared by the
mechanism meant to smooth it. Both are gone; the filter is recomputed from values
that are already interpolating. Measured after: the rendered `drop-shadow` offset
matches `--light-ux × --rim-throw` to **0.00px on the frame the drag lands.**

It also retires the filter-list interpolation rule entirely — no two chains ever
have to be structurally matched, because no chain is ever interpolated.

### `off` was an absence, and now it is a look

`--time-portrait-filter:none` is a different *shape* of value, not a quieter one:
`filter:drop-shadow(…) drop-shadow(…) none` is not even valid, so the whole
declaration was dropped and the head lost its chain in one frame. Every channel
Off wants quiet is authored at its neutral value instead — contrast and exposure
at 1, `--lit-floor:1`/`--lit-swing:0` to pin `--env-gain`, the rim at **zero
strength and zero throw rather than a shorter chain**, the shading at zero.
Measured: `off` now reports rim alpha exactly `0`, and leaving or entering it is
the same continuous event as any other hour.

There is **no `display` toggled by any `data-time-state` selector** any more. The
only survivors are `.heroAura`, which is `display:none` in *every* state and so
never transitions, and the icon glyph swap.

### A cross-fade of two stacked layers is not a cross-fade

The six skies are separate layers cross-faded on opacity, which is right —
gradients cannot interpolate. But both layers ramped at once, one up and one
down, and they are **stacked**: at weights *w* and *1−w* the picture is
`w·incoming + (1−w)·((1−w)·outgoing + w·backdrop)`, so a quarter of the Hero's
own background paints *through* the pair at the midpoint — and that background is
itself mid-transition between white and near-black.

Measured at the head's resting point, daytime → night, against a straight blend
of the two skies:

| night's weight | luminance error | deviation R / G / B |
|---|---|---|
| .42 | **−11.2%** | −9.6 / −16.3 / −23.3 |
| .57 | **−23.2%** | −18.8 / −25.5 / −32.3 |
| .69 | **−33.2%** | −22.4 / −28.1 / −34.1 |

The sky dipped dark and desaturated on its way to night — every value moving
correctly and the composite still lurching. **Hold and cover** replaces it: the
arriving sky is lifted above the others and fades 0 → 1; every other layer holds
where it is and is dropped to its destination only once the arriving one is
opaque. The lift is mandatory rather than tidy — the arriving layer is often
*earlier* in the DOM than the outgoing one, and without it the held layer would
cover the arriving one and vanish in a single frame. `off` is the one state with
no arriving sky, and the one where the page underneath is the point, so it keeps
the plain fade.

Measured after, on `daytime→night`, `night→daytime`, `sunset→night` and
`daytime→off`, at weights .41 / .57 / .74: **deviation 0.0 in every channel.**

### The sampler was reading one sky at a time

`parseSky()` took the *most visible* layer. Better than requiring `opacity === 1`
— which returned null for the whole 640ms and stranded the previous hour's
colours — but it still **switches which sky it reads, in one frame**, when the
incoming layer overtakes the outgoing. Measured sunset → night: the blue channel
of the shading colour travelled **62% of its journey backwards** before
returning.

Every on-screen layer is parsed now and the sample is the weighted composite the
eye is actually looking at, honouring the z-index the cross-fade sets. The
expensive half — tokenising the gradients — is cached per element; only the
opacities are re-read, and only inside a window of `--hero-time-duration` after a
state change. That window replaced a row of `setTimeout(relight)` calls at
0/120/340/700ms, which was the same idea sampled four times — and four samples
across a cross-fade *is* a step.

### The verification

Eleven legs, sampling every lighting channel at 160 / 320 / 480ms of 640, judged
against the reference curve that `background-color` — a real CSS property on the
same duration and easing — actually traces: `(0.635, 0.940, 0.991)`.

**95 channels with a meaningful excursion. 5 flags, all benign:** two are a
measurement artefact (`skyIncoming` degenerates on the leg into `off`, which has
no arriving layer), three are the shade flood overshooting ~12–22% on `off→night`
— a few units on a near-black colour under a layer whose own opacity is ramping
from zero.

Below the 24-unit noise floor sit another 125 channel/leg pairs where the total
travel is smaller than 8-bit rounding. Two signatures are **correct** and were
flagged by an earlier, naiver check: colour channels interpolating to or from
`transparent` show RGB at target immediately with alpha ramping, which is
premultiplied interpolation doing the right thing (a fade-in, not a pass through
black); and `cubic-bezier(.22,1,.36,1)` is ~69% complete at 25% of its duration,
so "already most of the way there" is the curve, not a snap.

### The chrome exception, on purpose

Nav, footer and the case-study surfaces run on `--theme-duration` (400ms). They
are UI responding to a theme change, not sky moving. The scene — sky, spill,
stars, rim, exposure, shading, catchlight, hero background — all runs on
`--hero-time-duration` (640ms) and lands together. **That difference is intended;
it is not a rung someone forgot to update.**

The catchlight lost its own `--dur-reveal` transition in this pass. Its inputs
now interpolate on the sky's duration, so the old rule ran a *second*, shorter
ramp on top of the first — the highlight finished twice, at 360ms and again at
640ms, which is exactly the compound easing that reads as sloppy. It is a
reflection *of* the sky, so it lands when the sky lands. Its `left` stays
unlisted: that rides `--time-light-dir`, which is per-frame.

## The measured table after the transition pass, at 1440, at rest

| state | face | its sky | **ratio** | rim α | rim vs sky | form (off → on) | vector |
|---|---|---|---|---|---|---|---|
| `off` | .350 | 1.000 | **0.35** | **0** | — | — | — |
| `pre-dawn` | .387 | .827 | **0.47** | .114 | 1.02× | 3.97 → 4.60 | (.61, .79) |
| `sunrise` | .455 | .884 | **0.52** | .157 | 1.01× | 4.71 → 5.29 | (.59, .81) |
| `daytime` | .451 | .876 | **0.52** | .082 | 1.02× | 9.89 → 10.84 | (.58, .81) |
| `dusk` | .432 | .786 | **0.55** | .137 | 1.02× | 3.99 → 4.55 | (.60, .80) |
| `sunset` | .442 | .800 | **0.55** | .165 | 1.02× | 4.23 → 4.79 | (.66, .76) |
| `night` | .136 | .078 | **1.75** | .086 | 1.23× | 2.90 → 3.66 | (.61, .79) |

Unchanged from the third pass to within .003 — the smoothing moved how the
values travel, not where they arrive.
