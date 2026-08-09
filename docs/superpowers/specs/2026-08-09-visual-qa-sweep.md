# Visual QA sweep — 2026-08-09

Branch `codex/time-of-day-hero`. **Read-only sweep**: no source file was touched.

Jayden: *"I don't know if you are checking for the visual glitches and heads out of place …
a lot of discrepancies, or heads in places they don't look good."* He is right. This is a
**looking** pass, not a measuring pass. Every finding below is backed by a real screenshot
from a verified capture instrument, and two candidate findings were **deleted** after looking
at them properly (§5).

All screenshots: `/Users/jaydenbetts/Downloads/visual-qa-2026-08-09/`
(kept outside the repo so nothing but this document enters git).

---

## 1. Answers up front

| | |
|---|---|
| **Worst thing found** | On a phone (390px), the hero portrait on **index.html** is sliced flat by the left edge of the screen, and its selection frame — the permanent one that is the design — is missing its left edge and has two amputated corner handles. This is the home page, first frame, every load, every time-of-day state. |
| **Where** | `index.html` @390, all 7 states. `#face` left edge measured at **−92px to −76px** across 12 samples over 4s; head ink (per `data-head-bounds`) starts at **−42px**, so ~25% of the head is off-screen. |
| **Second worst** | Returning to the lobby after **any** game (soccer End, natural match finish, tournament exit) leaves the visitor on the games-cards view with head crowns sliced by the top edge and **head-shaped shadows with no head attached** floating beside the header pill. |
| **Findings by severity** | **1 critical · 6 high · 6 medium · 4 open questions** (13 defects, 4 questions) |
| **Cleared, not filed** | 2 things that looked wrong in a still frame and were not (§5). |

Coverage: `index`, `about`, `play`, `headmaker`, `gradientlab`, and all five case studies
(`apollo`, `bearings`, `cluster`, `strata`, `ucdavis`) at **1440 / 1280 / 390**, light and dark,
across the seven time-of-day states on `index`. Play was driven through lobby → games cards →
team picker → kickoff → mid-play → goal → post-goal → resumed play → End, plus natural match
finish, tournament fixture + draw, marble race, Floor-is-Lava, **and the return to the lobby
from each**, at head counts 0, 1, 5, 6 and 12.

---

## 2. The instrument (read this before disputing a finding)

The embedded Browser pane renders at the wrong scale on ink-filter pages, which is why this gap
existed. This sweep used **Playwright**, reusing the launch flags from `tools/performance-probe.py`
(`--force-device-scale-factor=1`, backgrounding and timer throttling disabled), serving the
worktree root over **`http://127.0.0.1`** — never `localhost`, and never a server rooted elsewhere,
so `images/` resolves.

**Fidelity was proven before any finding was filed.** Method: measure a real element's
`getBoundingClientRect()`, stamp a pure-magenta rectangle at those exact viewport coordinates,
screenshot, then read the PNG back and check where the magenta actually landed.

```
viewport 1440 -> innerWidth=1440 dpr=1 zoom=1   png 1440x900
  .hero h1  dom=(432,261 576x40)  leftEdgeErr=0  topEdgeErr=0  OK
viewport 390  -> innerWidth=390  dpr=1 zoom=1   png 390x844
  .hero h1  dom=(16,311 358x40)   leftEdgeErr=0  topEdgeErr=0  OK
FIDELITY: PASS
```

Zero pixels of error on both axes at both widths. The screenshot's coordinate space **is** the
DOM's coordinate space; there is no hidden scale factor. Screenshots: `fidelity-probe-1440.png`,
`fidelity-probe-390.png`.

Jayden's real Chrome was never touched — no `mcp__claude-in-chrome__*` call was made, and every
page ran in a throwaway Playwright context, so `hmCompanions` / `hmCompanion` in his profile were
never read or written. Head counts were seeded with `window.__hmPlaceholderCount` before boot,
which is the harness path `tools/play-browser-smoke.py` already uses.

