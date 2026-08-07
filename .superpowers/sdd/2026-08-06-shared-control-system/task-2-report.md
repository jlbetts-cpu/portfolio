# Task 2 report — shared surfaces and case-study controls

Status: complete

## Outcome

- Added token-backed shared surface primitives for Hero, specimen, media, card, and tab-rail surfaces.
- Added the Home-only neutral portrait peek from `images/neutral.webp`, clipped to the Hero at the approved hair/eye crop for desktop, 390px, and 320px.
- Preserved Home's approved Hero geometry: 28px desktop radius, 20px mobile radius, existing responsive inline padding, opaque inset rim, and shared 120px/16px outer edges.
- Aligned the Home header, Hero, work specimen, tab rail, and media frames to the same responsive outer edge; media stays on the 20px radius rung.
- Kept the Home primary and time controls present, opaque, 44px tall, and on a common baseline.
- Migrated Bearings, Apollo, Cluster, Strata, and UC Davis skip links, arrows, tabs, to-top buttons, player controls, and Strata media controls to named shared control variants.
- Converted carousel ticks from decorative `i` elements into accessible 44px buttons while retaining their 14x2px visual marks and synchronized pressed state.
- Removed duplicated late control blocks and competing page/theme chrome from all five case-study pages.
- Added one cache-generation query, `v=20260806-shared-surfaces`, to the shared stylesheet stack on every public/internal HTML page that consumes it. This prevents new component CSS from being combined with stale token CSS.
- No authored images or videos were modified or recompressed.

## Blocking regression diagnosis and fix

The live regression was caused by mixed cached generations of shared CSS. New `controls.css` rules depended on newly-added `--skip-*`, `--surface-*`, and `--ctl-container-*` values in `tokens.css`, while every stylesheet URL remained unversioned. If a tab retained the older tokens file, dependent declarations became invalid:

- the skip link's top/left/transform fell back and left it visible;
- surface radius, padding, and rim declarations disappeared;
- the header material/rim lost its semantic values.

All related shared stylesheet URLs now carry the same version key, and the static contract checks every shared link for exact generation consistency.

The stricter visual contract also caught and corrected fresh-load drift independent of caching: the generic surface rule had moved Home's Hero padding/radius, media had inherited a 28px container radius instead of the 20px media rung, the work specimen edges no longer matched the shared gutter, and the Home time control lacked an opaque material variant.

## Test evidence

Red phase:

- `python3 tools/shared-surfaces-contract.py` failed on the first unversioned shared dependency: `('about.html', 'tokens.css')`.
- `python3 tools/shared-surfaces-browser.py` failed on Home media resolving to `28px` instead of `20px`.
- Earlier Task 2 red runs failed first on the missing `--surface-ground` token and later on the portrait crop/opacity contract before implementation.

Green phase:

- `python3 tools/shared-surfaces-browser.py` — OK across Home plus all five case studies at 1440x900, 390x844, and 320x800 in light and Night modes. It verifies zero horizontal overflow, cache-safe computed materials, skip-link rest and keyboard-focus states, exact shared edges/radius rungs, Home control opacity/alignment/44px height, accessible tick geometry, and portrait crop.
- `python3 tools/shared-surfaces-contract.py` — OK.
- `python3 tools/shared-controls-contract.py` — OK.
- `python3 tools/site-theme-contract.py` — OK.
- `python3 tools/play-minimal-contract.py` — PASS.
- `python3 tools/builder-theme-contract.py` — OK.
- Python compilation for all modified contract scripts — OK.
- `git diff --check` — clean.

## Visual inspection

Inspected regenerated rest-state captures in `/tmp/shared-surfaces-browser` for Home at 1440, 390, and 320 in light and Night modes, plus the corresponding Home work captures. The skip link is absent at rest, header and Hero inset outlines remain intact, controls remain visible and aligned, all three work tabs remain visible, media edges/radii are consistent, and the portrait peek stays within the clipped eye-line composition.

## Notes

- The pre-existing untracked plan at `docs/superpowers/plans/2026-08-06-shared-control-system.md` was intentionally left uncommitted.
- Browser artifacts are temporary verification output and are not committed.
