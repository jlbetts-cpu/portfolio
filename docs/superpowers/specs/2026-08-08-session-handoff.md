# Session handoff — 2026-08-08

Written so the next session can restart the agents cold. Everything below is
committed and pushed. Nothing is only in someone's head.

## Where the code is

| | |
|---|---|
| **Working branch** | `codex/time-of-day-hero` @ `7fa1a45` — pushed |
| **Worktree** | `/Users/jaydenbetts/Downloads/portfolioo_v392/.worktrees/time-of-day-hero` |
| **`main`** | `b494843` — pushed, green, **does not contain any of this work** |
| **Gates at `7fa1a45`** | `hm-check.py` syntax OK · `token-audit.py` errors=0 STATUS=PASS (211 warnings) |
| **Preview** | `python3 -m http.server 4231 --bind 127.0.0.1` from the worktree. **Never `localhost`** — it resolves to a different session's worktree. Stylesheets carry `?v=` queries, so hard-reload or use a fresh port. |

`7fa1a45` is a **WIP snapshot taken mid-flight**, not a finished state. Gates pass
but three features are half-built. Details per lane below.

## What each lane was doing, and where it stopped

### 1. Full-bleed hero + head transform — **in progress**

Owns: `index.html` (hero region), `hero-time.css`, `hero-head-transform.js`,
`tokens.css` (head tokens).

Agreed design, in order of what was still outstanding:

- **Full-bleed on all four edges, no corners.** The principle to preserve: the
  radius ladder governs *objects* — cards, media, controls. The hero is not an
  object, it is the environment the page sits in. Everything else stays a
  rounded card *because* the hero stopped being one. **Do not give it a partial
  radius as a compromise** — that reads as a mistake.
- **The bottom gap.** `.hero` was `min-height: calc(100svh - 88px)`. That 88px is
  header clearance subtracted back out; once the header floats over the hero,
  **that subtraction is the gap**. Unit choice is a real trade: `100vh`
  overflows on a phone with browser chrome shown; `100svh` reintroduces the gap
  when chrome retracts; `100dvh` stays flush but the height changes on scroll.
  For a gradient backdrop `100dvh` is usually right — a height change is
  invisible, a gap is not. Add `env(safe-area-inset-*)`.
- **Retune all six radial gradients.** They are authored `radial-gradient(103%
  102% at 50% 102%, …)` against a 1200px box. Full-bleed spreads the same
  percentages and flattens the focus. **This is a retune, not a re-parent** — it
  is the bulk of the work.
- **Bottom fade.** `.heroTimeGradient::after` already fades the *top* (page
  colour → transparent across 28%). Mirror it downward so the hero becomes light
  falling into the page rather than a coloured rectangle.
- **Header legibility on colour.** It is a light pill; at night the gradient
  under it is near-black. Must hold across all six times of day.
- **`width:100vw` includes the scrollbar** → horizontal overflow. Assert
  `document.scrollWidth === innerWidth` at every width.

Head transform, four separate complaints with four found causes:

- **Cannot move up:** `safeRect()` returns `top: Math.min(h.bottom, c.bottom + gap)`
  — the ceiling is the *bottom of the copy block* plus `--hero-head-safe-gap`.
  Loosen, but the clamp exists to stop the head covering the headline, and this
  site has twice had the hero headline pushed out of view. Prefer letting the
  head pass *behind* the copy in z-order over deleting the clamp.
- **Cannot shrink:** `--hero-head-min-scale: .78` (max `1.35`). Both too tight.
- **Cannot return to its start position — a genuine logic bug.** The resting
  position has the head cropped by the hero's bottom edge, but `objectRect()`
  clamps `Math.min(r.bottom, h.bottom)` and `safeRect()` returns `bottom: h.bottom`,
  i.e. full containment. **The start state is illegal under its own clamp**, so
  once you move the head that position is unreachable. Fix by clamping on
  *reachability* (a minimum visible portion) rather than containment.
  **Hard requirement: the resting position must satisfy whatever rule replaces
  it — assert that in `tools/hero-head-transform-contract.py`.**
- **Rotation, not yet built.** Add `state.rotate` + `--hero-head-rotate` written
  from the existing `writeTransform()` — do not add a second transform
  mechanism. Rotate about the head's own centre; transform order matters or the
  head swims under the cursor. Snap near 0° so there is a way back to level.
  The selection outline must keep hugging the head (a rotated element's bounding
  box is larger than the element). Verify clamps at 45°, where extents are largest.

