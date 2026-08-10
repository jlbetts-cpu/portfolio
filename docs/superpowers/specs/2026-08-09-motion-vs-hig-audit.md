# The motion ladder against Apple's actual guidance — 2026-08-09

Branch `codex/time-of-day-hero`. **A comparison, not a verdict.**

Jayden asked: *"Did you make sure all the elements use the apple animations in them, like the
rules they set for their animations?"* The honest answer at the time was **no**. The site's
motion ladder — `--dur-press` 100 / `--dur-state` 160 / `--dur-state-out` 240 / `--dur-move`
280 / `--dur-reveal` 360 / `--dur-enter` 500, plus `--ease-out`, `--ease-exit` and four
`linear()` springs — was derived by clustering what the site already did and naming the rungs.
Nobody had checked it against Apple.

This is that check. Every finding is tagged:

| tag | meaning |
|---|---|
| **(a) sourced** | it is written down in an Apple document, with a URL |
| **(b) observed** | Apple's software demonstrably does it; it is not written down |
| **(c) inference** | reasoning from the above, mine, and arguable |

**Several values here were tuned by eye and are load-bearing.** *"Apple does 0.3s"* is not an
argument on its own, and nothing below recommends changing a number purely because Apple's
default differs. Where I think something should change, the reason is a **behaviour** Apple
names, not a duration.

---

## 1. Answers up front

| | |
|---|---|
| **Biggest real gap** | **Reduce Motion stops instead of substituting.** Of **106** `prefers-reduced-motion` blocks across the site, exactly **1** substitutes a non-moving animation for a moving one — and it is the one added on Play this week. This is the one place Apple's guidance is *prescriptive* and the site is *not* following it. |
| **The suspicion in the brief** | **Confirmed.** It was "merely stops", almost everywhere. |
| **Biggest surprise** | **The HIG contains no durations at all.** Zero, across all 112 pages. The ladder cannot be "wrong against Apple's numbers" because Apple has not published any. |
| **A rule we invented** | The ladder's enter/exit asymmetry (160 in / 240 out) is justified in `tokens.css` §6 as a general principle. **Apple does not state it, in either direction.** The one asymmetry Apple *does* document runs on a different axis entirely (damping, not duration) and is keyed to gesture momentum. |
| **Where the site is ahead** | Gesture-tracked, interruptible, one-to-one motion — Apple's most emphasised principle and the site's actual strength. Also: every sustained loop in the frequency band Apple flags is already switched off under Reduce Motion. |
| **A claim we had in a comment** | *"the ~0.2Hz sustained oscillation the HIG singles out"* — **real and citable, but visionOS-scoped.** It was in a code comment implying general UI guidance. That comment has been deleted (it belonged to the canned wobble, which is gone); the scope caveat is recorded in §6. |

---

## 2. Method, and why it matters

**The HIG cannot be read with a plain fetch.** Its pages are JS-rendered; a `curl` returns the
`<title>` and nothing else. This is very likely why nobody had done this check. The pages are
served as DocC JSON at
`developer.apple.com/tutorials/data/design/human-interface-guidelines/<slug>.json`, and **all
112 pages** were pulled that way and grepped as a corpus. So the "not found in the HIG" claims
below are **full-corpus negatives, not spot checks** — which is the only kind of negative worth
writing down.

WWDC transcripts were pulled as raw HTML and quotes verified by grep against the transcript
rather than through a summariser.

Site-side numbers were counted mechanically over the working tree (`*.css`, `*.html`, `*.js`),
excluding `index-local-preview.html` as a duplicate of `index.html`.

---

## 3. Durations — there is nothing to conform to

**(a) sourced.** The HIG publishes **no** animation durations, ranges, or easing curves. A grep
of all 112 pages for `milliseconds`, `duration`, `ease`, `easing`, `spring`, `dissolve`,
`crossfade` returns nothing about timing. The only two numbers near motion in the entire HIG
are `30 to 60 fps` (games) and `0.2 Hz` (visionOS — §6). The vocabulary is qualitative:

> "Aim for brevity and precision in feedback animations… brief and precise, it tends to feel
> lightweight and unobtrusive."
> — <https://developer.apple.com/design/human-interface-guidelines/motion>

**The word "spring" does not appear anywhere in the HIG.** Neither does "bezier".

**(a) sourced.** Numbers exist, but only as API defaults:

| value | what it is | source |
|---|---|---|
| **0.55s**, damping 1.0 | `Animation.default` — **a spring**, iOS 17+ (was `.easeInOut` before) | [swiftui/animation/default](https://developer.apple.com/documentation/swiftui/animation/default) |
| **0.5s**, bounce 0 / 0.15 / 0.3 | `.smooth` / `.snappy` / `.bouncy` | SwiftUI `Animation` docs |
| **0.15s**, blend 0.25 | `.interactiveSpring` | SwiftUI |
| **0.2s** | `UIView.setAnimationDuration` default (deprecated) | UIKit |
| **0.25s** | Core Animation implicit transaction | Core Animation Programming Guide |

**(a) sourced, and it changes what "duration" means.** SwiftUI's spring `duration` is *not*
wall-clock: *"The perceptual duration, which defines the pace of the spring. This is
approximately equal to the settling duration, but for very bouncy springs, will be the duration
of the period of oscillation."* WWDC18/803 goes further — Apple avoids the word on purpose:

> "you might notice that I haven't used the word duration. We actually like to avoid using
> duration when we're describing elastic behaviors, because it reinforces this concept of
> constant dynamic change. The spring is always moving, and it's ready to move somewhere else."

### What this does to the ladder

**(c) inference.** The ladder is **not in conflict with Apple**, and it cannot be brought into
conformance with Apple's numbers because there are none. Its six rungs (100–500ms) sit inside
the band Apple's own defaults occupy (200–550ms), which is a coincidence worth noting and not
evidence of anything.

The ladder's real justification is unchanged and is a *good* one: it is derived from what the
site converged on, and its value is **consistency**, which Apple does endorse qualitatively.
**No rung should be changed on the strength of this section.**

The one honest criticism is of the ladder's *coverage*, not its values. Counted over the
working tree there are **256 literal transition/animation times in 56 distinct values**, and
only 28% of those literals land on a named rung. `token-audit.py` reports the same shape from
the other direction (409 untokenised occurrences, `STATUS=PASS` because the budget tolerates
them). Most of the residue is choreography — the party, the disco ball, the photo rain — which
`tokens.css` §6 already exempts by name. That exemption is sound; the residue is not evidence
of a problem.

---

## 4. Springs — the one place Apple has genuinely moved and the site has not

**(a) sourced.** SwiftUI's **default animation is now a spring**. WWDC23/10158, verbatim:

> "Because springs are such a great tool for animations, we now use them as the default
> animation in SwiftUI, so all you need to do is call withAnimation to start with a spring."

**(a) sourced — and the reason is interruption, not taste.** Same session:

> "With an ease in and out animation, it does animate to the end, but its motion jerks to a halt
> as the gesture ends. This type of animation is just a prespecified curve, so there's no way to
> represent an initial velocity… A spring can start with any initial velocity, so we get a
> natural feeling where our animation picks up right where the gesture ends."

And on retargeting mid-flight: *"a spring animation uses the velocity it had when it was
retargeted as the initial velocity towards its new destination."*

**(a) sourced — eased curves are still fine from rest.** *"So far, ease in and out and spring
animations are our best options, but we've only been looking at cases where the animations start
from a resting position."* Linear is the one called out negatively.

### Where the site actually uses springs

Counted as `var(--sp-*)` references:

| file | springs | `--ease-out` |
|---|---:|---:|
| **index.html** | **0** | **102** |
| about.html | 0 | 14 |
| header.css | 0 | 29 |
| site-theme.css | 0 | 12 |
| footer.css | 0 | 3 |
| play.css | 1 | 43 |
| play.html | 3 | 14 |
| hero-time.css | 1 | 4 |
| controls.css | 4 | 12 |
| tournament.css | 4 | 8 |
| *specimen.html* | *21* | — |
| *header-prototype.html* | *14* | — |

**(c) inference — and this is the finding.** The two files with the most spring usage are the
**specimen and a prototype**: pages that demonstrate the system rather than ship it. The home
page — the most-seen page on the site — uses `--ease-out` 102 times and a spring **zero** times.
So the answer to *"are springs used where Apple uses them, or only decoratively?"* is closer to
**"they are mostly used in the shop window."**

**But the gap is narrower than that table suggests, and this matters.** Apple's argument for
springs is specifically about **gesture-driven and interruptible** motion. Most of index.html's
102 eased transitions are hover, focus and reveal — motion that starts from rest, which is
exactly the case Apple says eased curves still handle. The site's genuinely gesture-driven
motion is not written in CSS transitions at all: the head drag, the head float, the word drag
and the new wobble are **JS, per-frame, and already velocity-driven**, which is the *substance*
of what a spring buys you. The site got there by a different route.

**(c) inference — where a spring would actually earn its place.** The candidates are the places
where a gesture *ends* and a CSS transition takes over, because that is the exact seam Apple
describes as jerking to a halt:

1. **`hero-head-transform.js`'s drag release.** The head is dragged, scaled and rotated with a
   pointer, and when released it settles on whatever the stylesheet says. This is the site's
   single best spring candidate and is outside my lane — noted, not touched.
2. **The Play word's drop.** ✅ **Already done this week**, and by Apple's rule rather than by
   coincidence — see §8.

**Not a candidate:** the About dissolve (680/1000/1200) and the sky cross-fade (640). Neither is
gesture-driven; both start from rest; both are cross-fades where a spring's overshoot would be
meaningless on `opacity`. Apple's own Reduce Motion guidance *names* the dissolve as a desirable
form. **Leave them.**

---

## 5. Enter/exit asymmetry — we asserted a rule Apple does not state

`tokens.css` §6 says:

> `--dur-state-out  240   the same change letting go. 160 x 1.5 — a control answers immediately
> and releases gently; equal timings read mechanical`

**(a) sourced — NOT FOUND.** No Apple source states that entering and exiting animations should
have different durations, in either direction. The HIG says nothing. This is a **full-corpus
negative.**

**(a) sourced — and WWDC18/803 argues the opposite axis:**

> "maintain spatial consistency throughout movement… things smoothly leave and enter our
> perception in symmetric paths. So, if something disappears one way, we expect it to emerge from
> where it came."

with the asymmetric case criticised directly: *"where when I tap on something, it slides in, and
then when I hit back it goes down. And, it feels disconnected and confusing."* Note that this is
about **path**, not **speed** — the site's 160/240 is not what Apple is objecting to.

**(a) sourced — the asymmetry Apple *does* document is damping, and it is keyed to momentum:**

> "if the gesture that's driving the motion itself has momentum, then you should reward that
> momentum with a little bit of overshoot… if a gesture has momentum, and there isn't any
> overshoot, it can often feel broken or unsatisfying."

with the Music-app case: 100% damping presenting Now Playing by tap (no momentum in that
direction), **80% damping** dismissing it by swipe (momentum in the direction of travel).

**(c) inference — what to do: nothing to the numbers.**

- The 160/240 pair governs **hover in / hover out on a control**. Slower-out on hover is a
  hover-intent convention with its own justification (it stops a cursor sweeping a bar from
  strobing), and `tokens.css` records that *"the animation was too abrupt"* is a note this site
  has already had twice. **Real user feedback outranks an absent guideline.**
- What must change is the **comment, not the value**. §6 currently reads as though it is stating
  a general law. It is stating a house preference backed by two rounds of feedback. That is a
  perfectly good reason; it is just a different kind of reason, and the file should say which.
  → **Patch P1 below** (`tokens.css`, not my lane).
- The genuinely actionable half is the momentum rule, which is about **overshoot on
  gesture-released motion** — §8.

---

## 6. Vestibular safety — the 0.2 Hz claim, and how the site actually does

### The claim

A code comment (now deleted with the canned wobble it justified) said the wobble's 2Hz period
was *"deliberately nowhere near the ~0.2Hz sustained oscillation the HIG singles out as the
frequency people are most sensitive to."*

**(a) sourced — the claim is REAL and citable.** HIG Motion page, verbatim:

> "**Avoid showing objects that oscillate in a sustained way.** In particular, you want to avoid
> showing an oscillation that has a frequency of around 0.2 Hz because people can be very
> sensitive to this frequency."

Corroborated by WWDC23/10078 (Apple Vision Science), which glosses it usefully: *"That is one
oscillation per 5 seconds."*

**(a) sourced — and the caveat that was missing.** It sits under **Platform considerations →
visionOS**. The same page says *"No additional considerations for iOS, iPadOS, macOS, or
tvOS."* It is a head-mounted-display comfort finding, not general 2D UI guidance.

**(a) sourced — but the "2D is safe" defence is explicitly rejected by Apple elsewhere.** App
Store Connect's Reduced Motion criteria: *"Although motion sickness is commonly discussed in the
context of augmented and virtual reality, motion can cause reactions in 2D screens as well for
users with severe motion-sensitivity conditions."*

**(c) inference.** Applying the 0.2 Hz figure to a web hero is defensible as a **reasoned
extension**, not as an HIG mandate. It should never again be written in a comment as though the
HIG said it about screens. Practical bite: a 5-second ambient loop — a breathing gradient, a
drifting blob — sits **exactly** on the flagged frequency, and 5s is a very natural number to
pick for an ambient loop.

### What the site actually does

Counted over `*.css` + `*.html`: **35 infinite animations** with a resolvable period. Three land
in the 0.15–0.28 Hz band:

| period | Hz | selector |
|---:|---:|---|
| 6000ms | 0.17 | `.partyLights` (index + play) |
| 4200ms | 0.24 | `.fpDot::after` (index) |

**All three are already switched off under `prefers-reduced-motion`**, as are `.hmEyeT i` (7s,
0.14 Hz), `.joyEye`, `.camDot` and `.scrollCue`. **This is a pass, and a non-obvious one** —
whoever wrote those blocks was covering the right elements without, as far as I can tell, having
the frequency argument to hand.

Two footnotes: `.partyLights` only exists during the party performance, which is user-triggered
and short; and `.fpDot` belongs to the retired Identity mood (`WORD_STYLE` no longer lists it),
so it is dead CSS — worth deleting for tidiness, not for safety.

**(a) sourced — the other named triggers**, all from App Store Connect's criteria and the WebKit
"Responsive Design for Motion" post (James Craig, Apple accessibility): scaling/zooming,
spinning and vortex effects, multi-speed or multi-directional movement (parallax), plane
shifting / 2.5D, peripheral motion, **animated blur** and depth-of-field, and auto-advancing
carousels.

**Animated blur is the one trigger on Apple's list the site uses**, in `cycIn`/`cycOut`
(`filter: blur(6px)` on the headline characters). Two things about it, and the second is a
correction I owe this document:

- On **`play.html` it is live and now substituted for** — the reduce fork runs a pure opacity
  dissolve, no blur and no translate.
- On **`index.html` the same keyframes exist and never run.** The cycling word is retired from
  the home page: there is no `.cycw` in the markup, no mount point in `hero-engine.js`, and
  `makeCycWord()` survives only inside `if(cycWord)` guards that are never true. `cycIn`,
  `cycOut`, their reduce fork and `.fpDot`'s 4.2s loop are all **dead CSS**. I nearly filed a
  patch against it. Recorded because a motion audit that counts dead rules and reports them as
  exposure is measuring the file, not the site — the same failure as counting hidden
  reflections in the visual sweep (`2026-08-09-visual-qa-sweep.md` §5.2).

**(a) sourced — a useful exemption.** WebKit: *"It's okay to keep many real-time,
user-controlled direct manipulation effects such as pinch-to-zoom. As long as the interaction is
predictable and understandable."* This is why the head's drag/scale/rotate does not need a
Reduce Motion fork, and why the new drag wobble does not either.

---

## 7. Reduce Motion — the real gap

**This is the section that matters.** The brief's suspicion was right.

**(a) sourced — Apple's most prescriptive statement on the subject**, App Store Connect,
*Reduced Motion evaluation criteria*:

> "Removing animations entirely can have a negative effect on usability and understandability.
> If the motion itself conveys some meaning, such as a status change (for example, item moved to
> cart) or a hierarchical context transition (for example, this view is a subview of the prior
> view), **don't remove the animation entirely. Instead, consider providing a new animation that
> avoids motion, or at least reduces full screen motion, such as a dissolve, highlight fade, or
> color shift.**"

Same page, the other half of the rule: *"Is the animation included purely for stylistic or
decorative effect? If so, consider stopping it entirely."*

**(a) sourced — the HIG's version**, Accessibility page (the **only** one of 112 HIG pages that
mentions Reduce Motion at all — the Motion page never does):

