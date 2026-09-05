# Developmental Improvisation — Design System

> Import into Notion: Settings & members → Import → Markdown & CSV, or drop this file onto a page. Tables import as tables; the quoted lines become callouts. The live version of every component is `styleguide.html`; the tokens are `css/tokens.css`.

## Principles

> Premium is subtraction. When a screen feels wrong, remove something before adding something. Nothing is on the page that the page could do without.

> Counting is not looking. Measure, then look at the screenshot.

> Two faces: Sen (800 for the display, 700 for titles) and Plus Jakarta Sans 400 and 600 for everything else. No italics, no gradient text.

> Two themes, one palette. Light is the default; dark is the visitor's choice, kept and applied before first paint.

> Colour is flat. It appears in the photographs, in a tinted card, and in the footer module. There are no gradients anywhere on the site.

> No shadows. Depth is a card on the ground plus a hairline.

> Photographs are the only pictures. No illustrations, no decorative vectors, no stars. Four shapes hold them: the capsule, the circle, the rounded square, and the square turned 45°.

> Motion has two kinds. Things that happen take a rung of the ladder. Things that turn or stack follow the scroll and have no duration.

> Copy is verbatim from the old site, and only what the page needs. Placeholders are marked.

> 44px targets, measured. Every interruption is polite.

## Colour

Two themes. The light ground is a warm off-white (hue ≈ 80°, lightness .97) with a warm black ink; dark is the same hue at lightness .07 with a warm off-white ink. The header is transparent and becomes glass with a hairline once scrolled.

| Token | Light | Dark | Use |
|---|---|---|---|
| bg | #F7F5F0 | #131211 | the ground |
| bg-raised | #FFFFFF | #1C1A18 | cards, and the base a tint mixes into |
| bg-sunken | #EFECE5 | #0E0D0C | wells |
| ink / ink-2 / ink-3 | #1B1916 / #514C45 / #736D64 | #F4F1EB / 74% / 58% | headings and the mark / body / captions |
| line / line-strong | ink 10% / 22% | off-white 12% / 24% | hairlines |

The seven logo hues appear one way: as a flat tint, `color-mix(in oklab, accent, bg-raised)` at 22% in light and 30% in dark, on the stacked cards, the testimonials, the newsletter, the popup and the footer module.

| Hue | Value |
|---|---|
| green | #51E596 |
| sky | #58CDFC |
| violet | #7358FC |
| magenta | #E744E2 |
| orange | #F0895B |
| pink | #FB9BC9 |
| yellow | #FEE79B |

> The mix happens on the element that carries `data-accent`. Mixing it at `:root` resolves once and every card comes out the same colour — that bug shipped once, in the chips.

> A section or card sets `data-accent` once. Down the home page: sky → green → yellow → violet (the stack) → sky, yellow, pink (testimonials) → orange (newsletter) → violet (the footer module).

## Type

Sen and Plus Jakarta Sans, self-hosted. Sen is one variable latin file, 18KB for every weight from 400 to 800. Tracking tightens as size grows, leading loosens as it shrinks. Measures in `em`, never `ch`.

| Role | Size (390 → 1440) | Leading | Tracking | Face |
|---|---|---|---|---|
| display | 38 → 80 (32 below 360) | 1.16 (1.42 on a phone) | −0.035em | Sen 800 |
| h1 | 36 → 60 | 1.06 | −0.03em | Sen 800 |
| h2 | 30 → 46 | 1.12 | −0.025em | Sen 700 |
| h3 | 22 → 26 | 1.2 | −0.02em | Sen 700 |
| lead | 18 → 21 | 1.45 | −0.005em | Jakarta 400 |
| body | 16 → 17 | 1.6 | 0 | Jakarta 400 |
| label | 14 | 1 | +0.04em, uppercase | Jakarta 600 |
| caption | 13 | 1.4 | +0.01em | Jakarta 400 |

> The display's leading lives on the hero, not in the tokens: it has to hold an inline photograph, which sits 0.68em above the baseline and 0.18em below.

## Space and shape

4px grid, `--sp-1` 4 to `--sp-40` 160. Column 1200 inside 1280, 12 columns, 16 → 24px gap. Sections 72 → 96 → 112 top and bottom, each opening with a hairline on the column. The gallery is the one thing that leaves the column.

| Radius | px | For |
|---|---|---|
| r-xl | 28 | stacked cards, popup, newsletter, the footer module |
| r-lg | 20 | cards, photos |
| r-md | 14 | buttons, inputs |
| r-full | ∞ | the capsule, avatars |

