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
   stamp:0,geomStamp:-1,geom:null,floating:false,floatFrame:0,ambient:false,base:null,
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
  /* THE FLOATING HEADER IS NOT REACHABLE SPACE. The Hero runs up behind the
     bar now, and the bar is opaque and sits above the head at z-index 100, so
     a handle parked under it cannot be hit by a pointer at all -- the contract
     caught exactly that: elementFromPoint returned NAV.jbNav where a corner
     handle should have been. "A share of the head stays inside the Hero" is
     the wrong test if part of the inside is covered; reachability has to mean
     ACTUALLY reachable. So the bar's footprint is subtracted from the top of
     the region rather than left as a trap you can drag the head into and not
     get it back out of. Measured live, so it stays right if the bar resizes.
     The resting composition sits far below the bar, so this cannot make the
     start position illegal -- asserted in the contract. */
  function usableRect(){
   var h=hero.getBoundingClientRect();
   var bar=document.querySelector(".jbStick .jbNav")||document.querySelector(".jbStick");
   var top=h.top;
   if(bar){
    var b=bar.getBoundingClientRect();
    if(b.bottom>h.top&&b.top<h.bottom&&b.width>0)top=Math.min(b.bottom,h.bottom);
   }
   return {left:h.left,top:top,right:h.right,bottom:h.bottom,
    width:h.right-h.left,height:Math.max(0,h.bottom-top)};
  }
  function reachable(box){
   var h=usableRect();
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
  /* ── THE FRAME IS A RIGID BODY, NOT A MEASUREMENT ────────────────────────
     It used to be rebuilt from getBoundingClientRect() on every render, which
     is why Jayden read it as imprecise: the portrait carries its own idle
     breathing from hero-engine, so the "bounds" it was hugging changed by ~3px
     a second, and it was tracing the alpha silhouette of a photographic cutout
     -- his hair -- rather than describing an object.
     A design tool does not do that. It keeps the object's bounds in LOCAL
     space and pushes them through the same matrix as the object, so the two
     are one body and the frame cannot breathe, shimmer or lag. This captures
     that local rect once and transforms it, and the animation loop performs no
     layout reads at all -- which is also what makes it cheap enough to run
     forever on the landing page. */
  function captureBase(){
   var saved=["--hero-head-x","--hero-head-y","--hero-head-scale","--hero-head-rotate",
    "--hero-head-float-x","--hero-head-float-y","--hero-head-float-rot"]
    .map(function(n){return [n,wrap.style.getPropertyValue(n)];});
   wrap.style.setProperty("--hero-head-x","0px");wrap.style.setProperty("--hero-head-y","0px");
   wrap.style.setProperty("--hero-head-scale","1");wrap.style.setProperty("--hero-head-rotate","0deg");
   wrap.style.setProperty("--hero-head-float-x","0px");wrap.style.setProperty("--hero-head-float-y","0px");
   wrap.style.setProperty("--hero-head-float-rot","0deg");
   var u=logicalRaw(),h=hero.getBoundingClientRect();
   state.base={left:u.left-h.left,top:u.top-h.top,width:u.width,height:u.height};
   saved.forEach(function(pair){
    if(pair[1])wrap.style.setProperty(pair[0],pair[1]);else wrap.style.removeProperty(pair[0]);
   });
  }
  function cssNumber(node,name){return parseFloat(node.style.getPropertyValue(name))||0;}
  /* The frame in Hero-relative space: local bounds, scaled about their own
     centre, translated by the user's arrangement plus the float, turned by the
     sum of both angles. --selection-air is subtracted in SCREEN pixels, never
     scaled, so the ring of space around the artwork is the same thickness at
     0.24x as at 2.2x -- an inset that grew with scale would look wrong the
     moment he resized. */
  function frameGeometry(){
   if(!state.base)captureBase();
   var b=state.base,s=state.scale;
   var air=rootNumber("--selection-air",0);
   var cx=b.left+b.width/2+state.x+cssNumber(wrap,"--hero-head-float-x");
   var cy=b.top+b.height/2+state.y+cssNumber(wrap,"--hero-head-float-y");
   return {cx:cx,cy:cy,
    w:Math.max(1,b.width*s+air*2),h:Math.max(1,b.height*s+air*2),
    ang:state.rotate+cssNumber(wrap,"--hero-head-float-rot")};
  }
  function syncSelection(){
   if(!state.selected)return;
   var h=hero.getBoundingClientRect(),g=frameGeometry();
   var rad=g.ang*Math.PI/180,cos=Math.cos(rad),sin=Math.sin(rad);
   /* The BOX is the pointer surface and must not reach past the Hero, so it
      stays the turned bounding box clamped to the Hero -- but it is now
      computed from the rigid frame rather than measured from pixels. */
   var bw=Math.abs(g.w*cos)+Math.abs(g.h*sin),bh=Math.abs(g.w*sin)+Math.abs(g.h*cos);
   var raw={left:g.cx-bw/2,top:g.cy-bh/2,right:g.cx+bw/2,bottom:g.cy+bh/2};
   /* Clipped to the REACHABLE region, not the Hero. The Hero runs up behind
      the floating bar, so a box clipped to the Hero's own top edge parks its
      upper handles underneath an opaque nav at z-index 100 and they stop
      taking clicks. Riding the bar's lower edge instead keeps every handle
      hittable, and matches the region clampMove already confines the head to. */
   var u=usableRect(),ceiling=u.top-h.top;
   var r={left:Math.max(raw.left,0),top:Math.max(raw.top,ceiling),
    right:Math.min(raw.right,h.width),bottom:Math.min(raw.bottom,h.height)};
   var w=Math.max(1,r.right-r.left),ht=Math.max(1,r.bottom-r.top);
   selection.style.setProperty("--selection-x",r.left+"px");
   selection.style.setProperty("--selection-y",r.top+"px");
   selection.style.setProperty("--selection-w",w+"px");
   selection.style.setProperty("--selection-h",ht+"px");
   /* The chrome is a Hero-relative sibling, not a child of the wrapper, so the
      angle has to be handed to it explicitly -- it cannot inherit it. */
   selection.style.setProperty("--hero-head-rotate",g.ang+"deg");
   if(frame){
    frame.style.setProperty("--frame-x",(g.cx-g.w/2-r.left)+"px");
    frame.style.setProperty("--frame-y",(g.cy-g.h/2-r.top)+"px");
    frame.style.setProperty("--frame-w",g.w+"px");
    frame.style.setProperty("--frame-h",g.h+"px");
   }
   var box={width:w,height:ht};
   /* Clamped into the VISIBLE box. At rest the head hangs ~166px below the
      Hero's lower edge, so its true bottom corners are off-stage; a handle
      drawn there would be unreachable and would read as the frame leaking out
      of the scene. The corner rides the clipped edge instead, which is what a
      design tool does when the artboard crops the selection. */
   var turn=function(dx,dy){
    var px=g.cx+dx*cos-dy*sin-r.left,py=g.cy+dx*sin+dy*cos-r.top;
    return {x:Math.max(0,Math.min(w,px)),y:Math.max(0,Math.min(ht,py))};
   };
   handles.forEach(function(handle){
    var corner=handle.getAttribute("data-corner");
    place(handle,turn(corner.indexOf("w")>-1?-g.w/2:g.w/2,
     corner.indexOf("n")>-1?-g.h/2:g.h/2),box);
   });
   if(rotator)place(rotator,turn(0,-g.h/2),box);
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
  /* THE CLAMP AND THE FRAME MUST READ THE SAME GEOMETRY. They did not: the
     clamp measured the live rect while the frame transformed the cached local
     one, and the two disagree by the float offset and by the portrait's own
     idle breathing. The drag could then be clamped against a rect the frame
     never drew, which let the head go far enough past the Hero's floor that
     the visible box collapsed to 1px and all four handles piled up on the same
     point, half of them below the Hero. Both now derive from state.base.
     It is also stated ABSOLUTELY rather than as a delta from state.rendered,
     so a burst of pointermoves arriving between two animation frames can no
     longer clamp against a stale origin. */
  function transformedBox(x,y){
   var b=state.base,s=state.scale;
   var cx=b.left+b.width/2+x,cy=b.top+b.height/2+y;
   var w=b.width*s,h=b.height*s;
   var cos=Math.abs(Math.cos(radians())),sin=Math.abs(Math.sin(radians()));
   var bw=w*cos+h*sin,bh=w*sin+h*cos;
   return {left:cx-bw/2,top:cy-bh/2,right:cx+bw/2,bottom:cy+bh/2,width:bw,height:bh};
  }
  function clampMove(x,y){
   if(!state.base)captureBase();
   var hr=hero.getBoundingClientRect(),u=usableRect();
   var top=u.top-hr.top,bottom=u.bottom-hr.top,right=hr.width;
   var box=transformedBox(x,y),need=reachable(box);
   var minLeft=need.x-box.width,maxLeft=right-need.x;
   var minTop=top+need.y-box.height,maxTop=bottom-need.y;
   var wantLeft=Math.min(Math.max(box.left,minLeft),maxLeft);
   var wantTop=Math.min(Math.max(box.top,minTop),maxTop);
   return {x:x+(wantLeft-box.left),y:y+(wantTop-box.top)};
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
   select();event.preventDefault();stopFloat();state.pointerId=event.pointerId;state.operation="move";
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
   event.preventDefault();event.stopPropagation();select();stopFloat();
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
  /* THE SNAP IS FOR CONTINUOUS INPUT ONLY. Snapping a DISCRETE step made
     keyboard rotation impossible: --hero-head-rotate-step is 2deg and the snap
     zone is 6deg, so ArrowRight walked 2 -> 4 -> 6 -> snapped back to 0 and
     round again forever -- the head could not be turned from the keyboard at
     all. A drag passes through the snap zone continuously and genuinely wants
     to be caught by it; a key press is already quantised and means exactly
     what it says. */
  function limitRotate(value,quantise,allowSnap){
   var increment=rootNumber("--hero-head-rotate-step-large",15);
   var snap=rootNumber("--hero-head-rotate-snap",6);
   if(quantise)value=Math.round(value/increment)*increment;
   else if(allowSnap!==false&&Math.abs(value)<=snap)value=0;
   return Math.max(rootNumber("--hero-head-min-rotate",-180),
    Math.min(rootNumber("--hero-head-max-rotate",180),value));
  }
  function pointerAngle(centre,x,y){
   return Math.atan2(y-centre.y,x-centre.x)*180/Math.PI;
  }
  function beginRotate(event){
   if(state.pointerId!==null)return;
   if(event.button!==undefined&&event.button!==0)return;
   event.preventDefault();event.stopPropagation();select();stopFloat();
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
   startFloat();
  }
  function reset(){
   state.x=0;state.y=0;state.scale=1;state.rotate=0;
   state.pendingAnchor=null;state.pendingClamp=false;render();
  }
  /* ── THE FLOAT ───────────────────────────────────────────────────────────
     Driven from JS rather than a CSS keyframe for one reason: the selection
     chrome is a Hero-relative SIBLING of the head, not a child, so it cannot
     inherit the motion. Writing the float and re-syncing the chrome in the
     same frame is what keeps the box welded to the head -- a CSS animation
     would move the head between syncs and the box would visibly lag, which
     collapses the whole artboard illusion.
     Three slow sinusoids plus one faster harmonic on Y. They are summed, not
     switched, so the path is quasi-periodic and never obviously loops. */
  function floatAmp(name,fallback){return rootNumber(name,fallback);}
  function floatAt(ms){
   var t=ms/1000;
   var tau=Math.PI*2;
   var y=floatAmp("--hero-head-float-y-amp",9)
      *Math.sin(tau*t/floatAmp("--hero-head-float-y-period",5.9))
     +floatAmp("--hero-head-float-y2-amp",3)
      *Math.sin(tau*t/floatAmp("--hero-head-float-y2-period",3.7)+1.7);
   var x=floatAmp("--hero-head-float-x-amp",5)
      *Math.sin(tau*t/floatAmp("--hero-head-float-x-period",8.3)+.9);
   var r=floatAmp("--hero-head-float-rot-amp",.7)
      *Math.sin(tau*t/floatAmp("--hero-head-float-rot-period",11.7)+2.4);
   return {x:x,y:y,rot:r};
  }
  /* Negative Y is up. The lift is normalised 0..1 against the summed Y
     amplitude so the shadow reads HEIGHT rather than raw pixels, and stays
     correct if the amplitudes are retuned. */
  function writeFloat(ms){
   var f=floatAt(ms);
   var span=floatAmp("--hero-head-float-y-amp",9)+floatAmp("--hero-head-float-y2-amp",3);
   var lift=span>0?Math.max(0,Math.min(1,(-f.y+span)/(span*2))):0;
   wrap.style.setProperty("--hero-head-float-x",f.x.toFixed(2)+"px");
   wrap.style.setProperty("--hero-head-float-y",f.y.toFixed(2)+"px");
   wrap.style.setProperty("--hero-head-float-rot",f.rot.toFixed(3)+"deg");
   hero.style.setProperty("--hero-head-shadow-lift",lift.toFixed(3));
  }
  function floatFrame(ms){
   if(!state.floating){state.floatFrame=0;return;}
   writeFloat(ms);
   /* The head has physically moved, so every cached measurement is stale and
      the chrome has to be re-derived from the new rect, in THIS frame. */
   state.stamp++;syncSelection();
   state.floatFrame=requestAnimationFrame(floatFrame);
  }
  function startFloat(){
   if(state.floating||prefersReducedMotion())return;
   state.floating=true;
   if(!state.floatFrame)state.floatFrame=requestAnimationFrame(floatFrame);
  }
  /* Paused for the duration of a pointer operation. Dragging an object that is
     also drifting under your cursor feels broken -- the object should go
     exactly where you put it -- so the float holds its current offset and
     resumes from the live clock on release, which avoids a jump back. */
  function stopFloat(){
   state.floating=false;
   if(state.floatFrame)cancelAnimationFrame(state.floatFrame);
   state.floatFrame=0;
  }
  function prefersReducedMotion(){
   return matchMedia("(prefers-reduced-motion: reduce)").matches
    ||document.documentElement.getAttribute("data-reduced-motion")==="reduce";
  }
  function reclamp(){
   state.stamp++;syncOrigin();captureBase();
   var next=clampMove(state.x,state.y);state.x=next.x;state.y=next.y;render();
  }
  function getState(){
   /* `box` is the rigid, Hero-relative rect the clamp actually reasons about.
      It is exposed because the rendered portrait is NOT that rect -- the
      companion engine gives the head its own idle breathing, so a
      getBoundingClientRect() reading drifts by ~14px against the geometry the
      clamp enforces. A test that measures the silhouette is measuring the
      breathing; this lets it measure the invariant. */
   return {selected:state.selected,x:state.x,y:state.y,scale:state.scale,rotate:state.rotate,
    box:state.base?transformedBox(state.x,state.y):null};
  }
  function onKeydown(event){
   face.removeAttribute("data-pointer-focus");
   if(event.key==="Escape"&&state.selected){event.preventDefault();state.ambient=false;deselect({restoreFocus:true});return;}
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
    state.rotate=limitRotate(state.rotate+direction*turnStep,event.shiftKey,false);
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
   if(state.ambient)return;
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
  syncOrigin();captureBase();
  /* THE PAGE ARRIVES ALREADY SELECTED. This is the concept, not a leftover
     hover state: the Hero is an artboard caught mid-edit. It is opened without
     taking focus -- stealing focus on load would hijack the keyboard and drag
     a screen reader straight past the headline -- and Escape still closes it
     for good, which is the escape hatch for anyone who does not want it. */
  function ambient(){
   state.ambient=true;
   state.selected=true;face.setAttribute("aria-pressed","true");selection.hidden=false;
   chrome.forEach(function(node){node.tabIndex=0;});
   state.stamp++;syncSelection();
  }
  ambient();startFloat();
  /* A tab in the background gets no frames, so the float would resume from a
     clock that jumped. Stopping and restarting keeps it continuous. */
  document.addEventListener("visibilitychange",function(){
   if(document.hidden)stopFloat();else if(state.ambient||state.selected)startFloat();
  });
  return {select:select,deselect:deselect,reset:reset,reclamp:reclamp,getState:getState,
   startFloat:startFloat,stopFloat:stopFloat,ambient:ambient};
 }
 window.HeroHeadTransform={init:init};
 addEventListener("DOMContentLoaded",function(){window.__heroHeadTransform=init(document);});
})();
