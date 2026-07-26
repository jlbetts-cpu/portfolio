# Prompt: optimize the mobile experience of the portfolio (hero + games)

> Paste everything below the line into a fresh Claude session on this repo.

---

## Your task

Make **jaydenbetts.com (`index.html`) feel designed for mobile**, not shrunk into it. Focus on the **hero** and the **three Play games** (Marble Race, Floor is Lava, Soccer): they must *work*, *look*, and *feel* good on a phone. Desktop must come out unchanged — every fix is mobile-scoped or a genuine improvement at both sizes.

Work on branch `claude/portfolio-mobile-optimize-vekesz`. Commit in logical chunks and push when done.

## Read first

- `HANDOFF-README.md` — design system (non-negotiable), working practices, animation + performance lessons. Follow it, especially the visual-verification rule.
- Everything lives in one file: `index.html` (~4,830 lines, dense/minified-ish CSS in `<style>`, all JS in one trailing `<script>`). `index-local-preview.html` is a stale copy — **edit `index.html` only**.

## How to verify (do not skip — screenshots, not assumptions)

```bash
python3 -m http.server 8899        # serve the repo
# Playwright is preinstalled but the bundled path is stale; launch Chromium explicitly:
#   executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
#   args=['--no-sandbox','--force-color-profile=srgb']
```
Test at **390×844** (iPhone 14/15), **360×800** (small Android), **430×932** (Pro Max), and **1440×900** desktop, with `is_mobile=True, has_touch=True, device_scale_factor=2`.

The race exposes a debug handle with `?wraf=1` → `window.__race` (`balls`, `pegs`, `segs`, `spins`, `st()`). Games can be driven headlessly:
```js
document.getElementById('moodBtn').click()          // open Play menu (it closes after each pick)
document.getElementById('addPlaceholder').click()   // add an egghead — repeat 4-6x to get racers
document.getElementById('raceGo').click()           // or battleGo / soccerGo
window.__hmRaceStart(); window.__hmRaceEnd();       // restart to re-roll a random course
```
Measure with `getBoundingClientRect()` / `getComputedStyle()`; screenshot for the eyes. Validate JS after every edit:
`sed -n '/<script>/,/<\/script>/p' index.html | sed '1d;$d' | node --check -`

---

## 1. Header (mobile) — Jayden's explicit ask

Today at 390px the nav reads **`JAYDEN BETTS` (left, stacked on two lines) … `Play ⌄` (~x=177–224, so it lands near the optical centre) … `☰` (right)**. The wordmark jammed into the corner while a secondary control owns the centre is the thing that "looks weird".

Rebuild the mobile nav as three balanced zones:

- **Left: `Play ⌄`** — the play affordance leads.
- **Centre: `JAYDEN BETTS`** — truly centred, and it should not be a cramped two-line stack at this size. Decide between one line at a smaller size or a tighter two-line lockup, then commit to it; the wordmark is the identity anchor, so it must read as deliberate.
- **Right: `☰`** — unchanged.

Relevant code:
- Markup: `index.html:778` (`nav` → `.navL`, `.logo`, `.navR` → `.faceMoodCorner`/`#moodBtn`, `.talkMag`, `#navBurger`).
- Base nav CSS: `index.html:53–56`; wordmark CSS `index.html:54`.
- Mobile overrides live in the long rule block at `index.html:773` — notably `@media(max-width:640px){.navGroup{flex:0 0 auto}.navL{display:none}nav .logo{margin-right:auto}}` and `@media(max-width:640px){body nav .faceMoodCorner{margin-left:auto}}`. The desktop centring trick (equal-basis `.navGroup` flex siblings) is documented in the same block — keep that intact for ≥641px and give mobile its own honest three-zone layout instead of layering more `margin-left:auto` hacks.

