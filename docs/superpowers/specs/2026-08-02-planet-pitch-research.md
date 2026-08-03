# The gradient planet under the pitch — research

**Date:** 2026-08-02 · **Status:** research only, nothing implemented, no existing file touched.
**Ask (Jayden):** "in play.html they should be sitting on that gradient planet and
jumping around on that so just on the pitch" — plus "a super neat water reflection
under the heads."

Everything below is measured against the real code (`play-engine.js`,
`play.css`, `play.html`) and the two specs this idea collides with. Where a number
appears it was computed, not estimated.

---

## 0. The one-paragraph answer

Nintendo already solved this and the answer is not the one the framing implies.
**Animal Crossing bends the world in the vertex shader and leaves the collision
world flat** — the curve is a render-time displacement, gameplay geometry never
moves. That is exactly the right shape of change here, because
`play-engine.js` already ends every head's frame by writing
`translate(x,y) … rotate(surfRot) scale(…)` at line 1141–1143, where `surfRot` is
a *sum of contributions*. A planet curve is one more addend to `surfRot` and one
more addend to the `y` term. The 76 references to `floorY` and the 49
`surface=floorY` assignments never have to learn that the ground is curved.
So: **option (C), render-curved / physics-flat.** Recommendation and maths in §2.

---

## 1. Reconciling with §3.9 (the Globe Lobby) and the gradient contract

### 1.1 They are the same planet in two registers, and that is a feature

§3.9 of `docs/superpowers/specs/2026-08-02-next-chapter-brief.md` (full addendum at
`docs/superpowers/specs/2026-07-30-tournament-broadcast-design.md:422–452`) specs a
**Globe Lobby**: photo heads standing on a planet, Mario Kart 8's online lobby as
the reference, Concept 1 with Concept 3's roulette physics. The addendum is explicit
about register:

> "the lobby is the *sky* register (space, night); the matchday surfaces stay the
> *ground* register (daylight print). The beam-down from lobby to stadium is the
> licensed transition between the two."

Jayden's new ask puts a planet on the **pitch**, which is the ground register. Read
naively that breaks the sky/ground split the addendum settled. It does not have to,
and the reconciliation is worth more than either idea alone:

- **The lobby globe is a whole planet seen from outside.** Full disc, limb visible,
  heads distributed around the circumference, surface-normal rotation of ±90° and
  beyond. That is the §3.9 build, unchanged.
- **The pitch planet is the same planet seen from the ground.** You have descended.
  The disc's limb is now off-screen; what remains on-screen is a shallow swell of
  the same surface, with the same gradient, the same rim light, the same grain.
  Heads tilt 4–5° at the wings instead of 90°.

That is the beam-down, made literal: **the lobby's globe becomes the pitch's
horizon.** Same texture, same gradient nodes, two camera distances. It strengthens
§3.9 rather than pre-empting it, and it gives the transition a real visual
continuity instead of a cut.

**Consequence for build order:** the pitch planet is a *prequel* to §3.9, not a
replacement. It exercises the arc maths, the surface-normal rotation and the
baked-planet asset pipeline at a shallow, forgiving 5° — before §3.9 has to make
them survive at 90°. That is a good order to discover bugs in.

### 1.2 The "no WebGL" rule stands, and there is a better dodge than the spec's

The addendum's rule: *"No WebGL/three.js — the globe is a masked 2D texture with
circle math (position on arc + surface-normal rotation), consistent with the
no-dependency site."* That rule is correct and this proposal obeys it. But for the
*pitch* planet there is a cheaper answer still:

**Bake the planet in Gradient Lab and ship a `.webp`.** `gradientlab.html:249,1092–1097`
already has a working **Download PNG** export, and preset 2 is **Ember** — the
declared regression baseline for the engine. So the pipeline is: dial the planet in
Gradient Lab at the two team colours (or a fixed Ember-derived planet), export PNG,
resize/convert to `.webp`, ship as a single `background-image`. Runtime cost: one
decoded image, zero JS, zero canvas, zero shader. The gradient look Jayden wants is
the *engine's* look, verbatim, because it *is* the engine's output.

