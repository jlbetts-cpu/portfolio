# Interactive accent — a blue for "this responds to you"

2026-08-03. Companion to `2026-08-02-design-tokens.md` (the token layer) and
`2026-08-02-case-study-teardown.md` (where the reference's own accent behaviour was
measured).

**Status: proposal. Nothing here has been applied.** No existing file was touched by
this pass. The two artefacts are:

- `accent-swatches.html` — standalone, no dependencies, sits on the real `--c50` paper,
  renders every candidate on real components at desktop and inside a true 390px iframe,
  and computes every contrast ratio at runtime from the rendered pixels.
- this document.

Screenshots: `.superpowers/sdd/2026-08-02-play-page/accent-*.png`.

---

## 0. The claim, verified

The brief's reading was right, and slightly understated. Verified at `1cefa41`:

**`--accent: #0E6B3B` is defined in four places** — `index.html:46`, `play.css:19`,
`tokens.css:14`, `specimen.html:20` — and consumed by exactly **seven** production
rules:

| File | Rule | What it is |
|---|---|---|
| `index.html:1218` | `.tM.tLive{border-color;box-shadow}` | live match card |
| `index.html:2244` | `.tResRow.tResLive{box-shadow:inset 2px 0 0}` | live result row rail |
| `play.css:497` | `.tM.tLive` | same, Play copy |
| `play.css:1399` | `.tResRow.tResLive` | same, Play copy |
| `apollo.html:445` | `.back:hover,.back:focus-visible{color}` | **the borrowed one** |
| `bearings.html:445` | ditto | **borrowed** |
| `cluster.html:445` | ditto | **borrowed** |
| `strata.html:462` | ditto | **borrowed** |
| `ucdavis.html:470` | ditto | **borrowed** |

`--accent-live: #17A45A` is defined in `index.html:46` and `play.css:19` (**not** in
`tokens.css` — the case studies never needed it) and consumed by six rules, all
tournament: `index.html:1926/1928/2050`, `play.css:1081/1083/1205` — the "NOW" round
heading, its pulsing dot, and the ticket-stub dot.

So: **two of nine consumers are the accident.** Everything else is broadcast.

**A second finding the brief didn't mention.** `index.html:47` documents `--accent` as
*"hero keyword phrases + the active case-study tab."* Neither is true any more —
`.csTab.on` is `color:var(--c950)` (`index.html:466`) and no hero rule references
`--accent`. That comment is stale and has been describing a colour the site doesn't use
that way. Part of why the green got borrowed is that the only in-repo documentation of
`--accent` says it is a general highlight.

Non-production files also use `--accent` as a general-purpose UI colour — `specimen.html`
(12 rules, including `.inp:focus{outline:2px solid var(--accent)}`), `gradientlab.html`
(4, including two focus rings), `orbs.html` (1 focus ring). These are internal tools, not
the site. They are listed in §5 for completeness but are the last thing to migrate.

---

## 1. The recommendation

```css
--accent:       oklch(52% 0.18 262);    /* #2961CE */
--accent-press: oklch(44% 0.16 262);    /* #1B4BA9 */
--accent-wash:  oklch(94.7% 0.018 262); /* #E7EEFA */
--accent-dark:  oklch(72% 0.12 262);    /* #7BA4F0 — dark grounds only */
```

One hue (262°) at four energies, so the family reads as one colour. Ship the OKLCH value
with a hex fallback behind `@supports not (color:oklch(50% .1 200))` — the same pattern
`accent-swatches.html` uses. Every current target browser supports `oklch()`; the
fallback is one rule of insurance, not a parallel palette.

### 1.1 Measured contrast

Read from the rendered pixels in Chrome via canvas (`getComputedStyle` returns
`oklch()` verbatim for oklch author values, so a naïve `rgb()` parse gives garbage —
`accent-swatches.html` paints to a 1×1 canvas and reads the bytes instead). WCAG 2.x
relative-luminance formula.

**`--accent` #2961CE:**