Portrait treatment: **"too contrasty"** and **"lower the transparency"** are one
perceptual problem — the head reads as a hard cutout pasted *on* the sky rather
than *in* it. Work inside the existing system
(`docs/superpowers/specs/2026-08-06-readable-portrait-lighting-design.md`,
`.heroPortraitTintDefs`, `#heroPortraitTintFilter`). Order to try: **lift the
blacks** first (most of the harshness lives in the deepest shadows and this keeps
the eyes readable), **let the sky tint the head** so it belongs to the scene at
all six times, and only then a modest opacity drop. The eyes must stay alive —
they are the charm. The contact shadow stays; the head is standing on something.
Show a day/night side-by-side comparison, not a single result.

### 2. Conventional footer — **in progress**

Owns: `footer.css`, `about.html`, `apollo.html`, `strata.html`, `bearings.html`,
`cluster.html`, `ucdavis.html`. **Not `index.html`** — hand that page's footer
markup over as a ready-to-apply patch while the hero lane holds the file.

Reference: Eric Le's portfolio footer — identity block left (logo, name,
`© 2026`), three link columns right with bold headings and muted links.

Adapted, deliberately: **Menu** = Work / About / **Play** (his real
destinations; there is no Resume page — do not invent a dead link). **Socials** =
LinkedIn + Instagram only (no Spotify). **Contact** = Email. Decide honestly
whether three columns survives this content volume or whether two better-filled
ones read stronger — **do not pad with invented links**.

- **"Open to full-time roles" must survive.** The reference has no slot for it.
  It is the highest-value line in the footer while he is job-hunting; it belongs
  in the identity block near his name, reading as status rather than a link.
- **The giant "Jayden Betts" wordmark STAYS — but it must earn its place.**
  Jayden asked to remove it and then reversed within minutes: *"actually maybe
  keep the big Jayden Betts, but I would make it feel more cohesive — right now
  it just feels like it's there, not even pertaining to anything."*
  **The complaint is not size or placement, it is that the wordmark is
  unattached.** It reads as decoration dropped at the bottom of the page rather
  than as part of the site. Do not solve this by shrinking it or by deleting it —
  solve it by giving it a relationship to something.
  Directions worth weighing, strongest first: **make it the footer's actual
  identity** so the columns hang off it rather than sitting beside an unrelated
  slab; **let it join a system that already exists** — it can take the
  time-of-day tint like everything else on this branch does, so at night it is
  night-coloured and it stops being a static block; or **let the companion head
  interact with it**, standing on it or peeking over it, which is the site's own
  established language and the reason the heads cast contact shadows. Pick one,
  and say why the others were rejected.
- Footer must be **byte-identical on every page that has one** — it has drifted
  before. `tools/footer-consistency-check.py` exists for this.
- **`play.html`, `headmaker.html` and `gradientlab.html` deliberately have no
  footer.** Full-viewport tools cannot scroll to one; their header Contact points
  at `index.html#contact`. That exception stands.
- Must work in **all six time-of-day states** — the night theme reaches the
  footer on this branch.

### 2b. Work-card captions are being clipped — **diagnosed, not fixed**

Jayden: *"the thumbnail section cuts off letters at the bottom, because of the
corner rounding."* Screenshot shows the Apollo card's caption with the year
`2026` clipped on its right edge and `Apollo` tight against the bottom.

**It is not the corner rounding.** `.csName` (`index.html:412`) and `.csYear`
(`:414`) both carry **`filter: url(#inkBig)`**, and `<filter id="inkBig">` is
declared with **no `x` / `y` / `width` / `height`**, so it falls back to the SVG
default filter region: `x="-10%" y="-10%" width="120%" height="120%"` of the
object bounding box. An ink filter displaces pixels *outward*; 10% of a short,
wide string's box is only a few pixels, so glyph edges are pushed straight
outside the region and clipped. **A short wide element like a four-digit year is
the worst case**, which is exactly where he saw it.

Fix by giving the filter an explicit, generous region — start around
`x="-25%" y="-25%" width="150%" height="150%"` and verify the clipping is gone
at every size the filter is used at, rather than only on the year. **Check all
three ink filters** (`#inkBig`, `#inkSm`, `#inkEye`); they are declared the same
way and share the flaw. `#inkBig` is used 6× on `index.html` and 1× on
`apollo.html`.

Related history worth knowing: an unresolvable `filter: url()` makes Chrome drop
the element entirely — that already cost this project a round when the eye rig
vanished on `play.html`. These filters are load-bearing; widen the region, do not
remove the filter.

### 3. Component-system adoption — **audit done, fixes not started**

Audit committed at `017259c`:
`docs/superpowers/specs/2026-08-08-component-adoption-audit.md`. Read it first.

