# Time-of-day Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a device-time-aware lighting system spanning the header and outlined hero with six layered FluidMesh scenes, manual selection, a strict zero-gradient Off state, and portrait-integrated light.

**Architecture:** Extract the existing no-dependency `FluidMesh` renderer into a shared browser script, then add a pure preset/time model and a DOM controller dedicated to the home hero. Keep presentation in one focused stylesheet and portrait synchronization in a small adapter so Mood remains the sole owner of face changes.

**Visual research:** Apply `docs/superpowers/research/2026-08-06-stripe-hero-gradient.md` during Tasks 5–7.

**Tech Stack:** Semantic HTML, token-driven CSS, vanilla JavaScript, WebGL 1, OKLab color interpolation, Python static contracts, Node.js unit tests, existing browser preview.

## Global Constraints

- Scope is the home-page header plus outlined hero as one continuous, page-anchored lighting scene, visually analogous to the existing Delight overlay. Stop the scene before work tabs; do not theme case studies or footer.
- Preserve the approved hero dimensions, larger portrait, headline wrapping, CTA positions, smooth View work scroll, and hero-to-tabs spacing.
- Add no framework, package, network request, geolocation request, or third-party dependency.
- Modes are exactly `auto`, `off`, `pre-dawn`, `sunrise`, `daytime`, `dusk`, `sunset`, and `night`.
- Automatic mapping is 04:00 Pre-dawn, 06:00 Sunrise, 09:00 Daytime, 17:00 Dusk, 18:30 Sunset, and 20:30 Night using the device clock.
- Store manual mode under `jbHeroTimeMode` in `sessionStorage`; a new browser session defaults to Automatic.
- Visual transitions last 800 ms and retarget from the current interpolated state.
- WebGL is decorative: forced colors suppresses it, reduced motion renders still frames, and failure uses layered CSS fallbacks. Off removes every time layer plus the original light-blue `.heroAura`; it retains only neutral surfaces, portrait, controls, and outlines.
- Desktop FluidMesh DPR uses its existing 2.25 cap; coarse-pointer/mobile uses 1.5.
- The Time control is icon-only, at least 44 × 44 px, immediately after Mood, keyboard operable, and clamped to a 16 px viewport gutter.
- Preserve all unrelated working-tree edits, especially the approved popcorn/glasses hover work and media-outline/mobile-gutter work. Never stage `.superpowers/`.

---

## File map

- Create `fluid-mesh.js`: shared `window.FluidMesh(canvas, cfg)` WebGL runtime, extracted without shader changes.
- Create `hero-time-presets.js`: pure state mapping, immutable visual presets, OKLab interpolation, and CommonJS exports for tests.
- Create `hero-time.css`: Time control/menu, hero state variables, layered CSS fallbacks, canvas/bloom, portrait cast, and responsive/forced-color rules.
- Create `hero-time.js`: menu, persistence, automatic boundary timer, FluidMesh lifecycle, transition retargeting, and visibility handling.
- Create `hero-portrait-light.js`: mirrors the active face source into the clipped portrait-lighting layer.
- Create `tools/hero-time-model.test.js`: Node tests for boundaries, normalization, interpolation, and next-boundary timing.
- Create `tools/fluid-mesh-check.py`: extraction and public-runtime contract.
- Modify `gradientlab.html`: load shared renderer and remove the inline renderer definition only.
- Modify `index.html`: load new assets and add hero canvas, bloom, Time menu, and portrait-cast markup.
- Modify `tools/hero-specimen-check.py`: static hero/time integration contract while retaining existing popcorn/glasses assertions.

---

### Task 1: Extract the shared FluidMesh runtime

**Files:**
- Create: `fluid-mesh.js`
- Create: `tools/fluid-mesh-check.py`
- Modify: `gradientlab.html:649-1060`

