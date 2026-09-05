# Developmental Improvisation — build prompt v2

> **v2, 2026-09-05.** Four changes from v1, all from Jayden's review of the v1 mock: the hero gradient is gone (flat `#181818` everywhere); one logo on screen at a time (the nav mark appears only after the hero mark has scrolled out); photos lead, each used once, on the column, in a fixed grid, no marquee; and the two one-shot illustrations are cut from the home page so the figures band is the only drawn thing. The v2 mock is `docs/developmental-improvisation/hero-mock-desktop.jpg` / `hero-mock-mobile.jpg`. Plus Jakarta Sans is confirmed.

> **How to use this file.** Paste everything below the line into a fresh agent session together with the inputs listed in §0. Edit the decisions in §2, §3, §5, §6 and §12 before you send it; everything else is mechanics. Sections marked `[DECIDE]` are the ones Jayden should read.


**Contents.** §0 Inputs · §1 Non-negotiables · §2 The brand · §3 Design system (colour, type, space, no gradients, no shadows, motion, states) · §4 Components and the style guide · §5 Illustration and icons · §6 The home page, section by section · §7 The newsletter popup · §8 Research: the colour rules and where they come from · §9 The micro-interaction inventory · §10 Copy · §11 Photo manifest and pipeline · §12 Stack, hosting, forms, icons, fonts · §13 Deliverables and file structure · §14 Gates · §15 Needs from Linda · §16 The two documents · §17 Process · §18 How to reply

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
| Old site copy | §10 of this prompt | The **only** words you may put on the page. |
| Apple design reference | `docs/apple-design.md` | Reasoning on motion, materials and type. Section 3 of this prompt wins where they disagree. |
| Hero and Welcome reference | `docs/developmental-improvisation/hero-mock-desktop.jpg`, `hero-mock-mobile.jpg` | The v2 mock Jayden approved the direction of: flat ground, one logo, a 4-up photo grid on the column. A sketch for order and scale, not pixels to copy. |
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
6. **Flat vectors only.** No texture, no noise, no grain, no 3D, no glassmorphism cards, no blurred blobs floating behind cards, no emoji, no stock illustration packs, no AI-generated imagery. Photographs are the only "texture" on the site.
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
- One accent per component. A chip is one colour. A card is one colour. A section takes one accent for its dots and chips, set once on the `<section data-accent>`.
- Sections rotate through the five accents in a fixed order down the page: lavender → sky → mint → butter → blush → lavender. Never two adjacent sections with the same accent; never pick by mood.
- At 100% a pastel is used only on things smaller than ~120px on their long side (chip, dot, icon, illustration figure, focus ring, 2px underline). Anything larger uses the `--t-*` tint.
- Never more than two pastels visible in one component. Never all five together except in the illustration band (§5) and the logo.
- Photographs are never tinted, overlaid or duotoned. Never put a gradient over a photo.
- Text is never coloured. Not headings, not links (links are white with a hairline underline), not numbers.
- The logo hues appear nowhere outside the logo. Not as a tint, not as a glow, not as a gradient.

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

  --measure-body: 60ch;   /* paragraphs */
  --measure-display: 24ch;/* hero tagline — set on the h1 itself, see §6.1 */
  --measure-h2: 26ch;
}
```

Roles, and nothing outside them: `display` (hero tagline only, 600), `h1` (page title on inner pages, 600), `h2` (section title, 600; pull quotes use `h2` size at 400), `h3` (card title, 600), `lead` (400, `--ink-2`), `body` (400, `--ink-2`; first paragraph of a section may be `--ink`), `label` (`--fs-small` 600 `--ink-2`, sentence case, sits above an h2 with an 8px accent dot before it), `small`, `caption` (`--ink-3`), `ui` (600). Numbers use `font-variant-numeric: tabular-nums` only in the phone number.

### 3.3 Space, grid, radius, lines

```css
:root {
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px; --sp-5: 20px; --sp-6: 24px;
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

  --r-xl: 28px;   /* the popup panel and the newsletter card — surfaces, not items */
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
  --dur-bob: 3.2s;       /* the figures' bob — the only loop on the site */

  --ease-out:    cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  /* springs as linear() — use --ease-pop only on things that just appeared or were just pressed; --ease-settle for everything that moves */
  --ease-pop:    linear(0, 0.135, 0.408, 0.681, 0.889, 1.016, 1.073, 1.083, 1.068, 1.044, 1.022, 1.006, 0.997, 0.993, 0.993, 0.995, 0.997, 0.998, 1, 1, 1.001, 1.001, 1);
  --ease-settle: linear(0, 0.094, 0.284, 0.483, 0.653, 0.783, 0.875, 0.934, 0.971, 0.991, 1.001, 1.005, 1.006, 1.006, 1.004, 1.003, 1.002, 1.001, 1.001, 1, 1, 1, 1);
  --stagger: 60ms;
}
@media (prefers-reduced-motion: reduce) {
  :root { --dur-bob: 0s; --dur-reveal: 160ms; --dur-enter: 200ms; --stagger: 0ms; }
  /* reveals become opacity-only; the figures band stands still */
}
```

Animate only `transform` and `opacity` (and `background-color`/`color`/`border-color` for state changes). Never `top/left/width/height/box-shadow/filter`. Feedback happens on `:active` (pointer-down), never on click. Every transition is interruptible: hover out mid-hover reverses from the current value because it is a CSS transition, not a keyframe.

Reduced motion is not "no motion": a reveal still fades, a button still changes colour. Only movement, loops and overshoot go.

### 3.7 Focus, states, targets

- `:focus-visible` — `outline: 2px solid var(--c-sky); outline-offset: 2px;` on every interactive element, same colour site-wide, never removed. Focus is not hover: no scale.
- Hover — a state change of `--dur-state`. Primary button: `--ink` → `#F2F1F1`. Secondary: `--line` → `--line-strong`. Links: underline `--line-strong` → `--ink`. Photo cards: image `scale(1.02)` inside `overflow:hidden`, `--dur-move`.
- Active — `transform: scale(.97)` at `--dur-press` on buttons and chips-as-links. Nothing else scales on press.
- Disabled — `--ink-3` text, no hover, `cursor: default`.
- Every target ≥ 44×44 measured. Nav links get vertical padding to reach it even though the text is 14px. Social icons are 24px glyphs in 44px boxes. The popup's close button is 44px.

