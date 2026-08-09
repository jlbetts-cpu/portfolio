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
| **Biggest single lever still on the table** | The eyes. Two per head, twelve heads, each carrying `filter: url(#inkEye)` and re-transformed every frame: **+7 fps in soccer** from that one selector, reproduced twice. |

**The regression that caused this.** `hero-head-transform.js` carries a 16-line comment recording a previous fix to exactly this loop — *"The steady-state loop now reads nothing from the DOM at all — it only writes."* The brief asked me to verify that was still true. **It is not.** One uncached `rootNumber()` call has come back, inside `place()`, which runs once per selection handle per frame. The comment is now false and the 8-frames-in-1.5s failure it describes has partially returned.

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

### F1 — The hero float loop forces a full-document style recalc five times a frame · `hero-head-transform.js` · **not my lane, patch below**

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

Run `python3 tools/performance-probe.py --pages index --patch hero-handle-cache --attribute` to reproduce. Please also update the loop's comment, which currently asserts something untrue.

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

### F5 — `updateIris()` reads geometry inside its write loop · `hero-engine.js` · **not my lane, patch below**

Runs every frame on **both** pages. Takes `stage.getBoundingClientRect()`, then per eye reads `getBoundingClientRect()`, `offsetWidth` and `offsetHeight` *inside* a loop that also writes `e.iris.style.transform` and `e.el.style.transform` — so the second eye reads back out of the tree the first eye dirtied. ~63 forced-layout reads/sec, and after F1–F4 it is **the only remaining idle read source on either page**.

**The patch** — batch the reads ahead of the writes, which is a mechanical change and does not alter a single output value:

```js
 var _eyeGeom=eyeEls.map(e=>{const r=e.el.getBoundingClientRect();
   return {r:r,ow:e.el.offsetWidth||r.width,oh:e.el.offsetHeight||r.height};});
 eyeEls.forEach((e,_gi)=>{const _g=_eyeGeom[_gi],r=_g.r;var ecx=r.left+r.width/2;
   /* ...unchanged... */ var ow=_g.ow,oh=_g.oh;
```

### F6 — `prefers-reduced-motion` stops the work on `index.html`, but **not** on `play.html`

The brief asked whether reduced motion genuinely stops work rather than just hiding motion. Measured over a 5-second idle window:

| | script ms/s | style recalcs/s | layouts/s |
|---|---|---|---|
| `index.html` normal | 16.9 | 55.0 | 47.2 |
| `index.html` **reduced** | **2.9** | **1.2** | **0.0** |
| `play.html` normal | 35.3 | 39.0 | 5.4 |
| `play.html` **reduced** | **24.7** | **64.6** ⚠ | 0.0 |

`index.html` passes cleanly. **`play.html` does not**: script cost falls only 30%, and style recalculations *increase*. The companion engine keeps running its per-head loops under reduced motion. Worth fixing — it is both an accessibility promise and free battery on a laptop.

### F7 — Two 404s fire during the hunger mood · `hero-engine.js:813` · pre-existing

`hero-engine.js:813` requests `images/crumbtex.png` and `images/texttex.png`. Only `crumbtex.webp` exists; **`texttex` does not exist in any format**. This fails `tools/play-browser-smoke.py` at the `hunger` assertion. Unrelated to this audit's changes — it fails identically on an unmodified tree — but it is a live bug and the smoke test cannot pass until it is fixed.

### F8 — Page weight

Not the cause of the lag, but worth knowing. `images/earth-map-src.jpg` (2.51 MB) is **correctly never served** — the four matches are all prose in comments. Its generated descendant `earth-disc.webp` is not referenced either, so all three earth assets (3.26 MB) are dead weight in the tree, along with four unreferenced `*-rung.jpg` files and 91 KB of `@font-face`-less woff2.

Two live issues:

- **`time-aware-thumbnails.js` preloads 1.14 MB (DPR 1) / 3.16 MB (DPR 2) of case-study variants on every first visit**, via detached `new Image()`, which **bypasses all seven `loading="lazy"` attributes on index.html**. It re-runs on every theme and time-boundary change. The six decodes are gated behind a single `Promise.all`, so the slowest image blocks all five others, and the rejection handler is an empty comment — one failed decode silently abandons the whole state change.
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

