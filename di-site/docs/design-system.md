# Developmental Improvisation — design system

For anyone building the next page (Gallery, Contact, About). Every rule has a reason. If you cannot say what an element is *for*, delete it. The live version of every component is `styleguide.html`; the tokens are `css/tokens.css`, the only file allowed to contain raw values.

## 1. Principles
1. **Premium is subtraction.** When a screen feels wrong, remove something before adding something. Nothing is on the page that the page could do without.
2. **Counting is not looking.** Measure, then open the screenshot. Every gate in `tools/gates/` exists because a number once lied.
3. **Two faces, no italics, no gradient text.** Sen — 800 for the display, 700 for titles — and Plus Jakarta Sans 400 and 600 for everything else. They share a geometry, so the pairing reads as one voice. Hierarchy is face, size, leading, tracking and ink tier.
4. **Two themes, one palette.** Light is the default; dark is the visitor's choice, kept in `localStorage` and read before first paint. The hues do not change between them; the ground and the ink swap and the tint deepens.
5. **Colour is flat.** It appears in exactly three places: the photographs, a tinted card, and the footer module. There are no gradients anywhere on the site (Jayden, 2026-09-05: "I dont think the gradient experiment works the clean colored cards looked a lot better"). No coloured text.
6. **No shadows.** Depth is a tinted or raised card on the ground plus a hairline.
7. **Photographs are the only pictures.** No illustrations, no decorative vectors, no stars. Four shapes hold the photographs and that is the whole vocabulary.
8. **Motion is a system with two kinds.** Things that happen take a rung of the ladder. Things that turn or stack follow the scroll through one shared value, the flow, and have no duration.
9. **Copy is verbatim from the old site.** Placeholders carry `data-placeholder="true"`.
10. **44px targets, measured.** The `targets` gate prints the smallest. The headline's inline photographs are sized `clamp(44px, 5.1vw, 74px)` for exactly this reason.
11. **Every interruption is polite.** The newsletter dialog waits for both 40% scroll and ten seconds, once per session, thirty days after a dismissal.

## 2. Colour
Two themes in `css/tokens.css`. The light ground is a warm off-white, not a yellow cream: hue ≈ 80°, lightness .97, chroma near zero. The dark ground is the same hue at lightness .07. Ink is a warm black, or a warm off-white in dark.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #F7F5F0 | #131211 | the ground |
| `--bg-raised` | #FFFFFF | #1C1A18 | cards, and the base a tint mixes into |
| `--bg-sunken` | #EFECE5 | #0E0D0C | wells, empty photo frames |
| `--bg-overlay` | #FFFFFF | #1C1A18 | the sheet, the dialog, inputs |
| `--ink` / `--ink-2` / `--ink-3` | #1B1916 / #514C45 / #736D64 | #F4F1EB / 74% / 58% | headings and the mark / body / captions |
| `--line` / `--line-strong` | ink 10% / 22% | off-white 12% / 24% | hairlines |
| `--glass` | ground at 82% | ground at 82% | the header once scrolled |

**Colour is flat.** The seven hues inside the logo appear as **tints**: `color-mix(in oklab, var(--accent) var(--tint-mix), var(--bg-raised))`, where `--tint-mix` is 22% in light and 30% in dark — a hue needs more of itself over the dark ground to read as the same colour. The mix happens on the element that carries `data-accent`; mixing it at `:root` resolves once and every card comes out the same colour (that bug shipped once, in the chips).

| Hue | Value |
|---|---|
| green | #51E596 |
| sky | #58CDFC |
| violet | #7358FC |
| magenta | #E744E2 |
| orange | #F0895B |
| pink | #FB9BC9 |
| yellow | #FEE79B |

**Accents.** A section or a card sets `data-accent="…"` once. Down the home page: sky → green → yellow → violet (the four stacked cards) → sky, yellow, pink (the testimonials) → orange (the newsletter) → violet (the footer module). Never two adjacent surfaces the same. The `contrast` gate walks every visible text node in **both themes** and requires 4.5:1 (3:1 at ≥ 24px) against its effective background, which is what covers the tints; `--self-test` paints the ink onto the ground and must fail.

