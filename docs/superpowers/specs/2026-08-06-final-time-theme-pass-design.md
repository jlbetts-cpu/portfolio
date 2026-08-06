# Final Time Theme Pass Design

**Date:** 2026-08-06  
**Status:** Approved for implementation

## Goal

Finish the time-of-day system as one coherent portfolio experience: resting chrome must reveal the real background beneath it, Automatic must read clearly, the Gradient Maker and Add your head routes must receive complete site dark mode, and every home case-study thumbnail must respond to the selected time.

## Hero finishing

- The header, Mood button, and time button are transparent at rest. Their existing hairline remains visible.
- Hover, focus, and open states may use the shared elevated neutral surface.
- View work remains a distinct primary action.
- The time menu row reads `Automatic` only. The trigger icon continues to show the resolved time state.
- The portrait uses the separately approved Option B readable directional-light treatment.
- Off removes every time cast and preserves the original portrait and floor shadow.

## Builder routes

`gradientlab.html` and `headmaker.html` opt into explicit semantic page identities and use the shared site-theme state.

- Page backgrounds use `--theme-page`.
- Working panels use `--theme-surface`; recessed fields and wells use `--theme-elevated`.
- Resting utility controls are transparent or page-matched where they sit directly on the page; controls inside a panel retain a quiet semantic surface when needed for grouping.
- Primary actions use the shared focus/accent material and remain distinct.
- Text, dividers, sliders, selects, drop zones, saved-head shelves, status messages, menus, footer, and header all receive dark semantic colors.
- Gradient output, color swatches, uploaded photography, generated heads, and crop/canvas pixels are never filtered or recolored.
- Existing layout, control geometry, no-scroll builder behavior, and mobile composition remain unchanged.

## Time-aware thumbnails

- Bearings, Apollo, Strata, Cluster, UC Davis, and R3SHORE all participate in the existing time-aware thumbnail controller.
- Off restores each original cover exactly.
- Six active states use responsive 1200 and 2400 WebPs.
- Completed Strata and Cluster assets are reused without regeneration.
- UC Davis receives six environment-only lighting variants while its UI mockup remains unchanged.
- R3SHORE receives six atmospheric Coming Soon variants; the mockup remains intentionally quieter than the environment.
- Every variant preserves the existing 2:1 frame geometry, image outline, alt text, lazy/eager behavior, and responsive `srcset` policy.

## Icons

The previously approved local Lucide sprite migration remains in scope. The four Mood pictograms, brand mark, head/game art, and LinkedIn/Instagram trademarks remain custom. The time-state and general UI icons use the approved Lucide mappings and local sprite architecture.

## Verification

The final pass must verify desktop 1280 × 900, mobile 390 × 844, and mobile 320 × 800 in Off and Night, plus all six time states on Home. It must cover rapid time changes, reduced motion, Hero menus, builder controls, thumbnail decoding, no horizontal overflow, no console errors, and unchanged authored-image pixels where preservation is required.
