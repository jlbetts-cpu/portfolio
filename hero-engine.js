/* DEV-ONLY, opt-in via ?wraf=1: drive requestAnimationFrame from a Web-Worker timer so the head engine keeps ticking at ~60fps even when this tab is backgrounded/hidden (Chrome pauses native rAF on hidden docs). Totally inert for real visitors -- it does nothing without the query flag. */
(function(){try{if(!/[?&]wraf=1/.test(location.search))return;
 var blob=new Blob(["var t=setInterval(function(){postMessage(0);},15);onmessage=function(){};"],{type:"application/javascript"});
 var w=new Worker(URL.createObjectURL(blob)),q=[],nid=1;
 w.onmessage=function(){var cbs=q;q=[];var now=performance.now();for(var i=0;i<cbs.length;i++){try{cbs[i].fn(now);}catch(e){}}};
 window.requestAnimationFrame=function(fn){var h=nid++;q.push({h:h,fn:fn});return h;};
 window.cancelAnimationFrame=function(h){for(var i=0;i<q.length;i++){if(q[i].h===h){q.splice(i,1);break;}}};
}catch(e){}})();
const FACES={
 neutral:{browsup:"images/neutral_browsup.webp",img:"images/neutral.webp",closed:"images/neutral_closed.webp",eyes:[{x:0.3999,y:0.5176},{x:0.6018,y:0.5265}]},
 rest:{img:"images/rest.webp",closed:"images/rest_closed.webp",eyes:[{x:0.4,y:0.5169},{x:0.6041,y:0.5269}]},
 wink:{img:"images/wink.webp",closed:"images/wink_closed.webp",eyes:[{x:0.4,y:0.5169,ry:0.0172}]},
 smile:{img:"images/smile.webp",closed:"images/smile_closed.webp",eyes:[],noIris:true}
};
/* ===== HOST MODE =====
   This file runs on TWO pages. index.html is the portfolio: it owns the cycling headline, the
   nav, the reel, the About takeover and the Play menu, and it is the default -- HEADONLY is
   false there and nothing below changes for it. play.html loads the SAME engine for one
   reason: mini-Jayden (the odd-count filler) renders by CLONING the live #stage, so his eyes
   have to be the big head's actual eyes, not a rebuild that drifts. play.html therefore sets
   window.__hmHeroHeadOnly=true immediately before the script tag.
   HEADONLY only ever gates PAGE FURNITURE -- the portfolio's intro cinematic and the Play-menu
   wiring that play-games.js already owns on play.html. The head itself (faces, eye build,
   blink, gaze, moods, idles, the 8fps clock) runs identically on both, which is the whole
   point: there is exactly one head engine now. */
const HEADONLY=window.__hmHeroHeadOnly===true;
const PFX="";
const RX=0.0385,RY=0.0192,IRIS_W=0.6,IRIS_H=1.05,TRAVEL=0.16,SENS=340;
const WINK_LINGER=300,SMILE_LINGER=350,IDLE_MS=2500;
const HOVER=matchMedia("(hover: hover) and (pointer: fine)").matches;
const WORDS=["hunger.","delight.","love.","empathy."];
const WORD_STYLE=["hungry","party","love","collab"]; // each cycling word animates by its meaning (Identity/Soul retired with the Identity mood)
/* THE HEADLINE, SETTLED. Jayden: "SF product designer. iOS, B2C and design systems."
   Two sentences, lowercase "product", both full stops -- set exactly as he wrote it.
   docs/superpowers/specs/2026-08-03-hero-headline.md carries the analysis; the number
   that decided it is 49 characters wrapping to TWO lines at 40px/1280 against the old
   headline's three, which hands ~45px back to the hero and lifts the head.
   THE "with [mood]" CLAUSE IS GONE, and the cycling word with it. That word was the
   only place the four moods were NAMED; they still fire from the Play menu and still
   change the big head's expression, so the feature survives and only its label is
   retired. No new UI replaces the label -- the four rows in the Play menu already read
   as mood names.
   SUBTXT stood here: a plain-text mirror of the headline with no reader anywhere in
   the repo. Deleted rather than updated to match the new words. */
const STATIC=["SF","product","designer.","iOS,","B2C","and","design","systems."];
const reduce=window.matchMedia("(prefers-reduced-motion:reduce)").matches;
const stage=document.getElementById("stage"),faceImg=document.getElementById("face"),h1=document.getElementById("h1");
const movieEffectsStage=document.getElementById("heroMovieEffectsStage");
try{faceImg.addEventListener("dragstart",function(e){e.preventDefault();});stage.addEventListener("dragstart",function(e){e.preventDefault();});}catch(_){}
let curFace="neutral",eyeEls=[],pointer={px:innerWidth*.5,py:innerHeight*.42},tk=0;
let CALIB=false,calFace="neutral",selEye=0,dragging=false,dragEl=null,paraX=0,paraY=0;
let baseFace="neutral",activeHover=null,holdFace=null,holdTimer=null,eventLock=false,dizzy=false,dizzyStart=0,scrollPull=0,scrollTarget=0,scrollFollow=0,headGliding=false;
let gaze={x:0,y:0},nextSaccade=0,lastMove=0;
let irisDil=1,irisDilTarget=1,irisDilBase=1;   // pupil dilation: live value, transient target, sustained baseline (raised by mood)
let microSacX=0,microSacY=0,microSacTX=0,microSacTY=0,microSacNext=0;   // fixational micro-saccades — the gaze never locks dead-still
let EYE_OUT=0.0;   // per-eye temporal bias; 0 = perfectly parallel (any bias here pushed the eyes wall-eyed)
let blinking=false,eyesClosed=false,blinkSquash=1,pendingFace=null;
let curRot=0,curSc=1,curTX=0,curTY=0,gType=null,gStart=0,blinkQ=[];  // expression pose + one-shot gesture + blink step queue
function ER(c,k,d){return c[k]!=null?c[k]:d;}

function makeWord(t,c){const w=document.createElement("span");w.className="word"+(c?" "+c:"");[...t].forEach(ch=>{const s=document.createElement("span");s.className="ch";s.textContent=ch;w.appendChild(s);});return w;}
const CYC_STAG=0.05;   // one uniform per-character cascade for every word (the focus look)
function makeCycWord(i,defer,noInteract){const st=WORD_STYLE[i];const w=document.createElement("span");w.className="cycw"+(st==="hungry"?" hungry":"")+(st==="party"?" party":"")+(st==="love"?" love":"")+(st==="collab"?" collab":"")+(st==="identity"?" identity":"");const chars=[...WORDS[i]];
 chars.forEach((ch,ci)=>{const sp=document.createElement("span");var isParty=(st==="party");var isLoveW=(st==="love");var isCookie=(st==="hungry"&&ch===".");var isDisco=(isParty&&ch===".");var isHeart=(isLoveW&&ch===".");var isCam=(st==="collab"&&ch===".");var isId=(st==="identity"&&ch===".");sp.className="cyc-ch"+(isCookie?" cookieDot":"")+(isDisco?" discoDot":"")+(isHeart?" heartDot":"")+(isCam?" camDot":"")+(isId?" fpDot":"")+(defer?"":" in");if(!isCookie&&!isDisco&&!isHeart&&!isCam&&!isId)sp.textContent=ch;sp.style.animationDelay=(ci*CYC_STAG).toFixed(3)+"s";
  if(defer)sp.style.opacity="0";                                                   // deferred build: stay hidden until the static line has landed
  sp.addEventListener("animationend",()=>sp.classList.remove("in"),{once:true});   // drop the layer once it has focused in -> Safari composites the ink texture
  w.appendChild(sp);});
 if(!noInteract&&st==="hungry")attachHunger(w);
 if(!noInteract&&st==="party")attachParty(w);
 if(!noInteract&&st==="love")attachLove(w);
 if(!noInteract&&st==="collab")attachCollab(w);if(!noInteract&&st==="identity")attachIdentity(w); 
 /* drag affordance is the cursor (grab) + the periodic tug-nudge (maybeTugDemo) — no tacked-on text label, keeps the hero spacing clean */
 return w;}
function revealCycWord(w){if(!w)return;
 w.classList.remove("out");var chs=[...w.querySelectorAll(".cyc-ch")];chs.forEach(sp=>{sp.style.opacity="";sp.style.filter="";sp.classList.remove("in");});void w.offsetWidth;chs.forEach(sp=>{sp.classList.add("in");sp.addEventListener("animationend",function(){sp.classList.remove("in");sp.style.filter="";},{once:true});});clearTimeout(w._cycClr);w._cycClr=setTimeout(function(){chs.forEach(sp=>{sp.classList.remove("in");sp.style.filter="";sp.style.opacity="";});},1100);}  // fire the deferred first word
let cycWord;var dragLearned=false;document.addEventListener("pointerdown",function(e){if(dragLearned||!e.target||!e.target.closest)return;if(e.target.closest(".cycw.hungry,.cycw.party,.cycw.love,.cycw.collab,.cycw.identity")){dragLearned=true;}},true);
let tugDemoCount=0;const TUG_MAX=3;
function maybeTugDemo(w){if(reduce||!w||!w.classList)return;if(tugDemoCount>=TUG_MAX)return;var ix=w.classList.contains("hungry")||w.classList.contains("party")||w.classList.contains("love")||w.classList.contains("collab")||w.classList.contains("identity");if(!ix)return;tugDemoCount++;setTimeout(function(){if(!w.parentNode||w.classList.contains("out")||dragging||eating)return;w.classList.add("cwtug");setTimeout(function(){w.classList.remove("cwtug");},1600);},900);}
function buildHeadline(){h1.textContent="";
 /* No <br> any more. The old headline hard-broke before "with [mood]" so the block
    height could not jump as the word cycled; with no cycling word there is nothing to
    hold still, and a forced break would fight the measure at every width instead of
    letting the two sentences fall where they fit.
    cycWord stays null. Every consumer -- cycle(), moodHoldWord(), revealCycWord(),
    showIdentity() -- already guards on it, which was written when the word first
    became optional and is why this is a deletion rather than a rewrite. */
 STATIC.forEach(function(w,i){h1.appendChild(makeWord(w));
  if(i<STATIC.length-1)h1.appendChild(document.createTextNode(" "));});
 cycWord=null;}
function revealAll(){const chs=[...h1.querySelectorAll(".ch")];chs.forEach((c,i)=>{c.style.transitionDelay=(i*0.03)+"s";c.classList.add("show");});
 var _av0=document.getElementById("heroAvail");if(_av0)setTimeout(function(){_av0.classList.add("in");},reduce?0:100);   // the eyebrow fades in FIRST, just before the headline
 var _hc=document.querySelector(".heroCtas");                                          // CTAs enter after the headline lands (the eyebrow already came in first)
 if(_hc){if(reduce){_hc.classList.add("in");}else{var _ctaT=(chs.length*0.03+0.12)*1000+560;setTimeout(function(){_hc.classList.add("in");},_ctaT);}}
 const sub=document.getElementById("sub");const base=chs.length*0.06+0.2;[...sub.querySelectorAll(".l")].forEach((l,i)=>l.style.transitionDelay=(base+i*0.011)+"s");sub.classList.add("show");}
let wi=0;
let cycTimer=null,cycHold=false;
function replayHeroChars(){if(reduce){return;}var chs=[...h1.querySelectorAll(".ch")];chs.forEach(function(c){c.style.transition="none";c.classList.remove("show");c.style.opacity="0";c.style.filter="blur(6px)";c.style.transform="translateY(0.4em)";});void h1.offsetWidth;requestAnimationFrame(function(){chs.forEach(function(c,i){c.style.transition="";c.style.transitionDelay=(i*0.03).toFixed(3)+"s";c.style.opacity="";c.style.filter="";c.style.transform="";c.classList.add("show");});});}
function revealHeroReturn(){
 identityShown=false;                                                                                   // never return with Soul./a mood word pinned
 if(cycWord&&cycWord.parentNode&&typeof makeCycWord==="function"){var _fresh=makeCycWord(wi,true);cycWord.replaceWith(_fresh);cycWord=_fresh;}  // rebuild a clean cycler word -> a held "mood" word can't return glitched; it re-enters smoothly
 var hc=document.querySelector(".heroCtas");
 if(reduce){if(hc)abShowCtas();try{revealCycWord(cycWord);}catch(_){}return;}
 cycHold=true;
 var chs=[...h1.querySelectorAll(".ch")];
 chs.forEach(function(c){c.style.transition="none";c.classList.remove("show");c.style.opacity="0";c.style.filter="blur(6px)";c.style.transform="none";});  // hold chars at home -> they fade/deblur in place on return, never rise/jolt
 var cw=cycWord;if(cw){[...cw.querySelectorAll(".cyc-ch")].forEach(function(sp){sp.classList.remove("in");sp.style.opacity="0";});}
 if(hc){hc.classList.remove("in");for(var i=0;i<hc.children.length;i++){hc.children[i].style.opacity="";hc.children[i].style.animation="";hc.children[i].style.transform="";}}
 void h1.offsetWidth;
 requestAnimationFrame(function(){chs.forEach(function(c,i){c.style.transition="";c.style.transitionDelay=(i*0.03).toFixed(3)+"s";c.style.opacity="";c.style.filter="";c.style.transform="none";c.classList.add("show");});});
 var charDur=(chs.length*0.03+0.12)*1000;
 clearTimeout(window._abRetCyc);window._abRetCyc=setTimeout(function(){try{if(cw)revealCycWord(cw);}catch(_){}cycHold=false;try{nextCycle();}catch(_){}},charDur);
 clearTimeout(window._abRetCta);window._abRetCta=setTimeout(function(){try{abShowCtas();}catch(_){}},charDur+560);
}
function nextCycle(ms){if(reduce||CALIB)return;clearTimeout(cycTimer);cycTimer=setTimeout(cycle,ms||8500);}   // dwell per mood word (was 5200)
function buildIdentityWord(){var w=document.createElement("span");w.className="cycw";var chars=[..."Soul."];
 chars.forEach(function(ch,ci){var sp=document.createElement("span");sp.className="cyc-ch in";sp.textContent=ch;sp.style.animationDelay=(ci*CYC_STAG).toFixed(3)+"s";sp.addEventListener("animationend",function(){sp.classList.remove("in");},{once:true});w.appendChild(sp);});return w;}
function showIdentity(){if(identityShown||!cycWord)return;identityShown=true;cycHold=true;clearTimeout(cycTimer);var old=cycWord;if(old)old.classList.add("out");
 setTimeout(function(){if(movieMode)return;var ref=(old&&old.parentNode)?old:((cycWord&&cycWord.parentNode)?cycWord:null);if(ref){var nw=buildIdentityWord();ref.replaceWith(nw);cycWord=nw;}},560);}
function restoreCycler(){if(!identityShown)return;identityShown=false;var old=cycWord;if(old)old.classList.add("out");
 setTimeout(function(){if(movieMode)return;var ref=(old&&old.parentNode)?old:((cycWord&&cycWord.parentNode)?cycWord:null);if(ref){var nw=makeCycWord(wi);ref.replaceWith(nw);cycWord=nw;}cycHold=false;nextCycle();},560);}
function cycle(){if(CALIB||cycHold||dragging||eating||!cycWord)return;          // never swap mid-drag / mid-eat -- and there's no cycling word in the headline anymore
 cycWord.classList.add("out");                                        // play each character's personality EXIT
 clearTimeout(cycTimer);cycTimer=setTimeout(advanceCycle,560);}
function advanceCycle(){clearTimeout(cycTimer);if(cycHold||dragging||eating||!cycWord)return;
 var _prevW=cycWord.getBoundingClientRect().width;   // width of the word leaving
 wi=(wi+1)%WORDS.length;const nw=makeCycWord(wi);cycWord.replaceWith(nw);cycWord=nw;
 // Mood words differ by up to 84px; on a CENTRED headline that snapped "with" sideways ~42px
 // each swap. Ease from the outgoing width to the new one so the line glides. Reduced-motion opts out.
 try{if(!reduce){var _nat=nw.getBoundingClientRect().width;
  if(Math.abs(_prevW-_nat)>1){
   nw.style.transition="none";nw.style.minWidth=_prevW+"px";void nw.offsetWidth;
   nw.style.transition="min-width .45s cubic-bezier(.2,.8,.2,1)";nw.style.minWidth=_nat+"px";
   setTimeout(function(){nw.style.minWidth="";nw.style.transition="";},520);}}}catch(_){}try{if(window.__wordNotice)window.__wordNotice();}catch(_){}   // new word enters char-by-char with its personality; he may glance at it
 nextCycle();}

function buildEyes(name){
 eyeEls.forEach(e=>e.el.remove());eyeEls=[];
 (FACES[name].eyes||[]).forEach((c,idx)=>{
  const rx=ER(c,"rx",RX),ry=ER(c,"ry",RY);
  const el=document.createElement("div");el.className="eye"+(CALIB?" cal":"")+(CALIB&&idx===selEye?" sel":"");
  if(eyesClosed&&!CALIB)el.classList.add("eclosed");
  el.style.left=((c.x-rx)*100)+"%";el.style.top=((c.y-ry)*100)+"%";el.style.width=(2*rx*100)+"%";el.style.height=(2*ry*100)+"%";
  const iris=document.createElement("div");iris.className="iris";
  iris.style.width=(IRIS_W*100)+"%";iris.style.height=(IRIS_H*100)+"%";iris.style.left=((1-IRIS_W)/2*100)+"%";iris.style.top=((1-IRIS_H)/2*100)+"%";
  const pupil=document.createElement("div");pupil.className="pupil";iris.appendChild(pupil);
  el.appendChild(iris);
  const glint=document.createElement("div");glint.className="glint";el.appendChild(glint);
  if(CALIB){el.addEventListener("pointerdown",ev=>{ev.preventDefault();ev.stopPropagation();selEye=idx;dragging=true;dragEl=el;
    document.querySelectorAll(".eye").forEach(x=>x.classList.remove("sel"));el.classList.add("sel");renderCal();});}
  stage.appendChild(el);eyeEls.push({el,iris,pupil,glint});
 });
}
function setFace(name){curFace=name;faceImg.src=PFX+FACES[name].img;buildEyes(name);}  // raw hard swap
function applyBlink(){eyeEls.forEach(e=>e.el.classList.toggle("eclosed",eyesClosed));}
// REAL blink — posterized to the 8fps grid, with natural variation + a bit of crunch
function buildBlink(openTo,withGesture,allowDouble){
 const deep=0.905+Math.random()*0.03, settle=deep+0.045, hold=(Math.random()<0.5?1:2), st=[];
 st.push({close:1,sq:deep});                       // snap shut -- the crunch
 for(let i=0;i<hold;i++)st.push({close:1,sq:settle});
 if(allowDouble&&Math.random()<0.24){              // occasional natural double-blink
  st.push({open:1,face:openTo,sq:1,g:withGesture});
  st.push({close:1,sq:0.92});st.push({close:1,sq:0.95});
 }
 st.push({open:1,face:openTo,sq:1,g:withGesture}); // reopen on the target face
 return st;
}
function applyStep(s){
 if(s.close){faceImg.src=FACES[curFace].closed;eyeEls.forEach(e=>e.el.style.display="none");}
 else if(s.open){setFace(s.face);if(s.g)triggerGesture(s.face);}
 blinkSquash=s.sq;if(!blinkQ.length)blinking=false;
}
function requestBlink(openTo,withGesture,allowDouble){
 if(reduce){setFace(openTo);if(withGesture)triggerGesture(openTo);return;}
 if(blinking){for(const s of blinkQ)if(s.open){s.face=openTo;if(withGesture)s.g=true;}return;} // retarget mid-blink
 blinking=true;blinkQ=buildBlink(openTo,withGesture,allowDouble);applyStep(blinkQ.shift());    // start now; rest snaps to grid
}
function showFace(name){
 if(name===curFace||CALIB)return;
 if(reduce){setFace(name);triggerGesture(name);return;}
 if(name==="smile"||name==="wink"){blinkQ=[];blinking=false;blinkSquash=1;setFace(name);triggerGesture(name);return;} // pop in, no blink
 requestBlink(name,true,false);
}
// spontaneous blinks only while calm (neutral/rest); varied interval (research: ~3-5s, highly variable)
function idleBlink(){if(!reduce&&!eventLock&&!reactType&&!dizzy&&!CALIB&&!blinking&&(curFace==="neutral"||curFace==="rest")){if(curFace==="rest"&&!holdFace&&window.__pointerOverFace===false&&!drowsy){setFace("neutral");}if(drowsy&&Math.random()<0.5){slowBlink();}else{requestBlink(curFace,false,true);}}setTimeout(idleBlink,2100+Math.random()*3200);}
// ===== IDLE CYCLE-BREAKERS: subtle fidgets that keep him alive between actions (research: base loop + randomized secondary idles) =====
var fidget=null,fidgetGX=0,fidgetGY=0,fidgetROT=0,fidgetBrow=false,cfR=0;
function idleFidget(){
 var now=performance.now();
 if(!reduce&&!eventLock&&!reactType&&!dizzy&&!CALIB&&!eating&&!partyMode&&!loveMode&&!rainMode&&!bearMode&&!movieMode&&!introMode&&!dragging&&!blinking&&!fidget&&!activeHover&&(curFace==="neutral"||curFace==="rest")){
  var r=Math.random(),t=r<0.28?"glance":(r<0.50?"tilt":(r<0.68?"look":"brow"));
  fidget={type:t,start:now,dur:(t==="brow"?940:(t==="tilt"?1500:1150)),dir:(Math.random()<0.5?-1:1)};   // one beat at a time, never repeats back-to-back
 }
 setTimeout(idleFidget,4500+Math.random()*6500);
}
function tickFidget(){
 if(!fidget){fidgetGX+=(0-fidgetGX)*0.18;fidgetGY+=(0-fidgetGY)*0.18;fidgetROT+=(0-fidgetROT)*0.18;if(fidgetBrow&&!blinking){faceImg.src=PFX+FACES.neutral.img;fidgetBrow=false;}return;}
 var p=(performance.now()-fidget.start)/fidget.dur,env=Math.sin(Math.max(0,Math.min(1,p))*Math.PI);   // ease in -> hold -> ease out
 var tgx=0,tgy=0,trot=0,brow=false;
 if(fidget.type==="glance"){tgx=fidget.dir*0.50*env;tgy=-0.05*env;trot=fidget.dir*1.1*env;}            // curious look to one side and back
 else if(fidget.type==="tilt"){tgx=fidget.dir*0.10*env;trot=fidget.dir*3.0*env;}                       // slight head tilt
 else if(fidget.type==="look"){try{var sr=stage.getBoundingClientRect();var lx=Math.max(-1,Math.min(1,(pointer.px-(sr.left+sr.width*0.5))/SENS)),ly=Math.max(-1,Math.min(1,(pointer.py-(sr.top+sr.height*0.42))/SENS));tgx=lx*0.7*env;tgy=ly*0.55*env;}catch(_){}}   // glances toward your cursor
 else if(fidget.type==="brow"){tgy=-0.04*env;brow=env>0.45;}
 else if(fidget.type==="rock"){tgx=0;tgy=0.07*env;trot=fidget.dir*4.6*env;brow=(p>0.14&&p<0.9);}                       /* the People's Eyebrow: head cocks, brows up, dead-level stare */
 else if(fidget.type==="side"){var sp=p<0.14?(p/0.14):(p>0.82?((1-p)/0.18):1);tgx=fidget.dir*0.85*sp;tgy=0.05*sp;trot=0;}   /* deadpan side-eye: eyes dart, head does NOT move — that's the joke */
 else if(fidget.type==="roll"){var fade=Math.min(1,Math.min(p,1-p)*7);var ang=p*Math.PI;tgx=Math.cos(ang)*-0.75*fade*fidget.dir;tgy=-Math.sin(ang)*0.95*fade;trot=Math.sin(p*Math.PI)*2.2*fidget.dir;}   /* the eye roll: a full arc over the top */
 else if(fidget.type==="dtake"){if(p<0.42){var q=p/0.42;tgx=fidget.dir*0.8*q;trot=fidget.dir*1.6*q;}else{var q2=Math.max(0,1-(p-0.42)/0.12);tgx=fidget.dir*0.8*q2;trot=fidget.dir*1.6*q2;brow=(p>0.5&&p<0.92);}}   /* double-take: drift away, SNAP back, brows up */
 else if(fidget.type==="bruh"){tgx=0;tgy=0.04;trot=0;if(!fidget.blinked&&p>0.28){fidget.blinked=true;slowBlink();}}   /* the unimpressed slow blink */
 else if(fidget.type==="word"||fidget.type==="corner"){try{var _tel=fidget.type==="word"?cycWord:document.querySelector(".jbPlay,.faceMoodCorner");if(_tel){var _er=_tel.getBoundingClientRect(),_sr2=stage.getBoundingClientRect();tgx=Math.max(-1,Math.min(1,((_er.left+_er.width/2)-(_sr2.left+_sr2.width*0.5))/(_sr2.width*0.8)))*0.85*env;tgy=Math.max(-1,Math.min(1,((_er.top+_er.height/2)-(_sr2.top+_sr2.height*0.42))/(_sr2.height*0.8)))*0.7*env;trot=tgx*2.2;}}catch(_){}}                                           // eyebrow raise
 fidgetGX+=(tgx-fidgetGX)*0.22;fidgetGY+=(tgy-fidgetGY)*0.22;fidgetROT+=(trot-fidgetROT)*0.22;
 var _browType=(fidget.type==="brow"||fidget.type==="rock"||fidget.type==="dtake");
 if(_browType&&!blinking&&(curFace==="neutral"||curFace==="rest")){if(brow&&!fidgetBrow){faceImg.src=PFX+FACES.neutral.browsup;fidgetBrow=true;}else if(!brow&&fidgetBrow){faceImg.src=PFX+FACES[curFace].img;fidgetBrow=false;}}
 if(p>=1){if(fidgetBrow&&!blinking){faceImg.src=PFX+FACES[(curFace==="neutral"||curFace==="rest")?curFace:"neutral"].img;}fidgetBrow=false;var _aft=fidget&&fidget.after;fidget=null;if(_aft)try{_aft();}catch(_){}}
}
/* welcome beat: every so often in true idle, a brief soft smile — idle-animation research: living characters acknowledge you (breath, blinks, warmth); they never just stare */
function idleWarm(){
 if(!reduce&&!eventLock&&!reactType&&!dizzy&&!CALIB&&!eating&&!partyMode&&!loveMode&&!rainMode&&!bearMode&&!movieMode&&!introMode&&!dragging&&!blinking&&!fidget&&!activeHover&&!holdFace&&(curFace==="neutral"||curFace==="rest")){browFlash();}   /* the warm beat is now just the eyebrow flash he loves; the random smile is gone */
 setTimeout(idleWarm,8500+Math.random()*9000);
}
setTimeout(idleWarm,7200);
/* ===== quirky idle beats: he notices his own toys — every hint is diegetic, gated, rare ===== */
function idleFree(){return !reduce&&!eventLock&&!reactType&&!dizzy&&!CALIB&&!eating&&!partyMode&&!loveMode&&!rainMode&&!bearMode&&!movieMode&&!introMode&&!dragging&&!blinking;}
/* word-notice: when the headline cycles, he glances at the new word (it is draggable, after all) */
window.__wordNotice=function(){if(idleFree()&&!fidget&&Math.random()<0.55)fidget={type:"word",start:performance.now(),dur:850,dir:1};};
/* corner tease: until the menu is first opened, an occasional glance at Play-a-mood while it lights up */
var moodOpenedOnce=false;try{var _mbT=document.getElementById("moodBtn");if(_mbT)_mbT.addEventListener("click",function(){moodOpenedOnce=true;},{once:true});}catch(_){}
function idleCornerTease(){
 if(idleFree()&&!fidget&&!moodOpenedOnce&&!holdFace&&(curFace==="neutral"||curFace==="rest")){
  fidget={type:"corner",start:performance.now(),dur:1150,dir:1};
  document.body.classList.add("moodTeach");
  setTimeout(function(){document.body.classList.remove("moodTeach");},2400);
 }
 setTimeout(idleCornerTease,50000+Math.random()*35000);
}
setTimeout(idleCornerTease,26000);
/* drowse: half a minute of stillness and he settles into rest; your return wakes him with a brow flash */
var drowsy=false;
function idleDrowse(){
 if(idleFree()&&!drowsy&&!holdFace&&!activeHover&&curFace==="neutral"&&performance.now()-lastMove>35000){drowsy=true;holdFace="rest";showFace("rest");}
 setTimeout(idleDrowse,9000+Math.random()*6000);
}
setTimeout(idleDrowse,20000);
addEventListener("pointermove",function(){if(drowsy){drowsy=false;if(holdFace==="rest")holdFace=null;browFlash(function(){resolve();});}},{passive:true});
/* cursor companions: deterministic reactions to how the cursor moves, so the tracking face is never blank.
   These are tied to motion, never random, and stay clear of the hover expressions. */
