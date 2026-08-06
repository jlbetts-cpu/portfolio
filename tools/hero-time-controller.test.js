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
 class FakeElement{
  constructor(attributes={}){
   eventTarget(this);
   this.attributes=new Map(Object.entries(attributes));
   this.children=[];
   this.parentElement=null;
   this.textContent="";
   this.computed={opacity:"0",filter:"none"};
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
  removeAttribute(name){this.attributes.delete(name);}
  querySelectorAll(selector){
   if(selector==='[role="menuitemradio"]')return this.children.filter(child=>child.getAttribute("role")==="menuitemradio");
   if(selector===".heroTimeGradient")return this.children.filter(child=>child.classList.contains("heroTimeGradient"));
   return [];
  }
  contains(target){return target===this||this.children.includes(target);}
  closest(selector){return selector==='[role="menuitemradio"]'&&this.getAttribute("role")==="menuitemradio"?this:null;}
  getBoundingClientRect(){return {top:100,bottom:300,left:100,right:300};}
  focus(){document.activeElement=this;}
  animate(frames,timing){
   const animation={element:this,frames,timing,cancelled:false,onfinish:null,cancel(){this.cancelled=true;}};
   animations.push(animation);
   return animation;
  }
 }

 const mutationObservers=[];
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

 const hero=new FakeElement(options.heroAttributes);
 hero.classList.add("hero");
 const control=new FakeElement();
 const button=new FakeElement();
 const menu=new FakeElement();
 const icon=new FakeElement();
 const autoState=new FakeElement();
 const spill=new FakeElement();
 const face=new FakeElement({src:options.faceSrc||"images/neutral.webp"});
 const portrait=new FakeElement();
 const gradients=["pre-dawn","sunrise","daytime","dusk","sunset","night"].map(state=>{
  const layer=new FakeElement({"data-time-gradient":state});
  layer.classList.add("heroTimeGradient");
  hero.appendChild(layer);
  return layer;
 });
 menu.children=["auto","off","pre-dawn","sunrise","daytime","dusk","sunset","night"].map(mode=>new FakeElement({
  role:"menuitemradio","aria-checked":mode==="auto"?"true":"false","data-time-mode":mode
 }));
 const root=new FakeElement({"data-reduced-motion":options.reducedMotion?"reduce":"no-preference"});
 const byId={heroTime:control,heroTimeBtn:button,heroTimeMenu:menu,heroTimeIcon:icon,
  heroTimeAutoState:autoState,heroTimeSpill:spill,face,heroTimePortraitCast:portrait};
 document=eventTarget({
  documentElement:root,
  activeElement:null,
  hidden:false,
  querySelector:selector=>selector===".hero"?hero:null,
  getElementById:id=>byId[id]||null
 });

 const initial=options.snapshot||{mode:"auto",state:"daytime",theme:"light"};
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
  opacity:element.computed.opacity,
  filter:element.computed.filter,
  getPropertyValue:name=>name==="--hero-time-duration"?(options.duration||"800ms"):""
 });
 let storageReads=0,storageWrites=0,clockReads=0,timerCreates=0;
 Object.defineProperty(window,"sessionStorage",{get(){storageReads+=1;throw new Error("Hero must not access storage");}});
 class FakeDate extends Date{constructor(...args){if(args.length)super(...args);else{clockReads+=1;super(0);}}}
 function setTimeout(){timerCreates+=1;throw new Error("Hero must not own a boundary timer");}
 function clearTimeout(){storageWrites+=1;}
 const context={window,document,MutationObserver,Date:FakeDate,setTimeout,clearTimeout};
 vm.runInNewContext(controllerSource,context,{filename:"hero-time.js"});

 function publish(snapshot){
  current=snapshot;
  if(subscriber)subscriber(snapshot);
 }
 function settle(){window.dispatchEvent({type:"jbthemesettle",detail:current});}
 return {window,document,root,controller:window.HeroTimeController,hero,control,button,menu,icon,autoState,
  gradients,spill,face,portrait,animations,modeCalls,publish,settle,
  accesses:()=>({storageReads,storageWrites,clockReads,timerCreates}),unsubscribed:()=>unsubscribed};
}

const failures=[];
function test(name,run){try{run();}catch(error){failures.push(name+": "+error.message);}}

