(function(){
 // Self-contained: injects its own disco CSS (index.html 245-291, verbatim) so
 // party.js has no dependency on play.css for its own rules.
 var s=document.createElement("style");
 s.textContent=`/* ===== Disco party easter egg ===== */
.cycw.party{cursor:grab}
.discoDot{display:inline-block;width:.62em;height:.62em;vertical-align:baseline;position:relative;overflow:visible;color:transparent;filter:drop-shadow(0 0 .05em rgba(150,180,255,.55))}.discoDot::before{content:"";position:absolute;inset:0;background:url(images/discoball.webp) center/contain no-repeat;filter:url(#inkSm)}.discoDot::after{content:"";position:absolute;left:3%;top:10%;width:94%;height:88%;border-radius:50%;background:url(images/discoglints.webp) 0 50%/130% auto repeat;opacity:.85;animation:discoSweep 1.6s steps(13,end) infinite}@keyframes discoSweep{from{background-position:0 50%}to{background-position:-200% 50%}}
.partydrag{position:fixed;pointer-events:none;font-family:var(--sans);font-weight:600;letter-spacing:-.02em;text-transform:none;font-size:var(--fs-h1);transform:translate(-50%,-50%);transform-origin:50% 18%;z-index:70;will-change:transform,left,top;color:var(--c950);display:inline-flex;align-items:baseline;gap:.04em}




.cycw.collab{cursor:grab}
.cycw.party.grab,.cycw.love.grab,.cycw.collab.grab{cursor:grabbing}
.cycw.cwtug{animation:cwTug 1.5s steps(1,end) both}
@keyframes cwTug{0%{transform:translateX(0)}6%{transform:translateX(3px)}12%{transform:translateX(6px)}18%{transform:translateX(9px)}24%{transform:translateX(6px)}30%{transform:translateX(3px)}36%{transform:translateX(0)}44%{transform:translateX(4px)}50%{transform:translateX(8px)}56%{transform:translateX(4px)}62%{transform:translateX(0)}100%{transform:translateX(0)}}
@media(prefers-reduced-motion:reduce){.cycw.cwtug{animation:none}
/* THE DOTS' GUARD HAD TO COME WITH THE DOTS. The disco CSS above was copied
   verbatim out of index.html, but the reduced-motion block that switches these
   infinite loops off lives further down that file and did not come with it --
   and because this stylesheet is injected at RUNTIME it lands after every
   linked sheet, so it outranked the identical guard play.css already carries
   and quietly re-enabled the animation site-wide for anyone who had asked for
   stillness.
   .discoDot::after animates BACKGROUND-POSITION, a paint property, so it costs
   a style recalculation on every frame rather than riding the compositor.
   Measured on play.html under prefers-reduced-motion: this one selector was
   the entire idle load, 60.8 style recalcs per second against 2.0 with it
   stopped -- killing every companion head on the page changed nothing by
   comparison. */
.heartDot::before,.discoDot::after,.cookieDot::before,.camDot::before{animation:none}}
#party{position:absolute;top:0;left:0;right:0;height:112vh;-webkit-mask-image:linear-gradient(#000 90%,transparent 100%);mask-image:linear-gradient(#000 90%,transparent 100%);z-index:63;pointer-events:none;opacity:0;transition:opacity 1.15s cubic-bezier(.33,0,.2,1)}
#party:not(.on){transition:opacity .42s cubic-bezier(.3,0,.8,.15)}
#party.on{opacity:1}
.partyDark{position:absolute;inset:0;background:radial-gradient(circle var(--hr,180px) at var(--hx,50%) var(--hy,38%),rgba(6,5,16,0) 0%,rgba(6,5,16,.55) 44%,rgba(2,1,8,.96) 100%)}
.partyHaze{position:absolute;left:var(--bx,50%);top:var(--by,30%);width:120vmax;height:120vmax;margin:-60vmax 0 0 -60vmax;background:radial-gradient(circle,rgba(120,150,255,.16),rgba(180,90,220,.06) 40%,transparent 66%);mix-blend-mode:screen;animation:hazePulse 1.5s steps(12,end) infinite,hueShift 5.6s steps(7,end) infinite}
.beamWrap{position:absolute;left:var(--bx,50%);top:var(--by,30%);width:0;height:0}
.beamSpin{position:absolute;left:0;top:0;width:300vmax;height:300vmax;margin:-150vmax 0 0 -150vmax;transform-origin:center;mix-blend-mode:screen;opacity:.5;background:repeating-conic-gradient(from 0deg,rgba(255,255,255,.10) 0deg 3deg,transparent 3deg 11deg,rgba(180,210,255,.09) 11deg 13deg,transparent 13deg 26deg);animation:spinB 8s steps(64,end) infinite,hueShift 5.6s steps(7,end) infinite}
.partyLights{position:absolute;left:var(--bx,50%);top:var(--by,30%);width:0;height:0;transform-origin:0 0;mix-blend-mode:screen;animation:spinL 6s steps(48,end) infinite,hueShift 5.6s steps(7,end) infinite}
.pspot{position:absolute;left:0;top:0;border-radius:1px;transform-origin:0 0;opacity:0;animation-name:twinkle;animation-iteration-count:infinite;animation-timing-function:steps(8,end)}
.partyFlash{position:absolute;inset:0;background:radial-gradient(circle at var(--bx,50%) var(--by,30%),rgba(190,200,255,.10),transparent 60%);mix-blend-mode:screen;opacity:0;animation:beat 1s steps(8,end) infinite}
.partyGrain{position:absolute;inset:-40px;background:url(images/overlay.webp);background-size:150px 150px;mix-blend-mode:overlay;opacity:.4}
@keyframes spinL{to{transform:rotate(360deg)}}
@keyframes spinB{to{transform:rotate(360deg)}}
@keyframes twinkle{0%,100%{opacity:0}14%{opacity:.1}50%{opacity:1}}
@keyframes hazePulse{0%,100%{opacity:.55}50%{opacity:1}}
@keyframes beat{0%,62%,100%{opacity:0}70%{opacity:.5}82%{opacity:.12}}
@keyframes hueShift{to{filter:hue-rotate(360deg)}}
/* The ball DROPS in rather than fading on the spot -- it is hanging from somewhere. */
#discoWrap{position:absolute;z-index:64;pointer-events:none;opacity:0;
 transform:translate(-50%,-140%) scale(.82);
 transition:opacity .7s cubic-bezier(.2,.8,.2,1),transform .95s cubic-bezier(.22,1.15,.32,1)}
#discoWrap:not(.on){transition:opacity .38s cubic-bezier(.3,0,.8,.15),transform .5s cubic-bezier(.3,0,.8,.15)}
#discoWrap.on{transform:translate(-50%,-50%) scale(1)}
#discoWrap.on{opacity:1}
.dbGlow{position:absolute;left:50%;top:50%;width:300%;height:300%;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(190,210,255,.45),rgba(150,120,220,.12) 30%,transparent 60%);mix-blend-mode:screen;animation:hazePulse 1.25s steps(10,end) infinite}
#discoBall{position:relative;width:clamp(104px,12.5vw,156px);height:clamp(104px,12.5vw,156px);border-radius:50%;overflow:hidden;clip-path:circle(50%);filter:drop-shadow(0 7px 18px rgba(0,0,0,.55))}
#discoBall .dbPhoto{position:absolute;inset:0;background:url(images/discoball.webp) center/cover no-repeat}
#discoBall .dbGlints{position:absolute;inset:-12%;background:url(images/discoglints.webp) repeat-x;background-size:150px 150px;mix-blend-mode:screen;animation:dbScroll 1.5s steps(12,end) infinite}
#discoBall .dbSweep{position:absolute;inset:0;background:linear-gradient(102deg,transparent 38%,rgba(255,255,255,.55) 50%,transparent 62%);mix-blend-mode:screen;animation:dbSweep 2s steps(16,end) infinite}
#discoBall .dbShade{position:absolute;inset:0;background:radial-gradient(circle at 33% 28%,rgba(255,255,255,.5),rgba(255,255,255,0) 44%),radial-gradient(circle at 50% 50%,transparent 62%,rgba(2,2,12,.6) 100%)}
@keyframes dbScroll{to{background-position-x:-150px}}
@keyframes dbSweep{0%{transform:translateX(-65%)}100%{transform:translateX(65%)}}
body.partyLock{overflow:hidden}
@media (prefers-reduced-motion:reduce){.partyLights,.beamSpin,.partyHaze,.partyFlash,.dbGlints,.dbSweep,.dbGlow,.partyFlash{display:none}}`;
 document.head.appendChild(s);

 // The shared DOM handles buildPartyDOM/__hmPartyAt read and write (index.html
 // 2843, trimmed to the subset these two functions actually touch).
 var partyEl=null,partyLights=null,discoWrap=null,discoBall=null,partyGrain=null;

 // ===== buildPartyDOM (index.html 2999-3012, verbatim) =====
function buildPartyDOM(){
 if(partyEl)return;
 partyEl=document.createElement("div");partyEl.id="party";partyEl.setAttribute("aria-hidden","true");
 partyEl.innerHTML='<div class="partyDark"></div><div class="partyHaze"></div><div class="beamWrap"><div class="beamSpin"></div></div><div class="partyLights"></div><div class="partyFlash"></div><div class="partyGrain"></div>';
 document.body.appendChild(partyEl);partyLights=partyEl.querySelector(".partyLights");partyGrain=partyEl.querySelector(".partyGrain");
 discoWrap=document.createElement("div");discoWrap.id="discoWrap";
 discoWrap.innerHTML='<div class="dbGlow"></div><div id="discoBall"><div class="dbPhoto"></div><div class="dbGlints"></div><div class="dbSweep"></div><div class="dbShade"></div></div>';
 document.body.appendChild(discoWrap);discoBall=discoWrap.querySelector("#discoBall");
 var COLS=["255,255,255","255,255,255","255,255,255","190,225,255","255,190,235","255,240,180","190,255,215","200,200,255"];
 var html="";
 for(var i=0;i<84;i++){var ang=(Math.random()*360).toFixed(1),rad=(5+Math.random()*76).toFixed(1),sz=(3+Math.random()*10).toFixed(1),rt=(Math.random()*45).toFixed(0),col=COLS[Math.floor(Math.random()*COLS.length)],dur=(0.9+Math.random()*1.6).toFixed(2),del=(Math.random()*2.0).toFixed(2);
  html+='<i class="pspot" style="transform:rotate('+ang+'deg) translateX('+rad+'vmax) rotate('+rt+'deg);width:'+sz+'px;height:'+sz+'px;background:rgba('+col+',.96);box-shadow:0 0 '+(sz*2.6).toFixed(0)+'px rgba('+col+',.92);animation-duration:'+dur+'s;animation-delay:'+del+'s"></i>';}
 partyLights.innerHTML=html;
}
window.__hmBuildPartyDOM=buildPartyDOM;   // Task 5 repoints index.html's home-page party caller here

 // ===== __hmPartyAt (index.html 3022-3098, verbatim -- the real boundary of the
 // function; the plan's cited 3022-3095 undercounted by 3 lines, see task-1 report) =====
/* THE CHAMPIONSHIP SPOTLIGHT. The delight party exactly as it is -- dark, disco ball, beams,
   spotlight -- but aimed at the head that just won instead of the big one.
   Deliberately does NOT set partyMode/eventLock or touch the face: that 6.6s sequence belongs
   to the big head's own celebration and running it here would freeze the pitch mid-match. */
window.__hmPartyAt=function(getRect,ms){try{
  var probe=(typeof getRect==="function")?getRect:function(){return getRect;};
  var r0=probe(); if(!r0||!r0.width)return;
  buildPartyDOM();
  /* The ball HANGS. It belongs at the top of the room, not level with whoever won -- that is
     what makes the beams read as coming down onto the floor. */
  var ballTop=Math.round(Math.min(120,Math.max(56,innerHeight*0.10)));
  /* THE CUE SHEET. One loop, four cues, in the order a real follow-spot operator would call
     them -- ballyhoo, pickup, iris in, hold. Two separate rAF loops (one tracking, one
     irising) could not express an order between them; a sequence needs a single clock.

       0.00s  BALLYHOO   the light sweeps a figure-eight over the pitch, iris wide open.
                         Sourced as an ENERGY effect, not a searching one -- the light is not
                         hunting for the winner, it is celebrating and then arrives.
       1.10s  PICKUP     a BUMP, not a slide: the light cuts to the winner. A "set" pickup,
                         the type where the light takes its mark and the performer is in it.
       1.40s  IRIS IN    full-body framing closes to head framing over 2.2s. The standard
                         framings are named, and the operator's first rule is STAY ON THE
                         FACE, so head framing is where this has to land.
       3.60s  HOLD       tracking only. The winner is still being simulated -- it lands,
                         bounces, drifts -- so a light parked where it was on the winning
                         frame slides off within a second.

     Timing follows Heer & Robertson: slow-in slow-out throughout, staged rather than one
     move, and no single beat longer than it needs. */
  var hrWide=Math.max(150,Math.round(r0.width*2.4)),      // full body
      hrHead=Math.round(hrWide*0.42);                     // head framing
  partyEl.style.setProperty("--hr",hrWide+"px");
  var BALLY=1100, IRIS_S=1400, IRIS_D=2200;
  var sy0=window.scrollY||0, ballX=Math.round(innerWidth/2);
  partyEl.style.setProperty("--bx",ballX+"px");
  partyEl.style.setProperty("--by",(ballTop+sy0)+"px");
  discoWrap.style.left=ballX+"px"; discoWrap.style.top=(ballTop+sy0)+"px";
  var live=true, T0=null;
  function ease(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
  (function cue(now){
    if(!live||!partyEl)return;
    if(T0===null)T0=now;
    var t=now-T0, sy=window.scrollY||0, hx, hy;
    if(t<BALLY){
      // BALLYHOO -- a figure-eight over the pitch, iris wide
      /* Viewport maths, NOT hero.getBoundingClientRect(). `hero` is not in scope in this
         module -- and because this loop's first call is synchronous, that threw straight into
         __hmPartyAt's own try/catch, which swallowed it. The whole sequence silently did
         nothing while the harness reported zero page errors. */
      var a2=(t/BALLY)*Math.PI*4;
      hx=innerWidth*(0.5+0.33*Math.sin(a2));
      hy=(r0.top+sy+r0.height*0.42)+innerHeight*0.10*Math.sin(2*a2);
    }else{
      // PICKUP, then HOLD -- on the winner, re-read every frame
      var r=probe(); if(!r||!r.width){requestAnimationFrame(cue);return;}
      hx=r.left+r.width/2;
      hy=r.top+sy+r.height*0.42;
      var it=Math.min(1,Math.max(0,(t-IRIS_S)/IRIS_D));
      partyEl.style.setProperty("--hr",Math.round(hrWide+(hrHead-hrWide)*ease(it))+"px");
    }
    partyEl.style.setProperty("--hx",hx+"px");
    partyEl.style.setProperty("--hy",hy+"px");
    requestAnimationFrame(cue);
  })(performance.now());
  /* Two frames apart, so the room dims BEFORE the ball arrives rather than everything
     snapping on together. The ball's own drop-in is a transition on .on. */
  requestAnimationFrame(function(){
    if(partyEl)partyEl.classList.add("on");
    setTimeout(function(){ if(discoWrap)discoWrap.classList.add("on"); },420);
  });
  clearTimeout(window.__hmPartyAtT);
  window.__hmPartyAtT=setTimeout(function(){try{
    if(partyEl)partyEl.classList.remove("on");
    if(discoWrap)discoWrap.classList.remove("on");
    setTimeout(function(){live=false;},900);
  }catch(_){live=false;}},ms||6500);
}catch(_){}};
})();
