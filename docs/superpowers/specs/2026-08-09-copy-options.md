# Copy options — the four things a reviewer caught

**This is a menu, not an implementation.** Nothing on the site was edited. Every option below is
written to be pasted, and every one names the file, the line, and the other places the same
string lives. Other agents are live in `index.html`, `hero-engine.js` and `hero-time.css` right
now, so line numbers are from the state of `codex/time-of-day-hero` at the time of writing —
check the string, not the number.

---

## Answers up front

| | Answer |
|---|---|
| **The one change that most improves credibility** | Make the hero stop claiming San Francisco. Three surfaces currently disagree about where he lives, and the hero is the one making the claim that the résumé contradicts. Deleting two characters from the h1 (`SF `) resolves it, and it is the only fix here that *removes* words. |
| **If he only does one thing, do this first** | **Fix 1**, and inside Fix 1, the cheap half: the About "Based in" row and the footer status line. Both are single-string swaps, neither touches the hero, and together they mean a recruiter reading About → footer → résumé never hits a contradiction. The hero h1 can follow in a second pass because it costs three files (below). |
| **Fix 1 vs Fix 2, honestly** | Fix 1 stops a loss. Fix 2 creates a gain. A recruiter who spots the location contradiction discounts everything after it, so Fix 1 is the gate — but "here is the number I would instrument first, and why it beats the obvious one" is the sentence that makes a reader think *this person has product judgement*. Do 1 first because it is cheap and defensive; do 2 next because it is the one that raises the ceiling. |
| **Cheapest fix in the set** | Fix 4. One string, eight pages, one Python constant. |
| **Most expensive fix in the set** | The hero h1 in Fix 1 — see the three-file warning below. |

### The hero h1 costs three files, not one

The headline is not just markup. `hero-engine.js` **wipes `h1.textContent` and rebuilds it word
by word** from a hard-coded array, and a contract asserts the exact sentence twice. Changing it
means all three, in the same commit:

| File | What holds the string |
|---|---|
| `index.html` | `<h1 id="h1">SF product designer. iOS, B2C and design systems.</h1>` |
| `hero-engine.js` | `const STATIC=["SF","product","designer.","iOS,","B2C","and","design","systems."];` — one array entry per word, no punctuation stripped |
| `tools/home-minimal-hero-contract.py` | the markup assertion, and again as `state["headline"]` after render |

Miss `STATIC` and the page renders the old headline over the new markup. Miss the contract and
the check fails red on a change he asked for.

---

## Fix 1 — the location contradiction

**The honest framing, as he has chosen it:** based in Davis, CA, open to relocating, SF included.

### Where the contradiction actually lives

Six surfaces, not three:

| Surface | Today |
|---|---|
| `index.html` h1 | `SF product designer. iOS, B2C and design systems.` |
| `index.html` meta description / og / twitter / JSON-LD (×2) | "San Francisco product designer" |
| `about.html` lede | "I am a San Francisco-based product designer and recent UC Davis Design graduate…" |
| `about.html` At-a-glance "Based in" | `San Francisco, CA · open to relocating` |
| `about.html` meta description / og / twitter | "San Francisco-based product designer" |
| `Jayden-Betts-Resume.pdf` | Davis, CA |

`header-prototype.html:791` also carries `var AVAIL='Based in San Francisco · Open to full-time
roles'`, but that file is a prototype: not in the sitemap, not in the footer contract's page
list. Leave it or fix it, it ships to nobody.

### The h1 — three options, all preserving the two-sentence rhythm

Measured against the shipping measure. `.heroCopy h1` is `max-width:min(14.4em,100%)` at
`--fs-heroline` = `clamp(30px,8.2vw,40px)`, so 40px / 576px at 1440. The headline research
(`docs/superpowers/specs/2026-08-03-hero-headline.md` §Measured line breaks) shaped candidates
through the actual font file: **the current 49-char line needs 11.34em and has real slack;
55 chars is the last count with comfortable headroom; 58–59 chars needs the full 14.40em and
has zero.** Mobile is tighter — `max-width:13em` at `clamp(28px,7.7vw,32px)`, where the 100%
cap binds below ~400px and every added word is a real risk of a fourth line. **Anything longer
than today's 49 gets checked in a real browser at 390 and 1440 before it ships.**