test("Home renders the shared initial snapshot without storage clock or timer ownership",()=>{
 const h=makeHarness({snapshot:{mode:"night",state:"night",theme:"dark"}});
 assert.deepEqual(h.accesses(),{storageReads:0,storageWrites:0,clockReads:0,timerCreates:0});
 assert.equal(h.hero.getAttribute("data-time-mode"),"night");
 assert.equal(h.hero.getAttribute("data-time-state"),"night");
 assert.equal(h.icon.getAttribute("data-icon"),"night");
 assert.equal(h.autoState.textContent,"· Night");
 assert.equal(h.menu.children.find(item=>item.getAttribute("data-time-mode")==="night").getAttribute("aria-checked"),"true");
});

test("shared snapshots atomically retarget the menu icon label and Hero",()=>{
 const h=makeHarness();
 h.publish({mode:"off",state:"off",theme:"light"});
 assert.equal(h.hero.getAttribute("data-time-mode"),"off");
 assert.equal(h.hero.getAttribute("data-time-state"),"off");
 assert.equal(h.icon.getAttribute("data-icon"),"off");
 assert.equal(h.autoState.textContent,"· Off");
 assert.equal(h.menu.children.find(item=>item.getAttribute("data-time-mode")==="off").getAttribute("aria-checked"),"true");
 assert.equal(h.menu.children.filter(item=>item.getAttribute("aria-checked")==="true").length,1);
});

test("Time menu delegates its choice to SiteTheme",()=>{
 const h=makeHarness();
 const night=h.menu.children.find(item=>item.getAttribute("data-time-mode")==="night");
 h.menu.dispatchEvent({type:"click",target:night});
 assert.deepEqual(h.modeCalls,["night"]);
 assert.equal(h.button.getAttribute("aria-expanded"),"false");
});

test("rapid scene retargeting captures and cancels before starting one coordinated set",()=>{
 const h=makeHarness();
 h.gradients[2].computed.opacity="0.6";
 h.spill.computed.opacity="0.2";
 h.portrait.computed.opacity="0.12";
 h.portrait.computed.filter="brightness(1.08) saturate(.9)";
 h.publish({mode:"night",state:"night",theme:"dark"});
 const first=h.animations.slice();
 assert.equal(first.length,8);
 assert.ok(first.every(animation=>animation.timing.duration===800&&animation.timing.easing==="cubic-bezier(.65,0,.35,1)"));
 h.gradients.forEach((layer,index)=>{layer.computed.opacity=index===5?"0.35":"0.08";});
 h.spill.computed.opacity="0.35";
 h.portrait.computed.opacity="0.18";
 h.publish({mode:"off",state:"off",theme:"light"});
 assert.ok(first.every(animation=>animation.cancelled));
 const second=h.animations.slice(first.length);
 assert.equal(second.length,8);
 assert.equal(second.find(animation=>animation.element===h.spill).frames[0].opacity,0.35);
 assert.equal(second.find(animation=>animation.element===h.portrait).frames.at(-1).opacity,0);
});

test("live reduced motion cancels in-flight scene work and commits final values",()=>{
 const h=makeHarness();
 h.publish({mode:"night",state:"night",theme:"dark"});
 const active=h.animations.slice();
 assert.ok(active.length>0);
 h.root.setAttribute("data-reduced-motion","reduce");
 h.settle();
 assert.ok(active.every(animation=>animation.cancelled));
 assert.equal(h.gradients[5].style.values.opacity,"1");
 assert.equal(h.gradients.slice(0,5).every(layer=>layer.style.values.opacity==="0"),true);
 assert.equal(h.spill.style.values.opacity,"1");
});

test("Time mirrors every Mood-owned portrait source without writing face identity",()=>{
 const h=makeHarness({faceSrc:"images/neutral.webp"});
 assert.equal(h.portrait.getAttribute("src"),"images/neutral.webp");
 h.face.setAttribute("src","images/cookie.webp");
 assert.equal(h.portrait.getAttribute("src"),"images/cookie.webp");
 h.face.setAttribute("src","images/neutral_closed.webp");
 assert.equal(h.portrait.getAttribute("src"),"images/neutral_closed.webp");
 assert.equal(h.face.getAttribute("src"),"images/neutral_closed.webp");
 h.controller.destroy();
 assert.equal(h.unsubscribed(),1);
});

if(failures.length){
 failures.forEach(failure=>console.error("FAIL "+failure));
 process.exitCode=1;
}else console.log("hero time controller behavior: OK");
