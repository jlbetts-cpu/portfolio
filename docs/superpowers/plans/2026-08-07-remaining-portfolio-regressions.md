# Remaining Portfolio Regressions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the approved Play, shared-material, footer, icon, thumbnail, and mobile regressions after Hero Tasks 3–4, then prove all ten shipping routes in a light/dark desktop/mobile matrix.

**Architecture:** Introduce one reference-counted Play viewport owner that is authoritative for fixed-arena chrome and scroll state while existing game classes continue to own game art and physics. Move ordinary controls onto the existing shared semantic material roles, keep authored game/canvas/media surfaces intact, and strengthen focused contracts before a final cross-route Playwright gate. Thumbnail warming and haptics remain isolated helpers with injected schedulers/capabilities so their unsupported, cancelled, and reduced-motion paths are unit-testable.

**Tech Stack:** Semantic HTML, shared CSS custom properties, vanilla JavaScript, Node.js unit tests, Python 3 static contracts, Playwright/Chromium browser contracts.

## Global Constraints

- Execute this plan only after Tasks 3 and 4 in `docs/superpowers/plans/2026-08-07-hero-head-transform.md` are complete and their focused contracts pass.
- Work test-first: every task begins with a focused RED assertion, implements the smallest GREEN change, reruns adjacent contracts, and ends in its own commit.
- Preserve the Home Hero at `calc(100svh - 88px)` on desktop and the approved mobile height; do not shrink it to expose work above the fold.
- Keep the Home Hero rimless and preserve the large lower-edge peeking portrait, its approved transform, gaze, blink, smile, popcorn, and glasses alignment.
- Do not restore Home click-to-dizzy. Play may retain game-specific dizzy behavior.
- Do not add a Play-local day/time picker, `hero-time.css`, `hero-time.js`, Home gradient stack, portrait cast, or time-state ambience. Play receives only the global light/Night theme.
- Do not restore the rejected Wii/Arena Select redesign, `pArenaFrame`, `pModeDock`, `pModeRail`, a separate live-head playfield, or duplicate preview stage.
- Do not add a cursor glow, `#cursorGlow`, `.cursorGlow`, or an equivalent pointer-following light.
- Do not recolor authored game art, team colors, pitch, scoreboard art, uploaded faces, builder canvases, or generated output. Shared tokens own only ordinary chrome and containment surfaces.
- Mood pictograms, the `jbLogo`, authored illustrations, scoreboard/trophy/ball imagery, and generated canvas/SVG art are not Lucide utility icons and must remain unchanged.
- The eight normal content routes are `index.html`, `about.html`, `apollo.html`, `bearings.html`, `cluster.html`, `strata.html`, `ucdavis.html`, and resting `play.html`. `gradientlab.html` and `headmaker.html` remain accepted full-viewport footerless exceptions.
- Remove both rejected footer sentences everywhere: “Thanks for checking out my website —” and “I’m open to full-time roles and would love to chat…”. Do not invent replacement footer copy.
- Resting Play remains a normal scrollable document. Only the team picker and live games own the viewport; ownership must restore the exact prior scroll position and launch focus when the last owner exits.
- Warm only non-current 1200w time-thumbnail variants during idle time. Never proactively request a 2400w variant and never promote hidden-panel media to eager/high priority.
- Haptics are enhancement-only. Unsupported browsers and reduced-motion users must receive a no-op; do not claim or emulate iPhone haptics and do not add new haptic moments without a separately approved interaction map.
- Required viewports are 1440×900, 1280×900 where existing contracts use it, 390×844, and 320×800. Home additionally checks 760/761px and a short-height desktop breakpoint.

## File Structure

- `play-viewport.js`: reference-counted Play viewport ownership, scroll/focus capture, and final-owner restoration only.
- `play.html`, `play.css`: owner-driven arena/chrome selectors and shared control/surface composition.
- `play-engine.js`, `play-games.js`, `play-tournament.js`: enter/leave named owners at actual lifecycle boundaries; soccer applies live geometry before survey.
- `controls.css`, `header.css`, `hero-time.css`, `site-theme.css`: canonical opaque header/control material ownership and removal of competing page-specific adapters.
- `gradientlab.html`, `headmaker.html`: consume shared control roles while retaining builder-only layout and authored canvas/media rules.
- Eight footer-bearing HTML files plus `footer.css`: wordmark-only footer after rejected copy removal.
- `ui-icons.svg`: local Lucide utility symbol source.
- `time-aware-thumbnails.js`: selected-state commit plus cancellable idle 1200w warming.
- `haptics.js`: capability/reduced-motion haptic policy; no interaction timing decisions.
- `tools/play-viewport-owner.test.js`, `tools/haptics.test.js`: injected-environment unit contracts.
- `tools/play-browser-smoke.py`, `tools/play-minimal-contract.py`: Play lifecycle, soccer plane, and reversal coverage.
- `tools/shared-controls-contract.py`, `tools/shared-controls-browser.py`, `tools/builder-theme-contract.py`, `tools/builder-theme-browser.py`, `tools/chrome-blend-browser.py`: shared material coverage.
- `tools/footer-consistency-check.py`: eight-route footer structure and rejected-copy contract.
- `tools/lucide-actions-contract.py`: static/browser inventory for non-Mood action icons.
- `tools/time-aware-thumbnails.test.js`, `tools/time-aware-thumbnails-browser.py`, `tools/time-thumbnail-integration.test.js`, `tools/time-thumbnail-integration-browser.py`: explicit eight-instance markup, idle-cache, request-budget, and all-state coverage.
- `tools/shipping-route-matrix.py`: final ten-route light/dark desktop/mobile gate and reversal assertions.

---

### Task 1: Make Play Viewport Ownership a Single State Machine

**Files:**
- Create: `play-viewport.js`
- Create: `tools/play-viewport-owner.test.js`
- Modify: `play.html:90-102, 750-770`
- Modify: `play.css:647-650`
- Modify: `play-games.js:330-420, 599-632`
- Modify: `play-engine.js:2143-2168, 2337-2347, 2801-2823, 2949-2953`
- Modify: `play-tournament.js:1246-1273`
- Modify: `tools/play-minimal-contract.py:45-65`

