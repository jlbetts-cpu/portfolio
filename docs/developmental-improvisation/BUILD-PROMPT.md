# Developmental Improvisation — build prompt v5

> **v5, 2026-09-05.** Jayden's fourth review, plus thirteen photographs from the old site's gallery: the arch is **photographs only, every card upright** — no frames, no tilt, no colour cards in it; the pastel cards with photographs in them are the **stacked cards further down the page**, which now carry structured photo tiles. With 21 usable photographs the arch's sixteen slots are all unique and the "twin" rule is gone. Measured on the mock at six viewports: zero tilt, zero card pixels under copy, zero card-on-card overlap, zero repeats. Mocks: `docs/developmental-improvisation/hero-mock-desktop.jpg`, `hero-mock-mobile.jpg`, `stack-mock.jpg`. Everything from v2–v4 not named here stands.

> **How to use this file.** Paste everything below the line into a fresh agent session together with the inputs listed in §0. Edit the decisions in §2, §3, §5, §6 and §12 before you send it; everything else is mechanics. Sections marked `[DECIDE]` are the ones Jayden should read.


**Contents.** §0 Inputs · §1 Non-negotiables · §2 The brand · §3 Design system (colour incl. pastel surfaces, type, space, no gradients, no shadows, motion, states) · §4 Components and the style guide · §5 The star, the figure, icons · §6 The home page: arch, band, stack, quote, pile, newsletter, contact, footer · §7 The newsletter popup · §8 Research: the colour rules and where they come from · §9 The micro-interaction inventory · §10 Copy · §11 Photo manifest and pipeline · §12 Stack, hosting, forms, icons, fonts · §13 Deliverables and file structure · §14 Gates · §15 Needs from Linda · §16 The two documents · §17 Process · §18 How to reply

---

You are building the new website for **Developmental Improvisation**, an education program created by educator Linda Kellogg Fulton that teaches cognitive development and social-emotional understanding through improvisation games. Mostly children in classrooms; also teachers and adults in workshops. The old site (a stock light-theme template) lacked personality and had broken proportions. This is a full rebrand around a new logo. You are working for Jayden Betts, a product designer who specializes in Apple-grade systems, who made the logo and will edit and ship what you build.

The two things this prompt must produce, flawlessly:

1. **A home landing page** (`index.html`) with a newsletter sign-up popup, a testimonials section (placeholder text for now), and a clean footer. Photo-first. Dark mode. Playful but professional.
2. **A reusable design system** — tokens, components, a living style guide page, a Markdown spec and a Notion-ready copy of that spec — strict enough that the next page (Gallery, Contact) can be built without inventing anything.

Read all of this before writing a line of code. Where this prompt makes a decision, do not re-open it. Where it leaves a choice, make the call, state it in one line in your reply, and move on.

## 0. Inputs you are given

| Input | Where | Notes |
|---|---|---|
| Logo, 6 SVG variants | `assets/logo/` | `dilogocolor.svg` (colour), `dilogoyellowstar.svg` (colour, yellow sparkle), `dilogo.svg` (white), `dilogoblack.svg` (black), `dilogobasicwhite.svg` / `dibasicblack.svg` (monogram only, no ring). ViewBox 787×842 for the full mark, 312×304 for the monogram. |
| Brand palette | §3 of this prompt | Pastels for UI; the saturated hues live only inside the logo. |
| 12 photographs | `images/src/` | Manifest in §11. Two are HEIC and must be converted. |
| 13 gallery photographs | `images/src/gallery/` | Jayden sent these as images in chat; chat images do not land on disk, so **Jayden attaches them as a zip** before the build. They are catalogued in §11.2 with crops. Cropping rules in §11.1. |
| Old site copy | §10 of this prompt | The **only** words you may put on the page. |
| Apple design reference | `docs/apple-design.md` | Reasoning on motion, materials and type. Section 3 of this prompt wins where they disagree. |
| Hero, stack, pile and footer mocks | `docs/developmental-improvisation/hero-mock-desktop.jpg`, `hero-mock-mobile.jpg`, `stack-mock.jpg` | Rendered with the real photos and the real type. Sketches for order, scale and geometry, not pixels to copy. |
| Font specimen and logo sheet | `docs/developmental-improvisation/font-specimen.jpg`, `logo-variants.jpg` | Rendered during research; look at them once. |
| This prompt | — | The spec. |

If any of these are missing from the working directory, say so in the first line of your reply and continue with placeholders; do not stop.

## 1. Non-negotiables

These are settled. They are not preferences.

1. **Premium is subtraction.** When a section feels wrong, remove something before adding something. Every element must earn its place; if you cannot say what a shape, line or animation is *for*, delete it.
2. **Counting is not looking.** After every build step, screenshot at 1440×900, 1024×768, 390×844 and 320×640, open the screenshots, and look at them. A layout that "measures correct" and looks wrong is wrong.
3. **One typeface, two weights, no italics, no gradient text, no letter-spaced uppercase eyebrows.** Hierarchy comes from size, weight (400/600), leading, tracking and colour tier. Nothing else.
4. **Colour lives on shapes, chips, illustration and the logo. Body text is only white or a white tier.** Headings are white. No coloured headings, no coloured paragraphs, **no gradient anywhere** — not in the hero, not behind the logo, not on a button, not in the footer. The ground is flat `#181818` from top to bottom.
5. **No shadows.** Chrome separates with hairlines and translucency. Elevation on a dark ground is a lighter surface plus a hairline, never a drop shadow.
6. **Flat vectors only.** No texture, no noise, no grain, no glassmorphism cards, no blurred blobs floating behind cards, no emoji, no stock illustration packs, no AI-generated imagery. Photographs are the only "texture" on the site. The one 3D-looking thing is the stacked card's 6° `rotateX` as it recedes (§6.3); nothing else has perspective.
7. **Motion is a system.** Use the ladder in §3.6. Every animation has a purpose you can name (feedback, continuity, attention, ambience). Ambient motion is slow, small and stops under `prefers-reduced-motion`.
8. **Copy is verbatim from §10.** Do not write marketing copy. Do not invent taglines, stats, claims, names, schools, awards or quotes. Placeholders carry `data-placeholder="true"` in the markup and use the exact placeholder strings given in §10.4.
9. **44px minimum hit target, measured** with `getBoundingClientRect`, not declared. The one exception is inline links inside a paragraph.
10. **Stage only your own files.** `git add <paths>`; never `-A`, never `-a`.

## 2. The brand, in one paragraph `[DECIDE]`

Developmental Improvisation is where a classroom becomes a rehearsal for life: children play safe, thrilling games that ask "What would you do?" and come out more able to think, cooperate, communicate and care. The brand is **warm, exact and awake**. Warm because it is about children and compassion; exact because it is sold to principals and teachers who need to trust it; awake because improvisation is alertness — listening, saying yes, building on what you were just given. The logo says all of this already: a "di" monogram with a sparkle, ringed by three figures whose outstretched arms reach along the ring. The site should feel like that logo: a flat dark ground so the colour pops, plenty of room, one confident voice, photographs of real people doing the work, and a ring of people holding hands.

**Reference points, in this priority:** Google (a many-coloured brand held professional by ruthless rationing of colour and generous white space, here dark space) → Apple (layout, type, materials, motion discipline) → Headspace / Duolingo (playful for children without being childish). Not a reference: any template, any "SaaS landing page", anything with a glowing blob behind a card.

## 3. The design system `[DECIDE]`

Ship these as `css/tokens.css`. Every other stylesheet reads tokens; no stylesheet declares a raw colour, size, radius or duration. If you need a value that is not here, add the token first, name it, and list it in your reply.

### 3.1 Colour

The logo carries the saturated hues. The interface carries pastel tints of the same hues. That is the whole trick: the logo is the loudest thing on every screen and nothing competes with it.

```css
:root {
  /* Ground — dark is the brand's default; there is no light theme in v1 */
  --bg:          #181818;                 /* page */
  --bg-raised:   #212121;                 /* cards, nav ground = white 4% over --bg */
  --bg-overlay:  #262626;                 /* popup panel, inputs = white 6% */
  --line:        rgba(255,255,255,.08);   /* hairline */
  --line-strong: rgba(255,255,255,.16);   /* hairline on hover / focused container */
  --scrim:       rgba(24,24,24,.64);      /* behind the popup */
  --glass:       rgba(24,24,24,.72);      /* nav ground when scrolled; pair with backdrop-filter */

  /* Ink — the only colours text may use */
  --ink:    #FFFFFF;                      /* headings, primary body    17.8:1 */
  --ink-2:  rgba(255,255,255,.72);        /* body, labels              9.6:1 */
  --ink-3:  rgba(255,255,255,.48);        /* captions, meta, footer    4.9:1 — never below 13px */
  --ink-on-accent: #181818;               /* text on a pastel chip     ≥13:1 */

  /* Brand pastels — fills for chips, dots, illustration, focus ring. Never text on --bg. */
  --c-lavender: #E2E1FF;   /* 13.9:1 on --bg */
  --c-sky:      #C4E3FF;   /* 13.3:1 */
  --c-mint:     #D4F1C3;   /* 14.5:1 */
  --c-butter:   #EFF0A4;   /* 14.9:1 */
  --c-blush:    #FFD7D7;   /* 13.5:1 */

  /* Pastel tints for LARGE surfaces (a whole card, a band). Precomputed over --bg so no alpha stacking. */
  --t-lavender: #38383D;  --t-sky: #34383D;  --t-mint: #363B33;  --t-butter: #3A3B2E;  --t-blush: #3D3737;

  /* Logo hues, for reference only — they live inside the logo SVG and are consumed by no stylesheet.
     violet #7358FC · sky #58CDFC · green #51E596 · yellow #FEE79B · pink #FB9BC9 · magenta #E744E2 · orange #F0895B · star #FFD341
     Violet is 3.8:1 on --bg: never text, never UI. */

  /* The accent slot. Components read ONLY this. Set it with data-accent, never inline. */
  --accent: var(--c-lavender);
  --accent-tint: var(--t-lavender);
}
[data-accent="lavender"] { --accent: var(--c-lavender); --accent-tint: var(--t-lavender); }
[data-accent="sky"]      { --accent: var(--c-sky);      --accent-tint: var(--t-sky); }
[data-accent="mint"]     { --accent: var(--c-mint);     --accent-tint: var(--t-mint); }
[data-accent="butter"]   { --accent: var(--c-butter);   --accent-tint: var(--t-butter); }
[data-accent="blush"]    { --accent: var(--c-blush);    --accent-tint: var(--t-blush); }
```

**Rationing rules — these are what keep five colours professional:**
- One accent per component. A chip is one colour. A card is one colour. A section takes one accent for its star and chips, set once on the `<section data-accent>`.
- Sections rotate through the five accents in a fixed order down the page: lavender → sky → mint → butter → blush → lavender. Never two adjacent sections with the same accent; never pick by mood.
- **Where a pastel may be a full-strength fill:** chips, the star marker, the focus ring, and the four stacked cards in §6.3. That is the list. The hero arch has no colour in it — it is photographs and the logo. Everything else that is large and coloured uses the `--t-*` tint (the newsletter card).
- A pastel surface inverts the ink: everything inside `[data-surface="accent"]` reads `--ink` as `#181818`, and components do this through the tokens below, never by hand.
- Never more than two pastels visible in one component. All five together only in the logo.
- Photographs are never tinted, overlaid or duotoned.
- Text is never a pastel. Not headings, not links (links are white with a hairline underline), not numbers. On a pastel surface, text is `#181818`.
- The logo hues appear nowhere outside the logo. Not as a tint, not as a glow, not as a gradient.

