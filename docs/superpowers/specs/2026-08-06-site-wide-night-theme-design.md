# Site-wide Night theme design

**Status:** User-approved on 2026-08-06.

## Purpose

Turn the Home Time control's resolved `night` state into a real site-wide dark mode. Automatic Night and manual Night both activate it; every other manual or resolved state remains light. The result must feel like one coherent portfolio, not a purple Hero placed on otherwise light pages.

## Shipping scope

Theme every user-facing route: `index.html`, `about.html`, `apollo.html`, `bearings.html`, `cluster.html`, `strata.html`, `ucdavis.html`, `play.html`, `headmaker.html`, and `gradientlab.html`. Internal prototypes and audit/specimen utilities are excluded.

## State and first paint

- Keep `jbHeroTimeMode` as the manual/Automatic mode key in `sessionStorage`.
- A small shared synchronous bootstrap runs in `<head>` before themeable CSS on every shipping page.
- It normalizes the stored mode, maps Automatic using the existing device-time boundaries, and sets `data-theme="dark"` or `data-theme="light"` on `<html>` before first paint.
- Automatic resolves Night from 20:30 through 03:59 and schedules the next boundary on every open page.
- Manual Night activates dark immediately and persists across same-tab navigation. Off, Pre-dawn, Sunrise, Daytime, Dusk, and Sunset activate light.
- Storage errors fall back to Automatic. Direct visits and reloads never paint a known-wrong theme first.
- Home's Time controller and the shared theme controller communicate through one explicit event/API rather than separately guessing state.

## Shared architecture

- Add a focused shared theme bootstrap/controller and a shared theme stylesheet.
- Define semantic aliases rather than rebinding the raw gray ramp: page, surface, elevated surface, strong ink, muted ink, rim, material, focus, and purple atmosphere.
- Load the theme stylesheet after page styles where necessary, then keep page adapters narrowly scoped and documented.
- Use `color-scheme:dark` only for the dark root so native controls and scrollbars participate.
- Do not invert or filter images, mockups, video, faces, gradients, or game artwork.

## Visual system

Dark foundations are neutral, not purple:

- Page: `#0B0C0F`.
- Standard surface: `#111318`.
- Elevated surface: `#171A21`.
- Primary ink: soft white.
- Secondary ink: cool muted gray.
- Rims: the existing thin specimen line rendered with translucent white.
- Purple is reserved for atmosphere, selected states, focus accents, and restrained glows.

Home keeps the exact Stripe-derived Night radial inside the outlined Hero. The page, tabs, cards, case studies, and footer use neutral dark materials below it. Header chrome stays dark across the page rather than returning to white at the work tabs.

Case-study media retains original color and gains the correct light dark-mode rim. Text, rails, facts, links, cards, and footer materials consume semantic theme values. Primary actions use soft-white fill with dark ink; secondary actions use elevated dark materials.

## Play and scoreboards

- Theme the Play hub, game menus, pickers, tournament chrome, modal surfaces, header, and footer.
- Preserve each arena's authored field colors and team colors.
- Give scoreboard/HUD cards a frosted near-black material with a localized soft white-violet light behind the board. The light improves score readability without becoming a bright rectangle or recoloring the arena.
- Preserve split-flap mechanics, goal flashes, team colors, and game feedback.
- Validate scoreboard contrast at rest, during flashes, on mobile, and in tournament layouts.

## Motion and preference behavior

- Never animate the initial theme decision.
- After load, synchronize theme-aware background, ink, rim, material, Hero gradient, and header changes with one duration/easing: 400 ms desktop and 280 ms mobile.
- Interrupted changes restart from current computed values without a white flash or muddy overlap.
- A live `prefers-reduced-motion` change cancels in-flight decorative/theme animations and settles immediately.
- Forced colors suppresses purple atmosphere while preserving structure, selection, focus, and readable media boundaries.

## Accessibility and verification

- Meet WCAG AA for body text and controls and 3:1 for relevant component boundaries/focus indicators.
- Preserve keyboard order, sticky-header behavior, menus, skip links, and scroll offsets.
- Test every shipping route at desktop, 390×844, and 320×800 in light and dark.
- Test direct load, reload, manual Night, Automatic Night, each boundary, storage failure, cross-page navigation, open-page boundary updates, reduced motion, forced colors, rapid switching, and no horizontal overflow.
- Run the token audit, JavaScript syntax checks, HTML parsing, page-specific contracts, and browser console checks.

## Approved thumbnail palette reference

- Pre-dawn: `#486FFD`, `#7F81F3`, `#C489FF`, `#EADCFF`.
- Sunrise: `#CB83FF`, `#FF90B9`, `#FFC977`, `#FFF1DC`.
- Daytime: `#0071C1`, `#60A8E2`, `#B4D8FF`, `#F8FAFD`.
- Dusk: `#FFB451`, `#EFC680`, `#B4D8FF`, `#FAFDFF`.
- Sunset: `#FFA577`, `#FF90A1`, `#DDADFF`, `#F5EAFF`.
- Night: `#6763E4`, `#453BB3`, `#29227D`, `#141E4B`, over neutral `#0B0C0F` when used outside the artwork.

## Review findings folded into this design

The site-wide bootstrap replaces the hard-coded Daytime first paint. Persistent dark chrome supersedes the previous Hero-only header cutoff. The implementation must also resolve the existing interrupted Night/Off desynchronization and cancel in-flight Web Animations when reduced motion changes.
