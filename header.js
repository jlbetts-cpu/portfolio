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

/* ── 2 · ABOUT ─────────────────────────────────────────────────────────────
   On index.html About is a <button> that toggles the existing in-page takeover;
   hero-engine.js already binds it by id (#navAbout) and already routes the
   #about hash, so this adds no opening logic. It mirrors the overlay's state
   into the bar: which item is lit, aria-expanded, and whether the Back item is
   showing. On every other page About is a plain link to index.html#about.

   Watching body's class list rather than patching openAbout/closeAbout keeps
   the two halves independent -- the overlay has four different exit paths
   (button, Esc, popstate, the head) and all four land on the same class. */
var aboutBtn = nav.querySelector('[data-nav-item="about"]');
if(aboutBtn && aboutBtn.tagName === "BUTTON"){
  var rest = body.getAttribute("data-nav") || "home";
  /* The overlay's own back button and title were retired when the lockup became
     the back affordance; v2 splits that back out into a real item (§5.1), so the
     home page ships a hidden .jbBack and this is what reveals it. Without it the
     overlay would have no visible exit in the chrome at all -- the exact class
     of "moved without what it depended on" this pass was told to watch for. */
  var back = nav.querySelector(".jbBack");

  /* THE LIT ITEM IS EXCLUSIVE, and until round 11 it was not. Jayden: "About has
     both Work and About highlighted for some reason." The cause is the shape of
     the decision to keep About as an in-page takeover rather than a route: Work
     carries aria-current="page" because the document IS the home page, and this
     function added aria-current to About on top of it. Nothing cleared the first,
     so two items claimed the current state at once -- a real accessibility fault
     as well as a visual one, since two aria-current="page" elements in one nav
     is invalid.
     THE FIX IS TO MAKE THE STATE AUTHORITATIVE RATHER THAN ADDITIVE. The bar's
     resting lit item is recorded once, at load, with the exact attribute VALUE
     it shipped ("page" on index, "true" on the sub-pages) so restoring it cannot
     silently change its semantics. While the overlay is open every other item is
     cleared and About alone is lit; on close the recorded item is put back.
     It is driven off body.about-open, which is the same class the MutationObserver
     below already watches -- so all four of the overlay's exits (the button,
     Escape, popstate and the head) restore Work without any of them knowing this
     code exists.
     THE HANDOFF IS THE ONE MOVE THE TRAVELLING PILL WAS BUILT FOR: Work and
     About are siblings in the same group and the document never unloads, so the
     indicator slides between them instead of blinking. Every other change of lit
     item in this bar is a navigation and cannot be animated. */
  var restLit = nav.querySelector('[aria-current]:not(.jbHome)');
  var restLitVal = restLit ? restLit.getAttribute("aria-current") : null;

  var sync = function(){
    var open = body.classList.contains("about-open");
    aboutBtn.setAttribute("aria-expanded", String(open));
    body.setAttribute("data-nav", open ? "about" : rest);
    if(back) back.hidden = !open;

    if(open){
      /* exactly one lit item: clear whatever the page shipped, light About */
      if(restLit && restLit !== aboutBtn) restLit.removeAttribute("aria-current");
      aboutBtn.setAttribute("aria-current","true");
    }else{
      aboutBtn.removeAttribute("aria-current");
      if(restLit && restLit !== aboutBtn) restLit.setAttribute("aria-current", restLitVal);
    }

    /* the mark stops being "where you are" while a takeover is open */
    if(home){
      if(open) home.removeAttribute("aria-current");
      else if(home.dataset.navHome === "1") home.setAttribute("aria-current","page");
    }
  };
  new MutationObserver(sync).observe(body,{attributes:true,attributeFilter:["class"]});
  sync();

  /* While the overlay is open, the lockup and Back close it rather than
     reloading the page -- same destination, no navigation. hero-engine owns
     closeAbout. */
  var closeIfOpen = function(e){
    if(!body.classList.contains("about-open")) return;
    if(typeof window.closeAbout === "function"){ e.preventDefault(); window.closeAbout(); }
  };
  if(home) home.addEventListener("click", closeIfOpen);
  if(back) back.addEventListener("click", closeIfOpen);
}

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
addEventListener("resize", function(){
  nav.classList.remove("jbInkOn"); armed = false; placeInk();
}, {passive:true});

/* ── 4 · THE MOOD DOCK is not wired here, and that is deliberate. It moved out
   of the header as the same element it always was (#moodbar / #moodBtn /
   #moodMenu), so hero-engine.js:1822-1901 still owns opening it, clamping it,
   the chevron and the mood dispatch. Nothing was left for this file to do. */
})();
