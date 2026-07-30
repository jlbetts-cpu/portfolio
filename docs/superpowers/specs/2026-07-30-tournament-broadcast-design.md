# Tournament Broadcast Package — Design (v2)

2026-07-30. Overhaul of the soccer tournament mode so every simulation feels like a
premium sports broadcast. The cup gets **its own identity**: it lives inside the
portfolio and the photo-cutout heads stay the stars, but the tournament screens are
allowed their own materials, type scale, and light. The site's design system governs
the site; the broadcast governs the match.

v2 folds in the second research pass (sound, typography, memorability psychology,
matchday print culture, per-match variety systems) and Jayden's requirement that
**every cup is a different event, not a name change**.

## Jayden's calls (settled, don't relitigate)

1. **No day→night escalation arc.** One light world. Night exists only where it
   already lives: the champion spotlight/celebration.
2. **Typography: two-track exploration**, decided from rendered specimens (§Typography).
3. **Split-flap: yes** — properly constructed, textured, and team-attributed.
4. **No instant-replay system.**
5. **Sound: yes, high-end, done right.** Opt-in (muted by default).
6. **Every cup is a distinct event** — a deterministic identity, not a random skin.
7. **Pennant share/save: yes** (2026-07-30) — canvas render → downloadable image.
8. **No drama bias** (2026-07-30): "I like when they are narrow but having it be
   narrow every game feels a bit much and unrewarding to the games that are
   actually close." Natural variance is the point — close games stay special
   because they are earned. The variable-intensity presentation (big treatment
   for late winners) already rewards the close ones without rigging the sim.

## The one governing principle: spend where memory is written

Peak-end research (Kahneman: retrospective memory is dominated by the most intense
moment and the ending; duration is neglected) sets the polish budget:

1. **The champion ending** — highest polish in the whole mode. The end of peak-end,
   the completion payoff, and the shareable artifact coincide here.
2. **Goal moments** — the peaks. Variable intensity: routine goals get a stamp;
   late winners/equalizers get the full sequence (a late belief-jump is the biggest
   drama available).
3. **Near-miss beats** — cheap arousal maintenance between peaks (post-rattles,
   big saves, a held breath before the outcome resolves).
