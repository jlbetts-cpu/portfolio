# The workspace: what it is, what it should become, and in what order

Written 2026-08-20 from a read of the real source at `~/Desktop/Reshore/lifeline`
(HEAD `1f3aade`, committed Aug 18 14:07 — the bundle shipped in `workspace/` is
that commit) plus the brief Jayden wrote for another tool and handed over today.

**This supersedes `docs/workspace-supabase-plan.md`**, which was written from the
minified bundle without the source. Its reasoning holds; several of its specifics
are wrong. Corrections are in §6.

---

## 0. Read this part first

**Not determined, and honestly:**
- **How much real data is in the app.** IndexedDB lives in his browser profile,
  and that origin is shared with `hmCompanions` (~890 KB of unrecoverable baked
  heads). Nobody read it. Every volume claim below is unmeasured.
- Whether `npm run build` is currently clean — the typecheck was still running.
- Whether the deployed site actually serves `/workspace/`.

**The diagnosis, in one line:**

> **The app is a recorder. He asked for a plan.**

Everything in it is retrospective — days, moods, journals, habit logs, photos.
The entire forward-facing surface is `days.reminders`: an array of untyped
strings with no time, no size, no area, no recurrence. He does not need eight new
tabs. He needs the one entity that is missing.

---

## 1. What it is today

**Stack:** Vite 8 · React 19 · TS · Tailwind 4 · `motion` · `lucide` ·
`@supabase/supabase-js` · `@huggingface/transformers`.

**Storage: IndexedDB `lifeline` v2 only.** Zero `localStorage`, zero
`sessionStorage`, no server. Eight stores: `days` (key `date`), `photos` (index
`byDate`), `habits`, `habitLog` (key `${date}|${habitId}`), `memory`, `books`,
`settings`, `kv`. An in-memory pub/sub bus keyed by store name drives re-renders.

| Tab | What it does |
|---|---|
| **Timeline** | Month calendar under an animated mesh band; year view = 365 mood-coloured dots shaded by habit completion. Day sheet: reminders, mood 1–5, protein check, journal (autosaves 400ms), habit checklist, photo drop |
| **Memory** | Drop zone; "Generate" compiles a deterministic `memory.md` from every other store; "Polish" has Sonnet rewrite it |
| **Habits** | Habits × days grid, mood row, streaks, three charts. Also hosts Goals (max 3) and the Weekly Review |
| **Books** | Socratic one-question-at-a-time reading partner; transcripts per book per day; distils into Memory |
| **Kitchen** | Photograph the fridge → 7-day plan hitting a protein target + grocery list |

**Supabase is written and inert.** `src/lib/sync.ts` (224 lines) and
`supabase/schema.sql` (124 lines) are complete. With no `.env`,
`VITE_SUPABASE_URL` inlines to `undefined` and Rollup shakes the client out.

### Where his "every tab must work without an API key" rule is violated

Three places, precisely:

| Feature | Without a key |
|---|---|
| **Kitchen** | pantry chips and a grocery list that can never populate. **No purpose.** |
| **Weekly Review** | one paragraph and a disabled button. **No purpose.** |
| **⌘K search** | falls back to matching `caption + name + date` — but captions are written *by* Haiku, so with no key there are none. **It searches filenames.** |

Fully functional without a key: Timeline, the habit grid, all charts, journal,
mood, year view, Memory's Generate.

### Interconnection: more than he thinks, but every arrow points one way

Real links already shipped — Kitchen's protein target → Timeline check-off;
Habits grid ⇄ Timeline day sheet; Books finish → Memory; weekly-review answer →
journal; ⌘J → journal; Goals → injected into every AI prompt.

**Every arrow points *into* Memory or the journal. None point out.** That is
exactly why Memory reads as "the thing you do when you're done."

### Design-system drift from the portfolio