**Interfaces:**
- Produces: `window.PlayViewportOwner.enter(name)`, `.leave(name)`, `.has(name)`, `.active()`, and `.destroy()`; owner names are exactly `picker`, `soccer`, `battle`, `race`, and `tournament`.
- Produces: one body marker, `playViewportOwned`, and diagnostic `data-play-viewport-owners`; CSS consumes only the marker for fixed arena, header suppression, footer suppression, and scroll lock.
- Consumes: existing launch focus and scroll position, `.playViewport`, `.jbStick`, `.siteFoot`, and existing game-specific classes.

- [ ] **Step 1: Write the failing owner-state unit contract**

Create `tools/play-viewport-owner.test.js` with a fake body/classList, fake active element, and recorded `scrollTo` calls. Require `play-viewport.js` and assert this exact lifecycle:

```js
const assert = require("node:assert/strict");
const {createController} = require("../play-viewport.js");

const h = makeHarness({scrollX: 7, scrollY: 412, focusId: "pcExped"});
const owner = createController(h.options);
owner.enter("picker");
assert.equal(h.body.classList.contains("playViewportOwned"), true);
assert.equal(h.body.dataset.playViewportOwners, "picker");
owner.enter("soccer");
owner.leave("picker");
assert.equal(owner.active(), true);
assert.equal(h.scrollCalls.length, 0);
owner.leave("soccer");
h.flushAnimationFrame();
assert.deepEqual(h.scrollCalls, [[7, 412]]);
assert.equal(h.focusedId(), "pcExped");
assert.equal(h.body.classList.contains("playViewportOwned"), false);
assert.throws(() => owner.enter("unknown"), /Unknown Play viewport owner/);
```

The harness must also prove duplicate `enter("soccer")` calls are idempotent, leaving a non-existent owner is harmless, and `destroy()` clears the marker without focusing a detached element.

- [ ] **Step 2: Run the unit/static contracts to verify RED**

Run:

```bash
node tools/play-viewport-owner.test.js
python3 tools/play-minimal-contract.py
```

Expected: the Node test fails because `play-viewport.js` does not exist; the static Play contract still finds the five-class chrome predicate instead of `playViewportOwned`.

- [ ] **Step 3: Implement the isolated owner controller**

Implement `play-viewport.js` as a UMD-style module that exports `createController` under Node and installs `window.PlayViewportOwner` in the browser. Use a `Set` for the five legal names. On the first `enter`, capture `scrollX`, `scrollY`, and `document.activeElement` before adding `playViewportOwned`. On the last `leave`, remove the marker synchronously and restore scroll/focus in `requestAnimationFrame`; do not restore between nested `tournament`/`soccer` or `picker`/`soccer` owners.

The state update must be equivalent to:

```js
function sync(){
 const active=owners.size>0;
 body.classList.toggle("playViewportOwned",active);
 if(active)body.dataset.playViewportOwners=Array.from(owners).sort().join(" ");
 else delete body.dataset.playViewportOwners;
}
```

Load `play-viewport.js` after `site-theme.js` and before `hero-engine.js`, `play-engine.js`, `play-games.js`, and `play-tournament.js`.

- [ ] **Step 4: Replace the five-class chrome predicate**

In `play.html` and `play.css`, replace only viewport/chrome ownership selectors with:

```css
body.playViewportOwned .playViewport{position:fixed;inset:0;z-index:30;min-height:100svh;padding:0;display:flex}
body.playViewportOwned .playViewport>.wrap{width:100%;max-width:none;padding:0;display:flex}
body.playViewportOwned .hero{display:block;width:100vw;height:60vh;min-height:0;margin:auto;padding:0;overflow:visible;border-radius:0;box-shadow:none;background:transparent}
body.playViewportOwned .jbStick{visibility:hidden;pointer-events:none}
body.hmFull.playViewportOwned{overflow:hidden}
body.playViewportOwned .siteFoot{display:none}
```

Keep `body.pTeamOn .hero` for picker geometry and `hmSoccer`/`hmBattle`/`hmRace`/`hmTour` selectors for game art. Do not alter the global header z-index or `body.hmFull` resting overflow.

- [ ] **Step 5: Wire every lifecycle boundary**

Use the owner API at the lifecycle source of truth:

- `stageShift(true/false)` enters/leaves `picker`.
- `soccer.start()/finish()` enters/leaves `soccer`.
- direct and team battle launch enter `battle`; the battle guardian leaves it in the same branch that removes `hmBattle`.
- race `start()/finish()` enters/leaves `race`.
- tournament `start()/stop()` enters/leaves `tournament`.

For picker-to-game handoff, enter the destination owner before leaving `picker`, so `playViewportOwned` never drops for one frame. Remove `_returnFocus`, `_returnScroll`, `resetPlayScroll()`, and `restorePlayPosition()` from `play-games.js` after all callers use the new controller.

- [ ] **Step 6: Strengthen the static owner contract**

Update `tools/play-minimal-contract.py` to assert the new script order, the single marker selector, all five lifecycle names, and absence of the brittle chrome selector:

```python
assert 'src="play-viewport.js"' in HTML
assert HTML.index('src="play-viewport.js"') < HTML.index('src="play-engine.js"')
assert "body.playViewportOwned .playViewport" in HTML
assert "body.hmFull.playViewportOwned" in CSS
assert "body.playViewportOwned .siteFoot{display:none}" in CSS
assert "body.playViewportOwned .jbStick" in HTML
assert "body:is(.pTeamOn,.hmSoccer,.hmBattle,.hmRace,.hmTour) .playViewport" not in HTML
```

- [ ] **Step 7: Run the owner contracts GREEN**

Run:

```bash
node --check play-viewport.js
node tools/play-viewport-owner.test.js
node --check play-games.js
node --check play-engine.js
node --check play-tournament.js
python3 tools/play-minimal-contract.py
```

Expected: PASS; nested owners keep the viewport locked, and the final owner restores the captured hub position/focus.

- [ ] **Step 8: Commit viewport ownership**

```bash
git add play-viewport.js play.html play.css play-games.js play-engine.js play-tournament.js tools/play-viewport-owner.test.js tools/play-minimal-contract.py
git commit -m "Fix Play viewport ownership"
```

---

### Task 2: Reflow Soccer After the Live Arena Exists