```css
/* A pastel surface. Components read the same tokens and simply come out dark-on-pastel. */
[data-surface="accent"] {
  background: var(--accent);
  --ink:    #181818;
  --ink-2:  rgba(24,24,24,.72);   /* ≥ 7:1 on every pastel */
  --ink-3:  rgba(24,24,24,.56);
  --line:   rgba(24,24,24,.16);
  --line-strong: rgba(24,24,24,.32);
  --focus:  #181818;               /* the sky ring is invisible on lavender */
  --btn-primary-bg: #181818; --btn-primary-ink: #FFFFFF;   /* the white button inverts on a pastel */
  --chip-bg: #181818; --chip-ink: #FFFFFF;                  /* so do chips */
}
:root { --focus: var(--c-sky); --btn-primary-bg: #FFFFFF; --btn-primary-ink: #181818; --chip-bg: var(--accent); --chip-ink: #181818; }
```

### 3.2 Type

**Plus Jakarta Sans, 400 and 600, self-hosted.** Two static woff2 files (latin subset, ~27 KB each), `font-display: swap`, both `<link rel="preload">`ed. No italics, no 500, no 700. Fallback stack: `"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` with `size-adjust` on a `@font-face` fallback so the swap does not shift layout (measure CLS = 0).

Why this face: it is geometric enough to sit beside the logo's round "d" and "i", soft at the terminals so it reads warm on a dark ground, and it stays legible at 14px in light-on-dark where Outfit and Urbanist go thin. Figtree is the one acceptable substitute if Jayden overrules; nothing else is.

Tracking and leading are size-specific (Apple §15). Never one `letter-spacing` for all sizes.

```css
:root {
  --font: "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;

  /* size / line-height / tracking — clamp() from 390px to 1440px */
  --fs-display: clamp(2.25rem,  1.4rem + 3.6vw, 4rem);     --lh-display: 1.04; --ls-display: -0.03em;  /* 36→64 hero tagline; 72 was mocked and wrapped the tagline badly */
  --fs-h1:      clamp(2.25rem,  1.5rem + 3vw,   3.75rem);  --lh-h1: 1.06;      --ls-h1: -0.025em;      /* 36→60 */
  --fs-h2:      clamp(1.75rem,  1.3rem + 1.8vw, 2.75rem);  --lh-h2: 1.1;       --ls-h2: -0.02em;       /* 28→44 section titles, pull quotes */
  --fs-h3:      clamp(1.375rem, 1.2rem + .6vw,  1.625rem); --lh-h3: 1.2;       --ls-h3: -0.01em;       /* 22→26 card titles */
  --fs-lead:    clamp(1.125rem, 1rem + .5vw,    1.3125rem);--lh-lead: 1.45;    --ls-lead: -0.005em;    /* 18→21 hero sub, intro */
  --fs-body:    clamp(1rem,     .95rem + .2vw,  1.0625rem);--lh-body: 1.6;     --ls-body: 0;           /* 16→17 */
  --fs-small:   0.875rem;                                  --lh-small: 1.5;    --ls-small: 0.005em;    /* 14 nav, buttons secondary text */
  --fs-caption: 0.8125rem;                                 --lh-caption: 1.4;  --ls-caption: 0.01em;   /* 13 captions, meta, footer small print */
  --fs-ui:      1rem;                                                                                     /* 16 button labels, inputs, 600 */

  /* Measures are in em, never ch: Plus Jakarta Sans's "0" is 0.685em wide, so 24ch at 48px is 825px and the tagline
     spilled to two wide lines in the v3 mock. 14em at 48px is 672px and wraps to the three lines the arch was built for. */
  --measure-display: 14em;  /* hero tagline — on the h1 itself */
  --measure-sub: 24em;      /* hero sub-tagline */
  --measure-h2: 16em;
  --measure-body: 34em;     /* ≈ 60 characters of this face */
}
```

Roles, and nothing outside them: `display` (hero tagline only, 600), `h1` (page title on inner pages, 600), `h2` (section title, 600; pull quotes use `h2` size at 400), `h3` (card title, 600), `lead` (400, `--ink-2`), `body` (400, `--ink-2`; first paragraph of a section may be `--ink`), `label` (`--fs-small` 600 `--ink-2`, sentence case, sits above an h2 with the 16px brand star before it), `small`, `caption` (`--ink-3`), `ui` (600). Numbers use `font-variant-numeric: tabular-nums` only in the phone number.

### 3.3 Space, grid, radius, lines

```css
:root {
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px; --sp-5: 20px; --sp-6: 24px; --sp-7: 28px;
  --sp-8: 32px; --sp-10: 40px; --sp-12: 48px; --sp-16: 64px; --sp-20: 80px; --sp-24: 96px;
  --sp-32: 128px; --sp-40: 160px;

  --page-max: 1280px;                       /* 1200 content + 2×40 at 1440 */
  --gutter: clamp(20px, 2.8vw, 40px);       /* 20 at 390, 40 at 1440 */
  --grid-gap: clamp(16px, 1.7vw, 24px);
  --section-y: clamp(72px, 3.5vw + 46px, 112px);  /* 72 at 390 → 96 at 1440 → 112 max; same top and bottom. 96 is what Linear, Figma, Notion, Framer, Raycast and Sentry all use between sections */
  --section-y-tight: clamp(40px, 2vw + 24px, 64px); /* photo bands and the figures band: 40 → 53 → 64 */
  --stack-title: var(--sp-6);   /* label → h2 → lead */
  --stack-body: var(--sp-4);    /* paragraph → paragraph */
  --stack-cta: var(--sp-8);     /* text → buttons */

  --r-xl: 28px;   /* the popup panel, the newsletter card, the four stacked cards — surfaces, not items */
  --r-lg: 20px;   /* cards, gallery photos, testimonial cards */
  --r-md: 14px;   /* buttons, inputs */
  --r-full: 999px;/* chips, dots, avatars */

  --nav-h: 64px;
  --hit: 44px;    /* minimum target, measured */
  --z-nav: 50; --z-dialog: 100; --z-skip: 200;
}
```

Everything is on the 4px grid. `--section-y` resolves to 96.4px at 1440 — the gate in §14 rounds to the grid, and if you would rather have exactly 96 at 1440 use `clamp(72px, 3.4vw + 47px, 112px)`. Nesting is the exception, not the rule: a section is `section-y` top and bottom; inside it the title stack, then `--sp-12` to content on mobile / `--sp-16` on desktop; cards have `--sp-6` padding on mobile and `--sp-8` on desktop. Do not invent a seventh value between two tokens.

The grid is 12 columns inside `--page-max` minus gutters. Photographs and full-bleed bands are the only things allowed to leave the column, and they leave it completely (edge to edge), never by half a gutter.

**Hairlines are the only separator.** `1px solid var(--line)`. No 2px borders, no coloured borders (except the 2px focus ring), no double lines. **Every section after the hero opens with a hairline that spans exactly the column** (120 → 1320 at 1440; gutter to gutter on mobile) — that line is what makes the page read as structured; nothing else is needed to say "a new section starts here".

### 3.4 Gradients

None. Jayden looked at the v1 hero gradient and rejected it. The ground is `--bg` everywhere, the logo sits on it directly, and the photographs are the only colour fields on the page. If a screen feels flat, the answer is a photograph or more space, never a wash of colour. No `linear-gradient`, `radial-gradient` or `conic-gradient` anywhere in the CSS; the `tokens` gate in §14 fails on the string `-gradient(`.

### 3.5 Shadows

None. Not on cards, not on the popup, not on buttons, not on hover. The popup separates with the scrim and `backdrop-filter: blur(16px)`. Cards separate with `--bg-raised` and a hairline. Photographs separate by being photographs.

### 3.6 Motion

```css
:root {
  --dur-press: 100ms;    /* :active scale */
  --dur-state: 160ms;    /* hover, focus, colour, underline */
  --dur-state-out: 240ms;/* the same states leaving */
  --dur-move: 280ms;     /* something changes position or size */
  --dur-reveal: 360ms;   /* content entering on scroll */
  --dur-enter: 500ms;    /* the popup, the hero's first paint */
  --dur-orbit: 96s;      /* the hero arch: one full revolution; a new card enters every 8s */
  --dur-bob: 3.2s;       /* the figures' bob */

  --ease-out:    cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  /* springs as linear() — use --ease-pop only on things that just appeared or were just pressed; --ease-settle for everything that moves */
  --ease-pop:    linear(0, 0.135, 0.408, 0.681, 0.889, 1.016, 1.073, 1.083, 1.068, 1.044, 1.022, 1.006, 0.997, 0.993, 0.993, 0.995, 0.997, 0.998, 1, 1, 1.001, 1.001, 1);
  --ease-settle: linear(0, 0.094, 0.284, 0.483, 0.653, 0.783, 0.875, 0.934, 0.971, 0.991, 1.001, 1.005, 1.006, 1.006, 1.004, 1.003, 1.002, 1.001, 1.001, 1, 1, 1, 1);
  --stagger: 60ms;
}
@media (prefers-reduced-motion: reduce) {
  :root { --dur-bob: 0s; --dur-reveal: 160ms; --dur-enter: 200ms; --stagger: 0ms; }
  /* reveals become opacity-only; the figures band stands still; the arch holds its first frame; the stack does not tilt; the pile does not drop */
}
```

Animate only `transform` and `opacity` (and `background-color`/`color`/`border-color` for state changes). Never `top/left/width/height/box-shadow/filter`. Feedback happens on `:active` (pointer-down), never on click. Every transition is interruptible: hover out mid-hover reverses from the current value because it is a CSS transition, not a keyframe.

Reduced motion is not "no motion": a reveal still fades, a button still changes colour. Only movement, loops and overshoot go.

### 3.7 Focus, states, targets

- `:focus-visible` — `outline: 2px solid var(--focus); outline-offset: 2px;` on every interactive element, never removed; `--focus` is sky on the dark ground and `#181818` inside a pastel surface (§3.1). Focus is not hover: no scale.
- Hover — a state change of `--dur-state`. Primary button: `--ink` → `#F2F1F1`. Secondary: `--line` → `--line-strong`. Links: underline `--line-strong` → `--ink`. Photo cards: image `scale(1.02)` inside `overflow:hidden`, `--dur-move`.
- Active — `transform: scale(.97)` at `--dur-press` on buttons and chips-as-links. Nothing else scales on press.
- Disabled — `--ink-3` text, no hover, `cursor: default`.
- Every target ≥ 44×44 measured. Nav links get vertical padding to reach it even though the text is 14px. Social icons are 24px glyphs in 44px boxes. The popup's close button is 44px.

## 4. Components (`css/components.css`) and the style guide

One class per component, BEM-ish, no utility soup, no `!important`. Each component reads `--accent` and never sets a colour of its own. Document every one on `styleguide.html` with its states rendered live, its class names visible, and the tokens it consumes — this page is the reusable system Jayden will build Gallery and Contact from, so it has to be complete.