> **Option 1A — pure subtraction.** *Emphasises:* the work, not the pin on the map. *Suits:* him,
> if he agrees that where he sits is a facts-block fact, not a headline fact.
>
> **`Product designer. iOS, B2C and design systems.`**
>
> **46 chars — 3 shorter than today, so it cannot introduce a wrap anywhere.** Same two
> sentences, same full stops, one word removed and the next capitalised. The city is then stated
> exactly once on the whole site, in About's At-a-glance, where it is precise and where a
> recruiter goes looking for it. This is the "restraint is the signal" version, and it is the
> only option that is guaranteed safe at every width.

> **Option 1B — trade the geography for the craft.** *Emphasises:* what he builds, in the slot
> the city used to occupy. *Suits:* him if the first beat feels empty without a qualifier, and
> if he wants the first word a recruiter reads to be the platform he actually ships on.
>
> **`iOS product designer. B2C apps and design systems.`**
>
> **50 chars — 1 more than today.** Identical beat structure: `[qualifier] product designer.`
> then a three-part list becomes a two-part one. Costs one character, so the wrap is effectively
> unchanged. The trade is real: it puts iOS first, which is the strongest true claim in the
> sentence, and it drops the geography from the hero entirely so Fix 1 is settled by the same
> edit. Downside: `iOS` appears twice in the original and once here, which is arguably tidier
> anyway.

> **Option 1C — keep a city, make it a destination.** *Emphasises:* intent to move, which is what
> an SF recruiter actually wants to know. *Suits:* him **only if he is genuinely committed to
> SF**, not merely open to it.
>
> **`SF-bound product designer. iOS, B2C and design systems.`**
>
> **55 chars — 6 more than today.** The closest thing to a one-word substitution: `SF` becomes
> `SF-bound` and nothing else moves. 55 is the last count the research shows with comfortable
> headroom at 14.4em, so it is very likely fine at 1440 and **must be checked at 390**.
>
> **The caveat is the whole point of this option.** "Open to relocating, SF included" and
> "SF-bound" are different promises. If he has not decided, 1C swaps one overstatement for a
> smaller one and the fix has not really landed. Pick 1A or 1B unless SF is the plan.

**Rejected, and why, so nobody re-proposes them:** `Bay Area product designer` — Davis is in the
Sacramento Valley, not the Bay Area; that is a *new* inaccuracy, not a fix. `California product
designer` (57) and `Product designer in California` (60) — both push into and past the zero-slack
band, and "California" tells a recruiter less than either 1A's silence or 1B's `iOS`.

### About — the lede

Today: *"I am a San Francisco-based product designer and recent UC Davis Design graduate with an
entrepreneurial spirit."*

> **Option 1-L1 — say it once, in the facts block.** *Emphasises:* nothing new; it just stops the
> lede duplicating a fact that is stated precisely one screen below.
>
> **`I am a product designer and recent UC Davis Design graduate with an entrepreneurial spirit.`**
>
> Removes `San Francisco-based` and nothing else. Pairs with 1A or 1B, and it is the option that
> leaves the smallest number of places to keep in sync later.

> **Option 1-L2 — keep a location beat, make it true.** *Emphasises:* that he is a Northern
> California person, without claiming a city he does not live in.
>
> **`I am a Northern California product designer and recent UC Davis Design graduate with an
> entrepreneurial spirit.`**
>
> Suits him if the sentence feels rootless without a place. Costs one more thing to keep
> consistent, and "Northern California" is vaguer than the At-a-glance row that follows, so it
> reads as a warm-up to the precise fact rather than a competing claim.

### About — the At-a-glance "Based in" row

