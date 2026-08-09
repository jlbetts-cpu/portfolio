# Readable Hero Portrait Lighting Design

**Date:** 2026-08-06  
**Status:** Approved visual direction; implementation pending written-spec review

## 1. Goal

Make the Hero’s time-of-day light visibly affect Jayden’s face without making the portrait look recolored, synthetic, or detached from the photograph. The approved visual target is comparison **B: Readable directional light**.

The effect must read immediately when switching between Night and Sunset, yet remain secondary to the face itself. Off must continue to show the exact untouched portrait.

## 2. Problem

The current portrait cast is difficult to see for two reasons:

1. Active-state opacity ranges from only `0.07` to `0.135`.
2. The cast duplicates the original grayscale image and applies a zero-offset colored `drop-shadow`. Because the opaque duplicate sits over that shadow, most of the intended color is hidden. The remaining visible result is primarily a slight luminance increase.

The fix is not merely to increase opacity. The cast needs to become a real colored silhouette derived from the active portrait alpha.

## 3. Approved Visual Treatment

### 3.1 Strength and coverage

The light covers the jaw and lower cheek, then falls smoothly to transparent before the eyes. Its target mask is approximately `52% × 39%`, centered around `82%` vertically. Active opacity stays within `0.16–0.26`:

- Pre-dawn: cool, lower-left, `0.22`
- Sunrise: warm, lower-left, `0.25`
- Daytime: nearly neutral, centered, `0.16`
- Dusk: low-saturation violet-cool, lower-right, `0.20`
- Sunset: warm, lower-right, `0.26`
- Night: cool blue, lower-right, `0.24`
- Off: `0`

The stronger values apply to a solid-color lighting silhouette, not another visible copy of the photograph. This makes the cast readable at a lower opacity while preserving texture from the original portrait beneath it.

### 3.2 Direction

- Pre-dawn and Sunrise originate from the lower-left.
- Daytime is centered beneath the jaw.
- Dusk, Sunset, and Night originate from the lower-right.

The direction must be legible through asymmetric cheek and jaw coverage, not through a hard edge or spotlight circle.

### 3.3 Color

The lighting colors are derived from the approved Hero atmospheres:

- Cool: restrained periwinkle-blue near `#9AB0FF`
- Warm: peach light near `#FFB58C`
- Neutral daylight: cool white near `#EAF2FF`
- Dusk: desaturated violet near `#C8BCEB`

No state may tint the upper face, eyes, or black hair. The light color appears only where the lower-face mask and portrait alpha overlap.

## 4. Architecture

### 4.1 Preserve the source portrait

`#face` remains the sole visible identity source and receives no CSS filter. Mood, blink, uploaded-head, and animation ownership remain unchanged.

`#heroTimePortraitCast` continues to mirror the current `#face` source. Its alpha supplies the exact silhouette for every face frame, including mood and closed-eye variants.

### 4.2 Produce a true colored silhouette

Add one inline SVG filter definition inside the Hero effects markup:

1. `feFlood` supplies the active state’s lighting color.
2. `feComposite` intersects that color with `SourceAlpha`.
3. The existing radial CSS mask restricts the result to the lower face.
4. `mix-blend-mode: screen` combines the cast with the untouched portrait.

The filter outputs color plus portrait alpha only; it does not output a second grayscale copy. This removes the current hidden-drop-shadow failure mode.

The `feFlood` element receives state-specific `flood-color` rules and uses the established Hero transition duration and easing. The cast opacity and mask position transition on the same clock. A rapid state change must settle to one filter color and one opacity.

### 4.3 Responsive behavior

The cast uses percentage-based coordinates relative to the existing portrait box, so its relationship to the jaw stays consistent at desktop, 390 px, and 320 px. It adds no layout box and cannot change Hero size, spacing, overflow, or head scale.

### 4.4 Off and accessibility behavior

- Off hides the cast and restores the existing floor shadow.
- Forced-colors mode suppresses the decorative cast.
- Reduced motion writes the final state immediately without a lighting transition.
- The cast remains `aria-hidden`, non-interactive, and pointer-transparent.

## 5. State and Data Flow

1. `SiteTheme` resolves the selected or automatic time state.
2. `hero-time.js` mirrors that state to the Hero, as it does now.
3. Existing portrait-source synchronization copies the active face source into `#heroTimePortraitCast`.
4. CSS selects the state’s flood color, opacity, and mask coordinates.
5. The SVG filter creates a colored SourceAlpha silhouette; the CSS radial mask limits it to the approved lower-face region.

There is no new persistence, timer, menu state, or portrait identity state.

## 6. Verification

### 6.1 Contract tests

- The cast uses an SVG `feFlood` plus `feComposite` SourceAlpha filter.
- No filter is applied directly to `#face`.
- Each active state declares a nonzero opacity no greater than `0.26` and a directional X coordinate.
- Off declares zero opacity and hides the cast.
- The lower-face mask is broader and higher than the previous nearly invisible mask.
- No colored zero-offset `drop-shadow` remains.

### 6.2 Browser matrix

Verify every time state at 1280 × 900, 390 × 844, and 320 × 800 with:

- neutral portrait
- closed-eye/blink frame
- each Mood face source
- rapid Night → Sunset → Off → Night changes
- reduced motion

Acceptance criteria:

- Night and Sunset visibly differ on the lower face without side-by-side pixel inspection.
- Facial texture, eyes, hair, and silhouette edges remain clear.
- No rectangular image block, halo, hard mask edge, or colored hair appears.
- Off is pixel-equivalent to the original portrait treatment.
- No layout shift, overflow, console error, or broken mood animation occurs.

## 7. Scope

In scope: Hero portrait cast rendering, state variables, transition coordination, and focused tests.

Out of scope: generated portrait variants, relighting the case-study thumbnails, changing the Hero gradient, changing head scale, editing the portrait bitmap, or altering Mood animation behavior.