**Files:**
- Modify: `play-engine.js:565-629, 1808-1836, 2143-2168, 2337-2347`
- Modify: `play-games.js:599-632`
- Modify: `tools/play-browser-smoke.py:36-337`
- Modify: `tools/play-minimal-contract.py:70-125`

**Interfaces:**
- Consumes: Task 1 `PlayViewportOwner` and existing companion `resize`→`survey()` path.
- Produces: `syncSoccerArena()` inside the soccer closure; both direct `#soccerGo` and `.pBtnGo` routes reach it through `window.__hmSoccerStart`.
- Produces: browser helpers `assert_viewport_owner(page, expected_owner)` and `assert_soccer_plane(page)`.

- [ ] **Step 1: Rebaseline stale Play browser assumptions and add failing lifecycle assertions**

Delete every `#heroTimeClip`, `#heroTimeBtn`, `#heroTimeMenu`, `[data-time-gradient]`, and `#heroTimePortraitCast` dereference from `tools/play-browser-smoke.py`. Replace them with a negative count assertion and test Play only in global `off`/light and `night`/dark.

Add `assert_viewport_owner` that verifies the owner marker, fixed arena, hidden/non-hit-testable header, hidden footer, and scroll lock:

```python
def assert_viewport_owner(page, owner):
    state = page.evaluate("""owner => {
      const body=document.body, arena=document.querySelector('.playViewport');
      const header=document.querySelector('.jbStick'), footer=document.querySelector('.siteFoot');
      const hs=getComputedStyle(header), fs=getComputedStyle(footer), a=arena.getBoundingClientRect();
      return {owners:(body.dataset.playViewportOwners||'').split(/\s+/).filter(Boolean),
        active:body.classList.contains('playViewportOwned'), overflow:getComputedStyle(body).overflowY,
        arena:{top:a.top,left:a.left,position:getComputedStyle(arena).position},
        header:{visibility:hs.visibility,pointerEvents:hs.pointerEvents}, footerDisplay:fs.display};
    }""", owner)
    assert owner in state["owners"] and state["active"], state
    assert state["overflow"] == "hidden" and state["arena"]["position"] == "fixed", state
    assert abs(state["arena"]["top"]) <= 1 and abs(state["arena"]["left"]) <= 1, state
    assert state["header"] == {"visibility": "hidden", "pointerEvents": "none"}, state
    assert state["footerDisplay"] == "none", state
```

Exercise picker Back, direct soccer End, picker→soccer End, battle End, race End, tournament Stop, and tournament inter-match (`tournament` remains while `soccer` leaves). After each final exit, assert exact prior `scrollY`, focus id, visible header/footer, and no owner marker.

- [ ] **Step 2: Add the failing soccer-plane assertion**

Immediately after kickoff, after two consecutive settled samples, and again after `page.set_viewport_size(...)`, inspect `#playArena`, every visible `[data-hm-boot-ready]`, `.hmBall`, and `.hmGoal`. Require every player rect to remain fully inside the arena and derive each player's visible feet from its box and `window.__hmFOOT`; no foot may fall below `window.__hmFeetY + 2`. Require goal bottoms and the resting ball underside to match `window.__hmFeetY` within 2px, and require every player that is unchanged across the two settled samples to match that same plane within 2px. Run the same helper after direct `#soccerGo` and picker `.pBtnGo` launches; do not require an airborne player to touch the pitch while jumping.

Run: `python3 tools/play-browser-smoke.py`

Expected: FAIL on the stale pre-live player survey and/or header ownership before implementation.

- [ ] **Step 3: Apply live layout before any soccer measurement**

Inside the soccer closure, add:

```js
function syncSoccerArena(){
 if(window.PlayViewportOwner)window.PlayViewportOwner.enter("soccer");
 document.body.classList.add("hmSoccer");
 void hero.offsetHeight;
 try{dispatchEvent(new Event("resize"));}catch(_){}
 geo();
}
```

Call it immediately after the `S.on` guard and `_gyLock=null`, before the first `geo()`, `dom()`, `layout()`, or `teams()`. Remove the old late `classList.add("hmSoccer")`. `finish()` removes `hmSoccer` and then calls `PlayViewportOwner.leave("soccer")`; tournament ownership remains intact when present.

In `startWithTeams()`, remove the pre-kickoff synthetic resize. Enter `soccer`, remove `pTeamOn`, leave `picker`, and call `__hmSoccerStart()`; the soccer closure now owns the only live re-survey.

- [ ] **Step 4: Run the complete Play matrix**

Run:

```bash
node --check play-engine.js
node --check play-games.js
python3 tools/play-minimal-contract.py
python3 tools/play-browser-smoke.py
```

Expected: PASS at 1440×900, 390×844, and 320×800 in off/light and Night/dark. Resting hub scrolls; all five owners suppress chrome; both soccer entry routes and post-resize players share one ground plane.

- [ ] **Step 5: Commit soccer reflow and runtime coverage**

```bash
git add play-engine.js play-games.js tools/play-browser-smoke.py tools/play-minimal-contract.py
git commit -m "Reflow soccer on live arena entry"
```

---

### Task 3: Give the Shared Header One Opaque Material Owner

**Files:**
- Modify: `controls.css:67-72`
- Modify: `header.css:197-211, 303-350`
- Modify: `hero-time.css:257-263`
- Modify: `tools/shared-controls-contract.py`
- Modify: `tools/shared-controls-browser.py`
- Modify: `tools/chrome-blend-browser.py`
- Modify: `tools/lucide-header-browser.py`
- Modify: `tools/hero-gradient-browser.py`

**Interfaces:**
- Consumes: `--ctl-ground`, `--ctl-container-rim`, `.jbNav[data-surface="paper|ink"]`, and current `--r-pill` geometry.
- Produces: `header.css` as the sole source of `.jbNav` background/box-shadow; generic `.ctl-group` no longer paints `.jbNav`.

- [ ] **Step 1: Add failing source-order and computed-material assertions**

In `tools/shared-controls-contract.py`, require:

```python
assert ".ctl-group:not(.jbNav){" in css
assert ".ctl-group{" not in css
assert "--nav-mat:var(--ctl-ground)" in header
assert ':root[data-theme="dark"] .jbNav{' in header
assert '--nav-mat:var(--ctl-ground)' in dark_nav_rule
assert ':root[data-theme="dark"] .jbNav{' not in hero_time_css
```

