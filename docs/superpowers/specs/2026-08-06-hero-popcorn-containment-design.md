# Hero popcorn containment design

**Status:** User-approved on 2026-08-06.

## Purpose

Restore the version of the popcorn-and-glasses performance whose decorative pieces remain inside the rounded Hero box, without reintroducing the mobile menu clipping/internal-scroll regression.

## Architecture

- Keep `.hero` overflow visible so Time and Mood menus can escape the Hero and every row remains reachable at 320 px.
- Add a dedicated non-interactive visual-effects clipping layer aligned exactly to the Hero's rounded inner bounds.
- Route the popcorn bucket, kernels, and crumbs through that layer while preserving their stage-relative coordinates and animation timing.
- Keep the face, glasses, mouth, eyes, and normal stage stacking visually unchanged.
- The clipping layer inherits the Hero radius/corner shape, creates no scroll container, takes no pointer events, and changes no layout geometry.

## Behavior

- Case-study hover and Extras/reel hover continue to trigger the same full movie performance and contextual word.
- Popcorn may travel throughout the Hero but disappears cleanly at its rounded outline; no kernel, crumb, or bucket paints outside.
- Cleanup removes/hides every effect exactly as before. Rapid enter/leave cannot strand particles.
- Reduced motion preserves the existing simplified behavior.

## Verification

Check Case Studies and Extras at desktop and supported hover widths, including repeated entry/exit, Hero animation transforms, Night/light themes, and scrolling. At 390×844 and 320×800, confirm the Time/Mood menus remain fully reachable, `hero.scrollTop` stays zero, no horizontal overflow appears, and the visual clip matches all four Hero edges.

---

# Amendment, 2026-08-11: PLACEMENT

This document specified **clipping** and said nothing about **placement**, and the
gap cost three passes. Each one found a real arithmetic error, fixed it, and left
the bucket in the wrong place, because none of them was wrong about arithmetic —
they were all anchoring to the wrong thing. Recorded here so there is not a
fourth.

## The rule

**The bucket hangs from the CHIN. Its top edge sits `--hero-chin-gap` below the
chin, and it never rises above it.**

Jayden's reasoning is the specification, not a preference:

> "Popcorn isn't near his chin, it's in front of his face, which is wrong because
> the audience needs to see him chew."

Someone eating popcorn holds the bucket **below** the chin and lifts from it. The
bucket never covers the mouth, because the eating is the performance. **The face
staying visible is the requirement; the bucket's position is derived from it.**

## Why a floor can never satisfy it

Both previous anchors were floors — first the effects stage's, then the Hero's —
and a floor answers a different question: where a bucket that has been *put down*
belongs. Nobody has put this one down; the head is holding it.

A floor also cannot predict the chin. The head floats, is draggable and
resizable, swaps between faces with different `data-head-bounds`, and has grown
to 275px with a negative resting depth. The distance from chin to floor is
therefore different at every width and in every pose. Measured with the movie
running, the Hero-floor anchor covered:

| viewport | covered | share of head |
|---|---|---|
| 1440×900 | 149.9px | 52.1% |
| 390×844 | 119.3px | 54.6% |
| 320×800 | 119.8px | 54.8% |

Half the head at every width — the mouth, the moustache and the chin, which is
exactly the performance. That the three numbers agree so closely is the tell: it
was not a tuning error, it was the wrong reference.

After the amendment, at the same three widths: **1.5px / 0.0px / 1.6px**, and the
residue is the rotated bucket's top *corner* — the tilt swings it — at an x
offset where the face has already narrowed to nothing. Nothing is covered.

## How it is implemented

- `syncMovieEffectsLayer()` in `hero-engine.js` publishes `--movie-chin-y` on
  `#heroMovieEffectsStage` every frame, from the **live** `data-head-bounds` of
  the face currently in `#face`, in the effects layer's own coordinates.
  `data-head-bounds` is a fraction of the face box and `.face` is `inset:0` in
  the stage, so the stage's height is the multiplier.
- `index.html` anchors `#heroMovieEffectsStage .popbucket` with
  `top: calc(var(--movie-chin-y) + var(--hero-chin-gap))`, `bottom:auto`.
- **The kernel's start point is part of the anchor, not separate from it.** It
  was the literal `Sy=0.84` — a fraction of the stage chosen when the bucket
  stood on the stage's floor. A bucket moved without it produces popcorn
  appearing in mid-air above the bucket. It is now derived in the same place, as
  `(chin + MOVIE_CHIN_GAP + MOVIE_KERNEL_DIP) / stageHeight`, i.e. just inside
  the rim.
- `--movie-stage-overhang` existed only to lift the bucket to the Hero's floor
  and is **deleted**, not left dangling.

## What this trades away, deliberately

The bucket may now extend past the Hero's lower edge; `.heroMovieEffectsClip`
crops it there. That is intended — it reads as a bucket held below the frame
line, and it is the containment this document already specifies. If the head is
dragged low enough that the chin leaves the Hero, the bucket follows it out of
frame, which is correct: the chin is not visible either.

## Verifying placement

Do not measure the bucket against the Hero, the stage, or any floor. Measure
**`bucket.getBoundingClientRect().top` against
`face.top + face.height * data-head-bounds[3]`**, with the movie actually
running, at 1440, 390 and 320, and against the head at its resting size.

Two things make this hard to drive and both have wasted a session:

- **The movie is reel-only.** `startMovie()` has exactly two callers, both on
  `#reelFrame` (`pointerenter`, inside `if(fine)`, and `focusin`). Case-study
  hover does *not* start it, whatever the Behavior section above implies.
- **`#reelFrame` measures 0×0 until the Extras tab is open and the pinned reel
  section is scrolled into range.** Hovering it before that hovers the document
  origin, no movie starts, and the probe reports "no bucket" rather than
  "wrong place". Open the tab, scroll to the reel's own top, then drive the real
  mouse.

At the reel's scroll position the head sits ~550px **above** the viewport, so a
viewport-clipped screenshot is empty. Capture in page coordinates
(`full_page=True` with a document-space clip) — the head is still rendered and
still the thing being judged.