**Timing artefacts, called out where relevant.** The machine is under load from four other agents.
That moves *when* things happen, not *where* they land, so layout findings are safe. Two things
were affected and are labelled as such: `gradientlab.html` timed out once on a 30s page load and
passed cleanly on retry (load timing, not layout), and §4.3 is a moving head caught in one frame.

---

## 3. Defects

### 3.1 — CRITICAL · `index.html` @390, all 7 time states · the hero portrait is cut off by the screen edge

**Screenshot:** `crop-index390-hero.png` (2× crop), full frame `index-hero-390-late.png`,
also visible in `fidelity-clean-390.png`.

The portrait sits so far left that the left side of the hair and cheek is **sliced flat by
`x = 0`**. Worse, the selection frame — the permanent one that is the design — breaks with it:

- the frame's **left edge line is absent**; the rectangle renders as an open three-sided box
- the **bottom-left corner handle is off-screen**, only its right half visible at `x = 0`
- the **top-left corner handle is half-clipped**

Measured over 12 samples across 4 seconds (so this is not a float phase):

| viewport | `#face` left | `#heroHeadSelection` left | head-ink left |
|---|---|---|---|
| 390 | **−92 … −76** | 0 (clamped) | **−42** |
| 1280 | 252 … 263 | 291 … 298 | ~308 |
| 1440 | 334 … 341 | 369 … 376 | ~390 |

The selection frame is clamped to `0` while the head is not, which is why the head escapes it.
Pixel confirmation: column `x = 0` carries dark head ink for 51 consecutive rows (y 569–619).

**Reproduces:** every load, 100%. Theme-independent (the frame and the crop are the same in all
seven states). **Recruiter exposure: maximum** — this is the home page on a phone.

---

### 3.2 — HIGH · Play, after **every** game · returning to the lobby leaves orphan shadows and sliced heads

**Screenshots:** `crop-orphan-shadow.png` (3× crop — the money shot),
`crop-return-heads.png`, full frames `pm-soccerfinish-1440-h5-daytime--23-finish+1500ms.png`,
`…--26-finish+3000ms.png`, `pm-tournament-1440-h5-daytime--t51-return+5s.png`.

Ending a game returns the visitor to the **games-cards** view (the page is still scrolled to
`#games` from the launch click), and the heads go home to lobby positions that are **above the
top of the viewport**. What a visitor actually sees:

- **at +1.5s: a head-shaped grey shadow floating in empty page space to the left of the header
  pill, with no head above it.** A shadow that does not belong to any head on screen. There is a
  second smudge tucked under the header's left shoulder.
- **at +3s: green head crowns sliced flat by the top edge** across x ≈ 220–1320, with detached
  grey shadow blobs sitting *below* them, half-hidden behind the header pill.
- the heads then bob in and out of that top sliver indefinitely — sampled at +1s, +3s, +6s and
  +11s, head tops sit at **y = −83 … −105** every time.

**Reproduces:** 4 for 4 — soccer `End` control, natural match finish (`__hmSoccerEnd`),
tournament exit, at 1440 daytime, 1440 night and 390. This is the closest match in the sweep to
what Jayden reported. **Recruiter exposure: high** — it is the state you land in after playing.

---

### 3.3 — HIGH · Team picker @1440 · one head is on a different plane and has no shadow

**Screenshot:** `crop-picker-stage.png` (2.4× crop), full frame
`pm-soccer-1440-h5-daytime--02-team-picker.png`.

Five heads stand on the picker stage. Four share a contact-shadow line at y ≈ 480. **The
rightmost (blue) head sits ~71px lower, past the end of that line, and casts no contact shadow
at all.** It reads as a head that fell off the shelf. A second head (2nd from left) sits ~35px
low but does keep its shadow.

This is the shape of the "wrong placement mode carried across a transition" suspicion: the
lobby places by angle on a sphere, the picker stage is a flat row, and one head is clearly not
obeying the row.

