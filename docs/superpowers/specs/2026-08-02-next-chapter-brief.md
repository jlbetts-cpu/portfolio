# Next Chapter Brief — the iOS pass, the Play page, and the 12-team draft

2026-08-02. Written as a handoff: this document plus
`docs/superpowers/specs/gradient-reference-notes.md` and the plans in
`docs/superpowers/plans/` are everything a fresh session needs.

---

## 1. Where things stand

**Live on `main` (deployed):** Plan 1 foundations (event bus, session history,
`__hmSlow`, `__hmFxAt`, materials toolkit, sheen/stinger, `CUP_ID` 8 cup
identities, Archivo) · Plan 2 boards (split-flap component, horizontal painted
scoreboard, Draw Board where fixtures are printed tickets that tear and stamp) ·
Gradient Lab (`gradientlab.html`) + the Ambient Orbs study set (`orbs.html`) +
the Extras card.

**In flight on branch `broadcast-match`:** Plan 3 Task 1 — the goal grammar
(hit-stop → punch-in → slow-mo → particles → scorer lower-third), reviewed, fix
round applied AND closed: the ball shadow's stacking group was confirmed holding
z:2 (below the heads' z:3) across the punch window, the lower-third teardown
fires from `finish()`, and the particles read the pitch's own `__hmTeamRGB`.
Only residual is a visual screenshot mid-goal with the browser foregrounded.
Egghead names also shipped here (§3.3). Tasks 2–4 (director layer, suspense ticker, personas +
crowd) are specced in `docs/superpowers/plans/2026-08-02-broadcast-match.md` and
NOT started.

**Unresolved from Jayden, still open:** scoreboard compactness/type/colour
polish · the green match-point signal he disliked (variants S1–S4 were built,
never picked).

---

## 2. Performance audit — measured, not guessed

**Verdict: the gradient work is NOT slowing the site.** `index.html` contains
zero references to the shader engine (`grep -c "FluidMesh\|fluidEngine"` → 0).
Gradient Lab is a separate page; the home page never loads WebGL. The only
gradient cost on the home page is the Extras tease card — a CSS-only orb whose
`filter:blur(26px)` pseudo-element paints solely while the Extras tab is open.

**What is actually heavy (all pre-existing):**

| Metric | Measured | Note |
|---|---|---|
| `index.html` | **809 KB** | all CSS + JS inline; the real budget problem |
| Referenced assets | 5029 KB | of which `videos/reel.mp4` = **2889 KB** (`preload="none"`, so deferred) |
| `requestAnimationFrame` call sites | **63** | many always-on |
| `filter: blur()` declarations | **71** | large-area blurs are the classic paint killer |
| `backdrop-filter` | 7 | |
| Canvases created in JS | 13 | FX canvas, grain, confetti, race, lava… |
| DOM nodes (home) | 529 | healthy |
| DCL / load (local) | 264 ms / 527 ms | local server — not representative of field |

**Where the real win is:** moving Play/soccer/tournament to its own page (§3.2)
removes the companion engine, its rAF loops, its canvases and its physics from
the home page entirely. That is both the feature Jayden wants and the single
biggest performance lever available.

**Recommended budget going forward:** one shared rAF ticker rather than N loops ·
every animated surface paused by `IntersectionObserver` when offscreen and by
`document.hidden` · WebGL canvases capped at DPR ≤ 2 with
`powerPreference:'low-power'` · no new full-viewport `filter: blur()`.

---

## 3. The eight workstreams

### 3.1 Design-system adoption of the gradient engine
The engine exists but is not tokenised. Ship `FluidMesh` as a named site
component with a documented config contract, a token layer (cup hue → node
palette), and a static CSS fallback for no-WebGL. Consumers, in order: the
soccer banner (§3.6), cup identities, the champion moment, case-study
infographics. Source of truth for the look: `gradient-reference-notes.md`.

### 3.2 Play gets its own page  ← **biggest perf + UX win**
Move soccer / tournament / lava / marble race off `index.html` onto a dedicated
route (`play.html`), with a back affordance to the portfolio. Benefits: the home
page sheds the companion engine, its rAF loops and canvases; the game gets full
viewport and a real URL. Keep the Play menu on the home page as the entry point
(it links rather than launches). Carry the `?stand=1` test hooks across.

### 3.3 Egghead names — deterministic and colour-locked  ✅ SHIPPED 2026-08-02
**Research:** Minions land because ordinary human names sit on absurd bodies —
the incongruity is the joke; short, plosive-led, 1–2 syllables. The trap is
M&M's, whose spokescandies are literally named Red/Yellow/Blue. Power Rangers
never name a character after their colour.
**Recommendation (name is a pure function of colour, so Red is always the same
egghead):** Red→**Gus** · Gold→**Milo** · Green→**Ozzy** · Teal→**Dot** ·
Sky→**Baz** · Blue→**Kip** · Violet→**Fitz** · Magenta→**Chip**.
Reserve tier for palette wrap: Stan, Wally, Pip, Rex, Moe, Dex, Bram, Nubs.
Deliberately *not* matched to colour temperament (no fiery Red, no calm Blue).
**Shipped** (commit `036dd55`): each `PAL` entry gained a `who` field and the
team-naming rule uses `pal.who`. `colName` still carries the colour for the bar,
ring and nets. Remaining: the reserve tier is not wired (only matters past 8
teams — do it with the 12-team work in §3.7), and the "Add an egghead" chip in
the Play menu may still show a generic label — check when the Play page moves.

### 3.4 BUG — "Jayden scored" when he wasn't playing
Real bug, partially traced. Facts established:
- `S.touches` is only populated when `window.__hmTour.live` — plain soccer never
  has a resolvable scorer (falls back to team name; correct).
- The tournament assigns spawned players slots from `SLOT=9200++` and records
  them on `tm.slots`; identity is matched via `window.__hmSlotFor(cut)`, which
  compares **cut data-URL strings**.
- Tournament respawns **re-encode each player's cut image** (byte length differs,
  confirmed live), so cut-string matching across a respawn fails.