**Interfaces:**
- Consumes: the exact existing `function FluidMesh(canvas, cfg)` implementation in `gradientlab.html`.
- Produces: `window.FluidMesh(canvas: HTMLCanvasElement, cfg: FluidMeshConfig) -> FluidMeshHandle | null`.
- `FluidMeshHandle` exposes `set(next)`, `pause()`, `resume()`, `renderOnce()`, `destroy()`, `time()`, `snapshot(w,h)`, and `canvas`.
- Optional `cfg.onError(error)` receives construction or context-restoration failures; the renderer otherwise remains domain-agnostic.

- [ ] **Step 1: Write the failing extraction contract**

```python
# tools/fluid-mesh-check.py
from pathlib import Path

lab = Path("gradientlab.html").read_text(encoding="utf-8")
runtime = Path("fluid-mesh.js").read_text(encoding="utf-8")

assert '<script src="fluid-mesh.js"></script>' in lab
assert "function FluidMesh(canvas,cfg)" not in lab
assert "function FluidMesh(canvas,cfg)" in runtime
for method in ("set:", "pause:", "resume:", "renderOnce:", "destroy:", "snapshot:"):
    assert method in runtime, method
assert "window.FluidMesh=FluidMesh" in runtime
print("fluid mesh extraction: OK")
```

- [ ] **Step 2: Run the contract and verify RED**

Run: `python3 tools/fluid-mesh-check.py`  
Expected: FAIL because `fluid-mesh.js` does not exist.

- [ ] **Step 3: Extract the renderer without changing its shader**

Move the complete renderer comment and `FluidMesh` function from `gradientlab.html` into `fluid-mesh.js`, wrap it in an IIFE, and end with:

```js
window.FluidMesh=FluidMesh;
```

Extend the existing render-loop state with:

```js
var paused=false;
function pause(){paused=true;if(raf){cancelAnimationFrame(raf);raf=0;}}
function resume(){if(dead)return;paused=false;kick();}
function renderOnce(){if(dead)return;main.render(t,cfg,cfg.edgeF||0);}
```

Make `kick()` and the tail of `frame()` honor `paused`, and add these methods to the returned handle without changing existing methods. Load `<script src="fluid-mesh.js"></script>` immediately before Gradient Maker's controller script.

Wrap initial `setup()` and the `webglcontextrestored` callback in `try/catch`. On failure, mark the renderer lost, cancel RAF, invoke `cfg.onError(error)` when it is a function, and return `null` from initial construction. Do not add hero-specific classes or state names to this shared runtime.

Replace the renderer's fixed DPR lookup with `Math.min(window.devicePixelRatio||1,cfg.dprCap||2.25)` in both canvas sizing and the `uDpr` uniform. Existing Gradient Maker configs omit `dprCap` and therefore remain at 2.25; the hero passes 1.5 on coarse pointers.

- [ ] **Step 4: Verify extraction and Gradient Maker syntax**

Run:

```bash
python3 tools/fluid-mesh-check.py
node --check fluid-mesh.js
python3 - <<'PY'
from html.parser import HTMLParser
HTMLParser().feed(open('gradientlab.html', encoding='utf-8').read())
print('gradientlab parse: OK')
PY
```

Expected: all commands exit 0.

- [ ] **Step 5: Browser-smoke Gradient Maker**

Open `gradientlab.html`, change Preset twice, move one node control, and export one still. Confirm the canvas changes, no console error occurs, and export remains enabled.

- [ ] **Step 6: Commit the renderer extraction**

```bash
git add fluid-mesh.js gradientlab.html tools/fluid-mesh-check.py
git commit -m "Extract shared FluidMesh runtime"
```

---

### Task 2: Build and test the pure time/preset model

**Files:**
- Create: `hero-time-presets.js`
- Create: `tools/hero-time-model.test.js`

**Interfaces:**
- Produces `HeroTimeModel.MODES`, `STATES`, `PRESETS`, `normalizeMode(value)`, `resolveAutomatic(date)`, `resolveState(mode,date)`, `msUntilNextBoundary(date)`, and `interpolatePreset(from,to,t)`.
- `interpolatePreset` returns a fresh FluidMesh config; it never mutates either input.

