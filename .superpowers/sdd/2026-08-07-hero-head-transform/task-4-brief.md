# Task 4: Hero Transform Regression Closure

**Status:** Preflight only. Start after Task 3 is committed and its focused review is green.

**Purpose:** Close the two non-blocking Task 1 review findings and prove that the finished head transform survives breakpoint changes, short desktop height, touch input, reload, accessibility media modes, and every approved Home portrait performance. This task adds regression coverage first; it does not redesign the Hero.

## Files

- Modify: `tools/hero-entrance-rhythm-contract.py`
- Modify: `tools/hero-head-transform-contract.py`
- Modify: `tools/shared-surfaces-contract.py`
- Modify: `tools/shared-surfaces-browser.py`
- Modify only if the focused test exposes a real projection gap: `tools/hero-popcorn-browser.py`
- Modify after every gate is green: `docs/superpowers/specs/2026-08-07-hero-head-transform-design.md`

Do not begin from the current uncommitted Task 3 RED state. Preserve the Task 3 owner’s changes to `hero-head-transform.js`, `hero-engine.js`, `controls.css`, and `tools/hero-head-transform-contract.py`; re-read the committed versions after handoff before applying this brief.

## Acceptance matrix

Use these exact viewport constants. The 760/761 and 1280×650 entries are the parked Task 1 quality-review follow-ups.

```python
RHYTHM_VIEWPORTS = (
    (1440, 900),
    (1280, 720),
    (1280, 650),
    (761, 844),
    (760, 844),
    (390, 844),
    (320, 800),
)

TRANSFORM_VIEWPORTS = (
    (1440, 900),
    (1280, 650),
    (761, 844),
    (760, 844),
    (390, 844),
    (320, 800),
)

TRANSFORM_THEMES = ("off", "night")
TOUCH_VIEWPORTS = ((390, 844), (320, 800))
ACCESSIBILITY_VIEWPORTS = ((1280, 650), (390, 844))
```

For every width, `width > 760` is desktop and `width <= 760` is mobile. Do not smooth over the breakpoint by using a nearby representative width.

## Step 0: Freeze the post-Task-3 baseline

Before editing a contract, run:

```bash
git status --short
git log -5 --oneline
python3 tools/hero-head-transform-contract.py
python3 tools/hero-entrance-rhythm-contract.py
python3 tools/shared-surfaces-contract.py
python3 tools/shared-surfaces-browser.py
python3 tools/hero-popcorn-browser.py
```

Expected: the committed Task 3 focused suite passes. Record the exact Task 3 commit in the Task 4 report. If the worktree still contains another agent’s edits, stop rather than folding them into Task 4.

## Step 1: Add the Task 1 boundary and short-height checks first

Edit `tools/hero-entrance-rhythm-contract.py` before changing production code.

Replace the current viewport tuple with `RHYTHM_VIEWPORTS`. Replace the mobile special case (`680 if width == 390 else 640`) with the actual token formula:

```python
def expected_hero_height(width, height):
    if width > 760:
        return height - 88
    return min(680, max(600, height - 160))
```

Use it for every viewport:

```python
expected_height = expected_hero_height(width, height)
assert expected_height - .5 <= state["hero"]["height"] <= expected_height + .5, (
    width, height, state
)
```

Retain the existing mobile line-count, 44px controls, and overflow checks for every `width <= 760`, including exactly 760px. The portrait width, crop, and CTA-gap constraints describe the authored 390px/320px phone compositions; applying all three at 760px is mathematically incompatible because the larger head needed for the width ratio cannot simultaneously preserve both the lower crop and protected copy gap. Capture 760px and 761px as an explicit breakpoint pair instead of enlarging the tablet portrait. Retain the full-height desktop composition at 761px and at 1280×650; the expected heights are 756px and 562px respectively. The short viewport must not be “fixed” by shrinking the desktop Hero or exposing a work thumbnail above the fold.

Add `off` to the pixel seam loop and sample the near-corners as well as the interior:

