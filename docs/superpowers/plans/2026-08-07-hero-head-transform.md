# Hero Head Transform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal Figma-style move/resize interaction to the animated Home portrait while preserving the original full-scale Hero and tightening the spacing between adjacent sections and projects.

**Architecture:** Keep `hero-engine.js` authoritative for portrait rendering and animation. A new focused `hero-head-transform.js` module owns only selection, translation, proportional scale, bounds, and input; it transforms a wrapper outside the existing stage so all engine-local eye and prop coordinates remain unchanged. Shared layout and selection geometry resolve through `tokens.css` and `controls.css`, while focused Python/Playwright contracts verify exact desktop/mobile geometry and animation alignment.

**Tech Stack:** Semantic HTML, CSS custom properties, vanilla JavaScript Pointer Events, `requestAnimationFrame`, Python 3, Playwright.

## Global Constraints

- The resting Hero has no visible editor chrome.
- The selected portrait has one 1px system-blue frame and exactly four visually small square corner handles.
- Each visible handle remains small while its actual pointer target is at least 44×44px.
- Move and resize remain inside the protected lower Hero region and never overlap the headline, CTA, or time control.
- Resize is proportional from the opposite corner; rotation, skew, crop, freeform aspect ratio, dimensions, and toolbars are out of scope.
- The transform applies outside the face engine; gaze, blink, case-study smile, and Extras popcorn/glasses stay aligned.
- Home click-to-dizzy is removed.
- Escape and outside activation deselect; reload restores the authored default; no transform state is persisted.
- Pointer, touch, keyboard, reduced-motion, 1440px, 390px, and 320px paths must work.
- Desktop Hero block size remains `calc(100svh - 88px)`; mobile uses `clamp(600px, calc(100svh - 160px), 680px)`.
- Hero-to-work gap is 16px; case-study gap is 64px desktop and 40px mobile.
- The work collection may begin below the initial viewport; do not shorten the Hero to manufacture a thumbnail preview.
- The Hero has no rim, border, or shadow; every gradient begins at the exact shared `--theme-page` color along its top edge.
- Home collection media uses the shared `20px` desktop / `14px` mobile media radius and one inset rim; project metadata sits `16px` / `12px` below it using the shared lead and 15px metadata scales.

## File Structure

- `tokens.css`: shared entrance-rhythm and selection-chrome tokens only.
- `controls.css`: shared Hero transform wrapper, selection frame, handle, focus, and responsive presentation.
- `index.html`: semantic wrapper/selection-overlay markup, approved rhythm overrides, and script loading.
- `hero-head-transform.js`: all selection, move, resize, clamp, reset, and keyboard behavior.
- `hero-engine.js`: remove the Home dizzy binding and consume one transform-sync event for external popcorn props.
- `tools/hero-entrance-rhythm-contract.py`: exact layout-token and fold-visibility regression.
- `tools/work-collection-contract.py`: exact media radius/rim, metadata scale/gap, shared media-role, and reduced-motion Night-star regression.
- `tools/hero-head-transform-contract.py`: static structure plus pointer/touch/keyboard/animation browser regression.
- `tools/shared-surfaces-contract.py`: update the existing head-click contract to the new component boundary.
- `tools/shared-surfaces-browser.py`: reuse guarded, live eye lookups so engine DOM rebuilds cannot make the suite flaky.

---

### Task 1: Approved Entrance Rhythm

**Files:**
- Modify: `tokens.css:500-535`
- Modify: `index.html:384-412`
- Modify: `index.html:1404-1433`
- Create: `tools/hero-entrance-rhythm-contract.py`

**Interfaces:**
- Consumes: existing `--sp-16`, `--sp-40`, `--sp-64`, `.hero`, `.cases`, `.collection__tabs`, `.csItem`.
- Produces: `--section-join-gap`, `--work-item-gap`; preserved full-scale Hero geometry, exact responsive page rhythm, and seamless Hero top edge used by later transform bounds tests.

- [ ] **Step 1: Write the failing rhythm contract**

Create `tools/hero-entrance-rhythm-contract.py` with this contract:

