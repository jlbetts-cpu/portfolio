# Stripe hero gradient research

## Sources

- https://stripe.com/
- https://stripe.com/jobs
- https://images.stripeassets.com/fzn2n1nzq965/115d4Vd5LVAsqFGDR1ClAv/0ceb2c44a7a7182cd624262420af7544/wave-fallback-desktop.png?w=2784&fm=webp&q=60
- https://images.stripeassets.com/fzn2n1nzq965/5DrmXrFYpKk43Kj0I1MXQr/287b3c2a13ae8d4d7d0bf8305037de4e/palette.png?fm=webp&q=95

## Findings to implement

1. Treat the separate header and outlined hero as one page-level lighting scene. Clipping the effect inside `.hero`, or leaving the header opaque, weakens the composition.
2. Use broad, cropped bottom-origin forms that read as a half-circle or rising arc. Small low mesh nodes create isolated blobs and should be avoided.
3. Build strength through hue separation and localized contrast, not global opacity or saturation.
4. Create depth with ordered folds, tension edges, seams, and restrained filament texture. Use the existing mesh `bend` and `tension` controls plus contour/glass layers instead of adding a generic radial wash.
5. Off is a hard reset: stop the mesh and explicitly suppress its fallback, bloom, portrait cast, and the original `.heroAura`.
6. Keep the thin header and hero specimen outlines visible above every active lighting layer.

## Uncertainty

The exact six-state time-of-day selector shown in the supplied reference could not be located on Stripe's current public site and may be retired or unindexed. These recommendations combine the supplied screenshot with directly observable current Stripe assets and behavior; they do not copy proprietary source code.