```python
for theme in ("off", "pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night"):
    page.evaluate("state => window.SiteTheme.setMode(state,{persist:false})", theme)
    page.wait_for_function(
        "state => document.querySelector('#main').dataset.timeState === state",
        arg=theme,
    )
    page.wait_for_timeout(700)
    hero = page.locator("#main").bounding_box()
    expected = ImageColor.getrgb(page.evaluate(
        "getComputedStyle(document.documentElement).getPropertyValue('--theme-page').trim()"
    ))
    image = Image.open(BytesIO(page.screenshot())).convert("RGB")
    y = int(hero["y"] + 2)
    xs = (
        int(hero["x"] + 2),
        int(hero["x"] + hero["width"] * .25),
        int(hero["x"] + hero["width"] * .50),
        int(hero["x"] + hero["width"] * .75),
        int(hero["x"] + hero["width"] - 3),
    )
    for x in xs:
        actual = image.getpixel((x, y))
        assert max(abs(actual[i] - expected[i]) for i in range(3)) <= 2, (
            width, height, theme, x, actual, expected
        )
```

Run RED:

```bash
python3 tools/hero-entrance-rhythm-contract.py
```

Expected before any correction: the new cases execute. If they are already green, keep the coverage and make no production change. If a case fails, the failure must name its exact viewport/state/pixel. Never relax the ±0.5px geometry or ±2 RGB tolerances to obtain green.

## Step 2: Refactor the transform contract into explicit matrices

In `tools/hero-head-transform-contract.py`, add small helpers rather than duplicating the current Task 3 sequence:

```python
def storage_snapshot(page):
    return page.evaluate(
        "() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]))"
    )

def set_theme(page, theme):
    page.evaluate("state => window.SiteTheme.setMode(state,{persist:false})", theme)
    page.wait_for_function(
        "state => document.querySelector('#main').dataset.timeState === state",
        arg=theme,
    )

def selected_chrome(page):
    return page.evaluate("""() => ({
      state: window.__heroHeadTransform.getState(),
      pressed: document.querySelector('#face').getAttribute('aria-pressed'),
      hidden: document.querySelector('#heroHeadSelection').hidden,
      tabs: [...document.querySelectorAll('.heroHeadHandle')].map(n => n.tabIndex)
    })""")

def assert_authored_reset(page):
    actual = selected_chrome(page)
    assert actual == {
        "state": {"selected": False, "x": 0, "y": 0, "scale": 1},
        "pressed": "false",
        "hidden": True,
        "tabs": [-1, -1, -1, -1],
    }, actual
```

Run the core select → move → proportional resize → safe-bound checks for every member of `TRANSFORM_VIEWPORTS × TRANSFORM_THEMES`. Attach `pageerror` and console-error collectors to every page and assert they remain empty. Assert no horizontal overflow after each move and resize.

Store one default geometry snapshot per viewport in Off, then compare Night against it within 1px. Compare Hero, protected copy, logical head, and visible selection dimensions; compare states by geometry only, not color. The 760px and 761px snapshots intentionally differ from each other because they sit on opposite sides of the authored breakpoint.

Run RED:

```bash
python3 tools/hero-head-transform-contract.py
```

Expected: any missing breakpoint, short-height, Night reclamp, or overflow behavior fails with the `(width, height, theme)` label. Add no product correction until the new assertion is observed.

## Step 3: Prove touch drag does not steal mobile controls

Use real Chromium touch input, not mouse events with a `pointerType` field. Add this helper:

```python
def touch_drag(context, page, start, end):
    client = context.new_cdp_session(page)
    client.send("Input.dispatchTouchEvent", {
        "type": "touchStart",
        "touchPoints": [{"x": start["x"], "y": start["y"], "id": 1}],
    })
    for step in range(1, 6):
        progress = step / 5
        client.send("Input.dispatchTouchEvent", {
            "type": "touchMove",
            "touchPoints": [{
                "x": start["x"] + (end["x"] - start["x"]) * progress,
                "y": start["y"] + (end["y"] - start["y"]) * progress,
                "id": 1,
            }],
        })
    client.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
```

For each `TOUCH_VIEWPORTS` entry, create a context with `has_touch=True`, `is_mobile=True`, and `reduced_motion="reduce"`, then run this sequence in Off:

1. Tap `#heroTimeBtn` with `page.touchscreen.tap`; assert the menu opens. Press Escape and assert it closes. This proves the control works before selection.
2. Record `scrollY`, current `data-time-mode`, `#heroTimeBtn[aria-expanded]`, and the active `.csTab`.
3. Start a touch drag on the visible logical head and end at the center of `#heroTimeBtn`. Assert the transform state moved and remains selected, `scrollY` changed by at most 1px, the time menu did not open, the time mode did not change, and the active work tab did not change.
4. Start another touch drag on the selected frame and end below the Hero over the work-tab region. Assert the frame remains within the Hero/protected lower artboard, the document still did not pan, and no work tab activated from the drag release.
5. Tap `#heroTimeBtn`. The capture-phase outside-selection handler must deselect without cancelling the intended button activation: assert `selected is False` and the menu is open.
6. Close the menu, scroll `#cases` into view, tap `.csTab[data-tab="goodness"]`, and assert that tab/panel activates. This proves the completed transform leaves the collection interactive.

