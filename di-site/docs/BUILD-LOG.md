# Build log — Developmental Improvisation, home page

## v2 (2026-09-05) — light by default, the flow, the frames
Jayden's review of v1, in his order, and what was done:
- **"The di isn't in the middle of the people."** Measured, not eyeballed: the ring's inner circle is centred at (393, 451.7) in the 787×842 file, and the letters' box sat 18 units above and 5 left of it. The `d`, `i` and star are moved by (+5, +18) in every logo file; the ring's rotation origin is the inner circle's centre, not the box's.
- **No pause control; slight movement, faster on scroll (brandappart.com).** The CSS keyframes are gone. One value, the flow, drives the arch and the header ring: a 3.75°/s drift plus 0.06° per scrolled pixel, eased with a 0.32s time constant. Hovering a photograph eases the drift to a stop.
- **Links on the right.** Brand left; Home, Gallery, Contact, the theme toggle and Subscribe right.
- **The figures band is gone**, with its symbol, its asset, its tokens and its pause control.
- **Light mode, a premium off-white, a dark header, both themes with a toggle.** Ground #F7F5F0, ink #1B1916, header #1B1916 in both themes. Dark: #131211 / #F4F1EB. Deeper mark tones of the seven hues so stars read on the light ground.
- **White edges on the photographs.** That was the raised-ground card showing at the anti-aliased edge of a rotated rounded box. Each photograph now sits in a 3px frame of one brand hue, which is also what he asked for ("the colours around it as an outline").
- **The cards' animation, cleaner and more realistic.** The rotateX flip is gone. Cards stick 12px lower each; a covered card scales from its top edge by 4.5% per card above it, in step with the scroll. No state flips.
- **The newsletter in colour.** The card and the popup are the orange surface.
- **The colour logo in the corner, out of the middle.** The hero copy hangs 24px above the fold, in the lowest and widest part of the arch, capped at 5.8% of the hero's height so it fits on a 720px screen.
- **Photographs are make or break.** Cards are 213px at 1440×900 (203 in v1, 128 on a phone, 116 before). Every crop was reviewed on a contact sheet at its rendered size: the boy-fist photograph replaces bow-ties-wall in the arch (the small boy was cut in half at the frame's edge) and the two Linda photographs swap so the dark studio portrait sits in a coloured frame rather than reading as a black tile.

Measured after v2: `orbit` 0 / 0 / 0 at six viewports, hover stops within 0.05°, 300px of scroll turns the arch 18°; `contrast` 64 nodes ≥ 4.5:1 in both themes; `targets` smallest 44px; `layout` 0px overflow at 320; axe 0 violations in both themes.

## v1 (2026-09-05)

## Decisions made where the prompt left a choice
- **Arch tilt 0.4 × angle.** Jayden asked for cards "going with the arch"; at 0.5 the side cards read as people falling over on the mock, at 0.22 they read as upright. 0.4 gives 32° at the sides.
- **Ring centre 0.08r above the fold**, not on it, so the copy block clears the buttons on short viewports (1280×720 and 1024×768 had 15px and 9px under the buttons with the centre on the fold).
- **Fourteen slots, cards 0.32r.** Bigger cards were the ask; at sixteen slots that width overlapped at the sides.
- **Card colours are the logo hues**, per Jayden, not the pastels. Violet takes white ink because dark ink on it is 3.8:1. On violet the ink tiers are removed: white on violet is 4.6:1 and cannot fade.
- **Photo 12 (the 2011 boy) is out of the arch.** The gallery set has better children's photographs.
- (v1 had a pause control and a figures band; both removed in v2.)

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
