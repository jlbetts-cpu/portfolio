# The Play hub — games-menu research

**Date:** 2026-08-02 · **Status:** research only. Nothing implemented. No existing
file edited — `play.html`, `play.css`, `play-engine.js`, `play-games.js`,
`specimen.html` and the five case studies were read, never written.

**Ask (Jayden):**

> "the play screen should have the heads on planet, a researched game menu with
> Expedition, Tournament, and create head. the create head screen I want it rebuilt
> inside the play screen as a sub page of that since the feature is most important
> in there, removing it from the extras. and I think adding the gradient maker as
> well as an option would be perfect… the gradient maker ui needs to be rebuilt as
> well to fit the new system. and we need a header for this section like a title of
> what the play section is about."

> "…I think mario kart online is the biggest inspiration but without the dark mode,
> just with our own stunning gradient system — orrrrr actually you think it would be
> better to get the nasa imagery and add our halo effect on it so it looks better,
> making the menu dark mode to differentiate it from the rest of the site, as the
> games menu."

Two follow-ups arrived mid-research and are treated as settled, not re-opened:
**"Expedition" is the plain soccer mode plus a proper full-screen team-select
screen**, and **the two makers are absorbed link-first, in stages, never in one
rewrite.**

Every number below was measured against the real files. Where I disagree with
Jayden it is stated in the open, with the cost attached.

---

## 0. The four answers, up front

| Question | Answer |
|---|---|
| **Dark mode?** | **No global dark mode. Yes to a dark *stage*.** Make the sky behind the planet deep and let every piece of chrome stay on the light token layer. That buys ~90% of the differentiation for ~2% of the cost, and it is the register split the Globe Lobby addendum already settled. Full dark costs 241 hard-coded colour literals in `play.css`, all 14 material tokens, and two head treatments that live in JS where no media query can reach them. |
| **NASA vs our gradient (menu backdrop)?** | **Our gradient, baked.** Blue Marble stays reserved for the Globe Lobby draw, where a recognisable Earth is the joke and the surface is transient. A permanent photographic backdrop puts the photo heads into a *collage* with a second photo instead of *staging* them against an abstract ground — and that is the single hardest look to make expensive. Measured: baked gradient ≈ **6 KB**, Earth disc at the same size ≈ **64 KB** and 2 MB of decoded texture. |
| **What is "Expedition"?** | Today's **exhibition soccer** path (`__hmSoccerStart`), with the team tray promoted from a 300px popover into a full-stage pre-match screen. Naming note in §1.4: the codebase already calls this mode **"Exhibition"** (`index.html:7704`), one letter away. Jayden picks. |
| **Biggest cost found** | Dark mode, if it is taken. Not the palette — the fact that the head's contact shadow is written as inline `cssText` inside `play-engine.js:245` (`rgba(8,8,8,.26)`), so on a dark ground the heads silently stop being grounded and **no stylesheet change can fix it**. |

---

## 1. Information architecture

### 1.1 The shape: one stage, four doors, one back

`play.html` today is 9,154 bytes: a `.hero` arena, a fixed top-left `← Portfolio`
link, and a fixed top-right disclosure menu with two items. There is no title, no
landing state, and nothing links to it from `index.html` (verified: zero
`href="play.html"` in the home page — the hub is currently unreachable except by
typing the URL).

The structure I propose:

```
play.html  ── the stage is permanent; only the panel over it changes
│
├─ HEADER            title block + one line. Over the sky, no plate.
├─ STAGE             the planet + the heads. Never unmounts. Never navigated away from.
├─ HUB MENU          four cards. The resting state of the page.
│   ├─ 1 Expedition      → #expedition   full-stage team select → match
│   ├─ 2 Tournament      → #cup          setup → draw → bracket → match → standings
│   ├─ 3 Create head     → #head         (stage 0: links to headmaker.html)
│   └─ 4 Gradient maker  → #gradient     (stage 0: links to gradientlab.html)
└─ IN-GAME BAR       the existing #moodbar / #moodBtn / #moodMenu, corner-pinned.
                     Appears only while a game is live. Carries End game.
```

**The governing rule: one slot, one surface.** Each of the four cards opens a
sub-surface that takes over the *panel*, not the *page*. The planet and the heads
keep running underneath. There is exactly one global affordance — back to the hub —
and it lives where `.playBack` already lives. This is what stops the menu from
growing a fifth, sixth and seventh entry as the tournament acquires sub-screens.

### 1.2 Why the hub menu and the in-game bar must be two different objects

This is a constraint, not a preference. `#moodBtn` is **disabled and restored by id**
by the tournament (`index.html:8545,8565`), and `play.html`'s own comment at line 51
records that those exact ids must survive. `play-games.js` also gates the whole menu
on `body > .moodbar.open` (`play.css:152`).

So: do **not** rebuild the corner disclosure into the hub menu. Leave `#moodbar`,
`#moodBtn`, `#moodMenu` exactly where they are and let them become the *in-game*
control surface — the thing you reach for once a match is running. The four-card hub
is a **new, additional** object that occupies the page's resting state and hides the
moment a game starts. Two surfaces, two jobs, zero id churn.

> **Guard-rail, stated so nobody misreads this document:** the memory note
> *"Play menu: don't restructure — the coloured dots and current-players grid are
> evidence-backed and load-bearing"* is about **`index.html`'s** play menu. Nothing
> here touches it. `play.html`'s menu already deliberately ships without the mood
> dots, `#moodHeads` and the "Show on home" toggle (spec §3.2 — home-owned). This IA
> adds a surface to `play.html` and changes nothing on home.

### 1.3 Where the tournament's own surfaces live

They live **inside** the Tournament card's surface, in sequence, and they never
appear in the four-entry menu:

| Sub-surface | Where | Note |
|---|---|---|
| Cup setup (12 teams, seeding) | `#cup` | brief §3.7: 16-slot bracket, byes to seeds 1–4, 11 matches + a 3rd-place playoff = 12 |
| **Globe Lobby / random draw** | `#cup/draw` | the settled Concept 1 + Concept 3 roulette. This is the *ritual* surface — the one place Blue Marble belongs. See §3.4. |
| Draw Board / schedule | `#cup/board` | tickets printed at the draw, per the addendum |
| Bracket + live match | `#cup/live` | ghost cards for byes, auto-advance beat |
| **Final standings 1–12** | `#cup/standings` | brief §3.8 — "final standings", never the words "draft order" or "fantasy football" |

The **only** thing that surfaces back to the hub is one quiet line on the Tournament
card: *"Last cup — 12 teams · won by Ellie."* That single line is how a hub with four
static doors acquires a sense of history without acquiring a fifth door.

Two constraints on those sub-surfaces, both argued in §4.3: the draw's roulette must
be **short and skippable** (Nintendo shortened its own in the sequel, and this
codebase already has the 5600 ms celebration delay as a cautionary tale), and the
draw must stay a **draw, never a vote**.

### 1.4 "Expedition" — the naming observation, raised gently

Jayden's clarification is unambiguous about the *mode*: it is regular soccer with
teams, and clicking it should open a bigger version of the team picker. That maps
exactly onto `window.__hmSoccerStart` (`play-games.js:117`).

