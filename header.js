/* ===========================================================================
   THE SITE HEADER -- behaviour. One file, every page, deferred.  HEADER V2.
   Markup + CSS: header.css.  Spec:
   docs/superpowers/specs/2026-08-03-header-v2-research.md

   Everything here is feature-detected off the DOM that is actually present, so
   the same file is safe on all nine pages: a page with no About button gets no
   About wiring, and the two fixed-bar pages (play, gradientlab) bind nothing at
   all -- they ship <html class="jbShrunk"> as static markup instead.

   WHAT V2 DELETED, because it is the largest single win in this file:
   v1's `window.addEventListener("scroll", onScroll)` was the site's ONLY
   unthrottled scroll listener -- every other one, on index.html, the five case
   studies and play-engine.js, is rAF-gated -- and it called
   getBoundingClientRect() on the social row inside the handler, forcing a layout
   on every event. It is gone. One IntersectionObserver on a 1px probe replaces
   it, and it does strictly less: no measurement, no per-event work, one class
   toggle at one threshold. The site ends this change with one fewer scroll
   listener than it started with.

   It deliberately does NOT own the About overlay or the moods. Both already
   have working implementations in hero-engine.js; this file only mirrors their
   state into the bar (aria-expanded, aria-current, body[data-nav], the Back
   item).
   =========================================================================== */