```python
#!/usr/bin/env python3
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
from io import BytesIO
from PIL import Image, ImageColor

ROOT = Path(__file__).resolve().parents[1]

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass

def static_contract():
    tokens = (ROOT / "tokens.css").read_text(encoding="utf-8")
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    assert "--section-join-gap:var(--sp-16)" in tokens
    assert "--work-item-gap:var(--sp-64)" in tokens
    assert "--work-item-gap:var(--sp-40)" in tokens
    assert ".cases{margin-top:var(--section-join-gap)}" in html
    assert ".csItem+.csItem{margin-top:var(--work-item-gap)}" in html
    hero_time = (ROOT / "hero-time.css").read_text(encoding="utf-8")
    controls = (ROOT / "controls.css").read_text(encoding="utf-8")
    assert ".surface--hero{" in controls and "box-shadow:none" in controls.split(".surface--hero{", 1)[1].split("}", 1)[0]
    seam = hero_time.split(".heroTimeGradient::after{", 1)[1].split("}", 1)[0]
    assert "var(--theme-page) 0%" in seam and "var(--theme-page) 10%" in seam
    assert "transparent 28%" in seam

def browser_contract(base_url):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, height in ((1280, 720), (1440, 900), (390, 844), (320, 800)):
            page = browser.new_page(viewport={"width": width, "height": height})
            page.goto(base_url + "/index.html?rhythm=1", wait_until="load")
            page.wait_for_selector(".csFrame")
            state = page.evaluate("""() => {
              const box = selector => {
                const r = document.querySelector(selector).getBoundingClientRect();
                return {top:r.top,bottom:r.bottom,width:r.width,height:r.height};
              };
              const items = [...document.querySelectorAll('.csPanel.on .csItem')];
              const a = items[0].getBoundingClientRect();
              const b = items[1].getBoundingClientRect();
              return {
                hero: box('.hero'), cases: box('.cases'), tabs: box('.collection__tabs'),
                frame: box('.csPanel.on .csFrame'), itemGap: b.top - a.bottom,
                overflow: document.documentElement.scrollWidth > innerWidth,
                heroShadow: getComputedStyle(document.querySelector('.hero')).boxShadow
              };
            }""")
            assert not state["overflow"], (width, state)
            assert state["heroShadow"] == "none", state
            assert 15.5 <= state["cases"]["top"] - state["hero"]["bottom"] <= 16.5, state
            expected_gap = 40 if width <= 760 else 64
            assert expected_gap - .5 <= state["itemGap"] <= expected_gap + .5, state
            if width > 760:
                assert height - 88.5 <= state["hero"]["height"] <= height - 87.5, state
            for theme in ("pre-dawn", "sunrise", "daytime", "dusk", "sunset", "night"):
                page.evaluate("state => window.SiteTheme.setMode(state,{persist:false})", theme)
                page.wait_for_function("state => document.querySelector('#main').dataset.timeState === state", theme)
                page.wait_for_timeout(700)
                hero = page.locator("#main").bounding_box()
                expected = ImageColor.getrgb(page.evaluate(
                    "getComputedStyle(document.documentElement).getPropertyValue('--theme-page').trim()"
                ))
                image = Image.open(BytesIO(page.screenshot())).convert("RGB")
                y = int(hero["y"] + 2)
                for fraction in (.25, .5, .75):
                    actual = image.getpixel((int(hero["x"] + hero["width"] * fraction), y))
                    assert max(abs(actual[i] - expected[i]) for i in range(3)) <= 2, (
                        width, height, theme, actual, expected
                    )
            page.close()
        browser.close()

def main():
    static_contract()
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        browser_contract(f"http://127.0.0.1:{server.server_port}")
    finally:
        server.shutdown(); server.server_close()
    print("Hero entrance rhythm: OK")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the contract to verify it fails**

Run: `python3 tools/hero-entrance-rhythm-contract.py`

Expected: FAIL because the two shared gap tokens and seamless Hero-edge contract do not exist.

- [ ] **Step 3: Add the semantic rhythm tokens**

Add to the shared surface token block in `tokens.css`:

```css
--section-join-gap:var(--sp-16);
--work-item-gap:var(--sp-64);
```

Add to the existing `@media(max-width:760px)` token block:

```css
--work-item-gap:var(--sp-40);
```

- [ ] **Step 4: Replace duplicated viewport pauses with the approved rhythm**

At the end of the Home Hero style block in `index.html`, add:

```css
.cases{margin-top:var(--section-join-gap)}
.csItem+.csItem{margin-top:var(--work-item-gap)}
@media(min-width:761px){.hero{min-height:calc(100svh - 88px)}}
@media(max-width:760px){.hero{min-height:auto}}
```

Delete the superseded `.cases{margin:clamp(80px,12vh,144px) auto 0}` top-margin value and `.csItem+.csItem{margin-top:clamp(128px,18vh,240px)}` / mobile `14vh` overrides so one rule owns each gap.

In `controls.css`, make the shared Hero surface explicitly rimless:

```css
.surface--hero{box-shadow:none}
```

In `hero-time.css`, set the non-Night `--time-base` values to `var(--theme-page)`. Preserve every approved radial and linear gradient stop exactly. Add one shared, opaque-to-transparent top wash to every gradient layer:

```css
.heroTimeGradient::after{
 content:"";position:absolute;inset:0;pointer-events:none;
 background:linear-gradient(180deg,var(--theme-page) 0%,var(--theme-page) 10%,transparent 28%)
}
```

This shared edge treatment covers Pre-dawn, Sunrise, Daytime, Dusk, Sunset, and both Night breakpoints without forking their artwork. Its fully opaque first 10% makes the top center and corners mathematically identical to the surrounding page, then releases the existing atmosphere by 28%.

- [ ] **Step 5: Run the focused and existing geometry contracts**

Run:

```bash
python3 tools/hero-entrance-rhythm-contract.py
python3 tools/shared-surfaces-contract.py
python3 tools/shared-surfaces-browser.py
```

Expected: all PASS; screenshots preserve the original full-scale desktop Hero, remove the duplicated inter-section pause, and show no mobile overflow.

- [ ] **Step 6: Commit the rhythm change**

```bash
git add tokens.css index.html tools/hero-entrance-rhythm-contract.py
git commit -m "Refine Hero and work entrance rhythm"
```

---

### Task 1.5: Connected Work Media and Shared Surface Closure

**Files:**
- Modify: `tokens.css`
- Modify: `controls.css`
- Modify: `index.html`
- Modify: `bearings.html`
- Modify: `strata.html`
- Modify: `cluster.html`
- Modify: `ucdavis.html`
- Modify: `hero-time.css`
- Modify: `tools/shared-surfaces-contract.py`
- Modify: `tools/shared-surfaces-browser.py`
- Create: `tools/work-collection-contract.py`

**Interfaces:**
- Consumes: `--radius-media`, `--surface-rim`, `.collection`, `.csFrame`, `.csMeta`, `.media--full`, `.media--mockup`, `.heroNightStars`.
- Produces: one rounded full-width work-media boundary; compact, typographically connected project metadata; complete shared media-role coverage; restrained static Night stars under reduced motion; null-safe live-eye regression checks.

- [ ] **Step 1: Write the failing collection contract**

Cover 1440×900, 390×844, and 320×800 in light and Night modes. Assert the active Home thumbnail computes to `20px` desktop / `14px` mobile with exactly one inset rim; image and wrapper radii agree; metadata gap is `16px` / `12px`; title uses the shared lead scale; year computes to `15px`; collection width remains aligned to the shared page gutter with no horizontal overflow. Assert reduced-motion Night stars are static with opacity no greater than `.72`.

Extend the static shared-surface contract so every image-led case-study region named by the prior review (`photoFig`/`cmpBoard`, `videoFrame`, and `photoPair`) declares exactly one of `media--full` or `media--mockup`. Add a browser assertion for the nested Bearings board image and make live eye lookups null-safe across engine rebuilds.

- [ ] **Step 2: Run the focused contracts and confirm RED**

Run `python3 tools/work-collection-contract.py`, `python3 tools/shared-surfaces-contract.py`, and the focused browser route. Confirm failures name the square Home media, oversized metadata, incomplete media roles, bright reduced-motion stars, and brittle live-eye lookup.

- [ ] **Step 3: Implement the shared collection treatment**

Add semantic metadata-gap/type tokens. Remove the joined-collection rules that force Home `.csFrame` and its image to radius zero. Apply `--radius-media` and exactly one `--surface-rim` boundary while keeping the thumbnail margin-to-margin inside the collection. Remove the duplicate `.csMeta` margin so the flex gap is the sole image-to-label spacing owner. Set `.csName` to the shared lead scale and `.csYear` to 15px without adding a card or panel.

- [ ] **Step 4: Close the reviewed shared-surface gaps**

Apply the correct media role to each audited case-study region, normalize joined Bearings board image radius/rim ownership, give reduced-motion stars their restrained authored static opacity, and guard live eye DOM reads against the face engine rebuilding nodes.

- [ ] **Step 5: Verify and commit**

Run both focused contracts, the full shared static/browser contracts, Python compilation, and `git diff --check`. Capture Home collection screenshots at 1440, 390, and 320 in light and Night. Commit only this task.

---

### Task 2: Clean Selection and Constrained Move

**Files:**
- Modify: `tokens.css:500-535`
- Modify: `controls.css:160-180`
- Modify: `index.html:1563-1568`
- Create: `hero-head-transform.js`
- Create: `tools/hero-head-transform-contract.py`
- Modify: `hero-engine.js:1369-1373`

**Interfaces:**
- Consumes: `#main`, `.heroCopy`, `.heroCharacterPeek`, `.stagewrap`, `#face`, existing `--hero-peek-*` geometry.
- Produces: `window.HeroHeadTransform.init(root: Document): HeroHeadController`; controller methods `select()`, `deselect({restoreFocus?: boolean})`, `reset()`, `reclamp()`, `getState()`; `heroheadtransform` custom event.

