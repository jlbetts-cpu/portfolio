# Play production report

## Scope correction

The earlier arena-selector concept was rejected and fully discarded before this implementation. `play.html` and `play-games.js` were restored to branch baseline `9a410bf`, and the selector stylesheet and its two prototype test scripts were removed. None of that selector, arena menu, copy, or structure remains in the production result.

## Final implementation

- Kept the original Play screen, live 60vh field, four original cards, exact wording, destinations, team picker, tournament, and match behavior.
- Moved the existing **Add your head** card to the first position. No card was redesigned or rewritten.
- Added a boot-readiness gate for both saved heads and the five first-visit fallback eggheads. Initial heads are decoded and seated in the engine's idle state before the Play viewport is revealed, so the first meaningful frame is populated and has no fall/drop entrance. The existing `__noIntro` fall path and later game/ambient motion remain intact, including reduced-motion behavior.
- Put the original first-screen composition in a viewport-sized flow wrapper. The hub is absolute within that wrapper, which is geometrically equivalent to its previous fixed first-screen placement but scrolls away with the original screen.
- Added Home's approved contact footer below the wrapper with the exact availability copy, LinkedIn/Instagram/email links, 56ch measure, and ghost `Jayden Betts` mark. Resting Play now scrolls naturally; active games retain the original scroll lock.

## Regression coverage

- `tools/play-minimal-contract.py` checks the original screen contract, exact card order/content, absence of the rejected selector, boot path, footer copy/links/measure, and game-only scroll lock.
- `tools/play-browser-smoke.py` checks fresh and saved-head boot snapshots in Chromium, verifies decoded/opaque/seated heads at unlock, checks that they do not fall during the opening frame, exercises the original team picker into a live soccer match, and verifies the footer and original field geometry at 1440×900 and 390×844 with reduced motion.
- Standard JavaScript syntax, HTML/parser, whitespace, engine checks, and token audit are run before handoff.
