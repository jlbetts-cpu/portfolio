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

  var sync = function(){
    var open = body.classList.contains("about-open");
    aboutBtn.setAttribute("aria-expanded", String(open));
    if(open) aboutBtn.setAttribute("aria-current","true");
    else     aboutBtn.removeAttribute("aria-current");
    body.setAttribute("data-nav", open ? "about" : rest);
    if(back) back.hidden = !open;
    /* the lockup stops being "where you are" while a takeover is open */
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

/* ── 3 · THE SPLIT CONTROLS ────────────────────────────────────────────────
   A destination and a disclosure in one slot, at both ends of the bar: Play on
   the left, Contact on the right. Jayden asked for hover, and hover alone is
   not shippable, so each control has three independent routes in:

     MOUSE     hovering the wrapper opens it after OPEN_DELAY and closes it
               after CLOSE_DELAY. Both delays matter. The open delay is what
               stops the menu springing at you when the pointer merely crosses
               the item on its way somewhere else -- the same abruptness he
               objected to once already. The close delay is what lets you cross
               the gap between the label and the panel without it vanishing.
               Gated on (hover:hover) and (pointer:fine): on touch, mouseenter
               fires on tap and would open and close in one gesture.
     TOUCH     the label is a real <a href> and navigates. The caret beside it
               is a real <button aria-expanded aria-controls> with its own
               44x44. One target each, so a tap never means two things.
     KEYBOARD  Tab reaches the link, Tab again the caret, Enter/Space opens,
               the panel's links follow in DOM order because the panel is the
               caret's next sibling. Escape closes and returns focus to the
               caret. Moving focus out of the wrapper closes it.

   #moodbar is deliberately EXCLUDED: hero-engine.js:1812-1901 already owns that
   one on index.html -- its open, its close, its clampMenuX, its chevron, its
   hover, its outside-click and its Escape. Two controllers on one button
   toggle each other and the menu silently stops working, which is the exact
   bug play-games.js documents at its own line 51. */
var DISC_OPEN_DELAY  = 120;   /* pointer must dwell before the panel commits */
var DISC_CLOSE_DELAY = 260;   /* forgiving enough to cross the gap to the panel */

[].forEach.call(nav.querySelectorAll(".jbDisc"), function(wrap){
  if(wrap.id === "moodbar") return;                 /* hero-engine's, not ours */
  var car  = wrap.querySelector(".jbDiscCar");
  var menu = wrap.querySelector(".jbDiscMenu");
  if(!car || !menu) return;
  var openT = 0, closeT = 0;

  function open(){
    clearTimeout(openT); clearTimeout(closeT);
    wrap.classList.add("open"); car.setAttribute("aria-expanded","true");
  }
  function close(){
    clearTimeout(openT); clearTimeout(closeT);
    wrap.classList.remove("open"); car.setAttribute("aria-expanded","false");
  }
  function isOpen(){ return wrap.classList.contains("open"); }

  car.addEventListener("click", function(e){
    e.preventDefault(); e.stopPropagation();
    isOpen() ? close() : open();
  });

  /* keyboard: reaching any part of the control opens it, leaving closes it.
     focusout fires before focusin on the new target, so the check is deferred
     one tick -- otherwise tabbing from the caret INTO the panel closes it. */
  wrap.addEventListener("focusin", open);
  wrap.addEventListener("focusout", function(){
    setTimeout(function(){ if(!wrap.contains(document.activeElement)) close(); }, 0);
  });
  wrap.addEventListener("keydown", function(e){
    if(e.key !== "Escape" || !isOpen()) return;
    e.stopPropagation(); close(); car.focus();
  });

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

/* ── 4 · THE MOOD DOCK is not wired here, and that is deliberate. It moved out
   of the header as the same element it always was (#moodbar / #moodBtn /
   #moodMenu), so hero-engine.js:1822-1901 still owns opening it, clamping it,
   the chevron and the mood dispatch. Nothing was left for this file to do. */
})();
