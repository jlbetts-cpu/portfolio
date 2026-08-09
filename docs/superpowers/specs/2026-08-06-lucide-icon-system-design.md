# Lucide UI Icon System Design

**Status:** Approved for implementation  
**Date:** 2026-08-06  
**Routes:** `index.html`, `about.html`, `apollo.html`, `bearings.html`, `cluster.html`, `strata.html`, `ucdavis.html`, `play.html`, `headmaker.html`, `gradientlab.html`

## Objective

Replace the portfolio's mixed hand-authored utility SVGs with one locally hosted Lucide icon system. The result must feel quieter, more premium, and more consistent without changing control geometry, labels, interaction behavior, or page layout.

Lucide is the source for interface icons because its official set uses a shared 24-by-24 coordinate system and includes dedicated weather/time symbols such as [Sunrise](https://lucide.dev/icons/sunrise), [Sunset](https://lucide.dev/icons/sunset), [Sun](https://lucide.dev/icons/sun), and [Moon Star](https://lucide.dev/icons/moon-star). Lucide is distributed under the ISC license.

## Scope

### Convert to Lucide

- Header navigation, back, contact, and disclosure chevrons.
- Hero Time control, its seven menu choices, and the utility chevron on the Mood button.
- Case-study previous/next, back-to-top, external-link, play, close, and comparison controls.
- Play navigation, arena/menu actions, head and team controls, match actions, tournament controls, and utility buttons.
- Headmaker upload, crop/edit, undo/reset, close, confirm, download, and disclosure controls.
- Gradient Lab save, randomize, copy, confirm, download, and disclosure controls.
- Footer and other utility arrows or contact actions.

### Preserve unchanged

- The four expressive Mood pictograms: Empathy camera, Hunger cookie, Delight disco ball, and Love heart.
- The Jayden brand mark/wordmark.
- Floating heads, facial features, popcorn, glasses, game art, trophies used as illustration, decorative animation pieces, and custom cursors.
- Icons or artwork inside screenshots, videos, case-study mockups, and generated media.
- Recognizable LinkedIn and Instagram brand marks. These remain explicit non-Lucide exceptions because Lucide does not ship trademarked brand logos.

The Mood button's chevron is a utility affordance, not a Mood pictogram, so it becomes Lucide `chevron-down`.

## Chosen Architecture

Use a local static SVG sprite, not a CDN, npm dependency, or runtime replacement library.

- `ui-icons.svg` owns every approved Lucide `<symbol>` and the two preserved social-brand symbols.
- `ui-icons.css` owns the shared visual contract.
- Shipping HTML references symbols with `<use>`:

```html
<svg class="uiIcon" aria-hidden="true">
  <use href="ui-icons.svg#lucide-mail"></use>
</svg>
```

- Existing labels and `aria-label` values remain the accessible names. Decorative SVG wrappers remain `aria-hidden="true"` and cannot receive focus.
- Dynamic icons switch only the `<use href>` value or the visibility of predeclared `<use>` elements. No icon library executes at runtime.
- The sprite is same-origin and cacheable. Pages remain fully functional if icons fail to paint because every action retains its text or accessible label.

## Visual Contract

- Coordinate system: `viewBox="0 0 24 24"`.
- Fill: `none` for Lucide utility icons.
- Stroke: `currentColor`.
- Stroke width: `1.75` design units.
- Line cap and join: `round`.
- Vector behavior: `vector-effect: non-scaling-stroke` where browser support is reliable.
- Navigation size: `16px`.
- Standard control size: `18px`.
- Primary-action size: `20px`.
- Icons inherit the existing semantic ink, hover, focus, disabled, and Night-theme colors. They do not introduce independent color tokens.
- Replacing an SVG must not change the control's width, height, padding, radius, gap, hit target, or baseline.
- Filled social-brand marks may keep their recognizable fill treatment but must use `currentColor` and the same optical box as neighboring Lucide icons.

## Canonical Mapping

### Global navigation

| Meaning | Symbol |
|---|---|
| Work | `briefcase-business` |
| About | `user-round` |
| Play | `gamepad-2` |
| Contact / Email | `mail` |
| Back | `arrow-left` |
| Open disclosure | `chevron-down` |
| LinkedIn | preserved brand symbol |
| Instagram | preserved brand symbol |

### Time of day

| State | Symbol |
|---|---|
| Automatic | `clock-3` |
| Off | `circle-off` |
| Pre-dawn | `cloud-moon` |
| Sunrise | `sunrise` |
| Daytime | `sun` |
| Dusk | `sun-dim` |
| Sunset | `sunset` |
| Night | `moon-star` |

The closed Time button displays the resolved active-state icon. Automatic remains identifiable inside the menu with `clock-3` and is labeled only `Automatic`; it does not repeat the resolved state as secondary text.

### Repeated actions

| Meaning | Symbol |
|---|---|
| Previous / next | `chevron-left` / `chevron-right` |
| Back to top / upward view cue | `arrow-up` |
| External destination | `arrow-up-right` |
| Add a head/person | `user-round-plus` |
| Play media or match | `play` / `circle-play` according to existing container |
| Close / remove | `x` |
| Confirm / copied | `check` |
| Undo / reset | `undo-2` / `rotate-ccw` according to meaning |
| Save preset | `bookmark` |
| Randomize | `shuffle` |
| Copy | `copy` |
| Upload image | `image-up` |
| Download | `download` |
| End game | `square` |
| Tournament | `trophy` for entry; existing bracket visualization remains authored UI |

If two controls currently use the same drawing for different meanings, the mapping follows the action's label rather than preserving that accidental duplication.

## Interaction and Motion

- Existing hover, active, focus, disclosure rotation, and press animations remain intact.
- Chevrons rotate only where the current component already communicates open/closed state through rotation.
- Icon replacement must not add independent bouncing, morphing, drawing, or glow effects.
- `prefers-reduced-motion` behavior remains unchanged.
- Icons must remain crisp in Off and Night themes and in forced-colors mode.

## Accessibility

- Labeled buttons and links keep their existing accessible names.
- Icon-only controls require a non-empty `aria-label` or equivalent visible label.
- Decorative SVGs use `aria-hidden="true"`, `focusable="false"`, and no `<title>` that could duplicate the control name.
- State is communicated by text and ARIA (`aria-expanded`, `aria-checked`, `aria-current`, or `aria-pressed`), never by icon shape alone.
- Focus outlines remain on the control, not the SVG.

## Verification

- A static contract inventories every shipping interface SVG and rejects non-Lucide utility path data outside the explicit Mood, brand, art, cursor, and authored-media exceptions.
- The contract verifies that all `<use>` targets exist exactly once in `ui-icons.svg`.
- Browser checks cover all ten routes at desktop, 390-by-844, and 320-by-800 in Off and Night themes.
- Checks confirm no missing icons, broken external `<use>` references, baseline jumps, layout shifts, horizontal overflow, duplicate accessible names, or console errors.
- Component-state checks cover header menus, Time menu, Mood chevron, case-study players, Play modes, Headmaker flows, and Gradient Lab copy/download feedback.
- Existing Hero, site-theme, Play, Headmaker, FluidMesh, thumbnail, token, syntax, and HTML contracts remain green.

## Rollout Boundaries

Implementation should proceed in independently reviewable groups: shared sprite/contract, global header/footer and Time controls, portfolio/case-study controls, Play controls, and creative-tool controls. Each group must preserve geometry and pass its route matrix before the next group begins.
