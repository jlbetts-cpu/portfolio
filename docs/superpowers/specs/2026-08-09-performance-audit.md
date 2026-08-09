# Performance audit — "everything feels laggy"

**Date** 2026-08-09 · **Branch** `codex/time-of-day-hero` · **Instrument** `tools/performance-probe.py`

> Jayden: *"There seems to be a lot of smooth problems when resizing, just existing on the site — everything feels laggy."*
> Jayden: *"Honestly we need to get this site to at least 60 frames, because it's a website."*

---

## Answers up front

| Question | Answer |
|---|---|
| **The single biggest cost** | The hero float loop reads `getComputedStyle(document.documentElement)` **219 times a second** at idle — five times a frame, each one immediately after writing to the same element. Every call forces a full-document style recalculation. It is on `index.html`, the page recruiters open first. |
| **Measured idle frame rate, before → after** | On a **quiet** machine, `index.html` at 1440: **24.2 fps → 59.0 fps.** `play.html` lobby with twelve heads at 1440: **17.3 fps → 41.9 fps.** See the honesty note below — this machine was not quiet for most of the audit, and these are the numbers I trust least. |
| **The one number that best characterises the site's responsiveness** | **`index.html` spends ~300 ms of every second recalculating style while nothing at all is happening** — about 30% of one CPU core, at rest. That is why it "feels laggy just existing": there is almost no headroom left, so the moment anything else competes it falls off a cliff. Measured at 255–372 ms/s across every run, on both a GPU and a software rasteriser. |
| **Is the site at 60fps?** | **No, and I cannot certify 60fps from this environment.** Fixed: the landing page's idle cost and the whole resize path. Still short: soccer (~36 fps) and battle (~18 fps) on a real GPU, both paint-bound. Those need a decision from Jayden, not a silent edit — §5. |
| **Biggest single lever still on the table** | Nothing cheap. The eyes have been dealt with **without touching the ink** (§5·P1). What remains is battle at ~18 fps, which is fill-rate, and needs a decision rather than a refactor (§5·P2). |
| **Accessibility defect found and fixed** | `prefers-reduced-motion` on `play.html` cost **more** than leaving motion on — 62.8 style recalcs/sec against 45.7. Now **1.7/sec**. |
| **Largest waste found** | The home page pulled **1.14 MB (DPR 1) / 3.16 MB (DPR 2)** of case-study variants on every visit through detached `Image()` objects, defeating all seven `loading="lazy"` attributes. Now **392 KB / 1.13 MB**. |

**The regression that caused this.** `hero-head-transform.js` carries a 16-line comment recording a previous fix to exactly this loop — *"The steady-state loop now reads nothing from the DOM at all — it only writes."* The brief asked me to verify that was still true. **It was not.** One uncached `rootNumber()` call had come back inside `place()`, which runs once per selection handle per frame.

**That regression is now closed** — the lighting agent landed the fix in `8ca6d6c`; `--selection-handle-size` is cached out of `place()`. More importantly, **the invariant now has a guard**: `tools/performance-idle-contract.py` fails the moment any read reappears in that loop, and proves it can fail via `--self-test`. A comment that documents an invariant nothing enforces is a comment that will be false again — §7.

---

## 1 · How this was measured, and what you should believe

The embedded browser pane is not a performance instrument — it backgrounds tabs (throttling rAF), renders at the wrong scale on ink-filter pages, and rasterises in software. I did not use it. I built `tools/performance-probe.py`: Playwright-driven Chromium with backgrounding and timer throttling disabled, counting frames actually delivered inside the page over a fixed wall-clock window, plus CDP `Performance` integer counters, plus a shim that blames every forced-layout DOM read on the function that made it.

**Sanity check that the instrument discriminates:** a page pinned to vsync reports exactly `60.0 fps / 16.7 ms median / 0% dropped`; a page missing frames reports the lower number with the drops visible in p95 and worst. Both appear in the results below, so the harness is not simply reporting whatever it is given.

### What I trust, in order

1. **Forced-layout DOM reads per second, attributed by call site.** Integer counts. Load-independent. This is the backbone of the audit and every headline claim rests on it.
2. **`LayoutCount` / `RecalcStyleCount` per second.** Integer counters from CDP; no rasteriser or CPU contention moves them.
3. **Style/script/layout milliseconds.** Honest but machine-relative. Consistent across runs here, so quoted — but as an order of magnitude.
4. **Frame rate.** *Directional only on this machine.* See below.

