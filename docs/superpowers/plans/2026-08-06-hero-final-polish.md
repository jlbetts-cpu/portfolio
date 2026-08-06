# Hero Final Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish transparent resting controls, clear Automatic copy, and the approved readable portrait lighting.

**Architecture:** Keep SiteTheme and the existing Hero controller as the sole state owners. CSS owns resting materials and state lighting; one inline SVG SourceAlpha filter produces the colored portrait silhouette.

**Tech Stack:** HTML, CSS, vanilla JavaScript, SVG filters, Node tests, Python/Playwright browser tests.

## Global Constraints

- Off restores the original portrait and floor shadow exactly.
- Mood and Time are transparent at rest; hover/open may elevate.
- View work remains the primary CTA.
- Automatic has no resolved-state suffix.
- No portrait source, Mood behavior, Hero geometry, or outline changes.

---

### Task 1: Resting chrome and Automatic copy

**Files:**
- Modify: `hero-time.css`
- Modify: `index.html`
- Modify: `hero-time.js`
- Test: `tools/hero-specimen-check.py`
- Test: `tools/hero-time-controller.test.js`
- Test: `tools/chrome-blend-browser.py`

**Interfaces:**
- Consumes: `SiteTheme` snapshots and `#heroTimeMenu`.
- Produces: transparent resting Mood/Time controls and label-only Automatic.

- [ ] Add failing assertions requiring transparent resting secondary controls and an empty Automatic suffix.
- [ ] Run `python3 tools/hero-specimen-check.py && node --test tools/hero-time-controller.test.js`; confirm the new assertions fail.
- [ ] Set `--time-secondary-bg:transparent` for every state, preserve elevated hover/open variables, remove `#heroTimeAutoState`, and stop writing resolved text to it.
- [ ] Run the focused tests and `python3 tools/chrome-blend-browser.py`; confirm desktop, 390, and 320 pass.
- [ ] Commit `hero-time.css index.html hero-time.js tools/hero-specimen-check.py tools/hero-time-controller.test.js tools/chrome-blend-browser.py` with message `Blend Hero utility controls into scenes`.

### Task 2: Readable SourceAlpha portrait light

**Files:**
- Modify: `index.html`
- Modify: `hero-time.css`
- Test: `tools/hero-specimen-check.py`
- Create: `tools/hero-portrait-light-browser.py`

**Interfaces:**
- Consumes: mirrored `#heroTimePortraitCast.src` and Hero `data-time-state`.
- Produces: `#heroPortraitTintFilter` using `feFlood` and `feComposite in2="SourceAlpha" operator="in"`.

- [ ] Add failing static assertions for the SVG filter, absence of the old colored zero-offset drop shadow, mask size `52% 39%`, and active opacity range `0.16–0.26`.
- [ ] Add a browser matrix that switches all states, samples portrait pixels, checks Off equivalence, rapidly retargets Night → Sunset → Off → Night, and captures 1280/390/320 screenshots.
- [ ] Run both tests and confirm failure because the SourceAlpha filter is absent.
- [ ] Add the inline filter, state flood colors, approved coordinates/opacities, lower-face mask, and shared transition timing.
- [ ] Run both tests plus Hero/theme regressions and confirm green.
- [ ] Commit the implementation and tests with message `Make Hero portrait lighting readable`.