## 4. Components (`css/components.css`) and the style guide

One class per component, BEM-ish, no utility soup, no `!important`. Each component reads `--accent` and never sets a colour of its own. Document every one on `styleguide.html` with its states rendered live, its class names visible, and the tokens it consumes — this page is the reusable system Jayden will build Gallery and Contact from, so it has to be complete.

| Component | Class | Spec |
|---|---|---|
| Container | `.container` | `max-width: var(--page-max); padding-inline: var(--gutter); margin-inline: auto`. |
| Grid | `.grid` + `.grid--2/3/4` | 12-col CSS grid, `gap: var(--grid-gap)`. Photo rows use `.photo-row--3/4` (§4 Photo). |
| Section | `.section` + `.section__head` | `padding-block: var(--section-y)`; opens with the column hairline (§3.3) — every section except the hero; head = label (with dot) → h2 → lead, **left-aligned**; `.section__head--center` exists for the hero and the quote only. Two-column sections use `.section__grid` = 12-col grid with the head in columns 1–5 and the content in 7–12 (≥1024), stacked below. |
| Label dot | `.dot` | 8px circle `background: var(--accent)`, inline, `margin-right: var(--sp-2)`, vertically centred on the label's x-height. The only decoration a label gets. |
| Button | `.btn` + `--primary` (white ground, `--ink-on-accent` text) / `--secondary` (transparent, hairline) / `--ghost` (no border, text only, nav CTA on mobile) | height 48, `padding: 0 var(--sp-5)`, `--fs-ui` 600, `--r-md`, gap 8 for an optional trailing 20px icon. `.btn--compact` is height 44 with `padding: 0 var(--sp-4)` and `--fs-small`, for the nav only. States per §3.7. Loading state swaps the label for a 16px stroke spinner (the only spinner on the site). |
| Chip | `.chip` | height 32, `padding: 0 var(--sp-3)`, `--fs-small` 600, `background: var(--accent)`, `color: var(--ink-on-accent)`, `--r-full`. Not interactive. Chips are the only 100% colour fill bigger than a dot. |
| Card | `.card` | `background: var(--bg-raised); border: 1px solid var(--line); border-radius: var(--r-lg); padding: var(--sp-6)` (`--sp-8` ≥1024). `.card--tint` uses `--accent-tint` instead of raised (max one tinted card per row). |
| Photo | `.photo` | `<figure>` wrapping `<picture>`; `aspect-ratio` set by modifier (`--4x5`, `--3x2`, `--1x1`); `border-radius: var(--r-lg)`; `overflow: hidden`; image `object-fit: cover`; optional `.photo__caption` in `--fs-caption --ink-3` **outside** the image, `--sp-3` below, never overlaid. Photos sit on the column grid in fixed rows (`.photo-row--4`, `.photo-row--3`): equal widths, equal ratios, one gap. No masonry, no bento, no marquee. |
| Testimonial | `.testimonial` | Not a card. A list item: `.testimonial__quote` (`--fs-lead` 400 `--ink`, `--measure-body`), then `.testimonial__who` (name `--fs-small` 600 `--ink` · role `--fs-caption --ink-3`) with a 32px initials circle in `--accent` before it; items separated by the hairline, `--sp-8` padding above and below each. Quote marks are typographic (“ ”) in the text, not a giant decorative glyph. |
| Quote | `.quote` | Centred block, `--fs-h2` at 400, `--measure-h2`, attribution in `--fs-small --ink-3` below with an 8px accent dot. |
| Field | `.field` + `.input` | Input height 48, `--bg-overlay`, hairline, `--r-md`, `--fs-ui` 400, placeholder `--ink-3`. Label is visible text (`--fs-small` 600) or `aria-label` when the placeholder is the label (newsletter). Error state: hairline → `--c-blush` and a `--fs-caption` message below; never red. Success: the button label becomes "Subscribed" with a 16px check that draws in over `--dur-move`. |
| Dialog | `.dialog` | See §7. |
| Nav | `.nav` | See §6.0. |
| Footer | `.footer` | See §6.12. |
| Figures | `.figures` | See §5. |
| Reveal | `.reveal` (+ `.reveal--stagger` on a parent) | `opacity:0; transform: translateY(12px)` → `is-in` class from an IntersectionObserver at `threshold: 0.2, rootMargin: "0px 0px -10% 0px"`, once. `--dur-reveal --ease-out`, children delayed by `--stagger × index` (cap 6). The hero uses the same class but is triggered on load with `--dur-enter`. |
| Visually hidden | `.sr-only` | The standard clip pattern. |
| Skip link | `.skip` | First focusable element; visible on focus at `--z-skip`. |
| Event (for later) | `.event` | A card with date (`--fs-h3` 600), title, one-line meta and a secondary button. Built on the style guide with placeholder content; not placed on the home page. |

