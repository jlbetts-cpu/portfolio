# Shared Contact disclosure design

**Status:** User-approved on 2026-08-06.

## Purpose

Make Contact visibly discoverable as a dropdown on every user-facing page. It is a navigation-style disclosure, not a filled CTA and not a link that jumps to the footer.

## Appearance

- Keep the existing envelope icon and `Contact` label.
- Add one small inline chevron inside the same nav item.
- Use a semantic `<button type="button">` disclosure trigger because it no longer navigates, while styling it as an unfilled navigation item rather than a CTA.
- Use the header's shared icon stroke, ink, spacing, hit target, and active material tokens.
- The whole item remains visually consistent with Work, About, and Play; there is no separate caret button.
- The chevron rotates or changes orientation when expanded and honors reduced motion.

## Menu

- Contents remain LinkedIn, Instagram, and Email in that order, using the existing shared icons and destinations.
- Remove the redundant touch-only `Contact` destination row because Contact no longer navigates to the footer.
- Use the existing token-styled header menu surface in light and dark modes.

## Interaction

- Desktop fine pointer: hover, keyboard focus, or click opens the menu.
- Touch/coarse pointer: first tap opens the menu; a menu choice performs the action.
- Escape closes and returns focus to the trigger. Outside click and focus leaving the disclosure close it.
- `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`, trigger semantics, and menu link names remain accurate.
- Only one shared header disclosure is open at a time.

## Scope and verification

Update the shared header component and every shipping header instance without changing unrelated destinations. Verify desktop, 390×844, 320×800, keyboard-only, touch, dark mode, reduced motion, forced colors, external-link attributes, and viewport menu clamping.
