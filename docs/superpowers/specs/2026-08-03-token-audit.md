# Token audit — what the system currently enforces, and what it doesn't

2026-08-03. Companion to `2026-08-02-design-tokens.md` (what the tokens are for)
and `2026-08-03-control-system.md` (what the controls should become).

**This is a point-in-time reading of a tree that is still being edited.** Two
other passes were writing to `index.html`, `header.css`, `tokens.css` and the
five case studies while this ran — one of them landed `--sp-16`, `--sp-20`,
`--sp-24`, `--sp-36`, `--gap-eyebrow` and two responsive rungs into
`index.html`'s local block *between* two runs of the audit, which retired five
findings mid-audit. Treat every number below as a reading, not a fact. The
durable artefact is the tool.

**Re-run it:**

```
python3 tools/token-audit.py                 # shipping pages, human summary + machine tail
python3 tools/token-audit.py --list <key>    # every finding in one category
python3 tools/token-audit.py --json          # full evidence
python3 tools/token-audit.py --scope demos   # the design demos, separately
python3 tools/token-audit.py --root <dir>    # audit another tree, e.g. a git archive
```

Exit code 1 on any ERROR, so it gates a ship the way `tools/hm-check.py` does.
`--strict` promotes warnings to errors for when the system is meant to be closed.

### Scope

| | |
|---|---|
| **Audited (shipping)** | `index.html`, `play.html`, the five case studies, `headmaker.html`, `gradientlab.html`, `tokens.css`, `header.css`, `play.css`, and the seven site JS files |
| **Audited separately** | `specimen.html`, `header-prototype.html`, `accent-swatches.html`, `button-system.html`, `orbs.html` — design demos. Raw values in a demo are the *subject*, not a defect. `--scope demos`. |
| **Excluded** | `index-local-preview.html` — stale build artefact. Excluded deliberately, and the tool prints the exclusion every run so it is never mistaken for an oversight. |

### The error/warning line

**ERROR** = machine-certain defect that renders wrong or fails silently; no
judgement needed, so it can block. **WARNING** = real debt, but deciding whether
a literal is *the same concept* as a token — not merely the same number — needs a
person, and a gate that guesses at intent gets ignored. Three categories are
errors: undefined token with no fallback, conflicting definition, Archivo off the
broadcast boards. Everything else warns.

---

## The reading, 2026-08-03

```
undefined_no_fallback=19      conflicting_definition=3      archivo_off_broadcast=0
tokenisable_literal=34        (1,661 occurrences)
untokenised_literal=125       (916 occurrences)
duplicate_definition=40       incomplete_token_copy=5       sanctioned_rebind=0
distinct_durations=63         distinct_easings=35           control_padding_variants=15
chrome_cast_shadow=6          hover_background_fill=27      tap_target_under_44=23
third_font_family=0           errors=22                     warnings=293    STATUS=FAIL
```

**Drift log — what moved while this was being written.** Three findings retired
mid-audit, which is the argument for the tool in one paragraph:

* `--sp-16` unreachable from `index.html` (`header.css:239`) — fixed by the
  header pass landing `--sp-16/20/24/36`, `--gap-eyebrow` and two responsive
  rungs into `index.html`'s local block.
* `--sp-36`, `--gap-eyebrow`, `--sp-48-64`, `--sp-32-48` undefined on
  `index.html` — same commit.
* `--accent` re-bound to `#0E6B3B` in **both** `gradientlab.html` and `play.css`
  — both re-bindings deleted during the audit window and replaced with comments
  explaining why the name stays blue. `conflicting_definition` 4 → 3 and
  `sanctioned_rebind` 1 → 0. §3 below is kept as the record of what was found.

Against the branch point `f445f43` (`git archive f445f43 | tar -x -C /tmp/base`,
then `--root /tmp/base`):

| | f445f43 | now | |
|---|---|---|---|
| duplicate definitions | 280 | **40** | the extraction working — 240 copies gone |
| Archivo off the boards | 1 | **0** | `.bcNum` moved from `index.html` to `play.css` |
| untokenised occurrences | 3,222 | 916 | + 1,661 now have an exact token to move to |
| undefined, no fallback | 19 | 19 | four names fixed/moved, one new |
| **conflicting definitions** | **0** | **3** | **introduced by this branch** |
| control padding variants | 10 | 15 | got worse |

