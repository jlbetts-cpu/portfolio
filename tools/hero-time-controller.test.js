const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const controllerSource=fs.readFileSync(require.resolve("../hero-time.js"),"utf8");

function eventTarget(target){
 const listeners={};
 target.addEventListener=(type,listener)=>{(listeners[type]||(listeners[type]=new Set())).add(listener);};
 target.removeEventListener=(type,listener)=>{if(listeners[type])listeners[type].delete(listener);};
 target.dispatchEvent=event=>{
  if(!event.target)event.target=target;
  (listeners[event.type]||new Set()).forEach(listener=>listener.call(target,event));
  return true;
 };
 target.listenerCount=type=>(listeners[type]||new Set()).size;
 return target;
}

function makeHarness(options={}){
 let document;
 const animations=[];
 const mutationObservers=[];

 class FakeAnimation{
  constructor(element,frames,timing){
   this.element=element;
   this.frames=frames;
   this.timing=timing;
   this.progress=0;
   this.cancelled=false;
   this.onfinish=null;
   element.animation=this;
   animations.push(this);
  }
  value(name){
   const from=this.frames[0][name],to=this.frames.at(-1)[name];
   if(typeof from==="number"&&typeof to==="number")return from+(to-from)*this.progress;
   return this.progress<1?from:to;
  }
  setProgress(progress){this.progress=progress;}
  cancel(){this.cancelled=true;if(this.element.animation===this)this.element.animation=null;}
  finish(){this.progress=1;if(this.onfinish)this.onfinish();}
 }

 class FakeElement{
  constructor(attributes={}){
   eventTarget(this);
   this.attributes=new Map(Object.entries(attributes));
   this.children=[];
   this.parentElement=null;
   this.textContent="";
   this.currentSrc="";
   this.animation=null;
   this.role="";
   this.style={
    values:{},
    setProperty:(name,value)=>{this.style.values[name]=String(value);},
    removeProperty:name=>{delete this.style.values[name];}
   };
   this.classList={
    values:new Set(),
    add:(...names)=>names.forEach(name=>this.classList.values.add(name)),
    remove:(...names)=>names.forEach(name=>this.classList.values.delete(name)),
    contains:name=>this.classList.values.has(name)
   };
  }
  appendChild(child){child.parentElement=this;this.children.push(child);return child;}
  setAttribute(name,value){
   const oldValue=this.getAttribute(name);
   this.attributes.set(name,String(value));
   mutationObservers.forEach(observer=>observer.notify(this,name,oldValue));
  }
  getAttribute(name){return this.attributes.has(name)?this.attributes.get(name):null;}
  hasAttribute(name){return this.attributes.has(name);}
  removeAttribute(name){
   const oldValue=this.getAttribute(name);
   this.attributes.delete(name);
   mutationObservers.forEach(observer=>observer.notify(this,name,oldValue));
  }
  querySelectorAll(selector){
   if(selector==='[role="menuitemradio"]')return this.children.filter(child=>child.getAttribute("role")==="menuitemradio");
   if(selector===".heroTimeGradient")return this.children.filter(child=>child.classList.contains("heroTimeGradient"));
   return [];
  }
  contains(target){return target===this||this.children.includes(target);}
  closest(selector){return selector==='[role="menuitemradio"]'&&this.getAttribute("role")==="menuitemradio"?this:null;}
  getBoundingClientRect(){return {top:100,bottom:300,left:100,right:300};}
  focus(){document.activeElement=this;}
  animate(frames,timing){return new FakeAnimation(this,frames,timing);}
 }

 class MutationObserver{
  constructor(callback){this.callback=callback;this.targets=[];mutationObservers.push(this);}
  observe(target,settings){this.targets.push({target,settings});}
  disconnect(){this.targets=[];}
  notify(target,attributeName,oldValue){
   if(this.targets.some(item=>item.target===target&&item.settings.attributes&&(!item.settings.attributeFilter||item.settings.attributeFilter.includes(attributeName)))){
    this.callback([{type:"attributes",target,attributeName,oldValue}],this);
   }
  }
 }

 const initial=options.snapshot||{mode:"auto",state:"daytime",theme:"light"};
 const root=new FakeElement({
  "data-theme-mode":initial.mode,
  "data-theme-state":initial.state,
  "data-theme":initial.theme,
  "data-reduced-motion":options.reducedMotion?"reduce":"no-preference"
 });
 const hero=new FakeElement({"data-time-mode":initial.mode,"data-time-state":initial.state});
 hero.classList.add("hero");
 const control=new FakeElement();
 const button=new FakeElement();
 const menu=new FakeElement();
 const icon=new FakeElement();
 const autoState=new FakeElement();
 const spill=new FakeElement();
 const face=new FakeElement({src:options.faceSrc||"images/neutral.webp"});
 const portrait=new FakeElement();
 const states=["pre-dawn","sunrise","daytime","dusk","sunset","night"];
 const portraitTargets={
  "off":{opacity:0,filter:"brightness(1)"},
  "pre-dawn":{opacity:.09,filter:"brightness(1.025) contrast(1.01) saturate(.78)"},
  "sunrise":{opacity:.12,filter:"brightness(1.045) contrast(.99) sepia(.08) saturate(.92)"},
  "daytime":{opacity:.07,filter:"brightness(1.02) contrast(.99) saturate(.88)"},
  "dusk":{opacity:.085,filter:"brightness(1.025) contrast(1.005) saturate(.8)"},
  "sunset":{opacity:.135,filter:"brightness(1.05) contrast(.995) sepia(.1) saturate(.94)"},
  "night":{opacity:.09,filter:"brightness(1.02) contrast(1.015) saturate(.68)"}
 };
 const gradients=states.map(state=>{
  const layer=new FakeElement({"data-time-gradient":state});
  layer.classList.add("heroTimeGradient");
  hero.appendChild(layer);
  return layer;
 });
 menu.children=["auto","off",...states].map(mode=>new FakeElement({
  role:"menuitemradio","aria-checked":mode===initial.mode?"true":"false","data-time-mode":mode
 }));
 const byId={heroTime:control,heroTimeBtn:button,heroTimeMenu:menu,heroTimeIcon:icon,
  heroTimeAutoState:autoState,heroTimeSpill:spill,face,heroTimePortraitCast:portrait};
 document=eventTarget({
  documentElement:root,
  activeElement:null,
  hidden:false,
  querySelector:selector=>selector===".hero"?hero:null,
  getElementById:id=>byId[id]||null
 });

 function cssValue(element,name){
  if(element.animation&&!element.animation.cancelled&&element.animation.frames[0][name]!==undefined){
   return element.animation.value(name);
  }
  if(Object.hasOwn(element.style.values,name))return element.style.values[name];
  const heroState=hero.getAttribute("data-time-state");
  if(gradients.includes(element))return name==="opacity"?(element.getAttribute("data-time-gradient")===heroState?1:0):"none";
  if(element===spill)return name==="opacity"?(root.getAttribute("data-theme-state")==="night"?1:0):"none";
  if(element===portrait){
   const target=portraitTargets[heroState]||portraitTargets.off;
   return target[name];
  }
  return name==="opacity"?0:"none";
 }

 let current=initial;
 let subscriber=null;
 let unsubscribed=0;
 const modeCalls=[];
 const siteTheme={
  getSnapshot(){return current;},
  subscribe(listener){subscriber=listener;return ()=>{unsubscribed+=1;subscriber=null;};},
  setMode(mode){modeCalls.push(mode);}
 };
 const window=eventTarget({SiteTheme:siteTheme,innerHeight:800,innerWidth:1200});
 window.window=window;
 window.getComputedStyle=element=>({
  opacity:String(cssValue(element,"opacity")),
  filter:String(cssValue(element,"filter")),
  getPropertyValue:name=>name==="--hero-time-duration"?(options.duration||"640ms"):
   name==="--hero-time-ease"?"cubic-bezier(.22,1,.36,1)":""
 });
 let storageReads=0,clockReads=0,timerCreates=0,timerClears=0;
 Object.defineProperty(window,"sessionStorage",{get(){storageReads+=1;throw new Error("Hero must not access storage");}});
 class FakeDate extends Date{constructor(...args){if(args.length)super(...args);else{clockReads+=1;super(0);}}}
 function setTimeout(){timerCreates+=1;throw new Error("Hero must not own a boundary timer");}
 function clearTimeout(){timerClears+=1;}
 const context={window,document,MutationObserver,Date:FakeDate,setTimeout,clearTimeout};
 vm.runInNewContext(controllerSource,context,{filename:"hero-time.js"});

 function publish(snapshot){
  root.setAttribute("data-theme-mode",snapshot.mode);
  root.setAttribute("data-theme-state",snapshot.state);
  root.setAttribute("data-theme",snapshot.theme);
  current=snapshot;
  if(subscriber)subscriber(snapshot);
 }
 function settle(reduced){
  root.setAttribute("data-reduced-motion",reduced?"reduce":"no-preference");
  window.dispatchEvent({type:"jbthemesettle",detail:current});
 }
 function latestFor(element){return animations.findLast(animation=>animation.element===element);}
 function finishLatestSet(){
  const latest=animations.slice(-8);
  latest.forEach(animation=>animation.finish());
  return latest;
 }
 function rendered(){
  return {
   gradients:gradients.map(layer=>Number(cssValue(layer,"opacity"))),
   spill:Number(cssValue(spill,"opacity")),
   portrait:{opacity:Number(cssValue(portrait,"opacity")),filter:String(cssValue(portrait,"filter"))},
   active:animations.filter(animation=>!animation.cancelled).length
  };
 }
 return {window,document,root,controller:window.HeroTimeController,hero,control,button,menu,icon,autoState,
  gradients,spill,face,portrait,portraitTargets,animations,modeCalls,publish,settle,latestFor,finishLatestSet,rendered,
  accesses:()=>({storageReads,clockReads,timerCreates,timerClears}),unsubscribed:()=>unsubscribed};
}