4. **Pre-match ritual** — short and *identical every time* (ritual works through
   repetition, not length; ≤4s so five matches don't make it a skip target).
5. **The draw/schedule** — must be legible and persistent (goal-gradient: "two
   wins from the final" works by being *seen*), but gets layout care, not VFX.

Anti-budget: mid-match filler, menus, and settings stay deliberately quiet —
flattening the valleys makes the peaks taller for free.

## Art direction: "Matchday Print"

Daylight, printed-matter, painted-board materials. The three governing moves on
every new surface:

- **Two shadows, one light direction** (tight 1–2px contact + wide low-opacity
  cast, matching the face cutouts' light).
- **One grain layer over the whole composite**, type included (~512px greyscale
  noise, 4–8% soft-light).
- **Break every symmetry** — rotation ±0.5°, offset ±1px, brightness ±4%,
  **seeded per cup** so repaints don't reshuffle.

Never: pure #000/#fff, uniform gradients, symmetrical highlights, identical
repeated elements, perfect alignment. LED/emissive chrome stays banned. Textures
ship CC0 only (Poly Haven / ambientCG).

**Print-artifact grammar** (from the matchday-print research). Each artifact owns
exactly one UI role; one era register per surface, never pastiche; the ephemera
carry *information*, never pure decoration:

| Artifact | UI role | Grammar |
|---|---|---|
| **Ticket stub** | A fixture in the schedule | Long horizontal ticket: round name where seat data goes, both names as the event, dotted perforation rule, short stub with the match serial (cup-prefixed, e.g. `APL-0047`). Played fixture = stub **torn** (rough edge) with the score stamped on. The schedule history becomes a stub collection. |
| **Split-flap board** | The in-match scoreboard digits | §Scoreboard. The one mechanical component; lives nowhere else. |
| **Panini sticker** | Player of the Match | White border ~4–6%, matte ground behind the photo head, caption band, album-style serial number. |
| **Pennant** | The champion keepsake | Felt triangle in team colour, contrasting hoist band, cut-felt "CHAMPIONS" tapering with the shape, winner's head appliquéd like a sewn patch, numbered edition ("No. 12") that increments per tournament played (localStorage) — print-native replay encouragement. |
| **Programme cover (1950s cup-final register)** | The tournament title card | "OFFICIAL PROGRAMME · SOUVENIR EDITION", rule-line borders, formal type. Its inside team-sheet grammar ("v." columns) skins the pre-match lineup moment. |
| **Foil** | Reserved *exclusively* for the champion | Panini's own scarcity system: an animated foil sheen on the champion's sticker/pennant patch is the ending's "shiny". No foil anywhere else, ever. |

**One motif:** the diagonal light-sheen sweep — reveals the versus poster, edges
the stinger wipe, glints the trophy, and becomes the champion's foil. **One motion
axis:** enter left, exit right, everywhere.

## Cup Identity System (new)

The eight cups are named after the case studies (`CUPS`: Apollo, Bearings,
Cluster, Strata, UC Davis, Reshore, B2B, Blender) — "the trophy may as well point
at the work." Each becomes a **recurring event with its own brand**, deterministic
by name so a returning visitor *recognizes* the Strata Cup like a real competition.

A `CUP_ID` registry keyed by cup name; each entry defines:

- **Palette DNA sampled from its case study** — board paint hue (dark, low-chroma),
  plate/ticket stock tint, sheen tint, confetti palette, pennant ground + binding.
- **Serial prefix** for tickets/stickers (`APL-`, `STR-`, …).
- **Voice** — round-label wording set (e.g. one cup says "Quarter-final", another
  "Last Eight"), programme-cover ornament variant.
- **Texture variant** — which CC0 paint/plank texture the board uses.
- **Crowd character** — density + mood seed (already seeded off cup name; formalize).
- **Sound flavour** — bed excitement baseline and swell character (subtle; same
  engine, different tuning).
- **Trophy accent** — the trophy engraving plate carries the cup's name and tint.

Rules: identity changes *materials and voice*, never layout or information
architecture (the Riot lesson: lock the system so viewers internalize it; the cups
differ the way stadiums differ, not the way apps differ). Poster artwork remains
Jayden's and remains per-fixture; the cup identity is the world around the posters.

## Screens

### 1. The Draw Board (schedule)

Same DOM skeleton and `paint()` flow; the visual rebuild:

- A matte painted plane in the cup's paint, with each fixture as a pinned
  **ticket** (grammar above), carrying the seeded jitter, paired shadows, and
  slightly different pin heights.
- Result posting: the stub tears (one-time animation ~400ms) and the score stamps
  on with an ink-press pop. Winner's side stays full ink; loser's dims ~12%.
- The live fixture gets a small emerald tally light (a dot, not a border).
- A persistent, glanceable **distance readout** on the capsule: "2 wins from the
  final" (goal-gradient framing — distance remaining, not bracket topology).
- Round labels are painted-stencil style in the cup's voice.
- Champion screen: the board's stubs do a ~40ms-stagger cascade highlight of the
  winner's path (roll of honour).

### 2. Versus Card ceremony (pre-match)

Poster system untouched (registry, per-artwork head positions, heads flanking the
VS, no tint over artwork). The reveal, in beats — the *identical-every-match
ritual*, total ≤4s:

1. Poster wipes in; the sheen sweeps once (~700ms).
2. Heads slide in from opposite edges on the motion axis, landing with a
   contact-shadow thud (2px stage shake, anticipation dip before the settle).
3. Names stamp in ~120ms apart; kit-colour chip beside each; a tale-of-the-tape
   line from real tournament stats only (omit when empty, never fake).
4. Session-memory callout when one exists (§Variety): "These two met in round 1."

### 3. Scoreboard (in-match)

The vertical stack keeps its skeleton and information; the rebuild is material,
scale, and type:

- Hanging-card board: dark matte plane (cup paint), light plates, grain, jitter,
  paired shadows.
- **Split-flap digits** for the score: fixed-width cells (the Solari/painted-board
  rule — the *container* is the design unit), one digit per card.
- Physical-board hierarchy: score digits ≥1.75× the name size, in the display
  face; names/labels stay Instrument Sans.
- Leader full ink / trailer dimmed stays. Match point: thin emerald glow on the
  numeral plate edge; deuce: both.
- Final keeps the gold round label and the trophy standing on the board.

### 4. Split-flap construction (score digits only)

From the reference implementations (hardikpandya/solari-split-flap et al.):

- **4 layers per cell**: static top half (current char upper), static bottom half
  (next char lower), flip-front (old), flip-back (new); halves clipped by
  half-height `overflow:hidden` containers.
- Flip = `rotateX(-180deg)`, `transform-origin: bottom center`,
  `backface-visibility: hidden`, parent `perspective`; **~150ms per flap**.
- **Spin-through**: always advance forward through every intermediate character on
  a fixed drum, wrapping — never flip backward or jump direct.
- **Deceleration**: ease the per-flap interval (fast → slow), not the CSS
  transition.
- **Cascade**: ~50ms stagger left-to-right; cells settle raggedly (different spin
  distances) — don't normalize durations.
- 1px misregistration between halves, seam shadow above / highlight below, pin
  ticks, ±4% per-cell brightness.
- **Team attribution**: each score cell group carries its team's kit-colour chip
  on the plate edge (same chip as versus card and ticket).
- **Engineering trap**: 3D transforms create stacking contexts — keep flap cells
  out of any ancestor carrying `filter` (the site's ink filters) or `transform`;
  verify in real Chrome, not the pane.
- Sound: synthesized click per flap, pitch/gain jittered ±10%, ≤1 per 30ms,
  −18dB below stingers.

### 5. Full-time card (~3s, skippable)

Stinger wipe → near-empty card: the score at ~24vw in the display face, heads
either side, round name small below → wipe back to the Draw Board where the stub
tears and stamps.

### 6. Player of the Match (semi + final, ~2.5s, skippable)

The **Panini sticker**: white border, matte ground, the head, caption band with
name, one stat line ("3 goals"), album serial in the cup's prefix. No foil — foil
is the champion's.

### 7. Champion — the most polished screen in the mode

Keeps the SportyBlocks shell, crown, spotlight cue sheet, trophy hand-off,
team-colour confetti (the night lives here, as deliberate contrast). Gains:

- The **pennant**: felt texture, cup colours, cut-felt CHAMPIONS, the winner's
  head as a sewn patch with **the foil sheen** — the package's one shiny.
- Numbered edition ("No. N" per tournaments played on this device).
- The Draw Board roll-of-honour cascade behind.
- An engraved trophy plate carrying the cup's name (small and physical — the
  ghosted-name idea stays dead).
- **Share/save**: render the pennant to a canvas → downloadable image. The user's
  friends' faces on a numbered pennant is the high-arousal + social-currency
  share object. (Needs Jayden's OK — new feature surface.)

## Variety: the systems that make every match different

**Prerequisite (build first): a match event bus + per-session history object.**
Atomic events (kickoff, shot on/off/woodwork, save routine/spectacular, goal,
half/full-time) plus derived events computed from them (streak, drought, comeback
state, late-winner window, domination index) and session memory keyed by head/pair
(head-to-head this session, revenge flag, goals per head, never-scored-yet,
giant-killing). Every system below is a consumer.

### The ticker (Football Manager's trick)

A one-line commentary strip on the match stage. **Suspense = information delay**:
two-beat delivery — "Maya winds up…" → ~900ms hold → outcome line. Team-coloured
text, flash on goals. Line system: `lines[eventType]` = template variants with
conditions (`{lateGame}`, `{isRevenge}`, `{firstTournamentGoal}`…); picker filters
by condition, scores by specificity (most conditions matched wins), ties break
randomly, per-template cooldown so nothing repeats within a match. ~8–10 variants
per event type. Minute-stamped feed persists as the match story.

### The director layer (~100 lines)

Subscribes to the event bus; owns one "shot" state over the existing stage:

- Shots: MASTER (default) · PUNCH-IN (transform toward ball/scorer) · REACTION
  (framed close-up of a head: scorer, beaten keeper, opposing captain) ·
  BENCH/CROWD cutaway · BOARD shot (linger on the split-flap).
- Grammar: never leave MASTER >1.5s during live play. Goal = punch-in scorer →
  REACTION scorer (cheer) → REACTION beaten keeper (droop) → bench cutaway →
  wide. Near-miss = one quick punch-in + shooter reaction only (keeps goals
  bigger). Quiet stretches = occasional 1s crowd/bench cutaway — this is what
  makes it read *televised*.
- Anti-repetition: 2–3 shot recipes per event type, remember the last used;
  recipe choice can key off narrative flags (revenge-game goal → always show the
  opposing captain).

### Persona vectors (no new animation clips)

Per-head `persona = {energy, volatility, showboat, nerves, phase}` modulating the
existing blink/gaze/cheer rigs: energy scales bounce amplitude/fidget rate,
volatility scales reaction deltas, showboat extends celebrations, nerves raises
blink rate + gaze-darts when losing late, `phase` desyncs everything (the cheapest
anti-repetition trick). Celebration pick = context filter first (late winner →
big moves; consolation → muted) → persona weights → never-same-twice memory.

### The goal grammar (~3s, fixed order)

1. Ball crosses line → **hit-stop** 70ms (`__hmFX.hitstop`).
2. **Punch-in** to 1.07 at the goal mouth + directional shake (stage only; the
   board never shakes).
3. **Slow-mo**: timescale 1→0.25 over 150ms, hold ~600ms, ramp back (new
   `__hmSlow` multiplier on `dt` beside `__hmFreeze`). DOM/broadcast layer runs
   at normal speed.
4. ~12 particles from the goal mouth along the shot vector; **scorer
   lower-third** (head, GOAL, name) on the motion axis.
5. Release; split-flap ticks the score; kickoff drop.

Late winners/equalizers get the full sequence + a bigger ticker beat; routine
goals in a blowout get steps 1 + 5 only (variable intensity per the polish
budget). Confetti stays reserved for match wins and the champion.

### Photo-head animation safety (from the rigid-rig research)

- **Safe**: anticipation dips (3–6% height), overshoot-and-settle (~10%),
  slow-in/out everywhere, timing asymmetry (fast up slow down), arcs not lines,
  secondary action (blink/gaze mid-move).
- **Safe with restraint**: squash on landing `scaleY(.94) scaleX(1.04)` ≤100ms,
  transform-origin at the chin; uniform scale pops ±10%.
- **Risky**: rotation >~12°, held non-uniform scale. **Forbidden**: skew, mirrored
  flips mid-motion (photo lighting flips), any deformation. Smear substitute:
  1–2 frames of slight blur or a low-opacity trailing duplicate on fast moves.

### The missing primitive

`fxAt(ex, ey)` mapping engine coords → viewport coords so the soccer module can
draw with `__hmFX`. Unlocks ball trails (only above a speed threshold — the trail
*means* danger), speed lines (2–3 one-pixel streaks, dead in 200ms), goal-mouth
crackle, post-ping sparks.

### Crowd

`.tFan` tiers: staggered wave ripple on goals, subtle ball-tracking all match,
persona-phase desync so no two fans move together.

## Motion: walkout & escalation

Walkout (semi + final only, ~4s, skippable): both squads line up mid-pitch, slow
1.06 pan, one blink/fidget each, break to positions, countdown.

| Round | Ritual |
|---|---|
| Quarters | Versus ritual (≤4s) → kickoff → FT card |
| Semi | Versus ritual → walkout → FT card → Player of the Match sticker |
| Final | Full: walkout, longer holds, clutch shift, spotlight, trophy, pennant night |

All motion transform/opacity; every sequence collapses to instant state changes
under reduced-motion (not shorter animations — none).

## Typography (two-tier, one gate)

**Verdict on Track A (research-verified):** Instrument Sans Variable's axes are
wdth 75–100 / wght 400–700 — it *cannot* reach broadcast display register (that
lives ~wdth 50–65, wght 800–900). But it has verified `tnum` and is a genuinely
good *data* face. So the system is two-tier regardless; the gate is which display
face joins it:

- **Saira VF** (OFL) — wdth 50–125 / wght 100–900, verified tabular figures; one
  subset file (~50–90KB) does ticker → digits → poster. Engineered/motorsport
  character.
- **Archivo VF** (OFL) — best taste-match with Instrument Sans (both low-contrast
  grotesks); verify `tnum` on-file before committing.
- **Khand** (OFL) — compact monolinear, the most "football scoreboard" character;
  static weights, stamp/numerals role only.

Deliverable: one specimen page rendering the scoreboard, FT card, and a ticket in
all three + an Instrument-only baseline; Jayden picks from screenshots.

Usage rules (locked): display face touches **numerals and moments only** (scores,
clock, GOAL/FT/HT, titles); Instrument Sans keeps names, labels, UI at 400/600;
live numbers always tabular-lining and one digit per fixed-width cell; at
scorebug sizes weight up + tracking open, at poster sizes weight down + tight;
one axis of drama at a time (ultra-condensed Black type ⇒ flat colour, the board
materials do the richness). Variable bonus: animate wdth briefly on score change
(condense-snap) instead of scale — crisper and reads engineered.

## Sound (opt-in, done right)

**Architecture:** one AudioContext (resumed on gesture) → buses `bed` / `stingers`
/ `ui` → master gain → DynamicsCompressor (safety limiter). No sidechain node in
the spec — duck manually: priority sound ramps bed −6..−9dB over 50–100ms, back
over 300–800ms. All gain changes ramped (never set `.value` on running audio).

**The bed is procedural** (zero download): two noise sources — band-pass
200–800Hz "voices" + low-pass 150Hz "rumble" — slow independent LFOs on cutoff and
gain; one scalar `excitement ∈ [0,1]` drives cutoff/gain/LFO depth and
**auto-decays toward baseline over 3–10s** (the EA state pattern). Cup identity
tunes baseline + swell character.

**Samples (6–8 total, lazy-loaded only after opt-in, <1MB sprite):** crowd gasp,
falling "ooh", roar ×2, whistle, flap click ×2 fallback, kick thud. Sources:
Freesound CC0 (check per-sound badge), Sonniss GDC (no attribution, commercial
OK), Kenney (CC0). **BBC archive is banned** (RemArc = non-commercial; a
work-soliciting portfolio is a grey zone not worth entering). Licences recorded in
the repo.

**Trigger map:** toggle-on → bed fades in 1.5–2s · kickoff → whistle + excitement
+0.2 · attack build → excitement ramps 0.6–0.8 (no one-shot) · shot → gasp, duck
bed · save/post → "ooh", excitement falls to ~0.3 over 1s (the deflation dip) ·
**goal → synth sub-thump 50–80Hz exactly on-frame, roar starting +80ms swelling
500ms** (a real crowd reacts *after* the ball crosses the line), excitement pinned
1.0 for 4–6s · win → roar + triple whistle · champion → roar layered with itself
detuned −3st, 10s decay · flap ticks and UI beats quiet (−18dB).

**UX:** speaker toggle on the capsule, persists in localStorage (context still
needs a fresh gesture each load — unlock silently on first click when pref=on);
`visibilitychange` pauses the bed; audio never blocks gameplay; repeated cues get
±5–10% playbackRate jitter.

## Engineering notes

- `paint()` stays the single render function for non-match screens; FT card and
  POTM are new `T.phase` beats absorbed into the existing 5600ms/10500ms windows.
- New globals limited to: `__hmSlow`, `fxAt`, the event bus, the sound manager,
  `CUP_ID`. Everything else rides existing hooks (`__hmTourGoal`, `__hmSoccerEnd`,
  `__hmPartyAt`, `__hmFX`, the crowd seeding).
- Verify `T.stats` is populated by `__hmTourGoal` before writing stat copy; wire
  it there first if not. No fake data anywhere.
- Known traps honoured: capsule min-height-only; duplicate-definition greps before
  any new rule; `@media` adds no specificity; poster heads flank the VS and never
  cover artwork heads; schedule stays a plain `<section>`; Play menu untouched;
  split-flap cells outside filtered/transformed ancestors.
- Testing: seeded roster via localStorage; drive fixtures with `.tCupGo` →
  `__hmTourWin(1,5,1)` → `__hmSoccerEnd()` → wait ≥6s; feel checks in real Chrome
  (pane throttles rAF and white-screens on ink filters).

## Open items (Jayden's call)

1. **Typeface pick** — specimen page published (all axis/tnum claims verified
   on-file: Saira wdth 50–125 + tnum; Archivo wdth 62–125 + tnum; Khand static,
   no tnum, fixed cells compensate; Instrument Var wdth floor 75 / wght cap 700).
   Awaiting Jayden's pick.

## Out of scope

Instant replay · day→night arc (night = champion only) · Play-menu or bracket
data-model restructuring · match rules/length changes · standings/player-stat
tables beyond real tracked data.

## Build order

1. **Foundations:** event bus + session history, `fxAt`, `__hmSlow`, grain/jitter/
   shadow tokens, sheen + stinger components, `CUP_ID` registry.
2. Typeface specimens → Jayden's pick.
3. Scoreboard material rebuild + split-flap component.
4. Draw Board rebuild (tickets, distance readout, stub tear/stamp).
5. Goal grammar + director layer + ticker + personas + crowd.
6. Versus ritual + walkout + FT card + POTM sticker.
7. Champion: pennant, foil, roll of honour, engraved plate (+ share if approved).
8. Sound layer.
9. Full-tournament drive-through + real-Chrome feel pass.
