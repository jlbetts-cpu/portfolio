# The hero headline

**Date:** 2026-08-03
**Question:** replace `Product designer working on iOS, B2C and design systems with [mood]` with
`SF Product designer working on iOS, B2C and design systems.`
**Status:** research + recommendation. Nothing in this document has been implemented.

Claims are tagged the way the Notion research page tags them:
**(a) research** — a published study or a documented editorial convention.
**(b) shipping product** — observed in a live site or in this repo.
**(c) inference** — my reasoning from the two above.

---

## 0 · Verdict in one paragraph

**Deleting `with [mood]` from the headline is right, and I would not argue him out of it.**
The proposed line is about 80% of the way there. Three things are wrong with it, and only one is
cosmetic:

1. `SF Product designer` — the capital **P** is a mistake. Mid-sentence it reads as broken title
   case. It has to be `SF product designer`.
2. `SF` as the **first word of the page** is the weakest position for the most compressible
   token on it, and no portfolio in a 30-site sweep opens with a bare two-letter city
   abbreviation.
3. **It stays at three lines.** At the shipping measure his line wraps to **three** lines, the
   same as today. So it does not fix the thing he has just said bothers him most — that the hero
   sits too low and the head is not visible enough at the start. **A two-line headline at 40px
   is ~89px against today's 134px: it returns ~45px directly above the head.** That is the
   single biggest lever in the hero and his line does not pull it.

The period is defensible but conventionally wrong on a noun phrase, and it is also the one
character that consumes the last of the measure's slack on the shortest version of this
sentence.

---

## 1 · What actually ships today (read, not assumed)

**(b)** `hero-engine.js:31–34`

```js
const WORDS=["hunger.","delight.","love.","empathy."];
const WORD_STYLE=["hungry","party","love","collab"];
const STATIC=["Product","designer","working","on","iOS,","B2C","and","design","systems","with"];
const SUBTXT="Product designer working on iOS, B2C and design systems.";
```

`buildHeadline()` inserts a hard `<br>` before the last `STATIC` word, so `with [mood]` always
owns its own line and the headline height cannot jump as the word cycles. **That forced break is
why today's headline is three lines**: two for the static sentence, one for `with [mood]`.

**Three different self-descriptions ship right now (b):**

| Where | Text |
|---|---|
| `h1` (built from `STATIC`) | Product designer working on iOS, B2C and design systems with **[mood]** |
| `hero-engine.js:34` `SUBTXT` | Product designer working on iOS, B2C and design systems. |
| `index.html:18` og:description | Product designer and founder of Apollo. Research-driven iOS, B2C, and **brand design**. |
| `index.html:30` JSON-LD `description` | Product designer and founder of Apollo, focused on research-driven product, iOS, and **brand design**. |

Two things to hand to whoever edits this:

- **`SUBTXT` is declared and never used.** It is dead. `#sub` exists in the DOM and `revealAll()`
  queries `.l` children inside it, but nothing ever writes `SUBTXT` into it. Whatever headline
  lands, this constant should either be wired up or deleted, and it should match the `h1`.
- **The meta/JSON-LD descriptions say "brand design"; the headline says "design systems".** They
  should agree. A hiring manager arriving from a search result or a shared link sees the meta
  description *before* the headline.

### About is now its own page

**(b)** `about.html` exists as a real, linkable page with a `Work / About / Play` nav, and it
carries the at-a-glance facts intact:

| | |
|---|---|
| **Status** | Open to full-time opportunities |
| **Based in** | San Francisco, CA · open to relocating |
| **Focus** | iOS · B2C · design systems |
| **Education** | B.A. Design, UC Davis |

This changes the availability answer materially and §10 is rewritten around it. "It's on the
About page" used to mean "it is inside a hidden in-page takeover"; it now means "it is one nav
click away, at a URL, indexable". That is a real destination.

### The availability line is gone, and this is the third time

**(b)** `header.css:796–810` is its own headstone:

> It shipped as a capsule with a status dot, lost the capsule, lost the dot, moved to the footer,
> came back above the `<h1>`, moved under it, and is now deleted outright on Jayden's word… the
> hero was carrying a second copy of the one fact and paying ~35px of the head's vertical budget
> for it.

**(b)** `index.html:1104–1114` records the measurement: head clearance above the fold at 1280×900
was **14px** with the line above the `h1`, **20px** with it under the `h1`, **51px** with it gone.

**(c)** The line failed three times because it was tried in three variants of the same wrong
place. The lesson is not "the fact doesn't matter" — it is "the fact cannot be paid for out of
the hero's vertical budget". §10 puts it somewhere that budget doesn't reach.

---

## 2 · The layout constraint, measured

**(b)** `index.html`, the CENTERED HERO block:

