# Developmental Improvisation — build prompt v14

> **This file replaces every earlier version of this prompt.** v1–v12 were a base spec plus twelve layered review notes, and an
> agent reading them inherited eight superseded designs before reaching the current one. Everything below describes the site as
> it stands, and only that. The history is in git and in `di-site/docs/BUILD-LOG.md`; do not go looking for it to settle an
> argument about what the site should be.

**How to use this file.** Paste it into a fresh session together with the inputs in §0. Sections marked `[DECIDE]` are the ones
Jayden should read and change before you send it. Where this prompt makes a decision, do not reopen it. Where it leaves a choice,
make the call, state it in one line, and move on.

---

## 0. Inputs

- `di-site/` on this branch — the built site: `index.html`, `styleguide.html`, `css/`, `js/`, `fonts/`, `images/`, `tools/`.
- `di-site/images/src/` — 25 photographs from the old site and from Linda. **Gitignored** (identifiable children). Two letter
  photographs in there are never published.
- `assets/logo/` — the logo in seven files. The palette comes out of these, not out of taste.
- `di-site/docs/design-system.md` and `.notion.md` — the spec, kept in sync with the build.
- `di-site/tools/gates/` — the contracts. `run-all.sh` runs them serially.

## 1. What this is, and the three rules

Developmental Improvisation is an education program created by **Linda Kellogg Fulton** that teaches cognitive development and
social-emotional understanding through improvisation games. Mostly children in classrooms; also teachers and adults in workshops.
The site is a one-page brochure with a newsletter sign-up, and it is being rebranded around a new logo. Jayden Betts — a product
designer who works to Apple-grade standards — will edit and ship it.

1. **Premium is subtraction.** When a screen feels wrong, take something away before adding anything. Every section that was
   thin got merged or deleted; do not put them back.
2. **Counting is not looking.** Measure, then open the screenshot. Every gate exists because a number once lied.
3. **The fundamentals carry the design, not the decoration.** The corner geometry, the column, the type scale, the colour
   order and the one photograph shape are the design. There are no illustrations, no gradients, no shadows, no textures.

## 2. The brand, read out of the logo `[DECIDE]`

Open `assets/logo/inline-logo.html` and read the fills. This is the whole palette and it has a structure:

- The **monogram** — the "di" letterforms — is **sky `#58CDFC`**. That is the brand's colour.
- The **star** in the counter of the "d" is **gold `#FFE469`**.
- **Six arcs** ring the monogram. Clockwise from the top: **magenta `#E744E2` · violet `#7358FC` · orange `#F0895B` ·
  green `#51E596` · pink `#FB9BC9` · yellow `#FEE79B`**.

Eight hue angles, spent in the logo's own order: gold as the hero's photograph panel → violet, orange, green and pink
across the four cards, left to right → magenta, gold and green on the testimonials → sky as the closing field.

**One palette, two strengths, decided by the theme.** On the **dark** ground each hue is the fill straight out of the file.
On the **light** ground each is the same hue angle taken to **OKLCH L .885** at the chroma it can carry there (C ≤ .105):
`#A8E3FE` sky · `#ECDA87` gold · `#FEC2F9` magenta · `#D4D5FE` violet · `#FECDB8` orange · `#9EEEBC` green · `#FFC7E0`
pink · `#F1D886` yellow. Jayden asked for this after seeing the full-strength set on cream — a saturated hue needs a
near-black ground to sit on, and on an off-white page the same hue reads better as a tint of the brand. This is the one
sanctioned exception to "no mixes", it lives entirely inside the light theme's token block, and it is not a licence to
mix a hue into a *surface* anywhere.

## 3. Fundamentals

### 3.1 The corner is a superellipse, not an arc `[DECIDE]`
Every rounded thing on this site uses `corner-shape: squircle` alongside its `border-radius`. A circular-arc corner meets the
straight edge with a curvature discontinuity you can see at large radii; a superellipse does not. This is the same
`--corner: squircle` token Jayden's own portfolio uses on every control.

```css
* { corner-shape: var(--corner); }                        /* --corner: squircle */
.arrow, .photo--circle, .voice__avatar, .label::before { corner-shape: round; }
```
The second rule is not optional: `corner-shape` applies to a 50% radius too, so **anything meant to be a circle must opt back
out** or it becomes a squircle. Chrome 139+ honours it; every other engine falls back to the plain arc, which is fine.

### 3.2 The column, and the margins
The old page put a 1280 column inside a 40px gutter and read as a narrow strip floating in dead space. Now:

