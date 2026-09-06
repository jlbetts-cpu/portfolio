# Developmental Improvisation — design system

For anyone building the next page. Every rule has a reason. If you cannot say what an element is *for*, delete it. The live version of every component is `styleguide.html`; the tokens are `css/tokens.css`, the only file allowed to contain raw values.

## 1. Principles
1. **Premium is subtraction.** Take something away before adding anything. Three thin sections at the foot of the page became one field; four photograph shapes became one.
2. **Counting is not looking.** Measure, then open the screenshot. Every gate in `tools/gates/` exists because a number once lied.
3. **The fundamentals carry the design.** The corner geometry, the column, the type scale, the colour order and the single photograph shape *are* the design. No illustrations, no gradients, no shadows, no texture.
4. **The palette is the logo, read literally.** Sky is the monogram, gold is the star, six arcs ring them. Eight hues, in the logo's own order, each used as itself — at full strength on the dark ground, and at one held lightness on the light one.
5. **Two themes, one palette. Dark is the default**; light is the visitor's choice, applied before first paint. The saturated hues and the photographs sit better on near-black, and Jayden asked for the ground that pops.
6. **The page is one bento field.** Header tiles, hero panels, cards, testimonials and the closing field all sit on the same twelve columns at the same gutter, separated by the same `--grid-gap`. There are no bands and no floating strips; the one break in the field is the ring.
7. **Motion is one shared value.** The gallery and the ring read the flow. Everything else takes a rung of the ladder.
8. **Copy is verbatim from the old site**, and only what the page needs.
9. **44px targets and 4.5:1 contrast, measured, in both themes.**

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
Open `assets/logo/inline-logo.html` and read the fills — that is the palette, all eight of it, and it has a structure. The **monogram** is sky, the **star** is gold, and **six arcs** ring the monogram: clockwise from the top, magenta, violet, orange, green, pink, yellow.

**One palette, held at two strengths.** The hue angles are the logo's and never change. On the **dark** ground each is the fill straight out of the SVG — a saturated hue needs a near-black ground to sit on. On the **light** ground each is taken to **OKLCH L .885** with the chroma that hue can carry there (C ≤ .105), which is the same colour reading as a tint of the brand instead of a signal flare on cream. Jayden asked for this after seeing the full-strength set on the off-white page; it is a deliberate reopening of the older "no mixes" rule, and it is bounded — the *only* place a hue is anything but its own fill is the light theme's own token block.

| Role | Token | Light (L .885) | Dark (full) | Ink on it |
|---|---|---|---|---|
| the mark, 227.9° | `--c-sky` | #A8E3FE | #58CDFC | warm black, 12.6 / 9.6:1 |
| the star, 97.0° | `--c-gold` | #ECDA87 | #FFE469 | warm black |
| arc 1, 329.3° | `--c-magenta` | #FEC2F9 | #E744E2 | warm black, 11.9 / 5.2:1 |
| arc 2, 284.1° | `--c-violet` | #D4D5FE | #7358FC | warm black light, **white** dark (4.6:1) |
| arc 3, 44.1° | `--c-orange` | #FECDB8 | #F0895B | warm black, 12.2 / 6.9:1 |
| arc 4, 156.0° | `--c-green` | #9EEEBC | #51E596 | warm black, 12.9 / 10.7:1 |
| arc 5, 350.2° | `--c-pink` | #FFC7E0 | #FB9BC9 | warm black, 12.1 / 8.7:1 |
| arc 6, 93.2° | `--c-yellow` | #F1D886 | #FEE79B | warm black |

Violet is the one hue whose ink changes with the theme, so it goes through `--on-violet` rather than a literal in the accent block.

**Within a theme a hue is that theme's value or it is not there.** No gradients, no washes, no hue mixed into the ground per surface — those were built twice and rejected. A hue reaches the page as a surface, and the ink on it is `--on-accent`. On such a surface **every** text tier goes to `--on-accent`: a translucent tier over a saturated hue reads as dirt, not as hierarchy. Surfaces carrying a hue rebind their ink tokens for that subtree instead of following the theme.

**The order is the system.** The dark ground on the curtain → gold as the hero's photograph panel → violet, orange, green, pink across the four cards, left to right → magenta, gold, green on the testimonials → sky as the closing field. There are **no blocks of colour among the photographs** — the bento is fifteen pictures and nothing else.