- [ ] **Step 1: Write the failing static and selection contract**

Create the first half of `tools/hero-head-transform-contract.py`:

```python
#!/usr/bin/env python3
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass

def static_contract():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "controls.css").read_text(encoding="utf-8")
    tokens = (ROOT / "tokens.css").read_text(encoding="utf-8")
    engine = (ROOT / "hero-engine.js").read_text(encoding="utf-8")
    transform = (ROOT / "hero-head-transform.js").read_text(encoding="utf-8")
    assert 'id="heroHeadTransform"' in html
    assert 'id="heroHeadSelection"' in html
    assert 'data-head-bounds="0.22 0.12 0.80 0.91"' in html
    assert html.count('class="heroHeadHandle"') == 4
    assert '<script src="hero-head-transform.js"></script>' in html
    assert html.index('src="hero-engine.js"') < html.index('src="hero-head-transform.js"')
    for token in ("--selection-ink", "--selection-line", "--selection-handle-size",
                  "--selection-hit-size", "--hero-head-safe-gap"):
        assert token in tokens, token
    for selector in (".heroHeadTransform{", ".heroHeadSelection{", ".heroHeadHandle{"):
        assert selector in css, selector
    assert 'faceImg.addEventListener("click",()=>{if(CALIB||eventLock)return;tapReact();});' not in engine
    for operation in ("pointerdown", "pointermove", "pointerup", "pointercancel",
                      "lostpointercapture", "visibilitychange", "requestAnimationFrame"):
        assert operation in transform, operation

def browser_contract(base_url):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, height in ((1440, 900), (390, 844), (320, 800)):
            page = browser.new_page(viewport={"width": width, "height": height})
            page.goto(base_url + "/index.html?head-transform=1", wait_until="load")
            page.wait_for_selector("#face")
            face = page.locator("#face")
            face.click(position={"x": face.bounding_box()["width"] * .5,
                                 "y": face.bounding_box()["height"] * .3})
            selected = page.evaluate("""() => ({
              pressed: document.querySelector('#face').getAttribute('aria-pressed'),
              hidden: document.querySelector('#heroHeadSelection').hidden,
              handles: [...document.querySelectorAll('.heroHeadHandle')].map(node => {
                const r = node.getBoundingClientRect();
                return {width:r.width,height:r.height,tabIndex:node.tabIndex};
              })
            })""")
            assert selected["pressed"] == "true" and not selected["hidden"], selected
            assert len(selected["handles"]) == 4
            assert all(h["width"] >= 44 and h["height"] >= 44 and h["tabIndex"] == 0
                       for h in selected["handles"]), selected
            page.keyboard.press("Escape")
            assert page.locator("#face").get_attribute("aria-pressed") == "false"
            assert page.locator("#heroHeadSelection").is_hidden()
            page.close()
        browser.close()

def main():
    static_contract()
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        browser_contract(f"http://127.0.0.1:{server.server_port}")
    finally:
        server.shutdown(); server.server_close()
    print("Hero head transform: OK")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the contract to verify it fails**

Run: `python3 tools/hero-head-transform-contract.py`

Expected: FAIL because `hero-head-transform.js`, the transform wrapper, selection overlay, handles, and tokens do not exist.

- [ ] **Step 3: Add selection tokens and semantic markup**

Add these tokens to `tokens.css`:

```css
--selection-ink:#0A84FF;
--selection-line:1px;
--selection-handle-size:8px;
--selection-hit-size:var(--tap-min);
--hero-head-safe-gap:var(--sp-16);
--hero-head-min-scale:.78;
--hero-head-max-scale:1.35;
```

Insert `<div class="heroHeadTransform" id="heroHeadTransform">` immediately before the existing `<div class="stagewrap">`, and insert its matching `</div>` immediately after the existing stagewrap subtree. Do not alter or recreate the stage subtree. Then place this selection overlay between the new wrapper and `#heroMovieEffectsClip`:

