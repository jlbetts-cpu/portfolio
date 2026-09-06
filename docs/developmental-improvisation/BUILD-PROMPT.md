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

Eight colours, and **every one of them appears at full strength, exactly as it is in the file.** The page spends them in
the logo's own order: sky and gold as the two tiles in the hero's bento → violet, orange, green and pink as the panels
behind the four cards' photographs → magenta, gold and green on the testimonials → sky as the closing field and the
curtain. Mixing a hue into the ground was tried for two rounds and rejected: a pastel is no longer the brand colour, and
it shifts again between the themes.

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

### 3.4 Colour is full strength or it is not there
There are no mixes, no tints and no washes. A hue reaches the page as a **surface at 100%** — a bento tile, the panel behind
a card's photograph, a testimonial card, the closing field, the curtain — and the ink on it is **`--on-accent`**, the one
value that clears 4.5:1 on that hue. Six of the eight take warm black; violet is the only one dark enough to need white
(3.7:1 against 4.6:1). On a solid surface every text tier goes to `--on-accent`: a translucent tier over a saturated hue
reads as dirt, not as hierarchy.

Because a full-strength hue is the same colour in both themes, the surfaces that carry one **rebind their ink tokens for
that subtree** rather than following the theme. That is what makes the palette read identically in light and dark.

No gradients anywhere. No coloured text. No hue as a border. Four full-strength cards were built and pulled back the same
day: they flooded the page. Colour is spare — a panel, a tile, a card, a field.

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

0. **The curtain.** On the first load of a session, two halves of sky cover the page with the mark and a loading bar while
   the fonts and the hero's first photographs arrive, then part. No scrim and no darkening — the site is already laid out
   behind them. A floor of 620ms, a hard 2600ms failsafe, gone from the DOM a second later, never on a reload in the same
   session, never under reduced motion.
1. **Hero, with the gallery inside it.** The headline holds the left six columns at display size. The right six are a
   **bento**: three columns of 4:5 photographs plus two tiles of pure colour, looping vertically with the flow, adjacent
   columns in opposite directions at three speeds, the whole block masked top and bottom so the photographs fade in and out
   of the ground instead of stopping at an edge. Under the headline, one row with the tagline and one button.
2. **The four cards.** Sticky, each 10px lower than the last, a covered card scaling down from its top edge as the next climbs
   over it. One hue each (violet, orange, green, pink), one photograph each, sized by height so a 4:5 frame cannot stretch the
   card past the text beside it. Even cards mirror — and both children must be pinned to `grid-row: 1`, or grid's forward-only
   auto-placement drops the mirrored figure to a second row and doubles the card.
3. **The quote ring.** Eight circular photographs turning around "Creativity in motion creates knowledge!". **This is the one
   section Jayden has asked to keep.** Do not redesign it.
4. **Testimonials.** A centred label, then three cards, each a full-strength hue: a large quote mark at 26% of the card's
   ink, the quote, and the person in a **nested white card that overhangs the bottom-left corner** — the depth comes from
   that nesting, not from a shadow. Placeholder copy until Linda supplies real ones.
5. **The closing field.** Newsletter, contact and footer were three thin bands; they are one sky field now, inset by the
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