| | value |
|---|---|
| `--page-max` | 1400px |
| `--gutter` | `clamp(16px, 2vw, 32px)` — content starts 49px from the edge at 1440, not 120px |
| `--grid-gap` | `clamp(12px, 1.1vw, 20px)` |
| `--section-y` | `clamp(56px, 2.2vw + 32px, 88px)` |
| `--card-pad` | `clamp(20px, 2.2vw, 40px)` |

Every section lays out on the same **twelve columns** (`.grid`, six below 768). The gallery is the one thing that leaves the
column: it runs the full width of the screen and bleeds off both edges.

### 3.3 Type
**Jost 800/700 for display and titles, Plus Jakarta Sans 400/600 for everything else.** Jost is one variable latin file,
25KB, 100–900.

**The display face is chosen off the mark, not off taste.** Open `assets/logo/dibasicblack.svg`: the "di" is a perfectly
circular bowl on a straight stem, one stroke weight, no contrast, flat terminals — that is a Futura, and Jost is a
Futura, down to the single-storey 'a'. If you ever revisit this, set the candidate's `d i a o g` at 150px beside the
mark at the same size and look; that test is what ruled out Sen (oval bowls, angled terminals) and picked Jost over
Poppins (same construction, wider and more common). **Do not change the body face**: Jost's x-height is 0.460em and a
small-x-height geometric is a display face, not a reading one.

Tracking tightens as size grows; leading loosens as it shrinks. Measures are in `em`, never `ch`.

### 3.4 A hue is the theme's value for that hue, or it is not there
Within a theme there are no mixes, no tints and no washes. A hue reaches the page as a **whole surface** — the hero's
photograph panel, a card's head, a testimonial card, the closing field — and the ink on it is **`--on-accent`**. Every
light-theme pastel carries the warm black at better than 11.9:1; at full strength violet is the only hue dark enough to
need white, so it goes through `--on-violet`, which is warm black in light and white in dark. On such a surface every
text tier goes to `--on-accent`: a translucent tier over a saturated hue reads as dirt, not as hierarchy. Surfaces that
carry a hue **rebind their ink tokens for that subtree** rather than following the theme.

**Colour rests on a panel; on a card it is a state.** Exactly two surfaces carry a hue at rest, and both are structure:
the hero's photograph panel and the closing field. Everywhere else the hue arrives on interaction — a card's head fills
under the pointer and on focus, and the reader opens on that same hue — or it is a chip rather than a field, as on the
testimonials. Under `@media (hover: none)` a card's hue is its resting colour: where there is no pointer there is no
state, and a touch screen would otherwise never see it. Jayden, twice: the colour must not be distracting, and the site
is premium first.

No gradients anywhere. No hue as a border. **No coloured type at all**: there is none on the page. A hue is never a 12px frame drawn round a photograph —
that was built once and read as a neon outline, not as a panel. Colour is spare: a panel, a card head, a field.

### 3.5 One shape for photographs
Every photograph on the page is a **rectangle with the same superellipse corner**, at **4:5**, and nothing else — hero,
gallery, cards. The single exception is the quote ring, where all eight are **circles**. Two shapes on the whole site, each
used consistently. (Four shapes were tried — capsule, circle, rounded rectangle, 45° square — and Jayden rejected the mix:
"I wish they were all the same shape.")

### 3.6 Motion is one shared value
`js/main.js` keeps one angle, **the flow**: a drift of `--flow-drift` 3.75°/s plus `--flow-scroll` 0.06° per pixel scrolled,
eased toward its target with a time constant of `--flow-settle` 0.32s. The gallery moves 6px per degree; the ring places eight
photographs at the angle plus 45° each, upright. A photograph under the pointer eases the drift to a stop; when neither the
gallery nor the ring is on screen the flow holds and scroll deltas are dropped, so nothing whooshes on arrival. Everything else
takes a rung of the duration ladder (100/160/240/280/360/500ms). Only `transform` and `opacity` animate. Under
`prefers-reduced-motion` the drift and the coupling are zero and the stack does not scale.

### 3.6b Themes
**Dark is the default**; light is the visitor's choice, applied before first paint from `localStorage` so there is no
flash. The saturated hues and the photographs sit better on near-black. Light's ground is `#F0ECE3`, deeper than the
`#F7F5F0` it started at — at three per cent from a white card, nothing on it read as an object.