Rules for the style guide page: it uses the same tokens and components (it is a page on the site, at `/styleguide.html`, `noindex`); it shows every colour with its contrast ratio against `--bg` printed next to it (computed at build, not typed); every type role at its 390 and 1440 sizes; every spacing token as a bar; every component in every state; the motion ladder with a "play" button per rung; and the figure symbol with the figures band. It has a sticky left index. It is not pretty for its own sake — it is complete.

## 5. Illustration and iconography — build the brand around the logo `[DECIDE]`

### 5.1 What the research found, so you do not repeat it
The improv/SEL education space is saturated with the same pictures. Measured on stock libraries: 8,400+ "lightbulb + puzzle" illustrations on iStock alone; 28,000+ "diversity hands"; 5,000+ "brain + heart" marks. The old Developmental Improvisation brand stacked all three (brain + bulb, hands round a globe, puzzle pieces). The puzzle piece also carries autism-symbol baggage that the community has been moving away from. Peer organisations already own: the jump rope (Playworks), the bundled-shirt ball (Right To Play), the segmented wheel (CASEL), speech bubbles and comic cells (LEGO Education), pirates (Story Pirates), curtains and masks (every theatre). Bendy flat "corporate Memphis" people are now the default AI output and will read as generated.

**Therefore: no brains, no lightbulbs, no puzzle pieces, no globes, no rainbow hands, no wheels, no speech bubbles, no masks, no bendy people, no plants.**

### 5.2 The system: one drawn thing, taken from the logo
The logo already contains the brand's illustration language: a round-headed figure with arms reaching out along the ring; the ring; a four-point sparkle; a round geometric letterform. On the home page exactly one drawn element appears outside the logo, and it is the logo's own figure, repeated.

**The figure.** In `dilogocolor.svg` the eight paths are, in order: 0 the monogram (`#58CDFC`), 1 the sparkle (white), 2 the right figure (`#F0895B`), 3 the left figure (`#FB9BC9`), 4 the top figure (`#E744E2`), 5–7 the three arcs. **Path 4 is the upright figure** (head circle + body + two arms reaching out and down, bbox ≈ 189–603 × −1–206 in the 787×842 viewBox). Extract it, translate it to a 0 0 origin, and save it as `assets/illustrations/figure.svg` as a `<symbol id="figure" viewBox="0 0 414 208">` with `fill="currentColor"` — no redrawing, no smoothing, no "cuter" version, no face, no hands, no feet. It is drawn the same way at every size. This is the "kids holding hands" asset: figures placed side by side so that each figure's arm tip touches the next one's.

**The figures band** (`.figures`, §6.3): a full-width row of figures alternating the five pastels in a fixed order (lavender, sky, mint, butter, blush, repeat), arms touching (the figure is ≈2:1, so each takes ~128px of width at 64px tall), 64px tall on mobile and 88px on desktop, standing on the column hairline. As many as fit the viewport; `overflow: hidden`; centred so the row is symmetric. Each figure bobs `translateY(-2px → 0)` on `--dur-bob --ease-in-out` alternate with delay `index × 120ms`, so a wave travels along the row — under 3px of movement, always. It has a 44px pause/play control at the band's right edge (`aria-pressed`, `--ink-2`, no ground until hover): the bob runs longer than five seconds, so WCAG 2.2.2 requires one, and `prefers-reduced-motion` does not replace it. Reduced motion: a still row. This is the whole "vectors of kids holding hands moving" ask, executed once.

