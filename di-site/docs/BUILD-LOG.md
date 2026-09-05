# Build log — Developmental Improvisation, home page v1

## Decisions made where the prompt left a choice
- **Arch tilt 0.4 × angle.** Jayden asked for cards "going with the arch"; at 0.5 the side cards read as people falling over on the mock, at 0.22 they read as upright. 0.4 gives 32° at the sides.
- **Ring centre 0.08r above the fold**, not on it, so the copy block clears the buttons on short viewports (1280×720 and 1024×768 had 15px and 9px under the buttons with the centre on the fold).
- **Fourteen slots, cards 0.32r.** Bigger cards were the ask; at sixteen slots that width overlapped at the sides.
- **Card colours are the logo hues**, per Jayden, not the pastels. Violet takes white ink because dark ink on it is 3.8:1. On violet the ink tiers are removed: white on violet is 4.6:1 and cannot fade.
- **Photo 12 (the 2011 boy) is out of the arch.** The gallery set has better children's photographs.
- **The pause control sits at the bottom centre of the hero**, under the buttons, not over a photograph.
- **Figures at 64px on desktop, 48 on mobile.** At 88px the band shouted.

## Measured
- Orbit gate (copy pixels / card-on-card / repeats / top card): see the gate output in the reply.
- Total transfer and Lighthouse: not measured in this environment (no Lighthouse; the images total 15 MB on disk across all widths, of which a first paint at 1440 requests the 480-wide AVIFs for the arch, about 20–50 KB each).

## Needs from Linda
1. Which phone number is right: (857) 352-3221 as shipped, or (877) 352-3221 as the search index shows.
2. Social profile URLs for LinkedIn, Instagram, Facebook and X, or which to drop; they link to `#` now.
3. Releases for the children in the gallery photographs (the old site published them; confirm rather than assume).
4. Three to five real testimonials with name and role, to replace the placeholders.
5. The newsletter provider and its form endpoint (`[NEWSLETTER_ACTION_URL]` in two forms).
6. Whether the footer needs a privacy line.
7. Copy for the Gallery and Contact pages.

## Not built in v1
- Gallery and Contact pages (the nav links anchor to the arch and the contact section).
- The "Yes, and" and "Grid to circle" illustrations (recorded in the prompt for the About page).
- Lighthouse and transfer-size numbers (tooling not available offline).
