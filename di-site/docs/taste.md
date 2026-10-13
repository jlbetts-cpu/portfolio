# How Jayden designs, read from Some Wins and his portfolio

Written 2026-10-13, after he asked: *"do you have access to the some wins files and
md files and see how I like my design?"* and then, of an earlier reading that used
his hackathon app as well: *"no nothing with apollo the some wins design I want you
to look at."* So this file reads one source only: **Some Wins** (the repository is
`jlbetts-cpu/Strata`; the app's code name is Strata, its name is Some Wins, its site
is somewins.xyz).

What was read: `CLAUDE.md`, `docs/design.md` (LOCKED / GUIDED / OPEN), `brand.md`,
`voice.md`, `ten.md`, `space.md`, `reference-board.md`, `illustration-style.md`,
the landing page `docs/index.html`, and the 33 screens in `docs/gallery.html`, light
and dark.

These are evidence of taste, not a spec for this site. Where one points at a change
here that reopens something LOCKED in `decisions.md`, it goes to him as a question
with a rendering, never straight into the code.

## What Some Wins believes, in its own words

| Rule | Where it is written |
|---|---|
| **One bold thing per screen, and everything else steps back.** "None of them has a second voice at the same volume." | `reference-board.md` §11 |
| **Less text, always.** "A component that explains itself loses its charm." | `design.md`, Copy |
| **Lots of white space, and it has to be doing something.** "The white space is an aid but make it make sense." | `design.md`, Layout |
| **A title cannot float low with nothing above it.** Content reads from the top: "name, its controls, the block, air below." | `reference-board.md` §11.2, `design.md` |
| **One accent: ink.** Saturated colour means a win or a photograph; chrome is ink and light. | `design.md`, Colour |
| **Nothing white in dark except the main filled button.** | `ten.md` rule 6 |
| **One primary action, a capsule**, in ink (white in dark). Pills and generous radii; corners come from the object's own corner or a capsule. | `CLAUDE.md` (`PrimaryCapsule`), `ten.md` rule 7, the landing page |
| **Two weights: Bold for headings, Medium for prose.** "No tiny thin font anywhere"; "the text reads as premium not dull"; "why no bold i mean thats what I asked". | `design.md`, `CLAUDE.md` |
| **Nothing below 15pt.** | `design.md` |
| **No lines.** Space groups things, and a box means the space has lost. | `space.md` P2, `reference-board.md` |
| **No shadow on chrome.** | `ten.md` rule 7 |
| **Photographs look like photographs, not like design.** The camera roll is edge to edge, square, a 2pt hairline, no corner, no caption: "each was defensible; together they made a photo grid that looked designed." | `CLAUDE.md`, Memories |
| **A gap separates by its ratio to its neighbours**, and the biggest break on a page falls between two pieces of content, never under the last one. | `space.md` P1, P7 |
| **One word per thing; buttons in Title Case; no exclamation marks; no em dash.** | `ten.md` rule 4, `voice.md` |
| **His own drawings carry the warmth.** One clean line, 15 to 25 strokes, dot eyes, a third of the canvas, shown in the page's ink. | `illustration-style.md`, the landing page |

## Already true on this site because of the same taste

Ink as the only accent (and, since 2026-10-13, light only, like his portfolio), the photographs and the mark as the only colour,
no lines, no shadows, the 15px floor, 44px targets, one face, the hero as the first
screen with one action on it. Most of those came from his `design.md` in v24 to v29.

## Taken on 2026-10-13 (v35)

- **Controls are capsules.** Every button and the email field, drawn round rather
  than with the superellipse corner (a capsule drawn as a superellipse is a lozenge).
- **One white button per screen.** The header's Subscribe is the soft capsule; the
  hero's is the one white button on the first screen, the footer's on the last.
- **Medium and Bold.** Prose went from 400 to 500, and two stray 600s (the buttons,
  the quote's name) went to 700, so the page has exactly two weights, Some Wins' two.
- **The sections read from the top.** The heading's capitals stand on the
  photograph's top edge; the air goes below. Centred, the heading floated about
  200px down beside the picture with nothing over it.

- **The gallery is a tight strip** (his pick, from three renderings). Some Wins draws
  photographs with almost no corner and a hairline between them; here it is 4px
  between them and a 4px corner, still 4:5 and inside the margins. He chose this over
  the edge-to-edge camera roll and over the 28px corner it replaced.

## What does not transfer, and why

- **The voice rules on copy.** No exclamation marks, Title Case buttons, one word
  per thing: Linda's words carry exclamation marks ("Sign Up for our Newsletter!",
  "Creativity in motion creates knowledge!"), and the copy gate holds the page to her
  words. The rule is his; the words are hers.
- **The drawings.** Some Wins' warmth is his hand. Nothing here may imitate it; if
  this site is to have drawings, he or Linda draws them.
- **The rounded type and the warm ground.** Some Wins sets SF Pro Rounded on a warm
  grey; this site's face (Inter) and its cool neutrals are both LOCKED.
- **The ground gradient** on somewins.xyz. "No gradients on the page" is LOCKED here.

## His portfolio, read for "professional" (2026-10-13)

*"Im not a fan of the grey text and the small caption under the hero i think making it
professional is the key thing also look at my portfolio for inspiration."* jaydenbetts.design
is not reachable from the build machine (the network policy refuses it), so it was read from
its own source, `main` of this repository, served locally and measured:

| | His portfolio | This site before | Now |
|---|---|---|---|
| The claim | 44px, 600, −0.03em, no caption under it | 68px, with a caption in 72% ink | 44px, no caption |
| A section heading | 26px (about), 36px (case study title) | 52px | 32px |
| Prose | 18 on 27, **in the ink** | 20 on 32 in 72% ink | 18 on 27 in the ink |
| Column | 1200px, 120px in at 1440 | 1342px, 49px in | 1200px |
| Heading beside a photograph | its top on the photograph's top (119 against 120) | (already taken in v35) | 0px |

What it does that is not taken: grey meta lines and 12px captions (he said no grey, and the
floor here is 15); hairlines under the header and between sections (no lines, LOCKED here);
the outlined Contact button (same).

## HEYTEA, for "clean modern" (2026-10-13)

*"I also think we should take a lot of inspo from the hea tea site like these clean modern sites."*
heytea.com does not resolve from the build machine, so this is Some Wins' own measurement of it
(`reference-board.md` §9, read off heytea.com with `getComputedStyle`): a pure white ground; one
weight everywhere; three inks; +0.10em tracking on everything; leading of exactly 1.5; lowercase;
and for chrome, a mark top left, two glyphs top right, **one hairline**, **no fills, no shadows**,
and a **plain outlined** button. Its drawings are open line art in a big empty field.

Taken here: the outlined main action, the single hairline under the header, the lighter weight
(his portfolio's 400/600 rather than one weight). Not taken: lowercase and the tracking, which
are a brand's voice and were drawn for HEYTEA's own face, not Inter.
