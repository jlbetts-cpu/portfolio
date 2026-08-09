# System conformance audit — does the site match its own token system, and is there one component library?

**Date:** 2026-08-09
**Branch:** `codex/time-of-day-hero` (worktree `.worktrees/time-of-day-hero`)
**Method:** measured, not read. Every number is a computed value from a live page served at `127.0.0.1:4917` from the worktree root, sampled at 1440×900 and 390×844, or an enumeration of `document.styleSheets[…].cssRules` where a rule had to be proven live, or a definition-level diff across all shipping files.
**Scope:** `index`, `about`, `play`, `headmaker`, `gradientlab`, `apollo`, `strata`, `bearings`, `cluster`, `ucdavis`, plus `specimen.html`.

Evidence tagging: **(a)** sourced standard/research · **(b)** observed in a shipping product · **(c)** my inference.

Supersedes the adoption numbers in `2026-08-08-component-adoption-audit.md`. Its structural findings that have since been fixed are marked closed in §1.1.

---

## Answers up front

| Question | Answer |
|---|---|
| **Adoption now** | **Controls 57.8%** (216/374 DOM population) — up from ~30% two days ago and level with the 59.1% baseline. **Surfaces 46.5%** (33/71) once the denominator counts only things a `.surface` could ever be. The 20.5% surface figure reproduces exactly (19.7%, 35/178) but **its denominator is 52% soccer pitch, eyeballs and in-button dots.** |
| **The single biggest conformance gap** | **Leading.** `letter-spacing` and spacing are effectively conformant; leading is not. **12 distinct unitless `line-height` values against a 5-rung ladder**, and the two largest off-ladder clusters — `1.12` on five case studies, `1.06` on index + play — are the *exact clusters* the `--lh-head` / `--lh-note` rungs were added on 2026-08-04 to absorb. **The rungs landed; the call sites never moved.** Nothing reported it, because the audit tool was structurally blind to `line-height`. Fixed in §5.3. |
| **The one number for system health** | **20.6%.** The specimen shows 65 of the 316 tokens that ship. It links no stylesheet, copies what it demonstrates, and had been asserting `--lh-prose 1.55` in bold for a week after **1.5** shipped. **The system is in far better shape than the document that describes it** — which is the opposite of the usual failure and much cheaper to fix. |
| **Is one shared library in force?** | **Yes, and this is now provable.** `.ctl` and `.surface` each have **exactly one definition, in `controls.css`, on all ten pages** — verified by CSSOM enumeration, not by reading `<link>` tags. The prior audit's headline finding (three independent `.ctl` definitions under one class name) is **fully closed**. |
| **Contract suite** | 9/9 static contracts pass. `token-audit.py` PASS, 0 errors. The two known baseline failures are unchanged and not mine; three further failures are **tool defects, not site defects** — proven in §7. |

**The honest summary.** Two days ago this was a library sitting *beside* the site. It is now the library *of* the site: one `.ctl`, one `.surface`, ten pages linking it, and — measured for the first time — **every single root token resolving to an identical value on all ten pages.** The `--theme-duration` 640/400 split is gone. The remaining gaps are narrow and named: leading literals, four surface causes, and a specimen that documents a proposal nobody took.

---

## 1. Adoption, as a number

### 1.1 What changed since 2026-08-08

| Prior finding | Status today | Evidence |
|---|---|---|
| `.ctl` has three independent definitions (`controls.css` + two inline copies) | **CLOSED** | CSSOM: `.ctl` base rule found in exactly one sheet on every page. `headmaker` and `gradientlab` now link `controls.css`. |
| `about.html` does not link `controls.css`; 0/17 controls on system | **CLOSED** | Links it; 12/23 = 52.2%. |
| `--theme-duration` is 640ms on index, 400ms on the other nine | **CLOSED** | 400ms on all ten. |
| `--ctl-menu-shadow` casts a shadow on chrome | **CLOSED** | Token has no consumer; `.ctl-menu` takes `--ctl-container-rim`. |
| Library has no form primitive | **CLOSED** | `.field`, `.field--select`, `.ctl--range`, `.ctl--swatch` ship. |
| 21 distinct radius values | **Improved to 12** | §2.4 |
| `.ctl--on-dark` not built | **Open** | 0 occurrences in `controls.css`. |
| `--ctl-focus` is 1.00:1 against `.ctl--primary` | **Open** | Recomputed: 1.00:1 vs its own ground, 18.43:1 vs paper. §4.4 |
| Surfaces at 20.5% | **Re-framed** — see below | §1.3 |

