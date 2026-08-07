(function(){
 "use strict";
 function init(root){
  root=root||document;
  var hero=root.querySelector("#main"),wrap=root.querySelector("#heroHeadTransform");
  var face=root.querySelector("#face"),selection=root.querySelector("#heroHeadSelection");
  if(!hero||!wrap||!face||!selection)return null;
  var handles=[].slice.call(selection.querySelectorAll(".heroHeadHandle"));
  var state={selected:false,x:0,y:0,scale:1,pointerId:null,operation:null,start:null,
   capture:null,frame:0,peekFrame:0,peekAnimating:false,pendingAnchor:null,
   rendered:{x:0,y:0,scale:1}};
  var content=hero.querySelector(".heroCopy");
  var peek=hero.querySelector(".heroCharacterPeek");
  var bounds=(face.getAttribute("data-head-bounds")||"0.22 0.12 0.80 0.91").split(/\s+/).map(Number);

  function logicalRect(){
   var f=face.getBoundingClientRect();
   return {left:f.left+f.width*bounds[0],top:f.top+f.height*bounds[1],
    right:f.left+f.width*bounds[2],bottom:f.top+f.height*bounds[3],
    width:f.width*(bounds[2]-bounds[0]),height:f.height*(bounds[3]-bounds[1])};
  }
  function objectRect(){
   var h=hero.getBoundingClientRect(),r=logicalRect();
   return {left:Math.max(r.left,h.left),top:Math.max(r.top,h.top),
    right:Math.min(r.right,h.right),bottom:Math.min(r.bottom,h.bottom)};
  }
  function safeRect(){
   var h=hero.getBoundingClientRect(),c=content.getBoundingClientRect();
   var gap=parseFloat(getComputedStyle(hero).getPropertyValue("--hero-head-safe-gap"))||0;
   return {left:h.left,right:h.right,top:Math.min(h.bottom,c.bottom+gap),bottom:h.bottom};
  }
  function writeTransform(){
   wrap.style.setProperty("--hero-head-x",state.x+"px");
   wrap.style.setProperty("--hero-head-y",state.y+"px");
   wrap.style.setProperty("--hero-head-scale",String(state.scale));
   state.rendered={x:state.x,y:state.y,scale:state.scale};
  }
  function syncSelection(){
   if(!state.selected)return;
   var h=hero.getBoundingClientRect(),r=objectRect();
   selection.style.setProperty("--selection-x",(r.left-h.left)+"px");
   selection.style.setProperty("--selection-y",(r.top-h.top)+"px");
   selection.style.setProperty("--selection-w",Math.max(1,r.right-r.left)+"px");
   selection.style.setProperty("--selection-h",Math.max(1,r.bottom-r.top)+"px");
  }
  function flushRender(){
   state.frame=0;writeTransform();
   if(state.pendingAnchor){
    var pending=state.pendingAnchor;state.pendingAnchor=null;
    var actual=oppositePoint(logicalRect(),pending.corner);
    state.x+=pending.anchor.x-actual.x;state.y+=pending.anchor.y-actual.y;writeTransform();
    var anchored=clampMove(state.x,state.y);
    state.x=anchored.x;state.y=anchored.y;writeTransform();
   }
   dispatchEvent(new CustomEvent("heroheadtransform",{detail:getState()}));
   syncSelection();
  }
  function render(){
   if(!state.frame)state.frame=requestAnimationFrame(flushRender);
  }
  function followPeekTransition(){
   if(!state.peekAnimating){state.peekFrame=0;return;}
   dispatchEvent(new CustomEvent("heroheadtransform",{detail:getState()}));
   syncSelection();
   state.peekFrame=requestAnimationFrame(followPeekTransition);
  }
  function isOwnPeekTransform(event){
   return event&&event.target===peek&&event.propertyName==="transform";
  }
  function beginPeekTransition(event){
   if(!isOwnPeekTransform(event))return;
   state.peekAnimating=true;
   if(!state.peekFrame)state.peekFrame=requestAnimationFrame(followPeekTransition);
  }
  function endPeekTransition(event){
   if(!isOwnPeekTransform(event))return;
   state.peekAnimating=false;
   if(state.peekFrame)cancelAnimationFrame(state.peekFrame);
   state.peekFrame=0;render();
  }
  function clampMove(x,y){
   var current=objectRect(),safe=safeRect();
   var dx=x-state.rendered.x,dy=y-state.rendered.y;
   var proposed={left:current.left+dx,right:current.right+dx,
                 top:current.top+dy,bottom:current.bottom+dy};
   var cx=proposed.left<safe.left?safe.left-proposed.left:
          proposed.right>safe.right?safe.right-proposed.right:0;
   var cy=proposed.top<safe.top?safe.top-proposed.top:
          proposed.bottom>safe.bottom?safe.bottom-proposed.bottom:0;
   return {x:x+cx,y:y+cy};
  }
  function select(){
   var opening=!state.selected;
   state.selected=true;face.setAttribute("aria-pressed","true");selection.hidden=false;
   handles.forEach(function(handle){handle.tabIndex=0;});syncSelection();
   if(opening&&document.activeElement!==face)face.focus({preventScroll:true});
  }
  function deselect(options){
   end();state.selected=false;face.setAttribute("aria-pressed","false");selection.hidden=true;
   handles.forEach(function(handle){handle.tabIndex=-1;});
   if(options&&options.restoreFocus)face.focus({preventScroll:true});
  }
  function beginMove(event){
   if(state.pointerId!==null)return;
   if(event.button!==undefined&&event.button!==0)return;
   face.setAttribute("data-pointer-focus","");
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
  function beginResize(event,corner){
   if(state.pointerId!==null)return;
   if(event.button!==undefined&&event.button!==0)return;
   event.preventDefault();event.stopPropagation();select();
   var r=logicalRect(),opposite={
    nw:{x:r.right,y:r.bottom},ne:{x:r.left,y:r.bottom},
    sw:{x:r.right,y:r.top},se:{x:r.left,y:r.top}
   }[corner];
   var drag=cornerPoint(r,corner);
   state.pointerId=event.pointerId;state.operation="resize";
   state.start={corner:corner,anchor:opposite,rect:r,x:state.x,y:state.y,scale:state.scale,
    pointerOffset:{x:drag.x-event.clientX,y:drag.y-event.clientY}};
   state.capture=event.currentTarget;state.capture.setPointerCapture(event.pointerId);
  }
  function cornerPoint(rect,corner){
   return {
    nw:{x:rect.left,y:rect.top},ne:{x:rect.right,y:rect.top},
    sw:{x:rect.left,y:rect.bottom},se:{x:rect.right,y:rect.bottom}
   }[corner];
  }
  function oppositePoint(rect,corner){
   return {
    nw:{x:rect.right,y:rect.bottom},ne:{x:rect.left,y:rect.bottom},
    sw:{x:rect.right,y:rect.top},se:{x:rect.left,y:rect.top}
   }[corner];
  }
  function applyScaleFromAnchor(next,anchor,corner){
   state.scale=next;state.pendingAnchor={anchor:anchor,corner:corner};render();
  }
  function resize(event){
   if(state.operation!=="resize"||event.pointerId!==state.pointerId)return;
   var dragX=event.clientX+state.start.pointerOffset.x;
   var dragY=event.clientY+state.start.pointerOffset.y;
   var rx=Math.abs(dragX-state.start.anchor.x)/state.start.rect.width;
   var ry=Math.abs(dragY-state.start.anchor.y)/state.start.rect.height;
   var ratio=Math.abs(rx-1)>=Math.abs(ry-1)?rx:ry;
   var min=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hero-head-min-scale"))||.78;
   var max=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hero-head-max-scale"))||1.35;
   var next=Math.max(min,Math.min(max,state.start.scale*ratio));
   applyScaleFromAnchor(next,state.start.anchor,state.start.corner);
  }
  function end(event){
   if(state.pointerId!==null&&event&&event.pointerId!==undefined&&event.pointerId!==state.pointerId)return;
   var capture=state.capture,pointerId=state.pointerId;
   state.pointerId=null;state.operation=null;state.start=null;state.capture=null;
   if(capture&&pointerId!==null&&capture.hasPointerCapture(pointerId))capture.releasePointerCapture(pointerId);
  }
  function reset(){
   state.x=0;state.y=0;state.scale=1;state.pendingAnchor=null;render();
  }
  function reclamp(){
   var next=clampMove(state.x,state.y);state.x=next.x;state.y=next.y;render();
  }
  function getState(){return {selected:state.selected,x:state.x,y:state.y,scale:state.scale};}
  function onKeydown(event){
   face.removeAttribute("data-pointer-focus");
   if(event.key==="Escape"&&state.selected){event.preventDefault();deselect({restoreFocus:true});return;}
   if(!state.selected||!/^Arrow/.test(event.key))return;
   var corner=event.target.closest&&event.target.closest(".heroHeadHandle");
   if(!corner&&event.target!==face)return;
   var step=event.shiftKey?16:4;
   var dx=event.key==="ArrowLeft"?-step:event.key==="ArrowRight"?step:0;
   var dy=event.key==="ArrowUp"?-step:event.key==="ArrowDown"?step:0;
   event.preventDefault();
   if(corner){
    var name=corner.getAttribute("data-corner"),rect=logicalRect();
    var direction=(event.key==="ArrowLeft"||event.key==="ArrowUp")?-1:1;
    var style=getComputedStyle(document.documentElement);
    var min=parseFloat(style.getPropertyValue("--hero-head-min-scale"))||.78;
    var max=parseFloat(style.getPropertyValue("--hero-head-max-scale"))||1.35;
    var next=Math.max(min,Math.min(max,state.scale+direction*(event.shiftKey?.08:.02)));
    applyScaleFromAnchor(next,oppositePoint(rect,name),name);
   }else{
    var nextMove=clampMove(state.x+dx,state.y+dy);
    state.x=nextMove.x;state.y=nextMove.y;render();
   }
  }

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
  handles.forEach(function(handle){
   handle.addEventListener("pointerdown",function(event){
    beginResize(event,handle.getAttribute("data-corner"));
   });
   handle.addEventListener("pointermove",resize);
   handle.addEventListener("pointerup",end);
   handle.addEventListener("pointercancel",end);
   handle.addEventListener("lostpointercapture",end);
  });
  document.addEventListener("pointerdown",function(e){
   if(state.pointerId!==null)return;
   if(state.selected&&!selection.contains(e.target)&&e.target!==face)deselect();
  },true);
  document.addEventListener("keydown",onKeydown);
  addEventListener("heroheadstagechange",syncSelection);
  document.addEventListener("visibilitychange",function(){if(document.hidden)end();});
  addEventListener("blur",end);
  addEventListener("resize",reclamp);
  new ResizeObserver(reclamp).observe(hero);
  new ResizeObserver(reclamp).observe(content);
  peek.addEventListener("transitionrun",beginPeekTransition);
  peek.addEventListener("transitioncancel",endPeekTransition);
  peek.addEventListener("transitionend",endPeekTransition);
  return {select:select,deselect:deselect,reset:reset,reclamp:reclamp,getState:getState};
 }
 window.HeroHeadTransform={init:init};
 addEventListener("DOMContentLoaded",function(){window.__heroHeadTransform=init(document);});
})();
