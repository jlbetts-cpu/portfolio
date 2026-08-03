# The Play page — extraction design

2026-08-02. Build-order item 1 of the next-chapter brief (§3.2). This spec
settles the extraction boundary; the implementation plan follows separately.

Prerequisite reading: `2026-08-02-next-chapter-brief.md` §3.2 and §2.

---

## 1. Goal

Move everything playable — soccer, tournament, Floor is Lava, marble race and
the companion heads engine — out of `index.html` onto a dedicated `play.html`.
The home page keeps the portfolio and the visitor's own heads; the games get a
full viewport and a real URL.

This is the single biggest performance lever available (brief §2), and it is a
prerequisite for the Globe Lobby (§3.9), which has nowhere to live inside a
hero.

---

## 2. Measured baseline

`index.html` is **830,783 bytes** across 8,583 lines. Play-owned regions:

| Region | Lines | Bytes |
|---|---|---|
| Companion engine IIFE | 4725–7465 | 287,503 |
| Game + tournament CSS (4 blocks: 321–413, 974–1027, 1062–1283, 1457–2313) | — | 93,107 |
| Tournament UI | 7702–8583 | 50,516 |
| Play-menu controller | 4464–4714 | 25,085 |
| Tournament bracket core | 7487–7701 | 9,789 |
| **Total play-owned inside `index.html`** | | **466,000 bytes — 56% of the file** |

`egghead-seed.js` (24,653 bytes) is already an external file and is not counted
above; it simply changes which page loads it.

**Target: `index.html` 830,783 → ~364,783 bytes (811 KiB → ~356 KiB).**

---

## 3. Decisions settled with Jayden

**3.1 Shared engine in external files, not duplicated and not split in place.**
Considered and rejected: (a) a head-free home page — cheapest cut, but the hero
loses the roommate, which is the most-loved thing on the site; (b) splitting the
ambient head from the game player inside `index.html` — the two are the same
object driven by one 640-line `_frame()`, so this is the hardest refactor in the
file. Chosen: plain `<script src>` files both pages load, no build step
(precedent already exists — `egghead-seed.js`).

**3.2 The home Play menu splits by ownership, not by widget.** Home keeps
everything about the home page or about the visitor's heads: the four mood dots,
the `#moodHeads` roster grid, "Add your head", "Add an egghead", "Show on home".
The four game rows, `#endGame` and the team tray leave and are replaced by a
single "Play" row linking to `play.html`, which carries its own copy of the game
menu.

This respects the standing rule that the coloured dots and the current-players
grid are load-bearing and must not be collapsed or reordered — neither is
touched. Accepted cost: Soccer is two clicks from home rather than one.

**3.3 No big head on `play.html`.** The arena is full-viewport and permanently
`hmFull`. Accepted cost: head size loses its proportional relationship to the
big head and must be re-derived from the arena box (§5.2), and the resulting
scale is something we invent rather than inherit — it needs tuning against a
real match before the task is called done.

---

## 4. Architecture

### 4.1 Files

| File | Contents |
|---|---|
| `play.html` | The arena. Full viewport, permanently `hmFull`, persistent top-left back affordance, its own game menu + team tray. |
| `play-engine.js` | The companion IIFE (4725–7465) **verbatim**: heads, face rig, ambient wander, FX canvas, soccer, lava, race, podium, goal grammar, split-flap. |
| `play-games.js` | Game launchers + team tray, split out of the play-menu controller (4464–4714). |
| `play-tournament.js` | Bracket core (7487–7701) + tournament UI (7702–8583). |
| `play.css` | The four game CSS blocks, plus the four live shared control rules (§5.5). |
| `party.js` | `buildPartyDOM` + `__hmPartyAt` only. |

**No `heads.css`.** Every element in `spawnCompanion` is inline-styled via
`cssText` (`index.html:4941`), so the ambient head needs no stylesheet.

### 4.2 Why the engine moves whole

