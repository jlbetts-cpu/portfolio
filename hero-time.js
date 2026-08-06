(function(){
 "use strict";

 var M=window.HeroTimeModel;
 var hero=document.querySelector(".hero");
 var cases=document.getElementById("cases");
 var header=document.querySelector(".jbStick");
 var body=document.body;
 var control=document.getElementById("heroTime");
 var button=document.getElementById("heroTimeBtn");
 var menu=document.getElementById("heroTimeMenu");
 var icon=document.getElementById("heroTimeIcon");
 var autoState=document.getElementById("heroTimeAutoState");
 if(!M||!hero||!body||!control||!button||!menu||!icon||!autoState)return;

 var KEY="jbHeroTimeMode";
 var items=[].slice.call(menu.querySelectorAll('[role="menuitemradio"]'));
 var sceneLayers=[].slice.call(hero.querySelectorAll(".heroTimeGradient"));
 var sceneSpill=document.getElementById("heroTimeSpill");
 var sceneAnimations=[];
 var mode="auto",state="off",boundaryTimer=0,headerTimeRaf=0,destroyed=false;
 var originalAttributes={
  heroMode:rememberAttribute(hero,"data-time-mode"),
  heroState:rememberAttribute(hero,"data-time-state"),
  bodyMode:rememberAttribute(body,"data-time-mode"),
  bodyState:rememberAttribute(body,"data-time-state"),
  headerSceneClass:body.classList.contains("heroTimeHeaderScene")
 };

 function rememberAttribute(element,name){
  return {present:element.hasAttribute(name),value:element.getAttribute(name)};
 }

 function restoreAttribute(element,name,original){
  if(original.present)element.setAttribute(name,original.value);
  else element.removeAttribute(name);
 }

 function stateLabel(value){
  return value.charAt(0).toUpperCase()+value.slice(1);
 }

 function clearBoundaryTimer(){
  if(boundaryTimer){clearTimeout(boundaryTimer);boundaryTimer=0;}
 }

 function scheduleBoundary(now){
  clearBoundaryTimer();
  if(mode!=="auto"||destroyed)return;
  boundaryTimer=setTimeout(function(){refreshAutomatic();},M.msUntilNextBoundary(now)+50);
 }

 function syncHeaderScene(){
  headerTimeRaf=0;
  if(destroyed)return;
  var sceneVisible=true;
  if(cases&&header){
   sceneVisible=cases.getBoundingClientRect().top>header.getBoundingClientRect().bottom;
  }
  if(state==="night"&&sceneVisible)body.classList.add("heroTimeHeaderScene");
  else body.classList.remove("heroTimeHeaderScene");
 }

 function requestHeaderSceneSync(){
  if(headerTimeRaf||destroyed)return;
  if(typeof requestAnimationFrame!=="function"){syncHeaderScene();return;}
  headerTimeRaf=requestAnimationFrame(syncHeaderScene);
 }

 function canAnimateScene(){
  if(!sceneSpill||typeof window.getComputedStyle!=="function")return false;
  if(typeof window.matchMedia==="function"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return false;
  return sceneLayers.length===6&&sceneLayers.every(function(layer){return typeof layer.animate==="function";})&&
   typeof sceneSpill.animate==="function";
 }

 function captureSceneOpacities(){
  if(!canAnimateScene())return null;
  var opacities=sceneLayers.map(function(layer){return Number(window.getComputedStyle(layer).opacity)||0;});
  return {layers:opacities,spill:Number(window.getComputedStyle(sceneSpill).opacity)||0};
 }

 function clearSceneAnimations(){
  sceneAnimations.forEach(function(animation){animation.cancel();});
  sceneAnimations=[];
 }

 function sceneDuration(){
  var raw=window.getComputedStyle(document.documentElement).getPropertyValue("--hero-time-duration").trim();
  var duration=parseFloat(raw)||0;
  return /ms$/i.test(raw)?duration:duration*1000;
 }

 function animateSceneLayers(snapshot,nextState){
  if(!snapshot)return;
  clearSceneAnimations();
  var duration=sceneDuration();
  if(duration<=0)return;
  var targetIsActive=nextState!=="off";
  var total=snapshot.layers.reduce(function(sum,value){return sum+value;},0);
  if(targetIsActive&&total>0){
   snapshot.layers=snapshot.layers.map(function(value){return value/total;});
  }
  var options={duration:duration,easing:"cubic-bezier(.65,0,.35,1)",fill:"both"};
  function run(element,from,to){
   if(Math.abs(from-to)<0.0001)return;
   var animation=element.animate([{opacity:from},{opacity:to}],options);
   sceneAnimations.push(animation);
   animation.onfinish=function(){
    animation.cancel();
    sceneAnimations=sceneAnimations.filter(function(candidate){return candidate!==animation;});
   };
  }
  sceneLayers.forEach(function(layer,index){
   run(layer,snapshot.layers[index],layer.getAttribute("data-time-gradient")===nextState?1:0);
  });
  run(sceneSpill,snapshot.spill,nextState==="night"?1:0);
 }

 function apply(nextMode,now){
  var sceneSnapshot=captureSceneOpacities();
  mode=nextMode;
  state=M.resolveState(mode,now);
  hero.setAttribute("data-time-mode",mode);
  hero.setAttribute("data-time-state",state);
  body.setAttribute("data-time-mode",mode);
  body.setAttribute("data-time-state",state);
  items.forEach(function(item){
   item.setAttribute("aria-checked",item.getAttribute("data-time-mode")===mode?"true":"false");
  });
  icon.setAttribute("data-icon",state);
  autoState.textContent="\u00b7 "+stateLabel(M.resolveAutomatic(now));
  animateSceneLayers(sceneSnapshot,state);
  syncHeaderScene();
  scheduleBoundary(now);
 }

 function setMode(nextMode){
  nextMode=M.normalizeMode(nextMode);
  try{
   if(nextMode==="auto")sessionStorage.removeItem(KEY);
   else sessionStorage.setItem(KEY,nextMode);
  }catch(error){nextMode="auto";}
  apply(nextMode,new Date());
 }

 function refreshAutomatic(){
  if(mode!=="auto"||destroyed)return;
  apply("auto",new Date());
 }

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
  if(shift!==0)menu.style.transform="translateX("+shift+"px)";
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
  setMode(item.getAttribute("data-time-mode"));
  closeMenu(true);
 }

 function onButtonKeydown(event){
  if(event.key==="ArrowDown"||event.key==="ArrowUp"){
   event.preventDefault();
   if(!control.classList.contains("open"))openMenu(false);
   (event.key==="ArrowDown"?items[0]:items[items.length-1]).focus();
  }else if(event.key==="Escape"&&control.classList.contains("open")){
   event.preventDefault();
   closeMenu(true);
  }
 }

 function onMenuKeydown(event){
  if(event.key==="ArrowDown"||event.key==="ArrowUp"){
   event.preventDefault();
   moveFocus(event.key==="ArrowDown"?1:-1);
  }else if(event.key==="Home"||event.key==="End"){
   event.preventDefault();
   items[event.key==="Home"?0:items.length-1].focus();
  }else if(event.key==="Enter"||event.key===" "||event.key==="Spacebar"){
   var item=event.target.closest('[role="menuitemradio"]');
   if(item&&menu.contains(item)){event.preventDefault();choose(item);}
  }else if(event.key==="Escape"){
   event.preventDefault();
   closeMenu(true);
  }
 }

 function onMenuClick(event){
  var item=event.target.closest('[role="menuitemradio"]');
  if(item&&menu.contains(item))choose(item);
 }

 function onOutsidePointerdown(event){
  if(control.classList.contains("open")&&!control.contains(event.target))closeMenu(false);
 }

 function onVisibilityChange(){
  if(!document.hidden&&mode==="auto")refreshAutomatic();
 }

 function destroy(){
  if(destroyed)return;
  destroyed=true;
  clearBoundaryTimer();
  button.removeEventListener("click",toggleMenu);
  button.removeEventListener("keydown",onButtonKeydown);
  menu.removeEventListener("click",onMenuClick);
  menu.removeEventListener("keydown",onMenuKeydown);
  document.removeEventListener("pointerdown",onOutsidePointerdown);
  document.removeEventListener("visibilitychange",onVisibilityChange);
  if(typeof window.removeEventListener==="function"){
   window.removeEventListener("scroll",requestHeaderSceneSync);
   window.removeEventListener("resize",requestHeaderSceneSync);
  }
  if(headerTimeRaf){cancelAnimationFrame(headerTimeRaf);headerTimeRaf=0;}
  clearSceneAnimations();
  closeMenu(false);
  restoreAttribute(hero,"data-time-mode",originalAttributes.heroMode);
  restoreAttribute(hero,"data-time-state",originalAttributes.heroState);
  restoreAttribute(body,"data-time-mode",originalAttributes.bodyMode);
  restoreAttribute(body,"data-time-state",originalAttributes.bodyState);
  if(originalAttributes.headerSceneClass)body.classList.add("heroTimeHeaderScene");
  else body.classList.remove("heroTimeHeaderScene");
 }

 button.addEventListener("click",toggleMenu);
 button.addEventListener("keydown",onButtonKeydown);
 menu.addEventListener("click",onMenuClick);
 menu.addEventListener("keydown",onMenuKeydown);
 document.addEventListener("pointerdown",onOutsidePointerdown);
 document.addEventListener("visibilitychange",onVisibilityChange);
 if(typeof window.addEventListener==="function"){
  window.addEventListener("scroll",requestHeaderSceneSync,{passive:true});
  window.addEventListener("resize",requestHeaderSceneSync);
 }

 var initialMode="auto";
 try{initialMode=M.normalizeMode(sessionStorage.getItem(KEY));}catch(error){initialMode="auto";}
 apply(initialMode,new Date());

 window.HeroTimeController={
  getMode:function(){return mode;},
  getState:function(){return state;},
  setMode:setMode,
  refreshAutomatic:refreshAutomatic,
  destroy:destroy
 };
})();
