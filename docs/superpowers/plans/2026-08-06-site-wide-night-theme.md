# Site-wide Night Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Track every checkbox and stop on a failing verification rather than weakening the contract.

**Goal:** Make the resolved Night state a no-flash, site-wide neutral dark mode on every shipping page while preserving the Stripe-derived Hero atmosphere, authored media/game colors, and accessible interaction behavior.

**Architecture:** Introduce one pure time/theme state model and one synchronous shared controller loaded before themeable CSS. The controller owns `jbHeroTimeMode`, Automatic boundary scheduling, root attributes, and a subscription/event API. Home's Time menu becomes a client of that controller instead of owning a second timer. A shared semantic-token stylesheet supplies the neutral dark foundation, with narrow page adapters for Home, case studies, About, Play, Headmaker, and Gradient Lab.

**Tech Stack:** Semantic HTML, token-driven CSS, vanilla JavaScript, CommonJS-compatible unit modules, Node.js tests, Python static contracts, the existing in-app browser.

**Supersession note:** This plan supersedes the Hero-only page-scope and header-cutoff constraints in `docs/superpowers/plans/2026-08-06-time-of-day-hero.md`. It does not replace that plan's approved six gradient formulas, Off behavior, control/menu, responsive, or accessibility requirements.

## Locked behavior

- Shipping routes are exactly `index.html`, `about.html`, `apollo.html`, `bearings.html`, `cluster.html`, `strata.html`, `ucdavis.html`, `play.html`, `headmaker.html`, and `gradientlab.html`.
- `Night` is dark. Automatic resolves dark only from 20:30 through 03:59. Every other named state and Off is light.
- Use neutral foundations `#0B0C0F`, `#111318`, and `#171A21`; reserve purple for atmosphere, focus, selection, and localized glow.
- Do not filter, invert, regenerate, or recolor photographs, mockups, video, faces, gradients, arena art, or team colors.
- Initial theme resolution never animates. User-initiated changes use 400 ms desktop and 280 ms mobile. Reduced motion settles immediately, including when enabled during a transition.
- Home keeps the six approved Stripe-derived radial gradients. Off has no gradient and uses the original floor shadow. Active time states remove that floor shadow.
- Each active day state applies restrained, directional portrait lighting without redrawing or replacing the face. The cast must be clipped to the portrait alpha; Off has none.
- Play scoreboards keep their mechanics and team flashes, adding only a frosted near-black material and localized soft white-violet backing light in dark mode.
- Forced colors suppresses decorative atmosphere but preserves structure, selection, media boundaries, and focus.
- Do not stage `.superpowers/` or the thumbnail proof assets from the primary checkout.

## Public interfaces

`site-theme-state.js` exposes a browser and CommonJS API:

```js
SiteThemeState.MODES
SiteThemeState.STATES
SiteThemeState.normalizeMode(value)
SiteThemeState.resolveAutomatic(date)
SiteThemeState.resolveState(mode, date)
SiteThemeState.themeForState(state) // "dark" | "light"
SiteThemeState.resolveSnapshot(mode, date) // {mode,state,theme}
SiteThemeState.msUntilNextBoundary(date)
```

`site-theme.js` exposes:

```js
SiteTheme.getSnapshot()             // frozen {mode,state,theme}
SiteTheme.setMode(mode, options)    // options: {persist=true, animate=true}
SiteTheme.refresh(now)              // recompute Automatic and timer
SiteTheme.subscribe(listener)       // returns unsubscribe()
```

Each committed change also dispatches `jbthemechange` on `window` with the snapshot in `event.detail`. Root state lives on `<html data-theme data-theme-mode data-theme-state>`; `body` mirroring is compatibility-only and must never be the authority.

---

### Task 1: Integrate reviewed prerequisites and establish a clean baseline

**Files:**
- Integrate commit `cded735` from `broadcast-match` (shared footer consistency).
- Integrate commit `56108a3` from `codex/play-screen` (reviewed Play restoration/fixes).
- Preserve current Time commits including `364637b`, `667648d`, and `29986c6`.

- [ ] Confirm both prerequisite commits are absent before integration:

```bash
git merge-base --is-ancestor cded735 HEAD; test $? -eq 1
git merge-base --is-ancestor 56108a3 HEAD; test $? -eq 1
```