| | Portfolio | Lifeline | |
|---|---|---|---|
| Family | Geist | Geist | ok |
| Weights | 400 / 600 | 400 / **500** / 600 (19 × `font-medium`) | **third weight** |
| Ink | `#090b24` | `#090b24` | already identical |
| Radius | 28 / 20 / 14 ladder | one `--radius: 4px` + hardcoded 10 / 8 / 3 / 2 | different device |
| Motion | 100/160/240/280/360/500 | JS springs + CSS 150/240/360 | only 240, 360 overlap |
| Shadow | heads only — **absolute** | **six `shadow-2xl` on chrome** | **direct violation** |

**Internally incoherent colour:** the stylesheet header names ultramarine
`#0000FE`, the token block defines Apple blue `#0071e3`, and `applySiteTheme()`
actually paints Glacier `#64a5dd`. Three blues, one existing only in a comment.

**The best idea in the file** is `--band-h` (`app-shell.tsx`): a ResizeObserver
publishes the sidebar's top-block height so the Timeline gradient's bottom edge
lands on the *same pixel row* as the sidebar divider. That is the structural
instinct the portfolio borrowed for play's margin rails.

### Dead and half-built

- **`museum.tsx` (216 lines) is dead** — nothing imports it; `grep -c museum` on
  the 472 KB bundle returns **0**.
- **11 of 12 month palettes are dead** — `paletteFor(_month)` ignores its
  argument and always returns January. ~90 lines of HSL maths, one colour.
- **Habits have no cadence.** `possible = habits.length × nDays`, and the weekly
  review hardcodes `possible: 7`. **A 4×/week gym habit reads as 57% adherence
  forever.** This is the most guilt-generating line in the app and it lands
  directly on his brief.
- **The Stack Builder generates `anchor: "after I …"` and throws it away** —
  `HabitRecord` has no anchor field.
- **Reminders have no time**; `notify.ts` polls hourly and only while a tab is
  open. For time-blindness that is the wrong half of the feature.
- **`.env` is not in `.gitignore`.**
- **A rebuild ships a silent regression.** `vite.config.ts` has no `base`, and
  the portfolio's copy of `index.html` was hand-patched for `/workspace/` and
  self-hosted fonts. Rebuilding today emits `/assets/…` and re-adds the Google
  Fonts request the portfolio deliberately removed.
- **21.6 MB of ONNX WASM** is committed to the portfolio repo to make one nicety
  faster.

---

## 1.5 The standing constraint: legible at a glance

Jayden, 2026-08-20: *"Make sure the interface stays minimal I need it to look and
function with ease anyone should be able to understand what each page does."*

**This outranks every feature in this document.** Anything below that cannot be
built while satisfying it should be built smaller, or not built.

The test to apply, per surface, before committing: **a person who has never seen
this app opens this tab — can they say what it is for, without a tooltip, a
tour, or a label explaining the label?** If the answer needs a sentence of
explanation, the surface is wrong, not the explanation.

What that means in practice here:
- **One job per tab.** Today is for starting. Areas is for seeing what has gone
  cold. Week is for the three anchors and the backlog. Timeline is for his
  record. Memory is for professional reference. If a tab needs two sentences to
  describe, it is two tabs or it is one tab with something in it that belongs
  elsewhere.
- **A surface with nothing to say stays silent.** Phase 3 established this and it
  is now the rule: no empty sparklines (five pale bands read as a failed skeleton
  loader), no column of zeros on a fresh install, no "0" in a corner on an empty
  morning.
- **Every number on screen must be one the app measured**, and must be readable
  without knowing how it was computed.
- **Premium is subtraction** — his most repeated instruction, and every phase so
  far has deleted something after looking at screenshots rather than at numbers.
- **No new vocabulary.** The words on screen should be his: areas, sessions,
  anchors, backlog. Not "streaks", "scores", "adherence", "compliance".

## 2. The rhythm: cues, not clocks

Store every recurring practice as a **cue → action pair with a size**, never a
time. *"After I make coffee → 20 min reading."*