```html
<div class="heroHeadSelection" id="heroHeadSelection" role="group"
     aria-label="Selected animated portrait" hidden>
 <button class="heroHeadHandle" type="button" data-corner="nw" aria-label="Resize portrait from top left" tabindex="-1"></button>
 <button class="heroHeadHandle" type="button" data-corner="ne" aria-label="Resize portrait from top right" tabindex="-1"></button>
 <button class="heroHeadHandle" type="button" data-corner="sw" aria-label="Resize portrait from bottom left" tabindex="-1"></button>
 <button class="heroHeadHandle" type="button" data-corner="se" aria-label="Resize portrait from bottom right" tabindex="-1"></button>
</div>
```

Set `#face` to `role="button" tabindex="0" aria-pressed="false" aria-label="Select and reposition animated portrait" data-head-bounds="0.22 0.12 0.80 0.91"`. Load `hero-head-transform.js` immediately after `hero-engine.js`. Replace the local `HEAD={x0:.22,x1:.80,y0:.12,y1:.91}` literal in `hero-engine.js` with values parsed from this same data attribute, so hit testing and selection geometry have one source of truth:

```js
var headBounds=(faceImg.getAttribute("data-head-bounds")||"0.22 0.12 0.80 0.91").split(/\s+/).map(Number);
var HEAD={x0:headBounds[0],y0:headBounds[1],x1:headBounds[2],y1:headBounds[3]};
```

- [ ] **Step 4: Move placement ownership from `.stagewrap` to the transform wrapper**

Replace the current placement rules in `controls.css` with:

```css
.heroHeadTransform{
 position:absolute;left:50%;top:auto;bottom:calc((var(--hero-peek-depth) * -1) + var(--hero-peek-offset));
 width:var(--hero-peek-width);max-width:none;z-index:2;
 transform-origin:0 0;
 transform:translate3d(calc(-50% + var(--hero-head-x,0px)),var(--hero-head-y,0px),0)
           scale(var(--hero-head-scale,1));
 will-change:transform
}
.heroHeadTransform .stagewrap{position:relative!important;width:100%!important;max-width:none;margin:0!important}
.heroHeadSelection{
 position:absolute;left:var(--selection-x);top:var(--selection-y);
 width:var(--selection-w);height:var(--selection-h);z-index:6;
 pointer-events:auto;touch-action:none;cursor:move
}
.heroHeadSelection::before{
 content:"";position:absolute;inset:0;pointer-events:none;
 box-shadow:inset 0 0 0 var(--selection-line) var(--selection-ink)
}
.heroHeadSelection[hidden]{display:none}
.heroHeadHandle{
 position:absolute;width:var(--selection-hit-size);height:var(--selection-hit-size);
 border:0;padding:0;background:transparent;touch-action:none
}
.heroHeadHandle::before{
 content:"";position:absolute;left:50%;top:50%;width:var(--selection-handle-size);height:var(--selection-handle-size);
 transform:translate(-50%,-50%);background:var(--ctl-ground);
 box-shadow:inset 0 0 0 var(--selection-line) var(--selection-ink)
}
.heroHeadHandle[data-corner="nw"]{left:calc(var(--selection-hit-size) / -2);top:calc(var(--selection-hit-size) / -2);cursor:nwse-resize}
.heroHeadHandle[data-corner="ne"]{right:calc(var(--selection-hit-size) / -2);top:calc(var(--selection-hit-size) / -2);cursor:nesw-resize}
.heroHeadHandle[data-corner="sw"]{left:calc(var(--selection-hit-size) / -2);bottom:calc(var(--selection-hit-size) / -2);cursor:nesw-resize}
.heroHeadHandle[data-corner="se"]{right:calc(var(--selection-hit-size) / -2);bottom:calc(var(--selection-hit-size) / -2);cursor:nwse-resize}
```

Keep `.heroCharacterPeek` as the full-Hero positioning context and change its old `.stagewrap` placement selector to `.heroHeadTransform` so there is exactly one placement owner.

- [ ] **Step 5: Implement selection, measurement, constrained move, and reset**

Create `hero-head-transform.js` as an IIFE exporting this interface:

