# SEO and Safari audit — 2026-08-11

Ten pages, real WebKit, real Chromium, and the live site as a crawler sees it.

---

## Answers up front

| | Answer |
|---|---|
| **The single biggest obstacle to ranking for "Jayden Betts"** | **The live site returns HTTP 403 to everything.** `jaydenbetts.design` 308-redirects to `www.jaydenbetts.design`, which serves a *Vercel Security Checkpoint* page — to Googlebot, to Chrome, to iOS Safari, to `robots.txt`, and to `sitemap.xml`. No crawler has fetched a single page. Every other finding in this document is downstream of that. |
| **Is it a code problem?** | **No.** It is a Vercel dashboard setting (Attack Challenge Mode / a firewall rule). Nothing in this repo can fix it and no amount of markup will compensate for it. **This is the one thing to do today.** |
| **What I fixed** | The sitemap listed **2 of 8** indexable pages — now 8. About had **no structured data at all** — now carries a `Person` node sharing the home page's `@id`. Headmaker had **no share card** — now has one. Five case studies unfurled as small cards — now large. The two `noindex` tool pages are now deliberate and consistent rather than three-pages-three-ways. |
| **What is outside his control** | Who else is called Jayden Betts, and how long Google takes. Both are real (see below). Neither is a code change. |
| **Can he be first for his name?** | **Honestly: very likely yes, but not because of markup.** See "What he is competing against". |
| **Does anything break in Safari?** | **No.** Zero page errors, zero layout overflow, zero fatal differences across ten pages at 390 and 1440 in real WebKit. One feature (`corner-shape`) is unsupported and degrades gracefully. Details below. |
| **Biggest non-blocking risk** | Mobile performance on `index.html` — LCP **6.98 s** and **1.22 s** of blocking on a throttled phone. It is the page that has to rank. |

---

## 1. The blocker, in detail

```
$ curl -I https://jaydenbetts.design/
HTTP/2 308
location: https://www.jaydenbetts.design/

$ curl -L https://www.jaydenbetts.design/
HTTP/2 403
<title>Vercel Security Checkpoint</title>
```

Tested with four user agents — Googlebot, desktop Chrome, iOS Safari, and none at
all. **All four get 403.** So do `/robots.txt` and `/sitemap.xml`.

Consequences, in order of severity:

1. **Google cannot crawl or index anything.** A `site:jaydenbetts.design` search
   returns nothing, which matches.
2. **`robots.txt` and `sitemap.xml` are unreachable**, so even the discovery hints
   are invisible.
3. **Google's own diagnostics are unusable.** The Rich Results Test and Search
   Console's URL Inspection both fetch the live URL and will both fail — so the
   structured data below cannot be validated by Google until this is lifted. (It
   is validated locally instead; see §4.)
4. **A recruiter clicking the link gets a security checkpoint.** A real browser
   may pass the JS challenge; a crawler never will, and a hiring manager on a
   phone should not have to.

### The second, quieter host problem

Once the 403 is lifted, there is still a mismatch: **the server prefers `www`,
and every canonical, the sitemap, and `robots.txt` all say apex.** So each page
would declare itself canonical at a URL that redirects away from itself.

Google usually resolves this, but it is a self-inflicted signal split. Pick one:

- **Recommended: make apex canonical** — flip the Vercel domain redirect to
  `www → apex`. Zero file changes; the repo already agrees with this everywhere.
- Or: change all 8 canonicals, `sitemap.xml`, and `robots.txt` to `www`.

`tools/seo-contract.py` enforces that the canonicals, the sitemap and `robots.txt`
agree with **each other**. It cannot see the server, so this one needs a human.

---

## 2. What he is competing against

Searched, rather than assumed. There are at least three other people:

| Who | Where they rank | Threat |
|---|---|---|
| **Jaden Betts** — actor, voice of Donny McStuffins | IMDb, Fandom, CanvasRebel | **Highest.** Established entity, many strong domains. Different spelling (*Jaden*), but Google folds the variants together. |
| **Jayden Betts** — high-school football player, class of 2026 | Prep Redzone, Athletic.net | Moderate; thin, sport-siloed pages. |
| **Jayden Betts** — MD track and field | Athletic.net | Low. |

**The good news, and it is genuinely good:** his own **LinkedIn already ranks on
page one** for "Jayden Betts", titled *Jayden Betts – Product Designer – UC Davis*.
Google already associates that name with a product designer at UC Davis. His site
is not fighting to establish an entity; it is fighting to **attach a second URL to
an entity Google already accepts.** That is a much easier problem, and it is why
the `Person` `@id` and `sameAs` work in §4 matters.

