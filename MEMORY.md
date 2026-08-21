# What I have learned about Jayden, his design, and this work

`CLAUDE.md` is the operating manual: the rules, the traps, the things not to do.
This file is the **understanding underneath it** — who he is, how he judges,
what has been measured, and which lessons generalise past this repository.

Written 2026-08-20, from this session and the record of the ones before it.
Everything here is either something he said, something measured on this site, or
something researched and cited. Where I am unsure, it says so. **If a claim here
ever contradicts a measurement, the measurement wins — go and take it again.**

---

## 1. The person

Product designer, **just graduated UC Davis**, job-hunting in the **SF Bay Area**.
Positions himself as **iOS, B2C and design systems**. Wants work that proves he
**designs AND builds** — which is why the games are not a side project, they are
the strongest evidence in the portfolio and the thing a games-UI employer opens
first.

**He has ADHD.** He has said so plainly, in the context of wanting a life system
that "works with me" rather than a rigid schedule he will fail. This is not
incidental to the design work — it shows up in how he uses tools and in what he
asks software to do for him.

**He skims.** This is the single most important operational fact about working
with him. A careful paragraph explaining why something was deferred reads exactly
like a paragraph explaining it was done. Hence the rule that anything NOT done
goes first, on its own line.

**He is usually right when he pushes back.** The times this project went wrong
were the times someone reported a green number instead of looking at the screen.
He caught a "fits viewport: true / caption inside: true" card that was, on
screen, horrendous. He caught an audit that called his case-study covers "the
same stock meadow" when they are twelve time-of-day variants each. Treat his
objection as evidence, not as a preference to be managed.

---

## 2. His design philosophy, in his own words

**"Premium is subtraction."** His most repeated instruction. When a screen is
wrong, the answer is more often to remove something than to add something.