```css
.heroCopy h1{order:2;font-size:var(--fs-heroline);line-height:1.06;
             max-width:min(13.2em,100%);margin:0 auto;text-align:center}
```

plus, inherited from the base `h1` rule: `font-weight:600; letter-spacing:-.02em;
text-wrap:balance; filter:url(#inkBig)`.

**(b)** `--fs-heroline` is now `var(--fs-pagehead-sm)` = `clamp(30px,8.2vw,40px)`.
At 1280px, `8.2vw` = 105px, so it clamps to **40px**. Confirmed against the reported render.

Reported measurement: **three lines, 134px tall at 1280px.** The CSS line boxes account for
3 × 1.06 × 40 = **127.2px**; the remaining ~7px is almost certainly the `filter:url(#inkBig)`
bleed inflating the measured box. Either way, **~44.7px of measured height per line** is the
number to plan with, and it is the number used throughout this document.

### The measure is em-relative, which changes the whole problem

`max-width:min(13.2em,100%)` scales with the font size. **Making the type bigger does not make
the line wrap more, and the type going 38px → 40px did not change any wrap count.** Line count is
font-size-independent here. Height is therefore purely `lines × ~44.7px`, and the only lever that
matters is **how many lines**.

That is the good news in this document: every line-count figure below is stable across the
type-size decision. He can pick the words and the size independently.

### Measured line breaks

Every candidate was shaped through HarfBuzz against the actual shipped font file
(`fonts/instrument-sans-latin-600-normal.woff2`, weight 600, `kern` and `liga` on) with the
−0.02em tracking applied, then wrapped greedily at 13.2em. `text-wrap:balance` does not change
the *number* of lines — it only equalises their widths at that fixed count — so these counts are
what the browser produces.

| | chars | lines @13.2em / 40px / 1280px | measure needed for 2 lines |
|---|---|---|---|
| current static sentence | 55 | 2 (13.04 / 12.98em) | 13.04em |
| **current headline as rendered** (`+ with [mood]`) | 69 | **3 — 134px** | — |
| **his line** | 59 | **3 ⚠️** | 14.40em |

The current sentence sits at **13.04em against a 13.2em cap** — 1.2% of slack. That is not a
coincidence: **13.2em is hand-tuned to make exactly this sentence break 2 / 2.** Anything added
to it breaks it.

- **`SF ` costs 1.19em — 9% of the measure.** That is what pushes his line to three, with
  `systems.` orphaned alone at 3.99em before `balance` redistributes.
- **A period costs 0.255em — 2%.** Adding just a period to the *unchanged* sentence needs
  13.22em against a 13.2em cap: it fails by **0.15%**. That is inside sub-pixel and hinting
  variance, so I will not claim it certainly breaks — I will claim it has **zero slack** and must
  be checked in a browser before shipping. Not a margin to build on either way.

### Height, at the shipping 40px

| lines | CSS line boxes | measured (~44.7px/line) | vs today |
|---|---|---|---|
| 2 | 84.8px | **~89px** | **−45px** |
| **3 (today, and his line)** | 127.2px | **134px** | — |
| 4 | 169.6px | ~179px | +45px |

**(c) This is the deciding number.** Jayden has said the hero feels too low and the head is not
visible enough at the start. The recorded clearance budget is ~51px (§1). **Going from three
lines to two returns ~45px — almost the entire budget, and roughly what deleting the availability
line bought.** No other single change to the headline is worth remotely as much. A line count is
not a stylistic detail here; it is the whole answer to his complaint.

### A second constraint nobody has priced: the headline is now wider than the head

`.hero .stagewrap{width:min(clamp(260px,calc((100svh - 248px) * .95),620px),62vw)}`

| viewport | head width |
|---|---|
| **1280×800** | **524px** |
| 1440×900 | 619px |
| 1512×982 | 620px |

At 38px the measure was 502px — just under the 524px head at a 1280×800 laptop. **At 40px it is
528px, which is 4px wider than the head.** The type bump has already crossed that line.

**(c)** In a centred composition where the type sits directly above the head, a headline wider
than the head reads as misalignment. Whoever owns the type-size pass has to decide whether that
matters. If it does, the measure needs to *shrink* in em as the font grows — which makes short
lines more valuable still, and makes his line (which needs the measure to *grow* to 14.40em =
**576px**, 52px wider than the head) the hardest option to reconcile.

---

## 3 · What strong portfolios actually put in the hero

I fetched 30+ live portfolios and pulled the exact first-screen text. Failed fetches are listed
in §12 so nothing here is guessed.

### The patterns, in order of how well they read

**Pattern 1 — role + employer, one line.** The dominant shape at the top of the market. **(b)**

