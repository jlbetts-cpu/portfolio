# Developmental Improvisation — design system

For anyone building the next page. Every rule has a reason. If you cannot say what an element is *for*, delete it. The live version of every component is `styleguide.html`; the tokens are `css/tokens.css`, the only file allowed to contain raw values.

## 1. Principles
1. **Premium is subtraction.** Take something away before adding anything. Three thin sections at the foot of the page became one field; four photograph shapes became one.
2. **Counting is not looking.** Measure, then open the screenshot. Every gate in `tools/gates/` exists because a number once lied.
3. **The fundamentals carry the design.** The corner geometry, the column, the type scale, the colour order and the single photograph shape *are* the design. No illustrations, no gradients, no shadows, no texture.
4. **The palette is the logo, read literally.** Sky is the monogram, gold is the star, six arcs ring them. Eight hues, in the logo's own order, each used as itself — at full strength on the dark ground, and at one held lightness on the light one.
5. **Two themes, one palette. Dark is the default**; light is the visitor's choice, applied before first paint. The saturated hues and the photographs sit better on near-black, and Jayden asked for the ground that pops.
6. **Sections on open ground, at one rhythm.** Everything lays out on the same twelve columns at the same gutter, and the distance between sections is one number (`--section-y`). The page was a bento field of tiles once; it stopped being one when the bento and the hero's panel went, and the spacing had to stop being a tile gap with it.
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

**Where the hues are now: on the mark, and nowhere else.** The eight hues sweep across the black hero mark as a band of light; no surface on the page carries one at rest. The token set is kept whole because the mark, the nav logo and the curtain's loader are drawn from it.

**Colour rests on a panel; on a card it is a state.** Two surfaces carry a hue at rest and they are both structure: the hero's photograph panel and the closing field. Everywhere else the hue arrives on interaction — a card's head fills under the pointer and on focus, and the reader opens on that same hue — or it is a chip rather than a field, as on the testimonials, where the hue is on the person and not on the quote. Four coloured card heads under the hero and three coloured testimonial cards were each, in turn, the loudest thing on the page; the brief is premium first. **Where there is no hover there is no state**: under `@media (hover: none)` the card's hue is simply its resting colour, because a touch screen would otherwise never see the section's colour at all.

No coloured text — a `<mark>` highlight on two words of the headline was built in sky and pink and taken out again; `::selection` keeps that colour for an actual selection, which is the only place it belongs. No hue as a border. No coloured dot before a label — that was removed.

| Token | Light | Dark |
|---|---|---|
**The neutrals are cool (v24).** Jayden: *"the color still feels not like a premium site."* They were warm — a cream ground and a brown-black ink — and warm reads craft and cosy, the wrong register for "a serious new tool for education". The ground is a near-white with the faintest cool cast and the ink is a blue-black, held at the same contrast steps. **The page itself is ink and light**: the brand's colour lives in the photographs and in the mark's sweep, which is the rule in his own app — *"saturated colour means a win or a photograph; chrome is ink and light."* The sign-up card, the last saturated surface, is the **inverted** surface now: the ink as its ground and the page as its type, so it follows the theme by construction.

| Token | Light | Dark |
|---|---|---|
| `--bg` / `--bg-raised` / `--bg-sunken` | #FAFAFB / #F2F2F5 / #E8E8EE | #0B0B0F / #15151B / #070709 |
| `--ink` / `--ink-2` / `--ink-3` | #15141D / #4E4C5F / #6A687D | #F3F3F7 / 72% / 56% |
| `--line` / `--line-strong` | ink 10% / 20% | off-white 10% / 20% |

## 4. Type
**Geist, two weights: 400 and 600.** One variable latin file, 68KB, for everything — display and reading. It replaced **Jost and Plus Jakarta Sans together**: three files became one, and a display face plus a reading face became one voice.

**Why the change.** Jost was chosen by measuring the mark: the logo's "di" is a circular bowl on a straight stem with one stroke weight and flat terminals, which is a Futura, and Jost is a Futura. That was the right answer to the question "what matches the logo". Linda asked a different question — *a serious new tool for education* — and a Futura is the wrong register for it: geometric circles read friendly and slightly retro. A grotesque reads institutional. **The mark keeps its own geometry; the type stopped imitating it.**

**Every display size came down and the tracking went tighter.** Geist's x-height is about 0.52em against Jost's 0.460, so the same optical weight needs less size, and a grotesque at display size wants to be closed up where a geometric wants air. Display tops out at 4.25rem rather than 4.75, and nothing is heavier than **600** — at 800 a grotesque shouts, which is the opposite of the brief.