In `tools/shared-controls-browser.py`, inspect Home, Play, About, and Bearings at 1280, 390, and 320 in off/light and Night/dark. Assert `.jbNav` background alpha is 1, differs from the page ground in ordinary paper state, carries exactly one inset rim, and keeps `999px` radius. On Home, set `data-surface="ink"` and prove its background differs from paper.

Rebaseline `tools/chrome-blend-browser.py`: remove its stale Home Mood lookup; Night header, time, and standalone secondary controls must be opaque semantic surfaces instead of transparent. Preserve its portrait cast/spill assertions. In `tools/hero-gradient-browser.py`, remove the stale `#moodBtn` interaction and exercise the header's paper/ink state through `data-surface` while leaving scene gradients unchanged.

- [ ] **Step 2: Run the focused contracts to verify RED**

Run:

```bash
python3 tools/shared-controls-contract.py
python3 tools/shared-controls-browser.py
python3 tools/chrome-blend-browser.py
```

Expected: FAIL because the later `.ctl-group` still wins and `hero-time.css` still maps the dark header to the page ground.

- [ ] **Step 3: Fix canonical ownership without changing geometry**

Change the generic group rule to:

```css
.ctl-group:not(.jbNav){background:var(--ctl-container-ground);box-shadow:var(--ctl-container-rim)}
```

In `header.css`, set ordinary base, dark, and `jbShrunk` header material to `var(--ctl-ground)` with `var(--ctl-container-rim)`. Keep the current `data-surface="ink"` values, `border-radius:var(--r-pill)`, `corner-shape`, dimensions, z-index, and transitions. Delete the Home-only dark `.jbNav` material block from `hero-time.css`; Hero scene CSS must not own shared header material.

- [ ] **Step 4: Run header/material contracts GREEN**

Run:

```bash
python3 tools/shared-controls-contract.py
python3 tools/shared-controls-browser.py
python3 tools/chrome-blend-browser.py
python3 tools/lucide-header-browser.py
python3 tools/hero-gradient-browser.py
```

Expected: PASS; paper/ink are visibly distinct and opaque, the pill radius is unchanged, and no Home/Play stylesheet load order can repaint the header.

- [ ] **Step 5: Commit header material ownership**

```bash
git add controls.css header.css hero-time.css tools/shared-controls-contract.py tools/shared-controls-browser.py tools/chrome-blend-browser.py tools/lucide-header-browser.py tools/hero-gradient-browser.py
git commit -m "Fix shared header material ownership"
```

---

### Task 4: Move Play and Builder Actions onto Shared Control Materials

**Files:**
- Modify: `controls.css`
- Modify: `play.html:269-422, 687-744`
- Modify: `play.css:618-630, 998-1028`
- Modify: `play-games.js:531-596`
- Modify: `play-engine.js:1861-1885, 2684-2696, 2937-2940`
- Modify: `play-tournament.js` (generated ordinary action class names only)
- Modify: `gradientlab.html:15-409, 166-261, 500-650`
- Modify: `headmaker.html:19-550, 227-267, 700-775`
- Modify: `site-theme.css:209-317`
- Modify: `tools/shared-controls-contract.py`
- Modify: `tools/shared-controls-browser.py`
- Modify: `tools/builder-theme-contract.py`
- Modify: `tools/builder-theme-browser.py`

**Interfaces:**
- Consumes: shared `.ctl`, `.ctl--primary`, `.ctl--secondary`, `.ctl--icon`, `.ctl--quiet`, `.ctl--row`, `.ctl--sm`, `.ctl-menu`, `.surface`, and `.surface--card` roles.
- Produces: `.ctl--card`, a shared solid card-control material/state variant; pages retain only placement, grid, team color, and authored scoreboard/canvas rules.

- [ ] **Step 1: Extend static contracts to fail on local control redraws**

Require both builders to load `controls.css` after `tokens.css` and before `builder-theme.css`/`site-theme.css`. Require Play cards to carry `ctl ctl--card`, picker actions to carry a shared control role, and standalone builder actions to carry primary/secondary/icon roles. Reject page-local declarations that redraw `.ctl`, `.ctl--primary`, `.ctl--secondary`, `.ctl--icon`, `.pBtn`, or basic `.pCard` materials.

Keep local modifiers legal only for layout, for example `.tabs .ctl--tab{flex:1 1 0}` and `.pCards{display:grid}`.

- [ ] **Step 2: Add failing browser material assertions**

Extend the browser contracts to inspect:

- Play `#pcHead`, `#pcExped`, `#pcTour`, `#pcGrad`, picker Back/Shuffle/Edit/Start, and live End controls.
- Gradient Lab `#saveBtn`, `#rndColors`, `#rnd`, `#copyBtn`, and `#pngBtn`.
- Headmaker `#pickPhoto`, `#back2`, `#next2`, `#resetDots`, `#back3`, `#next3`, `[data-pose]`, `#poseRnd`, `#saveFile`, `#restart`, and `#save`.

At 1280, 390, and 320 in light/Night, standalone secondary/card controls must have opaque backgrounds, one inset rim, shared radius/type/state timing, and a minimum 44px hit target. Contained quiet controls may be transparent only when their immediate container is opaque. Preserve team-color chips and authored score/canvas pixels.

- [ ] **Step 3: Add the shared card-control variant**

Add to `controls.css`:

```css
.ctl--card{
 flex-direction:column;align-items:flex-start;justify-content:flex-start;white-space:normal;text-align:left;
 background:var(--ctl-ground);color:var(--ctl-ink-strong);box-shadow:var(--ctl-rim)
}
.ctl--card:hover,.ctl--card:focus-visible{background:var(--ctl-ground-hover);box-shadow:var(--ctl-rim-strong)}
.ctl--card:active{transform:scale(var(--press-scale-lg))}
```

Compose Play hub cards with this variant and remove their raw `--c0`/`--rim-*` material and focus/state copies. Keep card grid, preview, copy, and the approved Add Your Head first ordering unchanged.

- [ ] **Step 4: Compose picker, launcher, and live controls**

Give dynamically generated Back/Shuffle/Edit/Undo `ctl ctl--secondary` (plus `ctl--sm` only where the existing expanded hit area remains), Start `ctl ctl--primary`, hidden launcher rows `ctl ctl--quiet ctl--row`, and live End actions `ctl ctl--quiet ctl--sm`. Keep scoreboard/team/pitch art local; only the action control consumes shared state tokens.