| Ground | Ratio | Body text 4.5 | Large text / non-text 3.0 |
|---|---|---|---|
| `--c50` #FDFDFD (paper) | **5.59:1** | pass | pass |
| `--c75` #F1F1F1 (hover-row fill) | **5.03:1** | pass | pass |
| `--c100` #E6E6E6 (hairline fill) | **4.55:1** | pass (margin: 0.05) | pass |
| pure `#FFFFFF` | 5.68:1 | pass | pass |
| `--c950` #121212 (dark button) | 3.30:1 | **fail** | pass |

It clears 4.5:1 on **every light ground in the ramp down to `--c100`**. That was the
selection criterion, not an accident — see §1.3. It does **not** clear 4.5:1 as text on a
`--c950` fill; nothing in §3 asks it to.

**The rest of the family:**

| Token | Ratio | Against |
|---|---|---|
| `--accent-press` #1B4BA9 | 7.86 / 7.08 / 6.41 | paper / c75 / c100 — pass everywhere |
| `--accent-press` as a fill | 8.00:1 for white text | pass |
| `--accent` as a fill | 5.68:1 for white text | pass |
| `--accent-wash` #E7EEFA | **1.15:1** vs paper | **fails 3.0 as a boundary** — see §3.3 |
| `--accent-wash` | 16.06:1 for `--c950` on it; 4.87:1 for `--accent` on it | both pass |
| `--accent-dark` #7BA4F0 | 7.24:1 on a #0E1626 sky; 7.50:1 on `--c950` | pass |
| `--accent-dark` on paper | 2.45:1 | fails — it is not interchangeable |

### 1.2 Where it sits relative to the two references

| | OKLCH | Hex | On paper |
|---|---|---|---|
| Apple system blue | `oklch(60.3% 0.218 257.4)` | `#007AFF` | **3.95:1** |
| Reference site (trungvo.xyz) | `oklch(57.9% 0.215 258.0)` | `#0072F5` | **4.37:1** |
| **Ours** | `oklch(52% 0.18 262)` | `#2961CE` | **5.59:1** |

Deltas: **−8.3 pp lightness** from Apple, **−5.9 pp** from the reference; **+4.5°** and
**+3.9°** hue; slightly lower chroma than both.

**Why it sits there, in order of weight:**

1. **Neither reference passes 4.5:1 for body-size link text on our paper.** Apple's is
   3.95:1; the reference's is 4.37:1. The reference uses its blue on a 14px back-link —
   body size — so that instance does not meet AA on its own page. We can't copy a value
   that fails the requirement our own text has. Getting to 4.5:1 in this hue means
   dropping to roughly L 56% at the very best; going to L 52% buys the margin that keeps
   it legal on `--c75` and `--c100` too. **That is the real reason ours is darker, and it
   is a requirement, not a preference.**
2. **Apple's `#007AFF` isn't a spec anyway.** Apple ships an adaptive `systemBlue`
   trait-dependent token, not a fixed hex; `#007AFF` is community-measured and shifts
   between OS versions, and Apple itself uses `#0A84FF` in dark mode. Pinning it would be
   pinning a rumour — and it would make the site read as "an iOS app in a browser," which
   is the opposite of the photo-first, paper-first direction.
3. **The +4° hue shift is the taste layer.** 262° is a half-step toward indigo. Against
   near-black ink (`#121212`) and warm photography, the indigo lean reads as *ink that got
   charged* rather than *a system link colour*. It is adjacent — nobody would call it a
   different colour family — but side by side on the swatch page the difference is
   visible, which is exactly the "similar but not the same" Jayden asked for.
4. **Lower chroma (0.18 vs 0.215).** The accent only ever appears on small, transient
   surfaces (§3). At that size, high chroma reads loud; at 0.18 it still reads
   unmistakably blue without competing with the work. Below ~0.15 it starts reading
   denim-grey and stops confirming "this is live."

The reference's wash `#E0F0FF` was also measured. Ours (`#E7EEFA`) is deliberately
*less* saturated and one step lighter, because our paper is `#FDFDFD` rather than pure
white and a saturated wash reads as a coloured card rather than a state.

