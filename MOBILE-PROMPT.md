# Prompt: optimize the mobile experience of the portfolio (hero + games + performance)

> Paste everything below the line into a fresh Claude session on this repo.
> Every number in here was measured on the real page with Playwright — not estimated.

---

## Your task

Make **jaydenbetts.com (`index.html`) feel designed for mobile**, not shrunk into it. Three fronts: the **hero**, the **three Play games** (Marble Race, Floor is Lava, Soccer), and **performance once several heads are on stage** — today the page audibly stutters with a full pit. Desktop must come out unchanged: every fix is mobile-scoped or a genuine improvement at both sizes.

Work on branch `claude/portfolio-mobile-optimize-vekesz`. Commit in logical chunks and push when done.

## Read first

- `HANDOFF-README.md` — design system (non-negotiable), working practices, animation + performance lessons. Follow it, especially the visual-verification rule.
- Everything lives in one file: `index.html` (~4,830 lines, dense/minified-ish CSS in `<style>`, all JS in one trailing `<script>`). `index-local-preview.html` is a stale copy — **edit `index.html` only**. `headmaker.html` is the separate "add your head" flow (§9).

## How to verify (do not skip — screenshots and metrics, not assumptions)

```bash
python3 -m http.server 8899
# Playwright is installed but its bundled browser path is stale. Launch Chromium explicitly:
#   executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
#   args=['--no-sandbox','--force-color-profile=srgb']
```
Test at **390×844** (iPhone 14/15), **360×800** (small Android), **430×932**, and **1440×900** desktop, with `is_mobile=True, has_touch=True, device_scale_factor=2`.

**Driving the games headlessly:**
```js
document.getElementById('moodBtn').click()          // open Play menu (it closes after each pick)
document.getElementById('addPlaceholder').click()   // add an egghead — menu must be reopened between adds
document.getElementById('raceGo').click()           // or battleGo / soccerGo
window.__hmRaceStart(); window.__hmRaceEnd();       // restart to re-roll a random course
```
- The race exposes a debug handle with `?wraf=1` → `window.__race` (`balls`, `pegs`, `segs`, `spins`, `st()`).
- `window.__hmLive` is the live head list. `document.body.className` tells you which game is actually running — **check it**: clicking `soccerGo` while a battle is still winding down silently keeps you in `hmBattle`.

**Seeding a full pit fast** (much faster than clicking, and it bypasses the 8-head UI cap so you can see the scaling curve): write N entries into `localStorage.hmCompanions` and reload. **They must have visually distinct `cut` data URLs** — `readAll()` de-dupes by `cut` *and* by an eyes/marks key, so N copies of the same egg collapse to one head and nothing spawns. Tint each one through a canvas (`multiply` fill + `destination-in`) exactly like the real button does at `index.html:2774`.

**Measuring performance:** CDP `Emulation.setCPUThrottlingRate` (4× ≈ a good phone, 6× ≈ a mid-range one), `Performance.getMetrics` for `LayoutCount` / `RecalcStyleCount` / `ScriptDuration`, a `PerformanceObserver({entryTypes:['longtask']})` for blocking, and a rAF delta sampler for fps / p95 / janky-frame counts. **Do not instrument `CSSStyleDeclaration.prototype.transform` to count style writes** — the getter forces serialization and dominates the measurement (it took a 58fps page to 40fps and invalidated the result).

Validate JS after every edit: `sed -n '/<script>/,/<\/script>/p' index.html | sed '1d;$d' | node --check -`

---

# P0 — Performance: the lag with a full pit

## Measured baseline (390×844, 8 eggheads, idle page, no game running)

| heads | fps @4× | janky frames (>32ms) | fps @6× | janky @6× | DOM nodes | rAF loops/frame | `hmCompanions` size |
|---|---|---|---|---|---|---|---|
| 0 | 60.3 | 0 / 241 | — | — | 498 | 0 | 0 KB |
| 2 | 60.2 | 0 / 241 | — | — | 624 | 2 | 117 KB |
| 4 | 60.0 | 1 / 240 | — | — | 708 | 4 | 181 KB |
| 6 | 53.5 | 9 (worst frame 200ms) | — | — | 796 | 6 | 268 KB |
| 8 | 48.6 | 26 / 146 | 41.9 | 68 / 169 | 880 | 8 | 338 KB |