Delete the corresponding raw button-material blocks from `play.html`/`play.css`. Reduce `site-theme.css` Play selectors to semantic art exceptions: team colors, pitch/score art, tournament results, and authored game labels. It must no longer theme basic `.pCard`, `.pBtn`, `.moodItem`, `.moodGo`, or ordinary End button materials.

- [ ] **Step 5: Move both builders onto `controls.css`**

Load `controls.css` in both builders. Delete their duplicated base/primary/secondary/icon control systems. Replace `is-sm` with `ctl--sm`; add `ctl--secondary` to every ordinary standalone action that currently has only `ctl`; retain builder-specific flex/grid placement and stage fields. Do not change canvas, uploaded/generated face media, `hm*` export rules, or the builders' full-viewport behavior.

- [ ] **Step 6: Run shared material contracts GREEN**

Run:

```bash
python3 tools/shared-controls-contract.py
python3 tools/shared-controls-browser.py
python3 tools/builder-theme-contract.py
python3 tools/builder-theme-browser.py
python3 tools/site-theme-contract.py
python3 tools/play-browser-smoke.py
```

Expected: PASS; ordinary action chrome resolves through shared opaque roles in both themes, while game/team/canvas artwork is byte- and color-behavior compatible.

- [ ] **Step 7: Commit shared control migration**

```bash
git add controls.css play.html play.css play-games.js play-engine.js play-tournament.js gradientlab.html headmaker.html site-theme.css tools/shared-controls-contract.py tools/shared-controls-browser.py tools/builder-theme-contract.py tools/builder-theme-browser.py
git commit -m "Unify opaque action materials"
```

---

### Task 5: Remove Rejected Footer Copy and Protect Footer Ownership

**Files:**
- Modify: `footer.css`
- Modify: `index.html`
- Modify: `about.html`
- Modify: `apollo.html`
- Modify: `bearings.html`
- Modify: `cluster.html`
- Modify: `strata.html`
- Modify: `ucdavis.html`
- Modify: `play.html`
- Modify: `tools/footer-consistency-check.py`
- Modify: `tools/play-browser-smoke.py`

**Interfaces:**
- Produces: eight identical structural footers containing `#contact.siteFoot` and one decorative `.footMark`; no `.footReach` or footer contact-link copy.
- Consumes: Task 1 owner marker for resting/live Play visibility.

- [ ] **Step 1: Rewrite the footer contract RED-first**

Change `PAGES` to include `play.html`. Import Python's `html` module, remove `APPROVED_REACH`, `APPROVED_LINKS`, and the 56ch measure assertion. Require both rejected phrases to be absent from the decoded full page source and require no `.footReach` element:

```python
REJECTED = (
    "Thanks for checking out my website",
    "I’m open to full-time roles and would love to chat",
)
assert parser.footer and parser.footer.get("id") == "contact"
assert parser.reach == ""
assert parser.mark == "Jayden Betts"
for phrase in REJECTED:
    assert phrase not in normalise(html.unescape(source))
```

Explicitly assert `gradientlab.html` and `headmaker.html` have no `.siteFoot`, documenting them as the accepted full-viewport exceptions. Update the success message to eight footer-bearing routes.

- [ ] **Step 2: Run the footer contract to verify RED**

Run: `python3 tools/footer-consistency-check.py`

Expected: FAIL on all eight current availability paragraphs and the missing Play inventory entry.

- [ ] **Step 3: Remove copy and dead styling, without replacement prose**

Delete `<p class="footReach">…</p>` from all eight footers. Delete now-unused `.footReach` and `.footIn` rules from `footer.css` and the eight page-local style blocks. Update stale case-study/Home/About comments to say the normal content routes carry a wordmark-only footer and the two builders are full-viewport exceptions; do not claim Play is footerless.

Keep this exact shape:

```html
<footer class="siteFoot" id="contact" role="contentinfo">
 <div class="footMark" aria-hidden="true">Jayden Betts</div>
</footer>
```

- [ ] **Step 4: Keep Play visibility behavior under real transitions**

In `tools/play-browser-smoke.py`, assert the wordmark-only footer is visible, in normal document flow, and reachable at rest; it is `display:none` for each actual owner lifecycle and returns with the same geometry after the last owner exits. Do not retain the older “three footer links remain reachable” assertion because those links were part of the rejected sentence; the shared header Contact menu remains the contact-link surface.

- [ ] **Step 5: Run footer and adjacent theme contracts GREEN**

Run:

```bash
python3 tools/footer-consistency-check.py
python3 tools/play-browser-smoke.py
python3 tools/site-theme-contract.py
python3 tools/shared-surfaces-browser.py
```

Expected: PASS; eight content footers remain structurally reachable, active Play owns and hides its footer, and no rejected sentence survives.

- [ ] **Step 6: Commit footer removal**

```bash
git add footer.css index.html about.html apollo.html bearings.html cluster.html strata.html ucdavis.html play.html tools/footer-consistency-check.py tools/play-browser-smoke.py
git commit -m "Remove rejected footer copy"
```

---

### Task 6: Finish the Non-Mood Lucide Action Inventory

**Files:**
- Modify: `ui-icons.svg`
- Modify: `play.html:687-744`
- Modify: `play-games.js:420-596`
- Modify: `play-engine.js:1861-1885, 2684-2696, 2937-2940`
- Modify: `gradientlab.html:531, 562, 644-646, 1029-1038`
- Modify: `headmaker.html:743-764`
- Create: `tools/lucide-actions-contract.py`
- Modify: `tools/lucide-header-browser.py` only to share sprite-fetch helpers if useful

**Interfaces:**
- Produces local sprite symbols: `lucide-user-plus`, `lucide-circle-dot`, `lucide-trophy`, `lucide-image`, `lucide-bookmark`, `lucide-refresh-cw`, `lucide-dices`, `lucide-copy`, `lucide-download`, `lucide-check`, `lucide-save`, `lucide-trash-2`, and `lucide-square`.
- Produces utility markup shape: `<svg class="gIco uiIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="ui-icons.svg#…"/></svg>`.
- Excludes Mood pictograms, `jbLogo`, authored game illustrations, trophy/ball bitmap art, and builder output SVG/canvas.