(function(){
"use strict";

var nav = document.querySelector(".jbNav");
if(!nav) return;

var body  = document.body;
var root  = document.documentElement;
var stick = nav.closest(".jbStick");
var home  = nav.querySelector(".jbHome");

/* ── 0 · LOCAL LUCIDE GLYPHS ───────────────────────────────────────────────
   The static routes duplicate header markup, so the shared component upgrades
   its own utility drawings here. The brand mark sits outside these selectors
   and remains Jayden's original inline path. */
var SVG_NS="http://www.w3.org/2000/svg";

/* ── THE GLYPHS ARE INLINE. THEY USED TO BE <use href="ui-icons.svg#...">, AND
   THAT ONE FETCH PRODUCED BOTH OF THE SYMPTOMS. ─────────────────────────────
   Jayden: "the Play icon briefly changes to the old icon for a sec, and
   sometimes the icons don't load in properly in the header."

   MEASURED AT rAF RESOLUTION, index.html at 1440, sprite delayed 900ms to stand
   in for a cold cache (which is the state a recruiter arrives in, and the only
   one where this reproduces reliably):
      t+ 107ms  TABLER inline path   rendered, bbox 240   <- the OLD icon
      t+ 205ms  LUCIDE <use>         bbox 0, BLANK        <- header.js swapped
      t+1039ms  LUCIDE <use>         rendered, bbox 280   <- sprite arrived
   Two things are wrong there and they are Jayden's two sentences in order. The
   first is the swap itself: the shipped nav markup still carries the previous
   Tabler drawings, so first paint is always the old icon and this file trades
   it for the new one afterwards. The second is that an EXTERNAL <use> renders
   NOTHING until its document resolves, so the trade opens a hole the width of
   one network request. That hole is what "don't load in properly" is.

   INLINING KILLS THE SECOND ONE OUTRIGHT, on all nine pages, from this file.
   The header needs eight glyphs; their path data is about 1.4KB, which is less
   than the request that was fetching it, so this is strictly cheaper than the
   round trip it replaces -- no fetch, no cache variance, no blank window, and
   nothing to 404. The drawings are copied verbatim from ui-icons.svg, which
   remains the source of truth for the hero-time control's own eight symbols
   (index.html still references it directly and every one of those fragments was
   verified to exist).

   THE FIRST ONE NEEDS THE MARKUP, NOT THIS FILE. The swap can only stop being
   visible when the shipped nav stops being stale, and that markup is duplicated
   across nine pages, three of which belong to other lanes. Handed over rather
   than half-done: with the fetch gone the swap is now synchronous inside this
   deferred script -- one frame, never blank -- instead of a hole. */
var ICONS={
 /* A HOUSE, NOT A BRIEFCASE.  2026-08-21. Jayden: "can we make the work tab
    and turn into the home with a home icon". The first item was Work and is now
    Home on all ten routes, pointing at index.html rather than index.html#cases.
    The old drawing is deleted rather than kept beside this one: nothing asks for
    it any more, and an icon table carrying shapes nothing shows is how a table
    stops being read -- the same note the chevron got below. ui-icons.svg carries
    lucide-house, so the sprite is still the source of truth for this shape. */
 "lucide-house":'<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
 "lucide-user-round":'<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
 "lucide-gamepad-2":'<line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.006-.051-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>',
 "lucide-mail":'<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
 "lucide-arrow-left":'<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
 /* chevron-down, brand-linkedin and brand-instagram were deleted with the
    Contact panel: the header has no disclosure and no social row, and an icon
    table that carries drawings nothing asks for is how a table stops being
    read. The footer's markup carries its own. */
};

function lucideIcon(symbol,extraClass){
  var svg=document.createElementNS(SVG_NS,"svg");
  svg.setAttribute("class","gIco uiIcon"+(extraClass?" "+extraClass:""));
  svg.setAttribute("viewBox","0 0 24 24");
  svg.setAttribute("aria-hidden","true");
  svg.setAttribute("focusable","false");
  /* innerHTML on an SVG element parses in the SVG namespace, which is what the
     shapes need. The strings above are authored constants in this file, never
     anything from the DOM, a URL or storage. */
  svg.innerHTML=ICONS[symbol]||"";
  return svg;
}

function replaceIcon(control,symbol){
  if(!control)return;
  var old=control.querySelector("svg.gIco");
  if(old)old.replaceWith(lucideIcon(symbol));
}

var navSymbols={home:"lucide-house",about:"lucide-user-round",
  games:"lucide-gamepad-2",contact:"lucide-mail"};
Object.keys(navSymbols).forEach(function(key){
  [].forEach.call(nav.querySelectorAll('[data-nav-item="'+key+'"]'),function(control){
    replaceIcon(control,navSymbols[key]);
  });
});
[].forEach.call(nav.querySelectorAll(".jbBack"),function(control){
  replaceIcon(control,"lucide-arrow-left");
});
/* The panel's own three rows and the chevron used to be upgraded here. Both
   loops are deleted with the panel (§3): the brand glyphs live in the footer's
   markup, and a chevron on a control that discloses nothing is a promise the
   control cannot keep. */

/* ── 1 · THE ONE THING THAT HAPPENS ON SCROLL ──────────────────────────────
   A 1px probe at the top of the document, watched once. Out of view => the page
   has left the top => .jbStick redistributes its padding and the bar drops 6px
   clear of the viewport edge (header.css §6.2). The wrapper's height is
   identical in both states, so nothing downstream of --nav-h moves.

   The probe is APPENDED, not prepended: inserting a first child into <body>
   would change what :first-child means for whatever ships at the top of nine
   different pages. It is position:absolute;top:0 so it still marks the top of
   the document from the end of it.

   Skipped entirely on a page that cannot scroll -- play.html and
   gradientlab.html compute overflow:hidden on html AND body, so the probe would
   never leave the viewport and the bar would sit forever in the flush state
   that exists only for the top of a scrollable page. Those two ship
   <html class="jbShrunk"> in their markup: one attribute, no observer. */
if(stick && !stick.classList.contains("isFixed") && typeof IntersectionObserver === "function"){
  var probe = document.createElement("div");
  probe.className = "jbSentinel";
  probe.setAttribute("aria-hidden","true");
  body.appendChild(probe);
  new IntersectionObserver(function(entries){
    root.classList.toggle("jbShrunk", !entries[0].isIntersecting);
  },{threshold:0}).observe(probe);
}

/* ── 2 · ABOUT ───────────────────────────────────────────
   78 lines stood here to keep the bar honest while an in-page About takeover was
   open: mirroring body.about-open into aria-expanded, revealing a .jbBack, and --
   the part that mattered -- making the lit item EXCLUSIVE, because Work carried
   aria-current="page" (the document really was the home page) while this added
   aria-current to About on top of it. Two lit items at once, which is what Jayden
   saw and is also invalid ARIA.
   About is about.html now, so the whole class of problem is gone rather than
   managed: the lit item is whatever the page ships, one per page, decided by the
   URL. No observer, no restore-on-close, no recorded resting value. The travelling
   pill loses its one animatable handoff (Work->About was the only lit-item change
   that did not unload the document) -- that is the honest cost of the route, and it
   is worth it for a state that cannot desynchronise. */

/* ── 3 · THE DISCLOSURES ARE GONE, AND THIS IS THEIR HEADSTONE ─────────────
   ROUND 13.  Contact was the last .jbDisc on the site -- Play's went to the mood
   dock in round 10 -- and Jayden's call is that Contact should be a button that
   goes straight to his inbox rather than a nav item that reveals three links on
   hover. The three links have not been lost: the footer carries LinkedIn,
   Instagram and Email in the same order on every page, which is where the panel's
   own round-10 note already said the destination lived.

   ALL OF IT WENT, not just the markup. Deleted here: the mouse open/close delays
   and their timers, the focusin/focusout pair with its deferred activeElement
   check, the Escape handler, the touch first-tap-opens branch, the .jbDiscTouch
   pruning, and the document-level outside-click listener -- ONE PER .jbDisc, so
   the site ends this change with one fewer document click listener on all nine
   pages. Deleted with them: the chevron injection above (§0) and the .jbDiscMenu
   icon-rewrite loop, both of which now have nothing to find.

   A LISTENER LEFT BOUND TO MARKUP THAT NO LONGER SHIPS IS THE DEFECT, NOT A
   LEFTOVER. This loop was written to feature-detect off the DOM, so leaving it
   would have been silent and free -- and that is exactly why it would still be
   here in a year, with a reader assuming a disclosure exists somewhere because
   the code that drives one does.

   THE aria-* ATTRIBUTES WENT WITH IT, in the markup of all nine pages:
   aria-haspopup, aria-expanded and aria-controls, plus the #jbContactMenu the
   last of those pointed at. aria-expanded on a link with nothing to expand is
   not a leftover either; it is a lie a screen reader reads out loud. */

/* ── 3a · THE MARK IS THE NAV'S OWN SWITCH ─────────────────────────────────
   Jayden: "for the logo I want it to act as a collapsible instead of what it
   does now on all the pages -- it will do a clean animation. Also make sure you
   are using the apple.md for updating the animations."

   WHAT IT COLLAPSES, AND WHY THAT AND NOT SOMETHING ELSE. It collapses the two
   zones that are not the mark -- the tab cluster and Contact -- AND the bar's
   own band and floor with them. Three readings were on the table:
     · hide only the items    -> a full-width white band with one glyph in it,
                                 which looks broken rather than collapsed
     · shrink the bar's height -> --nav-h feeds .wrap's -72px pull-up, the five
                                 case studies' rail offsets and every
                                 scroll-margin-top, so the whole page would jump
     · give the page its top back, which is this one
   Collapsed, the strip is 72px of nothing with the mark in it, so index.html's
   sky, play.html's pitch and gradientlab's canvas run to the top of the window
   and the chrome is genuinely out of the way. THE MARK DOES NOT MOVE: the
   wrapper keeps its height and its padding in both states, so the control the
   finger is on is byte-identical before and after, which is the one thing a
   toggle must never get wrong.

   WHAT IT REPLACES. On index.html the mark was a <button> that did nothing at
   all in this file (hero-engine.js winks the head at it, and that still works --
   the two listeners do not know about each other). On about.html and play.html
   it was an <a href="index.html">, i.e. "go home" on a page that already carries
   "Work -> index.html" in the same bar, so nothing is stranded. The five case
   studies and headmaker/gradientlab carry a Back arrow in that slot and no mark
   at all, so they have no switch -- the collapsible exists exactly where the
   logo does.

   IT COMMITS ON CLICK, NOT ON POINTERDOWN, AND THE TABS DO THE OPPOSITE.
   apple-design.md asks for both and they are not in conflict: §1 wants the
   RESPONSE on press (that is .ctl:active's scale, which already fires on
   pointerdown and is untouched here), and §10 wants a tap COMMITTED on release
   so it can be cancelled by dragging away. A disclosure is a tap. A segmented
   control is not -- its selection tracks the finger from the moment it lands,
   which is why index.html's tab row activates on pointerdown and this does not.

   INTERRUPTIBILITY IS THE POINT (apple-design.md §3, "the single most important
   principle"). Every property that moves here is a CSS TRANSITION on opacity,
   transform, background-color and box-shadow, and a transition re-targets from
   the PRESENTATION value by construction: grab the mark 80ms into a collapse and
   the bar expands from the 40%-faded state it had actually reached, not from
   zero. That is why none of this is a @keyframes animation, which would restart
   from its own 0% frame and jump. Nothing is locked out while it plays -- there
   is no in-flight flag here, and there deliberately is not one.
   `visibility` is the one property that cannot interpolate, so it is delayed on
   the way out and immediate on the way in (header.css) -- the same construction
   the Contact panel used, kept because it is the only way to take a hidden nav
   out of the tab order without display:none, which would hard-swap. */
/* AND ITS HEADSTONE, 2026-08-20. Jayden: "i thought about it and i dont like
   that the header is collapsable." He asked for this control four days ago and
   has reversed it after living with it, which is his call and the reason the
   reasoning above is kept rather than deleted -- if it ever comes back, the
   three readings that were weighed are the expensive part, not the listener.
   WHAT GOES WITH IT: :root.jbNavShut (header.css), and aria-expanded /
   aria-controls on the mark in index, about and play. The mark stays a <button>
   on index.html because hero-engine.js:1853 winks the head at #logo and that is
   a separate listener that never knew about this one. On about and play it is
   now a button with no behaviour, which is why they get their ARIA stripped:
   aria-expanded on a control that expands nothing is a lie a screen reader
   reads out loud -- the same note §3 above makes about the Contact disclosure. */

/* ── 3b · THE TRAVELLING ACTIVE INDICATOR IS GONE, AND THIS IS ITS HEADSTONE.
   Jayden, 2026-08-26: "the grey box behind the text should only show on hover
   not selected the bolding of the letters is enough to show its selected."
   The lit item marked itself twice -- with this pill and with an ink/weight/
   stroke change -- and the pill was the weaker marker by a factor of six
   (--c100 at 1.25:1 against the bar, versus --c700 -> --c950 at 7.8:1 -> 16.6:1
   with the glyph's stroke going 1.75 -> 2). The strong one stays; the redundant
   one goes, and hover gets the ground to itself. header.css records the full
   reasoning, including why the phone -- which has no labels to embolden -- did
   not need a special case.
   WHAT LEAVES WITH IT, and this is the part worth having in the diff: the
   element, placeInk()'s two live getBoundingClientRects, a MutationObserver on
   the whole nav subtree, a document.fonts.ready callback and a rAF-coalesced
   resize listener. All nine pages end this change with one fewer resize
   listener and one fewer MutationObserver, and the bar does no measurement at
   all any more. Its honest limit -- "it can only slide between two states that
   exist in the same document" -- was already down to zero such transitions once
   About became its own page, so the travel it existed for had no callers left.

   ── 3c · THE TIME-OF-DAY SWITCH ───────────────────────────────────────────
   Jayden, 2026-08-26: "the time of day button should be in the header since it
   affects all the pages."

   WHY THIS FILE AND NOT hero-time.js. The control writes a SITE-WIDE state --
   data-theme-mode / data-theme-state on <html>, which the footer band and the
   case-study covers both read -- but it lived in index.html's Hero rail and was
   driven by hero-time.js, which no other page loads. header.js is on all nine
   pages, so the control's behaviour follows the control into the chrome.
   hero-time.js keeps what is genuinely the Hero's: the sky cross-fade, the
   night spill and the portrait cast. It no longer touches the button, the menu
   or the icon, so the two files cannot both bind the same trigger.

   THE GLYPH IS NOT SET HERE. header.css picks the hour's <g> off
   :root[data-theme-state], which site-theme.js -- a blocking script in <head> --
   has already written before this markup is parsed. That is why there is no
   first-paint hole on the eight pages that do not load hero-time.js, and why
   this file has no icon code at all.

   FEATURE-DETECTED LIKE EVERYTHING ELSE IN THIS FILE: a page without the
   control, or without SiteTheme, binds nothing. */
var timeWrap = nav.querySelector(".heroTime");
var timeBtn  = document.getElementById("heroTimeBtn");
var timeMenu = document.getElementById("heroTimeMenu");
if(timeWrap && timeBtn && timeMenu && window.SiteTheme){
 var siteTheme = window.SiteTheme;
 var timeItems = [].slice.call(timeMenu.querySelectorAll('[role="menuitemradio"]'));

 var timeClose = function(returnFocus){
  timeWrap.classList.remove("open");
  timeMenu.style.removeProperty("transform");
  timeMenu.style.removeProperty("max-height");
  timeBtn.setAttribute("aria-expanded","false");
  if(returnFocus)timeBtn.focus();
 };

 /* THE MENU HANGS DOWNWARD NOW, AND THIS FUNCTION FINALLY AGREES WITH ITS CSS.
    It always computed `innerHeight - trigger.bottom`, which is the room BELOW
    the trigger -- correct for a bar at the top of the window and meaningless
    for the Hero's bottom-right corner, where the stylesheet had flipped the
    anchor to `bottom:calc(100% + 8px)` and this measurement was quietly capping
    the height against the wrong side. Nothing here changed; the anchor moved
    back under it.
    The horizontal shift is a clamp, not a flip: at 320 a 216px panel hung off a
    trigger 16px from the right edge would run 0..232 and fit, but the same
    panel on a narrower future zone would not, so the shift stays. */
 var timePosition = function(){
  var gutter = parseFloat(getComputedStyle(root).getPropertyValue("--menu-viewport-gutter")) || 0;
  timeMenu.style.removeProperty("transform");
  timeMenu.style.removeProperty("max-height");
  var b = timeBtn.getBoundingClientRect();
  timeMenu.style.setProperty("max-height", Math.max(0, window.innerHeight - b.bottom - gutter) + "px");
  var r = timeMenu.getBoundingClientRect();
  var shift = Math.max(gutter - r.left, Math.min(window.innerWidth - gutter - r.right, 0));
  if(shift !== 0) timeMenu.style.setProperty("transform","translateX(" + shift + "px)");
 };

 var timeOpen = function(focusItem){
  timeWrap.classList.add("open");
  timeBtn.setAttribute("aria-expanded","true");
  timePosition();
  if(focusItem){
   var selected = timeItems.filter(function(item){
    return item.getAttribute("aria-checked") === "true";})[0];
   (selected || timeItems[0]).focus();
  }
 };

 var timeMove = function(offset){
  var index = timeItems.indexOf(document.activeElement);
  if(index < 0) index = 0;
  timeItems[(index + offset + timeItems.length) % timeItems.length].focus();
 };

 var timeChoose = function(item){
  siteTheme.setMode(item.getAttribute("data-time-mode"));
  timeClose(true);
 };

 timeBtn.addEventListener("click", function(){
  if(timeWrap.classList.contains("open")) timeClose(false); else timeOpen(true);
 });
 timeBtn.addEventListener("keydown", function(event){
  if(event.key === "ArrowDown" || event.key === "ArrowUp"){
   event.preventDefault();
   if(!timeWrap.classList.contains("open")) timeOpen(false);
   (event.key === "ArrowDown" ? timeItems[0] : timeItems[timeItems.length - 1]).focus();
  }else if(event.key === "Escape" && timeWrap.classList.contains("open")){
   event.preventDefault(); timeClose(true);
  }
 });
 timeMenu.addEventListener("click", function(event){
  var item = event.target.closest('[role="menuitemradio"]');
  if(item && timeMenu.contains(item)) timeChoose(item);
 });
 timeMenu.addEventListener("keydown", function(event){
  if(event.key === "ArrowDown" || event.key === "ArrowUp"){
   event.preventDefault(); timeMove(event.key === "ArrowDown" ? 1 : -1);
  }else if(event.key === "Home" || event.key === "End"){
   event.preventDefault(); timeItems[event.key === "Home" ? 0 : timeItems.length - 1].focus();
  }else if(event.key === "Enter" || event.key === " " || event.key === "Spacebar"){
   var item = event.target.closest('[role="menuitemradio"]');
   if(item && timeMenu.contains(item)){ event.preventDefault(); timeChoose(item); }
  }else if(event.key === "Escape"){
   event.preventDefault(); timeClose(true);
  }
 });
 document.addEventListener("pointerdown", function(event){
  if(timeWrap.classList.contains("open") && !timeWrap.contains(event.target)) timeClose(false);
 });
 addEventListener("resize", timePosition, {passive:true});

 /* aria-checked is the one part of the control's state a stylesheet cannot
    write, so it is mirrored from the published snapshot rather than set on
    click -- which keeps it right when the hour rolls over under an "Automatic"
    choice, and on a page where something else changed the mode. */
 siteTheme.subscribe(function(snapshot){
  timeItems.forEach(function(item){
   item.setAttribute("aria-checked",
    item.getAttribute("data-time-mode") === snapshot.mode ? "true" : "false");
  });
 });
 var first = siteTheme.getSnapshot();
 if(first) timeItems.forEach(function(item){
  item.setAttribute("aria-checked",
   item.getAttribute("data-time-mode") === first.mode ? "true" : "false");
 });
}

/* ── 4 · THE MOOD DOCK is not wired here, and that is deliberate. It moved out
   of the header as the same element it always was (#moodbar / #moodBtn /
   #moodMenu), so hero-engine.js:1822-1901 still owns opening it, clamping it,
   the chevron and the mood dispatch. Nothing was left for this file to do. */
})();

