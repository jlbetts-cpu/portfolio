(function(){
 "use strict";

 var siteTheme=window.SiteTheme;
 var root=document.documentElement;
 var hero=document.querySelector(".hero");
 var control=document.getElementById("heroTime");
 var button=document.getElementById("heroTimeBtn");
 var menu=document.getElementById("heroTimeMenu");
 var icon=document.getElementById("heroTimeIcon");
 var spill=document.getElementById("heroTimeSpill");
 var face=document.getElementById("face");
 var portrait=document.getElementById("heroTimePortraitCast");
 if(!siteTheme||!root||!hero||!control||!button||!menu||!icon||!spill||!face||!portrait)return;

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

 var items=[].slice.call(menu.querySelectorAll('[role="menuitemradio"]'));
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
   spill:(function(){var style=computed(spill);return style?number(style.opacity):0;})(),
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
  spill.style.removeProperty("opacity");
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
   spill:state==="night"?1:0,
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
  spill.style.setProperty("opacity",target.spill);
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
  runSceneAnimation(spill,[{opacity:from.spill},{opacity:target.spill}],options);
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
  items.forEach(function(item){
   item.setAttribute("aria-checked",item.getAttribute("data-time-mode")===snapshot.mode?"true":"false");
  });
  icon.setAttribute("data-icon",snapshot.state);
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

 function closeMenu(returnFocus){
  control.classList.remove("open");
  menu.style.removeProperty("transform");
  menu.style.removeProperty("max-height");
  button.setAttribute("aria-expanded","false");
  if(returnFocus)button.focus();
 }

 function positionMenu(){
  var viewportGutter=parseFloat(getComputedStyle(root).getPropertyValue("--menu-viewport-gutter"))||0;
  menu.style.removeProperty("transform");
  menu.style.removeProperty("max-height");
  var buttonRect=button.getBoundingClientRect();
  var available=Math.max(0,window.innerHeight-buttonRect.bottom-viewportGutter);
  menu.style.setProperty("max-height",available+"px");
  var rect=menu.getBoundingClientRect();
  var minimumShift=viewportGutter-rect.left;
  var maximumShift=window.innerWidth-viewportGutter-rect.right;
  var shift=Math.max(minimumShift,Math.min(maximumShift,0));
  if(shift!==0)menu.style.setProperty("transform","translateX("+shift+"px)");
 }

 function openMenu(focusItem){
  control.classList.add("open");
  button.setAttribute("aria-expanded","true");
  positionMenu();
  if(focusItem){
   var selected=items.filter(function(item){return item.getAttribute("aria-checked")==="true";})[0];
   (selected||items[0]).focus();
  }
 }

 function toggleMenu(){
  if(control.classList.contains("open"))closeMenu(false);
  else openMenu(true);
 }

 function moveFocus(offset){
  var index=items.indexOf(document.activeElement);
  if(index<0)index=items.findIndex(function(item){return item.getAttribute("aria-checked")==="true";});
  if(index<0)index=0;
  items[(index+offset+items.length)%items.length].focus();
 }

 function choose(item){
  siteTheme.setMode(item.getAttribute("data-time-mode"));
  closeMenu(true);
 }

 function onButtonKeydown(event){
  if(event.key==="ArrowDown"||event.key==="ArrowUp"){
   event.preventDefault();
   if(!control.classList.contains("open"))openMenu(false);
   (event.key==="ArrowDown"?items[0]:items[items.length-1]).focus();
  }else if(event.key==="Escape"&&control.classList.contains("open")){
   event.preventDefault();closeMenu(true);
  }
 }

 function onMenuKeydown(event){
  if(event.key==="ArrowDown"||event.key==="ArrowUp"){
   event.preventDefault();moveFocus(event.key==="ArrowDown"?1:-1);
  }else if(event.key==="Home"||event.key==="End"){
   event.preventDefault();items[event.key==="Home"?0:items.length-1].focus();
  }else if(event.key==="Enter"||event.key===" "||event.key==="Spacebar"){
   var item=event.target.closest('[role="menuitemradio"]');
   if(item&&menu.contains(item)){event.preventDefault();choose(item);}
  }else if(event.key==="Escape"){
   event.preventDefault();closeMenu(true);
  }
 }

 function onMenuClick(event){
  var item=event.target.closest('[role="menuitemradio"]');
  if(item&&menu.contains(item))choose(item);
 }

 function onOutsidePointerdown(event){
  if(control.classList.contains("open")&&!control.contains(event.target))closeMenu(false);
 }

 function destroy(){
  if(destroyed)return;
  destroyed=true;
  unsubscribe();
  button.removeEventListener("click",toggleMenu);
  button.removeEventListener("keydown",onButtonKeydown);
  menu.removeEventListener("click",onMenuClick);
  menu.removeEventListener("keydown",onMenuKeydown);
  document.removeEventListener("pointerdown",onOutsidePointerdown);
  window.removeEventListener("resize",positionMenu);
  window.removeEventListener("jbthemesettle",settleScene);
  face.removeEventListener("load",onFaceLoad);
  if(portraitObserver)portraitObserver.disconnect();
  clearSceneAnimations();
  closeMenu(false);
 }

 button.addEventListener("click",toggleMenu);
 button.addEventListener("keydown",onButtonKeydown);
 menu.addEventListener("click",onMenuClick);
 menu.addEventListener("keydown",onMenuKeydown);
 document.addEventListener("pointerdown",onOutsidePointerdown);
 window.addEventListener("resize",positionMenu);
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
