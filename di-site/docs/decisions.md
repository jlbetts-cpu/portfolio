# What is settled, what has a range, and what is open

Written 2026-10-02, taking the one structural idea from Jayden's own `design.md`
for Strata: **separate the decisions that are final from the ones that are open
to interpretation.**

Everything in `design-system.md` and `BUILD-LOG.md` records WHY. Nothing recorded
**whether it may be reopened**, and the cost of that is on the record:

- The ring was merged into the testimonials on my own reasoning — 880px of ground
  that was 71% empty, three more equal tiles — and had to be reverted in full.
  His words: *"I actually love the creativity and motion section."* The reasoning
  was sound and the decision was not mine to take.
- Gradients were built and rejected twice, coloured dots once, a band twice,
  `<mark>` highlights once, a pleated curtain once. Each is in the log; none was
  marked as closed.

This file is the index of what cannot be changed without asking. `taste.md` is the evidence of how he designs, read from Some Wins.

| | What it means | What to do |
|---|---|---|
| **LOCKED** | He decided it, usually after seeing it both ways. | Do not change it. Do not re-propose it. If new evidence genuinely bears on it, say so in one line and let him answer. |
| **GUIDED** | A rule with a number and a range. The number is argued. | Work inside it. Moving it needs a measurement and a note at the site. |
| **OPEN** | Not decided, or waiting on Linda. | Propose freely. Render alternatives rather than picking one. |

**A measurement does not promote a LOCKED item.** The ring merge measured better
on every number I had and was still wrong.

---

## LOCKED

