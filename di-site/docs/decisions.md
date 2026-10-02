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

This file is the index of what cannot be changed without asking.

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
| **No gradients on the page.** The one exception is the hero mark's sheen, asked for by name | rejected twice, 2026-08 | "the gradients look cheap" |
| **No coloured text, no hue as a border, no coloured dot before a label** | settled | the `<mark>` highlights were built and taken out the same day: "i actually dont like the highlights" |
| **One photograph shape**: a 4:5 rectangle on the superellipse corner, and the circle belongs to the ring | settled | a mixed set of four shapes was built and rejected |
| **The curtain is flat**, not pleated, and shows once a session | settled | "it looked a lot cleaner when it wasnt like actually a curtain" |
| **The header is clean**: no container, no bar, leaves going down and comes back going up | 2026-09-06 | "i would rather it be a clean header though not in a container or anything just minimal and clean" |
| **The hero has no container either** | 2026-10-02 | "does the hero really need to be in a container I feel like less is so much more" |
| **The hero is simple, with the logo prevalent.** No gallery of drifting images in it | 2026-09-29, Linda | "far too busy too many images a much more simple hero would do wonders" |
| **The about is two sections** — what Developmental Improvisation is, and who Linda is | 2026-09-29, Linda | — |
| **One face.** Geist, 400 and 700 | 2026-09-29 | "lets make the site feel a lot more focused and mature" |
| **The photographs under the hero are a VERTICAL scroll** — columns rising on their own, faded at the top and the bottom | 2026-10-02 | "the reference I liked was more of a vertical image scroll"; the horizontal strip lasted one round |
| **The gallery cannot be scrubbed by hand.** It drifts and it fades; there is no wheel handler, and a wheel over it scrolls the page | 2026-10-02 | "you cant like manually scroll through like the old version I like how it fades" |
| **No statistics under the newsletter button** | 2026-10-02 | "take out the statistics under the sign up for newsletter" |
| **Sections breathe.** `--section-y` between sections, never a tile gap | 2026-10-02 | "the spacing of the site feels so cramped not premium" |

---

## GUIDED

| Rule | The number | The range | Where it lives |
|---|---|---|---|
| Type floor | **15px** | nothing under it but a glyph inside a shape; Strata says 15pt and the page now matches it | `--fs-caption`, `--fs-small` |
| Type weights | **400 / 700** | two, and no third | `tokens.css` |
| Display scale | 4.25rem top, −0.035em | down, not up; Geist's x-height is 0.52em | `--fs-display` |
| Section rhythm | `clamp(80px, 8vw, 168px)`, ring at 1.4× | 115px at 1440 measured | `base.css` |
| Gutter | `clamp(20px, 3.4vw, 64px)` | 49px at 1440; under 30 reads as a brochure | `--gutter` |
| Contrast | 4.5:1, measured on the ground it sits on | — | `contrast.mjs` |
| Targets | 44px, measured not declared | one exemption: inline prose links | `targets.mjs` |
| Motion | 6 rungs: 100 / 160 / 240 / 280 / 360 / 500 | hover arrives in 160 and leaves in 240 | `--dur-*`, `--t` |
| Gallery speed | `--gallery-px` 11 per degree, 41px/s at rest | per-column rates 0.9–1.18; equal rates read as one sliding sheet, not masonry | `tokens.css`, `main.js` |
| Mark turn | ±30° across, ±20° up and down, τ 0.2s | past ~35° a flat mark shows its edge | `main.js` |
| Ring geometry | eight items at 0.765r apart; the quote fits a rectangle inscribed in `2r − item` | — | `home.css` |
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
| **Masonry with mixed heights** | The reference's columns hold photographs of different proportions. Here every photograph is 4:5 (LOCKED) and the masonry comes from offsets and speeds. Mixed ratios would reopen the lock — his call. |
| **The hero mark in dark** | The sheen reads as pastel on the dark ground where it reads as a band on the light one. Worth another pass. |
| **A second photograph for the sections** | Both are strong; if Linda's copy is short, 4:5 may want to become 3:2. |
