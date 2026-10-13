# How Jayden designs — read from his own apps

Written 2026-10-13, after he asked: *"do you have access to the [Apollo / Strata]
files and md files and see how I like my design?"* Two sources:

- **Apollo** (`dsehsani/apollo-ios`, his HackDavis 2026 app): the SwiftUI code,
  `README.md`, `Components/Theme.swift`, and the onboarding image assets.
- **Strata**: the `design.md` he shared on 2026-10-02 (LOCKED / GUIDED / OPEN).

These are evidence of taste, not a spec for this site. Where they point at a
change on this site that reopens something LOCKED in `decisions.md`, it goes to
him as a question with a rendering, never straight into the code.

## What both apps agree on

| Rule | Apollo | Strata |
|---|---|---|
| **Dark, enforced** | `.preferredColorScheme(.dark)` at the root; ground `#080808` | — (light app, but "chrome is ink and light") |
| **No dividers, spacing only** | README: "No dividers — spacing only" | "Lots of white space, and it has to be doing something" |
| **One accent: ink** | every token is a grey; colour only in photographs | "One accent: ink. No blue anywhere" |
| **Colour means a photograph (or a win)** | the photographs are the only colour | "Saturated colour means a win or a photograph" |
| **44pt targets** | README rule | check 8 |
| **Less text** | short declaratives with full stops: "Your Wins. Every Day." "Win every day." | "Less text, always. A component that explains itself loses its charm" |
| **Calm motion** | `easeOut` 0.25–0.3s; one spring | 9 animations, against the 40 the app had |

## Where Apollo goes further

- **A display serif for the big moments.** Goudy Bookletter 1911 Regular at
  48pt for every onboarding headline ("Welcome to", "Your Wins. Every Day."),
  36pt for the Profile and Friends titles, and Goudy Italic at 16–28pt for the
  small expressive lines (empty states, prompts, "shooting for"). SF Pro does
  everything else. *Strata says the opposite* ("I hate when there is like one
  type of font next to another"), so this is his call, asked, not assumed.
- **Photographs as a tower.** Mixed sizes (full-width and two-up), stacked with
  tiny gaps (`towerGap: 1`) and nearly square corners (3–4pt; 6px in the
  assets), inside a dark frame, like a photobooth strip.
- **Photographs as posts.** A photo, then a dark band with a serif title and one
  grey metadata line: "HackDavis 2026 · @Jaydenbetts · 11:30pm · 5/9/26".
- **The welcome screen**: a vertical ground from `#212121` to `#080808`, three
  photographs tilted −8° / +7° layered at the top under a fade, a left-aligned
  serif headline, a large grey body (24pt `#b5b5b5`), one full-width light
  button (radius 10, 44pt).
- **Neutral greys, no cast**: `#080808` ground, `#111111` surface, `#212121`
  sheet, `#f3f3f3` text, `#b5b5b5` caption.

## Already true on this site because of the same taste

Dark only (v34), no lines (v29), ink as the only accent (v24), photographs as
the only colour, 44px targets, the hero as the first screen, less text.

## Rendered, waiting on him (2026-10-13)

The site with the Apollo language laid over it, as CSS injected on the live
page, never committed: Goudy Bookletter 1911 for the four display lines, 6px
photo corners and 8px gaps in the gallery, 10px buttons, Apollo's neutrals.
Screenshots: `rate/mk-now-*` against `rate/mk-apollo-*` in the session scratchpad.