- [ ] **Step 1: Write boundary and preference tests**

```js
// tools/hero-time-model.test.js
const assert=require("node:assert/strict");
const M=require("../hero-time-presets.js");
const at=(h,m=0)=>new Date(2026,7,6,h,m,0,0);

[[3,59,"night"],[4,0,"pre-dawn"],[6,0,"sunrise"],
 [9,0,"daytime"],[17,0,"dusk"],[18,30,"sunset"],
 [20,30,"night"],[23,59,"night"]].forEach(([h,m,want])=>
  assert.equal(M.resolveAutomatic(at(h,m)),want));

assert.equal(M.normalizeMode("sunset"),"sunset");
assert.equal(M.normalizeMode("garbage"),"auto");
assert.equal(M.resolveState("off",at(12)),"off");
assert.equal(M.resolveState("auto",at(12)),"daytime");
assert.equal(M.msUntilNextBoundary(at(5,59)),60_000);
assert.ok(Object.isFrozen(M.PRESETS));
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node tools/hero-time-model.test.js`  
Expected: FAIL with `Cannot find module '../hero-time-presets.js'`.

- [ ] **Step 3: Implement exact modes, boundaries, and immutable presets**

Use a UMD-style export so browser and Node share one implementation:

```js
(function(root,factory){
 var api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.HeroTimeModel=api;
})(typeof window!=="undefined"?window:globalThis,function(){
 "use strict";
 var MODES=Object.freeze(["auto","off","pre-dawn","sunrise","daytime","dusk","sunset","night"]);
 var STATES=Object.freeze(MODES.slice(2));
 // Return the public API listed above.
});
```

Use these initial five-color directions:

```js
var COLORS={
 "pre-dawn":["#071329","#142C54","#243B79","#6B6FAF","#C7D6FF"],
 sunrise:["#F6F9FF","#BCD8FF","#FFD4B8","#F1A36B","#FFF0D4"],
 daytime:["#F8FBFF","#DCEEFF","#A9D6FF","#74B6F2","#EEF7FF"],
 dusk:["#10162A","#26365C","#676F9F","#B2A7D1","#E6D9E9"],
 sunset:["#19172B","#3C315D","#D56C76","#F0A06F","#FFD5B8"],
 night:["#050810","#0A1530","#102A58","#1D4A93","#6FA9FF"]
};
```

Each preset has five normalized nodes concentrated between `y:.72` and `y:1.10`, `form:1`, `layer:.72`, `melt:.38`, `wob:.12`, `contour:.12`, `grain:.025`, `flow:.10`, and state-specific `glow`, `expo`, `light`, and colors. Deep-freeze every preset.

- [ ] **Step 4: Add interpolation tests**

```js
const a=M.PRESETS.sunrise,b=M.PRESETS.night;
assert.deepEqual(M.interpolatePreset(a,b,0),a);
assert.deepEqual(M.interpolatePreset(a,b,1),b);
const mid=M.interpolatePreset(a,b,.5);
assert.notDeepEqual(mid.colors,a.colors);
assert.equal(mid.nodes.length,5);
assert.equal(a.nodes[0].x,M.PRESETS.sunrise.nodes[0].x);
```

- [ ] **Step 5: Implement OKLab color and numeric interpolation**

Implement private `hexToOklab`, `oklabToHex`, `mixHex`, `mixNumber`, and `mixNode` helpers using the same sRGB transfer and OKLab matrices already present in the FluidMesh shader. Clamp `t` to `[0,1]`; return exact deep clones at endpoints so the endpoint assertions remain stable.

- [ ] **Step 6: Run model tests and syntax checks**

Run:

```bash
node tools/hero-time-model.test.js
node --check hero-time-presets.js
```