The NASA Blue Marble masters already committed —
`images/earth-disc-src.jpg` (593 KB, 2048² disc) and
`images/earth-map-src.jpg` (2.51 MB, 5400×2700 equirectangular) — are for the
**lobby**, where a recognisable Earth is the joke (Mario Kart's globe is Earth).
The pitch planet should **not** be Earth. Reasons:

1. Continents under a football pitch reads as a map, not as ground.
2. `earth-map-src.jpg` is 2.51 MB and must never be served raw (the brief's own
   rule); the pitch needs a ~40–80 KB decorative surface, not a texture master.
3. The gradient contract wants a *gradient* planet, and a photographic Earth
   violates almost every rule in `gradient-reference-notes.md` §A at once.

So: Blue Marble stays reserved for §3.9's lobby. The pitch planet is Gradient-Lab-baked.

### 1.3 What `gradient-reference-notes.md` requires of it

The taste contract is not optional here. Checked clause by clause against a
pitch-planet surface:

| Clause | What it means for the pitch planet |
|---|---|
| **A1 layered passes, ordered occlusion** | Do not build the ground from one `linear-gradient`. Two or three baked passes with their own edges surviving the crossing — which a Gradient Lab bake gives for free. A CSS multi-stop linear gradient is exactly the "symmetric weighted averaging" the notes call smudge. |
| **A2 tension edges** | The lit flank of the swell is taut, the trailing side feathers long. Asymmetric — so the light is *not* at pitch centre. Put the dominant light off-centre (~35–40% across), which also stops the pitch reading as a symmetrical arch. |
| **A3 seams saturate** | Where the two team hues meet (if the planet takes team colour), chroma must **rise**. `color-mix(in oklch, …)` at the seam, per §3.6's existing ruling — never sRGB interpolation, never grey. |
| **A4 the rim escapes the silhouette** | This is the single most important one for the planet reading. A thin warm specular arc sitting *on* the horizon line and bleeding slightly **above** it into the sky is what makes the swell read as a lit sphere rather than a hill. See §4 — it is also the strongest "this is a planet" cue in the game precedent. |
| **A5 static chunky grain** | **Answers the animated-vs-static noise question in the reflection brief outright: static.** Grain is baked into the `.webp`, never animated, never a uniform overlay. |
| **A6 spherical form: bands arc as great circles and taper at the limb** | The horizon band must taper and darken toward the screen edges (limb shading), not run at uniform density edge to edge. Cheap: a `mask-image` with a horizontal falloff. |
| **B1 corner-anchored, partially cropped** | *"a centered orb is a poster, a cropped orb is UI."* The pitch planet is cropped by construction — its limb is off-screen left and right. It already satisfies B1, which is a good sign the idea is native to the system. |
| **C** | New gradient surface ⇒ passes the ladder: Ember baseline first, then the surface's own reference pin. |

---

## 2. Flat vs arc — the central question, with the maths

### 2.1 What the engine actually does today

`survey()` (`play-engine.js:348–379`) computes exactly one number:

```js
try{window.__hmFeetY=fY;}catch(_){}   // publish the shared feet plane
floorY=fY-HH*FOOT;                    // feet rest on that shared floor, whatever the head's size
```

The comment at line 362–363 records why it is one number: an `HW`-dependent floor
cap "gave every head its own floor, each publishing a different `__hmFeetY` — which
is why the goals visibly jittered." The documented seating rule (brief §3.4,
lines 140–142) is that **every head's FEET share the line, whatever its size**; size
is identity, not a depth cue.

Consumers of that single line:

| Consumer | Site | Reads |
|---|---|---|
| Head physics/AI | `play-engine.js`, **76** `floorY` refs, **49** of them `surface=floorY` | landing plane, jump targets, wall clamps, NaN killswitch recovery |
| Head shadow | `:1147–1151` | `shG = floorY + HH*FOOT`, then per-frame platform override |
| Soccer `geo()` | `:1318–1327` | `groundY = window.__hmFeetY` under `.hmFull`, then **latched** into `_gyLock` for the whole match |
| Goals + goal shadows | `:1427–1430` | `groundY-150`, `groundY-4` |
| Ball rest + roll | `:1846`, `:1932` | `REST = groundY - BR`; `grounded = by >= groundY-BR-1` |
| Ball shadow | `:1943–1945` | `groundY + shOff` |
| Battle props/bombs | `:1225` → `window.__hmGroundY` | ice floor `:116`, props `:177` |
| Podium | `:2688–2696` | pedestals stand on `groundY` |

### 2.2 There is already a precedent for an x-varying surface — and a warning inside it

The lava game **already** does what option (B) proposes:

```js
window.__hmLavaY=function(xpx){return surfaceY+waveAt(xpx,(performance.now()-t0)/1000);};
```
(`play-engine.js:2599`) — a height *function of x*, called per-frame at 9 sites
(`:662, :856, :874, :1015, :1025, :1159, :1189, :1192, :1206`) with the object's
centre x. So the *plumbing pattern* for a curved ground is proven in this codebase.

But read what the lava mode does to the floor to make that work:

```js
if(battleOn&&window.__hmLavaOn&&surface>=floorY-2)surface=1e5;   // in lava mode the FLOOR isn't solid
```
(`:1034`). Lava mode **removes the walkable floor entirely** — `__hmLavaY` is a
*death line*, not a surface anyone stands on, walks along, or lands on. So the
precedent proves the call-site pattern and proves nothing at all about the hard
part: **walking, landing, hopping and AI-aiming on a sloped surface has never been
exercised in this engine.** That is the honest read, and it is the reason (B) costs
more than the `__hmLavaY` precedent makes it look.