### 3.6c Arrival
Every section enters with intent, not one flat fade: photograph then text on the cards, a settle on the band, the ring
assembling one circle at a time, a stagger on the testimonials. One `IntersectionObserver` drives it. **Never observe a
zero-area element** — the ring's orbit is 0×0 and can never satisfy a threshold, so the ring never appeared.

### 3.7 The floors
44px minimum targets, measured. Focus is a 2px ring on `--focus`. Every visible text node clears 4.5:1 (3:1 at ≥24px) against
its effective background **in both themes**. One `<h1>`. Every section labelled. The skip link is first in the body.

## 4. The page, section by section `[DECIDE]`

**The page is one bento field.** Header tiles, hero panels, the four cards, the testimonials and the closing field all sit
on the same twelve columns, at the same gutter, separated by the same `--grid-gap`. There are no bands, no floating
strips, and no section padding between rows — `--section-y` survives in exactly one place, either side of the ring, which
is the field's only break. `--field-top` (`--grid-gap` × 2 + `--nav-h`) is where the field starts under the header.
Jayden: *"what if there isnt [a gap] — what if its all a beautiful bento."*

**0. The header — no container.** The wordmark on the left, the links, the theme toggle and Subscribe on the right,
directly on the page at the field's gutter. No bar, no glass, no tiles. **It leaves going down and comes back going up**, at
every width: fixed, bare at the top of the page, gone on a downward scroll, back on any upward one with the ground at
78% under it, blurred, with a hairline. A 6px threshold keeps it off a trackpad's noise; keyboard focus reveals it
wherever it is; under reduced motion it hides without sliding. No Home link (the logo is the way home) and **no Gallery link**:
the gallery *is* the hero. **About · Contact.**

**1. The hero — two panels, filling the screen.** The panel's height IS the hero's height (`100svh − --field-top`), so
the fold lands on the field's next gap and the card row starts just off screen. Copy on a cream panel, left five columns; the right seven a colour panel holding fifteen
photographs in three columns, looping vertically with the flow, adjacent columns opposed, three speeds. The panel's own
rounded edge is the crop — no soft mask. Each column carries its contents twice, `[data-mid]` marks the loop length, and
the panel needs an **explicit height**: `overflow: hidden` does not constrain a box sizing to its own content, and a
column of ten tiles once made the row 3197px tall. The hero does **not** claim `100svh` — the card row has to break the
fold or the field reads as two pages.

**2. The four cards.** One row, four identical objects, three columns each (two up, then one, as the grid narrows). Each
carries a head with the title and a two-line summary; the photograph below; one control, and the WHOLE card fills
with its hue under the pointer and on focus — head and ground together; filling only the head leaves a seam at the
photograph's top edge. The ink rebind stays on the head, or the control inherits it and renders as a blob. Two say what Developmental Improvisation is, one says what it asks of a student, one says who Linda is. The
photograph **slips `--slip` 20px up out of its box and over the colour** — the one place a panel's contents cross an
edge, and small on purpose. The pill arrives with the hue, so a resting card is chips, a title, a summary and a picture. The whole card is
the trigger; the pill is the keyboard route; both open **the reader**, a dialog whose head takes that card's hue. The full copy lives in the card and is hidden only when there is
script to open a reader.

**3. The quote ring — the break.** Eight circular photographs turning around the quote, on the open ground. Geometry is
one relationship: eight items on radius r sit `2r·sin(22.5°) = 0.765r` apart, so the item is sized near that; the quote's
column is `2r − item − 32px`. The necklace assembles on arrival, one circle at a time.

**4. Testimonials.** Three cards, four columns each, each a hue, with the person in a nested card overhanging the
bottom-left corner. The row carries 30px of bottom padding so that overhang lands somewhere instead of on the closing
field's edge. No section label — three quotes with names under them do not need to be told what they are.

**5. The closing field.** In the same container as every row above it. The brand's line at display scale, the sign-up,
two contact links, the copyright. **The sky is on the sign-up card, not on the field** — a full-strength hue across a
page-wide panel is a floodlight on a near-black ground, and the hue belongs on the thing you are meant to act on.

**The curtain**, on the first load of a session only: two **flat** panels of the dark ground with the colour mark and a
loading bar, parting after a 620ms floor, with a 2600ms failsafe, removed from the DOM, never on a reload, never under
reduced motion. Flat and not pleated — Jayden: *"i did like it when it wasnt like actually a curtain, it looked a lot
cleaner."*

