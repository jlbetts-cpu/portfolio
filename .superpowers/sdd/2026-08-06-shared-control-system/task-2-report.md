# Task 2 report — shared surfaces and case-study controls

Status: complete

## Outcome

- Added token-backed shared surface primitives for Hero, specimen, media, card, and tab-rail surfaces.
- Restored the original live animated Home portrait stage in the Hero; the static raster replacement is gone. The stage remains clickable for the existing dizzy reaction, case-card hover/focus uses the existing smile, and Extras hover/focus runs the existing popcorn/glasses movie reaction.
- Scaled and clipped the live head to the approved hair/eyes/brows/nose-bridge crop at desktop, 390px, and 320px. The entire head/effects layer lifts during Extras and settles on leave/blur.
- Preserved Home's approved Hero geometry: 28px desktop radius, 20px mobile radius, 120px/16px shared outer edges, 52px navigation at y=8, a 12px nav-to-Hero gap, and a 16px viewport-bottom gap.
- Made the Hero itself the single clipping/rim boundary. Every atmosphere layer, the Night star field, and the head share that boundary and horizontal center axis, eliminating the bottom seam and duplicate outline.
- Preserved the approved pre-dawn, sunrise, daytime, dusk, and sunset gradients byte-for-byte while refining Night to a blue-black field with a restrained lower violet halo and 32 irregular, low-amplitude twinkling stars.
- Flattened the Home case collection and the five case-study tab/media assemblies into one collection shell with an integrated tab divider and content region; media stays on the 20px desktop/14px compact radius rung.
- Kept the Home primary and time controls present, opaque, 44px tall, and on a common baseline.
- Migrated Bearings, Apollo, Cluster, Strata, and UC Davis skip links, arrows, tabs, to-top buttons, player controls, and Strata media controls to named shared control variants.
- Converted carousel ticks from decorative `i` elements into accessible 44px buttons while retaining their 14x2px visual marks and synchronized pressed state.
- Kept theme changes structural: light and dark modes use the same component DOM and geometry. The time menu always opens below its trigger, clamps to the viewport, and scrolls when needed.
- Made the Extras reel frame itself keyboard-focusable and Enter/Space activatable. Hover and focus are composed so an incidental pointer leave cannot cancel a still-focused movie reaction.
- Removed duplicated late control blocks and competing page/theme chrome from all five case-study pages.
- Added one cache-generation query, `v=20260806-shared-surfaces`, to the shared stylesheet stack on every public/internal HTML page that consumes it. This prevents new component CSS from being combined with stale token CSS.
- No authored images or videos were modified or recompressed.

## Review regression diagnoses and fixes

The live regression was caused by mixed cached generations of shared CSS. New `controls.css` rules depended on newly-added `--skip-*`, `--surface-*`, and `--ctl-container-*` values in `tokens.css`, while every stylesheet URL remained unversioned. If a tab retained the older tokens file, dependent declarations became invalid:

- the skip link's top/left/transform fell back and left it visible;
- surface radius, padding, and rim declarations disappeared;
- the header material/rim lost its semantic values.

All related shared stylesheet URLs now carry the same version key, and the static contract checks every shared link for exact generation consistency.

The stricter visual contract also caught and corrected fresh-load drift independent of caching: the generic surface rule had moved Home's Hero padding/radius, media had inherited a 28px container radius instead of the 20px media rung, the work specimen edges no longer matched the shared gutter, and the Home time control lacked an opaque material variant.

The review pass found three additional interaction/composition causes:

- Hero atmosphere layers were clipping inside an inner child while a separate pseudo-element drew another rim, producing a white bottom seam and duplicate outline. Clipping and the single inset rim now belong to `.surface--hero`.
- The initial portrait integration used a static image, so the existing gaze, dizzy, smile, glasses, and popcorn systems could not run. The original stage DOM and engine are now the only Hero portrait implementation.
- The desktop reel's visible control was pointer-only, while the focus test targeted a button hidden in fine-pointer layouts. The reel frame now owns the focus/keyboard contract, and teardown waits until both hover and focus have left.

## Test evidence

Red phase:

- `python3 tools/shared-surfaces-contract.py` failed on the first unversioned shared dependency: `('about.html', 'tokens.css')`.
- `python3 tools/shared-surfaces-browser.py` failed on Home media resolving to `28px` instead of `20px`.
- Earlier Task 2 red runs failed first on the missing `--surface-ground` token and later on the portrait crop/opacity contract before implementation.
- The review browser contract caught the Hero atmosphere bottom mismatch, static portrait replacement, insufficient head scale/crop, star density/brightness, and the Extras popcorn overlay remaining at opacity zero after focus.

Green phase:

- `python3 tools/shared-surfaces-browser.py` — OK across Home plus all five case studies at 1440x900, 390x844, and 320x800 in light and Night modes. It verifies zero horizontal overflow, identical light/dark component geometry, exact header/Hero/collection edges and radius rungs, one inset rim, shared Hero/atmosphere bounds, live head scale/crop/axis, 32-star containment and reduced-motion behavior, approved day-state layer coverage, below-trigger menu placement, pointer/programmatic/keyboard skip-link states, real case-study media, stable scene swaps, 44px controls, gaze, dizzy, smile, and Extras focus movie/settle behavior.
- `python3 tools/shared-surfaces-contract.py` — OK.
- `python3 tools/shared-controls-contract.py` — OK.
- `python3 tools/site-theme-contract.py` — OK.
- `python3 tools/play-minimal-contract.py` — PASS.
- `python3 tools/builder-theme-contract.py` — OK.
- Python compilation for all modified contract scripts — OK.
- `git diff --check` — clean.

## Visual inspection

Inspected regenerated captures in `/tmp/shared-surfaces-browser`:

- `home-1440-dark.png`, `home-390-dark.png`, and `home-320-dark.png`: premium blue-black Night treatment, restrained violet halo, subtle irregular stars, exact single Hero clip/rim, and approved live-head crop.
- `home-night-twinkle-a-{width}.png` and `home-night-twinkle-b-{width}.png`: low-amplitude star phases remain visible without flashing; the reduced-motion contract holds them static.
- `home-movie-1440.png`, `home-movie-390.png`, and `home-movie-320.png`: the entire head/effects layer lifts, glasses and popcorn appear together, and the Hero boundary still clips the composition.
- Case component captures, including `bearings-component-1440-light.png`, confirm integrated collection tabs/content and real full/mockup media rather than nested specimen shells.

## Notes

- The pre-existing untracked plan at `docs/superpowers/plans/2026-08-06-shared-control-system.md` was intentionally left uncommitted.
- Browser artifacts are temporary verification output and are not committed.
