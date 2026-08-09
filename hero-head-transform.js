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
   stamp:0,geomStamp:-1,geom:null,floating:false,floatFrame:0,ambient:false,base:null,metrics:null,
   hovering:false,resumeTimer:0,floatShift:0,holdAt:0,lastFloatMs:0,
   rendered:{x:0,y:0,scale:1,rotate:0}};
  var content=hero.querySelector(".heroCopy");
  var peek=hero.querySelector(".heroCharacterPeek");
  /* ── THE BOUNDS ARE THE ARTWORK'S, AND THEY WERE THE FACE'S ──────────────
     data-head-bounds is where the head sits inside its own image, and the
     frame traces it exactly -- so if it is one pixel tighter than the cut-out,
     the head pokes out of its own selection box and no amount of --selection-air
     hides it once the head is scaled up. It was: the authored 0.22 0.12 0.80
     0.91 is a rectangle around the FACE, and the artwork is a photographic
     cut-out with HAIR. Measured off the alpha channel of every image #face can
     wear, the real extents are 0.1933 0.0617 0.8483 0.9233 -- 5.8% of the
     image's height missing off the top alone, because wink.webp carries the
     tallest hair of the nine. At the resting 235px that is the head standing
     5.7px outside its own frame at scale 1, and 58px outside it at 2.2. That is
     "sometimes the head peaks out of it": always, by the hair, and further on
     some moods than others.
     THE VALUE IS THE UNION OF ALL NINE FACES, NOT THE CURRENT ONE. A frame that
     re-hugged each face would resize itself every time he blinks -- the exact
     breathing the rigid-body rewrite exists to stop -- and would let the next
     mood swap step outside it. One rectangle that bounds every face the head
     can wear is the object's bounds; that is what a design tool frames.
     IT IS MEASURED, NOT AUTHORED. tools/hero-head-transform-contract.py reads
     the alpha channels back out of images/ and fails if this attribute is
     tighter than the pixels, so a re-exported portrait cannot quietly grow out
     of its frame again. */
  var bounds=(face.getAttribute("data-head-bounds")||"0.1933 0.0616 0.8484 0.9234")
   .split(/\s+/).map(Number);

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
  /* ── THE RESTING ANGLE ───────────────────────────────────────────────────
     Every other resting value is LAYOUT -- width, shift, depth -- so that
     reset() lands exactly home and the clamp never sees rest as "already
     moved". A rotation has nowhere to live but the transform, so this one
     resting value is transform state, read from the same stylesheet the rest
     of the composition is authored in. reset() returns here, the entrance
     lands here, and the float oscillates around here. */
  function restRotate(){return rootNumber("--hero-head-rest-rotate",0);}
  /* ── MEASURE THE HEAD LEVEL, WHATEVER IT IS DOING ────────────────────────
     Once the wrapper carries a rotation, getBoundingClientRect() returns the
     TURNED bounding box, and slicing head-bounds fractions out of that is not
     the head. Rather than invert the matrix, every angle the wrapper is
     carrying is lifted off for one read and put straight back: the
     measurement is exact at any angle.
     THE NEUTRALISING WRITE HAS TO BE !important. --hero-head-enter-rot is
     driven by a keyframe, and an animation outranks an inline style in the
     cascade -- so a plain inline 0deg is silently ignored for the whole
     arrival and the base rectangle everything downstream trusts gets captured
     through whatever angle the entrance happened to be passing. An important
     declaration is the one thing that does beat an animation. */
  var LEVEL=["--hero-head-rotate","--hero-head-float-rot","--hero-head-enter-rot"];
  function withLevel(read){
   var saved=LEVEL.map(function(name){
    return [name,wrap.style.getPropertyValue(name)];
   });
   LEVEL.forEach(function(name){wrap.style.setProperty(name,"0deg","important");});
   var measured=read();
   saved.forEach(function(pair){
    if(pair[1])wrap.style.setProperty(pair[0],pair[1]);
    else wrap.style.removeProperty(pair[0]);
   });
   return measured;
  }
  /* Cached per render pass so a drag frame pays for the extra layout once. */
  function geom(){
   if(state.geomStamp===state.stamp&&state.geom)return state.geom;
   state.geom=withLevel(logicalRaw);state.geomStamp=state.stamp;
   return state.geom;
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
  /* ── EVERYTHING THE FLOAT LOOP NEEDS, READ ONCE ──────────────────────────
     The loop runs forever on the landing page, so anything it does per frame
     it does about 60 times a second for as long as the tab is open. It was
     resolving styles and forcing layout on every one of them: rootNumber()
     is a getComputedStyle() on the root, and floatAt() alone called it eight
     times, plus --selection-air, plus a hero rect, plus the two rects inside
     usableRect(), plus a getBoundingClientRect() per handle inside place().
     Because syncSelection WRITES left/top/width/height and then place() READ
     geometry back, each frame also forced a synchronous relayout.
     Measured cost of that: 8 rendered frames in a 1.5s window against 24 on
     the pre-float build. None of these values can change without a resize,
     and reclamp() already runs on resize and on both ResizeObservers, so they
     are cached and invalidated there. The steady-state loop now reads nothing
     from the DOM at all -- it only writes.
     Sizes and differences only: h.width/h.height are scroll-invariant, and
     the ceiling is stored as (usable.top - hero.top), a layout-relative
     distance, so scrolling cannot stale it. */
  function metrics(){
   if(state.metrics)return state.metrics;
   var h=hero.getBoundingClientRect(),u=usableRect();
   var hitNode=handles[0]||rotator;
   state.metrics={
    heroW:h.width,heroH:h.height,ceiling:u.top-h.top,
    air:rootNumber("--selection-air",0),
    hit:(hitNode?hitNode.getBoundingClientRect().width:0)
      ||rootNumber("--selection-hit-size",44)||44,
    yAmp:rootNumber("--hero-head-float-y-amp",9),
    yPer:rootNumber("--hero-head-float-y-period",5.9),
    y2Amp:rootNumber("--hero-head-float-y2-amp",3),
    y2Per:rootNumber("--hero-head-float-y2-period",3.7),
    xAmp:rootNumber("--hero-head-float-x-amp",5),
    xPer:rootNumber("--hero-head-float-x-period",8.3),
    rAmp:rootNumber("--hero-head-float-rot-amp",.7),
    rPer:rootNumber("--hero-head-float-rot-period",11.7),
    /* WHERE THE LIGHT IS, as a share of the Hero. Authored per time-of-day
       state; the DIRECTION is derived from it every frame against the head's
       live position, so the rim swings as the head moves and crosses over
       when it passes under the source. */
    lightX:(parseFloat(getComputedStyle(hero).getPropertyValue("--time-light-x"))||50)/100,
    lightY:(parseFloat(getComputedStyle(hero).getPropertyValue("--time-light-y"))||84)/100
   };
   return state.metrics;
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
   hero.style.setProperty("--hero-head-scale",String(state.scale));
   updateLight(cssNumber(wrap,"--hero-head-float-x"),cssNumber(wrap,"--hero-head-float-y"),
    cssNumber(wrap,"--hero-head-float-rot"));
   state.rendered={x:state.x,y:state.y,scale:state.scale,rotate:state.rotate};
   state.stamp++;
  }
  /* The wrapper's transform-origin is the logical head's centre expressed as a
     percentage of the wrapper, so the head turns about itself rather than
     about the stage's corner. Percentages are scale-invariant, so this is a
     layout constant -- but a turned bounding box would not give the same
     ratio, so the measurement has to be taken level.
     THE HEAD IS NEVER LEVEL ANY MORE, so this cannot be guarded on
     state.rotate being zero the way it was -- with a rotated resting pose that
     guard would have skipped the write for the life of the page and left the
     origin on its authored fallback. It measures through withLevel() instead,
     which is exact at any angle. A pure translation or a uniform scale about
     this same point preserves the ratio, so only the rotation has to come off. */
  function syncOrigin(){
   var measured=withLevel(function(){
    return {u:logicalRaw(),w:wrap.getBoundingClientRect()};
   });
   var u=measured.u,w=measured.w;
   if(!w.width||!w.height)return;
   wrap.style.setProperty("--hero-head-origin-x",
    (((u.left+u.right)/2-w.left)/w.width*100)+"%");
   wrap.style.setProperty("--hero-head-origin-y",
    (((u.top+u.bottom)/2-w.top)/w.height*100)+"%");
  }
  /* WHERE THE DOT IS ACTUALLY DRAWN, kept as a number rather than re-measured.
     controls.css draws the visible square at --h-dx/--h-dy off the hit box's
     centre, and hero-time.css clamps that offset so the square can never leave
     its own 44px target. Reproducing the same clamp here means the arbitration
     below can ask "which dot did they aim at" without reading ::before styles
     back out of the CSSOM on every press. Selection-local, like --h-x/--h-y. */
  /* ── A TARGET THAT HANGS OFF THE VIEWPORT IS NOT A TARGET ────────────────
     The hit box used to be clamped into the SELECTION box, and to fall back to
     the box's centre whenever the box was narrower than 44px. That is fine
     while the box is big; at 320 with the head at minimum scale it is not --
     the resting composition already sits mostly past the left edge there, the
     visible box measures about 27px, and centring a 44px target in it put a
     third of the target off-screen where no pointer can reach it.
     Reachability wins over tidiness: the target is clamped into the region the
     visitor can actually press -- the Hero, minus the opaque bar across its top
     -- and only then into the box. When the two conflict, because the box is
     smaller than the minimum target, the Hero is the one that is real. */
  function axis(point,extent,lead,limit,hit){
   var half=hit/2;
   var min=half-lead,max=limit-lead-half;
   if(max<min)max=min=(min+max)/2;
   var want=extent<hit?extent/2:Math.max(half,Math.min(extent-half,point));
   return Math.max(min,Math.min(max,want));
  }
  function place(node,point,box,lead){
   var m=metrics(),hit=m.hit;
   var cx=axis(point.x,box.width,lead.x,m.heroW,hit);
   var cy=axis(point.y,box.height,lead.y-m.ceiling,m.heroH-m.ceiling,hit);
   node.style.setProperty("--h-x",cx+"px");
   node.style.setProperty("--h-y",cy+"px");
   node.style.setProperty("--h-dx",(point.x-cx)+"px");
   node.style.setProperty("--h-dy",(point.y-cy)+"px");
   var reach=(m.hit-rootNumber("--selection-handle-size",8))/2;
   node.__dot={x:cx+Math.max(-reach,Math.min(reach,point.x-cx)),
               y:cy+Math.max(-reach,Math.min(reach,point.y-cy))};
  }
  /* ── THE DOT YOU AIMED AT WINS, NOT THE ONE THAT PAINTS ON TOP ────────────
     Five 44px targets do not fit on a 136px head without overlapping, and the
     head just got small. Measured at rest on a 390 viewport: the rotate dot
     sits 24px from the nw dot, so it was entirely inside nw's target -- and
     because .heroHeadHandle sits above .heroHeadRotate in z-order, the rotate
     handle was DEAD at the default composition on every phone. That z-order
     rule was written for a degenerate box collapsed against a viewport edge,
     where it is still right; as a general rule it decides overlaps by paint
     order, which has nothing to do with what the visitor was pointing at.
     The rule instead is the one the visible design already promises: the
     nearest DRAWN dot takes the press. It only engages when targets genuinely
     overlap, so nothing changes at desktop rest where they do not, and it
     resolves every historical collision in this component -- the rotator
     swallowing ne, and now the corners swallowing the rotator -- with one
     comparison rather than a standing preference for either. */
  /* AND A PRESS THAT IS NEAR NO DOT AT ALL IS A PRESS ON THE HEAD. The hit
     boxes are clamped to stay inside the selection, so on a small frame they
     migrate INWARD, off their own edges and over the artwork -- at 320 with the
     head scaled down, the rotate target had drifted far enough across the face
     that grabbing the head to move it started a rotation instead. A 44px target
     is a promise about the dot, not a licence to own the middle of the object,
     so the radius is measured from the dot and the interior goes back to the
     head. */
  function chromeAt(event){
   var reach=metrics().hit/2;
   var origin=selection.getBoundingClientRect(),best=null,shortest=Infinity;
   chrome.forEach(function(node){
    var dot=node.__dot;
    if(!dot)return;
    /* Chebyshev, not Euclidean: the promise a 44px target makes is a 44px
       SQUARE, so measuring a radius would quietly shrink the corners of every
       handle by 6px for no reason anyone could see. */
    var dx=Math.abs(origin.left+dot.x-event.clientX);
    var dy=Math.abs(origin.top+dot.y-event.clientY);
    var distance=Math.max(dx,dy);
    if(distance<shortest){shortest=distance;best=node;}
   });
   return shortest<=reach?best:null;
  }
  function beginChrome(event,node){
   var corner=node.getAttribute("data-corner");
   if(corner)beginResize(event,corner,node);
   else beginRotate(event,node);
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
  /* THE ENTRANCE IS PART OF WHAT HAS TO COME OFF. --hero-head-enter-y and
     --hero-head-enter-rot ride the same transform, and they are keyframed --
     so they are still moving at exactly the moment this runs, and a keyframe
     beats a plain inline write. Neutralised at !important along with
     everything else, or the local rectangle the frame draws and the clamp
     enforces gets captured mid-arrival and stays wrong for the life of the
     page. */
  var NEUTRAL=["--hero-head-x","--hero-head-y","--hero-head-scale","--hero-head-rotate",
   "--hero-head-float-x","--hero-head-float-y","--hero-head-float-rot",
   "--hero-head-enter-y","--hero-head-enter-rot"];
  function captureBase(){
   var saved=NEUTRAL.map(function(n){return [n,wrap.style.getPropertyValue(n)];});
   NEUTRAL.forEach(function(name){
    wrap.style.setProperty(name,
     name==="--hero-head-scale"?"1":/rot/.test(name)?"0deg":"0px","important");
   });
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
   var air=metrics().air;
   var cx=b.left+b.width/2+state.x+cssNumber(wrap,"--hero-head-float-x");
   var cy=b.top+b.height/2+state.y+cssNumber(wrap,"--hero-head-float-y");
   return {cx:cx,cy:cy,
    w:Math.max(1,b.width*s+air*2),h:Math.max(1,b.height*s+air*2),
    ang:state.rotate+cssNumber(wrap,"--hero-head-float-rot")};
  }
  function syncSelection(){
   if(!state.selected)return;
   var h=metrics(),g=frameGeometry();
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
   var ceiling=h.ceiling;
   var r={left:Math.max(raw.left,0),top:Math.max(raw.top,ceiling),
    right:Math.min(raw.right,h.heroW),bottom:Math.min(raw.bottom,h.heroH)};
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
   var lead={x:r.left,y:r.top};
   handles.forEach(function(handle){
    var corner=handle.getAttribute("data-corner");
    place(handle,turn(corner.indexOf("w")>-1?-g.w/2:g.w/2,
     corner.indexOf("n")>-1?-g.h/2:g.h/2),box,lead);
   });
   if(rotator)place(rotator,turn(0,-g.h/2),box,lead);
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
  /* THE LOCAL BOUNDS ARE ONLY TRUE ONCE THE LAYOUT HAS SETTLED. captureBase()
     at init reads the head where it is at that instant, and at that instant the
     peek has not finished travelling and the portrait may not have been sized
     by its image yet -- measured 198px out at 1440. Everything downstream
     trusts that rectangle (the frame draws it, the clamp enforces it), so a
     base captured mid-flight is silently wrong for the life of the page.
     Re-taken whenever the layout can have changed: when the peek stops moving,
     and on window load once every image has its real box. */
  function recapture(){
   state.metrics=null;captureBase();state.stamp++;syncSelection();
  }
  function endPeekTransition(event){
   if(!isOwnPeekTransform(event))return;
   state.peekAnimating=false;
   if(state.peekFrame)cancelAnimationFrame(state.peekFrame);
   state.peekFrame=0;recapture();render();
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
  function beginResize(event,corner,node){
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
   state.capture=node||event.currentTarget;state.capture.setPointerCapture(event.pointerId);
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
  /* TWO ANGLES ARE WORTH CATCHING, NOT ONE. Level is one of them -- it always
     was. The other is the RESTING tilt, which used to be level and is not any
     more: reset() returns there, so a drag has to be able to find it too, or
     the only way home from a turn is a keyboard shortcut nobody knows about.
     The two zones cannot overlap while the rest angle is further from level
     than the snap width, which -13.8deg against 6deg comfortably is; if they
     ever did, the nearer target simply wins. */
  function limitRotate(value,quantise,allowSnap){
   var increment=rootNumber("--hero-head-rotate-step-large",15);
   var snap=rootNumber("--hero-head-rotate-snap",6);
   if(quantise)value=Math.round(value/increment)*increment;
   else if(allowSnap!==false){
    var rest=restRotate();
    var toLevel=Math.abs(value),toRest=Math.abs(value-rest);
    if(toLevel<=snap&&toLevel<=toRest)value=0;
    else if(toRest<=snap)value=rest;
   }
   return Math.max(rootNumber("--hero-head-min-rotate",-180),
    Math.min(rootNumber("--hero-head-max-rotate",180),value));
  }
  function pointerAngle(centre,x,y){
   return Math.atan2(y-centre.y,x-centre.x)*180/Math.PI;
  }
  function beginRotate(event,node){
   if(state.pointerId!==null)return;
   if(event.button!==undefined&&event.button!==0)return;
   event.preventDefault();event.stopPropagation();select();stopFloat();
   var u=geom(),centre={x:(u.left+u.right)/2,y:(u.top+u.bottom)/2};
   state.pointerId=event.pointerId;state.operation="rotate";
   state.start={centre:centre,angle:pointerAngle(centre,event.clientX,event.clientY),
    rotate:state.rotate};
   state.capture=node||event.currentTarget;state.capture.setPointerCapture(event.pointerId);
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
   releaseFloat();
  }
  /* HOME IS NOT 0 ON EVERY AXIS. x, y and scale rest at their neutral values
     because the whole resting composition is expressed in LAYOUT. The angle
     cannot be -- there is no layout property that turns a box -- so rest is
     --hero-head-rest-rotate and this returns to it. Clearing the angle to 0
     here would put the head somewhere it has never been. */
  function reset(){
   state.x=0;state.y=0;state.scale=1;state.rotate=restRotate();
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
  function floatAt(ms){
   var m=metrics(),t=ms/1000,tau=Math.PI*2;
   var y=m.yAmp*Math.sin(tau*t/m.yPer)+m.y2Amp*Math.sin(tau*t/m.y2Per+1.7);
   var x=m.xAmp*Math.sin(tau*t/m.xPer+.9);
   var r=m.rAmp*Math.sin(tau*t/m.rPer+2.4);
   return {x:x,y:y,rot:r};
  }
  function writeFloat(ms){
   var f=floatAt(ms);
   updateLight(f.x,f.y,f.rot);
   wrap.style.setProperty("--hero-head-float-x",f.x.toFixed(2)+"px");
   wrap.style.setProperty("--hero-head-float-y",f.y.toFixed(2)+"px");
   wrap.style.setProperty("--hero-head-float-rot",f.rot.toFixed(3)+"deg");
  }
  /* ── THE HEAD CASTS NOTHING, SO NOTHING HERE WRITES A SHADOW ─────────────
     There was a wrapper around hero-engine's updateShadow() here. It existed
     because the engine knew about the head's own reactions but not about the
     visitor's arrangement or the float, and two writers on one inline style
     flicker -- so every write went through one place that summed them.
     The Hero has no ground ellipse to write to now. --hero-peek-depth went
     negative and the head is suspended 164px clear of the floor, and this
     site's rule is that a head casts a contact shadow BECAUSE it stands on
     something; at that separation the ellipse was an unrelated smudge near the
     bottom of the page. The whole wrapper is deleted rather than left pointing
     at a hidden element. Play's companion still stands on a surface, still has
     its #fsh, and hero-engine still writes it. */
  /* ── THE LIGHT IS A PLACE, AND DIRECTION IS THE VECTOR TO IT ─────────────
     --time-light-dir used to be a constant per time-of-day state, so the head
     could be dragged the whole width of the Hero and its lighting never
     changed -- stagnant, and no tuning of the constant could have fixed it
     because the model had no notion of position.
     Now: normalise (light - head). Left of the source the rim sits on the
     right; drag the head past the source and it swings over. Proximity fades
     the rim with distance -- gentle and monotonic, not physical.
     Everything the loop needs is cached in metrics(), so this is arithmetic
     and two setProperty calls per frame: it does not undo the work that got
     the float loop down to writes only. One custom property out, and CSS does
     the rest -- the rim, the bounce, the shadow throw and the catchlight all
     read it already. */
  /* ── IMAGE-BASED LIGHTING, EVALUATED FROM THE AUTHORED GRADIENT ──────────
     "If it's closer to the gradient it should shine that colour brighter."
     That is environment lighting: the sky IS the source, rather than a lamp
     placed in front of a backdrop. Renderers reduce an environment to three
     terms -- a dominant direction, a dominant colour, and an ambient fill (the
     L1 spherical-harmonic approximation) -- because that captures nearly all
     of the perceptual effect for almost none of the cost. Those three are
     exactly what is derived here.

     NO PIXELS ARE READ. The skies are authored CSS radial gradients with known
     focal points and colour stops, so they can be evaluated ANALYTICALLY: work
     out where the head sits in the gradient's own radial coordinate and
     interpolate its stops there. getImageData would force a GPU->CPU readback
     every frame, and this codebase has already deleted one of those -- the
     tournament posters' --fit alpha probe -- for that exact reason.

     THE GRADIENT IS STILL THE ONLY SOURCE. The stop table is parsed from the
     CSSOM at state-change time, not duplicated in JS, so retuning a sky in
     hero-time.css retunes the lighting with it and the two cannot drift.

     A SKY IS EVERY LAYER OF ITSELF. This read only the FIRST radial-gradient
     in the background, which is right for the five daylight states because
     they are one opaque radial and nothing else. It is wrong for night, which
     is two TRANSLUCENT glows over an opaque linear base -- so the model saw
     rgba(...,0) wherever the glows had faded out and concluded the sky was
     pure black. Measured on the shipped build: at the resting position
     --env-color read rgb(0,0,0) and --env-raw read 0.000, which collapsed the
     rim to 3.9% alpha and the ambient term to nothing. Night, the one state
     whose legibility this file puts ON the rim and the catchlight, was the one
     state with neither. Every layer is parsed and composited now, over the
     Hero's own background colour, so what is sampled is the sky that is
     actually painted. */
  var env=null;
  function splitTop(str){
   var out=[],depth=0,cur="";
   for(var i=0;i<str.length;i++){
    var c=str[i];
    if(c==="(")depth++;else if(c===")")depth--;
    if(c===","&&depth===0){out.push(cur);cur="";}else cur+=c;
   }
   if(cur.trim())out.push(cur);
   return out;
  }
  function parseColour(token){
   var m=token.match(/rgba?\(([^)]+)\)/);
   if(!m)return null;
   var n=m[1].split(/[,\/\s]+/).filter(function(s){return s.length;}).map(parseFloat);
   if(n.length<3||!isFinite(n[0]))return null;
   return {r:n[0],g:n[1],b:n[2],a:n.length>3&&isFinite(n[3])?n[3]:1};
  }
  function parseStops(parts,from){
   var stops=[];
   for(var j=from;j<parts.length;j++){
    var token=parts[j].trim(),c=parseColour(token);
    if(!c)continue;
    /* Chrome serialises the first stop of these gradients as `0px`, not `0%`.
       A length anywhere else would need the gradient's own line length to
       normalise, which none of these skies use -- so anything but zero is
       left implicit and spaced evenly, exactly as CSS would. */
    var at=token.match(/(?:^|\s)(-?[\d.]+)(%|px)\s*$/);
    c.p=at?(at[2]==="%"?parseFloat(at[1])/100:(parseFloat(at[1])===0?0:null)):null;
    stops.push(c);
   }
   if(!stops.length)return null;
   if(stops[0].p===null)stops[0].p=0;
   if(stops[stops.length-1].p===null)stops[stops.length-1].p=1;
   for(var k=1;k<stops.length-1;k++)if(stops[k].p===null)stops[k].p=k/(stops.length-1);
   return stops;
  }
  /* PREMULTIPLIED, because CSS is. Interpolating straight RGB toward a
     `transparent` stop drags the hue to black on the way out, which is how a
     violet glow fading to nothing was read as a black one fading to nothing. */
  function sampleStops(stops,t){
   if(t<=stops[0].p)return stops[0];
   var last=stops[stops.length-1];
   if(t>=last.p)return last;
   var i=0;
   while(i<stops.length-1&&t>stops[i+1].p)i++;
   var a=stops[i],b=stops[i+1],span=b.p-a.p,f=span>0?(t-a.p)/span:0;
   var al=a.a+(b.a-a.a)*f;
   if(al<=0)return {r:0,g:0,b:0,a:0};
   return {r:(a.r*a.a+(b.r*b.a-a.r*a.a)*f)/al,
    g:(a.g*a.a+(b.g*b.a-a.g*a.a)*f)/al,
    b:(a.b*a.a+(b.b*b.a-a.b*a.a)*f)/al,a:al};
  }
  function over(src,dst){
   var a=src.a+dst.a*(1-src.a);
   if(a<=0)return {r:0,g:0,b:0,a:0};
   return {r:(src.r*src.a+dst.r*dst.a*(1-src.a))/a,
    g:(src.g*src.a+dst.g*dst.a*(1-src.a))/a,
    b:(src.b*src.a+dst.b*dst.a*(1-src.a))/a,a:a};
  }
  function parseSky(){
   /* The MOST visible sky, not one that is exactly opacity 1. During the
      640ms cross-fade no layer is at 1, and requiring that made this return
      null for the whole transition -- which left the previous hour's colours
      stranded on the head until something else happened to call in. */
   var lit=null,best=-1,nodes=hero.querySelectorAll(".heroTimeGradient");
   for(var i=0;i<nodes.length;i++){
    var o=parseFloat(getComputedStyle(nodes[i]).opacity)||0;
    if(o>best){best=o;lit=nodes[i];}
   }
   if(!lit||best<=0)return null;
   var box=lit.getBoundingClientRect();
   if(!box.width||!box.height)return null;
   var layers=[],focus=null;
   splitTop(getComputedStyle(lit).backgroundImage).forEach(function(token){
    token=token.trim();
    var body=token.slice(token.indexOf("(")+1,token.lastIndexOf(")"));
    if(token.indexOf("radial-gradient(")===0){
     var parts=splitTop(body),head=parts[0].trim();
     var pos=head.match(/at\s+([\d.]+)%\s+([\d.]+)%/);
     var size=head.match(/^([\d.]+)(px|%)\s+([\d.]+)(px|%)/);
     var stops=parseStops(parts,1);
     if(!pos||!size||!stops)return;
     var layer={kind:"radial",fx:parseFloat(pos[1])/100,fy:parseFloat(pos[2])/100,
      rx:size[2]==="px"?parseFloat(size[1])/box.width:parseFloat(size[1])/100,
      ry:size[4]==="px"?parseFloat(size[3])/box.height:parseFloat(size[3])/100,
      stops:stops};
     layers.push(layer);
     if(!focus)focus=layer;
    }else if(token.indexOf("linear-gradient(")===0){
     var lparts=splitTop(body);
     /* Chrome omits `180deg` from the serialisation because it is the
        default, so a missing angle means top-to-bottom, not "unparseable". */
     var angle=lparts[0].trim().match(/^(-?[\d.]+)deg$/);
     var lstops=parseStops(lparts,angle?1:0);
     if(!lstops)return;
     layers.push({kind:"linear",angle:angle?parseFloat(angle[1]):180,stops:lstops});
    }
   });
   if(!layers.length)return null;
   return {layers:layers,w:box.width,h:box.height,
    /* WHERE THE LIGHT IS IS WHERE THE SKY SAYS IT IS. Every one of these
       gradients carries its own focal point, so that point IS the source --
       it does not have to be re-authored beside the gradient, and it cannot
       drift from it. Falls back to the CSS-authored position when a sky is
       something this cannot read. */
    fx:focus?focus.fx:null,fy:focus?focus.fy:null,
    base:parseColour(getComputedStyle(hero).backgroundColor)||{r:255,g:255,b:255,a:1},
    key:null};
  }
  /* The composited sky at a point, in the gradient box's own 0-1 coordinates.
     Layers paint first-listed on top, so they are composited last-to-first. */
  function skyAt(u,v){
   var out=env.base;
   for(var i=env.layers.length-1;i>=0;i--){
    var l=env.layers[i],c;
    if(l.kind==="radial"){
     c=sampleStops(l.stops,Math.sqrt(Math.pow((u-l.fx)/(l.rx||1),2)
                                    +Math.pow((v-l.fy)/(l.ry||1),2)));
    }else{
     var th=l.angle*Math.PI/180,dx=Math.sin(th),dy=-Math.cos(th);
     var len=Math.abs(env.w*dx)+Math.abs(env.h*dy);
     c=sampleStops(l.stops,.5+((u-.5)*env.w*dx+(v-.5)*env.h*dy)/len);
    }
    out=over(c,out);
   }
   return out;
  }
  function luminance(c){return (0.2126*c.r+0.7152*c.g+0.0722*c.b)/255;}
  var lightDir=0;
  function updateLight(fx,fy,frot){
   var m=metrics(),b=state.base;
   if(!b)return;
   if(!env)env=parseSky();
   var headX=b.left+b.width/2+state.x+fx;
   var headY=b.top+b.height/2+state.y+fy;
   /* ── THE SOURCE IS THE GRADIENT'S OWN FOCUS ──────────────────────────────
      --time-light-x/-y were authored per state, and five of the six were
      FICTION: they said sunrise came from 32% and sunset from 68%, while every
      sky in this scene is a radial gradient focused at 50% of its own lower
      edge. Nothing in the picture is brighter on one side, so the head was
      being lit from a place that did not exist -- and because proximity is
      measured to that place, the head could be dragged INTO the glow and read
      as further from the light. Measured at rest, the authored positions gave
      light vectors of (0.04,1.00) at pre-dawn, (-0.23,0.97) at sunrise and
      (0.98,0.21) at sunset: the rim swung from underneath to sideways to the
      opposite side between hours whose skies are identical in shape.
      The focus is read straight off the gradient now, so the source is
      wherever the sky is actually bright and the two can never disagree. The
      authored pair survives as the pre-script fallback, and is the answer for
      any future sky this parser cannot read. */
   var lx=m.heroW*(env&&env.fx!==null?env.fx:m.lightX);
   var ly=m.heroH*(env&&env.fy!==null?env.fy:m.lightY);
   var dx=lx-headX, dy=ly-headY;
   lightDir=Math.max(-1,Math.min(1,dx/(m.heroW*.5)));
   var len=Math.sqrt(dx*dx+dy*dy)||1;
   var dist=len/(m.heroW*.9);
   var prox=Math.max(0,Math.min(1,1-dist));
   hero.style.setProperty("--time-light-dir",lightDir.toFixed(3));
   hero.style.setProperty("--light-prox",prox.toFixed(3));
   /* ── THE VECTOR HAS TWO COMPONENTS AND BOTH OF THEM MEAN SOMETHING ───────
      The first pass resolved direction HORIZONTALLY: --time-light-dir is a
      signed left/right number and the rim it drove was an x-displacement. The
      vertical half of the vector was thrown away and a per-state
      --time-light-elev constant stood in for it, which could only ever describe
      how high a SUN was -- never where the light is relative to the head.
      That made the resting composition impossible to render. Every sky in this
      scene focuses on its own lower edge, and the head rests ABOVE that glow,
      so the truthful answer is uplight: the chin, the underside of the nose and
      the lower cheeks catch it and the brow falls away. The old model had no
      way to say that, so it said nothing.
      Normalised, so the rim's offset is a direction and not a distance --
      distance is --light-prox's job. --light-angle is the same vector turned
      into the CSS gradient convention (0deg points up, clockwise) and pointing
      AWAY from the source, so a mask written with it is opaque on the lit side
      and fades across the head. It is written here rather than derived in CSS
      because atan2() in calc() is too new to rely on and this loop already
      owns the arithmetic. */
   var ux=dx/len, uy=dy/len;
   hero.style.setProperty("--light-ux",ux.toFixed(3));
   hero.style.setProperty("--light-uy",uy.toFixed(3));
   /* THE RAMP LIVES IN A BOX THAT IS TURNED, AND THE LIGHT DOES NOT.
      --light-angle is a SCREEN direction, but the uplight's mask is painted in
      the portrait's own box, which hangs inside a wrapper rotated by the
      resting tilt plus the float. A gradient authored at A in that box renders
      at A + rotation on screen, so the ramp was arriving 13.8deg off the light
      it is supposed to be describing -- and rocking with the float on top. The
      head's own angle is subtracted here, which is the only place that knows
      both numbers in the same frame. */
   var headRot=state.rotate+(frot||0);
   hero.style.setProperty("--light-angle",
    (Math.atan2(-ux,uy)*180/Math.PI-headRot).toFixed(1)+"deg");
   if(!env)return;
   /* ── DIFFUSE AND SPECULAR ARE NOT THE SAME QUESTION ──────────────────────
      The face is shaded by IRRADIANCE: the light arriving from everywhere,
      dominated by whatever is large, bright and close. Here that is the sky
      immediately around the head, and it arrives blurred -- which is why the
      diffuse terms sample the composited sky AT the head and nothing else.
      The rim is the opposite: a grazing highlight is a reflection of the
      brightest thing in the environment, not an average of it. Sampling the
      sky behind the head for that is what left night with no edge at all --
      the sky there is genuinely near-black, but the thing lighting the head is
      the glow below it. So the rim's weight blends the local sky toward the
      SOURCE's own luminance by proximity: near the glow the edge knows about
      the glow, far away it falls back to whatever light is actually there. */
   var here=skyAt(headX/m.heroW,headY/m.heroH);
   if(env.key===null)env.key=luminance(skyAt(env.fx===null?.5:env.fx,
    Math.min(env.fy===null?1:env.fy,1)));
   /* JUDGEMENT OVER ACCURACY, in two deliberate places.
      SATURATION IS RESTRAINED: full colour bleed reads as a gel, and he has
      called this lighting harsh twice. The hue is pulled a long way toward its
      own grey, so it is present and never announced.
      THE RANGE IS COMPRESSED: a literal falloff makes the head vanish in a dim
      corner, so luminance keeps a floor and never reaches either end. */
   var lum=Math.max(0,Math.min(1,luminance(here)));
   var grey=(here.r+here.g+here.b)/3, sat=0.42;
   var er=Math.round(grey+(here.r-grey)*sat),
       eg=Math.round(grey+(here.g-grey)*sat),
       eb=Math.round(grey+(here.b-grey)*sat);
   hero.style.setProperty("--env-color","rgb("+er+","+eg+","+eb+")");
   hero.style.setProperty("--env-lum",(0.35+0.65*lum).toFixed(3));
   /* TWO LUMINANCES, BECAUSE TWO THINGS NEED DIFFERENT ANSWERS.
      --env-lum is COMPRESSED with a floor, and that floor is deliberate: it is
      what stops the head vanishing in a dim corner. But a floor is exactly
      wrong for the rim. Against a near-black sky the compressed value still
      reads .35, and an edge brighter than everything around it is the single
      most recognisable tell of a pasted-on cutout -- the "clear white line".
      --env-raw is uncompressed and unfloored, so an edge weighted by it can
      never out-shine the light that is supposed to be making it. */
   hero.style.setProperty("--env-raw",(lum+(env.key-lum)*prox).toFixed(3));
  }
  function floatFrame(ms){
   if(!state.floating){state.floatFrame=0;return;}
   state.lastFloatMs=ms;
   /* The float is a pure function of absolute time, so resuming after a pause
      would snap to wherever the sine had travelled meanwhile. The elapsed
      paused time is subtracted instead, which makes the motion continue from
      exactly the offset it was frozen at -- no jump when the cursor leaves. */
   writeFloat(ms-state.floatShift);
   /* The head has physically moved, so every cached measurement is stale and
      the chrome has to be re-derived from the new rect, in THIS frame. */
   state.stamp++;syncSelection();
   state.floatFrame=requestAnimationFrame(floatFrame);
  }
  function startFloat(){
   if(state.floating||prefersReducedMotion())return;
   if(state.holdAt){state.floatShift+=performance.now()-state.holdAt;state.holdAt=0;}
   state.floating=true;
   if(!state.floatFrame)state.floatFrame=requestAnimationFrame(floatFrame);
  }
  /* Paused for the duration of a pointer operation. Dragging an object that is
     also drifting under your cursor feels broken -- the object should go
     exactly where you put it -- so the float holds its current offset and
     resumes from the live clock on release, which avoids a jump back. */
  function stopFloat(){
   if(state.floating&&!state.holdAt)state.holdAt=performance.now();
   state.floating=false;
   if(state.floatFrame)cancelAnimationFrame(state.floatFrame);
   state.floatFrame=0;
  }
  /* ── A DRIFTING 44px TARGET IS A MISSED CLICK ────────────────────────────
     "Sometimes it doesn't let me resize or rotate" is not an intermittent
     failure, it is a moving target: you aim at a handle, it drifts, the press
     lands on the background and starts a drag of the head instead. Pausing on
     pointerDOWN was always too late -- by then the miss has happened. The float freezes when
     the pointer ARRIVES over the head or its frame, so anyone reaching for a
     handle gets a completely still target, and it keeps drifting for someone
     who is only reading. The grace period on the way out stops it stuttering
     when the cursor clips an edge in passing. */
  function holdFloat(){
   state.hovering=true;
   if(state.resumeTimer){clearTimeout(state.resumeTimer);state.resumeTimer=0;}
   stopFloat();
  }
  function releaseFloat(){
   state.hovering=false;
   if(state.resumeTimer)clearTimeout(state.resumeTimer);
   state.resumeTimer=setTimeout(function(){
    state.resumeTimer=0;
    if(!state.hovering&&state.pointerId===null)startFloat();
   },rootNumber("--hero-head-float-resume-delay",280));
  }
  function prefersReducedMotion(){
   return matchMedia("(prefers-reduced-motion: reduce)").matches
    ||document.documentElement.getAttribute("data-reduced-motion")==="reduce";
  }
  function reclamp(){
   state.stamp++;state.metrics=null;syncOrigin();captureBase();
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
  /* Capture phase, so the arbitration happens BEFORE the handle the browser
     happened to hit-test can claim the gesture. It only intervenes when the
     press landed inside more than one target and the nearest dot is not the
     one that would have won on paint order. */
  selection.addEventListener("pointerdown",function(e){
   if(state.pointerId!==null)return;
   var aimed=e.target.closest&&e.target.closest(".heroHeadHandle,.heroHeadRotate");
   if(!aimed)return;
   var nearest=chromeAt(e);
   if(nearest===aimed)return;
   e.stopPropagation();
   if(nearest)beginChrome(e,nearest);
   else beginMove(e);
  },true);
  selection.addEventListener("pointerdown",function(e){
   if(!e.target.closest(".heroHeadHandle")&&!e.target.closest(".heroHeadRotate"))beginMove(e);
  });
  [face,selection].forEach(function(node){
   node.addEventListener("pointermove",move);node.addEventListener("pointerup",end);
   node.addEventListener("pointercancel",end);node.addEventListener("lostpointercapture",end);
  });
  handles.forEach(function(handle){
   handle.addEventListener("pointerdown",function(event){
    beginResize(event,handle.getAttribute("data-corner"),handle);
   });
   handle.addEventListener("pointermove",resize);
   handle.addEventListener("pointerup",end);
   handle.addEventListener("pointercancel",end);
   handle.addEventListener("lostpointercapture",end);
  });
  if(rotator){
   rotator.addEventListener("pointerdown",function(event){beginRotate(event,rotator);});
   rotator.addEventListener("pointermove",turn);
   rotator.addEventListener("pointerup",end);
   rotator.addEventListener("pointercancel",end);
   rotator.addEventListener("lostpointercapture",end);
  }
  /* ── THE FRAME IS PERMANENT ──────────────────────────────────────────────
     There was a dismiss-on-outside-pointerdown handler here, because that is
     the convention every canvas UI shares. It is the wrong convention for this
     page. The frame is not a selection state a visitor discovers by clicking
     the head, it is the composition: the Hero is an artboard caught mid-edit,
     and that is the idea the header is built on. Dismissing it on the first
     click anywhere destroys that idea within seconds of arrival -- which is
     exactly what happens when someone lands and reaches for "View work".
     WHAT MAKES A PERMANENT FRAME READ AS DESIGN RATHER THAN AS A RENDERING
     BUG IS THAT THE HEAD MOVES. Static artwork inside a selection box looks
     broken; drifting artwork inside one looks like a tool. The float is
     therefore load-bearing twice over now, and nothing should quietly disable
     it.
     ESCAPE IS THE ONLY WAY OUT, and it stays. It costs nothing, it is
     invisible unless someone reaches for it, and a permanent decorative
     overlay should have some exit. It clears state.ambient, so the frame does
     not come back on its own for the rest of the session.
     THE CLICK IS STILL NOT SWALLOWED, and that guarantee matters MORE now, not
     less: with the frame on screen for the whole visit, the chrome must never
     be the reason a CTA does not fire. The selection surface sits below
     .heroCopy in z-order and does not preventDefault on anything outside its
     own handles. */
  document.addEventListener("keydown",onKeydown);
  addEventListener("heroheadstagechange",function(){state.stamp++;state.metrics=null;captureBase();syncSelection();});
  document.addEventListener("visibilitychange",function(){if(document.hidden)end();});
  addEventListener("blur",end);
  addEventListener("resize",reclamp);
  new ResizeObserver(reclamp).observe(hero);
  new ResizeObserver(reclamp).observe(content);
  peek.addEventListener("transitionrun",beginPeekTransition);
  peek.addEventListener("transitioncancel",endPeekTransition);
  peek.addEventListener("transitionend",endPeekTransition);
  /* THE HEAD STARTS AT ITS RESTING ANGLE, AND SOMETHING HAS TO WRITE IT.
     The stylesheet gives .heroHeadTransform the rest angle so the very first
     paint is already tilted with no script at all, but the transform state has
     to agree with the pixels or the clamp, the frame and the handles would all
     be reasoning about a level head that is not on screen. Written straight
     out rather than left to the first interaction. */
  state.rotate=restRotate();
  writeTransform();
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
  [face,selection].forEach(function(node){
   node.addEventListener("pointerenter",holdFloat);
   node.addEventListener("pointerleave",releaseFloat);
  });
  /* The light direction is authored per state, so a change of hour invalidates
     the cache. Observing the attribute costs nothing until it actually moves. */
  /* A time change is a 640ms cross-fade, not an instant, so the sky has to be
     re-read as it settles rather than once at the start. A few sampled
     re-reads cost nothing and guarantee the lighting ends on the new hour. */
  function relight(){
   state.metrics=null;env=null;
   updateLight(cssNumber(wrap,"--hero-head-float-x"),cssNumber(wrap,"--hero-head-float-y"),
    cssNumber(wrap,"--hero-head-float-rot"));
  }
  new MutationObserver(function(){
   [0,120,340,700].forEach(function(d){setTimeout(relight,d);});
   state.metrics=null;env=null;updateLight(cssNumber(wrap,"--hero-head-float-x"),cssNumber(wrap,"--hero-head-float-y"),
    cssNumber(wrap,"--hero-head-float-rot"));
  }).observe(hero,{attributes:true,attributeFilter:["data-time-state"]});
  ambient();startFloat();
  if(document.readyState==="complete")recapture();
  else addEventListener("load",function(){recapture();render();});
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
