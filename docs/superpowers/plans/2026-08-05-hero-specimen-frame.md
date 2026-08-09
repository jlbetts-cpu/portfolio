# Hero Specimen Frame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved home-page specimen-frame hero with matching header geometry, a subtle blue atmosphere, a primary work link, and the existing animated mood menu moved from Play into the hero.

**Architecture:** Keep the current static HTML/CSS/ES5 architecture and preserve the head engine's public DOM hooks. Move the existing mood nodes rather than duplicating them, let `hero-engine.js` continue owning mood dispatch and disclosure state, and make home-page Play a plain link so `header.js` no longer treats it as a disclosure. Add a small static contract check for the cross-file DOM invariants, then verify runtime layout and behavior in a real browser.

**Tech Stack:** Static HTML, CSS custom properties, vanilla ES5 JavaScript, Python 3 contract check, local `python3 -m http.server`, browser automation through the available Node/Playwright runtime.

## Global Constraints

- Preserve the exact existing Empathy, Hunger, Delight, and Love `.moodItem` nodes, icon classes, order, labels, `data-mood` values, icon animations, and effect pairings.
- Do not rebind `--accent`; blue is a decorative hero atmosphere only.
- Preserve `#h1`, `.heroCtas`, `.stagewrap`, `#stage`, and `#face` for `hero-engine.js`.
- Treat desktop and mobile as deliberately composed states; check 1440×900, 1280×800, 1280×720, 768×1024, 390×844, and 360×800.
- Keep case studies, Play games, head-maker behavior, and unrelated shared tokens out of scope.
- Use Instrument Sans and the existing token ladder for type, spacing, radii, materials, motion, focus, and touch targets.

---

### Task 1: Lock the home-page structure contract

**Files:**
- Create: `tools/hero-specimen-check.py`
- Modify: `index.html:1454-1503`

**Interfaces:**
- Consumes: the existing `#cases`, `#h1`, `.heroCtas`, `.stagewrap`, `#stage`, `#face`, `.moodItem`, `.moodIco`, and `data-mood` contracts.
- Produces: `a[data-nav-item="games"]` as a direct Play link, `a#workBtn[href="#cases"]`, `#moodbar.heroMood`, `button#moodBtn`, and `#moodMenu` containing the four unchanged mood actions.

- [ ] **Step 1: Write the failing structure check**

Create `tools/hero-specimen-check.py` with a `main()` that reads `index.html` and asserts these exact invariants:

```python
from pathlib import Path
import re

html = Path("index.html").read_text(encoding="utf-8")

assert 'class="jbDisc jbPlay"' not in html
assert re.search(r'<a[^>]+data-nav-item="games"[^>]+href="play\.html"', html)
assert re.search(r'<a[^>]+id="workBtn"[^>]+href="#cases"', html)
assert 'id="moodbar"' in html and 'class="heroMood' in html
assert re.search(r'<button[^>]+id="moodBtn"[^>]+aria-controls="moodMenu"', html)
assert html.count('class="moodItem"') >= 4
for mood, icon, label in (
    ("empathy", "camDot", "Empathy"),
    ("hunger", "cookieDot", "Hunger"),
    ("delight", "discoDot", "Delight"),
    ("love", "heartDot", "Love"),
):
    pattern = rf'data-mood="{mood}"[^>]*>.*?class="moodIco {icon}".*?{label}</button>'
    assert re.search(pattern, html, re.S), mood
assert html.index('id="h1"') < html.index('id="moodbar"') < html.index('class="stagewrap"')
print("hero specimen structure: OK")
```

- [ ] **Step 2: Run the check and verify it fails**

Run: `python3 tools/hero-specimen-check.py`  
Expected: FAIL because Play is still `.jbDisc.jbPlay`, `#workBtn` is a button, and `#moodbar` is still in the header.

- [ ] **Step 3: Move the existing nodes into the approved structure**

In `index.html`:

- Replace the home `.jbDisc.jbPlay` wrapper and panel with its existing `.jbDiscGo` anchor as a plain nav link. Remove disclosure ARIA from that link.
- Preserve the head-management markup only on `play.html`; do not transplant it into the hero.
- Change `#workBtn` from a button to `<a class="workCta" id="workBtn" href="#cases">…</a>`.
- Insert `<div class="heroMood moodbar" id="moodbar">` as the second child in `.heroCtas`.
- Add `button#moodBtn` with `aria-haspopup="menu"`, `aria-expanded="false"`, and `aria-controls="moodMenu"`.
- Move the existing `div#moodMenu` beneath the trigger and preserve all four existing `.moodItem` button nodes byte-for-byte.
- Add `role="menu"` and `aria-label="Choose a mood"` to `#moodMenu`, and `role="menuitem"` to each existing mood button.

- [ ] **Step 4: Run the structure check and HTML hook audit**