- [ ] **Step 1: Create a failing action-icon inventory contract**

Create `tools/lucide-actions-contract.py` with static parsing plus a Playwright matrix at 1280×900, 390×844, and 320×800 in off/light and Night/dark. Use this exact selector map:

```python
EXPECTED = {
  "play.html": {
    "#pcHead": "lucide-user-plus", "#pcExped": "lucide-circle-dot",
    "#pcTour": "lucide-trophy", "#pcGrad": "lucide-image",
    "#soccerGo": "lucide-circle-dot", "#tourGo": "lucide-trophy",
    "#endGame": "lucide-square", ".moodGo[href^='headmaker']": "lucide-user-plus",
    ".moodGo[href^='gradientlab']": "lucide-image",
  },
  "gradientlab.html": {
    "#saveBtn": "lucide-bookmark", "#rndColors": "lucide-refresh-cw",
    "#rnd": "lucide-dices", "#copyBtn": "lucide-copy", "#pngBtn": "lucide-download",
  },
  "headmaker.html": {
    "#poseRnd": "lucide-dices", "#saveFile": "lucide-save", "#save": "lucide-download",
  },
}
```

For each owner, require exactly one `.uiIcon use`, the expected local href, zero inline `path/polyline/rect/circle` children inside that utility icon, `aria-hidden="true"`, `focusable="false"`, painted bounds greater than zero, and shared computed size/stroke. Also inspect dynamically rendered `.teamDel` (`lucide-trash-2`) after seeding `localStorage.hmCompanions` with one `{cut:"images/neutral.webp",eyes:[],marks:[]}` fixture and opening Edit, `.hmScoreEnd` (`lucide-square`) after match launch, and copy-success state (`lucide-check`) after `#copyBtn` activation.

- [ ] **Step 2: Run the icon contract to verify RED**

Run: `python3 tools/lucide-actions-contract.py`

Expected: FAIL because the symbols and `<use>` references do not exist.

- [ ] **Step 3: Add local Lucide symbols and replace action markup**

Copy the named Lucide 24×24 symbol geometry into `ui-icons.svg`, preserving the sprite's inherited `fill:none`, `stroke:currentColor`, linecap/linejoin, and shared stroke-width convention. Replace only the mapped action icons with `<use>` markup. Replace `play-games.js`'s `TRASH` string and `play-engine.js`'s dynamic End strings with the same local references.

In Gradient Lab, retain the original copy icon markup string and set success markup to:

```js
var COPY_OK='<svg class="gIco uiIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="ui-icons.svg#lucide-check"></use></svg>';
```

Do not alter accessible button labels or visible text.

- [ ] **Step 4: Run icon and builder/Play regressions GREEN**

Run:

```bash
python3 tools/lucide-actions-contract.py
python3 tools/lucide-header-browser.py
python3 tools/builder-theme-browser.py
python3 tools/play-browser-smoke.py
```

Expected: PASS; every ordinary action icon is local Lucide, while Mood and authored art remain untouched.

- [ ] **Step 5: Commit the icon migration**

```bash
git add ui-icons.svg play.html play-games.js play-engine.js gradientlab.html headmaker.html tools/lucide-actions-contract.py tools/lucide-header-browser.py
git commit -m "Complete Lucide action migration"
```

---

### Task 7: Make Thumbnail Markup Explicit and Idle-Warm Only 1200w Variants

**Files:**
- Modify: `index.html:1580-1665`
- Modify: `time-aware-thumbnails.js`
- Modify: `tools/time-aware-thumbnails.test.js`
- Modify: `tools/time-thumbnail-integration.test.js`
- Modify: `tools/time-aware-thumbnails-browser.py`
- Modify: `tools/time-thumbnail-integration-browser.py`

**Interfaces:**
- Consumes: `sourceFor(project,state)`, `SiteTheme.subscribe`, the existing request-id commit guard, and all six project registries.
- Produces: `data-time-thumbnail` on all eight current Home thumbnail instances (six projects; Bearings and Apollo each appear twice).
- Produces: cancellable idle scheduler using `requestIdleCallback` with `setTimeout` fallback; warm descriptors contain only `src` for the 1200w file.

- [ ] **Step 1: Expand unit tests RED-first**

Update the harness to create all six projects and inject fake `requestIdleCallback`, `cancelIdleCallback`, `setTimeout`, and `clearTimeout`. Require:

```js
assert.deepEqual(T.PROJECTS,["bearings","apollo","strata","cluster","ucdavis","r3shore"]);
assert.equal(images.length,8);
assert.equal(images.filter(img=>img.getAttribute("loading")==="eager").length,1);
assert.equal(images.filter(img=>img.getAttribute("fetchpriority")==="high").length,1);
```

After the selected state decodes and commits, flush idle callbacks and assert every queued warm loader has a `-1200.webp` `src`, empty `srcset`, and no `sizes`; the current state is excluded. Assert a new state cancels/reschedules remaining idle work, `pagehide({persisted:true})` preserves it, `pagehide({persisted:false})` cancels it, and a late idle callback cannot mutate targets after `destroy()`.

Remove the integration fallback expectation: `document.querySelectorAll("img[data-time-thumbnail]")` must directly return all eight images, and `.csItem img.csImg` discovery is no longer part of the production contract.

- [ ] **Step 2: Run thumbnail unit tests to verify RED**

Run:

```bash
node tools/time-aware-thumbnails.test.js
node tools/time-thumbnail-integration.test.js
```

Expected: FAIL on four marked images and missing idle scheduling/cancellation.

- [ ] **Step 3: Make all thumbnail ownership explicit**

Add `data-time-thumbnail="ucdavis|strata|cluster|r3shore"` to their Case Studies panel images. Preserve both duplicated Bearings/Apollo markers. Keep only the first visible Bearings image as `loading="eager" fetchpriority="high"`; Apollo and every hidden-panel image remain lazy with no high priority.

Remove the `.csItem img.csImg` fallback scan and `closest()` inference from `time-aware-thumbnails.js`. A missing/invalid marker is not silently guessed.

- [ ] **Step 4: Implement bounded idle warming**

After a successful selected-state commit, build a queue for every rendered project and every non-`off`, non-current state using only `sourceFor(project,state).src`. Process at most one asset on a timeout fallback and as many as `deadline.timeRemaining() > 4` allows under native idle callbacks. Cache failures remain retryable. Store and cancel the outstanding idle handle on a newer commit, non-persisted `pagehide`, and `destroy()`.

