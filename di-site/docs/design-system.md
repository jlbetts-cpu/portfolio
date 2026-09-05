# Developmental Improvisation — design system

For anyone building the next page (Gallery, Contact, About). Every rule has a reason. If you cannot say what an element is *for*, delete it. The live version of every component is `styleguide.html`; the tokens are `css/tokens.css`, the only file allowed to contain raw values.

## 1. Principles
1. **Premium is subtraction.** When a screen feels wrong, remove something before adding something.
2. **Counting is not looking.** Measure, then open the screenshot. Every gate in `tools/gates/` exists because a number once lied.
3. **One typeface, two weights, no italics, no gradient text.** Hierarchy is size, weight, leading, tracking and ink tier.
4. **One theme, light.** A warm off-white ground, a warm black ink, a black mark. No dark mode (Jayden, 2026-09-05: "the whole site should be light mode").
5. **Colour is contained.** It lives in the photographs and in the blooms: soft, eased gradients at the foot of a white card. No flat coloured surface, no coloured text, no coloured logo on the page; the 16px section star is the one small mark.
6. **No shadows.** Depth is a white card on the warm ground plus a hairline. Gradients exist only as blooms, and a bloom is a light, not a fill: it never reaches the top of a card.
7. **Flat vectors only.** The star comes from the logo file, unchanged. Nothing else is drawn; decorative shapes were tried and removed.
8. **Motion is a system with two kinds.** Things that happen take a rung of the ladder. Things that turn or stack follow the scroll through one shared value, the flow, and have no duration.
9. **Copy is verbatim from the old site.** Placeholders carry `data-placeholder="true"`.
10. **44px targets, measured.** The `targets` gate prints the smallest.
11. **Every interruption is polite.** The newsletter dialog waits for both 40% scroll and ten seconds, once per session, thirty days after a dismissal.

## 2. Colour
One theme, `css/tokens.css`. The ground is a warm off-white, not a yellow cream: hue ≈ 80°, lightness .97, chroma near zero. Ink is a warm black. The header is transparent on the ground and becomes glass with a hairline once scrolled; the mark in it is black.

| Token | Value | Use |
|---|---|---|
| `--bg` | #F7F5F0 | the ground |
| `--bg-raised` | #FFFFFF | cards |
| `--bg-sunken` | #EFECE5 | wells, empty photo frames |
| `--ink` / `--ink-2` / `--ink-3` | #1B1916 / #514C45 (7.8:1) / #736D64 (4.7:1) | headings and the mark / body / captions |
| `--line` / `--line-strong` | ink 10% / 22% | hairlines |
| `--glass` | ground at 82% | the header once scrolled |

**Colour is contained.** The seven hues inside the logo appear on the page in exactly two ways: as the 16px section star (`--m-*`, a deeper tone of each so it reads at ≥ 3:1 on the ground) and inside a **bloom**. Nothing else is coloured: not a surface, not a chip, not text, not the logo.

| Hue | Value | Star tone | Bloom partner |
|---|---|---|---|
| green | #51E596 | #1F9A5E | sky |
| sky | #58CDFC | #1A8BC6 | violet |
| violet | #7358FC | #5A45D9 | pink |
| magenta | #E744E2 | #B72FB3 | orange |
| orange | #F0895B | #C8552A | yellow |
| pink | #FB9BC9 | #D14E8E | magenta |
| yellow | #FEE79B | #A67D08 | orange |

**The bloom** (`.card--bloom`, `.card--bloom-hover`) is the brand's one gradient, learned from the reference Jayden sent and from the heroes of his own portfolio: a radial gradient anchored below the foot of a white card, its hue mixed toward white in oklab over seven eased stops (100 → 78 → 52 → 30 → 14 → 5 → 0%) so the falloff has no edge, with the hue's partner as a fainter second light at the other corner. Stops end in transparent white, never `transparent`, which interpolates through black and draws a grey seam. It is always on for the testimonials, the newsletter card and the popup, and it rises under the pointer on the stacked cards over `--dur-bloom` 480ms. It never reaches the top of a card; text sits on white.

**Accents.** A section sets `data-accent="…"` once; the star reads `--accent-mark`, a bloom reads `--bloom-a` and `--bloom-b`. Down the home page: yellow (hero) → sky → green → yellow → violet (the stack) → pink (the quote ring) → magenta (testimonials, the cards sky, yellow, pink) → orange (newsletter) → green (contact). Never two adjacent sections the same.

## 3. Type
Plus Jakarta Sans, 400 and 600, self-hosted latin subsets, `font-display: swap` with a size-adjusted fallback so the swap does not move layout. Chosen from eight faces: the tallest x-height of the warm geometrics (0.536 em), so 14px holds in both themes; angled `t` and `y` give it identity without novelty.