Expected: both exit 0.

- [ ] **Step 7: Commit the pure model**

```bash
git add hero-time-presets.js tools/hero-time-model.test.js
git commit -m "Add hero time state model"
```

---

### Task 3: Add semantic markup and token-driven fallback styling

**Files:**
- Create: `hero-time.css`
- Modify: `index.html:1421-1508,1591-1595,1728`
- Modify: `tools/hero-specimen-check.py`

**Interfaces:**
- Produces DOM ids `heroTimeCanvas`, `heroTimeBloom`, `heroTimeBtn`, `heroTimeMenu`, `heroTimeIcon`, and `heroTimePortraitCast`.
- Time state is exposed as `data-time-mode` and `data-time-state` on `#main` and mirrored on `body` so the shared header-plus-hero scene never depends on `:has()`.

- [ ] **Step 1: Extend the static contract and verify RED**

Add assertions:

```python
assert '<link rel="stylesheet" href="hero-time.css">' in html
for node_id in ("heroTimeCanvas","heroTimeBloom","heroTimeBtn","heroTimeMenu","heroTimePortraitCast"):
    assert f'id="{node_id}"' in html, node_id
assert re.search(r'id="heroTimeBtn"[^>]+aria-controls="heroTimeMenu"', html)
assert html.index('id="moodbar"') < html.index('id="heroTimeBtn"') < html.index('class="stagewrap"')
assert html.count('data-time-mode=') == 8
```

Run: `python3 tools/hero-specimen-check.py`  
Expected: FAIL at the missing stylesheet assertion.

- [ ] **Step 2: Add the hero layers and Time menu**

Inside `#main`, place canvas and bloom before `.heroCopy`. Add the Time control after `#moodbar`:

```html
<div class="heroTime" id="heroTime">
 <button class="heroTimeBtn" id="heroTimeBtn" type="button" aria-label="Time of day" aria-haspopup="menu" aria-expanded="false" aria-controls="heroTimeMenu">
  <svg class="heroTimeIcon" id="heroTimeIcon" viewBox="0 0 24 24" aria-hidden="true"><!-- fixed icon groups selected by data-icon --></svg>
 </button>
 <div class="heroTimeMenu" id="heroTimeMenu" role="menu" aria-label="Choose time of day">
  <button role="menuitemradio" aria-checked="true" data-time-mode="auto">Automatic <small id="heroTimeAutoState"></small></button>
  <button role="menuitemradio" aria-checked="false" data-time-mode="off">Off</button>
  <button role="menuitemradio" aria-checked="false" data-time-mode="pre-dawn">Pre-dawn</button>
  <button role="menuitemradio" aria-checked="false" data-time-mode="sunrise">Sunrise</button>
  <button role="menuitemradio" aria-checked="false" data-time-mode="daytime">Daytime</button>
  <button role="menuitemradio" aria-checked="false" data-time-mode="dusk">Dusk</button>
  <button role="menuitemradio" aria-checked="false" data-time-mode="sunset">Sunset</button>
  <button role="menuitemradio" aria-checked="false" data-time-mode="night">Night</button>
 </div>
</div>
```

Inside `.stage`, immediately after `#face`, add `<img id="heroTimePortraitCast" class="heroTimePortraitCast" alt="" aria-hidden="true">`.

- [ ] **Step 3: Add baseline and per-state CSS variables**

Define specimen defaults on `.hero` and state overrides on `.hero[data-time-state="…"]` for:

```css
--time-ink;--time-primary-bg;--time-primary-ink;--time-secondary-bg;
--time-secondary-ink;--time-rim;--time-bloom;--time-cast;
--time-cast-filter;--time-light-x;--time-shadow;
```

The fallback background for every active state uses at least three layered radial gradients originating below `70%`; Off sets canvas/bloom/cast opacity to `0` and restores the existing variables exactly. Dark states make `.workCta` the light primary while Mood and Time remain secondary.

