# Hero Popcorn Containment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the existing popcorn bucket, kernels, and crumbs inside the rounded Hero outline without clipping or internally scrolling the Time and Mood menus.

**Architecture:** Leave `.hero` paint overflow visible and add one absolutely positioned, non-interactive `overflow:clip` layer whose border radius and corner shape inherit the Hero's exact outline. Inside it, maintain a stage-sized effect host aligned to the untransformed `#stage`; `hero-engine.js` mounts only the movie bucket, kernels, and popcorn crumbs there and mirrors each existing movie-stage transform to the host, while the face, glasses, mouth, tongue, eyes, triggers, timing, and cleanup state machines remain in their current DOM and code paths.

**Tech Stack:** Static HTML/CSS, browser DOM APIs, existing plain JavaScript 8 fps hero engine, Python static contract tests, Node syntax checks.

## Global Constraints

- Keep `.hero` overflow visible so Time and Mood menus can escape the Hero and every row remains reachable at 320 px.
- Add a dedicated non-interactive visual-effects clipping layer aligned exactly to the Hero's rounded inner bounds.
- Route only the popcorn bucket, kernels, and popcorn crumbs through the clipping layer; keep the face, glasses, mouth, tongue, eyes, and normal stage markup where they are.
- Preserve all existing stage-relative percentages, particle counts, `MOVCYCLE`, the master 8 fps clock, performance triggers, contextual words, and cleanup timing.
- The clipping layer inherits the Hero radius and `corner-shape`, uses `overflow:clip` rather than `hidden`, `auto`, or `scroll`, takes no pointer events, and changes no layout geometry.
- Case-study hover and Extras/reel hover continue to call the same `startMovie(word)` and `caughtMovie()` paths.
- Rapid enter/leave must leave `bucketEl`, all seven `kernelEls`, and all twelve `popcrumbEls` hidden/inactive after the existing ending sequence.
- Reduced motion retains the current simplified behavior: `glassesOn()` runs, `startMovie()` returns before creating or animating popcorn, and the CSS layer introduces no animation.
- Preserve Time states including Night, the Hero rim, horizontal page clipping, all unrelated working-tree edits, and the dual-host `hero-engine.js` fallback used by `play.html`.
- Do not add a dependency, a second animation clock, a `ResizeObserver`, a new scroll/resize layout system, or a second popcorn implementation.

---

## File Structure

- Modify `index.html`: add the empty Hero movie-effects clip/host after the existing stage wrapper and define its non-layout, no-scroll-container geometry beside the current popcorn styles.
- Modify `hero-engine.js`: resolve the optional effect host, align it to `#stage`, mount the three popcorn element families in it on Home, mirror only movie-mode stage transforms, and retain the current `#stage` fallback for the shared head-only host.
- Modify `tools/hero-specimen-check.py`: lock the clip shell, no-scroll/pointer contract, effect routing, transform mirroring, trigger reuse, cleanup, reduced-motion early return, and the existing `.hero { overflow:visible }` menu protection.

No new production or test file is needed: the change is a narrow extension of the existing Hero specimen contract, and all runtime state remains owned by `hero-engine.js`.

### Task 1: Add the dedicated Hero movie-effects clip and route the existing performance through it

**Files:**
- Modify: `tools/hero-specimen-check.py:23-50, 112-130, 292-318`
- Modify: `index.html:172-173, 1594-1620`
- Modify: `hero-engine.js:47-48, 1029-1166`

**Interfaces:**
- Consumes: existing `#main.hero`, `#stage`, `.stagewrap`, `startMovie(word)`, `caughtMovie()`, `endMovieCleanup()`, `MOVCYCLE`, `bucketEl`, `kernelEls`, `popcrumbEls`, and the element-local percentage coordinates written by `setKernel(el,x,y,rot,op)` and `setCrumb(c)`.
- Produces: `#heroMovieEffectsClip.heroMovieEffectsClip` as the Hero-sized rounded clip, `#heroMovieEffectsStage.heroMovieEffectsStage` as the stage-sized coordinate host, `syncMovieEffectsLayer(): void`, and `setMovieStageTransform(value: string): void`.
- Invariant: on `index.html`, the movie props' parent is `#heroMovieEffectsStage`; when the optional host is absent (the shared `play.html` head-only runtime), their parent remains `#stage`.
- Invariant: `setMovieStageTransform(value)` writes the same transform string to `#stage` and `#heroMovieEffectsStage`; non-movie modes continue to write only `#stage.style.transform` through their existing code.

