const assert=require("node:assert/strict");
const fs=require("node:fs");

const T=require("../time-aware-thumbnails.js");

function deferred(){
 let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
 return {promise,resolve,reject};
}

function target(project,loading){
 const attributes=new Map([
  ["data-time-thumbnail",project],
  ["src","images/cs/"+project+"-cover.webp"],
  ["alt",project+" preserved alt"],
  ["loading",loading],
  ["decoding","async"]
 ]);
 return {
  attributes,
  setAttribute(name,value){attributes.set(name,String(value));},
  getAttribute(name){return attributes.has(name)?attributes.get(name):null;},
  hasAttribute(name){return attributes.has(name);},
  removeAttribute(name){attributes.delete(name);}
 };
}

function harness(initialState="off"){
 const images=[target("bearings","eager"),target("apollo","lazy"),target("bearings","lazy"),target("apollo","lazy")];
 const document={querySelectorAll(selector){
  assert.equal(selector,"img[data-time-thumbnail]");
  return images;
 }};
 let listener=null;
 let unsubscribeCalls=0;
 const theme={
  getSnapshot(){return {mode:initialState,state:initialState,theme:initialState==="night"?"dark":"light"};},
  subscribe(next){listener=next;return ()=>{unsubscribeCalls+=1;listener=null;};}
 };
 const pending=[];
 class FakeImage{
  constructor(){
   this.request=deferred();
   this.decode=()=>this.request.promise;
   pending.push(this);
  }
 }
 const windowListeners=new Map();
 const window={
  addEventListener(type,fn){windowListeners.set(type,fn);},
  removeEventListener(type,fn){if(windowListeners.get(type)===fn)windowListeners.delete(type);}
 };
 const controller=T.createController({document,theme,Image:FakeImage,window});
 return {
  images,pending,controller,
  publish(state){assert.ok(listener);listener({mode:state,state,theme:state==="night"?"dark":"light"});},
  pagehide(persisted){const fn=windowListeners.get("pagehide");assert.ok(fn);fn({persisted});},
  unsubscribeCalls:()=>unsubscribeCalls,
  hasPagehide:()=>windowListeners.has("pagehide")
 };
}

function attr(image,name){return image.getAttribute(name);}
function flush(){return new Promise(resolve=>setImmediate(resolve));}

const failures=[];
async function test(name,run){
 try{await run();}
 catch(error){failures.push(name+": "+(error&&error.stack||error));}
}