- [ ] **Step 4: Add deterministic menu, responsive, and accessibility CSS**

Style the menu from tokens, right-aligned below the icon button, with `.opensAbove` as the only alternate placement. Draw the selected check with `[role="menuitemradio"][aria-checked="true"]::before`; do not add a second decorative icon to unselected rows. Add 44 px targets, 16 px mobile clamping, `@media(max-width:760px)`, `@media(prefers-reduced-motion:reduce)`, and `@media(forced-colors:active)` rules. Canvas, bloom, and cast are `pointer-events:none`; no rule changes hero height or margins.

- [ ] **Step 5: Load assets in deterministic order**

Load `hero-time.css` after `header.css`. At the existing bottom script cluster load only the dependencies that exist at this task boundary:

```html
<script src="fluid-mesh.js"></script>
<script src="hero-time-presets.js"></script>
<script src="hero-engine.js"></script>
```

- [ ] **Step 6: Verify the static layout contract**

Run:

```bash
python3 tools/hero-specimen-check.py
python3 tools/token-audit.py
git diff --check
```

Expected: hero contract passes; token audit has 0 errors; diff check exits 0.

- [ ] **Step 7: Commit the semantic shell**

```bash
git add index.html hero-time.css tools/hero-specimen-check.py
git commit -m "Add hero time control shell"
```

---

### Task 4: Implement menu, persistence, and automatic clock behavior

**Files:**
- Create: `hero-time.js`
- Modify: `index.html`
- Modify: `tools/hero-time-model.test.js`
- Modify: `tools/hero-specimen-check.py`

**Interfaces:**
- Consumes `window.HeroTimeModel` and the Task 3 DOM ids.
- Produces `window.HeroTimeController` with `getMode()`, `getState()`, `setMode(mode)`, `refreshAutomatic()`, and `destroy()` for browser verification.

- [ ] **Step 1: Add timer/state tests to the pure model suite**

Add exact next-boundary assertions at 03:59, 18:29, and 20:30, plus `resolveState` checks for every manual mode. Run `node tools/hero-time-model.test.js` and confirm any missing edge behavior fails before implementation.

- [ ] **Step 2: Implement mode initialization and session persistence**

On init, read `sessionStorage.getItem("jbHeroTimeMode")`, normalize it, resolve the state, and set `data-time-mode`, `data-time-state`, the selected `aria-checked`, icon state, and `Automatic · State` copy. Catch storage errors and remain in Automatic.

`setMode(mode)` must:

```js
mode=M.normalizeMode(mode);
if(mode==="auto")sessionStorage.removeItem(KEY);
else sessionStorage.setItem(KEY,mode);
apply(mode,M.resolveState(mode,new Date()));
```

Load `<script src="hero-time.js"></script>` immediately after `hero-engine.js`, so the existing face engine initializes first. The portrait adapter is optional until Task 6.

- [ ] **Step 3: Implement accessible menu behavior**

Click/tap toggles the menu. Escape closes and focuses `heroTimeBtn`. ArrowUp/ArrowDown wrap through rows; Home/End jump to endpoints; Enter/Space select. Outside pointerdown closes. On open, measure the menu: add `.opensAbove` only when its bottom would exceed `innerHeight-16` and there is more space above. Set an inline horizontal translation only when needed to keep both edges at least 16 px from the viewport.

- [ ] **Step 4: Implement the automatic boundary timer**

Only Automatic owns a timeout. Schedule `M.msUntilNextBoundary(new Date())+50`, then call `refreshAutomatic()` and reschedule. Also refresh on `visibilitychange` when the page becomes visible. Manual and Off modes clear the timer.

- [ ] **Step 5: Extend the static controller contract**

Assert the controller contains the storage key, `visibilitychange`, `ArrowDown`, `ArrowUp`, `Home`, `End`, `Escape`, `aria-checked`, and `opensAbove`.

- [ ] **Step 6: Run tests**

