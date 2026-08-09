(function(){
 "use strict";

 var S=window.SiteThemeState;
 var root=document.documentElement;
 if(!S||!root)return;

 var KEY="jbHeroTimeMode";
 var storage=null;
 try{storage=window.sessionStorage;}
 catch(error){}
 var current=null;
 var boundaryTimer=0;
 var listeners=new Set();
 var destroyed=false;
 var motion=typeof window.matchMedia==="function"?window.matchMedia("(prefers-reduced-motion: reduce)"):null;

 function readMode(){
  if(!storage)return "auto";
  try{return S.normalizeMode(storage.getItem(KEY));}
  catch(error){return "auto";}
 }

 function persistMode(mode){
  if(!storage)return mode==="auto"?"auto":null;
  try{
   if(mode==="auto")storage.removeItem(KEY);
   else storage.setItem(KEY,mode);
   return mode;
  }catch(error){return "auto";}
 }

 function setRootAttribute(name,value){root.setAttribute(name,value);}

 function apply(snapshot){
  setRootAttribute("data-theme",snapshot.theme);
  setRootAttribute("data-theme-mode",snapshot.mode);
  setRootAttribute("data-theme-state",snapshot.state);
  var body=document.body;
  if(body){
   body.setAttribute("data-theme",snapshot.theme);
   body.setAttribute("data-theme-mode",snapshot.mode);
   body.setAttribute("data-theme-state",snapshot.state);
  }
 }

 function clearBoundary(){
  if(boundaryTimer){clearTimeout(boundaryTimer);boundaryTimer=0;}
 }

 function scheduleBoundary(now){
  clearBoundary();
  if(destroyed||!current||current.mode!=="auto")return;
  boundaryTimer=setTimeout(function(){refresh();},S.msUntilNextBoundary(now));
 }

 function publish(snapshot){
  listeners.forEach(function(listener){listener(snapshot);});
  if(typeof window.dispatchEvent==="function"&&typeof CustomEvent==="function"){
   window.dispatchEvent(new CustomEvent("jbthemechange",{detail:snapshot}));
  }
 }

 function commit(mode,now,publishChange){
  var snapshot=S.resolveSnapshot(mode,now);
  var changed=!current||current.mode!==snapshot.mode||current.state!==snapshot.state||current.theme!==snapshot.theme;
  if(changed){
   current=snapshot;
   apply(snapshot);
   if(publishChange)publish(snapshot);
  }
  scheduleBoundary(now);
  return current;
 }

 function refresh(now){
  if(destroyed||!current||current.mode!=="auto")return current;
  return commit("auto",now||new Date(),true);
 }

 function setMode(mode,options){
  if(destroyed)return current;
  var next=S.normalizeMode(mode);
  var opts=options||{};
  if(opts.persist!==false){
   var persisted=persistMode(next);
   if(persisted===null||persisted==="auto"&&next!=="auto")next="auto";
  }
  return commit(next,new Date(),true);
 }

 function subscribe(listener){
  if(typeof listener!=="function")return function(){};
  listeners.add(listener);
  return function(){listeners.delete(listener);};
 }

 function setReducedMotion(){
  root.setAttribute("data-reduced-motion",motion&&motion.matches?"reduce":"no-preference");
 }

 function settle(){
  setReducedMotion();
  if(typeof window.dispatchEvent==="function"&&typeof CustomEvent==="function"){
   window.dispatchEvent(new CustomEvent("jbthemesettle",{detail:current}));
  }
 }

 function onVisibilityChange(){
  if(!document.hidden)refresh();
 }

 function onPageShow(){refresh();}

 function removeMotionListener(){
  if(!motion)return;
  if(typeof motion.removeEventListener==="function")motion.removeEventListener("change",settle);
  else if(typeof motion.removeListener==="function")motion.removeListener(settle);
 }

 function addMotionListener(){
  if(!motion)return;
  if(typeof motion.addEventListener==="function")motion.addEventListener("change",settle);
  else if(typeof motion.addListener==="function")motion.addListener(settle);
 }

 function destroy(){
  if(destroyed)return;
  destroyed=true;
  clearBoundary();
  document.removeEventListener("visibilitychange",onVisibilityChange);
  window.removeEventListener("pageshow",onPageShow);
  removeMotionListener();
  listeners.clear();
 }

 var initialNow=new Date();
 commit(readMode(),initialNow,false);
 setReducedMotion();
 root.classList.add("theme-ready");
 addMotionListener();
 document.addEventListener("visibilitychange",onVisibilityChange);
 window.addEventListener("pageshow",onPageShow);

 window.SiteTheme={getSnapshot:function(){return current;},setMode:setMode,refresh:refresh,subscribe:subscribe,destroy:destroy};
})();
