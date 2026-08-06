# Stripe stats-section time gradient research

Checked 2026-08-06 against the live Stripe homepage. The exact reference is the later **“The backbone of global commerce”** `.stats-section`, not Stripe's hero.

## Primary sources

- https://stripe.com/
- https://b.stripecdn.com/mkt-ssr-statics/assets/_next/static/css/3d8751ca831f8fae.css

## Exact construction

Stripe fills the entire section with a state base, then places each state gradient on an absolutely positioned `inset:0` layer inside two `overflow:hidden` wrappers. It is not a square/circular DOM element, WebGL mesh, image, mask, blur, or blend mode. The radial center sits at roughly `50% 100–106.44%`, so section clipping reveals only the rising upper dome. Opaque outer stops converge on the section base; transparent stops would expose a spotlight boundary.

The line/ray visualization is a separate canvas/static asset and is not part of the gradient. Do not reproduce it.

```css
.timeClip,.timeGradient{position:absolute;inset:0}
.timeClip{overflow:hidden;border-radius:inherit;pointer-events:none}
.timeGradient{opacity:0;transition:opacity 1.2s cubic-bezier(.65,0,.35,1)}
.timeGradient.isActive{opacity:1}
```

## Exact served desktop gradients (940–1609px)

```css
--pre-dawn:radial-gradient(103.24% 102.63% at 50% 102.63%,#486ffd 0,#7f81f3 9.84%,#c489ff 20.83%,#dac0ff 34.13%,#eadcff 44.86%,#f9f6ff 58.59%,#f8fafd 100%);
--sunrise:radial-gradient(102.68% 99.11% at 50% 104.6%,#cb83ff 0,#ff90b9 15.77%,#ffc977 30.62%,#ffd79b 38.04%,#fff1dc 50.11%,#fff 63.1%,#fcfdfe 77.95%,#f8fafd 98.81%);
--daytime:radial-gradient(102.84% 104.98% at 50% 104.98%,#0071c1 1.33%,#60a8e2 15.71%,#b4d8ff 33.15%,#d9ebff 45%,#f8fafd 60%);
--dusk:radial-gradient(102.83% 103.24% at 49.98% 104.51%,#ffb451 0,#efc680 16.73%,#b4d8ff 33.03%,#d2e8ff 43.38%,#fafdff 59.16%,#fdfeff 76.24%,#f8fafd 100%);
--sunset:radial-gradient(103.12% 100% at 50% 100%,#ffa577 0,#ff90a1 15.52%,#ddadff 30.09%,#ecd8ff 45.72%,#f5eaff 54.96%,#f8fafd 88.16%);
--night:radial-gradient(102.82% 106.44% at 50% 106.44%,#fcfdfe 1.11%,#6763e4 28.73%,#453bb3 45.76%,#29227d 63.37%,#1e2064 78.67%,#141e4b 100%);
```

Observed section bases are light for Pre-dawn through Sunset and `#0d1738` for Night. Stripe's state transition is `1.2s cubic-bezier(.65,0,.35,1)` and becomes immediate below 940px or under reduced motion.

## Portfolio adaptation contract

1. Fill the entire outlined `.hero` with the active state background.
2. Put the radial on an `inset:0` child clipped to the hero—not on a 1:1 orb.
3. Use the opaque outer stop as the hero base so the CTA/headline zone becomes background rather than a lit wash.
4. Suppress FluidMesh/canvas, interior bloom, original `.heroAura`, portrait halo/cast, rays, lines, grain, and filaments.
5. Preserve all six percentage recipes on mobile rather than copying Stripe's night-only small-screen exception.
6. If retained, exterior spill is an original adaptation behind the hero at no more than `.04–.08` opacity; Stripe itself has no spill.
7. Off removes all gradient/spill layers and restores the neutral specimen while preserving its thin outline.