> "- Tightening animation springs to reduce bounce effects
> - Tracking animations directly with people's gestures
> - Avoiding animating depth changes in z-axis layers
> - **Replacing transitions in x-, y-, and z-axes with fades to avoid motion**
> - Avoiding animating into and out of blurs"

**(a) sourced — the system does it itself.** <https://support.apple.com/en-us/111781>: *"Screen
transitions and effects use the dissolve effect instead of zoom or slide effects."*

**(a) sourced — WebKit says the same to web authors:** *"If your site uses a vestibular trigger
animation to convey some essential meaning to the user, removing the animation entirely may make
the interface confusing or unusable… consider serving an alternate, simpler animation, or
display another visual indicator to convey the intended meaning."*

### What the site does

Mechanical count of every `@media (prefers-reduced-motion)` block, excluding
`index-local-preview.html`:

| | count |
|---|---:|
| **total blocks** | **106** |
| stop only (`animation:none` / `transition:none`, no replacement) | 61 |
| **substitute a non-moving animation** | **1** |
| shorten a duration to 0/1ms | 8 |
| hide an element outright | 11 |
| other (`opacity:1!important` end-state pinning, `scroll-behavior:auto`, etc.) | 25 |

Raw declaration counts across the same files: `animation:none` **39**, `animation:none!important`
**12**, `transition:none` **22**, `display:none` **11**, `opacity:1!important` **10**.