const failures=[];
function test(name,run){try{run();}catch(error){failures.push(name+": "+error.message);}}

test("Home renders the shared initial snapshot without storage clock or timer ownership",()=>{
 const h=makeHarness({snapshot:{mode:"night",state:"night",theme:"dark"}});
 assert.deepEqual(h.accesses(),{storageReads:0,clockReads:0,timerCreates:0,timerClears:0});
 assert.equal(h.hero.getAttribute("data-time-mode"),"night");
 assert.equal(h.hero.getAttribute("data-time-state"),"night");
 assert.equal(h.icon.getAttribute("data-icon"),"night");
 assert.equal(h.autoState.textContent,"· Night");
 assert.equal(h.menu.children.find(item=>item.getAttribute("data-time-mode")==="night").getAttribute("aria-checked"),"true");
});

test("Time menu delegates its choice to SiteTheme",()=>{
 const h=makeHarness();
 const night=h.menu.children.find(item=>item.getAttribute("data-time-mode")==="night");
 h.menu.dispatchEvent({type:"click",target:night});
 assert.deepEqual(h.modeCalls,["night"]);
 assert.equal(h.button.getAttribute("aria-expanded"),"false");
});

test("root-before-publish Night Off Night captures the actually rendered spill and settles exclusively",()=>{
 const h=makeHarness();
 assert.deepEqual(h.rendered(),{
  gradients:[0,0,1,0,0,0],spill:0,
  portrait:h.portraitTargets.daytime,active:0
 });

 h.publish({mode:"night",state:"night",theme:"dark"});
 const intoNight=h.latestFor(h.spill);
 assert.equal(h.animations.slice(-8).every(animation=>animation.timing.duration===640),true);
 assert.equal(h.animations.slice(-8).every(animation=>animation.timing.easing==="cubic-bezier(.22,1,.36,1)"),true);
 assert.equal(intoNight.frames[0].opacity,0,"root target must not replace the old rendered spill before capture");
 assert.equal(intoNight.frames.at(-1).opacity,1);
 intoNight.setProgress(.4);

 h.publish({mode:"off",state:"off",theme:"light"});
 const intoOff=h.latestFor(h.spill);
 assert.equal(intoOff.frames[0].opacity,.4);
 assert.equal(intoOff.frames.at(-1).opacity,0);
 intoOff.setProgress(.25);

 h.publish({mode:"night",state:"night",theme:"dark"});
 const backToNight=h.latestFor(h.spill);
 assert.ok(Math.abs(backToNight.frames[0].opacity-.3)<1e-9);
 assert.equal(backToNight.frames.at(-1).opacity,1);
 const finished=h.finishLatestSet();
 assert.equal(finished.every(animation=>animation.cancelled),true);
 assert.deepEqual(h.rendered(),{
  gradients:[0,0,0,0,0,1],spill:1,
  portrait:h.portraitTargets.night,active:0
 });
});