The companion IIFE is a single closure: soccer, lava and the race all reach into
the same `peers`, `heroBox` and `FX` variables the ambient head uses. It cannot
be split by cutting lines — that needs the shared state promoted to a namespace
first. Moving it intact keeps the move mechanical, which is what makes a 287 KB
relocation verifiable in one pass.

### 4.3 Loading

- `play.html` loads everything.
- `index.html` loads `party.js` always — home's "delight" mood needs
  `buildPartyDOM`, and soccer's championship spotlight consumes `__hmPartyAt`
  (`index.html:6502`). The consumer is guarded, so without this file the
  winner's disco would vanish silently rather than error.
- `index.html` loads `play-engine.js` **only** when the visitor has saved heads
  *and* "Show on home" is on. The decision is made by a small inline bootstrap
  in `index.html` that reads `localStorage.hmCompanions` and
  `localStorage.hmHeadsOff` and injects the `<script>` tag; it must not depend
  on the engine it is deciding whether to load.

### 4.4 What "Show on home" becomes

Today the toggle only parks the heads: `hmHeadsOff` sets `hideB` inside
`_frame` (`index.html:5392`) while every loop keeps running. Under this design
it decides whether `play-engine.js` is fetched at all — a cosmetic switch
becomes the actual performance control. Consequence: turning it off takes effect
on the next load (or the engine re-spawns on toggle-on); this is a deliberate
trade, not an oversight.

### 4.5 Performance accounting, stated honestly

- No saved heads, or heads off → home loads **zero** play JS, zero canvases,
  zero rAF loops.
- Heads on → home loads 287 KB and runs one `_frame()` per head. **Zero game
  rAF loops and zero game canvases** (they gate on `body.hmSoccer` /
  `body.hmBattle`, which can no longer happen on home), but ~130 KB of game code
  rides along unused inside the closure.

The brief's requirement — zero game rAF loops and zero game canvases on the home
page — is met in every case. "Zero rAF loops of any kind" holds only when heads
are absent or off.

---

## 5. The seams — what is edited, not moved

Everything else is cut-and-paste. These six are not.

**5.1 `.hero` → the arena.** Sixteen call sites measure `.hero`'s rect
(4742, 4755, 4821, 4933, 6023, 6748, 6755, 6860, 7133, 7174, 7259, 7319, 7403,
8085, 8145, 8373). `play.html`'s arena element carries `class="hero"` so all
sixteen keep working untouched. Semantically a lie, to be commented as such; a
later pass may add `.hmArena` as an alias. Zero engine edits now.

**5.2 Head sizing.** `HW` derives from `#stage`'s width and falls back to a flat
`mob?64:96` when it is absent (`index.html:4937`). Replace the fallback with a
value derived from the arena box.

**5.3 `body.hmFull` becomes permanent** on `play.html` at every viewport, not
just ≤760px. This is what makes `survey()` use `FLOORCAP` rather than the
absent big head's chin (`index.html:5081`). The mobile takeover module
(7466–7486) collapses to a single class on `<body>`.

**5.4 The play-menu controller splits.** 4464–4714 does two jobs: the saved-heads
roster (stays home) and the game launchers + team tray (move). This is the only
region divided rather than relocated.

**5.5 The controls CSS block (1284–1456) cannot be cut by line** — game and
portfolio class names share selector lines (e.g. `index.html:1323`). Smaller
than it appears: `.hmGo`, `.hmPitX` and `.hmPitPick` are dead (no markup, no
JS). Only `.tGo`, `.hmBtn`, `.hmScoreEnd` and `.sbBtn` are live; duplicate those
four into `play.css` and delete the dead selectors from home.

**5.6 Mini-Jayden needs a hidden `#face` on `play.html`.** `fillerData()` bails
immediately without one (`index.html:7437`), so with no big head there is no
filler at all: odd rosters cannot be evened, a 1-head game is unplayable, and
the tournament loses him as a captain (the function was split out expressly so
the tournament could field him). Fix: a hidden `<img id="face">` on `play.html`
so `bakeMiniCut` has a source. He then renders from the baked cut through the
companion's own eye/brow/mouth rig rather than live-mirroring `#stage` — the
`eyes`/`marks` already in `fillerData` exist for exactly this fallback. If the
result reads wrong on screen, drop him from `play.html` and accept uneven sides.