| Role | Size (390 → 1440) | Leading | Tracking | Weight | Colour |
|---|---|---|---|---|---|
| display | 34 → 56 (30 on a 390 phone, so the title holds three lines) | 1.04 | −0.03em | 600 | ink |
| h1 | 36 → 60 | 1.06 | −0.025em | 600 | ink |
| h2 | 28 → 44 | 1.1 | −0.02em | 600 | ink |
| h3 | 22 → 26 | 1.2 | −0.01em | 600 | ink |
| lead | 18 → 21 | 1.45 | −0.005em | 400 | ink-2 |
| body | 16 → 17 | 1.6 | 0 | 400 | ink-2 (first paragraph ink) |
| small | 14 | 1.5 | +0.005em | 600 for labels | ink-2 |
| caption | 13 | 1.4 | +0.01em | 400 | ink-3 |

Measures are in `em`: display 15em, sub 24em, h2 16em, body 34em; the quote inside the ring 1.1 × the ring's radius. **Never `ch`** — this face's zero is 0.685em wide, so `24ch` at 48px is 825px and the hero tagline once wrapped into the side cards because of it.

## 4. Space, grid, radius, lines
4px grid: `--sp-1` 4 … `--sp-40` 160 (28 exists for the testimonial card). Column 1200 inside 1280 with a 20→40px gutter; 12 columns, 16→24px gap. Sections: `--section-y` 72 → 96 (1440) → 112, top and bottom, and every section after the hero opens with a hairline drawn on the column. Radius by size class: `--r-xl` 28 (stacked cards, dialog, newsletter card), `--r-lg` 20 (cards, photos), `--r-md` 14 (buttons, inputs), `--r-full` (chips, avatars). Hairlines are the only separator.

## 5. Motion
Two kinds. **Things that happen** take a rung of the ladder. **Things that turn, slide or stack** are driven by the scroll and have no duration: the hero strip, the quote ring, and the stacked cards. Reference: brandappart.com, where everything goes with the scroll. The logo does not move.

| Token | Value | For |
|---|---|---|
| `--dur-press` | 100ms | `:active` scale .97 |
| `--dur-state` / `--dur-state-out` | 160 / 240ms | hover, focus, colour; the theme cross-fade |
| `--dur-move` | 280ms | position or size changes, the pile's straighten, the arch card's lift |
| `--dur-reveal` | 360ms | content entering on scroll, the pile's drop |
| `--dur-enter` | 500ms | the dialog, the hero's first paint |
| `--dur-bloom` | 480ms | a bloom rising under the pointer |

Easings: `--ease-out`, `--ease-in-out`, and two springs as `linear()` (`--ease-pop` for things that just appeared, `--ease-settle` for things that move). Only `transform` and `opacity` animate.

**The flow** (`js/main.js`) is one angle shared by everything that moves with the page. It has a drift, `--flow-drift` 3.75°/s (one revolution of the ring in 96s), plus `--flow-scroll` 0.06° for every pixel scrolled in the scroll's direction; the rendered angle follows that target through an exponential easing with time constant `--flow-settle` 0.32s, so a scroll accelerates everything and it settles back to the drift. **The strip** moves `--strip-px` 6px per degree: 22px/s at rest, one card every 15 seconds; the arrows step exactly one card with a short ease, and dragging moves it directly. **The ring** places eight photographs at the angle plus 45° each, upright. A photograph under the pointer (strip or ring) eases the drift to a stop in about half a second and leaving eases it back; a touch holds it for four seconds; when neither the strip nor the ring is on screen the flow holds. The stack: a covered card scales from its top edge by 4.5% for each card above it, in step with how far the next card has climbed over it; no state flips, no transitions.

Under `prefers-reduced-motion` the drift and the scroll coupling are zero (the strip and the ring are still pictures; the arrows and dragging still work), the stack does not scale, reveals become short fades, the pile does not drop. There is no pause control: Jayden removed it. Strict WCAG 2.2.2 would want one for the drift; hover-to-stop and the reduced-motion rule are the mitigation.

**The inventory:** hero first paint · the strip (drift, scroll, arrows, drag) · the strip card's lift · the ring (drift, scroll, hover) · the ring photograph's lift · a bloom rising on a stacked card · link colour · button press · button hover · reveals · the stack · dialog, sheet and form states. Nothing else moves. Not on the site: parallax, marquees, magnetic buttons, cursor effects, text effects, counters, hover glow, confetti, gradient drift.