```js
(function(){
 "use strict";
 function init(root){
  root=root||document;
  var hero=root.querySelector("#main"),wrap=root.querySelector("#heroHeadTransform");
  var face=root.querySelector("#face"),selection=root.querySelector("#heroHeadSelection");
  if(!hero||!wrap||!face||!selection)return null;
  var handles=[].slice.call(selection.querySelectorAll(".heroHeadHandle"));
  var state={selected:false,x:0,y:0,scale:1,pointerId:null,operation:null,start:null,capture:null,frame:0};
  var content=hero.querySelector(".heroCopy");
  var bounds=(face.getAttribute("data-head-bounds")||"0.22 0.12 0.80 0.91").split(/\s+/).map(Number);

  function objectRect(){
   var h=hero.getBoundingClientRect(),f=face.getBoundingClientRect();
   return {left:f.left+f.width*bounds[0],top:Math.max(f.top+f.height*bounds[1],h.top),
    right:f.left+f.width*bounds[2],bottom:Math.min(f.top+f.height*bounds[3],h.bottom)};
  }
  function safeRect(){
   var h=hero.getBoundingClientRect(),c=content.getBoundingClientRect();
   return {left:h.left,right:h.right,top:Math.min(h.bottom,c.bottom+16),bottom:h.bottom};
  }
  function syncSelection(){
   state.frame=0;
   if(!state.selected)return;
   var h=hero.getBoundingClientRect(),r=objectRect();
   selection.style.setProperty("--selection-x",(r.left-h.left)+"px");
   selection.style.setProperty("--selection-y",(r.top-h.top)+"px");
   selection.style.setProperty("--selection-w",Math.max(1,r.right-r.left)+"px");
   selection.style.setProperty("--selection-h",Math.max(1,r.bottom-r.top)+"px");
  }
  function render(){
   wrap.style.setProperty("--hero-head-x",state.x+"px");
   wrap.style.setProperty("--hero-head-y",state.y+"px");
   wrap.style.setProperty("--hero-head-scale",String(state.scale));
   if(!state.frame)state.frame=requestAnimationFrame(syncSelection);
   dispatchEvent(new CustomEvent("heroheadtransform",{detail:getState()}));
  }
  function clampMove(x,y){
   var current=objectRect(),safe=safeRect(),dx=x-state.x,dy=y-state.y;
   var proposed={left:current.left+dx,right:current.right+dx,
                 top:current.top+dy,bottom:current.bottom+dy};
   var cx=proposed.left<safe.left?safe.left-proposed.left:
          proposed.right>safe.right?safe.right-proposed.right:0;
   var cy=proposed.top<safe.top?safe.top-proposed.top:
          proposed.bottom>safe.bottom?safe.bottom-proposed.bottom:0;
   return {x:x+cx,y:y+cy};
  }
  function select(){
   state.selected=true;face.setAttribute("aria-pressed","true");selection.hidden=false;
   handles.forEach(function(handle){handle.tabIndex=0;});syncSelection();
  }
  function deselect(options){
   state.selected=false;face.setAttribute("aria-pressed","false");selection.hidden=true;
   handles.forEach(function(handle){handle.tabIndex=-1;});
   if(options&&options.restoreFocus)face.focus();
  }
  function beginMove(event){
   if(event.button!==undefined&&event.button!==0)return;
   select();event.preventDefault();state.pointerId=event.pointerId;state.operation="move";
   state.start={clientX:event.clientX,clientY:event.clientY,x:state.x,y:state.y};
   state.capture=event.currentTarget;state.capture.setPointerCapture(event.pointerId);
  }
  function move(event){
   if(state.operation!=="move"||event.pointerId!==state.pointerId)return;
   var next=clampMove(state.start.x+event.clientX-state.start.clientX,
                      state.start.y+event.clientY-state.start.clientY);
   state.x=next.x;state.y=next.y;render();
  }
  function end(event){
   if(state.pointerId!==null&&event&&event.pointerId!==undefined&&event.pointerId!==state.pointerId)return;
   state.pointerId=null;state.operation=null;state.start=null;state.capture=null;
  }
  function reset(){state.x=0;state.y=0;state.scale=1;render();}
  function reclamp(){var next=clampMove(state.x,state.y);state.x=next.x;state.y=next.y;render();}
  function getState(){return {selected:state.selected,x:state.x,y:state.y,scale:state.scale};}

  face.addEventListener("pointerdown",beginMove);
  selection.addEventListener("pointerdown",function(e){if(!e.target.closest(".heroHeadHandle"))beginMove(e);});
  [face,selection].forEach(function(node){
   node.addEventListener("pointermove",move);node.addEventListener("pointerup",end);
   node.addEventListener("pointercancel",end);node.addEventListener("lostpointercapture",end);
  });
  document.addEventListener("pointerdown",function(e){
   if(state.selected&&!selection.contains(e.target)&&e.target!==face)deselect();
  },true);
  document.addEventListener("visibilitychange",function(){if(document.hidden)end();});
  addEventListener("blur",end);
  addEventListener("resize",function(){requestAnimationFrame(reclamp);});
  new ResizeObserver(function(){requestAnimationFrame(reclamp);}).observe(hero);
  new ResizeObserver(function(){requestAnimationFrame(reclamp);}).observe(content);
  new MutationObserver(function(){requestAnimationFrame(reclamp);}).observe(
   hero.querySelector(".heroCharacterPeek"),{attributes:true,attributeFilter:["class"]}
  );
  return {select:select,deselect:deselect,reset:reset,reclamp:reclamp,getState:getState};
 }
 window.HeroHeadTransform={init:init};
 addEventListener("DOMContentLoaded",function(){window.__heroHeadTransform=init(document);});
})();
```

Keep the function names and public controller signature exact so the browser contract can exercise the component without reaching into private state.

- [ ] **Step 6: Remove the competing Home dizzy click binding**

Delete only this binding from `hero-engine.js`:

```js
faceImg.addEventListener("click",()=>{if(CALIB||eventLock)return;tapReact();});
```