---

## 1. THE ONE THAT ALREADY CHANGED THE SITE — `--lh-prose`

**Cost: high. Fix: one character.** Blocks shipping.

At `f445f43` all eight pages carried `--lh-prose:1.6`. `tokens.css` was created
carrying **1.5**. The five case studies then deleted their local copy and linked
`tokens.css` — so their prose leading silently moved from 1.6 to 1.5. The three
files that kept their own copy did not move.

```
tokens.css:25          --lh-prose:1.5     ← apollo, bearings, cluster, strata, ucdavis
index.html:48          --lh-prose:1.6
headmaker.html:43      --lh-prose:1.6
play.css:54            --lh-prose:1.6     ← and its comment even records the divergence
```

`play.css:52` documents it — *"this page carries 1.6, tokens.css 1.5"* — so it
was seen and not resolved. This is the exact failure mode the duplicate check
exists for: **the change is invisible in a diff, because it is a deletion of
something that looked redundant.** The five case-study bodies are the longest
prose on the site; a 0.1 leading change across them is the single most visible
uncontrolled change on the branch.

Decide 1.5 or 1.6 once, put it in `tokens.css`, delete the other three.

## 2. `--rim-top` on the home page — the only *new* undefined token

**Cost: medium (one nav state, one page). Fix: one line.** Blocks shipping.

```
header.css:222   .jbNav[data-surface="ink"]{ --nav-rim:var(--rim-i2),var(--rim-top); }
```

`--rim-top` is defined in `tokens.css`. **`index.html` is the one page that does
not link `tokens.css`**, and its local token block does not carry `--rim-top`.
On the home page the whole `--nav-rim` value becomes guaranteed-invalid, so the
ink-surface nav loses its top highlight — on that page only, in that state only.

This is the general hazard of the current arrangement, not a one-off: **every
token `header.css` reaches for has to exist twice**, once in `tokens.css` and
once in `index.html`'s copy, until `index.html` is wired. The same mechanism
already produced and retired a `--sp-16` failure at `header.css:239` during this
audit. Per-page reachability resolution is why the tool can see this; a global
"is this token defined anywhere" check cannot.

Either link `tokens.css` from `index.html`, or add `--rim-top`.

## 3. `--accent` re-bound to green in two places — FIXED during the audit

**Cost: low-medium. Fix: a line of prose or a line of CSS. Resolved 2026-08-03.**

```
gradientlab.html:19    --accent:#0E6B3B      (green)
tokens.css:24          --accent:oklch(52% 0.18 262)   (blue) + #2961CE @supports fallback
```

`tokens.css` named exactly **one** sanctioned re-binding — `play.css`, because on
the Play page "interactive" and "this match is live" are the same signal — and
the tool allowlists that one and reports it as INFO. `gradientlab.html` was doing
the same thing with no such warrant, and it had begun to *fight* `tokens.css`
rather than predate it: the green was already there at `f445f43`, but the page
did not link `tokens.css` then.

**Both re-bindings were deleted while this audit was being written**, and the
name is blue everywhere now. `SANCTIONED_REBINDS` in the tool still lists the
`play.css` accent family; that entry is now dormant rather than wrong, and should
stay until someone decides the Play page will never want it back. Left here as
the record — the class of defect is live even though this instance is not.

## 4. Pre-existing undefined tokens — confirmed, all three

**Cost: low, cosmetic. Fix: trivial. Pre-existing — does not block.**

| token | uses | where | status |
|---|---|---|---|
| `--c400` | 4 | `play.css:223,237,349`, `headmaker.html:169` | confirmed; **pre-existing** (was in `index.html` at `f445f43`, moved with the Play extraction) |
| `--c800` | 2 | `index.html:150,153` | confirmed; **pre-existing** |
| `--pkx` / `--pkr` | 12 | `index.html:702` (one keyframes block) | **new find**, also pre-existing at `f445f43` (line 775 then) |

