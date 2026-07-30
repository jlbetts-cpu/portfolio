# Broadcast Boards Implementation Plan (Plan 2 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The first visible payoff of the broadcast package: rebuild the in-match scoreboard as a hanging-card board with real split-flap digits in Archivo, and rebuild the tournament schedule as the Draw Board — a painted plane of printed fixture tickets that tear and stamp as results land.

**Architecture:** All in `index.html`. The split-flap component (`bcFlap`) lives in the soccer script block (the scoreboard's owner); the Draw Board re-skin lives in the tournament block's `paint()`. The tournament block exposes `window.__bcMat` (grain/jitter/rand helpers from Plan 1) so the soccer block can use materials — guarded per the Foundations contracts (conditional globals). The scoreboard keeps its exact DOM skeleton and information architecture (Jayden's settled vertical stack); only materials, type, and digits change.

**Tech Stack:** Vanilla ES5 JS + CSS on Plan 1's foundations (`.bcNum`/Archivo, `cupRand`, `bcJitter`, `bcGrainOn/Off`, `--cupPaint/--cupStock/--cupSheen`, `CUP_ID`, `T.id`/`T.rnd`).

## Global Constraints (spec + Foundations contracts — every task inherits these)

- **Conditional globals:** `__hmBus`, `__hmSess`, `__hmSlow`, `__hmFxAt` may not exist (no-heads visitors). Every cross-block consumer guards existence. `__bcMat` (new here) joins that list.
- **No `filter` on any ancestor of a 3D flap cell.** The scoreboard's `:has(.sbCard)` regime must set `filter:none` (the board is a printed object, not ink chrome). Never re-introduce ink filters inside the board.
- Two shadows one light (`--bc-contact`/`--bc-cast`); one grain layer per composite (`bcGrainOn` host must be positioned); break symmetry with seeded jitter — deterministic per fixture (`cupRand(T.cup + fixtureKey)`), never `T.rnd` consumed during paint (repaints would reshuffle).
- Never pure #000/#fff; motion transform/opacity only (box-shadow glows allowed for the clutch/flash states, as today); reduced-motion collapses every animation to an instant state change.
- **Archivo (.bcNum) touches numerals and moments only.** Names/labels stay Instrument Sans 400/600. Digits: `tabular-nums lining-nums`, one digit per fixed-width cell. Score digits ≥1.75× the name size.
- Scoreboard information architecture unchanged: vertical stack, full names, leader-full-ink/trailer-dimmed, trophy on final, round label in the ledge, End button. Play menu untouched. Schedule stays a plain `<section>`; capsule sizing stays min-height-only.
- `index.html` defines things twice — grep ALL occurrences before adding/altering any selector or name (`.hmScore` has defs at ~344, ~911, and the `:has(.sbCard)` regime ~2007; `.sbScore`, `.tCupFx` likewise multiple). `@media` adds no specificity — scope mobile overrides.
- Never sheen the capsule/`#tourPanel` itself (`bcSheenOnce` leaves `overflow:hidden`). Leaf cards only.
- No fake data. The Draw Board renders only fixtures the bracket actually holds; undecided future slots render as blank "awaiting draw" tickets (compatible with the coming pool-draw model).
- After every index.html edit: `python3 /tmp/hm-check.py` → "syntax OK" (recreate from Plan 1's Harness section in docs/superpowers/plans/2026-07-30-broadcast-foundations.md if missing).

## Harness

Same as Plan 1 (see docs/superpowers/plans/2026-07-30-broadcast-foundations.md § Harness): serve `python3 -m http.server 4173`, seed via the (fixed) eyes-perturbed snippet, `navigate` for real reloads, screenshots advance throttled rAF, fixture drive = `.tCupGo` → `__hmTourWin(1,5,1)` → `__hmSoccerEnd()` → wait ≥6s. Feel checks in real Chrome.

---

### Task 1: The split-flap component (`bcFlap`)

**Files:**
- Modify: `index.html` — CSS near the Plan-1 materials block (grep `MATERIALS`); JS at the soccer script block's module scope, after the `__hmSlowRamp` helper (grep `__hmSlowRamp`).

**Interfaces:**
- Produces: `bcFlap(container, nCells)` → `{set(str, instant), el}`. `set('3')` spins cells forward through the drum `' 0123456789'` with spin-through, deceleration, 50ms cascade, ragged settle. `set(str, true)` or reduced-motion → instant text swap, no animation. Cells carry `.bcNum` (Archivo tabular digits). Task 2 builds one 1-cell flap per team.
- Grep first: `bcFlap`, `.bcCell`, `.bcCellIn` must not exist anywhere.

- [ ] **Step 1: CSS**

```css
/* ---- SPLIT-FLAP. The one mechanical component; score digits only. Four layers
   per cell: static top (current char upper half), static bottom (NEXT char lower
   half), flip-front (old char upper), flip-back (new char lower). Spin-through:
   always forward through the drum, never backward, never a direct jump. NO
   ancestor of a cell may carry filter (3D transform stacking trap). */
.bcCell{position:relative;display:inline-block;width:.72em;height:1.16em;
  border-radius:.06em;background:var(--cupStock,#f1ece0);color:#221f18;
  box-shadow:var(--bc-contact),var(--bc-cast);perspective:5em;
  text-align:center;vertical-align:baseline}
.bcCell+.bcCell{margin-left:.06em}
.bcCell i{position:absolute;left:0;right:0;overflow:hidden;font-style:normal;
  line-height:1.16em;pointer-events:none}
.bcCell .bcT{top:0;height:.58em}
.bcCell .bcB{bottom:0;height:.58em}
.bcCell .bcB span{position:relative;top:-.58em;display:block}
/* seam: shadow above the split, highlight below, 1px misregistration */
.bcCell::before{content:"";position:absolute;left:0;right:0;top:.57em;height:2px;
  background:linear-gradient(rgba(24,20,12,.34),rgba(255,255,255,.28));z-index:4;
  transform:translateY(.5px)}
/* pin ticks */
.bcCell::after{content:"";position:absolute;top:.5em;bottom:.5em;left:-.045em;right:-.045em;
  background:linear-gradient(90deg,rgba(24,20,12,.5) .045em,transparent .045em,
    transparent calc(100% - .045em),rgba(24,20,12,.5) calc(100% - .045em));
  border-radius:.03em;z-index:0}
.bcCell .bcFlip{position:absolute;left:0;right:0;top:0;height:.58em;z-index:3;
  transform-origin:bottom center;backface-visibility:hidden;overflow:hidden;
  background:var(--cupStock,#f1ece0);border-radius:.06em .06em 0 0;
  line-height:1.16em;font-style:normal;display:none}
.bcCell.bcGo .bcFlip{display:block;animation:bcFlipDown .15s ease-in forwards}
@keyframes bcFlipDown{from{transform:rotateX(0)}to{transform:rotateX(-88deg)}}
@media (prefers-reduced-motion: reduce){.bcCell.bcGo .bcFlip{animation:none;display:none}}
```

- [ ] **Step 2: JS (soccer block module scope, after `__hmSlowRamp`)**

```js
/* Split-flap cells. Drum is fixed; a change spins FORWARD through every
   intermediate character (wrapping), fast then decelerating -- that spin-through
   is what reads as mechanical. Cascade: cells start 50ms apart and settle
   raggedly (different spin distances). Reduced-motion: instant swap. */
var BC_DRUM=' 0123456789';
function bcFlap(container,nCells){
  var cells=[],reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var el=document.createElement('span');el.className='bcNum';
  for(var i=0;i<nCells;i++){
    var c=document.createElement('span');c.className='bcCell';
    c.innerHTML='<i class="bcT"><span></span></i><i class="bcB"><span></span></i>'+
                '<i class="bcFlip"><span></span></i>';
    c.__ch=' ';el.appendChild(c);cells.push(c);
    /* ragged illumination: +-4% lightness via background, never filter */
    c.style.background='rgba(0,0,0,0)';
    c.style.backgroundColor='';
  }
  container.appendChild(el);
  function paintCell(c,ch){
    c.querySelector('.bcT span').textContent=ch;
    c.querySelector('.bcB span').textContent=ch;
  }
  function spinCell(c,target,startDelay){
    var from=BC_DRUM.indexOf(c.__ch),to=BC_DRUM.indexOf(target);
    if(from<0)from=0; if(to<0)to=0;
    var steps=(to-from+BC_DRUM.length)%BC_DRUM.length;
    if(steps===0)return;
    var k=0,delay=70;
    function one(){
      k++;var ch=BC_DRUM[(from+k)%BC_DRUM.length];
      var flip=c.querySelector('.bcFlip span');
      flip.textContent=c.__ch;
      c.classList.remove('bcGo');void c.offsetWidth;c.classList.add('bcGo');
      paintCell(c,ch);c.__ch=ch;
      if(k<steps){delay=Math.min(230,delay+ (k>steps-4?55:8));setTimeout(one,delay);}
      else setTimeout(function(){c.classList.remove('bcGo');},160);
    }
    setTimeout(one,startDelay);
  }
  return{el:el,set:function(str,instant){
    str=String(str);
    for(var i=0;i<cells.length;i++){
      var ch=str[str.length-cells.length+i]||' ';
      if(BC_DRUM.indexOf(ch)<0)ch=' ';
      if(instant||reduce){cells[i].__ch=ch;paintCell(cells[i],ch);}
      else if(cells[i].__ch!==ch)spinCell(cells[i],ch,i*50);
    }
  }};
}
```

- [ ] **Step 3: Syntax check** — `python3 /tmp/hm-check.py` → `syntax OK`.

- [ ] **Step 4: Standalone verify** — serve, seed, reload. Console: create a test flap on the hero (`var f=bcFlap(...)` is module-scoped — temporarily expose `window.__bcTest={bcFlap:bcFlap}` and REMOVE before commit, verified by grep + reload). `var host=document.createElement('div');host.style.cssText='position:fixed;top:80px;left:80px;font-size:64px;z-index:99';document.body.appendChild(host);var f=window.__bcTest.bcFlap(host,1);f.set('0',true);f.set('3');` — screenshots: drum passes 1,2 en route to 3 (catch via forced `.bcGo` static state if throttled); `f.set('2')` wraps forward through 4..9,space,0,1,2 (verify `__ch` timeline or count flip events via MutationObserver). Check seam/pins render. Remove host.

- [ ] **Step 5: Commit** — `git add index.html && git commit -m "Split-flap cells: drum spin-through, cascade, ragged settle"`

---

### Task 2: Scoreboard material rebuild

**Files:**
- Modify: `index.html` — the `.hmScore:has(.sbCard)` CSS regime (grep `:has(.sbCard)` and the `.sbCard`/`.sbInner`/`.sbTeam`/`.sbScore`/`.sbFoot` rules near it, ~1907–2007; grep ALL `.sbScore` occurrences first); `paintBoard()`/`board2()` in the soccer block (grep `function paintBoard`, `function board2`); one exposure line in the tournament block.

**Interfaces:**
- Consumes: `bcFlap` (Task 1), `--cupPaint`/`--cupStock` (set only during tournaments — defaults must look right in plain soccer), `--bc-contact`/`--bc-cast`, `window.__bcMat` (new).
- Produces: `window.__bcMat={grainOn,grainOff,jitter,rand}` exposed from the tournament block (guarded consumers); module vars `flapR`/`flapB` in the soccer block; class hooks `.sbClutch` (match-point plate glow) and the board look consumed by nothing else — the scorebug API (`board2`, `paintBoard`, `.sbTrail`, `.sbHit`) is unchanged for existing callers.

- [ ] **Step 1: Expose materials from the tournament block**

At the tournament block's module scope, right after `bcGrainOff` (grep it):

```js
/* Materials, exported for the scoreboard (soccer block). CONDITIONAL global --
   consumers must guard (see Foundations contracts). */
window.__bcMat={grainOn:bcGrainOn,grainOff:bcGrainOff,jitter:bcJitter,rand:cupRand};
```

- [ ] **Step 2: CSS rebuild of the board regime**

In the `:has(.sbCard)` regime (NOT the base `.hmScore` at ~344/911 — those still serve the idle/ballOut states): set `filter:none` on the regime's `.hmScore` rule (comment why: printed object + 3D flap stacking trap). Rebuild, keeping every selector name:

```css
/* THE BOARD IS A PRINTED OBJECT: matte painted plane, light plates, no ink
   filter (it would also break the 3D flap cells). Cup identity paints it during
   tournaments; the defaults are the plain-soccer board. */
.hmScore:has(.sbCard){filter:none}
.sbCard{width:340px;border-radius:10px;background:var(--cupPaint,#2b2f2a);
  box-shadow:var(--bc-contact),var(--bc-cast),inset 0 0 46px rgba(0,0,0,.30);
  position:relative}
.sbInner{display:flex;flex-direction:column;gap:18px;padding:26px 24px 20px}
.sbTeam{display:flex;align-items:center;gap:12px}
.sbWho{flex:1;min-width:0}
.sbNm{color:#ece9dd;font-weight:600;font-size:13px;letter-spacing:.09em;
  text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sbSub{height:3px;width:34px;border-radius:2px;background:var(--tc);margin-top:5px}
.sbScore{font-size:40px;position:relative;display:flex;align-items:center}
/* team chip on the plate edge: attribution lives on the PLATE, not the glyph */
.sbScore::before{content:"";position:absolute;left:-.14em;top:.18em;bottom:.18em;
  width:.06em;border-radius:.03em;background:var(--tc);z-index:5}
.sbVs{display:flex;align-items:center;gap:10px;color:#8f8d80;font-size:11px;
  letter-spacing:.14em}
.sbRuleA,.sbRuleB{height:1px;background:rgba(236,233,221,.22)}
.sbRuleA{width:22px}.sbRuleB{flex:1}
.sbFoot{display:flex;align-items:center;gap:10px;padding:12px 24px;
  border-top:1px solid rgba(236,233,221,.14);color:#b9b6a8}
.sbRound{font-size:11px;letter-spacing:.14em;text-transform:uppercase}
.sbTrail .bcCell{opacity:.62}
.sbTrail .sbNm{opacity:.62}
/* clutch: the plate whose NEXT goal ends the match takes a thin emerald edge */
.sbClutch .bcCell{box-shadow:var(--bc-contact),var(--bc-cast),
  0 0 0 1.5px rgba(23,164,90,.85),0 0 12px rgba(23,164,90,.35)}
```

Read the existing regime first and preserve every rule you are not deliberately replacing (trophy `.sbTrophy`, `.sbFace`/`.sbDot`, `.sbHit`/`sbFlashPulse`, gold final label, `.hmScoreEnd`, ball `.sBall`, mobile widths). The board must still fit 390px — check the regime's existing mobile overrides and scope any new ones (`.hmScore:has(.sbCard) .sbScore`, never bare).

- [ ] **Step 3: Wire flaps into paintBoard/board2**

In `paintBoard()`: where the score `<b class="sR sbScore">`/`sB` elements are created, keep the elements (class hooks) but empty them and mount a 1-cell flap in each: `flapR=bcFlap(sRel,1);flapR.set(String(S.red),true);` (module vars `var flapR=null,flapB=null;` at soccer state declarations — grep-verify names unused). In `board2()`: replace the textContent writes with `if(flapR)flapR.set(String(S.red)); if(flapB)flapB.set(String(S.blue));` keeping the existing `.sbTrail` toggling. Add clutch: a team is at match point when its next goal ends the match — with `t=S.target`, `c=S.cap`: `mpR=(S.red+1>=t && S.red+1-S.blue>=2)||(S.red+1>=c)`; same for blue; toggle `.sbClutch` on each team's `.sbTeam` row. Apply board materials on build: guarded `if(window.__bcMat){__bcMat.grainOn(cardEl); var r=__bcMat.rand('board'+(S.seed||'')); __bcMat.jitter(cardEl,r,0.4,1);}` — `cardEl` is `.sbCard`; confirm `.sbCard` is positioned (Step 2 sets `position:relative`) per the grain contract. Goal pop: keep the existing numeral pop-scale call site but target the flap `el` (transform-only).

- [ ] **Step 4: Syntax check** — `syntax OK`.

- [ ] **Step 5: Verify** — seed; plain soccer match: board renders as painted plane w/ stock plates, Archivo digit, chips in team colors, VS divider, grain, slight tilt; score a driven goal (`window.__hmSoccer` manipulation is not available — let live play score or use the tournament drive) and confirm the flap spins on change + trailer dims. Drive a tournament to the FINAL (cup paint: board takes the cup's `--cupPaint`; gold round label + trophy intact). Force clutch: play a fixture to target-1 via repeated `__hmTourGoal`-free live play OR temporarily set `S.red=S.target-1` in console then trigger `board2()` via a goal — confirm the emerald edge on the right plate only. Mobile: resize 390px, screenshot, nothing clips. Reduced-motion: flap swaps instantly (devtools emulation). Real-Chrome screenshot of the final board for the report.

- [ ] **Step 6: Commit** — `git commit -m "The scoreboard is a painted board: stock plates, Archivo flaps, chips, clutch edge"`

---

### Task 3: The Draw Board (schedule as tickets)

**Files:**
- Modify: `index.html` — schedule CSS (grep `.tCupSched`, `.tCupFx` — ALL occurrences) and `paint()`'s schedule-building section + `syncHero()` (grep both) in the tournament block.

**Interfaces:**
- Consumes: `T.id` (`pfx`, `voice`, paints), `cupRand`, `bcJitter`, `bcGrainOn`, `BR` fixture data as `paint()` already reads it (`.tCupRd`/`.tCupFx` loop), `.tFxTbd`/`.tCupWon`/`.tRdNow` state classes.
- Produces: helper `roundName(r,total)` (voice-aware round labels — ALSO route the scoreboard round string through it via `startFixture`'s existing name plumbing); `T.__decided` (Set-like object of seen fixture keys, for one-time tear animations); ticket classes `.tkStub`, `.tkSerial`, `.tkTorn`, `.tkTear`, `.tkStamp`, `.tkDot`, `.tkPend`; the distance line in `.tCupSchedHd`.

- [ ] **Step 1: `roundName` helper + distance line**

```js
/* Round labels speak the CUP's voice. voice = [quarter, semi, final] naming the
   LAST THREE rounds; earlier rounds fall back to 'Round of N'. */
function roundName(r,total){
  var fromEnd=total-1-r;
  var v=(T.id&&T.id.voice)||['Quarter-final','Semi-final','The Final'];
  if(fromEnd===0)return v[2];
  if(fromEnd===1)return v[1];
  if(fromEnd===2)return v[0];
  return 'Round of '+Math.pow(2,total-r);
}
```

In `paint()`, replace the hardcoded round-label strings feeding `.tCupRdH` (and `.tCupRound`) with `roundName(...)` — read how the current label strings are derived first (there is an existing label function or array; route it, don't duplicate). In the schedule header (`.tCupSchedHd` build), append the distance line: with `cur` = the live/next round index and `total` = round count: text `roundName(cur,total)+' · '+(total-1-cur===0?'winner takes the cup':(total-cur)+' wins to the cup')` in a `<span class="tkDist">` (Instrument 400, `--fs-caption`, letterspaced caps, color `#8f8d80`-on-paint or `--c500` on light — match where the header actually sits after Step 2).

- [ ] **Step 2: Ticket CSS**

```css
/* ---- THE DRAW BOARD. The schedule is a painted plane of printed tickets.
   A fixture is a ticket; a played fixture is a TORN ticket with the score
   stamped on. Tickets are printed things: stock ground, perforation, serial. */
.tCupSchedIn{background:var(--cupPaint,#2b2f2a);border-radius:10px;
  padding:12px 12px 14px;position:relative;
  box-shadow:var(--bc-contact),var(--bc-cast),inset 0 0 46px rgba(0,0,0,.30)}
.tCupRdH{color:#cfccbe;font-size:11px;letter-spacing:.16em;text-transform:uppercase;
  font-weight:400;padding:10px 6px 6px}
.tCupFx{position:relative;display:flex;align-items:center;gap:10px;
  background:var(--cupStock,#f1ece0);border-radius:4px;padding:10px 84px 10px 12px;
  margin:8px 2px;box-shadow:var(--bc-contact),var(--bc-cast);color:#242116}
.tCupFx .tCupFxNm{font-weight:600;font-size:13px;color:#242116}
/* the stub: perforation + serial, ADMIT-ONE grammar */
.tkStub{position:absolute;top:0;bottom:0;right:0;width:74px;
  border-left:2px dashed rgba(24,20,12,.30);display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:2px}
.tkSerial{font-size:11px;letter-spacing:.05em;color:#4b463a}
.tkDot{position:absolute;left:-3px;top:50%;width:6px;height:6px;border-radius:50%;
  transform:translateY(-50%);background:var(--accent-live,#17A45A);
  box-shadow:0 0 8px rgba(23,164,90,.55)}
/* torn: the played ticket's stub edge goes ragged */
.tkTorn .tkStub{border-left:0;
  -webkit-clip-path:polygon(6% 0,100% 0,100% 100%,2% 100%,9% 88%,3% 76%,10% 63%,4% 50%,9% 38%,3% 26%,8% 13%);
  clip-path:polygon(6% 0,100% 0,100% 100%,2% 100%,9% 88%,3% 76%,10% 63%,4% 50%,9% 38%,3% 26%,8% 13%);
  background:rgba(24,20,12,.05)}
.tkStamp{display:inline-block;transform:rotate(-4deg);font-size:15px;color:#37311f;
  border:2px solid rgba(55,49,31,.55);border-radius:3px;padding:0 .3em;line-height:1.3}
.tkPend{opacity:.5}
.tkPend .tCupFxNm{color:#6d685a;font-weight:400}
.tCupFx.tkTear .tkStub{animation:tkTearOff .4s cubic-bezier(.4,0,.2,1) both}
@keyframes tkTearOff{0%{transform:translateX(0) rotate(0)}
  55%{transform:translateX(4px) rotate(1.6deg)}100%{transform:translateX(0) rotate(.6deg)}}
.tCupFx.tkTear .tkStamp{animation:tkStampIn .3s .18s cubic-bezier(.2,.9,.3,1.4) both}
@keyframes tkStampIn{0%{transform:rotate(-14deg) scale(1.7);opacity:0}
  100%{transform:rotate(-4deg) scale(1);opacity:1}}
@media (prefers-reduced-motion: reduce){
  .tCupFx.tkTear .tkStub,.tCupFx.tkTear .tkStamp{animation:none}}
```

Grep every existing `.tCupFx`/`.tCupSchedIn`/`.tCupRdH` rule first and reconcile (the winner-arrow `.tCupArrow`, `.tCupWon` ink weights, `.tCupDot` head thumbs, `.tRdNow` all survive — restyle onto stock, don't delete semantics). The `.tCupSchedIn` is now positioned → valid `bcGrainOn` host.

- [ ] **Step 3: Wire in `paint()`**

In the schedule build loop: per fixture, compute `key` (the loop already derives a round×index key for posters — reuse that scheme), then:
- serial: `var pfx=(T.id&&T.id.pfx)||'CUP'; var serial=pfx+'-'+('000'+(100*(r+1)+i)).slice(-4);` into `.tkSerial` inside a new `.tkStub` div appended to the ticket; stub also holds the existing score/arrow region (move `.tCupFxSc` into the stub; the stamp wraps the score: decided → `<span class="tkStamp bcNum">2–1</span>`).
- decided fixtures: add `.tkTorn`; if `!T.__decided[key]` → also `.tkTear` (one-time) and set `T.__decided[key]=1` (`T.__decided=T.__decided||{}` initialized in `start()`; cleared in `stop()`).
- both-sides-TBD (`.tFxTbd`): add `.tkPend`, names render as 'Awaiting draw' placeholders ONLY if the current markup renders empty names — read what `.tFxTbd` shows today and keep its semantics, adding the class for the faded look.
- live fixture (the one `T.cur` points at): append `.tkDot` to its ticket.
- jitter: `var jr=cupRand(T.cup+key); bcJitter(fxEl,jr,0.5,1);`
- grain: after the schedule is built, `bcGrainOn(schedInEl)` (and `bcGrainOff()` when the tournament screen paints without a schedule — champion — plus already-covered `stop()`).

- [ ] **Step 4: `syncHero` re-check** — read how `syncHero()` snaps `.tCupSchedIn` max-height to whole fixture rows; ticket height changed (padding/margins) — verify the measurement is dynamic (reads actual row heights). If it hardcodes row heights, fix to measure `.tCupFx` runtime height. Then verify no capsule clipping: `el.scrollHeight <= getBoundingClientRect().height + 1` on `.tCup` after paint (the documented diagnostic).

- [ ] **Step 5: Syntax check** — `syntax OK`.

- [ ] **Step 6: Verify** — seed; start tournament: Draw Board renders (paint plane, stock tickets, serials with the cup's prefix, pending fixtures faded, live dot on the current fixture, round labels in the cup's voice, distance line correct: 8-team field round 1 → "3 wins to the cup" wording per Step 1 formula). Drive one fixture: on return, its ticket is TORN with the score STAMPED (catch `.tkTear` via forced-static class if throttled) and the next fixture wears the dot; `T.__decided` holds the key; repaint (`resize` or another drive) does NOT replay the tear. Drive to champion: schedule teardown → no grain element; End → `T.__decided` cleared. Scoreboard round label speaks the same voice (check `.sbRound` during a semi in a cup with non-default voice, e.g. Bearings' "Last Four"). Mobile 390px screenshot. Real-Chrome feel pass screenshot.

- [ ] **Step 7: Commit** — `git commit -m "The Draw Board: fixtures are printed tickets that tear and stamp as results land"`

---

## Final gate for Plan 2

- [ ] Full tournament in real Chrome start→champion: board + tickets correct in ≥2 different cups (distinct paints/voices/serials), tear/stamp fires once per result, clutch edge appears at match point in live play, flaps spin on live goals, trailer dims, trophy/gold final intact, champion screen clean (no grain, schedule gone), End restores everything (grep body style empty of --cup*).
- [ ] Plain soccer (non-tournament): board renders with default paints; no tournament classes leak.
- [ ] Mobile 390px: board and Draw Board both fit; no horizontal scroll; capsule scrollHeight diagnostic clean.
- [ ] Reduced-motion: flaps/tears/stamps all instant.
- [ ] `python3 /tmp/hm-check.py` → syntax OK; full-page regression scroll (hero/cases/About) clean.

Plan 3 (Match presentation) is written after this gate passes.
