# Developmental Improvisation — Design System

> Import into Notion: Settings & members → Import → Markdown & CSV, or drop this file onto a page. Tables import as tables; the quoted lines become callouts. The live version of every component is `styleguide.html`; the tokens are `css/tokens.css`.

## Principles
> Premium is subtraction. Take something away before adding anything. Three thin sections at the foot of the page became one field; four photograph shapes became one.

> Counting is not looking. Measure, then open the screenshot. Every gate in `tools/gates/` exists because a number once lied.

> The fundamentals carry the design. The corner geometry, the column, the type scale, the colour order and the single photograph shape *are* the design. No illustrations, no gradients, no shadows, no texture.

> The palette is the logo, read literally, at full strength. Sky is the monogram, gold is the star, six arcs ring them. Eight colours, each used as itself — never mixed into the ground.

5. **Two themes, one palette. Dark is the default**; light is the visitor's choice, applied before first paint. The saturated hues and the photographs sit better on near-black, and Jayden asked for the ground that pops.
> Motion is one shared value. The gallery, the ring and the stack all read the flow. Everything else takes a rung of the ladder.

7. **Copy is verbatim from the old site**, and only what the page needs.
8. **44px targets and 4.5:1 contrast, measured, in both themes.**

## Corners
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

## Colour
Open `assets/logo/inline-logo.html` and read the fills — that is the palette, all eight of it, and it has a structure. The **monogram** is sky, the **star** is gold, and **six arcs** ring the monogram: clockwise from the top, magenta, violet, orange, green, pink, yellow.

| Role | Token | Value | Ink on it |
|---|---|---|---|
| the mark | `--c-sky` | #58CDFC | warm black, 9.6:1 |
| the star | `--c-gold` | #FFE469 | warm black |
| arc 1 | `--c-magenta` | #E744E2 | warm black, 5.2:1 |
| arc 2 | `--c-violet` | #7358FC | **white**, 4.6:1 — warm black is 3.7:1 |
| arc 3 | `--c-orange` | #F0895B | warm black, 6.9:1 |
| arc 4 | `--c-green` | #51E596 | warm black, 10.7:1 |
| arc 5 | `--c-pink` | #FB9BC9 | warm black, 8.7:1 |
| arc 6 | `--c-yellow` | #FEE79B | warm black, 14.1:1 |

**A hue is full strength or it is not there.** No mixes, no tints, no washes — those were built twice and rejected, because a hue mixed into the ground is no longer the brand colour and shifts again between the themes. A hue reaches the page as a surface at 100%, and the ink on it is `--on-accent`. On a solid surface **every** text tier goes to `--on-accent`: a translucent tier over a saturated hue reads as dirt, not as hierarchy. Because a full-strength hue is identical in both themes, the surfaces carrying one rebind their ink tokens for that subtree instead of following the theme — that is what makes the palette read the same in light and dark.

**The order is the system.** Sky and gold as the two tiles in the hero's bento → violet, orange, green, pink as the panels behind the four cards' photographs → magenta, gold, green on the testimonials → sky as the closing field and the curtain. Colour is spare: four full-strength cards were built and pulled back the same day because they flooded the page.

No gradients. No coloured text. No hue as a border. No coloured dot before a label — that was removed.

| Token | Light | Dark |
|---|---|---|
| `--bg` / `--bg-raised` / `--bg-sunken` | #F0ECE3 / #FFFFFF / #E5E0D5 | #131211 / #1C1A18 / #0E0D0C |
| `--ink` / `--ink-2` / `--ink-3` | #1B1916 / #514C45 / #6C665D | #F4F1EB / 74% / 58% |
| `--line` / `--line-strong` | ink 12% / 22% | off-white 12% / 22% |

## Type
**Sen** — 800 for the display, 700 for titles — over **Plus Jakarta Sans** 400/600. Sen is one variable latin file, 18KB, every weight from 400 to 800. They share a geometry, which is why the pair reads as one voice rather than two families.

| Role | Size (390 → 1440) | Leading | Tracking | Face |
|---|---|---|---|---|
| display | 38 → 76 | 1.04 | −0.038em | Sen 800 |
| h1 | 36 → 60 | 1.04 | −0.035em | Sen 800 |
| h2 | 28 → 44 | 1.08 | −0.03em | Sen 700 |
| h3 | 20 → 26 | 1.16 | −0.02em | Sen 700 |
| lead | 17 → 20 | 1.45 | −0.01em | Jakarta 400 |
| body | 15 → 16 | 1.58 | 0 | Jakarta 400 |
| label | 12 | 1 | +0.06em, uppercase | Jakarta 600 |
| caption | 13 | 1.4 | +0.005em | Jakarta 400 |

The headline is five lines at every width by design. Measures are in `em`, never `ch`.

## Space and the column
The page used to put a 1280 column inside a 40px gutter and read as a strip floating in dead space. Now: `--page-max` 1720, `--gutter` `clamp(16px, 2vw, 36px)` — content starts 29px from the edge at 1440, not 120px — `--grid-gap` `clamp(12px, 1.1vw, 20px)`, `--section-y` `clamp(56px, 2.2vw + 32px, 88px)`, `--card-pad` `clamp(20px, 2.2vw, 40px)`. Everything lays out on the same twelve columns (`.grid`; six below 768). The column is wide enough (`--page-max` 1720) that on a laptop the page IS the screen minus one small even inset, which is what puts the big surfaces a short spacing from the outer edge instead of inside a narrow centred strip. Hairlines are inset rims (`box-shadow: inset 0 0 0 1px`), never borders, so they never change an element's box.