/* ═══════════════════════════════════════════════════════════════════════════
   5 · HAPTICS.  A press should be felt, not just seen.

   WHY IT LIVES HERE. Every page loads header.js, so the whole site gets this
   from one file with no markup to add and nothing to remember on the next page.
   It listens on `document` and reads the element under the pointer, so a control
   built at runtime -- the tournament's tabs, a mood button, a race row -- is
   covered the moment it exists. Nothing opts in.

   WHAT THE PLATFORM ACTUALLY DOES, because this is mostly a compatibility
   problem and not an animation one:
     - Android Chrome/Firefox/Samsung: navigator.vibrate works.
     - iOS: Safari historically never shipped the Vibration API. Reports in 2026
       differ on whether it now works, and iOS 18.4 began requiring a user
       gesture. So this NEVER assumes; it feature-detects, fires only from a real
       gesture, and does nothing at all where unsupported.
     - In-app WebViews (the LinkedIn browser, which is how a recruiter following
       his profile link arrives) are more restricted still.
   Nothing here changes behaviour when the API is missing. No polyfill: the ones
   circulating are third-party code, and this site is his job hunt.

   WHY POINTERDOWN AND NOT CLICK. A native tap is felt as the finger goes DOWN.
   Firing on click puts the buzz after the release, which reads as lag rather
   than as touch -- the same reason the press transition on .ctl is 100ms.

   WHY IT IS SO SHORT. 8-14ms is at the floor of what the hardware will render,
   which is the point: this is meant to be noticed only in the hand. His
   governing rule on this project is that premium is subtraction, and an
   over-buzzing site feels like a slot machine. Scrolls, hovers and drags get
   nothing. Only a deliberate press.
   ═══════════════════════════════════════════════════════════════════════════ */