### The honesty note about frame rate

**Load average on this Mac reached 77–85 during the audit** — other agents are working in this repo concurrently. Under that contention the same page measured 58.7 fps and 17.4 fps an hour apart with no code change. A three-rep interleaved A/B taken at load ~80 produced *lower* fps for the patched build than the unpatched one, purely as noise, while the integer counters over the identical runs showed the patch working exactly as designed (DOM reads 168/s → 54/s, recalcs 45.8/s → 22.5/s).

So: **the fps figures in this document are directional, and the counters are the evidence.** Where I quote a before/after fps pair, the two halves were taken back to back under the same conditions. I would want to re-run the whole suite on a quiet machine before anyone treats a specific fps number as a target that has been hit. Software-rasteriser paint costs are additionally pessimistic — headless measured battle at 2.7 fps where a real GPU measured 17.8 fps, a 6× difference. Ranking held; magnitude did not.

---

## 2 · Findings, ranked by measured impact

### F1 — The hero float loop forced a full-document style recalc five times a frame · `hero-head-transform.js` · **fixed by the lighting agent in `8ca6d6c`**

`floatFrame()` → `syncSelection()` → `place()`, once per selection handle. `place()` writes four custom properties to the handle and then, two lines later, calls `rootNumber("--selection-handle-size", 8)`, which is a `getComputedStyle()` on `document.documentElement`. Write-then-read on the root of a 200 KB document is a forced synchronous style recalculation, and it happens five times per frame, forever, on the landing page.

The value read is a **constant**. It cannot change without a resize, and `metrics()` is the cache that resize already invalidates — every other value in that loop is already stored there.

| index.html @1440, idle | before | after patch |
|---|---|---|
| `getComputedStyle` on root, per second | **218.8** | **0** |
| All forced-layout DOM reads, per second | 280 | **56** (−80%) |
| Style recalcs per second | 45.8 | **22.5** (−51%) |
| Frame rate (quiet machine) | 24.2 fps | **59.0 fps** |

**The patch** — two lines, already validated by the probe's `--patch hero-handle-cache`:

```js
// in metrics(), alongside the other cached values:
    handle:rootNumber("--selection-handle-size",8),

// in place(), replacing the getComputedStyle:
   var reach=(m.hit-m.handle)/2;
```

Reproduce with `python3 tools/performance-probe.py --pages index --patch hero-handle-cache --attribute`.

**Status:** landed. `8ca6d6c` caches `--selection-handle-size` out of `place()`. The loop's comment is true again — and, for the first time, something checks it (§7).

---

### F2 — The eyes read layout after writing it, once per eye per head per frame · `play-engine.js` · **fixed, committed**

`_frame` read `o.box.offsetWidth` on the line directly below the one writing `o.box.style.transform`. Two eyes on twelve heads is **24 forced synchronous layouts every frame, forever**. Measured at **2,736 layout reads across a single window drag** — more than every other source on the page combined.

The eye box width is a function of the head's size and nothing else, and `HW` is exactly that number. Now cached against `HW`, re-measured only when a head actually resizes. A zero is never cached (the box has no width until the portrait lands).

### F3 — `survey()` runs once per head on every resize *event* · `play-engine.js` · **fixed, committed**

A window drag emits resize events faster than frames arrive. `survey()` is registered per head, reads the hero rect, writes the head's width/height/shadow/reflection, and the next head then reads the rect back out of the dirtied tree. Twelve heads turned one event into twelve read-write-read cycles. Now coalesced to one frame — the same discipline `heroBox` already applied to scroll, one event source over. `survey()` also took two `getBoundingClientRect()` of the same element with no write between them; the second is now the first.

Soccer's `layout()` and the battle tower's `build()/render()` are coalesced identically — `build()` re-creates every rung element and was doing so dozens of times per drag.

### F4 — `placeInk()` measures the nav on every resize event · `header.js` · **fixed, committed**

Reads two live rects, writes four style properties, ran once per event. The pill is only ever *seen* once a frame. Now rAF-coalesced.

**Measured effect of F2–F4 together** (60-step drag at 1440, twelve heads seated, back-to-back runs):