Do not remove the gaze, blink, calibration, smile, or movie code. The transform module now owns pointer activation on the Home portrait.

- [ ] **Step 7: Run selection and move tests**

Run:

```bash
node --check hero-head-transform.js
python3 tools/hero-head-transform-contract.py
python3 tools/hero-entrance-rhythm-contract.py
```

Expected: PASS; first selection shows one frame/four 44px targets, Escape hides them, and no horizontal overflow occurs.

- [ ] **Step 8: Commit selection and move**

```bash
git add tokens.css controls.css index.html hero-engine.js hero-head-transform.js tools/hero-head-transform-contract.py
git commit -m "Add selectable movable Hero portrait"
```

---

### Task 3: Proportional Resize, Keyboard Input, and Animation Sync

**Files:**
- Modify: `hero-head-transform.js`
- Modify: `hero-engine.js:1030-1195`
- Modify: `controls.css:160-205`
- Modify: `tools/hero-head-transform-contract.py`

**Interfaces:**
- Consumes: Task 2 `HeroHeadController`, `.heroHeadHandle[data-corner]`, `heroheadtransform`.
- Produces: proportional four-corner resize, keyboard move/resize, robust cancellation, and `syncMovieEffectsLayer()` consumption of transform events.

- [ ] **Step 1: Extend the browser contract with failing move/resize invariants**

Add this browser sequence after selection in `tools/hero-head-transform-contract.py`:

```python
frame0 = page.locator("#heroHeadSelection").bounding_box()
hero = page.locator("#main").bounding_box()
protected = page.locator(".heroCopy").bounding_box()
page.mouse.move(frame0["x"] + frame0["width"] / 2, frame0["y"] + frame0["height"] / 2)
page.mouse.down()
page.mouse.move(frame0["x"] + frame0["width"] / 2 + 32,
                frame0["y"] + frame0["height"] / 2 - 16, steps=4)
page.mouse.up()
moved = page.locator("#heroHeadSelection").bounding_box()
assert moved["y"] >= protected["y"] + protected["height"] + 15
assert moved["x"] >= hero["x"] and moved["x"] + moved["width"] <= hero["x"] + hero["width"]
assert moved["y"] + moved["height"] <= hero["y"] + hero["height"] + .5

def logical_head_rect():
    return page.evaluate("""() => {
      const face=document.querySelector('#face'),r=face.getBoundingClientRect();
      const b=face.dataset.headBounds.split(/\s+/).map(Number);
      return {x:r.left+r.width*b[0],y:r.top+r.height*b[1],
        width:r.width*(b[2]-b[0]),height:r.height*(b[3]-b[1])};
    }""")

se = page.locator('.heroHeadHandle[data-corner="se"]')
before = logical_head_rect()
anchor = (before["x"], before["y"])
handle = se.bounding_box()
page.mouse.move(handle["x"] + handle["width"] / 2, handle["y"] + handle["height"] / 2)
page.mouse.down()
page.mouse.move(handle["x"] + handle["width"] / 2 + 36,
                handle["y"] + handle["height"] / 2 + 36, steps=4)
page.mouse.up()
after = logical_head_rect()
assert page.evaluate("window.__heroHeadTransform.getState().scale") > 1
assert abs(after["x"] - anchor[0]) <= 1 and abs(after["y"] - anchor[1]) <= 1
assert abs(after["width"] / before["width"] - after["height"] / before["height"]) <= .02
```

The authored portrait remains intentionally clipped by the Hero edge. The proportional invariant therefore uses the full logical face bounds, not the visible selection frame: width and height must scale together and the logical opposite corner must remain fixed even while the visible bottom stays clipped.

Add keyboard assertions:

```python
page.locator("#face").focus()
state0 = page.evaluate("window.__heroHeadTransform.getState()")
page.keyboard.press("ArrowRight")
state1 = page.evaluate("window.__heroHeadTransform.getState()")
assert state1["x"] > state0["x"]
page.locator('.heroHeadHandle[data-corner="se"]').focus()
page.keyboard.press("ArrowRight")
state2 = page.evaluate("window.__heroHeadTransform.getState()")
assert state2["scale"] > state1["scale"]
```

- [ ] **Step 2: Run the focused contract to verify resize and keyboard paths fail**

Run: `python3 tools/hero-head-transform-contract.py`

Expected: FAIL because handle pointer operations and keyboard transformations are not implemented.

- [ ] **Step 3: Implement proportional corner resize from the opposite anchor**

Add these exact helpers to `hero-head-transform.js`:

```js
function beginResize(event,corner){
 if(state.pointerId!==null)return;
 event.preventDefault();event.stopPropagation();select();
 var r=logicalRect(),opposite={
  nw:{x:r.right,y:r.bottom},ne:{x:r.left,y:r.bottom},
  sw:{x:r.right,y:r.top},se:{x:r.left,y:r.top}
 }[corner];
 var drag=cornerPoint(r,corner);
 state.pointerId=event.pointerId;state.operation="resize";
 state.start={corner:corner,anchor:opposite,rect:r,x:state.x,y:state.y,scale:state.scale,
  pointerOffset:{x:drag.x-event.clientX,y:drag.y-event.clientY}};
 event.currentTarget.setPointerCapture(event.pointerId);
}
function cornerPoint(rect,corner){
 return {
  nw:{x:rect.left,y:rect.top},ne:{x:rect.right,y:rect.top},
  sw:{x:rect.left,y:rect.bottom},se:{x:rect.right,y:rect.bottom}
 }[corner];
}
function oppositePoint(rect,corner){
 return {
  nw:{x:rect.right,y:rect.bottom},ne:{x:rect.left,y:rect.bottom},
  sw:{x:rect.right,y:rect.top},se:{x:rect.left,y:rect.top}
 }[corner];
}
function applyScaleFromAnchor(next,anchor,corner){
 state.scale=next;render();
 var actual=oppositePoint(logicalRect(),corner);
 state.x+=anchor.x-actual.x;state.y+=anchor.y-actual.y;render();
 var clamped=clampMove(state.x,state.y);
 state.x=clamped.x;state.y=clamped.y;render();
}
function resize(event){
 if(state.operation!=="resize"||event.pointerId!==state.pointerId)return;
 var dragX=event.clientX+state.start.pointerOffset.x;
 var dragY=event.clientY+state.start.pointerOffset.y;
 var rx=Math.abs(dragX-state.start.anchor.x)/state.start.rect.width;
 var ry=Math.abs(dragY-state.start.anchor.y)/state.start.rect.height;
 var ratio=Math.max(rx,ry);
 var min=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hero-head-min-scale"))||.78;
 var max=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hero-head-max-scale"))||1.35;
 var next=Math.max(min,Math.min(max,state.start.scale*ratio));
 applyScaleFromAnchor(next,state.start.anchor,state.start.corner);
}
```

The pointer offset is required because Task 2 deliberately keeps the 44px hit box inboard while the 8px visual square remains centered on the true corner. Resizing must begin without a scale jump regardless of where inside that hit target the user presses.

Before these helpers, split geometry ownership explicitly:

```js
function logicalRect(){
 var f=face.getBoundingClientRect();
 return {left:f.left+f.width*bounds[0],top:f.top+f.height*bounds[1],
  right:f.left+f.width*bounds[2],bottom:f.top+f.height*bounds[3]};
}
function objectRect(){
 var h=hero.getBoundingClientRect(),r=logicalRect();
 return {left:Math.max(r.left,h.left),top:Math.max(r.top,h.top),
  right:Math.min(r.right,h.right),bottom:Math.min(r.bottom,h.bottom)};
}
```

`logicalRect()` owns proportional anchor math. `objectRect()` remains the visible, Hero-clipped rectangle used by selection chrome and movement constraints. Do not change the approved resting crop to make the resize test easier.

Register each handle with the shared resize path:

```js
handles.forEach(function(handle){
 handle.addEventListener("pointerdown",function(event){
  beginResize(event,handle.getAttribute("data-corner"));
 });
 handle.addEventListener("pointermove",resize);
 handle.addEventListener("pointerup",end);
 handle.addEventListener("pointercancel",end);
 handle.addEventListener("lostpointercapture",end);
});
```

`applyScaleFromAnchor()` is the single resize path for pointer and keyboard input; its measured correction is the final authority and keeps the anchor within 1px despite responsive face cropping.

- [ ] **Step 4: Add keyboard move, resize, deselection, and focus behavior**

Add one keyboard handler:

```js
function onKeydown(event){
 if(event.key==="Escape"&&state.selected){event.preventDefault();deselect({restoreFocus:true});return;}
 if(!state.selected||!/^Arrow/.test(event.key))return;
 var step=event.shiftKey?16:4;
 var dx=event.key==="ArrowLeft"?-step:event.key==="ArrowRight"?step:0;
 var dy=event.key==="ArrowUp"?-step:event.key==="ArrowDown"?step:0;
 var corner=event.target.closest&&event.target.closest(".heroHeadHandle");
 event.preventDefault();
 if(corner){
  var name=corner.getAttribute("data-corner"),rect=logicalRect();
  var direction=(event.key==="ArrowLeft"||event.key==="ArrowUp")?-1:1;
  var style=getComputedStyle(document.documentElement);
  var min=parseFloat(style.getPropertyValue("--hero-head-min-scale"))||.78;
  var max=parseFloat(style.getPropertyValue("--hero-head-max-scale"))||1.35;
  var next=Math.max(min,Math.min(max,state.scale+direction*(event.shiftKey?.08:.02)));
  applyScaleFromAnchor(next,oppositePoint(rect,name),name);
 }else{
  var next=clampMove(state.x+dx,state.y+dy);state.x=next.x;state.y=next.y;render();
 }
}
document.addEventListener("keydown",onKeydown);
```

When selection opens, retain focus on `#face`; handles enter the tab order. Escape from a handle deselects and restores focus to `#face`. Outside activation must ignore the active handle pointerdown until the operation ends.

- [ ] **Step 5: Keep popcorn/glasses aligned during transformations**

In the movie section of `hero-engine.js`, register:

```js
window.addEventListener("heroheadtransform",function(){
 if(movieMode){syncMovieEffectsLayer();}
});
```

The transform module must dispatch `heroheadtransform` once per rendered frame, after writing transform properties and before the selection overlay is measured. This reuses the existing stage-to-clip projection instead of duplicating popcorn coordinates.

- [ ] **Step 6: Add focus and reduced-motion styling**

Append to `controls.css`:

```css
#face:focus-visible{outline:var(--focus-w) solid var(--ctl-focus);outline-offset:var(--sp-2)}
.heroHeadHandle:focus-visible::before{outline:var(--focus-w) solid var(--ctl-focus);outline-offset:var(--sp-2)}
@media(prefers-reduced-motion:reduce){
 .heroHeadTransform,.heroHeadSelection,.heroHeadHandle{transition:none!important}
}
@media(forced-colors:active){
 .heroHeadSelection::before,.heroHeadHandle::before{forced-color-adjust:auto;box-shadow:inset 0 0 0 var(--selection-line) Highlight}
}
```

- [ ] **Step 7: Run resize, keyboard, and animation checks**

