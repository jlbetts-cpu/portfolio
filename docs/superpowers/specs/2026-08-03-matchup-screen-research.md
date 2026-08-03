# The match-up screen on a full viewport — research

**Date:** 2026-08-03 · **Status:** research only. **No existing file was edited.**
`play.html`, `play.css`, `play-tournament.js`, `play-engine.js`, `play-games.js`,
`hero-engine.js`, `index.html`, `tokens.css` were read, never written.

**Ask (Jayden), in two parts.** The original:

> "we can use the whole screen now since it's its own screen, so researching how to
> make the match-up screen better and more optimized would be great."

And then, after watching it run on the full-viewport page:

> "the scrolly on the player matchup looks horrible and makes it feel so out of
> place. I think reorganizing with player matchup on the left, schedule on the
> right, so you can see more and it be cleaner. also it should reflect the design
> system token as well. and the mini heads should be there — like the team that's
> about to play should be in that screen hanging out around the bottom like it
> would be on the home screen."

The second message is treated as settled and this document is designed **to** it,
not around it. Four things are taken as given: **two columns (match-up left,
schedule right)**, **the live companion heads on stage**, **the token layer**, and
**"see more" as the reason the two columns exist.**

Every number below was computed from the real files. Where a number appears it was
measured, not estimated. Where something Jayden asked for is more expensive than it
looks, it is said plainly with the cost attached — §8.

**One correction to the original brief, because two later sections depend on it:**
the tournament is **no longer in `index.html`**. It was extracted to
`play-tournament.js` (1,132 lines) — `grep __hmTourStart index.html` → 0. The
`index.html:7703-8582` reference is stale; `index.html` is now 6,718 lines and
retains only the tournament's **dead CSS** (65 `.tourPanel`/`.tCup*` matches from
`index.html:1125`) for markup it can no longer build. Every reference below is to
`play-tournament.js`, `play.css`, `play-engine.js` and `play.html`, verified today.

---

## 0. The answers, up front

| Question | Answer |
|---|---|
| **The structure** | **Three bands, not three zones.** An identity strip, a two-column body (fixture left, cup ledger right), and — under both — **the ground**, where the two squads about to play stand and wander. The columns end at **58svh**; the bottom 42svh holds no UI at all. |
| **The single most important thing to leave OFF** | **The large static portraits.** `.tCupPanel` at `clamp(152px,26vh,272px)`, `.tCupBigWrap`, the poster's `--hw:46%` heads. The moment the real heads are standing on the screen, a big picture of those same heads is a duplicate of the subject competing with the subject. The stage becomes the depiction; the column becomes the print. |
| **Biggest container assumption a full viewport breaks** | **`--tourShift`** (`play-tournament.js:933`, consumed `play.css:934,936`). It measures `hero.getBoundingClientRect().top + window.scrollY` to clear `index.html`'s nav. `play.html` has no nav and cannot scroll, so it degenerates to *half the leftover viewport* — **180px at 1440 × 900** — and is spent twice: once dragging the panel to y=0, once as blank padding inside the capsule. That is the scrollbar Jayden is looking at. §1.3. |
| **Where the ground line already is** | **75.7svh at 1440 × 900**, and 75–76svh across every desktop size; ~80svh on a phone. `body.hmFull` is permanent on `play.html` (`play.html:48`), which forces `fY = FLOORCAP` in `survey()` (`play-engine.js:369`). **The heads are already standing exactly where Jayden wants them.** No engine change. §3. |
| **The thing that will bite** | The heads and the schedule want the same pixels. Standing heads occupy **61 → 76svh** desktop, so the columns cannot run past ~58svh, which leaves the right rail **~423px** at 900 tall. A flat 12-fixture list needs 658px. The rail therefore has to be **round-grouped sub-columns**, not a list — which fits in 392px and is also the shape the 16-slot bracket wants. §4.3, §8.1. |
| **Prerequisite, not optional** | `play.html` **loads no webfonts and no tokens.** One `<link>`, to `play.css`, which has zero `@font-face` and none of the 2026-08-02 token layer. Instrument Sans *and* Archivo currently fall back to system-ui on the Play page. §1.7, §1.10. |

---

## 1. What the current UI assumes about its container, and what breaks

The tournament capsule was designed as **a 460px column inside a scrolling
portfolio page, under a nav bar, above a tab row.** Four of those five words are
now false. Each assumption, its line, and what it produces.

### 1.1 It assumes it is a column, not a screen

```css
body.hmTour #tourPanel{ … width:min(460px,calc(100vw - 40px))!important; … }   /* play.css:937 */
.tCup{width:min(420px,92vw); … }                                              /* play.css:987 */
```

`460px` is a magazine measure chosen when the capsule shared a page:

| Viewport | Capsule width | Share of viewport | Empty gutter each side |
|---|---|---|---|
| 1920 × 1080 | 460px | **24.0%** | 730px |
| 1440 × 900 | 460px | **31.9%** | 490px |
| 1280 × 800 | 460px | 35.9% | 410px |
| 390 × 844 | 350px | 89.7% | 20px |

Desktop is 68–76% unused horizontally while the content overflows vertically. That
is the exact shape of problem a second column solves, and it is why Jayden's
instinct is right: **the content is not too big, it is the wrong aspect.**

### 1.2 It assumes a nav bar and a tab row exist

```css
body.hmTour nav{position:relative;z-index:60}                 /* play.css:926 */
body.hmTour #cases{z-index:63}                                /* play.css:932 */
body.hmTour .csTabs{position:relative;z-index:55}             /* play.css:933 */
body.hmTour nav .faceMoodCorner,
body.hmTour nav #navAbout,
body.hmTour .navDrawer #ndAbout{display:none!important}       /* play.css:756-758 */
body.hmTour .heroCopy h1{opacity:0; …}                        /* play.css:411 */
```

`nav`, `#cases`, `.csTabs`, `.navDrawer`, `#navAbout` and `.heroCopy` **all appear
0 times in `play.html`.** Six rules, all inert. The same in JS: `syncHero()` reads
`document.querySelector('.csTabs')` (`play-tournament.js:947`) to find the tab row
it must stop above, gets `null`, and falls back to `heroBottom` for both anchors
(`:949-950`). The measuring code is correct; it is measuring a page that is not
there.

### 1.3 It assumes the page scrolls — this is the one Jayden is seeing

`syncHero()` (`play-tournament.js:921-979`):

```js
var shift = Math.max(0, Math.round(hero.getBoundingClientRect().top + window.scrollY));
document.body.style.setProperty('--tourShift', shift + 'px');
```

The comment at `:932` is explicit that `rect + scrollY` is used *because* it is a
document coordinate and therefore scroll-invariant. On `play.html` the page cannot
scroll — `html,body{overflow:hidden}` (`play.html:9`) plus `body.hmFull{overflow:hidden}`
(`play.css:227`) — so `window.scrollY` is permanently `0` and `--tourShift`
degenerates into "distance from the top of the viewport to the arena band", which
is 20vh because `.hero` is `height:60vh; margin:auto` (`play.html:29`).

Then it is spent twice:

```css
body.hmTour #tourPanel{ top:calc(-1 * var(--tourShift,0px))!important; bottom:0!important; }  /* play.css:936,945 */
body.hmTour #tourPanel .tCup{padding-top:var(--tourShift,0px)}                                /* play.css:934 */
```

At 1440 × 900:

| | value |
|---|---|
| `.hero` | 540px tall, top y=180, bottom y=720 |
| `--tourShift` | **180px** |
| `#tourPanel` | y = 0 → 720, width 460 |
| `.tCup` inline `min-height` (JS, `:951`) | `720 − 0` = **720px** |
| blank padding inside the capsule's top | **180px** |
| empty page below the capsule | **180px** |
| capsule area actually carrying content | 460 × 540 = **19.2% of the viewport** |

