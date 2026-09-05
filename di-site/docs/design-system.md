# Developmental Improvisation — design system

For anyone building the next page (Gallery, Contact, About). Every rule has a reason. If you cannot say what an element is *for*, delete it. The live version of every component is `styleguide.html`; the tokens are `css/tokens.css`, the only file allowed to contain raw values.

## 1. Principles
1. **Premium is subtraction.** When a screen feels wrong, remove something before adding something.
2. **Counting is not looking.** Measure, then open the screenshot. Every gate in `tools/gates/` exists because a number once lied.
3. **One typeface, two weights, no italics, no gradient text.** Hierarchy is size, weight, leading, tracking and ink tier.
4. **Light by default, dark by choice, the header dark in both.** One token sheet; the visitor's toggle sets `data-theme` on `<html>` and it is remembered.
5. **Colour lives on surfaces and the logo. Text is ink or an ink tier** — except inside a coloured card, where the surface tokens flip it.
6. **No shadows. No gradients.** Depth is a white card on the warm ground plus a hairline (a raised surface on dark). The photographs and the seven hues are the only colour fields.
7. **Flat vectors only.** The star comes from the logo file, unchanged. Nothing else is drawn.
8. **Motion is a system with two kinds.** Things that happen take a rung of the ladder. Things that turn or stack follow the scroll through one shared value, the flow, and have no duration.
9. **Copy is verbatim from the old site.** Placeholders carry `data-placeholder="true"`.
10. **44px targets, measured.** The `targets` gate prints the smallest.
11. **Every interruption is polite.** The newsletter dialog waits for both 40% scroll and ten seconds, once per session, thirty days after a dismissal.

## 2. Colour
Two themes from one sheet, `css/tokens.css`. **Light is the default** (Jayden, 2026-09-05: it fits the brand). The ground is a warm off-white, not a yellow cream: hue ≈ 80°, lightness .97, chroma near zero. Ink is a warm black, and the header is that same black in both themes, so the bar and the page share one dark. Dark is the visitor's choice from the toggle in the header, remembered in `localStorage` as `di:theme`; the OS preference is not consulted, because light is the brand's look.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #F7F5F0 | #131211 | the ground |
| `--bg-raised` | #FFFFFF | #1C1A18 | cards, the testimonial pile |
| `--bg-sunken` | #EFECE5 | #0E0D0C | wells, empty photo frames |
| `--ink` / `--ink-2` / `--ink-3` | #1B1916 / #514C45 (7.8:1) / #736D64 (4.7:1) | #F4F1EB / 74% (9.8:1) / 56% (5.8:1) | headings / body / captions |
| `--line` / `--line-strong` | ink 10% / 22% | ink 10% / 22% | hairlines |
| `--nav-bg` / `--nav-ink` | #1B1916 / #F4F1EB | same | the header, `data-surface="ink"` |

The seven hues inside the logo are the palette. As **surfaces** (`--c-*`) they are the four stacked cards, the newsletter card and its popup, the chips, and the 3px frame around every photograph in the arch. As **marks** on the light ground (`--m-*`, a deeper tone of each) they are the section stars, the testimonial initials and the pager, so a 16px star still reads at ≥ 3:1; in dark the marks use the surface tone.

| Hue | Surface | Mark (light) | Dark ink on the surface |
|---|---|---|---|
| green | #51E596 | #1F9A5E | 10.7:1 · stack card (02) |
| sky | #58CDFC | #1A8BC6 | 9.6:1 · stack card (01), chips, selection |
| violet | #7358FC | #5A45D9 | 3.7:1 → **white ink 4.6:1** · stack card (04); never a chip, never text |
| magenta | #E744E2 | #B72FB3 | 5.2:1 · testimonials' marks, an arch frame |
| orange | #F0895B | #C8552A | 6.9:1 · the newsletter card and popup |
| pink | #FB9BC9 | #D14E8E | 8.7:1 · the quote's star, an arch frame |
| yellow | #FEE79B | #A67D08 | 14.1:1 · stack card (03), chips |

**Accents.** A section sets `data-accent="…"` once; every component inside reads `--accent`, `--accent-mark` and `--accent-ink`. Down the home page: sky → green → yellow → violet (the stack) → pink (quote) → magenta (testimonials) → orange (newsletter) → green (contact). Never two adjacent sections the same. The arch's frames cycle sky, green, yellow, pink, orange, violet, magenta twice, so no two neighbours share a hue.

