# Shared Control System and Responsive Hero Plan

## Goal

Replace the portfolio's page-local control and surface lookalikes with one shared, token-driven component system, then verify every shipped surface at desktop and mobile sizes. Keep time-of-day lighting as a Home-only Hero feature; Play is a neutral, monochrome experience.

## Global constraints

- Work only in the existing `codex/time-of-day-hero` worktree.
- `tokens.css` owns all numeric control decisions.
- `controls.css` is the only shared implementation of control geometry, type, rim, fill, state, and motion.
- Every normal free-standing control is border-box, 44px tall, 14px radius, 15px/400 Instrument Sans, 0 16px padding, 8px internal gap, border 0, and an inset token rim.
- Icon-only controls are exactly 44px square. The 36px compact rung is legal only inside target-sized chrome and must provide a 44px hit area.
- Primary, secondary, icon, quiet/menu-row, tab, chip, field, and explicitly large media control are named variants. There are no unnamed exceptions.
- Secondary and icon controls use an opaque solid local ground in both light and dark modes. Menus are opaque. The header bar is opaque; only its positioning wrapper may be transparent.
- Primary actions use the shared inverse neutral treatment and the same geometry as secondary controls.
- Header and large Hero/container outlines use one shared container-rim token. Control rims use one shared control-rim token. Neither may use layout-affecting borders.
- Existing mood artwork and character motion remain intact.
- Play has no day-cycle control, time menu, time gradient, or day-cycle face tint. Its character uses the neutral monochrome treatment.
- Shared containers, cards, thumbnails, media frames, and tab rails consume the same radius, rim, spacing, and ground tokens across every shipped page.
- Every shipped UI element is either a named shared component/variant or fails the audit. Desktop and mobile consume the same semantic components; responsive rules may change composition and sizing only through shared breakpoint/layout tokens, never fork the visual language.
- UI motion uses the named feedback/state/release/settle tiers and house easing, with shared reduced-motion behavior. Character and game-scene motion remain expressive only as named scene-motion carve-outs; raw one-off durations/easings in component chrome are forbidden.
- Home restores personality through the actual existing animated head/stage, centered within the Hero gradient and clipped as a deliberate lower-edge peek. It retains its existing eye/look/mood animation behavior and must not be replaced by a second low-opacity raster duplicate or a tiny corner ornament. The visible crop and scale are tuned independently at desktop/390/320 while remaining inside the Hero boundary.
- The Home daylight menu is anchored below its trigger. Collision handling may constrain its height/inline position, but it may not arbitrarily flip above the trigger within the Hero.
- Tabs and their panel/media form one `collection` composition: one outer boundary, a flat integrated tab header, one divider, and one content region. Nested rounded specimen + tab-rail + media outlines are forbidden.
- Carousel navigation is one shared control bar/toolbar containing previous, picker, and next controls. Children use quiet/internal treatment; separate outlined arrows floating around loose progress marks are forbidden.
- Shared media has exactly two placement variants: `media--full` makes photography, covers, video, and image-led sections fill the shared content margins edge-to-edge; `media--mockup` permits one tokenized inner inset for device/product mockups while its outer frame still aligns to the grid. No third unexplained x-edge is allowed.
- Component motion must remain spatially stable and coordinated: no layout jumps, radius morphs, pointer-hover movement, or independent timing noise; tab, panel, media, and carousel changes use the shared motion tiers and preserve aspect-ratio/layout during transitions.
- Radius is role-based and responsive, never locally chosen: outer Hero/collection containers use 28px desktop and 20px mobile; standalone media uses 20px desktop and 14px mobile; controls remain 14px; menus use 20px outer with 14px rows; joined tab-header/content edges inherit the single parent's corners and have no competing seam radii. Computed-role radius is audited at 1440/390/320.
- Light and dark modes instantiate the same component classes, geometry, states, and motion. Dark mode may change only semantic ground/ink/rim/atmosphere tokens; component-specific dark button/surface redraw selectors are forbidden.
- Atmospheric gradients are restrained and subject-specific: localized natural light around the animated head, lower saturation/contrast, soft falloff, and substantial negative space. Broad neon/purple washes, many competing stops, and generic AI-wallpaper effects are forbidden. The animated head is the single expressive signature; surrounding chrome remains quiet.
- Home Night is predominantly blue-black/near-black. Violet is restricted to a small localized head halo. A sparse deterministic star field remains inside the Hero: irregular placement, mostly tiny dim points, very few brighter stars, slow asynchronous low-amplitude twinkle, no uniform grids or large sparkle glyphs, and fully static under reduced motion.
- Case-study thumbnails and media ship responsive, dimensioned, optimized assets sized to their actual DPR needs; optimization must preserve high-quality mockup detail and may not replace originals until visual comparison passes.
- User instructions supersede the older prototype where it specified transparent secondary fills or blue primary buttons.
- Every implementation task includes focused tests and a self-review. No task is complete until its reviewer passes both specification and code quality.

