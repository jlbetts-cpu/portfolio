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
  var state={selected:false,active:false,x:0,y:0,scale:1,rotate:0,pointerId:null,operation:null,start:null,
   capture:null,frame:0,peekFrame:0,peekAnimating:false,pendingAnchor:null,pendingClamp:false,
   stamp:0,geomStamp:-1,geom:null,floating:false,floatFrame:0,ambient:false,base:null,metrics:null,
   hovering:false,resumeTimer:0,floatShift:0,holdAt:0,lastFloatMs:0,loopReads:0,refocusing:false,
   frameInset:null,rendered:{x:0,y:0,scale:1,rotate:0},
   /* ── THE DRIFT IS THE PHYSICS. state.x/y IS THE ARRANGEMENT. ─────────────
      Two numbers describe the head's position now, and keeping them apart is
      what lets the boundary be soft without making the clamp soft.
        state.x/y  -- where the visitor has PUT the head. Always inside the
                      reachable region, committed the instant they let go,
                      and the only thing getState() and the clamp reason about.
        state.drift -- how far the head currently is from that, because it is
                      being stretched past a bound or is still flying to it.
                      Springs to zero and is never a place the head lives.
      This is the same shape as the float, which this file already documents as
      "additive and separate from the visitor's transform" -- and it is why
      rubber-banding could be added without touching a single clamp: the head
      goes past the edge, the ARRANGEMENT never does.
      vx/vy are the drift's own velocity in px/s, which is what carries the
      finger's speed across the seam between dragging and animating. */
   drift:{x:0,y:0,vx:0,vy:0},settleFrame:0,settleAt:0,settleResponse:0,
   /* A short position history, not the last delta. One pointermove is noise --
      a coalesced burst can put 60px in 2ms -- so the release speed is measured
      across a window of moves. */
   history:[],
   /* The arrival's live presentation values, sampled while it is running. */
   enterY:0,enterRot:0,enterFrame:0,enterUntil:0};
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

  /* ── EVERY DOM READ GOES THROUGH HERE, AND IT IS COUNTED ──────────────────
     The float loop's invariant is that it reads NOTHING from the DOM: it only
     writes, so a frame can never force a style recalc or a synchronous layout.
     That invariant was written down in a sixteen-line comment further down this
     file, and it was broken anyway -- an uncached rootNumber() came back inside
     place(), which runs once per handle per frame, so five getComputedStyle()
     calls on the ROOT of a 200KB document landed in every frame, each one
     immediately after that same root had been written to. Audited at 219
     root reads a second and roughly 300ms of style recalculation per second
     with nothing happening on the page, which is what "everything feels laggy
     just existing on the site" actually was.
     A COMMENT IS NOT AN INVARIANT. It had already failed once, so this is the
     enforcement rather than a stronger warning: every read is funnelled through
     two helpers that increment a counter, floatFrame() diffs the counter across
     its own frame, and the total lands on getState().loopReads. It is zero if
     and only if the loop read nothing, and the contract asserts that across a
     second of real floating -- so the next person to put a read back in breaks
     a test rather than a machine.
     The counter is two integer increments per read on paths that were already
     doing a style resolve; it cannot cost more than what it measures. */
  var domReads=0;
  function computedOf(node){domReads++;return getComputedStyle(node);}
  function rectOf(node){domReads++;return node.getBoundingClientRect();}
  function rootNumber(name,fallback){
   var value=parseFloat(computedOf(document.documentElement).getPropertyValue(name));
   return isFinite(value)?value:fallback;
  }
  /* The logical head as laid out, with no rotation applied. Every clamp and
     every piece of chrome is derived from this one rectangle. */
  function logicalRaw(){
   var f=rectOf(face);
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
  /* ── PUTTING AN !important BACK IS NOT THE SAME AS TAKING IT OFF ──────────
     Every measurement below neutralises the transform with `important`,
     because a keyframe outranks a plain inline style and the base rectangle
     everything downstream trusts would otherwise be captured mid-entrance.
     The restore then wrote the saved value back with no priority, on the
     assumption that setProperty(name,value) clears the flag. It does in
     Blink. IT DOES NOT IN WEBKIT: setting a custom property that is already
     declared !important leaves the priority alone, so the neutralising flag
     survives the restore and every later write -- writeTransform(),
     writeFloat(), the whole float loop -- loses to it in the cascade.
     Measured in WebKit at 390x844 on the shipped build: after a drag,
     --hero-head-x read `0px !important` inline while getState().x read 24,
     and the computed transform was matrix(1,0,0,1,-105.5,0) -- the head not
     merely stuck but LEVEL, never having received the resting -13.8deg
     either. So on iPhone the portrait never floated, never tilted and never
     followed a drag, while the selection frame -- which is written from
     state.x/y and not from these properties -- tracked the finger perfectly.
     That is exactly "the box moves but the head doesn't".
     removeProperty() drops the declaration and its priority together, in
     every engine, and there is no combination of arguments to setProperty()
     that is guaranteed to. It runs at init, on resize and on a stage change
     -- never inside a drag or a float frame -- so it costs nothing. */
  function restore(saved){
   saved.forEach(function(pair){
    wrap.style.removeProperty(pair[0]);
    if(pair[1])wrap.style.setProperty(pair[0],pair[1],pair[2]||"");
   });
  }
  function neutralise(names,valueOf){
   var saved=names.map(function(name){
    return [name,wrap.style.getPropertyValue(name),wrap.style.getPropertyPriority(name)];
   });
   names.forEach(function(name){wrap.style.setProperty(name,valueOf(name),"important");});
   return saved;
  }
  function withLevel(read){
   var saved=neutralise(LEVEL,function(){return "0deg";});
   var measured=read();
   restore(saved);
   return measured;
  }
  /* ── THE BASE IS LAYOUT. THE BREATHING IS NOT. ───────────────────────────
     state.base is the head's rectangle in the Hero's own coordinates, and
     everything durable is built on it: the frame is drawn from it and the
     clamp reasons about it. It is captured by reading the portrait's live
     rect -- and the portrait is never still. hero-engine gives it its own
     idle pose on a 125ms clock, written as a transform on #stage and
     .stagewrap, worth about 14px. So every capture rolled a different base
     depending on which instant it happened to run in.
     THAT TURNS A RESIZE INTO A PERMANENT NUDGE, and on a phone a scroll IS a
     resize: retracting the URL bar changes innerHeight, the Hero is 100dvh,
     the ResizeObserver fires, reclamp() re-captures. Measured at 390 wide,
     dragging the head and then cycling the viewport 760 -> 844 -> 760 -- one
     scroll down and back -- left the frame 10.8px from where it started and
     the clamp's own box 6 to 7px out, with state.x/y untouched at (-60,-150).
     It does not settle, because nothing brings it back; it accumulates, once
     per scroll gesture, which is "it doesn't actually stay in the same spot".
     The wrapper's own transform was already lifted off for this measurement
     for exactly this reason. The breathing is the same problem one level
     down, so it comes off too, and the base becomes what it always claimed to
     be: a function of layout alone, identical whenever it is taken.
     THE ENGINE OWNS THESE, so they are put back exactly, priority included,
     and it rewrites them within 125ms regardless. This runs at init, on
     resize and on a stage change -- never in a drag or a float frame. */
  var BODY=[hero.querySelector(".stagewrap"),hero.querySelector("#stage")]
   .filter(function(node){return node;});
  function stillBody(read){
   var saved=BODY.map(function(node){
    return [node,node.style.transform,node.style.getPropertyPriority("transform")];
   });
   BODY.forEach(function(node){node.style.setProperty("transform","none","important");});
   var measured=read();
   saved.forEach(function(pair){
    /* removeProperty first, for the reason the essay above gives: a
       priority-less setProperty does not lift the !important in WebKit. */
    pair[0].style.removeProperty("transform");
    if(pair[1])pair[0].style.setProperty("transform",pair[1],pair[2]||"");
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
   var h=rectOf(hero),r=boundsBox(geom());
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
   var h=rectOf(hero);
   var bar=document.querySelector(".jbStick .jbNav")||document.querySelector(".jbStick");
   var top=h.top;
   if(bar){
    var b=rectOf(bar);
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
   var h=rectOf(hero),u=usableRect();
   var hitNode=handles[0]||rotator;
   state.metrics={
    heroW:h.width,heroH:h.height,ceiling:u.top-h.top,
    air:rootNumber("--selection-air",0),
    hit:(hitNode?rectOf(hitNode).width:0)
      ||rootNumber("--selection-hit-size",44)||44,
    /* THE DOT'S OWN SIZE BELONGS HERE, WITH EVERY OTHER TOKEN THE LOOP NEEDS.
       It was being read inside place(), which runs once per handle per frame --
       five root reads a frame for a number that cannot change without a
       stylesheet change, and the single largest idle cost measured on the page.
       It is the same class of value as --selection-air two lines up and it
       is invalidated by the same reclamp(). */
    dot:rootNumber("--selection-handle-size",8),
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
    lightX:(parseFloat(computedOf(hero).getPropertyValue("--time-light-x"))||50)/100,
    lightY:(parseFloat(computedOf(hero).getPropertyValue("--time-light-y"))||84)/100,
    /* ── THE TWO SCALE BOUNDS, FOR THE REASON EVERY TOKEN ABOVE IS HERE ───────
       The float loop was fixed and the GESTURE path was not. Measured with
       getComputedStyle and getBoundingClientRect intercepted before any page
       script ran and tallied per phase: a real 30-move resize drag forced 125
       style resolutions, about 4.2 per pointermove, every one landing straight
       after that same frame had written an inline style. Attributed by stack,
       two of those four per move were scaleLimits() re-reading these two
       :root constants on every move of every resize.
       They are authored numbers in tokens.css that cannot change without a
       stylesheet change or a resize, which is exactly the class of value this
       cache already holds for --selection-air and --selection-handle-size, and
       reclamp() already invalidates it on resize and on both ResizeObservers.
       WHAT IS DELIBERATELY STILL READ LIVE, and it is not an oversight:
       reachable()'s --hero-head-safe-gap and --hero-head-min-visible. Caching
       those two as well was measured to take the remaining 2 reads per move,
       and it broke hero-head-transform-contract's second-owner-move assertion
       3 runs out of 3 (pristine 3/3 green) -- the head landed pinned at
       x=45.795 and a second drag could not shift it. The cached and live values
       were verified IDENTICAL in-page (gap 16, share .42), so the cause is not
       the arithmetic but the ORDER: routing reachable() through metrics() fills
       the cache at a different moment in the gesture. Not understood, so not
       shipped. */
    minScale:rootNumber("--hero-head-min-scale",.24),
    maxScale:rootNumber("--hero-head-max-scale",2.2),
    /* ── THE FEEL CONSTANTS BELONG IN THE CACHE FOR THE REASON THE TWO ABOVE DO
       rubberReach and rubberC are read on EVERY pointermove of every drag --
       the exact position scaleLimits() was measured in, at 2 root reads per
       move on a path that had just written an inline style. They are authored
       numbers that cannot change without a stylesheet change or a resize, and
       reclamp() already invalidates this cache on both. The settle constants
       are read once per release and are here only to keep the set together. */
    rubberShare:rootNumber("--hero-head-rubber-share",.25),
    rubberC:rootNumber("--hero-head-rubber-constant",.55),
    flingDecay:rootNumber("--hero-head-fling-decay",.99),
    flingCap:rootNumber("--hero-head-fling-cap",3200),
    /* Response, not duration -- a spring has no duration, its settle time
       emerges from the parameters. Authored in ms because that is the unit
       every other time value on this site is authored in, and divided here. */
    settleResponse:rootNumber("--hero-head-settle-response",400)/1000,
    returnResponse:rootNumber("--hero-head-return-response",300)/1000,
    settleDamping:rootNumber("--hero-head-settle-damping",1)
   };
   return state.metrics;
  }
  /* ── THE BOUNDARY RESISTS, IT DOES NOT FREEZE ────────────────────────────
     Jayden: "i dont like that you cant push the head past the boundary a
     little bit like its starting position -- if you pull it out and try to put
     it back you cant."
     A hard clamp reads as the page having stopped responding, because the
     finger keeps moving and nothing does. Real objects give, progressively,
     and then pull back. This is Apple's rubber-band from Designing Fluid
     Interfaces, unchanged:
        f(over) = over * dim * c / (dim + c * |over|)
     `dim` is the distance the give SATURATES at -- push forever and the head
     ends up exactly --hero-head-rubber-reach past the bound and no further --
     and `c` is Apple's 0.55. It is odd-symmetric, so the same function serves
     all four sides, and f(0) = 0 exactly, so a head inside its bounds is
     untouched by every line of this: the resting composition is inside on
     every axis, which is asserted in the contract. */
  function rubberband(over,dim,c){
   if(!over||!dim)return 0;
   return (over*dim*c)/(dim+c*Math.abs(over));
  }
  /* ── AND ITS INVERSE, WHICH IS NOT OPTIONAL ──────────────────────────────
     The band is applied to the RAW overshoot -- how far past the bound the
     finger is -- and what ends up on screen is the damped result. So a gesture
     that begins on a head which is already stretched cannot anchor to what is
     on screen: the next move would push that damped number through the band a
     second time and the head would jump INWARD at the press. Measured before
     this existed: grabbing 60ms into a band's return moved the head 17.6px on
     the first pixel of finger travel, at 1440.
     Solving g = over*dim*c/(dim + c|over|) for over gives
        over = g*dim / (c*(dim - |g|))   (signed by g)
     and |g| < dim always, because dim is exactly where the band saturates. At
     g = 0 it returns 0, so a head inside its bounds anchors to itself and none
     of this is reachable in the ordinary case. */
  function unband(g,dim,c){
   if(!g||!dim||!c)return 0;
   var span=dim-Math.abs(g);
   if(span<=0)return g;
   return g*dim/(c*span);
  }
  /* ── WHERE A THROW IS GOING, THE WAY APPLE ACTUALLY COMPUTES IT ──────────
     Not the textbook v^2/(2a). UIScrollView decelerates exponentially, and the
     endpoint of an exponential decay from v with rate d is (v/1000)*d/(1-d) --
     which is the form the Fluid Interfaces sample code ships and the one every
     good sheet and carousel on the web copies.
     THE RATE IS NOT APPLE'S 0.998, AND THAT IS DELIBERATE. 0.998 is a SCROLL
     rate: it projects half a second of travel, ~1500px for a hard flick, which
     is right for a list that is longer than the screen and absurd for an
     object you are placing on a 900px stage. This head has no snap points to
     choose between -- projection here decides one thing, whether the throw
     reaches the boundary -- so the rate is authored separately and tuned by
     eye against the only thing it can be judged against, which is the head. */
  function project(v,decay){
   if(!v||!decay||decay>=1)return 0;
   return (v/1000)*decay/(1-decay);
  }
  function reachable(box){
   var h=usableRect();
   var gap=parseFloat(computedOf(hero).getPropertyValue("--hero-head-safe-gap"))||0;
   var share=rootNumber("--hero-head-min-visible",.42);
   return {hero:h,
    x:Math.min(Math.max(box.width*share,gap),h.width),
    y:Math.min(Math.max(box.height*share,gap),h.height)};
  }
  function writeTransform(){
   wrap.style.setProperty("--hero-head-x",state.x+"px");
   wrap.style.setProperty("--hero-head-y",state.y+"px");
   /* Its own channel in the same translate, exactly like the float's: the
      arrangement and the physics are added, never merged, so a stretch past
      the edge can never become a position the visitor is held to. */
   wrap.style.setProperty("--hero-head-drift-x",state.drift.x.toFixed(2)+"px");
   wrap.style.setProperty("--hero-head-drift-y",state.drift.y.toFixed(2)+"px");
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
  /* Measured through stillBody() for the same reason captureBase() is: this
     comment already calls the ratio a layout constant, and it only is one if
     the idle pose is off the head while it is taken. */
  function syncOrigin(){
   var measured=withLevel(function(){
    return stillBody(function(){return {u:logicalRaw(),w:rectOf(wrap)};});
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
  /* ── A HANDLE BELONGS TO THE BOX, NOT TO THE VIEWPORT ────────────────────
     Jayden: "the resize box where the points aren't in the correct spot" --
     the frame drawn correctly around the head, and all five dots strung out in
     a level row along the bottom of the screen. Being LEVEL is the tell: the
     box was turned -13.8deg, and a rotated rectangle's corners cannot share a y
     unless something is overriding their y.
     Something was, twice over, and both of them moved the DRAWN dot:
       - turn() clamped each true corner into the Hero-clipped box before it was
         ever handed over, and every corner of a bounding box lies exactly ON an
         edge of that box, so this bit on all four at every angle;
       - axis() then clamped the 44px target into the box as well, which pushes
         the target 22px in from its own corner, and the stylesheet clamped the
         square back out by at most 18 -- a flat 4px of error on every corner at
         rest, at both widths, before the head has been touched.
     Push the head up and the two compound: the corners clip to y=0, the targets
     clamp to the bar's underside, and nw, ne and the rotator are all drawn at
     exactly y=64. Independently clamped points collapse onto their shared
     bound, which is a horizontal row.
     THE FRAME AND THE HEAD ARE ONE RIGID BODY AND THE HANDLES ARE PART OF IT.
     They are the box's own corners pushed through the box's own matrix; a
     screen-space correction applied afterwards silently breaks that, even in
     the cases where it happens to look right. So the dot is now drawn at the
     true corner, always, and its offset from that corner is exactly zero at
     every rotation and every scale -- asserted in
     tools/hero-head-transform-contract.py, because this frame never goes away
     and neither would the flaw.
     REACHABILITY IS STILL REAL, AND IT MOVES UP A LEVEL. It was never a
     statement about where a dot is drawn; it is a statement about whether the
     44px target can be pressed. So the INVISIBLE target still slides to stay
     inside the region a pointer can actually reach -- the Hero, minus the
     opaque bar across its top -- while the visible dot stays welded to the
     corner. The one thing that must never happen is the two coming apart far
     enough that the target no longer contains its own dot: that is the
     historical dead handle, a live 44px surface with nothing drawn in it and a
     square drawn 30px away that does nothing. So the threshold is exactly that:
     the target may slide until its own edge reaches the dot, and no further.
     That bound is not a tuned number -- it is algebraically the same statement
     as "the corner is still on the stage", because the target only ever moves
     by however far the corner is past the Hero's edge. When the corner travels
     off the stage, the handle stops existing rather than lying about itself:
     hidden and unpressable together, which is also what stops an off-stage dot
     painting over the Work section, since the Hero does not clip.
     THE THRESHOLD IS THE DOT'S CENTRE, NOT THE WHOLE SQUARE, AND THAT IS WHAT
     MAKES IT CHECKABLE. Half the target is the distance at which the target's
     own edge reaches the dot, and because the target only ever slides by
     however far the corner is past the Hero's, that distance is reached at
     exactly the moment the corner leaves -- so "off" can be restated from the
     Hero's rectangle alone, with no reference to how big the mark or its target
     happen to be, which is how the contract witnesses it independently.
     Demanding all 8px of the square fit instead would put a 4px fudge into that
     restatement and buy nothing measurable: it changes the answer only for a
     corner sitting within four pixels of the window's edge, and what a visitor
     aims at is the middle of the mark they can see. A square with two pixels of
     itself past the edge is the artboard cropping the selection, which is what
     happens to the frame's own outline in the same place. */
  function axis(point,lead,limit,hit){
   var half=hit/2;
   var min=half-lead,max=limit-lead-half;
   if(max<min)max=min=(min+max)/2;
   return Math.max(min,Math.min(max,point));
  }
  function place(node,point,lead){
   var m=metrics(),hit=m.hit,reach=hit/2;
   var cx=axis(point.x,lead.x,m.heroW,hit);
   var cy=axis(point.y,lead.y-m.ceiling,m.heroH-m.ceiling,hit);
   node.style.setProperty("--h-x",cx+"px");
   node.style.setProperty("--h-y",cy+"px");
   node.style.setProperty("--h-dx",(point.x-cx)+"px");
   node.style.setProperty("--h-dy",(point.y-cy)+"px");
   node.__dot={x:point.x,y:point.y};
   /* Compared against a cached flag rather than read back off the element: this
      runs once per handle per float frame, and the loop's invariant is that it
      writes and never reads. The attribute is only touched when the answer
      changes, which at rest is never. */
   var off=Math.max(Math.abs(point.x-cx),Math.abs(point.y-cy))>reach;
   if(node.__off!==off){
    node.__off=off;
    if(off)node.setAttribute("data-off","");else node.removeAttribute("data-off");
   }
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
   var origin=rectOf(selection),best=null,shortest=Infinity;
   chrome.forEach(function(node){
    var dot=node.__dot;
    /* A handle whose corner has left the stage is hidden and unpressable, so it
       must not win the arbitration either -- otherwise the nearest DRAWN dot
       could be one that is not drawn, and a press meant for the head or for a
       live corner would be swallowed by a ghost. */
    if(!dot||node.__off)return;
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
  /* THE DRIFT IS PART OF WHAT HAS TO COME OFF, for the same reason the float
     and the entrance are: it is live at exactly the moments a recapture can be
     provoked -- a resize during a settle -- and a base captured through a
     rubber-band would put the frame and the clamp permanently that far out. */
  var NEUTRAL=["--hero-head-x","--hero-head-y","--hero-head-scale","--hero-head-rotate",
   "--hero-head-float-x","--hero-head-float-y","--hero-head-float-rot",
   "--hero-head-drift-x","--hero-head-drift-y",
   "--hero-head-enter-y","--hero-head-enter-rot"];
  function captureBase(){
   var saved=neutralise(NEUTRAL,function(name){
    return name==="--hero-head-scale"?"1":/rot/.test(name)?"0deg":"0px";
   });
   stillBody(function(){
    var u=logicalRaw(),h=rectOf(hero);
    state.base={left:u.left-h.left,top:u.top-h.top,width:u.width,height:u.height};
   });
   restore(saved);
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
   /* ── THE FRAME IS WELDED TO THE HEAD, SO IT CARRIES EVERY CHANNEL THE HEAD
      CARRIES. It had the arrangement and the float and neither of the other
      two, and both omissions were visible.
      THE DRIFT is new and would have been the same bug on day one: a head
      stretched 50px past the boundary while its frame stayed at the bound is
      the artboard illusion coming apart at exactly the moment attention is on
      it.
      THE ARRIVAL was already shipping. --hero-head-enter-y is keyframed rather
      than written inline, so cssNumber() reads it as 0 and the frame drew the
      SETTLED pose for the whole greeting. Measured at 1440: the box sits 70px
      above the head for the 420ms before the head is even visible, and the
      chin is still hanging out of the bottom edge 60ms into the rise. What is
      on screen at 300ms is an empty selection box -- the exact "static artwork
      inside a selection box looks broken" this file's own comment warns about,
      inverted. Sampled from the live animation while it runs, so the frame
      draws the PRESENTATION value and the two arrive as one object. */
   var cx=b.left+b.width/2+state.x+state.drift.x+cssNumber(wrap,"--hero-head-float-x");
   var cy=b.top+b.height/2+state.y+state.drift.y+state.enterY
    +cssNumber(wrap,"--hero-head-float-y");
   return {cx:cx,cy:cy,
    w:Math.max(1,b.width*s+air*2),h:Math.max(1,b.height*s+air*2),
    ang:state.rotate+state.enterRot+cssNumber(wrap,"--hero-head-float-rot")};
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
   /* ── THE OUTLINE IS CROPPED BY THE STAGE. THE HANDLES ARE CROPPED BY REACH.
      Those are two different rectangles, and the box was carrying both. It
      stopped at the floating bar's lower edge so that no handle could park
      under an opaque nav -- but .heroHeadFrame is inset:0 of this box and
      clips its own line, so the whole band between the Hero's top edge and the
      bar's bottom was surrendered by the OUTLINE for a reason that only ever
      concerned the DOTS. The head is cropped by .heroCharacterPeek, which is
      inset:0 of the Hero, so head and frame vanished on different lines: drag
      the head up and its top edge is still painted beside the centred nav pill
      while the outline's top line, and the rotate dot with it, are simply
      gone. Measured at 1440x900 -- ceiling 60px, clamp lets the box reach
      y=-56 -- that is a 60px band of missing frame over a visible head. It is
      what "the resize box randomly clips and parts disappear" actually is:
      not random, conditional on how far up the head has been dragged.
      So the box is clipped to the HERO on all four sides now, which is exactly
      the head's own crop, and the reachability rule is left where it was
      already being enforced independently: place() clamps every hit target
      into [ceiling, heroH] through its lead/limit arguments, so a handle still
      cannot end up under the bar. Nothing here needs a second element or a
      per-frame layout write -- the frame element is unchanged and the loop
      still only writes compositor properties. */
   var r={left:Math.max(raw.left,0),top:Math.max(raw.top,0),
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
   /* The corner in the box's own local space, turned by the box's own angle and
      expressed relative to the box's origin. Nothing else happens to it: this
      is the whole of what makes a handle part of the rigid body, and every
      correction that used to be applied here is now either unnecessary (the
      dot rides its corner off-stage and is cropped with it) or applied to the
      invisible target alone, inside place(). */
   var turn=function(dx,dy){
    return {x:g.cx+dx*cos-dy*sin-r.left,y:g.cy+dx*sin+dy*cos-r.top};
   };
   var lead={x:r.left,y:r.top};
   handles.forEach(function(handle){
    var corner=handle.getAttribute("data-corner");
    place(handle,turn(corner.indexOf("w")>-1?-g.w/2:g.w/2,
     corner.indexOf("n")>-1?-g.h/2:g.h/2),lead);
   });
   if(rotator)place(rotator,turn(0,-g.h/2),lead);
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
  /* The settle already runs inside an animation frame, so scheduling another
     one would paint its physics a frame late -- 16ms of the head trailing its
     own simulation, which is visible at the speeds a flick reaches. Any frame
     already queued is dropped rather than left to fire on stale state. */
  function renderNow(){
   if(state.frame){cancelAnimationFrame(state.frame);state.frame=0;}
   flushRender();
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
   var hr=rectOf(hero),u=usableRect();
   var top=u.top-hr.top,bottom=u.bottom-hr.top,right=hr.width;
   var box=transformedBox(x,y),need=reachable(box);
   var minLeft=need.x-box.width,maxLeft=right-need.x;
   var minTop=top+need.y-box.height,maxTop=bottom-need.y;
   var wantLeft=Math.min(Math.max(box.left,minLeft),maxLeft);
   var wantTop=Math.min(Math.max(box.top,minTop),maxTop);
   return {x:x+(wantLeft-box.left),y:y+(wantTop-box.top)};
  }
  /* ── THE FRAME HAS TWO LOOKS AND THREE STATES, AND THEY ARE NOT THE SAME AXIS
     Jayden: "I know I said I want the resize block to be there all the time and
     I still do, but I think when you click off of it it should have a very
     subtle version of it, like that the user can tell it's not activated -- in
     greyscale."
     So PRESENT and ACTIVE are two different questions:
       - state.selected -- is the frame on screen at all. The artboard idea
         lives here, and it stays true for the whole visit; Escape is the only
         thing that takes it away.
       - state.active   -- is it the live control. True while the head is
         engaged, false the moment attention goes somewhere else on the page.
     Collapsing them is what the old code did, and it is why "click off it"
     had no answer that was not "destroy the composition". They are written as
     one attribute, data-selection, so the stylesheet can say what each look is
     without ever having to reason about hidden.
     WHY NOT JUST DROP state.selected ON AN OUTSIDE CLICK: because the frame
     would go, and a permanent frame is the whole conceit of the header. And
     because the contracts assert getState().selected survives a tap elsewhere,
     which is that requirement written down. The idle look is the answer to
     both. */
  function paint(){
   selection.setAttribute("data-selection",state.active?"active":"idle");
   chrome.forEach(function(node){node.tabIndex=state.active?0:-1;});
  }
  function select(){
   var opening=!state.selected||!state.active;
   state.selected=true;state.active=true;
   face.setAttribute("aria-pressed","true");selection.hidden=false;
   paint();syncSelection();
   if(opening&&document.activeElement!==face)face.focus({preventScroll:true});
  }
  /* THE ONE-SHOT THAT STOPS DISMISS AND RE-ENTRY CHASING EACH OTHER.
     deselect({restoreFocus:true}) puts focus back on the portrait so a keyboard
     user is not dropped at the top of the document -- and focusing the portrait
     is now itself a way IN (see the focus binding below). Without a guard,
     Escape would hide the frame and immediately reopen it, forever. The flag is
     cleared synchronously after the focus() call, so it can never leak into a
     later, genuine focus. */
  function deselect(options){
   end();state.selected=false;state.active=false;
   face.setAttribute("aria-pressed","false");selection.hidden=true;
   paint();
   if(options&&options.restoreFocus){
    state.refocusing=true;
    face.focus({preventScroll:true});
    state.refocusing=false;
   }
  }
  /* ── VELOCITY IS MEASURED ACROSS A WINDOW, NEVER OFF THE LAST MOVE ───────
     The final pointermove is the noisiest sample there is: browsers coalesce
     moves to the frame clock, so the last one can carry 60px of travel or 2px
     of jitter depending on where the release landed in the frame, and dividing
     either by a 2ms gap invents a speed nothing on screen was doing. Apple
     tracks a short history for exactly this reason and so does every velocity
     tracker worth copying. The window is the last --hero-head-velocity-window
     of samples; below two samples or the minimum span there is no evidence of
     a speed and the honest answer is zero, which is also what a finger that
     came to rest before lifting means. */
  function sample(ms,x,y){
   var h=state.history;
   h.push({t:ms,x:x,y:y});
   while(h.length>2&&ms-h[0].t>VELOCITY_WINDOW)h.shift();
  }
  var VELOCITY_WINDOW=110,VELOCITY_MIN_SPAN=24,VELOCITY_STALE=90;
  function releaseVelocity(){
   var h=state.history,m=metrics();
   if(h.length<2)return {x:0,y:0};
   var last=h[h.length-1],first=h[0];
   var span=last.t-first.t;
   if(span<VELOCITY_MIN_SPAN)return {x:0,y:0};
   /* A finger that stopped and then lifted is a placement, not a throw. */
   if(performance.now()-last.t>VELOCITY_STALE)return {x:0,y:0};
   var vx=(last.x-first.x)/span*1000,vy=(last.y-first.y)/span*1000;
   var speed=Math.sqrt(vx*vx+vy*vy);
   if(speed>m.flingCap){vx*=m.flingCap/speed;vy*=m.flingCap/speed;}
   return {x:vx,y:vy};
  }
  function beginMove(event){
   if(state.pointerId!==null)return;
   if(event.button!==undefined&&event.button!==0)return;
   face.setAttribute("data-pointer-focus","");
   select();event.preventDefault();stopFloat();
   /* ── GRABBING SOMETHING IN FLIGHT MUST NOT MOVE IT ───────────────────────
      The single most important principle in the reference: an animation is
      interruptible, and the new gesture starts from the PRESENTATION value,
      never from the target. The presentation value here is the arrangement
      plus whatever the drift has not yet given back, so that is what the drag
      is anchored to. Nothing is committed at the press -- the first
      pointermove re-derives the arrangement and the drift together from this
      one number -- so the head does not shift by so much as a pixel between
      the finger landing and the finger moving.
      The spring is stopped rather than allowed to fight the finger, and its
      velocity is dropped on purpose: from here the finger IS the velocity. */
   stopSettle();
   state.pointerId=event.pointerId;state.operation="move";
   /* THE ANCHOR IS THE RAW POSITION, NOT THE PAINTED ONE, and the difference
      is only ever non-zero while the head is stretched past a bound -- see
      unband(). The painted position is the band's OUTPUT; anchoring to it and
      then running the band again would damp it twice. restoreX/Y is the
      pre-gesture pose kept verbatim for pointercancel, which must put back
      exactly what was there rather than anything re-derived. */
   var m=metrics();
   var painted={x:state.x+state.drift.x,y:state.y+state.drift.y};
   var seated=clampMove(painted.x,painted.y),seatedBox=transformedBox(seated.x,seated.y);
   state.start={clientX:event.clientX,clientY:event.clientY,
    x:seated.x+unband(painted.x-seated.x,seatedBox.width*m.rubberShare,m.rubberC),
    y:seated.y+unband(painted.y-seated.y,seatedBox.height*m.rubberShare,m.rubberC),
    restoreX:state.x,restoreY:state.y};
   state.history=[];
   sample(event.timeStamp||performance.now(),painted.x,painted.y);
   state.capture=event.currentTarget;state.capture.setPointerCapture(event.pointerId);
  }
  function move(event){
   if(state.operation!=="move"||event.pointerId!==state.pointerId)return;
   var rawX=state.start.x+event.clientX-state.start.clientX;
   var rawY=state.start.y+event.clientY-state.start.clientY;
   /* THE CLAMP IS UNCHANGED AND STILL ABSOLUTE. What the visitor is held to is
      still exactly what clampMove() says; the overshoot it refused is handed
      to the rubber band and lives in the drift until they let go. Inside the
      bounds the subtraction is zero on both axes and this is the old code. */
   var next=clampMove(rawX,rawY),m=metrics();
   state.x=next.x;state.y=next.y;
   /* PER AXIS, INDEPENDENTLY, AND AGAINST THE HEAD'S OWN EXTENT ON THAT AXIS.
      A single resistance on the 2D distance couples the two: push hard into
      the left edge and vertical tracking would go soft with it, which is the
      same reason the reference decomposes 2D motion into independent X and Y
      springs. The dimension is the head's turned box, so the give follows the
      visitor's own scale and rotation with no second rule -- arithmetic on
      state.base, not a measurement, so this stays free on a per-move path. */
   var box=transformedBox(next.x,next.y);
   state.drift.x=rubberband(rawX-next.x,box.width*m.rubberShare,m.rubberC);
   state.drift.y=rubberband(rawY-next.y,box.height*m.rubberShare,m.rubberC);
   state.drift.vx=0;state.drift.vy=0;
   sample(event.timeStamp||performance.now(),state.x+state.drift.x,state.y+state.drift.y);
   render();
  }
  /* ── THE SPRING, AND WHY IT IS A SPRING ──────────────────────────────────
     A fixed-duration curve cannot be interrupted usefully: re-target it and
     the value jumps, grab it and there is nothing to hand the finger. A spring
     has no duration -- its settle time emerges from response and damping --
     and it carries a velocity, which is the whole of what makes the seam
     between dragging and animating disappear.
     Parameterised the way Apple parameterises it, in DAMPING RATIO and
     RESPONSE rather than mass/stiffness/damping, because those two are the
     ones a designer can reason about. Damping 1.0 is critically damped: it
     reaches the target as fast as it can without ever crossing it. That is the
     shipped value for Move/reposition in the reference's own table, and it is
     the right one twice over here -- a bounce at the end of a rubber-band
     return would be a second event where the physics says there is one, and a
     bounce at the end of a throw would put the head somewhere the visitor did
     not aim.
     A CRITICALLY DAMPED SPRING STILL OVERSHOOTS ITS STARTING POINT when it is
     handed velocity pointing away from the target, and never crosses the
     target doing it. That is exactly the behaviour a stretched band has, and
     it is where the flick's momentum actually goes.
     Semi-implicit Euler, sub-stepped to 240Hz. Explicit integration of a stiff
     spring at a 60Hz step is unstable at the responses this uses; sub-stepping
     costs four multiplies a frame and removes the failure mode entirely. */
  var SUBSTEP=1/240;
  function settleStep(ms){
   if(!state.settleFrame)return;
   var m=metrics(),dt=(ms-state.settleAt)/1000;
   state.settleAt=ms;
   /* A backgrounded tab hands back one enormous frame. Capping the step keeps
      the integration honest rather than teleporting the head. */
   if(dt>.064)dt=.064;
   if(dt>0){
    var w=2*Math.PI/state.settleResponse,z=m.settleDamping;
    var steps=Math.max(1,Math.ceil(dt/SUBSTEP)),h=dt/steps,d=state.drift,i;
    for(i=0;i<steps;i++){
     d.vx+=(-w*w*d.x-2*z*w*d.vx)*h;d.x+=d.vx*h;
     d.vy+=(-w*w*d.y-2*z*w*d.vy)*h;d.y+=d.vy*h;
    }
    /* Sub-pixel and slow is arrived. Snapping both channels together is what
       lets the loop stop rather than asymptote forever at 60fps. */
    if(Math.abs(d.x)<.05&&Math.abs(d.vx)<4){d.x=0;d.vx=0;}
    if(Math.abs(d.y)<.05&&Math.abs(d.vy)<4){d.y=0;d.vy=0;}
   }
   renderNow();
   if(!state.drift.x&&!state.drift.y&&!state.drift.vx&&!state.drift.vy){
    state.settleFrame=0;return;
   }
   state.settleFrame=requestAnimationFrame(settleStep);
  }
  function startSettle(response){
   state.settleResponse=Math.max(.08,response);
   state.settleAt=performance.now();
   if(!state.settleFrame)state.settleFrame=requestAnimationFrame(settleStep);
  }
  function stopSettle(){
   if(state.settleFrame)cancelAnimationFrame(state.settleFrame);
   state.settleFrame=0;state.drift.vx=0;state.drift.vy=0;
  }
  function clearDrift(){
   stopSettle();state.drift.x=0;state.drift.y=0;
  }
  /* ── LETTING GO ──────────────────────────────────────────────────────────
     Three things happen at once and they have to happen in this order.
     WHERE IT IS GOING is decided first, from the projection, and it is decided
     against the SAME clamp every other path uses -- so a throw can no more
     leave the reachable region than a drag can. When the projection lands
     outside, the target is the bound, which is the one snap point this object
     has; the reference's projection exists to choose a target, and here there
     is only ever one to choose.
     THE ARRANGEMENT IS COMMITTED IMMEDIATELY. state.x/y become the resting
     place at the instant of release, not when the motion finishes, so
     everything that reads the arrangement -- the clamp, getState(), the
     contracts -- sees a settled answer straight away and the head being still
     in flight is a fact about the pixels only.
     THE DRIFT ABSORBS THE DIFFERENCE, and takes the finger's velocity with it,
     which is the handoff: the first frame of the animation moves at exactly
     the speed the last frame of the gesture did. Without it there is a visible
     seam, and the seam is the thing that separates fluid from fine.
     MOMENTUM IS OFF UNDER REDUCED MOTION AND THE RUBBER BAND IS NOT. They are
     not the same kind of motion. The band only ever moves while a finger is
     moving it and returns a bounded distance to a place the object already
     was -- that is feedback, and the guidance is explicit that reduced motion
     means a gentler equivalent rather than none. A throw is autonomous travel
     of arbitrary distance that nobody asked for frame by frame, which is
     precisely what the setting is about; the reduced equivalent of "the flick
     throws it" is "the flick puts it where you let go", and the return still
     happens, critically damped, with no overshoot in either mode. */
  function releaseMove(thrown){
   var m=metrics();
   var px=state.x+state.drift.x,py=state.y+state.drift.y;
   var stretched=state.drift.x||state.drift.y;
   var v=thrown&&!prefersReducedMotion()?releaseVelocity():{x:0,y:0};
   var target=clampMove(px+project(v.x,m.flingDecay),py+project(v.y,m.flingDecay));
   state.x=target.x;state.y=target.y;
   state.drift.x=px-target.x;state.drift.y=py-target.y;
   state.drift.vx=v.x;state.drift.vy=v.y;
   state.history=[];
   if(!state.drift.x&&!state.drift.y&&!state.drift.vx&&!state.drift.vy){
    stopSettle();render();return;
   }
   /* Coming back from past the edge is the snappier rung: the band is under
      tension and a slow release reads as the head being reluctant. A throw
      that is still travelling gets the longer one, which is the reference's
      own move/reposition response. */
   startSettle(stretched?m.returnResponse:m.settleResponse);
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
   var m=metrics();
   return {min:m.minScale,max:m.maxScale};
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
  /* ── A CANCELLED GESTURE IS NOT A SMALL GESTURE ──────────────────────────
     touch-action:pan-y (controls.css) hands a vertical swipe back to the page,
     which is what fixes "the head resizes on scroll on mobile". But the
     browser only reaches that verdict after it has already delivered the
     opening pointermoves, so the head kept whatever those moves did to it and
     a scroll left a permanent mark behind. Measured through Chromium's touch
     gesture pipeline with pan-y in place: an upward scroll from the head's
     centre still nudged it -23.1px, and one from the NW handle still grew it
     +0.1158 of scale, on top of the page correctly scrolling 256px. That
     residue is the reported bug in miniature, and shipping it would have made
     the fix look like a tuning change rather than a fix.
     pointercancel is the browser stating outright that the gesture was never
     the head's, so the only honest answer is to put back exactly what
     state.start already recorded at the press -- it holds the pre-gesture
     x/y for a move, x/y/scale for a resize and the angle for a turn, so this
     is a restore, not a re-derivation.
     ONLY pointercancel REVERTS. pointerup, deselect(), blur and
     visibilitychange all still commit through end(), because those gestures
     WERE the head's and Jayden's placement has to survive them. */
  function cancel(event){
   if(state.pointerId===null)return;
   if(event&&event.pointerId!==undefined&&event.pointerId!==state.pointerId)return;
   var start=state.start,operation=state.operation;
   if(start){
    /* THE DRIFT GOES BACK TOO, AND IT SNAPS. A cancelled gesture was never the
       head's, so the only honest answer is the pre-gesture pose exactly --
       springing the band home would leave a visible flourish behind a scroll
       that the head is supposed to have taken no part in. A cancel arrives in
       the opening moves, before the finger has reached a bound, so there is in
       practice nothing to snap: measured through the touch pipeline, the drift
       at pointercancel is 0 on every pan-y scroll. */
    clearDrift();
    /* restoreX/Y, not start.x/y: start is the RAW anchor the band is applied
       to, which is deliberately outside the bounds while the head is stretched.
       The pose to put back is the one that was there, kept verbatim. */
    if(operation==="move"){state.x=start.restoreX;state.y=start.restoreY;}
    else if(operation==="resize"){
     state.x=start.x;state.y=start.y;state.scale=start.scale;state.pendingAnchor=null;
    }
    else if(operation==="rotate"){state.rotate=start.rotate;state.pendingClamp=false;}
   }
   /* The operation is dropped BEFORE end() so the release path does not run:
      a cancelled move has nothing to settle and nothing to throw, and putting
      it through releaseMove() would re-clamp a pose this function has just
      restored verbatim. */
   state.operation=null;
   end(event);
   render();
  }
  function end(event){
   if(state.pointerId!==null&&event&&event.pointerId!==undefined&&event.pointerId!==state.pointerId)return;
   var capture=state.capture,pointerId=state.pointerId,operation=state.operation;
   state.pointerId=null;state.operation=null;state.start=null;state.capture=null;
   if(capture&&pointerId!==null&&capture.hasPointerCapture(pointerId))capture.releasePointerCapture(pointerId);
   /* ── ONLY A REAL LIFT THROWS ─────────────────────────────────────────────
      end() is four events wearing one name: pointerup, lostpointercapture,
      window blur and a tab going hidden. Only the first is the visitor letting
      go of something, and only the first has a velocity that means anything --
      a blur mid-drag has a history that stopped an unknown time ago and would
      hand a stale speed to the spring. The others still settle, because a head
      left stretched past its bound by a tab switch must not stay there; they
      just settle from rest.
      Anything that was NOT a move -- a resize, a turn -- has no drift to give
      back and no momentum to carry, so it is left exactly as it was. */
   if(operation==="move")releaseMove(!!(event&&event.type==="pointerup"));
   releaseFloat();
  }
  /* HOME IS NOT 0 ON EVERY AXIS. x, y and scale rest at their neutral values
     because the whole resting composition is expressed in LAYOUT. The angle
     cannot be -- there is no layout property that turns a box -- so rest is
     --hero-head-rest-rotate and this returns to it. Clearing the angle to 0
     here would put the head somewhere it has never been. */
  function reset(){
   /* Home is a statement, not a journey: anything still in flight is dropped
      rather than allowed to keep pulling against the pose being restored. */
   clearDrift();
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
  var env=null,skyShiftUntil=0;
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
  /* ── A CROSS-FADE IS TWO SKIES, AND THE LIGHT COMES FROM BOTH ──────────────
     This used to take the MOST VISIBLE layer and read only that one. It was
     already an improvement on requiring opacity===1, which returned null for
     the whole 640ms and stranded the previous hour's colours on the head -- but
     it still means the sampler SWITCHES which sky it is reading, in one frame,
     at the moment the incoming layer overtakes the outgoing one. Measured
     sunset -> night: the blue channel of the shading colour travelled 62% of
     its journey BACKWARDS before returning, because halfway through it stopped
     describing sunset and started describing night with nothing in between.
     Every layer that is on screen is parsed now, and the sample is the same
     weighted composite the eye is actually looking at. The expensive half --
     tokenising the gradients -- is cached per element and survives the whole
     transition; only the opacities are re-read, and only while one is running. */
  function parseLayers(node,box){
   var layers=[],focus=null;
   splitTop(computedOf(node).backgroundImage).forEach(function(token){
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
   return layers.length?{layers:layers,fx:focus?focus.fx:null,fy:focus?focus.fy:null}:null;
  }
  function parseSky(){
   var nodes=hero.querySelectorAll(".heroTimeGradient");
   if(!nodes.length)return null;
   var box=rectOf(nodes[0]);
   if(!box.width||!box.height)return null;
   var skies=[];
   for(var i=0;i<nodes.length;i++){
    /* PAINT ORDER, NOT DOM ORDER. hero-time.js lifts the arriving sky above
       the one it is replacing, so the z-index has to be honoured or the two
       are composited the wrong way round for the length of every change. */
    var style=computedOf(nodes[i]);
    var parsed=parseLayers(nodes[i],box);
    if(!parsed)continue;
    parsed.node=nodes[i];
    parsed.order=(parseInt(style.zIndex,10)||0)*100+i;
    parsed.weight=parseFloat(style.opacity)||0;
    skies.push(parsed);
   }
   if(!skies.length)return null;
   skies.sort(function(a,b){return a.order-b.order;});
   return {skies:skies,w:box.width,h:box.height,
    base:parseColour(computedOf(hero).backgroundColor)||{r:255,g:255,b:255,a:1},
    fx:null,fy:null,key:null};
  }
  /* Only while a sky is actually changing. Outside that window every weight is
     0 or 1 and re-reading them per frame would put a style recalc back into a
     loop that was deliberately reduced to writes. */
  function refreshSkyWeights(){
   var fx=0,fy=0,total=0;
   for(var i=0;i<env.skies.length;i++){
    var sky=env.skies[i];
    sky.weight=parseFloat(computedOf(sky.node).opacity)||0;
    if(sky.fx===null)continue;
    fx+=sky.fx*sky.weight;fy+=sky.fy*sky.weight;total+=sky.weight;
   }
   /* The focal point is blended too, so the source does not jump between two
      skies that focus a couple of percent apart. */
   env.fx=total>0?fx/total:null;
   env.fy=total>0?fy/total:null;
   env.key=null;
  }
  /* The composited sky at a point, in the gradient box's own 0-1 coordinates.
     Within one sky, layers paint first-listed on top, so they are composited
     last-to-first; the skies themselves are composited in paint order, each
     scaled by how visible it currently is. */
  function skyAt(u,v){
   var out=env.base;
   for(var s=0;s<env.skies.length;s++){
    var sky=env.skies[s];
    if(sky.weight<=0)continue;
    var acc={r:0,g:0,b:0,a:0};
    for(var i=sky.layers.length-1;i>=0;i--){
     var l=sky.layers[i],c;
     if(l.kind==="radial"){
      c=sampleStops(l.stops,Math.sqrt(Math.pow((u-l.fx)/(l.rx||1),2)
                                     +Math.pow((v-l.fy)/(l.ry||1),2)));
     }else{
      var th=l.angle*Math.PI/180,dx=Math.sin(th),dy=-Math.cos(th);
      var len=Math.abs(env.w*dx)+Math.abs(env.h*dy);
      c=sampleStops(l.stops,.5+((u-.5)*env.w*dx+(v-.5)*env.h*dy)/len);
     }
     acc=over(c,acc);
    }
    acc.a*=sky.weight;
    out=over(acc,out);
   }
   return out;
  }
  function luminance(c){return (0.2126*c.r+0.7152*c.g+0.0722*c.b)/255;}
  var lightDir=0;
  function updateLight(fx,fy,frot){
   var m=metrics(),b=state.base;
   if(!b)return;
   if(!env){env=parseSky();if(env)refreshSkyWeights();}
   /* ── THE SKY IS ONLY MOVING FOR 640ms, SO ONLY LOOK FOR 640ms ─────────────
      While an hour is changing, the two skies' opacities change every frame and
      the sampled light has to follow them or it steps. Outside that window
      every weight is 0 or 1 and nothing about them can change, so the read is
      skipped entirely and the loop goes back to writing only. This replaced a
      row of setTimeout(relight) calls at 0/120/340/700ms, which was the same
      idea sampled four times -- and four samples across a cross-fade is what a
      step looks like. */
   if(env&&skyShiftUntil>0){
    if(performance.now()<=skyShiftUntil)refreshSkyWeights();
    else{skyShiftUntil=0;refreshSkyWeights();}
   }
   /* The drift is where the head IS, and the light is a function of where the
      head is -- so a head stretched past the edge is lit from the edge it has
      been stretched to, not from the position it is about to return to. */
   var headX=b.left+b.width/2+state.x+state.drift.x+fx;
   var headY=b.top+b.height/2+state.y+state.drift.y+fy;
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
   /* THE INVARIANT, MEASURED RATHER THAN ASSERTED. Everything below this line
      must write and never read; loopReads is the running total of DOM reads
      that happened inside a float frame, so it is 0 for a healthy page and
      grows by exactly the number of reads somebody put back. getState() exposes
      it and the contract fails on any growth at rest. */
   var readsBefore=domReads;
   /* The float is a pure function of absolute time, so resuming after a pause
      would snap to wherever the sine had travelled meanwhile. The elapsed
      paused time is subtracted instead, which makes the motion continue from
      exactly the offset it was frozen at -- no jump when the cursor leaves. */
   writeFloat(ms-state.floatShift);
   /* The head has physically moved, so every cached measurement is stale and
      the chrome has to be re-derived from the new rect, in THIS frame. */
   state.stamp++;syncSelection();
   state.loopReads+=domReads-readsBefore;
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
  /* ── THE ARRIVAL IS AN ANIMATION SOMEBODY ELSE OWNS, SO IT IS SAMPLED ────
     hero-time.css drives the greeting with a keyframe on --hero-head-enter-y
     and --hero-head-enter-rot, and it should stay there: it is authored motion
     with a hand-tuned spring curve, it runs before this module has been asked
     for anything, and it must survive with no script at all. What this module
     cannot do is pretend it is not happening -- the frame is welded to the
     head and for the first second of every visit it was not.
     SO THE PRESENTATION VALUE IS READ, WHICH IS THE WHOLE POINT. The reference
     is unambiguous that an interrupted or tracked animation must be driven
     from the live on-screen value rather than from where it is heading; the
     live value is exactly what getComputedStyle returns here, because both
     properties are registered with @property and therefore resolve.
     IT IS ITS OWN LOOP, NOT A LINE IN THE FLOAT LOOP, and that is deliberate.
     The float loop's invariant is that it reads nothing from the DOM, measured
     and asserted by contract; putting two getComputedStyle calls a frame into
     it would break the one thing standing between this page and the 219
     root-reads-a-second it used to do. This loop lives for the length of the
     greeting -- about a second, once, at page load -- and then stops for good.
     THE WINDOW HAS TO COVER THE DELAY. The animation exists during its own
     420ms delay with fill:both, so getAnimations() reports it running and the
     box sits with the head where the head actually is, 64px low, instead of
     waiting alone at the finish line. If the stylesheet never arms it -- no
     theme-ready, reduced motion -- the arming window lapses and this stops
     after a frame having changed nothing. */
  function arrivalRunning(){
   if(!wrap.getAnimations)return false;
   var running=wrap.getAnimations();
   for(var i=0;i<running.length;i++){
    if(running[i].playState!=="finished"&&running[i].playState!=="idle")return true;
   }
   return false;
  }
  function sampleArrival(){
   var live=computedOf(wrap);
   state.enterY=parseFloat(live.getPropertyValue("--hero-head-enter-y"))||0;
   state.enterRot=parseFloat(live.getPropertyValue("--hero-head-enter-rot"))||0;
  }
  function arrivalFrame(){
   sampleArrival();
   state.stamp++;syncSelection();
   if(arrivalRunning()||performance.now()<state.enterUntil){
    state.enterFrame=requestAnimationFrame(arrivalFrame);
    return;
   }
   /* Landed. The offset resolves to zero by construction, but it is written
      rather than assumed so a cancelled animation cannot strand the frame. */
   state.enterFrame=0;state.enterY=0;state.enterRot=0;
   state.stamp++;syncSelection();
  }
  /* SAMPLED ONCE, SYNCHRONOUSLY, BEFORE THE LOOP IS SCHEDULED. Waiting for the
     first animation frame leaves a window in which the frame has already been
     drawn -- ambient() syncs it during init -- while enterY is still zero and
     the head is 64px below it. That window is one frame in the common case and
     tens of milliseconds on a cold load with images decoding, and it produced
     exactly the 66px separation this sampler exists to remove, intermittently,
     which is the worst way for it to appear. Reading here costs one
     getComputedStyle at init and closes it outright. */
  function watchArrival(){
   if(state.enterFrame||prefersReducedMotion())return;
   state.enterUntil=performance.now()
    +rootNumber("--hero-head-enter-delay",420)+120;
   sampleArrival();
   state.enterFrame=requestAnimationFrame(arrivalFrame);
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
   /* `drift` is the OTHER half of where the head is: x/y is the arrangement,
      drift is how far the physics currently has it from that. It is exposed so
      a test can witness the rubber band and the throw -- which are invisible
      in x/y by design, because the arrangement is committed the moment the
      visitor lets go and never carries an illegal value. */
   return {selected:state.selected,active:state.active,loopReads:state.loopReads,
    x:state.x,y:state.y,scale:state.scale,rotate:state.rotate,
    drift:{x:state.drift.x,y:state.drift.y,vx:state.drift.vx,vy:state.drift.vy},
    settling:!!state.settleFrame,
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
    /* A key press is a discrete, exact request. It starts from the arrangement
       and it lands on it, so anything the spring is still unwinding is dropped
       -- otherwise an arrow tapped during a settle would be added to a number
       that is still moving and the step would not be the step. */
    clearDrift();
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
   node.addEventListener("pointercancel",cancel);node.addEventListener("lostpointercapture",end);
  });
  handles.forEach(function(handle){
   handle.addEventListener("pointerdown",function(event){
    beginResize(event,handle.getAttribute("data-corner"),handle);
   });
   handle.addEventListener("pointermove",resize);
   handle.addEventListener("pointerup",end);
   handle.addEventListener("pointercancel",cancel);
   handle.addEventListener("lostpointercapture",end);
  });
  if(rotator){
   rotator.addEventListener("pointerdown",function(event){beginRotate(event,rotator);});
   rotator.addEventListener("pointermove",turn);
   rotator.addEventListener("pointerup",end);
   rotator.addEventListener("pointercancel",cancel);
   rotator.addEventListener("lostpointercapture",end);
  }
  /* ── CLICKING AWAY DISMISSES THE FRAME ──────────────────────────────────
     THIS IS A REVERSAL, AND IT IS JAYDEN'S. He asked for the frame to be
     permanent -- "it kinda adds to the structure and give that design look" --
     and it was built that way twice: first as a frame nothing could dismiss,
     then with a middle IDLE look for when the press went elsewhere. Today:
     "i actually think i do prefer that the resize box can disappear if you
     click off of it." So the canvas convention wins after all. The two earlier
     arguments are not wrong, they were answering a question he has now answered
     differently, and this comment exists so the next person does not restore
     permanence as a bug fix.
     THE IDLE STATE WENT WITH IT. relax() had exactly one caller -- this handler
     -- and a middle state between "the live control" and "gone" has nothing to
     describe once the outer state is gone. Deleting it beat keeping a
     three-state machine with an unreachable middle.
     WHAT DISMISSAL MUST NOT DO, in the order these have actually gone wrong:
     - It must not fire mid-gesture. A drag, a resize or a rotate can wander far
       outside the head, and its pointerdown landed INSIDE. state.pointerId is
       non-null for the whole operation, so an unrelated second press cannot
       pull the chrome out from under a live one.
     - It must not fire on pointer-UP. This listens to pointerdown only, so a
       drag that ends in the footer is a completed gesture, not a click-away.
     - It must not swallow the press. No preventDefault, no stopPropagation, no
       focus change: the press that dismisses the frame is on its way to a CTA
       and has to arrive. Capture phase only so the frame goes on the same press
       rather than a frame later.
     GETTING BACK IN, all three doors, because dismissal is only safe if
     re-entry is obvious:
     - Press the head (or its frame): beginMove() selects before it drags, so
       the same gesture that brings the frame back also starts moving the head.
     - Enter or Space on the focused portrait: it is a role="button" with
       aria-pressed, so this is the toggle its own semantics promise.
     - FOCUS the portrait with the keyboard: see the binding below. */
  document.addEventListener("pointerdown",function(e){
   if(!state.selected)return;
   if(state.pointerId!==null)return;
   var node=e.target;
   if(node===face||(node&&node.closest&&(node.closest("#heroHeadSelection")||node.closest("#face"))))return;
   deselect();
  },true);
  /* ── THE FRAME IS THE PORTRAIT'S FOCUS INDICATOR ─────────────────────────
     #face carries no :focus-visible ring of its own -- it never needed one,
     because the frame was always on screen and the frame IS the indicator. Now
     that a click elsewhere can take it away, a keyboard user could tab onto a
     button-role portrait and be given nothing at all to look at, then press
     arrow keys against an object with no visible state. So arriving on the
     portrait re-opens the frame.
     state.refocusing is what keeps Escape from being a no-op: see deselect().
     A POINTER PRESS DOES NOT NEED THIS -- beginMove() has already selected by
     the time focus lands -- so this is purely the keyboard's door, and select()
     is idempotent when it is not. */
  face.addEventListener("focus",function(){
   if(state.refocusing||state.selected)return;
   select();
  });
  /* WHAT MAKES A PERMANENT FRAME READ AS DESIGN RATHER THAN AS A RENDERING
     BUG IS THAT THE HEAD MOVES. Static artwork inside a selection box looks
     broken; drifting artwork inside one looks like a tool. The float is
     therefore load-bearing twice over now, and nothing should quietly disable
     it -- and it keeps running in the idle look, which is what stops the
     greyed frame reading as something that failed to load.
     ESCAPE IS STILL THE ONLY WAY OUT, and it stays. It costs nothing, it is
     invisible unless someone reaches for it, and a permanent decorative
     overlay should have some exit. It clears state.ambient, so the frame does
     not come back on its own for the rest of the session. Relaxing is not an
     exit and deliberately does not clear it.
     THE CLICK IS STILL NOT SWALLOWED, and that guarantee matters MORE now, not
     less: with the frame on screen for the whole visit, the chrome must never
     be the reason a CTA does not fire. The selection surface sits below
     .heroCopy in z-order and does not preventDefault on anything outside its
     own handles. */
  document.addEventListener("keydown",onKeydown);
  addEventListener("heroheadstagechange",function(){state.stamp++;state.metrics=null;captureBase();syncSelection();});
  document.addEventListener("visibilitychange",function(){if(document.hidden)end();});
  addEventListener("blur",end);
  /* ── A PHONE SCROLL IS A RESIZE, AND IT IS NOW A RESIZE THAT CHANGES NOTHING.
     Retracting chrome grows the Hero, so the ResizeObserver on it fires
     repeatedly through every scroll gesture, and `resize` fires on the window
     alongside. reclamp() is not cheap: syncOrigin() and captureBase() each
     neutralise a set of custom properties, force a synchronous layout inside
     stillBody(), read three rects and put the properties back. That is a
     forced-layout burst per scroll event, on the slowest device anyone views
     this on -- and since controls.css re-anchored the head to a fixed-height
     stage, a Hero HEIGHT change cannot move the head, so every one of those
     bursts now recomputes a value that is arithmetically guaranteed identical.
     THE GUARD IS A SHAPE KEY, NOT A HEIGHT COMPARISON, because "the Hero got
     taller" is not the same question as "can the head have moved". Four things
     can move it and they are all in the key: the Hero's WIDTH (the media query
     that swaps --hero-peek-*, and the centring), the STAGE's height (100svh --
     it survives a scroll but not a rotation, and not an Android keyboard, which
     changes svh without changing width), and the wrapper's own layout box.
     offsetWidth/offsetHeight rather than a rect, deliberately: the rect carries
     the user's live scale and rotation, so it would fire a recapture on every
     drag frame -- the opposite of the point.
     Three reads to decide, against a burst of forced layouts to skip. If the
     key ever misses something, the base goes stale and the head drifts on a
     resize, which is precisely what hero-head-scroll-contract already fails
     on -- it cycles the viewport 760 -> 844 -> 760, which moves svh, which
     moves this key, so the skip is exercised and the recapture still is too. */
  var lastShape="";
  function shapeKey(){
   return rectOf(hero).width.toFixed(2)+"|"+rectOf(peek).height.toFixed(2)
    +"|"+wrap.offsetWidth+"|"+wrap.offsetHeight;
  }
  function reclampIfReshaped(){
   var key=shapeKey();
   if(key===lastShape)return;
   lastShape=key;reclamp();
  }
  addEventListener("resize",reclampIfReshaped);
  new ResizeObserver(reclampIfReshaped).observe(hero);
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
   state.selected=true;state.active=true;
   face.setAttribute("aria-pressed","true");selection.hidden=false;
   paint();
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
   /* The window is the sky's own duration plus a frame or two of slack, read
      from the token rather than repeated as a literal, so retuning the
      cross-fade retunes this with it. */
   var raw=computedOf(document.documentElement)
     .getPropertyValue("--hero-time-duration").trim();
   var ms=parseFloat(raw)||0;
   if(!/ms$/i.test(raw))ms*=1000;
   skyShiftUntil=performance.now()+(ms||640)+120;
   updateLight(cssNumber(wrap,"--hero-head-float-x"),cssNumber(wrap,"--hero-head-float-y"),
    cssNumber(wrap,"--hero-head-float-rot"));
   /* The float loop carries the window while it is running. It is not running
      under reduced motion or while a pointer is holding the head, so one
      catch-up pass past the end of the window guarantees the settled value. */
   setTimeout(function(){
    if(!env)env=parseSky();
    if(env)refreshSkyWeights();
    updateLight(cssNumber(wrap,"--hero-head-float-x"),cssNumber(wrap,"--hero-head-float-y"),
     cssNumber(wrap,"--hero-head-float-rot"));
   },(ms||640)+140);
  }
  new MutationObserver(relight)
   .observe(hero,{attributes:true,attributeFilter:["data-time-state"]});
  /* ARMED BEFORE ambient(), NOT AFTER. ambient() draws the frame, and the frame
     cannot be drawn correctly until the arrival's offset is known -- so the
     order here is the difference between the box arriving on the head and the
     box arriving where the head is going to be.
     Armed at init at all because site-theme.js sets theme-ready synchronously
     in the document head, so the greeting is already counting down its delay by
     the time this runs. animationstart is a second door for any future ordering
     where it is not. */
  wrap.addEventListener("animationstart",watchArrival);
  watchArrival();
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
