# Task 1 report — shared controls plus Home and Play

## Outcome

- Added `controls.css` as the shared owner of control geometry, typography, focus, press, state motion, opaque secondary/icon materials, menu surfaces, and semantic rims.
- Extended `tokens.css` with semantic control, menu, primary, focus, and container material/rim aliases that resolve through the local light/Night theme.
- Migrated Home's primary CTA, Time icon control/menu rows, skip link, and header container to shared control primitives.
- Migrated Play's primary CTA, Mood secondary/menu rows, skip link, and header container to the same primitives, including a page-wide border-box reset.
- Removed the page-local Home/Play Hero and `hero-time.css` control implementations that competed with the shared foundation.
- Kept the outer header pill as a group-container exception while moving its ground and rim to shared semantic tokens; header disclosure menus are now opaque in light and Night.
- Per the final scope change, removed Play's Time button/menu, time gradients, portrait tint/cast layer, presets/controller scripts, and `hero-time.css` dependency. Play retains `images/neutral.webp` with no CSS filter and uses the neutral global page theme.
- Fixed the 44px Play fold shift caused when the shared base's positioning displaced the skip link from fixed positioning; the shared skip-link composition now restores `position:fixed`.

## Verification

- `python3 tools/shared-controls-contract.py`
- `python3 tools/site-theme-contract.py`
- `python3 tools/play-minimal-contract.py`
- `PYTHONPYCACHEPREFIX=/tmp/shared-controls-pyc python3 -m py_compile tools/shared-controls-contract.py tools/shared-controls-browser.py tools/play-minimal-contract.py`
- `python3 tools/shared-controls-browser.py` (Playwright, loopback server with approved sandbox escalation)
- `git diff --check`

The browser contract covers Home and Play at 1440×900, 390×844, and 320×800 in Off/light and Night. It asserts 44px border-box controls, 14px radii, zero layout borders, opaque secondary/icon/menu/header grounds, in-grid bounds, no horizontal overflow, exact Play fold alignment, same-row Play CTAs at 320px, and the absence of Play day-cycle UI/layers/scripts plus an unfiltered neutral face.

## Known pre-existing audit finding

`python3 tools/token-audit.py` remains red on five existing undefined `--r` references at `index.html:318`; they are reported by the audit as unreachable on Home and are outside this Task 1 control scope. The focused control, theme, Play, Python syntax, browser, and diff checks pass.
