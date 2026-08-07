# Task 4 report — responsive regression closure

Status: implementation and focused matrix green; final full-suite evidence recorded below

Baseline: `67d695f Fix Hero resize axes and keyboard scope`

## Outcome

- Expanded Hero rhythm coverage to the exact 1440, 1280, short-height 1280, 761/760 breakpoint pair, 390, and 320 viewports. Every time state now includes Off and samples both near-corners as well as the interior top seam.
- Expanded transform coverage to every required Off/Night viewport pair, with page/console error collection, overflow checks, safe bounds, complete localStorage map comparison, URL stability, authored reload reset, and Off/Night geometry equality.
- Added real Chromium touch input at 390 and 320. Portrait drags do not pan the page, open the time menu, change the active time state, or activate a work tab; outside taps still deselect without cancelling the intended control.
- Added reduced-motion and forced-colors gates. Chromium suppresses author box shadows under `forced-color-adjust:auto`, so the selected frame and handles now use a system `Highlight` outline, which is the rendered forced-colors primitive while retaining automatic platform mapping.
- Verified gaze, deterministic blink, case-study smile, Extras glasses/popcorn, DOM eye rebuilds, state preservation, and projection alignment after move and resize at 1440×900, 1280×650, 390×844, and 320×800.
- Corrected overlay ownership: the constant-size selection overlay and Hero-wide movie clip are now direct Hero-relative siblings rather than children of the animated peek layer.
- Added per-frame projection synchronization while the authored movie lift and movie-stage performance transforms run. The transform state no longer mutates merely because movie mode starts.
- Repaired the stale popcorn browser trigger to activate the current real Extras `#reelFrame` path. Popcorn remains pointer-transparent, clips on all four Hero edges, renders above the portrait, and is positioned with the shared `--sp-16` token so the bucket is actually visible rather than merely opaque offscreen.

## RED evidence

1. The expanded rhythm contract first failed at 760×844 when the brief attempted to apply the 390/320 phone portrait ratio, copy gap, and crop simultaneously. Increasing the portrait from 520px to 720px satisfied the ratio but necessarily overlapped the protected copy and violated the crop. The production experiment was reverted; 760 retains exact mobile height/line/control/overflow/seam/transform checks, while phone composition checks remain at 390/320.
2. Forced-colors computed `box-shadow:none` under `forced-color-adjust:auto`, proving the original combined assertion impossible in Chromium. The contract now verifies a visible system outline and `auto` mapping.
3. Movie mode moved the clip and selection with `.heroCharacterPeek`, producing a 33px Hero/clip drift and stale selection geometry.
4. The short-height matrix showed movie-class reclamping changed authored transform state by about 3.2px.
5. The mobile movie matrix showed per-frame stage motion could move the face about 10px away from the selection overlay.
6. The repaired popcorn test rejected the obsolete case-card trigger, then exposed the old `heroOverflow:visible` expectation and an opacity-only offscreen bucket. The strengthened visible-prop predicate failed at 1440×900 with `props:0` until the bucket intersected the Hero.

## GREEN evidence

Focused runs:

```text
python3 tools/hero-head-transform-contract.py
Hero head transform: OK

python3 tools/hero-entrance-rhythm-contract.py
Hero entrance rhythm: OK

python3 tools/hero-popcorn-browser.py
checking desktop-1280
checking mobile-390
checking mobile-320
Hero popcorn containment: OK; screenshots: /tmp/hero-popcorn-browser

python3 tools/shared-surfaces-contract.py
Shared surface static contract: OK

python3 tools/shared-surfaces-browser.py
Shared surface browser contract: OK (/tmp/shared-surfaces-browser)
```

The exact broad command block was run fresh. Task 4's compile/syntax/rhythm/transform/static gates passed, then the chain stopped at the already queued Play shared-material failure:

```text
shared-controls-browser.py
AssertionError: ('.../play.html secondary/icon 1440 night focus',
  3.2659688998994665,
  {'color':'rgb(104, 107, 115)','background':'rgb(23, 26, 33)',
   'surround':'rgb(11, 12, 15)','outlineColor':'rgb(217, 215, 255)'})
```

That 3.266:1 Play Night control contrast is outside the Hero transform boundary and is explicitly assigned to the queued shared opaque-material/control task. Independent post-failure runs confirmed shared surfaces and popcorn green. `token-audit.py` returned `STATUS=PASS` with warnings only, and `git diff --check` exited 0. The legacy `hero-specimen-check.py` remains stale before Task 4 changes: it expects an unversioned `hero-time.css`, a removed Hero rim, `opensAbove`, and other pre-shared-surface markup. It is left untouched rather than partially weakened; the current Hero behavior is covered by the focused rhythm, transform, shared-surface, and popcorn contracts.

## Visual inspection

Inspected the final responsive evidence rather than only generating it:

- `/tmp/hero-head-task4/home-{1440-900,1280-650,761-844,760-844,390-844,320-800}-{off,night}-resized.png`
- `/tmp/hero-head-task4/home-{1440-900,1280-650,390-844,320-800}-movie.png`
- `/tmp/hero-popcorn-browser/{desktop-1280,mobile-390,mobile-320}-contained.png`

The 760/761 pair preserves the intentional breakpoint distinction without changing the authored 390/320 portrait scale. Final movie frames show settled red/cyan glasses registered across the transformed eyes, the popcorn bucket visibly contained at the lower Hero edge, one constant-size 1px selection frame, and all four handles fully inboard.

## Scope

Owned Task 4 files only are committed. The pre-existing untracked `docs/superpowers/plans/2026-08-06-shared-control-system.md` remains untouched and excluded.

Task 4 commit: recorded after commit in the parent handoff because a commit cannot contain its own immutable hash.