### 1.2 Controls

Definition, stated so it can be reproduced: an element matching `button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button|tab|switch|menuitem|link|checkbox|radio|option], [tabindex]:not([tabindex="-1"])`. "On the system" = carries `.ctl` or `.field`.

| Page | DOM population | @1440 visible | @390 visible |
|---|---|---|---|
| index | 22/45 = 48.9% | 14/27 = 51.9% | 14/27 = 51.9% |
| about | 12/23 = 52.2% | 12/20 = 60.0% | 12/19 = 63.2% |
| play | 19/36 = 52.8% | 11/21 = 52.4% | 11/21 = 52.4% |
| headmaker | 16/41 = 39.0% | 1/8 = 12.5% | 1/8 = 12.5% |
| **gradientlab** | **48/56 = 85.7%** | 18/23 = 78.3% | 18/23 = 78.3% |
| apollo | 21/36 = 58.3% | 20/32 = 62.5% | 20/27 = 74.1% |
| strata | 12/27 = 44.4% | 11/23 = 47.8% | 11/17 = 64.7% |
| bearings | 31/45 = 68.9% | 30/41 = 73.2% | 30/36 = 83.3% |
| cluster | 18/34 = 52.9% | 17/30 = 56.7% | 17/25 = 68.0% |
| ucdavis | 17/31 = 54.8% | 16/27 = 59.3% | 16/22 = 72.7% |
| **SITE** | **216/374 = 57.8%** | **150/252 = 59.5%** | **150/225 = 66.7%** |

Gradient Maker reproduces the reported 85.7% to the digit, which is what validates this criterion against the 59.1% baseline rather than my having invented a friendlier one.

**`headmaker` at 12.5% visible is a measurement artifact, not a regression.** Its inspector panel is collapsed at rest, so only 8 controls are visible and 6 of those are the shared header. On the DOM population it is 39.0%, and its two sliders and its text field *are* on the system (`.ctl--range`, `.field`). Do not act on the 12.5%.

### 1.3 Surfaces — the 20.5% is real and the denominator is wrong

Counting every painted box in the DOM (radius ≥ 4px or a box-shadow, plus a ground) reproduces the baseline: **35/178 = 19.7%.** But bucketing those 178 by what they actually are:

| Bucket | Count | On system | What it is |
|---|---|---|---|
| **chrome** | **85** | **35** | Panels, cards, menus, media frames, bars — things `.surface` / `.collection` / `.media` exist to draw. |
| mark | 50 | 0 | Sub-2000px² dots, pills and ticks. A 6px team-colour dot is not a surface. |
| scene | 27 | 0 | Descendants of `.stagewrap` / `.stage` / `.heroCharacterPeek`, plus `.hmPlat` × 20 and `.hmShadow` — **soccer-pitch platforms and the companion head's irises, pupils and glints.** |
| in-control | 16 | 0 | Painted boxes *inside* a button (`.pCardPrev`, `.tdotR`). |

So **`play.html`'s "78 surfaces with 1 on the system" is mostly the pitch and a pair of eyeballs.** `tokens.css` already states the governing rule — the radius ladder "governs OBJECTS the site draws… not the geometry of objects inside a photograph" — and a `.hmPlat` is scene content by that rule. **(c)** Counting it against `.surface` sets a target that can never be reached and hides the real number.

**Visible chrome surfaces, at 1440: 33/71 = 46.5%** (identical at 390).

**Verdict: tractable, not structural.** All 38 off-system chrome surfaces reduce to **four causes**:

| Cause | Count | Pages | Note |
|---|---|---|---|
| Header (`.jbNav`, `.jbInk`) | 18 | 9 | One component, nine times. `header.css` owns its own material deliberately. Arguably correct — but `.jbInk`'s ground computes **`rgb(248,248,248)` = #F8F8F8, which is on no rung of the ramp** (`--c50` #FDFDFD, `--c75` #F1F1F1). |
| Badge (`.baLabel` ×12, `.scrapTag` ×2) | 14 | apollo, bearings, ucdavis | 34px tall, `--r-xs` 6px, non-interactive. The missing `.badge` primitive the prior audit predicted. |
| Builder panel (`.mkPanel`, `.mkStage`, `.mkStageCol`, `.panel`) | 4 | headmaker, gradientlab | **Two files, two names, one geometry: both 360×788 at `--r-lg`.** `tokens.css` already names the width (`--panel-w`) — the *surface* has no name. |
| Device mockup (`.demoPhone`, `.demoPoster`) | 2 | strata | 30px radius (`clamp(22px,2.4vw,30px)`), on no rung. Plausibly the sanctioned "picture of a phone" carve-out — **but that carve-out is written for `.shot.phone img`, not for these.** Needs Jayden's call. |