**The single substitution is the one added on Play this week** (`cycDissolveIn` /
`cycDissolveOut` for the cycling mood word, plus the drawn drop-zone ring in `play.css`).

### But the 61 are not all wrong, and the audit must say so

**(c) inference, and this is the part that stops this being a scare number.** Apple's rule has
two branches, and *"stop it entirely"* is the correct branch for decorative motion. Checking the
`display:none` cases by hand:

- `.emerge` (all five case studies) is a **full-screen white curtain that fades away on load**.
  Hiding it under reduce loses no content — the page is simply already there. This is not a
  deletion, it is jumping to the end state, and it is right.
- `.partyLights`, `.beamSpin`, `.partyHaze`, `.dbGlints`, `.dbSweep`, `.loveHeart`,
  `.csCursor`, `.introLoad`, `.loadPct` — all decorative performance and chrome. **Stop is the
  correct branch.**

Likewise the ~25 `opacity:1!important` / `transform:none` blocks are **scroll-reveal end-state
pinning**: the content is present and readable, it just does not fly in. Apple's rule is about
motion that *carries information between states*; a reveal-on-scroll carries none — the content
is the information and it is still there.

**So the honest verdict is narrower than 1-in-106, and sharper for it.** The failures are the
places where **motion was the only carrier of a state change** and reduce deleted it:

