# Time-of-day hero — design specification

**Date:** 2026-08-06  
**Status:** Approved design; implementation not started  
**Scope:** The home-page hero only

## 1. Intent

Turn the hero into a quiet, time-aware lighting scene without turning the rest of the portfolio into a theme. The effect should have the layered depth of the existing Gradient Maker rather than the generic appearance of a single CSS radial gradient. The portrait, typography, controls, outline, aura, and floor shadow must all feel lit by the same environment.

The clean token-specimen hero remains the baseline. A visitor can always choose **Off** to restore it exactly.

## 2. Experience

### 2.1 Control and menu

Add one icon-only Time button directly after Mood in the hero action row. It uses the same dimensions, border, radius, focus treatment, and material tokens as Mood. The icon reflects the resolved visual state; Automatic shows the icon for its current clock state and Off uses a crossed-circle symbol. Its accessible name is `Time of day` and its expanded state is exposed with `aria-expanded` and `aria-controls`.

The button opens a menu anchored to its edge. The menu contains:

1. **Automatic** — follows the device's local clock and is the default for every new browser session.
2. **Off** — removes the time gradient and every associated lighting/material change.
3. **Pre-dawn**
4. **Sunrise**
5. **Daytime**
6. **Dusk**
7. **Sunset**
8. **Night**

Automatic is labeled only `Automatic`; the resolved state is already communicated by the closed button's active-state icon and must not be repeated as secondary menu text. The selected row receives the design system's quiet selected material treatment and a check indicator; the closed button remains icon-only.

The menu opens on click/tap, closes on outside interaction or Escape, returns focus to the Time button on Escape, and supports arrow-key movement between rows. It opens below and right-aligned to the Time button. If its measured bottom would exceed the viewport gutter, it flips above the button; its horizontal position is clamped to the 16 px viewport gutter. It must never create horizontal overflow.

### 2.2 Automatic mapping and persistence

Automatic reads the device's local hour without requesting geolocation or network access:

| Local time | State |
|---|---|
| 04:00–05:59 | Pre-dawn |
| 06:00–08:59 | Sunrise |
| 09:00–16:59 | Daytime |
| 17:00–18:29 | Dusk |
| 18:30–20:29 | Sunset |
| 20:30–03:59 | Night |

The automatic state is recalculated when the page becomes visible and at the next state boundary while the page remains open. It deliberately follows clock time, not astronomical sunrise or sunset.

Manual choices, including Off, are stored in `sessionStorage`. They survive reloads in the same tab but do not become a permanent preference. A new browser session starts in Automatic.

## 3. Visual system

### 3.1 Layer stack

The hero is one coordinated scene, back to front:

1. Existing hero surface and token outline.
2. A hero-clipped WebGL mesh canvas.
3. A broad atmospheric bloom rising from the lower edge.
4. The existing headline and action row with state-aware material variables.
5. The portrait and its existing interactive eye/mood layers.
6. A portrait-clipped lighting pass and time-aware floor shadow.

All layers stay inside the hero's border radius. Nothing changes the page background, header, work tabs, case-study surfaces, or footer.

### 3.2 Gradient rendering

Extract the dependency-free `FluidMesh` renderer from `gradientlab.html` into a shared runtime without changing its public `new FluidMesh(canvas, cfg)` contract. Both Gradient Maker and the hero consume that runtime, preventing two shader implementations from drifting.

Each time state is a curated five-node OKLab preset using the renderer's existing Gaussian fields, layered mixing, domain warp, exposure, glow, grain, contour, and Display-P3 support. The composition originates visually below the portrait: larger nodes sit near or just beyond the bottom edge, while smaller nodes create restrained overlaps and depth above them. No state may be implemented as a single CSS radial gradient.

Presets share a calm motion vocabulary. Flow is slow enough to be perceived as living light rather than an animated wallpaper. Transitions tween the current renderer configuration to the destination configuration on a single canvas over 800 ms using the site's settle easing. Colors interpolate in OKLab; node positions, size, exposure, glow, and motion values interpolate numerically. Rapid selections retarget the active tween from its current interpolated state rather than restarting from a stale preset.

State direction:

- **Pre-dawn:** deep blue-violet base with a narrow cool lift below the jaw.
- **Sunrise:** pale blue atmosphere with peach and amber emerging from below.
- **Daytime:** airy blue and near-white layers with the lowest contrast and least color cast.
- **Dusk:** desaturated blue-violet with a restrained lavender transition.
- **Sunset:** coral, warm rose, and indigo layers; saturated near the bottom, quiet near the headline.
- **Night:** navy, cobalt, and black-blue depth with a concentrated cool bloom behind the head.

Final preset values are tuned against both desktop and mobile screenshots during implementation. They must remain original to this portfolio rather than reproduce Stripe's exact colors or geometry.

### 3.3 Whole-hero response

Each state assigns semantic hero variables for ink, primary action, secondary controls, outline, aura, portrait cast, and floor shadow. These variables modify existing components rather than introduce a parallel button system.

The primary View work button must remain unmistakable in every state. In darker states it becomes the brightest light material in the action row, while Mood and Time remain darker secondary surfaces. In lighter states it returns to the existing dark primary treatment. Contrast must remain WCAG AA for text and essential controls.