The observation, offered as a question rather than a correction: **the codebase
already calls this mode "Exhibition."** `index.html:7704` opens the tournament block
with *"Exhibition (the old Soccer) is untouched"*, and `play-engine.js:776` carries
the same word in the team-colour comment. "Expedition" and "Exhibition" are one
letter apart.

Both readings are defensible:

- **"Exhibition"** is the football term for a friendly — a one-off match outside a
  competition. It is precisely what the mode is, it is already the word in the
  source, and it sits naturally beside "Tournament."
- **"Expedition"** is a better *word* — it promises going somewhere, which fits a
  planet, and it is the more distinctive of the two on a menu card.

I have not renamed anything. If Jayden meant "Exhibition", the code is already
right. If he meant "Expedition", one rename in two comments makes it consistent.
His call.

### 1.5 The Expedition screen — promoting the tray

Today the picker is `.teamTray`: `position:fixed; right:20px; bottom:96px;
width:300px`, built in `play-games.js:189`, with a Red column, a Blue column,
40×48px chips, tap-to-flip, drag-to-column, a shuffle button and a full-width
Start. It is a good component in a small box.

The promotion is not a redesign — the interaction model is already correct and
tested. It is a **change of scale and of framing**:

| Today (popover) | The screen |
|---|---|
| 300px wide, corner-anchored | full stage, two columns at real width |
| 40×48 chips | head cut-outs at ~96–120px, on their team's colour, *with the live team-colour preview the tray already drives via `__hmTeamPreview`* |
| "Soccer teams" 13px title | the two sides named, `--fs-h3`, one per column |
| shuffle = a 28px icon button | shuffle = a real control with a visible verb, because randomising the sides is half the fun |
| Start = full-width dark bar | Start = the one primary action on the screen, `--r-md`, `--accent` |
| dismissed by outside-click | left by the hub's back affordance |

Two things to add that the popover could not afford, both cheap:

1. **The heads walk to their side.** The chips already know their team; the *stage
   heads* already read `__hmTeamPreview` live. So when you flip a chip, the head on
   the planet behind the panel changes colour. Make that visible by keeping the panel
   to the lower ~55% of the stage. This is the pre-match anticipation beat, and it
   costs nothing new — the preview channel already exists.
2. **A roster count and a mini-Jayden slot.** The tray already has an
   `mjChip()` for mini-Jayden (`play-games.js:183`) and `balanced(n)` for even sides.
   At screen scale those stop being trivia and become the screen's content.

**Do not** make this screen modal-over-black. The whole reason to promote it is that
it is *the moment before a match* — the planet must stay visible.

### 1.6 Routing — `location.hash`, and why it matters for §5

No build step, no router, no dependency. `location.hash` gives deep links, gives the
browser Back button for free, and — the reason it is load-bearing here — **it lets the
menu markup be written once and never change when the makers move from linked to
absorbed.**

```
play.html                 hub
play.html#expedition      team select
play.html#cup             tournament, and #cup/draw, #cup/board, #cup/live, #cup/standings
play.html#head            head maker
play.html#gradient        gradient maker
```

At **stage 0** the Create-head card is simply `<a href="headmaker.html?from=play">`.
At **stage 2** the same card becomes `<a href="#head">` and the hash handler renders
it in place. The card, its copy, its position and its styling never move. That is the
seam, and it is one attribute wide.

---

## 2. Dark mode — no, and here is the bill

**Recommendation: do not build a second colour system. Build a dark *sky* and keep
light chrome.**

Jayden's argument for dark is real and I want to state it at full strength before
disagreeing: the games section is a different kind of thing from the portfolio, a
visitor should *feel* that they have gone somewhere, space is dark, and Mario Kart's
lobby is dark. All true. The disagreement is not about whether Play should look
different — it is about whether *inverting the token layer* is the instrument that
gets you there. It isn't, and it is expensive.

### 2.1 What a full dark mode actually costs

**(a) Every material token inverts. All fourteen.** From the token spec §4.2:
`--mat-1/2/3` are `rgba(253,253,253,.72/.86/.96)`; `--rim-1/2` are
`rgba(18,18,18,.08/.14)`; `--rim-top` is `rgba(255,255,255,.55)`; all four `--sh-*`
are `rgba(18,18,18,…)`. There is not one material token that survives a dark ground
unchanged. And they do not invert *mechanically*: a dark surface's edge is a light
rim, but its shadow is not a light shadow — dark UI separates by luminance and rim,
not by cast shadow, so the shadow ladder does not translate, it gets **replaced**.
That is a second design system, not a second palette.

**(b) `play.css` is only ~39% tokenised on colour.** Measured:

| | count |
|---|---|
| `var(--c*)` references | 153 |
| `var(--accent*)` references | 3 |
| hex literals (excluding `data:` URIs) | 92 |
| `rgb()/rgba()` literals (excluding `data:` URIs) | 149 |
| **hard-coded literals total** | **241** |

Re-declaring `:root` under `@media (prefers-color-scheme: dark)` flips 156 values and
leaves **241 untouched**. The bulk of them are in the tournament: `play.css` carries
**126 distinct `.t*` selectors**, and the tournament's whole art direction is
"Matchday Print" — paper, ink, split-flap, printed tickets. Inverting it does not
adapt it; it deletes it.

**(c) It contradicts a settled decision.** The Globe Lobby addendum, in Jayden's own
approved spec:

> "the lobby is the *sky* register (space, night); the matchday surfaces stay the
> *ground* register (daylight print). The beam-down from lobby to stadium is the
> licensed transition between the two."

A dark games *section* collapses that split. The lobby's darkness stops meaning
anything the moment everything is dark, and the beam-down transition — which is the
best idea in that addendum — loses the contrast it was built on.

**(d) The heads. This is the part that cannot be fixed in CSS.**

Two treatments assume a light ground, and they fail differently:

1. **`#tHeadEdge`** (`play.html:40`) thresholds the head's alpha, dilates it,
   subtracts, and floods the resulting ring with `#FDFDFD`. On paper that is an
   *invisible cut-line* — it lets a photo sit on the page without a seam. On a dark
   ground the identical filter becomes a **bright white keyline**: a sticker outline.
   The effect does not need a new colour, it needs a new *intent*. (Mechanically it
   is at least reachable — `#tHeadEdge feFlood{flood-color:…}` is a valid CSS
   override, so this one is themeable if someone decides what it should mean.)
2. **The contact shadow is not reachable at all.** `play-engine.js:245` writes it as
   inline `cssText` at spawn time:

   ```js
   shadow.style.cssText="…background:radial-gradient(ellipse at center,rgba(8,8,8,.26),rgba(8,8,8,0) 70%);…"
   ```

   A dark ellipse at 26% alpha. On a dark ground it is **invisible**, and the heads
   stop being grounded — they go from standing on a planet to floating in front of
   one. No media query, no `:root` override and no stylesheet touches an inline
   `style` attribute written by JS. Fixing it means editing `play-engine.js`, which
   is 288 KB and currently has concurrent agents in it.

   This is the single biggest cost in the document, and it is invisible until the
   moment you actually put the heads on a dark field.