Today: `San Francisco, CA · open to relocating`
Markup: `<div class="abFact"><span class="abFactK">Based in</span><span class="abFactV">…</span></div>`
The `·` separator is the established pattern in this block (`iOS · B2C · design systems`), so it
stays.

> **Option 1-F1 — flat and factual.** *Emphasises:* checkability. *Suits:* a recruiter scanning.
> **`Davis, CA · open to relocating, SF included`** — 43 chars, 6 shorter than today's value, so
> the row cannot grow.

> **Option 1-F2 — willingness with a bit of spine.** *Emphasises:* that relocating is a decision
> he has already made, not a concession. *Suits:* him if "open to" reads too passive.
> **`Davis, CA · relocating for the right role, SF included`** — 54 chars. Longer than the widest
> value in the block today (`Open to full-time opportunities`, 31); check it does not wrap the
> row awkwardly at 390 before shipping.

> **Option 1-F3 — name the preference.** *Emphasises:* SF specifically, which is what an SF
> recruiter is scanning for. *Suits:* him if SF is genuinely first choice.
> **`Davis, CA · will relocate, SF first on the list`** — 47 chars.

### The rest of Fix 1 (do not skip these — they are what a recruiter's search actually hits)

Whichever h1 he picks, these carry the same claim and must move with it:

- `index.html` `<meta name="description">` — "Jayden Betts is a San Francisco product designer…"
- `index.html` `<meta property="og:description">` and `<meta name="twitter:description">` — both
  currently mirror the h1 word for word: "SF product designer. iOS, B2C and design systems."
- `index.html` JSON-LD, **two** places: the `WebSite` node's `description` and the `Person`
  node's `description`. If he wants the structured data to state it positively rather than just
  stop lying, `Person` accepts a `homeLocation` — but that is an addition, not a copy fix, and it
  is fine to just remove the city from the two description strings.
- `about.html` `<meta name="description">`, `og:description`, `twitter:description`.

**Suggested replacement description string, usable in all of them:** *"Jayden Betts is a product
designer working on iOS, B2C and design systems, and the founder of Apollo. Open to full-time
roles."* — the existing sentence with the city deleted, so nothing else about the SEO copy
changes.

---

## Fix 2 — outcomes for Apollo and Bearings

**Facts used, and nothing else.** Apollo: solo, founder & product designer, all 58 screens, born
at a 24-hour hackathon, still in development. Bearings: product designer on a team of 4 designers
+ a lead, 5 weeks, he designed 28 of the final screens, built the design system and shared
components, ran the discussions when the lead stepped away, 42 survey respondents, Audience
Choice Award at the showcase with judges from LinkedIn and ServiceNow singling out the brand
identity, has not shipped.

**No invented users, engagement, retention or revenue appears below.** The move in every option
is the same one Bearings already gestures at in its own words — *"the first things I'd
instrument"* — pulled forward, sharpened to **one** metric, and given a reason.

### Apollo — where it lands

`apollo.html`, the **Outcome** section headed *"The one I built for me."* The existing paragraphs
are the right ending emotionally and should stay. These options are a paragraph to insert
**before** the final "still in progress / reach out" paragraph, so the section reads:
what it proved about him → what he'd measure → come see it.

> **Option 2A-1 — lead with the metric, reject the obvious one.** *Emphasises:* product judgement.
> *Suits:* the reviewer's actual complaint, and any hiring manager who has ever argued about a
> north-star metric.
>
> **`The number I'll judge Apollo on isn't daily actives. It's the share of captured wins that at
> least one close friend actually witnesses, and whether being witnessed brings you back to
> capture the next one. That's the whole thesis in one metric: if wins pile up unseen, Apollo is
> a private camera roll with a nice camera on the front. It's the first thing I'll instrument at
> launch.`**
>
> Why this metric and not another: the app explicitly deletes streaks, counts and leaderboards,
> so measuring it with engagement numbers would contradict its own design. Witness rate is the
> only number that tests "witnessing beats willpower," which is the bet the case study already
> states.