Run: `python3 tools/hero-specimen-check.py`  
Expected: `hero specimen structure: OK`.

Run:

```bash
rg -n 'id="(h1|workBtn|moodbar|moodBtn|moodMenu|stage|face|cases)"' index.html
```

Expected: one occurrence of each id.

- [ ] **Step 5: Commit the structure contract**

```bash
git add index.html tools/hero-specimen-check.py
git commit -m "Restructure home hero controls"
```

---

### Task 2: Build the specimen shell and responsive composition

**Files:**
- Modify: `index.html:67-86, 109-215, 338-549, 694-831, 1120-1250`

**Interfaces:**
- Consumes: the Task 1 `.hero`, `.heroCopy`, `.heroCtas`, `.heroMood`, `.stagewrap`, `.workCta`, and `.moodBtn` structure plus shared tokens already copied into the home page.
- Produces: localized `--hero-aura-*` tokens and the final desktop/mobile specimen-frame layout without altering shared `--accent` values.

- [ ] **Step 1: Extend the contract check for visual-system invariants**

Append assertions to `tools/hero-specimen-check.py`:

```python
for token in ("--hero-aura-core", "--hero-aura-mid", "--hero-aura-fade"):
    assert token in html, token
assert re.search(r'\.hero\s*\{[^}]*border:\s*var\(--hair-w\)\s+solid\s+var\(--c100\)', html, re.S)
assert ".heroAura" in html
assert "var(--accent)" not in re.search(r'\.heroAura\s*\{.*?\}', html, re.S).group(0)
```

- [ ] **Step 2: Run the check and verify the new assertions fail**

Run: `python3 tools/hero-specimen-check.py`  
Expected: FAIL on the missing hero atmosphere tokens and shell border.

- [ ] **Step 3: Add the localized atmosphere and matched shell**

In the home-page token block, add only these semantic local values, tuned during screenshot review:

```css
--hero-aura-core:rgba(148,205,255,.44);
--hero-aura-mid:rgba(184,222,255,.24);
--hero-aura-fade:rgba(225,241,255,0);
```

Add `<div class="heroAura" aria-hidden="true"></div>` inside `.hero` before the content. Style it as an absolutely positioned elliptical radial gradient behind `.stagewrap`, with blur token usage, full fade before the shell edge, and `pointer-events:none`.

Restyle `.hero` as the specimen shell:

```css
.hero{
 position:relative;isolation:isolate;overflow:hidden;
 border:var(--hair-w) solid var(--c100);
 border-radius:var(--r-xl);corner-shape:var(--corner);
 background:var(--c50);
}
```

Align `.wrap`, `.jbNav`, and `.hero` to the same horizontal gutter. Use the existing spacing ladder for the header-to-hero gap, shell inset, headline-to-actions gap, and actions-to-head gap.

- [ ] **Step 4: Compose desktop, short laptop, tablet, and mobile deliberately**

Use viewport-aware height/width clamping without hard-coded headline breaks. Keep `.heroCopy h1` centered and balanced, expose `.heroCtas` as a centered flex row, and scale `.stagewrap` from remaining viewport height. Add focused media rules for `max-width:760px` and short screens so:

- the controls never collide with the head;
- the head remains optically centered in the blue field;
- the shell has equal left/right gutters;
- no viewport gains an empty vertical band;
- the beginning of `#cases` remains reachable through ordinary scrolling.

Include `@media(prefers-reduced-motion:reduce)` handling for the new atmosphere/control entrances and do not animate the ambient gradient continuously.

- [ ] **Step 5: Run static checks and commit the visual system**

Run:

```bash
python3 tools/hero-specimen-check.py
git diff --check
```

Expected: both pass.

```bash
git add index.html tools/hero-specimen-check.py
git commit -m "Build responsive specimen frame hero"
```

---

### Task 3: Preserve mood behavior and disclosure accessibility

**Files:**
- Modify: `hero-engine.js:207-224, 1298-1314, 1574-1645`
- Modify: `index.html:918-1034, 1240-1380, 1849-1880`
- Modify: `header.js:82-178` only if a stale home Play assumption remains after the markup change.

**Interfaces:**
- Consumes: `#moodbar`, `#moodBtn`, `#moodMenu`, `.moodItem[data-mood]`, `#workBtn[href="#cases"]`, and the existing `MAP` mood dispatch table.
- Produces: click, keyboard, outside-click, hover-capable preview, Escape-focus-return, and reduced-motion-safe scrolling behavior owned by `hero-engine.js`.

- [ ] **Step 1: Extend the contract check for script ownership**

Read `hero-engine.js` inside `tools/hero-specimen-check.py` and assert:

```python
engine = Path("hero-engine.js").read_text(encoding="utf-8")
assert 'btn.focus()' in engine
assert 'e.key==="Escape"' in engine
assert 'bar.contains(e.target)' in engine
assert 'var MAP={empathy:startRain,hunger:moodEat,delight:startParty,love:startLove}' in engine
```

