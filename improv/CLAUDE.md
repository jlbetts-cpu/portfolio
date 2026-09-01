# Working on this site

Read this before changing anything. It is written for any agent — Claude, Codex,
or a future session of either. Jayden is one person with one site; we are
interchangeable to him and should behave that way.

Sections 1 and 2 are how he works and are settled: they came out of a year of
building his portfolio and they are not this project's opinions to revisit.
Sections 3 onward are this project, and are the parts still being decided.

---

## 1. The three rules that override everything

**Premium is subtraction.** His most repeated instruction. When a screen feels
wrong the answer is more often "remove something" than "add something". On the
last project the things fixed by deletion after tuning failed included a backdrop
flood behind a portrait, a ground shadow, a full-screen wipe he called "a glitch",
a card wrapped round a phone mockup, and a pill around seven dots. Expect the same
here. If you are about to add a border, a badge, a gradient or a shadow to make
something read, try removing its neighbour instead.

**Counting is not looking.** Measure, then LOOK at the result. A card that
measured "fits viewport: true" and "caption inside: true" was, on screen,
horrendous — he said so in those words. Every claim about appearance needs a
screenshot you actually opened. Never report a green number you have not looked
at, and never say something is fixed because a check passed.

**A request is a start signal.** If he asks for something, begin it in the same
turn. "I cannot reproduce it" is a status, never an endpoint — he skims, and a
careful paragraph explaining a deferral reads exactly like one explaining a fix.
Put anything NOT done first in your reply, in its own line.

---

## 2. How he wants to be talked to

Short. Around five lines. Lead with what changed and the number that proves it.
Anything not done goes first, in its own line. Put questions in a structured
prompt rather than burying them in prose — he answers those fast and skims the
rest.

Tell him when something is wrong, expensive, or a bad trade, and give the
measurement rather than the adjective. He has repeatedly been right when he
pushed back, and the times the last project went wrong were the times someone
reported a green number instead of looking at the screen.

He is a product designer, not a bystander to the design. Do not explain
fundamentals to him, and do not soften a real problem into a suggestion.

---

## 3. The design system he brings with him

These are HIS conventions, carried from the portfolio. Keep them unless he says
otherwise — they are the reason his work looks like one person made it.

- **Two font weights. 400 and 600.** Never a third. Leading and tracking are the
  levers, not weight and not family. Pick one family and stop.
- **Three text sizes on a page.** A label rung, a body rung, a lead rung. If a
  fourth appears, one of the other three is doing the wrong job.
- **Radius by size class**, not per component: roughly 28 for the biggest
  surfaces, 20 for cards and images, 14 for controls, 6 and below for marks.
  Something that becomes the *environment* leaves the ladder rather than taking a
  compromise rung.
- **Spacing on a 4px grid**, as named tokens. Fluid steps (`--sp-32-64`) collapse
  to their small value on phones; do not hand-write a clamp per component.
- **One accent token, never rebound locally.** On the last project `--accent` once
  meant two different colours in two files and it cost hours. A component may READ
  the accent; it may never redefine it.
- **44px minimum tap targets, measured not declared.** The one sanctioned
  exception is inline prose links, because the line pitch is smaller than 44.
- **A motion ladder of named durations** — press ~100ms, state ~160, state-out
  ~240, move ~280, reveal ~360, enter ~500. Use the rungs. Some hand-tuned values
  are load-bearing and must not be flattened into the ladder; comment those.
- **Controls come from one stylesheet.** A base class plus variants. Do not
  rebuild a button privately and do not patch one toward the system property by
  property — that is how a control ended up with four separate rules bolting on
  its radius, its tap floor and its box-sizing while its ground stayed two raw
  values.

### Shadows — this one is absolute

**Only things that physically stand on something cast a shadow.** A shadow is
*information*: it says this object is resting on that surface. Chrome — headers,
cards, panels, menus, tabs — separates with **hairlines and translucency**, never
elevation. A photograph of a real scene may of course contain shadows; that is a
picture, not chrome.

On this site that means: photographs of people can have real light in them, and
almost nothing in the interface gets a `box-shadow`.

### Accessibility is measured, not asserted

Contrast ratios computed, not eyeballed. Tap targets measured from the rendered
box. Reduced-motion honoured. Focus visible. A text alternative that is a real
sentence, not a filename.

---

## 4. What this project is

A new site for **Linda**, who teaches **developmental improvisation**. It replaces
`developmentalimprovisation.com`. Jayden is designing and building it.

His notes from the Zoom call, verbatim in substance:

**Homepage**
- Newsletter sign-up
- Footer with social media
- Testimonials

**About**
- What developmental improv is
- Who Linda is

**Services**
- Technics
- Workshops for kids and adults
- Train-the-trainer workshops

**Direction**
- Colours: dark blue (education), turquoise, purple
- Images of real people
- Present colour schemes to her
- "Playful but professional"

### Reading those notes

"Present colour schemes" is a **deliverable to Linda**, not a decision already
made. Build two or three complete schemes on real screens and let her choose;
do not pick one silently and proceed.

"Playful but professional" is the whole brief and the hardest part. On this
system, playful cannot come from shadows, bounce, or bright chrome — those are
ruled out above. It has to come from **photography, motion timing, copy voice,
and one or two deliberate moments**. Professional comes from restraint
everywhere else.

"Images of real people" is load-bearing. Improv is people in a room. Stock photos
of laptops will kill this site. If real photography of Linda's actual workshops
exists, it beats anything else available; ask for it early, because the whole
palette should be graded against the photographs rather than chosen first.

