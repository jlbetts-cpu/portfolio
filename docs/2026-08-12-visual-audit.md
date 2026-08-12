# Visual audit — 2026-08-12

**Question asked:** where is this site weak, visually? What would a hiring design
director at a top product company notice in the first thirty seconds and mark it
down for?

This is not a conformance sweep. Token, contrast and 44px audits are green and
were not repeated. Screenshots live in `docs/audit-2026-08-12/`.

**Method.** Chromium and WebKit via Playwright, served from the worktree root on
`127.0.0.1:4192`. Screenshot fidelity was proved before any frame was trusted: a
rect stamped at independently-measured coordinates on `index.html` (the ink-filter
page) read back from the PNG with **zero pixels of error in both engines**. Viewports
1440×900 and 390×844, `daytime` and `night`, across `index`, `about`, `play`, the five
case studies, `headmaker`, `gradientlab`.

Findings are ranked by how much they would move a hiring manager's impression.
Each is tagged **DEFECT** (measurably wrong against the site's own rules or against
a fact) or **TASTE CALL** (a judgement that is Jayden's to make).

---

## The one-paragraph verdict

The chrome is genuinely good and genuinely systematic — 520 transition
declarations, only 33 with a raw duration literal, and the 10 literals that remain
are exactly the hand-tuned ones. Nobody will notice that. What they will notice is
that **the homepage shows two projects, every case-study cover is the same stock
meadow with phones pasted on it, and the case-study prose runs 107 characters to
the line.** The failure mode is not "sloppy". It is that the craft has gone into
the container and not into the work the container is holding, and a design
director reads the work.

---

# Tier 1 — these change the impression

## 1. All six case-study covers are the same picture. **TASTE CALL, but the highest-value one on the site**

![all six covers](audit-2026-08-12/01-covers-all-six.png)

Five of the six covers are 3–4 flat iOS screenshots pasted onto a stock
green-hill-and-blue-sky photograph. The sixth swaps the hill for an orange sand
dune. Jayden's own `alt` text says it out loud, five times: *"over a wildflower
meadow"*, *"over rolling hills"*, *"over a green field"*, *"over a forest"*.

**Why it reads as weak.** Three separate things go wrong at once and they compound:

- **They are indistinguishable from each other.** Scrolling the Case Studies tab
  is scrolling the same photograph five times. There is no visual identity per
  project, so the portfolio has no memory hooks.
- **The light does not match.** The photographs are lit warm and directional; the
  phone mockups carry soft symmetric drop shadows pointing straight down. Nothing
  makes contact with the ground. They read as *pasted*, not *photographed* — which
  is the exact tell of a Dribbble mockup template.
- **You cannot see any design work.** At the rendered card size each phone is
  ~150 CSS px wide on desktop and ~90px on mobile. Every screen is unreadable.
  The hero asset of every project communicates zero product detail.

And they collide head-on with the site's own material language. Everything else
here is flat white, hairlines, ink filter, and a stated rule that *nothing casts a
shadow except the heads, because a head is standing on something*. These six
rasters are saturated, glossy and full of baked-in drop shadows. They slipped past
the token audit because they are pixels, not CSS.

**This is the "competent but generic" risk in one asset class.** Everything else
on this site is unmistakably made by a person. The covers are the one place it
looks bought.

**Fix, in ascending cost.**
- *Cheap (an afternoon):* kill the photographs. Put the phones on a flat surface
  drawn from the site's own palette — `--c75`/`--c100` fields, one per project, so
  each cover has a colour identity. This alone removes the template smell.
- *Right (a weekend):* crop in. One screen per cover at 2–3× the current size,
  cropped to the single interaction that makes the project interesting. A cover
  should be a *claim*, not an inventory.
- *Do not:* re-shoot the same composition with better photographs. The composition
  is the problem, not the photograph.

---

## 2. The homepage shows two projects, and hides four behind a tab that sounds identical. **DEFECT**

![index fold](audit-2026-08-12/02-index-fold-1440.png)
![featured tab](audit-2026-08-12/03-index-featured-tab.png)

The default panel, "Featured", contains Bearings and Apollo. That is the entire
homepage: hero → two cards → footer, 3140px total.

The tab next to it, "Case Studies", contains Bearings, Apollo, UC Davis, Strata,
Cluster and R3SHORE. It is a **strict superset** — the first two `<article>`s are
byte-identical duplicates rendered twice into the DOM.

Three things are wrong here and the third is the one that costs interviews:

1. **The labels are not a mutually exclusive set.** The two things under "Featured"
   *are* case studies. A visitor has no reason to believe "Case Studies" holds
   anything they have not already seen, so they don't click.
2. **The third tab, "Extras", holds exactly one item** (§4 below). A three-tab
   control where one tab has two things, one has six, and one has one is not
   organising anything — it is padding.
3. **Two-thirds of the portfolio is one un-signposted click away.** A director
   scanning for 30 seconds forms their view from what is on screen. Right now that
   view is "he has two projects."

**Fix (an hour).** Delete the tab control. Show all six cards in one column,
newest first, R3SHORE last with its in-progress treatment. If a filter is still
wanted later, it should filter a visible list, not gate it. Cost: removing the
duplicate panel actually *shrinks* `index.html`.

*(Noting the memory: the Play menu's dots-and-grid is evidence-backed and off
limits. This is a different control on a different page, and the evidence here
points the other way.)*

---

## 3. Case-study body copy runs 99–107 characters per line. **DEFECT**

![apollo fold](audit-2026-08-12/06-apollo-fold-1440.png)

Measured at 1440, counting rendered lines against character count:

| page | class | width | chars/line |
|---|---|---|---|
| apollo | `.secBody` | 1120px | **99** |
| bearings | `.secBody` | 1120px | **101** |
| ucdavis | `.secBody` | 1120px | **107** |
| about | body `<p>` | 586px | 52 ✓ |
| apollo | `.baBody` | 680px | 68 ✓ |

The comfortable range is 45–75. Ninety is the outside limit anyone defends. **107
is a wall.** This is on the five pages a hiring director actually reads, and it is
the difference between "I read his Apollo case study" and "I skimmed the headings".

You asked whether the 760px measure is right. **The answer is that there is no
760px measure on the body copy at all.** `apollo.html` carries seven distinct
measures — 880, 980, 899, 860, 760, 680, 70ch — and `.secBody` / `.ovBody` carry
**zero `max-width` declarations in all five case studies**. The one class doing the
most reading work is the only one with no cap. Where a measure *is* applied
(586–680) it is correct.

**Fix (fifteen minutes, five files).** `.secBody, .ovBody { max-width: 68ch }`.
760px at 20px Instrument Sans lands at ~68 chars, so the 760 already in the file is
the right number — it just needs to reach the right selector.

---

## 4. The one thing under "Extras" is the weakest asset on the site. **TASTE CALL**

![extras tab](audit-2026-08-12/05-index-extras-tab-reel.png)

"Wired to fail", 2026. A low-resolution phone video of Jayden lying on a sofa,
with a hand-drawn signature overlay that at this scale resolves into illegible
white blobs. It is given a full-bleed 1200×830 card — the same real estate as a
case study — and it is one of three top-level things the homepage offers.

Everything else on this site is made with obvious care. This is not, and it is
sitting in a slot that says "this is a third of my work".

**Fix.** Either it earns the slot — retitle it so a stranger knows what they are
about to watch, fix the overlay, and give it a real poster frame — or it moves to
`play.html` with the other experiments and the tab dies with §2. My read: it
belongs in Play.

---

## 5. The play headline's punctuation is a photograph of an anatomical heart. **DEFECT**

![hunger](audit-2026-08-12/07-play-headline-hunger.png)
![love](audit-2026-08-12/08-play-headline-love.png)

The `.pMoodSlot` swaps the last word every 8.5 seconds — empathy → hunger →
delight → love, forever — and replaces the full stop with the mood's glyph. The
idea is lovely and the code is careful (the casing bug is designed out, not
patched).

At render it does not survive:

- The glyphs are **full-colour photographic objects** — a cookie, a disco ball, a
  camera, and for "love" **a veiny anatomical human heart**. "Made with love" +
  raw cardiac tissue reads as gore, not affection.
- They sit at roughly a third of cap height, hard against the final letter with no
  space, riding the baseline. At a glance the cookie reads as a smudge on the
  screen and the heart reads as a rendering artifact.
- They are the only saturated pixels in an otherwise pure-ink headline.

**Also worth naming:** the h1 rewrites itself every 8.5 seconds indefinitely. That
is motion nobody asked for, applied to the single element on the page whose job is
to be read once and understood.

**Fix (an hour).** Keep the word cycle; it is the good half of the idea. Set the
glyph in ink at full stop scale, or drop it and let the period be a period. If the
photographic objects stay, they need to be ~2× larger with a space before them —
at which point they are a design decision rather than a speck. And give the cycle a
stop: run it two or three times, then rest on one word.

---

# Tier 2 — a trained eye catches these in the first minute

## 6. On a case study, the page title and its section headings are the same size. **DEFECT**

Measured type scale:

| element | size |
|---|---|
| `about.html` h1 "Hello, I'm Jayden Betts." | **52px** |
| `index.html` h1 (the value proposition) | 40px |
| `play.html` h1 | 40px |
| case-study h1 (the project title) | **37.4px** |
| case-study h2 `.secHead` | **36px** |
| case-study h3 `.subHead` | 32px |

Two problems, both visible in the apollo screenshot:

- **h1 and h2 differ by 1.44px.** There is effectively no hierarchy between "An
  ADHD-native social app with no streaks, no counts, and no color" and "Small wins
  are the whole game." A reader scanning for structure gets no signal.
- **The scale is inverted across the site.** The largest headline anywhere is
  *"Hello, I'm Jayden Betts."* — 30% larger than the homepage's actual pitch and
  39% larger than any project title. The least differentiating sentence on the site
  carries the most typographic weight.

**Fix (thirty minutes).** Move the case-study h1 to `--fs-pagehead` (52px) so it
outranks `--fs-h2` (36px) by a full step, and it will match About rather than lose
to it. Do not shrink the section heads — 36 is right for them.

Related, one to check: the case-study h1's accessible name is `"ApolloAn ADHD-native
social app…"` — the eyebrow is inside the `<h1>` with no separator.

## 7. The homepage hero headline never grows. **TASTE CALL, with an argument**

`index.html` and `play.html` set their h1 to `--fs-heroline`, which aliases
`--fs-pagehead-sm` = `clamp(30px, 8.2vw, 40px)`. It hits its 40px ceiling at ~488px
of viewport, so **the homepage headline is the same 40px on a phone and on a 27-inch
monitor.** Meanwhile `--fs-hero` — `clamp(38px, 4.7vw, 60px)` — is declared in three
files and is not what renders.

`tokens.css:397` documents this as deliberate: the bare rung is sized for one line
and these h1s wrap to two or three. That is a fair argument and I am not calling it
a defect. (`index.html:83` calls `--fs-heroline` "the hero headline's **mobile**
rung", which is stale — worth correcting either way.)

**But** the consequence is visible in the fold shot: at 1440×900 the hero is a
900px field containing a 40px headline sitting 201px below the nav, with 137px of
air below the head. The type is under-scaled for the room it has been given, and it
loses to the About page's greeting. A two-line hero should be smaller than a
one-line hero — it should not be smaller than "Hello."

**Proposal.** Give the two-line heroes their own rung, e.g.
`clamp(40px, 3.6vw, 52px)`: unchanged on mobile, matches `--fs-pagehead` at desktop,
still a step below `--fs-hero`. One token, two call sites.

## 8. Thirty-two infinite animations run on the homepage with nothing to show. **DEFECT**

Measured with `document.getAnimations()` at t = 1.2s / 4s / 10s / 20s:

| page | running at t=20s | visible targets | invisible targets |
|---|---|---|---|
| `index` (daytime, the **default**) | 32 | **0** | **32** |
| `index` (night) | 32 | 32 | 0 |
| `play` (daytime) | 5 | 1 | **4** |
| `about` | 0 | — | — |

`.heroNightStars` computes `opacity: 0` in daytime, but its 32 `heroStarTwinkle`
animations keep running forever. Daytime is the deliberate default *precisely so a
recruiter lands on the legible state* — so every first-time visitor pays for 32
forever-looping animations that render nothing. On play, four `moodIco` animations
loop inside a closed dropdown.

**Fix (one line each).** Gate on the theme state:
`:root:not([data-theme-state="night"]) .heroNightStars i { animation-play-state: paused }`,
and the same for the mood icons when the menu is closed.

## 9. Three tab components, three tab treatments, one job. **DEFECT**

| where | treatment |
|---|---|
| `index` Featured/Case Studies/Extras | continuous hairline across the full row + a sliding ink underline |
| `headmaker` Photo/Cutout/Face/Alive | **four separate rule segments with gaps**, active one thickened |
| `gradientlab` Look/Nodes/Flow/Optics/Stage | no rule at all; a single underline under the active tab only |

![headmaker](audit-2026-08-12/12-headmaker-1440.png)
![gradientlab](audit-2026-08-12/13-gradientlab-1440.png)

**Which should win:** the `index` pattern — continuous hairline plus a sliding ink
underline. It is the only one of the three that shows the *set* as a set, and the
sliding underline is the only one that carries motion meaning (it moves, so it
tells you where you came from). Cost: one shared rule; both tool pages already use
`.collection__tabs`-adjacent markup.

Also on `index`: the three tabs are stretched to **389px wide each** across a 1200px
row. Three options with 389px of travel between them reads as a nav bar, not a
filter. If §2 lands, this disappears anyway.

## 10. The hairline — the site's only separator — has three different greys. **DEFECT**

The design rule is that chrome separates with hairlines and translucency and
*never* elevation. That rule is being kept: every "card" here uses
`inset 0 0 0 1px`, not a drop shadow. Good. But the hairline itself is drawn two
ways with three results, composited over `--c50` `#FDFDFD`:

| mechanism | value | resolves to |
|---|---|---|
| inset rim | `rgba(17,18,20,.12)` | `rgb(225,225,225)` |
| inset rim (`--rim-1`) | `rgba(18,18,18,.08)` | `rgb(234,234,234)` |
| `border: 1px solid` | `--c100` `#E6E6E6` | `rgb(230,230,230)` |

On `apollo.html` these sit adjacent: `.cover` (rim, 225) directly above `.facts`
(border, 230). Nine levels apart, one above the other. Because the hairline is
doing *all* the separation work on this site, its consistency matters more here
than it would anywhere else.

**Which should win:** `--rim-1`, the token. Convert the `border: 1px solid var(--c100)`
sites and delete the `.12` variant.

## 11. The radius ladder is inverted inside the head-maker. **DEFECT**

Same layout, three nested surfaces:

| element | size | radius |
|---|---|---|
| `.mkStageCol` | 816×788 | 20 |
| `.mkStage` | 590×708 | **14** |
| `.mkPanel` | 360×788 | 20 |

The 590-wide stage wears the **control** rung (`--r-md` 14) while the 360-wide
panel next to it wears the **card** rung (`--r-lg` 20). Whichever way you read the
size-class rule, the larger surface should not have the tighter corner. It is
visible in the screenshot: the inner white box has noticeably sharper corners than
the panel beside it.

Same class of thing on `play.html`: `.pCard` (594×119) is radius 14 — the four Play
menu cards are wearing the control radius. Per the ladder, cards take 20.

## 12. The Role/Problem/Solution card lands on top of the work it describes. **DEFECT**

![info card over the artwork](audit-2026-08-12/04-index-casestudies-tab-infocard.png)

`#csInfoCard` follows the cursor over a case-study card. In the capture it is
sitting squarely over the third and fourth phone screens — the only two things on
that cover a viewer might be trying to read. An affordance that reveals information
by hiding the subject is working against itself.

**Fix.** Anchor it outside the card — in the left gutter, or in the `.csMeta` row
beneath, which is currently just "Bearings … 2026" and has 1200px of room. Cheaper
still: make it the card's permanent caption and drop the hover entirely. The
content (Role / Problem / Solution) is exactly what §2's problem is — a director
who can't see it doesn't know what he did.

---

# Tier 3 — real, cheaper, still worth doing

## 13. "Tap to change" on a 1440px desktop. **DEFECT**
`.amsHint` renders "Tap to change" at every width. On desktop the interaction is a
click. Also: the four dots sit bottom-left, "Tap to change" bottom-right, and the
caption below-left — **three labels for one control, on two rows.** Consolidate to
one line: caption left, dots right, no hint (the dots are the affordance).

## 14. The About page's paragraph gap reads as a section break. **DEFECT**
![about rhythm](audit-2026-08-12/14-about-prose-rhythm.png)
Paragraph-to-paragraph gap measures **48px** against a 30px line-height — 1.6 line
heights. Standard is 0.5–1.0. Every paragraph looks like its own section, which
turns a three-paragraph story into three disconnected blocks and inflates the page.
Drop to 24px (`--sp-24`, 0.8 line-heights).

## 15. Four different distances between the nav and the first line of the page. **DEFECT**
Nav bottom is 60px on every page. Distance from there to the h1:

`about` 36 · `apollo`/`cluster` 76 · `play` 148 · `index` 201

`about` and the case studies are both top-aligned content pages doing the same job
and they differ by more than 2×. (The footer gap, by contrast, is a consistent 152
everywhere — that part of the rhythm is solid.) Pick one value for top-aligned
pages; `apollo`'s 76 is the better of the two.

## 16. The About page shows the same four links twice within one screen. **TASTE CALL**
"Get in touch" (Email / LinkedIn / Instagram / Résumé, wrapping 3+1 with Résumé
alone on its own row) sits ~400px above a footer whose Contact column is LinkedIn /
Instagram / Email and whose Menu column ends in Résumé. Keep the buttons — they are
the better treatment and they carry the CTA — and let the footer be navigation only.

## 17. Two `<h1>`s that are not headlines. **DEFECT**
`headmaker.html` h1 is `font-weight: 700` — off the two-weight system (400/600) —
with `line-height: normal`, visually hidden at 1×1px. `gradientlab.html`'s h1 is
**15px**, smaller than body text. Three names for that page, too: the Play card says
"Make a gradient", the page says "Gradient Maker", the label says "FLUID MESH
SYSTEM".

## 18. Four text roles never got the leading ladder. **DEFECT**
`.statSrc`, `.csReach`, `.playerCap` and `blockquote.pull` all compute
`line-height: normal` — the browser default, not a rung. This is the known
"ladder extended, call sites never moved" gap, still live on the case studies.

## 19. Mobile: two of the four destinations are unlabelled glyphs. **TASTE CALL**
![index mobile](audit-2026-08-12/15-index-mobile-390.png)
At 390 the nav labels only the **active** item. A first-time visitor landing from
LinkedIn sees `Work` labelled, then a person glyph, a gamepad glyph and an
envelope. The adaptive-label idea is clever and saves real width — but it spends
its cleverness on the one surface where a stranger arrives with no context. Worth
testing labels-always at 390; the row has the room.

## 20. Mobile: the hero head sits 73px left of centre with the right 43% empty. **TASTE CALL**
Deterministic across five loads, both engines: at 390 the head's visible box is
`x = 22 → 221` in a 390 viewport, and its layout box starts at **−11px** — bleeding
off the left edge. Centre would be 95→294.

I am not flagging the drag-off-the-edge behaviour; that is deliberate and it is
good. This is its **resting position on first paint**, which is a composition
decision rather than an interaction one, and every mobile visitor gets it. Nudge
the initial placement to centre and let them drag it wherever they like.

---

# What I checked and found *not* to be a problem

Worth recording, because two of these looked like findings until I looked properly.

- **The ink filter on mobile headlines.** At a 2× downsample the case-study h1
  looked shredded. At true 3× device pixel ratio it is a subtle, handsome
  roughening, and Chromium and WebKit render it near-identically
  (`18-ink-filter-at-3x-chromium.png` / `19-…-webkit.png`). **Not a defect** — my own
  screenshot was lying.
- **The About page's "empty right column."** The layout probe said the photo panel
  ended 1443px before the text did. It is `position: sticky` and follows the reader
  down, changing image per section. It is one of the best-made things on the site.
- **Transitions.** 520 declarations, **33** with a raw duration literal — and the ten
  distinct literals are exactly `680 / 1000 / 1200` (the About dissolve),
  `640` (the sky), plus `400 / 520 / 760 / 900 / 1.15s`. 94% tokenised. This is a
  real system and it is well kept.
- **The no-shadow rule.** Every card surface uses an inset rim, not elevation. The
  rule is holding everywhere in CSS. (The only violations are baked into the cover
  rasters — §1.)
- **The always-on selection frame** and **the time-of-day sky**. Both deliberate,
  both working. One observation offered without a recommendation: in `night`, the
  blue selection frame is the most saturated element on the page and wins the eye
  before the h1 does (`11-index-night-fold.png`). That may be exactly what you want
  — the frame is the invitation. Flagging it only so it is a choice.
- **The soccer chaos.** Not audited, deliberately, and no tidiness is proposed.

---

# Answers to the four lenses, straight

**1. Composition and hierarchy.** The eye order on `index` at 1440 is: nav pill →
headline → head → CTA. That is nearly right, but the headline is under-scaled for
its field (§7) and 201px of dead air sits above it (§15). Below the fold the page
has *no* focal point, because the focal object is a stock meadow (§1). Vertical
rhythm is consistent where it was systematised — footer gap is 152 on every page —
and inconsistent where it was not: four different nav-to-h1 distances. The measure
is right at 586–680 and catastrophic at 1120 (§3).

**2. The animation system.** It is **two systems wearing one name.** State change is
systematised: six duration rungs, 94% tokenised, exits faster than entrances,
protected hand-tuned values. Ambient and character motion is not: **66 distinct
`@keyframes`**, every one of them driven by a raw literal, 19 distinct durations from
1s to 9s, none from the ladder — including three keyframes named `popin`, `popIn`
and `popName`. That split is defensible in principle (character animation is not
state change) but nothing marks the boundary, and everything unrequested lives on
the ambient side: 32 invisible infinite loops on the default homepage (§8), a
headline that rewrites itself forever (§5). Motion carries meaning in the sliding
tab underline, the head's arrival, and the sky. It is decoration in the star field
and the mood glyphs.

**3. Consistency of pattern.** Three tab components (§9), three hairline greys
(§10), an inverted radius ladder (§11), three label-over-value treatments for the
same "facts about this project" job (case-study `Role/Scope/Timeline/Year` 4-up,
About's `At a glance` 2×2, the hover card's `Role/Problem/Solution` stack), and
two collection-card languages that share nothing — `index`'s full-bleed 1200×600
photographic card versus `play`'s 594×119 icon-and-text box. The case studies also
disagree with each other: two of five carry a `roleHead` block in the hero and
three do not; evidence appears as pull quotes on `ucdavis` only, as big stats on
three, and not at all on `cluster`.

**4. The materials problem.** The collision is not where the brief guessed. The
photographic heads against flat CSS chrome **works** — the contact shadow sells it,
the selection frame frames it as an object, and the whole thing reads as
deliberate. The real collision is that the site keeps pasting *other* photographic
objects into that flat chrome without giving them the same treatment: the six
stock-meadow covers (§1) and the mood glyphs (§5). Both are photographs dropped in
at the wrong scale with no grounding. The heads earned their photography. Nothing
else did. **That is what makes it look like a template rather than something made** —
not the chrome, which is excellent, but the imagery the chrome is holding.

---

# What I did not look at, and why

- **The soccer match, the tournament bracket, the marble race, and the battle
  abilities.** Two other agents are live in `play-engine.js`, `play-tournament.js`
  and `tournament.css` right now, so anything I measured would be stale by the time
  you read it. The chaos is also explicitly out of scope for tidying.
- **Motion under `prefers-reduced-motion: reduce`.** Not sampled. Worth its own pass,
  particularly for §5 and §8.
- **Reading order, focus order, screen-reader output.** This was a visual brief. The
  one accessibility thing I tripped over is noted at §6 (the h1's run-on
  accessible name).
- **Performance.** The 32 invisible loops (§8) are reported as a design defect, not
  a perf claim; I did not measure frame cost, and this environment cannot measure it
  honestly.
- **`specimen.html`, `button-system.html`, `orbs.html`, `accent-swatches.html`,
  `header-prototype.html`.** Internal reference pages, not visitor-facing.
- **The `night`/`daytime` pair only.** The other four sky states (pre-dawn, sunrise,
  dusk, sunset) were not screenshotted.

---

# If you only do five things

1. **§1** — get the phones off the stock meadows. Highest impact per hour on the
   whole site.
2. **§2** — delete the tab control; show all six projects on the homepage.
3. **§3** — one `max-width: 68ch` on `.secBody, .ovBody`.
4. **§6** — case-study h1 to 52px, so the project title outranks its own section heads.
5. **§8** — pause the 32 star animations when the sky is not night.

One through four are roughly a day of work between them and they are the four a
hiring director would actually notice.
