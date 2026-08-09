# Soccer revamp — design specification

**Date:** 2026-08-09
**Status:** Approved design; implementation not started (`play-engine.js` was read-only during this pass)
**Scope:** The soccer match inside `play-engine.js` — the `soccer()` IIFE (from line 1858) and the soccer branch of the companion-head AI (lines 1142–1223, 1433, 638–647). No CSS or DOM restructuring beyond one goal dimension.

---

## 0. Answers up front

| Question | Answer |
|---|---|
| **The single biggest reason nothing gets airborne** | **The contact normal, not gravity.** A standing head meeting a resting ball produces a contact normal pointing **19° below horizontal** (`ny = 0.327` at 1440). The `LOFT` constant at `play-engine.js:2506` subtracts only `0.26` from it, so the impulse still leaves **4° below horizontal**. Every ground contact drives the ball *into* the turf. Aerial play is only ever bootstrapped by the 2.6-second anti-stall pop. |
| **The one change with the best effect-to-risk ratio** | **Make the loft geometry-derived and state-dependent** (§5.1). One expression replacing one literal. No new state, no new per-head fields, symmetric by construction, scales with the viewport automatically, and it is the direct cause of the headline metric. Sourced precedent: Smash Bros.' Sakurai angle (§8.5). |
| **The number that best characterises the match today** | **76% of goals are scored with the ball on the deck** — 62 of 82 goals across 773 s of live play in four configurations. At 2-a-side it is **100%**. Jayden's target is "rarely." |

Two secondary answers the brief asked for specifically:

| Question | Answer |
|---|---|
| **Is the gravity-vs-geometry ratio the aerial blocker?** | **No — and the premise inverts at small viewports.** Gravity, hop impulses and the ball's launch speeds are fixed absolutes, so apex height is a fixed **204 px** everywhere. Because heads *shrink* at 390, that apex is **2.66 head-heights on mobile versus 1.57 on desktop** — the small world is relatively *more* airborne, and the measurements agree (63% airborne contacts at 390 vs 48% at 1440). The ratio that is genuinely broken is horizontal: the pitch shrinks **3.7×** while the heads shrink only **1.7×** (§4). |
| **Is the goal too small, or is a body in it too effective a blocker?** | **The body.** The mouth is 162 px = 3.4 ball diameters, which is not tight. But one standing head's collision circle occupies **63.9% of the mouth's height** and removes **92% of the descending-shot window** (34.5 px → 10.5 px). Fix the keeper's station, not the net — then scale the crossbar with `HW` as a secondary move (§5.5). |

---

## 1. Intent

Jayden, on the match as it stands:

> *"I want the players to try scoring through the air... More hitting it up, flipping, using teammates to jump higher."*
> *"I want scores to rarely be scored just on the ground, like kicking from the ground."*
> *"Make it feel like a game bouncing off the walls and roofs."*
> *"Make sure the soccer mode is entertaining no matter how many people are playing, a low number or a high one."*

And, three separate times, the constraint that overrides everything else:

> *"I like the randomness, I feel the aggression that is now, I don't want that to be ruined."*

**The chaos is the product.** Nothing in this document spaces heads out, assigns zones, damps the scrum, or makes the match more tactical. The clumping is not a defect. The only disorder worth removing is disorder that **stops the match**: dead air, a wedged ball, a restart that visibly misfires. Dead time is the enemy; disorder is not.

The revamp has one measurable target and four defect fixes:

- **Target:** move the scoring mix from **76% ground goals** to **≤ 35%**, at every head count, without dropping goals-per-minute below 4 anywhere.
- **Defects:** heads hopping on the wrong plane and spawning on the big head (§3.1); every head drifting right after a goal (§3.2); a body in the goal being an unbeatable wall (§3.3); no aerial bootstrap (§3.4).

---

## 2. Method and measured baseline

Served from the worktree root on `http://127.0.0.1:4187`, driven in the embedded browser pane kept fronted throughout (rAF throttles in a backgrounded pane). Heads were dyed eggheads spawned via `__hmAddEgghead` / `__hmSpawnOne` on an origin whose `localStorage` was empty — Jayden's real baked heads live on a different port and were never touched.

Instrumentation was a read-only rAF sampler: it reads `window.__hmSoccer.ball`, `window.__hmFeetY`, `window.__hmFOOT`, the ball element's width, and each head root's `style.transform`. Ball contacts are detected as per-frame velocity discontinuities above 140 px/s that gravity does not explain. Flips are detected from the double-`rotate()` sandwich the render writes only when `flipA` is non-zero (`play-engine.js:1585`).

Two traps confirmed and worked around, per the brief: the **5,600 ms** celebration tail after a win (`setTimeout(finish, 5400)` at line 2372 plus the 240 ms `netCatch` delay), and `window.__hmSoccerEnd` — which does exist (line 2245) and is the correct way to abort a run.

### 2.1 The baseline

"Ground goal" = the ball's underside was within **one ball radius** of the pitch when it crossed the line (24 px at 1440, 16 px at 390). "Airborne contact" = the same test on the ball at the moment of a head strike.

| Configuration | Matches | Live play | Goals | Goals/min | Time to 1st goal | **Ground goals** | Airborne contacts | Median contact height | Ball on the deck | Ball above the engine's own `ballHigh` gate | Flips/min | Goals L : R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1440×900, 6 heads (3v3) — **the default** | 5 | 444 s | 45 | 6.08 | 5.5 / 12.0 / 6.2 / 5.3 / 7.4 s | **80%** (36/45) | 48% | 14 px | 44.6% | 13.6% | 10.0 | 27 : 18 |
| 1440×900, 4 heads (2v2) — **low** | 2 | 100 s | 18 | 10.78 | 4.9 / 5.5 s | **100%** (18/18) | 63% | 96 px | 18.4% | 25.9% | 14.4 | 11 : 7 |
| 1440×900, 12 heads (6v6) — **high, a full cup field** | 1 (141 s sample) | 141 s | 3 | **1.28** | **13.6 s** | 67% (2/3) | **12%** | **0 px** | **80.6%** | 5.7% | 10.6 | 3 : 0 |
| 390×844, 6 heads (3v3) — **mobile** | 2 | 88 s | 16 | 10.96 | 11.2 / 5.3 s | 44% (7/16) | 63% | 85 px | 19.8% | 37.5% | 21.2 | 9 : 7 |
| **Aggregate** | **10** | **773 s** | **82** | — | — | **76%** (62/82) | — | — | — | — | — | **50 : 32** |

### 2.2 What the baseline says

1. **Ground goals dominate everywhere.** 76% aggregate, 100% at 2-a-side. The headline number.
2. **The 12-head case is the broken one.** The ball is on the deck **80.6%** of the time, only **12%** of contacts are airborne, the median contact height is **zero**, and the match produces **1.28 goals/min** against 6–11 everywhere else. This is exactly the "bundle up" failure Jayden describes — and it is the tournament's own field size.
3. **Mobile is *more* aerial than desktop, not less.** 63% airborne contacts and 37.5% high-ball frames at 390, against 48% and 13.6% at 1440. This falsifies the gravity-scaling premise directly (§4).
4. **The left goal concedes more, at every count** — 50:32 overall, and 3:0 in the 12-head sample. Not the old clamp bug (that one is genuinely fixed); it is a second, different asymmetry (§3.2).
5. **Flips are rare on desktop** — 10/min across six heads is roughly one flip per head per minute.

---

## 3. Root causes

Each of these was reproduced and measured. Line numbers are against `play-engine.js` at commit `f9f7c0d`.

### 3.1 Heads hop on the wrong plane, and spawn on top of the big head — **one bug**

**These are the same defect.** The brief's candidate — the lobby sphere — is ruled out: `play.html` ships no `[data-hm-orb]` element (it says so at `play.html:242`), so `ORB.sync()` never returns live and `_orbLive` is permanently false. The real cause is `surface` going stale across the match-exit transition.

**Mechanism.** `survey()` recomputes the shared feet plane every frame:

```js
// play-engine.js:638
var floorWas=floorY; floorY=fY-HH*FOOT;
// play-engine.js:646
if(floorY!==floorWas && !air && !grabbed && !perched && !window.__hmLavaOn && surface>=floorWas-2){
  surface=floorY; if(y<floorY) y=floorY; }
```

The re-seat is gated on **`!air`**. At the whistle, the exit branch (line 1158) deliberately throws every head back in from the screen edges:

