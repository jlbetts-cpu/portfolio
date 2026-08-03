# Case-study teardown — trungvo.xyz/expresso

**Source:** `https://trungvo.xyz/expresso` (single page; the rest of that site was deliberately not studied)
**Date:** 2026-08-02
**What this is:** An analysis of a third-party site for pattern learning. Nothing here is copied markup, CSS, copy, or imagery. Numbers were read from `getComputedStyle` and the live CSSOM in a real browser at 1440×900, 1280×720 and 390×844. Structure and class names are described only to explain *what the page does*; the build is ours.

**Boundary:** extract principles, not assets. If a later request drifts toward "make mine look exactly like his," that is the line — the value here is the reasoning, and a verbatim clone would be lifting someone's work.

**Measurement caveat:** the page is a Next.js app. Its entrance animation and scroll-spy are JS-driven, and the headless browser pane throttled rAF, so the reveal froze mid-transition and the scroll-spy never advanced past the first item. Everything marked *(observed)* was read directly; a few motion/scroll-spy behaviours are marked *(inferred from CSS + DOM)* and should be treated as high-confidence but not eyeball-verified.

---

## 1. Page architecture

One column, one story, no tabs, no accordions. Total document height 6242px at 1280×720 — a genuinely long read that never branches.

**Order:**

| # | Section | Job |
|---|---------|-----|
| — | Fixed top nav | Site-level wayfinding (Home / About / a third item / search), 46px pill, always present |
| 0 | **Hero** | Client name → headline → full-bleed product image → metadata row |
| 1 | **Statement** | Why this product exists + why *he* joined. Two paragraphs, no image. |
| 2 | **Problem** | The user problem, then a How-Might-We framed as a question |
| 3 | **Process** | What they shipped and what the numbers said. Two side-by-side images mid-section. |
| 4 | **Engineering** | Constraint story: what they wanted, why it wasn't feasible, what they built instead. Video. |
| 5 | **Solution** | Two "named moves," each a framed card: media + title + rationale |
| 6 | **Metrics** | Three outcome cards |
| — | Footer | Contact line + oversized wordmark |

**Above the fold (1440×900):** eyebrow, headline, and roughly the top two-thirds of the hero image. The metadata row sits *below* the image and is not visible on load.

**Two things worth noting about the order:**

- **Metadata comes after the hero image, not before it.** Role / Team / Date / Skills / a live product link are a 5-column row *underneath* the visual. The image earns attention first; the credentials confirm it second. Most portfolios do the reverse and open on a spec sheet.
- **There is no "next project" section.** The page ends on Metrics → hairline → footer. The footer is one sentence of contact copy with two inline blue link-pills, over a `clamp(80px, 16vw, 280px)` wordmark bleeding off the bottom edge (`bottom: -0.1em`). The exit is "here's how to reach me," not "here's another case study." Whether that's right depends on whether you want depth or breadth — but it is a decision, and it reads as confidence.

The **Engineering** section is the most transferable structural idea: a whole section given to a feature they *didn't* ship, naming three concrete reasons (transcode latency, backend cost for a niche feature, third-party risk) and then the cheaper thing they built instead. That single section does more for perceived seniority than any amount of polish. Note it's also the only section with a generic id (`section-6`) — likely added late, which tells you it was a deliberate insertion, not part of the original template.

---

## 2. The reading-progress indicator

This is the strongest single component on the page and the thing worth stealing hardest.

**What it is:** a sticky left rail of six horizontal dashes — one per section — that turns into a labelled table of contents on hover. Not a scrollbar, not dots, not a sticky chapter label. A *scale*.

**Placement and geometry (observed):**
- Lives in a 100px-wide `<aside>`, first child of the body row, `position: sticky; top: 65px` (clears the 63px fixed nav)
- The rail column is 100px wide; the content column takes the rest. At 1280 viewport the content column is 976px, at the 1440px max-width it is 1136px
- Column gap between rail and content: 32px
- Back link, then 24px, then the tick stack
- Tick stack: 6 items, 10px apart, each item a 14px-tall hit area containing a 1px-tall line

**States (observed):**

| State | Line width | Line colour | Label |
|-------|-----------|-------------|-------|
| Inactive | 16px | `#cccccc` | hidden (`opacity: 0`) |
| Active | **28px** | **`#111111`** | hidden until hover |
| Rail hovered — inactive | line fades out | — | visible, `#c4c4c4`, weight 300 |
| Rail hovered — active | line fades out | — | visible, `#121212`, weight 400 |

