/* the visitor's own head (made in Extras): a little roommate with real physics.
   It hops around the hero like a bouncy ball, explores depth (scale + ground shadow stay honest),
   stands on the CTA buttons, never covers the big head or the text, wanders off screen and
   comes back, and you can pick it up like a Mii — it panics, you drop it, it bounces, it gets dizzy. */
(function(){
 /* HOW MANY HEADS THE PIT HOLDS -- ONE RULE, DECLARED IDENTICALLY IN EVERY FILE
    THAT ENFORCES IT (play-engine.js, play-games.js, headmaker.html and
    index.html). Was the literal 8 in eight places; three of them, including the
    filter directly below, also HEAL localStorage by rewriting the roster when
    the deduped list comes out shorter than what was read. A stale copy does not
    just disagree, it DELETES. No script is shared by all three pages that this
    lane owns, so each copy is the same idempotent line: first script on the page
    to run defines it, the rest adopt it. tools/roster-cap-contract.py fails when
    the literals drift apart across files. */
 var HM_MAX=(window.__HM_MAX_HEADS=window.__HM_MAX_HEADS||12);
 var list=[],_rawN=null;   // up to HM_MAX little heads: the ball pit
 try{var _raw=localStorage.getItem("hmCompanions");if(_raw!==null){var _m=JSON.parse(_raw)||[];_rawN=_m.length;list=_m;}}catch(_){}
 if(_rawN===null){try{var _one=JSON.parse(localStorage.getItem("hmCompanion")||"null");if(_one)list=[_one];}catch(_){}}   // legacy only when the new key has never existed: an emptied pit stays empty
 /* HEALING WRITES BACK. CAPPING DOES NOT. Chaining .slice(HM_MAX) onto this filter and
    then persisting the result meant a plain page load DELETED every head past the cap:
    eleven saved, eight on disk after a reload, and the difference not recoverable. The
    dedupe is a genuine repair and is still written; the cap only decides how many heads
    this page puts on the ground. Anything beyond it waits on disk. */
 var seenC={};list=list.filter(function(d){if(!d||!d.cut||d.cut.length<15000)return false;
  var k2=d.cut.length+"|"+JSON.stringify(d.marks||"m")+JSON.stringify((d.eyes||[]).map(function(e){return[e.x,e.y,e.w,e.h];}));   // the cut length is part of the key: two DIFFERENT people marked at the same coordinates are not one head, and the newer one was being deleted as a duplicate. This key must stay byte-identical across play-games.js, play-engine.js, headmaker.html and index.html -- four copies disagreeing about who is a duplicate is four pages disagreeing about who exists.
  if(seenC[d.cut]||seenC[k2])return false;seenC[d.cut]=1;seenC[k2]=1;return true;});   // unique REAL faces only, by pixels AND by geometry
 if(_rawN!==null&&_rawN!==list.length){try{localStorage.setItem("hmCompanions",JSON.stringify(list));if(typeof _hcBump==="function")_hcBump();}catch(_){}}   // heal stale duplicates once, physically -- the HEALED list, never the capped one
 list=list.slice(0,HM_MAX);
 // NO EARLY RETURN HERE. This used to read `if(!list.length)return;`, which bailed out of the whole
 // IIFE on an empty roster -- and every one of this engine's ~67 window.__hm* exports is declared
 // BELOW this line. So on a genuine first visit, with nothing in localStorage, __hmSpawnOne,
 // __hmLive, __hmSoccerStart and __hmFillerAdd did not exist, and "Play a match" had never worked
 // for anyone who had not already made a head. It failed silently rather than loudly because the
 // ~40 call sites into this engine from other files are all `typeof`-guarded, which is exactly the
 // shape of guard that hides a missing export forever.
 // The intent of the old line -- do no work when there is nothing to render -- is right and is kept:
 // it just moves to the two places that actually do work. The spawn loop iterates an empty list and
 // no-ops (see `list.forEach` below), and the shared hero-box poll skips while nobody is on stage.
 // Registering the API is not work; it is the door.
 var peers=[];   // every head knows where every other head is, every frame
 var LOBBY_THROW_STAGGER=110,LOBBY_THROW_DURATION=1200,_lobbyThrowToken=0;
 try{if(/[?&]wraf=1/.test(location.search))window.__peers=peers;}catch(_){}   // DEV-ONLY debug handle (opt-in), lets a headless run inspect head AI state
 var heroBox={left:0,top:0,width:0,height:0};   // ONE cached hero rect shared by every head, so N heads never each force a layout reflow per frame (older machines feel that). Refreshed only when the page actually moves.
 function refreshHeroBox(){var h=document.querySelector(".hero");if(!h)return;var r=h.getBoundingClientRect();heroBox.left=r.left;heroBox.top=r.top;heroBox.width=r.width;heroBox.height=r.height;}
 (function(){var raf=0;function mark(){if(raf)return;raf=requestAnimationFrame(function(){raf=0;refreshHeroBox();});}addEventListener("scroll",mark,{passive:true});addEventListener("resize",mark,{passive:true});refreshHeroBox();setInterval(function(){if(!document.hidden&&peers.length)refreshHeroBox();},500);})();   // scroll/resize (rAF-throttled) + a slow safety tick for any other layout shift
 /* ── ONE FRAME, ONE MEASUREMENT ──────────────────────────────────────────
    heroBox above already refuses to let N heads each force a layout per FRAME.
    The resize path had no such rule, and resize is where it matters most: a
    hand on the window corner emits an event per compositor tick, far faster
    than frames arrive, and every listener below re-measures layout when it
    fires. survey() is registered PER HEAD, so a twelve-head lobby turned a
    single drag event into twelve read-write-read cycles -- each head reading
    the hero rect, writing its own width/height/shadow/reflection, and the next
    head then reading the rect back out of a dirtied tree.
    Measured on a 30-step drag at 1440 with twelve heads seated: 3.2 layouts
    per step and a 33.0ms median frame, against 16.7ms at rest.
    Coalescing to a frame changes nothing anyone can see -- a size that is
    measured and discarded between two frames was never painted -- and it is
    the same discipline, applied to the same problem, one event source over. */
 function onResizeFrame(fn){var raf=0;addEventListener("resize",function(){
  if(raf)return;raf=requestAnimationFrame(function(){raf=0;try{fn();}catch(_){}});
 },{passive:true});}
 var battlePlats=[];   // battle arena: floating platforms the heads land on and pounce from (populated by the platforms block, read every frame in the physics)
 try{if(/[?&]wraf=1/.test(location.search))window.__plats=battlePlats;}catch(_){}   // DEV-ONLY debug handle (opt-in), so a headless run can inspect the live ladder
 var sharedFeetY=null;   // the shared FLOOR line (screen-space feet row). Cached while the big head is VISIBLE so a head spawning mid-game (mini-Jayden -- the big head is hidden AND the hero box measures shorter then) lands on the SAME plane as everyone else instead of a mid-game fallback.
 var sparkThrottle=0;   // shared rate-limit for impact sparks so a scrum can't flood the DOM
 var battleOut=[];   // knockouts in order -- last out ranks 2nd, the one before 3rd; the survivor is 1st
 var podiumEls=[];   // the three pedestals, created once, shown at the end of a fight
 // ===== SHARED VFX TOOLKIT: one capped particle canvas + juice primitives (crates & abilities compose these) =====
 // Coords are HERO-LOCAL (same space the heads live in). Dark cores + saturated accents so effects read on the white arena. Everything clears the instant no game is running.
 var FX=(function(){
  var cv=null,ctx=null,parts=[],running=false,heroLeft=0,vw=0,vh=0,flashA=0,flashCol="255,255,255",tintT=0,tintMax=1,tintCol="0,0,0",tintA=0,lastT=0;
  var CAP=320;
  function hero(){return document.querySelector(".hero");}
  function active(){return document.body.classList.contains("hmBattle")||document.body.classList.contains("hmSoccer");}
  function make(){if(cv)return;cv=document.createElement("canvas");cv.setAttribute("aria-hidden","true");document.body.appendChild(cv);ctx=cv.getContext("2d");size();}
  function size(){var h=hero();if(!h||!cv)return;var r=h.getBoundingClientRect();heroLeft=r.left;vw=Math.round(innerWidth);vh=Math.max(1,Math.round(r.height));if(cv.width!==vw)cv.width=vw;if(cv.height!==vh)cv.height=vh;cv.style.cssText="position:fixed;left:0;top:"+r.top.toFixed(0)+"px;width:100vw;height:"+vh+"px;pointer-events:none;z-index:45";}
  function run(){if(running)return;running=true;lastT=performance.now();requestAnimationFrame(loop);}
  function push(p){if(!active())return;make();if(parts.length>=CAP)parts.shift();parts.push(p);run();}
  function burst(hx,hy,o){o=o||{};var n=o.count||14,col=o.color||"24,24,26",sp=o.speed||220,g=(o.gravity==null?900:o.gravity),life=o.life||0.6,sz=o.size||4,shape=o.shape||"dot",spread=(o.spread==null?6.283:o.spread),dir=o.dir||0,drag=(o.drag==null?0.99:o.drag);
   for(var i=0;i<n;i++){var a=dir+(Math.random()-0.5)*spread,v=sp*(0.35+Math.random()*0.85);
    push({t:"p",x:hx,y:hy,vx:Math.cos(a)*v,vy:Math.sin(a)*v-(o.lift||0),g:g,life:life*(0.65+Math.random()*0.7),max:life,r:sz*(0.55+Math.random()*0.9),c:col,rot:Math.random()*6.28,rv:(Math.random()-0.5)*14,shape:shape,drag:drag,fade:(o.fade!==false)});}}
  function ring(hx,hy,o){o=o||{};push({t:"ring",x:hx,y:hy,r:(o.r0||6),r1:(o.r1||80),life:(o.life||0.5),max:(o.life||0.5),c:(o.color||"24,24,26"),w:(o.width||3),fill:(o.fill||null)});}
  function spark(hx,hy,dir,o){o=o||{};burst(hx,hy,{count:(o.count||7),color:(o.color||"255,255,255"),speed:(o.speed||320),gravity:180,life:0.32,size:(o.size||3),shape:"streak",dir:dir,spread:(o.spread||1.1),drag:0.9});}
  function flash(col,alpha){flashCol=col||"255,255,255";flashA=Math.max(flashA,alpha==null?0.5:alpha);make();run();}
  function tint(col,alpha,life){tintCol=col||"120,90,220";tintA=alpha==null?0.14:alpha;tintT=life||1;tintMax=tintT;make();run();}
  function loop(n){var dt=Math.min(0.05,(n-lastT)/1000);lastT=n;
   if(!active()){parts.length=0;flashA=0;tintT=0;tintA=0;if(cv&&ctx)ctx.clearRect(0,0,vw,vh);running=false;return;}
   size();ctx.clearRect(0,0,vw,vh);
   if(tintT>0){tintT-=dt;var ta=tintA*Math.min(1,tintT/(tintMax*0.5))*(tintT<tintMax*0.3?tintT/(tintMax*0.3):1);ctx.fillStyle="rgba("+tintCol+","+Math.max(0,ta).toFixed(3)+")";ctx.fillRect(0,0,vw,vh);}
   for(var i=parts.length-1;i>=0;i--){var p=parts[i];
    if(p.t==="ring"){p.life-=dt;if(p.life<=0){parts.splice(i,1);continue;}var pr=1-p.life/p.max,rr=p.r+(p.r1-p.r)*(1-Math.pow(1-pr,3)),a1=(1-pr);
     if(p.fill){ctx.beginPath();ctx.arc(heroLeft+p.x,p.y,rr,0,6.283);ctx.fillStyle="rgba("+p.fill+","+(a1*0.5).toFixed(2)+")";ctx.fill();}
     ctx.beginPath();ctx.arc(heroLeft+p.x,p.y,rr,0,6.283);ctx.strokeStyle="rgba("+p.c+","+a1.toFixed(2)+")";ctx.lineWidth=p.w*(1-pr*0.5);ctx.stroke();continue;}
    p.life-=dt;if(p.life<=0){parts.splice(i,1);continue;}
    p.vy+=p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=p.drag;p.vy*=p.drag;p.rot+=p.rv*dt;
    var al=p.fade?Math.max(0,p.life/p.max):1;ctx.save();ctx.translate(heroLeft+p.x,p.y);ctx.rotate(p.rot);ctx.fillStyle="rgba("+p.c+","+al.toFixed(2)+")";
    if(p.shape==="streak"){ctx.fillRect(-p.r*2.2,-p.r*0.35,p.r*4.4,p.r*0.7);}
    else if(p.shape==="square"){ctx.fillRect(-p.r,-p.r,p.r*2,p.r*2);}
    else if(p.shape==="shard"){ctx.beginPath();ctx.moveTo(0,-p.r*1.4);ctx.lineTo(p.r*0.8,p.r);ctx.lineTo(-p.r*0.8,p.r);ctx.closePath();ctx.fill();}
    else{ctx.beginPath();ctx.arc(0,0,p.r,0,6.283);ctx.fill();}
    ctx.restore();}
   if(flashA>0.01){ctx.fillStyle="rgba("+flashCol+","+flashA.toFixed(2)+")";ctx.fillRect(0,0,vw,vh);flashA*=Math.pow(0.0009,dt);if(flashA<0.01)flashA=0;}
   if(parts.length||flashA>0||tintT>0)requestAnimationFrame(loop);else running=false;}
  // impact frames: a brief global hitstop that freezes head physics (DT->0 in the loop) so a big blow reads
  function hitstop(ms){var until=performance.now()+(ms||70);if((window.__hmFreeze||0)<until)window.__hmFreeze=until;}
  // screen shake: a decaying offset the heads + this canvas read each frame (never moves the page headline)
  function shake(mag){var m=mag||8;var s=window.__hmShake||(window.__hmShake={x:0,y:0,mag:0});if(m>s.mag)s.mag=m;run();shakeRun();}
  var shaking=false;
  function shakeRun(){if(shaking)return;shaking=true;var lt=performance.now();
   (function st(n){var dt=Math.min(0.05,(n-lt)/1000);lt=n;var s=window.__hmShake;if(!s||!active()){if(s){s.x=0;s.y=0;s.mag=0;}if(cv){cv.style.marginLeft="0px";cv.style.marginTop="0px";}shaking=false;return;}
    if(s.mag>0.3){s.x=(Math.random()-0.5)*s.mag;s.y=(Math.random()-0.5)*s.mag;s.mag*=Math.pow(0.0016,dt);}else{s.x=0;s.y=0;s.mag=0;}
    if(cv){cv.style.marginLeft=s.x.toFixed(1)+"px";cv.style.marginTop=s.y.toFixed(1)+"px";}
    if(s.mag>0)requestAnimationFrame(st);else{if(cv){cv.style.marginLeft="0px";cv.style.marginTop="0px";}shaking=false;}})(lt);}
  function clear(){parts.length=0;flashA=0;tintT=0;tintA=0;if(window.__hmShake){window.__hmShake.x=0;window.__hmShake.y=0;window.__hmShake.mag=0;}if(cv&&ctx){ctx.clearRect(0,0,vw,vh);cv.style.marginLeft="0px";cv.style.marginTop="0px";}}   // hard stop: wipe everything the instant a game ends, even if the loop was throttled
  return {burst:burst,ring:ring,spark:spark,flash:flash,tint:tint,hitstop:hitstop,shake:shake,clear:clear};
 })();
 window.__hmFX=FX;
 // a team-coloured confetti palette: the winner's colour, lightened and darkened, so the
 // shower still has depth without turning into a rainbow that belongs to nobody.
 window.__hmTeamConfetti=function(rgbStr){ if(!rgbStr)return null;
  var p=String(rgbStr).split(",").map(function(v){return parseInt(v,10);});
  if(p.length<3||p.some(isNaN))return null;
  function mix(f){ return "rgb("+p.map(function(v){
    return Math.max(0,Math.min(255,Math.round(f>0? v+(255-v)*f : v*(1+f))));}).join(",")+")"; }
  return [mix(.34),mix(.16),mix(0),mix(-.16),mix(-.3),mix(.5)];
 };
 /* ===== GAMES ARE A PLAY-PAGE THING NOW =====
    Declared HERE, above the first module, not below it: injectAbilCSS() and the two other
    style injections run at parse time, so a `var GAMES` further down would still be
    undefined when they test it and play.html would silently lose its ability CSS.
    This file is one closure: the ambient heads AND soccer AND the battle AND Floor is Lava
    AND the marble race. index.html loads it for the ambient heads only -- every launcher and
    every line of game CSS left the home page in Task 5, so no game can be started there.
    But four of the game modules BUILD THEIR DOM AT INIT rather than on game start: 20
    .hmPlat slabs, .battleCount, two .hmCount shouts, the four .hmLava* layers, .hmRaceBoard,
    and one .hmHp bar per head. The now-deleted CSS is what used to hold those out of flow,
    so without it they landed in .hero as ordinary blocks and added ~860px to it -- the
    headline measured at top:1025 and the big head at top:1148, both well below an 800px
    fold, on a page that opened on empty space.
    The fix is to keep them out of the document where no game can run, rather than to hide
    them with rules index.html is not meant to carry any more. gAdd() is the whole change:
    the elements are still built and every module keeps every reference, export and code
    path it had, so play.html -- where GAMES is true -- behaves exactly as before.
    GAMES is true when a page opts in via window.__hmGames, or when #playArena exists, which
    is play.html's arena and nothing else. Both, so neither is a single point of failure. */
 var GAMES=!!(window.__hmGames||document.getElementById("playArena"));
 function gAdd(host,el){if(GAMES&&host&&el)host.appendChild(el);return el;}
 // ===== BATTLE ABILITIES: mystery crates -> physics-chaos powers, all juiced off FX =====
 (function injectAbilCSS(){if(!GAMES)return;   // crate/ability rules: nothing on the home page can ever spawn a crate
  var s=document.createElement("style");s.textContent=
   ".hmCrate{position:absolute;left:0;top:0;width:36px;height:36px;border-radius:9px;background:linear-gradient(155deg,#d0a86f,#a9793f);box-shadow:inset 0 2px 0 rgba(255,255,255,.4),inset 0 -3px 6px rgba(0,0,0,.25),0 6px 14px -6px rgba(40,26,10,.5);border:1.5px solid rgba(90,60,25,.5);display:flex;align-items:center;justify-content:center;font-family:var(--sans);font-weight:600;font-size:20px;color:#5a3c17;z-index:3;pointer-events:none;transition:opacity .3s;will-change:transform}"
  +".hmAbLabel{position:absolute;transform:translate(-50%,0);font-family:var(--sans);font-weight:600;font-size:var(--fs-small);white-space:nowrap;pointer-events:none;z-index:47;text-shadow:0 1px 3px rgba(255,255,255,.95),0 0 8px rgba(255,255,255,.85),0 0 3px #fff}"
  +".hmBomb{position:absolute;left:0;top:0;width:28px;height:28px;font-size:24px;line-height:28px;text-align:center;z-index:4;pointer-events:none;will-change:transform;filter:drop-shadow(0 3px 4px rgba(0,0,0,.35))}"
  +".hmBanana{position:absolute;left:0;top:0;width:26px;height:26px;font-size:22px;line-height:26px;text-align:center;z-index:3;pointer-events:none;will-change:transform;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))}"
  +".hmIce{position:absolute;left:0;top:0;border-radius:12px;background:linear-gradient(150deg,rgba(200,236,250,.5),rgba(130,200,235,.42));box-shadow:inset 0 0 0 2px rgba(255,255,255,.65),inset 0 0 18px rgba(120,190,230,.55),0 0 14px rgba(150,210,240,.5);z-index:5;pointer-events:none;will-change:transform}"
  +".hmVortex{position:absolute;left:0;top:0;width:60px;height:60px;font-size:52px;line-height:60px;text-align:center;z-index:4;pointer-events:none;will-change:transform;filter:drop-shadow(0 0 12px rgba(120,80,200,.7))}"
  +".hmMissile{position:absolute;left:0;top:0;width:26px;height:26px;font-size:22px;line-height:26px;text-align:center;z-index:4;pointer-events:none;will-change:transform;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))}"
  +".hmIceFloor{position:absolute;left:0;right:0;height:8px;background:linear-gradient(180deg,rgba(180,225,245,.85),rgba(150,210,240,.25));box-shadow:0 0 16px rgba(150,210,240,.7),inset 0 1px 0 rgba(255,255,255,.9);z-index:1;pointer-events:none;opacity:0;transition:opacity .4s}";
   document.head.appendChild(s);})();
 var CRATES=[],PROPS=[],crateAt=0;
 function heroEl(){return document.querySelector(".hero");}
 function battleActive(){return document.body.classList.contains("hmBattle");}
 function mkEl(cls,html){var d=document.createElement("div");d.className=cls;if(html!=null)d.innerHTML=html;return d;}
 function rivalNear(me,cx,cy){var best=null,bd=1e9;for(var i=0;i<peers.length;i++){var p=peers[i];if(p===me||p.elim||!p.inB)continue;var d=Math.hypot((p.x+p.HW/2)-cx,(p.y+p.HH/2)-cy);if(d<bd){bd=d;best=p;}}return best;}
 function knockRadial(cx,cy,radius,power,dmg,color){for(var i=0;i<peers.length;i++){var p=peers[i];if(p.elim||!p.inB)continue;
   var px=p.x+p.HW/2,py=p.y+p.HH/2,dx=px-cx,dy=py-cy,d=Math.hypot(dx,dy)||1;if(d>radius)continue;var f=1-d/radius,nx=dx/d;
   p.__launch={vx:nx*power*f,vy:-Math.abs(power*f)*0.7-120};if(dmg)p.dmgIn=(p.dmgIn||0)+dmg*f;}
  if(FX){FX.ring(cx,cy,{r0:8,r1:radius*1.05,color:color||"255,150,40",width:5,life:0.5});FX.shake(Math.min(18,power*0.02));}}
 function freezeHead(t,dur){if(!t||t.elim)return;t.__frozen=performance.now()+dur;var h=heroEl();if(!h)return;
  var ice=mkEl("hmIce");h.appendChild(ice);PROPS.push({t:"ice",target:t,el:ice,until:performance.now()+dur});
  if(FX)FX.burst(t.x+t.HW/2,t.y+t.HH/2,{count:14,color:"180,225,245",speed:220,gravity:150,life:0.6,size:4,shape:"shard"});}
 function spawnBomb(cx,cy){var h=heroEl();if(!h)return;var el=mkEl("hmBomb","💣");h.appendChild(el);
  PROPS.push({t:"bomb",x:cx,y:cy,vx:(Math.random()*100-50),vy:-300,el:el,fuse:performance.now()+1150});}
 function slip(pe){pe.__spin=performance.now()+1000;pe.__launch={vx:(Math.random()<0.5?-1:1)*280,vy:-320};if(FX)FX.burst(pe.x+pe.HW/2,pe.y+pe.HH*0.5,{count:10,color:"240,210,70",speed:200,gravity:200,life:0.5,size:3});}
 function spawnBanana(cx,cy){var h=heroEl();if(!h)return;var el=mkEl("hmBanana","🍌");h.appendChild(el);
  PROPS.push({t:"banana",x:cx,y:cy,vx:(Math.random()*160-80),vy:-220,el:el,live:0,until:performance.now()+9000});}
 function spawnVortex(cx,cy){var h=heroEl();if(!h)return;var el=mkEl("hmVortex","🕳️");h.appendChild(el);el.style.transform="translate("+(cx-30)+"px,"+(cy-30)+"px)";
  if(FX)FX.tint("120,80,200",0.09,1.6);PROPS.push({t:"vortex",x:cx,y:cy,el:el,rot:0,until:performance.now()+1500});}
 function spawnMissile(cx,cy,owner){var h=heroEl();if(!h)return;var el=mkEl("hmMissile","🎯");h.appendChild(el);
  PROPS.push({t:"missile",x:cx,y:cy-18,vx:0,vy:-40,el:el,owner:owner,target:rivalNear(owner,cx,cy),until:performance.now()+3000});}
 function iceFloorShow(dur){var h=heroEl();if(!h)return;var gy=(window.__hmGroundY!=null?window.__hmGroundY:h.clientHeight-24);var el=mkEl("hmIceFloor");el.style.top=(gy-2)+"px";h.appendChild(el);requestAnimationFrame(function(){el.style.opacity="1";});
  setTimeout(function(){el.style.opacity="0";setTimeout(function(){try{el.remove();}catch(_){}},450);},dur);}
 function explodeBomb(p){if(FX){FX.flash("255,225,160",0.42);FX.burst(p.x,p.y,{count:26,color:"255,140,40",speed:440,gravity:500,life:0.7,size:5});FX.burst(p.x,p.y,{count:12,color:"50,50,55",speed:220,gravity:260,life:0.9,size:6});FX.hitstop(85);}
  knockRadial(p.x,p.y,190,560,11,"255,150,40");try{p.el.remove();}catch(_){}}
 function clearAbilities(){var i;for(i=0;i<CRATES.length;i++){try{CRATES[i].el.remove();}catch(_){}}CRATES.length=0;
  for(i=0;i<PROPS.length;i++){try{PROPS[i].el.remove();if(PROPS[i].target)PROPS[i].target.__frozen=0;}catch(_){}}PROPS.length=0;window.__hmGrav=null;}
 window.__hmClearAbilities=clearAbilities;
 var ABIL=[
  {id:"bomb",name:"Bomb",glyph:"💣",color:"255,120,40",weight:10,fire:function(A){spawnBomb(A.cx,A.cy);A.pop(0.9);}},
  {id:"gravflip",name:"Gravity Flip",glyph:"🔄",color:"150,90,220",weight:6,fire:function(A){
    window.__hmGrav={f:-0.5,until:performance.now()+2600};
    for(var i=0;i<peers.length;i++){var p=peers[i];if(p.elim||!p.inB)continue;p.__launch={vy:-140,vx:(Math.random()*80-40)};}
    if(FX){FX.tint("150,90,220",0.15,3);FX.flash("210,190,255",0.16);
     for(var k=0;k<peers.length;k++){var q=peers[k];FX.burst(q.x+q.HW/2,q.y+q.HH,{count:6,color:"150,90,220",speed:130,gravity:-160,life:0.8,size:3,shape:"streak",dir:-1.57,spread:0.5});}}}},
  {id:"freeze",name:"Freeze",glyph:"❄️",color:"120,200,235",weight:8,fire:function(A){var t=rivalNear(A.me,A.cx,A.cy);if(t)freezeHead(t,2200);A.pop(0.94);}},
  {id:"rocket",name:"Rocket",glyph:"🚀",color:"255,140,40",weight:9,fire:function(A){A.pop(1.12);A.aura("255,140,40",3600);
    A.buff(3600,function(A2,dt){var t=rivalNear(A2.me,A2.cx,A2.cy);if(t){var dx=(t.x+t.HW/2)-A2.cx,dy=(t.y+t.HH/2)-A2.cy,d=Math.hypot(dx,dy)||1;A2.launch(dx/d*560,dy/d*560);}
     if(FX)FX.burst(A2.cx,A2.cy+A2.HH*0.32,{count:2,color:"255,150,50",speed:80,gravity:-30,life:0.34,size:4});},null);}},
  {id:"shockwave",name:"Shockwave",glyph:"💥",color:"255,190,60",weight:9,fire:function(A){knockRadial(A.cx,A.cy,220,480,7,"255,190,60");A.pop(0.82);if(FX)FX.burst(A.cx,A.cy+A.HH*0.4,{count:14,color:"200,190,170",speed:210,gravity:420,life:0.5,size:4});}},
  {id:"blink",name:"Blink",glyph:"✨",color:"170,110,240",weight:7,fire:function(A){var ox=A.cx,oy=A.cy,t=rivalNear(A.me,ox,oy);if(FX)FX.burst(ox,oy,{count:18,color:"170,110,240",speed:280,gravity:0,life:0.4,size:4});
    if(t){var side=(ox>(t.x+t.HW/2))?1:-1,bx=(t.x+t.HW/2)+side*(t.HW*0.7+A.HW);A.warp(bx-A.HW/2,t.y);if(FX)FX.burst(bx,t.y+A.HH/2,{count:18,color:"170,110,240",speed:280,gravity:0,life:0.4,size:4});}
    else A.warp(60+Math.random()*600,90);}},
  {id:"magnet",name:"Magnet",glyph:"🧲",color:"225,70,180",weight:7,fire:function(A){A.pop(0.9);A.aura("225,70,180",1500);
    A.buff(1500,function(A2){for(var i=0;i<peers.length;i++){var p=peers[i];if(p===A2.me||p.elim||!p.inB)continue;var dx=A2.cx-(p.x+p.HW/2),dy=A2.cy-(p.y+p.HH/2),d=Math.hypot(dx,dy)||1;p.__launch={vx:dx/d*Math.min(560,d*3.2),vy:dy/d*Math.min(460,d*2.6)-30};}
     if(FX)FX.ring(A2.cx,A2.cy,{r0:12,r1:150,color:"225,70,180",width:3,life:0.4});},null);}},
  {id:"windgust",name:"Wind Gust",glyph:"🌬️",color:"90,190,200",weight:7,fire:function(A){var d=(Math.random()<0.5?-1:1);window.__hmWind={ax:d*950,v:d*297,until:performance.now()+1800};
    for(var i=0;i<peers.length;i++){var p=peers[i];if(p.elim||!p.inB)continue;p.__launch={vx:d*200,vy:-70};}
    if(FX){FX.tint("120,200,210",0.1,1.8);for(var k=0;k<22;k++)FX.burst(d>0?10:770,90+Math.random()*220,{count:1,color:"120,200,210",speed:360,gravity:0,life:0.7,size:3,shape:"streak",dir:d>0?0:3.14159,spread:0.15});}}},
  {id:"icefloor",name:"Ice Floor",glyph:"🧊",color:"120,200,235",weight:7,fire:function(A){window.__hmIce=performance.now()+4500;if(FX)FX.tint("150,215,240",0.12,4.5);iceFloorShow(4500);}},
  {id:"quake",name:"Earthquake",glyph:"🫨",color:"160,115,70",weight:7,fire:function(A){A.pop(0.9);
    A.buff(2000,function(A2){if(FX)FX.shake(10);if(Math.random()<0.45){for(var i=0;i<peers.length;i++){var p=peers[i];if(p.elim||!p.inB||p.__launch)continue;if(p.ground&&Math.random()<0.5)p.__launch={vx:(Math.random()*180-90),vy:-(150+Math.random()*150)};}}},null);
    if(FX)FX.tint("160,115,70",0.08,2);}},
  {id:"blackhole",name:"Black Hole",glyph:"🕳️",color:"120,80,200",weight:5,fire:function(A){spawnVortex(A.cx,Math.max(70,A.cy-30));}},
  {id:"banana",name:"Banana",glyph:"🍌",color:"240,200,50",weight:8,fire:function(A){spawnBanana(A.cx,A.cy);A.pop(0.92);}},
  {id:"disco",name:"Disco Stun",glyph:"🕺",color:"230,80,200",weight:7,fire:function(A){var t=rivalNear(A.me,A.cx,A.cy);if(t){t.__disco=performance.now()+2600;if(FX){FX.burst(t.x+t.HW/2,t.y+t.HH/2,{count:16,color:"230,80,200",speed:220,gravity:100,life:0.7,size:4});FX.ring(t.x+t.HW/2,t.y+t.HH/2,{r0:8,r1:72,color:"230,80,200",width:3,life:0.5});}}A.pop(0.95);}},
  {id:"homing",name:"Missile",glyph:"🎯",color:"235,70,70",weight:8,fire:function(A){spawnMissile(A.cx,A.cy,A.me);}},
  {id:"rage",name:"Rage",glyph:"😤",color:"235,60,50",weight:8,fire:function(A){A.me.__rage=performance.now()+5200;A.pop(1.14);A.aura("235,60,50",5200);
    A.buff(5200,function(A2){if(FX&&Math.random()<0.5)FX.burst(A2.cx,A2.cy,{count:2,color:"235,70,55",speed:60,gravity:-20,life:0.5,size:5});},null);}},
  {id:"speedster",name:"Speedster",glyph:"⚡",color:"70,200,235",weight:8,fire:function(A){A.me.__speed=performance.now()+5000;A.me.__bounce=performance.now()+5000;A.pop(1.1);A.aura("70,200,235",5000);A.launch(A.dir*420,-360);
    A.buff(5000,function(A2){if(FX)FX.burst(A2.cx,A2.cy+A2.HH*0.2,{count:1,color:"70,200,235",speed:16,gravity:0,life:0.28,size:5});
     if(Math.random()<0.06){var t=rivalNear(A2.me,A2.cx,A2.cy);if(t){var dx=(t.x+t.HW/2)-A2.cx,dy=(t.y+t.HH/2)-A2.cy,d=Math.hypot(dx,dy)||1;A2.launch(dx/d*720,dy/d*720-60);}}},null);}},
  {id:"feather",name:"Feather",glyph:"🪶",color:"200,205,215",weight:7,fire:function(A){A.me.__feather=performance.now()+5200;A.launch(A.dir*60,-120);A.pop(1.05);A.aura("175,185,205",5200);
    A.buff(5200,function(A2){if(FX&&Math.random()<0.4)FX.burst(A2.cx+(Math.random()*A2.HW-A2.HW/2),A2.cy,{count:1,color:"210,215,225",speed:16,gravity:-8,life:0.9,size:4});},null);}},
  {id:"bounce",name:"Super Bounce",glyph:"🏀",color:"90,200,120",weight:8,fire:function(A){A.me.__bounce=performance.now()+5200;A.launch(A.dir*160,-620);A.pop(1.12);A.aura("90,200,120",5200);}}
 ];
 var _wsum=0;ABIL.forEach(function(a){_wsum+=a.weight;});
 function pickAbil(){var r=Math.random()*_wsum;for(var i=0;i<ABIL.length;i++){r-=ABIL[i].weight;if(r<=0)return ABIL[i];}return ABIL[0];}
 window.__hmAbilIds=function(){return ABIL.map(function(a){return a.id;});};
 function nameFlash(cx,cy,ab){var h=heroEl();if(!h)return;var d=mkEl("hmAbLabel",ab.glyph+" "+ab.name);d.style.color="rgb("+ab.color+")";d.style.left=cx+"px";d.style.top=(cy-14)+"px";h.appendChild(d);
  var t0=performance.now();(function an(n){var p=(n-t0)/1150;if(p>=1){try{d.remove();}catch(_){}return;}d.style.transform="translate(-50%,"+(-p*44).toFixed(0)+"px)";d.style.opacity=(p<0.14?p/0.14:1-(p-0.14)/0.86).toFixed(2);requestAnimationFrame(an);})(t0);}
 function spawnCrate(){var h=heroEl();if(!h||!battlePlats.length)return;var pl=battlePlats[(Math.random()*battlePlats.length)|0];if(!pl)return;var r=18,span=Math.max(0,(pl.r-pl.l)-70),cx=(pl.l+pl.r)/2+(Math.random()*span-span/2),cy=pl.t-r-3;
  var el=mkEl("hmCrate","?");h.appendChild(el);el.style.transform="translate("+(cx-r)+"px,"+(cy-r)+"px)";el.style.opacity="0";requestAnimationFrame(function(){el.style.opacity="1";});
  CRATES.push({x:cx,y:cy,r:r,el:el,bob:Math.random()*6});}
 function smashCrate(cr,A){var i=CRATES.indexOf(cr);if(i<0)return;CRATES.splice(i,1);
  if(FX){FX.burst(cr.x,cr.y,{count:16,color:"180,130,70",speed:250,gravity:750,life:0.6,size:4,shape:"square"});FX.ring(cr.x,cr.y,{r0:6,r1:58,color:"200,160,90",width:3,life:0.4});}
  try{cr.el.remove();}catch(_){}
  var ab=pickAbil();nameFlash(cr.x,cr.y,ab);try{ab.fire(A);}catch(_){}}
 window.__hmSmashCrates=function(){return CRATES.length;};   // test helper
 var abilTicking=false;
 function startAbilTick(){if(abilTicking)return;abilTicking=true;var lt=performance.now();
  (function bt(n){var dt=Math.min(0.05,(n-lt)/1000);lt=n;if(!battleActive()){clearAbilities();abilTicking=false;return;}
    var gy=(window.__hmGroundY!=null?window.__hmGroundY:(heroEl()?heroEl().clientHeight-24:400));
    if(!window.__hmLavaOn&&n>=crateAt&&CRATES.length<2&&battlePlats.length&&n>=(window.__hmBattleGo||0)){crateAt=n+3400+Math.random()*2800;spawnCrate();}   // Floor-is-Lava is pure survival: no crates
    for(var i=0;i<CRATES.length;i++){var c=CRATES[i];c.bob+=dt;c.el.style.transform="translate("+(c.x-c.r).toFixed(1)+"px,"+(c.y-c.r+Math.sin(c.bob*2.6)*4).toFixed(1)+"px)";}
    for(var j=PROPS.length-1;j>=0;j--){var p=PROPS[j];
     if(p.t==="bomb"){p.vy+=2600*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.y>gy){p.y=gy;p.vy*=-0.42;p.vx*=0.6;}p.el.style.transform="translate("+(p.x-14).toFixed(1)+"px,"+(p.y-24).toFixed(1)+"px)";
      if(n>=p.fuse){explodeBomb(p);PROPS.splice(j,1);}}
     else if(p.t==="ice"){var t=p.target;if(!t||t.elim){t&&(t.__frozen=0);try{p.el.remove();}catch(_){}PROPS.splice(j,1);continue;}
      p.el.style.transform="translate("+(t.x-5).toFixed(1)+"px,"+(t.y-5).toFixed(1)+"px)";p.el.style.width=(t.HW+10)+"px";p.el.style.height=(t.HH*0.9+10)+"px";
      if(n>=p.until){if(FX)FX.burst(t.x+t.HW/2,t.y+t.HH/2,{count:18,color:"205,238,250",speed:300,gravity:420,life:0.6,size:4,shape:"shard"});t.__frozen=0;try{p.el.remove();}catch(_){}PROPS.splice(j,1);}}
     else if(p.t==="banana"){if(!p.live){p.vy+=2600*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.y>=gy){p.y=gy;p.live=1;}}
      p.el.style.transform="translate("+(p.x-13).toFixed(1)+"px,"+(p.y-22).toFixed(1)+"px)";
      if(p.live){for(var bq=0;bq<peers.length;bq++){var be=peers[bq];if(be.elim||!be.inB||(be.__spin&&n<be.__spin))continue;var bfeet=be.y+be.HH*0.94;if(Math.abs((be.x+be.HW/2)-p.x)<be.HW*0.55&&Math.abs(bfeet-p.y)<28){slip(be);try{p.el.remove();}catch(_){}PROPS.splice(j,1);break;}}}
      if(PROPS[j]===p&&n>=p.until){try{p.el.remove();}catch(_){}PROPS.splice(j,1);}}
     else if(p.t==="vortex"){p.rot+=dt*520;p.el.style.transform="translate("+(p.x-30).toFixed(1)+"px,"+(p.y-30).toFixed(1)+"px) rotate("+p.rot.toFixed(0)+"deg)";
      for(var vq=0;vq<peers.length;vq++){var ve=peers[vq];if(ve.elim||!ve.inB)continue;var vdx=p.x-(ve.x+ve.HW/2),vdy=p.y-(ve.y+ve.HH/2),vd=Math.hypot(vdx,vdy)||1;if(vd<260)ve.__launch={vx:vdx/vd*Math.min(620,vd*4),vy:vdy/vd*Math.min(520,vd*3.4)};}
      if(FX&&Math.random()<0.6)FX.burst(p.x+(Math.random()*80-40),p.y+(Math.random()*80-40),{count:1,color:"150,100,220",speed:10,gravity:0,life:0.5,size:3});
      if(n>=p.until){knockRadial(p.x,p.y,240,620,6,"150,100,220");if(FX){FX.flash("190,160,240",0.3);FX.burst(p.x,p.y,{count:24,color:"150,100,220",speed:420,gravity:200,life:0.7,size:4});}try{p.el.remove();}catch(_){}PROPS.splice(j,1);}}
     else if(p.t==="missile"){var mt=p.target;if(!mt||mt.elim)mt=p.target=rivalNear(p.owner,p.x,p.y);
      if(mt){var mdx=(mt.x+mt.HW/2)-p.x,mdy=(mt.y+mt.HH/2)-p.y,md=Math.hypot(mdx,mdy)||1;p.vx+=(mdx/md*720-p.vx)*Math.min(1,dt*6);p.vy+=(mdy/md*720-p.vy)*Math.min(1,dt*6);}
      p.x+=p.vx*dt;p.y+=p.vy*dt;var mang=Math.atan2(p.vy,p.vx)*57.3;p.el.style.transform="translate("+(p.x-13).toFixed(1)+"px,"+(p.y-13).toFixed(1)+"px) rotate("+mang.toFixed(0)+"deg)";
      if(FX)FX.burst(p.x,p.y,{count:1,color:"235,90,70",speed:30,gravity:0,life:0.3,size:3});
      if(mt&&Math.abs((mt.x+mt.HW/2)-p.x)<mt.HW*0.6&&Math.abs((mt.y+mt.HH/2)-p.y)<mt.HH*0.6){knockRadial(p.x,p.y,120,460,9,"235,90,70");if(FX){FX.flash("255,180,150",0.28);FX.hitstop(70);}try{p.el.remove();}catch(_){}PROPS.splice(j,1);}
      else if(n>=p.until){if(FX)FX.burst(p.x,p.y,{count:12,color:"235,90,70",speed:240,gravity:300,life:0.5,size:4});try{p.el.remove();}catch(_){}PROPS.splice(j,1);}}}
    requestAnimationFrame(bt);})(lt);}
 setInterval(function(){if(battleActive())startAbilTick();},600);
 // ===== THE PITCH PLANET: render-curved, physics-flat =====
 // Jayden: "in play.html they should be sitting on that gradient planet and jumping around on it --
 // so just on the pitch." The measured verdict is in
 // docs/superpowers/specs/2026-08-02-planet-pitch-research.md §2.3-§2.5 and it is settled:
 //   * to hide a drawn globe's curvature UNDER a flat walk line you need R > 102,400px -- 160x the
 //     pitch half-width. That is not a globe, it is a flat floor with a rounding error.
 //   * at a radius that actually READS as a globe (R ~ 8,000px) the surface sags 25.6px over +/-640,
 //     so heads at the wings would float a quarter of a head above it. "Planet as backdrop" is out.
 // So the ground is curved at RENDER time only -- the same trick Animal Crossing plays, bending the
 // world in the vertex shader while the collision world stays flat. survey(), floorY, __hmFeetY,
 // __hmGroundY, geo() and all 49 `surface=floorY` assignments never learn about it. That is what keeps
 // the load-bearing seating rule ("every head's FEET share the line, whatever its size") true, and it
 // is what makes SAG=0 a byte-for-byte revert of this entire idea rather than a tuning value.
 // Never extended past .hmSoccer: lava already owns an x-varying surface (__hmLavaY) and the two
 // would fight. Every call site below is gated on soccerOn, so off the pitch this costs literally nothing.
 var ARC=(function(){
  var w=-1,half=1,cx=0,sag=0,over=null;
  // JAYDEN, 2026-08-03: "For the planet, I wanted the planet to be in the lobby, not the match."
  // So the curve is OFF on the pitch. The research's own escape hatch is what makes that a one-flag
  // decision rather than a revert: every term below is ADDITIVE, so at sag=0 every call site emits
  // character-for-character the string this engine emitted before any of this existed. The mechanism
  // stays, inert, because the lobby globe is the same maths at a radius ~25x smaller and this is
  // where it was proved out -- type __hmSag(25.6) in the console to switch the pitch curve on and look.
  var CURVE=false;
  function sync(){var nw=heroBox.width||innerWidth;if(nw===w)return;w=nw;half=Math.max(1,w/2);cx=w/2;
   sag=(over!=null)?over:(CURVE?Math.max(12,Math.min(30,w*0.020)):0);}   // the live formula, when it is on: clamp(0.020*pitchWidth,12,30) -- 25.6px at 1280, 28.8 at 1440, 12 (clamped) at 390. Real radius ~8,000px, max surface tilt 4.6deg: enough to feel in the head rotation, small enough that nobody expects Mario-Galaxy radial gravity out of it.
  return{
   // The drop below the apex. A PARABOLA, not a circle: at R=5,000 / d=640 the two differ by 0.14px,
   // and the parabola's derivative -- the surface normal -- is exact and free.
   y:function(x){sync();var u=(x-cx)/half;return sag*u*u;},
   deg:function(x){sync();return Math.atan2(2*sag*(x-cx)/(half*half),1)*57.2958;},   // the surface normal, in degrees. Characters obeying the curve is the #1 "this is a planet" cue (Mario Kart's ring of Miis, Galaxy's normal-aligned Mario) -- and here it costs one addend to surfRot, which is already a sum of six terms.
   sag:function(){sync();return sag;},half:function(){sync();return half;},cx:function(){sync();return cx;},
   set:function(v){over=(v==null?null:+v);w=-1;}
  };})();
 // Live tuning knob, per the research's pass-0 recommendation: type __hmSag(0) in the console and the
 // render is the old build exactly; __hmSag() reads the current value back.
 try{window.__hmSag=function(v){if(v===undefined)return ARC.sag();ARC.set(v);return ARC.sag();};}catch(_){}
 // THE REFLECTION'S STRENGTH, relative to the contact shadow. This is the ONLY number separating the
 // two -- everything else about how they answer "how far off the ground is this head" is the same
 // two values, so they cannot drift apart as either is tuned. It is read from --head-refl-gain once
 // per layout rather than per frame (a custom-property read is a style lookup; 15 heads x 60fps is
 // not the place for one), which keeps the per-frame cost at transform + opacity and nothing else.
 // A dark surface sets --head-refl-gain on body the same way it sets --head-shadow.
 // ===== THE LOBBY PLANET: heads bouncing in 3D on a sphere =====
 // Jayden: "make sure the heads are bouncing in 3D space on the planet -- not on the flat plane
 // they are in in the soccer and home page. They should freely bounce around on the planet surface,
 // just like in Mario Kart online."
 //
 // This is a SECOND MODE, not a change to the first. The soccer pitch and the home hero keep one
 // flat shared floorY and one __hmFeetY, untouched and unread by any line below -- that relationship
 // is what the goals, the ball, the tournament and the whole seating rule are built on. A head in
 // the lobby stops being an (x,y) on a line and becomes an ANGLE on a sphere: theta around the disc
 // plus a height above its surface. Gravity stops pointing down the screen and points at the
 // planet's centre. Nothing here runs unless the lobby is up.
 //
 // The planet's size and position belong to the hub, not to the engine: this reads whatever element
 // in .hero carries [data-hm-orb] and derives the centre and the radius from its box. The hub can
 // move it, resize it, or take it away, and the physics follows without an edit here.
 var ORB=(function(){
  var live=false,cx=0,cy=0,R=1,t=-1e9;
  function sync(now){
   if(now-t<250)return live;   // one getBoundingClientRect per 250ms for the WHOLE crowd, not one per head per frame
   t=now;
   var b=document.body.classList;
   if(!b.contains("pHubOn")||b.contains("hmSoccer")||b.contains("hmBattle")){live=false;return false;}
   var h=document.querySelector(".hero"),el=h&&h.querySelector("[data-hm-orb]");
   if(!h||!el){live=false;return false;}
   var r=el.getBoundingClientRect(),hr=h.getBoundingClientRect();
   if(!r.width){live=false;return false;}
   R=r.width/2;cx=r.left-hr.left+R;cy=r.top-hr.top+r.height/2;   // hero-local, the same space the heads live in
   live=true;return true;}
  // How far round the head may walk. Bounded to the front-facing arc rather than wrapping round the
  // back: a head at the limb is edge-on to the camera and reads as a sliver, and one that walked
  // behind the planet would have to be occluded by it, which is a z-order problem this page does not
  // need. So they walk to the edge of the lit face and turn round. 38deg is the cap -- at that lean
  // the curve is unmistakable and the head is still comfortably upright -- and it tightens further
  // if the disc is wide enough that 38deg would push a head off the side of the screen.
  function arcMax(HW,heroW){return Math.min(0.663,Math.asin(Math.max(0.08,Math.min(1,(heroW/2-HW*0.75)/R))));}
  return{sync:sync,live:function(){return live;},R:function(){return R;},cx:function(){return cx;},cy:function(){return cy;},arcMax:arcMax};
 })();
 // IS THE LOBBY UP? Jayden: "I do want the room to be reflective like the soccer." The pitch has had
 // honest per-head reflections since the water landed; the lobby -- the room he actually meant -- had
 // none, because the one gate below read `soccerOn` and nothing else.
 // This is one shared, throttled read of body.classList for the WHOLE crowd, deliberately the same
 // shape as ORB.sync above and for the same reason: a per-head classList test every frame is N reads
 // per frame for a fact that changes a handful of times in a session. 250ms of lag on a surface
 // appearing is invisible; N DOM reads per frame are not.
 // pHubOn is set by play-games.js and exists ONLY on play.html. index.html loads this engine and does
 // NOT load play.css, so a lobby reflection there would be an unmasked, unfiltered flipped copy of
 // every head -- gating on the hub's own class is what keeps this on the one page that dresses it.
 var LOBBY=(function(){var on=false,t=-1e9;
  return function(now){if(now-t<250)return on;t=now;var b=document.body.classList;
   on=b.contains("pHubOn")&&!b.contains("hmSoccer")&&!b.contains("hmBattle")&&!b.contains("hmTour")&&!window.__hmRaceOn;
   return on;};})();
 var REFL_K=0.9;
 // PERSPECTIVE COMPRESSION -- the reason a straight scale(1,-1) reads as a pasted, flipped copy.
 // A mirror is not what a viewer standing above a reflective surface sees: the reflection recedes
 // away from the eye while the object rises toward it, so the reflected image is vertically
 // FORESHORTENED. Derived, not picked. Assumed camera: the low side-on broadcast view this stage
 // already implies -- eye 2.2 head-heights above the pitch and 5.5 back, i.e. the waterline sitting
 // 21.8deg below the horizon. For an object of height h at horizontal distance D with the eye at e:
 //     object angular height     = atan((h-e)/D) + atan(e/D)   = 0.1657 rad
 //     reflection angular height = atan((h+e)/D) - atan(e/D)   = 0.1460 rad
 //     ratio                                                   = 0.881
 // Worth being honest about the size of this: perspective compression is real but it is NOT the
 // biggest tell -- at any plausible camera it lands between 0.88 and 0.93, and only a very high
 // viewpoint (which this flat side-on stage does not have) compresses harder. The falloff shape,
 // the surface breaking the image up and the contrast loss (all in play.css) are each worth more.
 var REFL_PERSP=0.88;
 // The drawn surface. Two elements, no canvas, no WebGL, no rAF: .hmPlanet carries the ground passes
 // and is masked to an ellipse whose top edge IS arcY (so the horizon and the feet cannot disagree),
 // .hmSky carries the rim that escapes the silhouette upward plus the band of not-page-background above
 // the line. Both are positioned entirely by four custom properties, written once per layout.
 var PL_UP=120;   // how far ABOVE the horizon .hmPlanet/.hmSky start, so the rim has room to bleed
 function planetDOM(){
  var h=document.querySelector(".hero");if(!h)return;
  if(!h.querySelector(".hmPlanet")){
   var sky=document.createElement("div");sky.className="hmSky";sky.setAttribute("aria-hidden","true");
   var pl=document.createElement("div");pl.className="hmPlanet";pl.setAttribute("aria-hidden","true");
   h.insertBefore(sky,h.firstChild);h.insertBefore(pl,h.firstChild);}   // FIRST children: both sit at z-index 0, so within that layer DOM order decides, and the ground has to paint before .tPitch and the scoreboard
  if(!h.querySelector(".hmWater")){var wt=document.createElement("div");wt.className="hmWater";wt.setAttribute("aria-hidden","true");h.appendChild(wt);}
  // .hmWater is appended HERE on purpose: after every head reflection (created at spawn) and before
  // camBack (created on the next line of soccer's dom()). z-index 1 throughout, so paint order is DOM
  // order and the whole stack resolves itself -- ripple over reflections, ball/goal shadows over ripple
  // -- without touching a single z-index.
 }
 function planetGeo(groundY){
  var h=document.querySelector(".hero");if(!h)return;
  refreshHeroBox();   // ARC reads the SHARED hero box, which is rAF-throttled: a resize reaches soccer's geo() (a direct getBoundingClientRect) a frame before it reaches the cache, so baking the planet here without this measured the OLD width and then never ran again. geo() has just flushed layout anyway, so this rect is free.
  var half=ARC.half(),S=ARC.sag(),A=half*3;   // the limb sits at +/-3x the pitch half-width, i.e. a full pitch width off-screen on each side. Gradient contract B1: a cropped orb is UI, a centered orb is a poster -- and an on-screen limb is exactly what makes it read as "a ball they are standing on".
  var B=S/(1-Math.sqrt(Math.max(1e-9,1-(half/A)*(half/A))));   // solve for the ellipse whose top edge passes through arcY EXACTLY at the wings; across the span it tracks the parabola to well under a pixel
  h.style.setProperty("--pl-a",A.toFixed(1)+"px");
  h.style.setProperty("--pl-b",B.toFixed(1)+"px");
  h.style.setProperty("--pl-cy",(B+PL_UP).toFixed(1)+"px");
  h.style.setProperty("--pl-top",(groundY-PL_UP).toFixed(1)+"px");   // all three elements share ONE box, so the horizon they draw and the arc the heads walk cannot drift apart
  var _rk=parseFloat(getComputedStyle(h).getPropertyValue("--head-refl-gain"));
  if(_rk===_rk&&_rk>=0)REFL_K=_rk;   // NaN-safe: an unset property parses to NaN and leaves the 0.9 default standing
  h.classList.toggle("hmFlatPitch",!(S>0));   // SAG=0 is the revert switch, so it has to take the DRAWN planet with it: a zero-height mask ellipse is degenerate, and "no curve" should mean the pitch exactly as it was.
 }
 function spawnCompanion(data,slot){
 var reduce=matchMedia("(prefers-reduced-motion:reduce)").matches;
 var filler=!!(data&&data.__filler);   // the mid-game stand-in (mini-Jayden): spawns already active, no intro
 var noIntro=filler||!!(data&&data.__noIntro);   // ...but __filler ALSO means 1.5x size. Tournament squads
 // need the skip-the-intro half only, so they get their own flag and stay normal sized.
 var bootSeated=!filler&&(!!(data&&data.__bootSeated)||document.body.classList.contains("playBooting"));
 // Play holds its first viewport behind a readiness class. Initial saved/fallback heads therefore
 // start already seated; __noIntro keeps its existing falling entrance for later game spawns.
 var smileT=0,smiling=false;   // only the mini-Jayden has a second face to switch to (his real smile)
 var _W9=false;try{_W9=/[?&]wraf=1/.test(location.search);}catch(_){}   // dev-only: publishes whether the keeper's leash is saturated this frame, for the bundle probe
 var hero=document.querySelector(".hero");if(!hero)return;
 if(getComputedStyle(hero).position==="static")hero.style.position="relative";
 var mob=innerWidth<=880;
 var stEl0=document.getElementById("stage"),stR0=stEl0?stEl0.getBoundingClientRect():null;
 var _arenaW=hero.clientWidth||innerWidth;
 var HW=stR0&&stR0.width?Math.round(Math.min(108,Math.max(66,stR0.width*0.27)))
       :Math.round(Math.min(108,Math.max(66,_arenaW*0.075)));   // ceiling matched to the #stage
       // path's own 108 (fix round 2) -- a play.html head should never render bigger than the
       // biggest a companion has ever been drawn on index.html. Consistency call, not a taste
       // call; the 0.075 coefficient itself is untouched and still provisional pending Jayden.
 if(mob)HW=Math.min(HW,64);
 if(filler)HW=Math.round(HW*1.5);   // mini-Jayden stays noticeably BIGGER than the little heads -- his
 // size is his identity, not a depth cue (same rule as survey()'s bigR-gated *1.5 below, which never
 // fires on THIS page since there's no #stage to measure. On index.html this value is transient: bigR
 // always exists there at spawn, so survey() -- called synchronously a few lines down -- immediately
 // recomputes HW from bigR and reapplies its own *1.5, overwriting this. Net effect on index.html: none.
 var HH=HW*1.2;   // one size: about a quarter of the caregiver, the classic companion ratio
 // --- DOM ---
 var root=document.createElement("div");
 root.style.cssText="position:absolute;left:0;top:0;width:"+HW+"px;height:"+HH+"px;z-index:3;cursor:grab;touch-action:none;opacity:0;filter:blur(6px);transition:opacity .5s steps(4,end),filter .5s steps(4,end);will-change:transform;transform-origin:50% 94%;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent";
 var im=document.createElement("img");im.src=data.cut;im.alt="";im.draggable=false;
 im.style.cssText="width:100%;height:100%;pointer-events:none;-webkit-user-drag:none";
 root.appendChild(im);
 var hurtEl=document.createElement("div");
 hurtEl.style.cssText="position:absolute;inset:0;background:rgba(196,52,38,.85);opacity:0;pointer-events:none;z-index:5;-webkit-mask-image:url("+data.cut+");-webkit-mask-size:100% 100%;mask-image:url("+data.cut+");mask-size:100% 100%";   // z-index above the eye/mouth layers, so the hurt flash washes the WHOLE face red -- not a red head with untinted eyes floating in it
 root.appendChild(hurtEl);
 var ringEl=document.createElement("div");   // the team OUTLINE: a crisp colored rim in the head's own shape
 ringEl.style.cssText="position:absolute;inset:0;-webkit-mask:url("+data.cut+") center/100% 100% no-repeat;mask:url("+data.cut+") center/100% 100% no-repeat;transform:scale(1.075);opacity:0;transition:opacity .3s;z-index:-1;pointer-events:none";
 root.appendChild(ringEl);
 var auraEl=document.createElement("div");   // self-buff HALO: shows at a glance WHO is powered up, in the ability's signature colour
 auraEl.style.cssText="position:absolute;left:50%;top:45%;width:165%;height:165%;transform:translate(-50%,-50%);border-radius:50%;opacity:0;transition:opacity .2s;z-index:-2;pointer-events:none;will-change:opacity";
 root.appendChild(auraEl);
 var crownEl=document.createElement("div");   // the champion's crown
 crownEl.style.cssText="position:absolute;left:50%;top:-24%;width:46%;transform:translateX(-50%);opacity:0;transition:opacity .3s;pointer-events:none;z-index:5";
 crownEl.innerHTML='<svg viewBox="0 0 48 34" width="100%" aria-hidden="true"><path d="M4 30 L4 15 L13 22 L24 6 L35 22 L44 15 L44 30 Z" fill="#e8b53a" stroke="#c9962a" stroke-width="1.2" stroke-linejoin="round"/><circle cx="4" cy="13" r="3.4" fill="#f0c94e"/><circle cx="24" cy="4" r="3.8" fill="#f0c94e"/><circle cx="44" cy="13" r="3.4" fill="#f0c94e"/><rect x="4" y="30" width="40" height="3.4" rx="1.4" fill="#d7a531"/></svg>';
 root.appendChild(crownEl);
 var shadow=document.createElement("div");
 shadow.className="hmShadow";
 // THE ONE SHADOW THIS SITE KEEPS -- the heads cast it because they stand on something -- and until
 // now its ink was a literal inside a cssText string. No stylesheet and no media query can reach an
 // inline style attribute written by JS, so a dark ground would have left every head with a black
 // smudge under it and nothing to stand on. Routing the ink through two custom properties fixes that
 // without moving the declaration: an inline var() still resolves against the element's own INHERITED
 // custom properties, so play.css (or a dark block on body, or index.html) can rebind --head-shadow
 // and this picks it up. With neither property defined the fallbacks are the old 8,8,8 / .26 exactly,
 // so index.html -- which loads this same file -- renders byte-for-byte what it rendered before.
 shadow.style.cssText="position:absolute;left:0;top:0;width:"+HW+"px;height:"+(HW*0.22)+"px;border-radius:50%;background:radial-gradient(ellipse at center,rgba(var(--head-shadow,8,8,8),var(--head-shadow-a,.26)),rgba(var(--head-shadow,8,8,8),0) 70%);pointer-events:none;z-index:2;opacity:0;transition:opacity .5s cubic-bezier(.22,1,.36,1);will-change:transform";
 // THE REFLECTION. One silhouette div per head, on the SAME source the face rig already uses
 // (data.cut) -- not a clone of the head. The head is a rig (cut-out layers, two eyes with their
 // ::before/::after iris stacks, brows, mouth, crown, HP bar); cloning it would double the DOM and
 // double the per-frame style writes for something drawn at =<34% opacity behind a ripple. And not
 // -webkit-box-reflect either, which mirrors about the element's LOCAL bottom edge and so gives a
 // head leaning +8deg a reflection leaning +8deg -- a real mirror leans -8. On a site where heads
 // lean, wobble, flip and now tilt to a surface normal, that is wrong in every frame that matters.
 // Falloff is a mask-image, never a blur: play.css declares exactly TWO filter:blur() rules today
 // and this adds none. transform-origin matches the head's own 50%/94% so the mirror maths below is
 // one scale(1,-1) in front of the head's own rotation, with no sign juggling.
 var refl=document.createElement("div");refl.className="hmRefl";refl.setAttribute("aria-hidden","true");
 refl.style.cssText="position:absolute;left:0;top:0;pointer-events:none;width:"+HW+"px;height:"+HH+"px;background-image:url("+data.cut+")";
 /* WHY THERE IS NO DEPTH-NORMALISING PROPERTY HERE, HAVING BRIEFLY SHIPPED ONE.
    Measured at 1440, a little head's reflection is drawn 77.6px deep and the mini-Jayden's 117.5px --
    ratio 1.500, exactly his size ratio, with depth/HH identical at 0.599 vs 0.605. So the rule the
    code implements is "the same FRACTION of your own box", and the obvious reading is that a shared
    floor should extinguish every image at a shared DEPTH. That was built, and it is wrong twice over.
    First, it CAPS him -- it takes reflection away from the head that has it, where the standing
    instruction is to loosen the tighter side and never tighten the looser one.
    Second, and the reason the depth reading is a red herring: the mask percentages are fractions of
    the BOX, and the two heads' ink does not start in the same place inside their boxes. A little
    head's ink runs 0.058->0.938 of its box; bakeMiniCut draws his square portrait into a 5:6 frame
    and seats it on the shared FOOT, so his runs 0.227->0.933 and a fifth of his box is empty above
    his hair. One flat 74% cut therefore eats 20% of a little head and 3% of him: he keeps 95% of his
    face where everyone else keeps 77%. "More of his reflection is shown" is more of the FACE, not
    more pixels, and it is identical at any size -- so his 1.5x is not the cause and must not be
    touched. The fix is to anchor the falloff between each head's own ink top and ink bottom, both of
    which the pixel scan already produces per head (crownFrac and FOOT).
    That analysis and its play.css half are written up in
    docs/superpowers/specs/2026-08-11-refl-mask-handover.patch.md. The engine side is deliberately
    NOT applied ahead of it, so there is one mechanism and one story rather than two half-built ones. */
 var _reflFoot=-1;   // the foot line the reflection is currently pivoting on; re-written when the pixel scan changes FOOT
 var orbOn=false,orbA=0,orbAV=0,orbH=0,orbVH=0,orbGoal=0,orbNext=0;   // THE LOBBY PLANET: this head's angle round the disc, its angular speed, its height above the surface and the radial speed of the hop. Entirely separate from x/y/vx/vy/floorY, which keep meaning exactly what they meant.
 // position is set INLINE, not left to play.css: index.html does not link play.css,
 // so on the home page this div arrived unstyled -- a static, display:block box HH tall per head,
 // sitting in normal flow and shoving the hero (and the head) down once per companion. That is
 // the "adding eggheads pushes everything down" bug. Only POSITION is forced inline -- play.css
 // still owns visibility via opacity, so play.html is untouched and an inline display would have
 // silently killed the reflections there (inline beats a stylesheet).
 // --- the face rig: HIS iris classes, their skin ---
 var eyesArr=data.eyes||[],mk=data.marks||null,eyeEls3=[],ew0=eyesArr[0]?eyesArr[0].w:0.08;
 function strip(cx,cy,ww,hh){var d=document.createElement("div");
  d.style.cssText="position:absolute;pointer-events:none;background-repeat:no-repeat;-webkit-mask-image:radial-gradient(ellipse at center,#000 55%,transparent 82%);mask-image:radial-gradient(ellipse at center,#000 55%,transparent 82%)";
  d.style.width=(ww*100)+"%";d.style.height=(hh*100)+"%";d.style.left=((cx-ww/2)*100)+"%";d.style.top=((cy-hh/2)*100)+"%";
  d.style.backgroundImage="url("+data.cut+")";d.style.backgroundSize=(100/ww)+"% "+(100/hh)+"%";
  d.style.backgroundPosition=((cx-ww/2)/(1-ww)*100)+"% "+((cy-hh/2)/(1-hh)*100)+"%";
  root.appendChild(d);return d;}
 var oneWhite2=(function(){function px3(cc){var m=/rgb\((\d+), ?(\d+), ?(\d+)/.exec(cc||"");return m?[+m[1],+m[2],+m[3]]:[239,236,231];}
  var pa=px3(eyesArr[0]&&eyesArr[0].sc),pb=px3(eyesArr[1]&&eyesArr[1].sc);
  var mr=(pa[0]+pb[0])/2,mg=(pa[1]+pb[1])/2,mb2=(pa[2]+pb[2])/2;
  var Lw=mr*0.299+mg*0.587+mb2*0.114;
  if(Lw>208){var kw=208/Lw;mr*=kw;mg*=kw*0.997;mb2*=kw*0.975;}   // the realism ceiling: real eye whites photograph around L200, never paper
  return"rgb("+Math.round(mr)+","+Math.round(mg)+","+Math.round(mb2)+")";})();
 var owm=/rgb\((\d+),\s*(\d+),\s*(\d+)/.exec(oneWhite2)||[0,239,236,231],owr=+owm[1],owg=+owm[2],owb=+owm[3];
 var owB="rgb("+Math.min(255,owr+4)+","+Math.min(255,owg+4)+","+Math.min(255,owb+3)+")";   // catches the light, gently
 var owD="rgb("+Math.round(owr*0.78)+","+Math.round(owg*0.76)+","+Math.round(owb*0.72)+")"; // turns away from it, decisively
 eyesArr.forEach(function(c){
  var w2=c.w*0.94, h2=Math.max(c.w*0.26,Math.min(c.w*0.44,(c.h||c.w*0.3)*1.05));   // the window is the aperture they marked
  var cvW=w2*1.18,cvH=h2*1.55/1.2;   // their own skin hides the photo's eye: nothing white ever bleeds onto the face
  var cov=document.createElement("div");
  cov.style.cssText="position:absolute;pointer-events:none;background-repeat:no-repeat;-webkit-mask-image:radial-gradient(ellipse at center,#000 48%,transparent 82%);mask-image:radial-gradient(ellipse at center,#000 48%,transparent 82%)";
  cov.style.width=(cvW*100)+"%";cov.style.height=(cvH*100)+"%";cov.style.left=((c.x-cvW/2)*100)+"%";cov.style.top=((c.y-cvH/2)*100)+"%";
  cov.style.backgroundImage="url("+data.cut+")";cov.style.backgroundSize=(100/cvW)+"% "+(100/cvH)+"%";
  cov.style.backgroundPosition=((c.x-cvW/2)/(1-cvW)*100)+"% "+(((c.y+c.h*1.55)-cvH/2)/(1-cvH)*100)+"%";
  root.appendChild(cov);
  var ALM="50% 50% 50% 50% / 66% 66% 34% 34%";   // upper-heavy almond: the top lid arcs, the bottom barely does
  cov.style.transform="rotate("+(c.ang||0)+"rad)";
  var e=document.createElement("div");e.className="eye";e.style.borderRadius=ALM;
  e.style.left=((c.x-w2/2)*100)+"%";e.style.top=((c.y-h2/2/1.2)*100)+"%";e.style.width=(w2*100)+"%";e.style.height=(h2/1.2*100)+"%";   /* /1.2: the box is 1:1.2, heights need the aspect taken out */
  e.style.webkitMaskImage="radial-gradient(ellipse at center,#000 74%,rgba(0,0,0,.55) 88%,transparent 99%)";e.style.maskImage="radial-gradient(ellipse at center,#000 74%,rgba(0,0,0,.55) 88%,transparent 99%)";   /* no outline: the sclera recedes under the lids, so its edge is a fade, never a line */
  var irD=c.w*0.54;   // the INFANT ratio, not the adult 42%: a newborn iris is near adult size in a small aperture, and this head is the baby of the pair
  var ir=document.createElement("div");ir.className="iris";
  ir.style.width=(irD/w2*100)+"%";ir.style.height=(irD/h2*100)+"%";ir.style.left=((0.5-irD/w2/2)*100)+"%";ir.style.top=((0.5-irD/h2/2)*100)+"%";ir.style.borderRadius="50%";
  var icc=(c.ic&&c.ic.length===3)?c.ic:[38,29,23];   // THEIR iris colour; heads saved before simply stay dark
  function ikk(k){return Math.round(icc[0]*k)+","+Math.round(icc[1]*k)+","+Math.round(icc[2]*k);}
  ir.style.background="radial-gradient(circle at 39% 33%,rgb("+ikk(1.35)+") 0%,rgb("+ikk(1.02)+") 32%,rgb("+ikk(0.7)+") 62%,rgb("+ikk(0.42)+") 88%,rgb("+ikk(0.3)+") 100%)";
  var pu=document.createElement("div");pu.className="pupil";ir.appendChild(pu);
  var gl=document.createElement("div");gl.className="glint";
  gl.style.width=(0.19*irD/w2*100)+"%";gl.style.height=(0.19*irD/h2*100)+"%";gl.style.left="37%";gl.style.top=((0.5-irD/h2/2)*100+irD/h2*30)+"%";   // on the iris, never clipped by the lid
  var fill=document.createElement("div");   // the white is a lit sphere, not a flat paint chip
  fill.style.cssText="position:absolute;inset:0;background:radial-gradient(ellipse at 16% 50%,rgba(112,80,60,.13),rgba(112,80,60,0) 32%),radial-gradient(ellipse at 84% 50%,rgba(112,80,60,.13),rgba(112,80,60,0) 32%),radial-gradient(ellipse at 50% 38%,"+owB+" 0%,"+oneWhite2+" 52%,"+owD+" 100%)";
  var shd=document.createElement("div");    // the upper lid throws a soft shadow across everything
  shd.style.cssText="position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,rgba(58,40,30,0) 68%,rgba(58,40,30,.15) 96%),linear-gradient(to bottom,rgba(46,32,26,.5) 0%,rgba(46,32,26,.18) 26%,rgba(46,32,26,0) 52%),linear-gradient(to top,rgba(255,255,255,.09) 0%,rgba(255,255,255,0) 16%)";
  var gl2=document.createElement("div");gl2.className="glint";
  gl2.style.width=(0.10*irD/w2*100)+"%";gl2.style.height=(0.10*irD/h2*100)+"%";gl2.style.left=(50+irD/w2*14)+"%";gl2.style.top=(50+irD/h2*15)+"%";gl2.style.opacity="0.45";
  e.appendChild(fill);e.appendChild(ir);e.appendChild(shd);e.appendChild(gl);e.appendChild(gl2);root.appendChild(e);
  var lidW=c.w*0.95,lidH=c.w*0.6/1.2;   // /1.2 aspect-corrects the lid height like the eye and cover, so a blink hugs the eye instead of riding onto the forehead
  var lw=document.createElement("div");lw.style.cssText="position:absolute;overflow:hidden;pointer-events:none";lw.style.borderRadius=ALM;lw.style.transform="rotate("+(c.ang||0)+"rad)";
  lw.style.width=(lidW*100)+"%";lw.style.height=(lidH*100)+"%";lw.style.left=((c.x-lidW/2)*100)+"%";lw.style.top=((c.y-lidH/2)*100)+"%";
  lw.style.zIndex="4";
  var ls=document.createElement("div");ls.style.cssText="position:absolute;inset:0;transform:translateY(-105%)";
  ls.style.backgroundImage="url("+data.cut+")";ls.style.backgroundSize=(100/lidW)+"% "+(100/lidH)+"%";
  ls.style.backgroundPosition=((c.x-lidW/2)/(1-lidW)*100)+"% "+(((c.y+c.h*1.55)-lidH/2)/(1-lidH)*100)+"%";
  lw.appendChild(ls);root.appendChild(lw);
  eyeEls3.push({iris:ir,glint:gl,lid:ls,box:e,cov:cov,lidWin:lw,ang:(c.ang||0)*57.2958});
 });
 var brows=[],mouth=null,nose=null;
 if(mk){brows=[strip(mk.BL.x,mk.BL.y,ew0*1.5,ew0*0.9),strip(mk.BR.x,mk.BR.y,ew0*1.5,ew0*0.9)];
  nose=strip(mk.N.x,mk.N.y,ew0*1.1,ew0*1.2);mouth=strip(mk.M.x,mk.M.y,ew0*1.8,ew0*0.95);mouth.style.transformOrigin="50% 18%";}
 var mjClone=null,mjBigFace=null,mjBigW=500;   // MINI-JAYDEN: it isn't a bake, it's the actual big head cloned + shrunk, mirrored live every frame (mjBigW = big head's px width, to scale his pixel-based gaze down to mini size)
 if(filler&&data.__mirror){try{var bigStage=document.getElementById("stage");if(bigStage){
  im.style.display="none";eyeEls3.forEach(function(e){if(e.box)e.box.style.display="none";if(e.cov)e.cov.style.display="none";if(e.lidWin)e.lidWin.style.display="none";});   // drop the ENTIRE companion eye rig -- not just the .eye box, but its skin cover (cov) and lid window (lw) too. Those sit at z>=0 in front of the clone (z0) and painted his real eyes over with skin patches + washed-white ovals. The clone IS the face now.
  if(nose)nose.style.display="none";if(mouth)mouth.style.display="none";brows.forEach(function(b){b.style.display="none";});
  mjClone=bigStage.cloneNode(true);mjClone.removeAttribute("id");
  var _idd=mjClone.querySelectorAll("[id]");for(var _ii=0;_ii<_idd.length;_ii++)_idd[_ii].removeAttribute("id");
  mjClone.style.cssText="position:absolute;left:0;top:0;width:100%;height:83.333%;pointer-events:none;z-index:0";   // the WHOLE big head, shrunk -- every element, exactly as he is
  // KILL the ink filters on the shrunk copy: the ink (feDisplacementMap) displaces by an ABSOLUTE ~1px, tuned for a 44px eye. On the mini's ~12px eye that 1px smears the iris, glint and white together into a dark hollow -- the eyes read as SHUT. The hand-drawn wobble is invisible at this size anyway, so dropping it costs nothing and gives him back real open eyes. (Only ever showed in real Chrome, where the SVG filters actually render.) Set filter:none INLINE on every node -- the clone isn't in the DOM yet, so getComputedStyle can't tell us which carry url(#ink...); an unconditional strip is safe since the only filtered things here are the eyes and hidden overlays.
  mjClone.style.filter="none";var _fd=mjClone.querySelectorAll("*");for(var _fi=0;_fi<_fd.length;_fi++){try{_fd[_fi].style.filter="none";}catch(_){}}
  // the overlays (glasses/mouth/tongue/etc.) are hidden on the big head via id-scoped CSS that breaks once the id is gone; freeze their current opacity so they stay hidden -- and DON'T remove them, so it stays an exact copy
  var _bk=bigStage.children,_ck=mjClone.children;
  for(var _ki=0;_ki<_ck.length&&_ki<_bk.length;_ki++){try{_ck[_ki].style.opacity=getComputedStyle(_bk[_ki]).opacity;}catch(_){}}
  if(im.nextSibling)root.insertBefore(mjClone,im.nextSibling);else root.appendChild(mjClone);
  mjBigFace=document.getElementById("face");mjBigW=bigStage.getBoundingClientRect().width||500;   // his rendered width, so we can scale his gaze translate to the mini
  // RE-AIM the team outline (soccer) + hurt flash: both are masked by data.cut stretched over the FULL root, which is calibrated for the little heads' `im`. The mini's visible face is the CLONE -- object-fit:contain of his SQUARE face in the top 83.333% of root -- so the stretched bake floated the ring off to the side. Replicate the clone's exact face box (top 83.3%, square source, contain) so the rim hugs him.
  /* THE CROWN FOLLOWS THE FACE, BECAUSE ON HIM THE FACE IS NOT AT THE TOP OF THE BOX.
     crownEl is positioned `top:-24%` against the ROOT box, which assumes the drawn head starts at the
     box's top edge. For every bake that is true -- measured, a little head's face top and its root top
     are the same pixel. The mini-Jayden is the only head whose face is a CLONE, and the clone carries
     the down-nudge below, so his hair starts 0.225*HH lower: 43.74px at 1440. His crown was therefore
     floating a clear 44px above his hair while everyone else's sat ON it.
     His 1.5x size is NOT the bug and is not touched -- the offset is expressed as a fraction of HH, so
     it is the same visual gap at any size. Both numbers are derived from _MJ_DROP so the nudge and the
     crown cannot drift apart the way they just did: move the face and the crown moves with it.

     ...AND THE NUDGE WAS ONLY HALF OF WHY HIS HAIR IS LOW, WHICH IS WHY THE CROWN STILL FLOATED.
     The correction above counts the clone's translate and stops there, which assumes the portrait's
     ink starts at the top of its own frame. It does not, twice over: #face is inset inside #stage,
     and the cut itself carries transparent headroom above the hair (its data-head-bounds top term).
     Measured on a settled frame at 1440, his DRAWN hair top sits 0.442 of HH below his box top
     against the 0.225 this line was correcting for -- so the crown hung ~36px clear of his head
     while a little head's crown base sits 3.4px off its own ink. A screenshot of the two side by
     side is unambiguous.
     BOTH remaining terms are MEASURED off the live portrait rather than written down -- the inset of
     #face inside #stage, and the cut's own declared headroom -- so a re-framed stage or a re-cut face
     moves the crown with it and this cannot go stale a third time. Anything missing or out of range
     falls back to 0, which is exactly the behaviour this line had before.
     His 1.5x size is still NOT the bug and is still untouched: every term here is a fraction, so the
     crown sits in the same place on his head at any size. */
  var _MJ_HB=0;   // where the drawn ink starts, as a fraction of the CLONE's own height
  try{var _fEl=mjBigFace||document.getElementById("face");
   var _sR=bigStage.getBoundingClientRect(),_fR=_fEl?_fEl.getBoundingClientRect():null,_hbT=0;
   var _hbA=_fEl&&_fEl.getAttribute("data-head-bounds");
   if(_hbA){var _hbP=String(_hbA).trim().split(/\s+/);
    if(_hbP.length>1){var _hbV=parseFloat(_hbP[1]);
     if(_hbV===_hbV&&_hbV>=0&&_hbV<0.6)_hbT=_hbV;}}
   if(_fR&&_fR.height>0&&_sR.height>0)_MJ_HB=((_fR.top-_sR.top)+_hbT*_fR.height)/_sR.height;
   if(!(_MJ_HB>=0&&_MJ_HB<0.6))_MJ_HB=0;}catch(_){}   // NaN-safe, and refuses a nonsense value rather than flinging the crown off-screen
  var _MJ_DROP=0.27,_MJ_FACE=(_MJ_DROP+_MJ_HB)*(5/6);   // of the clone's own height, then as a fraction of HH (the clone is 83.333% of the root)
  try{ringEl.style.display="none";hurtEl.style.display="none";mjClone.style.transform="translateY("+(_MJ_DROP*100)+"%)";
   crownEl.style.top=(-24+_MJ_FACE*100).toFixed(3)+"%";}catch(_){}   // the mask-based ring/hurt never tracked his mirrored face -- his team ring is now a drop-shadow ON the rendered face itself (pixel-perfect through every flip and expression)   // MINI-JAYDEN: a gentle DOWN-nudge so his (bigger) face reads more level with the row instead of floating higher, without dropping his chin below the slab -- render-only, feet/shadow/physics unchanged
 }}catch(_){mjClone=null;}}
 var bar=document.createElement("div");bar.className="hmHp";bar.setAttribute("aria-hidden","true");
 var barFill=document.createElement("i");bar.appendChild(barFill);
 // THE REFLECTION GOES IN UNDER THE WATER, NOT MERELY EARLY. .hmRefl and .hmWater are both
 // z-index 1, so DOM order alone decides which paints on top, and the argument that used to live
 // here -- "the reflection goes in first, .hmWater and camBack are created later" -- is only true
 // for heads that exist BEFORE kickoff. It silently stops being true for every head that spawns
 // once a pitch is already on screen, and there are three such paths in normal use: the mini-Jayden
 // filler that tops up an odd roster, every tournament squad, and "Add your head" during a match.
 // Measured: with five heads seeded and one filler added mid-game, the five pre-match reflections
 // land at DOM indices 30-46 (before .hmWater at 50) and the filler's lands at 55 -- ABOVE the
 // ripple AND above camBack. That head's reflection then sits ON the water instead of in it, which
 // is precisely the "fake reflection" reading Jayden rejected, appearing only for some heads in
 // some matches. Hence: anchor to .hmWater when there is one, append when there is not.
 var _wt=hero.querySelector(".hmWater");
 if(_wt)hero.insertBefore(refl,_wt);else hero.appendChild(refl);
 hero.appendChild(shadow);hero.appendChild(root);gAdd(hero,bar);   // the .hmHp bar is game furniture: only a match ever fills it.
 // --- world geometry ---
 var heroR,floorY,plats,avoids,bigR,M=40,WL=2,WR=9999,FOOT=0.945,crownFrac=0.08;window.__hmFOOT=FOOT;
 (function(){try{var ci=new Image();ci.onload=function(){try{
  var cv3=document.createElement("canvas");cv3.width=36;cv3.height=44;var cx3=cv3.getContext("2d");
  cx3.drawImage(ci,0,0,36,44);var d3=cx3.getImageData(0,0,36,44).data;
  for(var row=43;row>=0;row--){for(var col=0;col<36;col++){if(d3[(row*36+col)*4+3]>40){
   FOOT=Math.min(0.99,(row+1)/44);window.__hmFOOT=FOOT;
   try{survey();}catch(_){}   // RE-SURVEY. floorY is computed as fY-HH*FOOT inside survey(), which runs
   // SYNCHRONOUSLY at spawn -- but this scan is an image onload, so it always lands after it. Every
   // head therefore stood on the DEFAULT 0.945. For a normal cutout that is nearly right (their real
   // foot line is 0.932, a 1.7px error nobody sees). Mini-Jayden's cut is baked into a 5:6 frame with
   // the face in the top square, so his true foot line is 0.75 -- and he hung 38px above the floor
   // while every egghead stood on it. Recomputing here costs one extra survey per head, once.
   return;}}}
 }catch(_){}};ci.src=data.cut;}catch(_){}})();   // its own true foot line, from its own pixels
 (function(){try{var fi=document.getElementById("face");function scan(){try{
  var cv=document.createElement("canvas");cv.width=36;cv.height=44;var cx2=cv.getContext("2d");
  cx2.drawImage(fi,0,0,36,44);var d=cx2.getImageData(0,0,36,44).data;
  for(var row=0;row<44;row++){var solid=0;for(var col=0;col<36;col++){if(d[(row*36+col)*4+3]>40)solid++;}
   if(solid>=9){crownFrac=row/44;return;}}   // the hair mass, not a stray wisp
 }catch(_){}}
 if(fi&&fi.complete&&fi.naturalWidth)scan();else if(fi)fi.addEventListener("load",scan);}catch(_){}})();
 function survey(){
  // THE PLANE THIS HEAD WAS SEATED AGAINST WHEN survey() WAS ENTERED. Captured here and nowhere
  // later, because floorY is written twice below (once off fY, once again after the size branches)
  // and the re-seat at the bottom has to compare against what the head was ACTUALLY standing on.
  // Read the note on that clause for what taking this reading in the wrong place cost.
  var floorWas=floorY;
  heroR={w:hero.clientWidth,h:hero.clientHeight};
  var hr=hero.getBoundingClientRect();
  function rel(el){if(!el)return null;var r=el.getBoundingClientRect();if(!r.width)return null;return{l:r.left-hr.left,t:r.top-hr.top,r:r.right-hr.left,b:r.bottom-hr.top};}
  bigR=rel(document.getElementById("stage"));                     // the big head is the one solid thing besides the walls
  var gameOn=document.body.classList.contains("hmSoccer")||document.body.classList.contains("hmBattle");   // during a game the big head STEPS OFF (fades + shifts) and the hero box measures shorter -- so his position is NOT the floor then
  var fY;
  // The floor used to clamp to heroR.h-2, which only reserves room for the FEET. The shadow is
  // drawn at floorY+HH-4 and is HW*0.22 tall, so its bottom lands ~HW*0.29 BELOW the feet line --
  // and the hero's bottom is the viewport fold (min-height:100vh - 68). Measured with 5 heads:
  // 1440x620 clipped the shadows by 6.4px, and 700/760/820 cleared by only 2.0/0.8/3.0px.
  // Reserve the shadow's drop so the whole standing head fits. On tall viewports bigR.b is well
  // clear of this cap, so Math.min still picks his chin and nothing moves.
  var FLOORCAP=heroR.h-(mob?64:108)*0.34-2;   // clearance sized off the LARGEST head, not this one:
  // HW varies per head (the 1.5x mini-Jayden), so an HW-dependent cap gave every head its own
  // floor, each publishing a different __hmFeetY -- which is why the goals visibly jittered.
  if(bigR&&!gameOn){fY=Math.min(bigR.b,FLOORCAP);sharedFeetY=fY;} // trust his chin as the floor only in his normal resting spot; remember it
  else fY=(sharedFeetY!=null?sharedFeetY:(bigR?Math.min(bigR.b,FLOORCAP):FLOORCAP));   // mid-game (mini-Jayden spawns here) reuse the CACHED resting floor -> every head shares one plane
  if(document.body.classList.contains("hmFull"))fY=FLOORCAP;   // PHONE, GAME RUNNING: the arena is
  // now the whole screen, so the floor is the bottom of THAT -- not the resting spot cached while the
  // hero was still 491px. Without this the pitch sat mid-screen with ~290px of dead space under it.
  try{window.__hmFeetY=fY;}catch(_){}   // publish the shared feet plane: soccer's geo() needs the SAME floor or the goals stand on a different ground than the players
  floorY=fY-HH*FOOT;                                               // feet (the visible chin, not the transparent padding) rest on that shared floor, whatever the head's size
  M=mob?16:40;plats=[];avoids=[];
  var ow=heroR?heroR.w:0;
  /* THE SAME RECT, NOT A SECOND ONE. Nothing between hr above and this line
     writes to the tree, so this was a second forced layout for a value already
     in hand -- and survey() runs once per head, so it was N of them. */
  var hb=hr;WL=-hb.left-HW*0.35;WR=innerWidth-hb.left-HW*0.65;CEIL=-(hb.top+window.scrollY)-HH*0.12;if(document.body.classList.contains("hmFull")){var _socWall=document.body.classList.contains("hmSoccer"),_gwp=_socWall?(mob?28:40):2;CEIL=_socWall?_gwp:2;WL=-hb.left+_gwp;WR=innerWidth-hb.left-HW-_gwp;}   // PHONE, GAME RUNNING: the arena now fills the screen and the nav sits right on top of it, so the ceiling stops at the hero instead of letting heads (and their health bars) climb over the wordmark. Soccer reserves the half-diagonal overhang of a rotating/squashing player at the sides and ceiling, so the painted box remains inside the arena; other games retain their authored edge behavior.   // it presses into the glass on every side; the VISIBLE crown reaches the top, not the box
  if(ow&&Math.abs(ow-hero.clientWidth)>2)x=x/ow*hero.clientWidth;   // resizing keeps its relative spot
  if(bigR){var nHW=Math.round(Math.min(108,Math.max(66,(bigR.r-bigR.l)*0.27)));if(mob)nHW=Math.min(nHW,64);
   if(filler)nHW=Math.round(nHW*1.5);   // the mini-Jayden stays noticeably BIGGER (Jayden liked this) -- but he's on the SAME flat plane + ground line as everyone else; his size is his identity, not a depth cue
   if(Math.abs(nHW-HW)>2){HW=nHW;HH=HW*1.2;root.style.width=HW+"px";root.style.height=HH+"px";shadow.style.width=HW+"px";shadow.style.height=(HW*0.22)+"px";refl.style.width=HW+"px";refl.style.height=HH+"px";}}
  else{   // FALLBACK PATH (play.html: no #stage). This mirrors spawnCompanion's own initial
   // HW formula (arenaW*0.075, clamped [66,108], then the mobile 64 cap and the filler 1.5x)
   // instead of the #stage-relative one above, because there is no big head to measure here --
   // but it was only ever APPLIED at spawn. Resizing the window left every head at its spawn
   // size (measured: heads spawned at 1280px stayed 96px wide after resizing down to 390px,
   // where a fresh spawn there would have clamped to 64px) because this whole recompute lived
   // inside `if(bigR)`, which is always false on this page. Give the fallback its own recompute
   // so it actually responds to resize() the same way the #stage path always did.
   var fHW=Math.round(Math.min(108,Math.max(66,(heroR.w||innerWidth)*0.075)));if(mob)fHW=Math.min(fHW,64);
   if(filler)fHW=Math.round(fHW*1.5);
   if(Math.abs(fHW-HW)>2){HW=fHW;HH=HW*1.2;root.style.width=HW+"px";root.style.height=HH+"px";shadow.style.width=HW+"px";shadow.style.height=(HW*0.22)+"px";refl.style.width=HW+"px";refl.style.height=HH+"px";}}
  // ---- RE-DERIVE THE FLOOR. floorY was computed above as fY-HH*FOOT, but BOTH size branches
  // just ran and either of them may have rewritten HH -- so a head whose box changed size was
  // left seating against the floor of its OLD height and hovered (or sank) by exactly
  // (HH_new-HH_old)*FOOT until the next resize happened to leave its size alone. Measured on
  // play.html, 1280->700 mid-fixture: every egghead rested 49.2px above the shared feet plane
  // (HH 129.6->76.8) while mini-Jayden, whose box is 1.5x, rested 73.8px above it -- a 24.6px
  // step between a captain and his own squad-mates, which is the reported "captains float".
  // The rule is that every head's FEET share the ground line whatever its size, so the answer is
  // to re-seat the floor under the new height, never to nudge y. Costs one subtraction per
  // survey(), and is a no-op on the (common) frames where neither branch changed HH.
  // The shadow needs nothing further: its box was resized in the branch above, and its placement
  // is derived per-frame from floorY+HH*FOOT (see shG in the render block), so it follows.
  floorY=fY-HH*FOOT;
  // ...and whoever was STANDING ON THE OLD FLOOR has to come with it. `surface` is the plane this
  // head is currently resting on, so `surface>=floorWas-2` means "on the ground", not "on a
  // platform" -- a head perched on a slab keeps its slab. Re-pointing surface at the new floor
  // matters as much as y does: surface is what the lander snaps to, so leaving it stale just
  // moves the hover one hop into the future. This is the same "stay intact when the screen
  // shrinks" clamp as the line below, made symmetric; it re-seats feet on the ground line rather
  // than offsetting anyone off it.
  //
  // ...AND IT HAS TO BE COMPARED AGAINST THE FLOOR THE HEAD WAS ACTUALLY ON. `floorWas` used to be
  // read on this line, i.e. AFTER line 604 had already written the new floor into floorY -- so it was
  // not the old floor at all, it was the new one, and `floorY!==floorWas` could only ever be true when
  // one of the size branches above had just changed HH. That is the case the clause was written for
  // and it kept working; every OTHER way the ground moves was silently exempt. The ground moves that
  // way constantly on this page: fY is the hero's own height, and the hero is 828 in the hub, 468 in
  // the team picker and 540 with a game owning the viewport. At 1440x900 the feet plane therefore runs
  // 789 -> 429 -> 501 -> 789 across one match, and not one of those steps reached this test. floorWas
  // now comes from the top of survey(), before either write, so it means what it says.
  //
  // AIR IS NOT AN EXEMPTION EITHER. `!air` used to gate the whole clause, and the frame the floor moves
  // is exactly the frame the returning crowd is mid-throw, so the heads that most needed re-seating were
  // the ones it skipped. What `air` legitimately governs is the SNAP, not the re-point: a head in flight
  // keeps its arc and lands on the new plane, a head that was standing comes down with the floor the same
  // frame. So the test moves inside, onto the y write it was always about.
  //
  // These two together are why "a head on a different plane with no shadow under it" (the team picker)
  // and "a head-shaped shadow with no head above it" (returning from a match) are one defect seen from
  // two sides: shG is drawn from floorY, always the CURRENT ground, while the head was left resting on
  // the ground of the stage before. Measured returning from a match at 1440x900: heads stranded 287px
  // above the lobby floor with their shadows on it, still there at +11s.
  if(floorY!==floorWas&&!grabbed&&!perched&&!window.__hmLavaOn&&surface>=floorWas-2){surface=floorY;if(!air&&y<floorY)y=floorY;}
  if(soccerOn&&!window.__hmLavaOn&&!grabbed&&!perched)surface=floorY;
  if(x>WR)x=WR;if(x<WL)x=WL;if(y>floorY)y=floorY;   // stay intact when the screen shrinks
 }
 survey();onResizeFrame(function(){mob=innerWidth<=880;survey();});
 /* ── THE EYE BOX IS MEASURED WHEN IT CHANGES, NOT WHEN IT MOVES ──────────
    _frame read o.box.offsetWidth on the line directly below the one that
    writes o.box.style.transform, so every eye performed a write and then read
    geometry back out of the tree it had just dirtied -- a forced synchronous
    layout. Two eyes on each of twelve heads is twenty-four of them per frame,
    for as long as the tab is open. Measured across one window drag it was 2736
    layout reads, more than every other source on the page put together.
    The width is a function of the head's SIZE and nothing else -- the eyes are
    laid out as a percentage of the head -- and HW is exactly that number, kept
    current by survey(). So the measurement is cached against HW and repeated
    only when the head actually resizes. A zero is never cached: the box has no
    width until the portrait has landed, and caching that would freeze every
    iris at the fallback offset. */
 function eyeBoxW(o){
  if(!o||!o.box)return 34;
  if(o.__bwAt!==HW||!o.__bw){var w=o.box.offsetWidth;if(w>0){o.__bw=w;o.__bwAt=HW;}else return 34;}
  return o.__bw;
 }
 /* ── A WRITE THAT CHANGES NOTHING STILL COSTS EVERYTHING ─────────────────
    .eye carries filter:url(#inkEye) -- an feTurbulence feeding an
    feDisplacementMap, which is the non-accelerated filter path. Chromium
    re-runs that graph whenever the filtered subtree is dirtied, and _frame
    wrote a transform to the eye box, the lid, the iris and the glint on EVERY
    frame regardless of whether the value had changed. The gaze offsets are
    Math.round()ed and the lid string is constant while nobody is blinking, so
    most of those writes set a property to the value it already held -- and
    bought a full filter re-rasterisation, per eye, for an identical picture.
    Twenty-four eyes across twelve heads is twenty-four displacement graphs
    re-run per frame to draw exactly what was already on screen.
    This is the reason to reach for elision rather than for the filter itself:
    the ink is the look. Rendered at 4x and compared side by side, dropping
    filter:url(#inkEye) turns the iris from a ragged, hand-inked disc into a
    geometrically perfect circle -- the pasted-on-sticker reading the whole
    head rig exists to avoid. The filter is kept exactly as authored; a still
    eye simply stops asking for it to be recomputed.
    These four elements are written here and nowhere else in this file, which
    is what makes a cached last-value safe. */
 function setT(el,v){if(!el||el.__lastT===v)return;el.__lastT=v;el.style.transform=v;}
 var _rmSig="";   // the reduced-motion branch's last-written state; see the block that uses it
 function collides(nx,ny,pad){for(var i=0;i<avoids.length;i++){var a=avoids[i];
  if(nx+HW>a.l-pad&&nx<a.r+pad&&ny+HH>a.t-pad&&ny<a.b+pad)return true;}return false;}
 // --- state ---
 var aimX=null,campT=0,recAt=0;   // FLOOR-IS-LAVA AI: aimX = the x this head is steering toward mid-flight (mid-air course-correction), campT = how long it's camped a slab (anti-camp), recAt = throttle for knocked-off recovery
 var _climbA=0;   // how much of the climb-camera's scroll this head has already absorbed (cumulative, so a throttled frame can never desync it from the world)
 var x=bigR?(bigR.l+(bigR.r-bigR.l)/2-HW/2):Math.max(8,heroR.w*0.06),y=bigR?(bigR.t-HH+6):floorY,vx=0,vy=0,dir=1,depth=1,depthT=1,air=false,surface=floorY,
     st="idle",stT=0,hopsLeft=0,grabbed=false,gpx=0,gpy=0,lastPX=0,lastPY=0,pvx=0,pvy=0,
     offAt=0,gone=false,goneUntil=0,decideAt=performance.now()+4200,spin=0,heldOff=0,heldV=0,cTop=false,bornAt=performance.now()+1600,perched=false,hs=1,hsT=1,dockUntil=0,moodB=false,pbAt=0,mirrorAt=0,downT=0,downX=0,downY=0,shakeN=0,heartsF=0,danceHops=0,dblBlink=false,
     bAt=performance.now()+2800,bf=0,brAt=performance.now()+7000,brf=0,moAt=performance.now()+11000,mof=0,
     dzf=0,sqx=1,sqy=1,sqxv=0,sqyv=0,sqxP=1,sqyP=1,sqT=0,shown=false,first=true,tk3=0,gzx=0,gzy=0,sacAt=0,flipA=0,flipV=0,wig=null,wigP=0,bounceN=0,perchT=0,leapDelay=Infinity,hmOverT=0,introSettled=false,bornWall=0,wasAboutB=false,wasHideB=false,introFrames=0,shakeAfter=false,drowse2=false,lastNearT=performance.now(),perchWigAt=performance.now()+9000,greetAt=performance.now()+6000,visitUntil=0,hmOverNow=false,vaulting=false,audAt=0,killed=false,hp=100,crowdT=0,team=0,soccerOn=false,soccerKickSeen=0,soccerWon=false,soccerSeedSeen=0,goalSeen=0,battleOn=false,battleSeen=0,elim=false,elimP=0,celebrated=false,respawnSeen=0,hurtT=0,danceUntil=0,danceHopAt=0,mjHurtUntil=0,hitStop=0,mjExprAt=0,mjExprUntil=0,mjExprKind="",
     pendingHide=null,hideToken=0,lapBack=false,forceHide=/[?&]hide=1/.test(location.search);
 function plane(front){root.style.zIndex="3";shadow.style.zIndex="2";}   // heads ALWAYS stay in front of the big head + the CTA buttons (the back plane is gone) -- cleaner, more premium, no ducking-behind glitches
 var G=2600,DT=0.04,facc=0,CEIL=2,surpriseAt=0;   // real units: px/s and px/s^2, integrated at 25fps
 var me={x:0,y:0,HW:HW,HH:HH,vx:0,vy:0,ground:false,perched:false,kx:0,ky:0,dmgIn:0,inB:false,elim:false,slot:slot,cut:(data&&data.cut)||null,pid:(data&&data.__pid)||null,__filler:filler};me.root=root;   // so the championship spotlight can measure this head
 if(/[?&]wraf=1/.test(location.search))me.__settleProbe=function(){var _ps=window.__hmSoccer;if(_ps&&_ps.on)soccerKickSeen=_ps.kickSeed;survey();var _ord=peers.filter(function(peer){return !peer.__filler;}),_ix=_ord.indexOf(me);if(_ix>=0)x=_ord.length>1?WL+(WR-WL)*_ix/(_ord.length-1):(WL+WR)/2;y=floorY;surface=floorY;vx=vy=0;me.kx=me.ky=0;me.__probeSettled=1;air=false;st="idle";perched=false;grabbed=false;flipA=flipV=0;sqx=sqy=sqxP=sqyP=1;sqxv=sqyv=0;sqT=0;decideAt=performance.now()+1000;};   // DEV-ONLY: acknowledge the current kickoff, distribute ordinary players across their real WL/WR bounds, then seat each REAL companion closure on its production survey() plane. The test-only flag suppresses pair separation where five 64px heads cannot physically avoid overlap at 320px; the normal render loop still paints them for deterministic two-sample geometry.
 root.setAttribute("data-hm-lobby-slot",String(slot));
 // `pid` is a STABLE identity handed in by whoever spawned this head (the tournament mints one per
 // player and keeps it for the whole cup). `cut` cannot serve as identity: a respawn re-encodes the
 // art, and two heads dyed the same colour are byte-identical. It stays on the peer for the
 // already-on-the-pitch lookup below, which is the one job it is still honest for.
 /* The celebration hop. vx/vy/air/st/surface live in THIS closure, so an outside caller
    cannot set them -- the soccer module can only ask. Same idiom the peek uses. */
 /* power 0 = bounce on the spot, 1 = stride toward something. At one fixed speed the
    heads could not actually close the gap to their team -- measured 498px apart at the
    whistle and still 501px six hops later, so they were celebrating, just not together. */
 /* power 0 = bounce on the spot, 1 = stride toward something, big = a LEAP.
    The leap clears 700px/s deliberately: startFlip() bails below that, because a low hop
    cannot finish a 360 before it lands and snaps mid-air. So a flip has to be asked for with
    enough height to actually land it, not just requested. */
 me.cheer=function(side,power,big){ try{
   if(grabbed||perched)return;
   side=side||(Math.random()<0.5?-1:1);
   power=(power==null)?0:power;
   dir=side; air=true; st="fall"; surface=floorY;
   vx=side*(55+power*260+Math.random()*70);
   vy=big?-(940+Math.random()*160):-(230+Math.random()*110);
   sqT=0.1; sqyP=big?1.16:1.1; sqxP=1/(big?1.16:1.1);
   if(big&&typeof startFlip==="function"){try{startFlip();}catch(_){}}
 }catch(_){} };
 /* PLAY LOBBY ENTRANCE. The boot gate seats every saved/fallback companion first so a slow
    image can never reveal an empty stage. Once all cuts are decoded, play-games asks these
    same physics bodies for one short, deterministic entrance. No duplicate DOM and no CSS
    approximation: x/y/vx/vy/air/st are the companion's real solver state. */
 me.lobbyThrowPrepare=function(order,total){try{
   if(reduce||killed||grabbed||perched)return false;
   var bc=document.body.classList;
   if(!bc.contains("pHubOn")||bc.contains("hmSoccer")||bc.contains("hmBattle")||bc.contains("hmRace")||bc.contains("hmTour"))return false;
   survey();order=Math.max(0,order|0);total=Math.max(1,total|0);
   var fromLeft=order%2===0,lift=150+(order%3)*18;
   x=fromLeft?WL-HW*1.2:WR+HW*1.2;y=floorY-lift;surface=floorY;dir=fromLeft?1:-1;
   air=false;st="idle";vx=0;vy=0;shown=true;
   root.style.opacity="0";root.style.filter="none";shadow.style.opacity="0";refl.style.opacity="0";
   root.setAttribute("data-hm-lobby-throw","queued");
   return true;
  }catch(_){return false;}};
 me.lobbyThrow=function(order,total){try{
   if(reduce||killed||grabbed||perched)return false;
   var bc=document.body.classList;
   if(!bc.contains("pHubOn")||bc.contains("hmSoccer")||bc.contains("hmBattle")||bc.contains("hmRace")||bc.contains("hmTour"))return false;
   survey();order=Math.max(0,order|0);total=Math.max(1,total|0);
   var fromLeft=order%2===0,lift=150+(order%3)*18;
   x=fromLeft?WL+2:WR-2;y=floorY-lift;surface=floorY;dir=fromLeft?1:-1;
   air=true;st="fall";vx=dir*(330+order*18);vy=-(190+(order%2)*28);
   shown=true;root.style.opacity="1";root.style.filter="none";shadow.style.opacity="1";
   root.setAttribute("data-hm-lobby-throw","active");me.__lobbyThrown=true;
   return true;
  }catch(_){return false;}};
 peers.push(me);   // set it HERE rather than patching the peer from outside, so anything spawning mini-Jayden gets it right   // cut travels with the peer so the tournament can find a head it has already spawned instead of duplicating it
 // ability ACTOR: the smashing head's handle -- registry abilities drive the head through this (its physics locals live in this closure)
 var A={me:me,peers:peers,FX:FX,slot:slot,
  get cx(){return x+HW/2;},get cy(){return y+HH/2;},get x(){return x;},get y(){return y;},get HW(){return HW;},get HH(){return HH;},get dir(){return dir;},
  launch:function(nvx,nvy){air=true;if(st==="idle"||st==="grab")st="fall";if(nvx!=null)vx=nvx;if(nvy!=null)vy=nvy;},
  add:function(dvx,dvy){vx+=dvx||0;vy+=dvy||0;air=true;if(st==="idle")st="fall";},
  buff:function(dur,tick,end){me.__buff={until:performance.now()+dur,tick:tick,end:end};},
  warp:function(nx,ny){x=Math.max(WL,Math.min(WR,nx));y=ny;air=true;st="fall";vy=Math.min(vy,80);},
  aura:function(color,dur){me.__aura={color:color,until:performance.now()+dur};},
  pop:function(sy){sqT=0.14;sqyP=sy||1.14;sqxP=1/(sy||1.14);brf=6;}};
 window.__hmKill=window.__hmKill||function(cut){var L=window.__hmLive||[];
  for(var i=L.length-1;i>=0;i--){if(L[i].cut===cut){L[i].kill();L.splice(i,1);}}};   // SPLICE, not just kill(). Entries were only ever pushed -- kill() flipped a flag and left the
  // record in place -- so window.__hmLive only ever grew. gameCount() is
  // Math.max(readAll().length, __hmLive.length), which put a permanent floor under the count:
  // delete every head and the roster emptied while Soccer and Marble Race stayed lit, because the
  // gate still believed there were players on the field.
 (window.__hmLive=window.__hmLive||[]).push({cut:data.cut,kill:function(){killed=true;
  try{root.remove();shadow.remove();refl.remove();var ix9=peers.indexOf(me);if(ix9>-1)peers.splice(ix9,1);}catch(_){}}});
 function hurt(d){if(!battleOn||elim)return;
  hp=Math.max(0,hp-d);hurtT=0.2;brf=6;   // the flush, the brows, and on big hits a blink or stars
  if(filler)mjHurtUntil=performance.now()+620;   // the mini-Jayden winces: his REST face (scrunched eyes) IS his "ow" (see the mirror)
  var _pun=Math.min(0.16,0.05+d*0.006);sqT=0.12;sqxP=1+_pun;sqyP=1/(1+_pun);   // IMPACT: a quick squash-punch scaled to the blow
  hitStop=performance.now()+Math.min(70,34+d*2.2);   // ...and a hair of hit-stop (freeze frames) -- subtle, but it sells the contact
  if(d>8&&bf===0)bf=5;if(d>15)dzf=Math.max(dzf,7);
  if(d>=9&&Math.random()<0.4){try{if(typeof busyNow==="function"&&!busyNow()&&typeof eventLock!=="undefined"&&!eventLock){setHold("rest",700);showFace("rest");browFlash();}}catch(_){}}   // the referee gasps at a solid hit
  if(hp<=0&&!window.__hmLavaOn){   // FLOOR IS LAVA: nobody is ever knocked out by a bump -- the lava is the ONLY thing that eliminates, so a hard shove can never cause a premature death; it only ever tips a rival toward the pit
   var aliveN9=0;for(var e9=0;e9<peers.length;e9++){if(peers[e9].inB&&!peers[e9].elim)aliveN9++;}
   if(aliveN9<=1){hp=1;hurtT=0.2;return;}   // the last head alive cannot be knocked out: there is always a winner
   elim=true;elimP=0;me.elim=true;if(battleOut.indexOf(me)<0)battleOut.push(me);   // log the knockout order for the podium
   if(grabbed){grabbed=false;root.style.cursor="grab";}
   root.style.pointerEvents="none";
   try{if(typeof busyNow==="function"&&!busyNow()&&typeof eventLock!=="undefined"&&!eventLock){setHold("rest",1100);showFace("rest");browFlash();setTimeout(function(){try{browFlash();}catch(_){}},380);}}catch(_){}}}   // a knockout earns the double-flash
 function confettiBurst(cx0,colsIn){try{ // realistic confetti: gravity, sway, tumble.
  // colsIn lets the winner throw THEIR colour -- a tournament final that showers a generic
  // rainbow says nothing about who just won.
  if((window.__hmFx||0)>=1)return;window.__hmFx=(window.__hmFx||0)+1;   // one celebration canvas at a time: never flood the GPU
  var cv9=document.createElement("canvas");var hr9=hero.getBoundingClientRect();
  cv9.width=innerWidth;cv9.height=Math.round(hr9.height);
  cv9.style.cssText="position:fixed;left:0;top:"+hr9.top.toFixed(0)+"px;width:100vw;height:"+hr9.height.toFixed(0)+"px;pointer-events:none;z-index:62";
  document.body.appendChild(cv9);var g9=cv9.getContext("2d");
  var cols=(colsIn&&colsIn.length)?colsIn:["#e05a4e","#e8b84b","#5aa0d8","#67b26f","#8a6fd8","#d87ea8"],pc=[];
  for(var q9=0;q9<130;q9++)pc.push({x:Math.random()*innerWidth,y:-20-Math.random()*220,
   vy:105+Math.random()*120,ph:Math.random()*6.28,sw:22+Math.random()*34,fq:1.1+Math.random()*1.6,
   w:6+Math.random()*4,h:3+Math.random()*3,c:cols[q9%cols.length],rv:2+Math.random()*4});
  var t9=0,l9=performance.now();
  (function fl9(n9){var d9=Math.min(0.05,(n9-l9)/1000);l9=n9;t9+=d9;
   g9.clearRect(0,0,cv9.width,cv9.height);
   var al9=t9<3?1:Math.max(0,1-(t9-3)/0.7);g9.globalAlpha=al9;
   pc.forEach(function(p9){p9.y+=p9.vy*d9;var px9=p9.x+Math.sin(t9*p9.fq+p9.ph)*p9.sw;
    g9.save();g9.translate(px9,p9.y);g9.rotate(Math.sin(t9*p9.rv+p9.ph));
    g9.scale(1,Math.max(0.15,Math.abs(Math.cos(t9*p9.rv*1.3+p9.ph))));   // the tumble: paper catching the light
    g9.fillStyle=p9.c;g9.fillRect(-p9.w/2,-p9.h/2,p9.w,p9.h);g9.restore();});
   if(t9<3.8)requestAnimationFrame(fl9);else{cv9.remove();window.__hmFx=Math.max(0,(window.__hmFx||1)-1);}})(performance.now());}catch(_){window.__hmFx=Math.max(0,(window.__hmFx||1)-1);}}
 function impactSpark(hx,hy,mag,col){try{   // a clean, quick shockwave RING at the contact point -- Apple-subtle, and it tells you exactly WHERE (and between whom) a hit landed
  var nowS=performance.now();if(nowS-sparkThrottle<40)return;sparkThrottle=nowS;
  var sz=Math.round(12+Math.min(34,mag*0.05));   // bigger blow, bigger ring
  var d=document.createElement("div");
  d.style.cssText="position:absolute;left:"+hx.toFixed(0)+"px;top:"+hy.toFixed(0)+"px;width:"+sz+"px;height:"+sz+"px;margin:"+(-sz/2)+"px 0 0 "+(-sz/2)+"px;border-radius:50%;border:2px solid "+(col||"rgba(24,24,26,.5)")+";pointer-events:none;z-index:9;opacity:.85;will-change:transform,opacity;transform:scale(.35)";
  hero.appendChild(d);var t0=nowS;
  (function anim(n){var p=(n-t0)/210;if(p>=1||killed){d.remove();return;}var e=1-Math.pow(1-p,3);d.style.transform="scale("+(0.35+e*1.55).toFixed(2)+")";d.style.opacity=(0.85*(1-p)).toFixed(2);requestAnimationFrame(anim);})(nowS);
 }catch(_){}}
 function _RBt(P){return P.t;}
 function startFlip(){if(Math.abs(vy)<700)return;   // ONLY flip off a real high jump -- a low hop (an attack charge, a little pounce, standing still) can't finish the turn before landing, so it snaps mid-air ("flip cancel"). No height, no flip.
  var tt=Math.max(0.45,2*Math.abs(vy)/G);   // one full turn, timed to land on its feet
  flipV=Math.max(-700,Math.min(700,(360/tt)*(dir||1)));flipA=flipV>0?0.01:-0.01;}
 function hop(big){ // anticipation: a real jump loads the spring first (countermovement crouch, ~100ms)
  sqT=0.11;sqyP=0.89;sqxP=1/0.89;
  gzx=dir*0.7;gzy=0.1;sacAt=performance.now()+500;   // the eyes leave before the body does
  setTimeout(function(){if(grabbed||air||perched)return;
   vy=-(big?900:(470+Math.random()*170));vx=dir*(130+Math.random()*100)*(mob?0.75:1);air=true;sqT=0.12;sqyP=1.09;sqxP=1/1.09;
   if(!big&&Math.random()<0.09){vy=-(730+Math.random()*160);startFlip();}   // every so often a hop becomes a little somersault
  },90+Math.random()*45);}
 function startHide(ph){var tk=++hideToken;plane(false);gzx=0;gzy=-0.2;sacAt=performance.now()+1200;   // tucked in: it thinks it is invisible
  setTimeout(function(){if(tk!==hideToken||grabbed||perched)return;   // the peek
   dir=ph.side;air=true;st="fall";surface=floorY;vx=ph.side*95;vy=-190;sqT=0.1;sqyP=1.08;sqxP=1/1.08;},900+Math.random()*700);
  setTimeout(function(){if(tk!==hideToken||grabbed||perched)return;   // duck back
   dir=-ph.side;air=true;st="fall";surface=floorY;vx=-ph.side*95;vy=-190;sqT=0.1;sqyP=1.08;sqxP=1/1.08;},2100+Math.random()*400);
  setTimeout(function(){if(tk!==hideToken||grabbed||perched)return;   // the reveal: out it bursts, terribly pleased
   plane(true);dir=ph.side;air=true;st="fall";surface=floorY;vx=ph.side*(250+Math.random()*120);vy=-(520+Math.random()*140);sqT=0.13;sqyP=1.14;sqxP=1/1.14;brf=6;},3500+Math.random()*700);}
 function startSink(lavaY){if(me.__sinking||elim||me.podiumRank)return;   // touched the lava: SPLASH, then the slow dramatic sink
  me.__sinking={t:0,x:x+HW/2,dir:(Math.random()<0.5?-1:1)};air=false;vx=0;vy=0;flipA=0;flipV=0;wig=null;grabbed=false;perched=false;gzy=-0.7;   // one last look up
  root.style.zIndex="-1";if(shadow)shadow.style.zIndex="-1";   // drop BEHIND the molten body so the lava swallows him as he goes under (occluded, not floating on top)
  try{if(window.__hmFX){var sx=x+HW/2;
   window.__hmFX.burst(sx,lavaY,{count:18,color:"255,170,60",speed:540,gravity:1080,life:0.85,size:6,dir:-1.57,spread:0.5});   // the PLUME: lava kicks up in a tall crown as he punches the surface, then rains back -> a real splash, not a fly-through
   window.__hmFX.burst(sx,lavaY,{count:24,color:"255,150,50",speed:360,gravity:950,life:0.7,size:5});
   window.__hmFX.burst(sx,lavaY,{count:11,color:"255,225,130",speed:230,gravity:750,life:0.5,size:4});
   window.__hmFX.burst(sx,lavaY,{count:8,color:"120,60,20",speed:180,gravity:600,life:0.8,size:5});
   window.__hmFX.ring(sx,lavaY,{r0:6,r1:78,color:"255,185,75",width:4,life:0.5});
   window.__hmFX.shake(6);}}catch(_){}}   // the plume + a thump carry the death -- no whole-screen flash (it read as a glitch, not drama)
 function land(){air=false;vy=0;vx=0;y=surface;sqT=0.12;sqyP=0.91;sqxP=1/0.91;vaulting=false;aimX=null;
  if(lapBack){lapBack=false;plane(true);}   // the lap ends where hands can reach again
  if(flipV!==0){try{if(typeof browFlash==="function")browFlash();}catch(_){}}   // it stuck the somersault: he notices
  flipA=0;flipV=0;
  if(shakeAfter){shakeAfter=false;setTimeout(function(){if(!grabbed&&!perched&&!air&&st==="idle"){wig={t:0.45,dur:0.45,type:"shake"};wigP=0;}},260+Math.random()*160);}   // dog-style shake-off after a rough ride
  if(hopsLeft>0){hopsLeft--;setTimeout(function(){if(!grabbed&&st==="hop")hop(false);},240+Math.random()*160);}
  else if(bounceN>0){bounceN--;st="idle";setTimeout(function(){if(!grabbed&&!perched&&st==="idle"&&!air){air=true;st="fall";vy=-(370+Math.random()*130);vx=dir*(10+Math.random()*24);sqT=0.12;sqyP=1.1;sqxP=1/1.1;}},170+Math.random()*130);}
  else st="idle";
  if(me.__lobbyThrown){me.__lobbyThrown=false;root.setAttribute("data-hm-lobby-throw","settled");}
  if(st==="idle"&&pendingHide&&!grabbed){var dx3=pendingHide.x-x;   // homing in on the hiding spot
   if(Math.abs(dx3)<40){var ph2=pendingHide;pendingHide=null;startHide(ph2);}
   else if((pendingHide.tries=(pendingHide.tries||0)+1)<=5){dir=dx3>0?1:-1;st="fall";air=true;surface=floorY;
    vy=-(300+Math.random()*80);vx=Math.max(-320,Math.min(320,dx3*3.5));sqT=0.12;sqyP=1.1;sqxP=1/1.1;}
   else{pendingHide=null;plane(true);}}}
 var rollT=0;
 function decide(now){
  decideAt=now+(battleOn?700+Math.random()*900:2100+Math.random()*3400);
  if(st!=="idle"||grabbed||perched||moodB)return;   // during his show the audience does not wander off
  function tryHide(){return false;   // DISABLED: heads no longer duck BEHIND the buttons/big head -- they always stay in front now (premium, no ducking-behind glitch)
   var bt=document.getElementById(Math.random()<0.7?"workBtn":"aboutBtn");if(!bt)return false;
   var br=bt.getBoundingClientRect(),hh0=hero.getBoundingClientRect();if(!br.width)return false;
   var bx=br.left-hh0.left+br.width/2-HW/2;if(bx<M||bx>heroR.w-HW-M)return false;
   pendingHide={x:bx,side:Math.random()<0.5?-1:1};
   dir=bx>x?1:-1;gzx=dir*0.75;gzy=0.05;sacAt=now+800;
   surface=floorY;st="hop";hopsLeft=Math.min(11,Math.max(1,Math.round(Math.abs(bx-x)/70)));
   setTimeout(function(){if(!grabbed&&st==="hop"&&!air)hop(false);},240+Math.random()*160);return true;}
  if(forceHide&&tryHide()){forceHide=false;return;}
  try{ // yawn contagion: if he is drowsy, it catches the yawn (dogs catch ours)
   if(typeof drowsy!=="undefined"&&drowsy&&Math.random()<0.4){wig={t:0.7,dur:0.7,type:"stretch"};sqT=0.6;sqyP=1.09;sqxP=1/1.09;mof=6;if(bf===0)bf=5;return;}}catch(_){}
  try{ // curiosity: a hand resting nearby gets approached, the way a still hand does
   if(typeof pointer!=="undefined"&&typeof lastMove!=="undefined"&&now-lastMove<4200){
    /* heroBox, not a fresh rect: this runs inside the per-head loop, so a
       measurement here is taken once per head rather than once. The shared
       cache exists for exactly this, and is refreshed rAF-throttled on scroll
       and resize plus a slow safety tick -- and only .left is wanted, which
       is the most stable number on it. */
    var cxr=pointer.px-heroBox.left-HW/2;
    var dxc=Math.abs(cxr-x);
    if(dxc>120&&dxc<430&&cxr>M&&cxr<heroR.w-HW-M&&Math.random()<0.3){
     dir=cxr>x?1:-1;gzx=dir*0.8;gzy=0.15;sacAt=now+900;
     surface=floorY;st="hop";hopsLeft=Math.min(3,Math.max(1,Math.round(dxc/85)));
     setTimeout(function(){if(!grabbed&&st==="hop"&&!air)hop(false);},260+Math.random()*140);return;}}}catch(_){}
  if(battleOn&&!elim){ // battle instinct: close the distance, fast
   var foe=null,fd9=1e9;
   for(var f9=0;f9<peers.length;f9++){var o9=peers[f9];if(o9===me||!o9.inB||o9.elim)continue;
    var dd9=Math.abs((o9.x+o9.HW/2)-(x+HW/2));if(dd9<fd9){fd9=dd9;foe=o9;}}
   if(foe&&Math.random()<0.75){dir=(foe.x+foe.HW/2)>(x+HW/2)?1:-1;gzx=dir*0.85;gzy=0.1;sacAt=now+700;
    surface=floorY;st="fall";air=true;
    var vyB=520+Math.random()*260,ttB=2*vyB/G;
    vy=-vyB;vx=dir*Math.min(720,Math.max(220,fd9/ttB));sqT=0.12;sqyP=1.09;sqxP=1/1.09;return;}}
  if(peers.length>1&&Math.random()<0.24){ // leapfrog: it sizes up a neighbour and jumps clean over
   var bestP=null,bdP=1e9;
   for(var vq=0;vq<peers.length;vq++){var o3=peers[vq];if(o3===me||o3.perched)continue;
    var ddP=Math.abs((o3.x+o3.HW/2)-(x+HW/2));if(ddP>60&&ddP<340&&ddP<bdP){bdP=ddP;bestP=o3;}}
   if(bestP){dir=(bestP.x+bestP.HW/2)>(x+HW/2)?1:-1;gzx=dir*0.8;gzy=0.1;sacAt=now+700;
    surface=floorY;st="fall";air=true;
    var vyV=840+Math.random()*140,ttV=2*vyV/G;
    var dxV=bdP+bestP.HW*0.9+HW*0.4;
    vy=-vyV;vx=dir*Math.min(760,dxV/ttV);sqT=0.13;sqyP=1.11;sqxP=1/1.11;vaulting=true;
    if(Math.random()<0.35)startFlip();return;}}
  var r=Math.random();
  if(r<0.36){ // travel: look where you are going first (the orienting reflex), then go
   var tx=M+Math.random()*(heroR.w-HW-M*2);
   dir=tx>x?1:-1;gzx=dir*0.75;gzy=0.05;sacAt=now+900;if(bf===0&&Math.random()<0.3)bf=5;   // big attention shifts often carry a blink
   surface=floorY;st="hop";hopsLeft=Math.min(11,Math.max(1,Math.round(Math.abs(tx-x)/70)));
   setTimeout(function(){if(!grabbed&&st==="hop"&&!air)hop(false);},240+Math.random()*160);}
  else if(r<0.52&&bigR){ // secure base: glance home, then come home beside him
   var side=Math.random()<0.5?-1:1;
   var tx2=side<0?Math.max(M,bigR.l-HW-14):Math.min(heroR.w-HW-M,bigR.r+14);
   dir=tx2>x?1:-1;gzx=dir*0.75;gzy=-0.1;sacAt=now+900;
   surface=floorY;st="hop";hopsLeft=Math.min(11,Math.max(1,Math.round(Math.abs(tx2-x)/70)));
   setTimeout(function(){if(!grabbed&&st==="hop"&&!air)hop(false);},240+Math.random()*160);visitUntil=performance.now()+9000;}
  else if(r<0.62){ // happy little bounces on the spot
   bounceN=1+(Math.random()<0.5?1:0);surface=floorY;st="fall";air=true;
   vy=-(400+Math.random()*140);vx=dir*(12+Math.random()*26);sqT=0.12;sqyP=1.09;sqxP=1/1.09;}
  else if(r<0.70){ // the pounce: a cat wiggle to set the feet, then the show-off leap
   dir=Math.random()<0.5?-1:1;if(x<M+40)dir=1;if(x>heroR.w-HW-M-40)dir=-1;
   wig={t:0.34,dur:0.34,type:"pounce"};wigP=0;sqT=0.32;sqyP=0.92;sqxP=1/0.92;
   var _dr=dir;st="hop";hopsLeft=0;
   setTimeout(function(){if(grabbed||perched||air||st!=="hop")return;dir=_dr;
    surface=floorY;st="fall";air=true;
    vy=-(760+Math.random()*180);vx=dir*(170+Math.random()*160)*(mob?0.75:1);sqT=0.13;sqyP=1.11;sqxP=1/1.11;
    if(Math.random()<0.7)startFlip();},340);}
  else if(r<0.76){ // a binky: the rabbit joy-jump, straight up with a twist of the body
   surface=floorY;st="fall";air=true;
   vy=-(640+Math.random()*160);vx=dir*(20+Math.random()*30);sqT=0.12;sqyP=1.1;sqxP=1/1.1;
   wig={t:0.5,dur:0.5,type:"binky",a:(Math.random()<0.5?-1:1)};wigP=0;}
  else if(r<0.82){wig={t:0.55,dur:0.55,type:"stretch"};sqT=0.5;sqyP=1.11;sqxP=1/1.11;}   // a tall luxurious stretch
  else if(r<0.87){wig={t:0.95,dur:0.95,type:"shimmy"};wigP=0;}   // a happy little shimmy
  else if(r<0.92){wig={t:1.15,dur:1.15,type:"tilt",a:(Math.random()<0.5?-1:1)*7};}   // curious head-tilt
  else if(r<0.935&&bigR&&(Math.abs(x-(bigR.l-HW-14))<90||Math.abs(x-(bigR.r+14))<90)){ // a little lap around his feet: cute hops across, watching him the whole way
   var sd=Math.abs(x-(bigR.l-HW-14))<90?1:-1;
   var txl=sd>0?Math.min(heroR.w-HW-M,bigR.r+14):Math.max(M,bigR.l-HW-14);
   dir=sd;surface=floorY;st="hop";hopsLeft=Math.min(6,Math.max(2,Math.round(Math.abs(txl-x)/85)));
   visitUntil=performance.now()+6500;   // it keeps looking up at him as it passes
   setTimeout(function(){if(!grabbed&&st==="hop"&&!air)hop(false);},200+Math.random()*140);}
  else if(r<0.955){if(Math.random()<0.5&&tryHide()){}else{ // a tiny sneeze: inhale tall, pop back, blink
   sqT=0.12;sqyP=1.1;sqxP=1/1.1;
   setTimeout(function(){if(grabbed||perched||air)return;bf=5;air=true;st="fall";surface=floorY;
    vx=-dir*(70+Math.random()*50);vy=-(240+Math.random()*80);sqT=0.11;sqyP=0.88;sqxP=1/0.88;},170);}}
  else {} // otherwise: a beat of rest
 }
 // --- grab like a Mii ---
 root.addEventListener("pointerdown",function(e){
  if(reduce)return;e.preventDefault();
  grabbed=true;perched=false;st="grab";root.style.cursor="grabbing";flipA=0;flipV=0;wig=null;plane(true);pendingHide=null;hideToken++;lapBack=false;vaulting=false;
  try{root.setPointerCapture(e.pointerId);}catch(_){}
  var hr=hero.getBoundingClientRect();
  downT=performance.now();downX=e.clientX;downY=e.clientY;shakeN=0;hmOverT=0;
  gpx=e.clientX-hr.left-x;gpy=e.clientY-hr.top-y;lastPX=e.clientX;lastPY=e.clientY;
 });
 var vSamp=[];
 root.addEventListener("pointermove",function(e){
  if(!grabbed)return;var hr=hero.getBoundingClientRect();
  var npx=(e.clientX-lastPX);
  if(npx*pvx<0&&Math.abs(npx)>6)shakeN++;   // direction flips at speed = getting shaken
  pvx=npx;pvy=(e.clientY-lastPY);lastPX=e.clientX;lastPY=e.clientY;
  vSamp.push({t:performance.now(),x:e.clientX,y:e.clientY});if(vSamp.length>12)vSamp.shift();
  x=e.clientX-hr.left-gpx;y=e.clientY-hr.top-gpy;
 });
 function release(e){if(!grabbed)return;grabbed=false;root.style.cursor="grab";
  var tap=(performance.now()-downT<230)&&e&&Math.hypot(e.clientX-downX,e.clientY-downY)<6;
  var _fv=(function(){ // the flick is what happened LAST: recency-weighted velocity, the way platform velocity trackers do it
   var nw2=performance.now(),sx=0,sy=0,sw=0;
   for(var q2=vSamp.length-1;q2>0;q2--){var a2=vSamp[q2-1],b2=vSamp[q2],age=nw2-b2.t;
    if(age>120)break;var dtq=b2.t-a2.t;if(dtq<4)continue;
    var w2=Math.exp(-age/50);sx+=w2*(b2.x-a2.x)/dtq*1000;sy+=w2*(b2.y-a2.y)/dtq*1000;sw+=w2;}
   return sw>0?{vx:sx/sw,vy:sy/sw,sp:Math.hypot(sx/sw,sy/sw)}:null;})();
  var relSp=_fv?_fv.sp:0;
  if(!tap&&hmOverNow&&hmOverT>0.35&&relSp<250&&!battleOn&&!soccerOn){ // placed with intent: held over the head a beat, released gently -- NEVER during a game (soccer/lava), or the head hangs glitching in mid-air while the game AI fights it
   perched=true;dockUntil=performance.now()+650;st="idle";air=false;vx=0;vy=0;hsT=1;heldV=0;heldOff=0;vSamp=[];shakeN=0;leapDelay=Infinity;
   try{gaze={x:0.05,y:-0.95};nextSaccade=performance.now()+1500;lastMove=performance.now()-9000;
    setTimeout(function(){try{if(typeof busyNow==="function"&&!busyNow()){setHold("smile",1000);showFace("smile");}}catch(_){}},420);}catch(_){}
   return;}
  st="fall";air=true;surface=floorY;
  y+=heldOff;heldOff=0;   // the spring's stretch becomes real position: momentum conserved
  if(tap){y-=4;vy=-(820+Math.random()*260);vx=dir*(140+Math.random()*180);sqT=0.14;sqyP=1.13;sqxP=1/1.13;}   // bop! (lift off the ground so the pop always plays)
  else{if(_fv){vx=Math.max(-2500,Math.min(2500,_fv.vx));vy=Math.max(-2300,Math.min(1600,_fv.vy));}   // it flies exactly where the hand was going
   else{vx=Math.max(-1100,Math.min(1100,pvx*60));vy=Math.max(-1200,Math.min(900,pvy*60));}
   vy+=heldV*12;heldV=0;   // the spring adds its stored energy to the throw, then fully discharges (no leftover energy to re-inject and jitter the head mid-air)
   dir=vx>=0?1:-1;if(Math.hypot(vx,vy)>650&&Math.random()<0.45)startFlip();}   // a real throw often sends it somersaulting
  vSamp=[];if(shakeN>4)dzf=16;shakeN=0;}
 root.addEventListener("pointerup",release);root.addEventListener("pointercancel",release);
 root.addEventListener("transitionend",function(e){if(e.propertyName==="filter"&&!first&&shown&&/^blur\(0/.test(root.style.filter||""))root.style.filter="none";},{passive:true});   // PERF: once the intro de-blur has finished playing, drop the filter entirely -> a settled head moves on the pure GPU-compositor path (no per-frame filter re-raster), instead of forever carrying a live blur(0)
 // --- the loop: physics at display rate, face beats stay 8fps ---
 var _lastF=performance.now();
 function _frame(_nowF){if(killed)return;   // a removed head stops its loop for good -- no idle rAF left spinning
  requestAnimationFrame(_frame);
  var _cl=window.__hmClimb||0;   // CLIMB CAMERA: the world scrolled down, so ride it down with the platforms and the lava (screen space stays honest, no coordinate rewrite anywhere else)
  if(_cl!==_climbA){var _cd=_cl-_climbA;_climbA=_cl;
   if(battleOn&&window.__hmLavaOn){y+=_cd;if(surface<1e8)surface+=_cd;if(me.__sinking&&me.__sinking.y0!=null)me.__sinking.y0+=_cd;}}
  var DT=Math.min(0.05,Math.max(0.006,(_nowF-_lastF)/1000));_lastF=_nowF;
  if(window.__hmFreeze&&_nowF<window.__hmFreeze&&(battleOn||soccerOn)&&!grabbed)DT=0;   // IMPACT FRAME: a big blow briefly freezes the fighters so the hit reads (hitstop)
  var _frozen=(me.__frozen&&_nowF<me.__frozen&&!grabbed);if(_frozen)DT=0;   // FREEZE ability: this head is encased in ice, held solid until it thaws
  tk3++;var now=_nowF,aboutB=false;moodB=false;
  // FLOOR IS LAVA -- the dramatic slow sink: once you touch the lava you're done; drift down, char, fade, then out
  if(me.__sinking&&(window.__hmRespawn||0)>=(window.__hmBattleReq||0)){me.__sinking=null;me.__sunk=0;root.style.filter="";root.style.opacity="1";root.style.zIndex="3";if(shadow){shadow.style.zIndex="2";shadow.style.display="";}root.style.display="";}   // the round ended mid-sink: abandon the descent so the reset below brings this head back with everyone else
  if(me.__sinking){var _sk=me.__sinking,_sdt=(DT>0?DT:0.016);_sk.t+=_sdt;var _kf=Math.min(1,_sk.t/1.35);   // a quick, decisive MELT into the lava -- he DISINTEGRATES at the surface, never drifts down and out the bottom of the pool
   if(_sk.y0==null)_sk.y0=y;
   y=_sk.y0+(22+_kf*40)*_kf;   // sinks only ~60px -- just under the molten crust -- then dissolves in place
   var _tlt=Math.sin(Math.min(1,_kf*1.3)*3.14159)*15*(_sk.dir||1);   // tips over as he goes under
   root.style.opacity=(_kf<0.26?"1":(1-(_kf-0.26)/0.74).toFixed(2));   // holds a beat, then dissolves
   root.style.filter="brightness("+(1-0.9*_kf).toFixed(2)+") saturate("+(1-0.72*_kf).toFixed(2)+") sepia("+(0.85*_kf).toFixed(2)+") blur("+(_kf*_kf*3.2).toFixed(1)+"px)";   // chars black + softens as he breaks apart
   root.style.transform="translate("+x.toFixed(1)+"px,"+y.toFixed(1)+"px) rotate("+_tlt.toFixed(1)+"deg) scale("+(1-0.24*_kf).toFixed(3)+")";   // shrivels as he melts
   if(shadow)shadow.style.opacity="0";
   var _bsy=window.__hmLavaY(_sk.x);
   if(window.__hmFX&&window.__hmLavaOn&&Math.random()<0.9)window.__hmFX.burst(_sk.x+(Math.random()*HW-HW/2),y+HH*0.35,{count:1,color:"255,175,75",speed:45+Math.random()*60,gravity:-72,life:0.7,size:2+Math.random()*3});   // bits of him peel off + rise as embers -> he disintegrates INTO the lava, not through it
   if(_kf>=1){if(window.__hmFX){window.__hmFX.burst(_sk.x,_bsy,{count:16,color:"255,180,75",speed:170,gravity:420,life:0.6,size:4});window.__hmFX.burst(_sk.x,_bsy,{count:8,color:"255,235,150",speed:100,gravity:300,life:0.5,size:3});window.__hmFX.ring(_sk.x,_bsy,{r0:4,r1:48,color:"255,205,100",width:3,life:0.5});}   // GONE: a final flare as the lava closes over him
    elim=true;me.elim=true;me.inB=true;root.style.display="none";if(shadow)shadow.style.display="none";me.__sinking=null;}
   return;}   // sinking owns the frame -- no AI, no physics (the molten body occludes him below the surface -> "swallowed")
  try{aboutB=document.body.classList.contains("about-open");moodB=(typeof busyNow==="function"&&busyNow());}catch(_){}
  if(!aboutB&&wasAboutB&&!first&&!gone&&!battleOn&&!soccerOn&&!grabbed){first=true;introSettled=true;bornWall=0;bornAt=now;shown=false;root.style.opacity="0";if(shadow)shadow.style.opacity="0";}   // About just CLOSED -> reset + toss every head back in from the edge, one at a time, like the very first time (the lively re-entrance)
  wasAboutB=aboutB;
  // --- HIDDEN ON THE HOME SCREEN (the Play-menu toggle) -------------------------------------
  // Exactly the About gate's shape: `want` drops, the head fades out. Never held off during a
  // game -- the games ARE the heads -- so starting one brings the whole crowd back on its own.
  // Read the BODY CLASSES, not this head's battleOn/soccerOn -- those are assigned ~40 lines
  // further down the frame, past the early-out below, so a hidden head would never learn a game
  // had started and could never un-hide. The classes are the same signal, available immediately.
  var hideB=false;
  try{var _bc=document.body.classList;
   hideB=_bc.contains("hmHeadsOff")&&!_bc.contains("hmBattle")&&!_bc.contains("hmSoccer")&&!_bc.contains("hmRace");
   // TOURNAMENT BENCH: only the two teams in the current fixture are on the pitch. Reusing the
   // hide gate keeps the visitor's saved heads alive across the whole bracket -- despawning and
   // respawning them every fixture would churn the crowd and lose their state.
   if(window.__hmBench&&window.__hmBench[slot])hideB=true;}catch(_){}
  me.__bench=hideB;   // A BENCHED HEAD IS NOT A BODY. It is invisible and frozen, but it stayed in
  // peers, so the ball was bouncing off players nobody could see and live players were walking
  // into them. Every physical loop has to know to skip it.
  if(!hideB&&wasHideB&&!first&&!gone&&!battleOn&&!soccerOn&&!window.__hmRaceOn&&!grabbed){first=true;introSettled=true;bornWall=0;bornAt=now;shown=false;root.style.opacity="0";if(shadow)shadow.style.opacity="0";}   // UNHIDDEN -> the same one-at-a-time toss-in from the edge as the very first time
  wasHideB=hideB;
  var want=!aboutB&&!hideB&&!gone;   // moods never hide the pit: the little heads are the audience
  if(first&&bootSeated){
   first=false;shown=true;survey();
   var bootTotal=Math.max(1,parseInt(data&&data.__bootTotal,10)||list.length||1);
   var bootSpan=Math.min(heroR.w*0.7,Math.max(0,(bootTotal-1)*Math.min(HW*1.12,heroR.w/bootTotal)));
   x=bootTotal===1?heroR.w/2-HW/2:heroR.w/2-HW/2-bootSpan/2+(slot%bootTotal)*(bootSpan/(bootTotal-1));
   x=Math.max(WL,Math.min(WR,x));y=floorY;surface=floorY;dir=(slot%2)?-1:1;air=false;st="idle";vx=0;vy=0;
   root.style.transition="none";shadow.style.transition="none";root.style.opacity="1";root.style.filter="none";shadow.style.opacity="1";root.setAttribute("data-hm-boot-ready","true");
   requestAnimationFrame(function(){root.style.transition="opacity .5s steps(4,end),filter .5s steps(4,end)";shadow.style.transition="opacity .5s cubic-bezier(.22,1,.36,1)";});}
  if(first&&noIntro){ // the mid-game stand-in drops straight in -- no waiting on the (hidden) big head's intro
   first=false;shown=true;survey();var flf=Math.random()<0.5;
   x=flf?WL+2:WR-2;y=floorY-(150+Math.random()*160);surface=floorY;dir=flf?1:-1;air=true;st="fall";
   vx=dir*(320+Math.random()*220);vy=-(140+Math.random()*220);
   root.style.opacity="1";root.style.filter="blur(0)";shadow.style.opacity="1";}
  if(first){ // the pit opens after his intro: each head is TOSSED in from the edge, one at a time
   if(now<bornAt)return;
   var stEl1=document.getElementById("stage"),fEl1=document.getElementById("face");
   var so1=stEl1?parseFloat(getComputedStyle(stEl1).opacity||"1"):1;
   if(so1<0.95||!fEl1||!fEl1.complete||!fEl1.naturalWidth){bornAt=now+250;return;}
   if(!introSettled){try{if(typeof introMode!=="undefined"&&introMode===false)introSettled=true;}catch(_){}   // the intro flag itself: the moment his show ends, the pit opens
    if(!introSettled){try{var ey0=document.querySelector(".eye");if(ey0&&ey0.classList.contains("eclosed"))introSettled=true;}catch(_){}}
    introFrames++;   // rendered time, not wall time: face swaps and hidden tabs can never stall the door
    if(!introSettled&&(now-bornAt>9000||introFrames>200))introSettled=true;
    if(!introSettled)return;}
   if(!bornWall){bornWall=now+150+slot*620+Math.random()*380;return;}
   if(now<bornWall)return;
   first=false;shown=true;survey();
   var fromLeft=Math.random()<0.5;
   x=fromLeft?WL+2:WR-2;y=floorY-(140+Math.random()*240);surface=floorY;
   dir=fromLeft?1:-1;air=true;st="fall";
   vx=dir*(380+Math.random()*260);vy=-(120+Math.random()*300);
   if(Math.random()<0.35)startFlip();
   root.style.opacity="1";root.style.filter="blur(0)";shadow.style.opacity="1";
   try{if(typeof browFlash==="function")browFlash();   // he sees each one fly in
    if(typeof busyNow==="function"&&!busyNow()&&typeof setHold==="function"){setHold("smile",900);showFace("smile");}}catch(_){}
  }
  // THE REFLECTION LEAVES THE STAGE WITH THE HEAD. This line owns "this head is not on stage" and
  // it hid two of the head's three parts: the body and the contact shadow. The reflection was left
  // behind, and it is left behind VISIBLE -- the last opacity written to it was shOp*REFL_K, which
  // is non-zero for any head that was standing on the pitch a frame ago.
  // The reason it could not fix itself is the two early returns immediately below. The only code
  // that ever writes refl.style.opacity="0" is the else-branch of the reflection block ~500 lines
  // further down, and `if(hideB&&!shown&&!first)return;` / `if(!shown)return;` mean a hidden head
  // never reaches it. So the reflection freezes at its last transform and its last opacity and
  // stays there until the page is reloaded -- which is exactly the report: the head goes, the
  // shadow goes with it, and a reflection is left sitting on the water.
  // WHERE: `want` is !aboutB && !hideB && !gone, and hideB is window.__hmBench -- the TOURNAMENT's
  // bench, the squads not in the current fixture. The lobby benches nobody, which is precisely why
  // this was only ever seen during a match and on tournament screens and never in the lobby or on
  // the home page. A cup re-fields squads every fixture, so it accumulates.
  // Only ever hidden here, never shown: turning it back on belongs to the per-frame law above, so
  // that a head coming back off the bench fades its reflection in through the same shOp it always
  // did rather than being snapped to full strength by this line.
  if(!first&&want!==shown){shown=want;root.style.opacity=want?"1":"0";root.style.filter=want?"blur(0)":"blur(6px)";shadow.style.opacity=want?"1":"0";if(!want)refl.style.opacity="0";}
  if(hideB&&!shown&&!first)return;   // hidden AND the fade has finished: skip the whole simulation, not just the paint. Deliberately no display:none -- the lava elim/sink paths own that property and fighting them is how heads end up as orphan shadows.
  if(reduce){
   /* Boot already seats every companion across the shared floor. Reduced motion freezes those
      real seats; it must not replace every x with the same 5% fallback and collapse the crowd
      into one head. Keep the contact shadow and the existing polished-floor reflection static
      on that same feet line too. */
   /* AND IT WRITES ONLY WHEN ONE OF THOSE FROZEN VALUES ACTUALLY CHANGES.
      Reduced motion freezes x and y, so this block was setting six properties
      per head to the values they already held, sixty times a second, for as
      long as the tab stayed open. Twelve heads made that seventy-two writes a
      frame to redraw an identical picture -- which is how asking for LESS
      motion ended up costing MORE style recalculation than leaving it on:
      measured 62.8 recalcs/sec against 45.7 with motion allowed. Someone who
      asks for stillness should be the cheapest visitor on the site, not the
      most expensive.
      Every input here is frozen or step-changing, so one signature covers the
      lot; when it matches, the frame has nothing to say and says nothing. */
   var _lob=(shown&&LOBBY(now))?1:0;
   var _sig=x.toFixed(1)+"|"+y.toFixed(1)+"|"+floorY.toFixed(1)+"|"+FOOT+"|"+HW+"|"+(shown?1:0)+"|"+_lob;
   if(_sig===_rmSig)return;
   _rmSig=_sig;
   root.style.transform="translate("+x.toFixed(1)+"px,"+y.toFixed(1)+"px)";
   shadow.style.transform="translate("+(x+HW*0.06).toFixed(1)+"px,"+(floorY+HH*FOOT-2).toFixed(1)+"px)";shadow.style.opacity=shown?"0.36":"0";
   if(_lob){if(_reflFoot!==FOOT){_reflFoot=FOOT;refl.style.transformOrigin="50% "+(FOOT*100).toFixed(2)+"%";}
    refl.style.transform="translate("+x.toFixed(1)+"px,"+floorY.toFixed(1)+"px) scale(1,-1) scale(1,"+REFL_PERSP.toFixed(3)+")";refl.style.opacity=(0.36*REFL_K).toFixed(3);}
   else refl.style.opacity="0";
   return;}
  if(!shown)return;
  // battleOn is DERIVED from the same two globals the class guardian uses -- every head reads it identically, so no head can be fighting after the whistle or stuck in the fight
  try{var _bReq=window.__hmBattleReq||0,_bResp=window.__hmRespawn||0,_wantB=_bReq>0&&_bReq>_bResp&&!killed;
   if(_wantB&&!battleOn){battleOn=true;battleSeen=_bReq;hp=100;me.__burnAt=0;elim=false;elimP=0;celebrated=false;me.podiumRank=0;me.spectate=0;   // ENTER
    if(window.__hmBOSeed!==_bReq){window.__hmBOSeed=_bReq;battleOut.length=0;hidePodium();window.__hmBattleGo=performance.now()+2900;}   // once per fight: fresh log, no leftover podium, a 3-2-1-GO first
    perched=false;leapDelay=Infinity;me.elim=false;me.inB=true;bar.style.opacity="1";root.style.pointerEvents="";
    me.__sinking=null;me.__sunk=0;me.__grudge=null;me.__ally=null;me.__socialAt=0;me.__reactAt=0;root.style.filter="";root.style.opacity="1";root.style.zIndex="3";if(shadow)shadow.style.zIndex="2";   // fresh, un-charred, not sinking, no grudges, back in front
    if(battlePlats.length){var _sp=battlePlats[0],_n=Math.max(1,peers.length),_i=(slot||0)%_n;   // FLOOR IS LAVA: everyone starts on the BIG BASE; a small crowd clusters near the centre so they mingle instead of standing far apart, a full crowd of 8 uses the whole width
     var _bw=Math.max(1,(_sp.r-_sp.l-HW-10)),_use=Math.min(_bw,_n*HW*2.8),_off=(_sp.l+5)+(_bw-_use)/2;   // spread the crowd right across the opening ground: evenly spaced, nobody shoulder-to-shoulder getting nudged off at the whistle
     var _tx=Math.max(_sp.l+2,Math.min(_sp.r-HW-2,_off+_use*((_i+0.5)/_n)));surface=_sp.t-HH*FOOT;
     var _dxs=_tx-x;dir=_dxs>=0?1:-1;air=true;st="fall";aimX=_tx+HW/2;   // LEAP to your mark instead of teleporting there -- the old snap was the "everyone glitches at the start" jolt
     var _vys=560+Math.random()*170,_tts=2*_vys/G;vy=-_vys;vx=Math.max(-900,Math.min(900,_dxs/_tts));
     sqT=0.12;sqyP=1.1;sqxP=1/1.1;gzy=-0.4;if(Math.abs(_dxs)>240&&Math.random()<0.55)startFlip();}
    else{surface=floorY;x=Math.max(WL,Math.min(WR,WL+Math.random()*Math.max(1,WR-WL-HW)));
     y=surface;air=false;st="idle";vx=0;vy=0;flipA=0;flipV=0;wig=null;}}   // only the no-arena fallback drops you straight onto your mark; with a real ladder you LEAP in (zeroing the velocity here was what cancelled the entrance and made the whole crowd snap into place at the whistle)
   else if(!_wantB&&battleOn){battleOn=false;respawnSeen=_bResp;me.inB=false;me.podiumRank=0;me.spectate=0;bar.style.opacity="0";crownEl.style.opacity="0";hidePodium();   // LEAVE: back to normal life, drop back into the scene
    me.__rage=me.__speed=me.__feather=me.__bounce=me.__frozen=me.__spin=me.__disco=0;me.__aura=null;me.__buff=null;me.__grudge=null;me.__ally=null;me.__sinking=null;me.__sunk=0;me.__aggro=null;if(auraEl)auraEl.style.opacity="0";   // shed every ability effect, grudge, pact and nerve when the fight ends -- next round re-rolls who the bullies are
    elim=false;elimP=0;hp=100;me.elim=false;root.style.pointerEvents="";
    root.style.zIndex="3";if(shadow)shadow.style.zIndex="2";if(me.__ltR){ringEl.style.opacity="0";me.__ltR=0;}   // back IN FRONT of the big head (sinking sent it behind) and drop any lava-team rim
    shown=true;root.style.opacity="1";root.style.filter="blur(0)";shadow.style.opacity="1";root.style.display="";shadow.style.display="";
    if(y>floorY+20||y<-HH*3||!isFinite(y)){y=-HH*1.4-Math.random()*90;x=Math.max(WL,Math.min(WR,isFinite(x)?x:WL+Math.random()*Math.max(1,WR-WL)));}   // a head that fell off-screen or sank into the lava drops fresh from the top instead of staying gone
    air=true;st="fall";surface=floorY;if(vy<40)vy=40;perched=false;leapDelay=Infinity;
    decideAt=performance.now()+300+Math.random()*700;}}catch(_){}
  // TEAM PREVIEW: while the soccer picker is open (no game yet), wear the chosen side's colour so you can see the teams before kickoff
  try{var _tp=window.__hmTeamPreview;
   if(_tp&&!soccerOn&&!battleOn&&!killed&&(_tp[slot]===1||_tp[slot]===2)){var _pc=_tp[slot]===1?"224,90,78":"90,160,216";ringEl.style.background="rgb("+_pc+")";ringEl.style.opacity="1";me.__tpv=1;}
   else if(me.__tpv&&!soccerOn){ringEl.style.opacity="0";me.__tpv=0;}}catch(_){}
  // FLOOR-IS-LAVA FIXED TEAMS: wear a faint team-coloured rim so viewers can read the alliances (solo mode shows none)
  try{if(window.__hmLavaOn&&window.__hmLavaTeams&&!me.__sinking&&!elim){var _lts2=window.__hmTeamSel,_lc=_lts2?(_lts2[slot]===1?"224,90,78":_lts2[slot]===2?"90,160,216":null):null;
    if(_lc){ringEl.style.background="rgb("+_lc+")";ringEl.style.opacity="0.82";me.__ltR=1;}else if(me.__ltR){ringEl.style.opacity="0";me.__ltR=0;}}
   else if(me.__ltR){ringEl.style.opacity="0";me.__ltR=0;}}catch(_){}
  try{var S9=window.__hmSoccer;
   // EVERY new match wipes the crown, keyed off S.seed rather than off joining/leaving. The exit
   // cleanup (!S9.on && soccerOn) is a TRANSITION, and the mini-Jayden filler never sees it -- it
   // is despawned at the whistle -- so its soccerOn stayed true, which ALSO skipped the join
   // branch (S9.on && !soccerOn) next match. The crown rode along into the following game.
   if(S9&&S9.on&&S9.seed&&S9.seed!==soccerSeedSeen){soccerSeedSeen=S9.seed;soccerWon=false;crownEl.style.opacity="0";
    /* RE-TINT on every new match, not only when a head first joins. The ring was computed once,
       in the !soccerOn -> soccerOn branch below, so a head that stayed on the pitch across
       fixtures never recomputed it and kept the PREVIOUS tie's colours -- which is why one
       match could show four different outlines that matched neither side. The seed changes
       once per kickoff, so this is the honest place to re-read both the side and its colour. */
    try{ team=(S9.teams&&S9.teams[slot])||team||1;
      var _rc=(window.__hmTeamCol&&window.__hmTeamCol[team])||(team===1?"224,90,78":"90,160,216");
      if(filler&&mjClone){var _rd="rgb("+_rc+")";
        mjClone.style.filter="drop-shadow(2.5px 0 0 "+_rd+") drop-shadow(-2.5px 0 0 "+_rd+") drop-shadow(0 2.5px 0 "+_rd+") drop-shadow(0 -2.5px 0 "+_rd+")";}
      else if(ringEl){ringEl.style.background="rgb("+_rc+")";}
    }catch(_){}
   }
   if(S9&&S9.on&&!soccerOn&&!killed){soccerOn=true;soccerWon=false;crownEl.style.opacity="0";   // clear the CROWN on join too. soccerWon was already reset here, but the element kept last
     // match's opacity, and the only place that cleared it was the exit transition
     // (!S9.on && soccerOn) -- which the mini-Jayden filler never sees, because it is despawned
     // at the whistle. Same element came back next match still wearing the crown.
     team=(S9.teams&&S9.teams[slot])||1;
    perched=false;leapDelay=Infinity;bar.style.opacity="0";root.style.pointerEvents="";
    var tcol=(window.__hmTeamCol&&window.__hmTeamCol[team])||(team===1?"224,90,78":"90,160,216");   // The engine only ever fields TWO sides, so the tournament does not need N-team plumbing: the
   // bracket decides which two teams are playing and hands their colours down here for the match.
   // Absent that (exhibition), this is the same red/blue it has always been.
    if(filler&&mjClone){var _dc="rgb("+tcol+")";mjClone.style.filter="drop-shadow(2.5px 0 0 "+_dc+") drop-shadow(-2.5px 0 0 "+_dc+") drop-shadow(0 2.5px 0 "+_dc+") drop-shadow(0 -2.5px 0 "+_dc+")";}   // the mini's ring hugs his REAL silhouette
    else{ringEl.style.background="rgb("+tcol+")";ringEl.style.opacity="1";}   // a solid team-coloured outline
    shadow.style.background="radial-gradient(ellipse at center,rgba("+tcol+",.42),rgba("+tcol+",0) 70%)";}   // the shadow wears the team colour too
   if(S9&&!S9.on&&soccerOn){soccerOn=false;soccerWon=false;ringEl.style.opacity="0";crownEl.style.opacity="0";if(filler&&mjClone)mjClone.style.filter="none";
    shadow.style.background="radial-gradient(ellipse at center,rgba(var(--head-shadow,8,8,8),var(--head-shadow-a,.26)),rgba(var(--head-shadow,8,8,8),0) 70%)";   // back to the ground's own ink, through the same two properties spawn uses -- a hard literal here would have quietly re-blacked every shadow the moment a match ended, whatever surface it ended on
    if(!killed){shown=true;root.style.opacity="1";root.style.filter="blur(0)";shadow.style.opacity="1";root.style.display="";shadow.style.display="";
     var fs9=Math.random()<0.5;x=fs9?WL+2:WR-2;y=floorY-(140+Math.random()*240);dir=fs9?1:-1;air=true;st="fall";surface=floorY;
     vx=dir*(360+Math.random()*240);vy=-(120+Math.random()*260);if(Math.random()<0.35)startFlip();}}
   if(S9&&S9.on&&soccerOn&&!killed){
    if(S9.kickSeed&&S9.kickSeed!==soccerKickSeen){soccerKickSeen=S9.kickSeed;
     /* SET POSITIONS AT EVERY JUMP BALL. Jayden: "they should completely reset in set positions
        so that the game feels even every jump ball." Both sides take the SAME ladder of marks,
        reflected about the centre line -- red in its own half, blue in its. This is a KICKOFF
        arrangement, not tactics: the instant S.phase goes back to "play" the scrum resumes
        untouched, and nothing here (or in the mark-holding block below) spaces anyone out
        during play.

        ONE EXPRESSION, ONE SIGN TERM. _side carries the whole mirror, so the two halves cannot
        drift apart the way the old right-hand SUPPORT clamp did (see that note further down).
        The mark is a CENTRE; tx9 converts it to a left edge exactly once, at the very end.

        AND THIS IS WHERE THEY WERE ALL BEING SENT RIGHT. The launch read
        `vx = dir*Math.max(-820,Math.min(820,dxk/ttk))`. dxk/ttk is already signed and `dir` IS
        that same sign, so the product is |dxk/ttk| -- always positive, always rightward. Every
        head whose mark lay to its left was fired away from it at up to 820px/s, and the crowd
        walked right one restart at a time until the left goal was the only one anybody could
        score on. Measured at 1440x900, 900ms after each restart: 167 heads had moved right and
        34 left (six heads), 155 against 10 (twelve heads), with BOTH teams' mean x sitting
        right of the centre line -- red 908, blue 729, midline 720. The `dir*` is gone. `dir`
        itself is untouched: it is still the facing, and it still feeds gzx. */
     var _side=(team===1)?-1:1;                                   // which half is mine -- red left, blue right
     var _rkK=function(s9k){var _r9=(S9.roles&&S9.roles[s9k])||"";return _r9==="keeper"?0:_r9==="defender"?1:2;};
     var _mine=[],_n1=0,_n2=0;
     for(var _q9=0;_q9<peers.length;_q9++){var _pv9=peers[_q9],_t9=(S9.teams&&S9.teams[_pv9.slot])||0;
      if(_t9===1)_n1++;else if(_t9===2)_n2++;
      if(_t9===team)_mine.push(_pv9.slot);}
     _mine.sort(function(a,b){var _ra=_rkK(a),_rb=_rkK(b);return _ra!==_rb?_ra-_rb:a-b;});   // deepest role nearest its own net, then by slot: the same head takes the same mark every restart, so it reads as a line-up rather than a shuffle
     var _rank=Math.max(0,_mine.indexOf(slot));
     // ONE ladder, sized to the LARGER squad, so an odd roster still leaves every occupied mark
     // facing an exactly reflected one instead of re-spacing both sides against each other.
     var _slots=Math.max(1,_n1,_n2);
     var _span=heroR.w*0.5-M-HW*0.5;                              // centre line -> the furthest a head CENTRE can legally stand
     /* THE LADDER OPENS UP WHEN THE MARKS WOULD OVERLAP, AND ONLY THEN. The fixed 0.62 spread put
        three marks 45.6px apart on a 390px pitch where a head is 64px wide, so the line-up spawned
        already inside itself and pair separation immediately shoved heads across the centre line --
        measured 5 of 35 mobile restarts with two-thirds of a side in the wrong half, against 0 of 19
        at 1440. The step now widens toward one head-width when the geometry demands it, capped so the
        shallowest mark never reaches the centre spot. At 1440 3-a-side the max() picks the ORIGINAL
        0.31 unchanged, so the desktop line-up Jayden has already seen does not move a pixel. */
     var _step=(_slots<2)?0:Math.max(0.62/(_slots-1),Math.min((0.84-0.10)/(_slots-1),(HW*0.95)/Math.max(1,_span)));
     /* ...AND THE SHALLOWEST MARK HAS TO CLEAR THE CENTRE LINE BY HALF A HEAD, OR THE WIDER STEP
        DOES NOT HELP. The 0.10 floor is a fraction of the half-pitch, and on a phone the half-pitch
        is small: 0.10*123 = 12.3px from the centre spot, so the two innermost marks -- one per team,
        mirrored -- were seeded 24.6px apart with 64px heads. They spawn already inside each other and
        pair separation resolves the overlap by shoving one of them across the centre line, which is
        exactly the failure the reset exists to remove. Measured at 390x844, six heads: 7 of 11
        restarts still had two-thirds of a side in the wrong half AFTER the sign fix and the wider
        step, against 0 of 12 at 1440.
        The floor is now the geometry it has to satisfy -- a little over half a head-width, so a
        mirrored pair of innermost marks is a clear head-width apart and nothing has to be shoved.
        It is written once and mirrored by _side like every other term here, so it cannot drift.
        At 1440 (HW 108, span 626) it evaluates to 0.100 and the desktop line-up Jayden has already
        seen does not move a pixel; at 390 (HW 64, span 123) it lifts the innermost mark to 0.302. */
     var _fMin=Math.max(0.10,Math.min(0.45,(HW*0.58)/Math.max(1,_span)));
     var _frac=(_slots<2)?0.45:Math.max(_fMin,0.84-_rank*_step);   // 0 = the centre line, 1 = as deep as a head can stand
     var _markC=heroR.w*0.5+_side*_frac*_span,tx9=_markC-HW/2;
     try{if(S9.markSeed!==S9.kickSeed){S9.marks={};S9.markSeed=S9.kickSeed;}
      S9.marks[slot]={x:_markC,i:_rank,team:team,n:_slots};}catch(_){}   // published so a contract can ASSERT the mirror rather than trust the comment above it
     if(!grabbed){var dxk=tx9-x;dir=dxk>=0?1:-1;surface=floorY;st="fall";air=true;
      /* Solve the arc for the DISTANCE instead of clamping it flat. 820px/s over a 0.42s hop
         carries 347px, so a head conceding at the far end of a 1440px pitch landed short and
         then had to walk -- which is the other half of why a restart never actually reset
         anything. A longer trip now buys a taller leap, and that is the more watchable
         restart as well as the more accurate one. */
      var _dxa=Math.abs(dxk),vyk=Math.max(460,Math.min(1000,Math.sqrt(_dxa*G/1.6))),ttk=2*vyk/G;
      vy=-vyk;vx=Math.max(-1150,Math.min(1150,dxk/ttk));sqT=0.12;sqyP=1.1;sqxP=1/1.1;gzx=dir*0.6;sacAt=now+500;
      if(_dxa>heroR.w*0.28&&Math.random()<0.5)startFlip();}}
    /* HOLD THE MARK UNTIL THE WHISTLE. One ballistic leap is at the mercy of whatever it hits on
       the way over, so while the ball is still coming in a head that landed off its mark takes
       one more short hop at it. Gated on S9.phase !== "play": it CANNOT run during the match,
       which is the whole point -- this is a line-up, never a formation. */
    if(S9.phase!=="play"&&S9.marks&&S9.marks[slot]&&!grabbed&&!air&&!perched&&st==="idle"&&now>=decideAt){
     var _mk9=S9.marks[slot].x-HW/2,_dm9=_mk9-x;
     if(Math.abs(_dm9)>HW*0.35){decideAt=now+200;dir=_dm9>=0?1:-1;surface=floorY;st="fall";air=true;
      var _vk2=Math.max(340,Math.min(760,Math.sqrt(Math.abs(_dm9)*G/1.6))),_tk2=2*_vk2/G;
      vy=-_vk2;vx=Math.max(-900,Math.min(900,_dm9/_tk2));sqT=0.11;sqyP=1.08;sqxP=1/1.08;gzx=dir*0.5;}}
    if(S9.postSeed&&S9.postSeed!==me.__postSeen){me.__postSeen=S9.postSeed;   // OFF THE WOODWORK: everyone near the ball feels it -- the shooter clutches, brows pop
     if(Math.abs((x+HW/2)-S9.ball.x)<220){brf=6;gzy=-0.5;sacAt=now+900;}else{brf=4;}}   // agony reads in the brows and eyes; the red hurt flash is DAMAGE language and soccer has no damage}
    if(S9.goalSeed&&S9.goalSeed!==goalSeen){goalSeen=S9.goalSeed;   // GOAL: just a natural little reaction, no scripted dance
     var _role0=(S9.roles&&S9.roles[slot])||"";
     if(_role0==="keeper"&&S9.goalTeam!==team){gzy=0.8;gzx=0;sacAt=now+1800;}   // KEEPER DESPAIR: beaten, he stares at the turf -- the emotional protagonist of every goal
     if(S9.goalTeam===team&&!grabbed&&!perched){brf=6;mof=4;if(filler)smileT=1.7;   // the mini-Jayden grins at a goal
      try{if(typeof busyNow==="function"&&!busyNow()){setHold("smile",1200);showFace("smile");}}catch(_){}}}
    if(S9.winner&&S9.winner===team&&!soccerWon){soccerWon=true;crownEl.style.opacity="1";if(filler){smileT=3.6;danceUntil=now+3400;}   // champions crowned -- the mini-Jayden breaks into his DELIGHT DANCE (he's me, he gets the whole moment)
     if(!grabbed){dir=((heroR.w/2)>(x+HW/2))?1:-1;surface=floorY;st="fall";air=true;vy=-(920+Math.random()*120);vx=dir*(110+Math.random()*110);sqT=0.13;sqyP=1.11;sqxP=1/1.11;startFlip();brf=6;mof=4;
      try{if(!busyNow()){setHold("smile",1600);showFace("smile");}}catch(_){}}}
    if(S9.phase==="play"&&!grabbed&&!air&&!perched&&st==="idle"&&S9.ball&&now>=decideAt){decideAt=now+240+Math.random()*220;
     var role=(S9.roles&&S9.roles[slot])||"attacker",ballX=S9.ball.x,ballY=S9.ball.y,ballVX=(S9.ball.vx||0),myX=x+HW/2;
     var atk=team===1?1:-1,ownGoalX=team===1?(M+6):(heroR.w-M-6);
     var leadX=Math.max(M,Math.min(heroR.w-M,ballX+ballVX*0.18));   // LEAD the ball: aim where it's GOING, not where it was
     var goalSideOf=function(px){return (atk>0)?(px<=ballX+6):(px>=ballX-6);};   // behind the ball (own-goal side) -> a hit from here drives it toward THEIR net
     var myGS=goalSideOf(myX),myScore=Math.abs(myX-ballX)+(myGS?0:heroR.w*0.55);   // "cost to strike toward their goal": distance + a penalty if I'd have to loop around the ball first
     // ROLE BY POSITIONING: I only chase if I'm my team's BEST-placed striker right now. Everyone else supports -> no clumping, and the head with the better shot takes it (the "pass").
     var iAmChaser=true,teamAhead=0;
     for(var tc=0;tc<peers.length;tc++){var pv=peers[tc];if(pv===me||pv.elim||!(S9.teams&&S9.teams[pv.slot]===team))continue;
      var pvX=pv.x+pv.HW/2,pvScore=Math.abs(pvX-ballX)+(goalSideOf(pvX)?0:heroR.w*0.55);
      if(pvScore<myScore-6||(Math.abs(pvScore-myScore)<=6&&(pv.slot||0)<(slot||0)))iAmChaser=false;
      if((atk>0)?(pvX>ballX):(pvX<ballX))teamAhead++;}
     var ballOnOurHalf=(atk>0)?(ballX<heroR.w*0.5):(ballX>heroR.w*0.5);
     var ballHigh=(floorY-ballY)>150,nearOwnGoal=(atk>0)?(ballX<heroR.w*0.3):(ballX>heroR.w*0.7);
     var bxT,overBall=false,wantHigh=false;
     var _lit=false;
     if(iAmChaser){   // GO FOR IT -- but ALWAYS from the own-goal side, so the ball can only go toward THEIR net
      if(!myGS){bxT=(leadX-atk*(HW*0.5+34))-HW/2;overBall=Math.abs(ballX-myX)<HW+56;}   // loop behind the ball, vaulting clean over it
      else bxT=leadX-HW/2;   // already behind it: drive straight through toward their goal
      if(ballHigh&&nearOwnGoal){wantHigh=true;bxT=(ballX-atk*(HW*0.3))-HW/2;}   // a high ball at my own net: LEAP to head it clear
      else if(ballHigh&&myGS&&Math.abs(ballX-myX)<HW*2.4){wantHigh=true;bxT=leadX-HW/2;}
      /* ===== IN RANGE OF THE POSTS: HIT IT UP =====
         The League\'s target is ABOVE the crossbar, so a head that drives the ball flat at
         the wall has done nothing. This is the ONE line of AI the mode adds, and it adds no
         new behaviour: `wantHigh` is the existing flag that turns the existing charge into
         the existing 940+ leap -- the same one that already fires for a high ball at your
         own net. All that changes is WHEN a head decides the ball is worth going up for,
         and the answer is "once you are in kicking range of their posts".

         WHAT IT IS NOT. It moves nobody, spaces nobody, and assigns no station: it is read
         off the BALL\'s x and this head\'s own side of it, exactly like every other branch
         here. The chaser was already the head with the best angle and is still that head;
         it now leaves the ground when it strikes. The contact loft is untouched at 0.26 --
         that number was measured, costs 45% of the scrum when raised, and raising it here
         would have been the lazy way to get the same lift for a much worse game. ===== */
      if(S9.yow&&myGS&&((atk>0)?(ballX>heroR.w*0.58):(ballX<heroR.w*0.42)))wantHigh=true;}   // an airborne ball I'm already behind: VOLLEY it forward toward their net -- aerial shots + bank-offs, soccer's electric bit
     else if(role==="keeper"||(role==="defender"&&ballOnOurHalf)){   // GUARD: hang between the ball and my net, clear only from the goal side (never poke it back toward my own net)
      // MIRRORED. See the note on the SUPPORT clamp below -- same bug, same cause, same one-term fix.
      bxT=Math.max(M,Math.min(heroR.w-M,(ballX+ownGoalX*2)/3))-HW/2;
      /* ===== THE KEEPER'S LEASH: DIAGNOSED, AND DELIBERATELY LEFT ALONE =====
         Jayden: "the 'goalie' of the other team just stands there." He is right about what
         he is seeing, and the cause is not an AI that stopped running -- it is this clamp
         saturating. The line above puts the keeper a third of the way from its own net to
         the ball, so its target only ever reaches 0.33 of the pitch even with the ball in
         the far corner; the clamp below cuts that band to 0.11. Solve for when it binds and
         the answer is "whenever the ball is past 44% of the pitch", which is most of a
         match. MEASURED, over three 45-second eight-head matches at 1440x900 sampled at
         10Hz (tools/soccer-bundle-probe.py): the clamp binds 71% of the frames. The keeper
         is not stopping -- it is standing exactly where it is being told to stand on every
         one of those frames, and a target that never changes is, from the stands,
         indistinguishable from a head that has given up.
         SO THE OBVIOUS FIX IS A LONGER LEASH, AND IT IS DISPROVED. It was tried at 0.15 and
         0.20 and measured against the same three-match sample. The keeper stops looking
         parked -- saturation 71% -> 55% -> 34% -- and the match gets quieter in a straight
         line, because a keeper with more rope is simply a better goalkeeper and cuts play
         out before it reaches the box:

           leash          0.11        0.15        0.20
           ball enters a goal area  13.8/min  11.1/min   7.1/min
           of those, fast (shots)    8.9/min   7.6/min   4.9/min
           goals per match              3.0       2.0       1.7
           3+ in a goal area      2% of play  3%        12%, worst spell 0.8s -> 2.9s

         At 0.20 it is emphatic: goals nearly halved and the bundling Jayden is complaining
         about got six times more common and three and a half times longer. The keeper's
         short leash is not a defect -- it is what keeps the goalmouth busy and the score
         high, and this clamp is load-bearing for the thing he likes.
         So the clamp below is EXACTLY as it shipped, to the byte. The leash was measured,
         not adjusted; tools/soccer-bundle-probe.py --leash re-serves this file with the
         number swapped, so the trade-off above can be re-derived without editing anything. What is NOT on the
         table, whatever is decided about the leash: roles, zones, stations or formations.
         Those have been rejected three times. */
      var _kPre=bxT;   // ...so the probe can see whether the clamp below actually bit this frame
      if(role==="keeper")bxT=team===1?Math.min(bxT,heroR.w*0.11):Math.max(bxT,heroR.w*0.89-HW);
      if(_W9&&role==="keeper")me.__kSat=(bxT!==_kPre)?1:0;
      if(ballHigh&&nearOwnGoal&&ballOnOurHalf)wantHigh=true;}   // spring up to block the high shot
     else{   // SUPPORT: push up toward their goal to receive the clear / pounce a rebound -- staying goal-side so a forward pass finds me
      var _small9=(window.__hmCrowd||4)<=4;   // small game: press much closer to the ball so the second head is in the mix too (more bumping, less hanging back)
      var aheadX=ballX+atk*((_small9?0.5:1.5)*HW+heroR.w*(_small9?0.03:0.1)+teamAhead*HW*0.7)+(Math.random()*60-30);
      // THE PITCH WAS SHORTER ON THE RIGHT, AND THAT IS THE WHOLE BUG. Jayden: "some players cover
      // their own goal, blocking the ball. And the left goal gets scored on every time ... they all
      // run to the right." Three symptoms, one cause, and it is this clamp and its twin above.
      //
      // aheadX is a CENTRE (it is built from ballX, which is a ball centre). bxT is a LEFT EDGE --
      // it is compared against x. The -HW/2 at the end is the conversion between the two, and it is
      // correct. What was wrong is that the clamp ran BEFORE the conversion while its two bounds
      // were written in different spaces: the low bound M+HW*0.2 is a distance from the left wall,
      // but the high bound heroR.w-M-HW*1.2 already had a head-width subtracted, as if it were
      // bounding the left edge. So the head-width was paid twice on the right and never on the left.
      // Measured at 1280 with HW=108, M=40, the reachable CENTRE band was [61.6, 1110.4]: 61.6 from
      // the left wall and 169.6 from the right. A full head-width of pitch that only one side had.
      //
      // That is why they all run right and then stop dead in a line. 1110 is not where the ball is,
      // it is where the clamp is -- and a soak confirmed it: the two team-1 attackers averaged 1092
      // and 1126 against a bound of 1110.4, i.e. parked ON it. Because the bound sits just short of
      // the right goal, the crowd forms a WALL across its mouth -- "players cover their own goal,
      // blocking the ball" -- so the right net is screened and cannot be scored on, while the left
      // has no such bound, nobody queues there, and it "gets scored on every time".
      //
      // The fix is to mirror the bound, and only the bound. The LEFT value is untouched, so the
      // press is exactly as close and exactly as aggressive as it already was; the right simply
      // gets the same licence. Nothing here spaces the heads out, assigns anyone a station, or
      // damps the scrum -- the pile-up disappears because the wall it was queueing against is gone,
      // not because anyone was told to stand apart.
      bxT=Math.max(M+HW*0.2,Math.min(heroR.w-M-HW*0.2,aheadX))-HW/2;}
     var ddb9=bxT-x;
     if(Math.abs(ddb9)>HW*0.4){dir=ddb9>0?1:-1;gzx=dir*0.85;gzy=(ballY<floorY-160?-0.55:0.15);sacAt=now+560;   // eyes lock onto the ball as it goes
      surface=floorY;st="fall";air=true;
      var ballUp=Math.max(0,floorY-ballY),ballClose=Math.abs(ballX-myX)<heroR.w*0.22;
      var vyb9=(wantHigh?(940+Math.random()*80):(overBall?720:(ballClose?440:360)))+Math.min(560,ballUp*0.72)+Math.random()*90,ttb9=2*vyb9/G;   // wantHigh = a real leap to block / head a high ball
      vy=-vyb9*(_lit?1.09:1);vx=dir*Math.min(_lit?900:800,Math.max(120,Math.abs(ddb9)/ttb9)*(_lit?1.12:1));sqT=0.12;sqyP=1.1;sqxP=1/1.1;   // on fire: a touch quicker, a touch springier -- visible in play, never a scripted rescue
      if(vyb9>780&&Math.random()<0.5)startFlip();}   // RAW ballistic leap at the ball -- fast, committed, explosive contact (this is soccer's electric charm; no mid-air easing) + a somersault off the big challenges for extra air
     /* ===== THE VERTICAL CONTEST: THE HEAD THAT IS ALREADY THERE =====
        Jayden: "the ball bouncing in the air is intresting heads jumping up for it is
        intresting", in the same breath as "no players seem to be standing still".

        Those are ONE branch, and this is it. Every head on this pitch moves by leaping at a
        LATERAL target, so the only thing that ever puts one in the air is having somewhere
        else to be. A head whose target is already under its feet -- which is what
        |ddb9| <= HW*0.4 means -- fell through to a gaze and stood there. Including, and this
        is the part that reads worst, a head standing directly underneath a ball dropping out
        of the sky. It watched it come down.

        So: if the ball is overhead and within a head-width, GO UP FOR IT. That is the same
        raw ballistic leap the branch above uses, with the lateral term taken out because
        there is no lateral distance to cover -- it is not a new behaviour, it is the existing
        one reaching a case it could not express.

        WHAT IT IS NOT. It moves nobody. It assigns nothing. It is available to every head on
        the pitch regardless of role or side, it triggers on the ball's position and nothing
        else, and two heads standing together both take it -- which is an aerial duel, not a
        formation. Nothing here spaces anyone out, and the scrum is not consulted.

        THE WINDOW IS BOUNDED AT BOTH ENDS. Below HH*0.5 the ball is at chest height and the
        body collision already has it, so a jump would be a hop for no reason; above HH*3
        nothing reachable is up there and heads would pogo at a ball crossing the roof. */
     else{
      var _ovH=floorY-ballY,_ovX=Math.abs(ballX-myX);
      if(_ovX<HW*0.95&&_ovH>HH*0.5&&_ovH<HH*3.0){
       dir=(ballX>myX)?1:-1;gzx=dir*0.5;gzy=-0.7;sacAt=now+620;   // eyes go UP -- he is watching the ball, not the pitch
       surface=floorY;st="fall";air=true;
       var _upV=700+Math.min(620,_ovH*0.86)+Math.random()*110;
       vy=-_upV;vx=dir*Math.min(220,_ovX*2.2);   // straight up, with only enough drift to meet the ball
       sqT=0.12;sqyP=1.12;sqxP=1/1.12;
       if(_upV>1150&&Math.random()<0.35)startFlip();}   // a big spring gets a somersault, same as the lateral charge
      else{gzx=(ballX>myX)?0.6:-0.6;gzy=0.1;sacAt=now+700;}}}}}catch(_){}
  if(battleOn&&!elim&&!celebrated){var alive9=0,inb9=0;
   for(var a9=0;a9<peers.length;a9++){if(peers[a9].inB){inb9++;if(!peers[a9].elim&&!peers[a9].__sinking)alive9++;}}   // a sinking head is already out -> the winner is crowned as the last rival melts
   if(inb9>=2&&alive9===1){celebrated=true;try{if(window.__hmLavaOn&&window.__hmCareer&&slot!=null)window.__hmCareer.rec("lavaWin",slot);}catch(_){}   // LAST HEAD STANDING: crown the winner right where he stands (soccer-style, no podium), a victory leap + confetti, then everyone streams back
    crownEl.style.opacity="1";if(filler){smileT=3.8;danceUntil=now+3600;}
    if(!grabbed){dir=((heroR.w/2)>(x+HW/2))?1:-1;surface=floorY;st="fall";air=true;vy=-(900+Math.random()*140);vx=dir*(90+Math.random()*120);sqT=0.13;sqyP=1.11;sqxP=1/1.11;startFlip();}   // he leaps for it
    brf=6;mof=4;
    var _cc=null;try{var _t=window.__hmTour;
     if(_t&&_t.live&&window.__hmTeamCol&&team&&window.__hmTeamConfetti)
       _cc=window.__hmTeamConfetti(window.__hmTeamCol[team]);}catch(_){}
    confettiBurst(heroR.w*0.5,_cc);
    try{if(window.__hmBattleWin)window.__hmBattleWin(window.__hmLavaOn?"Survivor!":"Champion!");}catch(_){}
    try{if(typeof busyNow==="function"&&!busyNow()&&typeof setHold==="function"){setHold("smile",2200);showFace("smile");}}catch(_){}
    setTimeout(function(){window.__hmRespawn=performance.now();},4200);}}   // hold the moment, then everyone comes back to normal life
  var _dazed=((me.__spin&&now<me.__spin)||(me.__disco&&now<me.__disco)||(me.__frozen&&now<me.__frozen));   // banana/disco/ice: can't fight while dazed
  if(battleOn&&!elim&&!me.podiumRank&&!me.spectate&&!grabbed&&!air&&!_dazed&&st==="idle"&&now>=decideAt&&now>=(window.__hmBattleGo||0)){
   var mcx=x+HW/2,myFeet=y+HH*FOOT;
   if(window.__hmLavaOn){   // ===== FLOOR IS LAVA -- SURVIVAL AI: climb to stay above the rising lava, sometimes shove a neighbour in =====
    if(me.__aggro==null){me.__aggro=(Math.random()<0.35)?(0.70+Math.random()*0.25):(0.12+Math.random()*0.23);me.__skill=0.86+Math.random()*0.30;}   // PERSONALITY: only one or two of the crowd are real bullies and everyone climbs at their own pace -- a whole field with identical nerve is exactly what reads as scripted, and it bunches them up to die together
    decideAt=now+(150+Math.random()*130)/(me.__skill||1);   // sharper heads react sooner, so the pack spreads out instead of moving as one block
    var lavaY=window.__hmLavaY(mcx),danger=lavaY-myFeet;   // px of lava below my feet (smaller = deadlier)
    var VMX=1180,VXMX=545,HMAX=(1180*1180)/(2*G)-18;   // the biggest rise a head can clear, and a horizontal speed cap
    var onSafe=false,edgeIn=1e9,myPlatC=mcx;   // am I on a still-safe slab, how near its edge, where is its centre
    for(var pj=0;pj<battlePlats.length;pj++){var _P0=battlePlats[pj];if(mcx>_P0.l&&mcx<_P0.r&&Math.abs(myFeet-_P0.t)<11&&_P0.t<lavaY-6){onSafe=true;edgeIn=Math.min(mcx-_P0.l,_P0.r-mcx);myPlatC=(_P0.l+_P0.r)/2;break;}}
    function planJump(P){var up=myFeet-P.t;if(up>HMAX)return null;   // plan a leap that LANDS on top of P -> null if out of reach, so a head NEVER leaps short into the lava
     var clear=Math.max(95,up+62),vj=Math.min(VMX,Math.sqrt(2*G*clear)),disc=vj*vj-2*G*up;if(disc<0)return null;
     var tAir=(vj+Math.sqrt(disc))/G,half=(P.r-P.l)/2,aim=Math.max(P.l+half*0.32,Math.min(P.r-half*0.32,mcx));
     var vx0=(aim-mcx)/Math.max(0.16,tAir);if(Math.abs(vx0)>VXMX)return null;return{vy:-vj,vx:vx0};}
    var tP=null,tJ=null,tS=1e9;   // the best safe slab I can actually REACH (a modest step up, not too far across)
    for(var pi=0;pi<battlePlats.length;pi++){var P1=battlePlats[pi];if(P1.t>=lavaY-6)continue;var up1=myFeet-P1.t;if(up1<-4)continue;if(onSafe&&up1<24)continue;var J=planJump(P1);if(!J)continue;var pcx1=(P1.l+P1.r)/2,sc=Math.abs(up1-105)*0.7+Math.abs(pcx1-mcx)*0.42;if(sc<tS){tS=sc;tP=P1;tJ=J;}}
    var _grT=(me.__grudge&&now<me.__grudge.until)?me.__grudge.t:null,_alT=(me.__ally&&now<me.__ally.until)?me.__ally.t:null;
    var _lt=window.__hmLavaTeams?window.__hmTeamSel:null,_myTm=_lt?(_lt[me.slot]||0):0,_enemyAlive=0;
    if(_lt&&_myTm){for(var _ec=0;_ec<peers.length;_ec++){var _ev=peers[_ec];if(_ev===me||!_ev.inB||_ev.elim||_ev.__sinking)continue;if((_lt[_ev.slot]||0)!==_myTm)_enemyAlive++;}}
    var _spareMate=(_lt&&_myTm&&_enemyAlive>0);
    var rvl=null,rbd=1e9,rvlPush=1;for(var s9=0;s9<peers.length;s9++){var rv=peers[s9];if(rv===me||!rv.inB||rv.elim||rv.__sinking||rv===_alT)continue;if(_spareMate&&(_lt[rv.slot]||0)===_myTm)continue;
     var _rcx=rv.x+rv.HW/2,rvdx=_rcx-mcx,rvdy=(rv.y+rv.HH/2)-myFeet;if(Math.abs(rvdy)>HH*0.9)continue;   // go after someone on ~my level
     var rd=Math.hypot(rvdx,rvdy),_isFoe=(_lt&&_myTm&&(_lt[rv.slot]||0)!==_myTm);
     var _rP=null;for(var _rk=0;_rk<battlePlats.length;_rk++){var _RP=battlePlats[_rk];if(_rcx>_RP.l&&_rcx<_RP.r&&Math.abs((rv.y+rv.HH*FOOT)-_RP.t)<15&&_RP.t<lavaY-6){_rP=_RP;break;}}   // which slab is he on?
     var _rEdge=_rP?Math.min(_rcx-_rP.l,_rP.r-_rcx):9999,_rDang=window.__hmLavaY(_rcx)-(rv.y+rv.HH*FOOT);   // how KILLABLE: near an edge? near the lava?
     var _pushOff=_rP?(((_rcx-_rP.l)<(_rP.r-_rcx))?-1:1):((rvdx>=0)?1:-1);   // the direction that drives him OFF his nearer edge
     var _vuln=(_rEdge<rv.HW?0.5:1)*(_rDang<300?0.5:1)*(((rvdx>=0?1:-1)===_pushOff)?0.6:1);   // prime target = on an edge / near the lava / one I can drive off from where I stand
     var _w=rd*_vuln*((rv===_grT||_isFoe)?0.45:1),_reach=(rv===_grT||_isFoe)?HW*5:HW*3.4;
     if(rd<_reach&&_w<rbd){rbd=_w;rvl=rv;rvlPush=_pushOff;}}
    var urgent=(danger<235);   // react EARLY -- heads scramble for higher ground well before the lava is on them, instead of waiting around and looking like they gave up
    if(urgent||!onSafe){
     if(tP){dir=((tP.l+tP.r)/2>mcx)?1:-1;surface=floorY;st="fall";air=true;gzx=dir*0.7;gzy=-0.45;sacAt=now+440;vy=tJ.vy;vx=tJ.vx;aimX=(tP.l+tP.r)/2;if(Math.random()<0.55)startFlip();sqT=0.12;sqyP=1.1;sqxP=1/1.1;}   // spring onto a reachable safe slab (lands ON it) -- a somersault off a big climb
     else{   // nothing lands in ONE jump -> don't hop hopelessly straight up; SCRAMBLE toward the nearest higher slab (build toward it, jump again) so it reads as fighting to survive
      var _np=null,_nd=1e9;for(var _pk=0;_pk<battlePlats.length;_pk++){var _P=battlePlats[_pk];if(_P.t>=lavaY-6)continue;if(_P.t<myFeet-8){var _pc=(_P.l+_P.r)/2,_dd=Math.abs(_pc-mcx)+Math.max(0,myFeet-_P.t)*0.25;if(_dd<_nd){_nd=_dd;_np=_P;}}}
      if(_np){var _tc=(_np.l+_np.r)/2;dir=(_tc>mcx)?1:-1;aimX=_tc;gzx=dir*0.75;}else{dir=(mcx>heroR.w/2)?-1:1;aimX=null;gzx=dir*0.4;}   // aimX feeds the mid-air steering so he arcs toward safety, never a dive into the pit
      surface=floorY;st="fall";air=true;vy=-VMX;vx=vx*0.15+dir*(_np?Math.min(560,Math.max(200,Math.abs((_np.l+_np.r)/2-mcx)*1.5)):90);gzy=-0.6;sacAt=now+420;sqT=0.12;sqyP=1.12;sqxP=1/1.12;}
    }else{   // safe for the moment -> HUNT: this is where heads knock each other into the lava, not idly wait
     var _heat=(window.__hmLavaLevel||0);
     if(edgeIn<HW*0.4&&danger<360&&!(rvl&&Math.random()<0.5)){dir=(myPlatC>mcx)?1:-1;surface=floorY;st="fall";air=true;vy=-(115+Math.random()*60);vx=dir*(95+Math.random()*80);aimX=myPlatC;sqT=0.11;sqyP=1.09;sqxP=1/1.09;}   // hugging the edge with the lava near -> usually step back, but sometimes stand ground and swing back
     else if(rvl&&_heat>0.16&&Math.random()<(me.__aggro*0.6+_heat*0.5)){var scx=rvl.x+rvl.HW/2;dir=(scx>mcx)?1:-1;surface=floorY;st="fall";air=true;gzx=dir*1;sacAt=now+320;vy=-(90+Math.random()*70);vx=dir*Math.min(470,Math.max(240,Math.abs(scx-mcx)*2.0));aimX=scx+rvlPush*HW*0.55;me.__charging=now+320;sqT=0.12;sqyP=1.13;sqxP=1/1.13;brf=6;}   // CHARGE a vulnerable rival and drive him OFF his fall side toward the lava -- aim PAST him, flag the charge so the collision lands hard. Aggression RAMPS with the heat: heads climb + jostle early (so the round still reaches the high tiers, varied every time), then brawl lethally for the scarce top slabs as the lava closes in (Fall Guys / King-of-the-Hill escalation)
     else if(tP&&Math.random()<0.82){dir=((tP.l+tP.r)/2>mcx)?1:-1;surface=floorY;st="fall";air=true;gzx=dir*0.6;gzy=-0.4;sacAt=now+440;vy=tJ.vy;vx=tJ.vx;aimX=(tP.l+tP.r)/2;if(Math.random()<0.5)startFlip();sqT=0.12;sqyP=1.1;sqxP=1/1.1;}   // RACE for higher ground -- heads keep clawing upward toward the safe peak (fighting for their lives), never idly sitting
     else if(!tP){var _up=null,_ud=1e9;   // nothing lands in a single leap -> SHUFFLE UNDER the nearest higher rung so the next hop can reach it. Standing on the opening ground waiting for the lava is never an option.
      for(var _uk=0;_uk<battlePlats.length;_uk++){var _UP=battlePlats[_uk];if(_UP.t>=lavaY-6||_UP.t>myFeet-18)continue;
       var _uc=(_UP.l+_UP.r)/2,_udd=Math.abs(_uc-mcx);if(_udd<_ud){_ud=_udd;_up=_UP;}}
      if(_up&&_ud>HW*0.45){var _uc2=(_up.l+_up.r)/2;dir=(_uc2>mcx)?1:-1;surface=floorY;st="fall";air=true;vy=-(300+Math.random()*150);vx=dir*Math.min(430,Math.max(180,_ud*1.6));aimX=_uc2;gzx=dir*0.7;gzy=-0.4;sqT=0.11;sqyP=1.09;sqxP=1/1.09;}}
     else if(danger<340&&Math.random()<0.5){gzy=0.45;gzx=Math.random()*0.4-0.2;sacAt=now+520;}   // no higher ground in reach -> at least eye the rising lava (a held beat, not a give-up)
    }
   } else {   // (legacy brawl AI -- unused now that Floor is Lava replaced it, kept as a fallback)
    decideAt=now+280+Math.random()*260;
    var tgt=null,td9=1e9;for(var b9=0;b9<peers.length;b9++){var pv=peers[b9];if(pv===me||!pv.inB||pv.elim)continue;var dd9=Math.abs((pv.x+pv.HW/2)-mcx);if(dd9<td9){td9=dd9;tgt=pv;}}
    if(tgt){var toX=tgt.x+tgt.HW/2,onPlat=false;for(var q9=0;q9<battlePlats.length;q9++){var PP=battlePlats[q9];if(Math.abs(myFeet-PP.t)<9&&mcx>PP.l&&mcx<PP.r){onPlat=true;break;}}
     dir=(toX>mcx)?1:-1;surface=floorY;st="fall";air=true;gzx=dir*0.9;sacAt=now+700;
     if(onPlat){vy=-(130+Math.random()*90);vx=dir*Math.min(760,Math.max(200,td9*2.3));sqT=0.12;sqyP=1.13;sqxP=1/1.13;startFlip();brf=6;}
     else{vy=-(340+Math.random()*230);vx=dir*Math.min(700,Math.max(150,td9*2.0));sqT=0.12;sqyP=1.1;sqxP=1/1.1;}}}}
  if(battleOn&&!elim&&bigR){try{   // the spectator: his gaze follows the centre of the fight
   if(!window.__hmWatchAt||now>window.__hmWatchAt){window.__hmWatchAt=now+520+Math.random()*260;
    var wx=0,wy=0,wn=0;
    for(var w9=0;w9<peers.length;w9++){var pw=peers[w9];if(pw.inB&&!pw.elim){wx+=pw.x+pw.HW/2;wy+=pw.y+pw.HH/2;wn++;}}
    if(wn&&typeof gaze!=="undefined"&&typeof busyNow==="function"&&!busyNow()){
     var bcx9=(bigR.l+bigR.r)/2,bcy9=(bigR.t+bigR.b)/2;
     gaze={x:Math.max(-1,Math.min(1,(wx/wn-bcx9)/((bigR.r-bigR.l)*0.8))),y:Math.max(-0.3,Math.min(1,(wy/wn-bcy9)/((bigR.b-bigR.t)*0.7)))};
     nextSaccade=now+900;}}}catch(_){}}
  if(elim&&elimP<1){elimP=Math.min(1,elimP+DT*2.4);   // eliminated: a quick shrink into nothing
   if(elimP>=1){root.style.display="none";shadow.style.display="none";}}
  if(hurtT>0){hurtT-=DT;hurtEl.style.opacity=(Math.max(0,hurtT)/0.2*0.62).toFixed(2);}
  if(mjClone&&mjBigFace){   // MIRROR the live big head onto the clone: same expression, same blink, same gaze, every frame -- for free
   var _bE=document.querySelectorAll("#stage > .eye"),_cE=mjClone.querySelectorAll(".eye"),_rat=mjBigW?HW/mjBigW:0.25;   // his gaze is in HIS pixels; scale it to the mini so the iris moves the same FRACTION of the eye, not the same pixels (which flew the iris right out of the tiny eye)
   if(_bE.length&&_cE.length<_bE.length){   // EYES-LOAD SAFETY: buildEyes() wipes + re-adds his eyes on every setFace, so a clone snapshotted in that gap comes up EYELESS. Graft the current pair in (ink filter stripped, like the rest of the clone) so his eyes always load -- self-heals the next frame his eyes exist.
    for(var _gi=_cE.length;_gi<_bE.length;_gi++){var _ge=_bE[_gi].cloneNode(true);_ge.style.filter="none";var _gd=_ge.querySelectorAll("*");for(var _gj=0;_gj<_gd.length;_gj++){try{_gd[_gj].style.filter="none";}catch(_){}}mjClone.appendChild(_ge);}
    _cE=mjClone.querySelectorAll(".eye");}
   var _bClosed=_bE[0]&&_bE[0].classList.contains("eclosed");
   // his OWN grin: the big head is hidden mid-game, so his personality has to be driven from game events. smileT is set when he scores, wins, or is last one standing (see the soccer/battle hooks above).
   var _grin=filler&&smileT>0;
   var _dancing=filler&&danceUntil>now;   // his delight dance (a win): grin + wink groove
   var _bsrc;
   if(_grin){
    if(_dancing&&Math.floor(now/300)%3===2)_bsrc=_bClosed?"images/wink_closed.webp":"images/wink.webp";   // groove: flash a wink on the beat
    else _bsrc=_bClosed?"images/smile_closed.webp":"images/smile.webp";}   // his real smile FACE bakes his (smiling) eyes right in -> the iris overlays MUST come off or he wears two sets of eyes
   else if(filler&&mjHurtUntil>now){_bsrc=_bClosed?"images/rest_closed.webp":"images/rest.webp";}   // his WINCE when a blow lands: the REST face (half-lidded, scrunched) IS his "ow" -- set for ~0.6s in hurt()
   else{_bsrc=mjBigFace.getAttribute("src")||"";
    if(/smile/.test(_bsrc))_bsrc=_bsrc.replace("smile","neutral");   // his grin is his OWN, team-gated (smileT) -- don't borrow the shared big head's smile when the OTHER team scored
    if(/rest/.test(_bsrc))_bsrc=_bsrc.replace("rest","neutral");   // a FIGHTER never drifts sleepy mid-game (rest_closed -> neutral_closed keeps the blink)
    // --- his OWN expressiveness (he's ME -- the liveliest head): a rotating repertoire of idle beats between the action, plus brow raises on every game beat ---
    if(filler){
     var _calm=!air&&st==="idle"&&mjHurtUntil<now;
     if(now>=mjExprAt){mjExprAt=now+1900+Math.random()*2400;   // pick a fresh little beat every couple seconds
      if(_calm){var _r=Math.random();
       if(_r<0.34){brf=Math.max(brf,6);}                       // a warm brow flash
       else if(_r<0.58){mjExprKind="waggle";mjExprUntil=now+560;}   // an eyebrow WAGGLE (brows bounce)
       else if(_r<0.80){mjExprKind="wink";mjExprUntil=now+480;}     // a cheeky wink
       else if(_r<0.94){mjExprKind="smile";mjExprUntil=now+620;}    // a quick grin to himself
       else {mjExprKind="brows";mjExprUntil=now+680;}}}             // a held raise
     if(mjExprUntil>now){
      if(mjExprKind==="wink")_bsrc=_bClosed?"images/wink_closed.webp":"images/wink.webp";
      else if(mjExprKind==="smile")_bsrc=_bClosed?"images/smile_closed.webp":"images/smile.webp";
      else if(mjExprKind==="waggle")_bsrc=(Math.floor(now/140)%2)?"images/neutral_browsup.webp":(_bClosed?"images/neutral_closed.webp":"images/neutral.webp");   // the bounce
      else if(!/closed/.test(_bsrc))_bsrc="images/neutral_browsup.webp";}}
    if(brf>0&&mjExprUntil<=now&&!/closed|smile|wink/.test(_bsrc))_bsrc="images/neutral_browsup.webp";}   // EXPRESSIVE EYEBROWS on every beat -- a goal, a hit, a startle, a pounce all set brf
   var _cff=mjClone.querySelector(".face");
   if(_cff&&_cff.getAttribute("src")!==_bsrc)_cff.setAttribute("src",_bsrc);   // the OUTLINE uses a STABLE neutral silhouette (his head shape barely changes between faces) -- re-masking it per expression flashed an unmasked rectangle for a frame; a fixed mask is rock-steady
   var _faceDir=(dir<0?1:-1);if(mjClone.__fd!==_faceDir){mjClone.__fd=_faceDir;mjClone.style.transform="translateY(27%) scaleX("+_faceDir+")";ringEl.style.transform="scale(1.06) translateY(27%) scaleX("+_faceDir+")";hurtEl.style.transform="translateY(27%) scaleX("+_faceDir+")";
    try{ringEl.style.transform="scale("+(1.06*_faceDir).toFixed(3)+",1.06)";hurtEl.style.transform="scaleX("+_faceDir+")";}catch(_){}}   // the rim + red flash FLIP with him and (sharing his root) ride every squash & move -> consistent, glitch-free
   for(var _mi=0;_mi<_cE.length&&_mi<_bE.length;_mi++){
    var _bShut=_bE[_mi].style.display==="none"||_bE[_mi].style.visibility==="hidden"||_bE[_mi].classList.contains("eclosed");   // the big head closes three different ways; treat them as one
    var _wantHide=(_grin||/smile|wink/.test(_bsrc)||_bShut)?"none":"";if(_cE[_mi].style.display!==_wantHide)_cE[_mi].style.display=_wantHide;   // no floating irises over a baked-in smile OR wink -- or over a blink
    _cE[_mi].classList.toggle("eclosed",_bE[_mi].classList.contains("eclosed"));   // mirror the blink
    var _bi=_bE[_mi].querySelector(".iris"),_ci=_cE[_mi].querySelector(".iris");if(_bi&&_ci){var _t=_bi.style.transform||"",_m=_t.match(/translate\(\s*(-?[\d.]+)px[ ,]+(-?[\d.]+)px/);if(_m){var _gx=Math.max(-2.6,Math.min(2.6,parseFloat(_m[1])*_rat)),_gy=Math.max(-2.1,Math.min(2.1,parseFloat(_m[2])*_rat));_ci.style.transform="translate("+_gx.toFixed(2)+"px,"+_gy.toFixed(2)+"px)";}else _ci.style.transform=_t;}   // mirror the gaze, SCALED + CLAMPED so the iris never rides out of the socket
    var _bg=_bE[_mi].querySelector(".glint"),_cg=_cE[_mi].querySelector(".glint");if(_bg&&_cg){var _tg=_bg.style.transform||"",_mg=_tg.match(/translate\(\s*(-?[\d.]+)px[ ,]+(-?[\d.]+)px/);_cg.style.transform=_mg?("translate("+(parseFloat(_mg[1])*_rat).toFixed(2)+"px,"+(parseFloat(_mg[2])*_rat).toFixed(2)+"px)"):_tg;}}
   if(smileT>0)smileT-=DT;
   // his DELIGHT DANCE: keep the grin lit and, while he has the floor (not mid-air, not frozen on a podium), break into bouncy head-banging hops
   if(_dancing){if(smileT<0.4)smileT=0.4;
    if(!air&&!grabbed&&!me.podiumRank&&now>=danceHopAt){danceHopAt=now+300+Math.random()*140;
     air=true;st="fall";surface=floorY;dir=(Math.random()<0.5?-1:1);vy=-(330+Math.random()*150);vx=dir*(60+Math.random()*90);sqT=0.12;sqyP=1.12;sqxP=1/1.12;   // a joyful hop (kept below the flip threshold -> a groove, not somersaults)
     if(!wig)wig={t:0.45,dur:0.45,type:"tilt",a:(dir)*7};}   // and a head-bang tilt on each beat
    if(me.podiumRank&&!wig&&now>=danceHopAt){danceHopAt=now+420;wig={t:0.5,dur:0.5,type:"tilt",a:(Math.random()<0.5?-1:1)*6};}}}   // crowned on the podium: he can't hop off, so he grooves in place
  else if(filler&&me.__smileCut){var wantSmile=smileT>0;   // (fallback for a non-mirror bake): swap to his smile face
   if(wantSmile!==smiling){smiling=wantSmile;im.src=wantSmile?me.__smileCut:data.cut;var ov=wantSmile?"0":"";
    if(mouth)mouth.style.opacity=ov;if(nose)nose.style.opacity=ov;
    brows.forEach(function(b){b.style.opacity=ov;});eyeEls3.forEach(function(e){if(e.box)e.box.style.opacity=ov;});}
   if(smileT>0)smileT-=DT;}
  if(battleOn||bar.style.opacity==="1"){bar.style.transform="translate("+(x+HW/2-22).toFixed(0)+"px,"+(y-12).toFixed(0)+"px)";
   barFill.style.width=hp+"%";barFill.style.background=hp<35?"#b3402e":(hp<70?"#c9782e":"");bar.style.display=(elim||me.podiumRank||me.spectate)?"none":"";}   // the bar rides along in lava mode too now -- burns take health, so you can read who is one dip from going under
  if(moodB&&!grabbed&&!perched&&shown&&now>=audAt){audAt=now+900+Math.random()*1400;   // showtime: gather in, watch, bounce along
   if(!air&&st==="idle"){var bcx2=bigR?(bigR.l+bigR.r)/2:heroR.w/2,dx4=bcx2-(x+HW/2);
    if(bigR&&Math.abs(dx4)>(bigR.r-bigR.l)*0.95){dir=dx4>0?1:-1;surface=floorY;st="hop";hopsLeft=1;
     setTimeout(function(){if(!grabbed&&st==="hop"&&!air)hop(false);},100);}
    else if(Math.random()<0.7){air=true;st="fall";surface=floorY;vy=-(260+Math.random()*140);vx=dir*(8+Math.random()*20);sqT=0.11;sqyP=1.08;sqxP=1/1.08;}
    if(Math.random()<0.4)brf=6;}}
  if(now>=decideAt&&!soccerOn&&!battleOn&&!window.__hmRaceOn)decide(now);   // in a game the game drives them, not the idle wander
  // while perched it RIDES the breathing head: the hair moves, so does it
  if(perched&&moodB&&now>=pbAt){pbAt=now+700+Math.random()*500;sqT=0.11;sqyP=1.08;sqxP=1/1.08;}   // docked at a show: it bounces along
  if(perched&&!grabbed&&!air&&leapDelay<Infinity){
   if(!introSettled){try{var ey0=document.querySelector(".eye");if(ey0&&ey0.classList.contains("eclosed"))introSettled=true;}catch(_){}
    if(!introSettled&&performance.now()-bornWall>12000)introSettled=true;}   // his intro finishes first: it sits on his hair until the show is over
   if(introSettled&&!moodB)perchT+=DT;
   if(perchT>=leapDelay){leapDelay=Infinity;perched=false;st="fall";air=true;surface=floorY;
    var lsp=Math.max(1,x-M),rsp=Math.max(1,heroR.w-(x+HW)-M),side=Math.random()<0.5?-1:1;   // a fair coin, with just enough sense to avoid a wall
    if(side<0&&lsp<HW*2)side=1;if(side>0&&rsp<HW*2)side=-1;
    dir=side;vx=side*(240+Math.random()*220);vy=-(820+Math.random()*280);sqT=0.14;sqxP=0.89;sqyP=1.13;
    if(Math.random()<0.4)startFlip();}}
  if(perched&&!grabbed&&!air&&now>=perchWigAt){perchWigAt=now+9000+Math.random()*11000;
   if(!moodB&&!wig)wig={t:0.7,dur:0.7,type:"tilt",a:(Math.random()<0.5?-1:1)*2.5};}   // postural sway: standing still is never perfectly still
  if(perched&&!grabbed&&!air){var fEl2=document.getElementById("face");
   if(fEl2){var fr2=fEl2.getBoundingClientRect(),hb2=heroBox;   // PERF: reuse the shared cached hero rect instead of a second per-frame reflow (the face rect still measured live since the big head bobs)
    var nP=0,rank=0;   // find my seat: which of the docked heads am I, left to right
    for(var pk=0;pk<peers.length;pk++){var isP=(peers[pk]===me)?true:peers[pk].perched;if(isP){if(peers[pk]===me)rank=nP;nP++;}}
    var half=fr2.width*0.33;   // usable crown half-width: they must stay on his head
    var sp=nP>1?Math.min(HW*0.64,(half*2)/(nP-1)):0;   // squeeze the row to fit the crown as the crowd grows
    var ox=(rank-(nP-1)/2)*sp;
    var fx=half>0?Math.max(-1,Math.min(1,ox/half)):0;   // -1..1 across the crown
    var oy=fx*fx*fr2.height*0.17;   // follow the dome: the outer seats curve down onto the round of his head
    var txp=fr2.left-hb2.left+fr2.width/2-HW/2+ox,typ=fr2.top-hb2.top+fr2.height*crownFrac-HH*FOOT+HH*0.07+oy;
    if(now<dockUntil){var dk=Math.min(1,DT*9);x+=(txp-x)*dk;y+=(typ-y)*dk;}   // settles onto its seat
    else if(Math.abs(txp-x)>0.4||Math.abs(typ-y)>0.4){x+=(txp-x)*Math.min(1,DT*12);y+=(typ-y)*Math.min(1,DT*12);}}}   // rides the hair, and slides over if a neighbour leaves

  // ability LAUNCH mailbox: any ability can fling this head (gravity flip, shockwave, bomb, magnet) by setting me.__launch
  if(me.__launch&&!grabbed&&!perched){air=true;if(st==="idle")st="fall";if(me.__launch.vx!=null)vx+=me.__launch.vx;if(me.__launch.vy!=null)vy=me.__launch.vy;me.__launch=null;}
  var _gv=window.__hmGrav,_gf=(_gv&&now<_gv.until)?_gv.f:1;   // gravity factor: gravity flip / feather ride on this
  if(me.__feather&&now<me.__feather)_gf=Math.min(_gf,0.26);   // FEATHER: floaty low-gravity drift
  var _wind=window.__hmWind;if(_wind&&now<_wind.until&&air&&!grabbed){var _wax=(_wind.ax!=null?_wind.ax:(_wind.v||0)*3.2);if(isFinite(_wax))vx+=_wax*DT;}   // WIND GUST: a sideways gale sweeps the airborne
  // physics: walls, floor, ceiling, and the caregiver — nothing else is solid
  if(!grabbed&&air){
   if(battleOn&&window.__hmLavaOn&&air&&window.__hmWind&&now<window.__hmWind.until){var _wv=(window.__hmWind.v!=null?window.__hmWind.v:(window.__hmWind.ax||0));gzx=_wv>0?0.7:-0.7;}   // gaze only -- the vx push lives in the single consumer above; both firing double-applied the gust   // WIND GUST: every airborne head leans and drifts with it
   if(window.__hmLavaOn&&battleOn&&now>=hitStop&&!me.__sinking){   // MID-AIR STEERING (Reynolds seek/arrive) -- LAVA ONLY: heads correct their trajectory toward a reachable slab so they never leap short into the lava, and a knocked-loose head scrambles for safety. Soccer deliberately keeps its RAW ballistic leaps (the arrive-easing softened its ball-strikes and killed the electric feel), so its charm stays intact.
    if(window.__hmLavaOn&&aimX==null&&now>=recAt){recAt=now+120;   // pick a target the moment you're airborne WITHOUT a plan -- waiting for the fall (the old vy>0 gate) is why a head would sail straight up and only start steering once it was already doomed
     var _mf=y+HH*FOOT,_ly=window.__hmLavaY(x+HW/2),_bd=1e9;   // lava only: knocked loose with no plan -> grab the nearest reachable safe slab and scramble for it
     for(var _ri=0;_ri<battlePlats.length;_ri++){var _RP=battlePlats[_ri];if(_RP.t>=_ly-6)continue;var _rup=_mf-_RP.t;if(_rup>((1180*1180)/(2*G))-20)continue;var _rc=(_RP.l+_RP.r)/2,_rdd=Math.abs(_rc-(x+HW/2))+Math.abs(_rup)*0.5;if(_rdd<_bd){_bd=_rdd;aimX=_rc;}}}
    if(aimX!=null){var _mcx2=x+HW/2,_des=Math.max(-620,Math.min(620,(aimX-_mcx2)*2.4));vx+=Math.max(-1050*DT,Math.min(1050*DT,_des-vx));}   // arrive: eases off as it nears the aim, so it lands ON the target (slab, or where the ball is going) instead of sailing past
   }
   if(now>=hitStop){vy+=G*_gf*DT;if(vy>1800)vy=1800;if(vy<-1800)vy=-1800;x+=vx*DT;y+=vy*DT;if(flipA)flipA+=flipV*DT;}   // terminal velocity keeps dt-stepping sound; hit-stop freezes him for a few frames on impact so the blow READS (the squash keeps animating)
   if(x<WL){x=WL;if(Math.abs(vx)>420)brf=6;var _wl=window.__hmLavaOn;vx=_wl?Math.max(Math.abs(vx)*0.9,200):Math.abs(vx)*0.72;if(_wl){air=true;st="fall";vy=Math.min(vy,-Math.max(150,Math.abs(vx)*0.4));brf=6;}dir=1;sqT=0.13;sqxP=0.9;sqyP=1.11;}   // FLOOR IS LAVA: springy walls fling a knocked head back IN toward the platforms (guaranteed inward speed so a head can never climb/hover up the wall edge), with just enough lift to clear a slab
   if(x>WR){x=WR;if(Math.abs(vx)>420)brf=6;var _wr=window.__hmLavaOn;vx=_wr?-Math.max(Math.abs(vx)*0.9,200):-Math.abs(vx)*0.72;if(_wr){air=true;st="fall";vy=Math.min(vy,-Math.max(150,Math.abs(vx)*0.4));brf=6;}dir=-1;sqT=0.13;sqxP=0.9;sqyP=1.11;}
   if(y<CEIL){y=CEIL;if(Math.abs(vy)>420&&bf===0)bf=5;vy=Math.abs(vy)*0.72;sqT=0.13;sqxP=1.11;sqyP=0.9;cTop=true;}   // bonk: a startle blink
   if(battleOn&&battlePlats.length&&vy>0){var cxp=x+HW/2,feet9=y+HH*FOOT,pfeet=feet9-vy*DT;   // one-way platforms: a DESCENDING head lands on top; a rising one passes clean through
    for(var pl9=0;pl9<battlePlats.length;pl9++){var Pl=battlePlats[pl9];
     if(window.__hmLavaOn&&Pl.t>=window.__hmLavaY((Pl.l+Pl.r)/2)-2)continue;   // a platform under the lava is gone -> you can't stand on it, you fall through into the lava
     if(cxp>Pl.l&&cxp<Pl.r&&pfeet<=Pl.t+3&&feet9>=Pl.t-1&&(Pl.t-HH*FOOT)<surface){surface=Pl.t-HH*FOOT;break;}}
    if(window.__hmLavaOn&&vy>120){for(var _hk=0;_hk<peers.length;_hk++){var _oh=peers[_hk];if(_oh===me||_oh.elim||_oh.__sinking||!_oh.inB)continue;   // HEAD-STACKING: land on another head's crown -> SPRINGBOARD up off it to reach higher (and it shoves the head below down a touch)
     var _ohT=_oh.y+_oh.HH*0.14;if(_oh.ground&&(window.__hmLavaY(cxp)-feet9)<560&&Math.abs(cxp-(_oh.x+_oh.HW/2))<(HW+_oh.HW)*0.34&&pfeet<=_ohT+4&&feet9>=_ohT+HH*0.35){var _sx=(cxp>=(_oh.x+_oh.HW/2))?1:-1;y=_ohT-HH*FOOT;vy=-(360+Math.min(320,Math.abs(vy)*0.45));vx=vx*0.5+_sx*(150+Math.random()*120);dir=_sx;sqT=0.13;sqyP=1.15;sqxP=1/1.15;brf=6;_oh.ky=(_oh.ky||0)+150;break;}}}}   // SPRINGBOARD off a firmly-STANDING head, but ONLY once the lava is a real threat (within 560px) so early on nobody gets launched off the safe base or flung high into empty air; launch up + sideways so stacks scatter toward the slabs
   if(soccerOn&&vy>120){var _cxs=x+HW/2,_feetS=y+HH*FOOT,_pfS=_feetS-vy*DT,_sb=window.__hmSoccer;   // SOCCER HEAD-STACKING: spring off a team-mate's crown to reach a high ball (headers, aerial duels) -- only when the ball is genuinely up, so nobody trampolines for no reason
    if(_sb&&_sb.ball&&(floorY-_sb.ball.y)>150){for(var _hs=0;_hs<peers.length;_hs++){var _o2=peers[_hs];if(_o2===me||_o2.elim||_o2.__sinking)continue;
     var _oT2=_o2.y+_o2.HH*0.14;if(_o2.ground&&Math.abs(_cxs-(_o2.x+_o2.HW/2))<(HW+_o2.HW)*0.34&&_pfS<=_oT2+4&&_feetS>=_oT2+HH*0.35){var _sx2=(_cxs>=(_o2.x+_o2.HW/2))?1:-1;y=_oT2-HH*FOOT;vy=-(520+Math.min(360,Math.abs(vy)*0.5));vx=vx*0.5+_sx2*(120+Math.random()*130);dir=_sx2;sqT=0.13;sqyP=1.16;sqxP=1/1.16;brf=6;_o2.ky=(_o2.ky||0)+140;if(vy<-780&&Math.random()<0.5)startFlip();break;}}}}
   if(battleOn&&window.__hmSmashCrates&&CRATES.length&&now>=(window.__hmBattleGo||0)){var _fx3=x+HW/2;   // descending onto a mystery crate SMASHES it -> a random physics-chaos power
    for(var _ci=0;_ci<CRATES.length;_ci++){var _cr=CRATES[_ci];if(_fx3>_cr.x-_cr.r-HW*0.35&&_fx3<_cr.x+_cr.r+HW*0.35&&feet9>=_cr.y-_cr.r-4&&feet9<=_cr.y+_cr.r+34){smashCrate(_cr,A);break;}}}
   if(battleOn&&window.__hmLavaOn&&surface>=floorY-2)surface=1e5;   // in lava mode the FLOOR isn't solid -- only platforms + heads are (gated on MY battleOn: the frame the game ends, surface stays solid so the winner never drops through)
   if(!window.__hmLavaOn&&surface>1e4)surface=floorY;   // the lava game is over -> restore a solid floor so no head keeps falling through forever (they land + resume life)
   if(window.__hmLavaOn&&battleOn&&surface<1e8){var _cx8=x+HW/2,_ok8=false;   // in the climb there is NO ground: a landing only counts if a REAL slab is under my feet, so nobody can ever hover on the vanished floor line above the lava
    for(var _q8=0;_q8<battlePlats.length;_q8++){var _Q8=battlePlats[_q8];
     if(_cx8>_Q8.l-2&&_cx8<_Q8.r+2&&Math.abs((_Q8.t-HH*FOOT)-surface)<4){_ok8=true;break;}}
    if(!_ok8)surface=1e9;}
   if(vy>0&&y>=surface&&window.__hmLavaOn&&battleOn){var _pcx=x+HW/2;
    for(var _pd=0;_pd<battlePlats.length;_pd++){var _PD=battlePlats[_pd];
     if(_pcx<=_PD.l-2||_pcx>=_PD.r+2||Math.abs((_PD.t-HH*FOOT)-surface)>4)continue;
     if(_PD.id!=null&&window.__hmPlatTouch)window.__hmPlatTouch(_PD.id);   // an amber rung starts giving way the moment you stand on it
     if(!_PD.pad)break;
     // SPRINGBOARD, sized to the room above: near the ceiling it gives a measured nudge, low down it fires you clear -- it should always be a rescue, never a head slamming the roof
     var _room=Math.max(70,surface-Math.max(0,CEIL)-HH*0.35);
     var _rise=Math.max(150,Math.min(290,_room*0.68));
     y=surface;air=true;st="fall";vy=-Math.sqrt(2*G*_rise);vx*=0.74;sqT=0.16;sqyP=1.3;sqxP=1/1.3;brf=6;gzy=-0.7;aimX=null;
     if(FX)FX.ring(_pcx,surface+HH*FOOT,{r0:8,r1:70,color:"80,210,160",width:4,life:0.4});
     if(_rise>230)startFlip();break;}}
   if(vy>0&&y>=surface){ cTop=false; if(st==="fall"&&Math.abs(vy)>340){if(Math.abs(vy)>1050)shakeAfter=true;   // a hard landing skids, but the ground never wounds -- only a rival's lunge does
    if(Math.abs(vx)>420&&!wig)wig={t:0.22,dur:0.22,type:"tilt",a:(vx>0?1:-1)*4};   // fast landings skid: it leans into the slide
    var k=Math.min(0.2,Math.abs(vy)*0.0004);y=surface;
    var _rest=(me.__bounce&&now<me.__bounce)?0.95:(filler?0.42:0.72);   // SUPER BOUNCE: near-perfect restitution, it boings
    var _vxd=(window.__hmIce&&now<window.__hmIce)?0.995:((me.__bounce&&now<me.__bounce)?0.99:0.85);   // ICE FLOOR: frictionless, it slides on landing
    vy=-vy*_rest;vx*=_vxd;sqT=0.14;sqyP=1-k;sqxP=1/(1-k);flipA=0;flipV=0;
    if(me.__bounce&&now<me.__bounce&&Math.abs(vy)>120&&FX)FX.ring(x+HW/2,surface+HH*FOOT,{r0:6,r1:44,color:"90,200,120",width:3,life:0.35});}  // e=0.72 (toy ball); the mini-Jayden is heavier -- much less bounce
    else land();}
   else if(air&&sqT<=0){var vst=Math.min(0.1,Math.abs(vy)*0.00012+Math.abs(vx)*0.00003);sqyP=1+vst;sqxP=1/(1+vst);}   // stretch belongs to the FALL: sideways flight stays solid
  }
  // --- the ball pit: heads know each other, collide, push, and bounce ---
  if(me.dmgIn){if(battleOn&&!elim&&!window.__hmLavaOn)hurt(me.dmgIn);me.dmgIn=0;}   // Floor is Lava: heads BUMP (elastic collisions still fire) but deal no HP damage -- only the lava kills
  if(me.kx||me.ky){if(!grabbed&&!perched){
   var kmag=Math.hypot(me.kx,me.ky);
   if(!air&&kmag>(window.__hmLavaOn?150:55)){air=true;st="fall";surface=floorY;vy=Math.min(vy-(window.__hmLavaOn?40:120),-(window.__hmLavaOn?55:140)-kmag*(window.__hmLavaOn?0.1:0.4));}   // a shove lifts it -- but in lava the lift is tiny, so heads slide and jostle side-to-side on the slab instead of launching up and off into the lava
   if(!(me.__rage&&now<me.__rage)){vx+=me.kx;vy+=me.ky;}   // RAGE: shrugs off knockback
   if(kmag>55){sqT=0.11;sqxP=0.91;sqyP=1.09;brf=6;   // and it reacts: squashed, brows up, eyes on the pusher
    if(me.kx){gzx=-Math.sign(me.kx)*0.7;gzy=0;sacAt=now+900;}
    if(kmag>170&&bf===0)bf=5;}
   else if(!air){x+=Math.max(-3,Math.min(3,me.kx*0.03));}   // tiny squeezes just scoot it over
  }me.kx=0;me.ky=0;}
  if(!grabbed&&!perched&&!vaulting&&!elim&&!me.__probeSettled&&!(window.__hmLavaOn&&battleOn&&now<(window.__hmBattleGo||0)))for(var pi=0;pi<peers.length;pi++){var o2=peers[pi];if(o2===me||o2.perched||o2.vault||o2.elim||o2.__bench||o2.__probeSettled)continue;   // a vaulting head sails clean over; the fallen rest in peace -- and pre-whistle in lava, heads hold still on the base (no shoving anyone off before GO). The opt-in browser settle probe likewise holds exact authored geometry instead of resolving unavoidable 320px overlap.
   var dxp=(x+HW/2)-(o2.x+o2.HW/2),dyp=(y+HH*0.55)-(o2.y+o2.HH*0.55);
   var rr2=(HW+o2.HW)*0.40,d2=Math.hypot(dxp,dyp);
   if(d2>0.01&&d2<rr2){var nx2=dxp/d2,ny2=dyp/d2,ov=rr2-d2;
    x+=nx2*ov*0.5;if(air)y+=ny2*ov*0.3;   // squeeze apart: half me, half them (via the mailbox)
    var rvx=vx-o2.vx,rvy=vy-o2.vy,rel=rvx*nx2+rvy*ny2;
    if(rel<0){var _lm=window.__hmLavaOn,_chg=(_lm&&me.__charging&&now<me.__charging)?2.3:1,jI=-(1+(_lm?0.6:0.72))*rel*(_lm?0.46:0.5);   // FLOOR IS LAVA: idle bumps stay soft (no accidental mass wipeouts), but a deliberate CHARGE lands a real knock -> heads actually shove each other toward the pit
     vx+=nx2*jI*(_chg>1?0.45:1);vy+=ny2*jI*(_lm?0.42:0.6);o2.kx-=nx2*jI*(_lm?1.05:1)*_chg;o2.ky-=ny2*jI*(_lm?0.42:0.6)*(_chg>1?1.5:1);
     var hit=Math.abs(rel);
     if(battleOn&&!elim&&o2.inB&&!o2.elim&&(slot||0)<(o2.slot||0)&&now>=(window.__hmBattleGo||0)){   // resolve each pair ONCE (lower slot) so nobody is hit twice, and only after the whistle
      var meApp=-(vx*nx2+vy*ny2),o2App=(o2.vx*nx2+o2.vy*ny2),TH=200;   // each head's closing speed toward the other -- only a real lunge lands
      var _rageMe=(me.__rage&&now<me.__rage),_rageO2=(o2.__rage&&now<o2.__rage);
      if(meApp>TH)o2.dmgIn+=Math.min(_rageMe?30:16,(meApp-TH)/36*(_rageMe?2.1:1));   // I lunged into them -> I deal the blow (RAGE hits far harder)
      if(o2App>TH&&!_rageMe)hurt(Math.min(_rageO2?30:16,(o2App-TH)/36*(_rageO2?2.1:1)));   // they lunged into me -> they deal one (unless I'm raging: immune). both lunge -> both take it
      var _land=Math.max(meApp>TH?meApp-TH:0,o2App>TH?o2App-TH:0);   // IMPACT SPARK at the contact point: a quick ring right where the blow lands -> you can finally SEE who bonked whom
      if(_land>0)impactSpark((x+HW/2+o2.x+o2.HW/2)/2,(y+HH*0.45+o2.y+o2.HH*0.45)/2,_land);}
     if(hit>240){sqT=0.12;sqxP=0.9;sqyP=1.1;brf=6;if(hit>760&&dzf===0)dzf=8;}   // a proper bonk: brows up, maybe stars
     else if(hit>90&&bf===0&&Math.random()<0.35)bf=5;   // a friendly bump earns a blink
     if(hit>150&&Math.random()<0.5){gzx=Math.max(-1,Math.min(1,-nx2*0.75));gzy=-0.1;sacAt=now+900;}}   // and a look at WHO did that
    else{o2.kx-=nx2*ov*60*DT;crowdT+=DT;}}}   // standing squeeze pushes harder, and patience runs out below
  // brushing past the big head startles him — he is behind, not a wall
  if(bigR&&now>surpriseAt&&x+HW>bigR.l&&x<bigR.r&&y+HH>bigR.t&&y<bigR.b){surpriseAt=now+4500;
   try{if(typeof browFlash==="function")browFlash();if(typeof irisDilTarget!=="undefined")irisDilTarget=1.35;}catch(_){}}
  if(grabbed){var cx0=x,cy0=y;x=Math.max(WL,Math.min(WR,x));y=Math.max(CEIL,Math.min(floorY,y));
   var fEl3=document.getElementById("face"),ovh=false;
   if(fEl3){var fr3=fEl3.getBoundingClientRect(),hb3=hero.getBoundingClientRect();
    var ccx=x+HW/2,ccy=y+HH/2;
    ovh=ccx>fr3.left-hb3.left+HW*0.05&&ccx<fr3.right-hb3.left-HW*0.05&&ccy>fr3.top-hb3.top-HH*0.15&&ccy<fr3.bottom-hb3.top-HH*0.2;}
   hmOverT=ovh?hmOverT+DT:0;   // intent is dwell: you have to HOLD it over the head, not brush past
   hsT=ovh?1.12:1;hmOverNow=ovh;
   if(x!==cx0||y!==cy0){if(sqT<=0){sqT=0.1;sqxP=(y!==cy0)?1.16:0.86;sqyP=(y!==cy0)?0.82:1.14;}cTop=(y!==cy0&&y===CEIL);}   // shoved into a wall while held: it squashes against it
   var dsp=Math.min(16,Math.abs(pvy)*1.1+Math.abs(pvx)*0.35);if(sqT<=0){sqyP=1+dsp*0.0038;sqxP=1/(1+dsp*0.0038);}   // dragging sideways should not stretch it TALL
   var hk=DT/0.04;heldV+=((-heldOff*0.16)-(pvy*0.14))*hk;heldV*=Math.pow(0.86,hk);heldOff=Math.max(-18,Math.min(18,heldOff+heldV*hk));}   // it bounces on the hand like a ball on a paddle
  else{heldOff*=Math.pow(0.85,DT/0.04);heldV=0;hsT=1;}
  hs+=(hsT-hs)*Math.min(1,DT*10);
  if(battleOn||soccerOn){depthT=1;depth=1;}   // FLAT during games: no 2.5D depth ever -- every head stays on one plane + one ground line (they bounce off each other, they never pass at different depths)
  depth+=(depthT-depth)*Math.min(1,DT*0.5);
  // squash recovery
  if(sqT>0){sqT-=DT;}else if(!air&&!grabbed){var _br=1+(drowse2?0.015:0.009)*Math.sin(now*(drowse2?0.0026:0.0042));sqyP=_br;sqxP=1/_br;}   // it BREATHES: volume-true, slower and deeper in its sleep
  // sub-step the squash springs so a slow/laggy frame (big DT) can't push explicit-Euler unstable -- that overshoot is what made heads stretch and balloon on the way in
  var _ss=DT>0.02?Math.ceil(DT/0.02):1,_sd=DT/_ss;
  for(var _si2=0;_si2<_ss;_si2++){sqxv+=((sqxP-sqx)*1050-sqxv*52)*_sd;sqx+=sqxv*_sd;sqyv+=((sqyP-sqy)*1050-sqyv*52)*_sd;sqy+=sqyv*_sd;}
  sqx=Math.max(0.7,Math.min(1.32,sqx));sqy=Math.max(0.7,Math.min(1.32,sqy));   // and a hard cap, so even a wild overshoot can never read as a weird stretch/enlarge
  var swing=grabbed?Math.max(-12,Math.min(12,pvx*0.9)):0;pvx*=Math.pow(0.8,DT/0.04);   // body leans with the drag; the face stays calm
  var lean=air&&!grabbed?Math.max(-10,Math.min(10,vx*0.028)):0;   // it leans into the jump, in control, never tumbling
  var breathe=0,rotX=0;
  if(wig){wig.t-=DT;var wp=1-Math.max(0,wig.t)/wig.dur,env=Math.sin(Math.PI*Math.min(1,wp));
   if(wig.type==="shimmy"){wigP+=DT*24;rotX=Math.sin(wigP)*6*env;}
   else if(wig.type==="tilt")rotX=wig.a*env;
   else if(wig.type==="pounce"){wigP+=DT*30;rotX=Math.sin(wigP)*3.5*env;}   // fast, tiny: feet finding their grip
   else if(wig.type==="shake"){wigP+=DT*44;rotX=Math.sin(wigP)*7*env;}      // the whole-body shake-off
   else if(wig.type==="binky"){rotX=Math.sin(wp*6.283)*11*wig.a;}           // one full joyful twist and back
   if(wig.t<=0)wig=null;}
  // ===== THE LOBBY PLANET, integrated inside the frame this head already runs. No new rAF loop:
  // this is a different integration in the same loop, taking the same slot podium/spectate take.
  var _orbLive=ORB.sync(now),_od=0,_ofx=0,_ofy=0;
  if(orbOn&&!_orbLive){orbOn=false;me.orbA=null;root.style.transformOrigin="50% 94%";}   // left the lobby: hand the head straight back to the flat floor, pivot and all
  if(me.podiumRank){   // on the podium: resurrected, frozen, gliding smoothly onto its pedestal
   if(elim){elim=false;me.elim=false;}elimP=0;root.style.display="";shadow.style.display="";root.style.opacity="1";
   if(me.podX!=null){var pk=Math.min(0.14,DT*3.2);x+=((me.podX-HW/2)-x)*pk;y+=((me.podTop-HH*FOOT)-y)*pk;}   // a soft ease, never a zoom
   air=false;vx=0;vy=0;grabbed=false;wig=null;flipA=0;flipV=0;
   if(me.podiumRank===1)crownEl.style.opacity="1";}
  else if(me.spectate){   // ringed around the podium, watching the ceremony
   if(elim){elim=false;me.elim=false;}elimP=0;root.style.display="";shadow.style.display="";root.style.opacity="1";
   if(me.specX!=null){var sk=Math.min(0.14,DT*3.2);x+=((me.specX-HW/2)-x)*sk;y+=(floorY-y)*sk;}
   air=false;vx=0;vy=0;grabbed=false;wig=null;flipA=0;flipV=0;crownEl.style.opacity="0";
   gzx=((heroR.w/2)>(x+HW/2))?0.5:-0.5;gzy=-0.35;}   // eyes up at the winner
  else if(_orbLive){
   var _oR=ORB.R(),_ocx=ORB.cx(),_ocy=ORB.cy(),_oMax=ORB.arcMax(HW,heroR.w);
   if(!orbOn){orbOn=true;   // ARRIVING. Read the angle AND the height straight off where the head already
    // stands, rather than forcing it onto the surface. The crowd keeps the spread it already had
    // instead of teleporting into a pile, and because the height is real, gravity does the rest --
    // they FALL onto the planet and land with the same squash as any other landing. Snapping here was
    // one frame of a head at the wrong radius and the wrong tilt, which is exactly the frame a viewer
    // notices, and it is also what left a head that entered late sitting 300px off the surface.
    var _ax=x+HW/2-_ocx,_ay2=y+HH*FOOT-_ocy,_ah=Math.hypot(_ax,_ay2)||1;
    orbA=Math.atan2(_ax,-_ay2);
    orbH=Math.max(0,_ah-_oR);orbVH=0;orbAV=0;orbGoal=Math.max(-0.6,Math.min(0.6,orbA));orbNext=now+300+Math.random()*1400;
    root.style.transformOrigin="50% "+(FOOT*100).toFixed(2)+"%";}   // pivot on THIS head's own scanned foot line, so the feet stay planted through any lean -- the same trick the reflection uses, and the reason mini-Jayden does not sink into the planet
   var _odt=Math.min(0.05,DT);   // clamp the step the way the ball loop does: a single long frame (a
   // backgrounded tab, a GC pause) integrated raw would throw a mid-hop head hundreds of px off the
   // surface before gravity could answer, and it only takes one to break the illusion for everyone.
   if(grabbed){   // picked up OFF the planet: read the angle and the height back off the drag, so letting go drops it along the normal from wherever it is
    var _gx=x+HW/2-_ocx,_gy=y+HH*FOOT-_ocy,_gd=Math.hypot(_gx,_gy)||1;
    orbA=Math.atan2(_gx,-_gy);orbH=Math.max(0,_gd-_oR);orbVH=0;orbAV=0;}
   else{
    // GRAVITY POINTS AT THE PLANET'S CENTRE. The hop is one integration along the surface normal --
    // rise, fall back to it -- and it does not touch the angular speed, which is what makes a hop
    // arc ALONG the surface instead of stopping dead above it.
    orbVH-=2600*_odt;orbH+=orbVH*_odt;   // orbVH is the RADIAL speed, positive outward, so gravity subtracts: it pulls toward the planet's centre, which is the whole point. Same g the flat floor uses, so a hop feels like the hops everywhere else.
    if(orbH<=0){if(orbVH<-140&&sqT<=0){sqT=0.12;sqyP=0.88;sqxP=1/0.88;}orbH=0;orbVH=0;}   // and it lands with the same squash
    if(now>=orbNext){   // the decide() rhythm the flat floor already has, on a curved one: mostly wander, sometimes hop
     orbNext=now+900+Math.random()*2600;
     if(Math.random()<0.34&&orbH<=0){orbVH=300+Math.random()*220;if(sqT<=0){sqT=0.1;sqyP=1.1;sqxP=1/1.1;}}   // a hop is a push OUTWARD along the normal; the windup crouch is kept
     else orbGoal=(Math.random()*2-1)*_oMax;}
    var _dA=orbGoal-orbA,_want=(Math.abs(_dA)<0.02)?0:Math.max(-1,Math.min(1,_dA*3.4))*(150/_oR);   // 150px/s ALONG THE SURFACE, converted to an angular rate -- so a small planet is not walked across in a stride
    orbAV+=(_want-orbAV)*Math.min(1,_odt*(orbH>0?1.2:7));   // mid-hop it barely steers: momentum carries it
    orbA+=orbAV*_odt;
    if(orbA>_oMax){orbA=_oMax;orbAV=0;orbGoal=-Math.random()*_oMax;}   // bounded arc: it reaches the edge of the lit face and turns round
    if(orbA<-_oMax){orbA=-_oMax;orbAV=0;orbGoal=Math.random()*_oMax;}
    // Shoulder room measured along the ARC, not in x. Two heads at the same angle are touching
    // whatever their screen distance is, and near the limb the screen distance lies.
    var _sep=(HW*0.82)/_oR;
    for(var _pi=0;_pi<peers.length;_pi++){var _o=peers[_pi];
     if(_o===me||_o.orbA==null)continue;
     var _d2=orbA-_o.orbA;
     if(Math.abs(_d2)<_sep&&Math.abs(orbH-(_o.orbH||0))<HH*0.7){orbA+=(_sep-Math.abs(_d2))*0.25*(_d2<0?-1:1);
      if(orbA>_oMax)orbA=_oMax;else if(orbA<-_oMax)orbA=-_oMax;}}}
   me.orbA=orbA;me.orbH=orbH;
   var _rr=_oR+orbH;_ofx=_ocx+_rr*Math.sin(orbA);_ofy=_ocy-_rr*Math.cos(orbA);
   x=_ofx-HW/2;y=_ofy-HH*FOOT;   // it is the head's FOOT POINT that sits on the sphere, never the box
   _od=orbA*57.2958;   // ORIENTATION FOLLOWS THE NORMAL: feet toward the centre, all the way round
   air=orbH>2;vx=0;vy=0;flipA=0;flipV=0;
   if(orbAV>0.02)dir=1;else if(orbAV<-0.02)dir=-1;}
  /* ===== THE RACE MAILBOX, READ WHERE EVERY OTHER POSITIONAL OVERRIDE IS READ =====
     This block used to sit ~100 lines BELOW the transform write, which meant the paint
     ran on LAST frame's race position after this frame's free-fall integration had
     already moved it: `x+=vx*DT; y+=vy*DT` and then the ceiling clamp. Measured over one
     twelve-head race at 1440x900, worst case not median: the drawn head was 66px out
     horizontally, and 159px out vertically -- a head swatted above the top of the course
     window had its y clamped to CEIL and sat GLUED to the top edge while the simulation
     had it well off-screen. Only 28% of frames were inside 2px; 6% were more than 40px
     out. Reported as "heads are pushed to spots that they arent actually at", and it is
     exactly that: the drawing and the simulation were a frame and a gravity step apart.
     Read here -- beside podium, spectate and the lobby planet, the three other things
     that own a head's position -- and the transform below is written from the mailbox
     itself. race-fidelity-contract.py asserts the translation equals the mailbox.

     IT ALSO RESETS THE SPIN. flipA/flipV are a somersault in flight, and NOTHING used to
     clear them at the drop: a head that was mid-flip when the grid formed (the lobby
     hops flip, and the tumble home at the END of a race flips 40% of the field) kept
     integrating `flipA+=flipV*DT` all the way down the course, because the race sets
     air=true. That is the "pre fired spinning from some of the players" -- and it starts
     during the 3-2-1, before the race has even dropped. Same family as the wig, the
     banana spin and the disco stun, so all five are cleared here rather than one. */
  if(window.__hmRaceOn&&me.raceX!=null){x=me.raceX;y=me.raceY;if(!me.raceHide&&root.style.opacity==="0"){root.style.opacity="1";shown=true;}if(Math.abs(me.raceVX||0)>40)dir=(me.raceVX>=0)?1:-1;air=true;st="fall";vx=me.raceVX||0;vy=0;me.__inRace=true;grabbed=false;perched=false;
   flipA=0;flipV=0;wig=null;rotX=0;breathe=0;me.__spin=0;me.__disco=0;depthT=1;depth=1;   // one plane, no leftover rotation: every racer meets the grid in the same pose
     /* NO CONTACT SHADOW IN THE RACE. A head casts one because it is STANDING on
        something -- that is the whole reason this site allows the single shadow it
        allows. A racer is in free fall down a plinko board, touching nothing, and
        the ellipse was riding along underneath it as though a floor came too. It
        is restored the moment the racer re-enters the lobby, where the head is on
        the ground again and the shadow is information rather than decoration. */
     if(shadow&&shadow.style.opacity!=="0")shadow.style.opacity="0";
     if(refl&&refl.style.opacity!=="0")refl.style.opacity="0";
   lean=Math.max(-10,Math.min(10,(me.raceVX||0)*0.028));   // the ride's own lean, off THIS frame's mailbox rather than last frame's
   gzx=Math.max(-0.8,Math.min(0.8,(me.raceVX||0)/700));gzy=Math.max(-0.5,Math.min(0.6,(me.raceVY||0)/900));   // eyes track the ride: leaning into the turns, watching the drop
   if(me.raceHit&&now-me.raceHit<420){brf=Math.max(brf,5);if(now-me.raceHit<160){sqT=Math.max(sqT,0.1);sqyP=1.1;sqxP=1/1.1;}}   // a hard peg or paddle knock startles: brows pop + a little jolt-squash
   if(me.raceWin&&crownEl&&crownEl.style.opacity!=="1")crownEl.style.opacity="1";   // the WINNER is crowned the instant the line is crossed
   if(me.raceHide&&!me.__rHid){me.__rHid=true;root.style.transition="opacity var(--dur-state-out,240ms) cubic-bezier(.22,1,.36,1)";root.style.opacity="0";if(shadow)shadow.style.opacity="0";}
   else if(!me.raceHide&&me.__rHid){me.__rHid=false;root.style.opacity="1";if(shadow)shadow.style.opacity="1";}}
  else if(me.__inRace&&!window.__hmRaceOn){me.__inRace=false;me.raceX=null;/* BACK ON THE GROUND, SO THE SHADOW COMES BACK. Unconditional, not gated on
        __rHid: the race suppresses the shadow and the reflection on EVERY frame
        for every racer, while __rHid only tracks the ones the race chose to hide.
        Restoring inside that gate is how a head walks back into the lobby with no
        shadow and a reflection stuck at zero -- stranded reflections have been a
        real bug on this page before. */
     if(shadow)shadow.style.opacity="1";if(refl)refl.style.opacity="1";surface=floorY;air=true;st="fall";vy=-(240+Math.random()*220);vx=(Math.random()*300-150);if(Math.random()<0.4)startFlip();
   y=Math.max(y,-HH);x=Math.max(WL,Math.min(WR,x));   // wherever the race left you, you re-enter from just above the frame -- never from deep space
   if(me.__rHid){me.__rHid=false;root.style.opacity="1";if(shadow)shadow.style.opacity="1";}
   root.style.transition="";
   if(me.raceWin){me.raceWin=false;smileT=Math.max(smileT||0,2.6);(function(ce){setTimeout(function(){try{ce.style.opacity="0";}catch(_){}},4600);})(crownEl);}}   // the champion tumbles home grinning, wears the crown a few beats more, then it fades
  var _spinR=(me.__spin&&now<me.__spin)?((now*0.75)%360):0;   // BANANA: slips into a dizzy spin
  var _discoR=(me.__disco&&now<me.__disco)?Math.sin(now*0.018)*16:0;   // DISCO STUN: forced to bust a move
  // THE PLANET, at render time only. arcY is the drop below the apex under THIS head's centre and
  // arcDeg is the surface normal there; surfRot was already a sum of six terms, so the tilt is
  // literally one more addend, and because rot=surfRot+flipA the eye rig keeps counter-rotating so
  // the glint's light source stays level. soccerOn gates it -- "so just on the pitch" -- and with
  // SAG=0 both terms are 0.0 and every string below is character-for-character the old one.
  var _acx=x+HW/2,_ay=soccerOn?ARC.y(_acx):0,_ad=soccerOn?ARC.deg(_acx):0;
  var surfRot=(flipA?0:lean+(grabbed?swing:0))+rotX+(drowse2?2.2:0)+_spinR+_discoR+_ad+_od;   // leans and wiggles rock on the FEET -- and on the lobby planet _od is the surface normal, which is the same sum taking one more addend
  var rot=surfRot+flipA;   // total visible rotation (the eyes need it below)
  var c2=HH*0.44;   // feet-origin to body-centre: flips spin about the centre via an explicit sandwich — two pivots, one transform, zero jumps
  var _shk=(battleOn||soccerOn)?window.__hmShake:null,_shx=_shk?_shk.x:0,_shy=_shk?_shk.y:0;   // screen shake: read the shared decaying offset (only during a game)
  var _rx=x+_shx,_ry=y+breathe+(grabbed?heldOff:0)+_shy+_ay,_rsx=depth*hs*sqx*(1-0.6*elimP),_rsy=depth*hs*sqy*(1-0.6*elimP);   // the exact numbers written to root, held so the reflection can mirror THEM and not a recomputed guess
  root.style.transform="translate("+_rx.toFixed(1)+"px,"+_ry.toFixed(1)+"px)"
   +(flipA?" translate(0px,"+(-c2).toFixed(1)+"px) rotate("+flipA.toFixed(1)+"deg) translate(0px,"+c2.toFixed(1)+"px)":"")
   +" rotate("+surfRot.toFixed(1)+"deg) scale("+_rsx.toFixed(3)+","+_rsy.toFixed(3)+")";
  if(elimP>0&&elimP<1){root.style.opacity=(1-elimP).toFixed(2);shadow.style.opacity=(0.4*(1-elimP)).toFixed(2);}
  if(bigR&&root.style.zIndex==="1"){var _cxb=x+HW/2;if(_cxb>bigR.l-HW*0.35&&_cxb<bigR.r+HW*0.35&&(y+HH*0.55)<bigR.b)root.style.zIndex="3";}   // never let a hidden (back-plane) head slip BEHIND the big head -- if it drifts over his face, pop it back to the front plane
  // the shadow falls on whatever is DIRECTLY below the head right now -- a platform if it's over one, else the floor -- so it never snaps when leaving a slab
  var feetY=y+HH*FOOT,shG=floorY+HH*FOOT,cxs=x+HW/2;
  if(battleOn&&battlePlats.length){for(var si=0;si<battlePlats.length;si++){var SP=battlePlats[si];if(cxs>SP.l&&cxs<SP.r&&SP.t>=feetY-3&&SP.t<shG)shG=SP.t;}}
  var airH=Math.max(0,shG-feetY);
  // HOW FAR OFF THE GROUND THIS HEAD IS -- computed ONCE. The contact shadow and the reflection are
  // two readings of this one fact, so they are driven by these two numbers and never by two curves
  // of their own. If the shadow says 40% and the reflection says 80%, one of them is lying.
  var shScale=Math.max(0.32,depth*(1-airH/(heroR.h*0.6)));   // the size reading
  var shOp=(window.__hmLavaOn||me.__sinking)?0:((shown&&!perched)?(airH<4?0.36:Math.max(0.1,0.3-airH/800)):0);   // the strength reading. Lifted out of the string it used to live in, VALUE FOR VALUE -- the shadow's own law is unchanged, it is just readable now. No cast shadows in lava mode (a shadow on the lava reads as "standing on it").
  if(_orbLive){   // ON THE PLANET the contact shadow is not on a floor line at all: it is the patch of
   // ground the head is standing on, so it sits at the contact point and tilts with the surface. Same
   // ellipse, same ink, same "it shrinks as you rise" law -- just measured along the normal (orbH)
   // instead of down the screen, because down the screen is not where this planet's gravity points.
   shScale=Math.max(0.34,1-orbH/240);
   shOp=(shown&&!perched)?(orbH<4?0.36:Math.max(0.1,0.3-orbH/800)):0;
   shadow.style.transform="translate("+(_ofx-HW/2).toFixed(1)+"px,"+(_ofy-HW*0.11).toFixed(1)+"px) rotate("+_od.toFixed(1)+"deg) scale("+shScale.toFixed(3)+",1)";
  }else shadow.style.transform="translate("+(x+HW/2-HW/2*shScale+HW*0.06).toFixed(1)+"px,"+(shG-2+_ay).toFixed(1)+"px) scale("+shScale.toFixed(3)+",1)";
  /* THE RACE HAS NO FLOOR, SO shOp IS NOT THE LAST WORD. The suppression up in the
     race branch set this to 0 and THIS line, further down the same frame, wrote it
     straight back every time -- the same ordering bug that had the race mailbox
     being read after the transform had already been written. A racer is in free
     fall down a plinko board, touching nothing. The contact shadow exists on this
     site precisely because a head is STANDING on something, so during a race there
     is nothing for it to be information about. */
  shadow.style.opacity=(window.__hmRaceOn&&me.raceX!=null)?"0":String(shOp);
  // THE REFLECTION. A jump is the test case that exposes all of it, because it is the one moment the
  // head stops touching the ground. Six claims, each of which has to hold on its own:
  //
  // 1. IT MEETS THE WATERLINE AT THE FEET, NOT AT THE BOX. The pivot is written to this head's OWN
  //    scanned foot line (FOOT, from its own pixels -- 0.945 for an egghead, 0.75 for mini-Jayden,
  //    whose cut is baked into a 5:6 frame). With transform-origin sitting exactly on that line the
  //    y term is _wY - HH*FOOT, and the anchor is exact whatever the rotation or the squash, because
  //    every one of them acts about that same point. Anchoring on the BOX instead hung mini-Jayden's
  //    reflection 4.4px below everyone else's on the same water; on the CENTRE, 32.4px.
  // 2. WHEN THE HEAD JUMPS, THE REFLECTION STAYS ON THE WATER AND THE GAP OPENS. It is anchored to
  //    the waterline, so as the feet climb, the distance between head and reflection is exactly the
  //    head's height off the ground -- which is what a gap between an object and a surface looks
  //    like. A reflection that rose with the head would read as a sticker.
  // 3. IT SHRINKS AND WEAKENS WITH HEIGHT, OFF THE SHADOW'S OWN NUMBERS. Not a second curve: the
  //    literal shScale and shOp computed above for the contact shadow. The shadow flattens in x, the
  //    reflection foreshortens in y, and both fade -- one fact, two readings, incapable of
  //    disagreeing. Only two constants separate them, REFL_K and REFL_PERSP, and neither varies.
  // 4. THE CONTACT SHADOW IS NOT TOUCHED. It is the one shadow this site keeps, because the heads
  //    stand on something. The reflection is added underneath it, never in place of it, and the
  //    shadow's law above is the same law it always had -- only lifted out of a string.
  // 5. THE SQUASH RIDES ALONG, ROTATION OR NOT. The transform list below is literally
  //    S(1,-1) o R(rot) o Sc(sx,sy) -- the mirror operator applied to the head's own rotate-then-
  //    scale. It is not an approximation that happens to work at small angles; it is the same two
  //    factors the head uses with a flip in front, so it holds at any angle and any squash.
  // 6. IT LEANS THE OTHER WAY, INCLUDING MID-FLIP. scale(1,-1) BEFORE rotate() is what does it:
  //    S(1,-1) o R(a) == R(-a) o S(1,-1), so reusing the head's own angle in this order already
  //    tilts the reflection opposite, with no sign juggling. `rot` is used, not `surfRot`, so a head
  //    mid-flip -- where the angle is large enough for an error to be obvious -- reflects its WHOLE
  //    visible rotation. This is the reason this is a transform and not -webkit-box-reflect, which
  //    mirrors about the element's local bottom edge and so leans a +8deg head +8deg instead of -8.
  //
  // The one deliberate departure from a true mirror is claim 2's anchor. A real mirror image of a
  // head h px above the surface sits h px BELOW the waterline and detaches downward; measured, that
  // is 59px on a routine hop and ~200px on a scramble pop, which walks it straight out of a 340px
  // water band and onto the page -- the "un-attaching" failure the 2D-water literature names. So the
  // gap opens above the water rather than below it, and the shadow's falloff carries the height cue.
  //
  // The waterline is the feet plane every head shares, so every reflection lands on ONE line for
  // free, whatever the head's size -- which is what keeping the physics flat bought.
  // THE SAME SIX CLAIMS NOW HOLD IN THE LOBBY, which is the whole reason this is a gate change and
  // not a second implementation. Everything above -- the waterline anchor, the gap that opens when a
  // head jumps, the shrink-and-weaken off the contact shadow's own shScale/shOp, the mirror operator
  // applied to the head's own rotate-then-scale -- is surface-agnostic. It was only ever describing
  // "a head standing on a reflective plane", and the lobby floor is one. So a jumping head in the
  // lobby detaches from its reflection by exactly its height off the ground, and a head lying at rest
  // meets its own image at its feet: the two failures Jayden named when he said the reflections
  // "aren't real" cannot occur here either, because the numbers are literally the same numbers.
  // What DOES change is the material, and that is play.css's business, not this file's: water ripples
  // and breaks the image up, a polished floor does not. See `body.pHubOn .hmRefl` there.
  // ...WITH ONE EXPLICIT EXCLUSION: !_orbLive. The contact shadow above has a spherical branch --
  // on the planet it sits at the contact point and tilts with the surface normal, measured along
  // orbH -- and the reflection below has NO such branch: _wY is floorY+HH*FOOT, a FLAT feet line.
  // The two would therefore disagree the moment the planet is switched on, and disagree in the
  // worst possible way: right at rest and wrong for every head with any height, which is an
  // intermittent fault that looks like a rendering glitch rather than a missing case.
  // A sphere has no single waterline, so this is a real piece of design (where does a reflection
  // live on a curved surface?) and not a line of arithmetic. Until it is done, a head standing on
  // the planet gets NO reflection rather than a wrong one -- the planet is postponed anyway
  // (play.html ships no [data-hm-orb], so _orbLive is false and this costs nothing today), and
  // this guard is what stops the two features silently breaking each other when it comes back.
  if((soccerOn||LOBBY(now))&&!elim&&!_orbLive&&!window.__hmLavaOn){
   if(_reflFoot!==FOOT){_reflFoot=FOOT;refl.style.transformOrigin="50% "+(FOOT*100).toFixed(2)+"%";}   // FOOT arrives from an image onload, so it can change once after spawn
   var _wY=floorY+HH*FOOT+_ay;   // the FEET plane itself, not the shadow's drawn top edge -- the shadow is nudged 2px up so its ellipse sits under the chin, and inheriting that nudge would have floated every reflection 2px off the water
   refl.style.transform="translate("+_rx.toFixed(1)+"px,"+(_wY-HH*FOOT).toFixed(1)+"px) scale(1,-1) rotate("+rot.toFixed(1)+"deg) scale("+_rsx.toFixed(3)+","+(_rsy*shScale*REFL_PERSP).toFixed(3)+")";
   /* The reflection is the shadow's mirror and leaves with it. shOp is still being
      computed here for a floor the race does not have. */
   refl.style.opacity=(window.__hmRaceOn&&me.raceX!=null)?"0":(shOp*REFL_K).toFixed(3);
  }else if(refl.style.opacity!=="0")refl.style.opacity="0";   // off the pitch this is one string compare per head per frame and nothing else
  if(crowdT>0.65&&!air&&!grabbed&&!perched){crowdT=0;   // squeezed too long: it hops out of the scrum
   air=true;st="fall";surface=floorY;dir=Math.random()<0.5?-1:1;
   vy=-(340+Math.random()*140);vx=dir*(180+Math.random()*120);sqT=0.11;sqyP=1.09;sqxP=1/1.09;}
  else if(crowdT>0)crowdT=Math.max(0,crowdT-DT*0.6);
  if(battleOn&&window.__hmLavaOn&&!air&&!grabbed&&!perched&&!me.__sinking&&!me.podiumRank&&!me.spectate){   // no floor in lava -- a grounded head nudged off its slab must actually FALL, never hang floating in the air
   var _fy2=y+HH*FOOT,_sup2=false;
   for(var _su=0;_su<battlePlats.length;_su++){var _PS=battlePlats[_su];if(_PS.t>=window.__hmLavaY((_PS.l+_PS.r)/2)-2)continue;   // a submerged slab can't hold you
    if((x+HW/2)>_PS.l-2&&(x+HW/2)<_PS.r+2&&Math.abs(_fy2-_PS.t)<7){_sup2=true;break;}}
   if(!_sup2){air=true;st="fall";if(vy<0)vy=0;}}
  if(!isFinite(x)||!isFinite(vx)||!isFinite(y)||!isFinite(vy)){   // NaN KILLSWITCH: one poisoned frame disabled every clamp and sent whole rounds into burning freefall -- self-heal on the spot and log the scene so the emitting path can be named
   try{(window.__wdgN=window.__wdgN||[]).push({t:Math.round(now/1000),slot:slot,x:x,y:y,vx:vx,vy:vy,st:st,aimX:(typeof aimX!=="undefined"?aimX:"?"),batt:!!battleOn});}catch(_){}
   var _hw9=(heroR&&heroR.w)||innerWidth||800;
   x=isFinite(x)?x:_hw9*0.5-HW/2;y=(isFinite(y)&&y<floorY+200)?y:Math.min(floorY,140);vx=0;vy=0;aimX=null;air=true;st="fall";surface=floorY;}
  if(battleOn&&!me.__sinking&&y<-HH*0.6){y=-HH*0.6;if(vy<0)vy=0;}   // the arena has a CEILING: no head ever sails off the top of the map in the scramble
  if(battleOn&&window.__hmLavaOn&&!me.__sinking&&!elim){   // WEDGE WATCHDOG: the soak caught a head frozen 58s in a pocket -- 6s without moving forces a recovery leap, a second strike drops him clean out of the wedge
   if(me.__swT==null||Math.hypot(x-(me.__swX||0),y-(me.__swY||0))>12){me.__swX=x;me.__swY=y;me.__swT=now;}
   else if(now-me.__swT>6000){me.__swT=now;me.__swN=(me.__swN||0)+1;
    try{(window.__wdg=window.__wdg||[]).push({t:Math.round(now/1000),slot:slot,x:Math.round(x),y:Math.round(y),air:air,grab:!!grabbed,st:st,inB:!!me.inB,hp:Math.round(hp)});}catch(_){}
    dir=((x+HW/2)>heroR.w/2)?-1:1;surface=floorY;st="fall";air=true;grabbed=false;perched=false;
    vy=-(820+Math.random()*160);vx=dir*(260+Math.random()*180);aimX=null;brf=6;sqT=0.13;sqyP=1.14;sqxP=1/1.14;
    if(me.__swN>=2){me.__swN=0;y+=HH*0.45;}}}
  else{me.__swT=null;me.__swN=0;}
  var _gWL=WL,_gWR=WR;if(battleOn){var _hbl=(heroBox&&heroBox.left)||0;_gWL=Math.max(WL,(innerWidth>640?104:6)+2-_hbl);_gWR=Math.min(WR,innerWidth-_hbl-HW-2);}   // in the LAVA CLIMB the walls are the VIEWPORT edges -- the whole screen is the arena, and climbers stay fully on it, never half-buried "in the glass" like the idle hero allows. Soccer keeps its own full-viewport pitch (goals live at the screen edges).
  if(x<_gWL){x=_gWL;if(battleOn&&Math.abs(vx)>60)vx=Math.abs(vx)*0.6;}if(x>_gWR){x=_gWR;if(battleOn&&Math.abs(vx)>60)vx=-Math.abs(vx)*0.6;}   // and in lava they BOUNCE off, so a wall shove reads as a save, not a pin
  if(!air&&!grabbed&&!perched&&!window.__hmLavaOn&&y>floorY)y=floorY;   // the walls hold, ALWAYS: no head ever leaves the screen (but in lava there's no floor to snap to)
  if(battleOn&&window.__hmLavaOn){var _bsY=(window.__hmLavaY?window.__hmLavaY(x+HW/2):floorY)+HH*1.6;
   if(y>_bsY){y=_bsY;if(vy>0)vy=0;}}   // ABSOLUTE BACKSTOP. The crust clamp above lives behind six conditions (!__sinking && !elim && !grabbed && !podiumRank && ...), so an eliminated or grabbed head lost its floor entirely and fell forever -- observed at y=22485 with vy pinned at terminal 1800. This one applies in every state; 1.6*HH leaves the sink animation room to read while the lava occludes it.
  // REACTIVE FACES: the closer the lava, the more scared they look -- brows up, eyes down at the rising death, a nervous shrink
  if(battleOn&&window.__hmLavaOn&&!me.__sinking&&!elim&&!me.podiumRank){var _ld=window.__hmLavaY(x+HW/2)-(y+HH*FOOT);
   if(_ld<145){if(now>=(me.__reactAt||0)){me.__reactAt=now+460+Math.random()*380;if(brf===0)brf=6;gzy=0.42+Math.random()*0.28;gzx=(Math.random()*0.5-0.25);sacAt=now+560;if(!air&&Math.random()<0.35){sqT=0.1;sqyP=0.95;sqxP=1/0.95;}}}
   else if(_ld<300&&now>=(me.__reactAt||0)&&Math.random()<0.25){me.__reactAt=now+900;gzy=0.32;gzx=(Math.random()*0.4-0.2);sacAt=now+700;}}   // wary glances down at what's coming
  // EMERGENT ALLIANCES + BETRAYAL: fleeting pacts and grudges that shift -> teaming, then someone turns. All random, all impactful.
  if(battleOn&&window.__hmLavaOn&&!me.__sinking&&!elim&&!me.podiumRank&&now>=(me.__socialAt||0)){me.__socialAt=now+3200+Math.random()*5200;
   var _oth=[];for(var _so=0;_so<peers.length;_so++){var _op=peers[_so];if(_op!==me&&_op.inB&&!_op.elim&&!_op.__sinking)_oth.push(_op);}
   if(_oth.length>=2){var _sr=Math.random();
    var _lts=window.__hmLavaTeams?window.__hmTeamSel:null,_myT=_lts?(_lts[me.slot]||0):0;   // FIXED TEAMS bias the pacts + grudges toward your real side
    var _mates=[],_foes=[];if(_lts&&_myT){for(var _mi=0;_mi<_oth.length;_mi++){((_lts[_oth[_mi].slot]||0)===_myT?_mates:_foes).push(_oth[_mi]);}}
    var _allyIsMate=me.__ally&&_lts&&_myT&&(_lts[me.__ally.t.slot]||0)===_myT,_betray=_allyIsMate?0.06:0.32;   // you rarely knife a real teammate; free-agent pacts still shatter
    if(me.__ally&&now<me.__ally.until&&Math.random()<_betray){me.__grudge={t:me.__ally.t,until:now+3500+Math.random()*4000};me.__ally=null;gzx=(((me.__grudge.t.x+me.__grudge.t.HW/2)>x)?0.9:-0.9);brf=6;sacAt=now+700;}   // BETRAYAL: turn on your ally with a look
    else if(_sr<0.3){var _gp=(_lts&&_myT&&_foes.length)?_foes:_oth;me.__grudge={t:_gp[(Math.random()*_gp.length)|0],until:now+3500+Math.random()*4500};}   // a nemesis (an enemy when sides are set)
    else if(_sr<0.6){var _ap=(_lts&&_myT&&_mates.length)?_mates:_oth;me.__ally={t:_ap[(Math.random()*_ap.length)|0],until:now+4200+Math.random()*5200};me.__grudge=null;}   // a pact (a teammate when sides are set)
    else{me.__grudge=null;me.__ally=null;}}}   // free agent
  if(battleOn&&window.__hmLavaOn&&!me.__sinking&&!elim&&!grabbed&&!me.podiumRank&&now>=(window.__hmBattleGo||0)){var _lavaY=window.__hmLavaY(x+HW/2);
   if(y+HH*FOOT>=_lavaY-1){var _alive=0;for(var _av=0;_av<peers.length;_av++){if(peers[_av].inB&&!peers[_av].elim&&!peers[_av].__sinking)_alive++;}
    y=Math.min(y,_lavaY-HH*FOOT-2);   // ALWAYS clamp to the crust first: nothing ever sinks through the pool and out the bottom of the screen
    var _safeYet=(now<(window.__hmBattleGo||0)+4200);   // nobody burns off the whistle -- there's a real beat to spread out and get knocked in first
    if(_alive<=1||_safeYet){vy=-(760+Math.random()*220);vx=(Math.random()*220-110);air=true;st="fall";surface=floorY;sqT=0.12;sqyP=1.14;sqxP=1/1.14;brf=6;gzy=-0.6;
     if(!_safeYet)hurtT=Math.max(hurtT,0.3);}   // the SOLE SURVIVOR never drowns either: bounced clear even if it fell in airborne
    else if(now>=(me.__burnAt||0)){me.__burnAt=now+1250;   // one dip = ONE burn (mercy window), so a head skimming the crust isn't shredded in a single frame
     hp=Math.max(0,hp-(20+Math.random()*8));   // ~4-5 dips to burn through: every head gets knocked in, scrambles out seared, and it stays ANYONE'S game deep into the round
     if(hp<=0&&now>=(window.__hmSinkBusy||0)){window.__hmSinkBusy=now+2600+Math.random()*1200;startSink(_lavaY);}   // burnt through -> THIS is the elimination, and still one at a time so each death lands on its own
     else{var _rB=null,_rD=1e9;for(var _rb=0;_rb<battlePlats.length;_rb++){var _RB=battlePlats[_rb];if(_RB.t>=_lavaY-14)continue;var _rc=(_RB.l+_RB.r)/2,_rdd=Math.abs(_rc-(x+HW/2))+Math.max(0,(y-_RB.t))*0.3;if(_rdd<_rD){_rD=_rdd;_rB=_RB;}}
      if(_rB){var _need=(y+HH*FOOT)-(_RBt(_rB))+70,_rvy=Math.min(1500,Math.sqrt(2*G*Math.max(220,_need)));vy=-_rvy;aimX=(_rB.l+_rB.r)/2;var _tt2=2*_rvy/G;vx=Math.max(-560,Math.min(560,(aimX-(x+HW/2))/Math.max(0.3,_tt2)));dir=vx>=0?1:-1;}
      else{vy=-(900+Math.random()*220);vx=(Math.random()*300-150);}   // the SCALD is a RESCUE: high enough to actually REACH the nearest rung, steered onto it -- heads boiling helplessly at the surface was the lamest picture this mode could produce
      air=true;st="fall";surface=floorY;sqT=0.14;sqyP=1.2;sqxP=1/1.2;brf=6;gzy=-0.6;
      mjHurtUntil=now+700;hurtT=Math.max(hurtT,0.5);   // SCALDED: it kicks off the crust yelping and seared, health down but still in the fight
      try{if(FX)FX.burst(x+HW/2,_lavaY,{count:12,color:"255,150,50",speed:400,gravity:900,life:0.5,size:5,dir:-1.57,spread:0.7});}catch(_){}   // the scald reads from the kick + sparks alone -- a full-screen flash on every graze was way too loud
      if(Math.random()<0.5)startFlip();}}
    else{vy=-(520+Math.random()*220);vx=(Math.random()*260-130);air=true;st="fall";surface=floorY;sqT=0.12;sqyP=1.15;sqxP=1/1.15;gzy=-0.6;}}}   // still inside the mercy window from the last burn -> kicked clear without extra damage
  me.x=x;me.y=y;me.vx=vx;me.vy=vy;me.HW=HW;me.HH=HH;me.ground=(!air&&!grabbed&&!perched&&st!=="grab");me.perched=perched;me.vault=vaulting;me.inB=battleOn;me.elim=elim;
  if(battleOn||soccerOn)window.__hmCrowd=peers.length;   // how big the crowd is -> small games mingle harder + the lava rises faster so it never looks static
  if(battleOn&&!filler)window.__hmGroundY=floorY+HH*FOOT;   // share the ground row so bombs/props rest on the real floor
  if(me.__buff){if(now>=me.__buff.until){try{if(me.__buff.end)me.__buff.end(A);}catch(_){}me.__buff=null;}else{try{if(me.__buff.tick)me.__buff.tick(A,DT);}catch(_){}}}   // run any active self-buff ability (rocket, etc.)
  if(me.__aura&&now<me.__aura.until){auraEl.style.background="radial-gradient(circle,rgba("+me.__aura.color+",.5) 0%,rgba("+me.__aura.color+",.22) 42%,rgba("+me.__aura.color+",0) 70%)";auraEl.style.opacity=(0.55+Math.sin(now*0.011)*0.28).toFixed(2);}   // the buff HALO pulses in the ability's colour -> you can see who's powered up
  else if(auraEl.style.opacity!=="0"&&auraEl.style.opacity!==""){auraEl.style.opacity="0";}
  facc+=DT;var fstep=false;if(facc>=0.125){facc-=0.125;fstep=true;}
  if(fstep){ // --- face life: stop-motion beats stay on the 8fps grid ---
  var px=(typeof pointer!=="undefined"?pointer.px:innerWidth/2),py=(typeof pointer!=="undefined"?pointer.py:innerHeight*0.4);
  var _scx=heroBox.left+x+HW/2,_scy=heroBox.top+y+HH/2;   // screen centre from the SHARED cached hero rect + this head's own known position -- no per-head getBoundingClientRect, so no forced reflow on the 8fps face beat
  var dcur=Math.hypot(px-_scx,py-_scy);
  var act=(typeof lastMove!=="undefined")&&(now-lastMove<2500)&&dcur<190&&!soccerOn&&!battleOn;   // the cursor only matters up close -- and never during a game (no stray greeting/drowse hops fighting the game AI)
  if(!drowse2&&now-lastNearT>45000&&st==="idle"&&!perched&&!grabbed&&!air)drowse2=true;   // left alone long enough, it gets sleepy
  if(drowse2&&act){drowse2=false;brf=6;   // and startles sweetly awake when you come back
   if(!air&&!grabbed&&!perched){air=true;st="fall";surface=floorY;vy=-(240+Math.random()*70);vx=0;sqT=0.12;sqyP=1.1;sqxP=1/1.1;}}
  else if(act&&now-lastNearT>15000&&now>greetAt){greetAt=now+4000;   // the greeting bounce: absence, then recognition
   if(!air&&!grabbed&&!perched&&st==="idle"){brf=6;bounceN=1;air=true;st="fall";surface=floorY;vy=-(300+Math.random()*90);vx=0;sqT=0.12;sqyP=1.1;sqxP=1/1.1;}}
  if(act)lastNearT=now;
  var nx,ny;
  if(grabbed){nx=0.14;ny=0.1;}   // held: eyes quietly to one side, never panicked
  else if(perched&&moodB){nx=0;ny=0.9;}   // front-row seat: watching the show below
  else if(moodB&&bigR){nx=((bigR.l+bigR.r)/2>(x+HW/2))?0.6:-0.6;ny=-0.6;}   // the audience watches HIM
  else if(act){nx=Math.max(-1,Math.min(1,(px-(heroBox.left+x+HW/2))/280));ny=Math.max(-1,Math.min(1,(py-(heroBox.top+y+HH/2))/280));   // cursor gaze off the CACHED hero box -- the old per-head rect (rr) was removed in the reflow purge and these two survivors threw every mouse-move frame
   if(Math.abs(nx)<0.09&&Math.abs(ny)<0.09){nx=0.13*(dir||1);ny=0.05;}}   // same rule as mine: never a dead stare into the camera
  else if(air||Math.abs(vx)>0.5){nx=dir*0.7;ny=0.12;}   // busy going somewhere: it watches where it is going
  else{if(now>=sacAt){
   var pgz=null;if(peers.length>1&&Math.random()<0.32){var pdz=1e9;
    for(var gq=0;gq<peers.length;gq++){var o4=peers[gq];if(o4===me)continue;
     var gdd=Math.abs((o4.x+o4.HW/2)-(x+HW/2));if(gdd<pdz){pdz=gdd;pgz=o4;}}}
   if(pgz){gzx=Math.max(-1,Math.min(1,((pgz.x+pgz.HW/2)-(x+HW/2))/280));gzy=Math.max(-0.5,Math.min(0.5,((pgz.y+pgz.HH/2)-(y+HH/2))/280));}   // it checks on its friends
   else if(typeof lastMove!=="undefined"&&now-lastMove<5000&&Math.random()<0.35){gzx=Math.max(-1,Math.min(1,(px-(heroBox.left+x+HW/2))/420));gzy=Math.max(-0.6,Math.min(0.6,(py-(heroBox.top+y+HH/2))/420));}   // joint attention: it checks what you are doing
   else{do{gzx=(Math.random()*1.4-0.7);}while(Math.abs(gzx)<0.12);gzy=(Math.random()*0.8-0.45);}
   sacAt=now+700+Math.random()*1600;}
   nx=gzx;ny=gzy;if(drowse2){nx*=0.3;ny=0.4;}}
  if(!grabbed&&bigR&&visitUntil&&now<visitUntil&&Math.abs((x+HW/2)-(bigR.l+bigR.r)/2)<(bigR.r-bigR.l)){nx=((bigR.l+bigR.r)/2>(x+HW/2))?0.7:-0.7;ny=-0.55;}   // home beside the caregiver: it looks up at him
  if(now>=bAt&&bf===0&&!grabbed&&dzf===0){bf=5;dblBlink=!drowse2&&Math.random()<0.22;bAt=now+(drowse2?5600:2700)+Math.random()*3800;}
  if(bf>0&&sqT<=0){sqyP=Math.min(sqyP,0.965);sqxP=Math.max(sqxP,1.018);}   // the blink leans on the spring TARGETS: the body joins in smoothly, never snaps
  if(bf===1&&dblBlink){dblBlink=false;bf=5;}
  try{if(perched&&faceImg&&faceImg.src.indexOf("smile")>-1&&now>=mirrorAt){mirrorAt=now+3000;brf=6;mof=4;}}catch(_){}   // he smiles, it beams back
  if(perched&&moodB){brows.forEach(function(b){b.style.transform="translateY(-3px)";});}
  else if(now>=brAt&&brf===0){brf=6;brAt=now+8000+Math.random()*9000;}
  if(brf>0){var lift=(brf>4||brf===1)?-1.5:-3;brows.forEach(function(b){b.style.transform="translateY("+lift+"px)";});brf--;}
  else brows.forEach(function(b){b.style.transform="";});
  if(now>=moAt&&mof===0){mof=4;moAt=now+10000+Math.random()*10000;}
  if(mof>0&&mouth){mouth.style.transform=(mof%2)?"translateY(1.2px) scaleY(1.06)":"translateY(0.5px) scaleY(1.02)";mof--;}
  else if(mouth&&mof===0)mouth.style.transform="";
  eyeEls3.forEach(function(o,oi){
   setT(o.box,"rotate("+((o.ang||0)+(Math.abs(rot)>20?0:-rot)).toFixed(1)+"deg)");   // THEIR canthal tilt stays; the glint's light source does not tilt with the head
   if(bf>0){var lp=(bf===5||bf===1)?-44:(bf===4?-14:-4);setT(o.lid,"translateY("+lp+"%)");}
   else setT(o.lid,drowse2?"translateY(-64%)":"translateY(-105%)");   // heavy lids when sleepy
   if(dzf>0){var ph=(12-dzf)*0.95+(oi?2.2:0);var ebw2=eyeBoxW(o);setT(o.iris,"translate("+Math.round(Math.cos(ph)*ebw2*0.22)+"px,"+Math.round(Math.sin(ph)*ebw2*0.14)+"px)");}
   else{var ebw=eyeBoxW(o);var gtx2=Math.round(nx*ebw*0.18),gty2=Math.round(ny*ebw*0.10);setT(o.iris,"translate("+gtx2+"px,"+gty2+"px)");setT(o.glint,"translate("+Math.round(gtx2*0.62)+"px,"+Math.round(gty2*0.62)+"px)");}
  });
  if(dzf>0)dzf--;
  if(bf>0)bf--;
  }
 }
 requestAnimationFrame(_frame);
 if(slot===0)window.__hmC={get:function(){return{x:x,y:y,st:st,gone:gone,depth:depth,grabbed:grabbed};}};
 }
 list.forEach(function(d,i){spawnCompanion(d,i);});
 window.__hmLobbyThrowIn=function(){
  var reduce=false;try{reduce=matchMedia("(prefers-reduced-motion:reduce)").matches;}catch(_){}
  var crowd=peers.filter(function(peer){return peer&&!peer.__filler&&peer.root&&peer.root.isConnected&&typeof peer.lobbyThrow==="function";})
   .sort(function(a,b){return a.slot-b.slot;});
  if(reduce||!crowd.length){document.body.setAttribute("data-lobby-throw",reduce?"reduced":"empty");return 0;}
  var token=++_lobbyThrowToken;document.body.setAttribute("data-lobby-throw","active");
  crowd.forEach(function(peer,index){peer.lobbyThrowPrepare(index,crowd.length);});
  crowd.forEach(function(peer,index){var launch=function(){if(token===_lobbyThrowToken)peer.lobbyThrow(index,crowd.length);};if(index===0)launch();else setTimeout(launch,index*LOBBY_THROW_STAGGER);});
  setTimeout(function(){if(token===_lobbyThrowToken)document.body.setAttribute("data-lobby-throw","settled");},LOBBY_THROW_DURATION);
  return crowd.length;
 };

 /* ---- MATCH EVENT BUS. The engine only EMITS; every presentation system (ticker,
    director, sound, stats) is a consumer. A throwing consumer must never break
    the engine, hence the try/catch per listener. */
 var BUS=(function(){var subs={};return{
   on:function(t,f){(subs[t]=subs[t]||[]).push(f);return f;},
   off:function(t,f){var l=subs[t]||[],i=l.indexOf(f);if(i>=0)l.splice(i,1);},
   emit:function(t,d){var l=(subs[t]||[]).slice();
     for(var i=0;i<l.length;i++){try{l[i](d,t);}catch(_){}}}
 };})();
 window.__hmBus=BUS;
 /* ---- SESSION MEMORY. Real numbers only: everything here is derived from bus
    events, never invented. Keyed by head slot; pairs keyed order-independently. */
 window.__hmSess=window.__hmSess||{head:{},pair:{},cups:0};
 function sessHead(sl){var h=window.__hmSess.head;
   return h[sl]=h[sl]||{goals:0,played:0,titles:0};}
 function sessPairKey(a,b){return a<b?a+'|'+b:b+'|'+a;}
 BUS.on('goal',function(d){if(d.scorer!=null)sessHead(d.scorer).goals++;});
 window.__hmSessFlags=function(a,b){
   var p=window.__hmSess.pair[sessPairKey(a,b)];
   var fgp={};fgp[a]=!sessHead(a).goals;fgp[b]=!sessHead(b).goals;
   return{met:!!p,revenge:!!p&&p.lastWinner!=null,
     lastWinner:p?p.lastWinner:null,
     firstGoalPending:fgp};};
 (function soccer(){   // the pitch: one ball, two goals, a scoreboard, first to five
  var hero=document.querySelector(".hero");if(!hero)return;
  if(matchMedia("(prefers-reduced-motion:reduce)").matches)return;
  var S={on:false,seed:0,kickSeed:0,teams:{},target:5,cap:8,red:0,blue:0,ball:{x:0,y:0},phase:"idle",winner:0};
  window.__hmSoccer=S;
  var ball,ballSkin,goalL,goalR,goalShL,goalShR,board,sR,sB,countEl,W=0,H=0,groundY=0,BR=24,GH=150,OFF=0,XL=0,XR=0;
  /* ===== THE YOWMINGS LEAGUE: ONE ENGINE, A DIFFERENT OBJECTIVE =====
     Jayden: "pretty much the exact same but just more catered to fantasy football".
     Taken literally, and that is the whole design. There is no second engine, no second
     AI, no second ball loop and no second set of tuning constants. YOW is a boolean read
     once at start(), and every line it touches below answers ONE question: WHERE DOES A
     SCORE HAPPEN. The scrum, the contact loft (0.26 -- measured, do not touch), the
     sideways squirt that unburied the ball, the 1.6s confinement timer, the roof, the
     restitution and the leap-for-a-ball-overhead all run byte-identical.

     THE OBJECTIVE IS INVERTED, NOT MOVED. Soccer scores in the band BELOW the crossbar
     (`by > groundY-GH`); the League scores in the band ABOVE it, between the crossbar and
     the tops of the posts, and only when the ball is actually travelling through. Same
     wall plane, same netCatch(), same handful of lines -- so a mode difference that could
     have been a fork is a comparison operator.

     UCB is the crossbar's height above the pitch and UPH the posts' height above the
     crossbar; together they are the aperture. Both are derived in geo() from the arena and
     the head size, never hard-coded, because a phone's pitch is half a desktop's and a
     fixed bar would be either unreachable or unmissable. UPW is the aperture's width, and
     YKICK the horizontal speed that separates a kick from a drift. ===== */
  var YOW=false,UCB=0,UPH=0,UPW=0,YKICK=600;
  /* ===== DEV-ONLY: THE PITCH READING =====
     Jayden: "there is still a lot of bundling up in the soccer mode lots of people in
     the goal and the 'goalie' of the other team just stands there." Both halves of that
     are claims about DURATION -- a pile that clears in a second and a pile that lasts
     fifteen are the same picture in memory -- and neither can be answered without
     sampling a running match. There is no hand crank here the way there is in the race,
     so a probe has to drive one at real speed and read it; this is what it reads. Behind
     ?wraf=1, so a real viewer pays one boolean test per frame and nothing else. */
  var WRAF9=false;try{WRAF9=/[?&]wraf=1/.test(location.search);}catch(_){}
  var camBack,camFront,_camT=0;   // THE GOAL GRAMMAR camera: two transform-only wrappers (ball-shadow+goals+goal-shadows / ball only) so a punch never touches .hmScore -- see stagePunch() below
  var flapR=null,flapB=null;   // the split-flap instances mounted into .sR/.sB by paintBoard()
  var bx=0,by=0,bvx=0,bvy=0,kickCd={},running=false,last=performance.now(),scoreTeam=0,ballShadow,lastShot=0;
  var bsx=1,bsy=1,bsxv=0,bsyv=0,bsxP=1,bsyP=1,bsT=0;
  if(/[?&]wraf=1/.test(location.search))window.__hmSoccerSettleProbe=function(){
   if(!S.on||!ball)return false;geo();bx=(XL+XR)/2;by=groundY-BR;bvx=0;bvy=0;bsx=bsy=bsxP=bsyP=bsp=1;bsxv=bsyv=0;bsT=0;S.phase="play";S.ball.x=bx;S.ball.y=by;if(goalL){goalL.classList.remove("hmGoalHit");goalR.classList.remove("hmGoalHit");}if(camBack){camBack.classList.remove("hmCamPunch");camFront.classList.remove("hmCamPunch");}window.__hmFreeze=Math.max(window.__hmFreeze||0,performance.now()+600);return true;};   // DEV-ONLY: park the REAL private ball model at midfield on the production pitch, clear transient score-camera transforms, then let the normal loop render it. Browser contracts can measure exact stable geometry after a live resize without waiting for AI players to stop kicking it.
  function geo(){var r=hero.getBoundingClientRect();W=r.width;H=r.height;OFF=r.left;XL=-OFF;XR=innerWidth-OFF;   // the pitch spans the whole screen, wall to wall
   // THE PITCH IS FLUSH TO THE GLASS, phone included. This used to read `if(innerWidth<=640){XL+=12;XR-=12;}`
   // -- a 12px inset added because at zero inset the goal SHADOWS clipped (they are 60px wide and
   // drawn 6px outside the 42px goal, so they ran to -6 and 398) and the whole goalmouth read as cut
   // off. Jayden, looking at it on a phone: "Goals still look like they aren\'t flush against the
   // wall on mobile." He is right, and 24px of a 390px screen is 6% of the pitch spent on a margin a
   // phone can least afford. The shadow was the actual problem, so the shadow is what is fixed --
   // see layout(), where it is clamped into the arena instead of hanging outside it.
   // XL/XR are the PITCH BOUNDS, not a goal graphic: the goals, the goal shadows, the crossbar test,
   // the kickoff centre, the ball\'s wall clamps and the scoring plane (bx<XL+BR / bx>XR-BR) every
   // one of them derives from these two numbers, so the net and the place a goal actually counts
   // move together by construction and cannot desync. That is why this is the right line to change
   // and why nudging the goal graphic alone would have been the wrong one.
   var st=document.getElementById("stage");if(st){var sr=st.getBoundingClientRect();groundY=sr.bottom-r.top;}else groundY=H-40;   // the pitch line == where the heads' feet rest (the stage bottom), so ball and players share one ground
   var _ownedFeet=document.body.classList.contains("hmFull")&&window.__hmFeetY!=null;
   if(_ownedFeet){groundY=window.__hmFeetY;if(S.on)_gyLock=groundY;}
   else if(S.on&&_gyLock!=null)groundY=_gyLock;   // LATCH. Outside the owned full-screen arena, the pitch line is fixed for the whole match:
   // the head engine already refuses to trust the big head mid-game ("during a game the big head
   // STEPS OFF ... so his position is NOT the floor then") and soccer has to do the same, or the
   // goals chase him across the screen as he fades out.
   else if(S.on&&_gyLock==null)_gyLock=groundY;   // inside the owned arena, __hmFeetY is the shared source of truth and refreshes this latch after a live viewport reversal; outside it, the big head cannot drag the pitch around mid-match
   if(groundY>H-16)groundY=H-16;
   /* THE APERTURE, DERIVED. The crossbar has to be over a standing head and under a
      leaping one, or the mode is either unblockable or unscoreable: a head leaps at
      vy 940..1500 against G=2600, a rise of 170..433px, and it is HH tall before it
      leaves the ground. So the bar is pinned to the head (1.9 head-heights) and the
      window above it to 2.6 more, then both are clamped into whatever vertical room the
      arena actually has -- a 900px desktop and a 390px phone get the same PROPORTIONS of
      a contested target rather than the same pixels. */
   var _spanU=Math.max(120,groundY-32),_hhU=(innerWidth<=880?64:96);
   UCB=Math.round(Math.max(110,Math.min(_spanU*0.34,_hhU*2.5)));
   UPH=Math.round(Math.max(100,Math.min(_spanU*0.21,_hhU*1.35)));
   var nBR=innerWidth<=880?16:24;   // the heads shrink on mobile (96->64), so the ball shrinks with them (48->32) to keep the player:ball ratio honest
   BR=nBR;UPW=BR*3;   // the aperture is three ball radii wide, so a 48px ball flies through a 72px gap -- snug, which is the whole picture this mode is for
   // was gated on nBR!==BR, but dom() calls geo() BEFORE it creates the ball: BR flipped
   // 24->16 while `ball` was still null, and every later geo() then saw nBR===BR and skipped the
   // resize forever. So on a phone the ball was PAINTED at its 48px CSS default while its physics
   // radius was 16 -- 1.5x too big, and translate(bx-BR) on a 48px box put its centre at bx+8,
   // which is exactly the 8px the drop-from-the-title landed off by. Sync the DOM to BR instead.
   if(ball&&ball.style.width!==(2*BR)+"px"){ball.style.width=ball.style.height=(2*BR)+"px";}
   if(ballShadow&&ballShadow.style.width!==(2*BR)+"px"){ballShadow.style.width=(2*BR)+"px";ballShadow.style.height=(BR*0.55).toFixed(1)+"px";}}
  function dom(){geo();
   /* THE GOAL GRAMMAR camera: ball+shadow and the goals+shadows each live inside their own
      plain wrapper (position:absolute;inset:0, no z-index/transform while idle -- CSS makes
      that combination stacking-context-transparent, so it changes nothing about today's
      render). Only stagePunch() ever gives them a transform, and only the pitch moves --
      .hmScore below is appended straight to `hero`, never into either wrapper.
      camFront carries ONLY the ball (z:48, belongs above the heads' z:3). The ball's
      shadow (z:1, belongs BELOW the heads, same as the goal shadows) goes in camBack
      instead -- review caught that shadow riding along in camFront, because giving that
      wrapper z-index:48 during a punch would have dragged the whole unit, shadow
      included, in front of the heads. camBack's own punch z-index (2) is still above
      the shadow's native 1 and below the heads' 3, so nothing changes there either. */
   planetDOM();   // the ground, the sky and the water go in FIRST: .hmWater has to land after every head reflection and before camBack, and camBack is the very next line
   camBack=document.createElement("div");camBack.className="hmCam hmCamBack";hero.appendChild(camBack);
   camFront=document.createElement("div");camFront.className="hmCam hmCamFront";hero.appendChild(camFront);
   ballShadow=document.createElement("div");ballShadow.className="hmBallShadow";camBack.appendChild(ballShadow);
   ball=document.createElement("div");ball.className="hmBall";
   ballSkin=document.createElement("div");ballSkin.className="hmBallSkin";ball.appendChild(ballSkin);   // the pattern: this alone rotates
   var ballShade=document.createElement("div");ballShade.className="hmBallShade";ball.appendChild(ballShade);   // the sphere lighting: fixed, so the ball reads as lit, not a spinning disc
   camFront.appendChild(ball);
   goalShL=document.createElement("div");goalShL.className="hmGoalShadow";camBack.appendChild(goalShL);
   goalShR=document.createElement("div");goalShR.className="hmGoalShadow";camBack.appendChild(goalShR);
   goalL=document.createElement("div");goalL.className="hmGoal hmGoalR";camBack.appendChild(goalL);   // left goal is RED\u2019s to defend
   goalR=document.createElement("div");goalR.className="hmGoal hmGoalB";camBack.appendChild(goalR);
   /* THE UPRIGHTS RIDE INSIDE THE GOAL, they are not a second pair of elements. Everything
      that already knows how to show, hide, move, tint and flash a goal -- start()'s opacity,
      layout()'s transform, netCatch()'s .hmGoalHit, the camera wrapper -- keeps working
      unchanged, and body.hmYow decides which of the two graphics is painted. Four hairline
      bars: the stem up to the crossbar, the crossbar, and the two posts (near and far, the
      far one dimmer, which is the only depth cue a side-on pitch can honestly give). */
   ["hmUpStem","hmUpBar","hmUpPost hmUpPostF","hmUpPost hmUpPostN"].forEach(function(cn){
    var e0=document.createElement("div");e0.className=cn;goalL.appendChild(e0);
    var e1=document.createElement("div");e1.className=cn;goalR.appendChild(e1);});
   board=document.createElement("div");board.className="hmScore";
   // Scoreboard structure taken from the SportyBlocks kit: an inner card holding a team row,
   // an asymmetric VS divider and a second team row, sitting on a footer ledge. Their crest
   // becomes our head, their city line becomes the team's colour name. The .sR / .sB hooks are
   // kept exactly as they were, because board2() writes the live score straight into them.
   // Only the SHELL is built here. The team rows are painted per match by paintBoard() --
   // built once, they showed the first match's two players for the rest of the tournament,
   // because dom() is itself guarded by if(!ball) and never runs a second time.
   board.innerHTML =
      '<div class="sbCard">'
    +   '<img class="sbTrophy" src="images/trophy.webp" alt="" draggable="false">'
    +   '<div class="sbInner"></div>'
    +   '<div class="sbFoot">'
    +     '<span class="sbRound"></span>'
    +     '<span class="sbMeta"><span class="sbRule">First to ' + S.target + '</span>'
    +       '<img class="sBall" src="images/soccerball.webp" alt="" draggable="false"></span>'
    +     '<button class="hmScoreEnd" type="button" aria-label="End the match">'
    +       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">'
    +       '<path d="M5 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2l0-10"/></svg>End</button>'
    +   '</div>'
    + '</div>';
   hero.appendChild(board);paintBoard();
   board.querySelector(".hmScoreEnd").addEventListener("click",function(e){e.stopPropagation();finish();});   // end the match right from the scoreboard
   countEl=document.createElement("div");countEl.className="hmCount";hero.appendChild(countEl);}
  /* THE GOAL GRAMMAR camera punch: a brief scale + directional shake on the pitch wrappers
     only, transform-origin set toward wherever the ball actually is (the goal it just went
     in). .hmCamPunch supplies the z-index (matching what ball/goal already had) only for its
     own duration, so nothing z-fights the heads once it's gone. Exposed on window so the
     goal-grammar bus subscriber -- a separate module, guarded like every other cross-block
     consumer -- can call it without reaching into this closure. */
  function stagePunch(){try{
   if(!camBack||!camFront)return;
   var hr=hero.getBoundingClientRect();
   var gx=(S.ball&&S.ball.x!=null)?S.ball.x:hr.width/2, gy=(S.ball&&S.ball.y!=null)?S.ball.y:hr.height*0.6;
   var pctX=Math.max(4,Math.min(96,(gx/Math.max(1,hr.width))*100));
   var pctY=Math.max(18,Math.min(88,(gy/Math.max(1,hr.height))*100));
   var dir=gx<hr.width/2?-1:1, dx=(14*dir)+"px", dy="-3px";
   var wraps=[camBack,camFront];
   for(var i=0;i<wraps.length;i++){var el=wraps[i];
    el.style.transformOrigin=pctX.toFixed(1)+"% "+pctY.toFixed(1)+"%";
    el.style.setProperty("--camDX",dx);el.style.setProperty("--camDY",dy);
    el.classList.remove("hmCamPunch");void el.offsetWidth;el.classList.add("hmCamPunch");}
   clearTimeout(_camT);
   _camT=setTimeout(function(){for(var j=0;j<wraps.length;j++){wraps[j].classList.remove("hmCamPunch");wraps[j].style.zIndex="";}},560);
  }catch(_){}}
  window.__hmStagePunch=stagePunch;
  // Where the ball LIVES between points: inside the title, exactly where the cookie sits after
  // "hunger" in the hero. Every kickoff and restart drops it from here, so it reads as falling
  // out of the word rather than appearing from nowhere. The title copy hides whenever the real
  // ball is on the pitch, so there is only ever one ball on screen.
  var _gyLock=null,_lastGW=-1;
  function ballHome(){if(!board)return null;var e=board.querySelector(".sBall");if(!e)return null;
   var r=e.getBoundingClientRect(),hr=hero.getBoundingClientRect();if(!r.width)return null;
   return {x:r.left+r.width/2-hr.left,y:r.top+r.height/2-hr.top};}
  function ballInTitle(on){if(!board)return;board.classList.toggle("ballOut",!on);
   if(on)board.classList.remove("ballFell");}
  var _spawnY=null,_curveTo=0,_curving=false,_cvOn=false,_cvA=0,_cvS=1;
  /* ===== THE CONFINEMENT TIMER: THE BALL IS NOT SLOW, IT IS TRAPPED =====
     Jayden: "no players seem to be standing still or any breaking or ball getting stuck or
     lame tug of wars ... the ball bouncing in the air is intresting."

     DECK_MAX below catches a DIFFERENT defect and both are needed. Its own note says the
     ball it was built for "travelled 701px" -- a ball being shuffled the length of the pitch
     along the floor. This one catches the opposite: a ball going nowhere at all.

     AND IT IS NOT THE SAME QUESTION AS "IS THE BALL MOVING", which is the reason this went
     unmeasured for so long. tools/soccer-bundle-probe.py asked whether the ball was under
     90px/s and whether 3+ heads were in a goal area, and both answered no wedge -- correctly,
     for what they asked. tools/soccer-flow-probe.py cranks the clock and samples every frame,
     and asks the question Jayden actually asked: how long does the ball spend inside one small
     circle? Measured over 38 minutes of simulated play, eight heads, 1440x900:

       ball inside one 70px circle    46.4% of all play
       episodes over 2s              257
       p90 episode                   5.97s
       WORST EPISODE                 58.45s
       where                         13% and 90% across the pitch, 5% up -- both goalmouths, on the deck

     A minute of the ball being batted between bodies inside a circle smaller than one head is
     the "lame tug of war" verbatim, and the per-frame numbers cannot see it: the ball is being
     struck constantly, so its speed is fine and every "is it still" run is under 0.9s. The
     scrum is churning; the ball is imprisoned in it.

     DECK_MAX CANNOT FIRE HERE, and that is arithmetic rather than a guess. Its reset is
     `by<REST-BR*0.6` -- a 14px hop clears it -- and a head impulse pops the ball far higher
     than that many times a second. So the one mechanism built to break a stalemate is held
     down by the stalemate itself.

     WHY THIS IS NOT THE TIDINESS THAT KEEPS GETTING REJECTED. Nothing here touches a head.
     No separation, no roles, no zones, no stations, no leash -- the pile is not asked to
     disperse and does not. The BALL leaves, upward and sideways, and the pile follows it,
     which is the same pile doing the same thing somewhere it can resolve. It is the exact
     distinction this file already draws: chaos that RESOLVES is the product, chaos that STOPS
     is dead time.

     AND THE ESCAPE IS VERTICAL ON PURPOSE, because that is the second half of what he asked
     for. The ball leaves over the heads, so what follows is a contested drop rather than
     another floor scrap. ---- */
  var _cfx=0,_cfy=0,_cfT=0,_cfPops=0;
  var CONF_MAX=1.6;   // seconds inside the circle before the ball is let out. Sits well under the
  // 5.97s p90 of the measured episodes and well over anything that reads as a real contest.
  var _deckT=0,DECK_MAX=2.6;   // seconds the ball may spend CONTINUOUSLY on the deck before it gets
  // squirted back into the air. Measured first: over a 75s match the ball was on the ground 58.7s
  // of it (78%), in episodes of 17.7s, 6.9s, 6.2s, 5.9s, 5.8s, 5.1s, 4.2s... The longest one
  // travelled 701px, so this is NOT a standoff in one spot -- the ball simply never gets airborne
  // and the heads shuffle it along the floor. Hence the trigger is TIME ON THE GROUND, not lack of
  // movement: a "stuck" test keyed on horizontal range caught 0.0s of that 58.7s.
  var bsp=1;   // ball spawn scale: starts at the title copy's size so the drop reads as the SAME ball growing
  function ballSpawnScale(){var e=board&&board.querySelector(".sBall");var w=e?e.getBoundingClientRect().width:0;
   return w?Math.max(0.18,Math.min(1,w/(2*BR))):0.5;}
  var _lastGY=-1;
  function layout(){geo();planetGeo(groundY);
   // Goals and companion feet share the one published flat match plane. The
   // planet may curve visually underneath it, but applying that decorative arc
   // only to the goals put their bottoms on a different line from every player.
   var _gl=0,_gr=0;
   // No .toFixed() anywhere here, deliberately: these four lines never formatted their y before, and
   // `v + 0` is the identity on a float, so at SAG=0 they emit the same characters they always did.
   if(YOW){
    /* THE UPRIGHTS ARE SIZED FROM THE NUMBERS, NOT MEASURED OFF THE ELEMENT. Soccer reads
       GH back out of the DOM because its net is a fixed CSS box; the aperture is derived
       per-arena in geo(), so here the arithmetic is the source and the element follows it.
       --upBar is how far below the element's own top the crossbar sits, which is UPH by
       construction, and it is the ONE number the stylesheet needs to draw all four bars. */
    GH=UCB+UPH;
    [goalL,goalR].forEach(function(g0){g0.style.width=UPW+"px";g0.style.height=GH+"px";
      g0.style.setProperty("--upBar",UPH+"px");});
    goalL.style.transform="translate("+XL+"px,"+(groundY-GH+_gl)+"px)";
    goalR.style.transform="translate("+(XR-UPW)+"px,"+(groundY-GH+_gr)+"px)";
    /* AND THEY CAST NOTHING. A 60px blur under a 5px pole was never going to read, and the
       site's rule is that only the companion heads stand on something. Subtraction. */
    if(goalShL)goalShL.style.opacity="0";if(goalShR)goalShR.style.opacity="0";
    return;}
   /* Coming back from a League match the two goals still carry its inline sizing, and
      offsetHeight would then read the aperture instead of the net. Hand the box back to the
      stylesheet before measuring it. */
   [goalL,goalR].forEach(function(g1){if(g1.style.width){g1.style.width="";g1.style.height="";g1.style.removeProperty("--upBar");}});
   GH=goalL.offsetHeight||150;
   goalL.style.transform="translate("+XL+"px,"+(groundY-GH+_gl)+"px)";
   goalR.style.transform="translate("+(XR-42)+"px,"+(groundY-GH+_gr)+"px)";
   // The goal shadow is 60px under a 42px goal, so it wants to sit 6px outside it on each side --
   // which is exactly what clipped once the pitch went flush to the viewport edge. Clamp it into the
   // arena rather than insetting the whole pitch to accommodate it: at the edge it slides 6px inboard
   // of where it would like to be, which at its alpha is invisible, and nothing else in the
   // simulation has to move. GW/GSW are read from the elements so a CSS width change cannot desync it.
   var _gw=goalL.offsetWidth||42,_gsw=(goalShL&&goalShL.offsetWidth)||60;
   var _gsx=function(gx){return Math.max(XL,Math.min(XR-_gsw,gx+(_gw-_gsw)/2));};   // centre it under its goal, then clamp into the arena
   if(goalShL)goalShL.style.transform="translate("+_gsx(XL).toFixed(1)+"px,"+(groundY-4+_gl)+"px)";
   if(goalShR)goalShR.style.transform="translate("+_gsx(XR-_gw).toFixed(1)+"px,"+(groundY-4+_gr)+"px)";}
  /* FX bridge: __hmFX (the shared VFX canvas -- see its own comment, "coords are HERO-LOCAL, same
     space the heads live in") expects x measured from the hero's left edge and y from its top edge,
     both in unscaled screen pixels, and adds heroLeft itself. The ball (bx,by) is drawn via
     translate(bx,by) on `.hmBall{position:absolute;left:0;top:0}` appended straight into `hero` --
     the exact same DOM pattern the companion heads use (`root.style.cssText="position:absolute;
     left:0;top:0..."`, also a direct child of `hero`), which __hmFX already tracks correctly for
     battle VFX. So bx/by already live in that same space: no rescale, no axis flip, identity. */
  function fxAt(ex,ey){return{x:ex,y:ey};}
  window.__hmFxAt=fxAt;
  /* The goals are positioned once, from start(). geo() reads innerWidth, so after a resize
   XL/XR were stale and the goals sat where the old viewport put them -- and the pitch
   bounds the physics uses went stale with them. Re-run the layout while a match is live. */
onResizeFrame(function(){if(S.on){try{
 var _oxl=XL,_oxr=XR,_obx=bx,_ospan=_oxr-_oxl;
 _gyLock=null;
 layout();
 if(_ospan>0&&XR>XL){var _bf=(_obx-_oxl)/_ospan;bx=Math.max(XL+BR,Math.min(XR-BR,XL+_bf*(XR-XL)));}
 requestAnimationFrame(function(){if(!S.on)return;try{_gyLock=null;layout();}catch(_){}});
}catch(_){}}});
function teams(){
   // BENCHED heads take no part. The tournament fields only the two teams in the fixture, and a
   // benched head with no side used to fail the "does the pick cover every real head" test below,
   // which silently dropped the whole selection and re-drew random sides -- so squads ended up
   // scrambled across the two teams they were supposed to be playing for.
   var _bn=window.__hmBench||null;
   var _act=peers.filter(function(p){return !_bn||!_bn[p.slot];});
   var sl=_act.map(function(p){return p.slot;}),n=sl.length,half=Math.ceil(n/2);
   // PLAYER'S PICK first: if the soccer team picker set sides that cover every real head, honour them (the mini-Jayden filler, slot>=9000, isn't picked -> it balances onto the smaller side)
   var sel=window.__hmTeamSel,realN=0,realOK=!!sel,ci=0;
   if(sel){_act.forEach(function(p){if(p.slot<9000){realN++;if(sel[p.slot]!==1&&sel[p.slot]!==2)realOK=false;}});if(realN===0)realOK=false;}
   if(realOK){S.teams={};var c1=0,c2=0;
    _act.forEach(function(p){if(p.slot<9000){S.teams[p.slot]=sel[p.slot];if(sel[p.slot]===1)c1++;else c2++;}});
    _act.forEach(function(p){if(p.slot>=9000){var tm=(sel[p.slot]===1||sel[p.slot]===2)?sel[p.slot]:((c1<=c2)?1:2);S.teams[p.slot]=tm;if(tm===1)c1++;else c2++;}});   // the mini-Jayden takes the side you picked for him (else evens the sides)
    makeRoles(sl);return;}
   var a=[];for(var i=0;i<n;i++)a.push(i<half?1:2);
   for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}   // Fisher-Yates: fresh sides each game
   S.teams={};sl.forEach(function(s2,i){S.teams[s2]=a[i];});
   makeRoles(sl);}
  function makeRoles(sl){S.roles={};[1,2].forEach(function(tm){   // roles scale with the squad: a lone player just plays; only a real team bothers with a keeper
    var mem=sl.filter(function(s2){return S.teams[s2]===tm;});
    for(var k=mem.length-1;k>0;k--){var j2=Math.floor(Math.random()*(k+1)),t2=mem[k];mem[k]=mem[j2];mem[j2]=t2;}
    if(mem.length<=2){mem.forEach(function(s2){S.roles[s2]="attacker";});return;}   // a small side: everyone chases, nobody hangs back by the net (that reads as "standing around")
    if(mem.length===3){S.roles[mem[0]]="defender";S.roles[mem[1]]="attacker";S.roles[mem[2]]="attacker";return;}
    var nd=mem.length>=5?2:1;
    /* ===== THE LEAGUE HAS NO KEEPER, AND THAT IS A DELETION, NOT A TACTIC =====
       A keeper exists to stand in a mouth. The aperture is UCB above the pitch -- over a
       standing head by construction -- so a keeper in this mode is a head pinned near its
       own wall by a leash it cannot use, which is precisely the "the goalie of the other
       team just stands there" reading that has been complained about once already. The
       leash itself is NOT touched, lengthened or re-tuned: the role that owns it simply is
       not handed out, so the clamp is never reached -- the probe reports it pinned 0% of
       frames in this mode and 76% in soccer, which is how you can tell nothing moved. One
       fewer head hanging back means one more in the scrum, which is the direction this
       game is supposed to go. ===== */
    mem.forEach(function(s2,i){S.roles[s2]=(i===0)?(YOW?"defender":"keeper"):(i<=nd)?"defender":"attacker";});});}
  /* Repaints the two team rows from the CURRENT fixture. Called on every kickoff, not just
     when the board is created, so match two shows match two's players. Re-queries sR/sB
     afterwards: rewriting the inner HTML replaces the very elements board2() writes into, so
     holding the old references would silently stop the score updating. */
  function paintBoard(){
    if(!board)return;
    var inner=board.querySelector(".sbInner"); if(!inner)return;
    function side(which){
      var nm=(which==="R"?"Red":"Blue"), col=(which==="R"?"194,61,51":"49,109,181"), cut="";
      try{ var T=window.__hmTour;
        if(T&&T.live&&T.cur){
          var tm=(which==="R"?T.cur.a:T.cur.b);
          if(tm){ nm=tm.name; col=tm.col;
                  cut=(tm.captain&&(tm.captain.portrait||tm.captain.cut))||""; }
        }
      }catch(_){}
      /* No tournament fixture? Appoint a captain from the heads actually on that side. A flat
         colour circle said nothing; the head says who is playing. A real head outranks the
         mini-Jayden filler, so the captaincy does not fall to a clone when someone real is
         available. The NAME stays Red / Blue -- that is the team's identity here. */
      if(!cut){try{
        var want=(which==="R"?1:2), best=null;
        for(var i=0;i<peers.length;i++){var p=peers[i];
          if(!p||S.teams[p.slot]!==want)continue;
          if(!best)best=p;
          if(p.slot<9000&&!p.__filler){best=p;break;}}
        if(best&&best.cut)cut=best.cut;
      }catch(_){}}
      var face=cut?'<span class="sbFace"><img src="'+cut+'" alt="" draggable="false"></span>'
                  :'<span class="sbDot"></span>';
      var name='<b class="sbNm">'+nm+'</b>';
      var score='<b class="s'+which+' sbScore"></b>';
      /* Single horizontal bar (2026-07-30 rebuild): head, name, flap digit -- nothing else.
         .sR / .sB stay exactly where they were -- board2() writes the live score straight
         into them and does not know the layout changed. The B side mirrors the order (flap,
         name, head) so the two scores meet toward the centre; DOM order alone carries the
         mirror, no row-reverse needed. */
      var kids=(which==="R")?(face+name+score):(score+name+face);
      return '<div class="sbTeam" style="--tc:'+col+'">'+kids+'</div>';
    }
    inner.innerHTML = side("R")
      + '<span class="sbVs" aria-hidden="true">–</span>'
      + side("B");
    sR=board.querySelector(".sR"); sB=board.querySelector(".sB");
    /* Split-flap digits, mounted fresh every repaint -- the row itself was just rebuilt above,
       so any flap instance left over from the previous fixture died with it. Instant set: a
       board that has not played this match yet does not spin in from nothing. */
    if(sR){flapR=bcFlap(sR,1);flapR.set(String(S.red),true);}
    if(sB){flapB=bcFlap(sB,1);flapB.set(String(S.blue),true);}
    /* Board materials: grain plus a slight per-match tilt, seeded on S.seed so a given match
       always paints the same board (stable across a re-render of THAT match) while the next
       match still gets its own roll. Guarded -- __bcMat is a conditional global (Foundations
       contracts). */
    if(window.__bcMat){
      var cardEl=board.querySelector(".sbCard");
      if(cardEl){window.__bcMat.grainOn(cardEl);
        var _mr=window.__bcMat.rand('board'+(S.seed||''));
        window.__bcMat.jitter(cardEl,_mr,0.4,1);}
    }
    ruleLabel();   // one owner for that string, so a repaint cannot reset it to "First to N"
    /* The round, named on the bug. This is the one mechanism the research actually found in
       shipping products -- US postseason bugs stamp the round on, and fighting games print
       GRAND FINALS into a variable slot with nothing else changed. Gold, trophies and heavier
       frames had no shipping precedent at all, so the gold stays on the ball where it earns
       its keep. */
    var rl=board.querySelector(".sbRound");
    if(rl){ var txt="";
      try{ var T2=window.__hmTour;
        if(T2&&T2.live&&T2.cur&&T2.br){
          // Speak the cup's voice (roundName), not the generic bracket label -- a Bearings
          // semi says "Last Four" here same as it does on the Draw Board.
          txt=(typeof T2.roundName==="function")
            ? T2.roundName(T2.cur.round, T2.br.rounds.length)
            : (T2.br.rounds[T2.cur.round]||{}).label||"";
        }
      }catch(_){}
      rl.textContent=txt; rl.style.display=txt?"":"none"; }
  }
  /* Leader full ink, trailer dimmed. Four products converged on this independently (ESPN,
     FotMob, NBA.com, Sofascore) and it is the only hierarchy device that costs neither colour
     nor size -- which matters here, because the numerals are the same size as the codes and
     the type system has exactly one weight step. Level scores dim neither. */
  function board2(){
    if(flapR)flapR.set(String(S.red)); if(flapB)flapB.set(String(S.blue));
    if(sR&&sB){
      var lead=(S.red===S.blue)?0:(S.red>S.blue?1:2);
      sR.classList.toggle("sbTrail", lead===2);
      sB.classList.toggle("sbTrail", lead===1);
    }
    /* Clutch: whichever team's NEXT goal ends the match right now, win-by-two or the hard cap
       -- the exact same formula goalIn() checks after a goal lands, evaluated one goal early
       so the plate can call it before it happens rather than after. */
    var _t=S.target,_c=S.cap;
    var mpR=(S.red+1>=_t && S.red+1-S.blue>=2)||(S.red+1>=_c);
    var mpB=(S.blue+1>=_t && S.blue+1-S.red>=2)||(S.blue+1>=_c);
    var teamR=sR&&sR.closest(".sbTeam"), teamB=sB&&sB.closest(".sbTeam");
    if(teamR)teamR.classList.toggle("sbClutch", !!mpR);
    if(teamB)teamB.classList.toggle("sbClutch", !!mpB);
    ruleLabel();
  }
  // "First to 5" stopped being true the moment it went to deuce. Say what is actually on the
  // line: at 5-4 the rule IS win-by-two, and once someone reaches cap-1 the next goal ends it
  // outright, so the target really is the cap.
  /* Targets .sbRule. This read board.querySelector("small") -- the element the SportyBlocks
     rebuild replaced -- so it found nothing, returned early, and the label sat on "First to 5"
     through deuce and past the cap for every match since. */
  function ruleLabel(){if(!board)return;var el=board.querySelector(".sbRule")||board.querySelector("small");if(!el)return;
   var mx=Math.max(S.red,S.blue),df=Math.abs(S.red-S.blue),t;
   if(mx>=S.cap-1)t="First to "+S.cap;
   else if(mx>=S.target&&df<2)t="Win by 2";
   else t="First to "+S.target;
   if(el.textContent!==t)el.textContent=t;}
  function refFlash(){try{if(typeof busyNow==="function"&&!busyNow()&&typeof browFlash==="function")browFlash();}catch(_){}}
  function showCount(t){if(!countEl)return;countEl.textContent=t;countEl.classList.remove("hmCountPulse");void countEl.offsetWidth;countEl.classList.add("hmCountPulse");}
  /* The pitch used to field hardcoded red and blue while the scoreboard showed the fixture's
   real team colours -- a "Green vs Sky" tie ran out in yellow and blue. Both now read the
   same source, so the ring on a head matches the row it came from. */
   var RED="224,90,78",BLUE="90,160,216";
   function teamRGB(side){ try{ var T=window.__hmTour;
     if(T&&T.live&&T.cur){ var tm=(side===1?T.cur.a:T.cur.b); if(tm&&tm.col) return tm.col; }
   }catch(_){} return side===1?RED:BLUE; }
   window.__hmTeamRGB=teamRGB;   // THE GOAL GRAMMAR's particle burst reuses this exact source instead of its own copy, so team colours can never drift apart between the pitch and the goal-mouth particles
  function kickoffCountdown(){S.kickSeed=(S.kickSeed||0)+1;BUS.emit('kickoff',{seed:S.kickSeed});   // the match opener: everyone to their half, then 3-2-1
   var _bh=ballHome();bx=_bh?_bh.x:(XL+XR)/2;by=_bh?_bh.y:70;bsp=ballSpawnScale();_spawnY=by;_curveTo=(XL+XR)/2;_curving=true;_cvOn=false;bvx=0;bvy=0;_deckT=0;_cfx=bx;_cfy=by;_cfT=0;S.phase="count";
   var n=3;showCount(n);
   (function tick(){if(!S.on)return;
    if(n>1){n--;setTimeout(function(){showCount(n);tick();},800);}
    else{setTimeout(function(){if(!S.on)return;showCount("GO");
     setTimeout(function(){if(!S.on)return;if(countEl)countEl.textContent="";bvy=30;S.phase="play";},560);},800);}})();}
  function dropIn(){S.kickSeed=(S.kickSeed||0)+1;   // after a goal: no countdown, the ball just drops back in as they return to their sides
   var _bh2=ballHome();bx=_bh2?_bh2.x:(XL+XR)/2;by=_bh2?_bh2.y:60;bsp=ballSpawnScale();_spawnY=by;_curveTo=(XL+XR)/2;_curving=true;_cvOn=false;bvx=(Math.random()*80-40);bvy=20;_deckT=0;_cfx=bx;_cfy=by;_cfT=0;S.phase="reset";
   // 650 -> 900ms. The set-position leap solves its own arc, and a head crossing most of a
   // 1440px pitch is in the air for ~0.77s; at 650 the whistle went while half the side was
   // still flying, so the line-up was never actually seen. This is the only dead time added
   // anywhere in this pass, it is a quarter of a second, and the ball is visibly curving in
   // to the centre spot throughout it.
   setTimeout(function(){if(S.on)S.phase="play";},900);}
  function goalBurst(team,gx,gy){try{   // the ball bursts, and confetti erupts from the goal it went in
   if((window.__hmFx||0)>=2)return;window.__hmFx=(window.__hmFx||0)+1;
   var cv=document.createElement("canvas"),hr=hero.getBoundingClientRect();cv.width=innerWidth;cv.height=Math.round(hr.height);
   cv.style.cssText="position:fixed;left:0;top:"+hr.top.toFixed(0)+"px;width:100vw;height:"+hr.height.toFixed(0)+"px;pointer-events:none;z-index:62";document.body.appendChild(cv);
   var g=cv.getContext("2d"),P=[];
   // The confetti is the SCORING TEAM'S colour, not a hardcoded red/blue. In a tournament
   // fixture the sides are two arbitrary palette teams, so firing red or blue was showing a
   // colour neither team was wearing.
   var rgb=teamRGB(team);   // confetti wears the scoring team's real colour
   try{var _T=window.__hmTour;
     if(_T&&_T.live&&_T.cur){var _tm=(team===1?_T.cur.a:_T.cur.b);if(_tm&&_tm.col)rgb=_tm.col;}
     else if(S.teams){var _s=S.teams[team===1?1:2];if(_s&&_s.col)rgb=_s.col;}
   }catch(_){}
   var ex=gx+OFF;   // ball hero-x -> screen-x
   for(var i=0;i<22;i++){var a=Math.random()*6.28,sp=180+Math.random()*260;   // the explosion at the ball
    P.push({x:ex,y:gy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-60,w:5+Math.random()*4,h:5+Math.random()*4,c:"255,255,255",rv:4+Math.random()*6,life:1});}
   var goalX=team===1?(innerWidth-14):14,dir=team===1?-1:1;   // confetti shoots OUT of the scored-on goal, into the field
   for(var j=0;j<70;j++){P.push({x:goalX,y:hr.height-40-Math.random()*150,vx:dir*(220+Math.random()*360),vy:-(80+Math.random()*260),
    w:6+Math.random()*4,h:3+Math.random()*3,c:rgb,rv:2+Math.random()*4,life:1});}
   var t=0,l=performance.now();
   (function fr(n){var d=Math.min(0.05,(n-l)/1000);l=n;t+=d;g.clearRect(0,0,cv.width,cv.height);
    var al=t<1.6?1:Math.max(0,1-(t-1.6)/0.7);g.globalAlpha=al;
    P.forEach(function(p){p.vy+=1500*d;p.x+=p.vx*d;p.y+=p.vy*d;p.vx*=0.98;
     g.save();g.translate(p.x,p.y);g.rotate(t*p.rv);g.scale(1,Math.max(0.2,Math.abs(Math.cos(t*p.rv))));
     g.fillStyle="rgba("+p.c+",1)";g.fillRect(-p.w/2,-p.h/2,p.w,p.h);g.restore();});
    if(t<2.3)requestAnimationFrame(fr);else{cv.remove();window.__hmFx=Math.max(0,(window.__hmFx||1)-1);}})(performance.now());}catch(_){window.__hmFx=Math.max(0,(window.__hmFx||1)-1);}}
  function syncSoccerArena(){
   if(window.PlayViewportOwner)window.PlayViewportOwner.enter("soccer");
   document.body.classList.add("hmSoccer");
   void hero.offsetHeight;
   try{dispatchEvent(new Event("resize"));}catch(_){}
   geo();
  }
  function start(){if(S.on)return;_gyLock=null;
   /* THE MODE IS READ ONCE, HERE, AND NOWHERE ELSE. A flag sampled per frame is a flag that
      can change mid-match; the launcher sets __hmYowLeague before it calls this and the
      match is that mode from kickoff to whistle. The body class goes on BEFORE the arena is
      synced so geo()/layout() measure against the stylesheet that is actually going to paint. */
   YOW=!!window.__hmYowLeague;S.yow=YOW;
   try{document.body.classList.toggle("hmYow",YOW);}catch(_){}
   syncSoccerArena();if(!ball)dom();layout();teams();
   /* THE MATCH GETS LONGER AS THE CUP GETS SHORTER. Every fixture was first-to-5 with
      win-by-two, so eight players meant seven matches of identical length and the whole thing
      dragged -- and the final felt exactly like a quarter-final. Early rounds are first to 3
      now, semis 4, the final 5. That is the sourced move twice over: it condenses the
      tournament AND it is how a grand final is actually differentiated (CS Majors, VALORANT
      Champions and TI all step the final up from Bo3 to Bo5). A standalone kickabout with no
      tournament running keeps the old first-to-5. */
   (function(){ var t=5,c=8;
     try{ var T=window.__hmTour;
       if(T&&T.live&&T.br&&T.cur){
         var left=(T.br.rounds.length-1)-T.cur.round;   // 0 = the final
         t=(left<=0)?5:(left===1?4:3);
       }
     }catch(_){}
     /* cap = target+2, not +3. Win-by-two is what makes a close match worth watching, but at
        +3 a first-to-3 could grind to 6-5 -- one measured fixture took 69s against a 16s
        median. Two points of deuce keeps the drama and cuts the tail. */
     S.target=t; S.cap=t+2;
   })();
   S.on=true;S.red=0;S.blue=0;S.winner=0;S.touches=[];if(board)board.classList.remove("won");S.seed=(S.seed||0)+1;
   paintBoard();board2();   // repaint the teams BEFORE the score, or board2 writes into rows that are about to be replaced
   ballInTitle(false);ball.style.opacity="1";goalL.style.opacity="1";goalR.style.opacity="1";board.style.opacity="1";if(ballShadow)ballShadow.style.opacity="0.28";if(goalShL){goalShL.style.opacity="1";goalShR.style.opacity="1";}
   kickoffCountdown();
   if(!running){running=true;requestAnimationFrame(loop);}}
  window.__hmSoccerStart=start;window.__hmSoccerEnd=finish;
  function netCatch(team){if(S.phase!=="play")return;S.phase="scoring";scoreTeam=team;
   goalBurst(team,bx,by);   // BANG -- it explodes the instant it crosses the line
   ball.style.opacity="0";if(ballShadow)ballShadow.style.opacity="0";bvx=0;bvy=0;bw=0;ballInTitle(true);   // and it's gone, never spinning around inside the net
   var g=team===1?goalR:goalL;g.classList.remove("hmGoalHit");void g.offsetWidth;g.classList.add("hmGoalHit");
   setTimeout(function(){if(S.on&&S.phase==="scoring")goalIn(team);},240);}
  function bigCall(txt,ms){try{if(!countEl)return;countEl.classList.add("hmMsg");countEl.textContent=txt;countEl.classList.remove("hmCountPulse");void countEl.offsetWidth;countEl.classList.add("hmCountPulse");setTimeout(function(){if(countEl.textContent===txt){countEl.textContent="";countEl.classList.remove("hmMsg");}},ms||1800);}catch(_){}}
  /* What is actually true about the next goal, given win-by-two with a hard cap.
     leaderWins: the team in front scoring ends it. eitherWins: BOTH are one goal from
     ending it, which is the only honest "next goal wins". */
  /* THE HAND-OVER. The trophy lifts off the scoreboard and flies to the winner, then rides
     with them for the rest of the celebration. Offset to the SIDE of the head, never over it:
     the face is the subject and the brow and eye region are the part worth never covering.
     Tracked per frame like the spotlight, because the winner is still being simulated -- a
     trophy parked where they stood at the whistle is left behind by the first hop. */
  function handTrophy(p){
    var src=board&&board.querySelector(".sbTrophy"); if(!src||!p||!p.root)return;
    var from=src.getBoundingClientRect(); if(!from.width)return;
    var fly=document.createElement("img");
    fly.className="hmTrophyFly"; fly.src=src.getAttribute("src");
    fly.alt=""; fly.draggable=false; fly.setAttribute("aria-hidden","true");
    fly.style.width=Math.round(from.width)+"px";
    document.body.appendChild(fly);
    src.style.visibility="hidden";               // it has LEFT the board, not been duplicated
    var x0=from.left, y0=from.top, t0=null, DUR=780, alive=true;
    function target(){
      var r=p.root.getBoundingClientRect();
      return {x:r.left+r.width*0.78, y:r.top+r.height*0.30};   // beside the head, not over it
    }
    (function step(now){
      if(!alive)return;
      if(t0===null)t0=now;
      var t=Math.min(1,(now-t0)/DUR), g=target();
      if(t<1){
        var e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,
            arc=Math.sin(t*Math.PI)*46;          // lobbed across, not slid
        fly.style.left=Math.round(x0+(g.x-x0)*e)+"px";
        fly.style.top =Math.round(y0+(g.y-y0)*e-arc)+"px";
      }else{
        fly.style.left=Math.round(g.x)+"px";
        fly.style.top =Math.round(g.y)+"px";
      }
      requestAnimationFrame(step);
    })(performance.now());
    setTimeout(function(){ alive=false;
      try{fly.remove();}catch(_){}
      if(src)src.style.visibility="";
    },7400);
  }
  function goalCall(){
    var mx=Math.max(S.red,S.blue), mn=Math.min(S.red,S.blue), df=mx-mn;
    var ends=function(a,b){ return (a>=S.target && a-b>=2) || a>=S.cap; };
    var leaderWins = ends(mx+1, mn), eitherWins = leaderWins && ends(mn+1, mx);
    if (eitherWins)          return {t:"next goal wins!", ms:2200};
    if (df===0 && mx>=S.target-1) return {t:"deuce!", ms:1600};
    if (leaderWins && df>0)  return {t:"match point\u2026", ms:1500};
    return null;
  }
  function goalIn(team){if(team===1)S.red++;else S.blue++;S.goalSeed=(S.goalSeed||0)+1;S.goalTeam=team;board2();
   BUS.emit('goal',{team:team,red:S.red,blue:S.blue,scorer:(S.touches&&S.touches.length?S.touches[0].slot:null)});
   try{if(window.__hmTourGoal)window.__hmTourGoal(team,(S.touches||[]).slice());}catch(_){}   // hand the touch log to the tournament: last toucher scored, the one before assisted
   S.touches=[];


   try{var _gp=(team===1?(flapR&&flapR.el):(flapB&&flapB.el));if(_gp){_gp.style.transition="none";_gp.style.transform="scale(1.55)";void _gp.offsetWidth;_gp.style.transition="transform .5s cubic-bezier(.2,1.4,.3,1)";_gp.style.transform="scale(1)";_gp.style.display="inline-block";}}catch(_){}   // the scoring number POPS -- targets the flap's own element (transform-only), not the sbScore container that now just holds it
   var g=team===1?goalR:goalL;g.classList.add("hmGoalHit");setTimeout(function(){g.classList.remove("hmGoalHit");},650);
   /* The board lights up in the scorer's colour. Reads the same source the pitch does, so a
      "Green vs Sky" tie flashes green, not a hardcoded red. */
   try{if(board){board.style.setProperty("--sbFlash",teamRGB(team));board.classList.remove("sbHit");
     void board.offsetWidth;board.classList.add("sbHit");
     setTimeout(function(){if(board)board.classList.remove("sbHit");},900);}}catch(_){}
   try{if(typeof busyNow==="function"&&!busyNow()){setHold("smile",1100);showFace("smile");if(typeof browFlash==="function")browFlash();}}catch(_){}
   var _mx=Math.max(S.red,S.blue),_df=Math.abs(S.red-S.blue);
   if((_mx>=S.target&&_df>=2)||_mx>=S.cap){win(team);return;}   // WIN BY TWO (hard cap S.cap): a 5-4 isn't over -- the great matches go to deuce
   /* AFTER the win check, never before. Scheduling this first meant the winning goal queued
      "match point..." and then won the match, so the shout landed 1.3s into the celebration
      announcing a point that had already been played. The shout is derived from the win
      condition rather than hardcoded to a scoreline -- it used to claim "next goal wins!" at
      4-4, which is untrue under win-by-two. */
   (function(){var c=goalCall();if(c)setTimeout(function(){if(S.on&&!S.winner)bigCall(c.t,c.ms);},1300);})();

   S.phase="reset";bvx=0;bvy=0;setTimeout(function(){if(S.on){ballInTitle(false);ball.style.opacity="1";if(ballShadow)ballShadow.style.opacity="0.28";dropIn();}},700);}   // otherwise it re-appears for the next kickoff
  function win(team){BUS.emit('fulltime',{winner:team,red:S.red,blue:S.blue});S.winner=team;S.phase="win";board2();if(board)board.classList.add("won");
   /* THE CELEBRATION. They do not just hop where they stand -- they RUN TO EACH OTHER first,
      the way a team does after a goal, and only bounce together once they have gathered.
      The centroid is recomputed every round rather than fixed at the whistle, because the
      heads are still being simulated and a target set once would be stale by the second hop.
      Within ~70px of the pack a head stops converging and bounces on the spot, so they
      celebrate together instead of piling into one point and shoving each other out. */
   try{
     var _mates=[];
     for(var _c=0;_c<peers.length;_c++){ var _p=peers[_c];
       if(_p&&S.teams[_p.slot]===team&&typeof _p.cheer==="function") _mates.push(_p); }
     if(_mates.length){
       var _round=function(){
         if(!S.on)return;
         var cx=0; _mates.forEach(function(p){cx+=p.x+p.HW/2;}); cx/=_mates.length;
         _mates.forEach(function(p,k){
           setTimeout(function(){ try{
             if(!S.on)return;
             var d=cx-(p.x+p.HW/2), near=Math.abs(d)<90;
             if(near){
               /* Gathered. Now they go UP -- roughly every third beat is a full flip, and
                  otherwise they pick a team-mate and jump at them. Standing still and
                  bouncing was not excitement, it was idling in place. */
               if(Math.random()<0.34){ p.cheer(Math.random()<0.5?-1:1, 0.2, true); }
               else{
                 var mate=_mates.length>1
                   ? _mates[(Math.random()*_mates.length)|0] : null;
                 var md=(mate&&mate!==p) ? (mate.x+mate.HW/2)-(p.x+p.HW/2) : 0;
                 p.cheer(md===0?(Math.random()<0.5?-1:1):(md>0?1:-1),
                         md===0?0.15:0.55, Math.random()<0.25);
               }
             }else{
               p.cheer(d>0?1:-1, 1);
             }
           }catch(_){} }, k*95);   // staggered, so they are a crowd and not a chorus line
         });
       };
       for(var _r=0;_r<6;_r++) setTimeout(_round, 300+_r*620);
     }
   }catch(_){}
   /* The disco is saved for the CHAMPIONSHIP. An ordinary goal keeps the board flash; only
      winning the final earns the dark, the ball and the spotlight -- and the spotlight lands
      on the head that won it, not on the big head. */
   try{ if(document.body.classList.contains("hmFinal")){
     var _bw=null;
     for(var _i=0;_i<peers.length;_i++){var _p=peers[_i];
       if(!_p||S.teams[_p.slot]!==team)continue;
       if(!_bw)_bw=_p;
       if(_p.slot<9000&&!_p.__filler){_bw=_p;break;}}
     if(_bw&&_bw.root) handTrophy(_bw);
     if(_bw&&_bw.root&&window.__hmPartyAt)
       /* Ends well before the bracket moves on (10.5s for a final) so the light is fully out
          before the champion screen arrives -- carrying it across the cut looked wrong. */
       window.__hmPartyAt(function(){return _bw.root.getBoundingClientRect();},5200);
   } }catch(_){}
   // Name the winner BEFORE the hook runs: __hmTourWin clears T.cur synchronously, and the call
   // itself is announced 850ms later, by which point there is no fixture left to read from.
   var _wname=(team===1?"Red":"Blue")+" wins!";
   try{var _T=window.__hmTour;if(_T&&_T.live&&_T.cur){var _tm=(team===1?_T.cur.a:_T.cur.b);if(_tm)_wname=_tm.name+" win";}}catch(_){}
   try{if(window.__hmTourWin)window.__hmTourWin(team,S.red,S.blue);}catch(_){}   // the SCORE travels with the result, so the schedule can show it later   // "First to 5" and End are moot once it is decided
   
   try{winConfetti(team);}catch(_){}
   try{if(typeof busyNow==="function"&&!busyNow()){setHold("smile",2600);showFace("smile");refFlash();}}catch(_){}
   setTimeout(function(){if(S.on&&S.phase==="win"&&countEl){countEl.classList.add("hmMsg");countEl.textContent=_wname;countEl.classList.remove("hmCountPulse");void countEl.offsetWidth;countEl.classList.add("hmCountPulse");}},850);   // let the final goal land first -- the call comes a beat later
   setTimeout(function(){if(countEl){countEl.textContent="";countEl.classList.remove("hmMsg");}},4600);
   setTimeout(finish,5400);}
  function winConfetti(team){try{   // ONE full celebration canvas, capped like the rest
   if((window.__hmFx||0)>=1)return;window.__hmFx=(window.__hmFx||0)+1;
   var cv=document.createElement("canvas"),hr=hero.getBoundingClientRect();cv.width=innerWidth;cv.height=Math.round(hr.height);
   cv.style.cssText="position:fixed;left:0;top:"+hr.top.toFixed(0)+"px;width:100vw;height:"+hr.height.toFixed(0)+"px;pointer-events:none;z-index:62";document.body.appendChild(cv);
   /* The WINNER's colour, not a generic rainbow -- a Green vs Sky final showering red and
      yellow said nothing about who had just won. Shaded lighter and darker around the base so
      it still reads as confetti rather than one flat swatch. */
   var g=cv.getContext("2d"),cols=(function(){
     var base=String(teamRGB(team)).split(",").map(function(n){return parseInt(n,10)||0;});
     return [-0.3,-0.14,0,0.18,0.36].map(function(k){
       return "rgb("+base.map(function(c){
         return Math.max(0,Math.min(255,Math.round(k<0?c*(1+k):c+(255-c)*k)));}).join(",")+")";});
   })(),P=[];
   for(var i=0;i<210;i++)P.push({x:Math.random()*innerWidth,y:-20-Math.random()*260,vy:190+Math.random()*210,ph:Math.random()*6.28,sw:22+Math.random()*34,fq:1.4+Math.random()*1.9,w:6+Math.random()*4,h:3+Math.random()*3,c:cols[(Math.random()*cols.length)|0],rv:3+Math.random()*5});
   var t=0,l=performance.now();
   (function fr(n){var d=Math.min(0.05,(n-l)/1000);l=n;t+=d;g.clearRect(0,0,cv.width,cv.height);
    var al=t<3?1:Math.max(0,1-(t-3)/0.7);g.globalAlpha=al;
    P.forEach(function(p){p.y+=p.vy*d;var px=p.x+Math.sin(t*p.fq+p.ph)*p.sw;
     g.save();g.translate(px,p.y);g.rotate(Math.sin(t*p.rv+p.ph));g.scale(1,Math.max(0.15,Math.abs(Math.cos(t*p.rv*1.3+p.ph))));
     g.fillStyle=p.c;g.fillRect(-p.w/2,-p.h/2,p.w,p.h);g.restore();});
    if(t<3.8)requestAnimationFrame(fr);else{cv.remove();window.__hmFx=Math.max(0,(window.__hmFx||1)-1);}})(performance.now());}catch(_){window.__hmFx=Math.max(0,(window.__hmFx||1)-1);}}
  function finish(){S.on=false;S.phase="idle";S.winner=0;
  try{if(window.__hmTourAbort)window.__hmTourAbort();}catch(_){}   // hand the draw back, do not strand it
 
   if(ball){_gyLock=null;ballInTitle(true);ball.style.opacity="0";goalL.style.opacity="0";goalR.style.opacity="0";board.style.opacity="0";if(ballShadow)ballShadow.style.opacity="0";if(goalShL){goalShL.style.opacity="0";goalShR.style.opacity="0";}}
   if(countEl)countEl.textContent="";document.body.classList.remove("hmSoccer");
   /* The League comes off at the whistle for the same reason hmFinal does, three lines
      below: playing a bracket out to a champion never calls stop(), so a class left on
      would hand the next casual kickabout a football and a set of uprights. */
   YOW=false;S.yow=false;document.body.classList.remove("hmYow");
   /* The gold must not outlive the final. Clearing it only in stop() was not enough: playing
      the bracket out to a champion never calls stop(), so the class stuck and the next casual
      kickabout got the final's ball. Every match ends here, so this is the one honest place. */
   document.body.classList.remove("hmFinal");
   try{if(window.__hmFX)window.__hmFX.clear();}catch(_){}
   try{if(window.__hmGoalL3Teardown)window.__hmGoalL3Teardown();}catch(_){}
   if(window.PlayViewportOwner)window.PlayViewportOwner.leave("soccer");}   // THE GOAL GRAMMAR: a goal scored just before the match ended must not leave its lower-third floating over the emptied stage
  var spin=0,bw=0,gaspAt=0;   // spin = rendered rotation, bw = angular velocity (deg/s)
  function loop(now){if(!S.on){running=false;return;}requestAnimationFrame(loop);
   var dt=Math.min(0.05,Math.max(0.006,(now-last)/1000));last=now;
   dt*=(window.__hmSlow||1);   // broadcast slow-mo: the WORLD slows (ball physics), DOM/CSS animations elsewhere keep normal speed
   if(window.__hmFreeze&&now<window.__hmFreeze)dt=0;   // IMPACT FRAME (hitstop): the ball freezes exactly like the heads already do at line ~5320 -- same global, same convention
   var _fell=(S.phase!=="count"&&(_spawnY==null||by-_spawnY>BR*1.1));
    if(_fell)bsp+=(1-bsp)*Math.min(1,dt*7);
    if(board&&_fell&&board.classList.contains("ballOut")&&!board.classList.contains("ballFell"))board.classList.add("ballFell");
    geo();   // grow only once it has FALLEN clear of the headline. Gating on the countdown alone was not
    // enough: the ball still scaled up in place the instant play began, straight through "Soccer".
       // hold the ball at the TITLE size through the countdown -- the physics is frozen then, so a ball that grew immediately just sat at full size on top of the word. It resizes as it drops, not before.
    if(Math.abs(groundY-_lastGY)>1||W!==_lastGW){_lastGY=groundY;_lastGW=W;layout();}   // ...and so can the pitch WIDTH (a window resize), which moves XL/XR and re-derives the planet's arc -- geo() already recomputes W every frame, layout() just never watched it   // the ground plane can MOVE mid-match now (entering/leaving the full-screen phone arena) -- goals are positioned in layout(), which only ran at start(), so they used to stay behind on the old pitch line
    
   var REST=groundY-BR,GRAV=2600;   // gravity is uniform: the ball falls at exactly the heads' g (was a wrong 2400 vs their 2600). REST = ball CENTRE at rest, underside on the pitch
   if(S.phase==="scoring"){   // the net has the ball: it decelerates and settles
    bvy+=GRAV*dt;bvx*=Math.pow(0.006,dt);bvy*=Math.pow(0.03,dt);bx+=bvx*dt;by+=bvy*dt;
    if(by>REST){by=REST;bvy=0;}
    if(bx<XL+BR-3)bx=XL+BR-3;if(bx>XR-BR+3)bx=XR-BR+3;
   }
   if(S.phase==="play"){
    bvy+=GRAV*dt;
    /* KICKOFF FAIRNESS. The curve used to be solved for the speed that ARRIVES at the centre
       spot -- so the ball reached the middle still carrying it. The scoreboard ball sits 64px
       RIGHT of the pitch centre, so every kickoff drifted LEFT at a measured 80-99px/s and
       handed the right-hand side a free push at the left goal. Now it decelerates over the
       fall and arrives at REST: constant a, v0=2dx/t, a=-v0/t covers dx in exactly t. */
    if(_cvOn){bvx+=_cvA*dt;if(_cvS>0?(bvx<0):(bvx>0)){bvx=0;_cvOn=false;}}
    else bvx*=Math.pow(0.78,dt);   // light aerodynamic drag: a struck ball keeps its momentum across the pitch
    if(_curving&&(_spawnY==null||by-_spawnY>BR*1.4)){_curving=false;   // THE CURVE, solved ballistically
     // instead of steered, and held until the ball has DROPPED CLEAR of the headline -- bending it
     // in on the very first frame of play started the leftward move while it was still level with
     // the text, grazing it by 3.2px. Because the solve uses the CURRENT height, waiting costs
     // nothing: it just gets a slightly faster lateral speed over the remaining fall. A
     // proportional nudge was far too weak -- it closed 4px of a 64.6px gap before the first head
     // reached the ball. Give it the horizontal speed that ARRIVES at the centre spot exactly as
     // it lands, and gravity draws the arc for free. The ball still leaves the title where it
     // sits, so the wordmark never has to move, and the kickoff is still fair.
     var _dy=Math.max(0,REST-by),
         _tf=Math.max(0.04,(-bvy+Math.sqrt(Math.max(0,bvy*bvy+2*GRAV*_dy)))/GRAV),
         _dx=_curveTo-bx;
     bvx=2*_dx/_tf;_cvA=-bvx/_tf;_cvS=bvx>=0?1:-1;_cvOn=Math.abs(_dx)>0.5;}   // no drag fudge needed: the solve is exact
    bx+=bvx*dt;by+=bvy*dt;
    var sp=Math.abs(bvx);
    if(sp>900 && performance.now()-lastShot>1000){
     var dir=bvx>0?1:-1, gx=dir>0?XR:XL;
     if(Math.abs(gx-bx)<300){lastShot=performance.now();BUS.emit('shot',{dir:dir});}
    }
    if(by>REST){   // meets the pitch
     if(Math.abs(bvy)>50){var kg=Math.min(0.14,Math.abs(bvy)*0.00016);bsyP=1-kg;bsxP=1/(1-kg);bsT=0.12;bvy=-bvy*0.72;
      /* A SPIN-FED BOUNCE WAS BUILT HERE AND TAKEN BACK OUT, AND THE DESIGN SPEC AGREES IT SHOULD
         BE. It read `var _surf=bw*(Math.PI/180)*BR; bvx+=(_surf-bvx)*0.16; bw*=0.82;` -- friction at
         the contact driving the ball's horizontal speed toward the no-slip value its spin implies,
         so a headed ball with backspin checks and kicks back. It is a real mechanism and the right
         one eventually; the spec names it (SS8.4) and explicitly places it OUT of scope for this pass.
         Measured, it also pushes the wrong way on the one thing this pass exists to move: with it,
         the ball spent 45.0% of frames on the deck against 28.8% without, on otherwise identical
         builds. It bleeds horizontal energy on every bounce, and a slower ball settles sooner.
         Shipping it would have been a new physical mechanism arriving unmeasured alongside two
         changes that ARE measured. It is a good next lever, on its own, with its own numbers. */
      }else bvy=0;   // squash + bounce, e=0.72 (grass, not a superball)
     by=REST;if(_cvOn){bvx=0;_cvOn=false;}else bvx*=0.9;}
    var onGround=by>=REST-1;
    /* ROLLING RESISTANCE IS THE CONSTANT THAT GENUINELY HAD TO SCALE, AND IT IS HORIZONTAL. The brief's
       premise was that GRAV being absolute while HW and BR shrink holds the ball down worst on a
       phone. Measured, the VERTICAL axis inverts that: a fixed launch speed under fixed g gives a
       fixed 204px apex everywhere, and dividing by a SMALLER head makes the leap relatively bigger at
       390 (2.66 head-heights vs 1.57 at 1440). Scaling GRAV down on mobile would make it float.
       The pitch, though, shrinks 3.7x while the heads shrink only 1.7x -- so mu_r*g, an absolute
       deceleration, stops the ball after 0.64 pitch-widths at 1440 and 2.37 pitch-widths at 390. The
       ball never settles anywhere on a phone but inside a body. Scaling mu_r by the pitch makes the
       ball come to rest in the same FRACTION of the pitch at every width, which is the scale
       correction the brief was reaching for, applied on the axis that actually measured broken.
       At 1440 the factor is exactly 1, so desktop rolling is byte-for-byte what it was. */
    var _MUR=0.075*(1440/Math.max(320,XR-XL));
    if(onGround&&Math.abs(bvy)<70){var rf=Math.min(Math.abs(bvx),_MUR*GRAV*dt);bvx-=(bvx>0?1:-1)*rf;}   // rolling resistance as a CONSTANT deceleration (mu_r*g, mu_r~0.075 for grass), not a made-up exponential -- the ball rolls, then slows honestly
    if(onGround&&Math.abs(bvx)<9&&Math.abs(bvy)<12){bvx=0;bvy=0;}   // and it settles fully -- no hover, no jitter
    if(onGround)_deckT+=dt;else if(by<REST-BR*0.6)_deckT=0;   // airborne by more than a ball-radius clears it;
    // a bobble of a few px on the bounce does NOT, or the timer would reset on every little hop and never fire
    /* THE CONFINEMENT POP -- see the CONF_MAX note above for the measurement that put it here.
       The anchor is a single point rather than a ring buffer: the ball either escapes the
       circle, which re-anchors and clears the clock, or it does not, which is the whole
       finding. O(1) per frame, no allocation.
       The radius is BR*3, so it scales with the ball and therefore with the heads -- 72px at
       1440 where a head is 96 wide, 48px at 390 where a head is 64. A circle smaller than one
       head means "the ball has not got past the body in front of it". */
    var _cfR=BR*3;
    if(Math.abs(bx-_cfx)>_cfR||Math.abs(by-_cfy)>_cfR){_cfx=bx;_cfy=by;_cfT=0;}
    else _cfT+=dt;
    if(_cfT>CONF_MAX){
     _cfT=0;_cfx=bx;_cfy=by;_deckT=0;_cfPops++;
     /* OUT AND UP. The vertical component is the larger one deliberately: it has to clear the
        heads standing over it, and a ball that leaves flat just arrives at the next body.
        ~230-290px of rise at GRAV 2600 (v^2/2g), which is two to three head-heights. */
     bvy=-(1090+Math.random()*140);
     /* AND OUT OF THE CIRCLE, toward whichever side of the pitch has more room -- which is
        geometry, not a tactic: it is where the ball is, not where anybody is standing. Aiming
        it back into the shorter side is how a pop lands straight back in the same pile, and a
        pop that re-forms the stalemate is worse than none. */
     var _mid=(XL+XR)/2,_out=(bx<_mid)?1:-1;
     bvx=_out*(360+Math.random()*300)+bvx*0.25;   // keeps a quarter of whatever it had, so the
     // escape still carries the direction play was going rather than reading as a reset
     bw+=(Math.random()*420-210);   // and it comes down spinning, so the first touch is unpredictable
     var _cfk=0.13;bsyP=1-_cfk;bsxP=1/(1-_cfk);bsT=0.14;   // the same squash a hard bounce uses
     if(WRAF9)S.cfPops=_cfPops;
    }
    if(_deckT>DECK_MAX){   // SCRAMBLE POP: too long on the floor, put it back in the air
     _deckT=0;
     bvy=-(860+Math.random()*180);   // ~150-215px of clearance at GRAV 2600 (v^2/2g) -- over the heads, not silly
     var _dir=bvx>=0?1:-1;if(Math.abs(bvx)<1)_dir=Math.random()<0.5?-1:1;
     bvx=_dir*Math.max(150,Math.abs(bvx)*0.85);   // keeps whatever direction play was going, so it reads as
     // the ball squirting out of a scramble rather than teleporting
     bw+=(Math.random()*260-130);   // a little spin off the pile
     var _kp=0.11;bsyP=1-_kp;bsxP=1/(1-_kp);bsT=0.13;   // the same squash a hard bounce uses. No
     // particle here on purpose: the soccer module never draws FX (it only calls __hmFX.clear), and
     // its ball coords are engine-space, not the viewport space burst() wants.
    }
    /* THE ROOF. Asked for directly -- "make it feel like a game bouncing off the walls and roofs" --
       and the honest answer to "does the arena have a ceiling to rebound off" is YES, at the top of
       the arena, and it already rebounded at e=0.72. Measured on this build the ball reaches it 13-24
       frames a run, so it is live, not theoretical. What it LACKED was consequence: it returned the
       ball on exactly the line it arrived on, so a roof hit was invisible and cost the play nothing.
       No new surface is invented here and nothing is drawn. Putting an invisible lid halfway up the
       open arena was considered and rejected -- a ball rebounding off empty air reads as a glitch,
       which is the one reading this page keeps refusing. The boundary stays where the arena's edge
       actually is; it simply now behaves like a surface instead of a clamp: it throws the ball off
       line, spins it, and broadcasts the same 'woodwork' moment the crossbar does, so every head
       within 220px clutches its brows and the near-miss is legible rather than silent. */
    if(by<BR+2){by=BR+2;if(Math.abs(bvy)>120){var kc0=Math.min(0.1,Math.abs(bvy)*0.00012);bsyP=1-kc0;bsxP=1/(1-kc0);bsT=0.11;}
     if(Math.abs(bvy)>240){bvx+=(Math.random()<0.5?-1:1)*(90+Math.random()*90);bw+=(Math.random()*220-110);   // it comes down somewhere new, and spinning
      S.postSeed=(S.postSeed||0)+1;try{BUS.emit('woodwork',{x:S.ball.x,y:S.ball.y});}catch(_){}}
     bvy=Math.abs(bvy)*0.72;bvx=Math.max(-2200,Math.min(2200,bvx));}   // ceiling
    var inG,gt,overL,overR;
    if(YOW){
     /* ===== SCORING, INVERTED. THIS IS THE WHOLE MODE. =====
        `inG` is the only thing the two wall tests below ask, and in soccer it means "the
        ball is in the mouth". Here it means "the ball went through the uprights": above the
        crossbar, below the tops of the posts, and travelling. Everything downstream --
        netCatch, the burst, the scoreboard, the celebration, the tournament's result -- is
        untouched, because the question it answers has the same shape.

        A ball that reaches the wall UNDER the bar is a drive that never got up. A ball over
        the post tops is wide. Both were goals in soccer and neither is one here, which is
        why this reads as football rather than as soccer with a repaint.

        AND IT HAS TO BE KICKED THROUGH, NOT DRIFT THROUGH. Height alone made this a
        score-fest -- measured, 9.0 goals/min against soccer's 3.3 -- and the reason was the
        ball CLIMBING THE WALL FACE: once the bar stopped being solid from underneath (see
        below) a ball popped up in a corner rose through the aperture at |bvx| near zero and
        counted. A field goal is a KICK through the plane, so the plane asks for one. YKICK
        is a seventh of the ball\'s own speed cap and roughly what a single head\'s contact
        imparts, so a struck ball clears it and a wall-hugger does not. This is not
        difficulty bolted on after the fact -- it is the missing half of "through the
        posts". */
     overL=(bx+BR>XL&&bx-BR<XL+UPW);overR=(bx+BR>XR-UPW&&bx-BR<XR);
     gt=groundY-UCB;                                    // the crossbar\'s plane
     inG=(by<gt)&&(by>gt-UPH)&&(Math.abs(bvx)>YKICK);   // over the bar, under the tops, and going somewhere
     /* THE DOINK, FROM ABOVE ONLY -- AND THAT IS MEASURED, NOT LAZY. It was solid on both
        faces for one build and the underside was a TRAP: the confinement pop (CONF_MAX,
        ~1090px/s straight up) is the engine\'s own way out of a scrum, and within UPW of the
        wall it fired the ball into the bar\'s underside, which knocked it back down into the
        same scrum, which popped it again. Measured against soccer over four matches each,
        the ball inside one 70px circle went 4.3% -> 13.7% of play and the worst episode
        3.15s -> 4.88s, with all four of the worst at 1-3% and 99% across the pitch, 13-19%
        up -- the foot of the wall, directly under the bar. That is the exact defect 668ad73
        was written to remove, re-created by one line of mine, so the line came out.

        What is left is not a compromise. A ball rising inside the posts\' own footprint is a
        ball going UP THROUGH THE UPRIGHTS -- the escape valve and the objective turn out to
        be the same event, which is why the mode is named after it. It broadcasts the same
        \'woodwork\' the soccer bar does, so every head within 220px clutches its brows; no
        new event, no new reaction. */
     if((overL||overR)&&bvy>0&&by+BR>=gt-2&&by-BR<gt&&by<gt){by=gt-BR-2;bvy=-Math.max(160,Math.abs(bvy)*0.7);S.postSeed=(S.postSeed||0)+1;BUS.emit('woodwork',{x:S.ball.x,y:S.ball.y});
      bvx+=(overL?1:-1)*(150+Math.random()*70);bvx=Math.max(-2200,Math.min(2200,bvx));
      var kcU=Math.min(0.1,Math.abs(bvy)*0.00015);bsyP=1-kcU;bsxP=1/(1-kcU);bsT=0.11;}
    }else{
    inG=by>groundY-GH;
    gt=groundY-GH;overL=(bx+BR>XL&&bx-BR<XL+44);overR=(bx+BR>XR-44&&bx-BR<XR);   // the crossbar
    if((overL||overR)&&bvy>0&&by+BR>=gt-2&&by-BR<gt&&by<gt){by=gt-BR-2;bvy=-Math.max(160,Math.abs(bvy)*0.7);S.postSeed=(S.postSeed||0)+1;BUS.emit('woodwork',{x:S.ball.x,y:S.ball.y});   // off the bar -- and the WOODWORK moment is broadcast so the heads can feel it
     bvx+=(overL?1:-1)*(150+Math.random()*70);bvx=Math.max(-2200,Math.min(2200,bvx));
     var kc1=Math.min(0.1,Math.abs(bvy)*0.00015);bsyP=1-kc1;bsxP=1/(1-kc1);bsT=0.11;}
    }
    /* ===== THE FOOT OF THE UPRIGHT IS A KICKER, AND IT IS WHY THE CORNER IS NOT A GRAVE =====
       Soccer\'s end wall does not have this problem, because in soccer the low band at the
       wall IS the goal: the ball crosses it and leaves play. The League scores overhead, so
       the whole bottom of that wall is dead surface, and a scrum that arrives there has
       nowhere to send the ball -- measured, the ball sat inside one 70px circle 6.2% of play
       with a 5.13s worst episode, all four of the worst at 2% and 98% across the pitch.

       The fix is at the SURFACE rather than in anybody\'s head: below the bar the wall is the
       padded base of the goalpost, and a ball driven into it comes off UP and BACK. It is a
       ramp, not a plane. Purely the ball\'s own contact -- nothing is told to disperse, no
       head is moved, no leash is touched -- and the pile follows the ball out, which is the
       distinction this file already draws between chaos that resolves and chaos that stops.
       It also turns the corner from the worst place on the pitch into the most useful: what
       comes off the base is a high ball back into the field, which is exactly what somebody
       then has to strike at the posts. ===== */
    if(bx<XL+BR){if(inG)return netCatch(2);bx=XL+BR;
     if(YOW&&by>gt&&bvx<-90){bvy=-Math.max(430,Math.abs(bvx)*0.6);bw+=(Math.random()*300-150);}if(Math.abs(bvx)>120){var kw=Math.min(0.12,Math.abs(bvx)*0.00014);bsxP=1-kw;bsyP=1/(1-kw);bsT=0.12;}bvx=Math.abs(bvx)*0.82;bw=-bw*0.6;}   // wall reverses the spin too
    if(bx>XR-BR){if(inG)return netCatch(1);bx=XR-BR;
     if(YOW&&by>gt&&bvx>90){bvy=-Math.max(430,Math.abs(bvx)*0.6);bw+=(Math.random()*300-150);}   /* the mirror of the left base -- see its note */ if(Math.abs(bvx)>120){var kw2=Math.min(0.12,Math.abs(bvx)*0.00014);bsxP=1-kw2;bsyP=1/(1-kw2);bsT=0.12;}bvx=-Math.abs(bvx)*0.82;bw=-bw*0.6;}
    for(var pi=0;pi<peers.length;pi++){var p=peers[pi];if(p.elim||p.__bench)continue;   // heads bounce the ball with their BODY -- pure elastic momentum, the same collision they use on each other
     var hx=p.x+p.HW/2,hy=p.y+p.HH*0.55,dx=bx-hx,dy=by-hy,d=Math.hypot(dx,dy),rr=p.HW*0.5+BR;
     if(d>0.1&&d<rr){var nx=dx/d,ny=dy/d,ov=rr-d;
      /* ===== THE BALL SQUIRTS OUT FROM UNDER A BODY. THIS IS THE WEDGE. =====
         Measured with tools/soccer-flow-probe.py, which cranks the clock and samples every
         frame: over 38 minutes of simulated play the ball spent 46.4% of it inside a single
         70px circle, and the worst episode ran 58.45 SECONDS. Dumping the frames of one of
         them showed the mechanism exactly, and it is not what "the ball is slow" suggests:

           by = 477.3 on every single frame, and REST is 477.3
           heads directly above the ball, mean 3.02
           |bvx| mean 152, max 1252 -- it is being struck hard and constantly

         THE BALL IS BURIED. Three heads stand on top of it, this resolution pushes it DOWN
         along their normals, the pitch stops it, and the clamp forty lines below puts it back
         on REST. Every frame. It is struck at 1250px/s and does not move, because the only
         direction the contact will give it is into the floor.

         AND THE VERTICAL COMPONENT IS SIMPLY DISCARDED WHEN THAT HAPPENS, which is the actual
         defect: a resolution that cannot be applied is not a resolution, and the overlap it was
         supposed to clear is still there on the next frame, forever.

         So when the floor blocks it, the blocked component goes SIDEWAYS instead of being
         thrown away -- which is both correct contact resolution against a constrained axis and
         what a ball squeezed between the ground and a body actually does. It is pure ball
         physics: no head is told anything, nobody is moved, nobody is spaced out, and the pile
         is not asked to disperse. The pile stays exactly where it is; the ball stops being
         underneath it.

         A HEAD DEAD OVERHEAD HAS NO SIDE, so it takes the one with more pitch on it. That is
         geometry off the ball's own position, not a tactic -- nothing here reads where anybody
         is standing. */
      var _pX=nx*ov,_pY=ny*ov;
      if(_pY>0&&by>=REST-1){
       var _sx=(nx>0.2)?1:((nx<-0.2)?-1:((bx<(XL+XR)/2)?1:-1));
       bx+=_sx*_pY;   // the blocked half of the push, turned through ninety degrees
       /* and it LEAVES, rather than being walked out a pixel at a time. Without a velocity
          term the ball is merely repositioned and the same three bodies close over it on the
          next frame; the displacement is what frees it and this is what gets it clear. Scaled
          by the overlap, so a graze costs nothing and being properly sat on fires it out. */
       bvx+=_sx*Math.min(520,_pY*26);
       _pY=0;
      }
      bx+=_pX;by+=_pY;   // lift the ball clear of the body so it can never sink in and stutter
      var rvx=bvx-p.vx,rvy=bvy-p.vy,rel=rvx*nx+rvy*ny;
      if(rel<0){var jI=-(1.72)*rel;   // the ball is light: it takes the whole impulse (head velocity included), the head barely feels it
       /* THE CONTACT LOFT WAS BUILT, MEASURED, AND TAKEN BACK OUT. Read this before adding one.
          The design spec's headline change (SS5.1) was to replace this 0.26 with a geometry-derived,
          state-dependent launch angle -- the Smash Bros. Sakurai angle. It was built three ways and
          every one of them failed the constraint Jayden put above everything else: "I like the
          randomness, I feel the aggression that is now, I don't want that to be ruined."

          THE NUMBER THAT KILLED IT is the CLUMPING figure: what fraction of heads sit within a ball
          radius of touching the ball at a typical moment. Measured at 1440x900, six heads, an rAF
          sampler over ~4000 frames per configuration:

            with a contact loft   6.56  6.64  6.78  7.07   (four builds: 13deg, 13deg+e.85, 30deg alone, 30deg+roof)
            without one           9.23  9.48  9.99 10.94 12.92 14.14 15.41 15.98   (eight builds)

          Twelve runs, two clean bands, no overlap: any loft on the contact costs roughly 45% of the
          scrum, and head-to-ball contact falls with it (26.2% of frames -> 17.6%). Softening the
          angle does not help -- 13deg costs the same as 30deg -- because the mechanism is not the
          magnitude. Lifting the ball on contact takes it OUT OF REACH of the pile that is fighting
          over it, and a pile with nothing to fight over disperses. The heads' rules had not changed
          by a line in any of these builds; what changed was whether the ball was still there.

          THE CONTROLS MATTER, because they say it is the loft and not the rest of this pass. The
          kickoff sign fix alone measured 10.94 -- the scrum is untouched by it. The loft alone, with
          the kickoff bug still fully present, measured 6.78. The two were separated deliberately.

          So the ball's extra airtime has to come from somewhere that does not move the ball away
          from the crowd: the ROOF now behaves like a surface (below), and restitution and a
          spin-fed bounce are the named next levers -- both are pure ball physics, both keep the ball
          in the same place horizontally while it is in the air, and neither is shipped here because
          neither is measurably an improvement yet at this sample size. 0.26 stands. */
       var lx=nx,ly=ny-0.26,ll=Math.hypot(lx,ly)||1;lx/=ll;ly/=ll;   // LOFT: a head meets the ball with a
       // slightly upward contact normal, so a duel pops the ball UP instead of firing it flat. The
       // overlap resolution above still uses the true normal -- only the impulse is lofted.
       bvx+=lx*jI;bvy+=ly*jI;p.kx-=nx*jI*0.08;p.ky-=ny*jI*0.08;   // a small honest recoil into the head
       try{var _tt=window.__hmTour;if(_tt&&_tt.live){var _tm=(S.teams&&S.teams[p.slot])||0;
        S.touches=S.touches||[];
        if(!S.touches.length||S.touches[0].slot!==p.slot)S.touches.unshift({slot:p.slot,team:_tm,t:now});
        else S.touches[0].t=now;
        if(S.touches.length>6)S.touches.length=6;}}catch(_){}   // touch log: who last played it, for assists
       bw+=(-rvx*ny+rvy*nx)*(180/Math.PI)/BR*0.5;   // an off-centre hit puts spin on it
       var kk=Math.min(0.16,Math.abs(rel)*0.00022);if(Math.abs(nx)>Math.abs(ny)){bsxP=1-kk;bsyP=1/(1-kk);}else{bsyP=1-kk;bsxP=1/(1-kk);}bsT=0.13;}}}
    if(by>REST){by=REST;if(bvy>0){bvx+=(bvx>=0?1:-1)*Math.abs(bvy)*0.3;bvy=-Math.abs(bvy)*0.62;}}   // restitution 0.4 -> 0.62 and less sideways squirt (0.5 -> 0.3): the ball keeps bouncing rather
    // than skidding away flat, which is what made play read as a ground tug-of-war   // the pitch is SOLID: a head jumping onto the ball can't drive it under -- it squeezes out (sideways + a small pop up), never through the plane
    if(by<BR+2)by=BR+2;   // and never through the ceiling either
    bvx=Math.max(-2200,Math.min(2200,bvx));bvy=Math.max(-1900,Math.min(1400,bvy));
    var nearGoal=(YOW?inG:(by>groundY-GH))&&((bx<95&&bvx<-60)||(bx>W-95&&bvx>60));   // the gasp fires at whatever "this is on target" means in this mode
    if(nearGoal&&now>(gaspAt||0)){gaspAt=now+1600;
     try{if(typeof busyNow==="function"&&!busyNow()){setHold("rest",650);showFace("rest");if(typeof browFlash==="function")browFlash();}}catch(_){}}
   }
   var grounded=by>=groundY-BR-1;   // rotation done right: on the pitch it rolls without slipping; in the air it keeps its spin
   if(grounded){var rollW=bvx*(180/Math.PI)/BR;bw+=(rollW-bw)*Math.min(1,dt*14);}
   else bw*=Math.pow(0.88,dt);
   spin+=bw*dt;
   S.ball.x=bx;S.ball.y=by;
   if(WRAF9){S.ball.vx=bvx;S.ball.vy=bvy;S.geo={W:W,H:H,XL:XL,XR:XR,GH:GH,groundY:groundY,BR:BR,OFF:OFF,yow:YOW,UCB:UCB,UPH:UPH,UPW:UPW};
    S.players=peers.map(function(q){return {slot:q.slot,team:S.teams?S.teams[q.slot]:0,
     role:S.roles?S.roles[q.slot]:"",x:q.x+q.HW/2,y:q.y+q.HH/2,hw:q.HW,hh:q.HH,elim:!!q.elim,kSat:q.__kSat|0,
     gr:!!q.ground,vy:q.vy||0};});}
   if(bsT>0)bsT-=dt;else{bsxP=1;bsyP=1;}
   var _bs=dt>0.02?Math.ceil(dt/0.02):1,_bd=dt/_bs;   // same sub-step guard for the ball, so a laggy frame can't balloon it either
   for(var _bi=0;_bi<_bs;_bi++){bsxv+=((bsxP-bsx)*1150-bsxv*62)*_bd;bsx+=bsxv*_bd;bsyv+=((bsyP-bsy)*1150-bsyv*62)*_bd;bsy+=bsyv*_bd;}
   bsx=Math.max(0.7,Math.min(1.32,bsx));bsy=Math.max(0.7,Math.min(1.32,bsy));
   var _by=0;   // the ball, goals, and companion feet render on the same published flat match plane; the planet arc remains decorative scenery only.
   var _drawHalf=BR*bsx*bsp,_drawBx=Math.max(XL+_drawHalf,Math.min(XR-_drawHalf,bx));
   if(ball){ball.style.transform="translate("+(_drawBx-BR).toFixed(1)+"px,"+(by-BR+_by).toFixed(1)+"px) scale("+(bsx*bsp).toFixed(3)+","+(bsy*bsp).toFixed(3)+")";   // container: position + squash, it never rotates; the painted squash stays inside the arena even while physics contacts the wall
    if(ballSkin)ballSkin.style.transform="rotate("+spin.toFixed(1)+"deg)";}   // only the printed pattern spins, dead-centre -- the lighting stays put
   if(ballShadow){var bBot=by+BR,airH=Math.max(0,groundY-bBot),scv=Math.max(0.4,1-airH/460);   // the shadow lives on the pitch line, dead under the ball, shrinking as it rises
    var hw9=(peers.length&&peers[0].HW)?peers[0].HW:(innerWidth<=880?64:96),shOff=hw9*0.11-2;   // sit it on the SAME line the heads' shadows use (they cast ~HW*0.11 forward of their feet), so ball and players read on one plane
    ballShadow.style.transform="translate("+(bx-BR).toFixed(1)+"px,"+((groundY+shOff)-BR*0.275+_by).toFixed(1)+"px) scale("+scv.toFixed(3)+","+scv.toFixed(3)+")";
    ballShadow.style.opacity=(S.on&&S.phase!=="idle")?String(Math.max(0.05,0.3-airH/900)):"0";}}
 })();

 /* Slow-mo for the broadcast layer: the WORLD slows, DOM animations keep normal
    speed. Ramp in, hold, ramp back; reduced-motion collapses to no-op. */
 window.__hmSlow=1;
 window.__hmSlowRamp=function(target,ms,holdMs){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var t0=performance.now();
  function step(){var t=performance.now()-t0;
   if(t<ms){window.__hmSlow=1+(target-1)*(t/ms);}
   else if(t<ms+holdMs){window.__hmSlow=target;}
   else if(t<ms+holdMs+ms){window.__hmSlow=target+(1-target)*((t-ms-holdMs)/ms);}
   else{window.__hmSlow=1;return;}
   requestAnimationFrame(step);}
  requestAnimationFrame(step);};

 /* THE GOAL GRAMMAR -- fixed order, ~3s, then play resumes:
    hit-stop 70ms -> punch-in + directional shake -> slow-mo 0.25x ~600ms
    with particles from the goal mouth -> scorer lower-third -> release.
    Routine goals in a blowout get only the hit-stop (variable intensity:
    peak-end research says spend on the peaks, not every goal equally).
    A bus subscriber, not an engine change -- goalIn() only ever emits.
    `list`/`peers` are this outer closure's own roster + companion arrays
    (declared at the top of this script, still in scope here); everything
    else crosses from the soccer sub-module or another block through the
    guarded window.__hm* globals the rest of the file already uses. */
 (function goalGrammar(){
  if(!window.__hmBus)return;
  var l3=null,l3Timer=null;
  // Slot -> {name,cut}, or null meaning "nobody nameable" -- callers then paint the TEAM name.
  // It must never invent a person, and in particular it must never answer with the visitor's own
  // head for a goal the visitor's head did not score. That is what used to happen: identity was
  // recovered by comparing the scoring peer's .cut data-URL against the saved roster, and cut
  // strings are not identities. A tournament re-encodes the art it hands to a respawn (measured
  // ~33KB against the saved 35-42KB original), and two eggheads dyed the same colour are
  // byte-identical, so the comparison either missed or matched the wrong head -- and a miss that
  // then fell through to the saved companion put "Jayden" on the card while he sat on the bench.
  //
  // The fix is to stop asking the picture. Inside a tournament the fixture itself knows who it
  // spawned into which slot (tm.slots, built in playersOf() order and keyed by a stable pid that
  // survives a respawn), so ask it, via __hmTourPlayerAt, and take no other answer. Outside a
  // tournament S.touches is never populated, so d.scorer is null and none of this runs -- the
  // peer/roster path below is kept for the one honest case it covers: a live peer whose .cut is
  // still the very same in-memory roster entry, never re-encoded.
  function scorerInfo(slot){
   if(slot==null)return null;
   try{
    // TOURNAMENT: one source of truth, and it is not the image bytes.
    var T=window.__hmTour;
    if(T&&T.live){
     var tp=window.__hmTourPlayerAt?window.__hmTourPlayerAt(slot):null;
     if(tp&&tp.name)return{name:String(tp.name).slice(0,14),cut:tp.cut||null};
     return null;   // a slot this fixture never filled, or an anonymous squad egghead that HAS no
     // name of its own: fall back to the team name, never to whoever the picture looks like.
    }
    var peer=null;
    for(var i=0;i<peers.length;i++){if(peers[i].slot===slot){peer=peers[i];break;}}
    if(!peer)return null;
    if(peer.__filler){var mj=window.__hmFillerData&&window.__hmFillerData();return{name:"Jayden",cut:(mj&&mj.cut)||peer.cut||null};}   // he is genuinely the head standing in this slot, so this is identity, not a guess
    var h=null,idx=-1;
    if(list)for(var j=0;j<list.length;j++){if(list[j]&&list[j].cut&&peer.cut&&list[j].cut===peer.cut){h=list[j];idx=j;break;}}
    if(!h)return null;
    var nm=(h.name&&String(h.name).trim())?String(h.name).trim().slice(0,14):("Player "+(idx+1));
    return{name:nm,cut:h.cut||null};
   }catch(_){return null;}
  }
  // Same fallback the scoreboard itself paints (paintBoard()'s side()): a real
  // tournament team name if one is live, otherwise the plain Red/Blue the board
  // already shows -- so the lower-third never disagrees with the board above it.
  function teamName(team){
   try{var T=window.__hmTour;if(T&&T.live&&T.cur){var tm=(team===1?T.cur.a:T.cur.b);if(tm&&tm.name)return tm.name;}}catch(_){}
   return team===1?"Red":"Blue";
  }
  // Reuses soccer()'s own teamRGB (exposed as window.__hmTeamRGB, right by its definition
  // near goalBurst) instead of a second private copy -- review flagged the duplicate as a
  // drift risk: the pitch and the goal-mouth particles must always read the exact same
  // colour. The literal fallback here only covers window.__hmTeamRGB being unavailable
  // (e.g. soccer() bailed under reduced motion, in which case this code never runs anyway),
  // and is kept identical to soccer()'s own RED/BLUE constants on purpose.
  function teamRGB(team){
   try{if(window.__hmTeamRGB)return window.__hmTeamRGB(team);}catch(_){}
   return team===1?"224,90,78":"90,160,216";
  }
  function goalParticles(team){try{
   if(!window.__hmFX||!window.__hmFxAt)return;
   var S=window.__hmSoccer;if(!S||!S.ball)return;
   var p=window.__hmFxAt(S.ball.x,S.ball.y);   // hero-local -> the FX canvas' own space (currently identity; see fxAt's comment)
   var hEl=document.querySelector(".hero"),hw=hEl?hEl.getBoundingClientRect().width:0;
   var dir=(hw&&p.x<hw/2)?Math.PI:0;   // spray away from the goal that was scored in, back onto the pitch
   window.__hmFX.burst(p.x,p.y,{count:12,color:teamRGB(team),speed:260,gravity:520,life:0.4,size:4,dir:dir,spread:1.9,shape:"dot"});
   window.__hmFX.burst(p.x,p.y,{count:5,color:"255,255,255",speed:220,gravity:520,life:0.36,size:3,dir:dir,spread:1.4,shape:"dot"});
  }catch(_){}}
  function ensureL3(){
   if(l3)return l3;
   var hEl=document.querySelector(".hero");if(!hEl)return null;
   l3=document.createElement("div");l3.className="hmLowerThird";l3.setAttribute("aria-hidden","true");
   l3.innerHTML='<span class="hmL3Face"><img alt="" draggable="false"></span><span class="hmL3Txt"><b class="hmL3Tag">Goal</b><b class="hmL3Nm"></b></span>';
   hEl.appendChild(l3);   // a direct child of .hero, same as .hmScore -- never inside a camera wrapper, so it holds still like the board does
   return l3;
  }
  function lowerThird(d){try{
   var el=ensureL3();if(!el)return;
   var info=scorerInfo(d.scorer);
   var nm=info?info.name:teamName(d.team);
   var faceEl=el.querySelector(".hmL3Face"),img=faceEl.querySelector("img"),nmEl=el.querySelector(".hmL3Nm");
   if(info&&info.cut){img.src=info.cut;faceEl.style.display="";}else{faceEl.style.display="none";}
   nmEl.textContent=nm;
   if(l3Timer){clearTimeout(l3Timer);l3Timer=null;}
   // Side follows the net that was scored into: netCatch() sends team 1 to goalR
   // (screen right) and team 0 to goalL, so the card lands at the end where it
   // happened instead of always in the bottom-left corner.
   el.classList.toggle("right",d.team===1);
   // ...and the GOAL tag wears the scoring team's colour (tournament colours
   // included, since teamRGB reads the live fixture), so the card is unmistakable
   // even in the corner of the eye.
   try{if(window.__hmTeamRGB)el.style.setProperty("--l3c",window.__hmTeamRGB(d.team));}catch(_){}
   el.classList.remove("in");void el.offsetWidth;el.classList.add("in");
   l3Timer=setTimeout(function(){if(el)el.classList.remove("in");},1600);
  }catch(_){}}
  /* Match-end teardown: a goal inside the last ~1.6s of a match otherwise leaves the
     lower-third floating over an emptied stage after finish() hides everything else.
     finish() lives in soccer()'s own closure and can't reach this module's private
     l3/l3Timer directly, so it's exposed here the same guarded way every other
     cross-block call in this file works -- finish() calls window.__hmGoalL3Teardown()
     alongside its existing __hmFX.clear(). Hidden instantly (transition suspended,
     not just the "in" class removed) so it disappears with the rest of the pitch
     rather than sliding out after everything else has already vanished. */
  function teardownL3(){try{
   if(l3Timer){clearTimeout(l3Timer);l3Timer=null;}
   if(l3){var t=l3.style.transition;l3.style.transition="none";l3.classList.remove("in");void l3.offsetWidth;l3.style.transition=t;}
  }catch(_){}}
  window.__hmGoalL3Teardown=teardownL3;
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.__hmBus.on('goal',function(d){
   if(reduce)return;   // the whole sequence is skipped -- no camera, no slow-mo -- the score itself already updated in goalIn()
   var S=window.__hmSoccer;if(!S)return;
   var margin=Math.abs((d.red||0)-(d.blue||0));
   var big=margin<=1||((d.red+d.blue)>=(S.target||5)-1);   /* close or late */
   if(window.__hmFX)try{window.__hmFX.hitstop(70);}catch(_){}
   if(!big)return;   /* routine goal in a blowout: hit-stop only -- peak-end budget spent on the peaks */
   if(window.__hmStagePunch)try{window.__hmStagePunch();}catch(_){}
   if(window.__hmFX)try{window.__hmFX.shake(10);}catch(_){}
   if(window.__hmSlowRamp)window.__hmSlowRamp(0.25,150,600);
   goalParticles(d.team);
   lowerThird(d);
  });
 })();

 /* Split-flap cells. Drum is fixed; a change spins FORWARD through every
    intermediate character (wrapping), fast then decelerating -- that spin-through
    is what reads as mechanical. Cascade: cells start 50ms apart and settle
    raggedly (different spin distances). Reduced-motion: instant swap. */
 var BC_DRUM=' 0123456789';
 function bcFlap(container,nCells){
  var cells=[],reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var el=document.createElement('span');el.className='bcNum';
  for(var i=0;i<nCells;i++){
   var c=document.createElement('span');c.className='bcCell';
   c.innerHTML='<i class="bcT"><span></span></i><i class="bcB"><span></span></i>'+
               '<i class="bcFlip"><span></span></i>';
   c.__ch=' ';el.appendChild(c);cells.push(c);
   /* no per-cell lightness tint here -- the stock var + shadows already carry the
      material read, and a background/backgroundColor no-op was dropped rather
      than faked (see task-1 brief dead-code nit). */
  }
  container.appendChild(el);
  function paintCell(c,ch){
   c.querySelector('.bcT span').textContent=ch;
   c.querySelector('.bcB span').textContent=ch;
  }
  function spinCell(c,target,startDelay){
   var from=BC_DRUM.indexOf(c.__ch),to=BC_DRUM.indexOf(target);
   if(from<0)from=0; if(to<0)to=0;
   var steps=(to-from+BC_DRUM.length)%BC_DRUM.length;
   if(steps===0)return;
   var k=0,delay=70;
   function one(){
    k++;var ch=BC_DRUM[(from+k)%BC_DRUM.length];
    var flip=c.querySelector('.bcFlip span');
    flip.textContent=c.__ch;
    c.classList.remove('bcGo');void c.offsetWidth;c.classList.add('bcGo');
    paintCell(c,ch);c.__ch=ch;
    if(k<steps){delay=Math.min(230,delay+ (k>steps-4?55:8));setTimeout(one,delay);}
    else setTimeout(function(){c.classList.remove('bcGo');},160);
   }
   setTimeout(one,startDelay);
  }
  return{el:el,set:function(str,instant){
   str=String(str);
   for(var i=0;i<cells.length;i++){
    var ch=str[str.length-cells.length+i]||' ';
    if(BC_DRUM.indexOf(ch)<0)ch=' ';
    if(instant||reduce){cells[i].__ch=ch;paintCell(cells[i],ch);}
    else if(cells[i].__ch!==ch)spinCell(cells[i],ch,i*50);
   }
  }};
 }

 (function race(){   // ===== MARBLE RACE: the TikTok format, faithfully -- heads drop through a chaos/choke gauntlet (pegs -> funnel -> zigzag -> spinner -> funnel -> pegs -> last funnel -> sprint), the camera rides the leader, a live leaderboard tracks every overtake, and a tight finish drops into slow motion =====
  var hero=document.querySelector(".hero");if(!hero)return;
  var css=document.createElement("style");
  css.textContent="body.hmRace .stagewrap{opacity:0;pointer-events:none}body.hmRace .heroCopy>h1,body.hmRace .heroCopy>.sub,body.hmRace .heroCopy>.heroCtas{opacity:0!important;pointer-events:none!important}body.hmRace .heroCopy>.heroAvail{opacity:0!important;pointer-events:none!important}body.hmRace .moodMenu .moodItem:not(#endGame),body.hmRace .moodMenu .moodGo{opacity:.38;pointer-events:none}"
   /* ===== THE RACE OWNS THE WHOLE SCREEN =====
      `body.playViewportOwned .hero` is 60vh. That is right for the picker, the pitch and
      the tournament band -- and wrong for a course you fall down. Measured before this
      rule, at 1440x900: the hero box was 180 -> 720, so the race ran inside a 540px
      letterbox with 180px of blank page above it and 180px below. .hmRaceWrap is
      overflow:hidden and .hero is overflow:visible, so the COURSE was sliced off at the
      band's edges -- the spinner paddle cut in half mid-stroke -- while the HEADS carried
      on into the empty page, sliding over white with nothing under them. 320x568 was
      worse: a 340px course, barely two heads deep. That is "parts of the screen are cut
      off", and it is one declaration.
      Scoped to body.hmRace, and this sheet is appended to <head> after play.html's own,
      so it wins the tie on order without needing !important. */
   +"body.hmRace.playViewportOwned .hero{height:100%;min-height:100%;margin:0}"
   +".hmRaceWrap{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:2;opacity:0;transition:opacity var(--dur-reveal) var(--ease-out)}body.hmRace .hmRaceWrap{opacity:1}"
   +".hmRacePeg{position:absolute;border-radius:50%;background:var(--theme-ink,#111214)}"
   /* THE RAIL PEG IS DRAWN AS THE HALF IT IS. It is centred ON the rail, so a full
      disc would be half outside the course: at the right rail the wrap's overflow
      clips it to a half anyway, but at the LEFT rail X0 is 104 and the other half
      would sit in the gutter the standings live in, ink over the chips. Same shape
      both sides, and the flat face reads as what it is -- part of the wall. */
   +".hmRacePeg.railL{border-radius:0 100% 100% 0/0 50% 50% 0}"
   +".hmRacePeg.railR{border-radius:100% 0 0 100%/50% 0 0 50%}"
   /* THE SWEEPER IS DRAWN OUTLINED, WHICH IS THE RULE BELOW BEING APPLIED, NOT BENT.
      Solid means fixed; outlined means it slides out from under you. That was written
      for the gate because the gate was the only thing on the course that moved
      laterally. The sweeper is the second, so it takes the same form -- a viewer should
      not have to watch a peg for a second to find out whether it is going to stay
      where it is. Same ink, same two forms, no third treatment and no new colour. */
   +".hmRacePeg.mv{background:transparent;box-shadow:inset 0 0 0 3px var(--theme-ink,#111214);will-change:transform}"
   +".hmRaceSeg{position:absolute;height:8px;border-radius:5px;background:var(--theme-ink,#111214);transform-origin:0 50%}"+".hmRaceSeg.gate{background:transparent;box-shadow:inset 0 0 0 2px var(--theme-ink,#111214)}"
   /* ONE INK, AND THE FORM SAYS WHICH OBSTACLE IT IS. The course used to be
      near-white with a hairline, so every peg and bar depended on its border to
      exist at all -- and the two moving parts were told apart by COLOUR: spinners
      purple, gates black. That is a palette doing a job shape should do, and it
      put the only other colours on screen next to the one thing that has earned
      colour, which is the racers themselves. They are photographs; the course is
      chrome; on this site chrome is flat.
      --theme-ink rather than a literal, because play.html opts into the dark
      theme: #111214 on light, #F4F5F7 on dark. A hardcoded ink would have
      vanished at night exactly as the white one nearly vanishes by day.
      SOLID means fixed -- pegs, walls, and the spinner blades, which announce
      themselves by rotating and need no second cue. OUTLINED means it slides out
      from under you: only the gate, which is the one movement a viewer cannot
      predict from looking. Two forms, one material, no borders holding shapes up. */
   +""
   +".hmRaceFin{position:absolute;height:16px;background:repeating-linear-gradient(90deg,var(--theme-ink,#111214) 0 14px,transparent 14px 28px);border-radius:3px;}"
   +".hmRaceBoard{position:absolute;left:var(--sp-12);top:50%;transform:translateY(-50%);z-index:49;display:none;flex-direction:column;gap:var(--sp-4);opacity:.72}body.hmRace .hmRaceBoard{display:flex}"   /* the standings live in the GUTTER, vertically centred at the screen's edge -- out of the course's hot centre, one glance away */
   +".hmRaceRow{display:flex;align-items:center;gap:var(--sp-8);background:rgba(253,253,253,.82);border:1px solid var(--c100);border-radius:var(--r-sm);padding:var(--sp-2) var(--sp-8) var(--sp-2) var(--sp-4);font-family:var(--sans);font-weight:600;font-size:var(--fs-caption);color:var(--c700);backdrop-filter:blur(4px);will-change:transform}"
   /* THE END CHIP IS A CONTROL AND IS NOW DRAWN AS ONE. It used to be a `.hmRaceRow` with
      a red word in it: a 22px-tall target on a screen whose only other control is the
      whole viewport. It is `.ctl .ctl--sm` now, which is a 36px box carrying the shared
      library's 44px ::after pad -- the same object the tournament's own foot uses. */
   +".hmRaceEnd{order:99;justify-content:center;color:#b3402e;will-change:transform}"
   /* ===== THE STAKE. Two questions a viewer of a qualifying race must never have to
      count rows to answer: what is at stake, and who just took a place. One pill, top
      centre, in the standings' own translucent material -- hairline and blur, no
      elevation. Before the drop it states the stake; from the first crossing it carries
      the face and the ordinal of whoever just went in, and how many places are left.
      It is the whole of the sequential-finish UI: no modal per finisher, no scrollport,
      one line that changes. */
   +".hmRaceStake{position:absolute;left:50%;top:var(--sp-16);transform:translateX(-50%);z-index:49;display:none;align-items:center;gap:var(--sp-8);box-sizing:border-box;max-width:calc(100% - var(--sp-24));background:rgba(253,253,253,.82);border:1px solid var(--c100);border-radius:var(--r-md);padding:var(--sp-6) var(--sp-12);backdrop-filter:blur(4px);font-family:var(--sans);font-weight:400;font-size:var(--fs-caption);letter-spacing:var(--tr-body);line-height:var(--lh-flat);color:var(--c700);white-space:nowrap;overflow:hidden;pointer-events:none}body.hmRace .hmRaceStake{display:flex}"
   +".hmRaceStake img{width:18px;height:22px;object-fit:contain;display:block;flex:0 0 auto}"
   +".hmRaceStake b{font-weight:600;color:var(--c950)}.hmRaceStake i{font-style:normal;font-weight:600;font-size:var(--fs-micro);letter-spacing:var(--tr-caps);text-transform:uppercase;color:var(--c500)}"
   +".hmRaceStake em{font-style:normal;font-weight:400;color:var(--c500)}"
   +".hmRaceStake span{min-width:0;overflow:hidden;text-overflow:ellipsis}"
   /* THE SECOND CLAUSE IS DROPPED ON A PHONE RATHER THAN WRAPPED OR TRUNCATED. At 320 the
      pill has 296px to live in and the long form measures past it; the first clause alone
      -- the stake, or the ordinal and the place now being contested -- is the sentence
      that has to survive. Reduction, which is what this screen kept failing to do. */
   +"@media(max-width:640px){.hmRaceStake .hmStakeMore{display:none}}"
   +".hmRaceStake.beat{animation:hmStake var(--dur-state) var(--ease-out)}@keyframes hmStake{from{opacity:.45}to{opacity:1}}"
   +"@media(prefers-reduced-motion:reduce){.hmRaceStake.beat{animation:none}}"
   +".hmRaceRow img{width:20px;height:24px;object-fit:contain;display:block}.hmRaceRow b{font-weight:600;color:var(--c950);width:11px;text-align:center}"
   +".hmRaceRow.fin{border-color:rgba(8,8,8,.55)}.hmRaceRow.fin::after{content:\"\\2713\";font-size:10px;line-height:1;color:var(--c700);margin-left:1px}.hmRaceRow.fin.in{background:var(--c950);border-color:var(--c950);color:var(--c50)}.hmRaceRow.fin.in b{color:var(--c50)}.hmRaceRow.fin.in::after{content:\"\\2713\";color:var(--c50)}.hmRaceRow.fin.miss{opacity:.5;border-color:var(--c100)}.hmRaceRow.fin.miss img{filter:grayscale(1)}.hmRaceRow.fin.miss b{color:var(--c500)}.hmRaceRow.fin.miss::after{content:\"\\2715\";color:var(--c500)}.hmRaceRow.out{opacity:.45}.hmRaceRow.out img{filter:grayscale(1)}.hmRaceRow.out b{color:var(--c500)}.hmRaceRow.out::after{content:\"\\2715\";font-size:9px;line-height:1;color:var(--c500);margin-left:1px}"
   +".hmRaceRow.top{background:var(--c950);border-color:var(--c950);color:var(--c50)}.hmRaceRow.top b{color:var(--c50)}.hmRaceRow.top::after{content:\"\\265B\";font-size:10px;line-height:1;color:var(--c50);margin-left:1px}"   /* the leader's chip flips to ink + a quiet crown -- being #1 should FEEL like something */
   +".hmRaceRow.doom{animation:hmDoom .5s steps(2,end) infinite}@keyframes hmDoom{50%{background:rgba(224,90,78,.3);border-color:rgba(224,90,78,.8)}}"
   /* THE QUALIFYING LINE. When the race is deciding who reaches a knockout, the one
      thing a viewer needs is not the winner -- it is the CUT: am I above it or below
      it. One hairline in the gap the board already has, on the chip that sits first
      below the line. A hairline and not a gap, a rule and not a shadow, and no margin
      of its own: the FLIP that glides chips between rungs derives its distance from a
      fixed pitch, so anything that changed the spacing would put every glide below the
      line out by that much. */
   +".hmRaceRow.cut::before{content:\"\";position:absolute;left:-3px;right:-3px;top:-2.5px;height:var(--hair-w);background:var(--c400);border-radius:1px}.hmRaceRow{position:relative}"
   /* MOBILE STANDINGS. The board used to be display:none below 640 ("the race itself is the interface"),
      but with no board and no positions a phone viewer cannot tell who is who or who is winning -- and
      the vertical column cannot simply come back, because it lives in the LEFT RAIL that only exists on
      desktop (X0 drops 104 -> 8 on mobile, so the course occupies the gutter). So: same chips, laid out
      as a horizontal strip along the bottom. Bottom rather than top because the stake pill owns the top
      centre and the camera rides the leader at ~42% height.

      AND IT NOW FITS, WHICH IT DID NOT. Twelve fixed-width chips plus End on one nowrap
      row measured 392px of content at 390 and at 320 -- so both ends of the strip were
      sliced by the viewport and the End button, the only control on the screen, was off
      it entirely. The chips SHRINK now (`flex:0 1 auto` + `min-width:0`, the image capped
      by `max-width:100%` so the face scales instead of being cropped) and End does not,
      so the row is inside the viewport by construction at any width and any field size.
      Reduction, not a scrollport. */
   +"@media(max-width:640px){.hmRaceBoard{left:0;right:0;top:auto;bottom:var(--sp-12);transform:none;flex-direction:row;align-items:center;justify-content:center;flex-wrap:nowrap;gap:var(--sp-2);padding:0 var(--sp-8);opacity:.94}"
    +".hmRaceBoard .hmRaceRow{flex:0 1 auto;min-width:0;padding:var(--sp-2);font-size:var(--fs-micro);gap:0}"
    +".hmRaceBoard .hmRaceRow img{width:auto;height:20px;max-width:100%}"
    +".hmRaceBoard .hmRaceRow b{display:none}"
    +".hmRaceBoard .hmRaceEnd{flex:0 0 auto;margin-inline-start:var(--sp-4)}}"
   /* The cut hairline turns on its side with the strip: down the gap, not across it. */
   +"@media(max-width:640px){.hmRaceRow.cut::before{left:-2px;right:auto;top:-2px;bottom:-2px;height:auto;width:var(--hair-w)}}";   /*
      Rank is applied with flex `order` (row.style.order = i), NOT DOM order -- so a :nth-child rule
      selects by DOM position and can hide the LEADER. Measured it doing exactly that: chips landed
      at x 116/226/171, i.e. DOM order 1,3,2. So no hiding: the whole field shows, the rank NUMBER is
      dropped (left-to-right already is the rank), and the chip shrinks to a bare face so eight racers
      plus the End button still fit inside 342px. The leader keeps the ink fill and crown. */
  gAdd(document.head,css);   // the race board / gutter rules ride with the board itself
  var wrap=null,world=null,board=null,cEl=null,spinEls=[],mvEls=[],finEl=null;   // mvEls: only the pegs that MOVE get a DOM handle kept -- a static peg is written once at build and never touched again, which is what keeps a 200-element course off the frame budget
  board=document.createElement("div");board.className="hmRaceBoard";gAdd(hero,board);
  cEl=document.createElement("div");cEl.className="hmCount";gAdd(hero,cEl);
  var stakeEl=document.createElement("div");stakeEl.className="hmRaceStake";stakeEl.setAttribute("aria-live","polite");gAdd(hero,stakeEl);
  // ===== the SHARED STANDINGS: one gutter leaderboard for every ranked mode (race + lava) -- face chips, live FLIP shuffles on overtakes, ink chip + crown for #1, locked dark rows for the finished/fallen =====
  var BOARD={rows:{},endFn:null,
   build:function(list,endFn){this.rows={};this.endFn=endFn||null;board.innerHTML="";
    var cuts=[];try{cuts=JSON.parse(localStorage.getItem("hmCompanions")||"[]")||[];}catch(_){}
    for(var i=0;i<list.length;i++){var row=document.createElement("div");row.className="hmRaceRow";row.style.order=i;
     var img=(list[i].slot!=null&&cuts[list[i].slot]&&cuts[list[i].slot].cut)?cuts[list[i].slot].cut:"images/neutral.webp";
     /* NO CAREER COUNT ON THE RACE BOARD. Every chip carried a running tally of
        everything that head had ever won -- a statistic about the past, printed
        beside a position that changes every frame, in a 9px crowned superscript
        nobody asked to read mid-race. Jayden: "idk why there is showing how many
        of the marble game they won not important". The board answers one
        question, which is who is where right now. CAREER still records the wins
        and nothing else that reads it is touched. */
     row.innerHTML="<b>"+(i+1)+"</b><img alt='' src='"+img+"'>";this.rows[list[i].key]=row;board.appendChild(row);}
    var endB=document.createElement("button");endB.className="hmRaceEnd ctl ctl--sm ctl--secondary";endB.type="button";endB.textContent="End";
    var self=this;endB.addEventListener("click",function(e){e.stopPropagation();if(self.endFn)self.endFn();});board.appendChild(endB);
    /* MEASURE THE RUNG PITCH ONCE, HERE, AND NEVER AGAIN. rank() used to take two
       getBoundingClientRect readings per chip on every re-rank: at twelve racers,
       re-ranking three times a second, that is ~80 forced layouts per second inside
       an animation loop -- the exact cost performance-idle-contract.py exists to stop
       creeping back. The chips are a uniform flex line, so flex `order` alone decides
       where each one sits: the distance between two rungs is a constant, and the glide
       distance is (oldRank - newRank) * pitch with no measuring at all. */
    this.at={};this.axis="translateY";this.pitch=0;
    var rk=Object.keys(this.rows);
    if(rk.length>1){var b0=this.rows[rk[0]].getBoundingClientRect(),b1=this.rows[rk[1]].getBoundingClientRect();
     var dv=b1.top-b0.top,dh=b1.left-b0.left;
     if(Math.abs(dh)>Math.abs(dv)){this.axis="translateX";this.pitch=dh;}else{this.pitch=dv;}}
    if(!this.pitch)this.pitch=(this.axis==="translateX")?25:28;},   // one racer: nothing can shuffle, so the fallback never animates anything
   /* FLIP: reorder, then let each chip GLIDE to its new rung -- an overtake has to read as
      movement, never a teleport. Two changes from the version that shipped:
      (1) the glide is a Web Animation, not a transition primed by a forced reflow, so the
          re-rank costs zero layout;
      (2) EVERY chip's transform is settled every time. The old code only touched rows whose
          measured delta exceeded 2px, so a chip caught mid-glide that happened to land back
          on its own rung kept its stale translate FOREVER -- which is why the board grew
          overlapping, stacked chips once there were twelve racers re-ranking constantly.
      `cut` is the qualifying line: the rank index that the hairline sits above. 0 = none. */
   rank:function(orderKeys,locked,cut){var k,r,i,at=this.at||{},nxt={};
    for(i=0;i<orderKeys.length;i++){r=this.rows[orderKeys[i]];if(!r)continue;nxt[orderKeys[i]]=i;
     r.style.order=i;var b=r.querySelector("b");if(b)b.textContent=i+1;
     var st9=locked?locked[orderKeys[i]]:null;r.classList.toggle("fin",st9==="fin");r.classList.toggle("out",st9==="out");r.classList.toggle("top",i===0&&st9==="fin");
     r.classList.toggle("cut",!!cut&&i===cut);}
    for(k in this.rows){r=this.rows[k];if(nxt[k]==null)continue;
     var d=((at[k]==null?nxt[k]:at[k])-nxt[k])*this.pitch;
     if(r.style.transform)r.style.transform="";
     if(Math.abs(d)>2&&r.animate)try{r.animate([{transform:this.axis+"("+d.toFixed(1)+"px)"},{transform:"none"}],
      {duration:380,easing:"cubic-bezier(.22,1,.36,1)"});}catch(_){}}
    this.at=nxt;}};
  window.__hmBoard=BOARD;
  // ===== CAREER: the tiniest season system that makes favorites real (Jelle's insight: records create rooting) =====
  var CAREER={key:function(slot){try{var c=JSON.parse(localStorage.getItem("hmCompanions")||"[]")[slot];return c&&c.cut?("h"+c.cut.length+"_"+c.cut.slice(60,84).replace(/[^a-zA-Z0-9]/g,"")):null;}catch(_){return null;}},
   load:function(){try{return JSON.parse(localStorage.getItem("hm_career_v1")||"{}")||{};}catch(_){return {};}},
   rec:function(type,slot){var k=this.key(slot);if(!k)return;var d=this.load();var h=d[k]=d[k]||{raceWins:0,podiums:0,lavaWins:0,soccerWins:0};
    if(type==="raceWin")h.raceWins++;else if(type==="podium")h.podiums++;else if(type==="lavaWin")h.lavaWins++;else if(type==="soccerWin")h.soccerWins++;
    try{localStorage.setItem("hm_career_v1",JSON.stringify(d));}catch(_){}},
   titles:function(slot){var k=this.key(slot);if(!k)return 0;var h=this.load()[k];return h?(h.raceWins+h.lavaWins+(h.soccerWins||0)):0;}};
  window.__hmCareer=CAREER;
  var ON=false,balls=[],pegs=[],segs=[],spins=[],gates=[],gateEls=[],mvPegs=[],X0=8,CW=0,CC=0,elimMode=false,nextCut=0,doomIx=-1,doomAt=0,outOrder=[],finishY=0,camY=0,ts=1,winner=-1,order=[],raceT0=0,seed=0,lastN=performance.now(),running=false,endAt=0,goAt=0,W=0,H=0,D=64,DMAX=64,statT=0;
  /* ===== THE RACE'S OWN CLOCK =====
     Every deadline the mode owns -- the countdown, the elimination bell, the wrap-up
     -- used to be compared against the rAF timestamp. That is the same thing as real
     time right up until the tab goes to the background, where rAF is throttled to a
     crawl and then stopped: the simulation freezes while the deadlines keep arriving,
     so a race comes back from a hidden tab already over, or never over at all.
     `clock` advances by exactly the simulated time that has been stepped, whoever
     stepped it, so a deadline always means "this much race has happened". */
  var clock=0,hidT=null,cutLine=0,elimGap=8000,stallY=-1e9,stallAt=0,beatAt=0,stallN=-1;
  /* ===== DEV-ONLY: THE LEAD CHANGE, WHICH IS THE OTHER THING THE COURSE IS FOR =====
     Jayden: "make it more of a back in fourth whos in first in the race and allowing
     others to catch up." That is a countable event and it was not being counted.
     A LEAD CHANGE is: the racer at the front of the field changes. Two decisions make
     that a measurement rather than noise.
       HYSTERESIS. First place is the deepest live racer, and two heads falling side by
     side swap that title every frame -- an un-damped counter reported thousands per
     race, which is a number about float comparisons and not about the race. A
     challenger takes the lead only once it is a HALF HEAD clear of the incumbent, so
     the count means the same thing a viewer means: somebody actually went past.
       IT STOPS AT THE FIRST CROSSING. After that first place is settled and everything
     later is a contest for second, which the board already tells that story about.
     `halfLead` is who led the moment the front of the field passed the mid-point of the
     descent. If that head is the eventual winner nearly every time, the race is decided
     in its first half and the back half is a procession -- which is the thing being
     complained about, stated as a number. */
  var leadIx=-1,leadN=0,halfLead=-1,halfY=0,leadLog=null,metAll=null;
  var capLog=[],voidList=[];
  /* ===== THE DEV-ONLY TALLY, AND WHY THE ENGINE CARRIES IT =====
     Jayden: "obstacles in the marble aren't set up for those that spawn on the side...
     nobody should just be falling through." That is a claim about CONTACT COUNTS per
     starting lane, and it cannot be answered by watching -- the course is regenerated
     every race (`seed++`), so any one run is a single sample of a random layout.
     Answering it needs the same race run a few hundred times with the contacts counted,
     which needs two things the mode did not have: somewhere to put the count, and a way
     to step the world faster than a viewer can watch it.
     Both are behind `?wraf=1`, the same dev-only opt-in that already exposes __race, so
     a real viewer pays a single boolean test per contact and nothing else. WRAF is read
     once at load rather than per frame -- location.search does not change under us. */
  var WRAF=false;try{WRAF=/[?&]wraf=1/.test(location.search);}catch(_){}
  /* DRIVE latches when something outside is stepping the world by hand (the fairness
     probe). rAF and the hidden-tab timer both stand down while it is set, because two
     drivers on one clock book the same seconds twice -- the exact bug the comment on
     visibilitychange below was written for. start() clears it, so a normal race that
     follows a probed one is driven normally again. */
  var DRIVE=false;
  var ELIM_WINDOW=34000;   // how much race an elimination bracket has to fit inside: the course takes ~40s to fall at twelve racers, measured
  var STALL_MS=6000;       // the front of the race gaining nothing for this long means the course is finished with us, whatever the standings say. The anti-stuck kick escalates over 2.7s, so this is comfortably longer than any legitimate jam.
  function heroW(){return innerWidth;}   // the COURSE spans the whole viewport, wall to wall -- the screen edges are the rails, so no head is ever pinned mid-air at an invisible wall with open space beyond it
  var HL=0;function refreshHL(){HL=Math.round(hero.getBoundingClientRect().left);}   // viewport-space -> hero-space shift (heads + FX live in hero coords)
  function heroH(){return hero.clientHeight||600;}
  function rnd(a,b){return a+Math.random()*(b-a);}
  function seg(x1,y1,x2,y2,cls){segs.push({x1:x1,y1:y1,x2:x2,y2:y2,e:0.28,cls:cls||""});}
  function buildCourse(){pegs.length=0;segs.length=0;spins.length=0;gates.length=0;mvPegs.length=0;
   refreshHL();W=heroW();H=heroH();var mob=W<=640,lastCx=null;
   X0=mob?8:104;CW=W-X0;CC=(X0+W)/2;   // the LEFT RAIL is reserved for the standings -- the whole course lives to the right of it, so the chips are always legible and never buried under a peg field
   var Ds=balls.length?balls.map(function(b){return b.r*2;}).sort(function(a,b){return a-b;}):[D];D=Ds[Math.floor(Ds.length/2)]||64;
   var DM=Ds[Ds.length-1]||D;DMAX=DM;   // the BIGGEST racer (the 1.5x mini-Jayden) sets every throat -- a funnel nobody can pass isn't a choke, it's a cork
   var y=H*0.55;   // the start grid sits just under the opening frame
   /* =====================================================================
      ONE COURSE, AUTHORED, WITH A LATTICE FOR A BACKGROUND
      =====================================================================
      Jayden: "there isnt enough obsticales anywhere else like make one researched
      course with the most optimal placement and obsticles", and "make it more of a
      back in fourth whos in first in the race and allowing others to catch up."

      MEASURED FIRST, 400 seeded twelve-head races at 1440x900 (tools/race-fairness-
      probe.py). The lane fairness the previous pass fixed had held -- every lane met
      30-31 obstacles, fairness 0.955 -- and both of these complaints were still true,
      for one reason that the contact tally could not see:

        THE LONGEST CLEAR STRAIGHT DROP WAS 22.4 HEAD DIAMETERS -- 2225px of a 9106px
        descent, with a p95 of 29 diameters. Only 33% of the course was within a head
        radius of anything at all.

      A contact tally counts what a lane MET; it cannot count what was not there. The
      middle of the course was dealt from a shuffled deck of six sections, and four of
      those six are a SINGLE object floating in half a screen of air: a spinner owns
      612px of depth and covers 338px of the width; a bumper row owns 522px and leaves
      180px gaps; a gate owns 504px. Stack two of them next to a funnel's open axis and
      a racer falls a quarter of the course without touching anything.

      AND FREE FALL IS WHY THE RACE STOPS SWAPPING LEADS. Nothing in free fall can
      change the order -- two racers falling keep their gap, and the gap grows. Lead
      changes only ever happen at obstacles. Measured: the race averaged 7.7 lead
      changes, which sounds healthy, but they CLUMP -- the longest stretch with nobody
      going past averaged 47% of the race and reached 87% at the 95th percentile. That
      is the procession Jayden is describing, and its mean hides it completely.

      ----------------------------------------------------------------------
      WHY A FIXED COURSE AND NOT A TIGHTER GENERATOR
      ----------------------------------------------------------------------
      The middle was `deck.shuffle().take(4 or 5)`. That is replayability bought with
      the one thing a designed course needs, which is the ability to be TUNED: every
      number you measure off a shuffled deck is an average over layouts nobody chose,
      and the layouts that produce the 87%-quiet race are the ones the deck happens to
      deal. You cannot fix a hand you did not author.
      The genre's own answer is the same one. Marbula One runs a whole event on ONE
      track and gets a different winner every time; tracks are only changed BETWEEN
      seasons, deliberately, "with some slight changes and adjustments to make the race
      even more exciting" (Jelle's Marble Runs wiki, Marbula One / O'raceway). The
      variety comes from the field, not from re-rolling the track. A fixed track is
      also the only way a viewer gets to know it -- "he's coming into the wheel in
      third" is a sentence you can only have about a track you have seen before, and
      this mode runs seven races back to back inside one cup.
      So the SEQUENCE and the DEPTHS are authored and fixed. What stays random is
      everything that is not layout: peg jitter, each funnel's lateral offset, each
      spinner's phase, direction and speed, each gate's phase and speed, the bumper
      row's vertical scatter, the starting grid's shuffle -- and the twelve bodies
      knocking each other about, which is where the chaos actually lives. Measured
      after: the finishing order is still a lottery (spread 3.4x against 3.45 for pure
      randomness), which is the guard that says the fixed track cost nothing.

      ----------------------------------------------------------------------
      THE LATTICE IS THE BACKGROUND, THE SET PIECES INTERRUPT IT
      ----------------------------------------------------------------------
      Rather than six kinds of section each with its own peg field and its own dead
      run-out, the course is laid out as set pieces at authored depths, and then ONE
      pass fills every remaining hole with the reference plinko lattice (backfill()).
      A lattice peg is dropped wherever it would come within a whole head of anything
      already placed, so the lattice can never close a passage a set piece opened, and
      the set pieces never have to know it exists.
      The lattice itself is the sourced one. Horizontal pitch ~2x the ball diameter and
      rows offset by half a pitch is the standard plinko/Galton layout -- "horizontal
      peg spacing should be roughly 2x the chip diameter... use staggered rows (offset
      by half a peg per row)" -- and the rows sit at 0.866 of the pitch, the equilateral
      60-degree triangle the same guide specifies (playplinko.com, "How to Build a DIY
      Plinko Board"). Pitch is held at 1.9x rather than 2.0x because these pegs are fat
      (0.18 of a head, against a plinko board's thin nail), which leaves 1.56 head
      diameters of daylight between neighbours -- still far above this file's own hard
      floor of 1.28x the biggest racer, and a tighter board deflects more, which is the
      direction the chaos wants.
      "A longer board makes for a more interesting game, as there are more chances for
      the chip to be bounced in unexpected directions" (same guide) is the whole thesis
      of the backfill, applied to depth instead of length.

      ----------------------------------------------------------------------
      WHERE THE CHOKES GO, AND WHY THEY ARE NOT NARROWER
      ----------------------------------------------------------------------
      The funnels are the overtaking device, not the pegs. A choke makes the leader
      wait with everybody else: it is the one mechanism that closes a gap without
      touching anybody's speed, which is the only honest way to answer "allowing others
      to catch up" -- no rubber-banding, no boost for stragglers, nothing that reads a
      racer's position and helps it. Marble-racing's own commentary is explicit that
      funnels "force head-to-head contact at high speed" and are where positions change
      (Impact Marble Racing funnel pack; Jelle's Marble Runs).
      It is equally explicit about the failure mode: in Funnel Endurance a marble that
      arrives with a big enough lead "barely contacts competitors in the later funnels,
      coasting to victory". A choke only re-bunches a field that is still close enough
      to be gathered. That is the argument for FOUR chokes spread evenly down the
      descent rather than two big ones -- the field never gets the room to spread past
      what the next choke can collect.
      THE THROATS ARE NOT NARROWED, and that is deliberate. A funnel is a hopper, and a
      hopper's clogging is set by the ratio of outlet to particle: below roughly five
      particle diameters an arch can form and stop the flow altogether, and the
      probability rises sharply as the ratio falls (Zuriguel et al., "Clogging of
      granular materials in bottlenecks", arXiv:1412.5806). These throats are already
      at ~1.3 diameters -- deep in the arching regime, which is exactly why the pack
      re-bunches so hard, and also why 38% of races failed to resolve all twelve. The
      bunching is already maximal; narrowing further would buy nothing and cost the
      race its finishers. So the chokes got more numerous, not tighter.

      ----------------------------------------------------------------------
      THE RAIL PEG IS A PEG AGAIN
      ----------------------------------------------------------------------
      Jayden: "fix the rail pegs". The previous pass sized the boundary peg by taste --
      radius min(max(pr*1.8, D*0.7), p2*0.36), which at 1440 is a 137px-tall half-disc,
      larger than a head and three times an interior peg. It read as a bumper, because
      it was one.
      It is the lattice's own peg now (1.05x pr, so it reads as the half-peg it is), and
      what carries the work it was doing is COUNT, not size: the rail half-peg now sits
      on EVERY row instead of on alternate ones. The previous pass alternated peg/gap at
      the boundary because its rail peg was huge and a peg that big on every row would
      have closed the outside lane. A peg the size of the lattice's own does not: the
      passage inboard of it is 186px on a narrow row and 297px on a wide one, both well
      clear of a head, and the rail is now guarded every 164px instead of every 328px.
      Both of the previous pass's arguments survive intact, because neither depended on
      the radius. It cannot be MISSED: a head against the wall has its centre at X0+r
      and the peg's at X0, so their separation is r, which is inside r+R for any R at
      all. And it cannot TRAP: there is no gap beside it, because it is the wall, and
      every resolution is strictly inward from X0, which is the direction the wall clamp
      already wants, so the two can never fight.
      THE TWO DISPROVED PLACEMENTS FROM THAT PASS STAND AND MUST NOT BE RE-TRIED:
        * a wall-welded RAMP fixed the peg deficit and destroyed the race -- completion
          35% -> 2%, Spearman(lane, rank) 0.04 -> 0.41 -- because its tip landed 15px
          from a lattice peg on odd rows, and a 15px slot beside a 96px head is a trap.
        * a FREE-STANDING boundary peg wedges in both directions: at half the lattice
          pitch the wall gap came out 62.7px against a 64px head, the worst width there
          is; pulled in to half a head (32px) it oscillates against the wall clamp,
          because the clamp holds the head's centre at X0+r and r is larger than the
          offset, and completion collapsed to 9%.
      Sourced, and unchanged from that pass: the boundary column alternating with the
      lattice and peg spacing to the outer edge equal to the spacing between columns
      (Trillium Charter School Galton board, Appropedia); the wall-to-last-peg gap
      staying under half a puck diameter or pucks fall straight down the side (Bob
      Clagett, "How to Make a Plinko Board", iliketomakestuff.com); rail-lane furniture
      and outlane width as the tuning scalar (Glossary of pinball terms, Wikipedia;
      flippers.be); and why a bouncier wall is not a substitute -- a reflecting boundary
      superposes a mirrored source and piles probability up AGAINST the wall rather than
      returning it inward (Kosztolowicz, arXiv:1505.05199; Seki, arXiv:2408.00926). */
   var voids=voidList;voids.length=0;   // the sealed wedges outside the funnel walls -- see inVoid(). Module-scoped so the probe can read it: a chute inside a sealed wedge is not a chute, and a metric that cannot tell the difference reports the course as emptier than any racer can ever find it.
   /* =====================================================================
      THE FLOW ENVELOPE -- why this pass exists, in one measurement
      =====================================================================
      Jayden, on the course the previous pass shipped: "the new marble obsticales
      are not researched at all half of them arent even in the way of anything or
      placed to actually be an obsticale the course looks rushed".
      He is right, and the previous pass's own headline number said so while
      reporting it as a win. It measured COVER -- the share of the course's CELLS
      within a head-radius of something -- and took it from 33% to 51%. COVER is an
      AREA reading. It says an obstacle is near the course. It cannot say a racer
      ever goes there.
      Two readings were added here to ask the question he actually asked.
        REACH: of everything the course builds, what share does ANY of the twelve
        racers touch, over many seeds? Measured on the shipped course: 55%. Broken
        down, it named the culprit exactly -- 63 rail half-pegs at 26% touched, and
        the interior lattice at 63%. Nearly half of every element on the course was
        never in anybody's way, which is his sentence, verbatim, as a number.
        OCCUPANCY: sampling every racer's position every 50ms of simulated race and
        binning it by depth and by x gives the envelope the field actually occupies.
        MEAN OCCUPIED WIDTH WAS 36% OF THE COURSE WIDTH. Below every choke it fell to
        2.2 head diameters -- a ribbon two heads wide -- and in the last tenth of the
        descent it never exceeded 2.8.
      The lattice was poured across 100% of the width at every depth. The field uses
      36% of it. That ratio IS the defect: not too few obstacles, and not badly
      spaced ones -- obstacles laid on a grid that has nothing to do with where the
      race is. A peg out at the rail 400px below a funnel throat is beautifully
      spaced and completely pointless.
      So the course carries a model of itself. Every section declares the lateral band
      the field will be in as it passes through, `flow` records it, and the backfill
      refuses to lay anything outside it. Placement stops being "is there room here"
      and becomes "is anybody coming past here" -- which is the only question that
      makes an obstacle an obstacle.
      A band is deliberately GENEROUS (see PLUME): pegs inside the envelope scatter
      the field wider than the empty course did, so an envelope measured off the old
      course would be too tight for the new one. The guard against getting that wrong
      is that REACH is measured again afterwards and has to go UP. */
   var flow=[],fx=CC,fw=CW/2;   // the running flow state: where the field is centred, and how wide it is, at the current `y`
   var PLUME=0.42;              // how fast a stream re-widens per unit of depth once it leaves a throat. MEASURED off the shipped course: the field went 2.2 -> 7.0 head diameters wide over 720px of descent below a throat, a half-angle of ~0.33. Held at 0.42 rather than 0.33 because a furnished plume spreads faster than the bare one it was measured in, and an envelope that is too tight starves the outside of the stream of obstacles -- the exact defect being fixed.
   function fspan(y0,y1,l0,r0,l1,r1){if(y1>y0)flow.push({y0:y0,y1:y1,l0:l0,r0:r0,l1:l1,r1:r1});}
   /* Declare the envelope from wherever the flow is now down to (cx1 +/- hw1) at y1,
      and leave the flow state there. Every section calls this exactly once per stretch
      of depth it owns, so `flow` tiles the descent with no gaps. */
   function fto(y1,cx1,hw1){hw1=Math.max(hw1,DM*0.6);
    fspan(y,y1,fx-fw,fx+fw,cx1-hw1,cx1+hw1);fx=cx1;fw=hw1;}
   /* A stretch with nothing in it but lattice: the stream keeps widening at PLUME
      until it reaches the rails, which is what an open plinko field does. */
   function fopen(y1){var g=(y1-y)*PLUME;fto(y1,fx,Math.min(CW/2,fw+g));}
   /* Where is the field at this depth, and is this point inside it? `pad` lets a peg
      sit slightly proud of the edge -- an obstacle exactly ON the boundary of the
      stream is one the outside of the field clips, which is a real contact. */
   function envAt(py){var i,lo=1e9,hi=-1e9;
    for(i=0;i<flow.length;i++){var f=flow[i];if(py<f.y0||py>f.y1)continue;
     var t=(py-f.y0)/Math.max(1,f.y1-f.y0);
     var l=f.l0+(f.l1-f.l0)*t,r=f.r0+(f.r1-f.r0)*t;
     if(l<lo)lo=l;if(r>hi)hi=r;}                       // UNION, because the split section runs two channels over the same depth
    if(hi<lo)return null;                              // no span covers this depth: the caller decides (backfill lays nothing)
    return [Math.max(X0,lo),Math.min(W,hi)];}
   function inFlow(px,py,pad){var e=envAt(py);if(!e)return false;
    return px>=e[0]-(pad||0)&&px<=e[1]+(pad||0);}
   /* THE RAIL SCALLOP IS NOT FURNITURE, IT IS A RETURN. It only earns its place where
      the field actually reaches the wall -- measured, the shipped course put one on
      every row down the whole descent and 74% of them were never touched by anybody.
      They read, correctly, as a decorative dotted border. One goes in only where the
      envelope comes within a head and a half of that rail. */
   function railLive(side,py){var e=envAt(py);if(!e)return false;
    return (side<0)?(e[0]<=X0+DM*1.5):(e[1]>=W-DM*1.5);}   // MEASURED BOTH WAYS: widening this to 3 diameters put the scallop count back up 34 -> 59, dropped overall reach 77% -> 69%, and did not move the worst chute by a single diameter. The wall does not need guarding where the field does not reach it; it needs guarding where a racer can FALL down it, and that is capChutes' job, not this one's.
   var GRID=H*0.42,SPRINT=H*0.44;          // where the starting grid spawns, and the OPEN RUN-IN the lattice is kept out of
   /* THE RUN-IN IS LEFT CLEAR ON PURPOSE, and it is not a hole in the design -- it is
      what gets the back of the field home. Once someone crosses, every racer still out
      there is swept toward the line by a gravity boost graded on its distance from it
      (see step()), and that sweep only works over open ground. Measured with the lattice
      poured all the way to the line: the winner still arrived on schedule and the tail
      was still being deflected 1500px back, so crossings stopped arriving inside the
      2.4s that keeps the wrap-up alive and the race ended with 4.3 of 12 home against
      9.3 before. A finishing straight is also what the genre does: the drama of the
      run-in is a dash, not another peg field. */
   function lat(){var pr=Math.max(6,D*0.18);   // ONE lattice, one place, used by the backfill and by nothing else
    /* PITCH IS THE HARD FLOOR NOW, NOT 1.9 BALL DIAMETERS. The sourced 2x-diameter
       rule is written for a thin nail; these pegs are 0.18 of a head, so the number
       that governs is the SURFACE gap, and this file already carries its own floor for
       it: DM*1.28 + two radii, i.e. a passage 28% wider than the biggest racer, so a
       peg pair always deflects and never cages. The old max() took the 1.9x term
       instead (189px against the floor's 164px) and bought nothing but daylight.
       At the floor the lattice is 13% tighter in both axes, which is ~30% more pegs
       per unit area -- and "a longer board makes for a more interesting game, as there
       are more chances for the chip to be bounced in unexpected directions"
       (playplinko.com, "How to Build a DIY Plinko Board") is the same argument applied
       to density. The floor itself is untouched, so nothing can wedge that could not
       wedge before. */
    var pitch=Math.max(DM*1.28+pr*2,mob?56:70);
    return {pr:pr,pitch:pitch,vs:pitch*0.866,k:Math.max(3,Math.floor(CW/pitch)),
     p2:CW/Math.max(3,Math.floor(CW/pitch)),R:Math.max(6,pr*1.7)};}
   /* Is there room here for one more peg? A candidate is refused unless a WHOLE head
      still fits between its surface and every surface already on the course. That single
      rule is what lets the lattice be poured over an authored layout without any of the
      set pieces knowing about it: nothing the backfill adds can narrow a passage below
      the clearance the set piece was built with.
      The gate is tested on its Y ALONE, not on its segments' current extent, because a
      gate slides the full width of the course -- a peg that clears the bar where it was
      built would be swept into at the other end of its travel. */
   function roomRail(px,py,rr){var i,need=DM+9;
    /* A SWEEPER OWNS ITS WHOLE STROKE, not the x it happens to be built at -- the same
       rule the gate already gets. A peg cleared against a sweeper's start position would
       be swept into half a second later, which is a slot beside a moving body: the exact
       geometry this file has measured to wedge. */
    for(i=0;i<pegs.length;i++){var mq=pegs[i];if(!mq.mv)continue;
     if(Math.abs(mq.y-py)<mq.r+rr+need&&Math.abs(px-mq.mv.x0)<mq.mv.amp+mq.r+rr+need)return false;}
    for(i=0;i<segs.length;i++){var s=segs[i],ex=s.x2-s.x1,ey=s.y2-s.y1,L2=ex*ex+ey*ey;if(L2<1)continue;
     var t=Math.max(0,Math.min(1,((px-s.x1)*ex+(py-s.y1)*ey)/L2));
     if(Math.hypot(px-(s.x1+ex*t),py-(s.y1+ey*t))<rr+4.5+need)return false;}
    for(i=0;i<spins.length;i++){var w=spins[i];if(Math.hypot(px-w.cx,py-w.cy)<w.r+rr+need)return false;}
    for(i=0;i<gates.length;i++)if(Math.abs(py-gates[i].y)<rr+4.5+need)return false;
    for(i=0;i<pegs.length;i++){var q=pegs[i];if(q.rail)continue;   // ...every peg EXCEPT another rail peg
     if(Math.abs(q.y-py)>need+rr+q.r+4)continue;
     if(Math.hypot(px-q.x,py-q.y)<q.r+rr+need)return false;}
    return true;}
   function room(px,py,rr){var i,need=DM+9;
    /* A SWEEPER OWNS ITS WHOLE STROKE, not the x it happens to be built at -- the same
       rule the gate already gets. A peg cleared against a sweeper's start position would
       be swept into half a second later, which is a slot beside a moving body: the exact
       geometry this file has measured to wedge. */
    for(i=0;i<pegs.length;i++){var mq=pegs[i];if(!mq.mv)continue;
     if(Math.abs(mq.y-py)<mq.r+rr+need&&Math.abs(px-mq.mv.x0)<mq.mv.amp+mq.r+rr+need)return false;}
    for(i=0;i<segs.length;i++){var s=segs[i],ex=s.x2-s.x1,ey=s.y2-s.y1,L2=ex*ex+ey*ey;if(L2<1)continue;
     var t=Math.max(0,Math.min(1,((px-s.x1)*ex+(py-s.y1)*ey)/L2));
     if(Math.hypot(px-(s.x1+ex*t),py-(s.y1+ey*t))<rr+4.5+need)return false;}
    for(i=0;i<spins.length;i++){var w=spins[i];if(Math.hypot(px-w.cx,py-w.cy)<w.r+rr+need)return false;}   // the blade sweeps the whole disc, so the disc is the obstacle
    for(i=0;i<gates.length;i++)if(Math.abs(py-gates[i].y)<rr+4.5+need)return false;
    for(i=0;i<pegs.length;i++){var q=pegs[i];if(Math.abs(q.y-py)>need+rr+q.r+4)continue;
     if(Math.hypot(px-q.x,py-q.y)<q.r+rr+need)return false;}
    return true;}
   /* PEGS IN THE FUNNELS' OUTER WEDGES ARE INK THAT NOTHING CAN REACH. A funnel wall
      runs from the rail down to the throat, and the triangle between that wall and the
      rail is sealed at its top by the wall's own start -- no racer can get into it. The
      clearance test alone happily fills it, because a peg 150px behind a wall is 150px
      from that wall. So each funnel records its two dead wedges and the backfill skips
      them: fewer elements to draw and to test, and no pegs floating in a pocket of the
      course that never sees a head. */
   function inVoid(px,py){for(var i=0;i<voids.length;i++){var v=voids[i];
     if(py<v.y0||py>v.y1)continue;var wx=v.x0+(v.x1-v.x0)*((py-v.y0)/Math.max(1,v.y1-v.y0));
     if(v.side<0?(px<wx):(px>wx))return true;}
    return false;}
   function backfill(){var L=lat(),r2,c,px,py;
    for(var yy=GRID+D*1.2,row=0;yy<finishY-SPRINT;yy+=L.vs,row++){
     /* THE BOUNDARY, ON EVERY ROW. A half-peg welded to each rail: it is the lattice's
        own peg, cut by the wall, which is how a real plinko board edges its field. */
     /* TWICE A ROW, AND NOT TESTED AGAINST THE LATTICE. The rail peg is small enough
        now to read as a peg, so it catches a narrower band of the outside lane than the
        old bumper did -- and the answer to that is more of them, not a bigger one. They
        sit at half the row spacing, which scallops the rail rather than dotting it.
        room()'s peg test is skipped for these deliberately: it asks "does a whole head
        still fit between these two", and the space between two pegs welded to the same
        wall is not a passage, it is wall. Everything that IS a passage -- segments,
        spinner discs, gate sweeps, the bumper row -- is still tested, and the nearest
        lattice column is a full pitch away in every row parity. */
     /* ...AND ONLY WHERE THE FIELD REACHES THE WALL. See railLive(). Measured on the
        shipped course, this loop laid 63 scallops a race and 74% of them were never
        touched by anybody -- the single biggest block of decoration on the course, and
        the reason its REACH headline was 55%. The rail is guarded where the stream can
        get to it and left plain where it cannot. */
     for(var hy=0;hy<2;hy++)for(r2=-1;r2<=1;r2+=2){px=(r2<0)?X0:W;py=yy+L.vs*0.5*hy+rnd(-3,3);
      if(py<finishY-SPRINT&&!inVoid(px,py)&&railLive(r2,py)&&roomRail(px,py,L.R))pegs.push({x:px,y:py,r:L.R,rail:r2});}
     /* WIDE rows sit on the half-pitch and NARROW rows on the pitch -- the staggered
        quincunx. The wide row's outermost lattice position is dropped rather than laid,
        because at a half-pitch from the wall it would leave a sub-head slot beside the
        rail peg, which is the exact geometry measured to wedge. */
     /* ...and the interior lattice is laid ONLY INSIDE THE FLOW ENVELOPE, which is the
        whole of this pass in one condition. `L.pr*2` of pad lets a peg sit a whole
        diameter proud of the edge of the stream, because the outside of a stream still
        clips what is just outside it -- and because a peg on the boundary is what
        widens the stream, which is the job. */
     if(row%2===0){for(c=1;c<L.k-1;c++){px=X0+L.p2*(c+0.5)+rnd(-3,3);py=yy+rnd(-3,3);if(!inVoid(px,py)&&inFlow(px,py,L.pr*2)&&room(px,py,L.pr))pegs.push({x:px,y:py,r:L.pr});}}
     else{for(c=1;c<L.k;c++){px=X0+L.p2*c+rnd(-3,3);py=yy+rnd(-3,3);if(!inVoid(px,py)&&inFlow(px,py,L.pr*2)&&room(px,py,L.pr))pegs.push({x:px,y:py,r:L.pr});}}}}
   /* =====================================================================
      THE OBSTACLE VOCABULARY
      =====================================================================
      The course this replaces had, in 7,591px: a peg, a rail half-peg, a funnel wall,
      a long straight ramp, a sliding gate, a spinner and a row of fat pegs -- and 152
      of the 179 elements were the first two. One idea, repeated. What follows is the
      list of things a racer can have HAPPEN to it, each with a job and a place in the
      descent. Every one of them is a thing the genre already does; the sourcing is on
      each builder.
        pin ............ deflects, coin-flip.            open stretches, inside the flow
        rail scallop ... returns a racer thrown wide.    only where the stream reaches a wall
        funnel + throat  gathers the whole field.        four times, evenly spread
        wall stud ...... turns a slide into a rattle.    every long diagonal, every funnel wall
        splitter ....... makes the queue pick a side.    on the axis above every throat
        spinner ........ swats, adds lateral energy.     directly under a throat, where it cannot miss
        mangle ......... twin counter-rotating wheels.   in a wide plume, mid-course
        sliding gate ... blocks; the great re-gatherer.  twice, never guarding the run-in
        pop bumper ..... flings.                         in an open plume
        cascade shelf .. steps the field down in zigs.   where a long free slide used to be
        sweeper ........ a peg that will not stay put.   in the last third, where reach was worst
      A funnel used to be 450px of wall with an empty triangle inside it, and four of
      them are a third of the descent. The triangle is not empty space -- it is the
      single highest-traffic region on the whole course, because every racer is in it.
      That is where the studs and the splitter go, and it is most of the REACH gain. */
   /* THE CHOKE. Two walls from the rails to a throat. Everyone queues, the pack
      re-bunches, and the exit order is a lottery -- the one mechanism that closes a gap
      without reading anybody's position, which is what "allowing others to catch up"
      has to mean if it is not to be rubber-banding. Marble racing's own commentary is
      explicit that funnels force head-to-head contact at speed and are where positions
      change, and equally explicit about the failure mode: a marble that arrives with a
      big enough lead barely contacts anyone in the later funnels and coasts. A choke
      only re-gathers a field still close enough to gather, which is the argument for
      four spread evenly rather than two big ones.
      THE THROAT IS NOT NARROWED. A funnel is a hopper, and a hopper's clogging is set
      by outlet/particle: below roughly five particle diameters an arch can form and
      stop the flow, with the probability rising sharply as the ratio falls (Zuriguel et
      al., "Clogging of granular materials in bottlenecks", arXiv:1412.5806). These are
      at ~1.3 diameters already -- deep in the arching regime, which is why the pack
      re-bunches so hard and also why a third of races fail to resolve all twelve.
      Narrowing further buys nothing and costs finishers. */
   /* ===== NO COLUMN MAY HAVE MORE THAN maxD DIAMETERS OF FREE FALL IN IT =====
      The flow envelope is the right rule for FURNISHING a course and the wrong rule for
      GUARDING one, and the difference is what a racer does when something goes wrong.
      Obstacles belong where the field is; but a head that gets swatted out to a rail is
      exactly the racer nothing is happening to, and the envelope has, correctly, left
      that rail bare. Measured after the envelope went in: reach rose 55% -> 78% and the
      worst clear column got WORSE, 13.9 -> 19.3 head diameters. Both readings are
      right. They are about different racers.
      So the last pass over the course is a constraint rather than a layout. Every
      obstacle is rasterised, dilated by a head radius, and each column's longest
      unbroken empty run is measured -- the same rasterisation the probe uses to report
      CHUTE, run here so the generator has to satisfy the number rather than be graded
      on it afterwards. Any run over the limit gets a peg dropped into the middle of it.
      These pegs are not decoration and they are not lattice: they are the guard on the
      one failure mode Jayden named first, "nobody should just be falling through". They
      will show a lower reach than anything else on the course, because a guard is only
      met by the racer who needed it, and that is the correct result rather than a
      defect -- the alternative is the 74%-untouched rail border this pass deleted.
      The limit is in head diameters because that is the unit the reading is in: 6.5 is
      about a screen and a half of drop at 1440x900, comfortably under the 13.9 the
      course shipped with and well over the 1.7 a bare plinko board manages, which is
      not available to a course that has funnels and gates to get past. */
   /* THE SCAN COVERS THE RUN-IN; THE PLUGS MOSTLY DO NOT. The run-in is left clear on
      purpose -- the sweep that gets the back of the field home only works over open
      ground, and pouring the lattice to the line was measured to drop the race from 9.3
      finishers to 4.3. It is also, in the genre's own terms, a REST: "use occasional
      downtime as a contrast and palette cleanser, otherwise the player will simply go
      numb" (The Level Design Book, Pacing).
      But a racer pinned against a rail in the run-in is not being swept anywhere; it is
      the free-fall case with the finish line in view. So the last stretch is scanned
      like everywhere else and only its OUTER LANES may be plugged -- wall furniture,
      which cannot get in the way of a sweep down the middle. */
   function capChutes(maxD){var B=24,hr=D*0.46,gy0=GRID,gy1=finishY;
    var nb=Math.max(1,Math.ceil((gy1-gy0)/B)),nc=Math.max(1,Math.ceil(CW/B));
    var g=new Uint8Array(nb*nc),lim=Math.max(2,Math.round(maxD*D/B)),added=0;if(WRAF)capLog.length=0;
    function mark(xa,xb,ya,yb){var ca=Math.floor((xa-X0)/B),cb=Math.ceil((xb-X0)/B),
      ba=Math.floor((ya-gy0)/B),bb=Math.ceil((yb-gy0)/B),bI,cI;
     if(ca<0)ca=0;if(cb>nc)cb=nc;if(ba<0)ba=0;if(bb>nb)bb=nb;
     for(bI=ba;bI<bb;bI++)for(cI=ca;cI<cb;cI++)g[bI*nc+cI]=1;}
    function paintPeg(q){var sw=q.mv?q.mv.amp:0;   // a sweeper occupies its whole stroke, not the x it was built at
     mark(q.x-q.r-hr-sw,q.x+q.r+hr+sw,q.y-q.r-hr,q.y+q.r+hr);}
    function paintAll(){var i;
     for(i=0;i<pegs.length;i++)paintPeg(pegs[i]);
     for(i=0;i<spins.length;i++)mark(spins[i].cx-spins[i].r-hr,spins[i].cx+spins[i].r+hr,spins[i].cy-spins[i].r-hr,spins[i].cy+spins[i].r+hr);
     for(i=0;i<gates.length;i++)mark(X0,W,gates[i].y-hr-6,gates[i].y+hr+6);   // the bar sweeps the whole width, so the whole width is guarded at that depth
     for(i=0;i<segs.length;i++){var sg=segs[i];if(sg.post)continue;   // WALKED, not boxed: a 15-degree shelf's bounding box is mostly air, and treating it as solid would hide every chute beside it
      var n=Math.max(2,Math.ceil(Math.hypot(sg.x2-sg.x1,sg.y2-sg.y1)/(B/2)));
      for(var t2=0;t2<=n;t2++){var u=t2/n,ux=sg.x1+(sg.x2-sg.x1)*u,uy=sg.y1+(sg.y2-sg.y1)*u;
       mark(ux-hr,ux+hr,uy-hr,uy+hr);}}}
    paintAll();
    /* AND THE SEALED WEDGES ARE PAINTED SOLID BEFORE THE SCAN, not skipped during it.
       The triangle outside a funnel wall is closed at the top by the wall's own start
       against the rail, so no racer can ever enter it -- it is 18% of the course grid
       and it is not free fall, it is off the course. Left unpainted it dominated every
       column it touched, and the plug pass spent its whole budget discovering it could
       not place anything there: measured, the worst RAW column read 15.1 diameters and
       the worst column a racer can actually reach read 10.9.
       Painting them first means every diameter this pass chases is one a racer can fall
       down. The probe reports both numbers for the same reason. */
    for(var vb=0;vb<nb;vb++)for(var vc=0;vc<nc;vc++){
     var vy=gy0+(vb+0.5)*B,vx=X0+(vc+0.5)*B;
     if(inVoid(vx,vy))g[vb*nc+vc]=1;}
    var pr=Math.max(6,D*0.18),L3=lat();
    /* THE OUTER LANE CANNOT HOLD A FREE-STANDING PEG, AND THAT IS NOT A BUG TO ROUTE
       AROUND -- it is two of this file's own hard-won findings meeting. room() keeps a
       whole head between every pair of surfaces, and a rail scallop is a peg, so the
       strip between the wall and the first lattice column is permanently unfurnishable.
       The previous pass proved why that has to stay true: a free-standing peg at half
       the lattice pitch left a 62.7px gap beside a 64px head -- the worst width there
       is -- and pulled in to half a head it oscillated against the wall clamp and
       collapsed completion to 9%.
       So a chute in the outer lane gets plugged with a RAIL SCALLOP instead: welded to
       the wall, so there is no slot beside it to wedge in, and it is the same object
       the lattice already edges itself with. That is also the sourced shape of the
       problem -- keep the wall-to-last-peg gap under half a puck diameter "or pucks
       fall straight down the side" (Bob Clagett, "How to Make a Plinko Board",
       iliketomakestuff.com). Measured here, that gap was 1.2 head diameters wherever
       the flow envelope had -- correctly -- decided the field does not come out this
       far, and a racer swatted into it fell 1,520px without touching anything. */
    function plug(c,b0,len){
     var px2=X0+(c+0.5)*B,py2=gy0+(b0+len/2)*B,side=(px2<X0+L3.p2)?-1:((px2>W-L3.p2)?1:0);
     if(inVoid(px2,py2))return 0;
     if(py2>finishY-SPRINT&&!side)return 0;                // in the run-in, only the walls get furniture
     /* A WALL GUARD HAS TO EARN ITS PLACE ON A HIGHER BAR THAN A LATTICE PEG. It is
        placed where the field does NOT run, so it will be touched less than anything
        else on the course by construction, and at the interior limit it was adding
        twenty scallops a race at 28% touched -- which is the decorative rail border
        this pass deleted, growing back out of the guard pass. At eight diameters it
        guards the columns that are genuinely a fall and leaves the rest of the wall
        plain. */
     if(side&&len*B<6.5*D)return 0;
     if(py2>finishY-D*0.9)return 0;                        // ...and nothing at all in the last head of it, where a plug would deflect a racer off the line itself
     if(side){
      /* NOTHING FREE-STANDING GOES IN THE OUTER LANE. EVER. The lane is 167px wide
         and a head is 99px, and there is no radius of round peg you can stand in it
         that neither leaves a sub-head slot nor squeezes: solving both bounds leaves a
         10px window for the peg's centre, and the version that sat in it cleared a
         wall-hugging head by 1.9px. Measured, that is the oscillation this file already
         paid for once -- the anti-stuck kick rate went 0.03 -> 0.38 a racer in the rail
         lanes, which is the "heads do not fit, then they teleport" feel, and it is
         worse than the free fall it was fixing.
         So the plug is a SCALLOP, and a bigger one than the lattice edges itself with.
         Welded to the wall, it has no slot beside it by construction and a head rides
         over it rather than settling against it. Sized so a head cannot pass between it
         and the first lattice column -- 0.62 of a diameter leaves an 88px gap against a
         99px head -- which is the sourced rule for a plinko boundary: keep the
         wall-to-last-peg gap under half a puck diameter "or pucks fall straight down
         the side" (Bob Clagett, "How to Make a Plinko Board", iliketomakestuff.com).
         It is only ever placed where a column measured as free fall, so these are rare
         and never adjacent -- a run of big scallops WOULD be a picket fence, which is
         the trap the funnel studs were deleted for. */
      var rx=(side<0)?X0:W;
      if(!roomRail(rx,py2,DM*0.62))return 0;
      pegs.push({x:rx,y:py2,r:DM*0.62,rail:side,cap:1});}
     else{if(!room(px2,py2,pr))return 0;
      pegs.push({x:px2+rnd(-4,4),y:py2+rnd(-4,4),r:pr,cap:1});}
     paintPeg(pegs[pegs.length-1]);added++;return 1;}
    /* EVERY over-long run in a column, not just its longest. The first version took the
       single longest run and gave up on the whole column if that one could not be
       plugged -- so a column whose longest run was inside a sealed funnel wedge kept a
       second, perfectly reachable 1,520px chute that was never even looked at. */
    for(var pass=0;pass<4;pass++)for(var c=0;c<nc;c++){var run=0,b;   // four passes, not two: one peg splits an over-long run into two runs that may each still be over the limit, and a 20-diameter chute needs three plugs to get under 5.5
     for(b=0;b<=nb;b++){if(b>=nb||g[b*nc+c]){if(run>lim)plug(c,b-run,run);run=0;}else run++;}}
    return added;}
   function funnel(throatF,tube){var th=DM*throatF+11,cx=CC+rnd(-CW*0.08,CW*0.08),drop=H*0.50,i;lastCx=cx;   // +11 covers the walls' own collision padding, so even the big head slips the throat with room to spare
    var wl={x1:X0+2,y1:y,x2:cx-th/2,y2:y+drop},wr={x1:W-2,y1:y,x2:cx+th/2,y2:y+drop};
    seg(wl.x1,wl.y1,wl.x2,wl.y2);seg(wr.x1,wr.y1,wr.x2,wr.y2);
    voids.push({y0:y,y1:y+drop,x0:X0+2,x1:cx-th/2,side:-1},{y0:y,y1:y+drop,x0:W-2,x1:cx+th/2,side:1});
    /* THE ENVELOPE INSIDE A FUNNEL IS THE FUNNEL. Declared off the wall lines rather
       than off a plume, because the walls ARE the boundary of the stream here -- which
       is what lets the backfill furnish the interior instead of tiptoeing round it. */
    fspan(y,y+drop,X0,W,cx-th/2,cx+th/2);fx=cx;fw=th/2;
    /* WHAT FURNISHES A FUNNEL IS ITS INTERIOR, NOT ITS WALLS. The obvious move was to
       stud the inside faces so a wall stopped being a free slide, and it was tried and
       measured and reverted: a peg standing proud of a wall is a STEP, and a row of
       them is a row of pockets. On a 33-degree wall a head that settles between two
       arrives at the next one with 389px/s against the 334 it needs to climb -- inside
       the margin that the wall's own 0.28 restitution and 0.995 damping eat, so it
       holds. The shallower shelves of the cascade failed the same test much harder and
       stopped the race outright.
       The interior does the work instead, and it is free: the flow envelope declared
       just above IS the inside of the V, so the backfill pours the lattice into the
       triangle every racer passes through. That triangle used to be the largest empty
       region on the course -- four funnels, 450px of drop each, a third of the whole
       descent -- and it is now the busiest, without a single obstacle welded to a wall. */
    var pr=Math.max(6,D*0.18);
    /* THE SPLITTER. A fat pin hung on the funnel's own axis, high enough that the V is
       still 3.2 heads wide there, so the queue arrives at a POST and has to pick a side
       instead of forming one line. This is the pinball post above a saucer and the
       pachinko nail above a pocket doing the same job: it is the difference between a
       throat that meters a queue and a throat that decides one.
       Sized and sited off the local wall separation rather than off a constant, so both
       passages beside it stay at or above the lattice's clearance floor whatever the
       throat width and whatever the course is scaled to. */
    /* HOW HIGH: MEASURED, AND THE FIRST ANSWER JAMMED THE RACE DEAD. Hung where the
       V is 3.2 heads wide it left two 1.30-diameter gaps sixty pixels above a
       1.36-diameter throat, and twelve heads arriving together arched across one or
       the other every single time -- 0 of 12 finishers over 40 seeds, the field piled
       between 11% and 13% of the descent. That is Zuriguel's result reproduced by
       accident: the clogging probability is set by outlet/particle and TWO outlets in
       series near the arching ratio is not one choke, it is a cork.
       So the post goes where the V is FIVE heads wide, which leaves each side gap at
       2.2 diameters -- comfortably out of the arching regime -- and it still does the
       job it is there for, because it splits the queue BEFORE the queue forms rather
       than inside it. The throat stays the only bottleneck on the section, which is
       the one thing that must be true of a choke. */
    var sepWant=DM*5.0,tS=(CW-sepWant)/Math.max(1,CW-th),sr2=(sepWant-2*(DM*1.34))/2;
    if(tS>0.20&&tS<0.90&&sr2>=pr){
     var sxl=wl.x1+(wl.x2-wl.x1)*tS,sxr=wr.x1+(wr.x2-wr.x1)*tS;
     pegs.push({x:(sxl+sxr)/2,y:y+drop*tS,r:Math.min(D*0.30,sr2),split:1});}
    y+=drop;
    if(tube){seg(cx-th/2,y,cx-th/2,y+tube);seg(cx+th/2,y,cx+th/2,y+tube);
     voids.push({y0:y,y1:y+tube,x0:cx-th/2,x1:cx-th/2,side:-1},{y0:y,y1:y+tube,x0:cx+th/2,x1:cx+th/2,side:1});
     fspan(y,y+tube,cx-th/2,cx+th/2,cx-th/2,cx+th/2);y+=tube;}
    fopen(y+D*0.6);y+=D*0.6;}
   /* THE CASCADE. What replaced the long straight ramps. A ramp spanning 72% of the
      width at 16 degrees is ~960px of uninterrupted slide: one contact, a third of a
      screen of nothing, and -- measured -- the peg field either side of it went almost
      entirely untouched, because the ramp had already swept everyone off it.
      A cascade is the marble run's own staircase: short shelves alternating left and
      right, each one ending in a lip the field drops off onto the next. It is the same
      descent in a quarter of the slide length, it puts a DROP between every shelf
      instead of one long glide, and it corrals the field into a band narrow enough that
      everything laid in it is met. Each shelf is studded for the same reason the funnel
      walls are, and carries a lip peg the field has to get round to fall off. */
   /* THE SHELVES MUST OVERLAP, AND THE FIRST VERSION DID NOT. At 46% of the width
      each, the left shelves ended at x=721 and the right ones began at x=823 -- a
      102px slot beside a 99px head, running the whole height of the section. That is
      not a staircase, it is a chimney with a one-head throat in it, and it is the exact
      geometry this file has twice measured to wedge: over 40 seeds the field piled at
      22-31% of the descent with eight to ten anti-stuck kicks a racer.
      At 62% they overlap by a quarter of the width, so there is no line straight
      through and a racer leaving a lip lands on the next shelf rather than falling past
      it. A staircase whose steps do not overlap is a ladder with the rungs missing. */
   function cascade(n){var ang=0.26,span=Math.min(CW*0.62,CW-(DM*1.5)),pr=Math.max(6,D*0.18);
    for(var i=0;i<n;i++){var ltr=(i%2===0);
     var x1=ltr?X0+2:W-2,x2=ltr?(X0+2+span):(W-2-span),y2=y+span*ang,dirn=ltr?1:-1;
     /* THE SHELF HAS A HOLE IN IT, AND THAT IS THE OBSTACLE. The first version studded
        the shelf face instead, and the studs stopped the race dead: a 14.5-degree shelf
        with 18px pegs standing 22px proud of it every 154px is a row of POCKETS. A head
        settles between two of them, and getting out means clearing a 36px step with only
        the 388px/s^2 the slope provides over 60px of run -- it arrives with 216px/s and
        needs 334. Measured: every seed piled 9 of 12 racers on the shelves at 24-27% of
        the descent, nud=0, resting rather than jittering, so the anti-stuck kick never
        even fired. A bump a ball cannot climb is not a rumble strip, it is a step.
        The hole cannot do that, because there is nothing to settle into. It is also the
        better obstacle: a marble run's ramps have gaps in them, and a gap asks a
        question a stud does not -- fall through, or carry enough speed to skip it? The
        answer depends on how fast the racer arrived, which is different for every racer
        on every run, and it splits the field at every step of the staircase.
        Sized at 1.7 diameters so a head passes cleanly rather than wedging in it, and
        kept to the middle third so neither the landing nor the lip is undercut. */
     var tg=rnd(0.36,0.64),Ls=Math.hypot(span,y2-y),hg=(DM*1.7/2)/Ls;
     seg(x1,y,x1+(x2-x1)*(tg-hg),y+(y2-y)*(tg-hg));
     seg(x1+(x2-x1)*(tg+hg),y+(y2-y)*(tg+hg),x2,y2);
     /* NO LIP PEG. Two versions were tried and both wedged, for the same arithmetic:
        a peg under a lip is 96px from its own shelf's end and 75px from the next shelf
        down, and a gap that is narrower than a head but wider than nothing is the one
        shape this course must never contain. There is no room for furniture between two
        shelves 71px apart, and the hole in the shelf is already the obstacle. */
     /* The band the field is in: along the shelf, then off its lip. Narrow and known,
        which is why the backfill can furnish under it. */
     fto(y2,(Math.min(x1,x2)+Math.max(x1,x2))/2,span/2+DM*0.5);
     y=y2+D*0.72;fopen(y);}
    fopen(y+D*0.3);y+=D*0.3;}
   /* THE PADDLE WHEEL. The race's biggest single luck injector: a bar through a hub,
      turning at ~0.9-1.3 rev/s, which does not deflect a racer so much as HIT it, with
      the blade's own surface velocity added. It belongs directly under a throat, where
      the field is a single column and it cannot miss anybody -- pinball's rule that no
      path should be a free ride, applied to the one place every path goes through.
      `nb` is the number of BARS through the hub: 2 is the four-armed cross, 3 the
      six-armed star, which leaves a third less daylight between arms and reads as a
      different machine. Centred on the FLOW rather than on the course, because a wheel
      in the middle of a course whose field is off to one side is the exact defect this
      pass is about. */
   function spinner(nb,rf,depth){var sr=Math.max(12,Math.min(D*(rf||1.7),(CW-2*(DM+9))/2-2));
    var cx=fx+rnd(-D*0.35,D*0.35),cy=y+H*(depth||0.19);lastCx=null;
    var _lo=X0+sr+(DM+9),_hi=W-sr-(DM+9);cx=(_hi>_lo)?Math.min(Math.max(cx,_lo),_hi):CC;   // ...clamped so neither wall gap closes
    spins.push({cx:cx,cy:cy,r:sr,a:rnd(0,3.14),w:(Math.random()<0.5?-1:1)*rnd(5,8),nb:nb||2});
    fto(cy,cx,Math.max(fw,sr*1.15));                       // a blade throws laterally, so the stream leaves a wheel wider than it arrived
    y=cy+H*(depth||0.19);fopen(y);}
   /* THE MANGLE. Two wheels side by side, turning OPPOSITE ways, so the gap between
      them is a nip on one stroke and a launcher on the next and a racer's line through
      the pair is never the same twice. It is the one section with two moving parts
      interacting, and it is placed mid-course in a wide plume where there is room for
      three passages -- outside each wheel and between them.
      Every one of those three passages is held at or above a head plus the collision
      padding; the radius is solved from the width rather than chosen, so the pair can
      never close on a narrow viewport. */
   function mangle(){var gapN=DM+9;
    var sr=Math.min(D*1.15,(CW-3*gapN)/4-2);
    if(sr<D*0.5){spinner(2,1.5);return;}                   // no room for a pair here: one wheel rather than a bad two
    var d=sr+gapN/2+8,cy=y+H*0.18,cx=Math.min(Math.max(fx,X0+d+sr+gapN),W-d-sr-gapN);
    var dir=(Math.random()<0.5?-1:1),sp=rnd(4.6,7.0);
    spins.push({cx:cx-d,cy:cy,r:sr,a:rnd(0,3.14),w:dir*sp,nb:2});
    spins.push({cx:cx+d,cy:cy,r:sr,a:rnd(0,3.14),w:-dir*rnd(4.6,7.0),nb:2});
    /* THE ENVELOPE IS THE PAIR'S OWN SPAN, WIDENED A LITTLE -- and the whole width was
       tried and cost too much. A wheel throws a racer sideways, so the gaps outside the
       pair are somewhere the field genuinely gets put, and declaring them in-envelope
       let the lattice fill them: the worst chute improved, and lane contact counts went
       32-38 -> 40-44 and COMPLETION fell 35% -> 12%. That is the density/finishers
       trade-off at its sharpest, and 12% is not a course, it is a course nobody gets to
       the end of.
       The gaps still get guarded -- by capChutes, which puts a handful of pegs in the
       columns that actually measure as free fall rather than a whole lattice in a
       region that mostly does not. Same defect, a twentieth of the furniture. */
    /* THE PLUME THROUGH THE MANGLE IS DECLARED WIDE -- 84% of the course. A wheel
       throws a racer sideways; that is the whole job. Declared as the pair's own span
       it left the two big gaps outside the wheels unfurnished, and they chained with
       the split's clean channel above into the worst free-fall column on the course.
       This was tried at the FULL width once and cost too much -- completion 35% -> 12%
       -- but that measurement was taken on a build whose rail plugs were also pinning
       heads against the wall. With that trap gone completion sits at 53%, and the
       density this section wants is affordable again. Density is not a free good here
       and the number it is bought with is finishers; this is the balance point that
       measured best on both. */
    fto(cy,cx,Math.max(fw,Math.min(CW*0.42,d+sr+DM*2.4)));
    y=cy+H*0.17;fopen(y);}
   /* THE SLIDING GATE. A wall that slides across the course with a head and a half of
      daylight in it: the "he got BLOCKED" beat, and by measurement the strongest
      re-gatherer on the course, because it stops the leader dead while the pack closes
      and does it purely by geometry. Kept at two, and NEITHER guards the run-in -- with
      the chokes above it working, the pack arrived at a run-in gate together instead of
      strung out and it stopped being a beat and became the end of the race: over 40
      seeded races every head that failed to finish was at 84-93% of the descent, piled
      at that gate, and completion sat at 10% against 38%. */
   /* ---- THE FLAT BAR IS A KNOWN TRAP, AND IT IS DELIBERATELY LEFT ALONE. ----
      Measured with tools/play-race-stall-probe.py: racers sit at y=3666 and y=5602 -- the
      same two numbers in every seed, for five to eleven seconds at a time -- drifting
      sideways with y not moving a pixel. Those are gy-54 for the two gates, and 54 is the
      racer's radius plus the contact skin. A bar with y1===y2 is a perfectly flat shelf, so
      gravity resolves entirely into the surface normal and a racer that settles has nothing
      left to move it; and because the bar's inner end slides, the displacement anti-stuck
      reads movement and never fires. That is CLAUDE.md's `nud=0` note, word for word.

      IT WAS FIXED, MEASURED, AND TAKEN BACK OUT. Tilting both bars into ramps that feed the
      opening removes the resting state completely, and over 120 seeded races it was WORSE
      on three of the four numbers that matter:

                        flat bar      ramped bar
        COMPLETE        100%          99%
        CHUTE           12.5 diam     14.1 diam     (the ramp's envelope evicts backfill pegs)
        |RHO|           0.004         0.044
        SPREAD          3.31          3.36

      The parking was never what stopped racers finishing -- the ending rule was, and that is
      fixed where it lives (see the stall re-base below). With every racer home, an
      eleven-second wrestle with a sliding bar is a thing that happened to somebody in a
      chaos race, not a defect. Do not re-tilt these without re-reading CHUTE. ---- */
   function gate(){var ow=DM*1.5,gy=y+H*0.15;
    var gl={x1:X0+2,y1:gy,x2:X0+CW*0.3,y2:gy,e:0.28,cls:"gate"},gr={x1:X0+CW*0.7,y1:gy,x2:W-2,y2:gy,e:0.28,cls:"gate"};
    segs.push(gl);segs.push(gr);
    gates.push({l:gl,r:gr,y:gy,ow:ow,travel:(CW-ow)*0.5-12,ph:rnd(0,6.28),spd:rnd(2.4,3.4)});
    fto(gy,CC,CW/2);                                        // a gate sweeps the whole width, so everything under it is in play
    y=gy+H*0.17;fopen(y);}
   /* THE SWEEPER. A fat peg that will not stay put -- it slides back and forth across
      its own stretch of the course on its own clock. Pachinko's windmill and pinball's
      moving target: the one obstacle whose REACH is guaranteed by construction, because
      over a race it visits every x in its travel and the field cannot learn where it
      is. Two of them, both in the last third, which is precisely where the measurement
      found reach worst (14% of pegs touched in the 80-90% band, 0% in the last tenth).
      Its whole travel is treated as solid by the clearance tests, exactly as the gate's
      is, so nothing can be laid into a slot it will later sweep through. */
   /* THE SPLIT, AND IT IS THE MOST SOURCED THING ON THIS COURSE. Two channels of
      different character, rejoining. One is narrow and clean, so it is FAST; the other
      is wide and full of pegs, so it is slow and chaotic. A racer does not choose --
      it arrives somewhere and finds out.
      This is here because the research says, flatly, that obstacle density is not what
      produces overtakes and speed differential is. Marbula One's own numbers say it
      against interest: Greenstone, "a very technical track... more than every other
      Marbula One racetrack so far" with 23 turns, sits near the BOTTOM of the
      overtaking table at 3.3 top-5 passes a lap, while Short Circuit -- "a very fast
      racetrack with lots of straights and a handful of turns", whose headline feature
      is one downhill ramp "where marbles gained a lot of speed for a chance to
      overtake" -- tops it at 5.6 (Jelle's Marble Runs wiki, per-lap figures computed
      off the wiki's own t5_overtakes counts).
      And the single most-named overtaking place in the whole series is a split. Palette
      Park's Turn 2: "one of the most notable overtaking zones on the entire track, as
      taking the inside line of the split gives the marbles a significant advantage in
      terms of speed than taking the outside line, which means marbles could make tons
      of overtakes at this turn on a single lap." GraviTrax's Helix is the same idea
      sold in a box -- six paths, the steep ones "accelerate significantly and gain
      significant momentum", the gradual ones where marbles "roll longer... but gain
      less momentum".
      THE FAST CHANNEL IS CLEAN BY CONSTRUCTION, not by a special case: at 2.4 heads
      wide, the clearance rule every peg on this course already passes (a whole head
      between surfaces) cannot be satisfied anywhere inside it, so the backfill declines
      it on its own and there is no "do not fill here" flag to get out of step with the
      geometry.
      It also answers the tension this course could not resolve any other way. Obstacles
      SPREAD a field, so density and lead changes pull against each other -- measured
      last pass, mean lead changes fell 7.7 -> 6.7 as the course got denser. A split
      does not spread anything. It gives two racers who arrived together different
      arrival times at the bottom, which is a lead change bought with geometry rather
      than with a peg. */
   /* THE FAST CHANNEL IS 2.9 HEADS WIDE, AND THE 0.5 THAT WIDENED IT IS A MEASUREMENT.
      At 2.4 heads the divider sat 119px from the one x a cap peg can legally occupy in
      an outer lane, and the clearance rule needs 131 -- so the channel was the one
      stretch of course that could be neither furnished by the lattice nor guarded by
      the chute pass. In 4 of 120 seeds it lined up with the wedge above it and the
      run-in below it and produced an 18.9-diameter column while every other seed on the
      same build sat at or under 12.5. A bimodal worst case like that is always a
      structural gap, never bad luck.
      Wider also costs less than it looks: the channel is still clean (nothing satisfies
      the lattice's clearance inside it), still the fast line, and now takes a slightly
      larger share of the field, which is the direction the split wants -- the point is
      two lines with different speeds, not a lottery that only one racer in six enters. */
   function split(){var chw=DM*1.45,dep=H*0.34,side=(Math.random()<0.5?-1:1);
    var dx=(side<0)?(X0+chw*2):(W-chw*2);                  // the divider: fast channel on `side`, the wide pegged one opposite
    seg(dx,y,dx,y+dep);
    /* THE CHEVRON ON TOP OF THE DIVIDER. A bare divider edge is a coin balanced on its
       rim -- a racer arriving dead on it wedges rather than picks. A fat peg capping it
       makes the choice a deflection, which is the Sand Rally drophole's own trick of
       putting "a pin or block... just beyond the hole" so the obstacle cannot be
       no-oped by whoever arrives at the wrong speed. */
    pegs.push({x:dx,y:y-D*0.36,r:D*0.30,split:1});
    fspan(y,y+dep,X0,W,X0,W);fx=(side<0)?(dx+(W-dx)/2):(X0+dx)/2;fw=Math.max(DM,(side<0)?(W-dx)/2:(dx-X0)/2);
    y+=dep;fopen(y+D*0.5);y+=D*0.5;}
   function sweeper(w2){var sr=D*0.34,cy=y+H*0.10;
    /* The travel is capped so that even at the end of its stroke a whole head plus the
       collision padding still fits between the sweeper and the rail it is heading for.
       A moving obstacle that can close a passage is not an obstacle, it is a door. */
    /* THE END OF THE STROKE NEEDS 1.7 HEADS OF DAYLIGHT, NOT ONE. A MOVING obstacle is
       not a static one with a clearance rule; it can push. Built to the course's usual
       one-head-plus-padding clearance, the sweeper arrived at the end of its stroke with
       108px between it and the rail and a 99.4px head in the gap -- 8.6px of slack, with
       the wall clamp holding that head's centre at X0+r and unable to yield. It pinned.
       Measured over 160 seeds: the worst lane drew 0.30 anti-stuck kicks a racer against
       0.03 on the course this replaced, and an anti-stuck kick is the "heads do not fit,
       then they teleport" feel that this file has twice been told to stay away from.
       At 1.7 the gap is 169px against a 99px head and the sweeper shoves rather than
       traps -- which is the whole point of putting a moving obstacle there. */
    var clr=DM*1.7;
    var amp=Math.max(D*0.7,Math.min(CW*0.5-sr-clr,fw*0.85));
    var x0=Math.min(Math.max(fx,X0+sr+amp+clr),W-sr-amp-clr);
    if(amp<D*0.5||x0-sr-amp<X0+clr||x0+sr+amp>W-clr){y+=H*0.20;fopen(y);return;}   // no room for a full stroke here: leave the stretch to the lattice rather than ship a half-swept peg
    pegs.push({x:x0,y:cy,r:sr,mv:{x0:x0,amp:amp,ph:rnd(0,6.28),spd:(w2||1)*rnd(1.5,2.3)}});
    fto(cy,x0,Math.max(fw,amp+sr));
    y=cy+H*0.10;fopen(y);}
   function bumps(){var need=DM+9,nB=mob?3:4;   // BUMPER ROW: big fat pegs that fling -- pure pinball
    // The row is nB pegs with nB+1 EQUAL gaps (both wall gaps included), so every gap is sp.
    // Sizing br off D (the MEDIAN racer) while spacing off raw course width let the row seal shut:
    // measured at 390px with a full pit, br was 32.4 and the widest gap anywhere -- walls included
    // -- was 46.9 against a 58.9px head. Nobody could pass. The pack piled up and only escaped via
    // the anti-stuck kick, which is exactly the "heads do not fit, then they teleport" feel.
    // Every other obstacle already clears DM (the BIGGEST racer); this was the outlier.
    var fit=function(k){return (CW-(k+1)*need)/(2*k);};   // largest radius that still leaves EVERY gap >= need
    while(nB>1&&fit(nB)<Math.max(9,D*0.26))nB--;          // thin the row out rather than let it close
    var br=Math.min(D*0.55,fit(nB)),by=y+H*0.13;
    if(br<9){y=by+H*0.15;return;}                          // even one peg cannot leave a passage: skip the row
    var sp=(CW-nB*br*2)/(nB+1);
    /* AND NOW THEY ARE ACTUALLY BUMPERS. They were fat pegs on the same 0.65
       restitution as every pin on the course, which is a big peg, not a bumper. A pop
       bumper is the pinball playfield's one element that gives a ball back MORE than it
       arrived with, and it is why a ball caught in a nest of them rattles. Held at 0.92
       -- lively, and still under 1, so the row cannot inject energy into the race and
       cannot become a speed boost by another name. It is a property of the object, not
       of who hit it: nothing here reads a racer's position or place. */
    for(var b2=0;b2<nB;b2++)pegs.push({x:X0+sp*(b2+1)+br*(2*b2+1),y:by+rnd(-14,14),r:br,e:0.92,bump:1});
    fto(by,CC,CW/2);y=by+H*0.13;fopen(y);}
   /* ===== THE COURSE, IN SECTIONS =====
      Read it top to bottom; this is the whole layout.
      The old one was CHOKE-SCRAMBLE-CHOKE four times, and its scramble was the same
      scramble every time: a wheel, two long ramps, some pegs. Uniform from top to
      bottom is what "the course looks rushed" means -- there is no rhythm in it and
      nothing a viewer can anticipate, which is the opposite of how the genre works. A
      marble-race track is a SEQUENCE OF NAMED PLACES, and the commentary that comes
      with it ("he's coming into the wheel in third") is only possible about a track
      whose parts are different from each other and stay put between races.
      So the descent is nine sections, each with a job, arranged so no two neighbours
      feel alike -- WIDE then TIGHT, STATIC then MOVING, a gather then a scatter:

        1 THE BREAK   full width, open lattice. The grid dissolves. Nothing decides
                      anything here; it exists to make the order random before the
                      first thing that matters.
        2 CHOKE ONE   funnel, studded walls, splitter, tube. First gather. The field
                      arrives strung out and leaves as a queue.
        3 THE WHEEL   a paddle wheel directly under the throat, in the column the
                      throat just made, so it cannot miss. Scatter.
        4 THE STAIRS  the cascade. Five short shelves, alternating, each with a drop
                      off its lip. Replaces two long ramps that were 960px of slide
                      apiece. Steady, rattly, and the one section with a beat you can
                      count.
        5 THE GATE    sliding wall. The hardest stop on the course.
        6 CHOKE TWO   funnel + tube. Second gather, deeper.
        7 THE MANGLE  twin counter-rotating wheels in the plume below it, then the
                      bumper row under them: the loudest, least predictable stretch,
                      and it is placed exactly where a field that has been gathered
                      twice most needs shuffling.
        8 THE GATE II a second sliding wall, then CHOKE THREE.
        9 THE DRIFT   two sweepers and the last choke. The last third of the descent
                      measured worst for reach (14% of pegs touched at 80-90%, 0% in
                      the last tenth) and this is the answer: obstacles that move, so
                      there is no line through here that is the same twice.
       10 THE RUN-IN  open ground to the line. Deliberately clear -- see SPRINT.
      Every stretch not named above is depth with no set piece in it, which backfill()
      furnishes with the lattice, INSIDE THE FLOW ENVELOPE each section declared. */
   fspan(GRID,y,X0,W,X0,W);fopen(y+H*0.62);y+=H*0.62;   // 1  THE BREAK -- the envelope opens at the start grid itself, so the lattice reaches all the way up to where the field spawns
   funnel(1.25,H*0.30);         // 2  CHOKE ONE
   spinner(2,1.7,0.16);         // 3  THE WHEEL -- planted in the throat's own column
   cascade(5);                  // 4  THE STAIRS
   /* THE COURSE IS ~460px DEEPER THAN THE FIRST BUILD OF IT, AND THAT IS PACE, PAID
      BACK. Jayden asked for "slow down the race just a bit" and got +12% last pass at
      22.9s to the first crossing. Taking the traps out of this one gave 8% of that
      straight back -- winner p50 21.0s -- because a good deal of the old course's
      length was heads being stuck in it rather than travelling through it. Spending
      completion (54%, against 37% before this pass) on depth is the honest way to buy
      it back: a fifth shelf on the stairs and a little more tube on the first two
      chokes, which is more course rather than more waiting.
      AND IT DOES NOT GO INTO THE OPENING DROP, which was tried and was worse in a way
      worth writing down. Taking THE BREAK from 0.62 to 0.86 of a screen made the race
      MORE decided, not less -- races won by the halfway leader 41% -> 51%, the longest
      quiet stretch 41% -> 46% of the race. A longer open lattice at the top lets the
      field spread before the first choke gets to it, and a choke can only re-bunch a
      field that is still close enough to gather; Funnel Endurance's own failure mode is
      a marble arriving with a lead big enough that it "barely contacts competitors in
      the later funnels, coasting to victory". Depth ahead of the first gather is the
      one place on this course where more course buys less race. */
   gate();                      // 5  THE GATE
   funnel(1.30,H*0.26);         // 6  CHOKE TWO
   split();                     // 7  THE SPLIT -- straight out of the throat above it, which is the
                                //    whole point: the two lines only produce an overtake if the field
                                //    arrives at them TOGETHER. Palette Park's split is Turn 2, early,
                                //    and the wiki's own overtake log for Hivedrive reads as a list of
                                //    passes that all happened in one bunching section ("overtaken by
                                //    Wospy in the hive on lap 2", "a gamble in the hive allowed them to
                                //    move into second"). Placed late, under a field already strung out,
                                //    it measured as a spreader and nothing else: lead changes 6.5 -> 5.5.
   mangle();                    // 8  THE MANGLE -- twin counter-rotating wheels...
   bumps();                     //    ...and the bumper row under them
   gate();                      // 9  THE GATE II
   funnel(1.30,H*0.18);         //    CHOKE THREE
   spinner(3,1.35,0.15);        //    the six-armed star: a different machine from the wheel at 3
   sweeper(1);                  // 10 THE DRIFT -- obstacles that will not stay put
   sweeper(1.25);               //    the second sweeper, faster
   funnel(1.20,0);              //    THE LAST CHOKE -- whoever exits first has the race to lose
   /* NEITHER GATE GUARDS THE RUN-IN, AND THAT IS A MEASUREMENT, NOT A TASTE.
      A gate used to sit between the last ramps and the last choke. With the chokes above
      it working, the pack arrived at it together instead of strung out, and it stopped
      being a beat and became the end of the race: over 40 seeded races the heads that
      never finished were not scattered down the course, they were all at 84-93% of the
      descent, piled at that gate -- which is the known wedging defect (a head rides the
      bar sideways, so the position-based anti-stuck reads the gate's own travel as
      progress and never fires). Completion sat at 10% against 38% before.
      Both gates are up-course, each followed by a choke and most of a course, so a head
      that hangs on one still has room -- and open ground under the sweep-home -- to get
      back into the race. */
   fto(y+SPRINT,fx,CW/2);       // the run-in: whatever the last throat did, the field fans out over open ground
   y+=SPRINT;finishY=y;          // 10 the run-in, and the line
   backfill();                  // ...and now the plinko field is poured into every hole the above left
   capChutes(5.0);              // ...and finally no column a racer can reach is left with more free fall in it than this
   for(var mv2=0;mv2<pegs.length;mv2++)if(pegs[mv2].mv)mvPegs.push(pegs[mv2]);   // the sweepers, gathered once, so the per-frame loop is over two objects and not over two hundred
   y+=H*1.1;
   seg(X0+2,finishY+H*0.85,W-2,finishY+H*0.85);segs[segs.length-1].post=true;   // the finish pen floor: finishers pile up in view behind the line. `post` keeps it out of reach()'s denominator -- it is below the line, so the tally (which stops at `fin`) can never count a touch on it, and leaving it in would book a permanent miss against a piece of furniture that is working exactly as intended.
   halfY=H*0.42+(finishY-H*0.42)*0.5;   // the mid-point of the DESCENT, for the "who led at halfway" reading -- measured in course depth, not in seconds, so a slow race and a fast one are asked the same question
  }
  function buildDOM(){
   if(!wrap){wrap=document.createElement("div");wrap.className="hmRaceWrap";hero.appendChild(wrap);}
   wrap.style.left=(-HL)+"px";wrap.style.right="auto";wrap.style.width=W+"px";   // the course canvas rides out of the hero box to cover the full viewport
   if(!world){world=document.createElement("div");world.style.cssText="position:absolute;left:0;top:0;width:100%;height:100%;will-change:transform";wrap.appendChild(world);}
   world.innerHTML="";spinEls.length=0;mvEls.length=0;
   var i,frag=document.createDocumentFragment();
   for(i=0;i<pegs.length;i++){var p=pegs[i],d=document.createElement("div");
    d.className="hmRacePeg"+(p.rail?(p.rail<0?" railL":" railR"):"")+(p.bump?" bump":"")+(p.mv?" mv":"");
    d.style.cssText+="left:"+(p.rail?(p.rail<0?p.x:p.x-p.r):(p.x-p.r))+"px;top:"+(p.y-p.r)+"px;"
     +"width:"+(p.rail?p.r:p.r*2)+"px;height:"+(p.r*2)+"px";frag.appendChild(d);
    if(p.mv)mvEls.push({el:d,p:p});}   // a sweeper is driven by transform, not by `left`: the same reason the camera is
   gateEls.length=0;
   for(i=0;i<segs.length;i++){var s=segs[i],dx=s.x2-s.x1,dy=s.y2-s.y1,len=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
    var e=document.createElement("div");e.className="hmRaceSeg"+(s.cls?" "+s.cls:"");
    e.style.cssText+="left:"+s.x1+"px;top:"+(s.y1-4.5)+"px;width:"+len+"px;transform:rotate("+(a*180/Math.PI).toFixed(2)+"deg)";frag.appendChild(e);
    if(s.cls==="gate")gateEls.push({el:e,seg:s});}
   for(i=0;i<spins.length;i++){var sp=spins[i];
    for(var k=0;k<sp.nb;k++){var b=document.createElement("div");b.className="hmRaceSeg spin";
     b.style.cssText+="left:"+(sp.cx-sp.r)+"px;top:"+(sp.cy-4.5)+"px;width:"+(sp.r*2)+"px;transform-origin:50% 50%";
     frag.appendChild(b);spinEls.push({el:b,sp:sp,k:k});}}
   finEl=document.createElement("div");finEl.className="hmRaceFin";finEl.style.display=elimMode?"none":"";   // endless format: there is no line -- the bell is the only judge
   finEl.style.cssText+="left:"+(X0+2)+"px;top:"+finishY+"px;width:"+(W-X0-4)+"px";frag.appendChild(finEl);
   world.appendChild(frag);
   BOARD.build(balls.map(function(bl,ix){return {key:String(ix),slot:(bl.peer?bl.peer.slot:null)};}),finish);
   for(i=0;i<balls.length;i++)balls[i].row=BOARD.rows[String(i)];}
  function bigText(t){if(!cEl)return;cEl.textContent=t;cEl.classList.remove("hmCountPulse");void cEl.offsetWidth;cEl.classList.add("hmCountPulse");}
  /* ===== THE STAKE PILL: the whole of the sequential-finish UI =====
     Jayden, watching the first race: "after someone finishes it should go to the next
     person and then the next person", and "make it clear that top 8 qualify for the
     cup". Both are the same missing sentence. The board answers "what is the order"; it
     has never answered "what is this FOR" or "what just happened", and a viewer had to
     count chips against a hairline to work out who was safe.
     One pill, top centre, in the standings' own material. Before the drop it states the
     stake. From the first crossing it carries the face and the ordinal of whoever just
     went in, the place now being contested, and how many are left -- so the two
     questions "who just finished" and "who is racing for the next spot" are both on
     screen, always, in the game's own language and never in a draft's. */
  function ord(n){var s=["th","st","nd","rd"],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);}
  function stake(html,beat){if(!stakeEl)return;stakeEl.innerHTML=html;
   if(beat){stakeEl.classList.remove("beat");void stakeEl.offsetWidth;stakeEl.classList.add("beat");}}
  function faceFor(b){try{var c=JSON.parse(localStorage.getItem("hmCompanions")||"[]")||[];
   var sl=b&&b.peer?b.peer.slot:null,src=(sl!=null&&c[sl]&&c[sl].cut)?c[sl].cut:((b&&b.peer&&b.peer.cut)||"images/neutral.webp");
   return "<img alt='' src='"+src+"'>";}catch(_){return "";}}
  function stakeOpen(){
   if(cutLine>0)stake("<i>Top "+cutLine+" qualify for the cup</i><em class='hmStakeMore'>"+balls.length+" heads · "+cutLine+" places</em>");
   else if(elimMode)stake("<i>Last one out</i><em class='hmStakeMore'>"+balls.length+" heads · one survivor</em>");
   else stake("<i>Marble race</i><em class='hmStakeMore'>"+balls.length+" heads · first across the line wins</em>");}
  /* Called on EVERY crossing, not only the winner's. `k` is the place just taken. */
  function stakeFinish(b,k){
   var left=(cutLine>0)?cutLine-k:balls.length-k,nxt=k+1;
   if(cutLine>0){
    if(k<cutLine)stake(faceFor(b)+"<b>"+ord(k)+"</b><span>in · "+ord(nxt)+" is up for grabs</span><em class='hmStakeMore'>"+left+" place"+(left===1?"":"s")+" left</em>",true);
    else if(k===cutLine)stake(faceFor(b)+"<b>"+ord(k)+"</b><span>in · all "+cutLine+" places taken</span>",true);
    else stake(faceFor(b)+"<b>"+ord(k)+"</b><span>out</span>",true);
   }else{
    if(k===1)stake(faceFor(b)+"<b>1st</b><span>wins · "+ord(2)+" is up for grabs</span>",true);
    else if(k<balls.length)stake(faceFor(b)+"<b>"+ord(k)+"</b><span>home · "+ord(nxt)+" is up for grabs</span>",true);
    else stake(faceFor(b)+"<b>"+ord(k)+"</b><span>home · that is everyone</span>",true);
   }}
  /* ===== ONE RANKING, USED BY THE BOARD AND BY THE QUALIFIER =====
     Finished heads in the order they crossed, then everyone still running deepest
     first, then the vacuumed ones in reverse (first out finishes last). The board
     and the qualifier answering from the same function is the whole point: a
     tournament that seeds off a different list from the one the viewer just watched
     is a tournament nobody believes. Returns ball indices. */
  function standings(){
   var un=[],ri;
   for(ri=0;ri<balls.length;ri++)if(!balls[ri].fin&&!balls[ri].out)un.push(ri);
   un.sort(function(a,b){return balls[b].y-balls[a].y;});
   return order.slice().concat(un).concat(outOrder.slice().reverse());}
  function start(opt){if(ON||document.body.classList.contains("hmBattle")||document.body.classList.contains("hmSoccer"))return false;
   opt=opt||{};
   var rc=[],i,pp;
   /* WHO IS RACING. Left alone this is every live head that has not been eliminated
      elsewhere, which is what the standalone game wants. A qualifier hands in an
      explicit roster of slots instead, because the field it is deciding is not
      necessarily everyone standing on the planet. */
   if(opt.slots&&opt.slots.length){
    for(i=0;i<peers.length;i++){pp=peers[i];if(!pp.elim&&pp.slot!=null&&opt.slots.indexOf(pp.slot)>=0)rc.push(pp);}}
   else{for(i=0;i<peers.length;i++){pp=peers[i];if(!pp.elim)rc.push(pp);}}
   if(rc.length<2)return false;
   if(window.PlayViewportOwner)window.PlayViewportOwner.enter("race");
   ON=true;window.__hmRaceOn=true;document.body.classList.add("hmRace");seed++;winner=-1;order.length=0;ts=1;camY=0;endAt=0;
   clock=performance.now();stallY=-1e9;stallAt=0;beatAt=0;stallN=-1;
   cutLine=(opt.advance>0&&opt.advance<rc.length)?(opt.advance|0):0;   // the hairline sits ABOVE this rank index; 0 means the board shows no cut
   balls.length=0;
   var gridOrder=rc.slice();for(var g=gridOrder.length-1;g>0;g--){var j=Math.floor(Math.random()*(g+1)),tmp=gridOrder[g];gridOrder[g]=gridOrder[j];gridOrder[j]=tmp;}   // reshuffled grid every race: fair start, different neighbours
   W=heroW();H=heroH();X0=(W<=640)?8:104;CW=W-X0;CC=(X0+W)/2;   // the rail bounds are needed BEFORE the grid spawns (buildCourse re-derives them a beat later)
   elimMode=(opt.format==="elim")?true:(opt.format==="line")?false:(window.__forceElim!=null)?!!window.__forceElim:Math.random()<0.45;nextCut=0;doomIx=-1;doomAt=0;outOrder.length=0;   // the FORMAT is rolled before the course is built -- it was being read one round stale, and a doubled deck then indexed off the end
   /* THE ELIMINATION BELL HAS TO FIT THE COURSE. It was a flat 8 seconds a cut, which
      is right at six racers and catastrophic at twelve: eleven cuts need 88 seconds and
      the course runs out in about forty. Measured at twelve, with the bell at 8s -- from
      t=44s every surviving head was parked in the finish pen, spread 0px, and the mode
      spent a further 64 seconds deleting motionless heads one at a time. Nothing about
      that is chaos; it is the race having stopped. So the gap is derived from the field:
      the whole bracket fits inside the course, and a small field still gets the original
      8-second beat because the clamp holds it there (12 -> 3.1s, 6 -> 6.8s, 5 or fewer
      -> 8s). Fixed at the start rather than recomputed, so the pace never drifts under
      a viewer mid-race. */
   elimGap=Math.max(2200,Math.min(8000,ELIM_WINDOW/Math.max(1,gridOrder.length-1)));
   DRIVE=false;   // a normal race owns its own clock again, whatever the last one was driven by
   leadIx=-1;leadN=0;halfLead=-1;halfY=0;leadLog=WRAF?[]:null;   // the drama tally is per race, and it is reset HERE rather than in buildCourse because halfY is set there and would be cleared after it was written
   /* ===== THE READING THIS PASS WAS BUILT AROUND: DID ANYBODY TOUCH IT? =====
      Jayden: "half of them arent even in the way of anything or placed to actually be
      an obsticale". The previous pass answered that with COVER -- the share of the
      course's CELLS within a head-radius of something -- and reported 33% -> 51% as a
      win, which is the same sentence he complained about read back as a success.
      COVER is an area measurement. It says an obstacle is NEAR the course. It cannot
      say a racer ever goes there, and after a funnel throat has gathered twelve heads
      into a 90px column, the pegs out at the rails are near a course nobody is on.
      metAll is the honest version: every peg, segment and spinner blade that ANY racer
      contacted on the way down, over the whole run. reach() divides that by what was
      built. An obstacle no seed can touch is decoration, and this is the number that
      names it. Dev-flag only; a live viewer pays one property write per new contact. */
   metAll=WRAF?{}:null;
   /* ===== EVERY RACER HAS THE SAME BODY, WHATEVER SIZE IT IS DRAWN =====
      Jayden: "make sure mini Jayden head doesnt have a disadvantage I would secretly make
      his hit box the same as everyone else for the marble game."
      spawnCompanion multiplies the mini-Jayden's WIDTH by 1.5 because his size is his
      identity (and Jayden likes it). The race then built the collision radius from that
      same width, so in a plinko field he was a 1.5x body: he caught pegs a smaller head
      slipped past, he had to be given 1.5x of every throat on the course, and he was the
      one racer who could wedge in a gap everyone else cleared. That is a handicap nobody
      chose, attached to the one head that is Jayden.
      So the collision body comes from the UNSCALED width. Nothing on screen changes: the
      sprite is still 1.5x, and the drawn position is `bb.x - HW/2` in the mailbox below,
      which centres whatever size the sprite is on the simulated centre either way. The
      1.5 is undone rather than a median taken across the field, so a race between heads
      that genuinely differ in size still gives each of them its own body.
      IT ALSO UNTIGHTENS THE COURSE. Every throat, gap and peg pitch is sized off DM, the
      biggest racer, so a 1.5x body inflated the whole course by 50% for everyone. With one
      body size the course is built for the body that is actually racing. */
   for(var n=0;n<gridOrder.length;n++){var pr=gridOrder[n],r=(pr.__filler?pr.HW/1.5:pr.HW)*0.5*0.92;
    balls.push({peer:pr,r:r,x:X0+(CW/(gridOrder.length+1))*(n+1)+rnd(-2,2),y:H*0.42-rnd(0,3),vx:0,vy:0,slow:0,fin:false,row:null,
     lane:n,x0:X0+(CW/(gridOrder.length+1))*(n+1),cPeg:0,cSeg:0,cGate:0,cSpin:0,cKick:0,cHit:0,dist:0,tFin:-1});}   // lane + tallies: dead weight in a real race, the whole instrument in a probed one
   buildCourse();buildDOM();stakeOpen();   // the stake is on screen through the 3-2-1, not only once someone has crossed
   goAt=clock+3200;raceT0=goAt;if(elimMode)nextCut=goAt+elimGap;
   var s=seed;bigText(3);if(elimMode)setTimeout(function(){if(s===seed&&ON&&cEl){cEl.classList.add("hmMsg");bigText("last one out\u2026");setTimeout(function(){if(s===seed){cEl.textContent="";cEl.classList.remove("hmMsg");}},1600);}},3400);   // the format card: the last head out, on the bell
   setTimeout(function(){if(s===seed&&ON)bigText(2);},800);setTimeout(function(){if(s===seed&&ON)bigText(1);},1600);
   setTimeout(function(){if(s===seed&&ON){bigText("Go");setTimeout(function(){if(s===seed)cEl.textContent="";},600);}},2400);
   if(!running){running=true;lastN=performance.now();requestAnimationFrame(loop);}
   hidWatch();
   return true;}
  /* finish(reason). The natural wrap-up passes "finished". EVERY OTHER WAY OUT reaches
     here with nothing -- the End chip, __hmRaceEnd from outside, a screen change -- and
     those are abandonments, so the default says so. The distinction is the qualifier's:
     a caller has to be able to tell a decided race from an interrupted one, and both
     still hand back the standings as they stood. */
  function finish(reason){if(!ON)return;
   qSettle(typeof reason==="string"?reason:"aborted");   // BEFORE the sweep below, which resolves everyone still on course as OUT without recording where they were: the qualifier has to read the standings the viewer was just looking at
   ON=false;window.__hmRaceOn=false;document.body.classList.remove("hmRace");cutLine=0;
   if(hidT){clearInterval(hidT);hidT=null;}
   try{for(var uz=0;uz<balls.length;uz++){var UB=balls[uz];if(!UB.fin&&!UB.out){UB.out=true;if(UB.row){UB.row.classList.remove("top");UB.row.classList.add("out");}}}}catch(_){}   // whoever was still mid-course when the wrap hit resolves as OUT -- the board never ends with limbo rows
   try{for(var pz=1;pz<=2&&pz<order.length;pz++){var pb=balls[order[pz]];if(pb&&pb.peer.slot!=null&&window.__hmCareer)window.__hmCareer.rec("podium",pb.peer.slot);}}catch(_){}
   if(cEl)cEl.textContent="";
   if(stakeEl){stakeEl.innerHTML="";stakeEl.classList.remove("beat");}
   for(var i=0;i<balls.length;i++){var b=balls[i],pr=b.peer;pr.raceX=null;pr.raceY=null;}
   if(window.PlayViewportOwner)window.PlayViewportOwner.leave("race");}   // heads snap back to their own physics and tumble home
  window.__hmRaceStart=start;window.__hmRaceEnd=finish;

  /* ======================= THE QUALIFIER SEAM =======================
     window.__hmRaceQualify(opts) -> Promise(result), and/or a callback.

       opts.slots     [Number]  roster slots to race. Omitted = every live head that
                                has not already been eliminated. Slots that are not
                                on the planet are simply absent from the result.
       opts.advance   Number    how many places qualify. Draws the cut hairline on the
                                board and splits the result; 0/omitted = no cut shown.
       opts.format    "line"    a finish line, which produces a real finishing order.
                      "elim"    the every-N-seconds bell, which produces a reverse one.
                                DEFAULT IS "line" -- see the note on elimination below.
       opts.timeout   Number    wall-clock ms before the race is called on the standings
                                as they stand. Default 120000. Never disable it.

     result = {
       order:      [{slot,cut,ball,finished}]  EVERY racer, best first, always the
                                               whole field. `cut` is the join key back
                                               to hmCompanions -- `slot` is null for
                                               filler and placeholder heads, so a caller
                                               building teams from saved heads must use
                                               `cut`. `finished` says whether that
                                               placing was earned at the line.
       slots:      [slot]                      the same list, slots only
       qualified:  [slot]  order.slice(0, advance)
       eliminated: [slot]  order.slice(advance)
       field:      Number  how many raced
       resolved:   Number  how many of them crossed the line. resolved === field is the
                           same statement as complete === true.
       reason:     "finished" | "timeout" | "aborted" | "busy" | "nofield"
       complete:   true only when every racer resolved by racing to the line
     }

     ON PLACINGS THAT WERE NOT EARNED. `order` always covers the whole field, because a
     caller that gets a short list has nothing to do with it. Racers who did not cross
     are ranked by how far down the course they had got, which is a measurement and not
     an invention -- but `finished:false` marks every one of them, and `resolved` counts
     them, so a caller that would rather fall back than seed off an unfinished race has
     exactly the number it needs to decide.

     THE ONE GUARANTEE: it always settles. A qualifier that can hang leaves the whole
     tournament stuck, so every exit is wired -- the natural finish, the End chip, a
     mode change, the page hiding, a wedged course, and finally the timeout. On any
     early exit the standings so far are still returned, in order, with `complete`
     false and a `reason` saying which exit fired; the caller can seed from them or
     re-run, but it is never handed nothing and never left waiting.

     WHY THE DEFAULT IS "line". Elimination has no finish line, so its order is only
     ever a reverse one, and its length is set by the bell rather than by the course.
     Measured at twelve racers it ran 110 seconds. A line race with the same field
     measured 35-38. For a gate in front of a knockout, "line" is the format.

     ABANDONMENT AND THE HIDDEN TAB are handled in hidWatch() below. */
  var QREQ=null;
  function qResult(reason,advance){
   var ord=standings(),res=[],i,b,done=0;
   for(i=0;i<ord.length;i++){b=balls[ord[i]];if(!b)continue;
    /* `cut` RIDES ALONG AND MUST NOT BE DROPPED. A caller building teams reads
       hmCompanions, not stage slots, so `cut` is the only key that joins a racer
       back to a saved head; `slot` is null for filler and placeholder heads. */
    if(b.fin)done++;
    res.push({slot:(b.peer&&b.peer.slot!=null)?b.peer.slot:null,cut:(b.peer&&b.peer.cut)||null,ball:ord[i],finished:!!b.fin});}
   var adv=Math.max(0,Math.min(advance|0,res.length));
   return {order:res,slots:res.map(function(r){return r.slot;}),
    qualified:adv?res.slice(0,adv).map(function(r){return r.slot;}):[],
    eliminated:adv?res.slice(adv).map(function(r){return r.slot;}):[],
    field:res.length,resolved:done,
    reason:reason,complete:(reason==="finished")&&res.length>0&&done===res.length};}
  function qSettle(reason){
   if(!QREQ)return;var q=QREQ;QREQ=null;   // nulled FIRST so nothing can settle twice, whichever exit fires
   if(q.timer){clearTimeout(q.timer);q.timer=0;}
   var out=qResult(reason,q.advance);     // ...which is why the advance travels as an argument rather than being read back off QREQ
   try{if(q.cb)q.cb(out);}catch(_){}
   try{if(q.res)q.res(out);}catch(_){}}
  window.__hmRaceQualify=function(opts,cb){
   opts=opts||{};
   var settle=null,promise=null;
   try{promise=new Promise(function(r){settle=r;});}catch(_){}
   function bail(reason){var out={order:[],slots:[],qualified:[],eliminated:[],reason:reason,complete:false};
    try{if(cb)cb(out);}catch(_){}if(settle)settle(out);return promise||out;}
   if(QREQ||ON)return bail("busy");   // one qualifier at a time, and never on top of a race somebody is already watching
   QREQ={cb:cb||null,res:settle,advance:opts.advance|0,timer:0};
   if(!start({slots:opts.slots,advance:opts.advance,format:opts.format||"line"})){QREQ=null;return bail("nofield");}
   QREQ.timer=setTimeout(function(){
    /* THE BACKSTOP. Not a substitute for the exits above -- a last line under all of
       them, so no combination of throttling, a wedged head and a viewer who walked
       away can leave a caller waiting forever. */
    if(!QREQ)return;qSettle("timeout");try{finish();}catch(_){}},Math.max(10000,opts.timeout||120000));
   return promise||true;};

  /* ===== ABANDONMENT: THE RACE MUST NOT DEPEND ON BEING WATCHED =====
     requestAnimationFrame does not slow down in a background tab, it STOPS. A race
     driven only by rAF therefore does not run slowly while the viewer is away -- it
     freezes mid-course, and anything waiting on it freezes too. The deliberate choice
     here is that the race carries on without an audience: while the document is
     hidden a timer steps the simulation on wall-clock time with every DOM write
     skipped, since nobody is looking at them. Chrome clamps background timers to
     about one call a second, and each call is allowed to catch up at most CATCHUP of
     simulated time, so a hidden race advances at roughly real speed and a long
     absence can never land as one multi-second freeze on the way back.
     The trade, stated plainly: come back to a hidden race and you may find it already
     decided. The alternative is a tournament that stalls until someone remembers to
     switch tabs, which is worse. */
  var CATCHUP=1.0;
  function hidWatch(){
   if(hidT)return;
   hidT=setInterval(function(){
    if(!ON){clearInterval(hidT);hidT=null;return;}
    if(DRIVE)return;                            // a hand crank is on the clock: see simRun()
    if(!document.hidden)return;                 // the rAF loop has the clock while anyone is looking
    var n=performance.now(),el=(n-lastN)/1000;lastN=n;
    if(el<=0)return;
    el=Math.min(el,CATCHUP);
    while(el>0.0005){var s=Math.min(el,1/120);tickWorld(s,false);el-=s;}
   },250);}
  try{document.addEventListener("visibilitychange",function(){
   if(!ON)return;lastN=performance.now();   // whichever driver takes over starts from now, so the handover never books the gap twice
   if(!document.hidden&&!running){running=true;requestAnimationFrame(loop);}});}catch(_){}
  /* THE HAND CRANK. `sim(sec)` steps the simulation with every DOM write skipped --
     the same `draw=false` path the hidden tab already uses -- so a whole race runs
     inside one synchronous call instead of twenty wall-clock seconds. That is what
     makes a two-hundred-seed distribution affordable; a single run of a course that is
     regenerated per race tells you nothing.
     It returns how much race it actually stepped, which is less than asked whenever
     the race ended first, and it latches DRIVE so rAF and the hidden-tab timer both
     keep their hands off the clock while it works. */
  function simRun(sec,h){var s=h||1/60,t=0,guard=0;DRIVE=true;   // 1/60 because that is what a viewer's rAF hands tickWorld: a finer step would integrate a DIFFERENT race and measure a course nobody runs
   while(t<sec&&ON&&guard++<400000){tickWorld(s,false);t+=s;}
   return t;}
  try{if(WRAF)window.__race={balls:balls,segs:segs,pegs:pegs,spins:spins,gates:gates,sim:simRun,
   st:function(){return {ts:ts,camY:camY,winner:winner,goAt:goAt,now:clock,running:running,finishY:finishY,elimMode:elimMode,elimGap:elimGap,cutLine:cutLine,pitch:BOARD.pitch,qOpen:!!QREQ};},
   /* THE PROBE'S ONE READING. Everything a fairness question needs, per racer, in the
      simulation's own units: which lane it started in, what it hit on the way down,
      how far it actually travelled, and when (or whether) it reached the line. */
   tally:function(){return balls.map(function(b,i){return {i:i,lane:b.lane,x0:Math.round(b.x0||0),
    r:+b.r.toFixed(1),f:!!(b.peer&&b.peer.__filler),   // the collision body and whether this is the mini-Jayden: the two halves of the handicap question

    peg:b.cPeg,seg:b.cSeg,gate:b.cGate,spin:b.cSpin,kick:b.cKick,hits:b.cHit,
    dist:Math.round(b.dist),x:Math.round(b.x),y:Math.round(b.y),nud:b.nud|0,fin:!!b.fin,t:Math.round(b.tFin),
    rank:standings().indexOf(i)};});},
   course:function(){return {W:W,H:H,X0:X0,CW:CW,CC:CC,finishY:finishY,D:D,DM:DMAX,
    pegs:pegs.length,segs:segs.length,spins:spins.length,gates:gates.length};},
   /* THE DRAMA READING. `changes` is how many times first place actually changed hands
      before it was taken; `half` is who led at the mid-point of the descent, which the
      probe compares against the eventual winner. `log` is the timeline, kept only so a
      distribution can be checked for the failure mode where every change happens in one
      early scramble and nothing moves after it. */
   drama:function(){return {changes:leadN,half:halfLead,leader:leadIx,winner:(order.length?order[0]:-1),log:leadLog||[]};},
   /* REACH. What was built, and what any racer actually touched, per type. The
      denominator deliberately EXCLUDES anything a racer cannot reach by the rules of
      the tally rather than by the shape of the course -- the finish-pen floor, which
      only ever meets heads that are already `fin` and therefore never counted. Every
      other element is in, including the ones sealed behind a funnel wall, because "no
      racer can get there" is exactly the finding this number exists to surface. */
   reach:function(){var m=metAll||{},o={},t,i;
    function put(k,id){o[k]=o[k]||{n:0,hit:0};o[k].n++;if(m[id])o[k].hit++;}
    for(i=0;i<pegs.length;i++)put(pegs[i].rail?"rail":(pegs[i].cap?"cap":(pegs[i].mv?"sweep":(pegs[i].bump?"bump":(pegs[i].split?"post":"peg")))),"p"+i);
    for(i=0;i<segs.length;i++){if(segs[i].post)continue;put(segs[i].cls==="gate"?"gate":(segs[i].kind||"seg"),"s"+i);}
    for(i=0;i<spins.length;i++)for(t=0;t<spins[i].nb;t++)put("spin","w"+i+"."+t);
    return o;},
   met:function(){return metAll||{};},
   caps:function(){return capLog;},voids:function(){return voidList;},   // the raw set, so a probe can colour the MAP: which peg, at which x/y, was never in anybody's way. An aggregate says half the course is decoration; only the map says WHICH half.
   standings:function(){return standings();}};}catch(_){}   // DEV-ONLY debug handle (opt-in)
  /* ===== DEV-ONLY. WHAT COUNTS AS "MEETING AN OBSTACLE" =====
     Two numbers, because the first two attempts at one number each measured the wrong
     thing and said so loudly.
       Counting every resolved frame made a single funnel wall score 750, because a
     racer SLIDES down it -- one deflection, hundreds of frames.
       Counting every unbroken touch fixed the walls and then made the sliding GATE
     score 130 against four gate segments in the whole course, because a head resting
     on a gate has its contact broken and remade by the gate's own travel. That is the
     known wedging defect being counted as a hundred obstacles.
       So the headline is DISTINCT OBSTACLES MET: each peg, segment, gate wall and
     spinner blade counts once per racer per race, which is exactly the question --
     how much course was in this lane's path. `hits` keeps the touch count alongside
     it as texture, and the two disagreeing is itself informative.
     Nothing counts after the line: a finisher bouncing round the pen did not have to
     survive that. */
  function tag(a,id,k){if(a.fin||a.__tc.indexOf(id)>=0)return;
   a.__tc.push(id);if(a.__tp.indexOf(id)>=0)return;
   a.cHit++;if(metAll)metAll[id]=1;if(!a.__met[id]){a.__met[id]=1;a[k]++;}}
  function step(dt){
   var i,j,leader=-1,lead=-1e9,second=-1,sec2=-1e9;
   for(i=0;i<balls.length;i++){var b=balls[i];if(b.fin)continue;if(b.y>lead){sec2=lead;second=leader;lead=b.y;leader=i;}else if(b.y>sec2){sec2=b.y;second=i;}}
   if(WRAF&&winner<0&&leader>=0){                       // see the note on lead changes above: hysteresis of half a head, and nothing counted once first place is taken
    if(leadIx<0||balls[leadIx].fin){leadIx=leader;if(leadLog&&!leadLog.length)leadLog.push([0,leadIx]);}   // the FIRST leader is logged too, so "how many different heads ever led" is answerable from the log alone
    else if(leader!==leadIx&&lead>balls[leadIx].y+D*0.5){leadIx=leader;leadN++;if(leadLog&&leadLog.length<400)leadLog.push([Math.round(clock-goAt),leadIx]);}
    if(halfLead<0&&halfY>0&&lead>halfY)halfLead=leadIx;}
   for(i=0;i<balls.length;i++){var a=balls[i];if(a.out)continue;
    a.vy+=1550*dt;
    if(!a.fin&&leader>=0&&(lead-a.y)>H*1.5)a.vy+=1550*0.12*dt;   // the quiet catch-up band: a straggler more than 1.5 screens back falls a touch faster -- a helping hand, never a rigged result
    /* THE SPRINT HOME, GRADED BY HOW FAR BACK YOU ARE.
       This was a flat +90% gravity on EVERYBODY the instant the winner crossed, and that
       flatness is what made the finish read as a batch: the two heads fighting over 3rd
       got the same shove as the head three screens behind them, so the whole field
       arrived in one pile and the finishing ORDER -- the thing this format is actually
       about -- happened too fast to watch.
       Graded, the shove is gentle at the front, where there is still a contest, and
       harder than the old flat one at the back, where there is not. That is not a
       tidying-up: it is the same uniform downward push every racer already had, aimed at
       the dead time instead of at the drama. MEASURED over six twelve-head qualifiers at
       1440x900: the flat version resolved 9.2 of 12 on average and produced a complete
       finishing order once in six; the first attempt at this (a flat 0.42 until the cut
       filled) made it much worse -- 6.3 of 12 and never complete, which would hand the
       qualifier unearned placings inside its own cut. Graded gets both. */
    if(!a.fin&&order.length>0){var _bk=Math.max(0,Math.min(1,(finishY-a.y)/(H*1.5)));   // how far from the LINE, not from the leader: a pack that is all together still needs sweeping home
     /* THE SWEEP GOT STRONGER ON THE TIDY-UP SIDE ONLY, AND THAT IS A COURSE CHANGE
        BEING PAID FOR HONESTLY. This course is denser than the one these two numbers
        were tuned against, and a denser course deflects the tail more on its way home:
        measured over 120 seeds, mean finishers held at 8.1 against 8.6 but the share of
        races resolving ALL twelve fell 37% -> 20%, which is a tail effect, not a mean
        one. The split is most of it -- a racer that takes the slow channel is
        legitimately, by design, much later than one that took the fast line.
        Only the first branch moved. That branch runs AFTER the cut is filled, when
        every place that is being raced for has been taken and what is left is a queue
        of heads with nothing to win -- the dead time this grading was introduced to aim
        at in the first place. The contested branch is untouched, so nothing that
        decides a placing has been sped up, and nothing anywhere reads a racer's
        position relative to another: the shove is graded on distance from the LINE. */
     a.vy+=1550*((order.length>=(cutLine||1))?(1.35+1.35*_bk):(0.15+1.45*_bk))*dt;}
    var sp=Math.hypot(a.vx,a.vy),cap=H*2.5;if(sp>cap){a.vx*=cap/sp;a.vy*=cap/sp;}
    if(WRAF&&!a.fin)a.dist+=sp*dt;   // path length, not depth: a head that is being knocked about covers more ground than one that free-falls the same drop
    /* A CONTACT IS AN EVENT, NOT A FRAME. The first version of this tally incremented
       inside the resolve branch, which fires on EVERY frame a racer is resting on or
       sliding down a surface -- a funnel wall scored 750 while deflecting the head
       exactly once. So each obstacle carries an id, the ids touched this frame are
       kept, and only ids that were not touched LAST frame count. `__tp`/`__tc` are two
       tiny arrays per racer per frame, allocated only under the dev flag. */
    if(WRAF){a.__tp=a.__tc||[];a.__tc=[];a.__met=a.__met||{};}
    a.x+=a.vx*dt;a.y+=a.vy*dt;
    if(a.x<X0+a.r){a.x=X0+a.r;a.vx=Math.abs(a.vx)*0.3;}if(a.x>W-a.r){a.x=W-a.r;a.vx=-Math.abs(a.vx)*0.3;}
    // pegs: the clean left/right coin-flips
    for(j=0;j<pegs.length;j++){var p=pegs[j];if(Math.abs(p.y-a.y)>a.r+p.r+2)continue;var dx=a.x-p.x,dy=a.y-p.y,d=Math.hypot(dx,dy),rr=a.r+p.r;
     if(d>0.01&&d<rr){var nx=dx/d,ny=dy/d;a.x=p.x+nx*rr;a.y=p.y+ny*rr;
      /* RESTITUTION IS THE PEG'S OWN NOW, not one number for everything on the course.
         0.65 is the pin; the bumper row is 0.92, which is what makes a bumper a bumper
         rather than a big pin. Nothing here exceeds 1, so no peg can put energy into
         the race -- an obstacle that gave a racer back more than it arrived with would
         be a speed boost wearing a pinball costume. */
      var vn=a.vx*nx+a.vy*ny;if(vn<0){var pe=1+(p.e||0.65);a.vx-=pe*vn*nx;a.vy-=pe*vn*ny;
       if(WRAF)tag(a,"p"+j,"cPeg");   // the tally is "what it met ON THE WAY DOWN": a finisher rattling around the pen is not course it had to survive
       if(vn<-520){a.peer.raceHit=performance.now();if(window.__hmFX&&Math.random()<0.3)window.__hmFX.ring(a.x-HL,a.y-camY,{r0:4,r1:26,color:"131,131,131",width:2,life:0.28});}}}}
    // segments: ramps, funnel walls, tubes, pen floor
    for(j=0;j<segs.length;j++){var s=segs[j];if(a.y<Math.min(s.y1,s.y2)-a.r-4||a.y>Math.max(s.y1,s.y2)+a.r+4)continue;
     var ex=s.x2-s.x1,ey=s.y2-s.y1,L2=ex*ex+ey*ey;if(L2<1)continue;
     var t=Math.max(0,Math.min(1,((a.x-s.x1)*ex+(a.y-s.y1)*ey)/L2)),qx=s.x1+ex*t,qy=s.y1+ey*t;
     var ddx=a.x-qx,ddy=a.y-qy,dd=Math.hypot(ddx,ddy);
     if(dd>0.01&&dd<a.r+4.5){var nx2=ddx/dd,ny2=ddy/dd;a.x=qx+nx2*(a.r+4.5);a.y=qy+ny2*(a.r+4.5);
      var vn2=a.vx*nx2+a.vy*ny2;if(vn2<0){a.vx-=(1+s.e)*vn2*nx2;a.vy-=(1+s.e)*vn2*ny2;a.vx*=0.995;a.vy*=0.995;
       if(WRAF)tag(a,"s"+j,(s.cls==="gate")?"cGate":"cSeg");}}}
    // spinner paddles: moving segments that SWAT
    for(j=0;j<spins.length;j++){var w=spins[j];if(Math.abs(a.y-w.cy)>w.r+a.r+8||Math.abs(a.x-w.cx)>w.r+a.r+8)continue;
     for(var k2=0;k2<w.nb;k2++){var aa=w.a+k2*Math.PI/w.nb,ca=Math.cos(aa),sa=Math.sin(aa);   // nb BARS through the hub, evenly spread over a half-turn: 2 is the four-armed cross, 3 is the six-armed star that leaves a third less daylight between arms
      var px1=w.cx-ca*w.r,py1=w.cy-sa*w.r,ex2=ca*w.r*2,ey2=sa*w.r*2;
      var tt=Math.max(0,Math.min(1,((a.x-px1)*ex2+(a.y-py1)*ey2)/(w.r*w.r*4))),qx2=px1+ex2*tt,qy2=py1+ey2*tt;
      var dx3=a.x-qx2,dy3=a.y-qy2,d3=Math.hypot(dx3,dy3);
      if(d3>0.01&&d3<a.r+5){var nx3=dx3/d3,ny3=dy3/d3;a.x=qx2+nx3*(a.r+5);a.y=qy2+ny3*(a.r+5);
       var rx=qx2-w.cx,ry=qy2-w.cy;var pvx=-w.w*ry,pvy=w.w*rx;   // paddle surface velocity at the contact point
       var rvx=a.vx-pvx,rvy=a.vy-pvy,vn3=rvx*nx3+rvy*ny3;
       if(vn3<0){a.vx-=(1+0.6)*vn3*nx3;a.vy-=(1+0.6)*vn3*ny3;
        if(WRAF)tag(a,"w"+j+"."+k2,"cSpin");
        a.peer.raceHit=performance.now();if(window.__hmFX&&Math.random()<0.25)window.__hmFX.ring(a.x-HL,a.y-camY,{r0:5,r1:30,color:"123,95,208",width:2.5,life:0.3});}}}}
    // anti-stuck: POSITION-based, so even a jammed pile (micro-jittering in place with live velocities) gets shaken loose -- the chaos nudge every viral sim ships with
    if(a.px==null){a.px=a.x;a.py=a.y;}
    if(!a.fin){if(Math.hypot(a.x-a.px,a.y-a.py)>12){a.px=a.x;a.py=a.y;a.slow=0;a.nud=0;}
     else{a.slow+=dt;if(a.slow>0.9){a.slow=0;a.px=a.x;a.py=a.y;a.nud=(a.nud||0)+1;
      if(a.nud>=3){a.nud=0;if(WRAF)a.cKick++;a.vx=(CC>a.x?1:-1)*rnd(520,680);a.vy=-rnd(160,260);}   // three nudges and still pinned -> a hard kick toward open course (out of any corner pocket), with a little pop up to clear the lip
      else{var m=rnd(300,460);a.vx+=(Math.random()<0.5?-1:1)*m*0.5;a.vy+=m;}}}}
    if(!a.fin&&!elimMode&&a.y>finishY){a.fin=true;if(WRAF)a.tFin=clock-goAt;order.push(i);if(a.row){a.row.classList.add("fin");a.row.classList.add((cutLine&&order.length>cutLine)?"miss":"in");}
     /* ONE AT A TIME. The pill names whoever just went in and what is being raced for
        next; a place with a contest still behind it also buys a short beat of slow
        motion, so the eye has somewhere to land before the next one arrives. No beat
        once the cut is filled -- the tail is a tidy-up, not a contest, and stuttering
        through it would be dead time. And the wrap-up deadline follows the LAST
        finisher rather than the first, so the qualifier's degradation ladder never
        drops to `partial` just because the sequence took a moment to read. */
     try{stakeFinish(a,order.length);}catch(_){}
     if(cutLine&&order.length<cutLine)beatAt=clock+380;
     endAt=Math.max(endAt||0,clock+3000);   // a denser course spreads the tail out more; the wrap-up window that fitted the old one was cutting crossings off mid-queue
     if(winner<0){winner=i;a.peer.raceWin=true;ts=0.28;endAt=clock+7600;try{if(window.__hmCareer&&a.peer.slot!=null)window.__hmCareer.rec("raceWin",a.peer.slot);}catch(_){}
      try{bigText("🏁");if(window.__hmFX){window.__hmFX.burst(a.x-HL,finishY-camY,{count:26,color:"224,90,78",speed:520,gravity:900,life:0.9,size:5,dir:-1.57,spread:0.9});window.__hmFX.burst(a.x-HL,finishY-camY,{count:26,color:"90,160,216",speed:520,gravity:900,life:0.9,size:5,dir:-1.57,spread:0.9});}}catch(_){}
      setTimeout(function(){if(ON)bigText("Winner!");},900);setTimeout(function(){if(ON&&cEl)cEl.textContent="";},2600);}}}
   // ball-vs-ball: the jostle that makes the queue at every funnel a lottery
   for(i=0;i<balls.length;i++)for(j=i+1;j<balls.length;j++){var A=balls[i],B=balls[j];
    var dx4=B.x-A.x,dy4=B.y-A.y,d4=Math.hypot(dx4,dy4),rr4=A.r+B.r;
    if(d4>0.01&&d4<rr4){var nx4=dx4/d4,ny4=dy4/d4,ov=(rr4-d4)/2;
     var soft=(Math.hypot(A.vx,A.vy)+Math.hypot(B.vx,B.vy)<140)?0.3:1;   // a SLOW pile squeezes: soft contact melts the two-heads-arched-over-the-throat lock (the granular arch every hopper jams on), so a queue always drains
     A.x-=nx4*ov*soft;A.y-=ny4*ov*soft;B.x+=nx4*ov*soft;B.y+=ny4*ov*soft;
     var rvx4=B.vx-A.vx,rvy4=B.vy-A.vy,vn4=rvx4*nx4+rvy4*ny4;
     if(vn4<0){var imp=-(1+0.5)*vn4/2*soft;A.vx-=nx4*imp;A.vy-=ny4*imp;B.vx+=nx4*imp;B.vy+=ny4*imp;}}}
  }
  /* ===== ONE FRAME OF RACE =====
     Split out of loop() so that something other than requestAnimationFrame can drive
     it -- see hidWatch(). `raw` is real seconds; `draw` is false when nobody is
     looking, in which case every DOM write below is skipped and only the simulation
     advances. Absolute deadlines are compared against `clock`, the race's own clock,
     which this function is the only thing that moves. */
  function tickWorld(raw,draw){
   // photo-finish slow-mo: leaders neck-and-neck at the line -> the world holds its breath.
   // NOT IN ELIMINATION. There is no line in that format, so finishY is just geometry the
   // pack eventually falls past -- and once it did, this test stayed true forever and the
   // mode ran the rest of its bracket at 0.3x. Measured: ts pinned at 0.30 from t=46s to
   // the end of a 110-second race. A format with no line cannot have a photo finish.
   /* ...AND IT IS NOT ONLY THE WINNER'S. The test used to be gated on `winner<0`, so the
      world held its breath for 1st place and for nothing after it -- which is the same
      batch-finish failure the sprint boost had, expressed in time instead of gravity.
      Every place has a contest and every contest gets the dip; `fin` racers are already
      excluded from the leaders below, so once a place is taken the test simply moves on
      to the next two heads. `beatAt` is the short hold a crossing buys (see step()). */
   if(!elimMode){var lead2=-1e9,sec3=-1e9;for(var q=0;q<balls.length;q++){if(balls[q].fin||balls[q].out)continue;if(balls[q].y>lead2){sec3=lead2;lead2=balls[q].y;}else if(balls[q].y>sec3)sec3=balls[q].y;}
    var want=(clock<beatAt)?0.42:((lead2>finishY-H*0.9&&(lead2-sec3)<H*0.35)?0.3:1);
    ts+=(want-ts)*Math.min(1,raw*(want<ts?6:2.4));}
   else if(winner>=0)ts+=(1-ts)*Math.min(1,raw*2.2);
   else ts=1;
   var dt=raw*ts;
   clock+=raw*1000;var n=clock;
   if(n>=goAt)
    {var sub=dt>0.017?2:1,sdt=dt/sub;for(var s2=0;s2<sub;s2++)step(sdt);}
   for(var sI=0;sI<spins.length;sI++)spins[sI].a+=spins[sI].w*dt;
   /* THE SWEEPERS. Position is derived from the phase every frame rather than
      integrated, so a hidden tab that catches up in one 250ms lump puts a sweeper
      exactly where the clock says it should be instead of wherever a pile of small
      steps happened to leave it -- the same reason the gate is driven off `ph`. */
   for(var mI=0;mI<mvPegs.length;mI++){var mp=mvPegs[mI];mp.mv.ph+=mp.mv.spd*dt;
    mp.x=mp.mv.x0+Math.sin(mp.mv.ph)*mp.mv.amp;}
   if(draw)for(var mE=0;mE<mvEls.length;mE++)mvEls[mE].el.style.transform="translateX("+(mvEls[mE].p.x-mvEls[mE].p.mv.x0).toFixed(1)+"px)";
   for(var gI=0;gI<gates.length;gI++){var gt=gates[gI];gt.ph+=gt.spd*0.32*dt;   // the gate glides on its own clock (slow-mo slows it too, so a photo finish at the gate stays readable)
    var ocx=CC+Math.sin(gt.ph)*gt.travel;gt.l.x2=ocx-gt.ow/2;gt.r.x1=ocx+gt.ow/2;}
   if(draw)for(var gE=0;gE<gateEls.length;gE++){var ge2=gateEls[gE],sg=ge2.seg,ln=Math.max(0,sg.x2-sg.x1);
    ge2.el.style.left=sg.x1.toFixed(1)+"px";ge2.el.style.width=ln.toFixed(1)+"px";}
   // ELIMINATION variant: on every bell the trailing head gets a 1s red-flash warning, then is vacuumed off the course
   if(ON&&elimMode&&winner<0&&n>=goAt){
    var liveN=0,lastIx=-1,lastY=1e18;
    for(var eb=0;eb<balls.length;eb++){var EB=balls[eb];if(EB.fin||EB.out)continue;liveN++;if(EB.y<lastY){lastY=EB.y;lastIx=eb;}}
    if(liveN>1){
     if(doomIx<0&&n>=nextCut&&lastIx>=0){doomIx=lastIx;doomAt=n+1000;var dr=balls[doomIx].row;if(dr)dr.classList.add("doom");}
     if(doomIx>=0&&n>=doomAt){var curLast=-1,curY=1e18;for(var cl=0;cl<balls.length;cl++){var CB=balls[cl];if(CB.fin||CB.out)continue;if(CB.y<curY){curY=CB.y;curLast=cl;}}
      if(curLast>=0&&curLast!==doomIx){var odr=balls[doomIx].row;if(odr)odr.classList.remove("doom");doomIx=curLast;}   // the bell takes whoever is ACTUALLY last when it rings -- a saved chip escaping mid-warning is half the fun
      var DB=balls[doomIx];
      if(DB&&!DB.out&&!DB.fin){DB.out=true;outOrder.push(doomIx);
       try{var _lv=balls.length-outOrder.length-order.length;stake(faceFor(DB)+"<b>Out</b><span>"+_lv+" still in</span>",true);}catch(_){}   // the bell is this format's crossing: same pill, same beat
       try{if(window.__hmFX)window.__hmFX.burst(DB.x-HL,DB.y-camY,{count:14,color:"224,90,78",speed:420,gravity:600,life:0.6,size:4});}catch(_){}
       if(DB.row){DB.row.classList.remove("doom");}}
      doomIx=-1;nextCut=n+elimGap;}}
    else if(doomIx>=0){var dr2=balls[doomIx].row;if(dr2)dr2.classList.remove("doom");doomIx=-1;}
    if(liveN===1&&winner<0){for(var wj=0;wj<balls.length;wj++){if(!balls[wj].fin&&!balls[wj].out){winner=wj;balls[wj].fin=true;order.push(wj);balls[wj].peer.raceWin=true;if(balls[wj].row)balls[wj].row.classList.add("fin");
     try{if(window.__hmCareer&&balls[wj].peer.slot!=null)window.__hmCareer.rec("raceWin",balls[wj].peer.slot);}catch(_){}
     ts=0.28;endAt=clock+5200;try{bigText("Winner!");stake(faceFor(balls[wj])+"<b>1st</b><span>last one standing</span>",true);}catch(_){}break;}}}}
   // camera: ride the leader with a soft spring, never backward, and stop at the pen
   /* THE CAMERA HAS TO LEAVE THE WINNER. Two things pinned it at the finish the
      moment first place crossed. The leader search skipped only `out` racers, and
      a finisher is marked `fin`, never `out` -- so the winner stayed the leader
      forever. And the target was wrapped in Math.max(camY,...), which forbade the
      camera from EVER moving back up the course. Between them, second through
      twelfth were decided off-screen, which is most of the race and all of the
      part that decides who qualifies.
      Now the leader is whoever is still RUNNING, and once somebody is in, the
      camera is allowed back up to them -- on a slower spring than the chase, so
      the return reads as the camera choosing where to look rather than snapping.
      The no-backward rule still holds before the first finish, where it was doing
      real work: it stops the view jittering with the lead swapping mid-pack. */
   var leadY=-1e9,racing=0;
   for(var c2=0;c2<balls.length;c2++){var bC=balls[c2];if(bC.out||bC.fin)continue;racing++;if(bC.y>leadY)leadY=bC.y;}
   var tgt=camY;
   if(racing){tgt=Math.min(leadY-H*0.42,finishY+H*0.9-H);if(!order.length)tgt=Math.max(camY,tgt);}
   camY+=(tgt-camY)*Math.min(1,raw*(order.length?2.2:4));
   if(draw){
    if(world)world.style.transform="translateY("+(-camY).toFixed(1)+"px)";
    for(var sE=0;sE<spinEls.length;sE++){var se=spinEls[sE];se.el.style.transform="rotate("+((se.sp.a+se.k*Math.PI/se.sp.nb)*180/Math.PI).toFixed(1)+"deg)";}
    // hand every head its screen position (the mailbox its own frame loop follows)
    for(var m2=0;m2<balls.length;m2++){var bb=balls[m2],pr2=bb.peer;
     if(bb.out){pr2.raceHide=true;pr2.raceVX=0;pr2.raceVY=0;continue;}   // vacuumed heads HIDE IN PLACE -- parking them at -9999 stranded their restore and poisoned the next round with off-map ghosts
     pr2.raceX=bb.x-HL-pr2.HW/2;pr2.raceY=(bb.y-camY)-pr2.HH*0.55;pr2.raceVX=bb.vx;pr2.raceVY=bb.vy;
     pr2.raceHide=((bb.y-camY)<-pr2.HH*0.6)||((bb.y-camY)>H+pr2.HH);}   // off the camera window = OFF THE SCREEN: a head that hasn't reached this stretch yet must not float over the header
    // leaderboard: re-rank every ~0.3s, finished heads keep their locked position.
    // The keys come from standings() so the chips and the qualifier's result can never
    // tell two different stories about who beat whom.
    statT+=raw;if(statT>0.3){statT=0;
     var keys=standings().map(String),locked={},oi;
     for(oi=0;oi<order.length;oi++)locked[String(order[oi])]="fin";
     for(oi=0;oi<outOrder.length;oi++)locked[String(outOrder[oi])]="out";
     BOARD.rank(keys,locked,cutLine);}}
   /* ===== THE RACE ALWAYS ENDS =====
      endAt is only ever set when somebody crosses, so before this, a leader that
      wedged left the mode running with no exit but the End chip -- and in elimination,
      where the pack can reach the pen and stop dead, that was the normal case rather
      than the edge one. Watch the FRONT of the race: if the deepest live head has not
      gained ground in STALL_MS, the course has nothing left to give. In elimination
      that rings the bell immediately, so the bracket resolves at speed instead of
      waiting out a timer over a still picture. Everywhere else it wraps the race up on
      the standings as they stand. */
   if(ON&&n>=goAt+1000){
    /* ===== AND IT WAITS FOR ANYONE STILL RACING =====
       The geometry fix above stopped racers PARKING on the gate bars, and the trajectories
       then showed the other half of "some of them never cross the line": the race was
       hanging up on them. The wrap-up is a rolling window off the last CROSSING -- 7.6s
       when the winner lands, then 3s after each finisher -- and a field strung out over a
       third of the course cannot get home inside three seconds. Measured on one seed: the
       race was called at t=35.0s with SEVEN of twelve racers between 60% and 93% of the
       descent, every one of them still gaining 300-800px every two seconds. Nobody was
       stuck. They were abandoned.

       So progress at the BACK extends the deadline, exactly as a crossing does. leadY is
       already the deepest head that is neither finished nor out, so as the leaders go home
       it falls back onto the tail on its own -- this reads the number the stall detector
       was already keeping and asks the other question of it.

       IT CANNOT RUN FOREVER, and that is why this is safe rather than a hostage. The very
       next branch is STALL_MS: six seconds with the tail gaining nothing wraps the race up
       on the standings as they stand, and that clause is untouched. So the race now ends
       when the course has stopped giving, which is the honest condition, instead of when a
       stopwatch started by somebody else's finish runs out. The qualifier's own QRACE_MS
       backstop still sits over all of it. ===== */
    /* ===== THE FRONT OF THE RACE CHANGES IDENTITY EVERY TIME SOMEBODY GOES HOME =====
       stallY is a HIGH-WATER MARK of leadY, and leadY is the deepest head that is neither
       finished nor out. The moment the winner crosses, the deepest LIVE head is whoever is
       next -- thousands of pixels further up the hill -- so `leadY > stallY+24` became
       unsatisfiable for the rest of the race. From the winner's crossing on, the stall
       clock ran continuously no matter how fast the tail was descending, and STALL_MS then
       wrapped the race up six seconds later with the field still on the course. That is the
       whole of "some of them never cross the line": nobody was stuck, the race stopped
       asking.

       So the mark is re-based whenever the live field shrinks. It is the same question the
       detector always asked -- "is the front of this race gaining ground" -- asked of the
       front that actually exists now. A race whose remaining field has genuinely stopped
       still trips STALL_MS six seconds later, unchanged, because leadY then stops beating
       its own new mark. ===== */
    if(racing!==stallN){stallN=racing;stallY=leadY;stallAt=n;}
    if(leadY>stallY+24){stallY=leadY;stallAt=n;
     if(endAt)endAt=Math.max(endAt,n+2500);}
    else{if(!stallAt)stallAt=n;
     if(n-stallAt>STALL_MS){stallAt=n;
      if(elimMode&&winner<0)nextCut=Math.min(nextCut,n);
      else if(!endAt)endAt=n+1200;}}}
   /* A SCREEN CHANGE IS AN ABANDONMENT. Anything that takes the page somewhere else --
      the hub, a soccer match, the tournament -- drops body.hmRace, and the race has no
      other way to hear about it. Without this the simulation kept running invisibly and
      a qualifier waiting on it waited for a race nobody could see. */
   if(ON&&!document.body.classList.contains("hmRace")){finish("aborted");return;}
   if(endAt&&n>=endAt)finish("finished");
   if(winner>=0&&order.length>=balls.length)endAt=Math.min(endAt||1e18,n+1400);   // everyone's home -> wrap up quicker
  }
  /* The rAF driver. It used to re-request a frame forever: the exit test was
     `!ON && !balls.length`, and balls is only ever emptied by the NEXT start(), so
     after any race the page carried a permanent do-nothing callback on every frame
     for the rest of its life. Measured `running:true` on a page whose race had been
     over for ten seconds. `!ON` is the whole condition. */
  function loop(n){if(!ON){running=false;return;}
   requestAnimationFrame(loop);
   var raw=Math.min(0.05,Math.max(0.001,(n-lastN)/1000));lastN=n;
   if(DRIVE)return;             // ...and so does the hand crank, for the same reason
   if(document.hidden)return;   // the hidden driver owns the clock while nobody is looking; taking a rAF here as well would book the same seconds twice
   tickWorld(raw,true);
  }
 })();

 (function battleUI(){   // a quiet count of who is still standing
  var hero=document.querySelector(".hero");if(!hero)return;
  var el=document.createElement("div");el.className="battleCount";el.innerHTML='<b>0</b>&nbsp;left<button class="hmScoreEnd" type="button" aria-label="End the battle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1.6"/></svg>End</button>';
  gAdd(hero,el);var b=el.querySelector("b");var shownN=-1;
  el.querySelector(".hmScoreEnd").addEventListener("click",function(e){e.stopPropagation();window.__hmRespawn=performance.now();});   // end the battle right from the counter
  var cEl=document.createElement("div");cEl.className="hmCount";gAdd(hero,cEl);var cdN=0,wasOn=false;   // the big 3-2-1-GO before the brawl, and the winner call after
  function bigText(t){cEl.textContent=t;cEl.classList.remove("hmCountPulse");void cEl.offsetWidth;cEl.classList.add("hmCountPulse");}
  function countdown(){cdN++;var s=cdN,n=3;cEl.classList.remove("hmMsg");bigText(n);
   (function step(){if(s!==cdN||!document.body.classList.contains("hmBattle"))return;
    if(n>1){n--;setTimeout(function(){if(s!==cdN)return;bigText(n);step();},800);}
    else setTimeout(function(){if(s!==cdN||!document.body.classList.contains("hmBattle"))return;bigText("Go");setTimeout(function(){if(s===cdN)cEl.textContent="";},650);},800);})();}
  window.__hmBattleWin=function(txt){cdN++;cEl.classList.add("hmMsg");bigText(txt);setTimeout(function(){cEl.textContent="";cEl.classList.remove("hmMsg");},2800);};   // "Champion!" style call at the end
  var acc=0,lastT=performance.now();
  function tick(nowT){requestAnimationFrame(tick);
   // CENTRAL GUARDIAN: the hmBattle class is ON iff the latest battle request is newer than the latest respawn. One source of truth -> it can never desync or stick, no matter how frames are throttled.
   var _req=window.__hmBattleReq||0,_resp=window.__hmRespawn||0,_bon=_req>0&&_req>_resp,_hasB=document.body.classList.contains("hmBattle");
   if(_bon&&!_hasB&&!document.body.classList.contains("hmSoccer"))document.body.classList.add("hmBattle");
   else if(!_bon&&_hasB){document.body.classList.remove("hmBattle");try{if(window.__hmFX)window.__hmFX.clear();}catch(_){}if(window.PlayViewportOwner)window.PlayViewportOwner.leave("battle");}   // battle over -> wipe any lingering VFX even if the loop was throttled
   var on=document.body.classList.contains("hmBattle");
   if(on&&!wasOn)countdown();if(!on&&wasOn){cdN++;cEl.textContent="";}wasOn=on;
   if(!on){if(el.style.opacity!=="0"){el.style.opacity="0";shownN=-1;}return;}
   acc+=(nowT-lastT);lastT=nowT;if(acc<180)return;acc=0;   // ~5x/sec is plenty for a counter
   var n=0,inBT=0;for(var i=0;i<peers.length;i++){if(peers[i].inB){inBT++;if(!peers[i].elim&&!peers[i].__sinking)n++;}}   // a head melting into the lava is already OUT -> don't keep counting it as "left" (matches the winner check)
   if(n===2&&inBT>2&&!window.__hmDuel&&window.__hmLavaOn){window.__hmDuel=1;try{window.__hmBattleWin("last two!");}catch(_){}}   // two left: the stage is theirs -- every rung decays, the scroll leans in
   if(false){   // standings retired from lava -- watching who is left IS the drama there, and the ranking chips just pulled the eye away; the quiet pill carries the count on every viewport
    var inBN=0;for(var c4=0;c4<peers.length;c4++)if(peers[c4].inB)inBN++;
    if(window.__hmBoardSeed!==(window.__hmBattleReq||0)||window.__hmBoardN!==inBN){window.__hmBoardSeed=window.__hmBattleReq||0;window.__hmBoardN=inBN;window.__hmOutL=[];   // heads stream INTO the battle over the first beats -> rebuild until the whole field is on the board (a fixed early snapshot skipped the late arrivals and left rank numbers with holes)
     var L=[];for(var b4=0;b4<peers.length;b4++){if(peers[b4].inB)L.push({key:"s"+peers[b4].slot,slot:peers[b4].slot});}
     window.__hmBoard.build(L,function(){window.__hmRespawn=performance.now();});}
    var alive4=[],out4=window.__hmOutL||[];
    for(var b5=0;b5<peers.length;b5++){var P5=peers[b5];if(!P5.inB)continue;var k5="s"+P5.slot;
     if(P5.elim||P5.__sinking){if(out4.indexOf(k5)<0)out4.push(k5);}else alive4.push(P5);}
    alive4.sort(function(a,c){return a.y-c.y;});
    var keys4=alive4.map(function(p){return "s"+p.slot;}).concat(out4.slice().reverse());
    var lock4={};for(var o4=0;o4<out4.length;o4++)lock4[out4[o4]]="out";
    window.__hmBoard.rank(keys4,lock4);
    if(el.style.opacity!=="0"){el.style.opacity="0";}return;}   // the old counter pill retires where the standings run
   if(n!==shownN){shownN=n;b.textContent=n;}el.style.opacity="1";}
  requestAnimationFrame(tick);
 })();

 (function platforms(){   // the arena is an ENDLESS RECYCLING LADDER: rungs scroll down as the crowd climbs, and any rung swallowed by the lava is rebuilt above the highest one -- an infinite tower that never runs out and never repeats
  var hero=document.querySelector(".hero");if(!hero)return;
  function mob(){return innerWidth<=768;}
  var MAXP=20,els=[];for(var e=0;e<MAXP;e++){var d=document.createElement("div");d.className="hmPlat arrived";d.style.transition="opacity .5s cubic-bezier(.22,1,.36,1)";gAdd(hero,d);els.push(d);}
  var SL=[],rowN=0;   // slabs live in SCREEN space: {el,l,w,y,kind,mv,crumbAt,dead}
  function hw(){return innerWidth;}   // the ladder spans the WHOLE viewport -- the entire screen is the arena, edge to edge, not just the hero box
  function ox(){return Math.round(-hero.getBoundingClientRect().left);}
  function lx(){return innerWidth>640?104:6;}   // the standings rail: rungs keep out of it on desktop so the chips always read   // viewport-space -> hero-space shift, applied only at the render boundary
  function hh(){return hero.clientHeight||600;}
  function floorLine(){var st=document.getElementById("stage"),r=hero.getBoundingClientRect(),sr=st?st.getBoundingClientRect():null;return sr?(sr.bottom-r.top):(r.height*0.86);}
  function lavaAt(cx,OX){try{return window.__hmLavaY?window.__hmLavaY(cx+(OX==null?ox():OX)):hh()+400;}catch(_){return hh()+400;}}
  var GAPMIN=88,GAPMAX=126;   // ~6-7 rungs on screen, and only ~0.4 of a head's 250px leap: always clearable. Difficulty comes from NARROWER rungs, never a gap you can't clear.
  function rnd(a,b){return a+Math.random()*(b-a);}
  function kindOf(relief){if(relief)return "";var r=Math.random();
   if(r<0.24)return "pad";        // mint  -- springboard, the catch-up rung
   if(r<0.38)return "move";       // violet-- drifts side to side, ferries a stranded head back over
   if(r<0.50)return "crumble";    // amber -- gives way once stood on, so nobody camps
   return "";}
  function widthPx(W,relief){
   if(relief)return Math.round(W*(mob()?0.96:0.94));
   var tight=Math.min(1,(window.__hmLavaLevel||0)*1.1);   // the ONE difficulty lever: rungs narrow as the round matures
   var f=(mob()?rnd(0.26,0.42):rnd(0.13,0.24))-tight*(mob()?0.08:0.05);
   return Math.round(W*Math.max(mob()?0.17:0.085,f));}
  function clampL(c,wpx,W){return Math.round(Math.max(lx()+4,Math.min(W-wpx-4,c-wpx/2)));}   // rungs may hug either edge -- the whole screen is playable, so a head drifting wide still has somewhere to land
  function mkSlab(el,y,cx,relief){var W=hw(),wpx=widthPx(W,relief),k=kindOf(relief);
   return {el:el,l:clampL(cx,wpx,W),w:wpx,y:y,kind:k,mv:(k==="move")?((Math.random()<0.5?-1:1)*rnd(78,128)):0,crumbAt:0,dead:false};}   // a patrol rung has to visibly TRAVEL to read as one -- a slow creep just looks like drift
  function rowsAt(y){var o=[];for(var i=0;i<SL.length;i++){if(!SL[i].dead&&Math.abs(SL[i].y-y)<7)o.push(SL[i]);}return o;}
  function topY(){var m=1e9;for(var i=0;i<SL.length;i++){if(!SL[i].dead&&SL[i].y<m)m=SL[i].y;}return m===1e9?floorLine():m;}
  function siblingSpot(row,W,wpx){   // find the widest CLEAR span in this row (measured off the real slab edges, not their centres) so two rungs can never touch or overlap
   var GAPX=30,sorted=row.slice().sort(function(a,b){return a.l-b.l;}),iv=[],cur=lx(),i;
   for(i=0;i<sorted.length;i++){var s2=sorted[i];if(s2.l-GAPX-cur>=wpx)iv.push([cur,s2.l-GAPX]);cur=Math.max(cur,s2.l+s2.w+GAPX);}
   if(W-cur>=wpx)iv.push([cur,W]);
   if(!iv.length)return null;
   var best=iv[0];for(i=1;i<iv.length;i++)if((iv[i][1]-iv[i][0])>(best[1]-best[0]))best=iv[i];
   return best[0]+(best[1]-best[0])/2;}
  function respawn(s){var W=hw(),hi=topY(),row=rowsAt(hi),cap=mob()?2:3;
   var hasMover=false;for(var m=0;m<row.length;m++)if(row[m].mv)hasMover=true;   // never crowd a patrolling rung -- it would drift straight through its neighbour
   if(row.length&&row.length<cap&&!hasMover&&Math.random()<(row.length===1?0.80:0.34)){   // widen the CURRENT top row -- more than one way up means a head who falls has a route back
    var wtry=widthPx(W,false),spot=siblingSpot(row,W,wtry);
    if(spot!=null){var kk=kindOf(false);if(kk==="move")kk="";
     s.l=clampL(spot,wtry,W);s.w=wtry;s.y=hi;s.kind=kk;s.mv=0;s.crumbAt=0;s.dead=false;return;}}
   rowN++;var relief=(rowN%10===0);   // RELIEF: a full-width ledge every ~10 rows, a regroup beat before the next scrap
   var from=row.length?row[Math.floor(Math.random()*row.length)]:null;
   var span=Math.min(W*0.44,360);   // a head covers ~440px in a leap: stay inside 0.8 of that so every rung is genuinely crossable
   var cx=relief?(lx()+W)/2:(from?(from.l+from.w/2)+rnd(-span,span):lx()+rnd((W-lx())*0.12,(W-lx())*0.86));
   var ns2=mkSlab(s.el,hi-rnd(GAPMIN,GAPMAX),cx,relief);for(var k2 in ns2)s[k2]=ns2[k2];}
  function build(){var W=hw(),fl=Math.round(floorLine())-8;SL.length=0;rowN=0;
   for(var i=0;i<els.length;i++)SL.push({el:els[i],l:0,w:10,y:fl,kind:"",mv:0,crumbAt:0,dead:true});
   SL[0].dead=false;SL[0].l=lx();SL[0].w=Math.round(W-lx());SL[0].y=fl;SL[0].kind="";   // the OPENING GROUND: the entire floor, so the whole crowd starts spread out and nobody is crowded off at the whistle
   for(var j=1;j<SL.length;j++){SL[j].dead=false;respawn(SL[j]);}}
  var SKIN={pad:"",move:"",crumble:""},BORD={pad:"#2ea87c",move:"#7b5fd0",crumble:"#c2902f"};   // the GOAL-NET family: every rung is the same clean mesh bar the goals wear -- function reads purely from the coloured frame edge (mint springs, violet patrols, amber crumbles), the one asset language the whole arena shares
  function render(){var H=hh(),OX=ox(),inB=document.body.classList.contains("hmBattle");battlePlats.length=0;
   for(var i=0;i<SL.length;i++){var s=SL[i];if(!s.el)continue;
    var cx=s.l+s.w/2,lav=lavaAt(cx,OX),under=(s.y>lav-4);   // a rung level with the crust is already gone: it must never re-emerge below the lava
    var w9=s.w+"px";if(s.__w!==w9){s.__w=w9;s.el.style.width=w9;s.el.style.height=([15,11,9][s.kind==="crumble"?2:(s.kind?1:1)])+"px";}   // write-on-change only: 20 slabs x 5 style writes a frame was a steady style-recalc tax (the lag)
    var tf="translate("+(s.l+OX).toFixed(1)+"px,"+s.y.toFixed(1)+"px)";if(s.__tf!==tf){s.__tf=tf;s.el.style.transform=tf;}   // sub-pixel, shifted into hero space at the last moment: rounding every frame is what makes a scroll judder
    var bg=SKIN[s.kind]||"";if(s.__bg!==bg){s.__bg=bg;s.el.style.background=bg;s.el.style.borderColor=BORD[s.kind]||"";s.el.style.borderWidth=s.kind?"2px":"1px";}
    var vis=(inB&&!s.dead&&!under&&s.y>-30&&s.y<H+40);
    var op=vis?((s.crumbAt&&!s.dead)?"0.55":"1"):"0";if(s.__op!==op){s.__op=op;s.el.style.opacity=op;}
    if(vis)battlePlats.push({l:s.l+OX,r:s.l+s.w+OX,t:Math.round(s.y),pad:(s.kind==="pad"),id:i});}}
  window.__hmPlatTouch=function(id){var s=SL[id];if(!s||s.crumbAt||s.dead)return;
   var heat=window.__hmLavaLevel||0,duel=!!window.__hmDuel;
   var p=(s.kind==="crumble")?1:0;   // only the AMBER rung gives way -- one designated crumbler keeps the tell readable (a whole decaying floor read as chaos and starved the ladder)
   if(Math.random()<p){s.crumbAt=performance.now();s.crumbDur=1000+Math.random()*400;
    try{s.el.style.filter="brightness(.68) sepia(.55) hue-rotate(-18deg)";}catch(_){}}};   // it CHARS the moment it's doomed -- the tell reads before the fall
  window.__hmPlatSmash=function(id){var s=SL[id];if(s&&!s.dead){s.dead=true;try{s.el.style.filter="";}catch(_){}}};
  window.__hmPlatScroll=function(d,dt){if(!SL.length)return;var H=hh(),W=hw(),OXs=ox(),now=performance.now();
   dt=dt||0.016;
   for(var i=0;i<SL.length;i++){var s=SL[i];
    if(d)s.y+=d;
    if(s.mv&&!s.dead){s.l+=s.mv*dt;if(s.l<lx()+4){s.l=lx()+4;s.mv=Math.abs(s.mv);}else if(s.l>W-s.w-4){s.l=W-s.w-4;s.mv=-Math.abs(s.mv);}}   // the violet rungs patrol, ferrying stranded heads back toward the middle
    if(s.crumbAt&&!s.dead&&now-s.crumbAt>(s.crumbDur||950)){s.dead=true;try{s.el.style.filter="";}catch(_){}}}
   for(var g=0;g<SL.length;g++){var q=SL[g],qcx=q.l+q.w/2;
    if(q.dead||q.y>lavaAt(qcx,OXs)+30||q.y>H+120){q.dead=false;respawn(q);}}   // swallowed by the lava (or crumbled away) -> rebuilt above the top rung
   render();};
  build();render();
  /* build() tears down and re-creates every rung element; doing that once per
     resize EVENT rebuilt the whole tower dozens of times across one drag. */
  onResizeFrame(function(){build();render();});
  var arenaReq=0;
  window.__hmNewArena=function(){arenaReq=window.__hmBattleReq||0;window.__hmLavaLevel=0;build();render();};   // a brand-new random tower every fight
  setInterval(function(){var inB=document.body.classList.contains("hmBattle");
   if(inB&&(window.__hmBattleReq||0)!==arenaReq){window.__hmNewArena();return;}
   if(!inB){battlePlats.length=0;for(var i=0;i<els.length;i++)els[i].style.opacity="0";}},130);
 })();

 // ===== FLOOR IS LAVA: a rising molten pool (WebGL shader), a wavy glowing crust, heat haze, embers =====
 (function lava(){
  var hero=document.querySelector(".hero");if(!hero)return;
  (function(){if(!GAMES)return;var s=document.createElement("style");s.textContent="@keyframes hmHazeWob{0%{transform:translateY(2px) scaleY(1.04)}50%{transform:translateY(-1px) scaleY(0.99)}100%{transform:translateY(2px) scaleY(1.04)}}";document.head.appendChild(s);
   // real HEAT-SHIMMER refraction: animated turbulence displaces whatever is behind the haze band
   var svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("width","0");svg.setAttribute("height","0");svg.style.cssText="position:absolute;width:0;height:0";
   svg.innerHTML='<filter id="hmHeatFilter" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.011 0.05" numOctaves="2" seed="6" result="n"><animate attributeName="baseFrequency" dur="4.5s" values="0.011 0.05;0.014 0.062;0.010 0.044;0.011 0.05" repeatCount="indefinite"/></feTurbulence><feDisplacementMap in="SourceGraphic" in2="n" scale="11" xChannelSelector="R" yChannelSelector="G"/></filter>';
   gAdd(document.body,svg);})();
  // ---- the rising surface wave (shared by the crust render AND game logic so death lines up with what you see) ----
  var WAMP=7,WK1=0.021,WK2=0.052,WS1=1.1,WS2=1.7;
  function waveAt(xpx,t){return Math.sin(xpx*WK1+t*WS1)*WAMP + Math.sin(xpx*WK2 - t*WS2)*WAMP*0.45;}
  var level=0,surfaceY=1e9,lavaY=null,RISE_PX=36,LQ=0,frameC=0,fpsN=0,fpsT=0,lfC=0,lastStep=0,mutNext=18,mutT0=0,mutKind="",mutSeq=0,debris=[],arenaBottom=0,arenaW=0,arenaH=0,arenaFloor=0,heroLeft=0,running=false,t0=performance.now(),RISE_DUR=36000,embers=[],bubbles=[];   // lavaY = the chasing surface in screen space; RISE_PX = its base climb in px/s (scaled up as the round matures)   // ms to fill (slow + tense -- everyone starts on a platform above a pool that's ALREADY there)
  // ---- DOM: molten body (WebGL) + wavy crust (2D canvas) + heat haze band ----
  var wrap=document.createElement("div");wrap.className="hmLavaWrap";wrap.setAttribute("aria-hidden","true");
  wrap.style.cssText="position:absolute;left:0;right:0;bottom:0;top:0;pointer-events:none;z-index:8;opacity:0;transition:opacity .5s";   // molten body IN FRONT of the platforms + heads (clipped to below the surface) so anything the lava reaches vanishes under it
  var gcv=document.createElement("canvas");gcv.className="hmLavaGL";gcv.style.cssText="position:absolute;left:0;bottom:0;width:100%;height:100%;display:block";
  var crust=document.createElement("canvas");crust.className="hmLavaCrust";crust.style.cssText="position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none;z-index:9";
  var haze=document.createElement("div");haze.className="hmLavaHaze";haze.style.cssText="position:absolute;left:0;right:0;height:96px;pointer-events:none;z-index:10;opacity:0;transition:opacity .4s;-webkit-backdrop-filter:blur(1.4px) url(#hmHeatFilter) brightness(1.06) saturate(1.2);backdrop-filter:blur(1.4px) url(#hmHeatFilter) brightness(1.06) saturate(1.2);-webkit-mask-image:linear-gradient(to top,#000 30%,rgba(0,0,0,0));mask-image:linear-gradient(to top,#000 30%,rgba(0,0,0,0));background:linear-gradient(to top,rgba(255,130,35,.14),rgba(255,130,35,0));animation:hmHazeWob 2.1s ease-in-out infinite;animation-play-state:paused";
  var glow=document.createElement("div");glow.className="hmLavaGlow";glow.style.cssText="position:absolute;left:0;right:0;bottom:0;top:0;pointer-events:none;z-index:1;opacity:0;transition:opacity .5s;background:radial-gradient(120% 60% at 50% 100%,rgba(255,120,30,.28),rgba(255,80,10,.06) 45%,transparent 70%)";   // warm ambient glow stays BEHIND the heads as atmosphere
  wrap.appendChild(gcv);gAdd(hero,wrap);gAdd(hero,glow);gAdd(hero,crust);gAdd(hero,haze);

  // ---- WebGL molten shader (adapted from Jayden's lava gradient) ----
  var POINTS=[
   {bx:0.66,by:0.24,ax:0.20,ay:0.16,fx:1.6,fy:1.9,ph:0.0,p2:1.3,col:[0.890,0.310,0.016],heat:1.00},
   {bx:0.90,by:0.40,ax:0.18,ay:0.16,fx:2.1,fy:1.5,ph:1.7,p2:0.4,col:[0.968,0.588,0.235],heat:0.74},
   {bx:0.22,by:0.30,ax:0.20,ay:0.15,fx:1.4,fy:2.0,ph:2.6,p2:2.0,col:[0.980,0.720,0.360],heat:0.55},
   {bx:0.58,by:0.66,ax:0.22,ay:0.16,fx:2.3,fy:1.7,ph:0.7,p2:2.6,col:[0.812,0.243,0.004],heat:1.00},
   {bx:0.86,by:0.78,ax:0.18,ay:0.16,fx:2.0,fy:1.6,ph:3.1,p2:1.5,col:[0.968,0.560,0.250],heat:0.72},
   {bx:0.30,by:0.80,ax:0.23,ay:0.17,fx:1.7,fy:2.1,ph:4.2,p2:0.8,col:[0.953,0.435,0.278],heat:0.70}];
  var MESH_K=6.2,CREAM_W=0.045,g=function(n){return n.toFixed(4);};
  var MESH_ACCUM=POINTS.map(function(p){return "{ vec2 d = w - vec2("+g(p.bx)+" + "+g(p.ax)+"*sin(t*"+g(p.fx)+"+"+g(p.ph)+"), "+g(p.by)+" + "+g(p.ay)+"*cos(t*"+g(p.fy)+"+"+g(p.p2)+")); wt = exp(-dot(d,d)*"+g(MESH_K)+"); num += wt*vec3("+g(p.col[0])+","+g(p.col[1])+","+g(p.col[2])+"); den += wt; }";}).join("\n  ");
  var VERT="attribute vec2 a_pos; void main(){ gl_Position = vec4(a_pos,0.0,1.0); }";
  var FRAG="precision highp float;\nuniform vec2 u_res; uniform float u_time;\n"
   +"vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}\nvec2 mod289(vec2 x){return x - floor(x*(1.0/289.0))*289.0;}\nvec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}\n"
   +"float snoise(vec2 v){const vec4 C = vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);vec2 i = floor(v + dot(v, C.yy));vec2 x0 = v - i + dot(i, C.xx);vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;i = mod289(i);vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);m = m*m; m = m*m;vec3 x = 2.0*fract(p*C.www)-1.0; vec3 h = abs(x)-0.5; vec3 ox = floor(x+0.5); vec3 a0 = x-ox;m *= 1.79284291400159 - 0.85373472095314*(a0*a0 + h*h);vec3 gg; gg.x = a0.x*x0.x + h.x*x0.y; gg.yz = a0.yz*x12.xz + h.yz*x12.yw;return 130.0*dot(m, gg);}\n"
   +"float fbm(vec2 p){ float v=0.0; float a=0.5; for(int i=0;i<4;i++){ v += a*snoise(p); p = p*2.0+17.3; a *= 0.5; } return v; }\n"
   +"float hash21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }\n"
   +"float ign(vec2 p){ return fract(52.9829189 * fract(0.06711056*p.x + 0.00583715*p.y)); }\n"
   +"void main(){vec2 uv = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y) / u_res.xy;float t = u_time * 0.10;float breath = 1.0 + 0.13*sin(u_time*0.45);vec2 uvb = (uv-0.5)*(1.0 + 0.05*sin(u_time*0.4)) + 0.5;vec2 q = vec2(fbm(uvb*2.3 + t), fbm(uvb*2.3 + vec2(5.2,1.3) - t));vec2 warp = vec2(fbm(uvb*2.3 + 1.7*q + t*0.6), fbm(uvb*2.3 + 1.7*q + vec2(3.7,1.9) - t)) * (0.26*breath);vec2 w = uvb + warp;vec3 num = vec3(0.987,0.963,0.933)*"+g(CREAM_W)+"; float den = "+g(CREAM_W)+"; float wt;\n  "+MESH_ACCUM+"\nvec3 col = num/den;float lum = dot(col, vec3(0.299,0.587,0.114));col = clamp(mix(vec3(lum), col, 1.42), 0.0, 1.0);float cn=fbm(w*5.5 - t*0.3);float crust=smoothstep(0.12,0.5,cn);col=mix(col,col*vec3(0.22,0.11,0.09),crust*0.72);float crack=1.0-smoothstep(0.0,0.085,abs(cn-0.34));col+=crack*vec3(1.0,0.5,0.14)*(0.72+0.32*sin(u_time*2.0+w.x*20.0));float cn2=fbm(w*11.0+t*0.55);col=mix(col,col*0.5,smoothstep(0.35,0.62,cn2)*0.42);col+=pow(max(col-vec3(0.55),0.0),vec3(1.5))*1.05;col=clamp(col,0.0,1.0);col += (hash21(gl_FragCoord.xy + fract(u_time)) - 0.5) * 0.018;col += (ign(gl_FragCoord.xy + mod(u_time*57.0, 8.0)) - 0.5) * (2.5/255.0);gl_FragColor = vec4(clamp(col,0.0,1.0), 1.0);}";
  var gl=null,uRes=null,uTime=null,glOK=false,GW=1,GH=1;
  var SCALE=(innerWidth<=768?0.5:0.7);
  function initGL(){try{gl=gcv.getContext("webgl",{antialias:false,alpha:false,preserveDrawingBuffer:false});if(!gl)return false;
   function mk(type,src){var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.warn("lava shader:",gl.getShaderInfoLog(s));}return s;}
   var prog=gl.createProgram();gl.attachShader(prog,mk(gl.VERTEX_SHADER,VERT));gl.attachShader(prog,mk(gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(prog);gl.useProgram(prog);
   var buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
   var loc=gl.getAttribLocation(prog,"a_pos");gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
   uRes=gl.getUniformLocation(prog,"u_res");uTime=gl.getUniformLocation(prog,"u_time");glOK=true;return true;}catch(e){console.warn("lava GL init failed",e);return false;}}
  function sizeGL(){var r=hero.getBoundingClientRect();heroLeft=Math.round(r.left);arenaW=Math.round(innerWidth);arenaH=Math.round(r.height);arenaBottom=arenaH;
   var _st=document.getElementById("stage"),_sr=_st&&_st.getBoundingClientRect();arenaFloor=_sr?Math.round(_sr.bottom-r.top):Math.round(arenaH*0.86);   // the ground line the platforms measure up from -- the lava pools here at the start
   GW=Math.max(1,Math.floor(arenaW*SCALE));GH=Math.max(1,Math.floor(arenaH*SCALE));gcv.width=GW;gcv.height=GH;if(gl)gl.viewport(0,0,GW,GH);
   crust.width=arenaW;crust.height=arenaH;
   [wrap,glow,crust,haze].forEach(function(el){el.style.left=(-heroLeft)+"px";el.style.right="auto";el.style.width=arenaW+"px";});}   // edge-to-edge: stretch past the hero's side margins to fill the whole viewport width
  var cctx=crust.getContext("2d");
  function active(){return document.body.classList.contains("hmBattle");}
  // ---- exposed hooks for game logic ----
  window.__hmLavaOn=false;
  window.__hmLavaY=function(xpx){return surfaceY+waveAt(xpx,(performance.now()-t0)/1000);};   // the death line at this x (hero-local)
  var lastReq=0;
  function start(){t0=performance.now();level=0;lavaY=null;lastStep=0;mutNext=18;mutT0=0;mutKind="";mutSeq=Math.floor(Math.random()*3);debris.length=0;window.__hmWind=null;window.__hmDuel=0;embers.length=0;bubbles.length=0;window.__hmSinkBusy=0;lastReq=window.__hmBattleReq||0;
   RISE_DUR=Math.max(19000,Math.min(38000,12000+(window.__hmCrowd||6)*3400));   // fewer heads -> a faster climb so a small game gets tense quickly instead of everyone standing around
   if(!gl&&!initGL()){/* no webgl: crust-only fallback */}sizeGL();running=true;wrap.style.opacity="1";glow.style.opacity="1";window.__hmLavaOn=true;requestAnimationFrame(loop);}
  function stop(){
  try{var _h=document.querySelector('.hero'); if(_h)_h.style.minHeight='';
      document.body.classList.remove('tSchedOpen');}catch(_){}running=false;window.__hmLavaOn=false;wrap.style.opacity="0";glow.style.opacity="0";haze.style.opacity="0";haze.style.animationPlayState="paused";haze.__on="0";surfaceY=1e9;level=0;embers.length=0;bubbles.length=0;if(cctx)cctx.clearRect(0,0,crust.width,crust.height);}
  var wasOn=false,lastFrame=performance.now();
  function loop(n){if(!active()){if(wasOn){stop();wasOn=false;}return;}
   requestAnimationFrame(loop);var tsec=(n-t0)/1000;
   if((window.__hmBattleReq||0)!==lastReq){lastReq=window.__hmBattleReq||0;t0=n;lavaY=null;embers.length=0;}   // a NEW game -> restart the rise from the bottom (survives a throttled start/stop)
   // rise: hold during the 3-2-1 countdown, then climb from just under the floor to the top over RISE_DUR
   var _lin=Math.min(1,Math.max(0,(n-t0-2900)/RISE_DUR));level=Math.pow(_lin,1.34);   // EASE-IN: creeps up slowly at first (long jostle on the platforms) then climbs faster for a tense finish
   window.__hmLavaLevel=level;   // 0..1 rise progress -- the platforms read this to DROP IN higher tiers as the lava climbs
   var dt=Math.min(0.05,Math.max(0.001,(n-lastFrame)/1000));
   frameC++;fpsN++;fpsT+=dt;if(dt>0.034)lfC++;if(fpsT>2){var _lr=lfC/fpsT;fpsN=0;fpsT=0;lfC=0;if(_lr>3.5&&!LQ){LQ=1;try{haze.style.display="none";glow.style.display="none";}catch(_){}}else if(_lr<1&&LQ){LQ=0;try{haze.style.display="";glow.style.display="";}catch(_){}}}   // ADAPTIVE QUALITY, SPIKE-gated: profiling showed the stutter is GPU raster spikes (blurred glow/haze layers), not JS and not average fps -- so the trigger is long-frame RATE (>6/s sheds the blurred layers + halves crust + thins embers; <1/s restores them)
   // ===== THE CLIMB: the arena scrolls at a STEADY, telegraphed pace -- never chained to any one head, so it reads perfectly smooth and no single leap can ever yank the view =====
   var _el=(n-t0)/1000,_go=Math.max(0,_el-3.4);   // a grace beat at the whistle: everyone lands and settles on the base before the floor starts moving
   var STEP=Math.min(5,Math.floor(_go/12));       // the scroll steps up a notch every ~12s instead of creeping continuously, so each escalation is an EVENT you can feel (Icy Tower's ladder)
   if(STEP>lastStep)lastStep=STEP;   // the gear change happens silently -- the viewer is WATCHING, not playing; the speed itself is the message
   var camD=(_go<=0)?0:(33+STEP*14)*(window.__hmDuel?1.5:1)*dt;           // 33 px/s at the open, 103 px/s by the last step -- pitched just under a committed climber's pace, so keeping up is real work but never hopeless
   if(camD>0)window.__hmClimb=(window.__hmClimb||0)+camD;
   if(window.__hmPlatScroll)window.__hmPlatScroll(camD,dt);
   // ===== the lava is PINNED near the bottom of the frame: it IS the screen's floor, always on camera, and the scroll is what drags a slow head down into it =====
   if(lavaY==null)lavaY=(arenaFloor||arenaH*0.86)+10;
   // ===== ARENA MUTATIONS: wait -> telegraph -> execute, one beat at ~20s/40s/60s (the BR zone grammar) =====
   var surgeOff=0;
   if(_go>mutNext){mutNext+=20+Math.random()*6;mutT0=n;mutKind=["surge","debris","wind"][mutSeq++%3];
    try{window.__hmBattleWin(mutKind==="surge"?"uh oh\u2026":(mutKind==="debris"?"rocks!":"whoosh!"));}catch(_){}   // playful, not stressful: the room leans in, it never barks at you
    if(mutKind==="wind"){var _wd=(Math.random()<0.5?-1:1);window.__hmWind={v:_wd*60,ax:_wd*192,until:n+3000+2000};}   // BOTH shapes: the crate emits {ax}, this emitted only {v}, and the consumer reading .ax got undefined -> vx+=undefined -> NaN on every airborne head in the same tick (the long-unnamed emitter)
    if(mutKind==="debris"){for(var db=0;db<3;db++)debris.push({x:innerWidth*(0.15+Math.random()*0.7),y:-40-db*90,vy:0,arm:n+1200});}}
   if(mutKind==="surge"&&mutT0){var mt=(n-mutT0)/1000;
    if(mt<2.6)surgeOff=0;                                    // telegraph: the banner + boiling, nothing moves yet
    else if(mt<4.1)surgeOff=120*((mt-2.6)/1.5);              // the SURGE: +120px in 1.5s
    else if(mt<8.1)surgeOff=120*(1-(mt-4.1)/4);              // recede over 4s
    else{mutKind="";}}
   for(var dbi=debris.length-1;dbi>=0;dbi--){var rk=debris[dbi];
    if(n<rk.arm)continue;   // its warning shadow is painted by the heads' FX ring below
    rk.vy+=2400*dt;rk.y+=rk.vy*dt;
    if(!rk.el){rk.el=document.createElement("div");rk.el.style.cssText="position:absolute;width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 34% 30%,#6b6560,#2e2a27);box-shadow:0 4px 10px rgba(20,18,16,.5);z-index:3;pointer-events:none";hero.appendChild(rk.el);
     try{if(window.__hmFX)window.__hmFX.ring(rk.x-heroLeft,arenaH*0.5,{r0:8,r1:40,color:"120,110,100",width:2.5,life:0.9});}catch(_){}}
    rk.el.style.transform="translate("+(rk.x-heroLeft-13)+"px,"+(rk.y-13)+"px)";
    for(var rp=0;rp<battlePlats.length;rp++){var RP=battlePlats[rp];
     if(rk.x>RP.l+heroLeft&&rk.x<RP.r+heroLeft&&rk.y>RP.t-8&&rk.y<RP.t+18){if(window.__hmPlatSmash)window.__hmPlatSmash(RP.id);
      try{if(window.__hmFX){window.__hmFX.burst(rk.x-heroLeft,rk.y,{count:12,color:"120,110,100",speed:340,gravity:800,life:0.55,size:5});window.__hmFX.shake(5);}}catch(_){}
      try{rk.el.remove();}catch(_){}debris.splice(dbi,1);rk=null;break;}}
    if(rk&&rk.y>arenaH+60){try{rk.el.remove();}catch(_){}debris.splice(dbi,1);}}
   var _mark=arenaH*(0.93-Math.min(0.16,_go*0.0020))-surgeOff;   // it creeps up as the round matures -- and JUMPS when a surge hits
   lavaY+=(_mark-lavaY)*Math.min(1,dt*1.5);   // eased onto its mark: it never snaps, and it can never leave the screen
   surfaceY=lavaY;
   // molten body: render + clip to below the surface
   if(glOK){gl.uniform2f(uRes,GW,GH);gl.uniform1f(uTime,tsec);gl.drawArrays(gl.TRIANGLES,0,3);}
   var clipTop=Math.max(0,Math.round(surfaceY-WAMP*1.6));gcv.style.clipPath="inset("+clipTop+"px 0 0 0)";gcv.style.webkitClipPath="inset("+clipTop+"px 0 0 0)";
   // wavy glowing crust at the surface
   if(!LQ||frameC%2===0)drawCrust(tsec);
   // BUBBLES: molten domes swell up from within and burst at the surface (the real "boiling lava" tell)
   if(cctx&&surfaceY<arenaH-34&&Math.random()<dt*(LQ?2:5)){bubbles.push({x:Math.random()*arenaW,depth:24+Math.random()*46,mr:5+Math.random()*11,t:0});}
   if(cctx)for(var bi=bubbles.length-1;bi>=0;bi--){var bu=bubbles[bi];bu.t+=dt;bu.depth-=(15+bu.mr)*dt;var br=bu.mr*Math.min(1,bu.t*1.3),bsurf=surfaceY+waveAt(bu.x-heroLeft,tsec);
    if(bu.depth<=0){cctx.beginPath();cctx.arc(bu.x,bsurf,br*1.5,0,6.283);cctx.strokeStyle="rgba(255,222,130,0.7)";cctx.lineWidth=2;cctx.stroke();
     if(window.__hmFX&&br>7)window.__hmFX.burst(bu.x,bsurf,{count:3,color:"255,185,75",speed:110,gravity:520,life:0.4,size:3});bubbles.splice(bi,1);continue;}
    var by=bsurf+bu.depth;cctx.beginPath();cctx.arc(bu.x,by,br,0,6.283);cctx.fillStyle="rgba(255,205,95,0.26)";cctx.fill();
    cctx.beginPath();cctx.arc(bu.x-br*0.3,by-br*0.34,br*0.42,0,6.283);cctx.fillStyle="rgba(255,242,185,0.42)";cctx.fill();}
   // embers: little glowing motes drifting up off the lava, then winking out
   if(surfaceY<arenaH-20&&Math.random()<dt*(LQ?14:34)){var ex=Math.random()*arenaW;embers.push({x:ex,y:surfaceY+waveAt(ex-heroLeft,tsec)-2,vx:(Math.random()*26-13),vy:-(30+Math.random()*60),life:1,max:1.2+Math.random()*1.6,r:1+Math.random()*2.4});}
   if(cctx){for(var ei=embers.length-1;ei>=0;ei--){var em=embers[ei];em.life-=dt/em.max;if(em.life<=0){embers.splice(ei,1);continue;}
    em.vy+=6*dt;em.x+=em.vx*dt;em.y+=em.vy*dt;var ea=em.life;
    cctx.beginPath();cctx.arc(em.x,em.y,em.r,0,6.283);cctx.fillStyle="rgba(255,"+(150+ea*90|0)+","+(40+ea*90|0)+","+(ea*0.9).toFixed(2)+")";cctx.shadowColor="rgba(255,140,40,"+ea.toFixed(2)+")";cctx.shadowBlur=6;cctx.fill();}
    cctx.shadowBlur=0;}
   // heat haze band sits just above the surface
   /* THE HAZE ONLY SHIMMERS WHEN IT IS ON SCREEN. hmHazeWob animates a
      transform, which would normally ride the compositor for free -- but this
      element carries a backdrop-filter, and Chromium cannot composite an
      animation on a backdrop-filtered layer, so it falls back to the main
      thread and costs a style recalculation on EVERY frame. The haze is
      created at page load and is invisible outside a lava fight, so that was
      ~60 recalcs a second, forever, on every visit to Play, to shimmer
      something at opacity 0. It now runs only while it is actually showing,
      and the writes are elided so a steady state costs nothing. */
   haze.style.top=Math.round(surfaceY-90)+"px";
   var _hzOn=(surfaceY<arenaH-20)?"1":"0";
   if(haze.__on!==_hzOn){haze.__on=_hzOn;haze.style.opacity=_hzOn;
    haze.style.animationPlayState=(_hzOn==="1")?"running":"paused";}
   lastFrame=n;wasOn=true;}
  function drawCrust(tsec){if(!cctx)return;cctx.clearRect(0,0,crust.width,crust.height);
   var W=crust.width,sy=surfaceY;if(sy>arenaH-4)return;
   // ONLY a thin hot glow band hugging the surface (fades out ~52px down) so the WebGL molten body shows through below
   cctx.save();cctx.beginPath();cctx.moveTo(0,sy+waveAt(-heroLeft,tsec));
   for(var xx=0;xx<=W;xx+=5){cctx.lineTo(xx,sy+waveAt(xx-heroLeft,tsec));}
   cctx.lineTo(W,sy+54);cctx.lineTo(0,sy+54);cctx.closePath();
   var grd=cctx.createLinearGradient(0,sy-4,0,sy+54);grd.addColorStop(0,"rgba(255,228,150,0.9)");grd.addColorStop(0.32,"rgba(255,155,55,0.5)");grd.addColorStop(1,"rgba(255,110,20,0)");
   cctx.fillStyle=grd;cctx.fill();
   // bright wavy crest line + bloom
   cctx.beginPath();cctx.moveTo(0,sy+waveAt(-heroLeft,tsec));for(var x2=0;x2<=W;x2+=5){cctx.lineTo(x2,sy+waveAt(x2-heroLeft,tsec));}
   cctx.lineWidth=2.5;cctx.strokeStyle="rgba(255,242,175,0.95)";cctx.shadowColor="rgba(255,150,40,0.95)";cctx.shadowBlur=16;cctx.stroke();
   cctx.restore();}
  // start/stop with the mode
  setInterval(function(){var on=active();if(on&&!running)start();else if(!on&&running){stop();wasOn=false;}},120);
  addEventListener("resize",function(){if(running)sizeGL();},{passive:true});
 })();

 function showPodium(topN,groundY){   // raise the pedestals ONTO the ground (groundY = the real floor line, feet+shadows), return each rank's head target
  var hero=document.querySelector(".hero");if(!hero)return {};
  if(!podiumEls.length)for(var m=0;m<3;m++){var d=document.createElement("div");d.className="hmPodium";d.innerHTML='<b></b>';hero.appendChild(d);podiumEls.push(d);}
  document.body.classList.add("hmPodium");   // the arena platforms clear off while the ceremony is up
  var w=hero.clientWidth,pw=Math.max(72,Math.min(150,w*0.11)),gap=Math.max(8,pw*0.14),cx=w*0.5,H=[104,74,52];
  var order=[{cx:cx,rank:1},{cx:cx-pw-gap,rank:2},{cx:cx+pw+gap,rank:3}],spots={};
  order.forEach(function(o,i){var el=podiumEls[i];if(!el)return;
   if(i>=topN){el.classList.remove("show");return;}
   var h=H[i],pt=groundY-h;el.style.width=pw+"px";el.style.height=h+"px";el.style.transform="translate("+(o.cx-pw/2).toFixed(1)+"px,"+pt.toFixed(1)+"px)";   // bottom of the block sits on groundY
   el.querySelector("b").textContent=o.rank;el.classList.add("show");
   spots[o.rank]={cx:o.cx,top:pt};});
  return spots;}
 function hidePodium(){podiumEls.forEach(function(e){e.classList.remove("show");});document.body.classList.remove("hmPodium");}

 // mini-Jayden: when a game has an ODD number of players, the big head shrinks in to even the sides (and makes a 1-head game playable)
 var fillerActive=false,FSLOT=9001,fillerCut=null;
 /* ---- Mini-Jayden stands on his CHIN, not on his frame. The big head is a SQUARE cutout
   with its own transparent margin below the chin, so drawing it at (0,0,500,500) into a
   500x600 frame put his ink bottom at 0.748 of the box. Every other head is a headmaker
   cut whose ink bottom sits at 0.9375. The engine has ONE global FOOT (0.945) used as
   HH*FOOT in ~25 physics sites, so a single constant cannot serve both -- he floated by
   ~19% of his own height, which is the gap you see at his chin. Rather than thread a
   per-head foot through the whole solver, measure his real ink bottom and shift the draw
   so it lands on the same plane. Self-correcting if the art or FOOT ever changes. ---- */
function bakeMiniCut(img){
 var W=500,H=600,c=document.createElement("canvas");c.width=W;c.height=H;
 var g=c.getContext("2d");g.drawImage(img,0,0,W,W);
 try{var d=g.getImageData(0,0,W,H).data,last=-1,y,x;
  for(y=H-1;y>=0&&last<0;y--){for(x=0;x<W;x++){if(d[(y*W+x)*4+3]>24){last=y;break;}}}
  var target=Math.round(H*(window.__hmFOOT||0.945));
  if(last>0&&Math.abs(target-last)>1){g.clearRect(0,0,W,H);g.drawImage(img,0,target-last,W,W);}
 }catch(_){}
 var u=c.toDataURL("image/webp",0.92);
 return u.indexOf("data:image/webp")===0?u:c.toDataURL("image/png");}
function fillerData(){   // split out so the TOURNAMENT can field him as a captain, not just spawn him
  var face=document.getElementById("face");if(!face||!face.complete||!face.naturalWidth)return null;
  // the big head is a SQUARE cutout; bake it into a 5:6 frame at its true aspect (never stretched) so the mini-Jayden reads exactly like him, just smaller
  try{fillerCut=bakeMiniCut(face);}catch(_){fillerCut=face.src;}
  // his REAL feature positions (from FACES.rest), mapped square->5:6 by dividing y by 1.2
  var data={cut:fillerCut,__filler:true,__mirror:true,   // __mirror: it IS the big head, cloned and shrunk -- same face, same eyes, same expressions
   eyes:[{x:0.400,y:0.431,w:0.100,h:0.040,ang:0,sc:"rgb(236,234,229)",ic:[46,35,28]},{x:0.603,y:0.439,w:0.100,h:0.040,ang:0,sc:"rgb(236,234,229)",ic:[46,35,28]}],
   marks:{BL:{x:0.375,y:0.392},BR:{x:0.625,y:0.398},M:{x:0.500,y:0.632},N:{x:0.500,y:0.520}}};   // (eyes/marks kept as a fallback + for the cut-based masks)
  return data;}
 window.__hmFillerData=fillerData;
 window.__hmFillerAdd=function(){if(fillerActive)return;var data=fillerData();if(!data)return;
  spawnCompanion(data,FSLOT);var m=peers[peers.length-1];if(m)m.__filler=true;fillerActive=true;
  // he has more to work with than the little heads: bake his SMILE too, so the mini-Jayden grins when he scores or wins
  try{var si=new Image();si.onload=function(){try{var scut=bakeMiniCut(si);if(m)m.__smileCut=scut;}catch(_){}};si.src="images/smile.webp";}catch(_){}};
 window.__hmFillerRemove=function(){if(!fillerActive)return;try{if(window.__hmKill&&fillerCut){window.__hmKill(fillerCut);var L=window.__hmLive||[];for(var i=L.length-1;i>=0;i--){if(L[i].cut===fillerCut)L.splice(i,1);}}}catch(_){}fillerActive=false;fillerCut=null;};   // also drop the dead __hmLive entry so it can't pile up across games
 window.__hmRealHeads=function(){var n=0;for(var i=0;i<peers.length;i++){if(!peers[i].__filler)n++;}return n;};
 window.__hmSlotFor=function(cut){for(var i=0;i<peers.length;i++)if(peers[i].cut===cut)return peers[i].slot;return null;};   // already on the pitch? reuse it -- BY PICTURE, which is only sound for a head the caller has never been given a pid for (the visitor's own saved companions). Anything with a pid must use __hmSlotForPid: cuts are re-encoded on respawn and two identically dyed eggheads share one.
 window.__hmSlotForPid=function(pid){if(pid==null)return null;for(var i=0;i<peers.length;i++)if(peers[i].pid===pid)return peers[i].slot;return null;};   // the same question asked of a stable id instead of image bytes
 window.__hmTagSlot=function(slot,pid){if(pid==null)return;for(var i=0;i<peers.length;i++)if(peers[i].slot===slot){peers[i].pid=pid;return;}};   // adopt a head that was already standing here (spawned from the saved roster, so it has no pid of its own yet)
  window.__hmSlots=function(){return peers.map(function(p){return p.slot;});};
  window.__hmSpawnOne=function(d,slot){try{if(!d||!d.cut)return;spawnCompanion(d,typeof slot==="number"?slot:peers.length);}catch(_){}};   // drop a fresh head into the live scene mid-session (the Play menu's "Add an egghead")
 /* THE STAND-IN LEAVES WHEN THE GAME DOES -- AND THE RACE IS A GAME. `hmRace` was missing
    from this list, and the consequence was not a cosmetic one: play-games.js adds the
    mini-Jayden on an odd roster and then waits 500ms before dropping the grid, so that he
    is fully spawned and "would not race as a ghost". This sweep runs every 400ms. 500 is
    longer than 400, so the wait that exists to include him is exactly what guaranteed he
    was gone before the countdown. Measured on play.html with eleven heads seeded: the
    roster goes 11 -> 12 on the same tick as __hmFillerAdd(), and back to 11 within 450ms,
    every time. He has never started a marble race. */
 setInterval(function(){if(fillerActive&&!document.body.classList.contains("hmSoccer")&&!document.body.classList.contains("hmBattle")&&!document.body.classList.contains("hmRace"))window.__hmFillerRemove();},400);
})();