| Role | Size | Leading | Tracking |
|---|---|---|---|
| display | `clamp(2.25rem, 1rem + 3.8vw, 4.25rem)` | 1.06 | −0.035em |
| h1 | `clamp(2rem, 1.3rem + 3vw, 3.25rem)` | 1.08 | −0.032em |
| h2 | `clamp(1.625rem, 1.15rem + 1.9vw, 2.375rem)` | 1.12 | −0.026em |
| h3 | `clamp(1.1875rem, 1.05rem + .6vw, 1.5rem)` | 1.22 | −0.016em |
| lead | `clamp(1.0625rem, .95rem + .45vw, 1.1875rem)` | 1.52 | −0.005em |
| body | `clamp(.9375rem, .9rem + .2vw, 1rem)` | 1.64 | 0 |

Measures are in `em`, never `ch`.

## 5. Space and the column
The page used to be **one bento field**: every row a tile, and the gap between tiles `--grid-gap`, about 16px. That is correct for tiles butted together and wrong for a sequence of sections on open ground — which is what the page became once the bento went and the hero stopped being a panel. Jayden: *"the spacing of the site feels so cramped, not premium — let sections breathe."*

`--page-max` 1720, `--gutter` `clamp(20px, 3.4vw, 64px)`, `--grid-gap` `clamp(16px, 1.8vw, 32px)`, `--section-y` `clamp(80px, 8vw, 168px)`, `--card-pad` `clamp(20px, 2.2vw, 40px)`. **`--grid-gap` means between COLUMNS now; `--section-y` means between SECTIONS**, and that is the whole correction. One rule carries it: `main > section + section, .close { margin-top: var(--section-y) }`, with the ring at 1.4× because it is the page's one break and a break the same distance as everything else is not a break. Measured at 1440: **115px between sections, 161px either side of the ring**, against 16px before. The gutter grew with it — 29px of air at the edge of a 1440 screen is a brochure, 49px is a page.

`--field-top` is `--nav-h` plus `clamp(48px, 6vw, 120px)`: the header, and real air under it. Everything lays out on the same twelve columns (`.grid`; six below 768). Hairlines are inset rims (`box-shadow: inset 0 0 0 1px`), never borders, so they never change an element's box.

**Breakpoints are decided by the element's own width, not the viewport's.** The closing field is the case that proves it: its two-column split moved from 768 up to 1024, because at 768 the sign-up card was 334px and its email input 170px, which is not a field, it is a slot — and the input/button pair stacks below 600 rather than 480.

## 5b. Arrival
Every section enters with intent rather than one flat 12px fade: the ring assembles one circle at a time, the testimonials stagger, the closing field rises. One `IntersectionObserver` drives all of it through `.reveal` and `.reveal--parts`. **Never observe a zero-area element** — the ring's orbit is a 0×0 positioning origin, and an element with no area can never satisfy a `threshold: 0.2`, so the ring simply never appeared; the *stage* is what is observed.

## 6. Motion
**Things that happen** take a rung: `--dur-press` 100 · `--dur-state` 160 · `--dur-state-out` 240 · `--dur-move` 280 · `--dur-reveal` 360 · `--dur-enter` 500. **Things that turn, slide or stack** read one shared value and have no duration.

**The flow** (`js/main.js`) is one angle: a drift of `--flow-drift` 3.75°/s plus `--flow-scroll` 0.06° per pixel scrolled, following its target through an exponential easing with time constant `--flow-settle` 0.32s. **The gallery** under the hero is four columns (three on a tablet, two on a phone) rising `--gallery-px` 11px per degree — 41px a second at rest — each at its own rate (1, 1.18, 0.9, 1.1) and from its own starting height, which is what gives one-shape photographs the uneven masonry edge. Each column is two copies of one run, so the loop has no seam. **It cannot be scrubbed**: there is no wheel handler, a wheel over it scrolls the page, and the pointer only holds it so a photograph can be clicked. **The hero mark turns to face the pointer** anywhere on the page, ±30° across and ±20° up and down, each side normalised by the room between the mark and that edge of the window; it eases with a 0.2s time constant, returns to face the visitor when the pointer leaves, and on a device with no hover it sways once every 24s on the flow. The ring places eight photographs at the angle plus 45° each, upright. A photograph under the pointer eases the drift to a stop in about half a second; a touch holds it four seconds; when neither the gallery nor the ring is on screen the flow holds and scroll deltas are dropped, so nothing whooshes on arrival. **The ring releases its hold when the pointer leaves the orbit, not when it leaves "a photograph"** — the four cards put photographs directly above the ring, and the older guard read those as still-inside and left the flow held for good.