None carry a fallback, so all silently inherit. `--c400` and `--c800` are ramp
steps that were never cut; the ramp runs 50/75/100/500/600/700/900/950. `--pkx`
and `--pkr` are set by nothing — not CSS, not a `style=` attribute, not
`setProperty` in any of the seven JS files — so that keyframes animation has been
translating and rotating by nothing since before this branch.

One name was **fixed** by this branch: `--fs-caption` in `headmaker.html`.

**The fallback distinction holds.** 25 further uses carry a default —
`var(--w,20%)` in the case studies, `var(--dx,…)`/`var(--rot,…)` in `index.html`
— and are reported as warnings, not errors, because a default is the documented
way to parameterise a per-element value.

## 5. The mechanical wins — 1,661 occurrences, 34 literals

**Cost: high in aggregate. Fix: find-and-replace, ranked.** Warning.

Every one of these is a literal that *exactly equals* a value `tokens.css`
already names. Ranked, because the top line alone is 23% of the total:

| literal | token | n | concentrated in |
|---|---|---|---|
| `cubic-bezier(.2,.8,.2,1)` | `--ease-out` | **386** | index 109, each case study ~52, headmaker 20 |
| `16px` | `--sp-16` | 188 | spread across all nine pages |
| `8px` | `--sp-8` | 131 | index 48 |
| `1px` | `--hair-w` | 120 | **play.css 47**, index 23 |
| `12px` | `--sp-12` | 102 | index 48 |
| `500ms` | `--enter-dur` | 97 | index 22, 13 in each case study |
| `44px` | `--tap-min` | 88 | headmaker 15, play.css 14 |
| `2px` | `--focus-w` | 85 | ~12 per case study |
| `50%` | `--r-full` | 66 | index 21, headmaker 14 |
| `160ms` | `--ease-out-dur` | 58 | evenly, ~8–9 per page |
| `4px` | `--r-2xs` | 50 | index 35, headmaker 15 |
| `18px` | `--ico-md` | 48 | headmaker 13, index 11 |

The shape of this table is the actual finding. **The five case studies are
near-identical multiples of each other** — 52/52/52/49/52 on the easing curve,
8/8/8/8/8 on `160ms`. They are still five copies of one page's CSS, and every
one of these rows costs five edits instead of one. The highest-leverage move on
this list is not any single literal; it is that fixing the case studies is a
5× multiplier on everything.

`--ease-out` is already referenced 88 times as `var(--ease-out)` — so the curve
is written both ways in the same files. Same for `--ease-out-dur` (48 tokenised
vs 58 literal).

Raw density, for tracking:

```
                  px (all)  px (token-covered props)   hex (all)  hex (covered)
index.html            2267        443                        167       29
play.css              1301        286                        217       73
apollo.html            241        180                          9        9
gradientlab.html       123         96                         10        8
```

The brief's figures (index ~372 px / 22 hex, apollo 155 / 9) are the same order
against a slightly narrower property set and a tree several commits older;
`index.html` has grown since. Use the tool's numbers going forward — they are
reproducible, and it reports both denominators so the ratio is honest.

## 6. Motion — the spread is worse than measured, and the collision is real

**Cost: high (it is why two identical-looking controls feel different). Fix: not
mechanical.** Warning.

Confirmed and quantified:

```
ease-out keyword                16 uses
cubic-bezier(.2,.8,.2,1)       386 uses     ← 402 together, and NOT the same curve
```

They sit side by side and are not interchangeable: the keyword has a lazier start
and a softer landing. Every one of the 386 should become `var(--ease-out)`; the
16 keyword uses are a **separate decision** — they are a thirteenth curve wearing
the token's name.

Spread, counting only raw literals (values already written as `var()` excluded):

| | transitions only | incl. animation |
|---|---|---|
| distinct durations | **29** | 63 |
| distinct easings | **14** | 35 |
| motion tokens defined | 2 | 2 |

