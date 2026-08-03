# Case-study titles — research and proposal

**Date:** 2026-08-03
**Scope:** the `<h1>` on all five case studies, the home-page card labels, and where contribution belongs.
**Method:** read all five pages in full (text extracted from the HTML, not skimmed from the titles), then web research. Every claim a proposed title makes is traced back to a line on the page it belongs to.
**Constraint:** this document is the deliverable. No existing file was edited — other agents are live in `index.html`, `play.*` and the case-study pages.

---

## 0. Verdict, up front

**Jayden's instinct to change the titles is right. His diagnosis is close but not quite it, and his proposed fix — "state specific contributions" in the title — is the wrong repair.**

Three findings drive that:

1. **The real pattern isn't "evocative vs professional." It's that four of the five titles are written in the *product's* voice, not the *designer's*.** "Find your cluster." and "Stack your wins." are App Store taglines. They tell a reader what the app says to its user. They tell a design lead nothing about what Jayden decided. That is a sharper problem than "not professional enough," and it explains why the pages feel like marketing sites rather than case studies even though the body copy is genuinely strong.
2. **Contribution does not belong in the title, because it is already 80px below it and better said there.** "Founder & product designer / All 58 screens, designed solo" is a stronger, more credible statement than any headline could make, and it's in the conventional place reviewers look. Duplicating it in the h1 would read as insecurity, not seniority.
3. **The h1's best job is the project's thesis — the specific, non-obvious design bet.** That is the thing a hiring manager is actually screening for (judgment), it is the one thing the metadata row *can't* say, and it preserves the voice that currently differentiates these pages. It is a hybrid, but not the hybrid the brief anticipated: not "evocative headline + contribution subline," but **one line that is both specific and voicey**, with contribution left to the facts row that already exists.

The single change with the highest payoff per word: **stop writing the product's tagline, start writing the decision.**

---

## 1. What the titles are today (verified)

Read from the live files. Note the `<span class="eyebrow">` has already landed in all five — a concurrent change — so the product name is already carried above the title.

| File | Eyebrow | `<h1>` | Register |
|---|---|---|---|
| `apollo.html:515` | Apollo | **"Make the invisible visible."** | Mission statement / product tagline |
| `bearings.html:515` | Bearings | **"Plan the whole trip, together."** | Product tagline |
| `cluster.html:515` | Cluster | **"Find your cluster."** | Product tagline (and circular — defines the product with its own name) |
| `strata.html:533` | Strata | **"Stack your wins."** | Product tagline |
| `ucdavis.html:540` | UC Davis Rec | **"Reimagining the UC Davis Rec app."** | Generic descriptive — and now redundant against the eyebrow |

**The pattern:** 4/5 are marketing copy for the product. 1/5 is the "Redesigning the X" formula that every bootcamp portfolio uses. None names a decision, a constraint, a trade-off, or a role.

**Two structural notes:**

- The eyebrow change means the h1 **no longer has to carry the product name**. That frees roughly three to five words. `ucdavis.html` now says "UC Davis Rec" twice in the same visual block — that is a live redundancy to fix regardless of what else is decided.
- Metadata sits **below** the cover image (`apollo.html:517` cover, `:519` facts), which matches the reference portfolio's order and the recommendation in `2026-08-02-case-study-teardown.md`. Good — don't disturb it.

**Where each title diverges most from its own page:**