Committed as `887cada`, touching only `play-engine.js`, `header.js`, `tools/performance-probe.py`:

- Eye box width cached against head size (F2)
- `onResizeFrame()` helper; `survey()`, soccer `layout()`, battle `build()/render()` coalesced to a frame (F3)
- Duplicate `getBoundingClientRect()` in `survey()` removed (F3)
- `placeInk()` coalesced to a frame (F4)
- `tools/performance-probe.py` added

**Contracts:** `hm-check.py` **PASS**, `token-audit.py` **PASS**. `play-browser-smoke.py` fails at F7's pre-existing 404s. `shared-surfaces-contract.py` and `hero-specimen-check.py:52` were already failing at baseline and are not mine.

Nothing was removed. The float, the lighting, the reflections, the shadows, the soccer chaos and the time-of-day system all behave exactly as before — every change is a measurement that stopped being repeated, not a feature that stopped happening.

---

## 5 · What I did not do, and what it would buy — **Jayden's call**

These are architectural, and the brief was explicit that they should be proposed with a number rather than done silently.

### P1 · The eye ink filter — **+7 fps in soccer**, reproduced twice

`.eye { filter: url(#inkEye) }`. Two per head, twelve heads, re-transformed every frame. An SVG `url(#…)` filter on a moving element is the non-accelerated path and re-rasterises every frame.

| soccer @1440, GPU | rep 1 | rep 2 |
|---|---|---|
| `.eye { filter: none }` | **+7.3 fps** | **+7.1 fps** |
| all ink filters off | +15.3 fps | +9.6 fps |
| eyes removed entirely | +21.9 fps | — |

The trade is real and it is yours: the eyes lose their ink edge. Options, cheapest first — **(a)** drop the filter on the eyes only during a match, keeping it in the lobby where heads move less; **(b)** bake the ink edge into the eye artwork so it costs nothing per frame; **(c)** keep it and accept soccer at ~36 fps. I would not delete it without your say-so.

### P2 · The lava haze and canvases — battle is the worst mode on the site

`.hmLavaHaze` carries `backdrop-filter: blur(1.4px) url(#hmHeatFilter) brightness(1.06) saturate(1.2)` — a backdrop-filter *with an SVG filter in the chain*, animated, full-width, 96 px tall. A backdrop-filter forces a readback of everything behind it; an SVG filter in the chain forces the whole thing off the fast path. Alongside it are a WebGL canvas and a 2D crust canvas at full hero size.

Software-rasteriser ablation (directional — a real GPU will be kinder): hiding the two lava canvases moved battle from 2.7 → 35.5 fps; hiding the haze alone, +2.1 fps. On a real GPU battle sits at 17.8 fps.

Cheapest real win: **drop `url(#hmHeatFilter)` from the backdrop-filter chain and keep `blur()`+`brightness()`+`saturate()`**, which stays on the accelerated path and looks near-identical. Beyond that, sizing the canvases to their visible band rather than the full hero is the structural fix.

### P3 · Batch every head's writes into one pass

Twelve heads each schedule their own rAF and each write their own transforms. They cannot be batched by the browser as separate callbacks. One loop that reads everything, then writes everything, would cut the remaining per-head overhead and make the reflection and shadow updates free riders. Larger change; worth doing only if P1 and P2 do not get soccer to 60.

---

## 6 · Reproducing any of this

```bash
python3 tools/performance-probe.py                       # every page, mode and viewport
python3 tools/performance-probe.py --headed              # real GPU (headless rasterises in software)
python3 tools/performance-probe.py --attribute           # blame every forced-layout read by call site
python3 tools/performance-probe.py --patch hero-handle-cache   # measure F1's fix without editing the file
python3 tools/performance-probe.py --ablate no-eye-filter,no-ink,no-haze   # price one suspect at a time
```

The probe fails loudly if a `--patch` substitution stops matching, so a patch cannot quietly become a no-op after the file moves on. **Run it on a quiet machine** — see §1.
