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
