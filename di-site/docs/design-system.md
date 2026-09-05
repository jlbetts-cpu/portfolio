# Developmental Improvisation — design system

For anyone building the next page (Gallery, Contact, About). Every rule has a reason. If you cannot say what an element is *for*, delete it. The live version of every component is `styleguide.html`; the tokens are `css/tokens.css`, the only file allowed to contain raw values.

## 1. Principles
1. **Premium is subtraction.** When a screen feels wrong, remove something before adding something.
2. **Counting is not looking.** Measure, then open the screenshot. Every gate in `tools/gates/` exists because a number once lied.
3. **One typeface, two weights, no italics, no gradient text.** Hierarchy is size, weight, leading, tracking and ink tier.
4. **Colour lives on shapes and cards. Text is white or a white tier** — except inside a coloured card, where the surface tokens flip it to dark.
5. **No shadows. No gradients.** Depth is a lighter surface plus a hairline. The photographs are the only colour fields on the dark ground.
6. **Flat vectors only.** The star and the figure come from the logo file, unchanged. Nothing else is drawn.
7. **Motion is a system.** Six rungs, two loops, two springs. Everything moving longer than five seconds has a pause control.
8. **Copy is verbatim from the old site.** Placeholders carry `data-placeholder="true"`.
9. **44px targets, measured.** The `targets` gate prints the smallest.
10. **Every interruption is polite.** The newsletter dialog waits for both 40% scroll and ten seconds, once per session, thirty days after a dismissal.

## 2. Colour
The seven hues inside the logo are the palette. On the dark ground they are small things: chips, the star marker, the focus ring, initials. At full strength they are the four stacked cards. Nothing else is coloured.

| Token | Hex | Dark ink | Use |
|---|---|---|---|
| `--c-green` | #51E596 | 11.0:1 | stack card (02), chips, stars |
| `--c-sky` | #58CDFC | 9.8:1 | stack card (01), focus ring, chips |
| `--c-violet` | #7358FC | 3.8:1 → **white ink 4.6:1** | stack card (04) only; never a chip, never text |
| `--c-magenta` | #E744E2 | 5.4:1 | reserved; not a surface in v1 |
| `--c-orange` | #F0895B | 7.1:1 | stars, initials |
| `--c-pink` | #FB9BC9 | 9.0:1 | stars, initials |
| `--c-yellow` | #FEE79B | 14.5:1 | stack card (03), chips |

Ground: `--bg #181818`, `--bg-raised #212121` (cards, nav), `--bg-overlay #262626` (dialog, inputs). Hairline `--line` white 8%, `--line-strong` 16%. Ink: `--ink` white, `--ink-2` 72%, `--ink-3` 48% (never below 13px). Tints `--t-*` are each hue at 16% over the ground, for the one large dark coloured surface (the newsletter card).

**Accents.** A section sets `data-accent="sky|green|yellow|violet|orange|pink"` once; every component inside reads `--accent`. The order down the home page is sky → green → yellow → violet (the stack) → pink (quote) → orange (testimonials) → sky (newsletter) → green (contact). Never two adjacent sections the same.

**Coloured surfaces.** `data-surface="accent"` paints the accent and flips the tokens: `--ink` becomes `--accent-ink` (dark, or white on violet), `--ink-2` 78%, `--ink-3` 72% (both ≥ 4.7:1 on the palest hue), hairlines become dark, the focus ring becomes dark, the primary button and chips invert. On violet there are no ink tiers — everything is pure white, because white on violet is 4.6:1 and has no room to fade.

## 3. Type
Plus Jakarta Sans, 400 and 600, self-hosted latin subsets, `font-display: swap` with a size-adjusted fallback so the swap does not move layout. Chosen from eight faces rendered on the dark ground: the tallest x-height of the warm geometrics (0.536 em), so 14px holds on dark; angled `t` and `y` give it identity without novelty.

| Role | Size (390 → 1440) | Leading | Tracking | Weight | Colour |
|---|---|---|---|---|---|
| display | 32 → 48 (hero tagline; capped by hero height) | 1.04 | −0.03em | 600 | ink |
| h1 | 36 → 60 | 1.06 | −0.025em | 600 | ink |
| h2 | 28 → 44 | 1.1 | −0.02em | 600 | ink |
| h3 | 22 → 26 | 1.2 | −0.01em | 600 | ink |
| lead | 18 → 21 | 1.45 | −0.005em | 400 | ink-2 |
| body | 16 → 17 | 1.6 | 0 | 400 | ink-2 (first paragraph ink) |
| small | 14 | 1.5 | +0.005em | 600 for labels | ink-2 |
| caption | 13 | 1.4 | +0.01em | 400 | ink-3 |

Measures are in `em`: display 14em, sub 24em, h2 16em, body 34em. **Never `ch`** — this face's zero is 0.685em wide, so `24ch` at 48px is 825px and the hero tagline once wrapped into the side cards because of it.

## 4. Space, grid, radius, lines
4px grid: `--sp-1` 4 … `--sp-40` 160 (28 exists for the testimonial card). Column 1200 inside 1280 with a 20→40px gutter; 12 columns, 16→24px gap. Sections: `--section-y` 72 → 96 (1440) → 112, top and bottom, and every section after the hero opens with a hairline drawn on the column. Radius by size class: `--r-xl` 28 (stacked cards, dialog, newsletter card), `--r-lg` 20 (cards, photos), `--r-md` 14 (buttons, inputs), `--r-full` (chips, avatars). Hairlines are the only separator.