**(e) The register clash.** Photographic cut-outs of real people, on black, in a
grid, with team colours, is *esports roster card*. That is a strong look and it is
not this site's. The portfolio's whole premise is quiet paper.

### 2.2 What to do instead — the dark *stage*

Almost all of Jayden's goal is achieved by darkening exactly one element:

- **The sky is deep.** The top ~55% of the stage is the gradient's dark end — a night
  field with the planet's limb and rim light coming up from below. That alone reads
  as "you have gone somewhere" from the first frame.
- **The ground is lit.** The planet's surface is where the heads and their shadows
  live, and it stays bright enough that `rgba(8,8,8,.26)` still reads. Nothing in
  `play-engine.js` changes. This is also just correct physics for a lit sphere, and
  it satisfies gradient-notes **A4** (the rim escapes the silhouette) and **A6**
  (limb shading opposite the light).
- **The chrome stays light.** Menu cards, the header, the team screen, the whole
  tournament: `--mat-1/2` + `--rim-1`, unchanged, floating over a dark field. This is
  gradient-notes **B3** almost verbatim — *"gradients glow from a card's edge like a
  lamp inside the component"* — and **B4**, *"always on near-white paper with quiet
  chrome."* It is also exactly Mario Kart's own structure: dark sky, bright opaque UI
  panels. The lobby is not "dark mode"; it is light UI on a dark scene.
- **The header type is light-on-dark**, because it sits on the sky. That is type on
  an image, not a second theme — the same relationship any photo caption has.

Net cost: **zero token inversions, zero `play-engine.js` edits, one gradient.**

### 2.3 The other four ways Play differentiates itself, if it stays light

Because "differentiate the games section" deserves more than one instrument:

1. **The stage is the differentiation.** A full-bleed planet with heads walking on it
   is unlike any other surface on the site by an enormous margin. No other page has
   a *world*.
2. **A live accent.** The site's `--accent` is emerald `#0E6B3B` (`play.css:19`). Play
   can take `--accent-play` from the *current planet's* gradient, so the section's
   accent colour changes with the world it is standing on. No other page can do that;
   it costs one custom property.
3. **Motion.** Everything on Play moves and nothing else on the site does. That is a
   bigger perceptual difference than luminance.
4. **The header type.** Play is the only sub-page that gets its own title block
   (§6) — the case studies get a back-link, home gets the hero. A third treatment
   marks the section as its own place.

### 2.4 If he takes dark anyway

Then scope it honestly and stage it:

- Ship **the dark stage only** first (§2.2). Live with it for a week. It is a
  strict subset of full dark, so nothing is wasted if he escalates.
- Full dark, if escalated, is: a `[data-theme="play"]` attribute on `<body>` (never
  `prefers-color-scheme` — this is a *place*, not a user preference), a mirrored
  material set, an audit of 241 literals, a decision on `#tHeadEdge`'s new intent, an
  edit to `play-engine.js:245`, and a re-litigation of Matchday Print. Budget it as
  its own plan, not as a styling pass, and expect it to fork the design system
  permanently — every component after it gets designed twice, forever.

---

## 3. NASA imagery vs the gradient engine, for the menu backdrop

**Recommendation: the site's own gradient, baked to a static image. Keep Blue Marble
for the Globe Lobby draw.**

### 3.1 Licence and weight — the easy parts

Licence is a non-issue: NASA Blue Marble is public domain, the masters are already
committed, and the addendum already approved them.

Weight is not the argument people assume it is, so here are real numbers. I resized
and re-encoded the committed masters:

| Asset | Source | Shipped as | Transfer | Decoded RAM |
|---|---|---|---|---|
| `earth-disc-src.jpg` | 2048×2048, 593 KB | 512² webp q78 | **36 KB** | 1.05 MB |
| " | " | 720² webp q78 | **64 KB** | 2.07 MB |
| " | " | 960² webp q78 | **102 KB** | 3.69 MB |
| `earth-map-src.jpg` | 5400×2700, **2.51 MB** | 1600×800 webp q76 | **107 KB** | 5.12 MB |
| " | " | 2048×1024 webp q76 | **159 KB** | 8.39 MB |
| A baked gradient planet | Gradient Lab PNG export | 720² webp q78, grain **not** baked | **6 KB** | 2.07 MB |
| Same, with chunky grain baked in | " | 720² webp q82 | **50 KB** | 2.07 MB |

Two findings worth keeping:

- The masters must never ship raw — 2.51 MB for one decorative image. That was
  already the rule; these numbers confirm the scale of it.
- **Grain is what costs, not gradient.** A clean baked gradient is 6 KB; the same
  image with the contract's chunky static grain baked in is 50 KB — an 8× penalty for
  the noise. So the right build is: **bake the gradient clean, add the grain as a
  tiled SVG-turbulence data-URI**, which is exactly the trick `play.css:27` already
  uses on `.iris::before` (a 44×44 `feTurbulence` tile at `background-size:20px`, a
  few hundred bytes inline). That keeps the entire backdrop under ~10 KB *and* keeps
  gradient-notes **A5** — static, chunky, CSS-pixel cells — satisfied by
  construction.

So weight does not decide this. The next two things do.

### 3.2 The register argument — the one that actually decides it

**The heads are photographs.** They are cut-outs of real people with a real lighting
direction, a real white balance and real skin. That is the site's most distinctive
asset and its most fragile one.

Put a photographic Earth behind them and the two photographs enter a **collage**: two
sources, two lighting directions, two grain structures, two white balances, composited
into one frame. A collage of mismatched photographs is the single hardest thing on
this list to make look expensive, and it is the exact failure already recorded in the
project's own notes — *the heads are photos and the chrome is flat CSS: a materials
problem.* Adding a second photograph does not resolve that tension; it raises the bar
the chrome has to clear.

Put an **abstract** ground behind them and the photograph reads as *deliberately
staged*. The mismatch becomes the point. This is not a theory — it is why Mario Kart's
own globe is a saturated stylised Earth and not a satellite photo: the Miis are
stylised, so the world is stylised, and the registers match. Jayden's characters are
photographic, so his world should be the *opposite* register, not the same one.

The planet-pitch research reached the same conclusion for the pitch and I am reaching
it independently for the menu, from a different argument. That is worth something.

### 3.3 The halo is not a filter you can put on a photo

This deserves its own note because Jayden's phrasing — *"get the nasa imagery and add
our halo effect on it"* — assumes the halo is portable. It isn't, and the reason is
interesting.

Gradient Lab's halo (`gradientlab.html:56–61, 133, 630, 639–642`) is a **second WebGL
renderer**, at 64px, rendering the *same gradient field* as the disc but evaluated
**flat** instead of spherically, blurred by `calc(var(--R)*0.34)`, composited
`mix-blend-mode:multiply`, and gated to `form===0` (Planet) only. The source comment
is explicit about why:

> *"the halo evaluates the FLAT field: a glow continues outward — spherical maths
> beyond the disc clamps to one pale limb colour and rings."*