- [ ] Cherry-pick the footer commit, resolve only genuine overlaps, and run `git diff --check`.
- [ ] Cherry-pick the Play commit, retain its Add-your-head-first order, preloaded heads, footer, scroll fix, picker lock, and malformed-storage recovery.
- [ ] Run the available baseline checks before theme edits:

```bash
node tools/hero-time-model.test.js
node tools/hero-time-controller.test.js
python3 tools/hero-specimen-check.py
python3 tools/fluid-mesh-check.py
python3 tools/hm-check.py
python3 tools/token-audit.py
git diff --check
```

Expected: all exit 0. If a cherry-pick changes a baseline expectation, fix the integration rather than updating an unrelated assertion.

- [ ] If conflict resolution changed files beyond the two cherry-pick commits, stage only the explicit conflicted paths reported by `git status --short` and commit them as `Integrate reviewed site foundations`. Do not create an empty commit when both cherry-picks apply cleanly.

---

### Task 2: Extract and test the shared theme state model

**Files:**
- Create: `site-theme-state.js`
- Create: `tools/site-theme-state.test.js`
- Modify: `hero-time-presets.js`
- Modify: `tools/hero-time-model.test.js`

- [ ] Write `tools/site-theme-state.test.js` first. Cover 03:59/04:00/06:00/09:00/17:00/18:30/20:30/23:59, invalid modes, Off, all manual modes, theme mapping, frozen snapshots, and next-boundary timing.

```js
const assert=require("node:assert/strict");
const S=require("../site-theme-state.js");
const at=(h,m=0)=>new Date(2026,7,6,h,m,0,0);
[[3,59,"night"],[4,0,"pre-dawn"],[6,0,"sunrise"],
 [9,0,"daytime"],[17,0,"dusk"],[18,30,"sunset"],
 [20,30,"night"]].forEach(([h,m,state])=>
  assert.equal(S.resolveAutomatic(at(h,m)),state));
assert.equal(S.themeForState("night"),"dark");
S.STATES.filter(x=>x!=="night").forEach(x=>assert.equal(S.themeForState(x),"light"));
assert.deepEqual(S.resolveSnapshot("off",at(23)),{mode:"off",state:"off",theme:"light"});
```

- [ ] Run `node tools/site-theme-state.test.js`; expect RED because the module is absent.
- [ ] Implement the module in the same UMD/CommonJS shape used by `hero-time-presets.js`. Keep the six device-time boundaries in this module only.
- [ ] Change `hero-time-presets.js` to consume `SiteThemeState` in the browser and `require("./site-theme-state.js")` in Node. Retain only Hero presets/interpolation there; re-export state helpers temporarily for compatibility.
- [ ] Update the existing Hero model test to assert delegated results and no duplicate `BOUNDARIES` declaration.
- [ ] Run:

```bash
node tools/site-theme-state.test.js
node tools/hero-time-model.test.js
node --check site-theme-state.js
node --check hero-time-presets.js
```

- [ ] Commit:

```bash
git add site-theme-state.js hero-time-presets.js tools/site-theme-state.test.js tools/hero-time-model.test.js
git commit -m "Extract shared time theme state"
```

---

### Task 3: Build the synchronous no-flash theme controller

**Files:**
- Create: `site-theme.js`
- Create: `tools/site-theme-controller.test.js`
- Create: `tools/site-theme-contract.py`
- Modify: all ten shipping HTML files listed above

- [ ] Write a DOM-harness test around the public controller. Inject fake `Date`, `sessionStorage`, `setTimeout`, `matchMedia`, `document.documentElement`, and `CustomEvent`. Assert:
  - persisted manual Night sets all three root attributes synchronously on evaluation;
  - missing/invalid/throwing storage falls back to Automatic;
  - manual modes update storage and snapshot once;
  - Automatic removes the key and schedules the exact next boundary;
  - listeners and `jbthemechange` receive one identical snapshot;
  - repeated same-state refresh is idempotent;
  - `destroy()` in the test harness clears timers/listeners.