Constraints: 44px minimum touch targets (already partly enforced), the Play dropdown must still open right-aligned inside the viewport (it currently renders at `left:4 → right:224`, `height:413px` — fine, don't regress it), and the `about-open` state (`body.about-open` reflows the logo, `index.html:54`) must still look right.

## 2. Scroll-down arrow — remove on mobile

`.scrollCue` (`index.html:781`, CSS at the end of the block at `index.html:773`, JS at `index.html:4823`) currently shows on phones at `bottom:10px`, where it lands **directly under the chin, overlapping the head's floor shadow** (measured at 390px: shadow `y 500–541`, cue `y 505–549`). On a touch device where scrolling is the default gesture it earns nothing and it muddies the floor.

Hide it below the mobile breakpoint (`display:none`, not just `opacity:0`, so it can't take taps), keep it exactly as-is on desktop. Skip the scroll listener work on mobile if it's cheap to do so.

## 3. The floor / the head's ground plane

Two separate problems, both under "the floor looks weird":

**a. The hero floor line.** Every small head's ground plane is derived from the big head's bounding box: `survey()` at `index.html:3224–3245` sets `floorY = fY - HH*FOOT` where `fY = Math.min(bigR.b, heroR.h-2)`, cached in `sharedFeetY`. On mobile the stage is `86vw` with `aspect-ratio:1/.97` and the hero collapses to `min-height:auto`, so the floor ends up a few px above the hero's bottom edge with the drop shadow, the scroll cue, and the hero boundary all stacked in the same ~50px band. Give the mobile hero a deliberate floor: clear space under the chin, shadow reading as one grounded thing, nothing else competing in that band.

**b. The game floor.** In Floor is Lava the lava plane is clipped by the hero box and terminates in a **hard horizontal edge mid-screen** (at 390×844 the cut lands at y≈557), with blank page and then the "Featured" tabs below it. It reads as a rendering bug. This is a symptom of §4 — fix the arena height and this largely resolves; verify it does.

## 4. Games: the arena is the hero box, not the screen (root cause — fix this first)

All three games take their arena height from `hero.clientHeight`:
- race: `heroH()` at `index.html:4313`
- platforms/lava ladder: `hh()` at `index.html:4568`
- soccer: `index.html:4075` onward

They correctly take *width* from `innerWidth` (`heroW()` / `hw()` — "the whole viewport, wall to wall"), but height never got the same treatment, because on desktop `.hero{min-height:calc(100vh - 80px)}` made the two nearly identical. On mobile `.hero` is overridden to `min-height:auto` (`index.html:186` and again in the block at `index.html:773`), so:

**Measured at 390×844: `hero.clientHeight` = 491px, viewport = 844px.** Every game plays in the top 58% of the screen while the bottom 42% shows unrelated page content ("Featured / Case Studies / Extras" and a case-study card). Downstream consequences, all verified:

- The race camera window is 491px tall, so the course feels claustrophobic and each drop is over before it reads.
- The lava plane and peg field clip off at the hero's bottom edge with a hard line (§3b).
- In Floor is Lava, **heads and platforms render over the header** — a head sat on top of the hamburger, rungs slid under `JAYDEN BETTS`, and the `6 left / End` HUD sits dead-centre over the action.
- The race's `last one out…` / countdown / `Winner!` big text renders in the middle of the same 491px box, **colliding with the heads**.

Give the games a full-viewport arena on mobile (`100dvh`, with the safe-area insets accounted for) — either by making the hero a real full-height stage while a game is on, or by decoupling the arena from the hero box. Then re-check every game's HUD, big-text, camera framing, and z-order against the nav.

## 5. Games: scroll during play

`body` is never scroll-locked while a game runs (`overflow: clip visible`, `document.scrollHeight` 1638px). One flick mid-race scrolls the game completely off screen — it keeps running, invisible, with no way back except scrolling up and no indication anything is happening. On mobile a running game should own the screen: lock the page scroll for the duration and restore the exact scroll position (and focus) when the game ends via `#endGame`, a win, or a wrap-up.

## 6. Marble Race: heads that don't fit — Jayden's specific bug

**Confirmed, with numbers.** `bumps()` (`index.html:4346`) sizes bumper pegs off the *median* head diameter but spaces them off raw course width:

```js
function bumps(){var br=D*0.55,nB=mob?3:4,sp=(CW-nB*br*2)/(nB+1),by=y+H*0.28;
 for(var b2=0;b2<nB;b2++)pegs.push({x:X0+sp*(b2+1)+br*(2*b2+1),y:by+rnd(-14,14),r:br});
```

At 390px with 5 eggheads: head diameter **58.9px**, bumper radius 32.4px, and the **widest gap through the row is 46.9px** — including the wall gaps. No head can pass a bumper row anywhere along it. In an 8-course sample this row appeared in 2 courses; when it does, the pack piles on top and only escapes via the anti-stuck kick at `index.html:4441` (three failed nudges → a hard 520–680px/s sideways kick), which is exactly the "heads don't fit / heads get stuck and then teleport" feel.

Every other obstacle already derives its clearance from `DM` (the biggest racer) and checks out — `pegField` clears by ~28% (`index.html:4322`), funnel throats are `DM*throatF+11` against a required `DM+9` (`index.html:4328`), gates use `DM*1.5` (`index.html:4341`). `bumps()` is the outlier. Fix it the same way: **guarantee at least one gap ≥ `DM + 9` (the two walls' `a.r+4.5` collision padding), sized from `DM`, not `D`**, and reduce `nB` or `br` on narrow viewports rather than letting the row seal shut.

Then **prove it**: generate ≥20 random courses at 360/390/430px, and for every peg row and every ramp drop-gap assert the widest passage ≥ `DM + 9`. Add that as a throwaway audit script (don't ship it in `index.html`). Two near-misses to watch while you're there:

- `zigzag()` (`index.html:4335`) leaves a drop gap of `CW*0.28` — 107px at 390px, but **only 87px at 320px**, which is impassable for a 1.5× head. Race fields are currently uniform (the 1.5× mini-Jayden only spawns in soccer/lava, `index.html:4802`), so this isn't biting today — make it `DM`-derived anyway so it can't regress.
- `spinner()` paddles are `D*1.7` in radius and can leave a tight wall gap depending on the rolled `cx` (`index.html:4338`).

## 7. Games: mobile feel pass

With §4 and §5 fixed, play each game on a phone viewport and make the moment-to-moment feel right:

- **Marble Race:** the standings board is `display:none` below 640px (`index.html:4279`, "the race itself is the interface"). With no board and no positions, a mobile viewer can't tell who's who or who's winning. Either bring back a compact mobile-appropriate standing (a slim top strip, leader + your-head only) or make position legible in the course itself — your call, but the race must be *followable* on a phone. Also check: countdown/`GO`/`Winner!` placement, camera lead distance (`leadY - H*0.42`, `index.html:4498`) now that `H` is a full screen, and the finish-pen framing.
- **Floor is Lava:** HUD (`.battleCount`, `index.html:4519`) out of the play field; platform ladder spacing (`GAPMIN 88 / GAPMAX 126`, `index.html:4572`) still fair at the new arena height; nothing overlapping the nav.
- **Soccer:** pitch, goals, and scoreboard all inside the arena at 360px; the team-picker tray (`.teamTray`, mobile rules at `index.html:2813`) reachable and tappable; `#soccerTeams` is currently a 39×40 target — bump it to ≥44px.
- **All three:** `#endGame` must be obvious and reachable on a phone (today it's buried in the Play dropdown), the exit must restore the page cleanly (heads return to their own physics — see `finish()`, `index.html:4396`), and every game must survive an orientation change / resize mid-play without stranding heads off-map.

## 8. Hero polish (mobile)

- The `h1` runs to **four lines** at 390px and the trailing emoji in the cycling word collides with the last glyph (`with delight🪩`). Tighten the measure/size so it lands in two or three lines and the emoji has room.
- The head is `86vw` (335px of a 390px screen) and the hero is 491px tall against an 844px viewport, leaving a large dead band between the chin and the "Featured" tabs. Rebalance the mobile hero's vertical rhythm: headline, head, and the first hint of the work below should compose as one screen.
- Between case-study cards there are ~200px empty gaps on mobile (`.reelStage{padding:8vh 0}` at `index.html:233`) — tighten if it reads as broken rhythm, but this is lower priority than the hero and games.

## Rules

- **Don't regress desktop.** Screenshot 1440×900 before/after for the hero, the nav, and all three games.
- Honour the design system in `HANDOFF-README.md` — type scale, colour tokens, the `4px` radius, the ink filters, `cubic-bezier(.2,.8,.2,1)` easing. No new visual language.
- Respect `prefers-reduced-motion` in anything you animate (the file is consistent about this — match it).
- Zero horizontal overflow at every width tested (`document.documentElement.scrollWidth === innerWidth`).
- Breakpoints in this file are inconsistent — CSS uses 520/640/760/768/880, the race treats `mob` as `≤640`, the head physics as `≤880`, the platforms as `≤768`. Don't add a sixth. Where a change spans CSS and JS, pick the existing breakpoint that matches the CSS you're editing and note the choice in a comment.
- Comment in the file's established voice: short, explaining *why* the number is that number.
- Validate the JS with `node --check` after every edit, and re-run the geometry audit before you call the race fixed.
- Report what you changed, what you measured, and anything you deliberately left alone.