- [ ] **Step 1: Add failing structural and CSS contracts for the dedicated clip**

In `tools/hero-specimen-check.py`, immediately after the existing `clip_markup` assertions for the time gradients, add:

```python
movie_layer = re.search(
    r'<div class="heroMovieEffectsClip" id="heroMovieEffectsClip" aria-hidden="true">\s*'
    r'<div class="heroMovieEffectsStage" id="heroMovieEffectsStage"></div>\s*</div>',
    html,
)
assert movie_layer, "the Hero needs a dedicated movie-effects clip and stage host"
assert html.index('id="stage"') < movie_layer.start() < html.index("</section>", movie_layer.start())
for interactive_stage_node in ('id="face"', 'id="glasses"', 'class="mouth"', 'class="tongue"'):
    assert interactive_stage_node not in movie_layer.group(0), interactive_stage_node

movie_clip_rule = re.search(r'\.heroMovieEffectsClip\s*\{.*?\}', html, re.S)
assert movie_clip_rule
for clip_contract in (
    "position:absolute",
    "inset:0",
    "overflow:clip",
    "border-radius:inherit",
    "corner-shape:inherit",
    "pointer-events:none",
):
    assert clip_contract in movie_clip_rule.group(0), clip_contract
for scroll_container_rule in ("overflow:hidden", "overflow:auto", "overflow:scroll", "overflow-y:auto"):
    assert scroll_container_rule not in movie_clip_rule.group(0), scroll_container_rule

movie_stage_rule = re.search(r'\.heroMovieEffectsStage\s*\{.*?\}', html, re.S)
assert movie_stage_rule
for stage_contract in (
    "position:absolute",
    "width:0",
    "height:0",
    "transform-origin:50% 50%",
    "pointer-events:none",
):
    assert stage_contract in movie_stage_rule.group(0), stage_contract
```

Keep the existing `hero-time.css` assertion at line 130 unchanged:

```python
assert "overflow:visible" in hero_rule.group(0), "the clipped gradient child, not the hero, must own overflow"
```

This assertion is also the regression contract for both menus: no implementation step may restore `overflow:hidden`, `overflow:auto`, or `overflow:scroll` on `.hero`.

- [ ] **Step 2: Run the static test and verify the shell contract fails**

Run:

```bash
python3 tools/hero-specimen-check.py
```

Expected: FAIL with `AssertionError: the Hero needs a dedicated movie-effects clip and stage host` because neither new node exists yet.

- [ ] **Step 3: Add the non-interactive, non-scrolling clip shell**

In `index.html`, place the following rules immediately after the existing `.popcrumb` / `.popbucket` / `.kernel` declarations so the popcorn feature's CSS remains together:

```css
.heroMovieEffectsClip{position:absolute;inset:0;z-index:2;overflow:clip;border-radius:inherit;corner-shape:inherit;pointer-events:none}
.heroMovieEffectsStage{position:absolute;left:0;top:0;width:0;height:0;transform-origin:50% 50%;pointer-events:none;will-change:transform}
```

Do not add `contain:paint`: `overflow:clip` already supplies the paint boundary without creating a scroll container, while the inherited radius and `corner-shape` make that boundary coincide with all four Hero edges. `z-index:2` keeps the movie props above the same-z-index portrait wrapper because the new layer is later in Hero DOM order, but below the headline (`z-index:3`), scroll cue (`z-index:4`), CTA/menu controls (`z-index:8+`), and rim (`z-index:10`).

As the final child of `#main`, immediately after the current `.stagewrap` closes and before `</section>`, insert exactly:

```html
  <div class="heroMovieEffectsClip" id="heroMovieEffectsClip" aria-hidden="true"><div class="heroMovieEffectsStage" id="heroMovieEffectsStage"></div></div>
```

Do not move or wrap the existing `.stagewrap`, `#stageMorph`, `#stage`, `#face`, `#heroTimePortraitCast`, `.tongue`, or `#glasses` markup. The new nodes are absolutely positioned and therefore add no grid item, height, width, margin, padding, or scroll geometry.

