# Developmental Improvisation — Design System

> Import into Notion: Settings & members → Import → Markdown & CSV, or drop this file onto a page. Tables import as tables; the quoted lines become callouts. The live version of every component is `styleguide.html`; the tokens are `css/tokens.css`.

## Principles

> Premium is subtraction. When a screen feels wrong, remove something before adding something.

> Counting is not looking. Measure, then look at the screenshot.

> One typeface, two weights, no italics, no gradient text.

> One theme, light: a warm off-white ground, a warm black ink, a black mark.

> Colour is contained: it lives in the photographs and in the blooms, soft eased gradients at the foot of a white card. No flat coloured surfaces, no coloured text, no coloured logo on the page.

> No shadows. Depth is a white card on the warm ground plus a hairline. A bloom is a light, not a fill.

> Motion has two kinds. Things that happen take a rung of the ladder. Things that turn or stack follow the scroll and have no duration.

> Copy is verbatim from the old site. Placeholders are marked.

> 44px targets, measured. Every interruption is polite.

## Colour

One theme. The ground is a warm off-white (hue ≈ 80°, lightness .97), the ink a warm black, the mark black. The header is transparent and becomes glass with a hairline once scrolled.

| Token | Value | Use |
|---|---|---|
| bg | #F7F5F0 | the ground |
| bg-raised | #FFFFFF | cards |
| bg-sunken | #EFECE5 | wells |
| ink / ink-2 / ink-3 | #1B1916 / #514C45 / #736D64 | headings and the mark / body / captions |
| line / line-strong | ink 10% / 22% | hairlines |

The seven logo hues appear in two ways only: as the 16px section star (a deeper tone of each) and inside a bloom.

| Hue | Value | Star tone | Bloom partner |
|---|---|---|---|
| green | #51E596 | #1F9A5E | sky |
| sky | #58CDFC | #1A8BC6 | violet |
| violet | #7358FC | #5A45D9 | pink |
| magenta | #E744E2 | #B72FB3 | orange |
| orange | #F0895B | #C8552A | yellow |
| pink | #FB9BC9 | #D14E8E | magenta |
| yellow | #FEE79B | #A67D08 | orange |

> The bloom: a radial gradient below the foot of a white card, the hue mixed toward white in oklab over seven eased stops so it has no edge, with its partner hue as a fainter light at the other corner. Stops end in transparent white, never `transparent`. Always on for the testimonials, the newsletter and the popup; it rises under the pointer on the stacked cards. Text always sits on white.

> A section sets `data-accent` once. Down the home page: yellow → sky → green → yellow → violet → pink → magenta → orange → green.

## Type

Plus Jakarta Sans, 400 and 600, self-hosted. Tracking tightens as size grows, leading loosens as it shrinks. Measures in `em`, never `ch`.

| Role | Size (390 → 1440) | Leading | Tracking | Weight |
|---|---|---|---|---|
| display | 34 → 56 (30 on a phone) | 1.04 | −0.03em | 600 |
| h1 | 36 → 60 | 1.06 | −0.025em | 600 |
| h2 | 28 → 44 | 1.1 | −0.02em | 600 |
| h3 | 22 → 26 | 1.2 | −0.01em | 600 |
| lead | 18 → 21 | 1.45 | −0.005em | 400 |
| body | 16 → 17 | 1.6 | 0 | 400 |
| small | 14 | 1.5 | +0.005em | 600 for labels |
| caption | 13 | 1.4 | +0.01em | 400 |

## Space and shape

4px grid, `--sp-1` 4 to `--sp-40` 160. Column 1200 inside 1280, 12 columns, 16 → 24px gap. Sections 72 → 96 → 112 top and bottom, each opening with a hairline on the column.

| Radius | px | For |
|---|---|---|
| r-xl | 28 | stacked cards, popup, newsletter |
| r-lg | 20 | cards, photos, the arch's frames |
| r-md | 14 | buttons, inputs |
| r-full | ∞ | chips, avatars |

## Motion

| Token | Value | For |
|---|---|---|
| dur-press | 100ms | pressing a button |
| dur-state / dur-state-out | 160 / 240ms | hover, focus, colour, the theme cross-fade |
| dur-move | 280ms | position or size changes |
| dur-reveal | 360ms | content entering on scroll |
| dur-enter | 500ms | the popup, the hero's first paint |
| dur-bloom | 480ms | a bloom rising under the pointer |

> The flow: one angle shared by everything that moves with the page. A drift of 3.75°/s plus 0.06° per pixel scrolled, eased with a 0.32s time constant. The hero strip moves 6px per degree (22px/s at rest, one card every 15s); the arrows step one card; it can be dragged. The quote ring turns by the angle. Hovering a photograph eases the drift to a stop. The logo does not move. The stack: a covered card scales from its top edge by 4.5% per card above it, in step with the scroll.

> Reduced motion: the drift and scroll coupling are zero, the stack does not scale, reveals become short fades, the pile does not drop.

## Components

| Component | Rule |
|---|---|
| Button | 48px (44 compact), r-md, 16px 600. Primary is ink on the ground; inverts on a coloured surface. |
| Chip | 32px, r-full, ink at 6% with ink text. Not interactive. |
| Star | The logo's star, 16px, in the section's mark tone, before every section label. |
| Card | White on the ground with a hairline; bloom cards carry their bloom (testimonials, newsletter, popup); the stacked cards raise theirs under the pointer. |
| Photo | figure + picture, AVIF/WebP/JPEG at 320/480/960, blurred placeholder, crop per photograph; shapes round, tilt and circle for the ring and the stacked cards' tiles. No frames. |
| Strip | The hero: one loop of twelve 4:5 photographs on a track, moved by the flow, arrows and drag. |
| Ring | The quote: eight shaped photographs on a circle, upright, turning with the flow. |
| Stack | Sticky cards, each 12px lower, scaled by the flow. |
| Testimonials | Three white bloom cards on a grid, the middle one lower; one column on a phone. |
| Field | 48px input, error in pink hairline with a message, success swaps the button label. |
| Dialog | Native dialog, white with the orange bloom; modal on desktop, a bottom sheet on mobile. |
| Nav | Transparent, glass once scrolled: black mark left; links and Subscribe right. The mark does not move. |
| Footer | The mark, one line, ©, then Menu and Contact columns. |

## The strip and the ring

| Parameter | Value |
|---|---|
| strip card | clamp(220px, 21vw, 300px) wide, 4:5; 236px on a phone |
| strip track | twelve photographs twice; left edge on the column, bleeding right |
| strip motion | 6px per degree of flow; one card per arrow press; drag |
| ring radius | 300 (≥1024) · 240 (≥768) · 166 (phone) |
| ring items | 150 · 120 · 80px, shapes round → tilt → circle, upright |
| ring centre | the quote at min(h2, 40px), 1.1 × radius wide |

## Photographs

Every photograph has a factual alt, explicit dimensions, lazy loading except the first five strip cards, and a crop set by looking at it at its rendered size. No two B&W photographs adjacent in the strip or the ring. A face cut by a frame's edge is a reason to change the crop or the photograph. Children's faces need releases confirmed with Linda.

## Copy

Only sentences from the old site. Placeholders are lorem with `data-placeholder="true"`.

## Gates

`tools/gates/run-all.sh`, serially: layout, targets, contrast (both themes), copy, images, motion, ring, dialog, a11y (both themes). Each prints the number it measured. `ring.mjs --self-test` shrinks the ring and must fail.
