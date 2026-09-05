# Developmental Improvisation — design system

For anyone building the next page. Every rule has a reason. If you cannot say what an element is *for*, delete it. The live version of every component is `styleguide.html`; the tokens are `css/tokens.css`, the only file allowed to contain raw values.

## 1. Principles
1. **Premium is subtraction.** Take something away before adding anything. Three thin sections at the foot of the page became one field; four photograph shapes became one.
2. **Counting is not looking.** Measure, then open the screenshot. Every gate in `tools/gates/` exists because a number once lied.
3. **The fundamentals carry the design.** The corner geometry, the column, the type scale, the colour order and the single photograph shape *are* the design. No illustrations, no gradients, no shadows, no texture.
4. **The palette is the logo, read literally.** Sky is the monogram; six arcs ring it. The page spends the six once each in ring order and closes on sky.
5. **Two themes, one palette.** Light is the default; dark is the visitor's choice, applied before first paint.
6. **Motion is one shared value.** The gallery, the ring and the stack all read the flow. Everything else takes a rung of the ladder.
7. **Copy is verbatim from the old site**, and only what the page needs.
8. **44px targets and 4.5:1 contrast, measured, in both themes.**

## 2. Corners
Every rounded thing uses `corner-shape: squircle` beside its `border-radius` — a superellipse, not a circular arc, so the radius enters and leaves the straight edge without a curvature break. It is one declaration on `*`, and it is the same `--corner` token Jayden's portfolio uses on every control.

```css
* { corner-shape: var(--corner); }
.arrow, .photo--circle, .voice__avatar, .label::before { corner-shape: round; }
```
The second rule is load-bearing: `corner-shape` applies to a 50% radius too, so **anything meant to be a circle must opt back out** or it becomes a squircle. The ring's photographs shipped as rounded squares for exactly this reason before the rule existed. Chrome 139+ honours the property; other engines fall back to the plain arc.

| Radius | px | For |
|---|---|---|
| `--r-xl` | 36 | the stacked cards, the dialog, the closing field |
| `--r-lg` | 28 | cards, photographs |
| `--r-md` | 20 | small tiles |
| `--r-sm` | 14 | buttons, inputs |
| `--r-full` | ∞ | avatars, the arrows (with `corner-shape: round`) |

## 3. Colour
Open `assets/logo/inline-logo.html` and read the fills — that is the palette and it has a structure. The **monogram** is sky. **Six arcs** ring it, clockwise from the top: magenta, violet, orange, green, pink, yellow.

| Role | Token | Value |
|---|---|---|
| the mark | `--c-sky` | #58CDFC — warm black on it, 9.6:1 |
| arc 1 | `--c-magenta` | #E744E2 |
| arc 2 | `--c-violet` | #7358FC |
| arc 3 | `--c-orange` | #F0895B |
| arc 4 | `--c-green` | #51E596 |
| arc 5 | `--c-pink` | #FB9BC9 |
| arc 6 | `--c-yellow` | #FEE79B |

**The order is the system.** Gallery label (magenta) → the four stacked cards (violet, orange, green, pink) → the testimonials tile (yellow) → the closing field (sky, full strength). Each arc appears once. Never two adjacent surfaces the same, never a hue out of order.

A hue reaches the page **two ways and no others**:
- **A wash** — the hue mixed into the raised ground, flat, behind a card: `color-mix(in oklab, var(--accent) var(--wash-mix), var(--bg-raised))`, mixed on the element that carries `data-accent` (mixing at `:root` resolves once and every card comes out the same colour — that bug shipped). **Each hue sets its own `--wash-mix`**: magenta 14, violet 14, sky 20, orange 22, green 26, pink 26, yellow 46. The seven are nowhere near equally dark and one mix for all of them makes magenta a colour and yellow a rumour. In dark every mix is 20–24%: above about 26% the lighter hues become a mid ground and strand `--ink-2` on them at 3.5:1.
- **One field** — the closing block, sky at full strength. Its background does not follow the theme, so **its ink tokens are rebound for that subtree** (`--ink: #1B1916` and two tiers), which keeps every component inside it correct in both themes.

No gradients. No coloured text. No hue as a border.

| Token | Light | Dark |
|---|---|---|
| `--bg` / `--bg-raised` / `--bg-sunken` | #F7F5F0 / #FFFFFF / #EFECE5 | #131211 / #1C1A18 / #0E0D0C |
| `--ink` / `--ink-2` / `--ink-3` | #1B1916 / #514C45 / #736D64 | #F4F1EB / 74% / 58% |
| `--line` / `--line-strong` | ink 10% / 20% | off-white 12% / 22% |

## 4. Type
**Sen** — 800 for the display, 700 for titles — over **Plus Jakarta Sans** 400/600. Sen is one variable latin file, 18KB, every weight from 400 to 800. They share a geometry, which is why the pair reads as one voice rather than two families.

| Role | Size (390 → 1440) | Leading | Tracking | Face |
|---|---|---|---|---|
| display | 44 → 96 | 1.02 | −0.04em | Sen 800 |
| h1 | 36 → 60 | 1.04 | −0.035em | Sen 800 |
| h2 | 28 → 44 | 1.08 | −0.03em | Sen 700 |
| h3 | 20 → 26 | 1.16 | −0.02em | Sen 700 |
| lead | 17 → 20 | 1.45 | −0.01em | Jakarta 400 |
| body | 15 → 16 | 1.58 | 0 | Jakarta 400 |
| label | 12 | 1 | +0.06em, uppercase | Jakarta 600 |
| caption | 13 | 1.4 | +0.005em | Jakarta 400 |