**The sparkle** (the logo's four-point star, `currentColor`, 24px) may appear exactly once on the page, inline after the h2 "What would you do?" (§6.4), in the section's `--accent`. **The dot** (8px, `--accent`) marks labels and the testimonial pager. Nothing else is drawn.

### 5.3 Recorded for later pages, not built in v1
Two compositions were designed and are worth keeping for the About page, where they would earn their place beside real text. They are **not** on the home page and are **not** built now (Jayden: "don't make assets you don't need"):
- **Yes, and** — a circle and a rounded square in one accent slide together 24px on reveal; the overlap fills solid on contact. Accept the offer, add to it, make a third thing.
- **Grid to circle** — 20 dots in a 5×4 grid (the classroom) travel, on reveal, to their positions on a ring (the warm-up circle). The desks are pushed back and the class becomes a circle.
Both are one-shot, `--ease-settle`, static under reduced motion.

### 5.4 Icons
One pack, one weight, one size. Icons are for function only. No icons in headings, no icon grids of "benefits", no icon next to every paragraph.

- **Pack:** §12.3 names it; inline the glyphs you use (eleven, listed there) as an SVG sprite (`assets/icons.svg`, `<use href="#i-close">`). Do not load an icon font or the whole pack.
- **Size:** 20px inside buttons and inputs, 24px standalone, always in a 44px hit area when interactive. Stroke width as the pack ships it — never restyled.
- **Colour:** `currentColor`. Icons are `--ink-2` at rest and `--ink` on hover, exactly like the text next to them. A social icon does not turn its brand colour on hover; it turns white.
- **Social marks:** Facebook, X, Instagram, LinkedIn as simple monochrome glyphs from the same pack. All four the same visual weight.

## 6. The home page, section by section `[DECIDE]`

Order is fixed. Every section is a `<section>` with an `id` (the nav's Gallery and Contact links anchor to `#gallery` and `#contact` until those pages exist), a `data-accent` in the rotation, the column hairline at its top (§3.3), and a left-aligned `.section__head` unless noted. Vertical rhythm is `--section-y` everywhere. Every usable photograph appears **once** on the page; the allocation is fixed below.

### 6.0 Nav (`.nav`)
- Fixed, `--nav-h` 64, full width, transparent at the top of the page. After 24px of scroll it gets `--glass` + `backdrop-filter: blur(20px) saturate(140%)` and a bottom hairline, over `--dur-state`. No shrink.
- Left: a 44px slot for the white monogram (`dilogobasicwhite.svg`, 24px tall, links to `/`). **It is invisible while the hero's logo is on screen** and fades in (`--dur-state`) when the hero logo leaves the viewport (IntersectionObserver on the hero `<img>`), so there is never more than one logo on screen. On inner pages, which have no hero logo, it is simply there.
- Right: Home · Gallery · Contact as `--fs-small` 600 `--ink-2`, current page `--ink`, 44px tall targets, `--sp-6` apart; then **Subscribe** (the old site's button label) as `.btn--secondary.btn--compact` (44px) that opens the popup. On ≤767px the three links collapse into a `.btn--ghost` "Menu" that opens a full-height sheet from the right (`--dur-move --ease-settle`, scrim, Esc closes, focus trapped) listing the three links at `--fs-h3` and the Subscribe button. No hamburger icon; the label reads Menu / Close.
- Hover on a link: colour to `--ink` over `--dur-state`. No underline in the nav. Current page: 600 and `--ink`, nothing else.
- The nav never casts a shadow and never has a solid ground at the top of the page.

### 6.1 Hero (`#top`, accent lavender) — the logo, the words, four photographs
Flat ground. Everything on the column. This is the mock.

- **Copy block**, centred, `padding-top: calc(var(--nav-h) + clamp(48px, 6vw, 88px))`: the colour logo (`dilogocolor.svg`) at `clamp(120px, 14vw, 160px)` tall; `--sp-8` below it the `h1` — a visually hidden "Developmental Improvisation" plus the visible tagline **New tools for cognitive development & emotional understanding** in `display` with `max-width: var(--measure-display)` **on the h1 itself** (a `ch` unit resolves against the element's own font size; on a wrapper it is wrong by 4×); `--sp-4` below, **Pre-wiring the brain & educating the heart** in `lead --ink-2`, `max-width: 40ch`; `--sp-8` below, primary **Sign Up for our Newsletter!** (opens the popup) and secondary **Contact** (anchors `#contact`) side by side; at ≤479px both are full width of a 320px column, stacked, primary first.
- **Photo row**, `clamp(48px, 5vw, 72px)` below the buttons: `.photo-row--4` on the column — photos **2, 7, 3, 6** in that order (colour, B&W, colour, colour), all `.photo--4x5`, `--r-lg`, `--grid-gap` apart. 2×2 at ≤767px. No captions here. Nothing moves; the row is a fixed grid.
- **Measure numbers for the gate:** the tagline wraps to 3 lines at 1440 (`New tools for cognitive / development & emotional / understanding`) and 5 at 390.
- **First paint:** logo `scale(.96) → 1` and fade over `--dur-enter --ease-out`; then h1, sub, buttons with `--stagger`; then the four photos with `--stagger` left to right. No draw-on, no sparkle ping, no bounce; under 900ms in total; once per session (`sessionStorage`). This is the only load animation on the page.
- **Height:** the content's own height plus `--section-y` below the photo row. Not `100vh`. At 390 the photo row starts at ~80% of the first viewport so the top of the grid is the scroll cue; there is no arrow.
- **Nothing else.** No gradient, no band behind the photos, no second logo, no scroll indicator, no decorative shapes.

### 6.2 Welcome (`#welcome`, accent sky)
`.section__grid`, 7/5 at ≥1024. Left: label **Welcome** (dot) → h2 **Welcome to Developmental Improvisation** → paragraphs 1–3 in `body`, paragraph 1 in `--ink`, `--measure-body`. Right: photo **4** (Linda laughing, B&W) as `.photo--4x5`, caption **Linda Kellogg Fulton**, top-aligned with the label. If the photo runs more than 120px below the last paragraph at 1440, use `.photo--1x1` — look, then decide. Stacked below 1024: text, then photo. Reveal on scroll, staggered.

### 6.3 Figures band (`.figures`)
§5.2. Between Welcome and the next section, `--section-y-tight` above and below, standing on the column hairline. No text.

### 6.4 What would you do? (`#approach`, accent mint)
Text only, structured. `.section__grid` 5/7 at ≥1024. Left: label **Cooperative play** (dot) → h2 **"What would you do?"** with the sparkle inline after the closing quote (24px, `--accent`). Right: paragraph 4 in `body` `--ink`, then paragraph 5 in `body`, then **All while having as much fun as possible!** in `lead --ink-2`, then a row of chips from the copy: **critical thinking · creative problem-solving · cooperation · communication · compassion · instinct**, all in `--accent`, wrapping. Reveal, staggered. No photo here — the section is the page's one typographic breath between two photo sections.

### 6.5 Gallery (`#gallery`, accent butter)
Label **Gallery** (dot), set at `--fs-h2` as the title (there is no gallery sentence in the copy), left; on the same line at the right edge of the column, a secondary button **Gallery** (anchors `#gallery` now, `gallery.html` later). Below, `.photo-row--3`, all three `.photo--4x5` so the row is one shape: photos **1** (linked arms, B&W), **5** (Linda on stage, colour), **12** (the boy, colour, tight 4:5 crop; if it does not hold up at 380px wide, use photo **8** at a tight crop of Linda at the front of the room and say so). Captions beneath each in `--fs-caption --ink-3`, factual. Single column at ≤767px. Hover scale only.

### 6.6 Testimonials (`#testimonials`, accent blush)
`.section__grid` 5/7. Left: label **Testimonials** (dot); no h2 (no copy exists); nothing else in the column — it stays empty on purpose. Right: three `.testimonial` list items separated by hairlines, the ~220, ~160 and ~90-character placeholders in that order, each `data-placeholder="true"` per §10.4, initials circle `--accent`. No cards, no stars, no photo, no carousel, no pager. Stacked below 1024 with the label above the list.

### 6.7 Quote (`.quote`, accent lavender)
Centred, the one centred head after the hero: **"Creativity in motion creates knowledge!"** at `--fs-h2` 400, `--measure-h2`; attribution **Linda Kellogg Fulton** in `--fs-small --ink-3` with the dot. Nothing else. Reveal.

### 6.8 Newsletter (`#newsletter`, accent sky)
One `.card--tint` on the column, `--r-xl`, `padding: var(--sp-8)` (`--sp-12` ≥1024), a 12-col grid inside it: columns 1–5 the monogram (`dilogobasicwhite.svg`, 40px) and the h2 **Sign Up for our Newsletter!**; columns 7–12, vertically centred, the form: `.input` (type email, `aria-label="Email"`, placeholder **Email**, `autocomplete="email"`, `required`) and `.btn--primary` **Subscribe** in one row, stacked at ≤479px. Same form component as the popup; one JS handler; states per §4 Field.

### 6.9 Contact (`#contact`, accent mint)
`.section__grid` 5/7. Left: h2 **To Find Out MORE!** → lead **Email or Call Here:**. Right, vertically centred with the h2: two secondary buttons side by side (stacked at ≤479px): **developmentalimprov@gmail.com** (`mailto:`, mail icon) and **(857) 352-3221** (`tel:`, phone icon, tabular numerals). The old site is indexed with (877) 352-3221 in one place and (857) in another — ship (857) as captured and list the discrepancy in §15.

### 6.10 Footer (`.footer`)
Column hairline on top, `--sp-16` padding, `--bg`. ≥1024: a 12-col grid — columns 1–4 the white full mark (`dilogo.svg`) at 40px with **Developmental Improvisation** in `--fs-small` 600 beneath; columns 7–8 the three nav links stacked (`--fs-small`, `--ink-2`, underline grows from the left on hover over `--dur-state`); columns 10–12 the four social glyphs in 44px boxes, right-aligned. Below, a second hairline and one line: **© 2026 Developmental Improvisation** in `--fs-caption --ink-3`. Mobile: stacked, left-aligned. No newsletter form in the footer, no gradient, no illustration, no "made with".

### 6.11 Things that are not on this page
No stats row, no logo wall, no "as seen in", no FAQ, no pricing, no map, no chat widget, no cookie banner (no cookies are set; `localStorage` for popup state is not a cookie and needs no banner), no back-to-top button, no scroll progress bar, no cursor effects, no particles, no marquee, no bento, no gradient, no second logo.

### 6.12 Photo allocation, so nothing repeats
| Photo | Where |
|---|---|
| 2, 7, 3, 6 | Hero row, in that order |
| 4 | Welcome portrait |
| 1, 5, 12 | Gallery row (8 is the stand-in if 12 fails) |
| 9, 10, 11 | Not on the page (letters; permission needed) |

## 7. The newsletter popup (`.dialog`)

Same content as §6.8, in a dialog. This is the one interruption on the site, so it has to be polite and it has to be perfect.

- **Element:** a native `<dialog>` with `aria-labelledby` pointing at its h2. On desktop it opens with `showModal()` so focus trapping, Esc and the inert background come from the platform; backdrop click closes it via a JS listener (`closedby="any"` is not in Safari yet). On ≤767px it is **non-modal** — `dialog.show()` (or `popover="auto"`) as a bottom sheet the page can still scroll under, which is the pattern Google's mobile-interstitial guidance allows. Initial focus goes to the h2 (`tabindex="-1"`), not the input, so a screen reader hears the offer before the field. Polyfill nothing.
- **Panel:** `--bg-overlay`, hairline, `--r-xl`, `padding: var(--sp-8)`, `max-width: 440px`, centred on desktop. On ≤767px it is a bottom sheet: full width, `--r-xl` on the top corners only, `max-height: 38vh`, non-modal as above. Contents: close button (44px, top-right, icon `close`, `aria-label="Close"`), the monogram at 32px, h2 **Sign Up for our Newsletter!**, the form, and under it one `--fs-caption --ink-3` line — there is no privacy sentence in the copy, so ship none.
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
3. **Pastel at 100% only on small foreground shapes; a large pastel surface is a dark tint.** Material's dark scheme: primary is tone 80 (`#d0bcff`, a lavender pastel) for small foreground, primary-container is tone 30 for large surfaces. → `--c-*` for chips and dots, `--t-*` for cards and bands. The five brand pastels are within a few hex digits of Notion's feature tints and Figma's story blocks — both use them as large surfaces *on white*. On `#181818` the model inverts; do not port "Notion pastels" onto a dark ground.
4. **One colour block per viewport, hero excepted.** Figma: "don't combine more than one color block visible inside a single viewport"; Framer: gradient cards "one or two per long page; three is a moodboard"; Raycast: the stripe gradient "exactly once per page". → the section accent rotation in §3.1.
5. **Gradients are rationed to zero or one, and the strictest systems ship none.** Linear rejects gradients entirely; Supabase forbids atmospheric hero gradients; Raycast allows exactly one stripe per page; Framer confines them to cards. This site is at the Linear end: none (§3.4). The photographs are the colour fields.
6. **Photos carry the colour; chrome near them is grey.** Pinterest: 8px gutters, zero card padding, no card shadows, chrome "gets out of the photograph's way"; Airbnb: 14px radius, "trust photography and generous whitespace over typographic muscle". → no overlays, no tints, no gradients on or near photographs.
7. **One CTA treatment site-wide, and text on a pastel is dark.** Raycast and Framer: a white pill for every primary CTA on dark; Spotify: black text on green. → `.btn--primary` is white with `--ink-on-accent`; chips are pastel with `--ink-on-accent`.
8. **Two weights, tracking scales with size.** Notion `-2px at 80 / -1 at 56 / -0.5 at 48 / 0 at body`; Figma `-0.02em`; Linear `-3px at 80`. Display weight is lighter than instinct on most of these sites (Figma 340, Miro 500, Google display is regular). → the tracking column in §3.2. `[DECIDE]` the display role ships at 600; if the hero tagline feels heavy at 64px, the sanctioned alternative is 400 for `display` only, not a new weight.
9. **Radius by size class.** Cards 12–20, big blocks 24–32 (Figma 24, Material 28, Pinterest 32); buttons are one shape site-wide. → `--r-xl 28 / --r-lg 20 / --r-md 14 / --r-full`, Jayden's own ladder, inside the observed range.
10. **96px between sections at desktop, 1200–1280 max width.** Linear, Figma, Notion, Framer, Raycast, Sentry, Warp, Miro all at 96; photo-dense sites (Airbnb, Pinterest) at 64. → `--section-y` lands on 96 at 1440 and `--section-y-tight` on ~53 for photo bands.

**The kids'-brand trap, stated once:** playfulness is spent in the mark, the photographs and one or two micro-interactions — never in the chrome. Duolingo's entire playful chrome is a 4px ledge under its buttons; Headspace's is one breathing circle; everything else in those systems is as strict as Linear. Here the budget is: the logo, the photographs, the hero's staggered arrival, and the figures band's bob. That is the whole allowance. Spend it nowhere else.

**Motion values that were actually verifiable:** Material `short 50–200ms`, `medium 250–400ms`, `long 450–600ms`, `emphasized-decelerate cubic-bezier(0.05, 0.7, 0.1, 1)` for things entering; Apple press `scale(0.95)` on `:active`; Headspace tap `scale(0.98)`, canvas cross-fade 600ms, breathing sphere 4s `scale 1 → 1.04` with no spring; Slack spring 250ms at damping 0.8; Duolingo's press 80ms linear. The ladder in §3.6 sits inside these.

## 9. The micro-interaction inventory — all of them, and no others

Ten. Each has a trigger, a property, a duration and a reason. If you want an eleventh, you have to name what it is *for* and remove one.

| # | Where | Trigger | What moves | Duration / easing | Reason |
|---|---|---|---|---|---|
| 1 | Hero | page load, once per session | logo `scale .96→1` + opacity; then tagline, sub, buttons with `--stagger`; then the four photos left to right with `--stagger` | `--dur-enter --ease-out` | Continuity — the page arrives in reading order, it does not pop |
| 2 | Nav | scroll > 24px; hero logo leaves the viewport | ground → `--glass`, hairline fades in; the monogram fades in when the hero mark is gone | `--dur-state` | Wayfinding — the bar becomes a surface only when there is something under it, and there is one logo on screen at a time |
| 3 | Nav links, footer links | hover / focus | colour `--ink-2 → --ink`; footer links also grow a 1px underline from the left | `--dur-state` in, `--dur-state-out` out | Feedback |
| 4 | Buttons | `:active` | `scale(.97)` | `--dur-press` | Feedback on pointer-down (Apple §1) |
| 5 | Buttons | hover | primary ground `--ink → #F2F1F1`; secondary hairline `.08 → .16` | `--dur-state` | Feedback; lighter on hover because the ground is dark |
| 6 | Photos | hover / focus-within | image `scale(1.02)` inside the clipped figure | `--dur-move --ease-out` | Affordance for the Gallery; nothing else changes |
| 7 | All sections below the hero | 20% visible, once | `.reveal`: opacity 0→1, `translateY(12px → 0)`, children staggered ≤6 | `--dur-reveal --ease-out`, `--stagger` | Continuity — content arrives in reading order |
| 8 | Figures band | always; pause control | each figure bobs 2px, a wave along the row | `--dur-bob --ease-in-out` alternate, delay `i × 120ms` | The brand's one "kids holding hands, moving" |
| 9 | Popup and mobile menu sheet | open / close | scrim fade; popup panel `scale .96→1` (desktop) / `translateY(24px → 0)` (bottom sheet); menu sheet `translateX(100% → 0)`; reverse on close along the same path | `--dur-enter --ease-out` in, `--dur-state-out` out | Spatial consistency (Apple §7) |
| 10 | Form | submit → success | button label swaps, 16px check draws on (`stroke-dashoffset`); error hairline → `--c-blush` | `--dur-move` / `--dur-state` | Completion feedback |

Under `prefers-reduced-motion`: 8 stops; 1, 7, 9 become opacity-only at the reduced `--dur-reveal`/`--dur-enter`; 2–6 and 10 keep their colour changes and drop their transforms.

**Not in the inventory, therefore not on the site:** parallax, scroll-linked scrubbing, marquees, carousels, magnetic buttons, cursor followers, text scramble or split-letter reveals, counters, typewriters, hover tilt, hover glow, ripple, skeleton shimmer, confetti, logo spin, sparkle "ping", bouncing arrows, gradient drift, and any animation on the quote.

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
| 1 | `27096601-DB24-458B-9670-845A4B914EC3.JPG` | 1440×960 landscape, B&W | Three adult participants standing in a row, arms linked, mid-exercise, focused | **Gallery row** (§6.5). Soft focus — never above 720px wide. |
| 2 | `271AA5F7-78F1-4288-A6D2-25E35598A277.JPEG` | 1280×1707 portrait, colour | Bright workshop room, a participant in yellow trousers mid-step and laughing on a foam-mat floor, the group watching | **Hero row, first.** Best "creativity in motion" frame. |
| 3 | `3528DF95-C76F-410F-89F0-CD868EA5DB54.JPG` | 960×1440 portrait, colour | A participant in a bucket hat laughing hard, "HELLO my name is" sticker | **Hero row, third.** Joy. Crop 4:5. |
| 4 | `360AC4E9-9695-4879-8C64-5AD5AC1B419A.JPG` | 960×1440 portrait, B&W | Linda (white hair, glasses) mid-laugh, leading a session, participants behind her | **Welcome portrait** (§6.2). |
| 5 | `9C752690-2CD5-4F26-BED6-227732891668.JPG` | 960×1440 portrait, colour | Linda on stage with a lapel mic holding a foam baton prop, patterned shirt, teaching | **Gallery row** (§6.5). |
| 6 | `A0982FD3-7ED2-48E6-81AC-7F83E630ABC4.JPEG` | 1707×1280 landscape, colour | Floor-level group game, a participant in green crawling, hands raised around | **Hero row, fourth.** Pairs with "safe, educational, and thrilling". |
| 7 | `C053CD9C-8A24-41CE-9EC9-BD92E8BB0071.JPG` | 1440×960 landscape, B&W | Participants reaching their hands toward each other in a circle, one smiling at the centre | **Hero row, second.** This is the brand's picture: the circle, the hands. |
| 8 | `IMG_0230.JPEG` | 1024×472 landscape, colour | Wide shot of a small conference room, Linda at the front, screen and chairs | Stand-in for the Gallery row only if photo 12 fails (low resolution, poor light); otherwise not on the home page. |
| 9 | `IMG_1548.HEIC` | 3213×5712 portrait | A handwritten thank-you letter to Linda on a paper fan, page 1 | Source material only. Not for publication without permission. Convert to JPEG and keep in `images/src/letters/`. |
| 10 | `IMG_1549.HEIC` | 3213×5712 portrait | The same letter, page 2 | Same. |
| 11 | `Scan Jun 7, 2026 at 7.10 PM.JPG` | 2090×2946 portrait | A handwritten postcard (China Post) to Linda, signed "Ray 2026" | Same. |
| 12 | `awards4-light.JPEG` | 2592×3872 portrait, colour | A boy in a blue sweater, fist raised, another child behind him, dark stage (2011, Nikon D40X) | The only child photo. Grainy. **Gallery row, third**, tight 4:5 crop on the boy — if it does not hold at 380px wide, fall back to 8 and say so. |

**Colour and black-and-white.** Four of the usable photos are B&W. Do not convert colour photos to B&W to match, and do not tint B&W photos. On the dark ground the mix reads as editorial; in every row, no two B&W frames touch (the hero order 2, 7, 3, 6 and the gallery order 1, 5, 12 are set that way).

**Pipeline** (`tools/build-images.mjs`, run with Node + `sharp`):
- Read `images/src/`, apply EXIF orientation, strip metadata.
- Emit AVIF and WebP at widths 480, 960, 1440, 1920 (never upscale beyond source), plus a JPEG fallback at 1440. Quality: AVIF 55, WebP 78, JPEG 82.
- Emit a 24px-wide blurred WebP placeholder for each, inlined as a `data:` URI background on the `<picture>` wrapper, so nothing pops in.
- Name outputs by content, not by the source's UUID: `hero-01-yellow-trousers`, `hero-02-laugh`, `circle-hands`, `linda-laughing`, `linda-stage`, `floor-game`, `row-linked-arms`, `boy-fist`. Record the mapping in `images/MANIFEST.md`.
- Every `<img>` has explicit `width`/`height`, `loading="lazy"` except the four hero photos, `decoding="async"`, and `sizes`.
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
**Phosphor, Regular weight, 24px box**, inlined as an SVG sprite built from `@phosphor-icons/core` (MIT, 1,512 glyphs, round caps and joins that match Plus Jakarta Sans's terminals). Not the webfont. Glyphs needed on the home page: `x` (close), `arrow-right`, `check`, `envelope-simple`, `phone`, `pause`, `play`, `facebook-logo`, `x-logo`, `instagram-logo`, `linkedin-logo`. That is eleven; the sprite contains eleven. Phosphor's `student`, `hands-clapping`, `users-three` exist for later pages — not for decorating this one.

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
│  └─ home.css                only what is unique to index.html (hero block, photo rows, figures band)
├─ js/
│  └─ main.js                 nav state + mark visibility, mobile sheet, reveals, figures pause, dialog, form — vanilla, ES2020, no bundler, <10 KB unminified
├─ assets/
│  ├─ logo/                   the six SVGs as supplied, plus favicon.svg (monogram), icon-192.png, icon-512.png, apple-touch-icon.png
│  ├─ icons.svg               the sprite: only the glyphs used
│  └─ illustrations/          figure.svg (the symbol) — nothing else in v1
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
| `contrast` | Every text node's computed colour against its effective background ≥ 4.5:1 (≥ 3:1 for text ≥ 24px). Computed from the DOM, not from the token table. |
| `tokens` | No stylesheet other than `tokens.css` contains a hex colour, an `rgb(`, a `px` font-size, a `ms`/`s` duration or a `border-radius` value that is not a `var()`; **no stylesheet contains `-gradient(`**. |
| `type` | Only `font-weight: 400` and `600` occur in computed styles; `font-style` is never `italic`; exactly one `font-family` is used for text. |
| `layout` | At each viewport: no horizontal overflow (`document.documentElement.scrollWidth === innerWidth`); the hero tagline wraps to 3 lines at 1440 and ≤5 at 390; every `.container` inner edge and every section hairline lands on the column (1440: 120 → 1320); every photo in a row has the same rendered width and height as its siblings; exactly one logo `<img>` is visible at scrollY 0 and exactly one at scrollY 1200. |
| `motion` | With `prefers-reduced-motion: reduce` emulated: no element has a running animation after 300ms (`document.getAnimations().length === 0`); reveals still reach `opacity: 1`. Without it: a figure's transform differs between two frames 800ms apart; the pause control stops it. |
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
3. Classroom photographs of children with signed releases — the current set is adults in workshops plus one 2011 child photo.
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
4. Assets: logo variants in place, favicon set, icon sprite, the figure symbol and the figures band. Render each alone at 2× and look.
5. Images: run the pipeline, write `MANIFEST.md`, confirm the hero four and the gallery three by looking at them at their rendered sizes (photo 12 especially).
6. `index.html`: build sections in order, one at a time, screenshotting each at 1440 and 390 before starting the next.
7. Motion: hero first paint, nav mark hand-off, reveals, the figures band, states. Then reduced motion. Then look again with motion off.
8. The dialog and the form, both entry points, all storage cases.
9. Run every gate serially. Fix. Re-run.
10. Write the two documents and `BUILD-LOG.md`.
11. Reply per §18.

Do not skip to step 6. Do not build the hero first "to see the vibe" — the vibe is the system.

## 18. How to reply
Jayden skims. Five lines, then numbers.
- Line 1: anything **not** done, or "Everything in §13 is built."
- Line 2: the one thing you changed because you looked at a screenshot.
- Lines 3–5: the decisions you made where this prompt left a choice (photo 12 or 8 in the gallery row, the Welcome portrait ratio, the display weight if you flagged it, anything else), one per line.
- Then the gate table from §14 with the measured numbers.
- Then §15 as a list.
- Then the paths of the screenshots.
No adjectives. No "stunning", "beautiful", "clean" — the screenshots say that or they do not.
