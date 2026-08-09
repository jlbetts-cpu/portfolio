# Lucide Icon Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mixed utility SVGs with the approved local Lucide system without changing component geometry or the four Mood pictograms.

**Architecture:** One local `ui-icons.svg` sprite owns approved symbols; `ui-icons.css` owns size/stroke behavior. HTML uses external `<use>` references and keeps text/ARIA as the accessible name.

**Tech Stack:** SVG, CSS, static Python contracts, Playwright.

## Global Constraints

- No CDN, package, or runtime icon dependency.
- Preserve Mood pictograms, brand mark, heads/game art, authored media, and LinkedIn/Instagram marks.
- Lucide uses 24 × 24, `currentColor`, round caps/joins, and stroke width `1.75`.
- Do not change hit targets, padding, radius, gaps, labels, or interaction behavior.

---

### Task 1: Shared sprite and contract

**Files:**
- Create: `ui-icons.svg`
- Create: `ui-icons.css`
- Create: `tools/ui-icon-contract.py`
- Modify: all ten shipping HTML routes to link `ui-icons.css`.

**Interfaces:**
- Produces: `<symbol id="lucide-*">` and `.uiIcon` size variants.

- [ ] Write a failing inventory contract for required symbol IDs, uniqueness, external-use validity, and explicit custom-icon exceptions.
- [ ] Run it and confirm failure because the sprite is absent.
- [ ] Add the local sprite and shared CSS, including preserved social symbols.
- [ ] Link the CSS on all routes and re-run the contract.
- [ ] Commit with message `Add local Lucide icon system`.

### Task 2: Global, portfolio, Play, and builder replacement

**Files:**
- Modify: `header.css`, `index.html`, `about.html`, `apollo.html`, `bearings.html`, `cluster.html`, `strata.html`, `ucdavis.html`, `play.html`, `headmaker.html`, `gradientlab.html`
- Modify: `tools/ui-icon-contract.py`
- Create: `tools/ui-icon-browser.py`

**Interfaces:**
- Consumes: `ui-icons.svg#lucide-*`.
- Produces: consistent utility icons on all routes.

- [ ] Expand the contract route by route and verify each new group fails before replacement.
- [ ] Replace global header/footer and Time icons, then case-study utilities, Play controls, and builder utilities using the canonical mapping.
- [ ] Keep existing dynamic state by switching `<use href>` or predeclared visibility groups.
- [ ] Run route contracts after each group.
- [ ] Run the ten-route Off/Night browser matrix at 1280/390/320, checking missing symbols, baselines, accessible names, overflow, and console errors.
- [ ] Commit with message `Standardize portfolio icons with Lucide`.