**What is realistically achievable:** ranking for "Jayden Betts designer",
"Jayden Betts portfolio" or "Jayden Betts UC Davis" should be straightforward once
the site is crawlable. Ranking **first** for the bare name means outranking an
IMDb page for a working actor. Plausible over months, **not a switch anyone can
flip** — and no honest technique makes it fast.

**Do this once the 403 is lifted, in this order:**
1. Verify the domain in **Google Search Console** and submit `sitemap.xml`. This
   is the single highest-value non-code action.
2. Add the site URL to the **LinkedIn profile** — that page already ranks, and the
   link is the strongest available signal that the two are one person.
3. Same for Instagram, and anywhere else the name appears.

---

## 3. Per-page technical audit

All ten pages. `[fixed]` marks work done in this pass.

| Page | Title | Desc | Canonical | Robots | OG | Twitter | JSON-LD | h1 |
|---|---|---|---|---|---|---|---|---|
| `index` | ok | ok¹ | ok | index | ok | ok | WebSite+ProfilePage+Person | 1 |
| `about` | ok | ok¹ | ok | index | ok | ok | **[fixed]** ProfilePage+Person | 1 |
| `apollo` | ok | ok | ok | index | **[fixed]** dims | **[fixed]** full | Breadcrumb+CreativeWork | 1 |
| `bearings` | ok | ok | ok | index | **[fixed]** dims | **[fixed]** full | Breadcrumb+CreativeWork | 1 |
| `cluster` | ok | ok | ok | index | **[fixed]** dims | **[fixed]** full | Breadcrumb+CreativeWork | 1 |
| `strata` | ok | 166ch | ok | index | **[fixed]** dims | **[fixed]** full | Breadcrumb+CreativeWork | 1 |
| `ucdavis` | ok | ok | ok | index | **[fixed]** dims | **[fixed]** full | Breadcrumb+CreativeWork | 1 |
| `headmaker` | ok | ok | ok | index | **[fixed]** all | **[fixed]** all | none² | **0 — patch** |
| `play` | ok | none³ | none³ | **noindex** | n/a | n/a | none | 1 |
| `gradientlab` | ok | none³ | none³ | **[fixed]** noindex | n/a | n/a | none | 1 |

¹ Over 165 chars **and** carries the location claim — see §5. Left alone deliberately.
² A tool page; `CreativeWork` would be defensible but is not obviously worth it.
³ Correct for a `noindex` page — a canonical there is inert at best.

### Fixed in this pass

**`sitemap.xml` — the biggest markup gap.** It listed **two** URLs: the home page
and `bearings.html`. `about.html` and four of five case studies were absent —
and About is the most name-relevant page on the site. Now lists all eight
indexable pages with real per-file `lastmod` dates from git, and deliberately
excludes both `noindex` pages (listing one is a contradiction Search Console
reports against the whole file).

**`about.html` structured data.** It had none. It now carries a `ProfilePage` and
a `Person` node whose `@id` is **identical** to the home page's
(`https://jaydenbetts.design/#person`) — which is the entire point: two pages
describing one `@id` consolidate into one entity instead of competing as two.

**`headmaker.html` share card.** The only indexable page on the site with no Open
Graph and no Twitter card, so every shared link unfurled as a bare URL. Also
gained the four missing favicon sizes and the 180px `apple-touch-icon` — this is
the page most likely to be saved to an iOS home screen.

**Five case studies.** Each declared `og:image` and stopped. Scrapers had to fetch
and decode the file to choose between a large card and a thumbnail, and several
do not bother. Real measured `width`/`height`/`type` added, plus the `twitter:*`
pair mirroring `og:*`.

**No new copy was written anywhere.** Every `og:`/`twitter:` string added is an
existing approved string from the same page, propagated to a surface that was not
receiving it.

### `robots.txt`

Correct and left alone:

```
User-agent: *
Allow: /
Sitemap: https://jaydenbetts.design/sitemap.xml
```

**Deliberately did not add `Disallow` rules for the prototype pages**
(`specimen`, `orbs`, `button-system`, `header-prototype`, `accent-swatches`).
All five already carry `noindex`, and **`Disallow` would prevent Google from
reading that `noindex`** — the two directives fight each other. Leaving them
crawlable is what makes their `noindex` work.

### One page worth deleting rather than fixing

`index-local-preview.html` (374 KB) ships to production, is `index,follow`, and
carries the **identical `<title>` "Jayden Betts"** as the home page plus a stale
description. **The risk is lower than it looks** — it has a correct canonical
pointing at the home page, which is the standard, working way to handle a
duplicate. But it is a stale snapshot with outdated copy shipping to production
for no reason. **Recommend removing it from the deploy** (`.vercelignore` or
delete). Not urgent, not touched.

