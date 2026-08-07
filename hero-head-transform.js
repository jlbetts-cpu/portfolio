(function(){
 "use strict";
 function init(root){
  root=root||document;
  var hero=root.querySelector("#main"),wrap=root.querySelector("#heroHeadTransform");
  var face=root.querySelector("#face"),selection=root.querySelector("#heroHeadSelection");
  if(!hero||!wrap||!face||!selection)return null;
  var handles=[].slice.call(selection.querySelectorAll(".heroHeadHandle"));
  var state={selected:false,x:0,y:0,scale:1,pointerId:null,operation:null,start:null,capture:null,frame:0};
  var content=hero.querySelector(".heroCopy");
  var bounds=(face.getAttribute("data-head-bounds")||"0.22 0.12 0.80 0.91").split(/\s+/).map(Number);

  function objectRect(){
   var h=hero.getBoundingClientRect(),f=face.getBoundingClientRect();
   return {left:f.left+f.width*bounds[0],top:Math.max(f.top+f.height*bounds[1],h.top),
    right:f.left+f.width*bounds[2],bottom:Math.min(f.top+f.height*bounds[3],h.bottom)};
  }
  function safeRect(){
   var h=hero.getBoundingClientRect(),c=content.getBoundingClientRect();
   var gap=parseFloat(getComputedStyle(hero).getPropertyValue("--hero-head-safe-gap"))||0;
   return {left:h.left,right:h.right,top:Math.min(h.bottom,c.bottom+gap),bottom:h.bottom};
  }
  function syncSelection(){
   state.frame=0;
   if(!state.selected)return;
   var h=hero.getBoundingClientRect(),r=objectRect();
   selection.style.setProperty("--selection-x",(r.left-h.left)+"px");
   selection.style.setProperty("--selection-y",(r.top-h.top)+"px");
   selection.style.setProperty("--selection-w",Math.max(1,r.right-r.left)+"px");
   selection.style.setProperty("--selection-h",Math.max(1,r.bottom-r.top)+"px");
  }
  function render(){
   wrap.style.setProperty("--hero-head-x",state.x+"px");
   wrap.style.setProperty("--hero-head-y",state.y+"px");
   wrap.style.setProperty("--hero-head-scale",String(state.scale));
   if(!state.frame)state.frame=requestAnimationFrame(syncSelection);
   dispatchEvent(new CustomEvent("heroheadtransform",{detail:getState()}));
  }
  function clampMove(x,y){
   var current=objectRect(),safe=safeRect(),dx=x-state.x,dy=y-state.y;
   var proposed={left:current.left+dx,right:current.right+dx,
                 top:current.top+dy,bottom:current.bottom+dy};
   var cx=proposed.left<safe.left?safe.left-proposed.left:
          proposed.right>safe.right?safe.right-proposed.right:0;
   var cy=proposed.top<safe.top?safe.top-proposed.top:
          proposed.bottom>safe.bottom?safe.bottom-proposed.bottom:0;
   return {x:x+cx,y:y+cy};
  }
  function select(){
   state.selected=true;face.setAttribute("aria-pressed","true");selection.hidden=false;
   handles.forEach(function(handle){handle.tabIndex=0;});syncSelection();
  }
  function deselect(options){
   end();state.selected=false;face.setAttribute("aria-pressed","false");selection.hidden=true;
   handles.forEach(function(handle){handle.tabIndex=-1;});
   if(options&&options.restoreFocus)face.focus();
  }
  function beginMove(event){
   if(state.pointerId!==null)return;
   if(event.button!==undefined&&event.button!==0)return;
   select();event.preventDefault();state.pointerId=event.pointerId;state.operation="move";
   state.start={clientX:event.clientX,clientY:event.clientY,x:state.x,y:state.y};
   state.capture=event.currentTarget;state.capture.setPointerCapture(event.pointerId);
  }
  function move(event){
   if(state.operation!=="move"||event.pointerId!==state.pointerId)return;
   var next=clampMove(state.start.x+event.clientX-state.start.clientX,
                      state.start.y+event.clientY-state.start.clientY);
   state.x=next.x;state.y=next.y;render();
  }
  function end(event){
   if(state.pointerId!==null&&event&&event.pointerId!==undefined&&event.pointerId!==state.pointerId)return;
   var capture=state.capture,pointerId=state.pointerId;
   state.pointerId=null;state.operation=null;state.start=null;state.capture=null;
   if(capture&&pointerId!==null&&capture.hasPointerCapture(pointerId))capture.releasePointerCapture(pointerId);
  }
  function reset(){state.x=0;state.y=0;state.scale=1;render();}
  function reclamp(){var next=clampMove(state.x,state.y);state.x=next.x;state.y=next.y;render();}
  function getState(){return {selected:state.selected,x:state.x,y:state.y,scale:state.scale};}

  face.addEventListener("pointerdown",beginMove);
  face.addEventListener("keydown",function(event){
   if(event.key==="Enter"||event.key===" "){
    event.preventDefault();
    if(state.selected)deselect({restoreFocus:true});else select();
   }
  });
  selection.addEventListener("pointerdown",function(e){if(!e.target.closest(".heroHeadHandle"))beginMove(e);});
  [face,selection].forEach(function(node){
   node.addEventListener("pointermove",move);node.addEventListener("pointerup",end);
   node.addEventListener("pointercancel",end);node.addEventListener("lostpointercapture",end);
  });
  document.addEventListener("pointerdown",function(e){
   if(state.pointerId!==null)return;
   if(state.selected&&!selection.contains(e.target)&&e.target!==face)deselect();
  },true);
  document.addEventListener("keydown",function(e){
   if(e.key==="Escape"&&state.selected){e.preventDefault();deselect({restoreFocus:true});}
  });
  document.addEventListener("visibilitychange",function(){if(document.hidden)end();});
  addEventListener("blur",end);
  addEventListener("resize",function(){requestAnimationFrame(reclamp);});
  new ResizeObserver(function(){requestAnimationFrame(reclamp);}).observe(hero);
  new ResizeObserver(function(){requestAnimationFrame(reclamp);}).observe(content);
  new MutationObserver(function(){requestAnimationFrame(reclamp);}).observe(
   hero.querySelector(".heroCharacterPeek"),{attributes:true,attributeFilter:["class"]}
  );
  return {select:select,deselect:deselect,reset:reset,reclamp:reclamp,getState:getState};
 }
 window.HeroHeadTransform={init:init};
 addEventListener("DOMContentLoaded",function(){window.__heroHeadTransform=init(document);});
})();