- **Strata** is the worst mismatch. "Stack your wins." implies the page is about a habit tracker. The page is actually about *designing something and then building it twice* — Lovable, then a native Xcode rebuild — plus a genuinely thoughtful section on where AI stops ("It is a tool for bringing my designs to life, not a replacement for doing the design"). The title hides the entire reason the page is interesting.
- **Cluster** is the emptiest. "Find your cluster." plus an eyebrow reading "Cluster" is two words of information total. The page has an 800-clubs stat and a first-project story; the title uses neither.
- **Apollo** is the most quietly costly, because it's the flagship. "Make the invisible visible" is a phrase with wide prior circulation in design writing — it's used as a DesignOps slogan ([Coronado, Bootcamp](https://medium.com/design-bootcamp/behind-the-scenes-we-must-make-the-invisible-visible-articulating-the-impact-of-design-a9bd7ce6fd11)), an engineering principle ([principles.dev](https://principles.dev/p/make-the-invisible-visible/)), and a leadership maxim ([allcanlead](https://www.allcanlead.com/making-the-invisible-visible)). It reads as *borrowed*, which is exactly the opposite of the voice premium it's meant to buy.
- **Bearings** is the best of the five. It's still product copy, but it names the actual differentiator (group, together) and is instantly legible.

---

## 2. Research: how strong portfolios actually title case studies

### 2.1 The taxonomy, with real examples

**A. Product + descriptor (verb + product + focus).** The dominant professional pattern. Every one of these is a real, published case-study title:

- "Redesigning Uber's pickup experience" — Simon Pan (ex-Google, ex-Uber)
- "Leading design at Medium" — Bethany Heck
- "Redesigning Chrome for Windows" — Sébastien Gabriel (Google)
- "Building a conference platform for the scientific community" — Jacob Dilley
- "Elevating the Paperchase e-commerce experience" — Angelica Araujo
- "Improving scalability, reusability and consistency for e-commerce app card components" — Matt Orton, Senior UX Designer

Sources: [uxpilot's teardown of 12 portfolios](https://uxpilot.ai/blogs/product-design-portfolio-case-studies), [uxfol.io's 27 examples](https://blog.uxfol.io/ux-portfolio-examples/).

Note what these have in common and what Jayden's don't: a **verb of contribution** (redesigning, leading, building, improving) and a **named object**. That verb is where the "professionalism" he's asking for actually lives — not in the presence of a job title.

**B. Outcome-led.** Advocated loudly, practised less than the advice implies. The canonical shape given in the guidance literature: "Redesigning the Onboarding Flow for a Fintech App to Reduce 7-Day Churn by 31%" ([uxfol.io](https://blog.uxfol.io/ux-portfolio-case-study-template/)). Matej Latin's template is "How I [action] to [result] and [better outcome]" ([matejlatin.com](https://matejlatin.com/blog/only-30-seconds-to-reject-your-portfolio/)). **None of Jayden's five projects can honestly fill this shape.** See §4.

**C. Contribution-led.** "Building DemocracyOS for civic engagement," "Designing Centene's recovery platform." Same as A with the contribution verb foregrounded. Reads well when the contribution was unusual (founding, systematising, leading).

**D. Problem-led / hybrid with an em-dash subline.** Florian Bölter's Open Doors newsletter gives the sharpest concrete rewrite I found: replace "Group Payment" or "PayPal Internship" with **"Enabling users to pay together — improving shared payment completion rates"** ([opendoorscareers](https://blog.opendoorscareers.com/p/how-recruiters-and-hiring-managers-actually-look-at-your-portfolio)). Note the structure: contribution clause, em dash, outcome clause. This is the closest published thing to the "hybrid" the brief asked about.

**E. Evocative / editorial.** Rarer than you'd think in *hired-designer* portfolios; common in agency and art-direction work. Robin Noguier's "Exploring playful UI concepts with FUN" is about as far as the sampled set goes, and it's still descriptive.

**F. The reference portfolio's own answer.** Worth recording because it's the site Jayden is calibrating against. `trungvo.xyz/expresso` uses:

> eyebrow: **"Expresso"**
> headline: **"how expresso helped students at uc davis"**
> metadata: Role "Founding Product Designer" · Team "+10 Designers" · Date "Jan 2025 – Jun 2025" · Skills "Design-System"

That is **not** evocative and **not** metric-led. It's a plain-language claim about what the product did for a named audience, with the professional credentials in the row below. Lowercase styling carries the voice; the words carry the substance. That split — *voice in the typography, substance in the words* — is the move worth taking.

### 2.2 What the reviewers say, and how much to trust it

**Where sources agree (high confidence):**

- **The title is disproportionately load-bearing.** Latin: case-study titles are "the best chance to grab attention." Bölter, describing a project card: "One big image, not a collage. A clear, meaningful title that tells me what this is about and why it mattered."
- **Generic beats nothing, but specific beats both.** Nikki Kipple (The Crit, reviews student portfolios at volume): "Personality + Specificity = Memorable + Credible." Her bad examples are all personality-without-specificity — "Passionate designer creating beautiful experiences," "Creative professional focused on user-centered design." Her good ones pair a voice signal with a concrete domain: "Fintech nerd obsessed with checkout flows," "UX designer reducing checkout abandonment for e-commerce." [Source](https://thecrit.co/resources/writing-effective-taglines). **This is the single most directly applicable framework to Jayden's problem**, and it says the answer is *both*, not *either*.
- **Role must be unambiguous somewhere prominent.** Susan Le, UX Director, in Indeed Design's panel: "I look for depth and breadth. I like to see project overviews summarizing the problem statement, process, team makeup, and the candidate's role on the team." ([Indeed Design](https://indeed.design/article/ux-design-portfolio-advice-from-hiring-managers/)) Note she puts role in the *overview*, not the title.
- **Don't invent numbers.** Van Schneider, ex-Spotify design lead: "definitely do not make anything up." ([Medium](https://vanschneider.medium.com/how-to-write-project-case-studies-for-your-portfolio-2e8d397a60b4))

**Where sources disagree (report, don't average):**

| Question | Camp 1 | Camp 2 |
|---|---|---|
| Metrics in the title? | uxfol.io / Latin: yes, put the outcome in the headline; it's how a reader knows relevance in one line. | Van Schneider: don't lead on "crazy analytics reports"; mention success briefly, in plain language. Reference portfolio: no metric in the headline at all. |
| Process or outcome? | Rhonda Gilligan (UX Design Manager): "Prove the success of the finished product with metrics." | Corey Chandler (UX Design Manager, same panel): "The journey is actually the most important part." |
| Concept/self-initiated work | Muzli/uxfol.io: reframe as a product experiment; it's credible if the reasoning is. | Corey Chandler: "I would rather see a smaller product that actually shipped. Concept projects aren't subjected to the same trials and tribulations that shipped products undergo." |

The Gilligan/Chandler split is inside a *single article, same panel, same company* — which is the most useful thing in all of this research. There is no consensus to comply with. There are individual reviewers with individual priors, and the only strategy robust to both is a title that is **specific and true**, because specificity satisfies Gilligan's camp without a number and truth satisfies Chandler's.

**Evidence quality — be honest about this.** Almost everything above is **practitioner opinion**, not evidence. Specifically:

- The "hiring managers spend 6 seconds / 30 seconds / 55 seconds–3 minutes on a portfolio" figures circulate widely and **none of the sources I could reach traces them to a study of design-portfolio review.** Latin, who is the origin of the most-cited "30 seconds" framing, sources his number from a *résumé* six-second study and then extrapolates. Treat the specific number as folklore; treat the *direction* — that first-screen review is fast and triage-shaped — as safe, because every reviewer quoted describes their own behaviour that way.
- The Indeed Design panel is the strongest source in the set: six named UX directors and managers, quoted directly, disagreeing with each other. That's what real signal looks like.
- Kipple's and Palmer's pieces are opinion but *high-volume* opinion (both describe reviewing hundreds of portfolios) and both converge on the same rule from different directions.

---

## 3. The honest trade

**What the evocative titles are actually buying him.** Not nothing. In a stack of forty portfolios where thirty-eight say "Redesigning the checkout flow," "Stack your wins." is the one that sounds like a person wrote it. Kipple's framework says voice is half the job, and Bölter says "generic tagline = instant close." Jayden's writing voice is genuinely the best thing on this site — the Bearings paper-collage section, the Strata "the gamified-habit space is completely saturated" admission, the Cluster tapin footnote. Those paragraphs are the reason a reviewer would remember him. Killing the voice at the top of the page to gain "professionalism" would be trading his differentiator for a commodity.

**What they cost.** Two things, and both are real:

1. **They spend the highest-value line on information the reader already has.** "Find your cluster." sits directly above an eyebrow reading "Cluster" and directly above a cover image of the app. Three elements, one piece of information. At a 10-second scan that's the whole hero wasted.
2. **They are indistinguishable from each other in register.** Five imperative product taglines in a row reads as a *house style*, not five different projects. A reviewer scanning the work grid gets no differentiation signal — which of these is the systems project? Which is the shipped one? Which one did he build himself? The titles don't say, so the reviewer has to open all five, which at <60s per case study means opening none.

**What contribution-led titles cost.** They scan fast and answer "what did you do" immediately — but they duplicate the facts row verbatim, they're interchangeable across candidates ("Designed 58 screens" is a volume claim, and volume is the least interesting thing about Apollo), and at their worst they read as a résumé bullet promoted to 40px type. The Indeed panel puts role in the *overview*, not the headline, for exactly this reason.

**So: hybrid — but not the one the brief proposed.** A separate "contribution subline" under the h1 would push the cover image down, duplicate the facts row it sits above, and duplicate the Overview paragraph below it. Three statements of the same thing in one screen.

**The better hybrid is inside a single line: a specific design decision, stated in his own voice.** "An ADHD-native social app with no streaks, no counts, and no color" is evocative *and* contribution-bearing — you cannot write that sentence without having made those three decisions. That's Kipple's Personality + Specificity in one line, and it costs no vertical space.

---

## 4. Solo-founder and student work: the overclaiming trap

Four of the five are self-initiated, academic, or hackathon-origin. None has shipped. None has a usage metric. That is the governing constraint on every title below.

**What the guidance says:**

- Estimate conservatively and label the estimate — "Estimated 15% improvement in task completion (metrics tracking wasn't implemented)" ([Muzli](https://muz.li/blog/how-to-build-a-ux-portfolio-that-actually-gets-you-hired-2026/)). Honesty builds trust.
- Where there's no metric, substitute *qualitative* evidence: adoption, stakeholder response, follow-on work that got greenlit because of it.
- "Claiming credit for everything is a red flag" — be explicit about what others contributed.
- Reference checks specifically probe this. The recruiting-side framing is blunt: "Did they actually lead the redesign, or did they execute visual design under another designer's direction?" ([icreatives](https://www.icreatives.com/iblog/the-7-step-portfolio-review-process-every-creative-hiring-manager-needs/))

**Jayden already does this well in body copy** — Bearings says outright "It hasn't shipped yet, so those are the first things I'd instrument," and Cluster says "Cluster never shipped." That honesty is an asset and should not be diluted by a title that implies otherwise.

**The qualitative evidence he *does* have, and can title on without risk:**

| Project | Verifiable, non-metric outcome |
|---|---|
| Bearings | Audience Choice Award; judges from LinkedIn and ServiceNow singled out the brand identity |
| Cluster | Most Innovative award; the tapin footnote (a shipped app doing what Cluster proposed) |
| UC Davis Rec | It landed him an interview and a spot in Design Interactive — a real, checkable consequence |
| Strata | 710 edits; a native Xcode rebuild that exists; a live playable demo on the page |
| Apollo | 58 screens; a company; a 24-hour hackathon origin |

**The specific overclaim to refuse:** *"Turning 18 hours of trip planning into five steps"* for Bearings. The 18 hours is Talker Research's industry stat for the *problem*, not a measured before/after of Bearings. As a section heading inside the page ("Five steps against eighteen hours") it's fine — the surrounding paragraph makes the framing clear. As an h1 it reads as a result, it contradicts his own Outcome section two screens later, and it is exactly the kind of thing that falls apart when an interviewer asks "how did you measure that?"

---

## 5. Where the contribution actually belongs

**Assessment: the facts row is already doing this job, and doing it better than a title would.**

`apollo.html:519–524` renders Role / Scope / Timeline / Year as a `<dl class="facts">` immediately under the cover. "Founder & product designer" + "All 58 screens, designed solo" is a complete, credible, conventionally-placed answer to "what did you do." Susan Le's panel quote puts role exactly there — in the project overview, not the headline.

**So the fix is not to move contribution into the title. It's three smaller things:**

1. **Keep the facts row where it is.** Below the cover matches the reference portfolio and the teardown's recommendation. Don't let a "make it more prominent" instinct push it above the image; the image earning attention first is the right order.
2. **Make the row's fifth column do more work.** The five pages currently carry different fourth/fifth fields (Scope, Team, Recognition, Built with, Key idea, Demo). That inconsistency is actually a *feature* — each project gets its most distinctive credential — but it should be deliberate. Suggested: every page carries `Role`, `Team` (or `Scope` where solo), `Timeline`, `Year`, plus **one distinctive fifth** (Recognition / Built with / Demo / Key idea). Bearings and Cluster should both carry Recognition; Apollo should keep Scope.
3. **Fix the two role inconsistencies that already exist** (see §8). These are the highest-risk items on the site and they have nothing to do with titles.

**On adding a deck/subline under the h1:** don't. The Overview paragraph is already one scroll below and says the same thing in better prose. A deck would be a third statement of the same idea in a single viewport.

---

## 6. The recommended pattern

> **Eyebrow = product name. `<h1>` = the design thesis, in Jayden's voice. Facts row = role and scope. Overview = the product in one sentence.**

Rules for the h1:

- **Six to twelve words.** Long enough to be specific, short enough to survive a 40px hero at 390px wide.
- **Names a decision, a constraint, or a trade-off** — something only this project could say.
- **Does not repeat the eyebrow, the facts row, or the cover image.**
- **No percentage, no business metric, no implied before/after** on any of the five. There isn't one to cite.
- **Keeps the sentence-case, full-stop typographic voice already in use.** Voice lives in the styling and the rhythm; substance lives in the words. That's the split the reference portfolio uses.

---

## 7. Proposed titles

All five keep their existing eyebrow. Sentence case, terminal full stop, matching current house style.

---

### Apollo — eyebrow "Apollo"

Current: *"Make the invisible visible."*

| | Option | Register |
|---|---|---|
| **A** | **An ADHD-native social app with no streaks, no counts, and no color.** | Design-bet led |
| B | Designing all 58 screens of an ADHD-native social app, solo. | Contribution led |
| C | The middle of building anything goes unseen. Apollo makes it visible. | Problem led |

**Pick: A.**

*Why:* it is the only one of the three that a reviewer could not write about any other portfolio. Every clause is a decision he made and defended on the page, so it simultaneously answers "what is it" (social app, ADHD), "what did you decide" (three subtractions), and "can you defend it" (yes, three sections deep). It is subtractive — which is the thing his own design taste is built on — and it keeps voice without borrowing a stock phrase.

*Page evidence:* "no follower counts, no leaderboards, nothing that turns showing up into a number you can lose"; "no red anywhere, and no color at all in the interface: the only color in Apollo is your own photos"; "no streaks, no shame, no doomscroll"; "the ADHD-native thinking lives in the design, not just the marketing" — his own term, used verbatim.

*Why not B:* it duplicates the facts row word-for-word ("All 58 screens, designed solo") and leads on volume, which is the least interesting fact about Apollo. *Why not C:* two sentences, and it keeps the abstract framing that made the current title weak.

*Overclaim check:* clean. No metric, no shipped claim. "Founded" and "solo" are both in the facts row where they're checkable.

---

### Bearings — eyebrow "Bearings"

Current: *"Plan the whole trip, together."*

| | Option | Register |
|---|---|---|
| **A** | **Building the design system for a group road-trip planner.** | Contribution led |
| B | One design system to keep five designers on the same page. | Contribution + judgment |
| C | Turning 18 hours of trip planning into five steps. | Outcome-shaped — **flagged** |

**Pick: A.**

*Why:* the About page states his focus as "iOS · B2C · design systems," and this is the only case study that evidences a system built *for other people to use*. The title should point straight at it. A also keeps the product category legible ("group road-trip planner") for anyone who doesn't know the name in the eyebrow — which matters more here than anywhere else, because Bearings is the first card in the grid and is doing first-impression duty for the whole site.

B is the braver line and I'd support it if he wants more voice — it's fully evidenced ("4 designers + a lead"; "I took it on myself to build shared components for the team... to give us one direction to move in together") and it says something about how he works, not just what he made. Its cost is that the product category disappears entirely from the hero.

*Page evidence for A:* "I led the visual design. I built the design system and a set of shared components so the team could move fast and keep every screen feeling like one product, and I set the type, spacing, and sizing that held it all together"; "I designed 28 of the final screens."

*Overclaim check on A and B:* clean — both are contribution claims, corroborated by named specifics on the page, and the facts row correctly says "Product Designer" on a team of five rather than implying he led it.

**C is flagged and I recommend against it.** The 18 hours is Talker Research's number for the general problem, not a measured result of Bearings. As an h1 it reads as an outcome and is directly contradicted by his own Outcome section ("It hasn't shipped yet"). It works as the existing *section* heading, where the surrounding paragraph frames it. Leave it there.

---

### Cluster — eyebrow "Cluster"

Current: *"Find your cluster."*

| | Option | Register |
|---|---|---|
| **A** | **800 clubs, and no way to find the one that's yours.** | Problem led |
| B | My first product, designed while learning Figma from zero. | Honest-scope / retrospective |
| C | Every screen of a campus discovery app, in five weeks. | Contribution led |

**Pick: A.**

*Why:* the 800-clubs figure is the most memorable and most verifiable thing on the page, it's the reason the product exists, and it survives a two-second glance. It also fixes the current title's circularity.

*Why not B, even though it's charming:* it leads with inexperience in the exact line where a reviewer is deciding whether to click. The humility is an asset — but it belongs in the Overview and Outcome, where it already is ("My first full design project"; "there is plenty I would change"). Putting it in the h1 pre-discounts a 2024 student project that is sitting in a grid next to Apollo. Keep the honesty; move it one paragraph down.

*Page evidence:* "UC Davis is home to more than 800 student clubs, but the ones that are not already big are basically invisible"; "Every transfer I talked to said the same thing, no clue how many clubs existed."

*Overclaim check:* clean. Note the title makes no claim about Jayden at all — that's deliberate, and it's why the facts row and the role fix in §8 matter more on this page than any other.

---

### Strata — eyebrow "Strata"

Current: *"Stack your wins."*

| | Option | Register |
|---|---|---|
| **A** | Designed it, then built it — in Lovable, then again in Xcode. | Contribution / skill led |
| **B** | **710 edits to learn where AI stops and design starts.** | Judgment led |
| C | A habit builder you can play, right here on the page. | Product + differentiator |

**Pick: B.**

*Why:* this is the largest title-to-content gap of the five, and B closes it. The page is not really about habits — it's about steering AI toward a vision and knowing where that stops. B says that in nine words, anchors it to an unfakeable artifact (an edit count, not an impact metric), and is the one title in this document that would make a design lead stop scanning. In 2026 "I know exactly where AI helps me and where it doesn't" is a hireable position, and no other page on the site claims it.

A is the safe runner-up and is a strong claim in its own right — designed-then-built-twice is rare. C is worth keeping in mind for the **home-page card**, because "playable right here" is a genuine differentiator that the card grid currently hides. (It's already in the facts row: `Demo — Playable on this page`.)

*Page evidence for B:* "I racked up 710 edits"; "It is a tool for bringing my designs to life, not a replacement for doing the design"; "That line, where AI amplifies a designer and where it should not stand in for one, is the most valuable thing I walked away with."

*Overclaim check:* clean, and unusually so — 710 is a build-effort count, not a business outcome, and the title claims a *learning* rather than an impact. Nothing to walk back in an interview.

---

### UC Davis Rec — eyebrow "UC Davis Rec"

Current: *"Reimagining the UC Davis Rec app."* — also now redundant against the eyebrow.

| | Option | Register |
|---|---|---|
| **A** | **Putting the gym ID in Apple Wallet, and killing the login.** | Key-move led |
| B | Three days to fix the app students only open to scan in. | Constraint + research led |
| C | The barrier between a student and the door. | Evocative |

**Pick: A.**

*Why:* it names one specific product decision a reviewer can immediately evaluate and have an opinion about — which is what "shows product sense" actually means in practice. It's the thing he says he's proudest of, it's the cheapest possible fix to the real problem, and reusing an existing user behaviour (Wallet) instead of building new UI is a recognisably senior move. It also removes the eyebrow redundancy.

B is a good alternative if he wants the constraint foregrounded; "three days" is honest scoping that pre-empts "why is this so thin?"

*Page evidence:* "Instead of logging in every time, I moved the Member ID into Apple Wallet"; "It turns the app's biggest point of friction into its fastest interaction"; the three interview quotes, all of which say the same thing.

*Overclaim check:* clean as written. **Do not** extend it with a speed or adoption claim — nothing was built, shipped, or measured, and the page correctly says he'd "pitch the ARC on making the Apple Wallet integration real." The two stats on the page (92% password abandonment, 84% Gen Z wallet use) are cited industry figures supporting the *idea*; they must not migrate into the title, where they'd read as his results.

---

### Summary table

| Page | Eyebrow | Proposed `<h1>` |
|---|---|---|
| `apollo.html` | Apollo | An ADHD-native social app with no streaks, no counts, and no color. |
| `bearings.html` | Bearings | Building the design system for a group road-trip planner. |
| `cluster.html` | Cluster | 800 clubs, and no way to find the one that's yours. |
| `strata.html` | Strata | 710 edits to learn where AI stops and design starts. |
| `ucdavis.html` | UC Davis Rec | Putting the gym ID in Apple Wallet, and killing the login. |

Note the registers are now **five different shapes** — design bet, contribution, problem, judgment, key move. That variety is deliberate and is itself a signal: it tells a scanning reviewer that these are five different kinds of project, which the current five-taglines-in-a-row does not.

Remember to update each `aria-label` on the `<h1>` (currently `"Apollo — Make the invisible visible."` etc.) to match.

---

## 8. The home page

### Should the card labels change to match the titles?

**No — and specifically, do not repeat the h1 on the card.** The card's job is category recognition and a click decision; the h1's job is the thesis. Repeating the h1 wastes the second impression and makes the case-study page feel like it has nothing new to say.

But the cards *are* currently under-informative. Right now each card is name + year (`index.html:2345` etc.). The Role / Problem / Solution content in `csInfoCard` (`index.html:2517–2522`) is genuinely good — better than most portfolio grids — but it's **hover-gated**, which means it does not exist on touch devices or for a reviewer scanning without a mouse. That's the biggest single information loss on the home page.

**Recommendation:** add one static descriptor line under each card name — 5–9 words, product category plus the one distinguishing thing. Not the h1, not the hover copy.

| Card | Proposed descriptor line |
|---|---|
| Bearings | A group road-trip planner, and the system behind it |
| Apollo | An ADHD-native social app I founded |
| UC Davis Rec | A three-day redesign that moved the gym ID into Wallet |
| Strata | A habit builder I designed, then built twice |
| Cluster | A campus club-discovery app — my first product |
| R3SHORE | AI-native staffing for U.S. hardware manufacturing |

This is Bölter's project-card rule almost verbatim: "One big image, not a collage. A clear, meaningful title that tells me what this is about and why it mattered."

### R3SHORE

Two facts about the current state (`index.html:2415–2423`): the card has **no `<a>` wrapper**, so it is unclickable and gives no visual signal of that; and the hover data at `index.html:2517` claims `role:"Head of UX"` with "In progress — case study coming soon."

**Recommendation, in order of preference:**

1. **Ship a short page** — even 400 words plus three images. A senior title with an artifact behind it is worth more than the other five cards combined.
2. **If he's leaving and won't build the page, remove the card.** An unclickable card in a grid where every other card opens something is a dead end at the exact moment a reviewer is deciding to engage. "In progress" reads to a screener as "nothing to see."
3. **If it stays** (reasonable — it's the only professional-context work on the site): give it an explicit non-link affordance and a status line, keep it last, and **reconcile the role claim with his résumé**, because a Head-of-UX title on an unevidenced card is the highest-scrutiny item on the whole portfolio. See below.

### Two live role inconsistencies to fix — independent of titles

These are the concrete overclaim risks that exist *today*, and they're more urgent than any headline:

1. **Cluster.** `index.html:2521` says `role:"Lead designer"`. The case study says: *"My title was product designer, but I took the lead the whole way."* The page's own honesty is better than the card's claim. Align the card — e.g. "Product designer (took the lead)" — or match the page's `Role: Product designer`. Reference checks probe exactly this discrepancy: "Did they actually lead the redesign, or did they execute visual design under another designer's direction?"
2. **R3SHORE.** `role:"Head of UX"` with no page, no dates, no scope, and a departure. Either evidence it or soften it. This is the one claim on the site most likely to be checked and least able to defend itself.

---

## 9. What I'd tell him plainly

His instinct is right, but for a different reason than he thinks. The titles aren't unprofessional — they're **product marketing wearing a case study's clothes**. Fixing that doesn't require putting his job title in 40px type; it requires the h1 to state the decision instead of the pitch.

And the part of his premise I'd push back on hardest: **contribution does not belong in the title, because the facts row already says it better and a reviewer already knows to look there.** Adding it to the h1 would say the same thing three times in one screen (h1, facts row, Overview) and would trade the one asset his pages have that most portfolios don't — a voice — for a résumé bullet. The evidence points at the hybrid *inside one line*: specific and voicey, not evocative-plus-subline.

The largest risk in doing this work at all is that "state specific contributions" quietly becomes "state specific impact," and none of these five projects has impact to state. Nothing shipped. Nothing was measured. He's already honest about that in the body copy, which is a genuine strength — the titles must not undercut it.

---

## Sources

- [Indeed Design — UX design portfolio advice from hiring managers](https://indeed.design/article/ux-design-portfolio-advice-from-hiring-managers/) (six named UX directors/managers; strongest source in the set, and they disagree with each other)
- [Nikki Kipple, The Crit — Writing effective portfolio taglines: the Personality + Specificity framework](https://thecrit.co/resources/writing-effective-taglines)
- [Florian Bölter, Open Doors — How recruiters and hiring managers actually look at your portfolio](https://blog.opendoorscareers.com/p/how-recruiters-and-hiring-managers-actually-look-at-your-portfolio)
- [Taylor Palmer, UX Tools — 5 principles of exceptional case studies in UX portfolios](https://www.uxtools.co/blog/5-principles-of-exceptional-case-studies-in-ux-portfolios)
- [Matej Latin — Only 30 seconds to reject your portfolio?](https://matejlatin.com/blog/only-30-seconds-to-reject-your-portfolio/) (source of the widely-repeated timing claim; note the extrapolation)
- [Tobias van Schneider — How to write project case studies for your portfolio](https://vanschneider.medium.com/how-to-write-project-case-studies-for-your-portfolio-2e8d397a60b4)
- [uxpilot — 12 best product design portfolios analyzed](https://uxpilot.ai/blogs/product-design-portfolio-case-studies) (source of the real case-study titles in §2.1)
- [uxfol.io — 27 best UX portfolio examples](https://blog.uxfol.io/ux-portfolio-examples/) and [UX case study template](https://blog.uxfol.io/ux-case-study-template/)
- [iCreatives — The 7-step portfolio review process every creative hiring manager needs](https://www.icreatives.com/iblog/the-7-step-portfolio-review-process-every-creative-hiring-manager-needs/) (role verification / reference checks)
- [Muzli — How to build a UX portfolio that actually gets you hired (2026)](https://muz.li/blog/how-to-build-a-ux-portfolio-that-actually-gets-you-hired-2026/) (conservative-estimate labelling for missing metrics)
- [Greg Hill, Head of Design at Step — A hiring manager's perspective on your portfolio](https://medium.com/design-bootcamp/a-hiring-managers-perspective-on-your-portfolio-58eb81c2abd9)
- Reference portfolio, read directly: `https://trungvo.xyz/expresso` (eyebrow + headline + metadata row, quoted verbatim in §2.1F)
- Internal: `docs/superpowers/specs/2026-08-02-case-study-teardown.md`