This is the best-supported primitive available:
- Implementation intentions: **d = 0.65** across 94 independent tests, N > 8,000
  (Gollwitzer & Sheeran 2006, *Adv. Exp. Soc. Psych.* 38, 69–119).
- **d+ = 0.99** in clinical samples, 28 experiments (Toli, Webb & Hardy 2016,
  *Br. J. Clin. Psychol.* 55, 69–90).
- ADHD-specific: if-then plans restored Go/NoGo inhibition **to non-ADHD control
  level** (Gawrilow & Gollwitzer 2008, *Cog. Ther. Res.* 32, 261–280) — small lab
  samples, not long-run RCTs. Do not oversell this one.

**The mechanism is already half-built.** Add `anchor` to `HabitRecord`, surface
it on the row, require it on manual add. Two lines of schema turn the habit grid
into an implementation-intention store and stop the Stack Builder discarding its
own best output.

**Weekly shape: three fixed anchors, everything else a menu.** Gym ×3 (a body
rhythm, not a timetable), one weekly review, one "ship something" block. The rest
is a per-area backlog he *pulls from*.

> **Honest caveat.** Rigid-vs-flexible scheduling in ADHD has **zero primary
> studies**. Every source claiming otherwise is a clinic page or app marketing.
> The adjacent evidence — time-reproduction deficits, delay aversion, elevated
> intra-individual variability — makes clock-anchored plans a bad bet, but this
> is a reasoned hypothesis, not a finding. It is the interesting thing to *test*
> in a case study, which is itself portfolio material.

---

## 3. Eight areas without eight guilt engines

Make **`Area` a first-class entity**: id, name, colour, and a target-per-week
expressed as a **range**. Habits *and* sessions belong to exactly one. His eight:
reading, communication, gym, product design, friendships, applications, acting,
modeling.

**Kill the per-habit streak. Show area weight instead:** for each area,
**sessions per week over the last 8 weeks**, plus a "last touched" date. Eight
sparklines. No consecutive counters, no zeros shouting at him.

> **Corrected 2026-08-21, in Phase 3.** This paragraph originally said
> "last-28-days share of days touched". That was a second unit for an idea that
> already had one: the `areas` store shipped in Phase 1 holds
> `weeklyTarget: {min, max}` in SESSIONS PER WEEK, and the chips Phase 2 draws
> count sessions this week. Two units for one measure is how a number comes to
> mean different things on two screens, and a target expressed as a weekly
> range cannot be compared against a 28-day percentage without inventing a
> conversion. **Sessions per week wins** — it is what the database keeps, what
> a finished session increments, and what a range is written in. "Days touched"
> also silently discards the second session of a day, which is real work.
> The sparkline is therefore sessions per week across recent weeks, with the
> target range drawn into it as a band, plus a last-touched DATE.

The evidence cuts both ways, and neither way is what the internet says:
- **Pro-streak is real:** an RCT with **60,000 students** found streak
  highlighting raised usage and maths achievement (Aulagnon et al. 2025, *Econ.
  Educ. Rev.* 109). Gamification for physical activity: **g = 0.42, decaying to
  g = 0.20 by ~2.5 months** (Mazeas et al. 2022, *JMIR* 24(1), e26779).
- **The anti-streak claim is fabricated.** The circulating "63% more likely to
  abandon after missing a day" traces to habit-app blogs with no citation. What
  *is* published: Lally 2010 found **missing a single opportunity did not
  measurably impair habit formation.** The punishment is a UI invention.

So: forgiving by default — percentage of days, never consecutive days.

**What justifies a tracker existing at all** is self-monitoring itself: 138
studies, N = 19,951, **d+ ≈ 0.40**, larger when progress is physically recorded
(Harkin et al. 2016, *Psych. Bulletin* 142(2), 198–229). That argues for **one
visible log, not eight scoreboards.**