Run:

```bash
node --check hero-head-transform.js
node --check hero-engine.js
python3 tools/hero-head-transform-contract.py
python3 tools/hero-popcorn-browser.py
python3 tools/shared-surfaces-browser.py
```

Expected: PASS; resize keeps the opposite corner within 1px, arrow keys move/resize, and popcorn/glasses remain inside the Hero clip and aligned with the transformed head.

- [ ] **Step 8: Commit resize and animation integration**

```bash
git add hero-head-transform.js hero-engine.js controls.css tools/hero-head-transform-contract.py
git commit -m "Complete Hero portrait transform interaction"
```

---

### Task 4: Responsive Regression and Contract Cleanup

**Files:**
- Modify: `tools/shared-surfaces-contract.py:120-135`
- Modify: `tools/shared-surfaces-browser.py:230-275`
- Modify: `tools/hero-head-transform-contract.py`
- Modify: `docs/superpowers/specs/2026-08-07-hero-head-transform-design.md`

**Interfaces:**
- Consumes: completed entrance rhythm and `HeroHeadController`.
- Produces: stable full-matrix verification with no stale click-to-dizzy or brittle eye-node assumptions.

- [ ] **Step 1: Replace the stale face-click static assertion**

In `tools/shared-surfaces-contract.py`, replace:

```python
assert 'faceImg.addEventListener("click"' in (ROOT / "hero-engine.js").read_text(encoding="utf-8")
```

with:

```python
transform = (ROOT / "hero-head-transform.js").read_text(encoding="utf-8")
assert 'window.HeroHeadTransform={init:init}' in transform
assert 'face.addEventListener("pointerdown",beginMove)' in transform
assert 'tapReact()' not in transform
```

- [ ] **Step 2: Make live-eye assertions resilient to engine DOM rebuilds**

In `tools/shared-surfaces-browser.py`, replace direct chained dereferences such as:

```js
document.querySelector('.eye .iris').style.transform
```

with a guarded fresh lookup on every sample:

```js
(() => {
 const iris=document.querySelector('.eye .iris');
 return iris ? getComputedStyle(iris).transform : null;
})()
```

Use `page.wait_for_selector('.eye .iris')` before the first sample and require at least two non-null samples rather than retaining an element across a face rebuild.

- [ ] **Step 3: Extend the transform matrix to day/night and reload reset**

In `tools/hero-head-transform-contract.py`, run each viewport in `off` and `night` using:

```python
page.evaluate("state => window.SiteTheme.setMode(state,{persist:false})", theme)
page.wait_for_function("state => document.querySelector('#main').dataset.timeState === state", theme)
```

After a move and resize, save `getState()`, call `page.reload(wait_until="load")`, and assert:

```python
assert page.evaluate("window.__heroHeadTransform.getState()") == {
    "selected": False, "x": 0, "y": 0, "scale": 1
}
```

Also assert selection and transform operations do not alter `localStorage.length` except for keys that existed before the operation.

After moving and resizing, verify that the live engine still responds in transformed screen coordinates:

```python
page.wait_for_selector(".eye .iris")
face_box = page.locator("#face").bounding_box()
before_gaze = page.evaluate("""() => {
 const iris=document.querySelector('.eye .iris');
 return iris ? getComputedStyle(iris).transform : null;
}""")
page.mouse.move(face_box["x"] + face_box["width"] * .70,
                face_box["y"] + face_box["height"] * .32)
page.wait_for_timeout(180)
after_gaze = page.evaluate("""() => {
 const iris=document.querySelector('.eye .iris');
 return iris ? getComputedStyle(iris).transform : null;
}""")
assert before_gaze and after_gaze and before_gaze != after_gaze

before_smile = page.locator("#face").get_attribute("src")
page.locator(".csPanel.on .csItem").first.hover()
page.wait_for_timeout(180)
after_smile = page.locator("#face").get_attribute("src")
assert before_smile != after_smile

page.locator('.csTab[data-tab="goodness"]').click()
page.locator("#reelFrame").hover()
page.wait_for_function("document.querySelector('.heroCharacterPeek').classList.contains('is-movie')")
assert page.locator("#heroMovieEffectsClip .popbucket").count() == 1
```

Re-query `.eye .iris` after every engine state transition; never retain an eye element across a face rebuild.

- [ ] **Step 4: Run the complete verification matrix**

Run:

```bash
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

Expected: every command PASS with no console errors, horizontal overflow, selection leakage, light/night geometry change, or animation misalignment.

- [ ] **Step 5: Perform a manual visual review**

At 1440×900, 1280×720, 390×844, and 320×800, verify:

- Resting Hero is clean.
- The desktop Hero retains its original full-scale height at both desktop viewports.
- Selected frame tracks the visible portrait precisely and never leaves a white seam at the Hero bottom.
- Four handles look like 8px Figma handles while remaining easy to touch.
- Drag cannot cross the protected content boundary.
- Every corner grows/shrinks around its opposite corner.
- Case hover smile and Extras popcorn/glasses survive move and resize.
- Off, daytime, and Night keep identical layout geometry.
- Reload restores the authored default.

- [ ] **Step 6: Record implementation completion in the design spec**

Change the design spec status to:

```markdown
**Status:** Implemented and verified
```

Add the final test commands and commit hashes under a `## Verification` heading.

- [ ] **Step 7: Commit verification and documentation**

```bash
git add tools/shared-surfaces-contract.py tools/shared-surfaces-browser.py tools/hero-head-transform-contract.py docs/superpowers/specs/2026-08-07-hero-head-transform-design.md
git commit -m "Verify Hero transform across responsive states"
```