**5.7 Everything else degrades on its own.** The engine makes ~40 unqualified
calls into the portfolio's big-head API (`showFace`, `setHold`, `browFlash`,
`busyNow`, `drowsy`, `introMode`, `eventLock`). Every one is guarded by
`typeof X === "function"` / `!== "undefined"` inside a try/catch, so they no-op
on `play.html`. No shim is needed. What is lost there is the companion's
courtesies *toward the big head* — yawn contagion, the brow flash when it
notices a somersault — which are home behaviours by nature.

Verified false positives, requiring no action: `FACES`, `buildEyes`, `setFace`
and `gaze` appear in the engine only inside comments or as unrelated local
names; `reduce` is redeclared locally at `index.html:4928`.

**5.8 Dead-on-home cleanup.** The `.stagewrap` opacity and hero-copy fade on
`body.hmSoccer` (403–405, 410–413); the `openAbout` mid-game teardown
(`index.html:3473` — already guarded, so harmless but unreachable); and
`#scrollCue`, portfolio code stranded at the tail of the game script
(7458–7464), which simply comes home.

---

## 6. Correction: the dev flag is `?wraf=1`, not `?stand=1`

Both the brief (§3.2) and Prompt 1 instruct the next session to carry `?stand=1`
across. **`?stand=1` does not exist** — zero hits in the repo. The real flags
are:

- **`?wraf=1`** — drives `requestAnimationFrame` from a Web Worker timer so the
  engine keeps ticking in a backgrounded tab (`index.html:2469`), and exposes
  debug handles `window.__peers` (4740), `window.__plats` (4745) and
  `window.__race` (7021).
- `?hide=1` — forces the big head hidden.

`?wraf=1` must come to `play.html`. It is the standing answer to the
"live-play verification requires Chrome foregrounded" rule that has taxed every
verification round on this branch.

Both docs and the corresponding memory are corrected as part of this work.

---

## 7. Non-goals / deferred

- **The closure split** (ambient engine vs games inside `play-engine.js`). Buys
  ~130 KB for heads-on visitors only; logged as an optional follow-up so the
  file move stays mechanical. One change per pass.
- **`.hmArena` rename** away from the `.hero` contract (§5.1).
- **Deep links** (`play.html?game=soccer`). Supported for testing; the home menu
  links to plain `play.html`.
- The scorer identity bug (§3.4) and the floating-captain bug (§3.4b) are
  separate build-order items and are not addressed here.

---

## 8. Verification

Measured before and after, numbers reported side by side:

1. Home page rAF call sites and live canvases, in all three states (no heads /
   heads off / heads on).
2. `index.html` byte size.
3. A full tournament plays start→finish on `play.html`: bracket, fixtures,
   goals firing the Task 1 goal grammar, champion.
4. Plain soccer, Floor is Lava and marble race each play start→finish on
   `play.html`.
5. Saved heads (`localStorage`) behave identically on both pages — same origin,
   so this should be free; confirm rather than assume.
6. Home page: moods, roster grid, "Add an egghead", "Show on home" and the
   headmaker link all still work with the engine absent.
7. No-heads visitor loads home clean, no console errors.
8. Mobile 390 on `play.html`: no horizontal overflow, controls reachable.
9. `python3 /tmp/hm-check.py` → `syntax OK` after every edit.

Verification uses `?wraf=1` where a backgrounded tab would otherwise freeze rAF.

---

## 9. Risks

- **The 287 KB move is mechanical but large.** A single dropped brace is a
  white page. The syntax gate after every edit is not optional.
- **`index.html` defines things twice.** Grep all occurrences before deleting
  any selector or function name.
- **This branch has had concurrent sessions.** `git log --oneline` before
  starting; diff against the right base.
- **Head scale on `play.html` is invented, not inherited** (§3.3) and will need
  a tuning pass against a real match.