- Two eggheads dyed identically produce identical cut strings — a documented
  historical collision (`__hmSlotFor` returns the first one's slot).
**Consequence:** a goal can resolve to the wrong head — including the visitor's
own head (Jayden) when the fallback path picks the saved companion.
**Fix direction:** give every spawned player a **stable id** threaded through
`spawnCompanion`/`buildTeams` instead of matching on image bytes, and resolve
scorer names from `tm.slots` → `playersOf(tm)` index. Never fall back to the
visitor's head — fall back to the team name.

### 3.4b BUG — captains float above the other heads on the pitch
Reported with a screenshot 2026-08-02: in a tournament match some heads (the
captains) sit visibly higher than their squad-mates instead of sharing one
ground line.

**Lead (index.html ~5089–5091, the per-head resize path):** head size is
per-head, not global — `nHW` is derived from the hero rect, then
`if(filler) nHW = round(nHW*1.5)` (mini-Jayden is deliberately bigger), and
`HH = HW*1.2` with `root.style.height` rewritten. The floor clamp on the next
line is `if(y>floorY) y=floorY`. So **`HH` can change without `floorY` being
recomputed in the same pass** — a head whose box grew/shrank keeps seating
against a stale floor and hovers (or sinks) until something else recomputes it.
Captains are the heads most likely to differ in size (saved heads and the
filler take the `*1.5` branch and different source art), which matches the
symptom exactly.

**Verify before fixing:** log `HW/HH/floorY/y` per head one frame after a
fixture starts and look for heads whose `floorY` disagrees with
`groundY − HH`. Fix direction: recompute `floorY` (and the shadow's placement)
in the same block that mutates `HW/HH`, rather than only on resize. Do NOT
"fix" it by nudging y — the seating rule is that every head's FEET share the
ground line, whatever its size (documented intent: the filler's size is its
identity, not a depth cue).

### 3.5 iOS corner smoothing + premium iOS feel
**Research:** `border-radius` is a circular arc (G1, curvature jumps at the
junction); Apple's corner is a curvature-continuous hybrid of a Bézier ramp
(~2/3) plus a fixed arc (~1/3). Figma exposes this as corner smoothing, where
**60% is the "iOS" preset**.
**Implementation for a no-build site:** CSS `corner-shape: squircle` alongside
`border-radius` — **Chrome/Edge 139+ only** (~65% of users), degrades silently
to plain rounded corners elsewhere, so it is safe progressive enhancement today.
Where cross-browser parity matters, generate a squircle path and use
`clip-path`, keeping `box-shadow` on an **unclipped wrapper** (clip-path clips
shadows *and* focus rings — an accessibility trap).
**Radius scale to adopt (concentric rule: inner = outer − padding):**
6 chips · 10 inputs · 14 buttons/small cards · 20 cards/sheets · 28 modals.
Apple's own nonscrolling button radius is 22pt.
**Beyond corners:** spring motion (sample a real spring into CSS `linear()`, or
`cubic-bezier(0.34,1.56,0.64,1)` for the bouncy approximation) · material
layering (translucency + blur ladder) instead of heavy shadows · soft
low-opacity large-radius shadows · hairline rims · 44×44pt minimum targets ·
the iOS 26 Liquid Glass specular edge as a lighting cue on top of the shape.

### 3.6 The Gemini-style gradient banner over soccer
A living gradient bar at the top of the match surface, built from the **two
teams' colours**.

**Research changed the recommendation — do NOT inline the WebGL engine here.**
- Gemini's own animation is reproduced as a CSS-only oversized linear gradient
  translated by keyframes — no canvas. Apple Intelligence / Siri's glow is
  SwiftUI layered blurred gradient shapes with **no Metal shaders**. The shared
  pattern across all of these is a thin, blurred, edge-hugging gradient driven
  by transform/opacity, not per-pixel shader work.
- With 63 rAF loops and 13 canvases already live, an always-on WebGL banner is
  the wrong trade. **Build it in CSS**, interpolating with
  `color-mix(in oklch, …)` so the two team colours never mud at the seam, and
  animate `background-position` (compositor-friendly, no rAF).
- **Broadcast precedent matters here:** current sports packages are moving
  *away* from blended two-team gradients toward flat split colours precisely
  because a blend implies a winner (NBC's NBA package is the cited case). Safest
  treatment: two solid zones with a short OKLCH-interpolated seam — symmetrical,
  no implied favourite — rather than an edge-to-edge blend.
- Keep the full `FluidMesh` engine exclusively on its dedicated route. If a
  WebGL banner is ever genuinely wanted: gate it behind `IntersectionObserver`,
  share one ticker, render at ~0.5× internal resolution and CSS-upscale, cap DPR
  ≤ 1.5, and pass `powerPreference:'low-power'`.

### 3.7 Twelve teams
**Research recommendation:** single elimination on a 16-slot bracket with **byes
to seeds 1–4** (preserves top-seed separation) = 11 matches, plus an explicit
**3rd-place playoff** = **12 matches total**. Ranks 5–12 need no extra matches:
order by round eliminated, tiebroken by seed. Bye slots should render as muted
"ghost" cards with an auto-advance beat, never empty boxes.

### 3.8 Draft order (quiet)
The tournament's final 1–12 ordering is the deliverable. The UI must **never
mention fantasy football** — it simply produces a ranked finishing table at the
end of a cup, exportable/copyable. Treat it as "final standings", which is
honest on its own terms and happens to be exactly what a draft order needs.

---

## 4. Proposed build order

1. **Play page extraction** (§3.2) — biggest perf win, unblocks everything else.
2. **Scorer identity fix** (§3.4) — correctness bug, cheap once the page moves.
3. ~~Egghead naming (§3.3)~~ — ✅ done.
4. **iOS radius + smoothing system** (§3.5) — tokens first, then apply site-wide.
5. **Gradient design-system adoption** (§3.1) — tokenise the engine.
6. **The soccer gradient banner** (§3.6) — first consumer of the token layer.
7. **12-team bracket + final standings** (§3.7, §3.8).
8. **Finish Plan 3** (director, ticker, personas) — already specced.

Rationale: perf and correctness before polish; the design system before its
consumers; the tournament structure change before the presentation work that
sits on top of it.

---

## 5. Rules carried forward (hard-won)

- Guard conditional globals cross-block (`__hmBus`, `__hmSess`, `__hmSlow`,
  `__hmFxAt`, `__bcMat` don't exist for a no-heads visitor).
- The scoreboard never moves; camera transforms act on the stage layer only.
- No `filter` on an ancestor of the split-flap cells.
- `index.html` defines things twice — grep ALL occurrences before adding.
- `@media` adds no specificity; scope mobile overrides.
- Live-play verification requires Chrome **foregrounded** (rAF freezes in
  background tabs). Ember planet preset is the Gradient Lab regression baseline.
- One change per pass; revert anything that regresses the baseline.
- Seeded roster + `python3 /tmp/hm-check.py` syntax gate after every edit.

---

## 6. Performance rules the research added

- `requestAnimationFrame` auto-pauses in hidden *tabs* but **not** for elements
  merely scrolled offscreen in a visible tab — that needs an explicit
  `IntersectionObserver`. With 63 loops registered, this is the highest-value
  sweep available after the Play-page extraction.
- Long task = **50 ms** main-thread block; audit under **4–6× CPU throttling**
  to approximate a mid-range Android, and read the DevTools Interactions lane
  for INP.
- `blur()` is the single most expensive CSS filter (cost scales with radius ×
  area) and `backdrop-filter` compounds when stacked; a commonly cited rule of
  thumb is that mobile comfortably handles only **3–5 simultaneous blur
  effects**. The home page currently declares **71** `filter: blur()` rules —
  worth auditing which are simultaneously painted.
- Moving the toy to its own route means the home page pays **zero** bytes and
  zero JS-eval for it until visited. Sub-page convention is a persistent
  top-left back affordance rather than relying on browser-back.