### 2.3 The curvature maths

For a sphere of radius `R` rendered so its apex sits on the play line, the surface
drop ("sag") at horizontal distance `d` from the apex is

```
sag(d,R) = R − √(R² − d²)   ≈  d² / (2R)      (error < 0.2px for every row below)
```

and the surface tangent tilts by `θ = asin(d/R)`.

Desktop pitch = full viewport width; take `d = 640px` (half of 1280). Phone
`d = 195px` (half of 390).

| R (px) | sag @640 | tilt @640 | sag @195 (phone) | reads as |
|---:|---:|---:|---:|---|
| 1,000 | **231.6** | 39.8° | 19.3 | a ball. Heads at the wings are on a wall. |
| 2,000 | **105.2** | 18.7° | 9.5 | a ball you are standing on |
| 3,000 | **69.1** | 12.3° | 6.3 | strong planet, still cartoon |
| 5,000 | **41.1** | 7.35° | 3.8 | unmistakably a planet |
| 6,400 (10× half-width) | **32.0** | 5.74° | 3.0 | clearly curved, still a *world* |
| 8,000 | **25.6** | 4.59° | 2.4 | the sweet spot |
| 10,000 | **20.5** | 3.67° | 1.9 | gentle swell |
| 16,000 | 12.8 | 2.29° | 1.2 | subtle |
| 32,000 | 6.4 | 1.15° | 0.6 | nearly imperceptible |
| **102,400** | **2.0** | **0.36°** | 0.19 | **invisible (<2px)** |

**The number that decides the question: to hide the curvature you need R > 102,400px
— 160× the pitch half-width.** A globe of that radius has a 204,800px disc: 160
screens wide. It is not a globe; it is a flat floor with a rounding error.

So option (A) as posed — *"at a large enough globe radius the curvature over a
1280px pitch may be visually negligible"* — is **self-defeating**. Any globe large
enough for the flat play line to be honest is too large to read as a globe at all.
There is no R that is simultaneously curved-looking and flat-enough-to-cheat. If a
visible arc is drawn under a flat walk line, the heads at the wings float above the
surface by the sag in the table — 25.6px at the sweet spot, which is **a quarter of
a head** (`HW` is 66–108px desktop, `HH = 1.2·HW`). Fatally visible.

**(A) is therefore only viable in one form:** the planet's surface is never visible
*under* the heads at all — it sits entirely behind them as a backdrop disc, and the
heads walk a line that is not on it. That is a legitimate cheap option, but it is
not "sitting on that gradient planet." It is a planet-shaped wallpaper. It does not
answer the ask.

### 2.4 What option (B) really costs

True arc ground = `floorY` becomes `floorAt(x)`. The honest bill:

1. **49 `surface=floorY` assignments** become `surface=floorAt(x)` — and they are not
   interchangeable, because most of them set `surface` *at the moment of takeoff*
   for a head that is about to travel horizontally. `surface` is a scalar snapshot;
   on an arc it must be re-evaluated at the landing x, which is not known at takeoff.
   That is not a find-and-replace, it is a semantic change to the jump model.
2. **Landing** (`:1188`) `if(!air&&…&&y>floorY)y=floorY;` and the resting clamp
   become slope-aware, and a head that lands on a slope should slide or plant. Both
   are new behaviour that has to be tuned, not ported.
3. **The AI's positional reasoning** — `aimX`, the hop-count estimator
   (`hopsLeft=Math.round(Math.abs(tx-x)/70)`, ~11 sites), the ball-height tests
   (`ballHigh=(floorY-ballY)>150`, `:813`; `:832`), the danger metrics — all treat
   `floorY` as a constant to subtract. Each becomes a per-x lookup.
4. **`geo()`'s latch.** `_gyLock` (`:1322,1409`) exists specifically to freeze the
   pitch line for a whole match so goals don't chase the big head. A per-x ground
   is not a scalar and cannot be latched the same way; the latch has to become a
   latched *sag + baseline* pair.
5. **Ball.** `REST = groundY − BR` and `grounded = by >= groundY−BR−1` become
   x-dependent, and the roll model (`rollW = bvx·(180/π)/BR`) becomes
   roll-along-arc-length.
6. **Shadows.** Head (`shG`), ball (`groundY+shOff`) and goal shadows all move to
   `floorAt(x)`; head shadows additionally need a slope-matched ellipse or they read
   as pasted on.
7. **Everything that consumes `__hmFeetY` / `__hmGroundY` cross-module** — including
   the duplicated copies in `index.html` (`:5083, :5939, :6035`, and note the brief's
   rule that "`index.html` defines things twice"), podium pedestals (`:2688`), ice
   floor (`:116`), props (`:177`).