A 460 × 720 white card running off the top edge, with a 180px empty band inside its
top and a 180px empty band under its bottom, and content that overflows it anyway.
**That is not a composition; it is an arithmetic residue** — and it is the direct
cause of the thing Jayden called horrible. The scrollbar is a symptom of a layout
that inherited a nav-clearance offset from another page.

### 1.4 It assumes overflow beyond the fold is reachable

```css
.tourPanel{ … max-height:calc(100% - var(--heroTitleTop,40px) - 24px)}   /* play.css:363 */
body.hmTour #tourPanel{ … max-height:none!important; … }                /* play.css:940 */
```

The base rule self-constrains to the arena; the `hmTour` rule **removes the cap**
with `!important` on the stated grounds (`play.css:938-939`) that "as a full-bleed
block that cap is just a smaller ceiling to be clipped against" — true on a page
that scrolls, false on one that cannot.

There is a **second** scroller nested inside it: `.tCupSchedIn`'s inline
`maxHeight`, computed by ~25 lines of row-snapping arithmetic
(`play-tournament.js:958-976`). So the current screen can present **two** scroll
surfaces. Per the brief, another agent owns the page-scroll fix; the assumption to
delete is *"a block taller than the screen is a block you scroll to"*, and §4
removes both scrollers rather than sizing them.

### 1.5 `--heroTitleTop` is never defined on `play.html`

Consumed four times in `play.css` (`:149` scoreboard, `:245` countdown, `:360` and
`:414` the panel) and **defined nowhere** in `play.html` or `play.css`. It is set on
`index.html`'s `.hero` (`--heroTitleTop:var(--sp-16-40)`; `24px` under 760px). Every
consumer on the Play page silently takes the literal `40px` fallback baked into each
`var()`. It is a token that looks like a token and is actually another page's nav
height. Any new vertical rhythm must not be derived from it.

### 1.6 The stadium never renders, and has not for a while

```js
var br = h.querySelector('.tBrMir'); if (!br) return;      // play-tournament.js:584
```

`.tBrMir` is **never created by `paint()`** — it appears exactly once in
`play-tournament.js`, at line 584, as the thing being looked for. `paintStadium()`
bails on its second line every call, so the perspective pitch plane and the
three-tier photo crowd (`:582-630`, 33 `.tFan` elements) have **never drawn on
`play.html`**. Their CSS is live (`play.css:598-648`, `:1433`) and dead.

Two consequences: do not budget the crowd as an existing asset; and
`.tFan{filter:grayscale(1) contrast(.5) brightness(1.28) blur(var(--fb,0px))}`
(`play.css:1433`) is a **per-element blur on up to 33 elements** that should not be
revived on this screen (§7).

### 1.7 It assumes the host document loads the fonts

`play.html` has one stylesheet link (`play.html:5` → `play.css`). `play.css` has
**zero `@font-face` rules**. No font `<link>`, no `FontFace` construction in
`hero-engine.js`, `play-engine.js`, `play-games.js` or `play-tournament.js`. The
site's only `@font-face` declarations are inline at `index.html:642`.

So on `play.html`:

- `--sans:"Instrument Sans",-apple-system,system-ui,sans-serif` (`play.css:20`)
  resolves to **system-ui** for anyone without Instrument Sans installed locally.
- `.bcNum{font-family:'Archivo',var(--sans)}` (`play.css:305`) — the broadcast
  numeral class, the whole point of the two-tier type system, the thing
  `specimen.html` was built to choose — resolves to **the same system font**. The
  score stamps on the schedule tickets (`play-tournament.js:1065`) are rendering in
  SF Pro.

Jayden's "it should reflect the design system token as well" cannot be evaluated
until this is fixed, because half of what he would be judging is the wrong face.
Both files are already in `fonts/`.

### 1.8 It assumes the visitor can leave

```js
if(document.body.classList.contains("hmTour")){closeM();return;}   // play-games.js:64
```

Opening the Play menu is a hard no-op for the whole duration of a cup, matching the
`aria-disabled` on `#moodBtn` (`play-tournament.js:1094-1096`). On `index.html` this
was a guard — the rest of the portfolio was still there, one section down. On
`play.html` **the tournament is the page**, so disabling the page's only global
control leaves the capsule's own `End tournament` button and the browser Back
button. A guard has become a trap; it needs replacing with a scoped exit that
belongs to the tournament (§4.2).

### 1.9 It assumes vertical sizes can be derived from `vh`

`.tCupPanel{height:clamp(152px,26vh,272px)}` (`play.css:1022`) and the poster's
`max-height:min(52vh,470px)` (`play.css:789`) size against the **viewport** while
living inside a container that is 60vh of it. At 900 tall the poster caps at 468px
inside a 720px block — it fits by luck, not by relation. Once the stage is the
window's child, every `vh` in the capsule must become a fraction of the stage.

### 1.10 The token layer has not reached this page

`play.css` defines its own `:root` (`:19-20`) with the colour ramp, `--fs-*` and
five `--lh-*`. It has **none** of the 2026-08-02 layer: `--r-md` 0 uses, `--mat-1`
0, `--rim-1` 0, `--sp-settle` 0, `--tr-caps` 0, `--lh-auto` 0, `--tap-min` 0.
`tokens.css` exists but `play.html` does not link it, and `tokens.css`'s own header
says exactly that.

So Jayden's third ask has a mechanical prerequisite before it has a design one:
**`play.html` must link `tokens.css`.** What happens after that is §5.

### 1.11 What the "versus poster ceremony" actually renders

Worth stating plainly, because the shipped screen is not the screen the spec
describes. In the poster path — which is *every* fixture, since `isFin || isMatch`
is true whenever there is a next match (`play-tournament.js:736-739`):

```css
body.tourPoster #tourPanel .tCupTint{display:none}     /* play.css:819 */
body.tourPoster #tourPanel .tCupMeta{display:none}     /* play.css:836 */
body.tourPoster #tourPanel .tCupVs  {display:none}     /* play.css:837 */
body.tourPoster #tourPanel .tCupPanel{ … background:none; … }   /* play.css:798-800 */
```

The match-up screen is: **artwork, two captains' heads absolutely positioned into
the artwork's empty cloud banks, two names underneath.** The VS glyph is hidden.
The team-colour panels are hidden. The team tint is hidden. The per-side meta block
is hidden.

**Team colour — the identity spine of every other broadcast surface (the ring, the
nets, the chips, the split-flap plate edge, the confetti) — is not present on the
match-up screen at all.** That is the most surprising finding in this audit, and
§4.2 puts it back.

---

## 2. What changes when the real heads are on the screen

Jayden's third instruction is the one that reorganises everything else, so it goes
before the layout rather than after it.

### 2.1 The idea, and why it is the strongest of the four

> "the mini heads should be there — like the team that's about to play should be in
> that screen hanging out around the bottom like it would be on the home screen."

This makes the pre-match screen **continuous with the match instead of a document
about it.** Three things fall out of it, and they are worth more than the idea
costs:

1. **The squads are already on stage when play starts.** Today `startFixture()`
   spawns them and waits 620ms before `__hmSoccerStart()`
   (`play-tournament.js:516-522`) — a pop-in that exists only because they were not
   there a moment earlier. Move the spawn to the match-up phase and the kickoff
   transition has nothing to hide.
2. **It is the versus ritual the broadcast spec already asked for**, performed by
   the real objects instead of depicted by a card. Spec beat 2: *"Heads slide in
   from opposite edges on the motion axis, landing with a contact-shadow thud."*
   That is a description of these heads walking on, and the engine already has
   toss-in, contact shadows and `__hmFX`.