The list of things fixed by DELETION, each after tuning failed:
- a backdrop flood behind the hero portrait
- the portrait's ground shadow
- a full-screen poster wipe (he called it "a glitch")
- a card wrapped around a phone mockup
- a pill around seven dots
- the footer wordmark and its inset shadow — and with them, 329 lines of JS
- the drag box around the head (twice: the rectangle, then the frame's rim)
- the dashed grab hint on play's mood word
- the black play button over the reel

**Structure is the other half.** 2026-08-20: "something I really like in the
workspace that I feel like the main page lacks is structure everything felt like
it was intentionally on a grid that is connected I think adding that sense of
structure can help our site a lot like think of sites like stripe." Subtraction
without structure is just emptiness; he wants both. The margin rails, the shared
column, the hairline boundaries and the flush cells all come from this.

**Quiet chrome, smart behaviour.** Translucency and hairlines, never elevation.
Put the intelligence in what things DO, not in how loudly they are drawn.

**Make it beautiful, and mean it.** "I want to build my life in the most
beautiful and aesthetic way possible." Aesthetics are not decoration to him, they
are the point. But he distinguishes beautiful from busy, every time.

---

## 3. How he communicates, and how to answer

- **~5 lines.** Lead with what changed and the number that proves it.
- **Anything not done goes FIRST**, in its own line.
- **Questions belong in a structured prompt**, not buried in prose. He answers
  those fast and skims the rest.
- **"Slightly more/less" means 10–25%**, not a doubling. The footer band went up
  20.6% on "a little bit bigger" and that was right.
- **A request is a start signal.** Begin it in the same turn. "I cannot reproduce
  it" is a status, never an endpoint.
- **Give the measurement, not the adjective.** "202ms of blackout after the
  button was already visible" lands; "the animation feels off" does not.
- **Tell him when something is wrong, expensive, or a bad trade.** He wants the
  argument, then his call.

---

## 4. The design system as it actually stands

- **Geist, two weights: 400 and 600.** Replaced Instrument Sans on 2026-08-12
  (`a82c0d9`, `047f2a4`) — he changed it himself after rejecting typeface changes
  more than once. What survived the change is the SHAPE of the rule: two weights,
  and leading/tracking are the levers, never a third weight or another family.
- **Radius by size class:** `--r-xl` 28 (biggest surfaces), `--r-lg` 20 (cards,
  images), `--r-md` 14 (controls). Something that becomes the *environment*
  leaves the ladder entirely rather than taking a compromise rung — which is why
  the hero's bottom corners went to 0 when it stopped being a card and became the
  page's top band.
- **Spacing on a 4px grid** (`--sp-*`). The ladder tops out at 80; surface
  DIMENSIONS are not spacing and do not have to land on a rung.
- **`--accent` is ink `#090b24` site-wide. Blue is dead.** Never rebind
  `--accent` locally — it once meant two different colours in two files.
- **`--rule` is `rgba(9,11,36,.10)`** — the 10%-ink hairline. The header's floor,
  the hero's bottom edge, play's margin rails and the resting selection frame are
  all the same ink. When something needs to be quiet, reach for this rather than
  inventing a fainter grey.
- **44px minimum targets, measured not declared.** One sanctioned exception:
  inline prose links, because the line pitch is 25.5px.
- **Motion ladder:** `--dur-press` 100 · `--dur-state` 160 · `--dur-state-out`
  240 · `--dur-move` 280 · `--dur-reveal` 360 · `--dur-enter` 500. Some values
  are hand-tuned and load-bearing and must NOT be flattened into it: the About
  dissolve's 680/1000/1200, the spring `linear()` curves, the sky's 640ms
  cross-fade.
- **Shadows: the companion heads cast contact shadows. Nothing else does.** The
  shadow is *information* — it says the head is standing on something. A head
  that stands on nothing gets none: not the hero portrait, not a racer in free
  fall. Chrome separates with hairlines and translucency, never elevation.

---

## 5. Decisions he has settled — and the ones he reversed

Reversals matter as much as decisions. **A reversal is not a bug to be fixed
back.** Several comments in this codebase exist purely to stop the next agent
"restoring" something as a correction.

**Settled:**
- The case-study covers stay. Deliberate series, palettes matched to each
  product's UI, twelve time-of-day variants each.
- The Featured / Case Studies split stays. Featured is a strict subset and he
  knows: "Leave it, I like the split."
- Case-study prose runs the FULL column. A 680px measure was applied from an
  audit finding and he reverted it angrily. Do not re-apply without asking.
- The hero h1 is his alone. He has since opened it for size/placement work, but
  ask before restyling.
- The mini-Jayden head is 1.5× the others on purpose; its collision radius is
  deliberately NOT scaled.
- Play's coloured dots and current-players grid are evidence-backed. Small tweaks
  only.

**Reversed, with the history:**
- **The resize frame: three turns.** Permanent → dismissible on click-away ("i
  actually think i do prefer that the resize box can disappear") → permanent
  again, same day. Now Escape is the only door out.
- **Hero bottom corners:** he picked "sharp bottom edge, curved bottom corners"
  → then "shouldnt be curved should go straight across" once it became a band.
- **The h1 size:** bigger → "maybe the text is to big for the h1 now maybe before
  was better and tokenized."
- **Resting head tilt:** −13.8° → "more subtle ... almost upright but not quite"
  → "lets make resting tilt 0."
- **`dvh` on the hero box:** chosen so the sky never opened a gap, with the cost
  written down and "accepted" — then un-accepted when he felt it on a phone.

---

## 6. What has actually been measured on this site

Numbers earn their place here because they settled an argument.

**Entrance and motion**
- The CTA row was not late, it was **un-drawn**: buttons painted solid at 107ms,
  then `.in` landed at ~2131ms and the keyframe restarted them from `opacity:0`
  — **202ms blackout** on the primary, 334ms on the time button. play.html had
  the same bug at **829ms**. Cause: an `opacity:1` override later in the same
  sheet at equal specificity.
- Case studies opened on a **670ms blank fold** across five pages, from a
  hardcoded `setTimeout(…,760)` with the whole sequence off the ladder.
- **Keyframes restart from their own 0% and cannot be interrupted.** Transitions
  re-target from the presentation value. Prefer transitions for anything a user
  can interrupt — this is `docs/apple-design.md` §3 and it is right.

**Loading**
- The covers double-fetched: **1,100.9 KB** painted and thrown away, because the
  markup hardcodes the daytime plate and the swap script was `defer`red in
  `<head>` — it had finished downloading at 341ms but could not run until
  DOMContentLoaded at **1062ms**. Moving it after the covers: swap at 109ms, the
  wrong plate visible **250–660ms → 28ms**.
- A fresh visitor never sees it: `DEFAULT_MODE` is daytime, so the markup is
  already right. It only bit *him*, because he has touched the time control.

**Colour and contrast**
- The headline holds **15.81:1 – 20.24:1** across all six skies, measured on
  painted pixels. Measuring computed `color` is useless here: the h1 is authored
  white and inverted by `mix-blend-mode:difference`.
- Pinned white is invisible on five of six skies (1.00–1.07:1); pinned ink is
  invisible on night. **The adaptive `--time-ink` is the only answer that works
  in every state** — a real finding, arrived at by measurement after a
  white-vs-black debate.
- The footer band's luma ladder went from **27 levels to 159** when its tones
  stopped being mixes into a 93%-ink base and became slices of the hour's sky.

**Layout**
- All-text mobile nav needs **356px**; available is 358 at 390 and **288 at 320**.
  It does not fit. That measurement decided all-icons, not taste.
- Hero: 900 → 702 → 650 at 1440; 844 → 570 on a phone.
- Footer band: 227.5 → 114 → **137** at 1440; 83 → 42 → **76** at 390.

**The head**
- Travel: 22 px/s across, 13 px/s down, reversal on a first-order lag so it
  arrives at the wall at zero speed. Bank ±3.2°, **correlation 0.90** with
  velocity. It crosses the headline **48% of the time at 1440, 64% at 390**.
- The mobile bug was **displacement, not resizing**: +5.11px x per swipe,
  accumulating, because `cancel()` restored a pose captured *after*
  `commitTravel()` folded the journey in. Now 0.00 on six of six probes.

---

## 7. Researched practice worth keeping

**Portfolio, 2026 hiring reality** (Muzli, UX Playbook, Opendoors, The Fountain
Institute — searched 2026-08-20):
- Role and specialisation above the fold beats a mission statement. "SF product
  designer. iOS, B2C and design systems." is already right.
- Contact reachable without scrolling.
- **Thumbnails should carry an impact line, not a title.** A recruiter working
  through 40 portfolios gives each **10–15 seconds**. This is why the covers now
  carry one line each — and why every word of them was lifted from his own
  at-a-glance facts rather than invented. **Never fabricate a metric on a
  job-hunting portfolio.** He would have to defend it in an interview.
- A hero that fills the entire first screen spends that 10–15s on atmosphere
  before any work is visible. This is the real argument for the shorter fold.

**Apple's craft reference** (`docs/apple-design.md`, brought in 2026-08-12):
interruptibility above all; rubber-banding as
`(overshoot·dimension·c)/(dimension + c·|overshoot|)`; momentum projection as
`(v/1000)·d/(1−d)`; size-specific tracking and leading. Where it disagrees with
this site's own rules, **section 3 of CLAUDE.md wins** — most sharply on shadow,
where Apple is generous and this site is absolute.

---

## 8. How to verify anything here without fooling yourself

These have each cost real hours. The full list is `CLAUDE.md` §6 and the
`verifying-this-site` skill; these are the ones with the broadest reach.

- **Counting is not looking, and looking is not measuring. You need both.**
- **Timing gates read machine load.** `hero-ascii-field-contract` on identical
  bytes: PASS at load ~5 and 8.64; FAIL at 9.51 (9.2ms), 11.03 (6.6ms), ~13
  (19.1ms). Before optimizing anything a timing gate flags, run it 3+ times with
  `uptime` beside each result. If it tracks load, say so and touch nothing.
- **Bisect before saying "regression."** A throwaway worktree at `origin/main`
  running the same probe settles it in minutes — and it cuts both ways: the same
  technique proved one failure was noise and another was genuinely mine.
- **Headless has no browser chrome**, so `100dvh` and `100svh` are identical
  there. This blind spot has now hidden three separate bugs in the head
  component, including the scroll-resize one he reported for days.
- **Synthetic `dispatchEvent` drags do not behave like real ones** — the handlers
  use `setPointerCapture`. An agent once concluded drag was broken; it was not.
- **A stylesheet that reads correctly is not one that runs correctly.** Read
  `document.styleSheets[…].cssRules` to prove a rule is live. A stray `}` once
  swallowed the entire control base rule.
- **A custom property does not resolve through `getPropertyValue`** — you get the
  token stream, so a `clamp()` returns a string and `parseFloat` gives `NaN`.
  Measure a computed probe.
- **Invalid-at-computed-value-time falls back to `unset`, never to the previous
  declaration.** Only `@supports` keeps a fallback reachable. Ungated viewport
  units once collapsed this hero from 844px to 241.7.
- **A gate must be able to fail.** Several here were found asserting the bug:
  one demanded the `opacity:1` override that caused the CTA blackout; one
  required the head to TRACK the address bar — the exact behaviour he then asked
  to remove. When a gate blocks a fix, work out whether it protects behaviour or
  encodes a decision that changed, and update it with the reasoning in a comment.
- **Never `localhost`** — it resolves to another session's worktree. `127.0.0.1`
  on a port you own, served from the repo root.
- **`hmCompanions` / `hmCompanion` hold ~890 KB of his real baked heads and are
  UNRECOVERABLE.** Snapshot before anything that could write; restore after.

---

## 9. What he is building next, and what it is for

The **workspace** (`~/Desktop/Reshore/lifeline`, shipped built into
`workspace/`) is meant to become the system he runs his life on. His brief, in
his words:

> "I want to build my life in the most beautiful and aesthetic way possible and
> that all starts with a well researched and executed plan that is both fun and
> hardworking… reading(knowledge), communication(skill), athleticism/gym, product
> design, friendships, applying for jobs, acting(skill), modeling. making life
> aesthetic. I have adhd so it's hard for me to have a set schedule i need
> something that works with me… someone that genuinely people want to be a role
> model."

Two constraints he has stated for it:
- **Every tab must have a purpose without an API key**, and the tabs must connect
  to each other rather than being silos.
- **Memory should hold his PROFESSIONAL life** — design inspiration, references,
  work context. Today "everything tells the memory about my personal life."

When designing for that brief: rigid schedules are the thing he has already told
you fails him. Externalised structure, low activation energy, visible progress
and flexible rhythm are the direction — and if a popular productivity claim is
weakly evidenced, say so rather than dressing folk advice up as science. He asked
for "statistically" grounded, and he means it.
