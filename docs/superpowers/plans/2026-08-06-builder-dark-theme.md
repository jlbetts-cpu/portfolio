# Builder Dark Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Gradient Maker and Add your head complete semantic dark-mode treatments without recoloring their authored output.

**Architecture:** Add explicit builder page identities and narrow adapters in `site-theme.css`. Existing local CSS retains geometry; semantic overrides change only color, background, border, and box-shadow.

**Tech Stack:** HTML, CSS custom properties, Python static contracts, Playwright.

## Global Constraints

- Do not filter gradient output, uploaded images, crop canvases, generated heads, or swatches.
- Preserve the no-scroll desktop builders and existing mobile layout.
- Resting page chrome blends; working panels remain legible semantic surfaces.

---

### Task 1: Builder semantic adapters

**Files:**
- Modify: `gradientlab.html`
- Modify: `headmaker.html`
- Modify: `site-theme.css`
- Create: `tools/builder-theme-contract.py`

**Interfaces:**
- Consumes: root `data-theme`, `--theme-page`, `--theme-surface`, `--theme-elevated`, `--theme-ink`, `--theme-muted`, and `--theme-rim`.
- Produces: `body[data-theme-page="gradientlab"]` and `body[data-theme-page="headmaker"]` adapters.

- [ ] Write a failing contract requiring both page identities, semantic page/panel/control selectors, output-media exclusions, and shared transition coverage.
- [ ] Run `python3 tools/builder-theme-contract.py`; confirm failure on missing page identities.
- [ ] Add the identities and semantic adapters for panels, labels, fields, selects, sliders, tabs, drop zone, steps, saved-head shelf, status copy, menus, and primary actions.
- [ ] Re-run the contract, HTML parsing, JavaScript syntax, theme contracts, and token audit.
- [ ] Commit with message `Theme creative builder pages`.

### Task 2: Builder browser matrix

**Files:**
- Create: `tools/builder-theme-browser.py`
- Modify: `site-theme.css`

**Interfaces:**
- Consumes: both builder URLs and `SiteTheme.setMode()`.
- Produces: Off/Night evidence at 1280 × 900, 390 × 844, and 320 × 800.

- [ ] Write browser assertions for page/panel/field computed colors, header blending, visible focus, zero horizontal overflow, and unchanged canvas/image filter values.
- [ ] Run the matrix and confirm any remaining raw light surfaces fail.
- [ ] Add only the missing semantic selectors identified by computed-style evidence.
- [ ] Re-run the matrix and shared regressions; save screenshots under `/tmp/builder-theme-browser`.
- [ ] Commit with message `Verify builder dark mode`.