Run:

```bash
node tools/hero-time-model.test.js
node --check hero-time.js
python3 tools/hero-specimen-check.py
```

Expected: all exit 0.

- [ ] **Step 7: Commit clock and menu behavior**

```bash
git add hero-time.js index.html tools/hero-time-model.test.js tools/hero-specimen-check.py
git commit -m "Add accessible hero time controls"
```

---

### Task 5: Connect FluidMesh transitions and lifecycle

**Files:**
- Modify: `hero-time.js`
- Modify: `hero-time.css`
- Modify: `index.html`
- Modify: `tools/hero-specimen-check.py`

**Interfaces:**
- Consumes `HeroTimeModel.PRESETS`, `interpolatePreset`, and `window.FluidMesh`.
- Extends `HeroTimeController` with `isRendering()` and `forceFallback()` for verification.

- [ ] **Step 1: Add failing lifecycle contract assertions**

Assert `hero-time.js` includes `new FluidMesh`, `IntersectionObserver`, `requestAnimationFrame`, `.pause()`, `.resume()`, `.renderOnce()`, the 800 ms duration, `prefers-reduced-motion`, and `timeFallback`.

Run: `python3 tools/hero-specimen-check.py`  
Expected: FAIL at `new FluidMesh`.

- [ ] **Step 2: Instantiate renderer with graceful failure**

Create the renderer only for active states after `#main` has non-zero bounds. Choose the active preset, clone it, set mobile DPR through a `dprCap` config value, and pass `onError:activateFallback`. Add `.timeFallback` when `FluidMesh` returns null, throws, or calls the error callback. Fallback still updates CSS state variables and menu semantics.

Mount the decorative canvas and CSS bloom in a page-anchored `#heroTimeScene` measured from behind the separate header through the bottom of the outlined hero. The atmosphere must read as one continuous scene across both specimens and must stop before `#cases`. Keep the header and hero outlines, rims, controls, and content painted above the atmosphere. Off hides `#heroTimeScene` and the original `.heroAura`, leaving only neutral surfaces.

- [ ] **Step 3: Implement retargetable 800 ms transitions**

Keep `currentConfig`, `transitionFrom`, `transitionTo`, `transitionStart`, and one transition RAF. When selection changes during a tween, calculate the current interpolated config first and use it as the new `transitionFrom`. Each frame calls:

```js
var p=Math.min(1,(now-transitionStart)/800);
var eased=1-Math.pow(1-p,3);
currentConfig=M.interpolatePreset(transitionFrom,transitionTo,eased);
mesh.set(currentConfig);
```

Off cancels the tween, pauses the mesh, and clears active visual opacity without destroying the controller.

- [ ] **Step 4: Implement visibility and viewport lifecycle**

An `IntersectionObserver` watches `#main`. Pause when Off, hidden, or non-intersecting. Resume only when all three conditions allow it. Reduced motion calls `mesh.set(preset); mesh.renderOnce(); mesh.pause()` and never starts continuous flow.

- [ ] **Step 5: Handle context/fallback and teardown**

If the renderer cannot resume after context restoration, retain `.timeFallback`. `destroy()` cancels transition RAF, automatic timer, menu listeners, media-query listeners, observer, and mesh resources.

Implement `forceFallback()` as the same public failure path used by `onError`: cancel the transition, destroy and clear the mesh, add `.timeFallback`, and return the controller to CSS-only rendering without changing mode or state.

The CSS-only fallback uses the same page-anchored boundary and clean, strong, bottom-origin half-circle composition as the WebGL scene. It must not degrade into a weak centered radial wash or resemble the site's Gradient Maker with visible independent color nodes.

- [ ] **Step 6: Verify lifecycle contracts and syntax**

Run:

```bash
python3 tools/hero-specimen-check.py
node --check hero-time.js
node --check fluid-mesh.js
python3 tools/token-audit.py
```

Expected: contracts pass and token audit has 0 errors.

