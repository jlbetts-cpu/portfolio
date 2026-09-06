# Build log — Developmental Improvisation, home page

## v12 (2026-09-06) — one bento field, four clickable cards, and a pastel light theme
Jayden's twelfth pass, in five messages: card 02 "doesnt act like the rest of the cards and it makes the scroll weird"; the band photograph "isnt high resolution and it doesnt really make sense"; the curtain "looked a lot cleaner when it wasnt like actually a curtain"; then the direction change — "4 clickable cards talking about what developmental improv is and who Linda is", "why is gallery even in there", "we are going with a bento box theme… what if its all a beautiful bento", "even the header can be a part of the bento", and finally "make it more pastelly for the light version" with "some of the pictures come out of the bento boxes ever so slightly".

**The page is one field now.** Header tiles, hero panels, four cards, testimonials, closing field — same twelve columns, same gutter, and the same `--grid-gap` between every row. `--section-y` survives in exactly one place: either side of the ring, which is the field's only break. The hero gave up `min-height: 100svh` to do it; the card row has to break the fold or the field reads as two pages instead of one.

**The header is two tiles.** The wordmark is a panel, the controls are a panel, both on the page's own gutter with the same corner as everything under them. And **Gallery is gone from the nav** — the gallery *is* the hero, so the link pointed at the top of the page from the top of the page. About and Contact.

**The sticky stack is four cards in a row.** One shape, four times, three columns each: a head in the card's hue carrying two chips, a title and a two-line summary; the photograph under it; one control. Two of them say what Developmental Improvisation is, one says what it asks of a student, one says who Linda is. The whole card opens **the reader** — a dialog whose head takes that card's hue — so the page carries four short blocks instead of six long ones. The band is deleted: it was the same room and the same session as card 02's photograph, stretched full-bleed out of a 1440px file.

**The photographs slip out of their boxes.** `--slip` 20px, one relationship, applied identically to all four cards: the picture rises up over the coloured head. It is small on purpose — 20px reads as deliberate, 60px reads as broken — and the card's own `overflow: hidden` keeps it inside the field.

**The light theme is pastel.** Same eight hue angles, same order, taken to OKLCH **L .885** with the chroma the hue can carry there (C ≤ .105): #A8E3FE sky, #D4D5FE violet, #FECDB8 orange, #9EEEBC green, #FFC7E0 pink, #ECDA87 gold. Dark keeps the fills straight out of the SVG. Every pastel carries the warm black at better than 11.9:1, so violet's white ink is now a dark-theme-only exception through `--on-violet`.

**The curtain is flat.** Two panels of the dark ground, no pleats, no fold, no bunching — the fabric version read as a theatre curtain rather than as this site.

**Three real bugs the gates caught, two of them mine and one older.**
- The ring released its hold only when the pointer left for something that was *not* a photograph. Putting four photographs directly above the ring meant leaving the ring for a card left the flow **held for good** — the drift never came back. It releases on leaving the orbit now, not on leaving "a photograph".
- Under `prefers-reduced-motion` every revealing element still slid 12px: `.js .reveal` (0,2,0) outranks `.reveal` (0,1,0) even inside the media query, so the reset never applied. It has carried the class since v5.
- The closing field sized itself instead of sitting in the page container, so above 1793px its edges were 36px outside the column every other panel sits on. The layout gate only looked at `.section .container`; it looks at every container now.

**Measured after v12.** 41 gate lines pass, including a new `reader.mjs` and its self-test.

## v11 (2026-09-06) — the four things between 8.5 and 9
Jayden asked what would take the site to a 9 without real testimonials, then said build all four.