## 3. Type
Sen and Plus Jakarta Sans, self-hosted latin subsets, `font-display: swap` with a size-adjusted fallback so the swap does not move layout. Sen ships as **one variable file, 18KB for every weight from 400 to 800**. Jakarta was chosen from eight faces for the tallest x-height among the warm geometrics (0.536 em); Sen answers it with the same circular bowls and a flatter terminal, which is why the pair reads as one family rather than two.

| Role | Size (390 → 1440) | Leading | Tracking | Face | Colour |
|---|---|---|---|---|---|
| display | 38 → 80 (32 below 360) | 1.16 (1.42 on a phone) | −0.035em | Sen 800 | ink |
| h1 | 36 → 60 | 1.06 | −0.03em | Sen 800 | ink |
| h2 | 30 → 46 | 1.12 | −0.025em | Sen 700 | ink |
| h3 | 22 → 26 | 1.2 | −0.02em | Sen 700 | ink |
| lead | 18 → 21 | 1.45 | −0.005em | Jakarta 400 | ink-2 |
| body | 16 → 17 | 1.6 | 0 | Jakarta 400 | ink-2 (first paragraph ink) |
| label | 14 | 1 | +0.04em, uppercase | Jakarta 600 | ink-3 |
| caption | 13 | 1.4 | +0.01em | Jakarta 400 | ink-3 |

Measures are in `em`: display 12.25em (four lines at 1024 and up), sub 24em, h2 13em, body 34em; the quote inside the ring 1.1 × the ring's radius. **Never `ch`** — Jakarta's zero is 0.685em wide, so `24ch` at 48px is 825px and the hero tagline once wrapped into the side cards because of it.

The display's leading is set on the hero, not in the tokens, because it has to hold an inline photograph: the shape is 0.68em above the baseline and 0.18em below, which fits inside 1.16 leading. On a phone the 44px tap floor is 1.16em of the type, so the leading opens to 1.42 and the lines stay evenly spaced.

## 4. Space, grid, radius, lines
4px grid: `--sp-1` 4 … `--sp-40` 160. Column 1200 inside 1280 with a 20→40px gutter; 12 columns, 16→24px gap. Sections: `--section-y` 72 → 96 (1440) → 112, top and bottom, and every section after the hero opens with a hairline drawn on the column. Radius by size class: `--r-xl` 28 (stacked cards, dialog, newsletter, the footer module), `--r-lg` 20 (cards, photos), `--r-md` 14 (buttons, inputs), `--r-full` (the capsule, avatars). Hairlines are the only separator. The gallery is the one thing that leaves the column: it runs the full width of the screen.

## 5. Motion
Two kinds. **Things that happen** take a rung of the ladder. **Things that turn, slide or stack** are driven by the scroll and have no duration: the gallery, the quote ring, and the stacked cards. Reference: brandappart.com, where everything goes with the scroll. The logo does not move.

| Token | Value | For |
|---|---|---|
| `--dur-press` | 100ms | `:active` scale .97 |
| `--dur-state` / `--dur-state-out` | 160 / 240ms | hover, focus, colour |
| `--dur-move` | 280ms | position or size changes, a photograph's lift |
| `--dur-reveal` | 360ms | content entering on scroll |
| `--dur-enter` | 500ms | the dialog, the hero's first paint |

The theme swap is one 240ms cross-fade of background, border and text on the whole document (`.is-theming`), not a transition declared per component.

Easings: `--ease-out`, `--ease-in-out`, and two springs as `linear()` (`--ease-pop` for things that just appeared, `--ease-settle` for things that move). Only `transform` and `opacity` animate.

**The flow** (`js/main.js`) is one angle shared by everything that moves with the page. It has a drift, `--flow-drift` 3.75°/s (one revolution of the ring in 96s), plus `--flow-scroll` 0.06° for every pixel scrolled in the scroll's direction; the rendered angle follows that target through an exponential easing with time constant `--flow-settle` 0.32s, so a scroll accelerates everything and it settles back to the drift. **The gallery** moves `--strip-px` 6px per degree: 22px/s at rest, one card every 15 seconds; the arrows step exactly one card with a short ease, and dragging moves it directly. **The ring** places eight photographs at the angle plus 45° each, upright. A photograph under the pointer eases the drift to a stop in about half a second and leaving eases it back; a touch holds it for four seconds; when neither the gallery nor the ring is on screen the flow holds, and scroll deltas are dropped so nothing whooshes on arrival.