Transition-only is the number that matters for chrome feel; the animation figures
include keyframe choreography, which is a different problem. The brief's 14/12
lands almost exactly on the transition-easing count. Top duration clusters with
no rung: `200ms` ×90, `250ms` ×53, `375ms` ×50, `180ms` ×19, `150ms` ×17. The
tool proposes placement for each — `200ms` "sits between 160ms and 240ms", and
with 90 uses it is plainly a rung the ladder is missing rather than drift.

Easings with no token: `steps(1,end)` ×28, `steps(2,end)` ×25 (sprite/flap
animation, legitimately not a chrome curve), `ease` ×13,
`cubic-bezier(.22,.61,.36,1)` ×8, and a long tail.

## 7. Control geometry — 15 paddings for one concept

**Cost: medium. Fix: cheap once the control system lands.** Warning.

```
12px 16px  ×13     8px 16px  ×11     0  ×8
var(--sp-8) var(--sp-16) ×2          var(--sp-12) var(--sp-16) ×2
0 0 12px · 8px 12px 8px 16px · 8px 8px · 12px 24px · 7px 11px · 4px 9px · 11px 14px
0 var(--sp-16) · 0 var(--sp-10) · 0 var(--sp-8)
```

The top two account for 24 of 47 and are already tokenised twice under a
different spelling — `12px 16px` and `var(--sp-12) var(--sp-16)` are the same
padding written two ways, in the same codebase. The tail is where it goes wrong:
`7px 11px` (`gradientlab.html:55`, `.miniBtn`), `4px 9px`, `11px 14px`. Off-grid
values on control geometry, with counts: `42px` ×18 (the `.sbBtn` in all five
case studies), `11px` ×2, `9px`, `7px`, `46px`.

`7px 11px` is exactly what `button-system.html` calls it — the fingerprint of
padding to an unnamed height rather than setting one.

**Tap targets under 44px: 23**, but only four distinct controls, replicated:
`.sbBtn` 42×42 and `.playerBar .sbBtn` 42×42 (both ×5 pages, ×2 axes),
`.tvTab` `min-height:36px` (×4), `.mhToggle` `min-height:36px`
(`index.html:789`). 42 is 2px from the rule; 36 is not close.

## 8. Standing rules

**Cast shadows on chrome: 6.** Warning. The filter earns its keep — a naive
`box-shadow` grep returns 78 in these files. Rims (`inset …`), `0 0 0 Npx` rings
(a border by another name), focus rings and the heads' own contact shadow are all
correctly not flagged. What is left:

```
index.html:385    .csInfoCard        0 18px 46px -22px rgba(8,8,8,.42), 0 3px 10px -5px …
index.html:470    .moodMenu          0 8px 28px -8px rgba(18,18,18,.12), 0 2px 8px -2px …
play.css:263      .moodMenu          (the same rule, second copy)
gradientlab.html:91  .panel          0 1px 2px …, 0 18px 44px rgba(20,20,16,.07)
play.css:1305     .hmScore .sbCard   var(--bc-contact),var(--bc-cast),inset 0 0 46px …
play.css:1380     .hmScore.sbHit .sbCard
```

The two `.sbCard` rules are the painted scoreboard plate, which is an *object*
in the photoreal direction, not chrome — they are arguably correct and worth an
explicit exemption in the tool if that reading is confirmed. `.csInfoCard`,
`.moodMenu` (×2) and `.panel` are chrome and are elevating.

**Hover background fills: 28.** Warning. Concentrated: `play.css` 7, three per
case study (×5 = 15), `index.html` 2, `header.css` 1. The case-study three are
one rule set replicated — `.back:hover`/`.talk:hover`/`.skipLink:hover` →
`background:var(--c75)`, `.moodItem:hover`/`.moodBtn:hover`/`.moodGo:hover` →
`var(--c75)`, and the primary buttons → `var(--c900)`. So 15 of the 28 are three
decisions. Note the new header already complies (`header.css` contributes 1).

**Fonts: clean.** Zero Archivo outside `play.css` — the branch fixed the one
violation that existed at `f445f43` (`.bcNum` in `index.html:1027`). Zero third
families. `@font-face` blocks are correctly not counted as uses, since loading a
face is not using it. `index.html` still ships an Archivo `@font-face` it no
longer uses — worth checking, but it is a payload question, not a token one.