---

## 4. Structured data, validated

Google's Rich Results Test cannot reach the site (§1), so this was validated
locally and mechanically by `tools/seo-contract.py`:

- **All 8 JSON-LD blocks parse.** Checked in a real browser via the parsed DOM in
  WebKit, not by reading source — a single trailing comma silently voids the
  strongest signal available for a name query.
- **`Person` `@id` is consistent** across all pages that name him. Enforced.
- **`sameAs` links resolve:**
  - `linkedin.com/in/jaydenbetts` → HTTP 999. **This is LinkedIn's standard
    anti-bot response to non-browser clients, not a broken link.** It is fine.
  - `instagram.com/jaydenleebetts` → 200. Fine.
- **`alternateName: "Jayden Lee Betts"`** is present and correct — a real help for
  name variants.
- **`alumniOf: University of California, Davis`** is present, and matters more
  than it looks: it is the property that ties his site to the same
  designer-at-UC-Davis entity his LinkedIn already ranks for.

### One thing to check, not for me to decide

`x.com/JaydenBetts` exists and resolves (200), and appeared in search results for
his name. **If that account is his, adding it to `sameAs` on both pages is a free
entity signal.** I did not add it because I cannot verify ownership from here, and
asserting a wrong profile is worse than omitting a right one.

---

## 5. The location contradiction — flagged, not fixed

**Not fixed by design.** He has chosen the honest framing (based in Davis, open to
relocating including SF) but has **not chosen the wording**, and the options are
already written up. **Do not let anyone rewrite this ad hoc:**

> **`docs/superpowers/specs/2026-08-09-copy-options.md`**

That document carries the full six-surface map and three drop-in options. What
this audit adds is **which of those surfaces are SEO surfaces** — i.e. where the
contradiction is machine-readable or shown directly in a search result:

| Surface | Why it matters here |
|---|---|
| `index.html` `<meta name="description">` | **This is the sentence Google prints under the result.** Highest-visibility instance by far. |
| `index.html` `og:description` / `twitter:description` | What a recruiter sees in a pasted link, before they click. |
| `index.html` JSON-LD — `WebSite.description` | Machine-readable. |
| `index.html` JSON-LD — `Person.description` | Machine-readable, and attached to the entity itself. |
| `about.html` `<meta name="description">` | Second-highest visibility. |
| `about.html` `og:description` / `twitter:description` | Share card. |

That is **eight SEO surfaces**, all on the two pages that matter most for a name
query. Location is a live ranking and disambiguation signal for a person search,
so this is not only a credibility question — Google is currently being told he is
in San Francisco.

**When the copy is settled, note the new `about.html` `Person` node deliberately
carries no `description` key** — precisely so the contested claim was not
propagated into a ninth surface during this pass. A description can be added there
once the wording exists.

---

## 6. Safari and WebKit

Tested in **real WebKit 26.4** via Playwright, ten pages × two viewports
(390×844 iPhone with touch + mobile UA, 1440×900 desktop), against Chromium as a
control. New tool: **`tools/webkit-compat-sweep.py`** (with `--self-test`).

### Result: nothing breaks

```
STATUS=PASS   0 failures
  horizontal overflow ....... 0 px on every page, both viewports, both engines
  page errors ............... none, either engine
  h1 / landmarks painted .... identical
```

**The known WebKit bug stays fixed.** `tools/hero-head-priority-contract.py` was
run for real, not modelled: the hero portrait drags, tilts and floats in genuine
WebKit at both sizes. This is the `setProperty`-without-priority bug that once
broke the hero on every iPhone invisibly, and it is still dead.

### Feature support, measured not assumed

| Feature | WebKit | Chromium | Verdict |
|---|---|---|---|
| `backdrop-filter` (unprefixed) | yes | yes | fine on current Safari |
| `-webkit-backdrop-filter` | yes | no | fine |
| `dvh` / `svh` units | yes | yes | fine |
| `linear()` easing | yes | yes | **fine — the spring curves survive** |
| `color-mix()`, `oklch()` | yes | yes | fine |
| `:has()`, `mask-image`, `text-wrap: balance` | yes | yes | fine |
| `@property` registration | yes | yes | **30/30 registered on `index.html`** |
| **`corner-shape`** | **no** | yes | **degrades gracefully — see below** |

