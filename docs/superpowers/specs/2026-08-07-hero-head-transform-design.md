# Hero Head Transform Design

**Date:** 2026-08-07  
**Status:** Implemented and verified
**Scope:** Home Hero animated portrait only

## Intent

Turn the animated Jayden portrait into a quiet, portfolio-relevant design-tool interaction without making the resting recruiter-facing Hero look like an editor. The interaction should feel like selecting an object in Figma: precise, minimal, reversible, and subordinate to the portfolio content.

## Approved experience

The resting Hero remains completely clean. Selecting the animated head reveals a 1px blue selection frame with four small square corner handles. Dragging inside the frame moves the portrait only within the protected lower Hero region. Dragging a corner resizes the portrait proportionally from the opposite corner.

The frame transforms the portrait's outer stage only. It never changes the face engine's internal coordinate system, so gaze, blink, case-study smile, and Extras popcorn/glasses behavior remain intact. The existing Home click-to-dizzy action is removed to avoid competing with selection.

Escape or clicking outside the selection deselects it. Reloading the page restores the polished default position and size. The interaction is intentionally session-local and is not written to storage.

## Visual design

- Selection outline: 1px system blue, no fill, shadow, label, dimensions, toolbar, or rotation handle.
- Handles: four small square corner handles with a white center and blue 1px edge.
- Handle geometry is visually compact on both desktop and mobile.
- Each handle receives an invisible 44px minimum touch target without enlarging its visible square.
- The selection frame is absent from screenshots and the resting composition until the portrait is selected.
- Selection chrome uses dedicated semantic tokens so its color, thickness, and handle size are not recreated ad hoc.

## Interaction model

### Selection

- Pointer or touch activation on the portrait selects it.
- Selection does not restart, pause, or replace the portrait animation engine.
- Clicking or tapping outside the selected portrait deselects it.
- Escape deselects it and returns keyboard focus to the portrait control.

### Move

- A drag beginning inside the selected frame, excluding handles, moves the outer portrait stage.
- Movement is constrained to a protected lower-Hero artboard. The portrait cannot enter the headline, CTA, or time-control region.
- Bounds are computed from the live Hero and protected-content rectangles rather than fixed viewport coordinates.
- Pointer capture owns the gesture through completion, including when the pointer leaves the frame.

### Resize

- Dragging any corner handle resizes proportionally from the opposite corner.
- The portrait's original aspect ratio remains fixed.
- A shared minimum and maximum scale protects legibility, animation quality, and the Hero composition.
- Resize and movement are clamped together, so no resize can push the portrait outside the lower artboard.
- The interaction updates with `requestAnimationFrame` and a single outer transform to avoid layout thrashing.

### Reset

- Reloading restores the authored default size and position.
- No position or scale is written to local storage, a cookie, a URL, or the global day-cycle state.

## Architecture

The existing animated stage remains the rendering source of truth. A new transform wrapper owns only the user-controlled translation and scale. The face engine continues to render against its existing internal dimensions and local coordinates inside that wrapper.

State is minimal:

- `selected`
- `pointerId`
- active operation: `move` or one of four resize corners
- authored default transform
- current translation and scale
- current lower-artboard bounds

The wrapper writes its final transform through CSS custom properties. Selection chrome is a Hero-relative sibling immediately after the wrapper: it remeasures the visible transformed portrait each frame, so the blue line stays 1px, handles stay 8px, and touch targets stay 44px instead of scaling with the portrait. Hero mood/movie classes remain authoritative for animation content; selection state only controls editor chrome and pointer behavior.

## Responsive behavior

- Desktop and mobile share the same component and transform model.
- Bounds are recalculated on viewport resize, orientation change, and Hero geometry changes.
- A transformed portrait is reclamped when available space shrinks.
- Mobile keeps the portrait visually large while limiting drag and resize to the lower artboard.
- Hidden touch hit areas stay within the Hero clip so they cannot intercept tabs or work content below.

## Approved entrance rhythm

The desktop entrance preserves the original full-scale Hero composition. The Hero and work collection remain separate surfaces, connected by one shared structural gap.