> **This section argued both sides and Phase 3 had to settle it.** "One visible
> log, not eight scoreboards" sits two paragraphs from "eight sparklines".
> Resolution as built: eight rows exist, but a row with nothing to say stays
> SILENT — no sparkline on an area with no history (five pale bands read on
> screen as a failed skeleton loader), and no count on an area never started (a
> fresh install opened on a column of eight zeros). One log when there is one
> thing to report; eight only once eight are real.

**Fix the cadence bug before anything else here.** Until `possible` comes from a
habit's own cadence, every non-daily practice is a permanent failure on screen.

**For the creative areas, prompt learning goals, not output goals.** Locke &
Latham's own moderator inverts on novel/complex tasks — a learning goal beats a
performance goal there (Seijts & Latham 2005). *"Try three layout systems this
week,"* not *"finish the case study."* This is a prompt change, not a feature.

---

## 4. What Memory becomes

Today it is a one-way funnel whose every input is personal, so of course its
output is personal. Make it the **professional reference library the other tabs
read from**:

- **Tags + area on memory items.** A photo dropped into Memory is a *reference*,
  not a timeline memory — different intent, already a different store.
- **Point the MiniLM embedder at Memory items.** It currently indexes only
  Timeline photo captions. Aimed at Memory, ⌘K becomes design-reference search
  **that works with no API key** — the one place the 21.6 MB earns its keep.
- **Add a Work-context section:** companies applied to, the pitch, case-study
  status, what a given employer cares about. This is the data the Applications
  area needs, and it makes the tab useful *before* he is done.
- **Make it read *out*.** Books already writes into Memory. Add the reverse:
  starting a product-design session surfaces three references from Memory. That
  is the precise fix for "it doesn't have a use-case other than when you're
  done."
- **Cut "Polish."** A Sonnet call that rewrites a deterministic file can only add
  drift.

---

## 5. The workflow element

A **Session**: pick an area → pick or type the smallest next action → pick a size
(15 / 30 / 60) → start. While running, a visible remaining bar and **nothing
else**. On stop, one line of what happened, which appends to the day's journal
and increments the area.

`Session` is the unifying entity. It replaces untyped reminders, it is what a
habit tick becomes, it feeds the area sparkline, and it is what the weekly review
reads.

Graded justification, because he asked for statistics and deserves the real ones:
- **Visible time** — the deficit is strong (Zheng et al. 2022, *J. Atten.
  Disord.* 26(2): time reproduction, medium effect, 26 studies, n = 2,364). The
  *fix* is weak: Wennberg 2018 is n = 38 and multi-component; Hallez & Vallier
  2025 (n = 44) found reduced anticipatory anxiety **d = 0.42 but no performance
  gain.** Ship it as an anxiety/on-task aid. The "visual timers make you 40%
  faster" figure is vendor SEO with no traceable source — do not use it.
- **Smallest-viable-step** — behavioural activation, 26 studies, n = 1,524,
  **SMD = −0.74** (Ekers et al. 2014, *PLOS ONE* 9(6), e100100). That is
  depression evidence, not ADHD. Say so.
- **Pair a dull block with something enjoyable** (temptation bundling): +51%
  decaying (Milkman 2014, *Mgmt Sci.* 60(2)), replicated at **N = 6,792** as
  +10–14% durable to 17 weeks (Kirgios et al. 2020, *OBHDP*). Modest and real.
- **Body doubling** — the only peer-reviewed work is a 220-person descriptive
  survey (Eagle et al. 2024, *ACM TACCESS* 17(3)) and an n = 12 VR study. **No
  RCT.** Build it if he wants it — a shareable "Jayden is working, 24 min left"
  link is cheap — but **put no number next to it.**
- **Do not build anything premised on "unfinished tasks nag you."** The Zeigarnik
  memory effect failed meta-analytic replication (2025, *Humanities & Social
  Sciences Comms*, doi:10.1038/s41599-025-05000-w).