**How every interactive surface answers.** One shape for all of them. A state **arrives in `--dur-state` and leaves in `--dur-state-out`** — fast in, slow out; a hover that snaps back reads as a glitch, one that arrives late reads as lag. The asymmetry travels on `--t`, declared at `:root` and flipped by one `:where(...):hover` list, so a component writes `var(--t)` and never a duration. **A press is always `--dur-press` and is never slowed by it**: `transition-duration` on `:hover` also catches the transform, and since a press only ever happens while hovered, that idiom had killed the press rung on every button on the page. Every control has a press now — buttons, the wordmark, nav links, the three icon buttons, the four cards, and the photographs in the gallery and the ring.

**The arrival hands the element back.** `.js .reveal` declares `transition: opacity/transform var(--dur-reveal)` plus the stagger's `transition-delay`, and it outranks a component's own rule — so while the class stayed on, the fourth card's hover lifted over 360ms **after a 180ms delay**, and its hue, which the reveal's shorthand does not list, never faded at all. The class comes off once the element has landed. `motion.mjs` asserts it, with a self-test that puts the class back.

**One object, one answer.** A card's ground, its lift and its picture all move on the card's hover — the photograph used to scale only when the pointer was on the photograph, so one card had two responses depending on where you landed. The control and its arrow follow 60ms behind on the way in and leave with no delay, so the card resolves as one gesture and never sheds its parts in sequence.

The theme swap is one 240ms cross-fade of the whole document. Only `transform` and `opacity` animate. Under `prefers-reduced-motion` the drift and the coupling are zero, the cards do not lift, reveals become short fades — and the reset has to be written `.js .reveal` to outrank the rule that offsets them, or every revealing element still slides 12px. There is no pause control: Jayden removed it; hover-to-stop and the reduced-motion rule are the mitigation.

## 7. Photographs — one shape
Every photograph on the page is a **4:5 rectangle with the same superellipse corner**. The **circle** is the single exception and it belongs to the quote ring. That is the whole vocabulary; a mixed set of four shapes was built and rejected.

`<figure class="photo">` wrapping a `.photo__open` button wrapping `<picture>`: AVIF, WebP and JPEG at **160/320/480/960** on the page and 1440 in the lightbox, a blurred 24px placeholder as the background, `object-position` per photograph via `--pos`. The 160 exists because a 76px circle should not pull a 320px file. Factual `alt` on every one; `loading="lazy"` except the hero and the first five gallery cards.

Two rules learned by looking: **a photograph inside a circle needs its subject at the centre and no dark ground** — linda-portrait and kids-bw-small read as black discs and were pulled from the ring — and **the hero's photograph is not in the gallery**, which is 300px below it.

