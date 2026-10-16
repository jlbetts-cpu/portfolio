# Build log — Developmental Improvisation, home page

## v59 (2026-10-16) — her work in China: the film
*"my aunt was given a video to add to the site where should we put it I told her we can put it in its own section about her work in china."* The film is 1:57, portrait (540×960), from an iPhone: an interview, Linda telling how a student her teachers gave up on became an educator, beside a Chinese interviewer, then a workshop in China, with English and Chinese subtitles burned in, opening on its own title card and closing on "Play. Discover. Grow."

**Where: straight after the quote ring.** Her line, "Creativity in motion creates knowledge!", and then the work in motion. Straight after "Who Linda is" reads best on paper, but every section alternates white and grey, and a section there would have pushed the ring, which stays as it is, onto white. After the ring only the testimonials (now grey) and the closing section (now white) change ground, and the closing section and the footer, which were both grey, alternate now too. The email field takes the ground it sits on, so on white it is the light grey field the dialog has.

**How it sits**: the shape of the two sections above, the headline and the words, then the film under them at its own 9:16: 405px wide on a desktop, 720 tall, whole on a 900px screen under the header; the column's width on a phone (350×622 at 390). Its poster is its own first frame, the title card, so play hands over without a jump; the card's 12px black bars are cropped from the poster, which is what sits on the page. One quiet button, the pause control's light at 56px, in the bottom-right corner: in the centre it sat on "Changed" in the poster's title. Play turns the sound on (it is a woman telling her own story) and hands over to the browser's own controls and focus, which know fullscreen and the keyboard better than anything built here.

**What it weighs**: nothing until it is asked for. `preload="none"`, and the poster is lazy, so a walk down the whole page fetches none of the film and the poster once it is near (28 KB). The iPhone's HEVC is not played by Chrome or Firefox on many machines, so the film is re-encoded to H.264 at CRF 26 with its AAC sound copied as it was: 11.5 MB, laid out to start playing before it has all arrived. CRF 23 was 16.1 MB and 28 was 9.3; the subtitles read the same at all three, and 26 keeps more of the floor's texture than 28. Decoded end to end with no errors.

**A bug the gate found before anyone could**: a browser that cannot play H.264 (this test Chromium, which has no decoder of its own) left a dead poster with no button, because when every `<source>` fails the spec has the video wait for another, and play()'s promise never settles. The last source's own error now gives the button back, with focus.

