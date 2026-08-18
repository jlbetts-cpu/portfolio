# Working on this site

Read this before changing anything. It is written for any agent — Claude, Codex,
or a future session of either — so that two of us do not undo each other's work.
Jayden is one person with one site; we are interchangeable to him and should
behave that way.

Everything below is a decision he has already made, usually more than once, or a
trap that has cost real hours. None of it is preference. If you are about to do
something this file forbids, you are almost certainly repeating a mistake.

---

## 1. The three rules that override everything

**Premium is subtraction.** His most repeated instruction. When a screen feels
wrong the answer is more often "remove something" than "add something". Features
fixed by deletion after tuning failed: a backdrop flood behind the hero portrait,
the portrait's ground shadow, a full-screen poster wipe he called "a glitch", a
card wrapped round a phone mockup, and a pill around seven dots.

**Counting is not looking.** Measure, then LOOK at the result. A card that
measured "fits viewport: true" and "caption inside: true" was, on screen,
horrendous — he said so in those words. Every claim about appearance needs a
screenshot you actually opened.

**A request is a start signal.** If he asks for something, begin it in the same
turn. "I cannot reproduce it" is a status, never an endpoint — he skims, and a
careful paragraph explaining a deferral reads exactly like one explaining a fix.
Put anything NOT done first in your reply, in its own line.

---

## 2. What this site is

A portfolio for a product designer job-hunting in the SF Bay Area. Vanilla ES5,
no build step, shared external CSS and JS. Pages: `index.html` (home, the
time-of-day hero and the draggable portrait), `about.html`, five case studies
(`apollo`, `bearings`, `cluster`, `strata`, `ucdavis`), `play.html` (the games),
`headmaker.html` (cut a photo into a character), `gradientlab.html`.

The games are not a toy on the side. They are the strongest evidence in his
portfolio that he designs AND builds, and they are what a games-UI employer would
look at first.

---

## 3. The design system, in short

- **Instrument Sans, two weights only: 400 and 600.** He rejected a typeface
  change explicitly. Leading and tracking are the levers.
- **Radius by size class**: `--r-xl` 28 for the biggest surfaces, `--r-lg` 20 for
  cards and images, `--r-md` 14 for controls. Something that becomes the
  *environment* leaves the ladder rather than taking a compromise rung.
- **Spacing on a 4px grid** (`--sp-*`).
- **`--accent` is ink `#121212` site-wide. Blue is dead. Never rebind `--accent`
  locally** — it once meant two different colours in two files.
- **44px minimum targets, measured not declared.** One sanctioned exception:
  inline prose links, because the line pitch is 25.5px.
- **Motion ladder**: `--dur-press` 100 · `--dur-state` 160 · `--dur-state-out` 240
  · `--dur-move` 280 · `--dur-reveal` 360 · `--dur-enter` 500. Use the rungs.
  **But some values are hand-tuned and load-bearing and must NOT be flattened**:
  the About dissolve's 680/1000/1200, the spring `linear()` curves, the sky's
  640ms cross-fade.
- **Controls come from `controls.css`.** `.ctl` plus a variant. Do not rebuild a
  button privately and do not patch one toward the system property by property —
  that is how `.reelTap` ended up with four separate rules bolting on the radius,
  the tap floor and box-sizing while its ground stayed two raw ramp values.

### Shadows — this one is absolute

**The companion heads cast contact shadows. Nothing else does.** The shadow is
*information*: it says the head is standing on something. Chrome separates with
**hairlines and translucency**, never elevation.

Corollaries that have each come up: a head that is not standing on anything gets
no shadow (the hero portrait, and every racer in the marble race, which is in
free fall). A photograph of objects in a scene may contain shadows — that is a
picture, not chrome.

---


## 3.5 The Apple design reference

`docs/apple-design.md` is the craft reference Jayden brought in on 2026-08-12 to
polish this site against. Read it before touching anything gesture-driven,
anything that animates, translucent chrome, or type.

