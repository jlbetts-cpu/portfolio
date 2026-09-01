# Yowmings League — case study draft v2

Cut to the shipped length. Measured: the five live case studies average **491
words** (cluster 294, strata 412, ucdavis 526, apollo 602, bearings 622), 4–7
sections, median paragraph 35 words. v1 was 1,523 — this is ~470.

Changes from v1, all his notes: no "what's still open" section; one number per
section instead of five; the visuals carry the proof; paragraphs at his length.

---

## Hero

**Yowmings League**

> A game that settles a real draft has to be one nobody can argue with.

**Role** Designer & builder · **Scope** End to end, solo · **Built with** Vanilla
JS, no framework · **Year** 2026

*[pitch-01-match.png]*

---

## Overview

Every year my friends need a fantasy draft order. A random draw is fair. A game
is better — but only if everyone believes the result.

Twelve of their faces drop down a marble course to seed a bracket, then play it
out until someone takes the 1.01. It runs in a browser with no framework and no
build step.

*[head-02-drop-sequence.png — the head brings the ball on]*

---

## The stakes

### A toy can be wrong. A verdict cannot.

Nobody audits a game they played once. They audit the one that decided who picks
first, and they do it out loud, while watching.

So "done" stopped meaning "fun" and started meaning "unarguable". Six weeks, 991
commits, and the interesting work was never the feature — it was the gap between
what my instruments measured and what the screen actually showed.

---

## The course

### The race worked on the only screen I had measured.

The race seeds the bracket, so if it stalls there is no draft. Swept across
nineteen viewport sizes, twenty-two races ended with nobody across the line. On
a TV, fewer than one in five finished.

My theory was the fall. I measured first, and it was the gate: its bar scales
with the course, its opening never did. **Twenty-two stalled races became zero.**

*[race-00-before-after.png]*

---

## The players

### A head could reach a state with no way out.

Players froze mid-match — rarely, briefly, and exactly the kind of thing that
gets brought up for a year.

A head could end up falling and not airborne at the same time, which nothing in
the engine can leave. It was **half of every frozen frame**. The fix had to
remove the freeze without removing the mess, because the chaos is the point:
after it, the ball spent *more* time in the air, not less.

---

## The rule

### I argued for the wrong version, and the measurement won.

Balls were passing through the goal without scoring. Real football has no
ceiling over the uprights, so I removed ours. It fixed the complaint outright.

It also awarded **more than a quarter of goals with the ball in open sky above
the posts** — a picture that no longer matched its own rule. The version that
shipped is narrower, and no goal lands above the posts now.

*[goal-01-through-the-uprights.png]*

---

## What I took from it

### Counting is not looking.

Four times in one night an instrument said fine and the screen disagreed. A
hairline that measured 1px read as a line struck through the score. A layout that
measured "nothing off-screen" had two elements sitting on top of each other. Two
captains' names came out invisible on their own bar.

Both lie. The work is knowing which one you are holding.

*[bar-00-before-after.png · goalposts-00-before-after.png]*

---

## Outcome

### It decides something, and nobody argues.

Every race finishes, on every screen I could find. Players stay on their feet.
Goals look like goals. And the thing it was built to protect survived all of it —
the winner still is not the halfway leader in two races out of three.

*[photo-01-tear-sequence.png — the loser's photograph, torn]*

---

## Notes for build

- ~470 words, 7 sections, longest paragraph 48 — inside the shipped range.
- Numbers are qualitative where possible ("fewer than one in five", "half of
  every frozen frame"). The precise figures live in the commit history if anyone
  asks; the page does not need them.
- No "open defects" section, per his note.
- `players-01-frozen.png` is captured, from the tree BEFORE the fix (912a643^),
  since freezes are 0.12 a match now. Five frames: the leftmost head holds the
  same position while the cluster beside it moves.
  **Honest note — it is a weak image.** A still cannot show absence of motion, so
  it only reads with a caption telling you where to look. My first version drew a
  ring on the frozen head and the ring landed a head-height low (these heads
  carry transforms, so the sampled rect is not where they paint), and a
  misplaced circle is worse than none. Worth deciding whether this section is
  better with the strip plus a caption, or with no image at all.
- `head-02-drop-sequence.png` must be **recaptured** — the current frames have
  the missing-iris bug in them, which is fixed as of `d3cd492`.