var _vLast=0,_vX=0,_vY=0,_vBlinkAt=0,_nearAt=0,_wasNear=false;
addEventListener("pointermove",function(e){
 var now=performance.now();
 if(_vLast){var dt=now-_vLast;if(dt>0&&dt<120){var sp=Math.hypot(e.clientX-_vX,e.clientY-_vY)/dt;
  if(sp>2.6&&now-_vBlinkAt>4200&&!blinking&&!eventLock&&!reactType&&!dizzy&&!dragging&&(curFace==="neutral"||curFace==="rest")){_vBlinkAt=now;requestBlink(curFace,false,false);}}}   /* re-fixation blink on a fast flick */
 _vLast=now;_vX=e.clientX;_vY=e.clientY;
 try{var r=stage.getBoundingClientRect();var d=Math.hypot(e.clientX-(r.left+r.width/2),e.clientY-(r.top+r.height/2));
  var near=d<r.width*0.85;
  if(near&&!_wasNear&&now-_nearAt>7000&&idleFree()&&!fidget&&!holdFace&&!activeHover){_nearAt=now;browFlash();irisDilTarget=1.3;}   /* he notices you approaching: brow flash + a spark of interest */
  if(near)_wasNear=true;else if(d>r.width*1.1)_wasNear=false;
 }catch(_){}
},{passive:true});
/* the disappointed slow blink: shut, a long beat, reopen (mirrors buildBlink's grid steps) */
function slowBlink(){if(blinking||reduce)return;blinking=true;blinkQ=[{close:1,sq:0.9},{close:1,sq:0.93},{close:1,sq:0.94},{close:1,sq:0.94},{close:1,sq:0.94},{open:1,face:curFace,sq:1}];applyStep(blinkQ.shift());}
/* rare quirks: pop-culture beats plus the wink and the blep — one roll, long gaps, never twice in a row */
function blep(){
 if(!tongueEl||reduce)return;
 [0.4,0.85,1].forEach(function(v,i){setTimeout(function(){if(eating||dragging)return;tongueEl.style.opacity="0.96";tongueEl.style.transform="translateY(4%) rotate(2deg) scale(0.9,"+v+")";},i*125);});
 setTimeout(function(){if(eating)return;tongueEl.style.transform="translateY(4%) rotate(1deg) scale(0.9,0.45)";},760);
 setTimeout(function(){if(eating)return;tongueEl.style.opacity="0";tongueEl.style.transform="scaleY(0)";},920);
}
function idleQuirk(){
 if(idleFree()&&!fidget&&!drowsy&&!holdFace&&!activeHover&&(curFace==="neutral"||curFace==="rest")){
  var _d=(Math.random()<0.5?-1:1),_now=performance.now(),_r=Math.random(),_pick;
  if(_r<0.22)_pick="wink";else if(_r<0.44)_pick="rock";else if(_r<0.62)_pick="side";else if(_r<0.78)_pick="roll";else if(_r<0.90)_pick="dtake";else _pick="bruh";
  if(_pick===window.__lastQuirk)_pick=(_pick==="rock"?"side":"rock");   // never the same gag twice running
  window.__lastQuirk=_pick;
  if(_pick==="wink"){setHold("wink",680);showFace("wink");}
  else if(_pick==="rock")fidget={type:"rock",start:_now,dur:1700,dir:_d};
  else if(_pick==="side")fidget={type:"side",start:_now,dur:1500,dir:_d};
  else if(_pick==="roll")fidget={type:"roll",start:_now,dur:1150,dir:_d,after:function(){if(Math.random()<0.4&&idleFree()&&!holdFace){setHold("smile",700);showFace("smile");}}};   // sometimes amused with himself after
  else if(_pick==="dtake")fidget={type:"dtake",start:_now,dur:1350,dir:_d};
  else fidget={type:"bruh",start:_now,dur:1500,dir:_d};
 }
 setTimeout(idleQuirk,34000+Math.random()*30000);
}
setTimeout(idleQuirk,18000);
/* warm every face frame once the page settles, so no expression swap ever flashes a half-loaded frame */
window.addEventListener("load",function(){setTimeout(function(){var W=["images/neutral_browsup.webp","images/neutral_closed.webp","images/rest.webp","images/rest_closed.webp","images/wink.webp","images/wink_closed.webp","images/smile.webp","images/smile_closed.webp","images/tongue.webp","images/heart.webp","images/heart_eye.webp","images/cookie.webp","images/cookie_b1.webp","images/cookie_b2.webp","images/cookie_b3.webp","images/discoball.webp","images/discoglints.webp","images/cam.webp","images/fingerprint.webp","images/bucket.webp","images/kernel.webp","images/crumbtex.webp","images/procreate.webp","images/overlay.webp","images/paper.webp"];window.__faceWarm=W.map(function(src){var im=new Image();im.decoding="async";im.src=src;return im;});},900);});
/* eyebrow flash (Eibl-Eibesfeldt): a ~220ms brow raise that precedes warm expressions — anticipation, never a snap */
function browFlash(cb){if(reduce||blinking||(curFace!=="neutral"&&curFace!=="rest")){if(cb)cb();return;}faceImg.src=PFX+FACES.neutral.browsup;setTimeout(function(){if(!blinking&&(curFace==="neutral"||curFace==="rest"))faceImg.src=PFX+FACES[curFace].img;if(cb)cb();},220);}
/* mood exits come home through a blink, never a hard swap; sometimes he looks quietly pleased after */
function settleFace(){var t=activeHover||holdFace||baseFace;
 if(reduce||t==="smile"||t==="wink"){setFace(t);return;}
 requestBlink(t,false,false);
 if(Math.random()<0.3)setTimeout(function(){if(!busyNow()&&!activeHover&&!holdFace&&!dragging&&(curFace==="neutral"||curFace==="rest")){setHold("smile",800);showFace("smile");}},700);}
function clearHold(){holdFace=null;if(holdTimer){clearTimeout(holdTimer);holdTimer=null;}}
function setHold(face,ms){holdFace=face;if(holdTimer)clearTimeout(holdTimer);holdTimer=setTimeout(()=>{holdFace=null;holdTimer=null;resolve();},ms);}
function resolve(){if(eventLock||CALIB)return;if(activeHover==="rest"&&window.__pointerOverFace===false){activeHover=null;}showFace(activeHover||holdFace||baseFace);}

function updateIris(){
 var now=performance.now();
 irisDilBase=loveMode?1.5:(partyMode?1.42:(eating?1.32:(rainMode?0.95:1.0)));   // affection & joy widen the pupils; calm = neutral
 irisDilTarget+=(irisDilBase-irisDilTarget)*0.05;                       // transient target relaxes toward the sustained baseline
 irisDil+=(irisDilTarget-irisDil)*0.14;                                 // pupil eases toward target (muscle, not a snap)
 var hip=reduce?0:(Math.sin(now*0.0021)*0.016+Math.sin(now*0.0049)*0.009);         // hippus: pupils are never perfectly still
 var dil=irisDil+hip; if(dil<0.74)dil=0.74; if(dil>1.66)dil=1.66;
 if(reduce){microSacTX=0;microSacTY=0;}else if(now>=microSacNext){microSacTX=(Math.random()*2-1)*0.12;microSacTY=(Math.random()*2-1)*0.085;microSacNext=now+340+Math.random()*1200;}  // tiny dart, hold, re-dart
 microSacX+=(microSacTX-microSacX)*0.42;microSacY+=(microSacTY-microSacY)*0.42;
 var sr=stage.getBoundingClientRect(),scx=sr.left+sr.width*0.5,scy=sr.top+sr.height*0.42;
 window.__curNear=Math.hypot(pointer.px-scx,pointer.py-scy)<sr.width*1.4;   // the cursor is company only up close
 const useCursor=!reduce&&HOVER&&(now-lastMove<IDLE_MS)&&!bearMode&&window.__curNear;   // reduced-motion: the gaze stops chasing the pointer
 var gnx,gny;                                                            // ONE gaze direction, taken from between the eyes -> both eyes look parallel (no cross-eye)
 if(useCursor){gnx=(pointer.px-scx)/SENS;gny=(pointer.py-scy)/SENS;var gm=Math.hypot(gnx,gny);if(gm>1){gnx/=gm;gny/=gm;}}
 else{gnx=gaze.x;gny=gaze.y;}
 var _fid=(!eventLock&&!reactType&&!dizzy&&!eating&&!partyMode&&!loveMode&&!rainMode&&!bearMode&&!movieMode&&!introMode&&!dragging&&!blinking);
 gnx+=microSacX+(_fid?fidgetGX:0);gny+=microSacY+(_fid?fidgetGY:0);
 eyeEls.forEach(e=>{const r=e.el.getBoundingClientRect();var ecx=r.left+r.width/2;
  var nx=gnx+(ecx<scx?-EYE_OUT:EYE_OUT),ny=gny;                          // temporal bias so the forward gaze reads parallel
  ny=Math.max(-1,Math.min(1.12,ny+((bearMode||movieMode)?0:scrollPull*0.85)));   // scroll strain tugs gaze down — but not while a gag drives the eyes
  var ow=e.el.offsetWidth||r.width,oh=e.el.offsetHeight||r.height;const tx=Math.round(nx*ow*TRAVEL),ty=Math.round(ny*oh*TRAVEL);e.iris.style.transform="translate("+tx+"px,"+ty+"px)";
  if(e.glint)e.glint.style.transform="translate("+Math.round(tx*0.62)+"px,"+Math.round(ty*0.62)+"px)";  // catchlight follows the iris (with slight parallax) so it always sits on the dark iris and never washes out
  if(e.pupil)e.pupil.style.transform="translate(-50%,-50%) scale("+dil.toFixed(3)+")";
  if(blinking||e.el.style.display==="none"||e.el.classList.contains("eclosed")){if(e.el.style.transform)e.el.style.transform="";}   // never fight a blink
  else{var awe=(dil-1.34)/0.26;awe=awe<0?0:(awe>1?1:awe);e.el.style.transform=awe>0.04?"scaleY("+(1+awe*0.07).toFixed(3)+")":"";}   // eyes open a touch wider on awe
  });
 if(!eating&&!partyMode&&!loveMode&&!rainMode&&!introMode&&!bearMode&&!movieMode&&!eventLock&&!reactType&&!dizzy&&!blinking&&(!blinkQ||!blinkQ.length)){   // safety net: in true idle, eyes must never stay stuck hidden
   eyeEls.forEach(e=>{if(e.el.style.display==="none")e.el.style.display="";if(e.el.classList.contains("eclosed"))e.el.classList.remove("eclosed");});
   if(eyesClosed)eyesClosed=false;
 }
}
addEventListener("pointermove",e=>{pointer.px=e.clientX;pointer.py=e.clientY;lastMove=performance.now();
 if(dragging&&dragEl){const c=FACES[calFace].eyes[selEye],rx=ER(c,"rx",RX),ry=ER(c,"ry",RY);const r=stage.getBoundingClientRect();
  let x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;x=Math.max(0,Math.min(1,x));y=Math.max(0,Math.min(1,y));
  c.x=+x.toFixed(4);c.y=+y.toFixed(4);dragEl.style.left=((x-rx)*100)+"%";dragEl.style.top=((y-ry)*100)+"%";renderCal();}});
addEventListener("pointerup",()=>{dragging=false;dragEl=null;});

function startDizzy(){if(navigator.vibrate)navigator.vibrate([35,55,25,90,20,70]);
 blinking=false;blinkQ=[];eyesClosed=false;blinkSquash=1;gType=null;curRot=0;curSc=1;curTX=0;curTY=0;setFace("neutral");
 if(reduce){eventLock=true;placeTools(0.6,1);setTimeout(()=>{TOOLEL.forEach(im=>im.style.opacity="0");SHADOWEL.forEach(d=>d.style.opacity="0");eventLock=false;resolve();},1100);return;}
 eventLock=true;dizzy=true;dizzyStart=performance.now();placeTools(0.6,0);}
function dizzyTick(){const t=(performance.now()-dizzyStart)/1000,IMPACT=0.16,DUR=2.9;
 if(t>=DUR){dizzy=false;eventLock=false;stage.style.transform="none";updateShadow(0,0,0);TOOLEL.forEach(im=>im.style.opacity="0");SHADOWEL.forEach(d=>d.style.opacity="0");eyeEls.forEach(e=>e.iris.style.transform="translate(0,0)");resolve();return;}
 let rot,tx,ty;
 if(t<IMPACT){rot=-15;tx=-22;ty=5;}
 else{const td=t-IMPACT,p=td/(DUR-IMPACT),decay=Math.pow(1-p,1.4);
  rot=Math.sin(td*9.5)*13*decay;tx=Math.sin(td*7)*11*decay;ty=Math.cos(td*6)*6*decay;const theta=td*8.2;
  eyeEls.forEach((e,i)=>{const ph=theta+(i?Math.PI*0.55:0);const r=e.el.getBoundingClientRect();
   const ox=Math.round(Math.cos(ph)*r.width*TRAVEL*1.5*decay),oy=Math.round(Math.sin(ph)*r.height*TRAVEL*1.5*decay);
   e.iris.style.transform="translate("+ox+"px,"+oy+"px)";});}
 const spin=0.6+Math.floor(t*8)*0.273;                                 // ring spin locked to the 8fps grid
 let fade=1;if(t<0.22)fade=t/0.22;else if(t>DUR-0.5)fade=Math.max(0,(DUR-t)/0.5);placeTools(spin,fade);
 stage.style.transform="translate("+Math.round(tx)+"px,"+Math.round(ty)+"px) rotate("+rot.toFixed(1)+"deg)";updateShadow(tx,ty,rot);}

