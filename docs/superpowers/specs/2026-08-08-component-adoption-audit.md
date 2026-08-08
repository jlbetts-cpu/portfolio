# Component adoption audit — does the site consume `controls.css`, or sit beside it?

**Date:** 2026-08-08
**Branch:** `codex/time-of-day-hero`
**Method:** measured, not read. Every number below is a computed value from a live page served at `127.0.0.1:4899`, sampled at 1440, 1280 and 390 × 844, or an enumeration of `document.styleSheets[...].cssRules` where a rule had to be proven live.
**Scope:** `index`, `about`, `play`, `headmaker`, `gradientlab`, `apollo`, `strata`, `bearings`, `cluster`, `ucdavis`.

Evidence tagging used throughout: **(a)** sourced research · **(b)** observed behaviour in shipping products · **(c)** my own inference.

---

## Answers up front

| Question | Answer |
|---|---|
| **The single biggest hole** | **`.ctl` has three independent definitions.** `controls.css` owns one; `headmaker.html` (inline, L227) and `gradientlab.html` (inline, L166) each carry a private copy under the *same class name*. The copies read raw primitives (`--tap-min`, `--sp-16`, `--r-md`) instead of the `--ctl-*` semantic layer, so retuning the library silently skips those two pages. Already diverged: `.ctl--primary` renders `rgb(18,18,18)` with **no rim** there vs `rgb(17,18,20)` **with** `inset 0 0 0 1px rgba(17,18,20,.12)` everywhere else. |
| **Adoption rate** | **Controls 36–42%** (91/254 @1440, 112/266 @1280, 91/228 @390 — the spread is lazy-loaded content, not layout). **Surfaces 15.4%** (22/143, identical at every width). **Combined ≈ 30%.** |
| **The one number for system health** | **52 → 11.** Fifty-two distinct one-off control/surface class names, defined 84 times across 13 files, against eleven `.ctl`/`.surface` variants. They use **21 different border-radius values** and **10 different min-heights**; the library offers 4 radius rungs and 2 height rungs. |
| **Contract suite verdict** | 30/34 pass. Of the 4 failures, 3 are collateral from the concurrent hero edit on this branch and 1 is soccer physics. **Zero contract tools fail on the component system** — while adoption sits at 30%. |

**The honest summary.** The library is real, correct, and well-built. Where it is used it is used properly: 400/600 are the only two font weights measured anywhere on the site, no control misses the 44px target at any width, and the sanctioned prose-link exception holds exactly. But it is a *fourth* layer, not a *replacement* layer. `play.css` alone is 1641 declarations — **4.5× the entire library's 366** — and three of the ten shipping pages never link `controls.css` at all.

---

## 1. Where the library actually loads

`.ctl` and `.surface` base rules exist in exactly one stylesheet, `controls.css`. Proven by enumerating `cssRules` on each page rather than reading link tags.

| Page | Links `controls.css` | `.ctl` base live | `.surface` base live | Consequence |
|---|---|---|---|---|
| index, play, apollo, strata, bearings, cluster, ucdavis | yes | yes (library) | yes | Normal. |
| **about.html** | **no** | **no** | no | 17 controls, **0 use the system**. Nothing to fall back to. |
| **headmaker.html** | **no** | **yes — private inline copy** | no | 11 controls, 1 carries `.ctl`, styled by a *different* `.ctl`. |
| **gradientlab.html** | **no** | **yes — private inline copy** | no | 26 controls, 10 carry `.ctl`, styled by a *different* `.ctl`. |

The two inline copies are the dangerous case, because the class name is identical and nothing in the markup reveals which definition is in force.

```
controls.css   .ctl{ min-height:var(--ctl-h); padding-inline:var(--ctl-pad); border-radius:var(--ctl-r); font-size:var(--ctl-fs) }
headmaker L227 .ctl{ min-height:var(--tap-min); padding-inline:var(--sp-16); border-radius:var(--r-md);  font-size:var(--fs-small) }
gradientlab L166 .ctl{ min-height:var(--tap-min); padding:0 var(--sp-16);     border-radius:var(--r-md);  font-size:var(--fs-small) }
```