### Open questions to put to him, not to guess

- Is there real photography of Linda's workshops, or does this need stock?
- Who is the primary audience — parents booking for kids, adults booking for
  themselves, or organisations booking train-the-trainer? The homepage's first
  screen depends on the answer and they pull in different directions.
- Does the newsletter go to a real provider, and does Linda have an account?
- Is "Technics" a typo for "Techniques", or her own term of art? Do not silently
  correct a practitioner's vocabulary.

---

## 5. Craft notes that will come up

**Colour.** Dark blue, turquoise and purple is a cool triad with no warm note in
it, which is exactly how a site reads "clinical" rather than "playful". The usual
fix is one warm accent used sparingly, and letting skin tones in the photographs
be the warmth. Show him both with and without before deciding.

Do not use pure black or pure white for type. His portfolio's ink is `#090b24` —
a near-black with the blue already in it — and that trick works here too.

**Testimonials.** These are the highest-value content on a teaching site and they
are usually designed as decoration. A name, a role, and a real sentence beat a
star rating and a stock avatar. If a photo is not available, use no photo rather
than a placeholder silhouette.

**Type on a body-copy site.** This is a reading site, not an app. Leading matters
more than anything else here. Measure line length in characters and keep prose in
the 60–75ch range — but note that on the portfolio he explicitly reverted a
narrow measure that had been applied without asking, so propose it, do not
impose it.

**Motion.** One considered entrance is worth more than movement on everything.
Reduced-motion must switch it off, and the page must be complete and legible with
motion disabled.

---

## 6. Process

- Verify in a real browser, at real widths, and look at the screenshot.
- Phone first for anything that will be read on a phone, which is most of this.
- Check work against the three rules in section 1 before showing it.
- When you change something visual, show him the before and after.
- Stage only your own files. Never `git add -A` if more than one agent may be
  working in the tree.
- If a check or gate blocks a fix, work out whether it is protecting behaviour or
  encoding a decision that has changed. Update it with the reasoning in a comment;
  do not relax it and do not delete an assertion to make something pass.

---

## 7. What ships, and the decisions made building the base (2026-09-01)

The base was built in one pass and every rule above that can be measured is
measured by `tools/base-contract.js`. Run it before showing anything:

    NODE_PATH=<dir with playwright> PW_CHROMIUM=<chromium> node tools/base-contract.js
    node tools/base-contract.js --self-test     # re-injects the bugs; must PASS
    node tools/base-contract.js --shots <dir>   # a PNG per page × width × scheme

It serves the folder itself on `127.0.0.1:4771`, opens four pages at 390 and
1440 in all three schemes, and fails on: a fourth text size, a weight other
than 400/600, any computed `box-shadow`, a target under 44×44 (prose links
excepted), any text pair under 4.5:1 (the hero word under 3:1), sideways
scroll, a hero element still hidden after the entrance, motion under
reduced-motion, a first Tab that does not land on a visible skip link, a
stylesheet linked without `?v=`, a header or footer that differs between
pages, and `--accent` bound anywhere but `tokens.css`. It has a self-test and
it exits 1 on FAIL.

**Files.** `tokens.css` (the only file that defines a colour, size, radius or
duration), `controls.css` (`.ctl` + variants, `.field`), `site.css` (layout),
`site.js` (ES5: entrance, scheme, picker), `index.html`, `about.html`,
`services.html`, `schemes.html` (the deliverable for Linda), `favicon.svg`,
`fonts/` (Geist 400 and 600, self-hosted). No build step. Paths are relative
so the folder lifts out of the portfolio repo unchanged.

**Decisions taken here, all open to him:**

- **Three sizes**: label 13, body 17–18, lead 30–46. The hero h1 and every
  section h2 share the lead rung; weight and ink tell them apart.
- **Buttons are body size at 600; nav is label size at 400, ink + 600 when
  current.** No ground, no underline on the bar.
- **A 66ch measure on prose blocks** (`--measure`). Proposed, not imposed:
  it is one token to widen.
- **Three schemes**, switched by `data-scheme`: `harbour` (blue ink, turquoise
  interactive, purple for the one hero word: the brief's three colours),
  `coral` (identical to harbour except the one word, which is the warm note
  §5 recommends), `plum` (purple ink, turquoise interactive). `?scheme=x`
  sets and remembers; `?present` shows a picker so Linda can flip on any page.
  Contrast on `schemes.html` is read from computed styles, never typed.
- **The one entrance**: hero eyebrow, title, lead, actions and photo slot
  rise 12px over 500ms, 60ms apart. Nothing else moves on load. Without JS
  nothing is hidden; reduced-motion switches it off.
- **The header CTA hides under 640px** because wordmark + two links + a
  button does not fit 358px at 44px targets. The hero carries the same CTA.
- **Photo slots are tinted wells with a caption**, never a silhouette
  (§5). An `<img>` dropped inside fills one. Every slot is a request for a
  real photograph of a real room.
- **Nothing in a testimonial is invented.** Three slots carry bracketed
  placeholders in `.todo` ink until Linda supplies quotes.
- **Copy that needs Linda** is marked `.todo` in the page and `data-todo` on
  links: social handles, the contact address, the newsletter provider
  (`form action="#"`), formats and lengths on Services, the book title.

**What the gate cannot see** (and what looking caught on the first run): the
schemes page rendering all three cards in one palette because the tokens were
bound on `:root[data-scheme]` and not `[data-scheme]`; a heading landing
under its photo. Open the PNGs.