| Decision | When | His words, or the record |
|---|---|---|
| **The quote ring stays as it is** — eight circular photographs turning around Linda's one line | 2026-09-07 | "I actually love the creativity and motion section"; the merge into testimonials was reverted in full |
| **No gradients on the page.** The one exception is the hero mark's glint, asked for by name | rejected twice, 2026-08 | "the gradients look cheap" |
| **No coloured text, no hue as a border, no coloured dot before a label** | settled | the `<mark>` highlights were built and taken out the same day: "i actually dont like the highlights" |
| **One photograph shape**: a 4:5 rectangle on the superellipse corner, and the circle belongs to the ring. In the gallery the corner is 4px (below) | settled | a mixed set of four shapes was built and rejected |
| **The film strip's frames**: 6px of base between them, a 2px corner, every one 4:5. The sections' and the lightbox's single photographs keep the large corner | 2026-10-14 | it was the tight strip (4px apart, 4px corners, "B: tight strip") until it became film |
| **The curtain is flat**, not pleated, and shows once a session | settled | "it looked a lot cleaner when it wasnt like actually a curtain" |
| **The header is a floating pill**, solid white with a 1px edge, centred at the top: the logo and the name, About · Testimonials · Contact, an outlined Subscribe. No bar across the page, no blur. It leaves going down and comes back going up | 2026-10-13 | "can you experiement with the header i dont much like it right now", D of five rendered; then "lets make it more clean remove the blur" |
| **Light only.** No dark theme and no switch; `data-di-theme="light"` is in the markup. It was dark only for one day | 2026-10-13 | "should we just do light mode as well not dark mode?", then, shown both beside his portfolio: "Light only" |
| **The page answers to its own theme attribute only** (`data-di-theme`). A host's `data-theme` is never read | 2026-10-03 | the claude.ai preview writes `data-theme="dark"`, and keying the dark tokens on it is why dark mode "would not go away" |
| **No cards on the testimonials.** The footer is his portfolio's: one full-width hairline, the mark, a line and the copyright on the left, Menu (About, Testimonials, Newsletter) and Contact (Email, Call) on the right, 44px rows | 2026-10-13 | "the footer with the clean lines"; "remove the bring to your own school" |
| **The hero mark is the logo in the tuned palette, with a glint of white light** crossing it every six seconds, tied to the tilt. The same eight hues, lightness pressed from 0.58–0.93 into 0.64–0.80 in its own order, the yellow nudged to gold; the star is gold, never white and never black | 2026-10-13 | "the big thing for me is the logo can you find like optimal colors", "B tuned", "make sure the star is also a color I dont like it black" |
| **No grey text.** Every word on the page is in the ink; hierarchy is size and weight. Only a field's placeholder and the skip link (inverted) differ | 2026-10-13 | "Im not a fan of the grey text"; the layout gate fails on any visible word in another colour |
| **The hero carries no caption.** The mark, the claim and the one action | 2026-10-13 | "Im not a fan of … the small caption under the hero" ("Pre-wiring the brain & educating the heart") |
| **Apple's bands.** A pure white page, every other section on Apple's #F5F5F7 edge to edge (the first section, the ring, the closing section and the footer), no gaps between them: the change of ground is the break | 2026-10-13 | "lowkey want it to look more apple", then "Grey bands" from a rendered pass. Apple's blue was rendered and not taken: ink stays the only accent |
| **The headline is one colour**, all ink. No half of the claim set a tier down | 2026-10-03 | "why is emotional understanding greyed out … I feel like that should all be black" |
| **Lines in three places only**: the header pill's 1px edge, the hairline over the footer, and the 1px ring inside an outlined control. Space separates everything else | 2026-10-13 | "the footer with the clean lines"; all lines had gone on 2026-10-03 ("remove the lines") |
| **The hero is the first screen; the reel only peeks under it** — 32 to 80px of it on a screen that holds the hero | 2026-10-03 | "you should be able to barely see that its under the hero" |
| **The brand in the header is the black-and-white logo and the name**: the whole DI mark, 28px, in the ink. The colour lives in the hero's mark | 2026-10-13 | "the glyph though can we just use the black and white di logo" (over the coloured "di" monogram tried first; the name alone from 2026-10-03) |
| **The hero has no container either** | 2026-10-02 | "does the hero really need to be in a container I feel like less is so much more" |
| **The hero is simple, with the logo prevalent.** No gallery of drifting images in it | 2026-09-29, Linda | "far too busy too many images a much more simple hero would do wonders" |
| **The about is two sections** — what Developmental Improvisation is, and who Linda is | 2026-09-29, Linda | — |
| **One face: Inter**, 400 and 600, his portfolio's pair (500/700 for the dark day, 400/700 before), with its optical-size axis (display design at 32px and up). It replaced Geist (2026-09-29), which replaced Jost and Plus Jakarta Sans | 2026-10-12 | "i dont think I like the font I think id prefer inter"; weights "2 portfolio pair", 2026-10-13 |
| **The photographs are a film strip between the hero and the first section**: 35mm film, the frames on a near-black base 6px apart, eight sprocket holes to a frame along both edges (the page's white showing through), sliding sideways; 218px at 1440 and 143 on a phone, full bleed, starting at the hero's peek | 2026-10-14 | "a horizonatal band spliting up the hero and the next section", "make the band a little thicker", "I would love if it was designed kinda like a film strip" |
| **The reel keeps one shape.** Every photograph in it is 4:5 | 2026-10-02 | asked with the reference's mixed-height grid beside it: "Keep one shape" |
| **The reel cannot be scrubbed by hand.** It drifts on the flow and a pointer holds it; there is no wheel handler, and a wheel over it scrolls the page. (At the page's foot a scroll past the end turned the flow while the gallery lived there; that went with it) | 2026-10-02 | "you cant like manually scroll through like the old version I like how it fades" |
| **No statistics under the newsletter button** | 2026-10-02 | "take out the statistics under the sign up for newsletter" |
| **Sections breathe.** `--section-y` between sections, never a tile gap | 2026-10-02 | "the spacing of the site feels so cramped not premium" |

---

## GUIDED

| Rule | The number | The range | Where it lives |
|---|---|---|---|
| Type floor | **15px** | nothing under it but a glyph inside a shape; Strata says 15pt and the page now matches it | `--fs-caption`, `--fs-small` |
| Type weights | **400 / 600** | two, and no third: his portfolio's Regular and Semibold. The layout gate fails on any third weight | `tokens.css`, `layout.mjs` |
| Controls | **a pill on the superellipse** | every button and field: radius at least half the height, `corner-shape` the page's, as his portfolio's `.ctl` | `base.css`, `layout.mjs` |
| The main action | **outlined**: the page's white, a 1px inset ring of the ink at 12%, ink type | no control anywhere is filled darker than mid-grey ("such a dark cta … doesnt really fit"); the layout gate fails on one | `components.css`, `layout.mjs` |
| The sections | **a centred stack**: the headline, the words, then the photograph, on the page's centre line (within 2px, measured); on a phone the block reads from the left | Apple's ("Centred sections", 2026-10-13). Before that, photograph beside text with the heading on the photograph's top edge | `home.css`, `layout.mjs` |
| Display scale | **72px** claim (40 on a phone) at -0.032em; sections' headlines **56** at -0.03em; Semibold | Apple's scale, picked from a rendered pass ("Apple-size headlines", 2026-10-13). His portfolio's 44/32 for the afternoon before | `--fs-display`, `--fs-h1` |
| Reading sizes | `--fs-read` **21 on 30** for the sections' copy, centred under its headline (Apple's section copy), `--fs-quote` 23px for the quotes | body size (16px) is for chrome; a paragraph the page wants read is never set at it beside a photograph | `tokens.css` |
| Section rhythm | `clamp(80px, 8vw, 168px)`, ring at 1.4× | 115px at 1440 measured | `base.css` |
| Gutter | `clamp(20px, 3.4vw, 64px)` | 49px at 1440; under 30 reads as a brochure | `--gutter` |
| Column | **1200px** of content (120px in from each edge at 1440) | his portfolio's column (2026-10-13). It was 1720 wide, answering "small spacing from the outer edge" for cards that went in v21 | `--page-max` |
| Contrast | 4.5:1, measured on the ground it sits on | — | `contrast.mjs` |
| Targets | 44px, measured not declared | one exemption: inline prose links | `targets.mjs` |
| Motion | 6 rungs: 100 / 160 / 240 / 280 / 360 / 500 | hover arrives in 160 and leaves in 240 | `--dur-*`, `--t` |
| Reel speed | `--reel-px` 11 per degree, 41px/s at rest (42 measured) | the flow is the ring's too, so the two keep one tempo | `tokens.css`, `main.js` |
| Reel edges | **cut clean**, no fade: the screen's edge is the row's | "remove the blur" … "the carousel fade too" (2026-10-13) | `home.css`, `reel.mjs` |
| Mark turn | ±30° across, ±20° up and down, τ 0.2s | past ~35° a flat mark shows its edge | `main.js` |
| Ring geometry | eight items at 0.765r apart; the quote fits a rectangle inscribed in `2r − item` | on a phone, r = min(token, 50vw − item/2 − 12px) and the item is `clamp(60px, 19vw, 80px)`: every circle whole on the screen | `home.css`, `tokens.css` |
| Phone | touch is not a narrow desktop: hover only inside `(hover: hover)`, fields 16px, the closing field is not a panel below 768 | — | `mobile.mjs` |
| Colour | the photographs and the mark's sweep, nothing else | Strata's rule, applied in v24: "saturated colour means a win or a photograph; chrome is ink and light". Neutrals are cool — a blue-black ink, a near-white ground | `tokens.css` |

---

## OPEN

| Thing | Status |
|---|---|
| **The body copy** of both sections | Placeholder. Linda is writing it. |
| **Three testimonials** | Placeholder. Needs a name, a role and a short quote each. |
| **The newsletter endpoint** | `[NEWSLETTER_ACTION_URL]`. Mailchimp, a form, or her inbox — her call. |
| **The phone number** | (857) or (877), never confirmed. |
| **The mark against feedhippo.com** | Built from his description — the site was unreachable from the build machine, so the turn has not been compared with the reference side by side. |
| **A second photograph for the sections** | Both are strong; if Linda's copy is short, 4:5 may want to become 3:2. |