## 5. Motion
| Token | Value | For |
|---|---|---|
| `--dur-press` | 100ms | `:active` scale .97 |
| `--dur-state` / `--dur-state-out` | 160 / 240ms | hover, focus, colour |
| `--dur-move` | 280ms | position or size changes, the stack's recede, the pile's straighten |
| `--dur-reveal` | 360ms | content entering on scroll, the pile's drop |
| `--dur-enter` | 500ms | the dialog, the hero's first paint |
| `--dur-orbit` | 96s | the arch and the logo's ring, one revolution |
| `--dur-bob` | 3.2s | the figures |

Easings: `--ease-out`, `--ease-in-out`, and two springs as `linear()` (`--ease-pop` for things that just appeared, `--ease-settle` for things that move). Only `transform` and `opacity` animate. Under `prefers-reduced-motion` the loops hold their first frame, reveals become fades, the stack does not tilt, the pile does not drop.

**The inventory, all twelve:** hero first paint · the arch (pause on hover, touch, control) · the arch card lift · nav surface on scroll · link colour · button press · button hover · reveals · figures bob (pause control) · stack recede · pile drop and straighten · dialog, sheet and form states. Nothing else moves. Not on the site: parallax, scrubbing, marquees, magnetic buttons, cursor effects, text effects, counters, hover glow, confetti, gradient drift.

## 6. Components
Each is on `styleguide.html` in every state.
- **Button** `.btn` + `--primary` / `--secondary` / `--ghost` / `--compact`: 48px (44 compact), `--r-md`, 16px 600. Loading via `aria-busy`. Inverts on a coloured surface through the tokens.
- **Chip** `.chip`: 32px, `--r-full`, accent fill with dark text; dark fill with accent text on a coloured surface. Not interactive.
- **Star** `.star`: the logo's four-point star, 16px, in the section's accent, before every section label. It replaced the dot. Nowhere else.
- **Card** `.card`, `.card--tint` (16% accent over the ground), `.card--accent` (full-strength, `--r-xl`, the stacked cards).
- **Photo** `.photo` + `--4x5` / `--3x2` / `--1x1`: `<figure>` wrapping `<picture>` (AVIF, WebP, JPEG at 320/480/960), blurred placeholder as a background, `object-position` per photograph via `--pos`, caption outside the image, never overlaid.
- **Orbit** `.hero` + `.orbit__ring` + `.orbit__item` + `.orbit__card`: §7.
- **Figures** `.figures`: the logo's figure repeated, arms touching, six hues cycling, 2px bob, pause control.
- **Stack** `.stack__card`: sticky under the nav; the card beneath recedes (`rotateX(6deg) scale(.96)`, opacity .9).
- **Pile** `.pile` + `.testimonial`: absolutely placed, `--x --y --rot` per card; a scroll-snap row with a star pager below 1024.
- **Field** `.field` + `.input`: 48px, error in pink hairline with a message, success swaps the button label and draws a check.
- **Dialog** `.dialog`: native `<dialog>`; modal on desktop, a non-modal bottom sheet (≤38vh) on mobile; focus lands on the heading.
- **Sheet** `.sheet`: the mobile menu, from the right.
- **Nav** `.nav`: transparent, then glass with a hairline after 24px. The full white mark and the wordmark in the type.
- **Footer** `.footer`: the mark, one line, ©, then Menu and Contact columns as words.

## 7. The arch
```
--hero-h: clamp(640px, 100svh, 960px)
--r:  min(48vw, (hero-h − 88px) / 1.29)      ring radius (the top card lands 94px down at 1440×900)
--cw: r × .32                                  card width, 4:5
ring centre: (50%, hero-h − .08r)              the bottom of the circle is below the fold
--k: .4                                        tilt = .4 × angle — the cards follow the arch without turning faces sideways
--n: 14                                        slots, 25.7° apart; card height .4r < arc step .45r, so cards never touch
visible while |angle| ≤ 80°, faded out by 92°
copy block top: hero-h − .88r + 24px           anchored to the top card's inner edge
mobile: r 360, cw 116, ring centre 532px, visible to 42°, copy from 300px
```
Per-item keyframes with a negative delay of `i/n × 96s`; the logo's ring of figures turns at the same rate. The `orbit` gate steps a full slot and requires zero card pixels under copy, zero card-on-card overlap, zero repeats, the top card at least 88px down, and that hover pauses everything.

## 8. Photography
Every photograph has a factual `alt`, explicit dimensions, `loading="lazy"` except the first five arch cards, and a crop set by looking at it at its rendered size. Colour and B&W are never mixed by conversion; in the arch no two B&W cards are adjacent. Children's faces need releases confirmed with Linda. The pipeline is `tools/build-images.mjs`; the source folder is gitignored.

## 9. Copy
Only sentences from the old site. Labels may be single words or phrases from them. Placeholders are lorem with `data-placeholder="true"`. The `copy` gate fails on any other string.

## 10. Gates
`tools/gates/run-all.sh` runs them serially: layout, targets, contrast, copy, images, motion, orbit, dialog, a11y. Each exits non-zero on failure and prints the number it measured. `orbit.mjs --self-test` injects an overlap and must fail.
