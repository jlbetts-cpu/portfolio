# Gradient reference notes — Jayden's boards, read closely

Sources: pinterest.com/betts3335/gradient-bg (48 pins) and
pinterest.com/organicwalnuts/pretty-ui (51 pins), browsed pin-by-pin 2026-08-02.
These notes are the standing taste contract for the Gradient Lab engine and for
how gradients enter the portfolio's UI.

## A. What the gradients ARE (the physics of the look)

1. **Layered passes, not blended fields.** Every strong reference is built like
   stacked airbrush passes with an occlusion ORDER: where two colours cross,
   each keeps its OWN edge through the intersection (orange passes over blue).
   Symmetric weighted averaging produces smudge; ordered compositing produces
   the references. (Engine: the Layer control, v18.)
2. **Tension edges.** A mass has a taut, tight flank facing the light and a
   long feathered dissolve behind. Asymmetric falloff is what makes a crescent
   read as swept rather than blobbed. (Engine: Tension, v17.)
3. **Seams saturate.** Where colours balance, chroma RISES into a richer
   intermediate hue — intersections glow, never grey. (Engine: seam chroma.)
4. **The rim escapes the silhouette.** The specular is a thin warm arc that
   sits ON the edge and wraps slightly OUTSIDE it into the halo; limb shading
   sits opposite. It belongs to the light, not to a stroke. (Engine: Rim +
   outside-alpha, v17–18.)
5. **Grain lives in the colour.** Static, chunky (CSS-pixel cells), triangular
   distribution, concentrated in transitions via mix-dithering; cores clean.
   Never animated, never a uniform overlay. (Engine: v16.)
6. **Spherical form.** Bands arc as great circles and taper at the limb;
   crescents hug the edge; one dominant light zone, few huge masses, at most
   one tiny accent; nothing symmetric or axis-aligned. (Engine: v10+.)
7. **Families in the boards not yet built:** soap-bubble glass (glossy
   specular curve + iridescent film), harmonic ripple ridges. Logged as future
   forms.

## B. How gradients LIVE IN UI (the pretty-ui board)

1. **Corner-anchored, partially cropped.** Orbs sit behind/above cards bleeding
   off a corner or an edge — the crop is deliberate; a centered orb is a
   poster, a cropped orb is UI.
2. **A quiet stage for type.** Hero washes carry tiny centred type; the
   gradient is atmosphere, the words are the subject.
3. **Ambient light inside cards.** Gradients glow from a card's edge like a
   lamp inside the component (the "alex's workspace" pattern) — warm, soft,
   bottom- or corner-lit, with plain UI controls floating on it.
4. **Always on near-white paper with quiet chrome.** Cream/off-white grounds,
   hairline borders, letterspaced micro-labels — the gradient is the only loud
   thing, and even it is soft.
5. **Rounded-window and arch crops recur** as framing devices for both photos
   and gradients.
6. **Token discipline appears in the board itself** (light/dark colour ramp
   pins): palettes are systems, not decorations.

## C. Standing implications for the portfolio

- The tournament scorecard (G3), cup identities, and lobby Earth consume the
  engine with team/cup hues as nodes; UI integration follows B1–B4 (cropped
  orbs behind cards, ambient light inside boards), never centered decoration.
- Any new gradient surface must pass the same ladder: Ember baseline first,
  then the surface's own reference pin.