| | before | after |
|---|---|---|
| Idle forced-layout reads/sec, lobby @1440 | 278 | **57** (−79%) |
| Idle forced-layout reads/sec, soccer @1440 | 314 | **108** (−66%) |
| DOM reads across one drag | 7,497 | **3,247** (−57%) |
| Style recalcs per drag step | 48.8 | **6.3** (−87%) |
| Long-task time during drag | 249 ms | **0 ms** |
| Frame rate, lobby @1440 | 17.3 fps | **41.9 fps** |

`play-engine.js` no longer appears anywhere in the idle forced-layout list. Every read that remains at idle belongs to `updateIris` in `hero-engine.js` (F5).

---

### F5 — `updateIris()` reads geometry inside its write loop · `hero-engine.js` · **open, patch below**

Runs every frame on **both** pages. Takes `stage.getBoundingClientRect()`, then per eye reads `getBoundingClientRect()`, `offsetWidth` and `offsetHeight` *inside* a loop that also writes `e.iris.style.transform` and `e.el.style.transform` — so the second eye reads back out of the tree the first eye dirtied. ~63 forced-layout reads/sec, and after F1–F4 it is **the only remaining idle read source on either page**.

**The patch** — batch the reads ahead of the writes, which is a mechanical change and does not alter a single output value:

```js
 var _eyeGeom=eyeEls.map(e=>{const r=e.el.getBoundingClientRect();
   return {r:r,ow:e.el.offsetWidth||r.width,oh:e.el.offsetHeight||r.height};});
 eyeEls.forEach((e,_gi)=>{const _g=_eyeGeom[_gi],r=_g.r;var ecx=r.left+r.width/2;
   /* ...unchanged... */ var ow=_g.ow,oh=_g.oh;
```

### F6 — `prefers-reduced-motion` cost **more** than motion on `play.html` · **fixed**

The brief asked whether reduced motion genuinely stops work rather than just hiding motion. Measured over a 5-second idle window:

| | script ms/s | style recalcs/s | layouts/s |
|---|---|---|---|
| `index.html` normal | 16.9 | 55.0 | 47.2 |
| `index.html` **reduced** | **2.9** | **1.2** | **0.0** |
| `play.html` normal | 35.3 | 39.0 | 5.4 |
| `play.html` **reduced** | **24.7** | **64.6** ⚠ | 0.0 |

`index.html` passed cleanly. **`play.html` did not**: someone asking for less motion was getting *more work*. Two causes, found by bisecting rather than guessing.

**(a) The head loop's reduced-motion branch wrote six properties per head per frame from frozen inputs.** Reduced motion freezes `x` and `y`, so twelve heads redrew an identical picture 72 times a frame, forever. It now writes only when a signature of its inputs changes.

**(b) `party.js` injects the disco CSS copied verbatim out of `index.html` — but not the reduced-motion guard, which lives further down that file.** Because `party.js` injects at *runtime*, its copy landed after every linked stylesheet and **outranked the identical guard `play.css` already carries**, silently re-enabling the animation site-wide for anyone who had asked for stillness. `.discoDot::after` animates `background-position` — a paint property — so it cost a style recalculation per frame.

Bisected on `play.html` under reduced motion: that one selector was the **entire** idle load — **60.8 recalcs/sec against 2.0** with it stopped. Killing every companion head on the page changed nothing by comparison (61.2/sec).

| play.html, idle | before | after |
|---|---|---|
| Style recalcs/sec under reduced motion | **62.8** ⚠ (worse than motion-on) | **1.7** |
| Script ms/sec under reduced motion | 21.5 | **11.6** |
| Layouts/sec under reduced motion | 0.0 | 0.0 |

`index.html` is 1.3 recalcs/sec, so the two pages now behave the same.

### F6b — The lava heat haze shimmered from page load, forever, at `opacity: 0` · **fixed**

`hmHazeWob` animates a transform, which would normally ride the compositor for free — but `.hmLavaHaze` carries `backdrop-filter`, and **Chromium cannot composite an animation on a backdrop-filtered layer**, so it fell back to the main thread. The element is created at load and is invisible outside a lava fight, so every visit to Play paid a main-thread animation to shimmer something nobody could see. It now runs only while it is actually on screen.

### F7 — Both crumb textures 404, and always have · `hero-engine.js:813` · **fixed**

The line wrote the background image inline and got it wrong twice: it asked for `crumbtex.**png**` when the only file that has ever existed is `crumbtex.webp`, and 45% of the time for `texttex.png`, which — checked against every commit in the repository, not just the current tree — **has never existed in any format**. So nearly half of every crumb 404'd from the day it shipped, and because the value was written inline it beat the correct one that `.crumb` already declares in both `play.css` and `index.html`.