**Coloured surfaces.** `data-surface="accent"` paints the accent and flips the tokens: `--ink` becomes `--accent-ink` (dark, or white on violet), `--ink-2` 78%, `--ink-3` 72%, hairlines and the focus ring dark, the primary button and chips inverted. On violet there are no ink tiers. `data-surface="ink"` is the header: the warm black with cream ink, in both themes.

## 3. Type
Plus Jakarta Sans, 400 and 600, self-hosted latin subsets, `font-display: swap` with a size-adjusted fallback so the swap does not move layout. Chosen from eight faces: the tallest x-height of the warm geometrics (0.536 em), so 14px holds in both themes; angled `t` and `y` give it identity without novelty.

| Role | Size (390 → 1440) | Leading | Tracking | Weight | Colour |
|---|---|---|---|---|---|
| display | 34 → 56, and never more than 5.8% of the hero's height | 1.04 | −0.03em | 600 | ink |
| h1 | 36 → 60 | 1.06 | −0.025em | 600 | ink |
| h2 | 28 → 44 | 1.1 | −0.02em | 600 | ink |
| h3 | 22 → 26 | 1.2 | −0.01em | 600 | ink |
| lead | 18 → 21 | 1.45 | −0.005em | 400 | ink-2 |
| body | 16 → 17 | 1.6 | 0 | 400 | ink-2 (first paragraph ink) |
| small | 14 | 1.5 | +0.005em | 600 for labels | ink-2 |
| caption | 13 | 1.4 | +0.01em | 400 | ink-3 |

Measures are in `em`: display 12em, sub 24em, h2 16em, body 34em. **Never `ch`** — this face's zero is 0.685em wide, so `24ch` at 48px is 825px and the hero tagline once wrapped into the side cards because of it.

## 4. Space, grid, radius, lines
4px grid: `--sp-1` 4 … `--sp-40` 160 (28 exists for the testimonial card). Column 1200 inside 1280 with a 20→40px gutter; 12 columns, 16→24px gap. Sections: `--section-y` 72 → 96 (1440) → 112, top and bottom, and every section after the hero opens with a hairline drawn on the column. Radius by size class: `--r-xl` 28 (stacked cards, dialog, newsletter card), `--r-lg` 20 (cards, photos), `--r-md` 14 (buttons, inputs), `--r-full` (chips, avatars). Hairlines are the only separator.

## 5. Motion
Two kinds. **Things that happen** take a rung of the ladder. **Things that turn or stack** are driven by the scroll and have no duration: the arch, the logo's ring of figures in the header, and the stacked cards. Reference: brandappart.com, where everything goes with the scroll.

| Token | Value | For |
|---|---|---|
| `--dur-press` | 100ms | `:active` scale .97 |
| `--dur-state` / `--dur-state-out` | 160 / 240ms | hover, focus, colour; the theme cross-fade |
| `--dur-move` | 280ms | position or size changes, the pile's straighten, the arch card's lift |
| `--dur-reveal` | 360ms | content entering on scroll, the pile's drop |
| `--dur-enter` | 500ms | the dialog, the hero's first paint |

Easings: `--ease-out`, `--ease-in-out`, and two springs as `linear()` (`--ease-pop` for things that just appeared, `--ease-settle` for things that move). Only `transform` and `opacity` animate.

**The flow** (`js/main.js`) is one angle shared by everything that turns. It has a drift, `--flow-drift` 3.75°/s (one revolution of the arch in 96s), plus `--flow-scroll` 0.06° for every pixel scrolled in the scroll's direction; the rendered angle follows that target through an exponential easing with time constant `--flow-settle` 0.32s, so a scroll accelerates the arch and it settles back to the drift. A photograph under the pointer eases the drift to a stop in about half a second and leaving eases it back; a touch holds it for four seconds; off screen it holds. The header logo's ring turns by the scroll part only, so at rest it is still and never reads as a spinner. The stack: a covered card scales from its top edge by 4.5% for each card above it, in step with how far the next card has climbed over it; no state flips, no transitions.

Under `prefers-reduced-motion` the drift and the scroll coupling are zero (the arch is a still picture), the stack does not scale, reveals become short fades, the pile does not drop. There is no pause control: Jayden removed it. Strict WCAG 2.2.2 would want one for the drift; hover-to-stop and the reduced-motion rule are the mitigation.

**The inventory:** hero first paint · the arch (drift, scroll, hover) · the arch card's lift · the header ring · the theme cross-fade · link colour · button press · button hover · reveals · the stack · pile drop and straighten · dialog, sheet and form states. Nothing else moves. Not on the site: parallax, marquees, magnetic buttons, cursor effects, text effects, counters, hover glow, confetti, gradient drift.