**Colour rests on a panel; on a card it is a state.** Two surfaces carry a hue at rest and they are both structure: the hero's photograph panel and the closing field. Everywhere else the hue arrives on interaction — a card's head fills under the pointer and on focus, and the reader opens on that same hue — or it is a chip rather than a field, as on the testimonials, where the hue is on the person and not on the quote. Four coloured card heads under the hero and three coloured testimonial cards were each, in turn, the loudest thing on the page; the brief is premium first. **Where there is no hover there is no state**: under `@media (hover: none)` the card's hue is simply its resting colour, because a touch screen would otherwise never see the section's colour at all.

No coloured text — a `<mark>` highlight on two words of the headline was built in sky and pink and taken out again; `::selection` keeps that colour for an actual selection, which is the only place it belongs. No hue as a border. No coloured dot before a label — that was removed.

| Token | Light | Dark |
|---|---|---|
| `--bg` / `--bg-raised` / `--bg-sunken` | #FBFAF7 / #F0ECE3 / #E5E0D5 | #131211 / #1C1A18 / #0E0D0C |
| `--ink` / `--ink-2` / `--ink-3` | #1B1916 / #514C45 / #6C665D | #F4F1EB / 74% / 58% |
| `--line` / `--line-strong` | ink 12% / 22% | off-white 12% / 22% |

## 4. Type
**Jost** — 800 for the display, 700 for titles — over **Plus Jakarta Sans** 400/600. Jost is one variable latin file, 25KB, every weight from 100 to 900.

**Why Jost: it is a Futura, and a Futura is what the logo is drawn as.** Open `assets/logo/dibasicblack.svg` and look at the "di": a **perfectly circular bowl** on a straight stem, **one stroke weight** with no contrast, **flat terminals**, and — where the 'd' exits into the 'i' — a single flowing stroke. Jost has the same construction, including the **single-storey 'a'** (a circle and a stem) that the logo's geometry implies. Sen, which this replaced, is a humanist geometric: its bowls are ovals and its terminals are cut on an angle, so beside the mark it read as a near-miss. Poppins matches the construction too and was set beside it; Jost is narrower and quieter, and the headline holds its line count.

Jost's x-height is **0.460em against Sen's 0.488** — 6% smaller at the same size — so it reads a touch airier at the display scale, and the nav's wordmark went 15 → 16px to hold. **The body face does not change**: a small-x-height geometric is a display face, not a reading one, and Plus Jakarta Sans carries every paragraph.

| Role | Token | 1440 | Face |
|---|---|---|---|
| display | `--fs-display` | 76px, `-0.038em`, 1.04 | Jost 800 |
| h1 | `--fs-h1` | 60px | Jost 800 |
| h2 | `--fs-h2` | 44px | Jost 700 |
| h3 | `--fs-h3` | 26px | Jost 700 |
| lead | `--fs-lead` | 20px | Jakarta 400 |
| body | `--fs-body` | 16px, 1.58 | Jakarta 400 |
| small / label / caption | | 14 / 12 / 13px | Jakarta |

Tracking tightens as size grows; leading loosens as it shrinks. Measures are in **em**, never `ch`.

## 5. Space and the column
The page used to put a 1280 column inside a 40px gutter and read as a strip floating in dead space. Now: `--page-max` 1720, `--gutter` `clamp(16px, 2vw, 36px)` — content starts 29px from the edge at 1440, not 120px — `--grid-gap` `clamp(12px, 1.1vw, 20px)`, `--section-y` `clamp(56px, 2.2vw + 32px, 88px)`, `--card-pad` `clamp(20px, 2.2vw, 40px)`. Everything lays out on the same twelve columns (`.grid`; six below 768), and **the vertical rhythm is the same gap**: the header tiles, the hero's two panels, the four cards, the testimonials and the closing field are one continuous field separated by `--grid-gap`, not by section padding. `--section-y` survives in exactly one place — either side of the ring, which is the field's only break. `--field-top` (`--grid-gap` × 2 + `--nav-h`) is what the header row and the gap under it add up to, which is what puts the fold exactly on the field's next gap. The column is wide enough (`--page-max` 1720) that on a laptop the page IS the screen minus one small even inset, which is what puts the big surfaces a short spacing from the outer edge instead of inside a narrow centred strip. Hairlines are inset rims (`box-shadow: inset 0 0 0 1px`), never borders, so they never change an element's box.