**`corner-shape` is the only unsupported feature**, and it is used on 25–74
elements per page. **It degrades gracefully and correctly:** every rule pairs it
with a `border-radius`, so Safari draws a normal rounded corner where Chrome draws
the squircle. **Nothing is lost but the squircle itself** — no layout shift, no
missing element, no error. This is the right way to use a bleeding-edge property
and it needs no change. It is worth knowing that **the site looks subtly different
on iPhone than in Chrome, by design and harmlessly.**

**A warning that is a false alarm, recorded so nobody re-investigates it:** the
sweep reports "30 `@property` not registered" on nine of ten pages. Those
registrations live in `hero-time.css`, which **only `index.html` links** — every
other mention is a code comment. Those pages neither declare nor animate those
properties, so there is nothing to snap. Verified statically and in both engines.
`index.html`, the only page that uses them, registers **30 of 30**.

### `100dvh` and the iOS address bar

**This is already handled well, and better than most sites.** The layout-critical
heights on `play.html` and `index.html` use **`100svh`** — the *smallest* viewport
height — which is the correct choice: content never ends up behind the iOS address
bar. The only `100vh` uses are three absolutely-positioned overlay effects in
`play.css` (`#loveScene`, `#photorain`, `#camflash`) where the difference is
purely cosmetic. **No change needed.**

Caveat stated honestly: headless WebKit has no dynamic toolbar, so `vh`, `dvh` and
`svh` all measure 844 there. The conclusion above is from reading where each unit
is used, not from a headless measurement that cannot show the difference.

### The one real Safari risk, and it is for older iPhones

`backdrop-filter` is used **unprefixed with no `-webkit-` fallback** in:

| File | Occurrences |
|---|---|
| `header.css` | 1 |
| `tournament.css` | 1 |
| `index.html` | 3 of 4 |
| `play.html`, `gradientlab.html` | 1 each |

Safari only shipped **unprefixed** `backdrop-filter` in **18.0**. On iOS 17 and
earlier these get **no blur at all** — the surface falls back to its flat
background colour. It degrades rather than breaks, and `site-theme.css` already
does it correctly with both properties. **Low severity, trivial fix:** duplicate
each declaration with `-webkit-backdrop-filter`. Those files belong to other
lanes; flagged, not touched.

### Not added, deliberately: `theme-color`

The obvious "iOS best practice" here would be a `<meta name="theme-color">` pair
behind `prefers-color-scheme`. **It would have been a bug.** Measured in WebKit:
`data-theme` stays `light` under OS dark mode, because this site's theme is driven
by **time of day**, not by the OS preference. A `prefers-color-scheme` theme-color
would tint the iOS browser chrome dark while the page stayed light. A single
static value would be wrong at night for the same reason. If it is wanted, it has
to be **written by `site-theme.js` whenever the theme flips** — a motion/theme-lane
change, not a head-region one.

---

## 7. Performance

`tools/performance-idle-contract.py` — **`--self-test` PASS** (it caught the
re-injected float-loop read) and **real run PASS**: `index.html` 57.4 and
`play.html` 59.2 forced-layout reads/sec, both inside budget.

**The 1.1–3.2 MB preload regression has held.** Verified in the source rather than
assumed: `time-aware-thumbnails.js` now gates on `alreadyFetched()` and points
unfetched images at their new source **without forcing a fetch**, so
`loading="lazy"` is respected. The seven lazy attributes on the home page are
intact and working.

### Core Web Vitals, measured

Chromium, 4× CPU throttle + Fast-3G for mobile — the profile Google's field data
approximates.

| Page | LCP (mobile) | CLS | TBT (mobile) | LCP (desktop) |
|---|---|---|---|---|
| `index` | **6 984 ms** | 0.000 | **1 221 ms** | 904 ms |
| `about` | 800 ms | 0.000 | 54 ms | 68 ms |
| `play` | **4 796 ms** | 0.000 | 199 ms | 484 ms |
| `headmaker` | 772 ms | 0.000 | 0 ms | 60 ms |
| `gradientlab` | 508 ms | 0.000 | **19 571 ms** | 188 ms |
| `apollo` | 1 380 ms | 0.000 | 0 ms | 144 ms |
| `bearings` | 1 580 ms | 0.000 | 44 ms | 120 ms |
| `cluster` | **4 440 ms** | 0.000 | 0 ms | 96 ms |
| `strata` | 1 520 ms | 0.000 | 0 ms | 96 ms |
| `ucdavis` | **3 268 ms** | 0.000 | 4 ms | 120 ms |

*Good: LCP ≤ 2 500 ms · CLS ≤ 0.1 · TBT ≤ 200 ms*

**Cumulative Layout Shift is 0.000 on every page at both sizes.** That is an
excellent, hard-won result and worth protecting.

**Desktop is fine.** Every page is well inside LCP budget.

