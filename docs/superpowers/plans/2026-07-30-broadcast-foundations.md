# Broadcast Foundations Implementation Plan (Plan 1 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the invisible infrastructure every broadcast-package system depends on: the match event bus + session history, the `fxAt` coordinate transform, the `__hmSlow` timescale, the Archivo display face, the materials toolkit (grain, seeded jitter, shadow pair, sheen, stinger), and the `CUP_ID` registry.

**Architecture:** Everything lands inside `index.html` (the site is a no-build single file). The soccer engine only ever *emits* events; all presentation systems are bus consumers. New globals are limited to `__hmBus`, `__hmSess`, `__hmSlow`/`__hmSlowRamp`, `fxAt` (module-local, exposed as `__hmFxAt`), and `CUP_ID` (module-local to the tournament script). Materials are CSS tokens + tiny JS helpers, applied to tournament surfaces in later plans.

**Tech Stack:** Vanilla ES5-style JS (match the file's `var`/classic-function idiom), plain CSS on the site's token system, Archivo variable woff2 (OFL), no dependencies.

**Roadmap context:** This is Plan 1 of 5. Later plans (written at each phase boundary): 2 Boards (scoreboard/split-flap/Draw Board), 3 Match presentation (goal grammar/director/ticker/personas/crowd), 4 Ceremonies (versus/walkout/FT/POTM/champion), 5 Sound.

## Global Constraints (from the spec — every task inherits these)

- Two shadows, one light direction; one grain layer over the whole composite; per-element jitter seeded per cup.
- Never pure `#000`/`#fff`, uniform gradients, symmetrical highlights, identical repeats, perfect alignment.
- All motion transform/opacity only; under reduced-motion every sequence collapses to an instant state change.
- **Archivo touches numerals and moments only**; Instrument Sans keeps names/labels/UI at 400/600. Digits always `tabular-nums lining-nums`, one digit per fixed-width cell.
- No fake data anywhere; stats must come from real tracked events.
- Play menu untouched. Capsule sizing stays min-height-only. Schedule stays a plain `<section>`.
- `index.html` defines things twice — before adding any rule or function, grep for ALL existing occurrences of the selector/name.
- `@media` adds no specificity — scope mobile overrides (`.tourPanel .foo`, never bare `.foo`).
- `filter` creates stacking contexts — never put `filter` on an ancestor of (future) 3D flap cells; brightness jitter on such containers uses background-color shifts, not `filter`.
- Final feel checks happen in real Chrome at `http://localhost:4173` (the pane throttles rAF and white-screens on ink filters).

## Harness (referenced by test steps)

**Serve:** `cd /Users/jaydenbetts/Downloads/portfolioo_v392 && python3 -m http.server 4173` (background).

**Syntax check (run after every index.html edit):** save once as `/tmp/hm-check.py` in Task 1, then `python3 /tmp/hm-check.py`:

```python
import re, subprocess, tempfile, sys
html = open('/Users/jaydenbetts/Downloads/portfolioo_v392/index.html').read()
blocks = re.findall(r'<script([^>]*)>(.*?)</script>', html, re.S)
fail = 0
for i, (attrs, body) in enumerate(blocks):
    if 'ld+json' in attrs or not body.strip(): continue   # JSON-LD always "fails"; skip
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
        f.write(body); p = f.name
    r = subprocess.run(['node', '--check', p], capture_output=True, text=True)
    if r.returncode: fail = 1; print('block', i, 'FAIL\n', r.stderr[:400])
print('syntax OK' if not fail else 'SYNTAX FAILURES'); sys.exit(fail)
```

Always run this against `git show HEAD:index.html` first if a failure looks pre-existing.

**Seed a deterministic roster (paste in the browser console, then hard-reload):**

```js
fetch('/egghead-seed.js').then(r=>r.text()).then(t=>{eval(t);
  const base=window.__EGGHEAD, cols=['#e93d3d','#e9b83d','#3de95c','#3dc9e9','#3d5ce9','#b83de9'];
  Promise.all(cols.map((c,i)=>window.__hmTint(base.cut,c).then(cut=>({
    ...base, cut, name:'Seed'+(i+1),
    // Perturb eyes per head: the roster dedupe collapses heads whose metadata
    // matches, so identical eyes/marks reduce 6 seeds to 1 on reload.
    eyes: base.eyes.map(e=>({...e, x:e.x+i*0.001}))
  })))).then(list=>{
      localStorage.setItem('hmCompanions', JSON.stringify(list));
      localStorage.setItem('hmCompanion', JSON.stringify(list[0]));
      console.log('seeded', list.length); });});
```

If `__hmTint` resolves differently (it may be callback-style — check its definition near the `__hmTint=tint` registration at the end of the add-placeholder IIFE), adapt the call; the requirement is six structurally-valid heads with UNIQUE `cut` strings >15000 chars.

**Drive one fixture to completion:** click Play → Tournament, then `document.querySelector('.tCupGo').click()`, wait for kickoff, then `window.__hmTourWin(1,5,1); window.__hmSoccerEnd();` and wait ≥6s (the 5600ms celebration window) before expecting the bracket back.

---

### Task 1: Archivo variable font ships

**Files:**
- Create: `fonts/archivo-variable.woff2`
- Modify: `index.html` (licence header comment block at top; `@font-face` beside the Instrument faces; one utility class near the tournament CSS)
- Create: `/tmp/hm-check.py` (the Harness syntax checker, for all later tasks)

**Interfaces:**
- Produces: `@font-face 'Archivo'` (wght 100–900, wdth 62%–125%) and class `.bcNum` — later plans set digits with `class="bcNum"` plus `font-variation-settings:'wdth' 68; font-weight:800` (board) or `'wdth' 70; 850` (FT card).

- [ ] **Step 1: Download the latin-subset variable woff2**

```bash
cd /Users/jaydenbetts/Downloads/portfolioo_v392/fonts
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
curl -s -A "$UA" "https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,100..900&display=swap" -o /tmp/archivo.css
python3 - <<'EOF'
import re, urllib.request
css = open('/tmp/archivo.css').read()
blocks = re.findall(r'/\*\s*([a-z-]+)\s*\*/\s*@font-face\s*{([^}]+)}', css)
for subset, body in blocks:
    if subset == 'latin':
        url = re.search(r'url\((https://[^)]+\.woff2)\)', body).group(1)
        urllib.request.urlretrieve(url, 'archivo-variable.woff2')
        print('saved', url)
EOF
ls -la archivo-variable.woff2   # expect ~90KB
```

- [ ] **Step 2: Verify axes and tnum on-file**

```bash
python3 - <<'EOF'
from fontTools.ttLib import TTFont
t = TTFont('/Users/jaydenbetts/Downloads/portfolioo_v392/fonts/archivo-variable.woff2')
axes = [(a.axisTag, a.minValue, a.maxValue) for a in t['fvar'].axes]
feats = {fr.FeatureTag for fr in t['GSUB'].table.FeatureList.FeatureRecord}
assert ('wght', 100.0, 900.0) in axes and ('wdth', 62.0, 125.0) in axes, axes
assert 'tnum' in feats
print('axes + tnum OK')
EOF
```

Expected: `axes + tnum OK`. If assertion fails, the download grabbed a per-instance file — re-check the css2 URL includes the axis ranges.

- [ ] **Step 3: Add licence notice, @font-face, and the .bcNum utility**

At the top of `index.html`, find the existing licence comment block (it holds the Tabler MIT notice) and append inside it:

```
Archivo (c) The Archivo Project Authors (https://github.com/Omnibus-Type/Archivo),
SIL Open Font License 1.1 (https://openfontlicense.org). Used for tournament
numerals and broadcast moments only.
```

Beside the existing Instrument `@font-face` rules add:

```css
@font-face{font-family:'Archivo';src:url('fonts/archivo-variable.woff2') format('woff2');
  font-weight:100 900;font-stretch:62% 125%;font-display:swap}
```

Near the tournament CSS (grep `---- TOURNAMENT PANEL` for the section) add — after grepping that `.bcNum` does not already exist anywhere:

```css
/* Broadcast digits: Archivo, tabular, condensed. The display face touches numerals
   and moments ONLY -- names, labels and UI stay Instrument Sans 400/600. */
.bcNum{font-family:'Archivo',var(--sans);font-variant-numeric:tabular-nums lining-nums;
  font-variation-settings:'wdth' 68;font-weight:800;letter-spacing:.01em}
```

- [ ] **Step 4: Save the Harness checker to /tmp/hm-check.py and run it**

Run: `python3 /tmp/hm-check.py` → Expected: `syntax OK`.

- [ ] **Step 5: Verify the face loads and condenses in the browser**

Serve on :4173, load the page, console:

```js
document.fonts.load('800 40px Archivo').then(()=>{
  const s=document.createElement('span'); s.textContent='0123456789';
  s.style.cssText='font-family:Archivo;font-weight:800;font-size:40px;position:absolute';
  document.body.appendChild(s); const w1=s.getBoundingClientRect().width;
  s.style.fontVariationSettings="'wdth' 68"; const w2=s.getBoundingClientRect().width;
  console.log('normal',w1,'condensed',w2, w2<w1*0.85?'OK':'FAIL'); s.remove();});
```

Expected: `OK` (width-68 digits ≥15% narrower than default).

- [ ] **Step 6: Commit**

```bash
git add fonts/archivo-variable.woff2 index.html
git commit -m "Archivo variable ships: the cup's display face, numerals-and-moments only"
```

---

### Task 2: Match event bus, emitted from the soccer engine

**Files:**
- Modify: `index.html` — the script block containing the soccer IIFE (`(function soccer(){`); the bus goes at that block's module scope, immediately BEFORE the soccer IIFE.

**Interfaces:**
- Produces: `window.__hmBus` with `on(type, fn)`, `off(type, fn)`, `emit(type, data)`. Event types + payloads (later plans consume exactly these):
  - `'kickoff'` `{seed}` — each countdown start
  - `'shot'` `{dir}` (+1 toward blue goal, −1 toward red) — throttled ≥1s apart
  - `'woodwork'` `{x, y}` — ball hits crossbar/post clamp
  - `'goal'` `{team, red, blue, scorer}` — team 0/1, running score, scorer slot (or null)
  - `'fulltime'` `{winner, red, blue}` — winner 0/1
- Grep first: confirm `__hmBus` appears nowhere in the file before declaring.

- [ ] **Step 1: Add the bus**

Immediately before `(function soccer(){`:

```js
/* ---- MATCH EVENT BUS. The engine only EMITS; every presentation system (ticker,
   director, sound, stats) is a consumer. A throwing consumer must never break
   the engine, hence the try/catch per listener. */
var BUS=(function(){var subs={};return{
  on:function(t,f){(subs[t]=subs[t]||[]).push(f);return f;},
  off:function(t,f){var l=subs[t]||[],i=l.indexOf(f);if(i>=0)l.splice(i,1);},
  emit:function(t,d){var l=(subs[t]||[]).slice();
    for(var i=0;i<l.length;i++){try{l[i](d,t);}catch(_){}}}
};})();
window.__hmBus=BUS;
```

- [ ] **Step 2: Wire the five emissions into the engine**

Anchors are function names, not line numbers (they drift):

1. In `kickoffCountdown()` (grep `function kickoffCountdown`), after `S.kickSeed++`: `BUS.emit('kickoff',{seed:S.kickSeed});`
2. In `goalIn(...)` (grep `function goalIn`), right before the existing `window.__hmTourGoal` call: read `goalIn`'s parameter names and the variable it passes to `__hmTourGoal` as the scorer slot, then `BUS.emit('goal',{team:<goalIn's team arg>,red:S.red,blue:S.blue,scorer:<scorer slot or null>});`
3. In `win()` (grep `function win(`), first line: `BUS.emit('fulltime',{winner:<win's team arg>,red:S.red,blue:S.blue});`
4. In the ball-physics crossbar/post clamp inside `loop()` (grep `crossbar` in the comments around the ceiling/goal clamps): `BUS.emit('woodwork',{x:S.ball.x,y:S.ball.y});`
5. Shots — in `loop()` after ball velocity integration, add a throttled check (declare `var lastShot=0;` at the soccer IIFE's state declarations):

```js
var sp=Math.abs(S.ball.vx);
if(sp>900 && performance.now()-lastShot>1000){
  var dir=S.ball.vx>0?1:-1, gx=dir>0?XR:XL;
  if(Math.abs(gx-S.ball.x)<300){lastShot=performance.now();BUS.emit('shot',{dir:dir});}
}
```

`XR`/`XL` are the existing pitch-edge variables from `geo()`; confirm their in-scope names at the insertion point (they may live on a geometry object — read `geo()` first and use its actual names).

- [ ] **Step 3: Syntax check** — `python3 /tmp/hm-check.py` → `syntax OK`.

- [ ] **Step 4: Verify emissions live**

Seed the roster (Harness), reload, console:

```js
const seen={}; ['kickoff','shot','woodwork','goal','fulltime']
  .forEach(t=>window.__hmBus.on(t,d=>{seen[t]=(seen[t]||0)+1;}));
```

Start a Tournament, kick off, let it run ~30s, then `seen`. Expected: `kickoff ≥1`, `shot ≥1`; then drive `__hmTourWin(1,5,1); __hmSoccerEnd();` and confirm `goal` and `fulltime` fired via the drive (if the drive bypasses `goalIn`, score one live goal by waiting instead — `goal` must be ≥1 from live play before this step passes).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Match event bus: the engine emits, presentation subscribes"
```

---

### Task 3: Session history + derived narrative flags

**Files:**
- Modify: `index.html` — same script block, right after the BUS declaration; plus one consumer registration in the tournament script block (grep `function startFixture`).

**Interfaces:**
- Consumes: `window.__hmBus` events from Task 2.
- Produces: `window.__hmSess` = `{head:{[slot]:{goals,played,titles}}, pair:{[key]:{count,lastWinner}}, cups:0}`; helper `window.__hmSessFlags(slotA, slotB)` → `{revenge:bool, met:bool, lastWinner:slot|null, firstGoalPending:{[slot]:bool}}`. The ticker (Plan 3) and versus card (Plan 4) consume `__hmSessFlags`.

- [ ] **Step 1: Add the store + consumers (after BUS, before the soccer IIFE)**

```js
/* ---- SESSION MEMORY. Real numbers only: everything here is derived from bus
   events, never invented. Keyed by head slot; pairs keyed order-independently. */
window.__hmSess=window.__hmSess||{head:{},pair:{},cups:0};
function sessHead(sl){var h=window.__hmSess.head;
  return h[sl]=h[sl]||{goals:0,played:0,titles:0};}
function sessPairKey(a,b){return a<b?a+'|'+b:b+'|'+a;}
BUS.on('goal',function(d){if(d.scorer!=null)sessHead(d.scorer).goals++;});
window.__hmSessFlags=function(a,b){
  var p=window.__hmSess.pair[sessPairKey(a,b)];
  return{met:!!p,revenge:!!p&&p.lastWinner!=null,
    lastWinner:p?p.lastWinner:null,
    firstGoalPending:{[a]:!sessHead(a).goals,[b]:!sessHead(b).goals}};};
```

Note: the computed-key object literal (`{[a]:...}`) is ES6 — this file already uses arrow-free ES5 style; if `node --check` accepts it (it will; the block is a classic script but computed keys are fine), keep it; otherwise build the object imperatively.

- [ ] **Step 2: Record pair results where the tournament knows captains**

In the tournament block, find `__hmTourWin` (grep `function`-assignment `__hmTourWin`). After it records the winner, add — using its in-scope fixture object to get the two captain slots (read how `startFixture` derives captains; the captain slot is the first member of each squad):

```js
try{
  var ka=<captain slot team A>, kb=<captain slot team B>, kw=<winning captain slot>;
  var pk=(ka<kb?ka+'|'+kb:kb+'|'+ka), P=window.__hmSess.pair;
  P[pk]=P[pk]||{count:0,lastWinner:null}; P[pk].count++; P[pk].lastWinner=kw;
  window.__hmSess.head[ka]=window.__hmSess.head[ka]||{goals:0,played:0,titles:0};
  window.__hmSess.head[kb]=window.__hmSess.head[kb]||{goals:0,played:0,titles:0};
  window.__hmSess.head[ka].played++; window.__hmSess.head[kb].played++;
}catch(_){}
```

The `<...>` names must be resolved by reading `__hmTourWin`/`T.cur`'s actual shape (`T.cur` holds the current fixture; its team objects hold member slots). This read-then-wire is the task's real work — do not guess field names.

- [ ] **Step 3: Syntax check** — `python3 /tmp/hm-check.py` → `syntax OK`.

- [ ] **Step 4: Verify across two fixtures**

Seed, start a tournament, drive two fixtures (Harness drive, waiting the 5600ms window between them), then:

```js
JSON.stringify(window.__hmSess)
```

Expected: two `pair` entries with `count:1` and a non-null `lastWinner`; `head` entries with `played:1` each. Then `window.__hmSessFlags(<slotA>,<slotB>)` for a played pair → `{met:true, revenge:true, ...}`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Session memory: head/pair history + narrative flags, all bus-derived"
```

---

### Task 4: `fxAt` transform + `__hmSlow` timescale

**Files:**
- Modify: `index.html` — soccer IIFE (`loop()`, `geo()`) and one exposure line.

**Interfaces:**
- Consumes: `window.__hmFX` (exists: `burst/ring/spark/flash/tint/hitstop/shake/clear`).
- Produces: `window.__hmFxAt(ex, ey)` → `{x, y}` in the FX canvas's expected (hero-local) space; `window.__hmSlow` (number, default 1) multiplying the physics `dt`; `window.__hmSlowRamp(target, ms, holdMs)` — ramps `__hmSlow` to `target` over `ms`, holds `holdMs`, ramps back to 1 over `ms`. Plan 3's goal grammar consumes both.

- [ ] **Step 1: Determine the two coordinate spaces**

Read `geo()`/`layout()` in the soccer IIFE and the FX canvas setup (grep `__hmFX`; its comment says it takes HERO-LOCAL coords and converts `+heroLeft` internally). Determine what origin/scale `S.ball.x/y` uses vs what `FX.burst(x,y)` expects. Write the one-line mapping accordingly, e.g. if engine x is already hero-local and y is measured from the stage floor:

```js
function fxAt(ex,ey){return{x:ex, y:groundY-ey};}   // ADAPT after reading geo()
window.__hmFxAt=fxAt;
```

The signature and export name are fixed; the body is whatever the read dictates.

- [ ] **Step 2: Verify the mapping visually**

Seed, start a soccer match (Play → Soccer), console during play:

```js
setInterval(()=>{const S=window.__hmSoccer;if(!S||!S.on)return;
  const p=window.__hmFxAt(S.ball.x,S.ball.y);
  window.__hmFX.ring(p.x,p.y,{r0:20,r1:46,color:'14,164,90',width:3,life:300});},400);
```

Take a screenshot: the rings must sit ON the moving ball, not offset. Iterate the mapping until they do. This visual pin IS the test — do not skip the screenshot.

- [ ] **Step 3: Add the timescale**

In `loop()` where `dt` is computed, find the existing freeze check (grep `__hmFreeze`) and multiply beside it:

```js
dt*=(window.__hmSlow||1);
```

After the soccer IIFE (module scope), add the ramp helper:

```js
/* Slow-mo for the broadcast layer: the WORLD slows, DOM animations keep normal
   speed. Ramp in, hold, ramp back; reduced-motion collapses to no-op. */
window.__hmSlow=1;
window.__hmSlowRamp=function(target,ms,holdMs){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var t0=performance.now();
  function step(){var t=performance.now()-t0;
    if(t<ms){window.__hmSlow=1+(target-1)*(t/ms);}
    else if(t<ms+holdMs){window.__hmSlow=target;}
    else if(t<ms+holdMs+ms){window.__hmSlow=target+(1-target)*((t-ms-holdMs)/ms);}
    else{window.__hmSlow=1;return;}
    requestAnimationFrame(step);}
  requestAnimationFrame(step);};
```

- [ ] **Step 4: Syntax check** — `python3 /tmp/hm-check.py` → `syntax OK`.

- [ ] **Step 5: Verify slow-mo live**

During a match: `window.__hmSlowRamp(0.25,150,600)` — the heads and ball visibly slow for ~¾s then recover (verify with two screenshots ~400ms apart: ball displacement while held must be ≪ normal). Also confirm `window.__hmSlow===1` afterwards.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "fxAt unlocks __hmFX for the match; __hmSlow adds broadcast slow-mo"
```

---

### Task 5: Materials toolkit — grain, seeded jitter, shadow pair

**Files:**
- Modify: `index.html` — tournament CSS section + tournament script block (near `ensureHost`).

**Interfaces:**
- Produces: CSS vars `--bc-contact`, `--bc-cast`; class `.bcPlate` (applies the shadow pair); function `cupRand(str)` → deterministic PRNG `()=>[0,1)`; function `bcJitter(el, rnd, maxRotDeg, maxOffPx)` (transform-only jitter — no `filter`); function `bcGrainOn(hostEl)` / `bcGrainOff()` (one grain layer per host). Plans 2/4 apply these to boards, tickets, cards.

- [ ] **Step 1: Add tokens + grain CSS**

In the tournament CSS section (grep first for prior `bc` names — must be absent):

```css
/* ---- MATERIALS. Two shadows one light (down-right, matching the head photos --
   verify direction against a head cutout before changing), one grain layer per
   composite, jitter breaks symmetry. Jitter is transform-only: filter on a
   container would create a stacking context and break future 3D flap cells. */
:root{--bc-contact:0 1px 0 rgba(24,20,12,.5);--bc-cast:6px 10px 22px rgba(24,20,12,.26)}
.bcPlate{box-shadow:var(--bc-contact),var(--bc-cast)}
.bcGrain{position:absolute;inset:0;z-index:9;pointer-events:none;opacity:.06;
  mix-blend-mode:soft-light;background-repeat:repeat}
```

- [ ] **Step 2: Add the JS helpers (tournament script block, near `ensureHost`)**

```js
/* Deterministic per-cup randomness: same cup name -> same board every repaint. */
function cupRand(seed){var h=2166136261;
  for(var i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619);}
  return function(){h=Math.imul(h^(h>>>15),2246822507);
    h=Math.imul(h^(h>>>13),3266489909);return((h^=h>>>16)>>>0)/4294967296;};}

function bcJitter(el,rnd,rot,off){
  el.style.transform='rotate('+(((rnd()*2-1)*rot).toFixed(2))+'deg) translate('
    +(((rnd()*2-1)*off).toFixed(1))+'px,'+(((rnd()*2-1)*off).toFixed(1))+'px)';}

var _grainEl=null;
function bcGrainOn(host){
  if(!_grainEl){var c=document.createElement('canvas');c.width=c.height=256;
    var x=c.getContext('2d'),d=x.createImageData(256,256);
    for(var i=0;i<d.data.length;i+=4){var v=112+(Math.random()*64|0);
      d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255;}
    x.putImageData(d,0,0);
    _grainEl=document.createElement('div');_grainEl.className='bcGrain';
    _grainEl.style.backgroundImage='url('+c.toDataURL()+')';}
  host.appendChild(_grainEl);}
function bcGrainOff(){if(_grainEl&&_grainEl.parentNode)_grainEl.parentNode.removeChild(_grainEl);}
```

- [ ] **Step 3: Syntax check** — `python3 /tmp/hm-check.py` → `syntax OK`.

- [ ] **Step 4: Verify determinism + visuals**

Console: `var r1=cupRand('Apollo'),r2=cupRand('Apollo');[r1(),r1()].join()===[r2(),r2()].join()` → `true`; `cupRand('Strata')()!==cupRand('Apollo')()` → `true` (almost surely). Then start a tournament and in console apply grain to the capsule: `bcGrainOn` is module-scoped — expose temporarily or apply via the console equivalent; screenshot: a faint even noise over the capsule, no banding, no layout shift. Remove with `bcGrainOff` equivalent.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Materials toolkit: shadow pair, seeded jitter, one grain layer"
```

---

### Task 6: Sheen + stinger components

**Files:**
- Modify: `index.html` — tournament CSS + tournament script block; one hidden DOM element appended to `body` from `ensureHost`.

**Interfaces:**
- Produces: class `.bcSheen` (host gets one diagonal light sweep when `.on` is added); JS `bcSheenOnce(el)` — adds/removes the class; JS `bcSting(onCovered)` — plays the full-cover diagonal wipe (~700ms), invoking `onCovered()` at the covered frame (~350ms); under reduced-motion both are instant (`onCovered` fires immediately, no visuals). Plans 2–4 use these for every reveal/transition.

- [ ] **Step 1: CSS**

```css
/* ---- THE MOTIF. One diagonal light sweep, reused everywhere (poster reveal,
   stinger edge, trophy glint, champion foil). One axis: enters left, exits right. */
.bcSheen{position:relative;overflow:hidden}
.bcSheen::after{content:"";position:absolute;inset:-40%;pointer-events:none;
  background:linear-gradient(115deg,transparent 42%,var(--cupSheen,rgba(255,253,240,.32)) 50%,transparent 58%);
  transform:translateX(-130%)}
.bcSheen.on::after{transition:transform .7s cubic-bezier(.4,0,.2,1);transform:translateX(130%)}
.bcSting{position:fixed;inset:0;z-index:64;pointer-events:none;display:none}
.bcSting.on{display:block}
.bcSting b{position:absolute;top:-20%;bottom:-20%;left:0;width:170%;
  background:var(--cupPaint,#252a24);transform:translateX(-115%) skewX(-14deg)}
.bcSting.on b{transition:transform .7s cubic-bezier(.55,0,.35,1);transform:translateX(75%) skewX(-14deg)}
@media (prefers-reduced-motion: reduce){
  .bcSheen.on::after,.bcSting.on b{transition:none}}
```

- [ ] **Step 2: JS + DOM**

In `ensureHost()` (grep `function ensureHost`), after the panel is created, append once:

```js
if(!document.getElementById('bcSting')){
  var st=document.createElement('div');st.id='bcSting';st.className='bcSting';
  st.innerHTML='<b></b>';document.body.appendChild(st);}
```

Module scope helpers:

```js
function bcSheenOnce(el){el.classList.add('bcSheen');
  requestAnimationFrame(function(){el.classList.add('on');
    setTimeout(function(){el.classList.remove('on');},800);});}

function bcSting(onCovered){
  var rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var el=document.getElementById('bcSting');
  if(rm||!el){try{onCovered();}catch(_){ } return;}
  el.classList.add('on');
  setTimeout(function(){try{onCovered();}catch(_){}},350);
  setTimeout(function(){el.classList.remove('on');},760);}
```

- [ ] **Step 3: Syntax check** — `python3 /tmp/hm-check.py` → `syntax OK`.

- [ ] **Step 4: Verify visually (real Chrome)**

Start a tournament. Console: trigger the sheen on the capsule card and the sting with a visible state change (e.g. `bcSting(()=>document.body.style.outline='4px solid red')` equivalents via exposed test hooks — expose `window.__bcTest={bcSheenOnce,bcSting}` temporarily and REMOVE it before commit). Screenshot mid-sting: the skewed panel must fully cover the viewport at the covered frame (no gaps at corners — that is what `top:-20%/bottom:-20%` + width 170% guarantee; if gaps appear, widen). Then set OS reduced-motion (or emulate via DevTools) and confirm `onCovered` fires with no visual.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "One motif: the sheen sweep, and the stinger wipe built on it"
```

---

### Task 7: CUP_ID registry, applied

**Files:**
- Modify: `index.html` — tournament script block (beside the existing `CUPS` array; grep `var CUPS`), plus `start()` (grep `__hmTourStart`).

**Interfaces:**
- Consumes: `T.cup` (e.g. `'Apollo Cup'`), `cupRand` (Task 5).
- Produces: `CUP_ID` registry (module-scope) and, on tournament start, CSS vars on `document.body`: `--cupPaint`, `--cupStock`, `--cupSheen`; plus `T.id` = the active entry `{paint, stock, sheen, pfx, voice:[qf,sf,f], tex}` and `T.rnd` = `cupRand(T.cup)`. Plans 2–5 read `T.id`/`T.rnd` for every per-cup material, serial, label, and (later) sound flavour.

- [ ] **Step 1: Sample each case study's DNA**

Open `apollo.html`, `bearings.html`, `cluster.html`, `strata.html`, `ucdavis.html` and grep each for accent/hero colour declarations; for Reshore/B2B/Blender (index-only case cards) read their card art dominant colour from `index.html`'s cases section. Record one dominant hue per cup. The paints below are the starting values — nudge each toward its sampled hue during Step 4's visual check, keeping them dark and low-chroma (never saturated, never #000):

- [ ] **Step 2: Add the registry + application**

```js
/* ---- CUP IDENTITY. Eight recurring events, deterministic by name: same cup ->
   same board paint, ticket stock, serial prefix, label voice, forever. Identity
   changes MATERIALS AND VOICE, never layout or information architecture. */
var CUP_ID={
  'Apollo': {paint:'#232b34',stock:'#f1ece0',sheen:'rgba(205,222,248,.30)',pfx:'APL',voice:['Quarter-final','Semi-final','The Final'],tex:0},
  'Bearings':{paint:'#2e2a24',stock:'#f3eee2',sheen:'rgba(244,228,196,.30)',pfx:'BRG',voice:['Last Eight','Last Four','The Final'],tex:1},
  'Cluster': {paint:'#292433',stock:'#f0ecE4',sheen:'rgba(224,212,246,.30)',pfx:'CLU',voice:['Quarter-final','Semi-final','Grand Final'],tex:2},
  'Strata':  {paint:'#24302b',stock:'#efece0',sheen:'rgba(206,238,222,.30)',pfx:'STR',voice:['Round of Eight','Semi-final','The Final'],tex:0},
  'UC Davis':{paint:'#20303c',stock:'#f2eddd',sheen:'rgba(255,240,204,.30)',pfx:'UCD',voice:['Quarter-final','Semi-final','Championship'],tex:1},
  'Reshore': {paint:'#34302a',stock:'#f1ede3',sheen:'rgba(240,224,200,.30)',pfx:'RSH',voice:['Quarter-final','Semi-final','The Final'],tex:2},
  'B2B':     {paint:'#2b2b31',stock:'#eeece6',sheen:'rgba(220,224,238,.30)',pfx:'B2B',voice:['Last Eight','Semi-final','The Final'],tex:0},
  'Blender': {paint:'#31262b',stock:'#f3ece2',sheen:'rgba(246,214,222,.30)',pfx:'BLN',voice:['Quarter-final','Last Four','The Final'],tex:1}
};
```

(Fix the casing typo `#f0ecE4` → `#f0ece4` when transcribing.) In `start()`, after `T.cup` is set:

```js
var idKey=T.cup.replace(/ Cup$/,'');
T.id=CUP_ID[idKey]||CUP_ID['Apollo'];
T.rnd=cupRand(T.cup);
document.body.style.setProperty('--cupPaint',T.id.paint);
document.body.style.setProperty('--cupStock',T.id.stock);
document.body.style.setProperty('--cupSheen',T.id.sheen);
```

And in `stop()` (grep `__hmTourStop`), remove all three properties.

- [ ] **Step 3: Syntax check** — `python3 /tmp/hm-check.py` → `syntax OK`.

- [ ] **Step 4: Verify per-cup distinctness**

Seed, start tournaments repeatedly (End tournament → start again) until at least 3 different cup names have appeared (or set `T.cup` paths by temporarily forcing `CUPS` order — restore after). For each: `getComputedStyle(document.body).getPropertyValue('--cupPaint')` matches the registry; screenshot the capsule with the sting fired (it uses `--cupPaint`) — three visibly different paints. Compare each paint against its case-study page side by side; nudge hexes toward the sampled DNA where they feel off (keep dark/low-chroma).

- [ ] **Step 5: Verify teardown**

End the tournament: all three `--cup*` vars gone from `document.body.style`.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Cup Identity registry: eight recurring events, deterministic by name"
```

---

## Final gate for Plan 1

- [ ] Run the full Harness drive: seed → tournament → two fixtures driven to completion → `__hmSess` populated → End tournament → no `--cup*` vars, no grain element, `__hmSlow===1`, `syntax OK`.
- [ ] Real-Chrome pass at `localhost:4173`: fonts load, rings pin to the ball, sting covers, nothing regressed on the home hero (scroll the whole page).
- [ ] `git log --oneline` shows the six commits above; working tree clean.

Plan 2 (Boards) is written after this gate passes, against the then-current code.