**Long tasks, 10s idle at 6× throttle: zero with no heads → 8 long tasks with 8 heads, median 63ms, worst 94ms, 512ms blocked (5.1% of wall clock).** A 63ms task is four dropped frames in a row — that's the stutter Jayden is feeling. Boot regresses too: `domContentLoaded` **280ms → 1398ms**, heads first visible at 1.6s.

Fix these in order; the first one is the cheapest and the biggest.

## 1. `battleGate()` re-parses the entire head blob 15×/second, forever

`index.html:2730–2740`. `battleGate()` runs on `setInterval(battleGate, 400)` and calls `readAll()` **six times per tick**:

- once via `gameCount()` (line 2730)
- three times inside the `["battleGo","soccerGo","raceGo"]` loop — `readAll().length<1` is evaluated per button (line 2735)
- twice inside the `["soccerTeams","lavaTeams"]` loop (line 2736)

Every `readAll()` (line 2704) does a full `localStorage.getItem('hmCompanions')` + `JSON.parse` of the **whole 300KB blob**, then a per-head `JSON.stringify` de-dupe pass, and will `setItem` the whole blob back synchronously if it heals a duplicate.

Instrumented totals with 8 heads: **207 reads / 60.7 MB parsed in the first 16 seconds; 12.5 reads per second while completely idle**, and it keeps going with the Play menu closed and no game running. Cost per `readAll()`: 0.4ms unthrottled, 1.5ms at 4×, **2.6ms at 6×** — so one tick does ~15.6ms of synchronous work at 6×, blowing an entire 16.7ms frame budget, 2.5 times a second.

**Fix:** parse once into a module-level cache and invalidate it on write; hoist the `readAll()` call out of both `forEach` loops (compute `count` once per tick); and skip the DOM writes entirely when nothing changed since the last tick. Roughly ten lines. Re-measure the long-task count afterwards — the target is zero long tasks idle with a full pit.

While you're in there: `CAREER.key()` (`index.html:4303`) does the same full parse **per head** and gets called from `CAREER.titles()` per board row (8 more full parses at race start). Same cache fixes it.

## 2. The face rig's masked layers dominate paint on a slow CPU

Each head is ~42 DOM nodes, of which **~10 are mask layers** — measured across 8 heads: 16 elements masked with the head's own 24KB data URL (`hurtEl` at `index.html:3116`, `ringEl` at `3119`) and **65 masked with `radial-gradient`** (the eye / brow / mouth `strip()` rig, `index.html:3134`). Each head then writes ~12–15 style properties per frame from **its own independent rAF loop** (`_frame` at `index.html:3480`, registered per head at `4070` — 9 rAF callbacks per frame with 8 heads), and every transform write on a masked element re-rasters that layer.

Isolation test at 6× throttle, 8 heads:

| variant | fps | janky frames |
|---|---|---|
| baseline | 41.9 | 68 / 169 |
| **gradient-mask layers hidden (65 elements)** | **54.7** | **21 / 219** |
| data-URL mask layers hidden (16 elements) | no change | no change |
| heads `visibility:hidden`, loops still running | no change | no change |
| `will-change` stripped | slightly worse | worse |

So: the cost is **rastering the gradient-masked face rig**, not the JS, not compositing the head bitmap, and not the hurt/ring masks. (At 4× throttle the difference is inside the noise — this only bites on slower CPUs, which is exactly where it matters.)

Options, cheapest first: give the soft-edged eye/brow/mouth pieces a non-mask treatment (a `radial-gradient` *background* plus `border-radius`, or one pre-baked alpha sprite per head instead of ~8 live mask layers); only write a transform when its value actually changed; and drop the per-frame writes for pieces that are idle (the non-blinking lid, the resting brow and mouth are re-assigned the same value every frame). Don't guess which one wins — measure each at 6× against the table above.

Related, lower payoff: the gaze code loops over every peer for every head, every frame (`index.html:4040`) — O(N²). At 8 heads that's 64 iterations/frame; worth tidying while you're there, not worth a rewrite.

## 3. Boot cost

Eight heads = 338KB of base64 in localStorage, each decoded into an `<img>` and then referenced **two more times per head** as CSS mask URLs. `domContentLoaded` goes 280ms → 1398ms at 4×. Consider decoding each cutout once into an `ImageBitmap`/blob URL and reusing that reference for the img + masks, and staggering head spawn so boot isn't one long task.