```js
x=fs9?WL+2:WR-2; y=floorY-(140+Math.random()*240); ... air=true; st="fall"; surface=floorY;
```

— so **every head is airborne on the exact frame the arena resizes**. Measured at 1440×900: the hero grows from **540 px to 828 px** and `__hmFeetY` jumps from **501.28 → 789.28** within 66 ms of the whistle. Because every head is `air === true`, line 646 never fires, `surface` keeps the old pitch value (`380.52`), the head lands on it, and `!air` is now true but `floorY !== floorWas` is no longer true — so the guard never fires again either. **`surface` is stuck on the dead pitch line for the rest of the session.**

**Measured repro** (frames captured at 50 ms intervals after `finish()`): four of six heads settled at `y = 381`, feet at `381 + 120.76 = 501.8` — the old match feet plane to within half a pixel — while the real floor was at `668.5`. The `#stage` portrait spanned `342 … 811`, so `y = 381` puts a head standing **39 px inside the top of Jayden's face**. A screenshot confirms a head hovering over the portrait's forehead with nothing under it.

That is "spawning in weird on top of the big head." It is also "hopping incorrectly, sometimes on the wrong plane" — a head marooned there hops, lands back on the phantom plane, and its shadow and reflection (which are derived from `floorY`, not `surface`) are drawn 288 px away.

**No other plane bug was found.** The pitch arc (`ARC`) is inert (`CURVE=false`, `sag=0`), and `__hmFeetY` is a single shared value that soccer's `geo()` reads directly under `hmFull`, so goals, ball and feet genuinely share one line during play.

### 3.2 After a goal, every head drifts right — **a sign applied twice**

`play-engine.js:1164–1167`, the kickoff reset the brief pointed at:

```js
if(S9.kickSeed && S9.kickSeed!==soccerKickSeen){ soccerKickSeen=S9.kickSeed;
  var half9=heroR.w*0.5,
      tx9 = team===1 ? (M+Math.random()*(half9-HW-M*2))
                     : (half9+M+Math.random()*(half9-HW-M*2));
  if(!grabbed){ var dxk=tx9-x; dir=dxk>0?1:-1; surface=floorY; st="fall"; air=true;
    var vyk=500+Math.random()*150, ttk=2*vyk/G;
    vy=-vyk;
    vx=dir*Math.max(-820,Math.min(820,dxk/ttk));   // ← the bug
    ...
```

**The target is correct.** At 1440 with `HW=108, M=40`: red gets `[40, 572]` (left half), blue gets `[760, 1292]` (right half). Perfectly mirrored — this is not a second instance of the old clamp bug.

**The launch velocity is not.** `dxk/ttk` is already signed. `Math.max(-820, Math.min(820, …))` preserves that sign. Multiplying by `dir`, which *is* the sign of `dxk`, yields `|dxk/ttk|` — **always positive, always rightward**. Any head whose target lies to its left is fired *away* from it at up to 820 px/s.

Worked example: a red head at `x = 1300` after conceding. `dxk = 400 − 1300 = −900`; `ttk = 2·550/2600 = 0.423`; `dxk/ttk = −2128` → clamped to `−820`; `dir = −1`; `vx = −1 × −820 = +820`. It flies right for 0.423 s and lands against the wall.

**Measured confirmation.** Head-centre positions 900 ms after each `kickSeed` change, red (team 1, should be `< 720`):

| kickSeed | 12 | 13 | 14 | 15 | 16 | 21 | 22 | 23 | 26 | 29 |
|---|---|---|---|---|---|---|---|---|---|---|
| red centres | 690, 230, 867 | **949, 774, 1084** | 883, 422, 1011 | 899, 345, 1014 | **1195, 832, 1346** | **808, 1142, 1272** | **787, 1079, 1336** | **849, 1036, 1343** | **910, 1102, 1288** | **798, 1098, 1279** |

Eight of ten restarts put the entire red side in the wrong half. The maximum observed centre, **1346**, is exactly `WR + HW/2 = 1292 + 54` — they are pinned against the right wall. The same pattern reproduces at 390 (red centres 332, 330, 329 against `WR + HW/2 = 330`).

Blue is also affected — a blue head deep in the right half whose target is slightly left of it also flies right — which is why *everyone* ends up on the right, and why the left goal concedes 50:32.

### 3.3 A body in the goal is an unbeatable wall

Measured geometry at 1440×900 (all values hero-local; ground = `__hmFeetY = 501.28`):

| | Value | Above the ground |
|---|---|---|
| Goal mouth `GH` (from `.hmGoal{height:162px}`, read back via `offsetHeight`) | 162 px | crossbar at 162 |
| Ball diameter `2·BR` | 48 px | mouth = 3.38 ball diameters |
| Head collision circle: radius `HW·0.5` | 54 px | — |
| Head collision centre `y + HH·0.55` when standing | — | **49.5** |
| Head collision circle **top** | — | **103.5** |
| **Fraction of the mouth a single standing head occupies** | — | **63.9%** |

Scoring requires the ball's centre to clear the head's circle (`d > rr = 78`) and still be below the crossbar. Passing directly over a centrally-placed head, the ball centre must sit in `[127.5, 162]` above the ground — a **34.5 px** window. The crossbar test (`play-engine.js:2494`) additionally rebounds any **descending** ball whose centre is within `BR` of the bar, killing the top 24 px. **A descending shot has a 10.5 px window — down from 138 px with the mouth empty. One body removes 92% of it.**

At 390 the same computation gives a 61.3 px block of a 162 px mouth (38%) — because `GH` is a **fixed CSS constant that does not scale**, while `HW` does. The goal is relatively tightest exactly where Jayden plays most.

**Who stands there.** `makeRoles` (line 2249) only appoints a keeper at **4+ per side**; at 3 per side the team is `defender, attacker, attacker`. The keeper's station is clamped to the goal line:

```js
if(role==="keeper") bxT = team===1 ? Math.min(bxT, heroR.w*0.11) : Math.max(bxT, heroR.w*0.89-HW);
```

with the outer clamp allowing a centre as low as `x = 40` — **16 px from the scoring plane at `XL+BR = 24`**. That is precisely the 12-head configuration, and precisely the one measuring 1.28 goals/min and 3:0. The keeper is not a shot-stopper; it is a plug.

### 3.4 No aerial bootstrap — four gates, all shut

**(a) The loft is smaller than the geometry it has to overcome.** `play-engine.js:2505–2507`:

```js
if(rel<0){ var jI=-(1.72)*rel;
  var lx=nx, ly=ny-0.26, ll=Math.hypot(lx,ly)||1; lx/=ll; ly/=ll;
  bvx+=lx*jI; bvy+=ly*jI; ...
```

At a rest contact the vertical offset between ball centre and head collision centre is `HH·(FOOT−0.55) − BR`:

| | `HH·(FOOT−0.55)` | `− BR` | `rr = HW/2 + BR` | **`ny` at rest** | `ly = ny − 0.26` |
|---|---|---|---|---|---|
| 1440 | 49.48 | −24 | 78 | **0.327** | **+0.067 (downward)** |
| 390 | 29.32 | −16 | 48 | **0.277** | **+0.017 (downward)** |

The impulse leaves **4° below horizontal** at 1440 and **1° below** at 390. `0.26` is a literal chosen against no particular geometry; it is 26% short of what a desktop rest contact needs and 6% short on mobile. **Every ground strike is a ground pass.** The measured consequence is the 14 px median contact height and the 80% ground-goal rate.

**(b) The aerial AI's own trigger cannot be reached by the mechanism meant to trigger it.** `play-engine.js:1191`:

```js
var ballHigh=(floorY-ballY)>150;
```

`floorY` is the head's **box top** when standing (`fY − HH·FOOT`), not the ground. So `ballHigh` needs the ball's *centre* **270.8 px** above the pitch at 1440 — a rise of 246.8 px from rest, requiring `v = √(2·2600·246.8) = 1133 px/s`. The anti-stall pop (line 2483) supplies `860–1040 px/s`. **The engine's only ball-lifting mechanism can never satisfy the engine's own aerial gate.** Same threshold gates head-stacking at line 1433. Measured: the ball is above this gate only **13.6%** of the time at 1440 and **5.7%** at 12 heads.

**(c) Teammates cannot launch each other.** Head-to-head collision (line 1462):

```js
vx+=nx2*jI; vy+=ny2*jI*0.6;  o2.kx-=nx2*jI; o2.ky-=ny2*jI*0.6;
```