/* ---- TAP REACTIONS: random pick among dizzy / cute wink / talking traits ---- */
let reactType=null,reactStart=0,lastReact=null,talkWords=[],talkIdx=0,talkNextAt=0,talkSpeakUntil=0,talkGaze={x:0,y:0},talkGazeAt=0,talkBlink=0,talkBlinkAt=0,talkClosed=false,hRot=0,hTx=0,hTy=0,hRotT=0,hTxT=0,hTyT=0,emph=0,browFrames=0,curBrow="down",talkNameDone=false,talkSmile=false;
const TALK_POOL=[{t:"Curious.",s:"playful"},{t:"Creative.",s:"playful"},{t:"Relentless.",s:"driving"},{t:"Ambitious.",s:"driving"},{t:"Driven.",s:"driving"},{t:"Decisive.",s:"confident"},{t:"Bold.",s:"confident"},{t:"Fearless.",s:"confident"},{t:"Empathetic.",s:"soft"},{t:"Patient.",s:"soft"},{t:"Thoughtful.",s:"soft"},{t:"Strategic.",s:"precise"},{t:"Meticulous.",s:"precise"},{t:"Intentional.",s:"precise"}]; // all complete "I am ___"; none repeat the headline
const STYLE={confident:{e:1.25,gap:1560,b:0.8,g:1.0},soft:{e:0.5,gap:1680,b:0.4,g:0.7},playful:{e:1.05,gap:1580,b:0.7,g:1.1},driving:{e:1.3,gap:1500,b:0.85,g:1.0},precise:{e:0.85,gap:1580,b:0.55,g:0.85}}; // slower cadence: word holds ~0.5s after it settles
const MOUTHPT={x:0.5,y:0.75};   // where his mouth sits in the stage (for the drag-to-feed hit test)
let eating=false,eatStart=0,eatCrumbed=false,eatHopped=false,eatLastChew=-1,eatFrom={x:0,y:0},eatTo={x:0,y:0},crumbEls=[];
const speech=document.createElement("div");speech.className="speech";stage.parentElement.appendChild(speech);
const mouthimg=document.createElement("img");mouthimg.className="mouth";mouthimg.alt="";stage.appendChild(mouthimg);
const TOOLS=["data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgMTIwIj48cGF0aCBkPSJNIDk5LjIgMCBjIDcuMjgwNyAwIDEwLjkyMTAgMCAxMy43MDE5IDEuNDE2OSBhIDEzLjAwMDAgMTMuMDAwMCAwIDAgMSA1LjY4MTIgNS42ODEyIGMgMS40MTY5IDIuNzgwOSAxLjQxNjkgNi40MjEyIDEuNDE2OSAxMy43MDE5IEwgMTIwIDk5LjIgYyAwIDcuMjgwNyAwIDEwLjkyMTAgLTEuNDE2OSAxMy43MDE5IGEgMTMuMDAwMCAxMy4wMDAwIDAgMCAxIC01LjY4MTIgNS42ODEyIGMgLTIuNzgwOSAxLjQxNjkgLTYuNDIxMiAxLjQxNjkgLTEzLjcwMTkgMS40MTY5IEwgMjAuOCAxMjAgYyAtNy4yODA3IDAgLTEwLjkyMTAgMCAtMTMuNzAxOSAtMS40MTY5IGEgMTMuMDAwMCAxMy4wMDAwIDAgMCAxIC01LjY4MTIgLTUuNjgxMiBjIC0xLjQxNjkgLTIuNzgwOSAtMS40MTY5IC02LjQyMTIgLTEuNDE2OSAtMTMuNzAxOSBMIDAgMjAuOCBjIDAgLTcuMjgwNyAwIC0xMC45MjEwIDEuNDE2OSAtMTMuNzAxOSBhIDEzLjAwMDAgMTMuMDAwMCAwIDAgMSA1LjY4MTIgLTUuNjgxMiBjIDIuNzgwOSAtMS40MTY5IDYuNDIxMiAtMS40MTY5IDEzLjcwMTkgLTEuNDE2OSBaIiBmaWxsPSIjMUExQTFBIi8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNjAgNjApIHNjYWxlKDAuNikgdHJhbnNsYXRlKC02NyAtNjQuNSkiPjxwYXRoIGZpbGw9IiMwYWNmODMiIGQ9Ik00NS41IDEyOWMxMS45IDAgMjEuNS05LjYgMjEuNS0yMS41Vjg2SDQ1LjVDMzMuNiA4NiAyNCA5NS42IDI0IDEwNy41UzMzLjYgMTI5IDQ1LjUgMTI5em0wIDAiLz48cGF0aCBmaWxsPSIjYTI1OWZmIiBkPSJNMjQgNjQuNUMyNCA1Mi42IDMzLjYgNDMgNDUuNSA0M0g2N3Y0M0g0NS41QzMzLjYgODYgMjQgNzYuNCAyNCA2NC41em0wIDAiLz48cGF0aCBmaWxsPSIjZjI0ZTFlIiBkPSJNMjQgMjEuNUMyNCA5LjYgMzMuNiAwIDQ1LjUgMEg2N3Y0M0g0NS41QzMzLjYgNDMgMjQgMzMuNCAyNCAyMS41em0wIDAiLz48cGF0aCBmaWxsPSIjZmY3MjYyIiBkPSJNNjcgMGgyMS41QzEwMC40IDAgMTEwIDkuNiAxMTAgMjEuNVMxMDAuNCA0MyA4OC41IDQzSDY3em0wIDAiLz48cGF0aCBmaWxsPSIjMWFiY2ZlIiBkPSJNMTEwIDY0LjVjMCAxMS45LTkuNiAyMS41LTIxLjUgMjEuNVM2NyA3Ni40IDY3IDY0LjUgNzYuNiA0MyA4OC41IDQzIDExMCA1Mi42IDExMCA2NC41em0wIDAiLz48L2c+PC9zdmc+","data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgMTIwIj48cGF0aCBkPSJNIDk5LjIgMCBjIDcuMjgwNyAwIDEwLjkyMTAgMCAxMy43MDE5IDEuNDE2OSBhIDEzLjAwMDAgMTMuMDAwMCAwIDAgMSA1LjY4MTIgNS42ODEyIGMgMS40MTY5IDIuNzgwOSAxLjQxNjkgNi40MjEyIDEuNDE2OSAxMy43MDE5IEwgMTIwIDk5LjIgYyAwIDcuMjgwNyAwIDEwLjkyMTAgLTEuNDE2OSAxMy43MDE5IGEgMTMuMDAwMCAxMy4wMDAwIDAgMCAxIC01LjY4MTIgNS42ODEyIGMgLTIuNzgwOSAxLjQxNjkgLTYuNDIxMiAxLjQxNjkgLTEzLjcwMTkgMS40MTY5IEwgMjAuOCAxMjAgYyAtNy4yODA3IDAgLTEwLjkyMTAgMCAtMTMuNzAxOSAtMS40MTY5IGEgMTMuMDAwMCAxMy4wMDAwIDAgMCAxIC01LjY4MTIgLTUuNjgxMiBjIC0xLjQxNjkgLTIuNzgwOSAtMS40MTY5IC02LjQyMTIgLTEuNDE2OSAtMTMuNzAxOSBMIDAgMjAuOCBjIDAgLTcuMjgwNyAwIC0xMC45MjEwIDEuNDE2OSAtMTMuNzAxOSBhIDEzLjAwMDAgMTMuMDAwMCAwIDAgMSA1LjY4MTIgLTUuNjgxMiBjIDIuNzgwOSAtMS40MTY5IDYuNDIxMiAtMS40MTY5IDEzLjcwMTkgLTEuNDE2OSBaIiBmaWxsPSIjMUYwNzQwIi8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNjAgNjApIHNjYWxlKDAuOTIpIHRyYW5zbGF0ZSgtNjQgLTYwKSIgZmlsbD0iI0Q5QTlENiI+PHBhdGggZD0iTTEwMy41IDU5LjJzLS42LTE0LjYtMTYuNS0xNC42Yy0xNiAwLTE3LjMgMjItMTcuMyAyMnY0LjdTNzIuNSA4OS42IDg2IDg5LjZzMTQuOC0yLjYgMTQuOC0yLjZ2LTguMXMtMTkuMyA5LjItMjEuMi0xMGgyNHYtOS43em0tOSAyLjRoLTE1czAtOC4zIDcuNS05LjJjOC4yIDAgNy41IDkuMiA3LjUgOS4yek01MC41IDI5LjlIMzguNHYzLjhsLTE2IDU0LjloOS40bDQuNC0xNi4xSDUzbDQuNSAxNi4xaDEwLjNMNTAuNSAyOS45ek0zOC4yIDYzLjFsNi40LTI0LjVMNTEgNjMuMUgzOC4yeiIvPjwvZz48L3N2Zz4=","data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgMTIwIj48cGF0aCBkPSJNIDk5LjIgMCBjIDcuMjgwNyAwIDEwLjkyMTAgMCAxMy43MDE5IDEuNDE2OSBhIDEzLjAwMDAgMTMuMDAwMCAwIDAgMSA1LjY4MTIgNS42ODEyIGMgMS40MTY5IDIuNzgwOSAxLjQxNjkgNi40MjEyIDEuNDE2OSAxMy43MDE5IEwgMTIwIDk5LjIgYyAwIDcuMjgwNyAwIDEwLjkyMTAgLTEuNDE2OSAxMy43MDE5IGEgMTMuMDAwMCAxMy4wMDAwIDAgMCAxIC01LjY4MTIgNS42ODEyIGMgLTIuNzgwOSAxLjQxNjkgLTYuNDIxMiAxLjQxNjkgLTEzLjcwMTkgMS40MTY5IEwgMjAuOCAxMjAgYyAtNy4yODA3IDAgLTEwLjkyMTAgMCAtMTMuNzAxOSAtMS40MTY5IGEgMTMuMDAwMCAxMy4wMDAwIDAgMCAxIC01LjY4MTIgLTUuNjgxMiBjIC0xLjQxNjkgLTIuNzgwOSAtMS40MTY5IC02LjQyMTIgLTEuNDE2OSAtMTMuNzAxOSBMIDAgMjAuOCBjIDAgLTcuMjgwNyAwIC0xMC45MjEwIDEuNDE2OSAtMTMuNzAxOSBhIDEzLjAwMDAgMTMuMDAwMCAwIDAgMSA1LjY4MTIgLTUuNjgxMiBjIDIuNzgwOSAtMS40MTY5IDYuNDIxMiAtMS40MTY5IDEzLjcwMTkgLTEuNDE2OSBaIiBmaWxsPSIjRDk3NzU3Ii8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNjAgNjApIHNjYWxlKDMuNTUpIHRyYW5zbGF0ZSgtMTIgLTEyKSIgZmlsbD0iI0ZCRjNFQyI+PHBhdGggZD0ibTQuNzE0NCAxNS45NTU1IDQuNzE3NC0yLjY0NzEuMDc5LS4yMzA3LS4wNzktLjEyNzVoLS4yMzA3bC0uNzg5My0uMDQ4Ni0yLjY5NTYtLjA3MjktMi4zMzc1LS4wOTcxLTIuMjY0Ni0uMTIxNC0uNTcwNy0uMTIxNS0uNTM0My0uNzA0Mi4wNTQ2LS4zNTIyLjQ3OTctLjMyMTguNjg2LjA2MDggMS41MTc5LjEwMzIgMi4yNzY3LjE1NzggMS42NTE0LjA5NzIgMi40NDY4LjI1NWguMzg4NmwuMDU0Ni0uMTU3OS0uMTMzNi0uMDk3MS0uMTAzMi0uMDk3Mkw2Ljk3MyA5LjgzNTZsLTIuNTUtMS42ODc5LTEuMzM1Ni0uOTcxNC0uNzIyNS0uNDkxOC0uMzY0My0uNDYxNC0uMTU3OC0xLjAwNzguNjU1Ny0uNzIyNS44ODAzLjA2MDcuMjI0Ni4wNjA3Ljg5MjUuNjg2IDEuOTA2NCAxLjQ3NTQgMi40ODkzIDEuODMzNi4zNjQzLjMwMzUuMTQ1Ny0uMTAzMi4wMTgyLS4wNzI4LS4xNjQtLjI3MzMtMS4zNTM5LTIuNDQ2Ny0xLjQ0NS0yLjQ4OTMtLjY0MzUtMS4wMzItLjE3LS42MTk0Yy0uMDYwNy0uMjU1LS4xMDMyLS40Njc0LS4xMDMyLS43Mjg1TDYuMjg3LjEzMzUgNi42OTk3IDBsLjk5NTcuMTMzNi40MTkuMzY0Mi42MTkyIDEuNDE0NyAxLjAwMTggMi4yMjgyIDEuNTU0MyAzLjAyOTYuNDU1My44OTg1LjI0MjkuODMxOC4wOTEuMjU1aC4xNTc5di0uMTQ1N2wuMTI3NS0xLjcwNi4yMzY4LTIuMDk0Ny4yMzA3LTIuNjk1Ny4wNzg5LS43NTg5LjM3NjQtLjkxMDcuNzQ2OC0uNDkxOC41ODI4LjI3OTMuNDc5Ny42ODYtLjA2NjguNDQzMy0uMjg1MyAxLjg1MTctLjU1ODYgMi45MDIxLS4zNjQzIDEuOTQyOWguMjEyNWwuMjQyOS0uMjQyOS45ODM1LTEuMzA1MyAxLjY1MTQtMi4wNjQzLjcyODYtLjgxOTYuODUtLjkwNDYuNTQ2NC0uNDMxMWgxLjAzMjFsLjc1OSAxLjEyOTMtLjM0IDEuMTY1Ny0xLjA2MjUgMS4zNDc4LS44ODA0IDEuMTQxNC0xLjI2MjggMS43LS43ODkzIDEuMzYuMDcyOS4xMDkzLjE4ODItLjAxODMgMi44NTM1LS42MDcgMS41NDIxLS4yNzk0IDEuODM5Ni0uMzE1Ny44MzE4LjM4ODYuMDkxLjM5NDYtLjMyNzguODA3NS0xLjk2Ny40ODU3LTIuMzA3Mi40NjE0LTMuNDM2NC44MTM2LS4wNDI1LjAzMDQuMDQ4Ni4wNjA3IDEuNTQ4Mi4xNDU3LjY2MTguMDM2NGgxLjYyMWwzLjAxNzUuMjI0Ny43ODkyLjUyMi40NzM2LjYzNzYtLjA3OS40ODU3LTEuMjE0Mi42MTkzLTEuNjM5My0uMzg4Ni0zLjgyNS0uOTEwNy0xLjMxMTMtLjMyNzloLS4xODIydi4xMDkzbDEuMDkyOSAxLjA2ODYgMi4wMDM1IDEuODA5MiAyLjUwNzUgMi4zMzE0LjEyNzUuNTc2OC0uMzIxOC40NTU0LS4zNC0uMDQ4Ni0yLjIwMzktMS42NTc1LS44NS0uNzQ2OC0xLjkyNDYtMS42MjFoLS4xMjc1di4xN2wuNDQzMi42NDk2IDIuMzQzNiAzLjUyMTQuMTIxNCAxLjA4MDctLjE3LjM1MjEtLjYwNzEuMjEyNS0uNjY3OS0uMTIxNC0xLjM3MjEtMS45MjQ2TDE0LjM4IDE3Ljk1OWwtMS4xNDE0LTEuOTQyOC0uMTM5Ny4wNzktLjY3NCA3LjI1NTItLjMxNTYuMzcwMy0uNzI4Ni4yNzkzLS42MDcxLS40NjE0LS4zMjE4LS43NDY4LjMyMTgtMS40NzUzLjM4ODYtMS45MjQ2LjMxNTctMS41My4yODUzLTEuOTAwNC4xNy0uNjMxNC0uMDEyMS0uMDQyNS0uMTM5Ny4wMTgyLTEuNDMyOCAxLjk2NzItMi4xNzk2IDIuOTQ0Ni0xLjcyNDMgMS44NDU2LS40MTI4LjE2NC0uNzE2NC0uMzcwNC4wNjY3LS42NjE4LjQwMDgtLjU4ODkgMi4zODYtMy4wMzU3IDEuNDM4OS0xLjg4Mi45MjktMS4wODY4LS4wMDYyLS4xNTc5aC0uMDU0NmwtNi4zMzg1IDQuMTE2NC0xLjEyOTMuMTQ1Ny0uNDg1Ny0uNDU1NC4wNjA4LS43NDY3LjIzMDctLjI0MjkgMS45MDY0LTEuMzExNFoiLz48L2c+PC9zdmc+","images/procreate.webp"];
const TOOLEL=TOOLS.map(src=>{const im=document.createElement("img");im.className="dlogo";im.alt="";im.src=src;stage.parentElement.appendChild(im);return im;});
const SHADOWEL=TOOLS.map(()=>{const d=document.createElement("div");d.className="dshadow";stage.parentElement.appendChild(d);return d;});  // floor shadow per tile
function setMouth(op){const mh=(1+op*8).toFixed(1);const m="radial-gradient(ellipse 13% "+mh+"% at 50% 78%,#000 58%,transparent 100%)";mouthimg.style.webkitMaskImage=m;mouthimg.style.maskImage=m;}
function placeTools(spin,fade){const cx=0.5,cy=0.24,RX=0.40,RYv=0.13,FLOOR=0.90;   // tilted halo above the head; FLOOR = the cast-shadow line
 TOOLEL.forEach((im,i)=>{const a=spin+i*(Math.PI*2/TOOLS.length),s=Math.sin(a),c=Math.cos(a),dN=(s+1)/2;
  const sc=0.55+0.5*dN, ry=(-c*58).toFixed(1);                          // depth scale + turn-to-face (rotateY)
  const lx=cx+c*RX, ty=cy+s*RYv;                                        // tile centre as a fraction of the stage box
  im.style.left=(lx*100).toFixed(1)+"%";im.style.top=(ty*100).toFixed(1)+"%";
  im.style.transform="translate(-50%,-50%) perspective(460px) rotateY("+ry+"deg) scale("+sc.toFixed(3)+")";
  im.style.zIndex=s>0?"8":"-1";                                          // bottom of ring = in front of head; top = behind it
  im.style.opacity=(fade*(0.55+0.45*dN)).toFixed(2);
  // ground shadow: the higher a tile floats, the larger/softer/fainter its cast shadow (penumbra widens with object->floor distance)
  const sh=SHADOWEL[i],h=Math.max(0.12,FLOOR-ty);                        // object-to-floor distance
  const w=Math.max(11,Math.min(42,(12+h*32)*(0.7+0.55*dN)));            // widens with height + nearness
  const op=Math.max(0.04,Math.min(0.30,(0.30-h*0.20)*(0.5+0.6*dN)))*fade; // fades as it lifts off the floor
  const bl=Math.max(3,Math.min(17,3+h*16));                             // penumbra softens with height
  sh.style.left=((lx+0.02)*100).toFixed(1)+"%";sh.style.top=(FLOOR*100).toFixed(1)+"%";  // light from upper-left nudges it right
  sh.style.width=w.toFixed(1)+"%";sh.style.height=(w*0.26).toFixed(1)+"%";               // foreshortened ground ellipse
  sh.style.filter="blur("+bl.toFixed(1)+"px)";sh.style.opacity=op.toFixed(2);});}
const TAPS=["dizzy"];   // talk now lives on the name click
function tapReact(){clearHold();activeHover=null; startDizzy();}
let namebar=null,talkCurWord=null,namebarIam=null;
function focusWord(text,cls,base){base=base||0;const w=document.createElement("span");if(cls)w.className=cls;[...text].forEach((ch,k)=>{const sp=document.createElement("span");sp.className="nch in";sp.textContent=ch;sp.style.animationDelay=(base+k*0.05).toFixed(3)+"s";sp.addEventListener("animationend",()=>sp.classList.remove("in"),{once:true});w.appendChild(sp);});return w;}
function fadeWord(w){if(!w)return;[...w.querySelectorAll(".nch")].forEach((sp,k)=>{sp.style.animationDelay=(k*0.03).toFixed(3)+"s";sp.classList.remove("in");sp.classList.add("out");});setTimeout(()=>{if(w&&w.parentNode)w.remove();},820);}
var pendingSay=null,talkSayMode=false,talkSayEnd=0,talkHoverTimer=null; function startReact(type){
 eventLock=true;reactType=type;reactStart=performance.now();
 gType=null;curRot=0;curSc=1;curTX=0;curTY=0;blinking=false;blinkQ=[];eyesClosed=false;blinkSquash=1;
 if(type==="wink"){setFace("wink");if(navigator.vibrate)navigator.vibrate([16,45,16]);}
 else if(type==="talk"){showIdentity();setFace("neutral");if(navigator.vibrate)navigator.vibrate(12);
  mouthimg.src=PFX+FACES.rest.img;mouthimg.style.opacity="1";setMouth(0);
  talkGaze={x:-0.3,y:-0.18};talkGazeAt=performance.now();talkBlink=0;talkBlinkAt=performance.now()+500;talkClosed=false;
  hRot=0;hTx=0;hTy=0;hRotT=0;hTxT=0;hTyT=0;emph=0;browFrames=0;curBrow="down";talkNameDone=false;talkSmile=false;
  talkWords=[...TALK_POOL].sort(()=>Math.random()-0.5).slice(0,4);talkIdx=-1;talkNextAt=performance.now()+760;talkSpeakUntil=performance.now()+540;talkGaze={x:0,y:-0.32};talkCurWord=null;speech.innerHTML="";
  if(pendingSay){talkSayMode=true;talkWords=[];var __sw=focusWord(pendingSay,"fw");__sw.style.left="50%";__sw.style.top="60%";speech.appendChild(__sw);talkCurWord=__sw;talkGaze={x:0,y:0.16};var __d=Math.min(2800,800+pendingSay.length*52);talkSpeakUntil=performance.now()+__d;talkSayEnd=performance.now()+__d+150;pendingSay=null;}
  else{talkSayMode=false;namebar=document.createElement("div");namebar.className="namebar";speech.appendChild(namebar);namebarIam=focusWord("I am","");namebar.appendChild(namebarIam);talkGaze={x:0,y:-0.9};hRotT=-2.5;hTyT=-6;browFrames=3;talkBlink=2;talkBlinkAt=performance.now()+900;}}  // "I am" sits up top from the very start
}
function endReact(){if(identityShown)restoreCycler();reactType=null;talkSayMode=false;eventLock=false;stage.style.transform="none";updateShadow(0,0,0);mouthimg.style.opacity="0";
 speech.innerHTML="";blinking=false;blinkQ=[];eyesClosed=false;var _rf=activeHover||holdFace||baseFace;
 if(!reduce&&curFace==="smile"){gaze.x=(Math.random()*0.36-0.18);gaze.y=-0.06-Math.random()*0.08;nextSaccade=performance.now()+780;requestBlink(_rf,false,false);}  // blink down out of the smile + glance away -> relaxes, never a blank forward stare
 else setFace(_rf);
 eyeEls.forEach(function(e){e.el.style.display="";e.el.style.visibility="";e.el.classList.remove("eclosed");});flushQueued();}  // name + smile leave together, in sync
// ===== DRAG-TO-FEED: a "Hunger" word he can be dragged to eat =====
function positionHunger(el,x,y){el.style.left=Math.round(x)+"px";el.style.top=Math.round(y)+"px";}
function mouthScreen(){const r=stage.getBoundingClientRect();return{x:r.left+r.width*MOUTHPT.x,y:r.top+r.height*MOUTHPT.y,rr:r.width*0.27};}
function faceTrackTo(cx,cy){pointer.px=cx;pointer.py=cy;lastMove=performance.now();nextSaccade=lastMove+1400;const r=stage.getBoundingClientRect();const cl=(v,a,b)=>Math.max(a,Math.min(b,v));gaze={x:cl((cx-(r.left+r.width/2))/(r.width*0.6),-1,1),y:cl((cy-(r.top+r.height/2))/(r.height*0.6),-1,1)};try{if(dragging){var _cd=Math.hypot(cx-(r.left+r.width/2),cy-(r.top+r.height/2));document.body.classList.toggle("catchReady",_cd<r.width*0.72);var _prox=Math.max(0,Math.min(1,1-_cd/(r.width*0.95)));irisDilTarget=1+_prox*0.6;}else document.body.classList.remove("catchReady");}catch(_){}}
let dragCookie=null,dragDisco=null,dragLove=null,dragCam=null,dragWordEl=null,queued=null;
var rainMode=false,rainTk0=0,rainDropStart=0,rainHoldStart=0,rainPerTick=1,rainList=[],rainWrap=null,rainHeadState="",rainHr=null,camflash=null;
var partyMode=false,partyStart=0,partyTk0=0,partyEl=null,partyLights=null,discoWrap=null,discoBall=null,partyGrain=null,PARTY_DUR=6.6;
var GP=["0 0","7px 4px","-5px 6px","4px -7px","-7px -3px","6px 5px","-4px -6px","3px 7px"];
var pCX=0,pHEADY=0,pHR=180,pBALLY=0;
var loveMode=false,loveStart=0,loveTk0=0,loveEl=null,heartEyeEls=null,heartLayer=null,blushEl=null,loveHearts=[],LOVE_DUR=4.3,gHW=120,loveSY0=0,loveBaseX=0,loveBaseY=0;
// queue: a drag dropped while something is playing fires right after it ends
function busyNow(){return !!(reactType||partyMode||loveMode||eating||dizzy||rainMode||movieMode);}
var qdots=document.getElementById("qdots"),tongueEl=document.getElementById("tongue"),mustCrumb=null,eatStacheMade=false,eatWillLick=true,eatWillStache=true,identityShown=false;function showQueue(){if(!qdots)return;qdots.classList.add("on");var s=qdots.querySelector(".qsr");if(s)s.textContent="Next reaction queued";}function hideQueue(){if(!qdots)return;qdots.classList.remove("on");var s=qdots.querySelector(".qsr");if(s)s.textContent="";}function runOrQueue(fn){if(busyNow()){queued=fn;showQueue();}else fn();}
function flushQueued(){if(!queued)return;var f=queued;queued=null;setTimeout(function(){if(busyNow()){queued=f;}else{hideQueue();f();}},700);}
// ===== LOVE: drag the heart word onto his head -> a kiss =====

