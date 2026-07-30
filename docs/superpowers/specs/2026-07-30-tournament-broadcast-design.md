# Tournament Broadcast Package — Design

2026-07-30. Overhaul of the soccer tournament mode so every simulation feels like a
premium sports broadcast. The cup gets **its own identity**: it lives inside the
portfolio and the photo-cutout heads stay the stars, but the tournament screens are
allowed their own materials, type scale, and light. The site's design system governs
the site; the broadcast governs the match.

## Jayden's calls (settled, don't relitigate)

1. **No day→night escalation arc.** One light world. Night exists only where it
   already lives: the champion spotlight/celebration.
2. **Typography: two-track exploration.** Build specimens of (a) Instrument Sans
   Variable's width axis for condensed broadcast numerals and (b) 2–3 candidate
   exclusive display faces (open licence). He picks from rendered specimens before
   anything rolls out.
3. **Split-flap score plates: yes** — but properly constructed and textured, and
   every plate unambiguously attributed to its team.
4. **No instant-replay system.** Goal grammar is the core sequence only.
5. **Sound: yes, high-end, done right.** Opt-in (muted by default), carefully
   layered, never startling.

## Art direction: "Matchday Print"

Daylight, printed-matter, painted-board materials — the direction ranked #1 in the
photoreal research (payoff ÷ difficulty), and the one that composites with
photographic face cutouts because it lives in the same optical register: a matte
object in daylight.

The three governing moves, applied to every new surface:

- **Two shadows, one light direction.** A tight 1–2px contact shadow plus a wide
  low-opacity cast shadow, both matching the light in the face cutouts. Applies to
  every plate, board, and card.
- **One grain layer over the whole composite**, type included. A single tiled
  ~512px greyscale noise texture at 4–8% soft-light, above everything in the
  tournament stage.
- **Break every symmetry.** Per-element jitter: rotation ±0.5°, offset ±1px,
  brightness ±4% — **seeded per cup** (off the cup name, like the crowd) so each
  tournament's board hangs differently but repaints don't reshuffle.

Never: pure #000/#fff, uniform gradients, symmetrical highlights, identical
repeated elements, perfect axis alignment. LED/emissive chrome remains banned.
Textures ship CC0 only (Poly Haven / ambientCG per the licence research).

**One motif, reused everywhere:** a single diagonal light-sheen sweep (animated
gradient + mask). It is the package's signature — it reveals the versus poster,
edges the stinger wipe, and glints across the trophy. No other decorative motion.

**One motion axis:** everything enters from screen-left and exits right (matching
the existing scan direction of the fixture list). Cards, lower-thirds, stingers,
walkouts — one axis, always.

## Screens

### 1. The Draw Board (schedule)

Replaces the flat `.tCupSched` styling; same DOM skeleton and `paint()` flow.

- A matte painted plane (dark, low-chroma — forest/seal range, never black) with
  each fixture as a light **hanging plate**: head thumbnail, name, score plate.
- Plates carry the seeded jitter, paired shadows, and hang at visibly different
  heights (±2px). Round labels are painted-stencil style (400 weight, letterspaced
  caps — texture does the work, not a new font weight).
- Result posting: the score plate **split-flaps** in (construction below). The
  winner's plate stays lit; the loser's plate dims ~12% and sags one extra degree.
- The live fixture gets a small emerald tally light (the "on air" dot) — a dot,
  not a border.
- The champion screen flips all plates in a ~40ms-stagger cascade to show the
  winner's full path (the "roll of honour" beat).

### 2. Versus Card ceremony (pre-match)

The poster system stays exactly as built (registry, per-artwork head positions,
heads flanking the VS, no tint over artwork). What changes is the *reveal*, built
in beats — never one fade:

1. Poster wipes in; the light sheen sweeps across it once (~700ms).
2. The two heads slide in from opposite edges along the motion axis, landing at
   their poster positions with a contact-shadow thud (2px stage shake).
3. Names stamp in ~120ms apart; under each, a tale-of-the-tape line — goals scored
   this cup, derived from `__hmTourGoal` events. Real numbers only; if stats are
   empty (round 1), the line is omitted, never faked.
4. Team colour appears only as a small kit-colour chip beside each name
   (broadcast convention: colour as data, not decoration).

### 3. Scoreboard (in-match)

The vertical stack survives — same DOM, same information, Jayden's mobile
rationale intact. The rebuild is **material and scale**:

- The `.sbCard` becomes a hanging-card board: dark matte plane, light plates for
  names and numerals, grain, jitter, paired shadows.
- **Physical-board type hierarchy:** score numerals ≥1.75× the name size (real
  boards run 1.75–2.3× between levels; web scorebugs' 1.0–1.25 is what reads flat).
  Numerals use the chosen broadcast face (typography track).
- Score changes **split-flap**. Leader full ink / trailer dimmed stays.
- Match point: the numeral plate edge takes a thin emerald glow (the clutch
  shift). Deuce: both plates.
- The final keeps its gold round label and the trophy standing on the board.

### 4. Split-flap construction spec (score plates only)

Budgeted as a real component, used nowhere else:

- Per-character cell; two halves that do not quite meet (1px misregistration).
- Seam: shadow above the split, highlight below; visible pin ticks at the sides.
- Flip animation: top half rotates down (rotateX, perspective on the cell), ~180ms,
  with a mid-flip blur frame; a soft mechanical tick in the sound layer.
- Uneven illumination across a row (±4% brightness per cell).
- **Team attribution:** every score plate carries its team's kit-colour chip on
  the plate edge (same chip as the versus card and scoreboard), so a plate is
  never ambiguous even seen alone in the schedule.

### 5. Full-time card (new beat, ~3s)

At the whistle, before returning to the draw: a stinger wipes to a near-empty
card — the score at ~24vw in the broadcast face, the two heads either side, round
name small below. Wipe back to the Draw Board, where the split-flap posts the
result. Skippable by click/tap.

### 6. Player of the Match (semi + final only)

After the full-time card: one big head, name, one stat line ("3 goals") from the
tournament stats. Nothing else on screen. ~2.5s, skippable.

### 7. Champion

Keeps the SportyBlocks shell, crown, spotlight cue sheet (ballyhoo → pickup →
iris → hold), trophy hand-off, and looping team-colour confetti. Gains:

- The night is *here only* — the existing dark-room spotlight is the one emissive
  moment in the package, now framed as intentional contrast to the daylight rounds.
- The Draw Board roll-of-honour cascade behind the card.
- An engraved cup-name plate on the card base (material treatment of the existing
  round label — note the ghosted-name idea was already tried and reverted; the
  plate is small and physical, not ghosted type).

## Motion grammar

### The goal sequence (~3s, fixed order, then play resumes)

1. Ball crosses line → **hit-stop** 70ms (`__hmFX.hitstop`).
2. **Punch-in**: stage scales to 1.07, transform-origin at the goal mouth, plus
   directional shake along the shot vector (`__hmFX.shake`). Only the stage moves;
   the scoreboard never shakes — the broadcast frame is stable.
3. **Slow-mo**: timescale ramps 1→0.25 over 150ms, holds ~600ms, ramps back. New
   `window.__hmSlow` multiplier applied to `dt` in the physics loop, beside the
   existing `__hmFreeze` check. DOM animations run at normal speed — the world
   slows, the broadcast layer doesn't.
4. ~12 particles from the goal mouth along the shot vector (white + team colour,
   400ms life). **Scorer lower-third** slides in on the motion axis: scorer's
   head, GOAL, name. Holds one beat.
5. Release: score plate flips, kickoff drop.

Confetti stays reserved for match wins and the champion — goals get particles,
not confetti, so the win still outranks the goal.

### The missing primitive

One function `fxAt(ex, ey)` mapping engine coords → viewport coords, so the
soccer module can draw with `__hmFX` (the gap noted at the physics-loop comment).
Unlocks:

- **Ball trail**: short fading polyline, only above a speed threshold — the trail
  *means* danger, so it never becomes noise.
- **Speed lines**: 2–3 one-pixel streaks parallel to a hard shot, gone in 200ms.
- Goal-mouth scramble crackle, post-ping sparks.

### Living heads (per-match variety)

- **Eyes follow the ball** during play (existing gaze/iris system pointed at the
  ball). The cheapest aliveness in the codebase.
- **Celebration variants**, randomly picked per goal: existing flip, knee-slide
  (translate + rotate + speed lines), spin, teammate mini-mob (shortened `win()`
  centroid-run). No two matches replay the same.
- **Conceding reactions**: slow blink, gaze drops; scored-on keeper stares down
  for a second.
- **Near-miss beats**: post ping + keeper `irisDil` + tiny crowd ripple — saves
  and misses earn reactions so goals aren't the only event type.
- **Crowd**: `.tFan` tiers do a staggered wave ripple on goals and subtly track
  the ball all match.

### Walkout (semi + final only)

Both squads line up mid-pitch facing camera; slow 1.06 stage pan across them;
each head fires one blink/fidget; break to positions; countdown. ~5s, skippable.

### Escalation ladder (ceremony length = stakes)

| Round    | Ritual                                                            |
|----------|-------------------------------------------------------------------|
| Quarters | Versus card (compressed) → kickoff → FT card                      |
| Semi     | Versus card → walkout → FT card → Player of the Match             |
| Final    | Full: walkout, longer holds, clutch shift, spotlight, trophy, champion night |

All motion: transform/opacity only; every new sequence respects the existing
reduced-motion bail (sequences collapse to instant state changes, not shorter
animations).

## Typography (exploration track — gate before rollout)

Deliverable: one specimen page rendering the scoreboard, FT card, and draw board
in each candidate, screenshotted for Jayden side by side.

- **Track A — Instrument Sans Variable width axis.** Already loaded (the logo
  uses it). Condensed/expanded broadcast numerals at zero added weight.
- **Track B — exclusive display face for the cup brand.** 2–3 candidates, SIL
  OFL/free-licence only, chosen for condensed heavy numeral quality (broadcast
  scoreboard register). Licence verified before any file ships.
- The face (whichever wins) appears **only** in tournament surfaces: score
  numerals, FT card score, round labels at most. Body/UI text stays Instrument
  Sans 400/600.

## Sound (opt-in, done right)

- **Muted by default.** A small speaker toggle on the tournament capsule; the
  choice persists (localStorage). Never autoplays with sound.
- Layers: a low crowd bed (loops, ducked under events) · goal swell + crowd roar
  (sidechained over the bed) · whistle (kickoff/FT) · split-flap mechanical tick ·
  post ping · quiet UI ticks for card beats. The final adds a slightly denser bed.
- Assembled with the Web Audio API (gain envelopes, no HTMLAudio pops). All
  assets CC0, licence recorded in the repo.
- Respects the reduced-motion/quiet ethos: nothing above a conversational level,
  no jump-scare transients.

## Engineering notes

- `paint()` remains the single render function for non-match screens; all new
  screens (FT card, POTM) are new `T.phase` beats in the existing
  `__hmTourWin` → `between()` timing chain. The 5600ms/10500ms celebration
  windows absorb the FT card + POTM rather than extending total dead time.
- New globals kept to: `__hmSlow` (timescale), `fxAt` (coord transform), the
  sound manager. Everything else rides existing hooks (`__hmTourGoal`,
  `__hmSoccerEnd`, `__hmPartyAt`, `__hmFX`).
- Verify `T.stats` is actually populated by `__hmTourGoal` before the
  tale-of-the-tape/POTM copy is written; if not, wire it there first. No fake data.
- Known traps honoured: capsule min-height-only (no fixed heights/overflow:hidden
  on the block), duplicate-definition greps before any new rule, `@media` adds no
  specificity, poster heads flank the VS and never cover artwork heads, schedule
  stays a plain `<section>`, Play menu untouched.
- Testing: seeded roster via localStorage; drive fixtures with `.tCupGo` →
  `__hmTourWin(1,5,1)` → `__hmSoccerEnd()` → wait ≥6s; final feel checks in real
  Chrome (pane throttles rAF and white-screens on ink filters).

## Out of scope

- Instant replay system (cut by Jayden).
- Day→night escalation arc (cut; night = champion spotlight only).
- Restructuring the Play menu, the bracket data model, match rules/length, or the
  scoreboard's information architecture (vertical stack stays).
- Standings/player-stat tables (no real data beyond goals/results).

## Build order (for the implementation plan)

1. Foundations: grain layer, jitter seeding, shadow pair tokens, `fxAt`,
   `__hmSlow`, stinger + sheen components.
2. Typeface specimens → Jayden's pick.
3. Scoreboard material rebuild + split-flap component.
4. Draw Board rebuild.
5. Goal grammar + living heads + crowd.
6. Versus ceremony + walkout + FT card + POTM beats.
7. Champion enhancements (roll of honour, engraved plate).
8. Sound layer.
9. Full-tournament drive-through + real-Chrome feel pass.