> **Option 2A-2 — lead with what shipped, then the metric.** *Emphasises:* volume of real work
> first, judgement second. *Suits:* a reader who skims outcomes and needs a hard number in the
> first clause.
>
> **`58 screens, designed solo, from a 24-hour hackathon to the version on this page — that's what
> I can show you today. The number comes at launch, and it isn't daily actives: it's the share of
> captured wins that at least one close friend witnesses. Streaks would flatter the app. That one
> tells me whether witnessing actually beats willpower, which is the only thing Apollo is
> betting on.`**

> **Option 2A-3 — short, if he wants one sentence and no new paragraph.** *Emphasises:* brevity.
> *Suits:* dropping into the existing final paragraph without restructuring the section.
>
> **`Apollo is still in progress, and when it launches the first thing I'll instrument is the
> share of wins that at least one friend witnesses — not daily actives, which would flatter the
> app without testing it.`**
>
> This one is written to replace the opening clause of the current last paragraph (*"Apollo is
> still in progress, and I'm still designing and iterating."*) so the "want to see where it
> stands today?" invitation still closes the page.

### Bearings — where it lands

`bearings.html`, the **Outcome** section headed *"Road trips are fun. Now the planning is too."*
This one is **already most of the way there** — it names the award, names the judges, and says
*"It hasn't shipped yet, so those are the first things I'd instrument."* Two things weaken it:
it lists three metrics instead of committing to one, and *"Still, the numbers I actually care
about"* opens with a concession. The options fix both.

Today, first paragraph: *"Bearings took the Audience Choice Award at our showcase, and judges
from LinkedIn and ServiceNow singled out its brand identity. Still, the numbers I actually care
about are tied to the problem. It hasn't shipped yet, so those are the first things I'd
instrument: planning time dropping from eighteen hours toward minutes, the whole group
contributing instead of one person, and a plan that holds together instead of falling apart."*

> **Option 2B-1 — commit to one metric, and say why it beats the obvious one.** *Emphasises:*
> that he can tell a symptom from a cause. *Suits:* the strongest version of the reviewer's note.
>
> **`Bearings took the Audience Choice Award at our showcase, and judges from LinkedIn and
> ServiceNow singled out its brand identity. It hasn't shipped, so the number I'd instrument
> first is the one tied to the actual problem: how many people in a trip touch the plan.
> Eighteen hours of planning is the symptom. One person carrying it is the disease. If four out
> of five in a group add a stop, vote on dinner, or drop a budget in, Bearings solved what it set
> out to — and planning time comes down as a result, not as the goal.`**
>
> Replaces the whole first paragraph. Keeps every fact, deletes "Still,", and turns a list of
> three into one metric with a stated reason.

> **Option 2B-2 — keep his three, but rank them.** *Emphasises:* thoroughness. *Suits:* him if he
> is attached to the existing sentence and wants the smallest edit that fixes it.
>
> **`Bearings took the Audience Choice Award at our showcase, and judges from LinkedIn and
> ServiceNow singled out its brand identity. The numbers I care about are tied to the problem,
> and it hasn't shipped, so here's the order I'd instrument them in. First: how many people in a
> trip touch the plan, because one person carrying it is the thing the research kept finding.
> Then planning time, from eighteen hours toward minutes. Then whether the plan holds instead of
> falling apart — the half of group trips that die before anyone drives.`**
>
> Same content, same facts, but ordered and justified rather than listed. "First / then / then"
> reads as a plan, which is the tone the section wants.

> **Option 2B-3 — put the scope up front.** *Emphasises:* what he personally shipped, before any
> forward-looking metric. *Suits:* him if he thinks the award is doing too much work as the
> outcome.
>
> **`28 of the final screens, the design system, and the shared components the other four
> designers built on — in five weeks. It took the Audience Choice Award at our showcase, with
> judges from LinkedIn and ServiceNow singling out the brand identity. It hasn't shipped, so the
> number I'd instrument first is how many people in a trip touch the plan: eighteen hours of
> planning is the symptom, one person carrying it is the disease.`**

### Optional, and only if he wants it — the home-page hover card

`index.html` `CSINFO` gives each case a Role / Problem / Solution triplet on hover. There is no
Outcome field and **adding one means restructuring the card**, which is a design change, not a
copy change. Noted here only so it is a deliberate omission rather than an oversight.

---

## Fix 3 — a one-line description for "Play"

**What is actually behind the door**, from `play.html`'s own four cards: *Add your head* (upload
a photo, it gets cut out on a separate page and joins the crowd), *Play a match* (split the heads
into two teams, watch them play soccer, you pick the teams), *Tournament* (a full cup with a
bracket, goals and a winner), *Make a gradient* (dial a planet of coloured light, leave with the
image and the code). All four are his, all four run in the browser.