## Motion

| Token | Value | For |
|---|---|---|
| dur-press | 100ms | pressing a button |
| dur-state / dur-state-out | 160 / 240ms | hover, focus, colour |
| dur-move | 280ms | position or size changes |
| dur-reveal | 360ms | content entering on scroll |
| dur-enter | 500ms | the popup, the hero's first paint |

> The flow: one angle shared by everything that moves with the page. A drift of 3.75°/s plus 0.06° per pixel scrolled, eased with a 0.32s time constant. The gallery moves 6px per degree (22px/s at rest, one card every 15s); the arrows step one card; it can be dragged. The quote ring turns by the angle. Hovering a photograph eases the drift to a stop. The logo does not move. The stack: a covered card scales from its top edge by 4.5% per card above it, in step with the scroll.

> The theme swap is one 240ms cross-fade of the whole document, not a per-component transition.

> Reduced motion: the drift and scroll coupling are zero, the stack does not scale, reveals become short fades.

## Components

| Component | Rule |
|---|---|
| Button | 48px (44 compact), r-md, 16px 600. Primary is ink on the ground and inverts through the tokens in dark. |
| Theme toggle | 44px, moon on light, sun on dark; sets `data-theme` and stores the choice. |
| Card | The raised ground with a hairline, or `card--tint`: the accent mixed into it (stacked cards, testimonials, newsletter, popup). |
| Photo | figure + a button + picture, AVIF/WebP/JPEG at 160/320/480/960 (1440 in the lightbox), blurred placeholder, crop per photograph; four shapes — round, tilt, circle, pill. No frames. Every photograph opens in the lightbox. |
| Headline shape | The same photograph treatment set on the line inside the h1, `clamp(44px, 5.1vw, 74px)` tall. The h1 carries an aria-label of the plain sentence. |
| Lightbox | Native dialog on the ink scrim; one photograph, arrows and keys through the whole set, Esc or the scrim to close, focus returns. |
| Gallery | One loop of twelve 4:5 photographs on a track that runs edge to edge, moved by the flow, arrows and drag. |
| Ring | The quote: eight shaped photographs on a circle, upright, turning with the flow. |
| Stack | Sticky tinted cards, each 12px lower, scaled by the flow; the text in one column, one photograph in one shape in the other, mirrored on even cards. |
| Testimonials | Three tinted cards on a grid, the middle one lower; one column on a phone. |
| Field | 48px input, error in pink hairline with a message, success swaps the button label. |
| Dialog | Native dialog, a tinted panel; modal on desktop, a bottom sheet on mobile. |
| Nav | Transparent on the ground, glass once scrolled: the colour logo left; Gallery, Contact, the theme toggle and Subscribe right. No Home link — the logo is the way home. |
| Footer | One tinted module inset from the page edges: the colour logo, a contact column, and the copyright under a hairline. |

## The hero, the gallery and the ring

| Parameter | Value |
|---|---|
| the hero | one headline with the four best photographs set into it as shapes, the tagline, one button |
| headline shape | clamp(44px, 5.1vw, 74px) tall, vertical-align −0.18em (−0.22em on a phone) |
| headline measure | 12.25em → four lines at 1024 and up, five on a phone |
| gallery card | clamp(220px, 21vw, 300px) wide, 4:5; 236px on a phone |
| gallery track | twelve photographs twice, full width, bleeding off both edges |
| gallery motion | 6px per degree of flow; one card per arrow press; drag |
| ring radius | 300 (≥1024) · 240 (≥768) · 166 (phone) |
| ring items | 150 · 120 · 80px, shapes round → tilt → circle, upright |
| ring centre | the quote at min(h2, 40px), 1.1 × radius wide |

## Photographs

Every photograph has a factual alt, explicit dimensions, lazy loading except the hero's four and the first five gallery cards, and a crop set by looking at it at its rendered size. No two B&W photographs adjacent in the gallery or the ring. A face cut by a frame's edge is a reason to change the crop or the photograph. Children's faces need releases confirmed with Linda.

## Copy

Only sentences from the old site, and only the ones the page needs. Placeholders are lorem with `data-placeholder="true"`.

## Gates

`tools/gates/run-all.sh`, serially: layout, targets, contrast (both themes), copy, images, motion, ring, lightbox, dialog, a11y. Each prints the number it measured. `ring.mjs --self-test` shrinks the ring and must fail; `contrast.mjs --self-test` paints the ink onto the ground and must fail.
