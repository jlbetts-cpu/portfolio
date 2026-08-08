(function(){
 "use strict";
 function init(root){
  root=root||document;
  var hero=root.querySelector("#main"),wrap=root.querySelector("#heroHeadTransform");
  var face=root.querySelector("#face"),selection=root.querySelector("#heroHeadSelection");
  if(!hero||!wrap||!face||!selection)return null;
  var handles=[].slice.call(selection.querySelectorAll(".heroHeadHandle"));
  var rotator=selection.querySelector(".heroHeadRotate");
  var frame=selection.querySelector(".heroHeadFrame");
  var chrome=handles.concat(rotator?[rotator]:[]);
  var state={selected:false,x:0,y:0,scale:1,rotate:0,pointerId:null,operation:null,start:null,
   capture:null,frame:0,peekFrame:0,peekAnimating:false,pendingAnchor:null,pendingClamp:false,
   stamp:0,geomStamp:-1,geom:null,
   rendered:{x:0,y:0,scale:1,rotate:0}};
  var content=hero.querySelector(".heroCopy");
  var peek=hero.querySelector(".heroCharacterPeek");
  var bounds=(face.getAttribute("data-head-bounds")||"0.22 0.12 0.80 0.91").split(/\s+/).map(Number);

  function rootNumber(name,fallback){
   var value=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
   return isFinite(value)?value:fallback;
  }
  /* The logical head as laid out, with no rotation applied. Every clamp and
     every piece of chrome is derived from this one rectangle. */
  function logicalRaw(){
   var f=face.getBoundingClientRect();
   return {left:f.left+f.width*bounds[0],top:f.top+f.height*bounds[1],
    right:f.left+f.width*bounds[2],bottom:f.top+f.height*bounds[3],
    width:f.width*(bounds[2]-bounds[0]),height:f.height*(bounds[3]-bounds[1])};
  }
  /* Once the wrapper carries a rotation, getBoundingClientRect() returns the
     TURNED bounding box, and slicing head-bounds fractions out of that is not
     the head. Rather than invert the matrix, the rotation is lifted off for one
     read and put straight back: the measurement is exact at any angle, and the
     extra layout only happens while the head is actually turned. The result is
     cached per render pass so a drag frame pays for it once. */
  function geom(){
   if(state.geomStamp===state.stamp&&state.geom)return state.geom;
   var measured;
   if(!state.rotate){
    measured=logicalRaw();
   }else{
    var previous=wrap.style.getPropertyValue("--hero-head-rotate");
    wrap.style.setProperty("--hero-head-rotate","0deg");
    measured=logicalRaw();
    if(previous)wrap.style.setProperty("--hero-head-rotate",previous);
    else wrap.style.removeProperty("--hero-head-rotate");
   }
   state.geom=measured;state.geomStamp=state.stamp;
   return measured;
  }
  function radians(){return state.rotate*Math.PI/180;}
  /* Rotation happens about the head's own centre, so the turned bounding box
     stays centred on that same point and can be computed instead of measured.
     This is the box the clamp works against: at 45deg it is at its largest,
     which is exactly where a containment rule would start feeling tight. */
  function boundsBox(u){
   var cos=Math.abs(Math.cos(radians())),sin=Math.abs(Math.sin(radians()));
   var w=u.width*cos+u.height*sin,h=u.width*sin+u.height*cos;
   var cx=(u.left+u.right)/2,cy=(u.top+u.bottom)/2;
   return {left:cx-w/2,top:cy-h/2,right:cx+w/2,bottom:cy+h/2,width:w,height:h};
  }
  function objectRect(){
   var h=hero.getBoundingClientRect(),r=boundsBox(geom());
   return {left:Math.max(r.left,h.left),top:Math.max(r.top,h.top),
    right:Math.min(r.right,h.right),bottom:Math.min(r.bottom,h.bottom)};
  }
  /* HOW MUCH OF THE HEAD HAS TO STAY REACHABLE.
     The old rule was containment, and containment is the wrong rule for an
     object whose resting composition already hangs ~150px below the Hero's
     lower edge: the start state failed its own clamp, so once you dragged the
     head away you could never put it back. This states the requirement the way
     every direct-manipulation tool does -- a share of the object must remain
     inside -- which the resting position satisfies on every axis, and which is
     what "can still be grabbed" actually means. --hero-head-safe-gap survives
     as the pixel floor under that share, so a head at minimum scale cannot
     shrink its own handles out of reach. */
  function reachable(box){
   var h=hero.getBoundingClientRect();
   var gap=parseFloat(getComputedStyle(hero).getPropertyValue("--hero-head-safe-gap"))||0;
   var share=rootNumber("--hero-head-min-visible",.42);
   return {hero:h,
    x:Math.min(Math.max(box.width*share,gap),h.width),
    y:Math.min(Math.max(box.height*share,gap),h.height)};
  }
  function writeTransform(){
   wrap.style.setProperty("--hero-head-x",state.x+"px");
   wrap.style.setProperty("--hero-head-y",state.y+"px");
   wrap.style.setProperty("--hero-head-scale",String(state.scale));
   wrap.style.setProperty("--hero-head-rotate",state.rotate+"deg");
   state.rendered={x:state.x,y:state.y,scale:state.scale,rotate:state.rotate};
   state.stamp++;
  }
  /* The wrapper's transform-origin is the logical head's centre expressed as a
     percentage of the wrapper, so the head turns about itself rather than
     about the stage's corner. Percentages are scale-invariant, so this is a
     layout constant -- measured whenever the head is level, never while it is
     turned, because a turned bounding box would not give the same ratio. */
  function syncOrigin(){
   if(state.rotate)return;
   var u=logicalRaw(),w=wrap.getBoundingClientRect();
   if(!w.width||!w.height)return;
   wrap.style.setProperty("--hero-head-origin-x",
    (((u.left+u.right)/2-w.left)/w.width*100)+"%");
   wrap.style.setProperty("--hero-head-origin-y",
    (((u.top+u.bottom)/2-w.top)/w.height*100)+"%");
  }
  function place(node,point,box){
   var hit=node.getBoundingClientRect().width||44;
   var half=hit/2;
   var cx=box.width<hit?box.width/2:Math.max(half,Math.min(box.width-half,point.x));
   var cy=box.height<hit?box.height/2:Math.max(half,Math.min(box.height-half,point.y));
   node.style.setProperty("--h-x",cx+"px");
   node.style.setProperty("--h-y",cy+"px");
   node.style.setProperty("--h-dx",(point.x-cx)+"px");
   node.style.setProperty("--h-dy",(point.y-cy)+"px");
  }
  function syncSelection(){
   if(!state.selected)return;
   var h=hero.getBoundingClientRect(),u=geom(),r=objectRect();
   var w=Math.max(1,r.right-r.left),ht=Math.max(1,r.bottom-r.top);
   selection.style.setProperty("--selection-x",(r.left-h.left)+"px");
   selection.style.setProperty("--selection-y",(r.top-h.top)+"px");
   selection.style.setProperty("--selection-w",w+"px");
   selection.style.setProperty("--selection-h",ht+"px");
   /* The chrome is a Hero-relative sibling, not a child of the wrapper, so the
      angle has to be handed to it explicitly -- it cannot inherit it. */
   selection.style.setProperty("--hero-head-rotate",state.rotate+"deg");
   if(frame){
    frame.style.setProperty("--frame-x",(u.left-r.left)+"px");
    frame.style.setProperty("--frame-y",(u.top-r.top)+"px");
    frame.style.setProperty("--frame-w",u.width+"px");
    frame.style.setProperty("--frame-h",u.height+"px");
   }
   var cx=(u.left+u.right)/2,cy=(u.top+u.bottom)/2;
   var cos=Math.cos(radians()),sin=Math.sin(radians());
   var box={width:w,height:ht};
   var turn=function(x,y){
    var dx=x-cx,dy=y-cy;
    var px=cx+dx*cos-dy*sin,py=cy+dx*sin+dy*cos;
    return {x:Math.max(0,Math.min(w,px-r.left)),y:Math.max(0,Math.min(ht,py-r.top))};
   };
   handles.forEach(function(handle){
    var corner=handle.getAttribute("data-corner");
    place(handle,turn(corner.indexOf("w")>-1?u.left:u.right,
     corner.indexOf("n")>-1?u.top:u.bottom),box);
   });
   if(rotator)place(rotator,turn(cx,u.top),box);
  }
  function flushRender(){
   state.frame=0;writeTransform();
   if(state.pendingAnchor){
    var pending=state.pendingAnchor;state.pendingAnchor=null;
    var actual=oppositePoint(geom(),pending.corner);
    state.x+=pending.anchor.x-actual.x;state.y+=pending.anchor.y-actual.y;writeTransform();
    var anchored=clampMove(state.x,state.y);
    state.x=anchored.x;state.y=anchored.y;writeTransform();
   }
   /* A turn changes the head's real extents, so the position that was legal a
      moment ago may no longer be. Re-settle once, after the angle is written. */
   if(state.pendingClamp){
    state.pendingClamp=false;
    var settled=clampMove(state.x,state.y);
    if(settled.x!==state.x||settled.y!==state.y){
     state.x=settled.x;state.y=settled.y;writeTransform();
    }
   }
   dispatchEvent(new CustomEvent("heroheadtransform",{detail:getState()}));
   syncSelection();
  }
  function render(){
   if(!state.frame)state.frame=requestAnimationFrame(flushRender);
  }
  function followPeekTransition(){
   if(!state.peekAnimating){state.peekFrame=0;return;}
   state.stamp++;
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
   var current=boundsBox(geom()),need=reachable(current),h=need.hero;
   var dx=x-state.rendered.x,dy=y-state.rendered.y;
   var left=current.left+dx,top=current.top+dy;
   var minLeft=h.left+need.x-current.width,maxLeft=h.right-need.x;
   var minTop=h.top+need.y-current.height,maxTop=h.bottom-need.y;
   var cx=left<minLeft?minLeft-left:left>maxLeft?maxLeft-left:0;
   var cy=top<minTop?minTop-top:top>maxTop?maxTop-top:0;
   return {x:x+cx,y:y+cy};
  }
  function select(){
   var opening=!state.selected;
   state.selected=true;face.setAttribute("aria-pressed","true");selection.hidden=false;
   chrome.forEach(function(node){node.tabIndex=0;});syncSelection();
   if(opening&&document.activeElement!==face)face.focus({preventScroll:true});
  }
  function deselect(options){
   end();state.selected=false;face.setAttribute("aria-pressed","false");selection.hidden=true;
   chrome.forEach(function(node){node.tabIndex=-1;});
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
   var r=geom(),opposite={
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
  function scaleLimits(){
   return {min:rootNumber("--hero-head-min-scale",.24),max:rootNumber("--hero-head-max-scale",2.2)};
  }
  function resize(event){
   if(state.operation!=="resize"||event.pointerId!==state.pointerId)return;
   var dragX=event.clientX+state.start.pointerOffset.x;
   var dragY=event.clientY+state.start.pointerOffset.y;
   var rx=Math.abs(dragX-state.start.anchor.x)/state.start.rect.width;
   var ry=Math.abs(dragY-state.start.anchor.y)/state.start.rect.height;
   var ratio=Math.abs(rx-1)>=Math.abs(ry-1)?rx:ry;
   var limits=scaleLimits();
   var next=Math.max(limits.min,Math.min(limits.max,state.start.scale*ratio));
   applyScaleFromAnchor(next,state.start.anchor,state.start.corner);
  }
  /* Rotation is clamped to a half turn either way. That still reaches every
     orientation, so nothing is unreachable, but the angle cannot accumulate
     into a number that puts level a long way away. Snapping does the rest:
     inside --hero-head-rotate-snap of level it goes to exactly 0, and holding
     shift quantises to --hero-head-rotate-step-large. Touch has no modifier
     key, which is why the way home is the unmodified snap and not the shift
     one -- and reset() clears the angle outright. */
  function limitRotate(value,quantise){
   var increment=rootNumber("--hero-head-rotate-step-large",15);
   var snap=rootNumber("--hero-head-rotate-snap",6);
   if(quantise)value=Math.round(value/increment)*increment;
   else if(Math.abs(value)<=snap)value=0;
   return Math.max(rootNumber("--hero-head-min-rotate",-180),
    Math.min(rootNumber("--hero-head-max-rotate",180),value));
  }
  function pointerAngle(centre,x,y){
   return Math.atan2(y-centre.y,x-centre.x)*180/Math.PI;
  }
  function beginRotate(event){
   if(state.pointerId!==null)return;
   if(event.button!==undefined&&event.button!==0)return;
   event.preventDefault();event.stopPropagation();select();
   var u=geom(),centre={x:(u.left+u.right)/2,y:(u.top+u.bottom)/2};
   state.pointerId=event.pointerId;state.operation="rotate";
   state.start={centre:centre,angle:pointerAngle(centre,event.clientX,event.clientY),
    rotate:state.rotate};
   state.capture=event.currentTarget;state.capture.setPointerCapture(event.pointerId);
  }
  function turn(event){
   if(state.operation!=="rotate"||event.pointerId!==state.pointerId)return;
   var delta=pointerAngle(state.start.centre,event.clientX,event.clientY)-state.start.angle;
   while(delta>180)delta-=360;
   while(delta<-180)delta+=360;
   state.rotate=limitRotate(state.start.rotate+delta,event.shiftKey);
   state.pendingClamp=true;render();
  }
  function end(event){
   if(state.pointerId!==null&&event&&event.pointerId!==undefined&&event.pointerId!==state.pointerId)return;
   var capture=state.capture,pointerId=state.pointerId;
   state.pointerId=null;state.operation=null;state.start=null;state.capture=null;
   if(capture&&pointerId!==null&&capture.hasPointerCapture(pointerId))capture.releasePointerCapture(pointerId);
  }
  function reset(){
   state.x=0;state.y=0;state.scale=1;state.rotate=0;
   state.pendingAnchor=null;state.pendingClamp=false;render();
  }
  function reclamp(){
   state.stamp++;syncOrigin();
   var next=clampMove(state.x,state.y);state.x=next.x;state.y=next.y;render();
  }
  function getState(){
   return {selected:state.selected,x:state.x,y:state.y,scale:state.scale,rotate:state.rotate};
  }
  function onKeydown(event){
   face.removeAttribute("data-pointer-focus");
   if(event.key==="Escape"&&state.selected){event.preventDefault();deselect({restoreFocus:true});return;}
   if(!state.selected||!/^Arrow/.test(event.key))return;
   var spinner=rotator&&event.target.closest&&event.target.closest(".heroHeadRotate");
   var corner=event.target.closest&&event.target.closest(".heroHeadHandle");
   if(!spinner&&!corner&&event.target!==face)return;
   var step=event.shiftKey?16:4;
   var dx=event.key==="ArrowLeft"?-step:event.key==="ArrowRight"?step:0;
   var dy=event.key==="ArrowUp"?-step:event.key==="ArrowDown"?step:0;
   event.preventDefault();
   if(spinner){
    var direction=(event.key==="ArrowLeft"||event.key==="ArrowUp")?-1:1;
    var turnStep=event.shiftKey?rootNumber("--hero-head-rotate-step-large",15)
     :rootNumber("--hero-head-rotate-step",2);
    state.rotate=limitRotate(state.rotate+direction*turnStep,event.shiftKey);
    state.pendingClamp=true;render();
   }else if(corner){
    var name=corner.getAttribute("data-corner"),rect=geom();
    var way=(event.key==="ArrowLeft"||event.key==="ArrowUp")?-1:1;
    var limits=scaleLimits();
    var next=Math.max(limits.min,Math.min(limits.max,
     state.scale+way*(event.shiftKey?.08:.02)));
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
  selection.addEventListener("pointerdown",function(e){
   if(!e.target.closest(".heroHeadHandle")&&!e.target.closest(".heroHeadRotate"))beginMove(e);
  });
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
  if(rotator){
   rotator.addEventListener("pointerdown",beginRotate);
   rotator.addEventListener("pointermove",turn);
   rotator.addEventListener("pointerup",end);
   rotator.addEventListener("pointercancel",end);
   rotator.addEventListener("lostpointercapture",end);
  }
  document.addEventListener("pointerdown",function(e){
   if(state.pointerId!==null)return;
   if(state.selected&&!selection.contains(e.target)&&e.target!==face)deselect();
  },true);
  document.addEventListener("keydown",onKeydown);
  addEventListener("heroheadstagechange",function(){state.stamp++;syncSelection();});
  document.addEventListener("visibilitychange",function(){if(document.hidden)end();});
  addEventListener("blur",end);
  addEventListener("resize",reclamp);
  new ResizeObserver(reclamp).observe(hero);
  new ResizeObserver(reclamp).observe(content);
  peek.addEventListener("transitionrun",beginPeekTransition);
  peek.addEventListener("transitioncancel",endPeekTransition);
  peek.addEventListener("transitionend",endPeekTransition);
  syncOrigin();
  return {select:select,deselect:deselect,reset:reset,reclamp:reclamp,getState:getState};
 }
 window.HeroHeadTransform={init:init};
 addEventListener("DOMContentLoaded",function(){window.__heroHeadTransform=init(document);});
})();