### 1.3 Why OKLCH is the working space here

Lightness in OKLCH is perceptual, so `52% → 44%` is the same *felt* step down for the
pressed state as it would be for any other hue — which matters because if a second accent
is ever added it has to feel like the same family. It also makes the constraint
explicit: at hue 262 the sRGB gamut allows chroma up to 0.241 at L 52%, so 0.18 sits at
75% of maximum and has room to survive a wider-gamut display without clipping.

`color-mix(in oklch, …)` is already approved in this project, and works for the derived
values:

```css
--accent-press: color-mix(in oklch, var(--accent) 82%, var(--c950));
--accent-wash:  color-mix(in oklch, var(--accent) 10%, var(--c50));
```

**But ship the literals, not the mixes.** Two reasons. (a) `--c50` is achromatic, so its
hue is *powerless* in a polar space; browsers carry the hue forward from the other
operand, which is what we want, but it is an easy behaviour to get wrong when someone
later swaps `--c50` for a tinted paper. (b) The literals above were tuned by eye on the
swatch page; the mixes land near them but not on them. Use `color-mix` for one-off local
tints (a hover at 8% of the accent, say), not for the tokens themselves.

### 1.4 Dark grounds — yes, a variant is needed

The Play section is getting light chrome on a dark sky. `--accent` on a #0E1626 sky is
**3.18:1** — fails as text. `--accent-dark` #7BA4F0 is **7.24:1** on the same sky and
7.50:1 on `--c950`. This is structurally the same move Apple makes going `#007AFF` →
`#0A84FF`; ours is a bigger jump because our base is darker to begin with.

Ship it as a separate token rather than a media-query override of `--accent`, because
the dark ground on this site is a *region* (the Play sky), not a user preference. A
`prefers-color-scheme` swap would recolour the whole site, which nobody asked for. If a
dark region ever needs it globally, scope it:

```css
.playSky{--accent: var(--accent-dark)}
```

---

## 2. How a viewer tells "interactive" from "live"

They must never be confusable, and colour alone does not achieve that. Here is the honest
picture:

- **Hue is 108° apart** (blue 262°, emerald 154°). Under protanopia and deuteranopia —
  the common CVDs — blue and green stay distinguishable.
- **Lightness is nearly identical.** `--accent` vs `--live-deep` is **1.16:1** direct
  contrast. In greyscale they are the same value. So hue is doing *all* the separating,
  and hue is the channel that fails first.

Therefore the separation must be carried by **role and geometry**, and it already is:

| | Live (green) | Interactive (blue) |
|---|---|---|
| Geometry | a **border, fill or dot on a card** | **text, an underline, or an outline** |
| Location | inside the tournament board only | chrome — rail, nav, footer |
| Trigger | the app's state | the pointer or the keyboard |
| Non-colour cue | a dot **and** the word "NOW" | hover motion, an underline, a focus ring |

**Two rules that follow, and they are not optional:**

1. **Green never colours text; blue never fills a card.** If either is ever violated the
   whole distinction collapses.
2. **Never place them adjacent as two text colours.** There is no context in the current
   design where they meet — the tournament board is a self-contained object and the
   accent lives on chrome. Keep it that way.

**One pre-existing gap, noted not fixed:** `.tM.tLive` and `.tResRow.tResLive` signal
"live" with colour alone (border colour / row fill). WCAG 1.4.1 wants a second channel.
The round heading already carries the dot + "NOW", so the *round* is fine; the individual
match card is not. Cheapest fix, for whoever owns the tournament: a "LIVE" text chip or a
reuse of the existing `.tkDot` on the live match card. Out of scope here.

---

## 3. Where the accent is allowed to appear

Jayden's standing principle is *premium = subtract; put the smarts in behaviour, not
visuals*. A new colour is a net addition, so it has to earn every surface. The honest
answer is that it earns **very few**.