**Where it lands.** The nav item is an icon + `<span class="jbLbl">Play</span>` with no room for
prose, and `play.html` is `noindex` so a meta description does nothing. The line belongs on the
page, between the h1 (*"Crafting digital experiences, made with [mood]"*) and the `.heroCtas`
row — the same slot `index.html` reserves with `<p class="sub">`, which on the home page is
`display:none` and unused. **`play.html` has no equivalent element today**, so this is one new
`<p>` plus one style rule. Every option below is written to sit under that h1 and read as its
second beat.

> **Option 3A — the hook.** *Emphasises:* the one detail nobody expects. *Suits:* the top of a
> page whose job is to make you click, not to inventory itself.
>
> **`Four toys I built into this site. Upload your face and it plays soccer.`**
>
> 70 chars. Reads as confidence because it states a capability, not a caveat, and the second
> sentence is a specific promise rather than a category. It does not enumerate all four, which is
> fine: the four cards below do that, in his words, already.

> **Option 3B — the inventory.** *Emphasises:* range — four different things, all built. *Suits:*
> a recruiter who is scanning for evidence and will not scroll to find it.
>
> **`Everything on this page is something I built and you can play: a soccer match between
> floating heads, a full tournament, a head maker that cuts your face out of a photo, and a
> gradient maker.`**
>
> The longest option, and the only one that makes the hiring signal explicit ("something I
> built") without saying the word portfolio.

> **Option 3C — the flat statement.** *Emphasises:* restraint. *Suits:* him if the hero already
> has enough going on and the line should just orient, not sell.
>
> **`Games I built for this site, running right here. Your face is welcome on the field.`**
>
> 82 chars. Two beats, a parenthetical-free version of his usual rhythm, and the second sentence
> carries the invitation the cards then cash.

**A nav-length variant, if he ever wants one** (as an `aria-description` or a title attribute on
the nav item — not built today, and worth knowing it is not free): **`Games I built. Yours to
play.`** — 30 chars.

**One thing not to do:** the h1 already contains "Crafting digital experiences," which is his own
choice on this page and stays. None of the options above repeat that register, and none of them
should — one instance is a signature, two is a tic.

---

## Fix 4 — "open to work" with a real start date

**He fills in the truth. Every placeholder below is in `[SQUARE BRACKETS]` and must not ship as
written.**

### Where it lands, and the trap

`<p class="footStatus">Open to full-time roles.</p>` — **byte-identical on eight pages**:
`index.html`, `about.html`, `apollo.html`, `bearings.html`, `cluster.html`, `strata.html`,
`ucdavis.html`, `play.html`.

`tools/footer-consistency-check.py` compares **the entire `<footer>` element byte for byte across
all eight**, and separately asserts `APPROVED_STATUS = "Open to full-time roles."` at line 50.
So a change here is **nine edits, not one**, and eight of them must be identical bytes.
`headmaker.html` and `gradientlab.html` are deliberately footerless — do not add one.

**A ninth surface is already inconsistent and should be fixed in the same pass:** `about.html`'s
At-a-glance Status row says **"Open to full-time opportunities"**, not "roles". Nobody has
noticed, but a reviewer who is already hunting for contradictions will.

### Options

> **Option 4A — a named month.** *Emphasises:* that he has a plan and a date. *Suits:* **available
> from a month** — a graduate with a known finish date, or anyone whose availability is a future
> fact rather than a present one.
>
> **`Open to full-time roles from [MONTH YYYY].`** — 42 chars with the placeholder; e.g.
> `Open to full-time roles from September 2026.` at 43.
>
> A month is checkable and reads as planning. "In a few weeks" or "soon" reads as evasion — a
> recruiter cannot put either in a calendar. **This is the strongest default of the three** if the
> date is more than two weeks out.

> **Option 4B — available now.** *Emphasises:* zero friction. *Suits:* **available now**, and only
> then. Recruiters filter on it, so if it is true it is the highest-value words in the footer.
>
> **`Open to full-time roles. Available now.`** — 39 chars.
>
> Two sentences, matching the hero's own habit. Do not soften it to "available immediately" —
> "now" is shorter and stronger. **If it stops being true, this line has to change**, which is the
> one maintenance cost of picking it.

> **Option 4C — with notice.** *Emphasises:* that he is currently working, which is a positive
> signal, and that the delay is a professional obligation rather than hesitation. *Suits:*
> **available with notice.**
>
> **`Open to full-time roles, available on [N] weeks' notice.`** — 56 chars with the placeholder;
> e.g. `…on two weeks' notice.` at 53. Spell the number out; the rest of the site's prose does
> (*"eighteen hours"*, *"five weeks"*).
>
> Never write this as "currently employed but open" — that is the same fact framed as an excuse.
> "Available on two weeks' notice" is a commitment with a date attached.

### Which to use when — the short version

| Situation | Use | Because |
|---|---|---|
| Can start immediately | **4B** | It is the only one a recruiter can act on today, and it is the rarest of the three. |
| Known future date | **4A** | A month is a fact. A vague soon is a shrug. |
| Employed, owes notice | **4C** | Notice is evidence of professionalism, not a delay to apologise for. |
| Date genuinely unknown | **leave `Open to full-time roles.` alone** | An invented or hedged date is worse than no date. Do not ship `[MONTH]` and do not ship "available soon". |

### If he wants location and availability in one line

**Do not put it in the footer.** The comment above `.footStatus`'s rules in `index.html` (search
`"San Francisco" came out`) records the reason the city came *out* of the footer sentence:
About's At-a-glance already says it, and the footer was the third telling. Two more headstones
exist for putting the availability line back in the *hero* — the `ROUND 11` block in `index.html`
(search `let's put 'Based in San Francisco`) and the `.heroAvail` removal note in `header.css`
(search `WHAT WENT WITH IT`). It has been in the footer, above the h1, under the h1, and is now
nowhere; the measured cost of the last attempt was 31px of the head's clearance above the fold.
`hero-engine.js` still calls `getElementById("heroAvail")` behind a null guard, so re-adding an
element with that id would silently re-animate — which is a reason to be deliberate, not an
invitation. The At-a-glance block is where both facts belong together, and it already has both
rows.

---

## What has to be checked in a browser before any of this ships

`.superpowers` / the verification skill has the full workflow; these are the ones specific to
this document.

1. **Any h1 change** — 390px and 1440px, real Chrome, and count the lines. 46 chars (1A) cannot
   regress. 50 (1B) is a one-character delta. 55 (1C) is inside the last comfortable band at
   desktop and is the one that can bite on mobile.
2. **`python3 tools/home-minimal-hero-contract.py`** after any h1 change — and remember it
   asserts the sentence twice.
3. **`python3 tools/footer-consistency-check.py`** after any status-line change — it will fail if
   even one of the eight pages differs by a byte, which is exactly the failure it exists to
   catch.
4. **The At-a-glance rows at 390px** for options 1-F2 (54 chars) and 1-F3 (47) — both are longer
   than the widest value in that block today.