- [ ] **Step 4: Run the static test and verify the shell contract passes**

Run:

```bash
python3 tools/hero-specimen-check.py
```

Expected: PASS and print `hero specimen structure: OK`. At this checkpoint the empty clip is inert; the visible performance is still unchanged because `hero-engine.js` has not routed anything into it.

- [ ] **Step 5: Add failing contracts for effect routing, geometry synchronization, cleanup, and reduced motion**

In `tools/hero-specimen-check.py`, replace the current popcorn comment/assertion block at lines 304-317 with the following complete contract block. Keep the final `print(...)` after it.

```python
# Case-study covers and Extras/reel reuse one popcorn/glasses performance.
# Only the three movie-prop families move to the rounded Hero clip; the face,
# glasses, mouth, tongue, eyes, trigger timing, and cleanup state machine stay put.
movie_section = engine[engine.index("/* ===== popcorn movie-watching mode"):engine.index("function startRain()")]
assert 'document.getElementById("heroMovieEffectsStage")' in movie_section

ensure_movie = re.search(r"function ensureMovieEls\(\)\{.*?\n\}", movie_section, re.S)
assert ensure_movie
assert "var host=movieEffectsStage||stage;" in ensure_movie.group(0)
assert ensure_movie.group(0).count("host.appendChild(") == 3
for legacy_mount in (
    "stage.appendChild(bucketEl)",
    "stage.appendChild(k)",
    "stage.appendChild(cc)",
):
    assert legacy_mount not in ensure_movie.group(0), legacy_mount
for unchanged_population in ("i<7", "j<12"):
    assert unchanged_population in ensure_movie.group(0), unchanged_population

sync_movie = re.search(r"function syncMovieEffectsLayer\(\)\{.*?\n\}", movie_section, re.S)
assert sync_movie
for sync_contract in (
    "stage.getBoundingClientRect()",
    "movieEffectsStage.parentNode.getBoundingClientRect()",
    'stage.style.transform="none"',
    "stage.style.transform=priorTransform",
    'movieEffectsStage.style.left=(stageRect.left-clipRect.left).toFixed(2)+"px"',
    'movieEffectsStage.style.top=(stageRect.top-clipRect.top).toFixed(2)+"px"',
    'movieEffectsStage.style.width=stageRect.width.toFixed(2)+"px"',
    'movieEffectsStage.style.height=stageRect.height.toFixed(2)+"px"',
):
    assert sync_contract in sync_movie.group(0), sync_contract

transform_movie = re.search(r"function setMovieStageTransform\(value\)\{.*?\n\}", movie_section, re.S)
assert transform_movie
assert "stage.style.transform=value;" in transform_movie.group(0)
assert "movieEffectsStage.style.transform=value;" in transform_movie.group(0)

start_movie = re.search(r"function startMovie\(word\)\s*\{.*?\n\}", movie_section, re.S)
assert start_movie
assert start_movie.group(0).index("glassesOn();") < start_movie.group(0).index("if(reduce||introMode||CALIB||movieMode)return;")
assert start_movie.group(0).index("ensureMovieEls();") < start_movie.group(0).index("syncMovieEffectsLayer();")

for mirrored_transform in (
    'setMovieStageTransform("")',
    'setMovieStageTransform("scale("+(ht===0?1.04:1.0)+")")',
    'setMovieStageTransform("translateY("+hb.toFixed(1)+"px)")',
    'setMovieStageTransform("translateX("+sh.toFixed(1)+"px) rotate("+(sh*0.4).toFixed(2)+"deg)")',
    'setMovieStageTransform("translateY("+ty.toFixed(1)+"px) rotate("+rot.toFixed(2)+"deg) scale("+sx.toFixed(3)+","+sy.toFixed(3)+")")',
    'setMovieStageTransform("scale("+pop+")")',
    'setMovieStageTransform("translateY("+ty.toFixed(1)+"px) rotate("+rot.toFixed(2)+"deg)")',
):
    assert mirrored_transform in movie_section, mirrored_transform

caught_movie = re.search(r"function caughtMovie\(\)\{.*?\n\}", movie_section, re.S)
cleanup_movie = re.search(r"function endMovieCleanup\(\)\{.*?\n\}", movie_section, re.S)
assert caught_movie and "if(movieEnding)return;" in caught_movie.group(0)
assert cleanup_movie
for cleanup_contract in (
    "movieMode=false",
    "movieEnding=false",
    "movieHair=false",
    'bucketEl.style.opacity="0"',
    'kernelEls[i].style.opacity="0"',
    'kernelEls[i]._dropping=false',
    'kernelEls[i]._htx=null',
    'popcrumbEls[i]._alive=false',
    'popcrumbEls[i].style.opacity="0"',
    "glassesOff()",
    'setMovieStageTransform("")',
):
    assert cleanup_contract in cleanup_movie.group(0), cleanup_contract

assert re.search(r"function glassesOn\(\).*?classList\.add\(\"on\"\)", engine, re.S)
assert "function glOn()" not in engine

case_enter = re.search(r"function enter\(f,e\)\{.*?\}\s*// project cards", html, re.S)
assert case_enter and "startMovie(csw)" in case_enter.group(0)
assert 'activeHover="smile"' not in case_enter.group(0)
case_leave = re.search(r"function leave\(f\)\{.*?\}\n", html, re.S)
assert case_leave and "caughtMovie()" in case_leave.group(0)
assert re.search(r'frame\.addEventListener\("pointerenter".*?startMovie\(\)', engine, re.S)
assert re.search(r'frame\.addEventListener\("pointerleave".*?caughtMovie\(\)', engine, re.S)
```