1. **The Play mood word used to stop cycling entirely** under reduce, resting on whichever mood
   it booted with. The four moods are the page's only passive announcement that the moods exist.
   **This was a real information loss and is now fixed** (dissolve substitution, cycle keeps
   running).
2. **The head's drop-target cue.** The lean is a transform; under reduce it would have vanished,
   leaving the affordance with **no signal at all**. **Fixed** — a drawn hairline ellipse at the
   real hit-test geometry, cross-faded on opacity, which is arguably *more* informative than the
   lean (it says "from anywhere inside here").
3. **`cycIn`/`cycOut`'s animated blur** — the one item on Apple's named-trigger list the site
   uses. Now substituted on Play. **Not** an issue on `index.html`: those rules are dead there
   (§6). No patch.
4. **Not yet checked page by page:** every other `animation:none` where the animation was a
   *status change*. 61 is too many to hand-audit inside this task honestly, so I am recording
   the method rather than claiming the result: for each, ask *"if this never plays, does the
   visitor still learn the thing it was telling them?"* If yes, `none` is correct. If no, it
   needs a dissolve.

**(c) inference — the one systemic recommendation in this document.** The site has no shared
substitution primitive, which is why substituting is a per-site-of-use decision that nobody
makes. A pair of keyframes in `tokens.css` — a dissolve in and a dissolve out, at
`--dur-state` — would make the correct thing the cheap thing. → **Patch P3.**