**Breakpoints are decided by the element's own width, not the viewport's.** The card row is the case that proves it: it needs a different arrangement in two bands that are not adjacent (1024–1279 and 561–767), because both are where a *card* comes out too wide. A media query list with a comma says exactly that. The same reasoning moved the closing field's two-column split from 768 up to 1024 — at 768 the sign-up card was 334px and its email input 170px, which is not a field, it is a slot — and the input/button pair now stacks below 600 rather than 480.

## 5b. Arrival
Every section enters with intent rather than one flat 12px fade: the ring assembles one circle at a time, the testimonials stagger, the closing field rises. One `IntersectionObserver` drives all of it through `.reveal` and `.reveal--parts`. **Never observe a zero-area element** — the ring's orbit is a 0×0 positioning origin, and an element with no area can never satisfy a `threshold: 0.2`, so the ring simply never appeared; the *stage* is what is observed.

## 6. Motion
**Things that happen** take a rung: `--dur-press` 100 · `--dur-state` 160 · `--dur-state-out` 240 · `--dur-move` 280 · `--dur-reveal` 360 · `--dur-enter` 500. **Things that turn, slide or stack** read one shared value and have no duration.

**The flow** (`js/main.js`) is one angle: a drift of `--flow-drift` 3.75°/s plus `--flow-scroll` 0.06° per pixel scrolled, following its target through an exponential easing with time constant `--flow-settle` 0.32s. The hero's bento columns move `--bento-px` 5px per degree, alternating direction, at three speeds. **A column under the pointer freezes on its own and the wheel scrubs it by hand** while the other columns carry on; the offset it gains is kept when the pointer leaves, so the strip never jumps. 480px of wheel in one direction hands the gesture back to the page rather than trapping it, and a coarse pointer has none of this — there is no hover to start it and a scroll trap on a phone is a broken page. The ring places eight photographs at the angle plus 45° each, upright. A photograph under the pointer eases the drift to a stop in about half a second; a touch holds it four seconds; when neither the gallery nor the ring is on screen the flow holds and scroll deltas are dropped, so nothing whooshes on arrival. **The ring releases its hold when the pointer leaves the orbit, not when it leaves "a photograph"** — the four cards put photographs directly above the ring, and the older guard read those as still-inside and left the flow held for good.

**How every interactive surface answers.** One shape for all of them. A state **arrives in `--dur-state` and leaves in `--dur-state-out`** — fast in, slow out; a hover that snaps back reads as a glitch, one that arrives late reads as lag. The asymmetry travels on `--t`, declared at `:root` and flipped by one `:where(...):hover` list, so a component writes `var(--t)` and never a duration. **A press is always `--dur-press` and is never slowed by it**: `transition-duration` on `:hover` also catches the transform, and since a press only ever happens while hovered, that idiom had killed the press rung on every button on the page. Every control has a press now — buttons, the wordmark, nav links, the three icon buttons, the four cards, and the photographs in the gallery and the ring.

**The arrival hands the element back.** `.js .reveal` declares `transition: opacity/transform var(--dur-reveal)` plus the stagger's `transition-delay`, and it outranks a component's own rule — so while the class stayed on, the fourth card's hover lifted over 360ms **after a 180ms delay**, and its hue, which the reveal's shorthand does not list, never faded at all. The class comes off once the element has landed. `motion.mjs` asserts it, with a self-test that puts the class back.

**One object, one answer.** A card's ground, its lift and its picture all move on the card's hover — the photograph used to scale only when the pointer was on the photograph, so one card had two responses depending on where you landed. The control and its arrow follow 60ms behind on the way in and leave with no delay, so the card resolves as one gesture and never sheds its parts in sequence.

The theme swap is one 240ms cross-fade of the whole document. Only `transform` and `opacity` animate. Under `prefers-reduced-motion` the drift and the coupling are zero, the cards do not lift, reveals become short fades — and the reset has to be written `.js .reveal` to outrank the rule that offsets them, or every revealing element still slides 12px. There is no pause control: Jayden removed it; hover-to-stop and the reduced-motion rule are the mitigation.

## 7. Photographs — one shape
Every photograph on the page is a **4:5 rectangle with the same superellipse corner**. The **circle** is the single exception and it belongs to the quote ring. That is the whole vocabulary; a mixed set of four shapes was built and rejected.

`<figure class="photo">` wrapping a `.photo__open` button wrapping `<picture>`: AVIF, WebP and JPEG at **160/320/480/960** on the page and 1440 in the lightbox, a blurred 24px placeholder as the background, `object-position` per photograph via `--pos`. The 160 exists because a 76px circle should not pull a 320px file. Factual `alt` on every one; `loading="lazy"` except the hero and the first five gallery cards.

