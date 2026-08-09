# Hero specimen frame refinement

**Date:** 2026-08-05  
**Status:** Approved for implementation  
**Selected direction:** A, Specimen frame

## Objective

Refine the home-page hero into a strict specimen frame that belongs to the existing portfolio design system. The header and hero should read as a matched pair, the interactive head should remain the focal object, and the two primary hero actions should make the next step and the head interaction immediately understandable.

## Visual direction

The hero sits directly below the existing site header with one small tokenized gap. Both surfaces use the same hairline width and neutral boundary color, the same paper material, and the same squircle-based corner language. The hero remains a separate, larger frame rather than merging with the header.

The composition is centered and ordered as follows:

1. Two-line role and focus headline.
2. A compact action row containing `View work` and `Mood`.
3. The interactive head, centered within the remaining field.

The head remains the signature element. No additional decoration competes with it.

## Token usage

Existing design-system tokens remain authoritative for typography, ink, paper, boundaries, spacing, radii, materials, shadows, focus states, and motion. The implementation must not rebind `--accent`, because interactive emphasis remains monochrome across the site.

The pale-blue background is environmental content, not an interaction color. It is localized to the home hero and receives dedicated semantic tokens for its core, middle, and fade values. These tokens are consumed only by the hero-atmosphere layer.

The atmosphere is a soft radial or elliptical field centered behind the head. It fades fully into the paper before reaching the hero boundary so the matched outline stays crisp. It must not reduce the legibility of the headline, controls, or head.

## Hero shell and layout

The hero shell aligns to the same content edges as the header. Its outline uses the exact boundary width and neutral color used by the header rather than a visually similar literal. The hero keeps the system's large squircle radius appropriate to its scale.

The shell fills the first-screen composition without hiding the beginning of the work section on common laptop and mobile viewports. Its height may use viewport-aware sizing, but it must retain a practical minimum height so the head is not compressed on short screens.

The existing hero intro and head engine stay intact. Layout changes must preserve the DOM hooks and animation dependencies used by `hero-engine.js`, including `#h1`, `.heroCtas`, `.stagewrap`, `#stage`, and `#face`.

## Headline

The headline remains:

> SF product designer. iOS, B2C and design systems.

It is centered, set in the existing 600-weight Instrument Sans role, and balanced into two lines on standard desktop widths. Mobile may rebalance naturally without inserting brittle hard breaks that create awkward wrapping at intermediate widths.

## Actions

### View work

`View work` is the primary action and uses the site's ink-filled control treatment: near-black ground, paper text, system control radius, tokenized padding, and existing press and focus behavior. A small directional icon may reinforce the downward navigation.

It targets `#cases`. Normal anchor behavior remains available without JavaScript. When enhanced scrolling runs, it respects `prefers-reduced-motion` and the existing sticky-header scroll padding.

### Mood

`Mood` is a secondary disclosure control using the paper material, neutral boundary, system radius, and strong ink. It includes a restrained mood icon and a disclosure indicator. It exposes only the four actions that change the home-page head:

- Empathy
- Hunger
- Delight
- Love

The existing `.moodItem` elements and their `data-mood` values move into the hero disclosure rather than being recreated. `hero-engine.js` remains the single owner of mood dispatch.

The existing mood presentation is preserved exactly at the content level: the shipped icon artwork, icon animation, label, order, and effect pairing for Empathy, Hunger, Delight, and Love all remain unchanged. Generic replacement glyphs or newly drawn icons are not permitted. Only the surrounding disclosure trigger, panel placement, and any container-level token styling needed to integrate the menu into the hero may change.

The menu uses the existing material, rim, shadow, row, and motion vocabulary. It opens below the control when space permits, remains inside the viewport, and may reverse direction on constrained screens. It closes after selection, on Escape, and on outside interaction. Focus returns to the trigger when Escape dismisses it.

## Header and Play behavior

On the home page, Play becomes a direct navigation item linking to `play.html`; it no longer owns a hover disclosure.

The four mood actions leave the Play hover panel because they act on the home-page head. Head-management actions remain available on the Play page, where their subject and destination are clear. The change must not remove or break the Play page's own saved-head and head-management behavior.

The remaining header destinations, active state, responsive behavior, and Contact disclosure stay unchanged.

## Responsive behavior

Desktop and tablet retain the centered specimen composition. The headline and controls occupy the top portion of the hero, while the head scales into the remaining space without colliding with either.

Desktop and mobile are treated as two deliberately composed states rather than one layout merely scaled up or down. Each state uses the existing spacing ladder to establish a clear rhythm from header to hero shell, shell to headline, headline to actions, and actions to head. Intermediate widths and short landscape-like viewports must interpolate cleanly without introducing empty bands, abrupt jumps, or optical imbalance.

On mobile:

- The matched header and hero outlines remain visible.
- Both controls meet the existing minimum touch-target token.
- The actions may wrap only when required by the viewport.
- The menu width is constrained to the viewport gutter and never covers essential face features.
- The head keeps a useful scale and remains horizontally centered.
- The beginning of the work section remains discoverable through ordinary scrolling.
- Vertical spacing remains optically balanced even when the headline wraps differently or the browser chrome reduces the available viewport height.

## Accessibility

- `View work` is a real anchor to `#cases`.
- `Mood` is a real button with `aria-haspopup="menu"`, `aria-expanded`, and `aria-controls`.
- The mood surface has an accessible label, and its actions remain keyboard reachable.
- Visible keyboard focus uses the existing tokenized focus ring.
- Escape and outside dismissal behave consistently with the current header disclosures.
- Reduced-motion preferences remove nonessential animated scrolling and menu motion without disabling functionality.
- The blue atmosphere is decorative and absent from the accessibility tree.

## Implementation boundaries

Expected files:

- `index.html`: home-page hero markup and local hero styling.
- `header.js` or the smallest appropriate home-page script block: disclosure state if the current shared disclosure helper cannot own the moved menu safely.
- `hero-engine.js`: only targeted selector or ownership adjustments required to preserve existing mood dispatch; no redesign of the head engine.
- `header.css`: only changes required to make the home Play item a direct link and remove home-only dropdown styling. Shared behavior on other pages must remain intact.

No case-study layouts, Play game behavior, head-maker behavior, or unrelated tokens are in scope.

## Verification and acceptance criteria

The implementation is complete when:

1. Header and hero use the same boundary token and align to the same horizontal edges.
2. The approved centered composition matches the high-fidelity Direction A preview.
3. The blue field is subtle, localized behind the head, and absent from interactive states.
4. `View work` reaches the selected-work section with and without JavaScript.
5. Mood opens from the hero and all four existing mood effects still run.
   The existing mood icons and their icon animations match the pre-change menu rather than being replaced or simplified.
6. Play is a direct link on the home page and no longer opens the former mixed-purpose panel.
7. Head-management behavior remains available and functional on the Play page.
8. The hero intro, face tracking, blinking, and other existing head interactions still work.
9. Keyboard focus, Escape, outside dismissal, and reduced-motion behavior pass manual checks.
10. The layout is visually checked at 1440×900 and 1280×800 desktop sizes, a short 1280×720 laptop size, 768px tablet width, and 390×844 and 360×800 mobile sizes.
11. HTML, CSS, and JavaScript checks complete without new errors.
12. No checked viewport contains accidental excess whitespace, clipped controls, menu overflow, face obstruction, uneven shell gutters, or a spacing jump at a responsive breakpoint.