| Component | Class | Spec |
|---|---|---|
| Container | `.container` | `max-width: var(--page-max); padding-inline: var(--gutter); margin-inline: auto`. |
| Grid | `.grid` + `.grid--2/3/4` | 12-col CSS grid, `gap: var(--grid-gap)`. |
| Section | `.section` + `.section__head` + `.section__grid` | `padding-block: var(--section-y)`; opens with the column hairline (§3.3) — every section except the hero; head = label (with star) → h2 → lead, **left-aligned**; `.section__head--center` exists for the hero and the quote only. `.section__grid` is a 12-col grid with the head in columns 1–5 and the content in 7–12 at ≥1024, stacked below. |
| Star marker | `.star` | The logo's four-point sparkle (path 1 of `dilogocolor.svg`, see §5.2) as an inline SVG, 16px, `fill: var(--accent)`, before every section label with `--sp-2` after it, vertically centred on the label's x-height. It replaces the dot everywhere; there is no `.dot`. Also the testimonial pager mark at 8px. |
| Button | `.btn` + `--primary` (`--btn-primary-bg` / `--btn-primary-ink`) / `--secondary` (transparent, hairline) / `--ghost` (text only, nav on mobile) / `--compact` (44px, `--fs-small`, nav only) | height 48, `padding: 0 var(--sp-5)`, `--fs-ui` 600, `--r-md`, gap 8 for an optional trailing 20px icon. States per §3.7. Loading state swaps the label for a 16px stroke spinner (the only spinner on the site). On a pastel surface it inverts through the tokens in §3.1. |
| Chip | `.chip` | height 32, `padding: 0 var(--sp-3)`, `--fs-small` 600, `background: var(--chip-bg)`, `color: var(--chip-ink)`, `--r-full`. Not interactive. Pastel on the dark ground; dark on a pastel card. |
| Card | `.card` | `background: var(--bg-raised); border: 1px solid var(--line); border-radius: var(--r-lg); padding: var(--sp-6)` (`--sp-8` ≥1024). `.card--tint` uses `--accent-tint`. |
| Pastel card | `.card--accent` | `data-surface="accent"`, `--r-xl`, no border. Used only for the four stacked cards (§6.3), each with its structured photo tiles. |
| Photo | `.photo` | `<figure>` wrapping `<picture>`; `aspect-ratio` by modifier (`--4x5`, `--3x2`, `--1x1`); `border-radius: var(--r-lg)`; `overflow: hidden`; image `object-fit: cover`; optional `.photo__caption` in `--fs-caption --ink-3` **outside** the image, never overlaid. |
| Orbit | `.orbit` + `.orbit__item` + `.orbit__card` | §6.1. Sixteen items on a ring; per-item keyframes for position and for visibility; `pointer-events: none` on the ring, `auto` on the cards, so hovering a card pauses the ring through `.orbit:hover`; a 44px pause/play control. |
| Stack | `.stack` + `.stack__card` | §6.3. Sticky, full-column pastel cards with a number, an h3, body, and either photo tiles or chips bottom-right; the card beneath the current one recedes. |
| Figures | `.figures` | §5.2. |
| Pile | `.pile` + `.testimonial` | §6.5. Absolutely placed, individually tilted testimonial cards on desktop; a scroll-snap row on mobile. |
| Testimonial | `.testimonial` | A `.card` at `--r-lg`, `padding: var(--sp-7)` (28px — add `--sp-7: 28px` to the scale, it is on the grid), `max-width: 340px`: `.testimonial__quote` (`--fs-lead` 400 `--ink`, typographic “ ”), `.testimonial__who` (32px initials circle in `--accent` · name `--fs-small` 600 · role `--fs-caption --ink-3`). No stars, no logos, no giant quotation glyph. |
| Quote | `.quote` | Centred block, `--fs-h2` at 400, `--measure-h2`, attribution in `--fs-small --ink-3` below with the star. |
| Field | `.field` + `.input` | Input height 48, `--bg-overlay`, hairline, `--r-md`, `--fs-ui` 400, placeholder `--ink-3`. Label is visible text (`--fs-small` 600) or `aria-label` when the placeholder is the label (newsletter). Error state: hairline → `--c-blush` and a `--fs-caption` message below; never red. Success: the button label becomes "Subscribed" with a 16px check that draws in over `--dur-move`. |
| Dialog | `.dialog` | See §7. |
| Nav | `.nav` | See §6.0. |
| Footer | `.footer` | See §6.8. |
| Reveal | `.reveal` (+ `.reveal--stagger` on a parent) | `opacity:0; transform: translateY(12px)` → `is-in` class from an IntersectionObserver at `threshold: 0.2, rootMargin: "0px 0px -10% 0px"`, once. `--dur-reveal --ease-out`, children delayed by `--stagger × index` (cap 6). The hero uses the same class but is triggered on load with `--dur-enter`. |
| Visually hidden | `.sr-only` | The standard clip pattern. |
| Skip link | `.skip` | First focusable element; visible on focus at `--z-skip`. |
| Event (for later) | `.event` | A card with date (`--fs-h3` 600), title, one-line meta and a secondary button. Built on the style guide with placeholder content; not placed on the home page. |

Rules for the style guide page: it uses the same tokens and components (it is a page on the site, at `/styleguide.html`, `noindex`); it shows every colour with its contrast ratio against `--bg` printed next to it (computed at build, not typed); every type role at its 390 and 1440 sizes; every spacing token as a bar; every component in every state; the motion ladder with a "play" button per rung; the star marker, the figure symbol with the figures band, an orbit of four photo cards, one stacked card in each of the five colours with its tile group, and a three-card pile. It has a sticky left index. It is not pretty for its own sake — it is complete.

## 5. Illustration and iconography — build the brand around the logo `[DECIDE]`

### 5.1 What the research found, so you do not repeat it
The improv/SEL education space is saturated with the same pictures. Measured on stock libraries: 8,400+ "lightbulb + puzzle" illustrations on iStock alone; 28,000+ "diversity hands"; 5,000+ "brain + heart" marks. The old Developmental Improvisation brand stacked all three (brain + bulb, hands round a globe, puzzle pieces). The puzzle piece also carries autism-symbol baggage that the community has been moving away from. Peer organisations already own: the jump rope (Playworks), the bundled-shirt ball (Right To Play), the segmented wheel (CASEL), speech bubbles and comic cells (LEGO Education), pirates (Story Pirates), curtains and masks (every theatre). Bendy flat "corporate Memphis" people are now the default AI output and will read as generated.

**Therefore: no brains, no lightbulbs, no puzzle pieces, no globes, no rainbow hands, no wheels, no speech bubbles, no masks, no bendy people, no plants.**

### 5.2 The system: two drawn things, both taken from the logo
The logo already contains the brand's illustration language: a round-headed figure with arms reaching out along the ring; the ring; a four-point star; a round geometric letterform. Outside the logo, exactly two drawn elements exist on the site, and both are lifted from the logo file unchanged.

**The star.** Path 1 of `dilogocolor.svg` (the white four-point sparkle, bbox ≈ 489–548 × 285–352). Extract it to a `<symbol id="star" viewBox="0 0 60 68">`, `fill="currentColor"`. It is the **section marker**: 16px before every section label in the section's `--accent` (Jayden: "instead of the little dot use the brand star"), and the attribution mark under the quote. Nowhere else — not in headings, not as a bullet, not as a decoration. One star per label; the label is the only place it appears in a section.

**The figure.** In `dilogocolor.svg` the eight paths are, in order: 0 the monogram (`#58CDFC`), 1 the star (white), 2 the right figure (`#F0895B`), 3 the left figure (`#FB9BC9`), 4 the top figure (`#E744E2`), 5–7 the three arcs. **Path 4 is the upright figure** (head circle + body + two arms reaching out and down, bbox ≈ 189–603 × −1–206 in the 787×842 viewBox). Extract it, translate it to a 0 0 origin, and save it as `assets/illustrations/figure.svg` as a `<symbol id="figure" viewBox="0 0 414 208">` with `fill="currentColor"` — no redrawing, no smoothing, no "cuter" version, no face, no hands, no feet. This is the "kids holding hands" asset: figures side by side so that each figure's arm tip touches the next one's.

**The figures band** (`.figures`, §6.2): a full-width row of figures alternating the five pastels in a fixed order (lavender, sky, mint, butter, blush, repeat), arms touching (the figure is ≈2:1, so each takes ~128px of width at 64px tall), 64px tall on mobile and 88px on desktop, standing on the column hairline. As many as fit the viewport; `overflow: hidden`; centred so the row is symmetric. Each figure bobs `translateY(-2px → 0)` on `--dur-bob --ease-in-out` alternate with delay `index × 120ms`, so a wave travels along the row — under 3px of movement, always. It has a 44px pause/play control at the band's right edge (`aria-pressed`, `--ink-2`, no ground until hover): the bob runs longer than five seconds, so WCAG 2.2.2 requires one, and `prefers-reduced-motion` does not replace it. Reduced motion: a still row. This is the whole "vectors of kids holding hands moving" ask, executed once.

### 5.3 Recorded for later pages, not built in v1
Two compositions were designed and are worth keeping for the About page. They are **not** on the home page and are **not** built now (Jayden: "don't make assets you don't need"):
- **Yes, and** — a circle and a rounded square in one accent slide together 24px on reveal; the overlap fills solid on contact. Accept the offer, add to it, make a third thing.
- **Grid to circle** — 20 dots in a 5×4 grid (the classroom) travel, on reveal, to their positions on a ring (the warm-up circle). The desks are pushed back and the class becomes a circle.
Both are one-shot, `--ease-settle`, static under reduced motion.

### 5.4 Icons
One pack, one weight, one size. Icons are for function only. No icons in headings, no icon grids of "benefits", no icon next to every paragraph.

- **Pack:** §12.3 names it; inline the glyphs you use (eight, listed there) as an SVG sprite (`assets/icons.svg`, `<use href="#i-close">`). Do not load an icon font or the whole pack.
- **Size:** 20px inside buttons and inputs, 24px standalone, always in a 44px hit area when interactive. Stroke width as the pack ships it — never restyled.
- **Colour:** `currentColor`. Icons are `--ink-2` at rest and `--ink` on hover, exactly like the text next to them. A social icon does not turn its brand colour on hover; it turns white.
- **No social glyphs.** The footer links to the social profiles with words, like Jayden's portfolio footer does.

## 6. The home page, section by section `[DECIDE]`

