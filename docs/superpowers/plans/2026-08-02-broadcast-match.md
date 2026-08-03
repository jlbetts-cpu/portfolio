# Match Presentation Implementation Plan (Plan 3 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every simulated match feel alive and different: goals land as authored moments, a director gives the match coverage, a suspense-gated ticker narrates it, and the heads behave like people rather than props.

**Architecture:** Everything consumes Plan 1's event bus — the soccer engine keeps emitting and never learns about presentation. New systems are bus subscribers living in the companion-engine script block beside the existing consumers. All of it degrades to nothing under reduced-motion and when the conditional globals are absent.

**Tech Stack:** Vanilla ES5 in `index.html`, the existing `__hmFX` toolkit, `__hmSlow`/`__hmSlowRamp`, `__hmFxAt`, `__hmSess`/`__hmSessFlags`, CSS on the site tokens.

**Roadmap:** Plan 1 (foundations) ✅ · Plan 2 (boards) ✅ · **Plan 3 (this)** · 4 Ceremonies · 5 Sound · 6 Gradient integration.

## Global Constraints (inherited — every task)

- **Conditional globals:** `__hmBus`, `__hmSess`, `__hmSlow`, `__hmFxAt`, `__bcMat` may not exist (a visitor with no saved heads never boots the companion block). Every cross-block consumer guards existence.
- The engine EMITS only. No presentation code inside `loop()`, `goalIn()`, `win()` beyond the existing `BUS.emit` calls.
- **The board never shakes.** Camera moves apply to the pitch/stage layer only; the scoreboard is the stable broadcast frame.
- Motion is transform/opacity; `prefers-reduced-motion` collapses every sequence to an instant state change (not a shortened one).
- No fake data: ticker lines and callouts read from real bus events and `__hmSess`.
- Grep for ALL occurrences before adding any selector or function name (`index.html` shadows silently). `@media` adds no specificity — scope mobile overrides.
- Never put `filter` on an ancestor of the split-flap cells.
- Verify in real Chrome at `http://localhost:4173` (the embedded pane throttles rAF); Ember-equivalent baseline here = **a normal match still plays start→finish**.

## Harness

Serve `python3 -m http.server 4173`. Seed the roster per Plan 1's harness. Drive a match: Play → Soccer, or Play → Tournament → `.tCupGo`. Force a finish: `window.__hmTourWin(1,5,1); window.__hmSoccerEnd();`. Syntax check after every edit: `python3 /tmp/hm-check.py` → `syntax OK`.

**Live-play rule:** goals/shots only fire while the tab is FOREGROUND (rAF is frozen in background tabs). Bring Chrome forward before judging any live behaviour.

---

### Task 1: The goal grammar

**Files:** Modify `index.html` — new module at the companion-block scope, after the `__hmSlowRamp` helper.

**Interfaces:** Produces `goalGrammar()` (self-registering bus subscriber). Consumes `__hmBus` `goal`, `__hmFX`, `__hmFxAt`, `__hmSlowRamp`, `__hmSess`.

- [ ] **Step 1: Write the sequence**

```js
/* THE GOAL GRAMMAR — fixed order, ~3s, then play resumes:
   hit-stop 70ms -> punch-in + directional shake -> slow-mo 0.25x ~600ms
   with particles from the goal mouth -> scorer lower-third -> release.
   Routine goals in a blowout get only the hit-stop and the flap tick
   (variable intensity: the peak-end research says spend on the peaks). */
(function goalGrammar(){
  if(!window.__hmBus)return;
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.__hmBus.on('goal',function(d){
    if(reduce)return;
    var S=window.__hmSoccer;if(!S)return;
    var margin=Math.abs((d.red||0)-(d.blue||0));
    var big=margin<=1||((d.red+d.blue)>=(S.target||5)-1);   /* close or late */
    try{window.__hmFX.hitstop(70);}catch(_){}
    if(!big)return;
    stagePunch(d.team);
    if(window.__hmSlowRamp)window.__hmSlowRamp(0.25,150,600);
    goalParticles(d.team);
    lowerThird(d);
  });
})();
```

- [ ] **Step 2: Stage punch + shake (transform on the pitch layer only)**

Find the element that hosts the pitch/heads (grep `stagewrap`); apply a short scale/translate via a CSS class with `transform-origin` toward the scoring goal. Never touch `.hmScore`.

- [ ] **Step 3: Particles at the goal mouth** — `__hmFX.burst` through `__hmFxAt(goalX, groundY)`, ~12 particles, team colour + white, 400ms life, direction along the shot vector.

- [ ] **Step 4: Scorer lower-third** — a DOM strip that slides in on the motion axis (enter left) carrying the scorer's head thumbnail, `GOAL`, and the name; auto-dismiss ~1.6s. Names come from the head roster via the scorer slot; if the slot is null, show the team name only (no invented scorer).