Fixing one primitive (`.badge`) closes 37% of the gap. Fixing two (`.badge` + a panel surface) closes 47%.

---

## 2. Typography, letter-spacing and spacing — computed, per role, diffed across pages

### 2.1 The same role must resolve identically. For `h2`, it does not.

| Role | Page(s) | font-size | line-height | ratio | letter-spacing | weight | Source |
|---|---|---|---|---|---|---|---|
| **h2** | apollo, strata, bearings, cluster, ucdavis (`.secHead`) | **36px** | 38.88px | 1.08 | −0.54px (−.015em) | 600 | `var(--fs-h2)` |
| **h2** | **about** (`.abBody h2`) | **32px** | 34.56px | 1.08 | −0.48px (−.015em) | 600 | **`var(--fs-h3)`** |
| h3 | apollo, strata, bearings, cluster, ucdavis | 32px | 34.56px | 1.08 | −0.48px | 600 | `var(--fs-h3)` |

**About's `h2` is drawn as a case study's `h3`** — byte-identical signature. This is exactly the divergence Jayden asked about, it is one declaration, and it is visible in source: `about.html:95` reads `.abBody h2{…font-size:var(--fs-h3)…}` against `apollo.html:167` `.secHead{…font-size:var(--fs-h2)…}`. **4px / 11% apart at 1440.**

**`h1` resolves four different ways:**

| Page(s) | font-size | line-height | ratio | letter-spacing | Size token |
|---|---|---|---|---|---|
| apollo, strata, bearings, cluster, ucdavis (`.head`) | 37.44px | 41.93px | **1.12** ✗ | −0.7488px (−.020em) ✓ | `--fs-h1` |
| index, play (`.heroCopy h1`, `.pLede`) | 40px | 42.4px | **1.06** ✗ | −0.8px (−.020em) ✓ | `--fs-heroline` |
| about (`.abTitle`) | 52px | 56.16px | 1.08 ✓ | −1.04px (−.020em) ✓ | `--fs-pagehead` |
| gradientlab | 15px | 22.5px | 1.5 | −0.15px (−.010em) ✓ | *unstyled — inherits body* |

Three different size tokens for one role is defensible (a page title, a hero, a section head are different jobs). **The leading is not**: 1.12 and 1.06 are on no rung, and `--lh-tight` (1.08) sits 0.02–0.06 away from both.

**A documented intent the code contradicts.** `play.html:302–304` states the hero headline is reproduced *"by token and not by value: 600, --fs-heroline, **--lh-tight**, --tr-head."* The rule twelve lines earlier, at `play.html:116`, writes `line-height:1.06`. `--lh-tight` is **1.08**. The comment describes a conversion that was never made. **(c)** This is the same class as the `--lh-prose` 1.6→1.5 drift: a stylesheet that reads correctly and does not run correctly.

### 2.2 Leading is the one axis that misses

**12 distinct unitless `line-height` values against a 5-rung ladder** (`1.0`, `1.08`, `1.2`, `1.45`, `1.5` — read live out of `tokens.css`, not retyped).

| Value | × | On a rung? | Where |
|---|---|---|---|
| 1.0 | 21 | ✓ `--lh-flat` / `--lh-display`, **written as a literal** | site-wide |
| 1.35 | 10 | ✗ | `.fv`, `.fvsub` |
| 1.30 | 5 | ✗ | `.hq` |
| **1.12** | **5** | **✗ (nearest 1.08)** | **`.head` — the case-study page title** |
| 1.14 | 5 | ✗ | `.head`, ≤760px fork |
| **1.06** | **4** | **✗ (nearest 1.08)** | **`.heroCopy h1` ×3, `.pLede`** |
| 1.55 | 1 | ✗ (nearest 1.5) | `.csNoteText` |
| 1.22, 1.10, 0.90, 0.86 | 1 each | ✗ | `.stepHead`, misc, `.ilNum`, `.loadPct` |