**The ring, rebuilt on its geometry.** It was 148px circles on a 300px radius with a 44px quote — sparse dots around small text in 780px of mostly empty ground. Eight items on a circle of radius r sit 2r·sin(22.5°) = 0.765r apart, so the item is now sized near that: 220px on a 330px radius, a necklace with 32px gaps. The quote is the second-biggest type on the page, and its column is `2r − item − 32px` — the ring's actual clear space rather than a multiplier. The gate caught the first attempt: a `1.34r` centre put 164 photograph pixels under the text at 1024 and 32 at 390.

**The nav had never had a design pass.** The links, the toggle and the action are one panel now, with the same superellipse corner as every other surface on the page; the wordmark sits on the page beside it. The full-width glass strip is gone.

**Everything below the hero arrives with intent.** The cards bring the photograph first and the text 90ms later, the band's picture settles from a 1.06 scale, the ring assembles one circle at a time going round, the testimonials stagger, the closing field rises. One trap: the ring's orbit is a 0×0 positioning origin, and **an element with no area can never satisfy an intersection threshold** — observed like that, the ring would simply never have appeared for a visitor. The stage is what is observed.

**The closing field opens with the brand's line at display scale.** It was a form and two links, and it is the last thing anyone sees.

**Card 02 was broken and Jayden caught it by eye.** Its text panel was pulled over the photograph with `margin-top: -14%` — a percentage margin resolves against the card's *width*, so at 1382px it pulled the panel 193px up and the card's own bottom edge sliced the last line off. It is positioned now, and at the **top** of the photograph: at the bottom of a sticky stack the next card climbs over it, so content parked down there is the first thing to disappear.

**And a structural fix to the gates.** The dialog gate lost three lines to a stale `.nav__actions` selector and the run still looked green, because a gate that throws prints its stack to stderr and no report line. That is the third time in this project. `run-all.sh` now checks both the exit status and whether each gate reported anything, and fails loudly when it did not — verified by pointing it at a gate that does not exist.

**Measured after v11.** 37 gate lines pass.

## v10 (2026-09-06) — the two-panel hero, four beats, the band, and the light inversion
Jayden's ninth review: the hero should layer like the reference he sent (a copy panel beside a colour panel), "the light mode should have a lighter background with the elements on top being the cream color we have now", "the logo should be in black when its light mode", "removing the fade", and — pointing at two of the three weaknesses in the rating — "how can we improve them". Then: "I dont like the random blocks of color in the carosel dont we have enough pictures" and "make sure everything in the site is optimized".

**The hero is two panels.** The copy on a cream panel, the photographs inside a colour panel that clips them. The soft top-and-bottom mask is gone: the panel's own rounded edge is the crop. One trap on the way — with `height: auto` the panel sized to its own content and the row came out 3197px tall, which pushed the copy off the screen. `overflow: hidden` does not constrain a box that is sizing to its content.

**Light inverts.** The page is #FBFAF7 and the panels on it are the cream #F0ECE3. A white card on a cream ground read as nothing; a cream panel on a near-white page reads as an object. The mark is black on the light page, scoped to the nav so the curtain's mark stays in colour.

**Four beats instead of one.** The rating called the four cards structurally identical; they now split, overlay, mirror and go solid. **And a band**: one photograph, edge to edge, 52vh, no copy, between the stack and the ring — the middle of the page had no moment of scale. `aspect-ratio` had to be cleared on it: with an explicit height a 3:2 frame derives its width from that height, and the band came out 930px wide in a 1440px page.

**No colour blocks in the carousel.** Fifteen photographs, no two black-and-white ones adjacent in a column.

**Optimised, and measured rather than asserted.** A first load at 1440 is **398 KB** uncompressed: 96 document, 71 fonts (three woff2), 41 stylesheet, 18 script, 170 images across 33 decoded files. On a phone it is 349 KB. Everything but the HTML is served `immutable` for a year and every stylesheet link carries its `?v=` stamp. Only the first two tiles of each bento column load eagerly — the panel crops the rest — and the duplicate copy of each column carries no blurred placeholder, since it sits behind the first. The band is the only image allowed to pull the 1440 file.