The headline is five lines at every width by design. Measures are in `em`, never `ch`.

## 5. Space and the column
The page used to put a 1280 column inside a 40px gutter and read as a strip floating in dead space. Now: `--page-max` 1400, `--gutter` `clamp(16px, 2vw, 32px)` — content starts 49px from the edge at 1440, not 120px — `--grid-gap` `clamp(12px, 1.1vw, 20px)`, `--section-y` `clamp(56px, 2.2vw + 32px, 88px)`, `--card-pad` `clamp(20px, 2.2vw, 40px)`. Everything lays out on the same twelve columns (`.grid`; six below 768). The gallery is the one thing that leaves the column: it bleeds off both edges. Hairlines are inset rims (`box-shadow: inset 0 0 0 1px`), never borders, so they never change an element's box.

## 6. Motion
**Things that happen** take a rung: `--dur-press` 100 · `--dur-state` 160 · `--dur-state-out` 240 · `--dur-move` 280 · `--dur-reveal` 360 · `--dur-enter` 500. **Things that turn, slide or stack** read one shared value and have no duration.

**The flow** (`js/main.js`) is one angle: a drift of `--flow-drift` 3.75°/s plus `--flow-scroll` 0.06° per pixel scrolled, following its target through an exponential easing with time constant `--flow-settle` 0.32s. The gallery moves `--strip-px` 6px per degree (22px/s at rest, one card every 15s); the arrows step exactly one card with a time-based ease (τ 110ms); dragging moves it directly, and the pointer is captured only past 6px so a plain click still reaches the photograph. The ring places eight photographs at the angle plus 45° each, upright. A photograph under the pointer eases the drift to a stop in about half a second; a touch holds it four seconds; when neither the gallery nor the ring is on screen the flow holds and scroll deltas are dropped, so nothing whooshes on arrival. The stack scales a covered card from its top edge by 4.5% per card above it.

The theme swap is one 240ms cross-fade of the whole document. Only `transform` and `opacity` animate. Under `prefers-reduced-motion` the drift and the coupling are zero, the stack does not scale, reveals become short fades. There is no pause control: Jayden removed it; hover-to-stop and the reduced-motion rule are the mitigation.

## 7. Photographs — one shape
Every photograph on the page is a **4:5 rectangle with the same superellipse corner**. The **circle** is the single exception and it belongs to the quote ring. That is the whole vocabulary; a mixed set of four shapes was built and rejected.

`<figure class="photo">` wrapping a `.photo__open` button wrapping `<picture>`: AVIF, WebP and JPEG at **160/320/480/960** on the page and 1440 in the lightbox, a blurred 24px placeholder as the background, `object-position` per photograph via `--pos`. The 160 exists because a 76px circle should not pull a 320px file. Factual `alt` on every one; `loading="lazy"` except the hero and the first five gallery cards.

Two rules learned by looking: **a photograph inside a circle needs its subject at the centre and no dark ground** — linda-portrait and kids-bw-small read as black discs and were pulled from the ring — and **the hero's photograph is not in the gallery**, which is 300px below it.

## 8. The page
1. **Hero** — the headline on the left seven columns at display size, one 4:5 photograph on the right four, and one row under the type with the tagline and one button.
2. **Gallery** — edge to edge under the hero: twelve photographs on a looping track, the label and two arrows on the column above.
3. **The four cards** — sticky, each 10px lower than the last, scaled by the flow as the next covers them. One hue and one photograph each, the photograph sized by height so a 4:5 frame cannot stretch the card past the text. Even cards mirror, and **both children are pinned to `grid-row: 1`** — grid's forward-only auto-placement otherwise drops the mirrored figure to a second row and doubles the card.
4. **The quote ring** — eight circular photographs turning around the quote. The one section Jayden asked to keep.
5. **Testimonials** — three tiles, the middle washed yellow, the others the raised ground with a hairline.
6. **The closing field** — the sign-up, the two contact links and the copyright in one sky field, inset by the gutter.

## 9. Components
`.btn` (primary/secondary/ghost/compact, 46px, `--r-sm`) · `.arrow` (44px circle) · `.theme` (the toggle; the choice is applied before first paint by an inline script, so there is no flash) · `.card` / `.card--wash` / `.card--line` · `.photo` (+ `--4x5`, `--1x1`, `--circle`) · `.label` (12px caps with a dot in the section's hue) · `.field` / `.input` · `.nav` (transparent, glass once scrolled; no Home link — the logo is the way home) · `.sheet` · `.dialog` · `.lightbox`. Each is on `styleguide.html` in both themes.

## 10. Gates
`tools/gates/run-all.sh`, serially, 35 lines: layout (overflow, headline lines, the column, equal card widths) · targets · contrast (every visible text node, both themes) · copy · images · motion · ring (the ring and the gallery) · lightbox · dialog · a11y. `ring.mjs --self-test` shrinks the ring and must fail; `contrast.mjs --self-test` paints the ink onto the ground and must fail. Every gate but `dialog` starts with the newsletter popup already marked shown. Serve from `di-site/` on `127.0.0.1:4611`, never `localhost`.