The string-level contract is deliberate here: this repository's existing Hero test is a source/markup contract, `hero-engine.js` is a page-executing dual-host script rather than an importable module, and introducing a parallel test-only runtime or production module would violate the one-engine constraint.

- [ ] **Step 6: Run the static test and verify effect routing fails**

Run:

```bash
python3 tools/hero-specimen-check.py
```

Expected: FAIL at `assert 'document.getElementById("heroMovieEffectsStage")' in movie_section` because movie mode still mounts all props directly into `#stage`.

- [ ] **Step 7: Resolve the optional stage host and add the two containment helpers**

In `hero-engine.js`, extend the existing stage/face/headline declaration at line 47 without changing those three bindings:

```js
const stage=document.getElementById("stage"),faceImg=document.getElementById("face"),h1=document.getElementById("h1");
const movieEffectsStage=document.getElementById("heroMovieEffectsStage");
```

Immediately after the movie-mode state declaration and before `glassesOn()`, add:

```js
function syncMovieEffectsLayer(){
 if(!movieEffectsStage)return;
 var priorTransform=stage.style.transform;
 stage.style.transform="none";
 var stageRect=stage.getBoundingClientRect(),clipRect=movieEffectsStage.parentNode.getBoundingClientRect();
 stage.style.transform=priorTransform;
 movieEffectsStage.style.left=(stageRect.left-clipRect.left).toFixed(2)+"px";
 movieEffectsStage.style.top=(stageRect.top-clipRect.top).toFixed(2)+"px";
 movieEffectsStage.style.width=stageRect.width.toFixed(2)+"px";
 movieEffectsStage.style.height=stageRect.height.toFixed(2)+"px";
 movieEffectsStage.style.transform=priorTransform;
}
function setMovieStageTransform(value){
 stage.style.transform=value;
 if(movieEffectsStage)movieEffectsStage.style.transform=value;
}
```

`syncMovieEffectsLayer()` briefly measures the stage with its movie transform removed, restores that transform synchronously before paint, and writes only `left`, `top`, `width`, and `height` to the absolutely positioned host. Subtracting the clip rectangle keeps the values stable across page scroll. The helper must not write any Hero, stage-wrapper, menu, document, or viewport overflow property.

- [ ] **Step 8: Route the existing movie props into the effect host**

Replace `ensureMovieEls()` with this exact implementation; retain its lazy singleton behavior and its existing counts/assets/classes:

```js
function ensureMovieEls(){
 if(bucketEl)return;
 var host=movieEffectsStage||stage;
 bucketEl=document.createElement("img");bucketEl.className="popbucket";bucketEl.src="images/bucket.webp";bucketEl.alt="";bucketEl.style.opacity="0";host.appendChild(bucketEl);
 for(var i=0;i<7;i++){var k=document.createElement("img");k.className="kernel";k.src="images/kernel.webp";k.alt="";k.style.opacity="0";host.appendChild(k);kernelEls.push(k);}
 for(var j=0;j<12;j++){var cc=document.createElement("div");cc.className="popcrumb";host.appendChild(cc);popcrumbEls.push(cc);}
}
```