**Reproduces:** every picker entry observed (1440 daytime, 1440 night, 390).
**Recruiter exposure: high** — the picker is the front door to the soccer match.

---

### 3.4 — HIGH · Team picker · the roster and the stage disagree about who is playing

**Screenshot:** `crop-picker-roster.png` (2.4× crop), full frame as above.

- The roster shows **6 players** (RED 3 · BLUE 3). The stage above it shows **5 heads**.
- **Mini-Jayden is in the roster and not on the stage.**
- His roster thumbnail is a **different photograph** — a smiling head — from the serious head
  that plays the match. Same person, visibly different image, side by side with the heads that
  do match themselves.

**Reproduces:** every picker entry. **Recruiter exposure: high.**

---

### 3.5 — HIGH · Soccer, **night** theme @1440 · the goal nets disappear

**Screenshot:** `pm-soccer-1440-h5-night--05-midplay.png`.

In daytime both goals render as a visible cross-hatched net with a coloured post. In night the
net mesh is drawn light-on-near-black and vanishes: **each goal is reduced to a single coloured
vertical bar at the extreme screen edge** (red at x 0–3, blue at x 1400) with a stray horizontal
stub. They no longer read as goals; they read as two stray lines.

The same frame shows the reflection plane as **5–6 hard horizontal seams running the full 1440px
width** under the players — far more visible against black than against white. Reads as scan
lines, not as a pitch.

**Reproduces:** every night match sampled. **Recruiter exposure: high** — night is one of seven
states and the only dark one.

---

### 3.6 — HIGH · Soccer @1440 (light) · both goals clipped, match confined to the bottom third

**Screenshots:** `pm-soccer-1440-h5-daytime--05-midplay.png`, crop `crop-soccer-left.png`.

- Both goals are **cut by the viewport edges** — the left goal's outer half is past `x = 0`,
  the right goal's past `x = 1440`.
- The **"GOAL Blue" toast overlaps the left goal's net**, sitting on top of the post.
- Every player, the ball and both goals occupy y ≈ 390–680. **The top 380px of the screen is
  empty white** apart from a floating scoreboard. At 1440×900 the match uses roughly a quarter
  of the frame.

Note: recent commits (`Both ends of the pitch get the same licence`, `The pitch was a head
shorter on the right`) suggest another agent is already in this area — worth checking against
their work before acting.

**Reproduces:** every 1440 match sampled.

---

### 3.7 — HIGH · Soccer @390 · goals clipped both sides, players jammed, ball detached

**Screenshot:** `pm-soccer-390-h5-daytime--05-midplay.png`.

Both goals are clipped by the screen edges. All six players are compressed into a ~250px band
with two heads overlapping heavily at the left. **The ball sits alone in mid-air at (355, 360)**
— far above the plane of play, near the right edge, with nothing near it. The scoreboard floats
in isolation at y 200–310 with a 450px blank band above the pitch.

(The scrum itself is a feature and is not being filed. The clipped goals, the airborne
detached ball and the empty upper half are.)

**Reproduces:** every 390 match sampled.

---

### 3.8 — MEDIUM · Tournament fixture screen @1440 · uneven head row, one head marooned, two with no shadow

**Screenshot:** `crop-tour-heads.png` (1.9× crop), full frame
`pm-tournament-1440-h5-daytime--t05-+6000ms.png`.

On the "Apollo Cup / Quarter-final" card:

- Six heads cluster between x 445 and 925, then **one lone red head is marooned at x 1080–1175**
  with a 155px gap and nothing around it.
- The **leftmost (purple) and the marooned (red) heads cast no contact shadow**; every head
  between them does.
- **Stage colours do not match the draw.** The draw lists eight players with magenta, green,
  yellow, blue, teal and cyan chips. The stage shows only red and purple heads — 2 purple, 4 red.