- Desktop Hero block size remains the authored `calc(100svh - 88px)`.
- The Hero-to-work collection gap is exactly `16px` on desktop and mobile.
- Selected work is allowed to begin below the initial desktop viewport; the Hero is not shortened to manufacture a thumbnail preview.
- Mobile uses an intentional responsive Hero height of `clamp(600px, calc(100svh - 160px), 680px)` so the headline, controls, and large lower-edge portrait remain balanced at both 390px and 320px without borrowing the desktop viewport rule.
- The gap between complete case-study items is `64px` on desktop and `40px` on mobile.
- The existing compact relationship between each case-study image and its own title/year metadata remains unchanged.
- The spacing values resolve through shared semantic layout tokens rather than page-local arbitrary values.

## Approved Hero edge treatment

- The Hero has no visible outline, rim, border, or shadow in any time state.
- The top of every time-of-day gradient resolves to the exact shared `--theme-page` color, not a visually similar hard-coded tint.
- Light-state atmosphere remains concentrated lower in the Hero; its upper field becomes indistinguishable from the surrounding page.
- Night begins with the exact dark `--theme-page` color before developing its blue-black atmosphere and stars lower in the Hero.
- The approved lower gradient colors and radial shape remain intact; this change only removes the upper-edge hue seam.

## Accessibility and input

- The portrait becomes a focusable control with a concise accessible name describing selection.
- Selection state is exposed with `aria-pressed` or an equivalent supported state.
- Escape deselects.
- Arrow keys move a selected portrait in small steps; Shift+Arrow uses a larger step.
- Keyboard resize is exposed through the corner handles with descriptive accessible labels and arrow-key adjustment.
- Reduced-motion mode preserves direct manipulation but removes decorative selection transitions.
- Focus indication and selection indication remain distinct.

## Failure handling

- `pointercancel`, lost pointer capture, window blur, or visibility loss ends the active gesture without leaving a stuck drag state.
- If the Hero becomes temporarily unmeasurable, the component retains the authored default rather than producing invalid transforms.
- Mood and Extras transitions can change portrait art during a gesture without resetting the wrapper transform.

## Acceptance criteria

- The resting Hero has no visible editor chrome.
- Selecting the actual animated portrait reveals one precise 1px frame and exactly four corner handles.
- Move and resize never overlap the protected headline/CTA region or escape the Hero.
- Resize is proportional from the opposite corner at every supported viewport.
- Gaze, blink, case-study smile, and popcorn/glasses animations remain visually aligned after moving and resizing.
- During the complete Extras lift and performance transition, the visible portrait and selection frame remain below the protected copy gap without changing the authored x/y/scale transform state; only the peek element's own transform transition can start or stop projection tracking.
- Home click-to-dizzy is removed; Play can retain its own game-specific behavior.
- Outside click and Escape deselect reliably.
- Reload restores the authored composition.
- Pointer, touch, and keyboard paths work at 1440px, 390px, and 320px widths.
- At 1280×720 and 1440×900, the Hero computes to `calc(100svh - 88px)` without responsive shrinkage.
- The Hero-to-work gap computes to 16px, and consecutive case-study gaps compute to 64px desktop / 40px mobile.
- Pixel sampling at the Hero top center and top corners matches the surrounding page background in every time state.
- The Hero computes to `box-shadow: none` in every time state.

## Connected work collection

The work collection is one calm system rather than a tab bar, a square image, and oversized detached metadata. Its media spans the collection width but retains the shared media radius and one inset rim: `20px` on desktop and `14px` on mobile. The project label immediately follows the image at one shared gap (`16px` desktop, `12px` mobile); the name uses the shared lead scale and the year uses the 15px metadata scale. No nested card, extra panel, or second boundary is introduced.
- No persistent storage or page-wide layout shift is introduced.

## The resting pose is rotated, and the frame is permanent

Two changes to the approved experience, both Jayden's.

### Rest is -13.8deg

Every other resting value is **layout** — `--hero-peek-width`,
`--hero-peek-shift-x`, `--hero-peek-depth` — deliberately, so `reset()` returns
exactly home and the entrance lands on it without the clamp treating rest as
"already moved". A rotation has nowhere to live but the transform, so
`--hero-head-rest-rotate` is the one resting value the transform owns:

- `reset()` returns to it, not to `0deg`.
- The entrance **arrives turning**. `--hero-head-enter-rot` starts
  `--hero-head-enter-spin` closer to level and resolves to `0`, so the arrival
  is one motion — rise, turn, settle — and because `--sp-bounce` overshoots, the
  head goes a degree past the tilt before settling on it. Both entrance channels
  are *offsets* that resolve to zero, so the arrival cannot land anywhere but
  rest whatever rest is retuned to.
