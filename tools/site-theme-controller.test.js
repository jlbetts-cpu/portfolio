const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const S=require("../site-theme-state.js");
const source=fs.readFileSync(require.resolve("../site-theme.js"),"utf8");

function eventTarget(target){
 const listeners={};
 target.addEventListener=(type,listener)=>{(listeners[type]||(listeners[type]=new Set())).add(listener);};
 target.removeEventListener=(type,listener)=>{if(listeners[type])listeners[type].delete(listener);};
 target.dispatchEvent=event=>{
  (listeners[event.type]||new Set()).forEach(listener=>listener.call(target,event));
  return true;
 };
 target.listenerCount=type=>(listeners[type]||new Set()).size;
 return target;
}

function makeElement(){
 const attributes=new Map();
 return eventTarget({
  attributes,
  classList:{
   values:new Set(),
   add(...names){names.forEach(name=>this.values.add(name));},
   contains(name){return this.values.has(name);}
  },
  setAttribute(name,value){attributes.set(name,String(value));},
  getAttribute(name){return attributes.has(name)?attributes.get(name):null;},
  hasAttribute(name){return attributes.has(name);},
  removeAttribute(name){attributes.delete(name);}
 });
}

function makeHarness(options={}){
 const root=makeElement();
 const body=makeElement();
 const document=eventTarget({documentElement:root,body:options.bodyAtBoot===false?null:body,hidden:false,visibilityState:"visible"});
 const window=eventTarget({SiteThemeState:S});
 window.window=window;
 const calls={get:0,set:[],remove:0};
 const values=new Map(options.stored===undefined?[]:[["jbHeroTimeMode",options.stored]]);
 const storage={
  getItem(key){calls.get+=1;if(options.readFails)throw new Error("read blocked");return values.has(key)?values.get(key):null;},
  setItem(key,value){calls.set.push([key,value]);if(options.writeFails)throw new Error("write blocked");values.set(key,value);},
  removeItem(key){calls.remove+=1;if(options.removeFails)throw new Error("remove blocked");values.delete(key);}
 };
 let storageAccesses=0;
 if(options.storageAccessFails)Object.defineProperty(window,"sessionStorage",{get(){storageAccesses+=1;throw new Error("storage unavailable");}});
 else window.sessionStorage=storage;
 const times=(options.times||[new Date(2026,7,6,12).getTime()]).slice();
 let latest=times.at(-1);
 class FakeDate extends Date{
  constructor(...args){if(args.length){super(...args);return;}const next=times.length?times.shift():latest;latest=next;super(next);}
 }
 const scheduled=[];
 const cleared=[];
 let timerId=0;
 const motion=eventTarget({matches:Boolean(options.reducedMotion)});
 window.matchMedia=query=>{assert.equal(query,"(prefers-reduced-motion: reduce)");return motion;};
 function CustomEvent(type,init={}){this.type=type;this.detail=init.detail;}
 const context={window,document,Date:FakeDate,CustomEvent,
  setTimeout(handler,delay){const timer={id:++timerId,handler,delay};scheduled.push(timer);return timer.id;},
  clearTimeout(id){cleared.push(id);}
 };
 vm.runInNewContext(source,context,{filename:"site-theme.js"});
 return {root,body,window,document,motion,storage,calls,values,scheduled,cleared,storageAccesses:()=>storageAccesses,controller:window.SiteTheme};
}

const failures=[];
function test(name,run){try{run();}catch(error){failures.push(name+": "+error.message);}}

test("persisted manual Night commits all root attributes during evaluation",()=>{
 const h=makeHarness({stored:"night",times:[new Date(2026,7,6,12).getTime()]});
 assert.equal(h.root.getAttribute("data-theme"),"dark");
 assert.equal(h.root.getAttribute("data-theme-mode"),"night");
 assert.equal(h.root.getAttribute("data-theme-state"),"night");
 assert.ok(h.root.classList.contains("theme-ready"));
 assert.equal(h.scheduled.length,0);
});

test("late body creation mirrors later changes without becoming the authority",()=>{
 const h=makeHarness({bodyAtBoot:false});
 assert.equal(h.root.getAttribute("data-theme-mode"),"daytime");
 h.document.body=h.body;
 h.controller.setMode("night");
 assert.equal(h.root.getAttribute("data-theme-mode"),"night");
 assert.equal(h.body.getAttribute("data-theme-mode"),"night");
 assert.equal(h.body.getAttribute("data-theme-state"),"night");
});

/* A MISSING PREFERENCE AND AN UNREADABLE ONE ARE DIFFERENT QUESTIONS.
   No key at all means the visitor has never chosen, and that is the only case
   the default owns -- it resolves to Daytime, and to Daytime as the MODE, not
   as an hour that Automatic happens to be passing through. A key holding
   garbage is an unreadable preference, and normalizeMode still answers
   Automatic for that. Storage that cannot be reached at all is treated as
   never-chosen, because there is nowhere for a preference to have been. */