---

## 8. Drop targets, and the two things built this week

### The head's lean

**(a) sourced — Apple's drop-target guidance**, HIG Drag and Drop, "Providing feedback":

> "**Show people whether a destination can accept dragged content.** For example, you might
> display an insertion point or highlight a containing view only when the destination can accept
> a dragged item… **Display highlighting or other visual cues only while the content is
> positioned above the destination, removing the visual feedback when people drag the content
> away.**"

**(a) sourced — NOT FOUND: Apple never names *lift* or *scale* as a drop-target affordance.**
It names **highlight** and **insertion point**. Scale-up appears in that document only for the
*failed* drag item (*"scale up and fade out to give the impression of the item evaporating"*),
and translucency only for the drag image.

**(c) inference — so the lean is not Apple's named form, but it satisfies Apple's stated
contract exactly**, and that is the part that is testable:

| Apple's requirement | the lean |
|---|---|
| show whether the destination accepts the payload | ✅ `.catchReady` scales `#stageMorph` 1.055 |
| **only** while the content is over the destination | ✅ verified: arms over the head, clears on leaving, clears on drop, clears on `pointercancel`/`lostpointercapture` |
| remove the feedback when dragged away | ✅ verified in a real drag |

I would not change it to a highlight. A highlight is a chrome idiom, and this site's memory is
explicit that chrome separates with hairlines and translucency rather than elevation, while the
**heads are photographs that stand on something**. A photographic cut-out coming forward is this
site's own physical language for the same message, and Apple's guidance is a requirement about
*what must be communicated and when*, not a mandated visual form. **Recorded as a deliberate
divergence, not an oversight.**

### The wobble and its settle — where Apple's rule was actually load-bearing

**(a) sourced.** WWDC18/803 on overshoot: *"if the gesture that's driving the motion itself has
momentum, then you should reward that momentum with a little bit of overshoot… if a gesture has
momentum, and there isn't any overshoot, it can often feel broken or unsatisfying."*

The dragged word is released with momentum. The settle now uses `--sp-bounce` (overshoots to
1.1065) rather than `--sp-pop` (1.0151) — measured on the real page, a letter left at −13.3°
crosses to **+1.39° at 360ms** and is at rest by 900ms. **This is Apple's rule applied, and it is
the reason `--sp-bounce` was chosen over `--sp-pop`** — pop's overshoot on a 13° rotation is
0.18°, which cannot be seen.

**(a) sourced.** One-to-one gesture tracking, WWDC18/803: *"touch and content should move
together… the moment the touch and content stop tracking one-to-one, we immediately notice
it."* The wobble that was in the tree before this week was a `@keyframes … infinite` loop that
ran identically whether you flung the word or held it still. **By Apple's framing that is not a
slightly-worse wobble, it is the wrong category of thing.** It has been replaced with the
velocity-driven original from `hero-engine.js`.

**(a) sourced — and it improves the accessibility position too.** The HIG lists *"Tracking
animations directly with people's gestures"* as a **Reduce Motion best practice**. The canned
loop was free-running repetitive motion (the risky kind); the replacement is gesture-tracked
(the kind Apple names as safer). The change was made for feel and turned out to be the safer
choice as well.