8. **The seating rule itself** would need re-stating: "every head's feet share the
   line" becomes "every head's feet share the *surface*", and the floating-captain
   bug (brief §3.4, already open on this branch) gets a second dimension to be wrong in.

Rough size: this is a multi-day change touching the most load-bearing invariant in
the engine, with a regression surface that includes every game mode. **Not worth it
for a visual swell of 25px.**

### 2.5 Recommendation — (C): render-curved, physics-flat

Keep exactly one `floorY`. Add one pure function and apply it **only at render
time**, gated on `body.hmSoccer` (which is literally Jayden's "just on the pitch").

```js
// hero-local. cx = pitch centre, half = pitch half-width, SAG = the drop at the wings.
function arcY(x){ var u=(x-cx)/half; return SAG*u*u; }          // parabola ≡ circle to <0.2px
function arcDeg(x){ return Math.atan2(2*SAG*(x-cx)/(half*half),1)*57.2958; }  // surface normal
```

Six call sites, all of them lines that already exist and already write a transform:

| Line | Today | Becomes |
|---|---|---|
| `:1141–1143` head root | `translate(x+shx, y+…)` … `rotate(surfRot)` | `y + arcY(cx_head)`; `surfRot + arcDeg(cx_head)` — **`surfRot` is already a sum of six terms (`:1137`), so this is one addend** |
| `:1151` head shadow | `translate(…, shG-2)` | `shG - 2 + arcY(cx_head)` (+ optional `rotate(arcDeg)`) |
| `:1427–1428` goals | `groundY-150` | `groundY-150+arcY(XL)` / `arcY(XR-42+21)` |
| `:1429–1430` goal shadows | `groundY-4` | `+arcY(...)` |
| `:1945` ball shadow | `groundY+shOff` | `+arcY(bx)` |
| `:1936` ball | `translate(bx-BR, by-BR)` | `by-BR+arcY(bx)` |

Nothing else changes. `survey()`, `__hmFeetY`, `__hmGroundY`, `geo()`, the latch,
all 49 `surface=` assignments, the AI, the jump model, `index.html`'s duplicate
copies — untouched.

**Recommended SAG:** `SAG = clamp(0.020 · pitchWidth, 12, 30)` → 25.6px at 1280,
28.8px at 1440, 12px (clamped) at 390. Equivalent real radius ≈ 8,000px desktop.
Max surface tilt 4.6°, which is enough to be felt in the head rotation and small
enough that no head ever looks like it is falling over.

**Why the parabola, not a circle:** at R=5,000 / d=640 the parabola misses the true
circle by **0.14px**. Use the parabola; it is one multiply, and its derivative (the
normal) is exact and free.

**Known error budget of the cheat, quantified:**
- *Head-to-head collision* is computed in flat space. Two heads only collide when
  their x values are close, so the rendered-y disagreement between them is
  `slope × |Δx|`. At max slope 0.081 and a head width of 96px, worst case **7.8px**
  — under a tenth of a head, invisible during contact.
- *Springboard stacking* (`:1028`) uses `_oh.y + _oh.HH*0.14`, same x, so same
  offset: **0px error**.
- *The ball rests motionless on a visible slope.* This is the one real artefact.
  Fix it with **one line**, and it is the highest-value line in the whole idea:
  ```js
  if(grounded) bvx += -(2*SAG*(bx-cx)/(half*half)) * GRAV * dt * 0.6;
  ```
  The ball now drifts toward the pitch centre when it stops. That single term is
  what will make people say "it's on a planet" — a rolling ball is a stronger
  gravity cue than any amount of drawn curvature.
- *Heads do not slide.* Correct and desirable — they have feet.

**Do not extend the arc to battle/lava/race.** Lava already owns an x-varying
surface (`__hmLavaY`) and the two would fight. Gate on `.hmSoccer`, per the ask.

---

## 3. The reflection

### 3.1 Constraints, re-measured

The brief cites "71 `filter: blur()` rules" site-wide. Actual current counts:
`index.html` **85** occurrences, `play-engine.js` **12**, `specimen.html` **11**,
`gradientlab.html` **4**, **`play.css` only 2** (`:27` an `.iris::after` 0.4px
highlight, `:1358` a variable `blur(var(--fb,0px))`). So the play surface itself is
nearly blur-free today and that is worth protecting. **The recommendation adds
zero blur.**

Existing shadow anatomy, for the z-order and geometry it forces:
- Head shadow: a div created at `:244–245`, `radial-gradient` ellipse, `width:HW`,
  `height:HW*0.22`, **`z-index:2`**, positioned per-frame at `shG-2` where
  `shG = floorY + HH*FOOT`, x-offset `+HW*0.06`, scaled by air height (`:1147–1151`).
- Ball shadow `z-index:1` (`play.css:51`), goal shadows `z-index:1` (`play.css:53`),
  goals `z-index:2` (`play.css`), heads `z-index:3` (`plane()`, `:392`),
  ball `z-index:48`.
- The ball shadow deliberately sits `HW*0.11−2` forward of the ball to land on the
  **same line** the head shadows use (`:1944`) — one plane, already reconciled.

### 3.2 The technique, and the three rejected ones

**Rejected — `-webkit-box-reflect`.** One property, no extra DOM, GPU-composited,
and it is exactly the wrong maths. `box-reflect` mirrors about the element's *local*
bottom edge, and the head root carries `rotate(surfRot)` in the same transform, so a
head leaning +8° gets a reflection leaning +8°. A real mirror leans **−8°**. On a
site where heads lean, wobble, flip and now tilt to a surface normal, this is wrong
in every frame that matters. It is also Blink/WebKit-only (no Firefox).

**Rejected — cloning the head root.** The head is a rig: cut-out layers, two eyes
with `::before`/`::after` iris stacks, brows, mouth, crown, HP bar. Cloning it
doubles the DOM per head and doubles the per-frame style writes for a layer that
will be drawn at ≤ 40% opacity behind a ripple.

**Rejected — SVG `feDisplacementMap` on the reflection.** The site already knows the
cost (`play.html:29` documents filters chaining and hanging the compositor). A
filtered element re-rasterises whenever its filter region changes; per-frame it is a
straight loss for an effect that a translating overlay gives for free.

**Recommended — one silhouette div per head + one shared water overlay.**

1. **`.hmRefl`, one per head, created next to the shadow at `:244`.** A single div,
   `background-image:url(data.cut)` — the identical source the face rig already
   uses at `:251` — `background-size:100% 100%`, `z-index:1`, `opacity:0`.
   Written once per frame in the same block that already writes `root` and `shadow`:

   ```js
   // mirror about the local waterline. scaleY(-1)∘rotate(θ) ≡ rotate(−θ)∘scaleY(-1),
   // so reusing the head's OWN θ in this order is exactly the mirror — no sign juggling.
   refl.style.transform =
     "translate(" + x.toFixed(1) + "px," + (waterY).toFixed(1) + "px)"
   + " scale(1,-1) rotate(" + surfRot.toFixed(1) + "deg)";
   ```
   where `waterY = floorY + HH*FOOT + arcY(cx) − 2` (the same line the shadow uses,
   so reflection and shadow share one waterline by construction — and because every
   head shares `floorY`, **all reflections land on one waterline for free**, which
   was the point of keeping option (C)).

2. **Falloff by mask, not by blur.**
   ```css
   .hmRefl{-webkit-mask-image:linear-gradient(to bottom,rgba(0,0,0,.55) 0%,rgba(0,0,0,.22) 38%,transparent 78%);
           mask-image:linear-gradient(to bottom,rgba(0,0,0,.55) 0%,rgba(0,0,0,.22) 38%,transparent 78%)}
   ```
   `-webkit-` first: Safari only shipped unprefixed `mask-image` in 15.4 — the same
   note `play.css` already carries for `.tCrowd`. A gradient mask is GPU work and,
   per the CSS-reflection literature, outperforms animating opacity.

3. **Colour, not detail.** Set `filter:none` but push the reflection toward the water
   hue with a single `background-blend-mode` or a flat tinted overlay child. Games
   do the same thing: *"fade the reflection to a single color and use a basic water
   ripple effect to mask visual issues."* Detail in a reflection is what makes it
   look like a copy rather than a reflection.

4. **The ripple lives in the water, not in the reflection.** One shared
   `.hmWater` element spanning the pitch below the waterline, `z-index:1`, appended
   *after* the head reflections in DOM order (so it paints over them), carrying a
   `repeating-linear-gradient` of thin horizontal light bands at very low alpha,
   animated with `background-position` only:
   ```css
   .hmWater{animation:hmWaterDrift 9s linear infinite}
   @keyframes hmWaterDrift{to{background-position:0 -64px}}
   ```
   `background-position` animation runs without JS and without a rAF slot. The
   reflection element itself never changes shape — it only translates — so it never
   re-rasterises.

5. **Horizontal-only wobble, if any.** If a per-head wobble is wanted beyond the
   band drift, add it as a tiny `translateX` term driven by the shared ticker's
   clock: `+ Math.sin(t*1.6 + x*0.01) * 1.4` px. **X only.** The 2D-water literature
   is explicit that constraining distortion to X is what stops reflections
   "un-attaching" from their sprites. 1.4px is enough; anything larger detaches.

6. **Static beats animated noise — and the taste contract already said so.**
   `gradient-reference-notes.md` A5: *"Static, chunky (CSS-pixel cells) … Never
   animated, never a uniform overlay."* Bake the grain into the water `.webp`. The
   *motion* comes from the band drift (compositor-only), not from noise.

### 3.3 Z-order

Target stack, bottom to top:

```
0   the gradient planet (baked .webp, one element)
1   head reflections (.hmRefl)        ← created at head spawn, earliest in DOM
1   .hmWater ripple overlay           ← appended after, so it paints over the reflections
1   ball shadow, goal shadows         ← inside camBack, appended at soccer start = latest DOM
2   head contact shadows, goals
3   heads
48  ball
```

Within one `z-index`, paint order is DOM order. Head reflections are created at head
spawn; `camBack` is created in soccer's `dom()` at match start — strictly later — so
goal shadows and the ball shadow already paint above the reflections **with no
z-index change at all**. Goals (`z:2`) and ball (`z:48`) are already above. The
brief's z-order problem resolves itself, provided `.hmRefl` is created in the head
block and not in the soccer block.

One judgement call: **keep the existing contact shadow.** A head standing on water
still needs the dark ellipse at the feet — it is what welds it to the surface, and
it also hides the seam where the reflection begins. Reflection at `z:1`, contact
shadow at `z:2`, reflection reads as *under* the shadow. Correct.

### 3.4 Reflection on a curved surface

Because option (C) gives every head the same `+arcY(cx)` offset, **the reflection
inherits the curve for free** — no extra term. The only true-mirror inaccuracy is
that a mirror about a *tilted* line should also shift the reflection laterally. At
max tilt 4.6° and a reflection 60px tall, the lateral error is
`60 × tan(4.6°) ≈ 4.8px`. Under 5px, at ≤40% opacity, behind a ripple. Ignore it.
If exactness is ever wanted, add `rotate(2·arcDeg(cx))` — one more addend, same line.

### 3.5 Does a water reflection belong on a planet at all?

Yes, and it is the cheapest way to make the planet read as a *world* rather than a
lit surface: an ocean is the single most legible planetary material. But it has to
be committed to — a "shiny floor" reflection with no water language reads as a
mistake. Recommendation: the planet's horizon band is a shallow sea; the rim light
(A4) sits on the water's far edge; the ripple bands drift *away* from the light.

---

## 4. Precedent — what makes a small planet read as a planet

**Mario Kart 8's online lobby** — the direct reference in §3.9. Miis stand on a
globe while the lobby fills. The design load is carried by *standing arrangement*,
not by ground detail: figures placed around the circumference, each rotated to its
own surface normal, so the ring of tilted characters is what states "sphere." The
same lobby in LAN/wireless mode is set in a **garage** instead — Nintendo swapping
the globe for a flat room without changing the mechanic is a useful proof that the
globe is pure staging, and therefore that it is legitimate to fake it.
([mariowiki](https://www.mariowiki.com/Mario_Kart_8_Deluxe) ·
[MiiWiki gallery](https://miiwiki.org/wiki/Mario_Kart_8/gallery))

**Super Mario Galaxy** — the source of the technique the recommendation borrows:
*"The polygon's surface normal is also used to align Mario to the curvature of the
planetoid."* That is `surfRot += arcDeg(x)`, exactly. Galaxy also proves the failure
mode: *"Due to the planet's small size, the stage has a noticeable curvature to it:
the center of gravity is the center of the planet, so jumping or getting launched
upwards from the edge will cause the character to move diagonally."* If the pitch
planet's radius is small enough to be obvious, players will expect jumps at the
wings to arc inward — and this engine's jumps are strictly vertical-plus-vx. That is
a second, independent argument for a **shallow** sag: at 4.6° max tilt nobody expects
radial gravity; at 18° they do.
([gamedeveloper.com](https://www.gamedeveloper.com/design/games-demystified-super-mario-galaxy) ·
[mariowiki: Gravity](https://www.mariowiki.com/Gravity))

**Animal Crossing** — the load-bearing precedent, and the one that validates option
(C) outright. The curved world is a **vertex displacement in a shader**: vertex `y`
is bent as a function of distance from the camera; the world's actual layout is
flat. The purpose is not realism — *"to lessen the difference between camera angles
… hiding behind the horizon some of the extra terrain you would be able to see"*.
Curvature there is a framing device, applied at render, decoupled from geometry.
Some implementations add a horizontal curve on top of the depth curve *"resulting in
an effect that resembles a sphere as opposed to a log."* The pitch is a 2D side-on
stage, so only the horizontal term applies — which is precisely `arcY(x)`.
([alastaira](https://alastaira.wordpress.com/2013/10/25/animal-crossing-curved-world-shader/) ·
[skylarbeaty/curved-world](https://github.com/skylarbeaty/curved-world) ·
[NotSlot](https://notslot.com/tutorials/2020/04/world-bending-effect))

**ACNH's horizon as a level-design element** — from the shore you can see another
island in the distance which, by the planet's curvature, is the far shore of your
own island; the planet has an implausibly small radius to produce that. The takeaway
is that the horizon *line* is where a small world is legible, not the ground
underfoot. ([Villar & McCarthy](https://medium.com/@astrovav/explaining-the-horizon-and-planet-of-animal-crossing-new-horizons-d3762f2b341f))

**Level-design composition literature** — background layers with horizon and sky
*"help bring out the dominant's silhouette, impress with the scale of the scene,
create depth"*. Silhouette is the recognition channel.
([gamedeveloper.com](https://www.gamedeveloper.com/design/composition-in-level-design) ·
[World of Level Design](https://www.worldofleveldesign.com/categories/game_environments_design/silhouette-design-game-environments.php))

### What actually makes it read as a planet (ranked, from the above)

1. **Characters rotated to the surface normal.** Mario Kart's ring of Miis; Galaxy's
   normal-aligned Mario. Ranked first because it costs one addend to `surfRot` here.
   Curvature the *characters* obey beats curvature the *ground* merely draws.
2. **A lit limb / rim on the horizon line** that escapes the silhouette upward —
   A4 in the gradient contract, and the same cue every planet render uses. This is
   what separates "planet" from "hill."
3. **Something that rolls to the low point.** Gravity you can see acting. The
   one-line ball term in §2.5.
4. **A horizon that terminates the scene** rather than running off both edges at
   uniform density — limb taper (A6).
5. **Sky above the horizon that is not the page background.** A planet needs an
   outside. Even a 40px darker band above the horizon does most of this work.

### Where it looks wrong

- **A ball the characters are standing on.** The failure mode named in the brief.
  Cause: the limb is on screen, or the sag is large enough that the arc reads as a
  closed curve (see the table — anything at R ≤ 3,000 / sag ≥ 69px). Fix: crop the
  limb off-screen, keep sag ≤ ~30px. B1 in the gradient contract says the same thing
  from the taste side: a cropped orb is UI, a centred orb is a poster.
- **Characters not obeying the curve.** Flat-standing figures on a curved ground is
  the single most obvious tell, and it is exactly what option (A) produces.
- **Symmetry.** A perfectly centred, symmetrically lit arch reads as an arch. A2/A6
  demand an off-centre light and asymmetric falloff.
- **Radial-gravity expectations at high tilt** (Galaxy, above) — another vote for shallow.
- **A reflection that is too sharp or too detailed** — it stops being a reflection
  and becomes a duplicate.

---

## 5. Performance verdict

Budget rules in force: one shared rAF ticker, `IntersectionObserver` pausing, no new
full-viewport blur, WebGL only if justified and then DPR ≤ 1.5 with
`powerPreference:'low-power'`. `play.html` already runs the whole companion engine
plus soccer.

| Item | Cost | Verdict |
|---|---|---|
| Planet surface | 1 element, 1 baked `.webp` (target ≤ 80 KB), `background-image` + `mask-image`. Zero JS, zero canvas, zero rAF. | **Free.** No new WebGL — so the §3.6 ruling ("keep the full `FluidMesh` engine exclusively on its dedicated route") is honoured. |
| `arcY` / `arcDeg` | 2 multiplies + 1 `atan2` per rendered object per frame, inside loops that already run. ~15 objects × 60fps = ~900 `atan2`/s. | **Noise.** For paranoia, cache `arcDeg` in a 64-bucket LUT over x — but it is not needed. |
| Head reflections | +1 div per head; +1 `transform` write per head per frame, inside the existing per-head block. 12 heads ⇒ 12 divs, 12 writes. The block already writes ≥2 transforms per head. | **~+15–20% of head-layer style writes**, all compositor-only properties (transform/opacity), no layout, no paint. Acceptable. |
| Water ripple overlay | 1 element, `background-position` keyframe animation. | **Compositor-only, no rAF slot, no JS.** |
| Ball centre-drift term | 1 multiply-add per frame. | Free. |
| New blur | **none** | Holds the line. `play.css` stays at its current 2 blur declarations. |
| New rAF loops | **none** — every JS term lands in the existing per-head and per-ball frames. | Holds the shared-ticker rule. |
| `IntersectionObserver` | Not required for the ripple (CSS animation, throttled by the browser when off-screen), but the planet + water should be `content-visibility`-friendly and hidden entirely when `.hmSoccer` is absent. | Cheap. |

**Mobile.** Reflections are the first thing to drop. `@media (pointer:coarse)` or a
head-count gate: reflections for ≤ 6 heads, off above that. The sag clamp already
holds mobile at 12px. `prefers-reduced-motion` kills the ripple drift and keeps a
static reflection.

**Degradation.** Every piece degrades to nothing: no `mask-image` ⇒ a hard-edged
reflection (ugly, so gate on `@supports (mask-image: linear-gradient(#000,#0000))`);
no planet image ⇒ today's pitch; arc term is additive so `SAG=0` is exactly the
current build. That last property is the real argument for (C): **`SAG=0` is a
byte-for-byte revert**, which makes it safe to ship behind a variable and tune live.

---

## 6. What I'd build first

Four passes, each independently visible, each revertible, in the order that puts the
riskiest visual judgement in front of Jayden soonest. One change per pass, Ember
baseline preserved, syntax gate after every edit.

**Pass 0 — the number, before any art (≈30 min).**
Add `SAG` and `arcY`/`arcDeg` and wire **only** the head root transform (`:1141–1143`)
and the head shadow (`:1151`). No planet drawn, no reflection. Ship it with
`SAG` on `window` so it can be typed in the console live.
*What Jayden sees:* the heads standing and hopping along an invisible swell, tilting
at the wings. *The question it answers, which is the only question that matters:*
**does 25px of sag feel like a planet or like a bug?** Everything else is downstream
of that answer, and this pass costs almost nothing to throw away.

**Pass 1 — the planet, baked (≈1–2 h, mostly in Gradient Lab).**
Dial the surface in `gradientlab.html` against the Ember baseline, obeying A1–A6:
off-centre light, tension edge on the lit flank, rim escaping the horizon upward,
static grain, limb taper. Export PNG (`:1092–1097`), convert to `.webp`, ship as one
element behind the pitch with the same `arcY` profile as pass 0. Add the darker sky
band above the horizon.
*What Jayden sees:* the actual look. This is the pass where the taste call happens.

**Pass 2 — the ball obeys gravity (≈15 min).**
The `arcY` offsets on ball, ball shadow, goals and goal shadows, plus the one-line
centre-drift term. Tiny, and it is what turns the drawn curve into a felt one.

**Pass 3 — the reflection (≈2–3 h).**
`.hmRefl` per head + the shared `.hmWater` overlay, per §3. Ship the mask falloff and
the band drift; hold the per-head X-wobble back as a separate tuning knob so it can
be dialled to zero without touching the structure.

**Explicitly not in this scope:** §3.9's lobby globe, the roulette draw, Blue Marble
processing, any change to `survey()`/`__hmFeetY`/`geo()`, and any arc outside
`.hmSoccer`.

**The kill criterion.** If pass 0 reads as a bug rather than a world, the honest
outcome is not "reduce the sag until it is invisible" — the table in §2.3 shows that
is the same as deleting the idea. It is to fall back to the planet as a *backdrop*
behind a flat line (option A proper), keep passes 1 and 3, and hand the standing-on-a-
planet idea back to §3.9's lobby where a full disc and 90° normals make it work
properly. That is a good outcome too, and it is worth naming up front so the decision
after pass 0 is a choice rather than a retreat.

---

## Sources

- [Mario Kart 8 Deluxe — Super Mario Wiki](https://www.mariowiki.com/Mario_Kart_8_Deluxe)
- [Mario Kart 8 gallery — MiiWiki](https://miiwiki.org/wiki/Mario_Kart_8/gallery)
- [Games Demystified: Super Mario Galaxy — Game Developer](https://www.gamedeveloper.com/design/games-demystified-super-mario-galaxy)
- [Gravity — Super Mario Wiki](https://www.mariowiki.com/Gravity)
- [Animal Crossing Curved World Shader — Alastair Aitchison](https://alastaira.wordpress.com/2013/10/25/animal-crossing-curved-world-shader/)
- [skylarbeaty/curved-world — GitHub](https://github.com/skylarbeaty/curved-world)
- [World Bending Effect — NotSlot](https://notslot.com/tutorials/2020/04/world-bending-effect)
- [Explaining the Horizon (and Planet) of Animal Crossing New Horizons — Villar & McCarthy](https://medium.com/@astrovav/explaining-the-horizon-and-planet-of-animal-crossing-new-horizons-d3762f2b341f)
- [Composition in Level Design — Game Developer](https://www.gamedeveloper.com/design/composition-in-level-design)
- [Silhouette Design in Game Environments — World of Level Design](https://www.worldofleveldesign.com/categories/game_environments_design/silhouette-design-game-environments.php)
- [CSS Image Reflections: A Comprehensive Guide — OpenReplay](https://blog.openreplay.com/css-image-reflections/)
- [-webkit-box-reflect — DEV Community](https://dev.to/mike-at-redspace/-webkit-box-reflect-property-creating-reflection-effects-in-css-2jah)
- [2D Water Shader Breakdown — Cyanilux](https://www.cyanilux.com/tutorials/2d-water-shader-breakdown/)
- [Water & Reflection Effects — gdquest Godot shaders](https://deepwiki.com/gdquest-demos/godot-shaders/3.1.2-water-and-reflection-effects)
- [2D Reflections, Quick & Dirty — itch.io devlog](https://jacobknispel.itch.io/flowa/devlog/261753/2d-reflections-quick-dirty)
- [Create a 3D Earth with Rotating Animation with CSS — w3bits](https://w3bits.com/css-earth/)