3. **It deletes the biggest element on the screen.** If the players are standing
   there, the 152–272px portrait panels are a picture of the thing next to the
   thing. §4.1.

### 2.2 Where the ground line already is — measured, and it is good news

`survey()` (`play-engine.js:348-379`) computes one shared feet plane:

```js
var FLOORCAP = heroR.h - (mob?64:108)*0.34 - 2;                  // play-engine.js:363
…
if(document.body.classList.contains("hmFull")) fY = FLOORCAP;    // play-engine.js:369
window.__hmFeetY = fY;                                           // play-engine.js:371
floorY = fY - HH*FOOT;                                           // play-engine.js:372
```

**`play.html` carries `class="hmFull"` permanently** (`play.html:48`), so the
`hmFull` branch always wins and the feet plane is always `FLOORCAP` — a pure
function of `hero.clientHeight`. `.hero` is `height:60vh; margin:auto`
(`play.html:29`), 65vh under 760px (`play.css:226`). Resolved:

| Viewport | `.hero` h | `FLOORCAP` | feet, in viewport px | feet, as %vh |
|---|---|---|---|---|
| 1920 × 1080 | 648 | 609.3 | 825.3 | **76.4%** |
| 1440 × 900 | 540 | 501.3 | 681.3 | **75.7%** |
| 1280 × 800 | 480 | 441.3 | 601.3 | **75.2%** |
| 390 × 844 (mob) | 548.6 | 524.8 | 672.5 | **79.7%** |

**The heads already stand at 75–76svh on desktop and ~80svh on a phone**, stable
across sizes. Jayden's "hanging out around the bottom" is where the engine already
puts them. This costs **zero engine changes** — which is the opposite of what an
ask like this usually costs, and it is worth saying so.

Head size: `nHW = clamp(66,108, (bigR.r − bigR.l) × 0.27)` (`play-engine.js:378`),
where `bigR` is `#stage` inside `.heroHeadHost{width:min(420px,46vw)}`
(`play.html:33`). At ≥913px wide that is `0.27 × 420 = 113 → 108`. `HH = HW × 1.2 =
129.6`. Mobile caps `HW` at 64, so `HH = 76.8`.

So the **standing band** is:

| | crown | feet | band |
|---|---|---|---|
| 1440 × 900 | 551px (61.2svh) | 681px (75.7svh) | **61 → 76svh** |
| 390 × 844 | 596px (70.6svh) | 673px (79.7svh) | **71 → 80svh** |

Plus jump clearance — budget ~8svh above the crown for a hop.

**This is the constraint that sets the whole layout: the columns must end by
~58svh on desktop.** Everything in §4 is arithmetic against that number.

### 2.3 The planet, and the one selector that should change

The planet-pitch research settled **render-curved / physics-flat**: one `arcY(x)`
addend at render time, six call sites, `SAG = clamp(0.020 × pitchWidth, 12, 30)`,
gated on `body.hmSoccer` because that was Jayden's "just on the pitch".

With the squads standing on the match-up screen, that gate is now wrong by one
class. If the ground curves at kickoff but not thirty seconds earlier, the
transition into the match contains a visible ground snap — which is exactly the
seam the live heads are there to remove.

**Recommendation: gate the arc on `body.hmTour, body.hmSoccer`** rather than
`hmSoccer` alone. Cost: one selector. The research's own kill criterion still
applies — `SAG = 0` is a byte-for-byte revert — so this is safe to ship behind the
same variable. Do **not** extend it to lava/battle/race; lava already owns an
x-varying surface (`__hmLavaY`, `play-engine.js:2599`) and the two would fight.

The rest of that research transfers unchanged: the rim light on the horizon is the
strongest "this is a planet" cue, the ball's centre-drift term is the strongest
felt one (and the ball is not on screen yet at match-up time, so it stays a
kickoff-onward effect).

### 2.4 The mechanism — what actually has to move in the code

Today:

```js
function between(){ clearSpawned(); benchAll(); … T.phase='bracket'; paint(); }   // :538-553
function benchAll(){ … }   // "between fixtures nobody is on the pitch: the bracket screen is not a scene"  :533
function startFixture(nm){ … spawn both squads, set __hmTeamSel/__hmTeamCol/--tcol1/2 … }  // :470-523
```

The comment at `:533` — *"the bracket screen is not a scene"* — is precisely the
assumption Jayden is overturning. The change is a **move, not a rewrite**: the
spawn-and-select block (`play-tournament.js:480-513`) runs when the fixture becomes
*known* rather than when it becomes *live*.

```
between()  →  nextMatch()  →  cast(nm)          ← spawn + bench + team colours + --tcol1/2
           →  T.phase='matchup'  →  paint()
Kick off   →  __hmSoccerStart()                 ← no spawn, no 620ms wait
between()  →  clearSpawned() for the PREVIOUS fixture only
```

Four things to get right, all of them already visible in the current code:

- **`clearSpawned()` moves later.** It must run at the *start* of the next
  `between()`, not before the next cast, or the squads are killed the moment they
  arrive. `T.spawnedCuts` is already the right ledger (`:494`, `:525-531`).
- **`__hmSlotFor(p.cut)` dedupe still applies.** The comment at `:332-335` records
  the real bug: two eggheads dyed the identical colour produce the identical data
  URL and the second never spawns, logging its touches against team 0 as an own
  goal. `shade()` already separates squad-mates; nothing changes, but nothing may
  be simplified either.
- **`--tcol1/--tcol2` land earlier**, on `documentElement` (`:487-491`). That is a
  *benefit*: the left column's colour bars (§4.2) can read them, so the screen's
  colour and the pitch's colour are one source.
- **`hmFinal` toggling** (`:475`) moves with the cast, so the final's gold ball and
  paint are on before the final's match-up screen rather than after it. Correct.

### 2.5 Squad size: 1 head or 6, same layout

`perTeam()` is 3 on desktop, 2 on mobile (`play-tournament.js:330`), so a fixture is
normally **6 heads desktop / 4 mobile**. The floor is **2**: if `EGG.cut` or
`__hmTint` is missing, `buildTeams()` fields the captain alone (`:403-405`) rather
than cloning him.

