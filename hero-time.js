(function(){
 "use strict";

 var M=window.HeroTimeModel;
 var FluidMesh=window.FluidMesh;
 var hero=document.querySelector(".hero");
 var cases=document.getElementById("cases");
 var scene=document.getElementById("heroTimeScene");
 var canvas=document.getElementById("heroTimeCanvas");
 var body=document.body;
 var control=document.getElementById("heroTime");
 var button=document.getElementById("heroTimeBtn");
 var menu=document.getElementById("heroTimeMenu");
 var icon=document.getElementById("heroTimeIcon");
 var autoState=document.getElementById("heroTimeAutoState");
 if(!M||!hero||!body||!control||!button||!menu||!icon||!autoState)return;

 var KEY="jbHeroTimeMode";
 var TRANSITION_DURATION=800;
 var items=[].slice.call(menu.querySelectorAll('[role="menuitemradio"]'));
 var mode="auto",state="off",boundaryTimer=0,destroyed=false;
 var mesh=null,currentConfig=null,transitionFrom=null,transitionTo=null,transitionStart=0;
 var transitionRaf=0,sceneRaf=0,observer=null,rendering=false,intersecting=false;
 var fallbackActive=false;
 var reduceMedia=window.matchMedia?window.matchMedia("(prefers-reduced-motion: reduce)"):null;
 var reducedMotion=!!(reduceMedia&&reduceMedia.matches);
 var originalAttributes={
  heroMode:rememberAttribute(hero,"data-time-mode"),
  heroState:rememberAttribute(hero,"data-time-state"),
  bodyMode:rememberAttribute(body,"data-time-mode"),
  bodyState:rememberAttribute(body,"data-time-state"),
  sceneStyle:scene?rememberAttribute(scene,"style"):null,
  fallbackClass:body.classList.contains("timeFallback")
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

 function nowTime(){
  return window.performance&&typeof window.performance.now==="function"?window.performance.now():Date.now();
 }

 function dprCap(){
  return window.innerWidth<=760?1.5:2.25;
 }

 function clonePreset(name){
  var preset=M.PRESETS[name];
  if(!preset)return null;
  var clone=M.interpolatePreset(preset,preset,0);
  clone.dprCap=dprCap();
  clone.onError=activateFallback;
  return clone;
 }

 function cancelTransition(){
  if(transitionRaf){cancelAnimationFrame(transitionRaf);transitionRaf=0;}
  transitionFrom=null;
  transitionTo=null;
  transitionStart=0;
 }

 function transitionValue(now){
  if(!transitionFrom||!transitionTo)return currentConfig;
  var p=Math.min(1,Math.max(0,(now-transitionStart)/TRANSITION_DURATION));
  var eased=1-Math.pow(1-p,3);
  return M.interpolatePreset(transitionFrom,transitionTo,eased);
 }

 function transitionFrame(now){
  transitionRaf=0;
  if(destroyed||!mesh||!transitionFrom||!transitionTo)return;
  var p=Math.min(1,(now-transitionStart)/800);
  var eased=1-Math.pow(1-p,3);
  currentConfig=M.interpolatePreset(transitionFrom,transitionTo,eased);
  mesh.set(currentConfig);
  if(p<1)transitionRaf=requestAnimationFrame(transitionFrame);
  else{
   transitionFrom=null;
   transitionTo=null;
   transitionStart=0;
   syncRendering();
  }
 }

 function startTransition(target){
  var now=nowTime();
  if(transitionRaf){
   currentConfig=transitionValue(now);
   cancelAnimationFrame(transitionRaf);
   transitionRaf=0;
  }
  transitionFrom=M.interpolatePreset(currentConfig,currentConfig,0);
  transitionTo=target;
  transitionStart=now;
  transitionRaf=requestAnimationFrame(transitionFrame);
 }

 function shouldRender(){
  return !!mesh&&!fallbackActive&&state!=="off"&&!reducedMotion&&!document.hidden&&intersecting;
 }

 function syncRendering(){
  if(!mesh){rendering=false;return;}
  if(shouldRender()){
   if(!rendering){mesh.resume();rendering=true;}
  }else{
   if(rendering||state==="off"||reducedMotion||document.hidden||!intersecting)mesh.pause();
   rendering=false;
  }
 }

 function activateFallback(){
  if(destroyed)return;
  cancelTransition();
  rendering=false;
  fallbackActive=true;
  body.classList.add("timeFallback");
  if(mesh){mesh.pause();mesh.destroy();mesh=null;}
 }

 function measureScene(){
  sceneRaf=0;
  if(destroyed||!scene)return false;
  var heroRect=hero.getBoundingClientRect();
  if(heroRect.width<=0||heroRect.height<=0)return false;
  var pageY=window.pageYOffset||document.documentElement.scrollTop||0;
  var top=0;
  var bottom=heroRect.bottom+pageY;
  if(cases){
   var casesTop=cases.getBoundingClientRect().top+pageY;
   bottom=Math.min(bottom,casesTop);
  }
  scene.style.top=Math.max(0,top)+"px";
  scene.style.height=Math.max(0,bottom-Math.max(0,top))+"px";
  return true;
 }

 function requestSceneMeasure(){
  if(sceneRaf||destroyed||!scene||typeof requestAnimationFrame!=="function")return;
  sceneRaf=requestAnimationFrame(function(){
   if(measureScene()){
    if(mesh){
     mesh.set({dprCap:dprCap()});
     if(reducedMotion){mesh.renderOnce();mesh.pause();}
    }else ensureMesh();
   }
  });
 }

 function ensureMesh(){
  if(mesh||fallbackActive||destroyed||state==="off")return;
  if(!measureScene()){requestSceneMeasure();return;}
  var config=clonePreset(state);
  if(!config||typeof FluidMesh!=="function"){activateFallback();return;}
  var renderer=null;
  try{renderer=new FluidMesh(canvas,config);}catch(error){activateFallback();return;}
  if(!renderer){activateFallback();return;}
  if(fallbackActive){renderer.destroy();return;}
  mesh=renderer;
  currentConfig=config;
  body.classList.remove("timeFallback");
  if(reducedMotion){
   mesh.set(currentConfig);
   mesh.renderOnce();
   mesh.pause();
   rendering=false;
  }else syncRendering();
 }

 function updateRenderer(previousState){
  if(!scene||!canvas)return;
  if(state==="off"){
   cancelTransition();
   syncRendering();
   return;
  }
  ensureMesh();
  if(!mesh)return;
  var target=clonePreset(state);
  if(!target)return;
  if(reducedMotion){
   cancelTransition();
   currentConfig=target;
   mesh.set(currentConfig);
   mesh.renderOnce();
   mesh.pause();
   rendering=false;
  }else if(previousState!=="off"&&previousState!==state&&currentConfig){
   startTransition(target);
   syncRendering();
  }else{
   currentConfig=target;
   mesh.set(currentConfig);
   syncRendering();
  }
 }

 function apply(nextMode,now){
  var previousState=state;
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
  measureScene();
  updateRenderer(previousState);
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
  syncRendering();
 }

 function onIntersection(entries){
  intersecting=entries.some(function(entry){return entry.target===hero&&entry.isIntersecting;});
  syncRendering();
 }

 function onReducedMotionChange(event){
  reducedMotion=!!event.matches;
  if(state==="off"||!mesh){syncRendering();return;}
  if(reducedMotion){
   cancelTransition();
   currentConfig=clonePreset(state);
   mesh.set(currentConfig);
   mesh.renderOnce();
   mesh.pause();
   rendering=false;
  }else syncRendering();
 }

 function destroy(){
  if(destroyed)return;
  destroyed=true;
  clearBoundaryTimer();
  cancelTransition();
  if(sceneRaf){cancelAnimationFrame(sceneRaf);sceneRaf=0;}
  button.removeEventListener("click",toggleMenu);
  button.removeEventListener("keydown",onButtonKeydown);
  menu.removeEventListener("click",onMenuClick);
  menu.removeEventListener("keydown",onMenuKeydown);
  document.removeEventListener("pointerdown",onOutsidePointerdown);
  document.removeEventListener("visibilitychange",onVisibilityChange);
  if(typeof window.removeEventListener==="function")window.removeEventListener("resize",requestSceneMeasure);
  if(reduceMedia){
   if(typeof reduceMedia.removeEventListener==="function")reduceMedia.removeEventListener("change",onReducedMotionChange);
   else if(typeof reduceMedia.removeListener==="function")reduceMedia.removeListener(onReducedMotionChange);
  }
  if(observer){observer.disconnect();observer=null;}
  if(mesh){mesh.pause();mesh.destroy();mesh=null;}
  rendering=false;
  closeMenu(false);
  restoreAttribute(hero,"data-time-mode",originalAttributes.heroMode);
  restoreAttribute(hero,"data-time-state",originalAttributes.heroState);
  restoreAttribute(body,"data-time-mode",originalAttributes.bodyMode);
  restoreAttribute(body,"data-time-state",originalAttributes.bodyState);
  if(scene)restoreAttribute(scene,"style",originalAttributes.sceneStyle);
  if(originalAttributes.fallbackClass)body.classList.add("timeFallback");
  else body.classList.remove("timeFallback");
 }

 button.addEventListener("click",toggleMenu);
 button.addEventListener("keydown",onButtonKeydown);
 menu.addEventListener("click",onMenuClick);
 menu.addEventListener("keydown",onMenuKeydown);
 document.addEventListener("pointerdown",onOutsidePointerdown);
 document.addEventListener("visibilitychange",onVisibilityChange);
 if(typeof window.addEventListener==="function")window.addEventListener("resize",requestSceneMeasure);
 if(reduceMedia){
  if(typeof reduceMedia.addEventListener==="function")reduceMedia.addEventListener("change",onReducedMotionChange);
  else if(typeof reduceMedia.addListener==="function")reduceMedia.addListener(onReducedMotionChange);
 }
 if(typeof IntersectionObserver==="function"){
  observer=new IntersectionObserver(onIntersection,{threshold:0});
  observer.observe(hero);
 }else intersecting=true;

 var initialMode="auto";
 try{initialMode=M.normalizeMode(sessionStorage.getItem(KEY));}catch(error){initialMode="auto";}
 apply(initialMode,new Date());

 window.HeroTimeController={
  getMode:function(){return mode;},
  getState:function(){return state;},
  setMode:setMode,
  refreshAutomatic:refreshAutomatic,
  isRendering:function(){return rendering;},
  forceFallback:activateFallback,
  destroy:destroy
 };
})();