The `movieEffectsStage || stage` fallback is required because the same file runs in `play.html` head-only mode, where the Home-only clip markup is absent. Do not route general eating crumbs (`crumbEls`), moustache crumbs, heart eyes, mouth/tongue, or glasses into this host; they belong to other interactions or must retain their face-relative stacking.

In `startMovie(word)`, place synchronization immediately after lazy element creation:

```js
 ensureMovieEls();
 syncMovieEffectsLayer();
```

Do not move `glassesOn()` below the reduced-motion guard, do not change the guard, and do not change the order in which competing modes are ended.

- [ ] **Step 9: Mirror every movie-owned face transform into the effect host**

Within the popcorn movie section only—from `endMovieCleanup()` through `hairTick()` and `movieTick()`—replace each movie-owned write to `stage.style.transform` with `setMovieStageTransform(...)`. The resulting exact calls are:

```js
 setMovieStageTransform("");
```

in `endMovieCleanup()`;

```js
 if(ht<3){if(curFace!=="rest")setFace("rest");mouthimg.style.opacity="0";gaze.x=0;gaze.y=-0.18;updateIris();setMovieStageTransform("scale("+(ht===0?1.04:1.0)+")");}
 else if(ht<39){if(curFace!=="neutral")setFace("neutral");gaze.x=0.04*Math.sin(tk*0.2);gaze.y=-0.16;updateIris();var hb=Math.sin(tk*0.5)*1.0;setMovieStageTransform("translateY("+hb.toFixed(1)+"px)");}
 else{var sh=Math.sin((ht-39)*1.7)*(7*Math.max(0,1-(ht-39)/9));gaze.x=0;gaze.y=0.04;updateIris();setMovieStageTransform("translateX("+sh.toFixed(1)+"px) rotate("+(sh*0.4).toFixed(2)+"deg)");}
```

in `hairTick()`; and:

```js
  setMovieStageTransform("translateY("+ty.toFixed(1)+"px) rotate("+rot.toFixed(2)+"deg) scale("+sx.toFixed(3)+","+sy.toFixed(3)+")");
```

for the active movie pose;

```js
   var pop=et===0?1.05:et===1?1.02:1.0;setMovieStageTransform("scale("+pop+")");if(bucketEl)bucketEl.style.transform="translateX(-50%)";return;}
```

for the first three ending ticks; and:

```js
 setMovieStageTransform("translateY("+ty.toFixed(1)+"px) rotate("+rot.toFixed(2)+"deg)");
```

for the throw-away ending pose.

Do not replace transforms outside this movie section: party, love, rain, eating, idle, intro, and direct manipulation own only the real `#stage`, and no movie prop is visible during them.

- [ ] **Step 10: Run the focused contract and syntax checks**

Run:

```bash
python3 tools/hero-specimen-check.py
node --check hero-engine.js
```

Expected:

```text
hero specimen structure: OK
```

and no output from `node --check`.

- [ ] **Step 11: Run the complete existing Hero regression suite**

Run:

```bash
python3 tools/hero-specimen-check.py
node tools/hero-time-model.test.js
node tools/hero-time-controller.test.js
node --check hero-engine.js
node --check hero-time.js
git diff --check
```

Expected: the Python test prints `hero specimen structure: OK`, the controller test prints `hero time controller behavior: OK`, both Node model/controller processes exit 0, both syntax checks produce no output, and `git diff --check` produces no output.

- [ ] **Step 12: Inspect the implementation diff before browser verification**

Run:

```bash
git diff -- index.html hero-engine.js tools/hero-specimen-check.py
git status --short
```

Expected: only those three files are modified. Confirm the diff contains no `.hero` overflow change, no menu geometry change, no particle count/timing/coordinate change, no moved face/glasses/mouth/tongue markup, and no modifications to `MOVCYCLE`, `setKernel()`, `setCrumb()`, `caughtMovie()` timing, or the case/reel trigger functions.

- [ ] **Step 13: Commit the independently testable containment change**

```bash
git add index.html hero-engine.js tools/hero-specimen-check.py
git commit -m "Contain Hero popcorn effects"
```