The site's current interaction language is **grey → ink** (`.navLink:hover`,
`.talk:hover`, `.abLink:hover` all resolve toward `--c950`) or **hairline → darker
hairline** (`.sbBtn`, `.tvTab`, `.toTop`). That language works. The accent is not
replacing it — it is adding one signal in the two places where "grey → ink" is too quiet
to read as a control.

### 3.1 Allowed — the whole list

**1. The case-study back link.** `.back:hover, .back:focus-visible` on the five case
studies. This is the element that started the whole question, it is already coloured, and
it is the one place on the site where a grey word at the top of a rail needs colour to
confirm it is live rather than a caption. Per the teardown, this is exactly what the
reference does and why it works. **Change: repoint the token, don't add a rule.**

**2. Text-link hover, where the link is genuinely a link in prose.** Today that is
`.footIn` in the footer (currently hovers by darkening its underline to `--c950`) and any
future inline prose link. Rest state stays ink with a `--c100` underline; **hover** moves
colour and underline to `--accent`; `:active` to `--accent-press`.

That is it. Two surfaces.

**3. Conditional: the focus ring.** See §4 — the recommendation is *don't*, but the
swatch page shows both so Jayden can overrule by eye.

**4. Conditional: the Play sky's link hover**, using `--accent-dark`, if and when the
dark region ships with links in it.

### 3.2 Not allowed — and why, specifically

- **Body copy, headings, the hero headline, any content type.** The hero h1 is sacred.
- **The wordmark.**
- **Any button fill.** The primary button stays `--c950`. The dark button is the site's
  one solid object and it earns attention precisely by being the only one; a blue button
  would duplicate its job and start competing with the photography. `accent-swatches.html`
  shows the blue-filled button so the comparison is visible — it is shown to be rejected.
- **The active nav / current-page state.** This is the tempting one and it is the wrong
  call. The teardown's own conclusion #2, from measuring the reference: *"the active tick
  grows 16px → 28px, not just dark. Length is peripherally legible; colour alone isn't."*
  The active state should be carried by length, weight or ink — not hue. `.csTab.on` stays
  `--c950`. The swatch page shows a blue underline and a wash pill; both are labelled
  "not recommended."