## 6. Components
Each is on `styleguide.html` in every state, in both themes.
- **Button** `.btn` + `--primary` / `--secondary` / `--ghost` / `--compact`: 48px (44 compact), `--r-md`, 16px 600. Primary is ink on the ground and inverts on a coloured surface through the tokens. Loading via `aria-busy`.
- **Chip** `.chip`: 32px, `--r-full`, ink at 6% with ink text. Not interactive.
- **Star** `.star`: the logo's four-point star, 16px, in the section's mark tone, before every section label. Nowhere else.
- **Card** `.card` (white on the ground, hairline), `.card--bloom` (with its bloom: the testimonials, the newsletter, the popup), `.card--bloom-hover` (the bloom rises under the pointer: the stacked cards).
- **Photo** `.photo` + `--4x5` / `--3x2` / `--1x1`, and the shapes `--round` (28% radius), `--tilt` (a rounded square at 45°), `--circle`: `<figure>` wrapping `<picture>` (AVIF, WebP, JPEG at 320/480/960), blurred placeholder as a background, `object-position` per photograph via `--pos`. No frames, no outlines. The ring and the stacked cards' tiles use the shapes (round beside circle on every card); the strip stays rectangular.
- **Strip** `.strip` + `.strip__viewport` + `.strip__track[data-strip]` + `.strip__card`: §7.
- **Ring** `.ring` + `.ring__stage` + `.ring__orbit` + `.ring__item` + `.ring__centre`: §7.
- **Arrow** `.arrow`: a 44px ink circle with a Phosphor arrow; the strip's previous and next.
- **Stack** `.stack__card`: sticky under the header, each 12px lower than the last (`--i`), scaled by the flow.
- **Testimonials** `.testimonials` + `.testimonial`: three white bloom cards on a three-column grid, the middle one a step (`--sp-24`) lower, one column below 768. The quote, then the person with a 40px ink initial.
- **Field** `.field` + `.input`: 48px, error in pink hairline with a message, success swaps the button label and draws a check.
- **Dialog** `.dialog`: native `<dialog>`, a white panel with the orange bloom; modal on desktop, a non-modal bottom sheet (≤38vh) on mobile; focus lands on the heading.
- **Sheet** `.sheet`: the mobile menu, from the right.
- **Nav** `.nav`: transparent on the ground, glass with a hairline after 24px of scroll. The black mark and the wordmark on the left; Home, Gallery, Contact and Subscribe on the right; on phones the links and Subscribe move into the sheet. The mark does not move.
- **Footer** `.footer`: the mark, one line, ©, then Menu and Contact columns as words.

## 7. The strip and the ring
**The hero** is the tennis-school reference Jayden sent, built for photographs: an eyebrow with the star, the title on the left (15em, three lines), the tagline and the two buttons on the right, the two arrows, then the strip.
```
strip card: clamp(220px, 21vw, 300px) wide, 4:5, --r-lg, --grid-gap apart; 236px on a phone
track: the twelve photographs twice (the second set aria-hidden), left edge on the column, bleeding off the right
motion: x = −((angle × 6 + offset) mod half the track); offset moves by one card per arrow press (eased) or by the drag
```
**The ring** replaces the plain quote: the circular gallery from the video Jayden sent (eight shaped photographs turning around a centre panel, upright).
```
--ring-r: 300 (≥1024) · 240 (≥768) · 166 (phone)          radius in px, a plain number js reads
items: 150 · 120 · 80px, shapes cycling round → tilt → circle, centred on the circle; upright always
stage height: 2 × (r + 96 · 80 · 56); the centre panel 1.1r wide (1.24r on a phone), the quote at min(h2, 40px)
```
The `ring` gate steps a full slot at three viewports and requires zero photograph pixels under the quote, zero photograph-on-photograph overlap, every item inside the stage, that a hovered photograph stops the drift and leaving resumes it, that 300px of scroll turns the ring by more than the drift would, that the strip drifts, and that an arrow press moves the track exactly one card.

## 8. Photography
Every photograph has a factual `alt`, explicit dimensions, `loading="lazy"` except the first five strip cards, and a crop set by looking at it at its rendered size (`tools/gates` has no crop gate; the contact sheet is a scratch script and the eye). Colour and B&W are never mixed by conversion; in the strip and the ring no two B&W photographs are adjacent. The ring may reuse four of the strip's photographs (they are a screen apart); the tiles are unique. A face cut by the frame's edge is a reason to change the crop or the photograph. Children's faces need releases confirmed with Linda. The pipeline is `tools/build-images.mjs`; the source folder is gitignored.

## 9. Copy
Only sentences from the old site. Labels may be single words or phrases from them. Placeholders are lorem with `data-placeholder="true"`. The `copy` gate fails on any other string.

## 10. Gates
`tools/gates/run-all.sh` runs them serially: layout, targets, contrast (text on its ground, and the caption ink over the darkest bloom pixel), copy, images, motion (drift, the stack, a bloom rising and leaving), ring (the ring and the strip), dialog, a11y. `ring.mjs --self-test` shrinks the ring and must fail. Each exits non-zero on failure and prints the number it measured. `orbit.mjs --self-test` injects an overlap and must fail.