| Site | Hero text |
|---|---|
| nelson.co | "Gavin Nelson" / "Designer at OpenAI" |
| shadcn.com | "I'm a design engineer on the AI team at Vercel. I created shadcn/ui and shadcn/registry." |
| emilkowal.ski | "Emil Kowalski" / "Design Engineer" / "I work on the Web team at Linear." |
| shud.in | "Shu Ding" / "I am a designer and developer at Vercel." |
| cretu.dev | "Cristian Crețu, 21" / "design engineer at Anara" |

Reads well, because the employer *is* the credential — it does the filtering the adjectives would
otherwise have to do. **This shape is not available to Jayden**, which is exactly why his focus
list has to carry the weight instead.

**Pattern 2 — a claim sentence with no name in it.** The strongest register. **(b)**

| Site | Hero text |
|---|---|
| mattstromawn.com | **"I work on the future of design."** |
| brittanychiang.com | "I build accessible, pixel-perfect experiences for the web." |
| charliedeets.com | "I design products with a focus on simplicity, practicality, and craft." |
| tobiasahlin.com | **"I design, tinker, & teach."** |
| wattenberger.com | "I create things on the web, explore novel interfaces, turn data into meaning, and empower devs with AI." |

**Pattern 3 — role-and-focus statement.** Exactly what Jayden has. **(b)**

| Site | Hero text |
|---|---|
| adhamdannaway.com | "Product designer specialising in UI design and design systems." |
| raphaelsalaja.com | "I'm a design engineer based in Ireland." |
| jordanhughes.co | "I'm a product designer from Australia making useful things for the internet." |
| frankchimero.com | "Frank Chimero" / "New York-based designer" |
| gabrielvaldivia.com | **"Fractional Design Partner for Early-Stage Teams"** / "I help founders make the right product decisions sooner." |

