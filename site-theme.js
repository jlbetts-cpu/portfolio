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

 /* ── ABSENT MEANS "HAS NOT CHOSEN", NOT "AUTO" ──────────────────────────────
    "auto" used to be stored by REMOVING the key, so a visitor who deliberately
    picked Automatic and a visitor who had never touched the control were the
    same row in storage. That was harmless while auto was also the default and
    is not survivable now that it is not: the default has to apply where there
    is no preference and lose to one where there is, including to an explicit
    "auto". So every mode is written out, and only a genuinely missing key falls
    through to S.DEFAULT_MODE. */
 function readMode(){
  if(!storage)return S.DEFAULT_MODE;
  try{
   var stored=storage.getItem(KEY);
   return stored===null?S.DEFAULT_MODE:S.normalizeMode(stored);
  }catch(error){return S.DEFAULT_MODE;}
 }

 /* A choice that cannot be remembered is not honoured -- the visitor would get
    it once and lose it on the next page, which reads as a bug. Unchanged
    behaviour; what it falls back TO is the default rather than auto. */
 function persistMode(mode){
  if(!storage)return mode===S.DEFAULT_MODE?mode:null;
  try{storage.setItem(KEY,mode);return mode;}
  catch(error){return null;}
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
   if(persistMode(next)===null)next=S.DEFAULT_MODE;
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