(async function(){
 await test("all projects and published states resolve to literal source contracts",async()=>{
  const expectedStates=["off","pre-dawn","sunrise","daytime","dusk","sunset","night"];
  assert.deepEqual(T.STATES,expectedStates);
  assert.equal(T.SIZES,"(max-width: 760px) calc(100vw - 48px), (max-width: 1280px) calc(100vw - 80px), 1200px");
  for(const project of ["bearings","apollo"]){
   assert.deepEqual(T.sourceFor(project,"off"),{
    src:"images/cs/"+project+"-cover.webp",
    srcset:"",
    sizes:""
   });
   for(const state of expectedStates.slice(1)){
    assert.deepEqual(T.sourceFor(project,state),{
     src:"images/cs/variants/time/"+project+"/"+state+"-1200.webp",
     srcset:"images/cs/variants/time/"+project+"/"+state+"-1200.webp 1200w, images/cs/variants/time/"+project+"/"+state+"-2400.webp 2400w",
     sizes:T.SIZES
    });
   }
  }
 });

 await test("duplicate instances wait for both responsive preloads and preserve unrelated attributes",async()=>{
  const h=harness("daytime");
  assert.equal(h.pending.length,2);
  assert.equal(h.pending[0].sizes,T.SIZES);
  assert.match(h.pending[0].srcset,/daytime-1200\.webp 1200w, .*daytime-2400\.webp 2400w$/);
  assert.match(h.pending[1].srcset,/daytime-1200\.webp 1200w, .*daytime-2400\.webp 2400w$/);
  h.pending[0].request.resolve();
  await flush();
  h.images.forEach((image,index)=>assert.equal(attr(image,"src"),"images/cs/"+(index%2?"apollo":"bearings")+"-cover.webp"));
  h.pending[1].request.resolve();
  await flush();
  h.images.forEach(image=>{
   const project=attr(image,"data-time-thumbnail");
   assert.equal(attr(image,"src"),"images/cs/variants/time/"+project+"/daytime-1200.webp");
   assert.match(attr(image,"srcset"),/daytime-1200\.webp 1200w, .*daytime-2400\.webp 2400w$/);
   assert.equal(attr(image,"sizes"),T.SIZES);
   assert.equal(attr(image,"alt"),project+" preserved alt");
   assert.equal(attr(image,"decoding"),"async");
  });
  assert.equal(attr(h.images[0],"loading"),"eager");
  assert.equal(attr(h.images[1],"loading"),"lazy");
 });

 await test("Off restores exact original src and removes responsive attributes only after decode",async()=>{
  const h=harness("night");
  h.pending.forEach(loader=>loader.request.resolve());
  await flush();
  h.publish("off");
  assert.equal(h.pending.length,4);
  h.images.forEach(image=>assert.match(attr(image,"src"),/night-1200\.webp$/));
  h.pending.slice(2).forEach(loader=>loader.request.resolve());
  await flush();
  h.images.forEach(image=>{
   const project=attr(image,"data-time-thumbnail");
   assert.equal(attr(image,"src"),"images/cs/"+project+"-cover.webp");
   assert.equal(image.hasAttribute("srcset"),false);
   assert.equal(image.hasAttribute("sizes"),false);
  });
 });

 await test("rapid retargeting never commits a stale out-of-order state",async()=>{
  const h=harness("off");
  h.pending.forEach(loader=>loader.request.resolve());
  await flush();
  h.publish("daytime");
  const daytime=h.pending.slice(2);
  h.publish("sunset");
  const sunset=h.pending.slice(4);
  sunset.forEach(loader=>loader.request.resolve());
  await flush();
  h.images.forEach(image=>assert.match(attr(image,"src"),/sunset-1200\.webp$/));
  daytime.forEach(loader=>loader.request.resolve());
  await flush();
  h.images.forEach(image=>assert.match(attr(image,"src"),/sunset-1200\.webp$/));
 });

 await test("decode failure leaves every previous image visible and allows a later retry",async()=>{
  const h=harness("off");
  h.pending.forEach(loader=>loader.request.resolve());
  await flush();
  h.publish("night");
  h.pending[2].request.resolve();
  h.pending[3].request.reject(new Error("decode failed"));
  await flush();
  h.images.forEach(image=>assert.match(attr(image,"src"),/-cover\.webp$/));
  h.publish("off");
  await flush();
  h.publish("night");
  assert.equal(h.pending.length,5);
  h.pending[4].request.resolve();
  await flush();
  h.images.forEach(image=>assert.match(attr(image,"src"),/night-1200\.webp$/));
 });

 await test("cleanup ignores persisted pagehide and blocks late commits after final teardown",async()=>{
  const h=harness("daytime");
  h.pagehide(true);
  assert.equal(h.unsubscribeCalls(),0);
  h.pagehide(false);
  assert.equal(h.unsubscribeCalls(),1);
  assert.equal(h.hasPagehide(),false);
  h.pending.forEach(loader=>loader.request.resolve());
  await flush();
  h.images.forEach(image=>assert.match(attr(image,"src"),/-cover\.webp$/));
 });

 await test("home HTML marks exactly four thumbnails and loads the controller once",async()=>{
  const html=fs.readFileSync(require.resolve("../index.html"),"utf8");
  assert.equal((html.match(/data-time-thumbnail="bearings"/g)||[]).length,2);
  assert.equal((html.match(/data-time-thumbnail="apollo"/g)||[]).length,2);
  assert.equal((html.match(/<script src="time-aware-thumbnails\.js" defer><\/script>/g)||[]).length,1);
  assert.equal((html.match(/<img class="csImg"[^>]*data-time-thumbnail=/g)||[]).length,4);
 });

 if(failures.length){
  failures.forEach(failure=>console.error("FAIL "+failure));
  process.exitCode=1;
 }else console.log("time-aware home thumbnails: OK");
})();