So the halo looks right **because it is made of the planet.** Behind a photograph
there is no field to evaluate — you would be hand-picking halo colours and hoping
they agree with a satellite image whose limb colour varies by longitude. The code
already warns about the failure mode this produces (*"the halo may only ever FADE —
the radial mask kills the pale ring"*). You would be re-introducing that ring by
hand.

A photograph can have a *glow* behind it. It cannot have *this* halo.

### 3.4 Where Blue Marble does belong

Unchanged from the addendum, and I want to defend it rather than just inherit it:
**the Globe Lobby draw.** Three reasons it works there and not here.

1. **It is transient.** You see it during a draw, for seconds, with an event
   happening. A permanent backdrop must recede; a ritual surface may dominate. Those
   are opposite requirements and the same image cannot serve both.
2. **Recognition is the joke.** The whole gag of the Globe Lobby is that it is Mario
   Kart's globe — actual Earth, actual continents, tiny heads standing on it. A
   gradient planet is not funny; a real Earth with your friends' faces on it is.
3. **It is the sky register**, which is the one place the addendum already licensed
   photography.

Ship it as the 512² disc at **36 KB** (or 720² at 64 KB if the draw zooms), never the
equirectangular master.

### 3.5 The compromise, if he wants Earth-ness in the menu

There is a third option that honours the instinct without the collage, and I think it
is worth prototyping before dismissing:

**Take Earth as a silhouette, not as a texture.** Derive a 1-bit landmass mask from
`earth-map-src.jpg`, ship it at ~1600px wide as a mask (not an image), and use it at
very low contrast — 4–8% — over the baked gradient planet, so continents read as a
faint tonal variation *in the gradient's own colours*, the way a globe's landmasses
read at dusk.

- Cost: a `mask-image` and a small alpha asset (~3–6 KB — masks compress far better
  than photographs).
- Result: "that's Earth" is legible, the gradient contract is intact (no competing
  photograph, no second lighting direction, seam chroma still ours), and the halo
  still has a real field to evaluate.
- Risk: at 4–8% it may read as dirt rather than geography. That is a one-afternoon
  experiment with a clear pass/fail, not a plan.

**Recommendation order:** baked gradient planet (ship it) → Earth-silhouette mask
(experiment) → photographic Earth in the menu (don't).

### 3.6 Bake it, do not run it

One engineering note that applies whichever way the image question lands.

Gradient Lab's `FluidMesh` is a live WebGL renderer with its own rAF loop plus a
second 64px halo renderer. `play.html` **already** hosts a WebGL context — the lava
engine (`play-engine.js:2603`, `initGL()`, with its own `webglcontextlost` handling).
Running Gradient Lab live as the hub's backdrop would mean two long-lived WebGL
contexts, two extra rAF loops and a shader recompile, on the page that also runs the
companion engine.

Use the export path instead: `gradientlab.html:1084–1100` already ships **Download
PNG** at 2048² for the Planet form with feathered alpha. Dial the planet, export,
downscale, convert, ship one `background-image`. **Runtime cost: one decoded image,
zero JS, zero canvas, zero shader.** And the look is the engine's look verbatim,
because it *is* the engine's output.

---

## 4. Mario Kart 8's online lobby — what actually transfers

Studied from Game UI Database's catalogued frames of the real screens, plus
Nintendo's own patch notes for the sequel — which turn out to be the most useful
critique available, because they are Nintendo naming its own mistakes.

### 4.1 What the screen actually is

The first correction is structural, and it changes what should be copied.

**MK8 Deluxe does not have a lobby. It has a matchmaking sequence.** Game UI
Database catalogues the entire online section as four screen types — Chat
Shortcuts & Emotes, Matchmaking Hub, Matchmaking Lobby, Map Voting — with **no
player-list or party screen at all**. The globe is a surface you *pass through* on
the way to a race, over about a minute, once.

Jayden's Play hub is the opposite: a **destination you return to**, with nobody to
wait for. So the thing to borrow is the *staging*, not the *sequence*. Copy how it
holds attention; do not copy its screens.

The sequence, as it really runs:

1. **Matchmaking Hub** — photoreal Earth with lens flare on the right two-thirds; a
   vertical stack of four chevron-shaped plates on the left (Worldwide / Regional /
   Friends / Tournaments), selected one gold with double-chevron caps.
2. **Connecting** — Earth fills the frame, a full-width black lower-third bar reads
   "Connecting…", a small segmented spinner bottom-right. No slots, no progress, no
   count.
3. **The wait** — **Miis stand on the curve of the Earth**, scattered along the
   horizon at different depths, in coloured racing suits, idling. More players =
   more bodies. **No name labels, no ratings, and no "X of 12" counter.** Headcount
   is communicated purely by how many bodies are on screen.
4. **Course suggestion** — four cards across the top: three courses plus a
   **"Random"** card. A yellow 7-segment numeral inside a ring of ~12–13 lamp dots
   counts down in the centre; lamps extinguish as it falls. A white hatched banner
   with checkered end-caps reads **"Waiting for everyone to suggest a course…"** —
   *suggest*, not vote. Picks accumulate as a row of small course tiles, **each with
   the suggesting player's Mii head badged into its bottom-left corner**.
5. **The draw** — the banner flips **white → solid yellow**: *"The course has been
   selected!"* A highlight cursor runs horizontally across the row of suggestion
   tiles and settles; the winner **scales up, gains a cream/gold frame and an
   engine-class badge**; the losers stay small. **Every Mii fist-pumps at once.**
6. **The loading screen** — and *this* is where the data lives: two columns of
   horizontal player cards, six per column, left column filling first. Each card
   carries a Mii portrait, a name, a country flag + name, and a **VR number in a
   large 7-segment face** (observed: 3843 down to 990). A bottom bar carries the
   cup shield with the engine class, the course name in large type, and a course
   thumbnail.

### 4.2 The five qualities that make it work — and which transfer

**1. Bodies, not a list. — Transfers completely; Jayden already has it.**
Population is legible peripherally, as a crowd, with no counter anywhere. Photo
heads standing on a planet is the same instrument, and arguably a stronger one,
because the heads are people the visitor actually knows. **Do not add an "8 of 8"
readout to the stage.** The crowd is the readout.

**2. Data is quarantined from the social screen. — Transfers, and it is the most
useful rule in the whole study.**
The globe screen carries *zero* data. Names, flags and skill numbers appear only on
the loading screen, once the race is locked in. Nintendo deliberately split "who is
here" from "who is good."

Applied here: the planet carries **no** stats, ever. Rosters belong on the
Expedition team screen; goals, assists and ratings belong on the tournament's
surfaces; the 1–12 ordering belongs on the standings screen at the end of a cup.
The hub stays a *place*, not a dashboard. This is also the rule that keeps the
four-card menu from growing a stats panel.

**3. The reaction beat. — Transfers, and it is cheap.**
The moment the draw resolves, three things happen together: a banner **changes
colour**, the winning tile **pops and gains a frame**, and **every character cheers
in unison**. Nothing else on screen moves. That single synchronised beat is what
turns a queue into an event, and it is the thing players actually praise.

The engine already has every piece: `__hmFX`, `A.pop()`, the aura system, the
confetti. A draw that resolves with all twelve heads cheering at once is the
tournament's best available moment and it needs no new primitive.

**4. Give the hands something to do. — Transfers, with a substitution.**
Deluxe added kart and character swapping *during* the course vote (L, or Y between
races), and one of the eight canned chat phrases exists purely to manage waiting
("Let's wait for more players."). Dead time gets converted into decision time.

There is no waiting on a portfolio, so the substitution is: **the team-select screen
is the thing to do**, and the Create-head card is the other one. That is already
what §1.5 promotes the tray into.

**5. Progressive disclosure of the payload. — Transfers.**
The roster, the course name and the class badge appear only on the *loading*
screen, so the last seconds before a race are spent reading who you are racing
rather than watching a spinner. Version 1.2.0 retrofitted exactly this ("Race rules
and course name are now displayed on loading screens"). The tournament's versus
ceremony should carry its payload the same way — the wait is where you deliver
information, not where you withhold it.

### 4.3 What Nintendo got wrong — the patch notes are the critique

This is better evidence than any forum thread, because it is the developer paying to
fix it in the sequel:

| Patch | What it says | What it means |
|---|---|---|
| **Mario Kart World 1.2.0** (Jul 2025) | "You can now see **the waiting time until the next race or battle starts**" | The wait had no ETA and players resented it. If Play ever makes you wait, say how long. |
| **MKW 1.6.0** (Mar 2026) | "**Shortened the time it takes for the roulette to stop** when determining the course" | **The draw animation was too long.** Nintendo shipped it, watched it, and cut it. |
| **MKW 1.1.0** (Jun 2025) | "**Eliminated the time limit for choosing courses**" in wireless/LAN | Among friends the countdown was friction, not tension. |

**The roulette note is the one to act on.** The tournament spec's random draw is
built on "Concept 3's roulette physics", and the instinct with a roulette is always
to let it run. Nintendo's own correction says otherwise — and this codebase already
has the matching scar: the **5600 ms celebration delay** that makes a working
bracket look stuck. Budget the draw's spin **short**, make it **skippable**, and put
the spend into the *resolution* beat (§4.2.3) rather than the spin. Anticipation is
in the settle, not the duration.

The second lesson is about **voting**. MK8DX's model is suggest-and-draw: your pick
is a lottery ticket, not a vote. The rational play is therefore to opt out of
expressing a preference — which is exactly what happened, to the point that
competitive rules *mandate* picking Random (PlayVS's official rulebook: a 15-point
penalty if you don't pick Random and your track is drawn), and the sequel's
dominant complaint is that voting is pointless.

Jayden's settled call — a **random pool draw**, not a vote — is therefore the
correct one, and this is independent confirmation of it. **Do not add a vote later.**
A draw is honest about being chance; a vote that is secretly a lottery is the thing
people resent.

### 4.4 What would be cosplay

Everything in this list is Nintendo's *material* language, and borrowing it on a
paper-and-hairline portfolio would read as costume:

- **Gold frames, corner brackets, double-chevron plates, checkered-flag end caps,
  hatched banners.** This is the visual grammar of a racing game. On this site it
  would be the only loud chrome anywhere.
- **7-segment LED numerals and the lamp-dot countdown ring.** Doubly wrong: it is
  Nintendo-specific, *and* the project's own photoreal note already records that
  **LED is a trap** on these surfaces. The split-flap the tournament already specced
  is the right mechanism for the same job and it belongs to this site's print
  register.
- **VR / skill ratings.** Borrowing a numeric skill economy implies a ladder that
  does not exist. The honest version is already specced: the tournament's final
  1–12 standings.
- **Country flags and canned chat.** There is one player. There is nobody to greet.
- **A countdown timer on the hub.** Nobody is waiting for anybody. A timer with no
  opponent is anxiety with no purpose. (Note that Nintendo *removed* the timer among
  friends in MKW 1.1.0.)
- **The four-card "3 + Random" suggestion screen.** It solves a group-consensus
  problem the hub does not have.
- **The photoreal Earth with lens flare.** Covered in §3 — and note the local-play
  lobby proves the point: the same screen "visually set in a **garage** rather than
  on a globe" works just as well, because the staging is doing the work, not the
  photograph.

### 4.5 The copy lesson, which is free

Nintendo's lobby voice is worth stealing outright because it costs nothing:
**present-progressive and plural while waiting, exclamation on resolution.**

> "Connecting…" → "Waiting for everyone to suggest a course…" → **"The course has
> been selected!"**

The plural is what makes a solitary screen feel populated, and the punctuation flip
is what marks the resolution. Both apply directly to the draw and to kickoff.

### 4.6 What Mario Kart World changed, and what it implies

The 2025 sequel doubled the field to **24** and made **the open world itself the
waiting room** — you free-roam while matchmaking, and the collectibles you pick up
there still count toward your totals, so waiting yields progression. Friends rooms
can set the intermission to **10 seconds, 1 minute, or 5 minutes** (the only hard
documented lobby durations in either game).

The implication for Play is a validation, not a feature: **the best waiting room is
a place you would want to be anyway.** Jayden's stage — heads wandering on a planet
— already is that. It does not need a mini-game bolted on; it needs to be left
running while the menu is open (§7.2.3).

### 4.7 Numbers, with confidence marked

| Thing | Value | Confidence |
|---|---|---|
| Players per online race | 12 (2–12) | Documented |
| Arrangement while waiting | Miis scattered on the globe, no labels | Observed in catalogued frames |
| Arrangement on the roster screen | 2 columns × 6 cards, left fills first | Observed |
| Course options | 3 courses + "Random" | Observed + corroborated |
| Numeric headcount in lobby | **none — absent, deliberately** | Observed |
| Vote/suggest timer duration | **undocumented** — frames exist at "9" and "5" | Do not publish a number |
| Roulette spin duration (MK8DX) | **undocumented** | Do not publish a number |
| MKW intermission options | 10 s / 1 min / 5 min | Documented |
| MKW field size | 24 | Documented |

Two numbers commonly repeated online — the vote timer and the spin length — have no
primary source. They are not quoted anywhere in this document, and they should not
be quoted in any plan derived from it.

---

## 5. Absorbing the head-maker and the gradient maker — link-first, in stages

Jayden's call is settled: **the hub links to the existing pages immediately so it is
complete and usable, and the rebuild follows as its own pass.** This section describes
that path and marks the seam.

### 5.1 What the two files actually are

I read both. The headline is that **they are unusually clean**, which is what makes a
staged path viable at all.

| | `headmaker.html` | `gradientlab.html` |
|---|---|---|
| Size | 95,569 B | 58,582 B (1,111 lines) |
| `<style>` blocks | 2 | 1 |
| `<script>` blocks | 2 (676 + 47 lines) | 1 inline `<script id="fluidEngine">` + page script |
| External assets | `vendor/heic2any.min.js` (**1.35 MB**, lazy — injected only when a HEIC is dropped, `headmaker.html:494–496`), 2 font files, favicons | **none at all** — no images, no scripts, inlines its own `@font-face` |
| Talks to the rest of the site via | `localStorage` only: `hmCompanion` (head on stage), `hmCompanions` (the crowd, up to 8) | `localStorage.glabPresets` only |
| Depends on `play-engine.js`? | **No.** 3 references total (`__hmNameSync`, `__hmRestore`), all guarded | **No.** Zero |
| Its own `:root` | yes | yes — `--paper:#f8f9fa; --ink:#232323; --sub:#75756e; --hair:#e7e6e1; --panel:rgba(255,255,255,.72); --accent:#0E6B3B` |
| Unique ids | 59 | ~60+ |
| Indexing | **`robots: index,follow`** + `<link rel="canonical" href="https://jaydenbetts.design/headmaker.html">` | `robots: noindex` |
| WebGL | no | **yes** — `FluidMesh`, plus a second 64px halo renderer |

Neither page is in `sitemap.xml` (which lists only `/` and `/bearings.html`), but
**`headmaker.html` is explicitly indexable and self-canonical**, and it is linked from
the home page three times (`index.html:2320` play menu, `:2433` Extras card, `:4489`
the "open this head in the maker" jump from a saved-head thumbnail). That URL has to
keep working. `gradientlab.html` is `noindex` and linked once (`:2448`), so it is free
to move.

### 5.2 Stage 0 — linked, and not feeling ejected (ships with the hub)

The two cards are ordinary links. The design work is entirely in making the
navigation feel like a *room*, not an *exit*:

1. **Identical card treatment.** Create head and Gradient maker are styled exactly
   like Expedition and Tournament. Nothing marks them as second-class. If the visitor
   cannot tell which two are "really" in the hub, the seam has done its job.
2. **A promise before the jump.** Each card carries one micro-line at
   `--fs-micro`/`--tr-caps` — *"opens full screen"*. It is not an apology, it is a
   promise being kept. Surprise is what makes a link feel like ejection; a promised
   full-screen transition feels like a door.
3. **`?from=play`, and the back link answers it.** Link as
   `headmaker.html?from=play`. On arrival, the destination's back affordance reads
   `← Play` and points to `play.html`, instead of `← Portfolio`. That is a handful of
   lines in each destination, no rebuild, and it closes the loop so the visitor is
   never stranded outside the hub.

   The two destinations are in very different shape for this:

   - `headmaker.html` already has the hook — `<a class="back" href="index.html">` at
     line 319. Only that one anchor becomes conditional; the logo (`:320`) and
     *"See it on my homepage"* (`:439`) should keep pointing home, because they mean
     something different.
   - **`gradientlab.html` contains zero `<a>` elements.** No back link, no logo, no
     navigation of any kind — its `<header>` is `pointer-events:none` decoration.
     Once a visitor lands there the only way out is the browser's Back button. That
     is a bug today and it becomes a much more visible one the moment the hub sends
     traffic to it. **Give Gradient Lab a back affordance in the same pass that adds
     the card** — it is the cheapest item in this whole document and the one most
     likely to be felt.
4. **Return with state.** The head-maker already writes `hmCompanions`, and the hub's
   Create-head card already wants to show the current crowd. So returning to
   `play.html` after making a head shows the new head *on the planet*. That round trip
   is the entire argument for putting the maker in Play — make sure stage 0 already
   delivers it, because it is the part that will be felt.
5. **The Create-head card *is* the roster.** Its face shows the current crowd (N of 8)
   as thumbnails. It is the only card with content rather than an icon, which is
   correct — Jayden called this the most important feature.

**The Extras consequence, flagged rather than performed.** Jayden asked to remove the
head-maker from Extras. If both makers move to Play, Extras is left with the reel and
one orphan — and if Gradient Lab also leaves (which consistency argues for; two entry
points to the same tool in two different sections is worse than either), Extras is
**just the reel**, which probably means the tab should fold into Featured rather than
survive as a one-item tab. That is a real editorial decision about `index.html`, and
`index.html` is locked for the concurrent rewrite. **Do not do it in this pass.** Log
it as the follow-up it is.

### 5.3 Stage 1 — make them look like Play before they live in Play

This is the "rebuild the UI to fit the new system" pass Jayden asked for, and it is
**much cheaper to do in the standalone file than mid-absorption.** Each is independent
and reversible:

- Adopt the token block from tokens §7 (`--r-*`, `--mat-*`, `--rim-*`, `--sh-*`,
  leading, tracking).
- Adopt header treatment **T2, the ledge** — the case studies are getting it, and it
  is the treatment recommended for pages without a Play menu of their own.
- Reconcile the palettes deliberately: Gradient Lab's `--paper:#f8f9fa` vs the site's
  `--c50:#FDFDFD`, and its `--hair`/`--sub`/`--panel`, none of which exist in
  `play.css`. **Scope them, do not merge them** — `.glRoot{--paper:…}` — because they
  will collide the moment the markup shares a document in stage 2.
- Radius sweep: both files predate the ladder. Gradient Lab's controls are the biggest
  single win (`--r-sm` for the sliders and selects, `--r-md` for `.miniBtn`,
  `--r-lg` for the panel).
- Targets: tokens §6 says 44px minimum. Gradient Lab's `input[type=color]` at 34px and
  its 20px slider thumbs are both under it (its mobile block already grew them
  partway — finish the job).

At the end of stage 1 the two tools *look* like they belong to Play while still living
at their own URLs. If the project stops here, nothing is broken and the hub is
coherent. That property is the whole point of staging it this way.

### 5.4 Stage 2 — hosting them in place, and the five traps

Only after stage 1. The mechanism: extract each tool to `play-headmaker.{js,css}` and
`play-gradientlab.{js,css}`, lazy-load on first `#head` / `#gradient`, render into a
full-stage panel.

**Trap 1 — the `fluidEngine` self-read.** `gradientlab.html:899` does:

```js
var engine = document.getElementById("fluidEngine").textContent;
```

The export path **reads the shader engine back out of its own `<script>` tag** to
embed it in the exported code snippet. Move `fluidEngine` to an external `.js` file
and `textContent` returns empty — the "copy the code" export silently produces a
broken snippet, with no error. Either the engine stays an inline
`<script id="fluidEngine">` in the host document, or the export gets rewritten to
fetch it. This is the sharpest non-obvious cost in the absorption.

**Trap 2 — the id and selector surface.** 59 + ~60 ids joining a document where
`play.css` already owns **126 distinct `.t*` selectors** and the engine queries by id
throughout. Namespace before merging, not after. Cheap generic ids like `#form`,
`#code`, `#grain`, `#glass`, `#halo`, `#layer` (all real Gradient Lab ids) are exactly
the ones that will collide.

**Trap 3 — the engine keeps running under the panel.** The companion engine binds
pointer handlers for dragging heads. Covering it with a panel does not unbind them,
and both makers are pointer-heavy (drag-to-crop, drag-the-node). The panel must call
`__hmFreeze` on open and release on close — visual covering is not sufficient.

**Trap 4 — a second live WebGL context.** Opening Gradient Lab inside `play.html`
creates a second WebGL context beside the lava engine's. `FluidMesh` already returns a
`destroy()`; it must be created on open and destroyed on close, never left running
behind the hub. Its rAF already self-gates on `document.hidden` and
`prefers-reduced-motion`, which helps, but a hidden panel is not a hidden document.

**Trap 5 — the URL.** `headmaker.html` is indexable and self-canonical. If it becomes
`play.html#head`, keep the old URL serving (a redirect, or a thin page that forwards)
and move the canonical. Losing it costs a real, linked, indexed page.

### 5.5 What "later" honestly means

Stage 0 is a day. Stage 1 is a day per tool and delivers most of the visible benefit
Jayden is asking for. Stage 2 is a plan of its own, and its value is *architectural*
(one page, one back button, state that never round-trips through a navigation) rather
than visual. If stage 2 never happens, the hub still works. That asymmetry is the
argument for this order.

---

## 6. The section header

### 6.1 What the page has today

Nothing. `play.html` has `<title>Play — Jayden Betts</title>`, a `← Portfolio` link at
`position:fixed;left:16px;top:16px`, and a corner menu. There is no h1, no eyebrow,
and no statement of what the section is. Jayden's complaint — *"we need a header for
this section like a title of what the play section is about"* — is exactly right, and
it is the same complaint as *"it kinda falls flat when you go to sub pages"* that
drove tokens §9.

### 6.2 Treatment

**Bar:** header treatment **T2, the ledge** (tokens §9.3) — full-width translucent
bar, `--r-lg`, 1px bottom rim, `--mat-2` + `--blur-2`. Play is the one sub-page where
T1's floating pill would compete with the four-card menu directly below it, and the
document already notes T2 "sits better under an editorial hero."

One deviation, stated so it is a decision and not a drift: **the bar sits on the sky,
so it takes `--mat-1` and light type rather than `--mat-2` and ink.** Everywhere else
the ledge sits on paper. Here it sits on a gradient, and gradient-notes **B2** — *"a
quiet stage for type; the gradient is atmosphere, the words are the subject"* — is
the licence.

**Title block**, below the bar, above the menu, over the sky, on `--mat-0` (no plate):

| Element | Token | Value |
|---|---|---|
| eyebrow | `--fs-micro` / `--tr-caps` / `--lh-flat` | `PLAY`, 600, at 62% opacity |
| gap | `--gap-eyebrow` | `.55em` |
| h1 | `--fs-h1` (`clamp(28px,2.6vw,38px)`) / `--tr-head` (`-.020em`) / `--lh-tight` | |
| gap | `--gap-head-bot` | `.42em` |
| sub | `--fs-lead` / `--tr-body` / `--lh-body` | max ~46ch |
| gap to menu | `--sp-24-48` | |

**Not `--fs-hero`.** Tokens §5.4 treats the hero `h1` as sacred to `index.html`; a
sub-page that borrows the hero size steals the home page's one loud voice. `--fs-h1`
is the sub-page display size and it is the right rung.

**Token gap to name:** nothing in the token layer covers *type over an image*. The
title needs a legibility floor that does not depend on the current gradient's
brightness. Two candidates — a `text-shadow` token (`--sh-type-over-media`), or a
short top-anchored scrim gradient on the stage. **Recommend the scrim**: it is one
`linear-gradient` on an element that already exists, it costs no per-glyph paint, and
it doubles as the sky's own dark end. A `text-shadow` on display type at 38px reads as
a 2005 web effect. Either way, **name it in the token file** rather than inventing it
inline — that is precisely how sixty one-off radii happened.

### 6.3 Copy

Jayden's voice on the site is short, first-person, concrete, slightly wry — *"Your
face, cut out like mine."* / *"Light, built in a shader."* Three directions in that
voice:

**A — the world** *(recommended for the title)*
> **PLAY**
> **A planet for the heads.**
> Make one, pick sides, run a cup. Everything here is a toy I actually built.

**B — the workshop**
> **PLAY**
> **The toy department.**
> Four things that had no business being on a portfolio. Here they are anyway.

**C — the invitation**
> **PLAY**
> **Your head goes here.**
> Cut one out, put it on the planet, and give it a game to play.

**Recommendation: A for the header, C's line on the Create-head card.** He asked for
"a title of what the play section is *about*", and A answers that literally while
naming the thing on screen. C is the stronger sentence but it is a *call to action*,
not a section title — and it does its best work at the exact moment it is actionable,
which is on the card that opens the maker. Using both puts each in the right place.

**B is the risky one.** "Toy department" is funny and it is also self-deprecating
about work that took months. It undersells the tournament broadcast package
specifically.

---

## 7. Performance

### 7.1 Correcting the baseline

- **`play.css` declares 2 blur rules, not 71.** Confirmed: `blur(.4px)` on
  `.iris::after` (line 27) and `blur(var(--fb,0px))` at line 1374. Zero
  `backdrop-filter`. The 71-blur figure in the token spec is `index.html`'s and does
  not apply here. Play therefore starts with a clean blur budget and can afford the
  ladder's **two simultaneous `backdrop-filter` surfaces** — spend them on the header
  bar and the open panel, and on nothing else.
- **"One shared rAF ticker" is not what the code does.** `play-engine.js` contains
  **25 `requestAnimationFrame` call sites**, and — the important one — `_frame` is
  defined *inside* `spawnCompanion` (`play-engine.js:643`, self-scheduling at 644,
  kicked per spawn at 1280). It is **one rAF loop per head**. With a full crowd of 8
  plus filler that is 8–10 concurrent loops **before any game starts**, plus the FX
  canvas loop, the soccer loop, the lava WebGL loop and the ticker/crowd loops when
  active. There is no shared ticker to join.

  I am not proposing to build one — that is a refactor of a 288 KB file with
  concurrent agents in it, and the per-head loop is deliberate (the comment at 643 is
  explicit that a removed head stops its loop for good, so there is no idle rAF left
  spinning). But the hub must be designed knowing the budget is **already spent**.

### 7.2 The rules the hub must follow

1. **The backdrop is a static image plus CSS. No canvas, no WebGL, no rAF.** This is
   the single most important one and it is the whole reason §3.6 says bake rather than
   run. The hub's most-seen surface must cost one decode.
2. **Menu enter/exit is CSS only** — `--sp-settle` (360ms) on transform and opacity,
   per tokens §3. Not a JS animation, and not a `filter` transition (an animated
   `filter` is a per-frame full-surface repaint).
3. **Do not pause the heads for the menu.** Heads walking around behind an open menu
   is the appeal of the whole page. Pause them only when a sub-surface *covers* the
   stage — `#head` and `#gradient` — via `__hmFreeze`, and only then.
4. **`IntersectionObserver` will not help here, and the brief's instinct to reach for
   it is wrong on this page.** `play.html` sets `html,body{overflow:hidden}` and the
   arena is `100vw × 60vh` with `margin:auto` — the stage is *never* scrolled out of
   view, so an observer on it never fires a useful change. The correct gating signals
   on this page are `document.hidden` (`visibilitychange`) and the hub's own
   panel-open state. Use those. Keep `IntersectionObserver` for `index.html`, where
   there is actually a scroll.
5. **Blur discipline.** `--blur-1/2` are already `0px` below 760px (tokens §4.3), so
   the mobile hub costs one tint and no blur. Above 760px: header bar + open panel,
   and the four cards get `--mat-2` + `--rim-1` with **no** backdrop-filter. Four
   simultaneously-blurred cards would be a permanent, full-width, always-visible blur
   — precisely what the budget's rule 5 forbids.
6. **Image budget for the hub:** baked gradient planet ~6 KB + tiled grain data-URI
   ~1 KB. If the Earth-silhouette experiment (§3.5) ships, +3–6 KB. Total under
   **~13 KB**. Compare the photographic route at 36–102 KB transfer and 1–3.7 MB of
   decoded texture, on a page already holding an FX canvas, a lava canvas and 8+ head
   DOM subtrees.
7. **Lazy-load the sub-surfaces.** Nothing for `#head` or `#gradient` is fetched until
   first open. At stage 0 this is free (they are separate pages). At stage 2 it is the
   requirement that keeps the hub's first paint cheap. Note that `heic2any.min.js` is
   **1.35 MB** and is already correctly lazy in the head-maker — whatever happens in
   stage 2, that must stay lazy.

### 7.3 What to measure before shipping

- Hub at rest with 8 heads: frame time, and the count of live rAF loops (expect
  8–10; if it is higher, something is leaking).
- Hub → Expedition screen → match start: no new persistent loop should survive the
  transition.
- Real Chrome, not the embedded pane — the project notes record that the embedded
  preview white-screens on the ink filters, and `play.html` inlines three of them.

---

## 8. Open questions for Jayden

1. **"Expedition" or "Exhibition"?** (§1.4) The code already says Exhibition.
2. **Dark stage now, full dark never — or full dark as its own plan later?** (§2.4)
3. **Earth-silhouette mask** (§3.5) — worth the one-afternoon experiment, or skip
   straight to the pure gradient?
4. **Does Gradient Lab leave Extras too?** (§5.2) Consistency says yes; that leaves
   Extras as one reel, which is an `index.html` editorial decision and `index.html` is
   locked.
5. **Header copy A, B or C** (§6.3) — recommendation is A, with C on the card.
6. **Gradient Lab has no way back** (§5.2) — it has zero `<a>` elements. Fix in the
   same pass that adds the card; no decision needed, just permission.

---

## Sources

- `docs/superpowers/specs/2026-08-02-planet-pitch-research.md` — render-curved /
  physics-flat; the case against Blue Marble for the pitch; the Gradient-Lab-bake
  pipeline.
- `docs/superpowers/specs/gradient-reference-notes.md` — §A1–A6 physics, §B1–B4 UI.
- `docs/superpowers/specs/2026-08-02-design-tokens.md` — §1 radius, §3 motion, §4
  materials + blur budget, §5 type, §6 targets, §7 the token block, §9 the header.
- `docs/superpowers/specs/2026-07-30-tournament-broadcast-design.md` — Matchday Print;
  the Globe Lobby addendum (`:422–452`), the sky/ground register split, the no-WebGL
  rule for the globe.
- `docs/superpowers/specs/2026-08-02-next-chapter-brief.md` §3.7–3.9.
- `docs/superpowers/specs/2026-08-02-play-page-design.md` §4.1–4.5, §5.
- Code read: `play.html`, `play.css`, `play-engine.js`, `play-games.js`,
  `headmaker.html`, `gradientlab.html`, `index.html` (read only), `specimen.html`,
  `vercel.json`, `sitemap.xml`.
- Measurements taken with `sips` + `cwebp` on the committed Blue Marble masters, and
  on a synthesised gradient-plus-grain control image, in a scratch directory.

**Web, for §4:**

- [Game UI Database — Mario Kart 8 Deluxe](https://www.gameuidatabase.com/gameData.php?id=83) —
  the screen taxonomy (four online screen types, no player-list screen) and the
  catalogued frames of the matchmaking hub, the connecting state, the globe wait,
  the course-suggestion screen, the draw, the pre-race roster and the canned chat.
- [Game UI Database — Mario Kart World](https://www.gameuidatabase.com/gameData.php?id=2104) —
  online screens not yet catalogued.
- [Super Mario Wiki — Mario Kart 8 Deluxe](https://www.mariowiki.com/Mario_Kart_8_Deluxe) and
  [its update history](https://www.mariowiki.com/Mario_Kart_8_Deluxe_update_history) —
  the globe-vs-garage lobby, the engine-class badge as a Deluxe addition, the
  cc-randomisation bands, kart swapping during the vote, Ver. 1.2.0 adding race
  rules and course name to loading screens.
- [Super Mario Wiki — Mario Kart World](https://www.mariowiki.com/Mario_Kart_World) —
  24 racers, free-roam as the waiting room, per-mode ratings, configurable
  intermission.
- [Nintendo — How to update Mario Kart World](https://en-americas-support.nintendo.com/app/answers/detail/a_id/68580/~/how-to-update-mario-kart-world)
  and the [UK mirror](https://www.nintendo.com/en-gb/Support/Nintendo-Switch-2/Game-Updates/How-to-Update-Mario-Kart-World-2842542.html) —
  **the primary critique**: 1.2.0 adds a visible waiting-time ETA; 1.6.0 shortens
  the roulette; 1.1.0 removes the course-choice time limit.
- [Nintendo Support — MK8DX local/online multiplayer](https://en-americas-support.nintendo.com/app/answers/detail/a_id/29175/~/how-to-start-a-local-or-online-multiplayer-game-(mario-kart-8-deluxe)) —
  12 players.
- [PlayVS — Mario Kart 8 Deluxe rulebook](https://help.playvs.com/en/articles/5872507-mario-kart-8-deluxe-rulebook) —
  the mandated Random pick and its 15-point penalty; Y-to-customise between races.
- [Nintendo Life — MKW 1.2.0 patch notes](https://www.nintendolife.com/news/2025/07/mario-kart-world-has-been-updated-to-version-1-2-0-here-are-the-full-patch-notes),
  [1.6.0 patch notes](https://www.nintendolife.com/news/2026/03/mario-kart-world-has-been-updated-to-version-1-6-0-here-are-the-full-patch-notes),
  [MKW review](https://www.nintendolife.com/reviews/nintendo-switch-2/mario-kart-world) —
  inconsistent lobby fill times.
- [GamesRadar on the Random-pick workaround](https://www.gamesradar.com/games/super-mario/mario-kart-world-rarely-lets-you-play-classic-3-lap-races-online-but-players-have-found-a-workaround-to-avoid-the-divisive-intermission-tracks-altogether/)
  and [the 1.1.2 backlash](https://www.nintendolife.com/news/2025/06/fans-reckon-nintendo-has-killed-mario-kart-world-with-its-latest-update) —
  why suggest-and-draw makes preference-expression irrational.

Reddit, GameFAQs, IGN, Eurogamer, Polygon and interfaceingame all blocked fetching,
so the player-sentiment claims lean on games-press coverage rather than the threads
themselves. The two numbers most often repeated online — MK8DX's vote-timer length
and its roulette spin duration — have **no primary source** and are deliberately not
quoted anywhere above.