## 6. Components
Each is on `styleguide.html` in every state, in both themes.
- **Button** `.btn` + `--primary` / `--secondary` / `--ghost` / `--compact`: 48px (44 compact), `--r-md`, 16px 600. Primary is ink on the ground and inverts on a coloured surface through the tokens. Loading via `aria-busy`.
- **Theme toggle** `.theme` + `data-theme-toggle`: a 44px icon button in the header; the moon offers dark, the sun offers light. Sets `data-theme` on `<html>`, remembers it, and cross-fades every colour over `--dur-state-out`.
- **Chip** `.chip`: 32px, `--r-full`, accent fill with dark text; dark fill with accent text on a coloured surface. Not interactive.
- **Star** `.star`: the logo's four-point star, 16px, in the section's mark tone, before every section label. Nowhere else.
- **Card** `.card` (white on the ground, hairline), `.card--accent` (full-strength hue, `--r-xl`: the stacked cards, the newsletter).
- **Photo** `.photo` + `--4x5` / `--3x2` / `--1x1`: `<figure>` wrapping `<picture>` (AVIF, WebP, JPEG at 320/480/960), blurred placeholder as a background, `object-position` per photograph via `--pos`.
- **Orbit** `.hero` + `.orbit__ring` + `.orbit__item` + `.orbit__card` (the 3px frame, `--c`) + `.orbit__photo`: §7.
- **Stack** `.stack__card`: sticky under the header, each 12px lower than the last (`--i`), scaled by the flow.
- **Pile** `.pile` + `.testimonial`: absolutely placed, `--x --y --rot` per card; a scroll-snap row with a star pager below 1024.
- **Field** `.field` + `.input`: 48px, error in pink hairline with a message, success swaps the button label and draws a check.
- **Dialog** `.dialog`: native `<dialog>` on the orange surface; modal on desktop, a non-modal bottom sheet (≤38vh) on mobile; focus lands on the heading.
- **Sheet** `.sheet`: the mobile menu, from the right.
- **Nav** `.nav` (`data-surface="ink"`): the warm black bar in both themes. The colour logo and the wordmark on the left; Home, Gallery, Contact, the theme toggle and Subscribe on the right; on phones the links and Subscribe move into the sheet.
- **Footer** `.footer`: the mark, one line, ©, then Menu and Contact columns as words.

## 7. The arch
```
--hero-h: clamp(640px, 100svh, 960px), under the 64px header
--r:  min(48vw, (hero-h − 40px) / 1.29)      ring radius (667 at 1440×900; 52vw under 1200px wide)
--cw: r × .32                                  card width, 4:5 → 213×267 at 1440×900, in a 3px frame
ring centre: (50%, hero-h − .08r)              the bottom of the circle is below the fold
--k: .4                                        lean = .4 × the signed angle from the top
--n: 14                                        slots, 25.7° apart; card height .4r < arc step .45r, so cards never touch
visible while |angle| ≤ 80°, faded out by 92°
copy: bottom-anchored, 24px above the fold     the lowest, widest part of the arch on every screen height
mobile: r 340, cw 128, ring centre 500px, visible to 34°, gone by 46°, copy from 356px
```
The position of every card is set each frame from the flow's angle: `rotate(s) translateY(−r) rotate(−(1−k)·s)` with `s` the signed angle, so both halves lean into the arch. The `orbit` gate steps a full slot at six viewports and requires zero card pixels under copy, zero card-on-card overlap, zero repeats, the top card at least 88px down, that a hovered photograph stops the drift and leaving resumes it, and that 300px of scroll turns the arch by more than the drift would.

## 8. Photography
Every photograph has a factual `alt`, explicit dimensions, `loading="lazy"` except the first five arch cards, and a crop set by looking at it at its rendered size (`tools/gates` has no crop gate; the contact sheet is a scratch script and the eye). Colour and B&W are never mixed by conversion; in the arch no two B&W cards are adjacent. A face cut by the frame's edge is a reason to change the crop or the photograph. Children's faces need releases confirmed with Linda. The pipeline is `tools/build-images.mjs`; the source folder is gitignored.

## 9. Copy
Only sentences from the old site. Labels may be single words or phrases from them. Placeholders are lorem with `data-placeholder="true"`. The `copy` gate fails on any other string.

## 10. Gates
`tools/gates/run-all.sh` runs them serially: layout, targets, contrast (both themes), copy, images, motion, orbit, dialog, a11y (both themes). Each exits non-zero on failure and prints the number it measured. `orbit.mjs --self-test` injects an overlap and must fail.