It is reasoning, not a stylesheet to copy, and **section 3 of this file wins
wherever they disagree.** Two specific collisions to be clear about:

- It advises defaulting to the system font. This site uses Instrument Sans at two
  weights and that is settled. Its advice on SIZE-SPECIFIC tracking and leading
  does apply.
- It is generous with translucent material and shadow. The shadow rule here is
  absolute: the companion heads cast a contact shadow, nothing else does.

Where it agrees with what already ships, do not "fix" it: the spring `linear()`
curves (`--sp-bounce` / `--sp-pop` / `--sp-settle`), the duration ladder, press
feedback on `:active`, and the reduced-motion handling are all already the thing
it describes.


## 4. Decisions he has settled — do not reopen

- **The case-study covers stay.** They are a deliberate series: different
  photographs, palettes matched to each product's UI, and **12 time-of-day
  variants each** that swap with the site's clock. An audit called them "the same
  stock meadow"; it was wrong and he pushed back.
- **The Featured / Case Studies split stays.** Featured is a strict subset. He
  knows, and chose it: "Leave it, I like the split."
- **The case-study prose runs the full column.** A measure of 680px was added on
  an audit's finding and he reverted it: "I never asked you to change it back to
  squished to the left." Do not re-apply a measure without asking.
- **The Play menu's coloured dots and current-players grid** are evidence-backed
  and load-bearing. Small tweaks only.
- **The hero h1 on `index.html` is his alone.** Do not restyle it without asking.
- **The mini-Jayden head is 1.5x bigger than the others on purpose.** He likes it.
  Its collision radius in the marble race is NOT scaled — that is deliberate.

---

## 5. The games

### Soccer — the chaos is the point

**Never make the match calmer, tidier or better-spaced.** He has rejected
separation steering, roles and zones three times. Clumping is not a defect.

The one thing worth removing is **chaos that STOPS the match** — a wedge, a
deadlock, jitter that reads as a bug. Measured: the goalmouth pile clears in
under a second every time (worst 0.8s, 2% of play), so it is not a wedge and was
left alone.

The keeper's leash is `min(ballX/3, 0.11·W)` and saturates 71% of frames. **Do
not lengthen it.** Measured at 0.20: goals 3.0 → 1.7 and the bundling gets 6x
more common and 3.5x longer. The short leash is what keeps the goalmouth busy.

What he does want is **verticality** — airborne ball, flips, unpredictable
bounces. One sanctioned exception to the no-tactics rule: one egghead per team may
hold forward, and it is never a named head.

### The marble race

- **Fairness means every lane meets a comparable NUMBER of obstacles, not that
  they finish in comparable positions.** Watch `SPREAD` (3.33 now; 3.45 is pure
  randomness) and `|RHO|` (0.005). If either moves toward order, you have broken
  it.
- **Density and lead changes pull against each other** — obstacles spread a
  field. Measured. Chokes and funnels are the mechanism that gets both.
- **REACH, not COVER.** Cover measures area near an obstacle and never asks
  whether a racer goes there; it reported 51% as a win while half the course was
  dead. Reach is 73%.
- Known unfixed: a head resting 54px above a sliding gate, 874px from the line,
  `nud=0`. Two hypotheses already disproved — widening the funnel throat, and
  switching anti-stuck from displacement to +y.

### The tournament

- Field is **derived from the roster**: 8 or fewer heads → 8-team cup, more → 12
  with a play-in. He rejected a picker.
- Match lengths are the engine's: **first to 5 in the final, 4 one round out, 3
  elsewhere.** The UI reads the engine and must agree with it.
- **Simulate runs the real match**, clock-cranked with drawing skipped. Never a
  dice roll — he uses the result to settle a real fantasy draft order.
- The race **seeds** the cup; `check()` asserts seeds 1 and 2 can only meet in the
  final. Eliminated rows freeze; survivors keep moving.
- The poster wipe is CANCELLED. He called it "a glitch". The final's poster is a
  still picture and must never animate or reach a semi-final.