## 5. Components
`.btn` (primary/secondary/ghost/compact) · `.arrow` · `.theme` (the dark-mode toggle, applied before first paint from
`localStorage` so there is no flash) · `.card` and `.card--wash` · `.photo` · `.label` (12px caps with a dot in the section's
hue) · `.field`/`.input` · `.nav` (transparent, glass once scrolled; no Home link — the logo is the way home) · `.sheet` (the
phone menu) · `.dialog` (the newsletter popup) · `.lightbox`. Every one of them is on `styleguide.html` in both themes.

## 6. Photography
25 photographs. Factual `alt` on each, explicit dimensions, `loading="lazy"` except the hero and the first five gallery cards,
`object-position` per photograph via `--pos`, a blurred 24px placeholder as the background. AVIF/WebP/JPEG at
**160/320/480/960** on the page and 1440 in the lightbox — the 160 exists because a 76px circle should not pull a 320px file.
Every photograph opens in the lightbox. Two rules learned the hard way: **a photograph inside a circle must have its subject at
the centre and no dark ground** (linda-portrait and kids-bw-small read as black discs and were pulled), and **the hero's
photograph is not in the gallery** — it sits 300px above it.

## 7. Copy
Only sentences from the old site, and only the ones the page needs. Labels may be single words from them. Placeholders are
lorem with `data-placeholder="true"`. The `copy` gate fails on any other string — including a plausible one-word link label.

## 8. Gates
`di-site/tools/gates/run-all.sh`, serially, 37 lines: layout (overflow, headline lines, the column, equal card widths) ·
targets · contrast (every text node, both themes) · copy · images · motion · ring (the ring and the bento) · lightbox ·
dialog · curtain · a11y. Three self-tests: `ring.mjs` shrinks the ring, `contrast.mjs` paints the ink onto the ground, and
`curtain.mjs` pins the curtain in place — each must fail. Every gate but `dialog` starts with the newsletter popup already marked shown so it cannot open over the thing
being measured. Serve on `127.0.0.1:4611` from `di-site/`, never `localhost`.

## 9. Tried and rejected — do not propose these again
- **Gradients.** A hue-band across the top of the page and eased radial "blooms" at the foot of cards. Both removed:
  "I dont think the gradient experiment works the clean colored cards looked a lot better."
- **A mixed shape vocabulary** for photographs (capsule/circle/rounded-rectangle/45° square).
- **Washes and tints.** Two rounds of them. A hue mixed into the ground is not the brand colour any more.
- **A coloured dot** before every section label.
- **A horizontal gallery as its own section.** It belongs in the hero.
- **Blocks of flat colour among the photographs.** There are enough pictures.
- **A sticky stack of four cards, each with a different beat.** The one that behaved differently made the scroll read as
  a stumble. Four cards of one shape, in a row.
- **A hue as a 12px frame drawn round a photograph.** It reads as a neon outline, not as a panel.
- **Highlighted words in the headline.** A `<mark>` on "cognitive" and "emotional", in sky and pink, built because
  Jayden liked the look of an accidental text selection — and cut the same day. `::selection` is where that colour
  belongs, and the headline is plain type.
- **Chips above a card's title.** A number and a topic in two pills, saying what the title already said.
- **A full-bleed band photograph** between the sections. The one built was the same room and session as a card's
  photograph, stretched out of a 1440px file.
- **A soft mask on the hero's photographs.** The panel's edge is the crop.
- **Photographs set inline into the headline.** Clever, and it made the hero cluttered.
- **A pause control** for the drift, **outlines** on photographs, **decorative vectors**, the **star** in section labels, a
  **figures band**, and a **disc-and-halo** behind the logo.
- **Instrument Serif**, and Plus Jakarta Sans alone. Sen is the decision.
- **Three thin closing sections** (newsletter, contact, footer as separate bands).

## 10. Still needed from Linda
1. Which phone number is right: (857) 352-3221 as shipped, or (877) 352-3221 as the search index shows.
2. Social profile URLs, or a decision to have none (there are none on the page now).
3. Releases for the children in the photographs — the old site published them; confirm rather than assume.
4. Three real testimonials with name and role.
4b. Sixty to eighty words about Linda for the fourth card and its reader — everything on the page about her today comes
   from one sentence of the old site's copy.
5. The newsletter provider and its form endpoint (`[NEWSLETTER_ACTION_URL]` in two forms).
6. Copy for a Gallery page and a Contact page, if they are ever built.

## 11. How to reply
Around five lines. Anything **not** done goes first, on its own line. Lead with what changed and the number that proves it.
Screenshots of every viewport you changed, opened and actually looked at. Questions in a structured prompt, not buried in prose.
