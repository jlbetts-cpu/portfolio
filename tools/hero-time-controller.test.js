const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const M=require("../hero-time-presets.js");
const controllerSource=fs.readFileSync(require.resolve("../hero-time.js"),"utf8");

function makeHarness(options={}){
 let document;
 class FakeElement{
  constructor(attributes={}){
   this.attributes=new Map(Object.entries(attributes));
   this.listeners={};
   this.children=[];
   this.style={
    values:{},
    removeProperty:name=>{delete this.style.values[name];}
   };
   this.classList={
    values:new Set(),
    add:(...names)=>names.forEach(name=>this.classList.values.add(name)),
    remove:(...names)=>names.forEach(name=>this.classList.values.delete(name)),
    contains:name=>this.classList.values.has(name)
   };
  }
  addEventListener(type,handler){this.listeners[type]=handler;}
  removeEventListener(type,handler){if(this.listeners[type]===handler)delete this.listeners[type];}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  getAttribute(name){return this.attributes.has(name)?this.attributes.get(name):null;}
  hasAttribute(name){return this.attributes.has(name);}
  removeAttribute(name){this.attributes.delete(name);}
  querySelectorAll(){return this.children;}
  contains(target){return target===this||this.children.includes(target);}
  getBoundingClientRect(){return {top:100,bottom:300,left:100,right:300};}
  focus(){document.activeElement=this;}
 }

 const hero=new FakeElement(options.heroAttributes);
 const body=new FakeElement(options.bodyAttributes);
 const control=new FakeElement();
 const button=new FakeElement();
 const menu=new FakeElement();
 const icon=new FakeElement();
 const autoState=new FakeElement();
 autoState.textContent="";
 menu.children=M.MODES.map(mode=>new FakeElement({role:"menuitemradio","aria-checked":mode==="auto"?"true":"false","data-time-mode":mode}));
 const byId={heroTime:control,heroTimeBtn:button,heroTimeMenu:menu,heroTimeIcon:icon,heroTimeAutoState:autoState};
 document={
  body,
  activeElement:null,
  visibilityState:"visible",
  listeners:{},
  querySelector:selector=>selector===".hero"?hero:null,
  getElementById:id=>byId[id]||null,
  addEventListener(type,handler){this.listeners[type]=handler;},
  removeEventListener(type,handler){if(this.listeners[type]===handler)delete this.listeners[type];}
 };

 const times=(options.times||[new Date(2026,7,6,12).getTime()]).slice();
 let lastTime=times[times.length-1],clockReads=0;
 class FakeDate extends Date{
  constructor(...args){
   if(args.length){super(...args);return;}
   const next=times.length?times.shift():lastTime;
   lastTime=next;
   clockReads+=1;
   super(next);
  }
 }
 const scheduled=[];
 const cleared=[];
 let timerId=0;
 const storage={
  getItem(){return null;},
  setItem(){},
  removeItem(){}
 };
 const window={HeroTimeModel:M,innerHeight:800,innerWidth:1200};
 window.window=window;
 const context={window,document,sessionStorage:storage,Date:FakeDate,
  setTimeout(handler,delay){scheduled.push({handler,delay,id:++timerId});return timerId;},
  clearTimeout(id){cleared.push(id);}
 };
 vm.runInNewContext(controllerSource,context,{filename:"hero-time.js"});
 return {controller:window.HeroTimeController,hero,body,autoState,scheduled,cleared,
  clockReads:()=>clockReads,resetClockReads:()=>{clockReads=0;}};
}

const failures=[];
function test(name,run){
 try{run();}
 catch(error){failures.push(name+": "+error.message);}
}

test("one clock sample drives initial state, copy, and boundary timeout",()=>{
 const before=new Date(2026,7,6,3,59,59,999).getTime();
 const after=new Date(2026,7,6,4,0,0,1).getTime();
 const h=makeHarness({times:[before,before,after,after]});
 assert.equal(h.clockReads(),1);
 assert.equal(h.hero.getAttribute("data-time-state"),"night");
 assert.equal(h.autoState.textContent,"\u00b7 Night");
 assert.equal(h.scheduled.at(-1).delay,51);
 h.resetClockReads();
 h.controller.refreshAutomatic();
 assert.equal(h.clockReads(),1);
});

test("body mirrors state and destroy restores both state scopes",()=>{
 const h=makeHarness({
  bodyAttributes:{"data-time-mode":"body-before"},
  heroAttributes:{"data-time-state":"hero-before"}
 });
 assert.equal(h.body.getAttribute("data-time-mode"),"auto");
 assert.equal(h.body.getAttribute("data-time-state"),"daytime");
 assert.equal(h.hero.getAttribute("data-time-mode"),"auto");
 assert.equal(h.hero.getAttribute("data-time-state"),"daytime");
 h.resetClockReads();
 h.controller.setMode("sunset");
 assert.equal(h.clockReads(),1);
 assert.equal(h.body.getAttribute("data-time-mode"),"sunset");
 assert.equal(h.body.getAttribute("data-time-state"),"sunset");
 h.controller.destroy();
 assert.equal(h.body.getAttribute("data-time-mode"),"body-before");
 assert.equal(h.body.hasAttribute("data-time-state"),false);
 assert.equal(h.hero.hasAttribute("data-time-mode"),false);
 assert.equal(h.hero.getAttribute("data-time-state"),"hero-before");
});

if(failures.length){
 failures.forEach(failure=>console.error("FAIL "+failure));
 process.exitCode=1;
}else console.log("hero time controller behavior: OK");