---

## 9. Where motion should exist and does not

**(a) sourced — the HIG's positive case:** *"Beautiful, fluid motions bring the interface to
life, conveying status, providing feedback and instruction."* And: *"Strive for realistic
feedback motion that follows people's gestures and expectations."*

**(c) inference — candidates on this site**, in the order I would take them:

1. **Cross-page navigation has no transition at all.** This is a multi-page site; Work → About →
   Play → a case study is a hard document swap. Apple's continuity argument (WWDC24/10145: the
   zoom transition *"keeps the same UI elements on screen across the transition"*) is exactly
   about this. The View Transitions API would do it. **Biggest available win, and the largest
   piece of work in this document** — filed as an idea, not a recommendation, because it touches
   every page.
2. **Rank and bracket changes in the tournament and the marble-race leaderboard.** Rows change
   order and the new order simply *is*. This is the textbook case App Store Connect names —
   *"a status change (for example, item moved to cart)"* — motion carrying information, absent.
3. **The head's release from a drag** (§4). Gesture ends, CSS takes over, no velocity carried.

**(a) sourced — the constraints, which cut the other way and are worth quoting because they
protect what is already there:**

> "Don't add motion for the sake of adding motion. Gratuitous or excessive animation can distract
> people…"
> "In apps, generally avoid adding motion to UI interactions that occur frequently."
> "Let people cancel motion. As much as possible, don't make people wait for an animation to
> complete before they can do anything, especially if they have to experience the animation more
> than once."

**(c) inference.** That last one is the strongest argument *for* the site's existing choices and
*against* over-applying this section. The mood word's 8.5s cycle, the head's float and the
time-of-day sky are all ambient and none of them blocks anything. And it is a direct argument
against ever restoring the tug hint that was deleted — motion on a frequent interaction, that
the visitor must sit through repeatedly, is the case Apple names.

---

## 10. Scoreboard

| dimension | Apple | this site | verdict |
|---|---|---|---|
| **Published durations** | none in the HIG; defaults 0.2–0.55s | 6 rungs, 100–500ms | **No conflict.** Cannot conform to numbers that do not exist. Ladder's value is consistency, which Apple does endorse. |
| **Springs for gesture-released motion** | (a) yes, explicitly, since SwiftUI's default became a spring | eased curves almost everywhere; springs mostly in the specimen | **Gap, narrowed.** The site's gesture motion is JS and already velocity-driven; the seam is where a gesture ends and a CSS transition starts. |
| **Enter/exit asymmetry** | **not found** — the documented asymmetry is *damping*, keyed to momentum | 160 in / 240 out, justified as a principle | **We over-claimed.** Keep the numbers (real feedback backs them); fix the comment. |
| **Overshoot rewards momentum** | (a) yes, WWDC18/803 | `--sp-bounce` on the word's drop ✅; head release ❌ | **Half done this week.** |
| **Reduce Motion substitutes, not deletes** | (a) yes, most prescriptive statement Apple makes about motion | 1 substitution in 106 blocks | **The real gap.** Narrower than 1-in-106 once decorative stops are excluded — but real, and Apple is unambiguous. |
| **Vestibular trigger loops** | (a) 0.2 Hz (visionOS), scaling, spinning, parallax, blur, peripheral | every loop in the band is off under reduce | **Pass**, and better than expected. Animated blur is the one live trigger. |
| **Drop-target feedback** | (a) show only while over the target, remove on leave | ✅ verified in a real drag | **Pass on the contract**, deliberate divergence on the form. |
| **One-to-one gesture tracking** | (a) Apple's most emphasised principle | head drag, word drag, and now the wobble | **The site's genuine strength.** |
| **Continuity across transitions** | (a) yes | none between pages | **Absent.** |

---

## 11. Patches for files outside this task's lane

Not applied. Each is small and each has a reason above.

**P1 — `tokens.css` §6: stop stating a rule Apple does not have.** The ladder text reads as a
general law. Replace the justification, keep both numbers.

