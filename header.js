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
 "lucide-briefcase-business":'<path d="M12 12h.01"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M22 13a18.15 18.15 0 0 1-20 0"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
 "lucide-user-round":'<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
 "lucide-gamepad-2":'<line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.006-.051-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>',
 "lucide-mail":'<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
 "lucide-arrow-left":'<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
 "lucide-chevron-down":'<path d="m6 9 6 6 6-6"/>',
 "brand-linkedin":'<path d="M8 11v5M8 8v.01M12 16v-5M16 16v-3a2 2 0 0 0-4 0"/><path d="M3 7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/>',
 "brand-instagram":'<rect width="16" height="16" x="4" y="4" rx="4"/><circle cx="12" cy="12" r="3"/><line x1="16.5" x2="16.51" y1="7.5" y2="7.5"/>'
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

var navSymbols={work:"lucide-briefcase-business",about:"lucide-user-round",
  games:"lucide-gamepad-2",contact:"lucide-mail"};
Object.keys(navSymbols).forEach(function(key){
  [].forEach.call(nav.querySelectorAll('[data-nav-item="'+key+'"]'),function(control){
    replaceIcon(control,navSymbols[key]);
  });
});
[].forEach.call(nav.querySelectorAll(".jbBack"),function(control){
  replaceIcon(control,"lucide-arrow-left");
});
[].forEach.call(nav.querySelectorAll(".jbContact .jbDiscMenu a"),function(control){
  var href=(control.getAttribute("href")||"").toLowerCase();
  var symbol=href.indexOf("linkedin")>-1?"brand-linkedin":
             href.indexOf("instagram")>-1?"brand-instagram":"lucide-mail";
  replaceIcon(control,symbol);
});
var contactGo=nav.querySelector(".jbContact>.jbDiscGo");
if(contactGo&&!contactGo.querySelector(".jbDiscChevron")){
  contactGo.appendChild(lucideIcon("lucide-chevron-down","jbDiscChevron"));
}

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

/* ── 3 · THE DISCLOSURES ───────────────────────────────────────────────────
   ROUND 10.  Both carets are deleted, so a .jbDisc is a plain nav item with a
   panel attached.  Three routes in, and only two of them exist:

     MOUSE     hovering the wrapper opens it after OPEN_DELAY and closes it
               after CLOSE_DELAY. Both delays matter. The open delay is what
               stops the menu springing at you when the pointer merely crosses
               the item on its way somewhere else -- the same abruptness he
               objected to once already. The close delay is what lets you cross
               the gap between the label and the panel without it vanishing.
               Gated on (hover:hover) and (pointer:fine): on touch, mouseenter
               fires on tap and would open and close in one gesture.
     KEYBOARD  focus entering the wrapper opens it, focus leaving closes it, so
               Tab still walks label -> panel links in DOM order and Escape
               still closes and returns focus to the label. This survives the
               caret's deletion only because the wrapper, not the button, was
               always what was being watched.
     TOUCH     GONE.  There is no hover and no focus-before-activate on a phone,
               so tapping the label navigates and the panel never opens. That is
               the deliberate cost of removing the carets; what it strands is in
               the round-10 report, not papered over here.

   aria-expanded moved from the caret to the .jbDiscGo link. It is valid there --
   role=link supports it -- and it is the only element left that owns the panel.

   The MOOD DOCK (#moodbar) is deliberately excluded: it is not a disclosure any
   more, it is four always-visible buttons under the head, and hero-engine.js
   still owns its dispatch. It carries no .jbDisc class, so it is not in this
   list at all -- the id check is kept as a belt-and-braces guard because that
   file also toggles a class named "open" on it. */
var DISC_OPEN_DELAY  = 120;   /* pointer must dwell before the panel commits */
var DISC_CLOSE_DELAY = 260;   /* forgiving enough to cross the gap to the panel */