**Measured after v10.** 37 gate lines pass. One gate bug found: the layout gate compared card widths from `getBoundingClientRect`, which reports the stack's scale transform, so a partially covered card measured 1377 against 1382 — it reads `offsetWidth` now, because the assertion is about the layout, not the scroll position.

## v9 (2026-09-06) — full-strength colour, the gallery inside the hero, the curtain
Jayden's eighth review: "the colors are still not accurate on both dark mode and light mode", "I dont like the use of colored dots they shouldnt be there for the section headers", "we combine the gallery in the hero and it should look just like this ... notice the way it fades out and in cleanly", "the cards should look like this: with small spacing from the outer edge", "the testimonials section should look like this but colored cards here is the colors for the logo so build a colorful system around them", and a curtain opening on first load — "no tada or any darkening of the website".

**The colours were inaccurate because they were mixes.** Two rounds of washes and tints: a hue mixed into the raised ground is not the brand colour any more, and it shifts a second time between the themes. Every mix is gone. A hue is now a surface at 100%, with `--on-accent` — the one ink that clears 4.5:1 on it (six take warm black; violet is the only one dark enough to need white, 3.7:1 against 4.6:1). Because a full-strength hue is identical in both themes, the surfaces carrying one rebind their ink tokens instead of following the theme, which is what makes light and dark finally agree.

**The palette also had eight colours, not seven.** Jayden's swatch list included `#FFE469` — the star's gold, which the site had never used. Sky is the monogram, gold is the star, six arcs ring them, and the page now spends all eight exactly once, in the logo's order.

**Colour is spare.** Four full-strength cards were built first and pulled back the same day: they flooded the page and read as a toy catalogue. The card is the raised ground with a hairline, and its hue is the solid panel holding the photograph — the same tile-and-photograph pairing the hero's bento uses.

**The gallery moved into the hero.** The horizontal strip is gone. The hero's right six columns are three vertical columns of photographs plus two colour tiles, looping with the flow in alternating directions at three speeds, masked top and bottom so they fade in and out of the ground instead of stopping at an edge.

**The page sits closer to the edge.** `--page-max` 1400 → 1720 and the gutter to `clamp(16px, 2vw, 36px)`: on a 1440 laptop the page is now the screen minus one 29px inset, which is what "a small spacing from the outer edge" means.

**The curtain.** Two halves of sky over the page on the first load of a session, with the mark and a loading bar while the fonts and the hero's first photographs arrive, then they part. No scrim and no darkening — the site is already laid out behind them. Three things stop it stranding the site: a 620ms floor, a 2600ms hard failsafe, and removal from the DOM a second after it opens. Never on a reload in the same session, never under reduced motion.

**Four refinements the same day.** The curtain had no cloth in it, so the panels are pleated with two repeating gradients at different pitches, a dark fold where they meet (the two patterns were colliding into a bright line), and a slight horizontal bunch as they leave. The mark on the loading screen is the colour logo now, which forced the curtain off sky and onto **violet**: the monogram is drawn in sky, so on a sky ground its letterforms vanish and only the ring of arcs survives. The hero fills the screen — `min-height: 100svh`, with the bento running the full height of the viewport. And the display came down from 96px to 76px at 1440.

**Dark became the default.** Jayden: "the dark mode site right now looks much better ... make sure the light mode is up to the same standard or just scrap the light mode". Neither was thrown away: dark is the default now, and light was raised rather than scrapped. Its ground went from #F7F5F0 to #F0ECE3 — at three per cent off a white card, nothing on the light ground read as an object; at six it does — and `--ink-3` went to #6C665D to hold 4.5:1 over the deeper ground (measured 4.82:1).