- [ ] **Step 7: Commit renderer integration**

```bash
git add hero-time.js hero-time.css tools/hero-specimen-check.py
git commit -m "Render layered hero time scenes"
```

---

### Task 6: Integrate portrait and floor lighting

**Files:**
- Create: `hero-portrait-light.js`
- Modify: `hero-time.js`
- Modify: `hero-time.css`
- Modify: `index.html`
- Modify: `tools/hero-specimen-check.py`

**Interfaces:**
- Produces `window.HeroPortraitLight.create({face,cast}) -> {setState(state),sync(),destroy()}`.
- Consumes state names only; it does not own time calculation or call Mood functions.

- [ ] **Step 1: Add failing portrait adapter contract**

Assert the adapter contains `MutationObserver`, observes `src`, listens for `load`, copies `currentSrc||src`, and exposes `setState`, `sync`, and `destroy`. Run the hero contract and verify RED.

- [ ] **Step 2: Implement source mirroring**

```js
function sync(){
 var src=face.currentSrc||face.src;
 if(src&&cast.src!==src)cast.src=src;
}
var observer=new MutationObserver(sync);
observer.observe(face,{attributes:true,attributeFilter:["src","srcset"]});
face.addEventListener("load",sync);
```

Initialize `cast.draggable=false`, keep it `aria-hidden`, and keep it visually hidden until a successfully mirrored source loads. Missing, loading, or errored sources must never reveal a rectangular image boundary. `destroy()` disconnects the observer and removes both load and error listeners.

`setState(state)` assigns `cast.dataset.timeState=state`, calls `sync()`, and leaves color/filter selection to `hero-time.css`. Off is a valid state and maps to zero opacity.

- [ ] **Step 3: Implement state-specific light without flattening the face**

The cast image matches `.face` geometry and uses the image's own alpha. Apply a radial CSS mask centered at `var(--time-light-x) 86%` so the selected state's brightest side and lower jaw receive the strongest cast, with the mask transparent before the upper face. Use `mix-blend-mode:screen`, low opacity, state-specific `--time-cast-filter`, and no permanent recoloring. Eyes and interactive overlays remain above the cast.

Update the existing floor shadow through `--time-shadow` only; do not change its geometry. Off uses the neutral baseline shadow, sets cast opacity to 0, and suppresses both `#heroTimeScene` and the original `.heroAura`.

- [ ] **Step 4: Connect state changes**

Create the adapter once in `hero-time.js`, call `setState(state)` during every applied state, and destroy it from the controller cleanup. Mood image changes are observed rather than invoked.

Load `<script src="hero-portrait-light.js"></script>` immediately before `hero-time.js` in `index.html`.

- [ ] **Step 5: Run static, syntax, and token checks**

Run:

```bash
python3 tools/hero-specimen-check.py
node --check hero-portrait-light.js
node --check hero-time.js
python3 tools/token-audit.py
git diff --check
```

Expected: all structural checks pass; token audit has 0 errors.

- [ ] **Step 6: Commit portrait lighting**

```bash
git add hero-portrait-light.js hero-time.js hero-time.css index.html tools/hero-specimen-check.py
git commit -m "Light portrait from hero time scenes"
```

---

### Task 7: Tune responsive composition and verify the complete feature

**Files:**
- Modify: `hero-time-presets.js`
- Modify: `hero-time.css`
- Modify: `tools/hero-time-model.test.js`
- Modify: `tools/hero-specimen-check.py`

**Interfaces:**
- No new public API; this task validates and tunes the interfaces above.

- [ ] **Step 1: Run the complete automated suite before visual tuning**

```bash
node tools/hero-time-model.test.js
python3 tools/fluid-mesh-check.py
python3 tools/hero-specimen-check.py
node --check fluid-mesh.js
node --check hero-time-presets.js
node --check hero-time.js
node --check hero-portrait-light.js
node --check hero-engine.js
node --check header.js
python3 tools/token-audit.py
git diff --check
```