function attachLove(wordEl){
 let pid=null;
 function release(){if(pid!=null){try{wordEl.releasePointerCapture(pid);}catch(_){}pid=null;}}
 function onMove(e){if(!dragging||!dragLove)return;dragLove._x=e.clientX;dragLove._y=e.clientY;dragLove.style.left=e.clientX+"px";dragLove.style.top=e.clientY+"px";faceTrackTo(e.clientX,e.clientY);}
 function onUp(){if(!dragging)return;dragging=false;release();wordEl.classList.remove("grab");
  const r=stage.getBoundingClientRect();const onHead=!!dragLove&&dragLove._x>r.left-50&&dragLove._x<r.right+50&&dragLove._y>r.top-70&&dragLove._y<r.bottom+30;
  if(dragLove){dragLove.remove();dragLove=null;}
  if(onHead){wordEl.style.opacity="0";runOrQueue(startLove);}
  else{wordEl.classList.remove("out");wordEl.style.opacity="";dragWordEl=null;cycHold=false;nextCycle(2600);}}
 wordEl.addEventListener("pointerdown",e=>{if(dragging||CALIB||partyMode||loveMode||eating)return;e.preventDefault();
  const r=wordEl.getBoundingClientRect();dragWordEl=wordEl;wordEl.classList.add("grab");cycHold=true;clearTimeout(cycTimer);
  dragLove=document.createElement("div");dragLove.className="lovedrag";dragLove.innerHTML='Love<span class="heartDot"></span>';document.body.appendChild(dragLove);
  dragLove._x=r.left+r.width/2;dragLove._y=r.top+r.height/2;dragLove.style.left=dragLove._x+"px";dragLove.style.top=dragLove._y+"px";
  wordEl.style.opacity="0";dragging=true;pid=e.pointerId;try{wordEl.setPointerCapture(pid);}catch(_){}});
 wordEl.addEventListener("pointermove",onMove);
 wordEl.addEventListener("pointerup",onUp);
 wordEl.addEventListener("pointercancel",onUp);
}
function buildLoveDOM(){
 if(loveEl)return;
 loveEl=document.createElement("div");loveEl.id="loveScene";loveEl.setAttribute("aria-hidden","true");
 loveEl.innerHTML='<div class="heartLayer"></div>';
 document.body.appendChild(loveEl);
 heartLayer=loveEl.querySelector(".heartLayer");
 var eyes=[{x:0.4,y:0.5169},{x:0.6041,y:0.5269}];heartEyeEls=[];
 for(var i=0;i<eyes.length;i++){var he=document.createElement("img");he.className="heartEye";he.src="images/heart_eye.webp";he.alt="";he.style.left=(eyes[i].x*100).toFixed(2)+"%";he.style.top=(eyes[i].y*100).toFixed(2)+"%";he.style.opacity="0";he.style.transform="translate(-50%,-50%) scale(.65)";stage.appendChild(he);heartEyeEls.push(he);}
 blushEl=document.createElement("div");blushEl.className="blush";blushEl.innerHTML="<i></i><i></i>";blushEl.style.opacity="0";stage.appendChild(blushEl);
}
function spawnHeart(cx,cy,sz){
 if(!heartLayer)return;
 var hh=document.createElement("img");hh.className="loveHeart";hh.src="images/heart_eye.webp";hh.alt="";
 hh.style.left=cx+"px";hh.style.top=cy+"px";hh.style.width=sz+"px";hh.style.opacity="0";
 hh.style.transform="translate(-50%,-50%) scale(.5)";
 heartLayer.appendChild(hh);
 loveHearts.push({el:hh,born:tk,dx:(Math.random()*2-1)*28,spin:(Math.random()<0.5?-1:1)*(0.7+Math.random()*0.7),flut:Math.random()*6.28});
}
function updateLoveHearts(){
 if(!loveHearts.length)return;
 var LIFE=14;
 for(var i=loveHearts.length-1;i>=0;i--){
  var Hh=loveHearts[i],age=tk-Hh.born,p=age/LIFE;
  if(p>=1){if(Hh.el&&Hh.el.remove)Hh.el.remove();loveHearts.splice(i,1);continue;}
  var ty=-p*128, fx=Math.sin(Hh.flut+age*0.7)*9+Hh.dx*p, rot, sx, sy;
  if(p<0.62){ rot=Math.sin(Hh.flut+age*0.7)*13; sx=1; sy=1; }
  else{ var c=(p-0.62)/0.38, base=Math.max(0,1-c), wob=0.42*Math.sin(age*1.9);
        sx=base*(1+wob); sy=base*(1-wob); rot=Math.sin(Hh.flut+age*0.7)*13+c*Hh.spin*82; }
  var op = age<2 ? age/2 : (p>0.86 ? Math.max(0,1-(p-0.86)/0.14) : 1);
  Hh.el.style.opacity=op.toFixed(2);
  Hh.el.style.transform="translate(-50%,-50%) translate("+fx.toFixed(1)+"px,"+ty.toFixed(1)+"px) rotate("+rot.toFixed(1)+"deg) scale("+sx.toFixed(3)+","+sy.toFixed(3)+")";
 }
}
function startLove(){try{document.body.classList.remove("catchReady");}catch(_){}
 if(loveMode||eating||dizzy||reactType||CALIB||partyMode)return;
 loveMode=true;eventLock=true;cycHold=true;clearTimeout(cycTimer);
 loveStart=performance.now();loveTk0=tk;loveHearts=[];
 var _pt=stage.style.transform;stage.style.transform="none";var r0=stage.getBoundingClientRect();stage.style.transform=_pt;
 pCX=r0.left+r0.width/2;pHEADY=r0.top+(window.scrollY||0)+r0.height*0.42;gHW=r0.width*0.5;loveBaseX=pCX;loveBaseY=pHEADY;loveSY0=window.scrollY||window.pageYOffset||0;
 blinking=false;blinkQ=[];eyesClosed=false;setFace("neutral");
 buildLoveDOM();
 mouthimg.style.opacity="0";
 requestAnimationFrame(function(){if(loveEl)loveEl.classList.add("on");});
 if(navigator.vibrate)navigator.vibrate(20);
}
function loveTick(sec){
 if(sec>=LOVE_DUR){endLove();return;}
 pCX=loveBaseX;pHEADY=loveBaseY;   /* page-anchored layer scrolls with the page; no compensation */
 function L(a,b,t){t=t<0?0:t>1?1:t;return a+(b-a)*t;}
 function E(t){t=t<0?0:t>1?1:t;return t*t*(3-2*t);}
 var b=tk-loveTk0,hw=gHW;
 var hx=0,hy=0,hrot=0,hsx=1,hsy=1,heartOn=0,eyeSc=1,blush=0,face="neutral";
 var beat=0.5+0.5*Math.sin(b*1.9);
 if(reduce){
   if(sec<1.4){face="rest";heartOn=1;}
   else{face="smile";blush=0.85;}
   if(sec>=2.8){endLove();return;}
 }else if(sec<0.4){                 // a beat of normal
   face="neutral";
 }else if(sec<1.8){                 // SHOCK: open-mouth (rest) + heart eyes
   face="rest";
   var t=sec-0.4,hit=E(Math.min(1,t/0.16)),settle=E(Math.min(1,(t-0.16)/0.55));
   heartOn=E(Math.min(1,t/0.20));
   eyeSc=(1+0.7*(1-Math.min(1,t/0.34)))*(1+beat*0.13*settle);
   hy=Math.round(-13*hit*(1-settle))-Math.round(Math.abs(Math.sin(b*0.9))*3*settle);
   hsx=(1+0.11*hit*(1-settle))*(1+beat*0.05*settle);
   hsy=(1+0.13*hit*(1-settle))*(1+beat*0.05*settle);
   hrot=Math.sin(b*1.8)*1.7*settle;
 }else if(sec<3.0){                 // melt: smile + blush, hearts gone
   face="smile";
   heartOn=1-E((sec-1.8)/0.28);
   eyeSc=0.78+0.22*heartOn;
   blush=E((sec-2.0)/0.7);
   hx=Math.round(Math.sin(b*0.7)*hw*0.05);hrot=Math.sin(b*0.7)*4;
   hy=Math.round(-4-Math.abs(Math.sin(b*1.0))*4);
   var thr=1+beat*0.03;hsx=thr;hsy=thr;
 }else{                             // clear wind-down to normal
   var t2=E((sec-3.0)/(LOVE_DUR-3.0)),damp=1-t2;
   face=sec<3.8?"smile":"neutral";heartOn=0;blush=L(0.85,0,t2);
   hx=Math.round(Math.sin(b*0.7)*hw*0.05*damp);hrot=Math.sin(b*0.7)*4*damp;
   hy=Math.round(L(-4,0,t2));hsx=hsy=L(1+beat*0.03,1,t2);
 }
 if(face==="smile"){if(curFace!=="smile")setFace("smile");}
 else if(face==="rest"){if(curFace!=="rest")setFace("rest");}
 else{if(curFace!=="neutral")setFace("neutral");}
 var irOp=Math.max(0,1-heartOn*1.3);if(eyeEls)for(var ii=0;ii<eyeEls.length;ii++){var ir=eyeEls[ii].el.querySelector(".iris");if(ir)ir.style.opacity=irOp.toFixed(2);}
 if(heartEyeEls)for(var i=0;i<heartEyeEls.length;i++){heartEyeEls[i].style.opacity=heartOn.toFixed(2);heartEyeEls[i].style.transform="translate(-50%,-50%) scale("+eyeSc.toFixed(3)+")";}
 stage.style.transform="translate("+hx+"px,"+hy+"px) rotate("+hrot.toFixed(1)+"deg) scale("+hsx.toFixed(3)+","+hsy.toFixed(3)+")";
 updateShadow(hx,hy,hrot);
 if(blushEl)blushEl.style.opacity=blush.toFixed(2);
 if(!reduce&&sec>=0.45&&sec<0.9)for(var k=0;k<3;k++)spawnHeart(pCX+(Math.random()*2-1)*hw*0.6,pHEADY-hw*(Math.random()*0.45),22+Math.random()*16);
 if(!reduce&&sec>0.5&&sec<2.8&&(b%2===0))spawnHeart(pCX+(Math.random()*2-1)*hw*0.95,pHEADY-hw*(0.15+Math.random()*0.4),18+Math.random()*14);
 updateLoveHearts();
}
function endLove(){
 flushQueued();
 if(loveEl)loveEl.classList.remove("on");
 var le=loveEl;loveEl=null;heartLayer=null;for(var hi=0;hi<loveHearts.length;hi++){if(loveHearts[hi].el&&loveHearts[hi].el.remove)loveHearts[hi].el.remove();}loveHearts=[];
 stage.classList.remove("lovestruck");
 if(heartEyeEls){for(var i=0;i<heartEyeEls.length;i++){if(heartEyeEls[i].parentNode)heartEyeEls[i].remove();}heartEyeEls=null;}
 if(blushEl&&blushEl.parentNode)blushEl.remove();blushEl=null;
 setTimeout(function(){if(le&&le.remove)le.remove();},650);
 document.body.classList.remove("partyLock");
 loveMode=false;eventLock=false;cycHold=false;
 stage.style.transform="none";updateShadow(0,0,0);mouthimg.style.opacity="0";
 blinking=false;blinkQ=[];eyesClosed=false;settleFace();eyeEls.forEach(function(e){e.el.style.display="";e.el.style.visibility="";e.el.classList.remove("eclosed");});dragWordEl=null;
 wi=(wi+1)%WORDS.length;var nw=makeCycWord(wi);if(cycWord){cycWord.replaceWith(nw);cycWord=nw;}
 nextCycle();
}
// ===== DISCO PARTY: drag the disco-ball word onto his head =====
function attachParty(wordEl){
 let pid=null;
 function release(){if(pid!=null){try{wordEl.releasePointerCapture(pid);}catch(_){}pid=null;}}
 function onMove(e){if(!dragging||!dragDisco)return;dragDisco._x=e.clientX;dragDisco._y=e.clientY;dragDisco.style.left=e.clientX+"px";dragDisco.style.top=e.clientY+"px";faceTrackTo(e.clientX,e.clientY);}
 function onUp(){if(!dragging)return;dragging=false;release();wordEl.classList.remove("grab");
  const r=stage.getBoundingClientRect();const onHead=!!dragDisco&&dragDisco._x>r.left-50&&dragDisco._x<r.right+50&&dragDisco._y>r.top-70&&dragDisco._y<r.bottom+30;
  if(dragDisco){dragDisco.remove();dragDisco=null;}
  if(onHead){wordEl.style.opacity="0";runOrQueue(startParty);}                                  // dropped on his head -> PARTY
  else{wordEl.classList.remove("out");wordEl.style.opacity="";dragWordEl=null;cycHold=false;nextCycle(2600);}}  // missed -> reappear
 wordEl.addEventListener("pointerdown",e=>{if(dragging||CALIB||partyMode||loveMode||eating)return;e.preventDefault();
  const r=wordEl.getBoundingClientRect();dragWordEl=wordEl;wordEl.classList.add("grab");cycHold=true;clearTimeout(cycTimer);
  dragDisco=document.createElement("div");dragDisco.className="partydrag";dragDisco.innerHTML='Delight<span class="discoDot"></span>';document.body.appendChild(dragDisco);
  dragDisco._x=r.left+r.width/2;dragDisco._y=r.top+r.height/2;dragDisco.style.left=dragDisco._x+"px";dragDisco.style.top=dragDisco._y+"px";
  wordEl.style.opacity="0";dragging=true;pid=e.pointerId;try{wordEl.setPointerCapture(pid);}catch(_){}});
 wordEl.addEventListener("pointermove",onMove);
 wordEl.addEventListener("pointerup",onUp);
 wordEl.addEventListener("pointercancel",onUp);
}
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
function layoutParty(){
 if(!partyEl)return;
 partyEl.style.setProperty("--hx",pCX+"px");
 partyEl.style.setProperty("--hy",pHEADY+"px");
 partyEl.style.setProperty("--hr",pHR+"px");
 partyEl.style.setProperty("--bx",pCX+"px");
 partyEl.style.setProperty("--by",pBALLY+"px");
 discoWrap.style.left=pCX+"px";discoWrap.style.top=pBALLY+"px";
}
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
/* THE HEADER GOES DARK FOR THE DISCO, AND COMES BACK.
   Jayden: when Delight runs, the header flips to its dark treatment for the duration.
   The mechanism is the one gradientlab.html already ships -- data-surface="ink" on
   .jbNav, which header.css answers with the whole ink token set (--nav-mat, --nav-rim,
   --nav-ink, the pill on --i100). No second dark mode was invented, and nothing here
   knows what "dark" looks like; it only names the surface.
   THE RETURN IS GUARANTEED THREE WAYS, because a header stuck dark on a light page is a
   much worse failure than a disco that never dimmed it:
     1. endParty() restores it, and endParty is already idempotent and is what every
        normal and early exit routes through.
     2. the page's own surface is REMEMBERED before the flip rather than assumed to be
        "paper", so restoring cannot silently re-light a page that was ink to begin with.
     3. a failsafe timer at PARTY_DUR + 2s restores it even if endParty never runs.
   Under prefers-reduced-motion the flip does not happen at all: it is a full-bar
   luminance inversion, which is exactly what that rule exists for. */
function heroNavSurface(ink){try{
  var n=document.querySelector(".jbNav");if(!n)return;
  if(ink){if(!n.dataset.surfaceHome)n.dataset.surfaceHome=n.getAttribute("data-surface")||"paper";
   n.setAttribute("data-surface","ink");}
  else{n.setAttribute("data-surface",n.dataset.surfaceHome||"paper");delete n.dataset.surfaceHome;}
 }catch(_){}}
function startParty(){try{document.body.classList.remove("catchReady");}catch(_){}
 if(partyMode||eating||dizzy||reactType||CALIB)return;
 partyMode=true;eventLock=true;cycHold=true;clearTimeout(cycTimer);
 partyStart=performance.now();partyTk0=tk;
 var _pt=stage.style.transform;stage.style.transform="none";var r0=stage.getBoundingClientRect();stage.style.transform=_pt;
 var _psy=window.scrollY||0;pCX=r0.left+r0.width/2;pHEADY=r0.top+_psy+r0.height*0.42;pHR=Math.round(r0.width*0.52);pBALLY=Math.max(54,Math.round(r0.top+_psy-r0.height*0.04));
 buildPartyDOM();layoutParty();document.body.classList.add("partyLock");
 setMouth(0);mouthimg.style.opacity="0";
 blinking=false;blinkQ=[];eyesClosed=false;setFace("neutral");faceImg.src=FACES.neutral.browsup;   // cancel any frozen mid-blink so the irises are open from frame 1
 requestAnimationFrame(function(){if(partyEl)partyEl.classList.add("on");if(discoWrap)discoWrap.classList.add("on");});
 if(navigator.vibrate)navigator.vibrate([18,40,18,40,18]);
 if(!reduce){heroNavSurface(true);
  clearTimeout(window._partySurfaceT);
  window._partySurfaceT=setTimeout(function(){heroNavSurface(false);},(PARTY_DUR+2)*1000);}
}
function partyTick(sec){
 if(sec>=PARTY_DUR){endParty();return;}
 if(partyGrain)partyGrain.style.backgroundPosition=GP[tk&7];
 if(reduce){if(curFace!=="smile")setFace("smile");if(sec>=2.2)endParty();return;}
 var b=tk-partyTk0,tx=0,ty=0,rot=0,sc=1,face="smile";
 var intro=sec<0.5,spin=(sec>=3.0&&sec<4.0),outro=sec>PARTY_DUR-0.55;
 if(intro){                                                  // look UP as the ball drops in
  if(curFace!=="neutral")setFace("neutral");faceImg.src=FACES.neutral.browsup;
  ty=Math.round(8-sec*30);rot=Math.sin(b*0.8)*2;sc=0.97;
  stage.style.transform="translate(0px,"+ty+"px) rotate("+rot.toFixed(1)+"deg) scale("+sc.toFixed(3)+")";updateShadow(0,ty,rot);return;}
 if(spin){                                                   // stepped 360 spin move (8fps)
  rot=Math.round((sec-3.0)*8)*45;ty=-8;sc=1.04;
  if(curFace!=="smile")setFace("smile");
  stage.style.transform="translate(0px,"+ty+"px) rotate("+rot+"deg) scale("+sc+")";updateShadow(0,ty,0);return;}
 tx=Math.round(Math.sin(b*0.62)*26);                         // sway
 ty=Math.round(-Math.abs(Math.sin(b*0.9))*15);               // bounce
 rot=Math.sin(b*0.62)*8+Math.sin(b*1.85)*3.2;                // lean + head-bang
 sc=1+Math.abs(Math.sin(b*0.9))*0.05;
 var groove=["smile","smile","wink","smile","neutral","smile","wink","neutral"];
 face=outro?"smile":groove[Math.floor(b/2)%groove.length];
 if(face!==curFace)setFace(face);
 if(face==="neutral"&&Math.floor(b/2)%2===0)faceImg.src=FACES.neutral.browsup;   // brow accent
 stage.style.transform="translate("+tx+"px,"+ty+"px) rotate("+rot.toFixed(1)+"deg) scale("+sc.toFixed(3)+")";updateShadow(tx,ty,rot);
}
function endParty(){
 if(!partyMode&&!partyEl)return;   // idempotent: early-end and scheduled-end can both fire
 flushQueued();
 if(partyEl)partyEl.classList.remove("on");
 if(discoWrap)discoWrap.classList.remove("on");
 document.body.classList.remove("partyLock");
 var pe=partyEl,dw=discoWrap;partyEl=null;partyLights=null;discoWrap=null;discoBall=null;
 setTimeout(function(){if(pe&&pe.remove)pe.remove();if(dw&&dw.remove)dw.remove();},650);
 partyMode=false;eventLock=false;cycHold=false;
 clearTimeout(window._partySurfaceT);heroNavSurface(false);   /* the bar comes back with the lights */
 stage.style.transform="none";updateShadow(0,0,0);mouthimg.style.opacity="0";
 blinking=false;blinkQ=[];eyesClosed=false;settleFace();eyeEls.forEach(function(e){e.el.style.display="";e.el.style.visibility="";e.el.classList.remove("eclosed");});
 dragWordEl=null;
 wi=(wi+1)%WORDS.length;var nw=makeCycWord(wi);if(cycWord){cycWord.replaceWith(nw);cycWord=nw;}
 nextCycle();
}
// held drag clones squirm like picking up a Mii (8fps stop-motion)
function wobbleDrag(dv){
 if(dv._lx==null){dv._lx=pointer.px;dv._vel=0;}
 var dx=pointer.px-dv._lx;dv._lx=pointer.px;
 dv._vel+=(dx-dv._vel)*0.45;                                  // smoothed cursor velocity
 var lean=Math.max(-16,Math.min(16,dv._vel*0.7));             // follow-through: body trails the motion
 var s=Math.sin(tk*0.9);
 var sway=s*4+Math.sin(tk*1.7)*1.5;                           // idle pendulum squirm
 var rot=sway+lean;
 var sx=(1-s*0.03-Math.abs(lean)*0.0009).toFixed(3);          // squash & stretch (volume-ish preserved)
 var sy=(1+s*0.04).toFixed(3);
 var bob=Math.round(s*2);
 dv.style.transform="translate(-50%,-50%) translateY("+bob+"px) rotate("+rot.toFixed(1)+"deg) scale("+sx+","+sy+")";
}
// the active "Hunger" word becomes draggable -> drag it to his mouth to feed him
function attachHunger(wordEl){
 let pid=null;
 function release(){if(pid!=null){try{wordEl.releasePointerCapture(pid);}catch(_){}pid=null;}}
 function onMove(e){if(!dragging||!dragCookie)return;dragCookie._x=e.clientX;dragCookie._y=e.clientY;dragCookie.style.left=e.clientX+"px";dragCookie.style.top=e.clientY+"px";faceTrackTo(e.clientX,e.clientY);}
 function onUp(){if(!dragging)return;dragging=false;release();wordEl.classList.remove("grab");const m=mouthScreen();
  var _hr=stage.getBoundingClientRect(),_hcx=_hr.left+_hr.width/2,_hcy=_hr.top+_hr.height/2;
  var _onHead=dragCookie&&Math.hypot(dragCookie._x-_hcx,dragCookie._y-_hcy)<_hr.width*0.72;   // drop ANYWHERE on his head (same generous zone the catchReady cue lights up), not just the mouth
  if(_onHead){if(busyNow()){if(dragCookie)dragCookie.style.visibility="hidden";queued=function(){if(dragCookie)dragCookie.style.visibility="";startEat();};}else startEat();}                                        // on his head -> eat
  else{if(dragCookie){dragCookie.remove();dragCookie=null;}wordEl.classList.remove("out");wordEl.style.opacity="";dragWordEl=null;cycHold=false;nextCycle(2600);}}  // missed -> reappear and keep cycling
 wordEl.addEventListener("pointerdown",e=>{if(dragging||CALIB||partyMode||loveMode||eating)return;e.preventDefault();
  const r=wordEl.getBoundingClientRect();dragWordEl=wordEl;wordEl.classList.add("grab");
  cycHold=true;clearTimeout(cycTimer);
  dragCookie=document.createElement("div");dragCookie.className="hungerdrag";
  dragCookie.innerHTML='Hunger'.split('').map(function(c){return '<span class="hgl">'+c+'</span>';}).join('')+'<span class="cookieDot"></span>';   // per-letter so he can chew the word away one bite at a time
  document.body.appendChild(dragCookie);
  dragCookie._x=r.left+r.width/2;dragCookie._y=r.top+r.height/2;dragCookie.style.left=dragCookie._x+"px";dragCookie.style.top=dragCookie._y+"px";
  wordEl.style.opacity="0";dragging=true;pid=e.pointerId;try{wordEl.setPointerCapture(pid);}catch(_){}});  // opacity:0 keeps the slot AND keeps the element receiving pointer events
 wordEl.addEventListener("pointermove",onMove);
 wordEl.addEventListener("pointerup",onUp);
 wordEl.addEventListener("pointercancel",onUp);
 wordEl.addEventListener("lostpointercapture",onUp);}   // safety net: a dropped cookie can never get stranded
function moodEat(){
 // the mood menu hands him no dragged word, so conjure one to actually eat; otherwise he chews air
 if(!dragCookie&&!reduce){
  var m=mouthScreen();
  var dc=document.createElement("div");dc.className="hungerdrag";
  dc.innerHTML='Hunger'.split('').map(function(c){return '<span class="hgl">'+c+'</span>';}).join('')+'<span class="cookieDot"></span>';
  document.body.appendChild(dc);
  var sx=Math.min(innerWidth-30,m.x+m.rr*0.7),sy=Math.max(58,m.y-m.rr*2.2);
  dc._x=sx;dc._y=sy;dc.style.left=sx+"px";dc.style.top=sy+"px";dc.style.opacity="1";
  dragCookie=dc;
 }
 startEat();
}
function startEat(){try{document.body.classList.remove("catchReady");}catch(_){}eating=true;eventLock=true;eatStart=performance.now();eatCrumbed=false;eatHopped=false;eatLastChew=-1;blinking=false;blinkQ=[];eyesClosed=false;if(tongueEl){tongueEl.style.opacity="0";tongueEl.style.transform="scaleY(0)";}eatStacheMade=false;eatWillStache=Math.random()<0.55;eatWillLick=eatWillStache;blinkSquash=1;eyeEls.forEach(function(e){e.el.style.display="";e.el.style.visibility="";e.el.classList.remove("eclosed");});
 const m=mouthScreen();eatFrom={x:dragCookie?dragCookie._x:m.x,y:dragCookie?dragCookie._y:m.y};eatTo={x:m.x,y:m.y};
 mouthimg.src=PFX+FACES.rest.img;mouthimg.style.opacity="1";setMouth(0);if(navigator.vibrate)navigator.vibrate(20);}