- **`.ndLink`, `.abLink`, `.tvTab`, `.sbBtn`, `.toTop`, `.moodBtn` hovers.** These are
  buttons and chips with working border/ink hovers. Colouring them would put blue in the
  play menu and the About sheet, which is the "sprouts blue everywhere" regression.
  (Aside, unrelated to this spec: `.ndLink:hover{color:var(--c500)}` at `index.html:85`
  goes *lighter* on hover, which is backwards. Worth someone's attention.)
- **`::selection`.** Tempting, invisible value, leave it.
- **Rest-state underlines.** Rest stays `--c100`; the colour is the *response*, not the
  default.
- **Card, image and photo-frame hovers.** These use shadow and border and are correct.
- **Anything inside the tournament board.** Green owns that region entirely.
- **A `:visited` colour.** Explicitly not warranted. The site has roughly ten real links,
  nearly all navigation; a visited colour would put a second blue in the palette to
  distinguish states that are already obvious from context, and it leaks browsing state
  visually for no navigational benefit. If prose links ever multiply into a real link
  set, revisit.

### 3.3 The wash needs a warning label

`--accent-wash` is **1.15:1** against paper. A pill whose only distinguishing feature is
that fill is *invisible* as a state boundary and fails 1.4.11. It is a ground, never a
boundary and never text. If the wash is used at all, it must be paired with `--accent`
label text (4.87:1 on it — passes) or a weight change. Given §3.2 rejects the active-nav
pill, `--accent-wash` currently has no approved use. Ship it only if a use appears; it is
documented here so nobody re-derives it badly later.

---

## 4. Focus rings — recommendation: keep `--c950`

Current: `outline:2px solid var(--c950); outline-offset:3px`, applied through big
selector lists (~60 selectors across `index.html`, `play.css` and the five case studies).

**Measured:**

| Indicator | vs paper `--c50` | vs a `--c950`-filled control |
|---|---|---|
| `--c950` (today) | **18.42:1** | 1.00:1 |
| `--accent` | **5.59:1** | 3.30:1 |

Both clear the 3:1 non-text requirement of WCAG 1.4.11 against the page background. The
1.00:1 column looks alarming and **is not actually a failure**: every ring on the site
uses a **positive** `outline-offset` (`3px`, `6px` on `.csGo`), so a band of paper always
separates the ring from the control, and paper is the adjacent colour that counts. The
one negative-offset ring, `.mhToggle:focus-visible` at `index.html:908`
(`outline-offset:-2px`), sits on a `background:none` control over paper — also fine.

So the accent ring is not an accessibility *fix*. It would be an identity change that
trades **18.42:1 for 5.59:1** — a real reduction in how findable the ring is for keyboard
users — plus ~60 selectors of mechanical churn, in service of consistency the two
surfaces in §3.1 already deliver.

**Recommendation: leave the focus ring as `--c950`.** It is the subtractive choice, it is
already the most legible indicator on the page, and it keeps the accent meaning exactly
one thing.

**If Jayden overrules by eye** (the swatch page shows both side by side with the numbers
attached), the accent ring is legal and the migration is a single find-and-replace of
`outline:2px solid var(--c950)` → `outline:2px solid var(--accent)`. In that case add the
wash as a halo so the ring keeps its presence:

```css
outline:2px solid var(--accent); outline-offset:3px;
box-shadow:0 0 0 5px var(--accent-wash);
```

**One thing that must change either way:** on the dark Play sky, a `--c950` ring is
invisible (1.00:1 against a dark backdrop, with no paper gap to save it). Any focusable
control inside the dark region needs `outline-color: var(--c50)` or `var(--accent-dark)`.
That is a new rule, not a migration — flag it to whoever builds the sky.

---

## 5. Naming and migration

### 5.1 The names

`--accent` currently means "live." That is the lie at the root of this. Proposal:

| New token | Value | Was | Means |
|---|---|---|---|
| `--live-deep` | `#0E6B3B` | `--accent` | live match: border, result rail |
| `--live-bright` | `#17A45A` | `--accent-live` | live dot, "NOW" round heading |
| `--accent` | `oklch(52% 0.18 262)` | *(new)* | interactive |
| `--accent-press` | `oklch(44% 0.16 262)` | *(new)* | pressed |
| `--accent-wash` | `oklch(94.7% 0.018 262)` | *(new)* | tint ground (no approved use yet) |
| `--accent-dark` | `oklch(72% 0.12 262)` | *(new)* | interactive, on dark grounds |

**Reclaiming the bare name `--accent` for the interactive colour is deliberate** — the
shortest name should be the one designers reach for most, and "accent" without a
qualifier now means the same thing it means in every other design system. `--live-*` is
honest about being a broadcast state, and pairs with the `--live-deep` / `--live-bright`
two-lightness structure that already exists.

### 5.2 Migration order — and why it must be two commits

Reclaiming `--accent` is safe **only** if the green is gone from that name first.
Otherwise any call site missed in the rename silently turns blue, and a silent
tournament-turns-blue bug is exactly the kind of thing that ships.

**Commit 1 — rename the green. Introduce nothing.**
Rename `--accent` → `--live-deep` and `--accent-live` → `--live-bright` at every
definition and every call site below. Then assert:

```sh
grep -rn -- "--accent" --include="*.html" --include="*.css" --include="*.js" . \
  | grep -v index-local-preview | grep -v accent-swatches.html
```

must return **zero** production hits. Any rule that was missed now falls back to
`inherit`/`initial` and breaks *visibly*, which is what we want.

**Commit 2 — introduce the blue.** Add the four `--accent*` tokens to `tokens.css`, then
repoint the five back-link rules and add the `.footIn` hover.

**Where the tokens live.** `tokens.css` is shared by the five case studies, so the
interactive accent belongs there — that is where the back-link rules resolve it from.
`index.html` and `play.css` are **not yet wired to `tokens.css`** (`tokens.css:11`), so
until that extraction lands they need their own copy of the same four lines in their
`:root`. Keep the two copies byte-identical and delete them when the wiring pass runs.
`--live-deep` / `--live-bright` should live in `index.html` and `play.css` only —
`tokens.css` has no consumer for them once the back-links stop using the green.

### 5.3 Every call site

Line numbers are as of `1cefa41` and **will drift** — `play.css` moved 28 lines during
this pass alone from concurrent edits. The greps in §5.2 are the source of truth; treat
the table as a map, not coordinates.

**Commit 1 — `--accent` → `--live-deep`:**

| # | File:line | Rule |
|---|---|---|
| 1 | `index.html:46` | `:root` definition |
| 2 | `index.html:47` | **the stale comment** — rewrite, don't just rename (see §5.4) |
| 3 | `index.html:1218` | `.tM.tLive{border-color;box-shadow}` |
| 4 | `index.html:2244` | `.tResRow.tResLive{box-shadow:inset}` |
| 5 | `play.css:19` | `:root` definition |
| 6 | `play.css:497` | `.tM.tLive` |
| 7 | `play.css:1399` | `.tResRow.tResLive` |
| 8 | `tokens.css:14` | `:root` definition — **delete** rather than rename; no case-study consumer survives commit 2 |
| 9 | `tokens.css:5` | header comment lists `--accent` — update |

**Commit 1 — `--accent-live` → `--live-bright`** (all carry an `#17A45A` literal fallback;
keep it, retarget the var name):

| # | File:line | Rule |
|---|---|---|
| 10 | `index.html:46` | `:root` definition |
| 11 | `index.html:1926` | `.tCupRdH.tRdNow{color}` |
| 12 | `index.html:1928` | `.tCupRdH.tRdNow::after{background}` |
| 13 | `index.html:2050` | `.tkDot{background}` |
| 14 | `play.css:19` | `:root` definition |
| 15 | `play.css:1081` | `.tCupRdH.tRdNow` |
| 16 | `play.css:1083` | `.tCupRdH.tRdNow::after` |
| 17 | `play.css:1205` | `.tkDot` |

**Commit 2 — repoint to the blue:**

| # | File:line | Change |
|---|---|---|
| 18 | `tokens.css` `:root` | add the four `--accent*` tokens + the `@supports` hex fallback |
| 19 | `index.html:46`, `play.css:19` | add the same four (temporary duplicate — see §5.2) |
| 20 | `apollo.html:445` | `.back:hover,.back:focus-visible{color:var(--accent)}` — value changes, text doesn't |
| 21 | `bearings.html:445` | ditto |
| 22 | `cluster.html:445` | ditto |
| 23 | `strata.html:462` | ditto |
| 24 | `ucdavis.html:470` | ditto |
| 25 | `index.html` `.footIn:hover,.footIn:focus-visible` | `text-decoration-color:var(--c950)` → `color:var(--accent);text-decoration-color:var(--accent)`; add `:active` → `--accent-press` |

Rules 20–24 are literally zero-diff after the rename — the same seven characters,
resolving to a different value. That is the whole point of doing the rename first.

**Deferred — internal tools, not the site.** These use the emerald as a general accent,
including for focus rings, which is the same confusion at smaller scale. Migrate them to
the new `--accent` when convenient; nothing depends on it.

- `specimen.html:20` (def), `:105, 160, 168, 201, 303, 319, 356, 373, 375, 444, 515, 546`
- `gradientlab.html:14` (def), `:102, 107, 114, 122`
- `orbs.html:11` (def), `:41`
- `index-local-preview.html` — a stale build artefact; leave it.

### 5.4 The comment at `index.html:47`

It currently reads:

> `--accent`: the one restrained highlight (deep emerald, 6.5:1 on white) — hero keyword
> phrases + the active case-study tab; `--accent-live`: a brighter "available" status dot

The measurement is right (6.59:1 on `#FFFFFF`, 6.48:1 on `--c50`); the usage claim has
been false for a while. Replace with something that will stay true:

```css
/* --live-deep / --live-bright: the broadcast "happening now" signal. Tournament only:
   live-match border, live result rail, the round dot. Never on text outside the board.
   --accent + friends: the interactive signal -- link and back-link hover, and nothing
   else without a spec change. See docs/superpowers/specs/2026-08-03-interactive-accent.md */
```

---

## 6. The swatch page

`accent-swatches.html`, served at `http://localhost:4173/accent-swatches.html`. Standalone,
vanilla, no dependencies beyond the site's own `fonts/` woff2 files.

- **Section 1** — the four accent tokens plus the two greens, each with its hex, its
  OKLCH, its contrast on paper / c75 / c100, and a one-line statement of what it is for.
- **Section 2** — Apple, the reference, ours, and the two greens as 16px link text on the
  real paper, with pass/fail against 4.5 and 3.0. The two references' FAIL badges are the
  argument of §1.2 made visible.
- **Section 3** — real components: the back link (rest + hover), a 16px prose link
  (rest / hover / pressed), an active nav item, buttons, both focus rings including on a
  dark button, and the accent on `--c75`. Each panel carries a **Recommended / Not
  recommended / Jayden's call** chip matching §3.
- **Section 4** — live green and interactive blue side by side, with the 1.16:1 direct
  contrast printed so the §2 caveat is visible rather than buried.
- **Section 5** — a dark panel showing `--accent-dark` correct and `--accent` misused.
- **Section 6** — the whole page again in a real 390px iframe.

**Every number is computed in the browser at runtime.** Nothing is typed in. Two
implementation notes worth keeping, because both cost time:

1. `getComputedStyle(el).color` returns `oklch(0.52 0.18 262)` verbatim for an `oklch()`
   author value, not `rgb()`. Parsing it as three 0–255 channels yields near-black for
   everything and *looks* plausible. The page resolves the `var()` through a probe
   element and then paints to a 1×1 canvas, reading back real sRGB bytes — which also
   applies the same gamut clamp the display does.
2. The 390px preview iframe must be injected by script and skipped when the page is
   already inside it. A static `<iframe src="accent-swatches.html?frame=1">` recurses —
   hiding the section with `display:none` in the framed copy does **not** stop the nested
   iframe from loading — and the renderer paints nothing at all.

**Testing note:** headless Chrome clamps layout to a 500px minimum regardless of
`--window-size=390`, so a headless "390px" screenshot lays out at ~500 and crops to 390,
which reads as a horizontal-overflow bug that isn't there. The section-6 iframe is the
only honest mobile check. Verified at 390: `document.documentElement.scrollWidth === 390`,
no overflow. (The comparison table needs its own `overflow-x:auto` container and a
`min-width` to keep it from widening the document — that is a real fix, applied.)

Screenshots:

- `accent-swatches-desktop-1280.png` — top of page at 1280
- `accent-swatches-desktop-full.png` — the whole page, 1280×4800
- `accent-components-desktop-1280.png` — section 3, all component panels
- `accent-live-vs-interactive-1280.png` — section 4, green next to blue
- `accent-swatches-390-in-frame.png` — the true-390px iframe

---

## 7. What I'd want decided before any of this ships

1. **The blue itself** — judged on the swatch page, at both sizes. Everything else follows.
2. **The focus ring** — §4 recommends keeping ink; the page shows both.
3. **Whether the active-nav state is really off the table.** §3.2 says yes, on the
   teardown's own evidence. If Jayden wants it, the honest version is length or weight,
   not hue — which is a different spec.

---

## Sources

- [Understanding WCAG SC 1.4.11 Non-text Contrast (W3C/WAI)](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html)
- [Apple HIG design-system breakdown — systemBlue is an adaptive token, not a fixed hex](https://superdesign.dev/blog/apple-design-system)
- `docs/superpowers/specs/2026-08-02-case-study-teardown.md` §5 — the reference's
  `#0072f5` accent and `#e0f0ff` wash, read from the live page
- `docs/superpowers/specs/2026-08-02-design-tokens.md` — the token layer this extends