Use this scheduling boundary:

```js
function warmSource(project,state){return {src:sourceFor(project,state).src,srcset:"",sizes:""};}
function scheduleWarm(current){
 cancelWarm();
 warmQueue=[];
 PROJECTS.forEach(project=>{
  if(!groups[project].length)return;
  STATES.forEach(state=>{if(state!=="off"&&state!==current)warmQueue.push(warmSource(project,state));});
 });
 scheduleNextIdle();
}
```

The warming path calls the existing `preload()` but never calls `commit()`.

- [ ] **Step 5: Strengthen browser request coverage**

Expand `tools/time-aware-thumbnails-browser.py` and `tools/time-thumbnail-integration-browser.py` to all six projects, all eight instances, and all seven states. Record resource URLs before selected-state commit and after an injected idle flush. Assert:

- initial load contains only authored/LCP media plus the selected state's responsive requests;
- after idle, every non-current 1200w URL has a completed resource/cache entry;
- no 2400w URL appears solely because of the warmer;
- 2400w appears only when Chromium selects it for a rendered DPR/size;
- `alt`, `loading`, `decoding`, `fetchpriority`, aspect ratio, and frame geometry remain unchanged;
- no flash, failed request, layout shift, or horizontal overflow occurs at 1280, 390, or 320.

- [ ] **Step 6: Run thumbnail contracts GREEN**

Run:

```bash
node --check time-aware-thumbnails.js
node tools/time-aware-thumbnails.test.js
node tools/time-thumbnail-integration.test.js
python3 tools/time-thumbnail-integration-assets.py
python3 tools/time-aware-thumbnails-browser.py
python3 tools/time-thumbnail-integration-browser.py
```

Expected: PASS; all eight DOM images are explicit and only idle 1200w variants are warmed.

- [ ] **Step 7: Commit thumbnail warming**

```bash
git add index.html time-aware-thumbnails.js tools/time-aware-thumbnails.test.js tools/time-thumbnail-integration.test.js tools/time-aware-thumbnails-browser.py tools/time-thumbnail-integration-browser.py
git commit -m "Warm time thumbnails while idle"
```

---

### Task 8: Centralize Existing Haptics and Complete the Mobile Interaction Gate

**Files:**
- Create: `haptics.js`
- Create: `tools/haptics.test.js`
- Modify: `index.html` (script loading only)
- Modify: `play.html` (script loading only)
- Modify: `hero-engine.js:332-921, 1474`
- Modify: `tools/hero-head-transform-contract.py`
- Modify: `tools/shared-controls-browser.py`
- Modify: `tools/builder-theme-browser.py`
- Modify: `tools/play-browser-smoke.py`

**Interfaces:**
- Produces: `SiteHaptics.pulse(pattern): boolean`, `SiteHaptics.supported(): boolean`, and CommonJS `createHaptics(options)` for injected tests.
- Consumes: every existing direct `navigator.vibrate(...)` call site only; no new interaction receives haptics in this task.

- [ ] **Step 1: Write failing capability/reduced-motion tests**

Create `tools/haptics.test.js` and assert:

```js
const assert=require("node:assert/strict");
const {createHaptics}=require("../haptics.js");

let calls=[];
let h=createHaptics({navigator:{vibrate:p=>{calls.push(p);return true;}},reducedMotion:()=>false});
assert.equal(h.supported(),true);
assert.equal(h.pulse([18,40,18]),true);
assert.deepEqual(calls,[[18,40,18]]);

h=createHaptics({navigator:{vibrate:p=>{calls.push(p);return true;}},reducedMotion:()=>true});
assert.equal(h.pulse(20),false);
h=createHaptics({navigator:{},reducedMotion:()=>false});
assert.equal(h.supported(),false);
assert.equal(h.pulse(20),false);
```

Also assert thrown platform errors are caught and return `false`, and the module performs no vibration at import time.

- [ ] **Step 2: Run the haptic test to verify RED**

Run: `node tools/haptics.test.js`

Expected: FAIL because `haptics.js` does not exist.

- [ ] **Step 3: Implement the enhancement-only policy**

Implement a small UMD module. `supported()` is true only when `navigator.vibrate` is a function. `pulse()` returns false without calling the platform when unsupported or when `matchMedia('(prefers-reduced-motion: reduce)').matches`; otherwise it calls `navigator.vibrate(pattern)` inside `try/catch` and returns the platform boolean.

Load it before `hero-engine.js` on Home and Play. Replace every direct `navigator.vibrate(...)` call in `hero-engine.js` with `window.SiteHaptics&&window.SiteHaptics.pulse(...)`. Do not add a fallback animation, audio cue, or new haptic trigger.

- [ ] **Step 4: Add mobile coarse-pointer assertions**

At 390×844 and 320×800 with `has_touch=True`, `is_mobile=True`, and reduced motion enabled, extend existing browser suites to assert:

- every visible action target is at least 44×44px (compact visual controls may use their existing expanded pseudo-element hit area);
- Hero transform handles remain fully hit-testable and do not block work tabs/time control;
- Contact first tap opens its menu and a second destination tap navigates normally;
- Play picker chips/Back/Start and builder actions stay inside the viewport;
- no horizontal overflow, cropped gradient, or unexpected vertical gap appears;
- `navigator.vibrate` absence does not throw or block any action.

- [ ] **Step 5: Run haptic/mobile contracts GREEN**

Run:

```bash
node --check haptics.js
node tools/haptics.test.js
node --check hero-engine.js
python3 tools/hero-head-transform-contract.py
python3 tools/shared-controls-browser.py
python3 tools/builder-theme-browser.py
python3 tools/play-browser-smoke.py
```

Expected: PASS. Existing capable-browser cues remain; reduced-motion and iOS-like unsupported environments are silent no-ops.

- [ ] **Step 6: Commit haptic policy and mobile coverage**

```bash
git add haptics.js index.html play.html hero-engine.js tools/haptics.test.js tools/hero-head-transform-contract.py tools/shared-controls-browser.py tools/builder-theme-browser.py tools/play-browser-smoke.py
git commit -m "Centralize optional haptic feedback"
```

---