- The float composes on top: the head oscillates around `-13.8deg`.
- The stylesheet gives `#heroHeadTransform` the rest angle too, so the first
  paint is already tilted before any script runs, and the measurement helpers —
  which neutralise the inline value by *removing* it — fall back to rest rather
  than to level.

**A rotated box is wider than the head it holds**, by about 20% on each axis at
this angle, so the reachability clamp has to be legal against the *turned* box.
The contract asserts that, and asserts that the box it measured really was
turned — a level box would pass the same test for free.

**Everything that measures the head has to measure it level.**
`getBoundingClientRect()` on a rotated element returns the turned bounding box,
and slicing head-bounds fractions out of that is not the head. Every angle the
wrapper carries is lifted for one read and put straight back. The neutralising
write must be `!important`: `--hero-head-enter-rot` is keyframed, and an
animation outranks an inline style — a plain `0deg` is silently ignored for the
whole arrival, and the base rectangle everything downstream trusts gets captured
mid-flight.

### The frame never goes away

> *"Honestly I think the resize box should stay on — like it kinda adds to the
> structure and gives that design look."*

The click-outside dismissal is **removed**, not defaulted off. The frame is not
a selection state a visitor discovers; it is the composition. Dismissing it on
the first click anywhere destroys the idea within seconds of arrival.

`Escape` remains, as the single deliberate way out. The click is still not
swallowed — with the chrome on screen for the whole visit, that guarantee
matters more, not less.

**What makes a permanent frame read as design rather than as a rendering bug is
that the head moves.** Static artwork inside a selection box looks broken;
drifting artwork inside one looks like a tool. The float is load-bearing twice
over now.

That was nearly lost by a cascade accident: `controls.css` links **after**
`hero-time.css` and declares its own `.heroHeadTransform{transform:...}`, so the
rule that composed the float and the entrance into the transform read perfectly
and lost. Measured live: `--hero-head-float-y` ran `-0.4 -> -9.6px` while the
painted matrix's `ty` stayed pinned at `0`. The selection chrome is positioned
from JS and floated on schedule, so **the box drifted ~10px off a head that
never moved** — which is what "the resize box doesn't function cleanly" actually
was. An ID selector is the fix, and the third time this file has been bitten by
the same thing.

### The frame contains the artwork, and the artwork is a cut-out with hair

> *"The resize box is another one that needs optimization -- sometimes the head
> peaks out of it. It should always be on the outside of the face."*

`data-head-bounds` is where the head sits inside its own image, and the frame
traces it exactly. It traced a rectangle around the **face**: `0.22 0.12 0.80
0.91`. The artwork is a photographic cut-out, and the difference between a face
and a cut-out is **hair**. Read back off the alpha channel of all nine images
`#face` can wear, the real extents are `0.1933 0.0617 0.8483 0.9233` — the top
edge alone was 5.8% of the image short, because `wink.webp` carries the tallest
hair of the nine and is reachable from an idle fidget and from the logo hover.
That is 5.70px of head outside its own frame at the resting 235px, and 58.31px
outside it at 2.2x. "Sometimes" was always, by the hair, and further on some
moods than others.

**The union of all nine, not the current face.** A frame that re-hugged whichever
face is showing would resize itself every time he blinks — the exact breathing
the rigid-body rewrite exists to stop — and would let the next mood step outside
it. One rectangle that bounds every face the head can wear is the object's
bounds, and that is what a design tool frames.

**Rotation was not the fault.** The head and its frame go through one matrix
about one origin, so containment is an invariant of the local space: measured at
`-13.8deg` and at `45deg`, at `0.24`, `1` and the token maximum, the clearance is
the authored `--selection-air` on every edge and does not vary with the angle at
all. What *is* cropped at an angle is the frame's own **line**, where the box
meets the edge of the stage — and the head is cropped at exactly the same line,
so the two agree.

**The number is measured, not authored.** The contract reads the alpha channels
back out of `images/`, with the file list parsed from `hero-engine`'s own `FACES`
table so a tenth face cannot be forgotten, and fails if the attribute is tighter
than the pixels (the head escapes) or looser than the fourth decimal it is
written to (a pad that reads right at one size is wrong at the other end of a 9x
range). Six browser samples per viewport assert the painted rectangle contains
the turned artwork and hugs it to within the ring of air.

## The handles: the dot you aimed at wins

Five 44px targets do not fit on a 136px head without overlapping, and the head
is now smaller, rotated and floating — all three move where the dots sit.

