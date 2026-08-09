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

## Non-goals

- Rotation, skew, cropping, freeform aspect-ratio changes, multi-select, alignment guides, dimensions, context menus, or an editor toolbar.
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