### Task 9: Add the Final Ten-Route Regression Matrix

**Files:**
- Create: `tools/shipping-route-matrix.py`
- Modify: `tools/hero-gradient-browser.py`
- Modify: `tools/chrome-blend-browser.py`
- Modify: `tools/play-browser-smoke.py` only if final integration exposes a focused gap

**Interfaces:**
- Consumes: all focused contracts and completed Hero transform Tasks 3–4.
- Produces: one final route gate over ten shipping routes, four canonical viewports, two themes, touch/keyboard, reduced motion, forced colors, and explicit reversal assertions.

- [ ] **Step 1: Create the final matrix contract**

Define:

```python
ROUTES = (
 "index.html","about.html","apollo.html","bearings.html","cluster.html",
 "strata.html","ucdavis.html","play.html","gradientlab.html","headmaker.html",
)
VIEWPORTS = (("desktop-1440",1440,900),("desktop-1280",1280,900),
             ("mobile-390",390,844),("mobile-320",320,800))
THEMES = ("off","night")
FOOTER_ROUTES = set(ROUTES) - {"gradientlab.html","headmaker.html"}
```

For every cell, collect page errors, console errors, HTTP ≥400 responses, request failures, broken `img` elements, document overflow, header computed material/radius, visible target sizes, theme state, and footer presence. Require:

- one visible shared header with opaque background and unchanged `999px` pill radius;
- no horizontal overflow and no broken images;
- visible interactive controls have a 44px target or a tested 44px pseudo-target;
- footer exists only on `FOOTER_ROUTES`; resting Play footer is visible;
- header Contact opens by keyboard and touch, Escape restores focus, and its three destinations remain accessible there;
- light/Night changes semantic chrome without changing geometry;
- no page errors under reduced motion and no illegible focus in forced colors.

- [ ] **Step 2: Add explicit reversal/static assertions**

The matrix's static preflight must assert:

```python
play = (ROOT / "play.html").read_text(encoding="utf-8")
engine = (ROOT / "hero-engine.js").read_text(encoding="utf-8")
home = (ROOT / "index.html").read_text(encoding="utf-8")
for rejected in ("pArenaFrame","pModeDock","pModeRail","play-select.css"):
    assert rejected not in play
for rejected in ('id="heroTime"','id="heroTimeBtn"','data-time-gradient=','src="hero-time.js"','href="hero-time.css"'):
    assert rejected not in play
assert 'id="cursorGlow"' not in home and ".cursorGlow" not in home and "cursorGlow" not in engine
assert 'faceImg.addEventListener("click",()=>{if(CALIB||eventLock)return;tapReact();});' not in engine
assert "min-height:calc(100svh - 88px)" in home
```

Also assert all eight content sources exclude both rejected footer phrases, Add Your Head remains the first Play card, and no new local Play time/gradient script was added.

- [ ] **Step 3: Add focused Home breakpoint and seam coverage**

Extend `tools/hero-gradient-browser.py` with Off in the top-seam pixel sampler and cover 760×844, 761×844, and 1280×650. At each breakpoint assert the Hero remains the approved full-height/rimless composition, gradients fill without stretching/cropping, Off has zero atmosphere/cast and only the floor shadow, and the transform/selection does not change default Hero geometry.

- [ ] **Step 4: Run every focused and final gate**

Run:

```bash
python3 tools/footer-consistency-check.py
python3 tools/play-minimal-contract.py
node tools/play-viewport-owner.test.js
python3 tools/play-browser-smoke.py
python3 tools/shared-controls-contract.py
python3 tools/shared-controls-browser.py
python3 tools/shared-surfaces-contract.py
python3 tools/shared-surfaces-browser.py
python3 tools/builder-theme-contract.py
python3 tools/builder-theme-browser.py
python3 tools/lucide-header-browser.py
python3 tools/lucide-actions-contract.py
python3 tools/site-theme-contract.py
node tools/time-aware-thumbnails.test.js
node tools/time-thumbnail-integration.test.js
python3 tools/time-thumbnail-integration-assets.py
python3 tools/time-aware-thumbnails-browser.py
python3 tools/time-thumbnail-integration-browser.py
node tools/haptics.test.js
python3 tools/hero-entrance-rhythm-contract.py
python3 tools/hero-head-transform-contract.py
python3 tools/hero-gradient-browser.py
python3 tools/chrome-blend-browser.py
python3 tools/hero-popcorn-browser.py
python3 tools/work-collection-contract.py
python3 tools/shipping-route-matrix.py
python3 tools/hm-check.py
python3 -m compileall -q tools
node --check play-viewport.js
node --check play-engine.js
node --check play-games.js
node --check play-tournament.js
node --check time-aware-thumbnails.js
node --check haptics.js
git diff --check
```

Expected: every command passes with no console/page/network errors, broken media, overflow, stale reversal, footer copy, or light/Night geometry drift.

- [ ] **Step 5: Perform the bounded manual visual review**

Review screenshots for Home, About, one case study, resting/live Play, Gradient Lab, and Headmaker at 1440×900, 390×844, and 320×800 in light/Night. Confirm:

- opaque header/control surfaces and one rim;
- resting Play scroll/footer, owner chrome suppression, and exact restoration;
- soccer players, ball, and goals share one pitch;
- wordmark-only footer composition on content routes;
- non-Mood icons are Lucide and Mood/art are unchanged;
- thumbnails switch immediately after warm-up without eager flooding;
- no Home Hero shrink, cursor glow, Home dizzy, Play day picker/gradient, or Wii redesign.

- [ ] **Step 6: Commit the final regression gate**

```bash
git add tools/shipping-route-matrix.py tools/hero-gradient-browser.py tools/chrome-blend-browser.py tools/play-browser-smoke.py
git commit -m "Verify remaining portfolio regressions"
```

## Execution Notes

- Stop after any RED test fails for a reason other than the intended missing behavior; diagnose that mismatch before implementation.
- Do not combine P0 commits. Play ownership/reflow, shared materials, and footer removal each need an independent review gate.
- Do not push from an implementation task. After Task 9, obtain an independent final review, resolve Critical/Important findings, verify the worktree contains only owned changes, and push only with explicit authorization.
- Haptic scope is intentionally conservative: this plan centralizes and tests existing cues only. A new site-wide haptic interaction map remains a product decision, not an implementation assumption.