Under `prefers-reduced-motion` the drift and the scroll coupling are zero (the gallery and the ring are still pictures; the arrows and dragging still work), the stack does not scale and reveals become short fades. There is no pause control: Jayden removed it. Strict WCAG 2.2.2 would want one for the drift; hover-to-stop and the reduced-motion rule are the mitigation.

**The inventory:** hero first paint · the headline shape's lift · the gallery (drift, scroll, arrows, drag) · the gallery card's lift · the ring (drift, scroll, hover) · the ring photograph's lift · link underline · button press · button hover · reveals · the stack's scale · the theme cross-fade · the lightbox's fade and settle · dialog, sheet and form states. Nothing else moves. Not on the site: parallax, marquees, magnetic buttons, cursor effects, text effects, counters, hover glow, confetti, gradient drift.

## 6. Components
Each is on `styleguide.html` in every state, in both themes.
- **Button** `.btn` + `--primary` / `--secondary` / `--ghost` / `--compact`: 48px (44 compact), `--r-md`, 16px 600. Primary is ink on the ground and inverts through the tokens in dark. Loading via `aria-busy`.
- **Theme toggle** `.theme`: 44px, moon on the light ground, sun on the dark; sets `data-theme` on `<html>` and stores the choice. The inline script in `<head>` applies it before first paint so there is no flash.
- **Card** `.card` (the raised ground, hairline) and `.card--tint` (the accent mixed into the raised ground; the stacked cards, the testimonials, the newsletter, the popup).
- **Photo** `.photo` + `--4x5` / `--3x2` / `--1x1`, and the four shapes `--round` (28% radius), `--tilt` (a rounded square at 45°), `--circle`, `--pill` (`--r-full`): a `<figure>` wrapping a `.photo__open` button wrapping `<picture>` (AVIF, WebP, JPEG at 160/320/480/960 on the page, 1440 in the lightbox), blurred placeholder as a background, `object-position` per photograph via `--pos`. The 160px rendition exists because a 74px circle should not pull a 320px file.
- **Headline shape** `.hero__shape` + `--pill` / `--circle` / `--squircle` / `--wide`: the same photograph treatment set on the line inside the `<h1>`, as an inline-block `<button>` carrying `data-photo`. The `<h1>` has an `aria-label` of the plain sentence so the heading reads cleanly while each shape keeps its own button label.
- **Lightbox** `.lightbox`: native `<dialog>` on the ink scrim at 92%; one photograph at a time, contained, `--r-lg`; close at the corner, arrows either side (below the photograph on a phone); ← → and swipe move through every photograph on the page in order, Esc and the scrim close, focus returns to the photograph that opened it; the next and previous files are warmed. Everything with `data-photo` opens it. A drag on the gallery beyond 6px never opens it. The flow holds while it is open.
- **Gallery** `.strip` + `.strip__viewport` + `.strip__track[data-strip]` + `.strip__card`: §7.
- **Ring** `.ring` + `.ring__stage` + `.ring__orbit` + `.ring__item` + `.ring__centre`: §7.
- **Arrow** `.arrow`: a 44px ink circle with a Phosphor arrow; the gallery's previous and next.
- **Stack** `.stack__card`: a tinted card, sticky under the header, each 12px lower than the last (`--i`), scaled by the flow. The text keeps one column; the other holds **one** photograph in **one** shape, sized by height so every card shows the same amount of picture whatever the shape's ratio. Even cards put the photograph on the left.
- **Testimonials** `.testimonials` + `.testimonial`: three tinted cards on a three-column grid, the middle one a step (`--sp-24`) lower, one column below 768. The quote, then the person with a 40px ink initial.
- **Field** `.field` + `.input`: 48px, error in pink hairline with a message, success swaps the button label and draws a check.
- **Dialog** `.dialog`: native `<dialog>`, a tinted panel; modal on desktop, a non-modal bottom sheet (≤38vh) on mobile; focus lands on the heading.
- **Sheet** `.sheet`: the mobile menu, from the right.
- **Nav** `.nav`: transparent on the ground, glass with a hairline after 24px of scroll. The colour logo (30px, plain) and the wordmark on the left; Gallery, Contact, the theme toggle and Subscribe on the right; on phones the links and Subscribe move into the sheet. There is no "Home" link — the logo is the way home. The logo does not move.
- **Footer** `.footer__module`: one tinted module inset from the page edges, `--r-xl`: the colour logo, a contact column, and the copyright under a hairline.