Two rules learned by looking: **a photograph inside a circle needs its subject at the centre and no dark ground** — linda-portrait and kids-bw-small read as black discs and were pulled from the ring — and **the hero's photograph is not in the gallery**, which is 300px below it.

## 8. The page
**The curtain** comes first, on the first load of a session only: two **flat** panels of the dark ground (#131211) over the page, with the colour mark and a loading bar, while the fonts and the hero's first photographs arrive. Then they part. Flat and not pleated — the fabric version read as a theatre curtain rather than as this site, and Jayden said it was cleaner when it was not literally a curtain. The panels are 50.5% wide each so the seam cannot show a hairline of the page between them at fractional widths. No scrim, no darkening — the site is already laid out behind them. A 620ms floor so it reads as deliberate, a 2600ms hard failsafe so nothing can strand the site, removed from the DOM a second after it opens, never on a reload in the same session, never under reduced motion.

The page below it is **one bento field**, top to bottom, at one gutter and one gap:

0. **The header — no container at all.** The wordmark on the left, the links, the theme toggle and Subscribe on the right, sitting directly on the page at the field's gutter. No bar, no glass, no tiles: Jayden asked for it clean and minimal, and the panel it used to sit in was one more surface competing with the field below it. **It leaves going down and comes back going up** — the pattern Jayden asked for by name. Fixed at every width; at the top of the page it has no ground at all, and anywhere else, once it is showing, it takes the least surface that can carry type over a photograph: the ground at 78%, blurred, with a hairline. A **6px threshold** is what keeps it from flickering on a trackpad's noise, above the fold it always shows, and **keyboard focus reveals it wherever it is**, so a tab stop can never sit off screen. Under reduced motion it still hides — it just does not slide. `scroll-margin-top` keeps an anchor from landing under it. There is no Home link — the logo is the way home — and no Gallery link: the gallery *is* the hero, so that item pointed at the top of the page from the top of the page. **About** and **Contact**.
1. **Hero: two panels, filling the screen.** The panel's height *is* the hero's height (`100svh − --field-top`), so the fold lands exactly on the field's next gap: no centring air below the panels, and the card row starts just off screen rather than competing with the headline. The copy on a **cream panel**, left five columns; the right seven a **colour panel** holding a bento of fifteen photographs in three columns, looping vertically with the flow, adjacent columns in opposite directions at three speeds (`--speed` per column). **The panel's own rounded edge is the crop** — there is no soft mask. Each column carries its contents twice and `[data-mid]` marks the loop length; every tile has an intrinsic ratio, so that length is stable before the images load. The panel needs an explicit `height`: `overflow: hidden` does not constrain a box sizing to its own content, and a column of ten tiles once made the row 3197px tall.
2. **The four cards.** One row, four identical objects, three columns each — **and a wide card is a horizontal card**. Under a 4:5 photograph a card's height tracks its *width*, so the wider the card the taller it gets, which is backwards for a row that should get shorter as the screen narrows: at 1200 a 569px card made a 683px photograph and an 850px card. Between **1024 and 1279** (two up, 486–569px cards) and between **561 and 767** (one up, 529–735px) the copy sits beside the photograph instead, with the figure on a fixed 40% share — size it by the card's height and the picture and the title chase each other until the title breaks one word to a line. Everywhere else the card is 288–486px and the vertical arrangement is right. Each card carries: a head carrying the title and a two-line summary; the photograph below it; one control. There were two chips above each title — a number and a topic — and they were saying what the title already said. The title *is* the header: what it is · inside a session · "what would you do?" · who Linda is. The **whole card** fills with its hue under the pointer and on keyboard focus — head and ground together; filling only the head left a seam at the photograph's top edge and read as two objects stacked rather than one card lighting up. The ink rebind stays on the head: put it on the card and the control inherits it, and a pill whose ground is `--bg-overlay` and whose ink is `--on-accent` renders as a black blob on an orange card. Two cards say what Developmental Improvisation is, one says what it asks of a student, one says who Linda is. **The photograph slips `--slip` 20px up out of its box and over the colour** — the one place on the page a panel's contents cross an edge, and small on purpose: 20px reads as deliberate, 60px reads as broken. The pill arrives with the hue — at rest the card is a title, a summary and a picture — and focus reveals it too, because a control the keyboard can reach but never see is worse than none. The whole card is the trigger and the pill is the keyboard route; both open **the reader** (a click that ends a text selection does not — a card is a big target wrapped around selectable words), a dialog whose head takes that card's hue so the panel clicked and the panel opened are plainly the same object. The full copy lives in the card (`.brief__full`) and is hidden only when there is script to open a reader.
   *What this replaced:* a sticky stack of four cards, each with a different beat. Jayden: the second card "doesn't act like the rest of the cards and it makes the scroll weird". Four cards of one shape, in a row, is the answer that survived.
3. **The quote ring — the break.** Eight circular photographs turning around the quote, on the open ground, with `--section-y` either side: the one place the field stops. Its geometry is one relationship: **eight items on a circle of radius r sit 2r·sin(22.5°) = 0.765r apart**, so an item sized near that reads as a necklace rather than as eight dots with ground between them. The clear space inside is `2r − item`, and the quote's column is that minus 32px — derived, not a magic multiplier. The necklace **assembles on arrival**, one photograph a beat after the last; the entrance lives on the photograph inside each item because the item itself carries the flow's transform every frame.
4. **Testimonials — the field resumes.** Three quiet cards, four columns each: a large quote mark at 16% of the card's ink, the quote, and the person in a **nested card that overhangs the bottom-left corner** — and the hue is on that chip, not on the card. The depth comes from the nesting, not from a shadow. The row carries 30px of bottom padding because that overhang has to land somewhere — without it the three sub-cards sat on the closing field's edge. There is no section label: three quotes with names under them do not need to be told they are testimonials.
5. **The closing field** — the last panel in the field, in the same container as every row above it (it used to size itself, which put its edges 36px outside the column at 1920). The brand's own line at display scale, then the sign-up, the two contact links and the copyright. **The sky is on the sign-up, not on the field**: a full-strength hue across a page-wide panel is a floodlight on a near-black ground, and the hue belongs on the thing you are meant to act on. Same move as the testimonials. The sign-up card is the one surface down here whose colour does not follow the theme, so it rebinds its ink tokens for the subtree.

**The mark** is the colour logo on the dark page and **black on the light one** — the colour logo needs a dark ground to hold together. The star in the counter of the "d" takes the page's colour, not the ink, or the counter closes up. The rule is scoped to the nav so the curtain's mark stays in colour.

## 9. Components
`.btn` (primary/secondary/ghost/compact, 46px, `--r-sm`) · `.arrow` (44px circle) · `.chip` (the smallest tile: a label in a pill on the hairline) · `.theme` (the toggle; the choice is applied before first paint by an inline script, so there is no flash) · `.card` / `.card--solid` / `.card--line` · `.brief` (the four cards) · `.photo` (+ `--4x5`, `--1x1`, `--circle`) · `.label` (12px caps, no dot) · `.field` / `.input` · `.nav` (no container; it scrolls away) · `.sheet` · `.dialog` / `.reader` · `.lightbox`. Each is on `styleguide.html` in both themes.

## 10. Gates
`tools/gates/run-all.sh`, serially, 44 lines: layout (overflow, headline lines, **every** container on the column, four equal card widths) · targets · contrast (every visible text node, both themes) · copy · images · motion · ring (the ring and the bento) · reader (the four cards) · nav (leaves going down, comes back going up) · lightbox · dialog · curtain · a11y. Five self-tests, each of which must fail: `ring.mjs` shrinks the ring, `contrast.mjs` paints the ink onto the ground, `curtain.mjs` pins the curtain so it can neither travel nor be removed, `reader.mjs` strips the reader's copy, `nav.mjs` freezes the header's class list. Every gate but `dialog` starts with the newsletter popup already shown, and every gate but `curtain` starts past the curtain. **`run-all.sh` checks both the exit status and whether a gate reported anything at all**: a gate that throws prints its stack to stderr and no report line, and the run then *looks* green because nothing said FAIL. That has happened three times here, every time from a selector going stale. Serve from `di-site/` on `127.0.0.1:4611`, never `localhost`.

One more trap, from the ring gate: **a fixed viewport coordinate is not "away from" something whose size is a token.** The gate parked the pointer at the top centre of the viewport to prove the ring resumes — and at 1024×768 the stage is 770px tall, so that point is another ring photograph and the flow stays held, correctly. The gate computes a point outside `r + item/2` of the stage's centre now. `window.__di.flow.holdKeys` names whatever is holding the flow; that is what found it.