- [ ] Run `node tools/site-theme-controller.test.js`; expect RED.
- [ ] Implement `site-theme.js` as a tiny synchronous IIFE. Resolve and apply root attributes before registering later listeners. Add `.theme-ready` only after the initial attributes are committed so CSS never animates the first decision.
- [ ] Treat `sessionStorage` read/write/remove as separately fallible. A failed persistence operation resolves current state as Automatic and keeps the app usable.
- [ ] Use one boundary timer only while mode is Automatic. Recompute on `visibilitychange` and `pageshow`.
- [ ] Subscribe to `prefers-reduced-motion` changes; set `data-reduced-motion` immediately and dispatch a theme settle event so Home can cancel existing Web Animations.
- [ ] Write `tools/site-theme-contract.py` to parse exactly the ten shipping pages and verify both scripts precede themeable styles:

```html
<script src="site-theme-state.js"></script>
<script src="site-theme.js"></script>
```

The contract must also prove internal prototypes are not in the shipping list and every shipping page has only one copy of each script.
- [ ] Wire the two scripts at the top of `<head>` on all ten pages, before `tokens.css`, `header.css`, page inline styles, or `site-theme.css`.
- [ ] Run controller, contract, syntax, and HTML parse checks.
- [ ] Commit:

```bash
git add site-theme.js tools/site-theme-controller.test.js tools/site-theme-contract.py \
  index.html about.html apollo.html bearings.html cluster.html strata.html ucdavis.html \
  play.html headmaker.html gradientlab.html
git commit -m "Add no-flash site theme controller"
```

---

### Task 4: Establish shared semantic dark tokens and chrome

**Files:**
- Create: `site-theme.css`
- Modify: `header.css`
- Modify: `footer.css`
- Modify: all ten shipping HTML files
- Modify: `tools/site-theme-contract.py`

- [ ] Extend the contract to require one `site-theme.css` after page/header/footer CSS and before closing `</head>` on every shipping page.
- [ ] Define semantic aliases without mutating the raw ramps:

```css
:root{
 --theme-page:#fdfdfd;--theme-surface:#fff;--theme-elevated:#f8f8f8;
 --theme-ink:#111214;--theme-muted:#686b73;--theme-rim:rgba(17,18,20,.12);
 --theme-material:rgba(255,255,255,.86);--theme-focus:#111214;
 --theme-atmosphere:transparent;--theme-duration:400ms
}
:root[data-theme="dark"]{
 color-scheme:dark;
 --theme-page:#0B0C0F;--theme-surface:#111318;--theme-elevated:#171A21;
 --theme-ink:#F4F5F7;--theme-muted:#A7ABB4;--theme-rim:rgba(255,255,255,.14);
 --theme-material:rgba(17,19,24,.86);--theme-focus:#D9D7FF;
 --theme-atmosphere:rgba(103,99,228,.16)
}
```

- [ ] Add 280 ms mobile timing and zero duration for reduced motion. Apply transitions only under `.theme-ready`; never use `transition:all`.
- [ ] Adapt shared body, selection, focus, header, disclosures, footer, skip link, scrollbar/native controls, and specimen-outline roles to semantic values. Preserve current geometry and sticky behavior.
- [ ] Add explicit guards so `img`, `picture`, `video`, `canvas`, `.face`, case-study media, and game artwork have no theme `filter`, `opacity`, or blend-mode changes.
- [ ] Add `@media (forced-colors:active)` to remove `--theme-atmosphere` and keep boundaries/focus visible.
- [ ] Run `python3 tools/site-theme-contract.py`, `python3 tools/token-audit.py`, syntax/HTML checks, and `git diff --check`.
- [ ] Commit:

```bash
git add site-theme.css header.css footer.css tools/site-theme-contract.py \
  index.html about.html apollo.html bearings.html cluster.html strata.html ucdavis.html \
  play.html headmaker.html gradientlab.html
git commit -m "Define shared site dark theme"
```

---

### Task 5: Delegate Home Time control to the shared controller

**Files:**
- Modify: `hero-time.js`
- Modify: `hero-time.css`
- Modify: `index.html`
- Modify: `tools/hero-time-controller.test.js`
- Modify: `tools/hero-specimen-check.py`