After every drag, use `document.elementFromPoint` just below the Hero edge to assert no `.heroHeadHandle` or `#heroHeadSelection` is hit-testable there. The 44px handle boxes must remain inside the Hero clip and must never intercept the tabs.

Run RED with only this focused function temporarily selected. Expected failures must identify whether the browser panned, a control fired during drag, or selection chrome leaked below the Hero.

## Step 4: Prove reload reset and zero persistence

For every `TRANSFORM_VIEWPORTS × TRANSFORM_THEMES` case:

```python
before_storage = storage_snapshot(page)
before_url = page.url

# Select, move, and resize here. Require x/y and scale to differ from defaults.
changed = page.evaluate("window.__heroHeadTransform.getState()")
assert changed["selected"] and (changed["x"] or changed["y"]) and changed["scale"] != 1
assert storage_snapshot(page) == before_storage
assert page.url == before_url

page.reload(wait_until="load")
page.wait_for_function("window.__heroHeadTransform && window.__heroHeadTransform.getState")
assert_authored_reset(page)
assert storage_snapshot(page) == before_storage
assert page.url == before_url
```

Take the storage snapshot after calling `set_theme(..., persist:false)` so the test isolates transform writes from unrelated application initialization. Compare the complete key/value map, not only `localStorage.length`; overwriting an existing key is also a persistence regression.

After reload, also compare the logical head rectangle to the pre-transform authored rectangle within 1px. Do not call `reset()` before reload; that would hide persistence defects.

## Step 5: Prove reduced motion and forced colors

### Reduced motion

The existing reduced-motion geometry loop is necessary but not sufficient. In the reduced-motion context, select, move, and resize once, then assert the interaction remains functional and these exact nodes have zero-duration transitions:

```python
motion = page.evaluate("""() => {
  const read = (selector, pseudo = null) => {
    const s = getComputedStyle(document.querySelector(selector), pseudo);
    return {transitionDuration:s.transitionDuration, animationName:s.animationName};
  };
  return {
    matches:matchMedia('(prefers-reduced-motion:reduce)').matches,
    transform:read('#heroHeadTransform'),
    selection:read('#heroHeadSelection'),
    handle:read('.heroHeadHandle'),
  };
}""")
assert motion["matches"]
for key in ("transform", "selection", "handle"):
    assert set(motion[key]["transitionDuration"].split(", ")) <= {"0s"}, motion
    assert motion[key]["animationName"] == "none", motion
```

Keep `tools/hero-popcorn-browser.py`’s reduced-motion assertion that `#heroMovieEffectsStage` has no generated children. Add a selected/moved/resized setup before triggering Extras there, so zero animated props is proven under the outer transform too. Glasses may settle to their authored reduced-motion static state; no popcorn/kernel/crumb animation may start.

### Forced colors

For each `ACCESSIBILITY_VIEWPORTS` entry, use:

```python
context = browser.new_context(
    viewport={"width": width, "height": height},
    forced_colors="active",
    reduced_motion="reduce",
)
```

Select with the keyboard, focus a handle, and assert:

```python
forced = page.evaluate("""() => {
  const frame=getComputedStyle(document.querySelector('#heroHeadSelection'),'::before');
  const handle=getComputedStyle(document.querySelector('.heroHeadHandle:focus'),'::before');
  return {
    matches:matchMedia('(forced-colors:active)').matches,
    frameShadow:frame.boxShadow,
    frameAdjust:frame.forcedColorAdjust,
    handleShadow:handle.boxShadow,
    handleAdjust:handle.forcedColorAdjust,
    active:document.activeElement && document.activeElement.dataset.corner,
  };
}""")
assert forced["matches"] and forced["active"]
assert forced["frameOutline"] != "none" and forced["handleOutline"] != "none", forced
assert forced["frameAdjust"] == "auto" and forced["handleAdjust"] == "auto", forced
```