**The problems are all mobile, and they are main-thread, not weight:**

- **`index.html` — the page that has to rank.** LCP 6.98 s, TBT 1.22 s, 52 long
  tasks, ~1.98 MB. The LCP element is the hero portrait, which *is* correctly
  preloaded with `fetchpriority="high"` — it is late because the main thread is
  saturated by `hero-engine.js` (170 KB) and `hero-head-transform.js` (80 KB), not
  because the image is slow. **The fix is deferring or splitting hero JS, not
  touching the image.** Hero lane.
- **`gradientlab.html` — 19.6 s of blocking.** Only 324 KB total, so this is pure
  computation: `fluid-mesh.js` renders on the main thread. `noindex`, so **no
  search cost**, but the page is effectively unusable on a mid-range phone.
- `play`, `cluster`, `ucdavis` exceed LCP on a throttled phone, mostly large cover
  images.

**Treat these as indicative, not absolute.** Throttled headless numbers are a
rasteriser as much as a page. The *ranking* is trustworthy; the milliseconds are
not. None of it is in this lane.

---

## 8. Patches to apply (out of lane, ready to go)

Both verified with `git apply --check`, then applied together and confirmed to
take `tools/seo-contract.py` to **0 failures**, then reverted.

| Patch | Fixes |
|---|---|
| `docs/superpowers/patches/2026-08-11-headmaker-h1.patch` | **`headmaker.html` has no `h1`.** It opens on six `h2` panel labels, so its outline starts at level 2 with nothing above it — the page never states its own subject, to a crawler or to a screen reader tabbing by heading. Adds one visually-hidden `h1` reading "Make Your Own Head" (its existing `<title>`, no new copy). Zero layout change. **If a visible heading is wanted instead, that is a composition call for Jayden** — this is the element to promote. |
| `docs/superpowers/patches/2026-08-11-play-html-head-seo.patch` | `play.html` head only: the seven missing favicon links (it was the only page with none), and `noindex` → `noindex,follow` to match `gradientlab.html`. **Changes no crawler behaviour** — bare `noindex` already implied `follow` — it just makes the intent legible. `play.html` is the league lane's file, so this is a patch rather than an edit. |

---

## 9. Decisions for Jayden

1. **Lift the Vercel 403.** Everything else is theory until this is done.
2. **Pick an apex-vs-www winner** and make the server agree with the canonicals.
3. **Choose a location option** from `2026-08-09-copy-options.md`. Eight SEO
   surfaces are waiting on it, including the sentence Google prints.
4. **Should `play.html` stay out of search?** It is a genuine demonstration of
   craft and it is currently invisible. That was reasonable when the site was not
   trying to be found. **Not flipped unilaterally** — what belongs in public search
   is his call. `gradientlab.html` is the same question, with the added note that
   its 19.6 s mobile block makes it a poor landing page as it stands.
5. **Is `x.com/JaydenBetts` his?** If yes, add it to `sameAs` on both pages.
6. **After the 403 is lifted:** Search Console → submit the sitemap → add the site
   URL to LinkedIn.

---

## 10. What this pass added

| File | |
|---|---|
| `sitemap.xml` | 2 URLs → 8, real `lastmod`, `noindex` pages correctly excluded |
| `about.html` | `ProfilePage` + `Person` JSON-LD sharing the home page's `@id` |
| `headmaker.html` | Full OG + Twitter card, 4 favicon sizes, `apple-touch-icon`, `author` |
| `apollo` `bearings` `cluster` `strata` `ucdavis` | `og:image` dimensions + type, full `twitter:*` |
| `gradientlab.html` | Explicit `noindex,follow`, favicons, decision documented |
| **`tools/seo-contract.py`** | **New.** Titles, descriptions, canonicals, cards, headings, JSON-LD parsing, `Person` `@id` consistency, and sitemap↔robots agreement **both ways**. `--self-test` re-injects four real defects. |
| **`tools/webkit-compat-sweep.py`** | **New.** Ten pages in real WebKit vs Chromium at two viewports: page errors, horizontal overflow with named offenders, feature support, `@property` registration, viewport units. `--self-test` re-injects a 150 vw element. |

Both new tools ship with a self-test, because **a detector nobody has watched fail
is one nobody should trust** — and both self-tests earned that: the SEO contract's
first run reported the home page missing from its own sitemap (its scanner was
reading a code comment as data) and silently no-opped one injected defect. Both
are fixed, and both failure modes are documented in the source.

**Known red:** `tools/seo-contract.py` reports **1 failure** — the `headmaker.html`
`h1` — until the patch in §8 is applied. It is left red on purpose so it is not
forgotten.
