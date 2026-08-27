(function(){
 "use strict";

 var siteTheme=window.SiteTheme;
 var root=document.documentElement;
 var hero=document.querySelector(".hero");
 /* ── THE CONTROL LEFT THIS FILE FOR header.js, 2026-08-26 ──────────────────
    Jayden: "the time of day button should be in the header since it affects all
    the pages." #heroTime / #heroTimeBtn / #heroTimeMenu / #heroTimeIcon are the
    same elements with the same ids, in the nav's trailing zone now, and
    header.js -- which every page loads -- owns opening them, the keyboard, the
    outside-click and aria-checked. header.css picks the trigger's glyph off
    :root[data-theme-state], so nothing writes data-icon any more.
    WHAT IS LEFT HERE IS THE ONLY PART THAT WAS EVER THE HERO'S: the sky
    cross-fade, the night spill and the portrait's cast and lit layers. None of
    it exists on the other eight pages, which is why this file is still the one
    that does it and why it is still loaded by index.html alone.
    THE GUARD BELOW LOSES THE CONTROL'S FOUR ELEMENTS WITH IT. Leaving them in
    would have made this file bail on any page where the nav is missing -- and
    would have made two files bind the same button on this one. */
 /* ── THE NIGHT SPILL IS NO LONGER PART OF THE SCENE.  2026-08-26 ───────────
    #heroTimeSpill is a full-bleed near-black panel hanging below the Hero's
    floor, and its whole job was to carry the night hero's ground into a work
    section that was ALSO near-black. The site stays light at every hour now, so
    against a light section it painted 144px of black smear across the tab row --
    the shape it existed to prevent. CSS stopped raising it first; this file was
    still pinning opacity:1 on it inline through targetScene(), which is why the
    smear survived the stylesheet change. Both halves had to go.
    THE ELEMENT AND ITS PAINT ARE LEFT IN PLACE, unreferenced -- see the
    headstone on its rule in hero-time.css. Nothing here reads or writes it.*/
 var face=document.getElementById("face");
 var portrait=document.getElementById("heroTimePortraitCast");
 if(!siteTheme||!root||!hero||!face||!portrait)return;

 /* ── THE LIT SIDE NEEDS A BOX OF ITS OWN, AND IT IS BUILT HERE ──────────────
    One element can carry one blend mode, and light and shadow are two: the
    portrait cast multiplies the hour's shading colour along a ramp facing away
    from the source, and this one screens the hour's LIGHT colour out of a
    radial hot spot facing toward it. See hero-time.css for why the second term
    is not the first one inverted.
    IT IS CREATED RATHER THAN AUTHORED because index.html is not this lane's to
    edit, and because an element that exists only to carry a treatment this file
    owns should be built and torn down with it -- a markup element for a purely
    presentational layer is one more thing to leave behind if the treatment ever
    changes again. It is inserted immediately after the cast so it paints above
    it at the same z-index and below the eyes, which sit at 3 and must stay the
    brightest thing on the head.
    IT REUSES THE PORTRAIT AS ITS OWN MASK. Same file, already decoded, so there
    is no second fetch -- and because the mask is the artwork's alpha, the layer
    is confined to the silhouette by construction rather than by tuning. */
 var glow=document.getElementById("heroTimePortraitLit");
 if(!glow){
  glow=document.createElement("div");
  glow.id="heroTimePortraitLit";
  glow.classList.add("heroTimePortraitLit");
  glow.setAttribute("aria-hidden","true");
  if(portrait.parentNode)portrait.parentNode.insertBefore(glow,portrait.nextSibling);
 }

 var gradients=[].slice.call(hero.querySelectorAll(".heroTimeGradient"));
 var sceneAnimations=[];
 var current=null;
 var destroyed=false;
 var unsubscribe=function(){};
 var portraitObserver=null;

 function prefersReducedMotion(){
  return root.getAttribute("data-reduced-motion")==="reduce";
 }

 function number(value){
  var parsed=parseFloat(value);
  return Number.isFinite(parsed)?parsed:0;
 }

 function computed(element){
  return typeof window.getComputedStyle==="function"?window.getComputedStyle(element):null;
 }

 function captureScene(){
  return {
   gradients:gradients.map(function(layer){var style=computed(layer);return style?number(style.opacity):0;}),
   portrait:(function(){
    var style=computed(portrait);
    return {opacity:style?number(style.opacity):0};
   })()
  };
 }

 function clearSceneAnimations(){
  sceneAnimations.forEach(function(animation){animation.cancel();});
  sceneAnimations=[];
 }

 function clearSettledSceneStyles(){
  gradients.forEach(function(layer){
   layer.style.removeProperty("opacity");
   layer.style.removeProperty("z-index");
  });
  portrait.style.removeProperty("opacity");
 }

 /* ── THE DESTINATION IS WHAT THE HOUR ASKS FOR, NOT WHAT IS ON SCREEN ──────
    THE SUSPECT THIS INHERITED, AND THE VERDICT. This function used to read the
    layer's target opacity back off the ELEMENT, and writeFinalScene pins that
    number inline -- which reads as a fixed point: a value that reads itself
    converges on whatever it already is rather than on what the state asks for.
    It was handed over as the prime suspect for the face washing out.
    It is not, and the sequence is why: transitionScene calls
    clearSettledSceneStyles() BEFORE targetScene(), so the inline pin is gone by
    the time the read happens and the computed value falls through to the CSS,
    which is the authored per-state value for the state data-time-state was
    already set to. Reproduced in the browser on a probe carrying the same
    `opacity:var(--authored)` plus a 640ms opacity transition: pin .34, retarget
    to .18, removeProperty, read -> 0.18. Not 0.34. With the transition removed,
    identical. The controller's own unit tests assert a different destination per
    hour and passed against the pre-fix source, which is the same result from a
    second direction.
    IT IS STILL READ FROM THE HOUR AND NOT FROM THE ELEMENT, because the
    correctness of the old version rested entirely on clear-then-read ordering
    inside another function. Reorder those two lines and the fixed point becomes
    real. --time-shade cannot be pinned by anything here, so the ordering stops
    being load-bearing.
    The filter was read off the element the same way, and it is simply not
    written any more: it never varies by hour, so animating a constant back onto
    itself bought nothing and cost the same fragility. */
 function shadeNow(){
  var style=computed(hero);
  var value=style?parseFloat(style.getPropertyValue("--time-shade")):0;
  return Number.isFinite(value)?value:0;
 }

 function targetScene(state){
  return {
   gradients:gradients.map(function(layer){return layer.getAttribute("data-time-gradient")===state?1:0;}),
   portrait:{opacity:state==="off"?0:shadeNow()}
  };
 }

 function sceneDuration(){
  var style=computed(root);
  var raw=style&&style.getPropertyValue?style.getPropertyValue("--hero-time-duration").trim():"";
  var duration=parseFloat(raw)||0;
  return /ms$/i.test(raw)?duration:duration*1000;
 }

 function sceneEasing(){
  var style=computed(root);
  var easing=style&&style.getPropertyValue?style.getPropertyValue("--hero-time-ease").trim():"";
  return easing||"cubic-bezier(.22,1,.36,1)";
 }

 function runSceneAnimation(element,frames,options){
  if(typeof element.animate!=="function")return;
  var animation=element.animate(frames,options);
  sceneAnimations.push(animation);
  animation.onfinish=function(){
   animation.cancel();
   sceneAnimations=sceneAnimations.filter(function(candidate){return candidate!==animation;});
  };
 }

 /* The lift is NOT cleared here. This runs immediately after the animations are
    created, so removing it would undo the one that was just set -- and it is
    cleared by clearSettledSceneStyles() at the head of every transition anyway,
    which is the only moment it can be stale. */
 function writeFinalScene(target){
  gradients.forEach(function(layer,index){layer.style.setProperty("opacity",target.gradients[index]);});
  portrait.style.setProperty("opacity",target.portrait.opacity);
 }

 function transitionScene(from,state,initial){
  clearSceneAnimations();
  clearSettledSceneStyles();
  var target=targetScene(state);
  if(initial||prefersReducedMotion()){
   writeFinalScene(target);
   return;
  }
  var duration=sceneDuration();
  if(duration<=0){writeFinalScene(target);return;}
  var options={duration:duration,easing:sceneEasing(),fill:"both"};
  /* ── A CROSS-FADE OF TWO PARTLY-TRANSPARENT LAYERS IS NOT A CROSS-FADE ─────
     Both skies used to ramp at once, one up and one down. Their opacities sum
     to 1, which looks like it should be safe, but they are STACKED: at weights
     w and 1-w the picture is w*incoming + (1-w)*((1-w)*outgoing + w*backdrop),
     so a quarter of the Hero's own background colour paints THROUGH the pair at
     the midpoint -- and that background is itself mid-transition between white
     and near-black. Measured at the head's resting point, daytime -> night: the
     composite ran 11% / 23% / 33% DARKER than a straight blend of the two skies
     at weights .42 / .57 / .69, and the deviation was half again as large in
     blue as in red. The sky dipped grey and desaturated on its way to night,
     which is precisely the "not smooth" Jayden was pointing at -- every value
     was moving correctly and the composite still lurched.
     HOLD AND COVER instead. The incoming sky is lifted above the others and
     fades 0 -> 1; every other layer HOLDS wherever it is and is dropped to its
     destination only once the incoming is opaque, where nothing can see it. The
     backdrop contributes nothing at any instant, so the blend is exactly the
     two skies. The lift is mandatory rather than tidy: the incoming layer is
     often EARLIER in the DOM than the outgoing one (daytime is third, night is
     sixth), and without it the held layer would cover the arriving one
     completely and then vanish in a single frame.
     `off` is the one state with no incoming sky, and it is also the one state
     where the page underneath is the point -- so it keeps the plain fade. */
  var incoming=target.gradients.indexOf(1);
  gradients.forEach(function(layer,index){
   var settled=index===incoming||incoming<0?target.gradients[index]:from.gradients[index];
   if(index===incoming)layer.style.setProperty("z-index","1");
   runSceneAnimation(layer,[{opacity:from.gradients[index]},{opacity:settled}],options);
  });
  runSceneAnimation(portrait,[
   {opacity:from.portrait.opacity},{opacity:target.portrait.opacity}
  ],options);
  /* Pin the destination under WAAPI. This preserves the old rendered spill
     while SiteTheme changes root state before publishing the next snapshot. */
  writeFinalScene(target);
 }

 function applySnapshot(snapshot,initial){
  if(!snapshot||destroyed)return;
  var from=captureScene();
  current=snapshot;
  hero.setAttribute("data-time-mode",snapshot.mode);
  hero.setAttribute("data-time-state",snapshot.state);
  transitionScene(from,snapshot.state,initial);
 }

 function settleScene(){
  if(!current||destroyed)return;
  clearSceneAnimations();
  clearSettledSceneStyles();
  writeFinalScene(targetScene(current.state));
 }

 function syncPortraitSource(useCurrentSource){
  var source=useCurrentSource&&face.currentSrc?face.currentSrc:face.getAttribute("src");
  var sourceSet=face.getAttribute("srcset");
  var sizes=face.getAttribute("sizes");
  if(source!==null&&portrait.getAttribute("src")!==source)portrait.setAttribute("src",source);
  if(sourceSet!==null)portrait.setAttribute("srcset",sourceSet);
  else portrait.removeAttribute("srcset");
  if(sizes!==null)portrait.setAttribute("sizes",sizes);
  else portrait.removeAttribute("sizes");
  /* The lit layer has no src -- it is a gradient wearing the portrait's alpha,
     so the same file arrives as a mask instead. Every face image the engine can
     swap in is square and .face is object-fit:contain inside a square .stage,
     so mask-size:contain lands the mask on exactly the pixels the portrait is
     painting. Quotes are escaped rather than trusted: this string is
     interpolated into a url() token, and a src the engine builds is still a
     value, not a literal. */
  if(source!==null){
   glow.style.setProperty("--time-portrait-mask",
    'url("'+String(source).replace(/["\\]/g,encodeURIComponent)+'")');
  }else glow.style.removeProperty("--time-portrait-mask");
 }

 function onFaceLoad(){syncPortraitSource(true);}

 function destroy(){
  if(destroyed)return;
  destroyed=true;
  unsubscribe();
  window.removeEventListener("jbthemesettle",settleScene);
  face.removeEventListener("load",onFaceLoad);
  if(portraitObserver)portraitObserver.disconnect();
  clearSceneAnimations();
 }

 window.addEventListener("jbthemesettle",settleScene);
 face.addEventListener("load",onFaceLoad);
 if(typeof MutationObserver==="function"){
  portraitObserver=new MutationObserver(function(){syncPortraitSource(false);});
  portraitObserver.observe(face,{attributes:true,attributeFilter:["src","srcset","sizes"]});
 }
 syncPortraitSource(false);
 unsubscribe=siteTheme.subscribe(function(snapshot){applySnapshot(snapshot,false);});
 applySnapshot(siteTheme.getSnapshot(),true);

 window.HeroTimeController={getSnapshot:function(){return current;},destroy:destroy};
})();