test("live reduced motion settles portrait opacity and filter then restores normal retargeting",()=>{
 const h=makeHarness();
 h.publish({mode:"night",state:"night",theme:"dark"});
 h.animations.slice(-8).forEach(animation=>animation.setProgress(.35));
 const interrupted=h.animations.slice(-8);

 h.settle(true);
 assert.equal(interrupted.every(animation=>animation.cancelled),true);
 assert.deepEqual(h.rendered(),{
  gradients:[0,0,0,0,0,1],spill:1,
  portrait:h.portraitTargets.night,active:0
 });
 assert.equal(h.portrait.style.values.opacity,String(h.portraitTargets.night.opacity));
 assert.equal(h.portrait.style.values.filter,h.portraitTargets.night.filter);

 h.settle(false);
 assert.equal(h.portrait.style.values.opacity,String(h.portraitTargets.night.opacity));
 assert.equal(h.portrait.style.values.filter,h.portraitTargets.night.filter);
 assert.deepEqual(h.rendered(),{
  gradients:[0,0,0,0,0,1],spill:1,
  portrait:h.portraitTargets.night,active:0
 });

 h.publish({mode:"off",state:"off",theme:"light"});
 assert.equal(h.latestFor(h.spill).frames[0].opacity,1);
 const portraitFrames=h.latestFor(h.portrait).frames;
 assert.equal(portraitFrames[0].opacity,h.portraitTargets.night.opacity);
 assert.equal(portraitFrames[0].filter,h.portraitTargets.night.filter);
 assert.equal(portraitFrames.at(-1).opacity,h.portraitTargets.off.opacity);
 assert.equal(portraitFrames.at(-1).filter,h.portraitTargets.off.filter);
});

