# Kickoff prompts for the next session

Paste **Prompt 0** first. Then run the others in order — each is self-contained
and assumes only that the repo and the brief exist.

Reading order for the assistant: this file →
`docs/superpowers/specs/2026-08-02-next-chapter-brief.md` →
`docs/superpowers/specs/gradient-reference-notes.md` →
`docs/superpowers/plans/2026-08-02-broadcast-match.md`. The per-task history and
residual verifications live in `.superpowers/sdd/2026-08-02-broadcast-match/progress.md`.

---

## Prompt 0 — orientation (paste this first)

> Read `docs/superpowers/specs/2026-08-02-next-chapter-brief.md` end to end
> before doing anything, then `docs/superpowers/specs/gradient-reference-notes.md`.
> The repo is a no-build single-file portfolio (`index.html`, ~809 KB) with a
> separate WebGL gradient builder (`gradientlab.html`) and a study set
> (`orbs.html`). `main` is live and deployed. Branch `broadcast-match` has Plan 3
> Task 1 (the goal grammar) done and Tasks 2–4 pending.
>
> Shipped in the final session (all on `broadcast-match`, pushed): the goal
> grammar plus its three review fixes (`557a037`), colour-locked egghead names —
> Red is always Gus (`036dd55`), and a side-aware goal card that now appears at
> the end where the goal happened (`5be5665`). Two known bugs are logged with
> leads: §3.4 the scorer misattribution ("Jayden scored" when he wasn't playing)
> and §3.4b captains floating above the other heads.
>
> Confirm you've read them by telling me, in your own words: what's live, what's
> in flight, what the measured performance verdict was, what the two open bugs
> are, and what the build order is. Then stop and wait — don't start building yet.

---

## Prompt 1 — the Play page (do this first; biggest perf + UX win)

> Extract everything playable — soccer, tournament, Floor is Lava, marble race,
> the companion heads engine and all its canvases — out of `index.html` and onto
> a dedicated `play.html`, following §3.2 of the brief.
>
> Requirements: the home page must end up with **zero** game rAF loops and zero
> game canvases (measure before/after and show me the numbers). The Play menu
> stays on the home page but becomes navigation into `play.html`. `play.html`
> gets a persistent top-left back affordance to the portfolio, full-viewport
> stage, and carries over the `?stand=1` test hooks and the seeded-roster
> harness. Saved heads (localStorage) must work identically on both pages.
>
> Use superpowers:brainstorming first to settle the extraction boundary with me
> — the companion engine is one large IIFE with cross-block globals
> (`__hmBus`, `__hmSess`, `__hmSlow`, `__hmFxAt`, `__bcMat`), and how those move
> is the whole design. Then write the plan and execute it task-by-task with the
> subagent-driven workflow. Verify live in foregrounded real Chrome.

---

## Prompt 2 — the scorer identity bug

> Fix the "Jayden scored when he wasn't playing" bug per §3.4 of the brief. The
> diagnosis is already written there: identity is matched by comparing cut
> data-URL strings, tournament respawns re-encode those images, and identically
> dyed eggheads collide.
>
> Give every spawned player a stable id threaded through
> `spawnCompanion`/`buildTeams`, resolve scorer names via `tm.slots` →
> `playersOf(tm)`, and make the fallback the **team name** — never the visitor's
> own head. Prove it with a live tournament where a non-captain squad-mate
> scores and the lower-third names them correctly, and where the visitor's head
> is not on the pitch and is never credited.

---

## Prompt 3 — the floating-captain bug

> ~~Egghead names~~ shipped 2026-08-02 (commit `036dd55`) — skip; this slot is
> now the floating-captain bug.
>
> In a tournament match some heads (typically the captains) sit visibly higher
> than their squad-mates instead of sharing one ground line. §3.4b of the brief
> has the lead: head size is per-head, and around `index.html:5089–5091` `HH`
> is recomputed (`HH = HW*1.2`, with a `*1.5` branch for the filler) **without
> `floorY` being recomputed in the same pass**, so a head whose box changed size
> seats against a stale floor.
>
> First verify: log `HW/HH/floorY/y` per head one frame after a fixture starts
> and find the heads whose `floorY` disagrees with `groundY − HH`. Then fix by
> recomputing `floorY` (and the shadow placement) in the same block that mutates
> `HW/HH`. Do **not** nudge `y` to hide it — the rule is that every head's FEET
> share the ground line whatever its size; the filler's size is its identity,
> not a depth cue.

## Prompt 4 — the iOS system (corners, motion, materials)

> Build the iOS design pass from §3.5 as a **token layer first**, then apply it
> site-wide across `index.html`, `play.html`, `gradientlab.html` and all
> case-study pages.
>
> Radius scale 6/10/14/20/28 with the concentric rule (inner = outer − padding).
> Corner smoothing via `corner-shape: squircle` alongside `border-radius` as
> progressive enhancement; use a generated squircle `clip-path` only where
> cross-browser parity genuinely matters, and keep `box-shadow` and focus rings
> on an unclipped wrapper (clip-path clips both — accessibility trap).
> Also adopt: spring easing (`linear()` sampled from a real spring, or
> `cubic-bezier(0.34,1.56,0.64,1)`), the translucency + blur material ladder
> instead of heavy shadows, hairline rims, 44×44 minimum targets.
>
> Before applying anything, show me a specimen page with the old and new
> treatment side by side at desktop and 390px so I can approve the feel. Respect
> the existing type system (two weights, 400/600) — this is corners, motion and
> materials only.

---

## Prompt 5 — gradients into the design system + the match banner

> Two parts, in order.
>
> **(a) Tokenise the engine (§3.1).** Ship `FluidMesh` as a documented site
> component: a named config contract, a token layer mapping a team/cup hue to a
> node palette, and the static CSS fallback for no-WebGL. Keep the full engine on
> its own route only.
>
> **(b) The match banner (§3.6).** Build the gradient bar above the soccer
> surface from the two teams' colours — but read §3.6 first, because the research
> changed the approach: **CSS, not WebGL.** Gemini's own effect is a CSS
> translated gradient; Apple's Siri glow uses no shaders. With 63 rAF loops
> already live, an always-on WebGL banner is the wrong trade. Interpolate with
> `color-mix(in oklch, …)` so the two colours never mud, animate
> `background-position`, and follow the broadcast precedent: two solid zones with
> a short interpolated seam, symmetrical, so the bar never implies a winner.

---

## Prompt 6 — twelve teams and the final standings

> Implement the 12-competitor tournament from §3.7 and §3.8: single elimination
> on a 16-slot bracket, byes to seeds 1–4, 11 matches plus an explicit 3rd-place
> playoff = 12 total. Rank 5–12 by round eliminated, tiebroken by seed, to
> produce a complete, defensible 1–12 finishing table at the end of a cup.
>
> Bye slots render as muted "ghost" cards with an auto-advance beat — never empty
> boxes. The final standings screen should be beautiful and copyable.
>
> Important: the UI must **never** mention fantasy football or drafts. It is a
> finishing table, which is honest on its own terms. Also confirm the Draw Board
> ticket layout still holds at 12 competitors on mobile.

---

## Prompt 7 — finish the match presentation

> Continue `docs/superpowers/plans/2026-08-02-broadcast-match.md` from Task 2.
> Task 1 (the goal grammar) is done, reviewed and fix-rounded on branch
> `broadcast-match`. Build Task 2 (director layer), Task 3 (suspense ticker) and
> Task 4 (personas + crowd) with the subagent-driven workflow, one task per
> dispatch, reviewing between each.
>
> Reuse the `.hmCamBack`/`.hmCamFront` camera wrappers Task 1 created (exposed as
> `window.__hmStagePunch`) rather than building new ones. Remember: the
> scoreboard never moves, and live-play verification requires Chrome
> foregrounded because rAF freezes in background tabs.

---

## Prompt 8 — performance sweep (after the Play page lands)

> Run the performance work from §2 and §6 of the brief. Specifically: collapse
> the many `requestAnimationFrame` loops onto one shared ticker; add
> `IntersectionObserver` pausing to every animated surface (rAF pauses for hidden
> *tabs* but not for offscreen elements); audit which of the 71 `filter: blur()`
> declarations can paint simultaneously and cut that number down (mobile
> comfortably handles ~3–5 blurs).
>
> Measure before and after under 4–6× CPU throttling, report long tasks (>50 ms)
> and INP from the Interactions lane, and show me the numbers side by side.