Two standing heads have `ny2 ≈ 0`, the vertical channel is additionally damped to 0.6, and there is **no loft term at all**. Bumping is purely horizontal. The only "use a teammate" mechanic is the explicit head-stack at line 1433 — which requires a 73 px horizontal landing window, a descending head at `vy > 120`, *and* the unreachable `ballHigh` gate. It is effectively dead code.

**(d) The lead-the-ball AI reads a field that is never written.** `play-engine.js:1179–1181`:

```js
var ballVX=(S9.ball.vx||0), ...
var leadX=Math.max(M,Math.min(heroR.w-M, ballX+ballVX*0.18));   // LEAD the ball
```

The loop publishes only `S.ball.x = bx; S.ball.y = by;` — confirmed at runtime: `Object.keys(S.ball) === ["x","y"]`. **`ballVX` is always 0.** Every head aims at where the ball *was*, arrives behind it, and shovels it along the floor. This is a one-line omission with an outsized effect on the ground-pass problem.

### 3.5 The roof exists but is out of reach

The ball has a genuine height axis and a ceiling (line 2492): `if(by<BR+2){ by=BR+2; ... bvy=Math.abs(bvy)*0.72; }`. But it sits at the **top of the hero box**, which is:

| | Ceiling height above the pitch | Strike speed required | Ball's own `bvy` clamp |
|---|---|---|---|
| 1440×900 | 475 px | 1571 px/s | −1900 (reachable, barely) |
| 390×844 | 730 px | 1948 px/s | −1900 (**unreachable**) |

Measured: zero ceiling contacts in 773 s. Jayden asked for "bouncing off the walls and roofs" — the roof is currently a formality. The walls are real (`e = 0.82` with spin reversal, line 2498) but only exist *above* the goal mouth, since below it the wall is the scoring plane.

---

## 4. The scaling question, resolved

The brief's hypothesis was that `GRAV`, the rolling resistance and the hop impulse being fixed absolutes while `HW` and `BR` scale means "gravity is relatively much stronger the smaller the world gets," worst at 390. **Measured, that is not what happens vertically — but there is a real and worse version of the same problem horizontally.**

Measured geometry, both viewports, six heads, mid-match:

| Quantity | 1440×900 | 390×844 | 390 ÷ 1440 |
|---|---|---|---|
| Pitch width (`XR−XL`) | 1440 | 390 | **0.271** |
| Arena height (hero) | 540 | 772 | 1.43 |
| `HW` | 108 | 64 | **0.593** |
| `HH` | 129.6 | 76.8 | 0.593 |
| `BR` | 24 | 16 | 0.667 |
| Goal mouth `GH` | 162 | 162 | **1.00** |
| `G` / `GRAV` | 2600 | 2600 | **1.00** |
| Max hop launch speed | ~1030 | ~1030 | 1.00 |
| **Apex of the biggest leap, `v²/2g`** | **204 px** | **204 px** | **1.00** |
| Apex ÷ `HH` | 1.57 | **2.66** | **1.69** |
| Apex ÷ arena height | 0.38 | 0.26 | 0.70 |
| **Apex ÷ pitch width** | **0.142** | **0.523** | **3.7** |
| Airtime of that leap `2v/g` | 0.79 s | 0.79 s | 1.00 |
| **Horizontal reach of one leap (`vx≤800`)** | **578 px = 0.40 pitch** | **578 px = 1.48 pitch** | **3.7** |
| Roll-out distance at 600 px/s (`v²/2·0.075g`) | 923 px = 0.64 pitch | 923 px = **2.37 pitch** | 3.7 |
| **Pitch width ÷ `HW`** | **13.3** | **6.1** | 0.46 |
| Six heads' combined width ÷ pitch width | 45% | **98%** | 2.19 |

**The vertical axis is fine and the premise inverts there.** Fixed `v` and fixed `g` give a fixed apex in pixels; dividing by a *smaller* head makes the leap relatively **bigger** at 390, not smaller. The measurements agree: 63% airborne contacts and 37.5% high-ball frames at 390, against 48% and 13.6% at 1440. Scaling `GRAV` down at 390 would make mobile float, not fix desktop.

**The horizontal axis is where the world genuinely collapses.** The pitch shrinks 3.7× while the players shrink 1.7×. At 390 six heads are 384 px of body across a 390 px pitch — **98% occupancy**. A committed leap crosses 1.48 pitch-widths, so it always ends against a wall; a struck ball rolls 2.37 pitch-widths before friction stops it, so it never settles anywhere but inside a body. That is why the ball is permanently inside a scrum on a phone, and it is a *pitch-to-player* ratio problem, not a gravity one.

**Implication for the design.** Do not scale `GRAV`. The two horizontal constants that should scale with the pitch, not stay absolute, are the **rolling resistance** and the **head's horizontal leap speed cap** (§5.7). And the constant that should scale with `HW`, not stay absolute, is the **goal mouth** (§5.5).

For the record on the sourced side: exact-similarity scaling says lengths ×k ⇒ velocities ×k ⇒ **g ×k**, time unchanged — which is why Unreal's default gravity is `−980` cm/s² rather than `−9.8` **(a)**. Froude similarity, where g is fixed and the world scales, gives `v ×√k` and `t ×√k` **(a)**. Neither is currently applied here in either axis; the engine simply holds every dynamic constant fixed and lets the geometry move underneath it.

---

## 5. The changes, ranked

Ranked by effect on the headline metric (ground-goal share) divided by risk. Every change preserves the existing invariant that goal, crossbar, wall clamp and scoring plane all derive from `XL`/`XR` and from `goalL.offsetHeight` — nothing below hard-codes a second copy of the goal geometry.

| # | Change | Effect on scoring mix | Risk | Chaos impact |
|---|---|---|---|---|
| 1 | Geometry-derived, state-dependent loft (§5.1) | **Very high** | Very low | Increases it |
| 2 | Publish `S.ball.vx/vy` (§5.2) | High | Trivial | Neutral / increases |
| 3 | Fix the kickoff sign bug (§5.3) | Medium (fixes 50:32) | Trivial | Neutral |
| 4 | Ground-relative `ballHigh` gate + head-stack unlock (§5.4) | High | Low | Increases it |
| 5 | Keeper off the line; goal mouth scales with `HW` (§5.5) | High | Medium | Neutral |
| 6 | A reachable roof, and rebound behaviour on it (§5.6) | Medium | Low | Increases it |
| 7 | Heads launch heads (§5.7) | Medium | Low | Increases it |
| 8 | Escalating anti-stall (§5.8) | Medium (kills the 12-head deadlock) | Low | Removes dead time only |
| 9 | Falling impulse-gain curve (§5.9) | Medium | Medium | Increases it |
| 10 | The poacher (§6) | Low on mix, high on drama | Medium | Preserves it |
| 11 | Stale-`surface` fix (§5.10) | None — it is a visual defect | Low | Neutral |
| 12 | More flips (§5.11) | None — it is flavour | Trivial | Increases it |

---

### 5.1 Geometry-derived, state-dependent loft — **the headline change**

Replace the literal at `play-engine.js:2506`.

**Derivation.** For a contact with normal `(nx, ny)`, the impulse direction is `(nx, ny − L)` renormalised. The launch angle above horizontal is `atan(−(ny−L)/|nx|)`. To guarantee a launch angle of `θ` at any contact geometry, `L = ny + tan(θ)·|nx|`. Since `|nx| ≈ 0.94` at a rest contact, `L ≈ ny + tan(θ)` is a good, cheap approximation; use the exact form.

**State dependence.** Do not use a single `θ`. Mirror the Sakurai angle **(a)**, §8.5: flat when both bodies are grounded and the contact is weak, ramping linearly to a maximum, and a fixed higher angle when the ball is already airborne. This is what stops every incidental scrum brush turning into a pop-up while still guaranteeing that a real strike lifts.

```js
// inside the per-head ball collision, replacing `var lx=nx, ly=ny-0.26, ...`
var _spd   = Math.abs(rel);                       // closing speed along the normal
var _ballUp = (groundY - BR) - by;                // ball's clearance above rest, px
var _ANG_LO = 0, _ANG_HI = 34, _ANG_AIR = 45;     // degrees
var _REL_LO = 260, _REL_HI = 900;                 // px/s
var _ang;
if (_ballUp > BR) _ang = _ANG_AIR;                // already off the deck -> full 45
else _ang = _ANG_LO + (_ANG_HI-_ANG_LO) *
            Math.max(0, Math.min(1, (_spd-_REL_LO)/(_REL_HI-_REL_LO)));
var _L  = ny + Math.tan(_ang*Math.PI/180) * Math.abs(nx);
var lx = nx, ly = ny - _L, ll = Math.hypot(lx,ly) || 1; lx /= ll; ly /= ll;
```