## 4. The 8-head cap is real, and silent

`readAll()` ends in `.slice(0,8)` (`index.html:2709`) and the egghead button bails at `readAll().length>=8` (`index.html:2789`) — **with no feedback at all**. Tapping "Add an egghead" a ninth time does nothing: no toast, no disabled state, no shake. Either surface the cap (disable the row and say why) or raise it once the perf work above makes that safe. Note this cap is also why the race never sees mixed head sizes in practice (§7).

---

# P1 — The games

## 5. The arena is the hero box, not the screen (root cause — fix before any other game work)

All three games take their height from `hero.clientHeight`: race `heroH()` (`index.html:4313`), lava ladder `hh()` (`4568`), soccer `geo()` (`4083`). They correctly take *width* from `innerWidth`, but height never got the same treatment, because on desktop `.hero{min-height:calc(100vh - 80px)}` made the two nearly identical. On mobile `.hero` is overridden to `min-height:auto` (`index.html:186`, and again in the block at `773`), so:

**Measured at 390×844: `hero.clientHeight` = 491px against an 844px viewport.** Every game plays in the top 58% of the screen while the bottom 42% shows the "Featured / Case Studies / Extras" tabs and a case-study card. Verified consequences:

- The race camera window is 491px tall, so the course feels claustrophobic and each drop is over before it reads.
- The lava plane and the peg field **clip off at the hero's bottom edge in a hard horizontal line** (y≈557) with blank page below it — it reads as a rendering bug.
- In Floor is Lava, heads, platforms **and the head health bars render over the nav** — a head sat on the hamburger, rungs slid under `JAYDEN BETTS`, a health bar overlapped `Play`.
- A head was observed **below the lava plane, outside the hero box entirely**, floating in the blank band above "Featured".
- The race's countdown / `last one out…` / `Winner!` big text renders mid-hero and **collides with the heads**.

Give the games a full-viewport arena on mobile (`100dvh`, safe-area insets accounted for) — either by making the hero a real full-height stage while a game is on, or by decoupling the arena from the hero box. Then re-check every HUD, big-text position, camera framing, and z-order against the nav.

## 6. Page scroll isn't locked during play

`body` stays scrollable (`overflow: clip visible`, `scrollHeight` 1638px). **Verified: one 500px wheel/flick mid-race scrolls the game completely off screen** — it keeps running, invisible, with no way back but scrolling up. On mobile a running game should own the screen: lock scroll for the duration, restore the exact scroll position and focus when it ends via `#endGame`, a win, or the wrap-up.

## 7. Marble Race: the bumper row no head can pass — Jayden's specific bug

**Confirmed with numbers.** `bumps()` (`index.html:4346`) sizes bumper pegs off the *median* head diameter but spaces them off raw course width:

```js
function bumps(){var br=D*0.55,nB=mob?3:4,sp=(CW-nB*br*2)/(nB+1),by=y+H*0.28;
 for(var b2=0;b2<nB;b2++)pegs.push({x:X0+sp*(b2+1)+br*(2*b2+1),y:by+rnd(-14,14),r:br});
```

At 390px with a full pit: head diameter **58.9px**, bumper radius 32.4px, and the **widest gap anywhere in the row — including both wall gaps — is 46.9px**. No head can pass it at any point along its width. It appeared in **2 of 8** randomly generated courses. The pack piles on top and only escapes via the anti-stuck kick at `index.html:4441` (three failed nudges → a hard 520–680px/s sideways kick), which is exactly the "heads don't fit, then they teleport" feel.