## 7. The hero, the gallery and the ring
**The hero** is one headline and nothing else (Jayden, 2026-09-05: "the hero still looks far too cluttered ... the images fit inside the differnt shapes"). The four best photographs are set into the sentence as shapes — capsule, circle, rounded rectangle, squircle — one to a line at 1024 and up; under it the tagline and one button. The chips, the second button and the row of four photographs below the title are gone.
```
shape: clamp(44px, 5.1vw, 74px) tall, aspect by kind, vertical-align −0.18em (−0.22em on a phone)
headline: 12.25em measure → four lines at 1024 and up, five on a phone, five at 320 (font steps to 32px)
```
**The gallery** is its own section after the stack: the label and the two arrows on the column, then the track **edge to edge across the screen** (Jayden: "the gallery i dont like that it doesnt go all the way across"). The arrow step is a time-based ease (τ 110ms), so a slow frame never shortens it; the pointer is captured only once a drag passes 6px, so a plain click reaches the photograph.
```
gallery card: clamp(220px, 21vw, 300px) wide, 4:5, --r-lg, --grid-gap apart; 236px on a phone
track: the twelve photographs twice (the second set aria-hidden), full width, bleeding off both edges
motion: x = −((angle × 6 + offset) mod half the track); offset moves by one card per arrow press (eased) or by the drag
```
**The ring** carries the quote: the circular gallery from the video Jayden sent (eight shaped photographs turning around a centre panel, upright).
```
--ring-r: 300 (≥1024) · 240 (≥768) · 166 (phone)          radius in px, a plain number js reads
items: 150 · 120 · 80px, shapes cycling round → tilt → circle, centred on the circle; upright always
stage height: 2 × (r + 96 · 80 · 56); the centre panel 1.1r wide (1.24r on a phone), the quote at min(h2, 40px)
```
The `ring` gate steps a full slot at three viewports and requires zero photograph pixels under the quote, zero photograph-on-photograph overlap, every item inside the stage, that a hovered photograph stops the drift and leaving resumes it, that 300px of scroll turns the ring by more than the drift would, that the gallery drifts, and that an arrow press moves the track exactly one card and lands on the arrow.

## 8. Photography
Every photograph has a factual `alt`, explicit dimensions, `loading="lazy"` except the hero's four and the first five gallery cards, and a crop set by looking at it at its rendered size. Colour and B&W are never mixed by conversion; in the gallery and the ring no two B&W photographs are adjacent. The ring may reuse four of the gallery's photographs (they are a screen apart); the stacked cards' photographs appear nowhere else. A face cut by the frame's edge is a reason to change the crop or the photograph. Children's faces need releases confirmed with Linda. The pipeline is `tools/build-images.mjs`; the source folder is gitignored.

## 9. Copy
Only sentences from the old site, and only the ones the page needs. Labels may be single words or phrases from them. Placeholders are lorem with `data-placeholder="true"`. The `copy` gate fails on any other string.

## 10. Gates
`tools/gates/run-all.sh` runs them serially: layout (overflow, the headline's line count, the column, equal card widths), targets, contrast (every text node in both themes), copy, images, motion (the flow drifts, the stack scales, and under reduced motion nothing does), ring (the ring and the gallery), lightbox (opens, serves ≥ 960px, keys and arrows, Esc and focus return, a drag does not open it, the scrim closes), dialog, a11y. Each exits non-zero on failure and prints the number it measured. `ring.mjs --self-test` shrinks the ring and must fail; `contrast.mjs --self-test` paints the ink onto the ground and must fail. Every gate but `dialog` starts with the newsletter popup already marked shown, so it cannot open over the thing being measured.