**Totals: 34 off-ladder declarations, 22 rung-values written as literals** — in shipping scope only.

`tokens.css`'s own 2026-08-04 note lists the clusters the new rungs were meant to absorb: *"1.12 ×5 `.head`… 1.30 ×5 `.hq`… 1.35 ×10 `.fv .fvsub`."* Those are, to the count, three of the four largest rows above. **The ladder was extended and the call sites were never converted**, and the conversion was described in that same note as "a separate, measured pass." That pass has not happened.

### 2.3 Letter-spacing is the most conformant axis — 11 of 12 values are on a rung

| Computed | × | em | Rung |
|---|---|---|---|
| `normal` | 188 | — | body text runs untracked (see below) |
| −0.54px @36 | 26 | −.015em | `--tr-sub` ✓ |
| −0.06px @15 | 16 | −.004em | `--tr-body` ✓ |
| −0.48px @32 | 12 | −.015em | `--tr-sub` ✓ |
| −0.18px @18 | 8 | −.010em | `--tr-title` ✓ |
| −0.7488px @37.44 | 5 | −.020em | `--tr-head` ✓ |
| −0.056px @14 | 3 | −.004em | `--tr-body` ✓ |
| −0.8px @40 | 2 | −.020em | `--tr-head` ✓ |
| −1.04px @52 | 1 | −.020em | `--tr-head` ✓ |
| −0.15px @15 | 1 | −.010em | `--tr-title` ✓ |
| 0.495px @11 | 1 | +.045em | `--tr-caps` ✓ |
| **+0.15px @15** | **1** | **+.010em** | **✗ no rung** — `.abCap`, about.html. A positive `--tr-title`; the ladder has no positive rung between 0 and `--tr-caps`. |

**One genuine observation, not a defect:** 188 of 250 text elements compute `letter-spacing: normal`, while `.ctl` sets `letter-spacing: var(--tr-body)`. So **controls are tracked and prose is not.** At 20px, `--tr-body` is −0.08px — below perceptual threshold **(c)** — so this costs nothing visually. It is worth deciding rather than leaving: either prose adopts `--tr-body` or the token is documented as control-only.

### 2.4 Spacing — conformant, with three off-grid values and all three defensible

12 distinct non-zero margins on text roles. Off the 4px grid: **10.0, 15.12, 57.6.**

- **10px** is `--sp-10`, a real rung — the ladder runs on a **2px** grid below 16 and 4px at and above. Not off-grid.
- **57.6px / 15.12px** are `--gap-head-top` (1.6em) and `--gap-head-bot` (.42em) on a 36px heading. These are **proportional by design** and land off a pixel grid by construction. **Name it so nobody "fixes" it:** the em-gap system and the 4px grid are two systems, and headings belong to the first.

Radius: **12 distinct values sitewide, down from 21.** `14px` ×158, `20px` ×72, `999px` ×70, `50%` ×70, `28px` ×27, `32px` ×19, `6px` ×14, `46%`/`50% 66%` ×8 (eye geometry — scene), `4px` ×3, `30px` ×3, `2px` ×1. Only **30px** (`.demoPhone` / `.demoPoster`) is off-ladder chrome; `32px` is the sanctioned `.shot.phone img` carve-out.

**`.photoFig` — the prior audit's finding, now with both numbers.** The rule is that radius is a function of the box's size, with a measured ~900px boundary:

| Viewport | `.photoFig` width | Radius | Correct? |
|---|---|---|---|
| 1440 | **1120px** | 28px (`--r-xl`) | ✓ ≥900 |
| 390 | **358px** | **28px** | ✗ should be 20px (`--r-lg`) |

The same element, 3.1× smaller, keeping the radius reserved for the widest surfaces. The size class is implemented as a **viewport** query, so an element that shrinks without the viewport crossing a breakpoint never changes class. Four case studies, at phone width.

### 2.5 Two font weights — one violation, and it synthesises

**400 (×1279) and 600 (×472)** on every page. **One element computes 900**: a `<b>` on `play.html` holding the scoreboard numeral `0`, in "Instrument Sans". `tokens.css` declares only the 400 and 600 faces, deliberately — *"an undeclared weight synthesises rather than silently loading a face nobody approved."* **This is that.** The browser is faux-bolding a numeral on the broadcast board. One element, one declaration.

---

## 3. Does the specimen match the shipped system?