Every other obstacle already derives clearance from `DM` (the biggest racer) and checks out: `pegField` clears by ~28% (`4322`), funnel throats are `DM*throatF+11` against a required `DM+9` (`4328`), gates use `DM*1.5` (`4341`). `bumps()` is the outlier. Fix it the same way: **guarantee at least one gap ≥ `DM + 9`** (the two walls' `a.r+4.5` collision padding), sized from `DM` not `D`, and reduce `nB` or `br` on narrow viewports rather than letting the row seal shut.

Then **prove it**: generate ≥20 random courses at 360/390/430px and assert that every peg row and every ramp drop-gap has a passage ≥ `DM + 9`. Keep that as a throwaway audit script — don't ship it in `index.html`. Two near-misses worth making `DM`-derived while you're there:

- `zigzag()` (`index.html:4335`) leaves a drop gap of `CW*0.28` — 107px at 390px but **87px at 320px**, impassable for a 1.5× head. Not biting today only because race fields are uniform (the 1.5× mini-Jayden spawns only in soccer/lava, `index.html:4802`, and the pit caps at 8 same-size heads) — make it robust anyway.
- `spinner()` paddles are `D*1.7` in radius and can leave a tight wall gap depending on the rolled `cx` (`index.html:4338`).

## 8. Per-game mobile feel

With §5 and §6 fixed, play each one at 390px and 360px and make the moment-to-moment right:

**Marble Race** — the standings board is `display:none` below 640px (`index.html:4279`, "the race itself is the interface"). With no board and no positions, a phone viewer can't tell who's who or who's winning. Either bring back a compact mobile standing (slim top strip, leader + your head) or make position legible in the course itself — your call, but the race must be *followable*. Also re-check countdown/`GO`/`Winner!` placement, the camera lead (`leadY - H*0.42`, `index.html:4498`) now that `H` is a full screen, and the finish-pen framing.

**Floor is Lava** — HUD (`.battleCount`, `index.html:4519`) sits dead-centre over the action; move it clear. Health bars must not overlap the nav. Ladder spacing (`GAPMIN 88 / GAPMAX 126`, `index.html:4572`) should stay fair at the new arena height. No head may end up outside the arena.

**Soccer** — the goals are 42px wide, placed at exactly `XL` and `XR-42` (`index.html:4104–4105`), i.e. **flush against both screen edges with zero inset**, which reads as cut off on a phone. Worse, the head walls let a head hang off the edge — `WL = -HW*0.35`, `WR = innerWidth - HW*0.65` (`index.html:3236`) — so **~22px of a 64px head is off-screen**, measured at `left:-25`, and 21 elements sit partly outside the viewport during a match. On a 1440px desktop that overhang is a charming detail; in a 390px goalmouth it eats the goalkeeper. Inset the goals, and clamp the walls during a match. There's also no visible ground line, so players read as floating (`groundY` comes from the stage bottom, `index.html:4084`). Finally `#soccerTeams` is a **39×40** target — bump to ≥44px — and check the team tray (`.teamTray`, mobile rules at `index.html:2813`) is reachable.

**All three** — `#endGame` is buried in the Play dropdown; make the exit obvious and reachable on a phone. Exit must restore the page cleanly (see `finish()`, `index.html:4396`). Each game must survive an orientation change / resize mid-play without stranding heads off-map.

---

# P2 — Hero, header, and the rest

## 9. Header (mobile) — Jayden's explicit ask

At 390px the nav reads **`JAYDEN BETTS` (left, stacked on two lines) … `Play ⌄` (x=177–224, landing near the optical centre) … `☰` (right)**. The wordmark in the corner while a secondary control owns the centre is the thing that looks wrong.

Rebuild the mobile nav as three balanced zones: **`Play ⌄` left · `JAYDEN BETTS` truly centred · `☰` right.** The wordmark should not be a cramped two-line stack at this size — pick one line at a smaller size or a tighter two-line lockup and commit to it.

- Markup `index.html:778`; base nav CSS `53–56`; wordmark CSS `54`.
- Mobile overrides sit in the long block at `773` — `@media(max-width:640px){.navGroup{flex:0 0 auto}.navL{display:none}nav .logo{margin-right:auto}}` and `@media(max-width:640px){body nav .faceMoodCorner{margin-left:auto}}`. Keep the desktop equal-basis centring trick intact for ≥641px; give mobile its own honest three-zone layout rather than another `margin-left:auto` hack.

**Also fix the about-open header, which is visibly broken on mobile:** with `body.about-open`, `.navGroup{display:contents}` and the `heroBack` + `navTitle` + burger combination **wrap onto two rows — the hamburger drops below the Back button**, orphaned and misaligned (`index.html:54`, and the `about-open` rules in the `773` block). Verify the fix in both states.

## 10. Scroll-down arrow — remove on mobile

`.scrollCue` (`index.html:781`, CSS at the end of the block at `773`, JS at `4823`) shows on phones at `bottom:10px`, landing **directly on the head's floor shadow** — measured at 390px: shadow `y 500–541`, cue `y 505–549`. On a touch device it earns nothing and it muddies the floor. Hide it below the mobile breakpoint with `display:none` (not `opacity:0`, so it can't take taps); keep desktop exactly as-is.