Also assert all four effective handle boxes remain at least 44×44px and the selection rectangle matches the non-forced-colors logical geometry within 1px. Chromium suppresses author box shadows to `none` when `forced-color-adjust:auto` is active, so visibility is proven with a system `Highlight` outline while retaining automatic system-color mapping. Do not assert a serialized RGB value for `Highlight`; browsers map system colors differently. Keep the static CSS assertion for the literal `Highlight` token and `forced-color-adjust:auto`.

## Step 6: Prove the complete animation engine survives move and resize

Run this section with `reduced_motion="no-preference"` at 1440×900, 1280×650, 390×844, and 320×800. Set `introSeen` before navigation, wait for `!introMode && !eventLock`, select, move, and resize before triggering any performance. Keep the transformed state snapshot and require it to remain unchanged throughout.

Add a fresh-query helper; never retain an `.eye` or `.iris` locator across `setFace()` because `buildEyes()` removes and rebuilds those nodes:

```python
def iris_transform(page):
    return page.evaluate("""() => {
      const iris=document.querySelector('#stage .iris');
      return iris ? getComputedStyle(iris).transform : null;
    }""")
```

Exercise all four approved performance groups:

1. **Gaze:** wait for a fresh iris, sample it, move the pointer between two transformed face-relative coordinates, and require two non-null, different transforms.
2. **Blink:** call the existing deterministic engine hook `requestBlink('neutral', false, false)`. Require the face source to reach the closed frame, then require at least two freshly queried eyes/irises to return. Do not test blink by sleeping until the randomized idle timer fires.
3. **Case-study smile:** focus `.csPanel.on .csGo` with `{preventScroll:true}`. Require `#face[src$="smile.webp"]`, then blur and require the engine to settle. Re-query the eyes after both transitions.
4. **Extras popcorn/glasses:** activate `.csTab[data-tab="goodness"]`, focus or hover `#reelFrame`, and require `.heroCharacterPeek.is-movie`, `#glasses.on`, one `.popbucket`, visible movie props, and a `data-movie-tick`.

For the frame and projection assertions, add:

```python
projection = page.evaluate("""() => {
  const rect = node => { const r=node.getBoundingClientRect(); return {
    left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height
  }; };
  const face=document.querySelector('#face');
  const bounds=face.dataset.headBounds.split(/\s+/).map(Number);
  const f=rect(face),h=rect(document.querySelector('#main'));
  const logical={left:f.left+f.width*bounds[0],top:f.top+f.height*bounds[1],
    right:f.left+f.width*bounds[2],bottom:f.top+f.height*bounds[3]};
  const visible={left:Math.max(logical.left,h.left),top:Math.max(logical.top,h.top),
    right:Math.min(logical.right,h.right),bottom:Math.min(logical.bottom,h.bottom)};
  return {
    state:window.__heroHeadTransform.getState(),
    visible,
    selection:rect(document.querySelector('#heroHeadSelection')),
    stage:rect(document.querySelector('#stage')),
    effects:rect(document.querySelector('#heroMovieEffectsStage')),
    hero:h,
    clip:rect(document.querySelector('#heroMovieEffectsClip')),
    clipOverflow:getComputedStyle(document.querySelector('#heroMovieEffectsClip')).overflow,
    glasses:document.querySelector('#glasses').classList.contains('on'),
    props:[...document.querySelectorAll('.popbucket,.kernel,.popcrumb')]
      .filter(n => parseFloat(getComputedStyle(n).opacity) > 0).length,
  };
}""")
```

Assert selection versus `visible` within 1px, stage versus effects on all four edges within 1px, Hero versus clip within 0.5px, `clipOverflow == "clip"`, glasses on, and at least one visible prop. Assert every visible prop is clipped at the Hero edge with the existing `hero-popcorn-browser.py` probe, not merely that its bounding box extends outside.

Finally blur/leave Extras, require movie mode and glasses to clear, re-query the eyes, and assert the outer transform state still equals the pre-performance snapshot. This is the full preservation gate for gaze, blink, smile, glasses, popcorn, clipping, and engine DOM rebuilds. It must not add Home Mood, Home dizzy, or any new animation.

## Step 7: Clean up shared contracts without weakening them

In `tools/shared-surfaces-contract.py`, keep the current negative assertion that `hero-engine.js` has no Home face click binding, then add transform ownership checks:

```python
transform = (ROOT / "hero-head-transform.js").read_text(encoding="utf-8")
engine = (ROOT / "hero-engine.js").read_text(encoding="utf-8")
assert "window.HeroHeadTransform={init:init}" in transform
assert 'face.addEventListener("pointerdown",beginMove)' in transform
assert "tapReact()" not in transform
assert 'faceImg.addEventListener("click"' not in engine
assert 'addEventListener("heroheadtransform"' in engine
```

