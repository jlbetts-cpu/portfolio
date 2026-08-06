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
    return {opacity:style?number(style.opacity):0,filter:style&&style.filter?style.filter:"none"};
   })()
  };
 }

 function clearSceneAnimations(){
  sceneAnimations.forEach(function(animation){animation.cancel();});
  sceneAnimations=[];
 }

 function clearSettledSceneStyles(){
  gradients.forEach(function(layer){layer.style.removeProperty("opacity");});
  spill.style.removeProperty("opacity");
  portrait.style.removeProperty("opacity");
  portrait.style.removeProperty("filter");
 }

 function targetScene(state){
  var portraitStyle=computed(portrait);
  return {
   gradients:gradients.map(function(layer){return layer.getAttribute("data-time-gradient")===state?1:0;}),
   spill:state==="night"?1:0,
   portrait:{
    opacity:state==="off"?0:(portraitStyle?number(portraitStyle.opacity):0),
    filter:portraitStyle&&portraitStyle.filter?portraitStyle.filter:"none"
   }
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

 function writeFinalScene(target){
  gradients.forEach(function(layer,index){layer.style.setProperty("opacity",target.gradients[index]);});
  spill.style.setProperty("opacity",target.spill);
  portrait.style.setProperty("opacity",target.portrait.opacity);
  portrait.style.setProperty("filter",target.portrait.filter);
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
  gradients.forEach(function(layer,index){
   runSceneAnimation(layer,[{opacity:from.gradients[index]},{opacity:target.gradients[index]}],options);
  });
  runSceneAnimation(spill,[{opacity:from.spill},{opacity:target.spill}],options);
  runSceneAnimation(portrait,[
   {opacity:from.portrait.opacity,filter:from.portrait.filter},
   {opacity:target.portrait.opacity,filter:target.portrait.filter}
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
 }

 function onFaceLoad(){syncPortraitSource(true);}

 function closeMenu(returnFocus){
  control.classList.remove("open","opensAbove");
  menu.style.removeProperty("transform");
  button.setAttribute("aria-expanded","false");
  if(returnFocus)button.focus();
 }

 function positionMenu(){
  var viewportGutter=16;
  control.classList.remove("opensAbove");
  menu.style.removeProperty("transform");
  var rect=menu.getBoundingClientRect();
  var buttonRect=button.getBoundingClientRect();
  var spaceAbove=buttonRect.top-viewportGutter;
  var spaceBelow=window.innerHeight-buttonRect.bottom-viewportGutter;
  if(rect.bottom>window.innerHeight-viewportGutter&&spaceAbove>spaceBelow){
   control.classList.add("opensAbove");
   rect=menu.getBoundingClientRect();
  }
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