## 11. The hero floor plane

Every small head's ground plane comes from the big head's bounding box: `survey()` (`index.html:3224–3245`) sets `floorY = fY - HH*FOOT` with `fY = Math.min(bigR.b, heroR.h-2)`, cached as `sharedFeetY`. On mobile the stage is `86vw` with `aspect-ratio:1/.97` and the hero collapses to `min-height:auto`, so the floor, the drop shadow, the scroll cue and the hero's bottom edge all stack inside the same ~50px band. Give the mobile hero a deliberate floor: clear space under the chin, the shadow reading as one grounded thing, nothing else competing in that band.

## 12. Hero composition (mobile)

- The `h1` runs to **four lines** at 390px and the trailing emoji in the cycling word collides with the last glyph (`with delight🪩`). Tighten measure/size to two or three lines and give the emoji room.
- The head is `86vw` (335px of 390px) and the hero is 491px of an 844px viewport, leaving a large dead band between the chin and the "Featured" tabs. Rebalance the vertical rhythm so headline + head + a hint of the work below compose as one screen.
- ~200px empty gaps between case-study cards on mobile (`.reelStage{padding:8vh 0}`, `index.html:233`) — tighten if it reads as broken rhythm. Lower priority.

## 13. `headmaker.html` on mobile (the "add your head" flow)

Verified at 390px:
- The header's `Let's talk` button **wraps onto two lines** and crowds the right edge, with the page title squeezed between it and Back.
- The dropzone is a **~800px-tall empty box**, and its copy — "Drop a photo (or a saved head file) here, or" — is desktop language that **overflows its own dashed border** on both sides. There is no drag-and-drop on a phone: lead with the button, shrink the box, and rewrite the line for touch.
- Consider `capture` on the file input so "Choose a photo" can go straight to the camera.
- `.back` is **87×33** and the three `.footIn` links are **22px tall** — under the 44px minimum.

## 14. Tap targets under 44px (whole site)

`#soccerTeams` 39×40 · `.reelClose` 68×32 · `.abIn` inline about-links ~20px tall · headmaker `.back` 87×33 and `.footIn` ~22px. Fix with padding, not by growing the visual box.

## What I verified is already fine — don't spend time here

- **Zero horizontal overflow** at 360px and 390px on `index.html`, `headmaker.html` and `bearings.html` (`scrollWidth === innerWidth`; the only off-viewport elements are the intentionally off-screen nav drawer).
- **Case study pages are in good shape on mobile** — `bearings.html` at 390px had no overflow and no undersized tap targets.
- The Play dropdown fits and scrolls correctly on mobile (`left:4 → right:224`, height 413px, `max-height:min(370px,68vh)` with touch scrolling). Don't regress it.
- The mobile nav drawer itself (slide-in, scrim, aria, Esc, focus return) is solid.
- With **0 heads the page is perfectly smooth** — 60fps, zero long tasks even at 6× throttle. All the performance work above is about the cost *per head*, not a general page problem.

## Rules

- **Don't regress desktop.** Screenshot 1440×900 before/after for the hero, the nav (both normal and about-open), and all three games.
- Honour the design system in `HANDOFF-README.md` — type scale, colour tokens, the 4px radius, the ink filters, `cubic-bezier(.2,.8,.2,1)` easing. No new visual language.
- Respect `prefers-reduced-motion` in anything you animate; the file is consistent about this.
- Zero horizontal overflow at every width tested.
- Breakpoints here are already inconsistent — CSS uses 520/640/760/768/880, the race treats `mob` as `≤640`, head physics as `≤880`, the lava platforms as `≤768`. Don't add a sixth. Pick the existing breakpoint that matches the CSS you're editing and say why in a comment.
- Comment in the file's established voice: short, explaining *why* the number is that number.
- `node --check` after every edit. Re-run the race geometry audit before calling §7 fixed, and re-run the long-task measurement before calling P0 fixed — **the acceptance test for the lag work is zero long tasks on an idle page with a full pit at 6× CPU throttle, and ≥55fps during a race.**
- Report what you changed, what you measured (before/after numbers), and anything you deliberately left alone.