The inline write is gone; the stylesheet supplies the texture. The position randomisation stays — that was the part doing real work, stopping every crumb from showing the same corner of the sheet.

**One thing for Jayden:** the `isText` branch wanted a *second*, text-grained crumb variant. There is nothing to restore — the asset was never made. If that look is still wanted, it needs drawing; I have not invented one.

### F8 — Page weight · **the preload is fixed**

Not the cause of the lag, but worth knowing. `images/earth-map-src.jpg` (2.51 MB) is **correctly never served** — the four matches are all prose in comments. Its generated descendant `earth-disc.webp` is not referenced either, so all three earth assets (3.26 MB) are dead weight in the tree, along with four unreferenced `*-rung.jpg` files and 91 KB of `@font-face`-less woff2.

Two live issues:

- **`time-aware-thumbnails.js` preloaded 1.14 MB (DPR 1) / 3.16 MB (DPR 2) of case-study variants on every first visit** via detached `new Image()`, which **bypasses all seven `loading="lazy"` attributes on index.html**. Lazy hints a script defeats are worse than no hints, because the markup looks optimised. `Promise.all` made every project hostage to the slowest decode, and one rejection abandoned the entire state change into an empty handler.

  **Fixed.** Each project is now independent, and each image gets what its own markup asked for. The test is a single flag that needs no layout read: *has the browser already fetched this one?* An image on screen is `complete` with a real `naturalWidth`; a lazy image below the fold is not. One already showing is decoded before the swap, so it never flickers; one the browser has not fetched is simply pointed at the new source and stays exactly as lazy as it was declared.

  | First load, no scrolling | before | after |
  |---|---|---|
  | Variant files fetched | 6 | **2** |
  | Variant bytes, DPR 1 | 1,142,238 | **391,916** (−66%) |
  | Variant bytes, DPR 2 | 3,162,910 | **1,126,736** (−2.04 MB) |
  | All image bytes, DPR 2 | 4,122,600 | **2,086,426** (−49%) |
- **`hero-engine.js:300` fetches 25 decoration images (468 KB) 900 ms after load on both pages**, for imagery that is invisible unless an easter egg fires. It is not gated by `__hmHeroHeadOnly`, so `play.html` pays it too — where it is 84% of that page's entire image payload.

Also: **0 of 11 `<img>` on index.html declare `width`/`height`** (8 of 66 site-wide), and `time-aware-thumbnails.js` swaps `src`/`srcset` on them after load, so nothing is reserved against reflow.

---

## 3 · Frame rate by page, game mode and viewport

Twelve placeholder heads seated at boot via `__hmPlaceholderCount` — a one-head lobby is not the workload anyone complained about, and the marble race refuses to start with fewer than two racers. **GPU rasteriser, before my fixes**, so this is the "hard case" table the brief asked for:

| page / mode | 1440 | 390 |
|---|---|---|
| index — idle | 58.8 fps · **299 ms/s style** ⚠ | 54.5 fps |
| play — lobby | 46.3 fps | 49.0 fps |
| play — soccer | **36.2 fps** · 31% dropped | 45.8 fps |
| play — tournament | 59.8 fps ✅ | 60.0 fps ✅ |
| play — marble race | 57.7 fps | 57.7 fps |
| play — battle | **17.8 fps** · 65% dropped | 33.8 fps |

Tournament and marble race are genuinely fine. Soccer and battle are the problems, and both are **paint-bound**, not script-bound — their layout and style counters are low while frames are long. Note both scale hard with pixel area (battle 17.8 → 33.8 fps at the smaller viewport), which is the signature of fill-rate cost.

---

## 4 · What I changed

**`887cada`** — `play-engine.js`, `header.js`, `tools/performance-probe.py`

- Eye box width cached against head size (F2)
- `onResizeFrame()`; `survey()`, soccer `layout()`, battle `build()/render()` coalesced to a frame (F3)
- Duplicate `getBoundingClientRect()` in `survey()` removed (F3)
- `placeInk()` coalesced to a frame (F4)

**`a3bbe6e`** — `play-engine.js`, `party.js`, `hero-engine.js`, `time-aware-thumbnails.js`, tests, `tools/performance-idle-contract.py`

