# Complete Time-Aware Thumbnails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all six home case-study covers respond to the selected time using optimized environment-only variants.

**Architecture:** Extend the existing `TimeAwareThumbnails` project registry. Reuse completed Strata/Cluster assets, produce UC Davis/R3SHORE variants, and preserve each original cover as Off.

**Tech Stack:** WebP assets, vanilla JavaScript, Node tests, Python/Playwright.

## Global Constraints

- Preserve mockup pixels for completed product covers.
- Ship 1200 and 2400 WebPs for six active states.
- Keep original covers, alt text, loading, decoding, and fetch priority for Off.
- Keep 2:1 case-study frames and existing outlines.

---

### Task 1: Integrate completed Strata and Cluster sets

**Files:**
- Add: `images/cs/variants/time/strata/*.webp`
- Add: `images/cs/variants/time/cluster/*.webp`
- Modify: `index.html`
- Modify: `time-aware-thumbnails.js`
- Modify: `tools/time-aware-thumbnails.test.js`
- Modify: `tools/time-aware-thumbnails-browser.py`

**Interfaces:**
- Consumes: `data-time-thumbnail` project slug and `SiteTheme` state.
- Produces: responsive descriptors for `strata` and `cluster`.

- [ ] Extend failing tests to expect four projects and their exact Off paths.
- [ ] Run Node tests and confirm failure on the two missing registry entries.
- [ ] Copy the verified asset sets, add data attributes, and extend the registry/groups.
- [ ] Run static and browser tests; verify all four covers decode in every state.
- [ ] Commit with message `Connect Strata and Cluster time thumbnails`.

### Task 2: Produce and connect UC Davis and R3SHORE

**Files:**
- Add: `images/cs/variants/time/ucdavis/*.webp`
- Add: `images/cs/variants/time/r3shore/*.webp`
- Modify: `index.html`
- Modify: `time-aware-thumbnails.js`
- Modify: `tools/time-aware-thumbnails.test.js`
- Modify: `tools/time-aware-thumbnails-browser.py`

**Interfaces:**
- Produces: six-state responsive descriptors for all six projects.

- [ ] Extend tests to require UC Davis and R3SHORE and verify original Off paths `images/cs/ucrec/cover.webp` and `images/cs/r3shore.webp`.
- [ ] Run tests and confirm failure.
- [ ] Use the approved palettes to generate environment-only UC Davis lighting and quiet atmospheric R3SHORE Coming Soon variants; export metadata-free sharp-YUV WebPs at 1200 and 2400 widths.
- [ ] Add data attributes and registry Off-path overrides rather than assuming `<project>-cover.webp`.
- [ ] Run the six-project, seven-state browser matrix at all three viewports; check decoding, responsive `srcset`, no layout shift, and no overflow.
- [ ] Commit with message `Complete time-aware portfolio thumbnails`.