The layout must therefore not depend on the count, which means **no formation and
no lineup row**. The wander AI already distributes 2 and 6 identically across the
arena; that is the behaviour Jayden named ("hanging out … like it would be on the
home screen") and it is the one that degrades for free.

**Do not split them to their kickoff halves.** It is tempting — `__hmTeamSel`
already encodes the side — but two lines of heads facing each other before a match
reads as a lineup, and a lineup is a formal object that then has to survive 2, 4
and 6 heads. Mingling reads as a warm-up. Team identity is carried by the existing
kit colour (`__hmTeamCol`, the ring), not by position. If Jayden wants the split,
it is one line and worth trying — but it is the version that breaks at N=2.

### 2.6 One thing the heads must not do

They must not walk in front of the fixture card. Current z-order: heads at `z:3`
(`plane()`, `play-engine.js:392`), `.tourPanel` at `z:47` (`play.css:360`) — so the
panel already paints over them, and that is correct and should stay. A jumping head
briefly disappearing behind the paper reads as paper being in front of it; a head
crossing the round name reads as a bug. **No z-order change.**

---

## 3. The layout — three bands

```
┌──────────────────────────────────────────────────────────────────────────┐ 0
│  A · IDENTITY STRIP                                                      │  11svh
│  APOLLO CUP · Quarter-final · APL-0102          2 wins to the cup   ← Leave│
├──────────────────────────┬───────────────────────────────────────────────┤
│  B1 · THE FIXTURE        │  B2 · THE CUP                                 │
│                          │                                               │
│   Quarter-final          │   ROUND OF 8        QUARTER-FINAL             │
│   ─────────────────      │   ▸ Maya  v  Gus    ▸ … v …                   │  47svh
│   MAYA          ████     │     Kip   v  Dot      … v …                   │
│      v.                  │     Ozzy  v  Baz    SEMI-FINAL                │
│   GUS           ████     │     Milo  v  Fitz     … v …                   │
│                          │                     THE FINAL                 │
│   They met in Round 1.   │                       … v …                   │
│   Gus won.               │                                               │
│                          │                                               │
│   [ Kick off ]           │                                               │
├──────────────────────────┴───────────────────────────────────────────────┤ 58svh
│  C · THE GROUND                                                          │
│                  ◕   ◕        ◔          ◕   ◕                           │  42svh
│  ═══════════════════════════════════════════════════════════ 75.7svh ════│
└──────────────────────────────────────────────────────────────────────────┘ 100svh
```

**Band A — identity strip, `11svh`.** One line. Cup · round · serial on the left,
distance readout and the exit on the right.

**Band B — the two columns, `47svh` (11 → 58svh).** Split `1fr 1.15fr`, capped at
`max-width: 1180px`, centred. Left: the fixture. Right: the cup ledger.

**Band C — the ground, `42svh` (58 → 100svh).** **No UI at all.** The squads stand
at 61 → 76svh, the planet's horizon runs behind them, and the bottom ~24svh is the
foreground of the world. This is the answer to "where does the empty space go": the
void becomes the stage, and it holds the only moving thing on the screen.

### 3.1 Why the action button is in the left column, not at the bottom

The obvious instinct is a centred `Kick off` at the foot of the screen. It cannot
go there — that is the ground now, and a button floating over the heads' heads is
the "everything crammed at the bottom edge" failure with extra steps.

Putting it at the foot of the **left column** is better on its own terms: it is the
one action, it belongs to the fixture, and it sits at the end of the thing you just
read. One primary action per screen, in the column that owns it.

### 3.2 The checkable composition rules

Four, all testable from the console:

1. **Nothing intersects `top: 58svh → 100svh`** except the arena, the heads and
   their shadows. One rule, and it is what prevents the recorded
   crammed-at-the-bottom failure from recurring.
2. **The columns' bottom edge sits at `58svh` on every viewport**, not at a
   content-derived height. Both columns are the same height; the shorter one has
   air at its foot, not a shrunken box.
3. **The fixture's two names sit between 20svh and 32svh** — the optical centre of
   band B, allowing for the fact that a column's visual mass reads high.
4. **`max-width: 1180px`, centred.** Beyond 1180 the extra width goes to the world,
   not to the columns. At 1920 that leaves 370px each side of pure ground, which is
   correct: the world is the thing that got bigger.

At 1440 × 900 that resolves to: band A 99px, band B 423px (y 99 → 522), band C
378px (y 522 → 900), heads standing 551 → 681. **Held against a screenshot, those
are the numbers.**

---

## 4. What goes in each column — "see more", not "show more"

Jayden's reason for two columns is *"so you can see more and it be cleaner."*
Those pull in opposite directions unless something is thrown out, so this section
is the budget.

### 4.1 Left column — the fixture

**A correction to my own first pass, stated because it matters.** My original
recommendation was to remove the schedule from this screen entirely. Jayden's
answer — move it to a right rail — is better, and for the reason my own diagnosis
should have led to: the problem was never that the schedule was *present*, it was
that it was **stacked underneath**, which is what forced the vertical overflow. A
rail is a different information relationship, not a smaller version of the same
one. I got the diagnosis right and the remedy wrong.

What the left column carries, top to bottom:

| Element | Treatment |
|---|---|
| **Round, in the cup's voice** | `roundName()` (`play-tournament.js:316-323`) at `--fs-h3` / `--tr-sub` / `--lh-auto`. This is the most important text on the screen after the two names, and it is currently `--fs-caption` 12px at `.14em` (`play.css:994`) — a legal-line treatment for the thing that states what is at stake. |
| **Hairline** | `--rim-1` weight. |
| **Side A: thumbnail · name · colour bar** | A 44px captain thumbnail (the same object the schedule ticket uses, `play-tournament.js:1046-1049`), the name at `--fs-h2` / 600 / `--tr-sub`, and a **flat** `--r-hair` colour bar under the name. |
| **`v.`** | Lowercase, with the full stop, on its own line, `--fs-lead`, `--c500`. §6.2. |
| **Side B** | Mirror of side A. |
| **Tale of the tape** | 0–3 lines, `--fs-small`, `--tr-body`, tabular, `--c500`. Real data only. |
| **`Kick off`** | The one primary action. `--r-md`, `--accent`, `--tap-min`. |

**Not in this column:** the large portraits (§0), the trophy, the score, any
prediction, `End tournament`.

**The portraits are the deletion that pays for everything else.** `.tCupPanel` at
`clamp(152px,26vh,272px)` plus `.tCupBigWrap` plus the poster's 46%-wide heads are
the largest objects in the current design, and they exist to answer "who is
playing" — which the six heads standing at 61–76svh now answer better, because they
are the actual players and they are moving. Keeping both is showing the same
information twice at two scales, which is the definition of decoration.

**The tale of the tape is the "see more" that costs nothing.** `__hmSess.pair[key]`
already records `{count, lastWinner}` per captain pairing (`play-tournament.js:445-446`)
and `__hmSess.head[slot]` records `{goals, played, titles}` (`:447-449`). **Both are
written and neither is ever read back.** The best line available — *"They met in
Round 1. Gus won."* — is one lookup away and it is the single most interesting thing
this screen could say. Zero lines is a legitimate state and the column does not
shift, because the spine is a fixed block, not a content-sized one.

Precedent backs the placement: UFC's Tale of the Tape puts both fighters on the
flanks with **all the information in the centre**, delivered *during* the walk-in —
the wait is where you deliver information, not where you withhold it
([Martial Arts Insider](https://martialartsinsider.com/blogs/mma/tale-of-the-tape-ufc)).
Box Out's matchup template is the same shape: split layout, comparative rows
between the sides, flat sectional colour rather than a gradient
([Box Out](https://boxoutsports.com/graphics/gameday/matchup-breakdown)).

### 4.2 Colour: a bar, not a field — and never a blend

Team colour comes back to this screen (§1.11 — it is absent today), but not as a
field.

The project has already recorded that broadcast packages are moving away from
blended two-team gradients toward flat split colours because a blend implies a
winner. Primary reporting confirms it: NBC Sports' 2025–26 NBA package chose **flat
colour specifically to carry team identity**, dropping gradients and layered
treatments because teams wear multiple uniform combinations and consistency across
dozens of palettes was the design problem
([SVG](https://www.sportsvideo.org/2026/04/09/newstalgia-an-in-depth-look-at-how-the-return-of-the-inba-on-nbc-i-was-driven-by-a-bold-and-ownable-graphics-package/)).
Jayden's eight colours with paired inks and darker edges
(`play-tournament.js:285-292`) are a system that only works flat.

But a literal split is wrong here too, and this is a disagreement with the obvious
full-viewport version of the current design:

> **Do not put the team colour *behind* the head.** That is what
> `.tCupPanel{background:rgb(var(--tc))}` (`play.css:1023`) does, and the code's own
> comment records the failure — "it was a green ring on green" (`play.css:1080-1082`).
> Two saturated colour fields across a full viewport is an esports roster card, which
> the hub research already named as the register clash to avoid: photographic
> cut-outs of real people, on saturated fields, in a grid, is not this site.

A **flat bar under the name** carries the identity at full strength, costs 4px, is
native to the print register (a colour bar is a printing thing), and leaves the
photographs staged on paper rather than composited into a swatch. It is the same
chip the ticket, the schedule dot and the split-flap plate edge already use — one
object seen four times rather than four objects.

And the real colour signal on this screen is now the **heads themselves**, wearing
their kit rings on the ground. That is the strongest split-colour treatment
available and it is already built.

### 4.3 Right column — the cup, and the arithmetic that decides its shape

Band B is **423px** tall at 900. A flat list does not fit:

| | rows | headings | height |
|---|---|---|---|
| 8-team cup (today) | 7 | 3 | 7×44 + 3×26 = **386px** ✓ |
| 12-team cup (brief §3.7) | 12 | 5 | 12×44 + 5×26 = **658px** ✗ |
| 12-team, at 800px viewport | 12 | 5 | 658px vs **376px** available ✗✗ |

So the flat list Jayden is looking at today happens to fit an 8-team cup and
**cannot** fit the 12-team cup that is coming. Adding a scroller back is the thing
he just objected to. The rail therefore has to change shape, and the shape it wants
is the one the bracket wants anyway:

**Round-grouped sub-columns.** Two sub-columns inside the rail, rounds flowing
top-to-bottom then wrapping:

```
ROUND OF 8            QUARTER-FINAL
▸ Maya   v  Gus         Maya  v  —
  Kip    v  Dot         —     v  —
  Ozzy   v  Baz       SEMI-FINAL
  Milo   v  Fitz        —     v  —
                      THE FINAL
                        —     v  —
```

12-team cup: 8 rows in the left sub-column (4 played R1 + 4 bye ghost cards), 8 in
the right (4 QF + 2 SF + 1 F + 1 third-place). **8 × 44 + 4 headings × 26 = 456px**
— still 33px over 423. Two fixes, both cheap and both correct:

- **Row height `clamp(38px, 4.6svh, 46px)`** — 41.4px at 900, 36.8px at 800.
  12-team cup at 900: 8 × 41.4 + 4 × 26 = **435px**. Still 12px over.
- **Bye ghost cards are half-height.** The brief already specifies them as "muted
  ghost cards with an auto-advance beat, never empty boxes" — a walkover is not a
  fixture and does not deserve a fixture's height. 4 × 20 instead of 4 × 41.4:
  **8 × 41.4 → (4 × 41.4) + (4 × 20) = 245px**, + 4 × 26 = **349px**. ✓ with 74px
  to spare at 900, and it fits 376px at an 800-tall viewport too.

**That is the whole cup — every round, every fixture, every bye — visible at once
with no scroller, on a 1280 × 800 laptop.** Which is "see more" delivered
literally, and it is only reachable because the ghost cards got demoted.

What the right column carries per row: the two captain thumbnails, the two names,
the team colour dots, the serial, and the score once played (all of which
`play-tournament.js:1024-1073` already builds correctly). What it does **not**
carry: goals-per-head, ratings, or any stat. That is the Mario Kart rule and it is
the most useful one in the hub research — *the globe screen carries zero data;
names, flags and ratings appear only on the loading screen.* The rail is a
**ledger**, not a dashboard.

### 4.4 What happens to the posters

Jayden's artwork is the best material here and the current treatment is the wrong
container for it at full-viewport scale. Two measured reasons:

**(a) The assets cannot fill a desktop viewport.** `poster-final.webp`,
`poster-match-1.webp` and `poster-match-2.webp` are **1000 × 1295** each (the CSS
`aspect-ratio:1545/2000` at `play.css:789` is right; the comment's pixel figures are
stale). Full-bleed on 1440 wide needs a **1.44×** upscale; on 1920, **1.92×**.
Upscaling printed-looking photographic artwork is exactly the softness that reads
as cheap, and it is unfixable without new art.

**(b) There are three of them.** A 12-team cup runs 12 fixtures against a pool of
**two** ordinary-match posters (`play-tournament.js:732-733`) plus one final. At
361px in a column, a repeat four fixtures later is a texture. At 1440px, a repeat is
*the same screen again*. **Scaling an asset up multiplies its repetition cost.**

So the poster stops being the resting state and becomes **the transition**. The
pieces exist: `bcSting` (`play.css:353-357`, driven at `play-tournament.js:651-657`)
is a full-viewport skewed wipe with a 350ms cover point and a 760ms total;
`bcSheenOnce` (`:647-649`) is the one diagonal sheen motif. Out of the draw and into
the match-up screen:

1. The draw resolves.
2. `bcSting` wipes across in the cup's paint — this is the beam-down, the licensed
   transition between the lobby's sky register and matchday's ground register.
3. Under the wipe, the poster shows full-bleed for ~700ms with the sheen sweeping
   once. Its full-viewport moment, as motion, at a size where a 1.44× upscale is
   invisible because nothing holds still.
4. The wipe clears onto the match-up screen: the columns arrive on `--sp-settle`,
   and **the two squads walk on from opposite edges** on the one motion axis,
   landing with contact shadows.
5. Names stamp 120ms apart. Colour bars snap. One blink each.

Total ≤ 2.2s, inside the spec's ≤4s ritual budget, identical every match,
skippable. This is Nintendo's own correction applied — MKW 1.6.0 shortened its
roulette, and this codebase has the matching scar in the 5,600ms celebration delay
(`play-tournament.js:461-462`). **Spend on the settle, not the duration.**

### 4.5 390px — where two columns cannot survive

Two columns die on a phone. Stacking them re-creates the scroll, which is the thing
Jayden objected to, so **stacking is not the answer — reduction is.**

At 390 × 844 the heads stand at 596 → 673px (§2.2), so the head band starts at
~62svh. Available above: 844 − 93 (band A) − 320 (band C) = **431px**.

| Block | height |
|---|---|
| Fixture card — round, two names + bars, `v.`, tale of the tape, `Kick off` | ~230px |
| Live round only — the round heading + its 2–4 tickets | ~170px |
| **total** | **~400px** in 431px ✓ |

So the phone shows **the fixture and the current round**, and the rest of the cup
is one tap away as a full-screen board overlay (§5.3). No page scroll, no inner
scroll, nothing reachable-only-by-dragging.

That is the honest answer to "the scroll objection returns on mobile": it returns
only if you try to show the desktop content in a narrower box. The mobile screen
shows *less cup and the same fixture*, which is the correct trade — on a phone you
are looking at the match you are about to play, not auditing the draw.

Two smaller mobile facts, both already true: `perTeam()` is 2 on mobile
(`play-tournament.js:330`) so a fixture is 4 heads not 6; and `--blur-1/2` are
already `0px` below 760px in the token layer, so the phone costs one tint and no
blur.

---

## 5. The token layer, and where the broadcast register wins

Jayden's third ask. The mechanical prerequisite is §1.10 — **`play.html` must link
`tokens.css`** — but the design question is which system governs which object,
because the register difference between the site and the broadcast is deliberate
and settled ("the site's design system governs the site; the broadcast governs the
match").

### 5.1 The rule

> **The tokens govern the room. The broadcast governs the objects in it.**

Everything that is *chrome* — the two column surfaces, the identity strip, the
buttons, the exit, the overlay, the motion of all of them — is portfolio chrome and
takes the token layer without exception. Everything that is a *printed artifact* —
the ticket, the stub, the stamp, the serial, the split-flap, the painted plane —
keeps the broadcast's own material language. The test is simple: **if it would look
at home on a case-study page, it is chrome.**

### 5.2 Applied, item by item

**Tokens win:**

| Today | Becomes | Why |
|---|---|---|
| `.tCupH1{line-height:1.05}` (`play.css:992`) | `--lh-auto` (1.18 at 38px) | 1.05 is below the 1.1 heading floor. No register exemption — this is chrome. |
| `.tCupRound{letter-spacing:.14em}` at 12px caps (`:994`) | `--tr-caps` `.045em` | `.14em` is **3.1×** the ladder. Three different caps-tracking values (`.14em`, `.06em`, `.04em`) appear on one screen today. |
| `.tkDist{letter-spacing:.06em}` (`:1135`) | `--tr-caps` | Same. |
| `.tCupSc{font-size:22px}` (`:1091`) | `--fs-h5` | Raw px off the `--fs-*` ladder. |
| `.tCupCard{border-radius:28px 28px 4px 4px}` (`:1017`) | `--r-xl` / `--r-xs` | Already on the ladder; just untokenised. The deliberate asymmetry stays. |
| `.tGo{border-radius:4px}` (`:386`), `.tM`, `.tRow` (`:400`, `:467`) | `--r-md` / `--r-sm` | The 4px sweep. Buttons are the visible change and the one that carries the iOS read. |
| `.tourPanel{animation:tourIn .42s cubic-bezier(.2,.8,.2,1)}` (`:363`) | `--sp-settle` / `--sp-settle-dur` | A panel arriving is exactly what `--sp-settle` is for. |
| ad-hoc surfaces + `1px solid var(--c100)` | `--mat-2` + `--rim-1` | The single highest-value sweep in the token spec, and it costs nothing to paint. |
| `.tDot`, `.tkDot`, small controls | `--tap-min` 44px hit area | Already flagged in tokens §6. |

**The broadcast wins:**

| Object | Keeps | Why |
|---|---|---|
| **Split-flap cells** | `.03em` / `.06em` em-relative radii | Tokens §1.4 already exempts them: they scale with the flap's own type size, which is correct for a broadcast component. |
| **Archivo, on numerals and moments only** | `.bcNum`, `tabular-nums lining-nums`, `wdth ~68 / wght 800` | Settled 2026-07-30. Instrument Sans keeps names, labels and UI at 400/600. Nothing here changes it — but see §1.7, because it is not actually loading. |
| **The ticket's edges** | the torn/perforated edge, not a radius | A tear is not a corner. The token ladder has no vocabulary for a non-rectilinear edge and should not grow one. |
| **`--cupPaint` / `--cupStock` / `--cupSheen`** | per-cup identity vars | Identity changes materials and voice, never layout. Orthogonal to the token layer by design. |
| **The painted round-label stencil** | its own wider tracking | The one legitimate tracking exemption — but it must be a **named class inside the paint plane**, not an inline value repeated. |
| **`--sp-bounce`** | celebration only | The ticket's stamp qualifies. `Kick off` does not. |

### 5.3 The one place they meet, and who wins

The **board overlay** — the full cup record, reached from band A on desktop and
from the reduced rail on mobile. It is chrome (a sheet) containing artifacts
(tickets). Ruling: **the sheet is tokens** (`--r-xl`, `--mat-3`, `--sh-3`,
`--sp-settle`, no `backdrop-filter`), **the tickets inside it are broadcast**
(stock, grain, jitter, tear, stamp, serial). That boundary is legible and it is the
same boundary as "the room versus the objects in it".

### 5.4 What must not happen

Do not sweep the broadcast into the token scale silently. The tickets' near-square
corners, the painted plane, the grain and the split-flap are *the* reason the
tournament reads as a different kind of thing, and the tokens spec's own "square
content, round controls" rule endorses square artifacts. **Flattening them into
`--r-lg` cards would delete the register difference that three specs' worth of work
established.** If a sweep is scripted, exclude `.tk*`, `.bc*` and the `.tCupFx`
family by name.

---

## 6. Precedent, and what would be cosplay

### 6.1 What transfers

**Two flanks, data in the middle.** UFC's Tale of the Tape: both fighters on each
side, all the relevant information in the centre, shown during the walk-in
([Martial Arts Insider](https://martialartsinsider.com/blogs/mma/tale-of-the-tape-ufc)).
Box Out's matchup template: split layout, comparative rows between the sides, flat
sectional colour rather than a gradient
([Box Out](https://boxoutsports.com/graphics/gameday/matchup-breakdown)). This is
§4.1's left column, and it is the strongest transfer available because it answers
the question a two-sided layout always poses.

**Flat colour, no blend.** NBC's 2025–26 NBA package chose flat colour to celebrate
every team's colours and represent the jerseys, explicitly over gradients and
layered treatments, because dozens of palettes made consistency the design problem
([SVG](https://www.sportsvideo.org/2026/04/09/newstalgia-an-in-depth-look-at-how-the-return-of-the-inba-on-nbc-i-was-driven-by-a-bold-and-ownable-graphics-package/)).
Independent confirmation of the finding already on file. §4.2.

**Protect the first two things.** "What's the most important thing they need to
read? What's the second most? Protect that at all costs, and then the motion theory
and the general design kind of leak out from that" — Gary Hartley, Fox Sports
([SVG](https://www.sportsvideo.org/2026/06/09/designing-the-modern-scorebug-how-broadcast-graphics-teams-are-rethinking-the-most-important-element-on-screen/)).
This is §4's budget in one sentence, from someone who does it for a living.

**Dwell time.** A matchup lower third stays on screen 3–6 seconds so the viewer can
process it ([School of Motion](https://schoolofmotion.com/blog/sports-lower-thirds)).
That is the honest floor for the match-up screen's hold, and why the ritual's ≤2.2s
of motion should end in a still, not in an auto-advance.

**Bodies, not a list.** Mario Kart 8 Deluxe communicates headcount purely by how
many characters are standing on the globe — no counter, no roster, no labels.
Already researched in this repo and already agreed. **This is exactly Jayden's live
heads ask, arrived at independently by Nintendo**, and it is the single best
argument for it: the squads standing on the ground *are* the team sheet, so no
team-sheet UI is needed.

**The reaction beat.** When MK8DX's draw resolves, three things happen together: a
banner changes colour, the winning tile pops and gains a frame, and **every
character cheers at once**, with nothing else moving. On this screen that is the
end of the ritual — both squads plant, one blink each, the colour bars snap.
`__hmFX`, `A.pop()` and the persona rigs already exist.

**Data quarantine.** MK8DX's globe screen carries zero data; names, ratings and
flags appear only on the loading screen. §4.3's ledger-not-dashboard rule.

**Faces as personality.** SF6's "Game Faces" — a per-character expression pass while
the match loads — is the most-liked thing about that screen
([Fighters Generation](https://www.fightersgeneration.com/news1/sf6-june22-3.htm)).
Jayden's heads have a full expression rig, persona vectors and blink/gaze. One
expression beat per captain during the ritual is the cheapest character available
and it is the site's actual differentiator.

### 6.2 What would be cosplay

- **`VS` in a giant condensed display face, angled, with a spark.** The
  fighting-game glyph. **`v.`** — lowercase, with the full stop — is the 1950s
  programme team-sheet grammar the broadcast spec already licensed for this exact
  moment, and it belongs to this site. (`.tCupVs` is already hidden on every real
  fixture, §1.11, so removing it formally costs nothing.)
- **A diagonal split with the two heads bleeding into each other.** The
  fighting-game composition, and also the blend-implies-a-winner problem in a hat.
- **Win probability, power rankings, form guides.** Borrowed numeric economies
  implying a ladder that does not exist. The honest version already ships as the
  1–12 final standings.
- **Full-bleed photographic poster.** §4.4 — 1000px assets, three of them.
- **7-segment LED numerals, lamp-dot countdown rings, gold frames, chevron plates,
  checkered end caps.** Mario Kart's material language, and the project's photoreal
  note already records that **LED is a trap** here. The split-flap is this site's
  mechanism for the same job.
- **Team crests or monograms.** These are people, not clubs. A single initial at
  panel scale was tried and rejected in this codebase — "read as a smudge"
  (`play.css:1030-1031`).
- **A countdown timer on the match-up screen.** Nobody is waiting for anybody.
  Nintendo removed its own among friends in MKW 1.1.0.
- **A walkout on every fixture.** The spec restricts it to semi + final and is right
  to. Twelve walkouts is a skip target.

---

## 7. How the surface grows

The three bands do not change. Only the two columns' contents do, and band C stays
the ground throughout.

| `T.phase` | Band A | Left column | Right column | Band C |
|---|---|---|---|---|
| `setup` | `Apollo Cup · 12 teams` | the field, seeds 1–12 | — (the rail is the field) | all 12 heads, wandering |
| `draw` | `Quarter-final draw` | the roulette resolving one pairing at a time | the rail filling in, ticket by ticket | all 12 heads; **the reaction beat fires here** |
| `matchup` | `… · APL-0102 · 2 wins to the cup` | **the fixture** (§4.1) | the cup ledger (§4.3) | the two squads |
| `live` | hidden | — | — | the pitch; band A's content has travelled into the scoreboard |
| `result` | same, one round on | the fixture with the score stamped | the ticket tearing in place | the two squads, celebrating |
| `done` | `Apollo Cup · Champion` | the champion + pennant | the completed, all-torn record | the champion's squad |

Four properties make this hold:

1. **The 12-team bracket needs no structural change.** It changes `buildTeams()`'s
   `n` and adds a third-place fixture. §4.3's arithmetic was done *for* 12 teams,
   with byes as half-height ghost cards, and it fits at 800px tall. This is the test
   the structure was designed to pass.
2. **The roulette draw is a left-column state, and the ground is why it works.**
   The draw's payoff is not the spin, it is the resolution — and the resolution
   lands on twelve heads cheering at once in band C. Budget the spin short and
   skippable (MKW 1.6.0; the 5,600ms scar) and put the spend in the settle.
3. **The 1–12 standings are a right-column state.** Twelve rows at 41.4px = 497px,
   which does **not** fit band B's 423px — so at `done` the standings take **both
   columns**, two sub-columns of six, or the rail runs a two-up grid. Named here
   rather than discovered later. Never "draft order", never "fantasy football" —
   "final standings" (brief §3.8).
4. **Scheduling and the full record live on one overlay**, reached from band A on
   desktop and from the rail on mobile. It is the only surface allowed to be taller
   than the screen, because it is the only thing on screen when it is open.
5. **Neither column ever grows a second primary action.** If a state needs two, one
   of them is an affordance and affordances live in band A. This is the rule that
   stops `Kick off` acquiring `End tournament`, `Skip`, `Schedule` and `Sound` over
   the next four plans — which is exactly how the current capsule got here.

---

## 8. Costs, and where I disagree

### 8.1 The live heads and the schedule want the same pixels — flagged

This is the one place Jayden's asks collide, and it is worth being blunt: **the
heads take the bottom 42svh, and that is the room the "see the whole schedule" ask
wanted.** §4.3 resolves it — round-grouped sub-columns plus half-height bye ghosts
gets a full 12-team cup into 349px — but the resolution is *tight*, it depends on a
row height that flexes with viewport height, and it is the first thing that will
break if anything else is added to band B.

The rule that protects it: **band B's content is fixed at design time, not
content-sized.** If a future round needs a fourteenth row, something else leaves.

### 8.2 The heads are cheaper than they look — measured

Contrary to the usual shape of this kind of ask:

- **Ground line: no engine change.** `body.hmFull` is permanent on `play.html`, so
  `fY = FLOORCAP` always, and the feet plane is already at 75–76svh (§2.2).
- **No new rAF loops.** `play-engine.js` runs **one loop per head** (`_frame`
  defined inside `spawnCompanion`, `:643`), and `__hmBench` only *hides* a head
  (`:693`) — it does not stop its loop. So making six heads visible on the match-up
  screen costs paint, not loops. The eggheads are spawned earlier than today rather
  than additionally; the total over a fixture is unchanged.
- **The spawn move is a relocation, not a rewrite** (§2.4) — ~30 lines from
  `startFixture()` to a new `cast()`.
- **It deletes the 620ms pre-kickoff wait** and its pop-in.

The real cost is **regression surface**, not performance: `clearSpawned()`'s timing,
the `__hmSlotFor` dedupe (`:332-335`, a documented own-goal bug), and `hmFinal`'s
toggle all move with it. Those want the seeded-roster drive-through
(`.tCupGo` → `__hmTourWin(1,5,1)` → `__hmSoccerEnd()`) run for a full cup, not a
single fixture.

### 8.3 The poster should not be the resting state

A real disagreement with the shipped design and with the instinct that a full
screen means bigger artwork. The assets are **1000px wide**, there are **three** of
them, and a 12-fixture cup shows each one four times. **Big makes repetition worse,
not better.** §4.4 keeps the artwork loud and moving and stops it becoming
wallpaper. If Jayden wants it resting, the honest cost is **new art at ≥2400px, at
least six variants** — a commission, not a CSS pass.

### 8.4 The large portraits have to go, and that is the biggest visible change

Named again because it is the thing most likely to be missed: with the real heads on
stage, `.tCupPanel` / `.tCupBigWrap` / the poster's 46% heads are a picture of the
subject next to the subject. Removing them is what makes room for two columns *and*
a ground band. If they stay, the layout does not close — that arithmetic is §3.2.

Two good things go with them and should be preserved elsewhere: **`--fit`**, the
alpha-scan width normaliser (`play-tournament.js:793-824`) that makes mini-Jayden
and a mask cut render the same apparent size, still applies to the 44px ticket
thumbnails; and **the stare-down** (`play.css:378-384`, desynced breathing, "in sync
they read as two stickers; out of sync they read as alive") is now performed by the
live heads for free.

### 8.5 Open questions

1. **Do the squads mingle or split to their halves?** (§2.5) Recommend mingle — a
   lineup is a formal object that breaks at N=2. One line to try the other way.
2. **Does the ritual auto-advance?** Recommend **no** for the first build: the
   ritual plays (≤2.2s), holds, and `Kick off` is a real button that also skips the
   ritual if pressed early. Auto-advance is worth a behaviour experiment later —
   12 fixtures is 12 clicks — but a timer that starts a match without asking feels
   great on fixture 1 and bad on fixture 9.
3. **`← Leave the cup` or `← Play`?** The tournament currently disables the page's
   only global control (§1.8). Whatever replaces it should probably mean both. Copy
   decision.
4. **Does the arc gate widen to `hmTour`?** (§2.3) Recommend yes — one selector, and
   without it the ground snaps at kickoff.

### 8.6 Flagged, not performed

- **`play.html` loads no fonts (§1.7).** Whole-page bug; blocks any type judgement
  on this screen. Needs permission, not a decision.
- **`play.html` does not link `tokens.css` (§1.10).** Mechanical prerequisite for
  ask #3.
- **`paintStadium()` is unreachable (§1.6).** Either `.tBrMir` comes back or ~50
  lines of JS and ~50 of CSS should go. Not this pass — `play-tournament.js` has
  concurrent agents in it.
- **`index.html` carries 65 dead tournament CSS matches** (`index.html:1125`
  onward) for markup it can no longer build. `index.html` is locked; log it.
- **`syncHero()` becomes deletable** (`play-tournament.js:921-983`): ~60 lines,
  6+ `getBoundingClientRect()` reads and 3 style writes per `paint()` and per
  `resize`. An `svh`-banded layout needs none of it. Biggest single JS reduction
  available here.

---

## 9. Performance

**Baseline correction, and a correction to the correction.** The brief says
`play.css` declares 2 blur rules; it is **3** today — `.iris::after blur(.4px)`
(`:27`), `.floorshadow blur(7px)` (`:59`), `.tFan blur(var(--fb,0px))` (`:1433`).
**`backdrop-filter` count is 0.** The "71 blurs" figure is `index.html`'s and does
not apply. Play starts with a genuinely clean budget and this screen should not
spend it.

1. **No new rAF loop.** The ritual is CSS transitions and keyframes on `transform`
   and `opacity`, fired once from `paint()`. `--sp-settle` 360ms for arrivals,
   `--sp-quick` 300ms for stamps. The budget is already committed: `play-engine.js`
   has 25 rAF call sites and one loop per head; a full crowd is 8–10 concurrent
   loops before any game starts, plus the FX canvas and the lava WebGL context.
2. **The live heads add no loops** (§8.2) — benching hides, it does not stop.
3. **No `backdrop-filter`, anywhere on this screen.** Zero today; the board overlay
   is the only surface that could justify one and it can take `--mat-3` + `--rim-1`
   instead. Two columns are two large permanently-visible surfaces — precisely what
   the blur budget's rule 5 forbids blurring.
4. **Do not revive `.tFan`.** 33 elements each carrying
   `grayscale(1) contrast(.5) brightness(1.28) blur()` is a filtered rasterisation
   per element. It has never rendered (§1.6), so nothing regresses by leaving it
   off, and it is board dressing rather than fixture dressing.
5. **Keep `window.__hmFit` cached.** The `--fit` probe (`play-tournament.js:793-824`)
   is a 64 × 64 `getImageData` readback — a GPU→CPU sync — memoised by `src`. It now
   runs against 44px thumbnails instead of 272px panels, but the readback count is
   the same; do not move it anywhere that repaints.
6. **Poster decode.** Three assets at 1000 × 1295: 175 KB / 61 KB / 141 KB transfer,
   **5.18 MB decoded each**. As a ≤700ms transition (§4.4) one is decoded per
   fixture and can be released; as a full-bleed backdrop one is resident at full
   decode for the life of the screen. A second, independent reason for the
   transition treatment.
7. **`.tCupTint`'s mask.** If the tint layer returns it sets
   `mask-image:url("<data URI>")` where the URI is a dyed egghead WebP
   (`play-tournament.js:784-785`). Those are 50–200 KB **strings in a style
   attribute**. At 44px thumbnails the tint is not needed at all — drop it.
8. **The confetti canvas must stay off.** `champConfetti` is a 190-particle
   `position:fixed` full-viewport canvas with **its own rAF** at `z-index:64`
   (`play-tournament.js:154-218`), correctly gated to the champion and stopped on
   any non-champion repaint (`:866`). Verify that gate survives the restructure — a
   full-viewport canvas loop behind a match-up screen is the most expensive mistake
   available here.
9. **Delete `syncHero()`** (§8.6).
10. **Fix the fonts first (§1.7)**, then judge the type. Two webfonts,
    `font-display:swap`, `preload` both — they are already in `fonts/`.
11. **Measure in real Chrome, foregrounded.** The embedded pane throttles rAF and
    white-screens on the ink filters, and `play.html` inlines three of them
    (`play.html:50-52`).

---

## Sources

**Specs read (never written):**

- `docs/superpowers/specs/2026-07-30-tournament-broadcast-design.md` — Matchday
  Print, the print-artifact grammar table, §2 the versus ritual (≤4s), §3 the
  scoreboard's settled per-side content, the polish budget, the Globe Lobby
  addendum (`:422-452`) and the sky/ground register split.
- `docs/superpowers/specs/2026-08-02-play-hub-research.md` — dark stage / light
  chrome, Blue Marble scoping, §4 the MK8DX study (bodies-not-lists, data
  quarantine, the reaction beat, the patch-notes critique), §7.1 the corrected blur
  and rAF baselines.
- `docs/superpowers/specs/2026-08-02-planet-pitch-research.md` — render-curved /
  physics-flat, the `SAG` table, the `hmSoccer` gate, `SAG = 0` as a byte-for-byte
  revert.
- `docs/superpowers/specs/2026-08-02-design-tokens.md` and `tokens.css` — the radius
  ladder, springs, the material ladder and blur budget, the leading law and tracking
  ladder, `--tap-min`, and §1.4's split-flap exemption.
- `docs/superpowers/specs/2026-08-02-next-chapter-brief.md` §3.7–3.9 — the 12-team
  16-slot bracket with byes to seeds 1–4, bye ghost cards, the quiet 1–12 final
  standings, the Globe Lobby's status and assets.

**Code read:** `play.html` (107 lines), `play.css` (1,492), `play-tournament.js`
(1,132), `play-engine.js` (`survey()` at `:344-382`, `FOOT`/`FLOORCAP`, `__hmBench`
at `:693`, the per-head `_frame` at `:643`), `play-games.js`, `hero-engine.js`,
`index.html` (read only), `tokens.css`.

**Assets measured** with `sips`/`ls`: `images/poster-final.webp` 1000×1295 / 175 KB,
`poster-match-1.webp` 1000×1295 / 61 KB, `poster-match-2.webp` 1000×1295 / 141 KB,
`trophy.webp` 119×192 / 9.7 KB.

**Web:**

- [SVG — *NEWstalgia*: the NBA on NBC graphics package](https://www.sportsvideo.org/2026/04/09/newstalgia-an-in-depth-look-at-how-the-return-of-the-inba-on-nbc-i-was-driven-by-a-bold-and-ownable-graphics-package/)
  — flat colour chosen over gradients and layered treatments to carry team identity
  across dozens of palettes.
- [SVG — Designing the modern scorebug](https://www.sportsvideo.org/2026/06/09/designing-the-modern-scorebug-how-broadcast-graphics-teams-are-rethinking-the-most-important-element-on-screen/)
  — Gary Hartley (Fox Sports) on protecting the first and second thing a viewer
  reads.
- [Box Out Sports — Matchup Breakdown](https://boxoutsports.com/graphics/gameday/matchup-breakdown)
  — split layout, comparative statistic rows between the sides, flat sectional
  colour rather than a gradient.
- [Martial Arts Insider — The Tale of the Tape in the UFC](https://martialartsinsider.com/blogs/mma/tale-of-the-tape-ufc)
  — both fighters flanking, all information in the centre, shown during the walk-in.
- [School of Motion — A hard-hitting guide to sports lower thirds](https://schoolofmotion.com/blog/sports-lower-thirds)
  — the 3–6 second dwell for a matchup lower third.
- [Fighters Generation — SF6's versus-screen "Game Face" feature](https://www.fightersgeneration.com/news1/sf6-june22-3.htm)
  and [EventHubs](https://www.eventhubs.com/news/2024/oct/12/caricatures-sf6-deranged-game-faces/)
  — a per-character expression beat on the versus screen as the thing players
  remember.
- [Game UI Database — Street Fighter 6](https://www.gameuidatabase.com/gameData.php?id=1841)
  and [Mario Kart 8 Deluxe](https://www.gameuidatabase.com/gameData.php?id=83) —
  catalogued screens.

**Search limitations, stated:** Sports Video Group and NewscastStudio both return
403 to automated fetching, so the NBC and Fox findings rest on indexed summaries
rather than article bodies; each was confirmed across two independent queries.
Capcom's own SF6 UI dev column (`streetfighter.com/6/column/detail/ui01`) was found
but not retrievable, so the eye-tracking claim about SF6's in-battle gauge layout is
second-hand and is **not** relied on for any recommendation above. No number in this
document is quoted from an unsourced aggregator.