- Eye transform writes elided when unchanged, so the ink filter stops re-rasterising an identical picture (P1)
- Reduced-motion head branch writes only when its frozen inputs change (F6a)
- `party.js` reduced-motion guard restored for the mood dots (F6b)
- Lava haze animation runs only while on screen (F6b)
- Crumb texture 404s removed (F7)
- Thumbnail preload respects `loading="lazy"` (F8)
- `decide()` uses the shared `heroBox` instead of its own rect — found by the new contract
- `tools/performance-idle-contract.py` added (§7)

`hero-engine.js`, `party.js` and `time-aware-thumbnails.js` sit outside my original lane and were changed on the coordinator's instruction; `hero-engine.js` was uncontested at the time.

**Contracts:** `hm-check.py` **PASS** · `token-audit.py` **PASS** · `performance-idle-contract.py` **PASS** (and `--self-test` **PASS**) · `time-aware-thumbnails`, `time-thumbnail-integration`, `play-viewport-owner`, `site-theme-controller`, `site-theme-state` all **OK** · `time-aware-thumbnails-browser.py` 4 states OK across all three viewports. `shared-surfaces-contract.py` and `hero-specimen-check.py:52` were already failing at baseline and are not mine.

**Nothing was removed to buy frames.** The float, the lighting, the ink, the reflections, the shadows, the soccer chaos and the time-of-day system all behave exactly as before. Every change is a measurement or a write that stopped being repeated — not a feature that stopped happening.

---

## 5 · What I did not do, and what it would buy — **Jayden's call**

These are architectural, and the brief was explicit that they should be proposed with a number rather than done silently.

### ~~P1 · The eye ink filter~~ — **resolved without touching the ink**

The instruction was to bake the filter rather than delete it, and to check properly before concluding. Here is the check.

**First: is the ink actually load-bearing?** Rendered at 4x and compared side by side, with the iris frozen so the two frames are comparable:

- **With `filter: url(#inkEye)`** — the iris is a ragged, irregular, hand-inked disc.
- **Without it** — a geometrically perfect circle. It reads exactly like a CSS gradient pasted onto a photograph.

That is the "pasted-on cutout" reading the whole head rig exists to avoid, so **deleting it was confirmed off the table**, not assumed. 3.1% of pixels differ on the hero head; at companion size (7.6 x 3.5 px) the difference is smaller but still visible under magnification, so I would not call it free there either.

**Then: why is it expensive?** Not because it is drawn — because it is *recomputed*. `#inkEye` is an `feTurbulence` feeding an `feDisplacementMap`, and Chromium re-runs that graph whenever the filtered subtree is dirtied. `_frame` wrote a transform to the eye box, lid, iris and glint **every frame regardless of whether the value had changed** — and the gaze offsets are `Math.round()`ed while the lid string is constant when nobody is blinking. Most of those writes set a property to the value it already held, and bought a full displacement-map re-rasterisation, per eye, to produce an identical picture.

**So the fix was to stop asking, not to stop drawing.** Writes are now elided when the value is unchanged. Measured share of eye transform writes that were no-ops:

| | writes attempted | actually written | **elided** |
|---|---|---|---|
| lobby, 12 heads | 4,624 | 898 | **80.6%** |
| soccer, 12 heads | 4,144 | 2,183 | **47.3%** |

Soccer gains roughly the same ~7 fps that deleting the filter was worth — **without deleting it**. The ink is byte-for-byte as authored, and no baked asset was needed.

**Baking remains available if more is needed**, but it is not a small change and I did not do it speculatively: the displacement field is anchored in the eye box's coordinate space while the iris translates within it, and iris/sclera colours are per-head data (`ic`/`sc` in every head record). A faithful bake therefore means a tinted alpha mask per eye state, not a flat sprite. Worth it only if soccer still misses 60 after P2.


### P2 · Battle is still the worst mode on the site — **partly fixed, the rest is a decision**

**Fixed already:** the haze animation ran from page load, forever, at `opacity: 0`, on the main thread because `backdrop-filter` blocks compositing (F6b). Every visitor to Play was paying for it whether or not they ever started a fight. It now runs only while it is on screen.

**Still open, and it needs you.** `.hmLavaHaze` carries `backdrop-filter: blur(1.4px) url(#hmHeatFilter) brightness(1.06) saturate(1.2)` — a backdrop-filter *with an SVG filter in the chain*. A backdrop-filter forces a readback of everything behind it; the SVG filter in the chain forces the whole thing off the fast path. Alongside it sit a WebGL canvas and a 2D crust canvas at full hero size.