## Motion
**Things that happen** take a rung: `--dur-press` 100 · `--dur-state` 160 · `--dur-state-out` 240 · `--dur-move` 280 · `--dur-reveal` 360 · `--dur-enter` 500. **Things that turn, slide or stack** read one shared value and have no duration.

**The flow** (`js/main.js`) is one angle: a drift of `--flow-drift` 3.75°/s plus `--flow-scroll` 0.06° per pixel scrolled, following its target through an exponential easing with time constant `--flow-settle` 0.32s. The gallery moves `--strip-px` 6px per degree (22px/s at rest, one card every 15s); the arrows step exactly one card with a time-based ease (τ 110ms); dragging moves it directly, and the pointer is captured only past 6px so a plain click still reaches the photograph. The ring places eight photographs at the angle plus 45° each, upright. A photograph under the pointer eases the drift to a stop in about half a second; a touch holds it four seconds; when neither the gallery nor the ring is on screen the flow holds and scroll deltas are dropped, so nothing whooshes on arrival. The stack scales a covered card from its top edge by 4.5% per card above it.

The theme swap is one 240ms cross-fade of the whole document. Only `transform` and `opacity` animate. Under `prefers-reduced-motion` the drift and the coupling are zero, the stack does not scale, reveals become short fades. There is no pause control: Jayden removed it; hover-to-stop and the reduced-motion rule are the mitigation.

## Photographs — one shape
Every photograph on the page is a **4:5 rectangle with the same superellipse corner**. The **circle** is the single exception and it belongs to the quote ring. That is the whole vocabulary; a mixed set of four shapes was built and rejected.

`<figure class="photo">` wrapping a `.photo__open` button wrapping `<picture>`: AVIF, WebP and JPEG at **160/320/480/960** on the page and 1440 in the lightbox, a blurred 24px placeholder as the background, `object-position` per photograph via `--pos`. The 160 exists because a 76px circle should not pull a 320px file. Factual `alt` on every one; `loading="lazy"` except the hero and the first five gallery cards.

Two rules learned by looking: **a photograph inside a circle needs its subject at the centre and no dark ground** — linda-portrait and kids-bw-small read as black discs and were pulled from the ring — and **the hero's photograph is not in the gallery**, which is 300px below it.

## The page
**The curtain** comes first, on the first load of a session only: two panels of **violet** over the page with the colour mark and a loading bar while the fonts and the hero's first photographs arrive, then they part, bunching slightly as they go. Violet and not the brand's sky because the mark is drawn in sky — on a sky ground its letterforms vanish and only the ring of arcs survives. The pleats are two repeating gradients at different pitches so the repeat is long enough that the eye does not find the seam, plus a dark fold where the panels meet: without it the two patterns collide and draw a bright line. No scrim, no darkening — the site is already laid out behind them. A 620ms floor so it reads as deliberate, a 2600ms hard failsafe so nothing can strand the site, removed from the DOM a second after it opens, never on a reload in the same session, never under reduced motion.

> Hero, with the gallery inside it, filling the screen (`min-height: 100svh`). The headline on the left six columns at display size; the right six are a **bento** — three columns of 4:5 photographs plus two tiles of pure colour, looping vertically with the flow, adjacent columns in opposite directions at three speeds (`--speed` per column), the block masked top and bottom so the photographs fade in and out of the ground rather than stopping at an edge. Each column carries its contents twice and `[data-mid]` marks the loop length; every tile has an intrinsic ratio, so that length is stable before the images load. Under the headline, one row with the tagline and one button.

> The four cards — sticky, each 10px lower than the last, scaled by the flow as the next covers them. The card is the raised ground with a hairline; its hue is the **solid panel holding the photograph**, the same tile-and-photograph pairing the bento uses. The photograph is sized by height so a 4:5 frame cannot stretch the card past the text. Even cards mirror, and **both children are pinned to `grid-row: 1`** — grid's forward-only auto-placement otherwise drops the mirrored figure to a second row and doubles the card.

> The quote ring — eight circular photographs turning around the quote. The one section Jayden asked to keep.

> Testimonials — a centred label, then three cards, each a full-strength hue: a large quote mark at 26% of the card's ink, the quote, and the person in a **nested white card that overhangs the bottom-left corner**. The depth comes from the nesting, not from a shadow.

> The closing field — the sign-up, the two contact links and the copyright in one sky field, inset by the gutter.


## Components
`.btn` (primary/secondary/ghost/compact, 46px, `--r-sm`) · `.arrow` (44px circle) · `.theme` (the toggle; the choice is applied before first paint by an inline script, so there is no flash) · `.card` / `.card--solid` / `.card--line` / `.tile` · `.photo` (+ `--4x5`, `--1x1`, `--circle`) · `.label` (12px caps, no dot) · `.field` / `.input` · `.nav` (transparent, glass once scrolled; no Home link — the logo is the way home) · `.sheet` · `.dialog` · `.lightbox`. Each is on `styleguide.html` in both themes.

## Gates
`tools/gates/run-all.sh`, serially, 37 lines: layout (overflow, headline lines, the column, equal card widths) · targets · contrast (every visible text node, both themes) · copy · images · motion · ring (the ring and the bento) · lightbox · dialog · curtain · a11y. Three self-tests, each of which must fail: `ring.mjs` shrinks the ring, `contrast.mjs` paints the ink onto the ground, `curtain.mjs` pins the curtain so it can neither travel nor be removed. Every gate but `dialog` starts with the newsletter popup already shown, and every gate but `curtain` starts past the curtain. Serve from `di-site/` on `127.0.0.1:4611`, never `localhost`.