**Notifications: anchor them or cut them.** Currently a bare string, hourly poll,
only while a tab is open. Either reminders get a time and a real scheduled
notification, or the toggle goes. Honest expectation: a tailored push moved
next-24h engagement by **~3.9 percentage points** (Bidargaddi et al. 2018, *Ann.
Behav. Med.* 52(5)); fixed generic pings habituate to zero.

---

## 6. What to cut

Premium is subtraction, and this is where it applies:

> **KITCHEN IS NOT CUT. REVERSED BY JAYDEN, 2026-08-20:** *"instead of removing
> kitchen I think maybe a rework like it should do the same with the api but add
> to it making it useful without api. Like the books sections is also useless
> without api just make them useful on top of the api so I can use it daily but I
> do think eating right is an important part of any day."*
>
> He is right and this section was wrong. The rule he set is "every tab must have
> a purpose without an API key" — and the correct response to a tab that fails it
> is to give it a keyless core, not to delete it. Deleting was the lazy reading.
> Eating is a daily practice, which makes Kitchen a candidate for the same
> treatment the rest of the app is getting: an AREA with SESSIONS and a HABIT,
> with the model as a layer on top rather than the load-bearing wall.
> The same applies to Books, for the same reason and by the same instruction.

1. **Kitchen — REWORKED, NOT CUT.** Keyless core: his own saved meals with their
   protein values, a manual pantry, a grocery list he can build himself, and the
   protein target he already tracks per day. The Sonnet fridge-photo plan stays,
   layered ON TOP of that — it fills the same structures rather than being the
   only way to fill them. Ties into the existing protein check-off on the day
   sheet so the daily practice is one thing, not two.
2. **Books — REWORKED, NOT DEMOTED.** Keyless core: the shelf, progress, and his
   own notes and quotes, with reading recorded as SESSIONS against the Reading
   area (which is one of his eight). The Socratic partner stays as the layer on
   top. Quotes still flow to Memory.
3. **Museum** — dead source, already tree-shaken, imported by zero files. Delete.
4. **Eleven month palettes** — `paletteFor()` ignores its argument.
5. **Memory → Polish.** A Sonnet call that rewrites a deterministic file can only
   add drift.
6. **Local AI toggle as it stands** — either it becomes Memory's retrieval engine
   (then it is load-bearing and stays) or the 21.6 MB goes.
7. **Six `shadow-2xl` sheets** and **the third font weight.**

Nav afterwards: **Today · Week · Areas · Timeline · Memory · Settings.**

> **CORRECTED 2026-08-20, and it was a dangerous error.** This line originally
> read *Today · Week · Areas · Memory · Settings* — with no Timeline. Timeline
> owns the `days` store, which is where his journals, moods and photos actually
> live, and §6's own cut list never cuts it. As written, the nav would have
> removed the only way to read his own writing while leaving the data on disk.
> Caught during Phase 3 by an agent reading the cut list against the nav rather
> than implementing the nav faithfully. Timeline stays.

---

## 7. Build order

### Phase 0 — unblock the rebuild (half a day; nothing ships before it)
`vite.config.ts` needs `base: "/workspace/"`. The self-hosted font `<style>`
block and the `/workspace/`-scoped manifest must move **into the source repo**.
Verify by diffing `dist/index.html` against the tracked `workspace/index.html`.
Add `.env` to `.gitignore`.

### Phase 1 — data model, local only
IndexedDB **v3**: add `areas` and `sessions`; add `anchor`, `areaId`, `cadence`
to `habits`; **stamp `updatedAt` on every record in every store** (only `days`
has one today — "last write" is unknowable without it, and this is the cheapest
moment to add it). Fix the adherence denominator so `possible` comes from
`cadence`, and stop the weekly review hardcoding `possible: 7`.
`onupgradeneeded` seeds his eight areas; existing habits land in "unsorted";
`habitLog` keys unchanged.