- [ ] **Step 5: Syntax check** → `syntax OK`.

- [ ] **Step 6: Verify live in real Chrome** — foreground the window, play a match, score a live goal. Expect: a visible freeze, the pitch punches (board still), particles at the mouth, the lower-third slides in and leaves, play resumes at normal speed (`window.__hmSlow===1`). Screenshot mid-sequence.

- [ ] **Step 7: Commit** — `git commit -m "The goal grammar: hit-stop, punch-in, slow-mo, scorer lower-third"`

---

### Task 2: The director layer

**Files:** Modify `index.html` — module after the goal grammar.

**Interfaces:** Produces `director` (bus subscriber owning one shot state). Never leaves MASTER for more than 1.5s during live play.

- [ ] **Step 1: Shot vocabulary** — MASTER (default), PUNCH (scale toward a point), REACTION (framed close-up of one head), CUTAWAY (bench/crowd). Implement as transforms on the stage layer plus an optional vignette; reuse the existing head rigs for reactions.

- [ ] **Step 2: The grammar** — goal: punch scorer → reaction scorer (cheer) → reaction beaten keeper (droop) → cutaway → wide. Near-miss (`woodwork`): one quick punch + shooter reaction only. Quiet stretch (no event 8s): one 1s crowd/bench cutaway.

- [ ] **Step 3: Anti-repetition** — 2–3 recipes per event type, remember the last used; recipe choice may key off `__hmSessFlags` (revenge game → always show the opposing captain).

- [ ] **Step 4:** Syntax check; verify each shot fires in live play; confirm the board never moves.

- [ ] **Step 5: Commit** — `"The director: reaction shots, cutaways, one shared motion grammar"`

---

### Task 3: The suspense ticker

**Files:** Modify `index.html` — CSS near the scoreboard rules, JS after the director.

**Interfaces:** Produces `ticker` (bus subscriber). One line strip on the match stage; **two-beat delivery**: "Maya winds up…" → ~900ms hold → outcome.

- [ ] **Step 1: The line system** — `LINES[eventType]` = template variants with conditions (`{lateGame}`, `{isRevenge}`, `{firstGoal}`, `{deuce}`); picker filters by condition, scores by specificity (most conditions matched wins), ties break randomly, per-template cooldown so nothing repeats inside one match. 8–10 variants per event type.
- [ ] **Step 2: Suspense gating** — `shot` and `woodwork` emit the wind-up line immediately and hold the outcome line until the resolving event (goal/save/miss) or 900ms, whichever first.
- [ ] **Step 3: Session callouts** — "First goal of the cup for Maya", "These two met in round 1" — from `__hmSess`/`__hmSessFlags` only, omitted when the data is empty.
- [ ] **Step 4:** Syntax check; verify in live play that lines appear, hold, resolve, and never repeat within a match; reduced-motion shows the final line instantly.
- [ ] **Step 5: Commit** — `"The ticker: suspense is information delay"`

---

### Task 4: Personas + crowd

**Files:** Modify `index.html` — persona assignment where squads are built (grep `buildTeams`), crowd in the tournament block (grep `.tFan`).

- [ ] **Step 1: Persona vector** — per head `{energy, volatility, showboat, nerves, phase}` seeded from the head's slot so a given head behaves consistently within a session. Modulates existing rigs only (no new clips): bounce amplitude, fidget rate, celebration length, blink rate under pressure, and a phase offset so no two heads move in sync.
- [ ] **Step 2: Celebration variants** — context filter first (late winner → big moves; consolation → muted), then persona weights, then never-same-twice memory. Reuse `cheer()`, flip, and the `win()` centroid-run.
- [ ] **Step 3: Conceding + near-miss reactions** — slow blink and dropped gaze on conceding; `irisDil` on the keeper at a post-ping.
- [ ] **Step 4: Crowd** — `.tFan` tiers do a staggered wave on goals and subtly track the ball; phase-desynced.
- [ ] **Step 5:** Syntax check; verify two consecutive matches visibly differ; commit — `"Personas and crowd: no two matches replay the same"`

---

## Final gate for Plan 3

- [ ] Full tournament in real Chrome, foregrounded: goals fire the grammar, the director cuts, the ticker narrates with held suspense, heads behave differently match to match, the board never shakes, `__hmSlow` returns to 1 every time.
- [ ] Plain soccer (non-tournament) still plays start→finish with all systems active.
- [ ] Reduced-motion: no camera moves, no slow-mo, ticker still readable.
- [ ] No-heads visitor: page loads clean (all consumers guarded).
- [ ] Mobile 390: lower-third and ticker legible, no horizontal overflow.
- [ ] `python3 /tmp/hm-check.py` → syntax OK; full-page regression scroll clean.
