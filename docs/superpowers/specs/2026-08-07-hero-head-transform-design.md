# Hero Head Transform Design

**Date:** 2026-08-07  
**Status:** Design approved; implementation plan ready
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

The wrapper writes its final transform through CSS custom properties. Selection chrome is a sibling overlay inside the wrapper, so it follows the same transform without affecting image measurements. Hero mood/movie classes remain authoritative for animation content; selection state only controls editor chrome and pointer behavior.

## Responsive behavior

- Desktop and mobile share the same component and transform model.
- Bounds are recalculated on viewport resize, orientation change, and Hero geometry changes.
- A transformed portrait is reclamped when available space shrinks.
- Mobile keeps the portrait visually large while limiting drag and resize to the lower artboard.
- Hidden touch hit areas stay within the Hero clip so they cannot intercept tabs or work content below.

## Approved entrance rhythm

The desktop entrance should reveal that selected work follows the Hero without reducing the portrait to a small decorative asset. The Hero and work collection remain separate outlined surfaces, connected by one shared structural gap.

- Desktop Hero block size uses `clamp(520px, calc(100svh - 220px), 700px)`.
- The Hero-to-work collection gap is exactly `16px` on desktop and mobile.
- At common 720–900px desktop viewport heights, the initial view exposes the complete work tab row and approximately 48–72px of the first thumbnail.
- Mobile Hero height remains content-driven; it is not forced to the desktop clamp.
- The gap between complete case-study items is `64px` on desktop and `40px` on mobile.
- The existing compact relationship between each case-study image and its own title/year metadata remains unchanged.
- The spacing values resolve through shared semantic layout tokens rather than page-local arbitrary values.

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
- Home click-to-dizzy is removed; Play can retain its own game-specific behavior.
- Outside click and Escape deselect reliably.
- Reload restores the authored composition.
- Pointer, touch, and keyboard paths work at 1440px, 390px, and 320px widths.
- At 1280×720 and 1440×900, the work tabs and a deliberate thumbnail preview are visible on initial load.
- The Hero-to-work gap computes to 16px, and consecutive case-study gaps compute to 64px desktop / 40px mobile.
- No persistent storage or page-wide layout shift is introduced.

## Non-goals

- Rotation, skew, cropping, freeform aspect-ratio changes, multi-select, alignment guides, dimensions, context menus, or an editor toolbar.
- Persisting or sharing a customized layout.
- Applying transform handles to case-study images or Play characters.
- Rewriting the portrait animation engine.
