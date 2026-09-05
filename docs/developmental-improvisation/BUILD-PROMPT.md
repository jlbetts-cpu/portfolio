# Developmental Improvisation — build prompt v13

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
- **Six arcs** ring the monogram. Clockwise from the top: **magenta `#E744E2` · violet `#7358FC` · orange `#F0895B` ·
  green `#51E596` · pink `#FB9BC9` · yellow `#FEE79B`**.
- A four-point star sits in the counter of the "d". It is not used on the site.

**The page spends the six arcs once each, in that order, top to bottom, and closes on sky at full strength.** Gallery label
(magenta) → the four stacked cards (violet, orange, green, pink) → the testimonials tile (yellow) → the closing field (sky).
This is the rule that makes the colour read as *the brand* rather than as seven cheerful colours.

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
**Sen** (800 display, 700 titles) over **Plus Jakarta Sans** (400/600). Sen is one variable latin file, 18KB, every weight.
They share a geometry — circular bowls, flat terminals — so the pair reads as one voice. The display runs big and tight:
`clamp(2.75rem, 1.1rem + 5.4vw, 6rem)` at `-0.04em`, five lines at every width. Measures are in `em`, never `ch`.

### 3.4 Colour reaches the page two ways, and no others
- **A wash**: the hue mixed into the raised ground, flat, behind a whole card. **Each hue carries its own `--wash-mix`**
  (magenta 14% … yellow 46%) because the seven are nowhere near equally dark and one mix for all of them makes magenta a
  colour and yellow a rumour. In dark every mix sits at 20–24%: above about 26% the lighter hues turn into a mid ground and
  strand the body ink on them.
- **One field**: the closing block, sky at full strength. Its background does not follow the theme, so **its ink tokens are
  rebound for that subtree** and every component inside it stays correct in both themes.

No gradients anywhere. No coloured text. No hue as a border.

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

### 3.7 The floors
44px minimum targets, measured. Focus is a 2px ring on `--focus`. Every visible text node clears 4.5:1 (3:1 at ≥24px) against
its effective background **in both themes**. One `<h1>`. Every section labelled. The skip link is first in the body.

## 4. The page, section by section `[DECIDE]`

Six sections. Anything thinner than this got merged.

1. **Hero.** Editorial, not centred. The headline holds the left seven columns at display size; one 4:5 photograph holds the
   right four; a single row under the type carries the tagline and one button. Nothing else — no chips, no second button, no
   photo row.
2. **Gallery.** Immediately under the hero, edge to edge: twelve photographs on a looping track moved by the flow, the label
   and two arrows on the column above it. Arrows step exactly one card; it can be dragged; a drag never opens the lightbox.
3. **The four cards.** Sticky, each 10px lower than the last, a covered card scaling down from its top edge as the next climbs
   over it. One hue each (violet, orange, green, pink), one photograph each, sized by height so a 4:5 frame cannot stretch the
   card past the text beside it. Even cards mirror — and both children must be pinned to `grid-row: 1`, or grid's forward-only
   auto-placement drops the mirrored figure to a second row and doubles the card.
4. **The quote ring.** Eight circular photographs turning around "Creativity in motion creates knowledge!". **This is the one
   section Jayden has asked to keep.** Do not redesign it.
5. **Testimonials.** Three tiles, the middle one washed yellow, the other two the raised ground with a hairline. Placeholder
   copy until Linda supplies real ones.
6. **The closing field.** Newsletter, contact and footer were three thin bands; they are one sky field now, inset by the
   gutter, `--r-xl` corners: the mark, the sign-up, the two contact links, and the copyright under a rule.

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
`di-site/tools/gates/run-all.sh`, serially, 35 lines: layout (overflow, headline lines, the column, equal card widths) ·
targets · contrast (every text node, both themes) · copy · images · motion · ring (the ring and the gallery) · lightbox ·
dialog · a11y. `ring.mjs --self-test` shrinks the ring and must fail; `contrast.mjs --self-test` paints the ink onto the ground
and must fail. Every gate but `dialog` starts with the newsletter popup already marked shown so it cannot open over the thing
being measured. Serve on `127.0.0.1:4611` from `di-site/`, never `localhost`.

## 9. Tried and rejected — do not propose these again
- **Gradients.** A hue-band across the top of the page and eased radial "blooms" at the foot of cards. Both removed:
  "I dont think the gradient experiment works the clean colored cards looked a lot better."
- **A mixed shape vocabulary** for photographs (capsule/circle/rounded-rectangle/45° square).
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
5. The newsletter provider and its form endpoint (`[NEWSLETTER_ACTION_URL]` in two forms).
6. Copy for a Gallery page and a Contact page, if they are ever built.

## 11. How to reply
Around five lines. Anything **not** done goes first, on its own line. Lead with what changed and the number that proves it.
Screenshots of every viewport you changed, opened and actually looked at. Questions in a structured prompt, not buried in prose.
