/* ===========================================================================
   THE SITE HEADER -- behaviour. One file, every page, deferred.
   Ported 2026-08-03 from header-prototype.html. Markup + CSS: header.css.
   Design: .superpowers/sdd/2026-08-02-play-page/header-report.md

   Everything here is feature-detected off the DOM that is actually present, so
   the same file is safe on all nine pages: a page with no .jbTop gets no
   condense logic, a page with no About button gets no About wiring, and the two
   fixed-bar pages (play, gradientlab) never bind a scroll listener at all.

   It deliberately does NOT own the About overlay or the moods. Both already
   have working implementations in hero-engine.js; this file only mirrors their
   state into the bar (aria-expanded, body[data-nav], the back arrow).
   =========================================================================== */
(function(){
"use strict";

var nav = document.querySelector(".jbNav");
if(!nav) return;

var body  = document.body;
var stick = nav.closest(".jbStick");
var top   = document.querySelector(".jbTop");
var home  = nav.querySelector(".jbHome");

/* ── 1 · SCROLL. Exactly two things change, and nothing ever hides. ─────────
   The bar's shadow deepens once content passes under it, and on the home page
   the social glyphs condense into the bar as the row scrolls away. A fixed bar
   sits on a page that does not scroll, so it binds nothing. */
if(stick && !stick.classList.contains("isFixed")){
  var row = top ? top.querySelector(".jbSocials") : null;
  var onScroll = function(){
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    nav.classList.toggle("isLifted", y > 8);
    /* No width guard: the stacked lockup freed enough of the 390px budget that
       the condense works at every width -- one glyph below 640, three above,
       handled in the component's own media query. */
    if(row) nav.classList.toggle("hasSoc", y > row.getBoundingClientRect().height + 14);
  };
  window.addEventListener("scroll", onScroll, {passive:true});
  onScroll();
}

/* ── 2 · ABOUT ─────────────────────────────────────────────────────────────
   On index.html About is a <button> that toggles the existing in-page takeover;
   hero-engine.js already binds it by id (#navAbout) and already routes the
   #about hash, so this adds no opening logic. It mirrors the overlay's state
   into the bar: which item is lit, aria-expanded, and whether the lockup wears
   its back arrow. On every other page About is a plain link to index.html#about.

   Watching body's class list rather than patching openAbout/closeAbout keeps
   the two halves independent -- the overlay has four different exit paths
   (button, Esc, popstate, the head) and all four land on the same class. */
var aboutBtn = nav.querySelector('[data-nav-item="about"]');
if(aboutBtn && aboutBtn.tagName === "BUTTON"){
  var rest  = body.getAttribute("data-nav") || "home";
  var ARROW = '<svg class="jbArrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6l6 6"/></svg>';

  var sync = function(){
    var open = body.classList.contains("about-open");
    aboutBtn.setAttribute("aria-expanded", String(open));
    if(open) aboutBtn.setAttribute("aria-current","true");
    else     aboutBtn.removeAttribute("aria-current");
    body.setAttribute("data-nav", open ? "about" : rest);
    if(!home) return;
    /* The lockup IS the back affordance, which is what retires .heroBack and
       .navTitle: the overlay's own back button and title had no other job. */
    var arrow = home.querySelector(".jbArrow");
    if(open && !arrow){
      home.insertAdjacentHTML("afterbegin", ARROW);
      home.setAttribute("aria-label","Back — Jayden Betts, home");
    }else if(!open && arrow){
      arrow.remove();
      home.setAttribute("aria-label","Jayden Betts, home");
    }
  };
  new MutationObserver(sync).observe(body,{attributes:true,attributeFilter:["class"]});
  sync();

  /* While the overlay is open the lockup closes it rather than reloading the
     page -- same destination, no navigation. hero-engine owns closeAbout. */
  if(home) home.addEventListener("click", function(e){
    if(!body.classList.contains("about-open")) return;
    if(typeof window.closeAbout === "function"){ e.preventDefault(); window.closeAbout(); }
  });
}

/* ── 3 · THE MOOD DOCK is not wired here, and that is deliberate. It moved out
   of the header as the same element it always was (#moodbar / #moodBtn /
   #moodMenu), so hero-engine.js:1822-1901 still owns opening it, clamping it,
   the chevron and the mood dispatch. Nothing was left for this file to do. */
})();