### Task 2: Verify containment, menu reachability, cleanup, themes, and motion modes in a real browser

**Files:**
- Test only: `index.html`

**Interfaces:**
- Consumes: the completed `#heroMovieEffectsClip`, `#heroMovieEffectsStage`, existing Time/Mood buttons and menus, case-card hover triggers, Extras/reel hover trigger, `startMovie(word)`, and `caughtMovie()`.
- Produces: browser evidence that the effect clip matches the Hero on all four edges, both menus remain outside the Hero's paint boundary and fully reachable, no scroll container or horizontal overflow was introduced, repeated entry/exit cleans up, and light/Night/reduced-motion behavior is unchanged.

- [ ] **Step 1: Serve the worktree without changing repository files**

From the worktree root, run:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/index.html` in a browser with DevTools. Keep the server terminal running only for this verification task.

- [ ] **Step 2: Verify the clip box, overflow modes, and page width at desktop size**

At 1280 × 900 with normal motion, run this exact DevTools Console probe:

```js
(() => {
  const hero = document.getElementById("main");
  const clip = document.getElementById("heroMovieEffectsClip");
  const effectsStage = document.getElementById("heroMovieEffectsStage");
  const hr = hero.getBoundingClientRect();
  const cr = clip.getBoundingClientRect();
  const near = (a, b) => Math.abs(a - b) <= 0.5;
  return {
    heroOverflow: getComputedStyle(hero).overflow,
    clipOverflow: getComputedStyle(clip).overflow,
    clipPointerEvents: getComputedStyle(clip).pointerEvents,
    allFourEdgesMatch: near(hr.top, cr.top) && near(hr.right, cr.right) && near(hr.bottom, cr.bottom) && near(hr.left, cr.left),
    heroScrollTop: hero.scrollTop,
    clipScrollTop: clip.scrollTop,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    effectHostChildCount: effectsStage.childElementCount
  };
})()
```

Expected before the first movie hover:

```js
{
  heroOverflow: "visible",
  clipOverflow: "clip",
  clipPointerEvents: "none",
  allFourEdgesMatch: true,
  heroScrollTop: 0,
  clipScrollTop: 0,
  horizontalOverflow: false,
  effectHostChildCount: 0
}
```

- [ ] **Step 3: Verify the full Case Studies performance and contextual words**

At 1280 × 900 and again at 1024 × 768, hover each visible case-study cover, then leave it after at least one full eat cycle. Verify:

- Bearings still starts `Bears?`.
- UC Davis still starts `Joy..`.
- Apollo, Strata, and Cluster still start `Motion.`.
- Each starts the same glasses entrance, bucket entrance, kernel-to-mouth motion, crumbs, mouth/tongue behavior, and ending throw as before.
- The face, glasses, mouth, tongue, eyes, headline, CTA controls, and Hero rim retain their prior stacking.
- Bucket, kernels, and popcorn crumbs may move anywhere within the Hero, but no colored pixel from those three families paints beyond the rounded top, right, bottom, or left outline.
- Head/face transforms and the mirrored effect transform remain locked together during bob, squash, shake, wink, and ending rotation.

After the first hover, rerun the Console probe from Step 2. Expected `effectHostChildCount: 20` (one bucket + seven kernels + twelve crumbs), with every other value unchanged.

- [ ] **Step 4: Verify the Extras/reel trigger and scrolling**

Select the `Extras` tab, hover the reel on a fine-pointer viewport, and then leave it. Verify it starts the same full movie performance with the default `Motion.` word and uses the same cleanup path as the case covers. Scroll away from and back to the Hero, rerun the Step 2 probe, and confirm `allFourEdgesMatch: true`, `heroScrollTop: 0`, and `horizontalOverflow: false` before, during, and after the performance.

- [ ] **Step 5: Stress rapid entry/exit and verify no stranded props**

Rapidly cross into and out of one case cover at least ten times, including re-entering while the ending animation is already running. Wait until the existing ending sequence finishes, then run:

```js
(() => {
  const nodes = [...document.querySelectorAll("#heroMovieEffectsStage .popbucket, #heroMovieEffectsStage .kernel, #heroMovieEffectsStage .popcrumb")];
  return {
    count: nodes.length,
    visible: nodes.filter(node => Number.parseFloat(getComputedStyle(node).opacity) > 0).length,
    activeCrumbs: nodes.filter(node => node.classList.contains("popcrumb") && node._alive === true).length,
    droppingKernels: nodes.filter(node => node.classList.contains("kernel") && node._dropping === true).length,
    glassesOn: document.getElementById("glasses").classList.contains("on")
  };
})()
```

Expected after cleanup:

```js
{count: 20, visible: 0, activeCrumbs: 0, droppingKernels: 0, glassesOn: false}
```

- [ ] **Step 6: Verify Daytime/light and Night painting**

Use the Time menu to test `Daytime` and `Night`. In each state, repeat one case hover and one Extras/reel hover. Verify the gradient remains behind the portrait/effects, the Hero rim stays above them, the popcorn clip follows the same rounded Hero outline, the shared site theme remains unchanged while scrolling through the work boundary, and neither state introduces horizontal overflow.

- [ ] **Step 7: Verify both menus at 390 × 844**

In responsive mode at 390 × 844:

1. Open Mood, focus/click the first and last rows, and confirm all four rows are reachable.
2. Open Time, focus/click Automatic and Night, and confirm all eight rows are reachable.
3. Scroll the page as needed but do not accept scrolling inside the Hero itself.
4. Run the Step 2 Console probe.

Expected: `heroOverflow: "visible"`, `clipOverflow: "clip"`, `allFourEdgesMatch: true`, `heroScrollTop: 0`, `clipScrollTop: 0`, and `horizontalOverflow: false`.

- [ ] **Step 8: Repeat the menu regression at 320 × 800**

Repeat all four actions from Step 7 at 320 × 800. Also press Escape while each menu is open and verify focus returns to its trigger. Expected: every Mood and Time row remains reachable, neither menu is cut off at a rounded Hero edge, `hero.scrollTop` remains `0`, and `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.