test("reduced motion settles all seven states with exclusive scene destinations",()=>{
 const h=makeHarness({reducedMotion:true});
 const states=["off","pre-dawn","sunrise","daytime","dusk","sunset","night"];
 states.forEach(state=>{
  h.publish({mode:state,state,theme:state==="night"?"dark":"light"});
  const expectedGradients=["pre-dawn","sunrise","daytime","dusk","sunset","night"]
   .map(candidate=>candidate===state?1:0);
  assert.deepEqual(h.rendered(),{
   gradients:expectedGradients,
   spill:state==="night"?1:0,
   portrait:h.portraitTargets[state],
   active:0
  },state);
 });
});

test("Time mirrors responsive Mood sources and becomes inert after destroy",()=>{
 const h=makeHarness({faceSrc:"images/neutral.webp"});
 assert.equal(h.portrait.getAttribute("src"),"images/neutral.webp");

 h.face.setAttribute("src","images/cookie.webp");
 assert.equal(h.portrait.getAttribute("src"),"images/cookie.webp");
 h.face.setAttribute("srcset","images/cookie.webp 1x, images/cookie@2x.webp 2x");
 h.face.setAttribute("sizes","100vw");
 assert.equal(h.portrait.getAttribute("srcset"),"images/cookie.webp 1x, images/cookie@2x.webp 2x");
 h.face.currentSrc="images/cookie@2x.webp";
 h.face.dispatchEvent({type:"load"});
 assert.equal(h.portrait.getAttribute("src"),"images/cookie@2x.webp");
 assert.equal(h.portrait.getAttribute("srcset"),h.face.getAttribute("srcset"));

 const before={
  src:h.portrait.getAttribute("src"),
  srcset:h.portrait.getAttribute("srcset"),
  sizes:h.portrait.getAttribute("sizes")
 };
 h.controller.destroy();
 h.face.setAttribute("src","images/rest.webp");
 h.face.setAttribute("srcset","images/rest.webp 1x, images/rest@2x.webp 2x");
 h.face.setAttribute("sizes","50vw");
 h.face.currentSrc="images/rest@2x.webp";
 h.face.dispatchEvent({type:"load"});
 assert.deepEqual({
  src:h.portrait.getAttribute("src"),
  srcset:h.portrait.getAttribute("srcset"),
  sizes:h.portrait.getAttribute("sizes")
 },before);
 assert.equal(h.unsubscribed(),1);
 assert.equal(h.face.listenerCount("load"),0);
});

if(failures.length){
 failures.forEach(failure=>console.error("FAIL "+failure));
 process.exitCode=1;
}else console.log("hero time controller behavior: OK");
