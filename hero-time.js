(function(){
 "use strict";

 var M=window.HeroTimeModel;
 var hero=document.querySelector(".hero");
 var control=document.getElementById("heroTime");
 var button=document.getElementById("heroTimeBtn");
 var menu=document.getElementById("heroTimeMenu");
 var icon=document.getElementById("heroTimeIcon");
 var autoState=document.getElementById("heroTimeAutoState");
 if(!M||!hero||!control||!button||!menu||!icon||!autoState)return;

 var KEY="jbHeroTimeMode";
 var items=[].slice.call(menu.querySelectorAll('[role="menuitemradio"]'));
 var mode="auto",state=M.resolveState(mode,new Date()),boundaryTimer=0,destroyed=false;

 function stateLabel(value){
  return value.charAt(0).toUpperCase()+value.slice(1);
 }

 function clearBoundaryTimer(){
  if(boundaryTimer){clearTimeout(boundaryTimer);boundaryTimer=0;}
 }

 function scheduleBoundary(){
  clearBoundaryTimer();
  if(mode!=="auto"||destroyed)return;
  boundaryTimer=setTimeout(function(){refreshAutomatic();},M.msUntilNextBoundary(new Date())+50);
 }

 function apply(nextMode,nextState){
  mode=nextMode;
  state=nextState;
  hero.setAttribute("data-time-mode",mode);
  hero.setAttribute("data-time-state",state);
  items.forEach(function(item){
   item.setAttribute("aria-checked",item.getAttribute("data-time-mode")===mode?"true":"false");
  });
  icon.setAttribute("data-icon",state);
  autoState.textContent="\u00b7 "+stateLabel(M.resolveAutomatic(new Date()));
  scheduleBoundary();
 }

 function setMode(nextMode){
  nextMode=M.normalizeMode(nextMode);
  try{
   if(nextMode==="auto")sessionStorage.removeItem(KEY);
   else sessionStorage.setItem(KEY,nextMode);
  }catch(error){nextMode="auto";}
  apply(nextMode,M.resolveState(nextMode,new Date()));
 }

 function refreshAutomatic(){
  if(mode!=="auto"||destroyed)return;
  apply("auto",M.resolveState("auto",new Date()));
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
  if(document.visibilityState==="visible"&&mode==="auto")refreshAutomatic();
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
  closeMenu(false);
 }

 button.addEventListener("click",toggleMenu);
 button.addEventListener("keydown",onButtonKeydown);
 menu.addEventListener("click",onMenuClick);
 menu.addEventListener("keydown",onMenuKeydown);
 document.addEventListener("pointerdown",onOutsidePointerdown);
 document.addEventListener("visibilitychange",onVisibilityChange);

 var initialMode="auto";
 try{initialMode=M.normalizeMode(sessionStorage.getItem(KEY));}catch(error){initialMode="auto";}
 apply(initialMode,M.resolveState(initialMode,new Date()));

 window.HeroTimeController={
  getMode:function(){return mode;},
  getState:function(){return state;},
  setMode:setMode,
  refreshAutomatic:refreshAutomatic,
  destroy:destroy
 };
})();