```diff
-      --dur-state-out  240   the same change letting go. 160 x 1.5 -- a control
-                             answers immediately and releases gently; equal
-                             timings read mechanical, and "the animation was too
-                             abrupt" is a note this site has already had twice.
+      --dur-state-out  240   the same change letting go. 160 x 1.5 -- a control
+                             answers immediately and releases gently.
+                             THIS IS A HOUSE PREFERENCE WITH EVIDENCE, NOT A LAW.
+                             "The animation was too abrupt" is a note this site
+                             has had twice, which is the whole argument and a
+                             good one. It is recorded here because the 2026-08-09
+                             HIG audit checked: Apple states NO enter/exit
+                             duration asymmetry, in either direction, across all
+                             112 HIG pages. The asymmetry Apple DOES document is
+                             damping, not duration, and it is keyed to whether
+                             the gesture carried momentum (WWDC18/803: 100%
+                             damping presenting by tap, 80% dismissing by swipe).
+                             That rule is real and applies to gesture-released
+                             motion -- see --sp-bounce -- but it is not this one.
```

**P2 — withdrawn.** It was going to port Play's dissolve substitution to `index.html`'s
`cycIn`/`cycOut`. Checking before writing it showed those rules never run — the home page's
cycling word is retired (§6). Left in the numbering so the withdrawal is on the record.

**P3 — `tokens.css`: give the site a substitution primitive.** The reason 105 of 106 blocks stop
rather than substitute is that substituting means hand-writing a keyframe pair each time.

```css
/* THE REDUCE-MOTION SUBSTITUTE. Apple's Reduced Motion criteria are explicit that motion
   carrying MEANING must not be deleted, only replaced with something that does not move --
   "a dissolve, highlight fade, or color shift" -- while purely decorative motion should be
   stopped outright. This is the dissolve, so that following the rule costs one class name.
   Use it wherever `animation:none` would have destroyed information; keep `animation:none`
   where the motion was decoration. */
@keyframes sub-dissolve-in{from{opacity:0}to{opacity:1}}
@keyframes sub-dissolve-out{from{opacity:1}to{opacity:0}}
```

**P4 — `index.html` line 149: `body.catchReady #stageMorph`** transitions both directions at
160ms and therefore snaps back. Play now uses `--dur-state` in / `--dur-state-out` out. Aligning
them makes the head answer a drag identically on both pages.

**P5 — cosmetic:** `.fpDot` and its `fpFill`/`fpFade` keyframes in `index.html` belong to the
retired Identity mood (`WORD_STYLE` no longer lists it). Dead CSS carrying a 4.2s infinite
animation.

---

## 12. Primary sources

- HIG **Motion** — <https://developer.apple.com/design/human-interface-guidelines/motion>
- HIG **Accessibility** — <https://developer.apple.com/design/human-interface-guidelines/accessibility>
- HIG **Drag and Drop** — <https://developer.apple.com/design/human-interface-guidelines/drag-and-drop>
- App Store Connect, **Reduced Motion evaluation criteria** —
  <https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria/>
  *(the most prescriptive Apple text on motion accessibility, and not part of the HIG)*
- **WWDC18/803**, Designing Fluid Interfaces — <https://developer.apple.com/videos/play/wwdc2018/803/>
- **WWDC23/10158**, Animate with springs — <https://developer.apple.com/videos/play/wwdc2023/10158/>
- **WWDC23/10078**, Design considerations for vision and motion — <https://developer.apple.com/videos/play/wwdc2023/10078/>
- **WWDC24/10145**, Enhance your UI animations and transitions — <https://developer.apple.com/videos/play/wwdc2024/10145/>
- WebKit, **Responsive Design for Motion** — <https://webkit.org/blog/7551/responsive-design-for-motion/>
- Apple Support **111781** (Reduce Motion behaviour) — <https://support.apple.com/en-us/111781>
- SwiftUI `Animation` — `default`, `smooth`, `snappy`, `bouncy`, `interactiveSpring`
- `EnvironmentValues.accessibilityReduceMotion` — *"UI should avoid large animations"*
