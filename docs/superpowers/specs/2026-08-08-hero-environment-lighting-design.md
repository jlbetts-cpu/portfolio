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

## Traps found here, worth not rediscovering

- **A cross-fade is not an instant.** Picking the sky layer at `opacity === "1"`
  returns nothing for the whole 640ms transition, stranding the previous hour's
  colours on the head. Take the *most visible* layer, and re-read as it settles.
- **A shorthand in a themeing rule silently deletes component motion** — the
  same class of bug that cost `.csTab` its transitions.