**Properties, checked:**

- Rest contact, hard strike (`rel = 900`, `ny = 0.327`, `nx = 0.945`): `_L = 0.327 + 0.675·0.945 = 0.965`, `ly = −0.638`, direction `(0.83, −0.56)` = **34° up**. Exactly as specified, and scale-independent — at 390 (`ny = 0.277`) the same expression yields the same 34°.
- Rest contact, weak brush (`rel = 200`): `_ang = 0`, `_L = ny`, `ly = 0` = **level**. Weak contacts still pass along the ground; the scrum's shuffling texture survives.
- Head stomping down onto the ball (`ny → 1`, `nx → 0`): `_L → 1`, `ly → 0` and `lx → 0` — degenerate. **Guard:** if `ll < 0.05`, fall back to the raw normal `(nx, ny)`. A descending head must still be able to spike the ball down; that is a good moment and it feeds the ground bounce.
- Head under a rising ball (`ny = −0.5`): `_ang = 45`, `_L = −0.5 + 0.866 = 0.366`, `ly = −0.866` = **60° up**. Aerial duels launch hard, which is the point.
- **Symmetry:** the expression contains no `x`, no `XL`/`XR`, and no team term. It cannot introduce a left/right asymmetry.

**Why not copy Rocket League here.** RL's ball-car collision explicitly **flattens** hits (`hitDir.z ×= 0.35`) and gets all its air from running the world at 0.66 g under an 8.3×-scale ball **(a)**, §8.1. That trade is not available: this pitch has no walls to drive up, no boost, and no player control, so the only way a head reaches a high ball is a ballistic leap whose apex is fixed. RL's *own* answer when a mode needs ground play to pop is to relax the flattening on grounded hits (`…_HOOPS_GROUND = 0.35 × 1.55`) **(a)** — i.e. the same shape as this proposal, in the same direction, for the same reason.

**Expected effect:** this is the mechanism that produces the 76% ground-goal rate. Every measured ground contact becomes a 0–34° launch. It should carry the mix most of the way to target on its own.

---

### 5.2 Publish the ball's velocity

In the loop, beside `S.ball.x=bx; S.ball.y=by;`:

```js
S.ball.x=bx; S.ball.y=by; S.ball.vx=bvx; S.ball.vy=bvy;
```

Two consumers light up immediately:

1. `leadX` (line 1181) starts leading the ball instead of trailing it. Heads meet the ball rather than chasing it, which converts a shove into a strike.
2. It enables **§5.4's landing-point aim**: with `vy` published, a head can solve where an airborne ball will be when it arrives, rather than aiming at where it is now.

Add a landing-point target for airborne balls, inside the existing `iAmChaser` branch — this is not new steering, it is a better value for the target the head already runs at:

```js
var _bvy=(S9.ball.vy||0), _bvx=(S9.ball.vx||0), _fall=(groundYShared-BR)-ballY;
var _tImp = _fall>0 ? (-_bvy + Math.sqrt(Math.max(0,_bvy*_bvy + 2*G*_fall)))/G : 0;
var _landX = Math.max(M, Math.min(heroR.w-M, ballX + _bvx*Math.min(0.9,_tImp)));
```

and use `_landX` in place of `leadX` when the ball is above the (new) `ballHigh` threshold. Cost: one `sqrt` per head per decision tick (~4 Hz). **(c)**

---

### 5.3 Fix the kickoff sign

`play-engine.js:1166` — delete the `dir*`:

```js
vx = Math.max(-820, Math.min(820, dxk/ttk));
```

`dir` stays as it is; it is still the correct facing and it still feeds `gzx=dir*0.6`. Nothing else changes. This is a one-token fix for §3.2.

**Additionally**, the leap is clamped to 820 px/s over an airtime of `2·vyk/G ≈ 0.42 s`, giving a maximum horizontal travel of **347 px** — not enough to cross a 1440 px pitch from the far side. A head conceding at the far end lands short and then has to walk. Solve the leap for the distance instead of clamping it flat:

```js
var _dxa = Math.abs(dxk);
var vyk  = Math.max(500, Math.min(1000, Math.sqrt(_dxa*G/1.6)));  // taller leap for a longer trip
var ttk  = 2*vyk/G;
vx = Math.max(-1150, Math.min(1150, dxk/ttk));
```

At `_dxa = 900`: `vyk = √(900·2600/1.6) = 1209` → clamped 1000, `ttk = 0.77 s`, `vx = −1169` → clamped −1150, travel 885 px. The head now genuinely arches back across the pitch — **which is itself an aerial, chaotic, watchable restart**, and it reads as a real reset instead of a shuffle. Cap `vyk` at 1000 so nobody exits the arena ceiling (`CEIL = 40`; apex from 1000 px/s is 192 px, well inside).

---

### 5.4 Make the aerial gates reachable

Replace the `floorY`-relative threshold at lines 1191 and 1433 with a ground-relative, size-relative one:

```js
var _gnd = (window.__hmFeetY != null) ? window.__hmFeetY : (floorY + HH*FOOT);
var ballHigh = (_gnd - ballY) > HH*0.9;
```

| | Old threshold (ball-centre clearance) | New threshold | Reached by the anti-stall pop (860–1040 px/s → 166–232 px)? |
|---|---|---|---|
| 1440 | 270.8 px | **116.6 px** | old: **no** · new: **yes** |
| 390 | 168.5 px | **69.1 px** | old: no · new: **yes** |

Apply the same substitution to the head-stacking precondition (line 1434, `(floorY-_sb.ball.y)>150`) and widen its landing window:

```js
Math.abs(_cxs-(_o2.x+_o2.HW/2)) < (HW+_o2.HW)*0.50   // was 0.34
```

At 1440 that takes the window from 73 px to **108 px** — one full head-width, which is the honest size of a crown. Also drop the springboard's own gate from `vy>120` to `vy>60` so a head arriving at the top of its arc can still use a teammate.

**"Using teammates to jump higher" then works as designed:** the springboard sets `vy = −(520 + min(360, |vy|·0.5))` from a launch point already `HH·0.14` up (102.7 px above the pitch at 1440), giving an apex of **252 px** against a normal leap's 170–204. That is a genuine 25–45% height advantage, visible on screen, earned by a teammate.

---

### 5.5 The goal: move the keeper, then scale the mouth

**(a) Move the keeper off the line.** This is the fix for §3.3, and it does not tidy anything — it makes the keeper a shot-stopper who can be lobbed and beaten to the rebound, instead of a plug.

```js
// replace the keeper clamp at play-engine.js ~line 1201
var _kStand = HW*1.6;                                    // 173 px at 1440, 102 px at 390
if(role==="keeper") bxT = team===1
  ? Math.max(XLlocal + _kStand, Math.min(bxT, XLlocal + _kStand + HW*1.4))
  : Math.min(XRlocal - _kStand - HW, Math.max(bxT, XRlocal - _kStand - HW*2.4));
```