function randCrumbShape(){var n=5+Math.floor(Math.random()*3),pts=[];for(var i=0;i<n;i++){var a=(i/n)*6.2832+(Math.random()-0.5)*0.55;var r=30+Math.random()*19;pts.push((50+Math.cos(a)*r).toFixed(0)+"% "+(50+Math.sin(a)*r).toFixed(0)+"%");}return "polygon("+pts.join(",")+")";}
function spawnCrumbs(sp,n){
 if(crumbEls.length>140)return;
 var host=stage.parentElement,hr=host.getBoundingClientRect(),sr=stage.getBoundingClientRect();
 var mx=(sr.left-hr.left)+sr.width*0.5,my=(sr.top-hr.top)+sr.height*0.86,sw=sr.width;
 for(let i=0;i<n;i++){const c=document.createElement("div");c.className="crumb";const s=4+Math.random()*8;
  c.style.width=s.toFixed(1)+"px";c.style.height=(s*(0.7+Math.random()*0.5)).toFixed(1)+"px";
  var isText=Math.random()<0.45;c.style.backgroundImage="url(images/"+(isText?"texttex":"crumbtex")+".png)";c.style.backgroundPosition=(-(Math.random()*120)|0)+"px "+(-(Math.random()*120)|0)+"px";
  c.style.clipPath=randCrumbShape();
  const sh=document.createElement("div");sh.className="crumbshadow";sh.style.opacity="0";host.appendChild(sh);c._sh=sh;
  c._x=mx+(Math.random()-0.5)*sw*0.16;c._y=my+(Math.random()-0.5)*6;
  c._vx=(Math.random()-0.5)*4.6;c._vy=Math.random()*1.8-0.3;
  c._rot=Math.random()*360;c._vr=(Math.random()-0.5)*60;
  c._floor=false;c._fl=Math.random()*14;c._rest=24+Math.floor(Math.random()*16);c._op=1;c._bounced=0;
  c.style.left=Math.round(c._x)+"px";c.style.top=Math.round(c._y)+"px";c.style.transform="rotate("+Math.round(c._rot)+"deg)";
  host.appendChild(c);crumbEls.push(c);}}
function updateCrumbs(){const floorY=stage.parentElement.clientHeight*0.96;
 for(let i=crumbEls.length-1;i>=0;i--){const c=crumbEls[i];
  if(!c._floor){c._vy+=0.9;c._vx*=0.96;c._x+=c._vx;c._y+=c._vy;c._rot+=c._vr;c._vr*=0.98;
   if(c._y>=floorY-c._fl){c._y=floorY-c._fl;
    if(c._bounced<2&&c._vy>2.2){c._vy=-c._vy*0.34;c._vx*=0.55;c._vr*=0.5;c._bounced++;}
    else{c._floor=true;c._vy=0;c._vx=0;c._vr=0;}}}
  else if(c._rest>0){c._rest--;}
  else{c._op-=0.16;if(c._op<=0){c.remove();if(c._sh)c._sh.remove();crumbEls.splice(i,1);continue;}}
  c.style.left=Math.round(c._x)+"px";c.style.top=Math.round(c._y)+"px";
  c.style.transform="rotate("+Math.round(c._rot)+"deg)";c.style.opacity=c._op.toFixed(2);
  if(c._sh){var cw=parseFloat(c.style.width)||6,hgt=Math.max(0,floorY-c._y),tt=Math.max(0,Math.min(1,1-hgt/130)),w=cw*(1.8-0.6*tt);
   c._sh.style.width=w.toFixed(0)+"px";c._sh.style.height=(w*0.4).toFixed(0)+"px";
   c._sh.style.left=Math.round(c._x+cw/2)+"px";c._sh.style.top=Math.round(floorY)+"px";c._sh.style.transform="translate(-50%,-50%)";
   c._sh.style.opacity=((0.05+tt*0.3)*c._op).toFixed(2);}}}
var STACHE={neutral:[0.46,0.725],smile:[0.47,0.695],rest:[0.475,0.72]};
function placeStache(face){if(!mustCrumb)return;var a=STACHE[face]||STACHE.neutral;
 mustCrumb.style.left=((a[0]+mustCrumb._jx-mustCrumb._cw/2)*100).toFixed(2)+"%";
 mustCrumb.style.top=((a[1]+mustCrumb._jy-mustCrumb._ch/2)*100).toFixed(2)+"%";}
function makeStacheCrumb(){if(mustCrumb||!stage)return;var c=document.createElement("div");c.className="stachecrumb";
 c._cw=0.030+Math.random()*0.016;c._ch=c._cw*0.8;
 c._jx=(Math.random()-0.5)*0.075;c._jy=(Math.random()-0.5)*0.03;
 c.style.cssText="position:absolute;z-index:3;width:"+(c._cw*100).toFixed(2)+"%;height:"+(c._ch*100).toFixed(2)+"%;background-image:url(images/crumbtex.webp);background-size:46px 46px;pointer-events:none;filter:url(#inkSm)";
 c.style.backgroundPosition=(-(Math.random()*90)|0)+"px "+(-(Math.random()*90)|0)+"px";
 c.style.clipPath=randCrumbShape();c.style.setProperty("--r",((Math.random()*40-20)|0)+"deg");
 stage.appendChild(c);mustCrumb=c;placeStache(curFace||"neutral");}
function knockMustCrumb(){if(!mustCrumb)return;var host=stage.parentElement,hr=host.getBoundingClientRect(),mr=mustCrumb.getBoundingClientRect();
 var x=(mr.left-hr.left)+mr.width/2,y=(mr.top-hr.top)+mr.height/2;mustCrumb.remove();mustCrumb=null;
 for(var i=0;i<2;i++){var c=document.createElement("div");c.className="crumb";var s=5+Math.random()*5;
  c.style.width=s.toFixed(1)+"px";c.style.height=(s*0.82).toFixed(1)+"px";c.style.backgroundImage="url(images/crumbtex.webp)";
  c.style.backgroundPosition=(-(Math.random()*120)|0)+"px "+(-(Math.random()*120)|0)+"px";c.style.clipPath=randCrumbShape();
  var sh=document.createElement("div");sh.className="crumbshadow";sh.style.opacity="0";host.appendChild(sh);c._sh=sh;
  c._x=x+(Math.random()-0.5)*6;c._y=y;c._vx=(Math.random()-0.5)*3.6;c._vy=Math.random()*1.2+0.4;
  c._rot=Math.random()*360;c._vr=(Math.random()-0.5)*52;c._floor=false;c._fl=Math.random()*12;c._rest=24+(Math.random()*14|0);c._op=1;c._bounced=0;
  c.style.left=Math.round(c._x)+"px";c.style.top=Math.round(c._y)+"px";c.style.transform="rotate("+(c._rot|0)+"deg)";host.appendChild(c);crumbEls.push(c);}}
function eatLick(lt){var cl=function(v,a,b){return Math.max(a,Math.min(b,v));},ease=function(x){return x*x*(3-2*x);};
 if(curFace!=="rest"){setFace("rest");placeStache("rest");}mouthimg.style.opacity="0";
 var L=1.35,p=cl(lt/L,0,1),swipe=ease(cl((p-0.16)/0.60,0,1));
 if(eyeEls&&eyeEls.length){var gx=0.34+0.12*swipe,gy=-0.45-0.32*ease(cl(p/0.6,0,1));   // SAVOR: eyes roll up & away, not at the camera
  for(var gi=0;gi<eyeEls.length;gi++){var e=eyeEls[gi];if(e.iris){var r=e.el.getBoundingClientRect();e.iris.style.transform="translate("+Math.round(gx*r.width*TRAVEL)+"px,"+Math.round(gy*r.height*TRAVEL)+"px)";}}}
 if(!tongueEl)return{rot:0,ty:0,sx:1,sy:1};
 var emerge=ease(cl(p/0.20,0,1)),retract=ease(cl((p-0.76)/0.24,0,1)),out=emerge*(1-retract);
 tongueEl.style.opacity=(out>0.03?0.96:0).toFixed(2);
 var SY=0.24+out*0.60,SX=0.80+0.16*Math.sin(Math.PI*swipe)+0.06*out;
 var rotT=-17+swipe*34,curl=Math.sin(Math.PI*swipe)*9,bend=(swipe-0.5)*15,TYp=-4*out;
 tongueEl.style.transform="translateY("+TYp.toFixed(1)+"%) rotate("+(rotT+curl).toFixed(1)+"deg) skewX("+bend.toFixed(1)+"deg) scale("+SX.toFixed(2)+","+SY.toFixed(2)+")";
 if(mustCrumb&&swipe>0.42)knockMustCrumb();
 return{rot:(-2+swipe*4),ty:Math.round(Math.sin(p*Math.PI)*-3),sx:1+0.01*Math.sin(p*6),sy:1-0.01*Math.sin(p*6)};}
function finishEat(){eating=false;eventLock=!!reactType;eatCrumbed=false;eatHopped=false;if(tongueEl){tongueEl.style.opacity="0";tongueEl.style.transform="scaleY(0)";}if(mustCrumb){mustCrumb.remove();mustCrumb=null;}flushQueued();
 if(dragCookie){dragCookie.remove();dragCookie=null;}dragWordEl=null;                       // NOTE: crumbs are NOT cleared - they settle on the floor on their own
 mouthimg.style.opacity="0";blinking=false;blinkQ=[];eyesClosed=false;blinkSquash=1;settleFace();eyeEls.forEach(e=>{e.el.style.display="";e.el.style.visibility="";e.el.classList.remove("eclosed");});gaze={x:0,y:0};stage.style.transform="none";updateShadow(0,0,0);
 cycHold=false;advanceCycle();}                                                              // the eaten Hunger word is replaced by the next word
// the eat performance: anticipation -> chew cycle (squash & stretch) -> swallow -> savor into a smile
function eatTick(t){const cl=(v,a,b)=>Math.max(a,Math.min(b,v));const sp=speech.getBoundingClientRect();
 if(dragCookie){var _items=dragCookie.querySelectorAll(".hgl,.cookieDot"),_mth=mouthScreen();
  if(t<0.34){const k=cl(t/0.34,0,1),ek=k*k*(3-2*k);                                                  // CARRY: the word arcs up to his mouth, shrinking to a bite
    dragCookie.style.left=Math.round(eatFrom.x+(_mth.x-eatFrom.x)*ek)+"px";
    dragCookie.style.top=Math.round(eatFrom.y+(_mth.y-eatFrom.y)*ek-Math.sin(Math.PI*k)*24)+"px";
    dragCookie.style.transform="translate(-50%,-50%) scale("+(1-0.34*ek).toFixed(3)+") rotate("+Math.round(ek*14)+"deg)";dragCookie.style.opacity="1";}
  else if(t<1.6){                 // CHEW: word stays centered at the mouth, shrinks gently, letters chomp off the right end (cookie first)
    dragCookie.style.left=Math.round(_mth.x)+"px";dragCookie.style.top=Math.round(_mth.y)+"px";
    var _cp=cl((t-0.34)/(1.6-0.34),0,1),_gone=Math.round(_items.length*_cp),_chomp=1+0.05*Math.sin((t-0.34)*19);
    dragCookie.style.transform="translate(-50%,-50%) scale("+((0.66-0.26*_cp)*_chomp).toFixed(3)+") rotate(-4deg)";   // readable at the mouth, shrinks gently as it's eaten
    var _bit=dragCookie._bit||0;while(_bit<_gone&&_bit<_items.length){var _it=_items[_items.length-1-_bit];if(_it&&!_it._bitten){_it._bitten=1;_it.classList.add("bitn");(function(el){el.addEventListener("animationend",function(){el.style.display="none";},{once:true});})(_it);spawnCrumbs(sp,5+Math.floor(Math.random()*4));if(navigator.vibrate)navigator.vibrate(14);}_bit++;}dragCookie._bit=_bit;}
  else{dragCookie.remove();dragCookie=null;}}
 if(reduce){if(t>0.18&&curFace!=="smile"){setFace("smile");mouthimg.style.opacity="0";}if(t>=0.9)finishEat();return;}
 let rot=0,ty=0,sx=1,sy=1,mouth=0,brow="down",closeEyes=false;
 if(t<0.36){const k=Math.sin(Math.PI*cl(t/0.36,0,1)*0.5);ty=-3*k;rot=-2*k;brow="up";mouth=0.85*k;talkGaze={x:0,y:0.5};}            // ANTICIPATION: leans in, brows up, looks down at it
 else if(t<1.7){const ct=t-0.36,ph=ct*9.5,c=Math.sin(ph),close=c<0;                                  // CHEW: jaw pulses + crumbs spill on every chew
   const beat=Math.floor(ph/Math.PI);if(beat!==eatLastChew){eatLastChew=beat;if(eatWillStache&&!mustCrumb&&!eatStacheMade&&beat>=1){makeStacheCrumb();eatStacheMade=true;}if(!dragCookie)spawnCrumbs(sp,8+Math.floor(Math.random()*5));if(navigator.vibrate)navigator.vibrate(20);}
   mouth=close?0.12:0.78;sx=close?1.05:0.985;sy=close?0.95:1.02;ty=-Math.sin(ph)*2+Math.sin(ct*5)*1.2;rot=Math.sin(ct*4.5)*2.2;closeEyes=close;brow=close?"x":"down";talkGaze={x:0,y:0.2};} // S&S on cheeks/eyes/head
 else if(t<2.02){const k=cl((t-1.7)/0.32,0,1);mouth=0;closeEyes=true;ty=Math.sin(Math.PI*k)*4;}                                   // SWALLOW: head dips and rises
 else{const k=cl((t-2.02)/0.68,0,1);if(t<2.3){closeEyes=true;mouth=0;ty=2;}                                                       // SAVOR: a beat with eyes closed...
   else if(t<3.0){if(curFace!=="smile"){setFace("smile");mouthimg.style.opacity="0";placeStache("smile");}if(!eatHopped){eatHopped=true;if(navigator.vibrate)navigator.vibrate([22,45,22,70]);}ty=-9*Math.sin(Math.PI*cl((t-2.3)/0.4,0,1));}else if(eatWillLick){var _hm=eatLick(t-3.0);ty=_hm.ty;rot=_hm.rot;sx=_hm.sx;sy=_hm.sy;}} // ...then a happy smile + hop
 if(t>=(eatWillLick?4.5:3.0)){finishEat();return;}
 if(t<2.3){if(curFace!=="neutral")setFace("neutral");if(closeEyes){faceImg.src=FACES.neutral.closed;eyeEls.forEach(e=>e.el.style.visibility="hidden");}
   else{eyeEls.forEach(function(e){e.el.style.visibility="";e.el.style.display="";e.el.classList.remove("eclosed");});faceImg.src=(brow==="up"?FACES.neutral.browsup:PFX+FACES.neutral.img);
     eyeEls.forEach(e=>{const r=e.el.getBoundingClientRect();e.iris.style.transform="translate("+Math.round(talkGaze.x*r.width*TRAVEL)+"px,"+Math.round(talkGaze.y*r.height*TRAVEL)+"px)";});}
   setMouth(mouth);}
 stage.style.transform="translate(0px,"+Math.round(ty)+"px) rotate("+rot.toFixed(1)+"deg) scale("+sx.toFixed(3)+","+sy.toFixed(3)+")";updateShadow(0,ty,rot);}
function reactTick(){const t=(performance.now()-reactStart)/1000;
 if(reactType==="wink"){const DUR=1.15;
  if(t>=DUR){endReact();return;}
  if(curFace!=="wink")setFace("wink");                       // hold ONE wink
  if(!reduce){const p=t/DUR,decay=Math.pow(1-p,1.3),env=Math.sin(Math.PI*p); // tilt in and back out
   const rot=9*env+2*Math.sin(t*9)*decay, ty=-6*env, sc=1+0.05*env;
   stage.style.transform="translate(0px,"+Math.round(ty)+"px) rotate("+rot.toFixed(1)+"deg) scale("+sc.toFixed(3)+")";updateShadow(0,ty,rot);}
  return;}
 if(reactType==="talk"){const now=performance.now();
  if(talkSmile){const dip=Math.round(stage.clientHeight*0.06);stage.style.transform=reduce?"translate(0px,"+dip+"px) scale(.93)":"translate(0px,"+(dip+Math.round(Math.sin(t*3.5)*1.4))+"px) scale(.93)";updateShadow(0,dip,0);return;} // same dip as the talk phase -> no jump // hold the smile
  if(talkSayMode&&now>=talkSayEnd){if(talkCurWord){fadeWord(talkCurWord);talkCurWord=null;}talkSmile=true;mouthimg.style.opacity="0";talkGaze={x:0,y:-0.05};showFace("smile");setTimeout(endReact,1800);talkSayMode=false;return;}
  if(!talkSayMode&&now>=talkNextAt){
   talkIdx++;const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
   if(talkCurWord){fadeWord(talkCurWord);talkCurWord=null;}                // focus-out the previous trait word
   if(talkIdx<talkWords.length){
    const word=talkWords[talkIdx],st=STYLE[word.s]||STYLE.confident;
    const w=focusWord(word.t,"fw");                                        // SAME focus reveal as everywhere else
    const ang=Math.random()*Math.PI*2;
    let wx=cl(0.5+Math.cos(ang)*0.42,0.12,0.88),wy=cl(0.55+Math.sin(ang)*0.34,0.3,0.92);   // pops AROUND him, below the name bar
    w.style.left=(wx*100).toFixed(1)+"%";w.style.top=(wy*100).toFixed(1)+"%";
    speech.appendChild(w);talkCurWord=w;
    const bw=speech.clientWidth||1,bh=speech.clientHeight||1,hw=(w.offsetWidth/bw)/2+0.02,hh=(w.offsetHeight/bh)/2+0.02;
    wx=cl(wx,hw,1-hw);wy=cl(wy,Math.max(hh,0.28),1-hh);                    // keep clear of the "I am" line up top
    w.style.left=(wx*100).toFixed(1)+"%";w.style.top=(wy*100).toFixed(1)+"%";
    talkGaze={x:cl((wx-0.5)*2.3,-1,1)*st.g,y:cl((wy-0.52)*2.3,-1,1)*st.g};  // gaze energy varies with the word
    hRotT=(wx-0.5)*12*st.e;hTxT=(wx-0.5)*9*st.e;hTyT=(wy-0.5)*5*st.e;       // confident words turn his head harder; soft ones barely
    emph=st.e;browFrames=(Math.random()<st.b?3:0);
    if(Math.random()<0.55)talkBlinkAt=now+110;
    const gap=st.gap;talkNextAt=now+gap;talkSpeakUntil=now+gap-220;
   } else {                                                                // finale: his name joins "I am" up top
    talkNameDone=true;talkSmile=true;mouthimg.style.opacity="0";
    if(namebar&&namebarIam){const first=namebarIam.getBoundingClientRect();              // FLIP: measure where "I am" sits now
     namebar.appendChild(focusWord("Jayden Betts","",0.14));                          // name materialises a beat after "I am" starts moving
     if(!reduce){const dx=first.left-namebarIam.getBoundingClientRect().left;             // how far the re-centre shoved it
      namebarIam.style.transition="none";namebarIam.style.transform="translateX("+dx.toFixed(1)+"px)";void namebarIam.offsetWidth;
      namebarIam.style.transition="transform .625s steps(5,end)";namebarIam.style.transform="translateX(0)";}}  // choppy 8fps glide, no teleport -> "I am Jayden Betts"
    talkGaze={x:0,y:-0.32};                                                 // he looks up toward his name
    if(navigator.vibrate)navigator.vibrate([14,40,14]);
    showFace("smile");setTimeout(endReact,3000);return;
   }
  }
  if(reduce){setMouth(0);return;}
  const speaking=now<talkSpeakUntil;
  let op=0;if(speaking){const r=0.5+0.5*Math.sin(tk*0.95);op=r<0.34?0.2:(r<0.67?0.55:0.95);}  // posterized jaw openness
  setMouth(op);
  if(talkBlink>0){talkBlink--;if(!talkClosed){faceImg.src=FACES.neutral.closed;eyeEls.forEach(e=>e.el.style.display="none");talkClosed=true;curBrow="x";}}
  else{ if(talkClosed){talkClosed=false;eyeEls.forEach(e=>e.el.style.display="");}
   if(browFrames>0){browFrames--;if(curBrow!=="up"){faceImg.src=FACES.neutral.browsup;curBrow="up";}}   // brows raised on the word
   else if(curBrow!=="down"){faceImg.src=PFX+FACES.neutral.img;curBrow="down";}                         // brows settle back
   const jx=Math.sin(tk*0.7)*0.04, jy=Math.cos(tk*0.9)*0.03;                                            // tiny live micro-saccade
   eyeEls.forEach(e=>{const r=e.el.getBoundingClientRect();
     e.iris.style.transform="translate("+Math.round((talkGaze.x+jx)*r.width*TRAVEL)+"px,"+Math.round((talkGaze.y+jy)*r.height*TRAVEL)+"px)";});
   if(now>=talkBlinkAt){talkBlink=2;talkBlinkAt=now+1600+Math.random()*1500;} }
  hRot+=(hRotT-hRot)*0.25;hTx+=(hTxT-hTx)*0.25;hTy+=(hTyT-hTy)*0.25;emph*=0.82;                          // ease the head toward target
  const dipK=reduce?1:Math.min(1,Math.floor((now-reactStart)/125)/3);                                     // settle DOWN over 3 stepped frames (8fps)
  const DIP=Math.round(stage.clientHeight*0.06*dipK);                                                     // sit a little lower so the name bar clears his head
  const ty=DIP+hTy+Math.sin(t*5.5)*1.6-emph*5, sc=0.93+emph*0.025;
  stage.style.transform="translate("+Math.round(hTx)+"px,"+Math.round(ty)+"px) rotate("+hRot.toFixed(1)+"deg) scale("+sc.toFixed(3)+")";updateShadow(hTx,ty,hRot);
  return;}
 endReact();
}

const _tb=document.querySelector("#inkBig feTurbulence"),_ts=document.querySelector("#inkSm feTurbulence"),_grain=document.getElementById("grain"),fsh=document.getElementById("fsh");
const SEEDS=[7,19,3,28,11,23,5,31];
function boil(){const s=SEEDS[tk%SEEDS.length];if(_tb)_tb.setAttribute("seed",s);if(_ts)_ts.setAttribute("seed",(s*2+5)%37);}
// floating contact shadow: higher head -> bigger, softer, lighter; lower -> tighter, darker, sharper (and follows sideways)
function updateShadow(dx,dy,rot){const lift=-dy;
 const sx=Math.max(0.55,Math.min(1.7,1+lift*0.010)),sy=Math.max(0.5,Math.min(1.5,1+lift*0.006));
 const op=Math.max(0.12,Math.min(0.6,0.5-lift*0.006)),bl=Math.max(4,Math.min(22,7+lift*0.45));
 fsh.style.transform="translateX(calc(-50% + "+Math.round(dx*0.55)+"px)) skewX("+(rot*0.25).toFixed(1)+"deg) scale("+sx.toFixed(3)+","+sy.toFixed(3)+")";
 fsh.style.opacity=op.toFixed(2);fsh.style.filter="blur("+bl.toFixed(1)+"px)";}
updateShadow(0,0,0);

// per-expression body language: a held "pose" + a one-shot entry "gesture"
function poseFor(f){
 if(f==="wink")return{rot:6,sc:1.0,ty:0,tx:5};      // cheeky head-tilt
 if(f==="smile")return{rot:0,sc:1.035,ty:-5,tx:0};  // lean in, beaming
 if(f==="rest")return{rot:-4,sc:0.99,ty:4,tx:-3};   // relaxed settle-back
 return{rot:0,sc:1,ty:0,tx:0};}                      // neutral
function triggerGesture(f){if(reduce||f==="neutral")return;gType=f;gStart=performance.now();}
function gestureOffset(){if(!gType)return{rot:0,ty:0,tx:0,sc:1};
 const td=(performance.now()-gStart)/1000,DUR=gType==="smile"?0.8:(gType==="wink"?0.7:0.6);
 if(td>=DUR){gType=null;return{rot:0,ty:0,tx:0,sc:1};}
 const p=td/DUR,decay=Math.pow(1-p,1.5);
 if(gType==="wink")return{rot:8*Math.sin(td*16)*decay,ty:0,tx:2*Math.sin(td*16)*decay,sc:1+0.02*Math.sin(td*16)*decay}; // tilt + settle wobble
 if(gType==="smile")return{rot:0,ty:-11*Math.sin(Math.PI*Math.min(1,p*1.6))*decay,tx:0,sc:1+0.03*Math.sin(Math.PI*p)*decay};// happy hop
 if(gType==="rest")return{rot:-5*Math.sin(td*7)*decay,ty:5*(1-decay),tx:0,sc:1};                                          // easy sink
 return{rot:0,ty:0,tx:0,sc:1};}