They agree *today* only because `--ctl-h → --tap-min` and `--ctl-pad → --sp-16` happen to resolve identically. The `--ctl-*` layer exists precisely so those can be retuned independently; on two pages it has been bypassed. **(c)** This is the exact failure mode the `--ctl-*` indirection was created to prevent.

---

## 2. Cross-page role diff

Same role must resolve to the same numbers everywhere. Measured at 1440.

### 2.1 Divergences found

| Role | Property | Value A | Value B | Verdict |
|---|---|---|---|---|
| `.ctl--primary` | background | `rgb(17,18,20)` — index, play, strata | **`rgb(18,18,18)`** — headmaker, gradientlab | **(b) drift.** Inline copies bind `--accent`, library binds `--ctl-primary-ground`. |
| `.ctl--primary` | box-shadow | `rgba(17,18,20,.12) 0 0 0 1px inset` — index, play, strata | **`none`** — headmaker, gradientlab | **(b) drift.** The rim is simply absent on the builder pages. |
| `.ctl--tab` | font-size | 16px — index + 4 case studies | **15px** — gradientlab | drift |
| `.ctl--tab` | padding-inline | 16px (case studies) / 8px (index) / **4px** (gradientlab) | — | **three values for one role** |
| `.ctl--tab` | transition-duration | 0.16s — gradientlab + 4 case studies | **0.64s** — index | drift, see 2.2 |
| header nav, social links, footer links | transition-duration | 0.4s — 9 pages | **0.64s** — index only | root cause below |

### 2.2 `--theme-duration` is 640ms on index and 400ms on the other nine

One token, one page out of step, three separate roles visibly affected (nav ink, footer ink, social ink). Every theme cross-fade on the home page runs 60% slower than the same cross-fade one click away. **(c)** Almost certainly a deliberate hero-tuning value that leaked to the global token rather than a hero-scoped one.

### 2.3 What is *not* drift (checked and cleared)

- **Header nav is consistent.** All ten pages: 38px box, `999px` radius, 14px/400, muted ink, 0.4s. My first pass flagged a padding difference; it was my element picker matching `.jbHome` (8px) on some pages and a nav link (16px) on others. Re-verified per-element — consistent.
- **`.ctl--primary` at 66px on strata** is `.ctl--media-large.is-icon`, a video overlay button. `min-height` still 44px. Correct use of the variant.
- **`.ctl--tab` weight 600 / ink on the current page** is `aria-current` styling, not drift.

---

## 3. Duplicates — the real findings

These are one-offs that reimplement a variant that already exists. Both numbers given.

### 3.1 `.reelClose` — a hand-matched `.ctl--secondary`

| | `.reelClose` (index inline) | `.ctl--secondary` (library) |
|---|---|---|
| height / min-height | 44px / 44px | 44px / 44px |
| radius | 14px | 14px |
| padding-inline | 16px | 16px |
| font | 15px / 400 | 15px / 400 |
| **transition-duration** | **160ms** | **240ms** |
| rim | `rgba(253,253,253,.14) inset` | `rgba(17,18,20,.12) inset` |

Someone reproduced the geometry by hand and got everything right except the motion. It also needs an **inverse rim** because it sits on a dark reel overlay — and the library has no on-dark variant, which is why it could not be adopted. See §6.

`.reelClose` also carries a dead declaration: `border-radius:4px` at index L249, overridden by a later sweep at L833 to `var(--r-md)`. Computed value is 14px; the 4px never wins. **(c)** Same class of bug as the radius regression noted in the project history — a rule that reads correctly and never runs.

### 3.2 The header's parallel control system

`header.css` defines `--bar-item-h: 38px` locally (L165) — a **third height rung** beside the library's 44 and 36. Nav items are 38px tall with `--r-pill` radius against `.ctl`'s 14px.

This is **not** a tap-target failure: `.jbNav a` carries a `::after` expander computing to **44px**, measured. But `.ctl--sm` implements *exactly the same trick* (`.ctl--sm::after{height:var(--ctl-h)}`) at 36px/12px/14px. Two implementations of one idea, 2px and 4px apart. **(c)** The nav should be `.ctl--sm` with a nav-scoped height override, or `--ctl-h-sm` should become 38 and the nav adopt it.