**Measured after v9.** 37 gate lines pass, including a new `curtain` gate with a self-test that pins the curtain so it can neither travel nor be removed. Contrast worst 4.70:1 light and 5.28:1 dark over 37 text nodes each. Two bugs the gates caught in this round: the `lightbox` gate printed nothing and exited 0 after its selector went stale (a drifting tile can never satisfy Playwright's stability check — the gate now stops the columns and picks a tile that is wholly on screen), and `elementsFromPoint` cannot see the curtain at all, because the curtain is `pointer-events: none` by design and hit testing skips it; the gate asks the geometry instead.

## v8 (2026-09-05) — the rebuild on the fundamentals: the superellipse corner, the logo's own order, one shape, one field
Jayden's seventh review asked for a new prompt and a redesign: "I actually dont like the diffenrt shape pictures I wish they were all the same shape", "The only section I like and want to keep is the circle section", "the margins are too big", "the roundness doesnt have that apple smoothing of the corners", "the colors are also not in the main logo colors combinations", "the design is falling flat ... it looks boring the layouts feel uninspired", "the site needs to be something pintrest worthy like top ui".

**What the research found.** Three sources, in order of usefulness. (1) **The logo itself**, read as a file rather than as a mood: the monogram is sky and six arcs ring it in a fixed order — magenta, violet, orange, green, pink, yellow, clockwise from the top. The site had been treating seven hues as interchangeable, which is why the colour never read as the brand. (2) **Jayden's own portfolio**, which already carries `--corner: squircle` on every control, an `--sp-16-40`-style responsive ladder, inset rims instead of borders, and a display face that runs to 168px. His standard was in the repository the whole time. (3) The current editorial language — bento and asymmetric grids, Apple/Linear-style modular blocks — which is what "not boring" looks like in 2026, and which the page's centred single-column stack was not doing.

**The corner.** `corner-shape: squircle` beside every radius, one declaration on `*`. That is Apple's continuous curvature, natively, in Chrome 139+. It also applies to a 50% radius, so the ring's circles came out as rounded squares until `corner-shape: round` was added back for them — the one rule that makes this system safe.

**Colour.** The six arcs are now spent once each, in ring order, down the page, and the foot of the page is sky at full strength. Each hue carries its own `--wash-mix` (magenta 14% … yellow 46%): one mix for all seven made magenta a colour and yellow a rumour. In dark every mix sits at 20–24% — at 42% the yellow wash became a mid ground and stranded `--ink-2` on it at 3.53:1, which the contrast gate caught.

**Margins.** 1280 column in a 40px gutter → 1400 in `clamp(16px, 2vw, 32px)`. Content now starts 49px from the edge at 1440 instead of 120px.

**Shape.** Four photograph shapes → one: a 4:5 rectangle with the shared corner, everywhere, plus circles in the ring.

**Structure.** Eight sections → six. The hero is editorial — headline on seven columns, one photograph on four, one meta row — and the gallery moved directly under it so the page opens with photographs in motion. Newsletter, contact and footer were three thin bands; they are one sky field.

**Measured after v8.** 35 gate lines pass. Headline five lines at 1440, 1024, 390 and 320. Contrast worst 4.70:1 light and 5.54:1 dark over 38 text nodes each. Targets smallest 44px at four viewports. Stack cards 503px each and equal — the mirrored cards were 751 and 786 until both children were pinned to `grid-row: 1`, because grid's forward-only auto-placement was dropping the mirrored figure to a second row. 25 images on the page, none oversized. Both self-tests still catch their injected bug.

## v7 (2026-09-05) — Sen, the headline that holds the photographs, flat colour, dark mode back
Jayden's sixth review: "I dont think the gradient experiment works the clean colored cards looked a lot better", "the hero still looks far too cluttered ... the images fit inside the differnt shapes throughout", "bringing back the dark mode as an option", "just make the footer a colored moduale as well", "lets bring in sen ... sen and jakarta compliment each other better", "the gallery i dont like that it doesnt go all the way across", "im not a big fan of the star in the section header", "make the site in its most minimal and premium form no unnessesary text or information that isnt absolutly necessary".

**The hero.** The reference (Josha.io) sets photographs into the headline as shapes. The four best photographs now sit on the line inside the `<h1>` — capsule, circle, rounded rectangle, squircle — one to a line at 1024 and up. Everything else that was in the hero is gone: the four chips, the second button, and the row of four photographs under the title. What is left is the headline, the tagline and one button. The shapes are `clamp(44px, 5.1vw, 74px)` tall, which is the 44px tap floor built into the size; on a phone the floor is 1.16em of the type, so the headline's leading opens from 1.16 to 1.42 and the lines stay evenly spaced. The `<h1>` carries an `aria-label` of the plain sentence, so the heading reads as one sentence while each shape keeps its own button label.

**Colour.** Every gradient is gone — the band at the top and the foot, and the blooms on the cards. A hue is now a flat tint mixed into the raised ground on the element that carries `data-accent`: 22% in light, 30% in dark. The four stacked cards, the three testimonials, the newsletter and the popup are tinted; so is the footer, which is one rounded module inset from the page edges.

**Dark mode.** Back as a toggle in the header, applied before first paint by an inline script so there is no flash, and stored. The `contrast` gate now walks every visible text node in **both** themes — 44 nodes each, worst 4.70:1 light and 4.80:1 dark — which is a stronger assertion than the two hand-placed pixel samplers it replaces, and it has a `--self-test`.

**Type.** Sen replaces Instrument Serif: 800 for the display, 700 for the titles, over Plus Jakarta Sans 400/600. One variable latin file, 18KB, for every weight.

**Subtraction.** Removed: the star before every section label, the Welcome and Contact eyebrows, the chapter numbers on the cards, the "Email or Call Here:" line, the Home link in the nav, the sheet and the footer, the footer's tagline repeat, the footer's Menu column, and its four dead social links. The stacked cards went from two photographs each to one, in one shape, sized by height so every card shows the same amount of picture.

**The gallery** now runs edge to edge instead of starting at the column.

**Measured after v7.** 35 gate lines pass. Headline four lines at 1440 and 1024, five at 390 and 320. Contrast worst 4.70:1 (light) / 4.80:1 (dark) over 44 text nodes each. Targets smallest 44px at four viewports. 28 images on the page, none oversized — a 160px rendition was added to the pipeline because a 74px circle should not pull a 320px file. `contrast --self-test` and `ring --self-test` both catch their injected bug.

## v6 (2026-09-05) — the serif, the four, the band made quiet and returned, the structure
Jayden's fifth review: "apply C", "picking the best 4 pictures", "remove the circle", "something structurally isn't premium or something is missing", "the gradients I don't like as much as I thought, the hero one more subtle", "the shapes in the cards look off and not intentional", "the footer lacks colour", "more researched design".

**What was researched, and the principles applied.** The premium sites in the references he has sent (Maeve, the tennis school, the Strategic Plan cards, brandappart) and the ones this design leans on (Apple's product pages, Linear, Stripe) share five habits, and the page was measured against each:
1. *One idea per section, and every section built the same way.* Label, title, content, in that order, on the same column. The hero was the odd one: a strip attached to it, no tagline, and centred while everything else is left. It is now the tagline and the four best photographs; the strip is a Gallery section of its own with the same label-and-arrows row as every other section.
2. *Type carries the personality; colour does not.* Instrument Serif for the display and the section titles (his "C"), Plus Jakarta Sans for everything else. The serif is what the Maeve reference was doing that the sans version was not.
3. *Colour as light, at the edges, not as fills in the middle.* The band drops from 66% to 44% hue over white and 70% opacity, and returns under the footer so the page has a top and a bottom. The stacked cards lose their blooms; the testimonial and newsletter blooms drop from 92% to 62% at their strongest.
4. *A rule you can see.* The stacked cards had four different photograph compositions, which read as accidents. There is one now: the big rounded square at the outer bottom corner, bleeding past the card's edge, the small circle over its inner top corner; even cards face the other way. The 45° tilt stays in the ring only.
5. *Nothing decorative that a rule does not explain.* The disc and halo behind the logo are gone; the colour logo sits plain on the quiet band.

Measured after v6: the header ink over the band ≥ 4.5:1 at three moments of the drift; the title three lines at 1440 and on a phone; the band drifts at the top and at the foot; every gate line passes.


## v5 (2026-09-05) — the band, the centred hero, the lightbox
Jayden's fourth review: "the hero still lacks personality or structure", the Maeve reference, "click on images to open them", "constraint is the best design".
- **The band.** The Maeve reference is a soft colour band across the top of the page fading into white, with the title centred under it. Built as the seven logo hues in wheel order on a strip twice the page's width, blurred 56px at 90%, masked to fade by 480px, with 7% film grain multiplied over it so it reads as light. "The colours rotating": it drifts left by a transform one pass every 72s, so the blurred layer is rasterised once and the animation costs nothing; it holds under reduced motion. The header sits on it: the `contrast` gate samples the darkest pixel behind the links at three moments of the drift.
- **The hero is centred**: the title sinking into the band's fade, the four skill chips from the copy as the only other colour (each hue at 40% over white, as the reference's chips), the two buttons; then the Gallery row and the strip. The eyebrow and the left/right split are gone; the chips left card 03.
- **The lightbox.** Every photograph on the page is a button. A native dialog on the ink scrim shows one at a time from a new 1440px set (the pipeline gained a width), arrows and keys move through all of them in page order, swipe on touch, Esc and the scrim close, focus returns to the photograph. A drag on the strip beyond 6px swallows the click that follows, so dragging never opens it. The `lightbox` gate proves each of those.

- **Mid-review notes, also applied.** The stacked cards' bloom follows how much of the card is on screen instead of waiting for the pointer (Jayden: "it comes in so late"). The photographs on the stacked cards are bigger and placed free on a stage, the big one bleeding past the card's edge so part of it sits behind the wall, in four compositions; the text keeps its structure. The colour logo is back in the header, on a white disc with a halo so the band bends around it. The band's hues are each at 66% over white and spread across five page-widths, so two or three show at a time rather than the whole wheel.
- **Two bugs found by the new gates.** The strip captured the pointer on every pointerdown, so a click's target became the viewport and never reached the photograph's button; it now captures only once a drag passes 6px. The arrow step eased by a fixed fraction per frame, so headless's slower frames finished it 16px short; it is time-based now.
- **Sen, asked about.** Rendered against Plus Jakarta Sans, Instrument Serif and Fraunces on the hero title (`docs/type-specimen.jpg`). Sen is another geometric sans: rounder and wider, the same voice a little louder, so pairing it adds a second family without contrast. Recommended: keep one family; if the title needs character, the move the Maeve reference makes is a serif for the display only. Not applied; Jayden decides.

Measured after v5: header ink over the darkest pixel of the band ≥ 7.3:1 at three moments of the drift; the lightbox serves ≥ 960px files, a drag does not open it, Esc returns focus; a stacked card 20% on screen shows 5% of its bloom and a card filling the screen shows all of it; the rest as v4.


## v4 (2026-09-05) — one theme, colour contained, the bloom
Jayden's third review, in his order:
- **The logo no longer rotates.** The header ring rule and its script are gone; the mark is the black `#mark`.
- **The soft gradient from his reference, for the testimonials.** brandappart-style articles are blocked from this sandbox (larsenwork.com, MDN), so the technique came from his own portfolio: `hero-time.css` builds each sky as one radial gradient anchored below the box with seven eased stops from the hue to the page colour, and the footer layers two radials veiled toward the page with `color-mix`. Four candidates were rendered side by side on the five hue pairs (single eased radial; two hues; two blurred blobs; two desaturated hues) and looked at. The single eased radial was the closest to the reference; the two-hue versions drew a grey diagonal seam where the gradients crossed, because a stop ending in `transparent` interpolates through black. The bloom that shipped is the eased radial in oklab plus a fainter second light of the partner hue, with every stop ending in transparent white.
- **The whole site light; colour contained; the logo black.** Dark mode, the toggle, the dark header, the flat coloured surfaces, the coloured chips and the hover fills are all removed. Colour now appears in the photographs, in the blooms (testimonials, newsletter, popup, and rising on a stacked card under the pointer) and as the 16px section star.
- **The creativity-in-motion ring stays; more of that.** The shaped-photograph language extends to the stacked cards: each card's two tiles are now a rounded square beside a circle.
- **The vectors are gone.** The arc, the star and the ring shapes, their symbols and their flow bindings are removed.
- **Testimonials on his reference layout**: three white cards on a grid, the middle one a step lower, the quote, then the person with an ink initial, the bloom at the foot. The tilted pile is gone.

Measured after v4: the caption ink over the darkest bloom pixel under a testimonial's role line ≥ 4.5:1 (the `contrast` gate now reads rendered pixels); a stacked card's bloom reaches opacity 1 under the pointer and 0 after; `ring` 0 / 0 / 0 at three viewports; `layout` 0px overflow at 320; axe 0 violations.


## v3 (2026-09-05) — the strip, the ring, colour on hover, the shapes
Jayden's second review, in his order:
- **"I don't like the outline."** The frames are gone; photographs are bare rounded rectangles. On the light ground the anti-aliased edge of a rotated card no longer shows, which is what the frame had been hiding.
- **"The arch is not what I'm going for, but I want that circle around the quote, like brandappart's see-more-work and the video."** The video (4.4s, 60fps, 27 frames looked at) shows eight photographs in alternating rounded squares and 45° tilted squares, upright, turning around a centre panel. That is now the quote section: eight shaped photographs (round → tilt → circle) on a 300px circle around “Creativity in motion creates knowledge!”, turning with the flow, stopping under the pointer. brandappart.com itself is blocked by this sandbox's proxy, so the video and the tennis reference were the sources.
- **"Colour sparingly, only on hover for the cards."** The stacked cards and the testimonials are white at rest and take their hue under the pointer through a `data-surface="hover"` token flip, crossing over in 240ms. The newsletter card is the one permanent coloured surface.
- **"More vectors, a few well-designed shapes with flow."** Three marks drawn from the logo's own vocabulary: the star, the arc of the ring, the ring. Three placements (hero, testimonials, newsletter), one hue each, moved only by the scroll part of the flow so they are still at rest and never read as spinners. Not the figures: he found a row of them creepy.
- **"Research what the new hero should be, focusing on images."** Four options were weighed. (A) A full-bleed photograph with the title over it: one image, and the copy would have to sit on a scrim, which the brand's flat rule forbids. (B) A photograph grid or collage: static, and it competes with the stack's tiles right below. (C) The ring as the hero: it is now the quote's, and a circle of small photographs is not "photos as the main focus". (D) The tennis-school reference he attached: eyebrow, a big title on the left, a row of tall photo cards below that bleed off the right, arrows to move them. D is built, with the strip driven by the flow (22px/s at rest, faster with the scroll, one card per arrow press, draggable) so the hero moves the way the rest of the page does. Cards are 300×375 at 1440, four and a third visible; 236px wide on a phone.

Measured after v3: `ring` 0 photograph pixels under the quote, 0 photograph-on-photograph, 0 items outside the stage at three viewports; the arrow steps the strip by exactly one pitch (324px at 1440); hover stops the drift within 0.05°; `contrast` 64+ nodes ≥ 4.5:1 in both themes; axe 0 violations in both themes; `layout` 0px overflow at 320, the title 3 lines at every width.


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