**The two moves that make it good:**

1. **The active tick is 75% longer, not just darker.** Length is readable peripherally and at a glance; colour alone is not. You know where you are without focusing on the rail.
2. **Hover swaps the entire rail from marks to words.** The labels are absolutely positioned at the same origin as the lines, so the lines fade to 0 and the words fade to 1 *in the same 100px column* — no layout shift, no reflow, no expanding panel. The rail is ambient by default and becomes a navigation control only when you reach for it. That is exactly the "put the smarts in behaviour, not visuals" principle.

**Timing:** 160ms on all three tick properties (opacity, width, background) and 160ms on label opacity. Fast — it feels like a state, not an animation.

**Interaction:** the items are `<button>` elements, not anchors, and each section carries a real id (`statement`, `problem`, `process`, `section-6`, `solution`, `metrics`) with `scroll-margin-top: 100px`. So: click to jump, with the 100px offset stopping the fixed nav from covering the section label. *(Inferred — the click handler didn't fire in the throttled pane, but the ids, the `scroll-margin-top`, and the button semantics make the intent unambiguous.)*

**Mobile: it does not survive.** The whole aside is `display: none` below 900px. Below 900px there is no reading indicator at all, and — see next section — no back button either.

---

## 3. The back affordance

**Where:** top of the sticky left rail, above the tick stack, 24px above it. It scrolls with the rail, which means it is *persistent* — sticky at `top: 65px`, it never leaves the viewport on desktop. Not scroll-triggered, never appears or disappears.

**What it looks like:** plain text. A left arrow glyph and the word "Back." 14px, weight 400, `#aaaaaa`, `-0.02em` tracking. No border, no background, no pill, no icon button, no radius. On hover the whole thing goes to the site's blue accent `#0072f5` over 180ms. That is the entire component.

**Where it returns to:** the site root (`/`).

**Why it works:** it is the quietest possible element that is still unmistakably a control. Grey text at the top-left of a rail reads as "chrome, ignore me" until you want it, and then colour-on-hover confirms it's live. It sits *above* the section ticks, so the mental model is a single vertical stack — "out of this page" at the top, "within this page" below it. One rail, two scales of navigation.

**The flaw, and it's a real one:** it dies with the rail below 900px. The stylesheet has a fallback back-link intended for the hero (defined, then set to `display: none`) — but that element is **not present in this page's DOM at all**. So on a phone the only route back is the Home icon in the floating bottom nav pill. That's a site-level nav, not a "return to where you came from." Do not copy this part.

---

## 4. Type and spacing

**Two families, one job each:**

- **Display:** a geometric-ish custom face (self-hosted, referenced as `--font-kern`, serif fallback). Every heading, every metric number, and the footer wordmark. Only ever weight 400.
- **Text:** Inter. Every label, every paragraph, all metadata, all nav. Weights 400 and 500 (nav only) — plus a single weight 300 on inactive rail labels.

**Both families are used at weight 400 for their primary job.** There is no bold anywhere in the content. Hierarchy is carried entirely by size, colour, and family. That restraint is a large part of why it reads as calm.

**Scale (observed, desktop → ≤900px):**

| Role | Size | LH | Tracking | Colour | Family |
|------|------|----|----------|--------|--------|
| Hero title | 40 → 28 | normal | −0.32px | `#000` | display |
| Section heading | 40 → 28 | 1.15 (46px) | −0.32px | `#000` | display |
| Section subheading | 32 → 22 | 1.2 | −0.256px | `#000` | display |
| Solution card title | 40 → 28 | 1.15 | −0.32px | `#000` | display |
| Metric value | 40 → 28 | 1.15 | −0.32px | `#000` | display |
| Section eyebrow | 16 | — | −0.48px | `#666` | text |
| Eyebrow (light variant) | 16 | — | −0.128px | `#a8a8a8` | text |
| Body copy | 16 | **1.6 (25.6px)** | −0.02em | `#666` | text |
| Hero meta label | 13 | — | **+0.5px, uppercase** | `#a8a8a8` | text |
| Hero meta value | 14 | — | −0.02em | `#555` | text |
| Back link / rail label | 14 | — | −0.02em | `#aaa` / `#c4c4c4` | text |
| Media caption pill | 12 | — | −0.02em | `#111` | text |
| Footer wordmark | `clamp(80px, 16vw, 280px)` | 1.0 | — | `#d0d0d0` | display |

Note the **tracking direction flip**: everything sets negative tracking (−0.02em / −0.32px), *except* the 13px uppercase metadata labels, which go **positive +0.5px**. That's the correct call and it's the detail most people miss — small caps need opening up, everything else needs closing up. It's the single cheapest typographic upgrade on this list.

**Vertical rhythm — and it's simpler than you'd guess:**

- **Inside a section: 10px.** Everything. Eyebrow-block → body → image → body → image. One value.
- **Inside the header block: 8px** between eyebrow and heading.
- **Between consecutive paragraphs: 22px** (10px flex gap + a 12px margin).
- **Between sections: 64px + 1px hairline + 64px = 129px.** The divider is a flex child of the same 64px-gap column, so it is automatically centred in the gap. No margin math, ever.
- Page padding: 80px top / 80px bottom, 20px side gutters at desktop, 24px gutters + 72px top on mobile.

So the entire vertical system is **10 / 64 / a 1px rule**. A ~6.4:1 ratio between intra-group and inter-group space. That's what makes each section read as one object: the internal spacing is so tight that the 64px+rule is unmistakable as a boundary. This is far more disciplined than a typical 8-point ramp with a dozen steps, and it's the reason the page never feels like it's guessing.

**Measure — the one thing to actively reject.** Body copy has `max-width: none`. It runs the full content column: **100 characters per line at 1280, 116 at 1440.** That is roughly 1.5× the comfortable limit. On a big monitor the Statement section is genuinely hard to track back across. This is the page's clearest flaw and the one place where our existing setup is already better.

---

## 5. Colour and material

**Palette (all observed):**

| Token | Value | Use |
|-------|-------|-----|
| Page | `#fafafa` | The shell. Not white. |
| Surface | `#ffffff` | Nav pill only |
| Hairline | `#e5e5e5` | Every rule, every border, every frame |
| Nav hairline | `#efefed` | The nav's bottom border, at 50% alpha |
| Ink | `#000000` | Headings, metric values |
| Body | `#666666` | All prose |
| Muted | `#a8a8a8` | Light eyebrows, metadata labels |
| Meta | `#555555` | Metadata values |
| Chrome | `#aaaaaa` | Back link |
| Rail off / on | `#cccccc` / `#111111` | Tick states |
| Accent | `#0072f5` | Links, back-hover |
| Accent wash | `#e0f0ff` | Inline link-pill background |
| Media ground | `#d9d9d9` | Image placeholder |
| Letterbox | `#111111` | Video block background |
| Wordmark | `#d0d0d0` | Footer |

That's it. Nine greys, one blue, one blue wash. No second accent, no gradients in the chrome — the only colour on the page comes from the work itself.

**How surfaces separate — this is the material thesis:**

**Everything is a 1px `#e5e5e5` line. There is no elevation anywhere in the content.** No shadows, no background shifts, no tinted cards. Images, video blocks, solution cards, and metric cards all get the identical `1px solid #e5e5e5` with `box-sizing: border-box`. Section dividers are that same 1px at full width. The nav pill's border is the same. One material, used at every scale.

**Corner radii — a hard split:**
- **Content: 0px.** Every image block, every card, every frame. Square.
- **Controls: 100px.** Nav buttons, inline link pills, media caption pills. Fully round.
- **Two exceptions:** the nav pill container at 12px, and the hero screenshot's top-left corner only at 8px.

Square content, round controls. It's an unusually clear rule and it means you can tell what's clickable from across the room.

**Cards are mats, not boxes.** The solution and metric cards get `padding: 10px` inside their 1px border, with the media filling the inner area. The border reads as a **frame with a 10px mat**, not as a container with content in it. That 10px is doing the same job a picture frame's white border does. Metric cards then push their content to the bottom (`justify-content: flex-end`) so the number and label sit at the base of the frame.

**Image treatment:**
- Image and video blocks are **`height: 65vh`** — viewport-height driven, not aspect-ratio driven. Every piece of media is the same height regardless of source aspect, and it always fits the screen. Drops to 40vh below 900px.
- `object-fit: cover`, `pointer-events: none` on every image.
- Side-by-side pairs: a flex row, 16px gap, each half flexing to equal width — same 65vh height, so two shots always align perfectly.
- Metric card images are a fixed 224px tall.

**The hero image is the best material move on the page.** It's not a screenshot on a background — it's a *staged* screenshot: a saturated blue ground plane fills the block, and the product screenshot is inset over it at 78% width × 92% height, offset 28% from the left and 5% from the top, anchored top-left so it bleeds off the right and bottom edges. It gets a rounded top-left corner only (8px) and a **directional shadow: `-12px 12px 48px rgba(0,0,0,0.22)`** — offset left and down, i.e. lit from the upper right. Large blur, low alpha, real direction.

That single shadow is what makes a flat PNG read as a physical object sitting on a coloured surface. It's the answer to the "flat CSS chrome is a materials problem" note: one big soft directional shadow on the hero, and hairlines everywhere else.

**Media caption pills:** overlaid on video blocks, pinned 12px from the bottom/left/right, `rgba(255,255,255,0.88)` at 100px radius with `6px 9px` padding, 12px text, and a whisper shadow `0 1px 6px rgba(0,0,0,0.08)`. `pointer-events: none`. They label media without a caption line stealing vertical space, and the translucency ties them to the media underneath. Cheap and very effective.

---

## 6. Motion

**One easing curve for the entire site: `cubic-bezier(0.22, 1, 0.36, 1)`** — a strong ease-out (expo-ish; fast start, long settle). It's declared once at `:root` and reused for the page reveal, the mobile nav panel, and a card-tilt system. The tokens are named and centralised:

```
--stagger-dur: 0.5s      --stagger-distance: 12px
--stagger-stagger: 60ms  --stagger-blur: 3px
--panel-open-dur: 0.4s   --panel-close-dur: 0.35s
```

**Entrance (observed as inline styles, mid-flight):** on load, the content column animates from `opacity: 0, translateY(18px)` to rest, and the rail from `opacity: 0, translateY(-1.8px)`. So the body rises up into place while the rail settles down a hair — a tiny counter-motion that makes the two columns feel like separate objects rather than one fading div. Nice touch, ~2px of it, and you'd never consciously notice.

**The stagger primitive** (used for grouped text lines) animates three properties together: opacity 0→1, `translateY(12px)`→0, **and `blur(3px)`→0**, over 500ms with a 60ms delay between lines. The blur is the unusual ingredient — it's what makes a fade feel like focus-pull rather than a dissolve, and it's why the entrance reads as expensive. There's also an explicit "hiding" state at 200ms with linear transform/filter, so exits are faster than entrances (correct).

**Scroll-linked effects:** none. No parallax, no scroll-scrubbed transforms, no pinning. Sticky positioning on the rail is the only scroll-coupled layout, and the scroll-spy is a class swap. Motion is entrance-only plus micro-interactions.

**Micro-interactions:**
- Rail ticks: 160ms on opacity/width/background
- Rail labels: 160ms opacity
- Back link: 180ms colour
- Nav buttons: 120ms background; `:active` adds `scale(0.97)` at 100ms

**Cost — what's cheap and what isn't:**

*Cheap:* everything above. Opacity/transform/filter only, all compositor-friendly. The 3px blur is the only paint-adjacent property and it's transient. `will-change` is set on the stagger primitive.

*Expensive, and not motion at all:*
- **Two autoplay looping muted videos plus one non-autoplay video**, all `preload="metadata"`, none with a `poster`. Two videos decoding continuously the entire time the page is open is by far the biggest runtime cost here — and with no poster, the frames are blank grey/black until they buffer.
- **Source images are 2520–5040px wide PNGs rendered into 346–1134px slots**, with `loading="auto"` (eager) and no `srcset`. A 5040px PNG for a 558px half-width slot is ~9× the pixels needed. This is the page's real performance problem.
- `transition: all` is set on the shell, which means every future property change becomes an animation by accident.

**Reduced motion:** guarded at the CSS level for the stagger primitive and the mobile nav panel (`transition: none !important`). The page-level entrance is driven by JS inline styles, so I could not verify whether it checks the media query. If we copy the pattern, guard it in both places.

---

## 7. The "premium" moves, concretely

The transferable specifics, in descending order of how much they contribute:

1. **A 1px `#e5e5e5` line is the only material.** One hairline does rules, image frames, card borders, and the nav edge. Zero shadows in content. Consistency at this level reads as intent; a mix of borders, shadows, and tinted backgrounds reads as accretion.

2. **Cards are frames with a 10px mat.** `padding: 10px` inside a 1px border, media filling the inner area. Not a container — a picture frame.

3. **Square content, 100px-round controls.** Two radius values, split by function. Exceptions: 12px on the nav container, 8px on one corner of the hero screenshot.

4. **The 10 / 64 / 1px rhythm.** 10px between everything inside a section, 64px + hairline + 64px between sections. One intra value, one inter value, a ~6.4:1 ratio. Grouping does all the work.

5. **The active tick grows 16px → 28px, not just dark.** Length is peripherally legible; colour alone isn't.

6. **The rail swaps marks for words on hover, in place.** Labels are absolutely positioned at the same origin as the lines; lines fade to 0, words fade to 1, in 160ms, with zero layout shift.

7. **Uppercase metadata labels get +0.5px tracking while everything else gets −0.02em.** Direction flip at 13px caps. Cheapest single typographic win here.

8. **Media is `height: 65vh`, not an aspect ratio.** Every image and video is identical height and always fits the viewport. Side-by-side pairs therefore always align. 40vh on mobile.

9. **One hero shadow: `-12px 12px 48px rgba(0,0,0,0.22)`, offset left-and-down.** Large blur, low alpha, a real light direction, on a coloured ground plane, screenshot bleeding off two edges. One object in one scene.

10. **Metadata sits below the hero image, as five labelled columns 40px apart** (13px uppercase label over 14px value, 6px between them), and one of those columns is a **live product link**. Image earns attention, credentials confirm it.

11. **Media captions are 12px pills at `rgba(255,255,255,0.88)`**, 100px radius, `0 1px 6px rgba(0,0,0,0.08)`, pinned 12px inside the media. Labels without stealing vertical space.

12. **Solution moves have names, and the name is the heading.** Each solution card leads with a short declarative sentence in 40px display type, and that same sentence is the caption pill on the video. The reader gets a slogan they can repeat back.

13. **A whole section for the thing they didn't ship.** Three named constraints, then the cheaper substitute. Most senior-reading content on the page.

14. **One easing curve, tokenised, site-wide.** `cubic-bezier(.22,1,.36,1)` for everything above 200ms.

15. **The entrance blurs 3px→0 alongside the fade and rise.** Focus-pull, not dissolve.

**Explicitly do not copy:** the 100–116 character measure; 5040px eager PNGs with no `srcset`; two autoplay loops with no poster; `transition: all` on the shell; and the rail-and-back-button vanishing together below 900px.

---

## 8. What to steal, ranked

Our case-study pages already have a rail (`.rail` / `.chap` / `.tick` / `.clabel`), a back button, a `--sp-*` / `--fs-*` / `--c*` token system, a 680px measure cap, `.sec { padding-top: var(--sp-72-144) }`, and a `cubic-bezier(.2,.8,.2,1)` house curve. We're ~80% of the way there structurally. So these are *deltas*, not rebuilds — which is why the payoff-per-effort is high across the board.

Ranked by payoff ÷ effort:

---

**1. Move the rail's breakpoint from 1360px to ~900px.**
*Type: CSS (one media query, appears twice — lines ~252 and ~310 of each case-study file).*
*Effort: 10 minutes. Payoff: very high.*

Our rail currently disappears below 1360px, which means it is **gone on a 13" MacBook at 1280 and on nearly every laptop a recruiter will open the site on**. The feature Jayden likes most about the reference is invisible to most of our actual audience. The reference keeps its rail to 900px in a 100px column with a 32px gutter — we have the room. This is the single highest-leverage change on the page.

---

**2. Flip the tick from a vertical mark to a horizontal growing dash.**
*Type: CSS. Effort: ~20 minutes. Payoff: high.*

Ours is a 2px × 14px vertical tick on a 2px hairline track, with the active state changing colour and opacity only. Theirs is a 1px-tall horizontal line that grows **16px → 28px** and goes `#ccc` → `#111`. The horizontal version reads as a progress scale — you perceive position from the length of the dark mark without focusing on it. Drop the `.chapters::before` track while we're at it; the ticks alone are enough, and the track is the thing that makes it look like a widget instead of a margin note.

---

**3. Strip the chrome off the back button.**
*Type: CSS. Effort: 15 minutes. Payoff: high.*

Ours is a bordered box: `background: var(--c50)`, `1px solid var(--c100)`, `8px 16px` padding, 4px radius. Theirs is grey text with an arrow that turns accent-blue on hover, sitting 24px above the tick stack in the same rail. Ours is a *button*; theirs is *chrome that happens to be live*. This matches the "premium = subtract" principle already in our notes — and it unifies the rail into one stack: "leave this page" on top, "move within this page" below.

**Keep our back button in the header on mobile.** Their mobile has no back affordance at all — that's their bug, not a pattern.

---

**4. Adopt the 1px-hairline-as-only-material rule for media and cards.**
*Type: CSS token pass across all five case-study files. Effort: 1–2 hours. Payoff: very high.*

We currently mix `box-shadow: inset 0 0 0 1px rgba(8,8,8,.3)`, `inset 0 0 0 1.5px rgba(8,8,8,.42)`, `inset 0 0 0 1px rgba(8,8,8,.22)`, and `1px solid var(--c100)` for what is conceptually the same edge. That's four materials doing one job. Pick one hairline token, apply it to every image frame, card, board, and rule, and delete the rest.

This is the direct answer to the "photoreal direction" note — the heads are photos and the chrome is flat CSS, a *materials* problem. One material, used everywhere, is what fixes it.

---

**5. Add the 10px mat inside every framed element.**
*Type: CSS. Effort: 30 minutes. Payoff: high.*

`padding: 10px` inside the 1px border, media filling the inner area. It costs almost nothing and it converts every card from "a box with a picture in it" to "a framed picture." This is the specific move behind the "painted / hanging-card board wins" note.

---

**6. Fix the metadata label tracking, and move metadata below the hero image.**
*Type: token/CSS + a small structural move in the hero. Effort: 45 minutes. Payoff: medium-high.*

Two parts:
- **Tracking:** small uppercase labels get **+0.5px**; everything else keeps its negative tracking. Ours currently sets `letter-spacing: .01em` on labels — roughly +0.13px at 13px, a third of what's needed. Nearly free, and it's the detail that separates typeset from typed.
- **Order:** put Role / Team / Timeline / Skills / *Live link* in a 5-column row (40px gaps, 13px uppercase label over 14px value, 6px apart) **under** the hero image. Add a live-product column where one exists. Image first, credentials second.

---

**7. Standardise media height to `65vh` (40vh under 900px).**
*Type: CSS. Effort: 1 hour, plus checking crops. Payoff: medium-high.*

We currently size media with a mix of `clamp()` widths, fixed `aspect-ratio: 720/1565` phone frames, and `max-height: 64vh`. A single viewport-relative height for full-width media means every image is the same size, always fits the screen, and side-by-side pairs align without thought. Keep the phone-frame aspect ratio for actual device shots — that rule is load-bearing (and the "don't shrink phone shots" note stands).

---

**8. Give the solution moves names, and use the name as both heading and media caption.**
*Type: structural + copy. Effort: 2–3 hours per case study. Payoff: very high, but the highest effort here.*

Each solution gets a short declarative sentence in display type — the kind of line a reader can repeat back — and that same line appears as a translucent pill on the accompanying media (12px, `rgba(255,255,255,.88)`, 100px radius, `0 1px 6px rgba(0,0,0,.08)`, 12px inset). Repetition makes it stick. This is the biggest "professionalism" lever on the list, because it's the difference between describing what was built and arguing what mattered. It's editorial work, not CSS.

---

**9. Add a constraints section — the thing you didn't ship.**
*Type: structural + copy. Effort: 2–4 hours per case study. Payoff: very high where the story exists.*

Name the feature you wanted, three concrete reasons it wasn't feasible, and the cheaper thing you built instead. On the reference page this is the single most senior-reading section, and it's the one thing polish cannot fake. Only do it where the story is real.

---

**10. Add the 3px blur to the entrance stagger.**
*Type: token/CSS. Effort: 20 minutes. Payoff: medium (pure texture).*

We already stagger opacity + translate on a near-identical curve (`cubic-bezier(.2,.8,.2,1)` vs their `.22,1,.36,1` — close enough that switching is optional). Adding `filter: blur(3px) → 0` over the same 500ms turns the fade into a focus-pull. It's the cheapest "expensive" cue available. Guard it under `prefers-reduced-motion`, which our existing stagger rules already do.

---

### Not worth taking

- **Their 100–116ch measure.** Our 680px cap is better. Keep it.
- **Their section rhythm (64 + rule + 64 = 129px)** in place of our 144px `--sp-72-144`. Different register — theirs is documentary, ours is editorial. The *ratio* discipline (one intra value, one inter value) is worth internalising; the specific numbers aren't an upgrade.
- **Dropping the back button on mobile.** Ours lives in the header and survives. That's correct; theirs isn't.
- **`transition: all` on a root container.** Guarantees accidental animations later.