- [ ] **Step 9: Verify reduced motion keeps the existing simplified behavior**

Enable `prefers-reduced-motion: reduce`, reload, and hover a case cover on a fine-pointer desktop viewport. Verify the glasses state still follows the existing reduced-motion CSS, no bucket/kernel/crumb nodes are created (`effectHostChildCount: 0`), no particle animation starts, the clip remains inert and non-interactive, and both menus still open outside the Hero.

- [ ] **Step 10: Re-run automated checks after browser verification**

Stop the local server with Ctrl-C, then run:

```bash
python3 tools/hero-specimen-check.py
node tools/hero-time-model.test.js
node tools/hero-time-controller.test.js
node --check hero-engine.js
node --check hero-time.js
git diff --check
git status --short
```

Expected: all checks pass, and the worktree is clean after Task 1's commit. If browser verification exposed a defect, fix it through a fresh red/green addition to `tools/hero-specimen-check.py`, repeat the affected browser step, and commit that narrowly scoped correction separately.

---

## Acceptance Checklist

- `.hero` computes to `overflow:visible`; neither menu is made a Hero descendant scroll problem.
- `#heroMovieEffectsClip` exactly matches all four Hero border-box edges, inherits radius/corner shape, uses `overflow:clip`, receives no pointer events, and contributes no layout size.
- Only `.popbucket`, `.kernel`, and `.popcrumb` runtime nodes are mounted in `#heroMovieEffectsStage` on Home.
- The one bucket, seven kernels, twelve crumbs, their percentage coordinates, `MOVCYCLE=18`, and the master clock are unchanged.
- Every movie-owned `#stage` transform is mirrored verbatim to the effects host; other mood/intro/idle transforms are untouched.
- Face, portrait cast, glasses, mouth, tongue, and eyes remain in the existing `#stage` markup and retain their existing code paths.
- Case covers preserve `Bears?`, `Joy..`, `Motion.`, and `You..?` mappings; Extras/reel preserves the default movie word.
- Cleanup hides the bucket and every particle, clears `_dropping`, `_htx`, and `_alive`, removes the glasses `on` state, and tolerates repeated entry/exit.
- Reduced motion creates no popcorn nodes and starts no particle animation.
- Daytime/light and Night states preserve gradients, rim, site-wide header theming, scrolling, and containment.
- At 390 × 844 and 320 × 800, all Mood/Time rows remain reachable, `hero.scrollTop === 0`, `clip.scrollTop === 0`, and no horizontal overflow appears.