### Phase 2 — Session runner + Today
The workflow element. Depends on Phase 1 only. **This is the phase that changes
his day**, so it should land before anything cosmetic.

### Phase 3 — Areas + Week
Sparklines (sessions per week over 8 weeks, last-touched), the three anchors,
the pull-from-backlog menu. Needs Phase 2 to have produced data.

### Phase 4 — Memory rework
Tags/area, Work context, `embed()` aimed at memory items, "pull reference" from a
session. Needs Phases 1 and 2.

### Phase 5 — the cuts
After Phase 4, so Kitchen's protein check-off has somewhere to live first.

### Phase 6 — Supabase, last

**Verdict on the old plan: the reasoning still fits; the specifics are wrong.**
Corrections, worst first:

1. **`pullAll` destroys the local journal.** It calls `saveDay(...)` for every
   cloud row unconditionally — cloud wins, silently, no conflict UI. **Do not
   press "Restore from cloud" on a device holding newer writing.** Also
   `saveDay` stamps `updatedAt: Date.now()` on write, so a pull rewrites every
   timestamp and the next push claims everything just changed.
2. **No deletes propagate.** Nothing is ever removed from the cloud; `pullAll`
   filters by local id set, so the two devices diverge quietly. The old plan's
   soft-delete design is right.
3. **`pushAll` re-uploads every full-size original on every press.** Free tier is
   1 GB. **Sync only the thumb, from day one** — the Timeline never renders the
   original.
4. **Bucket is `lifeline`, not `workspace`.** Paths are `<uid>/photos/<id>/full`
   and `/thumb`, and `<uid>/memory/<id>`.
5. **The old §2.3 verification query reads `1`, not `4`, and that is a false
   alarm.** The shipped schema uses one `for all` policy per table —
   functionally equivalent for a single user. Assert
   `rls_on AND rls_forced AND policies >= 1`. **Do not let an agent "fix" a
   working system to satisfy a number.**
6. **`force row level security` is genuinely missing.** Add it. That one is real.
7. **Type drift — the two DDLs cannot both be run.** Source: `days.reminders` is
   `jsonb` (plan said `text[]`); `days.updated_at` is `bigint` epoch-ms (plan
   said `timestamptz`); PKs on `habits`/`photos`/`books`/`memory_items` are
   composite `(user_id, id)`; `book_sessions` does not exist (sessions are a
   jsonb array inside `books`); `memory_items` carries `has_blob boolean`, not
   `storage_path`. Pick one and write it down.
8. **Magic-link redirect is broken as written.** `signInWithOtp({
   emailRedirectTo: window.location.origin })` — on `jaydenbetts.design/workspace/`
   that origin is the *site root*, so the link returns to the portfolio home, and
   in the installed PWA it opens the system browser. Switch to `verifyOtp` with
   the `{{ .Token }}` template.
9. **Do not start this until Phases 1–4 land.** The schema changes underneath it;
   migrating a model you are about to replace is the expensive mistake.
10. **Never syncs:** `anthropic_api_key`, `local_ai`, `notify_*`, and photo
    originals. Keep `storageKey: 'jb-workspace-auth'` and **never
    `localStorage.clear()`** — `/workspace/` shares an origin with
    `hmCompanions`.

### Risk order
1. Pull clobbers the journal (§6.1).
2. Rebuild loses base path + self-hosted fonts (Phase 0).
3. Storage: full-size originals against a 1 GB tier.
4. `.env` untracked but not ignored.
5. **Non-risk today:** `hmCompanions` is safe from this app — it touches
   IndexedDB only, zero `localStorage`. **That changes the moment supabase-js is
   switched on**, which is exactly why the `storageKey` line matters.

### The honest framing on Supabase
It is single-user and effectively single-device-at-a-time. Supabase buys two
things: a backup he does not have to remember to click, and phone↔laptop. If
Phases 0–5 land and he uses it daily on one machine, **a scheduled "Export all
data" is a legitimate answer and Supabase is a want, not a need.**