## 8. The page
**The curtain** comes first, on the first load of a session only: two **flat** panels of the dark ground (#0B0B0F) over the page, with the colour mark and a loading bar, while the fonts and the first photographs arrive. Then they part. A 620ms floor so it reads as deliberate, a 2600ms hard failsafe so nothing can strand the site, removed from the DOM a second after it opens, never on a reload in the same session, never under reduced motion. `?curtain` in the URL forces it, which is what a review pass needs.

0. **The header — no container at all.** The name in type on the left (no mark: it does not hold at nav size), About and Contact and one filled Subscribe on the right. Light only — dark mode is off for now. Previously: the wordmark on the left, the links, the theme toggle and Subscribe on the right, directly on the page at the field's gutter. **It leaves going down and comes back going up.** A 6px threshold keeps it off a trackpad's noise; keyboard focus reveals it wherever it is. **About** and **Contact**, and nothing else.
1. **The hero is a masthead.** Linda's brief: *far too busy, too many images, a much simpler hero would do wonders*, and *the logo more prevalent*. The fifteen drifting photographs are gone — with them the bento, its per-column wheel scrub and its gate. What is left is the order an institution opens in: **the mark, the claim, the one action**, centred, on the page with no panel. The claim is two-tone — *New tools for cognitive development* in ink, *& emotional understanding* a tier down, one line each from 1100px up. Centred is the register — left-aligned reads editorial and modern, centred reads formal. The mark is the largest single object in it. The headline and the hairline above the figures share one column (`--hero-col`), so the masthead is one block rather than three widths. **The hero carries no photograph**: the photographs start right under it, in **the gallery** — four columns rising out of a short fade and dissolving into a long one, on the page's own grid.
2. **Two sections, not four cards.** *What Developmental Improvisation is*, then *Who Linda is*. One shape used twice and flipped the second time: a photograph on five columns, a heading and the prose on six. The labels over the headings went in v24 — "The method" over "What Developmental Improvisation is" was the heading said twice. This replaced four clickable cards and the reader dialog behind them — two sections of prose do not need a dialog to hold them, and a page trying to be taken seriously puts its case in the open rather than behind a click. **The body copy is placeholder** until Linda writes the real thing.
3. **The quote ring — the break.** Eight circular photographs turning around the quote, on the open ground, with `--section-y` either side: the one place the field stops. Its geometry is one relationship: **eight items on a circle of radius r sit 2r·sin(22.5°) = 0.765r apart**. The radius drawn is `min(--ring-r, 50vw − item/2 − 12px)`, so on a phone every circle is whole and on the screen, and the script reads it back from the stage. The clear space inside is `2r − item`, and the quote's column is that minus a margin. The necklace **assembles on arrival**, one photograph a beat after the last.
4. **Testimonials** — three-up from 1024, one per row with the person across a hairline on a tablet, a scroll-snap row with the next card showing on a phone. Quotes at `--fs-quote`. **Cleaned up by deletion.** The 4rem quote mark is gone — 60px of decoration per card announcing "this is a quote" about an object that obviously is one. The fixed 320px card is gone — three quotes are never the same length and the card was insisting they are; the third was 18% words and 82% air. The overhanging colour chip is gone with them: on a page trying to read as a serious tool, a saturated tag under every quote was the loudest thing left. What survives of the hue is its smallest form, **one disc with the person's initials**. The name sits on a hairline at the foot of the card, and the hairlines line up across the row because the block is pushed down with `margin-top: auto` — the cards stretch, the quotes do not have to match.
5. **The closing field** — two rows from 1024px: the brand's line and the contacts on one baseline, then the sign-up as one full-width ink band (the ask on the left, the field on the right). The contact links carry no icons. Then the copyright. Inside it: the brand's own line at display scale, the sign-up, the two contact links, **the page's second way in** ("Bring this to your school", a `mailto` on the address already there) and the copyright. The sign-up card is the inverted surface — ink ground, page-coloured type — and the field around it is the raised ground. On a phone the contact icons go and the address may break only at the @.

**The mark** is the colour logo on the dark page and **black on the light one**. The star in the counter of the "d" takes the page's colour, not the ink, or the counter closes up.

## 9. Components
`.btn` (primary/secondary/ghost/compact, 46px, `--r-sm`) · `.arrow` (44px circle) · `.chip` (the smallest tile: a label in a pill on the hairline) · `.theme` (the toggle; the choice is applied before first paint by an inline script, so there is no flash) · `.card` / `.card--solid` / `.card--line` · `.tell` (the two sections) · `.proof` (the three figures) · `.photo` (+ `--4x5`, `--1x1`, `--circle`) · `.label` (12px caps, no dot) · `.field` / `.input` · `.nav` (no container; it scrolls away) · `.sheet` · `.dialog` · `.lightbox`. Each is on `styleguide.html` in both themes.

## 10. Gates
`tools/gates/run-all.sh`, serially, 50 lines: layout (overflow, headline lines, every container on the column, equal quote cards, the two sections' columns never crossing) · targets · contrast (every visible text node, both themes) · copy · images (no photograph twice anywhere) · motion · ring · **gallery** (drifts, uneven rates, holds, never scrubs, wraps, fades top and bottom, 4/3/2 columns) · **mark** (faces the pointer on both axes, held inside its limits, returns, still under reduced motion) · **mobile** (phone emulation at 390/360/320: no hover outside `(hover: hover)`, 16px fields, no tap flash, no stuck scale after a tap, modal scroll lock, the ring whole on screen, the footer flat, no touch hold) · nav · lightbox · dialog · curtain · a11y. **Eight self-tests**, each of which must fail: `ring.mjs` shrinks the ring, `contrast.mjs` paints the ink onto the ground, `curtain.mjs` pins the curtain, `nav.mjs` freezes the header's class list, `motion.mjs` puts a reveal back, `gallery.mjs` gives the gallery a wheel handler, `mark.mjs` pins the mark's transform, `mobile.mjs` adds an ungated hover rule. Every gate but `dialog` starts with the newsletter popup already shown, and every gate but `curtain` starts past the curtain. **`run-all.sh` checks both the exit status and whether a gate reported anything at all**: a gate that throws prints its stack to stderr and no report line, and the run then *looks* green because nothing said FAIL. That has happened three times here, every time from a selector going stale. Serve from `di-site/` on `127.0.0.1:4611`, never `localhost`.

One more trap, from the ring gate: **a fixed viewport coordinate is not "away from" something whose size is a token.** The gate parked the pointer at the top centre of the viewport to prove the ring resumes — and at 1024×768 the stage is 770px tall, so that point is another ring photograph and the flow stays held, correctly. The gate computes a point outside `r + item/2` of the stage's centre now. `window.__di.flow.holdKeys` names whatever is holding the flow; that is what found it.