(function haptics(){
 "use strict";
 var nav = window.navigator;
 if (!nav || typeof nav.vibrate !== "function") return;   // absent: do nothing, silently

 /* Someone who has asked for less motion has asked for less of this too. Read
    live rather than once, because the OS setting can change mid-session. */
 var mq = window.matchMedia ? matchMedia("(prefers-reduced-motion:reduce)") : null;
 function muted(){ return !!(mq && mq.matches); }

 /* The vocabulary. Three weights, because a site needs fewer than it thinks. */
 var TAP = 8,        // any control: tabs, nav, quiet buttons, chips
     PRESS = 13,     // the primary action in a group -- kick off, play, submit
     DONE = [10, 40, 22];   // something completed: a cup won, a head baked

 function buzz(pattern){
   if (muted()) return;
   try { nav.vibrate(pattern); } catch (_) {}   // never let feedback break the action
 }

 /* WHAT COUNTS AS A CONTROL. Deliberately narrow. `.ctl` is the shared control
    library, and the rest are the site's own interactive primitives. A bare <a>
    inside prose is NOT included: following a link is not a button press, and
    buzzing mid-sentence is exactly the cheapness this is trying to avoid. */
 var CONTROL = ".ctl,button,[role=button],[role=tab],summary,input[type=checkbox],input[type=radio]";
 var PRIMARY = ".ctl--primary,.pBtnGo,.tvGo,.moodGo";

 document.addEventListener("pointerdown", function(e){
   /* isTrusted keeps synthetic events out -- the contracts drive this site with
      dispatched events, and a test run should not make the phone buzz. */
   if (!e.isTrusted || e.button !== 0) return;
   var el = e.target && e.target.closest ? e.target.closest(CONTROL) : null;
   if (!el) return;
   if (el.disabled || el.getAttribute("aria-disabled") === "true") return;
   buzz(el.closest(PRIMARY) ? PRESS : TAP);
 }, {passive:true, capture:true});

 /* The completion note, for the moments that deserve one. Published rather than
    wired to specific screens, so the tournament, the Maker and the games can
    each say "this finished" without any of them knowing how it is expressed. */
 window.__hmHaptic = function(kind){
   buzz(kind === "done" ? DONE : kind === "press" ? PRESS : TAP);
 };
})();