Order is fixed: nav · hero arch · figures band · the stack · quote · testimonial pile · newsletter · contact · footer. Every section is a `<section>` with an `id` (the nav's Gallery and Contact links anchor to `#gallery` — the hero arch, for now — and `#contact`), a `data-accent` in the rotation, the column hairline at its top (§3.3), and a left-aligned `.section__head` with the star unless noted. Vertical rhythm is `--section-y` everywhere.

### 6.0 Nav (`.nav`)
- Fixed, `--nav-h` 64, full width, transparent at the top of the page. After 24px of scroll it gets `--glass` + `backdrop-filter: blur(20px) saturate(140%)` and a bottom hairline, over `--dur-state`. No shrink.
- Left, inside one 44px-tall link to `/`: the **full white mark** (`dilogo.svg`, the ring with figures, 28px tall) and, `--sp-3` after it, the wordmark **Developmental Improvisation** set in the type at 15px 600 `--ink`, `letter-spacing: -0.01em`. Always visible. (v2 hid the mark and the corner read as empty; v3's monogram was rejected as "the simpler logo"; the four options were rendered side by side and this one was chosen.) On ≤767px the wordmark hides and the mark stands alone.
- Right: Home · Gallery · Contact as `--fs-small` 600 `--ink-2`, current page `--ink`, 44px tall targets, `--sp-6` apart; then **Subscribe** (the old site's button label) as `.btn--secondary.btn--compact` (44px) that opens the popup. On ≤767px the three links collapse into a `.btn--ghost` "Menu" that opens a full-height sheet from the right (`--dur-move --ease-settle`, scrim, Esc closes, focus trapped) listing the three links at `--fs-h3` and the Subscribe button. No hamburger icon; the label reads Menu / Close.
- Hover on a link: colour to `--ink` over `--dur-state`. No underline in the nav. Current page: 600 and `--ink`, nothing else.
- The nav never casts a shadow and never has a solid ground at the top of the page.

### 6.1 Hero (`#top`, `.orbit`) — the arch
The reference is Jayden's pin: rounded photo cards on an arch around centred copy, rotating slowly, stopping when you hover a photo. Jayden's rulings across four rounds: photographs only in the arch, **every card upright**, no frames, no colour cards, a clean structured arc. The v5 geometry was mocked with the real photographs and hit-tested at six viewports; use these numbers.

**Geometry (desktop, ≥768px).** Everything derives from the hero's height and the viewport's width:
```css
.orbit { --hero-h: clamp(640px, 100svh, 960px);                 /* the hero's height; 100vh alone breaks at 1920×1080 where the hero caps at 960 */
         --r:  min(48vw, calc((var(--hero-h) - 88px) / 1.19)); /* ring radius: 682 at 1440×900, 531 at 1280×720, 492 at 1024×768, 640 at 1512×850, 733 at 1920×1080 */
         --cw: calc(var(--r) * .26);                            /* card width, 4:5 → 177×222 at 1440×900. At .3 the cards overlapped each other at the sides */
         --cx: 50%; --cy: var(--hero-h);                        /* the ring's centre is ON the fold: the arch is a true half-circle and its bottom cards are cut by the edge, not faded mid-air */
         --n: 16; }
```
- **Sixteen slots, 22.5° apart, every card upright.** Slot `i` sits at `θ = i × 22.5° + φ` (`φ` the rotation) at `(cx + r·sin θ, cy − r·cos θ)` with **no tilt**: `transform: rotate(θ) translateY(calc(-1 * var(--r))) rotate(calc(-1 * θ))` — the counter-rotation cancels the orbit rotation exactly, so the card keeps its edges parallel to the viewport while it travels. (Tilted versions at 40° and 18° were both rejected: "all the photos should be turned right… upright and in a clean arch".) The arc step is `2πr/16 ≈ 0.39r`; the card height is `0.325r`, so adjacent cards at the sides keep a gap of ~0.07r (46px at 1440).
- **Visibility.** Fully visible while `|θ| ≤ 82°`, fading to 0 by `92°` (opacity keyframes), invisible around the bottom. With the centre on the fold the cards at ±90° are already half below the edge; the fade only stops a leaving card from lingering at a bottom corner. Reduced motion: frame 0, same visibility.
- **Rotation.** One revolution per `--dur-orbit` (96s), linear, clockwise. Per-item keyframes (`@keyframes orbit`: `rotate 0→360deg`, `translateY(-r)`, counter-rotate `0→−360deg`; `@keyframes orbit-fade` with the 82°/92° stops as percentages of the cycle), each item `animation-delay: calc(-1 * i / 16 * var(--dur-orbit))`. Only `transform` and `opacity`; `will-change: transform` on the sixteen items and nothing else; `animation-play-state: paused` when `document.hidden`.
- **Hover / touch.** `.orbit { pointer-events: none } .orbit__card { pointer-events: auto } .orbit:hover .orbit__item { animation-play-state: paused }` — hovering any card pauses the whole ring. The hovered card scales `1.04` inside its item over `--dur-move --ease-out` and its hairline goes to `--line-strong`. Nothing else happens. On touch, a tap pauses for 4s. A 44px pause/play control sits at the hero's bottom-right (`aria-pressed`, `pause`/`play` icons, `--ink-2`, no ground until hover): WCAG 2.2.2.
- **One card type.** A `.photo--4x5` at `--r-lg` with a hairline. Nothing on it, nothing around it.
- **The sixteen photographs, one per slot, none repeated.** Reading clockwise from the top at φ = 0, chosen so colour and B&W alternate and no two group shots sit side by side: **2 · G9 · 7 · G12 · 3 · G1 · 1 · G4 · 6 · G7 · 5 · G8 · 12 · G5 · 4 · G3** (originals by number from §11, gallery photographs by G-number from §11.2, crops as given there). Photo 12 (the 2011 boy) stays for now because it is the only non-gallery child photo; it is the first to go when Linda sends more.
- **The copy block** is centred horizontally and **anchored to the ring's inner edge**: `top: calc(var(--cy) − var(--r) * .81 + 24px)` (the top card's inner edge is at `cy − r + 0.19r`). Inside: the colour logo (`dilogocolor.svg`) at `min(140px, calc(var(--hero-h) * .155), 10vw)`; `--sp-6` below, the `h1` (visually hidden "Developmental Improvisation" + the visible tagline in `display` at `clamp(2rem, min(3.6vw, calc(var(--hero-h) * .054)), 3rem)` with `max-width: var(--measure-display)` on the h1 itself); `--sp-3` below, the sub-tagline in `lead --ink-2`, `max-width: var(--measure-sub)`; `--sp-7` below, primary **Sign Up for our Newsletter!** and secondary **Contact** side by side. Bottom margin under the buttons: 97px at 1440×900, 30 at 1280×720, 14 at 1024×768 (the one tight case — the arch is width-limited there; accept it).
- **Mobile (≤767px).** The arch becomes a fan across the top and the copy sits below it: `--r: 300px; --cw: 76px; --cy: 447px`, fully visible while `|θ| ≤ 50°`, gone by `62°` (five cards showing); the copy block starts at `top: 350px` (logo 72px, display `2rem`, buttons stacked full-width to 320px). 105px under the buttons at 390×844.
- **Measured on the mock, and the `orbit` gate in §14 repeats it:** across a full 22.5° step in 1° increments at 1440×900, 1512×850, 1280×720, 1024×768, 1920×1080 and 390×844 — every visible card's computed rotation is 0°; zero card pixels under any text line, the logo or a button; zero card pixels painted over another card's centre region; zero photographs visible twice; the topmost card ≥ 88px from the viewport top.
- **First paint:** the logo `scale(.96) → 1` and fades over `--dur-enter --ease-out`; then h1, sub, buttons with `--stagger`; then the ring fades in over `--dur-enter`, already turning. Under 900ms, once per session. Nothing else animates on load.
- **Nothing else.** No gradient, no ground behind the ring, no scroll indicator, no decorative shapes, no colour.

### 6.2 Figures band (`.figures`)
§5.2. Directly under the hero, `--section-y-tight` above and below, standing on the column hairline. No text.

### 6.3 The stack (`#welcome`, `.stack`) — four pastel cards that stack as you scroll
From the Brand Appart video: full-width coloured cards, each a chapter, each sticking under the nav while the next slides up over it and the one beneath recedes. Here the chapters are the old site's six paragraphs, in order, on the brand's pastels.

- Section head: star + label **Welcome** (left, above the stack, not on a card).
- Four `.stack__card` elements, each `.card--accent` (`data-surface="accent"`), `--r-xl`, `padding: var(--sp-12)` (`--sp-8` on mobile), `min-height: 520px` desktop, a 7/5 inner grid. Top-left: the h3 (`--fs-h2` size, 600, `--measure-h2`); top-right: the chapter number in `--fs-small` 600 `--ink-3`, written `(01)`; below the h3: the copy in `body`, `--measure-body`; below the copy, chips or the button where the table says so. **Right column, bottom-aligned: the photo tiles** — this is where the "colour cards with structured photos in them" live (Jayden: "I meant for the cards further down the page"). A tile group is two `.photo` tiles side by side, each 4:5, `--r-lg`, equal widths filling the right column with `--grid-gap` between them (about 150px each at 1440), bottom edges on one line, captions in `--fs-caption` at `--ink-3` beneath only where a name is known. Never one huge photo, never three sizes, never a collage. All ink is `#181818` through the surface tokens.

| # | Accent | h3 (from the copy) | Body | Below the copy | Tiles (right column) |
|---|---|---|---|---|---|
| (01) | lavender | **Welcome to Developmental Improvisation** | paragraphs 1 and 2 | — | **G2** (Linda leading five children in a circle) · **G6** (a workshop group with Linda on the screen) |
| (02) | sky | **Safe, educational, and thrilling exercises and games** (a phrase from paragraph 3, sentence case) | paragraph 3 | — | **G11** (children dancing in the bright studio) · **G10** (children running) |
| (03) | mint | **"What would you do?"** | paragraph 4 | chips **critical thinking · creative problem-solving · cooperation · communication** (dark chips on the pastel) | **G13** (the whole cast posing on the set) · **G3** cropped tight on the meeting hands (a second crop of the arch's G3 is the page's one deliberate repeat, a full screen apart) |
| (04) | butter | **The end result** (the opening words of paragraph 5) | paragraphs 5 and 6 | the primary button **Sign Up for our Newsletter!** (inverted: dark on the pastel), which opens the popup | **G12** cropped to the boy in the middle · **G4** cropped to the small boy with the red bow tie |

- **Stacking.** Each card is `position: sticky; top: calc(var(--nav-h) + var(--sp-6))`; cards are `--sp-6` apart in flow, and the section's height is the sum of the cards so the last one scrolls away normally. The card beneath the current one recedes: `transform: perspective(1200px) rotateX(6deg) scale(.96); transform-origin: 50% 100%` with `opacity: .9`, over `--dur-move --ease-out`. Drive it with a two-state class from an IntersectionObserver on the *next* card (when the next card's top crosses the sticky line, the current one gets `is-under`); where `animation-timeline: view()` is supported you may use it as an enhancement for a continuous version, but the class version must work everywhere and is the one the gate tests. Reduced motion: no transform, no perspective, cards simply stack.
- **Mobile.** Same sticky stack, one column inside the card, `min-height: auto`, the two tiles side by side below the copy at 3:2 each.
- **Contrast.** `#181818` on every pastel is ≥ 13:1; `rgba(24,24,24,.72)` is ≥ 7:1. The `contrast` gate checks it from the DOM.

### 6.4 Quote (`.quote`, accent blush)
Centred, the one centred head after the hero: **"Creativity in motion creates knowledge!"** at `--fs-h2` 400, `--measure-h2`; attribution **Linda Kellogg Fulton** in `--fs-small --ink-3` with the star before it. Nothing else. Reveal.

### 6.5 Testimonials (`#testimonials`, `.pile`, accent lavender)
From the video's "trusted by" section: cards tossed onto the table, each at its own slight angle, overlapping a little. Fun comes from the tilt and the drop, not from stars or colour.

- Section head: star + label **Testimonials**; no h2 (no copy exists).
- Desktop: a `.pile` region 560px tall on the column; five `.testimonial` cards (§4) absolutely positioned at fixed offsets and rotations — write them as data, not magic numbers: `--x, --y, --rot` per card, rotations between −6° and +6°, no two adjacent cards with the same sign, overlaps of at most 40px, the layout in the mock (`stack-mock.jpg`) is the target. Ground `--bg-raised`, hairline, no shadow (the tilt does the lifting).
- Content: the three placeholder lengths from §10.4 plus two more at ~120 and ~70 characters, each `data-placeholder="true"`; initials circles rotate through the five pastels. No ratings, no logos, no "Contact sales" pills.
- Drop-in: on reveal each card comes from `translateY(-40px) rotate(calc(var(--rot) − 4deg))` and `opacity 0` to its resting pose over `--dur-reveal` with `--ease-settle`, staggered `--stagger × index`. Once.
- Hover / focus-within: the card straightens to `rotate(0)` and lifts `scale(1.02)` over `--dur-move --ease-out`; reverses on leave.
- Mobile (≤1023px): the pile becomes a horizontal scroll-snap row (each card 84vw, `--grid-gap`, `scroll-padding-inline: var(--gutter)`, no rotation) with a 5-mark pager beneath in 8px stars (active star `--accent`, others `--ink-3`).
- Reduced motion: cards appear in place, no drop, no straighten.

### 6.6 Newsletter (`#newsletter`, accent sky)
One `.card--tint` on the column, `--r-xl`, `padding: var(--sp-8)` (`--sp-12` ≥1024), a 12-col grid inside it: columns 1–5 the white mark (`dilogo.svg`, 40px) and the h2 **Sign Up for our Newsletter!**; columns 7–12, vertically centred, the form: `.input` (type email, `aria-label="Email"`, placeholder **Email**, `autocomplete="email"`, `required`) and `.btn--primary` **Subscribe** in one row, stacked at ≤479px. Same form component as the popup; one JS handler; states per §4 Field.

### 6.7 Contact (`#contact`, accent mint)
`.section__grid` 5/7. Left: star + label **Contact** → h2 **To Find Out MORE!** → lead **Email or Call Here:**. Right, vertically centred with the h2: two secondary buttons side by side (stacked at ≤479px): **developmentalimprov@gmail.com** (`mailto:`, mail icon) and **(857) 352-3221** (`tel:`, phone icon, tabular numerals). The old site is indexed with (877) 352-3221 in one place and (857) in another — ship (857) as captured and list the discrepancy in §15.

### 6.8 Footer (`.footer`) — built like Jayden's portfolio footer
Column hairline on top, `padding: var(--sp-16) 0 var(--sp-12)`, `--bg`. ≥1024: a 12-col grid — columns 1–6: the white mark (`dilogo.svg`) at 28px, then `--sp-5` below it **Pre-wiring the brain & educating the heart** at `--fs-lead` 600 `--ink`, then `--sp-2` below **© 2026 Developmental Improvisation** in `--fs-caption --ink-3`. Columns 7–9: heading **Menu** (`--fs-small` 600 `--ink`, `--sp-5` below it) then **Home · Gallery · Contact** stacked as `--fs-small --ink-2` links, `--sp-4` apart, 44px targets. Columns 10–12: heading **Contact**, then **Email** (`mailto:`), **Call** (`tel:`), **LinkedIn**, **Instagram**, **Facebook**, **X** — the last four to `#` until Linda supplies URLs (§15). Link hover: `--ink` over `--dur-state`, no underline (his footer has none). Mobile: stacked, left-aligned, the two link columns side by side. No second hairline, no social glyphs, no newsletter form, no gradient, no illustration, no "made with".

### 6.9 Things that are not on this page
No stats row, no logo wall, no "as seen in", no FAQ, no pricing, no map, no chat widget, no cookie banner (no cookies are set; `localStorage` for popup state is not a cookie and needs no banner), no back-to-top button, no scroll progress bar, no cursor effects, no particles, no marquee, no bento, no gradient, no star ratings, no gallery grid (the arch is the gallery until the Gallery page exists).

### 6.10 Photo allocation
| Photographs | Where |
|---|---|
| 2, G9, 7, G12, 3, G1, 1, G4, 6, G7, 5, G8, 12, G5, 4, G3 | The arch, one per slot in that order (§6.1) |
| G2, G6 · G11, G10 · G13, G3 (tight crop) · G12, G4 (tight crops) | The four stacked cards' tile pairs (§6.3); G3, G12 and G4 reappear here in different crops, a full screen from the arch |
| 8 | Not on the page |
| 9, 10, 11 | Not on the page (letters; permission needed) |

## 7. The newsletter popup (`.dialog`)

Same content as §6.6, in a dialog. This is the one interruption on the site, so it has to be polite and it has to be perfect.

- **Element:** a native `<dialog>` with `aria-labelledby` pointing at its h2. On desktop it opens with `showModal()` so focus trapping, Esc and the inert background come from the platform; backdrop click closes it via a JS listener (`closedby="any"` is not in Safari yet). On ≤767px it is **non-modal** — `dialog.show()` (or `popover="auto"`) as a bottom sheet the page can still scroll under, which is the pattern Google's mobile-interstitial guidance allows. Initial focus goes to the h2 (`tabindex="-1"`), not the input, so a screen reader hears the offer before the field. Polyfill nothing.
- **Panel:** `--bg-overlay`, hairline, `--r-xl`, `padding: var(--sp-8)`, `max-width: 440px`, centred on desktop. On ≤767px it is a bottom sheet: full width, `--r-xl` on the top corners only, `max-height: 38vh`, non-modal as above. Contents: close button (44px, top-right, icon `close`, `aria-label="Close"`), the white mark (`dilogo.svg`) at 32px, h2 **Sign Up for our Newsletter!**, the form, and under it one `--fs-caption --ink-3` line — there is no privacy sentence in the copy, so ship none.
- **Open:** scrim fades in over `--dur-state-out`; panel `opacity 0→1` and `transform: scale(.96) → 1` (desktop) or `translateY(24px) → 0` (sheet) over `--dur-enter --ease-out`. `transform-origin` is the centre of the viewport, not the button — it is not anchored to a trigger when it opens on its own. When opened from the nav or hero button it originates from that button's centre.
- **Close:** the reverse path over `--dur-state-out`. Focus returns to the element that had it (native).
- **Trigger, automatic:** when **both** are true — ≥40% scroll depth **and** ≥10s on the page — and never within 2s of a click, never while a form field is focused, never while the mobile menu is open, and only on the home page. (Three 2025–26 datasets agree: immediate popups convert worst, 10–15s or ~40% scroll best.) Once per session (`sessionStorage` guard) and once per visitor: on dismiss set `di:newsletter=dismissed:<ISO date>` in `localStorage` and do not show again for 30 days; on subscribe set `di:newsletter=subscribed` and never show again. If `localStorage` throws (private mode), fall back to `sessionStorage`, then to a page variable.
- **Trigger, manual:** the nav Subscribe button and the hero primary button always open it regardless of storage.
- **Submission:** the `<form>` posts to a placeholder `action` (`[NEWSLETTER_ACTION_URL]`) with `method="post"`; JS intercepts, validates the email with the platform's `checkValidity()`, shows the loading state, `fetch`es, and on success swaps to the success state; on network failure it shows the error state and leaves the value in the field. The provider is Jayden's choice later (§12.4); the markup must work with Buttondown's, Mailchimp's and Kit's embed endpoints by changing `action` and the input `name` only.
- **Never:** a countdown, a "no thanks, I don't want to learn" dismiss link, a discount, an image, a second field, or opening on `beforeunload`.

## 8. What the research found on the sites that do colour professionally

Verified against token files and third-party extractions of Material 3, Spotify, Linear, Figma, Notion, Framer, Raycast, Superhuman, Sentry, Pinterest, Apple, Slack, Headspace and Duolingo (live CSS of most marketing sites could not be read from this session; treat numbers as reference, not gospel). The rules below are what the system in §3 is built on. They are here so you understand *why* the tokens are what they are, and so you do not "improve" them.

1. **Depth is a tone ladder plus a hairline; nothing casts a shadow.** Spotify `#121212 → #181818 → #1f1f1f`; Linear `#010102 → #0f1011 → #141516`; Material dark surfaces at tones 6/10/12/17/22. Hairline `rgba(255,255,255,.08)` (Raycast). → `--bg / --bg-raised / --bg-overlay / --line`.
2. **Body text is white or grey, never a pastel.** Sentry: "don't put lime text at body size"; Notion: "don't use purple for body text"; Duolingo: green is "not body or link text"; Figma: "don't introduce mid-gray text — weight carries hierarchy". → `--ink / --ink-2 / --ink-3` and nothing else for text.
3. **Pastel at 100% only on small foreground shapes; a large pastel surface is a dark tint.** Material's dark scheme: primary is tone 80 (`#d0bcff`, a lavender pastel) for small foreground, primary-container is tone 30 for large surfaces. → `--c-*` for chips and stars, `--t-*` for the newsletter card; the full-strength pastel cards in §6.1 and §6.3 are the deliberate, rationed exception. The five brand pastels are within a few hex digits of Notion's feature tints and Figma's story blocks — both use them as large surfaces *on white*. On `#181818` the model inverts; do not port "Notion pastels" onto a dark ground.
4. **One colour block per viewport, hero excepted.** Figma: "don't combine more than one color block visible inside a single viewport"; Framer: gradient cards "one or two per long page; three is a moodboard"; Raycast: the stripe gradient "exactly once per page". → the section accent rotation in §3.1, and the stack shows one full pastel card at a time with the previous one receding under it.
5. **Gradients are rationed to zero or one, and the strictest systems ship none.** Linear rejects gradients entirely; Supabase forbids atmospheric hero gradients; Raycast allows exactly one stripe per page; Framer confines them to cards. This site is at the Linear end: none (§3.4). The photographs are the colour fields.
6. **Photos carry the colour; chrome near them is grey.** Pinterest: 8px gutters, zero card padding, no card shadows, chrome "gets out of the photograph's way"; Airbnb: 14px radius, "trust photography and generous whitespace over typographic muscle". → no overlays, no tints, no gradients on or near photographs.
7. **One CTA treatment site-wide, and text on a pastel is dark.** Raycast and Framer: a white pill for every primary CTA on dark; Spotify: black text on green. → `.btn--primary` is white with `--ink-on-accent`; chips are pastel with `--ink-on-accent`.
8. **Two weights, tracking scales with size.** Notion `-2px at 80 / -1 at 56 / -0.5 at 48 / 0 at body`; Figma `-0.02em`; Linear `-3px at 80`. Display weight is lighter than instinct on most of these sites (Figma 340, Miro 500, Google display is regular). → the tracking column in §3.2. `[DECIDE]` the display role ships at 600; if the hero tagline feels heavy at 64px, the sanctioned alternative is 400 for `display` only, not a new weight.
9. **Radius by size class.** Cards 12–20, big blocks 24–32 (Figma 24, Material 28, Pinterest 32); buttons are one shape site-wide. → `--r-xl 28 / --r-lg 20 / --r-md 14 / --r-full`, Jayden's own ladder, inside the observed range.
10. **96px between sections at desktop, 1200–1280 max width.** Linear, Figma, Notion, Framer, Raycast, Sentry, Warp, Miro all at 96; photo-dense sites (Airbnb, Pinterest) at 64. → `--section-y` lands on 96 at 1440 and `--section-y-tight` on ~53 for photo bands.

**The kids'-brand trap, stated once:** playfulness is spent in the mark, the photographs and one or two micro-interactions — never in the chrome. Duolingo's entire playful chrome is a 4px ledge under its buttons; Headspace's is one breathing circle; everything else in those systems is as strict as Linear. Here the budget is: the logo, the photographs, the turning arch, the four stacked cards, the figures band's bob, and the testimonial pile's tilt. That is the whole allowance — and it is already generous, which is why everything else on the page is grey, flat, left-aligned and on the grid.

**Motion values that were actually verifiable:** Material `short 50–200ms`, `medium 250–400ms`, `long 450–600ms`, `emphasized-decelerate cubic-bezier(0.05, 0.7, 0.1, 1)` for things entering; Apple press `scale(0.95)` on `:active`; Headspace tap `scale(0.98)`, canvas cross-fade 600ms, breathing sphere 4s `scale 1 → 1.04` with no spring; Slack spring 250ms at damping 0.8; Duolingo's press 80ms linear. The ladder in §3.6 sits inside these.

## 9. The micro-interaction inventory — all of them, and no others

Twelve. Each has a trigger, a property, a duration and a reason. If you want a thirteenth, you have to name what it is *for* and remove one.

| # | Where | Trigger | What moves | Duration / easing | Reason |
|---|---|---|---|---|---|
| 1 | Hero | page load, once per session | logo `scale .96→1` + opacity; then tagline, sub, buttons with `--stagger`; then the ring fades in already turning | `--dur-enter --ease-out` | Continuity — the page arrives in reading order, it does not pop |
| 2 | Hero arch | always; pause on hover, touch, the control | sixteen upright photo cards orbit, cut by the fold, fading only at the two bottom corners | `--dur-orbit` linear | The reference: photographs turning around the mark |
| 3 | Hero arch card | hover / focus | the card `scale(1.04)`, hairline `.08 → .16`, and the ring stops | `--dur-move --ease-out` | "The photos stopping if you hover over it" |
| 4 | Nav | scroll > 24px | ground → `--glass`, hairline fades in | `--dur-state` | Wayfinding — the bar becomes a surface only when there is something under it |
| 5 | Nav links, footer links | hover / focus | colour `--ink-2 → --ink` | `--dur-state` in, `--dur-state-out` out | Feedback |
| 6 | Buttons | `:active` | `scale(.97)` | `--dur-press` | Feedback on pointer-down (Apple §1) |
| 7 | Buttons | hover | primary ground lightens (or darkens on a pastel); secondary hairline `.08 → .16` | `--dur-state` | Feedback |
| 8 | All sections below the hero | 20% visible, once | `.reveal`: opacity 0→1, `translateY(12px → 0)`, children staggered ≤6 | `--dur-reveal --ease-out`, `--stagger` | Continuity — content arrives in reading order |
| 9 | Figures band | always; pause control | each figure bobs 2px, a wave along the row | `--dur-bob --ease-in-out` alternate, delay `i × 120ms` | The brand's one "kids holding hands, moving" |
| 10 | The stack | the next card reaches the sticky line | the card beneath recedes `rotateX(6deg) scale(.96)`, opacity `.9` | `--dur-move --ease-out` | Depth without shadow — the chapters are a deck |
| 11 | Testimonial pile | reveal; hover / focus | drop-in from `−40px` and `−4°` to the resting tilt, staggered; on hover the card straightens to `0°` and lifts `1.02` | `--dur-reveal --ease-settle`; `--dur-move --ease-out` | The "fun" testimonials: tossed on the table, picked up to read |
| 12 | Popup, menu sheet, form | open / close; submit | scrim fade; popup `scale .96→1` (desktop) / `translateY(24px → 0)` (sheet); menu sheet `translateX(100% → 0)`; on success the button label swaps and a 16px check draws on; error hairline → `--c-blush` | `--dur-enter --ease-out` in, `--dur-state-out` out; `--dur-move` | Spatial consistency (Apple §7); completion feedback |

Under `prefers-reduced-motion`: 2 and 9 hold their first frame; 1, 8, 10, 11, 12 become opacity-only at the reduced `--dur-reveal`/`--dur-enter`; 3–7 keep their colour changes and drop their transforms.

**Not in the inventory, therefore not on the site:** parallax, scroll-scrubbed text, marquees, magnetic buttons, cursor followers, text scramble or split-letter reveals, counters, typewriters, hover tilt on anything but the pile, hover glow, ripple, skeleton shimmer, confetti, logo spin, star "ping", bouncing arrows, gradient drift, and any animation on the quote.

## 10. Copy — the only words allowed on the page

Everything below was transcribed from the old site. Use it verbatim, including "Sign Up for our Newsletter!" with its exclamation mark. You may change **case** to sentence case for headings and **may not** change words, order, or punctuation inside a sentence. You may use a single word or phrase from a sentence as a label (e.g. "Cooperation", "What would you do?"). You may not write new sentences.

### 10.1 Identity
- Brand name: **Developmental Improvisation** (the logo reads "di")
- Founder: **Linda Kellogg Fulton**, "educator"
- Tagline: **New Tools for Cognitive Development & Emotional Understanding**
- Sub-tagline: **Pre-wiring the brain & educating the heart** (the old site set this in uppercase; set it in sentence case)
- Signature question: **"What would you do?"**
- Quote: **"Creativity in motion creates knowledge!"** — Linda Kellogg Fulton

### 10.2 Body copy (the Welcome section of the old site, six paragraphs, in order)
Heading: **Welcome to Developmental Improvisation**

1. Developmental Improvisation is a new, revolutionary tool for teaching cognitive development and social/emotional understanding using the art of improvisation designed specifically for the classroom.
2. Created by educator Linda Kellogg Fulton, based on her fifty plus years working in improvisation, it offers students a unique, beneficial, and fascinating experience-based exploration into the realm of Social Emotional Learning through imaginative excursions and cooperative play.
3. Developmental Improvisation provides participants an opportunity to experience all the probabilities of human behavior in realistic, authentic situations that come through a variety of safe, educational, and thrilling exercises and games.
4. Developmental Improvisation provides balance to traditional education, offering students a vehicle for enhancing their intellect, cooperation, communication, and other skills by encouraging them to find solutions for any issues. This revolutionary approach to learning allows students to put their critical thinking and creative problem-solving to the test through spontaneously imaginative "What would you do?" situations.
5. The end result is students growing in not just their intellect, but also their compassion and instinct, making for well-rounded individuals who will be prepared for anything life has to offer.
6. All while having as much fun as possible!

Words from this copy that may stand alone as labels or chips: *intellect · cooperation · communication · critical thinking · creative problem-solving · compassion · instinct · cooperative play · imaginative excursions · Social Emotional Learning · safe, educational, and thrilling · What would you do?*

### 10.3 Functional copy
- Navigation: **Home · Gallery · Contact** (these are the old site's pages; keep the labels)
- Newsletter: heading **Sign Up for our Newsletter!**, field placeholder **Email**, button **Subscribe**
- Contact: heading **To Find Out MORE!**, line **Email or Call Here:**, email **developmentalimprov@gmail.com**, phone **(857) 352-3221**
- Social links present on the old footer: Facebook, X, Instagram, LinkedIn (URLs unknown — link to `#` with `aria-label`, and list them in §15 "needs from Linda")
- Footer small print on the old site was unreadable in the capture. Use "© 2026 Developmental Improvisation" and nothing else until confirmed.
- **Stale event** — the old site advertised a LinkedIn Live with Izzy Gesell on June 6th and June 13th ("Social Emotional Learning from the inside out"). It has passed. Do **not** put it on the page. Build the Events component in the style guide with placeholder content so it exists when there is a next event.

### 10.4 Placeholders (exact strings)
Testimonials are placeholder for now. Use these exact strings so they can be found and replaced, and mark each card `data-placeholder="true"`:
- Quote: `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.` (vary length across cards: one at ~90 characters, one at ~160, one at ~220)
- Name: `First Last`
- Role: `Role, Organization` (e.g. the visible text is literally "Role, Organization")
- No avatar photos on placeholders. Use a 40px circle in the card's accent colour with the initials `FL` in `--bg` at 600.

Two handwritten thank-you letters (a paper fan and a postcard, §11 items 9–11) exist in the photo set. They are real testimonials. **Do not transcribe them onto the site** — permission from the authors and from Linda is required first. Note their existence in the BUILD-LOG under "needs from Linda".

### 10.5 Accessibility copy (not visible; required)
- `<title>Developmental Improvisation — New Tools for Cognitive Development & Emotional Understanding</title>`
- `<meta name="description">` = paragraph 1 verbatim.
- The `h1` is "Developmental Improvisation" (visually hidden span) followed by the tagline as visible text, so the hero logo does not leave the page without an h1 that names the brand.
- Every photo gets a factual `alt` describing what is happening ("Participants in a workshop reach their hands toward each other in a circle"). Never "image of", never marketing language.
- The logo `<img>` alt is "Developmental Improvisation". Decorative illustrations get `alt=""` and `aria-hidden="true"`.

### 10.6 Additional sentences indexed from the old site — verify before use
A search index surfaced these as text from developmentalimprovisation.com (the page title is indexed as "Inspiring Growth Through Play - Developmental Improv"). They were not visible in the capture Jayden made, so they are **not** cleared for the home page until someone opens the live site and confirms them. If confirmed, they are the only additional copy allowed, and they are useful:

- "Developmental Improvisation uses play to learn the skills of Improvisation."
- "Learning Social-Emotional Intelligence is fun with Developmental Improvisation."
- "The purpose of Developmental Improvisation is to focus on Social Emotional Learning (SEL) from the inside out while building life skills, unlocking hidden talents, encouraging personal growth, and preparing students for life challenges, rather than performing improv for entertainment."
- "This unique teaching approach both stands alone and supplements educational practices like Common Core and Social and Emotional Learning (SEL)."
- "Linda Kellogg Fulton has spent most of her life learning and observing the effect of teaching Improvisation to kids and adults."
- "Linda Kellogg Fulton is an internationally renowned teacher in the art of improvisation with over fifty years of experience."
- "Linda is the founder of the award-winning Total Improv Kids."

Also indexed, from Linda's earlier business site (totalimprovkids.com) — background for the About page later, **not** for this build: she discovered improvisation at 14 while struggling with dyslexia; was mentored by Avery Schreiber of Second City; founded Total Improv Kids in 1999; directed the first all-kid improv show Off Broadway in 2008; received a Congressional Certificate of Recognition in 2012; spoke at the Applied Improvisation Network conferences in Paris (2018) and Vienna (2019); has a book, *The Power of Developmental Improvisation*, described as upcoming. None of this goes on the page until it is confirmed with her.

## 11. Photo manifest and pipeline

Eleven of the twelve photographs are of adults in workshops; one is of a child. The brand is "mainly kids". Say this in your reply: **the hero will show adults until Linda supplies classroom photos with releases.** Do not compensate with stock or generated imagery.

| # | File | Size / orientation | What it shows | Use |
|---|---|---|---|---|
| 1 | `27096601-DB24-458B-9670-845A4B914EC3.JPG` | 1440×960 landscape, B&W | Three adult participants standing in a row, arms linked, mid-exercise, focused | **Arch, slot 6.** Soft focus — fine at 177px. |
| 2 | `271AA5F7-78F1-4288-A6D2-25E35598A277.JPEG` | 1280×1707 portrait, colour | Bright workshop room, a participant in yellow trousers mid-step and laughing on a foam-mat floor, the group watching | **Arch, slot 0** (the top at φ = 0). Best "creativity in motion" frame. |
| 3 | `3528DF95-C76F-410F-89F0-CD868EA5DB54.JPG` | 960×1440 portrait, colour | A participant in a bucket hat laughing hard, "HELLO my name is" sticker | **Arch, slot 4.** Joy. |
| 4 | `360AC4E9-9695-4879-8C64-5AD5AC1B419A.JPG` | 960×1440 portrait, B&W | Linda (white hair, glasses) mid-laugh, leading a session, participants behind her | **Arch, slot 14.** |
| 5 | `9C752690-2CD5-4F26-BED6-227732891668.JPG` | 960×1440 portrait, colour | Linda on stage with a lapel mic holding a foam baton prop, patterned shirt, teaching | **Arch, slot 10.** |
| 6 | `A0982FD3-7ED2-48E6-81AC-7F83E630ABC4.JPEG` | 1707×1280 landscape, colour | Floor-level group game, a participant in green crawling, hands raised around | **Arch, slot 8.** |
| 7 | `C053CD9C-8A24-41CE-9EC9-BD92E8BB0071.JPG` | 1440×960 landscape, B&W | Participants reaching their hands toward each other in a circle, one smiling at the centre | **Arch, slot 2.** This is the brand's picture: the circle, the hands. |
| 8 | `IMG_0230.JPEG` | 1024×472 landscape, colour | Wide shot of a small conference room, Linda at the front, screen and chairs | Stand-in for the arch only if photo 12 fails at 177px (low resolution, poor light); otherwise not on the home page. |
| 9 | `IMG_1548.HEIC` | 3213×5712 portrait | A handwritten thank-you letter to Linda on a paper fan, page 1 | Source material only. Not for publication without permission. Convert to JPEG and keep in `images/src/letters/`. |
| 10 | `IMG_1549.HEIC` | 3213×5712 portrait | The same letter, page 2 | Same. |
| 11 | `Scan Jun 7, 2026 at 7.10 PM.JPG` | 2090×2946 portrait | A handwritten postcard (China Post) to Linda, signed "Ray 2026" | Same. |
| 12 | `awards4-light.JPEG` | 2592×3872 portrait, colour | A boy in a blue sweater, fist raised, another child behind him, dark stage (2011, Nikon D40X) | Grainy. **Arch, slot 12**, tight crop on the boy — at 177px it held in the mock; if it does not in yours, replace it with G13 cropped to one child and say so. |

### 11.1 The gallery set — crop by looking
Jayden asked for photographs from the old site's gallery (`developmentalimprovisation.com/gallery-2/`) to be used as well, "cropped in an appealing way". They arrive in `images/src/gallery/`, unlisted above. For each one:
- Open it at full size and decide what it is *of* before cropping. If it is of nothing (a room, a table, the backs of heads), leave it out and say so in `MANIFEST.md`.
- **Plain card crop, 4:5.** The subject's face or hands in the upper 60% of the frame; never a face touching the edge; never a crop that cuts a head at the chin or a hand at the wrist. Set `object-position` per photo (the mock uses values like `50% 30%` and `40% 60%`); the crop is part of the manifest.
- **Inset crop, 1:1.** Tighter: one person or one gesture, centred, room around it. A 1:1 crop is not the 4:5 crop with the bottom cut off — choose it separately.
- **Tone.** Do not convert to B&W, do not tint. If a photo is much brighter or busier than the set, it goes in a framed card, where the mat calms it, not a plain one.
- **Children.** A child's face on the page needs a signed release (§15). Until that is confirmed, prefer crops where children are seen from behind or at a distance, and say which photos are waiting on releases.
- **Where they go.** §6.1 and §6.3 assign every one. When Linda sends more, photo 12 goes first, then any arch slot whose photograph is a wide group shot (they read best as stack tiles, not as 177px cards). Update the slot list in `MANIFEST.md`, not by hand in three places.
- Name them by content like the rest (`gallery-circle-warmup`, `gallery-two-hands`), never by the old site's filenames.

### 11.2 The thirteen gallery photographs, with crops
Jayden sent these from the old site's gallery. Numbers are in the order they arrived; the crops were chosen by looking at each at full size. `object-position` values are the starting point — confirm each at its rendered size. Most show children; the old site published them, but confirm the releases (§15) before launch.

| # | What it shows | Size | Arch crop (4:5) | Tile crop (4:5 / 3:2) |
|---|---|---|---|---|
| G1 | Six teenagers in white shirts and ties bent forward in a line, a conga, on a stage with a green wall | 2000×1328 | Centre-right on the laughing girl with the blue tie and the two beside her, `65% 45%` | — |
| G2 | Linda (plaid shirt, grey hair) with five children in a circle on a black stage, arms out | 690×613, low resolution | — (too small for the arch) | Stack (01): full frame at 3:2, or 4:5 on Linda and the two children to her right, `45% 50%`. Never above 480px wide. |
| G3 | Children in two facing lines reaching their hands across to each other on a stage | 2000×1500 | Centre on the meeting hands, `52% 55%` | Stack (03): a tighter 3:2 on the two central children's hands |
| G4 | Three boys in white shirts and bow ties (orange, red, green) in front of a brick wall with a café sign | 2000×1333 | The small boy with the red bow tie and the tall boy's arm above him, `45% 55%` — **the café sign must be out of frame** (a third party's logo) | Stack (04): tight on the small boy, `48% 60%` |
| G5 | Three teenagers in a scene: a boy in plaid and a bowler hat shaking a skeleton-gloved hand, a girl in black, a girl in yellow | 1536×1152 | The handshake, `30% 45%` | — |
| G6 | A workshop group in a bright studio posing on a green floor under a screen showing Linda on a video call | 2000×1500 | — (a wide story picture) | Stack (01): 3:2 centred so the screen and the front row both show, `50% 55%` |
| G7 | Three teenagers in white shirts and ties on a grey set, mid-scene, one with a yellow tie reaching, one with a blue tie, one pushing | 1536×1024 | The boy with the blue tie and the girl pushing, `55% 45%` | — |
| G8 | Two children seated on folding chairs (a red bow tie, a pink bow tie) and a girl with a blue bow tie crouching towards them | 1536×1266 | The two seated children, `22% 50%` | — |
| G9 | Three young men in white shirts and ties in close conversation, one with a hand on his chest | 2000×1328 | The middle one, hand on chest, `50% 40%` | — |
| G10 | Children running and jumping across a bright studio with a Christmas tree | 1129×750 | — (wide, small) | Stack (02): 3:2 on the centre four, `50% 50%` |
| G11 | Children dancing in the same studio in front of a wall sign, one mid-spin | 1536×1024 | — (wide) | Stack (02): 3:2 on the centre five, `50% 50%`, the wall lettering cropped as far as possible |
| G12 | Three children in blue "Total Improv" T-shirts dancing on a black stage | 1536×1310 | The curly-haired boy in the middle, `40% 50%` | Stack (04): tight on the same boy, `38% 45%` |
| G13 | Ten children posing together on a stage set, arms out | 1536×1450 | — (a group) | Stack (03): 4:5 on the centre of the group, `50% 55%` |

**Colour and black-and-white.** Four of the usable photos are B&W. Do not convert colour photos to B&W to match, and do not tint B&W photos. On the dark ground the mix reads as editorial; in the arch no two B&W photographs are adjacent and no two wide group shots are adjacent (the slot order in §6.1 is set that way).

**Pipeline** (`tools/build-images.mjs`, run with Node + `sharp`):
- Read `images/src/`, apply EXIF orientation, strip metadata.
- Emit AVIF and WebP at widths 320, 480, 960, 1440 (never upscale beyond source), plus a JPEG fallback at 960. Quality: AVIF 55, WebP 78, JPEG 82.
- Emit a 24px-wide blurred WebP placeholder for each, inlined as a `data:` URI background on the `<picture>` wrapper, so nothing pops in.
- Name outputs by content, not by the source's UUID: `hero-01-yellow-trousers`, `hero-02-laugh`, `circle-hands`, `linda-laughing`, `linda-stage`, `floor-game`, `row-linked-arms`, `boy-fist`. Record the mapping in `images/MANIFEST.md`.
- Every `<img>` has explicit `width`/`height`, `loading="lazy"` except the arch photos, `decoding="async"`, and `sizes`. The arch photos are served at 480 wide at most — they render at 177px or less.
- Target: the home page's images total under 900 KB on first paint at 1440 wide and under 500 KB at 390 wide. Measure with the network panel and report the number.

## 12. Stack, hosting, forms, icons, fonts — the technical decisions `[DECIDE]`

### 12.1 Plain HTML/CSS/JS, not Next.js (and not yet Astro)
Jayden asked whether this should be Next.js. Researched against the npm registry and the framework docs on 2026-09-05:

| | Plain HTML/CSS/JS | Astro 7 | Next.js 16 (static export) |
|---|---|---|---|
| Setup | Hours; the way Jayden already works | ~1 day (image + content collections) | 1–2 days; App Router, export config, image-loader workaround |
| Performance | 100/100 by default, ~0 KB framework JS | 95–100, 0–5 KB JS | 80–95 on mobile; ≥80 KB hydration JS even for a static page |
| Maintenance over 3–5 years | Zero runtime deps; `sharp` in a dev script | One major every 6–12 months (v6 Mar 2026, v7 Jun 2026) | One breaking major a year (14 → 15 → 16), recurring critical CVEs (a CVSS 9.1 middleware bypass in 2025, two Criticals patched Aug 2026), 185 MB dependency tree |
| Images | One `sharp` script → AVIF/WebP/JPEG `<picture>` | `<Picture>` runs `sharp` at build | **`next/image` does not work in static export** — you need `unoptimized` or a paid loader, i.e. you lose the one thing you would adopt Next for on a photo site |
| Hosting cost | $0 on Cloudflare Pages or GitHub Pages | $0 | Vercel Hobby is **non-commercial only**, and a marketing site with a newsletter counts as commercial → Pro at $20/mo, or self-host the export anyway |
| Later CMS | Sveltia CMS / Pages CMS editing partials or JSON | Sveltia → content collections; Sanity/Notion loaders | Sanity/Notion first-class, but then you want SSR/ISR and Vercel Pro |
| Bit-rot risk | Lowest — a 2026 HTML file runs in 2031 | Medium — an old lockfile may not install in 2029 | Highest — React, Next, Turbopack and the Node floor all move |

**Decision: plain HTML, CSS and vanilla JS. No framework, no bundler, no build step for the site itself.** The only tooling is a Node script for images (`sharp`) and Playwright for the gates, both dev-only. Cache-bust every CSS and JS link with `?v=<git short sha>` (the CSS is served immutable for a year; a bare link freezes it in every browser that has loaded it).

**When to promote to Astro** (a lift-and-shift of the same HTML): the Gallery passes ~40 images, or Linda needs to edit copy herself (Sveltia CMS on content collections).
**When Next.js becomes right:** a booking or scheduling system with accounts or payments; a blog or course library at 50+ posts with a Notion or Sanity editor and on-demand revalidation; gated or personalised content; or a React team taking it over. None of that is on the roadmap. Say this plainly if anyone reopens the question.

**Progressive enhancement that costs nothing:** native `<dialog>` (Chrome 37 / Firefox 98 / Safari 15.4); `popover` for the mobile sheet (Chrome 114 / Firefox 125 / Safari 17); `inert` on the page behind the menu sheet. Do **not** use scroll-driven animations (`animation-timeline`) or cross-document View Transitions — Firefox still lacks them and nothing here needs them. No GSAP, no Motion, no Lottie: everything in §9 is CSS transitions and keyframes plus ~150 lines of JS.

### 12.2 Hosting and deployment
**Cloudflare Pages** on a custom domain (unlimited static requests and bandwidth on the free plan, no non-commercial clause, 500 builds/month). GitHub Pages is the equal alternative if Jayden prefers one fewer account. If he wants Vercel because his own site is there, it is the Pro plan for a commercial site — his call, note it. Provide `_headers` (Cloudflare) **and** `vercel.json` with the same cache policy so the decision is reversible: HTML `no-cache`; `/fonts/*`, `/images/*`, `/assets/*` `max-age=31536000, immutable`; CSS/JS immutable because their links carry a stamp.

### 12.3 Icons
**Phosphor, Regular weight, 24px box**, inlined as an SVG sprite built from `@phosphor-icons/core` (MIT, 1,512 glyphs, round caps and joins that match Plus Jakarta Sans's terminals). Not the webfont. Glyphs needed on the home page: `x` (close), `arrow-right`, `check`, `envelope-simple`, `phone`, `pause`, `play`, `caret-right` (the mobile pager, if the stars are not enough). That is eight; the sprite contains eight. No social glyphs — the footer uses words. Phosphor's `student`, `hands-clapping`, `users-three` exist for later pages — not for decorating this one.

### 12.4 Newsletter and contact without a backend
- **Newsletter:** Buttondown accepts a plain `<form method="post" action="https://buttondown.com/api/emails/embed-subscribe/USERNAME">` with an `email` field and no JavaScript — free to 100 subscribers. Kit (free to 10,000) has a raw-HTML embed if she will outgrow that. Build the form so switching is `action` + input `name` only. Until Linda picks, `action="[NEWSLETTER_ACTION_URL]"` and the JS handler treats a missing URL as a demo success after 600ms so the states can be reviewed.
- **Contact:** `mailto:` and `tel:` links only in v1 (the copy says "Email or Call Here:"). When the Contact page comes, Web3Forms (free, 250/month, no account) or Formspree.

### 12.5 The typeface, measured
Fourteen candidates were downloaded and measured (x-height, cap-height, average lowercase advance) and eight were rendered on `#181818` with the brand chips, the tagline at 56px/600 and the body at 16px/400, then looked at. Plus Jakarta Sans: x-height 0.536 em (tallest of the warm geometrics), widest lowercase of the friendly set, so 14px holds on dark; its angled `t` and `y` give it identity without novelty. Figtree (x 0.500) is the friendliest that still reads adult, needs body at 15–16px. Onest (x 0.527) is the quietest and dates slowest. Outfit's x-height is 0.460 — the smallest measured — so it goes thin at body sizes on dark; Urbanist reads template; Bricolage is too characterful; Geist and Instrument Sans are Jayden's own portfolio faces and would bleed brands; Nunito reads "kids"; Satoshi and Manrope are default-fatigued. Decision: **Plus Jakarta Sans 400 + 600.** The rendered specimen is in `docs/developmental-improvisation/font-specimen.jpg`.

### 12.6 The newsletter popup, researched
Benchmarks across three 2025–26 datasets agree: an immediate popup converts worst (1.9–4.2%), 6–15 seconds or ~40% scroll converts best (up to 6.5%), exit-intent is middling. Nielsen Norman Group calls modal overlays the most-hated pattern and says asking for an email before the content has been seen reads as spam. Google penalises mobile popups that cover the main content on landing from search or while scrolling, and is fine with banners that use "a reasonable amount of screen space" and are easily dismissed. Native `<dialog>` + `showModal()` gives top-layer, inert background, Esc and focus trapping for free; `closedby="any"` is not yet in Safari, so backdrop-click is a JS listener. Put initial focus on the **heading**, not the input, so a screen reader hears the offer before the field. → §7.

## 13. Deliverables and file structure

```
/
├─ index.html                 the home page
├─ styleguide.html            the living design system (noindex)
├─ css/
│  ├─ tokens.css              §3 — nothing else
│  ├─ base.css                reset, @font-face, body, type roles, .container/.grid/.section, .sr-only, .skip
│  ├─ components.css          §4
│  └─ home.css                only what is unique to index.html (the orbit geometry, the stack, the pile)
├─ js/
│  └─ main.js                 nav state, mobile sheet, reveals, orbit pause/touch, figures pause, stack observer, pile drop, dialog, form — vanilla, ES2020, no bundler, <12 KB unminified
├─ assets/
│  ├─ logo/                   the six SVGs as supplied, plus favicon.svg (the monogram — the only place it is used; the ring is illegible at 16px), icon-192.png, icon-512.png, apple-touch-icon.png
│  ├─ icons.svg               the sprite: only the glyphs used
│  └─ illustrations/          figure.svg and star.svg (the two symbols) — nothing else in v1
├─ fonts/                     PlusJakartaSans-400.woff2, PlusJakartaSans-600.woff2 (latin subset)
├─ images/
│  ├─ src/                    originals (add to .gitignore if the repo is public — they contain identifiable people)
│  ├─ MANIFEST.md             source → output name → where used → alt text
│  └─ *.avif *.webp *.jpg     generated
├─ tools/
│  ├─ build-images.mjs        §11 pipeline (sharp)
│  ├─ subset-fonts.sh         pyftsubset commands used
│  └─ gates/                  §14 — one Playwright script per gate, each with --self-test
├─ docs/
│  ├─ design-system.md        §16.1
│  ├─ design-system.notion.md §16.2
│  ├─ apple-design.md         as supplied
│  └─ BUILD-LOG.md            decisions you made, numbers you measured, §15 needs
├─ _headers                   Cloudflare Pages cache headers (§12.2)
├─ vercel.json                the same cache policy for Vercel, so hosting stays reversible; every CSS/JS link in HTML carries ?v=<git short sha>
├─ robots.txt, sitemap.xml, site.webmanifest
└─ package.json               only devDependencies: sharp, playwright. No runtime dependencies. No framework. No build step for the site itself.
```

Head of every page: charset, viewport, title, description, canonical, `theme-color #181818`, `color-scheme: dark`, Open Graph (title, description, `og:image` = a 1200×630 export of the colour logo on `--bg`, generated by a tool script, not hand-made), preload for both fonts, the CSS links with stamps, and `<script defer>` for `main.js`. No analytics in v1.

## 14. Gates — prove it before you say it is done

Write each as a script in `tools/gates/` that exits non-zero on failure and has a `--self-test` flag that injects the defect and proves the gate catches it. Run them serially. Report the numbers in your reply, not "all green".

| Gate | Passes when |
|---|---|
| `targets` | Every `a, button, input, [role=button]` has a bounding box ≥ 44×44 at 1440, 1024, 390 and 320, except `p a`. Print the smallest. |
| `contrast` | Every text node's computed colour against its effective background ≥ 4.5:1 (≥ 3:1 for text ≥ 24px), **including every text node inside the four pastel stack cards**. Computed from the DOM, not from the token table. |
| `tokens` | No stylesheet other than `tokens.css` contains a hex colour, an `rgb(`, a `px` font-size, a `ms`/`s` duration or a `border-radius` value that is not a `var()`; **no stylesheet contains `-gradient(`**. |
| `type` | Only `font-weight: 400` and `600` occur in computed styles; `font-style` is never `italic`; exactly one `font-family` is used for text. |
| `layout` | At each viewport: no horizontal overflow (`document.documentElement.scrollWidth === innerWidth`); the hero tagline wraps to 3 lines at every desktop viewport and ≤4 at 390; every `.container` inner edge and every section hairline lands on the column (1440: 120 → 1320); the four stack cards have identical widths; the stack's sticky top equals `--nav-h + --sp-6`. |
| `orbit` | At 1440×900, 1512×850, 1280×720, 1024×768, 1920×1080 and 390×844, stepping the rotation 0…22° in 1° steps: (a) every visible card's computed rotation (from its `DOMMatrix`) is 0° ± 0.5°; (b) for every text line box (`Range.getClientRects()` on the h1 and sub), the logo box and each button box, sample points every 6px and `document.elementsFromPoint` — **zero** points where an `.orbit__card` with opacity > 0 is painted; (c) for every visible card, sample the central 60% of its box every 8px — **zero** points where the topmost card is a different card; (d) **zero** angles at which the same photograph is visible twice; (e) the topmost visible card's top ≥ 88px; (f) no card intersects the nav's box; (g) hovering a card sets every item's `animation-play-state` to `paused` and leaving resumes it; the pause control does the same. `--self-test`: set `--cw` to `.3` and expect (c) to fail at 1440×900; drop the counter-rotation and expect (a) to fail. |
| `stack` | Scrolling to each card's sticky position leaves the previous card with `is-under` and a computed transform that is not `none`; the last card scrolls off normally; with reduced motion no card has a transform. |
| `motion` | With `prefers-reduced-motion: reduce` emulated: no element has a running animation after 300ms (`document.getAnimations().length === 0`); reveals still reach `opacity: 1`; the arch is drawn at frame 0. Without it: an arch item's transform and a figure's transform each differ between two frames 800ms apart; each pause control stops its own region. |
| `perf` | Lighthouse (mobile preset, throttled) ≥ 95 performance, 100 accessibility, ≥ 95 best practices, 100 SEO. CLS = 0. LCP < 2.0s. Total transfer on first load < 1.2 MB at 1440, < 700 KB at 390. Print all six numbers. |
| `dialog` | The popup does not open at 100% scroll before 10s, and does not open at 10s with under 40% scroll; it opens once both hold; Esc closes it and returns focus to the opener; after dismiss a reload does not reopen it; the nav button still opens it; at 390 it opens non-modal and the page still scrolls; the email input rejects `not-an-email` without a network call. |
| `copy` | Every visible text node on `index.html` is a substring of §10 or one of the §10.4 placeholder strings, ignoring case and whitespace. This is the gate that keeps the page honest. |
| `images` | Every `<img>` has `width`, `height`, non-empty `alt` (or `alt=""` with `aria-hidden`), and a `srcset`; no image is served wider than 1.5× its rendered width at 1440; no photograph appears twice on the page; every `src/` photo appears in `MANIFEST.md` with a use or a "not used" reason. |
| `a11y` | axe-core: zero violations. Tab order follows reading order; the skip link is first; the mobile sheet traps focus; every section has a heading or `aria-label`. |
| `html` | `html-validate` passes; one `h1`; no empty links; no `onclick`. |
| `screens` | Full-page PNGs at the four viewports plus the popup open, the mobile sheet open, and reduced-motion, saved to `docs/screens/`. **Open them and look.** In your reply, name one thing you changed *because* of looking. |

## 15. Needs from Linda (put these in `docs/BUILD-LOG.md` and in your reply, not on the page)
1. Which phone number is right: (857) 352-3221 or (877) 352-3221.
2. Social profile URLs for Facebook, X, Instagram, LinkedIn — or which of them to drop.
3. Confirmation that the thirteen gallery photographs have releases for the children in them (the old site published them; confirm rather than assume), and more classroom photographs as they exist.
4. Permission to quote the two handwritten letters (the paper fan, the postcard) as testimonials, and from their authors.
5. Three real testimonials with name and role.
6. The newsletter provider and its form endpoint.
7. Whether the footer needs a privacy line, and the exact wording.
8. The Gallery and Contact page copy.

## 16. The two documents

### 16.1 `docs/design-system.md`
For agents and for Jayden. Sections: Principles (the ten non-negotiables, §1) → Colour (tables with hex, role, contrast, allowed uses, forbidden uses) → Type (the roles table with size at 390/1440, weight, leading, tracking, measure, and the one-paragraph "why this face") → Space and grid → Radius → Lines and surfaces → Motion (ladder, easings, the reduced-motion contract, the "one motion per illustration" rule) → Components (one entry each: purpose, markup snippet, tokens consumed, states, do/don't with a reason) → Illustration (the four parts, the three compositions, the forbidden motifs with the stock-library counts) → Icons → Photography (the manifest rules, colour/B&W rule, no-overlay rule) → Copy rules → Page anatomy (section order and rhythm) → Gates. Every rule has a one-line reason. No rule without a reason.

### 16.2 `docs/design-system.notion.md`
The same content re-cut for Notion's Markdown importer: H1 page title, H2 per section, tables for every token set (Notion renders pipes), `> ` blockquotes for rules (they import as callouts), toggle-free (Notion ignores `<details>`), no HTML, no nested lists deeper than two, colour swatches written as `🟪 #E2E1FF lavender` etc. because Notion cannot render CSS. Keep it under 2,500 words; link back to the repo for markup. Tell Jayden in one line how to import it (Notion → Import → Markdown).

## 17. Process — do it in this order, and reply between steps only if blocked
1. Read this prompt and `docs/apple-design.md`. Inventory the inputs. If anything in §0 is missing, say so in line one of your first reply and continue.
2. **Tokens and style guide first.** `tokens.css`, `base.css`, `components.css`, `styleguide.html` with every component and state. Screenshot it. Look. Fix. This is half the job and it is the half that gets reused.
3. Fonts: subset, self-host, preload, `size-adjust` fallback. Measure CLS.
4. Assets: logo variants in place, favicon set, icon sprite, the star and figure symbols, the figures band. Render each alone at 2× and look.
5. Images: run the pipeline, write `MANIFEST.md`, confirm the sixteen arch crops at 177px and the eight stack tiles at their rendered sizes by looking at them (photo 12 and every child's face especially).
6. `index.html`: build the arch first and run the `orbit` gate before anything else is on the page — its geometry is the riskiest thing here. Then the remaining sections in order, one at a time, screenshotting each at 1440 and 390 before starting the next.
7. Motion: hero first paint, the arch's hover pause, the stack's recede, the pile's drop, reveals, the figures band, states. Then reduced motion. Then look again with motion off.
8. The dialog and the form, both entry points, all storage cases.
9. Run every gate serially. Fix. Re-run.
10. Write the two documents and `BUILD-LOG.md`.
11. Reply per §18.

Do not skip to step 6. Do not build the hero first "to see the vibe" — the vibe is the system.

## 18. How to reply
Jayden skims. Five lines, then numbers.
- Line 1: anything **not** done, or "Everything in §13 is built."
- Line 2: the one thing you changed because you looked at a screenshot.
- Lines 3–5: the decisions you made where this prompt left a choice (any crop you changed from §11.2, whether photo 12 held, the pile's exact offsets, the display weight if you flagged it, anything else), one per line.
- Then the gate table from §14 with the measured numbers.
- Then §15 as a list.
- Then the paths of the screenshots.
No adjectives. No "stunning", "beautiful", "clean" — the screenshots say that or they do not.