// ===== COLLABORATION: drag the camera word onto his head -> a contact sheet of the team rains in =====
function attachCollab(wordEl){
 let pid=null;
 function release(){if(pid!=null){try{wordEl.releasePointerCapture(pid);}catch(_){}pid=null;}}
 function onMove(e){if(!dragging||!dragCam)return;dragCam._x=e.clientX;dragCam._y=e.clientY;dragCam.style.left=e.clientX+"px";dragCam.style.top=e.clientY+"px";faceTrackTo(e.clientX,e.clientY);}
 function onUp(){if(!dragging)return;dragging=false;release();wordEl.classList.remove("grab");
  const r=stage.getBoundingClientRect();const onHead=!!dragCam&&dragCam._x>r.left-50&&dragCam._x<r.right+50&&dragCam._y>r.top-70&&dragCam._y<r.bottom+30;
  if(dragCam){dragCam.remove();dragCam=null;}
  if(onHead){wordEl.style.opacity="0";runOrQueue(startRain);}
  else{wordEl.classList.remove("out");wordEl.style.opacity="";dragWordEl=null;cycHold=false;nextCycle(2600);}}
 wordEl.addEventListener("pointerdown",e=>{if(dragging||CALIB||partyMode||loveMode||eating||rainMode)return;e.preventDefault();
  const r=wordEl.getBoundingClientRect();dragWordEl=wordEl;wordEl.classList.add("grab");cycHold=true;clearTimeout(cycTimer);
  dragCam=document.createElement("div");dragCam.className="collabdrag";dragCam.innerHTML='Empathy<span class="camDot"></span>';document.body.appendChild(dragCam);
  dragCam._x=r.left+r.width/2;dragCam._y=r.top+r.height/2;dragCam.style.left=dragCam._x+"px";dragCam.style.top=dragCam._y+"px";
  wordEl.style.opacity="0";dragging=true;pid=e.pointerId;try{wordEl.setPointerCapture(pid);}catch(_){}});
 wordEl.addEventListener("pointermove",onMove);
 wordEl.addEventListener("pointerup",onUp);
 wordEl.addEventListener("pointercancel",onUp);
 wordEl.addEventListener("lostpointercapture",onUp);}
// the team photos that rain in. TO ADD MORE LATER: drop a compressed jpg into images/rain/ and add its filename to this list.
/* ===== Identity word -> About takeover (drag mirrors attachCollab; drop on head opens About) ===== */
var dragId=null;   // the retired About overlay no longer gates portrait interaction
/* Kept out of the deleted block on purpose: this reveals .heroCtas -- the "View my
   work" button -- which is a live hero element with nothing to do with About. It was
   only ever filed under About because the overlay called it on the way back. */
function abShowCtas(){try{var hc=document.querySelector(".heroCtas");if(!hc)return;hc.classList.add("in");
  for(var i=0;i<hc.children.length;i++){var c=hc.children[i];c.style.animation="none";c.style.opacity="1";c.style.transform="none";}}catch(_){}}
function attachIdentity(wordEl){
 let pid=null;
 function release(){if(pid!=null){try{wordEl.releasePointerCapture(pid);}catch(_){}pid=null;}}
 function onMove(e){if(!dragging||!dragId)return;dragId._x=e.clientX;dragId._y=e.clientY;dragId.style.left=e.clientX+"px";dragId.style.top=e.clientY+"px";faceTrackTo(e.clientX,e.clientY);}
 function onUp(){if(!dragging)return;dragging=false;release();wordEl.classList.remove("grab");
  const r=stage.getBoundingClientRect();const onHead=!!dragId&&dragId._x>r.left-50&&dragId._x<r.right+50&&dragId._y>r.top-70&&dragId._y<r.bottom+30;
  if(dragId){dragId.remove();dragId=null;}
  if(onHead){wordEl.style.opacity="0";location.href="about.html";}   // the drop used to open the overlay; About has a URL now
  else{wordEl.classList.remove("out");wordEl.style.opacity="";dragWordEl=null;cycHold=false;nextCycle(2600);}}
 wordEl.addEventListener("pointerdown",function(e){if(dragging||CALIB||partyMode||loveMode||eating||rainMode)return;e.preventDefault();
  const r=wordEl.getBoundingClientRect();dragWordEl=wordEl;wordEl.classList.add("grab");cycHold=true;clearTimeout(cycTimer);
  dragId=document.createElement("div");dragId.className="iddrag";dragId.innerHTML='Identity<span class="fpDot fpStatic"></span>';document.body.appendChild(dragId);
  dragId._x=r.left+r.width/2;dragId._y=r.top+r.height/2;dragId.style.left=dragId._x+"px";dragId.style.top=dragId._y+"px";
  wordEl.style.opacity="0";dragging=true;pid=e.pointerId;try{wordEl.setPointerCapture(pid);}catch(_){}});
 wordEl.addEventListener("pointermove",onMove);wordEl.addEventListener("pointerup",onUp);wordEl.addEventListener("pointercancel",onUp);wordEl.addEventListener("lostpointercapture",onUp);}
/* ===== 285 LINES OF ABOUT-OVERLAY MACHINERY WERE DELETED HERE =====
   openAbout / openAboutNow / closeAbout / abFinalizeClose, the head FLIP
   (abPinWrapTo, abGlideWrapToAbout, abGlideWrapHome, abStageToHome and their resets),
   abCopyFreeze/Unfreeze, abNameMorphOpen/Close, ensureVeil, abSmoothTop, the #about
   popstate + hash router, and the whole photo/word sequencer IIFE (abSplitWords,
   abActive, abPeekStart, aboutRevealPhotos, aboutCloseFx).
   About is about.html now. Two bugs this file carried died with it rather than being
   fixed: the .heroCopy display:contents trap -- the invert was set on a box that is
   never generated, so it was silently a no-op -- and the return-leg double-count that
   put the head 340px left of centre for 780ms.
   NOTHING ELSE DEPENDED ON THEM: every remaining caller was a guard of the form
   the overlay guards, and those went with the flag. #logo and #navAbout keep their ids. ===== */


var RAIN_PHOTOS=["rain01.webp","rain02.webp","rain03.webp","rain04.webp","rain05.webp","rain06.webp","rain07.webp","rain08.webp","rain09.webp","rain10.webp","rain11.webp","rain12.webp","rain13.webp","rain14.webp","rain15.webp","rain16.webp","rain17.webp","rain18.webp"];
/* ===== popcorn movie-watching mode (triggered by reel hover, alongside the 3D glasses) ===== */
var movieMode=false,movieTk0=0,movieEnding=false,movieEndTk=0,bucketEl=null,kernelEls=[],popcrumbEls=[],movieHair=false,hairTk0=0,MOVCYCLE=18;
var heroPeek=document.querySelector(".heroCharacterPeek");
function setMoviePeek(on){if(heroPeek)heroPeek.classList.toggle("is-movie",!!on);}
function syncMovieEffectsLayer(){
 if(!movieEffectsStage)return;
 var priorTransform=stage.style.transform;
 stage.style.transform="none";
 var stageRect=stage.getBoundingClientRect(),clipRect=movieEffectsStage.parentNode.getBoundingClientRect();
 stage.style.transform=priorTransform;
 movieEffectsStage.style.left=(stageRect.left-clipRect.left).toFixed(2)+"px";
 movieEffectsStage.style.top=(stageRect.top-clipRect.top).toFixed(2)+"px";
 movieEffectsStage.style.width=stageRect.width.toFixed(2)+"px";
 movieEffectsStage.style.height=stageRect.height.toFixed(2)+"px";
 movieEffectsStage.style.transform=priorTransform;
}
function setMovieStageTransform(value){
 stage.style.transform=value;
 if(movieEffectsStage)movieEffectsStage.style.transform=value;
}
function glassesOn(){var g=document.getElementById("glasses");if(g){g.classList.remove("off");g.classList.add("on");}}
function glassesOff(){var g=document.getElementById("glasses");if(g){g.classList.remove("on");g.classList.add("off");}}
function makePlainCycWord(text){var w=document.createElement("span");w.className="cycw";var joy=/\.\.$/.test(text);var body=joy?text.slice(0,-2):text;var arr=[...body];arr.forEach(function(ch,ci){var sp=document.createElement("span");var isDot=(!joy&&ch==="."&&ci===arr.length-1);var cls=isDot?"bounceDot":"in";sp.className="cyc-ch "+cls;sp.textContent=ch;sp.style.animationDelay=(ci*CYC_STAG).toFixed(3)+"s";sp.addEventListener("animationend",function(){sp.classList.remove(cls);},{once:true});w.appendChild(sp);});if(joy){var jd=document.createElement("span");jd.className="cyc-ch joyDot in";jd.setAttribute("aria-hidden","true");jd.innerHTML='<svg class="joySvg" viewBox="0 0 30 26" xmlns="http://www.w3.org/2000/svg"><circle class="joyEye" cx="10" cy="11" r="2.3"/><circle class="joyEye" cx="20" cy="11" r="2.3"/><path class="joySmile" pathLength="1" d="M7 16 Q15 23 23 16"/></svg>';jd.style.animationDelay=(arr.length*CYC_STAG).toFixed(3)+"s";jd.addEventListener("animationend",function(e){if(e.animationName==="cycIn")jd.classList.remove("in");});w.appendChild(jd);}return w;}
function ensureMovieEls(){
 if(bucketEl)return;
 var host=movieEffectsStage||stage;
 bucketEl=document.createElement("img");bucketEl.className="popbucket";bucketEl.src="images/bucket.webp";bucketEl.alt="";bucketEl.style.opacity="0";host.appendChild(bucketEl);
 for(var i=0;i<7;i++){var k=document.createElement("img");k.className="kernel";k.src="images/kernel.webp";k.alt="";k.style.opacity="0";host.appendChild(k);kernelEls.push(k);}
 for(var j=0;j<12;j++){var cc=document.createElement("div");cc.className="popcrumb";host.appendChild(cc);popcrumbEls.push(cc);}
}
function setKernel(el,x,y,rot,op){el.style.left=(x*100).toFixed(1)+"%";el.style.top=(y*100).toFixed(1)+"%";el.style.transform="translate(-50%,-50%) rotate("+rot.toFixed(0)+"deg)";el.style.opacity=op.toFixed(2);}
function startMovie(word){
 glassesOn();
 setMoviePeek(true);
 if(introMode)finishIntro();
 if(reduce||CALIB||movieMode)return;
 queued=null;if(typeof hideQueue==="function")hideQueue();
 if(rainMode)endRain();if(partyMode)endParty();if(loveMode)endLove();if(eating)finishEat();
 dizzy=false;reactType=null;identityShown=false;
 ensureMovieEls();
 syncMovieEffectsLayer();
 movieMode=true;movieEnding=false;movieHair=false;movieTk0=tk;eventLock=true;clearTimeout(cycTimer);cycHold=true;if(cycWord){var mw=makePlainCycWord(word||"Motion.");cycWord.replaceWith(mw);cycWord=mw;}
 setFace("neutral");mouthimg.src=FACES.rest.img;mouthimg.style.opacity="0";setMouth(0);
 for(var i=0;i<kernelEls.length;i++)kernelEls[i].style.opacity="0";
 /* peek removed */
}
function caughtMovie(){
 if(!movieMode){glassesOff();setMoviePeek(false);return;}
 if(movieEnding)return;
 movieEnding=true;movieEndTk=tk;
 for(var i=0;i<kernelEls.length;i++){var kk=kernelEls[i];kk._x=0.46+Math.random()*0.10;kk._y=0.80;kk._vx=(Math.random()*0.10-0.05);kk._vy=-(0.04+Math.random()*0.06);kk._rot=Math.random()*360;kk._spin=Math.random()*50-25;kk._dropping=false;}
 if(tongueEl){tongueEl.style.opacity="0";tongueEl.style.transform="scaleY(0)";}
}
function endMovieCleanup(){
 /* peek removed */
 movieMode=false;movieEnding=false;movieHair=false;eventLock=false;
 if(heroPeek)heroPeek.removeAttribute("data-movie-tick");
 if(bucketEl)bucketEl.style.opacity="0";
 for(var i=0;i<kernelEls.length;i++){kernelEls[i].style.opacity="0";kernelEls[i]._dropping=false;kernelEls[i]._htx=null;}
 for(var i=0;i<popcrumbEls.length;i++){popcrumbEls[i]._alive=false;popcrumbEls[i].style.opacity="0";}
 mouthimg.style.opacity="0";setMouth(0);glassesOff();setMoviePeek(false);if(tongueEl){tongueEl.style.opacity="0";tongueEl.style.transform="scaleY(0)";}
 setMovieStageTransform("");setFace("neutral");gaze.x=0;gaze.y=0;updateIris();
 cycHold=false;if(cycWord){var nw=makeCycWord(wi);cycWord.replaceWith(nw);cycWord=nw;}
 nextCycle(1500);
}
var bearMode=false;   // (Bearings bear-ears easter egg removed)
var movieCrumbThis=false,movieLickThis=false,movieDropThis=false,movieGlanceThis=false;
var movGazeNext=0,movGX=0,movGY=0.2;
function dropAKernel(side){
 for(var i=1;i<kernelEls.length;i++){var d=kernelEls[i];if(d._dropping)continue;
  d._dropping=true;d._dx=side+(Math.random()*0.05-0.025);d._dy=0.79;d._dvx=(side<0.5?-1:1)*(0.004+Math.random()*0.009);d._dvy=-(0.003+Math.random()*0.012);d._drot=Math.random()*360;d._dspin=Math.random()*34-17;d._dop=1;return;}
}
function updateMovieDrops(){
 for(var i=1;i<kernelEls.length;i++){var d=kernelEls[i];if(!d._dropping)continue;
  d._dvy+=0.010;d._dx+=d._dvx;d._dy+=d._dvy;d._drot+=d._dspin;d._dop-=0.018;
  if(d._dy>1.3||d._dop<=0){d._dropping=false;d.style.opacity="0";continue;}
  setKernel(d,d._dx,d._dy,d._drot,Math.max(0,d._dop));}
}
function setCrumb(c){c.style.left=(c._cx*100).toFixed(1)+"%";c.style.top=(c._cy*100).toFixed(1)+"%";c.style.transform="translate(-50%,-50%) rotate("+c._crot.toFixed(0)+"deg)";c.style.opacity=c._cop.toFixed(2);}
function spawnMovieCrumbs(n){var got=0;for(var i=0;i<popcrumbEls.length&&got<n;i++){var c=popcrumbEls[i];if(c._alive)continue;got++;
  c._alive=true;c._cx=0.5+(Math.random()-0.5)*0.10;c._cy=0.75;c._cvx=(Math.random()-0.5)*0.055;c._cvy=-(0.008+Math.random()*0.02);c._crot=Math.random()*360;c._cspin=Math.random()*40-20;c._cop=1;c._clife=0;
  var s=(1.5+Math.random()*1.7).toFixed(1);c.style.width=s+"%";c.style.height=s+"%";c.style.background=Math.random()<0.5?"#ece2cd":"#dbcfb4";c.style.clipPath=randCrumbShape();setCrumb(c);}}
function updateMovieCrumbs(){for(var i=0;i<popcrumbEls.length;i++){var c=popcrumbEls[i];if(!c._alive)continue;
  c._clife++;c._cvy+=0.006;c._cvx*=0.99;c._cx+=c._cvx;c._cy+=c._cvy;c._crot+=c._cspin;
  if(c._clife>7)c._cop-=0.07;
  if(c._cop<=0||c._cy>1.25){c._alive=false;c.style.opacity="0";continue;}
  setCrumb(c);}}