### 3.3 `index.html`'s inline stylesheet is a second control library

101 of its 591 rules style the family `.moodItem, .moodBtn, .moodGo, .reelClose, .mhToggle, .toTop, .csTab, .aboutCta` — with its own radius sweep, its own font rule, its own `display:inline-flex`, its own `:active{transform:scale(var(--press-scale))}`, and its own `prefers-reduced-motion` block. **The duplicate is 95% the size of the library it duplicates** (101 rules vs `controls.css`'s 106).

Within that block, five classes are each redefined 4–6 times with contradictory geometry, then reconciled by a sixth rule at L833. `.hero` is defined four times with four different heights (`100vh−80`, `100vh−68`, `100svh−68`, `100svh−88`).

### 3.4 Off-ladder radii

The library offers `--r-md` 14 (controls), `--r-lg` 20 (cards/images), `--r-xl` 28 (biggest surfaces). Measured across the site: **21 distinct radius values**. Notable:

| Element | Measured | Should be | Where |
|---|---|---|---|
| social links | **10px** | 14px (`--r-md`) | all 10 pages |
| `.pBtn` | **10px** (`--r-sm`) | 14px | play.html |
| `.photoFig` (358px wide @390 viewport) | **28px** | 20px (`--r-lg`) — it is far below the ~900px size class | apollo, bearings, cluster, ucdavis |
| `.demoPhone` / `.demoPoster` | **22px** (`clamp(22px,2.4vw,30px)`) | on no rung at all | strata |
| scrollbar thumbs | **99px** | 999px (`--r-pill`) | all 5 case studies |
| `.moodBtn` family (authored) | **4px** ×22 in index | `--r-2xs` | index inline |

`.photoFig` is the one with real visual consequence: a 358px-wide image carrying the 28px radius reserved for the biggest surfaces, on four case studies, at mobile width.

---

## 4. State coverage

Browser-verified by matching each element against every state selector in the live rule set (so ancestor rules like `.jbNav button:focus-visible` are correctly credited).

| Family | hover | focus-visible | active | disabled | selected |
|---|:--:|:--:|:--:|:--:|:--:|
| **`.ctl` (library)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| `.moodBtn` / `.moodItem` / `.moodGo` / `.reelClose` / `.mhToggle` / `.toTop` / `.csTab` | ✅ | ✅ | ✅ | ❌ | partial |
| `.pBtn`, `.tvChip`, `.tvGo`, `.hmPitPick` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `.abLink` (about.html) | ✅ | ✅ | **❌** | ❌ | ❌ |
| `.aboutCta`, `.teamChip`, `.sbBtn`, `.tGo`, `.hmBtn`, `.hmDrop` | ✅ | ✅ | **❌** | ❌ | ❌ |
| `.jbHome` (header, all 10 pages) | ✅ | **❌** | ✅ | ❌ | ✅ |
| `.mkField` (headmaker `<input>`) | ✅ | **❌** | ❌ | ❌ | ❌ |
| `.baGo` (apollo, ucdavis) | ❌ | ❌ | ❌ | ❌ | ❌ |

`.ctl` is the only family on the site with all six states. That is the library's clearest earned win — and the strongest argument for adoption.

### 4.1 Ranked state gaps

1. **`.baGo` is a `<span>`, `tabIndex = -1`.** It is 38px, 50% radius, and reads unambiguously as a button — but it cannot be focused, cannot be reached by keyboard, and has no hover, focus or press state. On apollo and ucdavis. **(a)** WCAG 2.2 SC 2.1.1 (Keyboard) — a control that cannot be operated by keyboard is a failure, not a nicety.
2. **`.jbHome` has no focus ring, on all ten pages.** It is the first tabbable element after the skip link. **(a)** WCAG 2.2 SC 2.4.7 (Focus Visible). Cost to fix: one selector.
3. **`.mkField` (a text input) has no focus ring** on a page that does not load `controls.css`, so `.ctl:focus-visible` cannot rescue it.
4. **Press states missing on 14 of 27 one-off families.** **(a)** Touch devices have no hover, so `:hover`-only feedback means a tap produces no acknowledgement until the action completes — Apple HIG's guidance on providing immediate touch feedback, and Material's ripple, both exist for this reason. `.abLink` is the worst instance: it is about.html's primary CTA family (16 references), and that page has no `.ctl:active{transform:scale(.97)}` to fall back on.
5. **Disabled state absent from 26 of 27 one-off families.** Only `.pCard` has one. **(c)** Lower priority — most of these are never disabled today — but it is why a one-off can never be safely promoted to a general-purpose control.

### 4.2 `prefers-reduced-motion`

Honoured, but scattered across **41 separate blocks** in 6 files (index inline alone has 31). `controls.css` covers `.ctl`/`.ctl-menu`/hero-head cleanly. `footer.css` has none — it declares two transitions and never suppresses them. **(c)** Low visual impact (colour cross-fades), but it is a genuine hole in an otherwise complete story.

---

## 5. The mathematical layer

| Rule | Verdict | Evidence |
|---|---|---|
| **44px minimum, measured** | ✅ **Clean.** Zero misses at 1440, 1280 or 390. | The 38px nav is rescued by a measured 44px `::after`. |
| **Prose-link exception** | ✅ **Holds exactly.** | 390: **45.5px** target on a **25.5px** pitch. 1440: **50px** on a **30px** pitch — the same ratio, scaled. The three footer links sit side-by-side on one line, so the vertical overrun reaches no adjacent target. Correct and documented, not a miss. |
| **Two font weights** | ✅ **Clean.** Only 400 and 600 measured on every control on all ten pages, at all three widths. | — |
| **Radius ladder** | ❌ 21 distinct values; `.photoFig` at 28px well below the 900px size class. | §3.4 |
| **4px grid / `--sp-*`** | ⚠️ `--sp-80` present and correct. But 3395 raw px literals sitewide, 1028 of them exactly equal to an existing token. | `token-audit.py` |
| **No cast shadows on chrome** | ❌ **The library itself violates it.** | below |

### 5.1 `--ctl-menu-shadow` casts a shadow on chrome

```
--ctl-menu-shadow: 0 0 0 1px rgba(17,18,20,.12) inset,   ← rim, correct
                   0 2px 8px rgba(18,18,18,.06),          ← cast shadow
                   0 1px 2px rgba(18,18,18,.04)           ← cast shadow
```

Measured live on `#heroTimeMenu` (index) and `.moodMenu` (play). A dropdown menu is chrome; it does not stand on anything. The site's own rule is that the companion heads cast contact shadows *because they stand on something*, and that chrome separates with hairlines and translucency. **The shared library is the thing breaking the rule**, which makes it the cheapest possible fix and the highest-leverage one — every migrated menu inherits the correction.

`token-audit.py` already reports `chrome_cast_shadow=5`. It is a WARNING, so the suite stays green.

### 5.2 Focus ring contrast

`--ctl-focus` is `#111214`. `.ctl--primary`'s background is `rgb(17,18,20)` — **the same colour, 1.00:1**.

It is currently saved by `outline-offset: var(--sp-2)`, which places the 2px ring on the page background at **18.43:1**. So on today's light pages it passes **(a)** WCAG 2.2 SC 1.4.11 comfortably. But the ring has no contrast against the control it belongs to, so the moment a primary button lands on any dark ground — a reel overlay (`#121212`), a dark hero state, a future dark section — the indicator disappears. **(c)** A focus token that is safe only because of a 2px gap is a latent failure, not a passing one. The standard fix is a two-tone ring (inner light, outer dark) so one of the two always contrasts; **(b)** this is what Chrome, Firefox and Safari all ship as their default focus ring.

Related: `site-theme.css:12` still sets `--theme-focus: #D9D7FF`, the pre-ink lavender accent, while light mode moved to ink `#121212`. **(c)** Stale from the accent migration.

---

## 6. What the library is missing (orphans)

Orphans are the useful signal: each one is a control that *could not* adopt the system because no variant fits.

| Orphan | Where | Missing variant | Why it should exist |
|---|---|---|---|
| `.reelClose` inverse rim | index reel overlay | **`.ctl--on-dark`** | A control on a dark scrim needs an inverted rim and ink. Today the only way to get one is to hand-roll it. **(b)** Every mature system has this (Material `onSurface` roles, Apple's vibrancy materials). |
| `.mkField`, `.hmDrop`, `<input>`, `<select>` | headmaker, gradientlab | **`.field` / `.ctl--field`** | **The library has no form primitive at all.** This is the single largest coverage gap — it is why the two builder pages could never adopt it and ended up copying `.ctl` instead. |
| `.mkSlider` | headmaker | **`.slider`** | 4 pseudo-element rules per instance, entirely bespoke. |
| `.cmpKnob` (34px, 50%) | all 5 case studies | **drag-handle primitive** | 38 references, no states, below the 44px target. |
| `.baChip`, `.battleBadge`, `.baLabel` | case studies, play | **`.badge`** (non-interactive) | Currently styled as controls, which is why they inherit `cursor:pointer` semantics they should not have. |
| `#csGo`, `.pCard`, `.workcard` | index, play | **card-as-link** | 600px-tall anchors with `min-height:auto` and no radius — they are surfaces that happen to be links, and belong to neither family. |
| 38px nav rung | header.css | reconcile with `--ctl-h-sm` | §3.2 |

---

## 7. Contract suite — 30/34 pass, and what that does not mean

**Failures (4):**

| Tool | Cause |
|---|---|
| `hero-specimen-check.py` | Asserts a literal `<link href="hero-time.css">`; the branch added `?v=`. |
| `home-minimal-hero-contract.py` | Asserts `<section class="hero" id="main"`; markup changed. |
| `shared-surfaces-browser.py` | Asserts hero radius 28px; measured 0px. |
| `play-browser-smoke.py` | Soccer ground-plane physics; unrelated to the design system. |

The first three are collateral from the concurrent time-of-day-hero edit in this worktree, not system defects. **Zero tools fail on the component system.**

### 7.1 `token-audit.py` — the premise needs correcting

The brief says it catches undefined tokens but not literals shadowing them. **That is not quite right, and the correction matters.** `check_literals` builds a value→token index and *does* flag a hardcoded `14px` as `radius 14px -> --r-md`. I ran it:

```
tokenisable_literal=37      tokenisable_occurrences=1028
untokenised_literal=106     raw_px_total=3395
tap_target_under_44=1       chrome_cast_shadow=5       control_offgrid=1
errors=0   warnings=211   STATUS=PASS
```

**It finds the problems and passes anyway.** Everything above is a WARNING; only `--strict` escalates. So the real caveat is not "it can't see this" but "**a green run means zero errors, not zero findings**". The suite is necessary and not sufficient for a much more mundane reason than assumed.

Its genuine blind spots: `line-height` is in no property category and `--lh-` is in `NON_SUBSTITUTABLE`, so the `--lh-prose` 1.6 → 1.5 drift really is invisible; it has no cascade resolution, so a rule that loses a specificity fight cannot be detected; and `SHIPPING_CSS` is only `tokens.css`, `header.css`, `play.css` — **`controls.css`, `site-theme.css`, `hero-time.css`, `footer.css` and `builder-theme.css` are never audited.** The library governs the site and is outside its own gate.

### 7.2 Coverage blind spots

- **`about.html` is excluded from `token-audit.py`'s `SHIPPING_HTML`** and browser-loaded by only two tools, both of which assert `.jbNav` only. **Nothing below the header on about.html is measured by anything.** It is also the page with 0% adoption — the two facts are related.
- **Font weight is asserted nowhere.** Zero occurrences of `font-weight` across all 34 tools. The two-weight rule passes today by discipline alone.
- **No tool ever hovers.** `page.hover()` appears nowhere. No `:active`, no `:disabled`, and normal-mode focus rings are measured only under `forced-colors:active`.
- **Contrast is checked on 2 pages, 2 element pairs, dark mode only** (`builder-theme-browser.py`), and reads `getComputedStyle().color` directly so it cannot see alpha compositing or images behind text.
- **No 4px-grid enforcement.** The `GRID` set in `token-audit.py` contains 1, 5, 6, 10, 14, 30 — it is the token ladder, not a 4px grid.
- **The ~900px radius size class is untested**, and per `tokens.css:635` is implemented as a `max-width:760px` *viewport* query, not an element size class. Tools key expectations off `width == 1440` vs `390`, so a 358px element on a 1440 viewport is asserted to 28px and passes — the opposite of the documented rule. This is exactly how `.photoFig` (§3.4) stays green.
- **Widths 391–1439 are never rendered for surfaces.**
- 2 of the 34 "tools" are asset generators, and the 7 `.test.js` files are node unit tests with zero CSS coverage. The effective design-system suite is ~25 tools.

---

## 8. What to do next — ranked by user-visible impact, then cost

### Do first (visible, cheap)

1. **Make `.baGo` a real button.** Keyboard users on apollo and ucdavis cannot reach it. One tag change plus the `.ctl` classes. *(WCAG 2.2 SC 2.1.1)*
2. **Give `.jbHome` a focus ring.** First tabbable control on all ten pages. One selector. *(SC 2.4.7)*
3. **Remove the two cast-shadow layers from `--ctl-menu-shadow`.** One token, fixes every migrated menu at once, and stops the shared library from being the thing that breaks the site's own no-shadow-on-chrome rule.
4. **Link `controls.css` on `about.html`** and convert `.abLink` → `.ctl`. It is already a structural `.ctl` clone (44px / `--r-md` / `0 var(--sp-16)` / 400). This takes one page from 0% to near-100% and gives its CTA a press state.

### Do next (structural, moderate)

5. **Delete the two inline `.ctl` copies** in `headmaker.html` and `gradientlab.html`; link `controls.css` instead. This is the headline finding and the only fix that stops future divergence rather than repairing past divergence.
6. **Add a `.ctl--on-dark` variant**, then convert `.reelClose`. Removes the one-off that was hand-matched to the library and drifted only in motion.
7. **Add a field/input primitive.** The missing form control is why headmaker and gradientlab forked in the first place; without it, they will fork again.
8. **Reconcile `--theme-duration`** — 640ms on index, 400ms elsewhere. Scope the hero value or align the token.
9. **Fix `.photoFig` to `--r-lg`** on the four case studies, and add a real element-size-class test so the ladder is enforced rather than assumed.

### Then (hygiene)

10. Add press states to the 14 one-off families that have hover but not `:active`.
11. Refresh `--theme-focus` (`site-theme.css:12`) off the stale lavender, and make the focus ring two-tone so it survives dark grounds.
12. Extend `token-audit.py`'s `SHIPPING_CSS` to cover `controls.css` and `site-theme.css`, add `about.html` to `SHIPPING_HTML`, and add a font-weight assertion. Consider promoting `chrome_cast_shadow` and `tap_target_under_44` to errors — they are currently found and ignored.

---

## Appendix — measured totals

| Width | Controls | Using system | Adoption | Surfaces | Using system | Adoption |
|---|---|---|---|---|---|---|
| 1440 | 254 | 91 | **35.8%** | 143 | 22 | **15.4%** |
| 1280 | 266 | 112 | **42.1%** | 143 | 22 | **15.4%** |
| 390 | 228 | 91 | **39.9%** | 143 | 22 | **15.4%** |

Control counts vary with lazily-loaded carousel content; surface counts are stable. Per-page control adoption at 1440: index 14/29, about **0/17**, play 7/23, headmaker **1/11**, gradientlab 10/26, apollo 13/31, strata 4/22, bearings 23/40, cluster 10/29, ucdavis 9/26.

| Stylesheet | Lines | Rules | Declarations | vs `controls.css` |
|---|---|---|---|---|
| `controls.css` | 257 | 106 | 366 | 1.0× |
| `play.css` | 1061 | 452 | 1641 | **4.5×** |
| `tournament.css` | 626 | 127 | 410 | 1.1× |
| `header.css` | 1040 | 101 | 297 | 0.8× |
| `index.html` inline | — | 591 | — | 101 rules duplicate control styling |

`header.css` is ~70% prose commentary, so its line count overstates its weight by roughly 3.5×.