Headline finding: **the shared system is a new layer sitting beside the old ones.**
Combined adoption ≈ **30%** (controls 36–42%, surfaces 15.4%).

The fix list it produced, roughly in leverage order:

1. **`.ctl` has three independent definitions.** `controls.css` owns one;
   `headmaker.html` (inline L227) and `gradientlab.html` (inline L166) each carry
   a private copy *under the same class name*, and **neither page links
   `controls.css`**. The copies read raw primitives (`--tap-min`, `--sp-16`,
   `--r-md`) instead of the `--ctl-*` semantic layer, so retuning the library
   silently skips them. Already diverged: `.ctl--primary` computes
   `rgb(18,18,18)` with **no rim** there vs `rgb(17,18,20)` with
   `inset 0 0 0 1px rgba(17,18,20,.12)` everywhere else.
2. **The library breaks the site's own no-shadows-on-chrome rule.**
   `--ctl-menu-shadow` carries `0 2px 8px` and `0 1px 2px` drop layers under its
   rim — measured live on `#heroTimeMenu` and `.moodMenu`. Cheapest,
   highest-leverage fix on the list.
3. **`about.html` is 0/17 adopted** and does not link `controls.css`. Its
   `.abLink` is already a structural `.ctl` clone (44px / `--r-md` /
   `0 var(--sp-16)` / 400) — it should simply *be* one.
4. **Missing states.** `.ctl` is the only family with all six. **26 of 27 one-off
   families have no disabled state; 14 have hover but no `:active`** — on touch
   that means a tap gives no feedback at all.
5. **`.baGo` is a `<span>` with `tabIndex −1`** on apollo and ucdavis: looks
   exactly like a button, unreachable by keyboard. `.jbHome` has no focus ring on
   all ten pages.
6. **`--theme-duration` is 640ms on index and 400ms on the other nine.** One
   token, visibly inconsistent across nav, footer and social ink.

Clean bills of health, do not re-litigate: two font weights (400/600) everywhere;
**zero 44px misses at any width** (the 38px nav is rescued by a measured 44px
`::after`); the sanctioned inline-prose exception holds exactly — 45.5px on a
25.5px pitch at 390, 50px on a 30px pitch at 1440, the same ratio scaled.

## Correction to carry forward

**`token-audit.py` DOES catch literals shadowing tokens** (37 findings / 1028
occurrences). An earlier note in this project claimed otherwise; that was wrong.
What is true: it reports `chrome_cast_shadow=5` and `tap_target_under_44=1` and
still prints `STATUS=PASS`, because those are WARNINGs. **Green means zero
errors, not zero findings.** Its real blind spots are `line-height`, cascade
resolution, and that `controls.css` is outside `SHIPPING_CSS`.

## Contract tools

**30 of 34 pass.** Three of the four failures are collateral from the concurrent
hero edit in this worktree (changed hero markup, `?v=` on the `hero-time.css`
link) — **not system defects. Re-run once the hero lane lands** before treating
any of them as real.

## Standing rules that outlive this session

- **Never `localhost`** — two servers on different IP stacks; it resolves to
  another session's worktree. Use `127.0.0.1` on a port you own.
- **Never `mcp__claude-in-chrome__*`** — it drives Jayden's real Chrome and his
  live `localStorage`, which holds ~890 KB of real baked heads. Read it, never
  write it. Snapshot `hmCompanions`/`hmCompanion` before any test that writes.
- **Cache-busting a page URL does not bust its external CSS or JS.**
- **Stage only your own files:** `git commit -- <paths>`. Never `-a`, never `add -A`.
- **A stylesheet that reads correctly is not the same as one that runs
  correctly.** This project has been bitten three times: a stray `}` silently
  deleted the site's control base rule so a declared `min-height:44px` computed
  `0px`; a radius rule never won a single declaration; `--lh-prose` drifted
  1.6 → 1.5 invisibly. **Measure computed values; read the CSSOM to prove a rule
  is live.**
- **A measurement can tell you a value is unusual. It cannot tell you it is
  wrong.** A 45% photo crop looked alarming in a table and was the composition
  Jayden had chosen.
- **No cast shadows on chrome.** The companion heads cast contact shadows
  because they are standing on something — that is load-bearing. Chrome
  separates with hairlines and translucency.
- **Nothing scrolls that should not.** Where content does not fit, the answer is
  reduction, not a scrollport.
- **The soccer chaos is a feature.** Never propose anything that makes the match
  calmer, tidier or better-spaced. Dead time is the enemy; disorder is not.
- **Jayden judges visually and cannot assess anything until it is built.** Ship
  it, then show him, with screenshots at 1440 and 390.