function dumpOnHair(){
 movieHair=true;hairTk0=tk;mouthimg.style.opacity="0";if(tongueEl){tongueEl.style.opacity="0";tongueEl.style.transform="scaleY(0)";}
 for(var i=0;i<kernelEls.length;i++){var k=kernelEls[i];
  k._hsx=0.47+Math.random()*0.06;k._hsy=0.80;k._htx=0.28+Math.random()*0.44;k._hty=0.10+Math.random()*0.18;
  k._hpx=(k._hsx+k._htx)/2+(Math.random()*0.1-0.05);k._hpy=0.02+Math.random()*0.07;
  k._hr0=Math.random()*360;k._hr1=Math.random()*50-25;k._hx=k._hsx;k._hy=k._hsy;k._hrot=k._hr0;k._hvx=0;k._hvy=0;k._dropping=false;k.style.opacity="0";}
}
function hairTick(){
 var ht=tk-hairTk0;
 if(bucketEl){var bk=Math.min(1,ht/6);bucketEl.style.opacity=(bk>=1?0:1).toString();bucketEl.style.transform="translateX(-50%) translate("+(22*bk).toFixed(0)+"%,"+(34*bk*bk).toFixed(0)+"%) rotate("+(46*bk).toFixed(0)+"deg)";}
 for(var i=0;i<kernelEls.length;i++){var k=kernelEls[i];if(k._htx==null)continue;
  if(ht<=7){var t=ht/7;var x=(1-t)*(1-t)*k._hsx+2*(1-t)*t*k._hpx+t*t*k._htx;var y=(1-t)*(1-t)*k._hsy+2*(1-t)*t*k._hpy+t*t*k._hty;k._hx=x;k._hy=y;k._hrot=k._hr0+(k._hr1-k._hr0)*t+t*200;setKernel(k,x,y,k._hrot,1);}
  else if(ht<39){var jt=Math.sin((tk+i*1.7)*0.5)*0.004;setKernel(k,k._htx+jt,k._hty,k._hr1,1);}
  else{if(ht===39){k._hvx=(Math.random()-0.5)*0.05;k._hvy=-0.012-Math.random()*0.02;k._hx=k._htx;k._hy=k._hty;}k._hvy+=0.013;k._hx+=k._hvx;k._hy+=k._hvy;k._hrot+=(k._hr1>=0?14:-14);setKernel(k,k._hx,k._hy,k._hrot,Math.max(0,1-(ht-39)/9));}}
 if(ht<3){if(curFace!=="rest")setFace("rest");mouthimg.style.opacity="0";gaze.x=0;gaze.y=-0.18;updateIris();setMovieStageTransform("scale("+(ht===0?1.04:1.0)+")");}
 else if(ht<39){if(curFace!=="neutral")setFace("neutral");gaze.x=0.04*Math.sin(tk*0.2);gaze.y=-0.16;updateIris();var hb=Math.sin(tk*0.5)*1.0;setMovieStageTransform("translateY("+hb.toFixed(1)+"px)");}
 else{var sh=Math.sin((ht-39)*1.7)*(7*Math.max(0,1-(ht-39)/9));gaze.x=0;gaze.y=0.04;updateIris();setMovieStageTransform("translateX("+sh.toFixed(1)+"px) rotate("+(sh*0.4).toFixed(2)+"deg)");}
 if(ht>=48)endMovieCleanup();
}
function movieTick(){
 if(heroPeek)heroPeek.setAttribute("data-movie-tick",String(tk));
 if(reduce){movieMode=false;return;}
 lastMove=performance.now()-1e6;
 updateMovieCrumbs(); 
 var bob=Math.sin(tk*0.55)*1.1,ty=bob,rot=0,sx=1,sy=1;
 if(!movieEnding){
  var lt=tk-movieTk0;
  if(curFace!=="neutral")setFace("neutral");
  if(tk>=movGazeNext){movGX=(Math.random()*2-1)*0.42;movGY=0.10+Math.random()*0.22;if(Math.random()<0.16)movGY=0.32+Math.random()*0.06;movGazeNext=tk+2+(Math.random()*4|0);}
  gaze.x=movGX+(Math.random()*0.02-0.01);gaze.y=movGY+(Math.random()*0.02-0.01);
  var reach=0;
  if(lt<3){var bin=lt/3;bucketEl.style.opacity=bin.toFixed(2);bucketEl.style.transform="translateX(-50%) translateY("+((1-bin)*44).toFixed(0)+"%)";}
  else{
   bucketEl.style.opacity="1";
   var c=(lt-3)%MOVCYCLE,ci=Math.floor((lt-3)/MOVCYCLE),side=(ci%2)?0.58:0.42,K=kernelEls[0];
   if(c===0){movieCrumbThis=Math.random()<0.38;movieLickThis=movieCrumbThis&&Math.random()<0.22;movieDropThis=Math.random()<0.22;movieGlanceThis=Math.random()<0.25;if(tongueEl){tongueEl.style.opacity="0";tongueEl.style.transform="scaleY(0)";}}
   if(c<=4){var t=c/4,Sx=side,Sy=0.84,Px=0.49,Py=0.6,Ex=0.5,Ey=0.73;
     var x=(1-t)*(1-t)*Sx+2*(1-t)*t*Px+t*t*Ex,y=(1-t)*(1-t)*Sy+2*(1-t)*t*Py+t*t*Ey;
     setKernel(K,x,y,t*150,1);setMouth(0);
     var rk=Math.sin(Math.PI*(c/4));reach=(side<0.5?-1:1)*2.4*rk;
     if(movieGlanceThis&&c<=2){gaze.y+=0.10;gaze.x+=(side<0.5?-0.12:0.12);}
     if(c===2&&movieDropThis)dropAKernel(side);}
   else if(c===5){K.style.opacity="0";mouthimg.style.opacity="1";setMouth(0.4);ty=bob-1.5;sx=1.012;sy=0.99;}
   else if(c===6){setMouth(0.09);sy=0.992;ty=bob-1;}
   else if(c===7){setMouth(0.2);sy=1.004;ty=bob-1;}
   else if(c===8){setMouth(0.08);sy=0.992;ty=bob-1;if(movieCrumbThis)spawnMovieCrumbs(2+(Math.random()*2|0));}
   else if(c===9){setMouth(0.17);sy=1.003;ty=bob-1;}
   else if(c===10){setMouth(0.07);sy=0.993;ty=bob-1;}
   else if(c===11){setMouth(0);mouthimg.style.opacity="0";}
   else if(c===13&&movieLickThis&&tongueEl){tongueEl.style.opacity="1";tongueEl.style.transform="translateX(-12%) scaleY(0.8) rotate(-6deg)";}
   else if(c===14&&movieLickThis&&tongueEl){tongueEl.style.transform="translateX(10%) scaleY(0.95) rotate(7deg)";}
   else if(c===15&&tongueEl){tongueEl.style.opacity="0";tongueEl.style.transform="scaleY(0)";}
   var sway=Math.sin(tk*0.42)*1.5,bj=Math.sin(tk*0.42+1)*1.1;
   bucketEl.style.transform="translateX(-50%) translateY("+bj.toFixed(1)+"px) rotate("+(sway+reach).toFixed(1)+"deg)";
  }
  updateIris();
  updateMovieDrops();
  setMovieStageTransform("translateY("+ty.toFixed(1)+"px) rotate("+rot.toFixed(2)+"deg) scale("+sx.toFixed(3)+","+sy.toFixed(3)+")");
  return;
 }
 if(movieHair){hairTick();return;}
 var et=tk-movieEndTk;
 if(et<3){if(curFace!=="rest")setFace("rest");mouthimg.style.opacity="0";if(tongueEl)tongueEl.style.opacity="0";var sgx=et===0?0.11:et===1?-0.07:0.02,sgy=et===0?-0.12:et===1?-0.09:-0.07;gaze.x=sgx;gaze.y=sgy;updateIris();
   var pop=et===0?1.05:et===1?1.02:1.0;setMovieStageTransform("scale("+pop+")");if(bucketEl)bucketEl.style.transform="translateX(-50%)";return;}
 var k=Math.min(1,(et-3)/5);
 if(et===3){setFace("wink");glassesOff();}
 else if(et>=6&&curFace!=="neutral")setFace("neutral");
 bucketEl.style.transform="translateX(-50%) translate("+(-160*k).toFixed(0)+"%,"+(-15-150*k*k).toFixed(0)+"%) rotate("+(-320*k).toFixed(0)+"deg)";
 if(k>=1)bucketEl.style.opacity="0";
 for(var i=0;i<kernelEls.length;i++){var kn=kernelEls[i];if(kn._vx==null)continue;kn._vy+=0.012;kn._x+=kn._vx;kn._y+=kn._vy;kn._rot+=kn._spin;setKernel(kn,kn._x,kn._y,kn._rot,Math.max(0,1-(et-3)/7));}
 rot=10*k;ty=bob+6*k;gaze.x=-0.14;gaze.y=0.13;updateIris();
 setMovieStageTransform("translateY("+ty.toFixed(1)+"px) rotate("+rot.toFixed(2)+"deg)");
 if(et>=10)endMovieCleanup();
}
stage.addEventListener("pointerenter",function(){if(movieMode&&movieEnding&&!movieHair&&(tk-movieEndTk)<=3)dumpOnHair();});
function startRain(){try{document.body.classList.remove("catchReady");}catch(_){}
 if(rainMode)return;
 document.body.classList.add("heroEmpathy");
 rainMode=true;eventLock=true;cycHold=true;clearTimeout(cycTimer);
 rainWrap=document.createElement("div");rainWrap.id="photorain";
 var pg=document.createElement("div");pg.className="pgrain";rainWrap.appendChild(pg);
 var W=innerWidth,Hh=innerHeight,N=RAIN_PHOTOS.length;
 var hr=stage.getBoundingClientRect();
 rainHr={cx:hr.left+hr.width/2,cy:hr.top+hr.height/2,w:hr.width,h:hr.height};        // head centre, so his eyes can follow the photos
 var cols=Math.max(2,Math.round(Math.sqrt(N*(W/Hh)*1.15))),rows=Math.ceil(N/cols);  // jittered grid across the WHOLE screen, every photo visible
 var cellW=W/cols,cellH=Hh/rows;
 var order=[];for(var i=0;i<N;i++)order.push(i);for(var i=N-1;i>0;i--){var j=(Math.random()*(i+1))|0,t=order[i];order[i]=order[j];order[j]=t;}
 rainPerTick=Math.max(1,Math.round(N/18));                                           // deliberate fill (slower), auto-scales as you add photos
 rainList=[];
 for(var i=0;i<N;i++){
  var col=i%cols,row=(i/cols)|0;
  var cx=(col+0.5)*cellW+(Math.random()-0.5)*cellW*0.28;
  var cy=(row+0.5)*cellH+(Math.random()-0.5)*cellH*0.28;
  var pw=cellW*1.12*(0.92+Math.random()*0.16);if(pw>270)pw=270;if(pw<118)pw=118;     // slight overlap, fills the frame
  var wrap=document.createElement("div");wrap.className="rainphoto";wrap.style.width=pw.toFixed(0)+"px";wrap.style.left=cx.toFixed(1)+"px";wrap.style.top=cy.toFixed(1)+"px";wrap.style.opacity="0";
  var im=document.createElement("img");im.src="images/rain/"+RAIN_PHOTOS[i];im.alt="";wrap.appendChild(im);
  rainWrap.appendChild(wrap);
  rainList.push({el:wrap,cx:cx,cy:cy,rot:Math.random()*15-7.5,o:order[i],dropAt:(order[i]%6)+((Math.random()*3)|0),spin:Math.random()*10-5});
 }
 document.body.appendChild(rainWrap);
 rainTk0=tk;
 var lastReveal=Math.floor((N-1)/rainPerTick)+2;   // +2 ticks: the flash fires first, photos develop after
 rainHoldStart=lastReveal+2;rainDropStart=rainHoldStart+18;                          // fill -> grin & hold ~1.5s -> graceful exit
 rainHeadState="";blinking=false;blinkQ=[];eyesClosed=false;
 if(reduce){rainList.forEach(function(p){p.el.style.opacity="1";p.el.style.transform="translate(-50%,-50%) rotate("+p.rot.toFixed(1)+"deg)";});setFace("smile");setTimeout(endRain,2600);return;}
 setFace("neutral");
 faceImg.src=FACES.neutral.closed;for(var i=0;i<eyeEls.length;i++)eyeEls[i].el.style.display="none";rainHeadState="dazzle";   // brace for the flash
 camflash=document.createElement("div");camflash.id="camflash";document.body.appendChild(camflash);                          // the "snap"
}
function rainTick(){
 if(reduce)return;
 var lt=tk-rainTk0;
 if(camflash){var fl=lt===0?0.96:lt===1?0.6:lt===2?0.32:lt===3?0.15:lt===4?0.05:0;camflash.style.opacity=fl.toFixed(2);}   // shutter flash: bright burst, stepped fade (8fps)
 for(var i=0;i<rainList.length;i++){var p=rainList[i];
  var rtk=Math.floor(p.o/rainPerTick)+2;                                                  // photos develop AFTER the flash
  if(lt<rtk){p.el.style.opacity="0";continue;}
  var op=1,s=1,rot=p.rot,yoff=0,a=lt-rtk;
  if(a===0){s=1.18;rot=p.rot+(p.o%2?6:-6);}else if(a===1){s=1.06;rot=p.rot+(p.o%2?2:-2);}   // stamp pop -> settle (8fps)
  if(lt>=rainDropStart){var ea=lt-rainDropStart-p.dropAt;if(ea>0){yoff=9*ea+4.0*ea*ea;rot=p.rot+p.spin*0.5*ea;}}   // gravity drop: stays opaque, falls all the way off-screen before it is gone
  p.el.style.opacity=op.toFixed(2);
  p.el.style.transform="translate(-50%,-50%) translateY("+yoff.toFixed(1)+"px) rotate("+rot.toFixed(2)+"deg) scale("+s.toFixed(3)+")";
 }
 if(lt<rainHoldStart){
  if(lt<2){ if(rainHeadState!=="dazzle"){rainHeadState="dazzle";setFace("neutral");faceImg.src=FACES.neutral.closed;for(var i=0;i<eyeEls.length;i++)eyeEls[i].el.style.display="none";} }   // flash dazzles him -> squint
  else { if(rainHeadState!=="watch"){rainHeadState="watch";faceImg.src=FACES.neutral.img;for(var i=0;i<eyeEls.length;i++)eyeEls[i].el.style.display="";}
   var tgt=null;for(var i=0;i<rainList.length;i++){if(Math.floor(rainList[i].o/rainPerTick)+2===lt-1){tgt=rainList[i];break;}}   // eyes snap to each newest photo (~1-tick saccade)
   if(tgt){gaze.x=Math.max(-1,Math.min(1,(tgt.cx-rainHr.cx)/(rainHr.w*0.85)));gaze.y=Math.max(-1,Math.min(1,(tgt.cy-rainHr.cy)/(rainHr.h*0.95)));}
   updateIris();
  }
 } else if(lt<rainDropStart){
  if(rainHeadState!=="grin"){rainHeadState="grin";setFace("smile");}                       // payoff smile at the full wall
 } else {
  if(rainHeadState!=="exit"){rainHeadState="exit";setFace("neutral");}
  gaze.x*=0.7;gaze.y=Math.min(1,gaze.y*0.7+0.16);updateIris();
 }
 if(lt>=rainDropStart){var on=false;for(var i=0;i<rainList.length;i++){var ea=lt-rainDropStart-rainList[i].dropAt,yo=ea>0?(9*ea+4.0*ea*ea):0;if(rainList[i].cy+yo<innerHeight+440)on=true;}
  if(!on||lt>rainDropStart+64)endRain();}
}
function endRain(){
 document.body.classList.remove("heroEmpathy");
 if(rainWrap&&rainWrap.parentNode)rainWrap.remove();rainWrap=null;rainList=[];rainHeadState="";
 if(camflash&&camflash.parentNode)camflash.remove();camflash=null;
 rainMode=false;eventLock=false;cycHold=false;gaze.x=0;gaze.y=0;
 blinking=false;blinkQ=[];eyesClosed=false;settleFace();
 eyeEls.forEach(function(e){e.el.style.display="";e.el.style.visibility="";e.el.classList.remove("eclosed");});dragWordEl=null;
 wi=(wi+1)%WORDS.length;var nw=makeCycWord(wi);if(cycWord){cycWord.replaceWith(nw);cycWord=nw;}
 nextCycle(1200);flushQueued();
}
(function(){if(window.innerWidth>760)return;var items=[].slice.call(document.querySelectorAll(".csItem"));if(!items.length)return;function showAll(){items.forEach(function(it){it.classList.add("csIn");});}if(reduce||!("IntersectionObserver" in window)){showAll();return;}var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("csIn");io.unobserve(e.target);}});},{threshold:0.16,rootMargin:"0px 0px -7% 0px"});items.forEach(function(it){io.observe(it);});})();
// MASTER 8fps CLOCK
setInterval(()=>{tk++;if(!reduce)boil();if(crumbEls.length)updateCrumbs();
 var _dv=dragCookie||dragDisco||dragLove||dragCam||dragId;if(dragging&&_dv&&!reduce)wobbleDrag(_dv);
 if(introMode){introTick();return;}
 if(CALIB)return;
 scrollTarget=0;scrollPull+=(scrollTarget-scrollPull)*0.18;var _ffT=0;scrollFollow+=(_ffT-scrollFollow)*0.18;   // holds his spot in the hero; curiosity is hover-driven, not scroll-driven
 if(!headGliding){var _swD=document.querySelector(".stagewrap");if(_swD)_swD.style.transform="translateY("+Math.round(scrollFollow)+"px)";}
 if(partyMode){partyTick((performance.now()-partyStart)/1000);return;}
 if(loveMode){loveTick((performance.now()-loveStart)/1000);return;}
 if(rainMode){rainTick();return;}
 if(movieMode){movieTick();return;}
 if(dizzy){dizzyTick();return;}
 if(eating){eatTick((performance.now()-eatStart)/1000);return;}
 if(reactType){reactTick();return;}
 if(blinking&&blinkQ.length){applyStep(blinkQ.shift());}
 else if(!blinking){if(eyesClosed)eyesClosed=false;for(var _ei=0;_ei<eyeEls.length;_ei++){var _ee=eyeEls[_ei].el;if(_ee.style.display==="none")_ee.style.display="";if(_ee.style.visibility==="hidden")_ee.style.visibility="";if(_ee.classList.contains("eclosed"))_ee.classList.remove("eclosed");}}
 const now=performance.now();
 if(now>=nextSaccade){ // natural saccade-and-fixation wander (used on touch + desktop idle)
  {const a=Math.random()*6.2832,rd=0.45+Math.random()*0.45;gaze={x:Math.cos(a)*rd,y:Math.sin(a)*rd*0.62-0.04};}   // idle wander never looks dead-center
  nextSaccade=now+650+Math.random()*1150;}
  // how badly he wants to follow the page down
 tickFidget();updateIris();
  if(!reduce){const t=tk*0.125;const fy=Math.sin(t*0.85)*5,fx=Math.sin(t*0.55)*3;const dftX=Math.sin(t*0.19)*3.4+Math.sin(t*0.11+2.0)*1.9,dftY=Math.sin(t*0.15+1.0)*3.0+Math.sin(t*0.23+0.5)*1.5;  // slow wandering float (two periods = never an obvious metronome)
  const _act=HOVER&&(performance.now()-lastMove<IDLE_MS)&&window.__curNear!==false;let tgX,tgY;if(_act){tgX=((pointer.px/innerWidth)-0.5)*16;tgY=((pointer.py/innerHeight)-0.5)*10;}else{tgX=gaze.x*9;tgY=gaze.y*6-1;}paraX+=(tgX-paraX)*0.2;paraY+=(tgY-paraY)*0.2;
  const P=poseFor(curFace);curRot+=(P.rot-curRot)*0.16;curSc+=(P.sc-curSc)*0.16;curTX+=(P.tx-curTX)*0.16;curTY+=(P.ty-curTY)*0.16;
  const g=gestureOffset();
  var _cg=0;if(_act&&!eventLock&&!reactType&&!dizzy&&!dragging&&!eating&&!blinking){try{var _srC=stage.getBoundingClientRect();_cg=Math.max(-1,Math.min(1,(pointer.px-(_srC.left+_srC.width*0.5))/SENS));}catch(_){}}
  cfR+=((_cg*2.3)-cfR)*0.18;   /* the head turns a few degrees after the eyes — attention, not surveillance */
  const pull=scrollPull, strainR=Math.sin(tk*0.85)*pull*1.4, strainX=Math.sin(tk*1.15)*pull*1.3;  // tethered: strains toward the scroll, trembling
  const __sm=(activeHover==="smile"&&!reduce)?1:0,__by=__sm?Math.sin(tk*1.2)*3:0,__br=__sm?Math.sin(tk*1.2+0.6)*1.5:0;const TX=Math.round(fx+dftX+paraX+curTX+g.tx+strainX),TY=Math.round(fy+dftY+paraY+curTY+g.ty+__by),ROT=(paraX*0.1+cfR+curRot+g.rot+strainR+__br+fidgetROT),SC=(curSc*g.sc);
  const _br=Math.sin(t*1.75)*0.0045;const sty=(1+pull*0.06+_br).toFixed(4),stx=(1-pull*0.03-_br*0.35).toFixed(4);  // taffy stretch downward as it pulls
  const sqX=(1+(1-blinkSquash)*0.6).toFixed(3);stage.style.transform="translate("+TX+"px,"+TY+"px) rotate("+ROT.toFixed(1)+"deg) scale("+SC.toFixed(3)+") scale("+stx+","+sty+") scale("+sqX+","+blinkSquash+")";updateShadow(TX,TY,ROT);}},125);

// ---- INTERACTIONS (desktop hover) ----
const logo=document.getElementById("logo"),talk=document.getElementById("talk");
/* NULL-GUARDED (not HEADONLY-gated): these were bare `logo.addEventListener` calls, which is
   fine while this block only ever ran on index.html but throws a TypeError the moment the
   engine loads on a page with no wordmark -- and a throw HERE silently kills everything below
   it in the file, including setFace("neutral") and the whole intro. Guarding by presence is
   the honest fix and is a no-op on index.html, where #logo and #talk always exist. */
if(logo){
logo.addEventListener("mouseenter",()=>{if(eventLock||CALIB)return;clearHold();activeHover="wink";showFace("wink");});
logo.addEventListener("mouseleave",()=>{if(eventLock||CALIB)return;if(activeHover==="wink")activeHover=null;setHold("wink",WINK_LINGER);resolve();});
logo.addEventListener("click",()=>{
 if(CALIB||eventLock||dizzy||reactType)return;clearHold();activeHover=null;startReact("talk");});  // on home, click the name -> he introduces himself
}
var _wbtn=document.getElementById("workBtn");if(_wbtn)_wbtn.addEventListener("click",function(e){if(window.__softScroll){e.preventDefault();if(location.hash!==this.hash)history.pushState(null,"",this.hash);window.__softScroll(document.getElementById(this.hash.slice(1)));}});
/* The browser's behaviour:"smooth" is a fixed curve. This uses the site's direct ease-out,
   respects the shared sticky-header inset, and scales with distance without letting a long
   hop drag. The transient root class prevents CSS smooth-scroll from retargeting every frame. */
function softScroll(el){
  if(!el)return;
  if(window.__softScrollFrame)cancelAnimationFrame(window.__softScrollFrame);
  document.documentElement.classList.add("softScrolling");
  var startY=window.scrollY||0,
      scrollPad=parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)||0,
      endY=Math.max(0,Math.min(startY+el.getBoundingClientRect().top-scrollPad,
                    document.documentElement.scrollHeight-innerHeight)),
      dist=Math.abs(endY-startY);
  if(typeof reduce!=="undefined"&&reduce){window.scrollTo({top:endY,behavior:"auto"});requestAnimationFrame(function(){document.documentElement.classList.remove("softScrolling");});return;}
  if(dist<4){document.documentElement.classList.remove("softScrolling");return;}
  var dur=Math.min(750,Math.max(380,Math.round(300+Math.sqrt(dist)*14))), t0=null;
  (function step(now){
    if(t0===null)t0=now;
    var t=Math.min(1,(now-t0)/dur),
        e=1-Math.pow(1-t,3);   // direct ease-out: decisive start, quiet landing
    window.scrollTo(0,startY+(endY-startY)*e);
    if(t<1)window.__softScrollFrame=requestAnimationFrame(step);
    else{window.__softScrollFrame=0;document.documentElement.classList.remove("softScrolling");}
  })(performance.now());
}
window.__softScroll=softScroll;
var _navW=document.getElementById("navWork");if(_navW)_navW.addEventListener("click",function(e){e.preventDefault();
 var _go=function(){softScroll(document.getElementById("cases"));};
 _go();});
/* #navAbout is a real link to about.html now. Its click handler is deleted rather than
   left as a no-op: a bound listener on a link is the first place the next reader looks
   when navigation misbehaves. The id survives because it is a documented hook, and
   header.js reads the data-nav-item attribute rather than this. */
/* The mobile menu -- burger, drawer, scrim, close button and the three .ndLinks --
   was deleted with the header on 2026-08-03. It is not restyled anywhere: measured
   at a real 390px viewport the lockup and Home / About / Games fit inline in 279px
   of a 358px budget, every target at 44x44, so a parallel navigation had nothing
   left to do. header.js owns the bar now. */
   // Play now lives in the header nav directly in the markup -- the old runtime relocation into .heroCtas is retired
if(talk){   // same presence guard as #logo above -- play.html has no Contact link, and an unguarded throw here kills the rest of the file
talk.addEventListener("mouseenter",()=>{if(eventLock||CALIB)return;clearHold();activeHover="smile";showFace("smile");});
talk.addEventListener("mouseleave",()=>{if(eventLock||CALIB)return;if(activeHover==="smile")activeHover=null;setHold("smile",SMILE_LINGER);resolve();});
talk.addEventListener("click",function(e){e.preventDefault();
 /* #getInTouch was the About overlay's "Get in touch" section, in this same document.
    It lives on about.html now, so this scrolled to nothing, and the deliberate
    double-call that used to wait out the overlay's layout settling has nothing left to
    wait for. Home's own answer to Contact is the footer, which is exactly where the
    header's Contact control already points on all nine pages. The two routes agree now
    instead of diverging. */
 if(window.__softScroll)window.__softScroll(document.getElementById("contact"));});
}
(function(){
 var cards=[].slice.call(document.querySelectorAll(".csItem"));if(!cards.length)return;
 function enter(){if(eventLock||CALIB)return;clearHold();activeHover="smile";showFace("smile");}
 function leave(card){if(card.matches(":hover")||card.contains(document.activeElement))return;if(eventLock||CALIB)return;if(activeHover==="smile")activeHover=null;setHold("smile",SMILE_LINGER);resolve();}
 cards.forEach(function(card){card.addEventListener("pointerenter",enter);card.addEventListener("pointerleave",function(){leave(card);});card.addEventListener("focusin",enter);card.addEventListener("focusout",function(){requestAnimationFrame(function(){leave(card);});});});
})();
(function(){return;/* magnetic retired: Let's talk is now a calm secondary button matching Back */var mag=document.querySelector(".talkMag");if(!mag||reduce)return;var PULL=0.22,REACH=70,MAXO=16,last=0,cx=0,cy=0;function apply(x,y){mag.style.transform=(x||y)?("translate("+x+"px,"+y+"px)"):"";}function cl(v){return v<-MAXO?-MAXO:(v>MAXO?MAXO:v);}window.addEventListener("mousemove",function(e){var now=performance.now();if(now-last<125)return;last=now;var b=mag.getBoundingClientRect();var bx=b.left+b.width/2-cx,by=b.top+b.height/2-cy;var dx=e.clientX-bx,dy=e.clientY-by;var reach=Math.max(b.width,b.height)/2+REACH;if(Math.hypot(dx,dy)<reach){cx=cl(Math.round(dx*PULL));cy=cl(Math.round(dy*PULL));apply(cx,cy);}else if(cx||cy){cx=0;cy=0;apply(0,0);}});window.addEventListener("mouseout",function(e){if(!e.relatedTarget&&(cx||cy)){cx=0;cy=0;apply(0,0);}});})();
(function(){var HEAD={x0:0.22,x1:0.80,y0:0.12,y1:0.91};function overFace(e){var r=faceImg.getBoundingClientRect();if(!r.width||!r.height)return false;var fx=(e.clientX-r.left)/r.width,fy=(e.clientY-r.top)/r.height;return fx>=HEAD.x0&&fx<=HEAD.x1&&fy>=HEAD.y0&&fy<=HEAD.y1;}var onFace=false;window.__pointerOverFace=false;document.addEventListener("mousemove",function(e){var ov=overFace(e);window.__pointerOverFace=ov;if(CALIB)return;if(ov)enter();else leave();},{passive:true});document.addEventListener("mouseleave",function(){window.__pointerOverFace=false;leave();});window.addEventListener("blur",function(){window.__pointerOverFace=false;leave();});function enter(){if(eventLock||CALIB)return;if(!onFace){onFace=true;clearHold();activeHover="rest";showFace("rest");}}function leave(){var was=onFace;onFace=false;if(activeHover==="rest")activeHover=null;if(!eventLock&&!CALIB){var target=activeHover||holdFace||baseFace;if(blinking){for(var i=0;i<blinkQ.length;i++){if(blinkQ[i]&&blinkQ[i].open)blinkQ[i].face=target;}}if(was)showFace(target);}if(window.__restWatch)clearInterval(window.__restWatch);var t0=Date.now();window.__restWatch=setInterval(function(){if(window.__pointerOverFace||CALIB||onFace||Date.now()-t0>1500){clearInterval(window.__restWatch);window.__restWatch=null;return;}if(eventLock)return;if(curFace==="rest"){if(blinking){for(var j=0;j<blinkQ.length;j++){if(blinkQ[j]&&blinkQ[j].open)blinkQ[j].face=baseFace;}}setFace(baseFace);}},60);}faceImg.addEventListener("mousemove",function(e){if(CALIB)return;if(overFace(e))enter();else leave();});faceImg.addEventListener("mouseleave",function(){leave();});})();
faceImg.addEventListener("click",()=>{if(CALIB||eventLock)return;tapReact();});

function renderCal(){}
addEventListener("keydown",e=>{if(!CALIB)return;
 const ey=(FACES[calFace].eyes||[])[selEye];if(!ey)return;const d=0.0007;
 if(e.key==="ArrowLeft")ey.x=+(ey.x-d).toFixed(4);else if(e.key==="ArrowRight")ey.x=+(ey.x+d).toFixed(4);
 else if(e.key==="ArrowUp")ey.y=+(ey.y-d).toFixed(4);else if(e.key==="ArrowDown")ey.y=+(ey.y+d).toFixed(4);else return;
 e.preventDefault();buildEyes(calFace);renderCal();});
stage.addEventListener("click",e=>{if(!CALIB||dragging||FACES[calFace].noIris)return;const r=stage.getBoundingClientRect();const c=(FACES[calFace].eyes||[])[selEye];if(!c)return;
 c.x=+((e.clientX-r.left)/r.width).toFixed(4);c.y=+((e.clientY-r.top)/r.height).toFixed(4);buildEyes(calFace);renderCal();});