(`XLlocal`/`XRlocal` are the pitch bounds in the head's own hero-local space; where the AI currently uses `M` and `heroR.w-M`, keep using those — the point is the *offset*, and it must be written as one expression mirrored term-for-term. Write it as a helper taking `sideSign` so the two branches cannot drift, per the lesson recorded in the comment at line 1244.)

With the keeper standing 1.6 head-widths out, the goal mouth is **empty** unless someone has drifted back into it, and the shot that beats the keeper produces a rebound in front of an open net — a scramble, which is more chaos, not less.

**(b) Scale the goal mouth with `HW`.** `GH` is read from `goalL.offsetHeight` (line 2199), so setting the element's height is enough to move the crossbar, the `inG` test, the drawn net and the scoring plane together — the invariant holds by construction.

```js
// in layout(), before GH is read:
var _gh = Math.round(Math.max(120, Math.min(260, HWshared*1.90)));
var _gw = Math.round(Math.max(28,  Math.min(56,  HWshared*0.39)));
if(goalL.style.height !== _gh+"px"){
  goalL.style.height = goalR.style.height = _gh+"px";
  goalL.style.width  = goalR.style.width  = _gw+"px"; }
GH = goalL.offsetHeight || _gh;
```

where `HWshared` is `peers.length ? peers[0].HW : (innerWidth<=880?64:108)` — the same source the ball shadow already uses at line 2534.

| | `HW` | Mouth today | Mouth proposed | Head-block share today | proposed | Descending-shot window with a body in it |
|---|---|---|---|---|---|---|
| 1440 | 108 | 162 | **205** | 63.9% | 50.5% | 10.5 px → **53.5 px** |
| 390 | 64 | 162 | **122** | 37.8% | 50.2% | — |

Note this makes the mouth *smaller* on mobile, which is correct: mobile currently measures 11.0 goals/min against a target band of 4–12, and a 122 px mouth is still 3.8 ball diameters. The two viewports converge on the same blocking ratio, which is what "symmetric by construction" should mean across breakpoints as well as across ends.

**The crossbar band widens with the bar.** Since `overL`/`overR` are derived from the goal's own width (currently the literal `44`; change to `_gw + 2` so it tracks), a taller goal produces proportionally more woodwork — and woodwork already broadcasts on the bus (`BUS.emit('woodwork', …)`, line 2494) and already makes every nearby head clutch its brows (line 1168). **That is the near-miss engine and it is already built** (§8.6).

---

### 5.6 A reachable roof

Replace the ceiling clamp at line 2492 with one placed a fixed, reachable distance above the pitch, and give it rebound behaviour rather than a stop:

```js
var ROOF_H = Math.min(groundY - (BR+2), Math.max(300, HWshared*3.6));   // 389 px @1440, 300 px @390
var ROOF   = groundY - ROOF_H;
if(by < ROOF){
  by = ROOF;
  if(Math.abs(bvy)>120){ var kc0=Math.min(0.1,Math.abs(bvy)*0.00012); bsyP=1-kc0; bsxP=1/(1-kc0); bsT=0.11; }
  bvy = Math.abs(bvy)*0.72;
  bvx += (Math.random()<0.5?-1:1)*(90+Math.random()*90);              // it comes down somewhere new
  bw  += (Math.random()*220-110);
  S.postSeed=(S.postSeed||0)+1; BUS.emit('woodwork',{x:S.ball.x,y:S.ball.y});   // heads feel it
}
```

Required strike speed: `√(2·2600·389) = 1422 px/s` at 1440 and `1249 px/s` at 390 — both comfortably inside the ball's `−1900` clamp and reachable by a 34°-lofted strike at `rel > 900`. The heads' own ceiling is `CEIL = 40` (desktop) / `28` (mobile), putting a head's crown up to **461 px** above the pitch at 1440 — **above the roof**, so a head can genuinely contest a ball at the roof line. That is the aerial duel Jayden is asking for.

Draw nothing. The rebound reads on its own, and the existing camera punch plus the woodwork reaction carry it. Reusing the `woodwork` event means the roof hit inherits the whole reaction package for free. **(c)**

---

### 5.7 Heads launch heads

Add an explicit vertical term to head-to-head collisions **during soccer only** (line 1462 region). This is Rocket League's `BUMP_UPWARD_VEL_AMOUNT_CURVE` pattern — a separate, explicit vertical velocity added on top of the lateral impulse, *not* a rotated normal **(a)**, §8.2:

```js
if(soccerOn && !window.__hmLavaOn){
  var _hitv = Math.abs(rel);
  if(_hitv > 300){
    var _up = Math.min(430, 0.28*_hitv);
    if(!grabbed && !perched){ vy = Math.min(vy, -_up); air=true; if(st==="idle") st="fall"; }
    o2.ky = (o2.ky||0) - _up*0.55;
    if(_up > 380 && Math.random() < 0.5) startFlip();
  }
}
```

Two heads charging the same ball now send each other up. `0.28` is chosen so a hard collision (`rel ≈ 1400`) produces `_up = 392` → a 29 px apex on its own, but it stacks on whatever leap the head was already carrying, and it flips the head into a somersault half the time. The `Math.min(vy, −_up)` form means it can only ever *add* upward velocity to a head that was already rising — it never cancels a descent, so a head diving on the ball still lands.

Also relax the horizontal leap cap so a head can actually reach the ball on a wide pitch (§4 showed 578 px of reach on a 1440 px pitch):

```js
vx = dir*Math.min(_lit?1000:900, Math.max(120, Math.abs(ddb9)/ttb9)*(_lit?1.12:1));   // was 900/800
```

And make the rolling resistance scale with the pitch rather than the absolute, so the ball settles in the same *fraction* of the pitch everywhere (§4 measured 0.64 vs 2.37 pitch-widths):

```js
var _MUR = 0.075 * (1440/Math.max(320, XR-XL));    // 0.075 @1440, 0.277 @390
if(onGround && Math.abs(bvy)<70){ var rf=Math.min(Math.abs(bvx), _MUR*GRAV*dt); bvx -= (bvx>0?1:-1)*rf; }
```

This is the one place scale-correction genuinely belongs, and it is horizontal, not vertical.

---

### 5.8 Escalating anti-stall

The 12-head case is the one that stops the match: 80.6% deck time and 1.28 goals/min. Two fixes.

**(a) Close the dead band.** Today (line 2479):

```js
if(onGround)_deckT+=dt; else if(by<REST-BR*0.6)_deckT=0;
```

A ball nudged into `[3, 14] px` of clearance neither accumulates nor resets — the timer freezes. In a crowd that is where the ball spends most of its life. Replace the `else` with a decay:

```js
if(onGround) _deckT += dt;
else if(by < REST-BR*0.6) _deckT = 0;
else _deckT = Math.max(0, _deckT - dt*0.5);          // half-speed unwind in the bobble band
```

**(b) Escalate, pinball-style.** Mission Pinball's ball search runs three progressively more disruptive phases and finally surrenders **(a)**, §8.7. Apply the same shape:

```js
if(_deckT > DECK_MAX){
  _deckT = 0; _popN = (_popN||0) + 1;
  if(_popN === 1){                                   // nudge
    bvy = -(940+Math.random()*180);                  // clears the new ballHigh gate with room
    var _d=bvx>=0?1:-1; if(Math.abs(bvx)<1)_d=Math.random()<0.5?-1:1;
    bvx = _d*Math.max(150, Math.abs(bvx)*0.85);
  } else if(_popN === 2){                            // shove, toward the emptier half
    bvy = -(1320+Math.random()*160);                 // ~335-390 px: into roof territory
    var _mid=(XL+XR)/2, _l=0,_r=0;
    for(var _q=0;_q<peers.length;_q++){ if(peers[_q].elim||peers[_q].__bench) continue;
      if(peers[_q].x+peers[_q].HW/2 < _mid) _l++; else _r++; }
    bvx = (_l<=_r ? -1 : 1) * (520+Math.random()*220);
  } else {                                           // surrender: re-drop at centre
    _popN = 0; dropIn();
  }
  bw += (Math.random()*320-160);
  var _kp=0.11; bsyP=1-_kp; bsxP=1/(1-_kp); bsT=0.13;
}
```

Reset `_popN = 0` on any goal, on any contact where `|rel| > 700`, and in `dropIn()` / `kickoffCountdown()`. Also lower `DECK_MAX` from `2.6` to `1.8` — the measured longest single deck episode at 12 heads was cut short repeatedly by exactly the dead band above, so the effective stall is far longer than the constant implies.

The phase-2 shove **aims the ball at the emptier half**. That is Jayden's "if they hit it to the other side there is nobody there" — solved from the ball's side rather than by re-arranging the players. It creates a chase, which is more chaos.

---

### 5.9 A falling impulse-gain curve

Today `jI = 1.72·|rel|` — a constant gain. Rocket League uses a **compressor**: gain 0.65 below 500 uu/s, falling to 0.30 at 4600 **(a)**, §8.2. It amplifies gentle touches so nothing feels dead, and holds hard hits back so they do not saturate the speed clamp. That is precisely the 12-head problem: in a scrum every contact is gentle and the ball never accelerates out.

```js
var _rs = Math.abs(rel);
var _gain = _rs <= 220  ? 2.05
          : _rs >= 1600 ? 1.45
          : 2.05 + (1.45-2.05)*(_rs-220)/(1600-220);
var jI = _gain * _rs;
```

At `rel = 150` the impulse rises from 258 to 308 (+19%); at `rel = 1800` it falls from 3096 to 2610 (−16%), keeping the ball inside its `±2200` clamp more often and so preserving the *variety* of ball speeds rather than pinning everything at the ceiling. Keep the head's recoil term `p.kx -= nx*jI*0.08` reading the same `jI`, so the reaction stays consistent.

**Risk note:** this interacts multiplicatively with §5.1. Land §5.1 first, measure, then tune `_gain`'s endpoints against the acceptance criteria in §9 rather than shipping both blind.

---

### 5.10 The stale-`surface` fix

Three parts, all in the head closure.

**(a)** Let an airborne head re-seat its `surface` (line 646). Keep `!air` gating only the *position* snap:

```js
if(floorY!==floorWas && !grabbed && !perched && !window.__hmLavaOn && surface>=floorWas-2){
  surface = floorY;
  if(!air && y<floorY) y = floorY;
}
```

**(b)** Re-seat explicitly on the match-exit transition (line 1158), after the head's coordinates are set:

```js
if(S9 && !S9.on && soccerOn){ soccerOn=false; ... 
  try{ survey(); }catch(_){}          // pick up the arena's new height first
  surface = floorY;                   // ...and stand on the plane it just published
  ...
```

**(c)** A standing safety net, so a head marooned on a dead plane by any future path recovers on its own:

```js
if(!air && !grabbed && !perched && !battleOn && !window.__hmRaceOn && !window.__hmLavaOn
   && Math.abs(surface - floorY) > 2){
  surface = floorY; air = true; st = "fall";       // it falls to the real floor, once
}
```

This is the only guard that is not a targeted fix, and it is deliberately shaped as a self-heal in the same spirit as the NaN killswitch at line 1697 — a head standing on nothing is always a bug, whatever produced it.

---

### 5.11 More flips

`startFlip()` refuses below `|vy| = 700` (line 798) — correct, a low hop cannot finish the turn. But the soccer leap only rolls for one at `vyb9 > 780` with probability 0.5 (line 1223). Raise it:

```js
if(vyb9 > 720 && Math.random() < 0.7) startFlip();
```

plus the two new triggers already specified: the head-stack springboard (§5.4) and the head-to-head launch (§5.7). Measured baseline is 10 flips/min at 1440; target ≥ 20, which is roughly what 390 already produces (21.2) and which reads as the somersaulting scramble Jayden means by "flipping."

---

## 6. The poacher

Jayden: *"maybe someone that's like farther offense and can prevent those easy goals"* — with *"I'm not saying play crazy defense"* attached, and then: *"Make it so it's an egg head that sits back though, not the main person. For tournament mode, that is."*

**This is one head with a different job, not a formation.** No separation steering, no zones, no role system for the team. The scrum is untouched. The only thing that changes is that one head's target `x` is computed from the attacking third instead of from the ball.

### 6.1 Casting

**The named heads stay in the scrum.** They are the stars of the scene; parking one upfield takes the most interesting character out of the action for a whole match.

| Context | Poacher |
|---|---|
| **Tournament** (`buildTeams`, `play-tournament.js:488` — every player is a dyed egghead; `perTeam()` is 2 on mobile, 3 on desktop) | The **last** entry of `playersOf(tm)` — i.e. the highest-index squad egghead. Index 0 is always the captain and is never eligible. Deterministic: the same slot every fixture, so it reads as a role rather than a head wandering off. |
| **Normal match** | The **highest slot** on that team that is an egghead and is not mini-Jayden (`slot < 9000` and the head is not one of the visitor's own saved heads). |
| **Normal match, team is all real heads** | **No poacher.** Accept the occasional empty far side. |
| **Mini-Jayden** | **Never.** He is a deliberate character and the odd-roster filler. |

The all-real-heads call is the one that needs justifying. The alternatives were: promote a real head anyway (contradicts an explicit instruction), or spawn an extra head to fill the role (changes the visitor's roster, which is meaningful — the head count on the pitch is *their* head count). Neither is acceptable, so **no poacher** is the answer. In practice a fully-real roster is at most a handful of heads, which is exactly the low-count case where §6.3 disables the role anyway.

Store it as a flag next to the existing roles so nothing downstream has to re-derive it:

```js
// in makeRoles(), after roles are assigned
S.poach = S.poach || {};
[1,2].forEach(function(tm){
  var mem = sl.filter(function(s){ return S.teams[s]===tm; });
  S.poach[tm] = null;
  if(mem.length < 3) return;                                  // §6.3
  var cand = mem.filter(function(s){ return isSpareEgg(s); }) // egghead / filler, not mini-Jayden, not a saved head
                .sort(function(a,b){ return b-a; });
  if(cand.length) S.poach[tm] = cand[0];
});
```

`isSpareEgg(slot)` must be one function with one definition, consulted by both the tournament and the exhibition path, so the two cannot drift.

### 6.2 Behaviour

The poacher is **not** a fourth `role`. It is a modifier on the existing SUPPORT branch, so it inherits all the wander, all the reactions and all the collision behaviour every other head has.

```js
var _isPoach = (S9.poach && S9.poach[team] === slot);
```

Three changes, and only three:

1. **It rarely takes the chase.** After `iAmChaser` is computed:
   ```js
   if(_isPoach && Math.abs(ballX - myX) > HW*2.5) iAmChaser = false;
   ```
   Inside 2.5 head-widths it plays exactly like anyone else — it charges, it leaps, it heads the ball, it collides. **This is the line that stops it reading as a mannequin.**

2. **Its support target sits in the attacking third**, not just ahead of the ball:
   ```js
   var _third = (atk>0) ? (M + (heroR.w-2*M)*0.72) : (M + (heroR.w-2*M)*0.28);
   aheadX = _isPoach
     ? Math.max(Math.min(_third, heroR.w-M), Math.min(Math.max(_third, M),
                ballX + atk*HW*3.2)) + (Math.random()*90-45)
     : /* existing expression */;
   ```
   Written as one expression with `atk` carrying the sign, so it mirrors by construction — the failure mode recorded at line 1244 must not recur. It keeps the existing `±` random jitter (widened from ±30 to ±45) so the poacher **drifts and fidgets** rather than standing on a spot.

3. **It still leaps.** It keeps `wantHigh`, keeps `startFlip`, keeps head-stacking. When the ball comes over the top into its third, it is already there and already goal-side — which is exactly the "long ball produces a contest instead of a walk-in" outcome Jayden asked for.

**No mechanism anywhere pushes the poacher and its teammates apart.** If the scrum happens to arrive in the attacking third, the poacher is in it.

### 6.3 Head counts

| Per side | Poacher | Reasoning |
|---|---|---|
| 1 | No | There is no team. |
| **2** | **No** | Measured: 2v2 runs at 10.8 goals/min with a 4.9 s time-to-first-goal and no dead air at all. Committing one of two heads upfield leaves a single head in the scrum, which reads thin — and the "empty far side" problem does not exist at this count, because the ball is never far from someone. |
| 3 (desktop default, desktop tournament) | **Yes** | One forward, two in the pile. |
| 4+ | **Yes**, one only | The scrum is large enough that one absent head is invisible, and the far side genuinely does empty. |

**Consequence to state plainly:** `perTeam()` is 2 on mobile, so **mobile tournaments have no poacher**. That is the right call given the 2-a-side measurement, and it is the honest trade — mobile keeps its fast, scrappy, high-scoring match, and the poacher exists where the pitch is wide enough for a far side to be empty.

**Also raise the keeper threshold in step.** `makeRoles` appoints a keeper at 4+ per side; the poacher is drawn from the same pool. At exactly 4 a side, one keeper + one poacher + two chasers is still two in the pile, which is fine. Below 4 there is no keeper anyway.

---

## 7. What must not change

Recorded so a later pass does not undo the point of this one.

- **No separation steering, no boids, no zone assignment, no per-team formation.** The textbook fix for "everyone converges on the ball" would destroy the exact quality Jayden likes. Three separate quotes.
- **No easing on the leap.** The comment at line 1407 records that arrive-easing was tried and killed the ball-strikes; soccer keeps raw ballistic leaps deliberately.
- **No new chrome.** No drawn roof, no aerial indicator, no trajectory line. The rebound and the existing camera punch carry it.
- **The `XL`/`XR` invariant.** Goal, crossbar, wall clamp, kickoff centre and scoring plane all derive from those two numbers and from `goalL.offsetHeight`. §5.5 changes the element's height so every one of them moves together; nothing may hard-code a second copy.
- **Left/right symmetry must be structural, not duplicated.** Every mirrored expression in this document is written once with a sign term (`atk`, `sideSign`). The bug at line 1244 and the bug at §3.2 are both "the same value written twice in two spaces."
- **`localStorage` is read-only** during any test — Jayden's ~890 KB of baked heads live there.

---

## 8. Research

Tagged per this project's convention: **(a)** sourced research · **(b)** observed in a shipping product · **(c)** my own inference.

### 8.1 Rocket League's aerials come from under-gravity, not from an upward bias **(a)**

Rocket League runs Bullet Physics inside Unreal Engine 3 at a deterministic 120 Hz fixed tick (Jared Cone, GDC 2018, <https://www.gdcvault.com/play/1024972/It-IS-Rocket-Science-The>). Psyonix has never published a constants table; the numbers below are community reverse-engineering from two independent sources that agree — the RLBot wiki (<https://wiki.rlbot.org/v4/botmaking/useful-game-values/>) and RocketSim's `src/RLConst.h` (<https://github.com/ZealanL/RocketSim/blob/main/src/RLConst.h>).

`GRAVITY_Z = −650` uu/s² (1 uu = 1 cm) = **6.5 m/s² ≈ 0.66 g**. Ball radius 91.25 uu (1.825 m diameter — 8.3× a real football). Ball restitution vs world 0.6, friction 0.35, drag 0.03, max speed 6000 uu/s, max angular speed 6 rad/s. Car mass 180, ball mass exactly car/6.

The design reading: the ball is 8.3× oversize but gravity is *0.66 g*, not 8.3 g. Dimensional similarity demands the opposite. Psyonix ran the world roughly 12× under-gravitied relative to its own scale, and every aerial in that game descends from that one decision.

**And the collision code flattens hits rather than lifting them.** RocketSim `Ball::_OnHit`: `hitDir = (relPos * Vec(1,1,zScale)).Normalized()` with `BALL_CAR_EXTRA_IMPULSE_Z_SCALE = 0.35f` — the vertical component of the hit direction is *shrunk* by 65%. smish.dev's independent derivation has the same line (<https://www.smish.dev/rocket_league/ball_simulation_3/>).

Where RL *does* bias upward it does so explicitly and per-mode: Hoops relaxes the flattening for grounded cars (`× 1.55`); Heatseeker forces 30% of a wall re-launch straight up (`WALL_BOUNCE_UP_FRAC = 0.3`); the Hoops kickoff applies a scripted `BALL_HOOPS_LAUNCH_Z_VEL = 1000` uu/s, 0.265 s after reset.

**Why this document goes the other way.** The RL trade — flatten hits, buy air with low gravity — is unavailable here: no player control, no boost, no drivable walls, and a leap whose apex is fixed by a hop impulse. RL's own answer when a mode needs grounded play to pop is to *relax the flattening on grounded hits*, which is the same shape and direction as §5.1. **(c)**

### 8.2 Satisfying launches are a scripted, non-conservative injection with a falling gain **(a)**

Two impulses fire on every car-ball contact. The Bullet contact itself is forced to `CARBALL_COLLISION_RESTITUTION = 0.0` and `CARBALL_COLLISION_FRICTION = 2.0` — **perfectly inelastic and maximally grippy**. None of the pop comes from elasticity.

All of it comes from the "extra impulse":

```
relSpeed = min(|ball.vel − car.vel|, 4600)
addedVel = hitDir * relSpeed * FACTOR_CURVE(relSpeed)
FACTOR_CURVE = { 0 → 0.65, 500 → 0.65, 2300 → 0.55, 4600 → 0.30 }
```

Applied to the ball with **no reaction on the car** — momentum is deliberately not conserved (smish.dev, above) — and rate-limited to one per physics tick. The falling gain is a compressor: weak touches get amplified 65%, the hardest possible hit only 30%. That is the shape §5.9 ports.

Separately, **car-on-car bumps carry an explicit vertical term**: `BUMP_UPWARD_VEL_AMOUNT_CURVE = {0 → 0.333, 1400 → 278, 2200 → 417}` uu/s, added on top of the lateral bump curve. **Bodies pop; balls do not.** That is §5.7 exactly — a separate vertical add rather than a rotated normal.

### 8.3 Scale invariance **(a)**

Exact similarity — same trajectory shape, same duration, k× larger on screen — requires lengths ×k, velocities ×k, accelerations ×k, so **g ×k**, with time and all dimensionless coefficients (restitution, friction) unchanged. The shipped example is Unreal, where 1 uu = 1 cm and default `GravityZ = −980` = 100 × 9.8 (<https://techarthub.com/scale-and-measurement-inside-unreal-engine/>).

Froude similarity — g fixed, world ×k — instead gives `v ×√k` and `t ×√k` (<https://en.wikipedia.org/wiki/Froude_number>). The graphics citation for transferring a controller between differently-sized characters is Hodgins & Pollard, *Adapting Simulated Behaviors for New Characters*, SIGGRAPH 1997 (<https://dl.acm.org/doi/abs/10.1145/258734.258822>). The oldest practical version is miniature filming: shoot at `√k × 24` fps (<https://www.cinematography.net/edited-pages/MiniatureFormula.htm>).

Box2D's manual carries the counter-caution that a physics solver is tuned for a length band and misbehaves outside it (<https://box2d.org/documentation/>) — relevant because §5.7's scaled friction changes a coefficient, not a length, and so stays inside the band.

**Applied here:** at ~270 px/m (a 60 px head against a 0.22 m real head), "Earth-realistic" gravity is ≈ 2650 px/s². The engine's 2600 is therefore almost exactly 1 g for its own scale — it is not under-gravitied at all, which is the *opposite* of Rocket League's choice and the reason its ball never hangs. **(c)** Lowering `GRAV` would work, but apex goes as `v²/2g` and hang time as `v/g`, so every launch velocity in the file would need re-solving; §5.1 achieves the same scoring-mix change by rotating existing impulses rather than re-tuning twenty constants. **(c)**

### 8.4 Restitution and spin **(a)**

Measured coefficients of restitution: squash ball 0.42–0.45; Rocket League's ball 0.60; NBA basketball ≈0.76; ITF tennis ball 0.763–0.786; **FIFA-approved football 0.82–0.88** (<https://www.topendsports.com/biomechanics/coefficient-of-restitution.htm>, <https://asisoccers.com/deformation-coefficient-of-restitution-fifa-pro-soccer-balls/>). 0.6 reads as "controllable"; 0.75–0.88 reads as "lively."

This engine's ball uses 0.72 on the first ground handler and 0.62 on the second (lines 2473 and 2496 — two contacts per frame with different restitutions, worth noting as a latent inconsistency). Both sit in the "controllable" band. A real football's 0.85 is citable and would itself be an anti-stall property: a ball losing only 28% of its energy per bounce bounces 15+ times before settling. **Not proposed here** — §5.1 and §5.6 should be measured first, because raising restitution on top of them risks a ball that never comes down. **(c)**

Contact-level spin (the mechanism that makes rebounds unpredictable) is the slip-velocity model: `s = v∥ + R(n×ω)`, tangential impulse `J∥ = −m·min(1, Y‖v⊥‖/‖s‖)·μ·s`, with the `min(1, …)` acting as the slide-to-roll switch (<https://www.smish.dev/rocket_league/ball_simulation_1/>). This engine already has the cheap 2D version — `bw` gains spin from off-centre hits (line 2515), walls reverse it (line 2498), and grounded rolling converges to roll-without-slip (line 2525). **What it lacks is spin feeding back into the bounce**, so a spinning ball never kicks sideways off the floor. That is a legitimate future addition and is out of scope for this pass.

Rocket League has **no Magnus term** — drag is pure linear damping. A backspin-driven Magnus lift would be the single most on-theme *physical* addition for "more airborne" (a headed ball with backspin floats) but it adds a per-frame force term to the ball loop, and the performance lane owns that file. Deferred. **(c)**

### 8.5 The Sakurai angle — state-dependent launch **(a)**

Smash Bros. encodes a special knockback angle, ID **361**, whose behaviour depends on the target's state and the hit's strength (<https://www.ssbwiki.com/Sakurai_angle>):

| Game | Grounded, low KB | Grounded, high KB | Airborne | Low threshold | High threshold |
|---|---|---|---|---|---|
| Melee | 0° | 44° | 45° | 32 | 32.1 |
| Brawl | 0° | 37° | 45° | 60 | 88 |
| Smash 4 | 0° | 40° | 45.26° | 60 | 88 |
| Ultimate | 0° | 38° | 38° | 60 | 88 |

Between the thresholds the angle **interpolates linearly**. The stated purpose is "to allow grounded battles between fresh opponents without allowing attacks to be deadly semi-spikes at KO percentages." In Ultimate, moves authored at a literal 0° are additionally re-aimed to 32° once knockback exceeds 120 units.

**This is the exact mechanism §5.1 needs**, and the reason a fixed loft constant is the wrong shape: the angle must be a function of state (is the ball already up?) and strength (was this a real strike or a scrum brush?), not a literal.

Sakurai's own note on hitstop (Famitsu vol. 490, translated at <https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/>) also carries a constraint that applies directly here: he caps freeze duration because *a frozen pair is a free target for a third player in a free-for-all*. This pitch has up to twelve heads; the existing `__hmFreeze` hitstop should not be lengthened as part of this work. **(c)**

Hitstop durations for reference: Melee `⌊⌊⌊d/3+3⌋·e⌋·c⌋` capped at 20 frames; Ultimate capped at 30 — a practical band of **3–20 frames (50–330 ms)** (<https://www.ssbwiki.com/Hitlag>). This engine's freeze sits inside that band already.

Empirical support for hitstop mattering: Lin, Duan, Wen & Cai, *What Features Influence Impact Feel?* (<https://arxiv.org/abs/2208.06155>) — of a 19-feature framework ranked against Steam reviews, the three whose absence most reliably ruins impact feel are hit stop, sound coherence and camera control.

### 8.6 Engineering near misses **(a)**

Clark, Lawrence, Astley-Jones & Gray, "Gambling Near-Misses Enhance Motivation to Gamble and Recruit Win-Related Brain Circuitry," *Neuron* 61(3):481–490, 2009 (<https://www.sciencedirect.com/science/article/pii/S0896627309000373>). Near misses were rated **less pleasant** than full misses yet **increased the desire to continue**, recruiting reward circuitry that overlapped with actual wins — but **only on trials where the participant had personal control** over arranging the gamble.

That caveat is the design lesson and it cuts against a purely autonomous simulation: a near miss the viewer did not cause registers weakly. **The compensation is legibility** — the near miss must be *visibly* a near miss. This engine already has the machinery: `BUS.emit('woodwork')` on a crossbar hit, `S.postSeed` bumping so every head within 220 px clutches its brows (line 1168), and the camera punch. §5.5's taller crossbar and §5.6's roof both feed events into that existing package, which is the cheapest possible way to multiply near-miss moments. **(c)**

On *manufacturing* them: Harrigan's work on slot machines (<https://link.springer.com/article/10.1007/s11469-007-9066-8>) documents "clustering" — virtual reels that disproportionately map blank stops adjacent to jackpot symbols so the jackpot lands just above or below the payline far more often than chance. A 1989 Nevada Gaming Commission ruling held that algorithms creating near misses *on* the payline are unacceptable while virtual-reel mapping creating them *above and below* is acceptable. **The transferable principle: make the near miss geometric, not scripted** — widen the region where "almost" physically happens (a taller bar, a roof, a post) rather than deciding an outcome and animating toward it. Everything in §5 is geometric.

Burnout's Near Miss (<https://burnout.fandom.com/wiki/Near_Miss>) fills the boost bar for passing close to traffic and chains indefinitely; **the tuning history is the most transferable data point — later entries widened the near-miss distance threshold because the original was too tight to trigger reliably.** **(b)**

Shipped sports games do hard-code drama. NBA Jam's designer Mark Turmell, confirmed: *"if the Bulls take a shot to win or tie the score in the last 5s, I threw up a brick. There's an actual code in there that prevents them from winning"* (<https://en.wikipedia.org/wiki/NBA_Jam_(1993_video_game)>). **(b)** By contrast, EA's FIFA "scripting" is folklore with a patent attached — the Dynamic Difficulty Adjustment and EOMM patents are real, EA denies using DDA in online modes, and no direct evidence has established that the patented system ships. **Report as contested; do not build on it.** **(a)**

**Nothing in this document scripts an outcome.** Every proposed change is a change to the physics or to one head's target position.

### 8.7 Anti-stall systems **(a)**

Mission Pinball's ball search (<https://missionpinball.org/latest/game_logic/ball_search/>) is the best-documented general anti-stall design and supplies three ideas §5.8 uses directly:

1. A timer that **resets on every playfield switch** — i.e. real activity, not a proxy for it.
2. **Escalation** — three configurable phases (`ball_search_phase_1/2/3`), each pulsing progressively more disruptive coils; early rounds nudge, later rounds do destructive things like resetting drop targets.
3. **An explicit surrender state** — if phase 3 exhausts, the machine gives up and replaces the ball.

It is also **suppressed while the player holds a flipper** — the system distinguishes "stuck" from "deliberately held," which is the same distinction §5.8(a)'s bobble-band decay is trying to make.

Rocket League's equivalents: the post-goal reset with countdown; the Hoops forced launch (`1000` uu/s at `0.265 s`), guarded on `vel.IsZero() && angVel.IsZero() && pos.To2D().IsZero()` so it only fires on a genuine stall; the Heatseeker wall re-launch (re-aim *and* re-energise on contact rather than on a timer). Snowday does the opposite deliberately — `PUCK_GROUND_STICK_FORCE = 70` pins the puck down, because that mode wants ground play.

The Pong/Breakout family contributes the rule that the ball's angle must be **clamped away from horizontal** or it can enter an inescapable flat loop, and the classic fix that the rebound angle should be a function of **where on the paddle the ball lands**, not of the incoming angle (original Pong split the paddle into 8 segments). **(b)** §5.1 is the same idea in a different coordinate: the launch angle comes from the contact geometry and the strike strength, not from the incoming velocity — and, per Clark, contact-position mapping is also what makes an outcome feel authored rather than random.

---

## 9. Acceptance criteria

Re-run the §2 protocol — 1440×900 at 4, 6 and 12 heads and 390×844 at 6 heads, three matches each, pane fronted — and compare against the baseline table.

**Must hold:**

| Metric | Baseline | Target |
|---|---|---|
| **Ground goals** (ball underside ≤ 1 `BR` above the pitch at the crossing) | **76%** aggregate; 100% at 2v2; 80% at 3v3 | **≤ 35% aggregate, and ≤ 50% in every single configuration** |
| Goals with the ball ≥ 1 `HH` up | ~2% | **≥ 25%** |
| Ball on the deck | 44.6% / 18.4% / **80.6%** / 19.8% | **≤ 35% in every configuration** |
| Goals per minute | 6.1 / 10.8 / **1.3** / 11.0 | **4 – 12 in every configuration** |
| Median time to first goal | 6.2 / 5.2 / **13.6** / 8.3 s | **≤ 12 s in every configuration** |
| Restarts where > ⅔ of one team is in the wrong half at kickoff + 900 ms | **8 of 10** | **0 of 20** |
| Goals by end, aggregate | 50 : 32 | **within 60:40 over ≥ 60 goals** |
| Flips per minute at 1440 | 10.0 | **≥ 20** |
| Heads resting on a plane other than `floorY` after a match ends | **4 of 6** | **0** |
| Ceiling/roof contacts per minute | **0** | **≥ 1** |

**Must not regress:** no change to the number of heads that converge on the ball; no change to the collision rate between heads; the scrum's visual density at 6 and 12 heads unchanged. If any proposal measurably *reduces* head-to-head contacts per minute, it has broken the rule and must be reverted rather than tuned.

**Landing order.** §5.3 and §5.10 first (pure defect fixes, no tuning). Then §5.2 and §5.4 (they unlock code that already exists). Then §5.1 alone, and measure — it is expected to carry most of the headline metric by itself. Then §5.5, §5.6, §5.7, §5.8. Then §6. Hold §5.9 last and tune its endpoints against the table above rather than shipping it blind alongside §5.1.

---

## 10. Open questions for Jayden

1. **Mobile tournaments get no poacher** because `perTeam()` is 2 there and 2-a-side measures fine without one (§6.3). Accept, or raise `perTeam()` to 3 on mobile so the role exists everywhere?
2. **The goal mouth shrinks on mobile** under §5.5(b) — 162 → 122 px — so both breakpoints share one blocking ratio. Mobile currently runs at 11 goals/min, so this should read as tightening a loose net rather than taking something away, but it is a visible change to a shape he has seen a lot.
3. **Spin-dependent bounce** (§8.4) is the one genuinely new physical mechanism that would add unpredictability rather than height. It is a per-frame addition to the ball loop and therefore blocked on the performance lane. Worth a later pass?