Expected: every command exits 0; token audit reports `errors=0`.

- [ ] **Step 2: Verify desktop states at 1440 × 900**

Check Automatic, Off, Sunrise, Daytime, Sunset, and Night. Record the separate header, `#main`, headline, CTA row, stage, Time button, menu, and `#cases` bounding boxes before/after. Requirements: no geometry changes between states; menu remains within 16 px; no horizontal overflow; View work is the strongest CTA; Night portrait retains eye/hair detail. The active atmosphere must read continuously behind the header and outlined hero, both thin specimen outlines must remain crisp above it, and the scene must stop before tabs/work.

- [ ] **Step 3: Verify mobile at 390 × 844 and 320 × 800**

Requirements: 44 px Time target; centered three-control group with no orphan; menu does not clip; hero-to-tabs spacing matches Off; head remains the approved size; canvas composition originates behind the lower face; page overflow is 0.

- [ ] **Step 4: Verify input and accessibility states**

Use keyboard only to open, arrow through, select, Escape, and return focus. Test outside close, coarse-pointer tap, `prefers-reduced-motion`, and forced-colors. Confirm reduced motion renders a still and forced colors exposes every selection without decorative layers.

- [ ] **Step 5: Verify lifecycle, strict Off, and fallback**

Select Night, background/restore the tab, scroll the hero out/in, switch Off/on, and rapidly choose three states. Confirm one active RAF path, no stale tween jump, no console error, and the selected state survives reload in the same tab. Temporarily force `HeroTimeController.forceFallback()` and verify the multi-layer CSS fallback and Off state. In Off, explicitly verify that the mesh, fallback, bloom, portrait cast, and original `.heroAura` are all invisible and no gradient remains anywhere across header or hero. Test a missing/loading face source and confirm no rectangular cast boundary is visible.

- [ ] **Step 6: Verify existing behavior regressions**

Run Delight and another Mood while each time state is active; confirm face source, portrait cast, and mood cleanup remain synchronized. Hover a Case Study and Extras to verify their shared popcorn/glasses animation. Click View work and confirm smooth, correctly offset scrolling. Open Gradient Maker and repeat preset/export smoke.

- [ ] **Step 7: Tune only preset/catalog and semantic variables**

If a state is muddy, generic, weak, busy, or unbalanced, adjust only `hero-time-presets.js` values and the semantic state variables in `hero-time.css`. Do not move hero layout boxes. Apply the documented Stripe research guidance: one clean broad bottom-emerging cropped half-circle of light, restrained depth and grain, and original palette values. The visible result must not resemble Gradient Maker or expose discrete mesh-node blobs.

- [ ] **Step 8: Re-run the full suite after tuning**

Repeat Step 1 exactly and require the same passing result.

- [ ] **Step 9: Commit responsive polish**

```bash
git add hero-time-presets.js hero-time.css tools/hero-time-model.test.js tools/hero-specimen-check.py
git commit -m "Polish responsive hero time lighting"
```

---

## Completion gate

Before claiming completion, invoke `superpowers:verification-before-completion`, review the entire branch diff, and use `superpowers:requesting-code-review`. Completion requires:

- All automated commands in Task 7 Step 1 passing from fresh output.
- Desktop and both mobile viewport checks recorded.
- No new horizontal overflow or hero/tab spacing change.
- Gradient Maker preset/edit/export smoke passing after extraction.
- Automatic, every manual state, Off, reduced motion, forced colors, fallback, portrait Mood synchronization, and session reload behavior verified.
- Active lighting spans the separate header and outlined hero continuously, stops before work, and never obscures either specimen outline.
- Off is completely neutral with `.heroAura` and every time-lighting layer suppressed.
- Portrait cast remains invisible until a valid source loads and never reveals a broken rectangular image boundary.
- Untracked `.superpowers/` content excluded from commits.