## 9. Definition hygiene

**40 duplicate definitions** — 37 in `index.html`, 3 in `play.css`. All of
`index.html`'s are the known local copy of `tokens.css`, and they retire the
moment that page is wired. Down from 280 at `f445f43`.

**5 incomplete copies** — a page took the base value but not the token's other
states, so it is right at one viewport and wrong at another:

```
index.html:46     --accent      without its @supports not(oklch) fallback
index.html:1008   --blur-1      without its @media(max-width:760px){0px}
index.html:1008   --blur-2      without its @media(max-width:760px){0px}
index.html:1006   --sp-32-48    without its @media(max-width:880px){32px}
index.html:1006   --sp-48-64    without its @media(max-width:880px){48px}
```

The two `--blur-*` ones matter most: `tokens.css` zeroes them below 760px because
`--mat-3` with no blur ghosts, and `tokens.css` line ~120 documents that exact
reasoning. `index.html` copied the rung and not the reason.

---

## Verdict

**Not coherent enough to ship as it stands — but the gap is small and named.**

Three things block, and all three are cheap:

1. `--lh-prose` 1.5 vs 1.6, across three files — pick one.
   **This one already changed the site**, on the five longest pages.
2. `--rim-top` unreachable from `index.html` — link `tokens.css` or add the token.
3. The three pre-existing undefined ramp/animation tokens (`--c400`, `--c800`,
   `--pkx`/`--pkr`) — pre-existing, so they do not strictly block *this branch*,
   but they are five minutes' work and the gate will keep failing until they go.

(A fourth, the `--accent` green re-bindings, was fixed during the audit window.)

The system itself is sound. The `tokens.css` extraction removed 240 duplicate
definitions and one font violation and cost four conflicts, three of which are
one decision. What is *not* yet true is that the token layer is load-bearing:
1,661 literals still sit next to a token that already holds their exact value,
and the same easing curve is written both ways in the same file 386 times. That
is debt, not breakage, and it is now measurable per commit.

**The single highest-leverage move is not on this list:** the five case studies
are still five copies of one stylesheet, and they multiply every row in §5 by
five. Until that is one file, every fix here costs five edits.

---

## Notes on the tool, for whoever runs it next

* **Per-page reachability.** A token defined in `index.html` is not defined for
  `play.html`. The tool resolves `<link rel=stylesheet>` and `<script src>` per
  page and checks each `var()` against what *that* page can reach. This is what
  catches finding §2; a global "defined somewhere" check cannot.
* **Scope-aware definitions.** `:root`/`html` definitions are global and get
  compared across files; `.jbNav{--ico-md:16px}` is a scoped re-binding, which is
  the language's own mechanism for local variation and is never a conflict.
  Without this, `header.css:552` reads as a conflict and is not one.
* **At-rule aware.** A file's base value is compared against the canonical file's
  *full* set including every `@media` / `@supports` state, so a responsive
  override is never mistaken for a competing value — and a page that copies the
  base but drops the state gets its own, softer finding.
* **Families are declared by name, not inferred from value.** `--fs-body` and
  `--sp-16` are both `16px`; proposing `--fs-body` for a padding would be
  nonsense. `--fs-*`, `--lh-*`, `--tr-*`, `--blur-*`, `--rail-*` and the
  responsive `--sp-A-B` ladder are excluded from substitution on purpose, and the
  exclusion list is in the source so the decision is on the record.
* **Comments are blanked, not stripped**, preserving byte offsets — so every
  `file:line` is exact, and prose inside a comment (`play.css:20` discusses
  Archivo at length) never trips a check.
* **Known soft spots.** The control-selector heuristic matches class names
  containing `btn|button|chip|pill|toggle|tab`, so it over-reaches on things like
  `.csTabs` and under-reaches on unconventional names. The chrome/not-chrome
  split for shadows is a word list. Both are tuned to under-report rather than
  cry wolf; if the tool ever disagrees with a person, the person is probably
  right and the list should grow.