The copy is placeholder like the two sections above; the title is his phrase. New gate `film.mjs`: the place and the grounds, nothing fetched, the poster at 1440 and on a phone, play (answered, since this browser cannot decode it), the refusal, and the file (H.264/AAC, fast-start, stamped, the browser's controls without the script); its self-test preloads the film, puts its section on grey and plays it muted. 82 lines, sixteen self-tests.

## v58 (2026-10-16) — the photographs, sharp
A walk down the page at 1440 found the ring's circles soft, softer than their size allowed. Measured on every photograph at eight screens: on a 2x screen at 1440 the files were stretched a median **1.83x in the ring, 1.94x in the two sections and 1.61x in the strip** (2.1x at worst), and at 1x the strip and the ring were 1.6x and 1.8x.

**Why: `sizes` said the frame, not the photograph.** A frame fills with its photograph (`object-fit: cover`), so a photograph wider than its frame is drawn wider than the frame: a 3:2 one in the strip's 4:5 frame at 1.875 times the frame's width, a 4:3 one in a circle at 1.33 times. The browser chooses a file by `sizes`, and every `sizes` gave the frame's width; the ring's said 148px for a 220px circle and the sections' 44vw for a 560px column, and the sections' photographs were never offered a file past 960. Each photograph now has its own `sizes`, the frame's width at each breakpoint (measured at nineteen widths) times its own crop factor, and the sections' photographs are offered their 1440 and 1920.

**A 640px step.** With nothing between 480 and 960, a strip photograph on a 2x screen, which needs about 520px, fetched the 960: four times the pixels for 8% more width. The image pipeline now writes 640 too. The sources are not on this machine, so the first 640s were made from the best file already there (the 960 JPEG at q82, or a larger AVIF), with the pipeline's own settings; set beside the 480 enlarged, the 640 is plainly sharper and shows nothing of being made that way. The next run from the sources replaces them.

**A 3x phone is served as 2x**: at arm's length a 3x photograph is not told from a 2x one (Twitter measured it in 2019 and capped theirs), and it is 2.25 times the pixels, so at 2.5dppx and over a phone's `sizes` are said two-thirds as large.

Now nothing is stretched past 1.05x except two photographs whose originals are small (linda-laughing, 960px wide, at 1.17x in its section on a 2x screen; cast-stage-small, 600px, at 1.22x in the ring). Looked at side by side on a 2x screen, the strip's faces, hands and the video call's screen are visibly crisper. **The price is bytes**: a visit's photographs on a 2x laptop go from 260 KB to 627 KB (the first screen 160 to 396 KB), on a 1x one from 141 to 251 KB, and on a 3x phone from 260 to 330 KB (508 KB without the cap). Nothing waits for them: the curtain waits only for the type, and each fades in over its blurred placeholder.

**The images gate could not have caught it**: it measured against the frame and asked only that nothing be too large, so it passed the soft page, and against the frame it now called a 1.95:1 photograph in a 4:5 frame "oversized". Both sides are now measured against the width drawn, at 1440 on 1x and 2x and on a 3x phone: no file stretched past 1.25x unless it is the largest there is, none more than twice what is drawn unless it is the smallest. Its new self-test puts back the old `sizes` and fails with 21 soft photographs at 1x alone. 75 lines, fifteen self-tests.

## v57 (2026-10-16) — a careful read of the viewer's gestures
*"keep improving and iderating do the recommended."* The viewer had gained a lot of gesture code in two days, so before anything new it was read line by line for bugs. Three were real, each now measured, fixed and gated.

**The first tap after a swipe was swallowed.** On a phone, swipe to the next photograph, then tap the close button or a preview: nothing happened, and it took a second tap. A swipe arms a flag that eats the click it might end in, so a drag that ends on the scrim cannot close the viewer; but a finger's swipe ends in no click, and the flag was only cleared by a touch on the photograph itself, so it waited and ate the next tap anywhere else. Any new touch in the viewer now clears it, before the stage's own touch arms it again for one that catches a page in flight.

**A swipe straight after a short pull was held still.** Pulled down a little and let go, the photograph springs back over 280ms; a sideways drag begun in that time did not move it at all for the whole 120px, because the running spring outranked the finger. A new touch now lands whatever is still settling (the spring, the stage coming back up, a photograph fading in) before it takes hold: the photograph now sits under the finger to the pixel (-20, -40 … -120).

**The neighbours were warmed with a file nothing showed.** Opening a photograph fetched the two either side ahead of time, as the largest WebP (1440 or 1920px), while the viewer shows the AVIF its own `srcset` picks: over four steps on a phone, about 515 KB that was never shown, beside about 244 KB that was. They are now warmed with a preload that has the viewer's own `srcset`, `sizes` and type, so it fetches exactly the file the viewer then asks for. Measured at 390@2x, 390@3x, 1440@1x and 1440@2x: every photograph shown was fetched once, with no WebP and no file twice.

The lightbox gate's phone checks gained the tap after a swipe and the swipe after a pull, with two planted bugs: a touch on the previews and the close button that never reaches the viewer, and a spring that runs on under a new touch. 73 lines, fourteen self-tests.

## v56 (2026-10-16) — pull down to close, as Photos does
*"im going out so just keep improving and iderating do the recommended."* Of the viewer ideas recommended and not yet built, the one that finishes it as Photos: on a phone, a photograph pulled down closes.

**Drawn down, the photograph follows the finger** (half as much sideways), shrinking to 70% and taking a corner as it goes (edge to edge it has none; up to 40px), while the stage fades to show the page behind and the row of previews and the controls go first. **Its own frame on the page is empty while it is pulled**, the whole frame and its blurred placeholder, as Photos empties the slot: the first build left the page's copy showing through the fading stage, so the photograph was seen twice, then a blurred ghost of it. **Let go, and where the throw would land decides** (§6 again): past 30% of the stage it closes, flying back into its frame from where the finger left it, because the view transition captures it there, and the frame is filled again inside the transition so the old picture has the empty slot and the new one the photograph; short of that it springs back on the page's spring, the stage brought up over the same time. Drawn up, it resists and nothing happens. The first 8px decide the gesture: sideways pages, downwards dismisses.

The lightbox gate's phone checks gained the pull (a short one springs back with the frame whole, halfway the frame is empty and the stage fading, thrown it closes with the frame whole, upward stays open), with a planted bug, a frame that is never emptied. 73 lines, fourteen self-tests.

## v55 (2026-10-16) — the pause, only when it is wanted
*"I dont think i like how visible the pause and play button are its a little alarming should be close to invisible"*, then *"maybe only on hover"*. It is not there until a pointer is over the strip (it fades in over 160ms, out over 240). A phone has no hover, so a touch on the strip shows it for three seconds, as a video's controls come up on a tap; a keyboard reaching it shows it; a reader who has asked for more contrast always sees it. Hidden, it takes no taps, so the photograph under it is never shadowed by an invisible button.

**A bug the phone check found**: after a finger dragged the strip, a tap on the pause did nothing. A drag leaves a flag that eats the click it would otherwise end in, so it cannot open a photograph; a finger's drag ends in no click, the pause stops its own pointerdown so the strip never cleared the flag, and the pause's tap was eaten. The flag now eats a photograph's click only.

The reel gate checks it hidden and untouchable at rest and shown over the strip, and on a phone that a touch shows it, a tap on it pauses, and three seconds later it is gone. 73 lines.

## v54 (2026-10-16) — a pause for what moves by itself
WCAG 2.2.2 (level A) asks that motion which starts by itself, runs past five seconds and sits beside other content can be paused. The strip and the ring never stop, and hover, a keyboard's focus and reduced motion still them but are not a control. Asked, he picked one quiet pause button from three.

**One control over the strip's right end**, 44px, Apple's for an auto-playing video but in the page's own light: a white circle at 82% with a solid ink glyph (pause, then play), so it reads on the darkest and the brightest photograph beneath it. The dark translucent circle Apple uses was built first and the layout gate failed it, rightly: no control on this page is filled darker than mid-grey, his rule. Its glyphs are Phosphor's solid weight, the first two in the sprite (the outlined weight thinned to two hairlines at 16px). It is a true circle (it was drawn with the page's superellipse corner first, a rounded square).

**What it stills**: the strip, the ring, the mark's sway and the glint (frozen where it is), and the scroll's push. It stops within a pixel: pausing also drops the angle still to catch up, which had let the strip coast about 10px over a second and a half. A hand can still drag the strip while paused, the choice is kept for the next visit, and play sets it all moving again. Under reduced motion, where nothing moves, it is not there.

**A latent bug it found in the flow**: after any long hold, the loop that drives the strip and the ring could stop for good on release. Its idle test saw the hold eased to 0 on the release's first frame (no time had passed yet) and called that still; it now counts as idle only when nothing holds it and nothing will move. **And the keyboard's hold belongs to the frames**, so focus moving on to the pause control lets it go.

The reel gate gained the pause (control, stills all three, a hand still moves it, kept on reload, resumes, absent under reduced motion), with two planted bugs: a hold that holds nothing, and a page that forgets. Its keyboard check now Tabs off the frames and then out of the strip. 72 lines, fourteen self-tests.

## v53 (2026-10-16) — the keyboard, and a jump is not a scroll
*"keep iderating and polishing design."* A keyboard was walked through the whole page at 1440, Tab by Tab, measuring where every focus landed. Everything was on screen but the film strip.

**The strip is one tab stop, not fifteen**, as the ARIA carousel pattern has it, and focus is never off the screen (WCAG 2.4.11): three of its fifteen stops had landed partly or wholly off it (one at x -152), while the strip drifted on under the focus. Now Tab lands on the frame most on screen; the arrow keys move along it, Home and End to its ends; the strip holds while a key has it; and a frame given focus slides fully onto the screen first, 16px in (the run's first frame can come no further than the edge, because the run starts there). Only a keyboard's focus holds or slides: a click's does not, and nor does the focus the viewer hands back when it was opened by a pointer. That last one was a real bug the new gate found: click a frame, close the viewer with Esc, and the strip stayed frozen, because a modal dialog restores focus to its opener inside `close()` itself and Esc made it a keyboard's focus. Opened with Enter, the hand-back still holds, so a keyboard reader's frame does not drift away. The ring holds for a keyboard too.

**A jump is not a scroll.** Tab, an anchor link, find-in-page and Home move the page in one event of hundreds of pixels, and each was pushing the strip and the ring as if scrolled by hand: a keyboard arriving at the ring watched it swing 150° after focus, and one 900px jump turned it 53°. One event now pushes at most what a brisk hand's scroll does (160px, 14.4°); a hand's scroll, which arrives a frame at a time, turns it exactly as before (13.3° for 300px in five steps, both before and after). The ring gate measured the scroll with a single 300px jump, which is now what is damped, so it scrolls in five 60px steps instead, and it gained a check that a 900px jump turns the ring under 20° (11° now; 53° on the last commit, which fails it). While a key holds the strip or the ring, the scroll does not push them at all, and the slide into view aims at where the strip will come to rest.

The reel gate gained the keyboard (one stop, lands on screen, steps, ends, holds, leaves, frees again after a click and Esc), with two planted bugs: every frame a tab stop again, and a hold that holds nothing. The phone gate waits for the viewer to have closed (it closes back into its frame over 360ms) instead of a fixed 500ms, which under a full run's load was not always enough. 70 lines, fourteen self-tests.

## v52 (2026-10-16) — a researched pass: gestures, the reader's settings, the first second
*"keep iderating and making the design more researched and polished."* Measured against three references, his own `docs/apple-design.md`, WCAG 2.2 and Google's Core Web Vitals, and every change looked at, gated and given a planted bug its gate must catch.

**Paging on a phone keeps the reference's three rules for a gesture.** Where a let-go photograph goes is decided by where the throw would land (§6: the finger's speed carried on at Apple's 0.998 a millisecond), past the middle or not, instead of "a fifth of the screen or fast": a slow drag to 35% that stops now goes back (it went on), and a 60px throw goes on. The settle leaves at the finger's own speed (§5): the ease-out's first frame moves at 1/0.22 of its average, so its length is chosen to match, between 180 and 420ms. And a touch while a page is still settling catches both photographs where they are (§3, "never lock out input"; it was locked out for the length of the settle): they held at -347 and 67 for 120ms under the finger, and on letting go the nearer settled home. A finger that stopped before letting go throws nothing, as on the strip. The arrows and keys land a page still in flight before stepping, from the index that landed.

**The reader's own settings** (§14, WCAG 1.4.11). With *increase contrast* on, an outlined control's edge goes from 1.28:1 to 5.12:1 and the email field, which has no edge at all by default, gets one at 4.93:1; the viewer's controls turn solid with a white ring, and every preview is shown whole with the current one ringed. With *reduce transparency* on, the viewer's controls are solid and the dialog's scrim loses its blur. Nothing changes for anyone else: the default edges were measured unchanged. With the browser's text at 24px, a phone's page scrolled 2px sideways, because "understanding" in the claim ran 392px in a 358px column; the display size's floor is now held to the screen's width (`min(2.5rem, 12.5vw)`), which is exactly the 40px it was at 320 and changes nothing at the default size anywhere.

**The curtain waits for the type, not the photographs.** It waited on the About section's and the ring's first four photographs, a screen and more below the fold, so on a phone over Lighthouse's slow-4G profile (1.6 Mbps, 150ms, CPU ×4, gzip as served) the whole page stayed covered until 2.25s, median of twelve interleaved loads; it now parts at 1.48s, and with every image held back for five seconds it opens at 0.71s. Every photograph already fades in over its own placeholder as it arrives.

**What the measurement said, plainly.** Layout shift is 0 at 390 and 1440 through load and a full scroll. The claim is the largest paint, at 0.88s median on that slow phone. The curtain's change does not move that number, because the browser's measure does not see a cover over the page; it moves what a first-time reader actually sees. On repeat visits the throttled headless measure was bimodal (0.9s or 2.3s from run to run, on old and new code alike) and some batches leaned one way with no code path to explain it, which was checked directly (the curtain code does not run on a repeat visit, and an A/A test on identical code agreed within one run in twelve); recorded here as rig variance, not a finding. Inter's per-size tracking (its dynamic-metrics table) was considered and not applied: the variable font's optical-size axis already tightens as it grows, and the headline values are his pick.

New gate `prefs.mjs` (the two settings and the larger text; its self-test puts the quiet ring, the blur and the growing claim back), a new check in `curtain.mjs` (opens within 1.2s with every image held back), and the lightbox gate's phone checks now include the slow drag, the throw and the catch (self-test: a page a finger cannot stop). 68 lines, fourteen self-tests.

## v51 (2026-10-14) — on a phone the viewer pages, as Photos does
Still in the away pass. Measured against Photos, the one real gap left in the viewer was on a phone: a dragged photograph left black behind it until the finger let go, and only then did the next one fade in. Now the next one rides in beside it, 24px behind its edge, one to one with the finger (the one before, when the finger goes right); let go past a fifth of the screen, or thrown, and the pair carries on until the next is home; short of that both go back. One photograph is left in the viewer either way, with no transform on it, and a touch that lands while a page is still settling is ignored rather than allowed to start a second. The keys, the arrows and the row keep their cross-fade. The lightbox gate now holds a drag halfway and reads the neighbour 24px behind the dragged photograph's edge (within 2px), then one photograph after it lands. 63 lines, thirteen self-tests.

## v50 (2026-10-14) — a fresh-eyes pass, while he was away
*"okay going to eat please keep iderating and improving the design."* Every section at 1440, 1024 and 390, the newsletter dialog, the phone's menu and the new viewer at 1024 and 320, looked at for anything unfinished. Two things were, and nothing that needed his call.

**The footer's line** hung "heart" alone on a phone; it is balanced now: "Pre-wiring the brain / & educating the heart".

**The dialog's heading** takes focus when the dialog opens, so a screen reader starts there, and a keyboard drew a 2px black box round its words. It is not a control, so the ring is gone from it alone; every control keeps its ring. (Opened by a mouse or a finger it never showed: the first screenshots that seemed to show one, and one round the menu's close button, came from a scripted click, which the browser treats as a keyboard. Checked with real input before anything was changed.)

## v49 (2026-10-14) — the viewer is Apple Photos'
*"make sure like the expanded photo display casusel actually looks sleek and premium and it should be like apples photos where you can see the previews."*

**A row of previews along the foot**, Photos' scrubber: every photograph, 4:5 at the page's own crop point, 2px apart, from its 160px file. The one showing is opened out to its own shape (a landscape 3:2 is 83 wide, a 4:5 portrait stays 44) with 6px either side, whole, and held at the centre of the screen (0.5px off, measured after a burst of five key presses and after a jump); the rest wait at half and come up under the pointer, because a 4:5 portrait's preview is the same shape as its neighbours and could not otherwise be told from them. The row is a native scroller, so a trackpad or a finger throws it with the system's own momentum, and a mouse's wheel turns it too. A preview opens its photograph. Only the current preview takes a tab stop. Each preview is 44 by 55, the tap floor.

**The stage is solid** #0A0A0C, as Photos' is: at 97% the page's own photograph showed through as a ghost of its frame behind the one in the viewer. The controls are quiet: white at 12% under a white glyph, 22% under the pointer (two leftover rules turned them solid white on hover, with a white glyph on white; gone).

**Photographs give way to each other** in the direction you went: the old one carries on a short way and fades as the new one comes in after it, 280ms on the ease-out; a jump along the row goes the same way. Each photograph is given its box from its own proportions before its file arrives, and its preview is drawn large in that box until it does, so nothing moves when it lands.

**On a phone the photograph runs the screen's width** with no corner, the arrows give way to the swipe, and a finger moves the photograph itself: it follows one to one after 8px sideways, and let go past a fifth of the screen or thrown it carries on into the next; short of that it springs back on the page's spring. A swipe never closes the viewer, though it ends on the scrim (the click it leaves is eaten). The old phone rules that put the arrows at the foot were removed.

**Opening from the frame still holds**: the morph gate passes unchanged on all three kinds of frame. The lightbox gate now also checks the row (one preview per photograph, none under 44), the current preview's shape (within 1px) and centre (within 2px), a preview opening its photograph, no two photographs ever stacked, a solid stage, and on a phone the full width, no arrows, a swipe that moves on and stays open and a short one that springs back. Its self-test keeps every old photograph and stops the row following; both caught. 63 lines, thirteen self-tests.

## v48 (2026-10-14) — four quiet things: the photograph opens from its frame, the header shows where you are, no popup, no second ask
Asked *"what other simple elegant things can we add to the site like the strip"*, then *"can you research into it more please to see and reccomend some"*. The research (Apple, Linear, Stripe, Things, Headspace, Mailchimp, NN/g; the live sites were not reachable, so write-ups and recreations) found the page already moving in three places (the strip, the ring, the mark's tilt and glint), so the strongest additions were quiet or were subtractions. Two were prototyped on the page and shown; he took all four recommendations.

**The photograph opens out of its frame.** Any photograph (a section's, a frame in the strip, a circle in the ring) grows from exactly where it sat into the viewer, un-cropping as it goes, and Esc, the close button or the scrim send it back into the frame of whatever photograph is showing, if that frame is on screen. One view transition with one shared name; the page's crop is hidden from the first frame and the large image is drawn covering a box that travels, at the page's own crop point, so there is never a double image; the box's corner travels too (2px in the strip, 28 in a section, a circle in the ring, to the viewer's). 500ms opening, 360 closing, on the ease-out. The large file is decoded before the frame starts to grow (at most 400ms), or the first frames grew its placeholder. A click during the opening lands on the transition and is dropped, so a double-click cannot open and shut it; Esc is kept and closes it the moment it has opened. Under reduced motion, or without view transitions, it opens and closes as before. New gate `morph.mjs` reads the browser's own keyframes for the moving box: it starts on the frame within 1.5px (measured in the frame the browser captures it, because the strip and the ring move), ends on the viewer's image, the corner goes from the frame's to the viewer's, only one image is drawn, and it lands back in the frame. Its first reading was 126px off; that was the test harness's own `click()` scrolling the frame to the foot of the screen first, so it clicks by coordinates, as a person does.

**The header shows where you are.** The link for the section being read is the second weight, with `aria-current`: About on either About section, Testimonials on the testimonials, Contact at the foot (the footer is too short to reach the 45% line, so Contact is the footer whole on screen); nothing on the hero, the strip, the ring or the sign-up. Each link holds its 600 width invisibly in the same grid cell, so no letter moves (0.00px of change measured across six places), and Inter being variable, the weight eases. The first build put the labels 4.85px below the name; two grid rows were stretching, and `place-content: center` put them back on the name's centre line.

**The newsletter never opens by itself.** It opened after 40% of the page and ten seconds; NN/g ranks modal popups the most disliked kind and the closing section already asks. A Subscribe button still opens it. The stored dismissal and the phone's non-modal sheet existed only for the automatic one and went with it.

**A subscriber is not asked again.** The head script marks the page from the stored answer before the first paint; every Subscribe button goes (the header's, the hero's, the footer's Newsletter, the menu's) and the closing sign-up gives way to "Subscribed" with a check. Without its button the pill's right edge had 38px after Contact against 20 before the logo (the bar's gap stayed open on an empty slot); now 20 and 20.

The dialog gate was rewritten for all of this: it never opens by itself at half the page after eleven seconds or at the foot, a button opens it, a subscriber is asked nowhere and the pill stays balanced; its new self-test puts the automatic opening back and drops the subscriber's class. The nav gate reads the current link at six places. 61 lines, twelve self-tests.

## v47 (2026-10-14) — the share card and the icons go light
Asked *"what other simple elegant things can we add"*, four were offered and he picked this one: what the site is seen by before anyone opens it.

**What was wrong.** The page went light only on 2026-10-13 and took the tuned palette and the gold star; nothing it is shared by followed. The share card was the first palette with a white star on the old near-black #1B1916. The home-screen icon was the white monogram on the same dark. The tab's icon was a **white monogram on nothing**, so on every light tab strip it was invisible. The browser bar's colour was #FAFAFB, a ground the page no longer has, and the manifest still said #1B1916 and a cream #F7F5F0. And **og:image was relative** ("assets/og.png"): a link preview is fetched by a server with no page to resolve it against, so iMessage and Slack showed no picture at all.

**Now.** The share card is the hero's mark, whole, in the tuned palette, on white, 1200×630, with its size and an alt declared, `og:url`, and a large-image card for X. The home-screen and manifest icons are the "di" monogram, sky with the gold star, on white. The tab's icon is the same monogram on nothing; rendered at 16 and 32px on a white tab, a grey tab strip and a dark one, sky and gold read on all three, where the ink monogram vanished on dark and the full mark was mush. The bar and the manifest are #FFFFFF. `tools/build-icons.mjs` reads the colours from `--logo-*` in tokens.css, so one change there reaches all of them on the next run.

**Every one of these addresses is stamped with its content**, as the CSS is: `vercel.json` serves `/assets/` immutable for a year, so replacing og.png under its old name would never have reached a cache that had it. `site.webmanifest` is now written by `build-html.py` so its icon addresses carry their stamps too.

**A new gate, `share.mjs`**: the bar and the manifest are the page's ground; the card is absolute, stamped, 1200×630 as declared, white at the corner, holds the tuned sky and the gold, and under 1 in 100 of its sky pixels near the old sky (a few are the new sky's antialiased edge on white); the three icons likewise; the favicon's fills are exactly `--logo-sky` and `--logo-star`; every stamp is the file's own sha1. With the old files put back it failed card and icons; its self-test puts back the relative card, the old bar colour and a dark icon, and each was caught. 58 lines, ten self-tests.

## v46 (2026-10-14) — the film strip moves by hand
*"make it so you are able to horizonatal scroll on the film strip carousel if you want."* It still drifts on its own; now it can also be moved by hand. This reopens the 2026-10-02 lock "the reel cannot be scrubbed by hand", on his own words.

**Three ways in, one to one.** A sideways swipe on a trackpad, or shift and the wheel, moves the strip by exactly the wheel's distance (300 asked, 299.2 measured; the 0.8 is the drift still easing out under the pointer). A mouse drag and a finger moving sideways move it under the hand, after 8px, so a press that wobbles is still a press. The axis is decided at the start of a wheel gesture and kept until it pauses, so a trackpad's cross-axis noise never flips a page scroll into a scrub.

**What it does not do.** An up-and-down wheel over it scrolls the page and the row stays put (200px of page, 0 of row). A finger moving up it scrolls the page (`touch-action: pan-y`; 225px of page, 0 of row). A drag opens nothing; a click or tap on a frame still opens the lightbox; Enter on a focused frame is never eaten.

**Let go with speed and it glides**, at Apple's scroll deceleration (0.998 a millisecond, `docs/apple-design.md` §6): a quick flick of about 1.5px/ms carries on about 700px and settles in two seconds, then the drift takes it back over 180ms. A finger stopped before letting go throws nothing. A touch that catches a fast glide stops it and opens nothing, as a phone does; at a crawl (under 150px/s) the touch is a tap. While it is dragged the pressed frame lets go of its press and the cursor is the closed hand; nothing is selected and no image ghost-drags.

**The reel gate** now drives it with real input: the sideways wheel (moved 300, page still), a 200px drag (190 moved, the 8px slop and the first step, lightbox shut), a click on a frame (lightbox open), and on a phone-sized page a finger through the browser's own touch pipeline, sideways (146.7 moved, page still) and up (225 of page, 0 of row). Its self-test now injects three bugs on three pages and each was caught: a wheel handler that eats every wheel (pageMoved), the hand never reaching the reel (swipes, drags), and `touch-action: none` (fingerUp). One full run read the click false; it was the gate clicking the 6px of film between two frames, confirmed by clicking a gap on purpose, so the gate now clicks the middle of the nearest frame. 53 lines, nine self-tests.

## v45 (2026-10-14) — a premium pass
*"make everything feel more premium."* Every section looked at, at 1440, 1024 and 390, for what read as less than finished; five things changed, nothing added.

**The testimonials are centred**, the one left-aligned block left on a centred page: each quote balanced on its own centre line with its marks inline (a hung mark belongs to a left edge, and there is none), the person under it, the names still level along the bottom. A tablet shows one per row; a phone reads from the left, as the sections' paragraphs do.

**Centred paragraphs are balanced** into lines of even length (`text-wrap: balance`); "est laborum." no longer stood alone under three long lines. Pretty again on a phone.

**Photographs resolve rather than pop.** Each one fades in over its own blurred placeholder once it has decoded (700ms). Because that means every photograph starts at opacity 0, the images gate now fails if any loaded photograph is left unmarked, and it did when the mark was broken.

**Reveals are slower and softer**: 900ms of fade and 1100ms of rise from 28px on the long ease-out, a section's words first and its photograph 180ms after, where it was a 360ms blink from 12px. The motion gate caught the first draft running a 900ms reveal under reduced motion; reduced, a reveal is the ladder's short fade again.

**Selected text** is the logo's sky, softly, under the ink, where it was an inverted black block.

**53 gate lines pass, 9 self-tests caught.**

## v44 (2026-10-14) — thicker, and a film strip
*"make the band a little thicker"*, then *"I would love if it was designed kinda like a film strip."*

**35mm film.** The reel is a strip of film now: the frames on a near-black base (#141414) 6px apart, and a row of sprocket holes along the top edge and the bottom, eight to a frame as on real film, the page's own white showing through them. The holes belong to each frame, so they travel with the strip. 218px at 1440 (138 by 173 frames) and 143 on a phone, up from 154 and 104. The film base is the one dark thing on the page, and it is a photograph's material, not chrome.

**A bug caught by looking.** The first draft set the hole pitch to a frame's width over eight, a fractional pixel, and every frame rounded its own last hole, so they doubled up where two frames met, worst on a phone. The pitch is a whole pixel now (`round()`, behind `@supports`) and a frame is exactly eight of it; the page's border-box sizing meant "exactly" had to include the frame's own padding, which the second draft missed (138px frames, 7.67 holes).

**Gates.** The reel gate wants sprocket holes at both edges, a base darker than mid-grey, and a frame exactly eight whole-pixel holes wide; it fails on a fractional pitch. The layout gate wants frames 6px apart with 2px corners and nothing between the cells. **52 gate lines pass, 9 self-tests caught.**

## v43 (2026-10-14) — the photographs are a reel between the hero and the first section
*"not a big fan of the carousel at the bottom actually maybe a horizonatal band spliting up the hero and the next section."*

**The reel.** One thin row of photographs, full bleed, sliding left on the same flow the ring uses (42px/s measured), between the white hero and the first grey band. 154px tall at 1440 and 104 on a phone; it begins at the hero's peek, so its top 63px show at the foot of the first screen, which is what "barely see that it's under the hero" asked of the carousel in the first place. The tight strip holds (4px apart, 4px corners, every photograph 4:5) and there is no fade at either end: the screen's edge is the row's. A pointer holds it, a wheel over it scrolls the page, and it is three copies of one run so a screen up to twice the run's width never sees the seam.

**Out with the bottom gallery:** the columns, their script, and the scroll-past-the-foot push that existed for them. The footer has its own bottom air again.

**Gates.** `gallery.mjs` is gone and `reel.mjs` checks the reel: it drifts, holds, does not scrub (its self-test's wheel handler is caught), wraps, three runs, 4:5, at most 180px, full bleed, uncut, straight after the hero. It fails on a frozen reel. The layout gate's peek is the reel again and its strip is the reel's. **52 gate lines pass, 9 self-tests caught.**

## v42 (2026-10-13) — more Apple
*"lowkey want it to look more apple."* His own Apple reference (`docs/apple-design.md` in the portfolio) is about how Apple moves, springs, momentum, interruptibility, and the site already does most of it; what he was asking for is how apple.com looks. Two whole pages were rendered on the live site, one inside his locks and one with Apple's blue, beside the page as it was. He took three of four: *"Grey bands, Apple-size headlines, Centred sections."* Not the blue.

**Apple's bands.** The page is pure white and every other section is a band of Apple's #F5F5F7, edge to edge, with no gap between: the first section, the ring, the closing section and the footer. Each band carries its own air (80 to 140px top and bottom). On a grey band a field or a soft control takes the white, or it would vanish into it.

**Apple's scale.** The claim is 72px at 1440 (40 on a phone) at -0.032em, the sections' headlines 56 at -0.03em, Semibold. Inter's display cut is wider than SF's, so it takes a little more tightening than Apple's own. The sections' copy is 21 on 30, Apple's size for a paragraph under a headline.

**Centred sections.** Each section is a stack on the page's centre line: the headline, the words, then the photograph (560px wide). On a phone the paragraphs are too long to read centred, so the block reads from the left there. The closing line and the newsletter are centred under it.

**Gates.** The layout gate's two section checks turned: the words sit above the photograph and never over it, and above 768 the headline and the photograph share a centre line (750px off on the v41 files; 0 now). The peek under the hero is the grey band's edge. The theme gate's light ground is Apple's white. **52 gate lines pass, 9 self-tests caught.**

## v40 (2026-10-13) — the header is a pill; the gallery is at the foot, full bleed and thinner
*"can you experiement with the header i dont much like it right now"*, *"the glyph though can we just use the black and white di logo"*, *"can the horizontal carousel be on the bottom under th efooter and thinner"*, *"i meant a vertical carousel like it was before but thinner"*, *"the carousel should be full margin to margin"*, *"since its at the bottom make it so you can scroll down and it will just animate down and lets make it more clean remove the blur remove the bring to your own school."*

**Six headers, rendered on the page.** The bar as it was; the bar with the logo's "di" beside the name; the "di" alone, like his portfolio's "jb"; a floating pill; bare at the top with everything on the right (frosted once scrolled); the logo in the middle with links either side. The last broke on a phone and was dropped before he saw it; the bare one put type straight onto the photographs once scrolled until it had a ground. Each was looked at at the top and scrolled over the photographs, where a header is actually tested. His pick: **the pill** (*"D"*).

**The pill.** One capsule centred at the top, 56px, solid white with the same 1px ring as an outlined control; it was frosted (an 18px blur) for its first hour, until *"remove the blur"*. The brand is **the black-and-white DI logo**, 28px, in the ink, and the name; the colour stays in the hero's mark. On a phone the pill runs the column's width, the name left and the menu right. It still leaves going down and comes back going up; the strip around it takes no pointer, so it never blocks a click.

**The gallery moved to the foot of the page.** Its four columns rising, now **six, full bleed** (five at 1024, four on a tablet, two on a phone, so a photograph is never taller than the gallery), and **half the height**: 378px at 1440 against 756 under the hero, 338 on a phone. It is the last thing on the page, under the footer. For a few minutes it was one sideways row, a misreading of "horizontal carousel"; *"i meant a vertical carousel like it was before"* put the columns back. The first section now starts at the hero's peek.

**Past the foot the scroll keeps going.** There is no page left to move at the foot, so a downward wheel or an upward swipe there turns the flow by what the scroll would have: measured, a 1200px wheel turned it 70° in 0.7s against 2° of drift, and a 360px swipe on a phone 28°. Nothing is prevented, and above the foot a wheel scrolls the page as it always has.

**No blur anywhere.** The pill is solid, and asked whether "remove the blur" meant the gallery's soft fade too (*"The carousel fade too"*), its top and bottom are now cut clean; the gate fails on a masked stage.

**The footer** lost "Bring this to your school"; Contact is Email and Call.

**Gates.** The gallery gate wants six columns (5/4/2 by width), full bleed, at most 460px tall, the last thing on the page, and a wheel past the foot to turn the flow (it fails with the hook removed: 0.5°); its wheel goes up now, since there is no page under the foot to scroll into, and that was the gate's bug the first time it ran here. The nav gate wants the pill solid with its edge, and the logo in the brand in the ink. The layout gate's peek is the first section's photograph. **52 gate lines pass, 9 self-tests caught.**

## v39 (2026-10-13) — his portfolio's header and footer, the logo tuned, nothing dark
*"okay the big thing for me is the logo can you find like optimal colors and the header can it match more my header in my portfolio and the footer with the clean lines and i feel like this brand the di is more light so having such a dark cta and text doesnt really fit the site"*, then *"take a lot of inspo from the hea tea site"* and *"make sure the star is also a color I dont like it black."*

**The logo, measured and tuned.** On the light ground the file's colours ran from **1.18:1** (the yellow arc, nearly gone) to **4.44:1** (the violet), a lightness spread of 0.58 to 0.93 in OKLCH. Five sets were rendered; equal lightness made the pink and the magenta, 21° apart, nearly one colour, so the pick (*"B tuned"*) keeps the logo's own light-to-dark order and presses it into 0.64–0.80, each hue at the most chroma it allows there, the yellow nudged 93° → 86° to read gold. Every part now **1.80 to 3.44:1**. The star is gold, the colour the brand's own `--c-gold` token was named for. Every path in all three logos (hero, curtain, footer) carries a class for its part, so the palette is eight tokens.

**The header is his portfolio's bar**, measured from its source: white, 72px, one hairline under it, the 1200 column, the name on the left (the mark was tried at nav size in v27 and does not hold), About · Testimonials · Contact in the middle, Subscribe as the outlined pill on the right. It still leaves going down and comes back going up. A phone bug caught by looking: with the middle links hidden, the menu took the middle column and sat on top of the name; the phone bar is two columns.

**The footer is his portfolio's**: a hairline the full width of the page, the mark, Linda's line "Pre-wiring the brain & educating the heart" (the caption that left the hero in v37, now where his portfolio keeps its own line) and the copyright on the left; Menu (About, Testimonials, Newsletter) and Contact (Email, Call, Bring this to your school) on the right, each a 44px row the column's width. The targets gate caught "Call" at 27px across before that. The closing line and the newsletter stay above it as the last section.

**Nothing dark.** The near-black button is outlined now (*"A outlined"*): the page's white, a 1px inset ring of the ink, his portfolio's `.ctl--secondary` and HEYTEA's plain outline. The type is his portfolio's pair, **400 and 600** (*"2 portfolio pair"*), in the same ink. Controls are pills on the superellipse, as his are.

**HEYTEA** (heytea.com does not resolve from the build machine, so from Some Wins' own measurement of it, `reference-board.md` §9): a white ground, one weight, a hairline, an outlined button, no fills, no shadows. Taken: the outline, the one hairline, the lighter weight. Not taken: lowercase and +0.10em tracking on everything (a brand decision, and Inter is not their face).

**Gates.** The layout gate now fails on a third weight, a dark control, a missing header or footer hairline, or a line anywhere else; the nav gate wants the bar at the top; the mark gate wants the tuned sky and a gold star on all three logos. Each was shown failing on the v38 files (weights 500/700, two dark controls, hairlines false/false; a white star and the old sky; a bare header). **52 gate lines pass, 9 self-tests caught.**

## v38 (2026-10-13) — light only
*"also should we just do light mode as well not dark mode?"* Rendered beside the dark page and put to him with a recommendation: his portfolio, the reference he had just given for "professional", is light; Linda's brief was a serious new tool for education; the people deciding are schools. *"Light only."*

**One light theme, no switch.** `data-di-theme="light"` in the markup, `color-scheme: light`, `theme-color` #FAFAFB. The ground is the near-white with a cool cast and the ink the blue-black, both from v24; the one filled button on each screen is now the ink one, and the header's Subscribe stays the soft capsule. The dark block in `tokens.css` is kept, unused.

**The logo's star takes the ink.** It is drawn white, for a dark ground, and on this one it was not there at all. Every other path keeps the brand's own colour. The mark gate fails if either star (the hero's, the curtain's) is anything but the ink, and it did on the v38 CSS without the rule.

**The curtain is the page's own ground** with the ink loading bar, so the first load never flashes near-black in front of a white page ("no tada or any darkening of the website").

**The theme gate turned round**: a dark system, a dark choice stored by an older version and a host writing `data-theme="dark"` all leave the page light; its self-test keys a dark ground on the host's attribute and is caught. Worst contrast 16.35:1. **52 gate lines pass, 9 self-tests caught.**

## v37 (2026-10-13) — no grey, no caption, his portfolio's scale
*"Im not a fan of the grey text and the small caption under the hero i think making it professional is the key thing also look at my portfolio for inspiration."*

**The caption under the hero is gone.** The hero is the mark, the claim and the one action, 40px apart.

**No grey text.** Every word is in the ink: the prose, the nav links, the quotes' roles, the ring's name, the copyright, the field's message. Hierarchy is size and weight, which is how his portfolio's about page does it. Worst contrast on the page went from 5.95:1 to 16.43:1. The layout gate fails on any visible word in another colour (only the placeholder and the inverted skip link differ), and it caught the v36 page on "About", "Contact", the caption and the prose.

**His portfolio's scale.** jaydenbetts.design refuses this machine at the proxy, so it was read from its source on `main`, served on 127.0.0.1 and measured: the claim 44px, a section heading 26 and a page title 36, prose 18 on 27 in the ink, a 1200px column. The claim went 68 → 44 (30 on a phone), the sections' headings 52 → 32, the prose 20/32 → 18/27, the column 1342 → 1200 (120px in at 1440, as his is). The 1720 column answered "small spacing from the outer edge", which was said of the cards, and the cards went in v21. The closing line takes the claim's size. The ring's quote keeps its own: the ring is locked as it is.

**A self-test that stopped failing.** `contrast.mjs --self-test` painted `--ink-3` onto the ground, and with nothing set in `--ink-3` any more it printed "SELF-TEST FAILED: nothing was caught". It now paints the smallest type on the page in the ground colour, and it catches it again.

**52 gate lines pass, 9 self-tests caught.**

## v35 (2026-10-13) — Some Wins, read and applied
*"no nothing with apollo the some wins design I want you to look at."* `docs/taste.md` is rewritten from Some Wins alone: its `design.md`, `brand.md`, `voice.md`, `ten.md`, `space.md`, the reference board, the illustration rules, somewins.xyz and its 33 screens. Apollo is out of it.

**Controls are capsules.** Some Wins has one primary action, a 50pt capsule (`PrimaryCapsule`), and its other controls are capsules too. Every button and the email field here now take `--r-full`, drawn `corner-shape: round`: on the superellipse corner a capsule is a lozenge.

**One white button per screen.** `ten.md` rule 6: "nothing white in dark except the main filled button". The first screen had two, the header's Subscribe and the hero's, for the same action. The header's is the soft capsule now; the hero's is the one white thing on the first screen and the footer's on the last.

**Medium and Bold.** Some Wins' two weights, and its reasons: "no tiny thin font anywhere", "the text reads as premium not dull". Prose went 400 → 500, seen side by side at 20px on the dark ground before it was taken. Two stray 600s (the buttons, the quote's name) were a third weight on a page that said it had two; both are 700.

**The sections read from the top.** Centred, "What Developmental Improvisation is" floated 164px down beside its photograph with nothing over it; Some Wins' rule is that a title cannot float low with nothing above it, and its sheets read "name, its controls, the block, air below". The heading is trimmed to its cap height (`text-box: trim-start cap alphabetic`) and its capitals stand on the photograph's top edge, 0px off at 1440 and 1024.

**Not taken, and why** (in `taste.md`): the voice rules, because the words are Linda's and carry her exclamation marks; the drawings, because they are his hand; the rounded face, the warm ground and the ground gradient, because Inter, the cool neutrals and "no gradients" are locked here.

**The gallery is a tight strip, his pick.** Put to him because it reopened a lock: the 28px superellipse with 26px gaps, a 4px strip, or Some Wins' camera roll (edge to edge, a 2px hairline, no corner). *"B: tight strip."* 4px between photographs across and down, a 4px corner, still 4:5, still inside the margins. The sections' and the lightbox's single photographs keep their large corner: a corner is sized to its object. The run's padding moved with its gap, or the loop would jump by the difference.

**CSS is stamped by content now.** The links carried the date, and eight rounds shipped today under `?v=20261013`; with the CSS served immutable, anybody who loaded the first kept its stylesheets through the next seven. Each link carries a hash of its own file, on the page and on the style guide.

**The layout gate holds the four rules**, and each was shown failing on the v34 files before it passed: weights `400/600/700`, five controls not capsules, two white buttons on the first screen, the heading 164px off the photograph's top, and the strip at 26px gaps and a 28px corner. **52 gate lines pass, 9 self-tests caught.**

## v34 (2026-10-13) — dark only; and his own apps, read
*"remove the switch. I feel like the website is lacking a lot, do you have access to the [app] files and md files and see how I like my design?"*

**Dark only.** The footer switch, its CSS, its script and the cross-fade are gone. `data-di-theme="dark"` is written on the `<html>` element in the markup, so not even the head script decides the theme, and a page with scripts off is dark too. The light fixes for the logo went with the light theme. `theme.mjs` now checks that a light system, a light choice stored by an older version, and a host writing `data-theme="light"` all leave the page dark, and that there is no switch anywhere; its self-test keys a light ground on the host's attribute. `contrast.mjs` runs the dark theme, the only one: worst 5.95:1. 52 gate lines pass and 9 self-tests are caught.

**His apps, read.** Apollo's SwiftUI, README and theme, plus the Strata `design.md`, are summarised in `docs/taste.md`. Both agree on what this site already does: dark, no dividers, ink as the only accent, colour only in photographs, short text. Apollo goes further in three ways that would each reopen a LOCKED item here: a display serif (Goudy Bookletter 1911) for the big lines, photographs as a tight tower with nearly square corners, and photographs captioned like posts. All three were rendered on the live page as injected CSS and put to him rather than built.

## v33 (2026-10-12) — the logo in its own colours, and dark by default
*"I want the logo to be like the normal colors maybe with a premium shine instead of being black. I think I also want to keep it in dark mode, I think it looks better for this specific site."*

**The mark is the logo again.** The paths go in as the logo file draws them: the sky monogram, the white star and the six coloured arcs. What moves is light. The geometry is emitted a second time, solid white, inside a mask, and a narrow diagonal band of white with soft shoulders travels across it: a 1.5s sweep, then about four and a half seconds off the mark, on `--ease-in-out`. It is a glint that comes and goes, not a shimmer that never stops. Three blends were tried side by side on the dark ground (normal, soft-light, overlay); plain white at 85% read as the most like light on a glossy surface. The first strength, 72% with a thinner band, barely registered in four of six frames, so it went up. The glint rides the tilt: turning the mark toward the pointer slides the light across it by up to ±120 units, the way a real surface catches it. Under reduced motion there is no glint and no turn.

**Dark for everyone.** The page no longer follows the visitor's system; it opens dark, and the colour logo needs that ground to hold together. Rendered on the light page, the pale yellow arc and the white star all but vanish. The footer switch can still pick light, and it remembers. Two fixes cover the light page for anyone who does: the star takes the ink and the yellow arc deepens to #F2C94C. The stored choice moved to a new key (`di:mode`), so a choice made when the page followed the system cannot quietly keep someone out of the new default.

**Gates.** `theme.mjs`: with no choice the page is dark on a dark system and on a light one, the switch to light survives a reload, and a host's `data-theme` changes nothing. `mark.mjs`: the mark's paths carry all eight brand fills and the glint is running; under reduced motion there is neither glint nor turn. 55 gate lines pass and 9 self-tests are caught.

## v32 (2026-10-12) — Inter
*"i dont think I like the font I think id prefer inter."* One face still, two weights still (400 and 700); only the family changed.

**Which Inter.** Inter 4, latin, in one 73KB variable file with two axes, weight and optical size (14–32). That is 5KB more than the Geist it replaced, and 25KB more than the weight-only file, and the second axis is what the 25KB buys. `font-optical-sizing` is on by default, so everything at 32px and up is drawn from Inter's display design and everything at reading size from the text design, with no second family and no class. Measured on the hero's second line: 1096.6px wide with the axis left to the browser, which is exactly its width with the display design forced (`"opsz" 32`), against 1164.3px with the text design forced. The browser is choosing the display cut. SIL OFL, and `fonts/inter-OFL.txt` travels with the file.

**The tracking came out.** Geist wanted closing up at display size (−0.035em), but Inter's display design is already spaced tight, and the same value on it read pinched. Display is now −0.022em, h1 −0.02, h2 −0.018, h3 −0.012, the brand's closing line −0.022, the ring's quote −0.02 and the header's name −0.014. Reading sizes stay close to the font's own. The fallback is Arial reshaped to Inter's metrics (size-adjust 107.12%), so the swap moves nothing.

**Also fixed while looking:** on a phone the hero mark had dropped to 84px in v30, a side effect of sizing it by the screen's height for short laptops. Linda asked for the logo to be prevalent, so its floor is back to 104px. The laptop fix still holds, because the height term only acts above the floor.

**Measured after v32.** 54 gate lines pass. The headline is 2 lines at 1440 and at 1024 (it was 3 at 1024: Inter's display design is narrower) and 5 on a phone. Worst contrast is 5.18:1 light and 5.95:1 dark. The Geist file is deleted.

## v31 (2026-10-03) — a softer edge on the gallery
*"I dont think the fade needs to be that strong tone it down."* The gallery's mask faded the top 12% and the bottom 38%, so the lower third of every column was half-dissolved and a photograph was never seen whole until it had risen past the middle. It is now 6% at the top and 18% at the foot, each eased through a 65% stop so the edge has no visible start. The before and after were captured at the same frozen flow angle, so they show the same photographs, and the change was judged on those. 54 gate lines pass; `gallery.mjs` still asserts both ends fade to transparent.

## v30 (2026-10-03) — the hero is the first screen
*"make sure there is more space from the hero and the carousel, you should be able to barely see that its under the hero."*

At 1440×900 the hero stopped at 669px and the gallery started at 733px, so 167px of photographs were on the first screen. The hero is now the viewport's height less a peek (`clamp(48px, 7vh, 72px)`), with its content centred in it, and the gallery starts exactly at the peek. With the gallery's own fade at the top, those 60-odd pixels read as a hint of photographs rather than a row of them.

Measured (gallery peek; space above the mark / below the button):
- 1440×900: 63px; 113 / 121
- 1920×1080: 72px; 198 / 200
- 1280×720: 50px; 48 / 59
- 390×844: 59px; 99 / 117

On shorter phones (375×667, 320×640) the hero's content is taller than the screen, so the gallery starts just below the fold. The logo now also scales with the screen's height (`min(11vw, 17vh)`), because on a 1280×720 laptop it sat 22px under the header.

**Details that mattered:**
- On a phone the height is `svh`, the viewport with the address bar showing, which is the first screen a phone actually shows. It sits behind `@supports`: a `var()` declaration with a unit the browser does not know falls to `unset` at computed time rather than back to the `vh` line above it.
- Making the hero a flex column shrank its inner container to its content (148–1292 instead of the page's 49–1391). `layout.mjs` caught it, and the container is set back to full width.

**Gate.** `layout.mjs` asserts at most 80px of gallery on the first screen, and at least 32px on any screen 700px or taller. On the previous hero it fails at 167px. 54 gate lines pass and 9 self-tests are caught.

## v29 (2026-10-03) — one colour, no lines
*"I dont understand the point of having the grey text in the hero … why is emotional understanding greyed out"*, then *"also remove the lines I want it more minimal just use clean white space design."*

**The headline is all ink.** I set the second half a tier down in v24, as a device borrowed from product headlines. It said half of Linda's claim mattered less, and emotional understanding is half of what the method is for. There was no good answer to his question, so it went. What stays from that round is the break: "& emotional understanding" starts its own line from 600px up, which is where the sentence turns. `layout.mjs` now asserts every word of the headline computes to the same colour, and it fails with the grey put back.

**Every line is gone.** These are the ones that were drawn:
- the hairline above each quote;
- the hairline above the footer and the one above its bottom bar;
- the hairline under the scrolled header;
- the separators between the phone menu's links, and the menu's left edge;
- the outlines on the email field, the "Bring this to your school" button and the theme switch.

Space does their job now: 64px between the quote columns, 48px between stacked quotes, 96px above the footer's bottom bar. The two controls that needed a shape got a soft fill instead of a rule: the field and the secondary button sit on the raised ground and go one step deeper on hover. The focus ring and the error ring stay, because those are states, not decoration. `layout.mjs` asserts that no visible element at rest draws a border or a box-shadow at 1440, 1024, 390 or 320. On the previous styles it fails, naming the three quotes, the footer and its bottom bar.

**Measured after v29.** 54 gate lines pass and 9 self-tests are caught. Worst contrast is 5.18:1 light and 5.95:1 dark.

## v28 (2026-10-03) — dark mode back with a switch in the footer, and the last two template sections cleaned up
*"I still only see dark mode"*, then mid-turn: *"I actually like the dark mode but I think the button to change it should be in the footer. Also I feel like the footer and testimonials section looks outdated compared to the cleanness of the rest of the site."*

**Why dark mode would not go away.** The claude.ai preview writes `data-theme="dark"` onto the page for anyone whose claude.ai is dark, and the dark tokens were keyed on `:root[data-theme="dark"]`, the same attribute. So removing the toggle changed nothing for Jayden. Reproduced by setting the attribute as a host would: the page went to `rgb(11,11,15)`. The page now answers only to its own attribute, `data-di-theme`, plus an `html:root[data-theme]` rule that keeps a host's colour-scheme rule from turning form fields dark.

**Dark mode is back, and the switch is in the footer.** With no choice made, the page follows the visitor's system. A choice from the switch beats the system and is remembered. The switch is two words with their glyphs, Light and Dark, and the chosen one is an inverted pill. Each option is a full 44px target. The pill is the option's own background clipped to its content box, not a `::before`: the contrast gate read the pseudo-element pill as the page behind it and reported 1:1, and a real background reports the true 5.18:1.

**The testimonials lost their cards.** A grey box with a border round every quote and a black disc of initials under it is the testimonial block of every template. Each quote now stands under a hairline, with the opening mark hung in the margin so the words start on the column, and the person in two lines of type underneath. On a row the names line up along the foot. On a tablet each quote is one row, with the person beside it. On a phone they stack on hairlines; the swipe row went with the cards, because without a card's edge the next quote peeking in reads as overflow.

**The footer lost its panel and its ink box.** It is three bands of type on the page, divided by the same hairline as the quotes:
- the closing line;
- the newsletter, with a plain field and button, on the left, and the ways to reach Linda on the right, with the address set on the sign-up title's line;
- a bottom bar with the copyright and the theme switch.

The small mark that sat in the sign-up card went too, for the same reason it left the header.

**Gates.** New `theme.mjs`:
- with no choice, the page follows the system;
- the footer switch beats the system and survives a reload;
- a host's `data-theme="dark"` changes nothing.

Its self-test keys a dark ground on the host's attribute again, and it is caught. `contrast.mjs` runs both themes again. `nav.mjs` checks the switch is in the footer and not the header. `mobile.mjs` checks the footer has no panel and the quotes are a stack with no boxes and nothing scrolling sideways. `layout.mjs` checks the names align on a row from 1024. 54 gate lines pass and 9 self-tests are caught. Worst contrast is 5.18:1 light and 5.95:1 dark.

## v27 (2026-10-03) — light only, and a header that is the name
*"I feel like the header looks off, lets take away the dark mode for now and i want the header to be updated."*

**Dark mode is off.** The toggle, the stored choice, the cross-fade and the head script's dark default are gone. The page used to open dark for every first-time visitor, which was never the intent written in `tokens.css`. A visitor who picked dark on an earlier visit now gets light. The dark token block is kept, unreferenced, with a note naming the commit that has the toggle, the head script and the gate's dark pass, so bringing it back is three restores rather than a palette rebuilt. `color-scheme` and `theme-color` are light.

**What was off in the header, measured.** Three things:
- **The mark.** It is a line drawing of a ring of figures. At 26px it came out as a spindly glyph beside a bold 16px wordmark, a few hundred pixels above the same mark at 160px. Every rendering in the repo was set side by side at 26, 32 and 48px: the inked colour logo, `dilogo.svg`, and the hero's geometry solid and with the star knocked out. None held at nav size; it is a drawing, not an icon.
- **The moon.** An icon in a line of words.
- **The Subscribe button.** An outlined box, the only bordered thing on the header, which read as a form control dropped into a line of type.

**The new header** is the name in type at 17px (15px under 360), About and Contact, and one filled Subscribe at the bar's own scale. Two directions were mocked on the live page first. Name alone beat a 34px mark plus the name: the mark was still spindly at 34, and it repeated the hero mark directly below it. On a phone the name now shows. It used to be the mark alone, and the brand's name appeared nowhere above the fold. The menu glyph, not its 44px box, sits on the gutter. Taking the 11KB inline colour logo out of the header also took the HTML from 117KB to 106KB.

**Gates.** `contrast.mjs` runs light only, with a note to put the dark pass back with the toggle. `nav.mjs` adds a check that a stored dark choice is ignored, there is no toggle, and the brand is the name with no mark. Run against the previous page, it fails with theme `dark`, one toggle and one mark. 50 gate lines pass and 8 self-tests are caught.

## v26 (2026-10-03) — every section to its ceiling
*"can you keep editing till its a ten in all sections."* Each section was captured on its own at 1440 (light and dark), 1024, 820 and 390, rated, and the weakest worked until nothing more could be fixed in the design. Two things stop the score at 10 and neither is design: the body copy of both sections and the three testimonials are still placeholder.

**The prose was the weakest thing on the page, and it was a size problem.** At 1440 both sections set their paragraphs at body size, 16px, beside a 680px photograph, so the copy read as a caption to the picture. They now use a reading size, `--fs-read` (20px at 1440, 17px on a phone, line height 1.6), held to about 66 characters a line. The copy block went from 330px to about 420px against the photograph, and the section now reads as text and image rather than image with a note.

**The quotes went the same way:** `--fs-quote` is 23px at 1440, set a hair tight, with roomier card padding. Two layout fixes below desktop:
- **Tablet (768–1023):** three-up made each card 244px wide, four words a line at 820. One quote per row now, words on the left and the person on the right across a hairline.
- **Phone:** the stack was 775px of grey cards. It is now a native scroll-snap row with the next card showing 64px at the edge, snapped to the gutter, and keyboard-reachable while it overflows. There's no script beyond toggling the tab stop and no dots, because the edge of the next card is the instruction. It is not used on tablets: a narrow desktop window has no swipe, and with the scrollbar hidden a mouse could not have reached the third quote.

**The hero:** the subline is 23px rather than 19px, and the one action is a large button, 54px. At 46px under a 68px headline it read as a footnote.

**The closing field is two rows, each with a job.** The brand's line and the ways to reach Linda now share the top row, the contacts set on the line's last baseline. Before, they sat beside the card under it and left the top right of the field an empty 600×150 rectangle. The sign-up takes the whole second row as one ink band: the mark and the ask on the left, the field on the right, on a shared foot. The envelope and phone glyphs are gone. An address and a number explain themselves, and the 30px they took is what the address needed: it had been breaking at the @ at 1024. It is now one line at 320, 360, 390, 1024, 1280 and 1920.

**Small:** gallery photographs lean in on hover like the sections' photographs do. The pointer already holds the columns, so a photograph cannot slide out from under it.

**Gates.** `mobile.mjs` now also checks the quote row on a phone: it scrolls, the next card shows at least 24px, it snaps to the gutter, and it carries a tab stop. 50 lines pass and 8 self-tests are caught. Contrast is unchanged: 4.83:1 light, 5.84:1 dark.

## v25 (2026-10-02) — the phone, emulated as a phone
*"rate the site and also build and optimize the mobile view until both are at a ten."* Every earlier phone check was a desktop browser squeezed to 390px. This round ran the page the way a phone runs it: touch, no hover, a coarse pointer, three pixels to the point. That showed nine defects a narrow desktop window could not.

**Fixed, each measured:**
- **The newsletter sheet stopped 36px short of the right edge** whenever a button opened it. A modal `<dialog>` gets the UA's `max-width: calc(100% - 6px - 2em)`; the automatic sheet is not modal, which is why the old gate never saw it. 353.6px → 390px.
- **iOS zoomed the whole page in on the email field** and left it zoomed, because the field was 15px. It is 16px on a coarse pointer.
- **Hover stuck after a tap.** A phone keeps an element in `:hover` until the next tap, so a photograph opened from its section stayed scaled once the lightbox closed and a tapped button kept its hover ground. All 16 hover rules now sit inside `@media (hover: hover)`. Focus had the same problem through `:focus-within`, now `:focus-visible`.
- **The ring's outer circles hung 23px off each side of a 390 screen**, cut in half. The radius drawn is now the token or what the screen can hold with every circle whole and 12px clear, whichever is smaller. The script reads it back from the stage, so CSS decides it in one place. The quote also lost the 80px of UA `<blockquote>` margin it had always carried: on a phone that took the column from 186px to 106px and stacked the line five deep into the circles. On a wide screen the 40px stays, written down, because his line breaks were set against it.
- **The footer was a box around a box.** On a phone the closing field's chrome put the sign-up card 56px narrower than the column and the brand line three lines deep. The chrome goes below 768px: the card runs the full column (350px at 390), the line takes two lines, and "Bring this to your school" is full width under it.
- **A touch froze the gallery for four seconds.** It fills 78% of a phone's height, so most scroll gestures start on it. The touch hold is gone; a tap opens the lightbox, which holds the flow itself.
- **The page scrolled behind open modals** on touch, so closing the menu or the lightbox could land you somewhere else. It is locked while a modal is open, touch only. The automatic sheet stays scrollable, by design.
- **iOS shows no `:active` press** unless something listens for touchstart, so no press on the page showed on an iPhone. One passive empty listener fixes that. This cannot be checked here; it needs a real iPhone.
- **The grey tap flash is off.** Every control has its own press, and photographs now have one too (0.985).

**And the type.** The two-tone headline now breaks cleanly at every width: the soft half gets its own line from 600px, and a no-break space keeps the ampersand with it on a phone. Before this, a tablet changed colour mid-line ("development & emotional"). The hero sub no longer leaves "heart" alone on a line at 320, and the body paragraphs use `text-wrap: pretty`. An empty error line no longer adds 21px under every Subscribe button.

**New gate `mobile.mjs`** at 390, 360 and 320 under real phone emulation. It reads every `:hover` rule from the live CSSOM and fails on any outside a hover query, checks the email fields are 16px, checks the tap highlight is off, taps a photograph open and closed and looks for a stuck scale, checks the scroll lock both ways, holds every ring circle inside the screen across a full slot of its turn, checks the footer has no panel and the card is as wide as the column, and checks a touch does not hold the flow. Its self-test adds one ungated hover rule. `dialog.mjs` now checks the modal sheet's width, and it fails on the old CSS at 353.6px. `ring.mjs` adds 320 and stops reading `--ring-item` through `getPropertyValue`: on a phone that returned an unresolved `clamp()`, `parseFloat` gave NaN, and its "pointer away from the ring" check had been passing only by luck.

**Measured after v25.** 50 gate lines pass and 8 self-tests are caught. Contrast is unchanged: worst 4.83:1 light, 5.84:1 dark. No overflow at 320, 360, 390, 430, 768 or 844 landscape. A phone's first load is 585KB at 3x over 17 requests; the HTML is 24.7KB gzipped.

## v24 (2026-10-02) — the gallery stands up, the colour goes cool, the mark looks at you
*"the reference I liked was more of a vertical image scroll · the color still feels not like a premium site · look over the design.md · I like what feedhippo.com does where the logo spins depending on where your mouse is pointing."*

**The strip stood up.** Four columns of photographs on the page's own grid (three on a tablet, two on a phone), rising on their own, faded out over 12% at the top where the hero hands over and over the last 38% at the foot, where the reference lets its pictures dissolve. Every column is two copies of one run so the loop has no seam, and each one travels at its own rate (1, 1.18, 0.9, 1.1) from its own starting height — **that is where the masonry edge comes from**, because the photographs are still one shape. Mixed proportions would reopen a locked decision and are in OPEN as his call. Still no wheel handler: a wheel over the gallery scrolls the page, and the pointer only holds it. `strip.mjs` became `gallery.mjs`, which adds two assertions the strip never needed — **the columns do not all travel at one rate** (equal rates read as one sliding sheet) and **every run is at least as tall as the stage**, or the loop shows its own seam.

**The colour went cool.** The warmth was the problem: a cream ground and a brown-black ink read as craft and cosy, which is the opposite register from a serious tool for education. The ground is a near-white with a faint cool cast (#FAFAFB), the ink a blue-black (#15141D), at the same contrast steps — worst 4.83:1 light, 5.84:1 dark. **The sign-up card lost its sky** and became the inverted surface, ink ground and page-coloured type, which is how a reference marks the one thing to act on — weight, not hue. That applies Strata's rule in full: *"saturated colour means a win or a photograph; chrome is ink and light."* The only colour on the page now is the photographs and the band crossing the mark. Five hard-coded warm values went with it (the selection, the lightbox scrim, the curtain and its loader, the theme-color meta).

**The mark faces the pointer**, anywhere on the page, on both axes: ±30° across, ±20° up and down, eased with a 0.2s time constant, back to face the visitor when the pointer leaves, and a slow sway on a phone where there is no pointer to follow. It replaced the drag-to-spin, which answered a gesture nobody would think to make; this one answers the first movement anyone makes. The first version normalised by half the viewport, and because the mark sits high in it, looking up reached 10° where looking down reached 20° — each side is normalised by its own room now. New gate, `mark.mjs`, reads the angle from the **computed transform** of the element that turns, not from the custom property the script writes; its self-test pins the transform and must be caught. feedhippo.com itself was unreachable from here, so this is built from his description and has not been compared with it side by side.

**From his design.md.** *Less text, always*: the labels over the two section headings ("The method", "The founder") and over the contact links said what the heading below already said, and are gone. *Nothing below 15pt*: the floor is 15px now, not 14. *Nothing between 32 and 64*: the 28px and 48px gaps moved onto the ladder. **The two-tone headline** — the claim in ink, *& emotional understanding* a tier down, one line each from 1100px — costs one token.

**Found while looking.** Three font files preloaded on every load that were deleted a round ago (Plus Jakarta Sans ×2, Jost), replaced by the one Geist preload. Dead `.proof` rules. The longest testimonial ran to 15px off its hairline; there is a 32px floor under all three. The email address on a 390 phone broke as "gmail.co" over "m" — the contact icons go on a phone, which buys back the 30px, and narrower than that it breaks at the @.

**Measured after v24.** 45 gate lines pass, seven self-tests caught. Worst contrast 4.83:1 light / 5.84:1 dark.

## v23 (2026-10-02) — the strip, the mark, and a floor under the type
Four asks, plus a design document of his own to borrow from.

**The carousel is back, and it is the Hippo one rather than ours.** *"you cant like manually scroll through like the old version I like how it fades."* So: the bento's flow driver turned on its side and stripped of every control. One row at one height, two copies so the loop has no seam, edge to edge so the mask at both ends reads as a fade rather than as a cut, and **no wheel handler at all** — the difference from the version it replaces is a deletion. The pointer HOLDS it so a photograph can be clicked without chasing it, which is not scrubbing. Twelve photographs that appear nowhere else on the page: a strip that reprised the sections would read as padding. New gate, `strip.mjs`, whose hardest assertion is that **the strip's position is a pure function of the flow** — it cannot be tested as "the transform does not change", because the flow is scroll-coupled and 240px of scroll legitimately advances it, so what is measured is where the strip IS against where the flow says it should be.

**The mark is ink, with the palette passing over it.** *"do it in black and add some sort of affect on it that adds color in a premium way and animates… being able to spin it like its a 3d object."* The geometry is emitted twice from one source — once with its fills stripped so CSS can ink it, once solid white inside a mask — and a rect carrying two bands of the eight brand hues sweeps underneath. **A path's own `fill` attribute beats a fill inherited from a styled parent**, which is why the first version came out magenta instead of black. The band's offset rides the same clock as the strip and the ring, so it is never still, and the drag adds to it: turning the mark moves the light on it. The rotation is clamped at ±72° with a spring back, because a flat mark spun past 90° shows its own mirror image and the monogram reads backwards. The blend flips with the theme — screen lights a dark mark, multiply colours a light one.

**The statistics are gone** from under the newsletter button, and `.proof` with them.

**And four things borrowed from his own `design.md`.** A **14px floor** under the type, from "nothing below 15pt, no tiny thin font anywhere" — 13px captions and a 12px label were the two smallest things here and both moved up. **Two weights 400 and 700**, not 400 and 600: his app sets Bold against Medium at 34% of stroke apart, and 600 against 400 in a grotesque is a narrower gap. **The testimonial hue discs are ink**, from "saturated colour means a win or a photograph; chrome is ink and light" — the only colour below the hero now is the photographs. And the structural idea, which is worth more than the three: **`docs/decisions.md`, an index of what is LOCKED, GUIDED and OPEN.** This project records why and never recorded whether a thing may be reopened, and the cost is on the record — the ring merge measured better on every number I had and still had to be reverted in full.

**Measured after v23.** 42 gate lines pass and six self-tests are caught. Worst contrast 4.82:1 light / 5.95:1 dark.

**Not done, and his call:** Strata's colour rule is stricter than what ships — it would take the sky off the sign-up card too, leaving the photographs and the mark as the page's only colour. One line either way.

## v22 (2026-09-29) — let it breathe, and take the box off the hero
*"the spacing of the site feels so cramped, not premium — let sections breathe"* and *"does the hero really need to be in a container? less is so much more."* Both right, and the first one had a structural cause rather than a taste one.

**The page was still spaced like a bento field.** Every row used to be a tile and the gap between tiles was `--grid-gap`, about 16px. That is correct for tiles butted together. It is wrong for a sequence of sections on open ground — which is exactly what the page became in v21, when the bento went and four cards became two prose sections. The spacing never followed the structure. So: **`--grid-gap` means between COLUMNS now and `--section-y` means between SECTIONS**, one rule carries it (`main > section + section, .close { margin-top: var(--section-y) }`), and the ring gets 1.4× because it is the page's one break and a break the same distance as everything else is not a break. Measured at 1440: **115px between sections and 161px either side of the ring, against 16px before.** The gutter went with it, `clamp(16px, 2vw, 36px)` → `clamp(20px, 3.4vw, 64px)`: **29px of air at the edge of a 1440 screen is a brochure, 49px is a page.** And `--field-top` is `--nav-h` plus `clamp(48px, 6vw, 120px)` rather than two grid gaps, so the masthead starts with room above it.

**The hero has no container.** A raised box drawn around type is a box drawn for its own sake; taking it away leaves the mark and the line sitting on the page, which is what a masthead is. What it also does is make the surface rule simpler than the field it replaced: **the things that still have a surface are the things that are objects** — the quote cards, the sign-up card, the closing panel. Nothing is a panel merely for being a section.

**Measured after v22.** 40 gate lines pass, five self-tests caught. No overflow at 320 through 1920. Worst contrast 4.82:1 light / 5.95:1 dark.

## v21 (2026-09-29) — Linda's brief: simpler, more serious, one face
Jayden showed his aunt the site. Her notes, and they are the whole round: **the hero is far too busy, too many images** — a much simpler one would do wonders; **the logo should be more prevalent**; **the brand has to read serious, a new tool for education, and the design has to reflect that**; **split the about into two** — what Developmental Improvisation is, and who she is — **filled with placeholder copy** for now; then the quotes, the testimonials and the footer, cleaned up; and **change the face to something like Geist**, so the site feels focused and mature.

**The hero is a masthead now.** The fifteen drifting photographs are gone, and with them the bento, its per-column wheel scrub and `ring.mjs`'s half that tested them. What is left is the order an institution opens in — the mark, the claim, the one action, the three figures — on one panel, centred. Centred is the register: left-aligned reads editorial and modern, centred reads formal. The mark is the biggest single object on it, which is the point of her note. The headline and the hairline above the figures share one column, so the masthead is one block rather than three widths. **It carries no photograph at all** — the first one is the section below it, which is the first thing you scroll to anyway.

**Four cards became two sections.** One shape used twice, flipped the second time: a photograph on five columns, a label, a heading and the prose on six. The reader dialog went with the cards — two sections of prose do not need a dialog to hold them, and a page trying to be taken seriously puts its case in the open rather than behind a click. `reader.mjs` was deleted rather than left to pass on nothing. `linda-laughing` came out of the ring to carry "Who Linda is" and `linda-stage` took its place, so no photograph is used twice; the images gate asserts that across the whole page now, not per group, because with eleven photographs instead of twenty-five a repeat is the difference between a considered set and a thin one.

**One face: Geist, 400 and 600.** It replaced **Jost and Plus Jakarta Sans together** — three files became one, and a display face plus a reading face became one voice. Jost was chosen by measuring the mark, and it was the right answer to "what matches the logo"; Linda asked a different question, and a Futura is the wrong register for it — geometric circles read friendly and slightly retro where a grotesque reads institutional. **The mark keeps its geometry; the type stopped imitating it.** Every display size came down (4.75rem → 4.25) because Geist's x-height is 0.52em against Jost's 0.460, the tracking went tighter, and **nothing is heavier than 600**: at 800 a grotesque shouts.

**The testimonials were cleaned up by deletion.** The 4rem quote mark: gone, 60px of decoration per card announcing "this is a quote" about an object that obviously is one. The fixed 320px card: gone — measured at 140/84/56px of text in a 320px box, the third card was 18% words. The overhanging colour chip: gone — on a page trying to read as a serious tool it was the loudest thing left. What survives of the hue is one disc with the person's initials, and the name sits on a hairline that lines up across the row because the block is pushed down with `margin-top: auto`.

**Measured after v21.** **40 gate lines pass** (44 before: `reader.mjs` went with the reader, and `ring.mjs` lost the bento's four) and **five self-tests** are caught. First load **278KB desktop / 232KB phone over 13 files**, down from 424/367 over 35 — almost all of it the bento's fifteen pictures. Worst contrast **4.82:1 light / 5.95:1 dark**, the dark figure better than before because the small type on saturated chips is gone.

**Open, and unchanged by this round:** the body copy is placeholder, the testimonials are placeholder, the three figures are placeholder, Subscribe still points at `[NEWSLETTER_ACTION_URL]`, and the phone number is still unconfirmed.

## v20 (2026-09-07) — the ring goes back
*"I dont really like that the testimonals section is where the creativity in motion section was… I actually love the creativity and motion section."* Reverted. The necklace carries **“Creativity in motion creates knowledge!”** again, at 3.5rem with Linda's name under it, and the testimonials are three cards in their own section below it. v18 and v19 are gone from `home.css`, `tokens.css`, `main.js`, `build-html.py` and the three gates that changed with them; **everything from v17 and before is untouched** — the full-field photograph, the proof in the hero, the second way in, the graded portrait, the balanced readers.

**Why the merge was wrong, in his terms and mine.** Mine was arithmetic: the ring was 880px of ground that was 71% empty carrying one static quote, and the testimonials were three more equal tiles. His is the one that counts — **that quote is the best line on the page, and it was the whole section.** Folding it into a carousel made it one of eight, and seven of the eight are lorem. A signature moment made of placeholder content is not a signature moment; it is a mechanism waiting for content, and it cost a line that already worked. The 71% of empty ground is what a single line at 3.5rem in a necklace is *supposed* to look like.

What the merge was right about is still true and still open: the testimonials are three equal tiles of lorem. That is a **redesign of the testimonials**, not a merge with something that already works.

**Measured after v20.** Back to 44 gate lines and six self-tests, all caught. Worst contrast 4.82:1 light / 5.28:1 dark.

## v19 (2026-09-06) — the swap, and the voice back inside the circle
Two notes on v18, both right.

**"the transitions between testimonials does not feel smooth."** They were a cross-fade: the leaving quote at `--dur-state-out` and the arriving one at `--dur-enter`, both running at once, which puts two lines of type over each other at 40–60% for a third of a second. That is not a transition, it is a smear. It is **sequenced** now — the one leaving goes first and takes 160ms, the one arriving waits 150ms and takes 280ms, and each moves 8px so the change has a direction. Measured frame by frame across the swap: **zero frames where both are above 0.12 opacity**, and the whole thing lands in about 430ms.

**"the text isnt in the circle where it should be on mobile."** Also right, and the fix is the opposite of what it looks like. The phone ring is r 178 / item 84 now, which is 272px of clear space — but the lever that mattered was the column, and it had to get **wider**, not narrower: `--ring-inset` 56 → 24. A narrow column makes more lines, a taller block, and the person chip ends up further down the circle where there is least room for it. At inset 56 the chip's corners sat **10px outside** the clear circle at 390 and 5px outside at 320. At 24 the quote is three lines, the chip comes back up to where the circle is still wide, and the worst corner clears at both widths.

**And the gate that let it through was measuring the wrong thing twice.** It took the corners of the `<li>` box — all eight are stacked in one grid cell so each is as tall as the tallest, and its corners are empty space, so the check was failing on air. And it measured only the voice that happened to be showing: Linda's quote is 40 characters and a placeholder is 79, so whether it passed depended on where the drift had got to. It measures the **ink of every voice** now — the text's own client rects and the chip — against the clear radius.

**Measured after v19.** 44 gate lines pass, seven self-tests caught. No overflow at 320/390. Worst contrast 4.82:1 light / 4.64:1 dark.

## v18 (2026-09-06) — the ring is the testimonials
*"do the ring merge."* The most distinctive object on the page was carrying one static quote in **880px of ground that was 71% empty**, and the testimonials were three more equal tiles in a page that already had four cards. Now the necklace **is** the voices: eight photographs, eight quotes, and **the one standing at the top of the circle is the one speaking** — its photograph scales to 1.12 with a neutral ring, its quote and its person chip sit at the centre. Hovering or focusing any other photograph hands it the centre; leaving hands it back. That is the section's whole reason to exist, and it deleted a section rather than adding one.

**Three things had to be got right and two of them were got wrong first.**
**The phase.** Without one, the flow has already turned 200-odd degrees by the time the ring is on screen — drift plus 0.06° a pixel scrolled — so which voice you meet is an accident of scroll speed. Phasing on first intersection left another 40° to run and landed on item 7. Phasing on the current angle at centring landed on 7 as well: the angle is still easing toward its target with a 0.32s time constant when a scroll stops. **The phase is the flow's `target`, taken when the necklace is centred**, and Linda's own line is now the one you arrive on at 1440, 1024 and 390.
**The geometry has to be phased too**, not just the index — phase only the index and item 0 speaks while some other photograph is standing at the top, which is the one thing this section must not do.
**And a wide rectangle inscribed in a circle is very short.** At 2.3rem in a 480px column a 90-character quote ran to six lines, 243px tall, with its corners **268px from the centre against the 256px the necklace leaves**. It is 1.75rem in a `2r − item − 96` column now: four lines, corners at 254. Hence the rule — **a ring quote is at most 90 characters** — which is a good constraint, because it makes each testimonial give up its best line instead of all of them.

**On a phone there is no clear space at all**: 2r − item is 150px and a quote plus a person chip is 200. Below 768 the voice stops being a centre and sits under the necklace, which is why it is a sibling of the stage in the markup rather than a child of it.

**The colour rule held.** The name cannot carry the hue and the active photograph cannot take a coloured border — no coloured text, no hue as a border — so the hue is on the **person chip**, which is a surface, and what marks the speaker is scale and a neutral ring. `.voice__*` is gone; `.who` is the chip, and it is the same object the testimonial cards used to carry.

**Measured after v18.** 44 gate lines pass and **seven self-tests** are caught — `ring.mjs` gained a second one that takes the active mark off every photograph. `layout.mjs`'s chip check was repointed: it used to assert the testimonial chip cleared the next card, and now asserts the person chip never lands under a ring photograph, which is the real risk in the new geometry. Worst contrast 4.82:1 light / 4.64:1 dark.

## v17 (2026-09-06) — a peak below the hero, proof above the fold, and a second way in
*"the rating went down on pure design… what can we do to make it 10 across the board?"* Design had not moved — it held at ~9 through the film arriving and leaving; what moved was Creativity, the 20% slice the film was carrying. Content is capped without Linda (three lorem quotes, three placeholder figures, a Subscribe button pointing at nothing). The other **90% is ours**, so it was measured rather than described.

**Nothing below the hero was big.** Four cards and three quotes, every one a quarter of the page. The band that was rejected two rounds ago was rejected for resolution — and that objection is dead: **17 of 25 photographs have a 1440 source and seven have 2048–2592 originals.** The pipeline writes a **1920** tier where the source can carry it, and one photograph now runs the full twelve columns between the cards and the ring. It is a **tile in the field, not a band across the page** — same container, same radius, same gap — which is the difference that matters. `conga-line` is built horizontally and **left the bento in the same move** so it is not in two places; `bow-ties-wall`, unused until now, took its tile. The crop was set by looking: at `50% 44%` it took the top off the fourth performer's head, and `50% 30%` keeps all six.

**The hero's copy panel was carrying 288px of nothing** — 144px above and below a centred block, 36% of its height. The three figures moved into it under a hairline. Credibility above the fold, and the air is 84px now, which is generous rather than dead. On a phone a third of that panel is 91px and IMPROVISATION is 105px, so three columns ran a label over the next figure; below 600 it is one per line with the figure beside its label — 122px tall against the 200px that stacking them as blocks would have cost.

**And the site routed nobody.** The nav is two same-page anchors and every action on the page was the newsletter. “Bring this to your school” sits under the contact links: a `mailto` on the address already there, with the subject written for them. No new address, no form, and it fills a column that was three lines in a 500px space.

**Measured after v17.** 44 gate lines pass, six self-tests are caught. No overflow at 320/360/390. Worst contrast 4.82:1 light / 5.28:1 dark.

## v16 (2026-09-06) — the film comes out
*"i dont think i like the video section at all i think we should take it out."* Out — the section, the CSS, the script, the two encodes, the poster, the pause/play icons and `film.mjs`. Nothing that was only there to serve it survives; it is all in v15's commit if it is ever wanted back.

He is right, and the reason is the one I flagged when I shipped it: **the footage is an adult workshop in a Chinese-language venue** and the site is about American classrooms and children. A signature moment has to be the truest thing on the page, and that clip was the least true one — a picture of a different programme, sitting in the middle of a page that had just spent four cards saying what this one is. Two of the three clips were unusable anyway (pre-cut on a template with a wax-seal envelope and a scrapbook frame), and the third only had thirty clean seconds in it.

What the removal costs, honestly: the page has **no signature moment** again, and nothing below the hero is big. Those are still the two things between this and a 10, and neither is fixable with the assets that exist. What it does NOT cost is the round's other work — **the proof row stays**, and it is now the biggest type below the hero on its own.


**And two things that were ours to fix, no new information needed.** The **founder's photograph** was measured rather than described: 87% of its pixels sat in the bottom sixteenth of the luminance range, channel means of 16/255. It is a studio portrait on a black backdrop — the blackness is the picture, not a bad exposure — but it left her a floating head and a shoe in a row of three bright classroom pictures. A **gamma lift of 2.2 in the pipeline** opens the jacket and the chair without touching the white point; a linear stretch was tried first and clipped her face and the shoe. `images/src` keeps the untouched original and `build-images.mjs` carries a per-photograph `GRADE` table, so the correction is reproducible and visible in code. If card 04 needs to be *bright*, that is a different photograph, not a grade.
**The readers were lopsided**: 198 / 279 / 615 / 280 characters, so card 03 was three times card 01. P[4] — the outcome of the method — closes "what Developmental Improvisation is" at least as well as it closed "what would you do?". **390 / 279 / 423 / 280** now, same six paragraphs.

**Measured after v16.** Back to 44 gate lines and six self-tests. First load 424KB desktop / 367KB phone. Worst contrast 4.82:1 light / 5.28:1 dark.

## v15 (2026-09-06) — the one moving picture, and three figures
Jayden asked what would take the site from a 9 to a 10, and to research it rather than assert it. The awards weight **Design 40% · Usability 30% · Creativity 20% · Content 10%**, and 8.0 is the Site of the Day line. Scored honestly on that, DI was Design ~9, Usability ~9, **Creativity ~6.5, Content ~4** — a weighted 8.0, with the two smallest-weighted criteria doing all the damage. The most-repeated finding across the winners: **one signature moment, not twenty effects.**

**The site is about improvisation — a thing that only exists in motion — and `grep -c "<video"` returned 0.** Fifteen hero photographs, four card photographs, eight in the ring, every one a frozen frame of the subject. So: one muted loop, between the cards and the ring, and it is the only element below the hero allowed to be big — the four cards and the three quotes were all one size, which is what made the lower page read flat.

Getting it usable took work. Of Linda's three clips, **two are unusable**: pre-cut on a template with a wax-seal envelope animation, a scrapbook frame with doodles, a bokeh-lights overlay and a maroon photo grid — a visual language from somewhere else entirely. The third is clean footage but only between 10s and 39s; either side is title cards and page curls. And it carried a **baked-in template frame** — a near-white border with the picture inset at 852x380 of a 960x420 raster — which rendered on the dark page as a white slab with a soft picture floating in it. The encode crops past it, takes 12–18s as one continuous shot, and **dissolves its last half-second back into its opening frame** so the loop has no jump. 355KB MP4 / 317KB WebM, `preload="none"` behind a poster: **first load is 435KB desktop / 390KB phone and none of it is video.** An observer starts it on screen and pauses it off, it never autoplays under reduced motion, and it carries its own pause control — an autoplaying loop over five seconds needs one (WCAG 2.2.2). The panel is capped at **1000px**, a 1.17x stretch of the source; past that, 20fps handheld goes to mush. New gate, `film.mjs`, five lines and a self-test that takes `pause()` away.

**And three figures at the head of the testimonials.** The page said what the method is and who made it and nothing about whether it has ever been used; "fifty plus years" was buried in a card summary. One wide panel, numbers at up to 4.5rem — the biggest type below the hero after the film — labels in caps beneath. **The figures are placeholders**: `50+` is real, the zeros are the shape of a number and not a claim, and they must carry Linda's real counts before this is published anywhere.

**Still open, and honest about it:** the footage is an **adult workshop in a Chinese-language venue** while the rest of the site is American classrooms and children, and a bystander in red is filming in the foreground. It is the best of what exists. If the story is "a tool for the classroom", the signature moment should show a classroom.

**Measured after v15.** 49 gate lines pass, seven self-tests re-inject their bug and are caught. Worst contrast 4.82:1 light / 5.28:1 dark.

## v14 (2026-09-06) — a hamburger, a card that lets go, a carousel you can scrub, and the hover pass
Four asks in one message, and the last one turned into the round's real find.

**"on mobile i wish it was just a hamburger menu and a x instead of close and there doesnt need to be a logo in that menu."** Done: `.nav__menu` is a 44px icon button that swaps a Phosphor `list` for an `×` on `aria-expanded`, and the sheet's head is one `×` and nothing else. The button keeps a label the whole time — `Menu` / `Close menu` — because an icon-only control with no accessible name is a dead end for a screen reader.

**"clicking on the cards glitches the hover color to stay there after you hovered off."** `.brief:focus-within` was the cause: closing the reader returns focus to the card's own button, so the card stayed painted long after the pointer had gone. It is `:has(.brief__more:focus-visible)` now — a keyboard focus still reveals the hue and the control, a mouse click does not leave one behind.

**"able to manually scroll the carousel as well when you hover and scroll over rows… and the other rows will still do there thing."** Each bento column now holds itself: the pointer freezes **that** column at the angle it was on, the wheel scrubs it by hand, and the offset it earned is kept when the pointer leaves so the strip never jumps back. The other two carry on drifting. 480px of wheel in one direction is the escape hatch — the page gets the rest of the gesture rather than being trapped — and none of it exists on a coarse pointer. `ring.mjs` asserts the three halves separately: the hovered column stops, the others carry on, the wheel moves it. Its first version could not see any of it: the point it aimed at was the *column's* rect, and a column is four times the panel's height and translated upward, so `top + 60` landed on the fixed header. x from the column, y from the panel.

**"what can push the 9 to a 10? making the hovers and micro animations a lot cleaner."** He was right, and not for the reason either of us expected. **The reveal class never came off.** `.js .reveal` declares `transition: opacity/transform var(--dur-reveal)` plus the stagger's `transition-delay`, and it outranks a component's own rule — so for the rest of the session the fourth card's hover lifted over **360ms after a 180ms delay**, and its hue, which the reveal's shorthand does not list, **never faded at all**. The colour was snapping on. The class is removed once the element has landed; `motion.mjs` asserts it and its new self-test puts the class back.

On top of that, one rule for how everything answers. A state **arrives in `--dur-state` and leaves in `--dur-state-out`** — fast in, slow out — carried on `--t` at `:root` and flipped by a single `:where(...):hover` list, so a component writes `var(--t)` and never a number. **A press is `--dur-press` and is never slowed by it**: `.btn:hover { transition-duration: var(--dur-state) }` also caught the transform, and since a press only happens while hovered, the press rung was dead on every button on the page. Every control has a press now — buttons, the wordmark, nav links, the three icon buttons, the four cards, and the photographs in the gallery and the ring. On a card the ground, the lift and the picture all answer the **card**, not the part of it under the pointer, and the control and its arrow follow 60ms behind on the way in and leave together.

**Measured after v14.** 44 gate lines pass, six self-tests re-inject their bug and are caught. Worst contrast 4.82:1 light / 5.28:1 dark.

## v13 (2026-09-06) — Jost, a header that comes back, and the sky off the footer
Three asks. **"the font needs a change it doesnt really match the font of the logo with its flow and look."** So: open the mark and read it. The "di" is a **perfectly circular bowl on a straight stem, one stroke weight, flat terminals** — that is a Futura. **Jost** is a Futura, it is variable (100–900 in one 25KB latin file), and it carries the single-storey 'a' the logo's geometry implies. Sen was a near-miss beside the mark: humanist geometric, oval bowls, terminals cut on an angle. Poppins matches the construction too and was set beside it at the real headline size; Jost is narrower and quieter and holds the line count. Jost's x-height is 0.460em against Sen's 0.488, so the wordmark went 15 → 16px. **The body face does not change** — a small-x-height geometric is a display face, not a reading one.

**"when scrolling up the header should appear again."** It does now, at every width: fixed, bare at the top of the page, gone on a downward scroll, back on any upward one with the ground under it. A 6px threshold keeps it off a trackpad's noise; keyboard focus reveals it wherever it is, so a tab stop can never sit off screen; under reduced motion it hides without sliding. New gate, `nav.mjs`, with a self-test that freezes the class list.

**"the footer is a bit too crazy strong in dark mode."** True — a full-strength sky across a page-wide panel is a floodlight on a near-black ground. The field is the raised panel now and **the sky is on the sign-up card inside it**, which is the thing you are meant to act on. The same move the testimonials made two rounds ago, and it makes the rule uniform: colour rests on a panel, and the panel is the size of the thing it is naming.

**And the cards lost their chips.** *"i dont like these little pills on the top… make the headers make sense and everything will make sense."* Right: a number and a topic in two pills above a title that already said the same thing. Gone, and `.chip` with them — nothing else used it. A card is a title, a summary, a picture and one control.

**Then a resize pass**, after *"resizing the screen needs work not every part works nicely or shrinks nicely."* A 22-width sweep found no overflow anywhere — and three real faults the gates were not looking for. **The card row's middle range was broken**: under a 4:5 photograph a card's height tracks its width, so at 1200 a 569px card made a 683px photograph and an 850px card, and two of them filled a screen. A wide card is a horizontal card now — copy beside the picture, the figure on a fixed 40% share — in the two bands where a card comes out too wide (1024–1279 two-up, 561–767 one-up). **The closing field split at 768** and left its email input 170px wide; it splits at 1024 now, and the input/button pair stacks below 600 instead of 480. **And on a phone the testimonial's person chip sat 18px inside the next quote card** — the overhang was cleared against the footer but never against the next card when they stack. The layout gate holds that geometry now, at every width it tests.

**Measured after v13.** 44 gate lines pass. Worst contrast 5.44:1 light / 5.28:1 dark.

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

**Then, on looking at it:** *"the bottom cards are a bit distracting so maybe making the color only come out on hover… and make the hero bigger those arent on the screen on start"*, and *"I dont want the color to be to distracting it still has to be a premium site first."* So the rule became: **colour rests on a panel; on a card it is a state.** The hero's panel takes `100svh − --field-top` so the card row starts just off screen; the cards' heads are quiet until the pointer or the keyboard reaches them (and coloured at rest under `@media (hover: none)`, where no pointer exists); the testimonials' hue moved off the card and onto the person's chip. Two surfaces carry a hue at rest now, and both are structure. Worst contrast improved 4.64 → 5.28:1 in dark and 4.82 → 5.44:1 in light.

**And the header lost its container.** *"I would rather it be a clean header though not in a container or anything just minimal and clean."* So: no tiles, no bar, no glass — the wordmark and the controls sit directly on the page at the field's gutter, and the header **scrolls away with the page**. Bare type over a photograph is unreadable, and the honest answer to that was not to put a surface back under it but to stop needing one: Subscribe and Contact are both at the foot of the page. The "Read more" pill now arrives with the hue as well, so a resting card is chips, a title, a summary and a picture.

**Four more, on looking at it again.** The menu **stays on a phone** — fixed, with the lightest surface that can carry type over a photograph once there is something under it, because Menu is the only route to the links and Subscribe once the page has moved. The **whole card** takes the hue now, not just its head: filling the head alone left a seam at the photograph's top edge. Two words of the headline went into a `<mark>` — **cognitive** in sky, **emotional** in pink — which Jayden found by accidentally selecting one, and then **taken out again the same day**: "i actually dont like the highlights i dont think." `::selection` still paints a selection in sky, which is where he liked it in the first place. The headline is plain type. And the ink rebind had to move back onto the head — on the card, the "Read more" pill inherited `--on-accent` over `--bg-overlay` and rendered as a black blob.

**Measured after v12.** 41 gate lines pass, including a new `reader.mjs` and its self-test. First load **413 KB desktop / 349 KB phone** over 37 / 24 files: 95 document, 71 fonts, 48 CSS, 18 JS, 179 / 115 images.

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