- **Mini-Jayden is the only untinted head** on a screen where colour means team.
- Head sizes vary visibly across the row (smallest ~104×133, largest ~152×164).

This screen is static — it is a fixture card, not a match — so the clustering here cannot be
excused as chaos-by-design.

---

### 3.9 — MEDIUM · Games-cards view · head crowns and grey smudges in the strip above the header

**Screenshot:** `crop-cards-top.png` (1.7× crop), full frame
`pm-soccer-1440-h5-daytime--01-games-cards.png`.

Scrolling to the games cards leaves a ~17px sliver of green head crowns sliced by the top edge,
plus a second row of blurred grey reflection smudges sitting under the header pill's shoulders.
Together they read as debris around the chrome rather than as a crowd below it. Same strip
appears in §3.2, which makes it the frame a visitor sees both on the way in and on the way out.

---

### 3.10 — MEDIUM · `bearings.html` @390 · carousel toolbar wider than its column, forward button clipped

**Evidence:** `static-audit` row for bearings/390 —
`DIV.playerBar.carousel-toolbar l=16 r=428 w=412` inside a **358px** parent
(`.player.dv.dvb` → `.subBlock` → `.sec` → `.content`, all `overflow-x: visible`), with
`BUTTON.sbBtn.ctl.ctl--internal l=376 r=420` and its chevron `polyline l=393 r=404`.

The toolbar is **412px wide in a 390px viewport**. Its forward button spans 376–420, so only
~14px of a 44px control is on screen; the chevron inside it is entirely past the edge. Two
instances on the page (document Y 8343 and 9914).

Worth noting as an instrument lesson: `documentElement.scrollWidth` reported **390** (no
overflow) while the full-page capture came out **428px wide**. The measurement said fine; the
picture said otherwise.

---

### 3.11 — MEDIUM · Marble race @1440 · roster thumbnails wrong, numeral over a head, track invisible, inconsistent End button

**Screenshots:** `pm-race-1440-h6-daytime--r01-+1500ms.png`, `…--r03-+4000ms.png`,
`…--r06-+10000ms.png`.

- **All six leaderboard rows show the same mini-Jayden thumbnail**, while every racer on the
  track is a green egghead. The roster does not depict the racers. (Same class of bug as §3.4.)
- The position numeral **"1" is drawn over the third racer's mouth** (x ≈ 710–732).
- The track is **near-invisible** — faint white circles and two barely-there diagonal hairlines —
  while a single solid black bar spans the entire 1440px width and is **drawn on top of the
  leading racer's chin**. High-contrast furniture over low-contrast track reads as a stray rule.
- At +4s the arena is essentially empty: two crossed purple sticks and four outline circles.
- The **"End" button is red text on white**, top-left. Every other End control on the site is a
  dark chip. Inconsistent chrome.
- The race occupies the upper-left quadrant; ~60% of the viewport is blank.

**Recruiter exposure: low** — the race is not reachable from the games menu.

---

### 3.12 — MEDIUM · Floor-is-Lava @1440 · lava stops short of the bottom; a hairline runs through the HUD

**Screenshot:** `pm-battle-1440-h6-daytime--b05-+12000ms.png`.

The lava band ends at **y ≈ 718** with a **~180px strip of plain white beneath it** to the bottom
of the viewport. Lava that does not reach the floor reads as an unfinished layer, not as a hazard.

Separately, a platform hairline **passes straight through the "2 left / End" HUD chip** — the rule
enters at x 507 and exits at x 830, visible on both sides of a panel that should occlude it.

---

### 3.13 — MEDIUM · Lobby @12 heads @1440 · a head lying on its side, balanced on another head

**Screenshot:** `crop-h12-tilted.png` (2.6× crop), full frame
`play-lobby--h12--daytime--1440.png`.

A head tipped ~80° onto its side rests on the crown of the head below it, and the tipped head
casts no shadow of its own while the one beneath does. Measured overlap 49% (slots 4 and 8).

