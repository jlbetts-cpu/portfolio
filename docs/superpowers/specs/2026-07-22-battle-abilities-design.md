# Battle Abilities — Design Spec

Date: 2026-07-22
Status: Approved direction, pending spec review

## Goal

Make the homepage **Battle** mode genuinely entertaining: AI heads smash **mystery crates** to gain **physics-chaos abilities** with **deeply-juiced, readable VFX**. More chaos, more bouncing, more mayhem — but every effect must be *clear* (who did what to whom). Also ship a small related **soccer team picker**.

Constraints:
- Single-file `index.html`, vanilla JS, no build step. New code lives in the companion engine IIFE and the battle/soccer subsystems.
- All heads are **AI-driven** — abilities must auto-fire or grant timed states; no new player input.
- **Nothing resizes heads** — scaling the mini-Jayden clone + its collision box, ground-plane, and shadow every frame is fragile (dropped by request). Power/speed abilities achieve their fun without changing size.
- Clean minimal white aesthetic — effects use dark cores + saturated accents so they read on white; Apple-tasteful restraint, never screen-filling noise.
- Performant: one shared, capped particle system; everything bails when the battle ends (`battleOn` false / `__hmRespawn`).

## Architecture — three units

### 1. VFX toolkit (`fx`)
One shared, capped particle canvas (reuse the `__hmFx` full-viewport canvas pattern) plus reusable primitives that every ability composes. This is the "juice is cheap and consistent" layer.

Primitives (each tuned for white-bg contrast):
- `fx.burst(x,y,{color,count,speed,gravity,life,size})` — particle spray (debris, sparks, dust, feathers, frost).
- `fx.ring(x,y,{color,r0,r1,life,width})` — expanding stroked ring = **force/knockback** (bomb, slam, magnet pulse).
- `fx.trail(head,{color,life})` — afterimage trail for fast/displaced heads (speedster, rocket, blink).
- `fx.spark(x,y,dir,{color})` — a hit-spark at a contact point.
- `fx.flash({color,alpha,life})` — brief full-screen flash (reserved for big beats: bomb, gravity slam).
- `fx.shake(mag,life)` — screen shake (scales to impact importance; extends existing `shakeAfter`).
- `fx.icon(head,glyph,{color})` — floating ability icon/badge that rises off a head on pickup and can persist as a small holder badge.
- `fx.label(name,{color})` — center pickup name-flash ("GRAVITY FLIP").

Everything is drawn on one rAF-driven canvas, capped particle pool (e.g. ≤ 240 live), auto-cleared and hidden when no battle is active.

### 2. Ability registry (`ABILITIES`)
Each ability is a small self-contained spec so adding/tuning = editing one entry:

```
{
  id, name, glyph, color, weight,          // identity + spawn odds + signature color
  kind: "self" | "target" | "arena",       // who it affects (drives the clarity treatment)
  onSmash(me, ctx),                         // fired when this head smashes the crate
  onTick(me, dt, ctx),                      // optional per-frame while active
  onEnd(me, ctx),                           // optional cleanup
  dur                                       // seconds of active state (0 = instant)
}
```

`ctx` exposes: `peers`, `battlePlats`, arena rect, `fx`, gravity accessor, and helpers (`nearestRival`, `applyKnockback`, `hurt`, `spawnObject`). Abilities never reach into the render loop directly — they go through `ctx`.

### 3. Crate system
- A mystery crate (`?` glyph, wood look) fades in on a random platform (occasionally the floor) every few seconds. Gently bobs. Cap **2 concurrent**.
- Heads are given a mild attraction toward a nearby crate (a reason to fight over platforms), layered on the existing battle AI.
- A head **descending onto** a crate (feet cross its top, like the platform-landing test) **smashes it**: wood-splinter `fx.burst` + a small `fx.ring` + `fx.label(name)` + `fx.icon` off the head, then rolls a weighted-random ability and runs `onSmash`.

## The readability system (applies to every ability)

- **Visual grammar (shape = meaning):** expanding ring = force/knockback; spiral = vortex; ice crystals = freeze; up-streaks = anti-gravity; jagged bolt = electric; drag-line = magnet pull.
- **Signature color per ability** (see roster) — glanceable ID even in a scrum.
- **Cause → effect:** big hits telegraph (brief wind-up glow/crouch), then land with a **hit-spark at the contact point + 2–3 frame hitstop + victim flash + directional recoil**. The existing `hurtEl` flash + lunge system is the hook.
- **Readable status:** self-buffed head = colored **aura ring + floating icon badge**; affected rival gets a unique overlay — frozen (ice shell), dizzy (stars), magnetized (drag-trail), slipping (spin-out).
- **Pickup name-flash** so viewers learn each ability, then color/aura carries it.
- **Restraint:** `kind:"arena"` abilities earn a full-screen tint/vignette; `self`/`target` stay local. Big screen effects stay rare so they keep meaning.

## Roster (~18, nothing resizes)

Arena (affects everyone): **Gravity Flip** (violet, up-streaks→slam), **Ice Floor** (ice-blue, frictionless slide), **Earthquake** (brown, quake + jitter), **Wind Gust** (teal, sideways gale), **Magnet** (magenta, pull-in), **Black Hole** (indigo, suck→fling).

Target a rival: **Freeze** (ice-blue shell), **Banana** (yellow, slip→dizzy), **Disco Stun** (multi, forced dance), **Homing Missile** (red, chase+knockback).

Self / movement: **Rage** (molten red, heavy hits + knockback-immune aura — replaces Giant), **Speedster** (cyan, fast + bouncy + afterimage — replaces Tiny), **Rocket** (orange, jetpack ram + flame trail), **Feather** (white, low-grav drift), **Super Bounce** (green, rubber boing), **Blink** (violet, teleport behind rival), **Bomb** (orange, fused explosion), **Shockwave Slam** (amber, radial knockback).

Damage/knockback route through the existing HP + lunge system so hits stay consistent with normal fighting.

## Soccer team picker (small, separate — build first as a quick win)

- The **Soccer button gets a roster icon** (two dots, red + blue). Tapping the *icon* (not the button) opens a compact tray.
- Tray shows every head as a chip in a **Red column / Blue column**; **tap a chip to flip its team**; a **⇄ shuffle** randomizes; **live-previews** the ring colors on the heads.
- Hit Soccer to kick off with those exact teams. No dragging. Wires into the existing `S9.teams` assignment.

## Build order
1. Soccer team picker (quick win, isolated).
2. VFX toolkit + crate system + registry scaffold + 3–4 flagship abilities (Bomb, Gravity Flip, Freeze, Rocket) to prove the pipeline end-to-end.
3. Fill out the rest of the roster.
4. Tuning pass (weights, durations, VFX restraint, clarity).

## Testing / verification
- `node --check` every script block after each edit.
- Preview pane: seed heads, start battle, force crate spawns + specific abilities via a temporary test hook (removed before commit), screenshot to advance frames (pane throttles rAF between JS calls).
- Watch for: framerate under many particles, effects bailing on battle end, no regression to the mini-Jayden clone.

## Out of scope (YAGNI for now)
- Player-controlled ability use (heads stay AI).
- Ability combos/synergies.
- Persisting ability unlocks between games.