/* ===== Wake-up intro (first paint -> portrait develops, yawns awake, walks to its mark) ===== */
var introMode=false,introStart=0,swrap=document.querySelector(".stagewrap"),introDX=0,introDY=0,introRevealed=false,introWake=null,navEl=document.querySelector("nav"),introLive=false,introFrame="";
function _ic(v,a,b){return v<a?a:(v>b?b:v);}            // clamp
function _ie(x){return x*x*(3-2*x);}                    // smoothstep ease
function buildIntroWake(){                                  // open-face layer fades in beneath the irises -> eyes wake with no attachment
  removeIntroWake();
  introWake=document.createElement("img");introWake.className="introwake";introWake.src=PFX+FACES.neutral.img;introWake.alt="";
  stage.appendChild(introWake);
  for(var i=0;i<eyeEls.length;i++)eyeEls[i].el.style.display="none";   // irises stay hidden while asleep
}
function setWake(o){                                        // o:0 shut -> 1 open (may exceed 1 briefly = overshoot before settling). Upper-lid-led; right eye lags (real opens are asymmetric).
  if(introWake)introWake.style.opacity=_ic(o,0,1).toFixed(2);
  for(var i=0;i<eyeEls.length;i++){var e=eyeEls[i].el,lag=(i===1?0.12:0);
    var oo=Math.max(0,o-lag),sc=0.16+0.86*oo;if(sc>1.16)sc=1.16;
    var hx=(1-Math.max(0,Math.min(1,oo)))*(i===1?0.9:-0.9);   // lid drifts horizontally as it opens (~40% of vertical), resolves to 0
    e.style.display="";e.style.transformOrigin="50% 68%";e.style.transform="translateX("+hx.toFixed(2)+"px) scaleY("+sc.toFixed(3)+")";}
}
function removeIntroWake(){if(introWake&&introWake.parentNode)introWake.remove();introWake=null;for(var i=0;i<eyeEls.length;i++){eyeEls[i].el.style.transform="";eyeEls[i].el.style.transformOrigin="";}}
function lidCurve(u){                                       // slow open w/ heavy-lidded dwell + flutter (upper lid does the work)
  var K=[[0,1],[0.22,0.52],[0.36,0.66],[0.64,0.16],[0.76,0.34],[1,0]];
  for(var i=1;i<K.length;i++){if(u<=K[i][0]){var a=K[i-1],b=K[i],k=_ie(_ic((u-a[0])/((b[0]-a[0])||1),0,1));return a[1]+(b[1]-a[1])*k;}}
  return 0;
}
function wakeOpen(u){                                        // 0 shut -> 1 open: slow levator engage, ONE heavy-lidded waver, gentle over-open, long decelerating settle (up-phase is ~2-3x slower than closing)
  var K=[[0,0],[0.18,0.14],[0.34,0.31],[0.47,0.25],[0.68,0.73],[0.87,1.03],[1,1.0]];
  for(var i=1;i<K.length;i++){if(u<=K[i][0]){var a=K[i-1],b=K[i],k=_ie(_ic((u-a[0])/((b[0]-a[0])||1),0,1));return a[1]+(b[1]-a[1])*k;}}
  return 1;
}
function introCloseEyes(){faceImg.src=PFX+FACES.neutral.closed;for(var i=0;i<eyeEls.length;i++)eyeEls[i].el.style.display="none";}
function introOpenEyes(){faceImg.src=PFX+FACES.neutral.img;for(var i=0;i<eyeEls.length;i++){var e=eyeEls[i].el;e.style.display="";e.style.visibility="";e.classList.remove("eclosed");}}
function introGaze(gx,gy){gaze.x=gx;gaze.y=gy;if(eyeEls.length&&typeof updateIris==="function")updateIris();}
function startIntro(){
  var _seen=false;try{_seen=sessionStorage.getItem("introSeen")==="1";}catch(e){}
  setFace("neutral");stage.style.opacity="";
  if(_seen||reduce||!swrap){requestAnimationFrame(function(){requestAnimationFrame(revealAll);});if(!reduce)setTimeout(function(){if(!eventLock&&!reactType&&!dragging&&(curFace==="neutral"||curFace==="rest")){browFlash(function(){setHold("smile",950);showFace("smile");});}},1500);return;}
  try{sessionStorage.setItem("introSeen","1");}catch(e){}
  var w=document.querySelector(".wrap");
  if(!w){requestAnimationFrame(function(){requestAnimationFrame(revealAll);});return;}
  // polaroid develop: the whole page resolves from soft + slightly overexposed into sharp focus, once
  eventLock=true;document.documentElement.style.overflow="hidden";
  w.classList.add("developing");
  requestAnimationFrame(function(){requestAnimationFrame(function(){
    w.classList.add("developed");
    revealAll();
  });});
  setTimeout(function(){
    w.classList.remove("developing","developed");
    document.documentElement.style.overflow="";eventLock=false;
    if(!reduce)setTimeout(idleBlink,400);
    if(!reduce)setTimeout(function(){if(!eventLock&&!reactType&&!dragging&&(curFace==="neutral"||curFace==="rest")){browFlash(function(){setHold("smile",950);showFace("smile");});}},700);
  },1150);
}
var introLoader=null;
function buildIntroCounter(){
  removeIntroLoader();
  var ct=document.createElement("div");ct.className="loadPct";ct.id="loadPct";
  ct.innerHTML='<span id="loadNum">0</span><span class="u">%</span>';
  var sr=stage.getBoundingClientRect();                                   // his box, already centered + lifted
  var top=Math.min(innerHeight*0.86, Math.round(sr.bottom+innerHeight*0.03));   // anchored BELOW his chin in clear negative space — never over the face (research: supporting element must not compete with the hero)
  ct.style.left="50%";ct.style.right="auto";ct.style.bottom="auto";ct.style.top=top+"px";
  ct.style.transform="translate(-50%,0)";
  document.body.appendChild(ct);
  window._loadCt=ct;window._loadPr=null;
}
function removeIntroLoader(){["loadPrint","loadPct","introLoad"].forEach(function(id){var w=document.getElementById(id);if(w&&w.parentNode)w.remove();});introLoader=null;window._loadPr=null;window._loadCt=null;}
function introSetProgress(p){var n=document.getElementById("loadNum");if(n)n.textContent=Math.round(_ic(p,0,1)*100);}
function applyThrow(pr,kp){                                                // throw off to the lower-RIGHT with a gentle rotate + scale-down — matches the About deck's photoThrow (same motion language, not cartoony)
  if(!pr)return;
  var NF=7, f=Math.round(_ic(kp,0,1)*NF)/NF;                              // 7 stepped poses across the throw -> reads at 8fps
  var e=Math.pow(f,1.16);                                                 // slight ease-in; lands visible intermediate poses
  var tx=e*(innerWidth*0.66);                                            // fly off to the RIGHT (away from the headline, off the near edge)
  var ty=e*(innerHeight*0.22);                                           // drift down a touch (echoes photoThrow's 22%)
  var rot=e*15;                                                          // gentle tumble like the deck throw — restrained, not cartoony
  var sc=1-e*0.26;                                                       // recede / scale down as it leaves
  pr.style.transform="translate("+Math.round(tx)+"px,"+Math.round(ty)+"px) rotate("+rot.toFixed(1)+"deg) scale("+sc.toFixed(3)+")";
}
function skipIntro(){if(introMode)finishIntro();}
function finishIntro(){
  introMode=false;document.documentElement.style.overflow="";
  eventLock=false;document.body.style.background="";
  if(navEl){navEl.style.opacity="1";navEl.style.pointerEvents="";}
  stage.style.opacity="";stage.style.filter="";stage.style.transform="none";
  swrap.style.transform="";swrap.style.zIndex="";
  mouthimg.style.opacity="0";setMouth(0);
  blinking=false;blinkQ=[];eyesClosed=false;blinkSquash=1;
  removeIntroWake();removeIntroLoader();setFace("neutral");introOpenEyes();introGaze(0.04,0.02);   // settle soft & off-center, not a dead stare
  if(!introRevealed){introRevealed=true;revealAll();}
  if(!reduce){setTimeout(idleBlink,700);setTimeout(idleFidget,5200);}   // blinks awake soon after he is uncovered
}
function introGreet(){            // reuse the name-click "talk" mechanism (speech word + mouth + smile + settle) WITHOUT the identity/cycler takeover
 if(reduce||busyNow()||CALIB||introMode)return;
 eventLock=true;reactType="talk";reactStart=performance.now();
 gType=null;curRot=0;curSc=1;curTX=0;curTY=0;blinking=false;blinkQ=[];eyesClosed=false;blinkSquash=1;
 setFace("neutral");if(navigator.vibrate)navigator.vibrate(12);
 mouthimg.src=PFX+FACES.rest.img;mouthimg.style.opacity="1";setMouth(0);
 hRot=0;hTx=0;hTy=0;hRotT=0;hTxT=0;hTyT=0;emph=0;browFrames=0;curBrow="down";talkNameDone=false;talkSmile=false;
 talkSayMode=true;talkWords=[];talkIdx=-1;talkCurWord=null;speech.innerHTML="";
 var w=focusWord("Welcome!","fw");w.style.left="50%";w.style.top="6%";speech.appendChild(w);talkCurWord=w;
 talkGaze={x:0,y:-0.42};
 var d=Math.min(2600,760+("Welcome!".length)*60);
 talkSpeakUntil=performance.now()+d;talkSayEnd=performance.now()+d+150;
 talkBlink=0;talkBlinkAt=performance.now()+520;talkClosed=false;
}
function showEyes(on){for(var i=0;i<eyeEls.length;i++)eyeEls[i].el.style.display=on?"":"none";}
function introSetFrame(f){if(introFrame===f)return;introFrame=f;faceImg.src=PFX+(f==="browsup"?FACES.neutral.browsup:(f==="closed"?FACES.neutral.closed:FACES.neutral.img));}
function introTick(){
  var t=(performance.now()-introStart)/1000;
  var DEV=1.15,CMP=1.55,REV=2.30;                            // develop (blur->sharp) -> compose (counter tops, one calm blink) -> settle to his mark + headline lands
  var ct=window._loadCt;
  var breathe=Math.sin(t*1.7)*1.4;                           // a moving hold — never fully frozen
  var bl=_ie(_ic(t/(DEV*0.95),0,1)),cc=Math.round(243+3*bl),ce=Math.round(231+9*bl);   // light blooms up as he resolves (smooth light is allowed)
  document.body.style.background="radial-gradient(125% 95% at 50% 46%,rgb("+cc+","+cc+","+cc+") 0%,rgb("+ce+","+ce+","+ce+") 74%)";
  var ty=0,sx=1,sy=1;
  if(t<DEV){                                                 // DEVELOP: portrait resolves from blur+dark -> sharp, in stepped frames (a print coming up)
    var dp=_ic(t/DEV,0,1),NF=8,df=Math.min(1,Math.round(dp*NF)/NF);
    stage.style.opacity=df.toFixed(3);
    stage.style.filter="blur("+((1-df)*8).toFixed(2)+"px) contrast("+(1.16-0.16*df).toFixed(3)+")";
    introSetProgress(df*0.9);
    introGaze(0.05*(1-df)+0.02,0.11*(1-df)+0.02);            // heavy gaze lifts to you as he comes into focus
    sy=1+0.012*Math.sin(t*1.7);sx=2-sy;ty=breathe*1.2;
  } else if(t<CMP){                                          // COMPOSE: sharp, counter tops to 100, ONE calm blink, gaze finds you
    stage.style.opacity="1";stage.style.filter="";
    var cp=_ic((t-DEV)/(CMP-DEV),0,1);
    introSetProgress(0.9+0.1*cp);
    if(cp>0.34&&cp<0.52){introSetFrame("closed");showEyes(false);}        // a single composed blink = a sign of life, not grogginess
    else{introSetFrame("neutral");showEyes(true);introGaze(0.02,0.02);}
    ty=breathe;
  } else {                                                   // REVEAL: counter lifts away, he steps to his mark, headline lands, nav returns
    stage.style.opacity="1";stage.style.filter="";introSetFrame("neutral");showEyes(true);
    introSetProgress(1);
    if(ct&&!ct._out){ct._out=1;ct.style.transition="opacity .22s steps(2,end)";ct.style.opacity="0";}
    var k=_ie(_ic((t-CMP)/(REV-CMP),0,1)),NF=6,kf=Math.round(k*NF)/NF;     // stepped settle (movement = stop-motion)
    var x=Math.round(introDX*(1-kf)),y=Math.round(introDY*(1-kf)),sc=(1.05-0.05*kf);
    swrap.style.transform="translate("+x+"px,"+y+"px) scale("+sc.toFixed(3)+")";
    introGaze(0.04+0.02*Math.sin(t*2.2),0.02);
    ty=breathe*0.6;
    if(!introRevealed&&kf>0.5){introRevealed=true;revealAll();}
    if(t>=REV){finishIntro();return;}
  }
  stage.style.transform="translate(0px,"+ty.toFixed(1)+"px) scaleX("+sx.toFixed(3)+") scaleY("+sy.toFixed(3)+")";
}
/* BOOT. setFace("neutral") is the one line that MUST run on both hosts: it is what puts a face
   src on #face and calls buildEyes(), i.e. what makes #stage a real head worth cloning. The
   headline and the wake-up cinematic are index.html's opening, not the head's -- play.html has
   no #h1 to type into and no reason to play a page intro for a head nobody sees, so on that
   host the stage just starts awake and visible (opacity is only dropped because finishIntro()
   is the thing that raises it again). */
if(h1)buildHeadline();
setFace("neutral");
if(!HEADONLY){stage.style.opacity="0";requestAnimationFrame(function(){requestAnimationFrame(startIntro);});}

/* ===== Intro reel logic ===== */
(function(){
 var reel=document.getElementById("reel"),frame=document.getElementById("reelFrame"),vid=document.getElementById("reelVid"),ph=document.getElementById("reelPh"),pc=document.getElementById("playCursor"),ov=document.getElementById("reelOverlay"),ovv=document.getElementById("reelOverlayVid"),closeBtn=document.getElementById("reelClose");
 var ovf=document.getElementById("reelOverlayYt"),YT_ID="WDnRtdwFREA";
 installHeroMoodMenu();
 if(!reel)return;
 if(pc&&pc.parentNode!==document.body)document.body.appendChild(pc);
 var fine=window.matchMedia("(hover:hover) and (pointer:fine)").matches;
 frame.classList.toggle("fine",fine);reel.classList.toggle("coarse",!fine);
 var STEPS=8,MINS=1.0,reelFull=false,hovering=false,mx=0,my=0;
 addEventListener("pointermove",function(e){mx=e.clientX;my=e.clientY;if(fine&&hovering)evalCursor();},{passive:true});
   function place(){pc.style.setProperty("--px",mx+"px");pc.style.setProperty("--py",my+"px");}
   function evalCursor(){if(!fine)return;if(hovering){place();pc.classList.add("on");}else pc.classList.remove("on");}                                  // expansion snapped to a 14-step grid -> 8fps stop-motion feel
 function onScroll(){
   return; /* pinned grow retired: the head-maker card lives below the reel now */
   var vh=window.innerHeight,rect=reel.getBoundingClientRect();
   // progress tied to the pinned phase: 0 when the stage first pins, 1 near the end of the track
   var range=rect.height-vh;
   var p=range>0?(-rect.top)/range:0;if(p<0)p=0;if(p>1)p=1;
   // grow -> HOLD full -> release: video reaches full screen early and dwells there.
   var GROW=0.34;                 // grows to full over first 34% of the pinned scroll
   var g=p<GROW?(p/GROW):1;       // 0..1 during grow, then pinned at 1 (full) for the long hold
   var e=g<0.5?2*g*g:1-Math.pow(-2*g+2,2)/2;
   // once grown, snap to a TRUE fullscreen cover (fills whole viewport, no gaps) and hold there
   var fh=frame.offsetHeight||675;var scaledH=fh*(MINS+(full-MINS)*e);
   var wantFull=(g>=0.999)||(scaledH>=window.innerHeight*0.86);
   if(wantFull!==frame.classList.contains("isFull"))frame.classList.toggle("isFull",wantFull);
   if(wantFull){reel.style.setProperty("--reelMetaOp","0");return;}
   var fw=frame.offsetWidth||1200;var full=window.innerWidth/fw;
   frame.style.setProperty("--rs",(MINS+(full-MINS)*e).toFixed(4));
   frame.style.setProperty("--rr","0deg");
   frame.style.setProperty("--rad","4px");
   var metaOp=p<=0.02?1:(p>=0.22?0:1-(p-0.02)/0.20);
   reel.style.setProperty("--reelMetaOp",metaOp.toFixed(2));
   frame.classList.toggle("big",p>0.45);
   reelFull=(p>=1);evalCursor();
 }
 var raf=0;
 addEventListener("scroll",function(){if(!raf)raf=requestAnimationFrame(function(){raf=0;onScroll();});},{passive:true});
 window.__reelOnScroll=onScroll;addEventListener("resize",onScroll);onScroll();
 /* the reel only downloads once the visitor nears it; it rests when far away */
 if("IntersectionObserver" in window){var reelSeen=false;new IntersectionObserver(function(en){en.forEach(function(x){if(x.isIntersecting){reelSeen=true;if(!reduce){var rp=vid.play();if(rp&&rp.catch)rp.catch(function(){});}}else if(reelSeen){try{vid.pause();}catch(_){}}});},{rootMargin:"600px 0px"}).observe(reel);}else if(!reduce){var rp0=vid.play();if(rp0&&rp0.catch)rp0.catch(function(){});}
 vid.addEventListener("loadeddata",function(){if(ph)ph.style.display="none";if(!reduce){var pr=vid.play();if(pr&&pr.catch)pr.catch(function(){});}});
 if(fine){
   frame.addEventListener("pointerenter",function(e){mx=e.clientX;my=e.clientY;hovering=true;evalCursor();startMovie();});
   frame.addEventListener("pointerleave",function(){hovering=false;evalCursor();requestAnimationFrame(stopMovieIfDisengaged);});function reelClear(){if(hovering){hovering=false;evalCursor();caughtMovie();}}document.addEventListener("mouseleave",reelClear);window.addEventListener("blur",reelClear);window.addEventListener("mouseout",function(e){if(!e.relatedTarget&&!e.toElement){reelClear();}});
   frame.addEventListener("click",openReel);
 }
 function stopMovieIfDisengaged(){if(!hovering&&!frame.contains(document.activeElement))caughtMovie();}
 frame.addEventListener("focusin",function(){startMovie();});
 frame.addEventListener("focusout",function(){requestAnimationFrame(stopMovieIfDisengaged);});
 frame.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();openReel();}});
 function openReel(){
   ov.classList.add("on");ov.setAttribute("aria-hidden","false");pc.classList.remove("on");
   try{vid.pause();}catch(_){}
   if(ovv){try{ovv.currentTime=0;}catch(_){}ovv.muted=false;ovv.volume=1;var _pp=ovv.play();if(_pp&&_pp.catch)_pp.catch(function(){});}
   document.documentElement.style.overflow="hidden";
 }
 function closeReel(){
   ov.classList.remove("on");ov.setAttribute("aria-hidden","true");
   if(ovv){try{ovv.pause();ovv.currentTime=0;}catch(_){}}
   if(!reduce&&window.innerWidth>760){var pr=vid.play();if(pr&&pr.catch)pr.catch(function(){});}
   document.documentElement.style.overflow="";
 }
 closeBtn.addEventListener("click",closeReel);
 ov.addEventListener("click",function(e){if(e.target===ov)closeReel();});
 addEventListener("keydown",function(e){if(e.key==="Escape"&&ov.classList.contains("on"))closeReel();});

 // ===== mood shortcut menu -> fire the head animations directly =====
 function installHeroMoodMenu(){
  /* Home and Play deliberately expose the same portrait control IDs, so this is their one
     shared menu controller and mood dispatcher. Play's hidden game launcher has game-specific
     IDs and cannot add a second toggle to this button. */
  var bar=document.getElementById("moodbar"); if(!bar) return;
  var btn=document.getElementById("moodBtn"), menu=document.getElementById("moodMenu");
  var MAP={empathy:startRain,hunger:moodEat,delight:startParty,love:startLove};
  var IDX={hunger:0,delight:1,love:2,empathy:3};
  function moodHoldWord(idx){
   if(idx==null||!cycWord||typeof makePlainCycWord!=="function")return;   // no headline cycler to hold anymore -- moods still play from the menu
   cycHold=true;clearTimeout(cycTimer);                        // pin the cycler while the mood plays
   var old=cycWord;if(old)old.classList.add("out");            // fade current word out, same swap the name-click uses
   setTimeout(function(){var ref=(old&&old.parentNode)?old:((cycWord&&cycWord.parentNode)?cycWord:null);
    if(ref){var nw=makeCycWord(idx,false,true);nw.classList.add("mdshow");ref.replaceWith(nw);cycWord=nw;}},560);  // real word + its dot token, inert; end-fn resumes cycling
  }
  /* THE TWO GEOMETRY CLAMPS THAT USED TO LIVE HERE ARE GONE (mobile audit, B1).
     clampMenuX() flipped the panel to right:0 when it "would leave the column",
     and clampMenu() capped its height against the viewport. Both were written for
     the pre-v2 mood dock, where #moodBtn was the trigger and #moodMenu WAS the
     panel. In the v2 header #moodBtn does not exist and #moodMenu is the static
     .jbDiscGrp holding the four mood buttons -- the panel is #moodbar. So they
     were not merely dead: reached through the mouseenter path below (openM is
     hoisted, so `typeof openM==="function"` is true there), clampMenu was writing
     `top/bottom/max-height !important` onto a position:static inner div, which is
     junk that the next person would read as a working safety net.
     Both jobs now belong to CSS, where the panel's geometry already lived:
     header.css:414 anchors it to the right edge below 640px, and .jbDiscMenu's
     own max-height:var(--menu-max-h) + overflow-y:auto caps its height. One owner
     for the panel's box, and it is the stylesheet. */
  function closeM(restoreFocus){bar.classList.remove("open");if(btn){btn.setAttribute("aria-expanded","false");if(restoreFocus)btn.focus();}try{var c=bar.parentElement;if(c)c.style.zIndex="";}catch(_){}}
  // OPEN ON HOVER (pointer devices only). A menu that only opens on click makes you commit
  // before you can see what is in it; hovering to reveal is the whole feel Jayden is after.
  // Touch keeps click -- a hover that fires on tap would open and close in the same gesture.
  // The close is delayed so crossing the gap between the word and the list does not dismiss it.
  (function(){ if(!bar||!window.matchMedia||!matchMedia("(hover:hover) and (pointer:fine)").matches)return;
   var hideT=0;
   function over(){ clearTimeout(hideT); if(!bar.classList.contains("open")&&typeof openM==="function")openM(); }
   function out(){ clearTimeout(hideT); hideT=setTimeout(function(){
     if(!bar.matches(":hover"))closeM(false); },260); }
   bar.addEventListener("mouseenter",over);
   bar.addEventListener("mouseleave",out);
  })();
  function openM(){bar.classList.add("open");requestAnimationFrame(function(){try{window.__syncMoodSeps&&window.__syncMoodSeps();}catch(_){}});if(btn)btn.setAttribute("aria-expanded","true");try{var c=bar.parentElement;if(c)c.style.zIndex="70";}catch(_){}}
  if(btn)btn.addEventListener("click",function(e){e.stopPropagation();
   // Play is closed off while a tournament is live -- starting a second game from in here
   // would abandon the draw halfway through. The reason is on the button, not in an alert.
   if(document.body.classList.contains("hmTour")){closeM(false);return;}
   bar.classList.contains("open")?closeM(false):openM();});
  if(menu)menu.addEventListener("click",function(e){var it=e.target.closest(".moodItem");if(!it)return;var mood=it.getAttribute("data-mood");closeM(false);if(document.body.classList.contains("hmBattle")||document.body.classList.contains("hmSoccer")||document.body.classList.contains("hmRace"))return;if(mood==="identity"){location.href="about.html";return;}/* About is a page now, not an overlay. NOT a // comment: this is one minified line and a line comment would swallow the rest of it. */var fn=MAP[mood];if(typeof fn!=="function")return;var now=!busyNow();runOrQueue(fn);if(now)moodHoldWord(IDX[mood]);});
  document.addEventListener("click",function(e){if(bar.classList.contains("open")&&!bar.contains(e.target))closeM(false);});
  document.addEventListener("keydown",function(e){if(e.key==="Escape"&&bar.classList.contains("open")){e.stopPropagation();closeM(true);}});

 }
})();