The headline may change ink color but never size, position, wrapping, or spacing. The hero outline stays the same thickness as the header outline; only its color/alpha may respond to the scene.

### 3.4 Portrait lighting

The portrait must look present in the environment, not pasted over it. Add a lighting layer that follows the alpha silhouette of the currently displayed face image, including mood-image changes and saved custom heads. The mask source updates whenever the face source changes.

The light is strongest beneath the jaw and along the lower side facing the brightest gradient node, then falls to transparent before the upper face. It uses a restrained screen/soft-light blend plus a matching silhouette drop shadow. It must preserve facial detail, hair edges, eye readability, and the existing mood animations.

- Sunrise and Sunset use a soft warm lower cast.
- Pre-dawn and Night use a cool blue edge and lower-jaw cast.
- Daytime is nearly neutral with a faint cool lift.
- Dusk uses a low-saturation violet cast.
- Off removes the cast and restores the current portrait exactly.

The effect is an art-directed lighting approximation, not relighting inferred from facial geometry. It must remain subtle enough that this limitation is not visible.

### 3.5 Off state

Off is a strict restoration state:

- WebGL canvas and atmospheric bloom are visually absent.
- Renderer animation is paused.
- Portrait lighting and time-aware floor shadow are removed.
- Headline, primary action, secondary controls, hero surface, aura, and outline return to their existing specimen values.
- Current Mood selection and head animation continue unaffected.

Off does not disable the Time control or clear the session preference.

## 4. Responsive behavior

Desktop preserves the approved hero proportions and larger head. The canvas fills the existing hero bounds and never affects layout. The menu aligns to the Time button and stays within the same page gutters as the header.

Mobile preserves the current balanced headline/action/head stack. The Time button remains a 44 px target; three action controls may wrap only as an intentional centered group, never as an orphaned single control. The menu is clamped inside the 16 px hero/page gutter. Gradient node geometry uses normalized coordinates so the composition recomposes rather than crops; a mobile-specific preset adjustment may move lower nodes inward to keep the light centered behind the portrait.

The feature must not add space between the hero and the work tabs or change the hero's measured height.

## 5. Performance, fallback, and lifecycle

- Start the renderer only after the hero exists and has measurable dimensions.
- Cap render DPR at the Gradient Maker runtime's existing limit on desktop and at 1.5 on coarse-pointer/mobile devices.
- Pause continuous rendering when the document is hidden, the hero is outside the viewport, or Off is selected.
- Resume without resetting the selected state or animation time.
- On `prefers-reduced-motion: reduce`, render one still frame per state and transition the surrounding CSS variables without mesh motion.
- If WebGL creation or context restoration fails, use a curated multi-layer static CSS fallback for the selected state. The fallback must still provide portrait cast, contrast-safe controls, Automatic, manual choices, and Off.
- Destroy listeners, timers, observers, and renderer resources through one lifecycle cleanup function.

No network request, geolocation permission, framework, or new third-party dependency is introduced.

## 6. Component boundaries

- **Shared FluidMesh runtime:** shader compilation, render loop, configuration updates, context recovery, and teardown. It knows nothing about time states or the hero.
- **Hero time controller:** menu behavior, local-time resolution, session preference, automatic boundary timer, state transitions, visibility lifecycle, and semantic hero variables.
- **Preset catalog:** immutable visual configuration for the six time states plus CSS fallback values. It contains no DOM logic.
- **Portrait lighting adapter:** tracks the active face source and updates the lighting mask. It contains no menu or time calculation logic.

The existing Mood controller remains the owner of face selection and animation. The time controller observes its output but does not call or duplicate Mood actions.

## 7. Accessibility and input

- All functionality works with mouse, touch, and keyboard.
- Time menu semantics follow the existing Mood menu patterns while adding correct focus movement.
- The icon button has a visible keyboard focus ring and a minimum 44 × 44 px touch target.
- State changes are visual preferences and are not announced through an intrusive live region.
- Forced-colors mode suppresses decorative gradient and portrait-lighting layers while preserving button, menu, selection, and outline semantics.
- Reduced motion removes continuous flow and transition choreography, not access to states.

## 8. Verification

Automated checks cover:

- Local-hour boundary resolution for all six states, including midnight.
- Automatic/manual/Off session behavior and invalid stored values.
- Menu keyboard behavior, Escape focus return, outside close, and ARIA state.
- State retargeting during an active transition.
- Off pausing rendering and restoring baseline hero variables.
- Visibility/intersection pause and resume.
- WebGL failure fallback and reduced-motion still rendering.
- Portrait mask updates when the face source changes.
- Gradient Maker still initializes and changes presets after the renderer extraction.

Browser verification covers desktop and mobile widths, light and dark states, actual touch targets, no horizontal overflow, unchanged hero/tab spacing, stable headline wrapping, primary CTA contrast, portrait detail, and smooth View work scrolling. Screenshot comparisons include Off, Sunrise, Daytime, Sunset, and Night at representative desktop and mobile viewports.

## 9. Out of scope

- Site-wide dark mode or time-based theming outside the hero.
- Geolocation or astronomical sunrise/sunset calculation.
- User-authored hero gradients or exposing Gradient Maker controls in the hero.
- Changing Mood content, animations, or icon imagery.
- Recoloring the source portrait files.
- The Play Arena Select redesign, mobile haptics, case-study gutter/radius corrections, and media outlines.
