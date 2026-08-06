# Stripe hero gradient research

## Sources

- https://stripe.com/
- https://stripe.com/jobs
- https://images.stripeassets.com/fzn2n1nzq965/115d4Vd5LVAsqFGDR1ClAv/0ceb2c44a7a7182cd624262420af7544/wave-fallback-desktop.png?w=2784&fm=webp&q=60
- https://images.stripeassets.com/fzn2n1nzq965/5DrmXrFYpKk43Kj0I1MXQr/287b3c2a13ae8d4d7d0bf8305037de4e/palette.png?fm=webp&q=95

## Findings to implement

1. The outlined hero is the primary light container. Clip the source inside `.hero`; allow only a small, soft ambient color leak outside it so the separate header remains mostly neutral and consistent.
2. Use one broad, clean, cropped bottom-origin form that reads immediately as a half-circle of light rising behind the portrait. Small low mesh nodes, discrete color blobs, random rays, filaments, contour lines, and the site's Gradient Maker aesthetic must not be visible in the result.
3. Build strength through restrained hue separation and localized contrast, not global opacity, saturation, or visual busyness.
4. Do not render folds, tension edges, seams, rays, or filament texture. The result is a clean gradient half-circle, not an interactive mesh demo.
5. Off is a hard reset: stop the mesh and explicitly suppress its fallback, bloom, portrait cast, and the original `.heroAura`.
6. Keep the thin header and hero specimen outlines visible above every active lighting layer.

## Uncertainty

The exact six-state time-of-day selector shown in the supplied reference could not be located on Stripe's current public site and may be retired or unindexed. These recommendations combine the supplied screenshot with directly observable current Stripe assets and behavior; they do not copy proprietary source code.