- [ ] **Step 2: Run the check and verify the focus-return assertion fails**

Run: `python3 tools/hero-specimen-check.py`  
Expected: FAIL because the current Escape path closes the menu without returning focus.

- [ ] **Step 3: Adapt the existing disclosure code without changing mood dispatch**

Keep the `MAP` and `.moodItem` click dispatch unchanged. Update the home-only disclosure block so:

- `openM()` sets `.open` and `aria-expanded="true"`;
- `closeM(restoreFocus)` removes `.open`, sets `aria-expanded="false"`, and calls `btn.focus()` only when `restoreFocus` is true;
- Escape calls `closeM(true)` and stops propagation;
- outside click calls `closeM(false)`;
- selecting a mood closes without stealing focus from the resulting animation;
- fine pointers may preview/open on hover with the existing delayed close;
- touch and keyboard use the button directly;
- the chevron reflects below/above menu direction without inline styling that fights responsive CSS.

Remove stale comments and selectors that describe `#moodbar` as a header Play panel. Remove the obsolete home Play roster refresh binding at `index.html:1849-1880` while leaving Play-page roster logic untouched.

Because `#workBtn` is now an anchor, keep enhancement progressive: only intercept it when `window.__softScroll` exists; otherwise let `href="#cases"` work normally. Respect the existing `reduce` flag.

- [ ] **Step 4: Run syntax and contract checks**

Run:

```bash
node --check hero-engine.js
node --check header.js
python3 tools/hero-specimen-check.py
git diff --check
```

Expected: all commands pass.

- [ ] **Step 5: Commit the interaction preservation**

```bash
git add index.html hero-engine.js header.js tools/hero-specimen-check.py
git commit -m "Move animated mood menu into hero"
```

---

### Task 4: Runtime and visual verification

**Files:**
- Modify: `index.html`, `hero-engine.js`, or `header.js` only for defects discovered by this task.
- Test: `tools/hero-specimen-check.py`

**Interfaces:**
- Consumes: the completed hero at `http://127.0.0.1:4173/index.html`.
- Produces: verified screenshots and runtime evidence for layout, behavior, accessibility, and regressions.

- [ ] **Step 1: Start the local site**

Run from the repository root:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Expected: the home page loads at `http://127.0.0.1:4173/index.html` with local assets and no 404s for hero resources.

- [ ] **Step 2: Run desktop and mobile DOM checks in a real browser**

At 1440×900, 1280×800, 1280×720, 768×1024, 390×844, and 360×800, record:

```js
const hero = document.querySelector('.hero').getBoundingClientRect();
const nav = document.querySelector('.jbNav').getBoundingClientRect();
const head = document.querySelector('.stagewrap').getBoundingClientRect();
const actions = document.querySelector('.heroCtas').getBoundingClientRect();
({
  aligned: Math.abs(hero.left - nav.left) < 1 && Math.abs(hero.right - nav.right) < 1,
  controlsClearHead: actions.bottom <= head.top,
  viewportOverflow: document.documentElement.scrollWidth - innerWidth,
  hero, nav, head, actions
});
```

Expected: `aligned:true`, `controlsClearHead:true`, and `viewportOverflow:0` at every viewport.

- [ ] **Step 3: Verify behavior and accessibility**

In the browser:

- Activate `View work` and confirm `#cases` reaches the visible scroll position.
- Open Mood with mouse, keyboard, and touch emulation.
- Confirm `aria-expanded` toggles, Escape closes and returns focus, outside click closes, and the menu stays inside the viewport.
- Trigger each mood and confirm the original icon presentation and corresponding rain, eating, party, and love head effects.
- Follow Play and confirm it navigates directly to `play.html`.
- On `play.html`, confirm saved-head/head-management controls still work.
- Emulate `prefers-reduced-motion: reduce` and confirm navigation and disclosure remain functional without nonessential motion.

- [ ] **Step 4: Capture and critique the viewport set**

Capture full-page or first-screen screenshots at all six required sizes. Compare shell gutters, header/hero outline weight, two-line headline balance, action spacing, aura fade, face scale, menu placement, and the first visible work content. Adjust only tokenized spacing/size values, repeat the complete viewport set after any change, and remove one nonessential visual detail if the composition feels decorated rather than disciplined.

- [ ] **Step 5: Run final checks and commit verified fixes**

Run:

```bash
python3 tools/hero-specimen-check.py
node --check hero-engine.js
node --check header.js
python3 tools/token-audit.py
git diff --check
git status --short
```

Expected: structure, syntax, token audit, and whitespace checks pass; only intentional files are modified.

If visual verification required final adjustments:

```bash
git add index.html hero-engine.js header.js tools/hero-specimen-check.py
git commit -m "Polish hero spacing across viewports"
```