Do not assert `tapReact()` is absent from all of `hero-engine.js`; Play still shares the engine and may retain game-specific dizzy behavior. The regression is specifically that Home selection must not invoke it.

In `tools/shared-surfaces-browser.py`, retain the current fresh, guarded `#stage .iris` query at every sample. Extend it so the gaze, smile, and movie transitions each wait for a new live iris before reading style. Require at least two non-null gaze samples; never cache an `ElementHandle` or locator result across a face-source transition.

Run RED after the contract-only changes. If every addition is already green, no production edit is warranted. Otherwise make the smallest production correction for the named invariant and rerun that focused test before the matrix.

## Step 8: Full GREEN verification and evidence

Run exactly:

```bash
python3 -m py_compile \
  tools/hero-entrance-rhythm-contract.py \
  tools/hero-head-transform-contract.py \
  tools/shared-surfaces-contract.py \
  tools/shared-surfaces-browser.py \
  tools/hero-popcorn-browser.py
node --check hero-head-transform.js
node --check hero-engine.js
python3 tools/hero-entrance-rhythm-contract.py
python3 tools/hero-head-transform-contract.py
python3 tools/shared-controls-contract.py
python3 tools/shared-controls-browser.py
python3 tools/shared-surfaces-contract.py
python3 tools/shared-surfaces-browser.py
python3 tools/hero-popcorn-browser.py
python3 tools/hero-specimen-check.py
python3 tools/token-audit.py
git diff --check
```

Capture at least these final frames in Off and Night: 1440×900, 1280×650, 761×844, 760×844, 390×844, and 320×800. For 1440×900, 1280×650, 390×844, and 320×800 also capture resting, selected, moved/resized, and Extras movie frames. Inspect rather than merely generate them.

Expected: no page/console errors, overflow, top seam, frame/handle leakage, control interception, storage mutation, reload persistence, geometry drift between Off and Night, forced-colors invisibility, reduced-motion transition, or animation projection error.

Only after the complete matrix is green, update the design spec status to `Implemented and verified` and add a `## Verification` section containing the Task 2, Task 3, and Task 4 commit hashes plus the exact commands above.

## Reversal guardrails

These are acceptance constraints, not optional cleanup:

- Keep the desktop Hero at `calc(100svh - 88px)`, including 1280×650 and 761px wide. Do not shorten it to reveal work above the fold.
- Keep the intentional mobile height token and the large lower-edge peeking portrait. Do not reveal a full face or introduce a miniature/ghost portrait.
- Keep the Home Hero rimless. Do not add a border, outline, shadow, or white seam to the resting surface.
- Keep Off visually neutral with only its authored floor shadow. Do not apply the time-scene gradient or portrait cast in Off.
- Do not restore Home click-to-dizzy. Selection owns Home portrait activation; Play may keep its game-specific behavior.
- Do not restore the rejected Face ID ornament. The approved Figma-like frame appears only while selected.
- Do not restore the withdrawn blue cursor glow.
- Do not restore Home Mood; it remains on Play.
- Do not add a Play-local day/time picker or copy Home’s time-gradient stack into Play.
- Do not revive the rejected Wii/Arena Select redesign or a separate live-head playfield panel.
- Do not add an always-on portrait shadow, purple-everywhere dark mode, the rejected gradient-maker Hero artwork, or an `Automatic + resolved day` label.
- Do not turn research-only soundtrack, recoloring, haptics, or thumbnail concepts into Task 4 production scope.

## Commit boundary

Commit only the Task 4 contracts, any minimal production fix directly required by a newly failing Task 4 invariant, the verified design-spec status, and the Task 4 report:

```bash
git add \
  tools/hero-entrance-rhythm-contract.py \
  tools/hero-head-transform-contract.py \
  tools/shared-surfaces-contract.py \
  tools/shared-surfaces-browser.py \
  tools/hero-popcorn-browser.py \
  docs/superpowers/specs/2026-08-07-hero-head-transform-design.md \
  .superpowers/sdd/2026-08-07-hero-head-transform/task-4-report.md
git commit -m "Verify Hero transform across responsive states"
```

Before committing, inspect `git diff --cached --name-only` and remove any Task 3 owner edits or pre-existing untracked plan files from the index.