[].forEach.call(nav.querySelectorAll(".jbDisc"), function(wrap){
  if(wrap.id === "moodbar") return;                 /* hero-engine's, not ours */
  var go   = wrap.querySelector(".jbDiscGo");
  var menu = wrap.querySelector(".jbDiscMenu");
  if(!go || !menu) return;
  var openT = 0, closeT = 0;

  function open(){
    clearTimeout(openT); clearTimeout(closeT);
    wrap.classList.add("open"); go.setAttribute("aria-expanded","true");
  }
  function close(){
    clearTimeout(openT); clearTimeout(closeT);
    wrap.classList.remove("open"); go.setAttribute("aria-expanded","false");
  }
  function isOpen(){ return wrap.classList.contains("open"); }

  /* keyboard: reaching any part of the control opens it, leaving closes it.
     focusout fires before focusin on the new target, so the check is deferred
     one tick -- otherwise tabbing from the label INTO the panel closes it. */
  wrap.addEventListener("focusin", open);
  wrap.addEventListener("focusout", function(){
    setTimeout(function(){ if(!wrap.contains(document.activeElement)) close(); }, 0);
  });
  wrap.addEventListener("keydown", function(e){
    if(e.key !== "Escape" || !isOpen()) return;
    e.stopPropagation(); close(); go.focus();
  });

  /* TOUCH: the first tap OPENS, it does not navigate. There is no hover on a
     phone and there is no caret any more, so a trigger that navigated on tap
     would make its own panel unreachable. The destination is not lost -- the
     panel's first row (.jbDiscTouch, display:none anywhere hover exists) is a
     real <a href> to the same URL. Standard for a nav item that is both a place
     and a group, and it adds no glyph to the bar.
     Bound on (hover:none) rather than on a width, because the thing that
     decides this is the input device and not the viewport. */
  /* Belt and braces on the destination row. It is display:none outside
     (hover:none) in CSS, but a stale stylesheet would leave a second "Play" and
     a second "Contact" visible in the panel -- which is exactly what Jayden saw.
     Where the trigger itself navigates, the row has no job, so it is removed
     from the DOM rather than merely hidden. */
  if(!(window.matchMedia && matchMedia("(hover:none)").matches)){
    [].forEach.call(menu.querySelectorAll(".jbDiscTouch"), function(el){ el.remove(); });
  }

  if(window.matchMedia && matchMedia("(hover:none)").matches){
    go.addEventListener("click", function(e){
      if(isOpen()) return;             /* open already: let the row you tapped act */
      e.preventDefault(); open();
    });
  }

  if(window.matchMedia && matchMedia("(hover:hover) and (pointer:fine)").matches){
    wrap.addEventListener("mouseenter", function(){
      clearTimeout(closeT);
      if(!isOpen()) openT = setTimeout(open, DISC_OPEN_DELAY);
    });
    wrap.addEventListener("mouseleave", function(){
      clearTimeout(openT);
      closeT = setTimeout(function(){
        if(!wrap.matches(":hover") && !wrap.contains(document.activeElement)) close();
      }, DISC_CLOSE_DELAY);
    });
  }

  document.addEventListener("click", function(e){
    if(isOpen() && !wrap.contains(e.target)) close();
  });
});

/* ── 3b · THE TRAVELLING ACTIVE INDICATOR ──────────────────────────────────
   ONE element moved by transform, not a background on each item -- which is the
   whole reason it can travel at all, and also why it costs no layout: width and
   translate are both composited, and it is the only animated thing in the bar.

   ITS HONEST LIMIT, stated rather than discovered later: it can only slide
   between two states that exist in the SAME document. Work <-> About on
   index.html is a real transition (the About overlay is an in-page takeover, so
   nothing unloads). Every other move in this bar is a navigation: the new page
   paints with the indicator already parked under its own item. So the rule is
   "measure on load, park silently; move with motion only when the lit item
   changes while the page is alive", and that is what the `armed` flag below is.

   It is scoped to .jbNav and never spans pages -- there is no view transition
   and no cross-document state. Reduced motion gets the same element with no
   travel, because parking it instantly is exactly the reduced-motion answer. */
var ink = document.createElement("span");
ink.className = "jbInk"; ink.setAttribute("aria-hidden","true");
nav.appendChild(ink);
var armed = false;

/* ROUND 11: the indicator is a GREY PILL the size of the lit item's ink box --
   Jayden's "the grey should be on the pill around the activated tab". So it
   takes the item's whole rect, width and height, and header.css gives it the
   item's own --r-pill. Nothing about the measurement changed; what changed is
   the value it paints, which was a 1.03:1 wash and is now --c100.
   THE LIT ITEM IS BOLD as of this round, so its box is a few px wider than its
   unlit neighbours. Measuring the live rect on every call rather than caching
   one is what keeps the pill fitted after fonts land and after the About overlay
   swaps which item is lit -- both already covered by the callers below. */
function placeInk(){
  var lit = nav.querySelector('[aria-current]:not(.jbHome)');
  if(!lit){ ink.style.opacity = "0"; return; }
  var n = nav.getBoundingClientRect(), b = lit.getBoundingClientRect();
  if(!b.width){ ink.style.opacity = "0"; return; }
  ink.style.width  = b.width + "px";
  ink.style.height = b.height + "px";
  ink.style.transform = "translate(" + (b.left - n.left) + "px," + (b.top - n.top) + "px)";
  ink.style.opacity = "1";
  /* the first placement is a measurement, not a move: arm travel only after it */
  if(!armed){ armed = true; requestAnimationFrame(function(){ nav.classList.add("jbInkOn"); }); }
}
placeInk();
/* fonts land after first paint and the lit item changes width when they do */
if(document.fonts && document.fonts.ready) document.fonts.ready.then(placeInk);
new MutationObserver(placeInk).observe(nav,{subtree:true,attributes:true,
  attributeFilter:["aria-current","hidden"]});
/* ONE PLACEMENT PER FRAME, NOT ONE PER EVENT. placeInk() reads two live rects
   and then writes four style properties, so running it on every resize event --
   which a window drag emits faster than frames arrive -- was a read-after-write
   against the nav on every tick of the drag. The pill is only ever SEEN once a
   frame, so measuring it more often than that buys nothing; coalescing to a
   frame keeps the last size, which is the only one that gets painted. */
var inkRaf = 0;
addEventListener("resize", function(){
  if(inkRaf) return;
  inkRaf = requestAnimationFrame(function(){
    inkRaf = 0;
    nav.classList.remove("jbInkOn"); armed = false; placeInk();
  });
}, {passive:true});

/* ── 4 · THE MOOD DOCK is not wired here, and that is deliberate. It moved out
   of the header as the same element it always was (#moodbar / #moodBtn /
   #moodMenu), so hero-engine.js:1822-1901 still owns opening it, clamping it,
   the chevron and the mood dispatch. Nothing was left for this file to do. */
})();