**Caveat, stated honestly:** this head is in motion — its bottom edge swings 98px over a 4s
sample — so this is a moving head caught in one frame, and the tumble may well be intentional
(memory: *soccer chaos is the point*). Filed as medium because a still frame of the lobby is
what a recruiter sees while reading the headline, and in that frame it reads as a bug.
**Head count matters:** at 0 and 1 heads (the first-visit default) the lobby is clean.

---

## 4. Open questions — filed as questions, not defects

**4.1 — Is the hero head meant to sit this far left at 1440?**
`#face` centre lands at **x ≈ 484** against a viewport centre of 720 — 236px left of centre, and
well below the headline, in a hero whose gradient light source is centred. The container is
called `heroCharacterPeek`, so an off-centre peek may be the whole idea. But at 1440 the right
half of the hero is empty and the composition reads lopsided rather than deliberate.
`index--daytime--1440.png`, `crop-index1440-hero.png`. **(At 390 the same placement is a
straightforward defect — §3.1.)**

**4.2 — Is the scoreboard's "End" glyph meant to be a hollow square?**
`crop-board-end.png` (4× crop). It renders as an empty outlined square next to the word "End".
The markup is a rounded-rect stop icon, so it is intentional — but at ~12px it reads as tofu / a
missing glyph, which is not what you want on the one control that ends the match.

**4.3 — Are the case-study "Chapters" rails meant to be unlabelled dashes?**
`apollo--night--1440.png` and `apollo--daytime--1440.png`. `aside.rail.hush > nav.chapters > a.chap`
— links are 101px wide but render as bare ~26px dashes with no visible text, stacked in the left
page margin. `.hush` suggests reveal-on-hover, which would make this correct. At rest, and
especially against the night background, five floating dashes in dead margin read as debris.

**4.4 — Should the picker roster tiles crop their heads differently?**
`crop-picker-roster.png`. The egghead thumbnails bleed to the bottom edge of their tiles with
their chins cut, while mini-Jayden's thumbnail floats centred with generous margin on all sides,
in the same row. Not obviously wrong, but the two treatments are visibly inconsistent.

---

## 5. Checked and **cleared** — do not chase these

Both of these looked like defects in a still frame. Looking properly killed them, and they are
recorded so nobody re-files them.

**5.1 — "The first-visit lobby head floats ~50px above its shadow."**
False. `crop-h1-float.png` looked convincing. A four-frame burst
(`lobbyh1-crop-0…3.png`) shows the head bobbing and the shadow correctly staying put — at the
bottom of the bob the head sits directly on it. A bob is not a floating head. **Not a defect.**

**5.2 — "Reflections survive their heads' removal in Floor-is-Lava."**
False, and instructive. A raw `querySelectorAll('.hmRefl').length` showed heads dropping 6 → 4 → 2
while reflections stayed at 6, which looks exactly like orphaned reflections. Re-running the
same probe **with a visibility filter** shows `reflVisible: 0` from the moment battle starts —
every reflection is correctly hidden. The nodes persist; the pixels do not. **Not a defect.**
This is the same failure mode the sweep was commissioned to correct, just pointing the other way:
a count is not a picture.

Also deliberately **not** filed, per the brief: the soccer scrum and clumping (a feature),
mini-Jayden's 1.5× size in the lobby (intentional), and the permanent selection frame around the
hero portrait (the design — §3.1 is about the frame being *broken*, not about it existing).

---

## 6. Suggested order of work

1. **§3.1** — home page, phone, first frame. Nothing else on this list costs as much.
2. **§3.2** — the state a visitor lands in after playing; also fixes half of §3.9.
3. **§3.3 + §3.4** — the team picker is the front door to the match, and both are one screen.
4. **§3.5** — night is a first-class state and the goals currently vanish in it.
5. **§3.6 + §3.7** — pitch framing at both widths; coordinate with whoever owns the recent
   pitch-width commits before touching this.
6. Everything else.
