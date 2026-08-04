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

/* ── 3 · THE MOOD DOCK is not wired here, and that is deliberate. It moved out
   of the header as the same element it always was (#moodbar / #moodBtn /
   #moodMenu), so hero-engine.js:1822-1901 still owns opening it, clamping it,
   the chevron and the mood dispatch. Nothing was left for this file to do. */
})();