## Task 1: Shared foundation plus Home and Play

Create `controls.css`, finalize semantic control/material/rim tokens, link the shared stylesheet on Home and Play, and migrate the Home/Play Hero controls, menus, skip links, and header chrome. Remove competing page-local geometry/material/state declarations rather than overriding them. Fix Play's missing border-box behavior. Keep the outer header pill as a group-container exception while its material/rim comes from the shared tokens. Remove Play's day-cycle control, gradient, and face tint; retain the neutral monochrome character treatment. At 1440, 390, and 320px controls must remain on-grid, there must be no horizontal overflow, and the mobile fold must remain balanced. Add focused static and browser contract tests.

## Task 2: Shared surface/container foundation and case-study migration

Create the shared surface/container primitives needed by the existing header, Hero, case-study thumbnails, media frames, cards, and tab rails. Their radius, rim, solid ground, padding, and responsive gutters must resolve from tokens rather than page-local literals. Restore the Home-only actual animated head/stage as a centered, clipped lower-edge peek inside the gradient; retain its eye/look/mood animation and remove the duplicate mini raster peek. Make the daylight menu reliably open below its trigger. Apply one shared `collection` composition to Home work and case-study tabbed media: one outer boundary, integrated flat tab header, divider, content region, no nested rounded boxes. Apply one shared carousel control bar composition containing previous/picker/next controls with quiet internal children. Link the shared component styles from Bearings, Apollo, Cluster, Strata, and UC Davis. Remove the duplicated late control blocks and the earlier conflicting chrome rules while preserving layout and content behavior. Convert clickable carousel ticks to accessible 44px controls with unchanged visual marks. Add focused tests for all five pages, including typography/spacing hierarchy and screenshots at every required viewport.

## Task 3: About and builder migration

Link `controls.css` from About, Head Maker, and Gradient Lab. Remove locally reimplemented `.ctl` bases and hand-coded About controls. Migrate controls to shared named variants while preserving valid specialized inputs such as sliders and color wells. Replace dark-mode class overrides with semantic opaque ground tokens. Add focused tests.

## Task 4: Remaining Play/game surfaces and theme adapters

Migrate remaining Play picker, tournament, scoreboard, add-your-head, and game controls/surfaces to shared named variants. Remove translucent resting chrome, opacity hover states, and theme-specific component selectors. Play has no local daylight picker, but the ambient light behind its Hero head inherits the current global time/day state through shared semantic atmosphere tokens. Hide the global header and footer from layout/interaction/accessibility while soccer, battle, race, tournament, or team-selection fullscreen states own the viewport; restore them on hub exit. Correct soccer player spawning so every initial and resized player position is calculated in the rendered pitch/plane coordinate system and remains inside playable bounds at 1440/390/320. Apply shared control/surface/type/radius/rim/spacing/motion components across hub, picker, soccer, battle, race, tournament, and scoreboard while keeping named scene/character animation carve-outs intact. Verify page scrolling is unlocked in the resting hub state and intentionally locked only during active game states. Add focused state/geometry/browser tests.

## Task 5: Whole-site verification and correction

Run static token/component audits plus computed-style and screenshot verification on every shipped route at 1440, 390, and 320px in light and Night. Assert control heights, radii, box sizing, typography, opaque grounds, zero layout borders, token rims, spacing, focus, hover, active, shared surface/container geometry, no horizontal overflow, and header/Hero/content alignment. Fix any failure. Conduct an independent final review before commit and push.

## Task 6: Responsive media optimization

Using the completed media audit, generate only the responsive variants each Home/case-study placement requires, with modern compressed formats and preserved high-DPR mockup detail. Keep source originals available during comparison. Add explicit intrinsic dimensions, `srcset`/`sizes`, appropriate eager/high-priority loading only for genuinely above-the-fold media, and lazy decoding/loading below the fold. Verify byte reduction, no layout shift, and visual parity at desktop/390/320 before adopting the optimized sources.