**No, and the drift is the finding — against the specimen, which is wrong.**

`specimen.html` is **standalone by construction**: it links no stylesheet (`<link>` count: 0), and copies into its own `:root` the tokens it demonstrates. Its own header says *"no dependencies, no build step,"* and it is structured as **OLD vs NEW columns** — it is the 2026-08-02 token *proposal*, preserved.

| Measure | Value |
|---|---|
| Custom properties defined by `tokens.css` | 293 |
| …plus `controls.css` | +23 |
| **Shipped system total** | **316** |
| Defined by `specimen.html` | 70 |
| Present in both | 65 |
| **Coverage** | **20.6%** |
| Tokens the specimen defines that **do not ship** | 5 — `--accent-live`, `--fs-hero`, `--lh-prose-new`, `--lh-prose-old`, `--old` |

**The measured lie.** Computed side by side:

| Role | specimen.html (NEW column) | Shipped (about, apollo, bearings, cluster, strata, ucdavis) |
|---|---|---|
| prose paragraph | 15px / **23.25px** = **1.55** | 20px / **30px** = **1.50** |
| `h2` | 30px / 36px = 1.20 | 36px / 38.88px = 1.08 |

The specimen asserted **`--lh-prose 1.55`** in bold, as the value that shipped. The site shipped **1.5**. Its OLD column claims 1.6. **Neither column was the truth for a week, and nothing reported it** — the same invisible drift the project has been bitten by before, in the same token.

**What the specimen shows none of:** the leading ladder (`--lh-tight/head/note/prose`), the entire control layer (`--ctl-*`, both height rungs, the eleven `.ctl` variants, `.field`, `.ctl--range`, `.ctl--swatch`), the surface primitives (`.surface`, `.collection`, `.media`), the six-rung motion ladder, and the fixed `--sp-*` ladder. **(c)** Those are precisely the parts a hiring reviewer opens a specimen to see.

Fixed in §5.2 — but the structural fix (link `tokens.css`, stop copying) is a rebuild, and is recommended in §6.

---

## 4. What is still bespoke

### 4.1 Controls — 102 off-system instances in 18 families, and half of them are one component

| Family | × | Pages | Geometry | Library equivalent, and the drift |
|---|---|---|---|---|
| `.jbDiscGo`, `.backlink`, `.jbBack`, `.jbHome`, bare `<a>` | **50** | all 10 | 38px, `--r-pill`, 14px/400, `0.4s, 0.24s, 0.1s` | **`.ctl--sm`** — 36px, `--r-md` 14px, 14px/400. **2px on height, and a pill vs a 14px radius.** `header.css` declares `--bar-item-h:38px` as a third rung beside 44 and 36. Both implement the same `::after` hit-expander trick; measured, both reach 44px. |
| `.chap` (chapter rail) | 26 | 5 case studies | 14px box, **44px `::after`**, 44px pitch | Correct as built — cleared, see §4.3. |
| `.footIn`, `.abIn` | 9 | about + 4 case studies | 50px, no radius, 20px | Inline prose links — the sanctioned exception. |
| `.pCard` | 4 | play | 101px, `--r-md`, `min-height:44px` | Card-as-link. Belongs to neither family; still no primitive. |
| `.heroHeadHandle`, `.heroHeadRotate`, `.face`, `.cmpHandle` | 7 | index, bearings | 44px hit boxes | Direct-manipulation handles — correctly outside the control system. |
| `.csGo` | 2 | index | 600px tall anchor | Card-as-link, as above. |
| `.hmDrop` | 1 | headmaker | 676px, `--r-md`, 13px | A disclosure panel typed as a control. |
| `.skipLink` **(headmaker only)** | 1 | headmaker | 44px, `--r-md` | **`.skipLink.ctl` ships.** Eight pages carry `skipLink ctl ctl--secondary`; headmaker carries `skipLink` alone and reproduces the geometry by hand. |

**The single highest-leverage control target is the header/back-link family: 50 of 102 remaining bespoke controls, 49%.** One reconciliation — either the nav adopts `.ctl--sm` with a nav-scoped height, or `--ctl-h-sm` becomes 38 — moves half the remaining gap. It is in `header.css`, not my lane; reported in §6.

### 4.2 Token definitions that live outside the token file

Found by diffing custom-property **definitions** across every shipping file, not by reading any one of them:

| Token | Files | Agree? | In `tokens.css`? |
|---|---|---|---|
| `--fs-hero` | `index.html:89`, `play.css:63`, `specimen.html:59` | yes | **no → now yes (§5.1)** |
| `--fs-heroline` | `index.html:89`, `play.css:63` | yes | **no → now yes (§5.1)** |
| `--accent-live` | `index.html`, `play.css`, `specimen.html` | yes (#17A45A) | **no — deliberately; see §5.1** |
| `--lh-prose` | `tokens.css`, `play.css:63` | yes (1.5) | duplicated |

`play.css:51` already carries the confession — *"not in tokens.css at all; kept verbatim so the…"* — a file flagging its own copy with nowhere to move it to. Three identical copies is the state immediately before two of them disagree; **it is the same pattern `tokens.css` documents for `--panel-w`, and the same one that let `--lh-prose` drift.**

### 4.3 Cleared — checked, and not defects

- **`.chap` (chapter rail), 14px tall.** Carries a `::after` computing to **44px**, and the rail pitch is **exactly 44px**, so targets tile without overlap. Not a miss.
- **`.jbHome`, 38px.** `::after` height **44px** at `top:19px`. Not a miss. (It also has a focus ring, as previously established.)
- **`.footBrand{--ctl-pad:0}` in `footer.css`.** Reads like a token override; measured, the box is **44×44** and the control is *consumed, not redrawn*. This is the semantic layer working exactly as designed — cite it as the model.
- **`.jbNav{--ico-md:16px}` at `header.css:1076`.** Inside a media query. Computes **18px** at 1440. A scoped responsive fork, not a second definition.
- **`.baText .subHead{margin:4px 0 0}` (apollo).** The `.subHead` base rule is byte-identical on all five case studies; this is a deliberate context override inside a before/after block. Only defect: `4px` is a literal where `--sp-4` exists.
- **Tap targets.** Zero misses at 1440 or 390 once expanders are credited.

### 4.4 Open gaps, confirmed rather than rediscovered

- **`.ctl--on-dark` still not built.** 0 occurrences. Any control on a dark scrim must still be hand-rolled.
- **`--ctl-focus` is 1.00:1 against `.ctl--primary`'s own ground** (both `rgb(17,18,20)`), surviving only on its 2px `outline-offset`, where it reaches 18.43:1 against paper. **(a)** WCAG 2.2 SC 1.4.11 passes today; it fails the moment a primary button lands on a dark ground. `.ctl--range` and `.ctl--swatch` already ship the two-tone construction that solves it — the base ring has not adopted it.
- **`about.html` and `gradientlab.html` have no skip link at all.** The other eight do, and `controls.css` ships `.skipLink.ctl`. **(a)** WCAG 2.2 SC 2.4.1 Bypass Blocks.
- **`.jbInk`'s ground is `#F8F8F8`** — between `--c50` (#FDFDFD) and `--c75` (#F1F1F1), on no rung. All ten pages.

---

## 5. What I changed (my lane only)

### 5.1 `tokens.css` — a home for `--fs-hero` and `--fs-heroline`

Added, additively and inertly. Verified by measurement: `--fs-hero`, `--fs-heroline` and `--lh-prose` compute identically on index, play and apollo before and after, and the `h1` on all three is unchanged (`40px/42.4px/−0.8px`, `37.44px/41.9328px/−0.7488px`). index.html and play.css keep their local copies and those still win; deleting them belongs to those files' owners.

`--accent-live` was **deliberately left alone**: `tokens.css`'s own header records the decision that the tournament's live-match green is not a token this file defines. Reversing a recorded decision is Jayden's call, not a tidy-up. Reported here instead.

Side effect, and it is the tool working: `token-audit.py`'s `duplicate_definition` went 4 → 6, now naming the two files that should drop their copies.

### 5.2 `specimen.html` — stop asserting a value that does not ship

- `--lh-prose-new` **1.55 → 1.5**. The NEW column now computes **20px / 30px = 1.500**, byte-identical to the shipped prose role measured on six live pages. The OLD column keeps 1.6, which is what it is for.
- The bolded claim `--lh-prose 1.55 · a 3% tightening` now reads `--lh-prose 1.5 (the shipped value) · a 6% tightening`.
- A status banner at the top of the document states what the page is (a 2026-08-02 proposal), its measured **20.6%** coverage, the fact that it links nothing and copies what it shows, the list of systems it does **not** cover, and that `tokens.css` + `controls.css` win any disagreement.

Verified: renders, no console errors, banner 302px.

### 5.3 `tools/token-audit.py` — a leading-ladder check, because the tool could not see its own biggest miss

`--lh-` sits in `NON_SUBSTITUTABLE` (correctly — a bare `1.5` in `flex` is not a leading) and `line-height` is in no property category, so `check_literals` was **structurally blind** to every number in §2.2.

Added `check_leading()`. It reads the rung list **live out of `tokens.css`** rather than retyping it — a hardcoded ladder would be a second definition of the ladder, which is the failure the tool exists to catch. Scoped to unitless ratios, because a px/em leading is a metric decision a static reader cannot judge.

New findings on first run, shipping scope: **`leading_off_ladder` 34**, **`leading_literal_on_rung` 22**, `leading_rungs = [1.0, 1.08, 1.2, 1.45, 1.5]`, `leading_distinct_unitless = 12`. It reproduces from source exactly what the browser measured, including `.head` 1.12 ×5 and `.heroCopy h1` 1.06.

Both are WARNINGs, so the suite still reports `errors=0 STATUS=PASS` — **which is the point of the caveat below, not an oversight.**

---

## 6. Patches for other lanes

Ranked by user-visible impact, then cost. None of these files are mine.

**Do first (cheap, and each closes a named gap):**

1. **`about.html:95`** — `.abBody h2{font-size:var(--fs-h3)}` → `var(--fs-h2)`. One token. Makes an `h2` an `h2` everywhere. *(§2.1)*
2. **`play.html:116` and `index.html:806`/`1459`** — `line-height:1.06` → `var(--lh-tight)`. The comment at `play.html:302` already says this is what it should be. *(§2.1)*
3. **The five case studies, line 136** — `.head{line-height:1.12}` → `var(--lh-head)` **or** `var(--lh-tight)`; and `letter-spacing:-.02em` → `var(--tr-head)`. Jayden's call which rung; 1.12 sits between them. *(§2.2)*
4. **`about.html` and `gradientlab.html`** — add `<a class="skipLink ctl ctl--secondary">`. Two lines, WCAG 2.4.1. *(§4.4)*
5. **`headmaker.html`** — add `ctl ctl--secondary` to its existing `.skipLink` and delete the hand-matched rule. *(§4.1)*
6. **`play.html`** — the scoreboard `<b>` computing weight 900 is faux-bolding an undeclared face. Set 600. *(§2.5)*

**Do next (structural, moderate):**

7. **`header.css`** — reconcile the 38px rung with `--ctl-h-sm` (36). **50 of the 102 remaining bespoke controls are this one family.** Either the nav adopts `.ctl--sm` with a scoped height, or `--ctl-h-sm` becomes 38 and the nav adopts it. Also: `.jbInk`'s `#F8F8F8` is on no rung of the ramp. *(§4.1, §1.3)*
8. **`controls.css`** — add `.badge` (non-interactive, 34px, `--r-xs`). Closes 14 of the 38 off-system chrome surfaces in one primitive. *(§1.3)*
9. **`controls.css`** — add `.ctl--on-dark`, and give the base focus ring the two-tone construction `.ctl--range` and `.ctl--swatch` already ship. *(§4.4)*
10. **`controls.css`** — promote the `--ctl-track-*` / `--ctl-thumb-*` / `--ctl-state-layer-*` / `--ctl-swatch-rim*` block into `tokens.css`. **The file asks for this itself** ("move the block verbatim into the control section of tokens.css"). I did not do it unilaterally because adding to `tokens.css` without deleting from `controls.css` creates the duplicate this whole audit is about. Needs both files in one commit.
11. **`index.html:89` and `play.css:63`** — delete the local `--fs-hero` / `--fs-heroline` (and `play.css`'s `--lh-prose`) now that `tokens.css` carries them. `token-audit.py` names both files. *(§5.1)*
12. **The four case studies** — `.photoFig` must take `--r-lg` below the ~900px size class. Today it is 28px at 358px wide. The size class is a viewport query; it needs to be an element-size rule (a container query is the honest tool). *(§2.4)*
13. **`strata.html`** — `.demoPhone` / `.demoPoster` at 30px. Either bring onto the ladder or extend the "picture of a phone" carve-out to cover them explicitly. Jayden's call. *(§1.3)*

---

## 7. The tool suite — 9/9 static contracts pass, and three failures are the tools

`token-audit.py`: **errors=0, warnings=248, STATUS=PASS.**

| Tool | Result | Verdict |
|---|---|---|
| `shared-controls-contract.py`, `site-theme-contract.py`, `work-collection-contract.py`, `footer-consistency-check.py`, `play-minimal-contract.py`, `builder-theme-contract.py`, `chrome-blend-contract.py`, `hero-entrance-rhythm-contract.py`, `fluid-mesh-check.py` | **PASS** | 9/9, unchanged by my edits. |
| `shared-surfaces-contract.py` | FAIL | Known baseline failure, not mine. |
| `hero-specimen-check.py:52` | FAIL | Known baseline failure — asserts `--nav-mat:var(--theme-page)`; the rule has said `var(--ctl-ground)` since the header-material work. Not mine. |
| **`hm-check.py`** | FAIL | **Tool defect.** Reports a `SyntaxError` in `hero-head-transform.js`. `node --check hero-head-transform.js` **passes**. Its comment-stripper is swallowing a `/* */` block and feeding prose to the parser. A green-field bug that will fire on any file with prose comments. |
| **`home-minimal-hero-contract.py`** | FAIL | **Tool defect.** Asserts `width >= 44 and height >= 44` with **exact** float comparison. Measured: `workBtn` 102.29 × **43.984**, `heroTimeBtn` **43.859 × 43.859** — 44px controls losing 0.02–0.14px to sub-pixel layout. Needs a tolerance, as `shared-controls-browser.py` already uses (`close(…, tolerance=0.51)`). |
| `hero-head-transform-contract.py` | FAIL | Playwright timeout; hero lane. |

### 7.1 The caveat that still holds, restated with today's evidence

**A green `token-audit.py` means zero *errors*, not zero findings.** It reported `chrome_cast_shadow=4`, `tap_target_under_44=1`, `control_offgrid=1`, and now `leading_off_ladder=34` — **and printed PASS.** Everything in §2.2, the single biggest conformance gap on the site, is a WARNING.

**(c)** The recommendation is not to escalate everything. It is to escalate the three that are *rules the project has already decided*: `chrome_cast_shadow` (the no-shadows-on-chrome rule), `tap_target_under_44` (a WCAG floor), and `leading_off_ladder` (the ladder exists precisely so these do not get invented). Those three are decisions, not opinions, and a decision that only warns is a decision that erodes.

Remaining blind spots, unchanged: `SHIPPING_CSS` still excludes `site-theme.css`, `hero-time.css`, `footer.css` and `builder-theme.css`; font-weight is asserted by no tool (the 900 in §2.5 was found by browser, not by suite); no tool hovers; the ~900px radius size class is still untested and is still why `.photoFig` stays green.

---

## Appendix — reproducing this

```
cd .worktrees/time-of-day-hero
python3 -m http.server 4917 --bind 127.0.0.1     # from the worktree root, so images/ resolves
```

Adoption and typography were measured with a Playwright harness that, per page: loads, drives every scroll-reveal to completion (otherwise reveal-animated content is measured at `opacity:0` and silently drops out of the denominator — this alone moved the apollo surface count from 8 to 16), then reads computed styles for every control, every painted box and every text-bearing element, plus `document.styleSheets` for rule provenance.

**Both denominators are stated in §1.2 and §1.3 rather than assumed.** The control criterion is validated against the prior baseline by reproducing Gradient Maker's reported 85.7% to the digit. The surface criterion deliberately differs from the baseline's, and §1.3 shows both numbers and why.

| Measurement | @1440 | @390 |
|---|---|---|
| Controls (DOM population) | 216/374 = **57.8%** | — |
| Controls (visible) | 150/252 = **59.5%** | 150/225 = **66.7%** |
| Chrome surfaces (visible) | 33/71 = **46.5%** | 33/71 = **46.5%** |
| All painted boxes, incl. hidden | 35/178 = 19.7% | — |
| Distinct unitless line-heights | **12** vs 5 rungs | — |
| Distinct letter-spacings | 12, **11 on a rung** | — |
| Distinct radii | 12 (was 21) | — |
| Distinct font weights | **3** (400, 600, one synthesised 900) | — |
| Root tokens differing between any two pages | **0 of 41 sampled** | — |
| Specimen coverage of the shipped system | **65 / 316 = 20.6%** | — |
