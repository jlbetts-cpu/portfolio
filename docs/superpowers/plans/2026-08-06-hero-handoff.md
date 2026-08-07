# Home to Play Hero handoff

## Global constraints

- Play must reuse the existing Home portrait rig and `hero-engine.js` mood performances; no substitute animation implementation.
- Play Hero copy remains “I made a few games for fun. Still building them.”
- Play Hero CTA order is View games, Choose a mood, time-of-day control.
- View games scrolls smoothly to the existing four game launchers below the Hero; Add your head remains first.
- Play has no outlined Hero/arena box. Its time atmosphere begins below the fixed header and flows downward.
- Play Night is near-black neutral with controlled violet atmosphere and readable white text.
- Home retains its approved outlined Hero, headline, View work CTA, and time control, but shows no portrait or mood control.
- Desktop and 390/320 mobile must have no horizontal overflow, no header/content collisions, balanced vertical spacing, and minimum 44px touch targets.
- Reduced motion must avoid staged entrances and scrolling animation while retaining all content and game access.
- Preserve all game launchers, setup screens, tournament, dark mode, footer, contact behavior, Lucide interface icons, and custom mood artwork.

## Task 1: Simplify Home Hero

Remove the visible Home portrait and mood control while preserving the approved Hero outline, headline, View work CTA, time control, cases, and responsive balance.

## Task 2: Port the character Hero to Play

Use the Home Hero structure and shared head engine on Play, expose the four mood performances, use the new CTA row, move game cards below the Hero, apply the top-down time atmosphere, align the portrait reflection, and keep mini-head entrances offstage until thrown.

## Task 3: Mobile and integration verification

Verify Home and Play at desktop, 390px, and 320px across Off and Night, plus all Play launch/setup/live/end states, reduced motion, keyboard operation, smooth anchor behavior, and overflow.