Software-rasteriser ablation (directional — a real GPU is kinder): hiding the two lava canvases moved battle from 2.7 → 35.5 fps; hiding the haze alone, +2.1 fps. On a real GPU battle sits at **17.8 fps** and scales hard with pixel area (33.8 fps at 390), which is the signature of fill-rate cost.

Cheapest real win: **drop `url(#hmHeatFilter)` from the backdrop-filter chain and keep `blur()` + `brightness()` + `saturate()`**, which stays on the accelerated path and looks near-identical — the SVG turbulence is doing subtle work behind a band that is already blurred. Beyond that, sizing the canvases to their visible band rather than the full hero is the structural fix. I have not done either: the first is a look change, and the second is a rewrite of the lava's geometry.

### P3 · Batch every head's writes into one pass

Twelve heads each schedule their own rAF and each write their own transforms. They cannot be batched by the browser as separate callbacks. One loop that reads everything, then writes everything, would cut the remaining per-head overhead and make the reflection and shadow updates free riders. Larger change; worth doing only if P1 and P2 do not get soccer to 60.

---

## 6 · The invariant now has a guard — `tools/performance-idle-contract.py`

The most useful thing in this audit is not the fix. It is that **the same comment had already been written once, and was false again by the time anyone re-read it.** `hero-head-transform.js` documented "the steady-state loop now reads nothing from the DOM at all", and a `rootNumber()` call had quietly moved back inside `place()`. A comment that documents an invariant nothing enforces is a comment that will be false again.

So there is now a contract. It counts every forced-layout DOM read an idle page makes — `getBoundingClientRect`, `getComputedStyle`, `offset*`, `client*`, `scroll*` — attributes each to the exact function and line, and fails on anything not explicitly allowed. `floatFrame` and the per-head `_frame` are declared **must-read-nothing**: a single read attributed to either fails the run outright, whatever the totals say, because those two have history.

Three things make it worth trusting rather than just green:

**It selects the portrait before measuring.** `syncSelection()` returns immediately unless the head is selected, so `place()` — the function the regression actually lived in — never runs on a page nobody has clicked. A contract that measured only the untouched page would have watched the float loop in the one state where the bug is invisible, and passed. It hard-fails if it cannot select, rather than passing blind.

**It proves it can fail.** `--self-test` re-injects the original regression — one `getComputedStyle` on the document root, per frame, inside the float loop — and requires the contract to catch it. Verified catching it at **53.2 reads/sec**. A detector nobody has watched fail is a detector nobody should trust.

**It found something on its first run.** `decide()` was taking a fresh `hero.getBoundingClientRect()` inside the per-head loop — the exact thing `heroBox` exists to prevent, multiplied by the size of the crowd. I had missed it; the contract had not. Fixed in `a3bbe6e`.

The `ALLOWED` list is deliberately uncomfortable to add to: each entry needs a reason and a measurement, and the contract prints a NOTE when an allowance stops firing so it can be deleted rather than rotting into fiction.

```bash
python3 tools/performance-idle-contract.py            # pass/fail
python3 tools/performance-idle-contract.py --verbose  # show what is allowed and why
python3 tools/performance-idle-contract.py --self-test # prove the detector still detects
```

**When it fails, do not raise the budget.** Cache the value against something that already invalidates on resize — `metrics()` in `hero-head-transform.js`, `heroBox`/`HW` in `play-engine.js`, both of which exist for precisely this — or hoist the read out of the loop.

---

## 7 · Reproducing any of this

```bash
# the contract -- run this one in CI
python3 tools/performance-idle-contract.py               # pass/fail on idle DOM reads
python3 tools/performance-idle-contract.py --self-test   # prove the detector still detects

# the instrument -- run this one when investigating
python3 tools/performance-probe.py                       # every page, mode and viewport
python3 tools/performance-probe.py --headed              # real GPU (headless rasterises in software)
python3 tools/performance-probe.py --attribute           # blame every forced-layout read by call site
python3 tools/performance-probe.py --patch no-eye-elision # A/B a candidate fix in one process
python3 tools/performance-probe.py --ablate no-eye-filter,no-ink,no-haze   # price one suspect at a time
```

The probe fails loudly if a `--patch` substitution stops matching, so a patch cannot quietly become a no-op after the file moves on. **Run it on a quiet machine** — see §1.