- [ ] Expand the controller test first to prove Home never reads/writes `jbHeroTimeMode`, never owns a boundary timer, subscribes to `SiteTheme`, and calls `SiteTheme.setMode()` from menu choices.
- [ ] Remove hard-coded Daytime state from initial Hero markup. Before paint, copy root `data-theme-mode` and `data-theme-state` to the Hero, or let selectors use root state directly.
- [ ] Refactor `hero-time.js` so it owns only Time-menu behavior and Hero scene rendering. Subscribe to `SiteTheme`; update checked item, trigger icon, Automatic label, Hero state, and scene layers from the supplied snapshot.
- [ ] Replace the split CSS-transition/Web-Animation path with one interruptible transition coordinator. Before retargeting, capture computed gradient/spill/portrait values, cancel all existing animations, then animate every affected layer using the same duration/easing. Semantic colors continue through root CSS variables with the same clock.
- [ ] Add a live reduced-motion handler that cancels every in-flight scene animation and writes final opacities immediately. Ensure rapid Night → Off → Night never leaves multiple gradients, spill, or stale portrait cast visible.
- [ ] Delete the old `heroTimeHeaderScene`/tabs cutoff behavior. Site dark chrome now persists below the Hero; the Hero's radial remains clipped inside its outline.
- [ ] Preserve Off as exact zero gradient/spill/portrait cast plus original `.floorshadow`.

#### Portrait lighting acceptance

- [ ] Use the existing `.heroTimePortraitCast` mirror, clipped by the face asset's alpha and kept inside the Hero effects stack. Do not generate alternate face bitmaps.
- [ ] Drive directional light through state variables: `--time-cast`, `--time-light-x`, `--time-cast-opacity`, and a restrained highlight/shadow pair. Limit active overlay opacity to 0.30; no visible rectangular image block, halo, hard mask edge, or recoloring of the black hair.
- [ ] Set physically coherent directions: cool low bounce for Pre-dawn/Night, warm lower-side light for Sunrise/Sunset, neutral low-intensity fill for Daytime, and cooler reduced fill for Dusk.
- [ ] Keep the original face source synchronized through all Mood source swaps, preload states, and closed-eye frames. Add contract assertions that Mood remains the sole owner of face identity and Time only mirrors/tones it.

- [ ] Run:

```bash
node tools/site-theme-controller.test.js
node tools/hero-time-controller.test.js
python3 tools/hero-specimen-check.py
node --check hero-time.js
git diff --check
```

- [ ] Browser test persisted Night direct load, Off direct load, rapid switching, mid-transition reduced motion, every Mood during every Time state, 390×844 and 320×800. Confirm no first-paint flash and no portrait rectangle.
- [ ] Commit: `git commit -m "Connect Hero scenes to site theme"` with only the listed files staged.

---

### Task 6: Theme Home below the Hero, About, and case-study routes

**Files:**
- Modify: `site-theme.css`
- Modify: `index.html`, `about.html`, `apollo.html`, `bearings.html`, `cluster.html`, `strata.html`, `ucdavis.html`
- Modify: `tools/site-theme-contract.py`

- [ ] Add failing contract assertions for representative semantic hooks on Home work tabs/cards/footer, About content/cards, case-study prose/facts/rails/nav, and media rims.
- [ ] Replace page-specific literal light surfaces with narrowly scoped semantic adapters. Do not make broad replacements inside media artwork or authored thumbnails.
- [ ] Keep the case-study images at their original color and exact sizing. In dark mode, apply the specimen-thin `--theme-rim` to photo/mockup containers, including mobile full-width covers, without changing their radius or margins.
- [ ] Ensure selected tabs, primary links, and View-work cursor remain distinct on `#0B0C0F`; sticky tabs must not flash white when crossing the Hero boundary.
- [ ] Verify the footer design is identical on all seven routes and consumes shared theme values.
- [ ] Run the contract, token audit, all existing case-study checks, HTML parsing, and `git diff --check`.
- [ ] Browser-check every route at desktop, 390×844, and 320×800 in both themes. Compare header/content widths and confirm no horizontal overflow.
- [ ] Commit: `git commit -m "Theme portfolio and case study pages"`.

---

### Task 7: Theme Play and illuminate scoreboards

**Files:**
- Modify: `play.css`
- Modify: `play.html`
- Modify: `site-theme.css`
- Modify: `tools/hm-check.py`

- [ ] Add failing static assertions that dark-mode adapters exist for Play hub chrome, menus/pickers/tournament panels, `.hmScore`, and `.sbCard`, while arena/team variables remain untouched.
- [ ] Apply semantic dark materials to the Play shell, header/footer, selection panels, modal surfaces, head picker, instructions, and tournament chrome. Preserve the authored arena field backgrounds and team color triplets.
- [ ] For `.hmScore .sbCard`, use `#111318`/frosted near-black with the current compact geometry. Add a separate `::before` or `.sbLight` behind the card:

```css
:root[data-theme="dark"] .hmScore:has(.sbCard)::before{
 content:"";position:absolute;inset:-28px -44px;z-index:-1;pointer-events:none;
 background:radial-gradient(ellipse at 50% 55%,rgba(233,232,255,.28),rgba(103,99,228,.13) 42%,transparent 72%);
 filter:blur(12px)
}
```

Keep it behind the board, not over numerals or faces. Do not overwrite `.sbHit` goal-flash shadows; compose the resting material via variables so flash mechanics still win during goals.
- [ ] Confirm team names/numbers, split flaps, trophy, clutch state, and End Match maintain contrast at rest and during flashes. Reduced motion removes only pulsing animation, not score state.
- [ ] Run `python3 tools/hm-check.py`, Play syntax checks, the site contract, token audit, and `git diff --check`.
- [ ] Browser-test Play hub, head picker, live match, goal flash, match end, and tournament on desktop/390/320 in both themes.
- [ ] Commit: `git commit -m "Theme Play and illuminate scoreboards"`.

---

### Task 8: Theme Headmaker and Gradient Lab without recoloring output

**Files:**
- Modify: `headmaker.html`
- Modify: `gradientlab.html`
- Modify: `site-theme.css`
- Modify: `tools/site-theme-contract.py`

- [ ] Add failing assertions for themed tool chrome and explicit preservation guards around generated head/canvas/gradient output.
- [ ] Adapt tool backgrounds, inspectors, wells, fields, buttons, menus, dividers, export panels, and footers to semantic surfaces/ink/rims.
- [ ] Keep every canvas and generated gradient/head preview color-managed exactly as authored. The Night theme may change surrounding chrome, never the exported pixels or renderer configuration.
- [ ] Verify native inputs/readouts honor `color-scheme:dark` and visible focus.
- [ ] Run Headmaker/FluidMesh contracts, site contract, token audit, syntax/HTML checks, and `git diff --check`.
- [ ] Browser-test create/edit/export flows at desktop/390/320 in both themes.
- [ ] Commit: `git commit -m "Theme creative tools"`.

---

### Task 9: Cross-route motion, accessibility, and release verification

**Files:**
- Modify only files required by failures found below.
- Update relevant tests for each real fix; never relax an acceptance assertion.

- [ ] Run the complete automated suite:

```bash
node tools/site-theme-state.test.js
node tools/site-theme-controller.test.js
node tools/hero-time-model.test.js
node tools/hero-time-controller.test.js
python3 tools/site-theme-contract.py
python3 tools/hero-specimen-check.py
python3 tools/fluid-mesh-check.py
python3 tools/hm-check.py
python3 tools/token-audit.py
find . -maxdepth 1 -name '*.js' -print0 | xargs -0 -n1 node --check
git diff --check
```

- [ ] In the browser, test all ten routes in both themes at desktop, 390×844, and 320×800. For each, check direct load, reload, same-tab navigation, sticky header, footer, menus, media rims, no horizontal overflow, and no console errors.
- [ ] Test the six Automatic boundaries with an injected/fake clock, manual Night, every non-Night mode, Off, invalid storage, throwing storage, `pageshow`, visibility refresh, rapid switching, and an Automatic boundary while a non-Home route is open.
- [ ] Turn reduced motion on during a running theme transition; confirm immediate stable settlement. Test forced colors with decorative atmosphere suppressed and all controls/focus readable.
- [ ] On Home, validate face lighting with every Mood and closed-eye frame; confirm Off has the sole floor shadow. On Play, validate the scoreboard at rest, goal flash, clutch, trophy, and mobile tournament.
- [ ] Request an independent code review focused on first-paint ordering, duplicate state ownership, media mutation, contrast, responsive overflow, and transition cancellation. Resolve every Critical or Important finding and rerun the suite.
- [ ] If verification required corrections, stage only the exact files named in the failing task and commit them as `Polish site-wide Night theme`. Do not create an empty commit when no correction was required.

- [ ] Push `codex/time-of-day-hero` only after the working tree is clean and every check above passes.
