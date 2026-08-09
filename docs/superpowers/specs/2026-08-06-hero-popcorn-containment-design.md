# Hero popcorn containment design

**Status:** User-approved on 2026-08-06.

## Purpose

Restore the version of the popcorn-and-glasses performance whose decorative pieces remain inside the rounded Hero box, without reintroducing the mobile menu clipping/internal-scroll regression.

## Architecture

- Keep `.hero` overflow visible so Time and Mood menus can escape the Hero and every row remains reachable at 320 px.
- Add a dedicated non-interactive visual-effects clipping layer aligned exactly to the Hero's rounded inner bounds.
- Route the popcorn bucket, kernels, and crumbs through that layer while preserving their stage-relative coordinates and animation timing.
- Keep the face, glasses, mouth, eyes, and normal stage stacking visually unchanged.
- The clipping layer inherits the Hero radius/corner shape, creates no scroll container, takes no pointer events, and changes no layout geometry.

## Behavior

- Case-study hover and Extras/reel hover continue to trigger the same full movie performance and contextual word.
- Popcorn may travel throughout the Hero but disappears cleanly at its rounded outline; no kernel, crumb, or bucket paints outside.
- Cleanup removes/hides every effect exactly as before. Rapid enter/leave cannot strand particles.
- Reduced motion preserves the existing simplified behavior.

## Verification

Check Case Studies and Extras at desktop and supported hover widths, including repeated entry/exit, Hero animation transforms, Night/light themes, and scrolling. At 390×844 and 320×800, confirm the Time/Mood menus remain fully reachable, `hero.scrollTop` stays zero, no horizontal overflow appears, and the visual clip matches all four Hero edges.