test("a missing preference resolves Daytime and an unreadable one resolves Automatic",()=>{
 const inaccessible=makeHarness({storageAccessFails:true});
 [makeHarness(),makeHarness({readFails:true}),inaccessible].forEach(h=>{
  assert.deepEqual(h.controller.getSnapshot(),{mode:"daytime",state:"daytime",theme:"light"});
  assert.equal(h.root.getAttribute("data-theme-mode"),"daytime");
 });
 const garbage=makeHarness({stored:"garbage"});
 assert.deepEqual(garbage.controller.getSnapshot(),{mode:"auto",state:"daytime",theme:"light"});
 assert.equal(garbage.root.getAttribute("data-theme-mode"),"auto");
 assert.equal(inaccessible.storageAccesses(),1);
});

/* THE DEFAULT LOSES TO A CHOICE, AND "auto" IS A CHOICE. It used to be stored
   by removing the key, which made it indistinguishable from never having
   chosen -- survivable while auto was also the default, fatal now. */
test("a stored Automatic survives the Daytime default",()=>{
 const h=makeHarness({stored:"auto",times:[new Date(2026,7,6,22).getTime()]});
 assert.deepEqual(h.controller.getSnapshot(),{mode:"auto",state:"night",theme:"dark"});
 assert.equal(h.root.getAttribute("data-theme-mode"),"auto");
});

test("choosing Automatic writes it out rather than clearing the key",()=>{
 const h=makeHarness({stored:"night",times:[new Date(2026,7,6,12).getTime()]});
 h.controller.setMode("auto");
 assert.deepEqual(h.calls.set,[["jbHeroTimeMode","auto"]]);
 assert.equal(h.calls.remove,0);
 assert.deepEqual(h.controller.getSnapshot(),{mode:"auto",state:"daytime",theme:"light"});
});

/* A choice that cannot be remembered is not honoured: the visitor would get it
   once and lose it on the next page, which reads as a bug. It falls back to the
   default now rather than to Automatic. */
test("failed storage writes leave the controller on the default",()=>{
 const write=harnessWithWriteFailure();
 assert.deepEqual(write.controller.setMode("night"),{mode:"daytime",state:"daytime",theme:"light"});
 assert.equal(write.root.getAttribute("data-theme-mode"),"daytime");
 const auto=harnessWithWriteFailure();
 assert.deepEqual(auto.controller.setMode("auto"),{mode:"daytime",state:"daytime",theme:"light"});
});

function harnessWithWriteFailure(){return makeHarness({writeFails:true});}

test("manual mode persists and publishes one shared snapshot",()=>{
 const h=makeHarness();
 const received=[];
 const events=[];
 h.controller.subscribe(snapshot=>received.push(snapshot));
 h.window.addEventListener("jbthemechange",event=>events.push(event.detail));
 const snapshot=h.controller.setMode("night");
 assert.deepEqual(h.calls.set,[["jbHeroTimeMode","night"]]);
 assert.equal(received.length,1);
 assert.equal(events.length,1);
 assert.strictEqual(received[0],snapshot);
 assert.strictEqual(events[0],snapshot);
 assert.strictEqual(h.controller.getSnapshot(),snapshot);
});

test("Automatic persists and schedules the next boundary exactly",()=>{
 const now=new Date(2026,7,6,3,59).getTime();
 const h=makeHarness({stored:"night",times:[now]});
 h.controller.setMode("auto");
 assert.deepEqual(h.calls.set,[["jbHeroTimeMode","auto"]]);
 assert.equal(h.scheduled.length,1);
 assert.equal(h.scheduled[0].delay,60_000);
 assert.deepEqual(h.controller.getSnapshot(),{mode:"auto",state:"night",theme:"dark"});
});

test("same-state Automatic refresh publishes nothing",()=>{
 const now=new Date(2026,7,6,12).getTime();
 const h=makeHarness({stored:"auto",times:[now]});
 const first=h.controller.getSnapshot();
 let changes=0;
 h.controller.subscribe(()=>{changes+=1;});
 h.controller.refresh(new Date(now));
 assert.strictEqual(h.controller.getSnapshot(),first);
 assert.equal(changes,0);
 assert.equal(h.scheduled.length,2);
 assert.deepEqual(h.cleared,[1]);
});

test("reduced-motion changes settle and destroy releases controller resources",()=>{
 const h=makeHarness({stored:"auto"});
 const settles=[];
 h.window.addEventListener("jbthemesettle",event=>settles.push(event.detail));
 h.motion.matches=true;
 h.motion.dispatchEvent({type:"change"});
 assert.equal(h.root.getAttribute("data-reduced-motion"),"reduce");
 assert.equal(settles.length,1);
 h.controller.destroy();
 assert.deepEqual(h.cleared,[1]);
 assert.equal(h.document.listenerCount("visibilitychange"),0);
 assert.equal(h.window.listenerCount("pageshow"),0);
 assert.equal(h.motion.listenerCount("change"),0);
});

if(failures.length){
 failures.forEach(failure=>console.error("FAIL "+failure));
 process.exitCode=1;
}else console.log("site theme controller behavior: OK");