---

## 6. Traps that have each cost hours

**Serving.** Never `localhost` — it resolves to a different session's git
worktree. Use `127.0.0.1` on a port you own, served from the repo root or
`images/` 404s. Port 4187 belongs to another session. Kill only your own
processes **by PID** — a pattern kill once took out someone else's server.
`treatment-contract.py` needs `--port 4762`.

**Gates must run SERIALLY.** They each bind a fixed port; in parallel they
collide and invent failures. `timeout` does not exist on macOS — using it turns
25 gates into command-not-founds that look like regressions.

**The browser pane renders `index.html` at the wrong scale** because of its ink
filters. Screenshots there are unusable; measure computed values, or use
Playwright and prove fidelity by stamping a rect at independently-measured
coordinates and reading the PNG back.

**Synthetic `dispatchEvent` drags do not behave like real ones.** The transform
handlers use `setPointerCapture`. An agent once concluded drag was broken; it was
not. Drive real input.

**Headless has no browser chrome.** `100dvh` and `100svh` are identical there, so
anything that depends on a URL bar retracting is invisible. This blind spot hid
three real bugs: the `svh` cliff, the head drift, and the head resize.

**A custom property does not resolve through `getPropertyValue`** — you get the
specified token stream, so a `clamp()` comes back as a string and `parseFloat`
gives `NaN`. Measure a computed probe instead.

**Invalid-at-computed-value-time falls back to `unset`, never to the previous
declaration.** A second declaration cannot rescue a `var()` the way it can a real
property; only `@supports` keeps a fallback reachable.

**A stylesheet that reads correctly is not one that runs correctly.** A stray `}`
once swallowed the site's entire control base rule. Deleting half a selector list
leaves a dangling comma that eats the next rule. Read
`document.styleSheets[...].cssRules` to prove a rule is live.

**`controls.css` links AFTER `index.html`'s inline styles**, so an equal-specificity
rule there always wins. Fix things where they live.

---

## 7. The gates

30 of them in `tools/`. All green as of this file. Run serially. The important
property is that **a gate must be able to fail** — several here have been found
asserting the bug rather than the behaviour:

- one demanded a dark rule for a class the redesign had deleted
- one demanded `"transitionend"` in every page, which could only pass while the
  code was duplicated
- one pinned `touch-action:none` on the head — the assertion WAS the bug
- one pinned the tab separator he asked to remove
- one printed `FAIL` and exited `0`

If a gate blocks a fix, work out whether it is protecting behaviour or encoding a
decision that has changed. Update it with the reasoning in a comment; do not
relax it, and do not delete an assertion to make something pass.

Every contract should have a `--self-test` that re-injects the bug. An injection
that cannot fail is worse than none.

---

## 8. Safety

- **`hmCompanions` / `hmCompanion` in localStorage hold his real baked heads,
  ~890 KB, UNRECOVERABLE.** Snapshot both before anything that could write and
  restore after. This code path has already destroyed heads (a read path wrote a
  capped list back) and corrupted them (photographic eye layers leaking between
  subjects). Walking to step 4 in the Maker auto-saves.
- **Never use `mcp__claude-in-chrome__*`.** It drives his real browser and that
  live storage. Read, never write.
- **Stage only your own files**: `git commit -- <paths>`. Never `-a`, never
  `add -A`. Several agents work this tree at once.
- Never serve `images/earth-map-src.jpg` (2.5 MB) raw.
- Cache-busting a page URL does not bust its external CSS or JS.

---

## 9. How he wants to be talked to

Short. Around five lines. Lead with what changed and the number that proves it.
Anything not done goes first, in its own line. Put questions in a structured
prompt rather than burying them in prose — he answers those fast and skims the
rest.

Tell him when something is wrong, expensive, or a bad trade, and give the
measurement rather than the adjective. He has repeatedly been right when he
pushed back, and the times this project went wrong were the times someone
reported a green number instead of looking at the screen.