- **Paint order used to decide overlaps.** `.heroHeadHandle` sits above
  `.heroHeadRotate`, a rule written for a degenerate box collapsed against a
  viewport edge. As a general rule it decides by z-index, which has nothing to
  do with what the visitor pointed at: measured at 390, at the resting
  composition, the rotate dot sat 24px from the nw dot and entirely inside its
  target, so **the rotate handle was dead on every phone**. The nearest *drawn
  dot* now takes the press, measured Chebyshev because a 44px target promises a
  square.
- **A press near no dot is a press on the head.** The hit boxes are clamped to
  stay inside the selection, so on a small frame they migrate inward over the
  artwork — at 320 with the head scaled down, grabbing the face to move it
  started a rotation. A 44px target is a promise about the dot, not a licence to
  own the middle of the object.
- **A target that hangs off the viewport is not a target.** The hit box used to
  fall back to the selection box's centre when the box was narrower than 44px;
  at 320 the visible box measures ~27px and a third of the target ended up
  off-screen. It is clamped into the region a pointer can actually reach — the
  Hero, minus the opaque bar across its top — and only then into the box.

Measured at the new resting pose, aiming at the drawn dot: **100%** of four
corners plus rotate, at 1440 and at 390, at rest and dragged into the corner
under the floating nav.

Re-measured after the bounds were corrected, which moved every dot outward: the
drawn dot still starts the gesture it advertises **5/5 at 1440 and 5/5 at 390**,
with real input. The `elementFromPoint` owner of that dot is a different
question and has a different answer: at 390 the rotate dot sits **25–26px** from
the `nw` dot against 44px targets, so the pixel under it belongs to `nw` — which
is precisely the collision the nearest-drawn-dot arbitration exists to resolve,
and the reason it must never go back to paint order. At 1440 the nearest pair is
**79px** and nothing overlaps at all.

**Do five dots crowd a 235px head?** Measured: the painted dots are 8px (rotate
10px) against a head 156.7px wide, so **5.1%** of its width and **0.94%** of the
frame's area at 1440; **5.8%** and **1.17%** at 390. On a 520px head those same
dots were 2.3% and the numbers have roughly doubled, but they are still marks
rather than furniture, and the resting screenshot reads as a tool, not as
clutter. What genuinely got tight is the part nobody can see: the five 44px
targets cover **25.6%** of the frame's area at 1440 and **31.7%** at 390. So the
conclusion is not to shrink or drop a handle — the composition is fine and the
handles are the structure Jayden kept the frame for — it is that the arbitration
is now load-bearing rather than a nicety.

## Non-goals

- Skew, cropping, freeform aspect-ratio changes, multi-select, alignment guides, dimensions, context menus, or an editor toolbar. (Rotation was a non-goal in the first pass and is now part of the resting composition; see above.)
- Persisting or sharing a customized layout.
- Applying transform handles to case-study images or Play characters.
- Rewriting the portrait animation engine.

## Verification

Implementation was closed in four reviewed stages:

- Task 2 selection/move: `e6d4295`, with interaction corrections in `13f9784`.
- Task 3 proportional resize, keyboard input, and animation synchronization: `986566d`, with scoped quality corrections in `67d695f`.
- Task 4 responsive regression closure: this verification commit; its immutable hash is recorded in the Task 4 report immediately after commit.

Task 4 covers 1440×900, 1280×720, 1280×650, 761×844, 760×844, 390×844, and 320×800. The 760px boundary keeps exact mobile height, line, control, overflow, seam, and transform-safety checks while the portrait ratio/crop/copy-gap composition remains scoped to the authored 390px and 320px phone layouts; enforcing those three phone proportions simultaneously at 760px is geometrically contradictory.

Verified commands:

```bash
python3 -m py_compile \
  tools/hero-entrance-rhythm-contract.py \
  tools/hero-head-transform-contract.py \
  tools/shared-surfaces-contract.py \
  tools/shared-surfaces-browser.py \
  tools/hero-popcorn-browser.py
node --check hero-head-transform.js
node --check hero-engine.js
python3 tools/hero-entrance-rhythm-contract.py
python3 tools/hero-head-transform-contract.py
python3 tools/shared-controls-contract.py
python3 tools/shared-controls-browser.py
python3 tools/shared-surfaces-contract.py
python3 tools/shared-surfaces-browser.py
python3 tools/hero-popcorn-browser.py
python3 tools/hero-specimen-check.py
python3 tools/token-audit.py
git diff --check
```