**Pattern 4 — evocative / refuses the label.** Reads as filler unless the work is already famous.
**(b)** van Schneider's "I CREATE; THEREFORE I AM", floguo.com's dictionary entry ("Old soul with
a curious spirit; habitual book collector"), ped.ro's "I'm not sure how to intro myself anymore."
These work because the person is already known. **(c)** For a new graduate whose reader has 6–55
seconds, this is a straight loss: it spends the one sentence you get on personality and buys no
filtering.

**Pattern 5 — no hero at all.** steveruiz.me, joshwcomeau.com go straight to a post list. Not
applicable; Jayden's hero *is* the head.

### The time budget the headline competes for

**(a)** Hiring managers spend **6–8 seconds** on the initial scan and evaluate a portfolio in
**under a minute (~55s average)**; the first 0–3 seconds go to the opening case-study title and
the first visual.
Sources: [UX University](https://newsletter.uxuniversity.io/p/a-hiring-manager-will-spend-6-seconds),
[Matej Latin / UX Collective](https://uxdesign.cc/only-30-seconds-to-reject-your-portfolio-8cb14ac70674),
[Presentum](https://presentum.io/design/hiring-explained/evaluating-portfolio-and-resume).

**(a)** "Generic positioning signals junior uncertainty; specific positioning signals
deployability" — the guidance is to replace "I create meaningful digital experiences" with
something as concrete as "Product Designer specializing in B2B SaaS".
Sources: [thecrit.co](https://thecrit.co/resources/complete-portfolio-guide),
[uxplaybook.org](https://uxplaybook.org/articles/senior-ux-designer-portfolio-get-hired-2026).

**(c)** Jayden's current headline already passes this test. The specificity is the thing worth
protecting, and every option below keeps it. The debate is entirely about what *else* the line
can afford to carry.

---

## 4 · Does `SF` work as an opener?

**No — not in first position. It is the right instinct in the wrong slot.**

**(b) Evidence from the sweep.** Of ~30 portfolios, **9 name a location at all**, and in nearly
every case it appears in the **second or last** line, never the headline:

- karrisaarinen.com — headline is the role; **last line** is "From Finland, living in California."
- mxstbr.com — **last bullet** is "Austrian living in San Francisco 🌁"
- samuelkraft.com — role first; "Based in Stockholm, Sweden" is the **fourth paragraph**
- benji.org — "I was born in London, UK, and now live in Los Angeles, CA."
- frankchimero.com — "New York-based designer" — **spelled out**, modifying the noun
- maximeheckel.com — "a frontend engineer based in New York" — spelled out, mid-sentence

Only raphaelsalaja.com and jordanhughes.co put a location in the first sentence, and both spell
out a **country**, inside a sentence ("based in Ireland", "from Australia"). **Not one opens with
a two-letter city abbreviation.**

**(a) Editorial convention.** Spell out on first reference, abbreviate thereafter. "SF" is the
conventional short form in local and cultural contexts — a *local* register.
Sources: [SFSU editorial style](https://marcomm.sfsu.edu/brand/guidelines/editorial-style),
[AcronymFinder](https://www.acronymfinder.com/San-Francisco-(California)-(SF).html).

**(a) Plain-language / accessibility guidance.** Limit abbreviations; shorten only what is well
known to your whole audience; unexplained abbreviations are "complete mysteries until clearly
defined". WCAG 3.1.4 covers exactly this.
Sources: [Digital.gov](https://digital.gov/guides/plain-language),
[Leeds digital accessibility](https://digitalaccessibility.leeds.ac.uk/guidance/language/abbreviations-and-acronyms/),
[Australian Style Manual](https://www.stylemanual.gov.au/writing-and-designing-content/clear-language-and-writing-style/plain-language-and-word-choice).

**(c) The specific problem with first position.** "SF" is genuinely ambiguous in isolation —
science fiction, San Francisco, SharePoint Framework, Salesforce. Every reading is resolved by
the next two words, so a US reader loses nothing. But the first word of the page is where the
reader has least context to resolve it with, and it is the word a non-US reader is most likely to
stall on. A **0.2-second stumble inside a 6-second budget**, paid at the moment attention is most
expensive.

**(c) There is also a register problem.** "SF" is insider shorthand — how someone who lives there
talks. Not automatically bad; it signals belonging, which is a genuine positive when the reader
*is* an SF hiring manager. But "SF product designer" reads slightly like a classified-ad heading
where "San Francisco product designer" reads like a person. The abbreviation buys 11 characters
and pays for them in warmth.

**(c) The bigger objection: it is the wrong fact for that slot.** The headline's job is *what do
you do and are you good at it*. Location answers *can we hire you* — a logistics question,
important but belonging where logistics live. Compressing a logistics fact into the position of
maximum attention is the trade I would push back on, independent of spelling.

**Verdict on `SF`:** if the location stays in the headline it should be spelled out and should
modify the noun rather than open the line — the Chimero shape. But spelling it out with all three
focuses costs **14.59em** for a two-line break (584px at 40px), which the layout cannot pay. That
is the trilemma in §9.

---

## 5 · Three focuses, or one?

**(a)** The research says name one and let the work show the rest. The two best hero lines in the
sweep both compress rather than list: Tobias Ahlin's "I design, tinker, & teach." and
Wattenberger's four verb clauses. The high-bar sites that list, list **verbs**, not domains.

**But there is a stronger, site-specific argument.** Here is what the case studies actually claim,
from `CSINFO` in `index.html` **(b)**:

| Project | Role | What it is |
|---|---|---|
| Bearings | Product designer | group road-trip planner — **consumer** |
| Apollo | Founder & product designer | social habit app — **consumer, iOS** |
| UC Davis Rec | Solo product designer | app redesign, Apple Wallet — **consumer, iOS** |
| Strata | Designer & builder | habit builder as a game — **consumer** |
| Cluster | Product designer | campus club discovery — **consumer** |
| Headmaker | Design & code | the floating head, as a tool |
| R3SHORE | Head of UX | AI staffing for manufacturing — **B2B**, "case study coming soon" |

**iOS: heavily evidenced. B2C: heavily evidenced — every finished case study is consumer.
Design systems: not evidenced by a single case study on the site.**

**(c)** This is the real problem with the three-item list, and it is not a length problem. The
headline makes three claims and the work backs two. A hiring manager who reads "design systems"
and then scans seven consumer app case studies has found a gap between what the site says and
what it shows — the exact thing that pattern-matches to "junior" in the guidance above. The design
system is real (this repo has `tokens.css`, a documented type and spacing system, a button system,
a specimen page) but **none of it is surfaced as work.**

Two honest fixes, not mutually exclusive:

1. **Drop "design systems" from the headline** until there is a case study, and let iOS + B2C —
   which the work proves twice over — carry the line. This also buys space.
2. **Keep it and surface the evidence** — put the design system into the Extras tab. `tokens.css`,
   `specimen.html` and `button-system.html` already exist. Better long-term answer; separate work.

**(c)** One further note: R3SHORE is B2B, and it carries the most senior title on the site ("Head
of UX"). A strict "B2C" headline slightly mislabels his own strongest credential. I would not
chase this — it is marked in-progress — but if the headline ever needs to flex, "consumer" is
warmer than "B2C" and "product" is broader than both.

---

## 6 · Does a period belong?

**(a) Convention is against it.** Periods began disappearing from headlines in the late 19th
century; the NYT, Guardian, Washington Post, NPR and Reuters have removed them entirely. Two
reasons are given: a period creates "an air of finality… rather than a discussion about to be
opened", and it halts eye flow — reported as measurably better comprehension without one, with
10% of one sample saying the full stop *reduced their intention to read on*.
Sources: [Cutting Edge PR](https://cuttingedgepr.com/articles/does-a-headline-need-a-full-stop-or-period/),
[Words by Cornelia](https://wordsbycornelia.com/should-you-use-a-full-stop-at-the-end-of-a-headline/),
[Grammarphobia](https://grammarphobia.com/blog/2013/06/headlines.html).

**(b) The sweep splits cleanly on grammar, not on taste.** Complete sentences take periods ("I
design products with a focus on simplicity, practicality, and craft."). Standalone role labels do
not — "Designer at OpenAI", "Designer for the Web", "Frontend Engineer", "Fractional Design
Partner for Early-Stage Teams". **Sentences get periods; labels don't.**

**(c) Which is his line?** `SF product designer working on iOS, B2C and design systems` is a
**noun phrase**, not a sentence — no verb with a subject. By the rule the sweep follows it is a
label, and takes no period. The current headline is right to omit one.

**(c) But the period changes register in a way he may want.** A period on a fragment is a
deliberate design-writing move: the line lands as a statement of fact rather than trailing off.
Paco Coursey uses four of them on fragments. It reads more finished and slightly more formal.
That is a legitimate taste, not an error — but the way to *earn* it is to make the line an actual
sentence, or to split it into two fragments where the period does structural work
(`SF product designer. iOS, B2C and design systems.`) rather than merely stopping.

**(c) And the practical fact:** on the unchanged sentence the period is the character that
consumes the last 0.15% of the measure. It is not free.

**Verdict:** no period — unless the line is restructured into two beats, in which case the periods
stop being decoration and start being punctuation.

---

## 7 · What is lost with the mood clause

**Be clear about what is not lost.** The moods are not in the headline's gift. `hero-engine.js`
keeps `WORDS`, `WORD_STYLE`, `makeCycWord`, `attachHunger/Party/Love/Collab` and every expression
hook. The Play menu in the nav still lists all four moods, still animates the head, still runs the
drag mechanics. **Removing the clause removes one entry point, not the feature.**

**What is lost, precisely (c):**

1. **The only passive announcement.** Today the mood word cycles whether or not the visitor does
   anything. It is the one place the moods advertise themselves. After this change, discovery
   requires noticing and opening the Play control in the nav.
2. **The tug demo dies with it.** `maybeTugDemo()` nudges the cycling word up to three times
   (`TUG_MAX = 3`) to teach that it is draggable. With no cycling word there is nothing to tug,
   and **that teaching mechanism has no other host.** Worth knowing before someone wonders where
   the affordance went.
3. **The character in the first six seconds.** The headline is currently the only object where
   the site's playfulness and its credentials coexist. Split them and the headline becomes purely
   professional, the play purely optional.

**(c) I still think he is right, and here is why.** The clause sold the personality to a reader
who had not yet been told what he does — and there is a real risk a hiring manager reads "working
on iOS, B2C and design systems with **hunger.**" as the sentence trailing into whimsy at the exact
moment it was about to be useful. The head already carries the personality and carries it harder
than a word does: it is the largest object on the page, it tracks the cursor, it changes
expression. **The clause was the weakest carrier of the site's charm and the strongest tax on its
clarity.** Delete it.

**(c) What should replace the discoverability.** Nothing in the hero. The head itself is already
the thing that reacts, and the Play control is already in the nav on every page. I would
specifically **not** add a hint line under the headline — that re-spends the ~45px this change is
meant to recover, which is the exact mistake the availability line made three times. If mood
discovery turns out to be too low after shipping, the cheap fix is in the nav control or in the
head's idle behaviour, not in hero copy.

---

## 8 · Options, written out in full

All counts are HarfBuzz-shaped against the real font at weight 600 with −0.02em tracking. **Lines
and width are at the shipping state: 13.2em measure, 40px type, 1280px viewport.** Measured height
uses ~44.7px per line. Three-liners are flagged ⚠️.

---

### 0 · His line, as proposed

> **SF Product designer working on iOS, B2C and design systems.**

**59 chars · 3 lines ⚠️ · ~134px · needs 14.40em (576px) for two · exceeds the 524px head**

Breaks `SF Product designer working` / `on iOS, B2C and design` / `systems.` — `systems.`
orphaned at 3.99em before `text-wrap:balance` evens it.

**Rationale:** keeps everything the current line says, adds location, deletes the clause.
**Evidence:** iOS ✓✓, B2C ✓✓, design systems ✗ (no case study), SF ✓ (About).
**Problems:** capital P; `SF` in first position; **stays at three lines, so it does not fix the
hero height**; period on a noun phrase.

---

### 0b · His line, minimally corrected

> **SF product designer working on iOS, B2C and design systems**

**58 chars · 3 lines ⚠️ · ~134px · needs 14.40em (576px) for two**

Lowercase p, no period. Everything else his. **If he wants his line, this is the version to
ship** — and the measure has to go to 14.4em, at which point it breaks cleanly as
`SF product designer working on` / `iOS, B2C and design systems`, two near-equal lines. That is a
genuinely good break and it gets him to ~89px. The cost is a 576px measure that overhangs the
524px head at 1280×800 by 52px.

---

### A · Pure deletion — change nothing but remove the clause

> **Product designer working on iOS, B2C and design systems**

**55 chars · 2 lines ✓ · ~89px (−45px) · 13.04em = 522px, just inside the head**

Breaks `Product designer working on` / `iOS, B2C and design systems` — 13.04 / 12.98em, the break
the measure was tuned for.

**Rationale:** the smallest possible change and zero layout risk — this is literally the existing
first two lines with nothing after them. It is also already the sentence sitting in `SUBTXT`.
**Evidence:** iOS ✓✓, B2C ✓✓, design systems ✗.
**Cost:** no location at all. Location and availability both have to live elsewhere.
**Register:** identical to today, minus the wink.

---

### B · Two beats — the recommended line

> **SF product designer. iOS, B2C and design systems.**

**49 chars · 2 lines ✓ · ~89px (−45px) · needs only 11.34em = 454px, comfortably inside the head**

Breaks `SF product designer. iOS,` / `B2C and design systems.`

**Rationale:** label, then list. The periods do structural work rather than decoration, which is
the only way a period earns its place (§6). This is the **shortest option that keeps every fact
his line keeps** — location and all three focuses — and it has the most headroom against both
constraints: two lines with 1.9em of slack, and at 454px it clears the 524px head by 70px, so it
survives any further type-size increase without re-tuning the measure.
**Evidence:** same as above; design systems still unevidenced.
**Register:** crisper and more confident than "working on…". Closest to the shadcn / Nelson /
Chimero shape in the sweep. Slightly clipped — some will read it as terse rather than economical.
**Residual problem:** `SF` still opens the line (see §9 for the compromise if that matters).

---

### C · Two focuses, location kept

> **SF product designer working on iOS and design systems**

**53 chars · 2 lines ✓ · ~89px (−45px) · 13.02em = 521px, just inside the head**

Breaks `SF product designer working` / `on iOS and design systems`.

**Rationale:** the minimum edit that makes his line fit — `SF` in, `B2C` out. Keeps his exact
phrasing and rhythm.
**Evidence:** iOS ✓✓, design systems ✗. **This drops the wrong focus** — it removes the claim the
work proves and keeps the one it doesn't. Included so it is on the record as the obvious edit *not*
to make. If a focus has to go, it should be design systems.

---

### D · Claim register — what he does, not what he is

> **SF product designer. I design iOS products end to end.**

**54 chars · 2 lines ✓ · ~89px (−45px) · 12.96em = 518px, just inside the head**

Breaks `SF product designer. I design` / `iOS products end to end.`

**Rationale:** the Pattern-2 shape — Ström-Awn, Chiang, Deets. A verb instead of a domain list.
**Evidence:** strong. The About page's own lede is "I design products end to end (and I built a
few of my own)" — this headline *is* that sentence, and Apollo (founder + designer), UC Davis Rec
(solo designer) and Strata (designer *and builder*) all evidence "end to end" directly.
**Cost:** loses "B2C" and "design systems" as scannable keywords. **(c)** That matters more than
it should: a hiring manager filtering for "design systems" is doing a keyword scan and this line
fails it. **It reads best and scans worst.**

---

### E · Availability in the headline

> **SF product designer, open to full-time work**

**43 chars · 2 lines ✓ · ~89px (−45px) · 10.20em = 408px**

Breaks `SF product designer,` / `open to full-time work`.

**Rationale:** puts the single most actionable fact in the most-read position, and is the
shortest option by a distance.
**Evidence:** ✓ (About at-a-glance).
**Cost:** trades *all* the specificity for the availability. **(c) I do not recommend this.** The
guidance in §3 is unambiguous that specific positioning is what separates a portfolio from a
generic one, and this is a generic line plus a status. It also front-loads asking over offering.
Included because availability-in-the-hero is a live question and this is what it costs: the whole
focus list.

---

## 9 · Recommendation

**Ship option B.**

> ## SF product designer. iOS, B2C and design systems.
> **49 characters · 2 lines at 40px / 1280px · ~89px tall, down 45px from today's 134px**

The reasoning, in order of weight:

1. **It answers the complaint he actually made.** He says the hero sits too low and the head is
   not visible enough at the start. Two lines instead of three returns **~45px directly above the
   head** — comparable to what deleting the availability line bought, and the largest single lever
   available in the hero. His line, at three lines, returns nothing.
2. **It has the most headroom of any option.** 11.34em required against a 13.2em measure, and
   454px against a 524px head. Every other two-line option sits within a few pixels of the head's
   width (518–522px) and would need re-checking if the type grows again. B would not.
3. **It keeps every fact his line keeps** — location, all three focuses — and loses nothing.
4. **The periods become punctuation rather than decoration**, which is the only way §6's
   convention is satisfied while still giving him the more finished register he evidently wants.
5. It touches `STATIC` in `hero-engine.js` and nothing else. It does not require the measure to
   change, so it does not disturb the tuning.

### Where I disagree with him, plainly

**The `SF` opener should be reconsidered, and on the evidence it loses.** Thirty portfolios, none
opening with a city abbreviation; plain-language guidance against abbreviating what the whole
audience may not parse; and the first word of the page is the worst place to spend a reader's
resolution effort.

The counter-argument is real: "SF" is 11 characters cheaper, it signals belonging to an SF reader,
and it is what let him delete the separate location line. **But the trilemma is hard — spell out
San Francisco, keep three focuses, stay at two lines: he can have any two.**
`San Francisco product designer. iOS, B2C, design systems.` is 57 chars and needs **14.59em**,
which is three lines at the shipping measure and 584px wide.

If the abbreviation bothers him, the compromise is to give up the unevidenced focus instead:

> **San Francisco product designer. iOS and consumer apps.**
> **53 chars · 2 lines ✓ · ~89px · 12.79em = 512px, inside the head**

That spells out the city, stays two lines, stays inside the head, and drops only the claim the
case studies cannot back (§5). **If he does not mind the abbreviation, B keeps SF and the cost is
one small stumble for non-US readers — a defensible call I would not block on.**

**Second disagreement: "design systems" is currently an unevidenced claim.** Not a headline
problem — a work problem. The fix is a case study or an Extras entry, not a shorter sentence. But
it should be known that the line writes a cheque the case studies do not cash.

**Do not put availability back in the hero.** `header.css:796` and `index.html:1104` are two
separate headstones for that decision and the measurement is recorded: ~35px for a duplicate of a
fact already in About. Nothing in this research changes that.

---

## 10 · Where the availability signal should live

This is now genuinely unanswered: the hero line is deleted, and the recommended headline does not
carry it. **It is the single most actionable fact on the site for the reader he wants, and it
should not simply evaporate.**

**(a) The signal measurably works.** LinkedIn's own recruiter data: candidates with the
availability setting on get **~3x more recruiter messages** (roughly 5% → 15% response), and the
badge correlates with ~40% more hiring-manager contact. The usual objection — that it "signals
desperation" — is framed for *employed* candidates worried about their current employer. Jayden is
a recent graduate openly looking; that objection does not apply to him.
Sources: [TalentBridge](https://talentbridge.com/open-to-work-on-linkedin-does-it-really-help-you-get-hired/),
[The Interview Guys](https://blog.theinterviewguys.com/linkedin-open-to-work-guide/),
[LinkedIn Recruiter help](https://www.linkedin.com/help/recruiter/answer/a419131/view-candidates-who-are-open-to-work-in-recruiter).

**(b) The sweep, read honestly.** Of ~30 high-bar portfolios, **not one states availability in the
hero.** Where it exists it is either an About-section heading low on the page (henry.codes:
*"I'm still taking on freelance projects on a case-by-case basis"*) or absorbed into the role noun
— *Freelance* Designer, *Independent* Art Director (dennissnellenberg.com, aristidebenoist.com,
thibaudallie.com, olivierlarose.com).

**(c) But that population is not his.** Those designers work at Vercel, Linear, OpenAI and
Shopify, or they run studios. They are not looking. The absence of an availability line on their
sites is evidence about *employed senior designers*, not evidence that the signal is unwelcome. I
would not let that finding talk him out of stating it.

### Recommended placement, in priority order

1. **The nav, as a small status item. This is the answer, and it is nearly free.**
   The nav row already exists on every page and already has its vertical space allocated, so a
   status item there costs **zero** of the hero's budget — which is the entire reason the hero
   version kept failing. **(b)** `--accent-live: #17A45A` already exists in `index.html:55` and
   its own comment describes it as *"a brighter 'available' status dot"* — **the token was created
   for exactly this and is currently unused outside `play.css`.** The design intent is already in
   the file. It is also persistent: it stays visible while the reader scrolls the work, which the
   hero version never did. **Caveats (b):** the no-shadows-on-chrome rule means a dot plus text at
   nav scale, separated by a hairline or translucency — not a pill with elevation. And the nav
   already carries `Work / About / Play`; a fourth item must read as *status*, not as a fourth
   link. Linking it to `about.html#at-a-glance` gives it somewhere substantive to land.

2. **The About page — where it already correctly is, and now a real destination.**
   **(b)** `about.html` ships **Status — Open to full-time opportunities** in its at-a-glance
   facts. That stays regardless. **(c)** The change that matters is that About is now a page with
   a URL and a nav link rather than a hidden takeover, so "it's on About" is a real answer for the
   first time. Not sufficient alone — a 6-second scanner never clicks through — but it is what
   makes (1) worth doing, because the nav dot now has a destination.

3. **The footer.** **(b)** `<footer class="siteFoot" id="contact">` currently holds one sentence:
   *"Thanks for checking out my website. I'd love to chat, you can find me on LinkedIn, Instagram,
   or through email."* That is the natural place for
   **"San Francisco · Open to full-time roles"** — it costs nothing above the fold and it lands at
   the exact moment the reader has finished the work and is deciding whether to act. Weaker than
   the nav only because the fastest scanners never reach it. Strictly additive; do both.

4. **Fix the meta descriptions.** **(b)** `og:description` and the JSON-LD `description` are what
   a hiring manager sees in search results and in a shared Slack link, *before* they load the
   page. Neither mentions availability or location, and both still say "brand design". This is
   free surface area currently spent on an out-of-date phrase.

**Do not** put it under the `h1`, above the `h1`, or in a hero capsule. That has now been tried in
all three positions and reverted from all three, and the file says why.

---

## 11 · Summary table

Line counts and widths at the shipping state: **13.2em measure, 40px type, 1280px viewport.**
Head width at 1280×800 is **524px**.

| | chars | lines | height | measure needed | width | fits head | verdict |
|---|---|---|---|---|---|---|---|
| today (`…with [mood]`) | 69 | **3** | **134px** | — | 528px | no | replace |
| **0** his line | 59 | **3 ⚠️** | 134px | 14.40em | 576px | no | right idea, doesn't fix the height |
| **0b** his, corrected | 58 | **3 ⚠️** | 134px | 14.40em | 576px | no | ship this if he wants his line |
| **A** pure deletion | 55 | 2 ✓ | ~89px | 13.04em | 522px | just | safest, loses location |
| **B** two beats | 49 | **2 ✓** | **~89px** | **11.34em** | **454px** | **yes, +70px** | **recommended** |
| **B′** spelled out, two focuses | 53 | 2 ✓ | ~89px | 12.79em | 512px | yes | the compromise if `SF` bothers him |
| **C** drop B2C | 53 | 2 ✓ | ~89px | 13.02em | 521px | just | drops the wrong focus |
| **D** claim register | 54 | 2 ✓ | ~89px | 12.96em | 518px | just | reads best, scans worst |
| **E** availability | 43 | 2 ✓ | ~89px | 10.20em | 408px | yes | not recommended |

---

## 12 · Method, and what I did not verify

**Measurement.** Text was shaped with HarfBuzz (`uharfbuzz`) against
`fonts/instrument-sans-latin-600-normal.woff2` decompressed to TTF, with `kern` and `liga`
features on, then `−0.02em × character count` applied for the CSS tracking, and wrapped greedily
at the CSS `max-width`. Static `hmtx` advance widths agreed with the shaped results to within 0.5%
on every candidate. `text-wrap:balance` was modelled as "same line count, minimised maximum line
width", which is what the spec requires.

**Height figures** are anchored to the reported render — 3 lines = 134px at 40px — giving ~44.7px
of measured height per line, about 5% above the 42.4px CSS line box. The excess is most likely
`filter:url(#inkBig)` inflating the measured box. Two-line figures are that per-line number
doubled, so **~89px carries the same ~5% uncertainty**; the *difference* (−45px) is the reliable
number, because both sides share the same per-line basis.

**Confidence on line counts.** All two-vs-three-line calls are safe by ≥2% of the measure **except
one**: the unchanged sentence plus a period needs 13.22em against a 13.2em cap — it fails by
**0.15%**, inside browser sub-pixel and hinting variance. Treat that single case as "zero slack",
not as a proven break, and confirm it in a browser if anyone wants to ship option A *with* a
period.

**Not verified in a browser.** I did not render any candidate. Every available browser tab was
held by the parallel agents for the duration of this research, and I was scoped to write one file
and touch nothing else. Every number here is computed from the shipped font and the shipped CSS,
not observed. Before shipping, the chosen line should be pasted into `STATIC` and checked at
**1280×800** — the binding case for both the head width and the fold — and at 1440×900.

**Failed source fetches, not guessed at:** brianlovin.com (429 / Vercel security checkpoint),
jordansinger.me / jsng.dev / jdsinger.design (DNS), jasonyuan.design and seanhalpin.design
(JS-only shells), robinnoguier.com (DNS), antoinelin.com (526), minh.gg, marcelfahle.com.
**mengto.com no longer hosts a portfolio** — the domain now serves spam and must not be cited.

**Files that would change if option B ships** (nothing was edited by this research):
`hero-engine.js:33` (`STATIC`) and `hero-engine.js:34` (`SUBTXT`, currently dead code that should
be wired up or deleted). The 13.2em measure does **not** need to change for option B.
Availability placement (§10) touches the nav, `about.html` (already correct), the footer, and the
meta/JSON-LD descriptions.
